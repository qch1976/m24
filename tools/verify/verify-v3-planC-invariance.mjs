// Manager 22:40 主张（承重结论，必须第三方独立复现）：
//  方案C = 口径B + 两级过滤（① 不可约简 ② 交换律规范化）具有【实现无关性】
//  证据：过滤后解数在 Manager 与 Developer 两实现间完全一致 28/66/2/13，
//        尽管全解基数差异巨大（[5,5,5,5] Manager 64 vs Developer 864）
//  要求：golden 值定义在两级过滤后的规范形解集上
//
// 我作为【第三个独立实现】验证三件事：
//  (1) 28/66/2/13 我是否复现？→ 若是，三方三实现一致，实现无关性成立
//  (2) 实现无关性是否真的成立？→ 用【4 种不同枚举/去重配置】跑同一牌组，看规范形集合是否恒等
//      注意：这是比"两实现巧合一致"更强的检验
//  (3) 方案C 是否已覆盖我的方案D？→ 我 140 日志揪出的"同骨架 6 条外衣"，②交换律规范化能否合并？
//      若不能 → C 与 D 正交，应叠加（C∩D），而非二选一
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
// ② 交换律规范化（+ / * 子树按 key 排序）—— 这一级我 140 日志的 ckey 已内含
function ckey(t) {
  if (t.k === 'num') return `n${t.val}`;
  if (t.k === 'abs') return `abs(${ckey(t.a)})`;
  if (t.k === 'rec') return `rec(${ckey(t.a)})`;
  const a = ckey(t.a), b = ckey(t.b);
  if (t.op === '+' || t.op === '*') return a <= b ? `(${a}${t.op}${b})` : `(${b}${t.op}${a})`;
  return `(${a}${t.op}${b})`;
}
// 非规范化键（用于测"实现无关性"：故意不做交换律合并）
function rawkey(t) {
  if (t.k === 'num') return `n${t.val}`;
  if (t.k === 'abs') return `abs(${rawkey(t.a)})`;
  if (t.k === 'rec') return `rec(${rawkey(t.a)})`;
  return `(${rawkey(t.a)}${t.op}${rawkey(t.b)})`;
}
function skeleton(t) {
  if (t.k === 'num') return { k: 'num', val: t.val };
  if (t.k === 'abs' || t.k === 'rec') return skeleton(t.a);
  return { k: 'bin', op: t.op, a: skeleton(t.a), b: skeleton(t.b) };
}
const skey = (t) => ckey(skeleton(t));
function uLoose(v, t) {
  const o = [{ v, t }];
  if (t.k !== 'abs' && v.n < 0) o.push({ v: F(-v.n, v.d), t: { k: 'abs', a: t } });
  if (t.k !== 'rec' && v.n !== 0 && !(Math.abs(v.n) === 1 && v.d === 1))
    o.push({ v: F(v.d, v.n), t: { k: 'rec', a: t } });
  return o;
}
// ① 不可约简过滤
function unaryPaths(t, path = [], out = []) {
  if (t.k === 'num') return out;
  if (t.k === 'abs' || t.k === 'rec') { out.push(path.slice()); unaryPaths(t.a, [...path, 'a'], out); return out; }
  unaryPaths(t.a, [...path, 'a'], out); unaryPaths(t.b, [...path, 'b'], out);
  return out;
}
function stripSubset(t, paths, cur = []) {
  const key = cur.join('');
  const drop = paths.some((p) => p.join('') === key);
  if (t.k === 'num') return t;
  if (t.k === 'abs' || t.k === 'rec') {
    const inner = stripSubset(t.a, paths, [...cur, 'a']);
    return drop ? inner : { k: t.k, a: inner };
  }
  return { k: 'bin', op: t.op, a: stripSubset(t.a, paths, [...cur, 'a']), b: stripSubset(t.b, paths, [...cur, 'b']) };
}
function irreducible(t) {
  const ps = unaryPaths(t), N = ps.length;
  if (N === 0) return true; // 纯初级解无单目可摘，视为不可约简（保留）
  for (let m = 1; m < (1 << N); m++) {
    const v = evalT(stripSubset(t, ps.filter((_, i) => m & (1 << i))));
    if (v && is24(v)) return false;
  }
  return true;
}
// 枚举：cfg 控制【实现细节】—— 用于检验实现无关性
//   cfg.key   : 'ckey'(规范化) | 'rawkey'(不规范化)
//   cfg.order : 'fwd' | 'rev'  枚举顺序
//   cfg.keepN : 中间层每键保留数（0=不截断）
function enumerate(nums, cfg) {
  const KEY = cfg.key === 'ckey' ? ckey : rawkey;
  const found = new Map();
  (function dfs(items) {
    if (items.length === 1) {
      for (const c of uLoose(items[0].v, items[0].t)) if (is24(c.v)) { const k = KEY(c.t); if (!found.has(k)) found.set(k, c.t); }
      return;
    }
    const n = items.length;
    const idx = [];
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) if (i !== j) idx.push([i, j]);
    if (cfg.order === 'rev') idx.reverse();
    const ops = cfg.order === 'rev' ? [...BIN].reverse() : BIN;
    for (const [i, j] of idx) {
      const rest = items.filter((_, k) => k !== i && k !== j);
      for (const a of uLoose(items[i].v, items[i].t)) for (const b of uLoose(items[j].v, items[j].t))
        for (const [op, fn] of ops) { const v = fn(a.v, b.v); if (!v) continue; dfs([{ v, t: { k: 'bin', op, a: a.t, b: b.t } }, ...rest]); }
    }
  })(nums.map((x) => ({ v: F(x), t: { k: 'num', val: x } })));
  return [...found.values()];
}
const uniqBy = (arr, f) => { const m = new Map(); for (const x of arr) { const k = f(x); if (!m.has(k)) m.set(k, x); } return [...m.values()]; };
const loadavg = () => { try { return readFileSync('/proc/loadavg', 'utf8').trim().split(' ').slice(0, 3).join('/'); } catch { return os.loadavg().map(x => x.toFixed(2)).join('/'); } };

console.log('=== Architect 作为第三实现：验证 Manager 的方案C「实现无关性」主张 ===');
console.log(`环境: Node ${process.version}, ${os.cpus().length} 核, loadavg ${loadavg()}, ${new Date().toISOString()}\n`);

console.log('--- (1) 复现 Manager/Developer 的 28/66/2/13 ---');
console.log('deck\t\t全解(我)\t①不可约简后\t②规范化后\tManager报\tDeveloper报\t一致?');
const CLAIM = { '5,5,5,5': 28, '2,2,10,12': 66, '1,1,5,9': 2, '2,4,9,11': 13 };
const MGR_RAW = { '5,5,5,5': 64, '2,2,10,12': 96, '1,1,5,9': 2, '2,4,9,11': 13 };
const MGR_S1 = { '5,5,5,5': 46, '2,2,10,12': 83, '1,1,5,9': 2, '2,4,9,11': 13 };
let hit = 0, tot = 0;
for (const k of Object.keys(CLAIM)) {
  const deck = k.split(',').map(Number);
  const all = enumerate(deck, { key: 'rawkey', order: 'fwd', keepN: 0 });
  const s1 = all.filter(irreducible);
  const s2 = uniqBy(s1, ckey);
  tot++;
  const ok = s2.length === CLAIM[k];
  if (ok) hit++;
  console.log(`[${deck}]\t${all.length}\t\t${s1.length}\t\t${s2.length}\t\t${CLAIM[k]}\t\t${CLAIM[k]}\t\t${ok ? '✅' : '🔴 差 ' + (s2.length - CLAIM[k])}`);
}
console.log(`\n★ 三方三实现一致性: ${hit}/${tot} ${hit === tot ? '✅ 实现无关性获第三方独立确认' : '🔴 我的规范形数与他们不一致，需定位'}`);
console.log(`  （参考：Manager 全解基数 ${JSON.stringify(MGR_RAW)}，①后 ${JSON.stringify(MGR_S1)}）`);

console.log('\n--- (2) 更强检验：同一实现内换 4 种配置，规范形集合是否恒等？---');
console.log('（"两实现巧合一致"不足以证明实现无关性；这里主动扰动枚举顺序/去重键）');
const CFGS = [
  { name: 'ckey+fwd', key: 'ckey', order: 'fwd' },
  { name: 'ckey+rev', key: 'ckey', order: 'rev' },
  { name: 'rawkey+fwd', key: 'rawkey', order: 'fwd' },
  { name: 'rawkey+rev', key: 'rawkey', order: 'rev' },
];
console.log('deck\t\t' + CFGS.map(c => c.name.padEnd(11)).join('') + '规范形集合恒等?');
for (const k of ['5,5,5,5', '2,2,10,12', '1,3,4,6', '1,4,6,8']) {
  const deck = k.split(',').map(Number);
  const sets = CFGS.map((cfg) => {
    const all = enumerate(deck, cfg);
    const s2 = uniqBy(all.filter(irreducible), ckey);
    return new Set(s2.map(ckey));
  });
  const base = sets[0];
  const same = sets.every((s) => s.size === base.size && [...s].every((x) => base.has(x)));
  console.log(`[${deck}]\t` + sets.map(s => String(s.size).padEnd(11)).join('') + (same ? '✅ 恒等' : '🔴 发散'));
}

console.log('\n--- (3) ★ 方案C 是否覆盖方案D？我 140 日志的"同骨架 6 条外衣"检验 ---');
{
  const deck = [1, 3, 4, 6];
  const all = enumerate(deck, { key: 'rawkey', order: 'fwd' });
  const C = uniqBy(all.filter(irreducible), ckey);
  const D = uniqBy(all, skey);
  const CD = uniqBy(C, skey);
  console.log(`[1,3,4,6]  全解 ${all.length}  →  方案C ${C.length}  |  方案D ${D.length}  |  ★C∩D ${CD.length}`);
  // 找 C 中同骨架的最大组
  const g = new Map();
  for (const t of C) { const s = skey(t); if (!g.has(s)) g.set(s, []); g.get(s).push(t); }
  const big = [...g.entries()].sort((a, b) => b[1].length - a[1].length)[0];
  console.log(`\n方案C 保留的解中，最大同骨架组含 ${big[1].length} 条（骨架 ${big[0]}）：`);
  for (const t of big[1].slice(0, 6)) console.log(`   ${show(t)}`);
  console.log(`\n→ 这 ${big[1].length} 条【全部通过①不可约简 + ②交换律规范化】，但玩家视角是同一解法`);
  console.log(`→ ${big[1].length > 1 ? '🔴 方案C 未覆盖方案D，二者正交，应叠加为 C∩D' : '✅ C 已覆盖 D'}`);
  const multi = [...g.values()].filter((x) => x.length > 1).length;
  console.log(`→ 方案C 中存在同骨架冗余的骨架组数: ${multi} 组（C ${C.length} 条压到 C∩D ${CD.length} 条，再降 ${(100 - CD.length / C.length * 100).toFixed(0)}%）`);
}

console.log('\n--- (4) C∩D 全面横评（含成本）+ 三桶供给 ---');
console.log('deck\t\t全解\t方案C\t方案D\t★C∩D\tC成本ms\tD成本ms\tC∩D 三桶 P/R/B');
for (const k of ['1,3,4,6', '1,4,6,8', '12,6,1,8', '1,2,3,4', '2,3,4,6', '5,5,5,5', '1,8,12,13']) {
  const deck = k.split(',').map(Number);
  const all = enumerate(deck, { key: 'rawkey', order: 'fwd' });
  const t1 = performance.now(); const C = uniqBy(all.filter(irreducible), ckey); const cC = performance.now() - t1;
  const t2 = performance.now(); const D = uniqBy(all, skey); const cD = performance.now() - t2;
  const CD = uniqBy(C, skey);
  const p = CD.filter(t => !hasUnary(t)).length, r = CD.filter(t => hasRec(t) && !hasAbs(t)).length, b = CD.filter(t => hasAbs(t)).length;
  console.log(`[${deck}]\t${all.length}\t${C.length}\t${D.length}\t${CD.length}\t${cC.toFixed(1)}\t${cD.toFixed(1)}\t${p}/${r}/${b}`);
}
console.log('\n=== 结论 ===');
