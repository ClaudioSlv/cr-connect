'use client';
import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { crRequest } from '@/lib/d1/browser';

export function D1Login({ confirm = false }: { confirm?: boolean }) {
  const [email,setEmail] = useState(''); const [notice,setNotice] = useState('');
  const [sent,setSent] = useState(false); const [busy,setBusy] = useState(false);
  const [loginToken,setLoginToken] = useState<string | null>(null);
  const fragmentRead = useRef(false);
  useEffect(()=>{
    if (confirm) {
      if (fragmentRead.current) return;
      fragmentRead.current = true;
      const value = new URLSearchParams(location.hash.slice(1)).get('token') || '';
      history.replaceState(null,'',location.pathname);
      // Synchronize client-only URL fragment state after removing credentials from history.
      setLoginToken(value);
    } else {
      void crRequest<{user:{id:string}}>('me').then(result=>{if(result.data?.user) location.replace('/app');});
    }
  },[confirm]);
  async function submit(event:React.FormEvent) {
    event.preventDefault(); if (busy) return; setBusy(true);setNotice('');
    const result = confirm
      ? await crRequest('auth/confirm','POST',{token:loginToken})
      : await crRequest('auth/request','POST',{email});
    if (result.error) { setNotice(result.error.message);setBusy(false);return; }
    if (confirm) location.replace('/app'); else {setSent(true);setBusy(false);}
  }
  const message = notice || (confirm && loginToken !== null && !/^[a-f0-9]{64}$/.test(loginToken) ? "Este link está incompleto. Solicite um novo acesso." : "");
  return <main className="grid min-h-screen place-items-center bg-[#0E0E0E] p-6"><form onSubmit={submit} className="w-full max-w-md rounded-2xl border border-[#5a461c] bg-[#121212] p-8 shadow-2xl"><Image src="/brand/cr-reparador.jpg" width={152} height={152} alt="CR Reparador Automotivo" className="mx-auto rounded-2xl"/><p className="mt-5 text-center text-sm font-bold tracking-[.18em] text-[#FFC107]">CR CONNECT</p><h1 className="mt-4 text-center text-3xl font-bold">{confirm?'Confirme seu acesso':sent?'Confira seu e-mail':'Bem-vindo de volta'}</h1>{confirm?<p className="mt-4 text-zinc-300">Toque em confirmar para entrar na sua conta.</p>:sent?<><p className="mt-4 text-zinc-300">Enviamos seu link de acesso para <strong className="break-all">{email}</strong>.</p><p className="mt-3 text-sm text-zinc-400">Ele vale por 15 minutos. Abra no mesmo navegador em que pediu o acesso. Confira também a pasta de spam.</p><button type="button" onClick={()=>{setSent(false);setNotice('');}} className="mt-6 text-sm font-bold text-[#FFC107]">Usar outro e-mail</button></>:<><p className="mt-3 text-sm text-zinc-400">Receba um link seguro para entrar ou criar sua conta.</p><label className="mt-6 block text-sm">E-mail<input autoComplete="email" required type="email" maxLength={254} value={email} onChange={event=>setEmail(event.target.value)} className="field mt-2" placeholder="seuemail@exemplo.com"/></label></>}{(!sent||confirm)&&<button disabled={busy||(confirm&&!loginToken)} className="mt-6 w-full rounded-lg bg-[#FFC107] px-4 py-3 font-bold text-black disabled:opacity-60">{busy?'Aguarde…':confirm?'Confirmar acesso':'Enviar link de acesso'}</button>}{message&&<p role="alert" className="mt-4 text-sm text-amber-200">{message}</p>}{confirm&&<a href="/login" className="mt-5 block text-center text-sm text-zinc-400">Solicitar um novo link</a>}</form></main>;
}
