import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { createDatabase } from './database.js';
import { email, name, password } from './validation.js';
import { audit, now, one } from './repository.js';
import { loadEnvironment } from './environment.js';
loadEnvironment();
const parsed = z.object({ ADMIN_EMAIL: email, ADMIN_PASSWORD: password, ADMIN_NAME: name.default('Store administrator') }).safeParse(process.env);
if (!parsed.success) { console.error('Set ADMIN_EMAIL and a strong ADMIN_PASSWORD (10–72 characters) before running admin:create. No default administrator exists.'); process.exit(1); }
const db = createDatabase();
try {
  const value = parsed.data;
  if (one(db, 'SELECT id FROM users WHERE email=?', value.ADMIN_EMAIL)) throw new Error('An account with this email already exists. Use a distinct admin email; this command does not silently promote or overwrite users.');
  const id = randomUUID();
  db.prepare("INSERT INTO users VALUES (?,?,?,?,'admin',?)").run(id, value.ADMIN_NAME, value.ADMIN_EMAIL, await bcrypt.hash(value.ADMIN_PASSWORD, 12), now());
  audit(db, id, 'admin.provisioned', id);
  console.log('Administrator created. Sign in through /admin using the credentials you supplied. Remove ADMIN_PASSWORD from the environment after provisioning.');
} catch (error) { console.error(error instanceof Error ? error.message : 'Administrator setup failed.'); process.exitCode = 1; }
finally { db.close(); }
