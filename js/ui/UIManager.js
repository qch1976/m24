// m24 - UIManager.js
// UI 管理器：拿到 canvas 上下文，负责场景切换与顶层渲染入口
// INPUT-01：新增 TABLE 页面
// INPUT-02：constructor 接收 gameCore 引用，用于 PageRenderer 侧持有全解（R-03）

import PageRenderer from './PageRenderer';

const PAGE = {
  INDEX: 'index',
  TABLE: 'table',
  GAME: 'game',
  RESULT: 'result',
};

export default class UIManager {
  constructor(gameCore) {
    this.gameCore = gameCore || null;
    this.canvas = typeof canvas !== 'undefined' ? canvas : wx.createCanvas();
    this.ctx = this.canvas.getContext('2d');
    const sys = wx.getSystemInfoSync ? wx.getSystemInfoSync() : { windowWidth: 411, windowHeight: 891 };
    this.width = sys.windowWidth;
    this.height = sys.windowHeight;
    this.currentPage = PAGE.INDEX;
    this.pageParams = {};
    this.renderer = new PageRenderer(this);

    // Bug6 v2 (X+Y 合流)：追踪真实 touch 事件时间戳，供后面桥接去重使用
    this._lastRealTouchTs = 0;

    // 触摸事件分发
    if (wx.onTouchStart) {
      wx.onTouchStart((e) => {
        this._lastRealTouchTs = Date.now();
        this.renderer.handleEvent('touchstart', e);
      });
      wx.onTouchMove((e) => {
        this._lastRealTouchTs = Date.now();
        this.renderer.handleEvent('touchmove', e);
      });
      wx.onTouchEnd((e) => {
        this._lastRealTouchTs = Date.now();
        this.renderer.handleEvent('touchend', e);
      });
    }

    // INPUT-04 bugfix v2 Bug3 + Bug6：canvas mouse → touch 桥接
    // 依据：92-INPUT04-bugfix-v2-分析与修复方案.md §4.5 选型 X + Y 合流
    // X：仅在 wx.getSystemInfoSync().platform === 'devtools' 时启用（真机完全关闭）
    // Y：即使开启，桥接分发前检查 40ms 内是否已有真实 touch，若有则丢弃
    let _enableBridge = false;
    try {
      const _sys = wx.getSystemInfoSync ? wx.getSystemInfoSync() : null;
      if (_sys && _sys.platform === 'devtools') _enableBridge = true;
      if (typeof window !== 'undefined' && window.MOUSE_ONLY === true) _enableBridge = true;
    } catch (_) { _enableBridge = false; }

    const _canvasEl = this.canvas;
    if (_enableBridge && _canvasEl && typeof _canvasEl.addEventListener === 'function') {
      const DEDUP_MS = 40; // Y: 2 帧 @30fps 内已有 real touch 则丢弃
      let _mouseDown = false;
      const _forwardIfNoRealTouch = (mouseEv, type) => {
        if (Date.now() - this._lastRealTouchTs < DEDUP_MS) return; // 丢弃
        this.renderer.handleEvent(type, {
          touches: [{ clientX: mouseEv.clientX, clientY: mouseEv.clientY }],
          changedTouches: [{ clientX: mouseEv.clientX, clientY: mouseEv.clientY }],
          preventDefault: () => mouseEv.preventDefault && mouseEv.preventDefault(),
          _synthetic: true, // 便于调试
        });
      };
      try {
        _canvasEl.addEventListener('mousedown', (e) => {
          _mouseDown = true;
          _forwardIfNoRealTouch(e, 'touchstart');
        });
        _canvasEl.addEventListener('mousemove', (e) => {
          if (!_mouseDown) return;
          _forwardIfNoRealTouch(e, 'touchmove');
        });
        const _up = (e) => {
          if (!_mouseDown) return;
          _mouseDown = false;
          _forwardIfNoRealTouch(e, 'touchend');
        };
        _canvasEl.addEventListener('mouseup', _up);
        // 鼠标拖出 canvas 才释放时的兜底
        if (typeof window !== 'undefined' && window.addEventListener) {
          window.addEventListener('mouseup', _up);
        }
      } catch (err) {
        // 真机 / 不支持 addEventListener 时无害忽略
      }
    }
  }

  switchTo(page, params = {}) {
    if (!Object.values(PAGE).includes(page)) return;
    this.currentPage = page;
    this.pageParams = params;
  }

  render() {
    this.ctx.clearRect(0, 0, this.width, this.height);
    this.renderer.render(this.currentPage, this.pageParams);
  }
}

UIManager.PAGE = PAGE;
