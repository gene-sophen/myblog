import { createReadStream, promises as fs } from 'node:fs';
import { Readable } from 'node:stream';
import path from 'node:path';
import type { APIRoute } from 'astro';
import { getMediaDirectory, mediaMimeType } from '../../lib/media';

function notFound() {
  return new Response('Not found', {
    status: 404,
    headers: { 'cache-control': 'no-store' }
  });
}

export const GET: APIRoute = async ({ params }) => {
  const rawPath = params.path || '';
  const segments = rawPath.split('/').filter(Boolean);
  if (!segments.length || segments.some((segment) => segment === '.' || segment === '..' || segment.includes('\\'))) return notFound();

  const root = getMediaDirectory();
  const requestedPath = path.resolve(root, ...segments);
  if (!requestedPath.startsWith(`${root}${path.sep}`)) return notFound();

  const mimeType = mediaMimeType(requestedPath);
  if (!mimeType) return notFound();

  try {
    const [realRoot, realFile, stat] = await Promise.all([
      fs.realpath(root),
      fs.realpath(requestedPath),
      fs.stat(requestedPath)
    ]);
    if (!stat.isFile() || !realFile.startsWith(`${realRoot}${path.sep}`)) return notFound();

    const stream = Readable.toWeb(createReadStream(realFile));
    return new Response(stream as ReadableStream, {
      headers: {
        'content-type': mimeType,
        'content-length': String(stat.size),
        'cache-control': 'public, max-age=86400',
        'x-content-type-options': 'nosniff'
      }
    });
  } catch {
    return notFound();
  }
};
