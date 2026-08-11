import Link from "next/link";

export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center bg-[#0E0E0E] p-6 text-zinc-100">
      <section className="w-full max-w-md rounded-2xl border border-zinc-800 bg-[#171717] p-7 text-center shadow-2xl">
        <p className="text-xs font-bold tracking-[.2em] text-[#FFC107]">CR CONNECT</p>
        <h1 className="mt-4 text-2xl font-bold">Página não encontrada</h1>
        <p className="mt-3 text-sm text-zinc-400">O link pode estar incorreto ou esta página não está mais disponível.</p>
        <Link href="/" className="mt-6 inline-block rounded-lg bg-[#FFC107] px-4 py-2 font-bold text-black">Voltar ao início</Link>
      </section>
    </main>
  );
}
