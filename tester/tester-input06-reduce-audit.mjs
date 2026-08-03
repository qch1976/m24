// tester-input06-reduce-audit.mjs — 归约保牌性审计（Tester 主动深挖）
// 动机：Tester 独立实现与被测实现的 rebuildChain 在「分子表被清空」时都会注入
//   一个合成字面 1（ONE）。若原牌组不含 1，则「等价非倒数式」实际上不存在于本牌组，
//   §1.2.3 的「等价于某个非倒数解 ⇒ 无效」前提不成立 ⇒ 可能误杀本质倒数解（假阴性）。
// 本脚本对大量牌组做全量枚举，检出 cancelled 集合中「归约后数字 multiset ≠ 原 4 张牌」的条目。
// 判定口径：warning（数据上报），是否红灯由 Manager/Architect 裁定。

import { Q, qadd, qsub, qmul, qdiv, is24, qs, reduceFix, countRecipLeaf, renderMy, evalQ, parseExpr, usedCards, msKey } from './tester-input06-lib.mjs';
import { solve as solverSolve } from '../js/core/RecipSolver.mjs';

console.log('tester-input06-reduce-audit.mjs  @ ' + new Date().toISOString());

function lv(cards) {
  const out = [];
  const rec = (i, acc) => {
    if (i === cards.length) { out.push(acc.slice()); return; }
    const c = cards[i];
    acc.push({ k: 'num', v: c }); rec(i + 1, acc); acc.pop();
    if (c !== 0 && c !== 1) { acc.push({ k: 'recip', c }); rec(i + 1, acc); acc.pop(); }
  };
  rec(0, []); return out;
}
function key(nd) {
  if (nd.k === 'num') return 'N' + nd.v;
  if (nd.k === 'recip') return 'R' + nd.c;
  const a = key(nd.a), b = key(nd.b);
  if (nd.op === '+' || nd.op === '*') return `(${nd.op} ${a <= b ? a : b} ${a <= b ? b : a})`;
  return `(${nd.op} ${a} ${b})`;
}
// 数字 multiset（把 recip(c) 也算作用了牌 c）
function numsOf(nd, acc = []) {
  if (nd.k === 'num') { acc.push(nd.v); return acc; }
  if (nd.k === 'recip') { acc.push(nd.c); return acc; }
  numsOf(nd.a, acc); numsOf(nd.b, acc); return acc;
}

function enumFull(cards) {
  const primary = new Map(), advanced = new Map(), cancelled = new Map();
  const dfs = (items) => {
    if (items.length === 1) {
      if (is24(items[0].q)) {
        const nd = items[0].nd, rr = reduceFix(nd);
        const af = countRecipLeaf(rr.node), bf = countRecipLeaf(nd);
        if (af > 0) { const k = key(nd); if (!advanced.has(k)) advanced.set(k, renderMy(nd)); }
        else if (bf > 0) { const k = key(rr.node); if (!cancelled.has(k)) cancelled.set(k, { orig: renderMy(nd), red: renderMy(rr.node), redNode: rr.node }); }
        else { const k = key(nd); if (!primary.has(k)) primary.set(k, renderMy(nd)); }
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
        const q = op === '+' ? qadd(A.q, B.q) : op === '-' ? qsub(A.q, B.q) : op === '*' ? qmul(A.q, B.q) : qdiv(A.q, B.q);
        if (!q) continue;
        dfs([{ nd: { k: 'bin', op, a: A.nd, b: B.nd }, q }, ...rest]);
      }
    }
  };
  for (const v of lv(cards)) dfs(v.map((nd) => ({ nd, q: nd.k === 'num' ? Q(nd.v) : Q(1, nd.c) })));
  return { primary, advanced, cancelled };
}

// ---------- 扫描 ----------
const SETS = [];
for (const a of [2, 3, 4, 5, 6, 7, 8]) for (const b of [2, 3, 4, 5, 6, 7, 8]) for (const c of [2, 3, 4, 5, 6, 7, 8]) for (const d of [2, 3, 4, 5, 6, 7, 8]) {
  if (a <= b && b <= c && c <= d) SETS.push([a, b, c, d]);
}
// 追加含 1 的对照组
SETS.push([1, 5, 5, 5], [1, 2, 3, 4], [1, 3, 4, 6], [1, 1, 3, 8], [1, 4, 6, 8], [1, 2, 5, 10]);
console.log(`扫描牌组数 = ${SETS.length}（2..8 的非降序 4 元组 + 6 组含 1 对照）`);

let totalCancelled = 0, cardBreakCases = 0, noOneCases = 0;
const samples = [];
for (const cards of SETS) {
  const r = enumFull(cards);
  const origKey = msKey(cards);
  const hasOne = cards.includes(1);
  for (const [, v] of r.cancelled) {
    totalCancelled++;
    const nk = msKey(numsOf(v.redNode));
    if (nk !== origKey) {
      cardBreakCases++;
      if (!hasOne) {
        noOneCases++;
        if (samples.length < 12) samples.push({ cards, orig: v.orig, red: v.red, nums: numsOf(v.redNode) });
      }
    }
  }
}
console.log(`\ncancelled 总条目 = ${totalCancelled}`);
console.log(`归约后数字 multiset ≠ 原牌组 的条目 = ${cardBreakCases}`);
console.log(`其中「原牌组不含 1」（等价非倒数式在本牌组不存在 ⇒ 疑似误杀） = ${noOneCases}`);
if (samples.length) {
  console.log('\n样例（最多 12 条）：');
  for (const s of samples) {
    const q = evalQ(parseExpr(s.orig));
    console.log(`  cards=${JSON.stringify(s.cards)}  orig=${s.orig} (=${qs(q)})`);
    console.log(`      归约=${s.red}   归约后数字=${JSON.stringify(s.nums)}  ← 注入了合成 1`);
  }
}

// ---------- 与被测系统交叉：同一牌组 advanced 计数是否一致 ----------
console.log('\n' + '='.repeat(70));
console.log('交叉：Tester 独立 advanced 计数 vs 被测 RecipSolver.solve advanced 计数（全扫描）');
console.log('='.repeat(70));
let diff = 0, checked = 0;
const diffList = [];
for (const cards of SETS) {
  const mine = enumFull(cards).advanced.size;
  const theirs = solverSolve(cards).advanced.size;
  checked++;
  if (mine !== theirs) { diff++; diffList.push({ cards, mine, theirs }); }
}
console.log(`比对牌组 ${checked} 组，advanced 计数不一致 ${diff} 组`);
if (diffList.length) for (const d of diffList.slice(0, 20)) console.log(`  XX ${JSON.stringify(d.cards)} 独立=${d.mine} 被测=${d.theirs}`);
else console.log('  ok  两套独立实现 advanced 计数 100% 一致');

console.log('\n结论（数据，不做裁定）：');
console.log(`  · 归约保值性：已在 r11 脚本逐例验证（Fraction 前后相等）`);
console.log(`  · 归约保牌性：存在 ${cardBreakCases} 条归约后数字 multiset 变化（注入合成 1）`);
console.log(`  · 其中原牌组不含 1 的 ${noOneCases} 条属「等价式在本牌组不可构造」→ 疑似假阴性，需 Architect 裁定`);
console.log(`  · 被测与独立实现 advanced 计数一致性：${diff === 0 ? '100% 一致' : diff + ' 组不一致'}`);
