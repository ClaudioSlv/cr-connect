import { ReturnAfterSave } from "@/components/return-after-save";
import { WorkshopNotificationListener } from "@/components/workshop-notification-listener";
import { WorkshopTopbar } from "@/components/workshop-topbar";
import { AppNavigation } from "@/components/app-navigation";

export function AppShell({ workshop, heading, children }: { workshop: string; heading?: string; children: React.ReactNode }) {
  return <div className="app-workspace min-h-screen bg-[#0e0e0e] text-zinc-100 md:pl-64">
    <a href="#workspace-content" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-[#FFC107] focus:px-4 focus:py-3 focus:text-black">Pular para o conteúdo</a>
    <ReturnAfterSave />
    <WorkshopNotificationListener />
    <AppNavigation workshop={workshop} />
    <div className="border-b border-white/[.06] bg-[#101010] px-4 sm:px-6 md:px-9">
      <div className="mx-auto flex min-h-[68px] max-w-6xl items-center justify-between gap-4">
        <p className="min-w-0 truncate text-xs text-zinc-500"><span className="hidden sm:inline">Minha oficina <span className="mx-3 text-zinc-700">/</span></span><span className="font-medium text-zinc-300">{heading || workshop}</span></p>
        <WorkshopTopbar />
      </div>
    </div>
    <main id="workspace-content" tabIndex={-1} className="mx-auto min-w-0 max-w-[1248px] px-4 pt-6 pb-[calc(6rem+env(safe-area-inset-bottom))] sm:px-6 md:px-9 md:py-8">{children}</main>
  </div>;
}
