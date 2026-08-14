import Image from "next/image";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { OnboardingForm } from "@/components/onboarding-form";
import { OwnerDashboard } from "@/components/owner-dashboard";
import { OwnerSosNotificationListener } from "@/components/owner-sos-notification-listener";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

const shortcuts = [
  { title: "Clientes", description: "Ver e cadastrar clientes", href: "/app/clientes", icon: "CL" },
  { title: "Veículos", description: "Ver e cadastrar veículos", href: "/app/veiculos", icon: "VE" },
  { title: "Ordens de serviço", description: "Criar e acompanhar O.S.", href: "/app/ordens", icon: "OS" },
  { title: "Estoque", description: "Gerenciar peças e produtos", href: "/app/estoque", icon: "ES" },
  { title: "Orçamentos", description: "Criar e enviar propostas", href: "/app/orcamentos", icon: "OR" },
  { title: "Mensagens", description: "Converse com seus clientes", href: "/app/chat", icon: "CH" },
  { title: "Relatórios", description: "Visualize indicadores", href: "/app/relatorios", icon: "RE" },
  { title: "Configurações", description: "Ajustes da oficina", href: "/app/configuracoes", icon: "⚙" },
];

export default async function AppHome() {
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) redirect("/login");
  await db.rpc("claim_team_invites");
  const [{ data: membership }, { data: owner }, { data: profile }] = await Promise.all([
    db.from("workshop_users").select("workshop_id,workshops(name)").eq("user_id", user.id).limit(1).maybeSingle(),
    db.from("vehicle_owners").select("user_id").eq("user_id", user.id).maybeSingle(),
    db.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
  ]);
  const workshop = membership?.workshops as unknown as { name: string } | null;
  if (!workshop && owner) return <><OwnerSosNotificationListener /><OwnerDashboard name={profile?.full_name || ""} /></>;
  if (!workshop || !membership) return <main className="grid min-h-screen place-items-center p-6"><OnboardingForm /></main>;

  const [{ count: clientsCount }, { count: vehiclesCount }, { count: ordersCount }, { count: productsCount }] = await Promise.all([
    db.from("clients").select("id", { count: "exact", head: true }).eq("workshop_id", membership.workshop_id),
    db.from("vehicles").select("id", { count: "exact", head: true }).eq("workshop_id", membership.workshop_id),
    db.from("service_orders").select("id", { count: "exact", head: true }).eq("workshop_id", membership.workshop_id).in("status", ["open", "diagnosing", "awaiting_approval", "awaiting_part", "repairing"]),
    db.from("products").select("id", { count: "exact", head: true }).eq("workshop_id", membership.workshop_id),
  ]);
  const stats = [["Clientes", clientsCount || 0, "CL"], ["Veículos", vehiclesCount || 0, "VE"], ["O.S. abertas", ordersCount || 0, "OS"], ["Itens em estoque", productsCount || 0, "ES"]];

  return <AppShell workshop={workshop.name}>
    <section className="relative overflow-hidden rounded-3xl border border-zinc-800 bg-black p-6 shadow-2xl sm:p-8">
      <Image src="/brand/cr-connect-hero.png" fill sizes="(max-width: 768px) 100vw, 900px" alt="Carro em destaque" className="object-cover object-[72%_center] opacity-75" />
      <div className="absolute inset-0 bg-gradient-to-r from-black via-black/90 to-black/15" />
      <div className="relative z-10 max-w-xl">
        <p className="text-sm font-bold tracking-[.2em] text-[#FFC107]">VISÃO GERAL</p>
        <h1 className="mt-4 text-4xl font-black leading-tight text-white sm:text-5xl">Olá, {workshop.name}!</h1>
        <p className="mt-4 text-lg text-zinc-300">Escolha um módulo para começar.</p>
        <Link href="/app/relatorios" className="mt-7 inline-flex items-center gap-3 rounded-xl bg-[#FFC107] px-5 py-3 font-black text-black">▥ Ver resumo <span className="text-xl">›</span></Link>
      </div>
    </section>

    <section className="mt-6 grid gap-4 sm:grid-cols-2">
      {shortcuts.map((item) => <Link href={item.href} key={item.href} className="group flex min-h-36 items-center gap-4 rounded-2xl border border-zinc-800 bg-[#181818] p-5 transition hover:-translate-y-0.5 hover:border-[#FFC107] hover:bg-[#201b10]">
        <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-zinc-800 text-sm font-black text-[#FFC107]">{item.icon}</span>
        <span className="min-w-0 flex-1"><b className="block text-xl text-white">{item.title}</b><span className="mt-1 block text-sm text-zinc-400">{item.description}</span><span className="mt-3 block text-sm font-bold text-[#FFC107]">Abrir <span className="ml-1">→</span></span></span>
        <span className="grid h-9 w-9 place-items-center rounded-full border border-zinc-600 text-xl text-zinc-200 transition group-hover:border-[#FFC107] group-hover:text-[#FFC107]">›</span>
      </Link>)}
    </section>

    <section className="mt-6 grid grid-cols-2 gap-3 rounded-2xl border border-zinc-800 bg-[#151515] p-3 sm:grid-cols-4">
      {stats.map(([label, value, icon]) => <div key={label as string} className="flex items-center gap-3 rounded-xl px-3 py-3"><span className="text-xs font-black text-[#FFC107]">{icon}</span><span><b className="block text-xl leading-none">{value}</b><span className="mt-1 block text-xs text-zinc-400">{label}</span></span></div>)}
    </section>
  </AppShell>;
}
