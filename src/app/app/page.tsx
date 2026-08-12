import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { OnboardingForm } from "@/components/onboarding-form";
import { OwnerDashboard } from "@/components/owner-dashboard";
import { OwnerSosNotificationListener } from "@/components/owner-sos-notification-listener";
import { createClient } from "@/lib/supabase/server";

const shortcuts = [
  { title: "Clientes", description: "Ver e cadastrar clientes", href: "/app/clientes" },
  { title: "Veículos", description: "Ver e cadastrar veículos", href: "/app/veiculos" },
  { title: "Ordens de serviço", description: "Criar e acompanhar O.S.", href: "/app/ordens" },
  { title: "Estoque", description: "Controlar peças e produtos", href: "/app/estoque" },
];

export default async function AppHome() {
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return <main className="grid min-h-screen place-items-center p-6"><OnboardingForm /></main>;
  await db.rpc("claim_team_invites");
  const [{ data: membership }, { data: owner }, { data: profile }] = await Promise.all([
    db.from("workshop_users").select("workshops(name)").eq("user_id", user.id).limit(1).maybeSingle(),
    db.from("vehicle_owners").select("user_id").eq("user_id", user.id).maybeSingle(),
    db.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
  ]);
  const workshop = membership?.workshops as unknown as { name: string } | null;
  if (!workshop && owner) return <><OwnerSosNotificationListener /><OwnerDashboard name={profile?.full_name || ""} /></>;
  if (!workshop) return <main className="grid min-h-screen place-items-center p-6"><OnboardingForm /></main>;

  return <AppShell workshop={workshop.name}>
    <p className="text-sm font-bold tracking-[.2em] text-[#FFC107] md:text-xs">VISÃO GERAL</p>
    <h1 className="mt-3 text-4xl font-bold md:text-3xl">Olá, {workshop.name}</h1>
    <p className="mt-2 text-lg text-zinc-400 md:text-base">Selecione um módulo para começar.</p>
    <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{shortcuts.map((item) => <Link href={item.href} key={item.href} className="rounded-xl border border-zinc-800 bg-[#1A1A1A] p-5 transition hover:border-[#FFC107] hover:bg-[#211805]"><h2 className="text-xl font-semibold md:text-base">{item.title}</h2><p className="mt-2 text-base text-zinc-400 md:text-sm">{item.description}</p><span className="mt-4 block text-base font-semibold text-[#FFC107] md:text-sm">Abrir →</span></Link>)}</div>
  </AppShell>;
}
