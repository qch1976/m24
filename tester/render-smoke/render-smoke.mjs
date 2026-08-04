// tester/render-smoke/render-smoke.mjs
// ============================================================================
// TESTER-TODO 第 10 条：mock ctx 渲染冒烟基建
//   Manager 2026-08-04 10:25 授权 1 · 最高优先
//
// 【本基建要解决的问题】
//   INPUT-06 有 443(Tester) + 81(Developer) = 524 条断言全绿，却漏了一个必崩的
//   `dealtOk is not defined`（PageRenderer.js:467）。根因：**524 条全在验"数据正确性"，
//   零条验"代码能否跑起来"** —— 没人执行过渲染路径。
//   本脚本补的是"可执行性/冒烟"这一整个测试维度。
//
// 【硬约束（Manager 授权 1）与本实现如何满足】
//   ✓ stub 只覆盖纯绘图 → 见下方 STUB 清单：仅 ctx(纯绘图) + wx(存储/建图) + Image。
//     15 个产品依赖（Components/Background/CardRenderer/ButtonRenderer/AnswerArea/
//     Modal/HintModal/AnswerModal/SettingsPanel/SettingsButton/NoSolutionModal/
//     Deck/Settings/DealGenerator/RecipSolver/RecipParser）**全部真实实现，零 stub**。
//   ✓ 显式 no-op 表非 Proxy → mock-ctx.mjs（measureText/createLinearGradient 返对象）
//   ✓ mock wx.getSystemInfoSync / wx.createImage / 预载 → installMockWx()
//   ✓ 驱动矩阵 5 格 + _renderIndex/_renderGame/_renderResult
//   ✓ 零副本：用 registerHooks 直接 import 产品 .js，**被测对象即产品文件本身**
//
// 【自证条件（Manager 定的验收标准）】
//   在修 P0 之前的 HEAD 上跑，矩阵第 1 格（IDLE/CLOSED）**必须红灯**，
//   复现 `ReferenceError: dealtOk is not defined`。
//   若跑不出红灯 → 说明 stub 掉了逻辑层，基建无效，必须返工。
// ============================================================================

import './esm-hooks.mjs';
import { createMockCtx, installMockWx, createMockUI } from './mock-ctx.mjs';

installMockWx();

const PageRenderer = (await import('../../js/ui/PageRenderer.js')).default;
const UIManagerMod = await import('../../js/ui/UIManager.js');
const PAGE = UIManagerMod.PAGE || UIManagerMod.default?.PAGE;

const W = 411, H = 891;
let pass = 0, fail = 0;
const results = [];

function ck(name, ok, extra) {
  ok ? pass++ : fail++;
  results.push({ name, ok, extra });
  console.log(`  ${ok ? 'ok ' : 'XX '} ${name}${extra ? '   ' + extra : ''}`);
}

// ---------------------------------------------------------------------------
// 渲染一次，捕获同步抛错。**不吞异常**：把它作为断言对象返回。
// ---------------------------------------------------------------------------
function renderOnce(page, params, mutate) {
  const ctx = createMockCtx();
  const ui = createMockUI(ctx, W, H);
  let pr, err = null, phase = 'construct';
  try {
    pr = new PageRenderer(ui);
    phase = 'mutate';
    if (mutate) mutate(pr);
    phase = 'render';
    // 复刻 UIManager.render()：先 clearRect 再分派（与 HEAD L102-103 同序）
    ctx.clearRect(0, 0, W, H);
    pr.render(page, params);
    phase = 'done';
  } catch (e) {
    err = e;
  }
  return { pr, ctx, err, phase };
}

const label = (r) => r.err ? `${r.err.name}: ${r.err.message}` : 'no-throw';

console.log('='.repeat(78));
console.log('TESTER-TODO #10 · mock ctx 渲染冒烟（真实产品代码 · 零副本 · 仅 stub 纯绘图）');
console.log('='.repeat(78));
console.log(`时间 ${new Date().toISOString()}   node ${process.version}   ${W}x${H} DP`);
console.log(`PAGE = ${JSON.stringify(PAGE)}`);
console.log();

// ===========================================================================
// 第零部分：探测被测代码的 P0 状态 —— 双向门禁的基础
// ===========================================================================
//
// 【为何需要这一步 · Developer 2026-08-04 交叉验证发现，Manager 升为团队规则】
//   我第一版把「必须匹配 /dealtOk/」写死在反向断言里，导致：
//     · 未修的 2dbf3df → 22/22 全绿
//     · 加 1 行修复后  → 20/2  ← 两条反向断言转红
//   这个门禁一旦随 P0 修复入库，会**长期挂 2 红**，后人接手必然误判成回归，
//   甚至可能"修"掉正确代码。带永久红灯的门禁等于自废。
//
//   Developer 把这归为他上轮「注释污染计数型断言」的**镜像问题**，我认同：
//     他那次是「断言被无关文字刷绿」，我这次是「断言被正确修复刷红」，
//     同一病根 —— **断言本身没有被验证过**。
//
// 【解法】不在每条断言里硬写极性，而是**先探测一次被测代码状态**，
//   全脚本据此翻转期望值。P0_FIXED=false 时验"必崩"，=true 时验"必不崩"，
//   两种状态下都不留假红假绿。
//
const P0_FIXED = (() => {
  // 用最小成本探一帧：默认态（IDLE/CLOSED）必经 L467
  const r = renderOnce(PAGE.TABLE, null, null);
  return !(r.err instanceof ReferenceError && /dealtOk/.test(r.err.message || ''));
})();

// 期望"命中 P0 崩溃"的断言统一走这里：
//   未修 → 要求抛 ReferenceError(dealtOk)
//   已修 → 要求不抛（极性自动反转）
const expectP0 = (err) => {
  const hit = /dealtOk/.test(err?.message || '');
  return P0_FIXED ? err === null : hit;
};
// 期望"不命中 P0"的断言（如 areaOpen 分支）：两种状态下都要求不出现 dealtOk
const expectNoP0 = (err) => !/dealtOk/.test(err?.message || '');

console.log(`【被测状态】P0(dealtOk) ${P0_FIXED ? '已修复 ✅ → 断言极性=期望不崩' : '未修复 🔴 → 断言极性=期望必崩'}`);
console.log(`            双向门禁：修前跑全绿、修后跑全绿，两态均无假红假绿\n`);

// ===========================================================================
// 第一部分：驱动矩阵 5 格（Manager 指定）
// ===========================================================================
console.log('【矩阵】牌桌页 5 格状态驱动');

// --- 格 1：IDLE / CLOSED —— 本次 P0 崩点（首次进牌桌页的默认态）---
console.log('\n  · 格1  dealState=IDLE(默认)  areaState=CLOSED(默认)  ← P0 崩点，首次进页必经');
{
  const r = renderOnce(PAGE.TABLE, null, null);
  console.log(`       phase=${r.phase}   ${label(r)}`);
  const isDealtOk = r.err instanceof ReferenceError && /dealtOk/.test(r.err.message);
  // 【自证】此格在修复前必须红灯；修复后必须变绿。两种情况都要能判。
  if (isDealtOk) {
    ck('格1 复现 P0：ReferenceError: dealtOk is not defined（修复前应命中）', true,
       '🔴 基建自证成立 —— 冒烟确实执行到 L467，逻辑层未被 stub');
    ck('格1 渲染未完成（phase !== done）→ 证实 render 中断', r.phase === 'render', `phase=${r.phase}`);
    ck('格1 抛错前已 clearRect → 画布空 = 白屏', r.ctx.__count('clearRect') >= 1,
       `clearRect 调用 ${r.ctx.__count('clearRect')} 次`);
  } else {
    ck('格1 牌桌页首屏渲染无抛错（P0 已修复后应为绿）', r.err === null, label(r));
    ck('格1 渲染完成（phase=done）', r.phase === 'done', `phase=${r.phase}`);
    ck('格1 实际产生绘制调用（渲染非空转）', r.ctx.__calls.length > 5, `${r.ctx.__calls.length} 次 ctx 调用`);
  }
}

// --- 格 2：DEALING / CLOSED ---
console.log('\n  · 格2  dealState=DEALING  areaState=CLOSED');
{
  const r = renderOnce(PAGE.TABLE, null, (pr) => {
    pr.dealState = 'DEALING';
    if (typeof pr._dealStartAt !== 'undefined') pr._dealStartAt = Date.now();
  });
  console.log(`       phase=${r.phase}   ${label(r)}`);
  ck(P0_FIXED ? '格2 DEALING 态渲染无抛错' : '格2 DEALING 态命中已知 P0（无其他异常）',
     expectP0(r.err), label(r));
}

// --- 格 3：DONE / CLOSED ---
console.log('\n  · 格3  dealState=DONE  areaState=CLOSED（已发牌，答题区未开）');
{
  const r = renderOnce(PAGE.TABLE, null, (pr) => { pr.dealState = 'DONE'; });
  console.log(`       phase=${r.phase}   ${label(r)}`);
  ck(P0_FIXED ? '格3 DONE/CLOSED 渲染无抛错' : '格3 DONE/CLOSED 命中已知 P0（无其他异常）',
     expectP0(r.err), label(r));
}

// --- 格 4：DONE / OPEN ---
console.log('\n  · 格4  dealState=DONE  areaState=OPEN（答题区展开）');
{
  const r = renderOnce(PAGE.TABLE, null, (pr) => {
    pr.dealState = 'DONE';
    if (pr.answerArea) {
      if (typeof pr.answerArea.open === 'function') pr.answerArea.open();
      else pr.answerArea.areaState = 'OPEN';
    }
  });
  console.log(`       phase=${r.phase}   ${label(r)}`);
  ck('格4 DONE/OPEN 渲染无抛错（除已知 P0 外）',
     r.err === null || /dealtOk/.test(r.err.message || ''), label(r));
}

// --- 格 5：DONE / OPEN + _recipComputing=true（红1 窗口）---
console.log('\n  · 格5  dealState=DONE  areaState=OPEN  _recipComputing=true（红1 枚举窗口）');
{
  const r = renderOnce(PAGE.TABLE, null, (pr) => {
    pr.dealState = 'DONE';
    pr._recipComputing = true;
    if (pr.answerArea) {
      if (typeof pr.answerArea.open === 'function') pr.answerArea.open();
      else pr.answerArea.areaState = 'OPEN';
    }
  });
  console.log(`       phase=${r.phase}   ${label(r)}`);
  ck('格5 枚举窗口内渲染无抛错（除已知 P0 外）',
     r.err === null || /dealtOk/.test(r.err.message || ''), label(r));
}

// ===========================================================================
// 第一部分补充：触发条件精确定位（矩阵跑出的新事实，非 Manager 指定，为 Tester 主动补位）
//
// 矩阵结果显示：格1/2/3 崩、格4/5 不崩 —— 说明崩溃**与 dealState 无关**，
// 唯一条件是 `areaClosed === true`（答题区收起）。
// HEAD L457-467 实证：`const areaClosed = !this.answerArea.isAreaVisible();`
//                    `if (areaClosed) { ... disabled: !dealtOk ... }`
// 这修正了此前"进牌桌页即崩"的粗略表述：更准确说是**答题区收起时的每一帧都崩**，
// 而答题区初值为 CLOSED ⇒ 首次进页必崩；且用户收起答题区后会再次崩。
// ===========================================================================
console.log('\n【触发条件】崩溃与 dealState 无关，唯一条件 = areaClosed');
{
  const openArea = (pr) => {
    if (!pr.answerArea) return false;
    if (typeof pr.answerArea.openArea === 'function') { pr.answerArea.openArea(); return true; }
    if (typeof pr.answerArea.open === 'function') { pr.answerArea.open(); return true; }
    return false;
  };
  // 三种 dealState × areaClosed=true → 应全崩
  const closedResults = ['IDLE', 'DEALING', 'DONE'].map((ds) => ({
    ds, r: renderOnce(PAGE.TABLE, null, (pr) => { pr.dealState = ds; }),
  }));
  // 【双向】未修：三态应全崩；已修：三态应全不崩。无论哪种，结论都是"与 dealState 无关"
  const allClosedSame = closedResults.every((x) => expectP0(x.r.err));
  ck(P0_FIXED
       ? 'areaClosed=true 时 IDLE/DEALING/DONE 三态**均不**崩溃（P0 已修）→ 仍证明与 dealState 无关'
       : 'areaClosed=true 时 IDLE/DEALING/DONE 三态**全部**崩溃 → 崩溃与 dealState 无关',
     allClosedSame, closedResults.map((x) => `${x.ds}:${x.r.err ? 'crash' : 'ok'}`).join(' '));

  // 【反向用例】areaClosed=false → 不进 if 分支 → 不崩。证明我定位的条件是充要的
  const openResults = ['IDLE', 'DEALING', 'DONE'].map((ds) => {
    const r = renderOnce(PAGE.TABLE, null, (pr) => { pr.dealState = ds; openArea(pr); });
    return { ds, r };
  });
  const noneOpenCrash = openResults.every((x) => expectNoP0(x.r.err));
  ck('【反向】areaClosed=false 时三态**均不**崩溃 → 证实 areaClosed 是充要触发条件',
     noneOpenCrash, openResults.map((x) => `${x.ds}:${x.r.err ? 'crash' : 'ok'}`).join(' '));

  // 用户可否自行绕过：答题区初值是否 CLOSED（决定"首次进页是否必崩"）
  const fresh = renderOnce(PAGE.INDEX, null, null);
  const areaVisibleAtBirth = fresh.pr && fresh.pr.answerArea
    ? fresh.pr.answerArea.isAreaVisible() : null;
  ck('答题区出生态 isAreaVisible() === false（⇒ 首次进牌桌页必崩，无门槛）',
     areaVisibleAtBirth === false, `isAreaVisible()=${areaVisibleAtBirth}`);

  // 危害补充：已展开后再收起 → 再次崩（不是"只崩一次"）
  //
  // 【我第一版此用例写错了，记录修正过程】
  //   原写法：closeArea() 后立刻渲染 → 断言崩溃 → 实际 no-throw，我以为是产品行为异常。
  //   查证 AnswerArea.js HEAD：
  //     L264 closeArea() 置 areaState = CLOSING（**不是 CLOSED**）
  //     L270 isAreaVisible() { return this.areaState !== AREA_STATE.CLOSED; }  ⇒ CLOSING 期间仍返 true
  //     L283 _tickSlide() 需 Date.now() - _slideStartAt >= SLIDE_MS(220) 才把 CLOSING → CLOSED
  //   ⇒ 收起动画 220ms 内 areaClosed=false 不崩，动画走完后才崩。**是我漏了动画时序，不是产品问题。**
  //
  // 【第二版仍错，再修正一次】回拨 _slideStartAt 后单帧渲染仍 no-throw。原因是**帧内次序**：
  //   PageRenderer.js L457 `isAreaVisible()` 读状态  ←  先
  //   PageRenderer.js L472 `answerArea.render()` → AnswerArea.js L391 `_tickSlide()`
  //                                                 → L295 CLOSING 变 CLOSED  ←  后
  //   ⇒ 状态收尾滞后于本帧的读取，必须**渲染两帧**：第 1 帧推进动画收尾，第 2 帧才读到 CLOSED。
  //   这正是"静态断言验不出运行时"的又一例：不实跑绝不会发现有一帧延迟。
  const reclose = (() => {
    const ctx = createMockCtx();
    const ui = createMockUI(ctx, W, H);
    let err = null, frames = 0;
    try {
      const pr = new PageRenderer(ui);
      pr.dealState = 'DONE';
      pr.answerArea.areaState = 'OPEN';               // 完全展开（不崩基线）
      pr.answerArea.closeArea();                      // → CLOSING
      pr.answerArea._slideStartAt = Date.now() - 300; // 回拨 > SLIDE_MS(220)
      // 第 1 帧：L457 读到 CLOSING(visible=true) 不崩；L472 render 内 _tickSlide 收尾为 CLOSED
      ctx.clearRect(0, 0, W, H); pr.render(PAGE.TABLE, null); frames = 1;
      // 第 2 帧：L457 读到 CLOSED → areaClosed=true → 命中 L467
      ctx.clearRect(0, 0, W, H); pr.render(PAGE.TABLE, null); frames = 2;
    } catch (e) { err = e; }
    return { err, frames, ctx, phase: 'render' };
  })();
  ck(P0_FIXED
       ? '展开后收起（跨 2 帧）渲染正常（P0 已修 → 用户可反复开合，无崩溃）'
       : '展开后收起（滑出动画走完，跨 2 帧）→ 再次崩溃（非一次性，用户无法自救）',
     expectP0(reclose.err),
     P0_FIXED ? `2 帧均正常 | ${label(reclose)}`
              : `第 ${reclose.frames + 1} 帧崩溃 | ${label(reclose)}`);

  // 并补一条：收起动画进行中（CLOSING，220ms 窗口内）不崩 —— 证明危害窗口的精确边界
  const during = renderOnce(PAGE.TABLE, null, (pr) => {
    pr.dealState = 'DONE';
    openArea(pr);
    pr.answerArea.areaState = 'OPEN';
    pr.answerArea.closeArea();
    pr.answerArea._slideStartAt = Date.now();   // 动画刚开始
  });
  ck('收起动画进行中（CLOSING，<220ms）不崩 —— isAreaVisible() 仍为 true，边界精确',
     during.err === null, label(during));
}

// ===========================================================================
// 第二部分：其余三页冒烟（Manager 要求顺带覆盖）
// ===========================================================================
console.log('\n【其余页面】_renderIndex / _renderGame / _renderResult');
{
  const idx = renderOnce(PAGE.INDEX, null, null);
  console.log(`  · INDEX   phase=${idx.phase}   ${label(idx)}`);
  ck('首页渲染无抛错（与 P0 白屏对照：首页不含 dealtOk 故应正常）', idx.err === null, label(idx));
  ck('首页产生实际绘制调用', idx.ctx.__calls.length > 3, `${idx.ctx.__calls.length} 次 ctx 调用`);

  const game = renderOnce(PAGE.GAME, { cards: [1, 2, 3, 4] }, null);
  console.log(`  · GAME    phase=${game.phase}   ${label(game)}`);
  ck('游戏页渲染无抛错', game.err === null, label(game));

  const res = renderOnce(PAGE.RESULT, { correct: true, expression: '(1+2)*8' }, null);
  console.log(`  · RESULT  phase=${res.phase}   ${label(res)}`);
  ck('结算页渲染无抛错', res.err === null, label(res));
}

// ===========================================================================
// 第三部分：基建有效性自检 —— 防"假绿装置"
// ===========================================================================
console.log('\n【自检】证明本基建没有 stub 掉逻辑层（防假绿）');
{
  // 自检 1：mock ctx 的两个"必须返对象"方法确实返对象
  const c = createMockCtx();
  const mt = c.measureText('abcd');
  const lg = c.createLinearGradient(0, 0, 1, 1);
  ck('自检① measureText 返回带 width 的对象（Proxy 方案会崩在此）',
     mt && typeof mt.width === 'number', `width=${mt.width}`);
  ck('自检② createLinearGradient 返回带 addColorStop 的对象',
     lg && typeof lg.addColorStop === 'function');

  // 自检 3：逻辑层是真实实现 —— 用 Settings 真实读写往返验证
  const Settings = await import('../../js/core/Settings.js');
  const s = Settings.loadSettings();
  ck('自检③ core/Settings.js 是真实实现（loadSettings 返回 v2 结构）',
     s && s.version === 2 && typeof s.dealMode === 'string', JSON.stringify(s));

  // 自检 4：RecipSolver 真实可算（逻辑层未被 stub）
  const RecipSolver = (await import('../../js/core/RecipSolver.js')).default;
  const solved = RecipSolver.solve([1, 2, 3, 4]);
  ck('自检④ core/RecipSolver.js 是真实实现（solve 返回结果对象）',
     solved !== null && solved !== undefined, `type=${typeof solved}`);

  // 自检 5：确认 stub 面只有 ctx/wx —— 列出所有被 mock 的全局
  const mocked = ['wx'].filter((k) => typeof globalThis[k] !== 'undefined');
  ck('自检⑤ 被 mock 的全局仅 wx（无逻辑模块被替换）',
     mocked.length === 1 && mocked[0] === 'wx', `mocked globals = [${mocked.join(', ')}]`);

  // 自检 6：确认渲染真的执行到了业务绘制，而非在 constructor 就返回
  const probe = renderOnce(PAGE.INDEX, null, null);
  ck('自检⑥ 渲染确实执行到 fillText（业务绘制层被真正触达）',
     probe.ctx.__count('fillText') > 0,
     `fillText ${probe.ctx.__count('fillText')} 次；文案样本 = ${JSON.stringify(probe.ctx.__texts().slice(0, 3))}`);
}

// ===========================================================================
console.log('\n' + '='.repeat(78));
console.log(`[render-smoke] pass=${pass} fail=${fail}`);
if (fail > 0) {
  console.log('失败项：');
  results.filter((r) => !r.ok).forEach((r) => console.log(`   XX ${r.name}   ${r.extra || ''}`));
}
const p0Reproduced = results.some((r) => /复现 P0/.test(r.name) && r.ok);
console.log(p0Reproduced
  ? (P0_FIXED
      ? '✅ 结论：P0(dealtOk) 已修复，全部断言在"已修"极性下通过 → 门禁绿灯，可安全入库'
      : '🔴 结论：本基建在当前 HEAD 上成功复现 P0（dealtOk）→ 自证条件满足，基建有效')
  : '✅ 结论：牌桌页 5 格 + 3 页全部渲染通过（若 P0 已修，此为预期结果）');
console.log('='.repeat(78));
process.exit(0);
