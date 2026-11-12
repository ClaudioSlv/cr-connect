import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  if (process.env.CR_BACKEND === "d1") {
    const path = request.nextUrl.pathname;
    if (path.startsWith("/api/") && !path.startsWith("/api/cr/")) return NextResponse.json({error:{message:"Este módulo ainda está em adaptação."}},{status:503,headers:{"Cache-Control":"no-store"}});
    if (path.startsWith("/app") && !["/app", "/app/clientes", "/app/veiculos", "/app/orcamentos", "/app/ordens", "/app/precificacao"].includes(path)) return NextResponse.redirect(new URL("/app",request.url));
    if (path.startsWith("/auth/") && path !== "/auth/d1") return NextResponse.redirect(new URL("/login",request.url));
    const response = NextResponse.next();
    response.headers.set("Cache-Control","private, no-store");
    response.headers.set("Referrer-Policy","no-referrer");
    return response;
  }
  if (!request.nextUrl.pathname.startsWith("/app")) return NextResponse.next();
  let response = NextResponse.next({ request });
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    cookies: { getAll: () => request.cookies.getAll(), setAll: (items) => { items.forEach(({ name, value }) => request.cookies.set(name, value)); response = NextResponse.next({ request }); items.forEach(({ name, value, options }) => response.cookies.set(name, value, options)); } },
  });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user && request.nextUrl.pathname.startsWith("/app")) return NextResponse.redirect(new URL("/login", request.url));
  return response;
}

export const config = { matcher: ["/app/:path*", "/api/:path*", "/auth/:path*", "/login"] };
