import bcrypt from 'bcryptjs';
import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';

const db = new DatabaseSync('data/hanbit.sqlite');

// 1. Promote existing user to admin
db.prepare("UPDATE users SET role='admin' WHERE email='007prakharraj@gmail.com'").run();

// 2. Create master store administrator if not exists
const existing = db.prepare("SELECT id FROM users WHERE email='admin@orivelle.com'").get();
if (!existing) {
  const id = randomUUID();
  const hash = await bcrypt.hash('Admin@Orivelle2026', 12);
  db.prepare("INSERT INTO users VALUES (?,?,?,?,'admin',?)").run(
    id,
    'Store Administrator',
    'admin@orivelle.com',
    hash,
    new Date().toISOString()
  );
  console.log('Successfully created admin@orivelle.com');
} else {
  console.log('admin@orivelle.com already exists');
}

const users = db.prepare('SELECT id, name, email, role FROM users').all();
console.log('All Users:', users);
db.close();
