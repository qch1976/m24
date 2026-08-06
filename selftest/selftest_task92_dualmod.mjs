// task-92 双 % 形态 selftest（A-17 ~ A-25）
// 依据：INPUT-07.md §1.3 + 架构师 201 号附录（A1 形态 72 / D-1~D-4 / A5 断言表）
//      + 200 号主规范 v3 §2.3.2（% 保序）/ §2.4（% 原子）
//
// ⚠️ 方法论（团队规则 11）：新造判据必须先验证再下结论；
//    断言必须盯【导出常量 / 真实调用路径】，不用长得像的字面量。
import * as RS from '../js/core/RecipSolver.mjs';
import * as PP from '../js/core/RecipParser.mjs';

let pass = 0, fail = 0;
const T = (name, cond, got) => {
  if (cond) { pass++; console.log(`  PASS ${name}`); }
  else { fail++; console.log(`  FAIL ${name} => got: ${JSON.stringify(got)}`); }
};

// ---- 前置：依赖导出必须存在（禁条件守卫式假绿）----
for (const [nm, fn] of [['advVariants', RS.advVariants], ['modLeaf', RS.modLeaf],
  ['keySol', RS.keySol], ['reduceToFixpoint', RS.reduceToFixpoint],
  ['evalNode', RS.evalNode], ['modEnumerable', RS.modEnumerable],
  ['numLeaf', RS.numLeaf], ['factLeaf', RS.factLeaf], ['solve', RS.solve]]) {
  if (typeof fn !== 'function') { console.log(`FATAL: RS.${nm} 未导出，判据无效`); process.exit(2); }
}
console.log('前置：依赖导出均存在 ✅（非哑弹）\n');

const m = (a, ai, b, bi) => RS.modLeaf(a, ai, b, bi);
const n = (c, i) => RS.numLeaf(c, i);
// ★ 走真实归约+键路径（与 solve() 内部一致），不用手搓字面量
const K = (t) => RS.keySol(RS.reduceToFixpoint(t).node);
const V = (t) => { const v = RS.evalNode(t); return v === null ? null : `${v.n}/${v.d}`; };

// =====================================================================
console.log('=== A-17 🔴 双 % 外层项交换须归并（D-1 / D-2）===');
// 外层可交换算子 + × ⇒ 两组顺序不产生新解
const a17 = [
  ['(7%3)+(9%4) ≡ (9%4)+(7%3)',
    { op: '+', a: m(7, 0, 3, 1), b: m(9, 2, 4, 3) },
    { op: '+', a: m(9, 2, 4, 3), b: m(7, 0, 3, 1) }],
  ['(7%1)×(9%3) ≡ (9%3)×(7%1)',
    { op: '*', a: m(7, 0, 1, 1), b: m(9, 2, 3, 3) },
    { op: '*', a: m(9, 2, 3, 3), b: m(7, 0, 1, 1) }],
  ['(12%5)+(8%6) ≡ (8%6)+(12%5)',
    { op: '+', a: m(12, 0, 5, 1), b: m(8, 2, 6, 3) },
    { op: '+', a: m(8, 2, 6, 3), b: m(12, 0, 5, 1) }],
];
for (const [nm, x, y] of a17) {
  T(`A-17 ${nm}`, K(x) === K(y), [K(x), K(y)]);
  T(`A-17☆ ${nm} 值相同（前提自检）`, V(x) === V(y), [V(x), V(y)]);
}

// =====================================================================
console.log('\n=== A-18 🔴 % 内部仍不可交换（排序器禁下沉）===');
// ⚠️ 这是 task-80 同型错并的防线：归并的是【外层项顺序】，不是【% 两侧】
const base18 = { op: '+', a: m(7, 0, 3, 1), b: m(9, 2, 4, 3) };      // 1+1 = 2
const in18a = { op: '+', a: m(3, 1, 7, 0), b: m(9, 2, 4, 3) };      // 3+1 = 4
const in18b = { op: '+', a: m(7, 0, 3, 1), b: m(4, 3, 9, 2) };      // 1+4 = 5
T('A-18a (7%3)+(9%4) 与 (3%7)+(9%4) 键不同', K(base18) !== K(in18a), [K(base18), K(in18a)]);
T('A-18b (7%3)+(9%4) 与 (7%3)+(4%9) 键不同', K(base18) !== K(in18b), [K(base18), K(in18b)]);
// ★ 值不同是「必须不归并」的独立证据（防「键不同但其实是同一解」的误解）
T('A-18☆ 三式值两两不同（2 / 4 / 5）',
  V(base18) === '2/1' && V(in18a) === '4/1' && V(in18b) === '5/1',
  [V(base18), V(in18a), V(in18b)]);
// 乘法链内的 % 也不得被下沉排序
const mul18a = { op: '*', a: m(7, 0, 3, 1), b: n(2, 2) };
const mul18b = { op: '*', a: m(3, 1, 7, 0), b: n(2, 2) };
T('A-18c 乘法链内 % 仍保序（未被下沉）', K(mul18a) !== K(mul18b), [K(mul18a), K(mul18b)]);
// 双 % 乘法链：两个 % 内部各自保序
const dm1 = { op: '*', a: m(7, 0, 3, 1), b: m(9, 2, 4, 3) };
const dm2 = { op: '*', a: m(3, 1, 7, 0), b: m(9, 2, 4, 3) };
T('A-18d 双% 乘法链内部保序', K(dm1) !== K(dm2), [K(dm1), K(dm2)]);

// =====================================================================
console.log('\n=== A-19 双 % 与单 % 不互相归并 ===');
const dual19 = { op: '+', a: m(7, 0, 3, 1), b: m(9, 2, 4, 3) };          // (7%3)+(9%4) = 2
const single19 = { op: '+', a: { op: '+', a: m(7, 0, 3, 1), b: n(9, 2) }, b: n(4, 3) }; // (7%3)+9+4 = 14
T('A-19 (7%3)+(9%4) 与 (7%3)+9+4 键不同', K(dual19) !== K(single19), [K(dual19), K(single19)]);
// 同值但结构不同的情形：单% 与双% 即使凑到同值也不得归并（mask 相同、结构不可变换）
const dualZ = { op: '*', a: m(7, 0, 1, 1), b: m(9, 2, 3, 3) };            // 0×0 = 0
const singleZ = { op: '*', a: m(7, 0, 1, 1), b: { op: '*', a: n(9, 2), b: n(3, 3) } }; // 0×27 = 0
T('A-19b 双%=0 与 单%=0 键不同（结构不同不得因同值归并）',
  K(dualZ) !== K(singleZ), [K(dualZ), K(singleZ)]);

// =====================================================================
console.log('\n=== A-20 🔴 D-4：不可交换算子 + 两 % 结果相等 须归并 ===');
// 🔴 判据是 R-08 三条件（同 mask + 同 value + 结构可变换），
//    【不是】外层算子可交换性。用算子可交换性当开关会漏掉这一路。
const d4sub1 = { op: '-', a: m(7, 0, 3, 1), b: m(9, 2, 4, 3) };   // 1-1 = 0
const d4sub2 = { op: '-', a: m(9, 2, 4, 3), b: m(7, 0, 3, 1) };   // 1-1 = 0
T('A-20a (7%3)-(9%4) 与反序 均为 0 须归并', K(d4sub1) === K(d4sub2), [K(d4sub1), K(d4sub2)]);
T('A-20a☆ 两式确实均为 0（前提自检）', V(d4sub1) === '0/1' && V(d4sub2) === '0/1',
  [V(d4sub1), V(d4sub2)]);
const d4div1 = { op: '/', a: m(7, 0, 3, 1), b: m(9, 2, 4, 3) };   // 1÷1 = 1
const d4div2 = { op: '/', a: m(9, 2, 4, 3), b: m(7, 0, 3, 1) };   // 1÷1 = 1
T('A-20b (7%3)÷(9%4) 与反序 均为 1 须归并', K(d4div1) === K(d4div2), [K(d4div1), K(d4div2)]);
T('A-20b☆ 两式确实均为 1（前提自检）', V(d4div1) === '1/1' && V(d4div2) === '1/1',
  [V(d4div1), V(d4div2)]);
// D-4 亦适用于非 % 的普通同值项（R-08 是通则，不是 % 专属）
const g1 = { op: '-', a: n(5, 0), b: n(5, 1) };
const g2 = { op: '-', a: n(5, 1), b: n(5, 0) };
T('A-20c 通则性：5-5 与反序同键（R-08 非 % 专属）', K(g1) === K(g2), [K(g1), K(g2)]);
// 🔴🔴 A-20d：D-4 适用范围必須限【两侧均为 mod】—— 防止口径擅自扩大
// ⚠️ 实测踩过的真误删：最初把 D-4 写成对所有 -// 节点生效，
//    导致 6÷3! 与 3!÷6（两侧值均为 6）被误归并，
//    删掉 [0,3,4,6] 的 2 条 INPUT-06 既有合法解。
//    附录 D-4 的语境是「两个 % 结果之间」，不得外推。
const nonMod1 = { op: '/', a: n(6, 2), b: RS.factLeaf(3, 1) };   // 6÷3! = 1
const nonMod2 = { op: '/', a: RS.factLeaf(3, 1), b: n(6, 2) };   // 3!÷6 = 1
T('A-20d🔴 非 % 两侧（6÷3! vs 3!÷6）不得被 D-4 归并',
  K(nonMod1) !== K(nonMod2), [K(nonMod1), K(nonMod2)]);
T('A-20d☆ 两式值确实相同（=1，证明不是因值不同才不并）',
  V(nonMod1) === '1/1' && V(nonMod2) === '1/1', [V(nonMod1), V(nonMod2)]);
// 单侧是 mod 也不得归并（須两侧均为 mod）
const halfMod1 = { op: '-', a: m(7, 0, 3, 1), b: n(1, 2) };      // 1-1 = 0
const halfMod2 = { op: '-', a: n(1, 2), b: m(7, 0, 3, 1) };      // 1-1 = 0
T('A-20e 单侧为 % （(7%3)-1 vs 1-(7%3)）不得被 D-4 归并',
  K(halfMod1) !== K(halfMod2), [K(halfMod1), K(halfMod2)]);
// 回归：[0,3,4,6] 的既有解不得丢（直接验两条真实键存在）
const r20 = RS.solve([0, 3, 4, 6], { advancedCalc: true });
const k20 = new Set([...r20.primary.keys(), ...r20.advanced.keys()]);
T('A-20f 回归：[0,3,4,6] 保留 (- (+ f0 f4) (/ n6 f3))|F1M0',
  k20.has('(- (+ f0 f4) (/ n6 f3))|F1M0'), null);
T('A-20g 回归：[0,3,4,6] 保留 (- (+ (/ n6 f3) f4) f0)|F1M0',
  k20.has('(- (+ (/ n6 f3) f4) f0)|F1M0'), null);

// =====================================================================
console.log('\n=== A-21 不可交换外层不误并（两 % 结果【不相等】）===');
// ⚠️ 附录 A-21 选例约束：必须选两 % 结果不等者，否则落入 D-4 而非 D-3
const d3a = { op: '-', a: m(8, 0, 3, 1), b: m(9, 2, 2, 3) };   // 2-1 = 1
const d3b = { op: '-', a: m(9, 2, 2, 3), b: m(8, 0, 3, 1) };   // 1-2 = -1
T('A-21a (8%3)-(9%2)=1 与反序=-1 键不同', K(d3a) !== K(d3b), [K(d3a), K(d3b)]);
T('A-21a☆ 两 % 结果确实不等（2 ≠ 1，选例自检）',
  V(d3a) === '1/1' && V(d3b) === '-1/1', [V(d3a), V(d3b)]);
const d3c = { op: '/', a: m(8, 0, 3, 1), b: m(9, 2, 2, 3) };   // 2÷1 = 2
const d3d = { op: '/', a: m(9, 2, 2, 3), b: m(8, 0, 3, 1) };   // 1÷2 = 1/2
T('A-21b (8%3)÷(9%2)=2 与反序=1/2 键不同', K(d3c) !== K(d3d), [K(d3c), K(d3d)]);
T('A-21b☆ 值确实不等（2 vs 1/2）', V(d3c) === '2/1' && V(d3d) === '1/2', [V(d3c), V(d3d)]);

// =====================================================================
console.log('\n=== A-22 混用形态占牌校验（双 % 吃满 4 张 ⇒ 不可混阶乘/倒数）===');
// 双 % 形态实例必须恰为 2 个 item 且都是 mod（无第三个 item）
const av = RS.advVariants([7, 3, 9, 4]);
const dualForms = av.filter((v) => v.length === 2 && v.every((x) => x.op === 'mod'));
T('A-22a 双% 形态实例每条恰 2 项且均为 mod', dualForms.length > 0
  && dualForms.every((v) => v.length === 2 && v[0].op === 'mod' && v[1].op === 'mod'),
  dualForms.length);
// 不得存在「两个 mod + 阶乘/倒数」的混合形态（牌不够）
const badMix = av.filter((v) => v.filter((x) => x.op === 'mod').length === 2
  && v.some((x) => x.op === 'fact' || x.op === 'recip'));
T('A-22b 不存在「双% + 阶乘/倒数」混合形态（占牌超 4）', badMix.length === 0, badMix.length);
// 双 % 形态必须覆盖全部 4 个 slot 且不重用
const slotOK = dualForms.every((v) => {
  const s = [v[0].a.slot, v[0].b.slot, v[1].a.slot, v[1].b.slot].sort().join(',');
  return s === '0,1,2,3';
});
T('A-22c 双% 形态恰覆盖 4 个 slot 且无重用', slotOK, null);
// 单 % + 阶乘（占 3+1=4 张）是合法的
const mixSingle = av.filter((v) => v.filter((x) => x.op === 'mod').length === 1
  && v.some((x) => x.op === 'fact'));
T('A-22d 单% + 阶乘（占满 4 张）合法且被枚举', mixSingle.length > 0, mixSingle.length);
// parser 侧：(7%3)+4! 只占 3 张 ⇒ 须因未用完牌被拒
const tN = (i) => ({ type: 'number', cardIndex: i });
const tL = { type: 'left_paren' }, tR = { type: 'right_paren' };
const tMO = { type: 'mod' }, tFA = { type: 'fact' };
// parser 的 operator token 字段是 value 而非 op（见 RecipParser L94 注释）。
// ⚠️ 此处曾写错为 { op:'+' } ⇒ parser 以 trailing_token 拒收，
//    看上去“拒收成功”但原因是【token 结构错】而非【占牌规则】⇒ 典型间接量陷阱。
const tPL = { type: 'operator', value: '+' };
const r22 = PP.checkUserAnswer(
  [tL, tN(0), tMO, tN(1), tR, tPL, tN(2), tFA], [7, 3, 4, 9], { advancedCalc: true });
// checkUserAnswer 返回 { pass, reason, message, invalid }，不是 { ok, error }
T('A-22e (7%3)+4! 仅占 3 张 ⇒ 不得判正确', r22.pass === false, r22);
// ★ 强判据：必須因【未用完牌】拒收，不得靠语法错顶替
//   （若只验 pass===false，token 写坏也会“通过”，属哑弹）
T('A-22e★ 拒收原因为未用完牌（非语法错顶替）',
  r22.reason === 'cards_not_all_used' || /card|used|牌/i.test(String(r22.reason)),
  r22.reason);
// 对照：占满 4 张的合法式不得因占牌被拒
const r22ok = PP.checkUserAnswer(
  [tL, tN(0), tMO, tN(1), tR, tPL, tN(2), tFA, tPL, tN(3)], [7, 3, 4, 9],
  { advancedCalc: true });
T('A-22f (7%3)+4!+9 占满 4 张 ⇒ 不因占牌被拒',
  r22ok.reason !== 'cards_not_all_used', r22ok.reason);

// =====================================================================
console.log('\n=== A-23 % 操作数须裸叶子（§1.5 第 8 行，双%轮不得放宽）===');
const bad23 = [
  ['(3!%2) 拒收', [tL, tL, tN(0), tFA, tR, tMO, tN(1), tR], [3, 2, 9, 4]],
  ['((1/3)%2) 拒收', [tL, tL, { type: 'recip' }, tN(0), tR, tMO, tN(1), tR], [3, 2, 9, 4]],
  ['((7%3)%2) 拒收', [tL, tL, tN(0), tMO, tN(1), tR, tMO, tN(2), tR], [7, 3, 2, 9]],
];
for (const [nm, ts, cv] of bad23) {
  const r = PP.parse(ts, cv);
  T(`A-23 ${nm}`, r.ok === false, r.ok ? '误放行' : r.error);
  // ★ 强判据：必须因【作用域】被拒，不得靠崩溃/其他错误顶替
  T(`A-23★ ${nm} 原因为作用域错误`,
    r.error === PP.ERR.MOD_OPERAND_NOT_LEAF || r.error === PP.ERR.FACT_OPERAND_NOT_LEAF
    || r.error === PP.ERR.RECIP_OPERAND_NOT_LEAF,
    `${r.error} detail=${r.detail || ''}`);
}

// =====================================================================
console.log('\n=== A-24 形态数上限：[7,3,9,4] 双% 形态恰 72 ===');
// 拆解：配对 3 × 内部序 4 = 12 个双% 项组合；外层 +×各1序 + -÷各2序 = 6 ⇒ 12×6 = 72
T('A-24a 双% 项组合数 = 12（配对3 × 内部序4）', dualForms.length === 12, dualForms.length);
const FORM_PER_COMBO = 6;   // + × 各1序（可交换）+ - ÷ 各2序（不可交换）
T('A-24b 形态总数 = 12 × 6 = 72', dualForms.length * FORM_PER_COMBO === 72,
  dualForms.length * FORM_PER_COMBO);
// 3 种配对确实各不相同（防「固定 slot0 在第一组」写错导致重复）
const pairSigs = new Set(dualForms.map((v) => {
  const g1 = [v[0].a.slot, v[0].b.slot].sort().join('');
  const g2 = [v[1].a.slot, v[1].b.slot].sort().join('');
  return [g1, g2].sort().join('|');
}));
T('A-24c 恰 3 种牌位配对（C(4,2)/2=3，无重复划分）', pairSigs.size === 3, [...pairSigs]);
// 12 条组合两两不同（无重复产出）
const comboSigs = new Set(dualForms.map((v) =>
  `${v[0].a.slot}%${v[0].b.slot}|${v[1].a.slot}%${v[1].b.slot}`));
T('A-24d 12 条组合互不重复', comboSigs.size === 12, comboSigs.size);
// a%a / b=0 牌组应少于 72
const dualAA = RS.advVariants([6, 6, 8, 12]).filter((v) => v.length === 2 && v.every((x) => x.op === 'mod'));
T('A-24e 含同值牌 [6,6,8,12] 组合数 < 12（a%a 被剔）', dualAA.length < 12, dualAA.length);
const dual0 = RS.advVariants([0, 3, 9, 4]).filter((v) => v.length === 2 && v.every((x) => x.op === 'mod'));
T('A-24f 含 0 牌组 [0,3,9,4] 组合数 < 12（b=0 非法）', dual0.length < 12, dual0.length);
// ⭐ A-24g/h：必須验【第二对】也被校验
// ⚠️ 发现过的断言缺口：上面几个牌组的重复牌/0 都落在 slot0 所在组（g1），
//    故「只校验第一对」的变异不会被判红。須取【非 slot0 且非 partner 的两张】
//    同值 / 含 0 的牌组，才能让 g2 的 modEnumerable 真正起作用。
const dualG2same = RS.advVariants([3, 7, 5, 5]).filter((v) => v.length === 2 && v.every((x) => x.op === 'mod'));
T('A-24g 第二对也被校验：[3,7,5,5]（g2 同值）组合数 < 12',
  dualG2same.length < 12, dualG2same.length);
T('A-24g☆ [3,7,5,5] 中不存在 a%a 形态',
  dualG2same.every((v) => v.every((x) => x.a.card !== x.b.card)), null);
const dualG2zero = RS.advVariants([3, 7, 5, 0]).filter((v) => v.length === 2 && v.every((x) => x.op === 'mod'));
T('A-24h 第二对也被校验：[3,7,5,0]（g2 含 0）组合数 < 12',
  dualG2zero.length < 12, dualG2zero.length);
T('A-24h☆ [3,7,5,0] 中无任何 b=0 形态（除零非法）',
  dualG2zero.every((v) => v.every((x) => x.b.card !== 0)), null);

// =====================================================================
console.log('\n=== A-25 usedMod 仍为布尔（去重键零改动）===');
const r25 = RS.solve([7, 3, 9, 4], { advancedCalc: true });
T('A-25a solve 打开态返回 primary/advanced Map',
  r25.primary instanceof Map && r25.advanced instanceof Map, null);
// 找一条双 % 解，验其 usedMod === true（不是 2）
let dualSolFound = 0, usedModBoolOK = true;
for (const [, v] of r25.advanced) {
  if (v && typeof v.usedMod !== 'undefined') {
    if (typeof v.usedMod !== 'boolean') usedModBoolOK = false;
    if (v.usedMod === true && v.expr && (v.expr.match(/%/g) || []).length >= 2) dualSolFound++;
  }
}
T('A-25b 所有解的 usedMod 均为 boolean（非计数）', usedModBoolOK, null);
// 键后缀只含 M0/M1，不含 M2
const badSuffix = [...r25.advanced.keys()].filter((k) => /M[2-9]/.test(k));
T('A-25c 去重键后缀无 M2+（usedMod 保持布尔）', badSuffix.length === 0, badSuffix.slice(0, 3));

console.log(`\npass=${pass} fail=${fail}`);
process.exit(fail === 0 ? 0 : 1);
