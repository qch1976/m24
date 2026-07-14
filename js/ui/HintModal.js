// m24 - HintModal.js
// INPUT-04：提示弹窗（step 状态机 + 再提示置灰不弹文案 + 关闭）
// 依据：80-INPUT04-需求分析与设计.md §7.2

import { roundRect } from './Components';

const DESIGN_W = 411;
const DESIGN_H = 891;

// 视觉常量（§7.2）
const MASK_COLOR = 'rgba(0,0,0,0.5)';
const PANEL_BG = '#FFFFFF';
const PANEL_RADIUS = 16;
const DIVIDER = '#E5E5E5';
const TITLE_COLOR = '#333333';
const CAPTION_COLOR = '#888888';
const CONTENT_COLOR = '#222222';
const BTN_PRIMARY_BG = 'rgba(56,132,255,1)';
const BTN_PRIMARY_BG_DISABLED = 'rgba(56,132,255,0.35)';
const BTN_PRIMARY_FG = '#FFFFFF';
const BTN_PRIMARY_FG_DISABLED = 'rgba(255,255,255,0.6)';
const BTN_SECONDARY_BG = 'rgba(200,200,200,1)';
const BTN_SECONDARY_FG = '#333333';
const BTN_RADIUS = 10;

// 弹窗设计尺寸（居中）
const PANEL = { x: 35, y: 280, w: 341, h: 331 };
const AGAIN_BTN = { x: 55,  y: 520, w: 140, h: 60 };
const CLOSE_BTN = { x: 216, y: 520, w: 140, h: 60 };

export default class HintModal {
  constructor() {
    this.visible = false;
    this.step = 1;               // 1 或 2
    this._steps = [null, null, null]; // 由外部传入
    this._buttonRects = [];      // [{ key:'again'|'close', x,y,w,h, disabled }]
  }

  /**
   * 打开弹窗
   * @param {[Step,Step,Step]} steps GameCore.getHintStep(1..3) 结果的三元组
   */
  open(steps) {
    if (!steps || steps.length < 2 || !steps[0] || !steps[1]) {
      // 缺步骤（无解）时不显示弹窗
      this.visible = false;
      return false;
    }
    this._steps = steps.slice(0, 3);
    this.step = 1;
    this.visible = true;
    return true;
  }

  close() {
    this.visible = false;
    this.step = 1;
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

  _scaleRect(r, ctx2) {
    return {
      x: ctx2.ox + r.x * ctx2.scale,
      y: ctx2.oy + r.y * ctx2.scale,
      w: r.w * ctx2.scale,
      h: r.h * ctx2.scale,
    };
  }

  render(ctx, uiW, uiH) {
    if (!this.visible) return;
    // 遮罩
    ctx.fillStyle = MASK_COLOR;
    ctx.fillRect(0, 0, uiW, uiH);

    const c = this._computeScale(uiW, uiH);
    const panel = this._scaleRect(PANEL, c);

    // 阴影
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.15)';
    ctx.shadowOffsetY = 4 * c.scale;
    ctx.shadowBlur = 12 * c.scale;
    ctx.fillStyle = PANEL_BG;
    roundRect(ctx, panel.x, panel.y, panel.w, panel.h, PANEL_RADIUS * c.scale);
    ctx.fill();
    ctx.restore();

    // 标题
    ctx.fillStyle = TITLE_COLOR;
    ctx.font = `bold ${Math.floor(18 * c.scale)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('提示', panel.x + panel.w / 2, panel.y + 24 * c.scale);

    // 分隔线 y=328（本地 y=48）
    ctx.fillStyle = DIVIDER;
    ctx.fillRect(panel.x, panel.y + 48 * c.scale, panel.w, 1 * c.scale);

    // 步骤计数器 y=[336,368] 本地 [56,88]
    ctx.fillStyle = CAPTION_COLOR;
    ctx.font = `${Math.floor(14 * c.scale)}px sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(`提示步骤 ${this.step}/3`, panel.x + 20 * c.scale, panel.y + 72 * c.scale);

    // 步骤内容 y=[376,496] 本地 [96,216]，居中
    const cur = this._steps[this.step - 1];
    const contentText = cur ? `${cur.lhs} ${cur.op} ${cur.rhs} = ${cur.result}` : '';
    ctx.fillStyle = CONTENT_COLOR;
    ctx.font = `bold ${Math.floor(24 * c.scale)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(contentText, panel.x + panel.w / 2, panel.y + 156 * c.scale);

    // 按钮：再提示 + 关闭
    this._buttonRects = [];
    const againDisabled = this.step >= 2;
    const againRect = this._scaleRect(AGAIN_BTN, c);
    const closeRect = this._scaleRect(CLOSE_BTN, c);

    // 再提示按钮
    ctx.fillStyle = againDisabled ? BTN_PRIMARY_BG_DISABLED : BTN_PRIMARY_BG;
    roundRect(ctx, againRect.x, againRect.y, againRect.w, againRect.h, BTN_RADIUS * c.scale);
    ctx.fill();
    ctx.fillStyle = againDisabled ? BTN_PRIMARY_FG_DISABLED : BTN_PRIMARY_FG;
    ctx.font = `bold ${Math.floor(18 * c.scale)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('再提示', againRect.x + againRect.w / 2, againRect.y + againRect.h / 2);
    this._buttonRects.push({ key: 'again', ...againRect, disabled: againDisabled });

    // 关闭按钮
    ctx.fillStyle = BTN_SECONDARY_BG;
    roundRect(ctx, closeRect.x, closeRect.y, closeRect.w, closeRect.h, BTN_RADIUS * c.scale);
    ctx.fill();
    ctx.fillStyle = BTN_SECONDARY_FG;
    ctx.font = `bold ${Math.floor(18 * c.scale)}px sans-serif`;
    ctx.fillText('关闭', closeRect.x + closeRect.w / 2, closeRect.y + closeRect.h / 2);
    this._buttonRects.push({ key: 'close', ...closeRect, disabled: false });
  }

  /**
   * 命中测试。命中返回 'again'|'close'；未命中或命中已置灰按钮 → 'consumed'（拦截但不动作）
   * @returns {'again'|'close'|'consumed'|null}
   *   - 'again'：再提示可用点击（外部据此推进 step）
   *   - 'close'：关闭
   *   - 'consumed'：遮罩内其它点击（含 step=2 时点再提示的置灰态）
   *   - null：不可能（弹窗未显示时不应调用）
   */
  hit(touch) {
    if (!this.visible) return null;
    for (const b of this._buttonRects) {
      if (touch.clientX >= b.x && touch.clientX <= b.x + b.w &&
          touch.clientY >= b.y && touch.clientY <= b.y + b.h) {
        if (b.disabled) {
          // step=2 时点再提示：直接返回，不动作、不弹文案（R-02）
          return 'consumed';
        }
        return b.key;
      }
    }
    // 遮罩上非按钮区域
    return 'consumed';
  }

  /**
   * 由外部（PageRenderer）在收到 hit==='again' 时调用，推进 step
   */
  advanceStep() {
    if (this.step < 2) this.step += 1;
  }
}
