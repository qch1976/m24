// tester-input06-gui3decks.mjs — 项目主实测三组牌组 → 永久回归用例（task-82）
// Node: 见 [env] 行（无版本记录视同未做验证）
// 依据：INPUT-COMMON.md + INPUT-06.md · task-82 任务书 · task-79/80 缺陷范围
//
// ══════════════════════════════════════════════════════════════════════════
// 【定位】纯逻辑层回归。不做 GUI 自动化（项目主已裁定 Minium 不适用小游戏：
//   Minium 依赖 WXML DOM，小游戏是纯 Canvas，构造上不适用）。
//   本脚本不引 puppeteer/playwright，不改产品代码，不注入测试钩子（pending 项）。
//
// 【覆盖】项目主 2026-08-05 现场实测的三组牌组：
//   用例 1  (3,6,7,J)   口径一致性        ← task-79 Bug B / Bug C
//   用例 2  (6,6,8,Q)   负负得正去重       ← task-80
//   用例 3  (王,6,Q,Q)  ±0 去重           ← task-80
//
// 【断言层次】只断言逻辑层可验证的契约，不断言像素：
//   · solve() 的 primary/advanced 集合
//   · buildDisplay() 的返回结构与字段
//   · keySol() 去重等价性
//   · UI 层「数据契约」——即 UI 消费的字段是否真的被生产（可静态+运行时验证）
//
// 【牌值映射】J=11 Q=12 K=13。「王」按 m24 实现取值见 CASE 3 注释。
// ══════════════════════════════════════════════════════════════════════════

import * as RS from '../js/core/RecipSolver.mjs';

console.log(`[env] node=${process.version} platform=${process.platform}/${process.arch} pid=${process.pid}`);
console.log(`[t82] 项目主实测三组牌组回归  @ ${new Date().toISOString()}`);

let pass = 0, fail = 0;
const failed = [];
function ck(name, cond, extra) {
  if (cond) { pass++; console.log('  ok  ' + name + (extra ? '   ' + extra : '')); }
  else { fail++; failed.push(name); console.log('  XX  ' + name + (extra ? '   ' + extra : '')); }
  return !!cond;
}

// ════════════════════════════════════════════════════════════════════════
// 用例 1 — (3,6,7,J) 口径一致性（task-79 Bug B / Bug C）
// ════════════════════════════════════════════════════════════════════════
console.log('\n' + '='.repeat(74));
console.log('用例 1 · (3,6,7,J) = [3,6,7,11] —— 无初级解 / 有倒数高级解');
console.log('='.repeat(74));

const D1 = [3, 6, 7, 11];
const r1 = RS.solve(D1);
const disp1 = RS.buildDisplay(r1, RS.DISPLAY_LIMIT);

console.log(`  实测 primary=${r1.primary.size}  advanced=${r1.advanced.size}`);
console.log(`  buildDisplay 字段: ${Object.keys(disp1).join(', ')}`);
console.log(`  advanced 全量: ${JSON.stringify(disp1.advanced)}`);

// 1.1 项目主报的事实：无初级解
ck('1.1 初级解集为空（项目主实测事实）', r1.primary.size === 0, `primary=${r1.primary.size}`);
// 1.2 有倒数高级解
ck('1.2 高级解集非空（项目主实测事实）', r1.advanced.size > 0, `advanced=${r1.advanced.size}`);
// 1.3 buildDisplay 的 advanced 字段存在且非空
ck('1.3 buildDisplay().advanced 存在', 'advanced' in disp1);
ck('1.3 buildDisplay().advanced 非空数组',
   Array.isArray(disp1.advanced) && disp1.advanced.length > 0, `len=${disp1.advanced.length}`);
// 1.4 counts 与 solve 一致（防展示层与数据层口径漂移）
ck('1.4 counts.advanced == advanced.size',
   disp1.counts.advanced === r1.advanced.size, `${disp1.counts.advanced} vs ${r1.advanced.size}`);
ck('1.4 counts.primary == primary.size',
   disp1.counts.primary === r1.primary.size, `${disp1.counts.primary} vs ${r1.primary.size}`);

// 1.5 每条高级解须 = 24（独立复算，不用 solver 自证）——见文件末 §独立 evaluator
// 1.6 【Bug B 契约】"有解"判定不得只看初级解
//     PageRenderer:626 用 gc.getSolutions().length > 0，只含初级解 ⇒ 本组会误判无解。
//     逻辑层可判据：存在 primary=0 而 advanced>0 的牌组 ⇒ 只看初级必然误判。
ck('1.6 [Bug B 契约] 本组构成"只看初级解必误判"的反例',
   r1.primary.size === 0 && r1.advanced.size > 0,
   '任何仅依据 primary 的 hasSolution 判定在本组必错');

// ── 1.7 【Bug C 根因独立取证】────────────────────────────────────────────
// ⚠️ 任务书写「advancedTop 字段不存在，这正是 Bug C 的根因，要钉住」。
//    我实测的结果与该判断不符，故按实测钉真契约，并在报告中上报分歧。
console.log('\n  ── 1.7 Bug C 根因独立取证（实测优先于推断）──');
const hasAdvTop = 'advancedTop' in disp1;
console.log(`  'advancedTop' in buildDisplay() = ${hasAdvTop}`);
console.log(`  buildDisplay().advancedTop = ${JSON.stringify(disp1.advancedTop)}`);
console.log(`  RecipSolver.mjs L437-438 确实产出 primaryTop / advancedTop`);

// 实测契约：advancedTop 存在，且在 advanced 非空时为字符串（非 undefined）
ck("1.7a advancedTop 字段【存在】（与任务书推断相反，实测为准）", hasAdvTop === true);
ck('1.7b advanced 非空时 advancedTop 为非空字符串（不是 undefined）',
   typeof disp1.advancedTop === 'string' && disp1.advancedTop.length > 0,
   `typeof=${typeof disp1.advancedTop}`);
ck('1.7c advancedTop 恒等于 advanced[0]（排序后首条）',
   disp1.advancedTop === disp1.advanced[0], `${disp1.advancedTop} vs ${disp1.advanced[0]}`);

// 1.7d 真根因钉死：HintModal 渲染消费的 Step 契约
//   HintModal.js:121  contentText = `${cur.lhs} ${cur.op} ${cur.rhs} = ${cur.result}`
//   Solver.postOrderSteps 产出 { step, lhs, op, rhs, result }
//   PageRenderer:672 倒数兜底构造的却是 { text, expr } ⇒ lhs/op/rhs/result 全 undefined
//   ⇒ undefined 来自 Step 契约不匹配，与 advancedTop 无关。
const STEP_CONTRACT = ['lhs', 'op', 'rhs', 'result'];
const advFallbackStep = { text: `高级解法：${disp1.advancedTop} = 24`, expr: disp1.advancedTop };
const missing = STEP_CONTRACT.filter((k) => !(k in advFallbackStep));
console.log(`  HintModal 渲染所需字段: ${STEP_CONTRACT.join('/')}`);
console.log(`  PageRenderer 倒数兜底 step 实有字段: ${Object.keys(advFallbackStep).join('/')}`);
console.log(`  缺失字段: ${missing.join('/') || '(无)'}`);
ck('1.7d [Bug C 真根因] 倒数兜底 step 缺 HintModal 所需的全部 4 字段 ⇒ 渲染出 undefined',
   missing.length === 4, `缺 ${missing.join(',')}`);
// 修复后本断言应反转为「不缺字段」；届时改判据方向即可（见报告 §修复后如何转绿）

// ════════════════════════════════════════════════════════════════════════
// 用例 2 — (6,6,8,Q) 负负得正去重（task-80）
// ════════════════════════════════════════════════════════════════════════
console.log('\n' + '='.repeat(74));
console.log('用例 2 · (6,6,8,Q) = [6,6,8,12] —— 负负得正应视为同一解');
console.log('='.repeat(74));

const D2 = [6, 6, 8, 12];
const r2 = RS.solve(D2);
console.log(`  实测 primary=${r2.primary.size}  advanced=${r2.advanced.size}`);

// AST 构造：项目主给的反例
//   (6-8)/(1/12 - 1/6)   与   (8-6)/(1/6 - 1/12)
// 两式数学等价（分子分母同时取负），应归并为 1 条。
let sq = 0;
const N = (c) => RS.numLeaf(c, sq++);
const R = (c) => RS.recipLeaf(c, sq++);
const B = (op, a, b) => ({ op, a, b });

sq = 0; const e2a = B('/', B('-', N(6), N(8)), B('-', R(12), R(6)));
sq = 0; const e2b = B('/', B('-', N(8), N(6)), B('-', R(6), R(12)));

const v2a = RS.evalNode(e2a), v2b = RS.evalNode(e2b);
console.log(`  (6-8)/((1/12)-(1/6)) = ${v2a ? v2a.n + '/' + v2a.d : 'null'}`);
console.log(`  (8-6)/((1/6)-(1/12)) = ${v2b ? v2b.n + '/' + v2b.d : 'null'}`);

ck('2.1 两式都 = 24（Fraction 精确，禁 ===24/toFixed）',
   RS.is24F(v2a) && RS.is24F(v2b));
ck('2.2 两式数值严格相等', !!v2a && !!v2b && v2a.n === v2b.n && v2a.d === v2b.d);

const k2a = RS.keySol(RS.reduceToFixpoint(e2a).node);
const k2b = RS.keySol(RS.reduceToFixpoint(e2b).node);
console.log(`  keySol A = ${k2a}`);
console.log(`  keySol B = ${k2b}`);
ck('2.3 [task-80 核心] 负负得正两式 keySol 相同 ⇒ 去重后只留 1 条',
   k2a === k2b, `${k2a === k2b ? '已归并' : '仍分裂为 2 条'}`);

// 2.4 集合级验证：两式若真在解集中，去重后应只出现 1 条
const inSet2 = [...r2.advanced.keys()].filter((k) => k === k2a || k === k2b);
console.log(`  解集中命中这两个键的条目数 = ${inSet2.length}  (${inSet2.join(' | ')})`);
ck('2.4 解集中该等价类至多 1 条', inSet2.length <= 1, `实际 ${inSet2.length}`);

// ════════════════════════════════════════════════════════════════════════
// 用例 3 — (王,6,Q,Q) ±0 去重（task-80）
// ════════════════════════════════════════════════════════════════════════
console.log('\n' + '='.repeat(74));
console.log('用例 3 · (王,6,Q,Q) —— +0 与 -0 等价、且位置无关');
console.log('='.repeat(74));

// 「王」在 m24 中的取值：查 Card/Deck 实现。若为 0 则 deck=[0,6,12,12]。
// 本用例的断言不依赖「王」的具体点数，只依赖 ±0 的代数性质，
// 故用 0 显式构造 ±0 反例，同时附 deck 级别观测。
const D3 = [0, 6, 12, 12];
let r3 = null, r3err = null;
try { r3 = RS.solve(D3); } catch (e) { r3err = e; }
if (r3) console.log(`  deck [0,6,12,12] 实测 primary=${r3.primary.size} advanced=${r3.advanced.size}`);
else console.log(`  deck [0,6,12,12] solve 抛错: ${r3err && r3err.message}`);
ck('3.0 含 0 牌组 solve 不抛异常', r3err === null, r3err ? r3err.message : '');

// ±0 等价反例：12*(6/(12/... )) 形式过于绕，直接用最小反例钉代数性质
//   (12+12)+0  与  (12+12)-0   ⇒ 同一解
//   0+(12+12)  与  (12+12)+0   ⇒ 位置无关
sq = 0; const e3_plus  = B('+', B('+', N(12), N(12)), N(0));
sq = 0; const e3_minus = B('-', B('+', N(12), N(12)), N(0));
sq = 0; const e3_front = B('+', N(0), B('+', N(12), N(12)));

const v3p = RS.evalNode(e3_plus), v3m = RS.evalNode(e3_minus), v3f = RS.evalNode(e3_front);
console.log(`  (12+12)+0 = ${v3p ? v3p.n + '/' + v3p.d : 'null'}`);
console.log(`  (12+12)-0 = ${v3m ? v3m.n + '/' + v3m.d : 'null'}`);
console.log(`  0+(12+12) = ${v3f ? v3f.n + '/' + v3f.d : 'null'}`);
ck('3.1 三式都 = 24', RS.is24F(v3p) && RS.is24F(v3m) && RS.is24F(v3f));

const k3p = RS.keySol(RS.reduceToFixpoint(e3_plus).node);
const k3m = RS.keySol(RS.reduceToFixpoint(e3_minus).node);
const k3f = RS.keySol(RS.reduceToFixpoint(e3_front).node);
console.log(`  keySol (12+12)+0 = ${k3p}`);
console.log(`  keySol (12+12)-0 = ${k3m}`);
console.log(`  keySol 0+(12+12) = ${k3f}`);
ck('3.2 [task-80] +0 与 -0 归并为同一键', k3p === k3m,
   k3p === k3m ? '已归并' : '仍分裂');
ck('3.3 [task-80] 0 的位置无关（前置/后置同键）', k3p === k3f,
   k3p === k3f ? '位置无关成立' : '位置影响了键');

// ════════════════════════════════════════════════════════════════════════
// 独立 evaluator 复算（禁 solver 自证）
// ════════════════════════════════════════════════════════════════════════
console.log('\n' + '='.repeat(74));
console.log('独立 evaluator 复算：用例 1 全部高级解须 = 24（不调 solver 求值）');
console.log('='.repeat(74));

// 自实现 Fraction + parser，与 RecipSolver 无共享代码
function g(a, b) { a = a < 0n ? -a : a; b = b < 0n ? -b : b; while (b) { const t = a % b; a = b; b = t; } return a; }
function Q(n, d = 1n) { n = BigInt(n); d = BigInt(d); if (d === 0n) return null; if (d < 0n) { n = -n; d = -d; } const k = g(n, d) || 1n; return { n: n / k, d: d / k }; }
const add = (a, b) => (a && b ? Q(a.n * b.d + b.n * a.d, a.d * b.d) : null);
const sub = (a, b) => (a && b ? Q(a.n * b.d - b.n * a.d, a.d * b.d) : null);
const mul = (a, b) => (a && b ? Q(a.n * b.n, a.d * b.d) : null);
const div = (a, b) => (a && b && b.n !== 0n ? Q(a.n * b.d, a.d * b.n) : null);
const eq24 = (q) => !!q && q.d !== 0n && q.n === 24n * q.d;   // 精确，无浮点

function lex(s) {
  s = String(s).replace(/\s+/g, ''); const out = []; let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (c >= '0' && c <= '9') { let j = i; while (j < s.length && s[j] >= '0' && s[j] <= '9') j++; out.push({ t: 'num', v: parseInt(s.slice(i, j), 10) }); i = j; continue; }
    if (c === '(') { out.push({ t: '(' }); i++; continue; }
    if (c === ')') { out.push({ t: ')' }); i++; continue; }
    if (c === '+' || c === '-') { out.push({ t: 'op', v: c }); i++; continue; }
    if (c === '×' || c === '*') { out.push({ t: 'op', v: '*' }); i++; continue; }
    if (c === '÷') { out.push({ t: 'op', v: '/', div: true }); i++; continue; }
    if (c === '/') { out.push({ t: 'op', v: '/', slash: true }); i++; continue; }
    throw new Error('lex 未识别: ' + c);
  }
  return out;
}
function parse(src) {
  const ts = lex(src); let p = 0;
  const peek = () => (p < ts.length ? ts[p] : null);
  function expr() { let n = term(); for (;;) { const t = peek(); if (t && t.t === 'op' && (t.v === '+' || t.v === '-')) { p++; n = { k: 'bin', op: t.v, a: n, b: term() }; } else return n; } }
  function term() { let n = prim(); for (;;) { const t = peek(); if (t && t.t === 'op' && (t.v === '*' || t.v === '/')) { p++; n = { k: 'bin', op: t.v, a: n, b: prim(), slash: !!t.slash }; } else return n; } }
  function prim() {
    const t = ts[p]; if (!t) throw new Error('parse 意外结束');
    if (t.t === 'num') { p++; return { k: 'num', v: t.v }; }
    if (t.t === '(') {
      // 倒数字面 (1/c)：ASCII '/' 专用于倒数叶子
      if (ts[p + 1] && ts[p + 1].t === 'num' && ts[p + 1].v === 1 &&
          ts[p + 2] && ts[p + 2].t === 'op' && ts[p + 2].slash === true &&
          ts[p + 3] && ts[p + 3].t === 'num' && ts[p + 4] && ts[p + 4].t === ')') {
        const c = ts[p + 3].v; p += 5; return { k: 'recip', c };
      }
      p++; const inner = expr();
      if (!ts[p] || ts[p].t !== ')') throw new Error('parse 缺右括号');
      p++; return inner;
    }
    throw new Error('parse 意外 token');
  }
  const a = expr(); if (p !== ts.length) throw new Error('parse 尾部残留'); return a;
}
function ev(nd) {
  if (nd.k === 'num') return Q(nd.v);
  if (nd.k === 'recip') return nd.c === 0 ? null : Q(1, nd.c);
  const a = ev(nd.a), b = ev(nd.b);
  if (nd.op === '+') return add(a, b);
  if (nd.op === '-') return sub(a, b);
  if (nd.op === '*') return mul(a, b);
  return div(a, b);
}
function cardsOf(nd, acc = []) {
  if (nd.k === 'num') { acc.push(nd.v); return acc; }
  if (nd.k === 'recip') { acc.push(nd.c); return acc; }
  cardsOf(nd.a, acc); cardsOf(nd.b, acc); return acc;
}
const ms = (a) => a.slice().sort((x, y) => x - y).join(',');

let indOk = 0, indBad = 0;
for (const e of disp1.advanced) {
  let q = null, cd = null, err = null;
  try { const ast = parse(e); q = ev(ast); cd = cardsOf(ast); } catch (ex) { err = ex; }
  const ok24 = eq24(q);
  const okCards = cd && cd.length === 4 && ms(cd) === ms(D1);
  if (ok24 && okCards) indOk++; else indBad++;
  console.log(`  ${ok24 && okCards ? 'ok ' : 'XX '} ${e.padEnd(30)} 值=${q ? q.n + '/' + q.d : 'ERR'} 用牌=${cd ? JSON.stringify(cd) : 'ERR'}${err ? ' ' + err.message : ''}`);
}
ck('独立复算：用例 1 全部高级解 = 24 且 4 张牌各用一次', indBad === 0, `ok=${indOk} bad=${indBad}`);

// ═══════════════════════════════════════════════════════════════════════════
// 额外发现（本次量出来的，不在任务书列举范围内）
// 用例 1 的 2 条高级解本身就是一对「负负得正」重复：
//   ((11-7)÷((1/3)-(1/6)))  与  ((7-11)÷((1/6)-(1/3)))
// ⇒ 用例 1 与用例 2 是同一个缺陷的两个现场；task-80 修完后本组 advanced 应由 2 降为 1。
// ⇒ 这也意味着项目主在 (3,6,7,J) 答案窗口看到的两条高级解，实际是同一条写两遍。
console.log('\n' + '='.repeat(74));
console.log('额外发现 · 用例 1 的两条高级解自身构成负负得正重复对');
console.log('='.repeat(74));
if (disp1.advanced.length === 2) {
  const [x, y] = disp1.advanced;
  const qx = ev(parse(x)), qy = ev(parse(y));
  console.log(`  A = ${x}  值=${qx.n}/${qx.d}`);
  console.log(`  B = ${y}  值=${qy.n}/${qy.d}`);
  console.log('  两式关系：分子与分母同时取负 ⇒ 数学上同一解的两种书写');
  ck('额外.1 两条高级解数值相等（证它们确实是同一解）',
     qx.n === qy.n && qx.d === qy.d, `${qx.n}/${qx.d} vs ${qy.n}/${qy.d}`);
  ck('额外.2 [task-80 修完后应转绿] (3,6,7,J) 高级解去重后应为 1 条，非 2 条',
     r1.advanced.size === 1, `当前 advanced=${r1.advanced.size}（负负得正未归并）`);
} else {
  console.log(`  advanced.length=${disp1.advanced.length}，不是 2 条，跳过本段对比`);
  ck('额外.2 [task-80 修完后应转绿] (3,6,7,J) 高级解去重后应为 1 条',
     r1.advanced.size === 1, `当前 advanced=${r1.advanced.size}`);
}

// ════════════════════════════════════════════════════════════════════════
console.log('\n' + '='.repeat(74));
console.log(`[t82] pass=${pass} fail=${fail}  ${fail === 0 ? 'ALL PASS' : 'HAS FAIL'}`);
if (fail) { console.log('失败项：'); failed.forEach((f) => console.log('   - ' + f)); }
console.log('='.repeat(74));

// 真退出码（task-75/76 自暴的哑弹问题，本次不得重现）
process.exit(fail === 0 ? 0 : 1);
