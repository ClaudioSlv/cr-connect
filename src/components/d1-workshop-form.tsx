'use client';
import { useState } from 'react';
import { crRequest } from '@/lib/d1/browser';
export function D1SignOut(){
  const [busy,setBusy]=useState(false); const [error,setError]=useState('');
  return <div><button disabled={busy} onClick={async()=>{setBusy(true);const result=await crRequest('auth/logout','POST');if(result.error){setError(result.error.message);setBusy(false);}else location.replace('/login');}} className="rounded-lg px-3 py-3 text-sm text-zinc-400">{busy?'Saindo…':'Sair'}</button>{error&&<p role="alert" className="text-sm text-amber-200">{error}</p>}</div>;
}
export function D1WorkshopForm(){
  const [name,setName]=useState('');const [phone,setPhone]=useState('');const [whatsapp,setWhatsapp]=useState('');
  const [error,setError]=useState('');const [busy,setBusy]=useState(false);
  async function submit(event:React.FormEvent){event.preventDefault();if(busy)return;setBusy(true);setError('');const result=await crRequest('workshops','POST',{name,phone,whatsapp});if(result.error){setError(result.error.message);setBusy(false);}else location.replace('/app');}
  return <main className="grid min-h-screen place-items-center p-6"><form onSubmit={submit} className="w-full max-w-md rounded-2xl border border-zinc-800 bg-[#1A1A1A] p-7"><p className="text-xs font-bold tracking-[.2em] text-[#FFC107]">CR CONNECT</p><h1 className="mt-3 text-3xl font-bold">Cadastre sua oficina</h1><label className="mt-6 block text-sm">Nome da oficina<input required minLength={2} maxLength={120} value={name} onChange={e=>setName(e.target.value)} className="field mt-2"/></label><label className="mt-4 block text-sm">Telefone<input required maxLength={40} type="tel" value={phone} onChange={e=>setPhone(e.target.value)} className="field mt-2"/></label><label className="mt-4 block text-sm">WhatsApp (opcional)<input maxLength={40} type="tel" value={whatsapp} onChange={e=>setWhatsapp(e.target.value)} className="field mt-2"/></label>{error&&<p role="alert" className="mt-4 text-sm text-amber-200">{error}</p>}<button disabled={busy} className="mt-6 w-full rounded-lg bg-[#FFC107] px-4 py-3 font-bold text-black disabled:opacity-60">{busy?'Salvando…':'Criar oficina'}</button><D1SignOut/></form></main>;
}
