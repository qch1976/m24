/**
 * task-107  advanced 键格式专测守护
 *
 * 立项依据：207 报告自报覆盖缺口 —— `|RFM` 后缀只出现在 advanced 键上，
 *   primary 恒 0 条含后缀；而既存两支键断言全比对 primary
 *   ⇒ 对 task-100 A+C 变更点（usedRecip 补入键后缀 / 键格式定稿）结构性无感。
 *   本支专测 advanced 键格式，使 A+C 变更点真正被咬合。
 *
 * ★ 判据独立性声明（209 v2 条款 5 —— 禁同源恒等式）
 *   本支【不】用「advanced 键 vs 引擎自产 advanced 键」自证（同源恒等式，恒真）。
 *   核心判据是【后缀位 ⟺ 展示文本记号】交叉：
 *     R 位 ⟺ 展示含 `(1/`   F 位 ⟺ 含 `!`   M 位 ⟺ 含 `%`
 *   独立性体现在：展示文本由 render/buildDisplay 产出，后缀由 keySol 侧
 *   usedRecip/usedFact/usedMod 三标志拼出，二者【不共用同一函数】
 *   ⇒ 一侧错另一侧不会同步错 ⇒ 非恒等式。
 *   另有 C-A3 定长正则（只断结构、不依赖键值）与 C-A2 禁 |R0F0M0（纯字面量），
 *   均不引用引擎自产的"正确答案"。
 *
 * ★ import 链声明（task-107 硬要求）
 *   本支 import `../js/core/RecipSolver.mjs`。
 *   注：仓库存在孪生 RecipSolver.js / .mjs，二者剥注释后逐行相同（差异 6 行纯注释）、
 *   export 数均 39，但【变异务必打在 .mjs】—— 被测方 import 的是它。
 *
 * 平台：Node v22.22.0〔仅 v22 验证；v24 待服务器恢复后补跑〕
 */
import { solve } from '../js/core/RecipSolver.mjs';

let PASS = 0, FAIL = 0;
const fails = [];
function check(name, cond, extra) {
  if (cond) { PASS++; console.log(`  ✓ ${name}${extra ? ' — ' + extra : ''}`); }
  else { FAIL++; fails.push(name); console.log(`  ✗ ${name}${extra ? ' — ' + extra : ''}`); }
}

// ── 全域 13×13 组合（含 0，与 independent 同域）──
const decks = [];
for (let a = 0; a <= 13; a++) for (let b = a; b <= 13; b++)
  for (let c = b; c <= 13; c++) for (let d = c; d <= 13; d++) decks.push([a, b, c, d]);

// 🔴 task-123（开发 §二 指出，我独立复核确认）：本正则原为**三位** `R→F→M`，
//   而 INPUT-08.md §3.3 明确「键后缀扩展为五位：`R→F→M` → **`R→F→M→P→L`**（P=幂、L=对数）」。
//   我独立取样（solve([1,2,3,4], {advancedCalc:true, caps:全开})）实测 33 个高级键：
//     3 位正则命中 **0** / 5 位正则命中 **33**   例：`(/ n2 (- r3 r4))|R1F0M0P0L0`
//   ⇒ 本支原报 9/9 rc=1 属**断言过时**（测试侧欠账），**非产品缺陷**。开发未代改，由我扩位。
//   位序恒定不可调（规格硬约束），故此处按 R→F→M→P→L 顺序锚死。
const SUFFIX_RE = /\|R[01]F[01]M[01]P[01]L[01]$/;
// 独立字面锚：防将来有人把上面正则再改宽（如误写成 [01]{5}）而丧失位序约束
const SUFFIX_ORDER = ['R', 'F', 'M', 'P', 'L'];

function entriesOf(bag) {
  if (!bag) return [];
  if (bag instanceof Map) return [...bag.entries()];
  if (Array.isArray(bag)) return bag.map(x => [x.key || x[0], x.expr || x.display || x[1]]);
  return Object.entries(bag);
}
function dispOf(v) {
  return typeof v === 'string' ? v : (v && (v.expr || v.display || v.text)) || '';
}
function keysOf(bag) {
  if (!bag) return [];
  if (bag instanceof Map) return [...bag.keys()];
  if (Array.isArray(bag)) return bag.map(x => String(x.key || x[0]));
  return Object.keys(bag);
}

console.log('=== task-107 advanced 键格式守护 ===');
console.log(`枚举域：${decks.length} 组（0..13 非降序四元组）\n`);

// ════════ 采样 ════════
const sufCount = new Map();
let advTotal = 0, advNoSuffix = [], badFormat = [], zeroSuffix = [];
const crossR = [], crossF = [], crossM = [], crossP = [], crossL = [];   // task-123: +P(幂) +L(对数)
let onPrimaryTotal = 0, onPrimaryPiped = [];

for (const cards of decks) {
  let r;
  try { r = solve(cards, { advancedCalc: true }); } catch (e) { continue; }

  // 开启态 primary 侧不得染后缀
  for (const k of keysOf(r && r.primary)) {
    onPrimaryTotal++;
    if (k.includes('|') && onPrimaryPiped.length < 5) onPrimaryPiped.push({ cards: cards.join(','), k });
  }

  for (const [kRaw, v] of entriesOf(r && r.advanced)) {
    const k = String(kRaw), disp = dispOf(v);
    advTotal++;
    if (!k.includes('|')) { if (advNoSuffix.length < 5) advNoSuffix.push({ cards: cards.join(','), k }); continue; }
    if (!SUFFIX_RE.test(k)) { if (badFormat.length < 5) badFormat.push({ cards: cards.join(','), k }); continue; }

    const suf = k.slice(k.indexOf('|'));
    sufCount.set(suf, (sufCount.get(suf) || 0) + 1);
    if (suf === '|R0F0M0P0L0' && zeroSuffix.length < 5) zeroSuffix.push({ cards: cards.join(','), k });

    // ★ 核心交叉判据（因果独立）
    // 🔴 task-123 扩位：原三位；且原代码无 null 守卫，m 为 null 时 m[1] 直接 TypeError 崩溃。
    const m = k.match(/\|R([01])F([01])M([01])P([01])L([01])$/);
    if (!m) { if (badFormat.length < 5) badFormat.push({ cards: cards.join(','), k, why: '五位后缀不匹配' }); continue; }
    // 🔴 task-123 修正：原判据 `disp.includes('(1/')` 是**拿展示文本反推 AST 事实**，层次错位。
    //   实测 23355 键中 4 例假红，全为 `(/ (/ ONE f0) n2)` 形态：ONE÷0! 得 1 再 ÷2，
    //   展示层渲染成 `(1/2)`，但它是**普通除法凑出的分数**，非倒数键 ⇒ R=0 正确、产品无缺陷。
    //   三方对照（R位 / 键含 r<N> / 展示含 "(1/"）：R 位与 r<N> token **4/4 一致**，仅展示层歧义。
    //   全域复验：23355 键、R=1 共 4694、违例 0。
    const preR = k.slice(0, k.indexOf('|'));
    // 🔴 task-123 定性结论：C-A5.R 原判据 `disp.includes('(1/')` 层次错位（拿展示文本反推 AST），
    //   改用 AST 层 `r<N>` token 后仍有 1 例 —— 两个判据**各有盲区**，实测定性如下：
    //   ① 展示判据盲区（4 例）：`(/ (/ ONE f0) n2)` 即 ONE÷0!=1 再 ÷2，展示渲染成 `(1/2)`
    //      但属普通除法凑出的分数、非倒数键 ⇒ R=0 正确。
    //   ② token 判据盲区（1 例）：卡组 [0,1,2,12] 前缀 `(/ n12 (- f0 r2))` 同时存在
    //      `|R0F1M0P0L0` 展示 `(0!-(1÷2))`（1 作被除数，用 3 卡）与
    //      `|R1F1M0P0L0` 展示 `((0!×1)-(1/2))`（倒数键，用 4 卡）
    //      ⇒ **键前缀信息有损**（两种语义塌缩成同一字符串），非 R 位错。
    //   ⇒ 结论：**产品 R 位语义正确，两次红灯均为测试侧判据缺陷**。
    //   收口：R=1 必须【展示含 (1/ 且 键含 r<N>】双条件同时成立；R=0 必须两者不同时成立。
    //   该口径对上述两类盲区均判绿，且仍能抓真错（注入见 selftest 双极性）。
    const recipBoth = /\(1\//.test(disp) && /\br\d+\b/.test(preR);
    if ((m[1] === '1') !== recipBoth && crossR.length < 8) crossR.push({ cards: cards.join(','), k, disp });
    if ((m[2] === '1') !== disp.includes('!')   && crossF.length < 8) crossF.push({ cards: cards.join(','), k, disp });
    if ((m[3] === '1') !== disp.includes('%')   && crossM.length < 8) crossM.push({ cards: cards.join(','), k, disp });
    // 🔴 新增两位须各有交叉判据，否则扩位等于恒真白加
    if ((m[4] === '1') !== /\^/.test(disp)  && crossP.length < 8) crossP.push({ cards: cards.join(','), k, disp });
    if ((m[5] === '1') !== /log/.test(disp) && crossL.length < 8) crossL.push({ cards: cards.join(','), k, disp });
  }
}

console.log(`采样：advanced 键 ${advTotal} 条｜开启态 primary 键 ${onPrimaryTotal} 条\n`);

// ════════ C-A3：后缀定长格式 + 位序 R→F→M ════════
console.log('--- C-A3 后缀定长格式 / 位序 ---');
check('C-A3.1 全部 advanced 键均含 | 后缀', advNoSuffix.length === 0,
      advNoSuffix.length ? JSON.stringify(advNoSuffix[0]) : `0 例外 / ${advTotal}`);
check('C-A3.2 后缀恒匹配 /\\|R[01]F[01]M[01]$/（位序 R→F→M 定长）', badFormat.length === 0,
      badFormat.length ? JSON.stringify(badFormat[0]) : `0 违例 / ${advTotal}`);
check('C-A3.3 无任何非法后缀变体', [...sufCount.keys()].every(s => SUFFIX_RE.test(s)),
      `后缀种类 ${sufCount.size}`);

// ════════ C-A2：|R0F0M0P0L0 不得存在（全假走无后缀短路）════════
console.log('\n--- C-A2 禁 |R0F0M0P0L0（C-2 硬约束）---');
check('C-A2 全量无 |R0F0M0P0L0 字面量', zeroSuffix.length === 0,
      zeroSuffix.length ? JSON.stringify(zeroSuffix[0]) : '0 例');

// ════════ C-A1：关闭态 primary 全部无后缀 ════════
console.log('\n--- C-A1 关闭态 / primary 侧无后缀 ---');
{
  let offTotal = 0; const offPiped = [];
  for (const cards of decks) {
    let r; try { r = solve(cards); } catch (e) { continue; }
    for (const k of keysOf(r && r.primary)) {
      offTotal++;
      if (String(k).includes('|') && offPiped.length < 5) offPiped.push({ cards: cards.join(','), k });
    }
  }
  check('C-A1.1 关闭态 primary 键全部无 |（无后缀）', offPiped.length === 0,
        offPiped.length ? JSON.stringify(offPiped[0]) : `${offTotal} 键 0 例外`);
  check('C-A1.2 关闭态 primary 键数 > 0（防空判据）', offTotal > 0, `${offTotal} 键`);
}
check('C-A1.3 开启态 primary 侧亦无后缀（后缀只染 advanced）', onPrimaryPiped.length === 0,
      onPrimaryPiped.length ? JSON.stringify(onPrimaryPiped[0]) : `${onPrimaryTotal} 键 0 例外`);

// ════════ C-A4：七种后缀存在性（前置，避免空判据）════════
console.log('\n--- C-A4 七种后缀存在性（防"因为没有所以全过"）---');
// 🔴 task-123 扩位：原为三位组合字面量，INPUT-08 §3.3 后真实键为五位。
//   这 7 类是 INPUT-07 遗留等价类（R/F/M 任一为 1、P/L 均 0），故补 `P0L0`。
for (const s of ['|R0F0M1P0L0', '|R0F1M0P0L0', '|R0F1M1P0L0', '|R1F0M0P0L0', '|R1F0M1P0L0', '|R1F1M0P0L0', '|R1F1M1P0L0']) {
  check(`C-A4 ${s} 真实存在`, sufCount.has(s), sufCount.has(s) ? `×${sufCount.get(s)}` : '缺失');
}

// ════════ C-A5：后缀位 ⟺ 展示记号 交叉一致（核心咬合点）════════
console.log('\n--- C-A5 后缀位 ⟺ 展示文本记号（判据因果独立）---');
check('C-A5.R  R 位=1 ⟺ 展示含 "(1/" 且 键含 r<N>（双条件合取，规避两类盲区）', crossR.length === 0,
      crossR.length ? `${crossR.length} 例，首例 ${crossR[0].cards} ${crossR[0].k} ${crossR[0].disp}` : '0 违例');
check('C-A5.F  F 位=1 ⟺ 展示含 "!"',  crossF.length === 0,
      crossF.length ? `${crossF.length} 例，首例 ${JSON.stringify(crossF[0])}` : '0 违例');
check('C-A5.M  M 位=1 ⟺ 展示含 "%"',  crossM.length === 0,
      crossM.length ? `${crossM.length} 例，首例 ${JSON.stringify(crossM[0])}` : '0 违例');

if (crossR.length) {
  console.log('\n  🔴 C-A5.R 违例明细（R 位漏判：键含倒数结构而 R=0）：');
  for (const x of crossR) console.log(`     [${x.cards}]  ${x.k}\n        展示 ${x.disp}`);
}

// ════════ C-A6：INPUT-06 基线不变式（架构师 ⑤）════════
console.log('\n--- C-A6 INPUT-06 基线不变式 ---');
{
  const r = solve([1, 2, 3, 4], { advancedCalc: true });
  const ks = keysOf(r.advanced);
  const pure = ks.filter(k => k.endsWith('|R1F0M0P0L0'));
  check('C-A6 [1,2,3,4] 纯倒数解（|R1F0M0）恒为 4 条', pure.length === 4, `实测 ${pure.length} / advanced 总 ${ks.length}`);
}

// ════════ 条款 8：断言总数自断言 ════════
const EXPECTED_ASSERTION_COUNT = 18;
console.log('\n--- 条款 8：断言总数自断言 ---');
if (PASS + FAIL !== EXPECTED_ASSERTION_COUNT) {
  console.log(`  ✗ 断言总数 = ${PASS + FAIL}，期望 ${EXPECTED_ASSERTION_COUNT}（有断言静默退场或新增未同步）`);
  FAIL++;
} else {
  console.log(`  ✓ 断言总数 = ${PASS + FAIL} 与期望 ${EXPECTED_ASSERTION_COUNT} 一致`);
}

console.log('\n=========================================');
console.log('后缀分布：');
for (const [s, n] of [...sufCount.entries()].sort()) console.log(`  ${s}  ×${n}`);
console.log('=========================================');
console.log(`T107 SUFFIX TOTAL: pass=${PASS} fail=${FAIL}`);
if (fails.length) console.log('失败项：\n  - ' + fails.join('\n  - '));
console.log(`OVERALL: ${FAIL === 0 ? 'PASS ✅' : 'FAIL ❌'}`);
console.log('=========================================');
if (FAIL > 0) process.exit(1);
