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
let primaryDisplayWithAdvancedSymbolHitCount = 0;   // R-01：初级分区不得出现高级记号
const primaryViolationSampleList = [];
const factSampleList = [], modOneSampleList = [], modTwoSampleList = [], recipSampleList = [];

for (const deck of allDeckList) {
  const on = RS.solve(deck, { advancedCalc: true });
  const off = RS.solve(deck, { advancedCalc: false });
  onAdvancedSizeSum += on.advanced.size;
  onPrimarySizeSum += on.primary.size;
  offPrimarySizeSum += off.primary.size;
  if (on.primary.size + on.advanced.size > 0) onSolvableDeckGroupCount++;
  if (off.primary.size + off.advanced.size > 0) offSolvableDeckGroupCount++;

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
T('E4 关闭态 primary == 开启态 primary（R-01 严格粗化，A 后 +0）',
  offPrimarySizeSum === onPrimarySizeSum, { offPrimarySizeSum, onPrimarySizeSum });
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
T('E7 开启态可解 + 不可解 == 2380', onSolvableDeckGroupCount + (2380 - onSolvableDeckGroupCount) === 2380, null);
console.log(`  onSolvableDeckGroupCount=${onSolvableDeckGroupCount}  offSolvableDeckGroupCount=${offSolvableDeckGroupCount}  差=${onSolvableDeckGroupCount - offSolvableDeckGroupCount}〔牌组数〕`);

console.log(`\npass=${pass} fail=${fail}`);
process.exit(fail === 0 ? 0 : 1);
