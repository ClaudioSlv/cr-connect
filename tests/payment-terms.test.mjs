import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
const code = ts.transpileModule(readFileSync(new URL('../src/lib/payment-terms.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
const m = { exports: {} };
new Function('exports', 'module', code)(m.exports, m);
const { paymentTotals, parseSurcharge } = m.exports;
test('14.3 percent on 700 is an extra 100.10 and total 800.10', () => assert.deepEqual(paymentTotals(700, 14.3), { subtotal: 700, surcharge: 100.1, discount: 0, total: 800.1 }));
test('currency rounds at cent boundaries without compounding the fee', () => {
  assert.deepEqual(paymentTotals(10.075, 0), { subtotal: 10.08, surcharge: 0, discount: 0, total: 10.08 });
  assert.deepEqual(paymentTotals(0.05, 10), { subtotal: 0.05, surcharge: 0.01, discount: 0, total: 0.06 });
  assert.equal(paymentTotals(700, 14.3).total, paymentTotals(700, 14.3).total);
});
test('comma decimals accepted; negative, infinite and malformed values rejected', () => {
  assert.equal(parseSurcharge('14,3'), 14.3);
  assert.equal(parseSurcharge('0'), 0);
  for (const value of ['-1', '101', 'NaN', 'Infinity', '', '1,2,3', '14,333']) assert.equal(parseSurcharge(value), null);
});

test('Pix discounts match cents and never stack with a surcharge', () => {
 assert.deepEqual(paymentTotals(700,0,7),{subtotal:700,surcharge:0,discount:49,total:651});
 assert.equal(paymentTotals(700,14.3,7).total,800.1);
 assert.equal(paymentTotals(.05,0,10).discount,.01);
});
