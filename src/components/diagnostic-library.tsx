"use client";

import { FormEvent, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Dtc = { id: string; code: string; title: string; description: string | null };
type Tech = { id: string; title: string; category: string; brand: string | null; model: string | null; content: string };

export function DiagnosticLibrary({ workshopId, mode }: { workshopId: string; mode: "dtc" | "tech" }) {
  const db = createClient();
  const [dtcs, setDtcs] = useState<Dtc[]>([]);
  const [tech, setTech] = useState<Tech[]>([]);
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [msg, setMsg] = useState("");

  async function load() {
    if (mode === "dtc") {
      const { data } = await db.from("dtcs").select("id,code,title,description").or(`workshop_id.is.null,workshop_id.eq.${workshopId}`).order("code");
      setDtcs((data || []) as Dtc[]);
    } else {
      const { data } = await db.from("technical_data").select("id,title,category,brand,model,content").or(`workshop_id.is.null,workshop_id.eq.${workshopId}`).order("title");
      setTech((data || []) as Tech[]);
    }
  }

  useEffect(() => { load(); }, []);

  async function save(e: FormEvent) {
    e.preventDefault();
    const result = mode === "dtc"
      ? await db.from("dtcs").insert({ workshop_id: workshopId, code: category, title, description: content })
      : await db.from("technical_data").insert({ workshop_id: workshopId, category, title, content, brand: brand || null, model: model || null });
    setMsg(result.error?.message || (mode === "dtc" ? "DTC salvo." : "Referência técnica salva."));
    if (!result.error) {
      setCategory(""); setTitle(""); setContent(""); setBrand(""); setModel("");
      load();
    }
  }

  const list = mode === "dtc"
    ? dtcs.filter((x) => `${x.code} ${x.title}`.toLowerCase().includes(q.toLowerCase()))
    : tech.filter((x) => `${x.title} ${x.category} ${x.brand || ""} ${x.model || ""}`.toLowerCase().includes(q.toLowerCase()));

  if (mode === "dtc") { const dtcList = list as Dtc[]; return <section className="rounded-xl border border-zinc-800 bg-[#1A1A1A] p-5">
    <h2 className="font-semibold">Buscar código DTC</h2>
    <p className="mt-1 text-sm text-zinc-400">Digite o código ou o sintoma para consultar a base cadastrada.</p>
    <form onSubmit={(e) => { e.preventDefault(); setMsg(list.length ? `${list.length} resultado(s) encontrado(s).` : "Nenhum código encontrado."); }} className="mt-4 flex flex-col gap-3 sm:flex-row">
      <input required className="field flex-1" placeholder="Ex.: P0300 ou falha de ignição" value={q} onChange={(e) => { setQ(e.target.value); setMsg(""); }} />
      <button className="rounded-lg bg-[#FFC107] px-5 py-2 font-bold text-black">Buscar</button>
    </form>
    {msg && <p className="mt-3 text-sm text-[#FFC107]">{msg}</p>}
    <div className="mt-5 space-y-2">{q && dtcList.map((x) => <article key={x.id} className="rounded-xl border border-zinc-800 bg-[#171717] p-4"><b className="text-[#FFC107]">{x.code}</b><h3 className="mt-1 font-semibold">{x.title}</h3><p className="mt-2 text-sm text-zinc-400">{x.description || "Sem descrição"}</p></article>)}</div>
  </section>; }

  const techList = list as Tech[];

  return <div className="grid gap-7 xl:grid-cols-[360px_1fr]">
    <form onSubmit={save} className="rounded-xl border border-zinc-800 bg-[#1A1A1A] p-5">
      <h2 className="font-semibold">Nova referência técnica</h2>
      <div className="mt-4 grid gap-3">
        <input required className="field" placeholder="Categoria (ex.: Motor, Freios, Elétrica)" value={category} onChange={(e) => setCategory(e.target.value)} />
        <div className="grid gap-3 sm:grid-cols-2"><input className="field" placeholder="Marca (opcional)" value={brand} onChange={(e) => setBrand(e.target.value)} /><input className="field" placeholder="Modelo (opcional)" value={model} onChange={(e) => setModel(e.target.value)} /></div>
        <input required className="field" placeholder="Título da referência" value={title} onChange={(e) => setTitle(e.target.value)} />
        <textarea required className="field min-h-32" placeholder="Procedimento, torque, especificações ou observações" value={content} onChange={(e) => setContent(e.target.value)} />
      </div>
      <button className="mt-4 rounded-lg bg-[#FFC107] px-4 py-2 font-bold text-black">Salvar referência</button>{msg && <p className="mt-3 text-sm">{msg}</p>}
    </form>
    <section><input className="field" placeholder="Buscar por título, categoria, marca ou modelo" value={q} onChange={(e) => setQ(e.target.value)} /><div className="mt-4 space-y-2">{techList.map((x) => <article key={x.id} className="rounded-xl border border-zinc-800 bg-[#171717] p-4"><b className="text-[#FFC107]">{x.category}</b><h3 className="mt-1 font-semibold">{x.title}</h3>{(x.brand || x.model) && <p className="mt-1 text-sm text-zinc-300">{[x.brand, x.model].filter(Boolean).join(" · ")}</p>}<p className="mt-2 text-sm text-zinc-400">{x.content}</p></article>)}</div></section>
  </div>;
}
