import { notFound } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { PublicTermResponse } from "@/components/public-term-response";

function admin() { return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { autoRefreshToken: false, persistSession: false } }); }

export default async function PublicTermPage({ params }: { params: Promise<{ token: string }> }) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) notFound();
  const { token } = await params;
  const { data: term } = await admin().from("customer_part_terms").select("token,client_name,vehicle_label,service_description,part_description,status,accepted_at,rejected_at").eq("token", token).maybeSingle();
  if (!term) notFound();
  await admin().from("customer_part_terms").update({ viewed_at: new Date().toISOString() }).eq("token", token).is("viewed_at", null);
  return <PublicTermResponse term={term} />;
}
