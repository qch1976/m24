// selftest_input06_dedup.mjs — task-68 去重口径实现自验
// 依据：171-INPUT06-去重口径规范-定稿.md §5（双向判据）+ §6（基准）+ §10（16 项清单）
//
// ⚠️ 方法论（规范 L240，Manager 明确约束）：
//   不得仅用「两个独立实现得同一数字」作为正确性依据。若两实现共享同一盲点
//   （如都未归一 multiset、都未消恒等元），会同时错到同一值。
//   ⇒ 故本脚本以【不依赖任何归约实现】的判据为主：
//      · 正向：人工构造数学恒等变体 → 独立 Fraction 求值确认同值 → 断言键唯一
//      · 反向：结构相异 → 断言键必异（防过度合并）
//   基准数值比对仅作为**附加**确认，不作为主判据。

import {
  solve, keySol, reduceToFixpoint, evalNode, countRecip,
  numLeaf, recipLeaf, F, is24F, MAX_ITER, ONE_NODE, ZERO_NODE,
} from '../js/core/RecipSolver.mjs';

let pass = 0, fail = 0;
const ck = (name, cond, detail = '') => {
  if (cond) { pass++; console.log(`  ok  ${name}${detail ? '   ' + detail : ''}`); }
  else { fail++; console.log(`  XX  ${name}   ${detail}`); }
};

// ---- 表达式构造 DSL（独立于 solver 内部枚举）----
const n = (c) => numLeaf(c, 0);
const r = (c) => recipLeaf(c, 0);
const op = (o) => (a, b) => ({ op: o, a, b });
const [add, sub, mul, div] = ['+', '-', '*', '/'].map(op);
const K = (t) => keySol(reduceToFixpoint(t).node);

// 独立求值：不复用 solver 的 dfs 中间值（规范「禁 solver 自证」）
const val = (t) => { const v = evalNode(t); return v === null ? null : `${v.n}/${v.d}`; };

console.log('=== task-68 去重口径实现自验（规范 §5 双向判据）===\n');

// ============================================================
// 【组1】正向判据：等价类内键唯一（防过度分裂）—— 规范 §5 共 12 组
// 每组先用独立 Fraction 求值证明数学恒等，再断言键唯一。
// ============================================================
console.log('[组1] 正向判据：数学恒等 ⇒ 键必唯一（防过度分裂）');
const FWD = [
  ['1  乘1恒等 (1*2)/X vs 2/X',
    [div(mul(n(1), n(2)), n(3)), div(n(2), n(3)), div(mul(n(2), n(1)), n(3))]],
  ['2  结合律 (2*3)*4 vs 2*(3*4)',
    [mul(mul(n(2), n(3)), n(4)), mul(n(2), mul(n(3), n(4)))]],
  ['3  交换律 3*8 vs 8*3',
    [mul(n(3), n(8)), mul(n(8), n(3))]],
  ['4  除法链序 24/3/4 vs 24/4/3',
    [div(div(n(12), n(3)), n(4)), div(div(n(12), n(4)), n(3))]],
  ['5  倒数形态 (1/5)/1 vs 1/5',
    [div(r(5), n(1)), r(5)]],
  ['6  多层括号 3*8 vs (1*3)*8',
    [mul(n(3), n(8)), mul(mul(n(1), n(3)), n(8))]],
  ['7  空分子多分母 (1/3)/4 vs (1/4)/3 vs (1/3)*(1/4)',
    [div(r(3), n(4)), div(r(4), n(3)), mul(r(3), r(4))]],
  ['8  加减链抵消 12/(((1/2)+3)-3) vs 12/(1/2) vs 12*2',
    [div(n(12), sub(add(r(2), n(3)), n(3))), div(n(12), r(2)), mul(n(12), n(2))]],
  ['9  加法交换 (8+8)+8 vs 8+(8+8)',
    [add(add(n(8), n(8)), n(8)), add(n(8), add(n(8), n(8)))]],
  ['10 减法同项 (24+5)-5 vs 24',
    [sub(add(n(12), n(5)), n(5)), n(12)]],
  ['11 加0恒等 24+(3-3) vs 24',
    [add(n(12), sub(n(3), n(3))), n(12)]],
  ['12 减法分配 (1-1/2)-1/3 vs 1-(1/2+1/3)',
    [sub(sub(n(1), r(2)), r(3)), sub(n(1), add(r(2), r(3)))]],
];
for (const [name, variants] of FWD) {
  // 前提校验：这些变体必须**数学上真的同值**，否则判据本身立错了
  const vals = variants.map(val);
  const sameVal = new Set(vals).size === 1 && vals[0] !== null;
  if (!sameVal) { ck(name, false, `前提失败：变体不同值 ${vals.join(' | ')}`); continue; }
  const keys = new Set(variants.map(K));
  ck(name, keys.size === 1, `值=${vals[0]} 键数=${keys.size} ${keys.size > 1 ? [...keys].join(' ≠ ') : '✓'}`);
}

// ============================================================
// 【组2】反向判据：结构相异键必异（防过度合并）—— 规范 §5 共 7 组
// 这是防「归约过猛把不同解合成一条」的唯一保险。
// ============================================================
console.log('\n[组2] 反向判据：结构相异 ⇒ 键必异（防过度合并）');
const NEG = [
  ['1  不同结构同值24 4*6 vs 20+4', mul(n(4), n(6)), add(n(20), n(4))],
  ['2  减法非交换 8-3 vs 3-8', sub(n(8), n(3)), sub(n(3), n(8))],
  ['3  除法非交换 8/4 vs 4/8', div(n(8), n(4)), div(n(4), n(8))],
  ['4  真不同倒数解 2/(1/3-1/4) vs 4/(1/2-1/3)',
    div(n(2), sub(r(3), r(4))), div(n(4), sub(r(2), r(3)))],
  ['5  同数不同牌 3*8 vs 4*6', mul(n(3), n(8)), mul(n(4), n(6))],
  ['6  减数顺序非恒等 (9-2)-1 vs 9-(2-1)',
    sub(sub(n(9), n(2)), n(1)), sub(n(9), sub(n(2), n(1)))],
  ['7  除数vs乘数 24/(2*3) vs (24/2)*3',
    div(n(12), mul(n(2), n(3))), mul(div(n(12), n(2)), n(3))],
];
for (const [name, a, b] of NEG) {
  ck(name, K(a) !== K(b), `${K(a)} vs ${K(b)}`);
}

// ================================================================
// R5 抵消的【结构级】断言 —— 不依赖变异测试
//
// 背景：task-69 Tester 与我**独立**发现同一事实：R5 的 `if (net===0) continue`
//   是**等价冗余**（后续 `Math.abs(0)===0` 使循环执行 0 次），单点变异测不出，
//   需同时破坏 `net===0` 与 `Math.abs(net)` 才能让裁定③真正失效。
//   Tester 报 172 表对此仅 1/14 覆盖（仅 [1,1,3,8] 哨兵）。
//
// ⇒ 不靠变异、也不只靠键相等，改断言**归约输出的结构本身**：
//   被抵消的项必须真的从树上消失，而非「键碰巧相同」。用叶子计数取证。
// ================================================================
console.log('\n[组2b] 裁定③ R5 抵消的结构级取证（补 172 表 1/14 薄弱覆盖）');
{
  const leafCount = (t) => {
    if (!t) return 0;
    if (t.op === 'num' || t.op === 'recip') return 1;
    if (t.op === 'one' || t.op === 'zero') return 0;
    return leafCount(t.a) + leafCount(t.b);
  };
  // (24+5)-5 ：3 叶子 → 抵消后应仅剩 1
  const e10 = sub(add(n(12), n(5)), n(5));
  const r10 = reduceToFixpoint(e10).node;
  ck('裁定③ (24+5)-5 叶子数 3→1（抵消项真从树上消失）',
     leafCount(e10) === 3 && leafCount(r10) === 1,
     `归约前=${leafCount(e10)} 归约后=${leafCount(r10)}`);
  ck('裁定③ 归约结果为单叶子 num（非残留 +/- 节点）',
     r10.op === 'num', `实际 op='${r10.op}'`);
  // 3+5-5+7 ：仅中间项抵消，不得误杀其他项
  const e13 = add(sub(add(n(3), n(5)), n(5)), n(7));
  const r13 = reduceToFixpoint(e13).node;
  ck('裁定③ 3+5-5+7 叶子数 4→2（只消抵消项，不误杀）',
     leafCount(r13) === 2, `归约后叶子数=${leafCount(r13)} 键=${keySol(r13)}`);
  ck('裁定③ 3+5-5+7 抵消后值不变（抵消不改语义）',
     val(e13) === val(r13), `${val(e13)} → ${val(r13)}`);
  // 全抵消：5-5 应归为 ZERO，叶子数 → 0
  const e14 = sub(n(5), n(5));
  const r14 = reduceToFixpoint(e14).node;
  ck('裁定③ 5-5 全抵消 ⇒ 叶子数 2→0 且键=ZERO',
     leafCount(r14) === 0 && keySol(r14) === keySol(ZERO_NODE),
     `叶子数=${leafCount(r14)} 键=${keySol(r14)}`);
}

// ============================================================
// 【组3】空分子占位符独立性 —— 规范 L43 记录的已知缺陷
// 早期用 {op:'num',card:1} 作空分子，与牌面 1 键值相同 ⇒ 必须用独立 op。
// ============================================================
console.log('\n[组3] 空分子占位符必须与牌面 1 区分（规范 L43 已知缺陷）');
{
  // (5-((1/5)/1))*5  与  (5-(1/5))*5 —— 数学同值，应为 1 键
  const e1 = mul(sub(n(5), div(r(5), n(1))), n(5));
  const e2 = mul(sub(n(5), r(5)), n(5));
  const same = val(e1) === val(e2);
  ck('前提：两式数学同值', same, `${val(e1)} vs ${val(e2)}`);
  ck('(5-((1/5)/1))*5 与 (5-(1/5))*5 同键（不因占位符分裂）',
     K(e1) === K(e2), `${K(e1)} vs ${K(e2)}`);
  // ONE 与牌面 1 键值必须不同
  //
  // ⚠️ 修正（task-69 Tester 变异审计触发的自查）：
  //   原写法 `keySol({ op:'one' })` **硬编码字面量**，测的是 keySol 对 'one' op 的处理，
  //   而非 solver 实际使用的 ONE_NODE。故把 ONE_NODE 定义改回缺陷写法
  //   （{op:'num',card:1} ⇒ 键 n1 与牌面 1 碰撞）时，此断言**照样绿**，零鉴别力。
  //   现改为断言【导出常量本身】，直接盯 L43 那个坑。
  ck('ONE_NODE 键 ≠ 牌面 1 键（L43 键碰撞，盯导出常量非字面量）',
     keySol(ONE_NODE) !== keySol(n(1)),
     `keySol(ONE_NODE)='${keySol(ONE_NODE)}' vs n1='${keySol(n(1))}'`);
  ck('ZERO_NODE 键 ≠ 牌面任意数键（同类碰撞防护）',
     keySol(ZERO_NODE) !== keySol(n(1)) && keySol(ZERO_NODE) !== keySol(n(0)),
     `keySol(ZERO_NODE)='${keySol(ZERO_NODE)}'`);
  // ONE_NODE 必须真的是独立 op，不是伪装成 num 的 1
  ck('ONE_NODE.op === "one"（独立 op，非 num 占位）', ONE_NODE.op === 'one',
     `实际 op='${ONE_NODE.op}'`);
}

// ============================================================
// 【组4】裁定③ 关键案例：3/((1+(1/8))-1) 必须归约为 3*8 落入 primary
// ============================================================
console.log('\n[组4] 裁定③：加减链抵消使倒数「假用」消尽');
{
  const e = div(n(3), sub(add(n(1), r(8)), n(1)));
  const rr = reduceToFixpoint(e);
  ck('3/((1+(1/8))-1) 求值 = 24', val(e) === '24/1', `值=${val(e)}`);
  ck('归约后倒数消尽（countRecip=0）', countRecip(rr.node) === 0, `countRecip=${countRecip(rr.node)}`);
  ck('归约后与 3*8 同键（落入 primary 而非 advanced）',
     K(e) === K(mul(n(3), n(8))), `${K(e)} vs ${K(mul(n(3), n(8)))}`);
}

// ============================================================
// 【组5】Fraction 精确性 —— 硬约束：禁浮点判等
// 用无限循环小数场景验证：浮点实现会漏，Fraction 不漏。
// ============================================================
console.log('\n[组5] Fraction 精确判等（禁浮点）');
{
  ck('is24F 交叉相乘 24/1', is24F(F(24n, 1n)) === true);
  ck('is24F 交叉相乘 48/2', is24F(F(48n, 2n)) === true);
  ck('is24F 拒绝 23.999…', is24F(F(23999999n, 1000000n)) === false);
  // 1/3 场景：8/(1-(1/3)) = 12，浮点 1-1/3=0.6666..7 会失准
  const e = div(n(8), sub(n(1), r(3)));
  ck('8/(1-(1/3)) 精确 = 12', val(e) === '12/1', `值=${val(e)}`);
  // (3*4)/(1-(1/2)) = 24 —— [1,2,3,4] 的最短高级解
  const e2 = div(mul(n(3), n(4)), sub(n(1), r(2)));
  ck('(3*4)/(1-(1/2)) 精确 = 24', val(e2) === '24/1', `值=${val(e2)}`);
}

// ============================================================
// 【组6】全量基准（规范 §6，唯一有效基准；INPUT-06.md §8 已作废）
// ★ 恢复为硬断言 —— 09efb3d 曾降为仅打印，现数字有权威来源（task-67）
// ============================================================
console.log('\n[组6] 全量基准 14 deck（规范 §6 · 硬断言）');
const BASE = [
  // [cards, primary, advanced]
  [[1, 2, 3, 4], 3, 4], [[2, 3, 4, 6], 10, 10], [[1, 3, 4, 6], 1, 4],
  [[1, 5, 5, 5], 1, 1], [[3, 3, 8, 8], 1, 7], [[1, 2, 5, 10], 2, 1],
  [[1, 1, 3, 8], 1, 0], [[1, 4, 6, 8], 3, 1], [[2, 4, 5, 8], 7, 3],
  [[5, 5, 5, 5], 1, 0], [[1, 1, 2, 9], 1, 0], [[3, 3, 7, 7], 1, 0],
  [[4, 4, 7, 7], 1, 0], [[3, 3, 3, 5], 1, 0],
];
let maxIterAll = 0, ovfAll = 0, sumP = 0, sumA = 0;
for (const [cards, ep, ea] of BASE) {
  const res = solve(cards);
  maxIterAll = Math.max(maxIterAll, res.maxIters);
  ovfAll += res.overflowCount;
  sumP += res.counts.primary; sumA += res.counts.advanced;
  const okP = res.counts.primary === ep;
  const okA = res.counts.advanced === ea;
  ck(`[${cards.join(',')}] 初级=${ep} 高级=${ea}`, okP && okA,
     `实测 初级=${res.counts.primary} 高级=${res.counts.advanced}` +
     `${okP && okA ? '' : ' ← 不符规范 §6'}`);
}
ck('汇总 初级合计=34', sumP === 34, `实测 ${sumP}`);
ck('汇总 高级合计=31', sumA === 31, `实测 ${sumA}`);
ck('maxIter ≤ 3（规范实测值）', maxIterAll <= 3, `实测 ${maxIterAll}`);
ck(`overflow = 0（上限 MAX_ITER=${MAX_ITER}）`, ovfAll === 0, `实测 ${ovfAll}`);

// ============================================================
// 【组7】稳定性：牌序无关 + 重复运行确定性（规范 §5）
// ============================================================
console.log('\n[组7] 稳定性判据');
{
  let orderOk = true, detOk = true, bad = '';
  for (const [cards] of BASE) {
    const base = solve(cards).counts;
    const perms = [
      cards.slice().reverse(),
      cards.slice().sort((a, b) => a - b),
      cards.slice().sort((a, b) => b - a),
    ];
    for (const p of perms) {
      const c = solve(p).counts;
      if (c.primary !== base.primary || c.advanced !== base.advanced) {
        orderOk = false; bad = `[${cards}] vs [${p}]: ${base.primary}/${base.advanced} vs ${c.primary}/${c.advanced}`;
      }
    }
    const again = solve(cards).counts;
    if (again.primary !== base.primary || again.advanced !== base.advanced) detOk = false;
  }
  ck('牌序无关（14 deck × 4 序）', orderOk, bad || '全一致');
  ck('重复运行确定性', detOk, '复跑一致');
}

// ============================================================
// 【组8】cancelled 口径变更（规范 §4）：rawHits 级计数，不去重
// ============================================================
console.log('\n[组8] cancelled 改 rawHits 级计数（规范 §4）');
{
  const res = solve([1, 2, 3, 4]);
  ck('counts 暴露 cancelledRaw 字段', typeof res.counts.cancelledRaw === 'number',
     `cancelledRaw=${res.counts.cancelledRaw}`);
  ck('不再暴露旧 cancelled Map（避免误用作去重集）',
     res.cancelled === undefined, `cancelled=${res.cancelled}`);
  ck('[1,2,3,4] cancelledRaw=432（规范 §6）', res.counts.cancelledRaw === 432,
     `实测 ${res.counts.cancelledRaw}`);
  ck('[1,2,3,4] rawHits=551（规范 §6）', res.rawHits === 551, `实测 ${res.rawHits}`);
}

console.log('\n' + '='.repeat(62));
console.log(`[input06-dedup] pass=${pass} fail=${fail}`);
console.log(fail === 0
  ? '✅ 双向判据 + 全量基准 + 稳定性 全部通过'
  : '🔴 存在未通过项，禁止交付');
console.log('='.repeat(62));
process.exit(fail === 0 ? 0 : 1);
