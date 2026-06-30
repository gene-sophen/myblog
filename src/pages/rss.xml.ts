import type { APIRoute } from 'astro';
import { articleKindLabel, getArticles, getSettings } from '../lib/content';

function escapeXml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

export const GET: APIRoute = async ({ url }) => {
  const settings = await getSettings();
  const articles = await getArticles();
  const siteUrl = new URL('/', url.origin).toString();

  const items = articles.slice(0, 20).map((article) => {
    const link = new URL(`/articles/${article.slug}`, url.origin).toString();
    return [
      '<item>',
      `<title>${escapeXml(article.title)}</title>`,
      `<link>${escapeXml(link)}</link>`,
      `<guid>${escapeXml(link)}</guid>`,
      `<description>${escapeXml(article.excerpt)}</description>`,
      `<category>${escapeXml(articleKindLabel(article.kind))}</category>`,
      `<pubDate>${new Date(`${article.date}T00:00:00.000Z`).toUTCString()}</pubDate>`,
      '</item>'
    ].join('');
  }).join('');

  const body = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0">',
    '<channel>',
    `<title>${escapeXml(settings.siteTitle)}</title>`,
    `<link>${escapeXml(siteUrl)}</link>`,
    `<description>${escapeXml(settings.bio || settings.siteSubtitle)}</description>`,
    `<lastBuildDate>${new Date().toUTCString()}</lastBuildDate>`,
    items,
    '</channel>',
    '</rss>'
  ].join('');

  return new Response(body, {
    headers: {
      'content-type': 'application/rss+xml; charset=utf-8',
      'cache-control': 'public, max-age=3600'
    }
  });
};
