export const PAYMENT_OPENING_ISO = "2026-10-10T08:00:00-03:00";
export const PAYMENT_OPENING_TIME = Date.parse(PAYMENT_OPENING_ISO);

export type CountdownValue = {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  isOpen: boolean;
};

export function calculateCountdown(now: number): CountdownValue {
  const remaining = Math.max(0, PAYMENT_OPENING_TIME - now);

  return {
    days: Math.floor(remaining / 86_400_000),
    hours: Math.floor((remaining % 86_400_000) / 3_600_000),
    minutes: Math.floor((remaining % 3_600_000) / 60_000),
    seconds: Math.floor((remaining % 60_000) / 1_000),
    isOpen: remaining === 0,
  };
}
