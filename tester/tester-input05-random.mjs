// tester-input05-random.mjs
// Tester 独立复核 R-03: dealMode='random' 分布 + 无解率
// 立场: Tester 独立采样，独立分析
// 目标:
//   1) 200+ 次 generate('random') 有解/无解都出现
//   2) 10000+ 次分布检验: 54 张牌频次 mean≈740.7 (10000*4/54)，用 chi-square 判定 uniform
//   3) 无解率 25% ± 5% (说明: 106-INPUT05 §1.3 Architect 预估 25~35%，本 Tester 采用 20~30% 稍宽区间校验)
//   4) 静态代码扫描: generateRandom 不含 retry 循环 (无重摇痕迹)

import { generate } from '../js/core/DealGenerator.mjs';
import Solver from '../js/core/Solver.mjs';
import fs from 'fs';

const rng = Math;

// ============================
// Part 1: 200 次有解/无解都出现
// ============================
const N1 = 500;  // 加严到 500 次
let solved200 = 0, unsolved200 = 0;
for (let i = 1; i <= N1; i++) {
  const cards = generate('random');
  const values = cards.map(c => c.value);
  const has = Solver.isSolvable(values, 24);
  if (has) solved200++; else unsolved200++;
}
const rate200 = (unsolved200 / N1 * 100);
console.log(`[Part-1] ${N1} 次 random 采样: solved=${solved200} unsolved=${unsolved200}`);
console.log(`  无解率 = ${rate200.toFixed(2)}%`);
const part1_pass_has_both = (solved200 >= 1 && unsolved200 >= 1);
const part1_pass_rate_20_30 = (rate200 >= 20 && rate200 <= 30);
console.log(`  Part-1 有解+无解都出现: ${part1_pass_has_both ? '✓' : '✗'}`);
console.log(`  Part-1 无解率 20%~30% (25%±5%): ${part1_pass_rate_20_30 ? '✓' : '✗'}`);

// ============================
// Part 2: 10000 次分布
// ============================
const N2 = 10000;
const freq = new Map();
for (let i = 1; i <= N2; i++) {
  const cards = generate('random');
  for (const c of cards) {
    freq.set(c.id, (freq.get(c.id) || 0) + 1);
  }
}
const counts = Array.from(freq.values());
const totalUniqueCards = freq.size;
const mean = counts.reduce((s, x) => s + x, 0) / counts.length;
const min = Math.min(...counts);
const max = Math.max(...counts);
const variance = counts.reduce((s, x) => s + (x - mean) ** 2, 0) / counts.length;
const std = Math.sqrt(variance);
// Chi-square 检验（54 类 uniform，期望 count=740.74）
const expected = N2 * 4 / 54;
const chiSq = counts.reduce((s, x) => s + (x - expected) ** 2 / expected, 0);
// df=53, 5% 临界值≈70.99，1% 临界值≈79.84；99.5% 临界值≈83.51
const chi_p05_reject = chiSq > 70.99;
const chi_p01_reject = chiSq > 79.84;

console.log(`\n[Part-2] ${N2} 次 random 累计发牌 = ${N2*4} 张`);
console.log(`  出现的独立牌数 = ${totalUniqueCards} / 54`);
console.log(`  mean=${mean.toFixed(2)} std=${std.toFixed(2)} min=${min} max=${max}`);
console.log(`  期望 = ${expected.toFixed(2)}`);
console.log(`  chi-square = ${chiSq.toFixed(2)}  (df=53, 5%临界=70.99, 1%临界=79.84)`);
const part2_all_54 = (totalUniqueCards === 54);
const part2_range = (min >= 600 && max <= 950);  // 106-INPUT05 §11.2
const part2_chi = !chi_p01_reject;  // Tester 保守用 1% 显著水平接受
console.log(`  Part-2 全 54 张牌都被抽到: ${part2_all_54 ? '✓' : '✗'}`);
console.log(`  Part-2 min/max ⊂ [600,950] (mean±3σ): ${part2_range ? '✓' : '✗'}`);
console.log(`  Part-2 chi-square 不拒绝 uniform (α=0.01): ${part2_chi ? '✓' : '✗'}`);

// ============================
// Part 3: 静态代码扫描——generateRandom 无重摇
// ============================
const src = fs.readFileSync('js/core/DealGenerator.js', 'utf8');
const genRandBlock = src.match(/function generateRandom[\s\S]*?(?=\nfunction |\nexport |\nmodule)/);
let part3_pass = false;
let genRandBody = '';
if (genRandBlock) {
  genRandBody = genRandBlock[0];
  const hasRetry = /while\s*\(|for\s*\([^)]*isSolvable|if\s*\([^)]*length\s*===\s*0[\s\S]*(?:retry|again|deal)/i.test(genRandBody);
  part3_pass = !hasRetry;
  console.log(`\n[Part-3] generateRandom 源码扫描 (js/core/DealGenerator.js)`);
  console.log(`  函数体字数=${genRandBody.length}`);
  console.log(`  含 while/for(retry)/if(solutions===0){retry} 模式: ${hasRetry ? '✗ 有重摇' : '✓ 无重摇'}`);
} else {
  console.log(`\n[Part-3] 未找到 generateRandom 函数，扫描失败`);
}

// ============================
// 汇总
// ============================
const allOk = part1_pass_has_both && part1_pass_rate_20_30 && part2_all_54 && part2_range && part2_chi && part3_pass;
console.log(`\n=== R-03 汇总 ===`);
console.log(`  Part-1 有解+无解都出现:   ${part1_pass_has_both ? 'PASS' : 'FAIL'}`);
console.log(`  Part-1 无解率 20~30%:     ${part1_pass_rate_20_30 ? 'PASS' : 'FAIL'} (实测 ${rate200.toFixed(2)}%)`);
console.log(`  Part-2 全 54 张覆盖:      ${part2_all_54 ? 'PASS' : 'FAIL'}`);
console.log(`  Part-2 min/max range:     ${part2_range ? 'PASS' : 'FAIL'} (min=${min} max=${max})`);
console.log(`  Part-2 chi-sq α=0.01:     ${part2_chi ? 'PASS' : 'FAIL'} (χ²=${chiSq.toFixed(2)})`);
console.log(`  Part-3 无重摇静态扫描:    ${part3_pass ? 'PASS' : 'FAIL'}`);
console.log(allOk ? 'PASS' : 'FAIL');
process.exit(allOk ? 0 : 1);
