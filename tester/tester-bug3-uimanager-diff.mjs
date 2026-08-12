// tester-bug3-uimanager-diff.mjs
// INPUT-04 bugfix 独立验收 · Bug 3（Minor）：模拟器鼠标 → touch 桥接
//
// 🔴 task-131 第 2 批起**必须带 `--import ./tester/render-smoke/esm-hooks.mjs`**：
//    S3 已由源码正则升级为**行为断言**，需真实实例化 UIManager；而 UIManager.js 内部
//    `import ... from './PageRenderer'`（无扩展名）必须靠 hooks 补全 ⇒ 裸跑必 ERR_MODULE_NOT_FOUND。
//    ⇒ 裸跑时 S3 两条会**显式判红**（不静默跳过，避免零覆盖伪绿），属**环境不满足非产品缺陷**。
//    ⇒ 报数必须标注加载方式：带 hooks 16/0；裸跑 12/2（后者不得当作验收数据）。
//
// 环境限制：Tester 没有 RDP + 微信开发者工具 GUI → 真机 touch 链仍由项目主 GUI 复核
// task-42 授权：「若无 IDE 可用：静态读 UIManager.js diff…归属为"代码验证 PASS–真机待追加"」
//
// 断言项（静态代码检查）：
//   S1. UIManager 构造函数末尾追加 canvas.addEventListener('mousedown/mousemove/mouseup')
//   S2. mousemove handler 判断 mouseDown 状态（相当于 buttons & 1）
//   S3. 分别转发 touchstart / touchmove / touchend
//       🔴 task-131 第 2 批（经理批准）：S3 三条原为**源码正则**，锁死「mousedown 后 120 字符内
//       直接出现 renderer.handleEvent('touchstart')」的旧写法。产品已合法重构为经
//       `_forwardIfNoRealTouch(e, 'touchstart')` 间接转发（UIManager.js:73/77/82），转发行为完好，
//       判据却判红 ⇒ 判据过期（与 R-03 同型）。现升级为**行为断言**：真实实例化 UIManager、
//       桩 renderer 捕获 handleEvent 调用，断言「派发 mouse* ⇒ 收到对应 touch*」。
//       ⇒ 测行为不锁写法：删转发调用必判红；仅改中间函数名须仍绿。
//   S4. 用 try/catch 兜底
//   S5. window.addEventListener('mouseup', ...) 兜底
//   S6. wx.onTouchStart/Move/End 主通路完全保留（真机不受影响）
//   S7. 保护清单：UIManager 只 append，未改保护清单文件

import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';

const ROOT = process.argv[2] || '.';
const P = (rel) => path.join(ROOT, rel);
const PU = (rel) => pathToFileURL(path.resolve(P(rel))).href;   // 🔴 Windows 必须走 file:// URL

const src = fs.readFileSync(P('js/ui/UIManager.js'), 'utf8');
let PASS = 0, FAIL = 0;
function check(name, cond, detail = '') {
  console.log(`  ${cond ? '✓' : '✗'} ${name}` + (detail ? ` — ${detail}` : ''));
  cond ? PASS++ : FAIL++;
}

console.log('=== Bug3 UIManager.js 静态 diff 验证 ===\n');

// S1: canvas.addEventListener
check('S1 canvas.addEventListener("mousedown", …)', /addEventListener\(['"]mousedown['"]/.test(src));
check('S1 canvas.addEventListener("mousemove", …)', /addEventListener\(['"]mousemove['"]/.test(src));
check('S1 canvas.addEventListener("mouseup", …)', /addEventListener\(['"]mouseup['"]/.test(src));

// S2: _mouseDown 状态门（相当于 buttons & 1 语义）
check('S2 定义 _mouseDown 状态锁', /let\s+_mouseDown\s*=\s*false/.test(src));
check('S2 mousemove 中 if (!_mouseDown) return', /if\s*\(\s*!\s*_mouseDown\s*\)\s*return/.test(src));

// ═══════════════════════════════════════════════════════════════════
// S3: 三种事件转发 —— 🔴 行为断言（task-131 第 2 批，经理批准升级）
// 原写法（已废弃，锁死旧实现）：
//   /['"]mousedown['"][\s\S]{0,120}?renderer\.handleEvent\(['"]touchstart['"]/.test(src)
// 现口径：实例化真实 UIManager → 桩 renderer 捕获 → 断言转发行为发生。
// 前提（实读产品得到，非猜测）：
//   · UIManager.js:50-54  桥接仅在 wx.getSystemInfoSync().platform === 'devtools' 时启用
//   · UIManager.js:62     40ms 内有真实 touch 则丢弃（DEDUP_MS 去重门）⇒ 须置 _lastRealTouchTs=0 绕开
//   · 监听注册在 constructor 内 ⇒ 必须真跑 constructor
// ═══════════════════════════════════════════════════════════════════
const FWD = await (async () => {
  const saved = {
    canvas: globalThis.canvas, wx: globalThis.wx, window: globalThis.window,
  };
  try {
    const L = {};
    globalThis.canvas = {
      addEventListener: (t, h) => { (L[t] ||= []).push(h); },
      getContext: () => new Proxy({}, { get: () => () => {} }),
      width: 375, height: 667,
    };
    globalThis.wx = {
      onTouchStart() {}, onTouchMove() {}, onTouchEnd() {},
      createCanvas: () => globalThis.canvas,
      getSystemInfoSync: () => ({
        windowWidth: 375, windowHeight: 667, pixelRatio: 2,
        platform: 'devtools',           // 🔴 必需：否则 _enableBridge=false，监听根本不注册
      }),
    };
    globalThis.window = { addEventListener: (t, h) => { (L['win:' + t] ||= []).push(h); } };

    const UIManager = (await import(PU('js/ui/UIManager.js'))).default;
    const inst = new UIManager(null);

    const got = [];
    inst.renderer = { handleEvent: (type) => got.push(type) };
    inst._lastRealTouchTs = 0;             // 绕开 DEDUP_MS 去重门

    const ev = { clientX: 10, clientY: 20, preventDefault() {} };
    const fire = (t) => { got.length = 0; (L[t] || []).forEach((h) => h(ev)); return got.slice(); };

    return {
      ok: true,
      registered: Object.keys(L),
      down: fire('mousedown'),
      move: fire('mousemove'),
      up: fire('mouseup'),
    };
  } catch (e) {
    return { ok: false, err: `${e.constructor.name}: ${String(e.message).split('\n')[0]}` };
  } finally {
    globalThis.canvas = saved.canvas; globalThis.wx = saved.wx; globalThis.window = saved.window;
  }
})();

// 🔴 存在性前置：桥接监听必须真注册上，否则下面三条「未收到 touch*」会因环境而非缺陷全红
const S3_LIVE = FWD.ok && FWD.registered.includes('mousedown');
check('S3 存在性前置：UIManager 可实例化且 mouse* 监听已注册',
      S3_LIVE, FWD.ok ? `已注册=[${FWD.registered.join(', ')}]` : FWD.err);

if (!S3_LIVE) {
  // 🔴 不静默跳过：环境不满足时显式判红，避免「零覆盖伪绿」
  check('S3 行为断言无法执行（环境不满足，非产品缺陷，须排查）', false, FWD.err || '监听未注册');
} else {
  check('S3 mousedown → 转发 touchstart（行为）',
        FWD.down.includes('touchstart'), `实收=[${FWD.down.join(', ')}]`);
  check('S3 mousemove → 转发 touchmove（行为，须先经 mousedown 置位）',
        FWD.move.includes('touchmove'), `实收=[${FWD.move.join(', ')}]`);
  check('S3 mouseup → 转发 touchend（行为）',
        FWD.up.includes('touchend'), `实收=[${FWD.up.join(', ')}]`);
}

// S4: try/catch 兜底
check('S4 使用 try { … } catch 兜底真机 addEventListener 缺失', /try\s*\{[\s\S]+?catch\s*\(/.test(src));

// S5: window.addEventListener('mouseup', _up) 兜底鼠标拖出 canvas
check('S5 window.addEventListener("mouseup", …) 兜底',
      /window\.addEventListener\(['"]mouseup['"]/.test(src));

// S6: wx.onTouchStart/Move/End 主通路保留
check('S6 wx.onTouchStart 保留', /wx\.onTouchStart\s*\(/.test(src));
check('S6 wx.onTouchMove 保留',  /wx\.onTouchMove\s*\(/.test(src));
check('S6 wx.onTouchEnd 保留',   /wx\.onTouchEnd\s*\(/.test(src));

// 附加：确保 _toTouchEvent 构造 TouchEvent-like 对象（含 touches / changedTouches）
check('额外 _toTouchEvent 构造 TouchEvent-like {touches, changedTouches}',
      /touches\s*:\s*\[\s*\{\s*clientX[\s\S]{0,80}?changedTouches\s*:/.test(src));

// 附加：注释包含 Bug3 引用
// 🔴 task-131 第 2 批：原断言为 /Bug3/i && /87-INPUT04-bugfix/，其中方案文档号已从
//    `87-INPUT04-bugfix` 升版为 `92-INPUT04-bugfix-v2`（实读 UIManager.js:47）⇒ 断言锁死旧文档号而判红。
//    这是**纯注释代理量**：注释写哪个方案号不构成产品行为，改号只是把一个过期代理量换成另一个。
//    ⇒ 处置：删除文档号断言，仅保留「Bug3 标注存在」（可追溯用），行为正确性已由上面 S3 行为断言承担。
check('额外：注释标注 Bug3（可追溯）', /Bug3/i.test(src));

console.log('\n=== 事件流手工语义分析 ===');
console.log('  真机路径：wx.onTouchStart/Move/End → renderer.handleEvent — 未改动');
console.log('  模拟器路径：mousedown → _mouseDown=true → 转发 touchstart');
console.log('             mousemove（按下时）→ 转发 touchmove');
console.log('             mouseup/window.mouseup → _mouseDown=false → 转发 touchend');
console.log('  兼容性：canvas.addEventListener 在真机上通常为 undefined 或 no-op；');
console.log('        用 typeof this.canvas.addEventListener === "function" 判断 + try/catch 兜底');

console.log('\n=========================================');
// 🔴 D-0（task-131）：断言总数自断言 —— 防「断言静默丢失/未执行而全绿」
// 基数**实测取值**（禁数源码）：带 hooks 实跑 16 条；裸跑时 S3 行为组 3 条被「无法执行」1 条取代 ⇒ 14 条。
// ⇒ 不写死会潮动的裸数字，用可推导算式：13 条固定 + (S3_LIVE ? 3 : 1)
const EXPECTED_ASSERTION_COUNT = 13 + (S3_LIVE ? 3 : 1);
const _total = PASS + FAIL;
if (_total !== EXPECTED_ASSERTION_COUNT) {
  console.log(`  ✗ D-0 断言总数自断言 — 实测总数=${_total} 期望=${EXPECTED_ASSERTION_COUNT}（S3_LIVE=${S3_LIVE}）`);
  FAIL++;
} else {
  console.log(`  ✓ D-0 断言总数自断言 — 实测总数=${_total} 期望=${EXPECTED_ASSERTION_COUNT}（S3_LIVE=${S3_LIVE}）`);
}
console.log(`BUG3 STATIC: pass=${PASS} fail=${FAIL}`);
console.log(`OVERALL: ${FAIL === 0 ? 'PASS (代码验证) ✅  真机部分：由项目主 GUI 复核' : 'FAIL ❌'}`);
console.log('=========================================');
if (FAIL > 0) process.exit(1);
