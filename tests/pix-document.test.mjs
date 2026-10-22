import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
function compile(path,mocks={}) {
 const js=ts.transpileModule(readFileSync(new URL(path,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2020}}).outputText;
 const module={exports:{}};new Function('require','module','exports',js)(name=>mocks[name],module,module.exports);return module.exports;
}
const terms=compile('../src/lib/payment-terms.ts');
const pix=compile('../src/lib/pix.ts');
function amount(payload){let pos=0;while(pos<payload.length){const id=payload.slice(pos,pos+2);const length=Number(payload.slice(pos+2,pos+4));const value=payload.slice(pos+4,pos+4+length);if(id==='54')return value;pos+=4+length;}}
test('QR charges the exact discounted amount and keeps a CRC',()=>{
 const payload=pix.createPixPayload(terms.paymentTotals(700,0,7).total,'#10');assert.equal(amount(payload),'651.00');assert.match(payload,/6304[0-9A-F]{4}$/);
});
test('budget HTML, combined total and Pix payload all use the same saved discount',async()=>{
 let html='';const codes=[];
 const react={useState:value=>[value,()=>{}],useRef:value=>({current:value}),useEffect(){}};
 const jsx=(type,props)=>({type,props});
 const {PrintDocument}=compile('../src/components/print-document.tsx',{
  react,'react/jsx-runtime':{jsx,jsxs:jsx},'@/lib/payment-terms':terms,'@/lib/pix':pix,'@/lib/mileage-photos':{},
  qrcode:{default:{toDataURL:async value=>{codes.push(value);return 'data:image/png;base64,test';}}}
 });
 const previous=globalThis.window;
 globalThis.window={location:{origin:'https://cr-connect-ic3w.vercel.app'},open:()=>({document:{open(){},write(value){html=value;},close(){}}})};
 try{
  const tree=PrintDocument({type:'Orçamento',number:'#10',client:'Teste',vehicle:'Gol',status:'Rascunho',items:[{description:'Serviço',quantity:1,unit_price:700}],payment:{payment_method:'pix',payment_terms:'Pagamento integral na entrega',surcharge_percent:0,surcharge_reason:'',pix_discount_percent:7,deferred_without_deposit:false,acceptance:null}});
  tree.props.children[0].props.onClick();
  await new Promise(resolve=>setImmediate(resolve));await new Promise(resolve=>setImmediate(resolve));
  assert.equal(amount(codes.find(code=>code.startsWith('000201'))),'651.00');
  const normalized=html.replace(/\u00a0/g,' ');
  assert.match(normalized,/Total combinado: R\$ 651,00/);assert.match(normalized,/Valor no QR Code: <b>R\$ 651,00/);assert.match(normalized,/Desconto: R\$ 49,00/);
 }finally{globalThis.window=previous;}
});
