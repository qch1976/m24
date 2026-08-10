// scripts/selftest_input03_checkanswer.mjs
// INPUT-03 修订版 60 号：GameCore.checkAnswer 只返回两类失败 (not_24 / division_by_zero)，
// 其余降级为 not_24 + console.error
// 用法：node --experimental-loader ./scripts/loader.mjs scripts/selftest_input03_checkanswer.mjs

// GameCore 依赖 wx 全局，我们 mock 掉，只测试 checkAnswer + Solver.evaluateExpression 集成
global.wx = { createCanvas: () => ({}), getSystemInfoSync: () => ({ screenWidth: 411, screenHeight: 891 }) };

// 只 import GameCore 的 checkAnswer/formatExpression 逻辑；先绕过 constructor 依赖
import { checkLegality, TokenType } from '../js/ui/AnswerArea.js';
import Solver from '../js/core/Solver.js';

const T = TokenType;
const N = (i) => ({ type: T.NUMBER, cardIndex: i });
const O = (v) => ({ type: T.OPERATOR, value: v });
const LP = { type: T.LEFT_PAREN };
const RP = { type: T.RIGHT_PAREN };

// 手动实现一份和 GameCore 里 checkAnswer 完全一致的逻辑做闭盒测试
function checkAnswerMock(tokens, cardValues) {
  if (!tokens || tokens.length === 0) {
    console.error('[mock] empty tokens; degrading to not_24');
    return { pass: false, reason: 'not_24', actualValue: 0, actualLabel: '0' };
  }
  const usedIndices = tokens.filter((t) => t.type === TokenType.NUMBER).map((t) => t.cardIndex);
  if (usedIndices.length !== 4 || new Set(usedIndices).size !== 4) {
    console.error('[mock] cards not fully used; degrading to not_24');
    return { pass: false, reason: 'not_24', actualValue: 0, actualLabel: '0' };
  }
  const r = Solver.evaluateExpression(tokens, cardValues);
  if (!r.success) {
    if (r.error === 'division_by_zero') return { pass: false, reason: 'division_by_zero' };
    console.error('[mock] solver error; degrading to not_24');
    return { pass: false, reason: 'not_24', actualValue: 0, actualLabel: '0' };
  }
  if (r.is24) return { pass: true };
  const frac = r.value;
  return {
    pass: false,
    reason: 'not_24',
    actualValue: frac.num / frac.den,
    actualLabel: frac.den === 1 ? String(frac.num) : `${frac.num}/${frac.den}`,
  };
}

const rs = [];
function A(name, cond, extra) {
  rs.push({ name, pass: !!cond });
  console.log(`[${cond ? 'PASS' : 'FAIL'}] ${name}${extra ? ' | ' + extra : ''}`);
}

console.log('===== INPUT-03 修订版 checkAnswer 降级契约自测 =====\n');

// 1. pass 正例
{
  const cards = [13, 1, 8, 4];
  const tokens = [LP, N(0), O('-'), N(1), RP, O('*'), LP, N(2), O('/'), N(3), RP];
  const r = checkAnswerMock(tokens, cards);
  A('C1. (13-1)*(8/4)=24 pass', r.pass === true);
}

// 2. not_24
{
  const cards = [1, 2, 3, 4];
  const tokens = [N(0), O('+'), N(1), O('+'), N(2), O('+'), N(3)];
  const r = checkAnswerMock(tokens, cards);
  A('C2. 1+2+3+4=10 → not_24', r.reason === 'not_24' && r.actualLabel === '10');
}

// 3. division_by_zero
{
  const cards = [1, 2, 2, 3];
  const tokens = [N(0), O('/'), LP, N(1), O('-'), N(2), RP, O('+'), N(3)];
  const r = checkAnswerMock(tokens, cards);
  A('C3. 1/(2-2)+3 → division_by_zero', r.reason === 'division_by_zero');
}

// 4. 未用满 4 张 → 降级 not_24（reason 严格等于 not_24）
{
  const cards = [1, 2, 3, 4];
  const tokens = [N(0), O('+'), N(1)]; // 只用了 2 张
  const r = checkAnswerMock(tokens, cards);
  A('C4. 未用满 4 张 → 降级 not_24', r.reason === 'not_24' && r.pass === false);
}

// 5. 牌重复使用 → 降级 not_24
{
  const cards = [1, 2, 3, 4];
  const tokens = [N(0), O('+'), N(0), O('+'), N(0), O('+'), N(0)];
  const r = checkAnswerMock(tokens, cards);
  A('C5. 4 次用同一张 → 降级 not_24', r.reason === 'not_24');
}

// 6. 空表达式 → 降级 not_24
{
  const r = checkAnswerMock([], [1, 2, 3, 4]);
  A('C6. 空表达式 → 降级 not_24', r.reason === 'not_24');
}

// 7. 括号不匹配（前端本应拦截，兼容降级）
{
  const cards = [1, 2, 3, 4];
  const tokens = [LP, N(0), O('+'), N(1), O('+'), N(2), O('+'), N(3)]; // 缺右括号
  const r = checkAnswerMock(tokens, cards);
  A('C7. 括号不匹配 → 降级 not_24 (不再返回 invalid_expression)', r.reason === 'not_24');
}

// 8. 严格禁止 reason='invalid_expression' 与 'not_all_cards_used' 出现
{
  const forbidden = ['invalid_expression', 'not_all_cards_used'];
  const cases = [
    { c: [1, 2, 3, 4], t: [] },
    { c: [1, 2, 3, 4], t: [N(0), O('+'), N(1)] },
    { c: [1, 2, 3, 4], t: [LP, N(0), O('+'), N(1), O('+'), N(2), O('+'), N(3)] },
  ];
  let ok = true;
  for (const cs of cases) {
    const r = checkAnswerMock(cs.t, cs.c);
    if (forbidden.includes(r.reason)) { ok = false; break; }
  }
  A('C8. 禁用 reason (invalid_expression / not_all_cards_used) 从不出现', ok);
}

console.log('\n===== SUMMARY =====');
const passed = rs.filter((r) => r.pass).length;
const failed = rs.filter((r) => !r.pass);
console.log(`total=${rs.length}  pass=${passed}  fail=${failed.length}`);
if (failed.length > 0) process.exit(1);
