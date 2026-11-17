# 造境 Style Lab - 同事分享版

打包日期：2026-11-17

这是一个经过脱敏和精简的项目源码包，用于内部查看、代码评审和本地开发。

## 已包含

- Next.js 应用源码（前台、管理后台、创作者中心和 API）；
- PostgreSQL / Drizzle 数据结构与迁移；
- BoxAI 生图接入代码；
- 支付宝 Vibe Pay / 即刻收接入代码；
- 模板处理、图片拆分和测试代码；
- `public/demo` 演示素材；
- Docker、Caddy、Compose 示例；
- `.env.example` 示例配置；
- 普通项目文档。

## 已排除

- 所有黑客松 PPT、海报、截图和预览文件；
- `.env.local`、`.env.production` 和任何真实密钥；
- 用户上传图片、生成结果和运行时数据；
- 生产数据库、备份和 Docker 数据卷；
- `node_modules`、`.next`、构建缓存和 Git 历史；
- `public/uploads` 中的线上模板素材。

## 本地启动

1. 安装 Node.js 22 和 PostgreSQL；
2. 将 `.env.example` 复制为 `.env.local`，填写自己的测试配置；
3. 运行 `npm ci`；
4. 运行数据库迁移；
5. 运行 `npm run dev`；
6. 打开 `http://localhost:3000`。

没有 BoxAI、邮件或支付宝测试参数时，对应功能无法真正调用，但可以查看代码和页面结构。

## 安全提醒

不要把真实 API Key、支付宝私钥、SMTP 密码或生产数据库加入源码包或 Git 仓库。若用于协作，建议创建私有 GitHub 仓库。
