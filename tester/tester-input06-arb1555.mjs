// tester-input06-arb1555.mjs — [1,5,5,5] 有效倒数解数独立仲裁（R-11④ 分歧项）
// Tester 从零独立实现：叶子倒数枚举 + 标准 24 点 DFS + §1.2.3 归约 + 去重
// 完全不 import js/core/*，用于仲裁 R-11④ 写 24 而 Developer/Architect 实测 22 的分歧。

import { Q, qadd, qsub, qmul, qdiv, is24, qs, reduceFix, countRecipLeaf, renderMy, evalQ, parseExpr } from './tester-input06-lib.mjs';

console.log('tester-input06-arb1555.mjs  @ ' + new Date().toISOString());

// 我自己的 AST 结构与 lib 一致：{k:'num',v} | {k:'recip',c} | {k:'bin',op,a,b}
function leafVariants(cards, skipOne = true, skipZero = true) {
  const out = [];
  const rec = (i, acc) => {
    if (i === cards.length) { out.push(acc.slice()); return; }
    const c = cards[i];
    acc.push({ k: 'num', v: c }); rec(i + 1, acc); acc.pop();
    const skip = (skipOne && c === 1) || (skipZero && c === 0);
    if (!skip) { acc.push({ k: 'recip', c }); rec(i + 1, acc); acc.pop(); }
  };
  rec(0, []);
  return out;
}

function myKey(nd) {
  if (nd.k === 'num') return 'N' + nd.v;
  if (nd.k === 'recip') return 'R' + nd.c;
  const ka = myKey(nd.a), kb = myKey(nd.b);
  if (nd.op === '+' || nd.op === '*') {
    const x = ka <= kb ? ka : kb, y = ka <= kb ? kb : ka;
    return `(${nd.op} ${x} ${y})`;
  }
  return `(${nd.op} ${ka} ${kb})`;
}

function enumerate(cards, opts = {}) {
  const skipOne = opts.skipOne !== false;
  const primary = new Map(), advanced = new Map(), cancelled = new Map();
  let raw = 0;
  const dfs = (items) => {
    if (items.length === 1) {
      if (is24(items[0].q)) {
        raw++;
        const nd = items[0].nd;
        const rr = reduceFix(nd);
        const after = countRecipLeaf(rr.node, skipOne);
        const before = countRecipLeaf(nd, skipOne);
        if (after > 0) { const k = myKey(nd); if (!advanced.has(k)) advanced.set(k, renderMy(nd)); }
        else if (before > 0) { const k = myKey(rr.node); if (!cancelled.has(k)) cancelled.set(k, renderMy(nd)); }
        else { const k = myKey(nd); if (!primary.has(k)) primary.set(k, renderMy(nd)); }
      }
      return;
    }
    const n = items.length;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      if (i === j) continue;
      const rest = []; for (let k = 0; k < n; k++) if (k !== i && k !== j) rest.push(items[k]);
      const A = items[i], B = items[j];
      for (const op of ['+', '-', '*', '/']) {
        if ((op === '+' || op === '*') && i > j) continue;
        let q = null;
        if (op === '+') q = qadd(A.q, B.q);
        else if (op === '-') q = qsub(A.q, B.q);
        else if (op === '*') q = qmul(A.q, B.q);
        else q = qdiv(A.q, B.q);
        if (!q) continue;
        dfs([{ nd: { k: 'bin', op, a: A.nd, b: B.nd }, q }, ...rest]);
      }
    }
  };
  for (const lv of leafVariants(cards, skipOne)) {
    dfs(lv.map((nd) => ({ nd, q: nd.k === 'num' ? Q(nd.v) : Q(1, nd.c) })));
  }
  const cancelledTotal = cancelled.size;
  for (const k of primary.keys()) cancelled.delete(k);
  return { primary, advanced, cancelled, cancelledTotal, raw };
}

// ---------- 主仲裁：[1,5,5,5] ----------
console.log('\n' + '='.repeat(70));
console.log('[1,5,5,5] Tester 独立全量枚举（口径 A：1/1 不枚举、usedRecip 归约后判定）');
console.log('='.repeat(70));
const A = enumerate([1, 5, 5, 5]);
console.log(`primary=${A.primary.size}  advanced=${A.advanced.size}  cancelled(删前)=${A.cancelledTotal}  cancelled(残余)=${A.cancelled.size}  rawHits=${A.raw}`);
console.log('\n全部 advanced 解（独立枚举，逐条附独立复算值）：');
const list = [...A.advanced.values()].sort((a, b) => (a.length - b.length) || (a < b ? -1 : 1));
list.forEach((e, i) => {
  const q = evalQ(parseExpr(e));
  console.log(`  ${String(i + 1).padStart(2)}. ${e.padEnd(28)} = ${qs(q)}`);
});

// ---------- 口径 B：若允许 1/1 参与枚举并计入高级（对照，验证 24 是否来自此口径） ----------
console.log('\n' + '='.repeat(70));
console.log('[1,5,5,5] 对照口径 B：允许 1/1 展开且 1/1 计入 usedRecip');
console.log('='.repeat(70));
const B = enumerate([1, 5, 5, 5], { skipOne: false });
console.log(`primary=${B.primary.size}  advanced=${B.advanced.size}  cancelled(删前)=${B.cancelledTotal}  残余=${B.cancelled.size}`);

// ---------- 口径 C：不执行 §1.2.3 尾句删除步（advanced 不受影响，仅看 cancelled） ----------
console.log('\n' + '='.repeat(70));
console.log('口径对照汇总');
console.log('='.repeat(70));
console.log(`口径 A（INPUT-06 §1.2.2「c=1 时只有 1」严格实现）: advanced = ${A.advanced.size}`);
console.log(`口径 B（1/1 也算高级，违反 §1.2.2/R-04.1）      : advanced = ${B.advanced.size}`);
console.log(`R-11④ 基准表写                                   : 24`);

// ---------- 交叉验证：其余 8 组基准 ----------
console.log('\n' + '='.repeat(70));
console.log('交叉验证：R-11④ 其余 8 组基准（Tester 独立枚举）');
console.log('='.repeat(70));
const CASES = [[[1, 2, 3, 4], 48], [[2, 3, 4, 6], 34], [[1, 3, 4, 6], 30], [[3, 3, 8, 8], 17],
                [[1, 2, 5, 10], 16], [[1, 1, 3, 8], 10], [[1, 4, 6, 8], 5], [[2, 4, 5, 8], 3]];
let allOk = true;
for (const [cards, want] of CASES) {
  const r = enumerate(cards);
  const ok = r.advanced.size === want;
  if (!ok) allOk = false;
  console.log(`  ${ok ? 'ok ' : 'XX '} ${JSON.stringify(cards).padEnd(15)} 独立=${String(r.advanced.size).padStart(3)}  基准=${String(want).padStart(3)}  primary=${r.primary.size} cancelled=${r.cancelledTotal}`);
}
console.log(`\n其余 8 组与基准${allOk ? '完全一致 ✅（说明算法口径对齐，[1,5,5,5] 非系统性偏差）' : '存在偏差 ❌'}`);
// 🔴 task-122 修正（行为型审计器抓到，非静态 grep）：
//   本支有 allOk 判定却**完全无退出码语句** ⇒ Node 默认 rc=0。
//   实测注入 allOk=false：输出确实变为「存在偏差 ❌」而 **rc 仍为 0** ⇒ CI 只看退出码会静默吞红。
//   条款 8：退出码须反映断言结果。
process.exit(allOk ? 0 : 1);
