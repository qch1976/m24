// m24 - AnswerModal.js
// INPUT-04：答案弹窗（滚动列表 + 共 N 个解 + 关闭）
// 依据：80-INPUT04-需求分析与设计.md §7.3 §7.4

import { roundRect } from './Components';

const DESIGN_W = 411;
const DESIGN_H = 891;

// 视觉常量
const MASK_COLOR = 'rgba(0,0,0,0.5)';
const PANEL_BG = '#FFFFFF';
const PANEL_RADIUS = 16;
const DIVIDER = '#E5E5E5';
const TITLE_COLOR = '#333333';
const CAPTION_COLOR = '#666666';
const ITEM_COLOR = '#333333';
const LIST_BG = '#F7F7F7';
const LIST_SEP = 'rgba(0,0,0,0.05)';
const SCROLLBAR_COLOR = 'rgba(0,0,0,0.2)';
const BTN_PRIMARY_BG = 'rgba(56,132,255,1)';
const BTN_PRIMARY_FG = '#FFFFFF';
const BTN_RADIUS = 10;

// 设计尺寸（§7.3）——Bug4 A+ 方案：弹窗收窄到 341 DP（左右各留 35 DP）
const PANEL = { x: 53, y: 140, w: 305, h: 611 };
const LIST_CONTAINER = { x: 61, y: 240, w: 289, h: 440 };
const CLOSE_BTN = { x: 130, y: 691, w: 151, h: 50 };

const ITEM_HEIGHT = 44;      // 每项高度 DP
const ITEM_GAP = 8;          // 项间距 DP
const ITEM_STRIDE = ITEM_HEIGHT + ITEM_GAP; // 52 DP
const LIST_PAD_TOP = 12;
const LIST_PAD_LR = 16;
const ITEM_FONT_SIZE = 17;   // Bug4-v2 方案（选型 C 混合）：16 → 17 px

export default class AnswerModal {
  constructor() {
    this.visible = false;
    this._solutions = []; // string[]
    this._scrollY = 0;    // DP 单位（在设计坐标空间下）
    this._buttonRects = [];
    // 触摸拖拽状态
    this._dragging = false;
    this._dragStartClientY = 0;
    this._dragStartScrollY = 0;
    this._lastActiveTs = 0;
  }

  /**
   * 打开答案弹窗
   * @param {string[]} solutions 全解字符串数组（外部保证已去重 & 已排序）
   */
  open(solutions) {
    this._solutions = Array.isArray(solutions) ? solutions.slice() : [];
    this._scrollY = 0;
    this.visible = true;
    this._lastActiveTs = Date.now();
  }

  close() {
    this.visible = false;
    this._dragging = false;
  }

  isVisible() {
    return this.visible;
  }

  _computeScale(uiW, uiH) {
    const sx = uiW / DESIGN_W;
    const sy = uiH / DESIGN_H;
    const scale = Math.min(sx, sy);
    const ox = (uiW - DESIGN_W * scale) / 2;
    const oy = (uiH - DESIGN_H * scale) / 2;
    return { scale, ox, oy };
  }

  _scaleRect(r, c) {
    return {
      x: c.ox + r.x * c.scale,
      y: c.oy + r.y * c.scale,
      w: r.w * c.scale,
      h: r.h * c.scale,
    };
  }

  _contentHeightDP() {
    // 全部项占用高度：n 项，每项 44 + gap 8，最后不带尾 gap
    const n = this._solutions.length;
    if (n <= 0) return 0;
    return n * ITEM_HEIGHT + (n - 1) * ITEM_GAP;
  }

  _viewportHeightDP() {
    // 列表容器内可视高度：h - 2*pad_top
    return LIST_CONTAINER.h - 2 * LIST_PAD_TOP;
  }

  _maxScrollDP() {
    const overflow = this._contentHeightDP() - this._viewportHeightDP();
    return overflow > 0 ? overflow : 0;
  }

  render(ctx, uiW, uiH) {
    if (!this.visible) return;
    // 遮罩
    ctx.fillStyle = MASK_COLOR;
    ctx.fillRect(0, 0, uiW, uiH);

    const c = this._computeScale(uiW, uiH);
    const panel = this._scaleRect(PANEL, c);

    // 弹窗
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.15)';
    ctx.shadowOffsetY = 4 * c.scale;
    ctx.shadowBlur = 12 * c.scale;
    ctx.fillStyle = PANEL_BG;
    roundRect(ctx, panel.x, panel.y, panel.w, panel.h, PANEL_RADIUS * c.scale);
    ctx.fill();
    ctx.restore();

    // 标题栏
    ctx.fillStyle = TITLE_COLOR;
    ctx.font = `bold ${Math.floor(18 * c.scale)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('所有答案', panel.x + panel.w / 2, panel.y + 24 * c.scale);

    // 分隔线 y=188（本地 y=48）
    ctx.fillStyle = DIVIDER;
    ctx.fillRect(panel.x, panel.y + 48 * c.scale, panel.w, 1 * c.scale);

    // "共 N 个解" y=[196,232] 本地 [56,92]
    ctx.fillStyle = CAPTION_COLOR;
    ctx.font = `${Math.floor(14 * c.scale)}px sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(`共 ${this._solutions.length} 个解`, panel.x + 20 * c.scale, panel.y + 74 * c.scale);

    // 列表容器
    const listRect = this._scaleRect(LIST_CONTAINER, c);
    ctx.fillStyle = LIST_BG;
    roundRect(ctx, listRect.x, listRect.y, listRect.w, listRect.h, 8 * c.scale);
    ctx.fill();

    // 内部裁剪
    ctx.save();
    ctx.beginPath();
    // 剪切区域略微内缩以避免圆角外露
    ctx.rect(listRect.x, listRect.y + LIST_PAD_TOP * c.scale,
             listRect.w, this._viewportHeightDP() * c.scale);
    ctx.clip();

    // 渲染可见项
    const scrollPX = this._scrollY * c.scale;
    ctx.fillStyle = ITEM_COLOR;
    ctx.font = `${Math.floor(ITEM_FONT_SIZE * c.scale)}px sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';

    // 虚拟化：只画首尾 index 范围内的项
    const viewportTopDP = this._scrollY;
    const viewportBotDP = this._scrollY + this._viewportHeightDP();
    const firstIdx = Math.max(0, Math.floor(viewportTopDP / ITEM_STRIDE) - 1);
    const lastIdx = Math.min(this._solutions.length - 1,
                             Math.ceil(viewportBotDP / ITEM_STRIDE) + 1);

    for (let i = firstIdx; i <= lastIdx && i >= 0 && i < this._solutions.length; i++) {
      const itemTopDP = i * ITEM_STRIDE;
      // 相对列表容器顶（内容坐标）
      const yInList = listRect.y + (LIST_PAD_TOP + itemTopDP - this._scrollY) * c.scale;
      const xInList = listRect.x + LIST_PAD_LR * c.scale;

      // 分隔线（在项之间；最后一项不画）
      if (i < this._solutions.length - 1) {
        const sepY = yInList + ITEM_HEIGHT * c.scale + (ITEM_GAP / 2) * c.scale;
        ctx.save();
        ctx.fillStyle = LIST_SEP;
        ctx.fillRect(listRect.x + LIST_PAD_LR * c.scale, sepY,
                     listRect.w - 2 * LIST_PAD_LR * c.scale, 1 * c.scale);
        ctx.restore();
      }

      const text = this._solutions[i] + ' = 24';
      ctx.fillStyle = ITEM_COLOR;
      ctx.fillText(text, xInList, yInList + (ITEM_HEIGHT / 2) * c.scale);
    }
    ctx.restore();

    // 滚动条
    const maxScroll = this._maxScrollDP();
    if (maxScroll > 0 && Date.now() - this._lastActiveTs < 1500) {
      const viewportH = this._viewportHeightDP();
      const contentH = this._contentHeightDP();
      const barH = Math.max(24, viewportH * viewportH / contentH); // DP
      const barTravel = viewportH - barH;
      const barTop = LIST_PAD_TOP + (this._scrollY / maxScroll) * barTravel;
      const barX = LIST_CONTAINER.x + LIST_CONTAINER.w - 8; // 距右 4 DP + 宽 4 DP
      const barW = 4;
      const barRectDesign = { x: barX, y: LIST_CONTAINER.y + barTop, w: barW, h: barH };
      const barRect = this._scaleRect(barRectDesign, c);
      ctx.fillStyle = SCROLLBAR_COLOR;
      roundRect(ctx, barRect.x, barRect.y, barRect.w, barRect.h, 2 * c.scale);
      ctx.fill();
    }

    // 关闭按钮
    this._buttonRects = [];
    const closeRect = this._scaleRect(CLOSE_BTN, c);
    ctx.fillStyle = BTN_PRIMARY_BG;
    roundRect(ctx, closeRect.x, closeRect.y, closeRect.w, closeRect.h, BTN_RADIUS * c.scale);
    ctx.fill();
    ctx.fillStyle = BTN_PRIMARY_FG;
    ctx.font = `bold ${Math.floor(18 * c.scale)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('关闭', closeRect.x + closeRect.w / 2, closeRect.y + closeRect.h / 2);
    this._buttonRects.push({ key: 'close', ...closeRect });

    // 缓存 list 尺寸以便 hit 判定
    this._listRect = listRect;
    this._scaleCache = c;
  }

  /**
   * 触摸开始：可能是关闭按钮点击或列表拖拽起点
   */
  onTouchStart(touch) {
    if (!this.visible) return;
    if (this._hitCloseBtn(touch)) {
      this._pendingCloseHit = true;
      return;
    }
    this._pendingCloseHit = false;
    if (this._hitListArea(touch)) {
      this._dragging = true;
      this._dragStartClientY = touch.clientY;
      this._dragStartScrollY = this._scrollY;
      this._lastActiveTs = Date.now();
    }
  }

  onTouchMove(touch) {
    if (!this.visible || !this._dragging || !this._scaleCache) return;
    const c = this._scaleCache;
    const dyPx = touch.clientY - this._dragStartClientY;
    const dyDP = dyPx / c.scale;
    let ns = this._dragStartScrollY - dyDP;
    const maxS = this._maxScrollDP();
    if (ns < 0) ns = 0;
    if (ns > maxS) ns = maxS;
    this._scrollY = ns;
    this._lastActiveTs = Date.now();
  }

  onTouchEnd(touch) {
    if (!this.visible) return;
    if (this._dragging) {
      this._dragging = false;
      return;
    }
    if (this._pendingCloseHit && this._hitCloseBtn(touch)) {
      this._pendingCloseHit = false;
      return; // 由 hit() 返回 'close' 让外部处理
    }
    this._pendingCloseHit = false;
  }

  _hitCloseBtn(touch) {
    for (const b of this._buttonRects) {
      if (b.key === 'close' &&
          touch.clientX >= b.x && touch.clientX <= b.x + b.w &&
          touch.clientY >= b.y && touch.clientY <= b.y + b.h) {
        return true;
      }
    }
    return false;
  }

  _hitListArea(touch) {
    const r = this._listRect;
    if (!r) return false;
    return (touch.clientX >= r.x && touch.clientX <= r.x + r.w &&
            touch.clientY >= r.y && touch.clientY <= r.y + r.h);
  }

  /**
   * 命中测试。'close' / 'consumed'（遮罩其它区域不关闭）
   */
  hit(touch) {
    if (!this.visible) return null;
    if (this._hitCloseBtn(touch)) return 'close';
    return 'consumed';
  }
}
