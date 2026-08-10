"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function OnboardingForm() {
  const [name, setName] = useState(""); const [error, setError] = useState(""); const [loading, setLoading] = useState(false);
  async function submit(event: React.FormEvent) { event.preventDefault(); setLoading(true); setError(""); const { error } = await createClient().rpc("create_workshop_with_owner", { workshop_name: name }); if (error) { setError(error.message); setLoading(false); return; } location.reload(); }
  return <form onSubmit={submit} className="w-full max-w-md rounded-2xl border border-zinc-800 bg-[#1A1A1A] p-7"><p className="text-xs font-bold tracking-[.2em] text-[#FFC107]">PRIMEIRO ACESSO</p><h1 className="mt-3 text-3xl font-bold">Vamos criar sua oficina</h1><p className="mt-2 text-zinc-400">Você será o administrador inicial deste ambiente.</p><label className="mt-6 block text-sm">Nome da oficina<input required minLength={2} maxLength={120} value={name} onChange={(event) => setName(event.target.value)} className="mt-2 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-3 outline-none focus:border-[#FFC107]" placeholder="Ex.: Oficina do João" /></label>{error && <p className="mt-3 text-sm text-red-400">{error}</p>}<button disabled={loading} className="mt-5 w-full rounded-lg bg-[#FFC107] px-4 py-3 font-bold text-black disabled:opacity-60">{loading ? "Criando..." : "Criar oficina"}</button></form>;
}
