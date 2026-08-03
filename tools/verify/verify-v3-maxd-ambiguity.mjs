// 证明：Manager §7 风险10「maxD=1 + 恒等剪枝」的表述无法消除歧义
// 「每节点至多施加 1 次单目」这句话，对以下两种截然不同的解集都成立：
//   口径A：每条【根→叶路径】至多 1 个单目（子树含单目 → 祖先不再施）
//   口径B：仅禁【自身直接叠加】（abs(rec(x)) 禁），同一路径上可有多个单目
// 两者都满足「每节点至多 1 次」，但解集差 5~17 倍。
// 本脚本对每条解统计「单条根→叶路径上的最大单目数」，直观展示二者边界。
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
// 单条根→叶路径上的最大单目数
function maxPathUnary(t) {
  if (t.k === 'num') return 0;
  if (t.k === 'abs' || t.k === 'rec') return 1 + maxPathUnary(t.a);
  return Math.max(maxPathUnary(t.a), maxPathUnary(t.b));
}
// 全树单目总数
const totalUnary = (t) => t.k === 'num' ? 0
  : (t.k === 'abs' || t.k === 'rec') ? 1 + totalUnary(t.a)
  : totalUnary(t.a) + totalUnary(t.b);
// 是否存在「单目直接叠加」（abs(rec(x)) / rec(abs(x)) / rec(rec(x))）
const hasStack = (t) => t.k === 'num' ? false
  : (t.k === 'abs' || t.k === 'rec') ? ((t.a.k === 'abs' || t.a.k === 'rec') ? true : hasStack(t.a))
  : hasStack(t.a) || hasStack(t.b);
function ckey(t) {
  if (t.k === 'num') return `n${t.val}`;
  if (t.k === 'abs') return `abs(${ckey(t.a)})`;
  if (t.k === 'rec') return `rec(${ckey(t.a)})`;
  const a = ckey(t.a), b = ckey(t.b);
  if (t.op === '+' || t.op === '*') return a <= b ? `(${a}${t.op}${b})` : `(${b}${t.op}${a})`;
  return `(${a}${t.op}${b})`;
}
function unaryVars(v, t, mode) {
  const o = [{ v, t }];
  if (mode === 'A' && hasUnary(t)) return o;
  if (mode === 'B' && (t.k === 'abs' || t.k === 'rec')) return o;
  if (v.n < 0) o.push({ v: F(-v.n, v.d), t: { k: 'abs', a: t } });
  if (v.n !== 0 && !(Math.abs(v.n) === 1 && v.d === 1)) o.push({ v: F(v.d, v.n), t: { k: 'rec', a: t } });
  return o;
}
function solveFull(nums, mode) {
  const found = new Map();
  (function dfs(items) {
    if (items.length === 1) {
      for (const c of unaryVars(items[0].v, items[0].t, mode)) if (is24(c.v)) found.set(ckey(c.t), c.t);
      return;
    }
    const n = items.length;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      if (i === j) continue;
      const rest = items.filter((_, k) => k !== i && k !== j);
      for (const a of unaryVars(items[i].v, items[i].t, mode))
        for (const b of unaryVars(items[j].v, items[j].t, mode))
          for (const [op, fn] of BIN) {
            const v = fn(a.v, b.v);
            if (!v) continue;
            dfs([{ v, t: { k: 'bin', op, a: a.t, b: b.t } }, ...rest]);
          }
    }
  })(nums.map((x) => ({ v: F(x), t: { k: 'num', val: x } })));
  return [...found.values()];
}

console.log('=== 证明 Manager §7 风险10「maxD=1 + 每节点至多1次」表述无法消除歧义 ===');
console.log(`环境: Node ${process.version}, ${os.cpus().length} 核, load ${os.loadavg()[0].toFixed(2)}, ${new Date().toISOString()}\n`);
console.log('关键：口径A 与口径B 都满足「每个节点至多施加 1 次单目」，但解集差 5~17 倍。');
console.log('区别在【祖先能否再施加】：A 禁（路径级至多1个），B 允许（仅禁直接叠加）。\n');

for (const deck of [[1, 3, 4, 6], [1, 4, 6, 8], [1, 2, 3, 4]]) {
  console.log(`--- deck=[${deck}] ---`);
  for (const mode of ['A', 'B']) {
    const t0 = performance.now();
    const s = solveFull(deck, mode);
    const ms = performance.now() - t0;
    // 分布：按「单条路径最大单目数」归类
    const dist = {};
    for (const t of s) { const k = maxPathUnary(t); dist[k] = (dist[k] || 0) + 1; }
    const stacked = s.filter(hasStack).length;
    const maxTot = Math.max(0, ...s.map(totalUnary));
    console.log(`  口径${mode}: ${s.length} 解 / ${ms.toFixed(0)}ms`);
    console.log(`    单条路径最大单目数分布: ${Object.entries(dist).map(([k, v]) => `${k}个=${v}解`).join('  ')}`);
    console.log(`    全树单目总数上限 = ${maxTot}   含直接叠加(abs(rec(x))等) = ${stacked} 解`);
  }
  // 展示只在口径B 出现的解（口径A 会砍掉的那类）
  const sa = new Set(solveFull(deck, 'A').map(ckey));
  const onlyB = solveFull(deck, 'B').filter((t) => !sa.has(ckey(t)));
  onlyB.sort((x, y) => maxPathUnary(y) - maxPathUnary(x));
  console.log(`  ★ 仅口径B 有、口径A 无的解共 ${onlyB.length} 条，样例（同一路径上多个单目）：`);
  for (const t of onlyB.slice(0, 3)) {
    const v = evalT(t);
    console.log(`      ${show(t)} = ${v.n / v.d} ${v.n / v.d === 24 ? '✅' : '❌'}  路径最大单目=${maxPathUnary(t)} 总单目=${totalUnary(t)}`);
  }
  console.log('');
}

console.log('=== 结论 ===');
console.log('1. 「每节点至多1次」两口径均满足 → 该表述不可判定，v3 必须改写为路径级或叠加级定义');
console.log('2. 建议 v3 写法（消歧义版）：');
console.log('   口径A（推荐）= 「从根到任一叶子的路径上，单目算子至多出现 1 个」');
console.log('   等价实现判据：若子树已含单目，则其任何祖先节点不再施加单目');
console.log('3. Manager §3「全量枚举 P95 最差 1113ms」是【口径B】数字；口径A 下 P95 仅 123.7ms（129 日志）');
console.log('   → K 与性能解耦的结论在两口径下均成立，Manager 撤回 K=3 建议是对的，但数字须标注口径');
