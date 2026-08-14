"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function AuthCallbackPage() {
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const db = createClient();

    async function finishSignIn() {
      const params = new URLSearchParams(window.location.search);
      const callbackError = params.get("error_description") || params.get("error");
      if (callbackError) {
        if (active) setError("Este link de acesso não é mais válido. Volte e solicite apenas um novo link.");
        return;
      }

      // Em alguns celulares o Supabase recebe um código na URL e não conclui a
      // troca imediatamente. Fazemos a troca aqui e aguardamos a sessão antes
      // de abrir o painel, evitando que o usuário fique no ciclo de e-mails.
      const code = params.get("code");
      if (code) {
        const { error: exchangeError } = await db.auth.exchangeCodeForSession(code);
        if (exchangeError) {
          if (active) setError("Não foi possível validar este link. Solicite um novo link e abra somente o mais recente.");
          return;
        }
      }

      for (let attempt = 0; attempt < 12; attempt += 1) {
        const { data, error: sessionError } = await db.auth.getSession();
        if (!sessionError && data.session) {
          window.location.replace("/app");
          return;
        }
        await new Promise((resolve) => window.setTimeout(resolve, 400));
      }

      if (active) setError("Não foi possível confirmar o acesso neste aparelho. Solicite um novo link e abra somente o mais recente.");
    }

    void finishSignIn();
    return () => { active = false; };
  }, []);

  return (
    <main className="grid min-h-screen place-items-center bg-[#0E0E0E] p-6">
      <section className="w-full max-w-md rounded-2xl border border-[#5a461c] bg-[#121212] p-8 text-center shadow-2xl">
        <Image src="/brand/cr-reparador.jpg" width={132} height={132} alt="CR Reparador Automotivo" className="mx-auto rounded-2xl" />
        {error ? <><h1 className="mt-7 text-3xl font-black text-white">LINK NÃO CONCLUÍDO</h1><p className="mt-4 text-lg leading-relaxed text-zinc-300">{error}</p><a href="/login" className="mt-7 inline-block rounded-lg bg-[#FFC107] px-5 py-3 font-bold text-black">Voltar para entrar</a></> : <><p className="mt-7 text-sm font-bold tracking-[.18em] text-[#FFC107]">CR CONNECT</p><h1 className="mt-4 text-3xl font-black text-white">CONFIRMANDO ACESSO</h1><p className="mt-4 text-lg text-zinc-300">Aguarde um instante. Estamos abrindo o seu aplicativo.</p></>}
      </section>
    </main>
  );
}
