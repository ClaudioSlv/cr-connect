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
    try{const r=await fetch(`${origin}/login`);if(r.ok){assert.match(await r.text(),/Entre com seu e-mail e sua senha/);ready=true;break;}}catch{}
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
  for(const name of ['0001_identity','0002_core','0003_password_auth','0004_commerce']) await sql(await readFile(new URL(`../d1/migrations/${name}.sql`,import.meta.url),'utf8'));
  const raw=randomBytes(32).toString('hex'); const hash=createHash('sha256').update(raw).digest('hex');
  await sql(`INSERT INTO app_users(id,email) VALUES ('browser-test','browser@example.com');
    INSERT INTO profiles(id,full_name) VALUES ('browser-test','Teste local');
    INSERT INTO workshops(id,name,phone) VALUES ('browser-workshop','Oficina de teste','13999999999');
    INSERT INTO workshop_users(workshop_id,user_id,role) VALUES ('browser-workshop','browser-test','admin');
    INSERT INTO auth_sessions(token_hash,user_id,expires_at) VALUES ('${hash}','browser-test',${Math.floor(Date.now()/1000)+3600});`);
  const headers={cookie:`cr_session_local=${raw}`};
  const anonymous=await fetch(`${origin}/app`,{redirect:'manual'});assert.equal(anonymous.status,307);assert.match(anonymous.headers.get('location'),/login/);
  for(const [path,label] of [['/app','Visão geral'],['/app/clientes','Clientes'],['/app/veiculos','Veículos'],['/app/orcamentos','Orçamentos'],['/app/ordens','Ordens de serviço'],['/app/precificacao','Precificação de mão de obra']]){
    const result=await fetch(origin+path,{headers});assert.equal(result.status,200);assert.ok((await result.text()).includes(label),path);
  }
  const payload={full_name:'Cliente do teste',email:'cliente@example.com'};
  const customer=await fetch(`${origin}/api/cr/clients?workshop_id=browser-workshop`,{method:'POST',headers:{...headers,origin,'content-type':'application/json'},body:JSON.stringify(payload)});
  assert.equal(customer.status,201);const customerId=(await customer.json()).data.id;
  const vehicle=await fetch(`${origin}/api/cr/vehicles?workshop_id=browser-workshop`,{method:'POST',headers:{...headers,origin,'content-type':'application/json'},body:JSON.stringify({client_id:customerId,brand:'Renault',model:'Fluence'})});assert.equal(vehicle.status,201);const vehicleId=(await vehicle.json()).data.id;
  const list=await fetch(`${origin}/api/cr/vehicles?workshop_id=browser-workshop`,{headers});assert.equal((await list.json()).data[0].clients.full_name,'Cliente do teste');
  const dashboard=await (await fetch(`${origin}/app`,{headers})).text();assert.match(dashboard,/Clientes cadastrados/);assert.match(dashboard,/Veículos cadastrados/);
  async function commerce(path,body){const r=await fetch(`${origin}/api/cr/commerce/${path}`,{method:'POST',headers:{...headers,origin,'content-type':'application/json'},body:JSON.stringify(body)});const result=await r.json();assert.equal(r.status,200,JSON.stringify(result));return result.data;}
  const scope=[{column:'workshop_id',op:'eq',value:'browser-workshop'}];
  const budget=await commerce('query',{table:'budgets',action:'insert',filters:[],values:{workshop_id:'browser-workshop',client_id:customerId,vehicle_id:vehicleId},single:true});
  await commerce('query',{table:'budget_items',action:'insert',filters:[],values:[{workshop_id:'browser-workshop',budget_id:budget.id,kind:'service',description:'Montagem cabeçote',quantity:1,unit_price:700,discount:0}]});
  const rpc=(name,args)=>commerce('rpc',{name,args:{p_kind:'budget',p_id:budget.id,...args}});
  const terms=await rpc('get_document_payment_terms',{});assert.equal(terms.total,700);
  const saved=await rpc('save_document_payment_terms',{p_revision:terms.revision,p_method:'cash',p_terms:'Pagamento na entrega',p_percent:0,p_deferred:false,p_reason:''});
  await rpc('accept_document_payment_terms',{p_revision:saved.revision,p_total:700});
  await commerce('query',{table:'budgets',action:'update',filters:[...scope,{column:'id',op:'eq',value:budget.id}],values:{status:'approved'}});
  const order=await rpc('convert_budget',{});assert.ok(order.id);
  const items=await commerce('query',{table:'service_order_items',filters:[...scope,{column:'service_order_id',op:'eq',value:order.id}]});assert.equal(items[0].unit_price,700);
  const logout=await fetch(`${origin}/api/cr/auth/logout`,{method:'POST',headers:{...headers,origin}});assert.equal(logout.status,200);
  const me=await fetch(`${origin}/api/cr/me`,{headers});assert.equal(me.status,401);
  const registration=await fetch(`${origin}/api/cr/auth/password/register`,{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify({email:'new-browser@example.com',password:'local preview password 123'})});assert.equal(registration.status,201);
  const recovery=(await registration.json()).data.recoveryCode;assert.equal(recovery.length,64);
  const login=await fetch(`${origin}/api/cr/auth/password/login`,{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify({email:'new-browser@example.com',password:'local preview password 123'})});assert.equal(login.status,200);
  const reset=await fetch(`${origin}/api/cr/auth/password/reset`,{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify({email:'new-browser@example.com',password:'local changed password 123',recoveryCode:recovery})});assert.equal(reset.status,200);
  console.log('PASS: production Worker HTTP preview, protected pages, D1 records, budget/acceptance/O.S. flow, logout, password registration, login and recovery');

}finally{
try{process.kill(-child.pid,'SIGTERM');}catch{}
}
