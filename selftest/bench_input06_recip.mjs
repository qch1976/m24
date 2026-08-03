// bench_input06_recip.mjs — R-05 前置门禁：JS 实测 benchmark（禁估算）
// 依据：INPUT-06.md §5 task-B 交付要求 2 + 方案 §7 风险 5
// 目标：证明「牌桌发牌后 solve() 全量枚举 ≤ 2s」在真机档位可达
import { solve } from '../js/core/RecipSolver.mjs';

const T = (fn) => { const t = process.hrtime.bigint(); const r = fn(); return { r, ms: Number(process.hrtime.bigint() - t) / 1e6 }; };

// ① 最坏用例：4 张牌全可倒数（无 0/1），点数大 → 叶子变体 2^4=16 套
const worstDecks = [
  [13, 13, 13, 13], [12, 13, 11, 13], [11, 12, 13, 10],
  [7, 8, 9, 13], [13, 11, 7, 9], [8, 8, 13, 13],
  [9, 9, 11, 11], [6, 7, 11, 13], [13, 12, 12, 11], [7, 7, 13, 13],
];
// ② 高解密度用例
const denseDecks = [[1, 2, 3, 4], [1, 1, 3, 8], [2, 3, 4, 6], [1, 2, 5, 10], [3, 4, 6, 8]];
// ③ 含 1 / 含 0（叶子变体少）
const lightDecks = [[1, 1, 1, 1], [0, 1, 2, 3], [1, 1, 2, 9], [0, 0, 12, 12]];

function stat(name, decks, warm) {
  const times = [];
  let maxIters = 0, totalRaw = 0;
  if (warm) for (const d of decks) solve(d);   // JIT warmup
  for (const d of decks) {
    const { r, ms } = T(() => solve(d));
    times.push({ d, ms, p: r.counts.primary, a: r.counts.advanced, c: r.counts.cancelled });
    if (r.maxIters > maxIters) maxIters = r.maxIters;
    totalRaw += r.rawHits;
  }
  times.sort((x, y) => x.ms - y.ms);
  const arr = times.map((t) => t.ms);
  const sum = arr.reduce((a, b) => a + b, 0);
  const pct = (q) => arr[Math.min(arr.length - 1, Math.floor(q * arr.length))];
  console.log(`\n[${name}] n=${decks.length} warm=${!!warm}`);
  console.log(`  min=${arr[0].toFixed(1)}ms  median=${pct(0.5).toFixed(1)}ms  p90=${pct(0.9).toFixed(1)}ms  max=${arr[arr.length - 1].toFixed(1)}ms  mean=${(sum / arr.length).toFixed(1)}ms`);
  console.log(`  maxReduceIters=${maxIters} (MAX_ITER=30)  totalRawHits=${totalRaw}`);
  const slowest = times[times.length - 1];
  console.log(`  slowest deck=${JSON.stringify(slowest.d)} ${slowest.ms.toFixed(1)}ms P=${slowest.p} A=${slowest.a} C=${slowest.c}`);
  return { max: arr[arr.length - 1], p90: pct(0.9), median: pct(0.5) };
}

console.log('='.repeat(64));
console.log('INPUT-06 R-05 benchmark — JS 实测（node ' + process.version + ')');
console.log('platform=' + process.platform + '/' + process.arch);
console.log('='.repeat(64));

const cold = stat('cold-start 最坏(全可倒数)', worstDecks, false);
const warm = stat('warm 最坏(全可倒数)', worstDecks, true);
const dense = stat('warm 高解密度', denseDecks, true);
const light = stat('warm 含0/1(轻量)', lightDecks, true);

// 全量 13^4 抽样：随机 200 副牌统计尾部
const rnd = [];
let seed = 20260803;
const nx = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed; };
for (let i = 0; i < 200; i++) rnd.push([1 + nx() % 13, 1 + nx() % 13, 1 + nx() % 13, 1 + nx() % 13]);
const r200 = stat('warm 随机 200 副(1..13)', rnd, true);

console.log('\n' + '='.repeat(64));
console.log('R-05 门禁判定（预算 2000ms）');
const WORST = Math.max(cold.max, warm.max, dense.max, light.max, r200.max);
console.log(`  实测全场景最大单副耗时 = ${WORST.toFixed(1)}ms`);
console.log(`  预算余量 = ${(2000 / WORST).toFixed(0)}x`);
// 真机降速系数：微信小游戏 JS 引擎（Android 中低端 V8/JSC）保守取 8~15x
for (const k of [5, 8, 10, 15, 20]) {
  const proj = WORST * k;
  console.log(`  真机降速 ${k}x 推算 = ${proj.toFixed(0)}ms  ${proj <= 2000 ? 'PASS' : 'FAIL'}`);
}
const SAFE_K = Math.floor(2000 / WORST);
console.log(`  可容忍最大降速系数 = ${SAFE_K}x`);
console.log(WORST * 15 <= 2000 ? '\nRESULT: PASS —— 15x 降速下仍 ≤2s，R-05 门禁满足' : '\nRESULT: FAIL —— 需优化');
console.log('='.repeat(64));
process.exit(WORST * 15 <= 2000 ? 0 : 1);
