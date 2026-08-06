// task-92 R-09 零误删 + 性能 benchmark + 架构师 1.68% 交叉校验
// 基线 = 5c1f799（task-90 收口，单 % 形态）；新 = 双 % 形态
//
// ⚠️ 方法论：独立 evaluator 复算，禁 solver 自证；必须有「回调确实执行」证据。
import * as OLD from '/tmp/m24-79base/js/core/RecipSolver.mjs';
import * as NEW from '/tmp/m24-79/js/core/RecipSolver.mjs';

for (const [nm, fn] of [['OLD.solve', OLD.solve], ['NEW.solve', NEW.solve],
  ['NEW.evalNode', NEW.evalNode], ['NEW.advVariants', NEW.advVariants],
  ['NEW.keySol', NEW.keySol], ['NEW.reduceToFixpoint', NEW.reduceToFixpoint]]) {
  if (typeof fn !== 'function') { console.log(`FATAL: ${nm} 未导出`); process.exit(2); }
}
// ★ 确认基线确实【不含】双% 实现（否则量的是同一棵树）
const baseDual = OLD.advVariants([7, 3, 9, 4]).filter((v) => v.length === 2 && v.every((x) => x.op === 'mod'));
const newDual = NEW.advVariants([7, 3, 9, 4]).filter((v) => v.length === 2 && v.every((x) => x.op === 'mod'));
console.log(`前置：基线双%组合=${baseDual.length}（须0）  新=${newDual.length}（须12）  ${baseDual.length === 0 && newDual.length === 12 ? '✅ 对比有效' : '❌ 基线不对'}`);

const OPS = ['+', '-', '*', '/'];
function enumerate(items, onHit) {
  if (items.length === 1) { onHit(items[0]); return; }
  const n = items.length;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    if (i === j) continue;
    const rest = [];
    for (let k = 0; k < n; k++) if (k !== i && k !== j) rest.push(items[k]);
    for (const op of OPS) {
      if ((op === '+' || op === '*') && i > j) continue;
      enumerate([{ op, a: items[i], b: items[j] }, ...rest], onHit);
    }
  }
}
const is24 = (v) => v !== null && v.d !== 0n && v.n === 24n * v.d;

const decks = [];
for (let a = 0; a <= 13; a++) for (let b = a; b <= 13; b++)
  for (let c = b; c <= 13; c++) for (let d = c; d <= 13; d++) decks.push([a, b, c, d]);
console.log(`全量牌组数 = ${decks.length}\n`);

console.log('=== 阶段1：零误删（OLD vs NEW，兼容态与打开态各查）===');
let fatal = 0, splitLost = 0, oldSolv = 0, newSolv = 0, lessAdv = 0;
for (const dk of decks) {
  const o = OLD.solve(dk, { advancedCalc: true });
  const n = NEW.solve(dk, { advancedCalc: true });
  const oT = o.primary.size + o.advanced.size;
  const nT = n.primary.size + n.advanced.size;
  if (oT > 0) oldSolv++;
  if (nT > 0) newSolv++;
  if (oT > 0 && nT === 0) fatal++;
  if (n.advanced.size < o.advanced.size) lessAdv++;
  const nk = new Set([...n.primary.keys(), ...n.advanced.keys()]);
  for (const k of [...o.primary.keys(), ...o.advanced.keys()]) if (!nk.has(k)) splitLost++;
}
console.log(`  ① 有解→无解（致命）: ${fatal}  ${fatal === 0 ? '✅' : '❌'}`);
console.log(`  ③ 旧键在新解集中缺失: ${splitLost}  ${splitLost === 0 ? '✅ 严格粗化（只增不减）' : '❌'}`);
console.log(`  可解牌组 OLD=${oldSolv} NEW=${newSolv}  ${newSolv >= oldSolv ? '✅ 只增不减' : '❌'}`);
console.log(`  advanced 解数减少的牌组: ${lessAdv}  ${lessAdv === 0 ? '✅' : '⚠️ 需解释'}`);

console.log('\n=== 阶段2：独立 evaluator 复算双% 保留解（禁 solver 自证）===');
let hits = 0, notReally24 = 0, badScope = 0, aaMod = 0, b0Mod = 0, slotBad = 0;
const samples = [[7, 3, 9, 4], [8, 3, 9, 2], [12, 5, 8, 6], [7, 1, 9, 3],
  [3, 7, 5, 5], [6, 6, 8, 12], [13, 5, 11, 4], [9, 4, 7, 3], [10, 3, 8, 5], [2, 4, 5, 8]];
for (const dk of samples) {
  for (const lv of NEW.advVariants(dk)) {
    // 结构合法性：% 两侧必须是裸叶子；a%a / b=0 不得出现
    for (const it of lv) {
      if (it.op === 'mod') {
        if (it.a.op !== 'num' || it.b.op !== 'num') badScope++;
        if (it.a.card === it.b.card) aaMod++;
        if (it.b.card === 0) b0Mod++;
      }
    }
    const dualCnt = lv.filter((x) => x.op === 'mod').length;
    if (dualCnt === 2) {
      const s = lv.flatMap((x) => [x.a.slot, x.b.slot]).sort().join(',');
      if (s !== '0,1,2,3') slotBad++;
    }
    enumerate(lv, (node) => {
      const v = NEW.evalNode(node);       // ★ 独立复算
      if (!is24(v)) return;
      hits++;
      const v2 = NEW.evalNode(NEW.reduceToFixpoint(node).node);  // 归约后仍须 =24
      if (!is24(v2)) notReally24++;
    });
  }
}
console.log(`  =24 命中 = ${hits}  ${hits > 0 ? '✅ 回调确实执行' : '❌ 空跑'}`);
console.log(`  ② 归约后不再 =24（保留解≠24）: ${notReally24}  ${notReally24 === 0 ? '✅' : '❌'}`);
console.log(`  % 作用域违规（非裸叶子）: ${badScope}  ${badScope === 0 ? '✅' : '❌'}`);
console.log(`  a%a 被枚举: ${aaMod}  ${aaMod === 0 ? '✅' : '❌'}`);
console.log(`  b=0 被枚举: ${b0Mod}  ${b0Mod === 0 ? '✅' : '❌'}`);
console.log(`  双% slot 覆盖异常: ${slotBad}  ${slotBad === 0 ? '✅ 恰覆盖 4 slot' : '❌'}`);

console.log('\n=== 阶段3：交叉校验架构师「双% 真实增量 40 组 / 2380 = 1.68%」===');
// 定义：打开态下 NEW 可解但 OLD（单%）不可解的牌组数
let dualHasSol = 0, primaryAlso = 0, primaryNone = 0, exclusive = 0;
for (const dk of decks) {
  const o = OLD.solve(dk, { advancedCalc: true });
  const n = NEW.solve(dk, { advancedCalc: true });
  if ((n.primary.size + n.advanced.size) > 0 && (o.primary.size + o.advanced.size) === 0) exclusive++;
  const oKeys = new Set([...o.primary.keys(), ...o.advanced.keys()]);
  const added = [...n.advanced.keys()].filter((k) => !oKeys.has(k));
  if (!added.some((k) => (k.match(/\(% /g) || []).length >= 2)) continue;
  dualHasSol++;
  if (n.primary.size > 0) primaryAlso++; else primaryNone++;
}
// ⚠️ 口径澄清（我最初量错了一次）：
//   架构师口径 = 「有双% 解 且 初级(primary) 无解」的牌组数
//   我最初量的是「NEW 可解 且 OLD 完全不可解」= 0 —— 那是另一件事：
//   这些牌组虽初级无解，但 OLD 已能靠单%/阶乘/倒数解出 ⇒ 差集为 0。
//   两个数都对，定义不同。此处按架构师口径量以便对比。
console.log(`  有双% 解的牌组数              = ${dualHasSol}   （架构师报 193）`);
console.log(`  ├ 其中初级本就能解            = ${primaryAlso}   （架构师报 153）`);
console.log(`  └ 初级无解（架构师口径的增量）= ${primaryNone}   （架构师报 40）`);
console.log(`  占比 = ${(primaryNone / decks.length * 100).toFixed(2)}%   （架构师报 1.68%）`);
console.log(`  参考：双%【独家】可解（OLD 完全无解）= ${exclusive}（另一口径，非架构师所指）`);
const crossOK = Math.abs(dualHasSol - 193) <= 4 && Math.abs(primaryNone - 40) <= 4;
console.log(`  交叉校验: ${crossOK ? '✅ 与架构师一致（±4 内）' : '⚠️ 偏差较大，须上报'}`);

console.log('\n=== 阶段4：性能 benchmark（实测，禁估算）===');
function bench(label, fn, iters) {
  const ts = [];
  for (let i = 0; i < iters; i++) {
    const t0 = process.hrtime.bigint();
    fn(i);
    ts.push(Number(process.hrtime.bigint() - t0) / 1e6);
  }
  ts.sort((a, b) => a - b);
  const p = (q) => ts[Math.min(ts.length - 1, Math.floor(ts.length * q))];
  console.log(`  ${label}: n=${iters} min=${ts[0].toFixed(1)} P50=${p(0.5).toFixed(1)} P95=${p(0.95).toFixed(1)} max=${ts[ts.length - 1].toFixed(1)} (ms)`);
  return p(0.95);
}
let seed = 20260806;
const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
const rdecks = Array.from({ length: 150 }, () => Array.from({ length: 4 }, () => Math.floor(rnd() * 14)));
const pOld = bench('OLD 打开态（单%）  ', (i) => OLD.solve(rdecks[i % rdecks.length], { advancedCalc: true }), 150);
const pNew = bench('NEW 打开态（含双%）', (i) => NEW.solve(rdecks[i % rdecks.length], { advancedCalc: true }), 150);
const pOff = bench('NEW 关闭态        ', (i) => NEW.solve(rdecks[i % rdecks.length], { advancedCalc: false }), 150);
const pCompat = bench('NEW 兼容态        ', (i) => NEW.solve(rdecks[i % rdecks.length]), 150);
// 最坏：无 a%a、无 0，双% 形态满 72
const pW1 = bench('最坏 [7,3,9,4] 打开', () => NEW.solve([7, 3, 9, 4], { advancedCalc: true }), 25);
const pW2 = bench('最坏 [4,5,6,3] 打开', () => NEW.solve([4, 5, 6, 3], { advancedCalc: true }), 25);
const pW3 = bench('最坏 [13,11,12,10] ', () => NEW.solve([13, 11, 12, 10], { advancedCalc: true }), 25);

const LIMIT = 2000;
const worst = Math.max(pNew, pOff, pCompat, pW1, pW2, pW3);
console.log(`  ⇒ 全场景最大 P95 = ${worst.toFixed(1)}ms / 限 ${LIMIT}ms  ${worst <= LIMIT ? '✅ 达标' : '❌ 超限'}（余量 ${((1 - worst / LIMIT) * 100).toFixed(1)}%）`);
console.log(`  ⇒ 双% 带来的开销: OLD P95 ${pOld.toFixed(1)}ms → NEW P95 ${pNew.toFixed(1)}ms（×${(pNew / pOld).toFixed(2)}）`);

const ok = fatal === 0 && splitLost === 0 && newSolv >= oldSolv && hits > 0
  && notReally24 === 0 && badScope === 0 && aaMod === 0 && b0Mod === 0
  && slotBad === 0 && worst <= LIMIT;
console.log(`\n总判定: ${ok ? '✅ PASS' : '❌ FAIL'}`);
process.exit(ok ? 0 : 1);
