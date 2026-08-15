"use client";

import dynamic from "next/dynamic";
import { FormEvent, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Workshop = { id: string; name: string; whatsapp: string | null; latitude: number; longitude: number; emergency_services: string[]; emergency_radius_km: number; distance?: number };
type SentRequest = { workshop: Workshop; requestId: string };
type RequestStatus = "requested" | "accepted" | "declined" | "completed" | "cancelled";
const SosMap = dynamic(() => import("@/components/sos-map").then((module) => module.SosMap), { ssr: false });

function statusText(status: RequestStatus, workshop: string) {
  if (status === "accepted") return workshop + " aceitou seu chamado CR SOS. A ajuda esta a caminho.";
  if (status === "declined") return workshop + " nao conseguiu aceitar este chamado. Escolha outra oficina.";
  if (status === "completed") return workshop + " marcou o atendimento como concluido.";
  if (status === "cancelled") return "Este chamado CR SOS foi cancelado.";
  return "Aguardando a resposta da oficina.";
}

export function NearbyWorkshops() {
  const db = createClient();
  const [items, setItems] = useState<Workshop[]>([]);
  const [message, setMessage] = useState("Use sua localizacao para encontrar oficinas ativas.");
  const [loading, setLoading] = useState(false);
  const [position, setPosition] = useState<{ latitude: number; longitude: number } | null>(null);
  const [selected, setSelected] = useState<Workshop | null>(null);
  const [sent, setSent] = useState<SentRequest | null>(null);
  const [viewed, setViewed] = useState(false);
  const [status, setStatus] = useState<RequestStatus>("requested");
  const [notice, setNotice] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [service, setService] = useState("");
  const [description, setDescription] = useState("");
  const [reference, setReference] = useState("");
  const [referenceNotice, setReferenceNotice] = useState("");
  const [savingReference, setSavingReference] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const audioContext = useRef<AudioContext | null>(null);
  const lastStatus = useRef<RequestStatus>("requested");

  function choose(workshop: Workshop) { setSelected(workshop); setService(workshop.emergency_services[0] || ""); }
  function distance(a: number, b: number, c: number, d: number) { const r = 6371, x = (c - a) * Math.PI / 180, y = (d - b) * Math.PI / 180, h = Math.sin(x / 2) ** 2 + Math.cos(a * Math.PI / 180) * Math.cos(c * Math.PI / 180) * Math.sin(y / 2) ** 2; return 2 * r * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h)); }
  function digits(workshop: Workshop) { return (workshop.whatsapp || "").replace(/\D/g, ""); }
  function phoneLink(workshop: Workshop) { const value = digits(workshop); return "tel:" + (value && !value.startsWith("55") ? "55" + value : value); }
  function mapsLink(workshop: Workshop) { return "https://www.google.com/maps/dir/?api=1&destination=" + workshop.latitude + "," + workshop.longitude; }
  function whatsappLink(workshop: Workshop, extra = "") { const value = digits(workshop); const target = value.startsWith("55") ? value : "55" + value; const location = position ? " Minha localizacao: https://www.google.com/maps?q=" + position.latitude + "," + position.longitude : ""; return "https://wa.me/" + target + "?text=" + encodeURIComponent("Ola, preciso de ajuda pelo CR SOS. Servico: " + (service || workshop.emergency_services[0] || "emergencia") + "." + location + (extra.trim() ? " Referencia: " + extra.trim() : "")); }

  async function sendReference() {
    if (!sent || reference.trim().length < 3) { setReferenceNotice("Informe um ponto de referencia ou detalhe de onde o carro esta."); return; }
    setSavingReference(true); setReferenceNotice("Enviando detalhe para a oficina...");
    const result = await db.rpc("add_sos_location_reference", { p_request_id: sent.requestId, p_location_reference: reference.trim() });
    setSavingReference(false);
    if (result.error) { setReferenceNotice("Nao foi possivel enviar agora. Tente novamente ou use o WhatsApp."); return; }
    setReferenceNotice("Detalhe enviado para a oficina.");
  }

  async function armAlert() {
    const AudioClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioClass) return;
    audioContext.current ||= new AudioClass();
    await audioContext.current.resume();
    if ("Notification" in window && Notification.permission === "default") await Notification.requestPermission();
  }
  function playAlert() {
    const audio = audioContext.current; if (!audio) return; void audio.resume(); const start = audio.currentTime;
    [880, 1175].forEach((frequency, index) => { const oscillator = audio.createOscillator(); const gain = audio.createGain(); const at = start + index * .28; oscillator.frequency.value = frequency; gain.gain.setValueAtTime(.0001, at); gain.gain.exponentialRampToValueAtTime(.16, at + .02); gain.gain.exponentialRampToValueAtTime(.0001, at + .22); oscillator.connect(gain); gain.connect(audio.destination); oscillator.start(at); oscillator.stop(at + .24); });
  }

  function locate() {
    if (!navigator.geolocation) { setMessage("Seu navegador nao oferece GPS."); return; }
    setLoading(true); setMessage("Localizando você e buscando oficinas…");
    let finished = false;
    const finish = (text: string) => { if (finished) return; finished = true; setMessage(text); setLoading(false); };
    const timeout = window.setTimeout(() => finish("A busca demorou mais que o normal. Confira a internet e tente novamente."), 16000);
    navigator.geolocation.getCurrentPosition(async (result) => {
      try {
        const current = { latitude: result.coords.latitude, longitude: result.coords.longitude };
        const resultWorkshops = await Promise.race([
          db.rpc("get_active_sos_workshops"),
          new Promise<never>((_, reject) => window.setTimeout(() => reject(new Error("timeout")), 10000)),
        ]);
        if (finished) return;
        if (resultWorkshops.error) { finish("Não foi possível buscar oficinas agora. Tente novamente."); return; }
        const list = ((resultWorkshops.data || []) as Workshop[]).map((item) => ({ ...item, distance: distance(current.latitude, current.longitude, Number(item.latitude), Number(item.longitude)) })).filter((item) => (item.distance || 0) <= item.emergency_radius_km).sort((a, b) => (a.distance || 0) - (b.distance || 0));
        setPosition(current); setItems(list); finish(list.length ? "Oficinas encontradas perto de você. Toque no marcador dourado para escolher." : "Nenhuma oficina CR SOS ativa no seu raio agora.");
      } catch { finish("Não foi possível concluir a busca agora. Confira a internet e tente novamente."); }
      finally { window.clearTimeout(timeout); }
    }, () => { window.clearTimeout(timeout); finish("Permita a localização para usar o CR SOS."); }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 });
  }

  async function requestHelp(event: FormEvent) {
    event.preventDefault(); if (!selected || !position) return; setLoading(true); await armAlert();
    const result = await db.rpc("create_sos_request", { p_workshop_id: selected.id, p_requester_name: name, p_requester_phone: phone, p_service_type: service, p_description: description, p_latitude: position.latitude, p_longitude: position.longitude });
    setLoading(false);
    if (result.error) { setMessage("Nao foi possivel enviar seu chamado. Tente novamente."); return; }
    void fetch("/api/push-sos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ requestId: result.data, event: "request" }) });
    setSent({ workshop: selected, requestId: result.data as string }); setViewed(false); setStatus("requested"); setNotice(""); lastStatus.current = "requested";
    setMessage("Chamado enviado para " + selected.name + ". A oficina foi avisada."); setSelected(null); setName(""); setPhone(""); setService(""); setDescription("");
  }

  useEffect(() => { if (!selected) return; window.setTimeout(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 80); }, [selected?.id]);
  useEffect(() => {
    if (!sent) return; const currentRequest: SentRequest = sent; let active = true;
    async function check() {
      const result = await db.rpc("get_sos_request_status", { p_request_id: currentRequest.requestId });
      const data = Array.isArray(result.data) ? result.data[0] : result.data;
      if (!active || !data) return;
      if (data.viewed_at) setViewed(true);
      const next = data.status as RequestStatus;
      if (next !== lastStatus.current) {
        lastStatus.current = next; setStatus(next); const text = statusText(next, currentRequest.workshop.name); setNotice(text); playAlert();
        if ("Notification" in window && Notification.permission === "granted") new Notification("Atualizacao CR SOS", { body: text, icon: "/brand/cr-reparador.jpg", tag: "cr-sos-" + currentRequest.requestId });
      }
    }
    void check(); const timer = window.setInterval(() => void check(), 6000); return () => { active = false; window.clearInterval(timer); };
  }, [sent?.requestId]);

  return <div>
    <button onClick={locate} disabled={loading} className="rounded-lg bg-[#FFC107] px-5 py-3 font-bold text-black disabled:opacity-60">{loading ? "Buscando..." : "Usar minha localizacao"}</button>
    <p className="mt-4 text-zinc-400">{message}</p>
    {sent && <section className="mt-5 rounded-xl border border-[#FFC107] bg-[#211805] p-5"><p className="font-bold text-[#FFC107]">Mensagem enviada para {sent.workshop.name}</p><p className="mt-2 text-sm text-zinc-200">{notice || (viewed ? "A oficina visualizou sua mensagem e ja sabe que voce precisa de ajuda." : "A oficina recebeu seus dados. Aguarde a confirmacao de leitura.")}</p>{status === "accepted" && <div className="mt-4 rounded-xl border border-[#6b510d] bg-black/20 p-4"><p className="font-semibold text-[#FFC107]">A oficina aceitou. Informe um ponto de referencia.</p><p className="mt-1 text-sm text-zinc-300">Ex.: km da rodovia, posto, rua, sentido da pista ou outro detalhe para a oficina chegar ate voce.</p><textarea value={reference} onChange={(event) => setReference(event.target.value)} maxLength={250} className="field mt-3 min-h-24" placeholder="Onde exatamente voce esta?"/><div className="mt-3 flex flex-wrap gap-3"><button type="button" disabled={savingReference} onClick={() => void sendReference()} className="rounded-lg bg-[#FFC107] px-4 py-2 font-bold text-black disabled:opacity-60">{savingReference ? "Enviando..." : "Enviar detalhe"}</button>{sent.workshop.whatsapp && <a href={whatsappLink(sent.workshop, reference)} target="_blank" rel="noreferrer" className="rounded-lg border border-green-500 px-4 py-2 font-bold text-green-400">Enviar pelo WhatsApp</a>}</div>{referenceNotice && <p className="mt-3 text-sm text-[#FFC107]">{referenceNotice}</p>}</div>}<div className="mt-4 flex flex-wrap gap-3">{sent.workshop.whatsapp && <a href={phoneLink(sent.workshop)} className="rounded-lg bg-[#FFC107] px-4 py-2 font-bold text-black">Ligar para a oficina</a>}{sent.workshop.whatsapp && <a href={whatsappLink(sent.workshop)} target="_blank" rel="noreferrer" className="rounded-lg border border-green-500 px-4 py-2 font-bold text-green-400">WhatsApp</a>}</div></section>}
    {position && items.length > 0 && <SosMap position={position} workshops={items} onChoose={choose} />}
    <div className="mt-6 space-y-3">{items.map((item) => <article key={item.id} className="rounded-xl border border-zinc-800 bg-[#171717] p-5"><div className="flex flex-wrap justify-between gap-4"><div><h2 className="text-lg font-bold">{item.name}</h2><p className="mt-1 text-sm text-zinc-400">{item.emergency_services.join(" - ")}</p><b className="mt-3 block text-[#FFC107]">{item.distance?.toFixed(1)} km de voce</b></div><div className="flex h-fit flex-wrap gap-2"><button onClick={() => choose(item)} className="rounded-lg bg-[#FFC107] px-4 py-2 font-bold text-black">Pedir ajuda</button>{item.whatsapp && <a className="rounded-lg border border-green-500 px-4 py-2 font-bold text-green-400" href={whatsappLink(item)} target="_blank" rel="noreferrer">WhatsApp</a>}<a className="rounded-lg border border-[#FFC107] px-4 py-2 font-bold text-[#FFC107]" href={mapsLink(item)} target="_blank" rel="noreferrer">Abrir rota</a></div></div></article>)}</div>
    {selected && <form ref={formRef} onSubmit={requestHelp} className="mt-6 rounded-xl border border-[#FFC107] bg-[#171717] p-5"><h2 className="text-xl font-bold">Pedir ajuda para {selected.name}</h2><p className="mt-1 text-sm text-zinc-400">A oficina recebera seu telefone, localizacao e descricao.</p><p className="mt-2 text-xs text-zinc-500">Ao enviar, permita os avisos do navegador para ouvir quando a oficina responder.</p><div className="mt-4 grid gap-3 sm:grid-cols-2"><input required className="field" placeholder="Seu nome" value={name} onChange={(event) => setName(event.target.value)} /><input required className="field" type="tel" placeholder="Seu telefone" value={phone} onChange={(event) => setPhone(event.target.value)} /><select required className="field" value={service} onChange={(event) => setService(event.target.value)}>{selected.emergency_services.map((option) => <option key={option} value={option}>{option}</option>)}</select><textarea className="field min-h-24" placeholder="Descreva o problema" value={description} onChange={(event) => setDescription(event.target.value)} /></div><div className="mt-4 flex gap-3"><button disabled={loading} className="rounded-lg bg-[#FFC107] px-4 py-2 font-bold text-black">{loading ? "Enviando..." : "Enviar chamado"}</button><button type="button" onClick={() => setSelected(null)} className="rounded-lg border border-zinc-600 px-4 py-2 font-bold">Cancelar</button></div></form>}
  </div>;
}
