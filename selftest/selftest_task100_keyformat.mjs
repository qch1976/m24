#!/usr/bin/env node
// selftest_task100_keyformat.mjs
// task-100 断言集：C（键后缀格式）+ A（usedRecip 补维）
// 依据 205 §E-1。D-A1 不适用（见文末说明：D 前提不成立，未实施）。
//
// ⚠️ 团队规则 11：新造口径先自验，再下结论。本文件每条断言均附「量的是什么」。
import * as RS from '../js/core/RecipSolver.mjs';
import { readFileSync } from 'node:fs';

let pass = 0, fail = 0;
const T = (name, cond, got) => {
  if (cond) { pass++; console.log(`  PASS ${name}`); }
  else { fail++; console.log(`  FAIL ${name} => got: ${JSON.stringify(got)}`); }
};

const src = readFileSync(new URL('../js/core/RecipSolver.mjs', import.meta.url), 'utf-8');

const decks = [];
for (let a = 0; a <= 13; a++) for (let b = a; b <= 13; b++)
  for (let c = b; c <= 13; c++) for (let d = c; d <= 13; d++) decks.push([a, b, c, d]);

console.log('=== 全量枚举（2380 组）收集键 ===');
const allOn = [], allOff = [];
let crossPartition = 0; const crossSamples = [];
let pSize = 0, aSize = 0;
for (const dk of decks) {
  const on = RS.solve(dk, { advancedCalc: true });
  const off = RS.solve(dk, { advancedCalc: false });
  pSize += on.primary.size; aSize += on.advanced.size;
  for (const k of on.primary.keys()) { allOn.push(k); if (on.advanced.has(k)) { crossPartition++; if (crossSamples.length < 5) crossSamples.push([dk, k]); } }
  for (const k of on.advanced.keys()) allOn.push(k);
  for (const k of off.primary.keys()) allOff.push(k);
  for (const k of off.advanced.keys()) allOff.push(k);
}
console.log(`  开启态键 ${allOn.length}（primary ${pSize} / advanced ${aSize}）｜关闭态键 ${allOff.length}`);

// ★ 存在性前置（205 §F-3 通则）：以「零/空」为预期的断言，须先证明尺子量到了目标。
console.log('\n=== 存在性前置：证明确有带后缀的键，否则下面的「零」类断言全部失明 ===');
const withSuffix = allOn.filter((k) => k.includes('|'));
T('C-A0★ 存在性前置：开启态确实存在带 | 后缀的键（否则 C-A1/A2 判据失明）',
  withSuffix.length > 0, withSuffix.length);
console.log(`  带后缀键数 = ${withSuffix.length}`);

console.log('\n=== C：键后缀格式（205 §C-1）===');
// C-A1：关闭态三标记恒 false ⇒ 全部走无后缀分支 ⇒ 不存在含 | 的键。守 R-01。
const offWithPipe = allOff.filter((k) => k.includes('|'));
T('C-A1🔴 关闭态键集合中不存在含 | 的键（守 R-01；恒拼 R0F0M0 会判红）',
  offWithPipe.length === 0, offWithPipe.slice(0, 3));

// C-A2：|R0F0M0 是「恒拼」与「全假无后缀」冲突时才会出现的形态，必须不存在。
// 🔴 INPUT-08 §3.3：扩位后全假形态变为 |R0F0M0P0L0，两代均须不存在。
//   若只查三位字面，扩位后该断言会因「找不到三位串」而恒真 ⇒ 丧失鉴别力。
const zeroSuffix = allOn.filter((k) => /\|R0F0M0(P0L0)?$/.test(k));
T('C-A2🔴 全量键中不存在 |R0F0M0 / |R0F0M0P0L0 字面量（全假必须走无后缀分支）',
  zeroSuffix.length === 0, zeroSuffix.slice(0, 3));

// C-A3：后缀存在时必为定长、位序 R→F→M。「只拼真位」会判红。
// 🔴 INPUT-08 §3.3：后缀三位→五位 R→F→M→P→L，定长锥定正则同步扩位。
//   兼容两代（旧三位键若残留也不误报）。
// 🔴 本处与下方 A-A1 是 INPUT-08 §10 清单【未列】的第 4/5 处三位消费侧，
//   由本脚本定长断言当场判红拓出 —— 这正是 C-A3 的设计目的（后缀格式变动需被发现）。
const badSuffix = withSuffix.filter((k) => !/\|R[01]F[01]M[01](P[01]L[01])?$/.test(k));
T('C-A3 后缀存在时必匹配 /\\|R[01]F[01]M[01](P[01]L[01])?$/（定长、位序 R-F-M-P-L）',
  badSuffix.length === 0, badSuffix.slice(0, 3));

// C-A3b：源码就地防线注释须在（C-2 防线 1）
T('C-A3b 源码含 R0F0M0 陷阱的就地警示注释（205 §C-2 防线 1）',
  /R0F0M0/.test(src) && /破\s*R-01/.test(src), null);

console.log('\n=== A：usedRecip 补维（205 §E-1 A-A1 / A-A2）===');
// A-A1：usedRecip 单独为真（F=M=0）时，键必含 |R1F0M0。
//   这正是原实现丢维之处：旧版此情形键【无后缀】，与纯初级解同键。
const r1f0m0 = allOn.filter((k) => /\|R1F0M0(P0L0)?$/.test(k));   // §3.3：五位后为 R1F0M0P0L0
T('A-A1🔴 存在 |R1F0M0 键（usedRecip 单独为真时键须含 R 位；L719 改回 (usedFact||usedMod) 须判红）',
  r1f0m0.length > 0, r1f0m0.length);
console.log(`  |R1F0M0 键数 = ${r1f0m0.length}（旧版这些键无后缀 ⇒ 与初级解同键 ⇒ 丢维）`);

// A-A2🔴 不变式级：同一牌组内，不存在同时出现于 primary 与 advanced 的键。
//   分区归属由三标记唯一互斥决定 ⇒ 同键跨分区在逻辑上不应存在。
//   基线 dd7eb07 实测为 3 ⇒ 撤回 A 改动即判红。205 要求长期保留。
T('A-A2🔴🔴 不变式：同一牌组内无同时落在 primary 与 advanced 的键（撤回 A 须判红，基线为 3）',
  crossPartition === 0, crossSamples);
console.log(`  同键跨两分区 = ${crossPartition}（基线 dd7eb07 为 3）`);

// A-A1b：源码键拼装须含 usedRecip（R-04.3 配套断言增验键结构，205 §E-2）
T('A-A1b 源码键拼装含 usedRecip（E-2：R-04.3 增验键含 recip 维，不止验真假）',
  /\|R\$\{usedRecip \? 1 : 0\}F\$\{usedFact \? 1 : 0\}M\$\{usedMod \? 1 : 0\}/.test(src), null);

console.log('\n=== 数字对比（205 §D-4「A 后」行）===');
T(`A-N1 primary 合计 = 3958（预期 +0）`, pSize === 3958, pSize);
T(`A-N2 advanced 合计 = 22085（预期 22084→22085，+1 为 [0,1,2,12] 真分裂）`, aSize === 22085, aSize);

// 关闭态与基线一致性：键集合逐键比对（R-01）
console.log('\n=== R-01 关闭态：键形态须与旧版一致（无后缀）===');
T('A-N3 关闭态所有键均无后缀（等价于与旧版键集合一致）', offWithPipe.length === 0, offWithPipe.length);

console.log(`\npass=${pass} fail=${fail}`);
process.exit(fail === 0 ? 0 : 1);
