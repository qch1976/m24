// tester-bug4-answermodal-geometry.mjs
// INPUT-04 bugfix 独立验收 · Bug 4（Major）：AnswerModal 布局收窄 + 字号提升
// 依据：87 方案 §4 A+ 方案；task-42 硬约束 4 条
// 静态几何校验（无真机时的授权路径）
//
// 断言项：
//   H1. PANEL x=35, y=140, w=341, h=611  → 在 411×891 内、左右对称各 35 DP
//   H2. LIST_CONTAINER x=45, y=240, w=321, h=440  → 在 PANEL 内、左右缩进 10 DP
//   H3. CLOSE_BTN x=130, y=691, w=151, h=50  → 在 PANEL 内、水平居中
//   H4. ITEM_FONT_SIZE = 16 (旧 14)
//
//   R-05 4 条硬约束（弹窗遮罩层 vs 牌桌）：因弹窗为 modal overlay，不占牌桌布局空间 → 全部保持
//
//   容纳性验证：新内容宽 = 321 - 16*2 = 289 DP，16px 字体单字符约 ~10 DP → 单行容纳 ~28 字符
//               典型算式 "(6-(7-5))×(6+6) = 24" 21 字符 → 通过

import fs from 'fs';

const src = fs.readFileSync('./js/ui/AnswerModal.js', 'utf8');
let PASS = 0, FAIL = 0;
function check(name, cond, detail = '') {
  console.log(`  ${cond ? '✓' : '✗'} ${name}` + (detail ? ` — ${detail}` : ''));
  cond ? PASS++ : FAIL++;
}

console.log('=== Bug4 AnswerModal.js 静态几何 + 字号 验证 ===\n');

// ---- 从源码解析常量 ----
function grep1(re, label) {
  const m = src.match(re);
  if (!m) throw new Error(`未找到 ${label}: ${re}`);
  return m;
}

const panelMatch = grep1(/const\s+PANEL\s*=\s*\{\s*x\s*:\s*(\d+)\s*,\s*y\s*:\s*(\d+)\s*,\s*w\s*:\s*(\d+)\s*,\s*h\s*:\s*(\d+)\s*\}/, 'PANEL');
const PANEL = { x: +panelMatch[1], y: +panelMatch[2], w: +panelMatch[3], h: +panelMatch[4] };
console.log('  parsed PANEL =', PANEL);

const listMatch = grep1(/const\s+LIST_CONTAINER\s*=\s*\{\s*x\s*:\s*(\d+)\s*,\s*y\s*:\s*(\d+)\s*,\s*w\s*:\s*(\d+)\s*,\s*h\s*:\s*(\d+)\s*\}/, 'LIST_CONTAINER');
const LIST = { x: +listMatch[1], y: +listMatch[2], w: +listMatch[3], h: +listMatch[4] };
console.log('  parsed LIST =', LIST);

const closeMatch = grep1(/const\s+CLOSE_BTN\s*=\s*\{\s*x\s*:\s*(\d+)\s*,\s*y\s*:\s*(\d+)\s*,\s*w\s*:\s*(\d+)\s*,\s*h\s*:\s*(\d+)\s*\}/, 'CLOSE_BTN');
const CLOSE = { x: +closeMatch[1], y: +closeMatch[2], w: +closeMatch[3], h: +closeMatch[4] };
console.log('  parsed CLOSE_BTN =', CLOSE);

const fontMatch = grep1(/const\s+ITEM_FONT_SIZE\s*=\s*(\d+)/, 'ITEM_FONT_SIZE');
const ITEM_FONT_SIZE = +fontMatch[1];
console.log('  parsed ITEM_FONT_SIZE =', ITEM_FONT_SIZE);

const padLrMatch = grep1(/const\s+LIST_PAD_LR\s*=\s*(\d+)/, 'LIST_PAD_LR');
const LIST_PAD_LR = +padLrMatch[1];

const itemHeightMatch = grep1(/const\s+ITEM_HEIGHT\s*=\s*(\d+)/, 'ITEM_HEIGHT');
const ITEM_HEIGHT = +itemHeightMatch[1];

console.log('\n--- H1 PANEL 几何 (期望 A+：35/140/341/611) ---');
check('H1.1 PANEL.x = 35', PANEL.x === 35);
check('H1.2 PANEL.y = 140', PANEL.y === 140);
check('H1.3 PANEL.w = 341', PANEL.w === 341);
check('H1.4 PANEL.h = 611', PANEL.h === 611);
// 屏内
check('H1.5 PANEL 右边 x+w=376 ≤ 411 屏宽', PANEL.x + PANEL.w <= 411, `${PANEL.x + PANEL.w}`);
check('H1.6 PANEL 底 y+h=751 ≤ 891 屏高', PANEL.y + PANEL.h <= 891, `${PANEL.y + PANEL.h}`);
// 对称
check('H1.7 PANEL 左右边距对称：left=35, right=411-376=35',
      PANEL.x === (411 - (PANEL.x + PANEL.w)), `left=${PANEL.x} right=${411 - (PANEL.x + PANEL.w)}`);

console.log('\n--- H2 LIST_CONTAINER 几何 (期望：45/240/321/440) ---');
check('H2.1 LIST.x = 45', LIST.x === 45);
check('H2.2 LIST.y = 240', LIST.y === 240);
check('H2.3 LIST.w = 321', LIST.w === 321);
check('H2.4 LIST.h = 440', LIST.h === 440);
// PANEL 内
check('H2.5 LIST 在 PANEL 内 (x)', LIST.x >= PANEL.x && LIST.x + LIST.w <= PANEL.x + PANEL.w);
check('H2.6 LIST 在 PANEL 内 (y)', LIST.y >= PANEL.y && LIST.y + LIST.h <= PANEL.y + PANEL.h);
// 左右缩进 ≥ 8
const leftGap = LIST.x - PANEL.x, rightGap = (PANEL.x + PANEL.w) - (LIST.x + LIST.w);
check(`H2.7 LIST 左缩进 ${leftGap} ≥ 8`, leftGap >= 8);
check(`H2.7 LIST 右缩进 ${rightGap} ≥ 8`, rightGap >= 8);

console.log('\n--- H3 CLOSE_BTN 几何 (期望：130/691/151/50) ---');
check('H3.1 CLOSE.x = 130', CLOSE.x === 130);
check('H3.2 CLOSE.y = 691', CLOSE.y === 691);
check('H3.3 CLOSE.w = 151', CLOSE.w === 151);
check('H3.4 CLOSE.h = 50', CLOSE.h === 50);
// 在 PANEL 内
check('H3.5 CLOSE_BTN 在 PANEL 内 (x)',
      CLOSE.x >= PANEL.x && CLOSE.x + CLOSE.w <= PANEL.x + PANEL.w);
check('H3.6 CLOSE_BTN 在 PANEL 内 (y)',
      CLOSE.y >= PANEL.y && CLOSE.y + CLOSE.h <= PANEL.y + PANEL.h);
// 水平居中
const panelCenterX = PANEL.x + PANEL.w / 2;
const closeCenterX = CLOSE.x + CLOSE.w / 2;
check(`H3.7 CLOSE_BTN 水平居中于 PANEL (差 ${Math.abs(panelCenterX - closeCenterX)} DP)`,
      Math.abs(panelCenterX - closeCenterX) <= 1);
// 热区 ≥ 44
check('H3.8 CLOSE_BTN 热区 ≥ 44×44', CLOSE.w >= 44 && CLOSE.h >= 44);

console.log('\n--- H4 ITEM_FONT_SIZE 提升 (期望 14 → 16) ---');
check('H4.1 ITEM_FONT_SIZE = 16', ITEM_FONT_SIZE === 16);
check('H4.2 字号相对旧 14px 提升 (16/14 = 14.3%)',
      ITEM_FONT_SIZE >= 15 && ITEM_FONT_SIZE <= 18, `实际 ${ITEM_FONT_SIZE}`);

// ---- R-05 4 条硬约束 ----
// 弹窗为 modal overlay，不占牌桌布局空间；牌桌位置在 INPUT-04 里定义（另文件），此处只判 modal 屏内合规
console.log('\n--- R-05 4 条硬约束 (modal overlay 不占牌桌布局空间) ---');
console.log('  (INPUT-04 R-05 是"牌桌 vs 按钮 vs 卡牌 vs 答题区"的间距约束；');
console.log('   AnswerModal 作为 modal overlay 与牌桌解耦，不参与其中；');
console.log('   仅验证 modal 自身 4 边在屏内 + 关闭按钮命中区不越界。)');
check('R-05.a modal panel 全 4 边在 411×891 内',
      PANEL.x >= 0 && PANEL.y >= 0 && PANEL.x + PANEL.w <= 411 && PANEL.y + PANEL.h <= 891);
check('R-05.b LIST_CONTAINER 全 4 边在 PANEL 内',
      LIST.x >= PANEL.x && LIST.y >= PANEL.y &&
      LIST.x + LIST.w <= PANEL.x + PANEL.w &&
      LIST.y + LIST.h <= PANEL.y + PANEL.h);
check('R-05.c 关闭按钮 44×44 最小热区', CLOSE.w >= 44 && CLOSE.h >= 44);
check('R-05.d LIST 与 CLOSE 不重叠',
      LIST.y + LIST.h <= CLOSE.y);

// ---- 容纳性验证 ----
console.log('\n--- 容纳性：新宽 + 新字号能否放下典型算式 ---');
const contentW = LIST.w - 2 * LIST_PAD_LR;
console.log('  内容可视宽 =', contentW, 'DP');
// 16px sans-serif 数字/运算符 单字符约 8~10 DP，取保守 10 DP
const perChar = 10;
const typical = '(6-(7-5))×(6+6) = 24';
const typicalW = typical.length * perChar;
check(`典型算式 "${typical}" ${typical.length}字 × ${perChar} DP ≈ ${typicalW} DP ≤ ${contentW}`,
      typicalW <= contentW);
// 最长可能：13 位数字 × 3 运算符 + 括号约 15 字符
const longest = '((13-1)×(8÷4))×1'; // 假想 16 字符
console.log('  较长算式估算：', longest.length, '字符 ≈', longest.length * perChar, 'DP');
check(`长算式(约 ${longest.length} 字) 可容纳`, longest.length * perChar <= contentW);

// ---- 前后对比表 ----
console.log('\n=== BEFORE vs AFTER 对比表 ===');
console.log('┌───────────────────┬─────────┬─────────┐');
console.log('│ 项                │ BEFORE  │ AFTER   │');
console.log('├───────────────────┼─────────┼─────────┤');
console.log(`│ PANEL.x           │ 15      │ ${PANEL.x}      │`);
console.log(`│ PANEL.w           │ 381     │ ${PANEL.w}     │`);
console.log(`│ 屏左右留白        │ 15/15   │ ${PANEL.x}/${411 - (PANEL.x + PANEL.w)}   │`);
console.log(`│ LIST_CONTAINER.x  │ 25      │ ${LIST.x}      │`);
console.log(`│ LIST_CONTAINER.w  │ 361     │ ${LIST.w}     │`);
console.log(`│ 内容可视宽        │ 329     │ ${contentW}     │`);
console.log(`│ ITEM_FONT_SIZE    │ 14      │ ${ITEM_FONT_SIZE}      │`);
console.log(`│ CLOSE_BTN         │ 130/691 │ ${CLOSE.x}/${CLOSE.y} │ (未变) │`);
console.log('└───────────────────┴─────────┴─────────┘');
console.log('  字号提升幅度：+14.3% (14 → 16)');
console.log('  面板收窄幅度：-10.5% (381 → 341)，左右边距 15 → 35 DP');

console.log('\n=========================================');
console.log(`BUG4 STATIC: pass=${PASS} fail=${FAIL}`);
console.log(`OVERALL: ${FAIL === 0 ? 'PASS (代码几何验证) ✅  真机截图部分：由项目主 GUI 复核' : 'FAIL ❌'}`);
console.log('=========================================');
if (FAIL > 0) process.exit(1);
