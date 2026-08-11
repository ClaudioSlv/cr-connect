"use client";

import { FormEvent, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Vehicle = {
  id: string;
  plate: string | null;
  brand: string | null;
  model: string;
  year: number | null;
  color: string | null;
};

type SosRequest = {
  id: string;
  requester_name: string;
  service_type: string;
  status: "requested" | "accepted" | "declined" | "cancelled" | "completed";
  created_at: string;
  workshops: { name: string } | null;
};

const sosStatus: Record<SosRequest["status"], string> = {
  requested: "Aguardando resposta",
  accepted: "Aceito pela oficina",
  declined: "Recusado",
  cancelled: "Cancelado",
  completed: "Atendimento concluído",
};

export function OwnerDashboard({ name }: { name: string }) {
  const db = createClient();
  const [items, setItems] = useState<Vehicle[]>([]);
  const [requests, setRequests] = useState<SosRequest[]>([]);
  const [model, setModel] = useState("");
  const [plate, setPlate] = useState("");
  const [brand, setBrand] = useState("");
  const [year, setYear] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    const [vehiclesResult, requestsResult] = await Promise.all([
      db.from("owner_vehicles").select("id,plate,brand,model,year,color").order("created_at", { ascending: false }),
      db.from("sos_requests").select("id,requester_name,service_type,status,created_at,workshops(name)").order("created_at", { ascending: false }).limit(5),
    ]);
    if (vehiclesResult.error) setNotice(vehiclesResult.error.message);
    else setItems((vehiclesResult.data || []) as Vehicle[]);
    if (!requestsResult.error) setRequests((requestsResult.data || []) as unknown as SosRequest[]);
  }

  useEffect(() => {
    void load();
  }, []);

  async function save(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setNotice("");
    const {
      data: { user },
    } = await db.auth.getUser();
    if (!user) {
      setNotice("Sua sessão expirou. Entre novamente.");
      setSaving(false);
      return;
    }
    const { error } = await db.from("owner_vehicles").insert({
      owner_id: user.id,
      model: model.trim(),
      plate: plate.trim().toUpperCase() || null,
      brand: brand.trim() || null,
      year: year ? Number(year) : null,
    });
    if (error) {
      setNotice(error.message);
    } else {
      setModel("");
      setPlate("");
      setBrand("");
      setYear("");
      setNotice("Veículo salvo com sucesso.");
      await load();
    }
    setSaving(false);
  }

  async function remove(id: string) {
    if (!window.confirm("Remover este veículo da sua conta?")) return;
    const { error } = await db.from("owner_vehicles").delete().eq("id", id);
    if (error) setNotice(error.message);
    else {
      setNotice("Veículo removido.");
      await load();
    }
  }

  async function signOut() {
    await db.auth.signOut();
    window.location.assign("/");
  }

  return (
    <main className="min-h-screen bg-[#0E0E0E] p-6 text-zinc-100 md:p-12">
      <div className="mx-auto max-w-4xl">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold tracking-[.2em] text-[#FFC107]">CR CONNECT · PROPRIETÁRIO</p>
            <h1 className="mt-3 text-3xl font-bold">Olá, {name || "motorista"}</h1>
            <p className="mt-2 text-zinc-400">Sua conta é gratuita. Cadastre seus veículos e use o CR SOS quando precisar.</p>
          </div>
          <button onClick={signOut} className="rounded-lg border border-zinc-700 px-4 py-2 text-sm font-semibold hover:border-zinc-500">Sair</button>
        </header>

        <div className="mt-7 flex flex-wrap gap-3">
          <a href="/sos" className="rounded-lg bg-[#FFC107] px-5 py-3 font-bold text-black">Abrir CR SOS</a>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[360px_1fr]">
          <form onSubmit={save} className="h-fit rounded-xl border border-zinc-800 bg-[#171717] p-5">
            <h2 className="text-xl font-bold">Adicionar veículo</h2>
            <div className="mt-4 grid gap-3">
              <input required className="field" placeholder="Modelo do veículo" value={model} onChange={(event) => setModel(event.target.value)} />
              <input className="field" placeholder="Marca" value={brand} onChange={(event) => setBrand(event.target.value)} />
              <input className="field" placeholder="Placa" value={plate} onChange={(event) => setPlate(event.target.value)} />
              <input className="field" type="number" min="1900" max="2100" placeholder="Ano" value={year} onChange={(event) => setYear(event.target.value)} />
            </div>
            <button disabled={saving} className="mt-4 rounded-lg bg-[#FFC107] px-4 py-2 font-bold text-black disabled:opacity-60">{saving ? "Salvando…" : "Salvar veículo"}</button>
            {notice && <p role="status" className="mt-3 text-sm text-zinc-300">{notice}</p>}
          </form>

          <section>
            <h2 className="text-xl font-bold">Meus veículos</h2>
            <div className="mt-4 space-y-3">
              {items.length === 0 && <p className="rounded-xl border border-zinc-800 bg-[#171717] p-5 text-zinc-400">Nenhum veículo cadastrado.</p>}
              {items.map((item) => (
                <article key={item.id} className="flex items-start justify-between gap-4 rounded-xl border border-zinc-800 bg-[#171717] p-5">
                  <div>
                    <b>{item.brand ? `${item.brand} ` : ""}{item.model}</b>
                    <p className="mt-1 text-sm text-zinc-400">{item.plate || "Placa não informada"}{item.year ? ` · ${item.year}` : ""}</p>
                  </div>
                  <button onClick={() => void remove(item.id)} className="text-sm font-semibold text-zinc-400 hover:text-red-400">Remover</button>
                </article>
              ))}
            </div>
          </section>
        </div>

        <section className="mt-8">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 className="text-xl font-bold">Meus chamados CR SOS</h2>
              <p className="mt-1 text-sm text-zinc-400">Os últimos pedidos feitos enquanto você estava conectado.</p>
            </div>
            <a href="/sos" className="text-sm font-semibold text-[#FFC107]">Novo chamado</a>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {requests.length === 0 && <p className="rounded-xl border border-zinc-800 bg-[#171717] p-5 text-zinc-400">Você ainda não fez nenhum chamado CR SOS.</p>}
            {requests.map((request) => (
              <article key={request.id} className="rounded-xl border border-zinc-800 bg-[#171717] p-5">
                <p className="font-bold">{request.workshops?.name || "Oficina CR SOS"}</p>
                <p className="mt-1 text-sm text-zinc-300">{request.service_type}</p>
                <div className="mt-3 flex flex-wrap justify-between gap-2 text-sm">
                  <span className="font-semibold text-[#FFC107]">{sosStatus[request.status]}</span>
                  <span className="text-zinc-500">{new Date(request.created_at).toLocaleDateString("pt-BR")}</span>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
