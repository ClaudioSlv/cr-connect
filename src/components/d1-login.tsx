'use client';
import Image from 'next/image';
import { useEffect, useState } from 'react';
import { crRequest } from '@/lib/d1/browser';

type Mode='login'|'register'|'reset';
export function D1Login({confirm=false}:{confirm?:boolean}){
  const [mode,setMode]=useState<Mode>('login');
  const [email,setEmail]=useState('');const [password,setPassword]=useState('');
  const [repeat,setRepeat]=useState('');const [recovery,setRecovery]=useState('');
  const [notice,setNotice]=useState('');const [busy,setBusy]=useState(false);
  const [newCode,setNewCode]=useState('');const [saved,setSaved]=useState(false);
  useEffect(()=>{
    const initial=new URLSearchParams(location.search).get('novo')==='1'?'register':'login';
    // Reflect the requested registration URL after client hydration.
    queueMicrotask(()=>setMode(initial));
    void crRequest<{user:{id:string}}>('me').then(result=>{if(result.data?.user)location.replace('/app');});
  },[]);
  function changeMode(next:Mode){setMode(next);setPassword('');setRepeat('');setRecovery('');setNotice('');}
  async function submit(event:React.FormEvent){
    event.preventDefault();if(busy)return;
    if(mode!=='login'&&password!==repeat){setNotice('As senhas precisam ser iguais.');return;}
    setBusy(true);setNotice('');
    const result=await crRequest<{recoveryCode?:string}>(`auth/password/${mode}`,'POST',{email,password,...(mode==='reset'?{recoveryCode:recovery}:{})});
    setPassword('');setRepeat('');setRecovery('');setBusy(false);
    if(result.error){setNotice(result.error.message);return;}
    if(result.data?.recoveryCode){setNewCode(result.data.recoveryCode);return;}
    location.replace('/app');
  }
  if(newCode)return <main className="grid min-h-screen place-items-center p-6"><section className="w-full max-w-md rounded-2xl border border-[#5a461c] bg-[#121212] p-7"><p className="text-sm font-bold text-[#FFC107]">CR CONNECT</p><h1 className="mt-4 text-2xl font-bold">Guarde seu código de recuperação</h1><p className="mt-4 text-sm leading-6 text-zinc-300">Ele permite criar uma nova senha se você esquecer a atual. Salve este código em um lugar seguro. Ele aparece somente agora.</p><textarea aria-label="Código de recuperação" readOnly value={newCode} className="field mt-5 min-h-28 break-all font-mono text-sm"/><button type="button" onClick={async()=>{try{await navigator.clipboard.writeText(newCode);setNotice('Código copiado.');}catch{setNotice('Selecione o código acima para copiar.');}}} className="mt-3 rounded-lg border border-[#FFC107] px-4 py-2 text-sm text-[#FFC107]">Copiar código</button>{notice&&<p role="status" className="mt-3 text-sm">{notice}</p>}<label className="mt-6 flex gap-3 text-sm"><input type="checkbox" checked={saved} onChange={e=>setSaved(e.target.checked)}/>Guardei meu código de recuperação.</label><button disabled={!saved} onClick={()=>location.replace('/app')} className="mt-5 w-full rounded-lg bg-[#FFC107] px-4 py-3 font-bold text-black disabled:opacity-50">Continuar</button></section></main>;
  return <main className="grid min-h-screen place-items-center bg-[#0E0E0E] p-6"><form onSubmit={submit} className="w-full max-w-md rounded-2xl border border-[#5a461c] bg-[#121212] p-8 shadow-2xl"><Image src="/brand/cr-reparador.jpg" width={132} height={132} alt="CR Reparador Automotivo" className="mx-auto rounded-2xl"/><p className="mt-5 text-center text-sm font-bold tracking-[.18em] text-[#FFC107]">CR CONNECT</p><h1 className="mt-4 text-center text-3xl font-bold">{mode==='register'?'Crie sua conta':mode==='reset'?'Recuperar acesso':'Bem-vindo de volta'}</h1><p className="mt-3 text-sm text-zinc-400">{mode==='register'?'Use seu e-mail e crie uma senha exclusiva para o CR CONNECT.':mode==='reset'?'Use o código que você guardou ao criar a conta.':'Entre com seu e-mail e sua senha.'}</p>{confirm&&<p className="mt-3 text-sm text-amber-200">O acesso agora é feito por e-mail e senha.</p>}<label className="mt-6 block text-sm">E-mail<input autoComplete="username" required type="email" maxLength={254} value={email} onChange={e=>setEmail(e.target.value)} className="field mt-2" placeholder="seuemail@exemplo.com"/></label>{mode==='reset'&&<label className="mt-4 block text-sm">Código de recuperação<input required autoComplete="off" value={recovery} onChange={e=>setRecovery(e.target.value)} className="field mt-2"/></label>}<label className="mt-4 block text-sm">{mode==='reset'?'Nova senha':'Senha'}<input required type="password" autoComplete={mode==='login'?'current-password':'new-password'} minLength={12} maxLength={128} value={password} onChange={e=>setPassword(e.target.value)} className="field mt-2"/></label>{mode!=='login'&&<><p className="mt-2 text-xs text-zinc-400">Use pelo menos 12 caracteres. Você pode salvar a senha no celular.</p><label className="mt-4 block text-sm">Confirme a senha<input required type="password" autoComplete="new-password" minLength={12} maxLength={128} value={repeat} onChange={e=>setRepeat(e.target.value)} className="field mt-2"/></label></>}<button disabled={busy} className="mt-6 w-full rounded-lg bg-[#FFC107] px-4 py-3 font-bold text-black disabled:opacity-60">{busy?'Aguarde…':mode==='register'?'Criar conta':mode==='reset'?'Criar nova senha':'Entrar'}</button>{notice&&<p role="alert" className="mt-4 text-sm text-amber-200">{notice}</p>}<div className="mt-5 flex flex-wrap justify-center gap-5 text-sm text-[#FFC107]">{mode!=='register'&&<button type="button" onClick={()=>changeMode('register')}>Criar conta</button>}{mode!=='login'&&<button type="button" onClick={()=>changeMode('login')}>Já tenho conta</button>}{mode==='login'&&<button type="button" onClick={()=>changeMode('reset')}>Esqueci minha senha</button>}</div></form></main>;
}
