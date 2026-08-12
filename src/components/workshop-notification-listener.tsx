"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type AppNotification = {
  id: string;
  workshop_id: string;
  title: string;
  body: string | null;
  created_at: string;
};

const ALERTS_ENABLED_KEY = "cr-connect-alerts-enabled";

function playEmergencySound() {
  const context = new AudioContext();
  const playTone = (at: number, frequency: number) => {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(0.16, at + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.22);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(at);
    oscillator.stop(at + 0.24);
  };

  const now = context.currentTime;
  playTone(now, 880);
  playTone(now + 0.28, 1175);
  window.setTimeout(() => void context.close(), 900);
}

export function WorkshopNotificationListener() {
  const db = createClient();
  const knownIds = useRef<Set<string> | null>(null);
  const workshopId = useRef<string | null>(null);
  const [alertsEnabled, setAlertsEnabled] = useState(false);
  const [toast, setToast] = useState<AppNotification | null>(null);

  function announce(item: AppNotification) {
    setToast(item);
    window.setTimeout(() => setToast((current) => current?.id === item.id ? null : current), 10000);

    if (alertsEnabled) {
      try {
        playEmergencySound();
      } catch {
        // Some browsers require a prior interaction before they allow audio.
      }
    }

    if ("Notification" in window && Notification.permission === "granted") {
      new Notification(item.title, {
        body: item.body || "Há uma atualização no CR Connect.",
        icon: "/brand/cr-reparador.jpg",
        tag: `cr-connect-${item.id}`,
      });
    }
  }

  useEffect(() => {
    setAlertsEnabled(window.localStorage.getItem(ALERTS_ENABLED_KEY) === "true");

    let active = true;
    let interval: number | undefined;
    let channel: ReturnType<typeof db.channel> | undefined;

    async function load(initial = false) {
      const userResult = await db.auth.getUser();
      const user = userResult.data.user;
      if (!user || !active) return;

      const membership = await db
        .from("workshop_users")
        .select("workshop_id")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();
      const id = membership.data?.workshop_id;
      if (!id || !active) return;
      workshopId.current = id;

      const result = await db
        .from("notifications")
        .select("id,workshop_id,title,body,created_at")
        .eq("workshop_id", id)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(30);
      if (!active || !result.data) return;

      const items = result.data as AppNotification[];
      if (!knownIds.current || initial) {
        knownIds.current = new Set(items.map((item) => item.id));
        return;
      }
      items.filter((item) => !knownIds.current?.has(item.id)).forEach(announce);
      knownIds.current = new Set(items.map((item) => item.id));
    }

    async function start() {
      await load(true);
      const userResult = await db.auth.getUser();
      const user = userResult.data.user;
      if (!user || !active) return;

      channel = db
        .channel(`cr-connect-notifications-${user.id}`)
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` }, (payload) => {
          const item = payload.new as AppNotification;
          if (workshopId.current && item.workshop_id === workshopId.current && !knownIds.current?.has(item.id)) {
            knownIds.current?.add(item.id);
            announce(item);
          }
        })
        .subscribe();
      interval = window.setInterval(() => void load(), 10000);
    }

    void start();
    return () => {
      active = false;
      if (interval) window.clearInterval(interval);
      if (channel) void db.removeChannel(channel);
    };
  }, [alertsEnabled]);

  async function enableAlerts() {
    window.localStorage.setItem(ALERTS_ENABLED_KEY, "true");
    setAlertsEnabled(true);
    if ("Notification" in window && Notification.permission === "default") {
      await Notification.requestPermission();
    }
    try {
      playEmergencySound();
    } catch {
      // The in-app visual alert remains available even if audio is unavailable.
    }
  }

  return <>
    {!alertsEnabled && <button type="button" onClick={() => void enableAlerts()} className="fixed bottom-5 right-5 z-40 rounded-xl border border-[#FFC107] bg-[#171717] px-4 py-3 text-sm font-bold text-[#FFC107] shadow-xl">🔔 Ativar alertas CR SOS</button>}
    {toast && <div role="alert" className="fixed left-4 right-4 top-4 z-50 mx-auto max-w-md rounded-2xl border border-[#FFC107] bg-[#211805] p-4 shadow-2xl"><p className="font-bold text-[#FFC107]">🔔 {toast.title}</p><p className="mt-1 text-sm text-zinc-100">{toast.body || "Há uma atualização no CR Connect."}</p><p className="mt-2 text-xs text-zinc-400">Abra Notificações para ver os detalhes.</p></div>}
  </>;
}
