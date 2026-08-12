// tester-v2-regression.mjs
// v2 全量回归 · INPUT-02 / INPUT-03 / INPUT-04-v1 / 保护清单
// 独立采样，不引 worker2 selftest 数据
// 基线：fc3f1cc

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
  toCanonicalKeyV2,
} = S;

let PASS = 0, FAIL = 0;
function check(name, cond, detail = '') {
  console.log(`  ${cond ? '✓' : '✗'} ${name}` + (detail ? ` — ${detail}` : ''));
  cond ? PASS++ : FAIL++;
}

console.log('=== R1: INPUT-02 回归（[3,3,8,8] 唯一解 + 采样） ===');
{
  const sols = findSolutionsWithAST([3, 3, 8, 8]);
  check('R1.1 [3,3,8,8] 归一后仍唯一解', sols.length === 1, `实际 ${sols.length}`);
  const _8 = intToFraction(8), _3 = intToFraction(3);
  const q = divideFractions(_8, subtractFractions(_3, divideFractions(_8, _3)));
  check('R1.2 [3,3,8,8] 解值 = 24', is24(q));

  // 抽样 5 组 solvable
  for (const d of [[3,3,8,8],[1,2,3,4],[5,6,6,7],[1,5,5,5],[4,4,10,10]]) {
    const s = findSolutionsWithAST(d);
    check(`R1.3 ${JSON.stringify(d)} 至少 1 解`, s.length >= 1, `${s.length}`);
  }
  // 2 组 unsolvable
  for (const d of [[1,1,1,1],[1,1,1,2]]) {
    const s = findSolutionsWithAST(d);
    check(`R1.4 ${JSON.stringify(d)} 0 解`, s.length === 0);
  }
}

console.log('\n=== R2: INPUT-03 回归（divideFractions 除零契约） ===');
{
  check('R2.1 divideFractions(8, 0) = null', divideFractions(intToFraction(8), intToFraction(0)) === null);
  check('R2.2 divideFractions(5, 0/1) = null', divideFractions(intToFraction(5), { num: 0, den: 1 }) === null);
  const r = divideFractions(intToFraction(8), intToFraction(2));
  check('R2.3 divideFractions(8, 2) = 4/1', r && r.num === 4 && r.den === 1);
  const zero = subtractFractions(intToFraction(3), intToFraction(3));
  check('R2.4 除零传播 8÷(3-3) = null', divideFractions(intToFraction(8), zero) === null);
}

console.log('\n=== R3: INPUT-04 v1 回归（postOrderSteps + 字典序 + 幂等） ===');
{
  const sols = findSolutionsWithAST([5, 6, 6, 7]);
  const chosen = chooseCanonicalSolution(sols, [5, 6, 6, 7]);
  const steps = postOrderSteps(chosen.ast);
  check('R3.1 postOrderSteps 长度 = 3', steps.length === 3, `实际 ${steps.length}`);
  check('R3.2 步骤 3 最终结果 = 24', steps[2].result === '24' || steps[2].result === 24);
  const c1 = chooseCanonicalSolution(sols, [5, 6, 6, 7]);
  const c2 = chooseCanonicalSolution(sols, [5, 6, 6, 7]);
  check('R3.3 chooseCanonical 幂等', c1.expr === c2.expr);
  const exprs = sols.map(s => s.expr);
  const sorted = [...exprs].sort();
  check('R3.4 findSolutions 输出按 expr 字典序', JSON.stringify(exprs) === JSON.stringify(sorted));
}

console.log('\n=== R4: INPUT-04 bugfix v1 回归（toCanonicalKeyV2 硬约束） ===');
{
  const num = (n) => ({ op: 'num', value: intToFraction(n), label: String(n) });
  const bin = (op, a, b) => ({ op, args: [a, b] });
  // Bug 1 硬约束（v1 已过）
  // 🔴 R4.1（task-131 第 2 批，经理批准改正期望值）：与 bug5-canonicalize.mjs 的 Hard1 同一命题、同一错。
  //   8/(3×3) = 8/9 与 (8/3)/3 = 8/9 **等值** ⇒ 归并同键是正确行为，原 `!==` 把正确行为当成缺陷。
  check('R4.1 a÷(b×c) == (a÷b)÷c（等值式须归并同键）',
    toCanonicalKeyV2(bin('/', num(8), bin('*', num(3), num(3)))) ===
    toCanonicalKeyV2(bin('/', bin('/', num(8), num(3)), num(3))));
  check('R4.2 a-b ≠ b-a',
    toCanonicalKeyV2(bin('-', num(5), num(3))) !==
    toCanonicalKeyV2(bin('-', num(3), num(5))));
  check('R4.3 a÷a 不化简为 1',
    toCanonicalKeyV2(bin('/', num(5), num(5))) !==
    toCanonicalKeyV2(num(1)));
  check('R4.4 a-a 不消元为 0',
    toCanonicalKeyV2(bin('-', num(5), num(5))) !==
    toCanonicalKeyV2(num(0)));
  // Bug 2 硬约束（formatExprPretty）
  check('R4.5 formatExprPretty 最外层不加括号',
    formatExprPretty(bin('+', num(5), num(6))) === '5+6');
  check('R4.6 formatExprPretty a÷(b×c) 保括号',
    formatExprPretty(bin('/', num(8), bin('*', num(3), num(3)))) === '8÷(3×3)');
  // [5,6,6,7] 归一后仍 4 解（Bug 1 v2 未回归）
  const sols = findSolutionsWithAST([5,6,6,7]);
  check('R4.7 [5,6,6,7] Bug 1 v1 归一 = 4 解（v2 归一不影响）', sols.length === 4, `${sols.length}`);
}

console.log('\n=== R5: 保护清单 6 文件 sha256 @ fc3f1cc（独立计算） ===');
// 🔴 task-131 第 2 批（经理裁定：方案 1 + 存在性前置）—— 修跨平台判据缺陷
// 【背景】原 R5 直读工作树字节算 sha256，Windows 端 `core.autocrlf=true` 检出为 CRLF
//   ⇒ 同一入库内容两平台 sha256 必然不同 ⇒ Windows 恒判红（实测：Components.js
//   Linux 51635ff6…判绿 / Windows a1b6af30…判红，而转 LF 后恰为 51635ff6…）。
//   已逐层排除为**判据不可移植**，非冻结区违规（blob 三方一致 = AGENTS 冻结表值，
//   git status 干净），也非本轮引入（原版在 Windows 同样红）。
// 【口径声明】本断言统一采用：**读入后先 CRLF→LF 归一化，再算 sha256**。
//   🔴 不用 `git hash-object` 口径：经理实测它**受 `.git/config` 的 `core.autocrlf` 支配**
//   （false ⇒ c30dea8a…；true/input ⇒ 422c2b7a…），并非恒定口径，只会把风险从「脚本忘
//   归一化」搬到「配置静默生效」，更难发现。本写法**不依赖任何 git 配置**。
// 【不会掩盖异常】归一化本身会掩盖「文件真被写成 CRLF」，故配对 R5b 抓该情形。
const CRLF_FILES = [];   // 🔴 供 R5b 与 D-0 基数使用（跨 block 可见）
{
  const baseline = {
    'js/ui/CardRenderer.js':   '1392807b1eb84ec93432210a2ef8daac86fe98c3a9f6768b9a763c80b96558bb',
    'js/ui/Components.js':     '51635ff68be10e0e26ef606a9aad2d65eea4da9abfd2dbacc9986e1649c9d3bd',
    'js/ui/Background.js':     '70c843fde737ca136d2fe6a22883f7d16ad11267e2e38296e475c68f91971844',
    'js/ui/ButtonRenderer.js': '99f02a7f53997937fdc00c84bb1863a6d5a237af6ab438cebb11d14e89169b56',
    'js/core/Card.js':         '573a0cce9634b5eee3be24813044a415d5c06053a0f075b039487258412deaba',
    'js/utils/Random.js':      'd31a39afe50443dfdf166a9e0ff6880fe41cf5369f15136eb4623d963321dbad',
  };
  for (const [file, expected] of Object.entries(baseline)) {
    const raw = fs.readFileSync(file);
    const rawHash = createHash('sha256').update(raw).digest('hex');
    // CRLF→LF 归一化（仅影响本处取值，不写回文件）
    const normalized = Buffer.from(raw.toString('utf8').split('\r\n').join('\n'), 'utf8');
    const actual = createHash('sha256').update(normalized).digest('hex');
    const isCRLF = normalized.length !== raw.length;
    if (isCRLF) CRLF_FILES.push({ file, rawHash, expected });
    check(`R5 ${file}`, actual === expected,
          `expected=${expected.slice(0,16)}... actual=${actual.slice(0,16)}...` +
          (isCRLF ? ` [已归一化 CRLF→LF，未归一化值=${rawHash.slice(0,16)}...]` : ' [本就是 LF]'));
  }
}

// 🔴 R5b（经理裁定新增）：归一化会掩盖「文件真被写成 CRLF」，此条专抓该情形。
// 口径：**仅当实测到 CRLF 时**断言「未归一化值 != 基线」—— 即确认该文件确实是
// 因换行符而非内容差异导致 raw 不匹配（若未归一化值居然 == 基线，说明基线本身是
// CRLF 口径录的，属口径污染，必顶出）。
// ⚠ 本条为**条件断言** ⇒ 断言总数随平台浮动 ⇒ D-0 基数必用可推导式，禁写死。
const CRLF_SKIPPED = CRLF_FILES.length === 0;
if (CRLF_SKIPPED) {
  console.log(`  ⏸ R5b 未执行：本平台检出均为 LF（6 文件无 CRLF）⇒ 无需验证归一化是否掩盖异常`);
} else {
  for (const { file, rawHash, expected } of CRLF_FILES) {
    check(`R5b ${file} 未归一化值 != 基线（证实差异仅来自换行符）`,
          rawHash !== expected,
          `rawHash=${rawHash.slice(0,16)}... baseline=${expected.slice(0,16)}...`);
  }
}

console.log('\n=== R6: [3,3,8,8] pretty 显示（可选观察） ===');
{
  const sols = findSolutionsWithAST([3, 3, 8, 8]);
  const p = formatExprPretty(sols[0].ast);
  console.log(`   [3,3,8,8] 唯一解 pretty = "${p}"`);
  check('R6.1 pretty 非空', p && p.length > 0);
}

console.log('\n=========================================');
// 🔴 D-0（task-131）：断言总数自断言 —— 防「断言静默丢失/未执行而全绿」
// 基数**实测取值，禁数源码**：源码仅 21 处 `check(` 但实跑 31 条 —— 差额全部来自三处循环：
//   · :39  R1.3  5 组牌型量（[3,3,8,8] 等）  ⇒ +5（占 1 处源码）
//   · :44  R1.4  2 组无解牌型               ⇒ +2（占 1 处源码）
//   · :114 R5    6 个冻结区文件 sha256      ⇒ +6（占 1 处源码）
// ⇒ 21 - 3（三处循环源码行）+ 5 + 2 + 6 = 31。不写裸 31，用可推导算式：
// 🔴 R5b 为**条件断言**（仅 CRLF 平台执行，每个 CRLF 文件 1 条）⇒ 总数随平台浮动：
//   · Linux（均 LF）    ⇒ CRLF_FILES.length=0 ⇒ 31 + 0 = 31
//   · Windows（autocrlf）⇒ CRLF_FILES.length=6 ⇒ 31 + 6 = 37
//   ⇒ 用 CRLF_FILES.length 实测值参与计算，**禁写死任何平台的裸数字**。
const LOOP_R1_3 = 5, LOOP_R1_4 = 2, LOOP_R5 = 6;   // 各循环实际迭代次数（与上方字面量一致）
const EXPECTED_ASSERTION_COUNT =
  18 + LOOP_R1_3 + LOOP_R1_4 + LOOP_R5 + CRLF_FILES.length;
const _total = PASS + FAIL;
if (_total !== EXPECTED_ASSERTION_COUNT) {
  console.log(`  ✗ D-0 断言总数自断言 — 实测总数=${_total} 期望=${EXPECTED_ASSERTION_COUNT}`);
  FAIL++;
} else {
  console.log(`  ✓ D-0 断言总数自断言 — 实测总数=${_total} 期望=${EXPECTED_ASSERTION_COUNT}`);
}
console.log(`REGRESSION TOTAL: pass=${PASS} fail=${FAIL}`);
console.log(`OVERALL: ${FAIL === 0 ? 'PASS ✅' : 'FAIL ❌'}`);
console.log('=========================================');
if (FAIL > 0) process.exit(1);
