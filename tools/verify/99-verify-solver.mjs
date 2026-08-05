// 验证 276b824 版 Solver 去重是否满足 30 项回归金字塔单元层 T-01~T-10 硬约束
// 直接 import js/core/Solver.js（ESM）
import { toCanonicalKeyV2, intToFraction, findSolutionsWithAST } from '../../js/core/Solver.mjs';

const n = (v) => ({ op: 'num', value: intToFraction(v), label: String(v) });
const bin = (op, l, r) => ({ op, args: [l, r] });

const cases = [
  // T-01: a×1 ≡ a÷1
  { id: 'T-01', desc: 'a×1 ≡ a÷1 同 canonical key', assert: 'equal',
    a: bin('*', n(3), n(1)), b: bin('/', n(3), n(1)) },
  // T-02: a×1 ≠ a （不代数化简）
  { id: 'T-02', desc: 'a×1 ≠ a 非回归（不代数化简）', assert: 'neq',
    a: bin('*', n(3), n(1)), b: n(3) },
  // T-03: a×2 ≠ a÷2
  { id: 'T-03', desc: 'a×2 ≠ a÷2 非回归（仅 1 参与才归一）', assert: 'neq',
    a: bin('*', n(6), n(2)), b: bin('/', n(6), n(2)) },
  // T-06: 1÷a ≠ a×1
  { id: 'T-06', desc: '1÷a 非归一', assert: 'neq',
    a: bin('/', n(1), n(3)), b: bin('*', n(3), n(1)) },
  // T-07: a×1×1 ≡ a÷1÷1
  { id: 'T-07', desc: 'a×1×1 ≡ a÷1÷1', assert: 'equal',
    a: bin('*', bin('*', n(3), n(1)), n(1)),
    b: bin('/', bin('/', n(3), n(1)), n(1)) },
  // T-08: a×1÷1 ≡ a÷1×1
  { id: 'T-08', desc: 'a×1÷1 ≡ a÷1×1', assert: 'equal',
    a: bin('/', bin('*', n(3), n(1)), n(1)),
    b: bin('*', bin('/', n(3), n(1)), n(1)) },
  // T-09: (a×1)+b ≡ (a÷1)+b
  { id: 'T-09', desc: '(a×1)+b ≡ (a÷1)+b', assert: 'equal',
    a: bin('+', bin('*', n(3), n(1)), n(5)),
    b: bin('+', bin('/', n(3), n(1)), n(5)) },
];

let pass = 0, fail = 0;
console.log('\n=== T-01 ~ T-09 单元回归（去除 T-04/T-05/T-10 需完整 Solver）===');
for (const c of cases) {
  const ka = toCanonicalKeyV2(c.a);
  const kb = toCanonicalKeyV2(c.b);
  let ok;
  if (c.assert === 'equal') ok = ka === kb;
  else ok = ka !== kb;
  const flag = ok ? '✅' : '❌';
  console.log(`${flag} ${c.id.padEnd(6)} ${c.desc}`);
  console.log(`      keyA = ${ka}`);
  console.log(`      keyB = ${kb}`);
  if (ok) pass++; else fail++;
}

console.log('\n=== T-04/T-05: 解总数验证 ===');
const decks = [
  { id: 'T-04', numbers: [1,2,8,8], threshold: 6 },
  { id: 'T-05', numbers: [1,3,3,5], threshold: 6 },
];
for (const d of decks) {
  const sols = findSolutionsWithAST(d.numbers, 24);
  const ok = sols.length <= d.threshold;
  const flag = ok ? '✅' : '❌';
  console.log(`${flag} ${d.id}  numbers=[${d.numbers}]  解数=${sols.length}  阈值 ≤ ${d.threshold}`);
  if (ok) pass++; else fail++;
}

console.log('\n=== T-10: 20 副典型牌 hasSolution 布尔一致性 ===');
// 用 findSolutionsWithAST 的结果 length>0 代替 hasSolution
const decks20 = [[1,3,5,8],[2,3,4,6],[3,3,8,8],[1,5,5,5],[4,6,7,8],[2,5,7,9],[1,4,10,11],[2,6,6,8],[3,4,7,10],[5,7,8,9],[1,2,3,12],[4,4,10,10],[6,6,6,6],[1,8,12,3],[2,7,11,13],[1,2,8,8],[1,3,3,5],[1,4,6,8],[2,2,10,10],[3,5,6,8]];
let t10_ok = 0, t10_fail = [];
for (const d of decks20) {
  const s = findSolutionsWithAST(d, 24);
  if (s.length > 0) t10_ok++;
  else t10_fail.push(d);
}
// —— task-75(a) 修正期望值：原写「20 副全可解」，但 [2,7,11,13] 经双证确实无 24 解 ——
//    证据：线上 js/core/Solver.mjs findSolutionsWithAST 解数 = 0；
//    另写独立穷举（4! 全排列 × 4 运算符^3 × 5 种括号形态）亦为 0。
//    ⇒ 原期望值错，非产品缺陷。改为「恰好这 1 副不可解」，仍具判红能力：
//      若可解集变多/变少、或不可解者换成别的牌组，均判红。
const T10_KNOWN_UNSOLVABLE = ['2,7,11,13'];
const t10_failKeys = t10_fail.map(d => d.join(','));
const t10_pass = t10_failKeys.length === T10_KNOWN_UNSOLVABLE.length
  && t10_failKeys.every(k => T10_KNOWN_UNSOLVABLE.includes(k));
console.log(`  ${t10_pass ? '✅' : '❌'} T-10  20 副中可解 = ${t10_ok}/20（期望 19/20，[2,7,11,13] 已证无解）`);
if (t10_fail.length > 0) console.log('     不可解者:', t10_fail);
if (!t10_pass) console.log('     ❌ 与已证基线不符，期望不可解集 =', T10_KNOWN_UNSOLVABLE);
if (t10_pass) pass++; else fail++;

console.log('\n=== 补充观测：276b824 GCD 约简是否影响 T-02/T-03 边界 ===');
// GCD 约简：a×2 中如果 a=2，会不会把 (2×2) 和别的解归一？
// 观察 3×3 ≠ 9 是否被 GCD 减掉（3×3 无公因子，不影响；但 6÷2 ≠ 3 呢）
const k_6div2 = toCanonicalKeyV2(bin('/', n(6), n(2)));
const k_3 = toCanonicalKeyV2(n(3));
console.log(`  6÷2 key = ${k_6div2}`);
console.log(`  3   key = ${k_3}`);
console.log(`  是否相等？ ${k_6div2 === k_3 ? '⚠️ 是（GCD 把 6÷2 约成 3，越界代数化简）' : '否'}`);

// 关键盲区探测：4÷2 vs 2
const k_4div2 = toCanonicalKeyV2(bin('/', n(4), n(2)));
const k_2 = toCanonicalKeyV2(n(2));
console.log(`  4÷2 key = ${k_4div2}`);
console.log(`  2   key = ${k_2}`);
console.log(`  是否相等？ ${k_4div2 === k_2 ? '⚠️ 是（GCD 越界）' : '否'}`);

// 复合：(3×4)÷(2×6) vs 1
const k_complex = toCanonicalKeyV2(bin('/', bin('*', n(3), n(4)), bin('*', n(2), n(6))));
const k_1 = toCanonicalKeyV2(n(1));
console.log(`  (3×4)÷(2×6) key = ${k_complex}`);
console.log(`  1           key = ${k_1}`);
console.log(`  是否相等？ ${k_complex === k_1 ? '⚠️ 是' : '否'}`);

console.log(`\n\n========== 汇总：${pass} pass / ${fail} fail ==========`);

// —— task-75(a)：pass/fail 此前已算出但未接退出码（属哑弹）——
console.log(`[99-verify-solver] pass=${pass} fail=${fail}`);
process.exit(fail === 0 ? 0 : 1);
