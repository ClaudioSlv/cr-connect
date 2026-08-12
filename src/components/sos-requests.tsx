"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Request = { id: string; requester_name: string; requester_phone: string | null; service_type: string; description: string | null; status: string; created_at: string; viewed_at: string | null; feedback_rating: number | null; feedback_text: string | null; feedback_at: string | null };
const labels: Record<string, string> = { requested: "Aguardando resposta", accepted: "Aceito", declined: "Recusado", cancelled: "Cancelado", completed: "Concluído" };

export function SosRequests({ initial }: { initial: Request[] }) {
  const db = createClient();
  const [items, setItems] = useState(initial);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    initial.filter((item) => !item.viewed_at && item.status === "requested").forEach((item) => void db.rpc("acknowledge_sos_request", { p_request_id: item.id }));
  }, []);

  async function update(id: string, status: "accepted" | "declined" | "completed") {
    const { error } = await db.from("sos_requests").update({ status }).eq("id", id);
    if (error) { setNotice(error.message); return; }
    setItems((current) => current.map((item) => item.id === id ? { ...item, status } : item));
    setNotice(status === "completed" ? "Atendimento concluído. O cliente já pode avaliar a oficina." : "Chamado atualizado.");
  }

  return <section className="mt-7"><div className="flex items-center justify-between"><h2 className="text-xl font-bold">Pedidos recebidos</h2><span className="text-sm text-zinc-400">{items.length} chamado(s)</span></div>{notice && <p className="mt-3 text-sm text-[#FFC107]">{notice}</p>}<div className="mt-4 space-y-3">{items.length === 0 && <p className="rounded-xl border border-zinc-800 bg-[#171717] p-5 text-zinc-400">Ainda não há chamados SOS para esta oficina.</p>}{items.map((item) => <article key={item.id} className="rounded-xl border border-zinc-800 bg-[#171717] p-5"><div className="flex flex-wrap justify-between gap-3"><div><h3 className="font-bold">{item.requester_name} · {item.service_type}</h3><p className="mt-1 text-sm text-zinc-400">{new Date(item.created_at).toLocaleString("pt-BR")}</p></div><b className="text-[#FFC107]">{labels[item.status] || item.status}</b></div>{item.requester_phone && <a className="mt-3 block text-sm text-[#FFC107]" href={`tel:${item.requester_phone}`}>Ligar: {item.requester_phone}</a>}{item.description && <p className="mt-2 text-sm text-zinc-300">{item.description}</p>}{item.status === "requested" && <div className="mt-4 flex gap-3"><button onClick={() => void update(item.id, "accepted")} className="rounded-lg bg-[#FFC107] px-4 py-2 font-bold text-black">Aceitar</button><button onClick={() => void update(item.id, "declined")} className="rounded-lg border border-zinc-600 px-4 py-2 font-bold">Recusar</button></div>}{item.status === "accepted" && <button onClick={() => void update(item.id, "completed")} className="mt-4 rounded-lg border border-[#FFC107] px-4 py-2 font-bold text-[#FFC107]">Concluir atendimento</button>}{item.feedback_rating && <div className="mt-4 rounded-lg border border-[#6b510d] bg-[#211805] p-4"><p className="font-bold text-[#FFC107]">Nova avaliação: {"★".repeat(item.feedback_rating)}{"☆".repeat(5 - item.feedback_rating)}</p>{item.feedback_text && <p className="mt-2 text-sm text-zinc-200">“{item.feedback_text}”</p>}{item.feedback_at && <p className="mt-2 text-xs text-zinc-400">Recebida em {new Date(item.feedback_at).toLocaleDateString("pt-BR")}</p>}</div>}</article>)}</div></section>;
}
