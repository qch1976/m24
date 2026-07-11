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
}

GameCore.STATUS = STATUS;
