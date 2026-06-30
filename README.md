# CodePulse Blog

一个可部署到云服务器的个人技术博客，包含前台栏目、文章详情页和后台内容维护。

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

内容保存在 `data` 目录：

- `data/settings.json`：站点设置
- `data/projects.json`：项目数据
- `data/articles.json`：文章数据

后台保存后会直接更新这些 JSON 文件。建议把 `data` 目录纳入备份。

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
    }
}
```
