export type DashboardIconName = "home" | "order" | "client" | "budget" | "sos" | "vehicle" | "stock" | "chat" | "plus" | "menu" | "close" | "document" | "finance" | "chart" | "team" | "tool" | "spark" | "bell" | "settings";

export function DashboardIcon({ name, className = "h-6 w-6" }: { name: DashboardIconName; className?: string }) {
  const common = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  return <svg aria-hidden="true" viewBox="0 0 24 24" className={className} {...common}>
    {name === "home" && <><path d="m3 11 9-7 9 7"/><path d="M5 10v10h14V10M9 20v-6h6v6"/></>}
    {name === "order" && <><rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4.5V3h6v1.5M8.5 10h7M8.5 14h4"/><circle cx="17.5" cy="17.5" r="3.5" fill="currentColor" stroke="none"/><path d="M17.5 15.8v3.4M15.8 17.5h3.4" stroke="black" strokeWidth="1.5"/></>}
    {name === "client" && <><circle cx="9" cy="8" r="3.2"/><path d="M3.5 20c.4-4.1 2.2-6.2 5.5-6.2s5.1 2.1 5.5 6.2M18 7v6M15 10h6"/></>}
    {name === "budget" && <><path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Z"/><path d="M9 8.5h6M9 12h6M9 15.5h3"/></>}
    {name === "sos" && <><path d="M12 3 20 7v5c0 4.7-3 7.7-8 9-5-1.3-8-4.3-8-9V7l8-4Z"/><path d="M12 8v8M8 12h8"/></>}
    {name === "vehicle" && <><path d="m5 16-1.2-1.4a2 2 0 0 1-.3-2.1l1.3-3.1A2.3 2.3 0 0 1 7 8h10a2.3 2.3 0 0 1 2.2 1.4l1.3 3.1a2 2 0 0 1-.3 2.1L19 16"/><path d="M4 13h16v5H4zM7 18v2M17 18v2"/><circle cx="7" cy="15.5" r="1" fill="currentColor" stroke="none"/><circle cx="17" cy="15.5" r="1" fill="currentColor" stroke="none"/></>}
    {name === "stock" && <><path d="m4 7 8-4 8 4-8 4-8-4Z"/><path d="M4 7v10l8 4 8-4V7M12 11v10"/></>}
    {name === "chat" && <><path d="M4 5h16v11H9l-5 4V5Z"/><path d="M8 9h8M8 12.5h5"/></>}
    {name === "menu" && <path d="M4 6h16M4 12h16M4 18h16"/>}
    {name === "close" && <path d="m6 6 12 12M6 18 18 6"/>}
    {name === "document" && <><path d="M5 3h9l5 5v13H5zM14 3v6h5M8 13h8M8 17h5"/></>}
    {name === "finance" && <><rect x="3" y="5" width="18" height="15" rx="2"/><path d="M3 9h18M15 13h6v4h-6z"/></>}
    {name === "chart" && <path d="M4 3v17h17M8 16v-4M13 16V8M18 16V5"/>}
    {name === "team" && <><circle cx="9" cy="8" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2M17 5a3 3 0 0 1 0 6M18 14a5 5 0 0 1 3 5v1"/></>}
    {name === "tool" && <path d="M14 4a6 6 0 0 0-7 8L3 17a2.8 2.8 0 0 0 4 4l5-5a6 6 0 0 0 8-7l-4 4-5-5 4-4Z"/>}
    {name === "spark" && <><path d="m12 3 2.4 6.6L21 12l-6.6 2.4L12 21l-2.4-6.6L3 12l6.6-2.4L12 3ZM20 2v4M18 4h4"/></>}
    {name === "bell" && <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></>}
    {name === "settings" && <><path d="m9 3-1 3-3 1-2 3 2 2-1 4 3 2 3-1 2 3 3-1 1-3 3-1 2-3-2-2 1-4-3-2-3 1-2-3Z"/><circle cx="12" cy="12" r="3"/></>}
    {name === "plus" && <><path d="M12 5v14M5 12h14"/></>}
  </svg>;
}
