// selftest_input04_bugfix_v3_bug51.mjs
// INPUT-04 收尾（v3）· Solver bug51 独立回归 selftest（正式化命名 + GCD 约简盲区补齐）
// 依据: 92/94/98 号命名族对齐 + 99 号（task-48）Architect 报告 §4.5 建议
// 覆盖:
//   T-01/02/03/04/05/06/07/08/09/10 = 92 号 v2 已有单元层用例（迁移过来）
//   T-03.5   负例硬约束 — 6÷2 != 3 （防 GCD 越界代数化简到叶子）
//   T-05.5   正例语义   — 8÷2 == 4×1
//   T-05.6   正例语义   — (3×4)÷(2×6) == 1×1（值=1 空多重集）
//   T-05.7   正例减枝   — [3,5,6,8] 解数 == 4（fc3f1cc=12，276b824=4，防退化）
// 硬约束:
//   - 只使用 export API：toCanonicalKeyV2 / findSolutionsWithAST / formatExprPretty / intToFraction
//   - 不直接读 Solver 内部 _flattenMulDivFactors / _cleanupMulDivFactors 私有函数
//   - selftest 不修改任何生产文件，仅从 js/core/Solver.mjs 只读加载
//
// 使用: node selftest/selftest_input04_bugfix_v3_bug51.mjs > selftest/selftest_input04_bugfix_v3_bug51.log
// 退出码: 0=全 pass, 1=有 fail

import { toCanonicalKeyV2, findSolutionsWithAST, formatExprPretty, intToFraction } from '../js/core/Solver.mjs';
import Solver from '../js/core/Solver.mjs';
import { track, done } from './_diag.mjs';
// task-73: track() 包装，中途 throw 时仍可报「跑到第几项、哪项炸的」
const ok = track(_okRaw);

let pass = 0, fail = 0;
function _okRaw(name, cond, detail) {
  const line = (cond ? 'PASS' : 'FAIL') + ' - ' + name + (detail ? ' | ' + detail : '');
  console.log(line);
  if (cond) pass++; else fail++;
}

function num(n) { return { op: 'num', value: intToFraction(n), label: String(n) }; }
function bop(op, l, r) { return { op, args: [l, r] }; }

// ============================================================
// 单元层：T-01 ~ T-10（Bug5.1 归一 + Bugfix 乘除链扁平化，继承 92 号 v2）
// ============================================================

// T-01: a×1 ≡ a÷1
{
  const A = bop('*', num(3), num(1));
  const B = bop('/', num(3), num(1));
  ok('T-01 a×1 ≡ a÷1', toCanonicalKeyV2(A) === toCanonicalKeyV2(B),
     `k(a×1)=${toCanonicalKeyV2(A)}  k(a÷1)=${toCanonicalKeyV2(B)}`);
}

// T-02: a×1 ≠ a （硬约束：不代数化简）
{
  const A = bop('*', num(3), num(1));
  const B = num(3);
  ok('T-02 a×1 ≠ a', toCanonicalKeyV2(A) !== toCanonicalKeyV2(B));
}

// T-03: a×2 ≠ a÷2 （仅 1 归一）
{
  const A = bop('*', num(6), num(2));
  const B = bop('/', num(6), num(2));
  ok('T-03 a×2 ≠ a÷2', toCanonicalKeyV2(A) !== toCanonicalKeyV2(B));
}

// T-03.5（新）: 6÷2 !== 3 （防 GCD 越界代数化简到叶子）
// GCD 约简后 6÷2 => (*|n3/1)，与 leaf 3 的 key n3/1 结构不同 => 硬约束保留
{
  const A = bop('/', num(6), num(2));
  const B = num(3);
  const kA = toCanonicalKeyV2(A);
  const kB = toCanonicalKeyV2(B);
  ok('T-03.5 6÷2 !== 3 (GCD 不越界到叶子)', kA !== kB,
     `k(6÷2)=${kA}  k(3)=${kB}`);
}

// T-04: [1,2,8,8] 解数 ≤ 6
{
  const sols = findSolutionsWithAST([1, 2, 8, 8]);
  ok('T-04 [1,2,8,8] 解数 ≤ 6', sols.length <= 6, `now=${sols.length}`);
}

// T-05: [1,3,3,5] 解数 ≤ 8
{
  const sols = findSolutionsWithAST([1, 3, 3, 5]);
  ok('T-05 [1,3,3,5] 解数 ≤ 8', sols.length <= 8, `now=${sols.length}`);
}

// T-05.5（新）: 8÷2 === 4×1 （GCD 约简正确归入同一等价类）
{
  const A = bop('/', num(8), num(2));
  const B = bop('*', num(4), num(1));
  const kA = toCanonicalKeyV2(A);
  const kB = toCanonicalKeyV2(B);
  ok('T-05.5 8÷2 === 4×1 (GCD 约简同类)', kA === kB,
     `k(8÷2)=${kA}  k(4×1)=${kB}`);
}

// T-05.6（新）: (3×4)÷(2×6) === 1×1 （值=1 空多重集）
{
  const A = bop('/', bop('*', num(3), num(4)), bop('*', num(2), num(6)));
  const B = bop('*', num(1), num(1));
  const kA = toCanonicalKeyV2(A);
  const kB = toCanonicalKeyV2(B);
  ok('T-05.6 (3×4)÷(2×6) === 1×1 (空多重集)', kA === kB,
     `k((3×4)÷(2×6))=${kA}  k(1×1)=${kB}`);
}

// T-05.7（新）: [3,5,6,8] 解数 === 4（fc3f1cc=12，276b824=4，防退化到旧 12 解）
{
  const sols = findSolutionsWithAST([3, 5, 6, 8]);
  ok('T-05.7 [3,5,6,8] 解数 === 4 (防退化到旧 12 解)', sols.length === 4,
     `now=${sols.length}`);
  sols.forEach((s, i) => console.log(`  [T-05.7 #${i+1}] pretty=${formatExprPretty(s.ast)}`));
}

// T-06: 1÷a 不归一（值为 1/a ≠ a）
{
  const A = bop('/', num(1), num(3));
  const B = bop('*', num(3), num(1));
  ok('T-06 1÷a ≠ a×1', toCanonicalKeyV2(A) !== toCanonicalKeyV2(B),
     `k(1÷3)=${toCanonicalKeyV2(A)}  k(3×1)=${toCanonicalKeyV2(B)}`);
}

// T-07: a×1×1 ≡ a÷1÷1
{
  const A = bop('*', bop('*', num(3), num(1)), num(1));
  const B = bop('/', bop('/', num(3), num(1)), num(1));
  ok('T-07 a×1×1 ≡ a÷1÷1', toCanonicalKeyV2(A) === toCanonicalKeyV2(B),
     `k=${toCanonicalKeyV2(A)}`);
}

// T-08: a×1÷1 ≡ a÷1×1
{
  const A = bop('/', bop('*', num(3), num(1)), num(1));
  const B = bop('*', bop('/', num(3), num(1)), num(1));
  ok('T-08 a×1÷1 ≡ a÷1×1', toCanonicalKeyV2(A) === toCanonicalKeyV2(B));
}

// T-09: (a×1)+b ≡ (a÷1)+b
{
  const A = bop('+', bop('*', num(3), num(1)), num(5));
  const B = bop('+', bop('/', num(3), num(1)), num(5));
  ok('T-09 (a×1)+b ≡ (a÷1)+b', toCanonicalKeyV2(A) === toCanonicalKeyV2(B));
}

// T-10: hasSolution 与 findSolutionsWithAST 一致（同类布尔断言）
{
  const testCases = [
    [1, 2, 8, 8], [3, 3, 3, 3], [1, 1, 1, 1], [1, 4, 8, 13],
    [4, 4, 10, 10], [1, 2, 3, 4], [2, 7, 11, 13], [3, 5, 6, 8],
    [8, 3, 3, 8], [5, 5, 5, 1]
  ];
  let hasSolFail = 0;
  for (const nums of testCases) {
    const withAST = findSolutionsWithAST(nums).length > 0;
    const legacy = Solver.isSolvable(nums);
    if (withAST !== legacy) {
      console.log(`  FAIL nums=${nums} withAST=${withAST} isSolvable=${legacy}`);
      hasSolFail++;
    }
  }
  ok('T-10 hasSolution 与 findSolutionsWithAST 一致 (10 副牌)', hasSolFail === 0);
}

// ============================================================
// 硬约束回归（继承 92 号 v2）
// ============================================================

// H1: a÷(b×c) ≡ (a÷b)÷c （乘除链扁平化归一）
{
  const A = bop('/', num(8), bop('*', num(3), num(3)));
  const B = bop('/', bop('/', num(8), num(3)), num(3));
  ok('H1 a÷(b×c) ≡ (a÷b)÷c', toCanonicalKeyV2(A) === toCanonicalKeyV2(B),
     `k1=${toCanonicalKeyV2(A)}  k2=${toCanonicalKeyV2(B)}`);
}

// H2: a-b ≠ b-a （硬约束：减法不对称）
{
  const A = bop('-', num(5), num(3));
  const B = bop('-', num(3), num(5));
  ok('H2 a-b ≠ b-a', toCanonicalKeyV2(A) !== toCanonicalKeyV2(B));
}

// ============================================================
// SUMMARY
// ============================================================
console.log('');
console.log('============ SUMMARY ============');
console.log(`total=${pass + fail}  pass=${pass}  fail=${fail}`);
console.log(`OVERALL: ${fail === 0 ? 'PASS' : 'FAIL'}`);
done(pass, fail);
process.exit(fail === 0 ? 0 : 1);
