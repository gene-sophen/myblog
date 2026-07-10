---
slug: "mq-lab"
name: "Message Queue Lab"
status: "ongoing"
statusLabel: "核心逻辑验证中"
tech:
  - "Go"
  - "Redis"
  - "Docker"
progress:
  - "后端:80"
  - "测试:45"
  - "文档:60"
releaseNote: ""
featured: true
---

## 项目简介

从零拆解消息队列的主题、消费组、确认机制和持久化设计。

## 近期进展

完成 topic 和 consumer group 的最小原型，正在整理 ack 语义和失败重试策略。

## 架构流程

- Producer 投递消息
- Broker 持久化并路由
- Consumer Group 拉取
- Ack 与 Retry 更新状态
