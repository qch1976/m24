// tester-input06-r08.mjs — R-08 解析器 + 用户答题判定独立采样（task-65）
// 要求：合法倒数 ≥2 + 非法倒数拒绝 ≥2 + 冗余括号合法 ≥2 + 1/1 不计高级 ≥1，总 ≥7

import { parse, evalAst, checkUserAnswer, ERR } from '../js/core/RecipParser.mjs';
import { countRecip } from '../js/core/RecipSolver.mjs';
import { mkCounter, Q, qs, is24, evalQ, parseExpr } from './tester-input06-lib.mjs';

const { ck, done, st } = mkCounter('R-08');   // st: D-0 自断言需读 st.pass+st.fail（方案 B，不动共享 harness）
console.log('tester-input06-r08.mjs  @ ' + new Date().toISOString());

// token 构造器（沿用 AnswerArea.TokenType 口径）
const N = (i) => ({ type: 'number', cardIndex: i });
const O = (v) => ({ type: 'operator', value: v });
const L = () => ({ type: 'left_paren' });
const R = () => ({ type: 'right_paren' });
const RC = () => ({ type: 'recip' });

// ============================================================
// A · 合法倒数 ≥2 条
// ============================================================
console.log('\n' + '='.repeat(70));
console.log('A · 合法倒数（≥2 条）');
console.log('='.repeat(70));
// A1: (3*6)/(1-1/4)  cards=[3,6,1,4]  期望 = 24
{
  const cv = [3, 6, 1, 4];
  const ts = [L(), N(0), O('*'), N(1), R(), O('/'), L(), N(2), O('-'), RC(), N(3), R()];
  const r = checkUserAnswer(ts, cv, { advancedCalc: true });
  ck('A1 (3×6)÷(1-1/4) parse 通过且判 = 24', r.pass === true, JSON.stringify({ pass: r.pass, reason: r.reason, usedRecip: r.usedRecip }));
  ck('A1 usedRecip = true', r.usedRecip === true);
  const my = evalQ(parseExpr('((3×6)÷(1-(1/4)))'));
  ck('A1 独立复算 = 24', is24(my), qs(my));
}
// A2: (8*8)/(3-1/3)  cards=[8,8,3,3]
{
  const cv = [8, 8, 3, 3];
  const ts = [L(), N(0), O('*'), N(1), R(), O('/'), L(), N(2), O('-'), RC(), N(3), R()];
  const r = checkUserAnswer(ts, cv, { advancedCalc: true });
  ck('A2 (8×8)÷(3-1/3) 判 = 24', r.pass === true, JSON.stringify({ pass: r.pass, reason: r.reason }));
  const my = evalQ(parseExpr('((8×8)÷(3-(1/3)))'));
  ck('A2 独立复算 = 24', is24(my), qs(my));
}
// A3: (1+1/5)*(2*10)  cards=[1,5,2,10]
{
  const cv = [1, 5, 2, 10];
  const ts = [L(), N(0), O('+'), RC(), N(1), R(), O('*'), L(), N(2), O('*'), N(3), R()];
  const r = checkUserAnswer(ts, cv, { advancedCalc: true });
  ck('A3 (1+1/5)×(2×10) 判 = 24', r.pass === true, JSON.stringify({ pass: r.pass, reason: r.reason }));
  ck('A3 usedRecip = true', r.usedRecip === true);
}

// ============================================================
// B · 非法倒数拒绝 ≥2 条（红灯项）
// ============================================================
console.log('\n' + '='.repeat(70));
console.log('B · 非法倒数拒绝（红灯：1/x 子节点必须是叶子）');
console.log('='.repeat(70));
// B1: 1/(1-3/4)  → recip 作用于 (1-3/4) 中间结果
{
  const cv = [1, 3, 4, 6];
  const ts = [RC(), L(), N(0), O('-'), N(1), O('/'), N(2), R()];
  const p = parse(ts, cv);
  ck('B1 1/(1-3÷4) parse 被拒', p.ok === false, JSON.stringify({ ok: p.ok, error: p.error, msg: p.message }));
  ck('B1 错误码 = recip_operand_not_leaf', p.error === ERR.RECIP_OPERAND_NOT_LEAF, `实际 ${p.error}`);
  const r = checkUserAnswer(ts, cv, { advancedCalc: true });
  ck('B1 checkUserAnswer 判 invalid', r.pass === false && r.invalid === true, JSON.stringify({ pass: r.pass, reason: r.reason }));
}
// B2: 1/((6-4)/8)
{
  const cv = [6, 4, 8, 2];
  const ts = [RC(), L(), L(), N(0), O('-'), N(1), R(), O('/'), N(2), R()];
  const p = parse(ts, cv);
  ck('B2 1/((6-4)÷8) parse 被拒', p.ok === false, JSON.stringify({ ok: p.ok, error: p.error }));
  ck('B2 错误码 = recip_operand_not_leaf', p.error === ERR.RECIP_OPERAND_NOT_LEAF, `实际 ${p.error}`);
}
// B3: 1/(2+3) — 加法中间值
{
  const cv = [2, 3, 4, 5];
  const ts = [RC(), L(), N(0), O('+'), N(1), R()];
  const p = parse(ts, cv);
  ck('B3 1/(2+3) parse 被拒', p.ok === false, JSON.stringify({ error: p.error }));
  ck('B3 错误码 = recip_operand_not_leaf', p.error === ERR.RECIP_OPERAND_NOT_LEAF, `实际 ${p.error}`);
}
// B4: 1/ 后面接运算符（悬挂）
{
  const cv = [2, 3, 4, 5];
  const ts = [RC(), O('+'), N(0)];
  const p = parse(ts, cv);
  ck('B4 1/ 后接运算符 被拒', p.ok === false, JSON.stringify({ error: p.error }));
  ck('B4 错误码 = recip_dangling', p.error === ERR.RECIP_DANGLING, `实际 ${p.error}`);
}
// B5: 1/ 结尾（悬挂）
{
  const cv = [2, 3, 4, 5];
  const p = parse([RC()], cv);
  ck('B5 仅一个 1/ token 被拒', p.ok === false, JSON.stringify({ error: p.error }));
}

// ============================================================
// C · 冗余括号不误伤 ≥2 条
// ============================================================
console.log('\n' + '='.repeat(70));
console.log('C · 冗余括号不误伤');
console.log('='.repeat(70));
// C1: 1/(3)
{
  const cv = [3, 6, 1, 4];
  const p = parse([RC(), L(), N(0), R()], cv);
  ck('C1 1/(3) parse 通过', p.ok === true, JSON.stringify({ ok: p.ok, error: p.error }));
  if (p.ok) {
    const ev = evalAst(p.ast);
    ck('C1 1/(3) 求值 = 1/3', ev.ok && ev.value.n === 1n && ev.value.d === 3n, ev.ok ? `${ev.value.n}/${ev.value.d}` : ev.error);
  }
}
// C2: 1/((3))
{
  const cv = [3, 6, 1, 4];
  const p = parse([RC(), L(), L(), N(0), R(), R()], cv);
  ck('C2 1/((3)) parse 通过', p.ok === true, JSON.stringify({ ok: p.ok, error: p.error }));
  if (p.ok) {
    const ev = evalAst(p.ast);
    ck('C2 1/((3)) 求值 = 1/3', ev.ok && ev.value.n === 1n && ev.value.d === 3n);
  }
}
// C3: 1/(((4))) 三层
{
  const cv = [4, 6, 1, 3];
  const p = parse([RC(), L(), L(), L(), N(0), R(), R(), R()], cv);
  ck('C3 1/(((4))) parse 通过（3 层冗余括号）', p.ok === true, JSON.stringify({ error: p.error }));
  if (p.ok) { const ev = evalAst(p.ast); ck('C3 求值 = 1/4', ev.ok && ev.value.n === 1n && ev.value.d === 4n); }
}
// C4: 冗余括号在完整式中不影响判定 —— (3*6)/(1-1/(4)) = 24
{
  const cv = [3, 6, 1, 4];
  const ts = [L(), N(0), O('*'), N(1), R(), O('/'), L(), N(2), O('-'), RC(), L(), N(3), R(), R()];
  const r = checkUserAnswer(ts, cv, { advancedCalc: true });
  ck('C4 (3×6)÷(1-1/(4)) 判 = 24（冗余括号不误伤完整式）', r.pass === true, JSON.stringify({ pass: r.pass, reason: r.reason }));
}

// ============================================================
// D · 1/1 不计高级 ≥1 条
// ============================================================
console.log('\n' + '='.repeat(70));
console.log('D · 1/1 恒等：可输入但不计高级');
console.log('='.repeat(70));
// D1: (1/1)*(4*2*3)  cards=[1,4,2,3] → 24
{
  const cv = [1, 4, 2, 3];
  const ts = [RC(), N(0), O('*'), L(), N(1), O('*'), L(), N(2), O('*'), N(3), R(), R()];
  const r = checkUserAnswer(ts, cv, { advancedCalc: true });
  ck('D1 (1/1)×(4×(2×3)) parse 通过且 = 24', r.pass === true, JSON.stringify({ pass: r.pass, reason: r.reason }));
  ck('D1 usedRecip = false（1/1 不算用了高级符号）', r.usedRecip === false, `usedRecip=${r.usedRecip}`);
  const p = parse(ts, cv);
  ck('D1 countRecip(ast) = 0', p.ok && countRecip(p.ast) === 0, p.ok ? String(countRecip(p.ast)) : p.error);
}
// D2: 单纯 1/1 的 AST 层 countRecip
{
  const cv = [1, 2, 3, 4];
  const p = parse([RC(), N(0)], cv);
  ck('D2 1/1 单独 parse 通过', p.ok === true, p.ok ? '' : p.error);
  ck('D2 1/1 countRecip = 0', p.ok && countRecip(p.ast) === 0);
}

// ============================================================
// E · 开关关闭时禁 recip token
// ============================================================
console.log('\n' + '='.repeat(70));
console.log('E · advancedCalc=false 时 recip token 被拒');
console.log('='.repeat(70));
{
  const cv = [3, 6, 1, 4];
  const ts = [L(), N(0), O('*'), N(1), R(), O('/'), L(), N(2), O('-'), RC(), N(3), R()];
  const rOff = checkUserAnswer(ts, cv, { advancedCalc: false });
  ck('E1 关闭时含 recip → 拒绝', rOff.pass === false, JSON.stringify({ pass: rOff.pass, reason: rOff.reason, msg: rOff.message }));
  ck('E1 提示文案含「高级计算」', /高级计算/.test(rOff.message || ''), rOff.message);
  // 纯初级式在关闭时仍通过：(3-1)*(6*... 用 cards [3,6,1,4] 不好构造，改 [1,3,4,6]: (3*4)/(1-... 需 recip
  const cv2 = [8, 3, 8, 3];
  // 8/(3-8/3) = 24
  const ts2 = [N(0), O('/'), L(), N(1), O('-'), N(2), O('/'), N(3), R()];
  const r2 = checkUserAnswer(ts2, cv2, { advancedCalc: false });
  ck('E2 关闭时纯初级式 8÷(3-8÷3) 仍判 = 24（INPUT-05 行为兼容）', r2.pass === true, JSON.stringify({ pass: r2.pass, reason: r2.reason }));
}

// ============================================================
// F · 其他既有约束回归（4 张牌各用 1 次 / 除零 / 括号不匹配）
// ============================================================
console.log('\n' + '='.repeat(70));
console.log('F · 既有约束回归');
console.log('='.repeat(70));
{
  const cv = [3, 6, 1, 4];
  // 只用 3 张
  const r3 = checkUserAnswer([N(0), O('*'), N(1), O('+'), N(2)], cv, { advancedCalc: true });
  ck('F1 只用 3 张牌 → card_reused', r3.pass === false && r3.reason === ERR.CARD_REUSED, JSON.stringify({ reason: r3.reason }));
  // 重复用同一张
  const r4 = checkUserAnswer([N(0), O('*'), N(0), O('*'), N(1), O('*'), N(2)], cv, { advancedCalc: true });
  ck('F2 重复用同一张 → card_reused', r4.pass === false && r4.reason === ERR.CARD_REUSED, JSON.stringify({ reason: r4.reason }));
  // 除零（大小王 0）
  const cv0 = [8, 0, 3, 3];
  const r5 = checkUserAnswer([N(0), O('/'), N(1), O('+'), N(2), O('+'), N(3)], cv0, { advancedCalc: true });
  ck('F3 8÷0 → division_by_zero', r5.pass === false && r5.reason === ERR.DIVISION_BY_ZERO, JSON.stringify({ reason: r5.reason }));
  // 1/0（大小王倒数）
  const r6 = checkUserAnswer([RC(), N(1), O('+'), N(0), O('+'), N(2), O('+'), N(3)], cv0, { advancedCalc: true });
  ck('F4 1/0（大小王倒数）→ 报除零而非崩溃', r6.pass === false && r6.reason === ERR.DIVISION_BY_ZERO, JSON.stringify({ reason: r6.reason }));
  // 括号不匹配
  const r7 = parse([L(), N(0), O('*'), N(1)], cv);
  ck('F5 缺右括号 → paren_mismatch', r7.ok === false && r7.error === ERR.PAREN_MISMATCH, JSON.stringify({ error: r7.error }));
  // 空输入
  const r8 = parse([], cv);
  ck('F6 空输入 → empty', r8.ok === false && r8.error === ERR.EMPTY);
  // 合法但 ≠ 24
  const r9 = checkUserAnswer([N(0), O('+'), N(1), O('+'), N(2), O('+'), N(3)], cv, { advancedCalc: true });
  ck('F7 3+6+1+4=14 → not_24 且回显 14', r9.pass === false && r9.reason === 'not_24' && r9.actualLabel === '14', JSON.stringify({ reason: r9.reason, label: r9.actualLabel }));
  // 分数结果回显
  const r10 = checkUserAnswer([RC(), N(3), O('+'), N(0), O('+'), N(1), O('+'), N(2)], cv, { advancedCalc: true });
  ck('F8 1/4+3+6+1 = 41/4 分数回显', r10.pass === false && r10.reason === 'not_24' && r10.actualLabel === '41/4', JSON.stringify({ label: r10.actualLabel }));
}

console.log('\n用例计数：合法倒数 3 / 非法拒绝 5 / 冗余括号 4 / 1/1 2 / 开关 2 / 既有约束 8 = 24 组');
// ── D-0：断言总数自断言（task-131 第 3 批 E 类，方案 (B)）──
// 目的：捕获「断言静默退场」—— 断言不再执行时，仅看 fail=0 无法察觉。
// 🔴 与其余 6 支写法差异的原因（经理已批方案 (B)）：
//     本支用共享 harness `tester-input06-lib.mjs:207 mkCounter()`，不自建计数器。
//     该 harness 被 6 支共用（r04/r05/r08/r10/r11/regression），其中 r04/r11 属 B 类崩溃支、
//     根因未定；改 harness 的 done(expected) 会连带扰动它们，超出本批 8 支授权范围。
//     故改用 mkCounter 已导出的 `st` 自行计算（st.pass + st.fail）。
// 🔴 基数必可推导、禁裸数字；只算【业务断言】不含 D-0 自己；D-0 计入 pass ⇒ `pass=N+1`。
// 🔴 C 族含 3 条【条件断言】（:110 :120 :130 的 `if (p.ok)`）：若 parse 退化为失败，
//     这 3 条会静默少跑。故下方加存在性前置：先断言三个冗余括号用例均 parse 成功，
//     否则先报前置失败（而不是让 D-0 拿一个“已经变小”的基数去对）。
// 🔴 前置用例须与 :108/:118/:128 完全同构（token 数组 + cv），不能另写一套：
//     此前我误用 Q('1/(3)')，Q 实为分数构造器（Q(n,d)）而非表达式解析器，
//     直接 SyntaxError: Cannot convert 1/(3) to a BigInt。已改为同样的 token 构造。
const _c1ok = parse([RC(), L(), N(0), R()], [3, 6, 1, 4]).ok;
const _c2ok = parse([RC(), L(), L(), N(0), R(), R()], [3, 6, 1, 4]).ok;
const _c3ok = parse([RC(), L(), L(), L(), N(0), R(), R(), R()], [4, 6, 1, 3]).ok;
const _condC = (_c1ok ? 1 : 0) + (_c2ok ? 1 : 0) + (_c3ok ? 1 : 0);
const EXPECTED = {
  A: 7,              // A1~A3 合法倒数完整式（:29-49）
  B: 10,             // B1~B5 非叶子/悬空倒数拒绝 + 错误码（:63-96）
  Cstatic: 4,        // C1/C2/C3 parse 通过 3 条（:109 :119 :129）+ C4 完整式（:137）
  Ccond: _condC,     // :112 :122 :130 条件断言（仅当各自 parse 成功时执行）
  D: 5,              // D1/D2  1/1 不计 usedRecip + countRecip=0（:151-161）
  E: 3,              // E1/E2 advancedCalc 开关（:174 起）
  F: 8,              // F1~F8 既有约束不回退
};
const EXPECTED_ASSERTION_COUNT = Object.values(EXPECTED).reduce((s, n) => s + n, 0);
console.log('\n=== D-0：断言总数自断言 ===');
if (_condC !== 3) {
  ck('D-0 存在性前置：C 族 3 个冗余括号用例均 parse 成功', false,
     `🔴 实际成功 ${_condC}/3（C1=${_c1ok} C2=${_c2ok} C3=${_c3ok}）⇒ 条件断言静默退场`);
}
ck(`D-0 断言总数自断言 — 实测总数=${st.pass + st.fail} 期望=${EXPECTED_ASSERTION_COUNT}`,
   st.pass + st.fail === EXPECTED_ASSERTION_COUNT,
   st.pass + st.fail === EXPECTED_ASSERTION_COUNT ? '' :
     `分族期望=${JSON.stringify(EXPECTED)} ⇒ 有断言静默退场或新增未同步 EXPECTED`);

const ok = done();
process.exit(ok ? 0 : 1);
