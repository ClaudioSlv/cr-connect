import Link from 'next/link';
import { redirect } from 'next/navigation';
import { currentUser, platform } from '@/lib/d1/platform';
import { membership } from '@/lib/d1/service';
import { D1Shell } from './d1-shell';
import { D1WorkshopForm } from './d1-workshop-form';
export async function D1Home(){
  const user=await currentUser();if(!user)redirect('/login');const env=await platform();
  const member=await membership(env.DB,user.id);if(!member)return <D1WorkshopForm/>;
  const [clients,vehicles]=await env.DB.batch<{count:number}>([
    env.DB.prepare('SELECT count(*) AS count FROM clients WHERE workshop_id=?').bind(member.workshop_id),
    env.DB.prepare('SELECT count(*) AS count FROM vehicles WHERE workshop_id=?').bind(member.workshop_id),
  ]);
  return <D1Shell workshop={member.name}><p className="text-xs font-bold tracking-[.2em] text-[#FFC107]">PAINEL DA OFICINA</p><h1 className="mt-3 text-3xl font-bold">Visão geral</h1><div className="mt-7 grid gap-4 sm:grid-cols-2">{[{label:'Clientes cadastrados',count:clients.results[0]?.count,href:'/app/clientes'},{label:'Veículos cadastrados',count:vehicles.results[0]?.count,href:'/app/veiculos'}].map(item=><Link href={item.href} key={item.href} className="rounded-xl border border-zinc-800 bg-[#191919] p-6"><span className="text-sm text-zinc-400">{item.label}</span><strong className="mt-2 block text-4xl">{String(item.count??0)}</strong><span className="mt-4 block text-sm font-bold text-[#FFC107]">Abrir cadastro →</span></Link>)}</div><section className="mt-8 rounded-xl border border-[#5a461c] bg-[#17130b] p-5"><h2 className="font-bold text-[#FFC107]">Atualização do CR CONNECT</h2><p className="mt-2 text-sm leading-6 text-zinc-300">Clientes e veículos estão disponíveis nesta etapa. Ordens de serviço, orçamentos, estoque, financeiro, fotos e CR SOS ainda estão em adaptação.</p></section></D1Shell>;
}
