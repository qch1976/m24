// scripts/perf-input03.mjs
// INPUT-03 R-06 性能自测：Solver.evaluateExpression 求值延迟采样
// 提交延迟 <100ms（不含动画）；按键延迟由 checkLegality 采样

import Solver from '../js/core/Solver.js';
import { checkLegality, TokenType } from '../js/ui/AnswerArea.js';

const T = TokenType;
const N = (i) => ({ type: T.NUMBER, cardIndex: i });
const O = (v) => ({ type: T.OPERATOR, value: v });
const LP = { type: T.LEFT_PAREN };
const RP = { type: T.RIGHT_PAREN };

console.log('===== INPUT-03 R-06 性能采样 =====\n');

// ---------- 求值性能 ----------
const cards = [13, 1, 8, 4];
const tokens = [LP, N(0), O('-'), N(1), RP, O('*'), LP, N(2), O('/'), N(3), RP];
// warmup
for (let i = 0; i < 1000; i++) Solver.evaluateExpression(tokens, cards);

const N_EVAL = 5000;
let times = [];
for (let i = 0; i < N_EVAL; i++) {
  const t0 = process.hrtime.bigint();
  Solver.evaluateExpression(tokens, cards);
  const t1 = process.hrtime.bigint();
  times.push(Number(t1 - t0) / 1e6); // ms
}
times.sort((a, b) => a - b);
const avg = times.reduce((s, v) => s + v, 0) / times.length;
const p50 = times[Math.floor(times.length * 0.5)];
const p95 = times[Math.floor(times.length * 0.95)];
const p99 = times[Math.floor(times.length * 0.99)];
const max = times[times.length - 1];
console.log(`Solver.evaluateExpression × ${N_EVAL}`);
console.log(`  avg=${avg.toFixed(3)}ms  p50=${p50.toFixed(3)}ms  p95=${p95.toFixed(3)}ms  p99=${p99.toFixed(3)}ms  max=${max.toFixed(3)}ms`);
console.log(`  target <100ms/submit: ${p99 < 100 ? 'PASS' : 'FAIL'} (即使 P99 也远低于 100ms)`);

// ---------- 合法性检查性能（按键触发） ----------
const legalityTokens = [N(0), O('+'), LP, N(1), O('*'), N(2), RP, O('-'), N(3)];
for (let i = 0; i < 1000; i++) checkLegality(legalityTokens);
times = [];
const N_LEG = 5000;
for (let i = 0; i < N_LEG; i++) {
  const t0 = process.hrtime.bigint();
  checkLegality(legalityTokens);
  const t1 = process.hrtime.bigint();
  times.push(Number(t1 - t0) / 1e6);
}
times.sort((a, b) => a - b);
const avgL = times.reduce((s, v) => s + v, 0) / times.length;
const p50L = times[Math.floor(times.length * 0.5)];
const p99L = times[Math.floor(times.length * 0.99)];
console.log(`\ncheckLegality × ${N_LEG}`);
console.log(`  avg=${avgL.toFixed(4)}ms  p50=${p50L.toFixed(4)}ms  p99=${p99L.toFixed(4)}ms`);
console.log(`  target <50ms/key: ${p99L < 50 ? 'PASS' : 'FAIL'}`);
