import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const infinitePayHandle = process.env.INFINITEPAY_HANDLE || "cr_connect";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { amount?: unknown; budgetNumber?: unknown; client?: unknown } | null;
  const amount = typeof body?.amount === "number" ? body.amount : Number(body?.amount);
  const budgetNumber = typeof body?.budgetNumber === "string" ? body.budgetNumber.slice(0, 48) : "ORCAMENTO";
  const clientName = typeof body?.client === "string" ? body.client.slice(0, 100) : "Cliente";
  if (!Number.isFinite(amount) || amount <= 0) return NextResponse.json({ error: "Valor do orçamento inválido." }, { status: 400 });

  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return NextResponse.json({ error: "Faça login para gerar o link de cartão." }, { status: 401 });
  const { data: membership } = await db.from("workshop_users").select("workshop_id").eq("user_id", user.id).eq("role", "admin").maybeSingle();
  if (!membership) return NextResponse.json({ error: "Somente o administrador da oficina pode gerar a cobrança." }, { status: 403 });

  const orderNsu = `orc-${membership.workshop_id}-${budgetNumber.replace(/[^a-zA-Z0-9]/g, "")}-${Date.now()}`;
  const origin = new URL(request.url).origin;
  const payment = await fetch("https://api.checkout.infinitepay.io/links", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      handle: infinitePayHandle,
      order_nsu: orderNsu,
      redirect_url: `${origin}/app/orcamentos?payment=${encodeURIComponent(orderNsu)}`,
      items: [{ quantity: 1, price: Math.round(amount * 100), description: `Orçamento ${budgetNumber} · ${clientName}` }],
    }),
  });
  const response = await payment.json().catch(() => null) as Record<string, unknown> | null;
  if (!payment.ok) return NextResponse.json({ error: "A InfinitePay não conseguiu criar o pagamento por cartão." }, { status: 502 });
  const checkoutUrl = response?.url || response?.checkout_url || response?.link;
  if (typeof checkoutUrl !== "string") return NextResponse.json({ error: "A InfinitePay retornou um link inválido." }, { status: 502 });
  const token = crypto.randomUUID().replace(/-/g, "").slice(0, 14);
  const { error } = await db.from("payment_links").insert({ workshop_id: membership.workshop_id, token, checkout_url: checkoutUrl, client_name: clientName, budget_number: budgetNumber, amount });
  if (error) return NextResponse.json({ error: "Checkout criado, mas não foi possível preparar o link curto." }, { status: 500 });
  return NextResponse.json({ checkoutUrl, publicUrl: `${origin}/p/${token}` });
}
