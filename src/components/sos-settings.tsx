"use client";

import { FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const options = ["Mecânica geral", "Elétrica", "Bateria", "Pneus", "Guincho"];

type SosSettingsProps = {
  workshopId: string;
  initial: { enabled: boolean; services: string[]; latitude: string; longitude: string; radius: number };
  isPremium: boolean;
};

export function SosSettings({ workshopId, initial, isPremium }: SosSettingsProps) {
  const db = createClient();
  const [enabled, setEnabled] = useState(initial.enabled);
  const [services, setServices] = useState(initial.services);
  const [lat, setLat] = useState(initial.latitude);
  const [lng, setLng] = useState(initial.longitude);
  const [radius, setRadius] = useState(String(initial.radius));
  const [notice, setNotice] = useState("");
  const [locating, setLocating] = useState(false);
  const hasLocation = Boolean(lat && lng);

  function toggle(item: string) {
    setServices((current) => current.includes(item) ? current.filter((value) => value !== item) : [...current, item]);
  }

  function useLocation() {
    if (!navigator.geolocation) {
      setNotice("Seu navegador não oferece GPS.");
      return;
    }
    setLocating(true);
    setNotice("");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLat(position.coords.latitude.toFixed(7));
        setLng(position.coords.longitude.toFixed(7));
        setLocating(false);
        setNotice("Localização da oficina preenchida.");
      },
      () => {
        setLocating(false);
        setNotice("Não foi possível obter a localização. Verifique a permissão do GPS.");
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    const { error } = await db.from("workshops").update({
      emergency_enabled: enabled,
      emergency_services: services,
      latitude: lat ? Number(lat) : null,
      longitude: lng ? Number(lng) : null,
      emergency_radius_km: Number(radius),
    }).eq("id", workshopId);
    setNotice(error?.message || "CR SOS atualizado.");
  }

  if (!isPremium) return <section className="rounded-xl border border-[#4a3818] bg-[#1A1A1A] p-5"><h2 className="text-xl font-bold text-[#FFC107]">Plano CR SOS necessário</h2><p className="mt-2 text-zinc-300">Para aparecer no mapa, receber chamados e conversar pelo WhatsApp, ative o plano CR SOS por R$ 44,90 em pagamento único.</p><a href="/app/assinatura" className="mt-5 inline-block rounded-lg bg-[#FFC107] px-4 py-2 font-bold text-black">Ver assinatura</a></section>;

  return <form onSubmit={save} className="max-w-3xl rounded-xl border border-zinc-800 bg-[#1A1A1A] p-5"><label className="flex items-center justify-between gap-4 rounded-lg border border-[#4a3818] bg-black/30 p-4"><span><b>Receber chamados próximos</b><small className="mt-1 block text-zinc-400">Sua oficina poderá aparecer no CR SOS quando o mapa for ativado.</small></span><input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} className="h-5 w-5 accent-[#FFC107]" /></label><h2 className="mt-6 font-semibold">Serviços de emergência</h2><div className="mt-3 grid gap-2 sm:grid-cols-2">{options.map((item) => <label key={item} className="flex gap-2 rounded-lg border border-zinc-800 p-3"><input type="checkbox" checked={services.includes(item)} onChange={() => toggle(item)} />{item}</label>)}</div><div className="mt-6 flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold">Localização da oficina</h2><p className="mt-1 text-sm text-zinc-400">{hasLocation ? "Localização salva. Atualize se a oficina mudar de endereço." : "Use o GPS para salvar a localização atual da oficina."}</p></div><button type="button" onClick={useLocation} disabled={locating} className="rounded-lg border border-[#FFC107] px-3 py-2 text-sm font-bold text-[#FFC107] disabled:opacity-60">{locating ? "Buscando GPS..." : hasLocation ? "Atualizar localização" : "Usar minha localização"}</button></div><div className="mt-3 grid gap-3 sm:grid-cols-3"><input className="field" placeholder="Latitude" value={lat} onChange={(event) => setLat(event.target.value)} /><input className="field" placeholder="Longitude" value={lng} onChange={(event) => setLng(event.target.value)} /><input className="field" type="number" min="1" placeholder="Raio (km)" value={radius} onChange={(event) => setRadius(event.target.value)} /></div><p className="mt-2 text-xs text-zinc-500">Confira a localização antes de salvar. Ela define em quais buscas a oficina aparecerá.</p><button className="mt-6 rounded-lg bg-[#FFC107] px-4 py-2 font-bold text-black">Salvar CR SOS</button>{notice && <p className="mt-3 text-sm">{notice}</p>}</form>;
}
