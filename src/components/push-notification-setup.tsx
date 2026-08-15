"use client";
import { useEffect, useState } from "react";
function key(value: string) { const encoded = value.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - value.length % 4) % 4); return Uint8Array.from(atob(encoded), (c) => c.charCodeAt(0)); }
export async function enablePushNotifications() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!publicKey || !("serviceWorker" in navigator) || !("PushManager" in window)) return { ok: false, message: "Avisos com o app fechado ainda não estão disponíveis neste aparelho." };
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return { ok: false, message: "Permita as notificações do CR Connect para receber avisos." };
  const registration = await navigator.serviceWorker.register("/sw.js");
  const existing = await registration.pushManager.getSubscription();
  const subscription = existing || await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key(publicKey) });
  const response = await fetch("/api/push-subscriptions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(subscription) });
  return response.ok ? { ok: true, message: "Avisos ativados neste celular." } : { ok: false, message: "Não foi possível ativar os avisos agora." };
}
export function PushNotificationSetup() {
  const [enabled, setEnabled] = useState(false); const [status, setStatus] = useState("");
  useEffect(() => { let active = true; async function check() { if (!("serviceWorker" in navigator) || !("PushManager" in window)) return; const registration = await navigator.serviceWorker.getRegistration("/"); const subscription = await registration?.pushManager.getSubscription(); if (active && subscription) setEnabled(true); } void check(); return () => { active = false; }; }, []);
  async function enable() { const result = await enablePushNotifications(); setStatus(result.message); if (result.ok) setEnabled(true); }
  if (enabled) return null;
  return <div className="fixed bottom-5 left-5 z-40 max-w-xs"><button type="button" onClick={() => void enable()} className="rounded-xl border border-[#FFC107] bg-[#171717] px-4 py-3 text-sm font-bold text-[#FFC107] shadow-xl">Ativar notificacoes mesmo fechado</button>{status && <p className="mt-2 rounded-lg bg-black/80 p-2 text-xs text-zinc-200">{status}</p>}</div>;
}
