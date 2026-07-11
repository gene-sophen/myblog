import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { Article, Project, Settings } from './types';

const root = process.cwd();
const dataDir = path.join(root, 'data');
const backupLimit = 5;
const configuredContentDir = process.env.CONTENT_DIR?.trim();
const contentDir = path.resolve(configuredContentDir || path.join(root, 'content'));
const articlesDir = path.join(contentDir, 'articles');
const projectsDir = path.join(contentDir, 'projects');
const settingsFile = path.join(contentDir, 'settings.md');
const markdownBackupDir = path.join(contentDir, '.backups');
const contentStateDir = path.join(contentDir, '.system');

type FrontmatterValue = string | number | boolean | string[];
type Frontmatter = Record<string, FrontmatterValue>;

const defaultSettings: Settings = {
  siteTitle: 'CodePulse',
  siteSubtitle: '我的技术成长记录',
  ownerName: '你的名字',
  ownerInitial: 'C',
  identity: '技术成长记录',
  bio: '',
  status: '',
  github: '',
  email: '',
  location: '',
  adminTitle: 'CodePulse Studio'
};

function normalizeLineEndings(value = '') {
  return value.replace(/\r\n/g, '\n');
}

function normalizeMarkdownSource(value = '') {
  return normalizeLineEndings(value).replace(/^\uFEFF/, '').trimStart();
}

function slugFromFile(fileName: string) {
  return path.basename(fileName, path.extname(fileName));
}

async function exists(filePath: string) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function parseScalar(value: string): FrontmatterValue {
  const next = value.trim();
  if (next === 'true') return true;
  if (next === 'false') return false;
  if (/^-?\d+(\.\d+)?$/.test(next)) return Number(next);
  if ((next.startsWith('"') && next.endsWith('"')) || (next.startsWith("'") && next.endsWith("'"))) {
    try {
      return JSON.parse(next);
    } catch {
      return next.slice(1, -1);
    }
  }
  return next;
}

function parseFrontmatter(markdown: string) {
  const source = normalizeMarkdownSource(markdown);
  if (!source.startsWith('---\n')) return { data: {} as Frontmatter, body: source.trimStart() };

  const closingMatch = source.slice(4).match(/\n---[ \t]*(?:\n|$)/);
  if (!closingMatch || closingMatch.index === undefined) return { data: {} as Frontmatter, body: source.trimStart() };

  const closingIndex = 4 + closingMatch.index;
  const closingEnd = closingIndex + closingMatch[0].length;
  const rawFrontmatter = source.slice(4, closingIndex).trim();
  const body = source.slice(closingEnd).replace(/^\n/, '');
  const data: Frontmatter = {};
  const lines = rawFrontmatter.split('\n');

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line.trim() || line.trimStart().startsWith('#')) continue;
    if (line.startsWith(' ') || line.startsWith('\t')) continue;

    const match = line.match(/^([A-Za-z][\w-]*):(?:\s*(.*))?$/);
    if (!match) continue;

    const [, key, rawValue = ''] = match;
    if (rawValue.trim()) {
      data[key] = parseScalar(rawValue);
      continue;
    }

    const items: string[] = [];
    while (index + 1 < lines.length && /^\s+-\s+/.test(lines[index + 1])) {
      index += 1;
      items.push(String(parseScalar(lines[index].replace(/^\s+-\s+/, ''))));
    }
    data[key] = items;
  }

  return { data, body };
}

function quoteYaml(value: unknown) {
  return JSON.stringify(String(value ?? ''));
}

function stringifyFrontmatter(data: Frontmatter) {
  const lines = ['---'];
  for (const [key, value] of Object.entries(data)) {
    if (Array.isArray(value)) {
      lines.push(`${key}:`);
      for (const item of value) lines.push(`  - ${quoteYaml(item)}`);
      continue;
    }
    if (typeof value === 'boolean' || typeof value === 'number') {
      lines.push(`${key}: ${value}`);
      continue;
    }
    lines.push(`${key}: ${quoteYaml(value)}`);
  }
  lines.push('---');
  return `${lines.join('\n')}\n\n`;
}

async function readMarkdown(filePath: string) {
  const raw = await fs.readFile(filePath, 'utf-8');
  return parseFrontmatter(raw);
}

async function listMarkdownFiles(dir: string) {
  try {
    const entries = await fs.readdir(dir);
    return entries
      .filter((entry) => entry.endsWith('.md') && !entry.startsWith('_'))
      .sort()
      .map((entry) => path.join(dir, entry));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }
}

async function backupMarkdown(filePath: string) {
  if (!(await exists(filePath))) return;

  await fs.mkdir(markdownBackupDir, { recursive: true });
  const relativeName = path.relative(contentDir, filePath).replace(/[\\/]/g, '__');
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  await fs.copyFile(filePath, path.join(markdownBackupDir, `${relativeName}.${stamp}.bak`));

  const backups = (await fs.readdir(markdownBackupDir))
    .filter((backup) => backup.startsWith(`${relativeName}.`) && backup.endsWith('.bak'))
    .sort()
    .reverse();

  await Promise.all(
    backups.slice(backupLimit).map((backup) => fs.unlink(path.join(markdownBackupDir, backup)).catch(() => undefined))
  );
}

async function writeMarkdown(filePath: string, frontmatter: Frontmatter, body: string) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await backupMarkdown(filePath);
  const tmpPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tmpPath, `${stringifyFrontmatter(frontmatter)}${normalizeLineEndings(body).trim()}\n`, 'utf-8');
  await fs.rename(tmpPath, filePath);
}

async function pruneMarkdownFiles(dir: string, allowedSlugs: Set<string>) {
  const files = await listMarkdownFiles(dir);
  await Promise.all(files.map(async (filePath) => {
    if (allowedSlugs.has(slugFromFile(filePath))) return;
    await backupMarkdown(filePath);
    await fs.unlink(filePath).catch(() => undefined);
  }));
}

function valueAsString(value: unknown) {
  return typeof value === 'string' ? value : value === undefined || value === null ? '' : String(value);
}

function valueAsBoolean(value: unknown) {
  return value === true || value === 'true';
}

function valueAsList(value: unknown) {
  return Array.isArray(value) ? value.map(String).filter(Boolean) : [];
}

function extractSection(body: string, heading: string) {
  const source = normalizeLineEndings(body);
  const pattern = new RegExp(`^##\\s+${heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`, 'm');
  const match = source.match(pattern);
  if (!match || match.index === undefined) return '';
  const start = match.index + match[0].length;
  const rest = source.slice(start).replace(/^\n+/, '');
  const nextHeading = rest.search(/^##\s+/m);
  return (nextHeading === -1 ? rest : rest.slice(0, nextHeading)).trim();
}

function listFromSection(body: string, heading: string) {
  return extractSection(body, heading)
    .split('\n')
    .map((line) => line.trim().replace(/^-\s+/, ''))
    .filter(Boolean);
}

function progressFromList(items: string[]) {
  return items.map((item) => {
    const [label = '', rawValue = '0'] = item.split(':');
    return {
      label: label.trim(),
      value: Math.min(100, Math.max(0, Number(rawValue.trim()) || 0))
    };
  }).filter((item) => item.label);
}

function progressToList(project: Project) {
  return project.progress.map((item) => `${item.label}:${item.value}`);
}

function markdownList(items: string[]) {
  return items.length ? items.map((item) => `- ${item}`).join('\n') : '- ';
}

function projectBody(project: Project) {
  return [
    `## 项目简介\n\n${project.summary}`,
    `## 近期进展\n\n${project.monthUpdate}`,
    `## 架构流程\n\n${markdownList(project.architecture)}`
  ].join('\n\n');
}

function articleFromMarkdown(filePath: string, data: Frontmatter, body: string): Article {
  const slug = valueAsString(data.slug) || slugFromFile(filePath);
  const status = valueAsString(data.status) === 'draft' ? 'draft' : 'published';
  return {
    slug,
    title: valueAsString(data.title) || slug,
    date: valueAsString(data.date),
    status,
    kind: (valueAsString(data.kind) || 'essay') as Article['kind'],
    category: valueAsString(data.category),
    projectSlug: valueAsString(data.projectSlug),
    lifecycle: valueAsString(data.lifecycle) as Article['lifecycle'],
    tags: valueAsList(data.tags),
    excerpt: valueAsString(data.excerpt),
    content: body.trim(),
    company: valueAsString(data.company),
    position: valueAsString(data.position)
  };
}

function projectFromMarkdown(filePath: string, data: Frontmatter, body: string): Project {
  const slug = valueAsString(data.slug) || slugFromFile(filePath);
  return {
    slug,
    name: valueAsString(data.name) || slug,
    status: (valueAsString(data.status) || 'ongoing') as Project['status'],
    statusLabel: valueAsString(data.statusLabel),
    tech: valueAsList(data.tech),
    progress: progressFromList(valueAsList(data.progress)),
    summary: extractSection(body, '项目简介'),
    monthUpdate: extractSection(body, '近期进展'),
    releaseNote: valueAsString(data.releaseNote),
    architecture: listFromSection(body, '架构流程'),
    featured: valueAsBoolean(data.featured)
  };
}

function settingsFromMarkdown(data: Frontmatter, body: string): Settings {
  return {
    ...defaultSettings,
    siteTitle: valueAsString(data.siteTitle) || defaultSettings.siteTitle,
    siteSubtitle: valueAsString(data.siteSubtitle),
    ownerName: valueAsString(data.ownerName) || defaultSettings.ownerName,
    ownerInitial: valueAsString(data.ownerInitial) || defaultSettings.ownerInitial,
    identity: valueAsString(data.identity),
    bio: extractSection(body, '博客简介') || valueAsString(data.bio),
    status: extractSection(body, '状态播报') || valueAsString(data.status),
    github: valueAsString(data.github),
    email: valueAsString(data.email),
    location: valueAsString(data.location),
    adminTitle: valueAsString(data.adminTitle) || defaultSettings.adminTitle
  };
}

async function readJson<T>(fileName: string, fallback: T, dir = dataDir): Promise<T> {
  const filePath = path.join(dir, fileName);
  try {
    const raw = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(raw) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return fallback;
    console.error(`Failed to read ${filePath}`, error);
    throw error;
  }
}

async function writeJson<T>(fileName: string, value: T, dir = dataDir) {
  await fs.mkdir(dir, { recursive: true });
  const filePath = path.join(dir, fileName);
  const tmpPath = path.join(dir, `${fileName}.${process.pid}.${Date.now()}.tmp`);
  const body = `${JSON.stringify(value, null, 2)}\n`;

  await backupJson(filePath, fileName, dir);
  await fs.writeFile(tmpPath, body, 'utf-8');
  await fs.rename(tmpPath, filePath);
}

async function backupJson(filePath: string, fileName: string, dir: string) {
  try {
    await fs.access(filePath);
  } catch {
    return;
  }

  const backupDir = path.join(dir, '.backups');
  await fs.mkdir(backupDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  await fs.copyFile(filePath, path.join(backupDir, `${fileName}.${stamp}.bak`));

  const backups = (await fs.readdir(backupDir))
    .filter((backup) => backup.startsWith(`${fileName}.`) && backup.endsWith('.bak'))
    .sort()
    .reverse();

  await Promise.all(
    backups.slice(backupLimit).map((backup) => fs.unlink(path.join(backupDir, backup)).catch(() => undefined))
  );
}

export async function getContentVersion() {
  return readJson<{ version: number; updatedAt: string }>('content-version.json', {
    version: 0,
    updatedAt: new Date(0).toISOString()
  }, contentStateDir);
}

export async function touchContentVersion() {
  const next = {
    version: Date.now(),
    updatedAt: new Date().toISOString()
  };
  await writeJson('content-version.json', next, contentStateDir);
  return next;
}

export async function getSettings() {
  if (await exists(settingsFile)) {
    const { data, body } = await readMarkdown(settingsFile);
    return settingsFromMarkdown(data, body);
  }
  return readJson<Settings>('settings.json', defaultSettings);
}

export async function saveSettings(settings: Settings) {
  await writeMarkdown(settingsFile, {
    siteTitle: settings.siteTitle,
    siteSubtitle: settings.siteSubtitle,
    ownerName: settings.ownerName,
    ownerInitial: settings.ownerInitial,
    identity: settings.identity,
    github: settings.github,
    email: settings.email,
    location: settings.location,
    adminTitle: settings.adminTitle
  }, `## 博客简介\n\n${settings.bio}\n\n## 状态播报\n\n${settings.status}`);
}

export async function getProjects() {
  const files = await listMarkdownFiles(projectsDir);
  if (files.length) {
    const projects = await Promise.all(files.map(async (filePath) => {
      const { data, body } = await readMarkdown(filePath);
      return projectFromMarkdown(filePath, data, body);
    }));
    return [...projects].sort((a, b) => Number(b.featured) - Number(a.featured) || a.name.localeCompare(b.name));
  }

  const projects = await readJson<Project[]>('projects.json', []);
  return [...projects].sort((a, b) => Number(b.featured) - Number(a.featured) || a.name.localeCompare(b.name));
}

export async function saveProjects(projects: Project[]) {
  await fs.mkdir(projectsDir, { recursive: true });
  await pruneMarkdownFiles(projectsDir, new Set(projects.map((project) => project.slug)));
  await Promise.all(projects.map((project) => writeMarkdown(path.join(projectsDir, `${project.slug}.md`), {
    slug: project.slug,
    name: project.name,
    status: project.status,
    statusLabel: project.statusLabel,
    tech: project.tech,
    progress: progressToList(project),
    releaseNote: project.releaseNote,
    featured: project.featured
  }, projectBody(project))));
}

export async function getArticles(options: { includeDrafts?: boolean } = {}) {
  const files = await listMarkdownFiles(articlesDir);
  if (files.length) {
    const articles = await Promise.all(files.map(async (filePath) => {
      const { data, body } = await readMarkdown(filePath);
      return articleFromMarkdown(filePath, data, body);
    }));
    return [...articles]
      .filter((article) => options.includeDrafts || article.status === 'published')
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }

  const articles = await readJson<Article[]>('articles.json', []);
  return [...articles]
    .map((article) => ({ ...article, status: article.status ?? 'published' }))
    .filter((article) => options.includeDrafts || article.status === 'published')
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

export async function saveArticles(articles: Article[]) {
  await fs.mkdir(articlesDir, { recursive: true });
  await pruneMarkdownFiles(articlesDir, new Set(articles.map((article) => article.slug)));
  await Promise.all(articles.map((article) => writeMarkdown(path.join(articlesDir, `${article.slug}.md`), {
    slug: article.slug,
    title: article.title,
    date: article.date,
    status: article.status,
    kind: article.kind,
    category: article.category,
    projectSlug: article.projectSlug,
    lifecycle: article.lifecycle,
    tags: article.tags,
    company: article.company || '',
    position: article.position || '',
    excerpt: article.excerpt
  }, article.content)));
}

export async function getArticle(slug: string) {
  const articles = await getArticles();
  return articles.find((article) => article.slug === slug);
}

export async function getArticleForPreview(slug: string) {
  const articles = await getArticles({ includeDrafts: true });
  return articles.find((article) => article.slug === slug);
}

export async function getProject(slug: string) {
  const projects = await getProjects();
  return projects.find((project) => project.slug === slug);
}

export function articleKindLabel(kind: string) {
  const labels: Record<string, string> = {
    spec: '说明书',
    devlog: '开发日志',
    tool: '工具箱',
    interview: '面经',
    job: '求职心路',
    resume: '简历经验',
    essay: '随笔'
  };
  return labels[kind] ?? kind;
}

export function getRecentUpdates(articles: Article[], limit = 5) {
  return [...articles].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, limit);
}
