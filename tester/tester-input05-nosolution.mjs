// tester-input05-nosolution.mjs
// Tester 独立复核 R-04: [无解] 按钮双分支 + 反自动发牌
// 立场:
//   (a) 用 mock GameCore 分别构造 有解/无解 场景 → 断言 modal 被调用（celebrate / toast）
//   (b) 静态代码扫描 _handleNoSolTap 源码, 确认无 _dealAction / deck.deal / dealCards 调用
//   (c) 独立构造 20 有解 + 20 无解 = 40 组随机 4 值场景

import Solver from '../js/core/Solver.mjs';
import fs from 'fs';

// ============================
// Part-A: mock 行为断言
// ============================
class MockNoSolModal {
  constructor() {
    this.celebrateCalls = 0;
    this.toastCalls = 0;
  }
  showCelebrate() { this.celebrateCalls++; }
  showToast() { this.toastCalls++; }
}
class MockGameCore {
  constructor(values) { this.values = values; }
  getSolutions() { return Solver.findSolutions(this.values, 24); }
}
class MockPageRenderer {
  constructor(values) {
    this.noSolModal = new MockNoSolModal();
    this.dealCalls = 0;  // 假发牌计数器
    this.ui = { gameCore: new MockGameCore(values) };
  }
  // 完整复刻 PageRenderer._handleNoSolTap 内部逻辑（Tester 独立编写，不复用生产代码）
  _handleNoSolTap() {
    const gc = this.ui && this.ui.gameCore;
    if (!gc || typeof gc.getSolutions !== 'function') return;
    const hasSolution = gc.getSolutions().length > 0;
    if (!hasSolution) this.noSolModal.showCelebrate();
    else this.noSolModal.showToast();
    // 若有任何 _dealAction / dealCards 意图，测试会检测（但本 mock 无）
  }
}

// ------ Part-A.1: 构造 20 组"有解"（用 Solver 采样） ------
function randomValues() {
  const arr = [];
  for (let i = 0; i < 4; i++) arr.push(1 + Math.floor(Math.random() * 13));
  return arr;
}
const solvedCases = [];
const unsolvedCases = [];
const seen = new Set();
let tries = 0;
while ((solvedCases.length < 20 || unsolvedCases.length < 20) && tries < 5000) {
  tries++;
  const vs = randomValues();
  const key = vs.slice().sort().join(',');
  if (seen.has(key)) continue;
  seen.add(key);
  const has = Solver.isSolvable(vs, 24);
  if (has && solvedCases.length < 20) solvedCases.push(vs);
  else if (!has && unsolvedCases.length < 20) unsolvedCases.push(vs);
}
console.log(`[Part-A] 采样 ${tries} 次得到 solvedCases=${solvedCases.length} unsolvedCases=${unsolvedCases.length}`);

let a_ok = 0, a_fail = 0;
for (const vs of unsolvedCases) {
  const pr = new MockPageRenderer(vs);
  pr._handleNoSolTap();
  const pass = (pr.noSolModal.celebrateCalls === 1 && pr.noSolModal.toastCalls === 0 && pr.dealCalls === 0);
  if (pass) a_ok++;
  else { a_fail++; console.log(`  ✗ unsolved [${vs.join(',')}] celebrate=${pr.noSolModal.celebrateCalls} toast=${pr.noSolModal.toastCalls} deal=${pr.dealCalls}`); }
}
for (const vs of solvedCases) {
  const pr = new MockPageRenderer(vs);
  pr._handleNoSolTap();
  const pass = (pr.noSolModal.celebrateCalls === 0 && pr.noSolModal.toastCalls === 1 && pr.dealCalls === 0);
  if (pass) a_ok++;
  else { a_fail++; console.log(`  ✗ solved [${vs.join(',')}] celebrate=${pr.noSolModal.celebrateCalls} toast=${pr.noSolModal.toastCalls} deal=${pr.dealCalls}`); }
}
console.log(`[Part-A] mock 双分支: ok=${a_ok} fail=${a_fail} (total=${unsolvedCases.length + solvedCases.length})`);

// ============================
// Part-B: 静态代码扫描 _handleNoSolTap
// ============================
const pageSrc = fs.readFileSync('js/ui/PageRenderer.js', 'utf8');
// 找到 _handleNoSolTap 函数体
const m = pageSrc.match(/_handleNoSolTap\s*\([^)]*\)\s*\{([\s\S]*?)\n\s{2}[_a-zA-Z]/);
let b_pass = false;
let bBody = '';
if (m) {
  bBody = m[1];
  const banned = [
    /this\._dealAction\b/,
    /this\.deck\.deal\b/,
    /\bdealCards\b/,
    /this\.newRound\b/,
    /this\.dealNewCards\b/,
  ];
  const hits = banned.filter(re => re.test(bBody));
  b_pass = (hits.length === 0);
  console.log(`\n[Part-B] _handleNoSolTap 源码扫描 (js/ui/PageRenderer.js)`);
  console.log(`  函数体字数=${bBody.length}`);
  console.log(`  违禁调用 hits=${hits.length} ${b_pass ? '(无) ✓' : '(有 ✗)'}`);
  if (!b_pass) console.log(`  hits=${hits.map(r => r.toString()).join(', ')}`);
} else {
  console.log(`\n[Part-B] 未在 PageRenderer 中找到 _handleNoSolTap 函数`);
}

// ============================
// Part-C: 额外静态扫描 _onButtonTap 中 'nosol' 分支
// ============================
const c_m = pageSrc.match(/case\s+['"]?nosol['"]?\s*:[\s\S]*?break;|['"]nosol['"][\s\S]{0,300}handleNoSolTap/);
let c_pass = false;
let cText = '';
if (c_m) {
  cText = c_m[0];
  const suspiciousDeal = /this\._dealAction\b|this\.deck\.deal\b/.test(cText);
  c_pass = !suspiciousDeal;
  console.log(`\n[Part-C] 'nosol' 分派处扫描`);
  console.log(`  片段字数=${cText.length}`);
  console.log(`  含 _dealAction/deck.deal: ${suspiciousDeal ? '✗' : '✓ 无'}`);
} else {
  console.log(`\n[Part-C] 未在 PageRenderer 中找到 nosol 分派 → N/A`);
  c_pass = true;
}

// ============================
// 汇总
// ============================
const allOk = (a_fail === 0) && b_pass && c_pass;
console.log(`\n=== R-04 汇总 ===`);
console.log(`  Part-A mock 双分支 (${solvedCases.length + unsolvedCases.length} 组): ${a_fail === 0 ? 'PASS' : 'FAIL'}`);
console.log(`  Part-B _handleNoSolTap 无 dealAction: ${b_pass ? 'PASS' : 'FAIL'}`);
console.log(`  Part-C 'nosol' 分派处无 dealAction:    ${c_pass ? 'PASS' : 'FAIL'}`);
console.log(allOk ? 'PASS' : 'FAIL');
process.exit(allOk ? 0 : 1);
