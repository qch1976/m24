// m24 - SettingsPanel.js
// INPUT-05：设置面板（模态）
// 依据：106-INPUT05 §3.3~§3.6
//
// 面板结构（设计尺寸 411×891）：
//   遮罩 [0,411]×[0,891] rgba(0,0,0,0.55)
//   面板 [25,386]×[145,745] w=361 h=600 白色圆角 12
//   标题"设置"          y=[155,195]  20px Bold #333
//   分隔线             y=[195,197]  #E0E0E0
//   分段"发牌模式"      y=[215,245]  16px SemiBold
//   Radio1 必有解      y=[255,295]
//   Radio2 随机        y=[305,345]
//   小分隔线           y=[355,357]
//   "更多功能" 灰       y=[365,395]
//   Slot row1 (3 slots) y=[405,460]
//   Slot row2 (2 slots) y=[475,530]
//   底部按钮行         y=[685,735]
//     [取消]  x=[35,206]  灰 #F0F0F0 前景 #666
//     [保存]  x=[206,376] 蓝 #3884FF 前景 #FFF

import { roundRect } from './Components';
import { loadSettings, saveSettings, DEAL_MODE } from '../core/Settings';

const DESIGN_W = 411;
const DESIGN_H = 891;

const MASK_COLOR = 'rgba(0,0,0,0.55)';
const PANEL_BG = '#FFFFFF';
const PANEL_RADIUS = 12;
const DIVIDER = '#E0E0E0';
const TEXT_DARK = '#333333';
const TEXT_SUB = '#666666';
const TEXT_MUTED = '#999999';
const TEXT_HINT = '#BBBBBB';
const RADIO_ON = '#3884FF';
const RADIO_OFF = '#CCCCCC';
const BTN_SAVE_BG = '#3884FF';
const BTN_SAVE_FG = '#FFFFFF';
const BTN_CANCEL_BG = '#F0F0F0';
const BTN_CANCEL_FG = '#666666';
const BTN_RADIUS = 12;
const SLOT_BG = 'transparent';
const SLOT_STROKE = '#DDDDDD';

const PANEL_ANCHOR = {
  panel: { x: 25, y: 145, w: 361, h: 600 },
  title: { x: 35, y: 155, w: 341, h: 40 },
  divider: { x: 25, y: 195, w: 361, h: 2 },
  section: { x: 35, y: 215, w: 341, h: 30 },
  radio1: { x: 35, y: 255, w: 341, h: 40 },
  radio2: { x: 35, y: 305, w: 341, h: 40 },
  divider2: { x: 25, y: 355, w: 361, h: 2 },
  moreLabel: { x: 35, y: 365, w: 341, h: 30 },
  slotsRow1: { x: 35, y: 405, w: 322, h: 55 }, // 3 slots
  slotsRow2: { x: 35, y: 475, w: 322, h: 55 }, // 2 slots
  cancelBtn: { x: 35, y: 685, w: 171, h: 50 },
  saveBtn: { x: 206, y: 685, w: 170, h: 50 },
};

const SLOTS_CONFIG = [
  { id: 'slot_advOp', label: '高级运算符' },
  { id: 'slot_difficulty', label: '难度' },
  { id: 'slot_timer', label: '计时' },
  { id: 'slot_score', label: '计分' },
  { id: 'slot_tbd', label: 'TBD-06' },
];

export default class SettingsPanel {
  constructor() {
    this.visible = false;
    this._pendingMode = DEAL_MODE.SOLVABLE;
    this._currentMode = DEAL_MODE.SOLVABLE;
    this._buttonRects = [];
    this._onSave = null;
  }

  /**
   * 打开面板：从 storage 读取当前 mode 作为 pending 初值
   * @param {Function} onSave 保存回调，签名 (newMode) => void
   */
  open(onSave) {
    const s = loadSettings();
    this._currentMode = s.dealMode;
    this._pendingMode = s.dealMode;
    this._onSave = onSave || null;
    this.visible = true;
    this._buttonRects = [];
  }

  close() {
    this.visible = false;
    this._buttonRects = [];
  }

  isVisible() {
    return this.visible;
  }

  getPendingMode() {
    return this._pendingMode;
  }

  getCurrentMode() {
    return this._currentMode;
  }

  _save() {
    const ok = saveSettings({ dealMode: this._pendingMode });
    if (ok) {
      this._currentMode = this._pendingMode;
      if (this._onSave) this._onSave(this._currentMode);
    }
    this.close();
    return ok;
  }

  _cancel() {
    this._pendingMode = this._currentMode;
    this.close();
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
    const { scale, ox, oy } = this._computeLayout(uiW, uiH);
    const S = (r) => ({
      x: ox + r.x * scale,
      y: oy + r.y * scale,
      w: r.w * scale,
      h: r.h * scale,
    });

    // 遮罩（全屏）
    ctx.fillStyle = MASK_COLOR;
    ctx.fillRect(0, 0, uiW, uiH);

    this._buttonRects = [];

    // 面板底色
    const panel = S(PANEL_ANCHOR.panel);
    ctx.fillStyle = PANEL_BG;
    roundRect(ctx, panel.x, panel.y, panel.w, panel.h, PANEL_RADIUS * scale);
    ctx.fill();

    // 标题
    const title = S(PANEL_ANCHOR.title);
    ctx.fillStyle = TEXT_DARK;
    ctx.font = `bold ${Math.floor(20 * scale)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('设置', title.x + title.w / 2, title.y + title.h / 2);

    // 分隔线
    const d = S(PANEL_ANCHOR.divider);
    ctx.fillStyle = DIVIDER;
    ctx.fillRect(d.x, d.y, d.w, d.h);

    // 分段标题：发牌模式
    const sec = S(PANEL_ANCHOR.section);
    ctx.fillStyle = TEXT_DARK;
    ctx.font = `600 ${Math.floor(16 * scale)}px sans-serif`;
    ctx.textAlign = 'left';
    ctx.fillText('发牌模式', sec.x, sec.y + sec.h / 2);

    // Radio1: 必有解
    this._drawRadio(ctx, S(PANEL_ANCHOR.radio1), '必有解（默认）',
      this._pendingMode === DEAL_MODE.SOLVABLE, scale);
    this._buttonRects.push({ key: 'radio:solvable', ...S(PANEL_ANCHOR.radio1) });

    // Radio2: 随机
    this._drawRadio(ctx, S(PANEL_ANCHOR.radio2), '随机（54 张任选 4，可能无解）',
      this._pendingMode === DEAL_MODE.RANDOM, scale);
    this._buttonRects.push({ key: 'radio:random', ...S(PANEL_ANCHOR.radio2) });

    // 小分隔线
    const d2 = S(PANEL_ANCHOR.divider2);
    ctx.fillStyle = DIVIDER;
    ctx.fillRect(d2.x, d2.y, d2.w, d2.h);

    // "更多功能" 标签
    const more = S(PANEL_ANCHOR.moreLabel);
    ctx.fillStyle = TEXT_MUTED;
    ctx.font = `${Math.floor(14 * scale)}px sans-serif`;
    ctx.textAlign = 'left';
    ctx.fillText('更多功能（敬请期待）', more.x, more.y + more.h / 2);

    // Slots row1 (3 slots)
    this._drawSlotsRow(ctx, S(PANEL_ANCHOR.slotsRow1), SLOTS_CONFIG.slice(0, 3), scale);
    // Slots row2 (2 slots)
    this._drawSlotsRow(ctx, S(PANEL_ANCHOR.slotsRow2), SLOTS_CONFIG.slice(3, 5), scale);

    // 底部按钮
    const cancel = S(PANEL_ANCHOR.cancelBtn);
    ctx.fillStyle = BTN_CANCEL_BG;
    roundRect(ctx, cancel.x, cancel.y, cancel.w, cancel.h, BTN_RADIUS * scale);
    ctx.fill();
    ctx.fillStyle = BTN_CANCEL_FG;
    ctx.font = `${Math.floor(16 * scale)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('取消', cancel.x + cancel.w / 2, cancel.y + cancel.h / 2);
    this._buttonRects.push({ key: 'cancel', ...cancel });

    const save = S(PANEL_ANCHOR.saveBtn);
    ctx.fillStyle = BTN_SAVE_BG;
    roundRect(ctx, save.x, save.y, save.w, save.h, BTN_RADIUS * scale);
    ctx.fill();
    ctx.fillStyle = BTN_SAVE_FG;
    ctx.fillText('保存', save.x + save.w / 2, save.y + save.h / 2);
    this._buttonRects.push({ key: 'save', ...save });
  }

  _drawRadio(ctx, rect, label, selected, scale) {
    const cy = rect.y + rect.h / 2;
    const cr = 10 * scale;
    const cx = rect.x + cr + 4 * scale;
    // 外圈
    ctx.strokeStyle = selected ? RADIO_ON : RADIO_OFF;
    ctx.lineWidth = 2 * scale;
    ctx.beginPath();
    ctx.arc(cx, cy, cr, 0, Math.PI * 2);
    ctx.stroke();
    if (selected) {
      ctx.fillStyle = RADIO_ON;
      ctx.beginPath();
      ctx.arc(cx, cy, cr * 0.55, 0, Math.PI * 2);
      ctx.fill();
    }
    // label
    ctx.fillStyle = TEXT_DARK;
    ctx.font = `${Math.floor(15 * scale)}px sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, cx + cr + 10 * scale, cy);
  }

  _drawSlotsRow(ctx, rowRect, slots, scale) {
    if (!slots || slots.length === 0) return;
    const n = slots.length;
    const gap = 11 * scale;
    const slotW = (rowRect.w - gap * (n - 1)) / n;
    for (let i = 0; i < n; i++) {
      const x = rowRect.x + i * (slotW + gap);
      const y = rowRect.y;
      // 灰色虚线描边（用 setLineDash）
      ctx.save();
      ctx.strokeStyle = SLOT_STROKE;
      ctx.lineWidth = 1 * scale;
      if (ctx.setLineDash) ctx.setLineDash([4 * scale, 3 * scale]);
      roundRect(ctx, x, y, slotW, rowRect.h, 6 * scale);
      ctx.stroke();
      if (ctx.setLineDash) ctx.setLineDash([]);
      ctx.restore();
      // 标签 + 敬请期待
      ctx.fillStyle = TEXT_MUTED;
      ctx.font = `${Math.floor(13 * scale)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(slots[i].label, x + slotW / 2, y + rowRect.h / 2 - 8 * scale);
      ctx.fillStyle = TEXT_HINT;
      ctx.font = `${Math.floor(11 * scale)}px sans-serif`;
      ctx.fillText('敬请期待', x + slotW / 2, y + rowRect.h / 2 + 10 * scale);
    }
  }

  /**
   * 命中测试。返回：
   *   'radio:solvable' | 'radio:random' | 'save' | 'cancel' | 'mask' | null
   * 点击遮罩区（面板外）→ 'mask'（调用方可选择关闭 / 保留）
   */
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
    // 判断是否在面板内
    return 'mask';
  }

  /**
   * 处理命中返回值：改 pending 或关闭。
   * 返回 { action: 'consumed'|'saved'|'cancelled'|'nothing' }
   */
  handleHit(key) {
    if (!this.visible) return { action: 'nothing' };
    if (key === 'radio:solvable') { this._pendingMode = DEAL_MODE.SOLVABLE; return { action: 'consumed' }; }
    if (key === 'radio:random')   { this._pendingMode = DEAL_MODE.RANDOM;   return { action: 'consumed' }; }
    if (key === 'save')   { this._save();  return { action: 'saved' }; }
    if (key === 'cancel') { this._cancel(); return { action: 'cancelled' }; }
    if (key === 'mask')   { this._cancel(); return { action: 'cancelled' }; }
    return { action: 'nothing' };
  }
}
