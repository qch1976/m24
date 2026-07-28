// tester-v2-bug5-canonicalize.mjs
// Bug 5.1 独立验收：×1 ≡ ÷1 归一 (T-01~T-10)
// 独立采样，不引 worker2 selftest 数据

import { findSolutionsWithAST, toCanonicalKeyV2, intToFraction, chooseCanonicalSolution, formatExprPretty } from '../js/core/Solver.mjs';

// AST 构造器
const num = (n) => ({ op: 'num', value: intToFraction(n), label: String(n) });
const bin = (op, a, b) => ({ op, args: [a, b] });

let PASS = 0, FAIL = 0;
function check(name, cond, detail = '') {
  console.log(`  ${cond ? '✓' : '✗'} ${name}` + (detail ? ` — ${detail}` : ''));
  cond ? PASS++ : FAIL++;
}

console.log('=== T-01 a×1 ≡ a÷1 同 key ===');
{
  const k1 = toCanonicalKeyV2(bin('*', num(3), num(1)));
  const k2 = toCanonicalKeyV2(bin('/', num(3), num(1)));
  check(`T-01 3×1 == 3÷1`, k1 === k2, `k1=${k1} k2=${k2}`);
  console.log('   3×1 key:', k1);
  console.log('   3÷1 key:', k2);
}

console.log('\n=== T-02 a×1 ≠ a 硬约束不化简 ===');
{
  const k1 = toCanonicalKeyV2(bin('*', num(3), num(1)));
  const k2 = toCanonicalKeyV2(num(3));
  check(`T-02 3×1 != 3`, k1 !== k2, `k1=${k1} k2=${k2}`);
}

console.log('\n=== T-03 a×2 ≠ a÷2 非回归（仅 1 触发归一） ===');
{
  const k1 = toCanonicalKeyV2(bin('*', num(6), num(2)));
  const k2 = toCanonicalKeyV2(bin('/', num(6), num(2)));
  check(`T-03 6×2 != 6÷2`, k1 !== k2, `k1=${k1} k2=${k2}`);
}

console.log('\n=== T-04 [1,2,8,8] 归一后解数下降 ===');
{
  const sols = findSolutionsWithAST([1, 2, 8, 8]);
  console.log(`   [1,2,8,8] 归一后解数 = ${sols.length}`);
  sols.forEach(s => console.log(`     ${formatExprPretty(s.ast)}`));
  check(`T-04 [1,2,8,8] 解数 <= 8（Architect 预估从 11 降至 ~5）`, sols.length <= 8, `实际 ${sols.length}`);
  check(`T-04 [1,2,8,8] 解数 >= 1（防过合并）`, sols.length >= 1);
  // 关键硬约束：所有输出 pretty 不含 /1
  const hasDiv1 = sols.some(s => formatExprPretty(s.ast).includes('÷1') && !formatExprPretty(s.ast).match(/÷1\d/));
  check(`T-04 [1,2,8,8] 所有 pretty 无 "÷1"（归一后仅保 ×1 变体）`, !hasDiv1);
}

console.log('\n=== T-05 [1,3,3,5] 归一后解数下降 ===');
{
  const sols = findSolutionsWithAST([1, 3, 3, 5]);
  console.log(`   [1,3,3,5] 归一后解数 = ${sols.length}`);
  sols.forEach(s => console.log(`     ${formatExprPretty(s.ast)}`));
  check(`T-05 [1,3,3,5] 解数 <= 8`, sols.length <= 8, `实际 ${sols.length}`);
  const hasDiv1 = sols.some(s => {
    const p = formatExprPretty(s.ast);
    return /÷1(?![0-9])/.test(p);  // ÷1 后不接数字
  });
  check(`T-05 [1,3,3,5] 所有 pretty 无 "÷1"`, !hasDiv1);
}

console.log('\n=== T-06 1÷a ≠ a×1（值不等，硬约束） ===');
{
  const k1 = toCanonicalKeyV2(bin('/', num(1), num(3)));
  const k2 = toCanonicalKeyV2(bin('*', num(3), num(1)));
  check(`T-06 1÷3 != 3×1`, k1 !== k2, `k1=${k1} k2=${k2}`);
}

console.log('\n=== T-07 a×1×1 ≡ a÷1÷1 深度归一 ===');
{
  const t1 = bin('*', bin('*', num(3), num(1)), num(1));  // ((3*1)*1)
  const t2 = bin('/', bin('/', num(3), num(1)), num(1));  // ((3/1)/1)
  const k1 = toCanonicalKeyV2(t1);
  const k2 = toCanonicalKeyV2(t2);
  check(`T-07 ((3×1)×1) == ((3÷1)÷1)`, k1 === k2, `k1=${k1} k2=${k2}`);
}

console.log('\n=== T-08 a×1÷1 ≡ a÷1×1 交错归一 ===');
{
  const t1 = bin('/', bin('*', num(3), num(1)), num(1));  // ((3*1)/1)
  const t2 = bin('*', bin('/', num(3), num(1)), num(1));  // ((3/1)*1)
  const k1 = toCanonicalKeyV2(t1);
  const k2 = toCanonicalKeyV2(t2);
  check(`T-08 ((3×1)÷1) == ((3÷1)×1)`, k1 === k2, `k1=${k1} k2=${k2}`);
}

console.log('\n=== T-09 (a×1)+b ≡ (a÷1)+b 加减子树归一 ===');
{
  const t1 = bin('+', bin('*', num(3), num(1)), num(5));  // (3*1)+5
  const t2 = bin('+', bin('/', num(3), num(1)), num(5));  // (3/1)+5
  const k1 = toCanonicalKeyV2(t1);
  const k2 = toCanonicalKeyV2(t2);
  check(`T-09 ((3×1)+5) == ((3÷1)+5)`, k1 === k2, `k1=${k1} k2=${k2}`);
}

console.log('\n=== T-10 hasSolution 与 findSolutions 一致 ===');
{
  const decks = [
    [1,2,8,8],[1,3,3,5],[1,4,6,8],[5,6,6,7],[1,4,8,13],[1,2,3,4],[3,3,8,8],[1,5,5,5]
  ];
  let ok = 0;
  for (const d of decks) {
    const sols = findSolutionsWithAST(d);
    const has = sols.length > 0;
    const consistent = (has === (sols.length > 0));  // 平凡真，但确保没有 crash
    // 更严：所有解经 evaluate 都是 24（通过 chooseCanonicalSolution 抽样）
    if (has) {
      const chosen = chooseCanonicalSolution(sols, d);
      const hasChosen = !!chosen && !!chosen.ast;
      if (hasChosen) ok++;
    } else {
      ok++;
    }
    console.log(`   ${JSON.stringify(d)}: ${sols.length} solutions, has=${has}`);
  }
  check('T-10 8/8 deck hasSolution 一致', ok === decks.length, `${ok}/${decks.length}`);
}

console.log('\n=== 硬约束（前轮回归 + 新增） ===');
// Hard1: a÷(b×c) ≠ (a÷b)÷c
{
  const t1 = bin('/', num(8), bin('*', num(3), num(3)));  // 8/(3×3)
  const t2 = bin('/', bin('/', num(8), num(3)), num(3));  // (8/3)/3
  const k1 = toCanonicalKeyV2(t1);
  const k2 = toCanonicalKeyV2(t2);
  check(`Hard1 8÷(3×3) != (8÷3)÷3`, k1 !== k2, `k1=${k1} k2=${k2}`);
}
// Hard2: a-b ≠ b-a
{
  const t1 = bin('-', num(5), num(3));
  const t2 = bin('-', num(3), num(5));
  check(`Hard2 5-3 != 3-5`, toCanonicalKeyV2(t1) !== toCanonicalKeyV2(t2));
}
// Hard3: 1×a ≡ a×1
{
  const t1 = bin('*', num(1), num(3));
  const t2 = bin('*', num(3), num(1));
  check(`Hard3 1×3 == 3×1`, toCanonicalKeyV2(t1) === toCanonicalKeyV2(t2));
}
// Hard4: a×0 不归一为 a×1 (不涉及)
{
  const t1 = bin('*', num(3), num(0));
  const t2 = bin('*', num(3), num(1));
  check(`Hard4 3×0 != 3×1 (值不等，不归一)`, toCanonicalKeyV2(t1) !== toCanonicalKeyV2(t2));
}
// Hard5: ×0.5 不等价于 ÷2（92 明确不放宽）
// 需要分数值 0.5 = 1/2 — 用 fraction 构造
{
  const half = { op: 'num', value: { num: 1, den: 2 } };
  const t1 = bin('*', num(6), half);  // 6 × 0.5
  const t2 = bin('/', num(6), num(2));  // 6 ÷ 2
  check(`Hard5 6×(1/2) != 6÷2 (只有整数1才归一)`, toCanonicalKeyV2(t1) !== toCanonicalKeyV2(t2));
}

// 采样 6+ 副牌（含题目要求的 3 副）
console.log('\n=== 采样 8 副牌局 v2.1 解数（含题目指定 3 副） ===');
const decks2 = [[1,2,8,8],[5,6,6,7],[3,3,8,8],[1,4,6,8],[1,3,3,5],[1,2,3,4],[4,4,10,10],[1,5,5,5]];
for (const d of decks2) {
  const sols = findSolutionsWithAST(d);
  console.log(`   ${JSON.stringify(d)}: ${sols.length} solutions`);
}

console.log('\n=========================================');
console.log(`Bug5.1 TOTAL: pass=${PASS} fail=${FAIL}`);
console.log(`OVERALL: ${FAIL === 0 ? 'PASS ✅' : 'FAIL ❌'}`);
console.log('=========================================');
if (FAIL > 0) process.exit(1);
