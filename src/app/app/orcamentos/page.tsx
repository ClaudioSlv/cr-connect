import { AppShell } from "@/components/app-shell";
import { BudgetsManager } from "@/components/budgets-manager";
import { LaborPricingManager } from "@/components/labor-pricing-manager";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function BudgetsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data } = await supabase
    .from("workshop_users")
    .select("workshop_id,workshops(name)")
    .eq("user_id", user!.id)
    .limit(1)
    .maybeSingle();
  if (!data) redirect("/app");
  const workshop = data.workshops as unknown as { name: string };

  return <AppShell workshop={workshop.name}>
    <p className="text-xs font-bold tracking-[.2em] text-[#FFC107]">COMERCIAL</p>
    <h1 className="mt-2 text-3xl font-bold">Orçamentos</h1>
    <p className="mt-2 text-zinc-400">Registre condições, validade e aprovação de cada proposta.</p>
    <div className="mt-7"><BudgetsManager workshopId={data.workshop_id} /></div>
    <LaborPricingManager workshopId={data.workshop_id} />
  </AppShell>;
}
