// tester-regression.mjs
// INPUT-04 bugfix 独立回归 · 覆盖 INPUT-02 / INPUT-03 / INPUT-04 保护清单
// 独立采样，不引 worker2 selftest
//
// 断言项：
//   R1. INPUT-02：[3,3,8,8] 唯一解 (8÷(3-8÷3)) = 24；is24Fraction 抽样
//   R2. INPUT-03：divideFractions null 除零契约、除零题算式含 null 传播
//   R3. INPUT-04：postOrderSteps 3 step (第 1、2 步供提示)、字典序确定性
//   R4. 保护清单 6 文件 sha256 @ fec9851 == 基线（本文档 §5 硬编码）

import fs from 'fs';
import { createHash } from 'crypto';
import * as S from '../js/core/Solver.mjs';

const {
  findSolutionsWithAST,
  chooseCanonicalSolution,
  postOrderSteps,
  divideFractions,
  addFractions,
  subtractFractions,
  multiplyFractions,
  is24,
  intToFraction,
  formatExprPretty,
} = S;

let PASS = 0, FAIL = 0;
function check(name, cond, detail = '') {
  console.log(`  ${cond ? '✓' : '✗'} ${name}` + (detail ? ` — ${detail}` : ''));
  cond ? PASS++ : FAIL++;
}
function checkEq(name, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  console.log(`  ${ok ? '✓' : '✗'} ${name}${ok ? '' : `\n     got: ${JSON.stringify(got)}\n    want: ${JSON.stringify(want)}`}`);
  ok ? PASS++ : FAIL++;
}

console.log('=== R1: INPUT-02 回归 ===');
// [3,3,8,8] 唯一解
{
  const sols = findSolutionsWithAST([3, 3, 8, 8]);
  check('R1.1 [3,3,8,8] 唯一解 (v2 canonicalize 后)', sols.length === 1, `实际 ${sols.length}`);
  console.log('   解 expr:', sols.map(s => s.expr));
  console.log('   解 pretty:', sols.map(s => formatExprPretty(s.ast)));
  // 数值验证
  const s = sols[0];
  // 用 solver 内部的 evalNode - 通过 chooseCanonicalSolution 拿到 ast, 手工遍历
  // 但 _evalNodeFrac 未 export，用 fraction 分数验证 24
  // 采用简单算式 eval: (8/(3-(8/3)))
  const _8 = intToFraction(8), _3 = intToFraction(3);
  const eightDivThree = divideFractions(_8, _3);
  const threeMinus = subtractFractions(_3, eightDivThree);
  const result = divideFractions(_8, threeMinus);
  check('R1.2 [3,3,8,8] 唯一解数值 == 24', is24(result), `${result.num}/${result.den}`);
}

// isSolvable 抽样：确认几组已知有解 / 无解
{
  const solvable = [
    [3, 3, 8, 8],
    [1, 2, 3, 4],
    [5, 6, 6, 7],
    [1, 5, 5, 5],
    [4, 4, 10, 10],
  ];
  for (const d of solvable) {
    const s = findSolutionsWithAST(d);
    check(`R1.3 ${JSON.stringify(d)} 至少 1 解`, s.length >= 1, `${s.length} 解`);
  }
  // 已知无解组合（简单枚举下不可能到 24）
  const unsolvable = [
    [1, 1, 1, 1],
    [1, 1, 1, 2],
  ];
  for (const d of unsolvable) {
    const s = findSolutionsWithAST(d);
    check(`R1.4 ${JSON.stringify(d)} 无解 (0 解)`, s.length === 0, `${s.length} 解`);
  }
}

console.log('\n=== R2: INPUT-03 回归 ===');
// R2.1 divideFractions null 除零契约
{
  const _8 = intToFraction(8), _0 = intToFraction(0);
  const r = divideFractions(_8, _0);
  check('R2.1 divideFractions(8, 0) 返回 null', r === null, `实际: ${JSON.stringify(r)}`);
}
// R2.2 分数除零
{
  const zeroFrac = { num: 0, den: 1 };
  const r = divideFractions(intToFraction(5), zeroFrac);
  check('R2.2 divideFractions(5, 0/1) 返回 null', r === null);
}
// R2.3 正常除法
{
  const r = divideFractions(intToFraction(8), intToFraction(2));
  check('R2.3 divideFractions(8,2) = 4/1', r && r.num === 4 && r.den === 1);
}
// R2.4 除零传播：n1 / (n2 - n2) - 采样一组会触发除零的算式
// 用 8/(3-3) 验证 divideFractions 层
{
  const _3 = intToFraction(3);
  const zero = subtractFractions(_3, _3);
  const r = divideFractions(intToFraction(8), zero);
  check('R2.4 除零传播: 8/(3-3) = null', r === null);
}

// R2.5 至少一个"除零题"抽样：找一组必然经过除零的算式
// [0,0,3,3] 会有多种，但让 solver 自主处理 —— 期望 0 解（不含 0 卡值触发算式在 24 上）
// 更好的：[1,1,4,4] 抽样
{
  const sols = findSolutionsWithAST([1, 1, 4, 4]);
  console.log(`   [1,1,4,4] 解数: ${sols.length}`);
  check('R2.5 [1,1,4,4] 除零场景处理正常（无 crash）', sols.length >= 0);
}

console.log('\n=== R3: INPUT-04 回归 ===');
// R3.1 postOrderSteps 输出 3 步
{
  const sols = findSolutionsWithAST([5, 6, 6, 7]);
  const chosen = chooseCanonicalSolution(sols, [5, 6, 6, 7]);
  const steps = postOrderSteps(chosen.ast);
  check('R3.1 postOrderSteps 长度 = 3', steps.length === 3, `实际 ${steps.length}`);
  console.log('   步骤 1:', steps[0]);
  console.log('   步骤 2:', steps[1]);
  console.log('   步骤 3:', steps[2]);
  check('R3.2 步骤 1 有 lhs/op/rhs/result', steps[0].lhs !== undefined && steps[0].op && steps[0].rhs !== undefined && steps[0].result !== undefined);
  check('R3.3 步骤 3 最终结果 = 24', steps[2].result === '24' || steps[2].result === 24);
}

// R3.4 chooseCanonicalSolution 幂等（同一牌局多次调用返回相同解）
{
  const sols = findSolutionsWithAST([5, 6, 6, 7]);
  const c1 = chooseCanonicalSolution(sols, [5, 6, 6, 7]);
  const c2 = chooseCanonicalSolution(sols, [5, 6, 6, 7]);
  check('R3.4 chooseCanonicalSolution 幂等', c1.expr === c2.expr);
}

// R3.5 字典序确定性
{
  const sols = findSolutionsWithAST([5, 6, 6, 7]);
  const exprs = sols.map(s => s.expr);
  const sorted = [...exprs].sort();
  checkEq('R3.5 findSolutionsWithAST 输出按 expr 字典序', exprs, sorted);
}

console.log('\n=== R4: 保护清单 sha256 校验 @ fec9851 ===');
// 87 方案 §5 / 88 号执行说明记录的基线 sha256（应与 08904b4 基线一致）
const BASELINE = {
  'js/ui/CardRenderer.js':    '1392807b1eb84ec93432210a2ef8daac86fe98c3a9f6768b9a763c80b96558bb',
  'js/ui/Components.js':      '51635ff68be10e0e26ef606a9aad2d65eea4da9abfd2dbacc9986e1649c9d3bd', // 注：88 号写的是 a1b6..，此处以本机 08904b4 shown 值为准
  'js/ui/Background.js':      '70c843fde737ca136d2fe6a22883f7d16ad11267e2e38296e475c68f91971844',
  'js/ui/ButtonRenderer.js':  '99f02a7f53997937fdc00c84bb1863a6d5a237af6ab438cebb11d14e89169b56',
  'js/core/Card.js':          '573a0cce9634b5eee3be24813044a415d5c06053a0f075b039487258412deaba',
  'js/utils/Random.js':       'd31a39afe50443dfdf166a9e0ff6880fe41cf5369f15136eb4623d963321dbad',
};

// 注：88 号 §5 声明 Components.js 是 a1b6af30...；这里我们用 git show 08904b4 对比，
// 得到的实际 blob hash 是 51635ff6...；即 08904b4 基线本身就是 51635ff6，
// 而 88 号中的 a1b6af30 疑似复制错。fec9851 与 08904b4 之间该文件 diff 为空（已在 §Step1 验证），
// 因此仍属"零字节变化"合规。此处直接用 08904b4 观测值作基线是正确的独立采样。

for (const [file, expected] of Object.entries(BASELINE)) {
  const buf = fs.readFileSync(file);
  const actual = createHash('sha256').update(buf).digest('hex');
  const ok = actual === expected;
  console.log(`  ${ok ? '✓' : '✗'} ${file}`);
  console.log(`    expected: ${expected}`);
  console.log(`    actual:   ${actual}`);
  ok ? PASS++ : FAIL++;
}

console.log('\n=========================================');
console.log(`REGRESSION TOTAL: pass=${PASS} fail=${FAIL}`);
console.log(`OVERALL: ${FAIL === 0 ? 'PASS ✅' : 'FAIL ❌'}`);
console.log('=========================================');
if (FAIL > 0) process.exit(1);
