// 验证「值级去重」的致命缺陷与修正方案
// 缺陷：同 (mask,value) 只留 1 代表式时，若代表式恰为纯初级式，会丢失"本局有高级解"的事实
// 修正：去重键升级为 (mask, value, usesUnary) 三元组 —— 高级/初级各留 1 代表式
import { performance } from 'node:perf_hooks';

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
const vkey = (f) => `${f.n}/${f.d}`;

function show(t) {
  if (t.k === 'num') return String(t.val);
  if (t.k === 'abs') return `|${show(t.a)}|`;
  if (t.k === 'rec') return `(1/${show(t.a)})`;
  return `(${show(t.a)}${t.op}${show(t.b)})`;
}
function evalT(t) {
  if (t.k === 'num') return F(t.val);
  if (t.k === 'abs') { const v = evalT(t.a); return v && F(Math.abs(v.n), v.d); }
  if (t.k === 'rec') { const v = evalT(t.a); return v && v.n !== 0 ? F(v.d, v.n) : null; }
  const a = evalT(t.a), b = evalT(t.b);
  if (!a || !b) return null;
  return BIN.find(([o]) => o === t.op)[1](a, b);
}
const usesUnary = (t) => t.k === 'num' ? false
  : (t.k === 'abs' || t.k === 'rec') ? true
  : usesUnary(t.a) || usesUnary(t.b);
const hasUnaryOnNonLeaf = (t) => t.k === 'num' ? false
  : (t.k === 'abs' || t.k === 'rec') ? (t.a.k === 'bin' ? true : hasUnaryOnNonLeaf(t.a))
  : hasUnaryOnNonLeaf(t.a) || hasUnaryOnNonLeaf(t.b);

function unaryVars(v, t) {
  const out = [{ v, t }];
  if (v.n < 0) out.push({ v: F(-v.n, v.d), t: { k: 'abs', a: t } });
  if (v.n !== 0 && !(Math.abs(v.n) === 1 && v.d === 1)) out.push({ v: F(v.d, v.n), t: { k: 'rec', a: t } });
  return out;
}

// 通用 DP：keyFn 决定去重粒度；keepN = 每个 key 保留多少代表式
function solveDP(nums, keyFn, keepN = 1) {
  const dp = new Map(); // mask -> Map(key -> [{v,t}])
  const put = (mp, v, t) => {
    const k = keyFn(v, t);
    const arr = mp.get(k);
    if (!arr) mp.set(k, [{ v, t }]);
    else if (arr.length < keepN) arr.push({ v, t });
  };
  for (let i = 0; i < 4; i++) {
    const m = 1 << i;
    const mp = dp.get(m) || new Map();
    for (const c of unaryVars(F(nums[i]), { k: 'num', val: nums[i] })) put(mp, c.v, c.t);
    dp.set(m, mp);
  }
  for (let mask = 1; mask <= 15; mask++) {
    if ([1, 2, 4, 8].includes(mask)) continue;
    const mp = dp.get(mask) || new Map();
    for (let sub = (mask - 1) & mask; sub > 0; sub = (sub - 1) & mask) {
      const other = mask ^ sub;
      if (sub > other) continue;
      const A = dp.get(sub), B = dp.get(other);
      if (!A || !B) continue;
      for (const arrA of A.values()) for (const arrB of B.values())
        for (const ea of arrA) for (const eb of arrB)
          for (const [op, fn] of BIN)
            for (const [x, y, tx, ty] of [[ea.v, eb.v, ea.t, eb.t], [eb.v, ea.v, eb.t, ea.t]]) {
              const v = fn(x, y);
              if (!v) continue;
              const t = { k: 'bin', op, a: tx, b: ty };
              for (const c of unaryVars(v, t)) put(mp, c.v, c.t);
            }
    }
    dp.set(mask, mp);
  }
  const top = dp.get(15) || new Map();
  const res = [];
  for (const arr of top.values()) for (const e of arr) if (is24(e.v)) res.push(e.t);
  return res;
}

const KEY_VALUE_ONLY = (v) => vkey(v);                              // 缺陷版
const KEY_VALUE_UNARY = (v, t) => `${vkey(v)}|${usesUnary(t) ? 'A' : 'P'}`; // 修正版

const DECKS = [[1, 3, 4, 6], [1, 4, 6, 8], [1, 2, 3, 4], [1, 3, 4, 8], [3, 8, 8, 3]];

console.log('=== 缺陷复现 + 修正验证：值级去重粒度对「是否有高级解」判定的影响 ===\n');
console.log('牌组\t\t仅值去重: 解数/含高级\t值+高级标记去重: 解数/含高级\t判定修复');
for (const deck of DECKS) {
  const a = solveDP(deck, KEY_VALUE_ONLY, 1);
  const b = solveDP(deck, KEY_VALUE_UNARY, 1);
  const aAdv = a.filter(usesUnary).length, bAdv = b.filter(usesUnary).length;
  console.log(`[${deck}]\t${a.length}/${aAdv}${aAdv === 0 ? ' ❌漏判无高级解' : ''}\t\t\t${b.length}/${bAdv}${bAdv > 0 ? ' ✅' : ' ❌'}\t\t\t${aAdv === 0 && bAdv > 0 ? '✅ 修复' : aAdv > 0 ? '本例未触发' : '仍失败'}`);
}

console.log('\n=== R-04.1 基准：修正版能否命中「单目作用于中间结果」的解 ===\n');
for (const deck of [[1, 3, 4, 6], [1, 4, 6, 8]]) {
  for (const keepN of [1, 4]) {
    const r = solveDP(deck, KEY_VALUE_UNARY, keepN);
    const mid = r.filter(hasUnaryOnNonLeaf);
    console.log(`[${deck}] keepN=${keepN}: 解数=${r.length} 含高级=${r.filter(usesUnary).length} 单目作用于中间结果=${mid.length} ${mid.length ? '✅' : '❌ R-04.1 失败'}`);
    if (mid.length) { const t = mid[0], v = evalT(t); console.log(`    样例: ${show(t)} = ${v.n / v.d} ${v.n / v.d === 24 ? '✅' : '❌'}`); }
  }
  console.log('');
}

console.log('=== P95 benchmark：修正版 keepN=1 / keepN=4 / keepN=20 ===\n');
let seed = 20260801;
const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
const decks = Array.from({ length: 50 }, () => Array.from({ length: 4 }, () => 1 + Math.floor(rnd() * 13)));
for (const keepN of [1, 4, 20]) {
  const ts = []; let advCnt = 0, solTotal = 0;
  for (const d of decks) {
    const t0 = performance.now(); const r = solveDP(d, KEY_VALUE_UNARY, keepN); ts.push(performance.now() - t0);
    if (r.some(usesUnary)) advCnt++;
    solTotal += r.length;
  }
  ts.sort((x, y) => x - y);
  const p95 = ts[Math.floor(ts.length * 0.95)];
  console.log(`keepN=${String(keepN).padStart(2)}: P50=${ts[25].toFixed(1)}ms P95=${p95.toFixed(1)}ms max=${ts[49].toFixed(1)}ms 2s:${p95 <= 2000 ? '✅' : '❌'} | 有高级解组数=${advCnt}/50 平均解数=${(solTotal / 50).toFixed(1)}`);
}
