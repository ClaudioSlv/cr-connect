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


  // Include every ongoing status without referencing enum values absent in older databases.
  const closedStatuses = "(finished,delivered,cancelled)";
  const [clients, vehicles, orders, products, approvals, ready, recent] = await Promise.all([
    db.from("clients").select("id", { count: "exact", head: true }).eq("workshop_id", membership.workshop_id),
    db.from("vehicles").select("id", { count: "exact", head: true }).eq("workshop_id", membership.workshop_id),
    db.from("service_orders").select("id", { count: "exact", head: true }).eq("workshop_id", membership.workshop_id).not("status", "in", closedStatuses),
    db.from("products").select("id", { count: "exact", head: true }).eq("workshop_id", membership.workshop_id),
    db.from("budgets").select("id", { count: "exact", head: true }).eq("workshop_id", membership.workshop_id).eq("status", "sent"),
    db.from("service_orders").select("id", { count: "exact", head: true }).eq("workshop_id", membership.workshop_id).eq("status", "finished"),
    db.from("service_orders").select("id,number,status,vehicles(brand,model,plate)")
      .eq("workshop_id", membership.workshop_id).not("status", "in", closedStatuses)
      .order("updated_at", { ascending: false }).limit(5),
  ]);
  const metrics = [
    {label:"Em atendimento", result:orders, href:"/app/ordens", detail:"Ordens de serviço em aberto", icon:"order"},
    {label:"Aguardando resposta", result:approvals, href:"/app/orcamentos", detail:"Orçamentos enviados ao cliente", icon:"budget"},
    {label:"Prontos para entrega", result:ready, href:"/app/ordens", detail:"Serviços finalizados", icon:"vehicle"},
  ] satisfies {label:string; result:typeof orders; href:string; detail:string; icon:DashboardIconName}[];
  const resources = [
    {label:"Clientes cadastrados",result:clients,href:"/app/clientes"},
    {label:"Veículos cadastrados",result:vehicles,href:"/app/veiculos"},
    {label:"Itens em estoque",result:products,href:"/app/estoque"},
  ];
  const statusLabels:Record<string,string> = {open:"Aberta",diagnosing:"Em diagnóstico",awaiting_approval:"Aguardando aprovação",awaiting_part:"Aguardando peça",repairing:"Em reparo",awaiting_appointment:"Aguardando agendamento",appointment_confirmed:"Agendamento confirmado"};
  const date = new Intl.DateTimeFormat("pt-BR",{timeZone:"America/Sao_Paulo",day:"numeric",month:"long",weekday:"long"}).format(new Date());
  const hasError = [clients,vehicles,orders,products,approvals,ready,recent].some(result=>result.error);

  return <AppShell workshop={workshop.name} heading="Painel da oficina">
    <div className="mx-auto max-w-6xl pb-24 md:pb-4">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div><p className="text-xs font-semibold uppercase tracking-[.14em] text-zinc-500">Sua operação, em um só lugar</p><h2 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Visão geral</h2></div>
        <p className="text-xs capitalize text-zinc-400">{date}</p>
      </header>

      <section aria-label="Resumo da oficina" className="grid grid-cols-1 gap-3 min-[380px]:grid-cols-3">
        {metrics.map(item=><Link key={item.label} href={item.href} className="border-l-2 border-[#FFC107] bg-[#191919] px-4 py-4 transition hover:bg-[#222] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#FFC107]">
          <div className="flex items-center justify-between gap-2"><span className="text-xs font-medium leading-5 text-zinc-300">{item.label}</span><DashboardIcon name={item.icon} className="h-4 w-4 shrink-0 text-[#FFC107]"/></div>
          <strong className="mt-2 block text-3xl font-semibold tracking-tight">{item.result.error?"—":item.result.count??0}</strong>
          <span className="mt-2 hidden text-xs leading-5 text-zinc-500 sm:block">{item.detail}</span>
        </Link>)}
      </section>
      {hasError&&<p role="status" className="mt-3 text-sm text-amber-300">Alguns dados não puderam ser carregados. Atualize a página para tentar novamente; os campos indisponíveis aparecem com um traço.</p>}

      <section className="relative mt-5 overflow-hidden rounded-xl border border-zinc-800 bg-[#171717]">
        <Image src="/brand/cr-connect-hero.png" fill sizes="(max-width: 768px) 100vw, 900px" alt="" className="object-cover object-right opacity-20"/>
        <div className="absolute inset-0 bg-gradient-to-r from-[#171717] via-[#171717]/95 to-[#171717]/40"/>
        <div className="relative flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div><p className="text-xs font-semibold uppercase tracking-[.15em] text-[#FFC107]">Novo atendimento</p><h2 className="mt-1 text-xl font-bold">Do diagnóstico à entrega.</h2><p className="mt-1 max-w-md text-sm leading-6 text-zinc-400">Organize os serviços e acompanhe cada etapa na ordem de serviço.</p></div>
          <Link href="/app/ordens" className="inline-flex min-h-12 shrink-0 items-center justify-center gap-3 self-start rounded-lg bg-[#FFC107] px-5 py-3 text-sm font-bold text-black transition hover:bg-[#ffd23b] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#FFC107]">Criar nova O.S. <span aria-hidden="true">→</span></Link>
        </div>
      </section>

      <section className="mt-7" aria-labelledby="quick-actions-title">
        <h2 id="quick-actions-title" className="text-base font-semibold">Acesso rápido</h2>
        <div className="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-4">{quickActions.map(item=><Link key={item.title} href={item.href} className="flex min-h-16 items-center gap-3 rounded-lg border border-zinc-800 bg-[#141414] p-3 transition hover:border-zinc-600 hover:bg-[#1c1c1c]"><DashboardIcon name={item.icon} className="h-5 w-5 shrink-0 text-[#FFC107]"/><span className="text-sm font-semibold">{item.title}</span><span aria-hidden="true" className="ml-auto text-zinc-500">›</span></Link>)}</div>
      </section>

      <section className="mt-7 overflow-hidden rounded-xl border border-zinc-800 bg-[#111]">
        <div className="flex items-center justify-between gap-3 border-b border-zinc-800 px-4 py-4 sm:px-5"><div><h2 className="text-base font-semibold">Atendimentos em andamento</h2><p className="mt-1 text-xs text-zinc-500">Últimas ordens atualizadas</p></div><Link href="/app/ordens" className="shrink-0 text-xs font-semibold text-[#FFC107]">Ver todas →</Link></div>
        {recent.error?<p className="p-5 text-sm text-zinc-400">Não foi possível carregar os atendimentos.</p>:!recent.data?.length?<div className="p-5"><p className="text-sm text-zinc-400">Nenhum atendimento em andamento.</p><Link href="/app/ordens" className="mt-3 inline-block text-sm font-semibold text-[#FFC107]">Abrir uma ordem de serviço →</Link></div>:<ul className="divide-y divide-zinc-800">
          {recent.data.map(order=>{
            const vehicle=(Array.isArray(order.vehicles)?order.vehicles[0]:order.vehicles) as {brand:string;model:string;plate:string|null}|null;
            return <li key={order.id}><Link href="/app/ordens" className="flex flex-wrap items-center justify-between gap-3 px-4 py-4 transition hover:bg-white/5 sm:px-5">
              <div className="min-w-0"><p className="text-sm font-semibold">O.S. #{order.number} <span className="mx-1 text-zinc-600">/</span> {vehicle?[vehicle.brand,vehicle.model].filter(Boolean).join(" "):"Veículo"}</p><p className="mt-1 text-xs uppercase tracking-wide text-zinc-500">{vehicle?.plate||"Placa não informada"}</p></div>
              <span className="rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-300">{statusLabels[order.status]||order.status}</span>
            </Link></li>;
          })}
        </ul>}
      </section>

      <section aria-label="Cadastros da oficina" className="mt-5 grid gap-2 sm:grid-cols-3">{resources.map(item=><Link key={item.label} href={item.href} className="flex items-center justify-between gap-3 border-b border-zinc-800 px-1 py-3 text-sm"><span className="text-zinc-400">{item.label}</span><strong className="font-semibold">{item.result.error?"—":item.result.count??0} <span aria-hidden="true" className="ml-2 text-zinc-600">›</span></strong></Link>)}</section>
      <Link href="/app/relatorios" className="mt-5 inline-flex py-2 text-sm font-semibold text-[#FFC107]">Abrir relatórios da oficina →</Link>
    </div>

    <nav aria-label="Navegação principal" className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-zinc-800 bg-[#111]/95 px-2 pt-2 pb-[max(.5rem,env(safe-area-inset-bottom))] backdrop-blur md:hidden">
      {([{href:"/app",label:"Início",icon:"home"},{href:"/app/ordens",label:"Ordens",icon:"order"},{href:"/app/veiculos",label:"Veículos",icon:"vehicle"},{href:"/app/clientes",label:"Clientes",icon:"client"},{href:"/app/chat",label:"Chat",icon:"chat"}] as const).map(item=><Link key={item.href} href={item.href} aria-current={item.href==="/app"?"page":undefined} className={`flex min-h-12 flex-col items-center justify-center gap-1 rounded-lg text-[11px] font-medium ${item.href==="/app"?"bg-[#FFC107]/10 text-[#FFC107]":"text-zinc-400"}`}><DashboardIcon name={item.icon} className="h-5 w-5"/>{item.label}</Link>)}
    </nav>
  </AppShell>;
}
