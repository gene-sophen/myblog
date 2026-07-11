# Persistent Content Deployment

Application code is deployed from Git. Live content is stored outside the Git checkout so a deployment never replaces articles, site settings, content backups, or uploaded images.

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
printf '\nCONTENT_DIR=/opt/gene-blog/content\n' >> .env
if [ -d public/images/articles ] && [ ! -L public/images/articles ]; then
  mv public/images/articles /opt/gene-blog/uploads/articles
else
  mkdir -p /opt/gene-blog/uploads/articles
fi
ln -s /opt/gene-blog/uploads/articles public/images/articles
```

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

Copy the starter content once, then configure `CONTENT_DIR` before starting the app:

```bash
mkdir -p /opt/gene-blog/content /opt/gene-blog/uploads/articles
cp -a content.example/. /opt/gene-blog/content/
ln -s /opt/gene-blog/uploads/articles public/images/articles
```

`content/` and `public/images/articles/` are ignored by Git. Back up `/opt/gene-blog/content`, `/opt/gene-blog/uploads`, and `.env` regularly.
