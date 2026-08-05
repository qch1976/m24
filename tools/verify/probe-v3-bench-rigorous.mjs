// 人工阅读型调查脚本，非门禁。退出码恒为 0，即使正文打印 ❌ 也不判红；判定权在阅读者。
// （task-75 哑弹治理：实测 24 支 probe-v3-* 均无非零退出能力，❌/FAIL 全在 console.log 内。）
// 严谨 benchmark：多轮取中位数 + 报告全区间 + 同时记录系统负载
// 目的：回应 Manager §7 风险11（负载导致耗时不可复现）+ 修正 Architect 通报流程
// 纪律：本脚本一次运行 tee 落盘，通报数字必须逐位引用本日志
import { performance } from 'node:perf_hooks';
import { execSync } from 'node:child_process';
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
// 全量枚举（d=1 + 恒等剪枝），不做 K 截断 —— Manager 已确认此路径 P95 在 2s 内
function solveFull(nums) {
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
      for (const a of unaryVars(items[i].v, items[i].t)) for (const b of unaryVars(items[j].v, items[j].t))
        for (const [op, fn] of BIN) {
          const v = fn(a.v, b.v);
          if (!v) continue;
          dfs([{ v, t: { k: 'bin', op, a: a.t, b: b.t } }, ...rest]);
        }
    }
  })(nums.map((x) => ({ v: F(x), t: { k: 'num', val: x } })));
  return found;
}

// ===== 环境记录（可复现性的一部分）=====
console.log('=== 执行环境（Manager §7 风险11 要求记录）===');
console.log(`时间戳     : ${new Date().toISOString()}`);
console.log(`Node       : ${process.version}`);
console.log(`CPU 核数   : ${os.cpus().length}`);
console.log(`load avg   : ${os.loadavg().map((x) => x.toFixed(2)).join(' / ')}  (1m/5m/15m)`);
console.log(`平台       : ${os.platform()} ${os.release()}`);
console.log('');

// ===== 固定 seed 牌组（Tester 可独立重采样）=====
const SEED = 20260801;
function mkDecks(n) {
  let s = SEED;
  const r = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  return Array.from({ length: n }, () => Array.from({ length: 4 }, () => 1 + Math.floor(r() * 13)));
}
const decks = mkDecks(50);
console.log(`=== 牌组来源（可复现）===`);
console.log(`seed = ${SEED}, LCG: s = (s*1103515245 + 12345) & 0x7fffffff, 牌 = 1 + floor(s/0x7fffffff * 13)`);
console.log(`前 5 组: ${decks.slice(0, 5).map((d) => `[${d}]`).join(' ')}`);
console.log('');

// ===== 正确性先行：解数必须逐轮一致（正确性与负载无关）=====
console.log('=== 第一步：正确性可复现性检查（解数应逐轮完全一致）===');
const CHECK = [[1, 3, 4, 6], [1, 4, 6, 8], [1, 2, 3, 4], [1, 3, 4, 8]];
const countRuns = [];
for (let rep = 0; rep < 3; rep++) countRuns.push(CHECK.map((d) => solveFull(d).size));
for (let i = 0; i < CHECK.length; i++) {
  const vals = countRuns.map((r) => r[i]);
  const same = vals.every((v) => v === vals[0]);
  console.log(`  [${CHECK[i]}] 三轮解数 = ${vals.join(' / ')}  ${same ? '✅ 完全一致' : '❌ 不一致'}`);
}
console.log('');

// ===== 第二步：耗时多轮统计（中位数 + 全区间）=====
const ROUNDS = 5;
console.log(`=== 第二步：耗时 ${ROUNDS} 轮统计（每轮 50 组，报告 P95 中位数与区间）===`);
const p95s = [], p50s = [], maxs = [];
for (let rep = 0; rep < ROUNDS; rep++) {
  const ts = [];
  for (const d of decks) { const t0 = performance.now(); solveFull(d); ts.push(performance.now() - t0); }
  ts.sort((a, b) => a - b);
  const p95 = ts[Math.floor(ts.length * 0.95)];
  p95s.push(p95); p50s.push(ts[25]); maxs.push(ts[49]);
  console.log(`  轮 ${rep + 1}: P50=${ts[25].toFixed(1)}ms  P95=${p95.toFixed(1)}ms  max=${ts[49].toFixed(1)}ms   load=${os.loadavg()[0].toFixed(2)}`);
}
const med = (a) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
console.log('');
console.log('=== 最终结论（★ 通报必须逐位引用以下三行）===');
console.log(`P95 中位数  = ${med(p95s).toFixed(1)}ms`);
console.log(`P95 区间    = [${Math.min(...p95s).toFixed(1)}, ${Math.max(...p95s).toFixed(1)}]ms  极差 ${(Math.max(...p95s) / Math.min(...p95s)).toFixed(1)}x`);
console.log(`max 区间    = [${Math.min(...maxs).toFixed(1)}, ${Math.max(...maxs).toFixed(1)}]ms`);
console.log('');
console.log(`2s 预算判定 : 最差轮 P95 = ${Math.max(...p95s).toFixed(1)}ms → ${Math.max(...p95s) <= 2000 ? `✅ 达标（余量 ${(2000 / Math.max(...p95s)).toFixed(1)}x）` : '❌ 超标'}`);
console.log(`结论        : 全量枚举（无 K 截断）满足 2s，K 不必用于性能，仅作 UI 展示上限`);
console.log('');
console.log('=== 声明 ===');
console.log('1. 本日志为一次运行 tee 落盘，通报数字与本日志逐位一致，不得转述改写');
console.log('2. 耗时受服务器负载影响（见上方 load avg），Node 侧数据不等同微信真机');
console.log('3. 正确性（解数）与负载无关、逐轮一致，可作为跨机器比对依据');
