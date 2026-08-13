import { AppShell } from "@/components/app-shell";
import { InventoryManager } from "@/components/inventory-manager";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function StockPage() {
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) redirect("/login");
  const { data } = await db.from("workshop_users").select("workshop_id,role,workshops(name)").eq("user_id", user.id).limit(1).maybeSingle();
  if (!data || !["admin", "inventory"].includes(data.role)) redirect("/app");
  const workshop = data.workshops as unknown as { name: string };
  return <AppShell workshop={workshop.name}><p className="text-xs font-bold tracking-[.2em] text-[#FFC107]">PEÇAS E PRODUTOS</p><h1 className="mt-2 text-3xl font-bold">Estoque</h1><p className="mt-2 text-zinc-400">Controle níveis, localização e preço de venda.</p><div className="mt-7"><InventoryManager workshopId={data.workshop_id} /></div></AppShell>;
}
