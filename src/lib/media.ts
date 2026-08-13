import { promises as fs } from 'node:fs';
import path from 'node:path';

export const maxMediaFileSize = 5 * 1024 * 1024;
export const maxMediaBatchFiles = 20;
export const maxMediaBatchSize = 50 * 1024 * 1024;

const mediaTypes = new Map([
  ['image/jpeg', { extension: '.jpg', mimeType: 'image/jpeg' }],
  ['image/png', { extension: '.png', mimeType: 'image/png' }],
  ['image/webp', { extension: '.webp', mimeType: 'image/webp' }],
  ['image/gif', { extension: '.gif', mimeType: 'image/gif' }]
]);

const extensionTypes = new Map([
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.png', 'image/png'],
  ['.webp', 'image/webp'],
  ['.gif', 'image/gif']
]);

export interface MediaItem {
  name: string;
  folder: string;
  relativePath: string;
  url: string;
  size: number;
  modifiedAt: string;
}

export class MediaValidationError extends Error {}

export function getMediaDirectory() {
  const configured = process.env.MEDIA_DIR?.trim();
  return path.resolve(configured || path.join(process.cwd(), 'public', 'images', 'articles'));
}

export function mediaMimeType(filePath: string) {
  return extensionTypes.get(path.extname(filePath).toLowerCase());
}

export function isSupportedMediaPath(filePath: string) {
  return Boolean(mediaMimeType(filePath));
}

export function normalizeMediaFolder(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'library';
}

function normalizeFileBase(value: string) {
  return value
    .normalize('NFKC')
    .toLowerCase()
    .replace(/\.[^.]+$/, '')
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100) || `image-${Date.now()}`;
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

function relativeMediaUrl(relativePath: string) {
  return `/media/${relativePath.split(path.sep).map(encodeURIComponent).join('/')}`;
}

async function mediaItem(filePath: string, root: string): Promise<MediaItem> {
  const stat = await fs.stat(filePath);
  const relativePath = path.relative(root, filePath);
  const folder = path.dirname(relativePath) === '.' ? '' : path.dirname(relativePath).split(path.sep).join('/');
  return {
    name: path.basename(filePath),
    folder,
    relativePath: relativePath.split(path.sep).join('/'),
    url: relativeMediaUrl(relativePath),
    size: stat.size,
    modifiedAt: stat.mtime.toISOString()
  };
}

export async function storeMediaFile(file: File, requestedFolder: string): Promise<MediaItem> {
  const type = mediaTypes.get(file.type);
  if (!type) throw new MediaValidationError('仅支持 jpg、png、webp、gif 图片');
  if (file.size <= 0) throw new MediaValidationError('图片文件为空');
  if (file.size > maxMediaFileSize) throw new MediaValidationError('单张图片不能超过 5MB');

  const buffer = Buffer.from(await file.arrayBuffer());
  if (!hasValidImageSignature(file.type, buffer)) throw new MediaValidationError('图片文件格式与扩展信息不匹配');

  const root = getMediaDirectory();
  const folder = normalizeMediaFolder(requestedFolder);
  const directory = path.join(root, folder);
  const baseName = normalizeFileBase(file.name);
  await fs.mkdir(directory, { recursive: true });

  for (let counter = 1; counter <= 10_000; counter += 1) {
    const suffix = counter === 1 ? '' : `-${counter}`;
    const fileName = `${baseName}${suffix}${type.extension}`;
    const filePath = path.join(directory, fileName);
    try {
      await fs.writeFile(filePath, buffer, { flag: 'wx' });
      return mediaItem(filePath, root);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
    }
  }

  throw new Error('无法生成不重复的图片文件名');
}

export async function listMediaFiles(): Promise<MediaItem[]> {
  const root = getMediaDirectory();
  const files: string[] = [];

  async function visit(directory: string) {
    let entries;
    try {
      entries = await fs.readdir(directory, { withFileTypes: true });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return;
      throw error;
    }

    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue;
      const filePath = path.join(directory, entry.name);
      if (entry.isDirectory()) await visit(filePath);
      else if (entry.isFile() && isSupportedMediaPath(filePath)) files.push(filePath);
    }
  }

  await visit(root);
  const items = await Promise.all(files.map((filePath) => mediaItem(filePath, root)));
  return items.sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt) || a.relativePath.localeCompare(b.relativePath));
}
