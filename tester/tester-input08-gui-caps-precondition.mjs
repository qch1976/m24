#!/usr/bin/env node
/**
 * INPUT-08 GUI 前置断言（应架构师 task-118 ② 要求）
 *
 * 背景（架构师原话）：`=== true` 口径下，若 GUI 侧不显式传 pow/log，
 * 则「功能已实现、全测试绿、但用户完全用不到，且没有任何断言会因此判红」。
 *
 * 本支就是那条缺失的断言。设计上它现在**必须判红**（capPow 尚未接线），
 * 判红本身即证明它有鉴别力；GUI task 落地后须转绿。
 *
 * 判据独立性（条款 5）：
 *   不问引擎「你支持 pow 吗」（那是引擎自证），
 *   而是**静态扫描 GUI 侧 caps 构造点**，检查其字面是否含 pow/log 字段。
 *   构造点在 js/ui/*（PageRenderer/SettingsPanel/AnswerArea），
 *   读取点在 js/core/RecipSolver（caps.pow === true），二者不同文件不同函数。
 *
 * 用法：node tester-input08-gui-caps-precondition.mjs [仓库根]
 */
import fs from 'fs';
import path from 'path';

const ROOT = process.argv[2] || process.cwd();
let pass = 0, fail = 0;
const fails = [];

function check(name, cond, detail) {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; fails.push(name); console.log(`  ✗ ${name} — ${detail}`); }
}

const read = p => { try { return fs.readFileSync(path.join(ROOT, p), 'utf8'); } catch { return null; } };

// ── GUI 侧 caps 构造点（实测定位，非猜测）──
const SITES = [
  { file: 'js/ui/PageRenderer.js',  desc: 'PageRenderer 构造 caps 传引擎' },
  { file: 'js/ui/SettingsPanel.js', desc: 'SettingsPanel 汇总开关' },
  { file: 'js/ui/AnswerArea.js',    desc: 'AnswerArea 默认 caps' },
  { file: 'js/core/Settings.mjs',   desc: 'Settings 持久化字段' },
];

console.log('=== G-1 引擎侧确已按 === true 读 pow/log（前提核实）===');
const eng = read('js/core/RecipSolver.mjs');
check('G-1.1 引擎存在 caps.pow === true 读取点',
  eng && /caps\s*&&\s*caps\.pow\s*===\s*true/.test(eng),
  '引擎未按 === true 读 pow ⇒ 本支前提不成立，先查引擎');
check('G-1.2 引擎存在 caps.log === true 读取点',
  eng && /caps\s*&&\s*caps\.log\s*===\s*true/.test(eng),
  '引擎未按 === true 读 log');

console.log('');
console.log('=== G-2 GUI 侧 caps 构造点必须显式传 pow/log ===');
console.log('    （=== true 口径下，漏传即静默全关 ⇒ 玩家侧幂/对数恒不可用）');
console.log('    ⚠️ 判据按【对象字面量块】而非单行——caps 多写成多行对象，');
console.log('       早期版逐行扰 recip: 同行是否含 pow:，对多行对象必误报（2026-08-09 实测修正）。');

// 从含 recip: 的行向下取一个完整对象字面量块（至配对的 } 或遇下一个声明）
function capsBlockAt(lines, idx) {
  // 向上最多 3 行找开括号，向下最多 12 行收集
  let start = idx;
  for (let i = idx; i >= Math.max(0, idx - 3); i--) {
    if (/[{]\s*$/.test(lines[i]) || /=\s*[{]/.test(lines[i])) { start = i; break; }
  }
  const buf = [];
  let depth = 0, seen = false;
  for (let i = start; i < Math.min(lines.length, start + 14); i++) {
    buf.push(lines[i]);
    for (const ch of lines[i]) {
      if (ch === '{') { depth++; seen = true; }
      else if (ch === '}') depth--;
    }
    if (seen && depth <= 0) break;
  }
  return buf.join('\n');
}

for (const s of SITES) {
  const src = read(s.file);
  if (src === null) { check(`G-2 ${s.file} 可读`, false, '文件不存在'); continue; }
  const lines = src.split('\n');
  const capsIdx = lines
    .map((l, i) => ({ n: i + 1, l, i }))
    .filter(x => /\brecip\s*:/.test(x.l));
  if (capsIdx.length === 0) continue;   // 该文件不构造 caps，跳过
  for (const { n, i } of capsIdx) {
    const block = capsBlockAt(lines, i);
    const hasPow = /\bpow\s*:/.test(block);
    const hasLog = /\blog\s*:/.test(block);
    // 去注释后重验，防【只在注释里写了 pow:】蒙混过关
    const codeOnly = block.split('\n').map(x => x.replace(/\/\/.*$/, '')).join('\n');
    const hasPowCode = /\bpow\s*:/.test(codeOnly);
    const hasLogCode = /\blog\s*:/.test(codeOnly);
    check(`G-2 ${s.file}:${n} caps 块含 pow 字段(非注释)`, hasPowCode,
      hasPow && !hasPowCode ? '🔴 pow: 只出现在注释里，代码未真传'
                            : '该 caps 块未传 pow ⇒ 引擎按 === true 判为关');
    check(`G-2 ${s.file}:${n} caps 块含 log 字段(非注释)`, hasLogCode,
      hasLog && !hasLogCode ? '🔴 log: 只出现在注释里，代码未真传' : '该 caps 块未传 log');
  }
}

console.log('');
console.log('=== G-3 设置页须存在 capPow/capLog 开关字段 ===');
for (const f of ['js/core/Settings.mjs', 'js/ui/SettingsPanel.js']) {
  const src = read(f);
  if (src === null) { check(`G-3 ${f} 可读`, false, '文件不存在'); continue; }
  check(`G-3 ${f} 含 capPow`, /capPow/.test(src), '设置页无 capPow 开关 ⇒ 玩家无法开启幂');
  check(`G-3 ${f} 含 capLog`, /capLog/.test(src), '设置页无 capLog 开关 ⇒ 玩家无法开启对数');
}

// ── 条款 8：断言总数自断言 ──
const EXPECTED_ASSERTION_COUNT = 18;
console.log('');
console.log('=== 条款 8：断言总数自断言 ===');
const total = pass + fail;
if (total === EXPECTED_ASSERTION_COUNT) {
  pass++; console.log(`  ✓ 断言总数 = ${total} 与期望一致`);
} else {
  fail++; fails.push('断言总数'); console.log(`  ✗ 断言总数 = ${total}，期望 ${EXPECTED_ASSERTION_COUNT}`);
}

console.log('');
console.log('=========================================');
console.log(`GUI CAPS PRECONDITION: pass=${pass} fail=${fail}`);
if (fail) { console.log('失败项：'); fails.forEach(f => console.log('  - ' + f)); }
console.log(fail ? 'OVERALL: FAIL ❌' : 'OVERALL: PASS ✅');
console.log('');
console.log('🔴 说明：GUI 接线未完成前，本支 G-2/G-3 应判红。');
console.log('   判红即证明它有鉴别力（架构师 task-118 ② 要求：必须先判红再判绿）。');
console.log('');
console.log('⚠️ 退出码取法（本支实测踩坑，2026-08-09）：');
console.log(`   本次退出码 = ${fail ? 1 : 0}（以本行为准）`);
console.log('   🔴 禁用 cmd 下  node x.mjs & echo %errorlevel%  —— & 取到的是【前一条命令】的码，');
console.log('      实测本支 OVERALL:FAIL 却回显 RC=0，会把红灯读成绿灯。');
console.log('   🔴 禁经管道：bash 下 node x.mjs | tail  取到的是管道末端码，须用 ${PIPESTATUS[0]}。');
console.log('   ✅ 正确取法：走 run-gate.sh，或 node spawnSync(...).status，或 cmd 下用 delayed expansion。');
console.log('=========================================');
process.exit(fail ? 1 : 0);
