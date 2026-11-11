"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef } from "react";
import { DashboardIcon, type DashboardIconName } from "@/components/dashboard-icon";
import { SignOutButton } from "@/components/sign-out-button";

type NavItem = { label: string; href: string; icon: DashboardIconName };
const groups: { label: string; items: NavItem[] }[] = [
  { label: "Oficina", items: [
    { label: "Visão geral", href: "/app", icon: "home" },
    { label: "Ordens de serviço", href: "/app/ordens", icon: "order" },
    { label: "Clientes", href: "/app/clientes", icon: "client" },
    { label: "Veículos", href: "/app/veiculos", icon: "vehicle" },
    { label: "Orçamentos", href: "/app/orcamentos", icon: "budget" },
    { label: "Termos", href: "/app/termos", icon: "document" },
  ] },
  { label: "Gestão", items: [
    { label: "Estoque", href: "/app/estoque", icon: "stock" },
    { label: "Financeiro", href: "/app/financeiro", icon: "finance" },
    { label: "Relatórios", href: "/app/relatorios", icon: "chart" },
    { label: "Equipe", href: "/app/equipe", icon: "team" },
  ] },
  { label: "Serviços e suporte", items: [
    { label: "Diagnóstico", href: "/app/diagnostico", icon: "tool" },
    { label: "Assistente IA", href: "/app/assistente", icon: "spark" },
    { label: "Biblioteca técnica", href: "/app/biblioteca", icon: "document" },
    { label: "CR SOS", href: "/app/cr-sos", icon: "sos" },
    { label: "Chat", href: "/app/chat", icon: "chat" },
    { label: "Notificações", href: "/app/notificacoes", icon: "bell" },
  ] },
  { label: "Minha conta", items: [
    { label: "Assinatura", href: "/app/assinatura", icon: "budget" },
    { label: "Configurações", href: "/app/configuracoes", icon: "settings" },
  ] },
];
const primaryItems = groups[0].items.slice(0, 4);

export function AppNavigation({ workshop }: { workshop: string }) {
  const pathname = usePathname();
  const dialog = useRef<HTMLDialogElement>(null);
  const current = groups.flatMap(group => group.items).find(item => item.href === pathname);
  const closeMenu = () => dialog.current?.close();
  const isActive = (href: string) => href === "/app" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

  function links() {
    return groups.map(group => <section key={group.label} className="mt-6 first:mt-0">
      <h2 className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[.16em] text-zinc-500">{group.label}</h2>
      <div className="space-y-1">{group.items.map(item => <Link key={item.href} href={item.href} onClick={closeMenu} aria-current={isActive(item.href) ? "page" : undefined} className={`flex min-h-11 items-center gap-3 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${isActive(item.href) ? "border-[#FFC107]/15 bg-[#FFC107]/10 text-[#FFC107]" : "border-transparent text-zinc-400 hover:bg-white/5 hover:text-zinc-100"}`}>
        <DashboardIcon name={item.icon} className="h-[18px] w-[18px] shrink-0" />
        <span>{item.label}</span>
        {isActive(item.href) && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-[#FFC107]" />}
      </Link>)}</div>
    </section>);
  }

  const brand = <Link href="/app" onClick={closeMenu} className="flex min-w-0 items-center gap-3">
    <Image src="/brand/cr-reparador.jpg" width={42} height={42} alt="" className="rounded-xl border border-[#FFC107]/25" />
    <span className="min-w-0"><span className="block text-sm font-extrabold tracking-[.12em] text-[#FFC107]">CR CONNECT</span><span className="mt-0.5 block truncate text-xs text-zinc-500" title={workshop}>{workshop}</span></span>
  </Link>;

  return <>
    <aside className="hidden border-r border-white/[.07] bg-[#0b0b0b] md:fixed md:inset-y-0 md:left-0 md:z-40 md:flex md:w-64 md:flex-col">
      <div className="border-b border-white/[.07] px-5 py-6">{brand}</div>
      <nav aria-label="Menu da oficina" className="min-h-0 flex-1 overflow-y-auto px-3 py-5">{links()}<div className="mt-6 border-t border-white/[.07] pt-2"><SignOutButton /></div></nav>
    </aside>
    <header className="flex min-h-[76px] items-center justify-between gap-4 border-b border-white/[.07] bg-[#0b0b0b] px-4 md:hidden">
      {brand}
      <button type="button" onClick={() => dialog.current?.showModal()} aria-label="Abrir menu completo" aria-haspopup="dialog" className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-zinc-800 text-zinc-300"><DashboardIcon name="menu" className="h-5 w-5" /></button>
    </header>
    <nav aria-label="Navegação principal" className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-white/10 bg-[#101010]/95 px-2 pt-2 pb-[max(.5rem,env(safe-area-inset-bottom))] backdrop-blur-xl md:hidden">
      {primaryItems.map(item => <Link key={item.href} href={item.href} aria-current={isActive(item.href) ? "page" : undefined} className={`flex min-h-12 flex-col items-center justify-center gap-1 rounded-lg text-[10px] font-semibold ${isActive(item.href) ? "bg-[#FFC107]/10 text-[#FFC107]" : "text-zinc-500"}`}><DashboardIcon name={item.icon} className="h-5 w-5" />{item.href === "/app" ? "Início" : item.href === "/app/ordens" ? "Ordens" : item.label}</Link>)}
      <button type="button" onClick={() => dialog.current?.showModal()} aria-label="Abrir todos os módulos" aria-haspopup="dialog" className={`flex min-h-12 flex-col items-center justify-center gap-1 rounded-lg text-[10px] font-semibold ${current && !primaryItems.includes(current) ? "text-[#FFC107]" : "text-zinc-500"}`}><DashboardIcon name="menu" className="h-5 w-5" />Mais</button>
    </nav>
    <dialog ref={dialog} aria-labelledby="app-menu-title" className="app-menu-dialog fixed inset-0 m-0 h-dvh max-h-none w-full max-w-none border-0 bg-[#0b0b0b] p-0 text-zinc-100 backdrop:bg-black/70">
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/10 bg-[#0b0b0b] p-4">
        <h2 id="app-menu-title" className="font-semibold">Todos os módulos</h2>
        <button type="button" onClick={closeMenu} aria-label="Fechar menu" className="grid h-11 w-11 place-items-center rounded-lg border border-zinc-800"><DashboardIcon name="close" className="h-5 w-5" /></button>
      </div>
      <nav aria-label="Todos os módulos" className="mx-auto max-w-lg px-4 pt-6 pb-[max(2rem,env(safe-area-inset-bottom))]">{links()}<SignOutButton /></nav>
    </dialog>
  </>;
}
