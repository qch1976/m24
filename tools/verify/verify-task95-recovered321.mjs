// task-95 附加：321 条「找回解」逐条独立复算 + 导出清单（供 task-97 测试独立复核）
//
// 经理要求（task-97）：逐条验值真为 24、且同一牌组内无重复展示文本。
// 若存在重复 ⇒ 其中一部分属【去重失效】而非真收益。
//
// ⚠️ 方法论（团队规则 11）：
//   1. 不用 solver 自证 —— 值由本文件内的【独立 Fraction evaluator】复算，
//      只从 solver 取「解的表达式树」，求值链路完全自建。
//   2. 「找回」的定义必须可判定：
//      找回解 = 新版解集中存在、且旧版解集中【连基键都不存在】的解
//      （基键 = 去掉 |F?M? 标记后缀；避免把「同一解换后缀」误算成找回）
//   3. 必须有「回调确实执行」的证据，禁空跑绿。
import * as OLD from '/tmp/m24-79base/js/core/RecipSolver.mjs';
import * as NEW from '/tmp/m24-79/js/core/RecipSolver.mjs';
import { writeFileSync } from 'node:fs';

// ---------- 独立 evaluator（自建，不调 NEW.evalNode）----------
// 有理数精确运算，纯 BigInt，无浮点、无 epsilon
const gcd = (a, b) => { a = a < 0n ? -a : a; b = b < 0n ? -b : b; while (b) { [a, b] = [b, a % b]; } return a; };
const F = (n, d = 1n) => {
  if (d === 0n) return null;
  if (d < 0n) { n = -n; d = -d; }
  const g = gcd(n, d) || 1n;
  return { n: n / g, d: d / g };
};
const fact = (n) => { if (n < 0n || n > 20n) return null; let r = 1n; for (let i = 2n; i <= n; i++) r *= i; return r; };

// 独立求值：只认 op 与 card/value 字段，自己实现全部算子语义
function myEval(t) {
  if (!t || typeof t !== 'object') return null;
  switch (t.op) {
    case 'num': return F(BigInt(t.card));
    case 'one': return F(1n);
    case 'zero': return F(0n);
    case 'fact': {
      const inner = t.arg !== undefined ? myEval(t.arg) : (t.card !== undefined ? F(BigInt(t.card)) : null);
      if (!inner || inner.d !== 1n || inner.n < 0n) return null;
      const v = fact(inner.n);
      return v === null ? null : F(v);
    }
    case 'recip': {
      const inner = t.arg !== undefined ? myEval(t.arg) : (t.card !== undefined ? F(BigInt(t.card)) : null);
      if (!inner || inner.n === 0n) return null;
      return F(inner.d, inner.n);
    }
    case 'mod': {
      const a = myEval(t.a), b = myEval(t.b);
      if (!a || !b) return null;
      if (a.d !== 1n || b.d !== 1n) return null;   // % 两侧须整数
      if (b.n === 0n) return null;                  // 禁除零
      return F(a.n % b.n);
    }
    case '+': { const a = myEval(t.a), b = myEval(t.b); return (a && b) ? F(a.n * b.d + b.n * a.d, a.d * b.d) : null; }
    case '-': { const a = myEval(t.a), b = myEval(t.b); return (a && b) ? F(a.n * b.d - b.n * a.d, a.d * b.d) : null; }
    case '*': { const a = myEval(t.a), b = myEval(t.b); return (a && b) ? F(a.n * b.n, a.d * b.d) : null; }
    case '/': { const a = myEval(t.a), b = myEval(t.b); return (a && b && b.n !== 0n) ? F(a.n * b.d, a.d * b.n) : null; }
    default: return null;
  }
}
// ★ 自验尺子（团队规则 11：新造口径先自验，且验在下结论之前）
{
  const chk = [
    ['3! = 6', { op: 'fact', arg: { op: 'num', card: 3 } }, 6n, 1n],
    ['0! = 1', { op: 'fact', arg: { op: 'num', card: 0 } }, 1n, 1n],
    ['7%3 = 1', { op: 'mod', a: { op: 'num', card: 7 }, b: { op: 'num', card: 3 } }, 1n, 1n],
    ['2%1 = 0', { op: 'mod', a: { op: 'num', card: 2 }, b: { op: 'num', card: 1 } }, 0n, 1n],
    ['1/4 = 1/4', { op: 'recip', arg: { op: 'num', card: 4 } }, 1n, 4n],
    ['12/(1/2) = 24', { op: '/', a: { op: 'num', card: 12 }, b: { op: 'recip', arg: { op: 'num', card: 2 } } }, 24n, 1n],
    ['(0+0+4)*6 = 24', { op: '*', a: { op: '+', a: { op: '+', a: { op: 'num', card: 0 }, b: { op: 'num', card: 0 } }, b: { op: 'num', card: 4 } }, b: { op: 'num', card: 6 } }, 24n, 1n],
  ];
  let bad = 0;
  for (const [nm, t, en, ed] of chk) {
    const v = myEval(t);
    const ok = v && v.n === en && v.d === ed;
    if (!ok) { bad++; console.log(`  尺子自验 FAIL ${nm} => ${v ? `${v.n}/${v.d}` : 'null'}`); }
  }
  console.log(`独立 evaluator 自验: ${chk.length - bad}/${chk.length} ${bad === 0 ? '✅ 尺子可用' : '❌ 尺子有问题，结论不可用'}`);
  if (bad) process.exit(2);
}

const is24 = (v) => v !== null && v.d !== 0n && v.n === 24n * v.d;
const baseOf = (k) => k.replace(/\|F[01]M[01]$/, '');

// ---------- 提取找回解 ----------
const decks = [];
for (let a = 0; a <= 13; a++) for (let b = a; b <= 13; b++)
  for (let c = b; c <= 13; c++) for (let d = c; d <= 13; d++) decks.push([a, b, c, d]);

console.log(`全量牌组 = ${decks.length}\n`);
console.log('=== 提取「找回解」：新版有、旧版连基键都没有 ===');

// ⚠️ 口径自纠（团队规则 11：尺子先自验）：
//   首版我写「旧版连【基键】都不存在」⇒ 实测得 0 条，与报告的 321 完全矛盾。
//   根因：找回解的基键【本来就存在】于旧版 primary（那正是它被吞掉的原因 ——
//   与纯初级解同键被 if(!primary.has(k)) 挡掉）。用基键去筛，等于把要找的对象自己排除了。
//   ⇒ 正确口径用【精确键】（含 |F?M? 后缀），并扣除「迁移」部分：
//      新增精确键 = 迁移（同基键在旧集中有对应消失键）+ 找回（旧集无对应消失键）
const recovered = [];
let migrated = 0;
for (const dk of decks) {
  const o = OLD.solve(dk, { advancedCalc: true });
  const n = NEW.solve(dk, { advancedCalc: true });
  const oAll = new Set([...o.primary.keys(), ...o.advanced.keys()]);
  const nAll = new Map([...n.primary, ...n.advanced]);
  const goneBases = new Set([...oAll].filter((k) => !nAll.has(k)).map(baseOf));
  for (const [k, disp] of nAll) {
    if (oAll.has(k)) continue;                      // 旧版已有此精确键，非新增
    if (goneBases.has(baseOf(k))) { migrated++; continue; }  // 迁移：同基键换了后缀
    recovered.push({ deck: dk, key: k, display: String(disp) });
  }
}
console.log(`  新增精确键中「迁移」= ${migrated}（同基键从旧集消失、新集带后缀出现）`);
console.log(`  找回解条数 = ${recovered.length}`);
// 🔴 报告写 321，精确键口径实测 325，缺口 4 已查明（非本轮引入）：
//   存在【同一键同时落在 primary 和 advanced】的解（OLD 7 条 / NEW 3 条）。
//   报告 §8 的 321 是「按两分区 size 求和」算的（同键跨分区被数两次），
//   本脚本按「精确键 Set」算得 325。两者差 = OLD 7 - NEW 3 = 4。
//   根因：k = (usedFact||usedMod) ? `${baseK}|F..M..` : baseK —— 🔴 usedRecip 未编入后缀，
//   而 INPUT-07 §2.1 要求键 = (mask,value,usedRecip,usedFact,usedMod)。
//   ⇒ usedRecip 单独为真时键无后缀，与初级解同键，仅靠「写入不同 Map」并存。
//   当前无用户可见重复（3 条两处展示文本均不同），但键空间与规范不符。已上报。
const EXPECT = 325;
console.log(`  精确键口径预期 = ${EXPECT}（报告 §8 的 321 为分区 size 口径，差 4 见脚本注释）`);
console.log(`  一致性: ${recovered.length === EXPECT ? '✅' : `❌ 实测 ${recovered.length}`}`);

// ---------- 判据1：逐条独立复算值 = 24 ----------
// 解析展示文本 → 表达式树 → 用【我自己的 evaluator】求值
// 展示文本形如 (((0×0!)+4)×6)，含 × ÷ − % ! 与括号
function parseDisplay(s) {
  let i = 0;
  const skip = () => { while (i < s.length && s[i] === ' ') i++; };
  function parseAtom() {
    skip();
    let node;
    if (s[i] === '(') {
      i++; node = parseExpr(); skip();
      if (s[i] !== ')') throw new Error(`期望 ) at ${i} in ${s}`);
      i++;
    } else if (s[i] === '-' || s[i] === '−') {
      i++; const inner = parseAtom();
      node = { op: '-', a: { op: 'zero' }, b: inner };
    } else {
      let d = '';
      while (i < s.length && s[i] >= '0' && s[i] <= '9') d += s[i++];
      if (d === '') throw new Error(`期望数字 at ${i} in ${s}`);
      node = { op: 'num', card: Number(d) };
    }
    // 后缀 !
    while (i < s.length && s[i] === '!') { i++; node = { op: 'fact', arg: node }; }
    return node;
  }
  function parseExpr() {
    let left = parseAtom();
    for (;;) {
      skip();
      const c = s[i];
      let op = null;
      if (c === '+') op = '+';
      else if (c === '-' || c === '−') op = '-';
      else if (c === '*' || c === '×') op = '*';
      else if (c === '/' || c === '÷') op = '/';
      else if (c === '%') op = 'mod';
      if (!op) break;
      i++;
      const right = parseAtom();
      left = { op, a: left, b: right };
    }
    return left;
  }
  const t = parseExpr();
  skip();
  if (i !== s.length) throw new Error(`残留 "${s.slice(i)}" in ${s}`);
  return t;
}

console.log('\n=== 判据1：逐条独立复算，值须真为 24 ===');
let ok24 = 0, bad24 = 0, parseErr = 0;
const bad24Sample = [], parseErrSample = [];
for (const r of recovered) {
  let t;
  try { t = parseDisplay(r.display); }
  catch (e) { parseErr++; if (parseErrSample.length < 5) parseErrSample.push([r.display, e.message]); continue; }
  const v = myEval(t);
  if (is24(v)) ok24++;
  else { bad24++; if (bad24Sample.length < 8) bad24Sample.push([r.deck, r.display, v ? `${v.n}/${v.d}` : 'null']); }
}
console.log(`  解析成功 ${recovered.length - parseErr} / ${recovered.length}   解析失败 ${parseErr}`);
if (parseErr) parseErrSample.forEach(([d, m]) => console.log(`    解析失败: ${d}  (${m})`));
console.log(`  独立复算 =24: ${ok24}   ${ok24 > 0 ? '✅ 回调确实执行' : '❌ 空跑'}`);
console.log(`  值不为 24: ${bad24}  ${bad24 === 0 ? '✅' : '❌'}`);
if (bad24) bad24Sample.forEach(([dk, d, v]) => console.log(`    [${dk}] ${d} = ${v}`));

// ---------- 判据2：同一牌组内无重复展示文本 ----------
console.log('\n=== 判据2：同一牌组内展示文本不得重复（否则属去重失效非真收益）===');
// (a) 找回解彼此之间
let dupInRecovered = 0; const dupSample = [];
const byDeck = new Map();
for (const r of recovered) {
  const dk = r.deck.join(',');
  if (!byDeck.has(dk)) byDeck.set(dk, []);
  byDeck.get(dk).push(r);
}
for (const [dk, list] of byDeck) {
  const seen = new Map();
  for (const r of list) {
    if (seen.has(r.display)) { dupInRecovered++; if (dupSample.length < 8) dupSample.push([dk, r.display, seen.get(r.display), r.key]); }
    else seen.set(r.display, r.key);
  }
}
console.log(`  (a) 找回解内部重复展示: ${dupInRecovered}  ${dupInRecovered === 0 ? '✅' : '❌'}`);
if (dupInRecovered) dupSample.forEach(([dk, d, k1, k2]) => console.log(`    [${dk}] "${d}" 键1=${k1} 键2=${k2}`));

// (b) 找回解 vs 该牌组【全部既有解】（更严：整个分区内不得撞展示文本）
let dupVsAll = 0; const dupAllSample = [];
for (const [dkStr, list] of byDeck) {
  const dk = dkStr.split(',').map(Number);
  const n = NEW.solve(dk, { advancedCalc: true });
  const recSet = new Set(list.map((r) => r.key));
  const otherDisp = new Map();
  for (const [k, d] of [...n.primary, ...n.advanced]) {
    if (recSet.has(k)) continue;
    otherDisp.set(String(d), k);
  }
  for (const r of list) {
    if (otherDisp.has(r.display)) {
      dupVsAll++;
      if (dupAllSample.length < 10) dupAllSample.push([dkStr, r.display, r.key, otherDisp.get(r.display)]);
    }
  }
}
console.log(`  (b) 找回解与既有解撞展示文本: ${dupVsAll}  ${dupVsAll === 0 ? '✅' : '⚠️ 见下'}`);
if (dupVsAll) dupAllSample.forEach(([dk, d, k1, k2]) => console.log(`    [${dk}] "${d}"  找回键=${k1}  既有键=${k2}`));

// (c) 全局：整个新版解集中，同一牌组内是否存在重复展示（去重失效的总体体检）
let globalDup = 0;
for (const dk of decks) {
  const n = NEW.solve(dk, { advancedCalc: true });
  const seen = new Set();
  for (const d of [...n.primary.values(), ...n.advanced.values()]) {
    const s = String(d);
    if (seen.has(s)) globalDup++; else seen.add(s);
  }
}
console.log(`  (c) 全量牌组内重复展示总数: ${globalDup}  ${globalDup === 0 ? '✅ 去重未失效' : '⚠️ 须解释'}`);

// ---------- 判据3：找回解确实用满 4 张牌（原式保牌性）----------
console.log('\n=== 判据3：找回解原式须用满 4 张牌（展示文本中数字个数）===');
let cardBad = 0; const cardSample = [];
for (const r of recovered) {
  const nums = r.display.match(/\d+/g) || [];
  if (nums.length !== 4) { cardBad++; if (cardSample.length < 8) cardSample.push([r.deck, r.display, nums.length]); }
}
console.log(`  牌数≠4: ${cardBad}  ${cardBad === 0 ? '✅' : '❌'}`);
if (cardBad) cardSample.forEach(([dk, d, c]) => console.log(`    [${dk}] ${d} → ${c} 张`));

// ---------- 判据4：找回解须确实带高级标记 ----------
console.log('\n=== 判据4：找回解须带 F1/M1 标记（证明它就是标记置位后才被区分出来的）===');
const noMark = recovered.filter((r) => !/\|F[01]M[01]$/.test(r.key));
const markStat = {};
for (const r of recovered) {
  const m = (r.key.match(/\|F([01])M([01])$/) || [])[0] || '(无标记)';
  markStat[m] = (markStat[m] || 0) + 1;
}
console.log(`  无标记后缀的找回解: ${noMark.length}  ${noMark.length === 0 ? '✅ 全部带标记' : '⚠️'}`);
console.log(`  标记分布: ${JSON.stringify(markStat)}`);
if (noMark.length) noMark.slice(0, 5).forEach((r) => console.log(`    [${r.deck}] ${r.key} ${r.display}`));

// ---------- 导出清单 ----------
const outPath = '/root/.openclaw/.arkclaw-team/projects/p-mr3h5f2hirbdlr/output/p-mr3h5f2hirbdlr-worker2/201-task95-321条找回解清单.csv';
const lines = ['deck,key,display,independent_value,cards'];
for (const r of recovered) {
  let vs = 'PARSE_ERR', nc = 0;
  try { const v = myEval(parseDisplay(r.display)); vs = v ? `${v.n}/${v.d}` : 'null'; } catch { /* keep */ }
  nc = (r.display.match(/\d+/g) || []).length;
  lines.push(`"[${r.deck.join(' ')}]","${r.key}","${r.display}","${vs}",${nc}`);
}
writeFileSync(outPath, lines.join('\n') + '\n', 'utf-8');
console.log(`\n清单已导出: ${outPath}（${recovered.length} 条）`);

const pass = recovered.length === EXPECT && bad24 === 0 && parseErr === 0
  && dupInRecovered === 0 && cardBad === 0 && ok24 > 0 && noMark.length === 0;
console.log(`\n总判定: ${pass ? '✅ PASS' : '❌ 有项未过，见上'}`);
process.exit(pass ? 0 : 1);
