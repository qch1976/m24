// selftest/selftest_input08_enum.mjs — INPUT-08 幂/对数/开方枚举的纯数论层自测
// 🔴 只测枚举判据，不碰键/后缀（分层隔离，便于定位）
// 🔴 禁 Math.pow / Math.log / 浮点判等（§2.3 §2.4）——本文件断言里也不许出现
import {
  powEnumerable, POW_EXP_MAX, powExpMax,
  logEnumerable, logExact,
  rootEnumerable, rootExact,
  isPowDegenerate,
} from '../js/core/RecipSolver.mjs';

let pass = 0, fail = 0;
const T = (name, cond, got) => {
  if (cond) { pass++; console.log(`  ok  ${name}`); }
  else { fail++; console.log(`  FAIL ${name} => got: ${JSON.stringify(got)}`); }
};

console.log('════ INPUT-08 枚举层自测 ════');

// ───────── §2.2 指数上限分档 ─────────
console.log('【1】§2.2 指数上限分档：底2→8 / 3-5→4 / 6-9→3 / ≥10→2');
T('A-1 底2 上限8', powExpMax(2) === 8, powExpMax(2));
T('A-2 底3 上限4', powExpMax(3) === 4, powExpMax(3));
T('A-3 底5 上限4', powExpMax(5) === 4, powExpMax(5));
T('A-4 底6 上限3', powExpMax(6) === 3, powExpMax(6));
T('A-5 底9 上限3', powExpMax(9) === 3, powExpMax(9));
T('A-6 底10 上限2', powExpMax(10) === 2, powExpMax(10));
T('A-7 底13 上限2', powExpMax(13) === 2, powExpMax(13));
// 🔴 边界不可漂移：5→4 与 6→3 是档位交界，最易写成 <=5 / <6 的差一错
T('A-8🔴 档位交界 5 与 6 不同档（差一错防线）', powExpMax(5) !== powExpMax(6), [powExpMax(5), powExpMax(6)]);
T('A-9🔴 档位交界 9 与 10 不同档', powExpMax(9) !== powExpMax(10), [powExpMax(9), powExpMax(10)]);

// ───────── §2.2 底 0/1 无效 ─────────
console.log('【2】§2.2 底 a∈{0,1} 一律无效');
T('B-1 底0 不可枚举', powEnumerable(0, 3) === false, powEnumerable(0, 3));
T('B-2 底1 不可枚举', powEnumerable(1, 5) === false, powEnumerable(1, 5));
T('B-3 0^0 不可枚举', powEnumerable(0, 0) === false, powEnumerable(0, 0));
T('B-4 底2 指数3 可枚举', powEnumerable(2, 3) === true, powEnumerable(2, 3));

// ───────── §2.2b D-1 退化式 a^1 排除 ─────────
console.log('【3】§2.2b D-1：a^1 全部排除');
T('C-1 2^1 判为退化', isPowDegenerate(2, 1) === true, isPowDegenerate(2, 1));
T('C-2 13^1 判为退化', isPowDegenerate(13, 1) === true, isPowDegenerate(13, 1));
T('C-3 2^1 不可枚举', powEnumerable(2, 1) === false, powEnumerable(2, 1));
T('C-4 2^3 非退化', isPowDegenerate(2, 3) === false, isPowDegenerate(2, 3));
// 🔴 存在性前置：若 D-1 一刀切写成「全部退化」，C-4 会判红
T('C-5🔴 存在性前置：确有非退化幂可枚举（否则 D-1 断言是空的）',
  powEnumerable(2, 8) && powEnumerable(3, 4) && powEnumerable(10, 2), null);
// 指数超上限
T('C-6 2^9 超上限不可枚举', powEnumerable(2, 9) === false, powEnumerable(2, 9));
T('C-7 3^5 超上限不可枚举', powEnumerable(3, 5) === false, powEnumerable(3, 5));
T('C-8 10^3 超上限不可枚举', powEnumerable(10, 3) === false, powEnumerable(10, 3));

// ───────── §2.3 对数：精确 + D-2/D-3 排除 ─────────
console.log('【4】§2.3 + §2.2b：对数须精确，D-2/D-3 排除');
T('D-1 log_2 4 = 2', logExact(2, 4) !== null && logExact(2, 4).n === 2n && logExact(2, 4).d === 1n, logExact(2, 4));
T('D-2 log_2 8 = 3', logExact(2, 8) !== null && logExact(2, 8).n === 3n && logExact(2, 8).d === 1n, logExact(2, 8));
T('D-3 log_3 9 = 2', logExact(3, 9) !== null && logExact(3, 9).n === 2n && logExact(3, 9).d === 1n, logExact(3, 9));
T('D-4🔴 log_2 3 无理 ⇒ null（禁浮点近似）', logExact(2, 3) === null, logExact(2, 3));
T('D-5🔴 log_a(a) 退化 ⇒ 不可枚举（D-2）', logEnumerable(5, 5) === false, logEnumerable(5, 5));
T('D-6🔴 log_a(1) 退化 ⇒ 不可枚举（D-3）', logEnumerable(7, 1) === false, logEnumerable(7, 1));
T('D-7 底0/1 无效', logEnumerable(0, 4) === false && logEnumerable(1, 4) === false, null);
T('D-8 真数0 无效', logEnumerable(2, 0) === false, logEnumerable(2, 0));
T('D-9 log_2 4 可枚举', logEnumerable(2, 4) === true, logEnumerable(2, 4));
// 🔴 有理结果：log_4 2 = 1/2（精确有理，§2.3 允许）
T('D-10 log_4 2 = 1/2（有理精确）', logExact(4, 2) !== null && logExact(4, 2).n === 1n && logExact(4, 2).d === 2n, logExact(4, 2));
T('D-11 log_8 4 = 2/3', logExact(8, 4) !== null && logExact(8, 4).n === 2n && logExact(8, 4).d === 3n, logExact(8, 4));
T('D-12 log_9 3 = 1/2', logExact(9, 3) !== null && logExact(9, 3).n === 1n && logExact(9, 3).d === 2n, logExact(9, 3));

// ───────── §2.4 开方须精确 ─────────
console.log('【5】§2.4 开方（幂别名）须精确');
T('E-1 4^(1/2) = 2', rootExact(4, 2) !== null && rootExact(4, 2).n === 2n && rootExact(4, 2).d === 1n, rootExact(4, 2));
T('E-2 8^(1/3) = 2', rootExact(8, 3) !== null && rootExact(8, 3).n === 2n && rootExact(8, 3).d === 1n, rootExact(8, 3));
T('E-3 9^(1/2) = 3', rootExact(9, 2) !== null && rootExact(9, 2).n === 3n && rootExact(9, 2).d === 1n, rootExact(9, 2));
T('E-4🔴 2^(1/2) 无理 ⇒ null', rootExact(2, 2) === null, rootExact(2, 2));
T('E-5 rootEnumerable(4,2) 可枚举', rootEnumerable(4, 2) === true, rootEnumerable(4, 2));
T('E-6🔴 rootEnumerable(2,2) 不可枚举', rootEnumerable(2, 2) === false, rootEnumerable(2, 2));
T('E-7🔴 a^(1/1) 退化（等于 a 本身）⇒ 不可枚举', rootEnumerable(4, 1) === false, rootEnumerable(4, 1));
T('E-8 底0/1 开方无效', rootEnumerable(0, 2) === false && rootEnumerable(1, 2) === false, null);

// ───────── §5.2 清单基数 3+5 ─────────
console.log('【6】§5.2 清单基数须为 3+5（D-2/D-3 排除后）');
const logIntList = [];
const logRatList = [];
for (let a = 2; a <= 13; a++) {
  for (let b = 1; b <= 13; b++) {
    if (!logEnumerable(a, b)) continue;
    const r = logExact(a, b);
    if (r === null) continue;
    if (r.d === 1n) logIntList.push(`log_${a} ${b} = ${r.n}`);
    else logRatList.push(`log_${a} ${b} = ${r.n}/${r.d}`);
  }
}
console.log(`  整数结果清单（${logIntList.length}）: ${logIntList.join(' | ')}`);
console.log(`  有理结果清单（${logRatList.length}）: ${logRatList.join(' | ')}`);
T('F-1🔴 §5.2 对数整数解恰 3 组（D-2/D-3 已排除）', logIntList.length === 3, logIntList);
T('F-2🔴 §5.2 对数有理解恰 5 组', logRatList.length === 5, logRatList);
T('F-3 整数清单内容正是 log_2 4 / log_2 8 / log_3 9',
  logIntList.join(';') === 'log_2 4 = 2;log_2 8 = 3;log_3 9 = 2', logIntList);

// 开方精确清单
const rootList = [];
for (let a = 2; a <= 13; a++) for (let b = 2; b <= 13; b++) {
  if (!rootEnumerable(a, b)) continue;
  const r = rootExact(a, b);
  if (r !== null) rootList.push(`${a}^(1/${b}) = ${r.d === 1n ? r.n : `${r.n}/${r.d}`}`);
}
console.log(`  开方精确清单（${rootList.length}）: ${rootList.join(' | ')}`);
T('F-4 开方精确组合非空（存在性前置）', rootList.length > 0, rootList.length);

// ───────── 🔴 禁浮点：源码级 ─────────
console.log('【7】§2.3/§2.4 禁浮点：源码不得出现 Math.log / Math.pow');
import { readFileSync } from 'node:fs';
const src = readFileSync(new URL('../js/core/RecipSolver.mjs', import.meta.url), 'utf8');
// 🔴 先剥注释再查（TOOLS.md 第4次教训：注释里的禁令文字会污染计数）
const codeOnly = src.split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');
T('G-1🔴 产品代码（剥注释后）无 Math.log', !/Math\.log/.test(codeOnly), (codeOnly.match(/.*Math\.log.*/g) || []).slice(0, 2));
T('G-2🔴 产品代码（剥注释后）无 Math.pow', !/Math\.pow/.test(codeOnly), (codeOnly.match(/.*Math\.pow.*/g) || []).slice(0, 2));
T('G-3🔴 产品代码（剥注释后）无 toFixed', !/toFixed/.test(codeOnly), (codeOnly.match(/.*toFixed.*/g) || []).slice(0, 2));
T('G-4🔴 尺子自验：剥注释器确实在工作（源码含注释行）', src.split('\n').length > codeOnly.split('\n').length, null);

// 断言总数自核：A9 + B4 + C8 + D12 + E8 + F4 + G4 = 49
const EXPECTED = 49;
console.log(`\npass=${pass} fail=${fail}`);
if (pass + fail !== EXPECTED) {
  console.log(`🔴 条款8 断言总数不符：期望 ${EXPECTED}，实际 ${pass + fail}`);
  process.exit(2);
}
console.log(`条款8 断言总数核对：${pass + fail} == 期望 ${EXPECTED} ✅`);
process.exit(fail === 0 ? 0 : 1);
