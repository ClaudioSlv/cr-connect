import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title:"CR Connect", description:"Gestão inteligente para oficinas" };
export default function RootLayout({children}:Readonly<{children:React.ReactNode}>) { return <html lang="pt-BR"><body>{children}</body></html>; }
