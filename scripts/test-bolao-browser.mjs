// Isolated Chrome/mobile UI test. Push permission, subscription and API are mocked;
// the final worker check uses a real local Service Worker, not remote push delivery.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const base = process.env.BOLAO_TEST_URL || "http://localhost:3010";
const chromePath = process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const profilePrefix = path.join(tmpdir(), "bolao-browser-test-");
const profile = await mkdtemp(profilePrefix);
const chrome = spawn(chromePath, ["--headless=new", "--disable-gpu", "--no-first-run", "--disable-extensions", "--remote-debugging-port=0", `--user-data-dir=${profile}`, "about:blank"], { windowsHide: true, stdio: "ignore" });
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let socket;
let command;
const results = [];
try {
  let debuggerTab;
  for (let attempt = 0; attempt < 40; attempt++) {
    try {
      // Read only this freshly-created profile's port; never attach to someone
      // else's browser or test process that happens to use a fixed debug port.
      const port = Number((await readFile(path.join(profile, "DevToolsActivePort"), "utf8")).split(/\r?\n/)[0]);
      assert.ok(Number.isInteger(port) && port > 0 && port < 65536);
      debuggerTab = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: "PUT" })).json();
      break;
    } catch { await sleep(250); }
  }
  assert.ok(debuggerTab?.webSocketDebuggerUrl, "Chrome remote debugging started");
  socket = new WebSocket(debuggerTab.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.addEventListener("open", resolve, { once: true }); socket.addEventListener("error", reject, { once: true }); });
  const pending = new Map();
  let sequence = 0;
  let apiRegisters = 0;
  let apiDeletes = 0;
  let configurationAvailable = true;
  command = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++sequence;
    const timeout = setTimeout(() => { pending.delete(id); reject(new Error(`Timeout: ${method}`)); }, 20000);
    pending.set(id, { resolve, reject, timeout });
    socket.send(JSON.stringify({ id, method, params }));
  });
  socket.addEventListener("message", async (event) => {
    const data = JSON.parse(event.data);
    if (data.id && pending.has(data.id)) {
      const request = pending.get(data.id);
      clearTimeout(request.timeout);
      pending.delete(data.id);
      if (data.error) request.reject(new Error(JSON.stringify(data.error)));
      else request.resolve(data.result);
    }
    if (data.method === "Fetch.requestPaused") {
      const request = data.params.request;
      let body = { available: configurationAvailable, publicKey: Buffer.alloc(65, 1).toString("base64url") };
      if (request.method === "POST") {
        const payload = JSON.parse(request.postData);
        if (payload.action === "status") body = { active: true, subscriptionId: "11111111-1111-4111-8111-111111111111" };
        else { apiRegisters++; body = { ok: true, subscriptionId: "11111111-1111-4111-8111-111111111111" }; }
      }
      if (request.method === "DELETE") { apiDeletes++; body = { ok: true }; }
      await command("Fetch.fulfillRequest", { requestId: data.params.requestId, responseCode: 200,
        responseHeaders: [{ name: "Content-Type", value: "application/json" }, { name: "Cache-Control", value: "no-store" }],
        body: Buffer.from(JSON.stringify(body)).toString("base64") });
    }
  });
  const evaluate = async (expression) => {
    const result = await command("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text + " " + result.exceptionDetails.exception?.description);
    return result.result.value;
  };
  const until = async (expression, ms = 10000) => {
    const start = Date.now();
    while (Date.now() - start < ms) { if (await evaluate(`Boolean(${expression})`)) return; await sleep(100); }
    throw new Error(`Condition timed out: ${expression}`);
  };
  await command("Page.enable");
  await command("Runtime.enable");
  await command("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await command("Emulation.setTimezoneOverride", { timezoneId: "America/Sao_Paulo" });
  await command("Fetch.enable", { patterns: [{ urlPattern: `${base}/api/bolao/push-subscriptions*` }] });
  let bootstrapId;
  async function scenario(mode = "normal") {
    configurationAvailable = mode !== "unavailable";
    if (bootstrapId) await command("Page.removeScriptToEvaluateOnNewDocument", { identifier: bootstrapId });
    const source = `(() => {
      window.__pushTest = { calls: 0, registrations: [], unsubscribed: 0 };
      ${mode === "after" ? "Date.now = () => 1791630001000;" : ""}
      ${mode === "unsupported" ? "delete window.PushManager;" : "window.PushManager = function() {};"}
      let active = false; try { active = Boolean(localStorage.getItem('bolao-2026-push-consent')); } catch {}
      class MockNotification { static permission = active ? 'granted' : 'default'; static async requestPermission() { window.__pushTest.calls++; this.permission = '${mode === "denied" ? "denied" : "granted"}'; return this.permission; } }
      Object.defineProperty(window, 'Notification', { configurable: true, value: MockNotification });
      const subscription = { endpoint: 'https://fcm.googleapis.com/fcm/send/browser-test',
        toJSON() { return { endpoint: this.endpoint, keys: { p256dh: '${Buffer.alloc(65, 1).toString("base64url")}', auth: '${Buffer.alloc(16, 2).toString("base64url")}' } }; },
        async unsubscribe() { active = false; window.__pushTest.unsubscribed++; return true; } };
      const registration = { scope: location.origin + '/bolao', active: { state: 'activated' }, pushManager: {
        async getSubscription() { return active ? subscription : null; },
        async subscribe() { active = true; return subscription; }
      } };
      const root = { scope: location.origin + '/', pushManager: { async getSubscription() { return null; } } };
      Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: {
        async register(url, options) { window.__pushTest.registrations.push({ url, scope: options?.scope }); return url === '/bolao-sw.js' ? registration : root; },
        async getRegistration() { return active ? registration : root; }
      } });
    })();`;
    bootstrapId = (await command("Page.addScriptToEvaluateOnNewDocument", { source })).identifier;
  }
  async function navigate(route) {
    await command("Page.navigate", { url: base + route });
    await until("document.readyState === 'complete' && document.querySelector('main')");
  }
  async function clearStorage() { await evaluate("sessionStorage.clear(); localStorage.clear();"); }
  async function click(text, inDialog = true) {
    await evaluate(`Array.from(document.querySelectorAll(${JSON.stringify(inDialog ? "dialog button" : "button")})).find(b => b.textContent.trim() === ${JSON.stringify(text)})?.click()`);
  }
  const modalOpen = "Boolean(document.querySelector('dialog[open]'))";

  await scenario();
  await navigate("/bolao");
  await clearStorage();
  await navigate("/bolao");
  const firstCount = await evaluate("document.querySelector('[aria-labelledby=\"countdown-title\"] [aria-live]').getAttribute('aria-label')");
  await sleep(2500);
  assert.equal(await evaluate(modalOpen), false);
  assert.equal(await evaluate("window.__pushTest.calls"), 0);
  const secondCount = await evaluate("document.querySelector('[aria-labelledby=\"countdown-title\"] [aria-live]').getAttribute('aria-label')");
  assert.notEqual(firstCount, secondCount);
  await until(modalOpen, 5000);
  assert.equal(await evaluate("window.__pushTest.calls"), 0);
  const metrics = await evaluate(`({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth,
    labels: Array.from(document.querySelectorAll('dt')).map(el => { const s = getComputedStyle(el); return { color: s.color, size: parseFloat(s.fontSize), weight: s.fontWeight }; }),
    gold: Array.from(document.querySelectorAll('dd')).every(el => getComputedStyle(el).color === 'rgb(241, 206, 104)'),
    brand: /CR Connect|CR Reparador/i.test(document.body.innerText) })`);
  assert.equal(metrics.scrollWidth, 390);
  assert.equal(metrics.brand, false);
  assert.equal(metrics.gold, true);
  assert.equal(metrics.labels.length, 6);
  for (const label of metrics.labels) { assert.equal(label.color, "rgb(255, 255, 255)"); assert.ok(label.size >= 12); assert.ok(Number(label.weight) >= 700); }
  await writeFile(path.join(process.cwd(), ".tmp-bolao-modal.png"), Buffer.from((await command("Page.captureScreenshot", { format: "png" })).data, "base64"));
  await click("AGORA NÃO");
  assert.equal(await evaluate(modalOpen), false);
  assert.equal(await evaluate("window.__pushTest.calls"), 0);
  await evaluate("document.querySelector('dt').scrollIntoView({block:'center'})");
  await writeFile(path.join(process.cwd(), ".tmp-bolao-labels.png"), Buffer.from((await command("Page.captureScreenshot", { format: "png" })).data, "base64"));
  for (const width of [320, 360, 768]) {
    await command("Emulation.setDeviceMetricsOverride", { width, height: 844, deviceScaleFactor: 1, mobile: true });
    assert.equal(await evaluate("document.documentElement.scrollWidth"), width);
  }
  await command("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await navigate("/bolao");
  await sleep(5500);
  assert.equal(await evaluate(modalOpen), false);
  results.push("390px: labels white/bold/larger; values gold; countdown ticking; 5s modal; no native permission before opt-in; dismissal persists");

  await clearStorage();
  await navigate("/bolao");
  await until(modalOpen);
  await click("🔔 QUERO RECEBER LEMBRETES");
  await until("document.querySelector('dialog')?.innerText.includes('✅ LEMBRETES ATIVADOS')");
  assert.equal(await evaluate("window.__pushTest.calls"), 1);
  assert.equal(apiRegisters, 1);
  assert.ok(await evaluate("window.__pushTest.registrations.some(r => r.url === '/bolao-sw.js' && r.scope === '/bolao')"));
  await click("FECHAR");
  await navigate("/bolao");
  await sleep(5500);
  assert.equal(await evaluate(modalOpen), false);
  assert.ok(await evaluate("document.body.innerText.includes('✅ LEMBRETES ATIVADOS')"));
  await click("DESATIVAR LEMBRETES", false);
  await until("localStorage.getItem('bolao-2026-push-consent') === null");
  assert.equal(apiDeletes, 1);
  assert.equal(await evaluate("window.__pushTest.unsubscribed"), 1);
  results.push("Opt-in: permission once; subscription and consent registered; reload active; opt-out deletes backend and unsubscribes only bolao worker");

  await clearStorage();
  await scenario("unsupported");
  await navigate("/bolao");
  await until(modalOpen);
  assert.ok(await evaluate("document.querySelector('dialog').innerText.includes('não estão disponíveis neste navegador')"));
  assert.equal(await evaluate("window.__pushTest.calls"), 0);
  results.push("Unsupported browser: friendly fallback, no native permission request");

  await clearStorage();
  await scenario("denied");
  await navigate("/bolao");
  await until(modalOpen);
  const registeredBeforeDenial = apiRegisters;
  await click("🔔 QUERO RECEBER LEMBRETES");
  await until("document.querySelector('dialog')?.innerText.includes('não foram autorizadas')");
  assert.equal(apiRegisters, registeredBeforeDenial);
  assert.equal(await evaluate("window.__pushTest.calls"), 1);
  results.push("Denied permission: friendly explanation, no subscription registration");

  await clearStorage();
  await scenario("unavailable");
  await navigate("/bolao");
  await until(modalOpen);
  assert.ok(await evaluate("document.querySelector('dialog').innerText.includes('temporariamente indisponíveis')"));
  assert.equal(await evaluate("window.__pushTest.calls"), 0);
  results.push("Missing backend configuration: friendly fallback and no pointless permission request");

  await clearStorage();
  await scenario("after");
  await navigate("/bolao");
  await sleep(5500);
  assert.equal(await evaluate(modalOpen), false);
  const opening = await evaluate("({label: document.querySelector('[aria-labelledby=\"countdown-title\"] [aria-live]').getAttribute('aria-label'), href: document.querySelector('a[href^=\"https://wa.me\"]')?.href})");
  assert.match(opening.label, /^0 dias, 0 horas, 0 minutos e 0 segundos$/);
  assert.equal(opening.href, "https://wa.me/5513991320205?text=" + encodeURIComponent("Olá! Quero participar do Bolão Mega da Virada 2026 🍀"));
  results.push("After opening: zero counter, original WhatsApp link, no reminder prompt");

  await scenario();
  await navigate("/mega-virada-2026");
  await sleep(5500);
  assert.equal(await evaluate(modalOpen), false);
  assert.ok(await evaluate("parseFloat(getComputedStyle(document.querySelector('dt')).fontSize) < 12"));
  results.push("Original long route unchanged: original labels and no reminder modal");

  await command("Page.removeScriptToEvaluateOnNewDocument", { identifier: bootstrapId });
  bootstrapId = null;
  await clearStorage();
  await navigate("/bolao");
  await command("Browser.grantPermissions", { origin: base, permissions: ["notifications"] });
  const workerCheck = await evaluate(`(async () => {
    const registration = await navigator.serviceWorker.register('/bolao-sw.js', { scope: '/bolao' });
    for (let i = 0; i < 100 && registration.active?.state !== 'activated'; i++) await new Promise(r => setTimeout(r, 50));
    await registration.showNotification('Teste local Mega da Virada', { body: 'Teste local do worker, não é push remoto.', tag: 'local-worker-test', data: { url: '/bolao' } });
    await registration.showNotification('Teste local Mega da Virada', { body: 'Mesma tag.', tag: 'local-worker-test', data: { url: '/bolao' } });
    const notifications = await registration.getNotifications({ tag: 'local-worker-test' });
    const result = { scope: registration.scope, count: notifications.length, url: notifications[0]?.data.url };
    for (const notification of notifications) notification.close();
    return result;
  })()`);
  assert.equal(workerCheck.scope, base + "/bolao");
  assert.equal(workerCheck.count, 1);
  assert.equal(workerCheck.url, "/bolao");
  results.push("Real local Service Worker registered with /bolao scope; local notification available; same tag replaces previous notification (remote push still requires real-device test)");
  console.log(JSON.stringify({ passed: results, metrics }, null, 2));
} finally {
  if (command && socket?.readyState === WebSocket.OPEN) {
    try { await command("Browser.close"); } catch { /* browser may close before acknowledgement */ }
  }
  if (socket) socket.close();
  chrome.kill();
  await sleep(1000);
  if (path.resolve(profile).startsWith(path.resolve(profilePrefix))) {
    await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 500 }).catch(() => {});
  }
}
