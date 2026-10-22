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
const {createOrderPdf} = load('order-pdf');
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
