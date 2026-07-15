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

    // 触摸事件分发
    if (wx.onTouchStart) {
      wx.onTouchStart((e) => this.renderer.handleEvent('touchstart', e));
      wx.onTouchMove((e) => this.renderer.handleEvent('touchmove', e));
      wx.onTouchEnd((e) => this.renderer.handleEvent('touchend', e));
    }

    // INPUT-04 bugfix Bug3：canvas mouse → touch 桥接（模拟器 PC 鼠标兼容）
    // 依据：87-INPUT04-bugfix-分析与修复方案.md §3.2
    // 真机：canvas.addEventListener 不会触发 mouse 事件，上面的 wx.onTouch* 主通路完全不变
    const _canvasEl = this.canvas;
    if (_canvasEl && typeof _canvasEl.addEventListener === 'function') {
      let _mouseDown = false;
      const _toTouchEvent = (mouseEv) => ({
        touches: [{ clientX: mouseEv.clientX, clientY: mouseEv.clientY }],
        changedTouches: [{ clientX: mouseEv.clientX, clientY: mouseEv.clientY }],
        preventDefault: () => mouseEv.preventDefault && mouseEv.preventDefault(),
      });
      try {
        _canvasEl.addEventListener('mousedown', (e) => {
          _mouseDown = true;
          this.renderer.handleEvent('touchstart', _toTouchEvent(e));
        });
        _canvasEl.addEventListener('mousemove', (e) => {
          if (!_mouseDown) return; // 只在按住时映射（Touch 语义一致）
          this.renderer.handleEvent('touchmove', _toTouchEvent(e));
        });
        const _up = (e) => {
          if (!_mouseDown) return;
          _mouseDown = false;
          this.renderer.handleEvent('touchend', _toTouchEvent(e));
        };
        _canvasEl.addEventListener('mouseup', _up);
        // 鼠标拖出 canvas 才释放时的兑底
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
