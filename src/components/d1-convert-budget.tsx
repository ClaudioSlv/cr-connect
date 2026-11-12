'use client';
import Link from 'next/link';
import {useState} from 'react';
import {createClient} from '@/lib/d1/compat-client';
export function D1ConvertBudget({id,status,orderId}:{id:string;status:string;orderId:string|null}){
 const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),[created,setCreated]=useState(orderId);
 async function convert(){setBusy(true);const {data,error}=await createClient().rpc('convert_budget',{p_id:id});setBusy(false);if(error)setMessage(error.message);else{setCreated(data.id);setMessage('O.S. criada com os itens e as condições deste orçamento.');}}
 return <div className="mt-4">{created?<Link className="text-[#FFC107] underline" href={`/app/ordens?order=${encodeURIComponent(created)}`}>Abrir ordem de serviço</Link>:status==='approved'?<button type="button" disabled={busy} onClick={()=>void convert()} className="rounded-lg bg-[#FFC107] p-3 font-bold text-black">{busy?'Criando…':'Criar O.S. deste orçamento'}</button>:<p className="text-sm text-zinc-400">Após a aprovação, você pode transformar este orçamento em O.S.</p>}{message&&<p role="status" className="mt-2 text-sm">{message}</p>}</div>;
}
