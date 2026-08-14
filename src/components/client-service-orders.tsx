"use client";

import { FormEvent, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Client = { id: string; full_name: string };
type Vehicle = { id: string; brand: string; model: string; plate: string | null };
type Order = { id: string; number: number; status: string; customer_complaint: string; appointment_requested_at: string | null; appointment_confirmed_at: string | null };

const labels: Record<string, string> = { open: "O.S. aberta", diagnosing: "Em diagnóstico", awaiting_approval: "Aguardando sua confirmação", awaiting_part: "Aguardando peça", repairing: "Em reparo", finished: "CARRO PRONTO PARA RETIRADA", delivered: "Entregue", cancelled: "Cancelada" };

function statusStyle(order: Order) {
  if (order.status === "cancelled") return { label: "Cancelado", className: "border-red-500/60 bg-red-500/10 text-red-300" };
  if (order.appointment_confirmed_at) return { label: "Confirmado pela oficina", className: "border-emerald-500/60 bg-emerald-500/10 text-emerald-300" };
  if (order.status === "awaiting_approval" || order.appointment_requested_at) return { label: "Aguardando confirmação", className: "border-[#FFC107]/70 bg-[#FFC107]/10 text-[#FFC107]" };
  if (["finished", "delivered"].includes(order.status)) return { label: labels[order.status], className: "border-emerald-500/60 bg-emerald-500/10 text-emerald-300" };
  return { label: labels[order.status] || order.status, className: "border-[#FFC107]/70 bg-[#FFC107]/10 text-[#FFC107]" };
}

export function ClientServiceOrders() {
  const db = createClient();
  const [client, setClient] = useState<Client | null>(null);
  const [cars, setCars] = useState<Vehicle[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [car, setCar] = useState("");
  const [defect, setDefect] = useState("");
  const [message, setMessage] = useState("");

  async function load() {
    await db.rpc("claim_client_portal_links");
    const link = await db.from("client_portal_links").select("client_id,clients(id,full_name)").limit(1).maybeSingle();
    const current = link.data?.clients as unknown as Client | null;
    setClient(current);
    if (!current) return;
    const user = (await db.auth.getUser()).data.user;
    const [vehicleResult, orderResult] = await Promise.all([
      db.from("vehicles").select("id,brand,model,plate").eq("client_id", current.id),
      db.from("service_orders").select("id,number,status,customer_complaint,appointment_requested_at,appointment_confirmed_at").eq("owner_id", user?.id || "").order("created_at", { ascending: false }),
    ]);
    setCars((vehicleResult.data || []) as Vehicle[]);
    setOrders((orderResult.data || []) as Order[]);
  }

  useEffect(() => { void load(); }, []);
  async function send(event: FormEvent) {
    event.preventDefault(); if (!client) return;
    const result = await db.rpc("create_client_service_request", { p_client_id: client.id, p_vehicle_id: car, p_complaint: defect });
    setMessage(result.error ? result.error.message : "Solicitação enviada. A oficina foi avisada.");
    if (!result.error) { setCar(""); setDefect(""); }
  }

  if (!client) return <section className="mt-8 rounded-xl border border-zinc-800 bg-[#171717] p-5"><h2 className="text-xl font-bold">Minhas Ordens de Serviço</h2><p className="mt-2 text-zinc-400">Peça para a oficina cadastrar no seu cliente o mesmo e-mail da sua conta.</p></section>;
  return <section className="mt-8"><h2 className="text-2xl font-bold">Minhas Ordens de Serviço</h2><form onSubmit={send} className="mt-5 rounded-xl border border-[#FFC107] bg-[#171717] p-5"><h3 className="font-bold">Abrir solicitação</h3><select required value={car} onChange={(event) => setCar(event.target.value)} className="field mt-3"><option value="">Selecione o veículo</option>{cars.map((item) => <option key={item.id} value={item.id}>{item.brand} {item.model} {item.plate || ""}</option>)}</select><textarea required minLength={4} value={defect} onChange={(event) => setDefect(event.target.value)} className="field mt-3 min-h-24" placeholder="Descreva o defeito do carro"/><button className="mt-3 rounded-lg bg-[#FFC107] px-4 py-2 font-bold text-black">Enviar para oficina</button>{message && <p className="mt-3 text-sm text-[#FFC107]">{message}</p>}</form><div className="mt-7 flex items-end justify-between gap-3"><div><h3 className="text-xl font-bold">Acompanhar O.S.</h3><p className="mt-1 text-sm text-zinc-400">Verde: confirmado · Amarelo: aguardando confirmação · Vermelho: cancelado.</p></div><button type="button" onClick={() => void load()} className="rounded-lg border border-zinc-600 px-3 py-2 text-sm font-bold">Atualizar</button></div><div className="mt-4 space-y-3">{orders.length === 0 && <p className="rounded-xl border border-zinc-800 bg-[#171717] p-5 text-zinc-400">Nenhuma O.S. encontrada.</p>}{orders.map((order) => { const presentation = statusStyle(order); return <article key={order.id} className="rounded-xl border border-zinc-800 bg-[#171717] p-5"><div className="flex flex-wrap items-center justify-between gap-3"><b>O.S. #{order.number}</b><span className={`rounded-full border px-3 py-1 text-sm font-bold ${presentation.className}`}>{presentation.label}</span></div><p className="mt-3 text-sm text-zinc-300">{order.customer_complaint}</p></article>; })}</div></section>;
}
