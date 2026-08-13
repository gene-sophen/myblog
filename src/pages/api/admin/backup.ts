import { promises as fs } from 'node:fs';
import path from 'node:path';
import { PassThrough, Readable } from 'node:stream';
import { ZipArchive } from 'archiver';
import type { APIRoute } from 'astro';
import { requireAuth } from '../../../lib/auth';
import { getContentDirectory } from '../../../lib/content';
import { getMediaDirectory, isSupportedMediaPath } from '../../../lib/media';

interface BackupFile {
  absolutePath: string;
  archivePath: string;
  size: number;
  modifiedAt: string;
}

async function collectFiles(root: string, prefix: string, accept: (filePath: string) => boolean, skipHiddenDirectories = false) {
  const files: BackupFile[] = [];

  async function visit(directory: string) {
    let entries;
    try {
      entries = await fs.readdir(directory, { withFileTypes: true });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return;
      throw error;
    }

    for (const entry of entries) {
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory() && skipHiddenDirectories && entry.name.startsWith('.')) continue;
      const absolutePath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        await visit(absolutePath);
        continue;
      }
      if (!entry.isFile() || !accept(absolutePath)) continue;
      const stat = await fs.stat(absolutePath);
      const relativePath = path.relative(root, absolutePath).split(path.sep).join('/');
      files.push({
        absolutePath,
        archivePath: `${prefix}/${relativePath}`,
        size: stat.size,
        modifiedAt: stat.mtime.toISOString()
      });
    }
  }

  await visit(root);
  return files.sort((a, b) => a.archivePath.localeCompare(b.archivePath));
}

function json(value: unknown, status = 500) {
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
    const [contentFiles, imageFiles] = await Promise.all([
      collectFiles(getContentDirectory(), 'content', (filePath) => path.extname(filePath).toLowerCase() === '.md', true),
      collectFiles(getMediaDirectory(), 'images', isSupportedMediaPath)
    ]);
    const files = [...contentFiles, ...imageFiles];
    const generatedAt = new Date();
    const archiveName = `blog-content-${generatedAt.toISOString().slice(0, 10)}.zip`;
    const archive = new ZipArchive({ zlib: { level: 9 } });
    const output = new PassThrough();

    archive.on('warning', (error: Error) => output.destroy(error));
    archive.on('error', (error: Error) => output.destroy(error));
    archive.pipe(output);

    for (const file of files) archive.file(file.absolutePath, { name: file.archivePath });
    archive.append([
      'CodePulse blog content backup',
      '',
      'content/ contains Markdown settings, projects, and articles.',
      'images/ contains uploaded media files.',
      'Restore these directories only after verifying the target server paths and keeping an additional copy of current data.',
      ''
    ].join('\n'), { name: 'RESTORE.txt' });
    archive.append(JSON.stringify({
      generatedAt: generatedAt.toISOString(),
      markdownFiles: contentFiles.length,
      imageFiles: imageFiles.length,
      totalBytes: files.reduce((total, file) => total + file.size, 0),
      files: files.map(({ archivePath, size, modifiedAt }) => ({ path: archivePath, size, modifiedAt }))
    }, null, 2), { name: 'backup-manifest.json' });

    void archive.finalize().catch((error: Error) => output.destroy(error));
    return new Response(Readable.toWeb(output) as ReadableStream, {
      headers: {
        'content-type': 'application/zip',
        'content-disposition': `attachment; filename="${archiveName}"`,
        'cache-control': 'no-store',
        'x-content-type-options': 'nosniff'
      }
    });
  } catch {
    return json({ error: '生成备份失败，请检查内容目录权限和磁盘空间' });
  }
};
