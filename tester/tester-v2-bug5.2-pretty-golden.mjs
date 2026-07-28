// tester-v2-bug5.2-pretty-golden.mjs
// Bug 5.2 独立验收：formatExprPretty 8 类 Golden (T-11~T-18)
// 独立采样，不引 worker2 selftest 数据

import { formatExprPretty, intToFraction } from '../js/core/Solver.mjs';

const num = (n) => ({ op: 'num', value: intToFraction(n), label: String(n) });
const bin = (op, a, b) => ({ op, args: [a, b] });

let PASS = 0, FAIL = 0;
function checkEq(name, got, want) {
  const ok = got === want;
  console.log(`  ${ok ? '✓' : '✗'} ${name}${ok ? ` = ${got}` : `\n     got: "${got}"\n    want: "${want}"`}`);
  ok ? PASS++ : FAIL++;
}

console.log('=== T-11 (a×b)×c → a×b×c ===');
{
  const t = bin('*', bin('*', num(3), num(5)), num(2));
  checkEq('T-11', formatExprPretty(t), '3×5×2');
}

console.log('\n=== T-12 (a×b)÷c → a×b÷c ===');
{
  const t = bin('/', bin('*', num(3), num(5)), num(2));
  checkEq('T-12', formatExprPretty(t), '3×5÷2');
}

console.log('\n=== T-13 a÷(b×c) 保括号 ===');
{
  const t = bin('/', num(24), bin('*', num(2), num(3)));
  checkEq('T-13', formatExprPretty(t), '24÷(2×3)');
}

console.log('\n=== T-14 (a÷b)÷c → a÷b÷c ===');
{
  const t = bin('/', bin('/', num(24), num(2)), num(3));
  checkEq('T-14', formatExprPretty(t), '24÷2÷3');
}

console.log('\n=== T-15 a÷(b÷c) 保括号 ===');
{
  const t = bin('/', num(24), bin('/', num(6), num(3)));
  checkEq('T-15', formatExprPretty(t), '24÷(6÷3)');
}

console.log('\n=== T-16 a×(b÷c) → a×b÷c ===');
{
  const t = bin('*', num(3), bin('/', num(24), num(3)));
  checkEq('T-16', formatExprPretty(t), '3×24÷3');
}

console.log('\n=== T-17 (a×b)÷(c×d) → a×b÷(c×d) ===');
{
  const t = bin('/', bin('*', num(3), num(4)), bin('*', num(2), num(1)));
  checkEq('T-17', formatExprPretty(t), '3×4÷(2×1)');
}

console.log('\n=== T-18 (2×8+8)×1 括号来自加减，非可去（观感澄清） ===');
{
  const t = bin('*', bin('+', bin('*', num(2), num(8)), num(8)), num(1));
  checkEq('T-18', formatExprPretty(t), '(2×8+8)×1');
}

console.log('\n=== Bug5.2 Hard: a÷(b×c) 和 (a÷b)÷c pretty 显示确实不同 ===');
{
  const t1 = bin('/', num(24), bin('*', num(2), num(3)));  // 24÷(2×3)
  const t2 = bin('/', bin('/', num(24), num(2)), num(3));  // (24÷2)÷3
  const p1 = formatExprPretty(t1);
  const p2 = formatExprPretty(t2);
  const ok = p1 !== p2;
  console.log(`  ${ok ? '✓' : '✗'} Hard 24÷(2×3)="${p1}"  != (24÷2)÷3="${p2}"`);
  ok ? PASS++ : FAIL++;
}

// 附加：Bug1 老 [5,6,6,7] pretty 无 ((( 前缀（归一后仍需成立）
console.log('\n=== 附加：[5,6,6,7] pretty 无 ((( 前缀（Bug 1 v2 回归） ===');
{
  const { findSolutionsWithAST } = await import('../js/core/Solver.mjs');
  const sols = findSolutionsWithAST([5, 6, 6, 7]);
  const prettys = sols.map(s => formatExprPretty(s.ast));
  prettys.forEach(p => console.log(`    ${p}`));
  const bad = prettys.filter(p => p.startsWith('((('));
  const ok = bad.length === 0;
  console.log(`  ${ok ? '✓' : '✗'} 全部 ${prettys.length} 条 pretty 均无 "(((" 前缀`);
  ok ? PASS++ : FAIL++;
}

console.log('\n=========================================');
console.log(`Bug5.2 Golden TOTAL: pass=${PASS} fail=${FAIL}`);
console.log(`OVERALL: ${FAIL === 0 ? 'PASS ✅' : 'FAIL ❌'}`);
console.log('=========================================');
if (FAIL > 0) process.exit(1);
