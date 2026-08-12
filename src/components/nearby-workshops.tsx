"use client";

import dynamic from "next/dynamic";
import { FormEvent, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Workshop = { id: string; name: string; whatsapp: string | null; latitude: number; longitude: number; emergency_services: string[]; emergency_radius_km: number; distance?: number };
type Review = { requester_name: string; rating: number; feedback: string | null; created_at: string };
type SentRequest = { workshop: Workshop; requestId: string };
const SosMap = dynamic(() => import("@/components/sos-map").then((module) => module.SosMap), { ssr: false, loading: () => <div className="mt-6 h-[330px] animate-pulse rounded-2xl border border-zinc-800 bg-[#171717]" /> });

export function NearbyWorkshops() {
  const db = createClient();
  const [items, setItems] = useState<Workshop[]>([]);
  const [message, setMessage] = useState("Use sua localização para encontrar oficinas ativas.");
  const [loading, setLoading] = useState(false);
  const [position, setPosition] = useState<{ latitude: number; longitude: number } | null>(null);
  const [selected, setSelected] = useState<Workshop | null>(null);
  const [sent, setSent] = useState<SentRequest | null>(null);
  const [viewed, setViewed] = useState(false);
  const [reviews, setReviews] = useState<Record<string, Review[]>>({});
  const [reviewsOpen, setReviewsOpen] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [service, setService] = useState("");
  const [description, setDescription] = useState("");
  const requestFormRef = useRef<HTMLFormElement>(null);

  function distance(a: number, b: number, c: number, d: number) { const r = 6371, x = (c - a) * Math.PI / 180, y = (d - b) * Math.PI / 180, q = Math.sin(x / 2) ** 2 + Math.cos(a * Math.PI / 180) * Math.cos(c * Math.PI / 180) * Math.sin(y / 2) ** 2; return 2 * r * Math.atan2(Math.sqrt(q), Math.sqrt(1 - q)); }
  function choose(workshop: Workshop) { setSelected(workshop); setService(workshop.emergency_services[0] || ""); }
  function call(item: Workshop) { const number = (item.whatsapp || "").replace(/\D/g, ""); return `tel:${number && !number.startsWith("55") ? `55${number}` : number}`; }
  function whats(item: Workshop) { const number = (item.whatsapp || "").replace(/\D/g, ""); const place = position ? ` Minha localização: https://www.google.com/maps?q=${position.latitude},${position.longitude}` : ""; return `https://wa.me/${number.startsWith("55") ? number : `55${number}`}?text=${encodeURIComponent(`Olá, preciso de ajuda pelo CR SOS. Serviço: ${service || item.emergency_services[0] || "emergência"}.${place}`)}`; }

  function locate() {
    if (!navigator.geolocation) { setMessage("Seu navegador não oferece GPS."); return; }
    setLoading(true);
    navigator.geolocation.getCurrentPosition(async (result) => {
      const current = { latitude: result.coords.latitude, longitude: result.coords.longitude };
      const { data, error } = await db.rpc("get_active_sos_workshops");
      if (error) { setMessage("Não foi possível buscar oficinas agora."); setLoading(false); return; }
      const list = ((data || []) as Workshop[]).map((item) => ({ ...item, distance: distance(current.latitude, current.longitude, Number(item.latitude), Number(item.longitude)) })).filter((item) => (item.distance || 0) <= item.emergency_radius_km).sort((a, b) => (a.distance || 0) - (b.distance || 0));
      setPosition(current); setItems(list); setMessage(list.length ? "Oficinas encontradas perto de você. Toque no marcador dourado para escolher." : "Nenhuma oficina CR SOS ativa no seu raio agora."); setLoading(false);
    }, () => { setMessage("Permita a localização para usar o CR SOS."); setLoading(false); }, { enableHighAccuracy: true, timeout: 10000 });
  }

  async function requestHelp(event: FormEvent) {
    event.preventDefault(); if (!selected || !position) return; setLoading(true);
    const { data, error } = await db.rpc("create_sos_request", { p_workshop_id: selected.id, p_requester_name: name, p_requester_phone: phone, p_service_type: service, p_description: description, p_latitude: position.latitude, p_longitude: position.longitude });
    setLoading(false); if (error) { setMessage("Não foi possível enviar seu chamado. Tente novamente."); return; }
    setSent({ workshop: selected, requestId: data as string }); setViewed(false); setMessage(`Chamado enviado para ${selected.name}. A oficina foi avisada.`); setSelected(null); setName(""); setPhone(""); setService(""); setDescription("");
  }

  useEffect(() => { if (!sent) return; const requestId = sent.requestId; let active = true; const checkRead = async () => { const { data } = await db.rpc("get_sos_request_ack", { p_request_id: requestId }); if (active && data) setViewed(true); }; void checkRead(); const interval = window.setInterval(() => void checkRead(), 8000); return () => { active = false; window.clearInterval(interval); }; }, [sent?.requestId]);
  useEffect(() => { if (!selected) return; window.setTimeout(() => requestFormRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 80); }, [selected?.id]);
  async function toggleReviews(workshop: Workshop) { if (reviewsOpen === workshop.id) { setReviewsOpen(null); return; } if (!reviews[workshop.id]) { const { data } = await db.rpc("get_sos_workshop_reviews", { p_workshop_id: workshop.id }); setReviews((current) => ({ ...current, [workshop.id]: (data || []) as Review[] })); } setReviewsOpen(workshop.id); }

  return <div><button onClick={locate} disabled={loading} className="rounded-lg bg-[#FFC107] px-5 py-3 font-bold text-black disabled:opacity-60">{loading ? "Buscando..." : "Usar minha localização"}</button><p className="mt-4 text-zinc-400">{message}</p>{sent && <section className="mt-5 rounded-xl border border-[#FFC107] bg-[#211805] p-5"><p className="font-bold text-[#FFC107]">✓ Mensagem enviada para {sent.workshop.name}</p><p className="mt-2 text-sm text-zinc-200">{viewed ? "✓ A oficina visualizou sua mensagem e já sabe que você precisa de ajuda." : "A oficina recebeu seu nome, telefone, motivo e localização. Aguarde a confirmação de leitura."}</p><div className="mt-4 flex flex-wrap gap-3">{sent.workshop.whatsapp ? <a href={call(sent.workshop)} className="rounded-lg bg-[#FFC107] px-4 py-2 font-bold text-black">Ligar para a oficina</a> : <p className="text-sm text-zinc-400">Telefone da oficina ainda não informado.</p>}{sent.workshop.whatsapp && <a href={whats(sent.workshop)} target="_blank" rel="noreferrer" className="rounded-lg border border-green-500 px-4 py-2 font-bold text-green-400">WhatsApp</a>}</div></section>}{position && items.length > 0 && <SosMap position={position} workshops={items} onChoose={choose} />}<div className="mt-6 space-y-3">{items.map((item) => <article key={item.id} className="rounded-xl border border-zinc-800 bg-[#171717] p-5"><div className="flex flex-wrap justify-between gap-4"><div><h2 className="text-lg font-bold">{item.name}</h2><p className="mt-1 text-sm text-zinc-400">{item.emergency_services.join(" · ")}</p><b className="mt-3 block text-[#FFC107]">{item.distance?.toFixed(1)} km de você</b></div><div className="flex h-fit flex-wrap gap-2"><button onClick={() => choose(item)} className="rounded-lg bg-[#FFC107] px-4 py-2 font-bold text-black">Pedir ajuda</button>{item.whatsapp && <a className="rounded-lg border border-green-500 px-4 py-2 font-bold text-green-400" href={whats(item)} target="_blank" rel="noreferrer">WhatsApp</a>}<a className="rounded-lg border border-[#FFC107] px-4 py-2 font-bold text-[#FFC107]" href={`https://www.google.com/maps/dir/?api=1&destination=${item.latitude},${item.longitude}`} target="_blank" rel="noreferrer">Abrir rota</a></div></div><button onClick={() => void toggleReviews(item)} className="mt-4 text-sm font-semibold text-[#FFC107]">{reviewsOpen === item.id ? "Ocultar avaliações" : "Ver avaliações"}</button>{reviewsOpen === item.id && <div className="mt-3 space-y-2 border-t border-zinc-800 pt-3">{(reviews[item.id] || []).length === 0 ? <p className="text-sm text-zinc-400">Esta oficina ainda não tem avaliações CR SOS.</p> : (reviews[item.id] || []).map((review, index) => <div key={`${review.created_at}-${index}`} className="rounded-lg bg-black/30 p-3"><p className="font-semibold text-[#FFC107]">{"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)} <span className="ml-2 text-zinc-200">{review.requester_name}</span></p>{review.feedback && <p className="mt-1 text-sm text-zinc-300">{review.feedback}</p>}</div>)}</div>}</article>)}</div>{selected && <form ref={requestFormRef} onSubmit={requestHelp} className="mt-6 rounded-xl border border-[#FFC107] bg-[#171717] p-5"><h2 className="text-xl font-bold">Pedir ajuda para {selected.name}</h2><p className="mt-1 text-sm text-zinc-400">A oficina receberá seu telefone, localização e descrição.</p><div className="mt-4 grid gap-3 sm:grid-cols-2"><input required className="field" placeholder="Seu nome" value={name} onChange={(event) => setName(event.target.value)} /><input required className="field" type="tel" placeholder="Seu telefone" value={phone} onChange={(event) => setPhone(event.target.value)} /><select required className="field" value={service} onChange={(event) => setService(event.target.value)}>{selected.emergency_services.map((option) => <option key={option} value={option}>{option}</option>)}</select><textarea className="field min-h-24" placeholder="Descreva o problema (opcional)" value={description} onChange={(event) => setDescription(event.target.value)} /></div><div className="mt-4 flex gap-3"><button disabled={loading} className="rounded-lg bg-[#FFC107] px-4 py-2 font-bold text-black">{loading ? "Enviando..." : "Enviar chamado"}</button><button type="button" onClick={() => setSelected(null)} className="rounded-lg border border-zinc-600 px-4 py-2 font-bold">Cancelar</button></div></form>}</div>;
}
