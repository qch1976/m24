// selftest_input05_nosolution.mjs — R-04
// [无解] 按钮双分支：solutions.length===0 → celebrate；>0 → toast
// 且两分支均不自动发牌（PageRenderer._handleNoSolTap 中不调 _dealAction）
import { generateRandom } from '../js/core/DealGenerator.mjs';
import Solver from '../js/core/Solver.mjs';

// 逻辑等价测试（模拟 _handleNoSolTap 判定路径）
function noSolBranch(cardValues) {
  const sols = Solver.findSolutions(cardValues);
  return sols.length === 0 ? 'celebrate' : 'toast';
}

// 找 5 组无解 + 5 组有解
const unsolved = [], solved = [];
for (let i = 0; i < 500 && (unsolved.length < 5 || solved.length < 5); i++) {
  const cards = generateRandom();
  const values = cards.map(c => c.value);
  if (Solver.isSolvable(values, 24)) {
    if (solved.length < 5) solved.push(values);
  } else {
    if (unsolved.length < 5) unsolved.push(values);
  }
}

let ok = 0, fail = 0;
for (const v of unsolved) {
  const branch = noSolBranch(v);
  if (branch === 'celebrate') ok++;
  else { fail++; console.log(`  ✗ unsolved ${JSON.stringify(v)} branch=${branch}`); }
}
for (const v of solved) {
  const branch = noSolBranch(v);
  if (branch === 'toast') ok++;
  else { fail++; console.log(`  ✗ solved ${JSON.stringify(v)} branch=${branch}`); }
}
console.log(`[selftest_input05_nosolution] R-04 双分支: unsolved=${unsolved.length} solved=${solved.length} ok=${ok} fail=${fail}`);

// 验证 PageRenderer._handleNoSolTap 源码不含 _dealAction 调用
import fs from 'fs';
const pr = fs.readFileSync('js/ui/PageRenderer.js', 'utf-8');
// 抽取 _handleNoSolTap 方法体
const m = pr.match(/_handleNoSolTap\s*\(\)\s*\{([\s\S]+?)^\s{2}\}/m);
let noAutoDeal = true;
if (m) {
  const body = m[1];
  if (body.includes('_dealAction') || body.includes('this.deck.deal')) {
    noAutoDeal = false;
    console.log('  ✗ _handleNoSolTap 含自动发牌调用！');
  } else {
    console.log('  ✓ _handleNoSolTap 无自动发牌调用');
  }
} else {
  noAutoDeal = false;
  console.log('  ✗ 未找到 _handleNoSolTap 方法');
}

const allOk = fail === 0 && noAutoDeal;
console.log(allOk ? 'PASS' : 'FAIL');
process.exit(allOk ? 0 : 1);
