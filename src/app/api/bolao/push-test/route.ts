import { NextResponse } from "next/server";
import { authorizedSecret, bolaoAdmin, bolaoConfigured, sendBolaoReminder, type StoredBolaoSubscription } from "@/lib/bolao/server";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(request: Request) {
  if (!authorizedSecret(request, process.env.BOLAO_PUSH_TEST_SECRET)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!bolaoConfigured()) return NextResponse.json({ error: "Push is not configured" }, { status: 503 });
  let body: { subscriptionId?: string; testId?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  if (!body.subscriptionId || !/^[a-f0-9-]{36}$/i.test(body.subscriptionId) ||
      !body.testId || !/^[a-zA-Z0-9_-]{1,60}$/.test(body.testId)) {
    return NextResponse.json({ error: "Provide subscriptionId and a stable testId." }, { status: 400 });
  }
  try {
    const { data, error } = await bolaoAdmin().from("bolao_push_subscriptions")
      .select("id,endpoint,p256dh,auth,created_at").eq("id", body.subscriptionId).eq("active", true).single();
    if (error || !data) return NextResponse.json({ error: "Subscription not found" }, { status: 404 });
    const result = await sendBolaoReminder(data as StoredBolaoSubscription, {
      key: `test-${body.testId}`, scheduledAt: Date.now(),
      title: "🔔 Teste de lembrete — Mega da Virada 2026",
      body: "Os lembretes funcionam neste aparelho. Toque para abrir a página do bolão. 🍀",
    });
    return NextResponse.json({ result });
  } catch {
    return NextResponse.json({ error: "Test could not be completed" }, { status: 503 });
  }
}
