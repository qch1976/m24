#!/usr/bin/env node
// R-05 4 条硬约束数值验算（基于 276b824 布局参数，read-only）
// 硬约束原文（INPUT-04.md）：
//   H1 按钮↔卡牌 ≥8 DP
//   H2 卡牌两行 ≥16 DP
//   H3 卡牌底↔答题区 ≥16 DP
//   H4 总高 ≤891 DP
//
// 布局参数（自 js/ui/PageRenderer.js + js/ui/AnswerArea.js 提取；design 坐标，扫描到底再叠加 +30 DP offsetY 前后对比）：

const DESIGN_H = 891;

// PageRenderer.LAYOUT_ANCHOR（design 坐标）
const dealBtn = { x: 155, y: 60, w: 100, h: 50 }; // -> bottom = 110
const hintBtn = { x: 35,  y: 60, w: 100, h: 50 }; // 与 dealBtn 同一水平层
const answerBtn = { x: 275, y: 60, w: 100, h: 50 };
const cardsTop = { y: 118, h: 170 }; // -> bottom = 288
const cardsBot = { y: 304, h: 170 }; // -> bottom = 474

// AnswerArea.ANSWER_ANCHOR（design 坐标，已包含"顶边下移 30 DP"改动）
const answerArea = { x: 15, y: 520, w: 381, h: 350 }; // -> bottom = 870
const hintLine = { x: 205, y: 820 };

// PageRenderer._computeLayout：offsetY = (uiH - DESIGN_H*scale)/2 + 30*scale
// 当 uiH = 891 时 scale=1，offsetY = 0 + 30 = 30。所以 dealBtn/cards 全体渲染时 y+=30。
// 关键点：AnswerArea.render 自己算 offsetY = (uiH - DESIGN_H*scale)/2，不加 30。
// -> PageRenderer 侧组件（dealBtn/hintBtn/answerBtn/cards）实际 y = design_y + 30
// -> AnswerArea 侧组件 实际 y = design_y（AnswerArea 内 offsetY 计算未 +30）

// ============ 计算：以"设备实际坐标"为准 ============
const PAGE_OFFSET_Y = 30; // PageRenderer 侧全体下移
const ANSWER_OFFSET_Y = 0; // AnswerArea 自己不加

const R = {
  dealBtn:   { top: dealBtn.y + PAGE_OFFSET_Y, bot: dealBtn.y + dealBtn.h + PAGE_OFFSET_Y },
  hintBtn:   { top: hintBtn.y + PAGE_OFFSET_Y, bot: hintBtn.y + hintBtn.h + PAGE_OFFSET_Y },
  answerBtn: { top: answerBtn.y + PAGE_OFFSET_Y, bot: answerBtn.y + answerBtn.h + PAGE_OFFSET_Y },
  cardsTop:  { top: cardsTop.y + PAGE_OFFSET_Y, bot: cardsTop.y + cardsTop.h + PAGE_OFFSET_Y },
  cardsBot:  { top: cardsBot.y + PAGE_OFFSET_Y, bot: cardsBot.y + cardsBot.h + PAGE_OFFSET_Y },
  answerArea:{ top: answerArea.y + ANSWER_OFFSET_Y, bot: answerArea.y + answerArea.h + ANSWER_OFFSET_Y },
  hintLine:  { y: hintLine.y + ANSWER_OFFSET_Y },
};

console.log('=== 设备实际坐标（design + offsetY 修正后） ===');
for (const k of Object.keys(R)) {
  console.log(`${k.padEnd(12)} `, R[k]);
}

// ============ 硬约束验证 ============
const results = [];

// H1: 按钮（dealBtn 底部 = hintBtn 底部 = answerBtn 底部）↔ 卡牌（顶行顶部）间距
const gap_btn_card = R.cardsTop.top - R.dealBtn.bot;
results.push({
  name: 'H1 按钮↔卡牌 ≥ 8 DP',
  detail: `cardsTop.top(${R.cardsTop.top}) - dealBtn.bot(${R.dealBtn.bot}) = ${gap_btn_card}`,
  value: gap_btn_card,
  threshold: 8,
  pass: gap_btn_card >= 8,
});

// H2: 卡牌两行间距
const gap_card_rows = R.cardsBot.top - R.cardsTop.bot;
results.push({
  name: 'H2 卡牌两行 ≥ 16 DP',
  detail: `cardsBot.top(${R.cardsBot.top}) - cardsTop.bot(${R.cardsTop.bot}) = ${gap_card_rows}`,
  value: gap_card_rows,
  threshold: 16,
  pass: gap_card_rows >= 16,
});

// H3: 卡牌底 ↔ 答题区顶
const gap_card_answer = R.answerArea.top - R.cardsBot.bot;
results.push({
  name: 'H3 卡牌底↔答题区 ≥ 16 DP',
  detail: `answerArea.top(${R.answerArea.top}) - cardsBot.bot(${R.cardsBot.bot}) = ${gap_card_answer}`,
  value: gap_card_answer,
  threshold: 16,
  pass: gap_card_answer >= 16,
});

// H4: 总高 = 最底端坐标 ≤ 891
const bottomEdge = Math.max(R.answerArea.bot, R.hintLine.y);
results.push({
  name: 'H4 总高 ≤ 891 DP',
  detail: `max(answerArea.bot=${R.answerArea.bot}, hintLine.y=${R.hintLine.y}) = ${bottomEdge}`,
  value: bottomEdge,
  threshold: 891,
  pass: bottomEdge <= 891,
});

console.log('\n=== R-05 硬约束验证 ===');
let allPass = true;
for (const r of results) {
  const flag = r.pass ? '✅ PASS' : '❌ FAIL';
  console.log(`${flag}  ${r.name}`);
  console.log(`         ${r.detail}   [阈值 ${r.threshold}, 实际 ${r.value}]`);
  if (!r.pass) allPass = false;
}
console.log(`\n总结论：${allPass ? '4/4 全部满足 ✅' : '存在违反 ❌'}`);

// —— task-75：把已算出的 allPass 接到退出码上（此前只打印、永不判红）——
console.log(`\n[99-verify-r05] pass=${allPass ? 1 : 0} fail=${allPass ? 0 : 1}`);
process.exit(allPass ? 0 : 1);

// ============ 附：假设"两个 commit 真的各再下移 30 DP"的假设场景 =====
console.log('\n=== 补充：假设 4041669 + 4d41e8c 真的额外下移 30 DP（总 60 DP）会怎样？===');
console.log('  假设：PageRenderer offsetY = +60 * scale，AnswerArea 全体 y 再 +30');
console.log('  cardsBot.bot 会变成 474 + 60 = 534');
console.log('  answerArea.top 会变成 520 + 30 = 550');
console.log('  answerArea.bot 会变成 870 + 30 = 900 > 891 ❌ 违反 H4');
console.log('  hintLine.y 会变成 820 + 30 = 850 (仍 < 891)');
console.log('  所以：若真的叠加 60 DP，H4 会 fail；此为 4041669/4d41e8c 只有 whitespace、未真正叠加位移的另一个佐证。');
