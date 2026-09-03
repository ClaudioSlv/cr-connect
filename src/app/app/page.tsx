import Image from "next/image";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { OnboardingForm } from "@/components/onboarding-form";
import { OwnerDashboard } from "@/components/owner-dashboard";
import { OwnerSosNotificationListener } from "@/components/owner-sos-notification-listener";
import { OwnerPortalShortcut } from "@/components/owner-portal-shortcut";
import { DashboardIcon, type DashboardIconName } from "@/components/dashboard-icon";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

const quickActions = [
  { title: "Nova O.S.", href: "/app/ordens", icon: "order" },
  { title: "Novo cliente", href: "/app/clientes", icon: "client" },
  { title: "Orçamento", href: "/app/orcamentos", icon: "budget" },
  { title: "CR SOS", href: "/app/cr-sos", icon: "sos" },
] satisfies { title: string; href: string; icon: DashboardIconName }[];

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
  if (!workshop && owner) return <><OwnerSosNotificationListener /><OwnerDashboard name={profile?.full_name || ""} /><OwnerPortalShortcut /></>;
  if (!workshop || !membership) return <main className="grid min-h-screen place-items-center p-6"><OnboardingForm /></main>;

  const [{ count: clientsCount }, { count: vehiclesCount }, { count: ordersCount }, { count: productsCount }] = await Promise.all([
    db.from("clients").select("id", { count: "exact", head: true }).eq("workshop_id", membership.workshop_id),
    db.from("vehicles").select("id", { count: "exact", head: true }).eq("workshop_id", membership.workshop_id),
    db.from("service_orders").select("id", { count: "exact", head: true }).eq("workshop_id", membership.workshop_id).in("status", ["open", "diagnosing", "awaiting_approval", "awaiting_part", "repairing"]),
    db.from("products").select("id", { count: "exact", head: true }).eq("workshop_id", membership.workshop_id),
  ]);
  const stats: { label: string; value: number; icon: DashboardIconName; href: string }[] = [{ label: "Clientes", value: clientsCount || 0, icon: "client", href: "/app/clientes" }, { label: "Veículos", value: vehiclesCount || 0, icon: "vehicle", href: "/app/veiculos" }, { label: "O.S. abertas", value: ordersCount || 0, icon: "order", href: "/app/ordens" }, { label: "Itens em estoque", value: productsCount || 0, icon: "stock", href: "/app/estoque" }];

  return <AppShell workshop={workshop.name}>
    <div className="mx-auto max-w-6xl pb-24 md:pb-4">
      <header className="-mt-11 flex items-center gap-3 pr-14 md:mt-0 md:pr-0">
        <Image src="/brand/cr-reparador.jpg" width={44} height={44} alt="CR Reparador" className="rounded-xl border border-[#FFC107]/70 md:hidden" />
        <div className="min-w-0"><p className="text-xs font-bold tracking-[.18em] text-[#FFC107]">BEM-VINDO</p><h1 className="truncate text-xl font-black text-white sm:text-2xl">{workshop.name}</h1></div>
      </header>

      <section className="relative mt-6 overflow-hidden rounded-[1.75rem] border border-[#6b510d] bg-[#17130a] p-6 shadow-2xl sm:p-8">
        <Image src="/brand/cr-connect-hero.png" fill priority sizes="(max-width: 768px) 100vw, 900px" alt="Oficina CR Connect" className="object-cover object-[75%_center] opacity-35" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#161006] via-[#161006]/95 to-black/20" />
        <div className="relative z-10 max-w-lg"><span className="inline-flex rounded-full border border-[#FFC107]/40 bg-black/40 px-3 py-1 text-xs font-black tracking-[.16em] text-[#FFC107]">CENTRAL DA OFICINA</span><h2 className="mt-4 text-3xl font-black leading-tight text-white sm:text-4xl">O que vamos resolver hoje?</h2><p className="mt-3 max-w-sm text-sm leading-6 text-zinc-300 sm:text-base">Abra um atendimento e acompanhe o serviço do diagnóstico até a entrega.</p><Link href="/app/ordens" className="mt-6 inline-flex items-center gap-3 rounded-2xl bg-[#FFC107] px-6 py-4 font-black text-black shadow-lg shadow-black/30 transition hover:bg-[#ffd23b]">Criar nova O.S. <span className="text-xl">→</span></Link></div>
      </section>

      <section className="mt-7"><div className="flex items-end justify-between gap-3"><div><p className="text-xs font-black tracking-[.16em] text-[#FFC107]">ACESSO RÁPIDO</p><h2 className="mt-1 text-xl font-black text-white">Ações do dia</h2></div><Link href="/app/relatorios" className="text-sm font-bold text-[#FFC107]">Ver resumo →</Link></div><div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">{quickActions.map((item) => <Link href={item.href} key={item.title} className="group rounded-2xl border border-zinc-800 bg-[#181818] p-4 transition hover:-translate-y-0.5 hover:border-[#FFC107]"><span className="grid h-12 w-12 place-items-center rounded-xl bg-[#292929] text-[#FFC107] group-hover:bg-[#FFC107] group-hover:text-black"><DashboardIcon name={item.icon} className="h-6 w-6" /></span><b className="mt-4 block text-sm text-white sm:text-base">{item.title}</b><span className="mt-2 block text-xs font-bold text-[#FFC107]">Acessar →</span></Link>)}</div></section>

      <section className="mt-7 overflow-hidden rounded-3xl border border-zinc-800 bg-[#151515]"><div className="flex items-center justify-between border-b border-zinc-800 px-5 py-4"><div><p className="text-xs font-black tracking-[.16em] text-[#FFC107]">HOJE NA OFICINA</p><h2 className="mt-1 text-xl font-black">Visão geral</h2></div><Link href="/app/relatorios" aria-label="Abrir relatórios" className="grid h-10 w-10 place-items-center rounded-full border border-zinc-700 text-xl text-zinc-300">›</Link></div><div className="grid grid-cols-2 sm:grid-cols-4">{stats.map((item, index) => <Link href={item.href} key={item.label} className={`p-5 ${index % 2 === 0 ? "border-r" : ""} ${index < 2 ? "border-b sm:border-b-0" : ""} border-zinc-800 sm:border-r sm:last:border-r-0`}><DashboardIcon name={item.icon} className="h-5 w-5 text-[#FFC107]"/><b className="mt-3 block text-3xl leading-none text-white">{item.value}</b><span className="mt-2 block text-xs text-zinc-400">{item.label}</span></Link>)}</div></section>

    </div>

    <nav aria-label="Navegação principal" className="fixed inset-x-3 bottom-3 z-40 grid grid-cols-5 rounded-2xl border border-zinc-700 bg-[#111]/95 p-2 shadow-2xl backdrop-blur md:hidden"><Link href="/app" className="flex flex-col items-center gap-1 rounded-xl bg-[#29230f] py-2 text-[10px] font-bold text-[#FFC107]"><DashboardIcon name="home" className="h-5 w-5"/>Início</Link><Link href="/app/ordens" className="flex flex-col items-center gap-1 py-2 text-[10px] font-bold text-zinc-400"><DashboardIcon name="order" className="h-5 w-5"/>Ordens</Link><Link href="/app/ordens" aria-label="Criar nova ordem de serviço" className="mx-auto grid h-12 w-12 -translate-y-4 place-items-center rounded-full border-4 border-[#111] bg-[#FFC107] text-black shadow-lg"><DashboardIcon name="plus" className="h-7 w-7"/></Link><Link href="/app/clientes" className="flex flex-col items-center gap-1 py-2 text-[10px] font-bold text-zinc-400"><DashboardIcon name="client" className="h-5 w-5"/>Clientes</Link><Link href="/app/chat" className="flex flex-col items-center gap-1 py-2 text-[10px] font-bold text-zinc-400"><DashboardIcon name="chat" className="h-5 w-5"/>Chat</Link></nav>
  </AppShell>;
}
