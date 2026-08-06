#!/usr/bin/env node
// task-105 校验：基准表数字的内部一致性 + 人工抽样取证
// 209 条款 3：预期值前提须坐实 ⇒ 本脚本对上一支测得的数字做交叉核对，
// 任一恒等式不成立即说明某个口径写错了（而非「数据就是这样」）。
import * as RS from '../../js/core/RecipSolver.mjs';

let pass = 0, fail = 0;
const T = (name, cond, got) => { if (cond) { pass++; console.log(`  PASS ${name}`); } else { fail++; console.log(`  FAIL ${name} => got: ${JSON.stringify(got)}`); } };

const allDeckList = [];
for (let a = 0; a <= 13; a++) for (let b = a; b <= 13; b++)
  for (let c = b; c <= 13; c++) for (let d = c; d <= 13; d++) allDeckList.push([a, b, c, d]);

const suffixSizeSum = new Map();
let displayFactSizeSum = 0, displayModOneSizeSum = 0, displayModTwoPlusSizeSum = 0;
let displayRecipSizeSum = 0;
let onAdvancedSizeSum = 0, onPrimarySizeSum = 0, offPrimarySizeSum = 0;
let onSolvableDeckGroupCount = 0, offSolvableDeckGroupCount = 0;
// 🔴 必须【独立累加】，不得写 2380 - solvable —— 那样 E7 又变回恒真式。
let onUnsolvableDeckGroupCount = 0;
let primaryDisplayWithAdvancedSymbolHitCount = 0;   // R-01：初级分区不得出现高级记号
// 🔴 条款 6 / 裁定 214 ②：primary 侧语义是【集合相等（双向）】，不是「粗化/⊆」。
//   R-01 两半：① 不得多出 ② 不得吞掉初级解（= 零误删硬约束「旧基键缺失 0」）。
//   size 类判据数学上必漏：1对1 改名是单射 ⇒ size 恒定 ⇒ 内容全变也不判红（实测变异 ④）。
let primaryKeySetMismatchDeckCount = 0;    // 逐键双向比对不一致的牌组数
let primaryOnlyInOnKeyCount = 0;           // 开启态多出的键（R-01 ①）
let primaryOnlyInOffKeyCount = 0;          // 🔴 开启态吞掉的旧键（R-01 ②，零误删硬约束）
let deckGroupVisitedCount = 0;             // 条款 8：实际遍历到的牌组数，防循环 0 次
const primaryKeySetMismatchSampleList = [];
const primaryViolationSampleList = [];
const factSampleList = [], modOneSampleList = [], modTwoSampleList = [], recipSampleList = [];

for (const deck of allDeckList) {
  deckGroupVisitedCount++;
  const on = RS.solve(deck, { advancedCalc: true });
  const off = RS.solve(deck, { advancedCalc: false });
  onAdvancedSizeSum += on.advanced.size;
  onPrimarySizeSum += on.primary.size;
  offPrimarySizeSum += off.primary.size;
  if (on.primary.size + on.advanced.size > 0) onSolvableDeckGroupCount++;
  else onUnsolvableDeckGroupCount++;
  if (off.primary.size + off.advanced.size > 0) offSolvableDeckGroupCount++;

  // 🔴 E4 双向逐键比对（裁定 214 ②批准）：逐牌组比键内容，两个方向都记账
  const offKeySet = new Set(off.primary.keys());
  const onKeySet = new Set(on.primary.keys());
  let deckMismatched = false;
  for (const k of onKeySet) if (!offKeySet.has(k)) { primaryOnlyInOnKeyCount++; deckMismatched = true; }
  for (const k of offKeySet) if (!onKeySet.has(k)) { primaryOnlyInOffKeyCount++; deckMismatched = true; }
  if (deckMismatched) {
    primaryKeySetMismatchDeckCount++;
    if (primaryKeySetMismatchSampleList.length < 3) {
      primaryKeySetMismatchSampleList.push([
        deck.join(','),
        [...onKeySet].filter((k) => !offKeySet.has(k)).slice(0, 2),
        [...offKeySet].filter((k) => !onKeySet.has(k)).slice(0, 2),
      ]);
    }
  }

  for (const [k, disp] of on.advanced) {
    const m = k.match(/\|R([01])F([01])M([01])$/);
    if (m) suffixSizeSum.set(m[0], (suffixSizeSum.get(m[0]) || 0) + 1);
    const s = String(disp);
    const modHitCount = (s.match(/%/g) || []).length;
    if (s.includes('!')) { displayFactSizeSum++; if (factSampleList.length < 3) factSampleList.push([deck, k, s]); }
    if (modHitCount === 1) { displayModOneSizeSum++; if (modOneSampleList.length < 3) modOneSampleList.push([deck, k, s]); }
    if (modHitCount >= 2) { displayModTwoPlusSizeSum++; if (modTwoSampleList.length < 3) modTwoSampleList.push([deck, k, s]); }
    if (/\(1\//.test(s)) { displayRecipSizeSum++; if (recipSampleList.length < 3) recipSampleList.push([deck, k, s]); }
  }
  for (const [k, disp] of on.primary) {
    const s = String(disp);
    if (s.includes('!') || s.includes('%') || /\(1\//.test(s)) {
      primaryDisplayWithAdvancedSymbolHitCount++;
      if (primaryViolationSampleList.length < 3) primaryViolationSampleList.push([deck, k, s]);
    }
  }
}

const sumBy = (pred) => [...suffixSizeSum.entries()].filter(([s]) => pred(s)).reduce((a, [, v]) => a + v, 0);
const suffixTotalSizeSum = [...suffixSizeSum.values()].reduce((a, b) => a + b, 0);

console.log('=== 一致性恒等式（任一不成立 ⇒ 某口径写错）===');
T('E1 后缀总和 == 开启态 advanced size 求和（每条 advanced 解必带后缀）',
  suffixTotalSizeSum === onAdvancedSizeSum, { suffixTotalSizeSum, onAdvancedSizeSum });
T('E2 F1 类后缀总和 == 展示含 ! 的条数（F 位 ⟺ 展示有阶乘号）',
  sumBy((s) => /F1/.test(s)) === displayFactSizeSum, { F1: sumBy((s) => /F1/.test(s)), displayFactSizeSum });
T('E3 M1 类后缀总和 == 展示含 ≥1 个 % 的条数（M 位 ⟺ 展示有模号）',
  sumBy((s) => /M1/.test(s)) === displayModOneSizeSum + displayModTwoPlusSizeSum,
  { M1: sumBy((s) => /M1/.test(s)), 单模加双模: displayModOneSizeSum + displayModTwoPlusSizeSum });
// 🔴 E4 改双向 setEqual（裁定 214 ②）。旧实现 `offPrimarySizeSum === onPrimarySizeSum`
//   是【size 求和】档，比逐组 size 又弱一层（能被「A 组+1、B 组−1」相互抵消骗过）。
//   变异 ④（仅开启态 primary 键 1对1 改名 MUT~）实测：
//     〔size 求和〕PASS 3958=3958 / 〔逐组 size〕PASS 0 组 / 〔逐键 setEqual〕FAIL 1525 组
//   ⇒ size 类数学上必漏，非概率问题。
T('E4a R-01① 开启态 primary 不得多出新键（逐键）',
  primaryOnlyInOnKeyCount === 0, { primaryOnlyInOnKeyCount, 样例: primaryKeySetMismatchSampleList });
T('E4b🔴 R-01② 开启态 primary 不得吞掉旧键（零误删硬约束「旧基键缺失 0」）',
  primaryOnlyInOffKeyCount === 0, { primaryOnlyInOffKeyCount, 样例: primaryKeySetMismatchSampleList });
T('E4c 两态 primary 键集合相等（双向，非「粗化/⊆」）',
  primaryKeySetMismatchDeckCount === 0, { primaryKeySetMismatchDeckCount });
console.log(`  参考〔size 求和〕off=${offPrimarySizeSum} on=${onPrimarySizeSum}（仅供对照，不作 R-01 通过依据）`);
T('E5 无 |R0F0M0 后缀（C-2 全假走无后缀分支）',
  !suffixSizeSum.has('|R0F0M0'), [...suffixSizeSum.keys()]);
T('E6🔴 R-01 初级分区展示不含高级记号 ! / % / (1/',
  primaryDisplayWithAdvancedSymbolHitCount === 0, primaryViolationSampleList);
console.log(`  存在性前置：R1 类后缀 ${sumBy((s) => /R1/.test(s))} > 0、展示含 (1/ 的 ${displayRecipSizeSum} > 0 ⇒ E6 的「0」有信息量`);

console.log('\n=== 人工抽样取证（规则 11：下结论前先看原文）===');
const show = (label, list) => { console.log(`  ${label}`); for (const [d, k, s] of list) console.log(`     [${d}] ${s}     键=${k}`); };
show('阶乘解样本（应真含 !）:', factSampleList);
show('单模解样本（应恰含 1 个 %）:', modOneSampleList);
show('双模解样本（应含 ≥2 个 %）:', modTwoSampleList);
show('倒数解样本（应含 (1/）:', recipSampleList);

console.log('\n=== 牌组数一致性 ===');
// 🔴 旧 E7 是恒真式：`x + (2380 - x) === 2380` 对任意 x 成立 ⇒ 零信息量哑弹。
//   改为【独立计数】：可解与不可解分开累加，再比遍历总数。
T('E7 开启态 可解 + 不可解 == 实际遍历牌组数（独立计数，非恒真式）',
  onSolvableDeckGroupCount + onUnsolvableDeckGroupCount === deckGroupVisitedCount,
  { onSolvableDeckGroupCount, onUnsolvableDeckGroupCount, deckGroupVisitedCount });
T('E8 实际遍历牌组数 == 2380（条款 8：防循环 0 次/提前退场）',
  deckGroupVisitedCount === 2380, { deckGroupVisitedCount });
console.log(`  onSolvableDeckGroupCount=${onSolvableDeckGroupCount}  offSolvableDeckGroupCount=${offSolvableDeckGroupCount}  差=${onSolvableDeckGroupCount - offSolvableDeckGroupCount}〔牌组数〕`);

// 🔴🔴 条款 8（裁定 214 ③）：断言总数自断言 —— 断言静默退场则总数不符⇒判红。
//   防：断言写在 if 内未执行、early-return、try-catch 吞掉、循环 0 次。
//   验收方以 fail=0 通过时必须同时核对 pass 总数，fail=0 单独不足为凭。
const EXPECTED_ASSERTION_COUNT = 10;
console.log(`\npass=${pass} fail=${fail}`);
if (pass + fail !== EXPECTED_ASSERTION_COUNT) {
  console.log(`\n🔴 FAIL 条款8 断言总数不符：期望 ${EXPECTED_ASSERTION_COUNT}，实际 ${pass + fail}`);
  console.log('   ⇒ 有断言静默退场（分支未进/提前返回/异常吞掉/循环 0 次），本次结果不可采信');
  process.exit(2);
}
console.log(`条款8 断言总数核对：${pass + fail} == 期望 ${EXPECTED_ASSERTION_COUNT} ✅`);
process.exit(fail === 0 ? 0 : 1);
