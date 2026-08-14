"use client";

import { FormEvent, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type CatalogItem = { id: string; category: string; name: string; minimum_price: number; maximum_price: number };
type TimeRate = { id: string; name: string; hours: number | null; price: number };

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const emptyCatalog = { category: "Mecânica geral", name: "", minimum_price: "", maximum_price: "" };
const emptyRate = { name: "", hours: "", price: "" };

export function LaborPricingManager({ workshopId }: { workshopId: string }) {
  const db = createClient();
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [rates, setRates] = useState<TimeRate[]>([]);
  const [catalogForm, setCatalogForm] = useState(emptyCatalog);
  const [rateForm, setRateForm] = useState(emptyRate);
  const [editingCatalogId, setEditingCatalogId] = useState<string | null>(null);
  const [editingRateId, setEditingRateId] = useState<string | null>(null);
  const [percent, setPercent] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [updating, setUpdating] = useState(false);

  const asNumber = (value: string) => {
    const clean = value.replace(/[^0-9,.-]/g, "").trim();
    return Number(clean.includes(",") ? clean.replace(/\./g, "").replace(",", ".") : clean);
  };

  async function load() {
    const [catalogResult, ratesResult] = await Promise.all([
      db.from("labor_price_catalog").select("id,category,name,minimum_price,maximum_price").eq("workshop_id", workshopId).order("category").order("name"),
      db.from("labor_time_rates").select("id,name,hours,price").eq("workshop_id", workshopId).order("hours", { ascending: true, nullsFirst: false }),
    ]);
    if (catalogResult.error || ratesResult.error) setMessage(catalogResult.error?.message || ratesResult.error?.message || "Não foi possível carregar a precificação.");
    setCatalog((catalogResult.data || []) as CatalogItem[]);
    setRates((ratesResult.data || []) as TimeRate[]);
  }

  useEffect(() => { void load(); }, []);

  function startCatalogEdit(item: CatalogItem) {
    setEditingCatalogId(item.id);
    setCatalogForm({ category: item.category, name: item.name, minimum_price: String(item.minimum_price), maximum_price: String(item.maximum_price) });
    setMessage("");
  }

  function startRateEdit(item: TimeRate) {
    setEditingRateId(item.id);
    setRateForm({ name: item.name, hours: item.hours === null ? "" : String(item.hours), price: String(item.price) });
    setMessage("");
  }

  function cancelCatalogEdit() { setEditingCatalogId(null); setCatalogForm(emptyCatalog); }
  function cancelRateEdit() { setEditingRateId(null); setRateForm(emptyRate); }

  async function saveCatalog(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    const minimum = asNumber(catalogForm.minimum_price);
    const maximum = asNumber(catalogForm.maximum_price);
    if (!catalogForm.name.trim() || Number.isNaN(minimum) || Number.isNaN(maximum) || maximum < minimum) {
      setMessage("Informe o serviço e uma faixa de valores válida.");
      setSaving(false);
      return;
    }
    const payload = { category: catalogForm.category.trim() || "Mecânica geral", name: catalogForm.name.trim(), minimum_price: minimum, maximum_price: maximum };
    const result = editingCatalogId
      ? await db.from("labor_price_catalog").update(payload).eq("id", editingCatalogId).eq("workshop_id", workshopId)
      : await db.from("labor_price_catalog").insert({ workshop_id: workshopId, ...payload });
    setSaving(false);
    if (result.error) { setMessage(result.error.code === "23505" ? "Este serviço já está na sua lista." : result.error.message); return; }
    cancelCatalogEdit();
    setMessage(editingCatalogId ? "Serviço atualizado na precificação." : "Serviço adicionado à precificação.");
    void load();
  }

  async function saveRate(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    const price = asNumber(rateForm.price);
    if (!rateForm.name.trim() || Number.isNaN(price)) {
      setMessage("Informe o nome e o valor do tempo de trabalho.");
      setSaving(false);
      return;
    }
    const payload = { name: rateForm.name.trim(), hours: rateForm.hours ? asNumber(rateForm.hours) : null, price };
    const result = editingRateId
      ? await db.from("labor_time_rates").update(payload).eq("id", editingRateId).eq("workshop_id", workshopId)
      : await db.from("labor_time_rates").insert({ workshop_id: workshopId, ...payload });
    setSaving(false);
    if (result.error) { setMessage(result.error.code === "23505" ? "Este item já está na sua lista." : result.error.message); return; }
    cancelRateEdit();
    setMessage(editingRateId ? "Tempo de trabalho atualizado." : "Tempo de mão de obra adicionado.");
    void load();
  }

  async function adjust() {
    const amount = Number(percent.replace(",", "."));
    if (Number.isNaN(amount) || amount === 0) { setMessage("Informe o percentual de reajuste. Exemplo: 5"); return; }
    setUpdating(true);
    setMessage("Aguarde, estamos atualizando a lista…");
    const { error } = await db.rpc("adjust_labor_prices", { p_workshop_id: workshopId, p_percent: amount });
    setUpdating(false);
    if (error) { setMessage(error.message); return; }
    setPercent("");
    setMessage("Lista atualizada com sucesso.");
    void load();
  }

  return <section className="mt-8 rounded-xl border border-zinc-800 bg-[#1A1A1A] p-5">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-bold tracking-[.18em] text-[#FFC107]">PRECIFICAÇÃO</p><h2 className="mt-1 text-xl font-bold">Mão de obra e reajuste geral</h2><p className="mt-1 max-w-2xl text-sm text-zinc-400">Use o reajuste para atualizar toda a lista. Para alterar apenas um serviço ou tempo, toque em Editar no item desejado.</p></div><div className="flex gap-2"><input value={percent} onChange={(e) => setPercent(e.target.value)} inputMode="decimal" className="field w-28" placeholder="Ex.: 5%"/><button type="button" disabled={updating} onClick={() => void adjust()} className="rounded-lg bg-[#FFC107] px-4 py-2 font-bold text-black disabled:cursor-wait disabled:opacity-60">{updating ? "Atualizando…" : "Reajustar lista"}</button></div></div>
    {message && <p role="status" className="mt-4 rounded-lg bg-black/20 p-3 text-sm text-[#FFC107]">{message}</p>}
    <div className="mt-6 grid gap-6 xl:grid-cols-2">
      <div><h3 className="font-semibold">Serviços cadastrados</h3><div className="mt-3 max-h-96 space-y-2 overflow-auto pr-1">{catalog.map((item) => <div key={item.id} className="flex items-center justify-between gap-3 rounded-lg border border-zinc-800 bg-black/20 p-3"><div><b>{item.name}</b><p className="text-xs text-zinc-400">{item.category} · {money.format(item.minimum_price)} a {money.format(item.maximum_price)}</p></div><button type="button" onClick={() => startCatalogEdit(item)} className="text-sm font-bold text-[#FFC107]">Editar</button></div>)}{catalog.length === 0 && <p className="text-sm text-zinc-500">A lista será carregada após a atualização do banco.</p>}</div>
        <form onSubmit={saveCatalog} className="mt-4 grid gap-2"><input value={catalogForm.name} onChange={(e) => setCatalogForm({ ...catalogForm, name: e.target.value })} className="field" placeholder="Novo serviço"/><div className="grid grid-cols-3 gap-2"><input value={catalogForm.category} onChange={(e) => setCatalogForm({ ...catalogForm, category: e.target.value })} className="field" placeholder="Categoria"/><input value={catalogForm.minimum_price} onChange={(e) => setCatalogForm({ ...catalogForm, minimum_price: e.target.value })} className="field" inputMode="decimal" placeholder="Mínimo R$"/><input value={catalogForm.maximum_price} onChange={(e) => setCatalogForm({ ...catalogForm, maximum_price: e.target.value })} className="field" inputMode="decimal" placeholder="Máximo R$"/></div><div className="flex gap-2"><button disabled={saving} className="rounded-lg border border-[#FFC107] px-4 py-2 font-bold text-[#FFC107] disabled:opacity-60">{saving ? "Salvando…" : editingCatalogId ? "Salvar alteração" : "Adicionar serviço"}</button>{editingCatalogId && <button type="button" onClick={cancelCatalogEdit} className="rounded-lg border border-zinc-700 px-4 py-2 font-semibold">Cancelar</button>}</div></form>
      </div>
      <div><h3 className="font-semibold">Tempo de trabalho</h3><div className="mt-3 space-y-2">{rates.map((item) => <div key={item.id} className="flex items-center justify-between gap-3 rounded-lg border border-zinc-800 bg-black/20 p-3"><div><b>{item.name}</b><p className="text-xs text-zinc-400">{item.hours ? `${item.hours}h · ` : ""}{money.format(item.price)}</p></div><button type="button" onClick={() => startRateEdit(item)} className="text-sm font-bold text-[#FFC107]">Editar</button></div>)}{rates.length === 0 && <p className="text-sm text-zinc-500">A lista será carregada após a atualização do banco.</p>}</div>
        <form onSubmit={saveRate} className="mt-4 grid gap-2"><div className="grid grid-cols-[1fr_100px_120px] gap-2"><input value={rateForm.name} onChange={(e) => setRateForm({ ...rateForm, name: e.target.value })} className="field" placeholder="Novo tempo de trabalho"/><input value={rateForm.hours} onChange={(e) => setRateForm({ ...rateForm, hours: e.target.value })} className="field" inputMode="decimal" placeholder="Horas"/><input value={rateForm.price} onChange={(e) => setRateForm({ ...rateForm, price: e.target.value })} className="field" inputMode="decimal" placeholder="Valor R$"/></div><div className="flex gap-2"><button disabled={saving} className="rounded-lg border border-[#FFC107] px-4 py-2 font-bold text-[#FFC107] disabled:opacity-60">{saving ? "Salvando…" : editingRateId ? "Salvar alteração" : "Adicionar tempo"}</button>{editingRateId && <button type="button" onClick={cancelRateEdit} className="rounded-lg border border-zinc-700 px-4 py-2 font-semibold">Cancelar</button>}</div></form>
      </div>
    </div>
  </section>;
}
