import { randomBytes, createHash, timingSafeEqual } from 'node:crypto';
import { hash as argonHash, verify as argonVerify } from '@node-rs/argon2';
import bcrypt from 'bcryptjs';
import type { Db } from './database.js';
import { one, now } from './repository.js';
import { ApiError, type User } from './types.js';

export const hashToken = (token: string): string =>
  createHash('sha256').update(token).digest('hex');

const ARGON_OPTIONS = {
  memoryCost: 19456,
  timeCost: 3,
  outputLen: 32,
  parallelism: 1,
};

export async function hashPassword(
  plain: string,
  options?: { algorithm?: 'argon2id' | 'bcrypt'; bcryptCost?: number }
): Promise<string> {
  if (options?.algorithm === 'bcrypt' || options?.bcryptCost !== undefined) {
    return bcrypt.hash(plain, options?.bcryptCost ?? 12);
  }
  return argonHash(plain, ARGON_OPTIONS);
}

export async function verifyPassword(
  plain: string,
  storedHash: string
): Promise<{ valid: boolean; needsUpgrade: boolean }> {
  try {
    if (storedHash.startsWith('$argon2id$') || storedHash.startsWith('$argon2i$')) {
      const valid = await argonVerify(storedHash, plain);
      return { valid, needsUpgrade: false };
    }
    if (storedHash.startsWith('$2a$') || storedHash.startsWith('$2b$') || storedHash.startsWith('$2y$')) {
      const valid = await bcrypt.compare(plain, storedHash);
      return { valid, needsUpgrade: valid };
    }
    return { valid: false, needsUpgrade: false };
  } catch {
    return { valid: false, needsUpgrade: false };
  }
}

export async function upgradePasswordHash(db: Db, userId: string, plain: string): Promise<void> {
  try {
    const newHash = await argonHash(plain, ARGON_OPTIONS);
    db.prepare('UPDATE users SET password_hash=? WHERE id=?').run(newHash, userId);
  } catch (err) {
    console.error('Failed to upgrade password hash to Argon2id:', err);
  }
}

export function createPasswordResetToken(db: Db, userId: string): string {
  const plainToken = randomBytes(32).toString('base64url');
  const tokenHash = hashToken(plainToken);
  const expiresAt = Date.now() + 15 * 60 * 1000; // 15 minutes
  const id = randomBytes(16).toString('hex');

  db.prepare('DELETE FROM password_reset_tokens WHERE user_id=?').run(userId);
  db.prepare(`
    INSERT INTO password_reset_tokens(id, user_id, token_hash, expires_at, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, userId, tokenHash, expiresAt, now());

  return plainToken;
}

export async function resetPasswordWithToken(db: Db, token: string, newPasswordPlain: string): Promise<User> {
  const tokenHash = hashToken(token);
  const row = one(
    db,
    'SELECT * FROM password_reset_tokens WHERE token_hash=? AND used_at IS NULL',
    tokenHash
  );

  if (!row) {
    throw new ApiError(400, 'This password reset link is invalid or has already been used.', 'INVALID_TOKEN');
  }

  const expiresAt = Number(row.expires_at);
  if (Date.now() > expiresAt) {
    throw new ApiError(400, 'This password reset link has expired. Please request a new one.', 'EXPIRED_TOKEN');
  }

  const userId = String(row.user_id);
  const newHash = await argonHash(newPasswordPlain, ARGON_OPTIONS);

  db.prepare('UPDATE password_reset_tokens SET used_at=? WHERE id=?').run(Date.now(), String(row.id));
  db.prepare('UPDATE users SET password_hash=? WHERE id=?').run(newHash, userId);
  db.prepare('DELETE FROM sessions WHERE user_id=?').run(userId);

  const updatedUserRow = one(db, 'SELECT id, name, email, role, created_at FROM users WHERE id=?', userId);
  if (!updatedUserRow) throw new ApiError(404, 'User account not found.', 'NOT_FOUND');

  const isVerified = Boolean(one(db, 'SELECT 1 FROM user_verifications WHERE user_id=?', userId));

  return {
    id: String(updatedUserRow.id),
    name: String(updatedUserRow.name),
    email: String(updatedUserRow.email),
    role: updatedUserRow.role as User['role'],
    emailVerified: isVerified,
    createdAt: String(updatedUserRow.created_at),
  };
}

export function createEmailVerificationToken(db: Db, userId: string): string {
  const plainToken = randomBytes(32).toString('base64url');
  const tokenHash = hashToken(plainToken);
  const expiresAt = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
  const id = randomBytes(16).toString('hex');

  db.prepare('DELETE FROM email_verification_tokens WHERE user_id=?').run(userId);
  db.prepare(`
    INSERT INTO email_verification_tokens(id, user_id, token_hash, expires_at, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, userId, tokenHash, expiresAt, now());

  return plainToken;
}

export function verifyEmailWithToken(db: Db, token: string): User {
  const tokenHash = hashToken(token);
  const row = one(
    db,
    'SELECT * FROM email_verification_tokens WHERE token_hash=?',
    tokenHash
  );

  if (!row) {
    throw new ApiError(400, 'This email verification link is invalid.', 'INVALID_TOKEN');
  }

  const expiresAt = Number(row.expires_at);
  if (Date.now() > expiresAt) {
    throw new ApiError(400, 'This email verification link has expired.', 'EXPIRED_TOKEN');
  }

  const userId = String(row.user_id);
  db.prepare('INSERT OR REPLACE INTO user_verifications(user_id, verified_at) VALUES (?, ?)').run(userId, now());
  db.prepare('DELETE FROM email_verification_tokens WHERE id=?').run(String(row.id));

  const userRow = one(db, 'SELECT id, name, email, role, created_at FROM users WHERE id=?', userId);
  if (!userRow) throw new ApiError(404, 'User account not found.', 'NOT_FOUND');

  return {
    id: String(userRow.id),
    name: String(userRow.name),
    email: String(userRow.email),
    role: userRow.role as User['role'],
    emailVerified: true,
    createdAt: String(userRow.created_at),
  };
}

export function constantTimeEquals(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}
