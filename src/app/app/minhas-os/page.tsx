import { ClientServiceOrders } from "@/components/client-service-orders";
import { ClientBudgets } from "@/components/client-budgets";
export default function MyOrdersPage() { return <main className="min-h-screen bg-[#0E0E0E] p-6 text-zinc-100 md:p-12"><div className="mx-auto max-w-3xl"><a href="/app" className="text-sm font-semibold text-[#FFC107]">Voltar</a><ClientBudgets /><ClientServiceOrders /></div></main>; }
