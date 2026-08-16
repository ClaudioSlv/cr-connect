"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Customer = { id: string; full_name: string };
type Vehicle = { id: string; client_id: string; plate: string | null; brand: string; model: string; version: string | null; year_model: number | null; fuel: string | null; engine: string | null; mileage: number | null; notes: string | null; timing_belt_changed_at: string | null; timing_belt_changed_mileage: number | null; timing_belt_reminder_at: string | null; timing_belt_reminder_mileage: number | null; clients: Customer | null };

const empty = { client_id: "", plate: "", brand: "", model: "", version: "", year_model: "", fuel: "", engine: "", mileage: "", notes: "", timing_belt_changed_at: "", timing_belt_changed_mileage: "", timing_belt_reminder_at: "", timing_belt_reminder_mileage: "" };

function fourYearsAfter(date: string) {
  if (!date) return "";
  const value = new Date(`${date}T12:00:00`);
  value.setFullYear(value.getFullYear() + 4);
  return value.toISOString().slice(0, 10);
}

function dateLabel(value: string | null) {
  return value ? new Date(`${value}T12:00:00`).toLocaleDateString("pt-BR") : "não programado";
}

export function VehiclesManager({ workshopId }: { workshopId: string }) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [items, setItems] = useState<Vehicle[]>([]);
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const db = createClient();

  async function load() {
    const [customersResult, vehiclesResult] = await Promise.all([
      db.from("clients").select("id,full_name").eq("workshop_id", workshopId).order("full_name"),
      db.from("vehicles").select("id,client_id,plate,brand,model,version,year_model,fuel,engine,mileage,notes,timing_belt_changed_at,timing_belt_changed_mileage,timing_belt_reminder_at,timing_belt_reminder_mileage,clients(id,full_name)").eq("workshop_id", workshopId).order("created_at", { ascending: false }),
    ]);
    if (customersResult.error || vehiclesResult.error) setMessage(customersResult.error?.message || vehiclesResult.error?.message || "");
    else { setCustomers((customersResult.data || []) as Customer[]); setItems((vehiclesResult.data || []) as unknown as Vehicle[]); }
  }
  useEffect(() => { void load(); }, []);

  const filtered = useMemo(() => items.filter((vehicle) => `${vehicle.plate ?? ""} ${vehicle.brand} ${vehicle.model} ${vehicle.clients?.full_name ?? ""}`.toLowerCase().includes(query.toLowerCase())), [items, query]);
  function change(key: keyof typeof empty, value: string) { setForm((current) => ({ ...current, [key]: value })); }

  async function submit(event: FormEvent) {
    event.preventDefault(); setSaving(true); setMessage("");
    const payload = { workshop_id: workshopId, client_id: form.client_id, plate: form.plate.toUpperCase().replace(/[^A-Z0-9]/g, "") || null, brand: form.brand.trim(), model: form.model.trim(), version: form.version.trim() || null, year_model: form.year_model ? Number(form.year_model) : null, fuel: form.fuel.trim() || null, engine: form.engine.trim() || null, mileage: form.mileage ? Number(form.mileage) : null, notes: form.notes.trim() || null, timing_belt_changed_at: form.timing_belt_changed_at || null, timing_belt_changed_mileage: form.timing_belt_changed_mileage ? Number(form.timing_belt_changed_mileage) : null, timing_belt_reminder_at: form.timing_belt_reminder_at || null, timing_belt_reminder_mileage: form.timing_belt_reminder_mileage ? Number(form.timing_belt_reminder_mileage) : null };
    const result = editing ? await db.from("vehicles").update(payload).eq("id", editing).eq("workshop_id", workshopId) : await db.from("vehicles").insert(payload);
    if (result.error) setMessage(result.error.code === "23505" ? "Já existe um veículo com esta placa." : result.error.message);
    else { setForm(empty); setEditing(null); setMessage("Veículo e lembrete preventivo salvos com sucesso."); await load(); }
    setSaving(false);
  }

  function edit(vehicle: Vehicle) {
    setEditing(vehicle.id);
    setForm({ client_id: vehicle.client_id, plate: vehicle.plate ?? "", brand: vehicle.brand, model: vehicle.model, version: vehicle.version ?? "", year_model: vehicle.year_model?.toString() ?? "", fuel: vehicle.fuel ?? "", engine: vehicle.engine ?? "", mileage: vehicle.mileage?.toString() ?? "", notes: vehicle.notes ?? "", timing_belt_changed_at: vehicle.timing_belt_changed_at ?? "", timing_belt_changed_mileage: vehicle.timing_belt_changed_mileage?.toString() ?? "", timing_belt_reminder_at: vehicle.timing_belt_reminder_at ?? "", timing_belt_reminder_mileage: vehicle.timing_belt_reminder_mileage?.toString() ?? "" });
  }
  async function remove(id: string) {
    if (!confirm("Excluir este veículo? Ordens de serviço vinculadas impedem a exclusão.")) return;
    const { error } = await db.from("vehicles").delete().eq("id", id).eq("workshop_id", workshopId);
    setMessage(error ? error.message : "Veículo excluído.");
    if (!error) { if (editing === id) { setEditing(null); setForm(empty); } await load(); }
  }

  return <div className="grid gap-8 xl:grid-cols-[430px_1fr]"><form onSubmit={submit} className="h-fit rounded-xl border border-zinc-800 bg-[#1A1A1A] p-5"><h2 className="font-semibold">{editing ? "Editar veículo" : "Novo veículo"}</h2>{customers.length === 0 ? <p className="mt-4 rounded-lg bg-amber-500/10 p-3 text-sm text-amber-300">Cadastre um cliente antes de adicionar um veículo.</p> : <div className="mt-4 grid gap-3"><select required value={form.client_id} onChange={(event) => change("client_id", event.target.value)} className="field"><option value="">Cliente *</option>{customers.map((customer) => <option value={customer.id} key={customer.id}>{customer.full_name}</option>)}</select><input value={form.plate} onChange={(event) => change("plate", event.target.value)} placeholder="Placa" className="field"/><div className="grid grid-cols-2 gap-3"><input required value={form.brand} onChange={(event) => change("brand", event.target.value)} placeholder="Marca *" className="field"/><input required value={form.model} onChange={(event) => change("model", event.target.value)} placeholder="Modelo *" className="field"/></div><input value={form.version} onChange={(event) => change("version", event.target.value)} placeholder="Versão" className="field"/><div className="grid grid-cols-2 gap-3"><input value={form.year_model} onChange={(event) => change("year_model", event.target.value)} type="number" placeholder="Ano" className="field"/><input value={form.mileage} onChange={(event) => change("mileage", event.target.value)} type="number" placeholder="Quilometragem atual" className="field"/></div><input value={form.fuel} onChange={(event) => change("fuel", event.target.value)} placeholder="Combustível" className="field"/><input value={form.engine} onChange={(event) => change("engine", event.target.value)} placeholder="Motor" className="field"/><textarea value={form.notes} onChange={(event) => change("notes", event.target.value)} placeholder="Observações" className="field min-h-20"/><fieldset className="rounded-xl border border-[#6b510d] bg-black/20 p-4"><legend className="px-1 text-sm font-bold text-[#FFC107]">Correia dentada · lembrete preventivo</legend><p className="mb-3 text-xs text-zinc-400">O prazo padrão é 4 anos. Confirme sempre o manual do veículo e ajuste se necessário.</p><div className="grid gap-3 sm:grid-cols-2"><label className="text-sm text-zinc-300">Última troca<input type="date" value={form.timing_belt_changed_at} onChange={(event) => { change("timing_belt_changed_at", event.target.value); if (!form.timing_belt_reminder_at || form.timing_belt_reminder_at === fourYearsAfter(form.timing_belt_changed_at)) change("timing_belt_reminder_at", fourYearsAfter(event.target.value)); }} className="field mt-1"/></label><label className="text-sm text-zinc-300">Km na troca<input type="number" min="0" value={form.timing_belt_changed_mileage} onChange={(event) => change("timing_belt_changed_mileage", event.target.value)} placeholder="Ex.: 40000" className="field mt-1"/></label><label className="text-sm text-zinc-300">Avisar em<input type="date" value={form.timing_belt_reminder_at} onChange={(event) => change("timing_belt_reminder_at", event.target.value)} className="field mt-1"/></label><label className="text-sm text-zinc-300">Ou ao atingir km<input type="number" min="0" value={form.timing_belt_reminder_mileage} onChange={(event) => change("timing_belt_reminder_mileage", event.target.value)} placeholder="Opcional" className="field mt-1"/></label></div></fieldset></div>}<div className="mt-4 flex gap-2"><button disabled={saving || customers.length === 0} className="rounded-lg bg-[#FFC107] px-4 py-2 font-bold text-black disabled:opacity-60">{saving ? "Salvando..." : "Salvar"}</button>{editing && <button type="button" onClick={() => { setEditing(null); setForm(empty); }} className="rounded-lg border border-zinc-700 px-4 py-2">Cancelar</button>}</div>{message && <p className="mt-3 text-sm text-zinc-300">{message}</p>}</form><section><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-semibold">Veículos</h2><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar placa, modelo ou cliente" className="field max-w-xs"/></div><div className="mt-4 overflow-hidden rounded-xl border border-zinc-800"><table className="w-full text-left text-sm"><thead className="bg-[#1A1A1A] text-zinc-400"><tr><th className="p-3">Veículo</th><th className="p-3">Cliente</th><th className="p-3">Correia dentada</th><th className="p-3"></th></tr></thead><tbody>{filtered.map((vehicle) => <tr key={vehicle.id} className="border-t border-zinc-800"><td className="p-3"><strong>{vehicle.brand} {vehicle.model}</strong><br/><span className="text-zinc-500">{vehicle.plate || "Sem placa"}{vehicle.year_model ? ` · ${vehicle.year_model}` : ""}</span></td><td className="p-3 text-zinc-400">{vehicle.clients?.full_name || "—"}</td><td className="p-3"><span className={vehicle.timing_belt_reminder_at && vehicle.timing_belt_reminder_at <= new Date().toISOString().slice(0, 10) ? "font-bold text-red-300" : "text-zinc-400"}>Avisar: {dateLabel(vehicle.timing_belt_reminder_at)}</span>{vehicle.timing_belt_reminder_mileage && <small className="block text-zinc-500">ou {vehicle.timing_belt_reminder_mileage.toLocaleString("pt-BR")} km</small>}</td><td className="p-3 text-right"><button type="button" onClick={() => edit(vehicle)} className="mr-3 text-[#FFC107]">Editar</button><button type="button" onClick={() => void remove(vehicle.id)} className="text-red-400">Excluir</button></td></tr>)}{filtered.length === 0 && <tr><td colSpan={4} className="p-8 text-center text-zinc-500">Nenhum veículo encontrado.</td></tr>}</tbody></table></div></section></div>;
}
