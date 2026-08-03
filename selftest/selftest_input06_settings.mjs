// selftest_input06_settings.mjs — INPUT-06 §1.5 m24.settings v1→v2 迁移
// R-10：迁移 + 7 个降级触发点 + 往返一致性；任一路径不得抛异常
const store = {};
globalThis.wx = { getStorageSync: (k) => store[k], setStorageSync: (k, v) => { store[k] = v; } };
const { loadSettings, saveSettings, DEAL_MODE, SETTINGS_VERSION, getDefaultSettings } = await import('../js/core/Settings.mjs');

let pass = 0, fail = 0; const bad = [];
const ck = (n, c, e) => { if (c) { pass++; console.log('  ok  ' + n + (e ? '  ' + e : '')); } else { fail++; bad.push(n); console.log('  XX  ' + n + (e ? '  ' + e : '')); } };
const D = { version: 2, dealMode: 'solvable', advancedCalc: false };

console.log('='.repeat(70));
console.log('A. v1 → v2 迁移 + 7 个降级触发点');
console.log('='.repeat(70));
const cases = [
  ['M  v1 solvable → v2 adv=false', { version: 1, dealMode: 'solvable' }, { version: 2, dealMode: 'solvable', advancedCalc: false }],
  ['M  v1 random   → v2 保留 mode', { version: 1, dealMode: 'random' }, { version: 2, dealMode: 'random', advancedCalc: false }],
  ['   v2 adv=true  原样读回', { version: 2, dealMode: 'random', advancedCalc: true }, { version: 2, dealMode: 'random', advancedCalc: true }],
  ['   v2 adv=false 原样读回', { version: 2, dealMode: 'solvable', advancedCalc: false }, D],
  ['D1 首次安装(undefined)', undefined, D],
  ['D1 空字符串', '', D],
  ['D1 null', null, D],
  ['D2 非对象(string)', 'm24', D],
  ['D2 非对象(number)', 12345, D],
  ['D2 Array', [1, 2], D],
  ['D3 v1 + dealMode 非法', { version: 1, dealMode: 'xx' }, D],
  ['D3 v1 + dealMode 缺失', { version: 1 }, D],
  ['D4 version=3(未来版本)', { version: 3, dealMode: 'random', advancedCalc: true }, D],
  ['D4 version 缺失', { dealMode: 'random', advancedCalc: true }, D],
  ['D4 version="2"(字符串)', { version: '2', dealMode: 'random', advancedCalc: true }, D],
  ['D5 v2 + dealMode 非法', { version: 2, dealMode: 'zz', advancedCalc: true }, D],
  ['D6 v2 + adv 为字符串(字段级降级)', { version: 2, dealMode: 'random', advancedCalc: 'yes' }, { version: 2, dealMode: 'random', advancedCalc: false }],
  ['D6 v2 + adv 为数字 1', { version: 2, dealMode: 'random', advancedCalc: 1 }, { version: 2, dealMode: 'random', advancedCalc: false }],
  ['D6 v2 + adv 缺失', { version: 2, dealMode: 'random' }, { version: 2, dealMode: 'random', advancedCalc: false }],
  ['   v1 带多余字段(忽略)', { version: 1, dealMode: 'random', foo: 1, bar: 'x' }, { version: 2, dealMode: 'random', advancedCalc: false }],
];
for (const [n, input, exp] of cases) {
  store['m24.settings'] = input;
  let r, threw = false;
  try { r = loadSettings(); } catch (e) { threw = true; }
  ck(n, !threw && JSON.stringify(r) === JSON.stringify(exp), threw ? 'THREW!' : JSON.stringify(r));
}

console.log('\n' + '='.repeat(70));
console.log('B. D7 storage 抛异常 → 不崩启动');
console.log('='.repeat(70));
globalThis.wx.getStorageSync = () => { throw new Error('storage boom'); };
let r7, threw7 = false;
try { r7 = loadSettings(); } catch (e) { threw7 = true; }
ck('D7 getStorageSync throw → 默认值且不抛出', !threw7 && JSON.stringify(r7) === JSON.stringify(D), threw7 ? 'THREW!' : JSON.stringify(r7));
globalThis.wx.getStorageSync = undefined;
let r8, threw8 = false;
try { r8 = loadSettings(); } catch (e) { threw8 = true; }
ck('wx.getStorageSync 不存在 → 默认值', !threw8 && JSON.stringify(r8) === JSON.stringify(D), threw8 ? 'THREW!' : JSON.stringify(r8));
globalThis.wx = { getStorageSync: (k) => store[k], setStorageSync: (k, v) => { store[k] = v; } };

console.log('\n' + '='.repeat(70));
console.log('C. 往返一致性（save → load）4 组合全覆盖');
console.log('='.repeat(70));
for (const dm of ['solvable', 'random']) {
  for (const ac of [true, false]) {
    ck(`save{${dm},${ac}} → load 一致`, (() => {
      saveSettings({ dealMode: dm, advancedCalc: ac });
      const r = loadSettings();
      return r.version === 2 && r.dealMode === dm && r.advancedCalc === ac;
    })(), JSON.stringify(store['m24.settings']));
  }
}
ck('save 落库 version 恒为 2', (() => { saveSettings({ dealMode: 'random', advancedCalc: true }); return store['m24.settings'].version === 2; })());
ck('save 非法 mode 归一为 solvable', (() => { saveSettings({ dealMode: 'zz', advancedCalc: true }); return loadSettings().dealMode === 'solvable'; })());
ck('save adv 非 boolean 归一为 boolean', (() => { saveSettings({ dealMode: 'random', advancedCalc: 'yes' }); return loadSettings().advancedCalc === true; })());
ck('save undefined 参数不抛出', (() => { try { saveSettings(undefined); return true; } catch (e) { return false; } })());

console.log('\n' + '='.repeat(70));
console.log('D. 常量与默认值');
console.log('='.repeat(70));
ck('SETTINGS_VERSION === 2', SETTINGS_VERSION === 2);
ck('DEAL_MODE 双值完整', DEAL_MODE.SOLVABLE === 'solvable' && DEAL_MODE.RANDOM === 'random');
ck('getDefaultSettings() advancedCalc 默认 false', getDefaultSettings().advancedCalc === false);
ck('getDefaultSettings() 返回新对象（不共享引用）', (() => { const a = getDefaultSettings(); a.dealMode = 'random'; return getDefaultSettings().dealMode === 'solvable'; })());

console.log('\n' + '='.repeat(70));
console.log(`RESULT: pass=${pass} fail=${fail}`);
if (fail > 0) { console.log('FAILED: ' + bad.join(' | ')); process.exit(1); }
console.log('ALL PASS'); console.log('='.repeat(70)); process.exit(0);
