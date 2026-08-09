// selftest/selftest_task111_gui.mjs
// task-111：项目主实机发现的两个 GUI 缺陷回归防线
//   GUI-1 高级解提示未分步（显示整条算式）
//   GUI-2 设置页「高级计算」只有倒数，缺阶乘与模；且阶乘/模引擎恒开（开关是装饰）
//
// 🔴 判据取值方式说明（避免「间接量当直接量」）：
//   - GUI-2 引擎侧用【后缀位实测】：关某项后 advanced 键里该位必须恒 0，
//     而不是数 UI 有几行（UI 有行 ≠ 引擎受控，这正是本缺陷的一半）。
//   - GUI-1 用【步数 + 末步结果】：步数≥2 且末步 result==24，
//     而不是「字符串里有没有『高级解法』字样」（那只是表象）。
import assert from 'assert';
import fs from 'fs';
import * as RS from '../js/core/RecipSolver.mjs';

let pass = 0, fail = 0;
const T = (name, cond, extra) => {
  if (cond) { pass++; console.log(`  PASS ${name}`); }
  else { fail++; console.log(`  FAIL ${name}` + (extra ? ` => got: ${JSON.stringify(extra)}` : '')); }
};

// ============ GUI-1：高级解提示必须分步 ============
console.log('=== GUI-1 高级解提示分步 ===');
// 复现牌组（项目主给定）：{5,8,9,10} 只有高级解
const D = [5, 8, 9, 10];
const res = RS.solve(D, { advancedCalc: true });
T('G1-1 {5,8,9,10} 确无初级解（复现前提，条款3 存在性前置）',
  res.primary.size === 0, { primarySize: res.primary.size });
T('G1-2 {5,8,9,10} 确有高级解', res.advanced.size > 0, { advancedSize: res.advanced.size });

const disp = RS.buildDisplay(res, RS.DISPLAY_LIMIT);
T('G1-3 buildDisplay 导出 advancedTopNode（旧版只有字符串 ⇒ UI 拿不到结构）',
  !!disp.advancedTopNode, { advancedTop: disp.advancedTop });

// 🔴 不可直接调用：旧版无此函数 / 无 advancedTopNode 时会 throw，
//   一 throw 则后续 GUI-2 全部断言静默退场，且条款8 总数自断言也跑不到
//   ⇒ 在基线上只能看到 1 条 FAIL，看不到“到底缺多少”。故此处必须包住。
let steps = [];
try {
  if (typeof RS.advPostOrderSteps === 'function' && disp.advancedTopNode) {
    steps = RS.advPostOrderSteps(disp.advancedTopNode) || [];
  }
} catch (e) {
  console.log(`  (advPostOrderSteps 抛异常：${e && e.message})`);
}
T('G1-4 分步数 >= 2（HintModal.open 要求 steps[0]/steps[1] 非空）',
  steps.length >= 2, { len: steps.length });
T('G1-5 末步结果 == 24（分步链必须真的算到 24）',
  steps.length > 0 && steps[steps.length - 1].result === '24',
  { last: steps[steps.length - 1] });
// 🔴 关键反向判据：任何一步的 lhs 都不得是「整条算式」——即不得包含最终解全文
T('G1-6 无任何一步把整条算式塞进 lhs（旧缺陷特征）',
  steps.every((s) => String(s.lhs) !== String(disp.advancedTop)
    && !String(s.lhs).includes('高级解法')),
  { lhsList: steps.map((s) => s.lhs) });
// 每一步都必须是二元运算：op 非空
T('G1-7 每步 op 均非空（旧缺陷把 op/rhs 置空串）',
  steps.every((s) => s.op && String(s.op).length > 0),
  { ops: steps.map((s) => s.op) });

// 🔴 定界断言（项目主要求「自己确认边界」的结论固化）：
//   只要初级解存在就走 Solver.postOrderSteps 正常分步，高级解不影响；
//   故失效条件 = 初级解 0 且 高级解 > 0，而非「所有含高级解的牌组」。
console.log('=== GUI-1 定界：含初级解的牌组不受影响 ===');
for (const deck of [[1, 2, 3, 4], [2, 3, 4, 6], [3, 3, 8, 8]]) {
  const r = RS.solve(deck, { advancedCalc: true });
  T(`G1-8 ${JSON.stringify(deck)} 初级解>0（走正常分步路径，不进降级分支）`,
    r.primary.size > 0, { primary: r.primary.size, advanced: r.advanced.size });
}

// ============ GUI-2：三项能力独立开关 ============
console.log('=== GUI-2 三项能力独立开关（引擎侧实测） ===');
const suffixHits = (caps) => {
  // 统计 advanced 键后缀里 R/F/M 各位为 1 的键数〔唯一键数 / 归约式键 / size 求和〕
  const acc = { R: 0, F: 0, M: 0, total: 0 };
  const decks = [];
  for (let a = 0; a <= 13; a++) for (let b = a; b <= 13; b++)
    for (let c = b; c <= 13; c++) for (let d = c; d <= 13; d++) decks.push([a, b, c, d]);
  // 全量 2380 组较慢，此处取覆盖三类符号的代表子集（每类均有命中，见下方存在性断言）
  const sub = decks.filter((_, i) => i % 37 === 0);
  for (const deck of sub) {
    const r = RS.solve(deck, { advancedCalc: true, caps });
    for (const k of r.advanced.keys()) {
      const m = k.match(/\|R([01])F([01])M([01])(?:P([01])L([01]))?$/);
      if (!m) continue;
      acc.total++;
      if (m[1] === '1') acc.R++;
      if (m[2] === '1') acc.F++;
      if (m[3] === '1') acc.M++;
    }
  }
  return acc;
};

// 🔴 条款3：以「关掉后为 0」为预期，必须先坐实「开着时非 0」，否则 0==0 是空断言
const all = suffixHits({ recip: true, fact: true, mod: true });
T('G2-1 存在性前置：三项全开时 R/F/M 三位均有命中（否则后续 ==0 无意义）',
  all.R > 0 && all.F > 0 && all.M > 0, all);

const offR = suffixHits({ recip: false, fact: true, mod: true });
T('G2-2 关倒数 ⇒ R 位命中恒 0（引擎真受控，非仅 UI）', offR.R === 0, offR);
T('G2-3 关倒数不影响阶乘/模', offR.F > 0 && offR.M > 0, offR);

const offF = suffixHits({ recip: true, fact: false, mod: true });
T('G2-4 关阶乘 ⇒ F 位命中恒 0', offF.F === 0, offF);
T('G2-5 关阶乘不影响倒数/模', offF.R > 0 && offF.M > 0, offF);

const offM = suffixHits({ recip: true, fact: true, mod: false });
T('G2-6 关模 ⇒ M 位命中恒 0', offM.M === 0, offM);
T('G2-7 关模不影响倒数/阶乘', offM.R > 0 && offM.F > 0, offM);

const offAll = suffixHits({ recip: false, fact: false, mod: false });
T('G2-8 三项全关 ⇒ advanced 全空', offAll.total === 0, offAll);

// 🔴 向后兼容：不传 caps 必须与三项全开逐项一致（否则等于悄悄改了既有行为）
const noCaps = suffixHits(undefined);
T('G2-9 caps 缺省 == 三项全开（向后兼容，逐项比对非仅比总数）',
  noCaps.R === all.R && noCaps.F === all.F && noCaps.M === all.M && noCaps.total === all.total,
  { noCaps, all });

// ============ GUI-2：UI 与持久化 ============
console.log('=== GUI-2 UI 入口 + 持久化 ===');
const spSrc = fs.readFileSync('js/ui/SettingsPanel.js', 'utf-8');
for (const [label, re] of [
  ['倒数', /capRecipToggle/], ['阶乘', /capFactToggle/], ['取模', /capModToggle/],
]) {
  T(`G2-10 SettingsPanel 有 ${label} 开关锚点`, re.test(spSrc), null);
}
T('G2-11 三项开关标签文案齐备',
  /倒数 1\/x/.test(spSrc) && /阶乘 n!/.test(spSrc) && /取模 a%b/.test(spSrc), null);

const stSrc = fs.readFileSync('js/core/Settings.js', 'utf-8');
T('G2-12 Settings 持久化三个子开关字段',
  /capRecip/.test(stSrc) && /capFact/.test(stSrc) && /capMod/.test(stSrc), null);

// 🔴 同理：loadSettings/saveSettings 在旧版不存在 cap* 字段，但函数本身存在；
//   包住以防导入/调用异常导致后续断言静默退场。
let loaded = {}, rt = {};
try {
  const S = await import('../js/core/Settings.mjs');
  globalThis.wx = globalThis.wx || {};
  let store = { version: 2, dealMode: 'solvable', advancedCalc: true }; // 故意不含 cap* 字段
  globalThis.wx.getStorageSync = () => store;
  globalThis.wx.setStorageSync = (k, v) => { store = v; };
  loaded = S.loadSettings();
  S.saveSettings({ dealMode: 'solvable', advancedCalc: true, capRecip: true, capFact: false, capMod: true });
  rt = S.loadSettings();
} catch (e) {
  console.log(`  (Settings 导入/调用抛异常：${e && e.message})`);
}
T('G2-13 旧存档缺 cap* 字段 ⇒ 三项归 true（升级后行为不变）',
  loaded.capRecip === true && loaded.capFact === true && loaded.capMod === true, loaded);
T('G2-14 关阶乘可持久化并回读（round-trip）',
  rt.capFact === false && rt.capRecip === true && rt.capMod === true, rt);

// ============ R-01 硬约束：含高级记号的解不得落初级分区 ============
console.log('=== R-01 不得破 ===');
let priViolation = 0;
for (const deck of [[5, 8, 9, 10], [1, 2, 3, 4], [2, 3, 4, 6], [1, 2, 2, 4]]) {
  for (const caps of [undefined, { recip: true, fact: false, mod: true }, { recip: false, fact: false, mod: false }]) {
    const r = RS.solve(deck, { advancedCalc: true, caps });
    for (const [, d] of r.primary) {
      if (/\(1\//.test(String(d)) || /!/.test(String(d)) || /%/.test(String(d))) priViolation++;
    }
  }
}
T('R-01 primary 分区不含 (1/ 、! 、% 记号', priViolation === 0, { priViolation });

// ============ 条款 8：断言总数自断言 ============
const EXPECTED_ASSERTION_COUNT = 27;
console.log(`\npass=${pass} fail=${fail}`);
if (pass + fail !== EXPECTED_ASSERTION_COUNT) {
  console.log(`\n🔴 FAIL 条款8 断言总数不符：期望 ${EXPECTED_ASSERTION_COUNT}，实际 ${pass + fail}`);
  console.log('   ⇒ 有断言静默退场（分支未进/提前返回/异常吞掉/循环 0 次），本次结果不可采信');
  process.exit(2);
}
console.log(`条款8 断言总数核对：${pass + fail} == 期望 ${EXPECTED_ASSERTION_COUNT} ✅`);
assert.strictEqual(fail, 0, `${fail} 条断言失败`);
console.log('ALL PASS');
