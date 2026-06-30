import type { APIRoute } from 'astro';
import { getArticles, getProjects } from '../lib/content';

function escapeXml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function urlEntry(origin: string, path: string, lastmod?: string) {
  const loc = escapeXml(new URL(path, origin).toString());
  const mod = lastmod ? `<lastmod>${escapeXml(lastmod)}</lastmod>` : '';
  return `<url><loc>${loc}</loc>${mod}</url>`;
}

export const GET: APIRoute = async ({ url }) => {
  const articles = await getArticles();
  const projects = await getProjects();
  const today = new Date().toISOString().slice(0, 10);
  const paths = ['/', '/developing', '/projects', '/tools', '/resume'];

  const body = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...paths.map((path) => urlEntry(url.origin, path, today)),
    ...projects.map((project) => urlEntry(url.origin, `/project/${project.slug}`, today)),
    ...articles.map((article) => urlEntry(url.origin, `/articles/${article.slug}`, article.date)),
    '</urlset>'
  ].join('');

  return new Response(body, {
    headers: {
      'content-type': 'application/xml; charset=utf-8',
      'cache-control': 'public, max-age=3600'
    }
  });
};
