import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
function admin() { return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { autoRefreshToken: false, persistSession: false } }); }

export async function POST(request: Request, context: { params: Promise<{ token: string }> }) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return NextResponse.json({ error: "Serviço indisponível." }, { status: 503 });
  const { token } = await context.params;
  const { response } = await request.json() as { response?: "accepted" | "rejected" };
  if (response !== "accepted" && response !== "rejected") return NextResponse.json({ error: "Resposta inválida." }, { status: 400 });
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
  const userAgent = request.headers.get("user-agent");
  const { data, error } = await admin().rpc("record_customer_part_term_response", { p_token: token, p_response: response, p_ip: ip, p_user_agent: userAgent });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ status: data.status });
}
