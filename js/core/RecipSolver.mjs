// m24 - RecipSolver.js
// INPUT-06：倒数（1/x）高级解 solver + §1.2.3 乘除链归约 + 三分类去重
// 依据：INPUT-06.md §1.2.2/§1.2.3/§1.3 + 170-INPUT06-Architect方案.md §2/§3
//
// 硬约束：
//   1) 倒数只在叶子层展开（recip.arg 恒为 num 叶子），禁止作用于中间结果
//   2) 1/1（恒等）与 1/0（未定义）不枚举
//   3) 全程 Fraction(BigInt) 精确判等，禁 ===24 / ==24 / toFixed()
//   4) usedRecip 必须在归约之后判定（否则可消去解被误标为高级解）
//   5) 归约迭代至不动点，MAX_ITER=30 保护
//   6) 本文件不修改 Solver.js / 6 保护清单文件的任何字节

// ============ Fraction（BigInt 分子/分母，恒约简、den>0） ============
export function bgcd(a, b) {
  a = a < 0n ? -a : a;
  b = b < 0n ? -b : b;
  while (b) { const t = a % b; a = b; b = t; }
  return a;
}

export function F(n, d = 1n) {
  n = BigInt(n);
  d = BigInt(d);
  if (d === 0n) return null;
  if (d < 0n) { n = -n; d = -d; }
  const g = bgcd(n, d) || 1n;
  return { n: n / g, d: d / g };
}

export const addF = (a, b) => F(a.n * b.d + b.n * a.d, a.d * b.d);
export const subF = (a, b) => F(a.n * b.d - b.n * a.d, a.d * b.d);
export const mulF = (a, b) => F(a.n * b.n, a.d * b.d);
export const divF = (a, b) => (b.n === 0n ? null : F(a.n * b.d, a.d * b.n));

// 24 判等：精确，禁浮点
export function is24F(f) {
  return !!f && f.d !== 0n && f.n === 24n * f.d;
}

export function fracLabel(f) {
  if (!f) return '?';
  return f.d === 1n ? String(f.n) : `${f.n}/${f.d}`;
}

// ============ 节点结构 ============
// { op:'num',   v:Fraction, card:int, slot:int }        原始牌叶子（slot = 牌位 0..3）
// { op:'recip', arg:NumNode, v:Fraction }               倒数，arg 恒为 num 叶子（不变式 I1）
// { op:'+'|'-'|'*'|'/', a:Node, b:Node }

export function numLeaf(card, slot) {
  return { op: 'num', v: F(card), card, slot };
}

export function recipLeaf(card, slot) {
  return { op: 'recip', arg: numLeaf(card, slot), v: F(1, card) };
}

// ============ INPUT-07：阶乘 / 模 ============
// 依据：INPUT-07 §1.2 / §1.3 + 架构师 200 号规范 §1.1/§1.2/§4.1/§4.2
//
// 阶乘上限：§1.2.2 仅牌面 ≤6 （6!=720）。牌面 ≥7 不枚举。
export const FACT_MAX_CARD = 6;

// 精确阶乘（BigInt，零浮点）
export function factBig(n) {
  let r = 1n;
  for (let i = 2n; i <= BigInt(n); i += 1n) r *= i;
  return r;
}

// §1.2.3 退化判据：【牌面值不变即退化】⇒ 仅 1!=1、2!=2
// ⚠️ 易错点（规范 F-3）：0! = 1，值 0→1 已变 ⇒ **有效**，不是退化。
//    若照「小数字都是退化」直觉写会错剔 0!。
export function isFactDegenerate(card) {
  return factBig(card) === BigInt(card);
}

// 阶乘叶子是否可枚举：牌面 ≤6（§1.2.2）且非退化（§1.2.3）
// ⇒ 有效阶乘仅 5 个：0!=1、3!=6、4!=24、5!=120、6!=720（规范 §4.1）
export function factEnumerable(card) {
  if (!Number.isInteger(card) || card < 0) return false;
  if (card > FACT_MAX_CARD) return false;
  return !isFactDegenerate(card);
}

export function factLeaf(card, slot) {
  return { op: 'fact', arg: numLeaf(card, slot), v: F(factBig(card)) };
}

// §1.3.2 模合法性：两侧非负整数、b>0
// §1.3.3 退化：唯一无效式是 a%a（可由 a-a 等价替代）
// ⚠️ a%1=0、a<b 时 a%b=a 均**有效**，必须计入高级解（规范 M-2/M-3）。
//    旧口径「54 组/32%」已作废；新口径有效组合 = 182 − 13 = **169 组**。
export function modEnumerable(a, b) {
  if (!Number.isInteger(a) || !Number.isInteger(b)) return false;
  if (a < 0 || b <= 0) return false;   // b=0 非法（含王牌 0 作模数）
  if (a === b) return false;           // M-1 枚举期剔除（判据是【值】相等，非 mask）
  return true;
}

export function modLeaf(aCard, aSlot, bCard, bSlot) {
  return {
    op: 'mod',
    a: numLeaf(aCard, aSlot),
    b: numLeaf(bCard, bSlot),
    v: F(BigInt(aCard) % BigInt(bCard)),
  };
}

// countFact / countMod：与 countRecip 同构，用于【归约后】判定三标记（规范 §2.2）
// ★ 退化式 1!/2! 的 usedFact=false **不靠特判**：它们在归约期已被 F-R 剥除，
//   归约后 AST 里根本不存在 fact 节点 ⇒ 自然为 false（结构性保证，比特判可靠）。
export function countFact(t) {
  if (!t || t.op === 'num' || t.op === 'one' || t.op === 'zero') return 0;
  if (t.op === 'recip') return 0;
  if (t.op === 'fact') return 1;
  if (t.op === 'mod') return 0;   // mod 两侧限原始叶子，不可能内嵌 fact
  return countFact(t.a) + countFact(t.b);
}

export function countMod(t) {
  if (!t || t.op === 'num' || t.op === 'one' || t.op === 'zero') return 0;
  if (t.op === 'recip') return 0;
  if (t.op === 'fact') return 0;
  if (t.op === 'mod') return 1;
  return countMod(t.a) + countMod(t.b);
}

// countRecip：统计有效 recip 节点数
// ★ 方案 §4.7：arg.card === 1 的 recip（即 1/1）一律跳过 —— 1/1 恒等，
//   不得使表达式被判定为"用了高级符号"（R-04.1）
export function countRecip(t) {
  if (!t || t.op === 'num' || t.op === 'one' || t.op === 'zero') return 0;
  if (t.op === 'recip') return t.arg && t.arg.card === 1 ? 0 : 1;
  // INPUT-07：fact 的 arg 恒为原始数字叶子（限叶子），内部不可能含 recip
  if (t.op === 'fact') return 0;
  if (t.op === 'mod') return 0;   // mod 两侧同为原始叶子
  return countRecip(t.a) + countRecip(t.b);
}

// ============ 归约产生的恒等元节点（规范 §1 节点表）============
// ★ 必须用独立 op：早期实现用 {op:'num',card:1} 作空分子占位，与牌面的 1 键值相同，
//   导致 (5-((1/5)/1))*5 与 (5-(1/5))*5 被判 2 条解。规范 L43 已记录该缺陷。
export const ONE_NODE = { op: 'one' };
export const ZERO_NODE = { op: 'zero' };

// 恒等因子判定（乘除链）：牌面的 1 与归约产生的 ONE 都是乘法恒等元
function isIdentFactor(x) {
  return (x.op === 'num' && x.card === 1) || x.op === 'one';
}
// task-80 反例 2（±0 等价）：旧实现仅判 op==='zero'（合成 ZERO_NODE），
//   而王（牌面 0）走 numLeaf(0) ⇒ {op:'num', card:0}，从不被命中 ⇒ 0 项被保留进链，
//   且 net=+1/-1 使 (12+12)+0 与 (12+12)-0 分裂为两键。
//   数学依据：x+0 = x-0 = x（加法恒等元，且 0 的相反数仍为 0），与 0 所在位置/符号无关。
//
//   ★ 进一步（边界）：不仅叶子 0，「求值为 0 的整个子树」也是加法恒等元。
//   否则 (12+12)+(0×2) 与 (12+12)-(0×2) 仍会分裂（子树 op='*' 不被形状判据命中）。
//   ⚙️ 改用【值】判据：evalNode(x) === 0。仅用于【加减项】位置（调用方 rebuildAddSub），
//      乘除因子位置用的是 isIdentFactor，不受影响 ⇒ 12×0 的 0 绝不会被误消。
const isZeroTerm = (x) => {
  if (x.op === 'zero') return true;
  if (x.op === 'num' && x.card === 0) return true;
  const v = evalNode(x);
  return v !== null && v.n === 0n;
};

// 渲染：倒数用 (1/c)，乘除用 * /（内部串）；显示层用 renderDisplay
export function render(t) {
  if (t.op === 'num') return String(t.card);
  if (t.op === 'one') return '1';
  if (t.op === 'zero') return '0';
  if (t.op === 'recip') return `(1/${t.arg.card})`;
  if (t.op === 'fact') return `${t.arg.card}!`;
  if (t.op === 'mod') return `(${render(t.a)}%${render(t.b)})`;
  return `(${render(t.a)}${t.op}${render(t.b)})`;
}

// 显示层：× ÷ 替换，倒数保持 1/c 形态（与 §5.1 countAdvSymbols 的 "(1/" 计数口径一致）
// INPUT-07 R-12：`%` 为唯一记号 —— 按钮 / [提示] / [答案] 三处一致，此处即 [提示]/[答案] 来源
export function renderDisplay(t) {
  if (t.op === 'num') return String(t.card);
  if (t.op === 'one') return '1';
  if (t.op === 'zero') return '0';
  if (t.op === 'recip') return `(1/${t.arg.card})`;
  if (t.op === 'fact') return `${t.arg.card}!`;
  if (t.op === 'mod') return `(${renderDisplay(t.a)}%${renderDisplay(t.b)})`;
  const op = t.op === '*' ? '×' : t.op === '/' ? '÷' : t.op;
  return `(${renderDisplay(t.a)}${op}${renderDisplay(t.b)})`;
}

// 独立 evaluator（禁 solver 自证：复算不复用 dfs 里的 v）
export function evalNode(t) {
  if (!t) return null;
  if (t.op === 'num') return F(t.card);
  if (t.op === 'one') return F(1n);
  if (t.op === 'zero') return F(0n);
  if (t.op === 'recip') return t.arg.card === 0 ? null : F(1, t.arg.card);
  // INPUT-07：阶乘（限叶子 ⇒ arg 必为 num）
  if (t.op === 'fact') {
    if (!t.arg || t.arg.op !== 'num') return null;
    if (!Number.isInteger(t.arg.card) || t.arg.card < 0) return null;
    return F(factBig(t.arg.card));
  }
  // INPUT-07：模（限叶子 ⇒ 两侧必为 num；b>0；非负整数）
  if (t.op === 'mod') {
    const ma = evalNode(t.a);
    const mb = evalNode(t.b);
    if (ma === null || mb === null) return null;
    if (ma.d !== 1n || mb.d !== 1n) return null;   // §1.3.2 非负整数判据
    if (ma.n < 0n || mb.n <= 0n) return null;      // b=0 非法
    return F(ma.n % mb.n);
  }
  const a = evalNode(t.a);
  const b = evalNode(t.b);
  if (a === null || b === null) return null;
  switch (t.op) {
    case '+': return addF(a, b);
    case '-': return subF(a, b);
    case '*': return mulF(a, b);
    case '/': return divF(a, b);
    default: return null;
  }
}

// ============ §1.2.3 乘除链归约 ============
// 依据方案 §2.2/§2.3
// flattenMulDiv：把由 * / 连接的极大子树拉平为 分子表/分母表
//   ★ 遇 + - 立即停止，该节点整体作为不可拉平因子入表（方案 §2.4 边界 B1/B2）
//   ★ '/' 右子交换两表 —— 处理 a/(b/c)=a*c/b（方案 §2.4 边界 B4）
function flattenMulDiv(node, numList, denList) {
  if (node.op === '*') {
    flattenMulDiv(node.a, numList, denList);
    flattenMulDiv(node.b, numList, denList);
    return;
  }
  if (node.op === '/') {
    flattenMulDiv(node.a, numList, denList);
    flattenMulDiv(node.b, denList, numList); // ★ 交换两表
    return;
  }
  // node.op ∈ {num, recip, +, -} → 边界，整体作为一个因子
  numList.push(node);
}

function rebuildChain(numList, denList) {
  // ★ R4（规范 L87-100）：消恒等元 + 两表排序归一
  //   排序是根因修法：不排序则 24/3/4 与 24/4/3、(1/3)/4 与 (1/4)/3 会分裂成 2 条。
  //   早期误诊为「空分子特例」，实测分子非空时同样错分，故必须对两表排序。
  //   消恒等元是裁定②：filter(¬isIdent) 实现 (1*2)/X ≡ 2/X。
  const N = numList.filter((x) => !isIdentFactor(x))
    .sort((x, y) => (keySol(x) < keySol(y) ? -1 : keySol(x) > keySol(y) ? 1 : 0));
  const D = denList.filter((x) => !isIdentFactor(x))
    .sort((x, y) => (keySol(x) < keySol(y) ? -1 : keySol(x) > keySol(y) ? 1 : 0));
  let acc = N.length ? N.reduce((x, y) => ({ op: '*', a: x, b: y })) : ONE_NODE;
  for (const d of D) acc = { op: '/', a: acc, b: d };
  return acc;
}

// ============ R3 加减链拉平（裁定③，规范 L76-85）============
// ★ 遇 * / 停止下钻，对子树递归；右子树遇 '-' 整体反号
// 为何必须有：3/((1+(1/8))-1) 中两个牌面 1 相互抵消，倒数是「假用」，
// 归约后等于 3*8，属初级解重复书写。不拉平则误判为 advanced。
function flattenAddSub(node, terms, sign) {
  if (node.op === '+') {
    flattenAddSub(node.a, terms, sign);
    flattenAddSub(node.b, terms, sign);
    return;
  }
  if (node.op === '-') {
    flattenAddSub(node.a, terms, sign);
    flattenAddSub(node.b, terms, -sign); // ★ 右子树整体反号
    return;
  }
  terms.push({ node, sign });
}

// ============ R5 加减链重建（同项抵消 + 消零 + 排序归一，规范 L102-129）============
// 同时实现三条恒等律：同项抵消 (24+5)-5≡243、加法交换、减法分配
function rebuildAddSub(terms) {
  // 1) 同 key 归桶，累加符号
  const bucket = new Map();
  for (const { node, sign } of terms) {
    const k = keySol(node);
    const cur = bucket.get(k);
    if (cur) cur.net += sign;
    else bucket.set(k, { node, net: sign });
  }
  // 2) 同项抵消（裁定③核心）：net=0 → 整项消失
  const pos = [];
  const neg = [];
  for (const { node, net } of bucket.values()) {
    if (net === 0) continue; // ★ +c -c 抵消
    const bag = net > 0 ? pos : neg;
    for (let i = 0; i < Math.abs(net); i++) bag.push(node);
  }
  // 3) 消零项：+0 / -0 无意义
  const P = pos.filter((x) => !isZeroTerm(x));
  const Ng = neg.filter((x) => !isZeroTerm(x));
  if (P.length === 0 && Ng.length === 0) return ZERO_NODE;
  // 4) 排序归一后重建
  const cmp = (x, y) => (keySol(x) < keySol(y) ? -1 : keySol(x) > keySol(y) ? 1 : 0);
  P.sort(cmp);
  Ng.sort(cmp);
  let acc = P.length ? P.reduce((x, y) => ({ op: '+', a: x, b: y })) : ZERO_NODE;
  for (const q of Ng) acc = { op: '-', a: acc, b: q };
  return acc;
}

export function reduceOnce(node) {
  if (node.op === 'num' || node.op === 'recip' || node.op === 'one' || node.op === 'zero') {
    return { node, changed: false };
  }
  // ============ INPUT-07 规则 F-R：阶乘退化剥除（规范 §3.1）============
  // 变换：Fact(leaf(n)) → leaf(n)，当且仅当 n! === n（即 n ∈ {1,2}）
  // 数学依据：1!=1、2!=2 值恒等；value/mask 均不变、单向可达 ⇒ R-08 三条件全满足。
  // 幂等：剥除后为纯叶子，二次应用匹配失败 ⇒ reduce(reduce(x))===reduce(x)。
  // ★ n=0 不匹配本规则（0!=1≠0）⇒ 正确保留，对应 F-3。
  if (node.op === 'fact') {
    if (node.arg && node.arg.op === 'num' && isFactDegenerate(node.arg.card)) {
      return { node: node.arg, changed: true };
    }
    return { node, changed: false };
  }
  // ============ INPUT-07：% 节点为原子（规范 §2.4 / §3.4）============
  // 🔴 不拉平、不下钻、不排序。两侧恒为原始牌面叶子（§1.3.1），无可归约内容。
  //    若误将 % 并入乘除链排序归一 ⇒ 等于交换两侧 ⇒ 与上轮 (8-6)/2 vs (6-8)/2 同型的错并。
  if (node.op === 'mod') {
    return { node, changed: false };
  }
  if (node.op === '+' || node.op === '-') {
    // ★ R3+R5（裁定③）：拉平加减链 → 子项递归 → 同项抵消/消零/排序重建
    //   旧实现只递归左右子树、不拉平，故 (24+5)-5 不会归约为 24。
    const terms = [];
    flattenAddSub(node, terms, 1);
    let childChanged = false;
    const reduced = terms.map(({ node: t, sign }) => {
      const r = reduceOnce(t);
      if (r.changed) childChanged = true;
      return { node: r.node, sign };
    });
    const out = rebuildAddSub(reduced);
    // changed 用 keySol 比对（规范 R6），与去重口径一致，避免无限迭代
    const changed = childChanged || keySol(out) !== keySol(node);
    return { node: out, changed };
  }
  // node.op ∈ {*, /}：极大乘除链
  const numList = [];
  const denList = [];
  flattenMulDiv(node, numList, denList);

  let changed = false;
  const outNum = [];
  const outDen = [];
  for (const f of numList) {
    if (f.op === 'recip') { outDen.push(f.arg); changed = true; } // 分子的 1/c → 分母 c
    else outNum.push(f);
  }
  for (const f of denList) {
    if (f.op === 'recip') { outNum.push(f.arg); changed = true; } // 分母的 1/c → 分子 c
    else outDen.push(f);
  }

  // ★ 链内的加减子树需递归归约（规范 R6）
  const recurseList = (arr) => arr.map((f) => {
    if (f.op === '+' || f.op === '-') {
      const r = reduceOnce(f);
      if (r.changed) changed = true;
      return r.node;
    }
    return f;
  });

  const out = rebuildChain(recurseList(outNum), recurseList(outDen));
  // ★ 用 keySol 比对补捕「排序/消恒等元」带来的变化，否则 (1*2)/X 不会被标 changed
  if (keySol(out) !== keySol(node)) changed = true;
  return { node: out, changed };
}

// MAX_ITER：§7 风险 8 迭代上限保护（理论上界 5，实测 ≤3）
export const MAX_ITER = 30;

export function reduceToFixpoint(node) {
  let cur = node;
  for (let i = 0; i < MAX_ITER; i++) {
    const r = reduceOnce(cur);
    cur = r.node;
    if (!r.changed) return { node: cur, iters: i + 1, overflow: false };
  }
  console.warn('[RecipSolver] reduceToFixpoint hit MAX_ITER=' + MAX_ITER);
  return { node: cur, iters: MAX_ITER, overflow: true };
}

// ============ 规范键 keySol（方案 §2.6） ============
// 二元交换律归一（+ * 两操作数按确定性序）+ 全括号 ⇒ 冗余括号天然消除
// ⚠️ 禁止复用 Solver.toCanonicalKeyV2（会把 [1,2,3,4] 的 52 条初级解压成 3 条）
// task-80 反例 1（负负得正等价）辅助：返回「差节点取反」后的键。
//   数学依据：-(a-b) = (b-a)，恒等变换（不引入一元负号，仍是合法二元差）。
//   仅对 '-' 节点可表达；其余形状返回 null 表示「不可安全取反」。
function negKeySol(t) {
  if (t && t.op === '-') return `(- ${keySol(t.b)} ${keySol(t.a)})`;
  return null;
}

export function keySol(t) {
  // ★ R1 规则 1（规范 L52）：倒数两种书写形态归一
  //   (1/5)/1 归约后为 ONE/n5，必须与直接 recip(5) 同键
  if (t.op === '/' && t.a && t.a.op === 'one' && t.b && t.b.op === 'num') {
    return 'r' + t.b.card;
  }
  if (t.op === 'one') return 'ONE';
  if (t.op === 'zero') return 'ZERO';
  if (t.op === 'num') return 'n' + t.card;
  if (t.op === 'recip') return 'r' + t.arg.card; // 与整数叶子不同前缀，禁止混淆
  // ============ INPUT-07 叶子键（规范 §2.3.1）============
  // ★ 'f3'（3!）与 'n6'（牌面 6）是两个不同叶子键，虽求值同为 6。
  //   ⇒ 无需为「阶乘与牌面同值」写特处理，键结构天然区分（对应 I-1）。
  if (t.op === 'fact') return 'f' + t.arg.card;
  const ka = keySol(t.a);
  const kb = keySol(t.b);
  // ============ INPUT-07：% 必须保序（规范 §2.3.2 / §3.4）============
  // 🔴 a%b ≠ b%a：7%3=1 vs 3%7=3、12%5=2 vs 5%12=5、8%6=2 vs 6%8=6。
  //    必须写在 +/* 交换归一分支【之前】，且绝不参与任何排序。
  if (t.op === 'mod') return `(% ${ka} ${kb})`;
  if (t.op === '+' || t.op === '*') {
    const x = ka <= kb ? ka : kb;
    const y = ka <= kb ? kb : ka;
    return `(${t.op} ${x} ${y})`;
  }
  // ★ task-80 反例 1：分子分母同时取反，商不变 ⇒ (-X)/(-Y) ≡ X/Y
  //   数学依据：∀Y≠0, (-X)/(-Y) = X/Y（分式符号定律）—— 恒等，不依赖具体取值。
  //   取两种书写形态的字典序最小者作唯一代表（取反是对偶 ⇒ 归一幂等、确定）。
  //   ⚠️ 必须分子与分母「同时」为差节点才变换：只翻一侧会真的变号，绝不能归一。
  if (t.op === '/') {
    const na = negKeySol(t.a);
    const nb = negKeySol(t.b);
    if (na !== null && nb !== null) {
      const orig = `(/ ${ka} ${kb})`;
      const flip = `(/ ${na} ${nb})`;
      return orig <= flip ? orig : flip;
    }
  }
  return `(${t.op} ${ka} ${kb})`; // - / 保序
}

// ============ 叶子变体枚举（方案 §3.2） ============
// 每张牌 c 取 c 或 1/c；c===1（恒等）与 c===0（未定义）不展开倒数
export function leafVariants(cards) {
  const out = [];
  const rec = (i, acc) => {
    if (i === cards.length) { out.push(acc.slice()); return; }
    const c = cards[i];
    acc.push(numLeaf(c, i));
    rec(i + 1, acc);
    acc.pop();
    if (c !== 0 && c !== 1) {
      acc.push(recipLeaf(c, i));
      rec(i + 1, acc);
      acc.pop();
    }
  };
  rec(0, []);
  return out;
}

// ============ INPUT-07：含阶乘/模的全量变体枚举（§1.4）============
// 复用已建成的叶子变体机制，不新建框架。
//
// 每个 slot 的【单牌】形态三选一：
//   num(c) ｜ recip(c)（c≠0,1）｜ fact(c)（牌面≤6 且非退化）
// 另外可选取【一对 slot】组成 mod(a,b)，消耗 2 牌产出 1 项（§1.3）。
//
// 🔴 修饰不可叠加（规范 §1.5 通则，项目主 2026-08-06 13:07 裁定）：
//    每个叶子最多带 1 个修饰；mod 两侧只能是【未修饰的原始叶子】。
//    ⇒ 结构上不会产出 1/(3!)、(3!)!、(7%3)%2 等叠加式。
export function advVariants(cards) {
  const n = cards.length;
  const out = [];

  // 单牌形态候选
  const soloForms = (c, i) => {
    const fs = [numLeaf(c, i)];
    if (c !== 0 && c !== 1) fs.push(recipLeaf(c, i));
    if (factEnumerable(c)) fs.push(factLeaf(c, i));   // 牌面≥6 以上 / 1!/2! 均不枚举
    return fs;
  };

  // 枚举「哪些 slot 被 mod 占用」：0 对或 1 对（四牌最多一对，两对则无剩余牌且不必要）
  //   mod 不可交换 ⇒ 有序对 (i,j) 与 (j,i) 均需枚举
  const modPairs = [[]];
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      if (modEnumerable(cards[i], cards[j])) modPairs.push([i, j]);
    }
  }

  for (const mp of modPairs) {
    const used = new Set(mp);
    const base = [];
    if (mp.length === 2) base.push(modLeaf(cards[mp[0]], mp[0], cards[mp[1]], mp[1]));
    const free = [];
    for (let i = 0; i < n; i++) if (!used.has(i)) free.push(i);

    const rec = (k, acc) => {
      if (k === free.length) { out.push(base.concat(acc)); return; }
      const i = free[k];
      for (const f of soloForms(cards[i], i)) {
        acc.push(f);
        rec(k + 1, acc);
        acc.pop();
      }
    };
    rec(0, []);
  }
  return out;
}

// ============ 标准 24 点 DFS（Fraction 精确） ============
const OPS = ['+', '-', '*', '/'];

function dfs24(items, onHit) {
  if (items.length === 1) {
    if (is24F(items[0].v)) onHit(items[0].t);
    return;
  }
  const n = items.length;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      const rest = [];
      for (let k = 0; k < n; k++) if (k !== i && k !== j) rest.push(items[k]);
      const A = items[i];
      const B = items[j];
      for (const op of OPS) {
        if ((op === '+' || op === '*') && i > j) continue; // P1 交换律剪枝
        let v;
        switch (op) {
          case '+': v = addF(A.v, B.v); break;
          case '-': v = subF(A.v, B.v); break;
          case '*': v = mulF(A.v, B.v); break;
          default: v = divF(A.v, B.v); break; // P4 除零前置（divF 返 null）
        }
        if (v === null) continue;
        dfs24([{ t: { op, a: A.t, b: B.t }, v }, ...rest], onHit);
      }
    }
  }
}

// ============ §1.4 解集排序（三级全序，确定性可复现） ============
// ① 表达式字符长度升序 ② 高级符号个数升序 ③ 字典序升序
// §7 风险 7：必须显式 sort，禁依赖 Map/Set 遍历序
export function countAdvSymbols(s) {
  const m = String(s).match(/\(1\//g);
  return m ? m.length : 0;
}

export function compareSolutions(a, b) {
  if (a.length !== b.length) return a.length - b.length;
  const ca = countAdvSymbols(a);
  const cb = countAdvSymbols(b);
  if (ca !== cb) return ca - cb;
  return a < b ? -1 : (a > b ? 1 : 0);
}

export function sortSolutions(exprs) {
  return exprs.slice().sort(compareSolutions);
}

export const DISPLAY_LIMIT = 10;

// ============ 三分类 solve（方案 §2.6 / §3.2） ============
/**
 * 全量枚举 4 张牌的初级解 + 有效高级解（倒数/阶乘/模）+ 被剔除的可消去解
 * @param {number[]} cards 4 个点数（0..13，0=大小王）
 * @param {{ advancedCalc?:boolean }} [opts] INPUT-07 §1.1：高级计算开关
 *   ★ R-01：关闭态下行为必严格等于初级符号完成态（无高级 solver）。
 *   向后兼容：不传 opts 时沿用 INPUT-06 行为（仅倒数变体），保现有 21 项门禁不碎。
 * @returns {{ primary:Map, advanced:Map, cancelled:Map, counts:object, maxIters:number, rawHits:number }}
 */
export function solve(cards, opts) {
  const primary = new Map();
  const advanced = new Map();
  let cancelledRaw = 0; // ★ 计数器，非去重集合（规范 §4）
  let rawHits = 0;
  let maxIters = 0;
  let overflowCount = 0;

  // INPUT-07：三模式
  //   opts 缺省（undefined） → INPUT-06 兼容态：仅倒数变体
  //   advancedCalc:true      → 全高级：倒数 + 阶乘 + 模
  //   advancedCalc:false     → 关闭态：纯初级，无任何高级变体（R-01）
  let variants;
  if (!opts) variants = leafVariants(cards);
  else if (opts.advancedCalc) variants = advVariants(cards);
  else variants = [cards.map((c, i) => numLeaf(c, i))];

  for (const lv of variants) {
    const items = lv.map((t) => ({ t, v: t.v }));
    dfs24(items, (node) => {
      rawHits += 1;
      const rr = reduceToFixpoint(node);
      if (rr.iters > maxIters) maxIters = rr.iters;
      if (rr.overflow) overflowCount += 1;
      // ★★ 三标记均必须在归约之后判定（规范 R9 / INPUT-07 §1.4 硬约束）
      //   退化式 1!/2! 已在归约期被 F-R 剥除 ⇒ usedFact 自然为 false（结构性保证）。
      //   含 % 且结果 0 的项被 isZeroTerm 消去后 ⇒ usedMod 也自然为 false（规范 §2.4 警告 / A-7）。
      const usedRecip = countRecip(rr.node) > 0;
      const usedFact = countFact(rr.node) > 0;
      const usedMod = countMod(rr.node) > 0;
      const hadRecip = countRecip(node) > 0;
      // ★★ 裁定①：三分区统一用**归约式键**。
      //   旧实现 advanced/primary 用 keySol(node)（原式键）、cancelled 用 keySol(rr.node)（归约式键），
      //   两套键混用 ⇒ 同一条解在不同桶里键空间不一致，此为 task-68 要修的根因。
      // INPUT-07 §2.1：键由 (mask,value,usedRecip) 扩为 (mask,value,usedRecip,usedFact,usedMod)。
      //   mask/value 已隐含于归约式键中（叶子键带牌面与修饰前缀），此处拼接三标记。
      //   ★ 严格粗化（规范 §3.5）：不含高级符号的旧解三标记恒 false，
      //     新增两维不引入新区分度 ⇒ 旧解不被分裂。
      const baseK = keySol(rr.node);
      const k = (usedFact || usedMod) ? `${baseK}|F${usedFact ? 1 : 0}M${usedMod ? 1 : 0}` : baseK;
      if (usedRecip || usedFact || usedMod) {
        if (!advanced.has(k)) advanced.set(k, renderDisplay(node));
      } else {
        // 裁定④：初级解同样用归约式键去重
        if (hadRecip) cancelledRaw += 1; // ★ rawHits 级诊断计数，不去重、不作门禁
        if (!primary.has(k)) primary.set(k, renderDisplay(node));
      }
    });
  }

  // §1.2.3 尾句：无效倒数解若其归约式与某条已有初级解规范形式相同则直接丢弃
  // ⚠️ 口径说明（Developer 实测确认）：
  //   cancelledTotal = 归约后判为可消去的去重解总数（= §8 参考数据「被剔除」列口径，
  // ============ cancelled 口径变更（规范 §4）============
  // 统一归约式键后，「可消去解」必与某条初级解同键，若按键去重则该列恒为 0
  // （数学上正确：它们本就等价于初级解）。为保留诊断价值，改为 rawHits 级原始条数。
  // 用途：衡量倒数枚举的「无效功」比例，供 R-05 性能优化参考。
  // **不作面板展示数字，不作门禁红灯依据。**

  return {
    primary,
    advanced,
    cancelledRaw,
    counts: {
      primary: primary.size,
      advanced: advanced.size,
      cancelledRaw,
    },
    maxIters,
    rawHits,
    overflowCount,
  };
}
/**
 * 供 UI 层：只保留排序后 top-N 字符串驻留，其余仅计数（§1.4 内存约束）
 */
export function buildDisplay(result, limit = DISPLAY_LIMIT) {
  const p = sortSolutions([...result.primary.values()]);
  const a = sortSolutions([...result.advanced.values()]);
  return {
    primary: p.slice(0, limit),
    advanced: a.slice(0, limit),
    counts: { primary: result.primary.size, advanced: result.advanced.size },
    primaryTop: p.length ? p[0] : null,
    advancedTop: a.length ? a[0] : null,
  };
}

export default {
  solve,
  buildDisplay,
  sortSolutions,
  compareSolutions,
  countAdvSymbols,
  reduceOnce,
  reduceToFixpoint,
  keySol,
  leafVariants,
  countRecip,
  render,
  renderDisplay,
  evalNode,
  is24F,
  F,
  MAX_ITER,
  DISPLAY_LIMIT,
  // INPUT-07
  advVariants,
  factBig,
  factLeaf,
  factEnumerable,
  isFactDegenerate,
  modLeaf,
  modEnumerable,
  countFact,
  countMod,
  FACT_MAX_CARD,
};
