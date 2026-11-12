import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Miniflare} from 'miniflare';
import {handleApi} from '../src/lib/d1/http.ts';
import {hash} from '../src/lib/d1/service.ts';
const origin='https://cr.example';let mf,db;
const tokens={a:'a'.repeat(64),b:'b'.repeat(64),m:'c'.repeat(64)};
const api=async(type,payload,user='a')=>{const r=await handleApi(new Request(`${origin}/api/cr/commerce/${type}`,{method:'POST',headers:{origin,'content-type':'application/json',cookie:`__Host-cr_session=${tokens[user]||''}`},body:JSON.stringify(payload)}),{DB:db,APP_ORIGIN:origin},async()=>{});return {status:r.status,...await r.json()};};
const q=(table,action,values,filters=[],user='a')=>api('query',{table,action,values,filters,single:action==='insert'},user);
const eq=(column,value)=>({column,op:'eq',value});
const rpc=(name,args,user='a')=>api('rpc',{name,args},user);
before(async()=>{
 mf=new Miniflare({workers:[{config:{name:'commerce-test',compatibilityDate:'2026-11-12',manifest:{mainModule:'worker.js',modules:{'worker.js':{type:'esm',contents:'export default {fetch(){return new Response("ok")}}'}}},env:{DB:{type:'d1',id:'commerce-db',name:'commerce-db'}}}}]});db=await mf.getD1Database('DB');
 for(const name of ['0001_identity','0002_core','0003_password_auth','0004_commerce']){
  let sql=await readFile(new URL(`../d1/migrations/${name}.sql`,import.meta.url),'utf8');const triggers=[];sql=sql.replace(/CREATE TRIGGER[\s\S]*?END;/g,s=>{triggers.push(s);return '';});
  const statements=sql.replace(/^--.*$/gm,'').split(';').map(s=>s.trim()).filter(Boolean).concat(triggers);await db.batch(statements.map(s=>db.prepare(s)));
 }
 await db.exec("INSERT INTO app_users(id,email) VALUES ('a','a@example.com'),('b','b@example.com'),('m','m@example.com'); INSERT INTO workshops(id,name) VALUES ('wa','Oficina A'),('wb','Oficina B'); INSERT INTO workshop_users(workshop_id,user_id,role) VALUES ('wa','a','admin'),('wb','b','admin'),('wa','m','mechanic'); INSERT INTO clients(id,workshop_id,full_name) VALUES ('ca','wa','Cliente A'),('cb','wb','Cliente B'); INSERT INTO vehicles(id,workshop_id,client_id,brand,model) VALUES ('va','wa','ca','Renault','Fluence'),('vb','wb','cb','Ford','Ka');");
 for(const [id,raw] of Object.entries(tokens))await db.prepare('INSERT INTO auth_sessions(token_hash,user_id,expires_at) VALUES (?,?,?)').bind(await hash(raw),id,Math.floor(Date.now()/1000)+3600).run();
});
after(()=>mf?.dispose());
test('commerce blocks anonymous, cross-workshop and mechanic writes',async()=>{
 assert.equal((await q('budgets','select',null,[eq('workshop_id','wa')],'anonymous')).status,401);
 assert.equal((await q('budgets','select',null,[eq('workshop_id','wa')],'b')).status,403);
 assert.equal((await q('budgets','insert',{workshop_id:'wa',client_id:'ca',vehicle_id:'va'},[],'m')).status,403);
 assert.equal((await q('app_users','select',null,[eq('workshop_id','wa')])).status,400);
});
test('quotes validate vehicle ownership, prices and tenant-bound IDs',async()=>{
 assert.equal((await q('budgets','insert',{workshop_id:'wa',client_id:'ca',vehicle_id:'vb'})).status,409);
 const b=await q('budgets','insert',{workshop_id:'wa',client_id:'ca',vehicle_id:'va',acceptance_at:'forged'});assert.equal(b.status,200);assert.equal(b.data.acceptance_at,null);
 assert.equal((await q('budgets','update',{status:'approved'},[eq('id',b.data.id)],'b')).status,403);
 assert.equal((await q('budget_items','insert',{workshop_id:'wa',budget_id:b.data.id,kind:'labor',description:'Cabeçote',quantity:1,unit_price:-1,discount:0})).status,400);
 const i=await q('budget_items','insert',{workshop_id:'wa',budget_id:b.data.id,kind:'labor',description:'Cabeçote',quantity:1,unit_price:700,discount:0});assert.equal(i.status,200);
 const row=(await q('budgets','select',null,[eq('id',b.data.id)])).data[0];assert.equal(row.clients.full_name,'Cliente A');assert.equal(row.vehicles.model,'Fluence');
});
test('terms use server totals, reject stale acceptances and invalidate on item changes',async()=>{
 const b=(await q('budgets','insert',{workshop_id:'wa',client_id:'ca',vehicle_id:'va'})).data;
 const i=(await q('budget_items','insert',{workshop_id:'wa',budget_id:b.id,kind:'labor',description:'Serviço',quantity:2,unit_price:100,discount:10})).data;
 const a={p_kind:'budget',p_id:b.id};let p=(await rpc('get_document_payment_terms',a)).data;assert.equal(p.total,190);
 p=(await rpc('save_document_payment_terms',{...a,p_revision:p.revision,p_method:'cash',p_terms:'Na entrega',p_percent:0,p_reason:'',p_deferred:false})).data;
 assert.equal((await rpc('accept_document_payment_terms',{...a,p_revision:p.revision,p_total:1})).status,400);
 const accepted=await rpc('accept_document_payment_terms',{...a,p_revision:p.revision,p_total:190});assert.equal(accepted.data.acceptance.total,190);
 await q('budget_items','update',{unit_price:120},[eq('id',i.id)]);
 const newer=(await rpc('get_document_payment_terms',a)).data;assert.equal(newer.total,230);assert.equal(newer.acceptance,null);
 assert.equal((await rpc('accept_document_payment_terms',{...a,p_revision:p.revision,p_total:190})).status,409);
 assert.equal((await rpc('get_document_payment_terms',a,'b')).status,403);
});
test('approved quote converts once and preserves all line items',async()=>{
 const b=(await q('budgets','insert',{workshop_id:'wa',client_id:'ca',vehicle_id:'va'})).data;
 await q('budget_items','insert',{workshop_id:'wa',budget_id:b.id,kind:'labor',description:'Mão de obra',quantity:1,unit_price:700,discount:0});
 assert.equal((await rpc('convert_budget',{p_id:b.id})).status,400);
 await q('budgets','update',{status:'approved'},[eq('id',b.id)]);
 const [one,two]=await Promise.all([rpc('convert_budget',{p_id:b.id}),rpc('convert_budget',{p_id:b.id})]);assert.equal(one.status,200);assert.equal(two.status,200);assert.equal(one.data.id,two.data.id);
 const items=(await q('service_order_items','select',null,[eq('workshop_id','wa'),eq('service_order_id',one.data.id)])).data;assert.equal(items.length,1);assert.equal(items[0].unit_price,700);
});
test('labor rates adjust atomically and reject invalid ranges',async()=>{
 assert.equal((await q('labor_price_catalog','insert',{workshop_id:'wa',name:'Inválido',category:'Motor',minimum_price:500,maximum_price:100})).status,400);
 const rate=await q('labor_time_rates','insert',{workshop_id:'wa',name:'Uma hora',hours:1,price:100});assert.equal(rate.status,200);
 assert.equal((await rpc('adjust_labor_prices',{p_workshop_id:'wa',p_percent:10})).status,200);
 assert.equal((await q('labor_time_rates','select',null,[eq('id',rate.data.id)])).data[0].price,110);
 assert.equal((await rpc('adjust_labor_prices',{p_workshop_id:'wa',p_percent:10},'b')).status,403);
});
