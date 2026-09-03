import "server-only";

import { createHash, timingSafeEqual } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";

import { bolaoPayload, type BolaoReminder } from "./schedule";
import { validPushEndpoint } from "./validation";

export function bolaoConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.SUPABASE_SERVICE_ROLE_KEY &&
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

export function bolaoAcceptingRegistrations() {
  return bolaoConfigured() && (process.env.BOLAO_REMINDERS_ENABLED === "true" ||
    process.env.NODE_ENV === "development" || process.env.VERCEL_ENV === "preview");
}

export function bolaoAdmin() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Bolao storage is not configured");
  }
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function tokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function authorizedSecret(request: Request, secret: string | undefined) {
  if (!secret || secret.length < 32) return false;
  const actual = Buffer.from(request.headers.get("authorization") || "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export type StoredBolaoSubscription = {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  created_at: string;
};

export async function sendBolaoReminder(row: StoredBolaoSubscription, reminder: BolaoReminder) {
  const db = bolaoAdmin();
  const { data: claimed, error: claimError } = await db.rpc("claim_bolao_push_delivery", {
    p_subscription_id: row.id,
    p_reminder_key: reminder.key,
    p_scheduled_at: new Date(reminder.scheduledAt).toISOString(),
  });
  if (claimError) throw new Error("Could not claim bolao delivery");
  if (!claimed) return "duplicate" as const;

  let result: "sent" | "retryable" | "invalid" | "uncertain" = "uncertain";
  let statusCode: number | null = null;
  try {
    if (!validPushEndpoint(row.endpoint)) {
      result = "invalid";
    } else {
      await webpush.sendNotification(
        { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } },
        JSON.stringify(bolaoPayload(reminder)),
        {
          TTL: 3_600,
          urgency: reminder.key === "opening" ? "high" : "normal",
          timeout: 10_000,
          vapidDetails: {
            subject: process.env.VAPID_SUBJECT || "https://cr-connect-ic3w.vercel.app/bolao",
            publicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
            privateKey: process.env.VAPID_PRIVATE_KEY!,
          },
        },
      );
      result = "sent";
    }
  } catch (error) {
    statusCode = (error as { statusCode?: number }).statusCode ?? null;
    result = statusCode === 404 || statusCode === 410
      ? "invalid"
      : statusCode === 429 || (statusCode !== null && statusCode >= 500)
        ? "retryable"
        : "uncertain";
  }

  // Do not retry an ambiguous transport result: the service may have accepted it.
  // A unique DB claim plus the notification tag prevents concurrent duplicate sends.
  const now = new Date().toISOString();
  const { error: recordError } = await db.from("bolao_push_deliveries").update({
    status: result,
    sent_at: result === "sent" ? now : null,
    last_status_code: statusCode,
    retry_after: result === "retryable" ? new Date(Date.now() + 3_600_000).toISOString() : null,
  }).eq("subscription_id", row.id).eq("reminder_key", reminder.key);
  if (recordError) throw new Error("Could not record bolao delivery outcome");
  if (result === "invalid") {
    const { error } = await db.from("bolao_push_subscriptions")
      .update({ active: false, disabled_at: now, updated_at: now })
      .eq("id", row.id);
    if (error) throw new Error("Could not disable expired bolao subscription");
  }
  return result;
}
