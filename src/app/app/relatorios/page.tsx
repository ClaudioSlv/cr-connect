import { AppShell } from "@/components/app-shell";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export default async function ReportsPage() {
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) redirect("/login");
  const { data: membership } = await db.from("workshop_users").select("workshop_id,workshops(name)").eq("user_id", user.id).limit(1).maybeSingle();
  if (!membership) redirect("/app");
  const workshop = membership.workshops as unknown as { name: string };
  const workshopId = membership.workshop_id;
  const [{ count: clients }, { data: orders }, { data: budgets }, { data: products }, { data: orderItems }] = await Promise.all([
    db.from("clients").select("id", { count: "exact", head: true }).eq("workshop_id", workshopId),
    db.from("service_orders").select("id,status").eq("workshop_id", workshopId),
    db.from("budgets").select("id,status").eq("workshop_id", workshopId),
    db.from("products").select("quantity,minimum_quantity").eq("workshop_id", workshopId),
    db.from("service_order_items").select("quantity,unit_price,discount").eq("workshop_id", workshopId),
  ]);
  const openOrders = (orders || []).filter(o => !["completed", "delivered", "cancelled"].includes(o.status)).length;
  const awaitingBudgets = (budgets || []).filter(b => ["sent", "pending"].includes(b.status)).length;
  const lowStock = (products || []).filter(p => Number(p.quantity) <= Number(p.minimum_quantity)).length;
  const total = (orderItems || []).reduce((sum, item) => sum + Number(item.quantity) * Number(item.unit_price) - Number(item.discount), 0);
  const cards = [["Clientes cadastrados", String(clients || 0), "Base ativa da oficina"], ["Ordens em andamento", String(openOrders), "Acompanhe os atendimentos"], ["Orçamentos aguardando", String(awaitingBudgets), "Pendentes de resposta"], ["Estoque baixo", String(lowStock), "Itens no nível mínimo"]];
  return <AppShell workshop={workshop.name}><p className="text-xs font-bold tracking-[.2em] text-[#FFC107]">GESTÃO</p><h1 className="mt-2 text-3xl font-bold">Relatórios</h1><p className="mt-2 text-zinc-400">Uma visão rápida dos dados registrados na sua oficina.</p><div className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{cards.map(([title, value, detail]) => <article key={title} className="rounded-xl border border-zinc-800 bg-[#1A1A1A] p-5"><p className="text-sm text-zinc-400">{title}</p><p className="mt-3 text-3xl font-bold text-[#FFC107]">{value}</p><p className="mt-2 text-xs text-zinc-500">{detail}</p></article>)}</div><section className="mt-7 rounded-xl border border-[#4a3818] bg-gradient-to-r from-[#211805] to-[#171717] p-6"><p className="text-sm text-zinc-300">Valor previsto nos itens de O.S.</p><p className="mt-2 text-4xl font-bold text-[#FFC107]">{money.format(total)}</p><p className="mt-3 max-w-2xl text-sm text-zinc-400">Este indicador soma serviços e peças lançados nas ordens. Ele serve para acompanhamento interno e não substitui um fechamento financeiro.</p></section></AppShell>;
}
