// 人工阅读型调查脚本，非门禁。退出码恒为 0，即使正文打印 ❌ 也不判红；判定权在阅读者。
// （task-75 哑弹治理：实测 24 支 probe-v3-* 均无非零退出能力，❌/FAIL 全在 console.log 内。）
// Manager 已撤回 FAIL 结论，现推荐方案C =「口径B + 不可约简过滤」（与 Developer 共同推荐）
// 但我 14:15 实测：不可约简过滤后 [1,3,4,6] 仍剩 610 条（口径A 46 条），成本 57~74ms
// 「不可约简」是【数学判据】，不是【解法独立判据】—— 同一解法套不同外衣全部保留
//
// 本脚本量化我提的第四方案：★ 解法骨架去重（skeleton dedup）
//   判据：删掉所有单目节点得到纯二元骨架，再结构规范化 → 同骨架 = 同一解法
//   直觉：|1-3|*4 与 (1-3)*4 骨架相同；1/(1/4) 与 4 骨架相同 → 合并为一条
//   代价：O(n) 单次遍历，无 2^N 枚举
// 对比四方案在真实牌组上的面板条数 + 成本，供项目主一次看清可选项
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
  if (!t) return null;
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
function ckey(t) {
  if (t.k === 'num') return `n${t.val}`;
  if (t.k === 'abs') return `abs(${ckey(t.a)})`;
  if (t.k === 'rec') return `rec(${ckey(t.a)})`;
  const a = ckey(t.a), b = ckey(t.b);
  if (t.op === '+' || t.op === '*') return a <= b ? `(${a}${t.op}${b})` : `(${b}${t.op}${a})`;
  return `(${a}${t.op}${b})`;
}
function uLoose(v, t) {
  const o = [{ v, t }];
  if (t.k !== 'abs' && v.n < 0) o.push({ v: F(-v.n, v.d), t: { k: 'abs', a: t } });
  if (t.k !== 'rec' && v.n !== 0 && !(Math.abs(v.n) === 1 && v.d === 1))
    o.push({ v: F(v.d, v.n), t: { k: 'rec', a: t } });
  return o;
}
function uStrict(v, t) {
  const o = [{ v, t }];
  if (hasUnary(t)) return o;
  if (v.n < 0) o.push({ v: F(-v.n, v.d), t: { k: 'abs', a: t } });
  if (v.n !== 0 && !(Math.abs(v.n) === 1 && v.d === 1)) o.push({ v: F(v.d, v.n), t: { k: 'rec', a: t } });
  return o;
}
function allSols(nums, uv) {
  const m = new Map();
  (function dfs(items) {
    if (items.length === 1) { for (const c of uv(items[0].v, items[0].t)) if (is24(c.v)) m.set(ckey(c.t), c.t); return; }
    const n = items.length;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      if (i === j) continue;
      const rest = items.filter((_, k) => k !== i && k !== j);
      for (const a of uv(items[i].v, items[i].t)) for (const b of uv(items[j].v, items[j].t))
        for (const [op, fn] of BIN) { const v = fn(a.v, b.v); if (!v) continue; dfs([{ v, t: { k: 'bin', op, a: a.t, b: b.t } }, ...rest]); }
    }
  })(nums.map((x) => ({ v: F(x), t: { k: 'num', val: x } })));
  return [...m.values()];
}
// ── 判据1：Developer/Manager 的「不可约简」（2^N 枚举）
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
  if (N === 0) return false;
  for (let m = 1; m < (1 << N); m++) {
    const v = evalT(stripSubset(t, ps.filter((_, i) => m & (1 << i))));
    if (v && is24(v)) return false;
  }
  return true;
}
// ── 判据2：★ Architect 的「解法骨架」（O(n) 单次遍历）
// 删掉所有单目节点 → 纯二元骨架 → 结构规范化。同骨架 = 同一解法（外衣不同）
function skeleton(t) {
  if (t.k === 'num') return { k: 'num', val: t.val };
  if (t.k === 'abs' || t.k === 'rec') return skeleton(t.a);
  return { k: 'bin', op: t.op, a: skeleton(t.a), b: skeleton(t.b) };
}
const skey = (t) => ckey(skeleton(t));
const loadavg = () => { try { return readFileSync('/proc/loadavg', 'utf8').trim().split(' ').slice(0, 3).join('/'); } catch { return os.loadavg().map(x => x.toFixed(2)).join('/'); } };

console.log('=== 四方案面板条数量化对比（供项目主一次看清可选项）===');
console.log(`环境: Node ${process.version}, ${os.cpus().length} 核, loadavg ${loadavg()}, ${new Date().toISOString()}`);
console.log('全程口径B(self_only) 全量枚举，四种面板过滤策略对比\n');
console.log('方案A = 口径A(subtree_block)          ← 已否决（116 组误判无解）');
console.log('方案B = 口径B 全保留                   ← Manager 称"面板 4000+ 条"');
console.log('方案C = 口径B + 不可约简过滤(2^N)      ← Manager + Developer 共同推荐');
console.log('方案D = 口径B + 解法骨架去重(O(n))     ← ★ Architect 提议，本轮量化\n');

const DECKS = [[1, 3, 4, 6], [1, 4, 6, 8], [12, 6, 1, 8], [1, 2, 3, 4], [2, 3, 4, 6], [1, 8, 12, 13]];
console.log('deck\t\t方案A\t方案B\t方案C\t★方案D\tD/A比\tC成本ms\tD成本ms');
const detail = {};
for (const deck of DECKS) {
  const B = allSols(deck, uLoose), A = allSols(deck, uStrict);
  const t1 = performance.now();
  const C = B.filter((t) => !hasUnary(t) || irreducible(t));
  const cC = performance.now() - t1;
  const t2 = performance.now();
  const dset = new Map();
  for (const t of B) { const k = skey(t); if (!dset.has(k)) dset.set(k, t); }
  const cD = performance.now() - t2;
  detail[deck.join(',')] = { A, B, C, D: [...dset.values()] };
  console.log(`[${deck}]\t${A.length}\t${B.length}\t${C.length}\t${dset.size}\t${(dset.size / (A.length || 1)).toFixed(1)}x\t${cC.toFixed(1)}\t${cD.toFixed(1)}`);
}

console.log('\n--- 方案D 保留的解样例（验证是否覆盖各解法类别）---');
for (const deck of [[1, 3, 4, 6], [1, 8, 12, 13]]) {
  const d = detail[deck.join(',')];
  const D = d.D.slice().sort((a, b) => show(a).length - show(b).length);
  console.log(`[${deck}] 方案D 保留 ${D.length} 条，最短 8 条：`);
  for (const t of D.slice(0, 8)) {
    const v = evalT(t);
    console.log(`   ${show(t)} = ${v.n / v.d}  ${hasRec(t) ? '[含1/x]' : ''}${hasAbs(t) ? '[含|x|]' : ''}${!hasUnary(t) ? '[纯初级]' : ''}`);
  }
}

console.log('\n--- ★ 关键：方案D 是否保住了口径A 会删掉的调和形式解？---');
function isHarmonic(t) {
  if (t.k !== 'rec') return false;
  const i = t.a;
  if (i.k !== 'bin' || !['+', '-'].includes(i.op)) return false;
  const rl = (x) => x.k === 'rec' || (x.k === 'bin' && x.op === '/');
  return rl(i.a) && rl(i.b);
}
console.log('deck\t\t方案A调和\t方案B调和\t方案C调和\t★方案D调和');
for (const deck of DECKS) {
  const d = detail[deck.join(',')];
  console.log(`[${deck}]\t${d.A.filter(isHarmonic).length}\t\t${d.B.filter(isHarmonic).length}\t\t${d.C.filter(isHarmonic).length}\t\t${d.D.filter(isHarmonic).length}`);
}

console.log('\n--- 方案D 三桶供给（面板 {纯初级,含1/x,含|x|} 是否都非空）---');
console.log('deck\t\t纯初级\t含1/x\t含|x|\t三桶齐?');
for (const deck of DECKS) {
  const D = detail[deck.join(',')].D;
  const p = D.filter((t) => !hasUnary(t)).length;
  const r = D.filter((t) => hasRec(t) && !hasAbs(t)).length;
  const b = D.filter((t) => hasAbs(t)).length;
  console.log(`[${deck}]\t${p}\t${r}\t${b}\t${p && r && b ? '✅' : (p || r || b) ? '部分' : '❌'}`);
}

console.log('\n--- 方案D 骨架去重的正确性检查：同骨架解是否真的"同一解法" ---');
{
  const d = detail['1,3,4,6'];
  const groups = new Map();
  for (const t of d.B) { const k = skey(t); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(t); }
  const big = [...groups.entries()].sort((a, b) => b[1].length - a[1].length)[0];
  console.log(`[1,3,4,6] 最大骨架组: 骨架=${big[0]}  含 ${big[1].length} 条解，代表 1 条上面板`);
  console.log('   该组前 6 条（应为同一解法的不同外衣）：');
  for (const t of big[1].slice(0, 6)) console.log(`      ${show(t)}`);
}
console.log('\n=== 结论 ===');
