import { NextRequest, NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

type Candidate = { id: string; email?: string | null };
const normalize = (value: string | null | undefined) => (value || "").trim().toLowerCase();

async function requireAdmin() {
  const session = await createClient();
  const { data: { user } } = await session.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "Faça login para continuar." }, { status: 401 }) };
  const { data: membership } = await session.from("workshop_users").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
  if (!membership) return { error: NextResponse.json({ error: "Somente o administrador pode resetar cadastros." }, { status: 403 }) };
  return { user };
}

function adminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return key ? createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, { auth: { autoRefreshToken: false, persistSession: false } }) : null;
}

async function findCandidate(email: string) {
  const admin = adminClient();
  if (!admin) return { error: "A função de reset ainda não está configurada." as const };
  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) return { error: "Não foi possível consultar os cadastros agora." as const };
  const account = (data.users as Candidate[]).find((item) => normalize(item.email) === email);
  if (!account) return { admin, account: null as Candidate | null };
  const [{ data: workshopMember }, { data: vehicleOwner }] = await Promise.all([
    admin.from("workshop_users").select("user_id").eq("user_id", account.id).maybeSingle(),
    admin.from("vehicle_owners").select("user_id").eq("user_id", account.id).maybeSingle(),
  ]);
  return { admin, account, complete: Boolean(workshopMember || vehicleOwner) };
}

export async function GET(request: NextRequest) {
  const access = await requireAdmin(); if ("error" in access) return access.error;
  const email = normalize(request.nextUrl.searchParams.get("email"));
  if (!email.includes("@")) return NextResponse.json({ error: "Informe um e-mail válido." }, { status: 400 });
  const result = await findCandidate(email);
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: 503 });
  if (!result.account) return NextResponse.json({ found: false });
  const canReset = !result.complete && result.account.id !== access.user.id;
  return NextResponse.json({ found: true, email: result.account.email, canReset, message: canReset ? "Cadastro incompleto encontrado. O reset permitirá que a pessoa crie a conta novamente." : "Este e-mail já concluiu o cadastro ou é a sua própria conta e não pode ser resetado por aqui." });
}

export async function POST(request: Request) {
  const access = await requireAdmin(); if ("error" in access) return access.error;
  const body = await request.json().catch(() => ({})) as { email?: string };
  const email = normalize(body.email || null);
  if (!email.includes("@")) return NextResponse.json({ error: "Informe um e-mail válido." }, { status: 400 });
  const result = await findCandidate(email);
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: 503 });
  if (!result.account) return NextResponse.json({ error: "Nenhum cadastro foi encontrado para este e-mail." }, { status: 404 });
  if (result.complete || result.account.id === access.user.id) return NextResponse.json({ error: "Este cadastro não pode ser resetado por aqui." }, { status: 409 });
  const { error } = await result.admin.auth.admin.deleteUser(result.account.id);
  if (error) return NextResponse.json({ error: "Não foi possível resetar este cadastro agora." }, { status: 500 });
  return NextResponse.json({ ok: true, message: "Cadastro incompleto resetado. A pessoa já pode criar a conta novamente." });
}
