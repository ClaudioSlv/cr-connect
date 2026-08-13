import { AppShell } from "@/components/app-shell";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export default async function ReportsPage() {
  const db = await createClient(); const { data: { user } } = await db.auth.getUser(); if (!user) redirect("/login");
  const { data: membership } = await db.from("workshop_users").select("workshop_id,role,workshops(name)").eq("user_id", user.id).limit(1).maybeSingle();
  if (!membership || !["admin", "attendant"].includes(membership.role)) redirect("/app");
  const workshop = membership.workshops as unknown as { name: string }; const workshopId = membership.workshop_id;
  const [{ count: clients }, { data: orders }, { data: budgets }, { data: products }, { data: transactions }] = await Promise.all([
    db.from("clients").select("id", { count: "exact", head: true }).eq("workshop_id", workshopId),
    db.from("service_orders").select("status").eq("workshop_id", workshopId),
    db.from("budgets").select("status").eq("workshop_id", workshopId),
    db.from("products").select("quantity,minimum_quantity").eq("workshop_id", workshopId),
    db.from("financial_transactions").select("kind,status,amount").eq("workshop_id", workshopId),
  ]);
  const received = (transactions || []).filter(x => x.kind === "income" && x.status === "paid").reduce((s, x) => s + Number(x.amount), 0);
  const expenses = (transactions || []).filter(x => x.kind === "expense" && x.status === "paid").reduce((s, x) => s + Number(x.amount), 0);
  const pending = (transactions || []).filter(x => x.status === "pending").reduce((s, x) => s + (x.kind === "income" ? Number(x.amount) : -Number(x.amount)), 0);
  const activeOrders = (orders || []).filter(x => !["delivered", "cancelled", "finished"].includes(x.status)).length;
  const awaitingBudgets = (budgets || []).filter(x => ["sent", "pending"].includes(x.status)).length;
  const lowStock = (products || []).filter(x => Number(x.quantity) <= Number(x.minimum_quantity)).length;
  const cards = [["Recebido", money.format(received), "Entradas pagas"], ["Despesas", money.format(expenses), "Saídas pagas"], ["Saldo pendente", money.format(pending), "Valores em aberto"], ["O.S. em andamento", String(activeOrders), "Atendimentos ativos"], ["Orçamentos pendentes", String(awaitingBudgets), "Aguardando resposta"], ["Estoque baixo", String(lowStock), "Produtos no mínimo"], ["Clientes", String(clients || 0), "Base ativa"]];
  return <AppShell workshop={workshop.name}><p className="text-xs font-bold tracking-[.2em] text-[#FFC107]">GESTÃO</p><h1 className="mt-2 text-3xl font-bold">Relatórios</h1><p className="mt-2 text-zinc-400">Resumo financeiro e operacional da sua oficina.</p><div className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{cards.map(([title, value, detail]) => <article key={title} className="rounded-xl border border-zinc-800 bg-[#1A1A1A] p-5"><p className="text-sm text-zinc-400">{title}</p><p className="mt-3 text-3xl font-bold text-[#FFC107]">{value}</p><p className="mt-2 text-xs text-zinc-500">{detail}</p></article>)}</div></AppShell>;
}
