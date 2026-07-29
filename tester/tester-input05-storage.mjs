// tester-input05-storage.mjs
// Tester 独立复核 R-05: m24.settings 5 降级触发点 + save/load 往返
// 立场: 独立构造 mock wx.storage，独立断言（不复用 Developer selftest）
//
// 5 降级触发点（106-INPUT05 §11.2 + Settings.mjs 源码）:
//   1) getStorageSync throws
//   2) storage value === undefined (键不存在)
//   3) storage value 非对象 (typeof !== 'object')
//   4) version !== 1
//   5) dealMode 非法（不是 'solvable' 也不是 'random'）

import { loadSettings, saveSettings, getDefaultSettings, DEAL_MODE, STORAGE_KEY } from '../js/core/Settings.mjs';

let ok = 0, fail = 0;
function assert(name, actual, expected) {
  const pass = JSON.stringify(actual) === JSON.stringify(expected);
  if (pass) { ok++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name}\n    expected=${JSON.stringify(expected)}\n    actual  =${JSON.stringify(actual)}`); }
}

// mock wx
function installMockWx(getFn, setFn) {
  globalThis.wx = {
    getStorageSync: getFn || (() => undefined),
    setStorageSync: setFn || (() => {}),
  };
}
function uninstallMockWx() { delete globalThis.wx; }

const DEFAULT = { version: 1, dealMode: 'solvable' };

console.log('[tester-input05-storage] R-05 独立复核 5 降级 + 往返');

// -- 触发点 1: getStorageSync throws
installMockWx(() => { throw new Error('mock throw'); }, null);
assert('1) getStorageSync 抛错 → default', loadSettings(), DEFAULT);

// -- 触发点 2: undefined
installMockWx(() => undefined, null);
assert('2) storage undefined (键不存在) → default', loadSettings(), DEFAULT);

// -- 触发点 3a: null
installMockWx(() => null, null);
assert('3a) storage null → default', loadSettings(), DEFAULT);

// -- 触发点 3b: 空字符串
installMockWx(() => '', null);
assert('3b) storage empty string → default', loadSettings(), DEFAULT);

// -- 触发点 3c: 非对象 (数字)
installMockWx(() => 42, null);
assert('3c) storage 是数字 → default', loadSettings(), DEFAULT);

// -- 触发点 3d: 非对象 (字符串)
installMockWx(() => 'random', null);
assert('3d) storage 是字符串 → default', loadSettings(), DEFAULT);

// -- 触发点 4: version !== 1
installMockWx(() => ({ version: 2, dealMode: 'random' }), null);
assert('4a) version=2 → default', loadSettings(), DEFAULT);
installMockWx(() => ({ version: 0, dealMode: 'random' }), null);
assert('4b) version=0 → default', loadSettings(), DEFAULT);
installMockWx(() => ({ dealMode: 'random' }), null);
assert('4c) version missing → default', loadSettings(), DEFAULT);

// -- 触发点 5: dealMode 非法
installMockWx(() => ({ version: 1, dealMode: 'invalid' }), null);
assert('5a) dealMode=invalid → default', loadSettings(), DEFAULT);
installMockWx(() => ({ version: 1, dealMode: 42 }), null);
assert('5b) dealMode=数字 → default', loadSettings(), DEFAULT);
installMockWx(() => ({ version: 1 }), null);
assert('5c) dealMode missing → default', loadSettings(), DEFAULT);

// -- 合法 solvable
installMockWx(() => ({ version: 1, dealMode: 'solvable' }), null);
assert('6a) 合法 solvable → 保留', loadSettings(), { version: 1, dealMode: 'solvable' });

// -- 合法 random
installMockWx(() => ({ version: 1, dealMode: 'random' }), null);
assert('6b) 合法 random → 保留', loadSettings(), { version: 1, dealMode: 'random' });

// -- 往返测试
let mockStore = {};
installMockWx(
  (k) => mockStore[k],
  (k, v) => { mockStore[k] = v; }
);
// 存 random
saveSettings({ dealMode: 'random' });
assert('7a) save random → load = random', loadSettings(), { version: 1, dealMode: 'random' });
// 覆盖 solvable
saveSettings({ dealMode: 'solvable' });
assert('7b) save solvable → load = solvable', loadSettings(), { version: 1, dealMode: 'solvable' });
// 存怪值 → 归一化到 solvable（Settings.mjs saveSettings 里做归一化）
saveSettings({ dealMode: 'weird' });
assert('7c) save "weird" → 归一化为 solvable', loadSettings(), { version: 1, dealMode: 'solvable' });
// 未传 settings
saveSettings();
assert('7d) save() 无参 → 归一化为 solvable', loadSettings(), { version: 1, dealMode: 'solvable' });

// -- 默认工厂
uninstallMockWx();
installMockWx(() => undefined, null);
assert('8) getDefaultSettings 返回结构', getDefaultSettings(), DEFAULT);

uninstallMockWx();
console.log(`\n[tester-input05-storage] R-05: ok=${ok} fail=${fail}`);
console.log(fail === 0 ? 'PASS' : 'FAIL');
process.exit(fail === 0 ? 0 : 1);
