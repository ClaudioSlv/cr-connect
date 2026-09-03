import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import vm from "node:vm";
import test from "node:test";
import ts from "typescript";

const require = createRequire(import.meta.url);
const root = path.resolve(import.meta.dirname, "..");
function load(relative, overrides = {}) {
  const filename = path.join(root, relative);
  const output = ts.transpileModule(readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  const testModule = { exports: {} };
  const resolve = (name) => {
    if (name in overrides) return overrides[name];
    if (name === "server-only") return {};
    if (name.startsWith(".")) return load(path.relative(root, path.resolve(path.dirname(filename), name)) + ".ts", overrides);
    return require(name);
  };
  vm.runInThisContext(`(function(require,module,exports){${output}\n})`, { filename })(resolve, testModule, testModule.exports);
  return testModule.exports;
}

const countdown = load("src/app/mega-virada-2026/countdown.ts");
const schedule = load("src/lib/bolao/schedule.ts");
const validation = load("src/lib/bolao/validation.ts");
const target = Date.parse("2026-10-10T11:00:00Z");
const day = 86400000;

test("existing countdown target is unchanged and clamps at zero", () => {
  assert.equal(countdown.PAYMENT_OPENING_TIME, target);
  assert.equal(countdown.PAYMENT_OPENING_ISO, "2026-10-10T08:00:00-03:00");
  assert.deepEqual(countdown.calculateCountdown(target - 1000), { days: 0, hours: 0, minutes: 0, seconds: 1, isOpen: false });
  assert.deepEqual(countdown.calculateCountdown(target + day), { days: 0, hours: 0, minutes: 0, seconds: 0, isOpen: true });
});

test("reminders use 10-day milestones anchored to the target", () => {
  for (const days of [60, 50, 40, 30, 20, 10, 1, 0]) {
    const reminder = schedule.getDueBolaoReminder(target - days * day);
    assert.equal(reminder.scheduledAt, target - days * day);
    assert.equal(reminder.key, days === 0 ? "opening" : `days-${days}`);
  }
  assert.equal(schedule.getDueBolaoReminder(target - 61 * day), null);
  assert.equal(schedule.getDueBolaoReminder(target + 37 * 3600000), null);
});

test("late execution selects only newest milestone and uses actual remaining days", () => {
  const reminder = schedule.getDueBolaoReminder(target - 28 * day);
  assert.equal(reminder.key, "days-30");
  assert.match(reminder.body, /Faltam 28 dias/);
  assert.equal(schedule.getDueBolaoReminder(target).key, "opening");
});

test("new subscribers never receive an expired milestone", () => {
  const reminder = schedule.getDueBolaoReminder(target - 20 * day);
  assert.equal(schedule.canReceiveReminder(new Date(reminder.scheduledAt - 1).toISOString(), reminder), true);
  assert.equal(schedule.canReceiveReminder(new Date(reminder.scheduledAt + 1).toISOString(), reminder), false);
});

test("specified tomorrow and opening messages and notification destination", () => {
  const tomorrow = schedule.getDueBolaoReminder(target - day);
  assert.equal(tomorrow.title, "🍀 É AMANHÃ!");
  assert.equal(tomorrow.body, "Falta apenas 1 dia para a abertura dos pagamentos do Bolão Mega da Virada 2026. Não perca sua cota!");
  const opening = schedule.getDueBolaoReminder(target);
  assert.equal(opening.title, "🟢 PAGAMENTOS LIBERADOS!");
  assert.equal(schedule.bolaoPayload(opening).url, "/bolao");
  assert.equal(schedule.bolaoPayload(opening).tag, "mega-virada-2026-opening");
});

test("push endpoint allowlist blocks SSRF and malformed endpoints", () => {
  for (const endpoint of ["http://fcm.googleapis.com/a", "https://127.0.0.1/a", "https://fcm.googleapis.com.attacker.test/a", "https://fcm.googleapis.com:444/a", "https://user:password@fcm.googleapis.com/a", "https://example.com/a"]) {
    assert.equal(validation.validPushEndpoint(endpoint), false, endpoint);
  }
  for (const endpoint of ["https://fcm.googleapis.com/fcm/send/a", "https://updates.push.services.mozilla.com/wpush/v2/a", "https://web.push.apple.com/a"]) {
    assert.equal(validation.validPushEndpoint(endpoint), true, endpoint);
  }
});

test("subscription keys, consent management tokens and same-origin requests", () => {
  const subscription = { endpoint: "https://fcm.googleapis.com/fcm/send/test", keys: {
    p256dh: Buffer.alloc(65, 1).toString("base64url"), auth: Buffer.alloc(16, 2).toString("base64url"),
  } };
  assert.deepEqual(validation.parseSubscription(subscription), subscription);
  assert.equal(validation.parseSubscription({ ...subscription, keys: { p256dh: "bad", auth: "bad" } }), null);
  assert.equal(validation.validManagementToken("a".repeat(64)), true);
  assert.equal(validation.validManagementToken("short"), false);
  assert.equal(validation.sameOriginRequest(new Request("https://app.test/api", { headers: { origin: "https://app.test" } })), true);
  assert.equal(validation.sameOriginRequest(new Request("https://app.test/api", { headers: { origin: "https://other.test" } })), false);
});

function senderFixture(outcome) {
  const ledger = new Map();
  const disabled = new Set();
  let sends = 0;
  const db = {
    async rpc(_name, params) {
      const key = params.p_subscription_id + params.p_reminder_key;
      const old = ledger.get(key);
      if (old && old.status !== "retryable") return { data: false, error: null };
      ledger.set(key, { status: "claimed" });
      return { data: true, error: null };
    },
    from(table) {
      const filters = {};
      let update;
      return {
        update(value) { update = value; return this; },
        eq(name, value) { filters[name] = value; return this; },
        then(resolve) {
          if (table === "bolao_push_deliveries") ledger.set(filters.subscription_id + filters.reminder_key, update);
          if (table === "bolao_push_subscriptions") disabled.add(filters.id);
          return Promise.resolve({ error: null }).then(resolve);
        },
      };
    },
  };
  const sender = load("src/lib/bolao/server.ts", {
    "@supabase/supabase-js": { createClient: () => db },
    "web-push": { sendNotification: async () => {
      sends++;
      if (outcome) throw outcome;
    } },
  });
  return { sender, ledger, disabled, sends: () => sends };
}
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-not-real";
const row = { id: "test-id", endpoint: "https://fcm.googleapis.com/fcm/send/test", p256dh: "test", auth: "test", created_at: "2026-09-01T00:00:00Z" };
const reminder = schedule.getDueBolaoReminder(target);

test("atomic delivery claim prevents concurrent duplicate sends", async () => {
  const fixture = senderFixture();
  const results = await Promise.all([fixture.sender.sendBolaoReminder(row, reminder), fixture.sender.sendBolaoReminder(row, reminder)]);
  assert.deepEqual(results.sort(), ["duplicate", "sent"]);
  assert.equal(fixture.sends(), 1);
});

test("expired endpoints are disabled after 410", async () => {
  const fixture = senderFixture({ statusCode: 410 });
  assert.equal(await fixture.sender.sendBolaoReminder(row, reminder), "invalid");
  assert.equal(fixture.disabled.has(row.id), true);
});

test("explicit rate limits retry but ambiguous transport errors never resend", async () => {
  const limited = senderFixture({ statusCode: 429 });
  assert.equal(await limited.sender.sendBolaoReminder(row, reminder), "retryable");
  const uncertain = senderFixture(new Error("timeout"));
  assert.equal(await uncertain.sender.sendBolaoReminder(row, reminder), "uncertain");
  assert.equal(await uncertain.sender.sendBolaoReminder(row, reminder), "duplicate");
  assert.equal(uncertain.sends(), 1);
});

test("cron and test secrets are mandatory and compared safely", () => {
  const { sender } = senderFixture();
  const secret = "a".repeat(32);
  assert.equal(sender.authorizedSecret(new Request("https://test/api"), secret), false);
  assert.equal(sender.authorizedSecret(new Request("https://test/api", { headers: { authorization: `Bearer ${secret}` } }), secret), true);
  assert.equal(sender.authorizedSecret(new Request("https://test/api", { headers: { authorization: "Bearer short" } }), "short"), false);
  assert.notEqual(sender.tokenHash(secret), secret);
});

test("production opt-in remains unavailable until the real schedule is enabled", () => {
  const saved = { NODE_ENV: process.env.NODE_ENV, VERCEL_ENV: process.env.VERCEL_ENV,
    BOLAO_REMINDERS_ENABLED: process.env.BOLAO_REMINDERS_ENABLED,
    NEXT_PUBLIC_VAPID_PUBLIC_KEY: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY: process.env.VAPID_PRIVATE_KEY };
  try {
    process.env.NODE_ENV = "production";
    process.env.VERCEL_ENV = "production";
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = "test-public";
    process.env.VAPID_PRIVATE_KEY = "test-private";
    process.env.BOLAO_REMINDERS_ENABLED = "false";
    const { sender } = senderFixture();
    assert.equal(sender.bolaoAcceptingRegistrations(), false);
    process.env.VERCEL_ENV = "preview";
    assert.equal(sender.bolaoAcceptingRegistrations(), true);
    process.env.VERCEL_ENV = "production";
    process.env.BOLAO_REMINDERS_ENABLED = "true";
    assert.equal(sender.bolaoAcceptingRegistrations(), true);
  } finally {
    for (const [name, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[name]; else process.env[name] = value;
    }
  }
});

test("cron refuses unauthenticated calls and performs no sending while disabled", async () => {
  const saved = process.env.BOLAO_REMINDERS_ENABLED;
  try {
    process.env.BOLAO_REMINDERS_ENABLED = "false";
    const route = load("src/app/api/bolao/reminders/route.ts", {
      "next/server": { NextResponse: { json: (value, options) => ({ value, status: options?.status || 200 }) } },
      "@/lib/bolao/schedule": schedule,
      "@/lib/bolao/server": {
        authorizedSecret: (request) => request.headers.has("authorization"),
        bolaoConfigured: () => true,
        bolaoAdmin: () => { throw new Error("Must not query DB before activation"); },
        sendBolaoReminder: () => { throw new Error("Must not send before activation"); },
      },
    });
    assert.equal((await route.GET(new Request("https://test/api"))).status, 401);
    const response = await route.GET(new Request("https://test/api", { headers: { authorization: "Bearer test" } }));
    assert.match(response.value.skipped, /disabled/);
  } finally {
    if (saved === undefined) delete process.env.BOLAO_REMINDERS_ENABLED; else process.env.BOLAO_REMINDERS_ENABLED = saved;
  }
});

function workerFixture(windows = []) {
  const handlers = {};
  const shown = [];
  const opened = [];
  const self = {
    addEventListener: (name, fn) => { handlers[name] = fn; },
    location: { origin: "https://app.test" },
    registration: { showNotification: async (...args) => { shown.push(args); } },
    clients: { matchAll: async () => windows, openWindow: async (url) => { opened.push(url); } },
  };
  vm.runInNewContext(readFileSync(path.join(root, "public/bolao-sw.js"), "utf8"), { self, URL });
  return { handlers, shown, opened };
}

test("worker fixes click destination, campaign identity and dedup tag", async () => {
  const fixture = workerFixture();
  let pending;
  fixture.handlers.push({ data: { json: () => ({ title: "🍀 Teste", body: "ok", url: "https://evil.test", tag: "same-milestone" }) }, waitUntil: (promise) => { pending = promise; } });
  await pending;
  assert.equal(fixture.shown[0][1].data.url, "/bolao");
  assert.equal(fixture.shown[0][1].tag, "same-milestone");
  assert.equal(fixture.shown[0][1].renotify, false);
  assert.doesNotMatch(JSON.stringify(fixture.shown), /CR Connect|cr-reparador/);
  fixture.handlers.notificationclick({ notification: { close() {} }, waitUntil: (promise) => { pending = promise; } });
  await pending;
  assert.deepEqual(fixture.opened, ["https://app.test/bolao"]);
});

test("worker focuses existing bolao tab and safely handles malformed payload", async () => {
  let focused = 0;
  const fixture = workerFixture([{ url: "https://app.test/bolao?source=push", focus: async () => { focused++; } }]);
  let pending;
  fixture.handlers.push({ data: { json: () => { throw new Error("invalid"); } }, waitUntil: (promise) => { pending = promise; } });
  await pending;
  assert.match(fixture.shown[0][0], /Mega da Virada/);
  fixture.handlers.notificationclick({ notification: { close() {} }, waitUntil: (promise) => { pending = promise; } });
  await pending;
  assert.equal(focused, 1);
  assert.equal(fixture.opened.length, 0);
});

test("migration protects tables, enforces unique delivery key, and restricts retry claims", () => {
  const sql = readFileSync(path.join(root, "supabase/migrations/202609030001_bolao_push_reminders.sql"), "utf8");
  assert.match(sql, /primary key \(subscription_id, reminder_key\)/);
  assert.equal((sql.match(/enable row level security/g) || []).length, 2);
  assert.match(sql, /revoke all.*from anon, authenticated/g);
  assert.match(sql, /on conflict \(subscription_id, reminder_key\) do update/);
  assert.match(sql, /attempts < 3/);
  assert.match(sql, /status = 'retryable'/);
});
