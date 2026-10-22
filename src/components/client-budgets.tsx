"use client";

import { useEffect, useState } from "react";
import { paymentMethodLabel, paymentMoney, paymentTotals } from "@/lib/payment-terms";
import { createClient } from "@/lib/supabase/client";

type Budget = { id: string; status: string; created_at: string; payment_method: string; payment_terms: string; surcharge_percent: number; payment_revision: string };
type Item = { budget_id: string; description: string; kind: string; quantity: number; unit_price: number; discount: number };

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const labels: Record<string, string> = { sent: "Aguardando sua aprovação", approved: "Aprovado", rejected: "Recusado", draft: "Em preparação", expired: "Expirado" };

export function ClientBudgets() {
  const db = createClient();
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [accepted, setAccepted] = useState<Record<string, boolean>>({});
  const [message, setMessage] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    const { data: rows, error } = await db.from("budgets").select("id,status,created_at,payment_method,payment_terms,surcharge_percent,payment_revision").order("created_at", { ascending: false });
    if (error) { setMessage(error.message); return; }
    const current = (rows || []) as Budget[];
    setBudgets(current);
    if (!current.length) { setItems([]); return; }
    const result = await db.from("budget_items").select("budget_id,description,kind,quantity,unit_price,discount").in("budget_id", current.map((budget) => budget.id));
    if (result.error) setMessage(result.error.message); else setItems((result.data || []) as Item[]);
  }

  useEffect(() => { void load(); }, []);

  async function respond(id: string, approved: boolean) {
    const budget = budgets.find(item => item.id === id);
    if (!budget) return;
    const configured = budget.payment_method !== "not_defined" || budget.payment_terms || Number(budget.surcharge_percent) > 0;
    if (approved && configured && !accepted[`${id}:${budget.payment_revision}`]) { setMessage("Leia e aceite as condições de pagamento antes de aprovar."); return; }
    if (!window.confirm(approved ? "Confirmar a aprovação deste orçamento?" : "Recusar este orçamento?")) return;
    setBusyId(id);
    setMessage(approved ? "Registrando sua aprovação…" : "Registrando sua recusa…");
    const subtotal = items.filter(item => item.budget_id === id).reduce((sum, item) => sum + Number(item.quantity) * Number(item.unit_price) - Number(item.discount || 0), 0);
    const { error } = configured
      ? await db.rpc("respond_to_budget_with_payment", { p_budget_id: id, p_approved: approved, p_terms_accepted: Boolean(accepted[`${id}:${budget.payment_revision}`]), p_revision: budget.payment_revision, p_total: paymentTotals(subtotal, budget.surcharge_percent).total })
      : await db.rpc("respond_to_budget", { p_budget_id: id, p_approved: approved });
    setBusyId(null);
    if (error) { setMessage(error.message); return; }
    setMessage(approved ? "Orçamento aprovado. A oficina foi avisada." : "Orçamento recusado. A oficina foi avisada.");
    await load();
  }

  if (!budgets.length && !message) return null;

  return <section className="mt-8">
    <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-bold tracking-[.18em] text-[#FFC107]">ORÇAMENTOS</p><h2 className="mt-2 text-2xl font-bold">Orçamentos recebidos</h2><p className="mt-1 text-sm text-zinc-400">Confira os serviços e escolha aprovar ou recusar.</p></div><button type="button" onClick={() => void load()} className="rounded-lg border border-zinc-600 px-3 py-2 text-sm font-bold">Atualizar</button></div>
    {message && <p className="mt-3 rounded-lg border border-[#FFC107]/60 bg-[#FFC107]/10 p-3 text-sm text-[#FFC107]">{message}</p>}
    <div className="mt-4 space-y-4">{budgets.map((budget) => {
      const rows = items.filter((item) => item.budget_id === budget.id);
      const subtotal = rows.reduce((sum, item) => sum + Number(item.quantity) * Number(item.unit_price) - Number(item.discount || 0), 0);
      const { total, surcharge } = paymentTotals(subtotal, budget.surcharge_percent);
      const configured = budget.payment_method !== "not_defined" || budget.payment_terms || Number(budget.surcharge_percent) > 0;
      const color = budget.status === "approved" ? "text-emerald-400" : budget.status === "rejected" ? "text-red-400" : "text-[#FFC107]";
      return <article key={budget.id} className="rounded-xl border border-zinc-800 bg-[#171717] p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><b className="text-lg">Orçamento da oficina</b><p className="mt-1 text-sm text-zinc-400">Enviado em {new Date(budget.created_at).toLocaleDateString("pt-BR")}</p></div><b className={color}>{labels[budget.status] || budget.status}</b></div><div className="mt-4 divide-y divide-zinc-800 rounded-lg border border-zinc-800">{rows.map((item, index) => <div key={`${item.description}-${index}`} className="flex justify-between gap-3 p-3 text-sm"><span>{item.kind === "part" ? "Peça" : "Serviço"} · {item.description}<small className="mt-1 block text-zinc-500">{item.quantity} × {money.format(Number(item.unit_price))}{Number(item.discount) > 0 ? ` · desconto ${money.format(Number(item.discount))}` : ""}</small></span><b>{money.format(Number(item.quantity) * Number(item.unit_price) - Number(item.discount || 0))}</b></div>)}{rows.length === 0 && <p className="p-3 text-sm text-zinc-400">Itens do orçamento indisponíveis.</p>}</div><div className="mt-4 text-sm text-zinc-200"><p>Serviços e peças: {paymentMoney(subtotal)}</p><p>Acréscimo ({Number(budget.surcharge_percent)}%): {paymentMoney(surcharge)}</p><p className="mt-2 font-bold">{paymentMethodLabel(budget.payment_method)}</p><p className="mt-1 whitespace-pre-wrap">{budget.payment_terms || "Condições a combinar com a oficina."}</p></div><p className="mt-4 text-right text-xl font-black text-[#FFC107]">Total: {money.format(total)}</p>{budget.status === "sent" && <div className="mt-5 flex flex-wrap gap-3">{configured && <label className="flex w-full items-start gap-3 text-sm text-zinc-200"><input type="checkbox" className="mt-1" checked={Boolean(accepted[`${budget.id}:${budget.payment_revision}`])} onChange={e => setAccepted(current => ({ ...current, [`${budget.id}:${budget.payment_revision}`]: e.target.checked }))} />Li e aceito a forma de pagamento, o acréscimo e o valor total deste orçamento.</label>}<button disabled={busyId === budget.id || Boolean(configured && !accepted[`${budget.id}:${budget.payment_revision}`])} type="button" onClick={() => void respond(budget.id, true)} className="rounded-lg bg-[#FFC107] px-5 py-3 font-bold text-black disabled:opacity-60">Aprovar orçamento</button><button disabled={busyId === budget.id} type="button" onClick={() => void respond(budget.id, false)} className="rounded-lg border border-red-500/70 px-5 py-3 font-bold text-red-300 disabled:opacity-60">Recusar</button></div>}</article>;
    })}</div>
  </section>;
}
