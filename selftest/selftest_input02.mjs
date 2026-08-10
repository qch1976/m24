// Server-side integrated self-test: use real Deck + Card + Random + Solver
// Bridges ESM (project) to Node runtime via dynamic import with .js extension.
// Run: node --experimental-vm-modules scripts/selftest_input02.mjs

import Solver from '../js/core/Solver.js';
import Deck from '../js/core/Deck.js';
import { RANK_VALUE } from '../js/core/Card.js';

console.log('===== INPUT-02 server-side integrated self-test =====');

// Sanity: Solver
console.log('\n[1] Solver sanity');
console.log('  [3,3,8,8] →', Solver.findSolutions([3,3,8,8]));
console.log('  [1,2,3,4] 解数 =', Solver.findSolutions([1,2,3,4]).length);
console.log('  isSolvable [1,1,1,1] =', Solver.isSolvable([1,1,1,1]));
console.log('  isSolvable [3,3,3,3] =', Solver.isSolvable([3,3,3,3]));

// Integration: Deck + Solver
console.log('\n[2] Deck.dealSolvable() × 100 (real 54-card deck, Fisher-Yates)');
const deck = new Deck();
let reshuffleSum = 0;
let reshuffleMax = 0;
let uncorroborated = 0;
for (let round = 0; round < 100; round++) {
  // 我们在这里 patch 一下 deck.deal 数计以观察重抽次数
  let attempts = 0;
  const origDeal = deck.deal.bind(deck);
  deck.deal = function (n) { attempts++; return origDeal(n); };
  const cards = deck.dealSolvable(4);
  deck.deal = origDeal;
  reshuffleSum += (attempts - 1);
  if (attempts - 1 > reshuffleMax) reshuffleMax = attempts - 1;
  const vals = cards.map(c => c.value);
  const sols = Solver.findSolutions(vals);
  // 交叉验证：每个解 eval 严格 = 24
  let allValid = true;
  for (const s of sols) {
    const v = eval(s);
    if (Math.abs(v - 24) > 1e-9) { allValid = false; break; }
  }
  if (!allValid) uncorroborated++;
  if (round < 5) {
    console.log(`  Round ${round+1}: [${vals.join(',')}] attempts=${attempts} 解数=${sols.length}, 首解=${sols[0]}`);
  }
}
console.log(`  100 轮: 平均重抽 ${(reshuffleSum/100).toFixed(2)} 次, 最大重抽 ${reshuffleMax}, 解 eval≠24 组数=${uncorroborated}`);
if (uncorroborated > 0) process.exitCode = 1;

// Perf: 单次求解
console.log('\n[3] Solver 单次求解性能（200 次随机组合）');
const samples = [];
for (let i = 0; i < 200; i++) {
  const nums = [Math.floor(Math.random()*14), Math.floor(Math.random()*14), Math.floor(Math.random()*14), Math.floor(Math.random()*14)];
  const t0 = process.hrtime.bigint();
  Solver.findSolutions(nums);
  const t1 = process.hrtime.bigint();
  samples.push(Number(t1 - t0) / 1e6);
}
samples.sort((a,b)=>a-b);
console.log(`  median=${samples[100].toFixed(3)}ms, avg=${(samples.reduce((s,x)=>s+x,0)/200).toFixed(3)}ms, p95=${samples[190].toFixed(3)}ms, max=${samples[199].toFixed(3)}ms`);

// Perf: dealSolvable 总时延（100 次，含发牌+求解）
console.log('\n[4] dealSolvable + Solver.findSolutions 总时延（发牌→拿到全解）');
const totalSamples = [];
for (let i = 0; i < 100; i++) {
  const t0 = process.hrtime.bigint();
  const cards = deck.dealSolvable(4);
  const sols = Solver.findSolutions(cards.map(c => c.value));
  const t1 = process.hrtime.bigint();
  totalSamples.push(Number(t1 - t0) / 1e6);
}
totalSamples.sort((a,b)=>a-b);
console.log(`  median=${totalSamples[50].toFixed(3)}ms, avg=${(totalSamples.reduce((s,x)=>s+x,0)/100).toFixed(3)}ms, p95=${totalSamples[95].toFixed(3)}ms, max=${totalSamples[99].toFixed(3)}ms`);

// TC-01-03: 超限抛异常验证（mock Solver.isSolvable → 恒 false）
console.log('\n[5] 超限抛异常（mock 全不可解 → 应抛错）');
const origIsSolvable = Solver.isSolvable;
Solver.isSolvable = () => false;
let threw = false;
let errMsg = '';
try {
  deck.dealSolvable(4);
} catch (e) {
  threw = true;
  errMsg = e.message;
}
Solver.isSolvable = origIsSolvable;
console.log(`  抛异常=${threw}, 消息=${errMsg}`);
if (!threw) process.exitCode = 1;

// TC-03-01: GameCore 接口验证
console.log('\n[6] GameCore.recordSolutions / getSolutions / hasSolution 接口');
const { default: GameCore } = await import('../js/core/GameCore.js');
const gc = new GameCore();
const cards2 = deck.dealSolvable(4);
const { values, solutions } = gc.recordSolutions(cards2);
console.log(`  录入 values=[${values.join(',')}], 解数=${solutions.length}`);
console.log(`  getSolutions().length = ${gc.getSolutions().length}`);
console.log(`  hasSolution() = ${gc.hasSolution()}`);
console.log(`  getCurrentCardValues() = [${gc.getCurrentCardValues().join(',')}]`);
const s1 = gc.getSolutions();
s1.push('__poison__');
const s2 = gc.getSolutions();
console.log(`  副本隔离: 外部污染 s1 (length=${s1.length}) 不影响 gc (length=${s2.length})`);
if (s2.includes('__poison__')) process.exitCode = 1;

console.log(process.exitCode === 1 ? '\n❌ 存在失败用例' : '\n✅ 全部通过');
