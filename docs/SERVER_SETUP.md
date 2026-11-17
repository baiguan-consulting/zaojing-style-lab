# 造境生产服务器运维说明

> 最后更新：2026-11-16  
> 本文只记录架构、状态和操作方法，不记录公网 IP、密码、API Key 或私钥。

## 1. 当前服务器

| 项目 | 当前配置 |
| --- | --- |
| 地区 | 中国香港 |
| 操作系统 | Ubuntu Server 24.04.1 LTS x86_64 |
| CPU / 内存 | 4 核 / 4 GB |
| 公网带宽 | 5 Mbps |
| 系统盘 | 约 39 GB |
| 主机名 | `zaojing-prod` |
| 时区 | `Asia/Shanghai` |
| Swap | 2 GB |
| SSH 端口 | `22` |
| 管理账号 | `deploy` |

服务器已完成初始化，不再使用服务商网页控制台执行日常操作。

## 2. SSH 与安全状态

- `deploy` 使用项目专用 Ed25519 密钥登录；
- `deploy` 已验证可执行免交互 `sudo`；
- root 远程登录已关闭；
- SSH 密码登录和键盘交互登录已关闭；
- UFW 默认拒绝入站，只允许 `22`、`80`、`443`；
- fail2ban 已启用 SSH 防暴力破解；
- Ubuntu 自动安全更新已启用；
- PostgreSQL `5432` 和 Next.js `3000` 均未映射到公网。

本地连接命令：

```powershell
ssh -p 22 -i "$env:USERPROFILE\.ssh\zaojing_prod_automation_ed25519" deploy@<服务器公网IP>
```

私钥只能保存在受控电脑上，不能发送到聊天、Git、服务器共享目录或第三方网盘。

## 3. 云安全组

生产实例需要的入站规则：

| 端口 | 来源 | 用途 |
| --- | --- | --- |
| `22/TCP` | 优先限制为管理员固定公网 IP | SSH |
| `80/TCP` | `0.0.0.0/0` | HTTP 跳转和证书签发 |
| `443/TCP` | `0.0.0.0/0` | HTTPS / HTTP3 |

待清理事项：

1. 从新安全组移除临时 `3193/TCP` 规则；
2. 只从当前造境实例解除旧安全组关联；
3. 不删除旧安全组，因为另一台服务器仍与其关联；
4. 不开放 `3000`、`5432`、RDP 或其他历史端口。

## 4. 生产架构

```text
浏览器
  -> picture.baiguan-consulting.com:443
  -> Caddy
  -> Next.js app:3000（Docker 内网）
  -> PostgreSQL:5432（Docker 隔离内网）
  -> BoxAI / 支付宝 / 阿里云邮件推送
```

Docker Compose 服务：

- `postgres`：PostgreSQL 17，使用 Docker 持久化卷；
- `app`：Next.js standalone 生产镜像；
- `migrator`：仅在 `tools` profile 下按需运行 Drizzle 数据库迁移；
- `caddy`：HTTPS 证书、压缩、安全响应头和反向代理。

`backend` Docker 网络设置为 internal，数据库不能直接访问公网。

## 5. 服务器目录

```text
/opt/zaojing/
  .env.production         # 600 权限，真实密钥，仅服务器保存
  compose.yaml
  Caddyfile
  Dockerfile
  drizzle/
  deploy/
  storage/
    data/
      templates.json
      temporary-uploads/
      generated-images/
    uploads/
  backups/
```

重要规则：

- 不把 `.env.production` 下载到不受控位置；
- 不在命令输出、截图和文档中打印环境变量内容；
- 更新代码时不能覆盖 `storage/`、`backups/` 或 Docker 数据卷；
- 管理员模板素材和用户临时隐私素材后续要迁移到不同的 OSS 路径。

## 6. 当前运行状态

- Docker Engine `29.9.3` 已启用；
- Docker Compose `5.7.0` 已安装；
- PostgreSQL 容器健康；
- `0000`–`0003` 迁移已完成，共 18 张业务表；
- Next.js 生产镜像构建成功；
- `/api/health` 在容器内返回 HTTP 200；
- Caddy 已启动，Let's Encrypt HTTPS 证书签发成功并自动续期；
- `picture.baiguan-consulting.com` 首页和 `/api/health` 公网返回 HTTP 200；
- HTTP 自动跳转到 HTTPS；
- Caddy 已解除后台临时屏蔽，`/admin` 由应用邮箱会话和管理员白名单保护；
- 未登录访问 `/admin` 跳转到 `/login?next=/admin`，未登录调用管理员 API 返回 401；
- 来源校验以生产 `APP_BASE_URL` 为可信公网 Origin，避免 Caddy 转发后的内部 HTTP 地址导致误判。
- 邮箱验证码登录已在公网域名端到端验证通过。
- 管理员邮箱白名单、PostgreSQL 支付事务和后台快速导入均已部署；旧网页支付由 `PAYMENTS_ENABLED=false` 关闭，即刻收使用独立开关。
- Vibe Pay 即刻收生产参数已配置，真实购买、图片生成、交付和单次核销已经跑通；详见 `docs/ALIPAY_PRODUCTION_SETUP.md`。
- 创作者支付宝收款信息使用独立 `CREATOR_PAYOUT_ENCRYPTION_KEY` 进行服务端加密，该密钥只保存在 `.env.production`。

## 7. 域名解析

在阿里云云解析 DNS 的 `baiguan-consulting.com` 解析列表中新增：

| 字段 | 内容 |
| --- | --- |
| 记录类型 | `A` |
| 主机记录 | `picture` |
| 记录值 | 生产服务器公网 IPv4 |
| TTL | 10 分钟或默认值 |

不要同时为 `picture` 添加 CNAME 或错误的 AAAA 记录。

Windows 检查命令：

```powershell
Resolve-DnsName picture.baiguan-consulting.com -Type A
```

解析到正确服务器后，在 `/opt/zaojing` 启动全部服务：

```bash
docker compose --env-file .env.production up -d
docker compose --env-file .env.production ps
docker compose --env-file .env.production logs --tail=100 caddy
```

## 8. 常用运维命令

进入项目目录：

```bash
cd /opt/zaojing
```

查看服务：

```bash
docker compose --env-file .env.production ps
```

查看应用日志：

```bash
docker compose --env-file .env.production logs --tail=200 app
```

查看 Caddy 日志：

```bash
docker compose --env-file .env.production logs --tail=200 caddy
```

查看数据库日志：

```bash
docker compose --env-file .env.production logs --tail=200 postgres
```

重启应用：

```bash
docker compose --env-file .env.production restart app
```

不要使用 `docker compose down -v`，其中 `-v` 会删除数据库持久化卷。

## 9. 隐私文件清理

`/etc/cron.d/zaojing` 每 30 分钟执行：

```text
/opt/zaojing/deploy/cleanup-expired-files.sh
```

脚本删除以下目录中超过 24 小时的文件：

- `storage/data/temporary-uploads/`
- `storage/data/generated-images/`

管理员案例图片不在该清理范围内。

## 10. 数据库备份

每天 `03:17` 执行：

```text
/opt/zaojing/deploy/backup-postgres.sh
```

备份位置：

```text
/opt/zaojing/backups/zaojing-YYYYMMDDTHHMMSSZ.sql.gz
```

当前本机保留 7 天。首次压缩备份已经成功生成并通过命令执行验证。

本机备份不能防止整台服务器损坏，正式运营前必须增加：

1. 上传到 OSS 私有 Bucket；
2. OSS 生命周期和加密；
3. 定期恢复演练；
4. 备份失败告警。

## 11. 发布更新流程

当前发布仍由本地安全上传完成。每次更新应遵循：

1. 本地运行 `npm run lint`；
2. 本地运行 `npx tsc --noEmit`；
3. 本地运行 `npm run build`；
4. 上传源码，但排除 `.git`、`node_modules`、`.next` 和所有本地密钥；
5. 不覆盖服务器 `.env.production`、`storage/` 和 `backups/`；
6. 先运行 `deploy/backup-postgres.sh`，确认备份成功；
7. 执行 `docker compose --env-file .env.production --profile tools build migrator`；
8. 执行 `docker compose --env-file .env.production --profile tools run --rm migrator`；
9. 执行 `docker compose --env-file .env.production build app`；
10. 执行 `docker compose --env-file .env.production up -d app`；
11. 检查 `/api/health`、页面、登录、支付和生图；
12. 确认日志无错误后完成发布。

## 12. 上线前剩余事项

1. 使用管理员邮箱完成一次生产登录，并验证 `/admin` 和 `/admin/import`；
2. 在服务器隐藏输入终端运行 `deploy/configure-alipay-production.sh`，不得把生产私钥发到聊天；
3. 在 `/admin/payments` 完成无扣款签名查询，并完成 0.5 元真实支付、异步通知和幂等入账验收；
4. 验收通过后才把 `PAYMENTS_ENABLED` 改为 `true`；
5. 将数据库备份同步到 OSS；
6. 将用户图片迁移到 OSS 私有 Bucket；
7. 增加监控、告警、隐私政策和退款规则。
