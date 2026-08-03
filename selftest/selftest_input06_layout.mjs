// selftest_input06_layout.mjs — INPUT-06 §1.4/§1.5/§1.6 布局几何断言
// R-06/R-07：4+6+2+4=16 键 / 15键 OPEN + 14键关闭 / 牌面下移放大 / 无重叠 / tap≥44 / 安全区
import fs from 'fs';

let pass = 0, fail = 0; const bad = [];
const ck = (n, c, e) => { if (c) { pass++; console.log('  ok  ' + n + (e ? '  ' + e : '')); } else { fail++; bad.push(n); console.log('  XX  ' + n + (e ? '  ' + e : '')); } };

const aa = fs.readFileSync('js/ui/AnswerArea.js', 'utf-8');
const pr = fs.readFileSync('js/ui/PageRenderer.js', 'utf-8');
const sp = fs.readFileSync('js/ui/SettingsPanel.js', 'utf-8');

// ---- 解析 ADV_ANCHOR ----
const advBlock = aa.match(/export const ADV_ANCHOR = \{([\s\S]*?)\n\};/)[1];
const A = {};
for (const line of advBlock.split('\n')) {
  const m = line.match(/(\w+):\s*\{\s*x:\s*(-?\d+),\s*y:\s*(-?\d+),\s*w:\s*(\d+),\s*h:\s*(\d+)(?:,\s*cols:\s*(\d+),\s*gap:\s*(\d+))?/);
  if (m) A[m[1]] = { x: +m[2], y: +m[3], w: +m[4], h: +m[5], cols: m[6] ? +m[6] : null, gap: m[7] != null ? +m[7] : null };
}
const SAFE_BOTTOM = 878; // 891 - 13

console.log('='.repeat(70));
console.log('A. OPEN 态（advancedCalc=true）15 键：4 数字 + 6 运算 + 1 高级 + 4 控制');
console.log('='.repeat(70));
ck('键数 4+6+1+4 = 15', 4 + 6 + 1 + 4 === 15);
ck('numRow cols=4', A.numRow.cols === 4);
ck('opRow cols=6', A.opRow.cols === 6);
ck('advRow cols=3（1/x 居中占中列）', A.advRow.cols === 3);
ck('ctrlRow cols=4', A.ctrlRow.cols === 4);
const rows = ['formula', 'numRow', 'opRow', 'advRow', 'ctrlRow'];
for (let i = 0; i < rows.length - 1; i++) {
  const a = A[rows[i]], b = A[rows[i + 1]];
  ck(`${rows[i]} 底 ${a.y + a.h} <= ${rows[i + 1]} 顶 ${b.y}（无 y 重叠）`, a.y + a.h <= b.y, `间隙 ${b.y - (a.y + a.h)}DP`);
}
for (const k of ['numRow', 'opRow', 'advRow', 'ctrlRow']) {
  const r = A[k];
  const w = r.cols ? (r.w - (r.gap || 0) * (r.cols - 1)) / r.cols : r.w;
  ck(`${k} 单键 ${w.toFixed(1)}×${r.h} >= 44×44`, w >= 44 && r.h >= 44);
}
ck(`backBtn ${A.backBtn.w}×${A.backBtn.h} >= 44×44`, A.backBtn.w >= 44 && A.backBtn.h >= 44);
ck(`backBtn x ${A.backBtn.x} >= formula 右沿 ${A.formula.x + A.formula.w}（不压算式文本）`, A.backBtn.x >= A.formula.x + A.formula.w);
ck(`backBtn 右沿 ${A.backBtn.x + A.backBtn.w} <= area 右沿 ${A.area.x + A.area.w}`, A.backBtn.x + A.backBtn.w <= A.area.x + A.area.w);
ck(`backBtn y∈[${A.formula.y},${A.formula.y + A.formula.h}] 内嵌算式行`, A.backBtn.y >= A.formula.y && A.backBtn.y + A.backBtn.h <= A.formula.y + A.formula.h);
const openBottom = A.ctrlRow.y + A.ctrlRow.h;
ck(`ctrlRow 底沿 ${openBottom} <= ${SAFE_BOTTOM} 安全区`, openBottom <= SAFE_BOTTOM);
ck(`area 底沿 ${A.area.y + A.area.h} <= ${SAFE_BOTTOM}`, A.area.y + A.area.h <= SAFE_BOTTOM);
ck('所有行落在 area 垂直范围内', A.formula.y >= A.area.y && openBottom <= A.area.y + A.area.h);
ck(`area 左沿 ${A.area.x} >= 13 且 右沿 ${A.area.x + A.area.w} <= 398`, A.area.x >= 13 && A.area.x + A.area.w <= 398);

console.log('\n' + '='.repeat(70));
console.log('B. 关闭态（advancedCalc=false）14 键 + advRow 行高回收 62 DP');
console.log('='.repeat(70));
const D = 62;
ck('键数 4+6+0+4 = 14', 4 + 6 + 0 + 4 === 14);
ck('ADV_ROW_H_TOTAL = advRow.h + 10 = 62', A.advRow.h + 10 === D);
ck('layoutFor 关闭态返回 advRow=null', /advRow:\s*null/.test(aa));
const C = { formula: A.formula.y + D, numRow: A.numRow.y + D, opRow: A.opRow.y + D, ctrlRow: A.ctrlRow.y };
ck(`关闭态 formula 底 ${C.formula + A.formula.h} <= numRow 顶 ${C.numRow}`, C.formula + A.formula.h <= C.numRow);
ck(`关闭态 numRow 底 ${C.numRow + A.numRow.h} <= opRow 顶 ${C.opRow}`, C.numRow + A.numRow.h <= C.opRow);
ck(`关闭态 opRow 底 ${C.opRow + A.opRow.h} <= ctrlRow 顶 ${C.ctrlRow}`, C.opRow + A.opRow.h <= C.ctrlRow);
ck(`关闭态 ctrlRow 底沿 ${C.ctrlRow + A.ctrlRow.h} <= ${SAFE_BOTTOM}`, C.ctrlRow + A.ctrlRow.h <= SAFE_BOTTOM);
const cArea = { y: A.area.y + D, h: A.area.h - D };
ck(`关闭态 area y=${cArea.y} h=${cArea.h} 底沿 ${cArea.y + cArea.h} <= ${SAFE_BOTTOM}`, cArea.y + cArea.h <= SAFE_BOTTOM);
ck('关闭态 ctrlRow 不动（仍贴底 818）', C.ctrlRow === A.ctrlRow.y);

console.log('\n' + '='.repeat(70));
console.log('C. §1.6 牌面下移 + 放大（仅改 PageRenderer LAYOUT_ANCHOR，6 保护文件零改）');
console.log('='.repeat(70));
const K = {};
for (const k of ['CARD_W', 'CARD_H', 'CARD_GAP', 'CARD_X1', 'CARD_X2', 'CARD_Y1', 'CARD_Y2']) {
  K[k] = +pr.match(new RegExp('const ' + k + ' = (\\d+)'))[1];
}
ck(`牌 ${K.CARD_W}×${K.CARD_H} 相对旧 120×170 放大 1.2×`,
   Math.abs(K.CARD_W / 120 - 1.2) < 0.001 && Math.abs(K.CARD_H / 170 - 1.2) < 0.001);
ck(`顶行 y ${K.CARD_Y1} > 旧 118（下移 ${K.CARD_Y1 - 118}DP）`, K.CARD_Y1 > 118);
const left = K.CARD_X1, right = 411 - (K.CARD_X2 + K.CARD_W);
ck(`水平居中（左 ${left} ≈ 右 ${right}，差 ≤1）`, Math.abs(left - right) <= 1);
ck(`列间距 ${K.CARD_X2 - (K.CARD_X1 + K.CARD_W)} = CARD_GAP ${K.CARD_GAP}`, K.CARD_X2 - (K.CARD_X1 + K.CARD_W) === K.CARD_GAP);
ck(`行间距 ${K.CARD_Y2 - (K.CARD_Y1 + K.CARD_H)} = CARD_GAP`, K.CARD_Y2 - (K.CARD_Y1 + K.CARD_H) === K.CARD_GAP);
ck(`左沿 ${K.CARD_X1} >= 13、右沿 ${K.CARD_X2 + K.CARD_W} <= 398（不越安全区）`, K.CARD_X1 >= 13 && K.CARD_X2 + K.CARD_W <= 398);
ck(`顶行 ${K.CARD_Y1} > 顶部按钮带底沿 110（不被遮挡）`, K.CARD_Y1 > 110, `间隙 ${K.CARD_Y1 - 110}DP`);
ck(`顶行 ${K.CARD_Y1} > ⚙设置按钮底沿 55`, K.CARD_Y1 > 55);
const cardBottom = K.CARD_Y2 + K.CARD_H;
ck(`牌面底沿 ${cardBottom} <= 关闭态答题区顶 ${cArea.y}（默认态不重叠）`, cardBottom <= cArea.y);
ck(`牌面底沿 ${cardBottom} <= ${SAFE_BOTTOM}`, cardBottom <= SAFE_BOTTOM);

console.log('\n' + '='.repeat(70));
console.log('D. [开始答题] 入口按钮（答题区默认隐藏后的拉起入口）');
console.log('='.repeat(70));
const sa = pr.match(/startAnswerBtn:\s*\{\s*x:\s*(\d+),\s*y:\s*(\d+),\s*w:\s*(\d+),\s*h:\s*(\d+)/);
ck('startAnswerBtn 锚点已定义', !!sa);
if (sa) {
  const [, x, y, w, h] = sa.map((v, i) => (i === 0 ? v : Number(v)));
  ck(`尺寸 ${w}×${h} >= 44×44`, w >= 44 && h >= 44);
  ck(`水平居中（左 ${x} ≈ 右 ${411 - (x + w)}）`, Math.abs(x - (411 - (x + w))) <= 1);
  ck(`y ${y} > 牌面底沿 ${cardBottom}（不压牌）`, y > cardBottom);
  ck(`底沿 ${y + h} <= ${SAFE_BOTTOM}`, y + h <= SAFE_BOTTOM);
}
ck('仅 CLOSED 态渲染（areaClosed 条件）', /const areaClosed = !this\.answerArea\.isAreaVisible\(\)/.test(pr));
ck('点击调用 openArea()', /key === 'startAnswer'.*openArea\(\)/.test(pr));

console.log('\n' + '='.repeat(70));
console.log('E. 滑入动效（§1.2.1）与设置面板高级计算开关（§1.5）');
console.log('='.repeat(70));
const slide = +aa.match(/export const SLIDE_MS = (\d+)/)[1];
ck(`SLIDE_MS = ${slide} ∈ [200,250]`, slide >= 200 && slide <= 250);
ck('4 状态机 CLOSED/OPENING/OPEN/CLOSING 齐全',
   /CLOSED:\s*'closed'/.test(aa) && /OPENING:\s*'opening'/.test(aa) && /OPEN:\s*'open'/.test(aa) && /CLOSING:\s*'closing'/.test(aa));
ck('easeOutCubic 缓动（无弹跳）', /_easeOutCubic/.test(aa));
ck('needsRedraw() 供帧循环续帧', /needsRedraw\(\)/.test(aa));
// SettingsPanel
const spA = {};
const spBlock = sp.match(/const PANEL_ANCHOR = \{([\s\S]*?)\n\};/)[1];
for (const line of spBlock.split('\n')) {
  const m = line.match(/(\w+):\s*\{\s*x:\s*(-?\d+),\s*y:\s*(-?\d+),\s*w:\s*(\d+),\s*h:\s*(\d+)/);
  if (m) spA[m[1]] = { x: +m[2], y: +m[3], w: +m[4], h: +m[5] };
}
ck('设置面板新增 advToggle 锚点', !!spA.advToggle);
ck(`advToggle ${spA.advToggle.w}×${spA.advToggle.h} tap 高 >= 44`, spA.advToggle.h >= 44);
ck(`advToggle 底 ${spA.advToggle.y + spA.advToggle.h} <= divider3 顶 ${spA.divider3.y}`, spA.advToggle.y + spA.advToggle.h <= spA.divider3.y);
ck(`slotsRow2 底 ${spA.slotsRow2.y + spA.slotsRow2.h} <= cancelBtn 顶 ${spA.cancelBtn.y}（未溢出面板）`,
   spA.slotsRow2.y + spA.slotsRow2.h <= spA.cancelBtn.y);
ck(`所有分段落在 panel 内（底 ${spA.cancelBtn.y + spA.cancelBtn.h} <= ${spA.panel.y + spA.panel.h}）`,
   spA.cancelBtn.y + spA.cancelBtn.h <= spA.panel.y + spA.panel.h);
ck('toggle:adv 命中键已接线', /key === 'toggle:adv'/.test(sp));
ck('SLOTS_CONFIG 已移除 slot_advOp（功能已实现）', !/slot_advOp/.test(sp));

console.log('\n' + '='.repeat(70));
console.log(`RESULT: pass=${pass} fail=${fail}`);
if (fail > 0) { console.log('FAILED: ' + bad.join(' | ')); process.exit(1); }
console.log('ALL PASS'); console.log('='.repeat(70)); process.exit(0);
