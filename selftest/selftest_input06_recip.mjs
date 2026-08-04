// selftest_input06_recip.mjs — INPUT-06 task-B 交付要求 1
// R-11①：§1.2.3 判定示例表全 10 例（7 无效 + 3 有效），判定须与表完全一致
// R-11②：(8-4)*6 与 (8-4)/(1/6) 归并 1 条且 usedRecip=false
// R-11③：归约迭代至不动点 + 迭代上限保护
// R-11④⑤：有效倒数解基准 + 恒 0 正例
import {
  reduceToFixpoint, countRecip, render, keySol, solve,
  numLeaf, recipLeaf, evalNode, is24F, F, MAX_ITER,
  sortSolutions, countAdvSymbols,
} from '../js/core/RecipSolver.mjs';

let pass = 0, fail = 0;
const bad = [];
function ck(name, cond, extra) {
  if (cond) { pass++; console.log('  ok  ' + name + (extra ? '  ' + extra : '')); }
  else { fail++; bad.push(name); console.log('  XX  ' + name + (extra ? '  ' + extra : '')); }
}

// ---- AST 构造 DSL：n(c)=数字叶子, r(c)=倒数叶子, b(op,a,b)=二元 ----
let slotSeq = 0;
const n = (c) => numLeaf(c, slotSeq++);
const r = (c) => recipLeaf(c, slotSeq++);
const b = (op, a, bb) => ({ op, a, b: bb });

console.log('='.repeat(70));
console.log('§1.2.3 判定示例表 —— 全 10 例（7 无效 + 3 有效）');
console.log('='.repeat(70));

// 表中 10 例：[标签, AST 构造器, 期望判定, 表中归约结果列]
const TABLE = [
  ['(1*2)/((1/3)/4)',  () => b('/', b('*', n(1), n(2)), b('/', r(3), n(4))),                 '无效', '1*2*4*3'],
  ['(3-2)/((1/4)/6)',  () => b('/', b('-', n(3), n(2)), b('/', r(4), n(6))),                 '无效', '(3-2)*6*4'],
  ['(8-4)/((1/6)/1)',  () => b('/', b('-', n(8), n(4)), b('/', r(6), n(1))),                 '无效', '(8-4)*1*6'],
  ['(5*5)-(5*(1/5))',  () => b('-', b('*', n(5), n(5)), b('*', n(5), r(5))),                 '无效', '(5*5)-(5/5)'],
  ['7*(3+(3*(1/7)))',  () => b('*', n(7), b('+', n(3), b('*', n(3), r(7)))),                 '无效', '7*(3+(3/7))'],
  ['((1/2)*8)+(4*5)',  () => b('+', b('*', r(2), n(8)), b('*', n(4), n(5))),                 '无效', '(8/2)+(4*5)'],
  ['(2*6)+(3/(1/4))',  () => b('+', b('*', n(2), n(6)), b('/', n(3), r(4))),                 '无效', '(2*6)+(3*4)'],
  ['(3*6)/(1-(1/4))',  () => b('/', b('*', n(3), n(6)), b('-', n(1), r(4))),                 '有效', '不变'],
  ['(8*8)/(3-(1/3))',  () => b('/', b('*', n(8), n(8)), b('-', n(3), r(3))),                 '有效', '不变'],
  ['(1+(1/5))*(2*10)', () => b('*', b('+', n(1), r(5)), b('*', n(2), n(10))),                '有效', '((1+(1/5))*2)*10'],
];

let tblInvalid = 0, tblValid = 0;
for (const [label, mk, expect, reduceCol] of TABLE) {
  slotSeq = 0;
  const ast = mk();
  const before = countRecip(ast);
  const rr = reduceToFixpoint(ast);
  const after = countRecip(rr.node);
  const verdict = after > 0 ? '有效' : '无效';
  const ok = verdict === expect;
  if (expect === '无效') tblInvalid++; else tblValid++;
  ck(`${label.padEnd(20)} → ${verdict}(期望${expect})`, ok,
     `recip ${before}→${after} iters=${rr.iters} 归约=${render(rr.node)} [表:${reduceCol}]`);
  // 归约必须保值（等价变换的正确性证明）
  const v0 = evalNode(ast), v1 = evalNode(rr.node);
  ck(`  ${label} 归约保值`, !!v0 && !!v1 && v0.n === v1.n && v0.d === v1.d,
     `${v0 ? v0.n + '/' + v0.d : 'null'} == ${v1 ? v1.n + '/' + v1.d : 'null'}`);
  // 表中每例均须 = 24（否则示例本身不是解）
  ck(`  ${label} 值=24`, is24F(v0), v0 ? `${v0.n}/${v0.d}` : 'null');
  // 迭代上限保护未触发
  ck(`  ${label} iters ${rr.iters} < MAX_ITER=${MAX_ITER} 且未 overflow`, rr.iters < MAX_ITER && !rr.overflow);
}
ck(`表内无效例共 ${tblInvalid} 条 = 7`, tblInvalid === 7);
ck(`表内有效例共 ${tblValid} 条 = 3`, tblValid === 3);

console.log('\n' + '='.repeat(70));
console.log('R-11② (8-4)*6 与 (8-4)/(1/6) 归并 1 条且 usedRecip=false');
console.log('='.repeat(70));
slotSeq = 0; const plain = b('*', b('-', n(8), n(4)), n(6));
slotSeq = 0; const viaRecip = b('/', b('-', n(8), n(4)), r(6));
const rp = reduceToFixpoint(plain), rv = reduceToFixpoint(viaRecip);
ck('(8-4)*6 usedRecip=false', countRecip(rp.node) === 0);
ck('(8-4)/(1/6) 归约后 usedRecip=false', countRecip(rv.node) === 0, render(rv.node));
ck('两者规范键相同（归并 1 条）', keySol(rp.node) === keySol(rv.node), `${keySol(rp.node)} == ${keySol(rv.node)}`);
const vp = evalNode(plain), vv = evalNode(viaRecip);
ck('两者值相同且=24', vp.n === vv.n && vp.d === vv.d && is24F(vp));

console.log('\n' + '='.repeat(70));
console.log('R-11③ 归约不动点 + 迭代上限保护');
console.log('='.repeat(70));
// 二次归约必须无变化（不动点性质）
let fixOk = 0;
for (const [label, mk] of TABLE) {
  slotSeq = 0;
  const once = reduceToFixpoint(mk()).node;
  const twice = reduceToFixpoint(once).node;
  if (keySol(once) === keySol(twice)) fixOk++;
}
ck(`10 例二次归约均不变（不动点）`, fixOk === 10, `${fixOk}/10`);
ck(`MAX_ITER 常量存在且=30`, MAX_ITER === 30);
// 深层嵌套倒数链：极限压力（4 层 recip 全在乘除链）
slotSeq = 0;
const deep = b('/', b('/', b('/', r(2), r(3)), r(4)), r(5));
const rd = reduceToFixpoint(deep);
ck('深层 4 recip 乘除链全消去', countRecip(rd.node) === 0, `iters=${rd.iters} → ${render(rd.node)}`);
ck('深层用例未触发 overflow', !rd.overflow && rd.iters < MAX_ITER, `iters=${rd.iters}`);

console.log('\n' + '='.repeat(70));
console.log('R-11④ 有效倒数解基准 + R-11⑤ 恒 0 正例');
console.log('='.repeat(70));
// ================================================================
// ============ R-11④ 数值断言：已恢复为硬断言（task-68）============
// 依据：项目主 2026-08-04 10:49 四项去重口径裁定（全 A）
//       + task-67 「171-INPUT06-去重口径规范-定稿.md」§6 全量基准
//
// 历史：09efb3d 曾将本组 8 个硬断言降为「仅打印观测值」，因当时旧期望值
//       （48/34/30/17/16/10/5/3）已被证伪且新口径未裁定 —— 让 selftest 绿在
//       错误答案上比红灯更危险。现数字有**权威来源**（task-67 规范 §6，
//       且与 INPUT-05 线上已验收 solver 12/14 外部互证），故恢复硬断言。
//
// 双列断言（初级 primary / 高级 advanced），不再只盯 advanced。
// 完整双向判据（正向 12 组等价类 + 反向 7 组防过度合并）见
// selftest/selftest_input06_dedup.mjs；外部第三方判据见
// tools/verify/verify-task68-external.mjs。
// ================================================================
const BASE = [
  // [cards, primary, advanced] —— 规范 §6 全量基准表
  [[1, 2, 3, 4], 3, 4], [[2, 3, 4, 6], 10, 10], [[1, 3, 4, 6], 1, 4],
  [[3, 3, 8, 8], 1, 7], [[1, 2, 5, 10], 2, 1], [[1, 1, 3, 8], 1, 0],
  [[1, 4, 6, 8], 3, 1], [[2, 4, 5, 8], 7, 3], [[1, 5, 5, 5], 1, 1],
];
for (const [deck, ep, ea] of BASE) {
  const res = solve(deck);
  ck(`${JSON.stringify(deck).padEnd(14)} 初级=${ep} 高级=${ea}`,
     res.counts.primary === ep && res.counts.advanced === ea,
     `实测 P=${res.counts.primary} A=${res.counts.advanced} rawCancel=${res.counts.cancelledRaw}`);
}
const ZERO = [[5, 5, 5, 5], [1, 1, 2, 9], [3, 3, 7, 7], [4, 4, 7, 7], [3, 3, 3, 5]];
for (const deck of ZERO) {
  const res = solve(deck);
  ck(`${JSON.stringify(deck).padEnd(14)} advanced=0 且不报错`, res.counts.advanced === 0,
     `P=${res.counts.primary} rawCancel=${res.counts.cancelledRaw}`);
}

console.log('\n' + '='.repeat(70));
console.log('§1.4 排序确定性（3 级全序）');
console.log('='.repeat(70));
const s1 = sortSolutions(['(1+(1/5))×(2×10)', '((13-1)×(8÷4))', '1×2', '(3×6)÷(1-(1/4))']);
const s2 = sortSolutions(['(3×6)÷(1-(1/4))', '1×2', '(1+(1/5))×(2×10)', '((13-1)×(8÷4))']);
ck('打乱输入排序结果一致（可复现）', JSON.stringify(s1) === JSON.stringify(s2));
ck('长度升序为第一优先', s1[0].length <= s1[1].length && s1[1].length <= s1[2].length);
ck('countAdvSymbols("(1+(1/5))×2")=1', countAdvSymbols('(1+(1/5))×2') === 1);
ck('countAdvSymbols 无倒数=0', countAdvSymbols('((13-1)×(8÷4))') === 0);
// 同长度时高级符号数升序（两串长度必须相等才能测第二优先级）
const A_ = '(8-4)*(1/2)+9';   // 13 字符，1 个 (1/
const B_ = '(8-4)*(6+0)+9';   // 13 字符，0 个 (1/
ck(`测例同长 ${A_.length}==${B_.length}`, A_.length === B_.length);
const sameLen = sortSolutions([A_, B_]);
ck('同长度按高级符号数升序', countAdvSymbols(sameLen[0]) < countAdvSymbols(sameLen[1]),
   `${sameLen[0]}(adv=${countAdvSymbols(sameLen[0])}) 先于 ${sameLen[1]}(adv=${countAdvSymbols(sameLen[1])})`);

console.log('\n' + '='.repeat(70));
console.log('精确运算：禁浮点（叶子倒数产生无限循环小数）');
console.log('='.repeat(70));
// 1/3, 1/7 等浮点必然漏解的场景
const f13 = F(1, 3), f17 = F(1, 7);
ck('F(1,3) 精确 1/3', f13.n === 1n && f13.d === 3n);
ck('F(1,7) 精确 1/7', f17.n === 1n && f17.d === 7n);
// (8*8)/(3-(1/3)) = 64/(8/3) = 24 —— 浮点下 3-0.3333.. 有误差
slotSeq = 0;
const v883 = evalNode(b('/', b('*', n(8), n(8)), b('-', n(3), r(3))));
ck('(8*8)/(3-1/3) 精确=24', is24F(v883), `${v883.n}/${v883.d}`);
const fl = (8 * 8) / (3 - 1 / 3);
ck(`浮点 (8*8)/(3-1/3) = ${fl}（此例浮点恰好无损）`, fl === 24);
// ★ 真正的浮点漏解证据：取倒数差式（实测 138 副牌漏 219 条有效倒数解）
// 2/((1/3)-(1/4)) = 2/(1/12) = 24，但浮点下 = 24.000000000000007
const flA = 2 / (1 / 3 - 1 / 4);
ck(`浮点 2/((1/3)-(1/4)) = ${flA} !== 24`, flA !== 24, `diff=${Math.abs(flA - 24)}`);
slotSeq = 0;
const vA = evalNode(b('/', n(2), b('-', r(3), r(4))));
ck('Fraction 2/((1/3)-(1/4)) 精确=24', is24F(vA), `${vA.n}/${vA.d}`);
// 4/((1/2)-(1/3)) = 4/(1/6) = 24，浮点 = 23.999999999999996
const flB = 4 / (1 / 2 - 1 / 3);
ck(`浮点 4/((1/2)-(1/3)) = ${flB} !== 24`, flB !== 24, `diff=${Math.abs(flB - 24)}`);
slotSeq = 0;
const vB = evalNode(b('/', n(4), b('-', r(2), r(3))));
ck('Fraction 4/((1/2)-(1/3)) 精确=24', is24F(vB), `${vB.n}/${vB.d}`);
// (8-3)/((1/3)-(1/8)) = 5/(5/24) = 24，浮点 = 24.000000000000004
const flC = (8 - 3) / (1 / 3 - 1 / 8);
ck(`浮点 (8-3)/((1/3)-(1/8)) = ${flC} !== 24`, flC !== 24, `diff=${Math.abs(flC - 24)}`);
slotSeq = 0;
const vC = evalNode(b('/', b('-', n(8), n(3)), b('-', r(3), r(8))));
ck('Fraction (8-3)/((1/3)-(1/8)) 精确=24', is24F(vC), `${vC.n}/${vC.d}`);
ck('结论：若用 float===24，上述 3 条均会被漏掉 → 必须 Fraction',
   flA !== 24 && flB !== 24 && flC !== 24 && is24F(vA) && is24F(vB) && is24F(vC));
// 7*(3+(3*(1/7))) = 7*(3+3/7) = 24
slotSeq = 0;
const v737 = evalNode(b('*', n(7), b('+', n(3), b('*', n(3), r(7)))));
ck('7*(3+3*(1/7)) 精确=24', is24F(v737), `${v737.n}/${v737.d}`);

console.log('\n' + '='.repeat(70));
console.log(`RESULT: pass=${pass} fail=${fail}`);
if (fail > 0) { console.log('FAILED: ' + bad.join(' | ')); process.exit(1); }
console.log('ALL PASS');
console.log('='.repeat(70));
process.exit(0);
