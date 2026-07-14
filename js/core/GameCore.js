// m24 - GameCore.js
// 游戏核心：状态机 + 单局流程管理（骨架版本）
// 后续 Sprint 2 补齐题目生成、判分与结束条件
// INPUT-02：新增 currentSolutions/currentCardValues 与 recordSolutions/getSolutions/hasSolution API
//   - 供 R-03 埋点，让 INPUT-03（答题判定）/ INPUT-04（提示）复用全解结果
//   - 本迭代不向用户展示解法

import NumberGenerator from './NumberGenerator';
import Calculator from './Calculator';
import Timer from './Timer';
import Solver from './Solver';

const STATUS = {
  IDLE: 'idle',
  PLAYING: 'playing',
  PAUSED: 'paused',
  ENDED: 'ended',
};

export default class GameCore {
  constructor() {
    this.status = STATUS.IDLE;
    this.numbers = [];
    this.solutions = [];
    this.score = 0;
    this.timer = new Timer();
    this.calculator = new Calculator();
    // INPUT-02：当前手牌的全解与牌面值
    this.currentSolutions = [];
    this.currentCardValues = [];
  }

  startGame() {
    this.status = STATUS.PLAYING;
    this.score = 0;
    this.nextRound();
    this.timer.start();
  }

  nextRound() {
    this.numbers = NumberGenerator.generateNumbers();
    this.solutions = [];
    this.calculator.reset(this.numbers);
  }

  pauseGame() {
    if (this.status !== STATUS.PLAYING) return;
    this.status = STATUS.PAUSED;
    this.timer.pause();
  }

  resumeGame() {
    if (this.status !== STATUS.PAUSED) return;
    this.status = STATUS.PLAYING;
    this.timer.resume();
  }

  endGame() {
    this.status = STATUS.ENDED;
    this.timer.pause();
  }

  resetGame() {
    this.status = STATUS.IDLE;
    this.score = 0;
    this.numbers = [];
    this.solutions = [];
    this.currentSolutions = [];
    this.currentCardValues = [];
    this.timer.reset();
  }

  update(_dt) {
    // 逐帧钩子，后续按需实现
  }

  getNumbers() {
    return this.numbers;
  }

  getElapsed() {
    return this.timer.getTime();
  }

  getStatus() {
    return this.status;
  }

  /**
   * INPUT-02：记录当前发牌手的全解（供 INPUT-03/04 复用）。
   * @param {Card[]} cards 4 张已保证可解的 Card 对象数组
   * @returns {{ values: number[], solutions: string[] }}
   */
  recordSolutions(cards) {
    const values = (cards || []).map((c) => (c && typeof c.value === 'number' ? c.value : 0));
    const sols = Solver.findSolutions(values);
    this.currentCardValues = values;
    this.currentSolutions = sols;
    return { values, solutions: sols };
  }

  /**
   * INPUT-02：读当前所有解法（返回副本，防止外部污染）
   * @returns {string[]}
   */
  getSolutions() {
    return this.currentSolutions.slice();
  }

  /**
   * INPUT-02：当前是否有解
   * @returns {boolean}
   */
  hasSolution() {
    return this.currentSolutions.length > 0;
  }

  /**
   * INPUT-02：当前牌面值（副本）
   * @returns {number[]}
   */
  getCurrentCardValues() {
    return this.currentCardValues.slice();
  }

  // ============ INPUT-03 新增：答题判定入口 ============
  // 契约（Architect 60 号修订版）：
  //   - 仅两类失败：not_24 / division_by_zero
  //   - 其他异常（未用满 / 空表达式 / 括号不匹配等前端已拦截）降级为 not_24 + console.error
  //   - 除零 → { pass:false, reason:'division_by_zero' }
  //   - 结果=24 → { pass:true, expression:'...' }
  //   - 结果≠ 24 → { pass:false, reason:'not_24', actualValue, actualLabel }
  // 现有函数字节不动
  checkAnswer(tokens, cardValues) {
    const values = cardValues || this.currentCardValues;
    // 前置异常均降级 → not_24（内部 log，不向用户暴露错误类型）
    if (!tokens || tokens.length === 0) {
      console.error('[GameCore.checkAnswer] empty tokens; degrading to not_24');
      return { pass: false, reason: 'not_24', actualValue: 0, actualLabel: '0' };
    }
    const usedIndices = tokens
      .filter((t) => t.type === 'number')
      .map((t) => t.cardIndex);
    if (usedIndices.length !== 4 || new Set(usedIndices).size !== 4) {
      console.error('[GameCore.checkAnswer] cards not fully used; degrading to not_24', usedIndices);
      return { pass: false, reason: 'not_24', actualValue: 0, actualLabel: '0' };
    }
    const r = Solver.evaluateExpression(tokens, values);
    if (!r.success) {
      if (r.error === 'division_by_zero') {
        return { pass: false, reason: 'division_by_zero' };
      }
      console.error('[GameCore.checkAnswer] solver error; degrading to not_24', r.error);
      return { pass: false, reason: 'not_24', actualValue: 0, actualLabel: '0' };
    }
    if (r.is24) {
      return { pass: true, expression: this.formatExpression(tokens, values) };
    }
    const frac = r.value;
    const actualValue = frac.num / frac.den;
    const actualLabel = frac.den === 1 ? String(frac.num) : `${frac.num}/${frac.den}`;
    return { pass: false, reason: 'not_24', actualValue, actualLabel };
  }

  /**
   * INPUT-03：把 token 序列反序列化为可读字符串（库用户与沿用 × ÷ 符号）
   */
  formatExpression(tokens, cardValues) {
    const values = cardValues || this.currentCardValues;
    const parts = [];
    for (const t of tokens) {
      if (t.type === 'number') parts.push(String(values[t.cardIndex]));
      else if (t.type === 'operator') {
        parts.push(t.value === '*' ? '×' : t.value === '/' ? '÷' : t.value);
      }
      else if (t.type === 'left_paren') parts.push('(');
      else if (t.type === 'right_paren') parts.push(')');
    }
    return parts.join('');
  }
}

GameCore.STATUS = STATUS;


// ============ INPUT-04 新增：Hint 步骤缓存 + 全解字符串缓存 ============
// 依据：80-INPUT04-需求分析与设计.md §4.5 §10.2
//   - _cachedHintSteps: [Step, Step, Step] | null
//   - _cachedAllSolutions: string[] | null
//   - _computeHintCache()：内部，DEAL_DONE 后立即调用（由 PageRenderer 触发或此文件在 recordSolutions 里调）
//   - getHintStep(index): 1|2|3 → step 对象；发牌前返回 null
//   - getAllSolutions(): 去重后的全解字符串数组（副本）
//   - 换牌时清空缓存
// 严格不修改现有 API 字节：recordSolutions/getSolutions/hasSolution/checkAnswer/formatExpression/... 保持原样

import { findSolutionsWithAST, chooseCanonicalSolution, postOrderSteps } from './Solver';

// 内部：从 currentCardValues 计算缓存
function _computeHintCache(gc) {
  const values = gc.currentCardValues || [];
  if (!values || values.length !== 4) {
    gc._cachedHintSteps = null;
    gc._cachedAllSolutions = null;
    return;
  }
  const sols = findSolutionsWithAST(values); // 已按 expr 字典序排序
  if (!sols || sols.length === 0) {
    gc._cachedHintSteps = null;
    gc._cachedAllSolutions = [];
    return;
  }
  const chosen = chooseCanonicalSolution(sols, values); // 字典序最小
  const steps = postOrderSteps(chosen.ast);            // 3 个 Step
  gc._cachedHintSteps = steps;
  gc._cachedAllSolutions = sols.map((s) => s.expr);
}

// 挂到 prototype，不修改类体原有字节
GameCore.prototype._computeHintCache = function () {
  _computeHintCache(this);
};

// getHintStep(index): index=1|2|3；未发牌或无解返回 null
GameCore.prototype.getHintStep = function (index) {
  if (!this._cachedHintSteps) {
    // 若缓存未建（例如老流程尚未调用 _computeHintCache），惰性计算一次
    _computeHintCache(this);
  }
  if (!this._cachedHintSteps) return null;
  if (index < 1 || index > 3) return null;
  return this._cachedHintSteps[index - 1] || null;
};

// getAllSolutions(): 返回去重后的全部算式字符串副本
GameCore.prototype.getAllSolutions = function () {
  if (!this._cachedAllSolutions) {
    _computeHintCache(this);
  }
  if (!this._cachedAllSolutions) return [];
  return this._cachedAllSolutions.slice();
};

// —— 换牌 / 重开时清空缓存 ——
// 用 monkey-patch 包装既有方法（不修改函数字节，只在调用后追加清缓存 / 立即重算）
const _origRecordSolutions = GameCore.prototype.recordSolutions;
GameCore.prototype.recordSolutions = function (cards) {
  const r = _origRecordSolutions.call(this, cards);
  // 换牌后 DEAL_DONE 前置：立即建缓存
  _computeHintCache(this);
  return r;
};

const _origResetGame = GameCore.prototype.resetGame;
GameCore.prototype.resetGame = function () {
  _origResetGame.call(this);
  this._cachedHintSteps = null;
  this._cachedAllSolutions = null;
};

const _origNextRound = GameCore.prototype.nextRound;
GameCore.prototype.nextRound = function () {
  _origNextRound.call(this);
  this._cachedHintSteps = null;
  this._cachedAllSolutions = null;
};
