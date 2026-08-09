// m24 - Settings.js
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
  // 🔴 task-111 GUI-2：三项高级能力子开关（仅在 advancedCalc 为 true 时生效）。
  //   默认 true：旧存档无此字段时行为与修前一致（开 advancedCalc 即三项全开）。
  capRecip: true,
  capFact: true,
  capMod: true,
  // 🔴 INPUT-08 §10.1：capPow/capLog 默认 **false**，与上三项的默认 true **有意不对称**。
  //   缘由：引擎侧 pow/log 采「=== true 才开」（RecipSolver allowPow/allowLog），
  //   若此处默认 true，旧存档用户升级后会凭空多出幂/对数解 ⇒ 破 R-01 零误伤。
  //   ⚠️ 后人勿为「与 capRecip/capFact/capMod 一致」而改成 true —— 那不是笔误，是刻意的。
  capPow: false,
  capLog: false,
});

function defaults() {
  // 每次返回一个新对象，避免调用者修改共享实例
  return {
    version: 2, dealMode: DEAL_MODE.SOLVABLE, advancedCalc: false,
    capRecip: true, capFact: true, capMod: true,
    capPow: false, capLog: false,   // §10.1：默认关（与上三项有意不对称）
  };
}

// 🔴 子开关读取：非 boolean（含旧存档缺字段 undefined）一律归 true，
//   保证「从未碰过子开关的用户」升级后行为不变（与 advancedCalc 的 false 兼容口径相反，
//   因为子开关的【历史隐含值】是全开，而非全关）。
function _cap(v) {
  return typeof v === 'boolean' ? v : true;
}

// 🔴 INPUT-08 §10.1：pow/log 专用归一 —— 非 boolean 一律归 **false**（默认关）。
//   不可复用 _cap()：那是「默认 true」，对 pow/log 会让旧存档凭空开启高级能力。
//   与引擎 allowPow/allowLog 的「=== true 才开」严格同口径。
//   🔴 守护：改成默认 true 会使测试 §10.1 门禁与 R-01 零误伤断言判红。
function _capOff(v) {
  return v === true;
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
      return {
        version: 2, dealMode: raw.dealMode, advancedCalc: false,
        capRecip: true, capFact: true, capMod: true,
        capPow: false, capLog: false,   // §10.1：v1 存档无此概念 ⇒ 关
      };
    }
    if (raw.version !== 2) return defaults();                                  // D4
    if (!_validMode(raw.dealMode)) return defaults();                          // D5
    if (typeof raw.advancedCalc !== 'boolean') {                               // D6 字段级降级
      return {
        version: 2, dealMode: raw.dealMode, advancedCalc: false,
        capRecip: _cap(raw.capRecip), capFact: _cap(raw.capFact), capMod: _cap(raw.capMod),
        capPow: _capOff(raw.capPow), capLog: _capOff(raw.capLog),
      };
    }
    return {
      version: 2, dealMode: raw.dealMode, advancedCalc: raw.advancedCalc,
      capRecip: _cap(raw.capRecip), capFact: _cap(raw.capFact), capMod: _cap(raw.capMod),
      capPow: _capOff(raw.capPow), capLog: _capOff(raw.capLog),
    };
  } catch (e) {
    return defaults();                                                         // D7
  }
}

export function saveSettings(settings) {
  try {
    const mode = settings && settings.dealMode === DEAL_MODE.RANDOM ? DEAL_MODE.RANDOM : DEAL_MODE.SOLVABLE;
    const clean = {
      version: 2, dealMode: mode, advancedCalc: !!(settings && settings.advancedCalc),
      capRecip: _cap(settings && settings.capRecip),
      capFact: _cap(settings && settings.capFact),
      capMod: _cap(settings && settings.capMod),
      capPow: _capOff(settings && settings.capPow),
      capLog: _capOff(settings && settings.capLog),
    };
    return _setStorage(STORAGE_KEY, clean);
  } catch (e) {
    return false;
  }
}

export function getDefaultSettings() {
  return defaults();
}

export default { loadSettings, saveSettings, getDefaultSettings, STORAGE_KEY, DEAL_MODE, SETTINGS_VERSION };
