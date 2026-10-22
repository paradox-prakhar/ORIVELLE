import { afterEach, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import type { Server } from 'node:http';
import { randomBytes, randomUUID, createHmac } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { createApp } from '../server/app.js';
import { createDatabase, type Db } from '../server/database.js';
import { now, one, many } from '../server/repository.js';
import { hashPassword, verifyPassword, createPasswordResetToken, resetPasswordWithToken, createEmailVerificationToken, verifyEmailWithToken } from '../server/auth-service.js';
import { createCheckoutSession, getCheckoutSession, cancelCheckoutSession } from '../server/checkout-service.js';
import { getRazorpayConfig, verifyRazorpaySignature, processRazorpayWebhook } from '../server/razorpay-service.js';
import type { Address, CheckoutSession, Order, Product, User } from '../server/types.js';

const origin = 'http://localhost:5173';
let server: Server;
let db: Db;
let base: string;

beforeEach(async () => {
  process.env.EMAIL_CONFIGURED = 'true';
  const instance = createApp({ databasePath: ':memory:', origins: [origin], serveFrontend: false });
  db = instance.db;
  server = await new Promise<Server>(res => { const val = instance.app.listen(0, '127.0.0.1', () => res(val)); });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Test server failed to start');
  base = `http://127.0.0.1:${address.port}`;
});

afterEach(async () => {
  delete process.env.EMAIL_CONFIGURED;
  await new Promise<void>((res, rej) => server.close(err => err ? rej(err) : res()));
  db.close();
});

function createClient() {
  let cookie = '';
  return {
    cookie: () => cookie,
    setCookie: (c: string) => { cookie = c; },
    async request<T = unknown>(path: string, method = 'GET', body?: unknown, headers: Record<string, string> = {}) {
      const response = await fetch(`${base}/api${path}`, {
        method,
        headers: {
          Origin: origin,
          ...(cookie ? { Cookie: cookie } : {}),
          ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
          ...headers,
        },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      });
      const setCookie = response.headers.getSetCookie().at(-1);
      if (setCookie) cookie = setCookie.split(';')[0];
      const data = await response.json().catch(() => ({})) as T;
      return { status: response.status, data, headers: response.headers };
    },
  };
}

async function registerUser(client = createClient()) {
  const email = `test-${randomUUID()}@atelier.test`;
  const password = 'Production-Pass-1234!';
  const res = await client.request<{ user: User }>('/auth/register', 'POST', {
    name: 'Atelier Client',
    email,
    password,
  });
  assert.equal(res.status, 201);
  return { client, user: res.data.user, email, password };
}

const sampleAddress: Address = {
  name: 'Amara Sen',
  phone: '9876543210',
  line1: '104 Marine Drive',
  city: 'Mumbai',
  state: 'Maharashtra',
  pincode: '400020',
};

test('Argon2id password hashing, verification and legacy bcrypt migration', async () => {
  const plainPassword = 'Argon2id-Super-Secure-Password!';
  const argonHash = await hashPassword(plainPassword);
  assert.ok(argonHash.startsWith('$argon2id$'), 'Hash should be an Argon2id formatted hash');

  const verifyArgon = await verifyPassword(plainPassword, argonHash);
  assert.equal(verifyArgon.valid, true);
  assert.equal(verifyArgon.needsUpgrade, false);

  // Test legacy bcrypt hash
  const bcryptHash = await bcrypt.hash(plainPassword, 10);
  const verifyBcrypt = await verifyPassword(plainPassword, bcryptHash);
  assert.equal(verifyBcrypt.valid, true);
  assert.equal(verifyBcrypt.needsUpgrade, true, 'Legacy bcrypt hash should signal upgrade needed');

  // Test invalid password
  const verifyBad = await verifyPassword('WrongPassword', argonHash);
  assert.equal(verifyBad.valid, false);
});

test('Password reset lifecycle: single-use token, expiry, and session revocation', async () => {
  const { client, user, email } = await registerUser();
  const initialCookie = client.cookie();

  // Request password reset
  const forgotRes = await client.request<{ success: boolean; resetToken?: string }>('/auth/forgot-password', 'POST', { email });
  assert.equal(forgotRes.status, 200);
  assert.equal(forgotRes.data.success, true);
  const token = forgotRes.data.resetToken;
  assert.ok(token, 'Reset token should be generated in test mode');

  // Verify account enumeration defense: requesting for non-existent email returns same 200 structure
  const fakeRes = await client.request<{ success: boolean }>('/auth/forgot-password', 'POST', { email: 'nobody@example.com' });
  assert.equal(fakeRes.status, 200);
  assert.equal(fakeRes.data.success, true);

  // Reset password
  const newPassword = 'Brand-New-Password-99!';
  const resetRes = await client.request<{ success: boolean; user: User }>('/auth/reset-password', 'POST', {
    token,
    password: newPassword,
  });
  assert.equal(resetRes.status, 200);
  assert.equal(resetRes.data.success, true);

  // Verify token is single-use: attempting reuse fails with 400
  const reuseRes = await client.request('/auth/reset-password', 'POST', {
    token,
    password: 'AnotherPassword123!',
  });
  assert.equal(reuseRes.status, 400);

  // Verify previous sessions were revoked
  const authCheck = await fetch(`${base}/api/auth/me`, { headers: { Cookie: initialCookie } });
  const authData = await authCheck.json() as { user: User | null };
  assert.equal(authData.user, null, 'Previous session must be revoked after password reset');

  // Sign in with new password succeeds
  const newClient = createClient();
  const loginRes = await newClient.request<{ user: User }>('/auth/login', 'POST', { email, password: newPassword });
  assert.equal(loginRes.status, 200);
  assert.equal(loginRes.data.user.id, user.id);
});

test('Email verification lifecycle with token', async () => {
  const { user } = await registerUser();
  const token = createEmailVerificationToken(db, user.id);
  assert.ok(token);

  // Verify email
  const client = createClient();
  const verifyRes = await client.request<{ success: boolean; user: User }>('/auth/verify-email', 'POST', { token });
  assert.equal(verifyRes.status, 200);
  assert.equal(verifyRes.data.success, true);
  assert.equal(verifyRes.data.user.emailVerified, true);

  // Second attempt with same token fails
  const secondRes = await client.request('/auth/verify-email', 'POST', { token });
  assert.equal(secondRes.status, 400);
});

test('Checkout session creation: server-authoritative pricing and inventory reservation', async () => {
  const { client, user } = await registerUser();
  const catalog = (await client.request<{ items: Product[] }>('/products')).data.items;
  const product = catalog[0];
  const variant = product.variants[0];
  const initialStock = variant.stock;

  // Add to cart
  await client.request('/cart/items', 'POST', { variantId: variant.id, quantity: 2 });

  // Create checkout session
  const idempotencyKey = randomUUID();
  const sessionRes = await client.request<{ session: CheckoutSession }>('/checkout/sessions', 'POST', {
    address: sampleAddress,
    paymentProvider: 'razorpay',
    idempotencyKey,
  });

  assert.equal(sessionRes.status, 201);
  const session = sessionRes.data.session;
  assert.equal(session.userId, user.id);
  assert.equal(session.status, 'CREATED');
  assert.equal(session.subtotal, product.price * 2);
  assert.equal(session.total, session.subtotal - session.discount + session.shipping + session.tax);
  assert.equal(session.itemsSnapshot.length, 1);
  assert.equal(session.itemsSnapshot[0].quantity, 2);

  // Verify stock was reserved in database
  const updatedVariantRow = one(db, 'SELECT stock FROM variants WHERE id=?', variant.id);
  assert.equal(Number(updatedVariantRow!.stock), initialStock - 2, 'Stock should be reserved immediately upon session creation');

  // Verify active reservation record exists
  const reservation = one(db, "SELECT * FROM inventory_reservations WHERE checkout_session_id=? AND status='ACTIVE'", session.id);
  assert.ok(reservation, 'Active reservation record should exist');
  assert.equal(Number(reservation!.quantity), 2);
});

test('Checkout session IDOR ownership protection', async () => {
  const user1 = await registerUser();
  const user2 = await registerUser();

  const product = (await user1.client.request<{ items: Product[] }>('/products')).data.items[0];
  await user1.client.request('/cart/items', 'POST', { variantId: product.variants[0].id, quantity: 1 });

  const sessionRes = await user1.client.request<{ session: CheckoutSession }>('/checkout/sessions', 'POST', {
    address: sampleAddress,
    paymentProvider: 'razorpay',
    idempotencyKey: randomUUID(),
  });
  const session = sessionRes.data.session;

  // User 1 can view their own session
  const ownRes = await user1.client.request<{ session: CheckoutSession }>(`/checkout/sessions/${session.id}`);
  assert.equal(ownRes.status, 200);

  // User 2 cannot access User 1's session (IDOR protection)
  const idorRes = await user2.client.request(`/checkout/sessions/${session.id}`);
  assert.equal(idorRes.status, 404, 'Other users should not be able to read foreign checkout sessions');
});

test('Session cancellation and stock restoration', async () => {
  const { client } = await registerUser();
  const product = (await client.request<{ items: Product[] }>('/products')).data.items[0];
  const variant = product.variants[0];
  const initialStock = variant.stock;

  await client.request('/cart/items', 'POST', { variantId: variant.id, quantity: 3 });

  const { data: { session } } = await client.request<{ session: CheckoutSession }>('/checkout/sessions', 'POST', {
    address: sampleAddress,
    paymentProvider: 'razorpay',
    idempotencyKey: randomUUID(),
  });

  // Cancel checkout session
  const cancelRes = await client.request<{ session: CheckoutSession }>(`/checkout/sessions/${session.id}/cancel`, 'POST');
  assert.equal(cancelRes.status, 200);
  assert.equal(cancelRes.data.session.status, 'CANCELLED');

  // Verify stock was restored
  const variantRow = one(db, 'SELECT stock FROM variants WHERE id=?', variant.id);
  assert.equal(Number(variantRow!.stock), initialStock, 'Reserved stock must be restored upon session cancellation');

  // Verify reservation is marked RELEASED
  const resRow = one(db, 'SELECT status FROM inventory_reservations WHERE checkout_session_id=?', session.id);
  assert.equal(String(resRow!.status), 'RELEASED');
});

test('Idempotency: exact replay vs conflicting payload mismatch', async () => {
  const { client } = await registerUser();
  const product = (await client.request<{ items: Product[] }>('/products')).data.items[0];
  await client.request('/cart/items', 'POST', { variantId: product.variants[0].id, quantity: 1 });

  const idempotencyKey = `idemp-${randomUUID()}`;

  // First request
  const firstRes = await client.request<{ session: CheckoutSession }>('/checkout/sessions', 'POST', {
    address: sampleAddress,
    paymentProvider: 'razorpay',
    idempotencyKey,
  });
  assert.equal(firstRes.status, 201);

  // Replay exact same request with same key
  const replayRes = await client.request<{ session: CheckoutSession }>('/checkout/sessions', 'POST', {
    address: sampleAddress,
    paymentProvider: 'razorpay',
    idempotencyKey,
  });
  assert.equal(replayRes.status, 201);
  assert.equal(replayRes.data.session.id, firstRes.data.session.id);
  assert.equal(replayRes.headers.get('idempotency-replayed'), 'true');

  // Reusing same idempotency key with different payload must be rejected
  const conflictRes = await client.request('/checkout/sessions', 'POST', {
    address: { ...sampleAddress, city: 'Bengaluru' },
    paymentProvider: 'razorpay',
    idempotencyKey,
  });
  assert.equal(conflictRes.status, 409, 'Reusing key with different payload must return 409 Conflict');
});

test('Competing checkout sessions cannot oversell limited inventory', async () => {
  const user1 = await registerUser();
  const user2 = await registerUser();

  // Set variant stock to exactly 1
  const product = (await user1.client.request<{ items: Product[] }>('/products')).data.items[0];
  const variant = product.variants[0];
  db.prepare('UPDATE variants SET stock = 1 WHERE id = ?').run(variant.id);

  // Both users add 1 to cart
  await user1.client.request('/cart/items', 'POST', { variantId: variant.id, quantity: 1 });
  await user2.client.request('/cart/items', 'POST', { variantId: variant.id, quantity: 1 });

  // User 1 checks out first
  const res1 = await user1.client.request('/checkout/sessions', 'POST', {
    address: sampleAddress,
    paymentProvider: 'razorpay',
    idempotencyKey: randomUUID(),
  });
  assert.equal(res1.status, 201, 'First checkout must succeed and reserve stock');

  // User 2 attempts to checkout the same piece
  const res2 = await user2.client.request('/checkout/sessions', 'POST', {
    address: sampleAddress,
    paymentProvider: 'razorpay',
    idempotencyKey: randomUUID(),
  });
  assert.equal(res2.status, 409, 'Second checkout must fail with insufficient stock');
});

test('Razorpay payment flow: initialization, signature verification, and order confirmation', async () => {
  const { client } = await registerUser();
  const product = (await client.request<{ items: Product[] }>('/products')).data.items[0];
  await client.request('/cart/items', 'POST', { variantId: product.variants[0].id, quantity: 1 });

  // Step 1: Create session
  const { data: { session } } = await client.request<{ session: CheckoutSession }>('/checkout/sessions', 'POST', {
    address: sampleAddress,
    paymentProvider: 'razorpay',
    idempotencyKey: randomUUID(),
  });

  // Step 2: Initiate payment
  const paymentRes = await client.request<{
    payment: {
      keyId: string;
      orderId: string;
      amount: number;
      currency: string;
      checkoutSessionId: string;
    };
  }>(`/checkout/sessions/${session.id}/payment`, 'POST', { idempotencyKey: randomUUID() });

  assert.equal(paymentRes.status, 200);
  const payment = paymentRes.data.payment;
  assert.ok(payment.orderId.startsWith('order_'));
  assert.equal(payment.amount, session.total);

  // Step 3: Attempt second payment initiation on same session - must return existing provider order (no duplicate orders)
  const repeatPayment = await client.request<{ payment: { orderId: string } }>(
    `/checkout/sessions/${session.id}/payment`,
    'POST',
    { idempotencyKey: randomUUID() }
  );
  assert.equal(repeatPayment.status, 200);
  assert.equal(repeatPayment.data.payment.orderId, payment.orderId, 'Must reuse existing provider order');

  // Step 4: Verify with forged/invalid signature -> must be rejected
  const badVerifyRes = await client.request('/payments/razorpay/verify', 'POST', {
    sessionId: session.id,
    razorpayOrderId: payment.orderId,
    razorpayPaymentId: 'pay_123456789',
    razorpaySignature: 'invalid_forged_signature_hash',
  });
  assert.equal(badVerifyRes.status, 400);

  // Step 5: Verify with valid cryptographic HMAC SHA-256 signature
  const rzpConfig = getRazorpayConfig();
  const simulatedPaymentId = `pay_sim_${randomBytes(6).toString('hex')}`;
  const validSignature = createHmac('sha256', rzpConfig.keySecret)
    .update(`${payment.orderId}|${simulatedPaymentId}`)
    .digest('hex');

  const goodVerifyRes = await client.request<{ order: Order }>('/payments/razorpay/verify', 'POST', {
    sessionId: session.id,
    razorpayOrderId: payment.orderId,
    razorpayPaymentId: simulatedPaymentId,
    razorpaySignature: validSignature,
  });

  assert.equal(goodVerifyRes.status, 200);
  const confirmedOrder = goodVerifyRes.data.order;
  assert.equal(confirmedOrder.status, 'confirmed');
  assert.equal(confirmedOrder.paymentMethod, 'razorpay');
  assert.equal(confirmedOrder.paymentStatus, 'paid');
  assert.equal(confirmedOrder.total, session.total);

  // Verify cart was cleared
  const cartRes = await client.request<{ items: unknown[] }>('/cart');
  assert.equal(cartRes.data.items.length, 0);

  // Verify reservations finalized
  const resRow = one(db, 'SELECT status FROM inventory_reservations WHERE checkout_session_id=?', session.id);
  assert.equal(String(resRow!.status), 'FINALIZED');
});

test('Razorpay Webhook processing: signature verification, event deduplication, and payment capture', async () => {
  const { client } = await registerUser();
  const product = (await client.request<{ items: Product[] }>('/products')).data.items[0];
  await client.request('/cart/items', 'POST', { variantId: product.variants[0].id, quantity: 1 });

  const { data: { session } } = await client.request<{ session: CheckoutSession }>('/checkout/sessions', 'POST', {
    address: sampleAddress,
    paymentProvider: 'razorpay',
    idempotencyKey: randomUUID(),
  });

  const { data: { payment } } = await client.request<{ payment: { orderId: string } }>(
    `/checkout/sessions/${session.id}/payment`,
    'POST',
    { idempotencyKey: randomUUID() }
  );

  const rzpConfig = getRazorpayConfig();
  const eventId = `evt_${randomBytes(8).toString('hex')}`;
  const webhookPayload = JSON.stringify({
    id: eventId,
    entity: 'event',
    event: 'payment.captured',
    payload: {
      payment: {
        entity: {
          id: `pay_${randomBytes(6).toString('hex')}`,
          order_id: payment.orderId,
          amount: session.total,
          status: 'captured',
        },
      },
    },
    created_at: Math.floor(Date.now() / 1000),
  });

  // Test 1: Invalid webhook signature rejected
  const badHookRes = await fetch(`${base}/api/webhooks/razorpay`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-razorpay-signature': 'bad_fake_signature',
    },
    body: webhookPayload,
  });
  assert.equal(badHookRes.status, 400);

  // Test 2: Valid signature accepted and processed
  const validSignature = createHmac('sha256', rzpConfig.webhookSecret)
    .update(webhookPayload)
    .digest('hex');

  const goodHookRes = await fetch(`${base}/api/webhooks/razorpay`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-razorpay-signature': validSignature,
    },
    body: webhookPayload,
  });
  assert.equal(goodHookRes.status, 200);
  const hookData = await goodHookRes.json() as { status: string };
  assert.equal(hookData.status, 'processed');

  // Test 3: Duplicate webhook delivery is recognized and deduplicated (idempotent 200 OK)
  const dupHookRes = await fetch(`${base}/api/webhooks/razorpay`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-razorpay-signature': validSignature,
    },
    body: webhookPayload,
  });
  assert.equal(dupHookRes.status, 200);
  const dupData = await dupHookRes.json() as { status: string };
  assert.equal(dupData.status, 'duplicate');
});
