import Image from "next/image";
import Link from "next/link";

export default function Home() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-black text-zinc-100">
      <Image src="/brand/cr-connect-hero.png" fill priority sizes="100vw" alt="Carro esportivo em oficina moderna" className="object-cover object-[68%_center]" />
      <div className="absolute inset-0 bg-gradient-to-b from-black/45 via-black/75 to-black" />
      <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/45 to-transparent" />
      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-md flex-col px-7 py-9 sm:max-w-xl">
        <header className="flex items-center gap-3">
          <Image src="/brand/cr-reparador.jpg" width={58} height={58} alt="CR Reparador Automotivo" className="rounded-xl border border-[#FFC107]" />
          <div><p className="text-xl font-black tracking-wide text-[#FFC107]">CR CONNECT</p><p className="text-sm text-zinc-300">Gestão Automotiva</p></div>
        </header>
        <section className="flex flex-1 flex-col justify-center pb-8 pt-14">
          <p className="text-sm font-bold tracking-[.22em] text-[#FFC107]">SUA OFICINA, EM UM SÓ LUGAR</p>
          <h1 className="mt-4 text-4xl font-black leading-tight text-white sm:text-5xl">Conecte sua oficina. Cuide de cada cliente.</h1>
          <p className="mt-5 max-w-md text-lg leading-8 text-zinc-200">Clientes, veículos, ordens de serviço e ajuda CR SOS com uma experiência simples e profissional.</p>
          <div className="mt-10 grid gap-4"><Link href="/login" className="rounded-2xl bg-[#FFC107] px-5 py-4 text-center text-lg font-black text-black shadow-lg shadow-black/40 transition hover:bg-[#ffd23b]">Entrar</Link><Link href="/login?novo=1" className="rounded-2xl border-2 border-[#FFC107] bg-black/50 px-5 py-4 text-center text-lg font-black text-[#FFC107] backdrop-blur-sm transition hover:bg-[#FFC107]/10">Criar conta</Link></div>
          <Link href="/sos" className="mt-6 text-center text-sm font-semibold text-zinc-300 underline decoration-[#FFC107] underline-offset-4">Precisa de ajuda na estrada? Acesse o CR SOS</Link>
        </section>
        <p className="text-center text-xs text-zinc-400">CR Connect · Tecnologia para oficinas e proprietários de veículos</p>
      </div>
    </main>
  );
}
