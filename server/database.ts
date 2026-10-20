import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { Settings } from './types.js';

export const defaultSettings: Settings = { storeName: 'ORIVELLE', currency: 'INR', shippingFlat: 15000, freeShippingAbove: 800000, taxRate: 0, codEnabled: true };
export const campaignImage = 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=1600&q=80';
export type Db = DatabaseSync;

export function createDatabase(filename = process.env.DATABASE_PATH || 'data/hanbit.sqlite') {
  if (filename !== ':memory:') mkdirSync(dirname(resolve(filename)), { recursive: true });
  const db = new DatabaseSync(filename);
  db.exec(`PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;
    CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE COLLATE NOCASE, password_hash TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'customer' CHECK(role IN ('customer','admin')), created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, user_id TEXT REFERENCES users(id) ON DELETE CASCADE, expires_at INTEGER NOT NULL);
    CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions(expires_at);
    CREATE TABLE IF NOT EXISTS products (id TEXT PRIMARY KEY, slug TEXT NOT NULL UNIQUE, name TEXT NOT NULL, description TEXT NOT NULL, category TEXT NOT NULL, price INTEGER NOT NULL CHECK(price >= 0), compare_at INTEGER, images TEXT NOT NULL, color TEXT NOT NULL, material TEXT NOT NULL, care TEXT NOT NULL, featured INTEGER NOT NULL DEFAULT 0, active INTEGER NOT NULL DEFAULT 1, demo INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS variants (id TEXT PRIMARY KEY, product_id TEXT NOT NULL REFERENCES products(id), sku TEXT NOT NULL UNIQUE, size TEXT NOT NULL, color TEXT NOT NULL, stock INTEGER NOT NULL CHECK(stock >= 0));
    CREATE INDEX IF NOT EXISTS variant_product ON variants(product_id);
    CREATE TABLE IF NOT EXISTS cart_items (id TEXT PRIMARY KEY, owner TEXT NOT NULL, variant_id TEXT NOT NULL REFERENCES variants(id), quantity INTEGER NOT NULL CHECK(quantity BETWEEN 1 AND 20), UNIQUE(owner, variant_id));
    CREATE INDEX IF NOT EXISTS cart_owner ON cart_items(owner);
    CREATE TABLE IF NOT EXISTS cart_coupons (owner TEXT PRIMARY KEY, coupon_id TEXT NOT NULL REFERENCES coupons(id));
    CREATE TABLE IF NOT EXISTS wishlist (owner TEXT NOT NULL, product_id TEXT NOT NULL REFERENCES products(id), PRIMARY KEY(owner,product_id));
    CREATE TABLE IF NOT EXISTS coupons (id TEXT PRIMARY KEY, code TEXT NOT NULL UNIQUE COLLATE NOCASE, percent INTEGER NOT NULL CHECK(percent BETWEEN 1 AND 90), min_subtotal INTEGER NOT NULL DEFAULT 0, active INTEGER NOT NULL DEFAULT 1, uses INTEGER NOT NULL DEFAULT 0, usage_limit INTEGER, expires_at TEXT);
    CREATE TABLE IF NOT EXISTS orders (id TEXT PRIMARY KEY, reference TEXT NOT NULL UNIQUE, user_id TEXT NOT NULL REFERENCES users(id), idempotency_key TEXT NOT NULL, address TEXT NOT NULL, subtotal INTEGER NOT NULL, discount INTEGER NOT NULL, shipping INTEGER NOT NULL, tax INTEGER NOT NULL, total INTEGER NOT NULL, coupon TEXT, status TEXT NOT NULL CHECK(status IN ('confirmed','processing','shipped','delivered','cancelled')), payment_method TEXT NOT NULL CHECK(payment_method='cod'), payment_status TEXT NOT NULL CHECK(payment_status IN ('pending','cancelled')), tracking_number TEXT, tracking_url TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, UNIQUE(user_id,idempotency_key));
    CREATE INDEX IF NOT EXISTS orders_user ON orders(user_id);
    CREATE TABLE IF NOT EXISTS order_items (id TEXT PRIMARY KEY, order_id TEXT NOT NULL REFERENCES orders(id), product_id TEXT NOT NULL, variant_id TEXT NOT NULL REFERENCES variants(id), name TEXT NOT NULL, slug TEXT NOT NULL, image TEXT NOT NULL, size TEXT NOT NULL, color TEXT NOT NULL, sku TEXT NOT NULL, quantity INTEGER NOT NULL, price INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS order_events (id TEXT PRIMARY KEY, order_id TEXT NOT NULL REFERENCES orders(id), actor_id TEXT REFERENCES users(id), event TEXT NOT NULL, details TEXT NOT NULL, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS addresses (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, data TEXT NOT NULL, is_default INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE IF NOT EXISTS newsletter (email TEXT PRIMARY KEY COLLATE NOCASE, consent_at TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'local-only');
    CREATE TABLE IF NOT EXISTS settings (id INTEGER PRIMARY KEY CHECK(id=1), data TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS audit_log (id TEXT PRIMARY KEY, actor_id TEXT REFERENCES users(id), action TEXT NOT NULL, target_id TEXT NOT NULL, details TEXT NOT NULL, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS return_requests (id TEXT PRIMARY KEY, order_id TEXT NOT NULL UNIQUE REFERENCES orders(id), user_id TEXT NOT NULL REFERENCES users(id), reason TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'requested', created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS reviews (id TEXT PRIMARY KEY, product_id TEXT NOT NULL REFERENCES products(id), user_id TEXT NOT NULL REFERENCES users(id), rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5), body TEXT NOT NULL, created_at TEXT NOT NULL, UNIQUE(product_id,user_id));
  `);
  db.prepare('INSERT OR IGNORE INTO settings(id,data) VALUES (1,?)').run(JSON.stringify(defaultSettings));
  // Preserve custom identities and every existing customer, inventory and order record.
  const storedSettings = JSON.parse(String((db.prepare('SELECT data FROM settings WHERE id=1').get() as { data: string }).data)) as Settings;
  if (['HANBIT', 'Hanbit'].includes(storedSettings.storeName)) db.prepare('UPDATE settings SET data=? WHERE id=1').run(JSON.stringify({ ...storedSettings, storeName: defaultSettings.storeName }));
  db.prepare("UPDATE products SET name='Orivelle Silk Scarf' WHERE name='Hanbit Silk Scarf' AND demo=1").run();
  const orderColumns = db.prepare('PRAGMA table_info(orders)').all() as { name: string }[];
  if (!orderColumns.some(column => column.name === 'coupon_id')) {
    db.exec('ALTER TABLE orders ADD COLUMN coupon_id TEXT REFERENCES coupons(id)');
    db.exec('UPDATE orders SET coupon_id=(SELECT id FROM coupons WHERE coupons.code=orders.coupon) WHERE coupon IS NOT NULL');
  }
  if (process.env.SEED_DEMO !== 'false') seedCatalog(db);
  return db;
}

function seedCatalog(db: Db) {
  // Seed once; administrators may subsequently archive or replace the demonstration catalogue.
  if ((db.prepare('SELECT COUNT(*) AS count FROM products').get() as { count: number }).count) return;
  const catalog = [
    ['seoul-wrap-shirt', 'Seoul Wrap Shirt', 'Tops', 480000, 'Cloud', 'Cotton poplin', 'A quietly structured wrap shirt with a generous sleeve and an adjustable waist. Inspired by the easy rhythm of a Seoul morning.'],
    ['jeonju-linen-trouser', 'Jeonju Linen Trouser', 'Bottoms', 620000, 'Oat', 'Linen cotton blend', 'A relaxed straight leg and a softly tailored waist, made for slower days and long walks through the city.'],
    ['gyeongju-midi-dress', 'Gyeongju Midi Dress', 'Dresses', 890000, 'Ink', 'Cotton lyocell blend', 'An understated midi silhouette with considered drape, an open neckline and a shape that moves with you.'],
    ['busan-everyday-jacket', 'Busan Everyday Jacket', 'Outerwear', 1180000, 'Stone', 'Cotton twill', 'A light, easy layer with a sculpted collar and generous pockets. Made to accompany the journey, wherever it leads.'],
    ['hanbit-silk-scarf', 'Orivelle Silk Scarf', 'Accessories', 320000, 'Dawn', 'Silk', 'A finishing touch in a generous square, inspired by the pale colours of the mountains at first light.'],
    ['dawn-knit-cardigan', 'Dawn Knit Cardigan', 'Knitwear', 740000, 'Ecru', 'Cotton knit', 'A soft cardigan with a clean neckline and an easy fit. A thoughtful everyday layer for the in-between moments.'],
  ] as const;
  transaction(db, () => {
    for (const [index, row] of catalog.entries()) {
      const [slug, name, category, price, color, material, description] = row;
      const id = `product-${slug}`;
      db.prepare('INSERT INTO products(id,slug,name,description,category,price,compare_at,images,color,material,care,featured,active,demo,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(
        id, slug, name, `${description} Demonstration product; campaign photography is illustrative and does not depict this exact item.`, category, price, null, JSON.stringify([campaignImage]), color, material, 'Demonstration care information. Follow the care label on your final product.', index < 4 ? 1 : 0, 1, 1, new Date(Date.UTC(2026, 9, 1 + index)).toISOString());
      const sizes = category === 'Accessories' ? ['One size'] : ['XS', 'S', 'M', 'L', 'XL'];
      for (const [n, size] of sizes.entries()) db.prepare('INSERT INTO variants VALUES (?,?,?,?,?,?)').run(`${slug}-${size.toLowerCase().replaceAll(' ', '-')}`, id, `HB-${index + 1}-${n + 1}`, size, color, 6 + n * 2);
    }
    db.prepare('INSERT OR IGNORE INTO coupons(id,code,percent,min_subtotal,active,uses,usage_limit,expires_at) VALUES (?,?,?,?,1,0,NULL,NULL)').run(randomUUID(), 'DEMO10', 10, 300000);
  });
}

export function transaction<T>(db: Db, action: () => T): T {
  db.exec('BEGIN IMMEDIATE');
  try { const value = action(); db.exec('COMMIT'); return value; }
  catch (error) { db.exec('ROLLBACK'); throw error; }
}
