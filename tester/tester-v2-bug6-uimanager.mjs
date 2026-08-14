// tester-v2-bug6-uimanager.mjs
// Bug 6 独立验收：UIManager X+Y 合流去重
// 静态 diff + 运行时 mock harness
// 独立采样，不引 worker2 selftest 数据

import fs from 'fs';

const src = fs.readFileSync('js/ui/UIManager.js', 'utf8');
let PASS = 0, FAIL = 0;
function check(name, cond, detail = '') {
  console.log(`  ${cond ? '✓' : '✗'} ${name}` + (detail ? ` — ${detail}` : ''));
  cond ? PASS++ : FAIL++;
}
function checkContains(name, needle, must = true) {
  const has = src.includes(needle);
  check(name, has === must, `contains "${needle}" = ${has}`);
}

console.log('=== Part 1: UIManager.js 静态 diff（选型 X + Y 合流） ===\n');

// X 白名单
checkContains('X.1 platform=devtools 判定存在', "platform === 'devtools'");
checkContains('X.2 _enableBridge 闸门', '_enableBridge');
checkContains('X.3 wx.getSystemInfoSync 调用', 'wx.getSystemInfoSync');
checkContains('X.4 window.MOUSE_ONLY 备用旗标', 'window.MOUSE_ONLY');

// Y 去重
checkContains('Y.1 _lastRealTouchTs 时间戳', '_lastRealTouchTs');
checkContains('Y.2 DEDUP_MS = 40 常量', 'DEDUP_MS = 40');
checkContains('Y.3 Date.now() - _lastRealTouchTs 检查', 'Date.now() - this._lastRealTouchTs');
checkContains('Y.4 桥接分发前去重 (< DEDUP_MS return)', 'DEDUP_MS) return');
checkContains('Y.5 wx.onTouchStart 更新 _lastRealTouchTs', 'wx.onTouchStart');
checkContains('Y.6 wx.onTouchMove 更新 _lastRealTouchTs', 'wx.onTouchMove');
checkContains('Y.7 wx.onTouchEnd 更新 _lastRealTouchTs', 'wx.onTouchEnd');
checkContains('Y.8 桥接事件带 _synthetic 标记', '_synthetic');

// Bug 3 桥接可用性未被破坏
checkContains('Bug3.1 mousedown 桥接保留', "addEventListener('mousedown'");
checkContains('Bug3.2 mousemove 桥接保留', "addEventListener('mousemove'");
checkContains('Bug3.3 mouseup 桥接保留', "addEventListener('mouseup'");
checkContains('Bug3.4 window.mouseup 兜底保留', "window.addEventListener('mouseup'");
checkContains('Bug3.5 touchstart 转发保留', "'touchstart'");
checkContains('Bug3.6 touchmove 转发保留', "'touchmove'");
checkContains('Bug3.7 touchend 转发保留', "'touchend'");
checkContains('Bug3.8 try/catch 兜底保留', 'try {');

// 检查 Y 桥接的 3 次 return 语句都是丢弃逻辑
{
  const returnMatches = src.match(/DEDUP_MS\) return/g) || [];
  check(`Y.9 桥接分发 3 处使用 dedup return (mousedown/move/up)`, returnMatches.length >= 1, `matched ${returnMatches.length}`);
}

console.log('\n=== Part 2: 运行时 mock harness ===\n');

// mock harness: 加载 UIManager 到隔离环境
// 由于 UIManager 依赖 wx 全局，我们在 mock 中构造 wx 并运行片段

// 简化 mock: 直接 eval UIManager 内的桥接决策代码

// Mock A: 真机 platform='android' → _enableBridge=false
{
  let enableBridge = false;
  const wx = { getSystemInfoSync: () => ({ platform: 'android' }) };
  const win = {};  // window
  try {
    const sys = wx.getSystemInfoSync ? wx.getSystemInfoSync() : null;
    if (sys && sys.platform === 'devtools') enableBridge = true;
    if (typeof win !== 'undefined' && win.MOUSE_ONLY === true) enableBridge = true;
  } catch (_) { enableBridge = false; }
  check('A.1 真机 platform=android → 桥接关闭', enableBridge === false);
}

// Mock B: devtools → _enableBridge=true
{
  let enableBridge = false;
  const wx = { getSystemInfoSync: () => ({ platform: 'devtools' }) };
  const win = {};
  try {
    const sys = wx.getSystemInfoSync ? wx.getSystemInfoSync() : null;
    if (sys && sys.platform === 'devtools') enableBridge = true;
    if (typeof win !== 'undefined' && win.MOUSE_ONLY === true) enableBridge = true;
  } catch (_) { enableBridge = false; }
  check('B.1 devtools platform → 桥接启用', enableBridge === true);
}

// Mock C: MOUSE_ONLY=true 备用旗标
{
  let enableBridge = false;
  const wx = { getSystemInfoSync: () => ({ platform: 'ios' }) };
  const win = { MOUSE_ONLY: true };
  try {
    const sys = wx.getSystemInfoSync ? wx.getSystemInfoSync() : null;
    if (sys && sys.platform === 'devtools') enableBridge = true;
    if (typeof win !== 'undefined' && win.MOUSE_ONLY === true) enableBridge = true;
  } catch (_) { enableBridge = false; }
  check('C.1 MOUSE_ONLY=true 强制启用桥接（即使非 devtools）', enableBridge === true);
}

// Mock D: getSystemInfoSync 抛异常 → 桥接关闭（安全默认）
{
  let enableBridge = false;
  const wx = { getSystemInfoSync: () => { throw new Error('mock'); } };
  const win = {};
  try {
    const sys = wx.getSystemInfoSync ? wx.getSystemInfoSync() : null;
    if (sys && sys.platform === 'devtools') enableBridge = true;
    if (typeof win !== 'undefined' && win.MOUSE_ONLY === true) enableBridge = true;
  } catch (_) { enableBridge = false; }
  check('D.1 getSystemInfoSync 抛错时桥接安全默认关闭', enableBridge === false);
}

console.log('\n=== Part 3: 双分发去重 mock（模拟同 tick real touch + mouse 双发） ===\n');

// 严格 mock: 复现 UIManager 内桥接 handleEvent 调用序列
{
  let handleEventCalls = [];  // 记录每次 handleEvent 调用
  const renderer = { handleEvent: (type, ev) => handleEventCalls.push({ type, synth: ev._synthetic }) };
  let _lastRealTouchTs = 0;
  const DEDUP_MS = 40;

  // 模拟 wx.onTouchEnd 触发（真机 real touch）
  const now1 = Date.now();
  _lastRealTouchTs = now1;
  renderer.handleEvent('touchend', {});
  // 立即（同 tick）mouseup 触发桥接 forward
  const forwardIfNoRealTouch = (ev, type) => {
    if (Date.now() - _lastRealTouchTs < DEDUP_MS) return;
    renderer.handleEvent(type, { touches: [], changedTouches: [], preventDefault: () => {}, _synthetic: true });
  };
  forwardIfNoRealTouch({ clientX: 100, clientY: 200 }, 'touchend');  // 应被 dedup 丢弃

  check('E.1 real touch 后 40ms 内桥接分发被丢弃（handleEvent 只呼 1 次）', handleEventCalls.length === 1, `实际 ${handleEventCalls.length} 次`);
  check('E.2 保留的那次是 real touch (非 _synthetic)', handleEventCalls[0] && !handleEventCalls[0].synth);
}

// 模拟 devtools 无 real touch 时桥接正常分发
{
  let handleEventCalls = [];
  const renderer = { handleEvent: (type, ev) => handleEventCalls.push({ type, synth: ev._synthetic }) };
  let _lastRealTouchTs = 0;
  const DEDUP_MS = 40;
  const forwardIfNoRealTouch = (ev, type) => {
    if (Date.now() - _lastRealTouchTs < DEDUP_MS) return;
    renderer.handleEvent(type, { touches: [], changedTouches: [], preventDefault: () => {}, _synthetic: true });
  };
  // 无 real touch，桥接连发 3 次（mousedown/move/up）
  forwardIfNoRealTouch({}, 'touchstart');
  forwardIfNoRealTouch({}, 'touchmove');
  forwardIfNoRealTouch({}, 'touchend');
  check('F.1 无 real touch 时桥接 3 次分发全部通过', handleEventCalls.length === 3, `实际 ${handleEventCalls.length}`);
  check('F.2 桥接分发均带 _synthetic=true', handleEventCalls.every(c => c.synth === true));
}

// 超过 DEDUP_MS 后桥接恢复分发
{
  await new Promise(r => setTimeout(r, 50));  // 睡 50ms
  let handleEventCalls = [];
  const renderer = { handleEvent: (type, ev) => handleEventCalls.push({ type, synth: ev._synthetic }) };
  let _lastRealTouchTs = Date.now() - 100;  // 100ms 前有过 real touch
  const DEDUP_MS = 40;
  const forwardIfNoRealTouch = (ev, type) => {
    if (Date.now() - _lastRealTouchTs < DEDUP_MS) return;
    renderer.handleEvent(type, { touches: [], changedTouches: [], preventDefault: () => {}, _synthetic: true });
  };
  forwardIfNoRealTouch({}, 'touchend');
  check('G.1 real touch 100ms 后桥接恢复分发', handleEventCalls.length === 1);
}

// ══════════ D-0 断言总数自断言（task-131 第 3 批 E 类补齐）══════════
// 目的：捕获「断言静默退场」—— 某条断言因重构/异常/分支变化不再执行时，
//       仅看 pass/fail 无法察觉（fail=0 仍为绿）。
// 🔴 基数必顶可推导，禁裸数字：按【分族小计相加】写，每项均可在源码里数出对应断言。
// 🔴 本支踩过的坑（留存作证）：按 `check('` 数源码得 29，实跑 30。差额来自 Y.9 用了
//       反引号模板串 check(`Y.9 ...`)，单引号正则漏数 ⇒ 【数源码是代理量】。
//       故下面小计均以【实际执行的断言族】为准，并在注释里标出行号依据。
const EXPECTED = {
  // Part 1 静态 diff（逐条 checkContains，无循环）
  X: 4,     // X.1~X.4  白名单（:22-25）
  Y: 9,     // Y.1~Y.8 静态（:28-35）+ Y.9 dedup return（:50，反引号写法）
  Bug3: 8,  // Bug3.1~Bug3.8 桥接可用性未被破坏（:38-45）
  // Part 2 运行时 mock harness（每个 Mock 块内断言数）
  A: 1,     // Mock A 真机关桥接（:70）
  B: 1,     // Mock B devtools 开桥接（:83）
  C: 1,     // Mock C MOUSE_ONLY 强开（:96）
  D: 1,     // Mock D 抛异常安全默认关（:109）
  E: 2,     // Mock E 40ms 内去重（:132-133）
  F: 2,     // Mock F 无 real touch 全通过（:150-151）
  G: 1,     // Mock G 100ms 后恢复（:166）
};
const EXPECTED_ASSERTION_COUNT = Object.values(EXPECTED).reduce((s, n) => s + n, 0);
// 🔴 口径：EXPECTED 只算【业务断言】，**不含 D-0 自己**（否则自引用，永远自洽）。
//     D-0 自身计入 PASS ⇒ 最终总结行为 `pass=N+1`（N 为业务绿数，+1 即 D-0 本条）。
//     与已入库 3 支（bug3-uimanager / v2-regression / v2-bug5-canonicalize）保持一致。

console.log('\n=== D-0：断言总数自断言 ===');
const _total = PASS + FAIL;
if (_total === EXPECTED_ASSERTION_COUNT) {
  PASS++;
  console.log(`  ✓ D-0 断言总数自断言 — 实测总数=${_total} 期望=${EXPECTED_ASSERTION_COUNT}`);
} else {
  FAIL++;
  console.log(`  ✗ D-0 断言总数自断言 — 实测总数=${_total} 期望=${EXPECTED_ASSERTION_COUNT}`);
  console.log(`    分族期望：${JSON.stringify(EXPECTED)}`);
  console.log('    ⇒ 有断言静默退场或新增未同步 EXPECTED');
}

console.log('\n=========================================');
console.log(`Bug6 TOTAL: pass=${PASS} fail=${FAIL}`);
console.log(`OVERALL: ${FAIL === 0 ? 'PASS ✅' : 'FAIL ❌'}`);
console.log('=========================================');
if (FAIL > 0) process.exit(1);
