"use client";

import { FormEvent, useState } from "react";

type Lookup = { found: boolean; email?: string; canReset?: boolean; message?: string; error?: string };

export function IncompleteRegistrationReset() {
  const [email, setEmail] = useState("");
  const [result, setResult] = useState<Lookup | null>(null);
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);

  async function lookup(event: FormEvent) {
    event.preventDefault(); setLoading(true); setNotice(""); setResult(null);
    const response = await fetch(`/api/admin/reset-onboarding?email=${encodeURIComponent(email)}`);
    const body = await response.json().catch(() => ({})) as Lookup;
    setLoading(false);
    if (!response.ok) return setNotice(body.error || "Não foi possível consultar agora.");
    if (!body.found) return setNotice("Nenhum cadastro pendente foi encontrado com este e-mail.");
    setResult(body); setNotice(body.message || "Cadastro encontrado.");
  }

  async function reset() {
    if (!result?.canReset || !window.confirm(`Resetar o cadastro incompleto de ${result.email}? A pessoa deverá criar a conta novamente.`)) return;
    setLoading(true); setNotice("");
    const response = await fetch("/api/admin/reset-onboarding", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
    const body = await response.json().catch(() => ({})) as Lookup;
    setLoading(false);
    if (!response.ok) return setNotice(body.error || "Não foi possível resetar agora.");
    setNotice(body.message || "Cadastro resetado com sucesso."); setResult(null); setEmail("");
  }

  return <section className="mt-7 max-w-4xl rounded-xl border border-amber-400/40 bg-[#1A1A1A] p-5">
    <h2 className="font-semibold text-[#FFC107]">Resetar cadastro incompleto</h2>
    <p className="mt-2 text-sm text-zinc-400">Use apenas quando a pessoa não conseguiu concluir o primeiro cadastro. Contas que já possuem oficina ou veículo ficam protegidas.</p>
    <form onSubmit={lookup} className="mt-4 flex flex-col gap-3 sm:flex-row">
      <input className="field flex-1" type="email" required placeholder="E-mail da pessoa" value={email} onChange={(event) => setEmail(event.target.value)} />
      <button disabled={loading} className="rounded-lg border border-[#FFC107] px-5 py-2.5 font-bold text-[#FFC107] disabled:opacity-60">{loading ? "Aguarde..." : "Procurar cadastro"}</button>
    </form>
    {result?.canReset && <button onClick={reset} disabled={loading} className="mt-4 rounded-lg bg-[#FFC107] px-5 py-2.5 font-bold text-black disabled:opacity-60">Resetar cadastro</button>}
    {notice && <p className="mt-3 text-sm text-zinc-200">{notice}</p>}
  </section>;
}
