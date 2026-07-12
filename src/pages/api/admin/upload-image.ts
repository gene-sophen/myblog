import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { APIRoute } from 'astro';
import { requireAuth, requireSameOrigin } from '../../../lib/auth';

const allowedTypes = new Map([
  ['image/jpeg', '.jpg'],
  ['image/png', '.png'],
  ['image/webp', '.webp'],
  ['image/gif', '.gif']
]);

function json(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store'
    }
  });
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/\.[^.]+$/, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function hasValidImageSignature(type: string, buffer: Buffer) {
  if (type === 'image/jpeg') return buffer.length > 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  if (type === 'image/png') return buffer.length > 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (type === 'image/gif') return buffer.length > 6 && ['GIF87a', 'GIF89a'].includes(buffer.subarray(0, 6).toString('ascii'));
  if (type === 'image/webp') {
    return buffer.length > 12
      && buffer.subarray(0, 4).toString('ascii') === 'RIFF'
      && buffer.subarray(8, 12).toString('ascii') === 'WEBP';
  }
  return false;
}

export const POST: APIRoute = async (context) => {
  const originRejected = requireSameOrigin(context);
  if (originRejected) return originRejected;

  const rejected = await requireAuth(context);
  if (rejected) return rejected;

  const formData = await context.request.formData().catch(() => undefined);
  const file = formData?.get('image');
  const articleSlug = slugify(String(formData?.get('articleSlug') || 'general')) || 'general';
  if (!(file instanceof File)) return json({ error: '请上传图片文件' }, 400);
  if (!allowedTypes.has(file.type)) return json({ error: '仅支持 jpg、png、webp、gif 图片' }, 400);
  if (file.size > 5 * 1024 * 1024) return json({ error: '图片不能超过 5MB' }, 400);

  const buffer = Buffer.from(await file.arrayBuffer());
  if (!hasValidImageSignature(file.type, buffer)) return json({ error: '图片文件格式与扩展信息不匹配' }, 400);

  const ext = allowedTypes.get(file.type) ?? path.extname(file.name).toLowerCase();
  const baseName = slugify(file.name) || `image-${Date.now()}`;
  const dir = path.join(process.cwd(), 'public', 'images', 'articles', articleSlug);
  await fs.mkdir(dir, { recursive: true });

  let fileName = `${baseName}${ext}`;
  let filePath = path.join(dir, fileName);
  let counter = 2;
  while (true) {
    try {
      await fs.access(filePath);
      fileName = `${baseName}-${counter}${ext}`;
      filePath = path.join(dir, fileName);
      counter += 1;
    } catch {
      break;
    }
  }

  await fs.writeFile(filePath, buffer);

  return json({
    ok: true,
    path: `/images/articles/${articleSlug}/${fileName}`
  });
};
