import { AppShell } from "@/components/app-shell";
import { ClientsManager } from "@/components/clients-manager";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function ClientsPage() { const supabase = await createClient(); const { data: { user } } = await supabase.auth.getUser(); const { data } = await supabase.from("workshop_users").select("workshop_id, workshops(name)").eq("user_id", user!.id).limit(1).maybeSingle(); if (!data) redirect("/app"); const workshop = data.workshops as unknown as { name: string }; return <AppShell workshop={workshop.name}><p className="text-xs font-bold tracking-[.2em] text-[#FFC107]">CADASTROS</p><h1 className="mt-2 text-3xl font-bold">Clientes</h1><p className="mt-2 text-zinc-400">Dados pessoais são acessíveis somente à sua oficina.</p><div className="mt-7"><ClientsManager workshopId={data.workshop_id}/></div></AppShell>; }
