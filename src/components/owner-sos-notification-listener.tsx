"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { PushNotificationSetup } from "@/components/push-notification-setup";

type OwnerAlert = { id: string; title: string; body: string | null; created_at: string };

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

export function OwnerSosNotificationListener() {
  const db = createClient();
  const known = useRef<Set<string> | null>(null);
  const [armed, setArmed] = useState(() => typeof window !== "undefined" && window.localStorage.getItem("cr-connect-sound-consent") === "true");
  const [toast, setToast] = useState<OwnerAlert | null>(null);
  const { arm, play } = useAlertSound();
  function announce(item: OwnerAlert) {
    setToast(item); window.setTimeout(() => setToast((current) => current?.id === item.id ? null : current), 10000);
    if (armed) play();
    if ("Notification" in window && Notification.permission === "granted") new Notification(item.title, { body: item.body || "Atualização no seu chamado CR SOS.", icon: "/brand/cr-reparador.jpg", tag: `cr-sos-owner-${item.id}` });
  }
  useEffect(() => {
    let active = true; let timer: number | undefined;
    async function load(initial = false) {
      const { data: { user } } = await db.auth.getUser(); if (!user || !active) return;
      const { data } = await db.from("sos_owner_notifications").select("id,title,body,created_at").eq("owner_id", user.id).order("created_at", { ascending: false }).limit(20);
      if (!active || !data) return;
      const alerts = data as OwnerAlert[];
      if (!known.current || initial) { known.current = new Set(alerts.map((item) => item.id)); return; }
      alerts.filter((item) => !known.current?.has(item.id)).forEach(announce); known.current = new Set(alerts.map((item) => item.id));
    }
    void load(true); timer = window.setInterval(() => void load(), 7000);
    return () => { active = false; if (timer) window.clearInterval(timer); };
  }, [armed]);
  async function activate() {
    const ok = await arm(); setArmed(ok);
    if (ok) window.localStorage.setItem("cr-connect-sound-consent", "true");
    if ("Notification" in window && Notification.permission === "default") await Notification.requestPermission();
    if (ok) play();
  }
  return <><PushNotificationSetup />{!armed && <button type="button" onClick={() => void activate()} className="fixed bottom-5 right-5 z-40 rounded-xl border border-[#FFC107] bg-[#171717] px-4 py-3 text-sm font-bold text-[#FFC107] shadow-xl">Ativar avisos CR SOS com som</button>}{toast && <div role="alert" className="fixed left-4 right-4 top-4 z-50 mx-auto max-w-md rounded-2xl border border-[#FFC107] bg-[#211805] p-4 shadow-2xl"><p className="font-bold text-[#FFC107]">{toast.title}</p><p className="mt-1 text-sm text-zinc-100">{toast.body}</p></div>}</>;
}
