import type { APIContext } from 'astro';
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';

const cookieName = 'codepulse_admin';
const sessionMaxAge = 60 * 60 * 12;
const idleSessionAge = 60 * 30;
const defaultPassword = 'admin123';
const root = process.cwd();
const contentDir = path.resolve(process.env.CONTENT_DIR?.trim() || path.join(root, 'content'));
const sessionFile = path.join(contentDir, '.system', 'admin-session.json');

type AuthContext = Pick<APIContext, 'cookies' | 'request'>;
type Session = {
  issuedAt: number;
  lastActiveAt: number;
  id: string;
  userAgentHash: string;
};

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

function userAgentHash(context: AuthContext) {
  return createHash('sha256').update(context.request.headers.get('user-agent') || 'unknown').digest('hex');
}

function serializeSession(session: Session) {
  const payload = [
    session.issuedAt.toString(36),
    session.lastActiveAt.toString(36),
    session.id,
    session.userAgentHash
  ].join('.');
  return `${payload}.${signSession(payload)}`;
}

function parseSession(token = ''): Session | undefined {
  const [issuedAt, lastActiveAt, id, userAgentHash, signature, ...extra] = token.split('.');
  if (!issuedAt || !lastActiveAt || !id || !userAgentHash || !signature || extra.length > 0) return undefined;

  const session = {
    issuedAt: Number.parseInt(issuedAt, 36),
    lastActiveAt: Number.parseInt(lastActiveAt, 36),
    id,
    userAgentHash
  };
  if (!Number.isFinite(session.issuedAt) || !Number.isFinite(session.lastActiveAt)) return undefined;
  if (!safeEqual(signature, signSession([issuedAt, lastActiveAt, id, userAgentHash].join('.')))) return undefined;
  return session;
}

async function activeSessionId() {
  try {
    const value = JSON.parse(await fs.readFile(sessionFile, 'utf-8')) as { id?: unknown };
    return typeof value.id === 'string' ? value.id : undefined;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
    throw error;
  }
}

async function setActiveSession(id: string) {
  await fs.mkdir(path.dirname(sessionFile), { recursive: true, mode: 0o700 });
  const tempFile = `${sessionFile}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tempFile, `${JSON.stringify({ id, updatedAt: new Date().toISOString() })}\n`, {
    encoding: 'utf-8',
    mode: 0o600
  });
  await fs.rename(tempFile, sessionFile);
}

async function clearActiveSession(id?: string) {
  try {
    if (!id || (await activeSessionId()) === id) await fs.unlink(sessionFile);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
}

function setCookie(context: AuthContext, session: Session) {
  context.cookies.set(cookieName, serializeSession(session), {
    path: '/',
    httpOnly: true,
    sameSite: 'strict',
    secure: isProduction(),
    maxAge: sessionMaxAge
  });
}

function unauthorized(context: AuthContext, reason: 'expired' | 'invalid' = 'invalid') {
  clearAuthCookie(context);
  return new Response(JSON.stringify({ error: 'Login required', code: `session_${reason}` }), {
    status: 401,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store'
    }
  });
}

export function verifyAdminPassword(password = '') {
  return safeEqual(password, getAdminPassword());
}

export async function isAuthed(context: AuthContext) {
  try {
    const session = parseSession(context.cookies.get(cookieName)?.value);
    if (!session || !safeEqual(session.userAgentHash, userAgentHash(context))) return false;

    const now = Date.now();
    if (session.issuedAt > now + 5 * 60 * 1000 || session.lastActiveAt > now + 5 * 60 * 1000) return false;
    if (now - session.issuedAt > sessionMaxAge * 1000 || now - session.lastActiveAt > idleSessionAge * 1000) return false;
    return safeEqual(session.id, await activeSessionId());
  } catch {
    return false;
  }
}

export async function requireAuth(context: APIContext) {
  try {
    const token = context.cookies.get(cookieName)?.value;
    const session = parseSession(token);
    if (!session || !safeEqual(session.userAgentHash, userAgentHash(context))) return unauthorized(context, 'invalid');

    const now = Date.now();
    if (session.issuedAt > now + 5 * 60 * 1000 || session.lastActiveAt > now + 5 * 60 * 1000) return unauthorized(context, 'invalid');
    if (now - session.issuedAt > sessionMaxAge * 1000 || now - session.lastActiveAt > idleSessionAge * 1000) {
      return unauthorized(context, 'expired');
    }
    if (!safeEqual(session.id, await activeSessionId())) return unauthorized(context, 'invalid');

    setCookie(context, { ...session, lastActiveAt: now });
    return null;
  } catch {
    return unauthorized(context, 'invalid');
  }
}

export function requireSameOrigin(context: Pick<APIContext, 'request'>) {
  const origin = context.request.headers.get('origin');
  const requestUrl = new URL(context.request.url);
  const expectedOrigins = new Set([requestUrl.origin]);
  const forwardedProtocol = context.request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim().toLowerCase();
  const forwardedHost = context.request.headers.get('x-forwarded-host')?.split(',')[0]?.trim() || requestUrl.host;

  if ((forwardedProtocol === 'http' || forwardedProtocol === 'https') && forwardedHost) {
    try {
      expectedOrigins.add(new URL(`${forwardedProtocol}://${forwardedHost}`).origin);
    } catch {
      // An invalid proxy header is ignored and cannot widen the accepted origins.
    }
  }

  if (origin && expectedOrigins.has(origin)) return null;

  return new Response(JSON.stringify({ error: 'Invalid request origin' }), {
    status: 403,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store'
    }
  });
}

export async function setAuthCookie(context: APIContext) {
  const now = Date.now();
  const session = {
    issuedAt: now,
    lastActiveAt: now,
    id: randomBytes(32).toString('hex'),
    userAgentHash: userAgentHash(context)
  };
  await setActiveSession(session.id);
  setCookie(context, session);
}

export async function revokeAuthSession(context: APIContext) {
  const session = parseSession(context.cookies.get(cookieName)?.value);
  await clearActiveSession(session?.id);
  clearAuthCookie(context);
}

export function clearAuthCookie(context: Pick<APIContext, 'cookies'>) {
  context.cookies.delete(cookieName, { path: '/' });
}
