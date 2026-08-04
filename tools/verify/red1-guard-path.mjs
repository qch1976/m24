// 红1 方案 B 门禁：枚举窗口内 [提示]/[答案] 不弹窗
//
// 【为什么不只验 disabled=true】
//   disabled 在 PageRenderer 内仅被 L497/L500 用于选色（纯视觉）。
//   真正阻断在 AnswerArea.js:569 / HintModal.js:168，且 _onButtonTap 是另一条路径。
//   只断言 disabled 会漏掉「置灰了但仍能点开」这类真实缺陷 —— 这正是方案 B 相对 A 的核心价值。
//   故本门禁走**真实点击路径** this._onButtonTap(page, key)，以 modal.visible 为结果。
//
// 【双向极性】自动探测方案 B 是否已落地，修前/修后都应全绿（团队规则第 8 条）。
// 【双环境】显式 { format:'module' }，不依赖 Node 版本推断（团队规则第 9 条 / 第 6 条）。
//
// 运行：node --experimental-loader ./tools/verify/p0-loader.mjs tools/verify/red1-guard-path.mjs

import { createRequire } from 'node:module';

// ---------- 平台层 stub（仅绘图 / wx，逻辑层零 stub）----------
const calls = [];
function makeCtx() {
  const noop = (n) => (...a) => { calls.push(n); };
  const ctx = {};
  for (const m of ['save', 'restore', 'beginPath', 'closePath', 'moveTo', 'lineTo', 'arc',
    'arcTo', 'rect', 'fill', 'stroke', 'clip', 'fillRect', 'strokeRect', 'clearRect',
    'fillText', 'strokeText', 'drawImage', 'translate', 'rotate', 'scale', 'setTransform',
    'resetTransform', 'quadraticCurveTo', 'bezierCurveTo', 'setLineDash', 'ellipse',
    'createLinearGradient', 'createRadialGradient', 'measureText', 'roundRect']) {
    ctx[m] = noop(m);
  }
  ctx.measureText = (t) => { calls.push('measureText'); return { width: String(t ?? '').length * 6 }; };
  const grad = { addColorStop() {} };
  ctx.createLinearGradient = () => { calls.push('createLinearGradient'); return grad; };
  ctx.createRadialGradient = () => { calls.push('createRadialGradient'); return grad; };
  return ctx;
}
globalThis.wx = {
  getSystemInfoSync: () => ({ windowWidth: 375, windowHeight: 667, pixelRatio: 2, platform: 'devtools' }),
  createImage: () => ({ set src(_v) {} }),          // 故意不触发 onload → 逼走真实降级分支
  getStorageSync: () => '', setStorageSync: () => {},
  triggerGC: () => {},
};
globalThis.requestAnimationFrame = (fn) => { void fn; return 1; };
globalThis.cancelAnimationFrame = () => {};
if (!globalThis.Image) globalThis.Image = class { set src(_v) {} };

// ---------- 真实产品模块 ----------
const PageRenderer = (await import('../../js/ui/PageRenderer.js')).default;

// ---------- 断言基建 ----------
let pass = 0, fail = 0;
const ck = (name, ok, detail = '') => {
  if (ok) { pass++; console.log(`  ok  ${name}${detail ? '   ' + detail : ''}`); }
  else { fail++; console.log(`  XX  ${name}${detail ? '   ' + detail : ''}`); }
};

const PAGE_TABLE = 'table';

function makePR() {
  const ctx = makeCtx();
  const pr = new PageRenderer({
    switchTo() {}, 
    // gameCore 必须给真：若为 null，_openHintModal 走不到 hintModal.open()，
    // 那条断言就永远看到 hint=false，**无论有无守卫都“通过”⇒ 零鉴别力**。
    gameCore: {
      getHintStep: (n) => `提示步骤${n}`,
    },
    ctx, width: 375, height: 667,
    canvas: { width: 375, height: 667 },
  });
  // 置为「已发牌 4 张」——  auxEnabled 的其余前置条件全满足，
  // 这样唯一变量就是 _recipComputing，避免用别的条件混淆结论。
  pr.dealState = 'done';
  pr.dealtCards = [{}, {}, {}, {}];
  return pr;
}

// 三个弹层都要看：_openHintModal 开 hintModal，_openAnswerModal 开 answerModal，
// modal 是通用确认弹—— 漏看 answerModal 会让断言假绿。
function modalsVisible(pr) {
  return {
    modal: !!(pr.modal && pr.modal.visible),
    hint: !!(pr.hintModal && pr.hintModal.visible),
    answer: !!(pr.answerModal && pr.answerModal.visible),
  };
}
const anyVisible = (v) => v.modal || v.hint || v.answer;

// ---------- 极性探测：方案 B 是否已落地 ----------
const GUARD_APPLIED = (() => {
  const pr = makePR();
  pr._recipComputing = true;
  try { pr._openAnswerModal(); } catch { /* 崩溃另有断言覆盖 */ }
  return !anyVisible(modalsVisible(pr));   // 有守卫 ⇒ 一个都不该弹
})();

console.log('\n=== 红1 方案 B 门禁：枚举窗口内 [提示]/[答案] 不弹窗 ===');
console.log(`【被测状态】红1 守卫 ${GUARD_APPLIED ? '已落地 ✅ → 极性=期望不弹窗' : '未落地 🔴 → 极性=期望能弹窗(复现缺陷)'}`);

// ============ 组1：增量点（方案 B 的核心价值）============
// 【双向断言写法】两个分支都必须是**实断言**：
//   已落地 ⇒ 断言不弹；未落地 ⇒ 断言**确实弹了**（复现缺陷）。
//   禁止写 `: true` 这种无条件放行兑底 —— 那会让反向用例也全绿，门禁就成了假绿装置。
console.log('\n[组1] 真实点击路径：_onButtonTap 在枚举窗口内不得弹窗');
{
  const pr = makePR();
  pr._recipComputing = true;
  let threw = null;
  try { pr._onButtonTap(PAGE_TABLE, 'answer'); } catch (e) { threw = e; }
  const v = modalsVisible(pr);
  ck(GUARD_APPLIED ? '枚举中 tap [答案] → 不弹窗' : '枚举中 tap [答案] → 确实误弹（复现缺陷）',
     GUARD_APPLIED ? !anyVisible(v) : anyVisible(v),
     `answerModal=${v.answer} modal=${v.modal}${threw ? ' err=' + threw.message : ''}`);
}
{
  const pr = makePR();
  pr._recipComputing = true;
  let threw = null;
  try { pr._onButtonTap(PAGE_TABLE, 'hint'); } catch (e) { threw = e; }
  const v = modalsVisible(pr);
  ck(GUARD_APPLIED ? '枚举中 tap [提示] → 不弹窗' : '枚举中 tap [提示] → 确实误弹（复现缺陷）',
     GUARD_APPLIED ? !anyVisible(v) : anyVisible(v),
     `hintModal=${v.hint} modal=${v.modal}${threw ? ' err=' + threw.message : ''}`);
}

// ============ 组2：枚举结束后必须恢复（防守卫写死）============
console.log('\n[组2] 枚举结束后功能恢复（守卫不得把按钮永久锁死）');
{
  // 强断言：必须**真的弹出**，不接受「没抛异常」这种弱兑底——
  // 弱兑底会让「守卫把按钮永久锁死」也判绿，等于没验。
  const pr = makePR();
  pr._recipComputing = false;
  let threw = null;
  try { pr._openAnswerModal(); } catch (e) { threw = e; }
  const v = modalsVisible(pr);
  ck('枚举结束 tap [答案] → 确实弹出（守卫未永久锁死）', anyVisible(v),
     `answerModal=${v.answer} modal=${v.modal}${threw ? ' err=' + threw.message : ''}`);
}
{
  const pr = makePR();
  pr._recipComputing = false;
  let threw = null;
  try { pr._onButtonTap(PAGE_TABLE, 'answer'); } catch (e) { threw = e; }
  const v = modalsVisible(pr);
  ck('枚举结束走真实点击路径 → 确实弹出', anyVisible(v),
     `answerModal=${v.answer} modal=${v.modal}${threw ? ' err=' + threw.message : ''}`);
}

// ============ 组3：置灰状态（视觉层，A 方案覆盖的部分）============
console.log('\n[组3] auxEnabled 置灰联动');
{
  const pr = makePR();
  pr._recipComputing = true;
  const before = calls.length;
  let threw = null;
  try { pr.render(PAGE_TABLE); } catch (e) { threw = e; }   // render(page) —— ctx 取自 this.ui
  ck('枚举中渲染不抛异常', threw === null, threw ? threw.message : 'no-throw');
  ck('渲染确实执行了绘图（非空跑）', calls.length - before > 0, `${calls.length - before} 次 ctx 调用`);
}

// ============ 组4：回归 —— P0 与本次改动共存 ============
console.log('\n[组4] 回归：P0 (dealtOk) 未被本次改动破坏');
{
  const pr = makePR();
  pr.dealState = 'idle';
  pr.dealtCards = null;
  pr._recipComputing = false;
  const before = calls.length;
  let threw = null;
  try { pr.render(PAGE_TABLE); } catch (e) { threw = e; }
  const isRefErr = threw instanceof ReferenceError && /dealtOk/.test(threw.message || '');
  ck('默认态首帧无 dealtOk ReferenceError（P0 仍修复态）', !isRefErr,
     threw ? threw.message : 'no-throw');
  ck('默认态也确实绘图了（非空跑）', calls.length - before > 0, `${calls.length - before} 次 ctx 调用`);
}

console.log('\n==============================================================');
console.log(`[red1-guard] pass=${pass} fail=${fail}`);
console.log(GUARD_APPLIED
  ? '✅ 结论：枚举窗口内 [提示]/[答案] 经真实点击路径确认不弹窗'
  : '🔴 结论：守卫未落地，本门禁复现缺陷态');
console.log('==============================================================');
process.exit(fail === 0 ? 0 : 1);
