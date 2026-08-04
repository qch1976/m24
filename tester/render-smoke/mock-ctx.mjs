// tester/render-smoke/mock-ctx.mjs
// TESTER-TODO 第 10 条基建 · mock Canvas 2D context
//
// 【硬约束（Manager 2026-08-04 10:25 授权 1）】
//   1. 显式 no-op 表，禁用 Proxy —— measureText / createLinearGradient 必须返对象，
//      Proxy 一律返函数会崩（这是设计稿里提前标出的坑）
//   2. 本文件只 stub「纯绘图」能力，不含任何 if / 计算 / 状态判断
//   3. 记录调用序列，供断言"渲染确实跑到了某一步"

export function createMockCtx() {
  const calls = [];
  const rec = (name) => (...args) => { calls.push({ name, args }); };

  const ctx = {
    // ---- 可写属性（纯样式，无逻辑）----
    fillStyle: '#000',
    strokeStyle: '#000',
    lineWidth: 1,
    font: '',
    textAlign: 'start',
    textBaseline: 'alphabetic',
    globalAlpha: 1,
    lineJoin: 'miter',
    lineCap: 'butt',
    shadowBlur: 0,
    shadowColor: 'transparent',
    shadowOffsetX: 0,
    shadowOffsetY: 0,

    // ---- 纯绘图 no-op ----
    fillRect: rec('fillRect'),
    strokeRect: rec('strokeRect'),
    clearRect: rec('clearRect'),
    fillText: rec('fillText'),
    strokeText: rec('strokeText'),
    beginPath: rec('beginPath'),
    closePath: rec('closePath'),
    moveTo: rec('moveTo'),
    lineTo: rec('lineTo'),
    arc: rec('arc'),
    arcTo: rec('arcTo'),
    ellipse: rec('ellipse'),
    rect: rec('rect'),
    quadraticCurveTo: rec('quadraticCurveTo'),
    bezierCurveTo: rec('bezierCurveTo'),
    fill: rec('fill'),
    stroke: rec('stroke'),
    clip: rec('clip'),
    save: rec('save'),
    restore: rec('restore'),
    translate: rec('translate'),
    scale: rec('scale'),
    rotate: rec('rotate'),
    transform: rec('transform'),
    setTransform: rec('setTransform'),
    drawImage: rec('drawImage'),
    setLineDash: rec('setLineDash'),

    // ---- 必须返回对象的两个（Proxy 方案会在此崩）----
    measureText(text) { calls.push({ name: 'measureText', args: [text] }); return { width: String(text ?? '').length * 6 }; },
    createLinearGradient(...a) {
      calls.push({ name: 'createLinearGradient', args: a });
      return { addColorStop() {} };
    },
    createRadialGradient(...a) {
      calls.push({ name: 'createRadialGradient', args: a });
      return { addColorStop() {} };
    },
    createPattern() { return null; },
    getLineDash() { return []; },
  };

  // 调用序列查询辅助（供断言用，不参与渲染）
  ctx.__calls = calls;
  ctx.__count = (name) => calls.filter((c) => c.name === name).length;
  ctx.__texts = () => calls.filter((c) => c.name === 'fillText').map((c) => String(c.args[0]));
  ctx.__reset = () => { calls.length = 0; };
  return ctx;
}

// mock wx —— 仅提供 Settings.js / CardRenderer.js 所需的最小面
export function installMockWx(storage = {}) {
  const wx = {
    getSystemInfoSync: () => ({ platform: 'devtools', windowWidth: 411, windowHeight: 891, pixelRatio: 2 }),
    // Settings.js 通过 typeof w.getStorageSync 判断，需真实可用
    getStorageSync: (k) => (Object.prototype.hasOwnProperty.call(storage, k) ? storage[k] : ''),
    setStorageSync: (k, v) => { storage[k] = v; },
    removeStorageSync: (k) => { delete storage[k]; },
    // CardRenderer._createImage() 用它；返回的对象需可挂 onload/onerror/src
    createImage: () => {
      const img = { width: 0, height: 0, onload: null, onerror: null };
      let _src = '';
      Object.defineProperty(img, 'src', {
        get: () => _src,
        // 永不触发 onload/onerror —— 让预载停在 pending，逼渲染走"素材未就绪"降级分支
        set: (v) => { _src = v; },
      });
      return img;
    },
    createCanvas: () => ({ getContext: () => createMockCtx(), width: 411, height: 891 }),
    triggerGC: () => {},
  };
  globalThis.wx = wx;
  return wx;
}

export function createMockUI(ctx, w = 411, h = 891) {
  return { ctx, width: w, height: h, canvas: null, currentPage: null, pageParams: null };
}
