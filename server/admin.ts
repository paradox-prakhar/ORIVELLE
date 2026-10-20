import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { type Db, transaction } from './database.js';
import { ApiError } from './types.js';
import { audit, changeOrderStatus, coupon, getOrder, getProduct, many, now, one, product, safeUser, settings, variant } from './repository.js';
import { context, requireAdmin } from './security.js';
import { couponPatchSchema, couponSchema, productPatchSchema, productSchema, settingsSchema } from './validation.js';

export function adminRouter(db: Db) {
  const router = Router();
  router.use(requireAdmin);
  const inventory = () => many(db, 'SELECT v.*,p.name AS product_name,p.id AS product_id FROM variants v JOIN products p ON p.id=v.product_id WHERE p.active=1 ORDER BY v.stock,p.name').map(row => ({ ...variant(row), productName: String(row.product_name), productId: String(row.product_id) }));
  router.get('/overview', (_req, res) => {
    const totals = one(db, `SELECT COUNT(*) AS totalOrders,COALESCE(SUM(CASE WHEN status!='cancelled' THEN total ELSE 0 END),0) AS revenue,SUM(CASE WHEN status IN ('confirmed','processing') THEN 1 ELSE 0 END) AS pendingOrders,SUM(CASE WHEN status='delivered' THEN 1 ELSE 0 END) AS fulfilledOrders FROM orders`)!;
    res.json({ revenue: Number(totals.revenue), totalOrders: Number(totals.totalOrders), pendingOrders: Number(totals.pendingOrders || 0), fulfilledOrders: Number(totals.fulfilledOrders || 0), customers: Number(one(db, "SELECT COUNT(*) AS count FROM users WHERE role='customer'")!.count), lowStock: inventory().filter(item => item.stock <= 8), recentOrders: many(db, 'SELECT id FROM orders ORDER BY created_at DESC LIMIT 8').map(item => getOrder(db, String(item.id))), sales: many(db, "SELECT substr(created_at,1,10) AS date,SUM(total) AS total,COUNT(*) AS count FROM orders WHERE status!='cancelled' GROUP BY substr(created_at,1,10) ORDER BY date DESC LIMIT 30").reverse(), revenueNote: 'Order value excluding cancellations; COD payments remain pending until reconciled.' });
  });
  router.get('/products', (_req, res) => { const items = many(db, 'SELECT * FROM products ORDER BY created_at DESC').map(row => product(db, row)); res.json({ items, total: items.length }); });
  router.post('/products', (req, res) => {
    const data = productSchema.parse(req.body);
    if (data.compareAtPrice != null && data.compareAtPrice < data.price) throw new ApiError(400, 'Original price must be at least the selling price.');
    const id = randomUUID();
    transaction(db, () => {
      db.prepare('INSERT INTO products(id,slug,name,description,category,price,compare_at,images,color,material,care,featured,active,demo,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(id, data.slug, data.name, data.description, data.category, data.price, data.compareAtPrice ?? null, JSON.stringify(data.images), data.color, data.material, data.care, Number(data.featured), Number(data.active), Number(data.demo), now());
      for (const item of data.variants) db.prepare('INSERT INTO variants VALUES (?,?,?,?,?,?)').run(randomUUID(), id, item.sku, item.size, item.color, item.stock);
      audit(db, context(res).user!.id, 'product.create', id, { name: data.name });
    });
    res.status(201).json({ product: getProduct(db, id, true) });
  });
  router.patch('/products/:id', (req, res) => {
    const id = String(req.params.id);
    const existing = getProduct(db, id, true);
    const patch = productPatchSchema.parse(req.body);
    const data = { ...existing, ...patch };
    if (data.compareAtPrice != null && data.compareAtPrice < data.price) throw new ApiError(400, 'Original price must be at least the selling price.');
    transaction(db, () => {
      db.prepare('UPDATE products SET slug=?,name=?,description=?,category=?,price=?,compare_at=?,images=?,color=?,material=?,care=?,featured=?,active=?,demo=? WHERE id=?').run(data.slug, data.name, data.description, data.category, data.price, data.compareAtPrice ?? null, JSON.stringify(data.images), data.color, data.material, data.care, Number(data.featured), Number(data.active), Number(data.demo), id);
      audit(db, context(res).user!.id, 'product.update', id, patch);
    });
    res.json({ product: getProduct(db, id, true) });
  });
  router.delete('/products/:id', (req, res) => {
    const id = getProduct(db, String(req.params.id), true).id;
    transaction(db, () => { db.prepare('UPDATE products SET active=0 WHERE id=?').run(id); audit(db, context(res).user!.id, 'product.archive', id); });
    res.json({ product: getProduct(db, id, true) });
  });
  router.get('/orders', (req, res) => {
    const status = z.enum(['confirmed', 'processing', 'shipped', 'delivered', 'cancelled']).optional().parse(req.query.status || undefined);
    const items = many(db, `SELECT id FROM orders ${status ? 'WHERE status=?' : ''} ORDER BY created_at DESC LIMIT 200`, ...(status ? [status] : [])).map(row => getOrder(db, String(row.id)));
    res.json({ items, total: items.length });
  });
  router.get('/orders/:id', (req, res) => res.json({ order: getOrder(db, String(req.params.id)), events: many(db, 'SELECT id,event,details,created_at AS createdAt FROM order_events WHERE order_id=? ORDER BY created_at', String(req.params.id)).map(row => ({ ...row, details: JSON.parse(String(row.details)) as unknown })) }));
  router.patch('/orders/:id', (req, res) => {
    const data = z.object({ status: z.enum(['confirmed', 'processing', 'shipped', 'delivered', 'cancelled']), trackingNumber: z.string().trim().max(120).optional(), trackingUrl: z.union([z.literal(''), z.string().url().max(2000).refine(value => new URL(value).protocol === 'https:')]).optional() }).parse(req.body);
    res.json({ order: changeOrderStatus(db, String(req.params.id), data.status, context(res).user!.id, data) });
  });
  router.get('/inventory', (_req, res) => res.json({ items: inventory() }));
  router.post('/inventory/:id', (req, res) => {
    const data = z.object({ adjustment: z.number().int().min(-100000).max(100000).refine(value => value !== 0), reason: z.string().trim().min(3).max(500) }).parse(req.body);
    const id = String(req.params.id);
    transaction(db, () => {
      const existing = one(db, 'SELECT stock FROM variants WHERE id=?', id);
      if (!existing) throw new ApiError(404, 'Variant not found.', 'NOT_FOUND');
      const next = Number(existing.stock) + data.adjustment;
      if (next < 0 || next > 100000) throw new ApiError(409, 'The resulting stock must be between 0 and 100,000.', 'INVALID_STOCK');
      db.prepare('UPDATE variants SET stock=? WHERE id=?').run(next, id);
      audit(db, context(res).user!.id, 'inventory.adjustment', id, { ...data, previous: existing.stock, stock: next });
    });
    res.json({ item: variant(one(db, 'SELECT * FROM variants WHERE id=?', id)!) });
  });
  router.get('/audit', (_req, res) => res.json({ items: many(db, 'SELECT a.*,u.email AS actor_email FROM audit_log a LEFT JOIN users u ON u.id=a.actor_id ORDER BY a.created_at DESC LIMIT 200').map(row => ({ id: row.id, actorId: row.actor_id, actorEmail: row.actor_email, action: row.action, targetId: row.target_id, details: JSON.parse(String(row.details)) as unknown, createdAt: row.created_at })) }));
  router.get('/customers', (_req, res) => res.json({ items: many(db, `SELECT u.*,COUNT(o.id) AS order_count,COALESCE(SUM(CASE WHEN o.status!='cancelled' THEN o.total ELSE 0 END),0) AS total_spent FROM users u LEFT JOIN orders o ON o.user_id=u.id GROUP BY u.id ORDER BY u.created_at DESC LIMIT 500`).map(row => ({ ...safeUser(row), orderCount: Number(row.order_count), totalSpent: Number(row.total_spent) })) }));
  router.get('/coupons', (_req, res) => res.json({ items: many(db, 'SELECT * FROM coupons ORDER BY code').map(coupon) }));
  router.post('/coupons', (req, res) => {
    const data = couponSchema.parse(req.body); const id = randomUUID();
    transaction(db, () => { db.prepare('INSERT INTO coupons(id,code,percent,min_subtotal,active,uses,usage_limit,expires_at) VALUES (?,?,?,?,?,0,?,?)').run(id, data.code, data.percent, data.minSubtotal, Number(data.active), data.usageLimit ?? null, data.expiresAt ?? null); audit(db, context(res).user!.id, 'coupon.create', id, data); });
    res.status(201).json({ coupon: coupon(one(db, 'SELECT * FROM coupons WHERE id=?', id)!) });
  });
  router.patch('/coupons/:id', (req, res) => {
    const id = String(req.params.id); const row = one(db, 'SELECT * FROM coupons WHERE id=?', id);
    if (!row) throw new ApiError(404, 'Discount not found.', 'NOT_FOUND');
    const patch = couponPatchSchema.parse(req.body); const data = { ...coupon(row), ...patch };
    transaction(db, () => { db.prepare('UPDATE coupons SET code=?,percent=?,min_subtotal=?,active=?,usage_limit=?,expires_at=? WHERE id=?').run(data.code, data.percent, data.minSubtotal, Number(data.active), data.usageLimit ?? null, data.expiresAt ?? null, id); audit(db, context(res).user!.id, 'coupon.update', id, patch); });
    res.json({ coupon: coupon(one(db, 'SELECT * FROM coupons WHERE id=?', id)!) });
  });
  router.get('/settings', (_req, res) => res.json(settings(db)));
  router.patch('/settings', (req, res) => {
    const patch = settingsSchema.partial().parse(req.body); const data = { ...settings(db), ...patch };
    transaction(db, () => { db.prepare('UPDATE settings SET data=? WHERE id=1').run(JSON.stringify(data)); audit(db, context(res).user!.id, 'settings.update', 'store', patch); });
    res.json(data);
  });
  router.get('/returns', (_req, res) => res.json({ items: many(db, 'SELECT r.*,o.reference,u.email FROM return_requests r JOIN orders o ON o.id=r.order_id JOIN users u ON u.id=r.user_id ORDER BY r.created_at DESC').map(row => ({ id: row.id, orderId: row.order_id, reference: row.reference, email: row.email, reason: row.reason, status: row.status, createdAt: row.created_at })) }));
  router.patch('/returns/:id', (req, res) => {
    const data = z.object({ status: z.enum(['approved', 'rejected']) }).parse(req.body); const id = String(req.params.id);
    const row = one(db, 'SELECT * FROM return_requests WHERE id=?', id);
    if (!row) throw new ApiError(404, 'Return request not found.', 'NOT_FOUND');
    if (row.status !== 'requested') throw new ApiError(409, 'This return has already been reviewed.', 'INVALID_TRANSITION');
    transaction(db, () => { db.prepare('UPDATE return_requests SET status=? WHERE id=?').run(data.status, id); audit(db, context(res).user!.id, `return.${data.status}`, id); });
    res.json({ request: { id, status: data.status }, message: 'Return decision recorded. Shipping, refund and customer communication require manual follow-up.' });
  });
  return router;
}
