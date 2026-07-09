// m24 - UIManager.js
// UI 管理器：拿到 canvas 上下文，负责场景切换与顶层渲染入口（骨架版）

import PageRenderer from './PageRenderer';

const PAGE = {
  INDEX: 'index',
  GAME: 'game',
  RESULT: 'result',
};

export default class UIManager {
  constructor() {
    this.canvas = typeof canvas !== 'undefined' ? canvas : wx.createCanvas();
    this.ctx = this.canvas.getContext('2d');
    const sys = wx.getSystemInfoSync ? wx.getSystemInfoSync() : { windowWidth: 375, windowHeight: 667 };
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
