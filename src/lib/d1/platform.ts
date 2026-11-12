import 'server-only';
import { cookies } from 'next/headers';
import { cookieName, membership, sessionUser } from './service';

export const d1Enabled = () => process.env.CR_BACKEND === 'd1';
export async function platform() {
  const { env } = await import(/* webpackIgnore: true */ 'cloudflare:workers');
  return env;
}
export async function currentUser() {
  const env = await platform();
  const store = await cookies();
  if (!env.APP_ORIGIN) throw new Error('APP_ORIGIN must be configured.');
  return sessionUser(env.DB,store.get(cookieName(env.APP_ORIGIN))?.value || '');
}
export async function currentMembership() {
  const user = await currentUser();
  if (!user) return null;
  const env = await platform();
  return membership(env.DB,user.id);
}
