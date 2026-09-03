import { PAYMENT_OPENING_TIME } from "../../app/mega-virada-2026/countdown";

export const BOLAO_CONSENT_VERSION = "mega-virada-2026-v1";
export const BOLAO_PUSH_PATH = "/bolao";
export const BOLAO_PUSH_ICON =
  "/mega-virada-2026/arte-bolao-mega-virada-2026.jpg";
const DAY = 86_400_000;

export type BolaoReminder = {
  key: string;
  scheduledAt: number;
  title: string;
  body: string;
};

// Calendar milestones are anchored to the existing countdown, never to a visit.
export function getDueBolaoReminder(now: number): BolaoReminder | null {
  if (now > PAYMENT_OPENING_TIME + 36 * 3_600_000) return null;
  const daysBefore = [0, 1, 10, 20, 30, 40, 50, 60].find(
    (days) => PAYMENT_OPENING_TIME - days * DAY <= now,
  );
  if (daysBefore === undefined) return null;
  const remainingDays = Math.max(0, Math.ceil((PAYMENT_OPENING_TIME - now) / DAY));
  return {
    key: daysBefore === 0 ? "opening" : `days-${daysBefore}`,
    scheduledAt: PAYMENT_OPENING_TIME - daysBefore * DAY,
    title:
      daysBefore === 0
        ? "🟢 PAGAMENTOS LIBERADOS!"
        : daysBefore === 1
          ? "🍀 É AMANHÃ!"
          : "🍀 Bolão Mega da Virada 2026",
    body:
      daysBefore === 0
        ? "O Bolão Mega da Virada 2026 está com os pagamentos das cotas liberados. Toque aqui para participar. 🍀"
        : daysBefore === 1
          ? "Falta apenas 1 dia para a abertura dos pagamentos do Bolão Mega da Virada 2026. Não perca sua cota!"
          : `Faltam ${remainingDays} dias para a abertura dos pagamentos do Bolão Mega da Virada 2026, em 10/10/2026 às 08:00 (Brasília).`,
  };
}

export function canReceiveReminder(createdAt: string, reminder: BolaoReminder) {
  return Date.parse(createdAt) <= reminder.scheduledAt;
}

export function bolaoPayload(reminder: BolaoReminder) {
  return {
    title: reminder.title,
    body: reminder.body,
    url: BOLAO_PUSH_PATH,
    icon: BOLAO_PUSH_ICON,
    tag: `mega-virada-2026-${reminder.key}`,
  };
}
