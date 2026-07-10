---
slug: "codepulse-blog"
name: "CodePulse Blog"
status: "ongoing"
statusLabel: "内容系统开发中"
tech:
  - "Astro"
  - "TypeScript"
  - "Node"
  - "Markdown"
progress:
  - "前台:85"
  - "后台:75"
  - "部署:55"
releaseNote: ""
featured: true
---

## 项目简介

面向个人技术成长记录的全栈内容站，覆盖项目生命周期、工具沉淀和履历内容。

## 近期进展

已完成站点信息、项目、文章与工具内容的文件型维护方案。下一步重点是补齐真实内容与部署加固。

## 架构流程

- 浏览器访问前台页面
- Astro 服务端读取 Markdown 内容库
- 后台 API 写入 content 目录
- 云服务器以 Node 服务运行
