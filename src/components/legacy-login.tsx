"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(true);
  const [emailSent, setEmailSent] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [creatingAccount, setCreatingAccount] = useState(false);

  useEffect(() => {
    setCreatingAccount(new URLSearchParams(window.location.search).get("novo") === "1");
    const db = createClient();
    Promise.all([
      db.auth.getUser(),
      new Promise((resolve) => window.setTimeout(resolve, 1200)),
    ]).then(([{ data: { user } }]) => {
      if (user) window.location.replace("/app");
      else setBusy(false);
    });
  }, []);

  useEffect(() => {
    if (!emailSent) return;
    const timer = window.setTimeout(() => setShowConfirmation(true), 3000);
    return () => window.clearTimeout(timer);
  }, [emailSent]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) return;
    setBusy(true);
    setNotice("");
    const { error } = await createClient().auth.signInWithOtp({
      email: normalizedEmail,
      options: {
        shouldCreateUser: true,
        emailRedirectTo: `${location.origin}/auth/callback`,
      },
    });

    if (error) {
      const detail = error.message.toLowerCase();
      setNotice(detail.includes("rate") || detail.includes("limit")
        ? "Muitos links de acesso foram solicitados agora. Aguarde alguns minutos antes de tentar novamente."
        : "O e-mail de acesso não pôde ser enviado agora. Tente novamente em alguns minutos ou fale com a oficina.");
      setBusy(false);
      return;
    }

    setEmail(normalizedEmail);
    setBusy(false);
    setEmailSent(true);
  }

  if (busy && !notice && !emailSent) return <main className="relative min-h-screen overflow-hidden bg-black"><Image src="/brand/cr-reparador-splash.jpg" fill priority sizes="100vw" alt="CR Reparador Automotivo · carregando" className="object-contain" /></main>;

  if (emailSent) return (
    <main className="grid min-h-screen place-items-center bg-[#0E0E0E] p-6">
      <section className="w-full max-w-md rounded-2xl border border-[#5a461c] bg-[#121212] p-8 text-center shadow-2xl">
        <Image src="/brand/cr-reparador.jpg" width={152} height={152} alt="CR Reparador Automotivo" className="mx-auto animate-pulse rounded-2xl" />
        {!showConfirmation ? <div className="py-12"><p className="text-sm font-bold tracking-[.18em] text-[#FFC107]">CR CONNECT</p><h1 className="mt-5 text-3xl font-bold">Preparando seu acesso…</h1><p className="mt-4 text-lg text-zinc-300">Estamos enviando seu link seguro.</p></div> : <div className="py-8"><p className="text-sm font-bold tracking-[.18em] text-[#FFC107]">PASSO IMPORTANTE</p><h1 className="mt-5 text-4xl font-black leading-tight text-white">CONFIRME NO SEU E-MAIL</h1><p className="mt-6 text-xl font-semibold text-zinc-100">Abra o e-mail enviado para:</p><p className="mt-2 break-all rounded-xl border border-[#5a461c] bg-black/30 p-4 text-lg font-bold text-[#FFC107]">{email}</p><div className="mt-6 rounded-2xl border-2 border-[#FFC107] bg-[#FFC107]/10 p-5"><p className="text-xl font-black leading-snug text-[#FFC107]">Clique no link que enviamos para o seu e-mail, para que possa ter acesso.</p></div><p className="mt-5 text-base text-zinc-300">Procure a mensagem do <strong>CR CONNECT</strong> e toque em <strong>Confirmar acesso</strong>.</p><p className="mt-4 text-base text-zinc-400">Se não encontrar, verifique a pasta Spam ou Lixo eletrônico.</p><button type="button" onClick={() => { setEmailSent(false); setShowConfirmation(false); }} className="mt-8 rounded-lg border border-[#FFC107] px-5 py-3 font-bold text-[#FFC107]">Usar outro e-mail</button></div>}
      </section>
    </main>
  );

  return <main className="grid min-h-screen place-items-center p-6"><form onSubmit={submit} className="w-full max-w-md rounded-2xl border border-[#5a461c] bg-[#121212] p-8 shadow-2xl"><Image src="/brand/cr-reparador.jpg" width={160} height={160} alt="CR Reparador Automotivo" className="mx-auto rounded-2xl" /><p className="mt-5 text-center text-sm font-bold tracking-[.18em] text-[#FFC107]">CR CONNECT</p><h1 className="mt-3 text-center text-3xl font-bold">{creatingAccount ? "Crie sua conta" : "Bem-vindo de volta"}</h1><p className="mt-2 text-center text-sm text-zinc-400">{creatingAccount ? "Informe seu e-mail. Após confirmar, você escolherá o tipo de cadastro." : "Use seu e-mail para receber um link seguro de acesso."}</p><label className="mt-7 block text-sm">E-mail<input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="field mt-2" placeholder="seuemail@exemplo.com" /></label><button disabled={busy} className="mt-5 w-full rounded-lg bg-[#FFC107] px-4 py-3 font-bold text-black disabled:opacity-60">{busy ? "Enviando…" : creatingAccount ? "Enviar confirmação" : "Entrar"}</button>{notice && <p className="mt-4 text-sm text-zinc-300">{notice}</p>}</form></main>;
}
