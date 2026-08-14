"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { OrderItemsPanel } from "@/components/order-items-panel";
import { PrintDocument } from "@/components/print-document";
import { AttachmentsManager } from "@/components/attachments-manager";

type Client = { id: string; full_name: string };
type Vehicle = { id: string; client_id: string; brand: string; model: string; plate: string | null };
type Order = { id: string; number: number; client_id: string; vehicle_id: string; status: string; customer_complaint: string; diagnosis: string | null; notes: string | null; clients: Client | null; vehicles: Vehicle | null };
type OrderItem = { description: string; quantity: number; unit_price: number; discount: number };

const states = [["open", "Aberta"], ["diagnosing", "Em diagnóstico"], ["awaiting_approval", "Aguardando aprovação"], ["awaiting_part", "Aguardando peça"], ["repairing", "Em reparo"], ["finished", "Finalizada"], ["delivered", "Entregue"], ["cancelled", "Cancelada"]];

export function ServiceOrdersManager({ workshopId }: { workshopId: string }) {
  const db = createClient();
  const formRef = useRef<HTMLFormElement>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [selected, setSelected] = useState<Order | null>(null);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [client, setClient] = useState("");
  const [vehicle, setVehicle] = useState("");
  const [status, setStatus] = useState("open");
  const [complaint, setComplaint] = useState("");
  const [diagnosis, setDiagnosis] = useState("");
  const [note, setNote] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    const [clientResult, vehicleResult, orderResult] = await Promise.all([
      db.from("clients").select("id,full_name").eq("workshop_id", workshopId),
      db.from("vehicles").select("id,client_id,brand,model,plate").eq("workshop_id", workshopId),
      db.from("service_orders").select("id,number,client_id,vehicle_id,status,customer_complaint,diagnosis,notes,clients(id,full_name),vehicles(id,client_id,brand,model,plate)").eq("workshop_id", workshopId).order("opened_at", { ascending: false }),
    ]);
    setClients((clientResult.data || []) as Client[]);
    setVehicles((vehicleResult.data || []) as Vehicle[]);
    setOrders((orderResult.data || []) as unknown as Order[]);
  }

  useEffect(() => { void load(); }, []);
  const allowed = vehicles.filter((item) => item.client_id === client);

  async function save(event: FormEvent) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setMessage("Aguarde, salvando a O.S…");
    const payload = { workshop_id: workshopId, client_id: client, vehicle_id: vehicle, status, customer_complaint: complaint, diagnosis: diagnosis || null, notes: note || null };
    const result = selected ? await db.from("service_orders").update(payload).eq("id", selected.id) : await db.from("service_orders").insert(payload);
    setSaving(false);
    setMessage(result.error?.message || "O.S. salva. Você continua nesta tela para fazer outras alterações.");
    if (!result.error) await load();
  }

  async function edit(order: Order) {
    setSelected(order); setClient(order.client_id); setVehicle(order.vehicle_id); setStatus(order.status); setComplaint(order.customer_complaint); setDiagnosis(order.diagnosis || ""); setNote(order.notes || ""); setMessage(`O.S. #${order.number} aberta para edição.`);
    const { data } = await db.from("service_order_items").select("description,quantity,unit_price,discount").eq("workshop_id", workshopId).eq("service_order_id", order.id);
    setOrderItems((data || []) as OrderItem[]);
    window.setTimeout(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
  }

  async function remove(order: Order) {
    if (!window.confirm(`Excluir a O.S. #${order.number} de ${order.clients?.full_name || "cliente"}? Esta ação não pode ser desfeita.`)) return;
    const { error } = await db.from("service_orders").delete().eq("id", order.id).eq("workshop_id", workshopId);
    if (error) { setMessage(error.message); return; }
    if (selected?.id === order.id) { setSelected(null); setOrderItems([]); setClient(""); setVehicle(""); setStatus("open"); setComplaint(""); setDiagnosis(""); setNote(""); }
    setMessage(`O.S. #${order.number} excluída.`);
    await load();
  }

  return <div className="grid gap-7 xl:grid-cols-[420px_1fr]">
    <form ref={formRef} onSubmit={save} className="rounded-xl border border-zinc-800 bg-[#1A1A1A] p-5">
      <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-semibold">{selected ? `Editando O.S. #${selected.number}` : "Nova O.S."}</h2>{selected && <PrintDocument type="Ordem de Serviço" number={`#${selected.number}`} client={selected.clients?.full_name || "Cliente"} vehicle={`${selected.vehicles?.brand || ""} ${selected.vehicles?.model || ""} ${selected.vehicles?.plate || ""}`} status={states.find((item) => item[0] === status)?.[1] || status} note={note || complaint} items={orderItems} />}</div>
      <div className="mt-4 grid gap-3"><select required className="field" value={client} onChange={(event) => { setClient(event.target.value); setVehicle(""); }}><option value="">Cliente *</option>{clients.map((item) => <option key={item.id} value={item.id}>{item.full_name}</option>)}</select><select required className="field" disabled={!client} value={vehicle} onChange={(event) => setVehicle(event.target.value)}><option value="">Veículo *</option>{allowed.map((item) => <option key={item.id} value={item.id}>{item.brand} {item.model} {item.plate ? `(${item.plate})` : ""}</option>)}</select><select className="field" value={status} onChange={(event) => setStatus(event.target.value)}>{states.map((item) => <option key={item[0]} value={item[0]}>{item[1]}</option>)}</select><textarea required className="field min-h-24" placeholder="Reclamação do cliente" value={complaint} onChange={(event) => setComplaint(event.target.value)} /><textarea className="field" placeholder="Diagnóstico" value={diagnosis} onChange={(event) => setDiagnosis(event.target.value)} /><textarea className="field" placeholder="Observações" value={note} onChange={(event) => setNote(event.target.value)} /></div>
      <div className="mt-4 flex flex-wrap gap-3"><button disabled={saving} className="rounded-lg bg-[#FFC107] px-4 py-2 font-bold text-black disabled:cursor-wait disabled:opacity-60">{saving ? "Salvando…" : "Salvar O.S."}</button><a href="/app" className="rounded-lg border border-zinc-600 px-4 py-2 font-bold text-zinc-100">Voltar ao menu</a></div>
      {message && <p className="mt-3 text-sm text-[#FFC107]">{message}</p>}
      {selected && <><OrderItemsPanel workshopId={workshopId} orderId={selected.id} status={status} /><AttachmentsManager workshopId={workshopId} orderId={selected.id} /></>}
    </form>
    <section><h2 className="text-xl font-semibold">Ordens de serviço</h2><p className="mt-1 text-sm text-zinc-400">Toque em Editar O.S. para abrir o atendimento e fazer alterações.</p><div className="mt-4 space-y-3">{orders.map((order) => <article key={order.id} className="rounded-xl border border-zinc-800 bg-[#171717] p-4"><div className="flex flex-wrap justify-between gap-3"><span><b>O.S. #{order.number}</b> · {order.clients?.full_name}<br /><small className="text-zinc-500">{order.vehicles?.brand} {order.vehicles?.model} · {order.vehicles?.plate || "sem placa"}</small></span><b className="text-[#FFC107]">{states.find((item) => item[0] === order.status)?.[1]}</b></div><div className="mt-4 flex flex-wrap gap-3"><button type="button" onClick={() => void edit(order)} className="rounded-lg bg-[#FFC107] px-4 py-2 font-bold text-black">Editar O.S.</button><button type="button" onClick={() => void remove(order)} className="rounded-lg border border-red-500/70 px-4 py-2 font-bold text-red-300">Excluir O.S.</button></div></article>)}</div></section>
  </div>;
}
