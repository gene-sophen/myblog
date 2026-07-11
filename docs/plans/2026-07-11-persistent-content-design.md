# Persistent Content Storage Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Keep deployable application code in Git while keeping articles, site settings, content backups, and uploaded images private and persistent on each environment.

**Architecture:** `CONTENT_DIR` selects the Markdown content root and defaults to the local `content/` directory for compatibility. The repository ignores live content and provides a small `content.example/` starter tree. On the server, `CONTENT_DIR` points outside the Git checkout and `public/images/articles` is a symlink to a persistent image directory, retaining existing public image URLs.

**Tech Stack:** Astro 7, Node.js filesystem APIs, Git, PM2, Linux symlinks.

---

### Task 1: Make the content root configurable

**Files:**
- Modify: `src/lib/content.ts`
- Test: `npm run build`

1. Resolve `CONTENT_DIR` as an absolute path, using `content/` when the variable is unset.
2. Keep Markdown articles, projects, settings, backups, and content-version metadata beneath that root.
3. Run the build to validate the server-side TypeScript code.

### Task 2: Separate live content from repository fixtures

**Files:**
- Modify: `.gitignore`
- Create: `content.example/settings.md`
- Create: `content.example/projects/example-project.md`
- Create: `content.example/articles/example-article.md`

1. Ignore live `content/`, dynamic legacy metadata, and `public/images/articles/`; retain read-only JSON fixtures only as a compatibility fallback.
2. Keep a minimal non-personal Markdown starter tree in `content.example/`.
3. Remove previously tracked live content and mutable data from Git's index while retaining the local files.

### Task 3: Document non-destructive server migration

**Files:**
- Modify: `README.md`

1. Document a backup-first migration from an existing checkout.
2. Document `CONTENT_DIR`, a persistent upload directory, and the image symlink.
3. Document the normal deploy command sequence and rollback location.

### Task 4: Verify repository and runtime behavior

**Files:**
- Test: `npm run build`
- Test: `git diff --check`

1. Build the application with default local content.
2. Build it with a temporary external `CONTENT_DIR` to validate path configuration.
3. Confirm ignored live content does not appear in Git status and starter fixtures remain tracked.
