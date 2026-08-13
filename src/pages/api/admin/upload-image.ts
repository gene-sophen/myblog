import type { APIRoute } from 'astro';
import { requireAuth, requireSameOrigin } from '../../../lib/auth';
import {
  listMediaFiles,
  maxMediaBatchFiles,
  maxMediaBatchSize,
  MediaValidationError,
  normalizeMediaFolder,
  storeMediaFile
} from '../../../lib/media';

function json(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store'
    }
  });
}

export const GET: APIRoute = async (context) => {
  const rejected = await requireAuth(context);
  if (rejected) return rejected;

  try {
    const images = await listMediaFiles();
    return json({ ok: true, images });
  } catch {
    return json({ error: '读取图片库失败，请检查媒体目录权限' }, 500);
  }
};

export const POST: APIRoute = async (context) => {
  const originRejected = requireSameOrigin(context);
  if (originRejected) return originRejected;

  const rejected = await requireAuth(context);
  if (rejected) return rejected;

  const formData = await context.request.formData().catch(() => undefined);
  if (!formData) return json({ error: '无法读取上传内容' }, 400);

  const files = [
    ...formData.getAll('images'),
    ...formData.getAll('image')
  ].filter((value): value is File => value instanceof File && value.size > 0);

  if (!files.length) return json({ error: '请选择需要上传的图片' }, 400);
  if (files.length > maxMediaBatchFiles) return json({ error: `每次最多上传 ${maxMediaBatchFiles} 张图片` }, 400);
  if (files.reduce((total, file) => total + file.size, 0) > maxMediaBatchSize) {
    return json({ error: '单次上传总大小不能超过 50MB' }, 400);
  }

  const folder = normalizeMediaFolder(String(formData.get('folder') || formData.get('articleSlug') || 'library'));
  const uploaded = [];
  const errors = [];

  for (const file of files) {
    try {
      uploaded.push(await storeMediaFile(file, folder));
    } catch (error) {
      const message = error instanceof MediaValidationError ? error.message : '写入失败，请检查磁盘空间或目录权限';
      errors.push({ fileName: file.name, message });
    }
  }

  const first = uploaded[0];
  return json({
    ok: uploaded.length > 0,
    path: first?.url,
    images: uploaded,
    errors
  }, uploaded.length ? 200 : 400);
};
