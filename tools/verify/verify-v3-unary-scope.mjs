// 回应 Tester 结论4：单目「每节点至多 1 次」的两种口径，JS 侧实测
// 口径A 严：子树中已含单目 → 祖先节点不再施加单目
// 口径B 宽：仅禁止自身直接叠加（abs(rec(x)) 禁），子树含单目不影响祖先
// 目的1：查清 Architect 此前所有 benchmark 属于哪个口径（可比性前提）
// 目的2：两口径下 R-04.1 语义可达性 + |x| 基准用例可达性
// 目的3：为 Tester 第4点诉求选定 |x| 侧基准（含 |x| 施于中间结果的完整 24 解）
import { performance } from 'node:perf_hooks';
import os from 'node:os';

function gcd(a, b) { while (b) { [a, b] = [b, a % b]; } return a; }
function F(n, d = 1) {
  if (d === 0) return null;
  if (d < 0) { n = -n; d = -d; }
  const g = gcd(Math.abs(n), d) || 1;
  return { n: n / g, d: d / g };
}
const add = (a, b) => F(a.n * b.d + b.n * a.d, a.d * b.d);
const sub = (a, b) => F(a.n * b.d - b.n * a.d, a.d * b.d);
const mul = (a, b) => F(a.n * b.n, a.d * b.d);
const div = (a, b) => (b.n === 0 ? null : F(a.n * b.d, a.d * b.n));
const is24 = (f) => f && f.n === 24 * f.d;
const BIN = [['+', add], ['-', sub], ['*', mul], ['/', div]];
const show = (t) => t.k === 'num' ? String(t.val)
  : t.k === 'abs' ? `|${show(t.a)}|` : t.k === 'rec' ? `(1/${show(t.a)})`
  : `(${show(t.a)}${t.op}${show(t.b)})`;
function evalT(t) {
  if (t.k === 'num') return F(t.val);
  if (t.k === 'abs') { const v = evalT(t.a); return v && F(Math.abs(v.n), v.d); }
  if (t.k === 'rec') { const v = evalT(t.a); return v && v.n !== 0 ? F(v.d, v.n) : null; }
  const a = evalT(t.a), b = evalT(t.b);
  if (!a || !b) return null;
  return BIN.find(([o]) => o === t.op)[1](a, b);
}
const hasUnary = (t) => t.k === 'num' ? false : (t.k === 'abs' || t.k === 'rec') ? true : hasUnary(t.a) || hasUnary(t.b);
// 单目作用于二元中间结果（R-04.1 L1 语义断言的核心谓词）
const unaryOnBin = (t) => t.k === 'num' ? false
  : (t.k === 'abs' || t.k === 'rec') ? (t.a.k === 'bin' ? true : unaryOnBin(t.a))
  : unaryOnBin(t.a) || unaryOnBin(t.b);
const absOnBin = (t) => t.k === 'num' ? false
  : t.k === 'abs' ? (t.a.k === 'bin' ? true : absOnBin(t.a))
  : t.k === 'rec' ? absOnBin(t.a) : absOnBin(t.a) || absOnBin(t.b);
const hasAbs = (t) => t.k === 'num' ? false : t.k === 'abs' ? true : t.k === 'rec' ? hasAbs(t.a) : hasAbs(t.a) || hasAbs(t.b);
const hasRec = (t) => t.k === 'num' ? false : t.k === 'rec' ? true : t.k === 'abs' ? hasRec(t.a) : hasRec(t.a) || hasRec(t.b);
const nodes = (t) => t.k === 'num' ? 1 : (t.k === 'abs' || t.k === 'rec') ? 1 + nodes(t.a) : 1 + nodes(t.a) + nodes(t.b);
function ckey(t) {
  if (t.k === 'num') return `n${t.val}`;
  if (t.k === 'abs') return `abs(${ckey(t.a)})`;
  if (t.k === 'rec') return `rec(${ckey(t.a)})`;
  const a = ckey(t.a), b = ckey(t.b);
  if (t.op === '+' || t.op === '*') return a <= b ? `(${a}${t.op}${b})` : `(${b}${t.op}${a})`;
  return `(${a}${t.op}${b})`;
}

// mode: 'A' 严 | 'B' 宽
function unaryVars(v, t, mode) {
  const o = [{ v, t }];
  // 口径A：子树已含单目 → 不再施加
  if (mode === 'A' && hasUnary(t)) return o;
  // 口径B：仅禁自身直接叠加（t 本身是单目节点则不再叠）
  if (mode === 'B' && (t.k === 'abs' || t.k === 'rec')) return o;
  if (v.n < 0) o.push({ v: F(-v.n, v.d), t: { k: 'abs', a: t } });
  if (v.n !== 0 && !(Math.abs(v.n) === 1 && v.d === 1)) o.push({ v: F(v.d, v.n), t: { k: 'rec', a: t } });
  return o;
}
function solveFull(nums, mode) {
  const found = new Map();
  (function dfs(items) {
    if (items.length === 1) {
      for (const c of unaryVars(items[0].v, items[0].t, mode)) if (is24(c.v)) found.set(ckey(c.t), c.t);
      return;
    }
    const n = items.length;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      if (i === j) continue;
      const rest = items.filter((_, k) => k !== i && k !== j);
      for (const a of unaryVars(items[i].v, items[i].t, mode))
        for (const b of unaryVars(items[j].v, items[j].t, mode))
          for (const [op, fn] of BIN) {
            const v = fn(a.v, b.v);
            if (!v) continue;
            dfs([{ v, t: { k: 'bin', op, a: a.t, b: b.t } }, ...rest]);
          }
    }
  })(nums.map((x) => ({ v: F(x), t: { k: 'num', val: x } })));
  return [...found.values()];
}

console.log('=== 回应 Tester 结论4：单目「每节点至多1次」两种口径 JS 实测 ===');
console.log(`环境: Node ${process.version}, ${os.cpus().length} 核, load ${os.loadavg()[0].toFixed(2)}, ${new Date().toISOString()}\n`);
console.log('口径A 严：子树含单目 → 祖先不再施加');
console.log('口径B 宽：仅禁自身直接叠加（abs(rec(x)) 禁），子树含单目不影响祖先');
console.log('★ Architect 此前所有 benchmark（122/127 日志）用的是口径B —— 本脚本予以确认\n');

const CHECK = [[1, 3, 4, 6], [1, 4, 6, 8], [1, 2, 3, 4]];
console.log('--- 单局解数与耗时对比（与 Tester Python 数据对照）---');
console.log('deck\t\t口径A: 耗时/解数\t\t口径B: 耗时/解数\t\tB/A 解数比');
for (const d of CHECK) {
  const t0 = performance.now(); const sa = solveFull(d, 'A'); const ma = performance.now() - t0;
  const t1 = performance.now(); const sb = solveFull(d, 'B'); const mb = performance.now() - t1;
  console.log(`[${d}]\t${ma.toFixed(0)}ms / ${sa.length} 解\t\t${mb.toFixed(0)}ms / ${sb.length} 解\t\t${(sb.length / sa.length).toFixed(1)}x`);
}

console.log('\n--- 50 局 P95（SEED=20260801，与 Tester 同 seed 同 LCG）---');
let s0 = 20260801;
const r = () => { s0 = (s0 * 1103515245 + 12345) & 0x7fffffff; return s0 / 0x7fffffff; };
const decks = Array.from({ length: 50 }, () => Array.from({ length: 4 }, () => 1 + Math.floor(r() * 13)));
console.log(`前 5 组: ${decks.slice(0, 5).map((d) => `[${d}]`).join(' ')}`);
for (const mode of ['A', 'B']) {
  const ts = [], cnts = [];
  for (const d of decks) { const t0 = performance.now(); cnts.push(solveFull(d, mode).length); ts.push(performance.now() - t0); }
  ts.sort((a, b) => a - b);
  const over2s = ts.filter((x) => x > 2000).length;
  console.log(`口径${mode}: P50=${ts[25].toFixed(1)}ms  P95=${ts[47].toFixed(1)}ms  max=${ts[49].toFixed(1)}ms  超2s=${over2s}/50  解数max=${Math.max(...cnts)}`);
}

console.log('\n--- R-04.1 语义可达性：两口径下是否都能命中「单目作用于二元中间结果」---');
for (const d of [[1, 3, 4, 6], [1, 4, 6, 8]]) {
  for (const mode of ['A', 'B']) {
    const s = solveFull(d, mode);
    const rec = s.filter((t) => hasRec(t) && unaryOnBin(t));
    console.log(`[${d}] 口径${mode}: 总解=${s.length}  含1/x且施于中间结果=${rec.length} ${rec.length ? '✅' : '❌'}`);
    if (rec.length) { rec.sort((x, y) => nodes(x) - nodes(y)); const v = evalT(rec[0]); console.log(`    最短: ${show(rec[0])} = ${v.n / v.d} ${v.n / v.d === 24 ? '✅' : '❌'}`); }
  }
}

console.log('\n=== Tester 第4点诉求：|x| 侧基准用例（|x| 施于二元中间结果的完整 24 解）===\n');
const ABS_DECKS = [[1, 4, 6, 8], [2, 3, 4, 6], [1, 1, 1, 13], [1, 3, 4, 6]];
for (const d of ABS_DECKS) {
  const s = solveFull(d, 'A');
  const cand = s.filter((t) => absOnBin(t) && !hasRec(t)); // 符号隔离：只含 abs 不含 recip
  cand.sort((x, y) => nodes(x) - nodes(y));
  console.log(`[${d}] 口径A 总解=${s.length}  |x|施于中间结果且不含1/x = ${cand.length} 条`);
  for (const t of cand.slice(0, 3)) {
    const v = evalT(t);
    console.log(`    ${show(t)} = ${v.n / v.d} ${v.n / v.d === 24 ? '✅' : '❌'}  (节点数 ${nodes(t)})`);
  }
  console.log('');
}
console.log('★ 以上每条均由独立 evalT 复算，禁 solver 自证；供 Tester 用 Python Fraction 独立验算');
