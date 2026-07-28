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
import Solver from '../js/core/Solver.mjs';

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

// ---- Case 5: getAllSolutions 与 Solver.findSolutions 集合相等 ----
for (const d of decks) {
  const gc = new GameCore();
  gc.recordSolutions(mkCards(d));
  const all = gc.getAllSolutions();
  const solverAll = Solver.findSolutions(d);
  const setA = new Set(all);
  const setB = new Set(solverAll);
  const eq = setA.size === setB.size && [...setA].every(x => setB.has(x));
  rec(`5-setEq [${d.join(',')}]`, eq, `gc.n=${all.length}, solver.n=${solverAll.length}`);
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

// ---- Case 8: step3 拼接 = getAllSolutions()[0]（字典序最小） ----
function step3Reassemble(s3) {
  const back = (s) => s.replace(/×/g, '*').replace(/÷/g, '/');
  return `(${back(s3.lhs)}${back(s3.op)}${back(s3.rhs)})`;
}
for (const d of decks) {
  const gc = new GameCore();
  gc.recordSolutions(mkCards(d));
  const all = gc.getAllSolutions().sort(); // 已排序但双保险
  const s3 = gc.getHintStep(3);
  const reassembled = step3Reassemble(s3);
  rec(`8-step3=lexmin [${d.join(',')}]`, reassembled === all[0],
    `reassembled='${reassembled}' vs all[0]='${all[0]}'`);
}

console.log('==========');
console.log(`PASS=${passCount}  FAIL=${failCount}  TOTAL=${passCount + failCount}`);
console.log(`OVERALL: ${failCount === 0 ? 'PASS' : 'FAIL'}`);
process.exit(failCount === 0 ? 0 : 1);
