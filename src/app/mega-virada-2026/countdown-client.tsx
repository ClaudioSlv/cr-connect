"use client";

import { useEffect, useState } from "react";

import {
  calculateCountdown,
  type CountdownValue,
  PAYMENT_OPENING_ISO,
} from "./countdown";

const whatsappMessage =
  "Olá! Quero participar do Bolão Mega da Virada 2026 🍀";
const whatsappUrl = `https://wa.me/5513991320205?text=${encodeURIComponent(whatsappMessage)}`;

const fields: Array<{ key: keyof Omit<CountdownValue, "isOpen">; label: string }> = [
  { key: "days", label: "DIAS" },
  { key: "hours", label: "HORAS" },
  { key: "minutes", label: "MINUTOS" },
  { key: "seconds", label: "SEGUNDOS" },
];

function formatNumber(value: number) {
  return String(value).padStart(2, "0");
}

export function CountdownClient() {
  const [countdown, setCountdown] = useState<CountdownValue | null>(null);

  useEffect(() => {
    const updateCountdown = () => setCountdown(calculateCountdown(Date.now()));
    const initialUpdate = window.setTimeout(updateCountdown, 0);
    const interval = window.setInterval(updateCountdown, 1_000);
    return () => {
      window.clearTimeout(initialUpdate);
      window.clearInterval(interval);
    };
  }, []);

  const isOpen = countdown?.isOpen === true;

  return (
    <>
      <section
        aria-labelledby="countdown-title"
        className="relative overflow-hidden rounded-[1.75rem] border border-[#b88a28]/50 bg-[linear-gradient(145deg,rgba(14,45,25,.9),rgba(4,9,5,.96)_48%,rgba(32,23,5,.9))] p-4 shadow-[0_24px_80px_rgba(0,0,0,.55),inset_0_1px_0_rgba(255,224,137,.14)] sm:p-7"
      >
        <div className="pointer-events-none absolute -right-14 -top-16 h-44 w-44 rounded-full bg-[#d5a62e]/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 -left-14 h-48 w-48 rounded-full bg-[#00a859]/10 blur-3xl" />

        <p
          id="countdown-title"
          className="relative text-center text-[.68rem] font-black tracking-[.18em] text-[#f3d779] sm:text-sm sm:tracking-[.24em]"
        >
          CONTAGEM REGRESSIVA PARA ABERTURA DOS PAGAMENTOS
        </p>

        <div
          aria-live="polite"
          aria-label={
            countdown
              ? `${countdown.days} dias, ${countdown.hours} horas, ${countdown.minutes} minutos e ${countdown.seconds} segundos`
              : "Carregando contagem regressiva"
          }
          className="relative mt-5 grid grid-cols-4 gap-1.5 sm:mt-7 sm:gap-3"
        >
          {fields.map((field, index) => (
            <div key={field.key} className="relative min-w-0">
              <div className="rounded-xl border border-[#d6ae4b]/35 bg-black/55 px-1 py-4 text-center shadow-[inset_0_1px_12px_rgba(255,211,104,.05)] sm:rounded-2xl sm:px-3 sm:py-6">
                <span className="block tabular-nums text-[1.85rem] font-black leading-none tracking-tight text-white drop-shadow-[0_0_18px_rgba(255,214,91,.25)] min-[380px]:text-4xl sm:text-6xl">
                  {countdown ? formatNumber(countdown[field.key]) : "--"}
                </span>
                <span className="mt-2 block whitespace-nowrap text-[.44rem] font-black tracking-[.05em] text-[#f2cf69] min-[380px]:text-[.5rem] sm:mt-3 sm:text-xs sm:tracking-[.16em]">
                  {field.label}
                </span>
              </div>
              {index < fields.length - 1 && (
                <span
                  aria-hidden="true"
                  className="absolute -right-[.36rem] top-[1.15rem] z-10 text-lg font-black text-[#d6ae4b] sm:-right-[.62rem] sm:top-[1.8rem] sm:text-2xl"
                >
                  :
                </span>
              )}
            </div>
          ))}
        </div>

        <p className="relative mt-4 text-center text-[.68rem] font-bold uppercase tracking-[.12em] text-white/55 sm:mt-6 sm:text-xs">
          <time dateTime={PAYMENT_OPENING_ISO}>
            10 de outubro de 2026 • 08:00 • Brasília
          </time>
        </p>
      </section>

      <section
        aria-live="assertive"
        className={`mt-5 rounded-2xl border p-5 text-center transition-colors sm:p-6 ${
          isOpen
            ? "border-[#19c86f]/60 bg-[#062f1a]/80 shadow-[0_0_35px_rgba(25,200,111,.12)]"
            : "border-[#d6ae4b]/35 bg-[#181305]/80"
        }`}
      >
        <p
          className={`text-sm font-black tracking-[.08em] sm:text-lg ${
            isOpen ? "text-[#63ef9f]" : "text-[#f5d56f]"
          }`}
        >
          {isOpen
            ? "🟢 PAGAMENTOS LIBERADOS!"
            : "⏳ AGUARDE A ABERTURA DOS PAGAMENTOS"}
        </p>

        {isOpen && (
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-5 flex min-h-14 w-full items-center justify-center rounded-xl border border-[#8affb8]/25 bg-[#19c86f] px-4 py-4 text-center text-sm font-black text-[#001c0b] shadow-[0_12px_32px_rgba(25,200,111,.25)] transition hover:bg-[#27df7e] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#8affb8] sm:text-base"
          >
            💬 QUERO PARTICIPAR DO BOLÃO
          </a>
        )}
      </section>
    </>
  );
}
