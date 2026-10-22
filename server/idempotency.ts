import { createHash, randomUUID } from 'node:crypto';
import type { Db } from './database.js';
import { one, now } from './repository.js';
import { ApiError } from './types.js';

export function canonicalJson(obj: unknown): string {
  if (obj === null || typeof obj !== 'object') {
    return JSON.stringify(obj);
  }
  if (Array.isArray(obj)) {
    return '[' + obj.map(canonicalJson).join(',') + ']';
  }
  const keys = Object.keys(obj as Record<string, unknown>).sort();
  return '{' + keys.map(k => `${JSON.stringify(k)}:${canonicalJson((obj as Record<string, unknown>)[k])}`).join(',') + '}';
}

export function hashPayload(payload: unknown): string {
  const canonical = canonicalJson(payload);
  return createHash('sha256').update(canonical).digest('hex');
}

export interface IdempotencyResult<T> {
  status: number;
  body: T;
  replayed: boolean;
}

export async function executeIdempotent<T>(
  db: Db,
  scope: string,
  key: string,
  payload: unknown,
  action: () => Promise<{ status: number; body: T }> | { status: number; body: T },
  ttlMs = 24 * 60 * 60 * 1000 // 24 hours
): Promise<IdempotencyResult<T>> {
  if (!key || typeof key !== 'string' || key.trim().length < 8) {
    throw new ApiError(400, 'A valid idempotency key is required.', 'INVALID_IDEMPOTENCY_KEY');
  }

  const requestHash = hashPayload(payload);
  const currentTime = Date.now();
  const expiresAt = currentTime + ttlMs;

  // Clean expired records occasionally
  if (Math.random() < 0.05) {
    db.prepare('DELETE FROM idempotency_records WHERE expires_at <= ?').run(currentTime);
  }

  // Check for existing record
  const existing = one(
    db,
    'SELECT * FROM idempotency_records WHERE scope=? AND key=?',
    scope,
    key
  );

  if (existing) {
    // If expired, clean up and re-claim
    if (Number(existing.expires_at) <= currentTime) {
      db.prepare('DELETE FROM idempotency_records WHERE id=?').run(String(existing.id));
    } else {
      // Check for payload mismatch (Fingerprint mismatch)
      if (String(existing.request_hash) !== requestHash) {
        throw new ApiError(
          409,
          'This idempotency key was previously used with a different request payload or cart contents.',
          'IDEMPOTENCY_PAYLOAD_MISMATCH'
        );
      }

      // Check if already in progress
      if (existing.status === 'processing') {
        throw new ApiError(
          409,
          'A request with this idempotency key is currently being processed. Please wait for it to complete.',
          'OPERATION_IN_PROGRESS'
        );
      }

      // If completed, return cached response
      if (existing.status === 'completed' && existing.response_body) {
        return {
          status: Number(existing.response_status || 200),
          body: JSON.parse(String(existing.response_body)) as T,
          replayed: true,
        };
      }
    }
  }

  // Atomically claim the operation with status = 'processing'
  const recordId = randomUUID();
  try {
    db.prepare(`
      INSERT INTO idempotency_records (id, key, scope, request_hash, status, expires_at, created_at)
      VALUES (?, ?, ?, ?, 'processing', ?, ?)
      ON CONFLICT(scope, key) DO UPDATE SET
        status = CASE WHEN expires_at <= excluded.expires_at THEN 'processing' ELSE status END,
        request_hash = excluded.request_hash,
        expires_at = excluded.expires_at
      WHERE expires_at <= ?
    `).run(recordId, key, scope, requestHash, expiresAt, now(), currentTime);
  } catch (err: unknown) {
    if (err instanceof Error && /UNIQUE constraint failed/.test(err.message)) {
      throw new ApiError(
        409,
        'A request with this idempotency key is currently processing or already claimed.',
        'OPERATION_IN_PROGRESS'
      );
    }
    throw err;
  }

  // Execute the underlying business logic
  try {
    const result = await action();

    // Mark as completed and persist response
    db.prepare(`
      UPDATE idempotency_records
      SET status = 'completed', response_status = ?, response_body = ?
      WHERE scope = ? AND key = ?
    `).run(result.status, JSON.stringify(result.body), scope, key);

    return {
      status: result.status,
      body: result.body,
      replayed: false,
    };
  } catch (error) {
    // On failure, release or mark failed so user can safely retry
    db.prepare(`
      UPDATE idempotency_records
      SET status = 'failed'
      WHERE scope = ? AND key = ?
    `).run(scope, key);
    throw error;
  }
}
