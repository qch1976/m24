// 本文件是被其他脚本 import 的【库】，不是门禁脚本；单独运行无输出、无退出码意义。
// 判红能力在调用它的门禁脚本里，勿据本文件退出码做任何结论。
// ============================================================================
// INPUT-06 去重口径参考实现 v5
// 依据：项目主 2026-08-04 10:49 裁定（四项全 A）
//   ① 去重键统一用归约式键
//   ② 恒等元变体（乘1/除1）算 1 条
//   ③ 加减链同源缺陷本迭代一起修
//   ④ 初级解跟着统一到同一口径
// 硬约束：全程 Fraction（BigInt），禁 ===24 / ==24 / toFixed()
// ============================================================================

// ---- Fraction（BigInt 分子/分母，恒约简、分母恒正）----
export const bg = (a, b) => { while (b) { const t = a % b; a = b; b = t; } return a < 0n ? -a : a; };
export const F = (n, d = 1n) => {
  n = BigInt(n); d = BigInt(d);
  if (d === 0n) return null;                       // 除零 → null 向上传播
  if (d < 0n) { n = -n; d = -d; }
  const g = bg(n < 0n ? -n : n, d) || 1n;
  return { n: n / g, d: d / g };
};
export const add = (a, b) => (!a || !b) ? null : F(a.n * b.d + b.n * a.d, a.d * b.d);
export const sub = (a, b) => (!a || !b) ? null : F(a.n * b.d - b.n * a.d, a.d * b.d);
export const mul = (a, b) => (!a || !b) ? null : F(a.n * b.n, a.d * b.d);
export const div = (a, b) => (!a || !b || b.n === 0n) ? null : F(a.n * b.d, a.d * b.n);
// 目标判定：24 = n/d ⟺ n === 24*d。禁 ===24 / toFixed
export const is24 = f => !!f && f.d !== 0n && f.n === 24n * f.d;
export const fEq = (a, b) => !!a && !!b && a.n === b.n && a.d === b.d;
export const isZero = f => !!f && f.n === 0n;
export const isOneF = f => !!f && f.n === f.d;

// ---- 节点 ----
// op: 'num'(牌面) | 'one'(归约产生的恒等 1，与牌面 1 区分) | 'recip'(叶子倒数) | '+'|'-'|'*'|'/'
export const numLeaf = c => ({ op: 'num', v: F(c), card: c });
export const recipLeaf = c => ({ op: 'recip', arg: numLeaf(c), v: F(1, c) });
export const ONE = { op: 'one', v: F(1) };
export const ZERO = { op: 'zero', v: F(0) };

export const cntRecip = t =>
  (t.op === 'num' || t.op === 'one' || t.op === 'zero') ? 0
  : t.op === 'recip' ? 1
  : cntRecip(t.a) + cntRecip(t.b);

export const render = t =>
  t.op === 'one' ? '1'
  : t.op === 'zero' ? '0'
  : t.op === 'num' ? String(t.card)
  : t.op === 'recip' ? `(1/${t.arg.card})`
  : `(${render(t.a)}${t.op}${render(t.b)})`;

// ============================================================================
// §规范 R1：canonical key（先声明，归约内部排序依赖它）
//   - '+'/'*' 交换律：子键字典序排序
//   - '-'/'/' 非交换：保持左右
//   - 全括号 ⇒ 冗余括号天然消除
//   - ONE/nX ≡ recip(X)：两种倒数书写形态归一（裁定②配套）
// ============================================================================
export function keySol(t) {
  if (t.op === '/' && t.a.op === 'one' && t.b.op === 'num') return 'r' + t.b.card;
  if (t.op === 'one') return 'ONE';
  if (t.op === 'zero') return 'ZERO';
  if (t.op === 'num') return 'n' + t.card;
  if (t.op === 'recip') return 'r' + t.arg.card;
  const a = keySol(t.a), b = keySol(t.b);
  if (t.op === '+' || t.op === '*') { const [x, y] = a <= b ? [a, b] : [b, a]; return `(${t.op} ${x} ${y})`; }
  return `(${t.op} ${a} ${b})`;
}
const byKey = (x, y) => { const a = keySol(x), b = keySol(y); return a < b ? -1 : a > b ? 1 : 0; };

// ============================================================================
// §规范 R2：乘除链拉平 —— 遇 +/- 停止，对子树递归
// ============================================================================
function flatMul(t, num, den) {
  if (t.op === '*') { flatMul(t.a, num, den); flatMul(t.b, num, den); return; }
  if (t.op === '/') { flatMul(t.a, num, den); flatMul(t.b, den, num); return; }  // 除数翻面
  num.push(t);                                                                   // +/- 与叶子：停止
}
// ============================================================================
// §规范 R3：加减链拉平 —— 遇 *// 停止，对子树递归（裁定③）
//   收集 (节点, 符号) 对；减法右子树整体反号
// ============================================================================
function flatAdd(t, terms, sign) {
  if (t.op === '+') { flatAdd(t.a, terms, sign); flatAdd(t.b, terms, sign); return; }
  if (t.op === '-') { flatAdd(t.a, terms, sign); flatAdd(t.b, terms, -sign); return; }
  terms.push({ node: t, sign });
}

// ---- R4：从 num/den 重建乘除链（排序归一 + 消恒等元）----
function rebuildMul(num, den) {
  const isIdent = x => (x.op === 'num' && x.card === 1) || x.op === 'one';
  const N = num.filter(x => !isIdent(x)).sort(byKey);
  const D = den.filter(x => !isIdent(x)).sort(byKey);
  let a = N.length ? N.reduce((x, y) => ({ op: '*', a: x, b: y })) : ONE;
  for (const q of D) a = { op: '/', a, b: q };
  return a;
}
// ---- R5：从 terms 重建加减链（排序归一 + 同项抵消 + 消零）----
function rebuildAdd(terms) {
  // 同项抵消：同 key 的 +1/-1 成对消去（裁定③核心）
  const bucket = new Map();
  for (const { node, sign } of terms) {
    const k = keySol(node);
    if (!bucket.has(k)) bucket.set(k, { node, net: 0 });
    bucket.get(k).net += sign;
  }
  const pos = [], neg = [];
  for (const { node, net } of bucket.values()) {
    if (net === 0) continue;                                  // ±c 抵消 ⇒ 整项消失
    const abs = Math.abs(net);
    for (let i = 0; i < abs; i++) (net > 0 ? pos : neg).push(node);
  }
  // 消零项：+0 / -0 无意义
  const nz = a => a.filter(x => !(x.op === 'zero') && !(x.op === 'num' && x.card === 0));
  const P = nz(pos).sort(byKey), Ng = nz(neg).sort(byKey);
  if (!P.length && !Ng.length) return ZERO;                   // 全抵消 ⇒ 0
  let a;
  if (P.length) { a = P.reduce((x, y) => ({ op: '+', a: x, b: y })); }
  else { a = ZERO; }
  for (const q of Ng) a = { op: '-', a, b: q };
  return a;
}

// ============================================================================
// §规范 R6：单轮归约 reduceOnce
// ============================================================================
export function reduceOnce(t) {
  if (t.op === 'num' || t.op === 'one' || t.op === 'zero' || t.op === 'recip') return { node: t, changed: false };
  let ch = false;
  const recur = x => { const r = reduceOnce(x); if (r.changed) ch = true; return r.node; };

  if (t.op === '+' || t.op === '-') {
    // R3 加减链拉平 → 子项递归归约 → R5 重建（抵消/消零/排序）
    const terms = []; flatAdd(t, terms, 1);
    const red = terms.map(({ node, sign }) => ({ node: recur(node), sign }));
    const out = rebuildAdd(red);
    if (keySol(out) !== keySol(t)) ch = true;
    return { node: out, changed: ch };
  }

  // R2 乘除链拉平 → recip 翻面 → 子项递归 → R4 重建
  const num = [], den = [];
  flatMul(t, num, den);
  const on = [], od = [];
  for (const f of num) { if (f.op === 'recip') { od.push(f.arg); ch = true; } else on.push(f); }
  for (const f of den) { if (f.op === 'recip') { on.push(f.arg); ch = true; } else od.push(f); }
  const out = rebuildMul(on.map(recur), od.map(recur));
  if (keySol(out) !== keySol(t)) ch = true;
  return { node: out, changed: ch };
}

// ============================================================================
// §规范 R7：不动点迭代，上限 30 轮（INPUT-06 §7.8）
// ============================================================================
export const MAX_ITER = 30;
export function reduceFix(t) {
  let c = t;
  for (let i = 0; i < MAX_ITER; i++) {
    const r = reduceOnce(c);
    c = r.node;
    if (!r.changed) return { node: c, iters: i + 1, overflow: false };
  }
  return { node: c, iters: MAX_ITER, overflow: true };
}

// ============================================================================
// §规范 R8：枚举（叶子倒数变体 × 二叉树形 × 运算符）
// ============================================================================
const OPS = ['+', '-', '*', '/'];
export function dfs(items, cb) {
  const N = items.length;
  if (N === 1) { if (is24(items[0].v)) cb(items[0].t); return; }
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
    if (i === j) continue;
    const rest = items.filter((_, k) => k !== i && k !== j);
    for (const op of OPS) {
      const va = items[i].v, vb = items[j].v;
      // 交换律剪枝：+ 与 * 只取 i<j，避免同一组合枚举两次
      if ((op === '+' || op === '*') && i > j) continue;
      const v = op === '+' ? add(va, vb) : op === '-' ? sub(va, vb) : op === '*' ? mul(va, vb) : div(va, vb);
      if (!v) continue;                                     // 除零剪枝
      dfs([...rest, { t: { op, a: items[i].t, b: items[j].t }, v }], cb);
    }
  }
}
// 叶子变体：每张牌可为原值或其倒数；1 的倒数 = 1 无意义故排除（INPUT-06 §1.2）
export function leafVariants(cards) {
  const out = [];
  const rec = (i, acc) => {
    if (i === cards.length) { out.push(acc); return; }
    const c = cards[i];
    rec(i + 1, [...acc, numLeaf(c)]);
    if (c !== 1) rec(i + 1, [...acc, recipLeaf(c)]);
  };
  rec(0, []);
  return out;
}

// ============================================================================
// §规范 R9：解集分类与去重（裁定①④：三分区统一用归约式键）
//   primary   : 归约后不含 recip（纯初级）
//   advanced  : 归约后仍含 recip（真正用到倒数）
//   cancelled : 原式含 recip 但归约后消尽 —— 按裁定 rawHits 级计数（不去重）
//   usedRecip 判定必须在归约之后（硬约束）
// ============================================================================
export function solveDeck(cards) {
  const primary = new Map(), advanced = new Map();
  let rawHits = 0, cancelledRaw = 0, maxIters = 0, overflow = 0;
  for (const lv of leafVariants(cards)) {
    dfs(lv.map(t => ({ t, v: t.v })), node => {
      rawHits++;
      const rr = reduceFix(node);
      if (rr.overflow) overflow++;
      if (rr.iters > maxIters) maxIters = rr.iters;
      const usedRecip = cntRecip(rr.node) > 0;               // ★ 归约之后判定
      const hadRecip = cntRecip(node) > 0;
      const k = keySol(rr.node);                             // ★ 统一归约式键
      if (usedRecip) { if (!advanced.has(k)) advanced.set(k, render(node)); }
      else {
        if (hadRecip) cancelledRaw++;                        // rawHits 级诊断计数
        if (!primary.has(k)) primary.set(k, render(node));
      }
    });
  }
  return { primary, advanced, cancelledRaw, rawHits, maxIters, overflow };
}

// ---- R10：展示排序（短优先 → 倒数少优先 → 字典序）----
export function sortSolutions(exprs) {
  const advCount = e => (e.match(/\(1\//g) || []).length;
  return exprs.slice().sort((a, b) => a.length - b.length || advCount(a) - advCount(b) || (a < b ? -1 : a > b ? 1 : 0));
}
