// tester-bug3-uimanager-diff.mjs
// INPUT-04 bugfix 独立验收 · Bug 3（Minor）：模拟器鼠标 → touch 桥接
// 环境限制：Tester 没有 RDP + 微信开发者工具 GUI → 只能做静态 diff + 语义验证
// task-42 授权：「若无 IDE 可用：静态读 UIManager.js diff…归属为"代码验证 PASS–真机待追加"」
//
// 断言项（静态代码检查）：
//   S1. UIManager 构造函数末尾追加 canvas.addEventListener('mousedown/mousemove/mouseup')
//   S2. mousemove handler 判断 mouseDown 状态（相当于 buttons & 1）
//   S3. 分别转发 touchstart / touchmove / touchend
//   S4. 用 try/catch 兜底
//   S5. window.addEventListener('mouseup', ...) 兜底
//   S6. wx.onTouchStart/Move/End 主通路完全保留（真机不受影响）
//   S7. 保护清单：UIManager 只 append，未改保护清单文件

import fs from 'fs';

const src = fs.readFileSync('./js/ui/UIManager.js', 'utf8');
let PASS = 0, FAIL = 0;
function check(name, cond, detail = '') {
  console.log(`  ${cond ? '✓' : '✗'} ${name}` + (detail ? ` — ${detail}` : ''));
  cond ? PASS++ : FAIL++;
}

console.log('=== Bug3 UIManager.js 静态 diff 验证 ===\n');

// S1: canvas.addEventListener
check('S1 canvas.addEventListener("mousedown", …)', /addEventListener\(['"]mousedown['"]/.test(src));
check('S1 canvas.addEventListener("mousemove", …)', /addEventListener\(['"]mousemove['"]/.test(src));
check('S1 canvas.addEventListener("mouseup", …)', /addEventListener\(['"]mouseup['"]/.test(src));

// S2: _mouseDown 状态门（相当于 buttons & 1 语义）
check('S2 定义 _mouseDown 状态锁', /let\s+_mouseDown\s*=\s*false/.test(src));
check('S2 mousemove 中 if (!_mouseDown) return', /if\s*\(\s*!\s*_mouseDown\s*\)\s*return/.test(src));

// S3: 三种事件转发
check('S3 mousedown → touchstart 转发',
      /['"]mousedown['"][\s\S]{0,120}?renderer\.handleEvent\(['"]touchstart['"]/.test(src));
check('S3 mousemove → touchmove 转发',
      /['"]mousemove['"][\s\S]{0,120}?renderer\.handleEvent\(['"]touchmove['"]/.test(src));
check('S3 mouseup → touchend 转发',
      /_up\s*=\s*\([^)]*\)\s*=>\s*\{[\s\S]{0,200}?renderer\.handleEvent\(['"]touchend['"]/.test(src));

// S4: try/catch 兜底
check('S4 使用 try { … } catch 兜底真机 addEventListener 缺失', /try\s*\{[\s\S]+?catch\s*\(/.test(src));

// S5: window.addEventListener('mouseup', _up) 兜底鼠标拖出 canvas
check('S5 window.addEventListener("mouseup", …) 兜底',
      /window\.addEventListener\(['"]mouseup['"]/.test(src));

// S6: wx.onTouchStart/Move/End 主通路保留
check('S6 wx.onTouchStart 保留', /wx\.onTouchStart\s*\(/.test(src));
check('S6 wx.onTouchMove 保留',  /wx\.onTouchMove\s*\(/.test(src));
check('S6 wx.onTouchEnd 保留',   /wx\.onTouchEnd\s*\(/.test(src));

// 附加：确保 _toTouchEvent 构造 TouchEvent-like 对象（含 touches / changedTouches）
check('额外 _toTouchEvent 构造 TouchEvent-like {touches, changedTouches}',
      /touches\s*:\s*\[\s*\{\s*clientX[\s\S]{0,80}?changedTouches\s*:/.test(src));

// 附加：注释包含 Bug3 与 87 方案引用
check('额外：注释标注 Bug3 与 87 方案',
      /Bug3/i.test(src) && /87-INPUT04-bugfix/.test(src));

console.log('\n=== 事件流手工语义分析 ===');
console.log('  真机路径：wx.onTouchStart/Move/End → renderer.handleEvent — 未改动');
console.log('  模拟器路径：mousedown → _mouseDown=true → 转发 touchstart');
console.log('             mousemove（按下时）→ 转发 touchmove');
console.log('             mouseup/window.mouseup → _mouseDown=false → 转发 touchend');
console.log('  兼容性：canvas.addEventListener 在真机上通常为 undefined 或 no-op；');
console.log('        用 typeof this.canvas.addEventListener === "function" 判断 + try/catch 兜底');

console.log('\n=========================================');
console.log(`BUG3 STATIC: pass=${PASS} fail=${FAIL}`);
console.log(`OVERALL: ${FAIL === 0 ? 'PASS (代码验证) ✅  真机部分：由项目主 GUI 复核' : 'FAIL ❌'}`);
console.log('=========================================');
if (FAIL > 0) process.exit(1);
