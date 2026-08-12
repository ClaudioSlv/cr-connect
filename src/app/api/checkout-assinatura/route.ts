import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const plans = {
  pro: { name: "Plano Profissional CR Connect", price: 2990 },
  premium: { name: "Plano CR SOS", price: 4490 },
} as const;

type PlanCode = keyof typeof plans;

export async function POST(request: Request) {
  const handle = process.env.INFINITEPAY_HANDLE;
  if (!handle) return NextResponse.json({ error: "InfinitePay ainda não está configurada." }, { status: 503 });

  const { plan } = await request.json() as { plan?: string };
  if (plan !== "pro" && plan !== "premium") return NextResponse.json({ error: "Plano inválido." }, { status: 400 });

  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return NextResponse.json({ error: "Faça login para continuar." }, { status: 401 });

  const { data: membership } = await db.from("workshop_users").select("workshop_id,role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
  if (!membership) return NextResponse.json({ error: "Somente o administrador da oficina pode alterar o plano." }, { status: 403 });

  const planCode = plan as PlanCode;
  const orderNsu = `crconnect-${membership.workshop_id}-${planCode}-${Date.now()}`;
  const origin = new URL(request.url).origin;
  const payment = await fetch("https://api.checkout.infinitepay.io/links", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      handle,
      items: [{ quantity: 1, price: plans[planCode].price, description: plans[planCode].name }],
      order_nsu: orderNsu,
      redirect_url: `${origin}/app/assinatura?checkout=${encodeURIComponent(orderNsu)}`,
      webhook_url: `${origin}/api/webhooks/infinitepay`,
    }),
  });
  const response = await payment.json().catch(() => null) as Record<string, unknown> | null;
  if (!payment.ok) return NextResponse.json({ error: "A InfinitePay não conseguiu criar o checkout." }, { status: 502 });

  const checkoutUrl = response?.url || response?.checkout_url || response?.link;
  if (typeof checkoutUrl !== "string") return NextResponse.json({ error: "A InfinitePay retornou um checkout inválido." }, { status: 502 });

  const { error } = await db.from("subscriptions").upsert({
    workshop_id: membership.workshop_id,
    plan_code: planCode,
    status: "pending_payment",
    provider: "infinitepay",
    provider_reference: orderNsu,
  }, { onConflict: "workshop_id" });
  if (error) return NextResponse.json({ error: "Checkout criado, mas não foi possível registrar a assinatura." }, { status: 500 });

  return NextResponse.json({ checkoutUrl });
}
