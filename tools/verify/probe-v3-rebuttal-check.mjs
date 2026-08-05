// 人工阅读型调查脚本，非门禁。退出码恒为 0，即使正文打印 ❌ 也不判红；判定权在阅读者。
// （task-75 哑弹治理：实测 24 支 probe-v3-* 均无非零退出能力，❌/FAIL 全在 console.log 内。）
// Manager 19:25 驳回我的「D 单独即可」，两条依据：
//  ① 我的 D 首现代表有 12/23 条可约简（我报 0）→ 称根因是"首现代表依赖枚举顺序"
//  ② 存在【整组无任何不可约简解】的骨架组（10/21 组）→ C 整组删、D 保留一条 → C∩D ≠ D
//
// 但他的反例是: (1/(|((1/(1/(1/6)))-(1/3))|/4))  含 1/(1/(1/6)) 三重 recip
// ★ 在口径B(self_only) 下，uLoose 的守卫是 `if (t.k !== 'rec')`
//   → rec(6) 的 k==='rec' → 不能再套 rec → rec(rec(rec(6))) 【不可能产生】
// ⇒ 他的反例可能根本不在口径B 解集内，而属更宽口径（无 self_only 守卫）
//
// 本脚本三查：
//  (1) 他的反例式子在我的口径B 枚举里是否存在？三重 rec 是否可达？
//  (2) 【整组无不可约简解】的骨架组是否真实存在？（这是决定性的，与谁的口径无关）
//  (3) 我 143 报 0 条，是枚举顺序巧合还是规则保证？→ 换 4 种确定性代表规则各测一遍
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
const unaryCount = (t) => t.k === 'num' ? 0 : (t.k === 'abs' || t.k === 'rec') ? 1 + unaryCount(t.a) : unaryCount(t.a) + unaryCount(t.b);
// 最长连续同类单目链（检验三重 rec 是否可达）
function maxRecChain(t, cur = 0) {
  if (t.k === 'num') return cur;
  if (t.k === 'rec') return maxRecChain(t.a, cur + 1);
  if (t.k === 'abs') return Math.max(cur, maxRecChain(t.a, 0));
  return Math.max(cur, maxRecChain(t.a, 0), maxRecChain(t.b, 0));
}
function ckey(t) {
  if (t.k === 'num') return `n${t.val}`;
  if (t.k === 'abs') return `abs(${ckey(t.a)})`;
  if (t.k === 'rec') return `rec(${ckey(t.a)})`;
  const a = ckey(t.a), b = ckey(t.b);
  if (t.op === '+' || t.op === '*') return a <= b ? `(${a}${t.op}${b})` : `(${b}${t.op}${a})`;
  return `(${a}${t.op}${b})`;
}
function skeleton(t) {
  if (t.k === 'num') return { k: 'num', val: t.val };
  if (t.k === 'abs' || t.k === 'rec') return skeleton(t.a);
  return { k: 'bin', op: t.op, a: skeleton(t.a), b: skeleton(t.b) };
}
const skey = (t) => ckey(skeleton(t));
// 口径B = self_only：直接父节点同类则禁（rec 不能直接套 rec，abs 不能直接套 abs）
function uSelfOnly(v, t) {
  const o = [{ v, t }];
  if (t.k !== 'abs' && v.n < 0) o.push({ v: F(-v.n, v.d), t: { k: 'abs', a: t } });
  if (t.k !== 'rec' && v.n !== 0 && !(Math.abs(v.n) === 1 && v.d === 1))
    o.push({ v: F(v.d, v.n), t: { k: 'rec', a: t } });
  return o;
}
// 无 self_only 守卫的更宽口径（怀疑 Manager 用的是这个）
function uNoGuard(v, t) {
  const o = [{ v, t }];
  if (v.n < 0) o.push({ v: F(-v.n, v.d), t: { k: 'abs', a: t } });
  if (v.n !== 0 && !(Math.abs(v.n) === 1 && v.d === 1)) o.push({ v: F(v.d, v.n), t: { k: 'rec', a: t } });
  return o;
}
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
  if (N === 0) return true;
  for (let m = 1; m < (1 << N); m++) {
    const v = evalT(stripSubset(t, ps.filter((_, i) => m & (1 << i))));
    if (v && is24(v)) return false;
  }
  return true;
}
function enumerate(nums, uv, order = 'fwd') {
  const found = new Map();
  (function dfs(items) {
    if (items.length === 1) { for (const c of uv(items[0].v, items[0].t)) if (is24(c.v)) { const k = ckey(c.t); if (!found.has(k)) found.set(k, c.t); } return; }
    const n = items.length;
    const idx = [];
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) if (i !== j) idx.push([i, j]);
    if (order === 'rev') idx.reverse();
    const ops = order === 'rev' ? [...BIN].reverse() : BIN;
    for (const [i, j] of idx) {
      const rest = items.filter((_, k) => k !== i && k !== j);
      for (const a of uv(items[i].v, items[i].t)) for (const b of uv(items[j].v, items[j].t))
        for (const [op, fn] of ops) { const v = fn(a.v, b.v); if (!v) continue; dfs([{ v, t: { k: 'bin', op, a: a.t, b: b.t } }, ...rest]); }
    }
  })(nums.map((x) => ({ v: F(x), t: { k: 'num', val: x } })));
  return [...found.values()];
}
const loadavg = () => { try { return readFileSync('/proc/loadavg', 'utf8').trim().split(' ').slice(0, 3).join('/'); } catch { return os.loadavg().map(x => x.toFixed(2)).join('/'); } };

console.log('=== 复核 Manager 19:25 的驳回：他的反例是否属于口径B 解集？===');
console.log(`环境: Node ${process.version}, ${os.cpus().length} 核, loadavg ${loadavg()}, ${new Date().toISOString()}\n`);

console.log('--- (1) 他的反例 (1/(|((1/(1/(1/6)))-(1/3))|/4)) 含三重 rec，口径B 下可达吗？---');
console.log('口径B(self_only) 守卫: `if (t.k !== \'rec\')` → rec(6).k===\'rec\' → 不能再套 rec');
{
  // 手工构造他的反例 AST
  const r6 = { k: 'rec', a: { k: 'num', val: 6 } };
  const rr6 = { k: 'rec', a: r6 };
  const rrr6 = { k: 'rec', a: rr6 };
  const inner = { k: 'bin', op: '-', a: rrr6, b: { k: 'rec', a: { k: 'num', val: 3 } } };
  const t = { k: 'rec', a: { k: 'bin', op: '/', a: { k: 'abs', a: inner }, b: { k: 'num', val: 4 } } };
  const v = evalT(t);
  console.log(`   反例式: ${show(t)}`);
  console.log(`   求值 = ${v ? v.n / v.d : 'null'}  ${v && is24(v) ? '(=24 ✅ 数值上确实是解)' : ''}`);
  console.log(`   最长连续 rec 链 = ${maxRecChain(t)}  单目数 = ${unaryCount(t)}`);
  console.log(`   → 连续 rec 链 ${maxRecChain(t)} > 1 ⇒ 口径B(self_only) 【禁止】此形态`);
}
for (const [label, uv] of [['口径B(self_only)', uSelfOnly], ['无守卫更宽口径', uNoGuard]]) {
  const all = enumerate([1, 3, 4, 6], uv);
  const maxChain = Math.max(...all.map(maxRecChain));
  const chain3 = all.filter((t) => maxRecChain(t) >= 3).length;
  console.log(`   ${label.padEnd(16)} 全解 ${String(all.length).padStart(5)}  最长 rec 链 ${maxChain}  含≥3重 rec 的解 ${chain3} 条`);
}
console.log('   ★ 若口径B 下 ≥3重 rec 恒为 0 条 ⇒ Manager 的反例不在口径B 解集内，其 12/23 条统计口径与 v3 不同');

console.log('\n--- (2) ★ 决定性：【整组无不可约简解】的骨架组是否存在？（与口径无关的独立检验）---');
console.log('这是他驳回的核心依据，若成立则 ① 确实不可省，我必须认');
console.log('deck\t\t口径\t\t全解\t骨架组数\t★空组(全可约简)\tC条数\tD条数\tC∩D\tC∩D=D?');
for (const deckStr of ['1,3,4,6', '1,4,6,8', '2,3,4,6', '5,5,5,5']) {
  const deck = deckStr.split(',').map(Number);
  for (const [label, uv] of [['self_only', uSelfOnly], ['noGuard', uNoGuard]]) {
    const all = enumerate(deck, uv);
    const groups = new Map();
    for (const t of all) { const s = skey(t); if (!groups.has(s)) groups.set(s, []); groups.get(s).push(t); }
    let empty = 0;
    const lazy = [];
    for (const [s, arr] of groups) {
      const sorted = [...arr].sort((a, b) => unaryCount(a) - unaryCount(b) || (ckey(a) < ckey(b) ? -1 : 1));
      let pick = null;
      for (const x of sorted) if (irreducible(x)) { pick = x; break; }
      if (pick) lazy.push(pick); else empty++;
    }
    const C = all.filter(irreducible);
    const Cs = new Set(C.map(skey));
    const D = groups.size;
    console.log(`[${deck}]\t${label.padEnd(10)}\t${String(all.length).padStart(5)}\t${String(D).padStart(4)}\t\t${String(empty).padStart(4)}\t\t\t${String(C.length).padStart(5)}\t${String(D).padStart(4)}\t${String(Cs.size).padStart(4)}\t${Cs.size === D ? '✅ 等价' : `🔴 差 ${D - Cs.size} 组`}`);
  }
}

console.log('\n--- (3) 我 143 报 0 条：枚举顺序巧合，还是规则保证？换 4 种代表规则各测 ---');
console.log('规则: first=首现 | rev=逆序首现 | minU=单目数最少 | minU+ckey=单目最少+字典序（确定性）');
console.log('deck\t\t骨架组\tfirst可约简\trev可约简\tminU可约简\tminU+ckey可约简');
for (const deckStr of ['1,3,4,6', '1,4,6,8', '2,3,4,6', '1,2,3,4']) {
  const deck = deckStr.split(',').map(Number);
  const allF = enumerate(deck, uSelfOnly, 'fwd');
  const allR = enumerate(deck, uSelfOnly, 'rev');
  const mk = (all, pick) => {
    const g = new Map();
    for (const t of all) { const s = skey(t); if (!g.has(s)) g.set(s, []); g.get(s).push(t); }
    let bad = 0;
    for (const arr of g.values()) if (!irreducible(pick(arr))) bad++;
    return { bad, n: g.size };
  };
  const a = mk(allF, (arr) => arr[0]);
  const b = mk(allR, (arr) => arr[0]);
  const c = mk(allF, (arr) => [...arr].sort((x, y) => unaryCount(x) - unaryCount(y))[0]);
  const d = mk(allF, (arr) => [...arr].sort((x, y) => unaryCount(x) - unaryCount(y) || (ckey(x) < ckey(y) ? -1 : 1))[0]);
  console.log(`[${deck}]\t${a.n}\t${a.bad}\t\t${b.bad}\t\t${c.bad}\t\t${d.bad}`);
}

console.log('\n--- (4) 复核他质疑的成本差（他 11~53ms vs 我 197~947ms）---');
console.log('我的①实现：每条解独立跑 2^N 全子集枚举，无跨条复用 → 确认是否为我实现慢');
for (const deckStr of ['1,3,4,6', '1,2,3,4']) {
  const deck = deckStr.split(',').map(Number);
  const all = enumerate(deck, uSelfOnly);
  const t1 = performance.now(); const C = all.filter(irreducible); const cC = performance.now() - t1;
  const t2 = performance.now();
  const g = new Map();
  for (const t of all) { const s = skey(t); if (!g.has(s)) g.set(s, []); g.get(s).push(t); }
  const lazy = [];
  for (const arr of g.values()) {
    const sorted = [...arr].sort((x, y) => unaryCount(x) - unaryCount(y) || (ckey(x) < ckey(y) ? -1 : 1));
    for (const x of sorted) if (irreducible(x)) { lazy.push(x); break; }
  }
  const cLazy = performance.now() - t2;
  const nUnary = all.map(unaryCount);
  console.log(`[${deck}] 全解 ${all.length}  单目数分布 max=${Math.max(...nUnary)} avg=${(nUnary.reduce((a, b) => a + b, 0) / all.length).toFixed(2)}`);
  console.log(`   全量①: ${cC.toFixed(1)}ms (${C.length} 条)   ★惰性: ${cLazy.toFixed(1)}ms (${lazy.length} 条)   提速 ${(cC / cLazy).toFixed(1)}x`);
}
console.log('\n=== 结论 ===');
