import LegacyPage from '@/components/legacy-veiculos-page';
import { VehiclesManager } from '@/components/vehicles-manager';
import { currentMembership } from '@/lib/d1/platform';
import { D1Shell } from '@/components/d1-shell';
import { redirect } from 'next/navigation';
export default async function Page(){
  if(process.env.CR_BACKEND!=='d1')return <LegacyPage/>;
  const member=await currentMembership();if(!member)redirect('/app');
  return <D1Shell workshop={member.name}><h1 className="mb-7 text-3xl font-bold">Veículos</h1><VehiclesManager workshopId={member.workshop_id} backend="d1"/></D1Shell>;
}
