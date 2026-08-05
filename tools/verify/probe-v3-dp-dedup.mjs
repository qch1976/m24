// 人工阅读型调查脚本，非门禁。退出码恒为 0，即使正文打印 ❌ 也不判红；判定权在阅读者。
// （task-75 哑弹治理：实测 24 支 probe-v3-* 均无非零退出能力，❌/FAIL 全在 console.log 内。）
// 验证 Developer 提议：bitmask 分层子集 DP + 值级去重（同 bitmask 同值只留 1 代表式）
// 对比 3 种实现的：耗时 / 解数语义 / R-04.1 基准解命中
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
function ckey(t) {
  if (t.k === 'num') return `n${t.val}`;
  if (t.k === 'abs') return `abs(${ckey(t.a)})`;
  if (t.k === 'rec') return `rec(${ckey(t.a)})`;
  const a = ckey(t.a), b = ckey(t.b);
  if (t.op === '+' || t.op === '*') return a <= b ? `(${a}${t.op}${b})` : `(${b}${t.op}${a})`;
  return `(${a}${t.op}${b})`;
}
function evalT(t) { // 独立复算，校验正确性
  if (t.k === 'num') return F(t.val);
  if (t.k === 'abs') { const v = evalT(t.a); return v && F(Math.abs(v.n), v.d); }
  if (t.k === 'rec') { const v = evalT(t.a); return v && v.n !== 0 ? F(v.d, v.n) : null; }
  const a = evalT(t.a), b = evalT(t.b);
  if (!a || !b) return null;
  return BIN.find(([o]) => o === t.op)[1](a, b);
}
function hasUnaryOnNonLeaf(t) {
  if (t.k === 'num') return false;
  if (t.k === 'abs' || t.k === 'rec') return t.a.k === 'bin' ? true : hasUnaryOnNonLeaf(t.a);
  return hasUnaryOnNonLeaf(t.a) || hasUnaryOnNonLeaf(t.b);
}
function usesUnary(t) {
  if (t.k === 'num') return false;
  if (t.k === 'abs' || t.k === 'rec') return true;
  return usesUnary(t.a) || usesUnary(t.b);
}

// 单目变体：maxD=1，恒等剪枝（abs 仅负值 / recip 跳过 0 与 ±1）
function unaryVars(v, t) {
  const out = [{ v, t }];
  if (v.n < 0) out.push({ v: F(-v.n, v.d), t: { k: 'abs', a: t } });
  if (v.n !== 0 && !(Math.abs(v.n) === 1 && v.d === 1)) out.push({ v: F(v.d, v.n), t: { k: 'rec', a: t } });
  return out;
}

// ===== 实现 1：朴素 DFS（全表达式，不做值级去重）—— v3 §2 拟采用的基线 =====
function solveDFS(nums) {
  const found = new Map();
  (function dfs(items) {
    if (items.length === 1) {
      for (const c of unaryVars(items[0].v, items[0].t)) if (is24(c.v)) found.set(ckey(c.t), c.t);
      return;
    }
    const n = items.length;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      if (i === j) continue;
      const rest = items.filter((_, k) => k !== i && k !== j);
      for (const a of unaryVars(items[i].v, items[i].t))
        for (const b of unaryVars(items[j].v, items[j].t))
          for (const [op, fn] of BIN) {
            const v = fn(a.v, b.v);
            if (!v) continue;
            dfs([{ v, t: { k: 'bin', op, a: a.t, b: b.t } }, ...rest]);
          }
    }
  })(nums.map((x) => ({ v: F(x), t: { k: 'num', val: x } })));
  return found;
}

// ===== 实现 2：Developer 提议 —— bitmask 子集 DP + 值级去重（同 mask 同值留 1 代表式）=====
function solveDPValueDedup(nums) {
  const dp = new Map(); // mask -> Map(valueKey -> tree)   每个 (mask,value) 只留 1 代表式
  for (let i = 0; i < 4; i++) {
    const m = 1 << i;
    const mp = new Map();
    for (const c of unaryVars(F(nums[i]), { k: 'num', val: nums[i] })) {
      if (!mp.has(vkey(c.v))) mp.set(vkey(c.v), c.t);
    }
    // 同一牌位可能已有 mask（重复牌），合并
    if (dp.has(m)) { for (const [k, v] of mp) if (!dp.get(m).has(k)) dp.get(m).set(k, v); }
    else dp.set(m, mp);
  }
  const full = 15;
  for (let mask = 1; mask <= full; mask++) {
    if (dp.has(mask) && [1, 2, 4, 8].includes(mask)) continue;
    const mp = dp.get(mask) || new Map();
    for (let sub = (mask - 1) & mask; sub > 0; sub = (sub - 1) & mask) {
      const other = mask ^ sub;
      if (sub > other) continue; // 只算一半，靠 BIN 双向覆盖
      const A = dp.get(sub), B = dp.get(other);
      if (!A || !B) continue;
      for (const [, ta] of A) for (const [, tb] of B) {
        const va = evalT(ta), vb = evalT(tb);
        for (const [op, fn] of BIN) {
          for (const [x, y, tx, ty] of [[va, vb, ta, tb], [vb, va, tb, ta]]) {
            const v = fn(x, y);
            if (!v) continue;
            const t = { k: 'bin', op, a: tx, b: ty };
            for (const c of unaryVars(v, t)) {
              const k = vkey(c.v);
              if (!mp.has(k)) mp.set(k, c.t); // 值级去重：只留第一个代表式
            }
          }
        }
      }
    }
    dp.set(mask, mp);
  }
  const top = dp.get(full) || new Map();
  const out = new Map();
  for (const [k, t] of top) if (k === '24/1') out.set(ckey(t), t);
  return out;
}

// ===== 执行 =====
const DECKS = [[1, 3, 4, 6], [1, 4, 6, 8], [1, 2, 3, 4], [1, 3, 4, 8], [3, 8, 8, 3]];

console.log('=== 对比：朴素DFS(全表达式) vs Developer提议(bitmask DP + 值级去重) ===\n');
console.log('牌组\t\tDFS解数\tDFS耗时\t\tDP解数\tDP耗时\t\t加速比');
for (const deck of DECKS) {
  const t0 = performance.now(); const a = solveDFS(deck); const t1 = performance.now();
  const b = solveDPValueDedup(deck); const t2 = performance.now();
  const ta = t1 - t0, tb = t2 - t1;
  console.log(`[${deck}]\t${String(a.size).padStart(5)}\t${ta.toFixed(1)}ms\t\t${String(b.size).padStart(5)}\t${tb.toFixed(1)}ms\t\t${(ta / tb).toFixed(1)}x`);
}

console.log('\n=== 关键语义差异：值级去重是否影响「有无高级解」判定与 R-04.1 命中 ===\n');
for (const deck of [[1, 3, 4, 6], [1, 4, 6, 8]]) {
  const a = solveDFS(deck), b = solveDPValueDedup(deck);
  const aAdv = [...a.values()].filter(usesUnary).length;
  const bAdv = [...b.values()].filter(usesUnary).length;
  const aMid = [...a.values()].filter(hasUnaryOnNonLeaf).length;
  const bMid = [...b.values()].filter(hasUnaryOnNonLeaf).length;
  console.log(`[${deck}]`);
  console.log(`  DFS: 总解=${a.size} 含高级符号=${aAdv} 单目作用于中间结果=${aMid}`);
  console.log(`  DP : 总解=${b.size} 含高级符号=${bAdv} 单目作用于中间结果=${bMid}`);
  console.log(`  → 「本局是否有高级解」判定一致? ${(aAdv > 0) === (bAdv > 0) ? '✅ 一致' : '❌ 不一致'}`);
  console.log(`  → 「找齐所有解」条数一致? ${a.size === b.size ? '✅' : `❌ DP 少 ${a.size - b.size} 条（值级去重必然损失表达式多样性）`}`);
  const sample = [...b.values()].slice(0, 3);
  for (const t of sample) { const v = evalT(t); console.log(`    DP代表式: ${show(t)} = ${v.n / v.d} ${v.n / v.d === 24 ? '✅' : '❌'}`); }
  console.log('');
}

// P95 对比
console.log('=== R-05 P95 对比：50 组随机牌 ===\n');
let seed = 20260801;
const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
const decks = Array.from({ length: 50 }, () => Array.from({ length: 4 }, () => 1 + Math.floor(rnd() * 13)));
for (const [name, fn] of [['朴素DFS', solveDFS], ['DP+值级去重', solveDPValueDedup]]) {
  const ts = [];
  for (const d of decks) { const t0 = performance.now(); fn(d); ts.push(performance.now() - t0); }
  ts.sort((x, y) => x - y);
  const p95 = ts[Math.floor(ts.length * 0.95)];
  console.log(`${name}\tP50=${ts[25].toFixed(1)}ms\tP95=${p95.toFixed(1)}ms\tmax=${ts[49].toFixed(1)}ms\t2s达标:${p95 <= 2000 ? '✅' : '❌'}`);
}
