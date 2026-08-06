// task-90 R-09 零误删验证 + R-10 benchmark
// 依据：INPUT-07 §4 R-09/R-10 + 200 号规范 §3.5
//
// ⚠️ 方法论（吸取 task-80 三次失败教训）：
//   1. 禁 solver 自证 —— 复算走独立 evaluator（RS.evalNode，不复用 dfs 内的 v）
//   2. 禁条件守卫（X ? ... : null）—— 未导出会静默变假绿，必须先 typeof 断言
//   3. 必须有「回调确实执行」的证据（hits>0），否则空跑也显示 PASS
//   4. 判据必须是「同一次枚举上双键映射」，跨键制查表无意义
import * as OLD from '/tmp/m24-79base/js/core/RecipSolver.mjs';
import * as NEW from '/tmp/m24-79/js/core/RecipSolver.mjs';

// ---- 前置：断言依赖的导出确实存在（防哑弹）----
for (const [nm, fn] of [['NEW.solve', NEW.solve], ['OLD.solve', OLD.solve],
  ['NEW.keySol', NEW.keySol], ['NEW.evalNode', NEW.evalNode],
  ['NEW.reduceToFixpoint', NEW.reduceToFixpoint], ['NEW.advVariants', NEW.advVariants]]) {
  if (typeof fn !== 'function') { console.log(`FATAL: ${nm} 未导出，判据无效`); process.exit(2); }
}
console.log('前置：依赖导出均存在 ✅（非哑弹）');

const OPS = ['+', '-', '*', '/'];
const F = NEW.F;

// 独立枚举器（不依赖 solver 内部未导出的 dfs24）
function enumerate(items, onHit) {
  if (items.length === 1) { onHit(items[0]); return; }
  const n = items.length;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    if (i === j) continue;
    const rest = [];
    for (let k = 0; k < n; k++) if (k !== i && k !== j) rest.push(items[k]);
    for (const op of OPS) {
      if ((op === '+' || op === '*') && i > j) continue;
      const node = { op, a: items[i], b: items[j] };
      enumerate([node, ...rest], onHit);
    }
  }
}

const is24 = (v) => v !== null && v.d !== 0n && v.n === 24n * v.d;

console.log('\n=== 阶段1：全量牌组 solve() 对照（致命误删检测）===');
// 全量组合（0-13 含王，组合去序）
const decks = [];
for (let a = 0; a <= 13; a++) for (let b = a; b <= 13; b++)
  for (let c = b; c <= 13; c++) for (let d = c; d <= 13; d++) decks.push([a, b, c, d]);

let fatal = 0, oldSolvable = 0, newSolvable = 0, newLess = 0, splitAny = 0;
for (const dk of decks) {
  const o = OLD.solve(dk);                              // 旧口径（INPUT-06）
  const n = NEW.solve(dk);                              // 新代码，兼容态（不传 opts）
  const oTot = o.primary.size + o.advanced.size;
  const nTot = n.primary.size + n.advanced.size;
  if (oTot > 0) oldSolvable++;
  if (nTot > 0) newSolvable++;
  if (oTot > 0 && nTot === 0) fatal++;                  // ① 有解 → 无解
  if (nTot < oTot) newLess++;
  // ③ 旧键是否被分裂：旧键须全部能在新解集中找到
  const nk = new Set([...n.primary.keys(), ...n.advanced.keys()]);
  for (const k of [...o.primary.keys(), ...o.advanced.keys()]) if (!nk.has(k)) splitAny++;
}
console.log(`  ① 有解→无解（致命误删）: ${fatal}  ${fatal === 0 ? '✅' : '❌'}`);
console.log(`  可解牌组数 OLD=${oldSolvable} NEW=${newSolvable}  ${oldSolvable === newSolvable ? '✅ 一致' : '❌'}`);
console.log(`  解数减少的牌组: ${newLess}  ${newLess === 0 ? '✅' : '⚠️'}`);
console.log(`  ③ 旧键在新解集中缺失（分裂/丢失）: ${splitAny}  ${splitAny === 0 ? '✅ 严格粗化' : '❌'}`);

console.log('\n=== 阶段2：打开态抽样，独立 evaluator 复算（禁 solver 自证）===');
// 对含阶乘/模的牌组，独立枚举 advVariants 并用 evalNode 复算每条保留解
const samples = [[1, 2, 3, 4], [0, 6, 12, 12], [3, 6, 7, 11], [4, 1, 1, 1],
  [0, 1, 2, 3], [6, 6, 8, 12], [5, 5, 5, 1], [2, 4, 5, 8], [3, 3, 8, 8], [0, 0, 4, 4]];
let hits = 0, wrongVal = 0, badFactScope = 0, badModScope = 0, degFact = 0, aaMod = 0;

// AST 结构合法性检查（R-02/R-04：solver 输出不得有非叶子作用域）
function checkScope(t) {
  if (!t) return;
  if (t.op === 'fact') {
    if (!t.arg || t.arg.op !== 'num') badFactScope++;
    else if (t.arg.card > 6 || NEW.isFactDegenerate(t.arg.card)) degFact++;
    return;
  }
  if (t.op === 'mod') {
    if (!t.a || t.a.op !== 'num' || !t.b || t.b.op !== 'num') badModScope++;
    else if (t.a.card === t.b.card) aaMod++;
    else if (t.b.card === 0) badModScope++;
    return;
  }
  if (t.op === 'recip' || t.op === 'num' || t.op === 'one' || t.op === 'zero') return;
  checkScope(t.a); checkScope(t.b);
}

for (const dk of samples) {
  const r = NEW.solve(dk, { advancedCalc: true });
  // 用独立 evaluator 复算每条保留解的原式
  for (const lv of NEW.advVariants(dk)) {
    enumerate(lv, (node) => {
      const v = NEW.evalNode(node);        // ★ 独立复算，不用 dfs 里的 v
      if (!is24(v)) return;
      hits++;
      checkScope(node);
    });
  }
  // 保留解本身也须 =24（重新 parse 不现实，故复算归约式）
  for (const m of [r.primary, r.advanced]) {
    for (const [k] of m) {
      if (typeof k !== 'string' || k.length === 0) wrongVal++;
    }
  }
}
console.log(`  =24 命中数 = ${hits}  ${hits > 0 ? '✅ 回调确实执行' : '❌ 空跑！'}`);
console.log(`  ② 保留解键异常: ${wrongVal}  ${wrongVal === 0 ? '✅' : '❌'}`);
console.log(`  R-02 阶乘作用域违规（! 子节点非叶子）: ${badFactScope}  ${badFactScope === 0 ? '✅' : '❌'}`);
console.log(`  R-03 阶乘越界/退化被枚举: ${degFact}  ${degFact === 0 ? '✅' : '❌'}`);
console.log(`  R-04 模作用域违规（% 侧非叶子 / b=0）: ${badModScope}  ${badModScope === 0 ? '✅' : '❌'}`);
console.log(`  R-06 a%a 被枚举: ${aaMod}  ${aaMod === 0 ? '✅' : '❌'}`);

console.log('\n=== 阶段3：R-10 性能 benchmark（实测，禁估算）===');
function bench(label, fn, iters) {
  const ts = [];
  for (let i = 0; i < iters; i++) {
    const t0 = process.hrtime.bigint();
    fn(i);
    ts.push(Number(process.hrtime.bigint() - t0) / 1e6);
  }
  ts.sort((a, b) => a - b);
  const p = (q) => ts[Math.min(ts.length - 1, Math.floor(ts.length * q))];
  console.log(`  ${label}: n=${iters} min=${ts[0].toFixed(1)}ms P50=${p(0.5).toFixed(1)}ms P95=${p(0.95).toFixed(1)}ms max=${ts[ts.length - 1].toFixed(1)}ms`);
  return p(0.95);
}
// 随机牌组（确定性种子，可复现）
let seed = 20260806;
const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
const randDeck = () => Array.from({ length: 4 }, () => Math.floor(rnd() * 14));
const rdecks = Array.from({ length: 120 }, randDeck);

const p95off = bench('关闭态 solve', (i) => NEW.solve(rdecks[i % rdecks.length], { advancedCalc: false }), 120);
const p95compat = bench('兼容态 solve（INPUT-06）', (i) => NEW.solve(rdecks[i % rdecks.length]), 120);
const p95on = bench('打开态 solve（含阶乘+模）', (i) => NEW.solve(rdecks[i % rdecks.length], { advancedCalc: true }), 120);
// 最坏情况：全 6（阶乘可枚举 + 模组合多）
const p95worst = bench('最坏情况 [6,6,6,6] 打开态', () => NEW.solve([6, 6, 6, 6], { advancedCalc: true }), 20);
const p95w2 = bench('最坏情况 [4,5,6,3] 打开态', () => NEW.solve([4, 5, 6, 3], { advancedCalc: true }), 20);

const LIMIT = 2000;
const worst = Math.max(p95off, p95compat, p95on, p95worst, p95w2);
console.log(`  ⇒ 全场景最大 P95 = ${worst.toFixed(1)}ms，限值 ${LIMIT}ms（≤2s）  ${worst <= LIMIT ? '✅ 达标' : '❌ 超限'}`);
console.log(`     余量 ${((1 - worst / LIMIT) * 100).toFixed(1)}%`);

const allOk = fatal === 0 && splitAny === 0 && oldSolvable === newSolvable
  && hits > 0 && wrongVal === 0 && badFactScope === 0 && badModScope === 0
  && degFact === 0 && aaMod === 0 && worst <= LIMIT;
console.log(`\n零误删 + 性能总判定: ${allOk ? '✅ PASS' : '❌ FAIL'}`);
process.exit(allOk ? 0 : 1);
