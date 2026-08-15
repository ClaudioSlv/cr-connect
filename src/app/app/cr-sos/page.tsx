import { AppShell } from "@/components/app-shell";
import { SosSettings } from "@/components/sos-settings";
import { SosRequests } from "@/components/sos-requests";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function SosPage() {
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) redirect("/login");
  const { data } = await db.from("workshop_users").select("workshop_id,role,workshops(name,emergency_enabled,emergency_services,latitude,longitude,emergency_radius_km,cr_sos_granted)").eq("user_id", user.id).limit(1).maybeSingle();
  if (!data) redirect("/app");
  const workshop = data.workshops as unknown as { name: string; emergency_enabled: boolean; emergency_services: string[]; latitude: number | null; longitude: number | null; emergency_radius_km: number; cr_sos_granted: boolean };
  const [{ data: subscription }, { data: requests }] = await Promise.all([
    db.from("subscriptions").select("plan_code,status").eq("workshop_id", data.workshop_id).maybeSingle(),
    db.from("sos_requests").select("id,requester_name,requester_phone,service_type,description,location_reference,status,created_at,viewed_at,feedback_rating,feedback_text,feedback_at").eq("workshop_id", data.workshop_id).order("created_at", { ascending: false }),
  ]);
  const isPremium = workshop.cr_sos_granted || (subscription?.plan_code === "premium" && subscription.status === "active");

  return <AppShell workshop={workshop.name}>
    <p className="text-xs font-bold tracking-[.2em] text-[#FFC107]">CR SOS</p>
    <h1 className="mt-2 text-3xl font-bold">Chamados próximos</h1>
    <p className="mt-2 text-zinc-400">Configure quando sua oficina poderá receber pedidos de ajuda.</p>
    <div className="mt-7">{data.role === "admin" ? <SosSettings workshopId={data.workshop_id} isPremium={isPremium} initial={{ enabled: workshop.emergency_enabled, services: workshop.emergency_services || [], latitude: String(workshop.latitude || ""), longitude: String(workshop.longitude || ""), radius: workshop.emergency_radius_km || 10 }} /> : <p className="text-zinc-400">Somente administradores podem configurar o CR SOS.</p>}</div>
    <SosRequests initial={requests || []} />
  </AppShell>;
}
