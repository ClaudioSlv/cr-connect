import { AppShell } from "@/components/app-shell";
import { TeamManager } from "@/components/team-manager";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
export default async function TeamPage() { const db = await createClient(); const { data: { user } } = await db.auth.getUser(); if (!user) redirect("/login"); const { data } = await db.from("workshop_users").select("workshop_id,role,workshops(name)").eq("user_id", user.id).limit(1).maybeSingle(); if (!data) redirect("/app"); const workshop = data.workshops as unknown as { name: string }; return <AppShell workshop={workshop.name}><p className="text-xs font-bold tracking-[.2em] text-[#FFC107]">ADMINISTRAÇÃO</p><h1 className="mt-2 text-3xl font-bold">Gestão de equipe</h1><p className="mt-2 text-zinc-400">Convide pessoas e defina o acesso de cada função da oficina.</p><div className="mt-7"><TeamManager workshopId={data.workshop_id} isAdmin={data.role === "admin"} /></div></AppShell>; }
