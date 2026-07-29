// selftest_input05_storage.mjs — R-05
// 持久化 loadSettings/saveSettings 5 降级触发点 + 往返一致
import { loadSettings, saveSettings, DEAL_MODE } from './js/core/Settings.mjs';

// mock wx storage
let store = {};
globalThis.wx = {
  getStorageSync: (k) => store[k],
  setStorageSync: (k, v) => { store[k] = v; },
  removeStorageSync: (k) => { delete store[k]; },
};

let ok = 0, fail = 0;
function check(name, cond) {
  if (cond) { ok++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name}`); }
}

// 1) 空 storage 降级
store = {};
check('1) 空 storage → default solvable', loadSettings().dealMode === 'solvable');
// 2) 非对象 → default
store = { 'm24.settings': 'not-an-object' };
check('2) 非对象 → default', loadSettings().dealMode === 'solvable');
// 3) version 缺失
store = { 'm24.settings': { version: 99, dealMode: 'random' } };
check('3) version=99 → default', loadSettings().dealMode === 'solvable');
// 4) dealMode 非法
store = { 'm24.settings': { version: 1, dealMode: 'invalid' } };
check('4) dealMode=invalid → default', loadSettings().dealMode === 'solvable');
// 5) getStorageSync 抛异常
store = null;
globalThis.wx.getStorageSync = () => { throw new Error('mock error'); };
check('5) getStorageSync throws → default', loadSettings().dealMode === 'solvable');

// restore
store = {};
globalThis.wx.getStorageSync = (k) => store[k];

// 6) 往返一致：save random → load random
saveSettings({ dealMode: DEAL_MODE.RANDOM });
check('6) save random then load = random', loadSettings().dealMode === 'random');
// 7) save solvable → load solvable
saveSettings({ dealMode: DEAL_MODE.SOLVABLE });
check('7) save solvable then load = solvable', loadSettings().dealMode === 'solvable');
// 8) save 非法 dealMode → 归一化到 solvable
saveSettings({ dealMode: 'weird' });
check('8) save weird → normalized to solvable', loadSettings().dealMode === 'solvable');

console.log(`[selftest_input05_storage] R-05: ok=${ok} fail=${fail}`);
console.log(fail === 0 ? 'PASS' : 'FAIL');
process.exit(fail === 0 ? 0 : 1);
