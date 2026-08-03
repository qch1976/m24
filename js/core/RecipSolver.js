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

// countRecip：统计有效 recip 节点数
// ★ 方案 §4.7：arg.card === 1 的 recip（即 1/1）一律跳过 —— 1/1 恒等，
//   不得使表达式被判定为"用了高级符号"（R-04.1）
export function countRecip(t) {
  if (!t || t.op === 'num') return 0;
  if (t.op === 'recip') return t.arg && t.arg.card === 1 ? 0 : 1;
  return countRecip(t.a) + countRecip(t.b);
}

// 渲染：倒数用 (1/c)，乘除用 * /（内部串）；显示层用 renderDisplay
export function render(t) {
  if (t.op === 'num') return String(t.card);
  if (t.op === 'recip') return `(1/${t.arg.card})`;
  return `(${render(t.a)}${t.op}${render(t.b)})`;
}

// 显示层：× ÷ 替换，倒数保持 1/c 形态（与 §5.1 countAdvSymbols 的 "(1/" 计数口径一致）
export function renderDisplay(t) {
  if (t.op === 'num') return String(t.card);
  if (t.op === 'recip') return `(1/${t.arg.card})`;
  const op = t.op === '*' ? '×' : t.op === '/' ? '÷' : t.op;
  return `(${renderDisplay(t.a)}${op}${renderDisplay(t.b)})`;
}

// 独立 evaluator（禁 solver 自证：复算不复用 dfs 里的 v）
export function evalNode(t) {
  if (!t) return null;
  if (t.op === 'num') return F(t.card);
  if (t.op === 'recip') return t.arg.card === 0 ? null : F(1, t.arg.card);
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
  const ONE = { op: 'num', v: F(1), card: 1, slot: -1 };
  let acc = numList.length
    ? numList.reduce((x, y) => ({ op: '*', a: x, b: y }))
    : ONE;
  for (const d of denList) acc = { op: '/', a: acc, b: d };
  return acc;
}

export function reduceOnce(node) {
  if (node.op === 'num' || node.op === 'recip') {
    return { node, changed: false };
  }
  if (node.op === '+' || node.op === '-') {
    // ★ 遇加减停止拉平，对左右子树递归（方案 §2.3）
    const ra = reduceOnce(node.a);
    const rb = reduceOnce(node.b);
    return {
      node: { op: node.op, a: ra.node, b: rb.node },
      changed: ra.changed || rb.changed,
    };
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

  // ★ 链内的加减子树需递归归约（方案 §2.4 边界 B3）
  const recurseList = (arr) => arr.map((f) => {
    if (f.op === '+' || f.op === '-') {
      const r = reduceOnce(f);
      if (r.changed) changed = true;
      return r.node;
    }
    return f;
  });

  return { node: rebuildChain(recurseList(outNum), recurseList(outDen)), changed };
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
export function keySol(t) {
  if (t.op === 'num') return 'n' + t.card;
  if (t.op === 'recip') return 'r' + t.arg.card; // 与整数叶子不同前缀，禁止混淆
  const ka = keySol(t.a);
  const kb = keySol(t.b);
  if (t.op === '+' || t.op === '*') {
    const x = ka <= kb ? ka : kb;
    const y = ka <= kb ? kb : ka;
    return `(${t.op} ${x} ${y})`;
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
 * 全量枚举 4 张牌的初级解 + 有效倒数解 + 被剔除的可消去解
 * @param {number[]} cards 4 个点数（0..13，0=大小王）
 * @returns {{ primary:Map, advanced:Map, cancelled:Map, counts:object, maxIters:number, rawHits:number }}
 */
export function solve(cards) {
  const primary = new Map();
  const advanced = new Map();
  const cancelled = new Map();
  let rawHits = 0;
  let maxIters = 0;
  let overflowCount = 0;

  for (const lv of leafVariants(cards)) {
    const items = lv.map((t) => ({ t, v: t.v }));
    dfs24(items, (node) => {
      rawHits += 1;
      const rr = reduceToFixpoint(node);
      if (rr.iters > maxIters) maxIters = rr.iters;
      if (rr.overflow) overflowCount += 1;
      // ★★ usedRecip 必须在归约之后判定（§7 风险 9 / R-04.3）
      const usedRecip = countRecip(rr.node) > 0;
      const hadRecip = countRecip(node) > 0;
      if (usedRecip) {
        const k = keySol(node);
        if (!advanced.has(k)) advanced.set(k, renderDisplay(node));
      } else if (hadRecip) {
        const k = keySol(rr.node);
        if (!cancelled.has(k)) cancelled.set(k, renderDisplay(node));
      } else {
        const k = keySol(node);
        if (!primary.has(k)) primary.set(k, renderDisplay(node));
      }
    });
  }

  // §1.2.3 尾句：无效倒数解若其归约式与某条已有初级解规范形式相同则直接丢弃
  // ⚠️ 口径说明（Developer 实测确认）：
  //   cancelledTotal = 归约后判为可消去的去重解总数（= §8 参考数据「被剔除」列口径，
  //                    Architect lib-input06-recip.mjs 未执行本删除步，故其复现值即此数）
  //   cancelled(Map) = 执行 §1.2.3 尾句删除后的残余（其归约式未与任何初级解重合者）
  //   R-11② 要求 (8-4)*6 与 (8-4)/(1/6) 归并为 1 条 → 依赖本删除步，故必须执行
  const cancelledTotal = cancelled.size;
  for (const k of primary.keys()) cancelled.delete(k);

  return {
    primary,
    advanced,
    cancelled,
    counts: {
      primary: primary.size,
      advanced: advanced.size,
      cancelled: cancelledTotal,
      cancelledResidual: cancelled.size,
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
};
