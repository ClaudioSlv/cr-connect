export type BolaoSubscription = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
};

// Public registration must never turn the sender into an arbitrary URL fetcher.
export function validPushEndpoint(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 4096) return false;
  try {
    const url = new URL(value);
    const host = url.hostname;
    return (
      url.protocol === "https:" &&
      !url.username && !url.password && !url.hash &&
      (!url.port || url.port === "443") &&
      (host === "fcm.googleapis.com" ||
        host === "updates.push.services.mozilla.com" ||
        host.endsWith(".push.services.mozilla.com") ||
        host === "web.push.apple.com" ||
        host.endsWith(".push.apple.com") ||
        host.endsWith(".notify.windows.com"))
    );
  } catch {
    return false;
  }
}

function validKey(value: unknown, bytes: number) {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]+={0,2}$/.test(value)) return false;
  const unpadded = value.replace(/=+$/, "");
  return Math.floor(unpadded.length * 6 / 8) === bytes;
}

export function parseSubscription(value: unknown): BolaoSubscription | null {
  if (!value || typeof value !== "object") return null;
  const input = value as Record<string, unknown>;
  const keys = input.keys as Record<string, unknown> | undefined;
  if (!validPushEndpoint(input.endpoint) || !keys ||
      !validKey(keys.p256dh, 65) || !validKey(keys.auth, 16)) return null;
  return {
    endpoint: input.endpoint,
    keys: { p256dh: keys.p256dh as string, auth: keys.auth as string },
  };
}

export function validManagementToken(token: unknown): token is string {
  return typeof token === "string" && /^[a-f0-9]{64}$/.test(token);
}

export function sameOriginRequest(request: Request) {
  const origin = request.headers.get("origin");
  return origin === new URL(request.url).origin &&
    request.headers.get("sec-fetch-site") !== "cross-site";
}
