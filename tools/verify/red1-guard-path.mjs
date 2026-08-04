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
// 运行（在项目根目录执行）：
//     node --import ./tester/render-smoke/esm-hooks.mjs tools/verify/red1-guard-path.mjs
//
// ⚠️ 本文件【不能裸跑】。产品代码 js/ 用的是 extensionless import（如 './Components'），
//    且 .js 后缀需被当作 ESM 加载 —— 这两件事都由 esm-hooks.mjs 注册的 hooks 完成。
//    裸跑会失败，且报错形式因平台而异（Linux 多为 ERR_MODULE_NOT_FOUND，
//    Windows 可能因 CJS 回退而报 SyntaxError: Cannot use import statement outside a module）
//    —— 两者都【不是产品缺陷】，只是缺 hooks。下方已加兜底：裸跑时会直接打印可执行命令行。
//
// 注：原注释写的 `--experimental-loader ./tools/verify/p0-loader.mjs` 已失效，
//    该文件不存在（2026-08-05 task-72 核实：tools/verify/ 下无 p0-loader.mjs）。

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
// ---------- 缺 hooks 兜底：打印可直接执行的完整命令行 ----------
//
// ⚠️⚠️ 【这段兜底在什么情况下印不出来 —— 必读，规则 19：探测也有地板】
//   本段是【运行时】catch，要求本文件已被 Node 成功载入并执行到这里。以下情形印不出来：
//     (a) 把下面的 await import 改回【静态】 import ⇒ 链接阶段就失败，早于任何顶层代码，
//         catch 根本不会执行（task-69 已实证踩坑）。故此处必须保持动态 import。
//     (b) Node < 18.18：`--import` 是 unknown flag，Node 在命令行解析阶段退出
//         （`node: bad option: --import`，exit=9），JS 压根未进入。
//     (c) esm-hooks.mjs 自身因缺 module.registerHooks 而 exit(2) ⇒ 由它自己打印提示。
//   ⇒ 所以这段兜底【不是万能防护】。真正兜住的是最常见的一种：忘记加 --import 而裸跑。
//      其余情形的读者是【事后翻这个文件排查的人】—— 别指望它自动弹出。
const HOOKS_CMD = 'node --import ./tester/render-smoke/esm-hooks.mjs tools/verify/red1-guard-path.mjs';
let PageRenderer;
try {
  PageRenderer = (await import('../../js/ui/PageRenderer.js')).default;
} catch (e) {
  const code = (e && e.code) || '';
  const msg = String((e && e.message) || e);
  // 判据覆盖两种平台表现：Linux 的 ERR_MODULE_NOT_FOUND / Windows 的 CJS 回退 SyntaxError
  const isHooksMissing =
    code === 'ERR_MODULE_NOT_FOUND' ||
    code === 'ERR_UNKNOWN_FILE_EXTENSION' ||
    /Cannot use import statement outside a module/.test(msg) ||
    /Failed to load the ES module/.test(msg);
  if (!isHooksMissing) throw e;   // 真异常原样抛出，不被兜底吞掉（极性 C 已实测）
  console.error('');
  console.error('='.repeat(78));
  console.error('[red1-guard-path] 🔴 本门禁必须挂 ESM hooks 运行，不能裸跑');
  console.error('='.repeat(78));
  console.error('  ✅ 直接复制这一行执行（在项目根目录）：');
  console.error('');
  console.error('     ' + HOOKS_CMD);
  console.error('');
  console.error('  原因：产品代码 js/ 使用 extensionless import（如 \'./Components\'），');
  console.error('        且 .js 需按 ESM 加载；二者均由 esm-hooks.mjs 的 hooks 提供。');
  console.error('  ⚠️ 这【不是产品缺陷】—— 请勿据此报 js/ 有问题。');
  console.error('');
  console.error('  当前环境 : node=' + process.version + ' cwd=' + process.cwd());
  console.error('  原始报错 : ' + (code ? code + ' ' : '') + msg.split('\n')[0]);
  console.error('='.repeat(78));
  process.exit(2);
}

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
