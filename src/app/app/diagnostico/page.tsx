import { AppShell } from "@/components/app-shell";
import { DiagnosticAssistant } from "@/components/diagnostic-assistant";
import { DiagnosticLibrary } from "@/components/diagnostic-library";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function DiagnosticPage() {
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) redirect("/login");
  const { data } = await db.from("workshop_users").select("workshop_id,workshops(name)").eq("user_id", user.id).limit(1).maybeSingle();
  if (!data) redirect("/app");
  const workshop = data.workshops as unknown as { name: string };

  return <AppShell workshop={workshop.name}>
    <p className="text-xs font-bold tracking-[.2em] text-[#FFC107]">DIAGNÓSTICO ASSISTIDO</p>
    <h1 className="mt-2 text-3xl font-bold">Códigos DTC</h1>
    <p className="mt-2 text-zinc-400">Consulte códigos, causas possíveis e testes recomendados. As informações orientam o diagnóstico, mas não substituem os testes.</p>
    <div className="mt-7"><DiagnosticLibrary workshopId={data.workshop_id} mode="dtc" /></div>
    <section className="mt-10 border-t border-zinc-800 pt-8">
      <p className="text-xs font-bold tracking-[.18em] text-[#FFC107]">TRIAGEM COM IA</p>
      <h2 className="mt-2 text-2xl font-bold">Analisar sintomas</h2>
      <div className="mt-6"><DiagnosticAssistant /></div>
    </section>
  </AppShell>;
}
