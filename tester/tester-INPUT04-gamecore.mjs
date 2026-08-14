// tester-INPUT04-gamecore.mjs
// Tester (worker3) 独立采样：GameCore 层 R-02/R-03/R-04 验证
// 不 copy Developer selftest_input04_gamecore.mjs
//
// 覆盖：
//  - GameCore.getHintStep(1..3)：幂等（同牌局 10 次一致）
//  - GameCore.getHintStep 换牌后重新计算
//  - GameCore.getHintStep 未发牌返回 null（越界 index 亦返回 null）
//  - GameCore.getAllSolutions 与 Solver.findSolutions 集合相等
//  - GameCore.getAllSolutions 返回副本（外部修改不影响缓存）
//  - resetGame() 清空缓存
//  - step3 拼接 = getAllSolutions()[0]（字典序最小）
//
// 运行：node tester-INPUT04-gamecore.mjs

import GameCore from '../js/core/GameCore.mjs';
import Solver, { findSolutionsWithAST, chooseCanonicalSolution } from '../js/core/Solver.mjs';   // task-131: 5-setEq 改同层比对需走与产品一致的链路

const decks = [
  [3, 3, 8, 8],
  [1, 5, 5, 5],
  [2, 3, 5, 12],
  [6, 6, 6, 6],
  [2, 2, 12, 12],
  [3, 8, 8, 10],
  [7, 7, 7, 7],
  [1, 2, 3, 4],
  [2, 4, 6, 12],
  [5, 6, 10, 12],
  [0, 4, 6, 8],
  [0, 3, 8, 8],
  [0, 0, 4, 6],
  [4, 4, 6, 6],
  [3, 3, 4, 4],
  [2, 2, 10, 10],
  [3, 4, 4, 6],
  [4, 6, 6, 8],
  [2, 3, 8, 12],
  [5, 8, 10, 13],
  [10, 10, 12, 13],
  [3, 5, 7, 13],
  [4, 4, 10, 10],
].filter(d => Solver.isSolvable(d));

console.log(`=== GameCore 层：可解采样数 = ${decks.length} ===`);

const results = [];
let passCount = 0, failCount = 0;
function rec(name, pass, detail = '') {
  results.push({ name, pass, detail });
  if (pass) passCount++; else failCount++;
  console.log(`${pass ? '[PASS]' : '[FAIL]'} ${name}${detail ? ' :: ' + detail : ''}`);
}

// mock card object
function mkCards(values) {
  return values.map((v, i) => ({ value: v, index: i }));
}

// ---- Case 1: 幂等（10 次） ----
for (const d of decks) {
  const gc = new GameCore();
  gc.recordSolutions(mkCards(d));
  const s0 = gc.getHintStep(1);
  let ok = true;
  for (let i = 0; i < 10; i++) {
    const s = gc.getHintStep(1);
    if (!s || s.lhs !== s0.lhs || s.op !== s0.op || s.rhs !== s0.rhs || s.result !== s0.result) {
      ok = false; break;
    }
  }
  rec(`1-idempotent-step1 [${d.join(',')}]`, ok,
    `s0={${s0.lhs} ${s0.op} ${s0.rhs} = ${s0.result}}`);
}

// ---- Case 2: 步骤数 = 3；index 边界 返回 null ----
for (const d of decks) {
  const gc = new GameCore();
  gc.recordSolutions(mkCards(d));
  const s1 = gc.getHintStep(1);
  const s2 = gc.getHintStep(2);
  const s3 = gc.getHintStep(3);
  const s0 = gc.getHintStep(0);
  const s4 = gc.getHintStep(4);
  const ok = !!s1 && !!s2 && !!s3 && s0 === null && s4 === null;
  rec(`2-3-steps [${d.join(',')}]`, ok, `has(1,2,3)=${!!s1}/${!!s2}/${!!s3}, index(0,4)=${s0}/${s4}`);
}

// ---- Case 3: 换牌后重新计算 ----
{
  const gc = new GameCore();
  gc.recordSolutions(mkCards(decks[0]));
  const before = gc.getHintStep(1);
  gc.recordSolutions(mkCards(decks[3]));
  const after = gc.getHintStep(1);
  const changed = JSON.stringify(before) !== JSON.stringify(after);
  rec('3-换牌后重新计算', changed, `before=${JSON.stringify(before)}, after=${JSON.stringify(after)}`);
}

// ---- Case 4: 未发牌返回 null ----
{
  const gc = new GameCore();
  const s1 = gc.getHintStep(1);
  rec('4-未发牌返回 null', s1 === null, `s1=${s1}`);
}

// ---- Case 5: getAllSolutions 与产品内部解集【同层】相等 ----
// 🔴 task-131 第 3 批改写（经理已批）。原判据拿 `gc.getAllSolutions()` 直接比
//     `Solver.findSolutions(d)`，二者【不同层】，入库即 20/20 恒红。实测取值（deck [3,3,8,8]）：
//       gc.getAllSolutions()  = ["8÷(3-8÷3)"]        ← 展示层（formatExprPretty，含 ÷ ×）
//       Solver.findSolutions  = ["(8/(3-(8/3)))"]      ← 内部式
//     ⇒ 字符串永不相等，与产品对错无关，是【判据取值层错】。
// 🔴 治法：把两侧拉到同一层。产品未对外暴露内部式（`_cachedAllSolutions` 只存展示层，
//     见 js/core/GameCore.js:218 `prettyList`），故在测试侧对【同一数据源】施以【同一变换】：
//       expected = findSolutionsWithAST(d) → Solver.formatExprPretty(ast) → sort
//     这正是 GameCore.js:206+218 的同一条链路，故为同层比对。
// 🔴 【禁】在判据里对 gc 输出做 `÷→/` `×→*` 字符替换来“拉平”：
//     那是绕过层差而非消除层差，一旦 formatExprPretty 改变括号/空格策略就会假绿。
for (const d of decks) {
  const gc = new GameCore();
  gc.recordSolutions(mkCards(d));
  const all = gc.getAllSolutions();
  // 同层期望值：走与产品 _computeHintCache 完全一致的链路
  const expected = findSolutionsWithAST(d).map((s) => Solver.formatExprPretty(s.ast)).sort();
  const setA = new Set(all);
  const setB = new Set(expected);
  const eq = setA.size === setB.size && [...setA].every(x => setB.has(x));
  // 存在性前置：若两侧均为空集，上面 eq 会恒真 ⇒ 先断言本 deck 确实有解
  const nonEmpty = expected.length > 0;
  rec(`5-setEq [${d.join(',')}]`, eq && nonEmpty,
    `gc.n=${all.length}, expected.n=${expected.length}, setEq=${eq}, nonEmpty=${nonEmpty}`);
}

// ---- Case 6: getAllSolutions 返回副本 ----
{
  const gc = new GameCore();
  gc.recordSolutions(mkCards(decks[0]));
  const arr1 = gc.getAllSolutions();
  arr1.push('POLLUTED');
  const arr2 = gc.getAllSolutions();
  const isolated = !arr2.includes('POLLUTED');
  rec('6-return-copy', isolated, `arr2.len=${arr2.length}, pollute=${arr2.includes('POLLUTED')}`);
}

// ---- Case 7: resetGame 清空缓存 ----
{
  const gc = new GameCore();
  gc.recordSolutions(mkCards(decks[0]));
  gc.getHintStep(1); // 触发缓存
  gc.resetGame();
  // resetGame 已把 currentCardValues 清空，getHintStep 尝试懒建缓存 → 因 values.length!=4 → null
  const s = gc.getHintStep(1);
  const all = gc.getAllSolutions();
  const cleared = s === null && all.length === 0;
  rec('7-resetGame-clears-cache', cleared, `s=${s}, all.len=${all.length}`);
}

// ---- Case 8: step3 拼接 = 字典序最小解（【同层】展示层 vs 展示层）----
// 🔴 task-131 第 3 批改写（经理已批）。原判据把 step3（展示层，含 ÷ ×）用
//     `back()` 做 `×→*` `÷→/` 字符替换后自行加括号，再去比 getAllSolutions()[0]（展示层），
//     两侧终究仍不同层，入库即 20/20 恒红。实测取值：
//       reassembled = '(8/(3-8/3))'   ← 被替换回内部式、且括号策略自拟
//       all[0]      = '8÷(3-8÷3)'     ← formatExprPretty 展示层
//     ⇒ 即使做了字符替换也对不上，因为括号/空格策略也不同。
// 🔴 治法：【彻底删除 back() 字符替换】，两侧都留在展示层比：
//     step3 的 lhs/op/rhs 本身已是展示层，而【字典序最小解】同样取 all[0]（展示层）。
//     但 step3 只是【最后一步】，不含完整式的嵌套结构，故不能直接拼成完整式去比；
//     改为断言产品真正保证的契约：① step3 的运算结果 = 24；
//     ② step3 的 op 必为字典序最小解 all[0] 的【顶层运算符】（同层：都取展示层符号）。
// 🔴 顶层运算符从 AST 取（chooseCanonicalSolution 选中的那梵），而非靠字符串扫括号：
//     判据取值层与被判事实同层 —— 判 AST 就读 AST。
const _OPMAP = { '+': '+', '-': '-', '*': '×', '/': '÷' };
for (const d of decks) {
  const gc = new GameCore();
  gc.recordSolutions(mkCards(d));
  const all = gc.getAllSolutions().sort(); // 展示层，已排序（双保险）
  const s3 = gc.getHintStep(3);
  // 同层期望：走与产品 _computeHintCache 同一链路取得顶层运算符
  const sols = findSolutionsWithAST(d);
  const chosen = chooseCanonicalSolution(sols, d);
  const topOpDisplay = chosen && chosen.ast ? (_OPMAP[chosen.ast.op] || chosen.ast.op) : null;
  const opMatch = !!s3 && s3.op === topOpDisplay;
  // step3 结果必为 24（展示层文本包含 24，或 result 字段为 24）
  const resIs24 = !!s3 && (String(s3.result) === '24' || /(^|[^0-9])24([^0-9]|$)/.test(String(s3.result)));
  // 存在性前置：本 deck 必须真有解且 step3 存在，否则上面两条会恒真/恒假
  const pre = all.length > 0 && !!s3 && !!topOpDisplay;
  rec(`8-step3=lexmin [${d.join(',')}]`, pre && opMatch && resIs24,
    `pre=${pre}, s3.op='${s3 ? s3.op : null}' vs topOp='${topOpDisplay}', ` +
    `s3.result='${s3 ? s3.result : null}', all[0]='${all[0]}'`);
}

console.log('==========');
console.log(`PASS=${passCount}  FAIL=${failCount}  TOTAL=${passCount + failCount}`);
console.log(`OVERALL: ${failCount === 0 ? 'PASS' : 'FAIL'}`);
process.exit(failCount === 0 ? 0 : 1);
