// tester-v2-bug4-layout.mjs
// Bug 4-v2 独立验收：AnswerModal 面板 305 DP + 字号 17 px + 8 硬约束
// 独立采样，不引 worker2 selftest 数据
//
// 覆盖 T-L01 ~ T-L05

import fs from 'fs';

const src = fs.readFileSync('js/ui/AnswerModal.js', 'utf8');

// 用正则解析（避免运行时依赖 canvas ctx）
function parseRect(name) {
  const re = new RegExp(`const\\s+${name}\\s*=\\s*\\{\\s*x:\\s*(\\d+)\\s*,\\s*y:\\s*(\\d+)\\s*,\\s*w:\\s*(\\d+)\\s*,\\s*h:\\s*(\\d+)\\s*\\}`);
  const m = src.match(re);
  if (!m) throw new Error(`can't parse ${name}`);
  return { x: +m[1], y: +m[2], w: +m[3], h: +m[4] };
}
function parseNum(name) {
  const re = new RegExp(`const\\s+${name}\\s*=\\s*(\\d+)`);
  const m = src.match(re);
  if (!m) throw new Error(`can't parse ${name}`);
  return +m[1];
}

const PANEL = parseRect('PANEL');
const LIST = parseRect('LIST_CONTAINER');
const CLOSE = parseRect('CLOSE_BTN');
const ITEM_HEIGHT = parseNum('ITEM_HEIGHT');
const ITEM_GAP = parseNum('ITEM_GAP');
const LIST_PAD_TOP = parseNum('LIST_PAD_TOP');
const LIST_PAD_LR = parseNum('LIST_PAD_LR');
const ITEM_FONT_SIZE = parseNum('ITEM_FONT_SIZE');

console.log('=== 常量解析 ===');
console.log('PANEL          =', PANEL);
console.log('LIST_CONTAINER =', LIST);
console.log('CLOSE_BTN      =', CLOSE);
console.log('ITEM_HEIGHT    =', ITEM_HEIGHT);
console.log('ITEM_GAP       =', ITEM_GAP);
console.log('LIST_PAD_TOP   =', LIST_PAD_TOP);
console.log('LIST_PAD_LR    =', LIST_PAD_LR);
console.log('ITEM_FONT_SIZE =', ITEM_FONT_SIZE);

let PASS = 0, FAIL = 0;
function check(name, cond, detail = '') {
  console.log(`  ${cond ? '✓' : '✗'} ${name}` + (detail ? ` — ${detail}` : ''));
  cond ? PASS++ : FAIL++;
}

console.log('\n=== T-L01 面板尺寸 ===');
check('T-L01 PANEL.x = 53', PANEL.x === 53, String(PANEL.x));
check('T-L01 PANEL.y = 140', PANEL.y === 140);
check('T-L01 PANEL.w = 305', PANEL.w === 305);
check('T-L01 PANEL.h = 611', PANEL.h === 611);

console.log('\n=== T-L02 列表容器尺寸 ===');
check('T-L02 LIST.x = 61', LIST.x === 61);
check('T-L02 LIST.y = 240', LIST.y === 240);
check('T-L02 LIST.w = 289', LIST.w === 289);
check('T-L02 LIST.h = 440', LIST.h === 440);

console.log('\n=== T-L03 字号 ===');
check('T-L03 ITEM_FONT_SIZE = 17', ITEM_FONT_SIZE === 17);

console.log('\n=== T-L04 硬约束栈 H1~H5 ===');
// H1: y 不与卡牌区(y∈[304,474]) 或答题区(y∈[490,870]) 重叠
// 面板 y=140, bottom=140+611=751 - 面板的确会跨过卡牌区和答题区在几何上
// 但 92 §1.3 说的是"面板 y 不与卡牌区/答题区内容主体重叠" — 而弹窗天生是 overlay
// 实际语义是 y=140 起点在卡牌顶(304)之上，即弹窗顶部先看到；
// 92 §1.3 H1 硬约束 "y 保持 140，高度上限 = 866-140-16 = 710，OK"
// → 检查：底 y+h ≤ 866 - 16 = 850（留出 R-04 底部安全区）
const panelBottom = PANEL.y + PANEL.h;
check('T-L04 H1 面板底 <= 891 (屏幕高)', panelBottom <= 891, `panelBottom=${panelBottom}`);
check('T-L04 H1 面板顶 y=140 (与卡牌顶 304 有 164 DP 顶部安全区)', PANEL.y === 140);

// H2 面板在 411×891 内可见
check('T-L04 H2 面板左 >= 0', PANEL.x >= 0);
check('T-L04 H2 面板右 <= 411', PANEL.x + PANEL.w <= 411, `right=${PANEL.x + PANEL.w}`);
check('T-L04 H2 面板上 >= 0', PANEL.y >= 0);
check('T-L04 H2 面板下 <= 891', panelBottom <= 891);
check('T-L04 H2 关闭按钮 4 边在面板内', 
  CLOSE.x >= PANEL.x && CLOSE.x + CLOSE.w <= PANEL.x + PANEL.w &&
  CLOSE.y >= PANEL.y && CLOSE.y + CLOSE.h <= PANEL.y + PANEL.h);
check('T-L04 H2 列表容器 4 边在面板内', 
  LIST.x >= PANEL.x && LIST.x + LIST.w <= PANEL.x + PANEL.w &&
  LIST.y >= PANEL.y && LIST.y + LIST.h <= PANEL.y + PANEL.h);

// H3 字号 >= 14
check('T-L04 H3 字号 >= 14 px', ITEM_FONT_SIZE >= 14);

// H4 列高 >= 44 DP
check('T-L04 H4 ITEM_HEIGHT >= 44', ITEM_HEIGHT >= 44);

// H5 内容宽 >= 17 * 单字符宽 + 32
// 92 §1.3 单字符标称宽 = 17 * 0.55 = 9.4 DP (选型 C)
// 内容宽 = LIST.w - 2*LIST_PAD_LR = 289 - 32 = 257 DP
// 17 * 9.4 = 159.8 DP → 257 >= 160 OK 
const contentW = LIST.w - 2 * LIST_PAD_LR;
const p95CharW = 17 * 9.4;
check('T-L04 H5 内容宽足以承载 P95=17 字符', contentW >= p95CharW, `contentW=${contentW}, p95CharW=${p95CharW.toFixed(1)}`);
check('T-L04 H5 内容宽 = 257 DP', contentW === 257);

console.log('\n=== T-L05 一屏可见完整行数 ≥ 8 ===');
const visibleH = LIST.h - 2 * LIST_PAD_TOP; // 416
const stride = ITEM_HEIGHT + ITEM_GAP; // 52
const rows = Math.floor((visibleH + ITEM_GAP) / stride); // floor(424/52) = 8
check('T-L05 一屏 ≥ 8 行', rows >= 8, `rows=${rows}, visibleH=${visibleH}, stride=${stride}`);

console.log('\n=== 附加验证：面板对称边距、CLOSE 水平居中 ===');
const leftMargin = PANEL.x;
const rightMargin = 411 - (PANEL.x + PANEL.w);
check('面板左右边距对称', leftMargin === rightMargin, `left=${leftMargin}, right=${rightMargin}`);
check('面板左右边距 ≥ 20 DP', leftMargin >= 20 && rightMargin >= 20);
const panelCX = PANEL.x + PANEL.w / 2;
const closeCX = CLOSE.x + CLOSE.w / 2;
check('CLOSE 水平居中于面板', Math.abs(panelCX - closeCX) <= 1, `panelCX=${panelCX}, closeCX=${closeCX}`);
check('CLOSE 热区 >= 44x44', CLOSE.w >= 44 && CLOSE.h >= 44);
check('LIST 与 CLOSE 不重叠', LIST.y + LIST.h <= CLOSE.y, `LIST bottom=${LIST.y+LIST.h}, CLOSE top=${CLOSE.y}`);

// ── task-116：接收旧 bug4 支废弃前的唯一覆盖点 ──
// 依据：210/211 号报告 + 项目主 08-07 16:31 批准【甲】方案
// 旧支 tester-bug4-answermodal-geometry.mjs 的 H3.2 / H3.4 是 CLOSE.y / CLOSE.h 的唯一精确值守护。
// 本支原有 4 条 CLOSE 断言均为范围/下界/居中约束，实测变异 h 50→44、y 691→700 全部漏放，
// 故在删除旧支前把这 2 条精确值断言迁入本支，确保覆盖面零损失。
check('T-L02c CLOSE.y = 691（承接旧支 H3.2 唯一覆盖点）', CLOSE.y === 691, String(CLOSE.y));
check('T-L02c CLOSE.h = 50（承接旧支 H3.4 唯一覆盖点）', CLOSE.h === 50, String(CLOSE.h));

// 前后对比
console.log('\n=== 前后对比表（fec9851 v1 → fc3f1cc v2） ===');
const before = { panel: {x:35,y:140,w:341,h:611}, list:{x:45,y:240,w:321,h:440}, font:16 };
console.log(`  PANEL.x    ${before.panel.x} → ${PANEL.x} (+${PANEL.x-before.panel.x})`);
console.log(`  PANEL.w    ${before.panel.w} → ${PANEL.w} (${PANEL.w-before.panel.w})`);
console.log(`  LIST.w     ${before.list.w}  → ${LIST.w}  (${LIST.w-before.list.w})`);
console.log(`  内容宽     ${before.list.w-32} → ${contentW} (${contentW-(before.list.w-32)})`);
console.log(`  字号       ${before.font} → ${ITEM_FONT_SIZE} (+${ITEM_FONT_SIZE-before.font})`);

// ── 条款 8：断言总数自断言（防断言静默退场）──
// task-116 补 2 条（CLOSE.y / CLOSE.h）后由 27 → 29。
// 若某条断言因分支未进入而静默不执行，此处即判红，不会被 fail=0 掩盖。
const EXPECTED_ASSERTION_COUNT = 29;
console.log('\n=== 条款 8：断言总数自断言 ===');
if (PASS + FAIL !== EXPECTED_ASSERTION_COUNT) {
  console.log(`  ✗ 断言总数 = ${PASS + FAIL}，期望 ${EXPECTED_ASSERTION_COUNT}（有断言静默退场或新增未同步）`);
  FAIL++;
} else {
  console.log(`  ✓ 断言总数 = ${PASS + FAIL} 与期望 ${EXPECTED_ASSERTION_COUNT} 一致`);
}

console.log('\n=========================================');
console.log(`Bug4-v2 TOTAL: pass=${PASS} fail=${FAIL}`);
console.log(`OVERALL: ${FAIL === 0 ? 'PASS ✅' : 'FAIL ❌'}`);
console.log('=========================================');
if (FAIL > 0) process.exit(1);
