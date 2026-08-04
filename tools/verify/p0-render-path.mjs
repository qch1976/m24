// P0 渲染路径实跑验证（task-66）
//
// 目的：证明 _renderTable() 能走完而不抛 ReferenceError: dealtOk is not defined。
// 这是本次漏检的根因对策 —— 此前全部自测只跑 Node 侧纯逻辑，从未执行渲染路径，
// 导致 745 行文件里一个必崩引用通过了全部断言。
//
// 硬约束（Manager 定 / Tester 复核）：
//   stub 只覆盖「纯绘图 / 平台 API」，逻辑层一律用真实实现。
//   dealtOk 恰恰是逻辑层 bug —— 若为跑通把逻辑也 stub 掉，本脚本就退化成假绿装置。
// 因此：DEAL_STATE / AnswerArea / Deck / Settings / RecipSolver 全部真实 import，
//       仅 canvas 2D context、wx.*、图片对象为 no-op stub。

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) { pass++; console.log(`  ✅ ${msg}`); } else { fail++; console.log(`  ❌ ${msg}`); } };

// ---------- 1) 平台 stub（仅 API 层，非逻辑层） ----------
const drawCalls = [];
function makeCtx() {
  const noop = (name) => (...a) => { drawCalls.push(name); };
  const ctx = {
    canvas: { width: 375, height: 667 },
    measureText: (t) => ({ width: String(t == null ? '' : t).length * 6 }),
    createLinearGradient: () => ({ addColorStop: () => {} }),
    createRadialGradient: () => ({ addColorStop: () => {} }),
    createPattern: () => ({}),
    getImageData: () => ({ data: new Uint8ClampedArray(4) }),
    putImageData: () => {},
insertBefore: undefined,
  };
  for (const m of ['save','restore','beginPath','closePath','moveTo','lineTo','arc','arcTo','rect',
                   'fill','stroke','fillRect','strokeRect','clearRect','fillText','strokeText',
                   'drawImage','translate','scale','rotate','setTransform','resetTransform',
                   'clip','quadraticCurveTo','bezierCurveTo','setLineDash','ellipse','roundRect']) {
    ctx[m] = noop(m);
  }
  return ctx;
}

const wxStub = {
  getSystemInfoSync: () => ({ platform: 'devtools', windowWidth: 375, windowHeight: 667, pixelRatio: 2, safeArea: { top: 20, bottom: 647 } }),
  createCanvas: () => ({ width: 375, height: 667, getContext: () => makeCtx() }),
  createImage: () => { const img = {}; setTimeout(() => img.onload && img.onload(), 0); return img; },
  getStorageSync: () => '', setStorageSync: () => {}, removeStorageSync: () => {},
  onTouchStart: () => {}, onTouchMove: () => {}, onTouchEnd: () => {}, onTouchCancel: () => {},
  onShareAppMessage: () => {}, showShareMenu: () => {},
  triggerGC: () => {}, getPerformance: () => ({ now: () => Date.now() }),
};
globalThis.wx = wxStub;
globalThis.requestAnimationFrame = (fn) => setTimeout(() => fn(Date.now()), 0);
globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
globalThis.Image = function () { const i = {}; setTimeout(() => i.onload && i.onload(), 0); return i; };

// ---------- 2) 真实模块（逻辑层不 stub） ----------
const { default: PageRenderer } = await import('../../js/ui/PageRenderer.js');
const { default: Card } = await import('../../js/core/Card.js');
// DEAL_STATE 在 PageRenderer.js 内为模块私有（L93，未 export），此处用字面值镁像。
// 故意不为了测试去改产品代码的封装（不为测试而新增 export）。
const DEAL_STATE = { IDLE: 'idle', DEALING: 'dealing', DONE: 'done' };
ok(true, 'DEAL_STATE 用字面值镁像（产品侧 L93 未 export，未为测试改动产品代码）');

console.log('=== P0 渲染路径实跑验证（_renderTable 不得抛 ReferenceError）===\n');

// ---------- 3) 构造 PageRenderer（ui 为最小真实壳） ----------
const ctx = makeCtx();
const uiShell = {
  ctx, width: 375, height: 667,
  currentPage: 'table', pageParams: {},
  switchTo(p) { this.currentPage = p; },
  gameCore: { recordSolutions: () => {}, update: () => {}, startGame: () => {} },
};

let pr = null;
try {
  pr = new PageRenderer(uiShell);
  ok(true, 'PageRenderer 构造成功（未抛异常）');
} catch (e) {
  ok(false, `PageRenderer 构造抛异常: ${e.constructor.name}: ${e.message}`);
  console.log(`\npass=${pass} fail=${fail}`);
  process.exit(1);
}

// ---------- 4) 核心：areaState 初值 CLOSED ⇒ areaClosed=true ⇒ 必达 dealtOk 行 ----------
ok(pr.answerArea.isAreaVisible() === false,
   'areaState 初值 = CLOSED ⇒ isAreaVisible()=false ⇒ areaClosed=true（必进 dealtOk 分支）');

// 场景 A：未发牌（dealState 非 DONE）—— 首次进牌桌页的真实初态，原崩溃点
let threwA = null;
try { pr.render('table', {}); } catch (e) { threwA = e; }
ok(threwA === null,
   `场景A 未发牌首帧 render('table') 不抛异常${threwA ? ` —— 实抛 ${threwA.constructor.name}: ${threwA.message}` : ''}`);
ok(!(threwA instanceof ReferenceError),
   '场景A 未出现 ReferenceError（P0 原症状：dealtOk is not defined）');

// 场景 B：已发牌 4 张（dealtOk 应为 true）
let threwB = null;
try {
  pr.dealState = DEAL_STATE.DONE;
  pr.dealtCards = [new Card('spade','A'), new Card('heart','2'), new Card('club','3'), new Card('diamond','4')];
  pr.render('table', {});
} catch (e) { threwB = e; }
ok(threwB === null,
   `场景B 已发牌4张 render('table') 不抛异常${threwB ? ` —— 实抛 ${threwB.constructor.name}: ${threwB.message}` : ''}`);

// 场景 C：发牌中（DEALING）
let threwC = null;
try { pr.dealState = DEAL_STATE.DEALING; pr.render('table', {}); } catch (e) { threwC = e; }
ok(threwC === null,
   `场景C 发牌中 render('table') 不抛异常${threwC ? ` —— 实抛 ${threwC.constructor.name}: ${threwC.message}` : ''}`);

// 场景 D：首页（对照组，原本就不含 dealtOk，应始终正常）
let threwD = null;
try { pr.render('index', {}); } catch (e) { threwD = e; }
ok(threwD === null, `场景D 首页 render('index') 不抛异常（对照组）`);

// ---------- 5) 证明渲染真的执行了（防"空跑假绿"） ----------
ok(drawCalls.length > 0, `渲染确实执行了绘图调用（共 ${drawCalls.length} 次，非空跑）`);
ok(drawCalls.includes('fillText') || drawCalls.includes('fillRect'),
   '绘图调用包含 fillText/fillRect（确认走到实际绘制，而非提前 return）');

// ---------- 6) dealtOk 语义正确性（不只是"有定义"） ----------
pr.dealState = DEAL_STATE.DONE;
pr.dealtCards = [new Card('spade','A'), new Card('heart','2'), new Card('club','3'), new Card('diamond','4')];
pr.answerArea.areaState = 'closed';
let btnEnabled = null;
const origDraw = pr._drawAuxButton;
pr._drawAuxButton = function (c, btn, ...rest) {
  if (btn && btn.key === 'startAnswer') btnEnabled = !btn.disabled;
  return origDraw.call(this, c, btn, ...rest);
};
pr.render('table', {});
ok(btnEnabled === true, '语义①：发牌完成4张 ⇒ [开始答题] enabled（disabled=false）');

pr.dealState = DEAL_STATE.IDLE;
pr.dealtCards = [];
btnEnabled = null;
pr.answerArea.areaState = 'closed';
pr.render('table', {});
ok(btnEnabled === false, '语义②：未发牌 ⇒ [开始答题] disabled（dealtOk=false）');

pr.dealState = DEAL_STATE.DONE;
pr.dealtCards = [new Card('spade','A'), new Card('heart','2')];  // 仅 2 张
btnEnabled = null;
pr.answerArea.areaState = 'closed';
pr.render('table', {});
ok(btnEnabled === false, '语义③：牌数≠4 ⇒ [开始答题] disabled（长度校验生效）');

pr._drawAuxButton = origDraw;

// ---------- 7) 回归：不得影响 [提示]/[答案]（auxEnabled 独立） ----------
ok(/const auxEnabled = this\.dealState === DEAL_STATE\.DONE/.test(
     (await import('node:fs')).readFileSync(new URL('../../js/ui/PageRenderer.js', import.meta.url), 'utf8')),
   '回归：auxEnabled 定义未被本次修改触碰');

console.log(`\npass=${pass} fail=${fail}`);
process.exit(fail === 0 ? 0 : 1);
