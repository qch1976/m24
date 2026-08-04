#!/usr/bin/env node
// tools/verify/verify-js-mjs-sync.mjs — .js / .mjs 副本同步校验门禁（task-71）
//
// ═══════════════════════════════════════════════════════════════════════════
// 【为什么需要这道闸】
//   js/ 下每个 .js 产品文件都有一份 .mjs 副本，供 Node 直跑 selftest/tester 用。
//   两份各自演进 ⇒ 门禁跑的是 .mjs，线上跑的是 .js，**测过的和发出去的不是同一套逻辑**。
//   GameCore 已经漂了 20 字节（5 处 import 后缀），没这道闸早晚真分叉。
//
// 【口径分层的由来 —— 别改回一刀切】
//   最初规格是「12 对全部规约后缀后逐字节相同」。实测发现会**上线即 fail=3**，
//   且红在早已验收的存量文件上（Card / DealGenerator / Deck）。
//   原因：这 3 份 .mjs 是**有意精简的子集**（体量仅 .js 的 35~50%），
//   为 Node 自测裁剪，不是漂移。
//   ⇒ 用错误口径把存量判红，会直接摧毁门禁可信度，比不加门禁更糟。
//   ⇒ 故分 A/B 两层。**A 层是默认，B 层是需列名的例外。**
//
//   A 层（严格·逐字节）：规约 import 后缀 + 剥注释空行后必须与 .js 逐字符相同。共 9 对。
//   B 层（行为等价）：仅限下方白名单 3 对，**不在本脚本里判**，
//     改由 `tools/verify/verify-mjs-behavior.mjs` 用**行为等价断言**把关。
//
// 【为何 B 层不能用任何文本口径——这条是踩完坑才定的，别改回去】
//   这 3 对 .mjs 不是「.js 删了几行」，而是**按同一语义重写**过：
//     · 语句形态：`if (x) {\n throw ...\n}`  ⇔  `if (x) throw ...`
//     · 局部变量重命名：Deck.js `lastCards`  ⇔  Deck.mjs `last`
//     · 箭头参数括号：`(c) => c.value`       ⇔  `c => c.value`
//     · 报错文案整段重写：中文「连续 N 次未抽到可解组合」⇔ 英文 `N attempts failed`
//   ⇒ 逐行 diff / 压平子串 / 子序列包含 —— 要么必然误报（前两者），
//     要么鉴别力低到「几乎放行任何东西」（子序列）。后者更危险：
//     **能刷绿的门禁比没有门禁更危险，因为它让人相信有防护。**（团队规则 21）
//
// 【⚠️ 冻结区红线】
//   js/core/Card.js 与 js/utils/Random.js 属冻结区 6 文件（相对 5b80efa 字节零变化）。
//   若本门禁判 Card 对不齐，**唯一合法解是改 Card.mjs，绝对不许动 Card.js**。
//   后人勿反向修。冻结区清单见 AGENTS.md。
//
// 取退出码：见 §退出码。不经管道；必须经管道时用 ${PIPESTATUS[0]}。
// ═══════════════════════════════════════════════════════════════════════════

import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

// ── B 层白名单：语义重写子集副本 ─────────────────────────────────────────
// 这 3 对**不做文本比对**（见文件头说明），改由 verify-mjs-behavior.mjs 用行为
// 等价断言把关。每项写明理由与出处。新增 .mjs **默认进 A 层**，不许随手加进来。
const SUBSET_WHITELIST = {
  'js/core/Card': '语义重写子集，文本口径不适用（.js 三行 if-block ⇔ .mjs 单行 if）。出处：Card.mjs 26 行 vs Card.js 59 行。行为由 verify-mjs-behavior.mjs 把关。',
  'js/core/DealGenerator': '语义重写子集，文本口径不适用（同类 if-block 折叠）。出处：25 行 vs 49 行。行为由 verify-mjs-behavior.mjs 把关。',
  'js/core/Deck': '语义重写子集，文本口径不适用（lastCards→last 重命名、报错文案中→英整段重写）。出处：.mjs 头部自述 "minimal for INPUT-05"，32 行 vs 74 行。行为由 verify-mjs-behavior.mjs 把关。',
};

let pass = 0, fail = 0;
const bad = [];
const promotable = [];

const ck = (name, cond, detail = '') => {
  if (cond) { pass++; console.log(`  ok  ${name}${detail ? '   ' + detail : ''}`); }
  else { fail++; bad.push(name); console.log(`  XX  ${name}   ${detail}`); }
};

/** 规约：把 .mjs 里 import 路径的 .mjs 后缀去掉，使其可与 .js 逐字符比对。 */
const normalize = (src) => src.replace(/(from\s+'\.\.?\/[^']*)\.mjs'/g, "$1'");

// ⚠️ 尺子说明（这两条都是踩过坑后定的，别简化回去）：
//
// 1) A 层为何要剥「首行文件名注释」：
//    副本首行惯例是 `// m24 - Settings.mjs (ESM copy...)` vs `// m24 - Settings.js`，
//    这是**副本身份标识**，不是逻辑差异。实测若不剥，Settings 与 Random 会被判红，
//    而两者规约后的唯一差异就是这行注释 ⇒ 属误报。
//    故 A 层比对前先剥掉所有注释行与空行，只比**有效代码**。
//
// 2) B 层为何不能用任何文本口径（逐行集合 / 压平子串 / 子序列）：
//    实测 Card.js 把 RANK_VALUE 写成每行一项（`A: 1,`），Card.mjs 折叠成一行
//    （`A: 1, 2: 2, 3: 3, ...`）—— **同一份数据、不同排版**，逐行比对却报「多出 5 行」。
//    这与 TOOLS.md 第 3 例（剥 import 后 diff 行数判漂移，5 个全误报）同族：
//    **行级 diff 是排版的尺子，不是语义的尺子。**
//    改成压平空白后“子串包含”仍在 Deck 上为 False（重命名 + 文案重写）；
//    而“子序列包含”虽三对皆通过，却几乎放行任何东西 ⇒ 属为刷绿而造的尺子，已弃用。
//    ⇒ B 层改为**行为等价断言**，见 tools/verify/verify-mjs-behavior.mjs。

/** 剥注释与空行，仅留有效代码行。 */
const codeLines = (src) => src
  .split(/\r?\n/)
  .map((l) => l.trim())
  .filter((l) => l && !l.startsWith('//') && !l.startsWith('*') && !l.startsWith('/*'));

/** A 层口径：规约后缀 + 剥注释/空行 + 统一行尾，再逐字符比对。 */
const canonical = (src) => codeLines(normalize(src)).join('\n');

// ── 发现全部 .js/.mjs 配对 ────────────────────────────────────────────────
const PAIRS = [
  'js/core/Calculator', 'js/core/Card', 'js/core/DealGenerator', 'js/core/Deck',
  'js/core/GameCore', 'js/core/NumberGenerator', 'js/core/RecipParser',
  'js/core/RecipSolver', 'js/core/Settings', 'js/core/Solver', 'js/core/Timer',
  'js/utils/Random',
];

console.log('='.repeat(70));
console.log('[js-mjs-sync] .js / .mjs 副本同步校验（A 层逐字节 / B 层子集方向性）');
console.log('='.repeat(70));

// 先确认配对完整性：每个 .mjs 都得有 .js，反之亦然
console.log('\n── 阶段0：配对完整性 ──');
for (const p of PAIRS) {
  const js = join(ROOT, `${p}.js`);
  const mjs = join(ROOT, `${p}.mjs`);
  ck(`${p} 双份都存在`, existsSync(js) && existsSync(mjs),
    `js=${existsSync(js)} mjs=${existsSync(mjs)}`);
}

console.log('\n── 阶段1：A 层（严格·规约后逐字节相同）──');
for (const p of PAIRS) {
  if (SUBSET_WHITELIST[p]) continue;
  const js = join(ROOT, `${p}.js`);
  const mjs = join(ROOT, `${p}.mjs`);
  if (!existsSync(js) || !existsSync(mjs)) continue;
  const a = canonical(readFileSync(mjs, 'utf8'));
  const b = canonical(readFileSync(js, 'utf8'));
  if (a === b) {
    ck(`${p} 规约后逐字节相同`, true);
  } else {
    // 给出可定位的首处差异，而不是只说「不一致」
    const la = a.split('\n'), lb = b.split('\n');
    let i = 0;
    while (i < Math.max(la.length, lb.length) && la[i] === lb[i]) i++;
    ck(`${p} 规约后逐字节相同`, false,
      `首处差异 L${i + 1}: .mjs="${(la[i] ?? '<EOF>').slice(0, 60)}" vs .js="${(lb[i] ?? '<EOF>').slice(0, 60)}"`);
  }
}

console.log('\n── 阶段2：B 层（白名单·文本口径不适用，改由行为断言把关）──');
for (const [p, reason] of Object.entries(SUBSET_WHITELIST)) {
  const js = join(ROOT, `${p}.js`);
  const mjs = join(ROOT, `${p}.mjs`);
  if (!existsSync(js) || !existsSync(mjs)) { ck(`${p} 白名单项存在`, false, '文件缺失'); continue; }
  // 这里**只登记**，不做文本判定 —— 文本口径在这 3 对上必然误报（见文件头）。
  // 真正的把关在 tools/verify/verify-mjs-behavior.mjs（行为等价断言 + 变异自验）。
  ck(`${p} 已登记为语义重写子集（行为由 verify-mjs-behavior 把关）`, true, reason.slice(0, 50) + '…');

  // 白名单自净：若某天已完全一致，提示升入 A 层，防白名单越来越松
  if (canonical(readFileSync(mjs, 'utf8')) === canonical(readFileSync(js, 'utf8'))) promotable.push(p);
}

console.log('\n' + '='.repeat(70));
console.log(`[js-mjs-sync] pass=${pass} fail=${fail}`);
if (promotable.length) {
  console.log(`⬆️  以下白名单项现已完全一致，建议移出白名单升入 A 层: ${promotable.join(', ')}`);
}
if (fail > 0) {
  console.log(`🔴 FAILED: ${bad.join(' | ')}`);
  console.log('⚠️  若红在 Card / Random：它们的 .js 属冻结区，唯一合法解是改 .mjs，不许改 .js。');
} else {
  console.log('✅ 12 对全覆盖（A 层 9 对逐字节 / B 层 3 对已登记，行为由 verify-mjs-behavior 把关）');
  console.log('   ⇒ B 层必须配套运行：node --import ./tester/render-smoke/esm-hooks.mjs tools/verify/verify-mjs-behavior.mjs');
}
console.log('='.repeat(70));

// §退出码：0=全通过，1=有 fail。调用方勿经管道取码。
process.exit(fail === 0 ? 0 : 1);
