# Media Management Design

## Goal

Keep production Markdown and uploaded images outside the Git checkout, and let an authenticated administrator rename, regroup, and delete uploaded images without silently breaking article pages.

## Behavior

- Renaming preserves the image extension and normalizes the requested base name.
- Moving uses the same folder normalization as uploads and rejects an existing destination.
- Rename and move operations update exact Markdown image references in all article files. Existing Markdown backups are created before each article write.
- If article reference updates fail, the image move is rolled back.
- Deletion scans article Markdown first and returns a conflict with the referencing article names when the image is still in use.
- Every mutation requires a valid administrator session and same-origin request.
- Resolved source and destination paths must remain inside `MEDIA_DIR`; symbolic-link escapes and unsupported extensions are rejected.

## Deployment Safety

Production sets `CONTENT_DIR=/opt/gene-blog/content` and `MEDIA_DIR=/opt/gene-blog/uploads/articles`. Routine updates archive both directories before pulling code. No update command copies starter content over those directories or deletes files from them.
