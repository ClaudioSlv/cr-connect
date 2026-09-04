"use client";

import { useEffect, useRef, useState } from "react";
import { PAYMENT_OPENING_TIME } from "@/app/mega-virada-2026/countdown";
import { BOLAO_CONSENT_VERSION } from "@/lib/bolao/schedule";

const STORAGE_KEY = "bolao-2026-push-consent";
const VISIT_KEY = "bolao-2026-reminder-dismissed";
const API = "/api/bolao/push-subscriptions";
type Credential = { token: string; endpoint: string; subscriptionId?: string };
type Configuration = { available: boolean; publicKey?: string };
type Mode = "offer" | "busy" | "enabled" | "denied" | "unsupported" | "unavailable" | "error";

function readCredential(): Credential | null {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    return value && typeof value.endpoint === "string" && /^[a-f0-9]{64}$/.test(value.token)
      ? value : null;
  } catch { return null; }
}

function supportsPush() {
  return window.isSecureContext && "Notification" in window &&
    "serviceWorker" in navigator && "PushManager" in window;
}

function publicKeyBytes(value: string) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/") +
    "=".repeat((4 - value.length % 4) % 4);
  return Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
}

function randomToken() {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)),
    (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function activeRegistration() {
  const registration = await navigator.serviceWorker.register("/bolao-sw.js", { scope: "/bolao" });
  if (registration.active?.state === "activated") return registration;
  const worker = registration.installing || registration.waiting || registration.active;
  if (!worker) throw new Error("Não foi possível preparar os lembretes neste navegador.");
  await new Promise<void>((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      worker.removeEventListener("statechange", changed);
      reject(new Error("O navegador demorou para preparar os lembretes. Tente novamente."));
    }, 15_000);
    function changed() {
      if (worker?.state === "activated" || worker?.state === "redundant") {
        window.clearTimeout(timeout);
        worker.removeEventListener("statechange", changed);
        if (worker.state === "activated") resolve();
        else reject(new Error("Não foi possível preparar os lembretes."));
      }
    }
    worker.addEventListener("statechange", changed);
    changed();
  });
  return registration;
}

async function post(body: object) {
  return fetch(API, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body), signal: AbortSignal.timeout(15_000),
  });
}

export function BolaoReminderPrompt() {
  const [modal, setModal] = useState(false);
  const [mode, setMode] = useState<Mode>("offer");
  const [configuration, setConfiguration] = useState<Configuration | null>(null);
  const [credential, setCredential] = useState<Credential | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [message, setMessage] = useState("");
  const [supported, setSupported] = useState<boolean | null>(null);
  const [beforeOpening, setBeforeOpening] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const dismissed = useRef(false);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const started = Date.now();
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 4_000);

    async function initialize() {
      const capable = supportsPush();
      setBeforeOpening(Date.now() < PAYMENT_OPENING_TIME);
      const saved = readCredential();
      setSupported(capable);
      setCredential(saved);
      try { dismissed.current = sessionStorage.getItem(VISIT_KEY) === "1"; } catch { /* in-memory fallback */ }
      let config: Configuration = { available: false };
      if (capable) {
        try {
          const response = await fetch(API, { cache: "no-store", signal: controller.signal });
          if (response.ok) config = await response.json();
        } catch { /* offer the unavailable state without breaking the countdown */ }
      }
      if (cancelled) return;
      setConfiguration(config);

      if (capable && saved) {
        try {
          const registration = await navigator.serviceWorker.getRegistration("/bolao");
          // The root application's worker is not a bolao consent or subscription.
          const subscription = registration?.scope.endsWith("/bolao")
            ? await registration.pushManager.getSubscription() : null;
          if (subscription?.endpoint === saved.endpoint && Notification.permission === "granted") {
            const response = await post({ action: "status", endpoint: saved.endpoint, token: saved.token });
            const result = response.ok ? await response.json() : null;
            if (cancelled) return;
            if (result?.active) {
              setEnabled(true);
              return;
            }
          }
        } catch { /* keep the opt-out control available if status cannot be verified */ }
        if (cancelled) return;
        setMessage("Confira ou desative os lembretes deste navegador abaixo.");
        return;
      }

      if (Date.now() >= PAYMENT_OPENING_TIME || dismissed.current) return;
      timer = setTimeout(() => {
        if (cancelled || dismissed.current) return;
        if (Date.now() >= PAYMENT_OPENING_TIME) { setBeforeOpening(false); return; }
        setMode(!capable ? "unsupported" : !config.available ? "unavailable" : "offer");
        setModal(true);
      }, Math.max(0, 8_000 - (Date.now() - started)));
    }
    void initialize();
    return () => {
      cancelled = true;
      controller.abort();
      window.clearTimeout(timeout);
      if (timer) clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    if (modal && dialog.current && !dialog.current.open) dialog.current.showModal();
  }, [modal]);

  function dismiss() {
    dismissed.current = true;
    try { sessionStorage.setItem(VISIT_KEY, "1"); } catch { /* this mounted visit is still remembered */ }
    setModal(false);
  }

  async function enable() {
    if (Date.now() >= PAYMENT_OPENING_TIME) {
      setBeforeOpening(false);
      dismiss();
      return;
    }
    if (!supportsPush()) { setMode("unsupported"); return; }
    if (!configuration?.available || !configuration.publicKey) { setMode("unavailable"); return; }
    if (Notification.permission === "denied") { setMode("denied"); return; }
    setMode("busy");
    setMessage("");
    try {
      // This is the only permission request and occurs directly from the opt-in click.
      const permission = Notification.permission === "granted"
        ? "granted" : await Notification.requestPermission();
      if (permission !== "granted") { setMode("denied"); return; }
      const registration = await activeRegistration();
      let subscription = await registration.pushManager.getSubscription();
      let saved = readCredential();
      if (subscription && (!saved || saved.endpoint !== subscription.endpoint)) {
        // Recover an orphaned registration only after explicit consent, never the app worker.
        await subscription.unsubscribe();
        subscription = null;
        saved = null;
      }
      subscription ||= await registration.pushManager.subscribe({
        userVisibleOnly: true, applicationServerKey: publicKeyBytes(configuration.publicKey),
      });
      const nextCredential: Credential = {
        endpoint: subscription.endpoint, token: saved?.token || randomToken(),
      };
      // Persist the ownership token before the API call, so a lost response can be retried.
      localStorage.setItem(STORAGE_KEY, JSON.stringify(nextCredential));
      setCredential(nextCredential);
      const response = await post({
        subscription: subscription.toJSON(), token: nextCredential.token,
        consentVersion: BOLAO_CONSENT_VERSION,
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Não foi possível ativar os lembretes agora.");
      nextCredential.subscriptionId = result.subscriptionId;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(nextCredential));
      setCredential(nextCredential);
      setEnabled(true);
      setMode("enabled");
      dismissed.current = true;
      try { sessionStorage.setItem(VISIT_KEY, "1"); } catch { /* in-memory fallback */ }
    } catch (error) {
      setMode("error");
      setMessage(error instanceof Error ? error.message : "Não foi possível ativar os lembretes. Tente novamente.");
    }
  }

  async function disable() {
    const saved = credential || readCredential();
    if (!saved) return;
    setMode("busy");
    setMessage("");
    let removed = false;
    try {
      const response = await fetch(API, {
        method: "DELETE", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: saved.token, endpoint: saved.endpoint }),
        signal: AbortSignal.timeout(15_000),
      });
      removed = response.ok;
    } catch { /* revoke the local endpoint even if the API is temporarily offline */ }
    let localRevoked = false;
    try {
      const registration = await navigator.serviceWorker.getRegistration("/bolao");
      const subscription = registration?.scope.endsWith("/bolao")
        ? await registration.pushManager.getSubscription() : null;
      localRevoked = !subscription || await subscription.unsubscribe();
    } catch { /* server removal is sufficient to stop this campaign */ }
    if (removed) {
      try { localStorage.removeItem(STORAGE_KEY); } catch { /* consent is removed on server */ }
      setCredential(null);
      setEnabled(false);
      setMessage("Lembretes desativados. Você pode continuar usando o contador normalmente.");
      setMode("offer");
      dismiss();
    } else {
      setEnabled(!localRevoked);
      setMode("error");
      setMessage(localRevoked
        ? "Avisos desativados neste aparelho. Toque em desativar novamente para concluir a remoção do registro quando a conexão voltar."
        : "Não foi possível desativar agora. Tente novamente ou bloqueie as notificações nas configurações do navegador.");
    }
  }

  function openOffer() {
    setMode(!supported ? "unsupported" : !configuration?.available ? "unavailable" : "offer");
    setMessage("");
    setModal(true);
  }

  const busy = mode === "busy";
  return (
    <>
      <div className="mx-auto max-w-2xl px-4 pb-8 text-center text-sm text-white/80">
        {credential ? (
          <>
            <p className="mb-3 font-bold text-[#63ef9f]">{enabled ? "✅ LEMBRETES ATIVADOS" : "Lembretes neste navegador"}</p>
            <button type="button" disabled={busy} onClick={() => void disable()} className="min-h-11 rounded-xl border border-[#d6ae4b]/50 px-5 py-3 font-bold text-white disabled:opacity-50">
              {busy ? "Aguarde…" : "DESATIVAR LEMBRETES"}
            </button>
            {!enabled && !busy && configuration?.available && <button type="button" onClick={openOffer} className="ml-3 min-h-11 px-3 underline">Tentar ativar novamente</button>}
          </>
        ) : supported !== null && beforeOpening ? (
          <button type="button" onClick={openOffer} className="min-h-11 rounded-xl border border-[#d6ae4b]/40 px-5 py-3 font-bold text-[#f1ce68]">
            🔔 LEMBRETES DO BOLÃO
          </button>
        ) : null}
        {message && !modal && <p role="status" className="mx-auto mt-3 max-w-md text-sm leading-6">{message}</p>}
      </div>
      {modal && (
        <dialog ref={dialog} aria-labelledby="bolao-reminder-title" aria-describedby="bolao-reminder-description"
          onCancel={(event) => { event.preventDefault(); if (!busy) dismiss(); }}
          className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%_-_2rem)] max-w-md overflow-y-auto rounded-3xl border border-[#d6ae4b]/60 bg-[#06140c] p-6 text-white shadow-[0_24px_90px_rgba(0,0,0,.8)] backdrop:bg-black/75 sm:p-8">
          <h2 id="bolao-reminder-title" className="text-xl font-extrabold leading-tight text-[#f1ce68]">
            {mode === "enabled" ? "✅ LEMBRETES ATIVADOS" : "🔔 NÃO QUER PERDER A ABERTURA DO BOLÃO?"}
          </h2>
          <div id="bolao-reminder-description" className="mt-4 space-y-3 text-base leading-6 text-white/90">
            {mode === "enabled" ? <p role="status">Você será avisado antes da abertura dos pagamentos.</p> : <>
              <p>Receba lembretes no seu celular até a abertura dos pagamentos do Bolão Mega da Virada 2026.</p>
              <p className="font-bold text-white">Os pagamentos serão liberados em 10/10/2026 às 08:00.</p>
            </>}
          </div>
          {mode === "unsupported" && <p role="status" className="mt-4 rounded-xl bg-white/10 p-4 text-sm leading-6">Os lembretes por notificação não estão disponíveis neste navegador. No Android, tente abrir o link no Chrome. No iPhone/iPad compatível, é necessário adicionar a página à Tela de Início. O contador continua disponível normalmente.</p>}
          {mode === "unavailable" && <p role="status" className="mt-4 rounded-xl bg-white/10 p-4 text-sm leading-6">Os lembretes estão temporariamente indisponíveis. Nenhuma permissão será solicitada agora. Você pode continuar acompanhando o contador.</p>}
          {mode === "denied" && <p role="status" className="mt-4 rounded-xl bg-white/10 p-4 text-sm leading-6">As notificações não foram autorizadas. Se quiser ativá-las depois, permita notificações nas configurações deste site no navegador. O contador continua funcionando normalmente.</p>}
          {mode === "error" && <p role="alert" className="mt-4 rounded-xl border border-[#d6ae4b]/40 p-4 text-sm leading-6">{message}</p>}
          {(mode === "offer" || mode === "error" || busy) && <button type="button" disabled={busy} onClick={() => void enable()} className="mt-6 min-h-12 w-full rounded-xl bg-[#19c86f] px-4 py-4 text-sm font-extrabold text-[#001c0b] disabled:opacity-60">
            {busy ? "ATIVANDO LEMBRETES…" : "🔔 QUERO RECEBER LEMBRETES"}
          </button>}
          <button type="button" disabled={busy} onClick={dismiss} className="mt-3 min-h-12 w-full rounded-xl border border-white/25 px-4 py-3 text-sm font-bold text-white disabled:opacity-50">
            {mode === "offer" || mode === "error" ? "AGORA NÃO" : "FECHAR"}
          </button>
          <p className="mt-4 text-center text-xs leading-5 text-white/65">Opcional. Nenhum nome, telefone ou CPF é solicitado. Você pode desativar os lembretes nesta página.</p>
        </dialog>
      )}
    </>
  );
}
