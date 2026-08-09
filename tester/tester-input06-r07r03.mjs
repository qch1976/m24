// tester-input06-r07r03.mjs
// Tester 独立采样：R-07 settings v1→v2 迁移（≥6 用例）+ R-03 键位布局 + R-01/R-06 静态锚点
// 依据 INPUT-06.md §4 R-01 / R-03 / R-06 / R-07；被测 commit 09efb3d
// 禁 solver 自证：本脚本对 storage 用自建 mock，断言由独立期望表驱动
import fs from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

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
  const tries = ['../js/ui/AnswerArea.js'];   // 🔴 task-121：删 _esm 陈旧副本优先（双错互消假绿），只走真身 + --import esm-hooks
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

  // ① 键数口径（🔴 task-121 裁定改写，2026-08-09）
  //   旧断言为 `ON.keyCount===15 && OFF===14 && 差 1`，已被 INPUT-07（+!/%）与
  //   INPUT-08（+a^b/log）两轮扩键推翻：实测可点键位 = 14 + 已开启 adv 项数
  //   （全关 14 / 默认 17 / 全开 19），而 layoutFor(advancedCalc) 不接收 caps
  //   ⇒ keyCount 无法表达该量，且 js/ 内零消费者 ⇒ 属死字段，不作行为判据。
  //   真实键数断言已独立成支：tester/tester-task121-keycount-caps.mjs（21 条，32 组枚举）
  ck('R-03① keyCount(false) = 14（此值恰与实测关态一致）', OFF.keyCount === 14, `实际 ${OFF.keyCount}`);
  // 🔴 task-122 自纠：此处原为 `ck(..., true)` **恒真占位** ⇒ 白送 1 个 pass、零鉴别力（废件）。
  //   改为对「keyCount 无读取型消费者」做**真实源码验证**：扫 js/ 全目录，
  //   排除注释行与对象字面量赋值行（`keyCount:`），剩余即读取点，应为 0。
  //   注入验证：若将来有人真去读 keyCount（如 `if (L.keyCount > 14)`），本条立即判红。
  {
    // 🔴 第二次自纠：原用 `new URL('../js/', import.meta.url)` ⇒ 永远指向【脚本自身所在仓】。
    //   副本注入验证时脚本从 /tmp/kc 跑，但 import.meta.url 仍解析到源仓 ⇒ 扫的是真身，
    //   注入读取点后本条**仍报 0、仍绿** ⇒ 又一个恒绿废件。
    //   改用 process.cwd()：与被测 js/ 同源（各支均以仓根为 cwd 运行），注入即可命中。
    const jsDir = pathToFileURL(join(process.cwd(), 'js') + '/');
    const readers = [];
    const walk = (dir) => {
      for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
        const u = new URL(ent.name + (ent.isDirectory() ? '/' : ''), dir);
        if (ent.isDirectory()) { walk(u); continue; }
        if (!ent.name.endsWith('.js')) continue;
        const lines = fs.readFileSync(u, "utf8").split('\n');
        lines.forEach((ln, i) => {
          if (!ln.includes('keyCount')) return;
          const t = ln.trim();
          if (t.startsWith('//') || t.startsWith('*')) return;   // 注释
          if (/keyCount\s*:/.test(ln)) return;                   // 对象字面量赋值（定义侧）
          readers.push(`${ent.name}:${i + 1}`);
        });
      }
    };
    walk(jsDir);
    ck('R-03① keyCount 在 js/ 内无读取型消费者（真实扫源码，非占位）',
       readers.length === 0, `读取点 ${readers.length}${readers.length ? ': ' + readers.join(',') : ''}`);
  }
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
    // 🔴 task-121 修正：原仅硬编码 1 个 'adv#1x'（3 列时代遗留，只取槽 1），
    //   INPUT-07(+!/%)、INPUT-08(+a^b/log) 两轮扩列后未同步 ⇒ 与 keyCount 静态容量必然不符
    //   （实测 矩形 15 vs keyCount 19）。按开发 9751e73 确立的量纲口径：
    //   keyCount = **静态几何容量** = 各行 cols 之和（不随 caps 变），
    //   故 advRow 须按 cols 全展开，而非只摆 1 个键。
    if (L.advRow) list.push(...expandRow(L.advRow, 'adv'));
    list.push(...expandRow(L.ctrlRow, 'ctrl'));
    list.push({ name: 'backBtn', ...L.backBtn });
    return list;
  };

  for (const [tag, L] of [['ON(19键)', ON], ['OFF(14键)', OFF]]) {
    const btns = buttonsOf(L);
    // 静态容量 = 4 num + 6 op + (5 adv, 开态) + 4 ctrl = 19/14（backBtn 是返回✕，不计入答题键）
    const keyBtns = btns.filter(b => b.name !== 'backBtn');
    // 🔴 task-121 二次修正（条款 5 因果独立）：
    //   9751e73 起 keyCount 改为「各行 cols 之和」推算，而 buttonsOf 也按 cols 展开
    //   ⇒ 两侧同源，注入 cols:5→3 时双双跟变、恒绿 = 自产自证废件（实测已验证恒绿）。
    //   故此处改为与**独立字面量锚**比对：期望值写死，不由 cols 推出。
    const STATIC_CAP = { 'ON(19键)': 19, 'OFF(14键)': 14 };   // 独立锚，改列数须同步改此处
    ck(`R-03② ${tag} 按钮矩形数 = 独立锚定值 ${STATIC_CAP[tag]}`, keyBtns.length === STATIC_CAP[tag],
       `矩形 ${keyBtns.length} vs 锚 ${STATIC_CAP[tag]}`);
    ck(`R-03② ${tag} 且 keyCount 推算值须与独立锚一致（防推算式漂移）`, L.keyCount === STATIC_CAP[tag],
       `keyCount ${L.keyCount} vs 锚 ${STATIC_CAP[tag]}`);

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

  // ④ 1/x 键槽位与可点尺寸
  // 🔴 task-121 改写（2026-08-09，丙类：断言过时，非实现缺陷）
  //   旧断言为「1/x 键水平居中（键中心 == advRow 中心）」。该性质**仅在 3 列时成立**
  //   —— 槽序固定 fact(0) → recip(1) → mod(2) → pow(3) → log(4)，3 列时槽 1 恰为中间列，
  //   居中只是巧合，居中从来不是 INPUT-06/07/08 的需求。
  //   INPUT-08 扩为 5 列后 1/x 仍在槽 1：中心 25+72.2*1.5=133.3，行中心 205.5 ⇒ 必然不居中。
  //   ⚠️ 该红灯此前被 `_esm/AnswerArea.mjs` 陈旧副本（cols 仍 3）掩盖，属双错互消假绿。
  //   ⇒ 改为断言【槽位序号恒定】+【可点尺寸达标】，不再断言居中。
  //   🔴 二次修正：首版改写只重算同一公式（期望值由被测公式自己推出）⇒ 注入
  //      「recip 槽 1→槽 3」后仍全绿 = 恒真废件（违条款 10）。已改为**读真实渲染矩形**。
  {
    const cw = ON.advRow.w / ON.advRow.cols;
    // 从产品真实 render 产出的 _buttonRects 取 recip 键实际 x（非自行推算）
    const _ctx = new Proxy({}, { get: (t, k) => {
      if (k === 'canvas') return { width: 414, height: 896 };
      if (k === 'measureText') return () => ({ width: 10 });
      return typeof k === 'string' ? () => {} : undefined;
    }, set: () => true });
    const _a = new (AA.default)();
    _a.advancedCalc = true; _a.enabled = true; _a.cardValues = [1, 2, 3, 4];
    if (typeof _a.setCaps === 'function') _a.setCaps({ recip: true, fact: true, mod: true, pow: true, log: true });
    _a.areaState = AA.AREA_STATE.OPEN;
    _a.render(_ctx, 414, 896);
    const rects = _a._buttonRects || [];
    const rc = rects.find(b => b.advKey === 'recip');
    ck('R-03④ 存在性前置：真实渲染中存在 1/x 键（否则下方槽位断言平凡真）', !!rc,
       `advKeys=[${rects.filter(b => b.kind === 'adv').map(b => b.advKey).join(',')}]`);
    if (rc) {
      // 🔴 render 内含 scale/偏移（实测 scale≈1.009，非 1）⇒ 不能拿渲染 px 直接比 DP。
      //    改用**同行内的比例关系**（scale 与偏移对同行所有键相同，故可约掉）：
      //    以 fact(槽 0) 为原点，recip 与 fact 的间距应恰为 1 个键宽。
      const fc = rects.find(b => b.advKey === 'fact');
      const mc = rects.find(b => b.advKey === 'mod');
      ck('R-03④ 存在性前置：fact/mod 键亦存在（供比例基准）', !!fc && !!mc, null);
      if (fc && mc) {
        const unit = mc.x - fc.x;                    // 槽 0→槽 2 = 2 个键宽（渲染尺度）
        const gap = rc.x - fc.x;                     // 槽 0→recip
        ck('R-03④ 1/x 键实际渲染于 advRow 槽 1（键序 fact,recip,mod,pow,log 恒定）',
           Math.abs(gap - unit / 2) < 0.5,
           `fact→recip=${gap.toFixed(2)} 应为 fact→mod 的一半=${(unit / 2).toFixed(2)}`);
      }
    }
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
// 🔴 task-121 修正（开发 task-120 ⑤ 提出，实测坐实）：
//   原为 `process.exitCode = 0;` **无条件硬编码**，实测注入 advRow cols:5→3 得
//   `pass=59 fail=2` 而 **REAL_STATUS 仍为 0** ⇒ CI 只看退出码会**吞掉本支全部 FAIL**。
//   改为按失败数返回真码（条款 8：退出码须反映断言结果）。
process.exit(fail ? 1 : 0);
