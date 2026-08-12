"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Subscription = { plan_code: string; status: string };

const plans = [
  { id: "free", name: "Essencial", price: "Grátis", items: ["Clientes e veículos", "O.S. e orçamentos", "Estoque básico"] },
  { id: "pro", name: "Profissional", price: "R$ 29,90", items: ["Financeiro completo", "Assistente Gemini", "Equipe e relatórios"] },
  { id: "premium", name: "CR SOS", price: "R$ 44,90", items: ["Tudo do Profissional", "Chamados de clientes próximos", "Prioridade no mapa"] },
];

export function SubscriptionManager({ workshopId, isAdmin }: { workshopId: string; isAdmin: boolean }) {
  const db = createClient();
  const searchParams = useSearchParams();
  const [sub, setSub] = useState<Subscription | null>(null);
  const [notice, setNotice] = useState("");
  const [planNotice, setPlanNotice] = useState("");
  const [loading, setLoading] = useState<string | null>(null);

  async function load() {
    const { data } = await db.from("subscriptions").select("plan_code,status").eq("workshop_id", workshopId).maybeSingle();
    setSub(data as Subscription | null);
  }

  useEffect(() => {
    void load();
    if (searchParams.get("checkout")) setNotice("Pagamento recebido. Estamos confirmando seu plano.");
  }, []);

  async function choose(plan: string) {
    setLoading(plan);
    setNotice("");
    setPlanNotice("");
    try {
      if (plan === "free") {
        const { error } = await db.from("subscriptions").upsert({ workshop_id: workshopId, plan_code: "free", status: "active" }, { onConflict: "workshop_id" });
        setNotice(error?.message || "Plano Essencial ativo.");
        await load();
        return;
      }

      const response = await fetch("/api/checkout-assinatura", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Não foi possível gerar o checkout.");
      if (typeof result.checkoutUrl !== "string") throw new Error("A InfinitePay não retornou o link de pagamento.");
      setPlanNotice("Abrindo o pagamento seguro da InfinitePay…");
      window.location.href = result.checkoutUrl;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Não foi possível iniciar o pagamento.";
      setNotice(message);
      setPlanNotice(`${message} Ative o Checkout Integrado no app InfinitePay para liberar a cobrança.`);
    } finally {
      setLoading(null);
    }
  }

  return <div>
    <section className="rounded-xl border border-[#4a3818] bg-[#1A1A1A] p-5">
      <p className="text-sm text-zinc-400">Plano atual</p>
      <h2 className="mt-2 text-2xl font-bold text-[#FFC107]">{plans.find((plan) => plan.id === sub?.plan_code)?.name || "Essencial"}</h2>
      <p className="mt-2 text-sm text-zinc-400">Status: {sub?.status || "ativo"}</p>
      {notice && <p className="mt-3 text-sm text-zinc-200">{notice}</p>}
    </section>
    <div className="mt-7 grid gap-4 lg:grid-cols-3">
      {plans.map((plan) => <article key={plan.id} className={`rounded-xl border p-5 ${sub?.plan_code === plan.id ? "border-[#FFC107] bg-[#211805]" : "border-zinc-800 bg-[#171717]"}`}>
        <h2 className="text-xl font-bold">{plan.name}</h2>
        <p className="mt-2 text-2xl font-bold text-[#FFC107]">{plan.price}</p>
        <ul className="mt-5 space-y-2 text-sm text-zinc-300">{plan.items.map((item) => <li key={item}>✓ {item}</li>)}</ul>
        {isAdmin && <button disabled={loading !== null} onClick={() => void choose(plan.id)} className="mt-6 rounded-lg bg-[#FFC107] px-4 py-2 font-bold text-black disabled:cursor-wait disabled:opacity-60">{loading === plan.id ? "Aguarde…" : plan.id === "free" ? "Usar Essencial" : "Assinar agora"}</button>}
        {plan.id !== "free" && loading === null && planNotice && <p className="mt-3 text-sm text-amber-200">{planNotice}</p>}
      </article>)}
    </div>
    <p className="mt-6 text-sm text-zinc-500">Pagamentos por Pix e cartão são processados pela InfinitePay.</p>
  </div>;
}
