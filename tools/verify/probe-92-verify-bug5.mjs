// 人工阅读型调查脚本，非门禁。退出码恒为 0，即使正文打印 ❌ 也不判红；判定权在阅读者。
// （task-75 哑弹治理：本批 probe-* 均无非零退出能力，❌/FAIL 全在 console.log 内。）
// probe-92-verify-bug5.mjs — Bug 5 探针脚本（服务器实测同步版）
// 目的：
//   [Bug 5.1] 在 fec9851 版 Solver.mjs 上验证 toCanonicalKeyV2 未把 a×1 / a÷1 归一，
//             并给出修复选型 P 的伪代码验证（本文件仅打印期望的目标 key，实际归一函数由开发实现）。
//   [Bug 5.2] 打印 formatExprPretty 对 8 类乘除相连表达式的实际输出，作为 Tester 回归 Golden。
//   [Bug 4-v2] 采样若干牌局，输出全解 pretty 字符串长度分布（median / P75 / P95），
//              作为 Bug 4-v2 A / B / C 选型的数据依据。
//
// 运行：
//   1) 从服务器拉 fec9851 的 js/core/Solver.js 到本目录改名 Solver.mjs
//   2) node probe-92-verify-bug5.mjs
//
// 依赖：./Solver.mjs（fec9851 版，不改字节）

import Solver, {
  toCanonicalKey,
  toCanonicalKeyV2,
  findSolutionsWithAST,
  formatExprPretty,
  postOrderSteps,
  chooseCanonicalSolution,
  intToFraction,
} from '../../js/core/Solver.mjs';

// ---------- 手工 AST 构造 ----------
function n(v) { return { op: 'num', value: intToFraction(v), label: String(v) }; }
function bin(op, l, r) { return { op, args: [l, r] }; }

// -------- Bug 5.1：canonicalKeyV2 复现 + 硬约束非回归 --------
const bug51Cases = [
  ['a×1 vs a÷1 (a=3)  — 应同 key（修法目标）',
    bin('*', n(3), n(1)),
    bin('/', n(3), n(1)),  'SAME'],
  ['a×1 vs a (a=3)   — 应不同 key（硬约束非回归）',
    bin('*', n(3), n(1)),
    n(3),                  'DIFF'],
  ['a×2 vs a÷2 (a=6) — 应不同 key（硬约束非回归）',
    bin('*', n(6), n(2)),
    bin('/', n(6), n(2)),  'DIFF'],
  ['a×1×1 vs a÷1÷1 (a=3) — 应同 key',
    bin('*', bin('*', n(3), n(1)), n(1)),
    bin('/', bin('/', n(3), n(1)), n(1)), 'SAME'],
  ['a×1÷1 vs a÷1×1 (a=3) — 应同 key',
    bin('/', bin('*', n(3), n(1)), n(1)),
    bin('*', bin('/', n(3), n(1)), n(1)), 'SAME'],
  ['(a×1)+b vs (a÷1)+b (a=3,b=5) — 应同 key',
    bin('+', bin('*', n(3), n(1)), n(5)),
    bin('+', bin('/', n(3), n(1)), n(5)), 'SAME'],
];
console.log('=== Bug 5.1 canonicalKeyV2 对比表 ===');
for (const [name, A, B, expected] of bug51Cases) {
  const kA = toCanonicalKeyV2(A);
  const kB = toCanonicalKeyV2(B);
  const actual = kA === kB ? 'SAME' : 'DIFF';
  const pass = actual === expected ? 'OK' : 'FAIL(未归一)';
  console.log(`[${actual}] expect=${expected}  ${pass}`);
  console.log(`  ${name}`);
  console.log(`  A: ${formatExprPretty(A)}   key=${kA}`);
  console.log(`  B: ${formatExprPretty(B)}   key=${kB}`);
}

// -------- Bug 5.2：formatExprPretty 8 类乘除相连 Golden --------
const bug52Golden = [
  ['(a×b)×c    (a=3,b=5,c=2)',   bin('*', bin('*', n(3), n(5)), n(2)),   '3×5×2'],
  ['(a×b)÷c    (a=3,b=5,c=2)',   bin('/', bin('*', n(3), n(5)), n(2)),   '3×5÷2'],
  ['a÷(b×c)   (a=24,b=2,c=3) 保括号', bin('/', n(24), bin('*', n(2), n(3))), '24÷(2×3)'],
  ['(a÷b)÷c   (a=24,b=2,c=3)',   bin('/', bin('/', n(24), n(2)), n(3)),  '24÷2÷3'],
  ['a÷(b÷c)   (a=24,b=6,c=3) 保括号', bin('/', n(24), bin('/', n(6), n(3))), '24÷(6÷3)'],
  ['a×(b÷c)   (a=3,b=24,c=3)',   bin('*', n(3), bin('/', n(24), n(3))),   '3×24÷3'],
  ['(a×b)÷(c×d) (a=3,b=4,c=2,d=1) 右子保括号',
    bin('/', bin('*', n(3), n(4)), bin('*', n(2), n(1))), '3×4÷(2×1)'],
  ['(a÷b)×c   (a=24,b=2,c=2)',   bin('*', bin('/', n(24), n(2)), n(2)),   '24÷2×2'],
];
console.log('\n=== Bug 5.2 formatExprPretty Golden ===');
for (const [name, ast, expected] of bug52Golden) {
  const actual = formatExprPretty(ast);
  const pass = actual === expected ? 'OK' : 'FAIL';
  console.log(`  [${pass}] ${name.padEnd(38)} => "${actual}"   (期望 "${expected}")`);
}

// -------- Bug 4-v2：答案长度分布采样 --------
const sampleDecks = [
  [1,3,5,8],[2,3,4,6],[3,3,8,8],[1,5,5,5],[4,6,7,8],
  [2,5,7,9],[1,4,10,11],[2,6,6,8],[3,4,7,10],[5,7,8,9],
  [1,2,3,12],[4,4,10,10],[6,6,6,6],[1,8,12,3],[2,7,11,13],
  [1,2,8,8],[1,3,3,5],[1,4,6,8],[2,2,10,10],[3,5,6,8],
];
console.log('\n=== Bug 4-v2 答案 pretty 字符串长度采样（含 " = 24" 尾） ===');
let allLens = [];
let maxSample = null;
for (const d of sampleDecks) {
  const sols = findSolutionsWithAST(d);
  if (!sols.length) continue;
  for (const s of sols) {
    const t = formatExprPretty(s.ast) + ' = 24';
    allLens.push(t.length);
    if (!maxSample || t.length > maxSample.length) maxSample = t;
  }
}
allLens.sort((a,b)=>a-b);
if (allLens.length) {
  const p = (q) => allLens[Math.min(allLens.length-1, Math.floor(allLens.length*q))];
  console.log(`样本数=${allLens.length}  最短=${allLens[0]}  中位=${p(0.5)}  P75=${p(0.75)}  P95=${p(0.95)}  最长=${allLens[allLens.length-1]}`);
  console.log(`最长样本示例："${maxSample}"（${maxSample.length} 字符）`);
  const buckets = new Map();
  for (const L of allLens) { buckets.set(L, (buckets.get(L)||0)+1); }
  const keys = [...buckets.keys()].sort((a,b)=>a-b);
  console.log('长度直方图:');
  for (const k of keys) console.log(`   ${String(k).padStart(3)} : ${'#'.repeat(buckets.get(k))}  (${buckets.get(k)})`);
}
