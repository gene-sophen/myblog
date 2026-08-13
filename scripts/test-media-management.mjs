import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const testRoot = await mkdtemp(path.join(tmpdir(), 'codepulse-media-test-'));
const mediaDir = path.join(testRoot, 'media');
const contentDir = path.join(testRoot, 'content');

try {
  await Promise.all([
    mkdir(path.join(mediaDir, 'source'), { recursive: true }),
    mkdir(path.join(contentDir, 'articles'), { recursive: true })
  ]);
  await writeFile(path.join(mediaDir, 'source', 'sample.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]));
  await writeFile(path.join(contentDir, 'articles', 'test-article.md'), [
    '---',
    'slug: "test-article"',
    'title: "Test article"',
    '---',
    '',
    '![Sample](/media/source/sample.png)',
    ''
  ].join('\n'));

  process.env.MEDIA_DIR = mediaDir;
  process.env.CONTENT_DIR = contentDir;

  const {
    deleteMediaFile,
    getMediaFile,
    MediaValidationError,
    moveMediaFile
  } = await import('../src/lib/media.ts');
  const {
    findArticleMediaReferences,
    replaceArticleMediaReferences
  } = await import('../src/lib/content.ts');

  const references = await findArticleMediaReferences('/media/source/sample.png');
  if (references.length !== 1 || references[0].slug !== 'test-article') throw new Error('Reference scan failed');

  const moved = await moveMediaFile('source/sample.png', 'renamed image', 'gallery');
  if (moved.item.relativePath !== 'gallery/renamed-image.png') throw new Error('Rename or regroup failed');
  await replaceArticleMediaReferences(moved.previousUrl, moved.item.url);

  const markdown = await readFile(path.join(contentDir, 'articles', 'test-article.md'), 'utf-8');
  if (!markdown.includes('/media/gallery/renamed-image.png')) throw new Error(`Reference update failed:\n${markdown}`);

  let traversalBlocked = false;
  try {
    await getMediaFile('../outside.png');
  } catch (error) {
    traversalBlocked = error instanceof MediaValidationError;
  }
  if (!traversalBlocked) throw new Error('Path traversal was not blocked');

  await writeFile(path.join(mediaDir, 'gallery', 'existing.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]));
  let conflictBlocked = false;
  try {
    await moveMediaFile(moved.item.relativePath, 'existing', 'gallery');
  } catch (error) {
    conflictBlocked = error instanceof MediaValidationError;
  }
  if (!conflictBlocked) throw new Error('Existing destination was not blocked');

  const updatedReferences = await findArticleMediaReferences(moved.item.url);
  if (updatedReferences.length !== 1) throw new Error('Updated reference scan failed');
  await replaceArticleMediaReferences(moved.item.url, '/media/gallery/replacement.png');
  await deleteMediaFile(moved.item.relativePath);

  let deleted = false;
  try {
    await getMediaFile(moved.item.relativePath);
  } catch (error) {
    deleted = error instanceof MediaValidationError;
  }
  if (!deleted) throw new Error('Delete failed');

  console.log('Isolated media lifecycle checks passed.');
} finally {
  if (path.basename(testRoot).startsWith('codepulse-media-test-')) {
    await rm(testRoot, { recursive: true, force: true });
  }
}
