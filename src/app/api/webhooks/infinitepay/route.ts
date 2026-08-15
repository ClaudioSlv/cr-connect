import { NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

const expectedAmounts = { pro: 2990, premium: 4490 } as const;

type WebhookPayload = {
  invoice_slug?: string;
  order_nsu?: string;
  transaction_nsu?: string;
};

function admin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

export async function POST(request: Request) {
  const handle = process.env.INFINITEPAY_HANDLE;
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Configuração do banco pendente." }, { status: 503 });
  }
  if (!handle) return NextResponse.json({ error: "Integração não configurada." }, { status: 503 });

  const payload = await request.json().catch(() => null) as WebhookPayload | null;
  if (!payload?.order_nsu || !payload.transaction_nsu || !payload.invoice_slug) {
    return NextResponse.json({ error: "Dados de pagamento incompletos." }, { status: 400 });
  }

  // Webhooks não possuem a sessão do administrador. Depois da validação na
  // InfinitePay, esta credencial de servidor ativa somente a assinatura paga.
  const db = admin();
  const { data: subscription } = await db
    .from("subscriptions")
    .select("workshop_id,plan_code,provider_reference")
    .eq("provider", "infinitepay")
    .eq("provider_reference", payload.order_nsu)
    .maybeSingle();

  if (!subscription) return NextResponse.json({ error: "Pedido não encontrado." }, { status: 400 });
  if (subscription.plan_code !== "pro" && subscription.plan_code !== "premium") {
    return NextResponse.json({ error: "Plano inválido." }, { status: 400 });
  }
  const planCode = subscription.plan_code as keyof typeof expectedAmounts;

  const verification = await fetch("https://api.checkout.infinitepay.io/payment_check", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      handle,
      order_nsu: payload.order_nsu,
      transaction_nsu: payload.transaction_nsu,
      slug: payload.invoice_slug,
    }),
  });
  const payment = await verification.json().catch(() => null) as { paid?: boolean; amount?: number } | null;
  if (!verification.ok || !payment?.paid || payment.amount !== expectedAmounts[planCode]) {
    return NextResponse.json({ error: "Pagamento ainda não foi confirmado." }, { status: 400 });
  }

  const { error } = await db.from("subscriptions").update({ status: "active" }).eq("workshop_id", subscription.workshop_id);
  if (error) return NextResponse.json({ error: "Não foi possível ativar o plano." }, { status: 500 });

  return NextResponse.json({ received: true });
}
