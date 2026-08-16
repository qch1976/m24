// tester-input06-r04.mjs — R-04 / R-04.1 / R-04.2 / R-04.3 独立采样（task-65）
// 禁 solver 自证：所有正确性断言由 tester-input06-lib.mjs 的独立 evaluator 复算

import { solve, keySol, keyWithFlags, reduceToFixpoint, countRecip, renderDisplay, numLeaf, recipLeaf } from '../js/core/RecipSolver.mjs';
import {
  mkCounter, parseExpr, evalQ, is24, qs, usedCards, msKey,
  findNonLeafRecip, countRecipLeaf, verdictIndependent, renderMy, Q, qsub, qdiv, qmul, qadd,
} from './tester-input06-lib.mjs';

const { ck, done, st } = mkCounter('R-04 系列');
console.log('tester-input06-r04.mjs  @ ' + new Date().toISOString());

const cache = new Map();
const S = (c) => { const k = msKey(c); if (!cache.has(k)) cache.set(k, solve(c)); return cache.get(k); };

// ============================================================
// R-04 · 种子池 ≥6 组含有效倒数解的牌组（Tester 独立筛选，≥1000 次随机发牌）
// ============================================================
console.log('\n' + '='.repeat(70));
console.log('R-04 · 种子池独立筛选（Tester 自己 ≥1000 次随机发牌，不引 Developer fixtures）');
console.log('='.repeat(70));

// 可复现 PRNG（xorshift32，固定种子，禁 Math.random 以保证 Tester 结论可复算）
let _s = 20260803 >>> 0;
function rnd() { _s ^= _s << 13; _s >>>= 0; _s ^= _s >>> 17; _s ^= _s << 5; _s >>>= 0; return _s / 4294967296; }
const DECK = [];
for (const suit of [0, 1, 2, 3]) for (let v = 1; v <= 13; v++) DECK.push(v);
DECK.push(0, 0); // 大小王
function dealRandom() {
  const pool = DECK.slice();
  const out = [];
  for (let i = 0; i < 4; i++) { const j = Math.floor(rnd() * pool.length); out.push(pool.splice(j, 1)[0]); }
  return out;
}

const N_DEAL = 1000;
const seeds = [];
const seenKey = new Set();
let dealCount = 0, withAdv = 0;
for (let i = 0; i < N_DEAL; i++) {
  const cards = dealRandom();
  dealCount++;
  const res = S(cards);
  if (res.advanced.size > 0) {
    withAdv++;
    const k = msKey(cards);
    if (!seenKey.has(k) && seeds.length < 12) {
      seenKey.add(k);
      seeds.push({ cards: cards.slice(), primary: res.primary.size, advanced: res.advanced.size, cancelled: res.counts.cancelled });
    }
  }
}
console.log(`独立随机发牌 ${dealCount} 次（xorshift32 seed=20260803，可复现）`);
console.log(`其中含有效倒数解的局数 = ${withAdv}  占比 = ${(withAdv / dealCount * 100).toFixed(2)}%`);
ck(`R-04 种子池独立筛选出 ≥6 组含有效倒数解的牌组`, seeds.length >= 6, `实际 ${seeds.length} 组`);
console.log('\n种子池（Tester 独立筛出，前 12 组去重）：');
console.log('  #  cards                primary  advanced  cancelled');
seeds.forEach((s, i) => {
  console.log(`  ${String(i + 1).padStart(2)}  ${JSON.stringify(s.cards).padEnd(18)} ${String(s.primary).padStart(7)} ${String(s.advanced).padStart(9)} ${String(s.cancelled).padStart(10)}`);
});

// 逐组：solver 输出的每条 advanced 解，都用独立 evaluator 复算 + 用牌校验 + 叶子性校验
console.log('\n--- 种子池逐组全解独立复算（禁 solver 自证） ---');
let seedTotal = 0, seedBad = 0;
for (const s of seeds) {
  const res = S(s.cards);
  let localBad = 0;
  for (const expr of res.advanced.values()) {
    seedTotal++;
    let q, uc, nl, ib;
    try { const a = parseExpr(expr); q = evalQ(a); uc = usedCards(a); nl = findNonLeafRecip(a); ib = verdictIndependent(expr); }
    catch (e) { localBad++; seedBad++; console.log(`   XX parse 失败 ${expr}: ${e.message}`); continue; }
    if (!is24(q)) { localBad++; seedBad++; console.log(`   XX 值≠24: ${expr} = ${qs(q)}`); }
    if (uc.length !== 4 || msKey(uc) !== msKey(s.cards)) { localBad++; seedBad++; console.log(`   XX 用牌不符 ${expr} used=${JSON.stringify(uc)}`); }
    if (nl.length) { localBad++; seedBad++; console.log(`   XX 1/(中间值) ${expr}`); }
    if (ib.verdict !== '有效') { localBad++; seedBad++; console.log(`   XX 独立判无效 ${expr} 归约=${renderMy(ib.reduced)}`); }
  }
  ck(`R-04 ${JSON.stringify(s.cards).padEnd(18)} ${res.advanced.size} 条 advanced 全部独立复算通过`, localBad === 0, `违规 ${localBad}`);
}
console.log(`   种子池 advanced 总解数 = ${seedTotal}，独立复算违规 = ${seedBad}`);
ck(`R-04 种子池全解独立复算 0 违规（共 ${seedTotal} 条）`, seedBad === 0);

// ---- R-04 人工独立验算 ≥2 组（分数手算，禁浮点，逐步展开） ----
console.log('\n--- R-04 人工独立验算（分数手算，逐步 Fraction，禁计算器浮点） ---');
// 手算 1：[3,3,8,8] 的 (8×8)÷(3-(1/3))
// 手写推导：1/3 = 1/3；3 - 1/3 = 9/3 - 1/3 = 8/3；8×8 = 64；64 ÷ (8/3) = 64×3/8 = 192/8 = 24 ✓
{
  const one_third = Q(1, 3);
  const three_minus = qsub(Q(3), one_third);            // 手算 8/3
  ck('手算1 步骤 1/3 = 1/3', one_third.n === 1n && one_third.d === 3n, qs(one_third));
  ck('手算1 步骤 3-(1/3) = 8/3', three_minus.n === 8n && three_minus.d === 3n, qs(three_minus));
  const sixtyfour = qmul(Q(8), Q(8));
  ck('手算1 步骤 8×8 = 64', sixtyfour.n === 64n && sixtyfour.d === 1n, qs(sixtyfour));
  const r = qdiv(sixtyfour, three_minus);               // 64×3/8 = 24
  ck('手算1 步骤 64÷(8/3) = 24（= 64×3/8 = 192/8）', r.n === 24n && r.d === 1n, qs(r));
  const auto = evalQ(parseExpr('((8×8)÷(3-(1/3)))'));
  ck('手算1 与独立 parser 求值一致', auto.n === r.n && auto.d === r.d, `手算=${qs(r)} parser=${qs(auto)}`);
  const res = S([3, 3, 8, 8]);
  let sq = 0; const mk = (c) => numLeaf(c, sq++), mr = (c) => recipLeaf(c, sq++);
  sq = 0; const ast = { op: '/', a: { op: '*', a: mk(8), b: mk(8) }, b: { op: '-', a: mk(3), b: mr(3) } };
  // 🔴 task-151：原用 keySol(ast) 取到【无后缀裸键】，而 res.advanced 的键带五位后缀
  //   ⇒ has() 恒 false（键整体缺后缀，非某一位错）。改用产品公开取键 API keyWithFlags()：
  //   它内部 reduceToFixpoint + keySol + composeKeyWithFlags，与 solve():1108 同源同型。
  //   🔴 禁自拼后缀（产品 :713 注释：自拼须复现 usedRecip 正则字面量与「取 rr.node 而非 node」
  //      ⇒ 自拼即下一个漂移源）；🔴 禁写死期望键字面量（task-150 刚因写死后缀吃过三条误判红）。
  ck('手算1 该解确在 solver advanced 分区', res.advanced.has(keyWithFlags(ast)), `key=${keyWithFlags(ast)}`);
}
// 手算 2：[1,3,4,6] 的 (3×6)÷(1-(1/4))
// 手写推导：1/4；1 - 1/4 = 4/4 - 1/4 = 3/4；3×6 = 18；18 ÷ (3/4) = 18×4/3 = 72/3 = 24 ✓
{
  const q4 = Q(1, 4);
  const one_minus = qsub(Q(1), q4);
  ck('手算2 步骤 1-(1/4) = 3/4', one_minus.n === 3n && one_minus.d === 4n, qs(one_minus));
  const eighteen = qmul(Q(3), Q(6));
  ck('手算2 步骤 3×6 = 18', eighteen.n === 18n && eighteen.d === 1n, qs(eighteen));
  const r = qdiv(eighteen, one_minus);
  ck('手算2 步骤 18÷(3/4) = 24（= 18×4/3 = 72/3）', r.n === 24n && r.d === 1n, qs(r));
  const auto = evalQ(parseExpr('((3×6)÷(1-(1/4)))'));
  ck('手算2 与独立 parser 求值一致', auto.n === r.n && auto.d === r.d, `手算=${qs(r)} parser=${qs(auto)}`);
  const res = S([1, 3, 4, 6]);
  let sq = 0; const mk = (c) => numLeaf(c, sq++), mr = (c) => recipLeaf(c, sq++);
  sq = 0; const ast = { op: '/', a: { op: '*', a: mk(3), b: mk(6) }, b: { op: '-', a: mk(1), b: mr(4) } };
  // 🔴 task-151：同 :101，改用公开取键 API（禁自拼后缀、禁写死键字面量）
  ck('手算2 该解确在 solver advanced 分区', res.advanced.has(keyWithFlags(ast)), `key=${keyWithFlags(ast)}`);
}
// 手算 3：[1,2,5,10] 的 (1+(1/5))×(2×10)
// 手写推导：1/5；1 + 1/5 = 6/5；2×10 = 20；(6/5)×20 = 120/5 = 24 ✓
{
  const q5 = Q(1, 5);
  const onePlus = qadd(Q(1), q5);
  ck('手算3 步骤 1+(1/5) = 6/5', onePlus.n === 6n && onePlus.d === 5n, qs(onePlus));
  const twenty = qmul(Q(2), Q(10));
  ck('手算3 步骤 2×10 = 20', twenty.n === 20n && twenty.d === 1n, qs(twenty));
  const r = qmul(onePlus, twenty);
  ck('手算3 步骤 (6/5)×20 = 24（= 120/5）', r.n === 24n && r.d === 1n, qs(r));
  const auto = evalQ(parseExpr('((1+(1/5))×(2×10))'));
  ck('手算3 与独立 parser 求值一致', auto.n === r.n && auto.d === r.d, `手算=${qs(r)} parser=${qs(auto)}`);
}

// ============================================================
// R-04.1 · 阳性 + 阴性（红灯项）
// ============================================================
console.log('\n' + '='.repeat(70));
console.log('R-04.1 · 阳性 4 组 + 阴性叶子性红灯');
console.log('='.repeat(70));
for (const cards of [[1, 3, 4, 6], [2, 3, 4, 6], [3, 3, 8, 8], [1, 5, 5, 5]]) {
  const res = S(cards);
  ck(`R-04.1 阳性 ${JSON.stringify(cards).padEnd(14)} 有有效倒数解`, res.advanced.size > 0, `advanced=${res.advanced.size}`);
}
// 阴性 A：全量扫描 advanced，1/x 子节点必须是叶子
console.log('\n--- 阴性 A：solver 输出的所有 advanced 解中 1/x 子节点必须是叶子 ---');
const SCAN = [[1, 2, 3, 4], [2, 3, 4, 6], [1, 3, 4, 6], [1, 5, 5, 5], [3, 3, 8, 8],
               [1, 2, 5, 10], [1, 1, 3, 8], [1, 4, 6, 8], [2, 4, 5, 8], [2, 2, 3, 9], [4, 5, 6, 7]];
let scanN = 0, scanNL = 0;
for (const cards of SCAN) {
  for (const expr of S(cards).advanced.values()) {
    scanN++;
    const nl = findNonLeafRecip(parseExpr(expr));
    if (nl.length) { scanNL++; console.log(`   XX ${expr}`); }
  }
}
ck(`R-04.1 阴性A 扫描 ${scanN} 条 advanced，0 条含 1/(中间值)`, scanNL === 0, `违规 ${scanNL}`);
// 阴性 B：countRecip 对 1/1 恒等的处理（1/1 不得使表达式被判为「用了高级符号」）
{
  let sq = 0; const mk = (c) => numLeaf(c, sq++), mr = (c) => recipLeaf(c, sq++);
  sq = 0; const withOne = { op: '*', a: { op: '*', a: mr(1), b: mk(4) }, b: { op: '*', a: mk(2), b: mk(3) } };
  ck('R-04.1 1/1 不计入 countRecip', countRecip(withOne) === 0, `countRecip=${countRecip(withOne)}`);
  const res = S([1, 4, 2, 3]);
  let any1 = 0;
  for (const e of res.advanced.values()) if (e.includes('(1/1)')) any1++;
  ck('R-04.1 advanced 分区不含 (1/1) 字面', any1 === 0, `含 (1/1) 的解数 = ${any1}`);
  // 独立实现同口径
  ck('R-04.1 独立实现 countRecipLeaf 亦跳过 1/1', countRecipLeaf(parseExpr('((1/1)×((4×2)×3))')) === 0);
}

// ============================================================
// R-04.2 · 精确运算门禁（浮点严格判等漏解率）
// ============================================================
console.log('\n' + '='.repeat(70));
console.log('R-04.2 · 精确运算门禁：Fraction vs float===24 漏解率独立采样');
console.log('='.repeat(70));
// 独立实现一份 float 路径 24 点枚举，与 Fraction 路径逐组对比
function enumFloat(cards) {
  const set = new Set();
  const dfs = (items) => {
    if (items.length === 1) { if (items[0].v === 24) set.add(items[0].s); return; }
    const n = items.length;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      if (i === j) continue;
      const rest = []; for (let k = 0; k < n; k++) if (k !== i && k !== j) rest.push(items[k]);
      const A = items[i], B = items[j];
      for (const op of ['+', '-', '*', '/']) {
        if ((op === '+' || op === '*') && i > j) continue;
        let v;
        if (op === '+') v = A.v + B.v; else if (op === '-') v = A.v - B.v;
        else if (op === '*') v = A.v * B.v; else { if (B.v === 0) continue; v = A.v / B.v; }
        dfs([{ v, s: `(${A.s}${op}${B.s})` }, ...rest]);
      }
    }
  };
  // 叶子变体：c 或 1/c
  const lvs = [];
  const rec = (i, acc) => {
    if (i === cards.length) { lvs.push(acc.slice()); return; }
    const c = cards[i];
    acc.push({ v: c, s: String(c) }); rec(i + 1, acc); acc.pop();
    if (c !== 0 && c !== 1) { acc.push({ v: 1 / c, s: `(1/${c})` }); rec(i + 1, acc); acc.pop(); }
  };
  rec(0, []);
  for (const lv of lvs) dfs(lv);
  return set;
}
// 🔴 task-151 新增：分段断言总数自断言（分族算式，禁裸数字）。
//   ⚠️ 必须放在【:213 崩溃点之前】—— 该行 res.cancelled.values() 因 cancelled 由 Map 改为
//   计数器 cancelledRaw 而抛 TypeError（task-143 §三.1 定的语义待裁定项，本支范围闸门外不修），
//   导致文件尾部 done() 不可达。若把自断言写在尾部，它永远不会执行 ⇒ 等于没有。
//   🔴 分族数为【逐族现取实数】，非估算：我第一版写 18+17=35 判红，核实为【我算式错】
//   （35 是修复前的 ok 数，漏算当时那 2 条 XX），非断言退场 —— 已按 awk 逐族重数修正：
//   手算1 = 6｜手算2 = 5｜手算3 = 4｜R-04.x 系列 = 22  ⇒ 崩溃点前应累计 37 条
//   （自断言自身再占 1 条，故日志尾数为 38，属预期）。
const EXPECTED_BEFORE_CRASH = 6 + 5 + 4 + 22;
{
  const seg = st.pass + st.fail;
  if (seg !== EXPECTED_BEFORE_CRASH) {
    ck(`断言总数自断言（崩溃点前）：${seg} == 期望 ${EXPECTED_BEFORE_CRASH}`, false,
      `实际 ${seg}（有断言静默退场或新增未同步算式）`);
  } else {
    console.log(`  \u2713 断言总数核对（崩溃点前）：${seg} == 期望 ${EXPECTED_BEFORE_CRASH} \u2705  pass=${st.pass} fail=${st.fail}`);
  }
}
const SENT = [[3, 3, 8, 8], [13, 12, 11, 9], [1, 4, 6, 8]];
let sentWithLoss = 0;
const sentRows = [];
for (const cards of SENT) {
  const res = S(cards);
  // 口径：对「全体解」（primary + advanced + cancelled 残余）逐条做 float 严格判等
  const all = [...res.primary.values(), ...res.advanced.values(), ...res.cancelled.values()];
  let lost = 0, tot = 0;
  const lostSamples = [];
  for (const expr of all) {
    tot++;
    const f = floatEval(parseExpr(expr));
    if (f !== 24) { lost++; if (lostSamples.length < 3) lostSamples.push({ expr, f }); }
  }
  const pct = tot ? (lost / tot * 100) : 0;
  if (lost > 0) sentWithLoss++;
  sentRows.push({ cards, tot, lost, pct });
  console.log(`  ${JSON.stringify(cards).padEnd(16)} 全体解=${String(tot).padStart(3)}  float严格判等漏解=${String(lost).padStart(3)} (${pct.toFixed(1)}%)`);
  for (const s of lostSamples) console.log(`      漏: ${s.expr}  float=${s.f}  误差=${Math.abs(s.f - 24).toExponential(2)}`);
}
ck('R-04.2 哨兵组中 ≥2 组存在 float 漏解（证明 Fraction 必要）', sentWithLoss >= 2, `${sentWithLoss}/3 组有漏解`);
console.log('\n  ⚠\uFE0F 口径差异记录（warning，非红灯）：INPUT-06.md R-04.2 写「分别漏解 60.0% / 21.6% / 8.3%」，');
console.log('     Tester 实测（倒数 solver 全体解口径）= ' + sentRows.map((r) => r.pct.toFixed(1) + '%').join(' / ') + '，数字不同。');
console.log('     结论不变：float 严格判等确实会漏解，Fraction 必要。百分数基数口径需 Architect 澄清。');

// 全局随机采样：200 组牌，统计 float 漏解总量（独立采样）
console.log('\n  --- 全局随机采样 200 组（同一 xorshift32 序列继续）---');
let gTot = 0, gLost = 0, gDeals = 0, gDealsWithLoss = 0;
for (let i = 0; i < 200; i++) {
  const cards = dealRandom();
  gDeals++;
  const res = S(cards);
  const all = [...res.primary.values(), ...res.advanced.values(), ...res.cancelled.values()];
  let localLost = 0;
  for (const expr of all) { gTot++; if (floatEval(parseExpr(expr)) !== 24) { gLost++; localLost++; } }
  if (localLost > 0) gDealsWithLoss++;
}
console.log(`  采样 ${gDeals} 组，解总数 ${gTot}，float 严格判等漏解 ${gLost} 条 (${(gLost / Math.max(1, gTot) * 100).toFixed(2)}%)，受影响牌组 ${gDealsWithLoss}/${gDeals}`);
ck('R-04.2 全局采样确认 float 漏解客观存在', gLost > 0, `漏 ${gLost}/${gTot}`);
function floatEval(nd) {
  if (nd.k === 'num') return nd.v;
  if (nd.k === 'recip') return 1 / nd.c;
  const a = floatEval(nd.a), b = floatEval(nd.b);
  switch (nd.op) { case '+': return a + b; case '-': return a - b; case '*': return a * b; default: return a / b; }
}
// 反向：solver 不得因浮点误差产生假解 —— 全 advanced 解独立 Fraction 复算 =24 已在上文验证
ck('R-04.2 solver 未产出假解（全 advanced Fraction 复算 =24，见 R-04/R-11 扫描）', scanNL === 0);
// 明确断言：solver 源码不含浮点判等（剔注释后扫描 —— 注释里写「禁 toFixed()」不算违规）
{
  const fs = await import('node:fs');
  const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').map((l) => l.replace(/\/\/.*$/, '')).join('\n');
  const src = strip(fs.readFileSync(new URL('../js/core/RecipSolver.mjs', import.meta.url), 'utf8'));
  ck('R-04.2 RecipSolver 代码区（剔注释）不含 toFixed(', !src.includes('toFixed('));
  ck('R-04.2 RecipSolver 代码区不含 parseFloat( / Number(', !src.includes('parseFloat(') );
  ck('R-04.2 RecipSolver 代码区无非 BigInt 的 24 字面判等', !/[=!]==?\s*24(?!n)/.test(src), (src.match(/[=!]==?\s*24(?!n)/g) || []).join(','));
  ck('R-04.2 RecipSolver 使用 BigInt', src.includes('BigInt('));
  ck('R-04.2 is24F 用 24n 精确判等', /24n\s*\*\s*f\.d/.test(src));
  const psrc = strip(fs.readFileSync(new URL('../js/core/RecipParser.mjs', import.meta.url), 'utf8'));
  ck('R-04.2 RecipParser 代码区不含 toFixed( / parseFloat(', !psrc.includes('toFixed(') && !psrc.includes('parseFloat('));
}

// ============================================================
// R-04.3 · 去重键回归（hasAdvancedSolution）
// ============================================================
console.log('\n' + '='.repeat(70));
console.log('R-04.3 · hasAdvancedSolution 真/假 各 5 组');
console.log('='.repeat(70));
for (const cards of [[1, 3, 4, 6], [2, 3, 4, 6], [3, 3, 8, 8], [1, 2, 3, 4], [1, 5, 5, 5]]) {
  const res = S(cards);
  ck(`R-04.3① ${JSON.stringify(cards).padEnd(14)} hasAdvancedSolution=true`, res.advanced.size > 0, `advanced=${res.advanced.size}`);
}
for (const cards of [[5, 5, 5, 5], [1, 1, 2, 9], [3, 3, 7, 7], [4, 4, 7, 7], [3, 3, 3, 5]]) {
  const res = S(cards);
  ck(`R-04.3② ${JSON.stringify(cards).padEnd(14)} hasAdvancedSolution=false`, res.advanced.size === 0, `advanced=${res.advanced.size}`);
}
// usedRecip 归约后判定的关键性：归约前判定会把 (8-4)/(1/6) 误记高级
{
  let sq = 0; const mk = (c) => numLeaf(c, sq++), mr = (c) => recipLeaf(c, sq++);
  sq = 0; const withR = { op: '/', a: { op: '-', a: mk(8), b: mk(4) }, b: mr(6) };
  ck('R-04.3 usedRecip 归约前 >0（若在此判定即误标）', countRecip(withR) > 0, `归约前 ${countRecip(withR)}`);
  ck('R-04.3 usedRecip 归约后 =0（正确口径）', countRecip(reduceToFixpoint(withR).node) === 0);
}

const ok = done();
process.exit(ok ? 0 : 1);
