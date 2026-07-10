// m24 - PageRenderer.js
// 分派到具体页面渲染：首页 / 牌桌页 / 游戏页 / 结算页
// INPUT-01：新增 table（牌桌）页面 + 发牌状态机 + 翻转动画
// INPUT-01.1：牌桌布局由 1×4 改为 2×2；扑克渲染切换到图片（带手绘降级）；进入牌桌时预加载所有素材
//   注意：本文件不修改 Deck.js / Card.js / Random.js（发牌算法/点数换算保持不变），
//        仅调整视觉与页面级状态机不涉及的布局与素材初始化

import { drawButton, hitTest, roundRect } from './Components';
import Background from './Background';
import { drawCard, preloadAllCardImages, getPreloadStats } from './CardRenderer';
import { drawDealButton } from './ButtonRenderer';
import Deck from '../core/Deck';

const PAGE = {
  INDEX: 'index',
  TABLE: 'table',
  GAME: 'game',
  RESULT: 'result',
};

// 华为 P30 竖屏 411×891 DP 下的 2×2 布局锚点（依据 21-INPUT01.1-补丁设计.md §1.2）
// 若实际 canvas 尺寸不同，采用等比缩放（见 _computeLayout）
const DESIGN_W = 411;
const DESIGN_H = 891;
const LAYOUT_ANCHOR = {
  dealBtn: { x: 155, y: 60, w: 100, h: 50 },
  cards: [
    { x: 55,  y: 200, w: 120, h: 170 }, // 左上
    { x: 236, y: 200, w: 120, h: 170 }, // 右上
    { x: 55,  y: 400, w: 120, h: 170 }, // 左下
    { x: 236, y: 400, w: 120, h: 170 }, // 右下
  ],
  hint: { x: 411 / 2, y: 620 },
};

const DEAL_STATE = {
  IDLE: 'idle',
  DEALING: 'dealing',
  DONE: 'done',
};

// 翻转动画时长（毫秒）；INPUT-01 保持一致
const CARD_FLIP_MS = 400;
const CARD_DELAY_MS = 150;

export default class PageRenderer {
  constructor(ui) {
    this.ui = ui;
    this.buttonsCache = {};
    // INPUT-01 状态（未改）
    this.deck = new Deck();
    this.dealState = DEAL_STATE.IDLE;
    this.dealtCards = [];
    this.dealStartAt = 0;
    this.dealCount = 0;
    this.background = null;
    // INPUT-01.1 新增：素材预加载状态
    this._assetsReady = false;
    this._assetsStat = null;
  }

  _ensureBackground() {
    if (!this.background) {
      this.background = new Background(this.ui.ctx, this.ui.width, this.ui.height);
    } else {
      this.background.resize(this.ui.width, this.ui.height);
    }
  }

  _ensureAssetsPreload() {
    if (this._assetsReady || this._assetsPromise) return;
    this._assetsPromise = preloadAllCardImages().then((stat) => {
      this._assetsStat = stat;
      this._assetsReady = true;
    }).catch((err) => {
      console.warn('[PageRenderer] asset preload error, will use fallback:', err);
      this._assetsReady = true;
    });
  }

  _computeLayout() {
    const sx = this.ui.width / DESIGN_W;
    const sy = this.ui.height / DESIGN_H;
    const scale = Math.min(sx, sy);
    const offsetX = (this.ui.width - DESIGN_W * scale) / 2;
    const offsetY = (this.ui.height - DESIGN_H * scale) / 2;
    const scaleRect = (r) => ({
      x: offsetX + r.x * scale,
      y: offsetY + r.y * scale,
      w: r.w * scale,
      h: r.h * scale,
    });
    return {
      scale,
      offsetX,
      offsetY,
      dealBtn: scaleRect(LAYOUT_ANCHOR.dealBtn),
      cards: LAYOUT_ANCHOR.cards.map(scaleRect),
      hint: {
        x: offsetX + LAYOUT_ANCHOR.hint.x * scale,
        y: offsetY + LAYOUT_ANCHOR.hint.y * scale,
      },
    };
  }

  render(page, params) {
    const ctx = this.ui.ctx;
    const w = this.ui.width;
    const h = this.ui.height;
    if (page === PAGE.INDEX) return this._renderIndex(ctx, w, h);
    if (page === PAGE.TABLE) {
      this._ensureAssetsPreload();
      return this._renderTable(ctx, w, h);
    }
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

  // ---------------- INDEX ----------------
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
      { key: 'table', text: '进入牌桌' },
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

  // ---------------- TABLE (INPUT-01 核心；INPUT-01.1 视觉抛光) ----------------
  _renderTable(ctx, w, h) {
    this._ensureBackground();
    this.background.render();

    const layout = this._computeLayout();

    // 返回按钮
    const backBtn = { key: 'back', text: '返回', x: 14, y: 14, w: 60, h: 30 };
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    roundRect(ctx, backBtn.x, backBtn.y, backBtn.w, backBtn.h, 6);
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('返回', backBtn.x + backBtn.w / 2, backBtn.y + backBtn.h / 2);

    // 发牌按钮
    const dealBtn = {
      key: 'deal',
      text: this.dealState === DEAL_STATE.DEALING ? '发牌中…' : '发牌',
      x: layout.dealBtn.x,
      y: layout.dealBtn.y,
      w: layout.dealBtn.w,
      h: layout.dealBtn.h,
      disabled: this.dealState === DEAL_STATE.DEALING,
    };
    drawDealButton(ctx, dealBtn);

    // 4 张牌（2×2 布局；发牌顺序：左上→右上→左下→右下 = 数组索引 0/1/2/3）
    const now = Date.now();
    for (let i = 0; i < 4; i++) {
      const pos = layout.cards[i];
      let flip = 0;
      let card = null;
      if (this.dealState === DEAL_STATE.IDLE) {
        flip = 0;
        card = null;
      } else if (this.dealState === DEAL_STATE.DEALING) {
        const startAt = this.dealStartAt + i * CARD_DELAY_MS;
        const dt = now - startAt;
        if (dt <= 0) {
          flip = 0;
          card = null;
        } else if (dt >= CARD_FLIP_MS) {
          flip = 1;
          card = this.dealtCards[i];
        } else {
          flip = dt / CARD_FLIP_MS;
          card = this.dealtCards[i];
        }
      } else {
        flip = 1;
        card = this.dealtCards[i];
      }
      drawCard(ctx, pos, card, flip);
    }

    if (this.dealState === DEAL_STATE.DEALING) {
      const totalMs = 3 * CARD_DELAY_MS + CARD_FLIP_MS;
      if (now - this.dealStartAt >= totalMs) {
        this.dealState = DEAL_STATE.DONE;
      }
    }

    // 提示文字
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const tip =
      this.dealState === DEAL_STATE.IDLE
        ? '点击"发牌"从 54 张牌中随机抽 4 张（含大小王）'
        : this.dealState === DEAL_STATE.DEALING
          ? '正在发牌…'
          : '本次发牌完成，点击"发牌"重发';
    ctx.fillText(tip, layout.hint.x, layout.hint.y);

    // 素材预加载状态 + 发牌次数
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.font = '12px sans-serif';
    const stats = getPreloadStats();
    const assetsLine = stats.started
      ? (this._assetsReady
          ? `素材：${stats.loaded}/${stats.total} 已加载${stats.failed ? `（${stats.failed} 失败已降级）` : ''}`
          : `素材加载中… ${stats.loaded + stats.failed}/${stats.total}`)
      : '素材：未开始';
    ctx.fillText(`已发牌次数：${this.dealCount}    ${assetsLine}`, layout.hint.x, layout.hint.y + 22);

    this.buttonsCache[PAGE.TABLE] = [backBtn, dealBtn];
  }

  // ---------------- GAME / RESULT （骨架保留） ----------------
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

  _dealAction() {
    if (this.dealState === DEAL_STATE.DEALING) return;
    // 每轮独立洗牌，无放回抽 4 张（算法未改）
    this.dealtCards = this.deck.deal(4);
    this.dealCount += 1;
    this.dealState = DEAL_STATE.DEALING;
    this.dealStartAt = Date.now();
  }

  _onButtonTap(page, key) {
    if (page === PAGE.INDEX) {
      if (key === 'table') this.ui.switchTo(PAGE.TABLE);
      else if (key === 'rank') wx.showToast && wx.showToast({ title: '排行榜开发中', icon: 'none' });
      else if (key === 'help')
        wx.showModal &&
          wx.showModal({
            title: '游戏说明',
            content: '系统随机给出 4 张扑克牌，使用 + - × ÷ 计算出 24 即胜利。',
            showCancel: false,
          });
    } else if (page === PAGE.TABLE) {
      if (key === 'back') this.ui.switchTo(PAGE.INDEX);
      else if (key === 'deal') this._dealAction();
    } else if (page === PAGE.GAME) {
      if (key === 'back') this.ui.switchTo(PAGE.INDEX);
    } else if (page === PAGE.RESULT) {
      if (key === 'retry') this.ui.switchTo(PAGE.GAME);
      else if (key === 'home') this.ui.switchTo(PAGE.INDEX);
    }
  }
}
