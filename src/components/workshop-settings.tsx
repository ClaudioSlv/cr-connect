"use client";

import { FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type WorkshopProfile = { name: string; legal_name: string | null; document: string | null; phone: string | null; whatsapp: string | null; email: string | null; address: string | null; city: string | null; state: string | null; postal_code: string | null };

export function WorkshopSettings({ workshopId, initial }: { workshopId: string; initial: WorkshopProfile }) {
  const db = createClient(); const [form, setForm] = useState(initial); const [notice, setNotice] = useState("");
  const field = (key: keyof WorkshopProfile, label: string, placeholder = "") => <label className="grid gap-1 text-sm text-zinc-300"><span>{label}</span><input className="field" placeholder={placeholder} value={form[key] || ""} onChange={e => setForm({ ...form, [key]: e.target.value })} /></label>;
  async function save(e: FormEvent) { e.preventDefault(); const { error } = await db.from("workshops").update(form).eq("id", workshopId); setNotice(error?.message || "Dados da oficina salvos com sucesso."); }
  return <form onSubmit={save} className="max-w-4xl rounded-xl border border-zinc-800 bg-[#1A1A1A] p-5"><section><h2 className="font-semibold text-[#FFC107]">Dados da oficina</h2><div className="mt-4 grid gap-4 md:grid-cols-2">{field("name", "Nome exibido", "Ex.: CR Reparador Automotivo")}{field("legal_name", "Razão social")}{field("document", "CNPJ / CPF")}{field("email", "E-mail", "contato@oficina.com")}{field("phone", "Telefone")}{field("whatsapp", "WhatsApp")}</div></section><section className="mt-8 border-t border-zinc-800 pt-6"><h2 className="font-semibold text-[#FFC107]">Endereço</h2><div className="mt-4 grid gap-4 md:grid-cols-2">{field("address", "Rua e número")}{field("postal_code", "CEP")}{field("city", "Cidade")}{field("state", "Estado", "UF")}</div></section><button className="mt-7 rounded-lg bg-[#FFC107] px-5 py-2.5 font-bold text-black">Salvar configurações</button>{notice && <p className="mt-3 text-sm text-zinc-300">{notice}</p>}</form>;
}
