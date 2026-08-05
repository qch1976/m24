// m24 - AnswerArea.js
// INPUT-03：答题区组件（算式显示条 + 4 数字键 + 6 运算键 + 3 控制键）
// 依据：60-INPUT03-需求分析与设计.md
//   - 卡牌上移 100 DP（PageRenderer 侧处理），答题区落在 y=500 起
//   - 沿用牌桌配色/圆角/字体（新建常量与既有视觉一致，不改 Components/Background/CardRenderer）
//   - 前端硬约束：非法算式 / 未用满 4 张 → 提交置灰

import { roundRect } from './Components';

// 视觉常量
// task-81 / task-85｜INPUT-06 §1.7 答题区背景视觉：
//   原 rgba(0,0,0,0.30) → task-81 改 0.50 → task-85 定值 **0.60**。
//   项目主 2026-08-05 20:53 裁定「就是半透明」⇒ 不做毛玻璃/模糊；
//   22:25 实机验收「透明度还是太少」⇒ 定值 0.60（与架构师 197 号三选推荐一致）。
//   故不引入 ctx.filter、不做离屏 canvas，逐帧开销与改前完全一致（仍是一次 roundRect+fill）。
//   仅改答题区自身背景，不触碰 Background.js（在 6 保护清单内）。
//   ⚠️ 改此值必须同步 selftest/selftest_task81_bg.mjs 的硬断言期望值。
const BG_COLOR = 'rgba(0,0,0,0.60)';
const FORMULA_BG = 'rgba(255,255,255,0.12)';
const FORMULA_TEXT = '#FFFFFF';
const BTN_BG_NUM = '#4C6EF5';
const BTN_BG_OP = '#5B7CFA';
const BTN_BG_CTRL = '#2E3A59';
const BTN_BG_DISABLED = 'rgba(255,255,255,0.15)';
const BTN_BG_SUBMIT_ON = '#22B573';
const BTN_FG = '#FFFFFF';
const BTN_FG_DISABLED = 'rgba(255,255,255,0.35)';
const BTN_RADIUS = 10;
const AREA_RADIUS = 14;

// Token 类型
export const TokenType = {
  NUMBER: 'number',
  OPERATOR: 'operator',
  LEFT_PAREN: 'left_paren',
  RIGHT_PAREN: 'right_paren',
  RECIP: 'recip',        // ★ INPUT-06 新增：倒数 1/x（前缀单目，操作数只能是叶子）
};

const OP_DISPLAY = { '+': '+', '-': '-', '*': '×', '/': '÷' };

// 答题区在 411×891 DP 设计尺寸下的锚点（Architect §2.3）
// INPUT-03 bugfix（Architect 72 号 v2 §4）：全部 y 坐标上移 10 DP，
//   与卡牌底行新 y∈[304,474] 保持 16 DP 安全间距，且区底部 y+h = 870 ≤ 891。
export const ANSWER_ANCHOR = {
  // 答题区顶边下移 30 DP，底边不变：y+30, h-30  
  area:      { x: 15,  y: 520, w: 381, h: 350 },
  formula:   { x: 25,  y: 532, w: 361, h: 56  },
  // 数字键区 y=600，高 60；4 键等宽
  numRow:    { x: 25,  y: 600, w: 361, h: 60,  cols: 4, gap: 8 },
  // 运算键区 y=670，6 键
  opRow:     { x: 25,  y: 670, w: 361, h: 60,  cols: 6, gap: 6 },
  // 控制键区 y=740，4 键（INPUT-05：cols=3→4，新增 [无解] 按钮）
  ctrlRow:   { x: 25,  y: 740, w: 361, h: 60,  cols: 4, gap: 10 },
  // 说明文字
  hintLine:  { x: 205, y: 820 },
};

// ============ INPUT-06：弹出式答题区双套锛点（方案 §1.4 / §1.5 / §1.6） ============
// OPEN 态（advancedCalc=true，15 键）与关闭态（advancedCalc=false，14 键 + 行高回收 62 DP）
// 实现约定：统一走 layoutFor(advancedCalc)，禁在 render 里写零散 if
// 均经 411×891 DP 断言：无重叠、tap 区 ≥44×44、底沿 878 ≤ 891−13 安全区
export const ADV_ANCHOR = {
  area:      { x: 15,  y: 552, w: 381, h: 326 },
  formula:   { x: 25,  y: 562, w: 305, h: 52  },   // 宽 361→305，让位右侧 [✕]
  backBtn:   { x: 340, y: 566, w: 46,  h: 44  },   // [返回] ✕ 内嵌 formula 行右侧
  numRow:    { x: 25,  y: 624, w: 361, h: 60,  cols: 4, gap: 8 },
  opRow:     { x: 25,  y: 694, w: 361, h: 52,  cols: 6, gap: 5 },
  advRow:    { x: 25,  y: 756, w: 361, h: 52,  cols: 3, gap: 0 }, // 1/x 居中占 1/3 宽
  ctrlRow:   { x: 25,  y: 818, w: 361, h: 52,  cols: 4, gap: 8 },
};

// 关闭态：advRow 不渲染，area 顶下移 62 / 高度减 62，下方各行上移 62（方案 §1.5）
const ADV_ROW_H_TOTAL = 62; // 52 行高 + 10 间距

function _shift(r, dy) {
  return { ...r, y: r.y + dy };
}

/**
 * INPUT-06：根据高级计算开关返回一整套锛点
 * @param {boolean} advancedCalc
 */
export function layoutFor(advancedCalc) {
  if (advancedCalc) {
    return {
      area: ADV_ANCHOR.area,
      formula: ADV_ANCHOR.formula,
      backBtn: ADV_ANCHOR.backBtn,
      numRow: ADV_ANCHOR.numRow,
      opRow: ADV_ANCHOR.opRow,
      advRow: ADV_ANCHOR.advRow,
      ctrlRow: ADV_ANCHOR.ctrlRow,
      keyCount: 15,
    };
  }
  const d = -ADV_ROW_H_TOTAL;
  return {
    area: { x: 15, y: ADV_ANCHOR.area.y + ADV_ROW_H_TOTAL, w: 381, h: ADV_ANCHOR.area.h - ADV_ROW_H_TOTAL },
    formula: _shift(ADV_ANCHOR.formula, ADV_ROW_H_TOTAL),
    backBtn: _shift(ADV_ANCHOR.backBtn, ADV_ROW_H_TOTAL),
    numRow: _shift(ADV_ANCHOR.numRow, ADV_ROW_H_TOTAL),
    opRow: _shift(ADV_ANCHOR.opRow, ADV_ROW_H_TOTAL),
    advRow: null,
    ctrlRow: ADV_ANCHOR.ctrlRow, // 底行不动，仍贴 870
    keyCount: 14,
  };
}

// 高级键视觉常量
const BTN_BG_ADV = '#9D5BFA';         // 紫，与初级蓝 #5B7CFA 区分
const BTN_BG_BACK = 'rgba(255,255,255,0.18)';
const ADV_KEY_LABEL = '1/x';

// 答题区滑入动效（§1.2.1 + 方案 §1.3）
export const SLIDE_MS = 220;          // 200~250ms 区间居中，距 300ms 卡顿线余 36%
export const AREA_STATE = {
  CLOSED: 'closed',
  OPENING: 'opening',
  OPEN: 'open',
  CLOSING: 'closing',
};

const OP_KEYS = ['+', '-', '*', '/', '(', ')'];
const CTRL_KEYS = [
  { key: 'del',    text: '删除' },
  { key: 'clear',  text: '清空' },
  { key: 'submit', text: '提交' },
  { key: 'nosol',  text: '无解' }, // INPUT-05 新增
];

// INPUT-05：ctrl 按钮颜色主题（无解=红色 #E74C3C）
const BTN_BG_NOSOL_ON = '#E74C3C';
const BTN_BG_NOSOL_DISABLED = 'rgba(231,76,60,0.35)';

// ============ 合法性检查 ============
export function checkLegality(tokens) {
  if (!tokens || tokens.length === 0) {
    return { legal: false, allCardsUsed: false, reason: 'empty' };
  }
  // 括号成对
  let depth = 0;
  for (const t of tokens) {
    if (t.type === TokenType.LEFT_PAREN) depth += 1;
    else if (t.type === TokenType.RIGHT_PAREN) {
      depth -= 1;
      if (depth < 0) return { legal: false, allCardsUsed: false, reason: 'paren_mismatch' };
    }
  }
  if (depth !== 0) return { legal: false, allCardsUsed: false, reason: 'paren_mismatch' };

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    const prev = tokens[i - 1];
    if (t.type === TokenType.OPERATOR) {
      if (i === 0) return { legal: false, allCardsUsed: false, reason: 'op_start' };
      if (prev && (prev.type === TokenType.OPERATOR || prev.type === TokenType.LEFT_PAREN)) {
        return { legal: false, allCardsUsed: false, reason: 'op_after_op_or_lparen' };
      }
      // ★ INPUT-06：recip 后面不能直接跟运算符（1/ 悬空）
      if (prev && prev.type === TokenType.RECIP) {
        return { legal: false, allCardsUsed: false, reason: 'recip_dangling' };
      }
    } else if (t.type === TokenType.RECIP) {
      // ★ INPUT-06：recip 前置位置与数字相同（不得紧跟数字 / 右括号，避免隐式乘）
      if (prev && (prev.type === TokenType.NUMBER || prev.type === TokenType.RIGHT_PAREN)) {
        return { legal: false, allCardsUsed: false, reason: 'implicit_mul' };
      }
      if (prev && prev.type === TokenType.RECIP) {
        return { legal: false, allCardsUsed: false, reason: 'recip_operand_not_leaf' };
      }
    } else if (t.type === TokenType.LEFT_PAREN) {
      if (prev && (prev.type === TokenType.NUMBER || prev.type === TokenType.RIGHT_PAREN)) {
        return { legal: false, allCardsUsed: false, reason: 'implicit_mul' };
      }
    } else if (t.type === TokenType.RIGHT_PAREN) {
      if (!prev) return { legal: false, allCardsUsed: false, reason: 'rparen_start' };
      if (prev.type === TokenType.LEFT_PAREN || prev.type === TokenType.OPERATOR) {
        return { legal: false, allCardsUsed: false, reason: 'empty_paren_or_dangling_op' };
      }
      // ★ INPUT-06：“1/)” 非法
      if (prev.type === TokenType.RECIP) {
        return { legal: false, allCardsUsed: false, reason: 'recip_dangling' };
      }
    } else if (t.type === TokenType.NUMBER) {
      if (prev && (prev.type === TokenType.RIGHT_PAREN || prev.type === TokenType.NUMBER)) {
        return { legal: false, allCardsUsed: false, reason: 'implicit_mul' };
      }
    }
  }

  const last = tokens[tokens.length - 1];
  if (last.type === TokenType.OPERATOR || last.type === TokenType.LEFT_PAREN ||
      last.type === TokenType.RECIP) {   // ★ INPUT-06：以 1/ 结尾不完整
    return { legal: false, allCardsUsed: false, reason: 'op_end' };
  }

  // 4 张牌各一次
  const used = new Set();
  for (const t of tokens) {
    if (t.type === TokenType.NUMBER) {
      if (used.has(t.cardIndex)) {
        return { legal: false, allCardsUsed: false, reason: 'card_reused' };
      }
      used.add(t.cardIndex);
    }
  }
  const allCardsUsed = used.size === 4;
  return { legal: true, allCardsUsed, reason: 'ok' };
}

// ============ Token → 展示字符串 ============
export function formatTokens(tokens, cardValues) {
  const parts = [];
  for (const t of tokens) {
    if (t.type === TokenType.NUMBER) {
      parts.push(String(cardValues[t.cardIndex]));
    } else if (t.type === TokenType.OPERATOR) {
      parts.push(OP_DISPLAY[t.value] || t.value);
    } else if (t.type === TokenType.LEFT_PAREN) {
      parts.push('(');
    } else if (t.type === TokenType.RIGHT_PAREN) {
      parts.push(')');
    } else if (t.type === TokenType.RECIP) {
      parts.push('1/');   // ★ INPUT-06：展示为 1/ 前缀，与 §5.1 "(1/" 计数口径一致
    }
  }
  return parts.join('');
}

// ============ AnswerArea 组件 ============
export default class AnswerArea {
  /**
   * @param {number[]} cardValues 4 张牌的点数（0-13），供数字键显示
   */
  constructor() {
    this.tokens = [];             // 用户构造的 token 序列
    this.cardValues = [0, 0, 0, 0];
    this.enabled = false;         // 未发牌完成前禁用
    this._layout = null;
    this._buttonRects = [];       // 命中区数组，供 PageRenderer.handleEvent 复用
    // ============ INPUT-06 新增 ============
    this.advancedCalc = false;    // 高级计算开关（控 advRow 与 1/x 键）
    this.areaState = AREA_STATE.CLOSED;  // 弹出式答题区状态机
    this._slideStartAt = 0;       // 动画起点
    this._slideProgress = 0;      // 0..1
  }

  // ============ INPUT-06：高级计算开关 ============
  setAdvancedCalc(on) {
    const next = !!on;
    if (next === this.advancedCalc) return;
    this.advancedCalc = next;
    // 关闭时清掉已输入的 recip token（否则存在不可见的不合法 token）
    if (!next && this.tokens.some((t) => t.type === TokenType.RECIP)) {
      this.tokens = [];
    }
  }

  isAdvancedCalc() {
    return this.advancedCalc;
  }

  // ============ INPUT-06：答题区滑入 / 滑出动效（§1.2.1） ============
  openArea() {
    if (this.areaState === AREA_STATE.OPEN || this.areaState === AREA_STATE.OPENING) return;
    this.areaState = AREA_STATE.OPENING;
    this._slideStartAt = Date.now();
  }

  closeArea() {
    if (this.areaState === AREA_STATE.CLOSED || this.areaState === AREA_STATE.CLOSING) return;
    this.areaState = AREA_STATE.CLOSING;
    this._slideStartAt = Date.now();
  }

  isAreaVisible() {
    return this.areaState !== AREA_STATE.CLOSED;
  }

  isAreaOpen() {
    return this.areaState === AREA_STATE.OPEN;
  }

  // easeOutCubic：滑入收尾减速，无弹跳（方案 §1.3）
  _easeOutCubic(p) {
    const q = 1 - p;
    return 1 - q * q * q;
  }

  // 推进动画，返回当前位移系数 0..1（1 = 完全展开）
  _tickSlide() {
    if (this.areaState === AREA_STATE.OPEN) { this._slideProgress = 1; return 1; }
    if (this.areaState === AREA_STATE.CLOSED) { this._slideProgress = 0; return 0; }
    const dt = Date.now() - this._slideStartAt;
    const raw = Math.max(0, Math.min(1, dt / SLIDE_MS));
    if (this.areaState === AREA_STATE.OPENING) {
      this._slideProgress = this._easeOutCubic(raw);
      if (raw >= 1) { this.areaState = AREA_STATE.OPEN; this._slideProgress = 1; }
    } else {
      this._slideProgress = 1 - this._easeOutCubic(raw);
      if (raw >= 1) { this.areaState = AREA_STATE.CLOSED; this._slideProgress = 0; }
    }
    return this._slideProgress;
  }

  // 动画未结束时需持续重绘
  needsRedraw() {
    return this.areaState === AREA_STATE.OPENING || this.areaState === AREA_STATE.CLOSING;
  }

  setCardValues(values) {
    // 与卡牌顺序一一对应；不复制引用
    this.cardValues = values && values.length === 4 ? values.slice() : [0, 0, 0, 0];
  }

  setEnabled(enabled) {
    this.enabled = !!enabled;
  }

  reset() {
    this.tokens = [];
    // INPUT-06：换牌同时收回答题区（无动画，直接置 CLOSED）
    this.areaState = AREA_STATE.CLOSED;
    this._slideProgress = 0;
  }

  /**
   * 判定当前牌是否已被算式占用
   */
  isCardOccupied(cardIndex) {
    return this.tokens.some((t) => t.type === TokenType.NUMBER && t.cardIndex === cardIndex);
  }

  /**
   * 添加 token（点击按钮时调用）
   */
  addToken(token) {
    if (!this.enabled) return false;
    if (token.type === TokenType.NUMBER && this.isCardOccupied(token.cardIndex)) return false;
    this.tokens.push(token);
    return true;
  }

  removeLastToken() {
    if (this.tokens.length === 0) return null;
    return this.tokens.pop();
  }

  clearTokens() {
    this.tokens = [];
  }

  getTokens() {
    return this.tokens.slice();
  }

  getLegality() {
    return checkLegality(this.tokens);
  }

  canSubmit() {
    if (!this.enabled) return false;
    const l = checkLegality(this.tokens);
    return l.legal && l.allCardsUsed;
  }

  getFormulaText() {
    return formatTokens(this.tokens, this.cardValues);
  }

  // ============ 渲染 ============
  _scaleRect(r, sx, sy, ox, oy, scale) {
    return {
      x: ox + r.x * scale,
      y: oy + r.y * scale,
      w: r.w * scale,
      h: r.h * scale,
    };
  }

  _computeLayout(uiW, uiH) {
    const DESIGN_W = 411;
    const DESIGN_H = 891;
    const sx = uiW / DESIGN_W;
    const sy = uiH / DESIGN_H;
    const scale = Math.min(sx, sy);
    const ox = (uiW - DESIGN_W * scale) / 2;
    const oy = (uiH - DESIGN_H * scale) / 2;
    return { scale, ox, oy };
  }

  render(ctx, uiW, uiH) {
    const { scale, ox, oy } = this._computeLayout(uiW, uiH);

    // INPUT-06：滑入位移 —— 未完全展开时整区域向下平移 (1-p)*高度
    const L = layoutFor(this.advancedCalc);
    const p = this._tickSlide();
    const slideDY = (1 - p) * L.area.h;   // 设计坐标系位移

    const S = (r) => ({
      x: ox + r.x * scale,
      y: oy + (r.y + slideDY) * scale,
      w: r.w * scale,
      h: r.h * scale,
    });

    this._buttonRects = [];

    // 已完全收起：不渲染、无命中区
    if (this.areaState === AREA_STATE.CLOSED) return;

    // 背景
    const area = S(L.area);
    ctx.fillStyle = BG_COLOR;
    roundRect(ctx, area.x, area.y, area.w, area.h, AREA_RADIUS);
    ctx.fill();

    // 算式显示条
    const formula = S(L.formula);
    ctx.fillStyle = FORMULA_BG;
    roundRect(ctx, formula.x, formula.y, formula.w, formula.h, BTN_RADIUS);
    ctx.fill();
    ctx.fillStyle = FORMULA_TEXT;
    ctx.font = `${Math.floor(24 * scale)}px sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const text = this.getFormulaText() || '请点击数字键与运算符构造算式';
    const padding = 12 * scale;
    ctx.fillText(text, formula.x + padding, formula.y + formula.h / 2);

    // INPUT-06：[返回] ✕ 内嵌 formula 行右侧（无条件可点，不受 enabled 约束）
    const backBtn = S(L.backBtn);
    ctx.fillStyle = BTN_BG_BACK;
    roundRect(ctx, backBtn.x, backBtn.y, backBtn.w, backBtn.h, BTN_RADIUS);
    ctx.fill();
    ctx.fillStyle = BTN_FG;
    ctx.font = `bold ${Math.floor(20 * scale)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('✕', backBtn.x + backBtn.w / 2, backBtn.y + backBtn.h / 2);
    this._buttonRects.push({ key: 'ctrl:back', ctrlKey: 'back', kind: 'ctrl', disabled: false, ...backBtn });

    // 数字键区
    const numRow = L.numRow;
    const numW = (numRow.w - numRow.gap * (numRow.cols - 1)) / numRow.cols;
    for (let i = 0; i < 4; i++) {
      const btn = S({
        x: numRow.x + i * (numW + numRow.gap),
        y: numRow.y,
        w: numW,
        h: numRow.h,
      });
      const occupied = this.isCardOccupied(i);
      const disabled = !this.enabled || occupied;
      const label = this._numberLabel(i);
      this._drawButton(ctx, btn, label, BTN_BG_NUM, disabled, scale);
      this._buttonRects.push({
        key: `num:${i}`,
        cardIndex: i,
        kind: 'num',
        disabled,
        ...btn,
      });
    }

    // 运算符键区
    const opRow = L.opRow;
    const opW = (opRow.w - opRow.gap * (opRow.cols - 1)) / opRow.cols;
    for (let i = 0; i < OP_KEYS.length; i++) {
      const k = OP_KEYS[i];
      const btn = S({
        x: opRow.x + i * (opW + opRow.gap),
        y: opRow.y,
        w: opW,
        h: opRow.h,
      });
      const disabled = !this.enabled;
      const label = k === '*' ? '×' : k === '/' ? '÷' : k;
      this._drawButton(ctx, btn, label, BTN_BG_OP, disabled, scale);
      this._buttonRects.push({ key: `op:${k}`, opValue: k, kind: 'op', disabled, ...btn });
    }

    // INPUT-06：高级键行（1/x 居中，占 3 列中的中间列）
    //   开关关闭时 L.advRow === null，整行不渲染也不入命中区
    if (L.advRow) {
      const advRow = L.advRow;
      const advW = advRow.w / advRow.cols;
      const btn = S({
        x: advRow.x + advW,   // 中间列
        y: advRow.y,
        w: advW,
        h: advRow.h,
      });
      const disabled = !this.enabled;
      this._drawButton(ctx, btn, ADV_KEY_LABEL, BTN_BG_ADV, disabled, scale, 18);
      this._buttonRects.push({ key: 'adv:recip', kind: 'adv', disabled, ...btn });
    }

    // 控制键区
    const ctrlRow = L.ctrlRow;
    const ctrlW = (ctrlRow.w - ctrlRow.gap * (ctrlRow.cols - 1)) / ctrlRow.cols;
    for (let i = 0; i < CTRL_KEYS.length; i++) {
      const c = CTRL_KEYS[i];
      const btn = S({
        x: ctrlRow.x + i * (ctrlW + ctrlRow.gap),
        y: ctrlRow.y,
        w: ctrlW,
        h: ctrlRow.h,
      });
      let disabled = !this.enabled;
      let bg = BTN_BG_CTRL;
      if (c.key === 'submit') {
        disabled = !this.canSubmit();
        bg = disabled ? BTN_BG_CTRL : BTN_BG_SUBMIT_ON;
      } else if (c.key === 'nosol') {
        // INPUT-05：[无解] 可用条件 = 已发牌（!this.enabled === true 则置灰）
        disabled = !this.enabled;
        bg = disabled ? BTN_BG_NOSOL_DISABLED : BTN_BG_NOSOL_ON;
      } else if ((c.key === 'del' || c.key === 'clear') && this.tokens.length === 0) {
        disabled = true;
      }
      this._drawButton(ctx, btn, c.text, bg, disabled, scale, 15); // INPUT-05：ctrl cols=4 后字号 18→15px
      this._buttonRects.push({ key: `ctrl:${c.key}`, ctrlKey: c.key, kind: 'ctrl', disabled, ...btn });
    }
  }

  _drawButton(ctx, rect, text, bg, disabled, scale, fontSize) {
    const fs = typeof fontSize === 'number' ? fontSize : 20;
    ctx.fillStyle = disabled ? BTN_BG_DISABLED : bg;
    roundRect(ctx, rect.x, rect.y, rect.w, rect.h, BTN_RADIUS);
    ctx.fill();
    ctx.fillStyle = disabled ? BTN_FG_DISABLED : BTN_FG;
    ctx.font = `bold ${Math.floor(fs * scale)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, rect.x + rect.w / 2, rect.y + rect.h / 2);
  }

  _numberLabel(cardIndex) {
    const v = this.cardValues[cardIndex];
    // 大小王：cardValues 都是 0，但通过 cardIndex 的位置区分（第一个 0 视为大王，第二个 0 视为小王）
    if (v === 0) {
      let jokerOrdinal = 0;
      for (let i = 0; i <= cardIndex; i++) {
        if (this.cardValues[i] === 0) jokerOrdinal++;
      }
      return jokerOrdinal === 1 ? '大王(0)' : '小王(0)';
    }
    if (v === 1) return 'A(1)';
    if (v === 11) return 'J(11)';
    if (v === 12) return 'Q(12)';
    if (v === 13) return 'K(13)';
    // 数字牌 2~10：面(点数) 格式
    return `${v}(${v})`;
  }

  /**
   * 命中测试并返回被点中的按钮元数据（含 disabled 判定）
   */
  hitButton(touch) {
    for (const b of this._buttonRects) {
      if (touch.clientX >= b.x && touch.clientX <= b.x + b.w &&
          touch.clientY >= b.y && touch.clientY <= b.y + b.h) {
        return b;
      }
    }
    return null;
  }

  /**
   * 处理按钮点击。返回：
   *   { action:'submit' } | { action:'noop' } | { action:'changed' }
   */
  handleButton(btn) {
    if (!btn || btn.disabled) return { action: 'noop' };
    if (btn.kind === 'num') {
      this.addToken({ type: TokenType.NUMBER, cardIndex: btn.cardIndex });
      return { action: 'changed' };
    }
    if (btn.kind === 'op') {
      const v = btn.opValue;
      if (v === '(') this.addToken({ type: TokenType.LEFT_PAREN });
      else if (v === ')') this.addToken({ type: TokenType.RIGHT_PAREN });
      else this.addToken({ type: TokenType.OPERATOR, value: v });
      return { action: 'changed' };
    }
    if (btn.kind === 'adv') {
      // ★ INPUT-06：1/x 前置单目 token
      this.addToken({ type: TokenType.RECIP });
      return { action: 'changed' };
    }
    if (btn.kind === 'ctrl') {
      if (btn.ctrlKey === 'del') { this.removeLastToken(); return { action: 'changed' }; }
      if (btn.ctrlKey === 'clear') { this.clearTokens(); return { action: 'changed' }; }
      if (btn.ctrlKey === 'submit') return { action: 'submit' };
      if (btn.ctrlKey === 'nosol') return { action: 'nosol' };
      if (btn.ctrlKey === 'back') { this.closeArea(); return { action: 'back' }; }
    }
    return { action: 'noop' };
  }
}
