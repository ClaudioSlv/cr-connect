'use client';
import {useEffect,useRef,useState} from 'react';
import type {PaymentData} from '@/lib/payment-terms';
type Props={type:'Orçamento'|'Ordem de Serviço';number:string;client:string;vehicle:string;status:string;items:{description:string;quantity:number;unit_price:number;discount?:number}[];note?:string|null;payment?:PaymentData|null;disabled?:boolean;orderId?:string;phone?:string};
export function PrintDocument(props:Props){
 const [busy,setBusy]=useState(false),[generated,setGenerated]=useState({key:'',url:''}),[message,setMessage]=useState('');const file=useRef<File|null>(null);
 const filename=`${props.type==='Orçamento'?'Orcamento':'OS'}-${props.number.replace(/[^a-zA-Z0-9-]/g,'')}.pdf`;
 const documentKey=JSON.stringify([props.type,props.number,props.client,props.vehicle,props.status,props.note,props.items,props.payment]);
 const url=generated.key===documentKey?generated.url:'';
 useEffect(()=>()=>{if(generated.url)URL.revokeObjectURL(generated.url);},[generated.url]);
 async function generate(){if(busy||props.disabled)return;setBusy(true);setMessage('');try{
  const {createOrderPdf,finishOrderPdf,loadPdfImage}=await import('@/lib/order-pdf');
  const logo=await loadPdfImage(`${window.location.origin}/brand/cr-reparador.jpg`);
  const pdf=createOrderPdf({...props,documentType:props.type},{logo:logo.data,simple:true});finishOrderPdf(pdf);
  const blob=pdf.output('blob');file.current=new File([blob],filename,{type:'application/pdf'});const next=URL.createObjectURL(blob);setGenerated({key:documentKey,url:next});
  const a=document.createElement('a');a.href=next;a.download=filename;document.body.appendChild(a);a.click();a.remove();setMessage('PDF com a logo pronto. Baixe ou compartilhe com o cliente.');
 }catch{setMessage('Não foi possível gerar o PDF com a logo. Tente novamente.');}finally{setBusy(false);}}
 async function share(){if(!url||!file.current)return;try{if(navigator.canShare?.({files:[file.current]})){await navigator.share({files:[file.current],title:`${props.type} ${props.number}`});return;}
  const phone=(props.phone||'').replace(/\D/g,'');const international=phone&&phone.length<=11?'55'+phone:phone;
  const message=`Olá, ${props.client}! Segue ${props.type.toLowerCase()} ${props.number} da CR Reparador Automotivo. Confira os serviços, valores e condições no PDF.`;
  window.open(`https://wa.me/${international}?text=${encodeURIComponent(message)}`,'_blank','noopener,noreferrer');setMessage('Anexe o PDF baixado à conversa do WhatsApp.');
 }catch(error){if(!(error instanceof Error&&error.name==='AbortError'))setMessage('Baixe o PDF e anexe na conversa com o cliente.');}}
 return <div className="space-y-2"><button type="button" disabled={busy||props.disabled} onClick={()=>void generate()} className="rounded-lg border border-[#FFC107] px-4 py-2 font-bold text-[#FFC107] disabled:opacity-50">{busy?'Gerando PDF…':'Gerar PDF com logo'}</button>{url&&<div className="flex flex-wrap gap-3"><a href={url} download={filename} className="text-[#FFC107] underline">Baixar PDF</a><button type="button" onClick={()=>void share()} className="rounded-lg border border-emerald-600 p-2 text-emerald-300">Compartilhar com o cliente</button></div>}{props.disabled&&<p className="text-sm text-amber-300">Salve as condições de pagamento para gerar o PDF.</p>}{message&&<p className="text-sm text-zinc-300" role="status">{message}</p>}</div>;
}
