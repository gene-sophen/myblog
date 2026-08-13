# Media Library and Content Backup Design

## Scope

The admin studio gains a media-library workspace for uploading and reusing local images. It also gains a one-click ZIP backup containing only Markdown content and uploaded images. Source code, dependencies, environment files, sessions, generated backups, and other server files are never included.

## Storage and URLs

Images are stored below `MEDIA_DIR`, falling back to `public/images/articles` for compatibility with existing deployments. The media library accepts jpg, png, webp, and gif files. Each upload is limited to 5 MB, a batch is limited to 20 files and 50 MB, and both MIME type and file signature are validated. Folder names and file names are normalized by the server, name collisions receive a numeric suffix, and writes use exclusive creation.

Images are served through `/media/<path>`. The public route resolves and verifies the real file path before reading it, rejects traversal and symlink escapes, and serves only supported image formats. Existing `/images/articles/...` Markdown references continue to work.

## Admin Experience

The left navigation includes a dedicated media workspace. It provides a batch file picker, drag-and-drop upload area, optional group name, search, refresh, image previews, file metadata, and actions to copy either the stable URL or ready-to-paste Markdown syntax. The first version intentionally omits deletion to avoid accidental data loss.

## Backup

The authenticated backup endpoint streams a ZIP archive rather than buffering it in memory. It recursively includes only `.md` files from `CONTENT_DIR` and supported images from `MEDIA_DIR`, skipping symlinks and hidden content directories such as `.backups` and `.system`. The archive also contains a generated manifest and a short restore note. No `.env`, session data, source files, or package files can enter the archive.

## Failure Handling

Authentication and same-origin checks protect admin APIs. Invalid files produce per-file errors without discarding successful files in the same batch. Empty libraries render an explicit empty state. Backup traversal errors fail before download begins when possible; stream errors terminate the response without exposing local paths.

## Verification

- Build and type-check the Astro application.
- Exercise unauthenticated and authenticated media endpoints against isolated content and media directories.
- Upload valid and invalid files and verify generated URLs.
- Download and inspect a ZIP to confirm its allowlist and exclusions.
- Check the media workspace at desktop and mobile widths without writing to personal content.
