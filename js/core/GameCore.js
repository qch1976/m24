// m24 - GameCore.js
// 游戏核心：状态机 + 单局流程管理（骨架版本）
// 后续 Sprint 2 补齐题目生成、判分与结束条件

import NumberGenerator from './NumberGenerator';
import Calculator from './Calculator';
import Timer from './Timer';

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
}

GameCore.STATUS = STATUS;
