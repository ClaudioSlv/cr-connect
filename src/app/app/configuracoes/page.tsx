import { AppShell } from "@/components/app-shell";
import { IncompleteRegistrationReset } from "@/components/incomplete-registration-reset";
import { WorkshopSettings, type WorkshopProfile } from "@/components/workshop-settings";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function SettingsPage() {
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) redirect("/login");

  const { data: membership } = await db
    .from("workshop_users")
    .select("workshop_id,role,workshops(name,legal_name,document,phone,whatsapp,email,address,city,state,postal_code,pix_discount_percentage)")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (!membership) redirect("/app");
  const workshop = membership.workshops as unknown as WorkshopProfile;

  return <AppShell workshop={workshop.name}>
    <p className="text-xs font-bold tracking-[.2em] text-[#FFC107]">ADMINISTRAÇÃO</p>
    <h1 className="mt-2 text-3xl font-bold">Configurações</h1>
    <p className="mt-2 text-zinc-400">Mantenha os dados da sua oficina atualizados para atendimentos e documentos.</p>
    <div className="mt-7">
      <WorkshopSettings workshopId={membership.workshop_id} initial={workshop} />
      {membership.role === "admin" && <IncompleteRegistrationReset />}
    </div>
  </AppShell>;
}
