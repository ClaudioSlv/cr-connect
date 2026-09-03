import { NextResponse } from "next/server";
import { canReceiveReminder, getDueBolaoReminder } from "@/lib/bolao/schedule";
import { authorizedSecret, bolaoAdmin, bolaoConfigured, sendBolaoReminder, type StoredBolaoSubscription } from "@/lib/bolao/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  if (!authorizedSecret(request, process.env.CRON_SECRET)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (process.env.BOLAO_REMINDERS_ENABLED !== "true") {
    return NextResponse.json({ skipped: "Schedule is disabled until a real push test is verified." });
  }
  if (!bolaoConfigured()) return NextResponse.json({ error: "Push is not configured" }, { status: 503 });
  const reminder = getDueBolaoReminder(Date.now());
  if (!reminder) return NextResponse.json({ sent: 0, reason: "No reminder due" });

  try {
    const db = bolaoAdmin();
    const totals: Record<string, number> = {};
    let cursor = "";
    const started = Date.now();
    for (;;) {
      let query = db.from("bolao_push_subscriptions")
        .select("id,endpoint,p256dh,auth,created_at").eq("active", true)
        .lte("created_at", new Date(reminder.scheduledAt).toISOString())
        .order("id").limit(100);
      if (cursor) query = query.gt("id", cursor);
      const { data, error } = await query;
      if (error) throw new Error("Could not load bolao subscriptions");
      const rows = (data || []) as StoredBolaoSubscription[];
      for (let index = 0; index < rows.length; index += 10) {
        if (Date.now() - started > 45_000) {
          return NextResponse.json({ reminder: reminder.key, totals, incomplete: true }, { status: 503 });
        }
        const outcomes = await Promise.all(rows.slice(index, index + 10)
          .filter((row) => canReceiveReminder(row.created_at, reminder))
          .map((row) => sendBolaoReminder(row, reminder)));
        for (const outcome of outcomes) totals[outcome] = (totals[outcome] || 0) + 1;
      }
      if (rows.length < 100) break;
      cursor = rows[rows.length - 1].id;
    }
    return NextResponse.json({ reminder: reminder.key, totals });
  } catch {
    return NextResponse.json({ error: "Reminder processing failed. Check database/configuration; safe to invoke again." }, { status: 503 });
  }
}
