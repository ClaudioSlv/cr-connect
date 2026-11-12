import type { ClientInput, ClientRecord, Membership, SessionUser, VehicleInput } from './contracts.ts';

export type Database = Pick<D1Database, 'prepare' | 'batch'>;
export class ApiError extends Error {
  status: number;
  code?: string;
  constructor(status: number, message: string, code?: string) { super(message); this.status=status; this.code=code; }
}
const DAY = 86400;
export const SESSION_COOKIE = '__Host-cr_session';
export const BROWSER_COOKIE = '__Host-cr_login';
export const LOCAL_SESSION_COOKIE = 'cr_session_local';
export const LOCAL_BROWSER_COOKIE = 'cr_login_local';
export const SESSION_LIFETIME = 7 * DAY;
export function secureCookies(origin: string) { return new URL(origin).protocol === 'https:'; }
export function cookieName(origin: string, browser = false) {
  return secureCookies(origin) ? (browser ? BROWSER_COOKIE : SESSION_COOKIE) : (browser ? LOCAL_BROWSER_COOKIE : LOCAL_SESSION_COOKIE);
}
export function readCookie(request: Request, name: string) {
  return request.headers.get('cookie')?.split(';').map(part => part.trim()).find(part => part.startsWith(`${name}=`))?.slice(name.length + 1) || '';
}
export function cookie(origin: string, name: string, value: string, maxAge: number) {
  return `${name}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secureCookies(origin) ? '; Secure' : ''}`;
}
export async function hash(value: string) {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))), byte => byte.toString(16).padStart(2, '0')).join('');
}
export function token() {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)), byte => byte.toString(16).padStart(2, '0')).join('');
}
export function requireSameOrigin(request: Request, origin: string) {
  if (request.headers.get('origin') !== origin || request.headers.get('sec-fetch-site') === 'cross-site') {
    throw new ApiError(403, 'Acesso não autorizado. Atualize a página e tente novamente.');
  }
}
export function requireOrigin(configured: string | undefined, request: Request) {
  if (!configured) throw new ApiError(503, 'O acesso está sendo configurado.');
  const url = new URL(configured);
  if (url.origin !== configured || (url.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(url.hostname))) throw new ApiError(503, 'O acesso está sendo configurado.');
  if (new URL(request.url).origin !== configured) throw new ApiError(403, 'Endereço de acesso inválido.');
  return configured;
}
export async function jsonBody(request: Request): Promise<Record<string, unknown>> {
  if (!request.headers.get('content-type')?.startsWith('application/json')) throw new ApiError(415, 'Formato inválido.');
  // Bound the stream even if Content-Length is missing or incorrect.
  const reader = request.body?.getReader();
  if (!reader) throw new ApiError(400, 'Dados não informados.');
  const chunks: Uint8Array[] = []; let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read(); if (done) break;
      size += value.length;
      if (size > 16384) { await reader.cancel(); throw new ApiError(413, 'Dados muito grandes.'); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  let body: unknown;
  try { body = JSON.parse(new TextDecoder().decode(bytes)); } catch { throw new ApiError(400, 'Dados inválidos.'); }
  if (!body || Array.isArray(body) || typeof body !== 'object') throw new ApiError(400, 'Dados inválidos.');
  return body as Record<string, unknown>;
}
export function text(value: unknown, field: string, max: number, required = false): string | null {
  if (value === undefined || value === null || value === '') { if (required) throw new ApiError(400, `Informe ${field}.`); return null; }
  if (typeof value !== 'string' || value.trim().length > max || (required && !value.trim())) throw new ApiError(400, `${field}: valor inválido.`);
  return value.trim() || null;
}
export function email(value: unknown) {
  const result = text(value, 'e-mail', 254, true)!.toLowerCase();
  if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(result)) throw new ApiError(400, 'Informe um e-mail válido.');
  return result;
}
function integer(value: unknown, field: string, min = 0, max = 2147483647) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max) throw new ApiError(400, `${field}: valor inválido.`);
  return value;
}
function date(value: unknown) {
  const result = text(value, 'data', 10);
  if (result && (!/^\d{4}-\d{2}-\d{2}$/.test(result) || Number.isNaN(Date.parse(`${result}T00:00:00Z`)) || new Date(`${result}T00:00:00Z`).toISOString().slice(0, 10) !== result)) throw new ApiError(400, 'Data inválida.');
  return result;
}
export async function sessionUser(db: Database, rawToken: string, now = Math.floor(Date.now() / 1000)): Promise<SessionUser | null> {
  if (!/^[a-f0-9]{64}$/.test(rawToken)) return null;
  return db.prepare('SELECT u.id,u.email FROM app_users u JOIN auth_sessions s ON s.user_id=u.id WHERE s.token_hash=? AND s.expires_at>?').bind(await hash(rawToken), now).first<SessionUser>();
}
export async function requireUser(db: Database, request: Request, origin: string) {
  const user = await sessionUser(db, readCookie(request, cookieName(origin)));
  if (!user) throw new ApiError(401, 'Entre novamente para continuar.');
  return user;
}
export async function membership(db: Database, userId: string, workshopId?: string): Promise<Membership | null> {
  return db.prepare(`SELECT w.id AS workshop_id,w.name,m.role FROM workshop_users m JOIN workshops w ON w.id=m.workshop_id WHERE m.user_id=?${workshopId ? ' AND w.id=?' : ''} ORDER BY m.created_at,w.id LIMIT 1`).bind(...(workshopId ? [userId, workshopId] : [userId])).first<Membership>();
}
export async function requireMembership(db: Database, userId: string, workshopId: string, write = false) {
  const member = await membership(db, userId, workshopId);
  if (!member) throw new ApiError(403, 'Você não tem acesso a esta oficina.');
  if (write && !['admin', 'attendant'].includes(member.role)) throw new ApiError(403, 'Seu perfil não permite alterar este cadastro.');
  return member;
}
export async function createWorkshop(db: Database, user: SessionUser, input: Record<string, unknown>) {
  const name = text(input.name, 'nome da oficina', 120, true)!;
  if (name.length < 2) throw new ApiError(400, 'Informe o nome da oficina.');
  const phone = text(input.phone, 'telefone', 40, true)!;
  const whatsapp = text(input.whatsapp, 'WhatsApp', 40);
  const workshopId = crypto.randomUUID();
  // Only the creator can acquire membership; both writes succeed or roll back.
  try { await db.batch([
    db.prepare('INSERT INTO workshops(id,name,phone,whatsapp,creator_user_id) VALUES (?,?,?,?,?)').bind(workshopId,name,phone,whatsapp,user.id),
    db.prepare("INSERT INTO workshop_users(workshop_id,user_id,role) VALUES (?,?,'admin')").bind(workshopId,user.id),
  ]); } catch (error) {
    if (error instanceof Error && error.message.includes('UNIQUE constraint failed: workshops.creator_user_id')) throw new ApiError(409,'Sua oficina já foi criada.');
    throw error;
  }
  return { workshop_id: workshopId, name, role: 'admin' };
}
export function clientInput(body: Record<string, unknown>): ClientInput {
  const full_name = text(body.full_name, 'nome', 200, true)!;
  if (full_name.length < 2) throw new ApiError(400, 'Informe o nome completo.');
  const document_number = text(body.document_number, 'documento', 30);
  if (document_number && !/^\d{1,20}$/.test(document_number)) throw new ApiError(400, 'Documento inválido.');
  return { full_name, document_number, phone: text(body.phone,'telefone',40), whatsapp: text(body.whatsapp,'WhatsApp',40), email: body.email ? email(body.email) : null, notes: text(body.notes,'observações',4000) };
}
export function vehicleInput(body: Record<string, unknown>): VehicleInput {
  const plate = text(body.plate, 'placa', 12)?.toUpperCase().replace(/[^A-Z0-9]/g, '') || null;
  return {
    client_id: text(body.client_id,'cliente',80,true)!, plate,
    brand: text(body.brand,'marca',120,true)!, model: text(body.model,'modelo',120,true)!,
    version: text(body.version,'versão',120), year_model: integer(body.year_model,'ano',1886,2200),
    fuel: text(body.fuel,'combustível',80), engine: text(body.engine,'motor',120), mileage: integer(body.mileage,'quilometragem'),
    notes: text(body.notes,'observações',4000), timing_belt_changed_at: date(body.timing_belt_changed_at),
    timing_belt_changed_mileage: integer(body.timing_belt_changed_mileage,'quilometragem da troca'),
    timing_belt_reminder_at: date(body.timing_belt_reminder_at), timing_belt_reminder_mileage: integer(body.timing_belt_reminder_mileage,'quilometragem do lembrete'),
  };
}
const clientColumns = ['full_name','document_number','phone','whatsapp','email','notes'] as const;
const vehicleColumns = ['client_id','plate','brand','model','version','year_model','fuel','engine','mileage','notes','timing_belt_changed_at','timing_belt_changed_mileage','timing_belt_reminder_at','timing_belt_reminder_mileage'] as const;
export type Resource = 'clients' | 'vehicles';
export async function listRecords(db: Database, userId: string, workshopId: string, resource: Resource) {
  await requireMembership(db,userId,workshopId);
  if (resource === 'clients') return (await db.prepare('SELECT id,workshop_id,full_name,document_number,phone,whatsapp,email,notes FROM clients WHERE workshop_id=? ORDER BY full_name LIMIT 1000').bind(workshopId).all<ClientRecord>()).results;
  const rows = (await db.prepare('SELECT v.*,c.full_name AS client_name FROM vehicles v JOIN clients c ON c.workshop_id=v.workshop_id AND c.id=v.client_id WHERE v.workshop_id=? ORDER BY v.created_at DESC LIMIT 1000').bind(workshopId).all<VehicleInput & {id:string;client_name:string}>()).results;
  return rows.map(({client_name,...row})=>({...row,clients:{id:row.client_id,full_name:client_name}}));
}
export async function saveRecord(db: Database, userId: string, workshopId: string, resource: Resource, body: Record<string, unknown>, id?: string) {
  await requireMembership(db,userId,workshopId,true);
  const data = resource === 'clients' ? clientInput(body) : vehicleInput(body);
  const columns = resource === 'clients' ? clientColumns : vehicleColumns;
  const values = columns.map(key => (data as unknown as Record<string,string|number|null>)[key]);
  // Table and column names come only from these closed server-side lists.
  const recordId = id || crypto.randomUUID();
  const statement = id
    ? db.prepare(`UPDATE ${resource} SET ${columns.map(key=>`${key}=?`).join(',')},updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=? AND workshop_id=? RETURNING id`).bind(...values,id,workshopId)
    : db.prepare(`INSERT INTO ${resource}(id,workshop_id,${columns.join(',')}) VALUES (${columns.map(()=>'?').concat(['?','?']).join(',')}) RETURNING id`).bind(recordId,workshopId,...values);
  const result = await statement.first<{id:string}>();
  if (!result) throw new ApiError(404, 'Cadastro não encontrado nesta oficina.');
  return result;
}
export async function deleteRecord(db: Database, userId: string, workshopId: string, resource: Resource, id: string) {
  await requireMembership(db,userId,workshopId,true);
  const row = await db.prepare(`DELETE FROM ${resource} WHERE id=? AND workshop_id=? RETURNING id`).bind(id,workshopId).first();
  if (!row) throw new ApiError(404,'Cadastro não encontrado nesta oficina.');
}
