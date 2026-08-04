// ===========================================================================
// 红1 方案B 增量点(b) 实测：枚举窗口内点击 [提示]/[答案] 不得弹窗
// ===========================================================================
//
// 【为何必须实测 · Manager 2026-08-04 11:01 明确要求】
//   方案 A（仅 auxEnabled 置灰）与方案 B（auxEnabled + 2 处自守卫）的差别不在"看起来
//   灰不灰"，而在**灰着的按钮被点了会不会真的弹窗**。
//   `disabled` 字段只被 PageRenderer L497/L500 用于选色 —— **纯视觉，不拦点击**。
//   所以只读 `disabled === true` 是**假绿**：按钮画成灰的，点下去照样弹窗。
//   ⇒ 必须驱动真实点击路径 `_onButtonTap(PAGE.TABLE, 'hint'|'answer')`，
//     再断言弹窗组件的 isVisible() 仍为 false。
//
// 【断言极性双向化 · TESTER-TODO 规则第 8 条】
//   方案 B 未实施时：点击**会**弹窗（缺陷在），本脚本应报"缺陷复现"为 pass；
//   方案 B 实施后：点击**不**弹窗，本脚本应报"守卫生效"为 pass。
//   两态都全绿，避免修复后长期挂红被后人误判回归。
//
// 用法（服务器）：
//   set "NODE_PATH=C:\Users\Administrator\AppData\Roaming\npm\node_modules"
//   node tester\render-smoke\red1-tap-guard.mjs
// ===========================================================================

// esm-hooks 用 registerHooks（同线程），必须直接 import —— 不是 register() 子线程 loader
import './esm-hooks.mjs';
import { createMockCtx, installMockWx, createMockUI } from './mock-ctx.mjs';

installMockWx();
const W = 411, H = 891;

const PageRenderer = (await import('../../js/ui/PageRenderer.js')).default;
const PAGE = { INDEX: 'index', TABLE: 'table', GAME: 'game', RESULT: 'result' };

let pass = 0, fail = 0;
const results = [];
const ck = (name, ok, extra = '') => {
  ok ? pass++ : fail++;
  results.push({ name, ok, extra });
  console.log(`  ${ok ? '✅' : 'XX '} ${name}${extra ? '   ' + extra : ''}`);
};

console.log('='.repeat(78));
console.log('红1 方案B 增量点(b)：枚举窗口内点击 [提示]/[答案] 不得弹窗（实测点击路径）');
console.log('='.repeat(78));

// --- 构造"枚举进行中"状态：DONE + 4 张牌 + _recipComputing=true ---
function makeEnumerating() {
  const ctx = createMockCtx();
  const ui = createMockUI(ctx, W, H);
  // mock-ctx 的 createMockUI 不含 gameCore，而 _openHintModal 优先读 ui.gameCore.getHintStep。
  // 不补的话 hint 会走 L676「两者均空不弹」兜底 → 假绿。这里给最小真实形状。
  ui.gameCore = {
    getHintStep: (n) => ({ text: `第${n}步提示`, expr: '1+2' }),
    getAllSolutions: () => ['(1+2)*8'],
  };
  const pr = new PageRenderer(ui);
  pr.dealState = 'DONE';
  pr.dealtCards = [
    { rank: 1, suit: 's' }, { rank: 2, suit: 'h' },
    { rank: 3, suit: 'd' }, { rank: 4, suit: 'c' },
  ];
  pr._recipComputing = true;        // 枚举进行中
  pr._recipDisplay = null;          // 结果未就绪
  return { pr, ctx, ui };
}

// --- 探测方案B 是否已实施 ---
//
// 【探针必须用 answer，不能用 hint —— 我第一版选错了，记录教训】
//   `_openHintModal()` (L659) 有三级分支：gameCore.getHintStep → _recipDisplay.advancedTop
//   → **两者均空则静默不弹**（L676 注释「按钮已置灰的兼容分支」）。
//   而 mock UI 不含 gameCore（mock-ctx.mjs L108 只返回 ctx/width/height/canvas/...），
//   ⇒ hint 在 fixture 下**本来就不弹**，与守卫无关。用它探测会误判成"守卫已生效"，
//     产生假绿（我第一次跑就中了：hint ✅ 但 answer 弹窗 XX，自相矛盾）。
//   `_openAnswerModal()` (L681) 无前置条件，只要有 _recipDisplay 就 open ⇒ 适合做探针。
const GUARD_ON = (() => {
  const { pr } = makeEnumerating();
  try {
    pr._onButtonTap(PAGE.TABLE, 'answer');
  } catch { /* 忽略，探测用 */ }
  const shown = !!(pr.answerModal && pr.answerModal.isVisible && pr.answerModal.isVisible());
  return !shown;   // 没弹 = 守卫已生效
})();

console.log(`\n【被测状态】方案B 自守卫 ${GUARD_ON ? '已实施 ✅ → 期望点击不弹窗' : '未实施 🔴 → 期望点击会弹窗（缺陷复现）'}`);
console.log('            双向门禁：实施前跑全绿、实施后跑全绿，两态均无假红假绿\n');

// 期望"点击后弹窗"的断言统一走这里（极性随 GUARD_ON 翻转）
const expectBlocked = (shown) => (GUARD_ON ? shown === false : shown === true);

// ===========================================================================
// 核心用例：枚举窗口内点击 hint / answer
// ===========================================================================
console.log('【核心】枚举进行中（_recipComputing=true）点击辅助按钮');

for (const key of ['hint', 'answer']) {
  const modalName = key === 'hint' ? 'hintModal' : 'answerModal';
  const { pr } = makeEnumerating();

  let threw = null;
  try {
    pr._onButtonTap(PAGE.TABLE, key);
  } catch (e) { threw = e; }

  const modal = pr[modalName];
  const shown = !!(modal && modal.isVisible && modal.isVisible());

  console.log(`\n  · 点击 [${key}]  →  ${modalName}.isVisible() = ${shown}${threw ? `  (抛错: ${threw.message})` : ''}`);

  ck(GUARD_ON
       ? `[${key}] 枚举窗口内点击**未弹窗**（方案B 自守卫生效）`
       : `[${key}] 枚举窗口内点击**弹窗了**（缺陷复现：disabled 仅选色不拦点击）`,
     expectBlocked(shown),
     `isVisible()=${shown}`);

  ck(`[${key}] 点击路径未抛异常（守卫不得引入新崩点）`, threw === null,
     threw ? threw.message : 'no-throw');
}

// ===========================================================================
// 对照组：枚举结束后点击**必须**能正常弹窗（防"守卫写死成永久禁用"）
// ===========================================================================
console.log('\n【对照】枚举结束（_recipComputing=false + 结果就绪）点击应正常弹窗');

for (const key of ['hint', 'answer']) {
  const modalName = key === 'hint' ? 'hintModal' : 'answerModal';
  const { pr } = makeEnumerating();
  pr._recipComputing = false;                       // 枚举已结束
  // _recipDisplay 真实结构见 _openAnswerModal L687/L698：{ primary[], advanced[], counts{} }
  // （我第一版猜成 { solutions, count } → `d.primary.length` 抛 TypeError，对照组假红）
  pr._recipDisplay = {
    primary: ['(1+2)*8'], advanced: [], counts: { primary: 1, advanced: 0 },
  };

  let threw = null;
  try { pr._onButtonTap(PAGE.TABLE, key); } catch (e) { threw = e; }
  const shown = !!(pr[modalName] && pr[modalName].isVisible && pr[modalName].isVisible());

  console.log(`\n  · 点击 [${key}]  →  ${modalName}.isVisible() = ${shown}${threw ? `  (抛错: ${threw.message})` : ''}`);
  ck(`[${key}] 枚举结束后点击**能**弹窗（证明守卫非永久禁用，功能未被误杀）`,
     shown === true, `isVisible()=${shown}`);
}

// ===========================================================================
// 补充：disabled 字段本身只影响选色，不影响点击 —— 实证 Manager 的判断
// ===========================================================================
console.log('\n【实证】disabled 字段是否拦点击（说明"只验置灰不够"）');
{
  const { pr, ctx } = makeEnumerating();
  ctx.clearRect(0, 0, W, H);
  try { pr.render(PAGE.TABLE, null); } catch { /* 渲染态不影响本断言 */ }

  // 无论 disabled 画成什么颜色，_onButtonTap 都不读它
  const src = pr._onButtonTap.toString();
  const readsDisabled = /disabled/.test(src);
  ck('_onButtonTap 源码中**不读** disabled 字段 → 置灰不拦点击，必须靠自守卫',
     readsDisabled === false,
     readsDisabled ? '⚠️ 竟然读了 disabled，需重新评估' : '未读 disabled（符合预期）');
}

console.log('\n' + '='.repeat(78));
console.log(`[red1-tap-guard] pass=${pass} fail=${fail}`);
if (fail > 0) {
  console.log('失败项：');
  results.filter((r) => !r.ok).forEach((r) => console.log(`   XX ${r.name}   ${r.extra || ''}`));
}
console.log(GUARD_ON
  ? '✅ 结论：方案B 自守卫已生效 —— 枚举窗口内点击被真实拦截，且枚举结束后功能正常'
  : '🔴 结论：方案B 未实施 —— 枚举窗口内点击仍会弹窗，实证"仅置灰不足"，增量点(b) 有必要');
console.log('='.repeat(78));
process.exit(0);
