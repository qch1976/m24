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

// ============ INPUT-08：幂 / 对数 / 开方（§2.2 §2.2b §2.3 §2.4）============
// 🔴 全整数运算，禁 Math.pow / Math.log / 浮点判等（§3.1 §5 风险 5）。
// 🔴 开方不是独立运算符（§1.2）：作 pow 节点的显示别名，根指数存于专用字段 rootIdx，
//    **不建 1/b 子树** —— 因 keySol 前两分支 {op:'/',a:one,b:num} 与 {op:'recip'}
//    都 return 'r'+card ⇒ 若建子树，4^(1/2) 指数位键=r2 与倒数叶子 1/2 同键，
//    R 位会被误标 1（别名擦除，task-109 L707 同病理，已明令 stop）。

// §2.2 指数上限分档：底2→8 / 3-5→4 / 6-9→3 / ≥10→2
export function powExpMax(a) {
  if (a === 2) return 8;
  if (a >= 3 && a <= 5) return 4;
  if (a >= 6 && a <= 9) return 3;
  return 2; // a >= 10
}
export const POW_EXP_MAX = powExpMax;

// §2.2b D-1：a^1 = a —— 吃 2 张牌却等价 1 张，产生伪高级解 ⇒ 排除
export function isPowDegenerate(a, b) {
  return b === 1;
}

// §2.2 幂可枚举性：底 a∈{0,1} 无效；指数须 ≥2 且不超分档上限
export function powEnumerable(a, b) {
  if (!Number.isInteger(a) || !Number.isInteger(b)) return false;
  if (a <= 1) return false;              // 0^b≡0、1^b≡1，无计算意义
  if (b < 0) return false;
  if (isPowDegenerate(a, b)) return false; // D-1
  if (b === 0) return false;             // a^0≡1 亦为退化常数
  return b <= powExpMax(a);
}

// 整数幂（BigInt，禁浮点）
export function ipow(base, exp) {
  let r = 1n;
  const b = BigInt(base);
  for (let i = 0; i < exp; i++) r *= b;
  return r;
}

// §2.3 对数：整数幂反查求精确值，禁 Math.log。
//   返回 Fraction 或 null（无理）。log_a b = p/q  ⟺  a^p = b^q。
//   做法：把 a、b 各自表示为「同一最小底 g 的整数幂」——
//   若 a = g^s、b = g^t（g 为不可再开方的最小整数底），则 log_a b = t/s，精确有理。
//   否则无理 ⇒ null。全程 BigInt，无浮点。
function minimalRootBase(n) {
  // 把 n 写成 g^e，e 取最大 ⇒ g 最小。n >= 2。
  for (let e = 13; e >= 2; e--) {
    for (let g = 2; g <= n; g++) {
      const p = ipow(g, e);
      if (p === BigInt(n)) return { g, e };
      if (p > BigInt(n)) break;
    }
  }
  return { g: n, e: 1 };
}

export function logExact(a, b) {
  if (!Number.isInteger(a) || !Number.isInteger(b)) return null;
  if (a <= 1 || b <= 0) return null;
  if (b === 1) return F(0n);          // log_a 1 = 0（值精确；枚举期由 D-3 排除）
  const ra = minimalRootBase(a);
  const rb = minimalRootBase(b);
  if (ra.g !== rb.g) return null;     // 不同最小底 ⇒ 无理（如 log_2 3）
  return F(BigInt(rb.e), BigInt(ra.e)); // t/s，F() 内部已约分
}

// §2.2b D-2 log_a(a)=1 / D-3 log_a(1)=0 排除；§2.3 底 2..13、真数 1..13
export function logEnumerable(a, b) {
  if (!Number.isInteger(a) || !Number.isInteger(b)) return false;
  if (a < 2 || a > 13) return false;
  if (b < 1 || b > 13) return false;
  if (a === b) return false;          // D-2 恒真
  if (b === 1) return false;          // D-3 恒真
  return logExact(a, b) !== null;     // 结果须精确
}

// §2.4 开方 a^(1/b) 须精确：整数幂反查，禁浮点。
//   仅当存在整数/有理 r 使 r^b = a 时成立。
export function rootExact(a, b) {
  if (!Number.isInteger(a) || !Number.isInteger(b)) return null;
  if (a <= 1 || b < 2) return null;
  for (let r = 2; r <= a; r++) {
    const p = ipow(r, b);
    if (p === BigInt(a)) return F(BigInt(r));
    if (p > BigInt(a)) break;
  }
  return null;
}

export function rootEnumerable(a, b) {
  if (!Number.isInteger(a) || !Number.isInteger(b)) return false;
  if (a <= 1) return false;           // 底 0/1 无效
  if (b < 2) return false;            // b=1 ⇒ a^(1/1)=a 退化
  if (b > 13) return false;
  return rootExact(a, b) !== null;
}

// ── pow 节点构造 ──
// 🔴 rootIdx 语义：undefined/null ⇒ 普通幂 a^b；数值 ⇒ 开方 a^(1/rootIdx)
//   两者共用 P 位（§1.2 键空间不新增开方位）。
export function powLeaf(aCard, aSlot, bCard, bSlot) {
  return {
    op: 'pow',
    a: numLeaf(aCard, aSlot),
    b: numLeaf(bCard, bSlot),
    v: F(ipow(aCard, bCard)),
  };
}

export function rootLeaf(aCard, aSlot, bCard, bSlot) {
  const r = rootExact(aCard, bCard);
  return {
    op: 'pow',
    a: numLeaf(aCard, aSlot),
    b: numLeaf(bCard, bSlot),
    rootIdx: bCard,          // ★ 专用字段承载根指数，不建 1/b 子树
    v: r,
  };
}

export function logLeaf(aCard, aSlot, bCard, bSlot) {
  return {
    op: 'log',
    a: numLeaf(aCard, aSlot),
    b: numLeaf(bCard, bSlot),
    v: logExact(aCard, bCard),
  };
}

// countPow / countLog：与 countFact/countMod 同构，用于【归约后】判定 P/L 两位。
// 🔴 §1.2：P 位走节点存在性，不从渲染文本反推（避开 L707 层级倒置与同形文本假阳）。
export function countPow(t) {
  if (!t || t.op === 'num' || t.op === 'one' || t.op === 'zero') return 0;
  if (t.op === 'recip' || t.op === 'fact' || t.op === 'mod') return 0;
  if (t.op === 'pow') return 1;   // 含开方别名（rootIdx 形态）
  if (t.op === 'log') return 0;
  return countPow(t.a) + countPow(t.b);
}

export function countLog(t) {
  if (!t || t.op === 'num' || t.op === 'one' || t.op === 'zero') return 0;
  if (t.op === 'recip' || t.op === 'fact' || t.op === 'mod') return 0;
  if (t.op === 'pow') return 0;
  if (t.op === 'log') return 1;
  return countLog(t.a) + countLog(t.b);
}
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
  // INPUT-08：幂 / 对数 / 开方（开方为幂的显示别名，§1.2）
  if (t.op === 'pow') {
    return (t.rootIdx !== undefined && t.rootIdx !== null)
      ? `(${t.a.card}^(1/${t.rootIdx}))`
      : `(${render(t.a)}^${render(t.b)})`;
  }
  if (t.op === 'log') return `(log_${render(t.a)} ${render(t.b)})`;
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
  // INPUT-08 §1.2：开方在展示层渲染为根号（仅显示层，语义层仍是 pow 节点）
  if (t.op === 'pow') {
    return (t.rootIdx !== undefined && t.rootIdx !== null)
      ? (t.rootIdx === 2 ? `√${t.a.card}` : `${t.rootIdx}√${t.a.card}`)
      : `(${renderDisplay(t.a)}^${renderDisplay(t.b)})`;
  }
  if (t.op === 'log') return `(log_${renderDisplay(t.a)} ${renderDisplay(t.b)})`;
  const op = t.op === '*' ? '×' : t.op === '/' ? '÷' : t.op;
  return `(${renderDisplay(t.a)}${op}${renderDisplay(t.b)})`;
}

// ============ 🔴 task-111 GUI-1：高级解分步（advPostOrderSteps）============
// 背景：仅高级解牌组（初级解=0 且 advanced>0，如 {5,8,9,10}）点提示时，
//   旧路径把整条算式塞进 lhs（`高级解法：...`）并把同一 step 传 3 次 ⇒ 无分步。
//   而初级解走 Solver.postOrderSteps ⇒ 正常分步 ⇒ 两者口径不一。
// 🔴 为何不能直接复用 Solver.postOrderSteps：
//   它读 node.args[0]/args[1]（初级 AST 形状），而高级 AST 是 {op, a, b}，
//   且含 recip/fact/mod 三类叶子 ⇒ 直接调用会全程 traverse 不到、返回空数组。
// 口径对齐：后序遍历，每个【二元运算节点】产一步；
//   recip/fact/mod 作为【原子叶子】不单独成步（它们是牌面变形，不是玩家的一步运算）。
export function advPostOrderSteps(t) {
  const steps = [];
  // 🔴 task-113 GUI-4：mod 必须【从原子叶子里剔除】。
  //   task-111 我把 recip/fact/mod 三者一并当叶子，但三者【元数不同】（实测 AST）：
  //     · recip {op,arg}、fact {op,arg} ⇒ 一元，只把 1 张牌变形，不消耗第二张
  //       ⇒ 不占玩家的一步，作原子叶子【正确】
  //     · mod   {op,a,b}              ⇒ 二元，吃掉 2 张牌，本身就是玩家的一次运算
  //       ⇒ 当叶子会让它被【吸收进父节点那一步】，于是同一步里做了两次运算
  //         （(5%8)+9=14：先算 % 再算 +），4 张牌的解只剩 2 步，与初级解 3 步口径不一。
  //   ⇒ mod 参与后序遍历、单独成步。其两侧在设计上恒为原始叶子（见上方
  //     「mod 两侧限原始叶子」注释），故成步后 lhs/rhs 不会再嵌套子算式。
  // 🔴 INPUT-08 §3.5：pow / log 同样是二元（吃 2 张牌）⇒ 绝不可入 isAtom，
  //   否则重蹈 GUI-4 覆辍（4 张牌的解只剩 2 步）。此处不列 pow/log 即使其参与遍历。
  const isAtom = (x) => !x || x.op === 'num' || x.op === 'one' || x.op === 'zero'
    || x.op === 'recip' || x.op === 'fact';
  const fmt = (fr) => {
    if (!fr) return '?';
    if (fr.d === 1n || fr.d === 1) return String(fr.n);
    return `${fr.n}/${fr.d}`;
  };
  const traverse = (node) => {
    if (isAtom(node)) return;
    traverse(node.a);
    traverse(node.b);
    // 🔴 task-113：mod 现在会单独成步，必须把内部 op 名 'mod' 映成展示符 '%'，
    //   否则屏上会出现「5 mod 8」（泄露内部枚举名），与 advancedTop 里的 (5%8) 不一致。
    const op = node.op === '*' ? '×' : node.op === '/' ? '÷' : node.op === 'mod' ? '%'
      : node.op === 'pow' ? '^' : node.op === 'log' ? 'log' : node.op;
    // 🔴 §3.5：op 名须映射屏显符号，不得泄露枚举名（'pow'/'log'）。
    // 开方形态：rhs 显示 (1/b)，使「底 ^ (1/b)」可读；语义层仍是 rootIdx 字段。
    const isRoot = node.op === 'pow' && node.rootIdx !== undefined && node.rootIdx !== null;
    steps.push({
      step: steps.length + 1,
      lhs: renderDisplay(node.a),
      op,
      rhs: isRoot ? `(1/${node.rootIdx})` : renderDisplay(node.b),
      result: fmt(evalNode(node)),
    });
  };
  traverse(t);
  return steps;
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
  // ============ INPUT-08：幂 / 对数（限叶子 ⇒ 两侧必为 num）============
  // 🔴 rootIdx 存在 ⇒ 开方语义 a^(1/rootIdx)，不建 1/b 子树（§1.2）
  if (t.op === 'pow') {
    if (!t.a || t.a.op !== 'num' || !t.b || t.b.op !== 'num') return null;
    if (t.rootIdx !== undefined && t.rootIdx !== null) return rootExact(t.a.card, t.rootIdx);
    if (!powEnumerable(t.a.card, t.b.card)) return null;
    return F(ipow(t.a.card, t.b.card));
  }
  if (t.op === 'log') {
    if (!t.a || t.a.op !== 'num' || !t.b || t.b.op !== 'num') return null;
    if (!logEnumerable(t.a.card, t.b.card)) return null;
    return logExact(t.a.card, t.b.card);
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
  // ============ INPUT-08：^ 与 log 必须保序（§1.1 二元、不可交换）============
  // 🔴 2^3=8 ≠ 3^2=9、log_2 4=2 ≠ log_4 2=1/2
  //    必须写在 +/* 交换归一分支【之前】，且组不参与任何排序（同 mod）。
  // 🔴 开方（rootIdx）与普通幂共用 P 位，但键必须可区分：
  //    4^2=16 与 4^(1/2)=2 值不同，若同键会错误归并。故开方用 √ 前缀。
  if (t.op === 'pow') {
    return (t.rootIdx !== undefined && t.rootIdx !== null)
      ? `(√ ${ka} ${t.rootIdx})`
      : `(^ ${ka} ${kb})`;
  }
  if (t.op === 'log') return `(log ${ka} ${kb})`;
  if (t.op === '+' || t.op === '*') {
    const x = ka <= kb ? ka : kb;
    const y = ka <= kb ? kb : ka;
    return `(${t.op} ${x} ${y})`;
  }
  // ============ INPUT-07 D-4：不可交换算子 + 两个 % 结果【值相等】⇒ 須归并 ============
  // 🔴 判据是 R-08 三条件（同 mask + 同 value + 结构可变换），
  //    【不是「外层算子是否可交换」】。若用算子可交换性当开关，会漏掉这一路，
  //    导致同一个 0（或同一个 1）被计为两个解。
  //
  // 数学依据（恒等，不依赖具体牌值）：
  //   eval(a)===eval(b)  ⇒  a-b = b-a = 0        ⇒ 两序同 mask 同值 ⇒ 归并
  //   eval(a)===eval(b)≠0 ⇒  a/b = b/a = 1        ⇒ 同上
  // 实例：(7%3)-(9%4) = 1-1 = 0，反序也是 0；(7%3)÷(9%4) = 1÷1 = 1，反序也是 1。
  //
  // 🔴🔴 适用范围必須限【两侧均为 mod 节点】—— 这是实测踩出来的硬边界：
  //   附录 D-4 的语境是「两个 % 结果之间」。我最初写成对所有 -// 节点生效，
  //   结果删掉了 2 条 INPUT-06 既有合法解：
  //     [0,3,4,6] 的 (- (+ f0 f4) (/ n6 f3)) 与 (- (+ (/ n6 f3) f4) f0)
  //   因为 6÷3! 与 3!÷6 两侧值均为 6 ⇒ 被误判为「值相等可归并」，
  //   而这两种写法在 INPUT-06 口径下是两个独立解。
  //   ⇒ 扩大到非 % 节点属于【擅自变更口径】，且会造成真误删，已收窄并上报。
  // ⚠️ 只在【值相等】时归一；值不等时必須保序（A-21：(8%3)-(9%2)=1 vs 反序=-1）。
  if ((t.op === '-' || t.op === '/')
      && t.a && t.a.op === 'mod' && t.b && t.b.op === 'mod') {
    const va = evalNode(t.a);
    const vb = evalNode(t.b);
    if (va !== null && vb !== null && va.n * vb.d === vb.n * va.d) {
      const x = ka <= kb ? ka : kb;
      const y = ka <= kb ? kb : ka;
      return `(${t.op} ${x} ${y})`;
    }
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
export function advVariants(cards, caps) {
  const n = cards.length;
  const out = [];
  // 🔴 task-111 GUI-2：三项高级能力可【独立开关】。
  //   旧调用 advVariants(cards) 不传 caps ⇒ 三项全开 ⇒ 行为与修前逐字节一致（向后兼容）。
  const allowRecip = !caps || caps.recip !== false;
  const allowFact = !caps || caps.fact !== false;
  const allowMod = !caps || caps.mod !== false;
  // 🔴 INPUT-08 §3.4：新增 capPow / capLog 两个子开关。
  //   ⭐ 兼容口径（🔴 **项目经理 2026-08-09 已批准，已归项目口径，已同步往 INPUT-08 §10**）：
  //   与 recip/fact/mod 的「!== false 即开」**有意不对称**，pow/log 采「=== true 才开」。
  //   🔴🔴 后人勿将此处「修」成 !== false 以求与上三项一致 —— 那不是不一致，是刻意的。
  //   缘由：若沿用 !== false，则
  //     ① 旧调用 advVariants(cards)（无 caps）会突然多出幂/对数解；
  //     ② 既有基准脚本传 {recip:false,fact:false,mod:false}（不知 pow/log）
  //        会在「全关」态下凭空多出解 ⇒ 直接破验收 4「全关零误伤」与 R-01。
  //   故默认关，使所有存量调用方行为逐字节不变（可由 Z-1 digest 相等证明）。
  //   🔴 不仅靠本注释拦：改成 !== false 会使
  //     selftest_input08_engine.mjs 的 H-1（不传 caps ⇒ P/L 位恒 0）与
  //     B-2（关闭态无含 | 的键）**两条当场判红**（已注入变异实测：618 键 / 13 键）。
  //   ⚠️ GUI 层同守此条：capPow/capLog **未设字段 = 关**。
  const allowPow = !!(caps && caps.pow === true);
  const allowLog = !!(caps && caps.log === true);

  // 单牌形态候选
  const soloForms = (c, i) => {
    const fs = [numLeaf(c, i)];
    if (allowRecip && c !== 0 && c !== 1) fs.push(recipLeaf(c, i));
    if (allowFact && factEnumerable(c)) fs.push(factLeaf(c, i));   // 牌面≥6 以上 / 1!/2! 均不枚举
    return fs;
  };

  // 枚举「哪些 slot 被 mod 占用」：0 对 / 1 对 / ★ 2 对（INPUT-07 §1.3 双 % 形态）
  //   mod 不可交换 ⇒ 有序对 (i,j) 与 (j,i) 均需枚举
  const modPairs = [[]];
  if (allowMod) {
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (i === j) continue;
        if (modEnumerable(cards[i], cards[j])) modPairs.push([i, j]);
      }
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

  // ============ 🔴 INPUT-08：幂 / 对数 / 开方形态（§1.1 二元，吃 2 张牌）============
  // 与 mod 同构：二元 ⇒ 占两个 slot，不可交换 ⇒ 有序对 (i,j)/(j,i) 均需枚举。
  // 🔴 §1.3：两侧均须为原始牌面叶子 ⇒ 只用 numLeaf，绝不嵌套中间结果。
  // 🔴 §1.4：不与其他修饰叠加 ⇒ 剩余牌仍走 soloForms（其内部已排除对己叠加）。
  if (allowPow || allowLog) {
    const advPairForms = [];
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (i === j) continue;
        const ci = cards[i];
        const cj = cards[j];
        if (allowPow) {
          if (powEnumerable(ci, cj)) advPairForms.push([[i, j], powLeaf(ci, i, cj, j)]);
          // 开方 a^(1/b)：仍是 pow 节点（rootIdx 字段），共用 P 位，不建 1/b 子树
          if (rootEnumerable(ci, cj)) advPairForms.push([[i, j], rootLeaf(ci, i, cj, j)]);
        }
        if (allowLog && logEnumerable(ci, cj)) advPairForms.push([[i, j], logLeaf(ci, i, cj, j)]);
      }
    }
    for (const [slots, leaf] of advPairForms) {
      const used = new Set(slots);
      const free = [];
      for (let i = 0; i < n; i++) if (!used.has(i)) free.push(i);
      const rec2 = (k, acc) => {
        if (k === free.length) { out.push([leaf].concat(acc)); return; }
        const i = free[k];
        for (const f of soloForms(cards[i], i)) {
          acc.push(f);
          rec2(k + 1, acc);
          acc.pop();
        }
      };
      rec2(0, []);
    }
  }

  // ============ ★ 双 % 形态（201 号附录 A1，形态数 72）============
  // 双 % 必然吃完 4 张牌 ⇒ 无剩余牌 ⇒ 不可与阶乘/倒数混用（A-22）。
  //   本循环只产出【两个 mod 叶子】的 item 列表，不参与 soloForms 笛卡尔积。
  //
  // 形态数拆解（附录 A1.4）：
  //   配对 3（C(4,2)/2）× 内部序 4（2×2）= 12 个「双 % 项组合」
  //   外层由【上层枚举器】负责：可交换 +× 各 1 序 + 不可交换 -÷ 各 2 序 = 6
  //   ⇒ 12 × 6 = 72 ✅（故本函数只需产出 12 条，外层不在这里展开）
  //
  // ⚠️ 配对只能枚举 3 种而非 6 种：固定 slot0 总在第一组，与 1/2/3 之一配对。
  //   若也枚举「两组互换」会产生 24 条 ⇒ 形态数膚胀到 144，且与上层对
  //   不可交换算子的双序枚举重复 ⇒ 同一解被重复产出。
  //   第一组固定含 slot0，亦即 D-4 的「保留牌位序在前者」稳定侧。
  if (n === 4 && allowMod) {
    for (const partner of [1, 2, 3]) {
      const g1 = [0, partner];
      const g2 = [1, 2, 3].filter((x) => x !== partner);
      // 每组内部 2 种顺序（% 不可交换，两序均需枚举）
      for (const [a, b] of [[g1[0], g1[1]], [g1[1], g1[0]]]) {
        for (const [c, d] of [[g2[0], g2[1]], [g2[1], g2[0]]]) {
          // 两对均須合法（M-1 a%a 剔除 / M-6 b=0 非法，由 modEnumerable 把关）
          if (!modEnumerable(cards[a], cards[b])) continue;
          if (!modEnumerable(cards[c], cards[d])) continue;
          out.push([
            modLeaf(cards[a], a, cards[b], b),
            modLeaf(cards[c], c, cards[d], d),
          ]);
        }
      }
    }
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
  // 🔴 task-111 GUI-1：展示文本 → AST 节点（仅供 UI 分步提示，不参与去重/键计算）
  const advancedNodes = new Map();
  let cancelledRaw = 0; // ★ 计数器，非去重集合（规范 §4）
  let rawHits = 0;
  let maxIters = 0;
  let overflowCount = 0;

  // INPUT-07：三模式
  //   opts 缺省（undefined） → INPUT-06 兼容态：仅倒数变体
  //   advancedCalc:true      → 全高级：倒数 + 阶乘 + 模
  //   advancedCalc:false     → 关闭态：纯初级，无任何高级变体（R-01）
  // 🔴 task-111 GUI-2：advancedCalc:true 时可再用 opts.caps 独立关闭其中某项：
  //   { advancedCalc:true, caps:{ recip:true, fact:false, mod:true } }
  //   caps 缺省 ⇒ 三项全开 ⇒ 与修前行为逐字节一致。
  let variants;
  if (!opts) variants = leafVariants(cards);
  else if (opts.advancedCalc) variants = advVariants(cards, opts.caps);
  else variants = [cards.map((c, i) => numLeaf(c, i))];

  for (const lv of variants) {
    const items = lv.map((t) => ({ t, v: t.v }));
    dfs24(items, (node) => {
      rawHits += 1;
      const rr = reduceToFixpoint(node);
      if (rr.iters > maxIters) maxIters = rr.iters;
      if (rr.overflow) overflowCount += 1;
      // ============ task-95：标记判定时机（架构师 202 号裁定 §2.2「丙方案」）============
      // 【键归键，标记归标记】——— 两者取自不同阶段：
      //   去重键的 value + 结构 → 取【归约式】（去重要认「等价解算同一个」）
      //   usedFact / usedMod    → 取【原式】（分区要认「玩家实际写了什么符号」）
      //
      // 🔴 为什么必须按原式（B1/B2 缺陷根因）：
      //   `12%1 = 0` 作为加减项会被 isZeroTerm（值判据）吸收 ⇒ 归约式里 % 消失
      //   ⇒ 按归约式判 usedMod=false ⇒ 含 % 的解落入【初级分区】
      //   ⇒ 直接违反 INPUT-07 §1.3.3「a%1=0 … 均有效，计入高级解」。
      //   牌确实被消耗了（原式 4 张全用），符号确实用过，标记不该被抹。
      //
      // ★ R-03「1!/2! 不触发高级判定」不依赖归约后判定，而由【枚举期排除】保证：
      //   §1.2.2 明文 1!/2! 不枚举、§1.3.3 明文 a%a 不枚举。
      //   实测佐证（全量 2380 组）：fact 节点 76095 个中退化式 1!/2! = 0；
      //                            mod 节点 150441 个中 a%a = 0。
      //   ⇒ 退化式压根不会出现在任何原式里，按原式判定不会误置标记。比归约后判定更早更彻底。
      //
      // ⚠️⚠️ usedRecip 必须【仍按归约式】——— 这是我实测拦下的一处，与裁定 §2.2 有出入：
      //   裁定说「三标记均改按原式」，但倒数与阶乘/模的性质不同：
      //   `1/(1/5)` 与 `12÷(1/2)` 这类【可消去倒数解】原式含 recip、归约后 recip 消失，
      //   INPUT-06 §1.2.3 + 本文件 L9 明确要求它们【不算高级解】（须与初级解同键丢弃）。
      //   若 usedRecip 也改按原式，前 400 组就有 8460 条（rawHits 级）可消去倒数解被误升为高级解
      //   ⇒ 破 INPUT-06 既有验收。故此处仅改 usedFact / usedMod，usedRecip 保持归约式判定。
      //   （已在 feedback 中向架构师上报此出入，未自行变更需求口径。）
      // ============ usedRecip：合取判据（task-95 附带修复既有 R-01 残留 4 组）============
      // ⚠️ 这不是 task-95 的主线缺陷，是 recip 家族的【既有】缺陷（修改前实测同样 4 组红），
      //    但同属「标记与键口径分裂」，一并修。三个案例逼出唯一可行判据：
      //
      //   案例                        原式recip  归约键含r  应归属
      //   A 12÷(1/2)（可消去倒数解）      1          否       primary（INPUT-06 §1.2.3）
      //   B (5-1÷5)×5（牌面1作分子）      0          是       primary（只用了÷，非倒数变体）
      //   C 12÷((1÷4)+(1/4))            1          是       advanced（真用了倒数变体）
      //
      //   单看「原式 recip>0」⇒ A 被误升为高级（破 §1.2.3 与 §8 参考数据 advanced 4→6）
      //   单看「归约键含 r」  ⇒ B 被误升（[1,5,5,5] primary 1→0，破 §6 汇总 34→33）
      //   ⇒ 必须【合取】：原式确实用了倒数变体，且归约后倒数结构仍存活。
      //
      // 🔴 为何需要「归约键含 r」这一侧：牌面 1 作分子时被 isIdentFactor 消去
      //    ⇒ 节点变 {op:'/', a:{op:'one'}, b:n4}，keySol 渲染为 `r4`（与真 recipLeaf 同键），
      //    但 countRecip 只数 op==='recip' ⇒ 数不到 ⇒ 该解落 primary，
      //    而关闭态产不出此键 ⇒ 开启态 primary 多出键 ⇒ 破 R-01（实测 [1,4,4,12] 等 4 组）。
      const usedRecip = countRecip(node) > 0 && /(^|[^a-z])r\d+/.test(keySol(rr.node));
      const usedFact = countFact(node) > 0;        // ← 改为原式（B6：0! 被乘一吸收）
      const usedMod = countMod(node) > 0;          // ← 改为原式（B1/B2：% 得 0 被零项吸收）
      // 🔴 INPUT-08 §1.2：P 位走节点存在性 countPow>0，**不从渲染文本反推**。
      //   缘由：开方用 rootIdx 专用字段而非 1/b 子树 ⇒ 不会被 keySol 前两分支
      //   归一为 'r'+card（别名抹除，task-109 L707 同病理）；且 1/b 与初级 1÷b 同形，
      //   文本判据必假阳。故此处与 usedFact/usedMod 同构，用原式节点计数。
      const usedPow = countPow(node) > 0;
      const usedLog = countLog(node) > 0;
      const hadRecip = countRecip(node) > 0;
      // ★★ 裁定①：三分区统一用**归约式键**。
      //   旧实现 advanced/primary 用 keySol(node)（原式键）、cancelled 用 keySol(rr.node)（归约式键），
      //   两套键混用 ⇒ 同一条解在不同桶里键空间不一致，此为 task-68 要修的根因。
      // INPUT-07 §2.1：键由 (mask,value,usedRecip) 扩为 (mask,value,usedRecip,usedFact,usedMod)。
      //   mask/value 已隐含于归约式键中（叶子键带牌面与修饰前缀），此处拼接三标记。
      //   ★ 严格粗化（规范 §3.5）：不含高级符号的旧解三标记恒 false，
      //     新增两维不引入新区分度 ⇒ 旧解不被分裂。
      const baseK = keySol(rr.node);
      // ★ C-1 键后缀格式（205 §C-1 正式条款）：
      //   ① 三标记全 false ⇒ 键【无后缀】= baseK
      //   ② 任一为 true    ⇒ baseK + "|R{0|1}F{0|1}M{0|1}"，三位【恒拼】，位序固定 R→F→M
      //   与 INPUT-07 §2.1 五元组 (mask,value,usedRecip,usedFact,usedMod) 后三维同序。
      // 🔴🔴 C-2 硬约束：全假必须走无后缀分支，改为恒拼 `|R0F0M0` 会破 R-01。
      //   理由：关闭「高级计算」时三标记恒 false ⇒ 若恒拼则【全部键形态改变】
      //   ⇒ 关闭态键集合与旧版完全不一致。该改动外观上像「消除特例、代码更整洁」的重构，
      //   且改完关闭态【不会报错】，只会使键集合整体偏移 —— 属静默破坏，务必不要「顺手清理」。
      //   守护：C-A1（关闭态无含 | 的键）+ C-A2（全量无 |R0F0M0 字面量）+ C-A3（后缀定长正则）。
      // 🔴 A（task-100）：usedRecip 补入键后缀。此前仅编 F/M 两维 ⇒ usedRecip 丢维，
      //   违反 INPUT-06 §1.3 / R-04.3 / INPUT-07 §2.1；属回归修复，非新增维度。
      // 🔴 INPUT-08 §3.3：三位→五位 R→F→M→P→L。位序恒定，不得调整既有 R→F→M。
      //   全 false 仍走无后缀短路（下方三元运算符的 else 分支）——禁恒拼 R0F0M0P0L0，
      //   否则关闭态键集合整体偏移，静默破 R-01（C-2 硬约束，同上方警示）。
      const anyAdv = usedRecip || usedFact || usedMod || usedPow || usedLog;
      const k = anyAdv
        ? `${baseK}|R${usedRecip ? 1 : 0}F${usedFact ? 1 : 0}M${usedMod ? 1 : 0}P${usedPow ? 1 : 0}L${usedLog ? 1 : 0}`
        : baseK;
      if (anyAdv) {
        if (!advanced.has(k)) {
          const disp = renderDisplay(node);
          advanced.set(k, disp);
          // 🔴 task-111 GUI-1：同时留存展示文本 → AST 节点的映射，
          //   供 UI 将高级解拆成分步（不改键、不改 advanced 内容 ⇒ 不触碰 R-01）。
          if (!advancedNodes.has(disp)) advancedNodes.set(disp, node);
        }
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
    advancedNodes,   // 🔴 task-111 GUI-1：展示文本 → AST，供分步提示使用
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
  // 🔴 task-111 GUI-1：额外导出 advancedTop 对应的【AST 节点】。
  //   旧实现只给渲染后的字符串 ⇒ UI 拿不到结构 ⇒ 只能把整条算式塞进 lhs
  //   ⇒ 仅高级解牌组的提示退化为「显示完整算式」（与初级解分步口径不一）。
  //   result.advanced 是 Map<key, display>，只存了展示文本；故此处用 nodes 旁路回取。
  const aTop = a.length ? a[0] : null;
  let advancedTopNode = null;
  if (aTop && result.advancedNodes) advancedTopNode = result.advancedNodes.get(aTop) || null;
  return {
    primary: p.slice(0, limit),
    advanced: a.slice(0, limit),
    counts: { primary: result.primary.size, advanced: result.advanced.size },
    primaryTop: p.length ? p[0] : null,
    advancedTop: aTop,
    advancedTopNode,
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
  advPostOrderSteps,   // 🔴 task-111 GUI-1：高级解分步
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
