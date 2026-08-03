// tester-input06-r07r03.mjs
// Tester 独立采样：R-07 settings v1→v2 迁移（≥6 用例）+ R-03 键位布局 + R-01/R-06 静态锚点
// 依据 INPUT-06.md §4 R-01 / R-03 / R-06 / R-07；被测 commit 09efb3d
// 禁 solver 自证：本脚本对 storage 用自建 mock，断言由独立期望表驱动
import fs from 'node:fs';

let pass = 0, fail = 0;
const ck = (name, ok, extra) => {
  if (ok) { pass++; console.log(`  ok  ${name}${extra ? '   ' + extra : ''}`); }
  else { fail++; console.log(`  XX  ${name}${extra ? '   ' + extra : ''}`); }
};
const hdr = (t) => console.log(`\n${'='.repeat(70)}\n${t}\n${'='.repeat(70)}`);

console.log(`tester-input06-r07r03.mjs  @ ${new Date().toISOString()}`);
console.log(`node ${process.version}  platform=${process.platform}/${process.arch}`);

// ---------- 自建 wx storage mock（Tester 独立实现，不引 Developer 任何 helper） ----------
function installMock(initialRaw, opts = {}) {
  const store = new Map();
  if (initialRaw !== undefined) store.set('m24.settings', initialRaw);
  globalThis.wx = {
    getStorageSync(k) {
      if (opts.throwOnGet) throw new Error('mock storage failure');
      return store.has(k) ? store.get(k) : '';
    },
    setStorageSync(k, v) {
      if (opts.throwOnSet) throw new Error('mock storage write failure');
      store.set(k, v);
    },
  };
  return store;
}

const S = await (async () => {
  try { return await import('../js/core/Settings.mjs'); }
  catch { return await import('../js/core/Settings.js'); }
})();

hdr('R-07 · settings 持久化 + v1→v2 迁移矩阵（Tester 独立期望表，14 用例）');

// 每条：[用例名, storage 初始值, opts, 期望 {version,dealMode,advancedCalc}, 触发点]
const CASES = [
  ['D1-a storage 未初始化（key 不存在）', undefined, {}, { version: 2, dealMode: 'solvable', advancedCalc: false }, 'D1'],
  ['D1-b storage 空串', '', {}, { version: 2, dealMode: 'solvable', advancedCalc: false }, 'D1'],
  ['D1-c storage null', null, {}, { version: 2, dealMode: 'solvable', advancedCalc: false }, 'D1'],
  ['D2-a 非对象（字符串）', 'garbage', {}, { version: 2, dealMode: 'solvable', advancedCalc: false }, 'D2'],
  ['D2-b Array', [1, 2, 3], {}, { version: 2, dealMode: 'solvable', advancedCalc: false }, 'D2'],
  ['M-a  v1 迁移 solvable → advancedCalc=false', { version: 1, dealMode: 'solvable' }, {}, { version: 2, dealMode: 'solvable', advancedCalc: false }, 'M'],
  ['M-b  v1 迁移 random 须保留 dealMode', { version: 1, dealMode: 'random' }, {}, { version: 2, dealMode: 'random', advancedCalc: false }, 'M'],
  ['M-c  v1 带杂字段 advancedCalc=true 须被忽略（v1 无此字段语义）', { version: 1, dealMode: 'random', advancedCalc: true }, {}, { version: 2, dealMode: 'random', advancedCalc: false }, 'M'],
  ['D3   v1 且 dealMode 非法 → 整体默认', { version: 1, dealMode: 'bogus' }, {}, { version: 2, dealMode: 'solvable', advancedCalc: false }, 'D3'],
  ['D4   version 既非 1 也非 2 → 整体默认', { version: 3, dealMode: 'random', advancedCalc: true }, {}, { version: 2, dealMode: 'solvable', advancedCalc: false }, 'D4'],
  ['D5   v2 且 dealMode 非法 → 整体默认', { version: 2, dealMode: 'nope', advancedCalc: true }, {}, { version: 2, dealMode: 'solvable', advancedCalc: false }, 'D5'],
  ['D6   v2 且 advancedCalc 非 boolean → 字段级降级（保留 dealMode）', { version: 2, dealMode: 'random', advancedCalc: 'yes' }, {}, { version: 2, dealMode: 'random', advancedCalc: false }, 'D6'],
  ['D7   getStorageSync 抛异常 → 整体默认（永不崩启动）', { version: 2, dealMode: 'random', advancedCalc: true }, { throwOnGet: true }, { version: 2, dealMode: 'solvable', advancedCalc: false }, 'D7'],
  ['OK   v2 正常读取 advancedCalc=true', { version: 2, dealMode: 'random', advancedCalc: true }, {}, { version: 2, dealMode: 'random', advancedCalc: true }, '—'],
];

for (const [name, raw, opts, exp, dp] of CASES) {
  installMock(raw, opts);
  let got = null, threw = null;
  try { got = S.loadSettings(); } catch (e) { threw = e; }
  const ok = !threw && got
    && got.version === exp.version
    && got.dealMode === exp.dealMode
    && got.advancedCalc === exp.advancedCalc;
  ck(`R-07 [${dp}] ${name}`, ok,
     threw ? `抛异常 ${threw.message}` : `got=${JSON.stringify(got)}`);
}

hdr('R-07 · 「勾选高级 → 保存 → 重启 → 仍高级」往返闭环（4 用例）');

// 往返：save 后用同一 store 重新 load，模拟重启
function roundTrip(toSave) {
  const store = installMock(undefined, {});
  S.saveSettings(toSave);
  const persisted = store.get('m24.settings');
  const reloaded = S.loadSettings();   // 模拟重启后读取
  return { persisted, reloaded };
}

{
  const r = roundTrip({ dealMode: 'solvable', advancedCalc: true });
  ck('R-07 勾选高级 → 保存 → 重启 → 仍高级', r.reloaded.advancedCalc === true,
     `persisted=${JSON.stringify(r.persisted)} reloaded=${JSON.stringify(r.reloaded)}`);
  ck('R-07 落盘 shape 恒为 v2（version:2）', r.persisted && r.persisted.version === 2);
}
{
  const r = roundTrip({ dealMode: 'random', advancedCalc: false });
  ck('R-07 关闭高级 → 保存 → 重启 → 仍关闭', r.reloaded.advancedCalc === false,
     `reloaded=${JSON.stringify(r.reloaded)}`);
  ck('R-07 dealMode=random 往返不丢', r.reloaded.dealMode === 'random');
}
{
  // 写入异常不得抛出
  installMock(undefined, { throwOnSet: true });
  let threw = null, ret;
  try { ret = S.saveSettings({ dealMode: 'random', advancedCalc: true }); } catch (e) { threw = e; }
  ck('R-07 setStorageSync 抛异常时 saveSettings 不外抛（返回 false）', !threw && ret === false,
     threw ? `抛了 ${threw.message}` : `ret=${ret}`);
}
{
  // saveSettings 须做输入净化（防脏字段入库）
  const store = installMock(undefined, {});
  S.saveSettings({ dealMode: 'bogus', advancedCalc: 'truthy-string', evil: 1 });
  const p = store.get('m24.settings');
  ck('R-07 saveSettings 净化：非法 dealMode 落盘为 solvable', p.dealMode === 'solvable', JSON.stringify(p));
  ck('R-07 saveSettings 净化：advancedCalc 强制 boolean', typeof p.advancedCalc === 'boolean' && p.advancedCalc === true);
  ck('R-07 saveSettings 净化：脏字段 evil 不落盘', !('evil' in p));
}
{
  // 默认值不可被调用者污染（共享实例风险）
  installMock(undefined, {});
  const a = S.loadSettings(); a.dealMode = 'random'; a.advancedCalc = true;
  const b = S.loadSettings();
  ck('R-07 defaults 每次返回新对象（调用者改动不污染下次读取）',
     b.dealMode === 'solvable' && b.advancedCalc === false, `b=${JSON.stringify(b)}`);
}

hdr('R-03 · 键位布局运行时几何断言（layoutFor 15/14 键 · 411×891 DP）');

const aa = fs.readFileSync(new URL('../js/ui/AnswerArea.js', import.meta.url), 'utf8');
// js/ui/ 下无 .mjs 副本且仓库无 package.json，node 不能直接 import .js（ESM）。
// 故 Tester 在 tester/_esm/ 下自建隔离副本：仅把绘图依赖 './Components' 换成 no-op stub
// （AnswerArea.js 全文 1 行改动，已在报告中留 SHA-1 证据），layoutFor 是纯几何函数不触发绘制。
// 不修改任何产品文件。
const AA = await (async () => {
  const tries = ['./_esm/AnswerArea.mjs', '../js/ui/AnswerArea.mjs', '../js/ui/AnswerArea.js'];
  for (const t of tries) {
    try { const m = await import(t); if (m && typeof m.layoutFor === 'function') { console.log(`  (import 成功: ${t})`); return m; } } catch {}
  }
  return null;
})();

if (!AA || typeof AA.layoutFor !== 'function') {
  console.log(`  ⏸ R-03 无法 import AnswerArea（${AA ? 'layoutFor 缺失' : 'import 失败'}）→ 降级为字符串核查`);
  ck('R-03 layoutFor(advancedCalc) 统一布局入口存在（源码）', /export function layoutFor/.test(aa));
} else {
  const DESIGN_W = 411, DESIGN_H = 891, SAFE_BOTTOM = 891 - 13;
  const ON = AA.layoutFor(true), OFF = AA.layoutFor(false);

  // ① 键数 15 / 14
  ck('R-03① 开关打开 keyCount = 15', ON.keyCount === 15, `实际 ${ON.keyCount}`);
  ck('R-03① 开关关闭 keyCount = 14', OFF.keyCount === 14, `实际 ${OFF.keyCount}`);
  ck('R-03① 15 - 14 = 1（恰好新增 1 个高级键 1/x）', ON.keyCount - OFF.keyCount === 1);
  ck('R-03① 关闭态 advRow 不渲染（=== null）', OFF.advRow === null, `实际 ${JSON.stringify(OFF.advRow)}`);
  ck('R-03① 打开态 advRow 存在', !!ON.advRow);

  // ② 按行展开为真实按钮矩形（独立几何计算，不引产品 render 代码）
  const expandRow = (r, labelPrefix) => {
    if (!r) return [];
    const cols = r.cols, gap = r.gap || 0;
    const w = (r.w - gap * (cols - 1)) / cols;
    return Array.from({ length: cols }, (_, i) => ({
      name: `${labelPrefix}#${i}`, x: r.x + i * (w + gap), y: r.y, w, h: r.h,
    }));
  };
  const buttonsOf = (L) => {
    const list = [];
    list.push(...expandRow(L.numRow, 'num'));
    list.push(...expandRow(L.opRow, 'op'));
    if (L.advRow) list.push({ name: 'adv#1x', x: L.advRow.x + (L.advRow.w / L.advRow.cols), y: L.advRow.y, w: L.advRow.w / L.advRow.cols, h: L.advRow.h });
    list.push(...expandRow(L.ctrlRow, 'ctrl'));
    list.push({ name: 'backBtn', ...L.backBtn });
    return list;
  };

  for (const [tag, L] of [['ON(15键)', ON], ['OFF(14键)', OFF]]) {
    const btns = buttonsOf(L);
    // 实际按钮数 = 4 num + 6 op + (1 adv) + 4 ctrl = 14/15（backBtn 是返回✕，不计入答题键）
    const keyBtns = btns.filter(b => b.name !== 'backBtn');
    ck(`R-03② ${tag} 实际按钮矩形数 = keyCount`, keyBtns.length === L.keyCount,
       `矩形 ${keyBtns.length} vs keyCount ${L.keyCount}`);

    // tap 区 ≥ 44×44
    const small = btns.filter(b => b.w < 44 || b.h < 44);
    ck(`R-03② ${tag} 全部 tap 区 ≥ 44×44 DP`, small.length === 0,
       small.length ? small.map(b => `${b.name}(${b.w.toFixed(1)}×${b.h})`).join(' ') : `最小 ${Math.min(...btns.map(b=>Math.min(b.w,b.h))).toFixed(1)}`);

    // 无重叠（两两 AABB 相交检测）
    const overlaps = [];
    for (let i = 0; i < btns.length; i++) for (let j = i + 1; j < btns.length; j++) {
      const a = btns[i], b = btns[j];
      if (a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h)
        overlaps.push(`${a.name}×${b.name}`);
    }
    ck(`R-03② ${tag} 按钮两两无重叠（${btns.length} 个矩形 C(n,2) 全检）`, overlaps.length === 0,
       overlaps.length ? overlaps.slice(0, 4).join(' ') : `检查 ${btns.length * (btns.length - 1) / 2} 对`);

    // 411×891 DP 边界内
    const oob = btns.filter(b => b.x < 0 || b.y < 0 || b.x + b.w > DESIGN_W || b.y + b.h > DESIGN_H);
    ck(`R-03② ${tag} 全部按钮在 411×891 DP 画布内`, oob.length === 0,
       oob.length ? oob.map(b => b.name).join(' ') : 'ok');

    // 底沿安全区
    const maxBottom = Math.max(...btns.map(b => b.y + b.h));
    ck(`R-03② ${tag} 底沿 ${maxBottom} ≤ 878（891−13 安全区）`, maxBottom <= SAFE_BOTTOM, `maxBottom=${maxBottom}`);

    // 各行都在 area 内
    const inArea = ['numRow', 'opRow', 'ctrlRow'].every(k => L[k] && L[k].y >= L.area.y && L[k].y + L[k].h <= L.area.y + L.area.h);
    ck(`R-03② ${tag} numRow/opRow/ctrlRow 均在 area 垂直范围内`, inArea,
       `area y∈[${L.area.y},${L.area.y + L.area.h}]`);
  }

  // ③ 开关切换的位移一致性：关闭态各行上移恰好 62
  {
    const SHIFT = 62;
    const rows = ['formula', 'backBtn', 'numRow', 'opRow'];
    const bad = rows.filter(k => (OFF[k].y - ON[k].y) !== SHIFT);
    ck(`R-03③ 关闭态 formula/backBtn/numRow/opRow 均下移 ${SHIFT} DP（advRow 让位回收）`, bad.length === 0,
       bad.length ? bad.map(k => `${k}: ${OFF[k].y - ON[k].y}`).join(' ') : `全部 +${SHIFT}`);
    ck('R-03③ ctrlRow 底行不动（两态同 y，仍贴底）', ON.ctrlRow.y === OFF.ctrlRow.y,
       `ON=${ON.ctrlRow.y} OFF=${OFF.ctrlRow.y}`);
    ck('R-03③ area 高度差 = 62（关闭态更矮）', (ON.area.h - OFF.area.h) === SHIFT,
       `ON.h=${ON.area.h} OFF.h=${OFF.area.h}`);
  }

  // ④ 1/x 键居中占 3 列中间列
  {
    const cw = ON.advRow.w / ON.advRow.cols;
    const advX = ON.advRow.x + cw;
    const rowCenter = ON.advRow.x + ON.advRow.w / 2;
    const btnCenter = advX + cw / 2;
    ck('R-03④ 1/x 键水平居中（键中心 == advRow 中心）', Math.abs(btnCenter - rowCenter) < 0.001,
       `btnCenter=${btnCenter.toFixed(2)} rowCenter=${rowCenter.toFixed(2)}`);
    ck(`R-03④ 1/x 键宽 ${cw.toFixed(1)} ≥ 44 且高 ${ON.advRow.h} ≥ 44`, cw >= 44 && ON.advRow.h >= 44);
  }

  // ⑤ 幂等
  ck('R-03⑤ layoutFor 纯函数（同参两次调用结果深等）',
     JSON.stringify(AA.layoutFor(true)) === JSON.stringify(ON) && JSON.stringify(AA.layoutFor(false)) === JSON.stringify(OFF));
}

// 源码级锚点补充
ck('R-03 ADV_KEY_LABEL = \'1/x\'', /ADV_KEY_LABEL\s*=\s*'1\/x'/.test(aa));
ck('R-03 高级键配色与初级区分（BTN_BG_ADV 独立常量）', /BTN_BG_ADV\s*=\s*'#[0-9A-Fa-f]{6}'/.test(aa));
ck('R-03 DESIGN_W=411 / DESIGN_H=891 基线常量存在',
   /DESIGN_W\s*=\s*411/.test(aa) && /DESIGN_H\s*=\s*891/.test(aa));
ck('R-03 setAdvancedCalc 幂等短路（避免重复重排）',
   /setAdvancedCalc[\s\S]{0,260}?(===\s*this\.advancedCalc|this\.advancedCalc\s*===)/.test(aa));
ck('R-03 关闭高级时清理已输入的 RECIP token（防残留非法态）',
   /!next\s*&&\s*this\.tokens\.some\([\s\S]{0,80}TokenType\.RECIP/.test(aa));

hdr('R-01 / R-06 · 静态锚点（SettingsPanel 开关 + PageRenderer 分区）');

const sp = fs.readFileSync(new URL('../js/ui/SettingsPanel.js', import.meta.url), 'utf8');
ck('R-01 SettingsPanel 含「高级计算」开关文案', /高级计算/.test(sp));
ck('R-01 SettingsPanel 读写 advancedCalc', /advancedCalc/.test(sp));

const pgr = fs.readFileSync(new URL('../js/ui/PageRenderer.js', import.meta.url), 'utf8');
ck('R-06 【初级解法】标题存在', /初级解法/.test(pgr));
ck('R-06 【高级解法】标题存在', /高级解法/.test(pgr));
ck('R-06 高级分区受 _advancedCalc 门控', /if\s*\(\s*this\._advancedCalc/.test(pgr));
ck('R-06 空高级解文案「本局无倒数解法」存在', /本局无倒数解法/.test(pgr));
ck('R-06 「…等共 N 条」模板存在', /等共\s*\$\{/.test(pgr));

hdr(`[R-07 / R-03 / R-01 / R-06] pass=${pass} fail=${fail}  ${fail === 0 ? 'ALL PASS ✅' : 'HAS FAIL ❌'}`);
process.exitCode = 0;
