import { createHash, randomBytes } from 'node:crypto';
import type { RequestHandler, Request, Response } from 'express';
import type { Db } from './database.js';
import { ApiError, type User } from './types.js';
import { one, safeUser, mergeGuestData } from './repository.js';

export type Context = { sessionId: string; owner: string; user: User | null };
export function context(res: Response) { return res.locals.context as Context; }
const cookieName = 'hanbit_session';
const sessionDuration = 14 * 24 * 60 * 60 * 1000;
export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

export function issueSession(db: Db, res: Response, userId: string | null, production: boolean) {
  const token = randomBytes(32).toString('base64url');
  const id = hashToken(token);
  db.prepare('INSERT INTO sessions(id,user_id,expires_at) VALUES (?,?,?)').run(id, userId, Date.now() + sessionDuration);
  res.cookie(cookieName, token, { httpOnly: true, secure: production, sameSite: 'lax', path: '/', maxAge: sessionDuration });
  return id;
}
export function sessionMiddleware(db: Db, production: boolean): RequestHandler {
  let requests = 0;
  return (req, res, next) => {
    if ((['GET', 'HEAD'].includes(req.method) && /^\/(?:products(?:\/|$)|config$|health$)/.test(req.path)) || req.path === '/newsletter') return next();
    const token = req.cookies?.[cookieName] as string | undefined;
    const id = token && /^[a-zA-Z0-9_-]{43}$/.test(token) ? hashToken(token) : '';
    const session = id ? one(db, 'SELECT * FROM sessions WHERE id=? AND expires_at>?', id, Date.now()) : undefined;
    if (++requests % 100 === 0) {
      // Remove abandoned guest data along with expired sessions; customer carts remain attached to their account.
      const expired = db.prepare('SELECT id FROM sessions WHERE expires_at<=?').all(Date.now()) as { id: string }[];
      for (const item of expired) {
        db.prepare('DELETE FROM cart_items WHERE owner=?').run(`guest:${item.id}`);
        db.prepare('DELETE FROM cart_coupons WHERE owner=?').run(`guest:${item.id}`);
        db.prepare('DELETE FROM wishlist WHERE owner=?').run(`guest:${item.id}`);
      }
      db.prepare('DELETE FROM sessions WHERE expires_at<=?').run(Date.now());
    }
    // An untouched visitor does not need a persistent session. Avoid issuing competing
    // cookies when the initial cart, wishlist and account reads run in parallel.
    const sessionId = session ? id : ['GET', 'HEAD', 'OPTIONS'].includes(req.method) ? '' : issueSession(db, res, null, production);
    const userRow = session?.user_id ? one(db, 'SELECT * FROM users WHERE id=?', String(session.user_id)) : undefined;
    const user = userRow ? safeUser(userRow) : null;
    res.locals.context = { sessionId, owner: user ? `user:${user.id}` : `guest:${sessionId || 'unassigned'}`, user } satisfies Context;
    next();
  };
}
export function authenticate(db: Db, res: Response, user: User, production: boolean) {
  const ctx = context(res);
  if (!ctx.user) mergeGuestData(db, ctx.owner, user.id);
  // Session rotation prevents a pre-login guest token from becoming an authenticated credential.
  db.prepare('DELETE FROM sessions WHERE id=?').run(ctx.sessionId);
  const id = issueSession(db, res, user.id, production);
  res.locals.context = { sessionId: id, owner: `user:${user.id}`, user } satisfies Context;
}
export function logout(db: Db, res: Response, production: boolean) {
  db.prepare('DELETE FROM sessions WHERE id=?').run(context(res).sessionId);
  issueSession(db, res, null, production);
}
export const requireUser: RequestHandler = (_req, res, next) => context(res).user ? next() : next(new ApiError(401, 'Sign in to continue.', 'AUTH_REQUIRED'));
export const requireAdmin: RequestHandler = (_req, res, next) => context(res).user?.role === 'admin' ? next() : next(new ApiError(context(res).user ? 403 : 401, 'Administrator access is required.', 'ADMIN_REQUIRED'));

export function originProtection(origins: string[]): RequestHandler {
  const allowed = new Set(origins);
  return (req, _res, next) => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
    const origin = req.get('origin');
    if (!origin || !allowed.has(origin) || req.get('sec-fetch-site') === 'cross-site') return next(new ApiError(403, 'This request must come from the store website.', 'ORIGIN_REJECTED'));
    const hasBody = req.headers['transfer-encoding'] !== undefined || Number(req.get('content-length') || 0) > 0;
    if (hasBody && !req.is('application/json')) return next(new ApiError(415, 'Send a JSON request.', 'JSON_REQUIRED'));
    next();
  };
}
export function rateLimit(max: number, windowMs: number, key: (req: Request) => string = req => req.ip || 'unknown'): RequestHandler {
  const hits = new Map<string, { count: number; expires: number }>();
  return (req, res, next) => {
    const current = Date.now();
    if (hits.size > 5000) for (const [id, item] of hits) if (item.expires <= current) hits.delete(id);
    const id = key(req);
    let hit = hits.get(id);
    if (!hit || hit.expires <= current) { hit = { count: 0, expires: current + windowMs }; hits.set(id, hit); }
    if (++hit.count > max) { res.set('Retry-After', String(Math.ceil((hit.expires - current) / 1000))); return next(new ApiError(429, 'Too many attempts. Please wait a few minutes and try again.', 'RATE_LIMITED')); }
    next();
  };
}
