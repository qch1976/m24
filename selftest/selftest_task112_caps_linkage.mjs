// selftest/selftest_task112_caps_linkage.mjs
// task-112 GUI-3：设置子开关必须联动答题区运算符按钮
//
// 项目主实机现象：设置里关掉某高级运算符后，答题区仍显示该按钮。
//
// 🔴 判据取直接量（不取代理量）：
//   - 按钮集合直接从 render() 后的 this._buttonRects 取（= 真实命中区），
//     不数源码里出现几次 'adv:mod'（源码有 ≠ 渲染出、更 ≠ 可点）。
//   - 「不可点」用 handleButton 实际返回值验，不是看有没有 if。
import assert from 'assert';
// 🔴 用仓库既有的 mock ctx，不用 npm 'canvas'：
//   canvas 是本地临时装的 devDependency，开发服务器/CI 上没有 ⇒ 会 ERR_MODULE_NOT_FOUND。
//   本文件只需要「render 跑完后 _buttonRects 里有哪些键」，不需要真实像素 ⇒ mock 足够。
import { createMockCtx } from '../tester/render-smoke/mock-ctx.mjs';

globalThis.wx = {
  getStorageSync: () => '', setStorageSync: () => {},
  getSystemInfoSync: () => ({ windowWidth: 411, windowHeight: 891, pixelRatio: 1, safeArea: { top: 0, bottom: 891 } }),
};
const AA = await import('../js/ui/AnswerArea.js');
const A = AA.default, T = AA.TokenType;

let pass = 0, fail = 0;
const t = (name, cond, extra) => {
  if (cond) { pass++; console.log(`  PASS ${name}`); }
  else { fail++; console.log(`  FAIL ${name}` + (extra !== undefined ? ` => got: ${JSON.stringify(extra)}` : '')); }
};

// 渲染后取真实高级键命中区（直接量）
const advKeys = (a) => {
  a.render(createMockCtx(), 411, 891);
  return a._buttonRects.filter((b) => b.kind === 'adv').map((b) => b.advKey).sort();
};
const mk = (adv, caps) => {
  const a = new A();
  a.cardValues = [5, 8, 9, 10]; a.enabled = true; a.areaState = 'open';
  a.setAdvancedCalc(adv);
  if (caps !== undefined && a.setCaps) a.setCaps(caps);
  return a;
};
// 🔴 旧版无 setCaps ⇒ 直接调用会 throw，一 throw 则后续 D/T/G 组全部静默退场，
//   连条款 8 的总数自断言都跑不到（在基线上只能看到 9 条 FAIL，看不到缺多少）。
//   故统一经此包装：无该方法时记录一次并当作「未生效」继续，让断言正常判红。
let _noSetCaps = 0;
const setCaps = (a, caps) => {
  if (a && typeof a.setCaps === 'function') { a.setCaps(caps); return true; }
  _noSetCaps++;
  return false;
};
const eq = (x, y) => JSON.stringify(x) === JSON.stringify(y);

// ============ 存在性前置（条款 3）============
// 以「关掉后按钮消失」为预期，必须先坐实「开着时按钮在」，否则 []==[] 是空断言。
console.log('=== 存在性前置 ===');
const ALL = advKeys(mk(true, { recip: true, fact: true, mod: true }));
t('P-1 三项全开时三个按钮都在（否则后续「消失」无意义）',
  eq(ALL, ['fact', 'mod', 'recip']), ALL);

// ============ 主判据：按钮集合 ⟺ 子开关 ============
console.log('=== GUI-3 按钮集合须与三个子开关实时一致 ===');
const cases = [
  ['关倒数', { recip: false, fact: true, mod: true }, ['fact', 'mod']],
  ['关阶乘', { recip: true, fact: false, mod: true }, ['mod', 'recip']],
  ['关模', { recip: true, fact: true, mod: false }, ['fact', 'recip']],
  ['关倒数+阶乘', { recip: false, fact: false, mod: true }, ['mod']],
  ['关阶乘+模', { recip: true, fact: false, mod: false }, ['recip']],
  ['关倒数+模', { recip: false, fact: true, mod: false }, ['fact']],
  ['三项全关', { recip: false, fact: false, mod: false }, []],
];
for (const [name, caps, exp] of cases) {
  const got = advKeys(mk(true, caps));
  t(`L-1 ${name} ⇒ 按钮集合 ${JSON.stringify(exp)}`, eq(got, exp), got);
}

// 🔴 定界1（项目主要求实测）：主开关关闭时三个必须全隐
console.log('=== 🔴 定界1：主开关关闭 ⇒ 三键全隐（与子开关无关）===');
for (const caps of [{ recip: true, fact: true, mod: true }, { recip: false, fact: true, mod: false }, undefined]) {
  const got = advKeys(mk(false, caps));
  t(`B-1 主开关关 + caps=${JSON.stringify(caps)} ⇒ []`, eq(got, []), got);
}

// 向后兼容：不调 setCaps 时须与三项全开一致（旧调用方零行为变化）
console.log('=== 向后兼容 ===');
t('C-1 不调 setCaps ⇒ 三键全在（默认全开，与 task-111 逐字节同）',
  eq(advKeys(mk(true, undefined)), ['fact', 'mod', 'recip']), advKeys(mk(true, undefined)));
t('C-2 setCaps(null) 视为全开（非 false 即开）',
  eq(advKeys(mk(true, null)), ['fact', 'mod', 'recip']), advKeys(mk(true, null)));
t('C-3 缺字段的 caps 视为开（{} ⇒ 三键全在）',
  eq(advKeys(mk(true, {})), ['fact', 'mod', 'recip']), advKeys(mk(true, {})));

// ============ 关掉的键不得可点（命中区 + 双保险）============
console.log('=== 关掉的键不得可点 ===');
const aM = mk(true, { recip: true, fact: true, mod: false });
advKeys(aM); // 触发 render 生成命中区
t('H-1 关模后 _buttonRects 里无 mod 命中区',
  !aM._buttonRects.some((b) => b.kind === 'adv' && b.advKey === 'mod'), null);
// 双保险：绕过命中区直接调 handleButton，也不得写入 token
const before = aM.tokens.length;
const r = aM.handleButton({ kind: 'adv', advKey: 'mod' });
t('H-2 直接调 handleButton(mod) 被拒（action=none 且 token 未增）',
  r && r.action === 'none' && aM.tokens.length === before, { r, tokens: aM.tokens.length });
// 反向：开着的键必须仍能点（否则「全拒」也能让 H-2 变绿 ⇒ 名实不符）
const aOn = mk(true, { recip: true, fact: true, mod: true });
advKeys(aOn);
aOn.addToken({ type: T.NUMBER, cardIndex: 0 });
const n0 = aOn.tokens.length;
const r2 = aOn.handleButton({ kind: 'adv', advKey: 'mod' });
t('H-3 🔴 反向：开着的 mod 仍可点（防「一律拒绝」把 H-2 刷绿）',
  r2 && r2.action === 'changed' && aOn.tokens.length === n0 + 1, { r2, tokens: aOn.tokens.length });

// ============ 🔴 定界3：已输入算式含被禁记号时的处理 ============
// 产品语义已报项目主决策；此处固化【当前实现】= 整体清空，与主开关对 RECIP 的既有口径一致。
console.log('=== 🔴 定界3：已输入含被禁记号 ⇒ 清空（与主开关对 RECIP 既有口径一致）===');
const mkWith = (tok) => {
  const a = mk(true, { recip: true, fact: true, mod: true });
  a.addToken({ type: T.NUMBER, cardIndex: 0 });
  if (tok === T.RECIP) { a.tokens = []; a.addToken({ type: T.RECIP }); a.addToken({ type: T.NUMBER, cardIndex: 0 }); }
  else { a.addToken({ type: tok }); if (tok === T.MOD) a.addToken({ type: T.NUMBER, cardIndex: 1 }); }
  return a;
};
const dM = mkWith(T.MOD);
t('D-1 前置：5%8 已成形', dM.getFormulaText() === '5%8', dM.getFormulaText());
setCaps(dM, { recip: true, fact: true, mod: false });
t('D-2 关模 ⇒ 含 % 的算式被清空', dM.tokens.length === 0, dM.getFormulaText());

const dF = mkWith(T.FACT);
t('D-3 前置：5! 已成形', dF.getFormulaText() === '5!', dF.getFormulaText());
setCaps(dF, { recip: true, fact: false, mod: true });
t('D-4 关阶乘 ⇒ 含 ! 的算式被清空', dF.tokens.length === 0, dF.getFormulaText());

const dR = mkWith(T.RECIP);
t('D-5 前置：1/5 已成形', dR.getFormulaText() === '1/5', dR.getFormulaText());
setCaps(dR, { recip: false, fact: true, mod: true });
t('D-6 关倒数 ⇒ 含 1/ 的算式被清空', dR.tokens.length === 0, dR.getFormulaText());

// 🔴 不得误清：纯初级算式、以及关的那项与算式无关时，必须原样保留
const kA = mk(true, { recip: true, fact: true, mod: true });
kA.addToken({ type: T.NUMBER, cardIndex: 0 });
kA.addToken({ type: T.OPERATOR, value: '+' });
kA.addToken({ type: T.NUMBER, cardIndex: 1 });
setCaps(kA, { recip: false, fact: false, mod: false });
t('D-7 🔴 纯初级算式 5+8 三项全关后原样保留（不得误清）',
  kA.getFormulaText() === '5+8', kA.getFormulaText());

const kB = mkWith(T.MOD);
setCaps(kB, { recip: false, fact: false, mod: true });  // 关的是倒数/阶乘，与 % 无关
t('D-8 🔴 含 % 的算式在关「倒数+阶乘」时保留（只清被禁的那种记号）',
  kB.getFormulaText() === '5%8', kB.getFormulaText());

// 幂等：重复设同一 caps 不得清空已输入算式
const kC = mkWith(T.MOD);
setCaps(kC, { recip: true, fact: true, mod: true });
t('D-9 重复设同值 caps 不清空（幂等，避免每帧同步误清用户输入）',
  kC.getFormulaText() === '5%8', kC.getFormulaText());

// ============ 🔴 定界2：设置页返回即生效（经 PageRenderer 汇聚入口）============
console.log('=== 🔴 定界2：设置变更返回即生效，无需重启 ===');
const prSrc = (await import('fs')).readFileSync('js/ui/PageRenderer.js', 'utf-8');
t('T-1 _applyAdvancedCalc 内向答题区同步 caps（设置变更唯一汇聚入口）',
  /_applyAdvancedCalc[\s\S]{0,900}?answerArea\.setCaps\(this\._caps\)/.test(prSrc), null);
t('T-2 构造时即同步 caps（首屏不先画出全部三键）',
  /setAdvancedCalc\(this\._advancedCalc\);[\s\S]{0,300}?setCaps\(this\._caps\)/.test(prSrc), null);
// 语义验证：模拟「面板保存 → _applyAdvancedCalc」后按钮集合立即变
const fake = { _caps: null, _settings: { capRecip: true, capFact: true, capMod: false }, answerArea: mk(true, { recip: true, fact: true, mod: true }) };
fake._caps = { recip: fake._settings.capRecip !== false, fact: fake._settings.capFact !== false, mod: fake._settings.capMod !== false };
setCaps(fake.answerArea, fake._caps);
t('T-3 模拟保存后立即取按钮集合 ⇒ 已剔除 mod（返回即生效）',
  eq(advKeys(fake.answerArea), ['fact', 'recip']), advKeys(fake.answerArea));

// ============ R-01 相关：布局未重排 ============
console.log('=== 不重排布局（advRow 几何恒定）===');
const aaSrc = (await import('fs')).readFileSync('js/ui/AnswerArea.js', 'utf-8');
t('G-1 advRow 仍为 3 列且几何未变（关掉的列置空，不串位）',
  /advRow:\s*\{ x: 25,\s*y: 756, w: 361, h: 52,\s*cols: 3/.test(aaSrc), null);
// 各键 x 坐标恒定：关任意项后，剩余键的 x 必须与全开时相同（不左移填空）
const full = mk(true, { recip: true, fact: true, mod: true });
advKeys(full);
const xOf = (a, k) => { const b = a._buttonRects.find((r0) => r0.kind === 'adv' && r0.advKey === k); return b ? b.x : null; };
const fullX = { fact: xOf(full, 'fact'), recip: xOf(full, 'recip'), mod: xOf(full, 'mod') };
const partial = mk(true, { recip: true, fact: false, mod: true });
advKeys(partial);
t('G-2 🔴 关阶乘后 recip/mod 的 x 不变（不左移填空，避免误触）',
  xOf(partial, 'recip') === fullX.recip && xOf(partial, 'mod') === fullX.mod,
  { fullX, partial: { recip: xOf(partial, 'recip'), mod: xOf(partial, 'mod') } });

// ============ 条款 8：断言总数自断言 ============
const EXPECTED_ASSERTION_COUNT = 31;
console.log(`\npass=${pass} fail=${fail}`);
if (pass + fail !== EXPECTED_ASSERTION_COUNT) {
  console.log(`\n🔴 FAIL 条款8 断言总数不符：期望 ${EXPECTED_ASSERTION_COUNT}，实际 ${pass + fail}`);
  console.log('   ⇒ 有断言静默退场，本次结果不可采信');
  process.exit(2);
}
console.log(`条款8 断言总数核对：${pass + fail} == 期望 ${EXPECTED_ASSERTION_COUNT} ✅`);
assert.strictEqual(fail, 0, `${fail} 条断言失败`);
console.log('ALL PASS');
