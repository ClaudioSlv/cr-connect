import { NextResponse } from "next/server";
import { PAYMENT_OPENING_TIME } from "../../../mega-virada-2026/countdown";
import { BOLAO_CONSENT_VERSION } from "@/lib/bolao/schedule";
import { bolaoAcceptingRegistrations, bolaoAdmin, bolaoConfigured, tokenHash } from "@/lib/bolao/server";
import { parseSubscription, sameOriginRequest, validManagementToken, validPushEndpoint } from "@/lib/bolao/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store" };
const reply = (body: object, status = 200) => NextResponse.json(body, { status, headers });

export async function GET() {
  if (!bolaoAcceptingRegistrations()) return reply({ available: false });
  try {
    const { error } = await bolaoAdmin().from("bolao_push_subscriptions").select("id").limit(1);
    return reply(error ? { available: false } : {
      available: true, publicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    });
  } catch {
    return reply({ available: false });
  }
}

async function readBody(request: Request) {
  if (Number(request.headers.get("content-length") || 0) > 10_000) return null;
  const text = await request.text();
  if (text.length > 10_000) return null;
  try { return JSON.parse(text) as Record<string, unknown>; } catch { return null; }
}

export async function POST(request: Request) {
  if (!sameOriginRequest(request)) return reply({ error: "Origem não permitida." }, 403);
  if (!bolaoConfigured()) return reply({ error: "Lembretes temporariamente indisponíveis." }, 503);
  const body = await readBody(request);
  if (!body || !validManagementToken(body.token)) return reply({ error: "Dados inválidos." }, 400);
  const db = bolaoAdmin();
  const hash = tokenHash(body.token);

  if (body.action === "status") {
    if (!validPushEndpoint(body.endpoint)) return reply({ error: "Dados inválidos." }, 400);
    const { data, error } = await db.from("bolao_push_subscriptions").select("id,active")
      .eq("endpoint", body.endpoint).eq("token_hash", hash).maybeSingle();
    return error ? reply({ error: "Não foi possível verificar os lembretes." }, 503)
      : reply({ active: data?.active === true, subscriptionId: data?.id ?? null });
  }

  if (!bolaoAcceptingRegistrations()) return reply({ error: "Lembretes temporariamente indisponíveis." }, 503);
  if (Date.now() >= PAYMENT_OPENING_TIME) return reply({ error: "Os pagamentos já foram liberados." }, 409);
  const subscription = parseSubscription(body.subscription);
  if (!subscription || body.consentVersion !== BOLAO_CONSENT_VERSION) {
    return reply({ error: "Inscrição ou consentimento inválido." }, 400);
  }
  const { data: existing, error: lookupError } = await db.from("bolao_push_subscriptions")
    .select("id,token_hash").eq("endpoint", subscription.endpoint).maybeSingle();
  if (lookupError) return reply({ error: "Não foi possível ativar os lembretes." }, 503);
  if (existing && existing.token_hash !== hash) {
    return reply({ error: "Inscrição antiga. Desative os lembretes neste navegador e tente novamente." }, 409);
  }
  const values = {
    endpoint: subscription.endpoint, p256dh: subscription.keys.p256dh,
    auth: subscription.keys.auth, token_hash: hash,
    consent_version: BOLAO_CONSENT_VERSION, active: true, disabled_at: null,
    updated_at: new Date().toISOString(),
  };
  // Do not let a concurrent insert replace another registration's management token.
  const { data, error } = existing
    ? await db.from("bolao_push_subscriptions").update(values)
      .eq("id", existing.id).eq("token_hash", hash).select("id").single()
    : await db.from("bolao_push_subscriptions").insert(values).select("id").single();
  return error ? reply({ error: "Não foi possível ativar os lembretes." }, 503)
    : reply({ ok: true, subscriptionId: data.id });
}

export async function DELETE(request: Request) {
  if (!sameOriginRequest(request)) return reply({ error: "Origem não permitida." }, 403);
  const body = await readBody(request);
  if (!body || !validManagementToken(body.token) || !validPushEndpoint(body.endpoint)) {
    return reply({ error: "Dados inválidos." }, 400);
  }
  try {
    // Delete the endpoint and encryption keys too; opt-out is not just a UI flag.
    const { error } = await bolaoAdmin().from("bolao_push_subscriptions").delete()
      .eq("endpoint", body.endpoint).eq("token_hash", tokenHash(body.token));
    return error ? reply({ error: "Não foi possível remover a inscrição agora." }, 503) : reply({ ok: true });
  } catch {
    return reply({ error: "Não foi possível remover a inscrição agora." }, 503);
  }
}
