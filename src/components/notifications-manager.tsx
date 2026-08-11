"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type AppNotification = {
  id: string;
  title: string;
  body: string | null;
  read_at: string | null;
  created_at: string;
};

export function NotificationsManager({ workshopId, userId }: { workshopId: string; userId: string }) {
  const db = createClient();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("unsupported");
  const knownIds = useRef<Set<string> | null>(null);
  const permissionRef = useRef<NotificationPermission | "unsupported">("unsupported");

  async function load() {
    const { data } = await db
      .from("notifications")
      .select("id,title,body,read_at,created_at")
      .eq("workshop_id", workshopId)
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    const nextItems = (data || []) as AppNotification[];

    if (knownIds.current && permissionRef.current === "granted") {
      nextItems
        .filter((item) => !knownIds.current?.has(item.id))
        .forEach((item) => new Notification(item.title, { body: item.body || "Há uma atualização no CR Connect." }));
    }
    knownIds.current = new Set(nextItems.map((item) => item.id));
    setItems(nextItems);
  }

  useEffect(() => {
    if ("Notification" in window) {
      permissionRef.current = Notification.permission;
      setPermission(Notification.permission);
    }
    void load();
    const interval = window.setInterval(() => void load(), 30000);
    return () => window.clearInterval(interval);
  }, []);

  async function enableBrowserAlerts() {
    if (!("Notification" in window)) return;
    const result = await Notification.requestPermission();
    permissionRef.current = result;
    setPermission(result);
  }

  async function markRead(id: string) {
    await db.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", id);
    await load();
  }

  async function markAllRead() {
    await db
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("workshop_id", workshopId)
      .eq("user_id", userId)
      .is("read_at", null);
    await load();
  }

  const unread = items.filter((item) => !item.read_at).length;
  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-zinc-400">{unread ? `${unread} aviso${unread > 1 ? "s" : ""} não lido${unread > 1 ? "s" : ""}` : "Tudo em dia."}</p>
        <div className="flex flex-wrap gap-2">
          {permission === "default" && <button onClick={() => void enableBrowserAlerts()} className="rounded-lg border border-zinc-600 px-4 py-2 text-sm font-bold">Ativar alertas neste aparelho</button>}
          {unread > 0 && <button onClick={() => void markAllRead()} className="rounded-lg border border-[#FFC107] px-4 py-2 text-sm font-bold text-[#FFC107]">Marcar tudo como lido</button>}
        </div>
      </div>
      {permission === "denied" && <p className="mt-3 text-sm text-zinc-500">Os alertas do navegador estão bloqueados neste aparelho.</p>}
      <div className="mt-5 space-y-3">
        {items.length === 0 && <div className="rounded-xl border border-dashed border-zinc-700 p-6 text-zinc-400">Nenhuma notificação ainda. Novos avisos aparecerão aqui.</div>}
        {items.map((item) => (
          <article key={item.id} className={`rounded-xl border p-5 ${item.read_at ? "border-zinc-800 bg-[#171717]" : "border-[#6b510d] bg-[#211805]"}`}>
            <div className="flex flex-wrap justify-between gap-3">
              <div>
                <h2 className="font-semibold">{item.title}</h2>
                {item.body && <p className="mt-2 text-sm text-zinc-400">{item.body}</p>}
                <time className="mt-3 block text-xs text-zinc-500">{new Date(item.created_at).toLocaleString("pt-BR")}</time>
              </div>
              {!item.read_at && <button onClick={() => void markRead(item.id)} className="h-fit rounded-lg bg-[#FFC107] px-3 py-2 text-sm font-bold text-black">Lida</button>}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
