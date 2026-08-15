import { OwnerChatManager } from "@/components/owner-chat-manager";
import { OwnerTopbar } from "@/components/owner-topbar";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function OwnerMessagesPage() {
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await db.from("profiles").select("full_name").eq("id", user.id).maybeSingle();
  return <main className="min-h-screen bg-[#0c0c0d]"><div className="mx-auto max-w-4xl px-5 pt-5 md:px-10"><OwnerTopbar name={profile?.full_name || "Cliente"} /></div><OwnerChatManager userId={user.id} /></main>;
}
