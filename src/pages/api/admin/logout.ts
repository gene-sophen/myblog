import type { APIRoute } from 'astro';
import { requireSameOrigin, revokeAuthSession } from '../../../lib/auth';

export const POST: APIRoute = async (context) => {
  const originRejected = requireSameOrigin(context);
  if (originRejected) return originRejected;
  await revokeAuthSession(context);
  return new Response(JSON.stringify({ ok: true }), {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store'
    }
  });
};
