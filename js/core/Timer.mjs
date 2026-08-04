// m24 - Timer.js
// 简易计时器（秒），支持 start / pause / resume / reset

export default class Timer {
  constructor() {
    this.reset();
  }

  reset() {
    this.startAt = 0;
    this.accumulated = 0;
    this.running = false;
  }

  start() {
    this.reset();
    this.startAt = Date.now();
    this.running = true;
  }

  pause() {
    if (!this.running) return;
    this.accumulated += Date.now() - this.startAt;
    this.running = false;
  }

  resume() {
    if (this.running) return;
    this.startAt = Date.now();
    this.running = true;
  }

  getTime() {
    const now = this.running ? Date.now() - this.startAt : 0;
    return (this.accumulated + now) / 1000;
  }
}
