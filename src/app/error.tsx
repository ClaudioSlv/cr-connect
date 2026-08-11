"use client";

import { useEffect } from "react";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("CR Connect application error", error);
  }, [error]);

  return (
    <main className="grid min-h-screen place-items-center bg-[#0E0E0E] p-6 text-zinc-100">
      <section className="w-full max-w-md rounded-2xl border border-zinc-800 bg-[#171717] p-7 text-center shadow-2xl">
        <p className="text-xs font-bold tracking-[.2em] text-[#FFC107]">CR CONNECT</p>
        <h1 className="mt-4 text-2xl font-bold">Não foi possível abrir esta tela</h1>
        <p className="mt-3 text-sm leading-6 text-zinc-400">Tente novamente. Se o problema continuar, volte ao início e entre em contato com o suporte.</p>
        <div className="mt-6 flex justify-center gap-3">
          <button onClick={reset} className="rounded-lg bg-[#FFC107] px-4 py-2 font-bold text-black">Tentar novamente</button>
          <a href="/app" className="rounded-lg border border-zinc-700 px-4 py-2 font-bold">Ir ao início</a>
        </div>
      </section>
    </main>
  );
}
