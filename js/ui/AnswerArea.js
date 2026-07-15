// m24 - AnswerArea.js
// INPUT-03：答题区组件（算式显示条 + 4 数字键 + 6 运算键 + 3 控制键）
// 依据：60-INPUT03-需求分析与设计.md
//   - 卡牌上移 100 DP（PageRenderer 侧处理），答题区落在 y=500 起
//   - 沿用牌桌配色/圆角/字体（新建常量与既有视觉一致，不改 Components/Background/CardRenderer）
//   - 前端硬约束：非法算式 / 未用满 4 张 → 提交置灰

import { roundRect } from './Components';

// 视觉常量
const BG_COLOR = 'rgba(0,0,0,0.30)';
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
  // 控制键区 y=740，3 键
  ctrlRow:   { x: 25,  y: 740, w: 361, h: 60,  cols: 3, gap: 10 },
  // 说明文字
  hintLine:  { x: 205, y: 820 },
};

const OP_KEYS = ['+', '-', '*', '/', '(', ')'];
const CTRL_KEYS = [
  { key: 'del',    text: '删除' },
  { key: 'clear',  text: '清空' },
  { key: 'submit', text: '提交' },
];

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
    } else if (t.type === TokenType.LEFT_PAREN) {
      if (prev && (prev.type === TokenType.NUMBER || prev.type === TokenType.RIGHT_PAREN)) {
        return { legal: false, allCardsUsed: false, reason: 'implicit_mul' };
      }
    } else if (t.type === TokenType.RIGHT_PAREN) {
      if (!prev) return { legal: false, allCardsUsed: false, reason: 'rparen_start' };
      if (prev.type === TokenType.LEFT_PAREN || prev.type === TokenType.OPERATOR) {
        return { legal: false, allCardsUsed: false, reason: 'empty_paren_or_dangling_op' };
      }
    } else if (t.type === TokenType.NUMBER) {
      if (prev && (prev.type === TokenType.RIGHT_PAREN || prev.type === TokenType.NUMBER)) {
        return { legal: false, allCardsUsed: false, reason: 'implicit_mul' };
      }
    }
  }

  const last = tokens[tokens.length - 1];
  if (last.type === TokenType.OPERATOR || last.type === TokenType.LEFT_PAREN) {
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
    const S = (r) => ({
      x: ox + r.x * scale,
      y: oy + r.y * scale,
      w: r.w * scale,
      h: r.h * scale,
    });

    // 背景
    const area = S(ANSWER_ANCHOR.area);
    ctx.fillStyle = BG_COLOR;
    roundRect(ctx, area.x, area.y, area.w, area.h, AREA_RADIUS);
    ctx.fill();

    // 算式显示条
    const formula = S(ANSWER_ANCHOR.formula);
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

    this._buttonRects = [];

    // 数字键区
    const numRow = ANSWER_ANCHOR.numRow;
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
    const opRow = ANSWER_ANCHOR.opRow;
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

    // 控制键区
    const ctrlRow = ANSWER_ANCHOR.ctrlRow;
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
      } else if ((c.key === 'del' || c.key === 'clear') && this.tokens.length === 0) {
        disabled = true;
      }
      this._drawButton(ctx, btn, c.text, bg, disabled, scale);
      this._buttonRects.push({ key: `ctrl:${c.key}`, ctrlKey: c.key, kind: 'ctrl', disabled, ...btn });
    }
  }

  _drawButton(ctx, rect, text, bg, disabled, scale) {
    ctx.fillStyle = disabled ? BTN_BG_DISABLED : bg;
    roundRect(ctx, rect.x, rect.y, rect.w, rect.h, BTN_RADIUS);
    ctx.fill();
    ctx.fillStyle = disabled ? BTN_FG_DISABLED : BTN_FG;
    ctx.font = `bold ${Math.floor(20 * scale)}px sans-serif`;
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
    if (btn.kind === 'ctrl') {
      if (btn.ctrlKey === 'del') { this.removeLastToken(); return { action: 'changed' }; }
      if (btn.ctrlKey === 'clear') { this.clearTokens(); return { action: 'changed' }; }
      if (btn.ctrlKey === 'submit') return { action: 'submit' };
    }
    return { action: 'noop' };
  }
}
