// 验证 Developer 三项主张（全程口径A：根到叶任一路径至多 1 个单目）
// 1) keepN 归因修正：三元组键下 keepN=1 是否 L1 语义断言双绿？（我此前归因 keepN 太小，他说是二元组键漏解）
// 2) 二元组键误判率 40%（他的数据）能否复现
// 3) ★ 最关键：他主张「三元组键 + keepN 可做到 hasAdvancedSolution 非空性 100% 正确」
//    这是 §1.4 [提示] 降级的命脉。用【无截断全量】作 ground truth 逐组比对，不接受抽样背书。
// 4) 浮点危险性：他报 1/((1-(4/6))/8) 浮点 = 23.999999999999996
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
// 浮点求值器（对照用，证明浮点不可用于判等）
function evalFloat(t) {
  if (t.k === 'num') return t.val;
  if (t.k === 'abs') return Math.abs(evalFloat(t.a));
  if (t.k === 'rec') return 1 / evalFloat(t.a);
  const a = evalFloat(t.a), b = evalFloat(t.b);
  return t.op === '+' ? a + b : t.op === '-' ? a - b : t.op === '*' ? a * b : a / b;
}
const hasUnary = (t) => t.k === 'num' ? false : (t.k === 'abs' || t.k === 'rec') ? true : hasUnary(t.a) || hasUnary(t.b);
const hasAbs = (t) => t.k === 'num' ? false : t.k === 'abs' ? true : t.k === 'rec' ? hasAbs(t.a) : hasAbs(t.a) || hasAbs(t.b);
const hasRec = (t) => t.k === 'num' ? false : t.k === 'rec' ? true : t.k === 'abs' ? hasRec(t.a) : hasRec(t.a) || hasRec(t.b);
const absOnBin = (t) => t.k === 'num' ? false
  : t.k === 'abs' ? (t.a.k === 'bin' ? true : absOnBin(t.a))
  : t.k === 'rec' ? absOnBin(t.a) : absOnBin(t.a) || absOnBin(t.b);
const recOnBin = (t) => t.k === 'num' ? false
  : t.k === 'rec' ? (t.a.k === 'bin' ? true : recOnBin(t.a))
  : t.k === 'abs' ? recOnBin(t.a) : recOnBin(t.a) || recOnBin(t.b);
function ckey(t) {
  if (t.k === 'num') return `n${t.val}`;
  if (t.k === 'abs') return `abs(${ckey(t.a)})`;
  if (t.k === 'rec') return `rec(${ckey(t.a)})`;
  const a = ckey(t.a), b = ckey(t.b);
  if (t.op === '+' || t.op === '*') return a <= b ? `(${a}${t.op}${b})` : `(${b}${t.op}${a})`;
  return `(${a}${t.op}${b})`;
}
// 口径A：子树含单目 → 祖先不再施加
function unaryVars(v, t) {
  const o = [{ v, t }];
  if (hasUnary(t)) return o;
  if (v.n < 0) o.push({ v: F(-v.n, v.d), t: { k: 'abs', a: t } });
  if (v.n !== 0 && !(Math.abs(v.n) === 1 && v.d === 1)) o.push({ v: F(v.d, v.n), t: { k: 'rec', a: t } });
  return o;
}
// keyMode: 'pair' = (mask,value) 二元组 | 'triple' = (mask,value,usesUnary) 三元组
// bucketed: 顶层是否按 {P,R,B} 分桶
function solve(nums, keepN, K_ans, keyMode, bucketed) {
  const FULL = 15, dp = new Map();
  const put = (mp, v, t) => {
    const k = keyMode === 'pair' ? vkey(v) : `${vkey(v)}|${hasUnary(t) ? 'A' : 'P'}`;
    const arr = mp.get(k);
    if (!arr) mp.set(k, [{ v, t }]);
    else if (arr.length < keepN) arr.push({ v, t });
  };
  for (let i = 0; i < 4; i++) {
    const mp = new Map();
    for (const c of unaryVars(F(nums[i]), { k: 'num', val: nums[i] })) put(mp, c.v, c.t);
    dp.set(1 << i, mp);
  }
  const flat = new Map(), bk = { P: new Map(), R: new Map(), B: new Map() };
  const masks = [];
  for (let m = 1; m <= FULL; m++) if (![1, 2, 4, 8].includes(m)) masks.push(m);
  masks.sort((a, b) => (a.toString(2).split('1').length - b.toString(2).split('1').length) || a - b);
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
                  const key = ckey(c.t);
                  if (flat.size < K_ans) flat.set(key, c.t);
                  const b = hasAbs(c.t) ? 'B' : hasRec(c.t) ? 'R' : 'P';
                  if (bk[b].size < K_ans) bk[b].set(key, c.t);
                } else put(mp, c.v, c.t);
              }
            }
    }
    if (!isTop) dp.set(mask, mp);
  }
  const all = bucketed ? [...bk.P.values(), ...bk.R.values(), ...bk.B.values()] : [...flat.values()];
  return { all, P: [...bk.P.values()], R: [...bk.R.values()], B: [...bk.B.values()] };
}
// ground truth：无任何截断的完整枚举（口径A）
function groundTruth(nums) {
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
  const arr = [...found.values()];
  return { total: arr.length, hasPrimary: arr.some((t) => !hasUnary(t)), hasAdvanced: arr.some(hasUnary) };
}

console.log('=== 复核 Developer 三项主张（全程口径A）===');
console.log(`环境: Node ${process.version}, ${os.cpus().length} 核, load ${os.loadavg()[0].toFixed(2)}, ${new Date().toISOString()}\n`);

console.log('--- 主张1：三元组键下 keepN=1 是否 L1 语义断言双绿？（我此前归因 keepN 太小）---');
console.log('deck\t\tkeepN\t键\t\tR类(1/x施于中间)\tB类(|x|施于中间)');
for (const deck of [[1, 3, 4, 6], [1, 4, 6, 8]]) {
  for (const keyMode of ['pair', 'triple']) {
    for (const keepN of [1, 2, 4]) {
      const r = solve(deck, keepN, 20, keyMode, true);
      const nR = r.all.filter((t) => hasRec(t) && recOnBin(t)).length;
      const nB = r.all.filter((t) => hasAbs(t) && absOnBin(t)).length;
      console.log(`[${deck}]\t${keepN}\t${keyMode === 'pair' ? '二元组' : '三元组'}\t\t${nR ? `✅ ${nR}条` : '❌ 0'}\t\t${nB ? `✅ ${nB}条` : '❌ 0'}`);
    }
  }
}

console.log('\n--- 主张2：二元组键误判率（Developer 报 40%）---');
let s0 = 20260801;
const rnd = () => { s0 = (s0 * 1103515245 + 12345) & 0x7fffffff; return s0 / 0x7fffffff; };
const decks50 = Array.from({ length: 50 }, () => Array.from({ length: 4 }, () => 1 + Math.floor(rnd() * 13)));
let gtAdv = 0, pairAdv = 0, tripAdv = 0, pairWrong = 0, tripWrong = 0;
for (const d of decks50) {
  const gt = groundTruth(d);
  const p = solve(d, 1, 20, 'pair', true), t = solve(d, 1, 20, 'triple', true);
  const pA = p.all.some(hasUnary), tA = t.all.some(hasUnary);
  if (gt.hasAdvanced) gtAdv++;
  if (pA) pairAdv++;
  if (tA) tripAdv++;
  if (pA !== gt.hasAdvanced) pairWrong++;
  if (tA !== gt.hasAdvanced) tripWrong++;
}
console.log(`ground truth 有高级解 = ${gtAdv}/50`);
console.log(`二元组键 keepN=1 判有 = ${pairAdv}/50，误判 ${pairWrong} 组（错误率 ${(pairWrong / 50 * 100).toFixed(0)}%）`);
console.log(`三元组键 keepN=1 判有 = ${tripAdv}/50，误判 ${tripWrong} 组（错误率 ${(tripWrong / 50 * 100).toFixed(0)}%）`);

console.log('\n--- ★ 主张3（最关键）：三元组键 keepN=1 的 hasAdvanced 非空性是否 100% 正确？---');
console.log('用【无截断全量】作 ground truth，逐组比对，不接受抽样背书\n');
console.log('样本量\tkeepN\t非空性误判(高级)\t非空性误判(初级)\t是否 100% 正确');
const decks300 = [];
let s1 = 20260801;
const rnd2 = () => { s1 = (s1 * 1103515245 + 12345) & 0x7fffffff; return s1 / 0x7fffffff; };
for (let i = 0; i < 300; i++) decks300.push(Array.from({ length: 4 }, () => 1 + Math.floor(rnd2() * 13)));
for (const keepN of [1, 2, 4]) {
  let wrongAdv = 0, wrongPri = 0;
  for (const d of decks300) {
    const gt = groundTruth(d);
    const r = solve(d, keepN, 20, 'triple', true);
    if (r.all.some(hasUnary) !== gt.hasAdvanced) wrongAdv++;
    if ((r.P.length > 0) !== gt.hasPrimary) wrongPri++;
  }
  console.log(`300 组\t${keepN}\t${wrongAdv} 组\t\t\t${wrongPri} 组\t\t\t${wrongAdv === 0 && wrongPri === 0 ? '✅ 是' : '❌ 否'}`);
}

console.log('\n--- 主张4：浮点判等危险性（Developer 报 23.999999999999996）---');
const CASES = [
  { deck: [1, 3, 4, 6], t: { k: 'rec', a: { k: 'bin', op: '/', a: { k: 'bin', op: '-', a: { k: 'num', val: 1 }, b: { k: 'bin', op: '/', a: { k: 'num', val: 3 }, b: { k: 'num', val: 4 } } }, b: { k: 'num', val: 6 } } } },
  { deck: [1, 4, 6, 8], t: { k: 'rec', a: { k: 'bin', op: '/', a: { k: 'bin', op: '-', a: { k: 'num', val: 1 }, b: { k: 'bin', op: '/', a: { k: 'num', val: 4 }, b: { k: 'num', val: 6 } } }, b: { k: 'num', val: 8 } } } },
];
for (const c of CASES) {
  const fr = evalT(c.t), fl = evalFloat(c.t);
  console.log(`[${c.deck}] ${show(c.t)}`);
  console.log(`   Fraction 精确 = ${fr.n}/${fr.d} = ${fr.n / fr.d}  → is24 判定 ${is24(fr) ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`   浮点         = ${fl}  → ===24 判定 ${fl === 24 ? '✅ PASS' : '❌ FAIL（浮点误差击穿）'}`);
}

console.log('\n=== 结论 ===');

// ===== 追加：隔离「分桶」与「三元组键」各自的贡献 =====
// 疑问：Developer 报二元组键 0 条高级解 / 误判率 40%，我却测出二元组也双绿、误判仅 4%
// 假设：我的顶层【分桶】独立保留 R/B 桶，掩盖了二元组键在中间层的漏解
// 若成立 → 分桶与三元组键是两道独立防线，v3 必须【同时】写死，不可互相替代
console.log('\n=== 追加：隔离分桶 vs 三元组键的贡献（回应 4% vs 40% 分歧）===\n');
console.log('deck\t\t键\t分桶\tR类\tB类\t高级解总数');
for (const deck of [[1, 3, 4, 6], [1, 4, 6, 8], [1, 2, 3, 4], [1, 3, 4, 8]]) {
  for (const keyMode of ['pair', 'triple']) {
    for (const bucketed of [false, true]) {
      const r = solve(deck, 1, 20, keyMode, bucketed);
      const nR = r.all.filter((t) => hasRec(t) && recOnBin(t)).length;
      const nB = r.all.filter((t) => hasAbs(t) && absOnBin(t)).length;
      const adv = r.all.filter(hasUnary).length;
      console.log(`[${deck}]\t${keyMode === 'pair' ? '二元' : '三元'}\t${bucketed ? '开' : '关'}\t${nR ? '✅' + nR : '❌0'}\t${nB ? '✅' + nB : '❌0'}\t${adv}${adv === 0 ? ' ⚠️' : ''}`);
    }
  }
}
console.log('\n--- 四种组合的非空性误判率（300 组，ground truth 比对）---');
console.log('键\t分桶\t高级非空性误判\t错误率');
for (const keyMode of ['pair', 'triple']) {
  for (const bucketed of [false, true]) {
    let w = 0;
    for (const d of decks300) {
      const gt = groundTruth(d);
      if (solve(d, 1, 20, keyMode, bucketed).all.some(hasUnary) !== gt.hasAdvanced) w++;
    }
    console.log(`${keyMode === 'pair' ? '二元' : '三元'}\t${bucketed ? '开' : '关'}\t${w} / 300\t\t${(w / 300 * 100).toFixed(1)}%`);
  }
}
