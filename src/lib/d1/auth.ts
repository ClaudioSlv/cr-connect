import { ApiError, cookie, cookieName, email, hash, readCookie, SESSION_LIFETIME, token, type Database } from './service.ts';
import type { SessionUser } from './contracts.ts';

export type LoginMail = (email: string, link: string) => Promise<void>;
export async function rateLimit(db: Database, key: string, limit: number, window: number, now: number) {
  const row = await db.prepare(`INSERT INTO auth_rate_limits(key,count,resets_at) VALUES (?,1,?)
    ON CONFLICT(key) DO UPDATE SET count=CASE WHEN resets_at<=? THEN 1 ELSE count+1 END,
    resets_at=CASE WHEN resets_at<=? THEN ? ELSE resets_at END RETURNING count`).bind(key,now+window,now,now,now+window).first<{count:number}>();
  if (!row || row.count > limit) throw new ApiError(429,'Muitos pedidos de acesso. Aguarde alguns minutos e tente novamente.');
}
export async function requestLogin(db: Database, request: Request, origin: string, body: Record<string,unknown>, send: LoginMail) {
  const address = email(body.email); const now = Math.floor(Date.now()/1000);
  const ip = request.headers.get('cf-connecting-ip') || 'local';
  await rateLimit(db,await hash(`login-ip:${ip}`),20,600,now);
  await rateLimit(db,await hash(`login-email:${address}`),5,900,now);
  const browser = readCookie(request,cookieName(origin,true));
  const browserToken = /^[a-f0-9]{64}$/.test(browser) ? browser : token();
  const rawToken = token(); const tokenHash = await hash(rawToken);
  await db.prepare('INSERT INTO auth_email_tokens(token_hash,email,expires_at,browser_hash) VALUES (?,?,?,?)').bind(tokenHash,address,now+900,await hash(browserToken)).run();
  try { await send(address,`${origin}/auth/d1#token=${rawToken}`); }
  catch {
    await db.prepare('DELETE FROM auth_email_tokens WHERE token_hash=?').bind(tokenHash).run();
    throw new ApiError(503,'O e-mail não pôde ser enviado agora. Tente novamente em alguns minutos.');
  }
  await db.batch([
    db.prepare('DELETE FROM auth_email_tokens WHERE token_hash IN (SELECT token_hash FROM auth_email_tokens WHERE expires_at<=? LIMIT 100)').bind(now),
    db.prepare('DELETE FROM auth_sessions WHERE token_hash IN (SELECT token_hash FROM auth_sessions WHERE expires_at<=? LIMIT 100)').bind(now),
    db.prepare('DELETE FROM auth_rate_limits WHERE key IN (SELECT key FROM auth_rate_limits WHERE resets_at<=? LIMIT 100)').bind(now),
  ]);
  return cookie(origin,cookieName(origin,true),browserToken,900);
}
export async function consumeLogin(db: Database, request: Request, origin: string, raw: unknown) {
  const now = Math.floor(Date.now()/1000);
  await rateLimit(db,await hash(`verify-ip:${request.headers.get('cf-connecting-ip')||'local'}`),30,600,now);
  const browser = readCookie(request,cookieName(origin,true));
  if (typeof raw !== 'string' || !/^[a-f0-9]{64}$/.test(raw) || !/^[a-f0-9]{64}$/.test(browser)) throw new ApiError(400,'Abra o link no mesmo navegador em que solicitou o acesso.');
  const [tokenHash,browserHash] = await Promise.all([hash(raw),hash(browser)]);
  const rawSession = token(); const sessionHash = await hash(rawSession);
  // D1 batch executes in one transaction. A second consumer sees no email token.
  const results = await db.batch([
    db.prepare(`INSERT INTO app_users(id,email,email_verified_at)
      SELECT ?,email,strftime('%Y-%m-%dT%H:%M:%fZ','now') FROM auth_email_tokens
      WHERE token_hash=? AND browser_hash=? AND expires_at>? ON CONFLICT(email) DO NOTHING`).bind(crypto.randomUUID(),tokenHash,browserHash,now),
    db.prepare(`INSERT INTO profiles(id) SELECT u.id FROM app_users u JOIN auth_email_tokens t ON u.email=t.email
      WHERE t.token_hash=? AND t.browser_hash=? AND t.expires_at>? ON CONFLICT(id) DO NOTHING`).bind(tokenHash,browserHash,now),
    db.prepare(`INSERT INTO auth_sessions(token_hash,user_id,expires_at) SELECT ?,u.id,? FROM app_users u
      JOIN auth_email_tokens t ON u.email=t.email WHERE t.token_hash=? AND t.browser_hash=? AND t.expires_at>? RETURNING user_id`).bind(sessionHash,now+SESSION_LIFETIME,tokenHash,browserHash,now),
    db.prepare('DELETE FROM auth_email_tokens WHERE token_hash=? AND browser_hash=? AND expires_at>?').bind(tokenHash,browserHash,now),
  ]);
  if (!results[2].results.length) throw new ApiError(400,'Este link venceu ou já foi usado. Solicite um novo acesso.');
  return { sessionCookie:cookie(origin,cookieName(origin),rawSession,SESSION_LIFETIME), browserCookie:cookie(origin,cookieName(origin,true),'',0) };
}
export async function signOut(db: Database, request: Request, origin: string) {
  const raw = readCookie(request,cookieName(origin));
  if (raw) await db.prepare('DELETE FROM auth_sessions WHERE token_hash=?').bind(await hash(raw)).run();
  return cookie(origin,cookieName(origin),'',0);
}
export async function getProfile(db: Database, user: SessionUser) {
  return db.prepare('SELECT full_name FROM profiles WHERE id=?').bind(user.id).first<{full_name:string|null}>();
}
