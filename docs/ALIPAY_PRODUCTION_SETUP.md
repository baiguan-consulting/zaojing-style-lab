# 支付宝生产收款接通记录

> 最后更新：2026-11-16  
> 本文只记录状态、变量名称和安全操作流程，不记录任何真实密钥、公钥内容、密码或完整环境文件。

## 1. 当前结论

> 2026-11-15 更新：新收款主链路改为 Vibe Pay“即刻收直连模式”次数包。旧的 `alipay.trade.page.pay` 代码与本地钱包仅保留历史兼容，不再作为新链路的上线目标。

即刻收直连代码已实现：

- `alipay.aipay.nowpaydirect.charge.query`：验证商品状态、`QUANTITY/COUNT` 模式和档位；
- `alipay.aipay.nowpaydirect.purchase.create`：创建支付宝托管购买链接；
- `alipay.aipay.nowpaydirect.quota.query`：读取用户实时剩余次数；
- `alipay.aipay.nowpaydirect.quota.verify`：按生成服务核销次数；
- `alipay.aipay.nowpaydirect.quota.refresh`：用原请求号恢复处理中或未知核销结果。

生产商品 ID 为 `DIRECT_a6d335a25c543fda9ca6c2b2bf78a214`，配置变量为 `NOWPAY_PRODUCT_ID`。代码和数据库迁移已于 2026-11-16 部署到生产，当前生产 `NOWPAY_ENABLED=true`。

2026-11-16 生产状态：

- `NOWPAY_PRODUCT_ID` 已配置；
- `NOWPAY_ENABLED=true`；
- `0002_empty_naoko.sql` 已执行；
- 应用、PostgreSQL 和 Caddy 容器健康；
- 正式 App ID、应用私钥和支付宝公钥已由管理员通过服务器隐藏输入配置；
- 真实 `charge.query` 和最小档位购买已经通过，商品状态为 `ENABLED / QUANTITY / COUNT` 并返回 4 个档位；
- 次数包按次数从少到多显示，最近购买记录面向用户只显示“待支付/已支付”，人工退款入口已上线但联系方式仍待补充；
- 手机端两次生成失败已定位为服务器到 BoxAI 的临时网络失败，两次均未调用 `quota.verify`、未扣减次数；网络阶段错误提示和有限重试已部署；
- 生图和单次核销尚待最终真实验收，在确认 `quota.verify` 只扣一次前不能宣称完整创作闭环已经验收完成。

平台已经实现 AI 网页应用收款所需的代码链路：

- `alipay.trade.page.pay` 网页/H5 下单；
- 交易查询和支付状态补偿；
- HTTPS 异步通知、SDK 验签、订单金额/应用/收款方校验；
- PostgreSQL 通知幂等、订单入账和钱包流水；
- 同步回跳只用于展示，最终状态由通知或主动查询确认；
- 关闭订单、退款和退款查询；
- 退款次数预留、失败释放和成功结算。

以下为旧网页支付链路在 2026-11-06 的历史检查结果，不代表即刻收当前状态：

- `PAYMENTS_ENABLED` 存在，但为 `false`；
- `ALIPAY_APP_ID` 未配置；
- `ALIPAY_PRIVATE_KEY` 未配置；
- `ALIPAY_PUBLIC_KEY` 未配置；
- `ALIPAY_SELLER_ID` 和 `ALIPAY_SELLER_EMAIL` 均未配置；
- `ALIPAY_NOTIFY_URL` 已有 HTTPS 地址；
- `ALIPAY_GATEWAY` 仍不是正式生产网关。

当前支付购买已经跑通。剩余验收项是使用已购买次数成功生成一张图片，确认 `quota.verify` 只核销一次，并确认重复查询同一任务不会重复扣次。

## 2. 正式应用必须满足的条件

以下资料必须属于同一个支付宝生产应用，不能混用沙箱应用、其他应用或另一套密钥：

1. 支付宝生产应用 App ID；
2. Node.js 使用的 PKCS#1 应用私钥原始单行值；
3. 与应用公钥配置对应的支付宝公钥；
4. Seller ID，或确实用于收款的 Seller Email；
5. 已为该应用开通“AI 网页应用收款”；
6. 正式网关 `https://openapi.alipay.com/gateway.do`；
7. 通知地址 `https://picture.baiguan-consulting.com/api/payments/alipay/notify`。

生产应用私钥不能发送到聊天、邮件、截图、Git 或普通文档，也不能交给 Agent。应由管理员本人在服务器的隐藏输入终端中粘贴。

## 3. 安全配置方式

即刻收直连使用：

```text
/opt/zaojing/deploy/configure-nowpay-direct.sh
```

该脚本隐藏输入 App ID 对应的应用私钥和支付宝公钥，固定生产网关与商品 ID，并继续保持 `NOWPAY_ENABLED=false`。不要把私钥发到聊天、截图、邮件或 Git。

服务器已提供：

```text
/opt/zaojing/deploy/configure-alipay-production.sh
```

它会在服务器终端中依次请求 App ID、PKCS#1 应用私钥、支付宝公钥和 Seller ID。两个密钥使用隐藏输入，不会回显，也不会打印到命令输出。脚本会：

- 原子更新 `/opt/zaojing/.env.production`；
- 保持文件权限为 `600`；
- 固定使用生产网关和当前网站 HTTPS 通知地址；
- 重启应用容器加载配置；
- 继续保持 `PAYMENTS_ENABLED=false`，避免未经验证直接收款。

## 4. 验收顺序

即刻收直连验收顺序：

1. 运行 `configure-nowpay-direct.sh` 安全写入同一商户应用的生产凭证；
2. 管理员打开 `/admin/payments`，点击“查询即刻收商品与档位”；
3. 确认 `capability_status=ENABLED`、`billing_mode=QUANTITY`、`quota_unit=COUNT` 且至少返回一个档位；
4. 打开 `NOWPAY_ENABLED=true` 并重启应用；
5. 测试账号购买一个最小档位，确认支付宝托管页完成付款并返回平台；
6. 确认 `quota.query` 的 `remaining` 实际增加；
7. 生成一张图片，确认只核销 1 次并成功交付；
8. 重复查询同一任务，确认原 `out_request_no` 不会重复扣次；
9. 人工制造或模拟处理中结果，确认只通过 `quota.refresh` 恢复；
10. 验收异常时立即恢复 `NOWPAY_ENABLED=false`。

旧网页支付验收顺序仅供历史链路回退参考：

1. 管理员登录 `/admin/payments`，确认四组生产检查全部通过；
2. 点击“测试支付宝签名连接”；该测试只查询一个不存在的测试订单，不会创建订单或扣款；
3. 确认生产网关接受签名查询；
4. 检查公网通知路由可以访问且无重定向；
5. 备份数据库；
6. 临时开启支付并重启应用；
7. 管理员使用自己的普通用户账户购买“单次体验”，完成一笔 0.5 元真实支付；
8. 确认支付宝扣款成功、网站订单变为 `PAID`、钱包只增加 1 次、重复通知不重复入账；
9. 验证订单主动查询、同步回跳和异步通知日志均无异常；
10. 验收通过后保持支付开启；失败时立即恢复 `PAYMENTS_ENABLED=false`。

## 5. 管理后台状态页

生产支付状态页：

```text
https://picture.baiguan-consulting.com/admin/payments
```

页面只显示布尔状态和固定通知地址，不向浏览器发送应用私钥、公钥内容、App ID、Seller ID 或完整环境变量。管理员测试接口同样只返回连接是否成功和脱敏错误码。

## 6. 当前待办

- 即刻收正式参数、商品查询、真实购买、余额查询、图片交付和单次核销已经通过生产验收，当前保持 `NOWPAY_ENABLED=true`；
- 2026-11-16 的真实生成任务成功交付 1 张图片，`quota.verify` 准确核销 1 次，剩余次数由支付宝返回；
- 旧网页支付链路继续保持 `PAYMENTS_ENABLED=false`，除非后续明确决定恢复该渠道；
- 补充人工退款入口中的企业微信和客服邮箱，并继续监控生成失败、核销处理中和重复查询场景。
