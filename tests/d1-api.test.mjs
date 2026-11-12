import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Miniflare } from 'miniflare';
import { handleApi } from '../src/lib/d1/http.ts';
import { hash, sessionUser } from '../src/lib/d1/service.ts';
const origin='https://cr.example';
let mf, db;
const sessions={a:'a'.repeat(64),b:'b'.repeat(64),mechanic:'c'.repeat(64)};
const delivery=[];
const send=async(email,link)=>delivery.push({email,link});
function request(path,{method='GET',body,user='a',originHeader=origin,headers={}}={}){
  return new Request(`${origin}/api/cr/${path}`,{method,headers:{origin:originHeader,'cf-connecting-ip':'192.0.2.1',...(user?{cookie:`__Host-cr_session=${sessions[user]}`} : {}),...(body?{'content-type':'application/json'}:{}),...headers},body:body?JSON.stringify(body):undefined});
}
const api=(path,options,mail=send)=>handleApi(request(path,options),{DB:db,APP_ORIGIN:origin},mail);
before(async()=>{
  mf=new Miniflare({workers:[{config:{name:'test',compatibilityDate:'2026-11-12',manifest:{mainModule:'worker.js',modules:{'worker.js':{type:'esm',contents:'export default {fetch(){return new Response("ok")}}'}}},env:{DB:{type:'d1',id:'test-db',name:'test-db'}}}}]});
  db=await mf.getD1Database('DB');
  for(const name of ['0001_identity','0002_core','0003_password_auth']) { const sql=await readFile(new URL(`../d1/migrations/${name}.sql`,import.meta.url),'utf8'); await db.batch(sql.replace(/^--.*$/gm,'').split(';').map(s=>s.trim()).filter(Boolean).map(s=>db.prepare(s))); }
  await db.exec(`INSERT INTO app_users(id,email) VALUES ('a','a@example.com'),('b','b@example.com'),('mechanic','m@example.com');
    INSERT INTO workshops(id,name) VALUES ('wa','Oficina A'),('wb','Oficina B');
    INSERT INTO workshop_users(workshop_id,user_id,role) VALUES ('wa','a','admin'),('wb','b','admin'),('wa','mechanic','mechanic');
    INSERT INTO clients(id,workshop_id,full_name) VALUES ('ca','wa','Cliente A'),('cb','wb','Cliente B');`);
  for(const [id,raw] of Object.entries(sessions))await db.prepare('INSERT INTO auth_sessions(token_hash,user_id,expires_at) VALUES (?,?,?)').bind(await hash(raw),id,Math.floor(Date.now()/1000)+3600).run();
});
after(async()=>mf?.dispose());
test('anonymous requests cannot read workshop data',async()=>{
  assert.equal((await api('clients?workshop_id=wa',{user:null})).status,401);
});
test('cross-workshop list, insert, update and delete are rejected',async()=>{
  for(const [method,path,body] of [['GET','clients',null],['POST','clients',{full_name:'Intruso'}],['PATCH','clients/cb',{full_name:'Intruso'}],['DELETE','clients/cb',null]]){
    assert.equal((await api(`${path}?workshop_id=wb`,{method,body})).status,403);
  }
  assert.equal((await db.prepare("SELECT full_name FROM clients WHERE id='cb'").first()).full_name,'Cliente B');
});
test('record ID alone never overrides workshop scope',async()=>{
  assert.equal((await api('clients/cb?workshop_id=wa',{method:'PATCH',body:{full_name:'Tentativa'}})).status,404);
  assert.equal((await api('clients/cb?workshop_id=wa',{method:'DELETE'})).status,404);
});
test('mechanic can read but cannot change customers',async()=>{
  assert.equal((await api('clients?workshop_id=wa',{user:'mechanic'})).status,200);
  assert.equal((await api('clients?workshop_id=wa',{user:'mechanic',method:'POST',body:{full_name:'Teste'}})).status,403);
});
test('customer CRUD uses prepared values and ignores caller identities',async()=>{
  const name="Cliente '; DROP TABLE clients; --";
  const created=await api('clients?workshop_id=wa',{method:'POST',body:{full_name:name,workshop_id:'wb',user_id:'b'}});
  assert.equal(created.status,201);const id=(await created.json()).data.id;
  const row=await db.prepare('SELECT full_name,workshop_id FROM clients WHERE id=?').bind(id).first();
  assert.deepEqual(row,{full_name:name,workshop_id:'wa'});
  assert.equal((await api(`clients/${id}?workshop_id=wa`,{method:'PATCH',body:{full_name:'Cliente editado'}})).status,200);
  assert.equal((await api(`clients/${id}?workshop_id=wa`,{method:'DELETE'})).status,200);
});
test('vehicle cannot reference a customer in another workshop',async()=>{
  const response=await api('vehicles?workshop_id=wa',{method:'POST',body:{client_id:'cb',brand:'Renault',model:'Fluence'}});
  assert.equal(response.status,409);
});
test('vehicle CRUD preserves reminders and same-workshop joins',async()=>{
  const body={client_id:'ca',brand:'Renault',model:'Fluence',plate:'abc-1234',mileage:100000,timing_belt_reminder_at:'2028-01-01'};
  const created=await api('vehicles?workshop_id=wa',{method:'POST',body});assert.equal(created.status,201);
  const id=(await created.json()).data.id;
  const response=await api('vehicles?workshop_id=wa');const rows=(await response.json()).data;
  assert.equal(rows.find(row=>row.id===id).clients.full_name,'Cliente A');
  assert.equal(rows.find(row=>row.id===id).plate,'ABC1234');
  assert.equal(rows.find(row=>row.id===id).timing_belt_reminder_at,'2028-01-01');
  assert.equal((await api('clients/ca?workshop_id=wa',{method:'DELETE'})).status,409);
  assert.equal((await api(`vehicles/${id}?workshop_id=wa`,{method:'DELETE'})).status,200);
});
test('invalid data, malformed JSON, oversized bodies and arbitrary resources fail',async()=>{
  assert.equal((await api('vehicles?workshop_id=wa',{method:'POST',body:{client_id:'ca',brand:'Ford',model:'Ka',mileage:-1}})).status,400);
  assert.equal((await api('vehicles?workshop_id=wa',{method:'POST',body:{client_id:'ca',brand:'Ford',model:'Ka',timing_belt_reminder_at:'2027-02-30'}})).status,400);
  assert.equal((await api('clients?workshop_id=wa',{method:'POST',body:{full_name:'x'.repeat(20000)}})).status,413);
  assert.equal((await api('app_users?workshop_id=wa')).status,404);
  assert.equal((await handleApi(new Request(`${origin}/api/cr/clients?workshop_id=wa`,{method:'POST',headers:{origin,'content-type':'application/json',cookie:`__Host-cr_session=${sessions.a}`},body:'{bad'}),{DB:db,APP_ORIGIN:origin},send)).status,400);
});
test('cross-origin writes and a wrong configured host fail closed',async()=>{
  assert.equal((await api('clients?workshop_id=wa',{method:'POST',body:{full_name:'Teste'},originHeader:'https://attacker.example'})).status,403);
  assert.equal((await handleApi(request('me'),{DB:db,APP_ORIGIN:'https://wrong.example'},send)).status,403);
  assert.equal((await handleApi(request('me'),{DB:db},send)).status,503);
});
test('email login is bound to browser, only stores hashes and consumes once atomically',async()=>{
  const response=await api('auth/request',{method:'POST',user:null,body:{email:'New@Example.com'}});assert.equal(response.status,200);
  const browser=response.headers.get('set-cookie').split(';')[0];
  const raw=new URL(delivery.at(-1).link).hash.slice('#token='.length);
  const stored=await db.prepare('SELECT token_hash,email FROM auth_email_tokens WHERE token_hash=?').bind(await hash(raw)).first();
  assert.equal(stored.email,'new@example.com');assert.notEqual(stored.token_hash,raw);
  const wrong=await api('auth/confirm',{method:'POST',user:null,headers:{cookie:'__Host-cr_login='+'f'.repeat(64)},body:{token:raw}});assert.equal(wrong.status,400);
  const responses=await Promise.all([0,1].map(()=>api('auth/confirm',{method:'POST',user:null,headers:{cookie:browser},body:{token:raw}})));
  assert.deepEqual(responses.map(r=>r.status).sort(),[200,400]);
  const ok=responses.find(r=>r.status===200);const session=ok.headers.getSetCookie().find(value=>value.startsWith('__Host-cr_session='));
  assert.match(session,/HttpOnly/);assert.match(session,/Secure/);assert.match(session,/SameSite=Lax/);
  const rawSession=session.split(';')[0].split('=')[1];
  assert.equal((await sessionUser(db,rawSession)).email,'new@example.com');
  const logout=await api('auth/logout',{method:'POST',user:null,headers:{cookie:`__Host-cr_session=${rawSession}`}});assert.equal(logout.status,200);
  assert.equal(await sessionUser(db,rawSession),null);
});
test('expired login links cannot create users or sessions',async()=>{
  const raw='d'.repeat(64), browser='e'.repeat(64);
  await db.prepare('INSERT INTO auth_email_tokens(token_hash,email,expires_at,browser_hash) VALUES (?,?,?,?)').bind(await hash(raw),'expired@example.com',1,await hash(browser)).run();
  assert.equal((await api('auth/confirm',{method:'POST',user:null,headers:{cookie:`__Host-cr_login=${browser}`},body:{token:raw}})).status,400);
  assert.equal(await db.prepare("SELECT id FROM app_users WHERE email='expired@example.com'").first(),null);
});
test('mail delivery failures never report a successful send',async()=>{
  const response=await api('auth/request',{method:'POST',user:null,body:{email:'failure@example.com'}},async()=>{throw Error('provider down');});
  assert.equal(response.status,503);
  assert.equal((await db.prepare("SELECT count(*) AS n FROM auth_email_tokens WHERE email='failure@example.com'").first()).n,0);
});
test('email rate limit survives repeated requests',async()=>{
  const statuses=[];
  for(let i=0;i<6;i++)statuses.push((await api('auth/request',{method:'POST',user:null,body:{email:'limited@example.com'}})).status);
  assert.deepEqual(statuses,[200,200,200,200,200,429]);
});
test('workshop onboarding always assigns the authenticated user',async()=>{
  const raw='9'.repeat(64);
  await db.prepare("INSERT INTO app_users(id,email) VALUES ('fresh','fresh@example.com')").run();
  await db.prepare('INSERT INTO auth_sessions(token_hash,user_id,expires_at) VALUES (?,?,?)').bind(await hash(raw),'fresh',Math.floor(Date.now()/1000)+3600).run();
  const result=await api('workshops',{method:'POST',user:null,headers:{cookie:`__Host-cr_session=${raw}`},body:{name:'Nova oficina',phone:'13999999999',user_id:'b',role:'inventory'}});
  assert.equal(result.status,201);const id=(await result.json()).data.workshop_id;
  assert.deepEqual(await db.prepare('SELECT user_id,role FROM workshop_users WHERE workshop_id=?').bind(id).first(),{user_id:'fresh',role:'admin'});
});

test('concurrent onboarding cannot create two initial workshops',async()=>{
  const user={id:'race',email:'race@example.com'};
  await db.prepare('INSERT INTO app_users(id,email) VALUES (?,?)').bind(user.id,user.email).run();
  const {createWorkshop}=await import('../src/lib/d1/service.ts');
  const results=await Promise.allSettled([1,2].map(()=>createWorkshop(db,user,{name:'Oficina concorrente',phone:'13999999999'})));
  assert.equal(results.filter(result=>result.status==='fulfilled').length,1);
  assert.equal((await db.prepare("SELECT count(*) AS n FROM workshops WHERE creator_user_id='race'").first()).n,1);
});

test('expired sessions cannot authorize data access',async()=>{
  const raw='8'.repeat(64);
  await db.prepare('INSERT INTO auth_sessions(token_hash,user_id,expires_at) VALUES (?,?,?)').bind(await hash(raw),'a',1).run();
  assert.equal(await sessionUser(db,raw),null);
  assert.equal((await api('clients?workshop_id=wa',{user:null,headers:{cookie:`__Host-cr_session=${raw}`}})).status,401);
});

const passwordEnv=()=>({DB:db,APP_ORIGIN:origin,AUTH_METHOD:'password',PASSWORD_PEPPER:'local-test-pepper-that-is-long-enough-1234'});
const pwApi=(op,body,headers={})=>handleApi(request(`auth/password/${op}`,{method:'POST',user:null,body,headers}),passwordEnv(),send);
test('password registration, login and recovery never store plaintext secrets',async()=>{
  const address='password@example.com',password='my unique password 123';
  const registered=await pwApi('register',{email:address,password});assert.equal(registered.status,201);
  const code=(await registered.json()).data.recoveryCode;assert.equal(code.length,64);
  const stored=await db.prepare('SELECT p.*,u.email_verified_at FROM auth_passwords p JOIN app_users u ON u.id=p.user_id WHERE u.email=?').bind(address).first();
  assert.notEqual(stored.password_hash,password);assert.notEqual(stored.recovery_hash,code);assert.equal(stored.email_verified_at,null);
  assert.equal((await pwApi('login',{email:address.toUpperCase(),password})).status,200);
  assert.equal((await pwApi('login',{email:address,password:'wrong password 123'})).status,401);
  assert.equal((await pwApi('register',{email:address,password:'another password 123'})).status,409);
  const oldCookie=registered.headers.get('set-cookie').split(';')[0];
  assert.equal((await pwApi('reset',{email:address,password:'replacement password 123',recoveryCode:'f'.repeat(64)})).status,401);
  const reset=await pwApi('reset',{email:address,password:'replacement password 123',recoveryCode:code});assert.equal(reset.status,200);
  assert.notEqual((await reset.json()).data.recoveryCode,code);
  assert.equal((await handleApi(request('me',{user:null,headers:{cookie:oldCookie}}),passwordEnv(),send)).status,401);
  assert.equal((await pwApi('reset',{email:address,password:'other replacement 123',recoveryCode:code})).status,401);
  assert.equal((await pwApi('login',{email:address,password})).status,401);
  assert.equal((await pwApi('login',{email:address,password:'replacement password 123'})).status,200);
});
test('password validation, missing pepper, unknown accounts and disabled email links fail closed',async()=>{
  assert.equal((await pwApi('register',{email:'weak@example.com',password:'short'})).status,400);
  assert.equal((await pwApi('login',{email:'missing@example.com',password:'a long test password'})).status,401);
  assert.equal((await handleApi(request('auth/password/register',{method:'POST',user:null,body:{email:'config@example.com',password:'a long test password'}}),{DB:db,APP_ORIGIN:origin},send)).status,503);
  assert.equal((await handleApi(request('auth/request',{method:'POST',user:null,body:{email:'disabled@example.com'}}),passwordEnv(),send)).status,404);
});
