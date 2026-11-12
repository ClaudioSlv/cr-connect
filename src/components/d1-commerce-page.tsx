import {redirect} from 'next/navigation';
import {currentUser,platform} from '@/lib/d1/platform';
import {membership} from '@/lib/d1/service';
import {D1Shell} from './d1-shell';
import {BudgetsManager} from './d1-budgets-manager';
import {LaborPricingManager} from './d1-labor-pricing-manager';
import {D1OrdersManager} from './d1-orders-manager';
export async function D1CommercePage({kind}:{kind:'budgets'|'orders'|'pricing'}){
 const user=await currentUser();if(!user)redirect('/login');const env=await platform();const member=await membership(env.DB,user.id);if(!member)redirect('/app');
 const title={budgets:'Orçamentos',orders:'Ordens de serviço',pricing:'Precificação de mão de obra'}[kind];
 return <D1Shell workshop={member.name}><p className="text-xs font-bold tracking-[.2em] text-[#FFC107]">GESTÃO DA OFICINA</p><h1 className="mt-3 text-3xl font-bold">{title}</h1><p className="mt-2 text-zinc-400">{kind==='pricing'?'Cadastre serviços, faixas de preço e valores por tempo.':'Registre os serviços e compartilhe o PDF com a logo da oficina.'}</p><div className="mt-7">{kind==='budgets'?<BudgetsManager workshopId={member.workshop_id}/>:kind==='orders'?<D1OrdersManager workshopId={member.workshop_id}/>:<LaborPricingManager workshopId={member.workshop_id}/>}</div></D1Shell>;
}
