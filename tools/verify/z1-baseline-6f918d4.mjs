// Z-1 基线采集器（在 6f918d4 上独立运行，产出关闭态/开启态基准）
// 🔴 条款5：此文件只 import 引擎，不含任何新版逻辑 ⇒ 对照物与被测物不同源
// 🔴 禁用 size 任何形态：后缀扩位是双射改名，size 恒等必漏 ⇒ 全部落到「键集合逐条」与「计数直方图」
import * as RS from '../../js/core/RecipSolver.mjs';

// 🔴 牌面值域 0–13（INPUT-08 §2.1）⇒ 2380 组。
//   我首版误写 1..13（1820 组），自查基数时发现：全仓既有脚本
//   （tester-input07-independent:172、selftest_task111_gui:76、measure-...-baseline:19）
//   一律 a=0 起。基数错会让 Z-1 对照物本身失真 ⇒ 已修正并断言基数。
const decks = [];
for (let a = 0; a <= 13; a++) for (let b = a; b <= 13; b++) for (let c = b; c <= 13; c++) for (let d = c; d <= 13; d++) decks.push([a, b, c, d]);
if (decks.length !== 2380) { console.error(`🔴 牌组基数错：${decks.length} != 2380`); process.exit(2); }

const CAPS_OFF = { recip: false, fact: false, mod: false };

// 关闭态：逐组逐键全量落盘（不是 size），供扩位后逐条比对
const offPrimaryKeyLines = [];
const offAdvancedKeyLines = [];
let offSolvableDeckHitCount = 0;
let offPrimaryKeyHitCount = 0;

// 开启态：后缀直方图（计数与等价类，而非字面）
const onSuffixHistogram = new Map();
const onPLHistogram = new Map();       // 新增两维（P/L）直方图
let onPLNonZeroHitCount = 0;           // P 或 L 为 1 的键数
let onThreeDigitHitCount = 0;          // 仍为三位后缀的键数
let onAdvancedKeyHitCount = 0;
let onSolvableDeckHitCount = 0;

for (const deck of decks) {
  const off = RS.solve(deck, { advancedCalc: true, caps: CAPS_OFF });
  const tag = deck.join(',');
  const offP = [...off.primary.keys()].sort();
  const offA = [...off.advanced.keys()].sort();
  if (offP.length + offA.length > 0) offSolvableDeckHitCount++;
  offPrimaryKeyHitCount += offP.length;
  for (const k of offP) offPrimaryKeyLines.push(`${tag}\t${k}`);
  for (const k of offA) offAdvancedKeyLines.push(`${tag}\t${k}`);

  const on = RS.solve(deck, { advancedCalc: true, caps: { recip: true, fact: true, mod: true } });
  if (on.primary.size + on.advanced.size > 0) onSolvableDeckHitCount++;
  for (const k of on.advanced.keys()) {
    onAdvancedKeyHitCount++;
    // 🔴 兼容两代（3 位 / 5 位）：本采集器首版写死三位锥定，扩位后全部落入
    //   「(无后缀)」桶 ⇒ 直接重蹈 §10 的坑（我自己就是第 4 处消费侧）。
    //   Z-1 要求的是「计数与等价类不变」而非字面不变，故按 R/F/M 三位分桶
    //   （两代可比），并单独记录 P/L 两位供新增维度核对。
    const m5 = k.match(/\|R([01])F([01])M([01])P([01])L([01])$/);
    const m3 = k.match(/\|R([01])F([01])M([01])$/);
    const m = m5 || m3;
    const s = m ? `R${m[1]}F${m[2]}M${m[3]}` : '(无后缀)';
    onSuffixHistogram.set(s, (onSuffixHistogram.get(s) || 0) + 1);
    if (m5) {
      const pl = `P${m5[4]}L${m5[5]}`;
      onPLHistogram.set(pl, (onPLHistogram.get(pl) || 0) + 1);
      if (m5[4] !== '0' || m5[5] !== '0') onPLNonZeroHitCount++;
    } else if (m3) {
      onThreeDigitHitCount++;
    }
  }
}

console.log('=== Z-1 基线（6f918d4 独立运行）===');
console.log(`BASE_COMMIT_EXPECT\t6f918d4`);
console.log(`NODE\t${process.versions.node}`);
console.log(`OFF_SOLVABLE_DECK_HITCOUNT\t${offSolvableDeckHitCount}`);
console.log(`OFF_PRIMARY_KEY_HITCOUNT\t${offPrimaryKeyHitCount}`);
console.log(`OFF_ADVANCED_KEY_HITCOUNT\t${offAdvancedKeyLines.length}`);
console.log(`ON_SOLVABLE_DECK_HITCOUNT\t${onSolvableDeckHitCount}`);
console.log(`ON_ADVANCED_KEY_HITCOUNT\t${onAdvancedKeyHitCount}`);
console.log('--- ON_SUFFIX_HISTOGRAM ---');
for (const s of [...onSuffixHistogram.keys()].sort()) console.log(`SUF\t${s}\t${onSuffixHistogram.get(s)}`);
console.log('--- ON_PL_HISTOGRAM（五位新增两维）---');
for (const s of [...onPLHistogram.keys()].sort()) console.log(`PL\t${s}\t${onPLHistogram.get(s)}`);
console.log(`PL_NONZERO_HITCOUNT\t${onPLNonZeroHitCount}\t（recip/fact/mod 开、pow/log 关 ⇒ 预期 0）`);
console.log(`THREE_DIGIT_HITCOUNT\t${onThreeDigitHitCount}\t（改后预期 0：已全部扩为五位）`);
// 关闭态键全文摘要：用内容哈希代替 size，任何一条键变动都会变
import { createHash } from 'node:crypto';
const h = (arr) => createHash('sha1').update(arr.join('\n')).digest('hex');
console.log('--- OFF_KEY_DIGEST（逐键内容，非 size）---');
console.log(`OFF_PRIMARY_DIGEST\t${h(offPrimaryKeyLines)}`);
console.log(`OFF_ADVANCED_DIGEST\t${h(offAdvancedKeyLines)}`);
console.log(`OFF_PRIMARY_LINES\t${offPrimaryKeyLines.length}`);
// 关闭态是否出现含 | 的键（C-A1：恒拼会破 R-01）
const offPipe = offPrimaryKeyLines.concat(offAdvancedKeyLines).filter((l) => l.split('\t')[1].includes('|'));
console.log(`OFF_PIPE_KEY_HITCOUNT\t${offPipe.length}\t（预期 0）`);
