"use client";

import { FormEvent, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Vehicle = { id: string; brand: string | null; model: string; plate: string | null; year: number | null };
type Workshop = { id: string; name: string };
type Order = { id: string; number: number; status: string; customer_complaint: string; appointment_requested_at: string | null; appointment_confirmed_at: string | null };
type ServiceRequest = { id: string; complaint: string; status: "requested" | "converted" | "declined"; created_at: string };

const labels: Record<string, string> = { open: "O.S. aberta", diagnosing: "Em diagnóstico", awaiting_approval: "Aguardando sua confirmação", awaiting_part: "Aguardando peça", repairing: "Em reparo", finished: "CARRO PRONTO PARA RETIRADA", delivered: "Entregue", cancelled: "Cancelada" };

function statusStyle(order: Order) {
  if (order.status === "cancelled") return { label: "Cancelado", className: "border-red-500/60 bg-red-500/10 text-red-300" };
  if (order.appointment_confirmed_at || ["finished", "delivered"].includes(order.status)) return { label: order.appointment_confirmed_at ? "Confirmado pela oficina" : labels[order.status], className: "border-emerald-500/60 bg-emerald-500/10 text-emerald-300" };
  if (order.status === "awaiting_approval" || order.appointment_requested_at) return { label: "Aguardando confirmação", className: "border-[#FFC107]/70 bg-[#FFC107]/10 text-[#FFC107]" };
  return { label: labels[order.status] || order.status, className: "border-[#FFC107]/70 bg-[#FFC107]/10 text-[#FFC107]" };
}

export function ClientServiceOrders() {
  const db = createClient();
  const [cars, setCars] = useState<Vehicle[]>([]);
  const [workshops, setWorkshops] = useState<Workshop[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [car, setCar] = useState("");
  const [workshop, setWorkshop] = useState("");
  const [defect, setDefect] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  async function load() {
    const user = (await db.auth.getUser()).data.user;
    if (!user) return;
    const [vehiclesResult, workshopsResult, orderResult, requestResult] = await Promise.all([
      db.from("owner_vehicles").select("id,brand,model,plate,year").eq("owner_id", user.id).order("created_at", { ascending: false }),
      db.rpc("get_order_request_workshops"),
      db.from("service_orders").select("id,number,status,customer_complaint,appointment_requested_at,appointment_confirmed_at").eq("owner_id", user.id).order("created_at", { ascending: false }),
      db.from("service_requests").select("id,complaint,status,created_at").eq("owner_id", user.id).order("created_at", { ascending: false }),
    ]);
    setCars((vehiclesResult.data || []) as Vehicle[]);
    const available = (workshopsResult.data || []) as Workshop[];
    setWorkshops(available);
    setWorkshop((current) => current || available[0]?.id || "");
    setOrders((orderResult.data || []) as Order[]);
    setRequests((requestResult.data || []) as ServiceRequest[]);
  }

  useEffect(() => { void load(); }, []);

  async function send(event: FormEvent) {
    event.preventDefault();
    if (!car || !workshop) { setMessage("Selecione a oficina e o veículo antes de enviar."); return; }
    setSending(true); setMessage("");
    const result = await db.rpc("create_owner_service_request", { p_workshop_id: workshop, p_owner_vehicle_id: car, p_complaint: defect });
    if (result.error) setMessage(result.error.message);
    else {
      void fetch("/api/push-order", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: result.data, event: "request" }) });
      setMessage("Solicitação enviada. A oficina foi avisada.");
      setCar(""); setDefect("");
      await load();
    }
    setSending(false);
  }

  return <section className="mt-8"><p className="text-xs font-bold tracking-[.18em] text-[#FFC107]">PORTAL DO CLIENTE</p><h2 className="mt-2 text-2xl font-bold">Minhas Ordens de Serviço</h2><form onSubmit={send} className="mt-5 rounded-xl border border-[#FFC107] bg-[#171717] p-5"><h3 className="font-bold">Abrir solicitação de O.S.</h3><p className="mt-1 text-sm text-zinc-400">Escolha a oficina, seu veículo e descreva o problema. A oficina receberá seu pedido.</p><select required value={workshop} onChange={(event) => setWorkshop(event.target.value)} className="field mt-3"><option value="">Selecione a oficina</option>{workshops.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><select required value={car} onChange={(event) => setCar(event.target.value)} className="field mt-3"><option value="">Selecione o veículo</option>{cars.map((item) => <option key={item.id} value={item.id}>{item.brand ? `${item.brand} ` : ""}{item.model} {item.plate || ""}</option>)}</select>{cars.length === 0 && <p className="mt-3 text-sm text-[#FFC107]">Cadastre um veículo na sua garagem antes de abrir a O.S.</p>}<textarea required minLength={4} value={defect} onChange={(event) => setDefect(event.target.value)} className="field mt-3 min-h-24" placeholder="Descreva o defeito do carro"/><button disabled={sending || cars.length === 0 || workshops.length === 0} className="mt-3 rounded-lg bg-[#FFC107] px-4 py-2 font-bold text-black disabled:opacity-60">{sending ? "Enviando..." : "Enviar para oficina"}</button>{message && <p role="status" className="mt-3 text-sm text-[#FFC107]">{message}</p>}</form><div className="mt-7 flex items-end justify-between gap-3"><div><h3 className="text-xl font-bold">Status do andamento</h3><p className="mt-1 text-sm text-zinc-400">Verde: confirmado · Amarelo: aguardando · Vermelho: recusado ou cancelado.</p></div><button type="button" onClick={() => void load()} className="rounded-lg border border-zinc-600 px-3 py-2 text-sm font-bold">Atualizar</button></div><div className="mt-4 space-y-3">{requests.map((request) => <article key={request.id} className="rounded-xl border border-zinc-800 bg-[#171717] p-5"><div className="flex flex-wrap items-center justify-between gap-3"><b>Solicitação enviada</b><span className={`rounded-full border px-3 py-1 text-sm font-bold ${request.status === "converted" ? "border-emerald-500/60 bg-emerald-500/10 text-emerald-300" : request.status === "declined" ? "border-red-500/60 bg-red-500/10 text-red-300" : "border-[#FFC107]/70 bg-[#FFC107]/10 text-[#FFC107]"}`}>{request.status === "converted" ? "Aceita pela oficina" : request.status === "declined" ? "Recusada pela oficina" : "Aguardando resposta da oficina"}</span></div><p className="mt-3 text-sm text-zinc-300">{request.complaint}</p></article>)}{orders.map((order) => { const presentation = statusStyle(order); return <article key={order.id} className="rounded-xl border border-zinc-800 bg-[#171717] p-5"><div className="flex flex-wrap items-center justify-between gap-3"><b>O.S. #{order.number}</b><span className={`rounded-full border px-3 py-1 text-sm font-bold ${presentation.className}`}>{presentation.label}</span></div><p className="mt-3 text-sm text-zinc-300">{order.customer_complaint}</p></article>; })}{requests.length === 0 && orders.length === 0 && <p className="rounded-xl border border-zinc-800 bg-[#171717] p-5 text-zinc-400">Nenhuma solicitação ou O.S. encontrada.</p>}</div></section>;
}
