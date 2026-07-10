import { promises as fs } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const dataDir = path.join(root, 'data');
const contentDir = path.join(root, 'content');

function quoteYaml(value) {
  return JSON.stringify(String(value ?? ''));
}

function frontmatter(data) {
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

function markdownList(items) {
  return items?.length ? items.map((item) => `- ${item}`).join('\n') : '- ';
}

async function readJson(fileName, fallback) {
  try {
    return JSON.parse(await fs.readFile(path.join(dataDir, fileName), 'utf-8'));
  } catch (error) {
    if (error.code === 'ENOENT') return fallback;
    throw error;
  }
}

async function writeMarkdown(filePath, data, body) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${frontmatter(data)}${String(body ?? '').trim()}\n`, 'utf-8');
}

const settings = await readJson('settings.json', {});
await writeMarkdown(path.join(contentDir, 'settings.md'), {
  siteTitle: settings.siteTitle,
  siteSubtitle: settings.siteSubtitle,
  ownerName: settings.ownerName,
  ownerInitial: settings.ownerInitial,
  identity: settings.identity,
  github: settings.github,
  email: settings.email,
  location: settings.location,
  adminTitle: settings.adminTitle
}, `## 博客简介

${settings.bio ?? ''}

## 状态播报

${settings.status ?? ''}`);

const projects = await readJson('projects.json', []);
for (const project of projects) {
  await writeMarkdown(path.join(contentDir, 'projects', `${project.slug}.md`), {
    slug: project.slug,
    name: project.name,
    status: project.status,
    statusLabel: project.statusLabel,
    tech: project.tech ?? [],
    progress: (project.progress ?? []).map((item) => `${item.label}:${item.value}`),
    releaseNote: project.releaseNote,
    featured: Boolean(project.featured)
  }, `## 项目简介

${project.summary ?? ''}

## 近期进展

${project.monthUpdate ?? ''}

## 架构流程

${markdownList(project.architecture ?? [])}`);
}

const articles = await readJson('articles.json', []);
for (const article of articles) {
  await writeMarkdown(path.join(contentDir, 'articles', `${article.slug}.md`), {
    slug: article.slug,
    title: article.title,
    date: article.date,
    status: article.status ?? 'published',
    kind: article.kind,
    category: article.category,
    projectSlug: article.projectSlug,
    lifecycle: article.lifecycle,
    tags: article.tags ?? [],
    company: article.company ?? '',
    position: article.position ?? '',
    excerpt: article.excerpt
  }, article.content ?? '');
}

console.log(`Migrated ${articles.length} articles, ${projects.length} projects, and site settings to content/.`);
