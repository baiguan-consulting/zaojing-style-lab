# 造境 Style Lab

一个以风格模板为入口的图片生成平台雏形。管理员上传隐藏提示词、案例原图和效果图，用户必须先选择模板，再通过文字、图片或文字加图片生成同款风格。

项目决策、模块状态、部署方案和下一步统一维护在 [`PROJECT_CONTEXT.md`](./PROJECT_CONTEXT.md)。

香港生产服务器的逐步初始化操作见 [`docs/SERVER_SETUP.md`](./docs/SERVER_SETUP.md)。

## 本地运行

```bash
npm install
npm run dev
```

- 用户前台：`http://localhost:3000`
- 管理后台：`http://localhost:3000/admin`
- 新建模板：`http://localhost:3000/admin/templates/new`
- 创作次数与支付宝收款：`http://localhost:3000/credits`
- 邮箱登录：`http://localhost:3000/login`

## 当前流程

1. 在管理后台点击“新建模板”。
2. 填写公开信息，上传至少一组原图和效果图。
3. 粘贴后台私有提示词，设置允许的用户输入方式和固定输出规格。
4. 保存并发布后，模板立即出现在用户前台。
5. 用户选择模板，输入文字或上传图片并提交生成。

生成接口已接入 BoxAI，支持 `gpt-image-2.5-flare` 和 `gpt-image-2.5-sunburst`。纯文字走图片生成接口，上传图片或文字加图片走图片编辑接口。

## 数据说明

- 模板配置保存在本地 `data/templates.json`。
- 管理员上传的案例保存在 `public/uploads/`。
- 用户临时输入保存在非公开的 `data/temporary-uploads/`。
- 用户临时输入会在生成请求触发清理时删除超过 24 小时的文件。
- 生成结果保存在非公开的 `data/generated-images/`，通过受控接口读取，超过 24 小时后不可访问。
- 上述本地数据目录已被 Git 忽略，避免意外提交用户素材和私有提示词。

当前版本用于本地验收。正式部署前还需要接入私有对象存储、独立定时清理任务和管理员认证。

## PostgreSQL 与邮箱登录

用户登录使用 PostgreSQL、Drizzle 和 SMTP 邮件服务。验证码只保存带服务端密钥的摘要，不保存明文；验证码 5 分钟有效、最多尝试 5 次、60 秒内不可重复发送，同一邮箱每天最多发送 5 次，同一 IP 每天最多发送 20 次。登录会话使用 `HttpOnly` Cookie 并保留 30 天。

1. 创建 PostgreSQL 数据库，将 `.env.example` 中的 `DATABASE_URL` 复制到 `.env.local` 并填写真实连接地址。
2. 执行 `npm run db:migrate` 创建用户、身份、验证码、会话、钱包、支付和生成任务表。
3. 在阿里云邮件推送控制台添加发信域名，按照控制台给出的记录配置 DNS，并等待域名状态通过验证。建议使用独立子域名，例如 `mail.example.com`。
4. 创建“触发邮件”类型的发信地址，例如 `no-reply@mail.example.com`，并为该发信地址设置 SMTP 密码。SMTP 用户名是完整发信地址，SMTP 密码不是阿里云账号密码。
5. 将 `EMAIL_SMTP_HOST=smtpdm.aliyun.com`、`EMAIL_SMTP_PORT=465`、`EMAIL_SMTP_SECURE=true`、发信地址、SMTP 密码和发信名称写入 `.env.local`。如果控制台展示了不同的地域 Endpoint，以控制台为准。
6. 启动项目，在 `/login` 输入邮箱验证真实发送与登录流程。

首次登录会把浏览器里旧的匿名体验账户余额、订单和生成预留记录合并到邮箱账户，并清除旧匿名 Cookie。浏览模板无需登录，购买和生成必须登录。

常用数据库命令：

```bash
npm run db:generate
npm run db:migrate
npm run db:studio
```

## 支付宝 AI 网页应用收款

项目已实现支付宝网页/H5收款的下单、交易查询、关闭、退款、退款查询、异步通知验签和同步回跳确认。支付成功后按不可重复入账的订单流水增加“创作次数”，生成任务使用预留、结算、失败释放的扣次流程。

1. 复制 `.env.example` 中的支付宝配置到 `.env.local`，不要把生产私钥发到聊天或提交到 Git。
2. 本地调试可以暂不配置 `ALIPAY_NOTIFY_URL`，订单状态通过服务端主动查询确认。
3. 生产上线前必须配置公网 HTTPS 异步通知地址：`https://你的域名/api/payments/alipay/notify`。
4. 支付订单、钱包、通知事件、退款、生成任务和次数预留已经使用 PostgreSQL 事务与幂等流水。
5. 生产配置与验收流程见 `docs/ALIPAY_PRODUCTION_SETUP.md`；生产私钥只能由管理员本人通过服务器隐藏输入配置，不能发送到聊天。
