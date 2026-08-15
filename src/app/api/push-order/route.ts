import { createClient as createAdminClient } from "@supabase/supabase-js";
import webpush from "web-push";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
type Subscription = { endpoint: string; p256dh: string; auth: string };
type Event = "request" | "status" | "budget" | "chat";

const labels: Record<string, string> = { open: "O.S. aberta", diagnosing: "Veículo em diagnóstico", awaiting_approval: "Orçamento disponível", awaiting_part: "Aguardando peça", repairing: "Veículo em reparo", finished: "CARRO PRONTO PARA RETIRADA", delivered: "Veículo entregue", cancelled: "O.S. cancelada" };

function admin() { return createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { autoRefreshToken: false, persistSession: false } }); }

async function send(rows: Subscription[], title: string, body: string, url: string) {
  webpush.setVapidDetails("mailto:suporte@crconnect.app", process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!, process.env.VAPID_PRIVATE_KEY!);
  await Promise.all(rows.map(async (row) => {
    try { await webpush.sendNotification({ endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } }, JSON.stringify({ title, body, url })); }
    catch (error) { const status = (error as { statusCode?: number }).statusCode; if (status === 404 || status === 410) await admin().from("push_subscriptions").delete().eq("endpoint", row.endpoint); }
  }));
}

export async function POST(request: Request) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) return NextResponse.json({ error: "Push not configured" }, { status: 503 });
  const { id, event } = await request.json() as { id?: string; event?: Event };
  const session = await createClient();
  const { data: { user } } = await session.auth.getUser();
  if (!id || !event || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const db = admin();

  if (event === "chat") {
    const { data: message } = await db.from("messages").select("workshop_id,client_id,owner_id").eq("id", id).maybeSingle();
    if (!message) return NextResponse.json({ ok: true });
    if (message.owner_id) {
      if (message.owner_id !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      const { data: members } = await db.from("workshop_users").select("user_id").eq("workshop_id", message.workshop_id);
      const ids = (members || []).map((member) => member.user_id);
      const { data: rows } = ids.length ? await db.from("push_subscriptions").select("endpoint,p256dh,auth").in("user_id", ids) : { data: [] as Subscription[] };
      await send((rows || []) as Subscription[], "Nova mensagem do cliente", "Um cliente enviou uma nova mensagem.", "/app/chat");
    } else {
      const { data: membership } = await db.from("workshop_users").select("user_id").eq("workshop_id", message.workshop_id).eq("user_id", user.id).maybeSingle();
      if (!membership) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      const { data: link } = await db.from("client_portal_links").select("user_id").eq("client_id", message.client_id).maybeSingle();
      const { data: rows } = link ? await db.from("push_subscriptions").select("endpoint,p256dh,auth").eq("user_id", link.user_id) : { data: [] as Subscription[] };
      await send((rows || []) as Subscription[], "Nova mensagem da oficina", "Sua oficina enviou uma mensagem.", "/app/mensagens");
    }
    return NextResponse.json({ ok: true });
  }

  if (event === "request") {
    const { data: item } = await db.from("service_requests").select("workshop_id,owner_id").eq("id", id).maybeSingle();
    if (!item || item.owner_id !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const { data: members } = await db.from("workshop_users").select("user_id").eq("workshop_id", item.workshop_id);
    const ids = (members || []).map((member) => member.user_id);
    const { data: rows } = ids.length ? await db.from("push_subscriptions").select("endpoint,p256dh,auth").in("user_id", ids) : { data: [] as Subscription[] };
    await send((rows || []) as Subscription[], "Nova solicitação de O.S.", "Um cliente abriu uma solicitação de atendimento.", "/app/ordens");
    return NextResponse.json({ ok: true });
  }

  if (event === "budget") {
    const { data: budget } = await db.from("budgets").select("workshop_id,owner_id,status").eq("id", id).maybeSingle();
    if (!budget || !budget.owner_id) return NextResponse.json({ ok: true });
    const { data: membership } = await db.from("workshop_users").select("user_id").eq("workshop_id", budget.workshop_id).eq("user_id", user.id).maybeSingle();
    if (!membership) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const { data: rows } = await db.from("push_subscriptions").select("endpoint,p256dh,auth").eq("user_id", budget.owner_id);
    await send((rows || []) as Subscription[], "Orçamento para aprovação", "A oficina enviou um orçamento. Abra o CR Connect para aprovar ou recusar.", "/app/minhas-os");
    return NextResponse.json({ ok: true });
  }

  const { data: order } = await db.from("service_orders").select("id,workshop_id,owner_id,number,status").eq("id", id).maybeSingle();
  if (!order || !order.owner_id) return NextResponse.json({ ok: true });
  const { data: membership } = await db.from("workshop_users").select("user_id").eq("workshop_id", order.workshop_id).eq("user_id", user.id).maybeSingle();
  if (!membership) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { data: rows } = await db.from("push_subscriptions").select("endpoint,p256dh,auth").eq("user_id", order.owner_id);
  await send((rows || []) as Subscription[], labels[order.status] || "O.S. atualizada", `Sua Ordem de Serviço #${order.number} foi atualizada.`, "/app/minhas-os");
  return NextResponse.json({ ok: true });
}
