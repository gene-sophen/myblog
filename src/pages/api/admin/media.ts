import type { APIRoute } from 'astro';
import { requireAuth, requireSameOrigin } from '../../../lib/auth';
import { findArticleMediaReferences, replaceArticleMediaReferences, touchContentVersion } from '../../../lib/content';
import {
  deleteMediaFile,
  getMediaFile,
  MediaValidationError,
  moveMediaFile,
  restoreMovedMediaFile
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

async function authorize(context: Parameters<APIRoute>[0]) {
  return requireSameOrigin(context) || await requireAuth(context);
}

async function requestBody(request: Request) {
  const body = await request.json().catch(() => undefined);
  return body && typeof body === 'object' ? body as Record<string, unknown> : undefined;
}

export const PATCH: APIRoute = async (context) => {
  const rejected = await authorize(context);
  if (rejected) return rejected;

  const body = await requestBody(context.request);
  const relativePath = typeof body?.relativePath === 'string' ? body.relativePath : '';
  const name = typeof body?.name === 'string' ? body.name.trim() : '';
  const folder = typeof body?.folder === 'string' ? body.folder.trim() : '';
  if (!relativePath || !name || !folder) return json({ error: '图片路径、名称和分组不能为空' }, 400);

  try {
    const moved = await moveMediaFile(relativePath, name, folder);
    if (moved.previousUrl === moved.item.url) return json({ ok: true, image: moved.item, references: [] });

    try {
      const references = await replaceArticleMediaReferences(moved.previousUrl, moved.item.url);
      await touchContentVersion().catch(() => undefined);
      return json({ ok: true, image: moved.item, previousUrl: moved.previousUrl, references });
    } catch {
      await restoreMovedMediaFile(moved.item.relativePath, relativePath).catch(() => undefined);
      return json({ error: '文章引用更新失败，图片位置已回滚，请稍后重试' }, 500);
    }
  } catch (error) {
    if (error instanceof MediaValidationError) return json({ error: error.message }, 400);
    return json({ error: '图片更新失败，请检查媒体目录权限' }, 500);
  }
};

export const DELETE: APIRoute = async (context) => {
  const rejected = await authorize(context);
  if (rejected) return rejected;

  const body = await requestBody(context.request);
  const relativePath = typeof body?.relativePath === 'string' ? body.relativePath : '';
  if (!relativePath) return json({ error: '图片路径无效' }, 400);

  try {
    const image = await getMediaFile(relativePath);
    const references = await findArticleMediaReferences(image.url);
    if (references.length) {
      return json({ error: '图片仍被文章引用，请先移除引用后再删除', references }, 409);
    }
    const deleted = await deleteMediaFile(relativePath);
    return json({ ok: true, deleted });
  } catch (error) {
    if (error instanceof MediaValidationError) return json({ error: error.message }, 400);
    return json({ error: '图片删除失败，请检查媒体目录权限' }, 500);
  }
};
