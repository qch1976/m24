// selftest_input05_layout.mjs — R-01 + R-05 布局
// 顶行三按钮上边沿严格对齐、大小一致；ctrlRow cols=4 坐标；⚙️ 按钮坐标
import fs from 'fs';
import { track, done } from './_diag.mjs';
// task-73: 用 track() 包装，使中途 throw 时也能报「跑到第几项、哪项炸的」
const check = track(_checkRaw);

const pr = fs.readFileSync('js/ui/PageRenderer.js', 'utf-8');
const aa = fs.readFileSync('js/ui/AnswerArea.js', 'utf-8');

let ok = 0, fail = 0;
function _checkRaw(name, cond) {
  if (cond) { ok++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name}`); }
}

// hint/deal/answer x/y/w/h 从 LAYOUT_ANCHOR
const hintM = pr.match(/hintBtn:\s*\{\s*x:\s*(\d+),\s*y:\s*(\d+),\s*w:\s*(\d+),\s*h:\s*(\d+)/);
const dealM = pr.match(/dealBtn:\s*\{\s*x:\s*(\d+),\s*y:\s*(\d+),\s*w:\s*(\d+),\s*h:\s*(\d+)/);
const ansM = pr.match(/answerBtn:\s*\{\s*x:\s*(\d+),\s*y:\s*(\d+),\s*w:\s*(\d+),\s*h:\s*(\d+)/);
const setM = pr.match(/settingsBtn:\s*\{\s*x:\s*(\d+),\s*y:\s*(\d+),\s*w:\s*(\d+),\s*h:\s*(\d+)/);
if (!hintM || !dealM || !ansM || !setM) {
  console.log('  ✗ 找不到 LAYOUT_ANCHOR 定义'); process.exit(1);
}
const [_, hx, hy, hw, hh] = hintM.map((v, i) => i === 0 ? v : Number(v));
const [__, dx, dy, dw, dh] = dealM.map((v, i) => i === 0 ? v : Number(v));
const [___, ax, ay, aw, ah] = ansM.map((v, i) => i === 0 ? v : Number(v));
const [____, sx, sy, sw, sh] = setM.map((v, i) => i === 0 ? v : Number(v));

check(`顶行三按钮 y_top 全为 60 (hint=${hy}, deal=${dy}, answer=${ay})`, hy === 60 && dy === 60 && ay === 60);
check(`顶行三按钮 w 全为 100`, hw === 100 && dw === 100 && aw === 100);
check(`顶行三按钮 h 全为 50`, hh === 50 && dh === 50 && ah === 50);
check(`⚙ 设置按钮 x=15 y=15 w=40 h=40 (实际 x=${sx} y=${sy} w=${sw} h=${sh})`, sx === 15 && sy === 15 && sw === 40 && sh === 40);
check(`⚙ y 下沿 ${sy + sh} < hint y 上沿 ${hy}（无 y 重叠）`, (sy + sh) <= hy);

// AnswerArea ctrlRow cols=4
const ctrlM = aa.match(/ctrlRow:\s*\{\s*x:\s*(\d+),\s*y:\s*(\d+),\s*w:\s*(\d+),\s*h:\s*(\d+),\s*cols:\s*(\d+),\s*gap:\s*(\d+)/);
if (!ctrlM) { console.log('  ✗ 找不到 ctrlRow'); fail++; }
else {
  const [_, cx, cy, cw, ch, cols, gap] = ctrlM.map((v, i) => i === 0 ? v : Number(v));
  check(`ctrlRow x=25 y=740 w=361 h=60 cols=4 gap=10 (实际 x=${cx} y=${cy} w=${cw} h=${ch} cols=${cols} gap=${gap})`,
    cx === 25 && cy === 740 && cw === 361 && ch === 60 && cols === 4 && gap === 10);
  const btnW = (cw - gap * (cols - 1)) / cols;
  check(`ctrlRow 每按钮宽 ${btnW.toFixed(2)} ≈ 82.75`, Math.abs(btnW - 82.75) < 0.01);
}

// [无解] 按钮在 CTRL_KEYS 中
check("CTRL_KEYS 含 'nosol'", /CTRL_KEYS\s*=\s*\[[^\]]*nosol/.test(aa));

// 三色主题存在
check("PageRenderer 定义 HINT_BTN_BG='#F5A623'", /HINT_BTN_BG\s*=\s*['"]#F5A623['"]/.test(pr));
check("PageRenderer 定义 ANSWER_BTN_BG='#2ECC71'", /ANSWER_BTN_BG\s*=\s*['"]#2ECC71['"]/.test(pr));

done(ok, fail);
console.log(`[selftest_input05_layout] R-01/R-05: ok=${ok} fail=${fail}`);
console.log(fail === 0 ? 'PASS' : 'FAIL');
process.exit(fail === 0 ? 0 : 1);
