import type { Metadata, Viewport } from "next";

import MegaVirada2026Page from "../mega-virada-2026/page";
import { BolaoReminderPrompt } from "@/components/bolao-reminder-prompt";

const pageUrl = "https://cr-connect-ic3w.vercel.app/bolao";
const ogImageUrl =
  "https://cr-connect-ic3w.vercel.app/mega-virada-2026/arte-bolao-mega-virada-2026.jpg";
const previewTitle = "🍀 Bolão Mega da Virada 2026";
const previewDescription =
  "⏱️ Veja quanto tempo falta para a abertura dos pagamentos em 10/10/2026 às 08:00.";

export const metadata: Metadata = {
  title: previewTitle,
  description: previewDescription,
  applicationName: "Mega da Virada 2026",
  manifest: "/bolao/manifest.webmanifest",
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

export default function BolaoPage() {
  return (
    <div className="bg-[#020503] [&_dt]:text-[.75rem]! [&_dt]:font-extrabold! [&_dt]:text-[#FFFFFF]! min-[380px]:[&_dt]:text-[.8rem]!">
      <MegaVirada2026Page />
      <BolaoReminderPrompt />
    </div>
  );
}
