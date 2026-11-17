import { PaymentReturnStatus } from "@/components/payment-return-status";
import { SiteHeader } from "@/components/site-header";
import { getLocale } from "@/lib/locale-server";

export const dynamic = "force-dynamic";

export default async function PaymentReturnPage({ searchParams }: PageProps<"/payment/return">) {
  const params = await searchParams;
  const locale = await getLocale();
  const orderId = typeof params.orderId === "string" ? params.orderId : undefined;
  const state = typeof params.state === "string" ? params.state : undefined;
  return (
    <main>
      <SiteHeader />
      <div className="payment-return-shell">
        <PaymentReturnStatus orderId={orderId} initialState={state} locale={locale} />
      </div>
    </main>
  );
}
