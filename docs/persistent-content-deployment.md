# Persistent Content Deployment

Application code is deployed from Git. Live content is stored outside the Git checkout so a deployment never replaces articles, site settings, content backups, or uploaded images.

Set both persistent directories explicitly in production:

```dotenv
CONTENT_DIR=/opt/gene-blog/content
MEDIA_DIR=/opt/gene-blog/uploads/articles
```

## Directory layout

```text
/opt/gene-blog/
  app/                 # Git checkout
  content/             # Markdown, settings, backups, admin version metadata
  uploads/articles/    # Images uploaded through the admin UI
```

## Initial migration on an existing server

Run the commands from `/opt/gene-blog/app`. Stop the application first if it is writing content while you migrate.

```bash
tar --ignore-failed-read -C /opt/gene-blog/app -czf /opt/gene-blog-content-before-migration-$(date +%F-%H%M%S).tar.gz data content public/images/articles .env
git stash push -m "content-before-persistent-storage" -- data
git pull
npm ci
mkdir -p /opt/gene-blog/content /opt/gene-blog/uploads
if [ -d content ]; then
  cp -a content/. /opt/gene-blog/content/
fi
printf '\nCONTENT_DIR=/opt/gene-blog/content\nMEDIA_DIR=/opt/gene-blog/uploads/articles\n' >> .env
if [ -d public/images/articles ] && [ ! -L public/images/articles ]; then
  mv public/images/articles /opt/gene-blog/uploads/articles
else
  mkdir -p /opt/gene-blog/uploads/articles
fi
ln -s /opt/gene-blog/uploads/articles public/images/articles
```

`MEDIA_DIR` lets the `/media/...` route read the persistent upload directory directly. The symbolic link remains in the migration commands so older `/images/articles/...` links in existing Markdown continue to work.

The backup contains the latest JSON content written by the old application. Extract it and migrate from that backup into the persistent Markdown directory:

```bash
mkdir -p /opt/gene-blog/recovery
tar -xzf /opt/gene-blog-content-before-migration-<timestamp>.tar.gz -C /opt/gene-blog/recovery
CONTENT_DIR=/opt/gene-blog/content DATA_DIR=/opt/gene-blog/recovery/data node scripts/migrate-json-to-markdown.mjs
```

Then build the application and restart the actual PM2 process name or ID:

```bash
git pull
npm ci
npm run build
pm2 restart <process-name-or-id> --update-env
pm2 save
```

Do not run `git restore data/articles.json` during this migration: that file may contain articles created through the old admin UI. Keep the Git stash until the site has been verified, then remove it with `git stash drop`.

## New environment

Copy the starter content once, then configure `CONTENT_DIR` and `MEDIA_DIR` before starting the app:

```bash
mkdir -p /opt/gene-blog/content /opt/gene-blog/uploads/articles
cp -a content.example/. /opt/gene-blog/content/
ln -s /opt/gene-blog/uploads/articles public/images/articles
printf '\nCONTENT_DIR=/opt/gene-blog/content\nMEDIA_DIR=/opt/gene-blog/uploads/articles\n' >> .env
```

`content/` and `public/images/articles/` are ignored by Git. Back up `/opt/gene-blog/content`, `/opt/gene-blog/uploads`, and `.env` regularly.

## Safe routine update

Before every code update, verify that both live directories are configured outside the Git checkout and create one archive containing articles and images:

```bash
cd /opt/gene-blog/app
grep -E '^(CONTENT_DIR|MEDIA_DIR)=' .env

test "$(grep '^CONTENT_DIR=' .env | cut -d= -f2-)" = "/opt/gene-blog/content"
test "$(grep '^MEDIA_DIR=' .env | cut -d= -f2-)" = "/opt/gene-blog/uploads/articles"

sudo tar -C /opt/gene-blog -czf \
  "/opt/gene-blog/blog-content-before-update-$(date +%F-%H%M%S).tar.gz" \
  content uploads/articles
```

Only continue when both `test` commands succeed. Then update code and restart the actual PM2 process:

```bash
git pull --ff-only
npm ci --no-audit
npm run build
pm2 restart <process-name-or-id> --update-env
pm2 save
```

`git pull` only changes `/opt/gene-blog/app`. The live Markdown under `/opt/gene-blog/content` and images under `/opt/gene-blog/uploads/articles` remain untouched. Do not copy `content.example/` over an existing content directory and do not run `rm`, `git clean`, or `rsync --delete` against either persistent directory during an update.

## Admin content backup

The admin media workspace can stream a ZIP containing the current Markdown files and uploaded images. It is useful for manual snapshots and migration, but it does not replace an automated server backup. The ZIP intentionally excludes `.env`, session data, source code, dependencies, `.backups`, and `.system`. Renaming or moving an image from the media workspace updates matching article Markdown references; deletion is rejected while any article still references the image.

The production Nginx proxy must pass the public host and protocol so Astro can keep its built-in origin check enabled:

```nginx
proxy_set_header Host $host;
proxy_set_header X-Forwarded-Host $host;
proxy_set_header X-Forwarded-Proto $scheme;
client_max_body_size 60m;
```
