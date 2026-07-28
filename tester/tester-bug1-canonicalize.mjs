// tester-bug1-canonicalize.mjs
// INPUT-04 bugfix 独立验收 · Bug 1（Critical）：v2 canonicalize 合并同一解 + 硬约束
// 作者：worker3 (Tester)
// 依据：INPUT-04 bugfix 87 号方案 §1；task-42 验收目标 Bug 1
// 独立采样：不引用 worker2 的 selftest 日志
//
// 断言项：
//   A. [5,6,6,7] top 8 unique v2 keys == 4，总解数 <= 7（原 10）
//   B. 硬约束：
//      B1. a÷(b×c)  ≠ (a÷b)÷c    （÷ 保序）
//      B2. a - b    ≠  b - a
//      B3. a ÷ a    未化简为 1（结构层保留）
//      B4. a - a    未消元 0
//   C. 正常等价：a × b == b × a、a + b == b + a
//   D. 5+ 采样：多组牌局 v1 vs v2 unique key 数量对比

import * as S from '../js/core/Solver.mjs';

const {
  toCanonicalKey,
  toCanonicalKeyV2,
  findSolutionsWithAST,
  intToFraction,
} = S;

// ---- 手工 AST 构造（避开 parser 依赖）----
function num(n) {
  return { op: 'num', value: intToFraction(n), label: String(n) };
}
function bin(op, l, r) {
  return { op, args: [l, r] };
}

// ---- 断言工具 ----
let PASS = 0, FAIL = 0;
const cases = [];
function assertEq(name, a, b) {
  const ok = a === b;
  cases.push({ name, ok, a, b, kind: 'eq' });
  ok ? PASS++ : FAIL++;
}
function assertNeq(name, a, b) {
  const ok = a !== b;
  cases.push({ name, ok, a, b, kind: 'neq' });
  ok ? PASS++ : FAIL++;
}
function assertTrue(name, cond, detail = '') {
  cases.push({ name, ok: !!cond, a: detail, b: '', kind: 'true' });
  cond ? PASS++ : FAIL++;
}

console.log('=== Bug1: [5,6,6,7] 集成回归 ===');
const sols5667 = findSolutionsWithAST([5, 6, 6, 7]);
console.log('Total solutions (v2 canonicalize) =', sols5667.length);
for (const s of sols5667) {
  console.log('  ', s.expr, '| key =', s.key);
}
assertTrue('[5,6,6,7] 总解数应 <= 7 (原 10)', sols5667.length <= 7, `实际 ${sols5667.length}`);
assertTrue('[5,6,6,7] 总解数应 >= 3', sols5667.length >= 3, `实际 ${sols5667.length}`);

// Top 8 unique keys —— 因 v2 已合并，findSolutionsWithAST 出口本身就没有重复 key，
// 但按项目主 87 方案要求验证：从 v1 视角原 top 8 = 8 keys → v2 应合并到 4
// 这里从 raw 层做一次采样：直接用 v2 处理 v1 生成的原始 10 条 AST
const raw10Trees = [
  // 手工构造 [5,6,6,7] 的 10 条原 AST（从 87 方案附录 A 抄）
  // 1. (((5+6)+6)+7)
  bin('+', bin('+', bin('+', num(5), num(6)), num(6)), num(7)),
  // 2. (((5+6)-7)*6)
  bin('*', bin('-', bin('+', num(5), num(6)), num(7)), num(6)),
  // 3. (((5-7)+6)*6)
  bin('*', bin('+', bin('-', num(5), num(7)), num(6)), num(6)),
  // 4. (((6*6)-5)-7)
  bin('-', bin('-', bin('*', num(6), num(6)), num(5)), num(7)),
  // 5. (((6*6)-7)-5)
  bin('-', bin('-', bin('*', num(6), num(6)), num(7)), num(5)),
  // 6. (((6-7)+5)*6)
  bin('*', bin('+', bin('-', num(6), num(7)), num(5)), num(6)),
  // 7. ((5-(7-6))*6)
  bin('*', bin('-', num(5), bin('-', num(7), num(6))), num(6)),
  // 8. ((6*6)-(5+7))
  bin('-', bin('*', num(6), num(6)), bin('+', num(5), num(7))),
  // 9. ((6-(7-5))*6)
  bin('*', bin('-', num(6), bin('-', num(7), num(5))), num(6)),
  // 10. ((7-5)*(6+6))
  bin('*', bin('-', num(7), num(5)), bin('+', num(6), num(6))),
];
const raw10V1Keys = new Set(raw10Trees.map(toCanonicalKey));
const raw10V2Keys = new Set(raw10Trees.map(toCanonicalKeyV2));
// 「top 8」是 87 方案在 v1 视角下 verify-bug1 前 8 行；v2 视角完整 10 行应合并为 4
const raw8Trees = raw10Trees.slice(0, 8);
const raw8V1Keys = new Set(raw8Trees.map(toCanonicalKey));
const raw8V2Keys = new Set(raw8Trees.map(toCanonicalKeyV2));
console.log('\n【前 8 行 - 87 方案 verify-bug1 采样】');
console.log('  top 8 unique v1 keys =', raw8V1Keys.size);
console.log('  top 8 unique v2 keys =', raw8V2Keys.size);
console.log('【全部 10 行】');
console.log('  total 10 unique v1 keys =', raw10V1Keys.size);
console.log('  total 10 unique v2 keys =', raw10V2Keys.size);
assertEq('top 8 unique v1 keys = 8', raw8V1Keys.size, 8);
// 任务描述「top 8 unique keys 8→4 (K_A/K_B/K_C + 独立解)」用词不严谨——
// 「独立解 (7-5)×(6+6)」实际排在第 10 位（v1 expr 字典序），不在前 8 中。
// 前 8 行 v2 视角只有 3 group (K_A/K_B/K_C)；全部 10 行 v2 视角是 4 group。
// 我按后者判定：10→4 是 87 方案 §1.3 §1.4.3 的实际目标
assertEq('top 8 unique v2 keys = 3 (K_A/K_B/K_C, 独立解 K_D 在第 10 位)', raw8V2Keys.size, 3);
assertEq('总 10 raw → v2 unique = 4 (K_A + K_B + K_C + K_D)', raw10V2Keys.size, 4);

// 明列各 group 同 key（Group A: 2,3,6,7 → 索引 1,2,5,6）
const gA = [1, 2, 5, 6].map(i => toCanonicalKeyV2(raw10Trees[i]));
console.log('\nGroup A keys:', gA);
assertEq('Group A: [((5+6)-7)*6] vs [((5-7)+6)*6]', gA[0], gA[1]);
assertEq('Group A: [((5-7)+6)*6] vs [((6-7)+5)*6]', gA[1], gA[2]);
assertEq('Group A: [((6-7)+5)*6] vs [(5-(7-6))*6]', gA[2], gA[3]);

// Group B: 4,5,8 → 索引 3,4,7
const gB = [3, 4, 7].map(i => toCanonicalKeyV2(raw10Trees[i]));
console.log('Group B keys:', gB);
assertEq('Group B: [((6*6)-5)-7] vs [((6*6)-7)-5]', gB[0], gB[1]);
assertEq('Group B: [((6*6)-7)-5] vs [(6*6)-(5+7)]', gB[1], gB[2]);

// ---- 硬约束 ----
console.log('\n=== Bug1: 硬约束验证 ===');
// B1. a÷(b×c) ≠ (a÷b)÷c
{
  const t1 = bin('/', num(8), bin('*', num(3), num(3)));       // 8 / (3*3)
  const t2 = bin('/', bin('/', num(8), num(3)), num(3));       // (8/3)/3
  const k1 = toCanonicalKeyV2(t1), k2 = toCanonicalKeyV2(t2);
  console.log('  a÷(b×c):', k1);
  console.log('  (a÷b)÷c:', k2);
  assertNeq('B1 硬约束：a÷(b×c) ≠ (a÷b)÷c', k1, k2);
}
// B2. a-b ≠ b-a
{
  const t1 = bin('-', num(5), num(3));
  const t2 = bin('-', num(3), num(5));
  const k1 = toCanonicalKeyV2(t1), k2 = toCanonicalKeyV2(t2);
  console.log('  5-3 key:', k1, ' | 3-5 key:', k2);
  assertNeq('B2 硬约束：a-b ≠ b-a', k1, k2);
}
// B3. a÷a 未化简
{
  const t = bin('/', num(5), num(5));
  const k = toCanonicalKeyV2(t);
  console.log('  5÷5 key:', k);
  assertNeq('B3 硬约束：a÷a 不化简为 num(1)', k, toCanonicalKeyV2(num(1)));
  assertTrue('B3 硬约束：a÷a 保留 (/|...|...)', k.startsWith('(/|'));
}
// B4. a-a 未消元
{
  const t = bin('-', num(5), num(5));
  const k = toCanonicalKeyV2(t);
  console.log('  5-5 key:', k);
  assertNeq('B4 硬约束：a-a 不消元为 0', k, toCanonicalKeyV2(num(0)));
  // 应保留两个 term：+n5 和 -n5
  assertTrue('B4 硬约束：a-a 保留两个符号项', k.includes('+n5/1') && k.includes('-n5/1'));
}

// ---- 正常等价（不因 Bug1 而破坏）----
console.log('\n=== Bug1: 正常等价（未同化）===');
// C1. a×b == b×a
{
  const k1 = toCanonicalKeyV2(bin('*', num(5), num(6)));
  const k2 = toCanonicalKeyV2(bin('*', num(6), num(5)));
  assertEq('C1 正常：a×b == b×a', k1, k2);
}
// C2. a+b == b+a
{
  const k1 = toCanonicalKeyV2(bin('+', num(5), num(6)));
  const k2 = toCanonicalKeyV2(bin('+', num(6), num(5)));
  assertEq('C2 正常：a+b == b+a', k1, k2);
}
// C3. (a+b)+c == a+(b+c)
{
  const k1 = toCanonicalKeyV2(bin('+', bin('+', num(1), num(2)), num(3)));
  const k2 = toCanonicalKeyV2(bin('+', num(1), bin('+', num(2), num(3))));
  assertEq('C3 正常：(a+b)+c == a+(b+c)', k1, k2);
}
// C4. a×(b×c) == (a×b)×c
{
  const k1 = toCanonicalKeyV2(bin('*', num(2), bin('*', num(3), num(4))));
  const k2 = toCanonicalKeyV2(bin('*', bin('*', num(2), num(3)), num(4)));
  assertEq('C4 正常：a×(b×c) == (a×b)×c', k1, k2);
}

// ---- 5+ 采样牌局：v1 vs v2 unique key 对比 ----
console.log('\n=== Bug1: 5+ 采样牌局 v1 vs v2 对比 ===');
const decks = [
  [5, 6, 6, 7],   // task-42 明列
  [3, 3, 8, 8],   // task-42 明列 (INPUT-02 唯一解)
  [1, 5, 5, 5],   // task-42 明列
  [1, 3, 4, 6],
  [3, 3, 7, 7],
  [2, 3, 4, 6],   // 常见多解
];
for (const deck of decks) {
  // 采集 v1 keys（旧算法）—— 通过 findSolutionsWithAST 得到 ast 再手工用 v1
  const solsV2 = findSolutionsWithAST(deck);
  // 需要 raw：暂无 raw 接口。用 v2 结果的 ast 再套 v1 观察去重情况
  const v1Keys = new Set(solsV2.map(s => toCanonicalKey(s.ast)));
  const v2Keys = new Set(solsV2.map(s => toCanonicalKeyV2(s.ast)));
  console.log(`  deck ${JSON.stringify(deck)}: v2 return ${solsV2.length} sols;`
    + ` v1 view unique = ${v1Keys.size} ; v2 view unique = ${v2Keys.size}`);
  // v2 出口 (findSolutionsWithAST) 内部已用 v2 dedup → v2Keys.size == solsV2.length
  assertEq(`deck ${JSON.stringify(deck)} v2 结果无 v2-key 重复`, v2Keys.size, solsV2.length);
}

// [3,3,8,8] INPUT-02 契约：只有 1 解
{
  const s = findSolutionsWithAST([3, 3, 8, 8]);
  console.log('\n  [3,3,8,8] 解:', s.map(x => x.expr));
  assertEq('[3,3,8,8] 唯一解', s.length, 1);
}

// [1,5,5,5]：项目主明列
{
  const s = findSolutionsWithAST([1, 5, 5, 5]);
  console.log('  [1,5,5,5] 解 (' + s.length + '):', s.map(x => x.expr));
  assertTrue('[1,5,5,5] 至少 1 解', s.length >= 1);
}

// ---- 结果汇总 ----
console.log('\n=========================================');
console.log(`BUG1 TOTAL: pass=${PASS} fail=${FAIL}`);
console.log(`OVERALL: ${FAIL === 0 ? 'PASS ✅' : 'FAIL ❌'}`);
console.log('=========================================');
if (FAIL > 0) {
  console.log('\n失败明细:');
  for (const c of cases) if (!c.ok) console.log('  ✗', c.name, '| got:', c.a, ' expected relation to:', c.b);
  process.exit(1);
}
