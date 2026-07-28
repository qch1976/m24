// tester-close-solver-sample.mjs
// Tester 独立采样：INPUT-04 收尾 —— 26 组牌局验证 Solver ×/÷ 去重（对齐 276b824 语义）
// 断言（独立采样，不复用 Developer/Manager 数据）：
//   1. findSolutionsWithAST 返回的每个解的 canonicalKey 全局唯一（无重复算式泄漏）
//   2. hasSolution 与 findSolutionsWithAST.length>0 完全一致
//   3. formatExprPretty 结果字符串两两不相等（可显示层面也无重复）
//   4. 每个解自身可计算得 24（value == 24）
//   5. 与 276b824 关键 GCD 等价类断言 3 条（8÷2 ≡ 4×1 等）

import Solver, {
  findSolutionsWithAST,
  toCanonicalKeyV2,
  formatExprPretty,
  addFractions,
  subtractFractions,
  multiplyFractions,
  divideFractions,
  is24,
} from '../js/core/Solver.mjs';

// —— 独立编写的 AST evaluator（Tester 自写，不复用 Solver 内部 _evaluateTokens）—— 
function evalAst(node) {
  if (node.op === 'num') return node.value; // {num,den}
  const a = evalAst(node.args[0]);
  const b = evalAst(node.args[1]);
  switch (node.op) {
    case '+': return addFractions(a, b);
    case '-': return subtractFractions(a, b);
    case '*': return multiplyFractions(a, b);
    case '/': {
      if (b.num === 0) throw new Error('div_by_zero');
      return divideFractions(a, b);
    }
    default: throw new Error('unknown_op:' + node.op);
  }
}

// —— 26 副牌，覆盖单解/多解/无解/含 0/含大牌/边界 —— 
// 独立选取（不与 Developer/Architect 采样重复），来源：Tester 自选组合池
const decks = [
  { name: 'D01 [1,2,3,4]',   cards: [1, 2, 3, 4] },
  { name: 'D02 [3,3,8,8]',   cards: [3, 3, 8, 8] },   // 经典 8/(3-8/3)
  { name: 'D03 [4,4,10,10]', cards: [4, 4, 10, 10] },
  { name: 'D04 [5,5,5,5]',   cards: [5, 5, 5, 5] },    // 5×5-5/5
  { name: 'D05 [1,3,7,7]',   cards: [1, 3, 7, 7] },
  { name: 'D06 [2,3,7,7]',   cards: [2, 3, 7, 7] },
  { name: 'D07 [3,5,7,13]',  cards: [3, 5, 7, 13] },
  { name: 'D08 [6,6,6,6]',   cards: [6, 6, 6, 6] },
  { name: 'D09 [2,4,6,12]',  cards: [2, 4, 6, 12] },   // 多解
  { name: 'D10 [3,5,6,8]',   cards: [3, 5, 6, 8] },    // Architect T-05.7 = 4
  { name: 'D11 [1,2,8,8]',   cards: [1, 2, 8, 8] },    // 报告 T-04 = 4
  { name: 'D12 [1,3,3,5]',   cards: [1, 3, 3, 5] },    // 报告 T-05 = 4
  { name: 'D13 [2,2,4,8]',   cards: [2, 2, 4, 8] },    // 富多解
  { name: 'D14 [4,6,10,10]', cards: [4, 6, 10, 10] },
  { name: 'D15 [1,1,11,11]', cards: [1, 1, 11, 11] },  // 12+12
  { name: 'D16 [7,7,3,3]',   cards: [7, 7, 3, 3] },    // 7×3+3/7? need check
  { name: 'D17 [2,3,5,12]',  cards: [2, 3, 5, 12] },
  { name: 'D18 [1,5,11,13]', cards: [1, 5, 11, 13] },
  { name: 'D19 [3,4,6,10]',  cards: [3, 4, 6, 10] },
  { name: 'D20 [2,7,11,13]', cards: [2, 7, 11, 13] },  // 报告 T-10 之一：不可解
  { name: 'D21 [9,9,9,9]',   cards: [9, 9, 9, 9] },
  { name: 'D22 [1,4,5,6]',   cards: [1, 4, 5, 6] },
  { name: 'D23 [2,2,10,10]', cards: [2, 2, 10, 10] },
  { name: 'D24 [4,5,10,12]', cards: [4, 5, 10, 12] },
  { name: 'D25 [3,3,7,13]',  cards: [3, 3, 7, 13] },
  { name: 'D26 [1,1,4,6]',   cards: [1, 1, 4, 6] },
];

const results = [];
let totalCases = 0;
let passCases = 0;

console.log('============ 26 副牌独立采样 ============');
console.log('deck | hasSol | count | unique_keys | unique_pretty | value_ok');
console.log('-----|--------|-------|-------------|---------------|---------');

for (const deck of decks) {
  const has = Solver.hasSolution(deck.cards);
  const sols = findSolutionsWithAST(deck.cards);
  const keys = sols.map(s => toCanonicalKeyV2(s.ast));
  const prettys = sols.map(s => formatExprPretty(s.ast));
  const uniqueKeys = new Set(keys);
  const uniquePrettys = new Set(prettys);
  // value 校验：对每个解调用 evaluate 逻辑（Solver.mjs 未暴露 evaluate；直接用是否算得 24 判断 expr 的值≈24）
  // 由 findSolutionsWithAST 内部只返回 value==24 的解，此处仅检查算式字串含 =24
  const allValue24 = sols.every(s => {
    try { return is24(evalAst(s.ast)); } catch { return false; }
  });
  const allExprHave24 = allValue24;

  const boolMatch = has === (sols.length > 0);
  const keysUnique = uniqueKeys.size === sols.length;
  const prettysUnique = uniquePrettys.size === sols.length;
  const pass = boolMatch && keysUnique && prettysUnique && allExprHave24;

  totalCases += 1;
  if (pass) passCases += 1;
  results.push({ name: deck.name, has, count: sols.length, uniqueKeys: uniqueKeys.size, uniquePrettys: uniquePrettys.size, allExprHave24, pass, prettys });
  console.log(`${deck.name.padEnd(20)} | ${String(has).padEnd(6)} | ${String(sols.length).padEnd(5)} | ${String(uniqueKeys.size).padEnd(11)} | ${String(uniquePrettys.size).padEnd(13)} | ${allExprHave24 ? 'yes' : 'NO'} | ${pass ? 'PASS' : 'FAIL'}`);
  // 前 3 副打印算式明细，便于人工核对
  if (['D01 [1,2,3,4]', 'D03 [4,4,10,10]', 'D10 [3,5,6,8]'].includes(deck.name)) {
    prettys.slice(0, 8).forEach((p, i) => console.log(`   [${deck.name} #${i + 1}] ${p} = 24`));
  }
}

console.log('\n============ 276b824 GCD 语义等价类断言 ============');
// 独立复算 3 条硬断言（与 Developer 100 号 selftest 用例独立编写）
function n(v) { return { op: 'num', value: { num: v, den: 1 }, label: String(v) }; }
function bin(op, l, r) { return { op, args: [l, r] }; }

// A1: 8÷2 ≡ 4×1（GCD 约简进入同一等价类）
const kA = toCanonicalKeyV2(bin('/', n(8), n(2)));
const kB = toCanonicalKeyV2(bin('*', n(4), n(1)));
console.log(`A1 8/2 key: ${kA}`);
console.log(`A1 4*1 key: ${kB}`);
console.log(`A1 ${kA === kB ? 'PASS' : 'FAIL'} 8÷2 === 4×1`);

// A2: 6÷2 !== 3（GCD 不越界到叶子）
const kC = toCanonicalKeyV2(bin('/', n(6), n(2)));
const kD = toCanonicalKeyV2(n(3));
console.log(`A2 6/2 key: ${kC}`);
console.log(`A2 3   key: ${kD}`);
console.log(`A2 ${kC !== kD ? 'PASS' : 'FAIL'} 6÷2 !== 3 (硬约束保留)`);

// A3: a÷(b÷c) 保括号，即 pretty 字串不同于 a÷b÷c
const s1 = formatExprPretty(bin('/', n(24), bin('/', n(6), n(3))));
const s2 = formatExprPretty(bin('/', bin('/', n(24), n(6)), n(3)));
console.log(`A3 24÷(6÷3): ${s1}`);
console.log(`A3 24÷6÷3  : ${s2}`);
console.log(`A3 ${s1 !== s2 ? 'PASS' : 'FAIL'} a÷(b÷c) 保括号 (硬约束保留)`);

const hardOK = (kA === kB) && (kC !== kD) && (s1 !== s2);

console.log('\n============ SUMMARY ============');
console.log(`decks total=${totalCases}  pass=${passCases}  fail=${totalCases - passCases}`);
console.log(`GCD hard-asserts: A1 ${kA === kB ? 'PASS' : 'FAIL'} / A2 ${kC !== kD ? 'PASS' : 'FAIL'} / A3 ${s1 !== s2 ? 'PASS' : 'FAIL'}`);
const overallOK = (passCases === totalCases) && hardOK;
console.log(`OVERALL: ${overallOK ? 'PASS' : 'FAIL'}`);
process.exit(overallOK ? 0 : 1);
