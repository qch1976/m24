// tester-input06-lib.mjs — Tester 独立工具库（task-65 / INPUT-06）
// 硬要求：禁 solver 自证 —— 本文件不 import 任何 js/core/*，
//   自行实现 Fraction(BigInt)、表达式字符串 tokenizer/parser、求值、
//   以及一套**独立实现**的乘除链归约（与 RecipSolver 算法同口径但代码独立），
//   用于交叉验证 solver 的 §1.2.3 判定。
//
// 支持的表达式字面（RecipSolver.renderDisplay 输出形态）：
//   数字：1..13
//   倒数：(1/c)   ← c 为 1..13 的字面数字；本形态即"倒数叶子"
//   运算：+ - × ÷ （亦兼容 * /）
//   括号：( )

// ============ Fraction（BigInt，独立实现） ============
function g(a, b) { a = a < 0n ? -a : a; b = b < 0n ? -b : b; while (b) { const t = a % b; a = b; b = t; } return a; }
export function Q(n, d = 1n) {
  n = BigInt(n); d = BigInt(d);
  if (d === 0n) return null;
  if (d < 0n) { n = -n; d = -d; }
  const k = g(n, d) || 1n;
  return { n: n / k, d: d / k };
}
export const qadd = (a, b) => (a && b ? Q(a.n * b.d + b.n * a.d, a.d * b.d) : null);
export const qsub = (a, b) => (a && b ? Q(a.n * b.d - b.n * a.d, a.d * b.d) : null);
export const qmul = (a, b) => (a && b ? Q(a.n * b.n, a.d * b.d) : null);
export const qdiv = (a, b) => (a && b && b.n !== 0n ? Q(a.n * b.d, a.d * b.n) : null);
export const qeq = (a, b) => !!a && !!b && a.n === b.n && a.d === b.d;
export const is24 = (q) => !!q && q.d !== 0n && q.n === 24n * q.d;   // 精确，禁浮点
export const qs = (q) => (q ? (q.d === 1n ? String(q.n) : `${q.n}/${q.d}`) : 'null');

// ============ tokenizer ============
export function lex(src) {
  const s = String(src).replace(/\s+/g, '');
  const out = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (c >= '0' && c <= '9') {
      let j = i; while (j < s.length && s[j] >= '0' && s[j] <= '9') j++;
      out.push({ t: 'num', v: parseInt(s.slice(i, j), 10) }); i = j; continue;
    }
    if (c === '(') { out.push({ t: '(' }); i++; continue; }
    if (c === ')') { out.push({ t: ')' }); i++; continue; }
    if (c === '+' || c === '-') { out.push({ t: 'op', v: c }); i++; continue; }
    if (c === '×' || c === '*') { out.push({ t: 'op', v: '*' }); i++; continue; }
    // ★ 关键区分：renderDisplay 中真正的除法一律输出 '÷'；ASCII '/' 只出现在倒数字面 (1/c)。
    //   因此保留两者差异 —— 'SLASH' 若出现在非 (1/叶子) 形态即为「1/(中间值)」红灯证据。
    if (c === '÷') { out.push({ t: 'op', v: '/', div: true }); i++; continue; }
    if (c === '/') { out.push({ t: 'op', v: '/', slash: true }); i++; continue; }
    throw new Error('lex: 未识别字符 ' + c + ' @' + i + ' in ' + src);
  }
  return out;
}

// ============ 独立 parser：产出我自己的 AST ============
// node: {k:'num', v:int} | {k:'recip', c:int} | {k:'bin', op, a, b}
// 关键点：把字面 (1/c) 识别为 recip 叶子；识别在 primary 层完成
export function parseExpr(src) {
  const ts = lex(src);
  let p = 0;
  const peek = () => (p < ts.length ? ts[p] : null);
  function expr() {
    let n = term();
    for (;;) {
      const t = peek();
      if (t && t.t === 'op' && (t.v === '+' || t.v === '-')) { p++; n = { k: 'bin', op: t.v, a: n, b: term() }; }
      else return n;
    }
  }
  function term() {
    let n = primary();
    for (;;) {
      const t = peek();
      if (t && t.t === 'op' && (t.v === '*' || t.v === '/')) { p++; n = { k: 'bin', op: t.v, a: n, b: primary(), slash: !!t.slash }; }
      else return n;
    }
  }
  function primary() {
    const t = ts[p];
    if (!t) throw new Error('parse: 意外结束 in ' + src);
    if (t.t === 'num') { p++; return { k: 'num', v: t.v }; }
    if (t.t === '(') {
      // 尝试匹配倒数字面 ( 1 / c )
      if (ts[p + 1] && ts[p + 1].t === 'num' && ts[p + 1].v === 1 &&
          ts[p + 2] && ts[p + 2].t === 'op' && ts[p + 2].slash === true &&
          ts[p + 3] && ts[p + 3].t === 'num' &&
          ts[p + 4] && ts[p + 4].t === ')') {
        const c = ts[p + 3].v; p += 5; return { k: 'recip', c };
      }
      p++; const inner = expr();
      if (!ts[p] || ts[p].t !== ')') throw new Error('parse: 缺右括号 in ' + src);
      p++; return inner;
    }
    throw new Error('parse: 意外 token ' + t.t + ' in ' + src);
  }
  const ast = expr();
  if (p !== ts.length) throw new Error('parse: 尾部残留 @' + p + ' in ' + src);
  return ast;
}

// ============ 独立求值（Fraction 精确） ============
export function evalQ(nd) {
  if (!nd) return null;
  if (nd.k === 'num') return Q(nd.v);
  if (nd.k === 'recip') return nd.c === 0 ? null : Q(1, nd.c);
  const a = evalQ(nd.a), b = evalQ(nd.b);
  if (!a || !b) return null;
  switch (nd.op) {
    case '+': return qadd(a, b);
    case '-': return qsub(a, b);
    case '*': return qmul(a, b);
    case '/': return qdiv(a, b);
    default: return null;
  }
}

// ============ 用牌 multiset（判 4 张各用 1 次） ============
export function usedCards(nd, acc = []) {
  if (nd.k === 'num') { acc.push(nd.v); return acc; }
  if (nd.k === 'recip') { acc.push(nd.c); return acc; }
  usedCards(nd.a, acc); usedCards(nd.b, acc); return acc;
}
export const msKey = (arr) => arr.slice().sort((x, y) => x - y).join(',');

// ============ 倒数叶子性检查（R-04.1 阴性红灯项） ============
// 在本 AST 里 recip 只以 {k:'recip',c} 出现 ⇒ 若源串出现 1/(运算式) 形态，
// parseExpr 会解析为 bin('/',num1,<expr>) 而非 recip；因此专门扫描
// "分子恒为 1 且分母为非叶子" 的除法节点，作为可疑上报。
// ★ 红灯判据（精确）：ASCII '/' 只允许出现在倒数字面 (1/叶子) 中。
//   若 bin 节点带 slash:true（即源串用了 ASCII '/' 而非 '÷'），说明 renderDisplay
//   输出了「1/(非叶子)」形态 —— 违反 §1.2.2。'÷' 形态的 1÷(中间值) 是合法初级除法
//   （§8 参考数据里 [1,4,6,8] 最短解就是 1/(((1/6)+(1/8))-(1/4))，此处 1 是牌面数字）。
export function findNonLeafRecip(nd, out = []) {
  if (nd.k === 'bin') {
    if (nd.slash === true) out.push(nd);
    findNonLeafRecip(nd.a, out); findNonLeafRecip(nd.b, out);
  }
  return out;
}
export function countRecipLeaf(nd, skipOne = true) {
  if (nd.k === 'num') return 0;
  if (nd.k === 'recip') return (skipOne && nd.c === 1) ? 0 : 1;
  return countRecipLeaf(nd.a, skipOne) + countRecipLeaf(nd.b, skipOne);
}

// ============ 独立实现：§1.2.3 乘除链归约（交叉验证用） ============
// 口径：遇 +/- 停止拉平并对子树递归；'/' 右子交换分子/分母表；
//       链内 1/c 翻面消去；迭代至不动点，上限 MAX 保护。
const MAX = 30;
function flat(nd, num, den) {
  if (nd.k === 'bin' && nd.op === '*') { flat(nd.a, num, den); flat(nd.b, num, den); return; }
  if (nd.k === 'bin' && nd.op === '/') { flat(nd.a, num, den); flat(nd.b, den, num); return; }
  num.push(nd);
}
function rebuild(num, den) {
  const ONE = { k: 'num', v: 1 };
  let acc = num.length ? num.reduce((x, y) => ({ k: 'bin', op: '*', a: x, b: y })) : ONE;
  for (const d of den) acc = { k: 'bin', op: '/', a: acc, b: d };
  return acc;
}
export function reduceOnce(nd) {
  if (nd.k === 'num' || nd.k === 'recip') return { node: nd, changed: false };
  if (nd.op === '+' || nd.op === '-') {
    const ra = reduceOnce(nd.a), rb = reduceOnce(nd.b);
    return { node: { k: 'bin', op: nd.op, a: ra.node, b: rb.node }, changed: ra.changed || rb.changed };
  }
  const num = [], den = [];
  flat(nd, num, den);
  let changed = false;
  const on = [], od = [];
  for (const f of num) { if (f.k === 'recip') { od.push({ k: 'num', v: f.c }); changed = true; } else on.push(f); }
  for (const f of den) { if (f.k === 'recip') { on.push({ k: 'num', v: f.c }); changed = true; } else od.push(f); }
  const rec = (arr) => arr.map((f) => {
    if (f.k === 'bin' && (f.op === '+' || f.op === '-')) { const r = reduceOnce(f); if (r.changed) changed = true; return r.node; }
    return f;
  });
  return { node: rebuild(rec(on), rec(od)), changed };
}
export function reduceFix(nd) {
  let cur = nd;
  for (let i = 0; i < MAX; i++) {
    const r = reduceOnce(cur); cur = r.node;
    if (!r.changed) return { node: cur, iters: i + 1, overflow: false };
  }
  return { node: cur, iters: MAX, overflow: true };
}
export function verdictIndependent(src) {
  const ast = parseExpr(src);
  const rr = reduceFix(ast);
  return {
    before: countRecipLeaf(ast),
    after: countRecipLeaf(rr.node),
    verdict: countRecipLeaf(rr.node) > 0 ? '有效' : '无效',
    iters: rr.iters, overflow: rr.overflow,
    reduced: rr.node, valueBefore: evalQ(ast), valueAfter: evalQ(rr.node),
  };
}
// ★ 与 RecipSolver.renderDisplay 口径对齐：除法用 '÷'，乘法用 '×'，
//   ASCII '/' 仅保留给倒数字面 (1/c) —— 否则 (1÷5) 与 (1/5) 会字面歧义。
export function renderMy(nd) {
  if (nd.k === 'num') return String(nd.v);
  if (nd.k === 'recip') return `(1/${nd.c})`;
  const op = nd.op === '*' ? '×' : nd.op === '/' ? '÷' : nd.op;
  return `(${renderMy(nd.a)}${op}${renderMy(nd.b)})`;
}

// ============ 断言计数器 ============
export function mkCounter(tag) {
  const st = { pass: 0, fail: 0, bad: [] };
  const ck = (name, cond, extra) => {
    if (cond) { st.pass++; console.log('  ok  ' + name + (extra ? '   ' + extra : '')); }
    else { st.fail++; st.bad.push(name); console.log('  XX  ' + name + (extra ? '   ' + extra : '')); }
    return !!cond;
  };
  const done = () => {
    console.log('\n' + '='.repeat(70));
    console.log(`[${tag}] pass=${st.pass} fail=${st.fail}  ${st.fail === 0 ? 'ALL PASS ✅' : 'HAS FAIL ❌'}`);
    if (st.fail) { console.log('失败项：'); st.bad.forEach((b) => console.log('   - ' + b)); }
    console.log('='.repeat(70));
    return st.fail === 0;
  };
  return { ck, done, st };
}
