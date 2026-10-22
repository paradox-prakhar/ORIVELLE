import { randomUUID } from 'node:crypto';
import type { Db } from './database.js';
import { transaction } from './database.js';
import { one, many, now, getCart, getProduct, settings, couponIssue } from './repository.js';
import {
  ApiError,
  type Address,
  type CheckoutSession,
  type CheckoutSessionItemSnapshot,
  type CheckoutSessionStatus,
  type Order,
  type OrderItem,
} from './types.js';

const SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutes

const ALLOWED_TRANSITIONS: Record<CheckoutSessionStatus, CheckoutSessionStatus[]> = {
  CREATED: ['VALIDATING', 'PAYMENT_PENDING', 'CANCELLED', 'EXPIRED'],
  VALIDATING: ['PAYMENT_PENDING', 'FAILED', 'CANCELLED', 'EXPIRED'],
  PAYMENT_PENDING: ['PROCESSING', 'SUCCEEDED', 'FAILED', 'CANCELLED', 'EXPIRED'],
  PROCESSING: ['SUCCEEDED', 'FAILED', 'REQUIRES_RECONCILIATION'],
  SUCCEEDED: [],
  FAILED: ['PAYMENT_PENDING', 'CANCELLED'],
  EXPIRED: [],
  CANCELLED: [],
  REQUIRES_RECONCILIATION: ['SUCCEEDED', 'FAILED'],
};

/**
 * Periodically or on-demand releases stock from expired checkout sessions.
 */
export function cleanupExpiredSessions(db: Db): void {
  const currentTime = Date.now();
  const expiredSessions = many(
    db,
    "SELECT id FROM checkout_sessions WHERE expires_at <= ? AND status NOT IN ('SUCCEEDED', 'CANCELLED', 'EXPIRED')",
    currentTime
  );

  for (const session of expiredSessions) {
    const sessionId = String(session.id);
    transaction(db, () => {
      // Release active reservations
      const activeReservations = many(
        db,
        "SELECT id, variant_id, quantity FROM inventory_reservations WHERE checkout_session_id=? AND status='ACTIVE'",
        sessionId
      );
      for (const res of activeReservations) {
        db.prepare('UPDATE variants SET stock = stock + ? WHERE id=?').run(Number(res.quantity), String(res.variant_id));
        db.prepare("UPDATE inventory_reservations SET status='EXPIRED' WHERE id=?").run(String(res.id));
      }
      db.prepare("UPDATE checkout_sessions SET status='EXPIRED', updated_at=? WHERE id=?").run(now(), sessionId);
    });
  }
}

/**
 * Transition a checkout session to a new state with strict lifecycle validation.
 */
export function transitionCheckoutSession(
  db: Db,
  sessionId: string,
  newStatus: CheckoutSessionStatus,
  extraUpdates: { providerOrderId?: string; orderId?: string } = {}
): CheckoutSession {
  return transaction(db, () => {
    const row = one(db, 'SELECT * FROM checkout_sessions WHERE id=?', sessionId);
    if (!row) throw new ApiError(404, 'Checkout session not found.', 'NOT_FOUND');

    const currentStatus = row.status as CheckoutSessionStatus;
    if (currentStatus !== newStatus && !ALLOWED_TRANSITIONS[currentStatus]?.includes(newStatus)) {
      throw new ApiError(
        409,
        `Cannot transition checkout session from ${currentStatus} to ${newStatus}.`,
        'INVALID_SESSION_TRANSITION'
      );
    }

    const updates: string[] = ['status=?', 'updated_at=?'];
    const values: (string | number | null)[] = [newStatus, now()];

    if (extraUpdates.providerOrderId !== undefined) {
      updates.push('provider_order_id=?');
      values.push(extraUpdates.providerOrderId);
    }
    if (extraUpdates.orderId !== undefined) {
      updates.push('order_id=?');
      values.push(extraUpdates.orderId);
    }
    values.push(sessionId);

    db.prepare(`UPDATE checkout_sessions SET ${updates.join(', ')} WHERE id=?`).run(...values);
    return getCheckoutSession(db, sessionId);
  });
}

/**
 * Retrieves a checkout session by ID, optionally verifying ownership.
 */
export function getCheckoutSession(db: Db, sessionId: string, userId?: string): CheckoutSession {
  cleanupExpiredSessions(db);
  const row = one(
    db,
    `SELECT * FROM checkout_sessions WHERE id=? ${userId ? 'AND user_id=?' : ''}`,
    ...[sessionId, ...(userId ? [userId] : [])]
  );
  if (!row) throw new ApiError(404, 'Checkout session not found.', 'NOT_FOUND');

  return {
    id: String(row.id),
    userId: String(row.user_id),
    idempotencyKey: String(row.idempotency_key),
    status: row.status as CheckoutSessionStatus,
    subtotal: Number(row.subtotal),
    discount: Number(row.discount),
    shipping: Number(row.shipping),
    tax: Number(row.tax),
    total: Number(row.total),
    currency: 'INR',
    itemsSnapshot: JSON.parse(String(row.items_snapshot)) as CheckoutSessionItemSnapshot[],
    shippingAddress: JSON.parse(String(row.shipping_address)) as Address,
    couponId: row.coupon_id ? String(row.coupon_id) : null,
    couponCode: row.coupon_code ? String(row.coupon_code) : null,
    paymentProvider: row.payment_provider as 'razorpay' | 'cod',
    providerOrderId: row.provider_order_id ? String(row.provider_order_id) : null,
    orderId: row.order_id ? String(row.order_id) : null,
    expiresAt: Number(row.expires_at),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

/**
 * Creates a server-authoritative checkout session from the customer's cart.
 * Revalidates stock, reserves inventory, recalculates discounts, taxes, and shipping in paise.
 */
export function createCheckoutSession(
  db: Db,
  userId: string,
  address: Address,
  idempotencyKey: string,
  paymentProvider: 'razorpay' | 'cod' = 'razorpay'
): CheckoutSession {
  cleanupExpiredSessions(db);

  return transaction(db, () => {
    // Check if a session already exists for this idempotency key
    const existing = one(db, 'SELECT id FROM checkout_sessions WHERE idempotency_key=?', idempotencyKey);
    if (existing) {
      const session = getCheckoutSession(db, String(existing.id));
      if (session.userId !== userId) {
        throw new ApiError(403, 'Unauthorized access to checkout session.', 'FORBIDDEN');
      }
      return session;
    }

    const owner = `user:${userId}`;
    const cart = getCart(db, owner);
    if (!cart.items.length) {
      throw new ApiError(400, 'Your shopping bag is empty. Please add pieces before checkout.', 'EMPTY_CART');
    }
    if (cart.warnings.length) {
      throw new ApiError(409, cart.warnings[0], 'CART_CHANGED');
    }

    const store = settings(db);
    if (paymentProvider === 'cod' && !store.codEnabled) {
      throw new ApiError(409, 'Cash on delivery is currently unavailable.', 'PAYMENT_UNAVAILABLE');
    }

    const sessionId = randomUUID();
    const currentTime = Date.now();
    const expiresAt = currentTime + SESSION_TTL_MS;
    const timestamp = now();

    // Snapshot validated items
    const itemsSnapshot: CheckoutSessionItemSnapshot[] = cart.items.map(item => ({
      productId: item.product.id,
      variantId: item.variant.id,
      sku: item.variant.sku,
      name: item.product.name,
      slug: item.product.slug,
      image: item.product.image,
      size: item.variant.size,
      color: item.variant.color,
      quantity: item.quantity,
      price: item.product.price,
      lineTotal: item.lineTotal,
    }));

    // Insert checkout session record first
    db.prepare(`
      INSERT INTO checkout_sessions (
        id, user_id, idempotency_key, status, subtotal, discount, shipping, tax, total,
        currency, items_snapshot, shipping_address, coupon_id, coupon_code,
        payment_provider, expires_at, created_at, updated_at
      ) VALUES (?, ?, ?, 'CREATED', ?, ?, ?, ?, ?, 'INR', ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      sessionId,
      userId,
      idempotencyKey,
      cart.subtotal,
      cart.discount,
      cart.shipping,
      cart.tax,
      cart.total,
      JSON.stringify(itemsSnapshot),
      JSON.stringify(address),
      cart.coupon?.id || null,
      cart.coupon?.code || null,
      paymentProvider,
      expiresAt,
      timestamp,
      timestamp
    );

    // Reserve stock atomically and insert reservation records
    for (const item of cart.items) {
      const stockUpdate = db.prepare('UPDATE variants SET stock = stock - ? WHERE id = ? AND stock >= ?')
        .run(item.quantity, item.variant.id, item.quantity);
      if (Number(stockUpdate.changes) !== 1) {
        throw new ApiError(409, `${item.product.name} just sold out in this size.`, 'INSUFFICIENT_STOCK');
      }

      db.prepare(`
        INSERT INTO inventory_reservations (id, checkout_session_id, variant_id, quantity, status, expires_at, created_at)
        VALUES (?, ?, ?, ?, 'ACTIVE', ?, ?)
      `).run(randomUUID(), sessionId, item.variant.id, item.quantity, expiresAt, timestamp);
    }

    return getCheckoutSession(db, sessionId, userId);
  });
}

/**
 * Cancels a checkout session and releases reserved inventory.
 */
export function cancelCheckoutSession(db: Db, sessionId: string, userId: string): CheckoutSession {
  return transaction(db, () => {
    const session = getCheckoutSession(db, sessionId, userId);
    if (session.status === 'SUCCEEDED') {
      throw new ApiError(409, 'Cannot cancel an order that has already been confirmed and paid.', 'CANNOT_CANCEL');
    }
    if (session.status === 'CANCELLED') return session;

    // Release reserved inventory
    const reservations = many(
      db,
      "SELECT id, variant_id, quantity FROM inventory_reservations WHERE checkout_session_id=? AND status='ACTIVE'",
      sessionId
    );
    for (const res of reservations) {
      db.prepare('UPDATE variants SET stock = stock + ? WHERE id=?').run(Number(res.quantity), String(res.variant_id));
      db.prepare("UPDATE inventory_reservations SET status='RELEASED' WHERE id=?").run(String(res.id));
    }

    return transitionCheckoutSession(db, sessionId, 'CANCELLED');
  });
}

/**
 * Finalizes a checkout session into a permanent Order once payment is verified or confirmed.
 */
export function finalizeOrderFromSession(
  db: Db,
  sessionId: string,
  paymentDetails: {
    paymentMethod: 'razorpay' | 'cod';
    paymentStatus: 'paid' | 'pending';
    providerPaymentId?: string;
  }
): Order {
  return transaction(db, () => {
    const session = getCheckoutSession(db, sessionId);

    // If order already created, return it
    if (session.orderId) {
      const existingOrder = one(db, 'SELECT id FROM orders WHERE id=?', session.orderId);
      if (existingOrder) {
        return getOrderById(db, session.orderId);
      }
    }

    const orderId = randomUUID();
    const timestamp = now();
    const reference = `OR-${Date.now().toString(36).toUpperCase()}-${orderId.slice(0, 5).toUpperCase()}`;

    // Insert order
    db.prepare(`
      INSERT INTO orders (
        id, reference, user_id, idempotency_key, address, subtotal, discount, shipping, tax, total,
        coupon, coupon_id, checkout_session_id, status, payment_method, payment_status, payment_provider,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'confirmed', ?, ?, ?, ?, ?)
    `).run(
      orderId,
      reference,
      session.userId,
      session.idempotencyKey,
      JSON.stringify(session.shippingAddress),
      session.subtotal,
      session.discount,
      session.shipping,
      session.tax,
      session.total,
      session.couponCode,
      session.couponId,
      session.id,
      paymentDetails.paymentMethod,
      paymentDetails.paymentStatus,
      paymentDetails.paymentMethod,
      timestamp,
      timestamp
    );

    // Insert order items
    for (const item of session.itemsSnapshot) {
      db.prepare(`
        INSERT INTO order_items (
          id, order_id, product_id, variant_id, name, slug, image, size, color, sku, quantity, price
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        randomUUID(),
        orderId,
        item.productId,
        item.variantId,
        item.name,
        item.slug,
        item.image,
        item.size,
        item.color,
        item.sku,
        item.quantity,
        item.price
      );
    }

    // Finalize inventory reservations
    db.prepare(`
      UPDATE inventory_reservations
      SET status = 'FINALIZED'
      WHERE checkout_session_id = ? AND status = 'ACTIVE'
    `).run(sessionId);

    // Update coupon uses
    if (session.couponId) {
      db.prepare('UPDATE coupons SET uses = uses + 1 WHERE id = ?').run(session.couponId);
    }

    // Clear cart items and coupon for the user
    const owner = `user:${session.userId}`;
    db.prepare('DELETE FROM cart_items WHERE owner=?').run(owner);
    db.prepare('DELETE FROM cart_coupons WHERE owner=?').run(owner);

    // Log order creation event
    db.prepare(`
      INSERT INTO order_events (id, order_id, actor_id, event, details, created_at)
      VALUES (?, ?, ?, 'order.created', ?, ?)
    `).run(
      randomUUID(),
      orderId,
      session.userId,
      JSON.stringify({
        paymentMethod: paymentDetails.paymentMethod,
        paymentStatus: paymentDetails.paymentStatus,
        providerPaymentId: paymentDetails.providerPaymentId || null,
        sessionId,
      }),
      timestamp
    );

    // Transition session to SUCCEEDED and link order
    transitionCheckoutSession(db, sessionId, 'SUCCEEDED', { orderId });

    return getOrderById(db, orderId);
  });
}

/**
 * Fetch Order details with items and user information.
 */
export function getOrderById(db: Db, orderId: string, userId?: string): Order {
  const row = one(
    db,
    `SELECT o.*, u.name AS user_name, u.email AS user_email
     FROM orders o
     JOIN users u ON u.id = o.user_id
     WHERE o.id = ? ${userId ? 'AND o.user_id = ?' : ''}`,
    ...[orderId, ...(userId ? [userId] : [])]
  );
  if (!row) throw new ApiError(404, 'Order not found.', 'NOT_FOUND');

  const items: OrderItem[] = many(db, 'SELECT * FROM order_items WHERE order_id=? ORDER BY rowid', orderId).map(
    item => ({
      id: String(item.id),
      productId: String(item.product_id),
      variantId: String(item.variant_id),
      name: String(item.name),
      slug: String(item.slug),
      image: String(item.image),
      size: String(item.size),
      color: String(item.color),
      sku: String(item.sku),
      quantity: Number(item.quantity),
      price: Number(item.price),
      lineTotal: Number(item.quantity) * Number(item.price),
    })
  );

  return {
    id: orderId,
    reference: String(row.reference),
    user: { id: String(row.user_id), name: String(row.user_name), email: String(row.user_email) },
    address: JSON.parse(String(row.address)) as Address,
    items,
    subtotal: Number(row.subtotal),
    discount: Number(row.discount),
    shipping: Number(row.shipping),
    tax: Number(row.tax),
    total: Number(row.total),
    coupon: row.coupon === null ? null : String(row.coupon),
    couponId: row.coupon_id ? String(row.coupon_id) : null,
    status: row.status as Order['status'],
    paymentMethod: row.payment_method as Order['paymentMethod'],
    paymentStatus: row.payment_status as Order['paymentStatus'],
    checkoutSessionId: row.checkout_session_id ? String(row.checkout_session_id) : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    trackingNumber: row.tracking_number === null ? null : String(row.tracking_number),
    trackingUrl: row.tracking_url === null ? null : String(row.tracking_url),
  };
}
