#!/usr/bin/env node
// task-105 · INPUT-07 §8 解数基准表实测
// 待测 commit 95036a2（含 task-100 A+C + task-103 两支既有失败修正）
//
// ⚠️ 209 号硬约束执行：
//   条款 1 三维量纲：本脚本所有数字口径统一为
//     ①计数方式=〔唯一键数〕（Map.size，去重后）除显式标 hitCount 者
//     ②键来源  =〔归约式键〕（RecipSolver L730 baseK = keySol(rr.node)）
//     ③聚合口径=〔size 求和〕（逐牌组 size 相加）；另单独给〔精确键〕全局去重口径对照
//   条款 2 量纲入变量名：禁 count/n/total/num，用 ...UniqReducedKeySizeSum / ...HitCount 等
//   条款 3 预期值前提须坐实：旧值 +445/−124 不沿用，本轮重测；以「零」为预期者附存在性前置
//   条款 4 变异须附注入生效证据：本脚本为纯测量，不含变异；判据类断言在 selftest 侧
import * as RS from '../../js/core/RecipSolver.mjs';

const t0 = Date.now();

// ---------- 牌组全集：0..13 四张有序组合 ----------
const allDeckList = [];
for (let a = 0; a <= 13; a++) for (let b = a; b <= 13; b++)
  for (let c = b; c <= 13; c++) for (let d = c; d <= 13; d++) allDeckList.push([a, b, c, d]);
const deckGroupCount = allDeckList.length;   // 牌组数（非条数，量纲=组数）

// ---------- 累计器（量纲写进变量名，209 条款 2）----------
// 关闭态（advancedCalc:false）
let offPrimaryUniqReducedKeySizeSum = 0;
let offAdvancedUniqReducedKeySizeSum = 0;
let offSolvableDeckGroupCount = 0;
let offUnsolvableDeckGroupCount = 0;
// 开启态（advancedCalc:true）
let onPrimaryUniqReducedKeySizeSum = 0;
let onAdvancedUniqReducedKeySizeSum = 0;
let onSolvableDeckGroupCount = 0;
let onUnsolvableDeckGroupCount = 0;
// 标记分类（开启态 advanced 内，按键后缀三位 R/F/M）
let factOnlyUniqReducedKeySizeSum = 0;    // |R0F1M0 阶乘解
let modSingleUniqReducedKeySizeSum = 0;   // 单模解：M1 且该牌组仅一处 mod → 以后缀 F0M1 且 R0 计
let modDualUniqReducedKeySizeSum = 0;     // 双模解：见下方 dualMod 口径说明
let recipOnlyUniqReducedKeySizeSum = 0;   // |R1F0M0
const suffixHistogramSizeSum = new Map(); // 后缀 → size 求和
// 精确键（全局去重）对照口径
const onPrimaryExactKeySet = new Set();
const onAdvancedExactKeySet = new Set();
const offPrimaryExactKeySet = new Set();
// 性能样本（毫秒）
const perDeckElapsedMsList = [];

for (const deck of allDeckList) {
  const tOn0 = process.hrtime.bigint();
  const on = RS.solve(deck, { advancedCalc: true });
  const tOn1 = process.hrtime.bigint();
  const off = RS.solve(deck, { advancedCalc: false });
  perDeckElapsedMsList.push(Number(tOn1 - tOn0) / 1e6);

  onPrimaryUniqReducedKeySizeSum += on.primary.size;
  onAdvancedUniqReducedKeySizeSum += on.advanced.size;
  offPrimaryUniqReducedKeySizeSum += off.primary.size;
  offAdvancedUniqReducedKeySizeSum += off.advanced.size;

  if (on.primary.size + on.advanced.size > 0) onSolvableDeckGroupCount++; else onUnsolvableDeckGroupCount++;
  if (off.primary.size + off.advanced.size > 0) offSolvableDeckGroupCount++; else offUnsolvableDeckGroupCount++;

  const deckTag = deck.join(',');
  for (const k of on.primary.keys()) onPrimaryExactKeySet.add(deckTag + '#' + k);
  for (const k of on.advanced.keys()) onAdvancedExactKeySet.add(deckTag + '#' + k);
  for (const k of off.primary.keys()) offPrimaryExactKeySet.add(deckTag + '#' + k);

  for (const k of on.advanced.keys()) {
    const m = k.match(/\|R([01])F([01])M([01])(?:P([01])L([01]))?$/);
    if (!m) continue;
    const suffix = `|R${m[1]}F${m[2]}M${m[3]}`;
    suffixHistogramSizeSum.set(suffix, (suffixHistogramSizeSum.get(suffix) || 0) + 1);
    const [, r, f, mo] = m;
    if (r === '0' && f === '1' && mo === '0') factOnlyUniqReducedKeySizeSum++;
    if (r === '1' && f === '0' && mo === '0') recipOnlyUniqReducedKeySizeSum++;
    if (mo === '1') {
      // 🔴 量纲说明：键后缀只编「是否用了 mod」一个布尔位，**不编 mod 出现次数**
      //   ⇒ 「单模解 / 双模解」无法从键后缀区分。此处按后缀口径只能给「含 mod 解」总数，
      //   真正的单/双模须数原式中 mod 节点个数 ⇒ 见下方 modNodeCountHistogram。
      if (f === '0' && r === '0') modSingleUniqReducedKeySizeSum++;
    }
  }
}

// ---------- 单模 / 双模：须数原式 mod 节点个数（键后缀无此维度）----------
// 口径：对每牌组 advanced 展示文本中 '%' 出现次数分类（展示文本 = 用户可见式子）
let modNodeOneUniqReducedKeySizeSum = 0;
let modNodeTwoPlusUniqReducedKeySizeSum = 0;
let factDisplayUniqReducedKeySizeSum = 0;
for (const deck of allDeckList) {
  const on = RS.solve(deck, { advancedCalc: true });
  for (const [k, display] of on.advanced) {
    const s = String(display);
    const modOccurrenceHitCount = (s.match(/%/g) || []).length;
    if (modOccurrenceHitCount === 1) modNodeOneUniqReducedKeySizeSum++;
    else if (modOccurrenceHitCount >= 2) modNodeTwoPlusUniqReducedKeySizeSum++;
    if (s.includes('!')) factDisplayUniqReducedKeySizeSum++;
    void k;
  }
}

perDeckElapsedMsList.sort((x, y) => x - y);
const p95ElapsedMs = perDeckElapsedMsList[Math.floor(perDeckElapsedMsList.length * 0.95)];
const maxElapsedMs = perDeckElapsedMsList[perDeckElapsedMsList.length - 1];

const D = '〔唯一键数 / 归约式键 / size 求和〕';
console.log('='.repeat(72));
console.log(`INPUT-07 §8 解数基准表实测 · commit 95036a2 · Node ${process.version}`);
console.log(`全局量纲（209 条款 1）：${D}；另标者从其标注`);
console.log('='.repeat(72));

console.log(`\n【0】牌组全集`);
console.log(`  deckGroupCount = ${deckGroupCount}〔牌组数〕`);

console.log(`\n【1】关闭态 advancedCalc:false`);
console.log(`  offPrimaryUniqReducedKeySizeSum   = ${offPrimaryUniqReducedKeySizeSum}  ${D}`);
console.log(`  offAdvancedUniqReducedKeySizeSum  = ${offAdvancedUniqReducedKeySizeSum}  ${D}`);
console.log(`  offSolvableDeckGroupCount         = ${offSolvableDeckGroupCount}〔牌组数〕`);
console.log(`  offUnsolvableDeckGroupCount       = ${offUnsolvableDeckGroupCount}〔牌组数〕`);

console.log(`\n【2】开启态 advancedCalc:true`);
console.log(`  onPrimaryUniqReducedKeySizeSum    = ${onPrimaryUniqReducedKeySizeSum}  ${D}`);
console.log(`  onAdvancedUniqReducedKeySizeSum   = ${onAdvancedUniqReducedKeySizeSum}  ${D}`);
console.log(`  onSolvableDeckGroupCount          = ${onSolvableDeckGroupCount}〔牌组数〕`);
console.log(`  onUnsolvableDeckGroupCount        = ${onUnsolvableDeckGroupCount}〔牌组数〕`);

console.log(`\n【3】开启态增量（209 条款 3：旧值 +445/−124 不沿用，本轮重测）`);
const primaryDeltaUniqReducedKeySizeSum = onPrimaryUniqReducedKeySizeSum - offPrimaryUniqReducedKeySizeSum;
const advancedDeltaUniqReducedKeySizeSum = onAdvancedUniqReducedKeySizeSum - offAdvancedUniqReducedKeySizeSum;
const solvableDeltaDeckGroupCount = onSolvableDeckGroupCount - offSolvableDeckGroupCount;
console.log(`  primaryDeltaUniqReducedKeySizeSum  = ${primaryDeltaUniqReducedKeySizeSum >= 0 ? '+' : ''}${primaryDeltaUniqReducedKeySizeSum}  ${D}`);
console.log(`  advancedDeltaUniqReducedKeySizeSum = ${advancedDeltaUniqReducedKeySizeSum >= 0 ? '+' : ''}${advancedDeltaUniqReducedKeySizeSum}  ${D}`);
console.log(`  solvableDeltaDeckGroupCount        = ${solvableDeltaDeckGroupCount >= 0 ? '+' : ''}${solvableDeltaDeckGroupCount}〔牌组数〕`);

console.log(`\n【4】键后缀分布（开启态 advanced）`);
for (const [sfx, v] of [...suffixHistogramSizeSum.entries()].sort()) {
  console.log(`  ${sfx.padEnd(9)} = ${String(v).padStart(6)}  ${D}`);
}
console.log(`  ⚠️ 后缀仅编「是否用过 mod」一个布尔位，不编 mod 出现次数 ⇒ 单/双模不可由后缀区分`);

console.log(`\n【5】阶乘解 / 单模解 / 双模解（口径：原式展示文本中符号出现次数）`);
console.log(`  factDisplayUniqReducedKeySizeSum        = ${factDisplayUniqReducedKeySizeSum}  ${D}（展示含 !）`);
console.log(`  modNodeOneUniqReducedKeySizeSum         = ${modNodeOneUniqReducedKeySizeSum}  ${D}（展示含 1 个 %，单模）`);
console.log(`  modNodeTwoPlusUniqReducedKeySizeSum     = ${modNodeTwoPlusUniqReducedKeySizeSum}  ${D}（展示含 ≥2 个 %，双模）`);
console.log(`  ── 按键后缀口径对照（与上不同量纲，不可互推）──`);
console.log(`  factOnlyUniqReducedKeySizeSum(|R0F1M0)  = ${factOnlyUniqReducedKeySizeSum}  ${D}`);
console.log(`  recipOnlyUniqReducedKeySizeSum(|R1F0M0) = ${recipOnlyUniqReducedKeySizeSum}  ${D}`);

console.log(`\n【6】精确键全局去重口径（对照，③维不同 ⇒ 与上表不可比）`);
console.log(`  onPrimaryExactKeyUniqCount   = ${onPrimaryExactKeySet.size}〔唯一键数 / 归约式键 / 精确键〕`);
console.log(`  onAdvancedExactKeyUniqCount  = ${onAdvancedExactKeySet.size}〔唯一键数 / 归约式键 / 精确键〕`);
console.log(`  offPrimaryExactKeyUniqCount  = ${offPrimaryExactKeySet.size}〔唯一键数 / 归约式键 / 精确键〕`);

console.log(`\n【7】性能`);
console.log(`  p95ElapsedMs = ${p95ElapsedMs.toFixed(1)}ms  maxElapsedMs = ${maxElapsedMs.toFixed(1)}ms  (限 2000ms)  ${p95ElapsedMs < 2000 ? '✅' : '❌'}`);

console.log(`\n【8】存在性前置（209 条款 3：以「零」为预期者须附）`);
const offSuffixKeyHitCount = [...offPrimaryExactKeySet].filter((k) => k.includes('|')).length;
console.log(`  offSuffixKeyHitCount = ${offSuffixKeyHitCount}〔命中次数〕（关闭态含 | 的键，预期 0）`);
const onSuffixTotalHitCount = [...suffixHistogramSizeSum.values()].reduce((a, b) => a + b, 0);
console.log(`  前置：开启态带后缀键 = ${onSuffixTotalHitCount} > 0 ⇒ 该「0」有信息量`);

console.log(`\n总耗时 ${((Date.now() - t0) / 1000).toFixed(1)}s`);

// ============ 🔴 INPUT-08 §10：本脚本原本无 T( 、无 process.exit ============
// 缘由（开发实测）：后缀三位→五位后，L68 定长锥定正则静默失配（if (!m) continue）
//   ⇒ 直方图全归零。而本脚本只打印、不断言、不设退出码 ⇒ 全零也无从判红，
//   “跑完了”会被误读为“没问题”。故补最小必要断言 + 退出码。
// 🔴 只断言「尺子本身没失效」与「关闭态零后缀」两件，不碰原有基准数字口径。
let gatePass = 0, gateFail = 0;
const G = (name, cond, got) => {
  if (cond) { gatePass++; console.log(`  PASS ${name}`); }
  else { gateFail++; console.log(`  FAIL ${name} => got: ${JSON.stringify(got)}`); }
};
console.log(`\n【9】门禁断言（INPUT-08 §10 补）`);
G('M-1🔴 尺子未失效：开启态带后缀键 > 0（为 0 则正则已失配，后续全部数字均不可信）',
  onSuffixTotalHitCount > 0, onSuffixTotalHitCount);
G('M-2🔴 关闭态无含 | 的键（守 R-01，禁恒拼全 0 后缀）',
  offSuffixKeyHitCount === 0, offSuffixKeyHitCount);
console.log(`\ngatePass=${gatePass} gateFail=${gateFail}`);
process.exit(gateFail === 0 ? 0 : 1);
