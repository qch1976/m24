// selftest_task136_caps_invariant.mjs — task-136 引擎侧 caps 不变式校验 自测
//
// 🔴 存在理由：变异测试 M1（把 isOpen 的 pow/log 从 `=== true` 改成 `!== false`，
//   即破坏 INPUT-08 §10.1 的有意不对称）在 tester 的 59 条断言下**未判红**。
//   逐条查因：那 59 条里 pow/log 只出现「显式 false」与「显式 true(ALL_ON)」两种，
//   **没有「caps 已传、但 pow/log 键缺省」的用例** ⇒ 属判据覆盖缺口，非等价变异。
//   我不得改 tester/（零容忍），故在此补齐该维度，锁住 §10.1 不对称。
//
// 运行：node selftest/selftest_task136_caps_invariant.mjs
import { checkUserAnswer, ERR } from '../js/core/RecipParser.mjs';

let pass = 0, fail = 0;
const ck = (name, cond, detail) => {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name} — ${detail}`); }
};
const N = (i) => ({ type: 'number', cardIndex: i });
const op = (v) => ({ type: 'operator', value: v });
// 2^3*3*1 = 24（幂参与且结果恰为 24 ⇒ pass=true 只能解释为「没拦」，无两义）
const POW24 = () => [N(0), { type: 'pow' }, N(1), op('*'), N(2), op('*'), N(3)];
const PC = [2, 3, 3, 1];
// 2log8*4*2 = 3*4*2 = 24
const LOG24 = () => [N(0), { type: 'log' }, N(1), op('*'), N(2), op('*'), N(3)];
const LC = [2, 8, 4, 2];
const R = (tk, cv, o) => checkUserAnswer(tk, cv, o);

console.log('--- ① 存在性前置：caps 全开时两式确实成立 24（否则下方判据会因「本来就不通过」假绿）---');
const onAll = { advancedCalc: true, caps: { recip: true, fact: true, mod: true, pow: true, log: true } };
ck('①a caps 全开 ⇒ 2^3*3*1 判 24', R(POW24(), PC, onAll).pass === true, 'pass≠true');
ck('①b caps 全开 ⇒ 2log8*4*2 判 24', R(LOG24(), LC, onAll).pass === true, 'pass≠true');

console.log('--- ② 🔴 §10.1 不对称：caps 已传但 pow/log 键【缺省】⇒ 必须视为关（=== true 才开）---');
//   这一维度是 tester 59 条的盲区；M1 变异正是从此处溜过去的。
const noPow = { advancedCalc: true, caps: { recip: true, fact: true, mod: true } };
const rp = R(POW24(), PC, noPow);
ck('②a pow 键缺省 ⇒ 拒收', rp.pass === false, `pass=${rp.pass}`);
ck('②b pow 键缺省 ⇒ reason=advanced_disabled', rp.reason === ERR.ADVANCED_DISABLED, `reason=${rp.reason}`);
const rl = R(LOG24(), LC, noPow);
ck('②c log 键缺省 ⇒ 拒收', rl.pass === false, `pass=${rl.pass}`);
ck('②d pow:undefined 显式传 ⇒ 同样拒收',
  R(POW24(), PC, { advancedCalc: true, caps: { pow: undefined, log: undefined } }).pass === false, '未拒收');

console.log('--- ③ 反向不对称：recip/fact/mod 键缺省 ⇒ 缺省即开（!== false）---');
const noRecipKey = { advancedCalc: true, caps: { pow: true, log: true } };
ck('③a recip 键缺省（caps 已传）⇒ 仍放行',
  R([{ type: 'recip' }, N(0), op('*'), N(1), op('*'), N(2), op('*'), N(3)], [1, 4, 3, 2], noRecipKey).pass === true,
  '被误拦');

console.log('--- ④ 平铺与嵌套两形态都必须认 ---');
ck('④a 平铺 capPow:false ⇒ 拒收', R(POW24(), PC, { advancedCalc: true, capPow: false }).pass === false, '未拦');
ck('④b 嵌套 caps.pow:false ⇒ 拒收', R(POW24(), PC, { advancedCalc: true, caps: { pow: false } }).pass === false, '未拦');
ck('④c 平铺 capLog:false ⇒ 拒收', R(LOG24(), LC, { advancedCalc: true, capLog: false }).pass === false, '未拦');
ck('④d 嵌套 caps.log:false ⇒ 拒收', R(LOG24(), LC, { advancedCalc: true, caps: { log: false } }).pass === false, '未拦');
ck('④e 平铺优先于嵌套（capPow:true 覆盖 caps.pow:false）',
  R(POW24(), PC, { advancedCalc: true, capPow: true, caps: { pow: false } }).pass === true, '平铺未生效');

console.log('--- ⑤ 🔴 未传任何 caps ⇒ 整体跳过校验，行为与改动前逐位一致 ---');
//   现调用点 PageRenderer:741 只传 advancedCalc；本校验不得改变其行为，否则打爆既有 51 条。
ck('⑤a 仅 advancedCalc:true + 幂 ⇒ 照常判 24', R(POW24(), PC, { advancedCalc: true }).pass === true, '被误拦');
ck('⑤b 仅 advancedCalc:true + 对数 ⇒ 照常判 24', R(LOG24(), LC, { advancedCalc: true }).pass === true, '被误拦');
ck('⑤c opts 全缺省 + 纯四则 ⇒ 照常判 24',
  R([N(0), op('*'), N(1), op('*'), N(2), op('*'), N(3)], [2, 3, 4, 1], undefined).pass === true, '被误拦');

console.log('--- ⑥ 主开关优先级：advancedCalc=false 时仍走主开关文案（不被 caps 码顶替）---');
const off = R(POW24(), PC, { advancedCalc: false, capPow: true });
ck('⑥a advancedCalc=false ⇒ reason=unexpected_token', off.reason === ERR.UNEXPECTED_TOKEN, `reason=${off.reason}`);
ck('⑥b 文案含「高级」（V-5.2 耦合点，改文案会打红既有断言）', /高级/.test(off.message || ''), `msg=${off.message}`);

// 推导：① 2 + ② 4 + ③ 1 + ④ 5 + ⑤ 3 + ⑥ 2 = 17
const EXPECTED = 17;
console.log(`\nT136 CAPS INVARIANT: pass=${pass} fail=${fail}`);
if (pass + fail !== EXPECTED) {
  console.log(`  ✗ 断言总数 ${pass + fail} ≠ 期望 ${EXPECTED}（防 early-return 吞断言）`);
  process.exit(1);
}
console.log(fail === 0 ? 'OVERALL: PASS ✅' : 'OVERALL: FAIL ❌');
process.exit(fail === 0 ? 0 : 1);
