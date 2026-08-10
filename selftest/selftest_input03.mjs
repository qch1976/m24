// scripts/selftest_input03.mjs
// INPUT-03 单元自测：Solver.evaluateExpression 除零契约 + 结果判定
// 运行：node scripts/selftest_input03.mjs

import Solver from '../js/core/Solver.js';

const T = {
  NUMBER: 'number',
  OP: 'operator',
  LP: 'left_paren',
  RP: 'right_paren',
};
const N = (i) => ({ type: T.NUMBER, cardIndex: i });
const O = (v) => ({ type: T.OP, value: v });
const LP = { type: T.LP };
const RP = { type: T.RP };

const results = [];
function assert(name, cond, extra) {
  results.push({ name, pass: !!cond, extra: extra || '' });
  console.log(`[${cond ? 'PASS' : 'FAIL'}] ${name}${extra ? ' | ' + extra : ''}`);
}

console.log('===== INPUT-03 Solver 单元自测 =====\n');

// ============ 正例：Solver.evaluateExpression ============

// A. (13-1)*(8/4)
{
  const cards = [13, 1, 8, 4];
  const tokens = [LP, N(0), O('-'), N(1), RP, O('*'), LP, N(2), O('/'), N(3), RP];
  const r = Solver.evaluateExpression(tokens, cards);
  assert('A. (13-1)*(8/4)=24', r.success && r.is24, `value=${r.value.num}/${r.value.den}`);
}

// B. 3*3*8/3 用 [3,3,3,8] 结果 24
{
  const c = [3, 3, 3, 8];
  const tokens = [N(0), O('*'), N(1), O('*'), N(3), O('/'), N(2)];
  const r = Solver.evaluateExpression(tokens, c);
  assert('B. 3*3*8/3=24', r.success && r.is24);
}

// C. 6*4 (未用满)
{
  const c = [6, 4, 1, 2];
  const tokens = [N(0), O('*'), N(1)];
  const r = Solver.evaluateExpression(tokens, c);
  assert('C. 6*4 求值成功且=24', r.success && r.is24);
}

// D. 分数中间态 3/(1-3/4)=12
{
  const c = [3, 1, 3, 4];
  const tokens = [N(0), O('/'), LP, N(1), O('-'), N(2), O('/'), N(3), RP];
  const r = Solver.evaluateExpression(tokens, c);
  assert('D. 3/(1-3/4)=12', r.success && r.value.num === 12 && r.value.den === 1);
}

// E. 8*3*1*1=24 (含 A)
{
  const c = [8, 3, 1, 1];
  const tokens = [N(0), O('*'), N(1), O('*'), N(2), O('*'), N(3)];
  const r = Solver.evaluateExpression(tokens, c);
  assert('E. 8*3*1*1=24', r.success && r.is24);
}

// F. K*2-A-A? 13*2-1-1=24
{
  const c = [13, 2, 1, 1];
  const tokens = [N(0), O('*'), N(1), O('-'), N(2), O('-'), N(3)];
  const r = Solver.evaluateExpression(tokens, c);
  assert('F. 13*2-1-1=24', r.success && r.is24);
}

// ============ 除零场景 ============

// G. 直接 10/0
{
  const c = [10, 0, 1, 2];
  const tokens = [N(0), O('/'), N(1)];
  const r = Solver.evaluateExpression(tokens, c);
  assert('G. 10/0 → division_by_zero', !r.success && r.error === 'division_by_zero', `error=${r.error}`);
}

// H. 1/(2-2)
{
  const c = [1, 2, 2, 3];
  const tokens = [N(0), O('/'), LP, N(1), O('-'), N(2), RP];
  const r = Solver.evaluateExpression(tokens, c);
  assert('H. 1/(2-2) → division_by_zero', !r.success && r.error === 'division_by_zero');
}

// I. 大小王(0)作为除数触发除零
{
  const c = [10, 0, 1, 2]; // 索引1 = 大小王
  const tokens = [N(0), O('/'), N(1), O('+'), N(2), O('+'), N(3)];
  const r = Solver.evaluateExpression(tokens, c);
  assert('I. 大小王作除数 → division_by_zero', !r.success && r.error === 'division_by_zero');
}

// J. 中间分子=0 但除数≠0，不是除零：0/5=0
{
  const c = [0, 5, 1, 2];
  const tokens = [N(0), O('/'), N(1)];
  const r = Solver.evaluateExpression(tokens, c);
  assert('J. 0/5=0（合法，非除零）', r.success && r.value.num === 0);
}

// ============ 大小王作为操作数 ============

// K. 0+3*8=24（0 是大小王）
{
  const c = [0, 3, 8, 1];
  const tokens = [N(0), O('+'), N(1), O('*'), N(2)];
  const r = Solver.evaluateExpression(tokens, c);
  assert('K. 0+3*8=24（大小王合法）', r.success && r.is24);
}

// ============ 结果非 24 ============

// L. 1+2+3+4=10
{
  const c = [1, 2, 3, 4];
  const tokens = [N(0), O('+'), N(1), O('+'), N(2), O('+'), N(3)];
  const r = Solver.evaluateExpression(tokens, c);
  assert('L. 1+2+3+4=10 非24', r.success && !r.is24 && r.value.num === 10);
}

// M. 分数结果 1/3 非 24
{
  const c = [1, 3, 5, 7];
  const tokens = [N(0), O('/'), N(1)];
  const r = Solver.evaluateExpression(tokens, c);
  assert('M. 1/3 分数结果 非24', r.success && !r.is24 && r.value.num === 1 && r.value.den === 3);
}

// ============ 非法表达式（Solver 层兜底，前端已拦） ============

// N. 缺右括号
{
  const c = [1, 2, 3, 4];
  const tokens = [LP, N(0), O('+'), N(1)];
  const r = Solver.evaluateExpression(tokens, c);
  assert('N. 缺右括号 → invalid_expression', !r.success && r.error === 'invalid_expression');
}

// O. 空表达式
{
  const c = [1, 2, 3, 4];
  const r = Solver.evaluateExpression([], c);
  assert('O. 空表达式 → invalid_expression', !r.success && r.error === 'invalid_expression');
}

// P. Solver 不返回 Infinity/NaN 检查（所有除零都应命中 error='division_by_zero'）
{
  const c = [1, 0, 0, 0];
  const tokens = [N(0), O('/'), N(1)];
  const r = Solver.evaluateExpression(tokens, c);
  const noBadValue = !r.success ||
    (r.value && Number.isFinite(r.value.num) && Number.isFinite(r.value.den) && r.value.den !== 0);
  assert('P. 结果不含 Infinity/NaN', noBadValue);
}

// ============ 汇总 ============
const passed = results.filter((r) => r.pass).length;
const failed = results.filter((r) => !r.pass);
console.log('\n===== SUMMARY =====');
console.log(`total=${results.length}  pass=${passed}  fail=${failed.length}`);
if (failed.length > 0) {
  for (const f of failed) console.log('  FAIL:', f.name, f.extra);
  process.exit(1);
}
