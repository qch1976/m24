// tester-task121-keycount-caps.mjs — keyCount 口径裁定断言（R-03① 替代版）
//
// 用法：node --import <esm-hooks.mjs> tester-task121-keycount-caps.mjs <repoRoot>
// 🔴 涉 GUI 必须带 --import esm-hooks（js/ui/*.js 含无扩展名 import，v24 裸跑必报 SyntaxError）
//
// ══════ 裁定背景（2026-08-09 测试独立实测，32 组 caps 全枚举）══════
// 开发 task-120 提出「keyCount 钉单一常量 19 不成立，应为 14+已开启项数」。
// 我独立枚举 32 组复核：**开发正确，我上一轮钉常量 19 的裁定错误**。
//   实测 @5c6dfbd：n=0→14 / n=1→15 / n=2→16 / n=3→17 / n=4→18 / n=5→19，14+n 全部成立
//   ⇒ 默认态(recip/fact/mod 开、pow/log 按 §10.1 默认关) = 17，钉 19 只覆盖全开一种态
//
// 🔴 但根因比「常量 vs 函数」更深一层（我的补充发现）：
//   ① `layoutFor(advancedCalc)` 形参个数 = 1，**不接收 caps** ⇒ 该字段在架构上
//      根本无法表达随 caps 变动的量，无论钉 15/17/19 都必然在某些态下错。
//   ② 全仓 grep `keyCount`：`js/` 内**仅** L109/L121 两处定义，**零消费者**
//      （渲染与命中均由 `isAdvKeyEnabled()` 逐项决定，见 L661~L688 五个 if）
//   ⇒ `keyCount` 是**死字段**，改其数值不影响任何行为，只会制造「已修好」的错觉。
//
// ══════ 裁定 ══════
// 口径：**不钉 keyCount 常量**，改为断言可点键位与 caps 的函数关系：
//        可点键位 = 14 + 已开启 adv 项数（不含 backBtn）
// 处置建议：`keyCount` 字段属死字段 ⇒ 建议**删除**而非改值（改值治不了病）；
//        若经理决定保留，须补注释标明「非真实键数，勿作判据」，且禁止任何断言引用它。
//
// 🔴 条款 10 双极性：本支在 e809f4e（接线前）须判红 —— 已实测 n=1 得 {14,15} ⇒ 14+n 不成立。
//    ⇒ 该函数关系是本轮接线才建立的新性质，断言天然有鉴别力，非恒绿废件。
// 🔴 条款 3：零/空集判据配存在性前置（先证 _buttonRects 非空再断言计数）。
// 🔴 条款 8：断言总数自断言 + 真退出码。

import { pathToFileURL } from 'url';
import path from 'path';

const ROOT = process.argv[2];
if (!ROOT) { console.error('用法: node --import <esm-hooks> tester-task121-keycount-caps.mjs <repoRoot>'); process.exit(2); }

const M = await import(pathToFileURL(path.join(ROOT, 'js/ui/AnswerArea.js')).href);
const AA = M.default;

let pass = 0, fail = 0, total = 0;
const fails = [];
function T(name, ok, detail) {
  total++;
  if (ok) { pass++; console.log(`  \u2713 ${name}`); }
  else { fail++; fails.push(name); console.log(`  \u2717 ${name}${detail ? ' \u2014 ' + detail : ''}`); }
}

// mock 2D ctx：吸收全部绘制调用（不引产品 render 之外的任何几何计算）
function mkCtx() {
  return new Proxy({}, {
    get: (t, p) => {
      if (p === 'canvas') return { width: 414, height: 896 };
      if (p === 'measureText') return () => ({ width: 10 });
      return typeof p === 'string' ? () => {} : undefined;
    },
    set: () => true,
  });
}

// 🔴 走产品真实 render 填充 _buttonRects（非自行推算几何）
//    踩坑记录：只调 layout() 不调 render() ⇒ _buttonRects 恒 0；
//    且 areaState 默认 CLOSED 时 render 直接 return ⇒ 也恒 0。恒 0 对照物是废件。
function probe(advancedCalc, caps) {
  const a = new AA();
  a.advancedCalc = advancedCalc;
  a.enabled = true;
  a.cardValues = [1, 2, 3, 4];
  if (caps && typeof a.setCaps === 'function') a.setCaps(caps);
  a.areaState = M.AREA_STATE.OPEN;
  a.render(mkCtx(), 414, 896);
  const r = a._buttonRects || [];
  const back = r.filter(x => x.ctrlKey === 'back').length;   // 🔴 字段是 ctrlKey，非 key/kind
  return { rects: r.length, back, clickable: r.length - back,
           advKeys: r.filter(x => x.kind === 'adv').map(x => x.advKey).sort() };
}

const ITEMS = ['recip', 'fact', 'mod', 'pow', 'log'];

console.log('=========================================');
console.log('keyCount 口径裁定断言（task-121 / R-03① 替代版）');
console.log(`基线：${ROOT}`);
console.log(`Node：${process.version}`);
console.log('=========================================');
console.log('');

console.log('=== 条款 3 存在性前置（防空集平凡真）===');
const probeFull = probe(true, { recip: true, fact: true, mod: true, pow: true, log: true });
T('K-0.1 全开态 _buttonRects 非空（否则下方计数断言无意义）', probeFull.rects > 0, `实际 ${probeFull.rects}`);
T('K-0.2 全开态 backBtn 存在且恰 1 个（ctrlKey==="back"）', probeFull.back === 1, `实际 ${probeFull.back}`);

console.log('');
console.log('=== K-1：可点键位 = 14 + 已开启 adv 项数（32 组全枚举）===');
const byN = new Map();
const rows = [];
for (let m = 0; m < 32; m++) {
  const caps = {}; const on = [];
  ITEMS.forEach((k, i) => { const v = !!(m & (1 << i)); caps[k] = v; if (v) on.push(k); });
  const p = probe(true, caps);
  rows.push({ n: on.length, on: on.join('+') || '(全关)', ...p });
  if (!byN.has(on.length)) byN.set(on.length, new Set());
  byN.get(on.length).add(p.clickable);
}
T('K-1.0 枚举组合数 = 32（2^5，全覆盖）', rows.length === 32, `实际 ${rows.length}`);
for (const n of [...byN.keys()].sort()) {
  const vs = [...byN.get(n)].sort((a, b) => a - b);
  T(`K-1.${n + 1} 开启 ${n} 项 ⇒ 可点恒为 ${14 + n}`, vs.length === 1 && vs[0] === 14 + n, `实测 {${vs.join(',')}}`);
}

console.log('');
console.log('=== K-2：三个关键态定值（防只对全开态）===');
const rDef = rows.find(x => x.on === 'recip+fact+mod');
const rAll = rows.find(x => x.on === 'recip+fact+mod+pow+log');
const rNone = rows.find(x => x.on === '(全关)');
T('K-2.1 默认态（recip/fact/mod 开，pow/log 默认关）可点 = 17', rDef && rDef.clickable === 17, `实际 ${rDef && rDef.clickable}`);
T('K-2.2 五项全开 可点 = 19', rAll && rAll.clickable === 19, `实际 ${rAll && rAll.clickable}`);
T('K-2.3 五项全关 可点 = 14', rNone && rNone.clickable === 14, `实际 ${rNone && rNone.clickable}`);
const off = probe(false, { recip: true, fact: true, mod: true, pow: true, log: true });
T('K-2.4 非 adv 态可点 = 14（advRow=null，caps 应完全不起作用）', off.clickable === 14, `实际 ${off.clickable}`);

console.log('');
console.log('=== K-3：pow/log 键须受 caps 逐项控制（GUI-2 联动）===');
T('K-3.1 全开态 advKeys 含 pow 与 log', probeFull.advKeys.includes('pow') && probeFull.advKeys.includes('log'),
  `实际 [${probeFull.advKeys.join(',')}]`);
const onlyPow = probe(true, { recip: false, fact: false, mod: false, pow: true, log: false });
T('K-3.2 仅开 pow ⇒ advKeys 恰为 [pow]', onlyPow.advKeys.length === 1 && onlyPow.advKeys[0] === 'pow',
  `实际 [${onlyPow.advKeys.join(',')}]`);
const onlyLog = probe(true, { recip: false, fact: false, mod: false, pow: false, log: true });
T('K-3.3 仅开 log ⇒ advKeys 恰为 [log]', onlyLog.advKeys.length === 1 && onlyLog.advKeys[0] === 'log',
  `实际 [${onlyLog.advKeys.join(',')}]`);
T('K-3.4 不传 caps 时 pow/log 须默认关（=== true 口径，漏传即静默全关）',
  (() => { const p = probe(true, undefined); return !p.advKeys.includes('pow') && !p.advKeys.includes('log'); })(),
  `实际 [${probe(true, undefined).advKeys.join(',')}]`);

console.log('');
console.log('=== K-4：keyCount 字段属死字段（裁定依据，非行为断言）===');
T('K-4.1 layoutFor 形参个数 = 1（不接收 caps ⇒ 无法表达随 caps 变动的键数）',
  M.layoutFor.length === 1, `实际 ${M.layoutFor.length}`);
const kcOn = M.layoutFor(true).keyCount, kcOff = M.layoutFor(false).keyCount;
T('K-4.2 声明值 keyCount(false) = 14 与实测关态一致（此值恰好正确）', kcOff === 14, `实际 ${kcOff}`);
T('K-4.3 🔴 声明值 keyCount(true) 与任何单一实测态都无法同时吻合（记录既有不一致，非本轮引入）',
  kcOn !== rDef.clickable || kcOn !== rAll.clickable, `声明 ${kcOn} vs 默认态 ${rDef.clickable} / 全开 ${rAll.clickable}`);

console.log('');
console.log('=== 条款 8：断言总数自断言 ===');
const EXPECTED = 21;
T(`断言总数 = ${EXPECTED} 与期望一致（含本条）`, total + 1 === EXPECTED, `实际 ${total + 1}`);

console.log('');
console.log('=========================================');
console.log(`KEYCOUNT CAPS: pass=${pass} fail=${fail}`);
if (fail) { console.log('失败项：'); for (const f of fails) console.log(`  - ${f}`); }
console.log(fail ? 'OVERALL: FAIL \u274c' : 'OVERALL: PASS \u2705');
console.log('');
console.log('\u2500\u2500 本次独立实测（32 组枚举，未引他人回显）\u2500\u2500');
for (const t of ['(全关)', 'recip', 'recip+fact', 'recip+fact+mod', 'recip+fact+mod+pow', 'recip+fact+mod+pow+log']) {
  const r = rows.find(x => x.on === t);
  if (r) console.log(`  ${t.padEnd(24)} rects=${r.rects} back=${r.back} \u53ef\u70b9=${r.clickable} advKeys=[${r.advKeys.join(',')}]`);
}
console.log(`  \u58f0\u660e keyCount(true)=${kcOn} / keyCount(false)=${kcOff}`);
console.log('');
console.log(`\u26a0\ufe0f \u9000\u51fa\u7801 = ${fail ? 1 : 0}\uff08\u4ee5\u672c\u884c\u4e3a\u51c6\uff1b\u7981 cmd & / \u7ba1\u9053\u672b\u7aef\u7801\u53d6\u503c\uff09`);
console.log('=========================================');
process.exit(fail ? 1 : 0);
