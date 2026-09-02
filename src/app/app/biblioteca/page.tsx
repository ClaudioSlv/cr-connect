import { AppShell } from "@/components/app-shell";
import { DiagnosticAssistant } from "@/components/diagnostic-assistant";
import { DiagnosticLibrary } from "@/components/diagnostic-library";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function TechnicalLibraryPage() {
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) redirect("/login");
  const { data } = await db.from("workshop_users").select("workshop_id,workshops(name)").eq("user_id", user.id).limit(1).maybeSingle();
  if (!data) redirect("/app");
  const workshop = data.workshops as unknown as { name: string };

  return <AppShell workshop={workshop.name}>
    <p className="text-xs font-bold tracking-[.2em] text-[#FFC107]">PROCEDIMENTOS DE OFICINA</p>
    <h1 className="mt-2 text-3xl font-bold">Biblioteca Técnica</h1>
    <p className="mt-2 text-zinc-400">Consulte e registre procedimentos, ferramentas, especificações e cuidados por veículo.</p>
    <div className="mt-7"><DiagnosticLibrary workshopId={data.workshop_id} mode="tech" /></div>
    <section className="mt-10 border-t border-zinc-800 pt-8">
      <p className="text-xs font-bold tracking-[.18em] text-[#FFC107]">ASSISTENTE IA</p>
      <h2 className="mt-2 text-2xl font-bold">Consultar um procedimento</h2>
      <p className="mt-1 text-sm text-zinc-400">Quando o procedimento ainda não estiver salvo, use a IA como apoio e confirme especificações no manual do fabricante.</p>
      <div className="mt-6"><DiagnosticAssistant mode="technical" /></div>
    </section>
  </AppShell>;
}
