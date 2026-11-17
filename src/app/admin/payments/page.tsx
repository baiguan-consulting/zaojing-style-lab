import { AlertTriangle, CheckCircle2, CircleDashed, CreditCard, LockKeyhole, RadioTower } from "lucide-react";

import { AdminShell } from "@/components/admin-shell";
import { AlipayConnectionTest } from "@/components/alipay-connection-test";
import { getNowPayDirectConfigurationStatus } from "@/lib/nowpay-direct";

export const dynamic = "force-dynamic";

function State({ ready, readyText, pendingText }: { ready: boolean; readyText: string; pendingText: string }) {
  return (
    <span className={ready ? "payment-check ready" : "payment-check pending"}>
      {ready ? <CheckCircle2 /> : <CircleDashed />}
      <strong>{ready ? readyText : pendingText}</strong>
    </span>
  );
}

export default function PaymentsPage() {
  const status = getNowPayDirectConfigurationStatus();

  return (
    <AdminShell active="payments">
      <div className="admin-page-header">
        <div>
          <span className="admin-kicker">VIBE PAY READINESS</span>
          <h1>即刻收次数包</h1>
          <p>这里只显示是否配置，不会把应用私钥、公钥或完整环境变量发送到浏览器。</p>
        </div>
      </div>

      <section className={`payment-readiness-hero ${status.active ? "ready" : "pending"}`}>
        <div>{status.active ? <CheckCircle2 /> : <AlertTriangle />}</div>
        <span>
          <small>PRODUCTION STATUS</small>
          <h2>{status.active ? "即刻收次数包已启用" : status.readyToTest ? "参数齐全，等待商品验证" : "直连参数尚未齐全"}</h2>
          <p>{status.active ? "用户余额、购买和核销均由即刻收托管。" : "先查询商品状态和档位，再完成一次真实购买与核销验收。"}</p>
        </span>
      </section>

      <section className="payment-readiness-grid">
        <article>
          <CreditCard />
          <h3>应用与密钥</h3>
          <State ready={status.configured} readyText="必要参数已配置" pendingText="缺少正式应用参数" />
          <p>需要商品所属商户对应的 App ID、Node.js PKCS#1 应用私钥和支付宝公钥。</p>
        </article>
        <article>
          <RadioTower />
          <h3>生产网关</h3>
          <State ready={status.productionGateway} readyText="已使用生产网关" pendingText="当前不是生产网关" />
          <p>正式收款固定使用支付宝生产网关，不能继续使用沙箱网关。</p>
        </article>
        <article>
          <LockKeyhole />
          <h3>即刻收商品</h3>
          <State ready={status.productConfigured} readyText="商品 ID 已配置" pendingText="缺少商品 ID" />
          <p>商品、档位和价格从 `charge.query` 实时读取，不由网站自行编造。</p>
        </article>
        <article>
          <CheckCircle2 />
          <h3>直连开关</h3>
          <State ready={status.enabled} readyText="即刻收开关已打开" pendingText="即刻收开关保持关闭" />
          <p>验收前保持关闭；打开后，平台以支付宝即刻收余额为准并核销真实次数。</p>
        </article>
      </section>

      <section className="payment-launch-note">
        <strong>安全上线顺序</strong>
        <p>先查询商品必须为 ENABLED + QUANTITY + COUNT，再用测试账号购买一个档位，确认回跳后余额增加，最后生成一张图片并确认只核销 1 次。</p>
        <State ready={status.enabled} readyText="即刻收开关已打开" pendingText="即刻收开关保持关闭" />
      </section>
      <AlipayConnectionTest
        ready={status.readyToTest}
        endpoint="/api/admin/payments/nowpay/test"
        buttonText="查询即刻收商品与档位"
        successText="签名连接成功，商品收费模式和档位结构已通过服务端校验。"
      />
    </AdminShell>
  );
}
