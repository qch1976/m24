// tester-input06-r11.mjs — R-11 核心门禁（task-65 / INPUT-06）
// 独立采样：§1.2.3 判定示例表全 10 例 + 7 条无效解不得出现在高级解分区
// + R-11②③④⑤ + 独立 evaluator 复算（禁 solver 自证）
//
// 双路判定：
//   路 A（被测系统）：js/core/RecipSolver.mjs 的 reduceToFixpoint + countRecip
//   路 B（Tester 独立实现）：tester-input06-lib.mjs 的 reduceFix + countRecipLeaf
//   两路结论必须一致，且都必须与 INPUT-06.md §1.2.3 表一致

import {
  reduceToFixpoint, countRecip, renderDisplay, keySol, solve,
  numLeaf, recipLeaf, MAX_ITER, keyWithFlags} from '../js/core/RecipSolver.mjs';
import {
  mkCounter, verdictIndependent, parseExpr, evalQ, is24, qs, qeq,
  usedCards, msKey, findNonLeafRecip, renderMy,
} from './tester-input06-lib.mjs';

const { ck, done, st } = mkCounter('R-11');
console.log('tester-input06-r11.mjs  @ ' + new Date().toISOString());
console.log('MAX_ITER(被测) = ' + MAX_ITER);

// ---- AST 构造 DSL（构造被测系统的 AST；slot 独立递增） ----
let sq = 0;
const n = (c) => numLeaf(c, sq++);
const r = (c) => recipLeaf(c, sq++);
const b = (op, a, bb) => ({ op, a, b: bb });

// ============================================================
// PART 1 · §1.2.3 判定示例表 全 10 例（7 无效 + 3 有效）
// ============================================================
console.log('\n' + '='.repeat(70));
console.log('PART 1 · §1.2.3 判定示例表全 10 例（双路判定 + 独立复算）');
console.log('='.repeat(70));

const TABLE = [
  { s: '(1*2)/((1/3)/4)',  mk: () => b('/', b('*', n(1), n(2)), b('/', r(3), n(4))),  want: '无效', cards: [1, 2, 3, 4] },
  { s: '(3-2)/((1/4)/6)',  mk: () => b('/', b('-', n(3), n(2)), b('/', r(4), n(6))),  want: '无效', cards: [3, 2, 4, 6] },
  { s: '(8-4)/((1/6)/1)',  mk: () => b('/', b('-', n(8), n(4)), b('/', r(6), n(1))),  want: '无效', cards: [8, 4, 6, 1] },
  { s: '(5*5)-(5*(1/5))',  mk: () => b('-', b('*', n(5), n(5)), b('*', n(5), r(5))),  want: '无效', cards: [5, 5, 5, 5] },
  { s: '7*(3+(3*(1/7)))',  mk: () => b('*', n(7), b('+', n(3), b('*', n(3), r(7)))),  want: '无效', cards: [7, 3, 3, 7] },
  { s: '((1/2)*8)+(4*5)',  mk: () => b('+', b('*', r(2), n(8)), b('*', n(4), n(5))),  want: '无效', cards: [2, 8, 4, 5] },
  { s: '(2*6)+(3/(1/4))',  mk: () => b('+', b('*', n(2), n(6)), b('/', n(3), r(4))),  want: '无效', cards: [2, 6, 3, 4] },
  { s: '(3*6)/(1-(1/4))',  mk: () => b('/', b('*', n(3), n(6)), b('-', n(1), r(4))),  want: '有效', cards: [3, 6, 1, 4] },
  { s: '(8*8)/(3-(1/3))',  mk: () => b('/', b('*', n(8), n(8)), b('-', n(3), r(3))),  want: '有效', cards: [8, 8, 3, 3] },
  { s: '(1+(1/5))*(2*10)', mk: () => b('*', b('+', n(1), r(5)), b('*', n(2), n(10))), want: '有效', cards: [1, 5, 2, 10] },
];

const tableAst = [];
let nInvalid = 0, nValid = 0;
for (const row of TABLE) {
  sq = 0;
  const ast = row.mk();
  tableAst.push({ row, ast });

  // 路 A：被测系统判定
  const rr = reduceToFixpoint(ast);
  const vA = countRecip(rr.node) > 0 ? '有效' : '无效';
  // 路 B：Tester 独立实现判定（从字面串重新 parse，完全独立代码路径）
  const ib = verdictIndependent(row.s);

  ck(`[1.2.3] ${row.s.padEnd(18)} 被测判=${vA} 期望=${row.want}`, vA === row.want,
     `recip ${countRecip(ast)}→${countRecip(rr.node)} iters=${rr.iters} 归约=${renderDisplay(rr.node)}`);
  ck(`[1.2.3] ${row.s.padEnd(18)} 独立判=${ib.verdict} 与被测一致`, ib.verdict === vA,
     `独立 recip ${ib.before}→${ib.after} iters=${ib.iters} 归约=${renderMy(ib.reduced)}`);

  // 独立 evaluator 复算：原式 = 24
  const q0 = evalQ(parseExpr(row.s));
  ck(`[1.2.3] ${row.s.padEnd(18)} 独立复算 = 24`, is24(q0), `值=${qs(q0)}`);
  // 归约保值（独立路径）
  ck(`[1.2.3] ${row.s.padEnd(18)} 独立归约保值`, qeq(ib.valueBefore, ib.valueAfter),
     `${qs(ib.valueBefore)} == ${qs(ib.valueAfter)}`);
  // 4 张牌各用 1 次
  const uc = usedCards(parseExpr(row.s));
  ck(`[1.2.3] ${row.s.padEnd(18)} 恰用 4 张牌 ${JSON.stringify(uc)}`, uc.length === 4);
  // 未触发迭代上限
  ck(`[1.2.3] ${row.s.padEnd(18)} iters<MAX 且未 overflow`, rr.iters < MAX_ITER && !rr.overflow && !ib.overflow);

  if (row.want === '无效') nInvalid++; else nValid++;
}
ck(`表内无效例数 = 7`, nInvalid === 7, `实际 ${nInvalid}`);
ck(`表内有效例数 = 3`, nValid === 3, `实际 ${nValid}`);

// ============================================================
// PART 2 · R-11① 红灯项：7 条无效解不得出现在高级解分区
// ============================================================
console.log('\n' + '='.repeat(70));
console.log('PART 2 · R-11① 红灯：7 条无效解不得进入 advanced 分区（solve 全量枚举）');
console.log('='.repeat(70));

const solveCache = new Map();
function S(cards) {
  const k = msKey(cards);
  if (!solveCache.has(k)) solveCache.set(k, solve(cards));
  return solveCache.get(k);
}

for (const { row, ast } of tableAst) {
  // 🔴 task-154：原用 keySol(ast) 取【无后缀裸键】，而 res.advanced 的键带五位后缀
  //   |R?F?M?P?L?（composeKeyWithFlags 全假才短路成裸键）⇒ has() 恒 false，整体缺后缀而非某位错。
  //   与 task-151 在 r04 修的两条完全同型（项目主 16:08 已批该修法），改用产品公开取键 API。
  //   🔴 禁自拼后缀（产品注释要求自拼须复现 usedRecip 正则字面量并取 rr.node）。
  const key = keyWithFlags(ast);
  const res = S(row.cards);
  const inAdv = res.advanced.has(key);
  if (row.want === '无效') {
    ck(`[红灯] ${row.s.padEnd(18)} 不在 advanced 分区`, inAdv === false,
       `cards=${JSON.stringify(row.cards)} key=${key} advSize=${res.advanced.size}`);
    // 🔴 task-154（架构师 task-152 裁定方案B）：无效解应落在 primary（归约后同形）。
    //   原判据还或上了 res.cancelled.has(...)，但 cancelled 集合已随规范变更消灭
    //   （solve() 顶层不再有该键，只余 cancelledRaw 计数器）⇒ 该或式项恒无效，删。
    //   🔴 正确措辞：消失的是【存放可消去解的集合】，不是可消去解本身 ——
    //   可消去解大量存在（我自造正例 [4,1,6,1] 实测 cancelledRaw=418），
    //   只是其归约式键统一落 primary（自验：primary∩advanced=0、顶层无 cancelled 键）。
    const rr = reduceToFixpoint(ast);
    const inPrim = res.primary.has(keySol(rr.node));
    ck(`[红灯] ${row.s.padEnd(18)} 归约式落在 primary`, inPrim,
       `primary=${inPrim}`);
  } else {
    ck(`[正例] ${row.s.padEnd(18)} 在 advanced 分区`, inAdv === true,
       `cards=${JSON.stringify(row.cards)} key=${key} advSize=${res.advanced.size}`);
  }
}

// 全量扫描：任一牌组的 advanced 分区里，都不允许出现「独立判定为无效」的表达式
console.log('\n--- 全量交叉扫描：advanced 分区每条解须被独立实现判为「有效」 ---');
const SCAN = [[1, 2, 3, 4], [2, 3, 4, 6], [1, 3, 4, 6], [1, 5, 5, 5], [3, 3, 8, 8],
               [1, 2, 5, 10], [1, 1, 3, 8], [1, 4, 6, 8], [2, 4, 5, 8]];
let scanTotal = 0, scanBadVerdict = 0, scanBadValue = 0, scanBadCards = 0, scanNonLeaf = 0;
for (const cards of SCAN) {
  const res = S(cards);
  for (const expr of res.advanced.values()) {
    scanTotal++;
    let ib, q, uc, nl;
    try {
      ib = verdictIndependent(expr);
      q = evalQ(parseExpr(expr));
      uc = usedCards(parseExpr(expr));
      nl = findNonLeafRecip(parseExpr(expr));
    } catch (e) { scanBadVerdict++; console.log('  XX parse 失败: ' + expr + ' ' + e.message); continue; }
    if (ib.verdict !== '有效') { scanBadVerdict++; console.log(`  XX 独立判无效却在 advanced: ${expr} 归约=${renderMy(ib.reduced)}`); }
    if (!is24(q)) { scanBadValue++; console.log(`  XX 独立复算 ≠ 24: ${expr} = ${qs(q)}`); }
    if (uc.length !== 4 || msKey(uc) !== msKey(cards)) { scanBadCards++; console.log(`  XX 用牌不符: ${expr} used=${JSON.stringify(uc)} cards=${JSON.stringify(cards)}`); }
    if (nl.length > 0) { scanNonLeaf++; console.log(`  XX 出现 1/(中间值): ${expr}`); }
  }
}
console.log(`   扫描 advanced 解共 ${scanTotal} 条`);
ck(`[红灯] advanced 全部被独立实现判为有效（0/${scanTotal} 违规）`, scanBadVerdict === 0, `违规 ${scanBadVerdict}`);
ck(`[红灯] advanced 全部独立复算 = 24（0/${scanTotal} 违规）`, scanBadValue === 0, `违规 ${scanBadValue}`);
ck(`[红灯] advanced 全部 4 张牌各用一次`, scanBadCards === 0, `违规 ${scanBadCards}`);
ck(`[红灯] advanced 无 1/(中间值) 形态`, scanNonLeaf === 0, `违规 ${scanNonLeaf}`);

// ============================================================
// PART 3 · R-11② (8-4)*6 与 (8-4)/(1/6) 归并 1 条 且 usedRecip=false
// ============================================================
console.log('\n' + '='.repeat(70));
console.log('PART 3 · R-11②');
console.log('='.repeat(70));
sq = 0; const plain = b('*', b('-', n(8), n(4)), n(6));
sq = 0; const withR = b('/', b('-', n(8), n(4)), r(6));
const rp = reduceToFixpoint(plain), rw = reduceToFixpoint(withR);
ck('R-11② 两式归约后 keySol 相同', keySol(rp.node) === keySol(rw.node),
   `${keySol(rp.node)} vs ${keySol(rw.node)}`);
ck('R-11② 归约后 usedRecip=false（两式）', countRecip(rp.node) === 0 && countRecip(rw.node) === 0);
ck('R-11② 独立实现：(8-4)×(1/6) 形态归约后无 recip',
   verdictIndependent('((8-4)÷(1/6))').verdict === '无效',
   `归约=${renderMy(verdictIndependent('((8-4)÷(1/6))').reduced)}`);
{
  const q1 = evalQ(parseExpr('((8-4)×6)')), q2 = evalQ(parseExpr('((8-4)÷(1/6))'));
  ck('R-11② 独立复算两式同值且 = 24', qeq(q1, q2) && is24(q1), `${qs(q1)} == ${qs(q2)}`);
  const res = S([8, 4, 6, 1]);
  ck('R-11② (8-4)/(1/6) 不在 advanced（[8,4,6,1] 牌组无第 4 张不适用，仅查键缺失）',
     !res.advanced.has(keySol(withR)));
}

// ============================================================
// PART 4 · R-11③ 归约不动点 + 迭代上限
// ============================================================
console.log('\n' + '='.repeat(70));
console.log('PART 4 · R-11③ 不动点 + 上限保护');
console.log('='.repeat(70));
let maxIterSeen = 0;
for (const { row, ast } of tableAst) {
  const r1 = reduceToFixpoint(ast);
  const r2 = reduceToFixpoint(r1.node);
  maxIterSeen = Math.max(maxIterSeen, r1.iters);
  ck(`R-11③ ${row.s.padEnd(18)} 二次归约不变（不动点）`,
     keySol(r1.node) === keySol(r2.node), `iters ${r1.iters}/${r2.iters}`);
}
ck(`R-11③ MAX_ITER 常量存在且 ≥1`, typeof MAX_ITER === 'number' && MAX_ITER >= 1, `MAX_ITER=${MAX_ITER}`);
ck(`R-11③ 表内最大 iters=${maxIterSeen} 远小于 MAX_ITER`, maxIterSeen < MAX_ITER);
// 深层链压力：((1/2)*(1/3))/((1/4)*(1/5)) 形态（非 24，仅测终止性）
{
  sq = 0;
  const deep = b('/', b('*', r(2), r(3)), b('*', r(4), r(5)));
  const rd = reduceToFixpoint(deep);
  ck('R-11③ 4 recip 深层乘除链归约终止且未 overflow', !rd.overflow, `iters=${rd.iters} 归约=${renderDisplay(rd.node)}`);
  ck('R-11③ 该链归约后 recip 计数为 0', countRecip(rd.node) === 0);
}

// ============================================================
// PART 5 · R-11④ 有效倒数解基准 + R-11⑤ 恒 0 正例
// ============================================================
console.log('\n' + '='.repeat(70));
console.log('PART 5 · R-11④ 基准计数 / R-11⑤ 恒 0 正例（独立采样）');
console.log('='.repeat(70));
const BASE = [
  [[1, 2, 3, 4], 48], [[2, 3, 4, 6], 34], [[1, 3, 4, 6], 30], [[1, 5, 5, 5], 24],
  [[3, 3, 8, 8], 17], [[1, 2, 5, 10], 16], [[1, 1, 3, 8], 10], [[1, 4, 6, 8], 5], [[2, 4, 5, 8], 3],
];
const baseObserved = [];
for (const [cards, want] of BASE) {
  const res = S(cards);
  const got = res.advanced.size;
  baseObserved.push({ cards, want, got, primary: res.primary.size, cancelledRaw: res.counts.cancelledRaw });
  ck(`R-11④ ${JSON.stringify(cards).padEnd(16)} advanced=${got} 期望=${want}`, got === want,
     `primary=${res.primary.size} cancelledRaw=${res.counts.cancelledRaw}`);
}
const ZERO = [[5, 5, 5, 5], [1, 1, 2, 9], [3, 3, 7, 7], [4, 4, 7, 7], [3, 3, 3, 5]];
for (const cards of ZERO) {
  let res = null, threw = null;
  try { res = S(cards); } catch (e) { threw = e; }
  ck(`R-11⑤ ${JSON.stringify(cards).padEnd(16)} 不抛异常`, threw === null, threw ? threw.message : '');
  ck(`R-11⑤ ${JSON.stringify(cards).padEnd(16)} advanced=0`, res && res.advanced.size === 0,
     res ? `advanced=${res.advanced.size} primary=${res.primary.size}` : 'N/A');
}

console.log('\n--- R-11④ 观测全表（供报告引用） ---');
console.log('cards            | primary | advanced(实测/期望) | cancelledRaw');
for (const o of baseObserved) {
  console.log(`${JSON.stringify(o.cards).padEnd(16)} | ${String(o.primary).padStart(7)} | ${String(o.got).padStart(8)}/${String(o.want).padEnd(8)} | ${o.cancelledRaw}`);
}

// ============================================================================
// 🔴 task-154：断言总数自断言（分族算式，禁裸数字）
//   目的：防某族被静默跳过（如 for 循环上界写错、数组被误清空）而仍「全绿」。
//   🔴 分族数为【逐族现取实数】（按断言文本首段 awk/uniq -c 计数），非估算：
//     [1.2.3] 族 = 60｜[红灯] = 18｜R-11③ = 14｜R-11⑤ = 10｜R-11④ = 9
//     R-11② = 5｜[正例] = 3｜表内有效例数 = 1｜表内无效例数 = 1
//   ⇒ 全支应为 121 条。自断言自身不计入（判绿走 console.log 不经 ck）。
// ============================================================================
const EXPECTED_TOTAL = 60 + 18 + 14 + 10 + 9 + 5 + 3 + 1 + 1;
{
  const seg = st.pass + st.fail;
  if (seg !== EXPECTED_TOTAL) {
    ck(`断言总数自断言（全支）：${seg} == 期望 ${EXPECTED_TOTAL}`, false,
       `有断言静默退场或算式未随新增同步`);
  } else {
    console.log(`  \u2713 断言总数核对（全支）：${seg} == 期望 ${EXPECTED_TOTAL} \u2705  pass=${st.pass} fail=${st.fail}`);
  }
}

const ok = done();
process.exit(ok ? 0 : 1);
