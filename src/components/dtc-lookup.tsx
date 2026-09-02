"use client";

import { FormEvent, useState } from "react";

export function DtcLookup() {
  const [vehicle, setVehicle] = useState("");
  const [code, setCode] = useState("");
  const [answer, setAnswer] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function search(event: FormEvent) {
    event.preventDefault();
    const normalizedCode = code.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (!/^[PBCU][0-9A-F]{4}$/i.test(normalizedCode)) { setError("Informe um código DTC válido, como C1208 ou P0300."); return; }
    setCode(normalizedCode); setLoading(true); setError(""); setAnswer("");
    try {
      const response = await fetch("/api/diagnostico-ia", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ vehicle: vehicle.trim(), symptom: normalizedCode, mode: "dtc" }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) setError(data.error || "Não foi possível consultar esse código agora.");
      else setAnswer(data.answer || "Nenhuma informação encontrada para esse código.");
    } catch { setError("Não foi possível conectar ao serviço de consulta. Verifique sua internet e tente novamente."); }
    finally { setLoading(false); }
  }

  return <div className="grid gap-5 xl:grid-cols-[420px_1fr]">
    <form onSubmit={search} className="rounded-2xl border border-zinc-800 bg-[#1A1A1A] p-5">
      <h2 className="text-xl font-bold">Consultar código DTC</h2>
      <p className="mt-2 text-sm leading-6 text-zinc-400">Informe o veículo e o código apresentado pelo scanner.</p>
      <label className="mt-5 block text-sm font-bold text-zinc-200">Veículo<input required className="field mt-2" placeholder="Ex.: Hyundai HB20 2014 1.0" value={vehicle} onChange={(event) => setVehicle(event.target.value)} /></label>
      <label className="mt-4 block text-sm font-bold text-zinc-200">Código DTC<input required className="field mt-2 uppercase" autoCapitalize="characters" autoCorrect="off" spellCheck={false} maxLength={8} placeholder="Ex.: C1208" value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} /></label>
      <button disabled={loading} className="mt-5 w-full rounded-xl bg-[#FFC107] px-5 py-3 font-black text-black disabled:opacity-60">{loading ? "Consultando..." : "Consultar código"}</button>
    </form>
    <section className="rounded-2xl border border-[#4a3818] bg-[#171717] p-5">
      <p className="text-xs font-bold tracking-[.16em] text-[#FFC107]">RESULTADO DO DIAGNÓSTICO</p>
      {!answer && !error && <div className="mt-6 rounded-xl border border-dashed border-zinc-700 p-5 text-zinc-400"><p>O significado, as causas prováveis e os testes recomendados aparecerão aqui.</p><p className="mt-3 text-sm">Exemplo: <b className="text-zinc-200">Hyundai HB20 2014 · C1208</b></p></div>}
      {error && <p role="alert" className="mt-5 rounded-xl border border-red-500/50 bg-red-500/10 p-4 leading-6 text-red-300">{error}</p>}
      {answer && <p className="mt-5 whitespace-pre-wrap leading-7 text-zinc-200">{answer}</p>}
      <p className="mt-6 border-t border-zinc-800 pt-4 text-xs leading-5 text-zinc-500">Confirme a definição específica no scanner e no manual do fabricante antes de substituir componentes.</p>
    </section>
  </div>;
}
