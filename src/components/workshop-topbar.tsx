"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type WorkshopNotification = {
  id: string;
  title: string;
  body: string | null;
  read_at: string | null;
  created_at: string;
};

function destination(notification: WorkshopNotification) {
  const text = `${notification.title} ${notification.body || ""}`.toLowerCase();
  if (text.includes("mensagem")) return { href: "/app/chat", label: "Responder no chat" };
  if (text.includes("orçamento")) return { href: "/app/orcamentos", label: "Ver orçamento" };
  return { href: "/app/ordens", label: "Ver solicitação" };
}

export function WorkshopTopbar() {
  const db = createClient();
  const [items, setItems] = useState<WorkshopNotification[]>([]);
  const [open, setOpen] = useState(false);

  async function load() {
    const { data: { user } } = await db.auth.getUser();
    if (!user) return;
    const { data } = await db
      .from("notifications")
      .select("id,title,body,read_at,created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(30);
    setItems((data || []) as WorkshopNotification[]);
  }

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 10000);
    return () => window.clearInterval(timer);
  }, []);

  async function openBell() {
    setOpen((current) => !current);
    const unreadIds = items.filter((item) => !item.read_at).map((item) => item.id);
    if (unreadIds.length) {
      const readAt = new Date().toISOString();
      await db.from("notifications").update({ read_at: readAt }).in("id", unreadIds);
      setItems((current) => current.map((item) => unreadIds.includes(item.id) ? { ...item, read_at: readAt } : item));
    }
  }

  const unread = items.filter((item) => !item.read_at).length;

  return (
    <div className="relative z-50 flex justify-end">
      <button
        type="button"
        onClick={() => void openBell()}
        aria-label="Abrir central de notificações"
        className="relative grid h-11 w-11 place-items-center rounded-full border border-[#FFC107]/70 bg-[#171717] text-xl shadow-lg"
      >
        🔔
        {unread > 0 && <span className="absolute -right-1 -top-1 grid min-h-5 min-w-5 place-items-center rounded-full bg-[#FFC107] px-1 text-[11px] font-black text-black">{unread > 9 ? "9+" : unread}</span>}
      </button>

      {open && <section className="absolute right-0 top-14 w-[min(24rem,calc(100vw-3rem))] rounded-2xl border border-zinc-700 bg-[#151515] p-4 text-left shadow-2xl">
        <div className="flex items-center justify-between gap-3"><div><b>Notificações</b><p className="text-xs text-zinc-400">Pedidos e mensagens da oficina.</p></div><Link href="/app/notificacoes" className="text-sm font-bold text-[#FFC107]">Ver todas</Link></div>
        <div className="mt-3 max-h-80 space-y-2 overflow-y-auto">
          {items.length === 0 && <p className="rounded-lg bg-black/30 p-3 text-sm text-zinc-400">Nenhuma notificação ainda.</p>}
          {items.map((item) => {
            const action = destination(item);
            return <article key={item.id} className={`rounded-xl border p-3 text-sm ${item.read_at ? "border-zinc-800 bg-black/20" : "border-[#FFC107]/60 bg-[#211805]"}`}>
              <b className="block text-[#FFC107]">{item.title}</b>
              {item.body && <p className="mt-1 text-zinc-200">{item.body}</p>}
              <div className="mt-3 flex items-center justify-between gap-2"><small className="text-zinc-500">{new Date(item.created_at).toLocaleString("pt-BR")}</small><Link href={action.href} onClick={() => setOpen(false)} className="rounded-md border border-[#FFC107]/70 px-2 py-1 text-xs font-bold text-[#FFC107]">{action.label}</Link></div>
            </article>;
          })}
        </div>
      </section>}
    </div>
  );
}
