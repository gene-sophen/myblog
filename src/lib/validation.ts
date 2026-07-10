import type { Article, ArticleKind, Project, ProjectStatus, Settings } from './types';

const articleKinds: ArticleKind[] = ['spec', 'devlog', 'tool', 'interview', 'job', 'resume', 'essay'];
const projectStatuses: ProjectStatus[] = ['ongoing', 'archived'];
const articleStatuses = ['draft', 'published'];
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export interface ContentPayload {
  settings?: Settings;
  projects?: Project[];
  articles?: Article[];
}

export interface ValidationResult<T> {
  ok: boolean;
  value?: T;
  errors: string[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function text(value: unknown, maxLength: number, field: string, errors: string[], required = false) {
  const next = typeof value === 'string' ? value.trim() : '';
  if (required && !next) errors.push(`${field} 不能为空`);
  if (next.length > maxLength) errors.push(`${field} 不能超过 ${maxLength} 个字符`);
  return next;
}

function optionalSlug(value: unknown, field: string, errors: string[]) {
  const next = text(value, 80, field, errors);
  if (next && !slugPattern.test(next)) errors.push(`${field} 只能使用小写字母、数字和短横线`);
  return next;
}

function requiredSlug(value: unknown, field: string, errors: string[]) {
  const next = optionalSlug(value, field, errors);
  if (!next) errors.push(`${field} 不能为空`);
  return next;
}

function textList(value: unknown, maxItems: number, maxLength: number, field: string, errors: string[]) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => text(item, maxLength, field, errors))
    .filter(Boolean)
    .slice(0, maxItems);
}

function dateText(value: unknown, field: string, errors: string[]) {
  const next = text(value, 10, field, errors, true);
  const timestamp = Date.parse(`${next}T00:00:00.000Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(next) || Number.isNaN(timestamp)) {
    errors.push(`${field} 必须是 YYYY-MM-DD 格式`);
  }
  return next;
}

function uniqueSlugs(items: { slug: string }[], field: string, errors: string[]) {
  const seen = new Set<string>();
  for (const item of items) {
    if (seen.has(item.slug)) errors.push(`${field} 存在重复 slug：${item.slug}`);
    seen.add(item.slug);
  }
}

export function validateSettings(value: unknown): ValidationResult<Settings> {
  const errors: string[] = [];
  if (!isRecord(value)) return { ok: false, errors: ['站点设置格式不正确'] };

  const settings: Settings = {
    siteTitle: text(value.siteTitle, 80, '站点名称', errors, true),
    siteSubtitle: text(value.siteSubtitle, 120, '站点副标题', errors),
    ownerName: text(value.ownerName, 80, '博主姓名', errors, true),
    ownerInitial: text(value.ownerInitial, 2, '头像标识', errors, true).toUpperCase(),
    identity: text(value.identity, 120, '身份标签', errors),
    bio: text(value.bio, 600, '博客简介', errors),
    status: text(value.status, 300, '状态播报', errors),
    github: text(value.github, 240, 'GitHub', errors),
    email: text(value.email, 160, '邮箱', errors),
    location: text(value.location, 80, '位置', errors),
    adminTitle: text(value.adminTitle, 80, '后台标题', errors, true)
  };

  if (settings.github && !/^https:\/\/github\.com\/[\w.-]+\/?$/i.test(settings.github)) {
    errors.push('GitHub 必须是有效的 GitHub 主页链接');
  }
  if (settings.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(settings.email)) {
    errors.push('邮箱格式不正确');
  }

  return { ok: errors.length === 0, value: settings, errors };
}

export function validateProjects(value: unknown): ValidationResult<Project[]> {
  const errors: string[] = [];
  if (!Array.isArray(value)) return { ok: false, errors: ['项目列表格式不正确'] };

  const projects = value.map((item, index) => {
    if (!isRecord(item)) {
      errors.push(`第 ${index + 1} 个项目格式不正确`);
      item = {};
    }
    const status = projectStatuses.includes(item.status as ProjectStatus) ? item.status as ProjectStatus : 'ongoing';
    if (!projectStatuses.includes(item.status as ProjectStatus)) errors.push(`第 ${index + 1} 个项目生命周期不正确`);

    const rawProgress = Array.isArray(item.progress) ? item.progress : [];
    const progress = rawProgress
      .map((progressItem: unknown, progressIndex: number) => {
        const progressRecord = isRecord(progressItem) ? progressItem : {};
        if (!isRecord(progressItem)) errors.push(`第 ${index + 1} 个项目的第 ${progressIndex + 1} 个进度项格式不正确`);
        return {
          label: text(progressRecord.label, 40, `第 ${index + 1} 个项目进度名称`, errors, true),
          value: Math.min(100, Math.max(0, Number(progressRecord.value) || 0))
        };
      })
      .filter((progressItem: { label: string; value: number }) => progressItem.label);

    return {
      slug: requiredSlug(item.slug, `第 ${index + 1} 个项目 slug`, errors),
      name: text(item.name, 100, `第 ${index + 1} 个项目名称`, errors, true),
      summary: text(item.summary, 500, `第 ${index + 1} 个项目简介`, errors),
      status,
      statusLabel: text(item.statusLabel, 80, `第 ${index + 1} 个项目状态徽章`, errors),
      tech: textList(item.tech, 24, 40, `第 ${index + 1} 个项目技术栈`, errors),
      progress,
      monthUpdate: text(item.monthUpdate, 800, `第 ${index + 1} 个项目近期进展`, errors),
      releaseNote: text(item.releaseNote, 240, `第 ${index + 1} 个项目发布说明`, errors),
      architecture: textList(item.architecture, 24, 120, `第 ${index + 1} 个项目架构流程`, errors),
      featured: Boolean(item.featured)
    };
  });

  uniqueSlugs(projects, '项目列表', errors);
  return { ok: errors.length === 0, value: projects, errors };
}

export function validateArticles(value: unknown): ValidationResult<Article[]> {
  const errors: string[] = [];
  if (!Array.isArray(value)) return { ok: false, errors: ['文章列表格式不正确'] };

  const articles = value.map((item, index) => {
    if (!isRecord(item)) {
      errors.push(`第 ${index + 1} 篇文章格式不正确`);
      item = {};
    }

    const kind = articleKinds.includes(item.kind as ArticleKind) ? item.kind as ArticleKind : 'essay';
    if (!articleKinds.includes(item.kind as ArticleKind)) errors.push(`第 ${index + 1} 篇文章类型不正确`);
    const status = articleStatuses.includes(item.status as string) ? item.status as Article['status'] : 'draft';
    if (!articleStatuses.includes(item.status as string)) errors.push(`第 ${index + 1} 篇文章发布状态不正确`);
    const lifecycle = item.lifecycle === '' || projectStatuses.includes(item.lifecycle as ProjectStatus)
      ? item.lifecycle as ProjectStatus | ''
      : '';
    if (item.lifecycle !== '' && !projectStatuses.includes(item.lifecycle as ProjectStatus)) {
      errors.push(`第 ${index + 1} 篇文章生命周期不正确`);
    }

    return {
      slug: requiredSlug(item.slug, `第 ${index + 1} 篇文章 slug`, errors),
      title: text(item.title, 140, `第 ${index + 1} 篇文章标题`, errors, true),
      date: dateText(item.date, `第 ${index + 1} 篇文章日期`, errors),
      status,
      kind,
      category: text(item.category, 80, `第 ${index + 1} 篇文章分类`, errors),
      projectSlug: optionalSlug(item.projectSlug, `第 ${index + 1} 篇文章所属项目 slug`, errors),
      lifecycle,
      tags: textList(item.tags, 24, 40, `第 ${index + 1} 篇文章标签`, errors),
      excerpt: text(item.excerpt, 300, `第 ${index + 1} 篇文章摘要`, errors),
      content: text(item.content, 50000, `第 ${index + 1} 篇文章正文`, errors),
      company: text(item.company, 100, `第 ${index + 1} 篇文章公司`, errors),
      position: text(item.position, 100, `第 ${index + 1} 篇文章岗位`, errors)
    };
  });

  uniqueSlugs(articles, '文章列表', errors);
  return { ok: errors.length === 0, value: articles, errors };
}

export function validateContentPayload(value: unknown): ValidationResult<ContentPayload> {
  const errors: string[] = [];
  if (!isRecord(value)) return { ok: false, errors: ['请求内容格式不正确'] };

  const payload: ContentPayload = {};
  if ('settings' in value) {
    const result = validateSettings(value.settings);
    errors.push(...result.errors);
    if (result.value) payload.settings = result.value;
  }
  if ('projects' in value) {
    const result = validateProjects(value.projects);
    errors.push(...result.errors);
    if (result.value) payload.projects = result.value;
  }
  if ('articles' in value) {
    const result = validateArticles(value.articles);
    errors.push(...result.errors);
    if (result.value) payload.articles = result.value;
  }

  return { ok: errors.length === 0, value: payload, errors };
}
