// tester-close-r05-layout.mjs
// Tester 独立采样：INPUT-04 收尾 - R-05 4 条布局硬约束数值验算
// 依据：INPUT-04.md §R-05，PageRenderer.js/AnswerArea.js 实测常量
// 说明：本脚本从 grep 提取的静态锚点（LAYOUT_ANCHOR）+ _computeLayout 里
//      offsetY 的算法（+30 DP scale）独立计算 411×891 DP 竖屏下的实际 top/bot，
//      Tester 独立验算 H1~H4，禁止拷 Architect 99 号数值。

const DESIGN_W = 411;
const DESIGN_H = 891;

// —— PageRenderer.js 静态锚点（从代码文本 grep 得到）——
const LAYOUT_ANCHOR = {
  dealBtn:   { x: 155, y: 60,  w: 100, h: 50 },
  hintBtn:   { x: 35,  y: 60,  w: 100, h: 50 },
  answerBtn: { x: 275, y: 60,  w: 100, h: 50 },
  cards: [
    { x: 55,  y: 118, w: 120, h: 170 },
    { x: 236, y: 118, w: 120, h: 170 },
    { x: 55,  y: 304, w: 120, h: 170 },
    { x: 236, y: 304, w: 120, h: 170 },
  ],
};

// —— AnswerArea.js 静态锚点（ANSWER_ANCHOR）——
const ANSWER_ANCHOR = {
  area:     { x: 15,  y: 520, w: 381, h: 350 },
  formula:  { x: 25,  y: 532, w: 361, h: 56  },
  numRow:   { x: 25,  y: 600, w: 361, h: 60  },
  opRow:    { x: 25,  y: 670, w: 361, h: 60  },
  ctrlRow:  { x: 25,  y: 740, w: 361, h: 60  },
  hintLine: { x: 205, y: 820 },
};

// —— 411×891 竖屏 devicePixelRatio=1 无缩放场景 —— 
const uiW = 411;
const uiH = 891;
const scale = Math.min(uiW / DESIGN_W, uiH / DESIGN_H); // = 1
const PAGE_OFFSET_Y = (uiH - DESIGN_H * scale) / 2 + 30 * scale;   // PageRenderer._computeLayout 里 +30 DP
const ANSWER_OFFSET_Y = (uiH - DESIGN_H * scale) / 2;              // AnswerArea._computeLayout 无 +30

function pageRect(r) {
  return { x: r.x * scale,
           y: PAGE_OFFSET_Y + r.y * scale,
           w: r.w * scale,
           h: r.h * scale };
}
function answerRect(r) {
  return { x: r.x * scale,
           y: ANSWER_OFFSET_Y + r.y * scale,
           w: r.w * scale,
           h: r.h * scale };
}

const results = [];
function assertHard(name, cond, expected, actual, detail = '') {
  const ok = cond;
  results.push({ name, ok, expected, actual, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name} | expected ${expected} | actual ${actual}${detail ? ' | ' + detail : ''}`);
}

// —— 位置计算 —— 
const dealBtn = pageRect(LAYOUT_ANCHOR.dealBtn);
const hintBtn = pageRect(LAYOUT_ANCHOR.hintBtn);
const answerBtn = pageRect(LAYOUT_ANCHOR.answerBtn);
const cardsTop = pageRect(LAYOUT_ANCHOR.cards[0]);
const cardsBot = pageRect(LAYOUT_ANCHOR.cards[2]);
const answerArea = answerRect(ANSWER_ANCHOR.area);
const hintLine = answerRect(ANSWER_ANCHOR.hintLine);

console.log('--- 计算基线 ---');
console.log(`scale=${scale}  PAGE_OFFSET_Y=${PAGE_OFFSET_Y}  ANSWER_OFFSET_Y=${ANSWER_OFFSET_Y}`);
console.log(`dealBtn:   top=${dealBtn.y}  bot=${dealBtn.y + dealBtn.h}`);
console.log(`hintBtn:   top=${hintBtn.y}  bot=${hintBtn.y + hintBtn.h}`);
console.log(`answerBtn: top=${answerBtn.y}  bot=${answerBtn.y + answerBtn.h}`);
console.log(`cardsTop:  top=${cardsTop.y}  bot=${cardsTop.y + cardsTop.h}`);
console.log(`cardsBot:  top=${cardsBot.y}  bot=${cardsBot.y + cardsBot.h}`);
console.log(`answerArea:top=${answerArea.y}  bot=${answerArea.y + answerArea.h}`);
console.log(`hintLine:  y=${hintLine.y}`);

console.log('\n--- R-05 4 条硬约束 ---');

// H1: 按钮↔卡牌 ≥ 8 DP （三个按钮的 bot vs cardsTop.top 取最保守）
const btnBots = [dealBtn.y + dealBtn.h, hintBtn.y + hintBtn.h, answerBtn.y + answerBtn.h];
const maxBtnBot = Math.max(...btnBots);
const h1 = cardsTop.y - maxBtnBot;
assertHard('H1 按钮↔卡牌 ≥ 8 DP', h1 >= 8, '≥8', h1, `cardsTop.top(${cardsTop.y}) - maxBtnBot(${maxBtnBot})`);

// H2: 卡牌两行 ≥ 16 DP
const h2 = cardsBot.y - (cardsTop.y + cardsTop.h);
assertHard('H2 卡牌两行 ≥ 16 DP', h2 >= 16, '≥16', h2, `cardsBot.top(${cardsBot.y}) - cardsTop.bot(${cardsTop.y + cardsTop.h})`);

// H3: 卡牌底↔答题区 ≥ 16 DP
const h3 = answerArea.y - (cardsBot.y + cardsBot.h);
assertHard('H3 卡牌底↔答题区 ≥ 16 DP', h3 >= 16, '≥16', h3, `answerArea.top(${answerArea.y}) - cardsBot.bot(${cardsBot.y + cardsBot.h})`);

// H4: 总高 ≤ 891 DP
const bottomMax = Math.max(answerArea.y + answerArea.h, hintLine.y, cardsBot.y + cardsBot.h);
assertHard('H4 总高 ≤ 891 DP', bottomMax <= 891, '≤891', bottomMax, `max(answerArea.bot=${answerArea.y + answerArea.h}, hintLine.y=${hintLine.y}, cardsBot.bot=${cardsBot.y + cardsBot.h})`);

// H5 附加：按钮同水平层不重叠 hint x∈[35,135] deal x∈[155,255] answer x∈[275,375]
const gap1 = LAYOUT_ANCHOR.dealBtn.x - (LAYOUT_ANCHOR.hintBtn.x + LAYOUT_ANCHOR.hintBtn.w);
const gap2 = LAYOUT_ANCHOR.answerBtn.x - (LAYOUT_ANCHOR.dealBtn.x + LAYOUT_ANCHOR.dealBtn.w);
console.log(`\n--- 附加：按钮水平间距 ---`);
console.log(`hint↔deal gap=${gap1}  deal↔answer gap=${gap2}`);
assertHard('H5a hint↔deal 间距 ≥ 0', gap1 >= 0, '≥0', gap1);
assertHard('H5b deal↔answer 间距 ≥ 0', gap2 >= 0, '≥0', gap2);

const passCount = results.filter(r => r.ok).length;
const failCount = results.length - passCount;
console.log(`\n============ SUMMARY ============`);
console.log(`total=${results.length}  pass=${passCount}  fail=${failCount}`);
console.log(`OVERALL: ${failCount === 0 ? 'PASS' : 'FAIL'}`);
process.exit(failCount === 0 ? 0 : 1);
