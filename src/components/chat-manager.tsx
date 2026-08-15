"use client";

import { FormEvent, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Client = { id: string; full_name: string; phone: string | null };
type Message = { id: string; body: string; created_at: string; owner_id: string | null };

export function ChatManager({ workshopId, userId }: { workshopId: string; userId: string }) {
  const db = createClient();
  const [clients, setClients] = useState<Client[]>([]); const [messages, setMessages] = useState<Message[]>([]);
  const [clientId, setClientId] = useState(""); const [body, setBody] = useState(""); const [notice, setNotice] = useState("");
  async function load(selectedClientId = clientId) {
    const { data: clientData } = await db.from("clients").select("id,full_name,phone").eq("workshop_id", workshopId).order("full_name");
    const clientItems = (clientData || []) as Client[]; setClients(clientItems);
    const active = selectedClientId || clientItems[0]?.id || ""; if (!clientId && active) setClientId(active);
    if (!active) { setMessages([]); return; }
    const { data } = await db.from("messages").select("id,body,created_at,owner_id").eq("workshop_id", workshopId).eq("client_id", active).order("created_at", { ascending: true });
    setMessages((data || []) as Message[]);
  }
  useEffect(() => { void load(); const timer = window.setInterval(() => void load(), 7000); return () => window.clearInterval(timer); }, [clientId]);
  async function send(event: FormEvent) {
    event.preventDefault(); if (!clientId) { setNotice("Escolha um cliente."); return; }
    const { data, error } = await db.from("messages").insert({ workshop_id: workshopId, sender_id: userId, client_id: clientId, body: body.trim() }).select("id").single();
    if (error) setNotice(error.message); else { setBody(""); setNotice("Mensagem enviada para o cliente."); void load(clientId); void fetch("/api/push-order", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: data.id, event: "chat" }) }); }
  }
  return <div className="grid gap-7 xl:grid-cols-[360px_1fr]"><form onSubmit={send} className="rounded-xl border border-zinc-800 bg-[#1A1A1A] p-5"><h2 className="font-semibold">Conversa com o cliente</h2><p className="mt-1 text-sm text-zinc-400">A mensagem chega no portal do cliente e no sino de avisos.</p><select className="field mt-4" value={clientId} onChange={(event) => { setClientId(event.target.value); void load(event.target.value); }}><option value="">Selecione o cliente</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.full_name}{client.phone ? ` — ${client.phone}` : ""}</option>)}</select><textarea required className="field mt-3 min-h-36" value={body} onChange={(event) => setBody(event.target.value)} placeholder="Escreva a mensagem..."/><button className="mt-4 rounded-lg bg-[#FFC107] px-4 py-2 font-bold text-black">Enviar mensagem</button>{notice && <p className="mt-3 text-sm text-[#FFC107]">{notice}</p>}</form><section><h2 className="text-xl font-bold">Histórico da conversa</h2><div className="mt-4 space-y-3">{messages.length === 0 && <p className="rounded-xl border border-dashed border-zinc-700 p-5 text-zinc-400">Nenhuma mensagem neste atendimento ainda.</p>}{messages.map((message) => <article key={message.id} className={`rounded-xl border p-4 ${message.owner_id ? "border-zinc-700 bg-zinc-800" : "border-[#6b510d] bg-[#211805]"}`}><div className="flex justify-between gap-3"><b className="text-[#FFC107]">{message.owner_id ? "Cliente" : "Oficina"}</b><time className="text-xs text-zinc-500">{new Date(message.created_at).toLocaleString("pt-BR")}</time></div><p className="mt-2 text-zinc-200">{message.body}</p></article>)}</div></section></div>;
}
