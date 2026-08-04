// verify-task68-external.mjs — 用【不依赖我的实现】的第三方判据校验 task-68 产出
//
// 规范 L240 方法论警告：「不得仅用两个独立实现得同一数字作为正确性依据。
//   若两实现共享同一盲点，会同时错到同一值。」
//
// ⇒ 架构师的 tools/verify/*.mjs 跑的是他自己的 lib-input06-dedup.mjs，
//   与我改的 js/core/RecipSolver.js **零共享**，所以它们**不能**验证我的实现。
//   本脚本补上这一环：拿 INPUT-05 已上线验收的 js/core/Solver.mjs（第三方实现）
//   与我的 RecipSolver.primary 对比，并校验 2 处已知差异的方向与数值。

import * as Recip from '../../js/core/RecipSolver.mjs';
import * as Online from '../../js/core/Solver.mjs';

let pass = 0, fail = 0;
const ck = (name, cond, detail = '') => {
  if (cond) { pass++; console.log(`  ok  ${name}${detail ? '   ' + detail : ''}`); }
  else { fail++; console.log(`  XX  ${name}   ${detail}`); }
};

// 线上 solver 解数：找出可用的枚举入口
function onlineCount(cards) {
  const fn = Online.findSolutionsWithAST || Online.findSolutions
    || (Online.default && (Online.default.findSolutionsWithAST || Online.default.findSolutions));
  if (!fn) return null;
  const r = fn(cards);
  if (Array.isArray(r)) return r.length;
  if (r && typeof r.size === 'number') return r.size;
  if (r && Array.isArray(r.solutions)) return r.solutions.length;
  return null;
}

console.log('=== task-68 外部交叉验证：我的 RecipSolver vs 线上 Solver（第三方实现）===');
console.log('    线上 Solver 与我改的 RecipSolver 零代码共享 ⇒ 构成独立判据\n');

const DECKS = [
  [1, 2, 3, 4], [2, 3, 4, 6], [1, 3, 4, 6], [1, 5, 5, 5], [3, 3, 8, 8],
  [1, 2, 5, 10], [1, 1, 3, 8], [1, 4, 6, 8], [2, 4, 5, 8],
  [5, 5, 5, 5], [1, 1, 2, 9], [3, 3, 7, 7], [4, 4, 7, 7], [3, 3, 3, 5],
];

// 规范 §8：仅 [1,1,3,8]（4→1）与 [1,4,6,8]（5→3）应不一致，其余 12 组必须一致
const EXPECTED_DIFF = { '1,1,3,8': [4, 1], '1,4,6,8': [5, 3] };

console.log('  deck            线上  我的primary  判定');
let agree = 0, diffSeen = {};
for (const d of DECKS) {
  const key = d.join(',');
  const on = onlineCount(d);
  const mine = Recip.solve(d).counts.primary;
  if (on === null) { console.log(`  [${key}] 线上入口不可用，跳过`); continue; }
  const exp = EXPECTED_DIFF[key];
  let verdict;
  if (exp) {
    const ok = on === exp[0] && mine === exp[1];
    verdict = ok ? `⚠ 预期差异 ${exp[0]}→${exp[1]} ✓` : `❌ 差异不符预期(应 ${exp[0]}→${exp[1]})`;
    diffSeen[key] = ok;
  } else {
    if (on === mine) { agree++; verdict = '✅ 一致'; }
    else verdict = `❌ 意外不一致`;
  }
  console.log(`  [${key}]`.padEnd(18) + `${String(on).padEnd(6)}${String(mine).padEnd(12)}${verdict}`);
}

console.log('');
ck('12 组应完全一致（非预期差异组）', agree === 12, `实测一致 ${agree}/12`);
ck('[1,1,3,8] 线上4 → 我的1（裁定②③合并，规范 §8）', diffSeen['1,1,3,8'] === true);
ck('[1,4,6,8] 线上5 → 我的3（乘1变体三合一，规范 §8）', diffSeen['1,4,6,8'] === true);

// ---- 差异必须是「下降」方向：新口径合并解，不应凭空多出解 ----
console.log('\n  [方向性校验] 新口径只应合并、不应新增');
{
  let allLE = true, bad = '';
  for (const d of DECKS) {
    const on = onlineCount(d); if (on === null) continue;
    const mine = Recip.solve(d).counts.primary;
    if (mine > on) { allLE = false; bad += `[${d}] 我的${mine} > 线上${on}; `; }
  }
  ck('所有 deck：我的 primary ≤ 线上（只合并不新增）', allLE, bad || '全部满足');
}

// ---- [1,4,6,8] 未过度合并：8/(1-(4/6)) 必须独立保留 ----
console.log('\n  [防过度合并] 规范 §8 明确要求这两条不得被合并');
{
  const n = (c) => Recip.numLeaf(c, 0);
  const K = (t) => Recip.keySol(Recip.reduceToFixpoint(t).node);
  const mul = (a, b) => ({ op: '*', a, b }), sub = (a, b) => ({ op: '-', a, b });
  const div = (a, b) => ({ op: '/', a, b }), add = (a, b) => ({ op: '+', a, b });
  // ((1+6)-4)*8  vs  (8-4)*6 —— (1+6)-4=3 ≠ 8-4=4，非恒等变体
  const e1 = mul(sub(add(n(1), n(6)), n(4)), n(8));
  const e2 = mul(sub(n(8), n(4)), n(6));
  ck('((1+6)-4)*8 与 (8-4)*6 键相异（未过度合并）', K(e1) !== K(e2), `${K(e1)} vs ${K(e2)}`);
  // 8/(1-(4/6)) 独立保留
  const e3 = div(n(8), sub(n(1), div(n(4), n(6))));
  ck('8/(1-(4/6)) 与 (8-4)*6 键相异（未过度合并）', K(e3) !== K(e2), `${K(e3)} vs ${K(e2)}`);
}

console.log('\n' + '='.repeat(62));
console.log(`[task68-external] pass=${pass} fail=${fail}`);
console.log(fail === 0
  ? '✅ 外部第三方判据通过：12/14 一致 + 2 处预期差异 + 未过度合并'
  : '🔴 外部判据未通过');
console.log('='.repeat(62));
process.exit(fail === 0 ? 0 : 1);
