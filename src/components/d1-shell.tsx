import Link from 'next/link';
import Image from 'next/image';
import { D1SignOut } from './d1-workshop-form';
const links = [['Visão geral','/app'],['Clientes','/app/clientes'],['Veículos','/app/veiculos'],['Orçamentos','/app/orcamentos'],['Ordens de serviço','/app/ordens'],['Mão de obra','/app/precificacao']];
export function D1Shell({workshop,children}:{workshop:string;children:React.ReactNode}) {
  return <div className="min-h-screen text-zinc-100 md:grid md:grid-cols-[240px_1fr]"><aside className="border-b border-[#4a3818] bg-black/90 p-5 md:min-h-screen md:border-r md:border-b-0"><div className="flex items-center gap-4 md:flex-col"><Image src="/brand/cr-reparador.jpg" alt="CR Reparador Automotivo" width={100} height={100} className="rounded-2xl border border-[#FFC107]"/><div><p className="text-sm font-bold tracking-[.16em] text-[#FFC107]">CR CONNECT</p><p className="mt-2 break-words text-sm text-zinc-400">{workshop}</p></div></div><nav aria-label="Menu da oficina" className="mt-6 flex flex-wrap gap-2 md:grid">{links.map(([label,href])=><Link key={href} href={href} className="rounded-lg px-3 py-3 text-sm text-zinc-200 hover:bg-[#261e0b] hover:text-[#FFC107]">{label}</Link>)}<D1SignOut/></nav></aside><main className="min-w-0 p-4 sm:p-6 md:p-8">{children}</main></div>;
}
