---
slug: "go-env-checklist"
title: "Go 项目环境初始化速查"
date: "2026-06-28"
status: "published"
kind: "tool"
category: "环境配置"
projectSlug: ""
lifecycle: ""
tags:
  - "Go"
  - "环境配置"
company: ""
position: ""
excerpt: "一份用于新机器或新项目的 Go 环境初始化清单。"
---

## 适用场景

新建 Go 项目或在新机器上恢复开发环境。

## 核心配置

```bash
go env -w GOPROXY=https://goproxy.cn,direct
go mod init example.com/app
go test ./...
```

## 注意事项

保持 Go 版本、CI 版本和部署环境版本一致，避免本地通过但线上失败。
