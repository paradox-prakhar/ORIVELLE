import { randomUUID } from 'node:crypto';
import type { SQLInputValue } from 'node:sqlite';
import type { Db } from './database.js';
import { transaction } from './database.js';
import { ApiError, type Address, type Cart, type Coupon, type Order, type OrderItem, type OrderStatus, type Product, type Settings, type User, type Variant } from './types.js';

export type Row = Record<string, string | number | null>;
export const one = (db: Db, sql: string, ...values: SQLInputValue[]) => db.prepare(sql).get(...values) as Row | undefined;
export const many = (db: Db, sql: string, ...values: SQLInputValue[]) => db.prepare(sql).all(...values) as Row[];
export const now = () => new Date().toISOString();
export function settings(db: Db): Settings { return JSON.parse(String(one(db, 'SELECT data FROM settings WHERE id=1')!.data)) as Settings; }
export function safeUser(row: Row): User { return { id: String(row.id), name: String(row.name), email: String(row.email), role: row.role as User['role'], emailVerified: Boolean(row.email_verified), createdAt: String(row.created_at) }; }
export function variant(row: Row): Variant { return { id: String(row.id), sku: String(row.sku), size: String(row.size), color: String(row.color), stock: Number(row.stock) }; }
export function product(db: Db, row: Row): Product {
  const images = JSON.parse(String(row.images)) as string[];
  return { id: String(row.id), slug: String(row.slug), name: String(row.name), description: String(row.description), category: String(row.category), price: Number(row.price), compareAtPrice: row.compare_at === null ? null : Number(row.compare_at), compareAt: row.compare_at === null ? null : Number(row.compare_at), image: images[0] || '', images, color: String(row.color), material: String(row.material), care: String(row.care), featured: Boolean(row.featured), active: Boolean(row.active), demo: Boolean(row.demo), createdAt: String(row.created_at), variants: many(db, 'SELECT * FROM variants WHERE product_id=? ORDER BY rowid', String(row.id)).map(variant) };
}
export function getProduct(db: Db, idOrSlug: string, includeInactive = false): Product {
  const row = one(db, `SELECT * FROM products WHERE (id=? OR slug=?) ${includeInactive ? '' : 'AND active=1'}`, idOrSlug, idOrSlug);
  if (!row) throw new ApiError(404, 'This piece is no longer available.', 'NOT_FOUND');
  return product(db, row);
}
export function coupon(row: Row): Coupon { return { id: String(row.id), code: String(row.code), percent: Number(row.percent), minSubtotal: Number(row.min_subtotal), active: Boolean(row.active), uses: Number(row.uses), usageLimit: row.usage_limit === null ? null : Number(row.usage_limit), expiresAt: row.expires_at === null ? null : String(row.expires_at) }; }
export function couponIssue(value: Coupon, subtotal: number) {
  if (!value.active || (value.expiresAt && value.expiresAt < now()) || (value.usageLimit !== null && value.uses >= value.usageLimit)) return 'This discount is no longer available.';
  if (subtotal < value.minSubtotal) return `This discount requires a subtotal of ₹${(value.minSubtotal / 100).toLocaleString('en-IN')}.`;
  return null;
}
export function getCart(db: Db, owner: string): Cart {
  const warnings: string[] = [];
  const items = many(db, 'SELECT c.*,v.product_id FROM cart_items c JOIN variants v ON v.id=c.variant_id WHERE c.owner=? ORDER BY c.rowid', owner).map(row => {
    const itemProduct = getProduct(db, String(row.product_id), true);
    const itemVariant = itemProduct.variants.find(item => item.id === row.variant_id)!;
    if (!itemProduct.active || itemVariant.stock < Number(row.quantity)) warnings.push(`${itemProduct.name} is unavailable in the selected quantity. Please update your bag.`);
    return { id: String(row.id), variantId: String(row.variant_id), quantity: Number(row.quantity), product: itemProduct, variant: itemVariant, lineTotal: itemProduct.price * Number(row.quantity) };
  });
  const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0);
  const couponRow = one(db, 'SELECT c.* FROM coupons c JOIN cart_coupons cc ON cc.coupon_id=c.id WHERE cc.owner=?', owner);
  let appliedCoupon = couponRow ? coupon(couponRow) : null;
  if (appliedCoupon) { const issue = couponIssue(appliedCoupon, subtotal); if (issue) { warnings.push(issue); appliedCoupon = null; } }
  const discount = appliedCoupon ? Math.floor(subtotal * appliedCoupon.percent / 100) : 0;
  const store = settings(db);
  const shipping = !items.length || subtotal - discount >= store.freeShippingAbove ? 0 : store.shippingFlat;
  const tax = Math.round((subtotal - discount) * store.taxRate / 100);
  return { items, subtotal, discount, shipping, tax, total: subtotal - discount + shipping + tax, coupon: appliedCoupon, warnings };
}
export function addCartItem(db: Db, owner: string, variantId: string, quantity: number, replace = false) {
  const row = one(db, 'SELECT v.*,p.active FROM variants v JOIN products p ON p.id=v.product_id WHERE v.id=?', variantId);
  if (!row || !row.active) throw new ApiError(404, 'This piece is no longer available.', 'NOT_FOUND');
  const existing = one(db, 'SELECT * FROM cart_items WHERE owner=? AND variant_id=?', owner, variantId);
  const wanted = quantity + (replace ? 0 : Number(existing?.quantity || 0));
  if (wanted > 20) throw new ApiError(400, 'You can add up to 20 of each size.', 'QUANTITY_LIMIT');
  if (Number(row.stock) < wanted) throw new ApiError(409, `Only ${row.stock} available in this size.`, 'INSUFFICIENT_STOCK');
  db.prepare('INSERT INTO cart_items(id,owner,variant_id,quantity) VALUES (?,?,?,?) ON CONFLICT(owner,variant_id) DO UPDATE SET quantity=excluded.quantity').run(randomUUID(), owner, variantId, wanted);
  return getCart(db, owner);
}
export function mergeGuestData(db: Db, guestOwner: string, userId: string) {
  const owner = `user:${userId}`;
  transaction(db, () => {
    for (const item of many(db, 'SELECT c.*,v.stock FROM cart_items c JOIN variants v ON v.id=c.variant_id WHERE owner=?', guestOwner)) {
      const existing = one(db, 'SELECT quantity FROM cart_items WHERE owner=? AND variant_id=?', owner, String(item.variant_id));
      const count = Math.min(20, Number(item.stock), Number(item.quantity) + Number(existing?.quantity || 0));
      if (count > 0) db.prepare('INSERT INTO cart_items VALUES (?,?,?,?) ON CONFLICT(owner,variant_id) DO UPDATE SET quantity=excluded.quantity').run(randomUUID(), owner, String(item.variant_id), count);
    }
    db.prepare('INSERT OR IGNORE INTO wishlist(owner,product_id) SELECT ?,product_id FROM wishlist WHERE owner=?').run(owner, guestOwner);
    db.prepare('INSERT OR IGNORE INTO cart_coupons(owner,coupon_id) SELECT ?,coupon_id FROM cart_coupons WHERE owner=?').run(owner, guestOwner);
    db.prepare('DELETE FROM cart_items WHERE owner=?').run(guestOwner);
    db.prepare('DELETE FROM wishlist WHERE owner=?').run(guestOwner);
    db.prepare('DELETE FROM cart_coupons WHERE owner=?').run(guestOwner);
  });
}
export function getOrder(db: Db, id: string, userId?: string): Order {
  const row = one(db, `SELECT o.*,u.name AS user_name,u.email AS user_email FROM orders o JOIN users u ON u.id=o.user_id WHERE o.id=? ${userId ? 'AND o.user_id=?' : ''}`, ...[id, ...(userId ? [userId] : [])]);
  if (!row) throw new ApiError(404, 'Order not found.', 'NOT_FOUND');
  const items: OrderItem[] = many(db, 'SELECT * FROM order_items WHERE order_id=? ORDER BY rowid', id).map(item => ({ id: String(item.id), productId: String(item.product_id), variantId: String(item.variant_id), name: String(item.name), slug: String(item.slug), image: String(item.image), size: String(item.size), color: String(item.color), sku: String(item.sku), quantity: Number(item.quantity), price: Number(item.price), lineTotal: Number(item.quantity) * Number(item.price) }));
  return { id, reference: String(row.reference), user: { id: String(row.user_id), name: String(row.user_name), email: String(row.user_email) }, address: JSON.parse(String(row.address)) as Address, items, subtotal: Number(row.subtotal), discount: Number(row.discount), shipping: Number(row.shipping), tax: Number(row.tax), total: Number(row.total), coupon: row.coupon === null ? null : String(row.coupon), status: row.status as OrderStatus, paymentMethod: 'cod', paymentStatus: row.payment_status as Order['paymentStatus'], createdAt: String(row.created_at), updatedAt: String(row.updated_at), trackingNumber: row.tracking_number === null ? null : String(row.tracking_number), trackingUrl: row.tracking_url === null ? null : String(row.tracking_url) };
}
export function audit(db: Db, actorId: string, action: string, targetId: string, details: object = {}) {
  db.prepare('INSERT INTO audit_log VALUES (?,?,?,?,?,?)').run(randomUUID(), actorId, action, targetId, JSON.stringify(details), now());
}
export function orderEvent(db: Db, orderId: string, actorId: string, event: string, details: object = {}) {
  db.prepare('INSERT INTO order_events VALUES (?,?,?,?,?,?)').run(randomUUID(), orderId, actorId, event, JSON.stringify(details), now());
}
export function checkout(db: Db, userId: string, address: Address, idempotencyKey: string): Order {
  return transaction(db, () => {
    const previous = one(db, 'SELECT id FROM orders WHERE user_id=? AND idempotency_key=?', userId, idempotencyKey);
    if (previous) return getOrder(db, String(previous.id), userId);
    if (!settings(db).codEnabled) throw new ApiError(409, 'Cash on delivery is currently unavailable.', 'PAYMENT_UNAVAILABLE');
    const owner = `user:${userId}`;
    const cart = getCart(db, owner);
    if (!cart.items.length) throw new ApiError(400, 'Add a piece to your bag before checking out.', 'EMPTY_CART');
    if (cart.warnings.length) throw new ApiError(409, cart.warnings[0], 'CART_CHANGED');
    const id = randomUUID();
    const timestamp = now();
    const reference = `OR-${Date.now().toString(36).toUpperCase()}-${id.slice(0, 5).toUpperCase()}`;
    db.prepare('INSERT INTO orders(id,reference,user_id,idempotency_key,address,subtotal,discount,shipping,tax,total,coupon,coupon_id,status,payment_method,payment_status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,\'confirmed\',\'cod\',\'pending\',?,?)').run(id, reference, userId, idempotencyKey, JSON.stringify(address), cart.subtotal, cart.discount, cart.shipping, cart.tax, cart.total, cart.coupon?.code || null, cart.coupon?.id || null, timestamp, timestamp);
    for (const item of cart.items) {
      const changed = db.prepare('UPDATE variants SET stock=stock-? WHERE id=? AND stock>=?').run(item.quantity, item.variantId, item.quantity);
      if (Number(changed.changes) !== 1) throw new ApiError(409, `${item.product.name} just sold out in this size.`, 'INSUFFICIENT_STOCK');
      db.prepare('INSERT INTO order_items VALUES (?,?,?,?,?,?,?,?,?,?,?,?)').run(randomUUID(), id, item.product.id, item.variantId, item.product.name, item.product.slug, item.product.image, item.variant.size, item.variant.color, item.variant.sku, item.quantity, item.product.price);
    }
    if (cart.coupon) db.prepare('UPDATE coupons SET uses=uses+1 WHERE id=?').run(cart.coupon.id);
    db.prepare('DELETE FROM cart_items WHERE owner=?').run(owner);
    db.prepare('DELETE FROM cart_coupons WHERE owner=?').run(owner);
    orderEvent(db, id, userId, 'order.created', { paymentMethod: 'cod', paymentStatus: 'pending' });
    return getOrder(db, id, userId);
  });
}
export function changeOrderStatus(db: Db, id: string, status: OrderStatus, actorId: string, tracking?: { trackingNumber?: string; trackingUrl?: string }, ownerId?: string) {
  return transaction(db, () => {
    const order = getOrder(db, id, ownerId);
    const transitions: Record<OrderStatus, OrderStatus[]> = { confirmed: ['processing', 'cancelled'], processing: ['shipped', 'cancelled'], shipped: ['delivered'], delivered: [], cancelled: [] };
    if (status !== order.status && !transitions[order.status].includes(status)) throw new ApiError(409, `An order that is ${order.status} cannot become ${status}.`, 'INVALID_TRANSITION');
    if (ownerId && status !== 'cancelled') throw new ApiError(403, 'This action is not permitted.', 'FORBIDDEN');
    if (status === 'cancelled' && order.status !== 'cancelled') {
      for (const item of order.items) db.prepare('UPDATE variants SET stock=stock+? WHERE id=?').run(item.quantity, item.variantId);
      db.prepare('UPDATE coupons SET uses=MAX(uses-1,0) WHERE id=(SELECT coupon_id FROM orders WHERE id=?)').run(id);
    }
    db.prepare('UPDATE orders SET status=?,payment_status=?,tracking_number=?,tracking_url=?,updated_at=? WHERE id=?').run(status, status === 'cancelled' ? 'cancelled' : order.paymentStatus, tracking?.trackingNumber ?? order.trackingNumber, tracking?.trackingUrl ?? order.trackingUrl, now(), id);
    orderEvent(db, id, actorId, `order.${status}`, { previous: order.status, ...tracking });
    if (!ownerId) audit(db, actorId, 'order.status', id, { previous: order.status, status, ...tracking });
    return getOrder(db, id, ownerId);
  });
}
