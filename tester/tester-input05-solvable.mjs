// tester-input05-solvable.mjs
// Tester 独立复核 R-02: dealMode='solvable' 200+ 次全部有解
// 立场: 不复用 Developer selftest；独立采样 + 独立断言
// 目标: 200 次调用 DealGenerator.generate('solvable')，每次调用 Solver.isSolvable 判定必须为 true

import { generate } from '../js/core/DealGenerator.mjs';
import Solver from '../js/core/Solver.mjs';

const N = 200;
let ok = 0, fail = 0;
const failCases = [];

const startTs = Date.now();
for (let i = 1; i <= N; i++) {
  const cards = generate('solvable');
  const values = cards.map(c => c.value);
  const solvable = Solver.isSolvable(values, 24);
  if (solvable) ok++;
  else {
    fail++;
    failCases.push({ i, values, cards: cards.map(c => `${c.suit}-${c.rank}`) });
  }
}
const dur = Date.now() - startTs;

console.log(`[tester-input05-solvable] R-02 独立采样 N=${N}`);
console.log(`  ok=${ok} fail=${fail}  耗时=${dur}ms`);
if (fail > 0) {
  console.log('  失败样本:');
  for (const f of failCases.slice(0, 5)) {
    console.log(`    #${f.i} values=[${f.values.join(',')}] cards=[${f.cards.join(', ')}]`);
  }
}
console.log(fail === 0 ? 'PASS' : 'FAIL');
process.exit(fail === 0 ? 0 : 1);
