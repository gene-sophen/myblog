import type { APIRoute } from 'astro';
import { setAuthCookie, verifyAdminPassword } from '../../../lib/auth';

const loginAttempts = new Map<string, { count: number; resetAt: number }>();
const loginWindowMs = 10 * 60 * 1000;
const maxLoginAttempts = 8;

function json(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store'
    }
  });
}

function clientKey(context: Parameters<APIRoute>[0]) {
  const realIp = context.request.headers.get('x-real-ip')?.trim();
  return realIp || context.clientAddress || 'local';
}

function isRateLimited(key: string) {
  const now = Date.now();
  const current = loginAttempts.get(key);
  if (!current || current.resetAt <= now) {
    loginAttempts.set(key, { count: 0, resetAt: now + loginWindowMs });
    return false;
  }
  return current.count >= maxLoginAttempts;
}

function recordFailedAttempt(key: string) {
  const now = Date.now();
  const current = loginAttempts.get(key);
  const next = current && current.resetAt > now
    ? { count: current.count + 1, resetAt: current.resetAt }
    : { count: 1, resetAt: now + loginWindowMs };
  loginAttempts.set(key, next);
}

export const POST: APIRoute = async (context) => {
  const body = await context.request.json().catch(() => ({}));
  const key = clientKey(context);

  if (isRateLimited(key)) {
    return json({ error: '尝试次数过多，请稍后再试' }, 429);
  }

  try {
    if (!verifyAdminPassword(String(body.password || ''))) {
      recordFailedAttempt(key);
      return json({ error: '密码不正确' }, 401);
    }
  } catch {
    return json({ error: '后台登录配置不完整' }, 500);
  }

  loginAttempts.delete(key);
  setAuthCookie(context);
  return json({ ok: true });
};
