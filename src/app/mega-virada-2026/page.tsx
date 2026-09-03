import type { Metadata, Viewport } from "next";
import Image from "next/image";

import { CountdownClient } from "./countdown-client";

const pageUrl = "https://cr-connect-ic3w.vercel.app/mega-virada-2026";
const ogImageUrl =
  "https://cr-connect-ic3w.vercel.app/mega-virada-2026/arte-bolao-mega-virada-2026.jpg";
const previewTitle = "🍀 Bolão Mega da Virada 2026";
const previewDescription =
  "⏱️ Veja quanto tempo falta para a abertura dos pagamentos em 10/10/2026 às 08:00.";

export const metadata: Metadata = {
  title: previewTitle,
  description: previewDescription,
  applicationName: "Mega da Virada 2026",
  manifest: "/mega-virada-2026/manifest.webmanifest",
  alternates: { canonical: pageUrl },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black",
    title: "Mega da Virada 2026",
  },
  openGraph: {
    type: "website",
    locale: "pt_BR",
    url: pageUrl,
    siteName: "Mega da Virada 2026",
    title: previewTitle,
    description: previewDescription,
    images: [
      {
        url: ogImageUrl,
        width: 853,
        height: 1280,
        alt: "Arte oficial do Bolão Mega da Virada 2026",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: previewTitle,
    description: previewDescription,
    images: [ogImageUrl],
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#020503",
  colorScheme: "dark",
};

const poolDetails = [
  { value: "50", label: "participantes" },
  { value: "13", label: "jogos" },
  { value: "9", label: "dezenas por jogo" },
  { value: "R$ 131,04", label: "valor da cota" },
  { value: "R$ 6.552,00", label: "total previsto" },
  { value: "R$ 1,2 a R$ 1,5 bi", label: "prêmio estimado" },
];

export default function MegaVirada2026Page() {
  return (
    <main className="relative isolate min-h-screen overflow-hidden bg-[#020503] px-4 py-8 text-white sm:px-6 sm:py-12">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-20"
        style={{
          backgroundImage:
            "radial-gradient(circle at 50% -5%, rgba(0,168,89,.24), transparent 31%), radial-gradient(circle at 100% 45%, rgba(211,164,45,.12), transparent 30%), linear-gradient(180deg, #020704 0%, #010201 55%, #050401 100%)",
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 opacity-30"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.025) 1px, transparent 1px)",
          backgroundSize: "34px 34px",
          maskImage:
            "linear-gradient(to bottom, rgba(0,0,0,.85), transparent 75%)",
        }}
      />

      <div className="mx-auto w-full max-w-2xl">
        <header className="text-center">
          <h1 className="sr-only">🍀 BOLÃO MEGA DA VIRADA 2026 🍀</h1>
          <figure className="mx-auto max-w-md overflow-hidden rounded-[1.5rem] border border-[#d6ae4b]/45 bg-black shadow-[0_26px_90px_rgba(0,0,0,.6),0_0_45px_rgba(29,199,100,.08)]">
            <Image
              src="/mega-virada-2026/arte-bolao-mega-virada-2026.jpg"
              alt="Bolão Mega da Virada 2026: prêmio estimado, dados do bolão e data de abertura dos pagamentos"
              width={853}
              height={1280}
              priority
              sizes="(max-width: 480px) calc(100vw - 32px), 448px"
              className="h-auto w-full"
            />
          </figure>
        </header>

        <div className="mt-6 sm:mt-8">
          <CountdownClient />
        </div>

        <section className="mt-5 overflow-hidden rounded-[1.5rem] border border-white/10 bg-white/[.045] shadow-[0_20px_65px_rgba(0,0,0,.35)]">
          <div className="border-b border-white/10 px-5 py-4 sm:px-7 sm:py-5">
            <p className="text-[.62rem] font-black tracking-[.2em] text-[#31db82] sm:text-xs">
              DADOS DO BOLÃO
            </p>
            <h2 className="mt-1 text-xl font-black text-white sm:text-2xl">
              Uma cota. Treze grandes chances.
            </h2>
          </div>

          <dl className="grid grid-cols-2 divide-x divide-y divide-white/10">
            {poolDetails.map((detail) => (
              <div key={detail.label} className="min-w-0 px-4 py-5 sm:px-7 sm:py-6">
                <dt className="mt-1 text-[.62rem] font-bold uppercase tracking-[.12em] text-white/45 sm:text-xs">
                  {detail.label}
                </dt>
                <dd className="order-first truncate text-lg font-black text-[#f1ce68] min-[380px]:text-xl sm:text-2xl">
                  {detail.value}
                </dd>
              </div>
            ))}
          </dl>
        </section>

        <footer className="mt-8 text-center text-[.65rem] leading-5 text-white/35 sm:text-xs">
          <p>Organização independente do Bolão Mega da Virada 2026.</p>
          <p className="mt-1">
            Guarde esta página e acompanhe a liberação dos pagamentos.
          </p>
        </footer>
      </div>
    </main>
  );
}
