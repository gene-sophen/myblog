---
slug: "admin-devlog-001"
title: "把博客从静态页面升级为可维护内容系统"
date: "2026-06-30"
status: "published"
kind: "devlog"
category: "开发日志"
projectSlug: "codepulse-blog"
lifecycle: "ongoing"
tags:
  - "后台"
  - "JSON"
  - "Astro"
company: ""
position: ""
excerpt: "从 mockup 出发，补齐内容后台、API 和文章详情页。"
---

## 背景

最初的设计稿已经明确了五个一级栏目和视觉系统，但真正可长期使用的博客还需要内容维护入口。

## 实现

本阶段采用文件型内容库：站点设置、项目和文章都保存在 `data` 目录。后台通过 API 写入文件，前台页面服务端读取最新内容。

## 下一步

增加更严格的鉴权策略、备份机制，以及更丰富的文章编辑体验。
