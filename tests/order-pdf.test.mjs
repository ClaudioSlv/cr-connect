import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
function load(path) {
  const source = ts.transpileModule(fs.readFileSync(new URL(`../src/lib/${path}.ts`, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const module = {exports:{}};
  new Function('require','module','exports',source)(name=>name==='./payment-terms'?load('payment-terms'):require(name),module,module.exports);
  return module.exports;
}
const {createOrderPdf,finishOrderPdf} = load('order-pdf');
const base = {number:'#10',client:'Cristiano',vehicle:'Volkswagen Gol G6',status:'Finalizada',items:[{description:'Troca da junta',quantity:1,unit_price:700}],payment:{payment_method:'combined',payment_terms:'Metade amanhã; restante em 30 dias.',surcharge_percent:14.3,surcharge_reason:'Condição combinada',acceptance:null}};
test('creates actual PDF with saved payment amounts and no false acceptance',()=>{
 const pdf=createOrderPdf(base); const bytes=pdf.output();
 assert.ok(bytes.startsWith('%PDF-'));
 assert.match(bytes,/800,10/); assert.match(bytes,/100,10/); assert.match(bytes,/700,00/);
 assert.match(bytes,/Aceite pendente/); assert.match(bytes,/Cristiano/);
 assert.equal(pdf.output('blob').type,'application/pdf');
});
test('long orders paginate without losing final items',()=>{
 const pdf=createOrderPdf({...base,items:Array.from({length:100},(_,i)=>({description:`Servico numero ${i}`,quantity:1,unit_price:7}))});
 assert.ok(pdf.getNumberOfPages()>1); assert.match(pdf.output(),/Servico numero 99/); assert.match(pdf.output(),/800,10/);
});

test('branded document has logo, payment boxes, portal links and numbered pages',()=>{
 const logo = 'data:image/jpeg;base64,'+fs.readFileSync(new URL('../public/brand/cr-reparador.jpg',import.meta.url)).toString('base64');
 const url='https://cr-connect-ic3w.vercel.app/app/minhas-os';
 const pdf=createOrderPdf(base,{logo,portalUrl:url,checkoutUrl:'https://cr-connect-ic3w.vercel.app/p/test'});
 finishOrderPdf(pdf);
 const bytes=pdf.output();
 assert.match(bytes,/Subtype \/Image/); assert.ok(bytes.includes(url));
 assert.match(bytes,/INFINITEPAY/); assert.match(bytes,/PAGAMENTO VIA PIX/);
 assert.match(bytes,/\/URI \(https:\/\/cr-connect-ic3w.vercel.app\/p\/test\)/);
 assert.ok(bytes.includes(`1/${pdf.getNumberOfPages()}`));
});
test('long payment terms and descriptions keep the final text and totals',()=>{
 const pdf=createOrderPdf({...base,items:[{description:'Detalhes '.repeat(700)+'ULTIMOITEM',quantity:1,unit_price:700}],payment:{...base.payment,payment_terms:'Condições '.repeat(700)+'FIMDASCONDICOES'}});
 finishOrderPdf(pdf);
 const bytes=pdf.output();
 assert.ok(pdf.getNumberOfPages()>3); assert.match(bytes,/ULTIMOITEM/); assert.match(bytes,/FIMDASCONDICOES/); assert.match(bytes,/800,10/);
});

test('Pix document shows the same discounted total in terms and payment',()=>{
 const pdf=createOrderPdf({...base,payment:{...base.payment,payment_method:'pix',surcharge_percent:0,surcharge_reason:'',pix_discount_percent:7,deferred_without_deposit:false}});
 const bytes=pdf.output(); assert.match(bytes,/651,00/); assert.match(bytes,/49,00/); assert.match(bytes,/7% de desconto no Pix/);
});
