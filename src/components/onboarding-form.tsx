"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function OnboardingForm() {
  const [kind, setKind] = useState<"owner" | "workshop" | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!kind) return;
    setLoading(true);
    setError("");
    const result = kind === "workshop"
      ? await createClient().rpc("create_workshop_with_owner", { workshop_name: name, workshop_phone: phone, workshop_whatsapp: whatsapp })
      : await createClient().rpc("create_vehicle_owner", { p_name: name, p_phone: phone });
    if (result.error) { setError(result.error.message); setLoading(false); return; }
    location.reload();
  }

  if (!kind) return <div className="w-full max-w-2xl rounded-2xl border border-zinc-800 bg-[#1A1A1A] p-7"><p className="text-xs font-bold tracking-[.2em] text-[#FFC107]">PRIMEIRO ACESSO</p><h1 className="mt-3 text-3xl font-bold">Como você quer usar o CR Connect?</h1><div className="mt-6 grid gap-4 sm:grid-cols-2"><button onClick={() => setKind("owner")} className="rounded-xl border border-[#FFC107] p-5 text-left"><b className="text-lg">Sou proprietário</b><span className="mt-2 block text-sm text-zinc-400">Grátis · cadastre veículos e use o CR SOS.</span></button><button onClick={() => setKind("workshop")} className="rounded-xl border border-zinc-700 p-5 text-left"><b className="text-lg">Tenho uma oficina</b><span className="mt-2 block text-sm text-zinc-400">Crie o ambiente para administrar sua oficina.</span></button></div></div>;

  return <form onSubmit={submit} className="w-full max-w-md rounded-2xl border border-zinc-800 bg-[#1A1A1A] p-7"><p className="text-xs font-bold tracking-[.2em] text-[#FFC107]">{kind === "owner" ? "CONTA GRATUITA" : "NOVA OFICINA"}</p><h1 className="mt-3 text-3xl font-bold">{kind === "owner" ? "Crie seu perfil" : "Vamos criar sua oficina"}</h1><label className="mt-6 block text-sm">{kind === "owner" ? "Seu nome" : "Nome da oficina"}<input required minLength={2} maxLength={120} value={name} onChange={(event) => setName(event.target.value)} className="field mt-2" placeholder={kind === "owner" ? "Ex.: João Silva" : "Ex.: Oficina do João"} /></label>{kind === "owner" ? <label className="mt-4 block text-sm">WhatsApp / telefone<input required value={phone} onChange={(event) => setPhone(event.target.value)} className="field mt-2" placeholder="(00) 00000-0000" /></label> : <><label className="mt-4 block text-sm">Telefone para ligações<input required value={phone} onChange={(event) => setPhone(event.target.value)} inputMode="tel" className="field mt-2" placeholder="(00) 00000-0000" /></label><label className="mt-4 block text-sm">WhatsApp da oficina <span className="text-zinc-500">(opcional)</span><input value={whatsapp} onChange={(event) => setWhatsapp(event.target.value)} inputMode="tel" className="field mt-2" placeholder="(00) 00000-0000" /></label><p className="mt-3 text-sm text-zinc-400">Este telefone será usado no botão “Ligar para a oficina” do CR SOS.</p></>}{error && <p className="mt-3 text-sm text-red-400">{error}</p>}<button disabled={loading} className="mt-5 w-full rounded-lg bg-[#FFC107] px-4 py-3 font-bold text-black">{loading ? "Salvando..." : kind === "owner" ? "Criar conta gratuita" : "Criar oficina"}</button><button type="button" onClick={() => setKind(null)} className="mt-3 w-full text-sm text-zinc-400">Voltar</button></form>;
}
