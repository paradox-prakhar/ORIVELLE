import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { Settings } from './types.js';

export const defaultSettings: Settings = {
  storeName: 'ORIVELLE',
  currency: 'INR',
  shippingFlat: 15000,
  freeShippingAbove: 800000,
  taxRate: 0,
  codEnabled: true,
};
export const campaignImage = 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=1600&q=80';
export type Db = DatabaseSync;

export function createDatabase(filename = process.env.DATABASE_PATH || 'data/hanbit.sqlite') {
  if (filename !== ':memory:') mkdirSync(dirname(resolve(filename)), { recursive: true });
  const db = new DatabaseSync(filename);
  db.exec(`PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE COLLATE NOCASE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'customer' CHECK(role IN ('customer','admin')),
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS user_verifications (
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      verified_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
      expires_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions(expires_at);

    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at INTEGER NOT NULL,
      used_at INTEGER,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS reset_tokens_user ON password_reset_tokens(user_id);
    CREATE INDEX IF NOT EXISTS reset_tokens_hash ON password_reset_tokens(token_hash);

    CREATE TABLE IF NOT EXISTS email_verification_tokens (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at INTEGER NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS verify_tokens_user ON email_verification_tokens(user_id);

    CREATE TABLE IF NOT EXISTS idempotency_records (
      id TEXT PRIMARY KEY,
      key TEXT NOT NULL,
      scope TEXT NOT NULL,
      request_hash TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('processing', 'completed', 'failed')),
      response_status INTEGER,
      response_body TEXT,
      expires_at INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE(scope, key)
    );
    CREATE INDEX IF NOT EXISTS idempotency_expiry ON idempotency_records(expires_at);

    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      slug TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      category TEXT NOT NULL,
      price INTEGER NOT NULL CHECK(price >= 0),
      compare_at INTEGER,
      images TEXT NOT NULL,
      color TEXT NOT NULL,
      material TEXT NOT NULL,
      care TEXT NOT NULL,
      featured INTEGER NOT NULL DEFAULT 0,
      active INTEGER NOT NULL DEFAULT 1,
      demo INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS variants (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL REFERENCES products(id),
      sku TEXT NOT NULL UNIQUE,
      size TEXT NOT NULL,
      color TEXT NOT NULL,
      stock INTEGER NOT NULL CHECK(stock >= 0)
    );
    CREATE INDEX IF NOT EXISTS variant_product ON variants(product_id);

    CREATE TABLE IF NOT EXISTS cart_items (
      id TEXT PRIMARY KEY,
      owner TEXT NOT NULL,
      variant_id TEXT NOT NULL REFERENCES variants(id),
      quantity INTEGER NOT NULL CHECK(quantity BETWEEN 1 AND 20),
      UNIQUE(owner, variant_id)
    );
    CREATE INDEX IF NOT EXISTS cart_owner ON cart_items(owner);
    CREATE TABLE IF NOT EXISTS cart_coupons (
      owner TEXT PRIMARY KEY,
      coupon_id TEXT NOT NULL REFERENCES coupons(id)
    );
    CREATE TABLE IF NOT EXISTS wishlist (
      owner TEXT NOT NULL,
      product_id TEXT NOT NULL REFERENCES products(id),
      PRIMARY KEY(owner,product_id)
    );
    CREATE TABLE IF NOT EXISTS coupons (
      id TEXT PRIMARY KEY,
      code TEXT NOT NULL UNIQUE COLLATE NOCASE,
      percent INTEGER NOT NULL CHECK(percent BETWEEN 1 AND 90),
      min_subtotal INTEGER NOT NULL DEFAULT 0,
      active INTEGER NOT NULL DEFAULT 1,
      uses INTEGER NOT NULL DEFAULT 0,
      usage_limit INTEGER,
      expires_at TEXT
    );

    CREATE TABLE IF NOT EXISTS checkout_sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      idempotency_key TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL CHECK(status IN ('CREATED', 'VALIDATING', 'PAYMENT_PENDING', 'PROCESSING', 'SUCCEEDED', 'FAILED', 'EXPIRED', 'CANCELLED', 'REQUIRES_RECONCILIATION')),
      subtotal INTEGER NOT NULL,
      discount INTEGER NOT NULL DEFAULT 0,
      shipping INTEGER NOT NULL DEFAULT 0,
      tax INTEGER NOT NULL DEFAULT 0,
      total INTEGER NOT NULL,
      currency TEXT NOT NULL DEFAULT 'INR',
      items_snapshot TEXT NOT NULL,
      shipping_address TEXT NOT NULL,
      coupon_id TEXT REFERENCES coupons(id),
      coupon_code TEXT,
      payment_provider TEXT NOT NULL DEFAULT 'razorpay' CHECK(payment_provider IN ('razorpay', 'cod')),
      provider_order_id TEXT,
      order_id TEXT,
      expires_at INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS checkout_sessions_user ON checkout_sessions(user_id);
    CREATE INDEX IF NOT EXISTS checkout_sessions_provider_order ON checkout_sessions(provider_order_id);
    CREATE INDEX IF NOT EXISTS checkout_sessions_expiry ON checkout_sessions(expires_at);

    CREATE TABLE IF NOT EXISTS inventory_reservations (
      id TEXT PRIMARY KEY,
      checkout_session_id TEXT NOT NULL REFERENCES checkout_sessions(id) ON DELETE CASCADE,
      variant_id TEXT NOT NULL REFERENCES variants(id) ON DELETE CASCADE,
      quantity INTEGER NOT NULL CHECK(quantity > 0),
      status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE', 'FINALIZED', 'RELEASED', 'EXPIRED')),
      expires_at INTEGER NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS reservations_session ON inventory_reservations(checkout_session_id);
    CREATE INDEX IF NOT EXISTS reservations_variant ON inventory_reservations(variant_id);
    CREATE INDEX IF NOT EXISTS reservations_active ON inventory_reservations(status, expires_at);

    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      reference TEXT NOT NULL UNIQUE,
      user_id TEXT NOT NULL REFERENCES users(id),
      idempotency_key TEXT NOT NULL,
      address TEXT NOT NULL,
      subtotal INTEGER NOT NULL,
      discount INTEGER NOT NULL,
      shipping INTEGER NOT NULL,
      tax INTEGER NOT NULL,
      total INTEGER NOT NULL,
      coupon TEXT,
      coupon_id TEXT REFERENCES coupons(id),
      checkout_session_id TEXT REFERENCES checkout_sessions(id),
      status TEXT NOT NULL CHECK(status IN ('confirmed','processing','shipped','delivered','cancelled')),
      payment_method TEXT NOT NULL CHECK(payment_method IN ('cod','razorpay')),
      payment_status TEXT NOT NULL CHECK(payment_status IN ('pending','paid','cancelled','failed','refunded')),
      payment_provider TEXT NOT NULL DEFAULT 'cod',
      tracking_number TEXT,
      tracking_url TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(user_id,idempotency_key)
    );
    CREATE INDEX IF NOT EXISTS orders_user ON orders(user_id);
    CREATE INDEX IF NOT EXISTS orders_status ON orders(status);

    CREATE TABLE IF NOT EXISTS payment_attempts (
      id TEXT PRIMARY KEY,
      checkout_session_id TEXT NOT NULL REFERENCES checkout_sessions(id) ON DELETE CASCADE,
      order_id TEXT REFERENCES orders(id),
      provider TEXT NOT NULL DEFAULT 'razorpay' CHECK(provider IN ('razorpay', 'cod')),
      provider_order_id TEXT NOT NULL,
      provider_payment_id TEXT,
      provider_signature TEXT,
      amount INTEGER NOT NULL,
      currency TEXT NOT NULL DEFAULT 'INR',
      status TEXT NOT NULL CHECK(status IN ('initiated', 'attempted', 'captured', 'failed', 'cancelled', 'requires_reconciliation')),
      error_code TEXT,
      error_description TEXT,
      raw_response TEXT,
      idempotency_key TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS payment_attempts_session ON payment_attempts(checkout_session_id);
    CREATE INDEX IF NOT EXISTS payment_attempts_provider_order ON payment_attempts(provider_order_id);
    CREATE INDEX IF NOT EXISTS payment_attempts_provider_payment ON payment_attempts(provider_payment_id);

    CREATE TABLE IF NOT EXISTS payment_events (
      id TEXT PRIMARY KEY,
      event_id TEXT NOT NULL UNIQUE,
      event_type TEXT NOT NULL,
      provider TEXT NOT NULL DEFAULT 'razorpay',
      payload TEXT NOT NULL,
      signature_verified INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'RECEIVED' CHECK(status IN ('RECEIVED', 'PROCESSED', 'FAILED', 'IGNORED')),
      error TEXT,
      processed_at TEXT,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS payment_events_type ON payment_events(event_type);

    CREATE TABLE IF NOT EXISTS outbox_events (
      id TEXT PRIMARY KEY,
      event_type TEXT NOT NULL,
      payload TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      retry_count INTEGER NOT NULL DEFAULT 0,
      processed_at TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS order_items (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL REFERENCES orders(id),
      product_id TEXT NOT NULL,
      variant_id TEXT NOT NULL REFERENCES variants(id),
      name TEXT NOT NULL,
      slug TEXT NOT NULL,
      image TEXT NOT NULL,
      size TEXT NOT NULL,
      color TEXT NOT NULL,
      sku TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      price INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS order_events (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL REFERENCES orders(id),
      actor_id TEXT REFERENCES users(id),
      event TEXT NOT NULL,
      details TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS addresses (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      data TEXT NOT NULL,
      is_default INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS newsletter (
      email TEXT PRIMARY KEY COLLATE NOCASE,
      consent_at TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'local-only'
    );
    CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY CHECK(id=1),
      data TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS audit_log (
      id TEXT PRIMARY KEY,
      actor_id TEXT REFERENCES users(id),
      action TEXT NOT NULL,
      target_id TEXT NOT NULL,
      details TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS return_requests (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL UNIQUE REFERENCES orders(id),
      user_id TEXT NOT NULL REFERENCES users(id),
      reason TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'requested',
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS reviews (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL REFERENCES products(id),
      user_id TEXT NOT NULL REFERENCES users(id),
      rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),
      body TEXT NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE(product_id,user_id)
    );
  `);

  db.prepare('INSERT OR IGNORE INTO settings(id,data) VALUES (1,?)').run(JSON.stringify(defaultSettings));
  const storedSettings = JSON.parse(String((db.prepare('SELECT data FROM settings WHERE id=1').get() as { data: string }).data)) as Settings;
  if (['HANBIT', 'Hanbit'].includes(storedSettings.storeName)) {
    db.prepare('UPDATE settings SET data=? WHERE id=1').run(JSON.stringify({ ...storedSettings, storeName: defaultSettings.storeName }));
  }
  db.prepare("UPDATE products SET name='Orivelle Silk Scarf' WHERE name='Hanbit Silk Scarf'").run();

  // Run schema upgrades for existing database files
  migrateDatabase(db);

  if (process.env.SEED_DEMO !== 'false') seedCatalog(db);
  if (process.env.SEED_DEMO !== 'false' && filename !== ':memory:') ensureAtelierProducts(db);
  return db;
}

function migrateDatabase(db: Db) {
  // Ensure orders table columns
  const orderColumns = db.prepare('PRAGMA table_info(orders)').all() as { name: string }[];
  if (!orderColumns.some(col => col.name === 'coupon_id')) {
    db.exec('ALTER TABLE orders ADD COLUMN coupon_id TEXT REFERENCES coupons(id)');
    db.exec('UPDATE orders SET coupon_id=(SELECT id FROM coupons WHERE coupons.code=orders.coupon) WHERE coupon IS NOT NULL');
  }
  if (!orderColumns.some(col => col.name === 'checkout_session_id')) {
    db.exec('ALTER TABLE orders ADD COLUMN checkout_session_id TEXT REFERENCES checkout_sessions(id)');
  }
  if (!orderColumns.some(col => col.name === 'payment_provider')) {
    db.exec("ALTER TABLE orders ADD COLUMN payment_provider TEXT NOT NULL DEFAULT 'cod'");
  }

  // Check if orders table has legacy CHECK constraint payment_method='cod'
  const ordersSchemaRow = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='orders'").get() as { sql: string } | undefined;
  if (ordersSchemaRow?.sql && ordersSchemaRow.sql.includes("payment_method='cod'")) {
    db.exec('PRAGMA foreign_keys = OFF;');
    db.exec('BEGIN IMMEDIATE;');
    try {
      db.exec(`
        CREATE TABLE orders_new (
          id TEXT PRIMARY KEY,
          reference TEXT NOT NULL UNIQUE,
          user_id TEXT NOT NULL REFERENCES users(id),
          idempotency_key TEXT NOT NULL,
          address TEXT NOT NULL,
          subtotal INTEGER NOT NULL,
          discount INTEGER NOT NULL,
          shipping INTEGER NOT NULL,
          tax INTEGER NOT NULL,
          total INTEGER NOT NULL,
          coupon TEXT,
          coupon_id TEXT REFERENCES coupons(id),
          checkout_session_id TEXT REFERENCES checkout_sessions(id),
          status TEXT NOT NULL CHECK(status IN ('confirmed','processing','shipped','delivered','cancelled')),
          payment_method TEXT NOT NULL CHECK(payment_method IN ('cod','razorpay')),
          payment_status TEXT NOT NULL CHECK(payment_status IN ('pending','paid','cancelled','failed','refunded')),
          payment_provider TEXT NOT NULL DEFAULT 'cod',
          tracking_number TEXT,
          tracking_url TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          UNIQUE(user_id,idempotency_key)
        );
        INSERT INTO orders_new SELECT
          id, reference, user_id, idempotency_key, address, subtotal, discount, shipping, tax, total,
          coupon, coupon_id, checkout_session_id, status, payment_method, payment_status, payment_provider,
          tracking_number, tracking_url, created_at, updated_at
        FROM orders;
        DROP TABLE orders;
        ALTER TABLE orders_new RENAME TO orders;
        CREATE INDEX IF NOT EXISTS orders_user ON orders(user_id);
        CREATE INDEX IF NOT EXISTS orders_status ON orders(status);
      `);
      db.exec('COMMIT;');
    } catch (err) {
      db.exec('ROLLBACK;');
      throw err;
    } finally {
      db.exec('PRAGMA foreign_keys = ON;');
    }
  }
}

function seedCatalog(db: Db) {
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
  let began = false;
  try {
    db.exec('BEGIN IMMEDIATE');
    began = true;
  } catch (err: unknown) {
    if (err instanceof Error && /cannot start a transaction/i.test(err.message)) {
      return action();
    }
    throw err;
  }

  try {
    const value = action();
    if (began) db.exec('COMMIT');
    return value;
  } catch (error) {
    if (began) {
      try { db.exec('ROLLBACK'); } catch {}
    }
    throw error;
  }
}

function ensureAtelierProducts(db: Db) {
  const pieces = [
    ['sculpted-wool-trench', 'Sculpted Wool Trench', 'Outerwear', 1450000, 'Oat Camel', '100% Virgin Wool Twill', 'An architectural double-faced wool trench with generous raglan sleeves, storm flap, and a relaxed belted waist. Fluid unlined drape for effortless seasonal movement.', 'https://images.unsplash.com/photo-1683393092542-74689e4b8367?auto=format&fit=crop&w=1600&q=80'],
    ['tailored-wool-overcoat', 'Tailored Wool Overcoat', 'Outerwear', 1680000, 'Charcoal Melange', 'Heavy Italian Worsted Wool', 'A clean-lined minimalist overcoat cut from heavyweight Italian wool. Features sharp notch lapels, genuine horn buttons, deep welt pockets, and an unhurried straight silhouette.', 'https://images.unsplash.com/photo-1787436025288-874f0696fcca?auto=format&fit=crop&w=1600&q=80'],
    ['spun-cashmere-rib', 'Spun Cashmere Rib Sweater', 'Knitwear', 980000, 'Ecru Cream', 'Combed Cashmere & Mulberry Silk', 'Whisper-soft ribbed knit spun from premium combed cashmere and mulberry silk. Features a relaxed funnel collar, dropped shoulder seams, and effortless lightweight warmth.', 'https://images.unsplash.com/photo-1625795550960-9558411bae05?auto=format&fit=crop&w=1600&q=80'],
    ['relaxed-wool-blazer', 'Relaxed Wool Blazer', 'Tops', 1220000, 'Slate Ink', 'Breathable Wool-Linen Blend', 'An unstructured tailored blazer crafted from breathable Belgian wool-linen weave. Soft natural shoulders, patch pockets, and twin rear vents for daily ease.', 'https://images.unsplash.com/photo-1453396450673-3fe83d2db2c4?auto=format&fit=crop&w=1600&q=80'],
    ['sandwashed-silk-dress', 'Sandwashed Silk Dress', 'Dresses', 1150000, 'Desert Stone', '100% Pure Mulberry Silk', 'A fluid bias-cut midi dress cut from sandwashed mulberry silk with a soft matte luster. Drapes naturally along the body line with delicate seam finishing.', 'https://images.unsplash.com/photo-1496747611176-843222e1e57c?auto=format&fit=crop&w=1600&q=80'],
    ['korean-hanbok-silk-dress', 'Chima Hanbok Silk Dress', 'Dresses', 1350000, 'Vermilion & Silk Crimson', '100% Pure Mulberry Silk Chima & Crisp Jeogori', 'Traditional Korean Hanbok silk silhouette with flowing chima drape, delicate goreum tie ribbons, and unhurried ease. Celebrating Seoul atelier lineages with pure mulberry silk.', 'https://images.unsplash.com/photo-1578632767115-351597cf2477?auto=format&fit=crop&w=1600&q=80'],
    ['ceremonial-woven-kimono', 'Ceremonial Silk Kimono & Obi', 'Dresses', 1580000, 'Midnight Indigo', 'Artisanal Woven Silk & Jacquard Brocade', 'Handcrafted Japanese kimono featuring straight-line geometric drape, drop sleeves, and coordinating jacquard obi sash. Centered on centuries of meditative Kyoto textile discipline.', 'https://images.unsplash.com/photo-1503899036084-c55cdd92da26?auto=format&fit=crop&w=1600&q=80'],
    ['banarasi-zari-silk-sari', 'Banarasi Zari Handloom Sari', 'Dresses', 1850000, 'Royal Aubergine', 'Katan Mulberry Silk & Pure Gold Zari', 'Heritage Indian handloom silk sari woven on traditional Varanasi pit-looms. Features intricate floral jaal motifs and heavy pallu bordered with pure metallic zari.', 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&w=1600&q=80'],
    ['moroccan-artisan-djellaba', 'Atlas Desert Linen Djellaba', 'Tops', 890000, 'Slate Obsidian', 'Woven Linen-Cotton & Handcrafted Sfifa Braiding', 'Moroccan hooded djellaba tailored with airy, protective volume for desert mists and temperate evenings. Accented with handcrafted sfifa embroidery and silk aqqad buttons.', 'https://images.unsplash.com/photo-1544441893-675973e31985?auto=format&fit=crop&w=1600&q=80'],
    ['highland-worsted-wool-tartan', 'Highland Worsted Wool Tartan', 'Bottoms', 1120000, 'Clan Forest Green', '100% Pure Scottish Worsted Wool', 'Pleated heritage tartan garment woven in the Scottish Highlands from 16oz worsted clan wool. Weather-resistant, deeply knife-pleated, and built to endure generations.', 'https://images.unsplash.com/photo-1509099836639-18ba1795216d?auto=format&fit=crop&w=1600&q=80'],
    ['parisian-couture-blazer', 'Parisian Atelier Couture Blazer', 'Outerwear', 1720000, 'Ochre Sun & Noir', 'French Wool Crepe & Silk Lining', 'Architectural French haute couture tailored outerwear featuring canvassed floating chest construction, sculpted shoulders, and horn-accented peaked lapels.', 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=1600&q=80'],
  ] as const;

  const insertProduct = db.prepare('INSERT OR IGNORE INTO products(id,slug,name,description,category,price,compare_at,images,color,material,care,featured,active,demo,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)');
  const insertVariant = db.prepare('INSERT OR IGNORE INTO variants VALUES (?,?,?,?,?,?)');
  const sizes = ['XS', 'S', 'M', 'L', 'XL'];

  transaction(db, () => {
    for (const [index, row] of pieces.entries()) {
      const [slug, name, category, price, color, material, description, image] = row;
      const id = `product-${slug}`;
      insertProduct.run(id, slug, name, `${description} Demonstration product. Campaign photography is illustrative and does not depict this exact item.`, category, price, null, JSON.stringify([image]), color, material, 'Demonstration care guidance; follow the final garment label.', 1, 1, 1, new Date(Date.UTC(2026, 9, 10 + index)).toISOString());
      for (const [n, size] of sizes.entries()) {
        const sku = `ORI-${slug.slice(0, 3).toUpperCase()}-${size}`;
        insertVariant.run(`${slug}-${size.toLowerCase()}`, id, sku, size, color, 8 + n * 2);
      }
    }
  });
}
