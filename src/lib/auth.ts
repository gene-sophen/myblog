import type { APIContext } from 'astro';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const cookieName = 'codepulse_admin';
const sessionMaxAge = 60 * 60 * 24 * 7;
const defaultPassword = 'admin123';

function isProduction() {
  return import.meta.env.PROD || process.env.NODE_ENV === 'production';
}

export function getAdminPassword() {
  const password = process.env.ADMIN_PASSWORD || '';
  if (isProduction() && (!password || password === defaultPassword)) {
    throw new Error('ADMIN_PASSWORD must be set to a non-default value in production.');
  }
  return password || defaultPassword;
}

function getSessionSecret() {
  const secret = process.env.ADMIN_SESSION_SECRET || '';
  if (isProduction() && secret.length < 32) {
    throw new Error('ADMIN_SESSION_SECRET must be at least 32 characters in production.');
  }
  return secret || `dev-secret:${getAdminPassword()}`;
}

function signSession(payload: string) {
  return createHmac('sha256', getSessionSecret()).update(`${payload}:${getAdminPassword()}`).digest('hex');
}

function safeEqual(a = '', b = '') {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function verifyAdminPassword(password = '') {
  return safeEqual(password, getAdminPassword());
}

function getSessionToken() {
  const issuedAt = Date.now().toString(36);
  const nonce = randomBytes(16).toString('hex');
  const payload = `${issuedAt}.${nonce}`;
  return `${payload}.${signSession(payload)}`;
}

function verifySessionToken(token = '') {
  const [issuedAt, nonce, signature, ...extra] = token.split('.');
  if (!issuedAt || !nonce || !signature || extra.length > 0) return false;

  const issuedAtMs = Number.parseInt(issuedAt, 36);
  if (!Number.isFinite(issuedAtMs)) return false;
  if (Date.now() - issuedAtMs > sessionMaxAge * 1000) return false;

  return safeEqual(signature, signSession(`${issuedAt}.${nonce}`));
}

export function isAuthed(context: Pick<APIContext, 'cookies'>) {
  try {
    return verifySessionToken(context.cookies.get(cookieName)?.value);
  } catch {
    return false;
  }
}

export function requireAuth(context: APIContext) {
  if (!isAuthed(context)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'no-store'
      }
    });
  }
  return null;
}

export function setAuthCookie(context: APIContext) {
  context.cookies.set(cookieName, getSessionToken(), {
    path: '/',
    httpOnly: true,
    sameSite: 'strict',
    secure: import.meta.env.PROD,
    maxAge: sessionMaxAge
  });
}

export function clearAuthCookie(context: APIContext) {
  context.cookies.delete(cookieName, { path: '/' });
}
