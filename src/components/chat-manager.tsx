"use client";

import { FormEvent, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Client = { id: string; name: string; phone: string | null };
type Message = { id: string; client_id: string | null; body: string; created_at: string; clients: { name: string } | null };

export function ChatManager({ workshopId, userId }: { workshopId: string; userId: string }) {
  const db = createClient();
  const [clients, setClients] = useState<Client[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [clientId, setClientId] = useState("");
  const [body, setBody] = useState("");
  const [notice, setNotice] = useState("");

  async function load() {
    const [{ data: clientData }, { data: messageData }] = await Promise.all([
      db.from("clients").select("id,name,phone").eq("workshop_id", workshopId).order("name"),
      db.from("messages").select("id,client_id,body,created_at,clients(name)").eq("workshop_id", workshopId).order("created_at", { ascending: false }).limit(40),
    ]);
    setClients((clientData || []) as Client[]);
    setMessages((messageData || []) as unknown as Message[]);
  }

  useEffect(() => { load(); }, []);

  async function send(e: FormEvent) {
    e.preventDefault();
    const { error } = await db.from("messages").insert({ workshop_id: workshopId, sender_id: userId, client_id: clientId || null, body });
    if (error) setNotice(error.message); else { setBody(""); setNotice("Mensagem registrada."); load(); }
  }

  return <div className="grid gap-7 xl:grid-cols-[360px_1fr]">
    <form onSubmit={send} className="rounded-xl border border-zinc-800 bg-[#1A1A1A] p-5">
      <h2 className="font-semibold">Nova mensagem</h2>
      <p className="mt-1 text-sm text-zinc-400">Registre o contato feito com o cliente.</p>
      <select className="field mt-4" value={clientId} onChange={e => setClientId(e.target.value)}><option value="">Mensagem interna (sem cliente)</option>{clients.map(c => <option key={c.id} value={c.id}>{c.name}{c.phone ? ` — ${c.phone}` : ""}</option>)}</select>
      <textarea required className="field mt-3 min-h-36" value={body} onChange={e => setBody(e.target.value)} placeholder="Escreva a mensagem ou anotação..." />
      <button className="mt-4 rounded-lg bg-[#FFC107] px-4 py-2 font-bold text-black">Registrar</button>
      {notice && <p className="mt-3 text-sm text-zinc-300">{notice}</p>}
    </form>
    <section><h2 className="text-xl font-bold">Histórico de conversas</h2><div className="mt-4 space-y-3">{messages.length === 0 && <p className="rounded-xl border border-dashed border-zinc-700 p-5 text-zinc-400">Nenhuma conversa registrada ainda.</p>}{messages.map(m => <article key={m.id} className="rounded-xl border border-zinc-800 bg-[#171717] p-4"><div className="flex justify-between gap-3"><b className="text-[#FFC107]">{m.clients?.name || "Equipe interna"}</b><time className="text-xs text-zinc-500">{new Date(m.created_at).toLocaleString("pt-BR")}</time></div><p className="mt-2 text-zinc-200">{m.body}</p></article>)}</div></section>
  </div>;
}
