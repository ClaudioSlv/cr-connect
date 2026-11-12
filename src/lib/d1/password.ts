import { ApiError, cookie, cookieName, email, hash, SESSION_LIFETIME, token, type Database } from './service.ts';
import { rateLimit } from './auth.ts';
const ITERATIONS=100000;
const encoder=new TextEncoder();
function password(value:unknown) {
  if(typeof value!=='string'||value.length<12||value.length>128)throw new ApiError(400,'Use uma senha com 12 a 128 caracteres.');
  return value;
}
async function keyed(value:string,pepper:string){
  const key=await crypto.subtle.importKey('raw',encoder.encode(pepper),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC',key,encoder.encode(value)));
}
async function digest(value:string,salt:string,pepper:string,iterations=ITERATIONS){
  // Workers limits PBKDF2 to 100k iterations. A separate HMAC pepper protects
  // password hashes even if a database export is exposed without Worker secrets.
  const bytes=await keyed(value,pepper);
  const key=await crypto.subtle.importKey('raw',bytes,'PBKDF2',false,['deriveBits']);
  const bits=await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt:encoder.encode(salt),iterations},key,256);
  return Array.from(new Uint8Array(bits),b=>b.toString(16).padStart(2,'0')).join('');
}
async function equal(value:string,expected:string){
  const key=await crypto.subtle.importKey('raw',encoder.encode(expected),{name:'HMAC',hash:'SHA-256'},false,['sign','verify']);
  const signature=await crypto.subtle.sign('HMAC',key,encoder.encode(value));
  return crypto.subtle.verify('HMAC',key,signature,encoder.encode(expected));
}
async function recoveryHash(value:string,pepper:string){return hash(Array.from(await keyed(`recovery:${value}`,pepper)).join(','));}
function configured(pepper?:string):asserts pepper is string{if(!pepper||pepper.length<32)throw new ApiError(503,'O acesso está sendo configurado.');}
async function limits(db:Database,request:Request,address:string,operation:string){
  const now=Math.floor(Date.now()/1000);
  await rateLimit(db,await hash(`password-ip:${request.headers.get('cf-connecting-ip')||'local'}`),50,600,now);
  await rateLimit(db,await hash(`password-${operation}:${address}`),10,900,now);
}
export async function passwordAuth(db:Database,request:Request,origin:string,body:Record<string,unknown>,operation:'register'|'login'|'reset',pepper?:string){
  configured(pepper);const address=email(body.email);await limits(db,request,address,operation);
  const plain=password(body.password);
  if(operation==='register'){
    const id=crypto.randomUUID(),salt=token(),rawSession=token(),recoveryCode=token();
    const [passwordHash,sessionHash,recovery]=await Promise.all([digest(plain,salt,pepper),hash(rawSession),recoveryHash(recoveryCode,pepper)]);
    try{await db.batch([
      db.prepare('INSERT INTO app_users(id,email) VALUES (?,?)').bind(id,address),
      db.prepare('INSERT INTO profiles(id) VALUES (?)').bind(id),
      db.prepare('INSERT INTO auth_passwords(user_id,salt,password_hash,iterations,recovery_hash) VALUES (?,?,?,?,?)').bind(id,salt,passwordHash,ITERATIONS,recovery),
      db.prepare('INSERT INTO auth_sessions(token_hash,user_id,expires_at) VALUES (?,?,?)').bind(sessionHash,id,Math.floor(Date.now()/1000)+SESSION_LIFETIME),
    ]);}catch(error){if(error instanceof Error&&error.message.includes('UNIQUE constraint failed: app_users.email'))throw new ApiError(409,'Não foi possível cadastrar este e-mail. Se você já tem conta, escolha Entrar.');throw error;}
    return {sessionCookie:cookie(origin,cookieName(origin),rawSession,SESSION_LIFETIME),recoveryCode};
  }
  const row=await db.prepare('SELECT u.id,p.salt,p.password_hash,p.iterations,p.recovery_hash FROM app_users u JOIN auth_passwords p ON p.user_id=u.id WHERE u.email=?').bind(address).first<{id:string;salt:string;password_hash:string;iterations:number;recovery_hash:string}>();
  if(operation==='reset'){
    const code=typeof body.recoveryCode==='string'?body.recoveryCode.trim().toLowerCase().replace(/[ -]/g,''):'';
    const supplied=await recoveryHash(code,pepper);
    if(!row||!/^[a-f0-9]{64}$/.test(code)||!await equal(supplied,row.recovery_hash))throw new ApiError(401,'E-mail ou código de recuperação inválido.');
    const salt=token(),nextCode=token(),rawSession=token();
    const [passwordHash,nextRecovery,sessionHash]=await Promise.all([digest(plain,salt,pepper),recoveryHash(nextCode,pepper),hash(rawSession)]);
    // Claim the recovery code atomically, then issue a session only if this
    // request owns the replacement hash. Concurrent replays cannot reset twice.
    const result=await db.batch([
      db.prepare("UPDATE auth_passwords SET salt=?,password_hash=?,iterations=?,recovery_hash=?,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE user_id=? AND recovery_hash=? RETURNING user_id").bind(salt,passwordHash,ITERATIONS,nextRecovery,row.id,row.recovery_hash),
      db.prepare('DELETE FROM auth_sessions WHERE user_id=? AND EXISTS(SELECT 1 FROM auth_passwords WHERE user_id=? AND recovery_hash=?)').bind(row.id,row.id,nextRecovery),
      db.prepare('INSERT INTO auth_sessions(token_hash,user_id,expires_at) SELECT ?,user_id,? FROM auth_passwords WHERE user_id=? AND recovery_hash=? RETURNING user_id').bind(sessionHash,Math.floor(Date.now()/1000)+SESSION_LIFETIME,row.id,nextRecovery),
    ]);
    if(!result[0].results.length)throw new ApiError(401,'Este código já foi utilizado.');
    return {sessionCookie:cookie(origin,cookieName(origin),rawSession,SESSION_LIFETIME),recoveryCode:nextCode};
  }
  const computed=await digest(plain,row?.salt||'0'.repeat(64),pepper,row?.iterations||ITERATIONS);
  const correct=await equal(computed,row?.password_hash||'0'.repeat(64));
  if(!row||!correct)throw new ApiError(401,'E-mail ou senha incorretos.');
  const rawSession=token();
  // Credential guard prevents a racing password reset from issuing an old-password session.
  const result=await db.prepare('INSERT INTO auth_sessions(token_hash,user_id,expires_at) SELECT ?,user_id,? FROM auth_passwords WHERE user_id=? AND password_hash=? RETURNING user_id').bind(await hash(rawSession),Math.floor(Date.now()/1000)+SESSION_LIFETIME,row.id,row.password_hash).first();
  if(!result)throw new ApiError(401,'Entre novamente com sua senha atual.');
  return {sessionCookie:cookie(origin,cookieName(origin),rawSession,SESSION_LIFETIME)};
}
