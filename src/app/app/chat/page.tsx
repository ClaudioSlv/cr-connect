import { AppShell } from "@/components/app-shell";
import { ChatManager } from "@/components/chat-manager";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function ChatPage() {
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) redirect("/login");
  const { data } = await db.from("workshop_users").select("workshop_id,workshops(name)").eq("user_id", user.id).limit(1).maybeSingle();
  if (!data) redirect("/app");
  const workshop = data.workshops as unknown as { name: string };
  return <AppShell workshop={workshop.name}><p className="text-xs font-bold tracking-[.2em] text-[#FFC107]">ATENDIMENTO</p><h1 className="mt-2 text-3xl font-bold">Chat e histórico</h1><p className="mt-2 text-zinc-400">Centralize as conversas e anotações de cada cliente.</p><div className="mt-7"><ChatManager workshopId={data.workshop_id} userId={user.id} /></div></AppShell>;
}
