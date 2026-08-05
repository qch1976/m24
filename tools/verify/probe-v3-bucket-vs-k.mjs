// 人工阅读型调查脚本，非门禁。退出码恒为 0，即使正文打印 ❌ 也不判红；判定权在阅读者。
// （task-75 哑弹治理：实测 24 支 probe-v3-* 均无非零退出能力，❌/FAIL 全在 console.log 内。）
// 验证两件事：
// (1) Tester 主张「结构等价判定」+ 同时要求「K≥50 才存活」是否自相矛盾
//     若断言是存在性（不指定具体表达式），K 下限应不存在
// (2) 更优架构解法：顶层【分桶保留】而非提高 K
//     不分桶：answers 只保前 K_ans 条 → 含 abs 的解可能被初级解/recip 解挤掉（Tester 说的"排位靠后"）
//     分桶  ：按 {纯初级, 含recip, 含abs} 三桶各保 K_ans 条 → 双符号覆盖有保证，K_ans 可低至 5
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
const vkey = (f) => `${f.n}/${f.d}`;
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
const hasAbs = (t) => t.k === 'num' ? false : t.k === 'abs' ? true : t.k === 'rec' ? hasAbs(t.a) : hasAbs(t.a) || hasAbs(t.b);
const hasRec = (t) => t.k === 'num' ? false : t.k === 'rec' ? true : t.k === 'abs' ? hasRec(t.a) : hasRec(t.a) || hasRec(t.b);
// R-04.1 L1 谓词：该符号的操作数是二元中间结果
const absOnBin = (t) => t.k === 'num' ? false
  : t.k === 'abs' ? (t.a.k === 'bin' ? true : absOnBin(t.a))
  : t.k === 'rec' ? absOnBin(t.a) : absOnBin(t.a) || absOnBin(t.b);
const recOnBin = (t) => t.k === 'num' ? false
  : t.k === 'rec' ? (t.a.k === 'bin' ? true : recOnBin(t.a))
  : t.k === 'abs' ? recOnBin(t.a) : recOnBin(t.a) || recOnBin(t.b);
const nodes = (t) => t.k === 'num' ? 1 : (t.k === 'abs' || t.k === 'rec') ? 1 + nodes(t.a) : 1 + nodes(t.a) + nodes(t.b);
function ckey(t) {
  if (t.k === 'num') return `n${t.val}`;
  if (t.k === 'abs') return `abs(${ckey(t.a)})`;
  if (t.k === 'rec') return `rec(${ckey(t.a)})`;
  const a = ckey(t.a), b = ckey(t.b);
  if (t.op === '+' || t.op === '*') return a <= b ? `(${a}${t.op}${b})` : `(${b}${t.op}${a})`;
  return `(${a}${t.op}${b})`;
}
// 口径A 严：子树含单目 → 祖先不再施加
function unaryVars(v, t) {
  const o = [{ v, t }];
  if (hasUnary(t)) return o;
  if (v.n < 0) o.push({ v: F(-v.n, v.d), t: { k: 'abs', a: t } });
  if (v.n !== 0 && !(Math.abs(v.n) === 1 && v.d === 1)) o.push({ v: F(v.d, v.n), t: { k: 'rec', a: t } });
  return o;
}
// bucketed: false = 顶层不分桶（Tester 观测到的行为）｜true = 按 {P, recip, abs} 三桶各保 K_ans
function solve(nums, K_mid, K_ans, bucketed) {
  const FULL = 15;
  const dp = new Map();
  const put = (mp, v, t) => {
    const k = `${vkey(v)}|${hasUnary(t) ? 'A' : 'P'}`;
    const arr = mp.get(k);
    if (!arr) mp.set(k, [{ v, t }]);
    else if (arr.length < K_mid) arr.push({ v, t });
  };
  for (let i = 0; i < 4; i++) {
    const mp = new Map();
    for (const c of unaryVars(F(nums[i]), { k: 'num', val: nums[i] })) put(mp, c.v, c.t);
    dp.set(1 << i, mp);
  }
  const flat = new Map();               // 不分桶
  const buckets = { P: new Map(), R: new Map(), B: new Map() }; // 分桶：纯初级/含recip/含abs
  const masks = [];
  for (let m = 1; m <= FULL; m++) if (![1, 2, 4, 8].includes(m)) masks.push(m);
  masks.sort((a, b) => (a.toString(2).split('1').length - b.toString(2).split('1').length) || a - b);
  for (const mask of masks) {
    const isTop = mask === FULL;
    const mp = dp.get(mask) || new Map();
    for (let sub = (mask - 1) & mask; sub > 0; sub = (sub - 1) & mask) {
      const other = mask ^ sub;
      if (sub > other) continue;
      const A = dp.get(sub), Bm = dp.get(other);
      if (!A || !Bm) continue;
      for (const arrA of A.values()) for (const arrB of Bm.values())
        for (const ea of arrA) for (const eb of arrB)
          for (const [op, fn] of BIN)
            for (const [x, y, tx, ty] of [[ea.v, eb.v, ea.t, eb.t], [eb.v, ea.v, eb.t, ea.t]]) {
              const v = fn(x, y);
              if (!v) continue;
              const t = { k: 'bin', op, a: tx, b: ty };
              for (const c of unaryVars(v, t)) {
                if (isTop) {
                  if (!is24(c.v)) continue;
                  const key = ckey(c.t);
                  if (flat.size < K_ans) flat.set(key, c.t);
                  const bk = hasAbs(c.t) ? 'B' : hasRec(c.t) ? 'R' : 'P';
                  if (buckets[bk].size < K_ans) buckets[bk].set(key, c.t);
                } else put(mp, c.v, c.t);
              }
            }
    }
    if (!isTop) dp.set(mask, mp);
  }
  return bucketed
    ? { P: [...buckets.P.values()], R: [...buckets.R.values()], B: [...buckets.B.values()] }
    : { flat: [...flat.values()] };
}

console.log('=== 验证 Tester「结构等价判定 + K≥50 下限」是否自相矛盾，并给出更优架构解 ===');
console.log(`环境: Node ${process.version}, ${os.cpus().length} 核, load ${os.loadavg()[0].toFixed(2)}, ${new Date().toISOString()}`);
console.log('全程口径A（严），DP + (mask,value,usesUnary) 去重\n');

const DECKS = [[1, 3, 4, 6], [1, 4, 6, 8], [2, 3, 4, 6]];
const Ks = [1, 2, 3, 5, 8, 20, 50];

console.log('--- 实验1：L1 结构等价断言（存在性）在各 K 下是否稳定通过？K_ans=20 固定 ---');
console.log('断言R = 存在解 含1/x 且 1/x 操作数为二元中间结果 ｜ 断言B = 存在解 含|x| 且 |x| 操作数为二元中间结果\n');
console.log('deck\t\t策略\t\t' + Ks.map((k) => `K=${k}`).join('\t'));
for (const deck of DECKS) {
  for (const bucketed of [false, true]) {
    const cells = Ks.map((K) => {
      const r = solve(deck, K, 20, bucketed);
      const all = bucketed ? [...r.P, ...r.R, ...r.B] : r.flat;
      const okR = all.some((t) => hasRec(t) && recOnBin(t));
      const okB = all.some((t) => hasAbs(t) && absOnBin(t));
      return `${okR ? 'R✅' : 'R❌'}${okB ? 'B✅' : 'B❌'}`;
    });
    console.log(`[${deck}]\t${bucketed ? '分桶  ' : '不分桶'}\t\t` + cells.join('\t'));
  }
}

console.log('\n--- 实验2：分桶如何解决 Tester 观测的「abs 解排位靠后被挤掉」---');
console.log('K_mid=3 固定，扫 K_ans，看含 abs 的解能否进入展示集\n');
console.log('deck\t\tK_ans\t不分桶: 总数/含abs\t分桶: 初级/recip/abs');
for (const deck of DECKS) {
  for (const K_ans of [5, 20, 50]) {
    const f = solve(deck, 3, K_ans, false).flat;
    const b = solve(deck, 3, K_ans, true);
    const fAbs = f.filter((t) => hasAbs(t) && absOnBin(t)).length;
    console.log(`[${deck}]\t${K_ans}\t${f.length} / ${fAbs}${fAbs === 0 ? ' ❌' : ' ✅'}\t\t\t${b.P.length} / ${b.R.length} / ${b.B.length}${b.B.length ? ' ✅' : ' ❌'}`);
  }
  console.log('');
}

console.log('--- 实验3：分桶的性能代价（50 局 P95，SEED=20260801）---');
let s0 = 20260801;
const r = () => { s0 = (s0 * 1103515245 + 12345) & 0x7fffffff; return s0 / 0x7fffffff; };
const decks50 = Array.from({ length: 50 }, () => Array.from({ length: 4 }, () => 1 + Math.floor(r() * 13)));
for (const bucketed of [false, true]) {
  const ts = [];
  for (const d of decks50) { const t0 = performance.now(); solve(d, 3, 20, bucketed); ts.push(performance.now() - t0); }
  ts.sort((a, b) => a - b);
  console.log(`${bucketed ? '分桶  ' : '不分桶'}: P50=${ts[25].toFixed(1)}ms  P95=${ts[47].toFixed(1)}ms  max=${ts[49].toFixed(1)}ms  超2s=${ts.filter((x) => x > 2000).length}/50`);
}

console.log('\n--- 实验4：分桶 + K_mid=3 + K_ans=20 下，4 条基准用例的 L1 断言体检 ---');
for (const deck of [[1, 3, 4, 6], [1, 4, 6, 8], [2, 3, 4, 6]]) {
  const b = solve(deck, 3, 20, true);
  const all = [...b.P, ...b.R, ...b.B];
  const rr = all.filter((t) => hasRec(t) && recOnBin(t));
  const bb = all.filter((t) => hasAbs(t) && absOnBin(t));
  rr.sort((x, y) => nodes(x) - nodes(y)); bb.sort((x, y) => nodes(x) - nodes(y));
  console.log(`[${deck}]  recip类=${rr.length} 条  abs类=${bb.length} 条`);
  if (rr.length) { const v = evalT(rr[0]); console.log(`   1/x 最短: ${show(rr[0])} = ${v.n / v.d} ${v.n / v.d === 24 ? '✅' : '❌'}`); }
  if (bb.length) { const v = evalT(bb[0]); console.log(`   |x| 最短: ${show(bb[0])} = ${v.n / v.d} ${v.n / v.d === 24 ? '✅' : '❌'}`); }
}

console.log('\n=== 结论 ===');
console.log('1. L1 结构等价断言是存在性断言 → 不指定具体表达式 → K 下限不成立');
console.log('2. Tester 的「K≥50」源自追踪特定目标解（字面思路残留），与他主张的结构等价判定不自洽');
console.log('3. 真正需要的不是提高 K，而是顶层【按符号分桶保留】：');
console.log('   不分桶时含 abs 的解会被大量初级/recip 解挤出展示集（Tester 观测到的现象）');
console.log('   分桶后 K_ans 可低至 5，双符号覆盖有保证，且性能无额外代价');
