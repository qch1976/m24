// m24 - PageRenderer.js
// 分派到具体页面渲染：首页 / 游戏页 / 结算页（骨架版）

import { drawButton, hitTest, roundRect } from './Components';

const PAGE = {
  INDEX: 'index',
  GAME: 'game',
  RESULT: 'result',
};

export default class PageRenderer {
  constructor(ui) {
    this.ui = ui;
    this.buttonsCache = {};
  }

  render(page, params) {
    const ctx = this.ui.ctx;
    const w = this.ui.width;
    const h = this.ui.height;
    if (page === PAGE.INDEX) return this._renderIndex(ctx, w, h);
    if (page === PAGE.GAME) return this._renderGame(ctx, w, h, params);
    if (page === PAGE.RESULT) return this._renderResult(ctx, w, h, params);
  }

  handleEvent(type, event) {
    if (type !== 'touchend') return;
    const touch = (event.changedTouches && event.changedTouches[0]) || (event.touches && event.touches[0]);
    if (!touch) return;
    const page = this.ui.currentPage;
    const buttons = this.buttonsCache[page] || [];
    for (const btn of buttons) {
      if (hitTest(touch, btn)) {
        this._onButtonTap(page, btn.key);
        return;
      }
    }
  }

  _renderIndex(ctx, w, h) {
    ctx.fillStyle = '#F5F7FB';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#2E3A59';
    ctx.font = 'bold 40px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('24 点小游戏', w / 2, h * 0.25);
    ctx.font = '16px sans-serif';
    ctx.fillStyle = '#8896AB';
    ctx.fillText('用 + - × ÷ 让四个数字算出 24', w / 2, h * 0.25 + 40);

    const btnW = w * 0.6;
    const btnH = 56;
    const gap = 20;
    const startY = h * 0.45;
    const buttons = [
      { key: 'start', text: '开始游戏' },
      { key: 'rank', text: '排行榜' },
      { key: 'help', text: '游戏说明' },
    ].map((b, i) => ({
      ...b,
      x: (w - btnW) / 2,
      y: startY + i * (btnH + gap),
      w: btnW,
      h: btnH,
    }));
    buttons.forEach((btn) => drawButton(ctx, btn));
    this.buttonsCache[PAGE.INDEX] = buttons;
  }

  _renderGame(ctx, w, h, params) {
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, w, h);
    const backBtn = { key: 'back', text: '返回', x: 20, y: 30, w: 60, h: 32 };
    ctx.fillStyle = '#E9ECEF';
    roundRect(ctx, backBtn.x, backBtn.y, backBtn.w, backBtn.h, 6);
    ctx.fill();
    ctx.fillStyle = '#2E3A59';
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('返回', backBtn.x + backBtn.w / 2, backBtn.y + backBtn.h / 2);
    this.buttonsCache[PAGE.GAME] = [backBtn];

    const numbers = (params && params.numbers) || [1, 2, 3, 4];
    const cardW = 60;
    const cardH = 80;
    const gap = 16;
    const totalW = numbers.length * cardW + (numbers.length - 1) * gap;
    const startX = (w - totalW) / 2;
    const cardY = h * 0.35;
    numbers.forEach((n, i) => {
      const x = startX + i * (cardW + gap);
      ctx.fillStyle = '#4C6EF5';
      roundRect(ctx, x, cardY, cardW, cardH, 8);
      ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 32px sans-serif';
      ctx.fillText(String(n), x + cardW / 2, cardY + cardH / 2);
    });

    ctx.font = '14px sans-serif';
    ctx.fillStyle = '#8896AB';
    ctx.fillText('（核心玩法交互将在后续迭代实现）', w / 2, h * 0.55);
  }

  _renderResult(ctx, w, h, params) {
    ctx.fillStyle = '#F5F7FB';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#2E3A59';
    ctx.font = 'bold 32px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('本局结束', w / 2, h * 0.25);
    ctx.font = '18px sans-serif';
    ctx.fillText(`得分：${(params && params.score) || 0}`, w / 2, h * 0.35);
    ctx.fillText(`用时：${((params && params.time) || 0).toFixed(1)}s`, w / 2, h * 0.4);
    if (params && params.solution) {
      ctx.fillText(`参考解：${params.solution}`, w / 2, h * 0.45);
    }

    const btnW = w * 0.6;
    const btnH = 56;
    const gap = 16;
    const startY = h * 0.6;
    const buttons = [
      { key: 'retry', text: '再来一局' },
      { key: 'home', text: '返回首页' },
    ].map((b, i) => ({
      ...b,
      x: (w - btnW) / 2,
      y: startY + i * (btnH + gap),
      w: btnW,
      h: btnH,
    }));
    buttons.forEach((btn) => drawButton(ctx, btn));
    this.buttonsCache[PAGE.RESULT] = buttons;
  }

  _onButtonTap(page, key) {
    if (page === PAGE.INDEX) {
      if (key === 'start') this.ui.switchTo(PAGE.GAME);
      else if (key === 'rank') wx.showToast && wx.showToast({ title: '排行榜开发中', icon: 'none' });
      else if (key === 'help')
        wx.showModal &&
          wx.showModal({
            title: '游戏说明',
            content: '系统随机给出 4 个 1-13 的数字，使用 + - × ÷ 计算出 24 即胜利。',
            showCancel: false,
          });
    } else if (page === PAGE.GAME) {
      if (key === 'back') this.ui.switchTo(PAGE.INDEX);
    } else if (page === PAGE.RESULT) {
      if (key === 'retry') this.ui.switchTo(PAGE.GAME);
      else if (key === 'home') this.ui.switchTo(PAGE.INDEX);
    }
  }
}
