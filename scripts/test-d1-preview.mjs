import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { createHash, randomBytes } from 'node:crypto';
import assert from 'node:assert/strict';
const root=new URL('../',import.meta.url).pathname;
const origin='http://127.0.0.1:3190';
const child=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','3190'],{cwd:root,detached:true,stdio:['ignore','pipe','pipe']});
let logs='';for(const pipe of [child.stdout,child.stderr])pipe.on('data',value=>logs+=value);

try{
  let ready=false;
  for(let i=0;i<120;i++){
    if(child.exitCode!==null)throw Error(logs.slice(-3000));
    try{const r=await fetch(`${origin}/login`);if(r.ok){assert.match(await r.text(),/Receba um link seguro/);ready=true;break;}}catch{}
    await new Promise(resolve=>setTimeout(resolve,250));
  }
  assert.ok(ready,logs.slice(-3000));
  // Local Explorer is available only in the local preview. No remote data used.
  const base=`${origin}/cdn-cgi/local/explorer/api`;
  const databases=await (await fetch(`${base}/d1/database`)).json();
  const id=databases.result[0].uuid;
  async function sql(query){
    const r=await fetch(`${base}/d1/database/${id}/raw`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({sql:query})});
    const result=await r.json();assert.ok(r.ok&&result.success,JSON.stringify(result));return result;
  }
  // A separate persistence directory is supplied by CR_BROWSER_TEST.
  for(const name of ['0001_identity','0002_core']) await sql(await readFile(new URL(`../d1/migrations/${name}.sql`,import.meta.url),'utf8'));
  const raw=randomBytes(32).toString('hex'); const hash=createHash('sha256').update(raw).digest('hex');
  await sql(`INSERT INTO app_users(id,email) VALUES ('browser-test','browser@example.com');
    INSERT INTO profiles(id,full_name) VALUES ('browser-test','Teste local');
    INSERT INTO workshops(id,name,phone) VALUES ('browser-workshop','Oficina de teste','13999999999');
    INSERT INTO workshop_users(workshop_id,user_id,role) VALUES ('browser-workshop','browser-test','admin');
    INSERT INTO auth_sessions(token_hash,user_id,expires_at) VALUES ('${hash}','browser-test',${Math.floor(Date.now()/1000)+3600});`);
  const headers={cookie:`cr_session_local=${raw}`};
  const anonymous=await fetch(`${origin}/app`,{redirect:'manual'});assert.equal(anonymous.status,307);assert.match(anonymous.headers.get('location'),/login/);
  for(const [path,label] of [['/app','Visão geral'],['/app/clientes','Clientes'],['/app/veiculos','Veículos']]){
    const result=await fetch(origin+path,{headers});assert.equal(result.status,200);assert.ok((await result.text()).includes(label),path);
  }
  const payload={full_name:'Cliente do teste',email:'cliente@example.com'};
  const customer=await fetch(`${origin}/api/cr/clients?workshop_id=browser-workshop`,{method:'POST',headers:{...headers,origin,'content-type':'application/json'},body:JSON.stringify(payload)});
  assert.equal(customer.status,201);const customerId=(await customer.json()).data.id;
  const vehicle=await fetch(`${origin}/api/cr/vehicles?workshop_id=browser-workshop`,{method:'POST',headers:{...headers,origin,'content-type':'application/json'},body:JSON.stringify({client_id:customerId,brand:'Renault',model:'Fluence'})});assert.equal(vehicle.status,201);
  const list=await fetch(`${origin}/api/cr/vehicles?workshop_id=browser-workshop`,{headers});assert.equal((await list.json()).data[0].clients.full_name,'Cliente do teste');
  const dashboard=await (await fetch(`${origin}/app`,{headers})).text();assert.match(dashboard,/Clientes cadastrados/);assert.match(dashboard,/Veículos cadastrados/);
  const logout=await fetch(`${origin}/api/cr/auth/logout`,{method:'POST',headers:{...headers,origin}});assert.equal(logout.status,200);
  const me=await fetch(`${origin}/api/cr/me`,{headers});assert.equal(me.status,401);
  const mail=await fetch(`${origin}/api/cr/auth/request`,{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify({email:'failure@example.com'})});assert.equal(mail.status,503);assert.match((await mail.json()).error.message,/e-mail não pôde ser enviado/);
  console.log('PASS: production Worker HTTP preview, protected pages, D1 customer/vehicle flow, logout and honest missing-email-provider failure');

}finally{
try{process.kill(-child.pid,'SIGTERM');}catch{}
}
