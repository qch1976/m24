// tester-INPUT04-solver.mjs
// Tester (worker3) 独立采样：Solver 层 R-03/R-04 验证
// 不 copy Developer selftest_input04_solver.mjs
//
// 覆盖：
//  - 20+ 组独立牌局（单解、多解、含 0/大小王、含非整数中间结果、[4,4,10,10] 单解、除 [1,4,8,13] 外全部自选）
//  - postOrderSteps 长度必为 3，step3 重新拼接 = getAllSolutions()[0]（字典序最小）
//  - chooseCanonicalSolution 幂等（10 次连续 expr 一致）
//  - chooseCanonicalSolution 字典序最小与自行 sort 后取最小一致
//  - canonicalize +交换律 / -不交换
//  - findSolutionsWithAST 已去重、已排序、与 findSolutions 集合相等
//  - 静态检查：Solver.js/GameCore.js 新增区段无 Math.random；Date.now 只在 AnswerModal.js
//
// 运行：node tester-INPUT04-solver.mjs
// 输出：控制台 + 逐个用例结果；结尾 OVERALL PASS/FAIL

import Solver, {
  findSolutionsWithAST,
  postOrderSteps,
  chooseCanonicalSolution,
  canonicalize,
  toCanonicalKeyV2,   // task-131: F-set-eq 改用规范键做语义等价比对（同层，非字符串集）
} from '../js/core/Solver.mjs';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const results = [];
let passCount = 0;
let failCount = 0;
function record(name, pass, detail = '') {
  results.push({ name, pass, detail });
  if (pass) passCount++; else failCount++;
  console.log(`${pass ? '[PASS]' : '[FAIL]'} ${name}${detail ? ' :: ' + detail : ''}`);
}

// ---- 20+ 组独立牌局 ----
// 铁律：不复用 Developer [1,4,8,13] / [4,4,10,10] 作为断言主样本；[4,4,10,10] 只用来做多解字典序验证的对照，附加而不替代。
const decks = [
  // 单解或较少解
  [3, 3, 8, 8],    // 8/(3-8/3) = 24（含非整数中间结果）
  [1, 5, 5, 5],    // 5*(5-1/5) = 24（含非整数中间结果）
  [2, 3, 5, 12],   // (12-5)*2+? 或者 12+3+5+... 等
  [6, 6, 6, 6],
  [2, 2, 12, 12],
  [3, 8, 8, 10],
  [7, 7, 7, 7],
  [1, 2, 3, 4],
  [2, 4, 6, 12],
  [5, 6, 10, 12],
  // 含 0（大王/小王）
  [0, 4, 6, 8],    // 4*(6+0) = 24 or 6*4+0 = 24 类似
  [0, 3, 8, 8],    // 0+3*8=24？ 但 3*8=24, +0 = 24 → OK
  [0, 0, 4, 6],    // 4*6 + 0 + 0 = 24 → OK
  [0, 6, 12, 12],  // 12+12+0*6=24, or 6*(12/(12-0*?)) 等
  // 多解 / 较多解
  [4, 4, 6, 6],
  [3, 3, 4, 4],
  [2, 2, 10, 10],
  [3, 4, 4, 6],
  [4, 6, 6, 8],
  [2, 3, 8, 12],
  // 边界（含较大数）
  [5, 8, 10, 13],
  [10, 10, 12, 13],
  // 分数中间结果特型
  [3, 5, 7, 13],
  // 附加对照（不作为主样本）
  [4, 4, 10, 10],
];

// 过滤：仅保留可解（isSolvable === true）
const solvableDecks = decks.filter((d) => {
  try {
    return Solver.isSolvable(d);
  } catch (e) { return false; }
});

console.log(`=== 20+ 组独立采样：可解牌局数 = ${solvableDecks.length} / 总候选 ${decks.length} ===`);
record('SAMPLE-COUNT>=20 (可解)', solvableDecks.length >= 20, `count=${solvableDecks.length}`);

// ---- Case A: postOrderSteps 长度 = 3；step3 lhs op rhs 拼接 = getAllSolutions()[0] ----
// 由 findSolutionsWithAST 排序后取第 0（字典序最小），postOrderSteps(ast) 拼接第 3 步的 lhs+op+rhs（把 ×/÷ 转回 */）
function reassembleStep3(step3) {
  // step3.lhs / rhs 已带外层括号（非叶子）；内部可能含 ×/÷
  // canonical expr 使用 内部 */，所以将 lhs/rhs 及 op 中的 ×/÷ 反向映射回 */
  const back = (s) => s.replace(/×/g, '*').replace(/÷/g, '/');
  const op = back(step3.op);
  const lhs = back(step3.lhs);
  const rhs = back(step3.rhs);
  return `(${lhs}${op}${rhs})`;
}
for (const deck of solvableDecks) {
  const withAst = findSolutionsWithAST(deck);
  const steps = postOrderSteps(withAst[0].ast);
  const okLen = steps.length === 3;
  const reassembled = reassembleStep3(steps[2]);
  const okReassemble = reassembled === withAst[0].expr;
  record(`A-postOrder [${deck.join(',')}]`, okLen && okReassemble,
    `steps=${steps.length}, step3='${reassembled}' vs canonical='${withAst[0].expr}'`);
}

// ---- Case B: chooseCanonicalSolution 幂等（连续 10 次） ----
for (const deck of solvableDecks) {
  const sols = findSolutionsWithAST(deck);
  const chosen0 = chooseCanonicalSolution(sols, deck).expr;
  let ok = true;
  for (let i = 0; i < 10; i++) {
    const c = chooseCanonicalSolution(findSolutionsWithAST(deck), deck).expr;
    if (c !== chosen0) { ok = false; break; }
  }
  record(`B-idempotent [${deck.join(',')}]`, ok, `chosen='${chosen0}'`);
}

// ---- Case C: chooseCanonicalSolution == 自己 sort 后取最小 ----
for (const deck of solvableDecks) {
  const sols = findSolutionsWithAST(deck);
  const chosen = chooseCanonicalSolution(sols, deck).expr;
  const minByExpr = sols.map(s => s.expr).sort()[0];
  record(`C-lex-min [${deck.join(',')}]`, chosen === minByExpr,
    `chosen='${chosen}' vs sortMin='${minByExpr}'`);
}

// ---- Case D: canonicalize +交换律：(1+2)+3 ≡ 3+(2+1) ----
{
  const leaf = (n) => ({ op: 'num', value: { num: n, den: 1 }, label: String(n) });
  const bin = (op, l, r) => ({ op, args: [l, r] });
  const ast1 = bin('+', bin('+', leaf(1), leaf(2)), leaf(3));
  const ast2 = bin('+', leaf(3), bin('+', leaf(2), leaf(1)));
  const k1 = canonicalize(ast1);
  const k2 = canonicalize(ast2);
  record('D-canon-+comm', k1 === k2, `k1='${k1}', k2='${k2}'`);
}

// ---- Case E: canonicalize -不交换：(1-2)+3 与 3+(2-1) 不完全等价 ----
{
  const leaf = (n) => ({ op: 'num', value: { num: n, den: 1 }, label: String(n) });
  const bin = (op, l, r) => ({ op, args: [l, r] });
  // AST 1: (1 - 2) + 3
  const ast1 = bin('+', bin('-', leaf(1), leaf(2)), leaf(3));
  // AST 2: 3 + (2 - 1) （子表达式 (2-1) 与 (1-2) 不等价，因此整体不等价）
  const ast2 = bin('+', leaf(3), bin('-', leaf(2), leaf(1)));
  const k1 = canonicalize(ast1);
  const k2 = canonicalize(ast2);
  record('E-canon--noncomm', k1 !== k2, `k1='${k1}', k2='${k2}'`);
}

// ---- Case F: findSolutionsWithAST 已去重、已排序、且与 Solver.findSolutions 【语义等价】 ----
// 🔴 task-131 第 3 批改写（经理已批）。原判据断言两 API 的【字符串集严格相等】，
//     自 5b80efa 入库当天即 14/14 恒红（= 永久失灵的哨兵）。根因实测如下：
//     同一个解在两侧的【操作数排列】不同，例 deck [1,1,1,11]：
//       旧 API = ((1+11)*(1+1))    新 API = ((1+1)*(1+11))
//     乘法交换律下二者等价，但字符串不等 ⇒ 字符串集比对必失败。
// 🔴 穷举实测（1..13 四张有序组合 1820 组，本文件外部探针）：
//       存在性 (old>0)===(new>0) 不一致 = 0 组
//       解数 old.length===new.length 不一致 = 930 组
//       新⊄旧 = 572 组；旧⊄新 = 1053 组  ⇒ 【任一方向的子集断言也不成立】
//       规范键集 toCanonicalKeyV2 不等 = 0 组  ⇒ 【语义集完全等价，可作判据】
//     故此处改为断言三件：① 存在性等价（对应 PageRenderer.js:722 实际依赖的 >0）
//     ② 规范键集等价（语义层，可反向抓【任一侧漏解】）③ 新 API 自身已排序已去重。
// 🔴 口径声明：两侧均为【内部式】（`*` `/`），实测两侧都不含 `×` `÷`；
//     本判据【禁】做 `÷→/` 任何字符替换来绕过层差，也不得引入展示层 formatExprPretty。
function _parseInnerExpr(s) {
  // 只解析旧 API 输出的【全括号内部式】，例 ((1+11)*(1+1))。
  // AST 节点形状必顷与 js/core/Solver.mjs 一致：{op, args:[l,r]} / {op:'num', value:{num,den}, label}
  let i = 0;
  function P() {
    if (s[i] === '(') {
      i++; const l = P(); const op = s[i++]; const r = P(); i++;
      return { op, args: [l, r] };
    }
    const j = i;
    while (i < s.length && /[0-9]/.test(s[i])) i++;
    const v = parseInt(s.slice(j, i), 10);
    return { op: 'num', value: { num: v, den: 1 }, label: String(v) };
  }
  return P();
}
for (const deck of solvableDecks) {
  const oldSols = Solver.findSolutions(deck); // 字符串数组
  const newSols = findSolutionsWithAST(deck);
  const newExprs = newSols.map(s => s.expr);
  // 已排序（升序）
  let sorted = true;
  for (let i = 1; i < newExprs.length; i++) {
    if (newExprs[i - 1] > newExprs[i]) { sorted = false; break; }
  }
  // 已去重
  const dedup = new Set(newExprs).size === newExprs.length;
  // ① 存在性等价：产品唯一消费点 PageRenderer.js:722 只用 >0
  const existEq = (oldSols.length > 0) === (newExprs.length > 0);
  // ② 规范键集等价（语义层，同层比对：两侧都转成 toCanonicalKeyV2）
  const oldKeys = new Set(oldSols.map(x => toCanonicalKeyV2(_parseInnerExpr(typeof x === 'string' ? x : x.expr))));
  const newKeys = new Set(newSols.map(s => s.key));
  const semEq = oldKeys.size === newKeys.size && [...oldKeys].every(k => newKeys.has(k));
  record(`F-set-eq [${deck.join(',')}]`, sorted && dedup && existEq && semEq,
    `sorted=${sorted}, dedup=${dedup}, existEq=${existEq}, semKeyEq=${semEq}, ` +
    `old=${oldSols.length}(keys=${oldKeys.size}), new=${newExprs.length}(keys=${newKeys.size})`);
}

// ---- Case G: postOrderSteps 中间结果为分数时呈现 a/b（分数不化十进制） ----
{
  // [3,3,8,8]：字典序最小的解应类似 8/(3-8/3) = 24，中间步骤含 8/3
  const deck = [3, 3, 8, 8];
  const withAst = findSolutionsWithAST(deck);
  const steps = postOrderSteps(withAst[0].ast);
  const anyFrac = steps.some(s => /\d+\/\d+/.test(s.result));
  record(`G-fraction [3,3,8,8]`, anyFrac, `steps=${JSON.stringify(steps.map(s => s.result))}`);
}

// ---- Case H: 静态检查：新增区段无 Math.random ----
const solverSrc = fs.readFileSync('js/core/Solver.js', 'utf8');
const gameSrc = fs.readFileSync('js/core/GameCore.js', 'utf8');
// 注：Solver.js 与 Solver.mjs 内容字节相同（Developer 只是复制扩展名以便 Node ESM 加载）
const answerSrc = fs.readFileSync('js/ui/AnswerModal.js', 'utf8');
const hintSrc = fs.readFileSync('js/ui/HintModal.js', 'utf8');

// (a) 全 codebase 新增文件不含 Math.random（只看代码行，跳过 // 开头的注释）
function countRealMathRandom(src) {
  const lines = src.split('\n');
  let cnt = 0;
  for (const line of lines) {
    const stripped = line.replace(/\/\/.*$/, ''); // 行内注释后面坨掋
    if (/Math\.random/.test(stripped)) cnt++;
  }
  return cnt;
}
const mrSolver = countRealMathRandom(solverSrc);
const mrGame = countRealMathRandom(gameSrc);
const mrAnswer = countRealMathRandom(answerSrc);
const mrHint = countRealMathRandom(hintSrc);
record('H-no-Math.random-Solver', mrSolver === 0, `count=${mrSolver}`);
record('H-no-Math.random-GameCore', mrGame === 0, `count=${mrGame}`);
record('H-no-Math.random-AnswerModal', mrAnswer === 0, `count=${mrAnswer}`);
record('H-no-Math.random-HintModal', mrHint === 0, `count=${mrHint}`);

// (b) Date.now 只在 AnswerModal.js（滚动条时间戳）；Solver / GameCore / HintModal 不得出现
const dnSolver = (solverSrc.match(/Date\.now/g) || []).length;
const dnGame = (gameSrc.match(/Date\.now/g) || []).length;
const dnHint = (hintSrc.match(/Date\.now/g) || []).length;
const dnAnswer = (answerSrc.match(/Date\.now/g) || []).length;
record('H-Date.now-not-in-Solver', dnSolver === 0, `count=${dnSolver}`);
record('H-Date.now-not-in-GameCore', dnGame === 0, `count=${dnGame}`);
record('H-Date.now-not-in-HintModal', dnHint === 0, `count=${dnHint}`);
// AnswerModal 允许 Date.now（滚动条），验证只用于滚动区块（不参与选解）
record('H-Date.now-only-in-AnswerModal-scroll', dnAnswer > 0, `count=${dnAnswer}`);
// 更严格：AnswerModal 中所有 Date.now 上下文都不涉及 Solver / hint / choose，仅用于 _lastActiveTs
const risky = /Date\.now/g;
let ok = true;
let m;
while ((m = risky.exec(answerSrc)) !== null) {
  const idx = m.index;
  const ctx = answerSrc.slice(Math.max(0, idx - 60), idx + 60);
  if (!/_lastActiveTs|scroll/i.test(ctx)) { ok = false; break; }
}
record('H-AnswerModal-Date.now-context-scroll-only', ok, 'all Date.now near _lastActiveTs/scroll');

// ---- 总结 ----
console.log('==========');
console.log(`PASS=${passCount}  FAIL=${failCount}  TOTAL=${passCount + failCount}`);
console.log(`OVERALL: ${failCount === 0 ? 'PASS' : 'FAIL'}`);
process.exit(failCount === 0 ? 0 : 1);
