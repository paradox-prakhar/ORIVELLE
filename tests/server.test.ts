import { afterEach, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import type { Server } from 'node:http';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve as resolvePath } from 'node:path';
import bcrypt from 'bcryptjs';
import { createApp } from '../server/app.js';
import { createDatabase, type Db } from '../server/database.js';
import { now, one } from '../server/repository.js';
import type { Address, Cart, Order, Product, User, Variant } from '../server/types.js';

type Items<T> = { items: T[] };
type Catalog = Items<Product> & { total: number; page: number; pageSize: number };
type OrderResponse = { order: Order };
type SavedAddress = Address & { id: string; isDefault: boolean };

const origin = 'http://localhost:5173';
let server: Server;
let db: Db;
let base: string;
beforeEach(async () => {
  const instance = createApp({ databasePath: ':memory:', origins: [origin], passwordCost: 4, serveFrontend: false });
  db = instance.db;
  server = await new Promise<Server>(resolve => { const value = instance.app.listen(0, '127.0.0.1', () => resolve(value)); });
  const address = server.address(); if (!address || typeof address === 'string') throw new Error('Test server did not open.');
  base = `http://127.0.0.1:${address.port}`;
});
afterEach(async () => { await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); db.close(); });

function client() {
  let cookie = '';
  return {
    cookie: () => cookie,
    async request<T = unknown>(path: string, method = 'GET', body?: unknown, extraHeaders: Record<string, string> = {}) {
      const response = await fetch(base + '/api' + path, { method, headers: { Origin: origin, ...(cookie ? { Cookie: cookie } : {}), ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...extraHeaders }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
      const setCookie = response.headers.getSetCookie().at(-1); if (setCookie) cookie = setCookie.split(';')[0];
      // Explicit response contracts at each call keep API assertions typed, without unsafe any.
      const data = await response.json() as T;
      return { status: response.status, data, headers: response.headers };
    },
  };
}
async function registered(buyer = client()) {
  const response = await buyer.request<{ user: User }>('/auth/register', 'POST', { name: 'Test Customer', email: `${randomUUID()}@example.test`, password: 'A-real-test-password42' });
  assert.equal(response.status, 201); return { buyer, user: response.data.user };
}
async function productFor(buyer: ReturnType<typeof client>) { return (await buyer.request<Catalog>('/products')).data.items[0]; }
const address = { name: 'Test Customer', phone: '9876543210', line1: '42 Test Street', city: 'New Delhi', state: 'Delhi', pincode: '110001' };
async function checkoutOne(buyer: ReturnType<typeof client>) {
  const product = await productFor(buyer);
  assert.equal((await buyer.request('/cart/items', 'POST', { variantId: product.variants[0].id, quantity: 1 })).status, 200);
  const response = await buyer.request<OrderResponse>('/checkout', 'POST', { address, paymentMethod: 'cod', idempotencyKey: randomUUID() });
  assert.equal(response.status, 201); return { order: response.data.order, product };
}
async function administrator() {
  const id = randomUUID(); const email = `${id}@admin.test`; const password = 'Admin-test-password42';
  db.prepare("INSERT INTO users VALUES (?,?,?,?,'admin',?)").run(id, 'Administrator', email, await bcrypt.hash(password, 4), now());
  const admin = client(); assert.equal((await admin.request('/auth/login', 'POST', { email, password })).status, 200); return admin;
}

test('catalog is persisted, searchable, filterable and paginated with exact supplied image URL', async () => {
  const visitor = client(); const result = await visitor.request<Catalog>('/products?sort=price-asc');
  assert.equal(result.status, 200); assert.equal(result.data.total, 6); assert.equal(result.data.pageSize, 12);
  assert.ok(result.data.items.every((item: { demo: boolean; image: string }) => item.demo && item.image.endsWith('?auto=format&fit=crop&w=1600&q=80')));
  const filtered = await visitor.request<Catalog>('/products?category=Tops&q=seoul&maxPrice=500000'); assert.equal(filtered.data.total, 1);
  const escaped = await visitor.request<Catalog>('/products?q=%25'); assert.equal(escaped.data.total, 0);
  assert.equal((await visitor.request('/products?minPrice=-1')).status, 400);
  assert.equal((await visitor.request('/products/no-such-piece')).status, 404);
});
test('parallel anonymous reads never issue competing guest cookies or create abandoned sessions', async () => {
  const responses = await Promise.all(['/products', '/cart', '/wishlist', '/auth/me', '/config', '/health'].map(path => fetch(`${base}/api${path}`)));
  for (const response of responses) { assert.equal(response.status, 200); assert.equal(response.headers.getSetCookie().length, 0); await response.json(); }
  assert.equal(one(db, 'SELECT COUNT(*) AS count FROM sessions')!.count, 0);
});
test('registration hashes passwords, rotates guest session and merges cart and wishlist', async () => {
  const buyer = client(); const piece = await productFor(buyer);
  await buyer.request('/cart/items', 'POST', { variantId: piece.variants[0].id, quantity: 2 });
  await buyer.request('/wishlist', 'POST', { productId: piece.id });
  const oldCookie = buyer.cookie();
  const result = await registered(buyer);
  assert.notEqual(buyer.cookie(), oldCookie);
  assert.equal((await buyer.request<Cart>('/cart')).data.items[0].quantity, 2);
  assert.equal((await buyer.request<Items<Product>>('/wishlist')).data.items.length, 1);
  const row = one(db, 'SELECT password_hash FROM users WHERE id=?', result.user.id)!;
  assert.ok(String(row.password_hash).startsWith('$2')); assert.notEqual(row.password_hash, 'A-real-test-password42');
  const stale = await fetch(base + '/api/auth/me', { headers: { Cookie: oldCookie } }); assert.deepEqual(await stale.json(), { user: null });
});
test('login preserves account data and merges quantities without exceeding stock', async () => {
  const buyer = client(); const email = 'merge@example.test'; const password = 'Correct-password42';
  await buyer.request('/auth/register', 'POST', { name: 'Merge Customer', email, password }); const piece = await productFor(buyer);
  await buyer.request('/cart/items', 'POST', { variantId: piece.variants[0].id, quantity: 2 });
  await buyer.request('/auth/logout', 'POST', {});
  await buyer.request('/cart/items', 'POST', { variantId: piece.variants[0].id, quantity: 2 });
  assert.equal((await buyer.request('/auth/login', 'POST', { email, password })).status, 200);
  assert.equal((await buyer.request<Cart>('/cart')).data.items[0].quantity, 4);
});
test('password limits reject bcrypt truncation and logout supports an empty POST body', async () => {
  const buyer = client(); const email = 'long-password@example.test'; const password = 'a'.repeat(72);
  assert.equal((await buyer.request('/auth/register', 'POST', { name: 'Long Password', email, password })).status, 201);
  assert.equal((await buyer.request('/auth/logout', 'POST')).status, 200);
  assert.equal((await buyer.request('/auth/login', 'POST', { email, password: `${password}extra` })).status, 400);
  assert.equal((await buyer.request('/auth/login', 'POST', { email, password })).status, 200);
});
test('unsafe origins, unauthorized admin access and cross-account item mutation are rejected', async () => {
  const guest = client(); assert.equal((await guest.request('/admin/overview')).status, 401);
  assert.equal((await guest.request('/cart/items', 'POST', { variantId: 'fake', quantity: 1 }, { Origin: 'https://evil.example' })).status, 403);
  const { buyer } = await registered(); assert.equal((await buyer.request('/admin/overview')).status, 403);
  const piece = await productFor(buyer); const cart = await buyer.request<Cart>('/cart/items', 'POST', { variantId: piece.variants[0].id, quantity: 1 });
  assert.equal((await guest.request(`/cart/items/${cart.data.items[0].id}`, 'PATCH', { quantity: 2 })).status, 404);
  assert.equal((await guest.request('/checkout', 'POST', { address, paymentMethod: 'cod', idempotencyKey: randomUUID() })).status, 401);
});
test('checkout computes totals on server, applies coupon once, reserves stock and is idempotent', async () => {
  const { buyer } = await registered(); const piece = await productFor(buyer); const variant = piece.variants[0];
  await buyer.request('/cart/items', 'POST', { variantId: variant.id, quantity: 2 });
  const cart = await buyer.request<Cart>('/cart/coupon', 'POST', { code: 'demo10' }); assert.equal(cart.status, 200);
  assert.equal(cart.data.discount, Math.floor(piece.price * 2 * 0.1));
  const payload = { address, paymentMethod: 'cod', idempotencyKey: randomUUID(), total: 1, discount: 99999999 };
  const first = await buyer.request<OrderResponse>('/checkout', 'POST', payload); assert.equal(first.status, 201);
  assert.equal(first.data.order.total, cart.data.total); assert.equal(first.data.order.paymentStatus, 'pending');
  const duplicate = await buyer.request<OrderResponse>('/checkout', 'POST', payload); assert.equal(duplicate.data.order.id, first.data.order.id);
  assert.equal(one(db, 'SELECT stock FROM variants WHERE id=?', variant.id)!.stock, variant.stock - 2);
  assert.equal(one(db, 'SELECT uses FROM coupons WHERE code=?', 'DEMO10')!.uses, 1);
  assert.equal((await buyer.request<Cart>('/cart')).data.items.length, 0);
  assert.equal(one(db, 'SELECT COUNT(*) AS count FROM orders')!.count, 1);
});
test('competing carts cannot oversell and failed checkouts are rolled back', async () => {
  const first = (await registered()).buyer; const second = (await registered()).buyer; const piece = await productFor(first); const id = piece.variants[0].id;
  db.prepare('UPDATE variants SET stock=1 WHERE id=?').run(id);
  await first.request('/cart/items', 'POST', { variantId: id, quantity: 1 }); await second.request('/cart/items', 'POST', { variantId: id, quantity: 1 });
  const responses = await Promise.all([first.request('/checkout', 'POST', { address, paymentMethod: 'cod', idempotencyKey: randomUUID() }), second.request('/checkout', 'POST', { address, paymentMethod: 'cod', idempotencyKey: randomUUID() })]);
  assert.deepEqual(responses.map(value => value.status).sort(), [201, 409]);
  assert.equal(one(db, 'SELECT stock FROM variants WHERE id=?', id)!.stock, 0); assert.equal(one(db, 'SELECT COUNT(*) AS count FROM orders')!.count, 1);
});
test('order ownership is enforced and cancellation restores stock exactly once', async () => {
  const first = (await registered()).buyer; const second = (await registered()).buyer; const { order, product } = await checkoutOne(first);
  assert.equal((await second.request(`/orders/${order.id}`)).status, 404);
  assert.equal((await second.request(`/orders/${order.id}/cancel`, 'POST', {})).status, 404);
  assert.equal((await first.request<OrderResponse>(`/orders/${order.id}/cancel`, 'POST', {})).data.order.status, 'cancelled');
  await first.request(`/orders/${order.id}/cancel`, 'POST', {});
  assert.equal(one(db, 'SELECT stock FROM variants WHERE id=?', product.variants[0].id)!.stock, product.variants[0].stock);
});
test('cancellation restores coupon allocation even after the administrator renames the code', async () => {
  const buyer = (await registered()).buyer; const piece = await productFor(buyer);
  await buyer.request('/cart/items', 'POST', { variantId: piece.variants[0].id, quantity: 1 });
  await buyer.request('/cart/coupon', 'POST', { code: 'DEMO10' });
  const placed = await buyer.request<OrderResponse>('/checkout', 'POST', { address, paymentMethod: 'cod', idempotencyKey: randomUUID() });
  db.prepare("UPDATE coupons SET code='RENAMED10' WHERE code='DEMO10'").run();
  assert.equal((await buyer.request(`/orders/${placed.data.order.id}/cancel`, 'POST')).status, 200);
  assert.equal(one(db, "SELECT uses FROM coupons WHERE code='RENAMED10'")!.uses, 0);
});
test('stock validation, malformed addresses and unconfigured online payments cannot place an order', async () => {
  const { buyer } = await registered(); const piece = await productFor(buyer);
  assert.equal((await buyer.request('/cart/items', 'POST', { variantId: piece.variants[0].id, quantity: 20 })).status, 409);
  assert.equal((await buyer.request('/cart/items', 'POST', { variantId: piece.variants[0].id, quantity: -2 })).status, 400);
  await buyer.request('/cart/items', 'POST', { variantId: piece.variants[0].id, quantity: 1 });
  assert.equal((await buyer.request('/checkout', 'POST', { address: { ...address, pincode: '123' }, paymentMethod: 'cod', idempotencyKey: randomUUID() })).status, 400);
  assert.equal((await buyer.request('/checkout', 'POST', { address, paymentMethod: 'razorpay', idempotencyKey: randomUUID() })).status, 400);
  assert.equal((await buyer.request<{ payments: { razorpay: { enabled: boolean } } }>('/config')).data.payments.razorpay.enabled, false);
  assert.equal(one(db, 'SELECT COUNT(*) AS count FROM orders')!.count, 0);
});
test('admin settings change totals, inventory writes audit log, and status transitions are enforced', async () => {
  const admin = await administrator(); const { buyer } = await registered(); const piece = await productFor(buyer);
  assert.equal((await admin.request('/admin/settings', 'PATCH', { taxRate: 5, shippingFlat: 20000 })).status, 200);
  const cart = await buyer.request<Cart>('/cart/items', 'POST', { variantId: piece.variants[0].id, quantity: 1 });
  assert.equal(cart.data.tax, Math.round(piece.price * .05)); assert.equal(cart.data.shipping, 20000);
  const adjust = await admin.request<{ item: Variant }>(`/admin/inventory/${piece.variants[0].id}`, 'POST', { adjustment: -piece.variants[0].stock, reason: 'Test stock count' }); assert.equal(adjust.data.item.stock, 0);
  assert.equal((await admin.request(`/admin/inventory/${piece.variants[0].id}`, 'POST', { adjustment: -1, reason: 'Invalid reduction' })).status, 409);
  assert.equal((await admin.request<Items<unknown>>('/admin/audit')).data.items.length, 2);
  await admin.request(`/admin/inventory/${piece.variants[0].id}`, 'POST', { adjustment: 10, reason: 'Replenishment' });
  const placed = await buyer.request<OrderResponse>('/checkout', 'POST', { address, paymentMethod: 'cod', idempotencyKey: randomUUID() }); const id = placed.data.order.id;
  assert.equal((await admin.request(`/admin/orders/${id}`, 'PATCH', { status: 'delivered' })).status, 409);
  await admin.request(`/admin/orders/${id}`, 'PATCH', { status: 'processing' }); await admin.request(`/admin/orders/${id}`, 'PATCH', { status: 'shipped', trackingNumber: 'TEST-42' });
  assert.equal((await buyer.request(`/orders/${id}/cancel`, 'POST', {})).status, 409);
  assert.equal((await admin.request<{ totalOrders: number }>('/admin/overview')).data.totalOrders, 1);
});
test('partial admin edits preserve unsubmitted product flags and coupon rules', async () => {
  const admin = await administrator(); const piece = await productFor(admin);
  await admin.request(`/admin/products/${piece.id}`, 'PATCH', { active: false, featured: true, demo: true });
  const changed = await admin.request<{ product: Product }>(`/admin/products/${piece.id}`, 'PATCH', { name: 'Updated name only' });
  assert.equal(changed.data.product.active, false); assert.equal(changed.data.product.featured, true); assert.equal(changed.data.product.demo, true);
  const row = one(db, "SELECT id FROM coupons WHERE code='DEMO10'")!;
  await admin.request(`/admin/coupons/${row.id}`, 'PATCH', { active: false, minSubtotal: 500000 });
  await admin.request(`/admin/coupons/${row.id}`, 'PATCH', { percent: 15 });
  assert.equal(one(db, 'SELECT active FROM coupons WHERE id=?', String(row.id))!.active, 0);
  assert.equal(one(db, 'SELECT min_subtotal FROM coupons WHERE id=?', String(row.id))!.min_subtotal, 500000);
});
test('address data is isolated, defaults are consistent, and newsletter states local-only storage', async () => {
  const first = (await registered()).buyer; const second = (await registered()).buyer;
  const saved = await first.request<{ address: SavedAddress }>('/addresses', 'POST', address); assert.equal(saved.status, 201); assert.equal(saved.data.address.isDefault, true);
  assert.equal((await second.request<Items<SavedAddress>>('/addresses')).data.items.length, 0);
  assert.equal((await second.request(`/addresses/${saved.data.address.id}`, 'PATCH', { city: 'Mumbai' })).status, 404);
  assert.equal((await first.request<{ mode: string }>('/newsletter', 'POST', { email: 'consent@example.test', consent: true })).data.mode, 'local');
  assert.equal(one(db, 'SELECT status FROM newsletter WHERE email=?', 'consent@example.test')!.status, 'local-only');
  assert.equal((await first.request('/auth/forgot-password', 'POST', { email: 'consent@example.test' })).status, 503);
});
test('database file survives close and reopen without resetting inventory or consent', () => {
  const directory = mkdtempSync(join(tmpdir(), 'hanbit-db-test-')); const path = join(directory, 'store.sqlite');
  try {
    const first = createDatabase(path); first.prepare("UPDATE variants SET stock=3 WHERE sku='HB-1-1'").run(); first.prepare('INSERT INTO newsletter(email,consent_at) VALUES (?,?)').run('persist@example.test', now()); first.close();
    const reopened = createDatabase(path); assert.equal(one(reopened, "SELECT stock FROM variants WHERE sku='HB-1-1'")!.stock, 3); assert.equal(one(reopened, 'SELECT COUNT(*) AS count FROM newsletter')!.count, 1); reopened.close();
  } finally { assert.ok(resolvePath(directory).startsWith(resolvePath(join(tmpdir(), 'hanbit-db-test-')))); rmSync(directory, { recursive: true, force: true }); }
});
