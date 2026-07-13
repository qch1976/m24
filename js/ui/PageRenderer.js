// m24 - PageRenderer.js
// 分派到具体页面渲染：首页 / 牌桌页 / 游戏页 / 结算页
// INPUT-01：新增 table（牌桌）页面 + 发牌状态机 + 翻转动画
// INPUT-01.1：牌桌布局由 1×4 改为 2×2；扑克渲染切换到图片（带手绘降级）；进入牌桌时预加载所有素材
//   注意：本文件不修改 Deck.js / Card.js / Random.js（发牌算法/点数换算保持不变），
//        仅调整视觉与页面级状态机不涉及的布局与素材初始化

import { drawButton, hitTest, roundRect } from './Components';
import Background from './Background';
import { drawCard, preloadAllCardImages } from './CardRenderer';
import { drawDealButton } from './ButtonRenderer';
import Deck from '../core/Deck';
import AnswerArea from './AnswerArea';
import Modal from './Modal';

const PAGE = {
  INDEX: 'index',
  TABLE: 'table',
  GAME: 'game',
  RESULT: 'result',
};

// 华为 P30 竖屏 411×891 DP 下的 2×2 布局锚点（INPUT-01.1）
// INPUT-03：卡牌上移 100 DP（Architect 60 号 §2.2）为答题区腾空间；
//   - top 行 y: 200 → 100
//   - bottom 行 y: 400 → 300
//   - dealBtn y 保留 60（在卡牌上方）
// INPUT-03 bugfix（Architect 72 号 v2 §4/§6）：
//   - 卡牌顶行 y: 100 → 118（下移 18 DP，避免与发牌按钮 y∈[60,110] x 重叠区 [155,175]/[236,255] 的 10 DP 遮盖）
//   - 卡牌底行 y: 300 → 304（下移 4 DP，保证卡牌行间距 = 16 DP）
//   - 删除 hint（“本次发牌…” 提示文字与素材加载状态渲染），并同步移除 LAYOUT_ANCHOR.hint
const DESIGN_W = 411;
const DESIGN_H = 891;
const LAYOUT_ANCHOR = {
  dealBtn: { x: 155, y: 60, w: 100, h: 50 },
  cards: [
    { x: 55,  y: 118, w: 120, h: 170 }, // 左上（INPUT-03 bugfix：下移 18 DP）
    { x: 236, y: 118, w: 120, h: 170 }, // 右上（INPUT-03 bugfix：下移 18 DP）
    { x: 55,  y: 304, w: 120, h: 170 }, // 左下（INPUT-03 bugfix：下移 4 DP）
    { x: 236, y: 304, w: 120, h: 170 }, // 右下（INPUT-03 bugfix：下移 4 DP）
  ],
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
    // INPUT-03 新增：答题区 + 弹层
    this.answerArea = new AnswerArea();
    this.modal = new Modal();
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

    // INPUT-03：在 TABLE 页优先处理弹层与答题区
    if (page === PAGE.TABLE) {
      if (this.modal.isVisible()) {
        const modalHit = this.modal.hit(touch);
        if (modalHit === 'close') {
          this.modal.close();
          return;
        }
        if (modalHit === 'next') {
          this.modal.close();
          this._dealAction();
          return;
        }
        // 遮罩内其他区域无响应
        return;
      }
      // 答题区命中优先
      const hitBtn = this.answerArea.hitButton(touch);
      if (hitBtn) {
        const r = this.answerArea.handleButton(hitBtn);
        if (r.action === 'submit') {
          this._doSubmit();
        }
        return;
      }
    }

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

    // INPUT-03 bugfix（Architect 72 号 v2 §6）：
    //   删除“本次发牌…”提示文字与素材加载状态渲染，为答题区（y=490 起）腾出空间；
    //   同步移除对 layout.hint / getPreloadStats / this.dealCount(渲染) 的引用。

    // INPUT-03：答题区（发牌完成后才可用）
    this.answerArea.setEnabled(this.dealState === DEAL_STATE.DONE);
    this.answerArea.render(ctx, w, h);

    // INPUT-03：结果弹层（需在最上层）
    this.modal.render(ctx, w, h);

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
    // INPUT-02：仅以下 2 行改动（Manager 方案 X 批准的最小 diff）：
    //   1) deal(4) → dealSolvable(4)（保证发牌可解）
    //   2) 拿到 4 张后调用 gameCore.recordSolutions(cards) 持有全解（R-03）
    // 布局 / 翻牌动画 / 状态机 / 按钮 / 文字 / 视觉常量均保持不变
    this.dealtCards = this.deck.dealSolvable(4);
    if (this.ui && this.ui.gameCore && typeof this.ui.gameCore.recordSolutions === 'function') {
      this.ui.gameCore.recordSolutions(this.dealtCards);
    }
    this.dealCount += 1;
    this.dealState = DEAL_STATE.DEALING;
    this.dealStartAt = Date.now();

    // INPUT-03：重置答题区与弹层，并同步牌面值
    if (this.answerArea) {
      this.answerArea.reset();
      this.answerArea.setCardValues(this.dealtCards.map((c) => (c && typeof c.value === 'number' ? c.value : 0)));
      this.answerArea.setEnabled(false); // 等 DONE 后在 _renderTable 重新启用
    }
    if (this.modal) this.modal.close();
  }

  // INPUT-03（Architect 60 号修订版）：提交处理
  // GameCore.checkAnswer 已保证只返回 2 类失败：not_24 / division_by_zero
  // 本方法不再为其他 reason 兼容写文案（已在 GameCore 层降级）
  _doSubmit() {
    if (!this.answerArea.canSubmit()) return;
    const tokens = this.answerArea.getTokens();
    const cardValues = this.answerArea.cardValues;
    const gc = this.ui && this.ui.gameCore;
    if (!gc || typeof gc.checkAnswer !== 'function') {
      // 不应发生；保护不崩
      console.error('[PageRenderer._doSubmit] gameCore.checkAnswer missing');
      return;
    }
    const result = gc.checkAnswer(tokens, cardValues);
    if (result.pass) {
      this.modal.showPass(this.answerArea.getFormulaText());
      return;
    }
    // 仅两类失败文案（严禁泄题：不引用 getSolutions）
    let msg;
    if (result.reason === 'division_by_zero') {
      msg = '算式包含除零，无法求值';
    } else {
      // reason === 'not_24'（GameCore 降级保证）
      const label = result.actualLabel != null ? result.actualLabel : String(result.actualValue);
      msg = `结果 = ${label}`;
    }
    this.modal.showFail(msg);
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
