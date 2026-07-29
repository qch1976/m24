// selftest_input05_random.mjs — R-03
// random 模式 200 次采样：出现有解+无解；无重摇；uniform 分布（10000 次子采样）
import { generateRandom } from '../js/core/DealGenerator.mjs';
import Solver from '../js/core/Solver.mjs';

// 200 次
let solvedCnt = 0, unsolvedCnt = 0;
for (let i = 0; i < 200; i++) {
  const cards = generateRandom();
  const values = cards.map(c => c.value);
  if (Solver.isSolvable(values, 24)) solvedCnt++;
  else unsolvedCnt++;
}
const total = solvedCnt + unsolvedCnt;
const noSolRate = unsolvedCnt / total;
console.log(`[selftest_input05_random] R-03 200 次采样: solved=${solvedCnt} unsolved=${unsolvedCnt}`);
console.log(`  无解率 = ${(noSolRate * 100).toFixed(2)}%`);

const cond1 = solvedCnt >= 1;
const cond2 = unsolvedCnt >= 1;
const cond3 = noSolRate >= 0.15 && noSolRate <= 0.45;

// 均匀性：10000 次抽样，每张牌频次
const counts = new Array(54).fill(0);
for (let i = 0; i < 10000; i++) {
  const cards = generateRandom();
  cards.forEach(c => {
    // 计算 card id 序号
    const suitIdx = ['spade', 'heart', 'diamond', 'club', 'joker'].indexOf(c.suit);
    let idx;
    if (c.suit === 'joker') {
      idx = c.rank === 'big' ? 52 : 53;
    } else {
      const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
      idx = suitIdx * 13 + ranks.indexOf(c.rank);
    }
    counts[idx]++;
  });
}
const mean = 10000 * 4 / 54; // ≈740.7
const min = Math.min(...counts);
const max = Math.max(...counts);
console.log(`  10000 次分布: mean=${mean.toFixed(1)} min=${min} max=${max}`);
// 验收标准：所有 54 张频次落在 [600, 950]
let uniformOk = true;
for (let i = 0; i < 54; i++) {
  if (counts[i] < 600 || counts[i] > 950) {
    console.log(`  ✗ card[${i}] count=${counts[i]} out of [600,950]`);
    uniformOk = false;
  }
}
console.log(`  R-03 有解出现: ${cond1 ? '✓' : '✗'}`);
console.log(`  R-03 无解出现: ${cond2 ? '✓' : '✗'}`);
console.log(`  R-03 无解率 15%~45%: ${cond3 ? '✓' : '✗'} (${(noSolRate*100).toFixed(2)}%)`);
console.log(`  R-03 uniform 分布: ${uniformOk ? '✓' : '✗'}`);

const allOk = cond1 && cond2 && cond3 && uniformOk;
console.log(allOk ? 'PASS' : 'FAIL');
process.exit(allOk ? 0 : 1);
