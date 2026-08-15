"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { enablePushNotifications } from "@/components/push-notification-setup";

type AppNotification = { id: string; workshop_id: string; title: string; body: string | null; created_at: string; read_at: string | null };

function useAlertSound() {
  const context = useRef<AudioContext | null>(null);
  async function arm() {
    const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return false;
    context.current ||= new AudioContextClass();
    await context.current.resume();
    return context.current.state === "running";
  }
  function play() {
    const audio = context.current;
    if (!audio) return;
    void audio.resume();
    const now = audio.currentTime;
    [880, 1175].forEach((frequency, index) => {
      const oscillator = audio.createOscillator(); const gain = audio.createGain(); const start = now + index * 0.28;
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, start); gain.gain.exponentialRampToValueAtTime(0.16, start + 0.02); gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.22);
      oscillator.connect(gain); gain.connect(audio.destination); oscillator.start(start); oscillator.stop(start + 0.24);
    });
  }
  return { arm, play };
}

export function WorkshopNotificationListener() {
  const db = createClient();
  const knownIds = useRef<Set<string> | null>(null);
  const workshopId = useRef<string | null>(null);
  const [alertsArmed, setAlertsArmed] = useState(() => typeof window !== "undefined" && window.localStorage.getItem("cr-connect-workshop-alerts") === "true");
  const [toast, setToast] = useState<AppNotification | null>(null);
  const [unread, setUnread] = useState(0);
  const { arm, play } = useAlertSound();

  function announce(item: AppNotification) {
    setToast(item); setUnread((current) => current + (item.read_at ? 0 : 1)); window.setTimeout(() => setToast((current) => current?.id === item.id ? null : current), 10000);
    if (alertsArmed) play();
    if ("Notification" in window && Notification.permission === "granted") new Notification(item.title, { body: item.body || "Há uma atualização no CR Connect.", icon: "/brand/cr-reparador.jpg", tag: `cr-connect-${item.id}` });
  }

  useEffect(() => {
    let active = true; let interval: number | undefined; let channel: ReturnType<typeof db.channel> | undefined;
    async function load(initial = false) {
      const { data: { user } } = await db.auth.getUser(); if (!user || !active) return;
      const membership = await db.from("workshop_users").select("workshop_id").eq("user_id", user.id).limit(1).maybeSingle();
      const id = membership.data?.workshop_id; if (!id || !active) return; workshopId.current = id;
      const result = await db.from("notifications").select("id,workshop_id,title,body,created_at,read_at").eq("workshop_id", id).eq("user_id", user.id).order("created_at", { ascending: false }).limit(30);
      if (!active || !result.data) return;
      const items = result.data as AppNotification[];
      setUnread(items.filter((item) => !item.read_at).length);
      if (!knownIds.current || initial) { knownIds.current = new Set(items.map((item) => item.id)); return; }
      items.filter((item) => !knownIds.current?.has(item.id)).forEach(announce); knownIds.current = new Set(items.map((item) => item.id));
    }
    async function start() {
      await load(true);
      const { data: { user } } = await db.auth.getUser(); if (!user || !active) return;
      channel = db.channel(`cr-connect-notifications-${user.id}`).on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` }, (payload) => {
        const item = payload.new as AppNotification;
        if (workshopId.current && item.workshop_id === workshopId.current && !knownIds.current?.has(item.id)) { knownIds.current?.add(item.id); announce(item); }
      }).subscribe();
      interval = window.setInterval(() => void load(), 10000);
    }
    void start();
    return () => { active = false; if (interval) window.clearInterval(interval); if (channel) void db.removeChannel(channel); };
  }, [alertsArmed]);

  async function enableAlerts() {
    const soundReady = await arm();
    const push = await enablePushNotifications();
    // A confirmação fica salva para o botão não voltar após atualizar ou reabrir.
    // Mesmo se o navegador bloquear o primeiro som, o push continua disponível.
    window.localStorage.setItem("cr-connect-workshop-alerts", "true");
    setAlertsArmed(true);
    if (soundReady) play();
    setToast({ id: "activation", workshop_id: "", title: "Avisos ativados", body: push.ok ? push.message : `${push.message} Os avisos dentro do app continuam ativos.`, created_at: new Date().toISOString(), read_at: null });
    window.setTimeout(() => setToast((current) => current?.id === "activation" ? null : current), 7000);
  }

  return <>{unread > 0 && <a href="/app/notificacoes" className="fixed bottom-5 left-5 z-40 max-w-xs rounded-xl border border-[#FFC107] bg-[#211805] px-4 py-3 text-sm font-bold text-[#FFC107] shadow-xl">🔔 {unread} aviso{unread > 1 ? "s" : ""} pendente{unread > 1 ? "s" : ""}. Abrir notificações</a>}{!alertsArmed && <button type="button" onClick={() => void enableAlerts()} className="fixed bottom-5 right-5 z-40 rounded-xl border border-[#FFC107] bg-[#171717] px-4 py-3 text-sm font-bold text-[#FFC107] shadow-xl">Ativar avisos com som</button>}{toast && <div role="alert" className="fixed left-4 right-4 top-4 z-50 mx-auto max-w-md rounded-2xl border border-[#FFC107] bg-[#211805] p-4 shadow-2xl"><p className="font-bold text-[#FFC107]">{toast.title}</p><p className="mt-1 text-sm text-zinc-100">{toast.body || "Há uma atualização no CR Connect."}</p><p className="mt-2 text-xs text-zinc-400">Abra Notificações para ver os detalhes.</p></div>}</>;
}
