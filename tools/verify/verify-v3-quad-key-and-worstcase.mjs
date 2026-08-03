// 两件事：
// (1) 裁决 Manager 风险23「去重键 = 四元组 (mask,value,usedAbs,usedRecip)」vs Architect 定稿三元组 (mask,value,usesUnary)
//     四元组把状态空间×2，必须证明它买到了什么：非空性？分桶供给量？还是纯粹浪费？
// (2) 按 Manager/Tester 新纪律（风险28）重跑口径A benchmark：≥5轮 × ≥20局 + 固定SEED + 取各轮P95【最差值】+ 每轮记 loadavg
//     我此前报的 P95 属单轮，已被 Manager 正确推翻，此处按最差值口径重做
// 口径固定：subtree_block + PM1(recip跳过±1) + absNeg(abs仅负值) = 口径A（Manager 三维度表述）
import { performance } from 'node:perf_hooks';
import { readFileSync } from 'node:fs';
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
const hasUnary = (t) => t.k === 'num' ? false : (t.k === 'abs' || t.k === 'rec') ? true : hasUnary(t.a) || hasUnary(t.b);
const hasAbs = (t) => t.k === 'num' ? false : t.k === 'abs' ? true : t.k === 'rec' ? hasAbs(t.a) : hasAbs(t.a) || hasAbs(t.b);
const hasRec = (t) => t.k === 'num' ? false : t.k === 'rec' ? true : t.k === 'abs' ? hasRec(t.a) : hasRec(t.a) || hasRec(t.b);
function ckey(t) {
  if (t.k === 'num') return `n${t.val}`;
  if (t.k === 'abs') return `abs(${ckey(t.a)})`;
  if (t.k === 'rec') return `rec(${ckey(t.a)})`;
  const a = ckey(t.a), b = ckey(t.b);
  if (t.op === '+' || t.op === '*') return a <= b ? `(${a}${t.op}${b})` : `(${b}${t.op}${a})`;
  return `(${a}${t.op}${b})`;
}
// 口径A = subtree_block + PM1 + absNeg
function unaryVars(v, t) {
  const o = [{ v, t }];
  if (hasUnary(t)) return o;                                       // subtree_block
  if (v.n < 0) o.push({ v: F(-v.n, v.d), t: { k: 'abs', a: t } });  // absNeg
  if (v.n !== 0 && !(Math.abs(v.n) === 1 && v.d === 1))             // PM1: 跳过 0 与 ±1
    o.push({ v: F(v.d, v.n), t: { k: 'rec', a: t } });
  return o;
}
// keyMode: 'triple' = (mask,value,usesUnary) | 'quad' = (mask,value,usedAbs,usedRecip)
// 顶层恒用结构键 + 三桶分桶（133/132 已定裁决）
function solve(nums, keepN, K_ans, keyMode) {
  const FULL = 15, dp = new Map();
  const mkKey = (v, t) => keyMode === 'triple'
    ? `${vkey(v)}|${hasUnary(t) ? 'A' : 'P'}`
    : `${vkey(v)}|${hasAbs(t) ? 1 : 0}${hasRec(t) ? 1 : 0}`;
  const put = (mp, v, t) => {
    const k = mkKey(v, t), arr = mp.get(k);
    if (!arr) mp.set(k, [{ v, t }]);
    else if (arr.length < keepN) arr.push({ v, t });
  };
  for (let i = 0; i < 4; i++) {
    const mp = new Map();
    for (const c of unaryVars(F(nums[i]), { k: 'num', val: nums[i] })) put(mp, c.v, c.t);
    dp.set(1 << i, mp);
  }
  const bk = { P: new Map(), R: new Map(), B: new Map() };
  const masks = [];
  for (let m = 1; m <= FULL; m++) if (![1, 2, 4, 8].includes(m)) masks.push(m);
  masks.sort((a, b) => (a.toString(2).split('1').length - b.toString(2).split('1').length) || a - b);
  let states = 0;
  for (const mask of masks) {
    const isTop = mask === FULL, mp = dp.get(mask) || new Map();
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
                  const b = hasAbs(c.t) ? 'B' : hasRec(c.t) ? 'R' : 'P';
                  if (bk[b].size < K_ans) bk[b].set(ckey(c.t), c.t);
                } else put(mp, c.v, c.t);
              }
            }
    }
    if (!isTop) { dp.set(mask, mp); states += [...mp.values()].reduce((s, a) => s + a.length, 0); }
  }
  return { P: [...bk.P.values()], R: [...bk.R.values()], B: [...bk.B.values()], states };
}
function gtFlags(nums) {
  let pri = false, adv = false, absK = false, recK = false;
  (function dfs(items) {
    if (items.length === 1) {
      for (const c of unaryVars(items[0].v, items[0].t)) if (is24(c.v)) {
        if (hasUnary(c.t)) { adv = true; if (hasAbs(c.t)) absK = true; if (hasRec(c.t)) recK = true; } else pri = true;
      }
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
  return { pri, adv, absK, recK };
}
const pct = (a, p) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.ceil(p / 100 * s.length) - 1)]; };
const loadavg = () => { try { return readFileSync('/proc/loadavg', 'utf8').trim().split(' ').slice(0, 3).join('/'); } catch { return os.loadavg().map(x => x.toFixed(2)).join('/'); } };

console.log('=== (1) 裁决 Manager 风险23：去重键 三元组 vs 四元组 ===');
console.log(`环境: Node ${process.version}, ${os.cpus().length} 核, loadavg ${loadavg()}, ${new Date().toISOString()}`);
console.log('口径固定 subtree_block + PM1 + absNeg（= 口径A / Manager 三维度表述）');
console.log('顶层恒用结构键 + {P,R,B} 三桶分桶（132/133 已裁决）\n');

// 交叉验证：与 Manager JS 685 对齐，确认我的实现口径与他一致
const g1234 = gtFlags([1, 2, 3, 4]);
{
  let cnt = 0; const seen = new Set();
  (function dfs(items) {
    if (items.length === 1) { for (const c of unaryVars(items[0].v, items[0].t)) if (is24(c.v)) seen.add(ckey(c.t)); return; }
    const n = items.length;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      if (i === j) continue;
      const rest = items.filter((_, k) => k !== i && k !== j);
      for (const a of unaryVars(items[i].v, items[i].t)) for (const b of unaryVars(items[j].v, items[j].t))
        for (const [op, fn] of BIN) { const v = fn(a.v, b.v); if (!v) continue; dfs([{ v, t: { k: 'bin', op, a: a.t, b: b.t } }, ...rest]); }
    }
  })([1, 2, 3, 4].map((x) => ({ v: F(x), t: { k: 'num', val: x } })));
  console.log(`◆ 跨实现交叉验证: [1,2,3,4] 口径A 全量解数 = ${seen.size}  ← Manager JS 报 685, Tester Python 报 685  ${seen.size === 685 ? '✅ 三方逐位一致' : '❌ 不一致'}\n`);
}

console.log('--- 1.1 四元组是否改善【非空性正确率】？（300组 ground truth 比对）---');
let s1 = 20260801;
const rnd = () => { s1 = (s1 * 1103515245 + 12345) & 0x7fffffff; return s1 / 0x7fffffff; };
const D300 = Array.from({ length: 300 }, () => Array.from({ length: 4 }, () => 1 + Math.floor(rnd() * 13)));
const GT = D300.map(gtFlags);
console.log('键\tkeepN\t高级非空性误判\t初级非空性误判\tabs桶漏报\trecip桶漏报');
for (const keyMode of ['triple', 'quad']) {
  for (const keepN of [1, 2]) {
    let wA = 0, wP = 0, wB = 0, wR = 0;
    D300.forEach((d, i) => {
      const r = solve(d, keepN, 20, keyMode);
      const adv = r.R.length + r.B.length > 0;
      if (adv !== GT[i].adv) wA++;
      if ((r.P.length > 0) !== GT[i].pri) wP++;
      if (GT[i].absK && r.B.length === 0) wB++;
      if (GT[i].recK && r.R.length === 0) wR++;
    });
    console.log(`${keyMode === 'triple' ? '三元组' : '四元组'}\t${keepN}\t${wA}\t\t\t${wP}\t\t\t${wB}\t\t${wR}`);
  }
}

console.log('\n--- 1.2 四元组的性能代价（同 300 组，中间层保留状态数 + 耗时）---');
console.log('键\tkeepN\t平均状态数\t平均耗时ms\t状态数比\t耗时比');
const base = {};
for (const keyMode of ['triple', 'quad']) {
  for (const keepN of [1, 2]) {
    let st = 0; const ts = [];
    for (const d of D300) { const t0 = performance.now(); const r = solve(d, keepN, 20, keyMode); ts.push(performance.now() - t0); st += r.states; }
    const avgS = st / 300, avgT = ts.reduce((a, b) => a + b, 0) / 300;
    const k = `k${keepN}`;
    if (keyMode === 'triple') base[k] = { s: avgS, t: avgT };
    console.log(`${keyMode === 'triple' ? '三元组' : '四元组'}\t${keepN}\t${avgS.toFixed(0)}\t\t${avgT.toFixed(1)}\t\t${(avgS / base[k].s).toFixed(2)}x\t\t${(avgT / base[k].t).toFixed(2)}x`);
  }
}

console.log('\n--- 1.3 四元组是否改善【分桶供给量】？（关键：Manager 加这一维的动机应在此）---');
console.log('deck\t\t键\tP桶\tR桶\tB桶\t高级合计');
for (const deck of [[1, 4, 6, 8], [1, 3, 4, 6], [2, 3, 4, 6], [1, 3, 4, 8]]) {
  for (const keyMode of ['triple', 'quad']) {
    const r = solve(deck, 1, 20, keyMode);
    console.log(`[${deck}]\t${keyMode === 'triple' ? '三元' : '四元'}\t${r.P.length}\t${r.R.length}\t${r.B.length}\t${r.R.length + r.B.length}`);
  }
}

console.log('\n\n=== (2) 按风险28 新纪律重跑口径A benchmark（5轮×20局，取各轮P95最差值）===');
console.log('我此前报的 P95 属单轮采样，已被 Manager 正确推翻，此处按最差值口径重做\n');
for (const [keyMode, keepN] of [['triple', 1], ['triple', 2], ['quad', 1]]) {
  const rounds = [];
  console.log(`◆ ${keyMode === 'triple' ? '三元组' : '四元组'} keepN=${keepN}`);
  for (let r = 0; r < 5; r++) {
    let s = 20260801; const rr = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
    const decks = Array.from({ length: 20 }, () => Array.from({ length: 4 }, () => 1 + Math.floor(rr() * 13)));
    const la0 = loadavg(); const ts = [];
    for (const d of decks) { const t0 = performance.now(); solve(d, keepN, 20, keyMode); ts.push(performance.now() - t0); }
    const p95 = pct(ts, 95), mx = Math.max(...ts), over = ts.filter((x) => x > 2000).length;
    rounds.push({ p95, mx, over });
    console.log(`   轮${r + 1}: P50=${pct(ts, 50).toFixed(1)} P95=${p95.toFixed(1)} max=${mx.toFixed(1)} 超2s=${over}/20  loadavg ${la0}→${loadavg()}`);
  }
  const worst = Math.max(...rounds.map((x) => x.p95)), med = pct(rounds.map((x) => x.p95), 50);
  const totalOver = rounds.reduce((a, b) => a + b.over, 0);
  console.log(`   → P95 中位=${med.toFixed(1)}ms  【最差=${worst.toFixed(1)}ms】 超2s 合计=${totalOver}/100  判定 ${worst < 2000 && totalOver === 0 ? `✅ PASS（余量 ${(2000 / worst).toFixed(1)}x）` : '❌ FAIL'}\n`);
}
console.log('=== 结论 ===');
