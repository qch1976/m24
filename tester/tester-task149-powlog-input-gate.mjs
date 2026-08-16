// tester/tester-task149-powlog-input-gate.mjs
// task-149：pow / log / 开方（^^）输入侧测试门禁（项目主 2026-08-16 10:03 批准 D 项）
// 依据：INPUT-08.1（pow/log/开方输入侧）+ INPUT-08 §1.2/§3.3
//
// 🔴 入参形状取值来源（禁凭命名猜，task-149 硬约束 1）：
//   js/core/RecipParser.js:328  export function parse(tokens, cardValues)   ← 收 token 数组
//   js/core/RecipParser.js:410  export function checkUserAnswer(tokens, cardValues, opts)
//   :117-121 token 注释【未列 pow/log】（文档滞后）⇒ 形状以实现 :173 为准：
//       { type:'pow' }  { type:'log' }   —— log 是【中缀】：[底, log, 真数]
//       第二个连续 'pow' ⇒ 开方（rootIdx），见 :180-183
//   🔴 错误码一律引用产品 ERR 常量（:22-29），禁自造字面量。
//
// 🔴 caps 语义不对称（:439 现取，非我推断）：
//   pow/log 用 capRaw(k) === true（缺省=关不住，须显式 true 才算开）
//   其余     用 capRaw(k) !== false
// 🔴 :418 现取：主开关关 ⇒ reason 用 UNEXPECTED_TOKEN 码，但 message 为「请先开启高级计算」
//   ⇒ 断言须同时验 message，只验 reason 会与语法错混淆。

import * as RP from '../js/core/RecipParser.mjs';

const N = (i) => ({ type: 'number', cardIndex: i });
const POW = { type: 'pow' };
const LOG = { type: 'log' };
const OP = (v) => ({ type: 'operator', value: v });

let pass = 0, fail = 0;
const t = (name, cond, got) => {
  if (cond) { pass++; console.log(`  ok  ${name}`); }
  else { fail++; console.log(`  XX  ${name}  got=${JSON.stringify(got)}`); }
};

// ── 🔴 存在性前置：区分「取值失败」与「值不符」──
t('E-0a 产品导出 parse / checkUserAnswer / ERR 均可取到',
  typeof RP.parse === 'function' && typeof RP.checkUserAnswer === 'function' && !!RP.ERR,
  [typeof RP.parse, typeof RP.checkUserAnswer, !!RP.ERR]);
const E = RP.ERR;
t('E-0b 本支引用的 6 个错误码常量在产品 ERR 中均存在（禁自造字面量）',
  !!(E.POW_DANGLING && E.POW_CHAINED && E.LOG_DANGLING && E.LOG_DOMAIN && E.LOG_NOT_EXACT && E.ADVANCED_DISABLED),
  [E.POW_DANGLING, E.POW_CHAINED, E.LOG_DANGLING, E.LOG_DOMAIN, E.LOG_NOT_EXACT, E.ADVANCED_DISABLED]);

const okOf = (toks, cv) => RP.parse(toks, cv);

// ══════ 一、正例：pow / 开方 / log ══════
console.log('\n--- 一、正例（P-1~P-4）---');
{
  const r = okOf([N(0), POW, N(1)], [8, 3, 1, 1]);
  t('P-1 8^3 ⇒ ok=true op=pow v=512/1', r.ok && r.ast.op === 'pow' && r.ast.v.n === 512n && r.ast.v.d === 1n,
    r.ok ? [r.ast.op, String(r.ast.v.n) + '/' + String(r.ast.v.d)] : r.error);
  t('P-1r 🔴 反例：普通幂不得带 rootIdx（否则与开方混淆）', r.ok && r.ast.rootIdx === undefined, r.ok ? r.ast.rootIdx : r.error);
}
{
  const r = okOf([N(0), POW, POW, N(1)], [9, 2, 1, 1]);
  t('P-2 9^^2 开方 ⇒ ok=true op=pow rootIdx=2 v=3/1',
    r.ok && r.ast.op === 'pow' && r.ast.rootIdx === 2 && r.ast.v.n === 3n && r.ast.v.d === 1n,
    r.ok ? [r.ast.op, r.ast.rootIdx, String(r.ast.v.n) + '/' + String(r.ast.v.d)] : r.error);
  // 🔴 §3.1：开方走 rootIdx 专用字段，禁建 1/b 子树（建子树会让 R 位误标，INPUT-08 §1.2）
  t('P-2r 🔴 反例：开方不得建 recip 子树（b 须是 num 叶子）', r.ok && r.ast.b && r.ast.b.op === 'num', r.ok ? r.ast.b && r.ast.b.op : r.error);
}
{
  const r = okOf([N(0), LOG, N(1)], [2, 8, 1, 1]);
  t('P-3 log2(8) ⇒ ok=true op=log v=3/1', r.ok && r.ast.op === 'log' && r.ast.v.n === 3n && r.ast.v.d === 1n,
    r.ok ? [r.ast.op, String(r.ast.v.n) + '/' + String(r.ast.v.d)] : r.error);
}
{
  const r = okOf([N(0), LOG, N(1)], [3, 9, 1, 1]);
  t('P-4 log3(9) ⇒ ok=true op=log v=2/1', r.ok && r.ast.op === 'log' && r.ast.v.n === 2n && r.ast.v.d === 1n,
    r.ok ? [r.ast.op, String(r.ast.v.n) + '/' + String(r.ast.v.d)] : r.error);
}

// ══════ 二、反例：值域拒收（有产生式后才可能出现，判据三级③）══════
console.log('\n--- 二、LOG_NOT_EXACT（P-5/P-6）---');
{
  const r = okOf([N(0), LOG, N(1)], [2, 3, 1, 1]);
  t('P-5 log2(3) 无理 ⇒ ok=false err=LOG_NOT_EXACT', !r.ok && r.error === E.LOG_NOT_EXACT, r.ok ? 'ok=true' : r.error);
}
{
  // :225 现取：v.d !== 1n ⇒ LOG_NOT_EXACT。log4(8)=3/2 属「有理但非整数」，与 P-5 无理是不同分支
  const r = okOf([N(0), LOG, N(1)], [4, 8, 1, 1]);
  t('P-6 log4(8)=3/2 非整数 ⇒ ok=false err=LOG_NOT_EXACT', !r.ok && r.error === E.LOG_NOT_EXACT, r.ok ? 'ok=true' : r.error);
}

console.log('\n--- 三、LOG_DOMAIN（P-7，底≤1 / 真数≤0 各 1 例，:222 现取）---');
{
  const r = okOf([N(0), LOG, N(1)], [1, 8, 1, 1]);
  t('P-7a 底=1 ⇒ err=LOG_DOMAIN', !r.ok && r.error === E.LOG_DOMAIN, r.ok ? 'ok=true' : r.error);
}
{
  const r = okOf([N(0), LOG, N(1)], [2, 0, 1, 1]);
  t('P-7b 真数=0 ⇒ err=LOG_DOMAIN', !r.ok && r.error === E.LOG_DOMAIN, r.ok ? 'ok=true' : r.error);
}
{
  // 🔴 反例：合法底/真数不得误报 DOMAIN（防「一律拒绝」把 P-7 刷绿）
  const r = okOf([N(0), LOG, N(1)], [2, 8, 1, 1]);
  t('P-7r 🔴 反例：底=2 真数=8 合法 ⇒ 不得报 LOG_DOMAIN', r.ok && r.error !== E.LOG_DOMAIN, r.ok ? 'ok' : r.error);
}

console.log('\n--- 四、POW_CHAINED / DANGLING（P-8/P-9，:190-192 与 :175-176）---');
{
  const r = okOf([N(0), POW, N(1), POW, N(2)], [8, 3, 2, 1]);
  t('P-8 8^3^2 链式 ⇒ err=POW_CHAINED（非通用 trailing_token）', !r.ok && r.error === E.POW_CHAINED, r.ok ? 'ok=true' : r.error);
}
{
  const r = okOf([N(0), POW, POW, POW, N(1)], [9, 2, 1, 1]);
  t('P-8b 第三个 ^ ⇒ err=POW_DANGLING（:183 a^^^b）', !r.ok && r.error === E.POW_DANGLING, r.ok ? 'ok=true' : r.error);
}
{
  const r = okOf([N(0), POW], [8, 3, 1, 1]);
  t('P-9a pow 悬挂 8^ ⇒ err=POW_DANGLING', !r.ok && r.error === E.POW_DANGLING, r.ok ? 'ok=true' : r.error);
}
{
  const r = okOf([N(0), LOG], [2, 8, 1, 1]);
  t('P-9b log 悬挂 2log ⇒ err=LOG_DANGLING', !r.ok && r.error === E.LOG_DANGLING, r.ok ? 'ok=true' : r.error);
}
{
  // 🔴 反例：完整式不得报 DANGLING
  const r = okOf([N(0), POW, N(1)], [8, 3, 1, 1]);
  t('P-9r 🔴 反例：完整 8^3 不得报 POW_DANGLING', r.ok && r.error !== E.POW_DANGLING, r.ok ? 'ok' : r.error);
}

// ══════ 五、caps 联动（P-10，:414-442 现取）══════
// 🔴 用满 4 张牌，否则先撞 card_reused，测不到 caps 分支（本支实测踩坑）
console.log('\n--- 五、caps 联动（P-10，4 张牌避开 card_reused）---');
const powToks = [N(0), POW, N(1), OP('+'), N(2), OP('-'), N(3)];   // 8^3+1-1
const logToks = [N(0), LOG, N(1), OP('+'), N(2), OP('-'), N(3)];   // log2(8)+1-1
const CV_POW = [8, 3, 1, 1], CV_LOG = [2, 8, 1, 1];
{
  const r = RP.checkUserAnswer(powToks, CV_POW, { advancedCalc: false });
  // :418 现取：主开关关用 UNEXPECTED_TOKEN 码 + 「请先开启高级计算」文案 ⇒ 两者都验
  t('P-10a 主开关关 + 8^3 ⇒ reason=UNEXPECTED_TOKEN 且文案为「请先…开启高级计算」',
    !r.pass && r.reason === E.UNEXPECTED_TOKEN && /开启.*高级计算/.test(String(r.message)), [r.reason, r.message]);
}
{
  const r = RP.checkUserAnswer(powToks, CV_POW, { advancedCalc: true, capPow: false });
  t('P-10b capPow:false + 8^3 ⇒ reason=ADVANCED_DISABLED', !r.pass && r.reason === E.ADVANCED_DISABLED, [r.reason, r.message]);
}
{
  const r = RP.checkUserAnswer(logToks, CV_LOG, { advancedCalc: true, capLog: false });
  t('P-10c capLog:false + log2(8) ⇒ reason=ADVANCED_DISABLED', !r.pass && r.reason === E.ADVANCED_DISABLED, [r.reason, r.message]);
}
{
  // 🔴 反例①：capPow:true 时 8^3 必须放行并求出 512（防「一律拦」把 P-10b/c 刷绿）
  const r = RP.checkUserAnswer(powToks, CV_POW, { advancedCalc: true, capPow: true });
  t('P-10r1 🔴 反例：capPow:true ⇒ 放行且求值 512（不得 ADVANCED_DISABLED）',
    r.reason !== E.ADVANCED_DISABLED && r.value && r.value.n === 512n && r.value.d === 1n, [r.reason, r.value && String(r.value.n)]);
}
{
  // 🔴 反例②：只关 log 不该影响 pow（防「关任一即全拦」）
  const r = RP.checkUserAnswer(powToks, CV_POW, { advancedCalc: true, capPow: true, capLog: false });
  t('P-10r2 🔴 反例：capLog:false 不得拦 pow 式', r.reason !== E.ADVANCED_DISABLED, [r.reason]);
}
{
  // :428 现取：平铺 capPow 与嵌套 caps.pow 两种形态都须消费
  const r = RP.checkUserAnswer(powToks, CV_POW, { advancedCalc: true, caps: { pow: false } });
  t('P-10d 嵌套 caps.pow:false 亦须生效（:428 两形态都认）', !r.pass && r.reason === E.ADVANCED_DISABLED, [r.reason]);
}

// ══════ 断言总数自断言（分族算式，禁裸数字）══════
const EXPECTED_ASSERTION_COUNT =
    2    // E-0a/E-0b 存在性前置
  + 6    // 一、正例：P-1 P-1r P-2 P-2r P-3 P-4
  + 2    // 二、LOG_NOT_EXACT：P-5 P-6
  + 3    // 三、LOG_DOMAIN：P-7a P-7b P-7r
  + 5    // 四、CHAINED/DANGLING：P-8 P-8b P-9a P-9b P-9r
  + 6;   // 五、caps：P-10a P-10b P-10c P-10r1 P-10r2 P-10d
const total = pass + fail;
console.log(`\npass=${pass} fail=${fail}`);
if (total !== EXPECTED_ASSERTION_COUNT) {
  console.log(`XX 断言总数自断言失败：${total} != 期望 ${EXPECTED_ASSERTION_COUNT}（有断言静默退场）`);
  fail++;
} else {
  console.log(`断言总数核对：${total} == 期望 ${EXPECTED_ASSERTION_COUNT} ✅`);
}
console.log(fail === 0 ? 'ALL PASS' : `OVERALL: FAIL (${fail})`);

// 🔴 rc 通道（task-148 那支漏掉此项被派回，勿重犯）
process.exitCode = fail === 0 ? 0 : 1;
