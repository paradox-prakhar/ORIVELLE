import { createHmac, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import type { Db } from './database.js';
import { transaction } from './database.js';
import { one, now, settings } from './repository.js';
import { ApiError, type CheckoutSession, type Order, type PaymentAttempt } from './types.js';
import {
  getCheckoutSession,
  transitionCheckoutSession,
  finalizeOrderFromSession,
} from './checkout-service.js';

export interface RazorpayConfig {
  keyId: string;
  keySecret: string;
  webhookSecret: string;
  isTestMode: boolean;
  enabled: boolean;
}

export function getRazorpayConfig(): RazorpayConfig {
  const keyId = (process.env.RAZORPAY_KEY_ID || '').trim();
  const keySecret = (process.env.RAZORPAY_KEY_SECRET || '').trim();
  const webhookSecret = (process.env.RAZORPAY_WEBHOOK_SECRET || 'test_webhook_secret_key_12345678').trim();

  const isConfigured = Boolean(keyId && keySecret && !keyId.includes('placeholder') && !keySecret.includes('placeholder'));
  const isTestMode = !isConfigured || keyId.startsWith('rzp_test_');

  return {
    keyId: isConfigured ? keyId : 'rzp_test_simulated_key',
    keySecret: isConfigured ? keySecret : 'simulated_secret_key_for_testing',
    webhookSecret,
    isTestMode,
    enabled: isConfigured,
  };
}

/**
 * Creates an order on Razorpay (or a simulated provider order in test mode).
 */
export async function createRazorpayOrder(
  amountPaise: number,
  currency: string,
  receipt: string,
  notes: Record<string, string> = {}
): Promise<{ id: string; amount: number; currency: string; receipt: string }> {
  const config = getRazorpayConfig();

  // If actual Razorpay credentials provided (not the fallback test key)
  if (!config.isTestMode && config.keyId !== 'rzp_test_simulated_key') {
    try {
      const auth = Buffer.from(`${config.keyId}:${config.keySecret}`).toString('base64');
      const response = await fetch('https://api.razorpay.com/v1/orders', {
        method: 'POST',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: amountPaise,
          currency,
          receipt,
          notes,
        }),
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        throw new Error(`Razorpay API error: ${response.status} ${JSON.stringify(errorBody)}`);
      }

      const data = await response.json() as { id: string; amount: number; currency: string; receipt: string };
      return data;
    } catch (err: unknown) {
      console.error('Failed to communicate with Razorpay API:', err);
      throw new ApiError(502, 'Failed to create payment order with gateway. Please try again.', 'PAYMENT_GATEWAY_ERROR');
    }
  }

  // Deterministic simulation for test/development environments
  const simOrderId = `order_${receipt.replace(/[^a-zA-Z0-9]/g, '').slice(0, 14)}_${randomBytes(4).toString('hex')}`;
  return {
    id: simOrderId,
    amount: amountPaise,
    currency,
    receipt,
  };
}

/**
 * Initiates payment for a checkout session.
 * Reuses existing active attempt if one already exists for this session to prevent duplicate orders.
 */
export async function initiatePayment(
  db: Db,
  sessionId: string,
  userId: string,
  idempotencyKey: string
): Promise<{
  keyId: string;
  orderId: string;
  amount: number;
  currency: string;
  checkoutSessionId: string;
}> {
  const config = getRazorpayConfig();
  const session = getCheckoutSession(db, sessionId, userId);

  if (session.status === 'SUCCEEDED') {
    throw new ApiError(409, 'This checkout has already been completed.', 'ORDER_ALREADY_COMPLETED');
  }
  if (session.status === 'CANCELLED' || session.status === 'EXPIRED') {
    throw new ApiError(409, `This checkout session is ${session.status.toLowerCase()}. Please begin a new checkout.`, 'SESSION_INACTIVE');
  }

  // Check if an active payment attempt already exists for this session
  const existingAttempt = one(
    db,
    "SELECT * FROM payment_attempts WHERE checkout_session_id=? AND status IN ('initiated', 'attempted') ORDER BY rowid DESC LIMIT 1",
    sessionId
  );

  if (existingAttempt) {
    return {
      keyId: config.keyId,
      orderId: String(existingAttempt.provider_order_id),
      amount: Number(existingAttempt.amount),
      currency: String(existingAttempt.currency),
      checkoutSessionId: sessionId,
    };
  }

  // Create order with Razorpay
  const receipt = `rcpt_${session.id.slice(0, 12)}`;
  const providerOrder = await createRazorpayOrder(session.total, session.currency, receipt, {
    sessionId: session.id,
    userId: session.userId,
  });

  const attemptId = randomUUID();
  const timestamp = now();

  transaction(db, () => {
    // Record payment attempt
    db.prepare(`
      INSERT INTO payment_attempts (
        id, checkout_session_id, order_id, provider, provider_order_id,
        amount, currency, status, idempotency_key, created_at, updated_at
      ) VALUES (?, ?, NULL, 'razorpay', ?, ?, ?, 'initiated', ?, ?, ?)
    `).run(
      attemptId,
      sessionId,
      providerOrder.id,
      session.total,
      session.currency,
      idempotencyKey,
      timestamp,
      timestamp
    );

    // Transition session to PAYMENT_PENDING
    transitionCheckoutSession(db, sessionId, 'PAYMENT_PENDING', {
      providerOrderId: providerOrder.id,
    });
  });

  return {
    keyId: config.keyId,
    orderId: providerOrder.id,
    amount: providerOrder.amount,
    currency: providerOrder.currency,
    checkoutSessionId: sessionId,
  };
}

/**
 * Verifies Razorpay payment signature using HMAC SHA256 and timingSafeEqual.
 */
export function verifyRazorpaySignature(
  providerOrderId: string,
  providerPaymentId: string,
  signature: string,
  secret: string
): boolean {
  if (!providerOrderId || !providerPaymentId || !signature || !secret) {
    return false;
  }
  const payload = `${providerOrderId}|${providerPaymentId}`;
  const expected = createHmac('sha256', secret).update(payload).digest('hex');

  const bufExpected = Buffer.from(expected, 'utf8');
  const bufSignature = Buffer.from(signature, 'utf8');

  if (bufExpected.length !== bufSignature.length) return false;
  return timingSafeEqual(bufExpected, bufSignature);
}

/**
 * Completes payment verification and confirms the order.
 */
export async function verifyAndConfirmPayment(
  db: Db,
  sessionId: string,
  userId: string,
  verificationData: {
    razorpayOrderId: string;
    razorpayPaymentId: string;
    razorpaySignature: string;
  }
): Promise<Order> {
  const config = getRazorpayConfig();
  const session = getCheckoutSession(db, sessionId, userId);

  // If already succeeded, return confirmed order
  if (session.status === 'SUCCEEDED' && session.orderId) {
    return finalizeOrderFromSession(db, sessionId, {
      paymentMethod: 'razorpay',
      paymentStatus: 'paid',
      providerPaymentId: verificationData.razorpayPaymentId,
    });
  }

  // Verify signature
  const isValid = verifyRazorpaySignature(
    verificationData.razorpayOrderId,
    verificationData.razorpayPaymentId,
    verificationData.razorpaySignature,
    config.keySecret
  );

  if (!isValid) {
    // Record failed attempt
    db.prepare(`
      UPDATE payment_attempts
      SET status = 'failed', error_code = 'SIGNATURE_VERIFICATION_FAILED',
          error_description = 'HMAC SHA256 signature did not match payload', updated_at = ?
      WHERE checkout_session_id = ? AND provider_order_id = ?
    `).run(now(), sessionId, verificationData.razorpayOrderId);

    throw new ApiError(400, 'Payment verification failed: invalid signature.', 'INVALID_PAYMENT_SIGNATURE');
  }

  // Verify that provider order matches checkout session
  if (session.providerOrderId && session.providerOrderId !== verificationData.razorpayOrderId) {
    throw new ApiError(400, 'Provider order reference does not match this checkout session.', 'ORDER_REFERENCE_MISMATCH');
  }

  return transaction(db, () => {
    // Update payment attempt to captured
    db.prepare(`
      UPDATE payment_attempts
      SET status = 'captured', provider_payment_id = ?, provider_signature = ?, updated_at = ?
      WHERE checkout_session_id = ? AND provider_order_id = ?
    `).run(
      verificationData.razorpayPaymentId,
      verificationData.razorpaySignature,
      now(),
      sessionId,
      verificationData.razorpayOrderId
    );

    // Finalize order from checkout session
    const order = finalizeOrderFromSession(db, sessionId, {
      paymentMethod: 'razorpay',
      paymentStatus: 'paid',
      providerPaymentId: verificationData.razorpayPaymentId,
    });

    return order;
  });
}

/**
 * Verifies and processes incoming Razorpay Webhook events.
 * Enforces raw body HMAC validation, deduplication on event_id, and idempotent event processing.
 */
export async function processRazorpayWebhook(
  db: Db,
  rawBody: Buffer | string,
  signatureHeader: string
): Promise<{ status: 'processed' | 'duplicate' | 'ignored'; eventId?: string }> {
  const config = getRazorpayConfig();

  // Verify raw webhook signature
  const payloadStr = typeof rawBody === 'string' ? rawBody : rawBody.toString('utf8');
  const expectedSig = createHmac('sha256', config.webhookSecret).update(payloadStr).digest('hex');

  const bufExpected = Buffer.from(expectedSig, 'utf8');
  const bufReceived = Buffer.from(signatureHeader || '', 'utf8');

  if (bufExpected.length !== bufReceived.length || !timingSafeEqual(bufExpected, bufReceived)) {
    throw new ApiError(400, 'Invalid webhook signature.', 'INVALID_WEBHOOK_SIGNATURE');
  }

  const event = JSON.parse(payloadStr) as {
    entity?: string;
    event?: string;
    contains?: string[];
    payload?: {
      payment?: { entity?: { id: string; order_id: string; amount: number; status: string } };
      order?: { entity?: { id: string; amount: number; status: string } };
    };
    created_at?: number;
  };

  const eventId = (event as Record<string, unknown>).id ? String((event as Record<string, unknown>).id) : `evt_${randomBytes(8).toString('hex')}`;
  const eventType = event.event || 'unknown';

  // Deduplication check
  const existingEvent = one(db, 'SELECT * FROM payment_events WHERE event_id=?', eventId);
  if (existingEvent) {
    return { status: 'duplicate', eventId };
  }

  const paymentData = event.payload?.payment?.entity;
  const orderId = paymentData?.order_id || event.payload?.order?.entity?.id;

  return transaction(db, () => {
    // Record event
    db.prepare(`
      INSERT INTO payment_events (id, event_id, event_type, provider, payload, signature_verified, status, processed_at, created_at)
      VALUES (?, ?, ?, 'razorpay', ?, 1, 'PROCESSED', ?, ?)
    `).run(randomUUID(), eventId, eventType, payloadStr, now(), now());

    // Process specific event types
    if (eventType === 'payment.captured' && orderId) {
      const sessionRow = one(db, 'SELECT id, user_id FROM checkout_sessions WHERE provider_order_id=?', orderId);
      if (sessionRow) {
        const sessionId = String(sessionRow.id);
        const session = getCheckoutSession(db, sessionId);
        if (session.status !== 'SUCCEEDED') {
          finalizeOrderFromSession(db, sessionId, {
            paymentMethod: 'razorpay',
            paymentStatus: 'paid',
            providerPaymentId: paymentData?.id,
          });
        }
      }
    } else if (eventType === 'payment.failed' && orderId) {
      db.prepare(`
        UPDATE payment_attempts
        SET status = 'failed', error_description = 'Payment failed event from provider', updated_at = ?
        WHERE provider_order_id = ?
      `).run(now(), orderId);
    }

    return { status: 'processed', eventId };
  });
}
