"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    const db = createClient();
    db.auth.getUser().then(({ data: { user } }) => {
      if (user) window.location.replace("/app");
      else setBusy(false);
    });
  }, []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setNotice("");
    const { error } = await createClient().auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${location.origin}/auth/callback` },
    });
    if (error) {
      const detail = error.message.toLowerCase();
      setNotice(
        detail.includes("rate") || detail.includes("limit")
          ? "Muitos links de acesso foram solicitados agora. Aguarde alguns minutos antes de tentar novamente."
          : "O e-mail de acesso não pôde ser enviado agora. Tente novamente em alguns minutos ou fale com a oficina.",
      );
    } else {
      setNotice("Link enviado. Abra seu e-mail e toque em “Confirmar acesso” para continuar.");
    }
    setBusy(false);
  }

  if (busy && !notice) return <main className="grid min-h-screen place-items-center bg-[#0E0E0E] p-6 text-zinc-400">Verificando acesso…</main>;

  return <main className="grid min-h-screen place-items-center p-6"><form onSubmit={submit} className="w-full max-w-md rounded-2xl border border-[#5a461c] bg-[#121212] p-8 shadow-2xl"><Image src="/brand/cr-reparador.jpg" width={160} height={160} alt="CR Reparador Automotivo" className="mx-auto rounded-2xl"/><p className="mt-5 text-center text-sm font-bold tracking-[.18em] text-[#FFC107]">CR CONNECT</p><h1 className="mt-3 text-center text-3xl font-bold">Bem-vindo de volta</h1><p className="mt-2 text-center text-sm text-zinc-400">Use seu e-mail para receber um link seguro de acesso.</p><label className="mt-7 block text-sm">E-mail<input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="field mt-2" placeholder="seuemail@exemplo.com"/></label><button disabled={busy} className="mt-5 w-full rounded-lg bg-[#FFC107] px-4 py-3 font-bold text-black disabled:opacity-60">{busy ? "Enviando..." : "Entrar"}</button>{notice && <p className="mt-4 text-sm text-zinc-300">{notice}</p>}</form></main>;
}
