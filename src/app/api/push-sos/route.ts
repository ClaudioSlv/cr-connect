import { createClient as createAdminClient } from "@supabase/supabase-js";
import webpush from "web-push";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

type SosRequest = { id: string; workshop_id: string; owner_id: string | null; requester_name: string; service_type: string; status: string };
type Subscription = { endpoint: string; p256dh: string; auth: string };

function admin() {
  return createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { autoRefreshToken: false, persistSession: false } });
}

async function deliver(subscriptions: Subscription[], title: string, body: string, url: string) {
  webpush.setVapidDetails("mailto:suporte@crconnect.app", process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!, process.env.VAPID_PRIVATE_KEY!);
  await Promise.all(subscriptions.map(async (subscription) => {
    try { await webpush.sendNotification({ endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } }, JSON.stringify({ title, body, url })); }
    catch (error) { const status = (error as { statusCode?: number }).statusCode; if (status === 404 || status === 410) await admin().from("push_subscriptions").delete().eq("endpoint", subscription.endpoint); }
  }));
}

export async function POST(request: Request) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) return NextResponse.json({ error: "Push not configured" }, { status: 503 });
  const { requestId, event } = await request.json() as { requestId?: string; event?: "request" | "status" };
  if (!requestId || (event !== "request" && event !== "status")) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  const session = await createClient(); const { data: { user } } = await session.auth.getUser();
  const db = admin(); const { data } = await db.from("sos_requests").select("id,workshop_id,owner_id,requester_name,service_type,status").eq("id", requestId).maybeSingle();
  const item = data as SosRequest | null; if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (event === "request") {
    if (item.status !== "requested") return NextResponse.json({ ok: true });
    const { data: members } = await db.from("workshop_users").select("user_id").eq("workshop_id", item.workshop_id);
    const ids = (members || []).map((member) => member.user_id); if (!ids.length) return NextResponse.json({ ok: true });
    const { data: subscriptions } = await db.from("push_subscriptions").select("endpoint,p256dh,auth").in("user_id", ids);
    await deliver((subscriptions || []) as Subscription[], "Novo chamado CR SOS", item.requester_name + " precisa de " + item.service_type + ".", "/app/cr-sos");
    return NextResponse.json({ ok: true });
  }
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data: membership } = await db.from("workshop_users").select("user_id").eq("workshop_id", item.workshop_id).eq("user_id", user.id).maybeSingle();
  if (!membership || !item.owner_id) return NextResponse.json({ ok: true });
  const { data: subscriptions } = await db.from("push_subscriptions").select("endpoint,p256dh,auth").eq("user_id", item.owner_id);
  const texts: Record<string, string> = { accepted: "A oficina aceitou seu chamado e vai atender voce.", declined: "A oficina nao conseguiu aceitar este chamado.", completed: "Seu atendimento foi concluido. Voce ja pode avaliar." };
  const body = texts[item.status]; if (body) await deliver((subscriptions || []) as Subscription[], "Atualizacao CR SOS", body, "/app");
  return NextResponse.json({ ok: true });
}
