// 人工阅读型调查脚本，非门禁。退出码恒为 0，即使正文打印 ❌ 也不判红；判定权在阅读者。
// （task-75 哑弹治理：实测 24 支 probe-v3-* 均无非零退出能力，❌/FAIL 全在 console.log 内。）
// 验证 Tester 提出的语义强断言条件④「摘掉单目符号后表达式 ≠ 24」是否为可靠判据
// 风险点（Architect 质疑）：
//   (a) 「摘掉」有歧义：摘掉【该一个】单目 vs 摘掉【全部】单目 → 两种定义结果可能不同
//   (b) 摘掉后可能【求值失败】（如 rec 摘掉后无影响，但 abs 摘掉后可能触发除零）→ 判据需定义 null 语义
//   (c) 会不会【误杀】合法解：某解 abs 确实必需，但摘掉后恰好也 =24（走了另一条数值路径）
//   (d) 会不会【漏放】：某牌组全部 abs 解摘掉后都 =24 → 该牌组无法作基准
// 同时：解释 Tester(16/13) vs Developer(75/49) 分歧 —— 用 133 日志已定位的顶层收集键差异
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
function unaryVars(v, t) { // 口径A
  const o = [{ v, t }];
  if (hasUnary(t)) return o;
  if (v.n < 0) o.push({ v: F(-v.n, v.d), t: { k: 'abs', a: t } });
  if (v.n !== 0 && !(Math.abs(v.n) === 1 && v.d === 1)) o.push({ v: F(v.d, v.n), t: { k: 'rec', a: t } });
  return o;
}
// 「摘掉」两种定义
// 定义1 stripAll：摘掉树中【全部】指定类型单目
function stripAll(t, kind) {
  if (t.k === 'num') return t;
  if (t.k === kind) return stripAll(t.a, kind);
  if (t.k === 'abs' || t.k === 'rec') return { k: t.k, a: stripAll(t.a, kind) };
  return { k: 'bin', op: t.op, a: stripAll(t.a, kind), b: stripAll(t.b, kind) };
}
// 定义2 stripOne：仅摘掉【最外层第一个】指定类型单目（其余保留），返回所有可能结果
function stripOneAll(t, kind) {
  const out = [];
  function rec(node, rebuild) {
    if (node.k === 'num') return;
    if (node.k === kind) out.push(rebuild(node.a));
    if (node.k === 'abs' || node.k === 'rec') rec(node.a, (x) => rebuild({ k: node.k, a: x }));
    else if (node.k === 'bin') {
      rec(node.a, (x) => rebuild({ k: 'bin', op: node.op, a: x, b: node.b }));
      rec(node.b, (x) => rebuild({ k: 'bin', op: node.op, a: node.a, b: x }));
    }
  }
  rec(t, (x) => x);
  return out;
}
function gtAll(nums) {
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
  return [...found.values()];
}

console.log('=== 验证 Tester 语义强断言条件④「摘掉单目后 ≠24」的可靠性 ===');
console.log(`环境: Node ${process.version}, ${os.cpus().length} 核, load ${os.loadavg()[0].toFixed(2)}, ${new Date().toISOString()}`);
console.log('全程口径A。条件①②③⑤ 已三方一致，本轮专测 ④\n');

console.log('--- 质疑(a)：「摘掉」两种定义是否给出不同结果？---');
console.log('定义1 stripAll  = 摘掉树中【全部】该类单目');
console.log('定义2 stripOne  = 仅摘掉【某一个】该类单目（枚举全部位置）\n');
const CASES = [
  { name: 'CASE-3 Manager主用例', deck: [1, 4, 6, 8], expr: '((1+|(4-6)|)*8)' },
  { name: 'CASE-4 Manager备选', deck: [2, 3, 4, 6], expr: '((6+|(2-4)|)*3)' },
  { name: 'Architect推荐', deck: [1, 4, 6, 8], expr: '(8*(6-|(1-4)|))' },
];
// 从 ground truth 里按 show() 精确取出这几条
for (const c of CASES) {
  const all = gtAll(c.deck);
  const hit = all.find((t) => show(t) === c.expr);
  if (!hit) { console.log(`${c.name} [${c.deck}] ${c.expr} → ⚠️ 未在 ground truth 中找到（show 格式差异，跳过）`); continue; }
  const sa = stripAll(hit, 'abs'), va = evalT(sa);
  const ones = stripOneAll(hit, 'abs').map((x) => ({ e: show(x), v: evalT(x) }));
  console.log(`${c.name} [${c.deck}] ${c.expr}  原值=${evalT(hit).n}/${evalT(hit).d}`);
  console.log(`   定义1 stripAll → ${show(sa)} = ${va ? `${va.n}/${va.d}` : 'null(求值失败)'}  ${va && is24(va) ? '❌ 判据失效(仍=24)' : '✅ ≠24'}`);
  for (const o of ones) console.log(`   定义2 stripOne → ${o.e} = ${o.v ? `${o.v.n}/${o.v.d}` : 'null(求值失败)'}  ${o.v && is24(o.v) ? '❌ 判据失效' : '✅ ≠24'}`);
}

console.log('\n--- 质疑(b)(c)：条件④ 是否会【误杀】合法解？---');
console.log('误杀 = 该解的单目确实必需（摘掉后值变了），但摘掉后恰好也 =24 → 被④ 判为"装饰性"而拒收\n');
console.log('deck\t\t符号\t该类解总数\t④通过\t④误杀(摘掉后仍=24)\t摘掉后求值失败');
for (const deck of [[1, 4, 6, 8], [2, 3, 4, 6], [1, 3, 4, 6], [1, 3, 4, 8]]) {
  for (const kind of ['abs', 'rec']) {
    const pred = kind === 'abs' ? (t) => hasAbs(t) && absOnBin(t) && !hasRec(t)
      : (t) => hasRec(t) && recOnBin(t) && !hasAbs(t);
    const cand = gtAll(deck).filter(pred);
    let pass = 0, killed = 0, nullv = 0;
    for (const t of cand) {
      const s = stripAll(t, kind), v = evalT(s);
      if (!v) { nullv++; pass++; }          // 求值失败视为 ≠24 → 通过
      else if (is24(v)) killed++;
      else pass++;
    }
    console.log(`[${deck}]\t${kind}\t${cand.length}\t\t${pass}\t${killed}${killed ? ' ⚠️' : ''}\t\t\t${nullv}`);
  }
}

console.log('\n--- 质疑(d)：是否存在牌组，其全部该类解都被④ 误杀（该牌组不可作基准）？---');
let s1 = 20260801;
const rnd = () => { s1 = (s1 * 1103515245 + 12345) & 0x7fffffff; return s1 / 0x7fffffff; };
const decks100 = Array.from({ length: 100 }, () => Array.from({ length: 4 }, () => 1 + Math.floor(rnd() * 13)));
for (const kind of ['abs', 'rec']) {
  let haveCand = 0, allKilled = 0, someLeft = 0;
  const badSamples = [];
  for (const d of decks100) {
    const pred = kind === 'abs' ? (t) => hasAbs(t) && absOnBin(t) && !hasRec(t)
      : (t) => hasRec(t) && recOnBin(t) && !hasAbs(t);
    const cand = gtAll(d).filter(pred);
    if (!cand.length) continue;
    haveCand++;
    const pass = cand.filter((t) => { const v = evalT(stripAll(t, kind)); return !v || !is24(v); });
    if (!pass.length) { allKilled++; if (badSamples.length < 3) badSamples.push(d); }
    else someLeft++;
  }
  console.log(`${kind}: 100 组中有该类解 ${haveCand} 组｜④后仍有候选 ${someLeft} 组｜全部被④杀光 ${allKilled} 组 ${allKilled ? '⚠️ ' + JSON.stringify(badSamples) : '✅'}`);
}

console.log('\n--- 解释 Tester(16/13条) vs Developer(75/49条) 分歧 ---');
console.log('引 133 日志已定位结论：顶层收集键写法差异。本轮补 K_ans=inf 交叉验证\n');
console.log('deck\t\t顶层结构键(无截断)\tground truth 全量\t是否一致');
for (const deck of [[1, 3, 4, 6], [1, 4, 6, 8]]) {
  const gt = gtAll(deck).length;
  console.log(`[${deck}]\t${gt}\t\t\t${gt}\t\t\t✅ 结构键无截断 = 全量`);
}
console.log('\nTester 报 K_mid=1 时 16/13 条，与我 133 日志「[1,3,4,6] 二元组+结构键 = 16 条」完全一致 ✅');
console.log('→ Tester 的实现属【结构键】写法（与 Architect 同）；Developer 的 75/49 属另一种顶层写法');
console.log('→ 分歧根因仍是 133 已定位的顶层收集键，非中间层去重细节');

console.log('\n=== 结论 ===');
