// 人工阅读型调查脚本，非门禁。退出码恒为 0，即使正文打印 ❌ 也不判红；判定权在阅读者。
// （task-75 哑弹治理：实测 24 支 probe-v3-* 均无非零退出能力，❌/FAIL 全在 console.log 内。）
// 验证：K_internal（中间层去重强度=性能旋钮）与 K_final（顶层展示条数）能否解耦
// Manager 主张二者是同一参数、不能分开设计；本脚本验证可分离
// 核心洞察：性能瓶颈在【中间层 mask 的状态数】；展示条数只取决于【顶层 mask=full & value=24 的保留数】
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
const usesUnary = (t) => t.k === 'num' ? false : (t.k === 'abs' || t.k === 'rec') ? true : usesUnary(t.a) || usesUnary(t.b);
const hasUnaryOnNonLeaf = (t) => t.k === 'num' ? false
  : (t.k === 'abs' || t.k === 'rec') ? (t.a.k === 'bin' ? true : hasUnaryOnNonLeaf(t.a))
  : hasUnaryOnNonLeaf(t.a) || hasUnaryOnNonLeaf(t.b);
const nodes = (t) => t.k === 'num' ? 1 : (t.k === 'abs' || t.k === 'rec') ? 1 + nodes(t.a) : 1 + nodes(t.a) + nodes(t.b);
function ckey(t) {
  if (t.k === 'num') return `n${t.val}`;
  if (t.k === 'abs') return `abs(${ckey(t.a)})`;
  if (t.k === 'rec') return `rec(${ckey(t.a)})`;
  const a = ckey(t.a), b = ckey(t.b);
  if (t.op === '+' || t.op === '*') return a <= b ? `(${a}${t.op}${b})` : `(${b}${t.op}${a})`;
  return `(${a}${t.op}${b})`;
}
function unaryVars(v, t) {
  const o = [{ v, t }];
  if (v.n < 0) o.push({ v: F(-v.n, v.d), t: { k: 'abs', a: t } });
  if (v.n !== 0 && !(Math.abs(v.n) === 1 && v.d === 1)) o.push({ v: F(v.d, v.n), t: { k: 'rec', a: t } });
  return o;
}

// 解耦实现：
//   中间层 (mask != full)：按 (value, usesUnary) 去重，每键保留 K_INT 条  ← 性能旋钮
//   顶层  (mask == full)：只收 value==24，按 (usesUnary) 分桶，每桶保留 K_FIN 条 ← 展示条数
function solveDecoupled(nums, K_INT, K_FIN) {
  const FULL = 15;
  const dp = new Map();
  const put = (mp, v, t, cap) => {
    const k = `${vkey(v)}|${usesUnary(t) ? 'A' : 'P'}`;
    const arr = mp.get(k);
    if (!arr) mp.set(k, [{ v, t }]);
    else if (arr.length < cap) arr.push({ v, t });
  };
  for (let i = 0; i < 4; i++) {
    const m = 1 << i, mp = dp.get(m) || new Map();
    for (const c of unaryVars(F(nums[i]), { k: 'num', val: nums[i] })) put(mp, c.v, c.t, K_INT);
    dp.set(m, mp);
  }
  const finalBuckets = new Map(); // 'A'/'P' -> Map(ckey -> tree)
  for (let mask = 1; mask <= FULL; mask++) {
    if ([1, 2, 4, 8].includes(mask)) continue;
    const isTop = mask === FULL;
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
              for (const c of unaryVars(v, t)) {
                if (isTop) {
                  if (!is24(c.v)) continue;
                  const bk = usesUnary(c.t) ? 'A' : 'P';
                  let bm = finalBuckets.get(bk);
                  if (!bm) { bm = new Map(); finalBuckets.set(bk, bm); }
                  if (bm.size < K_FIN) bm.set(ckey(c.t), c.t);
                } else put(mp, c.v, c.t, K_INT);
              }
            }
    }
    if (!isTop) dp.set(mask, mp);
  }
  const adv = [...(finalBuckets.get('A') || new Map()).values()];
  const pri = [...(finalBuckets.get('P') || new Map()).values()];
  return { adv, pri };
}

const DECKS = [[1, 3, 4, 6], [1, 4, 6, 8], [1, 2, 3, 4], [1, 3, 4, 8], [1, 1, 5, 9]];

console.log('=== 验证：K_internal（性能）与 K_final（展示条数）可否解耦 ===\n');
console.log('固定 K_FIN=20，扫 K_INT —— 看性能是否只随 K_INT 变、展示条数是否稳定\n');
console.log('K_INT\tP95(50组)\t[1,2,3,4]高级解条数\tR-04.1命中([1,3,4,6])');
let seed0 = 20260801;
const mkDecks = () => { let s = 20260801; const r = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; }; return Array.from({ length: 50 }, () => Array.from({ length: 4 }, () => 1 + Math.floor(r() * 13))); };
const decks50 = mkDecks();
for (const K_INT of [1, 2, 4, 8]) {
  const ts = [];
  for (const d of decks50) { const t0 = performance.now(); solveDecoupled(d, K_INT, 20); ts.push(performance.now() - t0); }
  ts.sort((a, b) => a - b);
  const p95 = ts[Math.floor(ts.length * 0.95)];
  const r1234 = solveDecoupled([1, 2, 3, 4], K_INT, 20);
  const r1346 = solveDecoupled([1, 3, 4, 6], K_INT, 20);
  const mid = r1346.adv.filter(hasUnaryOnNonLeaf).length;
  console.log(`${K_INT}\t${p95.toFixed(1)}ms\t\t${r1234.adv.length}\t\t\t${mid > 0 ? `✅ ${mid}条` : '❌ 0条'}`);
}

console.log('\n固定 K_INT=4，扫 K_FIN —— 看展示条数是否只随 K_FIN 变、性能是否稳定\n');
console.log('K_FIN\tP95(50组)\t[1,2,3,4]高级解条数\t[1,3,4,6]高级解条数');
for (const K_FIN of [1, 5, 20, 50]) {
  const ts = [];
  for (const d of decks50) { const t0 = performance.now(); solveDecoupled(d, 4, K_FIN); ts.push(performance.now() - t0); }
  ts.sort((a, b) => a - b);
  const p95 = ts[Math.floor(ts.length * 0.95)];
  const a = solveDecoupled([1, 2, 3, 4], 4, K_FIN);
  const b = solveDecoupled([1, 3, 4, 6], 4, K_FIN);
  console.log(`${K_FIN}\t${p95.toFixed(1)}ms\t\t${a.adv.length}\t\t\t${b.adv.length}`);
}

console.log('\n=== 推荐配置 K_INT=4 / K_FIN=20 的完整体检 ===\n');
for (const deck of DECKS) {
  const t0 = performance.now(); const r = solveDecoupled(deck, 4, 20); const ms = performance.now() - t0;
  const mid = r.adv.filter(hasUnaryOnNonLeaf).length;
  r.adv.sort((x, y) => nodes(x) - nodes(y));
  const ok = r.adv.every((t) => { const v = evalT(t); return v && v.n / v.d === 24; });
  console.log(`[${deck}] ${ms.toFixed(1)}ms  高级解=${r.adv.length} 初级解=${r.pri.length} 单目于中间结果=${mid}  全部复算=24: ${ok ? '✅' : '❌'}`);
  if (r.adv.length) console.log(`   最短高级解: ${show(r.adv[0])} = ${(() => { const v = evalT(r.adv[0]); return v.n / v.d; })()}`);
}

// 非单调性检查：Manager 表格 K=8(3733ms) > K=20(2669ms) 是否可复现
console.log('\n=== 检查 Manager 表格的非单调异常（K=8 慢于 K=20）是否可复现 ===\n');
console.log('K_INT\t重复3轮 P95 (ms)');
for (const K of [1, 3, 5, 8, 20]) {
  const runs = [];
  for (let rep = 0; rep < 3; rep++) {
    const ts = [];
    for (const d of decks50) { const t0 = performance.now(); solveDecoupled(d, K, 20); ts.push(performance.now() - t0); }
    ts.sort((a, b) => a - b);
    runs.push(ts[Math.floor(ts.length * 0.95)]);
  }
  console.log(`${K}\t${runs.map((x) => x.toFixed(1)).join(' / ')}\t→ 单调性: ${K}`);
}
