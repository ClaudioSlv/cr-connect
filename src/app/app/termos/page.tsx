import { AppShell } from "@/components/app-shell";
import { CustomerPartTermsManager } from "@/components/customer-part-terms-manager";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function TermsPage() {
  const db = await createClient(); const { data: { user } } = await db.auth.getUser();
  const { data } = await db.from("workshop_users").select("workshop_id,workshops(name)").eq("user_id", user!.id).maybeSingle();
  if (!data) redirect("/app"); const workshop = data.workshops as unknown as { name: string };
  return <AppShell workshop={workshop.name}><p className="text-xs font-bold tracking-[.2em] text-[#FFC107]">DOCUMENTOS</p><h1 className="mt-2 text-3xl font-bold">Termos de responsabilidade</h1><p className="mt-2 text-zinc-400">Envie o termo da peça fornecida pelo cliente e acompanhe o aceite.</p><div className="mt-7"><CustomerPartTermsManager workshopId={data.workshop_id}/></div></AppShell>;
}
