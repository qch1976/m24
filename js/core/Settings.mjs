// m24 - Settings.mjs (ESM copy for Node self-test)
export const STORAGE_KEY = 'm24.settings';
export const DEAL_MODE = { SOLVABLE: 'solvable', RANDOM: 'random' };
function defaults() { return { version: 1, dealMode: DEAL_MODE.SOLVABLE }; }
function _get(key) {
  const w = typeof wx !== 'undefined' ? wx : (typeof globalThis !== 'undefined' && globalThis.wx ? globalThis.wx : null);
  if (!w || typeof w.getStorageSync !== 'function') return undefined;
  return w.getStorageSync(key);
}
function _set(key, val) {
  const w = typeof wx !== 'undefined' ? wx : (typeof globalThis !== 'undefined' && globalThis.wx ? globalThis.wx : null);
  if (!w || typeof w.setStorageSync !== 'function') return false;
  w.setStorageSync(key, val);
  return true;
}
export function loadSettings() {
  try {
    const raw = _get(STORAGE_KEY);
    if (raw === undefined || raw === null || raw === '') return defaults();
    if (typeof raw !== 'object') return defaults();
    if (raw.version !== 1) return defaults();
    if (raw.dealMode !== DEAL_MODE.SOLVABLE && raw.dealMode !== DEAL_MODE.RANDOM) return defaults();
    return { version: 1, dealMode: raw.dealMode };
  } catch (e) { return defaults(); }
}
export function saveSettings(settings) {
  try {
    const mode = settings && settings.dealMode === DEAL_MODE.RANDOM ? DEAL_MODE.RANDOM : DEAL_MODE.SOLVABLE;
    return _set(STORAGE_KEY, { version: 1, dealMode: mode });
  } catch (e) { return false; }
}
export function getDefaultSettings() { return defaults(); }
export default { loadSettings, saveSettings, getDefaultSettings, STORAGE_KEY, DEAL_MODE };
