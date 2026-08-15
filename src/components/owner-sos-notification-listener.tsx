"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type OwnerAlert = { id: string; title: string; body: string | null; created_at: string };

function pushKey(value: string) {
  const encoded = value.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - value.length % 4) % 4);
  return Uint8Array.from(atob(encoded), (character) => character.charCodeAt(0));
}

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
  const [activationMessage, setActivationMessage] = useState("");
  const [activating, setActivating] = useState(false);
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
    // A confirmação não depende do áudio: alguns navegadores deixam o resume()
    // pendente e antes isso fazia o botão parecer travado.
    setArmed(true);
    window.localStorage.setItem("cr-connect-sound-consent", "true");
    setToast({ id: "activation", title: "Avisos ativados", body: "Este celular está preparado para receber atualizações do CR SOS.", created_at: new Date().toISOString() });
    setActivating(true); setActivationMessage("");
    try {
      const soundReady = await arm();
      if (!soundReady) { setToast({ id: "activation-no-sound", title: "Avisos ativados", body: "O navegador bloqueou o teste de som, mas o aviso foi ativado.", created_at: new Date().toISOString() }); return; }
      play();
      setToast({ id: "activation-sound", title: "Avisos com som ativados", body: "Este celular tocará quando receber atualizações do CR SOS.", created_at: new Date().toISOString() });
      const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!publicKey || !("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return;
      const permission = await Notification.requestPermission();
      if (permission !== "granted") return;
      const registration = await navigator.serviceWorker.register("/sw.js");
      const current = await registration.pushManager.getSubscription();
      const subscription = current || await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: pushKey(publicKey) });
      const response = await fetch("/api/push-subscriptions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(subscription) });
      if (response.ok) setToast({ id: "activation-push", title: "Avisos ativados", body: "Este celular também receberá notificações com o app fechado.", created_at: new Date().toISOString() });
    } catch {
      setToast({ id: "activation-local", title: "Avisos ativados", body: "Para avisos com o app fechado, permita notificações nas permissões do site.", created_at: new Date().toISOString() });
    } finally { setActivating(false); }
  }

  return <>
    {!armed && <div className="fixed bottom-5 left-5 right-5 z-40 mx-auto max-w-sm"><button type="button" disabled={activating} onClick={() => void activate()} className="w-full rounded-xl border border-[#FFC107] bg-[#171717] px-4 py-3 text-sm font-bold text-[#FFC107] shadow-xl disabled:opacity-60">{activating ? "Ativando avisos…" : "Ativar avisos CR SOS com som"}</button>{activationMessage && <p className="mt-2 rounded-lg border border-zinc-700 bg-black/90 p-3 text-xs text-zinc-100">{activationMessage}</p>}</div>}
    {toast && <div role="alert" className="fixed left-4 right-4 top-4 z-50 mx-auto max-w-md rounded-2xl border border-[#FFC107] bg-[#211805] p-4 shadow-2xl"><p className="font-bold text-[#FFC107]">{toast.title}</p><p className="mt-1 text-sm text-zinc-100">{toast.body}</p></div>}
  </>;
}
