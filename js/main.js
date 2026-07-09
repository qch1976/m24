// m24 - 游戏主入口
// 从飞机射击 template 改造为 24 点小游戏（准备阶段骨架）
// 保留 base/libs/runtime/music 供后续复用

import GameCore from './core/GameCore';
import UIManager from './ui/UIManager';

export default class Main {
  constructor() {
    this.gameCore = new GameCore();
    this.uiManager = new UIManager();

    // 全局分享入口（点击右上角胶囊 -> 转发）
    if (wx.onShareAppMessage) {
      wx.onShareAppMessage(() => ({
        title: '来挑战 24 点，我等你！',
      }));
      wx.showShareMenu && wx.showShareMenu({ withShareTicket: false });
    }

    this.aniId = 0;
    this.lastTime = 0;
    this.loop = this.loop.bind(this);
    this.start();
  }

  start() {
    this.gameCore.startGame();
    // 首帧渲染首页
    this.uiManager.switchTo('index');
    cancelAnimationFrame && cancelAnimationFrame(this.aniId);
    this.aniId = requestAnimationFrame(this.loop);
  }

  loop(time) {
    const dt = this.lastTime ? (time - this.lastTime) / 1000 : 0;
    this.lastTime = time;
    this.gameCore.update(dt);
    this.uiManager.render();
    this.aniId = requestAnimationFrame(this.loop);
  }
}
