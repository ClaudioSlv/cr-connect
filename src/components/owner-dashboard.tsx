"use client";

import { FormEvent, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Vehicle = { id: string; plate: string | null; brand: string | null; model: string; year: number | null };
type SosRequest = { id: string; service_type: string; status: "requested" | "accepted" | "declined" | "cancelled" | "completed"; created_at: string; feedback_rating: number | null; feedback_text: string | null; workshops: { name: string } | null };

const sosStatus: Record<SosRequest["status"], string> = { requested: "Aguardando resposta", accepted: "Aceito pela oficina", declined: "Recusado", cancelled: "Cancelado", completed: "Atendimento concluído" };

export function OwnerDashboard({ name }: { name: string }) {
  const db = createClient();
  const [items, setItems] = useState<Vehicle[]>([]);
  const [requests, setRequests] = useState<SosRequest[]>([]);
  const [model, setModel] = useState("");
  const [plate, setPlate] = useState("");
  const [brand, setBrand] = useState("");
  const [year, setYear] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const [vehicleFormOpen, setVehicleFormOpen] = useState(false);
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [feedback, setFeedback] = useState<Record<string, string>>({});
  const [feedbackNotice, setFeedbackNotice] = useState<Record<string, string>>({});

  async function load() {
    const [vehiclesResult, requestsResult] = await Promise.all([
      db.from("owner_vehicles").select("id,plate,brand,model,year").order("created_at", { ascending: false }),
      db.from("sos_requests").select("id,service_type,status,created_at,feedback_rating,feedback_text,workshops(name)").order("created_at", { ascending: false }).limit(10),
    ]);
    if (vehiclesResult.error) setNotice(vehiclesResult.error.message); else setItems((vehiclesResult.data || []) as Vehicle[]);
    if (!requestsResult.error) setRequests((requestsResult.data || []) as unknown as SosRequest[]);
  }

  useEffect(() => { void load(); }, []);

  function resetForm() { setModel(""); setPlate(""); setBrand(""); setYear(""); }

  async function save(event: FormEvent) {
    event.preventDefault(); setSaving(true); setNotice("");
    const { data: { user } } = await db.auth.getUser();
    if (!user) { setNotice("Sua sessão expirou. Entre novamente."); setSaving(false); return; }
    const { error } = await db.from("owner_vehicles").insert({ owner_id: user.id, model: model.trim(), plate: plate.trim().toUpperCase() || null, brand: brand.trim() || null, year: year ? Number(year) : null });
    if (error) setNotice(error.message);
    else { resetForm(); setVehicleFormOpen(false); setNotice("Veículo salvo com sucesso."); await load(); }
    setSaving(false);
  }

  async function remove(id: string) {
    if (!window.confirm("Remover este veículo da sua conta?")) return;
    const { error } = await db.from("owner_vehicles").delete().eq("id", id);
    if (error) setNotice(error.message); else { setNotice("Veículo removido."); await load(); }
  }

  async function submitFeedback(event: FormEvent, request: SosRequest) {
    event.preventDefault(); const rating = ratings[request.id] || 0;
    if (!rating) { setFeedbackNotice((current) => ({ ...current, [request.id]: "Escolha de 1 a 5 estrelas." })); return; }
    const { error } = await db.rpc("submit_sos_feedback", { p_request_id: request.id, p_rating: rating, p_feedback: feedback[request.id] || "" });
    if (error) { setFeedbackNotice((current) => ({ ...current, [request.id]: error.message })); return; }
    setRequests((current) => current.map((item) => item.id === request.id ? { ...item, feedback_rating: rating, feedback_text: (feedback[request.id] || "").trim() || null } : item));
    setFeedbackNotice((current) => ({ ...current, [request.id]: "Obrigado! Sua avaliação foi enviada para a oficina." }));
  }

  async function signOut() { await db.auth.signOut(); window.location.assign("/"); }

  return <main className="min-h-screen bg-[#0c0c0d] p-5 text-zinc-100 md:p-10"><div className="mx-auto max-w-5xl">
    <section className="relative overflow-hidden rounded-3xl border border-[#513f15] bg-black p-6 shadow-2xl md:p-9" style={{ backgroundImage: "linear-gradient(90deg, rgba(0,0,0,.96) 8%, rgba(0,0,0,.78) 48%, rgba(0,0,0,.20)), url('/brand/cr-connect-hero.png')", backgroundSize: "cover", backgroundPosition: "center" }}>
      <div className="relative z-10 max-w-xl"><div className="flex items-start justify-between gap-4"><p className="text-xs font-black tracking-[.22em] text-[#FFC107]">CR CONNECT · PROPRIETÁRIO</p><button onClick={signOut} className="rounded-lg border border-zinc-500 bg-black/30 px-4 py-2 text-sm font-bold backdrop-blur hover:border-[#FFC107]">Sair</button></div><h1 className="mt-7 text-4xl font-black leading-tight sm:text-5xl">Olá, {name || "motorista"}</h1><p className="mt-3 max-w-md text-base leading-relaxed text-zinc-200">Seu carro sempre conectado. Cadastre seus veículos, acompanhe a O.S. e peça ajuda pelo CR SOS quando precisar.</p><div className="mt-7 flex flex-wrap gap-3"><a href="/sos" className="rounded-xl bg-[#FFC107] px-5 py-3 font-black text-black shadow-lg">Abrir CR SOS</a><a href="/app/minhas-os" className="rounded-xl border border-[#FFC107] bg-black/30 px-5 py-3 font-black text-[#FFC107] backdrop-blur">Minhas O.S.</a></div></div>
    </section>

    <section className="mt-6 rounded-3xl border border-zinc-800 bg-[#171717] p-5 shadow-xl md:p-6"><div className="flex flex-wrap items-center justify-between gap-4"><div><p className="text-xs font-bold tracking-[.18em] text-[#FFC107]">MEUS VEÍCULOS</p><h2 className="mt-1 text-2xl font-bold">Garagem do cliente</h2><p className="mt-1 text-sm text-zinc-400">Cadastre todos os veículos da sua família.</p></div><button type="button" onClick={() => { setNotice(""); setVehicleFormOpen((open) => !open); }} className="rounded-xl bg-[#FFC107] px-5 py-3 font-black text-black">{vehicleFormOpen ? "Fechar cadastro" : "Adicionar veículo +"}</button></div>
      {vehicleFormOpen && <form onSubmit={save} className="mt-5 rounded-2xl border border-[#6b510d] bg-black/30 p-4"><h3 className="font-bold">Novo veículo</h3><div className="mt-4 grid gap-3 sm:grid-cols-2"><input required className="field" placeholder="Modelo do veículo *" value={model} onChange={(event) => setModel(event.target.value)} /><input className="field" placeholder="Marca" value={brand} onChange={(event) => setBrand(event.target.value)} /><input className="field" placeholder="Placa" value={plate} onChange={(event) => setPlate(event.target.value)} /><input className="field" type="number" min="1900" max="2100" placeholder="Ano" value={year} onChange={(event) => setYear(event.target.value)} /></div><div className="mt-4 flex flex-wrap gap-3"><button disabled={saving} className="rounded-xl bg-[#FFC107] px-5 py-3 font-bold text-black disabled:opacity-60">{saving ? "Salvando..." : "Salvar veículo"}</button><button type="button" onClick={() => { resetForm(); setVehicleFormOpen(false); }} className="rounded-xl border border-zinc-600 px-5 py-3 font-bold">Cancelar</button></div></form>}
      {notice && <p role="status" className="mt-4 rounded-lg border border-[#6b510d] bg-[#211805] p-3 text-sm text-[#FFC107]">{notice}</p>}
      <div className="mt-5 grid gap-3 sm:grid-cols-2">{items.length === 0 && <p className="rounded-2xl border border-dashed border-zinc-700 p-5 text-zinc-400">Ainda não há veículo cadastrado. Toque em “Adicionar veículo +”.</p>}{items.map((item) => <article key={item.id} className="rounded-2xl border border-zinc-800 bg-[#111] p-5"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold tracking-[.16em] text-[#FFC107]">VEÍCULO</p><b className="mt-2 block text-xl">{item.brand ? `${item.brand} ` : ""}{item.model}</b><p className="mt-2 text-sm text-zinc-400">{item.plate || "Placa não informada"}{item.year ? ` · ${item.year}` : ""}</p></div><button onClick={() => void remove(item.id)} className="text-sm font-bold text-zinc-400 hover:text-red-400">Remover</button></div></article>)}</div>
    </section>

    <section className="mt-8"><div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-bold tracking-[.18em] text-[#FFC107]">CR SOS</p><h2 className="mt-1 text-2xl font-bold">Meus chamados</h2><p className="mt-1 text-sm text-zinc-400">Acompanhe o atendimento e avalie a oficina depois da conclusão.</p></div><a href="/sos" className="rounded-lg border border-[#FFC107] px-4 py-2 text-sm font-bold text-[#FFC107]">Novo chamado</a></div><div className="mt-4 grid gap-3 md:grid-cols-2">{requests.length === 0 && <p className="rounded-2xl border border-zinc-800 bg-[#171717] p-5 text-zinc-400">Você ainda não fez nenhum chamado CR SOS.</p>}{requests.map((request) => <article key={request.id} className="rounded-2xl border border-zinc-800 bg-[#171717] p-5"><p className="font-bold">{request.workshops?.name || "Oficina CR SOS"}</p><p className="mt-1 text-sm text-zinc-300">{request.service_type}</p><div className="mt-3 flex flex-wrap justify-between gap-2 text-sm"><span className="font-semibold text-[#FFC107]">{sosStatus[request.status]}</span><span className="text-zinc-500">{new Date(request.created_at).toLocaleDateString("pt-BR")}</span></div>{request.feedback_rating ? <div className="mt-4 rounded-lg border border-[#6b510d] bg-[#211805] p-3"><p className="font-bold text-[#FFC107]">{"★".repeat(request.feedback_rating)}{"☆".repeat(5 - request.feedback_rating)}</p>{request.feedback_text && <p className="mt-1 text-sm text-zinc-200">{request.feedback_text}</p>}</div> : request.status === "completed" ? <form onSubmit={(event) => void submitFeedback(event, request)} className="mt-4 border-t border-zinc-800 pt-4"><p className="font-semibold">Como foi o atendimento?</p><div className="mt-2 flex gap-1">{[1, 2, 3, 4, 5].map((star) => <button key={star} type="button" aria-label={`${star} estrela${star > 1 ? "s" : ""}`} onClick={() => setRatings((current) => ({ ...current, [request.id]: star }))} className={`text-3xl ${star <= (ratings[request.id] || 0) ? "text-[#FFC107]" : "text-zinc-600"}`}>★</button>)}</div><textarea maxLength={150} value={feedback[request.id] || ""} onChange={(event) => setFeedback((current) => ({ ...current, [request.id]: event.target.value }))} className="field mt-3 min-h-20" placeholder="Conte como foi (opcional, até 150 caracteres)"/><button className="mt-3 rounded-lg bg-[#FFC107] px-4 py-2 font-bold text-black">Enviar avaliação</button>{feedbackNotice[request.id] && <p className="mt-2 text-sm text-[#FFC107]">{feedbackNotice[request.id]}</p>}</form> : null}</article>)}</div></section>
  </div></main>;
}
