// tools/verify/measure-input08-scale.mjs — §5.1/§5.3/§5.4 实测填充（双平台各跑一次）
// 🔴 禁用 size 求和作为唯一判据（后缀扩位是双射改名）；此处 size 仅作规模描述，
//    零误伤判定一律走 z1-baseline 的 digest + 等价类计数。
import * as RS from '../../js/core/RecipSolver.mjs';

const decks = [];
for (let a = 0; a <= 13; a++) for (let b = a; b <= 13; b++) for (let c = b; c <= 13; c++) for (let d = c; d <= 13; d++) decks.push([a, b, c, d]);
if (decks.length !== 2380) { console.error(`🔴 牌组基数错：${decks.length}`); process.exit(2); }

const run = (label, caps) => {
  const t0 = Date.now();
  let solvableDeckHitCount = 0, advKeyHitCount = 0, primKeyHitCount = 0;
  let powKeyHitCount = 0, logKeyHitCount = 0;
  const perDeckMs = [];
  for (const deck of decks) {
    const t1 = Date.now();
    const r = RS.solve(deck, { advancedCalc: true, caps });
    perDeckMs.push(Date.now() - t1);
    if (r.primary.size + r.advanced.size > 0) solvableDeckHitCount++;
    primKeyHitCount += r.primary.size;
    for (const k of r.advanced.keys()) {
      advKeyHitCount++;
      const m = k.match(/\|R[01]F[01]M[01]P([01])L([01])$/);
      if (m) { if (m[1] === '1') powKeyHitCount++; if (m[2] === '1') logKeyHitCount++; }
    }
  }
  perDeckMs.sort((x, y) => x - y);
  const total = ((Date.now() - t0) / 1000).toFixed(1);
  const p95 = perDeckMs[Math.floor(perDeckMs.length * 0.95)];
  console.log(`\n【${label}】`);
  console.log(`  solvableDeckHitCount = ${solvableDeckHitCount}〔命中牌组数〕`);
  console.log(`  primaryKeyHitCount   = ${primKeyHitCount}〔命中键数〕`);
  console.log(`  advancedKeyHitCount  = ${advKeyHitCount}〔命中键数〕`);
  console.log(`  powKeyHitCount = ${powKeyHitCount}   logKeyHitCount = ${logKeyHitCount}`);
  console.log(`  总耗时 ${total}s   p95/组 ${p95}ms   max/组 ${perDeckMs[perDeckMs.length - 1]}ms`);
  return { solvableDeckHitCount, advKeyHitCount, total: Number(total) };
};

console.log(`=== INPUT-08 §5 规模实测（Node ${process.versions.node}）===`);
const base = run('A. INPUT-07 基线态（recip+fact+mod，pow/log 关）', { recip: true, fact: true, mod: true });
const powOnly = run('B. 仅幂（含开方别名）', { recip: false, fact: false, mod: false, pow: true });
const logOnly = run('C. 仅对数', { recip: false, fact: false, mod: false, log: true });
const all = run('D. 五项全开', { recip: true, fact: true, mod: true, pow: true, log: true });

console.log('\n=== §5.1 规模倍率（架构师只给量级 3-9×，此处为实测）===');
console.log(`  全开 advancedKeyHitCount / 基线 = ${all.advKeyHitCount} / ${base.advKeyHitCount} = ${(all.advKeyHitCount / base.advKeyHitCount).toFixed(2)}×`);
console.log(`  全开耗时 / 基线耗时 = ${all.total}s / ${base.total}s = ${(all.total / Math.max(base.total, 0.1)).toFixed(2)}×`);
console.log('\n=== §5.4 可解牌组数变化 ===');
console.log(`  INPUT-07 基线态 = ${base.solvableDeckHitCount}（对照 INPUT-08 §5.4 所载 2109）`);
console.log(`  五项全开       = ${all.solvableDeckHitCount}`);
console.log(`  净增           = ${all.solvableDeckHitCount - base.solvableDeckHitCount} 组`);
