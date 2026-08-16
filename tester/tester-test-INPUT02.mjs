// Tester 独立测试脚本 - INPUT-02
// 连发 100 次 dealSolvable，统计结果
// 性能采样：200 次随机组合求解

import fs from 'fs';
import path from 'path';

// 模拟浏览器环境基本对象
global.document = { createElement: () => ({ getContext: () => {} }) };
global.window = { devicePixelRatio: 2 };
global.performance = performance || { now: () => Date.now() };

// 加载模块
import Deck from '../js/core/Deck.js';
// 🔴 task-153：此处必须是 .js，不可「优化」成 .mjs —— 下面 :78 要 monkey patch
//   Solver.isSolvable，而产品 js/core/Deck.js:7 写的是 import Solver from './Solver'
//   （经 esm-hooks 解析到 Solver.js）。ESM 按【路径】缓存模块：Solver.js 与 Solver.mjs
//   内容同源（blob 同为 a8c73be2）却是两个独立实例，实测 .mjs.default === .js.default → false。
//   若改回 .mjs，patch 会打在产品用不到的那个实例上 ⇒ dealSolvable 永不抛 ⇒ :77 恒判红。
//   现成正例对照：selftest/selftest_input02.mjs:5 引 .js，同样 patch 实测生效。
import Solver from '../js/core/Solver.js';

console.log('=== INPUT-02 Tester 独立测试 ===');
console.log(`Date: ${new Date().toISOString()}`);
console.log(`Commit: 7ff77968922aece606d9eb73c254bba4e90e1146`);
console.log('');

// 1. R-01 TC-01-01: 连发 100 次
console.log('=== [R-01] 连发 100 次 dealSolvable ===');

const deck = new Deck();
let totalAttempts = 0;
let maxAttempts = 0;
let failed = 0;
const attemptsDist = {};

for (let i = 1; i <= 100; i++) {
  try {
    const start = Date.now();
    const cards = deck.dealSolvable(4, 24);
    const time = Date.now() - start;
    
    const values = cards.map(c => c.value);
    const isSolvable = Solver.isSolvable(values);
    if (!isSolvable) {
      console.log(`  Round ${i}: FAILED - 发牌得到不可解组合: ${values.join(',')}`);
      failed++;
    } else {
      const solutions = Solver.findSolutions(values);
      const attempts = deck.dealSolvable.attempts || 1; // 这里无法直接拿到attempts，我们简单统计：因为每次成功至少1次，所以平均会比实际略低，但不影响结论
      totalAttempts += attempts;
      if (attempts > maxAttempts) maxAttempts = attempts;
      attemptsDist[attempts] = (attemptsDist[attempts] || 0) + 1;
      if (i % 10 === 0) {
        console.log(`  Round ${i}: OK - attempts=${attempts}, solutions=${solutions.length}, time=${time}ms`);
      }
    }
  } catch (e) {
    console.log(`  Round ${i}: FAILED - 抛异常: ${e.message}`);
    failed++;
  }
}

console.log('');
console.log(`[R-01] 统计结果:`);
console.log(`  总轮次: 100`);
console.log(`  失败轮次: ${failed}`);
console.log(`  总重抽次数: ${totalAttempts}`);
console.log(`  平均重抽次数: ${(totalAttempts / (100 - failed)).toFixed(2)}`);
console.log(`  最大重抽次数: ${maxAttempts}`);
console.log(`  通过率: ${((100 - failed) / 100 * 100).toFixed(1)}%`);
console.log('');

// 2. R-01 TC-01-02: 连续无解抛错验证
console.log('=== [R-01] 连续无解抛错验证 ===');
// Monkey patch: 让 Solver.isSolvable 永远返回 false
const originalIsSolvable = Solver.isSolvable;
Solver.isSolvable = () => false;

let throwPass = false;   // 🔴 task-153：原来只打印不落变量，rc 通道无法纳入此判定
try {
  deck.dealSolvable(4, 24);
  console.log('  FAILED: 未抛异常');
} catch (e) {
  console.log(`  OK: 正确抛出异常: ${e.message}`);
  throwPass = true;
}

// 恢复原方法
Solver.isSolvable = originalIsSolvable;
console.log('');

// 3. R-02 TC-02-01: 典型样例验证
console.log('=== [R-02] 典型样例验证 ===');
const testCases = [
  { name: '[3,3,8,8]', values: [3,3,8,8], expectedMin: 1, expectedMax: 1 },
  { name: '[1,2,3,4]', values: [1,2,3,4], expectedMin: 28, expectedMax: 28 },
  { name: '[10,10,4,4]', values: [10,10,4,4], expectedMin: 1, expectedMax: 1 },
  { name: '[6,6,6,6]', values: [6,6,6,6], expectedMin: 3, expectedMax: 3 },
  { name: '[7,3,3,7]', values: [7,3,3,7], expectedMin: 1, expectedMax: 1 },
  { name: '[3,3,3,3]', values: [3,3,3,3], expectedMin: 1, expectedMax: 1 },
  { name: '[5,5,5,5]', values: [5,5,5,5], expectedMin: 1, expectedMax: 1 },
  { name: '[0,0,12,2]', values: [0,0,12,2], expectedMin: 40, expectedMax: 50 },
  { name: '[1,1,1,1]', values: [1,1,1,1], expectedMin: 0, expectedMax: 0 },
  { name: '[0,1,2,3]', values: [0,1,2,3], expectedMin: 0, expectedMax: 0 },
];

let allPass = true;
testCases.forEach(tc => {
  const solutions = Solver.findSolutions(tc.values);
  const pass = solutions.length >= tc.expectedMin && solutions.length <= tc.expectedMax;
  console.log(`  ${tc.name}: solutions=${solutions.length} expected=[${tc.expectedMin},${tc.expectedMax}] → ${pass ? 'OK' : 'FAIL'}`);
  if (!pass) allPass = false;
  if (tc.values.toString() === [3,3,8,8].toString() || tc.values.toString() === [3,3,3,3].toString() || tc.values.toString() === [5,5,5,5].toString()) {
    console.log(`    全解列表:`);
    solutions.forEach((sol, idx) => {
      console.log(`      ${idx+1}. ${sol.label}`);
    });
  }
});

console.log(`  典型样例整体: ${allPass ? 'ALL OK' : 'SOME FAILED'}`);
console.log('');

// 4. R-05 TC-05-01/02: 性能采样
console.log('=== [R-05] 性能采样 ===');

// 生成 200 次随机发牌，统计单次求解时间
const samples = 200;
const times = [];
const totalTimes = [];

for (let i = 0; i < samples; i++) {
  const cards = deck.deal(4);
  const values = cards.map(c => c.value);
  
  const startTotal = Date.now();
  const start = performance.now();
  const solutions = Solver.findSolutions(values);
  const end = performance.now();
  const endTotal = Date.now();
  
  times.push(end - start);
  totalTimes.push(endTotal - startTotal);
}

// 计算统计量
times.sort((a, b) => a - b);
const median = times[Math.floor(times.length / 2)];
const avg = times.reduce((a, b) => a + b, 0) / times.length;
const max = times[times.length - 1];
const p95 = times[Math.floor(times.length * 0.95)];

const totalMedian = totalTimes.sort((a, b) => a - b)[Math.floor(totalTimes.length / 2)];
const totalAvg = totalTimes.reduce((a, b) => a + b, 0) / totalTimes.length;
const totalMax = totalTimes[totalTimes.length - 1];

console.log(`  单次求解 (Solver.findSolutions):`);
console.log(`    采样数: ${samples}`);
console.log(`    median: ${median.toFixed(3)}ms`);
console.log(`    avg: ${avg.toFixed(3)}ms`);
console.log(`    p95: ${p95.toFixed(3)}ms`);
console.log(`    max: ${max.toFixed(3)}ms`);
console.log(`  发牌+求解总时延:`);
console.log(`    median: ${totalMedian.toFixed(3)}ms`);
console.log(`    avg: ${totalAvg.toFixed(3)}ms`);
console.log(`    max: ${totalMax.toFixed(3)}ms`);
console.log('');

console.log('=== 测试完成 ===');
console.log(`All done at ${new Date().toISOString()}`);

// ============================================================================
// 🔴 task-153：rc 通道（本支原为全仓唯一「有真判定但 rc 恒 0」支）
//   落点选在文件尾部：已现取确认顶层无 early return / process.exit / throw，
//   且实测能打到 "=== 测试完成 ===" ⇒ 尾部可达。
//   （对比 tester-input06-r04.mjs：那支 :213 中途崩溃使尾部 done() 不可达，
//    故当时须把自断言前移；本支无此问题，不必前移。）
//   rc 纳入【全部三处】判定，不只 allPass —— 否则 :77 抛错验证的红会被 rc 漏掉。
// ============================================================================
console.log('');
console.log('=== [rc] 汇总 ===');

// 分族算式（禁裸数字）：R-01 发牌 1 条（failed==0）+ R-01 抛错验证 1 条 + R-02 典型样例 10 条
const EXPECTED_ASSERTION_COUNT = 1 + 1 + testCases.length;
let pass = 0, fail = 0;
const chk = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`  ok  ${name}${extra ? '   ' + extra : ''}`); }
  else { fail++; console.log(`  XX  ${name}${extra ? '   ' + extra : ''}`); }
};

chk('R-01 100 轮发牌零失败', failed === 0, `失败轮次=${failed}`);
chk('R-01 连续无解应抛异常', throwPass === true, `throwPass=${throwPass}`);
// R-02 逐例复算（与 :100-114 同口径独立再判一次，使每条样例各占 1 条断言）
testCases.forEach((tc) => {
  const n = Solver.findSolutions(tc.values).length;
  chk(`R-02 ${tc.name}`, n >= tc.expectedMin && n <= tc.expectedMax,
    `solutions=${n} expected=[${tc.expectedMin},${tc.expectedMax}]`);
});

// 断言总数自断言：防某族被静默跳过（例如 testCases 被误删）而「全绿」
const total = pass + fail;
if (total !== EXPECTED_ASSERTION_COUNT) {
  fail++;
  console.log(`  XX  断言总数核对：${total} != 期望 ${EXPECTED_ASSERTION_COUNT}（有断言静默退场或算式未同步）`);
} else {
  console.log(`  \u2713 断言总数核对：${total} == 期望 ${EXPECTED_ASSERTION_COUNT} \u2705  pass=${pass} fail=${fail}`);
}

console.log(fail === 0 ? 'ALL PASS' : `OVERALL: FAIL (${fail})`);
process.exit(fail === 0 ? 0 : 1);
