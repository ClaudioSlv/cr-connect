import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import ts from 'typescript';
import QRCode from 'qrcode';
import {createPixPayload} from '../src/lib/pix.ts';
const output=new URL('../.cloudflare/pix-test/',import.meta.url);await mkdir(output,{recursive:true});
for(const name of ['order-pdf','payment-terms']){
 const src=await readFile(new URL(`../src/lib/${name}.ts`,import.meta.url),'utf8');
 await writeFile(new URL(`${name}.mjs`,output),ts.transpileModule(src,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText.replace('"./payment-terms"','"./payment-terms.mjs"'));
}
const {createOrderPdf,finishOrderPdf}=await import(new URL('order-pdf.mjs',output));
const {paymentTotals}=await import(new URL('payment-terms.mjs',output));
function parse(payload){const result={};let offset=0;while(offset<payload.length){const id=payload.slice(offset,offset+2),length=Number(payload.slice(offset+2,offset+4));result[id]=payload.slice(offset+4,offset+4+length);offset+=4+length;}assert.equal(offset,payload.length);return result;}
test('Pix QR uses the saved final amount, original recipient and a valid CRC',()=>{
 for(const [base,surcharge,discount] of [[700,0,7],[700,10,0],[700,0,0]]){
  const amount=paymentTotals(base,surcharge,discount).total,payload=createPixPayload(amount,'OS-123'),fields=parse(payload);
  assert.equal(fields['54'],amount.toFixed(2));assert.equal(parse(fields['26'])['01'],'+5513991320205');assert.equal(fields['59'],'CR REPARADOR');assert.equal(fields['60'],'SAO VICENTE');
  let crc=65535;for(const b of Buffer.from(payload.slice(0,-4))){crc^=b<<8;for(let i=0;i<8;i++)crc=crc&32768?((crc<<1)^4129)&65535:(crc<<1)&65535;}
  assert.equal(fields['63'],crc.toString(16).toUpperCase().padStart(4,'0'));
 }
});
test('D1 budget and O.S. PDFs embed the Pix image, discounted total and manual receipt notice',async()=>{
 const logo='data:image/jpeg;base64,'+(await readFile(new URL('../public/brand/cr-reparador.jpg',import.meta.url))).toString('base64');
 const qr=await QRCode.toDataURL(createPixPayload(651,'TEST123'),{width:280,margin:2});
 for(const documentType of ['Orçamento','Ordem de Serviço']){
  const p=createOrderPdf({documentType,number:'TEST123',client:'Cliente de teste',vehicle:'Renault Fluence',status:'Rascunho',items:[{description:'Montagem do cabeçote',quantity:1,unit_price:700,discount:0}],payment:{payment_method:'pix',payment_terms:'Pagamento na entrega',surcharge_percent:0,pix_discount_percent:7}},{simple:true,logo,pixQr:qr});finishOrderPdf(p);
  const text=p.output();assert.match(text,/PAGAMENTO VIA PIX DIRETO/);assert.match(text,/651,00/);assert.match(text,/13991320205/);assert.match(text,/Recebimento conferido/);assert.match(text,/oficina/);assert.ok((text.match(/\/Subtype \/Image/g)||[]).length>=2);assert.doesNotMatch(text,/INFINITEPAY/);
  await writeFile(new URL(documentType==='Orçamento'?'budget.pdf':'order.pdf',output),Buffer.from(p.output('arraybuffer')));
 }
});
