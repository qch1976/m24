// m24 - Storage.js
// 本地存储工具（wx.setStorageSync / getStorageSync 封装）

const KEYS = {
  HIGH_SCORE: 'm24_high_score',
  TOTAL_GAMES: 'm24_total_games',
  BEST_TIME: 'm24_best_time',
  SETTINGS: 'm24_settings',
};

const Storage = {
  saveHighScore(score) {
    const cur = this.getHighScore();
    if (score > cur) wx.setStorageSync(KEYS.HIGH_SCORE, score);
  },
  getHighScore() {
    return wx.getStorageSync(KEYS.HIGH_SCORE) || 0;
  },
  incrementTotalGames() {
    const t = (wx.getStorageSync(KEYS.TOTAL_GAMES) || 0) + 1;
    wx.setStorageSync(KEYS.TOTAL_GAMES, t);
    return t;
  },
  saveBestTime(t) {
    const cur = wx.getStorageSync(KEYS.BEST_TIME) || Infinity;
    if (t < cur) wx.setStorageSync(KEYS.BEST_TIME, t);
  },
  getBestTime() {
    return wx.getStorageSync(KEYS.BEST_TIME) || 0;
  },
  saveSettings(settings) {
    wx.setStorageSync(KEYS.SETTINGS, settings);
  },
  getSettings() {
    return wx.getStorageSync(KEYS.SETTINGS) || {};
  },
};

export default Storage;
export { KEYS };
