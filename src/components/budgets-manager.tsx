"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { PrintDocument } from "@/components/print-document";

type Client = { id: string; full_name: string };
type Vehicle = { id: string; client_id: string; brand: string; model: string };
type Budget = { id: string; client_id: string; vehicle_id: string; status: string; clients: Client | null; vehicles: Vehicle | null };
type Item = { id: string; description: string; kind: string; quantity: number; unit_price: number; discount: number };
type Catalog = { id: string; category: string; name: string; minimum_price: number; maximum_price: number };
type TimeRate = { id: string; name: string; price: number };
const states = [["draft", "Rascunho"], ["sent", "Enviado · aguardando confirmação"], ["approved", "Aprovado"], ["rejected", "Recusado"], ["expired", "Expirado"]];
const priceText = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function BudgetsManager({ workshopId }: { workshopId: string }) {
  const db = createClient();
  const [clients, setClients] = useState<Client[]>([]); const [vehicles, setVehicles] = useState<Vehicle[]>([]); const [budgets, setBudgets] = useState<Budget[]>([]); const [catalog, setCatalog] = useState<Catalog[]>([]); const [timeRates, setTimeRates] = useState<TimeRate[]>([]);
  const [selected, setSelected] = useState<Budget | null>(null); const [items, setItems] = useState<Item[]>([]);
  const [client, setClient] = useState(""); const [vehicle, setVehicle] = useState(""); const [kind, setKind] = useState("service"); const [description, setDescription] = useState(""); const [price, setPrice] = useState(""); const [saveInCatalog, setSaveInCatalog] = useState(false); const [message, setMessage] = useState(""); const [saving, setSaving] = useState(false);
  const [catalogOpen, setCatalogOpen] = useState(false); const [timeRatesOpen, setTimeRatesOpen] = useState(false);
  const [selectedCatalogIds, setSelectedCatalogIds] = useState<string[]>([]); const [selectedTimeRateIds, setSelectedTimeRateIds] = useState<string[]>([]);
  const [discountMode, setDiscountMode] = useState<"value" | "percent">("value"); const [discountInput, setDiscountInput] = useState("");
  const [editingItemId, setEditingItemId] = useState<string | null>(null); const [editingDescription, setEditingDescription] = useState(""); const [editingPrice, setEditingPrice] = useState(""); const [editingDiscountMode, setEditingDiscountMode] = useState<"value" | "percent">("value"); const [editingDiscountInput, setEditingDiscountInput] = useState("");

  async function load() {
    const [clientsResult, vehiclesResult, budgetsResult, catalogResult, ratesResult] = await Promise.all([
      db.from("clients").select("id,full_name").eq("workshop_id", workshopId),
      db.from("vehicles").select("id,client_id,brand,model").eq("workshop_id", workshopId),
      db.from("budgets").select("id,client_id,vehicle_id,status,clients(id,full_name),vehicles(id,client_id,brand,model)").eq("workshop_id", workshopId).order("created_at", { ascending: false }),
      db.from("labor_price_catalog").select("id,category,name,minimum_price,maximum_price").eq("workshop_id", workshopId).order("category").order("name"),
      db.from("labor_time_rates").select("id,name,price").eq("workshop_id", workshopId).order("name"),
    ]);
    setClients((clientsResult.data || []) as Client[]); setVehicles((vehiclesResult.data || []) as Vehicle[]); setBudgets((budgetsResult.data || []) as unknown as Budget[]);
    setCatalog((catalogResult.data || []) as Catalog[]); setTimeRates((ratesResult.data || []) as TimeRate[]);
  }
  async function loadItems(id: string) { const { data } = await db.from("budget_items").select("id,description,kind,quantity,unit_price,discount").eq("workshop_id", workshopId).eq("budget_id", id); setItems((data || []) as Item[]); }
  useEffect(() => { void load(); }, []);
  const allowed = vehicles.filter((item) => item.client_id === client);
  const total = useMemo(() => items.reduce((sum, item) => sum + Number(item.quantity) * Number(item.unit_price) - Number(item.discount), 0), [items]);
  const parsePrice = (value: string) => { const clean = value.replace(/[^0-9,.-]/g, "").trim(); return Number(clean.includes(",") ? clean.replace(/\./g, "").replace(",", ".") : clean); };
  function calculateDiscount(unitPrice: number, mode: "value" | "percent", value: string) {
    if (!value.trim()) return 0;
    const parsed = parsePrice(value);
    if (Number.isNaN(parsed) || parsed < 0 || (mode === "percent" && parsed > 100)) return null;
    const amount = mode === "percent" ? unitPrice * (parsed / 100) : parsed;
    return amount > unitPrice ? null : amount;
  }

  async function create(event: FormEvent) {
    event.preventDefault(); setSaving(true); setMessage("");
    const existing = await db.from("budgets").select("id,client_id,vehicle_id,status,clients(id,full_name),vehicles(id,client_id,brand,model)").eq("workshop_id", workshopId).eq("client_id", client).eq("vehicle_id", vehicle).in("status", ["draft", "sent"]).limit(1).maybeSingle();
    if (existing.data) { const openBudget = existing.data as unknown as Budget; setSelected(openBudget); void loadItems(openBudget.id); setMessage("Já existe um orçamento em aberto para este cliente e veículo. Ele foi aberto para edição."); setSaving(false); return; }
    const { data, error } = await db.from("budgets").insert({ workshop_id: workshopId, client_id: client, vehicle_id: vehicle, status: "draft" }).select("id,client_id,vehicle_id,status,clients(id,full_name),vehicles(id,client_id,brand,model)").single();
    setSaving(false); if (error) setMessage(error.message); else { setSelected(data as unknown as Budget); setItems([]); setMessage("Orçamento criado. Adicione serviços e peças."); void load(); }
  }
  function toggleSelected(id: string, current: string[], setCurrent: (items: string[]) => void) {
    setCurrent(current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }
  async function reopenForEditing() {
    if (!selected || selected.status !== "sent") return true;
    const { error } = await db.from("budgets").update({ status: "draft" }).eq("id", selected.id).eq("workshop_id", workshopId);
    if (error) { setMessage(error.message); return false; }
    setSelected({ ...selected, status: "draft" });
    void load();
    return true;
  }
  async function applySelectedPricing() {
    if (!selected) return;
    const selectedServices = catalog.filter((item) => selectedCatalogIds.includes(item.id));
    const selectedRates = timeRates.filter((item) => selectedTimeRateIds.includes(item.id));
    if (selectedServices.length + selectedRates.length === 0) { setMessage("Selecione pelo menos um serviço ou tempo de trabalho."); return; }
    setSaving(true); setMessage("Aplicando itens no orçamento…");
    if (!await reopenForEditing()) { setSaving(false); return; }
    const { error } = await db.from("budget_items").insert([
      ...selectedServices.map((item) => ({ workshop_id: workshopId, budget_id: selected.id, kind: "service", description: item.name, quantity: 1, unit_price: item.minimum_price, discount: 0 })),
      ...selectedRates.map((item) => ({ workshop_id: workshopId, budget_id: selected.id, kind: "service", description: item.name, quantity: 1, unit_price: item.price, discount: 0 })),
    ]);
    setSaving(false);
    if (error) { setMessage(error.message); return; }
    setSelectedCatalogIds([]); setSelectedTimeRateIds([]); setCatalogOpen(false); setTimeRatesOpen(false);
    setMessage("Itens aplicados ao orçamento. As listas foram fechadas.");
    void loadItems(selected.id);
  }
  async function add(event: FormEvent) {
    event.preventDefault(); if (!selected) return; const unitPrice = parsePrice(price);
    if (!description.trim() || Number.isNaN(unitPrice)) { setMessage("Informe a descrição e o valor do item."); return; }
    const discount = calculateDiscount(unitPrice, discountMode, discountInput);
    if (discount === null) { setMessage("Informe um desconto válido."); return; }
    setSaving(true); setMessage("");
    if (!await reopenForEditing()) { setSaving(false); return; }
    const result = await db.from("budget_items").insert({ workshop_id: workshopId, budget_id: selected.id, kind, description: description.trim(), quantity: 1, unit_price: unitPrice, discount });
    if (!result.error && saveInCatalog && kind === "service") await db.from("labor_price_catalog").upsert({ workshop_id: workshopId, category: "Serviço personalizado", name: description.trim(), minimum_price: unitPrice, maximum_price: unitPrice }, { onConflict: "workshop_id,name" });
    setSaving(false); if (result.error) setMessage(result.error.message); else { setDescription(""); setPrice(""); setDiscountInput(""); setDiscountMode("value"); setSaveInCatalog(false); setMessage(saveInCatalog ? "Item adicionado e salvo na precificação." : "Item adicionado ao orçamento."); void loadItems(selected.id); void load(); }
  }
  function editItem(item: Item) { setEditingItemId(item.id); setEditingDescription(item.description); setEditingPrice(String(item.unit_price)); setEditingDiscountMode("value"); setEditingDiscountInput(item.discount ? String(item.discount) : ""); setMessage(""); }
  function cancelItemEdit() { setEditingItemId(null); setEditingDescription(""); setEditingPrice(""); setEditingDiscountInput(""); setEditingDiscountMode("value"); }
  async function saveItemEdit(item: Item) {
    const unitPrice = parsePrice(editingPrice); const discount = calculateDiscount(unitPrice, editingDiscountMode, editingDiscountInput);
    if (!editingDescription.trim() || Number.isNaN(unitPrice) || discount === null) { setMessage("Confira a descrição, o valor e o desconto do item."); return; }
    setSaving(true); setMessage("Salvando alteração…");
    if (!await reopenForEditing()) { setSaving(false); return; }
    const { error } = await db.from("budget_items").update({ description: editingDescription.trim(), unit_price: unitPrice, discount }).eq("id", item.id).eq("workshop_id", workshopId);
    setSaving(false); if (error) { setMessage(error.message); return; }
    cancelItemEdit(); setMessage("Item do orçamento atualizado."); if (selected) void loadItems(selected.id);
  }
  async function removeItem(item: Item) { if (!window.confirm(`Excluir “${item.description}” deste orçamento?`)) return; if (!await reopenForEditing()) return; const { error } = await db.from("budget_items").delete().eq("id", item.id).eq("workshop_id", workshopId); setMessage(error?.message || "Item excluído. Envie novamente para o cliente caso já estivesse em aprovação."); if (!error && selected) void loadItems(selected.id); }
  async function removeBudget(budget: Budget) { if (!window.confirm(`Excluir este orçamento de ${budget.clients?.full_name || "cliente"}?`)) return; const { error } = await db.from("budgets").delete().eq("id", budget.id).eq("workshop_id", workshopId); if (!error && selected?.id === budget.id) { setSelected(null); setItems([]); } setMessage(error?.message || "Orçamento excluído."); if (!error) void load(); }
  async function send() { if (!selected || items.length === 0) { setMessage("Adicione pelo menos um serviço ou peça antes de enviar."); return; } setSaving(true); const { error } = await db.from("budgets").update({ status: "sent" }).eq("id", selected.id).eq("workshop_id", workshopId); setSaving(false); if (!error) { setSelected({ ...selected, status: "sent" }); void fetch("/api/push-order", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: selected.id, event: "budget" }) }); void load(); } setMessage(error?.message || "Orçamento enviado. O cliente receberá um aviso no aplicativo."); }
  function choose(budget: Budget) { setSelected(budget); setClient(budget.client_id); setVehicle(budget.vehicle_id); setItems([]); void loadItems(budget.id); }

  return <div className="grid gap-8 xl:grid-cols-[400px_1fr]">
    <form onSubmit={create} className="h-fit rounded-xl border border-zinc-800 bg-[#1A1A1A] p-5"><h2 className="font-semibold">Novo orçamento</h2><div className="mt-4 grid gap-3"><select required className="field" value={client} onChange={(event) => { setClient(event.target.value); setVehicle(""); }}><option value="">Cliente *</option>{clients.map((item) => <option key={item.id} value={item.id}>{item.full_name}</option>)}</select><select required className="field" disabled={!client} value={vehicle} onChange={(event) => setVehicle(event.target.value)}><option value="">Veículo *</option>{allowed.map((item) => <option key={item.id} value={item.id}>{item.brand} {item.model}</option>)}</select></div><button disabled={saving} className="mt-4 rounded-lg bg-[#FFC107] px-4 py-2 font-bold text-black disabled:opacity-60">{saving ? "Aguarde…" : "Criar orçamento"}</button>{message && <p className="mt-3 text-sm text-[#FFC107]">{message}</p>}</form>
    <section><h2 className="text-xl font-semibold">Orçamentos</h2><div className="mt-3 space-y-3">{budgets.map((budget) => <article key={budget.id} className="rounded-xl border border-zinc-800 bg-[#171717] p-4"><div className="flex flex-wrap justify-between gap-3"><span><b>{budget.clients?.full_name}</b><small className="mt-1 block text-zinc-400">{budget.vehicles?.brand} {budget.vehicles?.model}</small></span><b className={budget.status === "approved" ? "text-emerald-400" : budget.status === "rejected" ? "text-red-400" : "text-[#FFC107]"}>{states.find((item) => item[0] === budget.status)?.[1]}</b></div><div className="mt-4 flex flex-wrap gap-3"><button type="button" onClick={() => choose(budget)} className="rounded-lg bg-[#FFC107] px-4 py-2 font-bold text-black">Editar orçamento</button><button type="button" onClick={() => void removeBudget(budget)} className="rounded-lg border border-red-500/70 px-4 py-2 font-bold text-red-300">Excluir</button></div></article>)}</div>
    {selected && <div className="mt-5 rounded-xl border border-zinc-800 bg-[#1A1A1A] p-5"><div className="flex flex-wrap items-center justify-between gap-3"><h3 className="font-semibold">Itens, serviços e valores</h3><PrintDocument type="Orçamento" number={selected.id.slice(0, 8).toUpperCase()} client={selected.clients?.full_name || "Cliente"} vehicle={`${selected.vehicles?.brand || ""} ${selected.vehicles?.model || ""}`} status={states.find((item) => item[0] === selected.status)?.[1] || selected.status} items={items} /></div>
      <div className="mt-4 space-y-3">
        <div className="rounded-lg border border-zinc-800 bg-black/20"><button type="button" onClick={() => setCatalogOpen((open) => !open)} className="flex w-full items-center justify-between px-4 py-3 text-left font-bold"><span>Serviços da precificação</span><span className="text-[#FFC107]">{catalogOpen ? "Fechar −" : "Abrir +"}</span></button>{catalogOpen && <div className="border-t border-zinc-800 p-3"><p className="mb-3 text-sm text-zinc-400">Marque todos os serviços que deseja colocar neste orçamento.</p><div className="space-y-2">{catalog.map((item) => <label key={item.id} className="flex cursor-pointer items-start gap-3 rounded-lg border border-zinc-800 p-3"><input type="checkbox" checked={selectedCatalogIds.includes(item.id)} onChange={() => toggleSelected(item.id, selectedCatalogIds, setSelectedCatalogIds)} className="mt-1 h-4 w-4 accent-[#FFC107]"/><span><b>{item.name}</b><small className="mt-1 block text-zinc-400">{item.category} · {priceText(item.minimum_price)} a {priceText(item.maximum_price)}</small></span></label>)}{catalog.length === 0 && <p className="text-sm text-zinc-500">Nenhum serviço cadastrado na precificação.</p>}</div></div>}</div>
        <div className="rounded-lg border border-zinc-800 bg-black/20"><button type="button" onClick={() => setTimeRatesOpen((open) => !open)} className="flex w-full items-center justify-between px-4 py-3 text-left font-bold"><span>Tempo de trabalho</span><span className="text-[#FFC107]">{timeRatesOpen ? "Fechar −" : "Abrir +"}</span></button>{timeRatesOpen && <div className="border-t border-zinc-800 p-3"><p className="mb-3 text-sm text-zinc-400">Marque os tempos de mão de obra que deseja aplicar.</p><div className="space-y-2">{timeRates.map((item) => <label key={item.id} className="flex cursor-pointer items-start gap-3 rounded-lg border border-zinc-800 p-3"><input type="checkbox" checked={selectedTimeRateIds.includes(item.id)} onChange={() => toggleSelected(item.id, selectedTimeRateIds, setSelectedTimeRateIds)} className="mt-1 h-4 w-4 accent-[#FFC107]"/><span><b>{item.name}</b><small className="mt-1 block text-zinc-400">{priceText(item.price)}</small></span></label>)}{timeRates.length === 0 && <p className="text-sm text-zinc-500">Nenhum tempo de trabalho cadastrado.</p>}</div></div>}</div>
        {(catalogOpen || timeRatesOpen) && <button type="button" disabled={saving || (!selectedCatalogIds.length && !selectedTimeRateIds.length)} onClick={() => void applySelectedPricing()} className="w-full rounded-lg bg-[#FFC107] px-4 py-3 font-bold text-black disabled:opacity-60">{saving ? "Aplicando…" : "Aplicar itens selecionados"}</button>}
      </div>
      <form onSubmit={add} className="mt-3 grid gap-3 sm:grid-cols-[150px_1fr_160px_auto]"><select className="field min-h-14" value={kind} onChange={(event) => setKind(event.target.value)}><option value="service">Serviço</option><option value="part">Peça</option></select><textarea required className="field min-h-20" placeholder="Descreva o serviço, peça ou mão de obra" value={description} onChange={(event) => setDescription(event.target.value)} /><input required className="field min-h-20" inputMode="decimal" placeholder="Valor (R$)" value={price} onChange={(event) => setPrice(event.target.value)} /><button disabled={saving} className="rounded-lg bg-[#FFC107] px-5 py-3 font-bold text-black disabled:opacity-60">{saving ? "Aguarde…" : "Adicionar"}</button><div className="sm:col-span-4 grid grid-cols-[150px_1fr] gap-3"><select className="field" value={discountMode} onChange={(event) => setDiscountMode(event.target.value as "value" | "percent")}><option value="value">Desconto em R$</option><option value="percent">Desconto em %</option></select><input className="field" inputMode="decimal" placeholder={discountMode === "percent" ? "Desconto (%)" : "Desconto (R$)"} value={discountInput} onChange={(event) => setDiscountInput(event.target.value)} /></div></form>
      {kind === "service" && <label className="mt-3 flex items-center gap-2 text-sm text-zinc-300"><input type="checkbox" checked={saveInCatalog} onChange={(event) => setSaveInCatalog(event.target.checked)} /> Salvar este novo serviço também na minha precificação</label>}
      {items.map((item) => editingItemId === item.id ? <div key={item.id} className="mt-3 rounded-lg border border-[#FFC107]/70 bg-zinc-900 p-3"><p className="mb-3 text-sm font-bold text-[#FFC107]">Editar item do orçamento</p><div className="grid gap-3 sm:grid-cols-[1fr_160px]"><textarea className="field min-h-20" value={editingDescription} onChange={(event) => setEditingDescription(event.target.value)} /><input className="field min-h-20" inputMode="decimal" value={editingPrice} onChange={(event) => setEditingPrice(event.target.value)} placeholder="Valor (R$)"/></div><div className="mt-3 grid grid-cols-[150px_1fr] gap-3"><select className="field" value={editingDiscountMode} onChange={(event) => setEditingDiscountMode(event.target.value as "value" | "percent")}><option value="value">Desconto em R$</option><option value="percent">Desconto em %</option></select><input className="field" inputMode="decimal" value={editingDiscountInput} onChange={(event) => setEditingDiscountInput(event.target.value)} placeholder={editingDiscountMode === "percent" ? "Desconto (%)" : "Desconto (R$)"}/></div><div className="mt-3 flex gap-2"><button type="button" disabled={saving} onClick={() => void saveItemEdit(item)} className="rounded-lg bg-[#FFC107] px-4 py-2 font-bold text-black disabled:opacity-60">{saving ? "Salvando…" : "Salvar item"}</button><button type="button" onClick={cancelItemEdit} className="rounded-lg border border-zinc-700 px-4 py-2 font-semibold">Cancelar</button></div></div> : <div key={item.id} className="mt-3 flex items-center justify-between gap-3 rounded-lg bg-zinc-900 p-3"><span><b className="text-[#FFC107]">{item.kind === "part" ? "Peça" : "Serviço"}</b><span className="ml-2">{item.description}</span>{Number(item.discount) > 0 && <small className="ml-2 block text-zinc-400">Desconto: {priceText(Number(item.discount))}</small>}</span><span className="flex items-center gap-3"><b>{priceText(Number(item.quantity) * Number(item.unit_price) - Number(item.discount))}</b><button type="button" onClick={() => editItem(item)} className="text-sm font-bold text-[#FFC107]">Editar</button><button type="button" onClick={() => void removeItem(item)} className="text-sm font-bold text-red-300">Excluir</button></span></div>)}
      <p className="mt-5 text-right text-xl font-bold text-[#FFC107]">Total: {priceText(total)}</p>{selected.status === "draft" && <button disabled={saving} type="button" onClick={() => void send()} className="mt-4 w-full rounded-lg bg-[#FFC107] px-4 py-3 font-bold text-black disabled:opacity-60">{saving ? "Aguarde…" : "Enviar para aprovação do cliente"}</button>}</div>}</section></div>;
}
