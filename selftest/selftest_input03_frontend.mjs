// scripts/selftest_input03_frontend.mjs
// INPUT-03 前端约束单元自测：AnswerArea.checkLegality
// 运行：node scripts/selftest_input03_frontend.mjs

import { checkLegality, TokenType } from '../js/ui/AnswerArea.js';

const T = TokenType;
const N = (i) => ({ type: T.NUMBER, cardIndex: i });
const O = (v) => ({ type: T.OPERATOR, value: v });
const LP = { type: T.LEFT_PAREN };
const RP = { type: T.RIGHT_PAREN };

const rs = [];
function assert(name, cond, extra) {
  rs.push({ name, pass: !!cond, extra: extra || '' });
  console.log(`[${cond ? 'PASS' : 'FAIL'}] ${name}${extra ? ' | ' + extra : ''}`);
}

console.log('===== INPUT-03 前端约束（checkLegality）单元自测 =====\n');

// 合法且用满 4 张
{
  const r = checkLegality([N(0), O('+'), N(1), O('+'), N(2), O('+'), N(3)]);
  assert('L1. 1+2+3+4 合法且用满', r.legal && r.allCardsUsed, `reason=${r.reason}`);
}
{
  const r = checkLegality([LP, N(0), O('-'), N(1), RP, O('*'), LP, N(2), O('/'), N(3), RP]);
  assert('L2. (a-b)*(c/d) 合法用满', r.legal && r.allCardsUsed);
}

// 合法但未用满 → allCardsUsed=false（可用于 canSubmit 判定）
{
  const r = checkLegality([N(0), O('+'), N(1)]);
  assert('L3. 1+2 合法但未用满', r.legal && !r.allCardsUsed);
}

// 非法：以二元运算符开头
{
  const r = checkLegality([O('+'), N(0)]);
  assert('N1. +a 非法（开头运算符）', !r.legal && r.reason === 'op_start');
}

// 非法：结尾运算符
{
  const r = checkLegality([N(0), O('+')]);
  assert('N2. a+ 非法（结尾运算符）', !r.legal && r.reason === 'op_end');
}

// 非法：连续两个二元运算符
{
  const r = checkLegality([N(0), O('+'), O('+'), N(1)]);
  assert('N3. a++b 非法（连续运算符）', !r.legal && r.reason === 'op_after_op_or_lparen');
}

// 非法：左括号后紧接运算符
{
  const r = checkLegality([LP, O('+'), N(0), RP]);
  assert('N4. (+a) 非法', !r.legal);
}

// 非法：括号不匹配
{
  const r = checkLegality([LP, N(0), O('+'), N(1)]);
  assert('N5. (a+b 非法（缺右括号）', !r.legal && r.reason === 'paren_mismatch');
}
{
  const r = checkLegality([N(0), O('+'), N(1), RP]);
  assert('N6. a+b) 非法（多余右括号）', !r.legal && r.reason === 'paren_mismatch');
}

// 非法：数字后直接接左括号（隐式乘）
{
  const r = checkLegality([N(0), LP, N(1), O('+'), N(2), RP]);
  assert('N7. a(b+c) 非法（隐式乘）', !r.legal && r.reason === 'implicit_mul');
}

// 非法：右括号后直接接数字
{
  const r = checkLegality([LP, N(0), O('+'), N(1), RP, N(2)]);
  assert('N8. (a+b)c 非法', !r.legal && r.reason === 'implicit_mul');
}

// 非法：牌重复使用
{
  const r = checkLegality([N(0), O('+'), N(0)]);
  assert('N9. 牌重复使用非法', !r.legal && r.reason === 'card_reused');
}

// 非法：空括号
{
  const r = checkLegality([LP, RP]);
  assert('N10. () 空括号非法', !r.legal);
}

console.log('\n===== SUMMARY =====');
const passed = rs.filter((r) => r.pass).length;
const failed = rs.filter((r) => !r.pass);
console.log(`total=${rs.length}  pass=${passed}  fail=${failed.length}`);
if (failed.length > 0) {
  for (const f of failed) console.log('  FAIL:', f.name, f.extra);
  process.exit(1);
}
