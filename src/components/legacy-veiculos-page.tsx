import { AppShell } from "@/components/app-shell";
import { VehiclesManager } from "@/components/vehicles-manager";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function VehiclesPage() {
  const supabase = await createClient(); const { data: { user } } = await supabase.auth.getUser();
  const { data } = await supabase.from("workshop_users").select("workshop_id, workshops(name)").eq("user_id", user!.id).limit(1).maybeSingle();
  if (!data) redirect("/app"); const workshop = data.workshops as unknown as { name: string };
  return <AppShell workshop={workshop.name}><p className="text-xs font-bold tracking-[.2em] text-[#FFC107]">CADASTROS</p><h1 className="mt-2 text-3xl font-bold">Veículos</h1><p className="mt-2 text-zinc-400">Vincule cada veículo ao seu proprietário para preservar o histórico.</p><div className="mt-7"><VehiclesManager workshopId={data.workshop_id} /></div></AppShell>;
}
