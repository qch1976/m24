// m24 - Modal.js
// INPUT-03：结果反馈弹层（庆祝 / 失败），模态遮罩
// 视觉沿用现有牌桌配色（不改 Components.js）

import { roundRect } from './Components';

const MASK_COLOR = 'rgba(0,0,0,0.55)';
const PANEL_BG = '#F5F7FB';
const PANEL_RADIUS = 16;
const TITLE_PASS = '#22B573';
const TITLE_FAIL = '#E85D75';
const TEXT_DARK = '#2E3A59';
const TEXT_SUB = '#5B6C8D';
const BTN_BG_PRIMARY = '#4C6EF5';
const BTN_BG_SECONDARY = '#8896AB';
const BTN_FG = '#FFFFFF';
const BTN_RADIUS = 10;

// 弹层配置：设计尺寸下的锚点
const DESIGN_W = 411;
const DESIGN_H = 891;

export const ModalType = { PASS: 'pass', FAIL: 'fail' };

export default class Modal {
  constructor() {
    this.visible = false;
    this.type = ModalType.FAIL;
    this.title = '';
    this.message = '';
    this.formulaText = '';
    this._buttonRects = [];
  }

  showPass(formulaText) {
    this.visible = true;
    this.type = ModalType.PASS;
    this.title = '恭喜！';
    this.message = '';
    this.formulaText = formulaText + '=24';
  }

  showFail(reasonText) {
    this.visible = true;
    this.type = ModalType.FAIL;
    this.title = '未算出 24';
    this.message = reasonText;
    this.formulaText = '';
  }

  close() {
    this.visible = false;
  }

  isVisible() {
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
    if (!this.visible) return;
    // 遮罩
    ctx.fillStyle = MASK_COLOR;
    ctx.fillRect(0, 0, uiW, uiH);

    const { scale, ox, oy } = this._computeLayout(uiW, uiH);
    const S = (r) => ({
      x: ox + r.x * scale,
      y: oy + r.y * scale,
      w: r.w * scale,
      h: r.h * scale,
    });

    // 面板 320×280 居中
    const panelW = 320;
    const panelH = 280;
    const panelX = (DESIGN_W - panelW) / 2;
    const panelY = (DESIGN_H - panelH) / 2;
    const panel = S({ x: panelX, y: panelY, w: panelW, h: panelH });

    ctx.fillStyle = PANEL_BG;
    roundRect(ctx, panel.x, panel.y, panel.w, panel.h, PANEL_RADIUS);
    ctx.fill();

    // 标题
    ctx.fillStyle = this.type === ModalType.PASS ? TITLE_PASS : TITLE_FAIL;
    ctx.font = `bold ${Math.floor(30 * scale)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.title, panel.x + panel.w / 2, panel.y + 60 * scale);

    // 内容
    ctx.fillStyle = TEXT_DARK;
    ctx.font = `${Math.floor(18 * scale)}px sans-serif`;
    if (this.type === ModalType.PASS) {
      ctx.fillText(this.formulaText, panel.x + panel.w / 2, panel.y + 130 * scale);
    } else {
      // 手动换行（防止过长挤出面板）
      const wrap = this._wrapText(ctx, this.message, panel.w - 40 * scale);
      const yStart = panel.y + 130 * scale;
      wrap.forEach((line, idx) => {
        ctx.fillText(line, panel.x + panel.w / 2, yStart + idx * 24 * scale);
      });
    }

    // 按钮
    this._buttonRects = [];
    const btnH = 42;
    const btnGap = 16;
    if (this.type === ModalType.PASS) {
      const btnW = 100;
      const totalW = btnW * 2 + btnGap;
      const startX = panelX + (panelW - totalW) / 2;
      const btnY = panelY + panelH - 60;
      const closeBtn = S({ x: startX, y: btnY, w: btnW, h: btnH });
      const nextBtn = S({ x: startX + btnW + btnGap, y: btnY, w: btnW, h: btnH });
      this._drawBtn(ctx, closeBtn, '关闭', BTN_BG_SECONDARY, scale);
      this._drawBtn(ctx, nextBtn, '下一局', BTN_BG_PRIMARY, scale);
      this._buttonRects.push({ key: 'close', ...closeBtn });
      this._buttonRects.push({ key: 'next', ...nextBtn });
    } else {
      const btnW = 120;
      const btnX = panelX + (panelW - btnW) / 2;
      const btnY = panelY + panelH - 60;
      const closeBtn = S({ x: btnX, y: btnY, w: btnW, h: btnH });
      this._drawBtn(ctx, closeBtn, '关闭', BTN_BG_SECONDARY, scale);
      this._buttonRects.push({ key: 'close', ...closeBtn });
    }
  }

  _drawBtn(ctx, rect, text, bg, scale) {
    ctx.fillStyle = bg;
    roundRect(ctx, rect.x, rect.y, rect.w, rect.h, BTN_RADIUS);
    ctx.fill();
    ctx.fillStyle = BTN_FG;
    ctx.font = `bold ${Math.floor(16 * scale)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, rect.x + rect.w / 2, rect.y + rect.h / 2);
  }

  _wrapText(ctx, text, maxWidth) {
    if (!text) return [];
    // 中文按字符切；简单实现
    const chars = text.split('');
    const lines = [];
    let cur = '';
    for (const ch of chars) {
      const w = ctx.measureText(cur + ch).width;
      if (w > maxWidth && cur) {
        lines.push(cur);
        cur = ch;
      } else {
        cur += ch;
      }
    }
    if (cur) lines.push(cur);
    return lines;
  }

  /**
   * 命中测试
   * @returns 'close' | 'next' | null
   */
  hit(touch) {
    for (const b of this._buttonRects) {
      if (touch.clientX >= b.x && touch.clientX <= b.x + b.w &&
          touch.clientY >= b.y && touch.clientY <= b.y + b.h) {
        return b.key;
      }
    }
    return null;
  }
}
