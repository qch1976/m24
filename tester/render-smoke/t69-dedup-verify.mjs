/**
 * task-69 验收项3：去重口径独立验证（三方比对 + 语义单元断言）
 *
 * 【为何不比对报告数字】任务书要求「你独立实现或独立脚本验证，不要只比对双方数字」。
 * 本脚本直接 import 线上 js/core/RecipSolver.mjs 现场计算，与两个独立来源比：
 *   ① 线上实现现场输出（本脚本 import 后实跑）
 *   ② Tester 独立 Python 参考实现 v2（按架构师 171 规范 R1~R9 从零写，未读其代码）
 *   ③ 架构师 172 基准表
 * 三方全一致才 PASS。
 *
 * 【规避「两实现共享盲点」（171 规范 L240）】
 * 除数值比对外，另跑不依赖任何归约实现的**语义单元断言**，其中 L43 键碰撞项
 * 经 Tester 变异测试证实：172 表 14 牌组对它**零区分度**，必须单独断言。
 *
 * 数据形状来源：读 RecipSolver.mjs solve() 实际 return（L410-425）与
 * PageRenderer.js L151-153 消费方写法，非猜测。
 *
 * 用法: node tester/render-smoke/t69-dedup-verify.mjs
 */
import RS from '../../js/core/RecipSolver.mjs';
// ★ numLeaf / recipLeaf / ONE_NODE 不在 default export（L442-460）里，只有具名导出
//   ⇒ 必须具名 import。此处踩过一次：从 default 取得 undefined，keySol(undefined) 崩在 L274。
import { keySol, numLeaf, recipLeaf, ONE_NODE, reduceToFixpoint, evalNode } from '../../js/core/RecipSolver.mjs';

let pass = 0, fail = 0;
const T = (ok, name, detail = '') => {
  if (ok) { pass++; console.log(`  \u2705 ${name}${detail ? '   ' + detail : ''}`); }
  else { fail++; console.log(`  XX ${name}${detail ? '   ' + detail : ''}`); }
};

// ── 架构师 172 基准表（唯一有效基准；旧 §8 已作废）────────────────────
// 列：初级 / 高级 / 可消去(raw) / rawHits / maxIter
const BASE172 = [
  { d: [1, 2, 3, 4],  p: 3,  a: 4,  c: 432, r: 551, i: 2 },
  { d: [2, 3, 4, 6],  p: 10, a: 10, c: 89,  r: 155, i: 2 },
  { d: [1, 3, 4, 6],  p: 1,  a: 4,  c: 2,   r: 41,  i: 2 },
  { d: [1, 5, 5, 5],  p: 1,  a: 1,  c: 30,  r: 204, i: 2 },
  { d: [3, 3, 8, 8],  p: 1,  a: 7,  c: 8,   r: 92,  i: 2 },
  { d: [1, 2, 5, 10], p: 2,  a: 1,  c: 36,  r: 70,  i: 2 },
  { d: [1, 1, 3, 8],  p: 1,  a: 0,  c: 418, r: 588, i: 3 },
  { d: [1, 4, 6, 8],  p: 3,  a: 1,  c: 26,  r: 52,  i: 2 },
  { d: [2, 4, 5, 8],  p: 7,  a: 3,  c: 76,  r: 101, i: 2 },
  { d: [5, 5, 5, 5],  p: 1,  a: 0,  c: 192, r: 216, i: 2 },
  { d: [1, 1, 2, 9],  p: 1,  a: 0,  c: 0,   r: 4,   i: 1 },
  { d: [3, 3, 7, 7],  p: 1,  a: 0,  c: 20,  r: 24,  i: 2 },
  { d: [4, 4, 7, 7],  p: 1,  a: 0,  c: 20,  r: 24,  i: 2 },
  { d: [3, 3, 3, 5],  p: 1,  a: 0,  c: 48,  r: 54,  i: 2 },
];

// ── Tester 独立 Python 参考实现 v2 的输出（recip-reference-v2.py 实跑 70/70）──
// 来源：t69-prep/t69-recip-v2-run.log；按 171 规范从零实现，未读架构师/Developer 代码
const TESTER_V2 = {
  '1,2,3,4': [3, 4, 432, 551, 2],   '2,3,4,6': [10, 10, 89, 155, 2],
  '1,3,4,6': [1, 4, 2, 41, 2],      '1,5,5,5': [1, 1, 30, 204, 2],
  '3,3,8,8': [1, 7, 8, 92, 2],      '1,2,5,10': [2, 1, 36, 70, 2],
  '1,1,3,8': [1, 0, 418, 588, 3],   '1,4,6,8': [3, 1, 26, 52, 2],
  '2,4,5,8': [7, 3, 76, 101, 2],    '5,5,5,5': [1, 0, 192, 216, 2],
  '1,1,2,9': [1, 0, 0, 4, 1],       '3,3,7,7': [1, 0, 20, 24, 2],
  '4,4,7,7': [1, 0, 20, 24, 2],     '3,3,3,5': [1, 0, 48, 54, 2],
};

console.log('='.repeat(80));
console.log('task-69 验收项3：去重口径独立验证');
console.log('  线上 RecipSolver.solve()  vs  Tester 独立实现 v2  vs  架构师 172 基准表');
console.log('='.repeat(80));

// ══ 第一部分：14 牌组三方比对（含中间量 rawHits / maxIter）════════════
console.log('\n【1】14 牌组三方数值比对（初级/高级/可消去/rawHits/maxIter）');
console.log('     ※ 中间量 rawHits 吻合才能证明枚举空间与剪枝口径一致，而非最终数字碰巧相同');
for (const b of BASE172) {
  const key = b.d.join(',');
  let res;
  try { res = RS.solve(b.d); } catch (e) {
    T(false, `${key} 线上 solve() 抛错`, e.message);
    continue;
  }
  const on = [res.counts.primary, res.counts.advanced, res.counts.cancelledRaw,
              res.rawHits, res.maxIters];
  const tv = TESTER_V2[key];
  const ex = [b.p, b.a, b.c, b.r, b.i];
  const onOK = on.every((v, i) => v === ex[i]);
  const tvOK = tv.every((v, i) => v === ex[i]);
  T(onOK && tvOK, `${key.padEnd(9)} 三方一致`,
    `线上[${on}] TesterV2[${tv}] 172表[${ex}]`);
  // overflow 必须为 0（迭代上限 30 未被触顶）
  T(res.overflowCount === 0, `${key.padEnd(9)} 归约无溢出`, `overflow=${res.overflowCount}`);
}

// ══ 第二部分：语义单元断言（不依赖归约实现的客观事实）════════════════
console.log('\n【2】语义单元断言 —— 覆盖 172 表测不到的盲区');
const K = (t) => keySol(reduceToFixpoint(t).node);
const N = (c) => numLeaf(c, 0);
const R = (c) => recipLeaf(c, 0);
// 二元节点构造：线上求值需要 v 字段，故用 evalNode 补齐（形状读自 numLeaf L50-52）
const B = (op, a, b) => ({ op, a, b, v: evalNode({ op, a, b }) });

// (a) ★ L43 键碰撞：Tester 变异测试证实 172 表 14 组零区分度
//     若 ONE 占位符误用 num(1)，键会与牌面 1 相撞，(5-((1/5)/1))*5 与 (5-(1/5))*5 被判 2 条
//     ONE_NODE 无 v 字段（L70），不经归约直接取键（keySol L277 已处理 op==='one'）
T(keySol(ONE_NODE) !== keySol(N(1)),
  '★L43 键碰撞：ONE 与牌面1 键必异（172表零区分度，唯此项可防）',
  `ONE="${keySol(ONE_NODE)}" vs num(1)="${keySol(N(1))}"`);

// (b) 裁定② 恒等元消除：(1*2)/3 ≡ 2/3
T(K(B('/', B('*', N(1), N(2)), N(3))) === K(B('/', N(2), N(3))),
  '裁定② 恒等元 (1*2)/3 ≡ 2/3 同键', K(B('/', B('*', N(1), N(2)), N(3))));

// (c) 裁定②配套 R1规则1：倒数两种书写归一 (1/5)/1 ≡ 1/5
T(K(B('/', R(5), N(1))) === K(R(5)),
  '裁定②配套 倒数书写 (1/5)/1 ≡ 1/5 同键', K(R(5)));

// (d) 裁定③ 同项抵消：(24+5)-5 ≡ 24（172表仅 [1,1,3,8] 一组间接覆盖，薄弱）
T(K(B('-', B('+', N(24), N(5)), N(5))) === K(N(24)),
  '★裁定③ 同项抵消 (24+5)-5 ≡ 24（172表仅1/14覆盖）', K(B('-', B('+', N(24), N(5)), N(5))));

// (e) 裁定③ 加减链假倒数：3/((1+(1/8))-1) ≡ 3*8 —— 倒数被消尽应归 primary
T(K(B('/', N(3), B('-', B('+', N(1), R(8)), N(1)))) === K(B('*', N(3), N(8))),
  '裁定③ 假倒数 3/((1+1/8)-1) ≡ 3*8 同键', K(B('/', N(3), B('-', B('+', N(1), R(8)), N(1)))));

// (f) R4 分母排序：(1/3)/4 ≡ (1/4)/3（172表仅 [2,3,4,6] 一组覆盖，薄弱）
T(K(B('/', R(3), N(4))) === K(B('/', R(4), N(3))),
  '★R4 分母排序 (1/3)/4 ≡ (1/4)/3（172表仅1/14覆盖）', K(B('/', R(3), N(4))));

// (g) R4 分子排序：24/3/4 ≡ 24/4/3
T(K(B('/', B('/', N(24), N(3)), N(4))) === K(B('/', B('/', N(24), N(4)), N(3))),
  'R4 分子排序 24/3/4 ≡ 24/4/3 同键');

// ── 反向断言：防过度合并（键不该被合并的必须保持相异）──
T(K(B('*', N(3), N(8))) !== K(B('*', N(4), N(6))),
  '反向 3*8 与 4*6 键必异（防过度合并）');
T(K(B('-', N(8), N(4))) !== K(B('-', N(4), N(8))),
  '反向 减法不可交换 8-4 ≠ 4-8');
T(K(B('/', N(8), N(4))) !== K(B('/', N(4), N(8))),
  '反向 除法不可交换 8/4 ≠ 4/8');
T(K(R(5)) !== K(N(5)),
  '反向 倒数叶 r5 与牌面 n5 键必异');
// 真倒数解不得被合并到初级解
T(K(B('/', B('*', N(3), N(6)), B('-', N(1), R(4)))) !== K(B('*', N(4), N(6))),
  '反向 真倒数解 (3*6)/(1-1/4) 不得与初级 4*6 合并');

// ══ 第三部分：usedRecip 后置（R9 硬约束）语义验证 ════════════════════
console.log('\n【3】R9 usedRecip 必须归约【后】判定');
// [1,1,3,8] 的所有含倒数命中最终都应消尽 ⇒ advanced 必须为 0
// 若误在归约前判定，此值会 >0（旧 §8 报 10 条即此缺陷）
const r1138 = RS.solve([1, 1, 3, 8]);
T(r1138.counts.advanced === 0,
  '[1,1,3,8] 高级解=0（倒数全被加减链消尽；归约前判定会得非0）',
  `advanced=${r1138.counts.advanced}, cancelledRaw=${r1138.counts.cancelledRaw}`);
T(r1138.counts.cancelledRaw > 0,
  '[1,1,3,8] 可消去raw>0（证明确有含倒数命中，只是被消尽而非未枚举）',
  `cancelledRaw=${r1138.counts.cancelledRaw}`);

// ══ 第四部分：内存约束 §1.4 —— buildDisplay 每区 ≤10 ══════════════
console.log('\n【4】§1.4 内存约束：buildDisplay 每分区驻留 ≤ DISPLAY_LIMIT');
// ★ 形状读自 buildDisplay L433-439：primary/advanced 是**数组**（slice(0,limit)），
//   primaryTop/advancedTop 是**字符串**（p[0] 单条最优解）。
//   此处踩过一次：误写 `disp.primaryTop || disp.primary`，取到字符串后 .length 得字符数 13/17，
//   与 counts 的 10/10 矛盾 ⇒ 查源码后确认是脚本 bug，非产品缺陷。（规则第10条②）
const disp = RS.buildDisplay(RS.solve([2, 3, 4, 6]), RS.DISPLAY_LIMIT);
const pArr = disp.primary;
const aArr = disp.advanced;
T(Array.isArray(pArr) && pArr.length <= RS.DISPLAY_LIMIT,
  `初级区驻留 ${pArr.length} ≤ ${RS.DISPLAY_LIMIT}`);
T(Array.isArray(aArr) && aArr.length <= RS.DISPLAY_LIMIT,
  `高级区驻留 ${aArr.length} ≤ ${RS.DISPLAY_LIMIT}`);
T(typeof disp.primaryTop === 'string' && typeof disp.advancedTop === 'string',
  'primaryTop/advancedTop 为单条字符串（供 hint 兜底用，非数组）',
  `primaryTop="${disp.primaryTop}"`);
// 截断确实生效的正例：找一个解数 > 10 的牌组
const big = RS.buildDisplay(RS.solve([1, 2, 3, 4]), 2);
T(big.primary.length === 2 && big.counts.primary === 3,
  'limit=2 时驻留被截断为 2 而 counts 仍为全量 3（§1.4 只驻留 top-N）',
  `驻留=${big.primary.length} counts=${big.counts.primary}`);
T(disp.counts && disp.counts.primary === 10 && disp.counts.advanced === 10,
  '[2,3,4,6] 计数仍为全量 10/10（截断只影响驻留，不影响计数）',
  `counts=${JSON.stringify(disp.counts)}`);

console.log(`\n[t69-dedup-verify] pass=${pass} fail=${fail}`);
process.exit(fail ? 1 : 0);
