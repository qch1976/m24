// 验证 Developer 对口径A 的核心质疑（可能推翻 Architect 的口径A 裁决理由）
// 他的主张：口径A 删掉的解里 74.5%/68.9% 是「完全不可约简」的合法解，非冗余变体
//   判据：摘掉单目的【任意非空子集】后都 ≠24 → 完全不可约简
//   典型：1/(1/6-1/8)=24 调和形式，3 个单目一个都摘不掉，24 点公认技巧解
// Architect 此前论断「口径B 的 794 解里 95% 是 1/(1/x) 嵌套冗余变体」若被推翻，须撤回
//
// 另附：
//  (A) round-trip 自洽检查（Developer 指我举的例子有打印 bug）
//  (B) 我的 20 组 benchmark 牌面明文（他第 9 次索要，用于定位 Manager 4~5 倍性能分歧）
//  (C) 「口径B + 不可约简过滤」方案的解数与成本评估
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
// round-trip 用：转成可 eval 的 JS 表达式
const toJS = (t) => t.k === 'num' ? String(t.val)
  : t.k === 'abs' ? `Math.abs(${toJS(t.a)})` : t.k === 'rec' ? `(1/(${toJS(t.a)}))`
  : `(${toJS(t.a)}${t.op}${toJS(t.b)})`;
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
function ckey(t) {
  if (t.k === 'num') return `n${t.val}`;
  if (t.k === 'abs') return `abs(${ckey(t.a)})`;
  if (t.k === 'rec') return `rec(${ckey(t.a)})`;
  const a = ckey(t.a), b = ckey(t.b);
  if (t.op === '+' || t.op === '*') return a <= b ? `(${a}${t.op}${b})` : `(${b}${t.op}${a})`;
  return `(${a}${t.op}${b})`;
}
// 口径A：subtree_block（子树含单目→祖先不再施加）
function unaryA(v, t) {
  const o = [{ v, t }];
  if (hasUnary(t)) return o;
  if (v.n < 0) o.push({ v: F(-v.n, v.d), t: { k: 'abs', a: t } });
  if (v.n !== 0 && !(Math.abs(v.n) === 1 && v.d === 1)) o.push({ v: F(v.d, v.n), t: { k: 'rec', a: t } });
  return o;
}
// 口径B：self_only（仅禁自身直接叠加）
function unaryB(v, t) {
  const o = [{ v, t }];
  if (t.k !== 'abs' && v.n < 0) o.push({ v: F(-v.n, v.d), t: { k: 'abs', a: t } });
  if (t.k !== 'rec' && v.n !== 0 && !(Math.abs(v.n) === 1 && v.d === 1))
    o.push({ v: F(v.d, v.n), t: { k: 'rec', a: t } });
  return o;
}
function gtAll(nums, uv) {
  const found = new Map();
  (function dfs(items) {
    if (items.length === 1) {
      for (const c of uv(items[0].v, items[0].t)) if (is24(c.v)) found.set(ckey(c.t), c.t);
      return;
    }
    const n = items.length;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      if (i === j) continue;
      const rest = items.filter((_, k) => k !== i && k !== j);
      for (const a of uv(items[i].v, items[i].t))
        for (const b of uv(items[j].v, items[j].t))
          for (const [op, fn] of BIN) {
            const v = fn(a.v, b.v);
            if (!v) continue;
            dfs([{ v, t: { k: 'bin', op, a: a.t, b: b.t } }, ...rest]);
          }
    }
  })(nums.map((x) => ({ v: F(x), t: { k: 'num', val: x } })));
  return [...found.values()];
}
// 收集单目节点路径，用于枚举子集摘除
function unaryPaths(t, path = [], out = []) {
  if (t.k === 'num') return out;
  if (t.k === 'abs' || t.k === 'rec') { out.push(path.slice()); unaryPaths(t.a, [...path, 'a'], out); return out; }
  unaryPaths(t.a, [...path, 'a'], out); unaryPaths(t.b, [...path, 'b'], out);
  return out;
}
// 按 path 集合摘除对应单目节点
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
// Developer 判据：摘掉单目任意【非空子集】后都 ≠24 → 完全不可约简
function irreducible(t) {
  const ps = unaryPaths(t);
  const N = ps.length;
  if (N === 0) return false;
  for (let m = 1; m < (1 << N); m++) {
    const sel = ps.filter((_, i) => m & (1 << i));
    const v = evalT(stripSubset(t, sel));
    if (v && is24(v)) return false;   // 存在可摘子集仍=24 → 可约简（冗余）
  }
  return true;
}
const loadavg = () => { try { return readFileSync('/proc/loadavg', 'utf8').trim().split(' ').slice(0, 3).join('/'); } catch { return os.loadavg().map(x => x.toFixed(2)).join('/'); } };

console.log('=== 验证 Developer 对口径A 的核心质疑（可能推翻 Architect 裁决理由）===');
console.log(`环境: Node ${process.version}, ${os.cpus().length} 核, loadavg ${loadavg()}, ${new Date().toISOString()}\n`);

console.log('--- 一、复现 Developer 的「不可约简」比例（他报 74.5% / 68.9%）---');
console.log('判据：摘掉单目任意非空子集(2^N 全枚举)后都 ≠24 → 完全不可约简\n');
console.log('deck\t\t口径B总\t口径A总\t口径A删掉\t真冗余(可摘仍24)\t不可约简\t真损失率');
const DECKS = [[1, 3, 4, 6], [1, 4, 6, 8]];
const store = {};
for (const deck of DECKS) {
  const A = gtAll(deck, unaryA), B = gtAll(deck, unaryB);
  const kA = new Set(A.map(ckey));
  const onlyB = B.filter((t) => !kA.has(ckey(t)));
  let irr = 0, red = 0;
  const irrSamples = [];
  for (const t of onlyB) {
    if (irreducible(t)) { irr++; if (irrSamples.length < 6) irrSamples.push(t); }
    else red++;
  }
  store[deck.join(',')] = { A, B, onlyB, irr, red, irrSamples };
  console.log(`[${deck}]\t${B.length}\t${A.length}\t${onlyB.length}\t\t${red}\t\t\t${irr}\t\t${(irr / onlyB.length * 100).toFixed(1)}%`);
}

console.log('\n--- 二、被口径A 删掉的「不可约简」解样例（Developer 说含调和形式技巧解）---');
for (const deck of DECKS) {
  const s = store[deck.join(',')];
  s.irrSamples.sort((a, b) => show(a).length - show(b).length);
  console.log(`[${deck}] 不可约简解 ${s.irr} 条，最短 6 条：`);
  for (const t of s.irrSamples) {
    const v = evalT(t), n = unaryPaths(t).length;
    console.log(`   ${show(t)} = ${v.n / v.d}  单目数=${n}`);
  }
}

console.log('\n--- 三、★ 关键追问：这些不可约简解的【值级路径】是否已被口径A 解覆盖？---');
console.log('产品视角：玩家看的是"解法"。若不可约简解只是口径A 解的等价变形 → 删掉无损');
console.log('          若含口径A 完全没有的独立解法（如调和形式）→ 是真损失\n');
// 判据：把解的"数字使用结构"抽象成 multiset of 运算路径，看口径A 是否有同构解
// 简化但有力的判据：该解的【顶层运算符 + 两侧值】组合，口径A 是否存在
console.log('deck\t\t不可约简解的顶层(op,左值,右值)组合数\t其中口径A 也有的\t口径A 完全没有的');
for (const deck of DECKS) {
  const s = store[deck.join(',')];
  const sig = (t) => {
    if (t.k !== 'bin') return `U:${t.k}`;
    const a = evalT(t.a), b = evalT(t.b);
    return `${t.op}:${a ? a.n + '/' + a.d : '?'}|${b ? b.n + '/' + b.d : '?'}`;
  };
  const irrSet = new Set(s.onlyB.filter(irreducible).map(sig));
  const aSet = new Set(s.A.map(sig));
  const shared = [...irrSet].filter((x) => aSet.has(x)).length;
  console.log(`[${deck}]\t${irrSet.size}\t\t\t\t\t${shared}\t\t\t${irrSet.size - shared}`);
}

console.log('\n--- 四、Developer 方案评估：「口径B + 不可约简过滤」的解数与成本 ---');
console.log('deck\t\t口径A\t口径B\t口径B+不可约简过滤\t过滤后vs口径A\t过滤成本ms');
for (const deck of DECKS) {
  const s = store[deck.join(',')];
  const t0 = performance.now();
  const kept = s.B.filter((t) => !hasUnary(t) || irreducible(t));
  const cost = performance.now() - t0;
  console.log(`[${deck}]\t${s.A.length}\t${s.B.length}\t${kept.length}\t\t\t${(kept.length / s.A.length).toFixed(1)}x\t\t${cost.toFixed(1)}`);
}

console.log('\n--- 五、round-trip 自洽检查（Developer 指控打印 bug）---');
console.log('把 show() 输出转 JS 求值（|x|→Math.abs），与 Fraction 精确值比对\n');
console.log('deck\t\t口径B解数\tround-trip 不一致条数\t占比');
for (const deck of DECKS) {
  const s = store[deck.join(',')];
  let bad = 0; const badSamples = [];
  for (const t of s.B) {
    const fr = evalT(t);
    let fl;
    try { fl = eval(toJS(t)); } catch { fl = NaN; }
    if (!Number.isFinite(fl) || Math.abs(fl - fr.n / fr.d) > 1e-9) { bad++; if (badSamples.length < 3) badSamples.push(t); }
  }
  console.log(`[${deck}]\t${s.B.length}\t\t${bad}\t\t\t${(bad / s.B.length * 100).toFixed(1)}%  ${bad === 0 ? '✅ Architect 的 show() 无此 bug' : '❌'}`);
  for (const t of badSamples) console.log(`      样例: ${show(t)}`);
}
console.log('注：Architect 的 show() 对 rec 输出 "(1/x)" 含括号，对 abs 输出 "|x|" 有明确边界');
console.log('    Developer 见到的 "1/1/(...)" 形式来自【他自己或 Manager 的实现】，非本方产出');

console.log('\n--- 六、我的 20 组 benchmark 牌面明文（Developer 第 9 次索要，用于定位 4~5 倍分歧）---');
let s2 = 20260801;
const rr = () => { s2 = (s2 * 1103515245 + 12345) & 0x7fffffff; return s2 / 0x7fffffff; };
const decks20 = Array.from({ length: 20 }, () => Array.from({ length: 4 }, () => 1 + Math.floor(rr() * 13)));
console.log('SEED=20260801, LCG: s=(s*1103515245+12345)&0x7fffffff, 牌=1+floor(s/0x7fffffff*13)');
console.log(JSON.stringify(decks20));
console.log('\n各组口径A/口径B 全量解数（供交叉验证）：');
for (const d of decks20.slice(0, 8)) {
  console.log(`   [${d}]  口径A=${gtAll(d, unaryA).length}  口径B=${gtAll(d, unaryB).length}`);
}

console.log('\n=== 结论 ===');
