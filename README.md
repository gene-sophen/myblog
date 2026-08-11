# CodePulse Blog

一个可部署到云服务器的个人技术博客：Astro 服务端渲染 + Markdown 文件内容库 + 自带管理后台，无需数据库。

![Astro](https://img.shields.io/badge/Astro-7-BC52EE?logo=astro&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-SSR-339933?logo=node.js&logoColor=white)

## 特性

- **纯 Markdown 内容库**：文章、项目、站点设置全部是 `content/` 下的 Markdown 文件，Git 友好的同时自带可视化后台
- **完整栏目**：首页（博主名片 / 状态播报 / 近期更新）、正在开发、项目库、工具箱、个人履历、文章详情
- **自带后台**：在线维护站点设置、项目和文章，保存时写回 Markdown 文件，并自动备份旧版本
- **内容工作流**：Markdown 导入 / 导出、批量导入、变更摘要、内容体检（重复 slug、缺摘要、失效关联等）、图片上传、正文预览
- **SEO 与安全**：自动生成 `rss.xml`、`sitemap.xml`、`robots.txt`；后台会话加固、登录限流、上传校验、正文转义

## 技术栈

- [Astro](https://astro.build) 7（SSR，`@astrojs/node` 适配器）
- TypeScript
- 无数据库：内容即文件，旧版 JSON 数据保留在 `data/` 作为兼容兜底

## 快速开始

```bash
npm install
npm run dev
```

- 前台：http://127.0.0.1:4321/
- 后台：http://127.0.0.1:4321/admin（开发环境默认密码 `admin123`）

部署前创建 `.env`（参考 `.env.example`）：

```bash
ADMIN_PASSWORD=your-strong-password
ADMIN_SESSION_SECRET=your-long-random-string-at-least-32-chars
ASTRO_TELEMETRY_DISABLED=1
# 生产环境建议把内容目录放到 Git 检出之外：
# CONTENT_DIR=/opt/gene-blog/content
```

## 内容维护

推荐直接维护 `content/` 目录下的 Markdown 文件：

- `content/settings.md`：站点设置
- `content/projects/*.md`：项目数据
- `content/articles/*.md`：文章数据

每个文件用 frontmatter 存结构化信息（标题、日期、分类、标签等），正文用 Markdown。文章示例：

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
excerpt: "这篇文章的摘要。"
---

## 背景

这里开始写正文。
```

项目文件使用固定小节承载正文（`## 项目简介`、`## 近期进展`、`## 架构流程`），完整示例见 `content.example/`。

### 后台能力

- 编辑内容并写回 `content/` 的 Markdown 文件；保存前旧文件自动备份到 `content/.backups`（每个源文件保留最近 5 份）
- 单篇 / 批量导入 Markdown；合法文件直接加入编辑列表，格式错误逐项提示，slug 冲突时自动生成不重复的新 slug
- 保存全部前展示变更摘要；内容体检检查重复 slug、缺少摘要、正文为空、项目关联失效和相对图片路径
- 正文编辑时实时生成本地 Markdown 预览；内置开发日志、项目说明书、工具箱、面经复盘、月度总结等模板
- 上传 `jpg` / `png` / `webp` / `gif` 图片到 `public/images/articles/<article-slug>/` 并自动插入图片语法

文章支持 `status: "draft" | "published"`，前台默认只展示已发布文章。

工具箱分类无需预先配置。将文章的 `kind` 设为 `tool`，并在 `category` 中填写任意分类名称，工具箱页面会自动按现有分类分组；后台也会提供已有分类作为输入建议。

第一次从旧版 JSON 数据迁移：

```bash
node scripts/migrate-json-to-markdown.mjs
```

建议把 `content/`、`public/images/articles` 和 `data/content-version.json` 纳入备份。

## 构建与部署

```bash
npm run build
npm run start   # node --env-file-if-exists=.env ./dist/server/entry.mjs
```

用进程管理器部署时也可以直接通过系统环境变量注入配置。Nginx 反向代理示例：

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

需要让服务器上的内容与代码部署分离时，配置 `CONTENT_DIR` 指向 Git 检出之外的目录，并把上传图片放到持久目录后链接到 `public/images/articles`。完整迁移与部署命令见 [`docs/persistent-content-deployment.md`](docs/persistent-content-deployment.md)。

## 安全说明

- 生产环境必须设置非默认的 `ADMIN_PASSWORD`，以及长度至少 32 字符的 `ADMIN_SESSION_SECRET`
- 后台接口都需要管理员会话；登录接口带基础限流，限流优先使用反向代理传入的 `X-Real-IP`（请确保 Nginx 覆盖该请求头）
- 会话绑定浏览器 User-Agent，30 分钟无活动过期，12 小时绝对过期；同时只允许一个会话在线，新登录会使旧会话失效
- 内容写入、图片上传、登录、登出要求同源请求；编辑器在跳转重新登录前会把未保存修改暂存到浏览器，并在登录后提示恢复
- 图片上传不支持 SVG，并校验文件头；文章正文经 Markdown 渲染器转义，避免注入 HTML
- `robots.txt` 已声明禁止抓取 `/admin` 和 `/api/`
- 定期执行 `npm audit --registry=https://registry.npmjs.org` 检查依赖漏洞（镜像源可能不支持 audit 接口）

## 目录结构

```text
content/            # Markdown 内容库（文章 / 项目 / 站点设置）
content.example/    # 内容格式示例
data/               # 旧版 JSON 数据（兼容兜底）与内容版本号
docs/               # 部署与计划文档
public/             # 静态资源（含上传的文章图片）
scripts/            # JSON → Markdown 迁移脚本
src/
  components/       # Astro 组件
  layouts/          # 页面布局
  lib/              # 内容解析、鉴权、校验等
  pages/            # 前台页面、后台与 API 路由
```
