// 为 Tester 搜索 R-04.1 的 |x| 基准用例
// 要求：|x| 作用于中间结果（非叶子）、表达式 =24、4 张牌各用 1 次
// 优先级：① 该牌组无初级解（则 |x| 是必要的，最强用例） ② 表达式短、人工可验算
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

function show(t) {
  if (t.k === 'num') return String(t.val);
  if (t.k === 'abs') return `|${show(t.a)}|`;
  if (t.k === 'rec') return `(1/${show(t.a)})`;
  return `(${show(t.a)}${t.op}${show(t.b)})`;
}
function ckey(t) {
  if (t.k === 'num') return `n${t.val}`;
  if (t.k === 'abs') return `abs(${ckey(t.a)})`;
  if (t.k === 'rec') return `rec(${ckey(t.a)})`;
  const a = ckey(t.a), b = ckey(t.b);
  if (t.op === '+' || t.op === '*') return a <= b ? `(${a}${t.op}${b})` : `(${b}${t.op}${a})`;
  return `(${a}${t.op}${b})`;
}
function evalT(t) { // 独立复算
  if (t.k === 'num') return F(t.val);
  if (t.k === 'abs') { const v = evalT(t.a); return v && F(Math.abs(v.n), v.d); }
  if (t.k === 'rec') { const v = evalT(t.a); return v && v.n !== 0 ? F(v.d, v.n) : null; }
  const a = evalT(t.a), b = evalT(t.b);
  if (!a || !b) return null;
  return BIN.find(([o]) => o === t.op)[1](a, b);
}
// abs 是否作用于二元中间结果
function absOnBin(t) {
  if (t.k === 'num') return false;
  if (t.k === 'abs') return t.a.k === 'bin' ? true : absOnBin(t.a);
  if (t.k === 'rec') return absOnBin(t.a);
  return absOnBin(t.a) || absOnBin(t.b);
}
function usesRecip(t) {
  if (t.k === 'num') return false;
  if (t.k === 'rec') return true;
  if (t.k === 'abs') return usesRecip(t.a);
  return usesRecip(t.a) || usesRecip(t.b);
}
function nodeCount(t) {
  if (t.k === 'num') return 1;
  if (t.k === 'abs' || t.k === 'rec') return 1 + nodeCount(t.a);
  return 1 + nodeCount(t.a) + nodeCount(t.b);
}

// 纯初级 solver（无单目）—— 判断牌组是否有初级解
function solvePrimary(nums) {
  const found = new Set();
  (function dfs(items) {
    if (items.length === 1) { if (is24(items[0].v)) found.add(ckey(items[0].t)); return; }
    const n = items.length;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      if (i === j) continue;
      const rest = items.filter((_, k) => k !== i && k !== j);
      for (const [op, fn] of BIN) {
        const v = fn(items[i].v, items[j].v);
        if (!v) continue;
        dfs([{ v, t: { k: 'bin', op, a: items[i].t, b: items[j].t } }, ...rest]);
      }
    }
  })(nums.map((x) => ({ v: F(x), t: { k: 'num', val: x } })));
  return found.size;
}

// 只找 abs（禁 recip），maxD=1，abs 仅对负值
function solveAbsOnly(nums) {
  const found = new Map();
  const vars = (v, t) => {
    const o = [{ v, t }];
    if (v.n < 0) o.push({ v: F(-v.n, v.d), t: { k: 'abs', a: t } });
    return o;
  };
  (function dfs(items) {
    if (items.length === 1) {
      for (const c of vars(items[0].v, items[0].t)) if (is24(c.v)) found.set(ckey(c.t), c.t);
      return;
    }
    const n = items.length;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      if (i === j) continue;
      const rest = items.filter((_, k) => k !== i && k !== j);
      for (const a of vars(items[i].v, items[i].t)) for (const b of vars(items[j].v, items[j].t))
        for (const [op, fn] of BIN) {
          const v = fn(a.v, b.v);
          if (!v) continue;
          dfs([{ v, t: { k: 'bin', op, a: a.t, b: b.t } }, ...rest]);
        }
    }
  })(nums.map((x) => ({ v: F(x), t: { k: 'num', val: x } })));
  return found;
}

console.log('=== 为 R-04.1 搜索 |x| 基准用例（|x| 作用于中间结果, =24, 4 牌各 1 次）===\n');

// 扫描牌组：1..13，组合（有序去重）
const cands = [];
for (let a = 1; a <= 13; a++) for (let b = a; b <= 13; b++) for (let c = b; c <= 13; c++) for (let d = c; d <= 13; d++) {
  const deck = [a, b, c, d];
  const advAbs = solveAbsOnly(deck);
  const midAbs = [...advAbs.values()].filter(absOnBin).filter((t) => !usesRecip(t));
  if (!midAbs.length) continue;
  const prim = solvePrimary(deck);
  // 取最短表达式
  midAbs.sort((x, y) => nodeCount(x) - nodeCount(y));
  cands.push({ deck, prim, n: midAbs.length, best: midAbs[0], bestStr: show(midAbs[0]) });
}

const noPrim = cands.filter((c) => c.prim === 0);
console.log(`扫描完成：含「|x|作用于中间结果」解的牌组 = ${cands.length} 组`);
console.log(`其中【无初级解】(|x| 为必要条件, 最强用例) = ${noPrim.length} 组\n`);

console.log('--- ★ 推荐：无初级解 + 表达式最短 的 |x| 强用例 Top 8 ---');
noPrim.sort((x, y) => nodeCount(x.best) - nodeCount(y.best));
for (const c of noPrim.slice(0, 8)) {
  const v = evalT(c.best);
  console.log(`  deck=[${c.deck}]  初级解=${c.prim}  |x|中间结果解=${c.n}`);
  console.log(`    表达式: ${c.bestStr}  独立复算=${v.n}/${v.d}=${v.n / v.d} ${v.n / v.d === 24 ? '✅' : '❌'}`);
}

console.log('\n--- 备选：有初级解但 |x| 中间结果解最短的 Top 5（次强用例）---');
const withPrim = cands.filter((c) => c.prim > 0).sort((x, y) => nodeCount(x.best) - nodeCount(y.best));
for (const c of withPrim.slice(0, 5)) {
  const v = evalT(c.best);
  console.log(`  deck=[${c.deck}] 初级解=${c.prim} → ${c.bestStr} = ${v.n / v.d} ${v.n / v.d === 24 ? '✅' : '❌'}`);
}
