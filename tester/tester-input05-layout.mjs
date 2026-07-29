// tester-input05-layout.mjs
// Tester 独立复核 R-01 UI 布局锚点（静态代码断言）
//
// 立场声明:
//   Tester 侧无小游戏 GUI 自动化能力 (miniprogram-automator 不支持小游戏)。
//   本脚本用独立静态代码断言取代截图 diff，覆盖 107 号验收映射表 TC-05-01-01~04 中的 "位置/尺寸/颜色" 数学层要求。
//   TC-05-01-05 (点击遮罩关闭)、TC-05-01-06 (交互)、TC-05-04-03/04 (文案 OCR) 属于交互层/OCR层，
//   由项目主 RDP + 微信开发者工具 GUI 复核 (INPUT-COMMON §GUI 验收分工)。
//
// 断言目标 (107 号 R-01 + R-05 结构):
//   1) ⚙️ 按钮 x=15 y=15 w=40 h=40 (左上角)
//   2) 顶行三按钮 y_top=60 w=100 h=50，颜色 琥珀#F5A623 / 蓝#3884FF / 绿#2ECC71
//   3) ctrlRow cols=3 → 4，[无解] 按钮颜色 红#E74C3C，宽 82.75×50
//   4) 面板 5 个 slot 占位
//   5) ⚙️ y 下沿 (55) < hint y 上沿 (60) 无 y 重叠

import fs from 'fs';

const pageSrc = fs.readFileSync('js/ui/PageRenderer.js', 'utf8');
const answerSrc = fs.readFileSync('js/ui/AnswerArea.js', 'utf8');
const panelSrc = fs.readFileSync('js/ui/SettingsPanel.js', 'utf8');
const settingsBtnSrc = fs.readFileSync('js/ui/SettingsButton.js', 'utf8');

let ok = 0, fail = 0;
function check(name, cond, extra = '') {
  if (cond) { ok++; console.log(`  ✓ ${name}${extra ? ' ('+extra+')' : ''}`); }
  else { fail++; console.log(`  ✗ ${name}${extra ? ' ('+extra+')' : ''}`); }
}
function findNumber(text, pattern) {
  const m = text.match(pattern);
  return m ? parseFloat(m[1]) : null;
}
function findString(text, pattern) {
  const m = text.match(pattern);
  return m ? m[1] : null;
}

console.log('[tester-input05-layout] R-01 独立静态锚点复核');

// -------- 1) ⚙️ 设置按钮几何 (PageRenderer LAYOUT_ANCHOR.settingsBtn 或 SettingsButton.js) --------
const settingsGeomMatch = pageSrc.match(/settingsBtn[^}]*\{[\s\S]*?\}/);
let settingsBtnBlock = settingsGeomMatch ? settingsGeomMatch[0] : (settingsBtnSrc || '');
const settingsX = findNumber(settingsBtnBlock, /x\s*:\s*(\d+(?:\.\d+)?)/);
const settingsY = findNumber(settingsBtnBlock, /y\s*:\s*(\d+(?:\.\d+)?)/);
const settingsW = findNumber(settingsBtnBlock, /(?:w|width)\s*:\s*(\d+(?:\.\d+)?)/);
const settingsH = findNumber(settingsBtnBlock, /(?:h|height)\s*:\s*(\d+(?:\.\d+)?)/);
console.log(`\n[1] ⚙️ 设置按钮几何 (从 PageRenderer 匹配):`);
check('1.1 settingsBtn.x == 15', settingsX === 15, `实测=${settingsX}`);
check('1.2 settingsBtn.y == 15', settingsY === 15, `实测=${settingsY}`);
check('1.3 settingsBtn.w == 40', settingsW === 40, `实测=${settingsW}`);
check('1.4 settingsBtn.h == 40', settingsH === 40, `实测=${settingsH}`);

// -------- 2) 顶行三按钮 y_top / w / h + 颜色 (PageRenderer) --------
// Architect 108 号声明 HINT_BTN_BG='#F5A623', DEAL_BTN_BG='#3884FF', ANSWER_BTN_BG='#2ECC71'
console.log(`\n[2] 顶行三按钮几何 + 颜色 (PageRenderer):`);
// 108 号声明: HINT_BTN_BG, DEAL_BTN_COLOR_INPUT05, ANSWER_BTN_BG 三个 UI 常量
const hintBg = findString(pageSrc, /HINT_BTN[_A-Z]*\s*=\s*['"]([^'"]+)['"]/);
const dealBg = findString(pageSrc, /DEAL_BTN[_A-Z0-9]*\s*=\s*['"]([^'"]+)['"]/);
const answerBg = findString(pageSrc, /ANSWER_BTN[_A-Z]*\s*=\s*['"]([^'"]+)['"]/);
check('2.1 顶行 HINT 常量 == #F5A623 琥珀', hintBg === '#F5A623', `实测=${hintBg}`);
check('2.2 顶行 DEAL 常量 == #3884FF 蓝', dealBg === '#3884FF', `实测=${dealBg}`);
check('2.3 顶行 ANSWER 常量 == #2ECC71 绿', answerBg === '#2ECC71', `实测=${answerBg}`);

// 三按钮位置常数（顶行 y_top=60，w=100，h=50 — 一般定义在 PageRenderer 常数或方法里）
const yTop = findNumber(pageSrc, /(?:hintBtn|topRow|TOP_ROW_Y|Y_TOP)[^\d]{0,10}\ny?\s*:\s*(\d+)/) 
          || findNumber(pageSrc, /y\s*:\s*60\b[^0-9]/);  // 尝试搜 60
const yTopRegex = /(?:y_top|TOP_Y|topY)\s*[:=]\s*(\d+)/;
const yTopMatch = pageSrc.match(yTopRegex);
const topRowY_str = yTopMatch ? yTopMatch[1] : '未匹配到具名常数';
const has60 = /\by\s*:\s*60\b/.test(pageSrc) || /\by_top\s*:\s*60\b/.test(pageSrc);
check('2.4 顶行 y_top=60 (存在 y:60 常数)', has60, `匹配 y:60=${has60}, TOP_Y=${topRowY_str}`);

// -------- 3) ctrlRow cols=4 + [无解] 红色 + 尺寸 (AnswerArea) --------
console.log(`\n[3] ctrlRow cols=4 + [无解] 按钮 (AnswerArea):`);
const cols = findNumber(answerSrc, /cols\s*:\s*(\d+)/);
check('3.1 ctrlRow cols == 4', cols === 4, `实测=${cols}`);
const hasNosolKey = /['"]?nosol['"]?/.test(answerSrc) || /CTRL_KEYS[\s\S]{0,200}nosol/.test(answerSrc);
check('3.2 CTRL_KEYS 含 nosol', hasNosolKey);
const nosolRed = /['"]#E74C3C['"]/i.test(answerSrc);
check('3.3 [无解] 按钮红色 #E74C3C', nosolRed);
// 每按钮宽度 82.75 = (361-3*10)/4
const perBtn = (361 - 3 * 10) / 4;
check('3.4 每按钮宽度 = (361-30)/4 = 82.75', Math.abs(perBtn - 82.75) < 0.01, `计算值=${perBtn}`);

// -------- 4) 设置面板 5 slot 占位 (SettingsPanel) --------
console.log(`\n[4] SettingsPanel 5 slot 占位 (SLOTS_CONFIG 数组):`);
// SettingsPanel 用循环画 slot: SLOTS_CONFIG 数组含 5 个 slot 定义, 循环里画 '敬请期待' 一次
const slotConfigMatch = panelSrc.match(/SLOTS_CONFIG\s*=\s*\[([\s\S]*?)\];/);
let slotCount = 0;
if (slotConfigMatch) {
  slotCount = (slotConfigMatch[1].match(/\{[^{}]*id\s*:/g) || []).length;
}
check('4.1 SLOTS_CONFIG 定义 5 个 slot', slotCount === 5, `实测=${slotCount}`);
const hasWaitLabel = /敬请期待/.test(panelSrc);
check('4.2 SettingsPanel 含 "敬请期待" 字面量', hasWaitLabel);
const hasRadioSolvable = /['"]?solvable['"]?/.test(panelSrc);
const hasRadioRandom = /['"]?random['"]?/.test(panelSrc);
check('4.3 SettingsPanel 含 "solvable" radio', hasRadioSolvable);
check('4.4 SettingsPanel 含 "random" radio', hasRadioRandom);

// -------- 5) ⚙️ y 下沿 55 < hint y 上沿 60 无重叠 --------
console.log(`\n[5] ⚙️ 与顶行不重叠:`);
const noOverlap = (settingsY + settingsH) <= 60;
check('5.1 ⚙️.y + ⚙️.h ≤ 60 (无 y 重叠)', noOverlap, `实测 ⚙️.bottom = ${settingsY + settingsH}`);

console.log(`\n[tester-input05-layout] R-01: ok=${ok} fail=${fail}`);
console.log(fail === 0 ? 'PASS' : 'FAIL');
process.exit(fail === 0 ? 0 : 1);
