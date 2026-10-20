import express, { type ErrorRequestHandler } from 'express';
import cookieParser from 'cookie-parser';
import bcrypt from 'bcryptjs';
import { randomBytes, randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';
import type { SQLInputValue } from 'node:sqlite';
import { createDatabase, transaction, type Db } from './database.js';
import { ApiError } from './types.js';
import { addCartItem, changeOrderStatus, checkout, coupon, couponIssue, getCart, getOrder, getProduct, many, now, one, product, safeUser, settings } from './repository.js';
import { authenticate, context, logout, originProtection, rateLimit, requireUser, sessionMiddleware } from './security.js';
import { addressSchema, email, name, password, quantity } from './validation.js';
import { adminRouter } from './admin.js';

export interface AppOptions { db?: Db; databasePath?: string; origins?: string[]; production?: boolean; passwordCost?: number; serveFrontend?: boolean }
export function createApp(options: AppOptions = {}) {
  const db = options.db || createDatabase(options.databasePath);
  const app = express();
  const production = options.production ?? process.env.NODE_ENV === 'production';
  const passwordCost = options.passwordCost || 12;
  const fallbackHash = bcrypt.hashSync(randomBytes(32).toString('hex'), passwordCost);
  const origins = options.origins || (process.env.APP_ORIGINS || 'http://localhost:5173,http://127.0.0.1:5173,http://localhost:4173,http://127.0.0.1:4173,http://localhost:3001,http://127.0.0.1:3001').split(',').map(value => value.trim());
  app.disable('x-powered-by');
  const proxyHops = Number(process.env.TRUST_PROXY_HOPS || 0);
  if (!Number.isInteger(proxyHops) || proxyHops < 0 || proxyHops > 5) throw new Error('TRUST_PROXY_HOPS must be an integer between 0 and 5.');
  if (proxyHops > 0) app.set('trust proxy', proxyHops);
  app.use((_req, res, next) => { res.set({ 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'strict-origin-when-cross-origin', 'X-Frame-Options': 'DENY', 'Permissions-Policy': 'camera=(), microphone=(), geolocation=()' }); if (production) res.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains'); next(); });
  app.use('/api', rateLimit(400, 60000), express.json({ limit: '64kb' }), cookieParser(), originProtection(origins), sessionMiddleware(db, production), (_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  app.get('/api/health', (_req, res) => res.json({ status: 'ok', storage: 'sqlite' }));
  app.get('/api/config', (_req, res) => {
    const store = settings(db);
    res.json({ currency: store.currency, storeName: store.storeName, codEnabled: store.codEnabled, shipping: { flatRate: store.shippingFlat, freeAbove: store.freeShippingAbove }, taxRate: store.taxRate, payments: { razorpay: { enabled: false, message: 'Online payments are not connected. Cash on delivery is available when enabled by the store.' } }, newsletter: { mode: 'local', message: 'Your email is saved locally with your consent. Campaign delivery is not connected.' }, email: { configured: false, message: 'Email verification, password reset and order emails require a configured transactional email service.' }, demoCatalog: Boolean(one(db, 'SELECT COUNT(*) AS count FROM products WHERE demo=1')!.count) });
  });
  app.get('/api/products', (req, res) => {
    const input = z.object({ q: z.string().trim().max(120).default(''), category: z.string().max(80).default(''), sort: z.enum(['newest', 'price-asc', 'price-desc', 'featured']).default('newest'), page: z.coerce.number().int().min(1).max(10000).default(1), minPrice: z.coerce.number().int().min(0).optional(), maxPrice: z.coerce.number().int().min(0).optional() }).parse(req.query);
    const clauses = ['active=1']; const values: SQLInputValue[] = [];
    if (input.q) { clauses.push("(name LIKE ? ESCAPE '\\' OR description LIKE ? ESCAPE '\\')"); const query = `%${input.q.replace(/[\\%_]/g, value => `\\${value}`)}%`; values.push(query, query); }
    if (input.category && input.category.toLowerCase() !== 'all') { clauses.push('category=?'); values.push(input.category); }
    if (input.minPrice != null) { clauses.push('price>=?'); values.push(input.minPrice); }
    if (input.maxPrice != null) { clauses.push('price<=?'); values.push(input.maxPrice); }
    const where = clauses.join(' AND '); const pageSize = 12;
    const sort = { newest: 'created_at DESC', 'price-asc': 'price ASC', 'price-desc': 'price DESC', featured: 'featured DESC,created_at DESC' }[input.sort];
    res.json({ items: many(db, `SELECT * FROM products WHERE ${where} ORDER BY ${sort},id LIMIT ? OFFSET ?`, ...values, pageSize, (input.page - 1) * pageSize).map(row => product(db, row)), total: Number(one(db, `SELECT COUNT(*) AS count FROM products WHERE ${where}`, ...values)!.count), page: input.page, pageSize, categories: many(db, 'SELECT DISTINCT category FROM products WHERE active=1 ORDER BY category').map(row => row.category) });
  });
  app.get('/api/products/:slug', (req, res) => res.json(getProduct(db, String(req.params.slug))));
  app.get('/api/products/:slug/reviews', (req, res) => {
    const item = getProduct(db, String(req.params.slug));
    const items = many(db, 'SELECT r.id,r.rating,r.body,r.created_at AS createdAt,u.name FROM reviews r JOIN users u ON u.id=r.user_id WHERE r.product_id=? ORDER BY r.created_at DESC', item.id);
    res.json({ items, total: items.length });
  });
  app.post('/api/products/:slug/reviews', requireUser, (req, res) => {
    const item = getProduct(db, String(req.params.slug)); const userId = context(res).user!.id;
    const data = z.object({ rating: z.number().int().min(1).max(5), body: z.string().trim().min(10).max(2000) }).parse(req.body);
    if (!one(db, "SELECT oi.id FROM order_items oi JOIN orders o ON o.id=oi.order_id WHERE o.user_id=? AND oi.product_id=? AND o.status='delivered'", userId, item.id)) throw new ApiError(403, 'Reviews are available after a verified order has been delivered.', 'PURCHASE_REQUIRED');
    const id = randomUUID(); db.prepare('INSERT INTO reviews VALUES (?,?,?,?,?,?)').run(id, item.id, userId, data.rating, data.body, now()); res.status(201).json({ id, ...data });
  });

  const authRate = rateLimit(15, 15 * 60000);
  app.get('/api/auth/me', (_req, res) => res.json({ user: context(res).user }));
  app.post('/api/auth/register', authRate, async (req, res) => {
    const data = z.object({ name, email, password }).parse(req.body);
    const id = randomUUID(); const hash = await bcrypt.hash(data.password, passwordCost);
    if (one(db, 'SELECT id FROM users WHERE email=?', data.email)) throw new ApiError(409, 'An account already exists with this email. Please sign in.', 'EMAIL_EXISTS');
    db.prepare("INSERT INTO users VALUES (?,?,?,?,'customer',?)").run(id, data.name, data.email, hash, now());
    const user = safeUser(one(db, 'SELECT * FROM users WHERE id=?', id)!); authenticate(db, res, user, production);
    res.status(201).json({ user });
  });
  app.post('/api/auth/login', authRate, async (req, res) => {
    const data = z.object({ email, password: z.string().min(1).max(72).refine(value => Buffer.byteLength(value, 'utf8') <= 72, 'Password must fit within 72 UTF-8 bytes.') }).parse(req.body);
    const row = one(db, 'SELECT * FROM users WHERE email=?', data.email);
    const valid = await bcrypt.compare(data.password, row ? String(row.password_hash) : fallbackHash);
    if (!row || !valid) throw new ApiError(401, 'Email or password is incorrect.', 'INVALID_CREDENTIALS');
    const user = safeUser(row); authenticate(db, res, user, production); res.json({ user });
  });
  app.post('/api/auth/logout', (_req, res) => { logout(db, res, production); res.json({ user: null }); });
  app.post('/api/auth/forgot-password', authRate, (req, _res) => { z.object({ email }).parse(req.body); throw new ApiError(503, 'Password reset requires a configured email service. Contact the store administrator.', 'EMAIL_NOT_CONFIGURED'); });
  app.patch('/api/account', requireUser, (req, res) => { const data = z.object({ name }).parse(req.body); db.prepare('UPDATE users SET name=? WHERE id=?').run(data.name, context(res).user!.id); res.json({ user: safeUser(one(db, 'SELECT * FROM users WHERE id=?', context(res).user!.id)!) }); });

  app.get('/api/cart', (_req, res) => res.json(getCart(db, context(res).owner)));
  app.post('/api/cart/items', (req, res) => { const data = z.object({ variantId: z.string().min(1).max(150), quantity }).parse(req.body); res.json(addCartItem(db, context(res).owner, data.variantId, data.quantity)); });
  app.patch('/api/cart/items/:id', (req, res) => {
    const data = z.object({ quantity }).parse(req.body); const owner = context(res).owner;
    const row = one(db, 'SELECT variant_id FROM cart_items WHERE id=? AND owner=?', String(req.params.id), owner);
    if (!row) throw new ApiError(404, 'Bag item not found.', 'NOT_FOUND');
    res.json(addCartItem(db, owner, String(row.variant_id), data.quantity, true));
  });
  app.delete('/api/cart/items/:id', (req, res) => { const owner = context(res).owner; db.prepare('DELETE FROM cart_items WHERE id=? AND owner=?').run(String(req.params.id), owner); res.json(getCart(db, owner)); });
  app.post('/api/cart/coupon', (req, res) => {
    const data = z.object({ code: z.string().trim().min(1).max(32) }).parse(req.body); const owner = context(res).owner;
    const row = one(db, 'SELECT * FROM coupons WHERE code=?', data.code.toUpperCase());
    if (!row) throw new ApiError(400, 'This discount code was not found.', 'INVALID_COUPON');
    const value = coupon(row); const issue = couponIssue(value, getCart(db, owner).subtotal);
    if (issue) throw new ApiError(400, issue, 'INVALID_COUPON');
    db.prepare('INSERT INTO cart_coupons(owner,coupon_id) VALUES (?,?) ON CONFLICT(owner) DO UPDATE SET coupon_id=excluded.coupon_id').run(owner, value.id); res.json(getCart(db, owner));
  });
  app.delete('/api/cart/coupon', (_req, res) => { db.prepare('DELETE FROM cart_coupons WHERE owner=?').run(context(res).owner); res.json(getCart(db, context(res).owner)); });
  app.get('/api/wishlist', (_req, res) => res.json({ items: many(db, 'SELECT p.* FROM products p JOIN wishlist w ON w.product_id=p.id WHERE w.owner=? AND p.active=1 ORDER BY w.rowid DESC', context(res).owner).map(row => product(db, row)) }));
  app.post('/api/wishlist', (req, res) => { const data = z.object({ productId: z.string().min(1).max(150) }).parse(req.body); const item = getProduct(db, data.productId); db.prepare('INSERT OR IGNORE INTO wishlist VALUES (?,?)').run(context(res).owner, item.id); res.json({ product: item }); });
  app.delete('/api/wishlist/:id', (req, res) => { db.prepare('DELETE FROM wishlist WHERE owner=? AND product_id=?').run(context(res).owner, String(req.params.id)); res.json({ success: true }); });

  app.post('/api/checkout', requireUser, rateLimit(20, 60000), (req, res) => {
    const data = z.object({ address: addressSchema, paymentMethod: z.literal('cod'), idempotencyKey: z.string().min(12).max(100).regex(/^[\w-]+$/) }).parse(req.body);
    res.status(201).json({ order: checkout(db, context(res).user!.id, data.address, data.idempotencyKey) });
  });
  app.get('/api/orders', requireUser, (_req, res) => res.json({ items: many(db, 'SELECT id FROM orders WHERE user_id=? ORDER BY created_at DESC', context(res).user!.id).map(row => getOrder(db, String(row.id), context(res).user!.id)) }));
  app.get('/api/orders/:id', requireUser, (req, res) => res.json({ order: getOrder(db, String(req.params.id), context(res).user!.id) }));
  app.post('/api/orders/:id/cancel', requireUser, (req, res) => res.json({ order: changeOrderStatus(db, String(req.params.id), 'cancelled', context(res).user!.id, undefined, context(res).user!.id) }));
  app.post('/api/orders/:id/return', requireUser, (req, res) => {
    const data = z.object({ reason: z.string().trim().min(10).max(1500) }).parse(req.body); const userId = context(res).user!.id;
    const order = getOrder(db, String(req.params.id), userId);
    const delivery = one(db, "SELECT created_at FROM order_events WHERE order_id=? AND event='order.delivered' ORDER BY created_at LIMIT 1", order.id);
    const deliveredAt = delivery ? String(delivery.created_at) : order.updatedAt;
    if (order.status !== 'delivered' || Date.now() - new Date(deliveredAt).getTime() > 14 * 86400000) throw new ApiError(409, 'Return requests are available within 14 days of delivery.', 'RETURN_UNAVAILABLE');
    const request = { id: randomUUID(), orderId: order.id, reason: data.reason, status: 'requested', createdAt: now() };
    db.prepare('INSERT INTO return_requests VALUES (?,?,?,?,?,?)').run(request.id, order.id, userId, request.reason, request.status, request.createdAt); res.status(201).json({ request });
  });
  app.get('/api/addresses', requireUser, (_req, res) => res.json({ items: many(db, 'SELECT * FROM addresses WHERE user_id=? ORDER BY is_default DESC,rowid', context(res).user!.id).map(row => ({ id: row.id, ...JSON.parse(String(row.data)) as object, isDefault: Boolean(row.is_default) })) }));
  app.post('/api/addresses', requireUser, (req, res) => {
    const data = addressSchema.extend({ isDefault: z.boolean().optional() }).parse(req.body); const { isDefault, ...address } = data;
    const userId = context(res).user!.id; const id = randomUUID(); const count = Number(one(db, 'SELECT COUNT(*) AS count FROM addresses WHERE user_id=?', userId)!.count);
    if (count >= 10) throw new ApiError(400, 'You can save up to ten addresses.', 'ADDRESS_LIMIT');
    const makeDefault = isDefault || count === 0;
    transaction(db, () => { if (makeDefault) db.prepare('UPDATE addresses SET is_default=0 WHERE user_id=?').run(userId); db.prepare('INSERT INTO addresses VALUES (?,?,?,?)').run(id, userId, JSON.stringify(address), Number(makeDefault)); });
    res.status(201).json({ address: { id, ...address, isDefault: makeDefault } });
  });
  app.patch('/api/addresses/:id', requireUser, (req, res) => {
    const id = String(req.params.id); const userId = context(res).user!.id;
    const row = one(db, 'SELECT * FROM addresses WHERE id=? AND user_id=?', id, userId); if (!row) throw new ApiError(404, 'Address not found.', 'NOT_FOUND');
    const patch = addressSchema.extend({ isDefault: z.boolean().optional() }).partial().parse(req.body); const { isDefault, ...addressPatch } = patch;
    const address = { ...JSON.parse(String(row.data)) as object, ...addressPatch }; const makeDefault = isDefault ?? Boolean(row.is_default);
    transaction(db, () => { if (makeDefault) db.prepare('UPDATE addresses SET is_default=0 WHERE user_id=?').run(userId); db.prepare('UPDATE addresses SET data=?,is_default=? WHERE id=? AND user_id=?').run(JSON.stringify(address), Number(makeDefault), id, userId); });
    res.json({ address: { id, ...address, isDefault: makeDefault } });
  });
  app.delete('/api/addresses/:id', requireUser, (req, res) => { const userId = context(res).user!.id; transaction(db, () => { db.prepare('DELETE FROM addresses WHERE id=? AND user_id=?').run(String(req.params.id), userId); if (!one(db, 'SELECT id FROM addresses WHERE user_id=? AND is_default=1', userId)) db.prepare('UPDATE addresses SET is_default=1 WHERE id=(SELECT id FROM addresses WHERE user_id=? ORDER BY rowid LIMIT 1)').run(userId); }); res.json({ success: true }); });
  app.post('/api/newsletter', rateLimit(5, 60000), (req, res) => { const data = z.object({ email, consent: z.boolean().optional() }).parse(req.body); if (data.consent === false) throw new ApiError(400, 'Consent is required to save your email.', 'CONSENT_REQUIRED'); db.prepare('INSERT OR IGNORE INTO newsletter(email,consent_at) VALUES (?,?)').run(data.email, now()); res.status(201).json({ success: true, mode: 'local', message: 'Your email is saved in this local store. Email campaigns are not connected yet.' }); });
  app.use('/api/admin', adminRouter(db));
  app.use('/api', (_req, _res, next) => next(new ApiError(404, 'This API endpoint was not found.', 'NOT_FOUND')));
  if (options.serveFrontend !== false && existsSync(resolve('dist/index.html'))) { app.use(express.static(resolve('dist'), { index: false })); app.get('/{*path}', (_req, res) => res.sendFile(resolve('dist/index.html'))); }
  const errors: ErrorRequestHandler = (error: unknown, _req, res, _next) => {
    if (error instanceof z.ZodError) { res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: error.issues[0]?.message || 'Please check your details.', fields: error.flatten().fieldErrors }, message: error.issues[0]?.message || 'Please check your details.' }); return; }
    if (error instanceof ApiError) { res.status(error.status).json({ error: { code: error.code, message: error.message }, message: error.message }); return; }
    if (error instanceof Error && /UNIQUE constraint failed/.test(error.message)) { res.status(409).json({ error: { code: 'ALREADY_EXISTS', message: 'A record with these details already exists.' }, message: 'A record with these details already exists.' }); return; }
    if (error instanceof SyntaxError && 'body' in error) { res.status(400).json({ error: { code: 'INVALID_JSON', message: 'The request contains invalid JSON.' }, message: 'The request contains invalid JSON.' }); return; }
    if (error instanceof Error && 'status' in error && error.status === 413) { res.status(413).json({ error: { code: 'BODY_TOO_LARGE', message: 'This request is too large.' }, message: 'This request is too large.' }); return; }
    // Never log request bodies, session tokens, passwords or customer address data.
    console.error('API request failed:', error instanceof Error ? error.name : 'UnknownError');
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'The store could not complete this request. Please try again.' }, message: 'The store could not complete this request. Please try again.' });
  };
  app.use(errors);
  return { app, db, close: () => db.close() };
}
