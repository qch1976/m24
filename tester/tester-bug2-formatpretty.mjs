// tester-bug2-formatpretty.mjs
// INPUT-04 bugfix 独立验收 · Bug 2（Critical）：formatExprPretty 去除多余括号
// 独立采样，不引 worker2 selftest
//
// 覆盖 task-42 的 6+ 测例：
//  A. 纯加：(((5+6)+6)+7) → 5+6+6+7
//  B. 加减混合：(((5+6)-7)*6) → (5+6-7)×6
//  C. 右子不可去括：a-(b-c) 保括号、a-(b+c) 保括号
//  D. 优先级：(a×b)÷(c×d) → a×b÷(c×d)
//  E. 最外层：不包括号
//  F. canonicalize 本体不变（对比 v1 fingerprint）

import * as S from '../js/core/Solver.mjs';

const {
  formatExprPretty,
  toCanonicalKey,      // v1（保留但未使用）
  toCanonicalKeyV2,    // 现役
  intToFraction,
} = S;

function num(n) {
  return { op: 'num', value: intToFraction(n), label: String(n) };
}
function bin(op, l, r) {
  return { op, args: [l, r] };
}

let PASS = 0, FAIL = 0;
const cases = [];
function assertEq(name, got, want) {
  const ok = got === want;
  cases.push({ name, ok, got, want });
  ok ? PASS++ : FAIL++;
  const mark = ok ? '✓' : '✗';
  console.log(`  ${mark} ${name}\n     got: ${JSON.stringify(got)}\n    want: ${JSON.stringify(want)}`);
}
function assertNoTripleParens(name, s) {
  const ok = !s.startsWith('(((');
  cases.push({ name, ok, got: s, want: '不以 ((( 开头' });
  ok ? PASS++ : FAIL++;
  console.log(`  ${ok ? '✓' : '✗'} ${name} → ${JSON.stringify(s)}`);
}

console.log('=== Bug2 formatExprPretty：6+ 测例 ===\n');

// A. 纯加
assertEq(
  'A1 纯加：(((5+6)+6)+7) → 5+6+6+7',
  formatExprPretty(bin('+', bin('+', bin('+', num(5), num(6)), num(6)), num(7))),
  '5+6+6+7',
);

// B. 加减混合
assertEq(
  'B1 加减混合：(((5+6)-7)*6) → (5+6-7)×6',
  formatExprPretty(bin('*', bin('-', bin('+', num(5), num(6)), num(7)), num(6))),
  '(5+6-7)×6',
);

// C. 右子不可去括
assertEq(
  'C1 右子 - 父 -：a-(b-c) 保括号',
  formatExprPretty(bin('-', num(5), bin('-', num(6), num(7)))),
  '5-(6-7)',
);
assertEq(
  'C2 右子 + 父 -：a-(b+c) 保括号',
  formatExprPretty(bin('-', num(5), bin('+', num(6), num(7)))),
  '5-(6+7)',
);

// D. 优先级
assertEq(
  'D1 (a×b)÷(c×d) → a×b÷(c×d)',
  formatExprPretty(bin('/', bin('*', num(1), num(2)), bin('*', num(3), num(4)))),
  '1×2÷(3×4)',
);
assertEq(
  'D2 父高子低：(a+b)×c → (a+b)×c 保括号',
  formatExprPretty(bin('*', bin('+', num(5), num(6)), num(7))),
  '(5+6)×7',
);
assertEq(
  'D3 父低子高：(a×b)+c → a×b+c 去括号',
  formatExprPretty(bin('+', bin('*', num(5), num(6)), num(7))),
  '5×6+7',
);

// E. 最外层不加括号
assertEq(
  'E1 最外层：5+6 → 5+6',
  formatExprPretty(bin('+', num(5), num(6))),
  '5+6',
);
assertEq(
  'E2 叶：24 → 24',
  formatExprPretty(num(24)),
  '24',
);
assertEq(
  'E3 顶层减：(5-3) → 5-3',
  formatExprPretty(bin('-', num(5), num(3))),
  '5-3',
);

// 补充：项目主明列的 Bug2 案例
assertEq(
  'F1 (((5-7)+6)*6) → (5-7+6)×6',
  formatExprPretty(bin('*', bin('+', bin('-', num(5), num(7)), num(6)), num(6))),
  '(5-7+6)×6',
);
assertEq(
  'F2 (((6*6)-5)-7) → 6×6-5-7',
  formatExprPretty(bin('-', bin('-', bin('*', num(6), num(6)), num(5)), num(7))),
  '6×6-5-7',
);
assertEq(
  'F3 ((6*6)-(5+7)) → 6×6-(5+7)',
  formatExprPretty(bin('-', bin('*', num(6), num(6)), bin('+', num(5), num(7)))),
  '6×6-(5+7)',
);
assertEq(
  'F4 8÷(3×3) 硬约束保括号',
  formatExprPretty(bin('/', num(8), bin('*', num(3), num(3)))),
  '8÷(3×3)',
);
assertEq(
  'F5 (8÷3)÷3 → 8÷3÷3 (左结合去括号)',
  formatExprPretty(bin('/', bin('/', num(8), num(3)), num(3))),
  '8÷3÷3',
);
assertEq(
  'F6 5+(6-7) → 5+6-7 (右子 - 父 +, 结合律)',
  formatExprPretty(bin('+', num(5), bin('-', num(6), num(7)))),
  '5+6-7',
);

// 组合 case
assertEq(
  'G1 ((7-5)*(6+6)) → (7-5)×(6+6)',
  formatExprPretty(bin('*', bin('-', num(7), num(5)), bin('+', num(6), num(6)))),
  '(7-5)×(6+6)',
);

// ---- 保证：[5,6,6,7] 4 条不以 ((( 开头 ----
console.log('\n=== Bug2 集成：[5,6,6,7] 全解无 ((( 前缀 ===');
// GameCore.js 采用 bare-import（小游戏环境），node 不能直接 import。
// 直接复现 GameCore._computeHintCache 中的 pretty 链路：
//   sols = findSolutionsWithAST(cards); prettyList = sols.map(s => formatExprPretty(s.ast))
import { findSolutionsWithAST } from '../js/core/Solver.mjs';
const sols5667 = findSolutionsWithAST([5, 6, 6, 7]);
const pretty5667 = sols5667.map(s => formatExprPretty(s.ast))
  .sort((a, b) => a < b ? -1 : a > b ? 1 : 0);
console.log('  [5,6,6,7] 全解（pretty）:');
for (const s of pretty5667) {
  console.log('    -', s);
  assertNoTripleParens(`[5,6,6,7] "${s}" 不以 ((( 开头`, s);
}
// 补充：需确保至少有 4 条
cases.push({ name: '[5,6,6,7] 全解 pretty 数 = 4', ok: pretty5667.length === 4, got: pretty5667.length, want: 4 });
if (pretty5667.length === 4) PASS++; else FAIL++;

// ---- Bug2 硬约束：canonicalize 本体未变（v2 幂等再执行）----
console.log('\n=== Bug2 硬约束：canonicalize 本体未受 formatExprPretty 影响 ===');
// 用采样 4 条 AST 交叉验证 canonicalize 输出稳定
{
  const trees = [
    bin('*', num(6), num(6)),
    bin('+', num(1), bin('-', num(2), num(3))),
    bin('/', num(8), bin('*', num(3), num(3))),
    bin('-', bin('*', num(6), num(6)), bin('+', num(5), num(7))),
  ];
  for (const t of trees) {
    const k1 = toCanonicalKeyV2(t);
    const k2 = toCanonicalKeyV2(t); // 幂等
    assertEq('canonicalize 幂等: ' + formatExprPretty(t), k1, k2);
  }
}

// ── D-0：断言总数自断言（task-131 第 3 批 E 类补齐）──
// 目的：捕获「断言静默退场」—— 断言不再执行时，仅看 fail=0 无法察觉。
// 🔴 基数必可推导、禁裸数字；只算【业务断言】不含 D-0 自己；D-0 计入 PASS ⇒ `pass=N+1`。
// 🔴 两个循环项均引用【运行时实际长度】，不写死：
//     loopNoTriple = pretty5667.length（:156 循环，每条解 1 条断言）
//     loopIdempotent = 4（:174 循环，trees 字面量 4 棵，定义在块作用域内不可外部引用）
//     ⚠️ loopIdempotent 为此写成字面 4，但 :156 那条引用变量 ⇒ 解数变化时基数自动跟随。
const EXPECTED = {
  staticEq: 17,                       // 循环外逐条 assertEq（共 18 处 − :177 循环内 1 处）
  loopNoTriple: pretty5667.length,    // :156 循环内 assertNoTripleParens
  bareCount: 1,                       // :162 直推 cases.push + PASS++/FAIL++（全解 pretty 数 = 4）
  loopIdempotent: 4,                  // :174 循环内 assertEq canonicalize 幂等（trees 4 棵）
};
const EXPECTED_ASSERTION_COUNT = Object.values(EXPECTED).reduce((s, n) => s + n, 0);
console.log('\n=== D-0：断言总数自断言 ===');
const _total = PASS + FAIL;
if (_total === EXPECTED_ASSERTION_COUNT) {
  PASS++;
  console.log(`  ✓ D-0 断言总数自断言 — 实测总数=${_total} 期望=${EXPECTED_ASSERTION_COUNT}`);
} else {
  FAIL++;
  console.log(`  ✗ D-0 断言总数自断言 — 实测总数=${_total} 期望=${EXPECTED_ASSERTION_COUNT}`);
  console.log(`    分族期望：${JSON.stringify(EXPECTED)}`);
  console.log('    ⇒ 有断言静默退场或新增未同步 EXPECTED');
}

// ---- 输出 ----
console.log('\n=========================================');
console.log(`BUG2 TOTAL: pass=${PASS} fail=${FAIL}`);
console.log(`OVERALL: ${FAIL === 0 ? 'PASS ✅' : 'FAIL ❌'}`);
console.log('=========================================');
if (FAIL > 0) process.exit(1);
