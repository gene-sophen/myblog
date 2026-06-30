import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { Article, Project, Settings } from './types';

const root = process.cwd();
const dataDir = path.join(root, 'data');
const backupDir = path.join(dataDir, '.backups');
const backupLimit = 5;

async function readJson<T>(fileName: string, fallback: T): Promise<T> {
  const filePath = path.join(dataDir, fileName);
  try {
    const raw = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(raw) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return fallback;
    console.error(`Failed to read ${filePath}`, error);
    throw error;
  }
}

async function writeJson<T>(fileName: string, value: T) {
  await fs.mkdir(dataDir, { recursive: true });
  const filePath = path.join(dataDir, fileName);
  const tmpPath = path.join(dataDir, `${fileName}.${process.pid}.${Date.now()}.tmp`);
  const body = `${JSON.stringify(value, null, 2)}\n`;

  await backupJson(filePath, fileName);
  await fs.writeFile(tmpPath, body, 'utf-8');
  await fs.rename(tmpPath, filePath);
}

async function backupJson(filePath: string, fileName: string) {
  try {
    await fs.access(filePath);
  } catch {
    return;
  }

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
  });
}

export async function touchContentVersion() {
  const next = {
    version: Date.now(),
    updatedAt: new Date().toISOString()
  };
  await writeJson('content-version.json', next);
  return next;
}

export async function getSettings() {
  return readJson<Settings>('settings.json', {
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
  });
}

export async function saveSettings(settings: Settings) {
  await writeJson('settings.json', settings);
}

export async function getProjects() {
  const projects = await readJson<Project[]>('projects.json', []);
  return [...projects].sort((a, b) => Number(b.featured) - Number(a.featured) || a.name.localeCompare(b.name));
}

export async function saveProjects(projects: Project[]) {
  await writeJson('projects.json', projects);
}

export async function getArticles() {
  const articles = await readJson<Article[]>('articles.json', []);
  return [...articles].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

export async function saveArticles(articles: Article[]) {
  await writeJson('articles.json', articles);
}

export async function getArticle(slug: string) {
  const articles = await getArticles();
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
