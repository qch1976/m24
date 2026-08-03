// m24 - Settings.mjs (ESM copy for Node self-test)
// INPUT-05：设置持久化模块 / INPUT-06：v1 → v2 迁移（新增 advancedCalc）
// 依据：106-INPUT05 §7 + INPUT-06.md §1.5 + 170-INPUT06-Architect方案.md §6
//
// storage key: 'm24.settings'
// v1 shape: { version: 1, dealMode: 'solvable' | 'random' }
// v2 shape: { version: 2, dealMode: 'solvable' | 'random', advancedCalc: boolean }
//
// 7 个降级触发点（方案 §6.2）：
//   D1 storage 未初始化 / 空值            → 整体默认 v2
//   D2 反序列化失败 / 非对象 / Array      → 整体默认 v2
//   M  version === 1                      → 迁移：保留 dealMode，advancedCalc=false
//   D3 v1 且 dealMode 非法                → 整体默认 v2
//   D4 version 既非 1 也非 2              → 整体默认 v2
//   D5 v2 且 dealMode 非法                → 整体默认 v2
//   D6 v2 且 advancedCalc 非 boolean      → 字段级降级：补 false，保留 dealMode
//   D7 getStorageSync 抛异常              → 整体默认 v2（永不崩启动）
// 任一异常一律不抛出

export const STORAGE_KEY = 'm24.settings';

export const SETTINGS_VERSION = 2;

export const DEAL_MODE = {
  SOLVABLE: 'solvable',
  RANDOM: 'random',
};

const DEFAULT_SETTINGS = Object.freeze({
  version: 2,
  dealMode: DEAL_MODE.SOLVABLE,
  advancedCalc: false,
});

function defaults() {
  // 每次返回一个新对象，避免调用者修改共享实例
  return { version: 2, dealMode: DEAL_MODE.SOLVABLE, advancedCalc: false };
}

function _validMode(m) {
  return m === DEAL_MODE.SOLVABLE || m === DEAL_MODE.RANDOM;
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
    if (raw === undefined || raw === null || raw === '') return defaults();     // D1
    if (typeof raw !== 'object' || Array.isArray(raw)) return defaults();      // D2

    if (raw.version === 1) {                                                   // M 迁移
      if (!_validMode(raw.dealMode)) return defaults();                        // D3
      return { version: 2, dealMode: raw.dealMode, advancedCalc: false };
    }
    if (raw.version !== 2) return defaults();                                  // D4
    if (!_validMode(raw.dealMode)) return defaults();                          // D5
    if (typeof raw.advancedCalc !== 'boolean') {                               // D6 字段级降级
      return { version: 2, dealMode: raw.dealMode, advancedCalc: false };
    }
    return { version: 2, dealMode: raw.dealMode, advancedCalc: raw.advancedCalc };
  } catch (e) {
    return defaults();                                                         // D7
  }
}

export function saveSettings(settings) {
  try {
    const mode = settings && settings.dealMode === DEAL_MODE.RANDOM ? DEAL_MODE.RANDOM : DEAL_MODE.SOLVABLE;
    const clean = { version: 2, dealMode: mode, advancedCalc: !!(settings && settings.advancedCalc) };
    return _setStorage(STORAGE_KEY, clean);
  } catch (e) {
    return false;
  }
}

export function getDefaultSettings() {
  return defaults();
}

export default { loadSettings, saveSettings, getDefaultSettings, STORAGE_KEY, DEAL_MODE, SETTINGS_VERSION };
