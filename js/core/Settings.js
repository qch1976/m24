// m24 - Settings.js
// INPUT-05：设置持久化模块
// 依据：106-INPUT05-需求分析与设计.md §7
//
// storage key: 'm24.settings'
// value shape: { version: 1, dealMode: 'solvable' | 'random' }
// 5 个降级触发点：
//   1) storage 未初始化 / 空值
//   2) 反序列化失败 / 非对象
//   3) version 缺失或 !== 1
//   4) dealMode 缺失或非 'solvable'/'random'
//   5) wx.getStorageSync 抛异常
// 任一异常一律降级为 DEFAULT_SETTINGS，永不抛出

export const STORAGE_KEY = 'm24.settings';

export const DEAL_MODE = {
  SOLVABLE: 'solvable',
  RANDOM: 'random',
};

const DEFAULT_SETTINGS = Object.freeze({
  version: 1,
  dealMode: DEAL_MODE.SOLVABLE,
});

function defaults() {
  // 每次返回一个新对象，避免调用者修改共享实例
  return { version: 1, dealMode: DEAL_MODE.SOLVABLE };
}

function _getStorage(key) {
  // 单测环境用 globalThis.wx；生产为微信小游戏 wx
  const w = typeof wx !== 'undefined' ? wx : (typeof globalThis !== 'undefined' && globalThis.wx ? globalThis.wx : null);
  if (!w || typeof w.getStorageSync !== 'function') return undefined;
  return w.getStorageSync(key);
}

function _setStorage(key, val) {
  const w = typeof wx !== 'undefined' ? wx : (typeof globalThis !== 'undefined' && globalThis.wx ? globalThis.wx : null);
  if (!w || typeof w.setStorageSync !== 'function') return false;
  w.setStorageSync(key, val);
  return true;
}

export function loadSettings() {
  try {
    const raw = _getStorage(STORAGE_KEY);
    if (raw === undefined || raw === null || raw === '') return defaults();
    if (typeof raw !== 'object') return defaults();
    if (raw.version !== 1) return defaults();
    if (raw.dealMode !== DEAL_MODE.SOLVABLE && raw.dealMode !== DEAL_MODE.RANDOM) {
      return defaults();
    }
    return { version: 1, dealMode: raw.dealMode };
  } catch (e) {
    return defaults();
  }
}

export function saveSettings(settings) {
  try {
    const mode = settings && settings.dealMode === DEAL_MODE.RANDOM ? DEAL_MODE.RANDOM : DEAL_MODE.SOLVABLE;
    const clean = { version: 1, dealMode: mode };
    return _setStorage(STORAGE_KEY, clean);
  } catch (e) {
    return false;
  }
}

export function getDefaultSettings() {
  return defaults();
}

export default { loadSettings, saveSettings, getDefaultSettings, STORAGE_KEY, DEAL_MODE };
