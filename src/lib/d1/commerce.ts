import { ApiError, requireMembership, text, type Database } from './service.ts';
import { paymentMethods, paymentTotals } from '../payment-terms.ts';
type Row=Record<string,any>;
const fields:Record<string,string[]>={
 clients:['full_name','phone','whatsapp','email'],vehicles:['client_id','brand','model','plate'],
 budgets:['client_id','vehicle_id','service_order_id','status'],
 service_orders:['client_id','vehicle_id','status','customer_complaint','diagnosis','notes'],
 budget_items:['budget_id','kind','description','quantity','unit_price','discount'],
 service_order_items:['service_order_id','kind','description','quantity','unit_price','discount'],
 labor_price_catalog:['category','name','minimum_price','maximum_price'],labor_time_rates:['name','hours','price'],
};
const readOnly=new Set(['clients','vehicles']);
const money=(v:unknown,label:string,max=1000000)=>{if(typeof v!=='number'||!Number.isFinite(v)||v<0||v>max||Math.abs(v*100-Math.round(v*100))>1e-6)throw new ApiError(400,`${label}: valor inválido.`);return v;};
function validate(table:string,input:Row,insert:boolean,current:Row={}):Row {
 const data:Row={};
 for(const key of fields[table])if(key in input)data[key]=input[key];
 const merged={...current,...data};
 for(const key of ['client_id','vehicle_id','budget_id','service_order_id'])if(key in merged&&merged[key]!==null)merged[key]=text(merged[key],key,80,true);
 for(const key of ['description','customer_complaint','name'])if(key in merged)merged[key]=text(merged[key],key, key==='customer_complaint'?4000:1000,true);
 for(const key of ['diagnosis','notes','category'])if(key in merged)merged[key]=text(merged[key],key,4000);
 if(table.endsWith('_items')){
  if(insert){merged.quantity??=1;merged.discount??=0;}
  if(typeof merged.quantity!=='number'||!Number.isFinite(merged.quantity)||merged.quantity<=0||merged.quantity>10000)throw new ApiError(400,'Quantidade inválida.');
  money(merged.unit_price,'Preço');money(merged.discount,'Desconto',10000000000);
  if(merged.discount>Math.round(merged.unit_price*merged.quantity*100)/100)throw new ApiError(400,'Desconto maior que o item.');
 }
 for(const key of ['minimum_price','maximum_price','price'])if(key in merged)money(merged[key],'Preço');
 if(table==='labor_price_catalog'&&merged.maximum_price<merged.minimum_price)throw new ApiError(400,'A faixa de preços está inválida.');
 if('hours' in merged&&merged.hours!==null&&(typeof merged.hours!=='number'||!Number.isFinite(merged.hours)||merged.hours<0||merged.hours>10000))throw new ApiError(400,'Tempo inválido.');
 const required=table==='service_orders'?['client_id','vehicle_id','customer_complaint']:table==='budgets'?['client_id','vehicle_id']:table.endsWith('_items')?[table==='budget_items'?'budget_id':'service_order_id','kind','description','unit_price']:table==='labor_price_catalog'?['name','category','minimum_price','maximum_price']:['name','price'];
 if(insert)for(const key of required)if(merged[key]===undefined||merged[key]===null)throw new ApiError(400,`Informe ${key}.`);
 return Object.fromEntries(fields[table].filter(key=>key in merged&&(insert||key in data)).map(key=>[key,merged[key]]));
}
export async function commerceQuery(db:Database,userId:string,body:Row){
 const table=String(body.table),action=String(body.action||'select');
 if(!Object.hasOwn(fields,table)||!['select','insert','update','delete','upsert'].includes(action))throw new ApiError(400,'Operação inválida.');
 if(readOnly.has(table)&&action!=='select')throw new ApiError(403,'Use o cadastro de clientes e veículos.');
 const filters=body.filters;
 if(!Array.isArray(filters)||filters.length>12)throw new ApiError(400,'Filtro inválido.');
 const values:unknown[]=[];const conditions:string[]=[];
 const allowed=new Set(['id','workshop_id',...fields[table],'created_at','opened_at']);
 for(const f of filters){
  if(!f||!allowed.has(f.column)||!['eq','in','not_in'].includes(f.op))throw new ApiError(400,'Filtro inválido.');
  if(f.op==='eq'){
   if(typeof f.value!=='string'&&typeof f.value!=='number')throw new ApiError(400,'Filtro inválido.');
   conditions.push(`${f.column}=?`);values.push(f.value);
  }else{
   if(!Array.isArray(f.value)||!f.value.length||f.value.length>100||f.value.some((v:unknown)=>typeof v!=='string'&&typeof v!=='number'))throw new ApiError(400,'Filtro inválido.');
   conditions.push(`${f.column} ${f.op==='in'?'IN':'NOT IN'} (${f.value.map(()=>'?').join(',')})`);values.push(...f.value);
  }
 }
 const input=body.values;
 if (action==='insert' && Array.isArray(input)) {
  if (!table.endsWith('_items') || !input.length || input.length>100) throw new ApiError(400,'Lista de itens inválida.');
  const workshop=input[0]?.workshop_id;
  if(typeof workshop!=='string'||input.some(v=>!v||v.workshop_id!==workshop))throw new ApiError(400,'Oficina inválida.');
  await requireMembership(db,userId,workshop,true);
  const statements=input.map(v=>{const data=validate(table,v,true),keys=Object.keys(data);return db.prepare(`INSERT INTO ${table}(id,workshop_id,${keys.join(',')}) VALUES (${Array(keys.length+2).fill('?').join(',')}) RETURNING *`).bind(crypto.randomUUID(),workshop,...keys.map(k=>data[k]));});
  return (await db.batch<Row>(statements)).flatMap(result=>result.results);
 }

 if(['insert','upsert','update'].includes(action)&&(!input||typeof input!=='object'||Array.isArray(input)))throw new ApiError(400,'Dados inválidos.');
 let workshop=filters.find((f:Row)=>f.column==='workshop_id'&&f.op==='eq')?.value;
 const id=filters.find((f:Row)=>f.column==='id'&&f.op==='eq')?.value;
 if(['insert','upsert'].includes(action))workshop=input.workshop_id;
 if(!workshop&&id){workshop=(await db.prepare(`SELECT workshop_id FROM ${table} WHERE id=?`).bind(id).first<Row>())?.workshop_id;}
 if(typeof workshop!=='string')throw new ApiError(400,'Informe a oficina.');
 await requireMembership(db,userId,workshop,action!=='select');
 conditions.push('workshop_id=?');values.push(workshop);
 const where=conditions.join(' AND ');
 let resultId:string|undefined=id;
 if(action==='select'){
  const order=typeof body.order==='string'&&allowed.has(body.order)?body.order:'id';
  const limit=Number.isInteger(body.limit)&&body.limit>0?Math.min(body.limit,1000):1000;
  const rows=(await db.prepare(`SELECT * FROM ${table} WHERE ${where} ORDER BY ${order} ${body.ascending===false?'DESC':'ASC'} LIMIT ?`).bind(...values,limit).all<Row>()).results;
  if(['budgets','service_orders'].includes(table)){
   const [cs,vs]=await db.batch<Row>([db.prepare('SELECT id,full_name,phone,whatsapp FROM clients WHERE workshop_id=?').bind(workshop),db.prepare('SELECT id,client_id,brand,model,plate FROM vehicles WHERE workshop_id=?').bind(workshop)]);
   const clients=new Map(cs.results.map(c=>[c.id,c])),vehicles=new Map(vs.results.map(v=>[v.id,v]));
   for(const row of rows){row.clients=clients.get(row.client_id)||null;row.vehicles=vehicles.get(row.vehicle_id)||null;}
  }
  return body.single?rows[0]??null:rows;
 }
 if(action==='delete'||action==='update'){
  if(!id)throw new ApiError(400,'Selecione um cadastro para alterar.');
  const current=await db.prepare(`SELECT * FROM ${table} WHERE ${where}`).bind(...values).first<Row>();
  if(!current)throw new ApiError(404,'Cadastro não encontrado nesta oficina.');
  if(action==='delete'){await db.prepare(`DELETE FROM ${table} WHERE ${where}`).bind(...values).run();return null;}
  const data=validate(table,input,false,current);const keys=Object.keys(data);if(!keys.length)throw new ApiError(400,'Nenhuma alteração informada.');
  const extra=['budgets','service_orders'].includes(table)?",updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')":'';
  await db.prepare(`UPDATE ${table} SET ${keys.map(k=>`${k}=?`).join(',')}${extra} WHERE ${where}`).bind(...keys.map(k=>data[k]),...values).run();
 }else{
  if(action==='upsert'&&table!=='labor_price_catalog')throw new ApiError(400,'Operação inválida.');
  const data=validate(table,input,true);const keys=Object.keys(data);resultId=crypto.randomUUID();
  const cols=['id','workshop_id',...keys],params:unknown[]=[resultId,workshop,...keys.map(k=>data[k])];
  let placeholders=cols.map(()=>'?').join(',');
  if(table==='service_orders'){cols.push('number');placeholders+=`,(SELECT coalesce(max(number),0)+1 FROM service_orders WHERE workshop_id=?)`;params.push(workshop);}
  const upsert=action==='upsert'?' ON CONFLICT(workshop_id,name) DO UPDATE SET category=excluded.category,minimum_price=excluded.minimum_price,maximum_price=excluded.maximum_price':'';
  const row=await db.prepare(`INSERT INTO ${table}(${cols.join(',')}) VALUES (${placeholders})${upsert} RETURNING id`).bind(...params).first<Row>();resultId=row?.id;
 }
 return commerceQuery(db,userId,{table,action:'select',single:true,filters:[{column:'id',op:'eq',value:resultId},{column:'workshop_id',op:'eq',value:workshop}]});
}
async function document(db:Database,userId:string,kind:unknown,id:unknown){
 if(!['budget','order'].includes(String(kind))||typeof id!=='string')throw new ApiError(400,'Documento inválido.');
 const table=kind==='budget'?'budgets':'service_orders';
 const row=await db.prepare(`SELECT * FROM ${table} WHERE id=?`).bind(id).first<Row>();if(!row)throw new ApiError(404,'Documento não encontrado.');
 await requireMembership(db,userId,row.workshop_id);return {table,row};
}
async function paymentData(db:Database,table:string,row:Row){
 const itemTable=table==='budgets'?'budget_items':'service_order_items',fk=table==='budgets'?'budget_id':'service_order_id';
 const sums=await db.prepare(`SELECT coalesce(sum(round(quantity*unit_price*100)-round(discount*100)),0) AS cents FROM ${itemTable} WHERE workshop_id=? AND ${fk}=?`).bind(row.workshop_id,row.id).first<{cents:number}>();
 const subtotal=Number(sums?.cents||0)/100,total=paymentTotals(subtotal,row.surcharge_percent,row.pix_discount_percent).total;
 return {payment_method:row.payment_method,payment_terms:row.payment_terms,surcharge_percent:row.surcharge_percent,surcharge_reason:row.surcharge_reason,deferred_without_deposit:Boolean(row.deferred_without_deposit),pix_discount_percent:row.pix_discount_percent,available_pix_discount_percent:0,subtotal,total,revision:row.term_revision,acceptance:row.acceptance_at?{at:row.acceptance_at,total:row.acceptance_total,source:'workshop_record'}:null};
}
export async function commerceRpc(db:Database,userId:string,body:Row){
 const a=body.args||{};const name=String(body.name);
 if(name==='adjust_labor_prices'){
  const w=text(a.p_workshop_id,'oficina',80,true)!;await requireMembership(db,userId,w,true);
  const percent=a.p_percent;if(typeof percent!=='number'||!Number.isFinite(percent)||percent< -100||percent>100)throw new ApiError(400,'Percentual inválido.');
  await db.batch([db.prepare('UPDATE labor_price_catalog SET minimum_price=round(minimum_price*(1+?/100.0),2),maximum_price=round(maximum_price*(1+?/100.0),2) WHERE workshop_id=?').bind(percent,percent,w),db.prepare('UPDATE labor_time_rates SET price=round(price*(1+?/100.0),2) WHERE workshop_id=?').bind(percent,w)]);return true;
 }
 if(name==='convert_budget')return convertBudget(db,userId,a.p_id);
 if(!['get_document_payment_terms','save_document_payment_terms','accept_document_payment_terms'].includes(name))throw new ApiError(400,'Operação inválida.');
 const {table,row}=await document(db,userId,a.p_kind,a.p_id);
 if(name==='get_document_payment_terms')return paymentData(db,table,row);
 await requireMembership(db,userId,row.workshop_id,true);
 if(a.p_revision!==row.term_revision)throw new ApiError(409,'O documento mudou. Reabra para conferir os valores.');
 if(name==='save_document_payment_terms'){
  if(!paymentMethods.some(([key])=>key===a.p_method))throw new ApiError(400,'Forma de pagamento inválida.');
  const terms=text(a.p_terms,'condições de pagamento',2000)||'',reason=text(a.p_reason,'motivo',500)||'';
  const percent=money(a.p_percent,'Acréscimo',100);
  if(percent>0&&(!reason||!a.p_deferred))throw new ApiError(400,'Informe o motivo e a condição do acréscimo.');
  const updated=await db.prepare(`UPDATE ${table} SET payment_method=?,payment_terms=?,surcharge_percent=?,surcharge_reason=?,deferred_without_deposit=?,term_revision=lower(hex(randomblob(16))),acceptance_at=NULL,acceptance_total=NULL WHERE id=? AND workshop_id=? AND term_revision=? RETURNING *`).bind(a.p_method,terms,percent,reason,a.p_deferred?1:0,row.id,row.workshop_id,a.p_revision).first<Row>();
  if(!updated)throw new ApiError(409,'O documento mudou. Reabra para continuar.');return paymentData(db,table,updated);
 }
 const current=await paymentData(db,table,row);
 if(current.payment_method==='not_defined'||!current.payment_terms.trim()||current.total<=0||typeof a.p_total!=='number'||Math.round(a.p_total*100)!==Math.round(current.total*100))throw new ApiError(400,'Confira a forma, condições e total antes do aceite.');
 const accepted=await db.prepare(`UPDATE ${table} SET acceptance_at=strftime('%Y-%m-%dT%H:%M:%fZ','now'),acceptance_total=? WHERE id=? AND workshop_id=? AND term_revision=? RETURNING *`).bind(current.total,row.id,row.workshop_id,a.p_revision).first<Row>();
 if(!accepted)throw new ApiError(409,'O documento mudou. Reabra para continuar.');return paymentData(db,table,accepted);
}
async function convertBudget(db:Database,userId:string,id:unknown){
 const {row}=await document(db,userId,'budget',id);await requireMembership(db,userId,row.workshop_id,true);
 if(row.service_order_id)return {id:row.service_order_id};
 if(row.status!=='approved')throw new ApiError(400,'Marque o orçamento como aprovado antes de criar a O.S.');
 const orderId=crypto.randomUUID();
 await db.batch([
  db.prepare(`INSERT INTO service_orders(id,workshop_id,number,client_id,vehicle_id,status,customer_complaint,payment_method,payment_terms,surcharge_percent,surcharge_reason,deferred_without_deposit) SELECT ?,workshop_id,(SELECT coalesce(max(number),0)+1 FROM service_orders WHERE workshop_id=?),client_id,vehicle_id,'open','Serviços do orçamento aprovado',payment_method,payment_terms,surcharge_percent,surcharge_reason,deferred_without_deposit FROM budgets WHERE id=? AND workshop_id=? AND service_order_id IS NULL AND status='approved'`).bind(orderId,row.workshop_id,row.id,row.workshop_id),
  db.prepare("UPDATE budgets SET service_order_id=? WHERE id=? AND workshop_id=? AND service_order_id IS NULL AND EXISTS(SELECT 1 FROM service_orders WHERE id=?)").bind(orderId,row.id,row.workshop_id,orderId),
  db.prepare(`INSERT INTO service_order_items(id,workshop_id,service_order_id,kind,description,quantity,unit_price,discount) SELECT lower(hex(randomblob(16))),i.workshop_id,?,i.kind,i.description,i.quantity,i.unit_price,i.discount FROM budget_items i JOIN budgets b ON b.id=i.budget_id AND b.workshop_id=i.workshop_id WHERE b.id=? AND b.workshop_id=? AND b.service_order_id=?`).bind(orderId,row.id,row.workshop_id,orderId),
 ]);
 return {id:(await db.prepare('SELECT service_order_id FROM budgets WHERE id=? AND workshop_id=?').bind(row.id,row.workshop_id).first<Row>())?.service_order_id};
}
