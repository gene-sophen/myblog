import type { APIRoute } from 'astro';

export const GET: APIRoute = async ({ url }) => {
  const sitemap = new URL('/sitemap.xml', url.origin).toString();
  return new Response(`User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /api/\nSitemap: ${sitemap}\n`, {
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'public, max-age=3600'
    }
  });
};
