import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { createHash, randomBytes } from 'node:crypto';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
const root=new URL('../',import.meta.url).pathname;
const origin='http://127.0.0.1:3190';
const child=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','3190'],{cwd:root,detached:true,stdio:['ignore','pipe','pipe']});
let logs='';for(const pipe of [child.stdout,child.stderr])pipe.on('data',value=>logs+=value);
let browser;
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
  browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
  const context=await browser.newContext({viewport:{width:390,height:844}});
  const page=await context.newPage();const errors=[];const legacyRequests=[];
  page.on('pageerror',error=>errors.push(error.message));
  page.on('request',request=>{if(/supabase\.(co|in)|\/rest\/v1\//.test(request.url()))legacyRequests.push(request.url());});
  await page.goto(`${origin}/app`);await page.waitForURL('**/login');
  await context.addCookies([{name:'cr_session_local',value:raw,url:origin,httpOnly:true,sameSite:'Lax'}]);
  await page.goto(`${origin}/app`);await page.getByRole('heading',{name:'Visão geral',exact:true}).waitFor();
  await page.goto(`${origin}/app/clientes`);await page.getByRole('heading',{name:'Clientes',exact:true}).waitFor();
  await page.getByPlaceholder('Nome completo *').fill('Cliente do teste');
  await page.getByPlaceholder(/E-mail/).fill('cliente@example.com');
  await page.getByRole('button',{name:'Salvar',exact:true}).click();await page.waitForURL('**/app');
  await page.goto(`${origin}/app/veiculos`);await page.getByRole('combobox').selectOption({label:'Cliente do teste'});
  await page.getByPlaceholder('Marca *').fill('Renault');await page.getByPlaceholder('Modelo *').fill('Fluence');
  await page.getByPlaceholder('Placa',{exact:true}).fill('ABC1234');await page.getByRole('button',{name:'Salvar',exact:true}).click();
  await page.getByText('Veículo e lembrete preventivo salvos com sucesso.').waitFor();
  await page.getByRole('button',{name:'Abrir lista de veículos'}).click();await page.getByText('Renault Fluence',{exact:true}).waitFor();
  await page.screenshot({path:'/tmp/cr-d1-mobile.png',fullPage:true});
  await page.getByRole('button',{name:'Sair',exact:true}).click();await page.waitForURL('**/login');
  await page.getByLabel('E-mail',{exact:true}).fill('delivery-test@example.com');
  await page.getByRole('button',{name:'Enviar link de acesso'}).click();await page.getByRole('alert').filter({hasText:'O e-mail não pôde ser enviado'}).waitFor();
  assert.deepEqual(legacyRequests,[]);assert.deepEqual(errors,[]);
  console.log('PASS: production Worker preview, mobile login, client and vehicle CRUD, logout, honest email failure, zero Supabase requests');
}finally{
  await browser?.close();try{process.kill(-child.pid,'SIGTERM');}catch{}
}
