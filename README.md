# CodePulse Blog

一个可部署到云服务器的个人技术博客，包含前台栏目、文章详情页和基于 Markdown 文件的内容维护。

## 功能

- 首页：博主名片、状态播报、项目速览、近期更新
- 正在开发：展示 `ongoing` 项目和项目详情
- 项目库：展示 `archived` 项目和归档详情
- 工具箱：按环境配置、代码片段、运维部署分类
- 个人履历：技术画像、项目里程碑、求职经历、随笔
- 文章页：支持 Markdown 正文、标签、项目关联和面经元信息
- 后台：维护站点设置、项目、文章内容

## 本地运行

```bash
npm install
npm run dev
```

访问：

- 前台：http://127.0.0.1:4321/
- 后台：http://127.0.0.1:4321/admin

开发环境默认后台密码是：

```text
admin123
```

部署前请创建 `.env` 并设置：

```bash
ADMIN_PASSWORD=your-strong-password
ADMIN_SESSION_SECRET=your-long-random-string-at-least-32-chars
ASTRO_TELEMETRY_DISABLED=1
```

## 内容维护

推荐直接维护 `content` 目录下的 Markdown 文件：

- `content/settings.md`：站点设置
- `content/projects/*.md`：项目数据
- `content/articles/*.md`：文章数据

每个文件使用 frontmatter 存储标题、日期、分类、标签等结构化信息，正文使用 Markdown。系统会自动解析这些文件并生成前台页面。

文章文件示例：

```markdown
---
slug: "my-devlog"
title: "一次开发日志"
date: "2026-07-10"
status: "draft"
kind: "devlog"
category: "开发日志"
projectSlug: "codepulse-blog"
lifecycle: "ongoing"
tags:
  - "Astro"
  - "Markdown"
company: ""
position: ""
excerpt: "这篇文章的摘要。"
---

## 背景

这里开始写正文。
```

项目文件使用固定小节承载正文信息：

```markdown
---
slug: "codepulse-blog"
name: "CodePulse Blog"
status: "ongoing"
statusLabel: "内容系统开发中"
tech:
  - "Astro"
progress:
  - "前台:85"
releaseNote: ""
featured: true
---

## 项目简介

项目简介内容。

## 近期进展

近期进展内容。

## 架构流程

- 浏览器访问前台页面
- Astro 服务端读取 Markdown 内容库
```

后台仍然可以编辑内容，保存时会写回 `content` 目录的 Markdown 文件。

后台文章维护页也支持导入单篇 Markdown：

1. 点击“导入 Markdown”，选择本地 `.md` 文件。
2. 系统会解析 frontmatter 和正文，并展示导入预览。
3. 如果 slug 已存在，可以选择覆盖已有文章或另存为新文章。
4. 点击“确认导入”后，文章会进入编辑列表。
5. 点击“保存全部”后，系统才会写入 `content/articles/*.md`。

后台还提供这些内容工作流能力：

- 批量导入多篇文章 Markdown，并自动避开重复 slug。
- 导出当前文章、项目或站点设置为 Markdown 文件。
- 显示当前文章源文件路径，例如 `content/articles/example.md`。
- 文章支持 `status: "draft"` 和 `status: "published"`，前台默认只展示已发布文章。
- 保存全部前会展示站点、项目和文章的变更摘要。
- 内容体检会检查重复 slug、缺少摘要、正文为空、项目关联失效和相对图片路径。
- 正文编辑区支持 Markdown 源码 / 预览切换。
- 支持上传 `jpg`、`png`、`webp`、`gif` 图片到 `public/images/articles/<article-slug>/`，并自动插入 Markdown 图片语法。
- 后台提供开发日志、项目说明书、工具箱、面经复盘、月度总结等内容模板。

如果不确定格式，可以在后台点击“下载模板”生成一份文章模板。

旧版 JSON 数据仍保留在 `data` 目录作为兼容兜底：

- `data/settings.json`：站点设置
- `data/projects.json`：项目数据
- `data/articles.json`：文章数据

建议把 `content`、`public/images/articles` 和 `data/content-version.json` 纳入备份。系统保存 Markdown 前会把旧文件备份到 `content/.backups`，每个源文件默认保留最近 5 份。第一次从旧 JSON 迁移时可以运行：

```bash
node scripts/migrate-json-to-markdown.mjs
```

## 安全与运维检查

- 生产环境必须设置非默认的 `ADMIN_PASSWORD`。
- 生产环境必须设置长度至少 32 个字符的 `ADMIN_SESSION_SECRET`。
- 后台接口都需要管理员会话，登录接口带有基础限流。
- 登录限流优先使用反向代理传入的 `X-Real-IP`，部署时请确保 Nginx 覆盖该请求头。
- 后台图片上传不支持 SVG，并会校验图片文件头，降低脚本型图片风险。
- 文章正文会经过 Markdown 渲染器转义，避免直接注入 HTML。
- 部署后建议确认 `/admin` 和 `/api/` 不被搜索引擎收录，项目已在 `robots.txt` 中声明禁止抓取。
- 定期执行 `npm audit --registry=https://registry.npmjs.org` 检查依赖漏洞；如果使用镜像源，可能不支持 audit 接口。

## 构建与部署

```bash
npm run build
npm run start
```

生产环境会输出到 `dist`，Node 入口是：

```bash
npm run start
```

`npm run start` 会使用 Node 的 `--env-file-if-exists=.env` 自动读取 `.env`。如果你用进程管理器部署，也可以直接通过系统环境变量注入这些配置。

Nginx 可反向代理到 Node 服务端口。示例：

```nginx
server {
    server_name example.com;

    location / {
        proxy_pass http://127.0.0.1:4321;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $host;
    }
}
```

## Persistent content deployment

For a cloud server that keeps its own articles and settings, configure `CONTENT_DIR` to a directory outside the Git checkout and keep uploaded images in a persistent directory linked to `public/images/articles`. The complete migration and deployment commands are in [`docs/persistent-content-deployment.md`](docs/persistent-content-deployment.md).

## Admin session security

Admin sessions are bound to the browser user agent, expire after 30 minutes without activity, and have a 12-hour absolute lifetime. Only one session is active at a time: a new login invalidates the previous session. Content writes, image uploads, login, and logout also require a same-origin request. The editor saves unsaved changes in the browser before redirecting to re-authentication and offers to restore them after login.
