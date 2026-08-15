import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export default async function PaymentPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const db = await createClient();
  const { data } = await db.rpc("get_public_payment_link", { p_token: token }).maybeSingle();
  if (!data) notFound();

  const payment = data as { client_name: string; budget_number: string; amount: number; checkout_url: string };
  return <main className="min-h-screen bg-[#090909] px-5 py-10 text-zinc-100"><section className="mx-auto max-w-md rounded-3xl border border-[#FFC107]/60 bg-[#171717] p-7 shadow-2xl"><p className="text-xs font-bold tracking-[.25em] text-[#FFC107]">CR CONNECT · CR REPARADOR</p><h1 className="mt-5 text-3xl font-black">Pagamento do orçamento</h1><p className="mt-3 text-zinc-300">Olá, {payment.client_name}. Este é o pagamento seguro do seu orçamento.</p><div className="mt-7 rounded-2xl border border-zinc-700 bg-black/30 p-5"><p className="text-sm text-zinc-400">Orçamento</p><p className="mt-1 text-lg font-bold">#{payment.budget_number}</p><p className="mt-5 text-sm text-zinc-400">Pagamento com cartão</p><p className="mt-1 text-3xl font-black text-[#FFC107]">{money.format(Number(payment.amount))}</p><p className="mt-2 text-xs text-zinc-500">No cartão não há desconto. Para Pix, consulte o QR Code do PDF.</p></div><a href={payment.checkout_url} className="mt-7 block rounded-xl bg-[#FFC107] px-5 py-4 text-center text-lg font-black text-black">∞ Pagar com cartão pela InfinitePay</a><p className="mt-5 text-center text-xs text-zinc-500">Você será direcionado para o checkout seguro da InfinitePay.</p></section></main>;
}
