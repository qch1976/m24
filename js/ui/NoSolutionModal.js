// m24 - NoSolutionModal.js
// INPUT-05：[无解] 按钮双分支弹窗
// 依据：106-INPUT05 §4.5 + INPUT-05.md §2
//
// 两种模式：
//   1) CELEBRATE（Solver 判无解）：庆祝弹窗，标题"本局确实无解！"，副标题"系统已确认没有 24 点解法"
//      - 底部按钮：仅"关闭"（不显示"发牌"；两分支都不自动发牌，玩家须手动点顶行[发牌]）
//   2) TOAST（Solver 判有解）：轻量提示，文案"再想想…"，1.5s 自动消失，或点关闭
//
// 视觉：沿用 Modal.js 遮罩层规格
// 严禁自动触发 deal（R-04 硬约束）

import { roundRect } from './Components';

const MASK_COLOR = 'rgba(0,0,0,0.55)';
const PANEL_BG = '#F5F7FB';
const PANEL_RADIUS = 16;
const TITLE_CEL = '#22B573';
const TITLE_TOAST = '#5B6C8D';
const TEXT_DARK = '#2E3A59';
const TEXT_SUB = '#5B6C8D';
const BTN_BG = '#4C6EF5';
const BTN_FG = '#FFFFFF';
const BTN_RADIUS = 10;

const DESIGN_W = 411;
const DESIGN_H = 891;

export const NoSolModalType = { CELEBRATE: 'celebrate', TOAST: 'toast' };
const TOAST_AUTO_MS = 1500;

export default class NoSolutionModal {
  constructor() {
    this.visible = false;
    this.type = NoSolModalType.TOAST;
    this._buttonRects = [];
    this._openAt = 0;
  }

  showCelebrate() {
    this.visible = true;
    this.type = NoSolModalType.CELEBRATE;
    this._openAt = Date.now();
    this._buttonRects = [];
  }

  showToast() {
    this.visible = true;
    this.type = NoSolModalType.TOAST;
    this._openAt = Date.now();
    this._buttonRects = [];
  }

  close() {
    this.visible = false;
    this._buttonRects = [];
  }

  isVisible() {
    // Toast 自动过期
    if (this.visible && this.type === NoSolModalType.TOAST) {
      if (Date.now() - this._openAt > TOAST_AUTO_MS) {
        this.visible = false;
        return false;
      }
    }
    return this.visible;
  }

  _computeLayout(uiW, uiH) {
    const sx = uiW / DESIGN_W;
    const sy = uiH / DESIGN_H;
    const scale = Math.min(sx, sy);
    const ox = (uiW - DESIGN_W * scale) / 2;
    const oy = (uiH - DESIGN_H * scale) / 2;
    return { scale, ox, oy };
  }

  render(ctx, uiW, uiH) {
    if (!this.isVisible()) return;
    const { scale, ox, oy } = this._computeLayout(uiW, uiH);
    const S = (r) => ({
      x: ox + r.x * scale,
      y: oy + r.y * scale,
      w: r.w * scale,
      h: r.h * scale,
    });

    // 遮罩
    ctx.fillStyle = MASK_COLOR;
    ctx.fillRect(0, 0, uiW, uiH);

    if (this.type === NoSolModalType.CELEBRATE) {
      this._renderCelebrate(ctx, S, scale);
    } else {
      this._renderToast(ctx, S, scale);
    }
  }

  _renderCelebrate(ctx, S, scale) {
    const panelW = 320;
    const panelH = 240;
    const panelX = (DESIGN_W - panelW) / 2;
    const panelY = (DESIGN_H - panelH) / 2;
    const panel = S({ x: panelX, y: panelY, w: panelW, h: panelH });

    ctx.fillStyle = PANEL_BG;
    roundRect(ctx, panel.x, panel.y, panel.w, panel.h, PANEL_RADIUS);
    ctx.fill();

    // 标题
    ctx.fillStyle = TITLE_CEL;
    ctx.font = `bold ${Math.floor(26 * scale)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('本局确实无解！', panel.x + panel.w / 2, panel.y + 60 * scale);

    // 副标题
    ctx.fillStyle = TEXT_SUB;
    ctx.font = `${Math.floor(16 * scale)}px sans-serif`;
    ctx.fillText('系统已确认没有 24 点解法', panel.x + panel.w / 2, panel.y + 105 * scale);
    ctx.fillStyle = TEXT_DARK;
    ctx.font = `${Math.floor(14 * scale)}px sans-serif`;
    ctx.fillText('请手动点"发牌"进入下一局', panel.x + panel.w / 2, panel.y + 140 * scale);

    // 关闭按钮
    const btnW = 120;
    const btnH = 42;
    const btnX = panelX + (panelW - btnW) / 2;
    const btnY = panelY + panelH - 60;
    const closeBtn = S({ x: btnX, y: btnY, w: btnW, h: btnH });
    ctx.fillStyle = BTN_BG;
    roundRect(ctx, closeBtn.x, closeBtn.y, closeBtn.w, closeBtn.h, BTN_RADIUS);
    ctx.fill();
    ctx.fillStyle = BTN_FG;
    ctx.font = `bold ${Math.floor(16 * scale)}px sans-serif`;
    ctx.fillText('关闭', closeBtn.x + closeBtn.w / 2, closeBtn.y + closeBtn.h / 2);
    this._buttonRects = [{ key: 'close', ...closeBtn }];
  }

  _renderToast(ctx, S, scale) {
    const panelW = 240;
    const panelH = 100;
    const panelX = (DESIGN_W - panelW) / 2;
    const panelY = (DESIGN_H - panelH) / 2;
    const panel = S({ x: panelX, y: panelY, w: panelW, h: panelH });

    ctx.fillStyle = PANEL_BG;
    roundRect(ctx, panel.x, panel.y, panel.w, panel.h, PANEL_RADIUS);
    ctx.fill();

    ctx.fillStyle = TITLE_TOAST;
    ctx.font = `bold ${Math.floor(22 * scale)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('再想想…', panel.x + panel.w / 2, panel.y + panel.h / 2 - 6 * scale);

    ctx.fillStyle = TEXT_SUB;
    ctx.font = `${Math.floor(13 * scale)}px sans-serif`;
    ctx.fillText('本局其实有解，加油！', panel.x + panel.w / 2, panel.y + panel.h / 2 + 22 * scale);

    // Toast 不放按钮，点面板任意处/1.5s 后关闭
    this._buttonRects = [{ key: 'close', ...panel }];
  }

  hit(touch) {
    for (const b of this._buttonRects) {
      if (
        touch.clientX >= b.x &&
        touch.clientX <= b.x + b.w &&
        touch.clientY >= b.y &&
        touch.clientY <= b.y + b.h
      ) {
        return b.key;
      }
    }
    return null;
  }
}
