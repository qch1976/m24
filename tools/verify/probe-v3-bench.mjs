// 人工阅读型调查脚本，非门禁。退出码恒为 0，即使正文打印 ❌ 也不判红；判定权在阅读者。
// （task-75 哑弹治理：实测 24 支 probe-v3-* 均无非零退出能力，❌/FAIL 全在 console.log 内。）
// R-04.1 基准解命中验证 + R-05 50组随机 P95 benchmark + 剪枝对解数的影响
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

function key(t) {
  if (t.k === 'num') return `n${t.val}`;
  if (t.k === 'abs') return `abs(${key(t.a)})`;
  if (t.k === 'rec') return `rec(${key(t.a)})`;
  const ka = key(t.a), kb = key(t.b);
  if (t.op === '+' || t.op === '*') return ka <= kb ? `(${ka}${t.op}${kb})` : `(${kb}${t.op}${ka})`;
  return `(${ka}${t.op}${kb})`;
}
function show(t) {
  if (t.k === 'num') return String(t.val);
  if (t.k === 'abs') return `|${show(t.a)}|`;
  if (t.k === 'rec') return `(1/${show(t.a)})`;
  return `(${show(t.a)}${t.op}${show(t.b)})`;
}
function usesUnary(t) {
  if (t.k === 'num') return false;
  if (t.k === 'abs' || t.k === 'rec') return true;
  return usesUnary(t.a) || usesUnary(t.b);
}
function hasUnaryOnNonLeaf(t) {
  if (t.k === 'num') return false;
  if (t.k === 'abs' || t.k === 'rec') return t.a.k === 'bin' ? true : hasUnaryOnNonLeaf(t.a);
  return hasUnaryOnNonLeaf(t.a) || hasUnaryOnNonLeaf(t.b);
}
// 数值求值（独立复算，用于校验解正确性 —— 不信任 solver 自己）
function evalT(t) {
  if (t.k === 'num') return F(t.val);
  if (t.k === 'abs') { const v = evalT(t.a); return v && F(Math.abs(v.n), v.d); }
  if (t.k === 'rec') { const v = evalT(t.a); return v && v.n !== 0 ? F(v.d, v.n) : null; }
  const a = evalT(t.a), b = evalT(t.b);
  if (!a || !b) return null;
  return BIN.find(([o]) => o === t.op)[1](a, b);
}

function variants(it, maxD, prune) {
  const outs = [it]; let frontier = [it];
  for (let d = 0; d < maxD; d++) {
    const nx = [];
    for (const x of frontier) {
      // abs
      if (!prune || x.v.n < 0) nx.push({ v: F(Math.abs(x.v.n), x.v.d), t: { k: 'abs', a: x.t } });
      // recip
      if (x.v.n !== 0 && (!prune || !(Math.abs(x.v.n) === 1 && x.v.d === 1))) {
        nx.push({ v: F(x.v.d, x.v.n), t: { k: 'rec', a: x.t } });
      }
    }
    outs.push(...nx); frontier = nx;
  }
  return outs;
}
function solve(nums, maxD = 1, prune = true, cap = Infinity) {
  const found = new Map();
  const t0 = performance.now();
  let aborted = false;
  (function dfs(items) {
    if (aborted) return;
    if (found.size >= cap) { aborted = true; return; }
    if (items.length === 1) {
      for (const c of variants(items[0], maxD, prune)) if (is24(c.v)) found.set(key(c.t), c.t);
      return;
    }
    const n = items.length;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      if (i === j) continue;
      const rest = items.filter((_, k2) => k2 !== i && k2 !== j);
      const As = variants(items[i], maxD, prune), Bs = variants(items[j], maxD, prune);
      for (const a of As) for (const b of Bs) for (const [op, fn] of BIN) {
        const v = fn(a.v, b.v);
        if (!v) continue;
        dfs([{ v, t: { k: 'bin', op, a: a.t, b: b.t } }, ...rest]);
      }
    }
  })(nums.map((x) => ({ v: F(x), t: { k: 'num', val: x } })));
  return { found, ms: performance.now() - t0, aborted };
}

// ===== 1. R-04.1 基准解命中验证 =====
console.log('=== R-04.1 基准解命中验证（v3 中间节点 DFS, d=1, 带剪枝）===\n');
const BENCH = [
  { deck: [1, 3, 4, 6], want: '6*(1/(1-3/4))', wantVal: 24 },
  { deck: [1, 4, 6, 8], want: '8*(1/(1-4/6))', wantVal: 24 },
];
for (const { deck, want } of BENCH) {
  const { found, ms } = solve(deck, 1, true);
  const mids = [...found.values()].filter(hasUnaryOnNonLeaf);
  // 找结构等价于 X*(1/(A-B/C)) 的解
  const match = [...found.values()].filter((t) => {
    if (t.k !== 'bin' || t.op !== '*') return false;
    const rec = t.a.k === 'rec' ? t.a : t.b.k === 'rec' ? t.b : null;
    return rec && rec.a.k === 'bin';
  });
  console.log(`牌组 [${deck}]  期望形态 ${want}`);
  console.log(`  总去重解=${found.size}  单目作用于中间结果=${mids.length}  ${ms.toFixed(1)}ms`);
  console.log(`  形态 N*(1/(中间结果)) 命中数=${match.length}  ${match.length ? '✅' : '❌'}`);
  if (match.length) {
    const s = match.slice(0, 3);
    for (const t of s) {
      const v = evalT(t);
      console.log(`    ${show(t)}  独立复算=${v.n}/${v.d}=${v.n / v.d} ${v.n / v.d === 24 ? '✅' : '❌'}`);
    }
  }
  console.log('');
}

// ===== 2. 剪枝 vs 无剪枝、d=1 vs d=2 对解数与耗时的影响 =====
console.log('=== 剪枝/深度对解数与耗时的影响（缺陷2 相关）===\n');
console.log('牌组\t\td=1剪枝\t\td=1无剪枝\t\td=2剪枝');
for (const deck of [[1, 2, 3, 4], [1, 3, 4, 8]]) {
  const a = solve(deck, 1, true);
  const b = solve(deck, 1, false);
  let c;
  try { c = solve(deck, 2, true); } catch (e) { c = { found: { size: 'OOM/超时' }, ms: -1 }; }
  console.log(`[${deck}]\t${a.found.size}解/${a.ms.toFixed(0)}ms\t${b.found.size}解/${b.ms.toFixed(0)}ms\t${c.found.size}解/${c.ms.toFixed(0)}ms`);
}
console.log('');

// ===== 3. R-05：50 组随机牌 P95 benchmark =====
console.log('=== R-05 benchmark：50 组随机牌 (1~13) JS 实测 P95 ===\n');
let seed = 20260801;
const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
const times = []; const counts = [];
for (let i = 0; i < 50; i++) {
  const deck = Array.from({ length: 4 }, () => 1 + Math.floor(rnd() * 13));
  const { found, ms } = solve(deck, 1, true);
  times.push(ms); counts.push({ deck, n: found.size, ms });
}
times.sort((a, b) => a - b);
const p = (q) => times[Math.min(times.length - 1, Math.floor(times.length * q))];
console.log(`min=${times[0].toFixed(1)}ms  P50=${p(0.5).toFixed(1)}ms  P95=${p(0.95).toFixed(1)}ms  max=${times[times.length - 1].toFixed(1)}ms`);
console.log(`P95 ≤ 2000ms ? ${p(0.95) <= 2000 ? '✅ 达标' : '❌ 超标'}`);
console.log(`P95 ≤ 200ms（原预算）? ${p(0.95) <= 200 ? '✅ 竟然也达标' : '❌ 超标'}`);
counts.sort((a, b) => b.ms - a.ms);
console.log('\n最慢 5 组：');
for (const c of counts.slice(0, 5)) console.log(`  [${c.deck}] ${c.n}解 ${c.ms.toFixed(1)}ms`);
counts.sort((a, b) => b.n - a.n);
console.log('\n解数最多 5 组：');
for (const c of counts.slice(0, 5)) console.log(`  [${c.deck}] ${c.n}解 ${c.ms.toFixed(1)}ms`);
const withAdv = counts.filter((c) => c.n > 0).length;
console.log(`\n50 组中有高级解的组数 = ${withAdv} (${(withAdv / 50 * 100).toFixed(0)}%)`);
