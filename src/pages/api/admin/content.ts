import type { APIRoute } from 'astro';
import { requireAuth } from '../../../lib/auth';
import { getArticles, getContentVersion, getProjects, getSettings, saveArticles, saveProjects, saveSettings, touchContentVersion } from '../../../lib/content';
import { validateContentPayload } from '../../../lib/validation';

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
  const rejected = requireAuth(context);
  if (rejected) return rejected;

  return json({
    settings: await getSettings(),
    projects: await getProjects(),
    articles: await getArticles({ includeDrafts: true }),
    version: await getContentVersion()
  });
};

export const POST: APIRoute = async (context) => {
  const rejected = requireAuth(context);
  if (rejected) return rejected;

  const body = await context.request.json().catch(() => ({}));
  const result = validateContentPayload(body);
  if (!result.ok || !result.value) {
    return json({ error: '内容校验失败', details: result.errors }, 400);
  }

  try {
    if (result.value.settings) await saveSettings(result.value.settings);
    if (result.value.projects) await saveProjects(result.value.projects);
    if (result.value.articles) await saveArticles(result.value.articles);
    const version = await touchContentVersion();

    return json({ ok: true, version });
  } catch {
    return json({ error: '保存失败，请检查服务器文件权限或磁盘空间' }, 500);
  }
};
