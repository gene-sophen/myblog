---
slug: "codepulse-spec"
title: "CodePulse 博客系统说明书"
date: "2026-06-30"
status: "published"
kind: "spec"
category: "项目说明书"
projectSlug: "codepulse-blog"
lifecycle: "ongoing"
tags:
  - "Astro"
  - "内容系统"
  - "部署"
company: ""
position: ""
excerpt: "定义博客系统的信息架构、内容模型、后台维护方式与部署边界。"
---

## 目标

CodePulse 是一个以项目生命周期为核心的个人技术博客。它不只展示结果，也展示正在发生的设计、踩坑和复盘。

## 内容模型

- 项目通过 `ongoing` 和 `archived` 区分展示位置。
- 文章通过 `spec` 和 `devlog` 区分在详情页的位置。
- 工具箱、面经和随笔不绑定项目，分别进入独立栏目。

## 维护方式

后台提供站点设置、项目和文章维护。内容以 JSON 文件保存在 `data` 目录，适合个人云服务器部署和备份。
