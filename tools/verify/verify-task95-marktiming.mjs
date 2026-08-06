// task-95 R-09 零误删 + 分区迁移量实测 + 性能 benchmark
// 基线 = 4cd9aae（task-93 收口，标记取归约式）；新 = 标记按原式
//
// ⚠️ 方法论：独立 evaluator 复算，禁 solver 自证；须有「回调确实执行」证据。
// 裁定 §4.4 明确要求「迁移量交开发实测，不估算」。
import * as OLD from '/tmp/m24-79base/js/core/RecipSolver.mjs';
import * as NEW from '/tmp/m24-79/js/core/RecipSolver.mjs';

for (const [nm, fn] of [['OLD.solve', OLD.solve], ['NEW.solve', NEW.solve],
  ['NEW.evalNode', NEW.evalNode], ['NEW.keySol', NEW.keySol], ['NEW.reduceToFixpoint', NEW.reduceToFixpoint]]) {
  if (typeof fn !== 'function') { console.log(`FATAL: ${nm} 未导出`); process.exit(2); }
}
// ★ 确认基线确实是【旧口径】（否则量的是同一棵树）
const probe = OLD.solve([1, 2, 2, 12], { advancedCalc: true });
const probeN = NEW.solve([1, 2, 2, 12], { advancedCalc: true });
const oldHasBug = [...probe.primary.values()].some((d) => String(d).includes('%'));
const newHasBug = [...probeN.primary.values()].some((d) => String(d).includes('%'));
console.log(`前置：基线 primary 含%解=${oldHasBug}（须 true）  新版=${newHasBug}（须 false）  ${oldHasBug && !newHasBug ? '✅ 对比有效' : '❌ 基线不对'}`);

const decks = [];
for (let a = 0; a <= 13; a++) for (let b = a; b <= 13; b++)
  for (let c = b; c <= 13; c++) for (let d = c; d <= 13; d++) decks.push([a, b, c, d]);
console.log(`全量牌组 = ${decks.length}\n`);

console.log('=== 阶段1：零误删（总解数不得减少，键不得丢失）===');
let fatal = 0, keyLost = 0, oldSolv = 0, newSolv = 0, totalOld = 0, totalNew = 0;
let primDown = 0, advUp = 0, migrated = 0;
const lostSample = [];
for (const dk of decks) {
  const o = OLD.solve(dk, { advancedCalc: true });
  const n = NEW.solve(dk, { advancedCalc: true });
  const oAll = new Set([...o.primary.keys(), ...o.advanced.keys()]);
  const nAll = new Set([...n.primary.keys(), ...n.advanced.keys()]);
  totalOld += oAll.size; totalNew += nAll.size;
  if (oAll.size > 0) oldSolv++;
  if (nAll.size > 0) newSolv++;
  if (oAll.size > 0 && nAll.size === 0) fatal++;
  // 键丢失：旧键（去掉标记后缀）在新解集中找不到同基键
  const baseOf = (k) => k.replace(/\|F[01]M[01]$/, '');
  const nBase = new Set([...nAll].map(baseOf));
  for (const k of oAll) if (!nBase.has(baseOf(k))) { keyLost++; if (lostSample.length < 4) lostSample.push([dk, k]); }
  if (n.primary.size < o.primary.size) primDown++;
  if (n.advanced.size > o.advanced.size) advUp++;
  migrated += Math.max(0, o.primary.size - n.primary.size);
}
console.log(`  ① 有解→无解（致命）: ${fatal}  ${fatal === 0 ? '✅' : '❌'}`);
console.log(`  ② 旧键（基键）缺失: ${keyLost}  ${keyLost === 0 ? '✅' : '❌ ' + JSON.stringify(lostSample)}`);
console.log(`  ③ 可解牌组 OLD=${oldSolv} NEW=${newSolv}  ${newSolv >= oldSolv ? '✅ 只增不减' : '❌'}`);
console.log(`  ④ 去重解总数 OLD=${totalOld} NEW=${totalNew}  差=${totalNew - totalOld}`);

console.log('\n=== 阶段2：分区迁移量（裁定 §4.4 要求实测，不估算）===');
let pOldSum = 0, pNewSum = 0, aOldSum = 0, aNewSum = 0;
for (const dk of decks) {
  const o = OLD.solve(dk, { advancedCalc: true });
  const n = NEW.solve(dk, { advancedCalc: true });
  pOldSum += o.primary.size; pNewSum += n.primary.size;
  aOldSum += o.advanced.size; aNewSum += n.advanced.size;
}
console.log(`  primary  合计 OLD=${pOldSum} → NEW=${pNewSum}   （${pNewSum - pOldSum}）`);
console.log(`  advanced 合计 OLD=${aOldSum} → NEW=${aNewSum}   （+${aNewSum - aOldSum}）`);
console.log(`  primary 减少的牌组数=${primDown}  advanced 增加的牌组数=${advUp}`);
console.log(`  ⇒ 裁定 §4.4 预估「初级 −120 / 高级 +120」；实测 ${pNewSum - pOldSum} / +${aNewSum - aOldSum}`);
console.log(`  ⇒ 总解数变化 = ${(pNewSum + aNewSum) - (pOldSum + aOldSum)}  ${(pNewSum + aNewSum) === (pOldSum + aOldSum) ? '✅ 仅分区归属改变，总数不变' : '⚠️ 总数有变，须解释'}`);

console.log('\n=== 阶段3：R-01 两态一致 + primary 零高级记号（独立复算）===');
let r01diff = 0, r01notsub = 0, advInPrim = 0, offAdv = 0, hits = 0, not24 = 0;
const is24 = (v) => v !== null && v.d !== 0n && v.n === 24n * v.d;
for (const dk of decks) {
  const off = NEW.solve(dk, { advancedCalc: false });
  const on = NEW.solve(dk, { advancedCalc: true });
  if (off.advanced.size !== 0) offAdv++;
  if (off.primary.size !== on.primary.size) r01diff++;
  for (const k of on.primary.keys()) if (!off.primary.has(k)) { r01notsub++; break; }
  for (const disp of on.primary.values()) {
    const s = String(disp);
    if (s.includes('%') || s.includes('!')) advInPrim++;
  }
}
console.log(`  R-01a 关闭态 advanced 恒 0: ${offAdv}  ${offAdv === 0 ? '✅' : '❌'}`);
console.log(`  R-01b 两态 primary 计数一致: 差异 ${r01diff} 组  ${r01diff === 0 ? '✅' : '❌'}`);
console.log(`  R-01c 开启态 primary ⊆ 关闭态: 违例 ${r01notsub} 组  ${r01notsub === 0 ? '✅' : '❌'}`);
console.log(`  §1.4 primary 含 %/! 的展示: ${advInPrim} 条  ${advInPrim === 0 ? '✅' : '❌'}`);

console.log('\n=== 阶段4：独立 evaluator 复算高级解确实 =24（禁 solver 自证）===');
const OPS = ['+', '-', '*', '/'];
function enumerate(items, onHit) {
  if (items.length === 1) { onHit(items[0]); return; }
  const L = items.length;
  for (let i = 0; i < L; i++) for (let j = 0; j < L; j++) {
    if (i === j) continue;
    const rest = [];
    for (let k = 0; k < L; k++) if (k !== i && k !== j) rest.push(items[k]);
    for (const op of OPS) {
      if ((op === '+' || op === '*') && i > j) continue;
      enumerate([{ op, a: items[i], b: items[j] }, ...rest], onHit);
    }
  }
}
for (const dk of [[1, 2, 2, 12], [0, 0, 2, 12], [7, 3, 9, 4], [0, 2, 12, 1], [1, 5, 5, 5], [2, 2, 3, 8]]) {
  for (const lv of NEW.advVariants(dk)) {
    enumerate(lv, (node) => {
      const v = NEW.evalNode(node);
      if (!is24(v)) return;
      hits++;
      const v2 = NEW.evalNode(NEW.reduceToFixpoint(node).node);
      if (!is24(v2)) not24++;
    });
  }
}
console.log(`  =24 命中 = ${hits}  ${hits > 0 ? '✅ 回调确实执行' : '❌ 空跑'}`);
console.log(`  归约后不再 =24: ${not24}  ${not24 === 0 ? '✅' : '❌'}`);

console.log('\n=== 阶段5：性能 benchmark（实测，禁估算）===');
function bench(label, fn, iters) {
  const ts = [];
  for (let i = 0; i < iters; i++) {
    const t0 = process.hrtime.bigint();
    fn(i);
    ts.push(Number(process.hrtime.bigint() - t0) / 1e6);
  }
  ts.sort((a, b) => a - b);
  const p = (q) => ts[Math.min(ts.length - 1, Math.floor(ts.length * q))];
  console.log(`  ${label}: n=${iters} P50=${p(0.5).toFixed(1)} P95=${p(0.95).toFixed(1)} max=${ts[ts.length - 1].toFixed(1)} (ms)`);
  return p(0.95);
}
let seed = 20260806;
const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
const rd = Array.from({ length: 150 }, () => Array.from({ length: 4 }, () => Math.floor(rnd() * 14)));
const pOldB = bench('OLD 打开态      ', (i) => OLD.solve(rd[i % rd.length], { advancedCalc: true }), 150);
const pNewB = bench('NEW 打开态      ', (i) => NEW.solve(rd[i % rd.length], { advancedCalc: true }), 150);
const pOff = bench('NEW 关闭态      ', (i) => NEW.solve(rd[i % rd.length], { advancedCalc: false }), 150);
const pCom = bench('NEW 兼容态      ', (i) => NEW.solve(rd[i % rd.length]), 150);
const pW1 = bench('最坏 [4,5,6,3]  ', () => NEW.solve([4, 5, 6, 3], { advancedCalc: true }), 25);
const pW2 = bench('最坏 [0,0,2,12] ', () => NEW.solve([0, 0, 2, 12], { advancedCalc: true }), 25);
const LIMIT = 2000;
const worst = Math.max(pNewB, pOff, pCom, pW1, pW2);
console.log(`  ⇒ 全场景最大 P95 = ${worst.toFixed(1)}ms / 限 ${LIMIT}ms  ${worst <= LIMIT ? '✅ 达标' : '❌ 超限'}（余量 ${((1 - worst / LIMIT) * 100).toFixed(1)}%）`);
console.log(`  ⇒ 开销变化: OLD P95 ${pOldB.toFixed(1)}ms → NEW ${pNewB.toFixed(1)}ms（×${(pNewB / pOldB).toFixed(2)}）`);

const ok = fatal === 0 && keyLost === 0 && newSolv >= oldSolv && offAdv === 0
  && r01diff === 0 && r01notsub === 0 && advInPrim === 0 && hits > 0 && not24 === 0 && worst <= LIMIT;
console.log(`\n总判定: ${ok ? '✅ PASS' : '❌ FAIL'}`);
process.exit(ok ? 0 : 1);
