import { AppShell } from "@/components/app-shell";
import { DtcLookup } from "@/components/dtc-lookup";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function DiagnosticPage() {
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) redirect("/login");
  const { data } = await db.from("workshop_users").select("workshops(name)").eq("user_id", user.id).limit(1).maybeSingle();
  if (!data) redirect("/app");
  const workshop = data.workshops as unknown as { name: string };

  return <AppShell workshop={workshop.name}>
    <p className="text-xs font-bold tracking-[.2em] text-[#FFC107]">DIAGNÓSTICO AUTOMOTIVO</p>
    <h1 className="mt-2 text-3xl font-bold">Consultar código DTC</h1>
    <p className="mt-2 max-w-2xl text-zinc-400">Digite o veículo e o código de falha para receber o significado, causas prováveis e testes recomendados.</p>
    <div className="mt-7"><DtcLookup /></div>
  </AppShell>;
}
