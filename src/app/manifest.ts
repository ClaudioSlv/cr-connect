import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "CR Connect — Gestão Automotiva",
    short_name: "CR Connect",
    description: "Gestão automotiva e CR SOS para oficinas e proprietários.",
    start_url: "/app",
    display: "standalone",
    background_color: "#0E0E0E",
    theme_color: "#0E0E0E",
    lang: "pt-BR",
    icons: [
      { src: "/brand/cr-reparador.jpg", sizes: "512x512", type: "image/jpeg", purpose: "any" },
      { src: "/brand/cr-reparador.jpg", sizes: "512x512", type: "image/jpeg", purpose: "maskable" },
    ],
  };
}
