// tester-input07-independent.mjs — INPUT-07 独立复核（task-93）
// 依据：INPUT-07.md §1/§4 + 200 规范 §1.5 + 201 附录 D-1~D-4
// 🔴 判据从需求文档重建，不引用 selftest/、不复用开发断言
import * as RS from '../js/core/RecipSolver.mjs';
import * as RP from '../js/core/RecipParser.mjs';

console.log(`[env] node=${process.version} platform=${process.platform}/${process.arch}`);
console.log(`[t93] INPUT-07 独立复核 @ ${new Date().toISOString()}`);

let pass = 0, fail = 0; const failed = [];
function ck(name, cond, extra) {
  if (cond) { pass++; console.log('  ok  ' + name + (extra ? '   ' + extra : '')); }
  else { fail++; failed.push(name); console.log('  XX  ' + name + (extra ? '   ' + extra : '')); }
  return !!cond;
}
const T = {
  n: (i) => ({ type: 'number', cardIndex: i }),
  op: (v) => ({ type: 'operator', value: v }),
  L: () => ({ type: 'left_paren' }), R: () => ({ type: 'right_paren' }),
  rec: () => ({ type: 'recip' }), f: () => ({ type: 'fact' }), m: () => ({ type: 'mod' }),
};

// ── 独立 Fraction（不共享 RecipSolver 代码）──
function gg(a, b) { a = a < 0n ? -a : a; b = b < 0n ? -b : b; while (b) { const t = a % b; a = b; b = t; } return a; }
function Q(n, d = 1n) { n = BigInt(n); d = BigInt(d); if (d === 0n) return null; if (d < 0n) { n = -n; d = -d; } const k = gg(n, d) || 1n; return { n: n / k, d: d / k }; }
const eq24 = (q) => !!q && q.d !== 0n && q.n === 24n * q.d;
const eqQ = (a, b) => !!a && !!b && a.n === b.n && a.d === b.d;
function factQ(n) { let r = 1n; for (let i = 2n; i <= BigInt(n); i++) r *= i; return Q(r); }

// ══════════════════════════════════════════════════════════════════
// ① isRawLeaf 剔括号不误伤（INPUT-07.md R-02/R-04 + 规范 §1.5.4）
// ══════════════════════════════════════════════════════════════════
console.log('\n' + '='.repeat(72));
console.log('① isRawLeaf 剔括号不误伤');
console.log('='.repeat(72));

// cardValues 索引 0..3
const CV_A = [4, 3, 7, 2];   // idx0=4 idx1=3 idx2=7 idx3=2
console.log(`  cardValues = ${JSON.stringify(CV_A)}  (idx0=4 idx1=3 idx2=7 idx3=2)`);

console.log('\n  ── 合法式必须通过（不误伤）──');
const LEGAL = [
  ['(4)!',        [T.L(), T.n(0), T.R(), T.f()]],
  ['((4))!',      [T.L(), T.L(), T.n(0), T.R(), T.R(), T.f()]],
  ['1/(3)',       [T.rec(), T.L(), T.n(1), T.R()]],
  ['1/((3))',     [T.rec(), T.L(), T.L(), T.n(1), T.R(), T.R()]],
  ['(7)%(3)',     [T.L(), T.n(2), T.R(), T.m(), T.L(), T.n(1), T.R()]],
  ['((7))%((3))', [T.L(), T.L(), T.n(2), T.R(), T.R(), T.m(), T.L(), T.L(), T.n(1), T.R(), T.R()]],
];
for (const [label, toks] of LEGAL) {
  const r = RP.parse(toks, CV_A);
  ck(`①合法 ${label} 应通过`, r.ok === true, r.ok ? '' : `被拒: error=${r.error}`);
}

console.log('\n  ── 非法式必须拒收，且错误码须为作用域类（非崩溃）──');
// 🔴 拒收必须验证原因：错误码须在作用域类白名单内，排除 UNEXPECTED_TOKEN 等崩溃/结构错
const SCOPE_ERRS = new Set([
  RP.ERR.FACT_OPERAND_NOT_LEAF, RP.ERR.MOD_OPERAND_NOT_LEAF, RP.ERR.RECIP_OPERAND_NOT_LEAF,
]);
const ILLEGAL = [
  ['(2+2)!',  [T.L(), T.n(3), T.op('+'), T.n(3), T.R(), T.f()], 'fact'],
  ['(3×2)!',  [T.L(), T.n(1), T.op('*'), T.n(3), T.R(), T.f()], 'fact'],
  ['(3+4)%3', [T.L(), T.n(1), T.op('+'), T.n(0), T.R(), T.m(), T.n(1)], 'mod'],
  ['7%(1+2)', [T.n(2), T.m(), T.L(), T.n(3), T.op('+'), T.n(3), T.R()], 'mod'],
];
for (const [label, toks, kind] of ILLEGAL) {
  const r = RP.parse(toks, CV_A);
  const rejected = r.ok === false;
  const scoped = rejected && SCOPE_ERRS.has(r.error);
  console.log(`     ${label.padEnd(10)} ok=${r.ok} error=${r.error || '-'}`);
  ck(`①非法 ${label} 被拒`, rejected);
  ck(`①非法 ${label} 错误码为作用域类（非崩溃）`, scoped, `error=${r.error}`);
}

// ══════════════════════════════════════════════════════════════════
// ② 禁止矩阵 9 行全拒收（规范 §1.5.2，含架构师补全的 1/(1/3)）
// 🔴 拒收必须验证原因：须为作用域类错误码，排除崩溃/token 结构错
// ══════════════════════════════════════════════════════════════════
console.log('\n' + '='.repeat(72));
console.log('② 禁止矩阵 9 行全拒收（3 符号 × 3 符号）');
console.log('='.repeat(72));

// cardValues: idx0=3 idx1=7 idx2=2 idx3=4
const CV_M = [3, 7, 2, 4];
console.log(`  cardValues = ${JSON.stringify(CV_M)}  (idx0=3 idx1=7 idx2=2 idx3=4)`);
console.log('  外层符号 × 内层符号 ⇒ 9 组，全部须拒且错误码为作用域类\n');

const MATRIX = [
  // [外层, 内层, 式, tokens]
  ['recip', 'recip', '1/(1/3)',  [T.rec(), T.L(), T.rec(), T.n(0), T.R()]],
  ['recip', 'fact',  '1/(3!)',   [T.rec(), T.L(), T.n(0), T.f(), T.R()]],
  ['recip', 'mod',   '1/(7%3)',  [T.rec(), T.L(), T.n(1), T.m(), T.n(0), T.R()]],
  ['fact',  'fact',  '(3!)!',    [T.L(), T.n(0), T.f(), T.R(), T.f()]],
  ['fact',  'recip', '(1/3)!',   [T.L(), T.rec(), T.n(0), T.R(), T.f()]],
  ['fact',  'mod',   '(7%3)!',   [T.L(), T.n(1), T.m(), T.n(0), T.R(), T.f()]],
  ['mod',   'fact',  '(3!)%2',   [T.L(), T.n(0), T.f(), T.R(), T.m(), T.n(2)]],
  ['mod',   'recip', '(1/3)%2',  [T.L(), T.rec(), T.n(0), T.R(), T.m(), T.n(2)]],
  ['mod',   'mod',   '(7%3)%2',  [T.L(), T.n(1), T.m(), T.n(0), T.R(), T.m(), T.n(2)]],
];
let mtxRejected = 0, mtxScoped = 0;
for (const [outer, inner, label, toks] of MATRIX) {
  let r, threw = null;
  try { r = RP.parse(toks, CV_M); } catch (e) { threw = e; r = { ok: 'THREW' }; }
  const rejected = threw === null && r.ok === false;
  const scoped = rejected && SCOPE_ERRS.has(r.error);
  if (rejected) mtxRejected++;
  if (scoped) mtxScoped++;
  const tag = `${outer}×${inner}`;
  console.log(`  ${tag.padEnd(13)} ${label.padEnd(10)} ok=${String(r.ok).padEnd(5)} error=${r.error || (threw ? 'THREW:' + threw.message : '-')}`);
  ck(`②${tag} ${label} 被拒`, rejected, threw ? `抛异常 ${threw.message}` : '');
  ck(`②${tag} ${label} 错误码为作用域类（排除崩溃）`, scoped, `error=${r.error}`);
}
console.log(`\n  矩阵汇总：拒收 ${mtxRejected}/9   作用域类错误码 ${mtxScoped}/9`);
ck('②禁止矩阵 9 行全部被拒', mtxRejected === 9, `${mtxRejected}/9`);
ck('②禁止矩阵 9 行错误码全为作用域类', mtxScoped === 9, `${mtxScoped}/9`);

// ②补充：任务书点名确认 1/(1/3)（派工时漏列，架构师补全）
const r113 = RP.parse([T.rec(), T.L(), T.rec(), T.n(0), T.R()], CV_M);
console.log(`\n  【点名确认】1/(1/3): ok=${r113.ok} error=${r113.error} message="${r113.message}"`);
ck('②【点名】1/(1/3) 确实被拒（派工漏列项）', r113.ok === false && SCOPE_ERRS.has(r113.error), `error=${r113.error}`);

// ②反向：solver 侧也不得产出嵌套修饰（独立扫 AST）
console.log('\n  ── solver 侧：全量抽样牌组的解中不得出现嵌套修饰 ──');
const ADV_OPS = new Set(['recip', 'fact', 'mod']);
function scanNested(t, insideAdv = false) {
  if (!t || typeof t !== 'object') return 0;
  let bad = 0;
  const isAdv = ADV_OPS.has(t.op);
  if (isAdv && insideAdv) bad++;
  const kids = [];
  if (t.a) kids.push(t.a); if (t.b) kids.push(t.b); if (t.arg) kids.push(t.arg);
  for (const k of kids) bad += scanNested(k, insideAdv || isAdv);
  return bad;
}

// ══════════════════════════════════════════════════════════════════
// ③ D-4 收窄后 29 组既有解回归（取证牌组 [0,3,4,6]）
// ══════════════════════════════════════════════════════════════════
console.log('\n' + '='.repeat(72));
console.log('③ D-4 收窄验证：6÷3! 与 3!÷6 须为两条独立解（结构不同构）');
console.log('='.repeat(72));

const D_WIT = [0, 3, 4, 6];
const rw = RS.solve(D_WIT, { advancedCalc: true });
console.log(`  牌组 [0,3,4,6]  primary=${rw.primary.size}  advanced=${rw.advanced.size}`);

// 独立构造：6÷3! 与 3!÷6（各占 idx3=6, idx1=3；另两张牌需凑满 4 张，
// 故只验 keySol 不同 —— 结构同构性判据不依赖是否可达 24）
let sq = 0;
const N = (c) => RS.numLeaf(c, sq++);
const FL = (c) => RS.factLeaf(c, sq++);
const B = (op, a, b) => ({ op, a, b });

sq = 0; const e6d3f = B('/', N(6), FL(3));   // 6 ÷ 3!
sq = 0; const e3fd6 = B('/', FL(3), N(6));   // 3! ÷ 6
const v1 = RS.evalNode(e6d3f), v2 = RS.evalNode(e3fd6);
const k1 = RS.keySol(RS.reduceToFixpoint(e6d3f).node);
const k2 = RS.keySol(RS.reduceToFixpoint(e3fd6).node);
console.log(`  6÷3! = ${v1 ? v1.n + '/' + v1.d : 'null'}   keySol=${k1}`);
console.log(`  3!÷6 = ${v2 ? v2.n + '/' + v2.d : 'null'}   keySol=${k2}`);
// 独立复算：3!=6，故两式值均为 1
const mine = { a: Q(6), b: factQ(3) };
console.log(`  独立复算：3! = ${mine.b.n}/${mine.b.d}，6÷3! = 1，3!÷6 = 1（值相等）`);
ck('③两式值确实相等（这正是误并的诱因）', eqQ(v1, v2), `${v1.n}/${v1.d} vs ${v2.n}/${v2.d}`);
ck('③但 keySol 不同 ⇒ 未被 D-4 误并（裸叶子 vs fact 节点结构不同构）',
   k1 !== k2, k1 === k2 ? '🔴 被误并为同一键' : '两键独立');

// ③全量旧键缺失核验：关闭高级 → 开启高级，初级解集须为超集（严格粗化）
console.log('\n  ── 全量抽样：开高级后初级解集不得丢键（严格粗化）──');
function combos4() {
  const out = [];
  for (let a = 0; a <= 13; a++) for (let b = a; b <= 13; b++)
    for (let c = b; c <= 13; c++) for (let d = c; d <= 13; d++) out.push([a, b, c, d]);
  return out;
}
const ALL = combos4();
console.log(`  牌组全集（0..13 非降序 4 元组）= ${ALL.length} 组`);
let lostTotal = 0, lostDecks = 0, chkDecks = 0;
const lostSamples = [];
for (const deck of ALL) {
  const off = RS.solve(deck, { advancedCalc: false });
  const on = RS.solve(deck, { advancedCalc: true });
  chkDecks++;
  let lost = 0;
  for (const k of off.primary.keys()) if (!on.primary.has(k)) lost++;
  if (lost) { lostTotal += lost; lostDecks++; if (lostSamples.length < 5) lostSamples.push(`${JSON.stringify(deck)}:${lost}`); }
}
console.log(`  扫描 ${chkDecks} 组；初级键丢失总数 = ${lostTotal}（涉及 ${lostDecks} 组）`);
if (lostSamples.length) console.log(`  样例: ${lostSamples.join('  ')}`);
ck('③全量旧键缺失 = 0（严格粗化，开高级不吃掉初级解）', lostTotal === 0, `lost=${lostTotal}`);

// ══════════════════════════════════════════════════════════════════
// ④ 双 % 归并方向（附录 D-1~D-4）
// ══════════════════════════════════════════════════════════════════
console.log('\n' + '='.repeat(72));
console.log('④ 双 % 归并方向：外层项可交换须并，% 两侧绝不可交换');
console.log('='.repeat(72));

const ML = (a, as, b, bs) => RS.modLeaf(a, as, b, bs);
const kOf = (t) => RS.keySol(RS.reduceToFixpoint(t).node);

// ④.1 須归并：(7%3)+(9%4) ⟷ (9%4)+(7%3)   —— D-1 外层项顺序
const p1 = B('+', ML(7, 0, 3, 1), ML(9, 2, 4, 3));
const p2 = B('+', ML(9, 2, 4, 3), ML(7, 0, 3, 1));
console.log(`  (7%3)+(9%4) keySol = ${kOf(p1)}`);
console.log(`  (9%4)+(7%3) keySol = ${kOf(p2)}`);
ck('④.1 [D-1 須归并] 外层 + 的两项交换 ⇒ 同键', kOf(p1) === kOf(p2));

// ④.2 禁归并：7%3 vs 3%7 —— % 两侧不可交换，值不同
const m73 = ML(7, 0, 3, 1), m37 = ML(3, 1, 7, 0);
const v73 = RS.evalNode(m73), v37 = RS.evalNode(m37);
console.log(`  7%3 = ${v73.n}/${v73.d}   3%7 = ${v37.n}/${v37.d}`);
console.log(`  独立复算：7 mod 3 = 1，3 mod 7 = 3  ⇒ 值不同`);
ck('④.2 独立复算 7%3=1', eqQ(v73, Q(1)), `${v73.n}/${v73.d}`);
ck('④.2 独立复算 3%7=3', eqQ(v37, Q(3)), `${v37.n}/${v37.d}`);
ck('④.2 [禁归并] 7%3 与 3%7 键不同（% 两侧不可交换）', kOf(m73) !== kOf(m37));

// ④.3 須归并：(7%3)-(9%4)=0 与反序=0 —— D-4，两侧均为 mod 且值相等
const s1 = B('-', ML(7, 0, 3, 1), ML(9, 2, 4, 3));
const s2 = B('-', ML(9, 2, 4, 3), ML(7, 0, 3, 1));
const vs1 = RS.evalNode(s1), vs2 = RS.evalNode(s2);
console.log(`  (7%3)-(9%4) = ${vs1.n}/${vs1.d}   反序 = ${vs2.n}/${vs2.d}`);
console.log(`  独立复算：7%3=1, 9%4=1 ⇒ 1-1=0，反序 1-1=0`);
ck('④.3 两式值均为 0', eqQ(vs1, Q(0)) && eqQ(vs2, Q(0)));
ck('④.3 [D-4 須归并] 两侧均 mod 且值相等 ⇒ 同键', kOf(s1) === kOf(s2),
   kOf(s1) === kOf(s2) ? '' : `${kOf(s1)} vs ${kOf(s2)}`);

// ④.4 禁归并：6÷3! vs 3!÷6（③已验，此处作为 D-4 边界再确认）
ck('④.4 [禁归并] 6÷3! vs 3!÷6 键不同（值同但结构不同构）', k1 !== k2);

// ══════════════════════════════════════════════════════════════════
// R-03 阶乘上限与退化（独立重建判据，不引 isFactDegenerate 作为期望）
// ══════════════════════════════════════════════════════════════════
console.log('\n' + '='.repeat(72));
console.log('R-03 阶乘上限 ≤6 + 退化判据（0! 有效 / 1!,2! 退化）');
console.log('='.repeat(72));
console.log('  判据独立重建自 INPUT-07.md §1.2.2/§1.2.3：可枚举 ⟺ card≤6 且 factQ(card)≠card');

let r03bad = 0;
for (let c = 0; c <= 13; c++) {
  const fq = factQ(c);                       // 独立算阶乘
  const changed = !eqQ(fq, Q(c));            // 值是否变化（退化判据）
  const expect = c <= 6 && changed;          // 需求：≤6 且非退化
  const actual = RS.factEnumerable(c);
  const okRow = expect === actual;
  if (!okRow) r03bad++;
  const tag = c === 0 ? ' ← 0!：0→1 值变化，須有效' : (c === 1 || c === 2) ? ' ← 退化' : (c >= 7 ? ' ← ≥7 超上限' : '');
  console.log(`  card=${String(c).padStart(2)}  ${c}!=${String(fq.n).padStart(4)}  值变化=${changed ? 'Y' : 'N'}  期望枚举=${expect ? 'Y' : 'N'}  实际=${actual ? 'Y' : 'N'}  ${okRow ? 'ok' : 'XX'}${tag}`);
}
ck('R-03 阶乘可枚举性 0..13 全部符合需求', r03bad === 0, `不符 ${r03bad} 项`);
ck('R-03 0! 计入（值 0→1 属有效变化）', RS.factEnumerable(0) === true);
ck('R-03 1! 不计入（退化）', RS.factEnumerable(1) === false);
ck('R-03 2! 不计入（退化）', RS.factEnumerable(2) === false);
ck('R-03 6! 计入（=720，上限内）', RS.factEnumerable(6) === true);
ck('R-03 7! 不计入（≥7 超上限）', RS.factEnumerable(7) === false);

// ══════════════════════════════════════════════════════════════════
// R-06 模退化：仅 a%a 不枚举；a%1、a<b 时 a%b 均計入 ⇒ 有效组合应为 169
// ══════════════════════════════════════════════════════════════════
console.log('\n' + '='.repeat(72));
console.log('R-06 模退化：仅 a%a 剔除；a%1 与 a<b 均計入（期望 169 组）');
console.log('='.repeat(72));
console.log('  判据独立重建自 §1.3.2/§1.3.3：a≥0 且 b>0 且 a≠b');

let modCnt = 0, r06bad = 0;
for (let a = 0; a <= 13; a++) for (let b = 0; b <= 13; b++) {
  const expect = a >= 0 && b > 0 && a !== b;   // 独立判据
  const actual = RS.modEnumerable(a, b);
  if (expect !== actual) { r06bad++; if (r06bad <= 5) console.log(`  XX a=${a} b=${b} 期望=${expect} 实际=${actual}`); }
  if (actual) modCnt++;
}
console.log(`  有效模组合数 = ${modCnt}   （14×14=196 减 b=0 的 14 组、减 a==a 的 13 组 = 169）`);
ck('R-06 模可枚举性 14×14 全部符合需求', r06bad === 0, `不符 ${r06bad} 项`);
ck('R-06 有效模组合数 = 169', modCnt === 169, `实际 ${modCnt}`);
ck('R-06 a%a 不枚举（取 7%7）', RS.modEnumerable(7, 7) === false);
ck('R-06 a%1 計入（取 7%1，值 0 但有效）', RS.modEnumerable(7, 1) === true);
ck('R-06 a<b 時 a%b 計入（取 3%7=3）', RS.modEnumerable(3, 7) === true);
ck('R-06 b=0 拒绝（取 7%0，含王牌 0 作模数）', RS.modEnumerable(7, 0) === false);
ck('R-06 0%5 計入（王牌作被模数，0≥0 合法）', RS.modEnumerable(0, 5) === true);

// ══════════════════════════════════════════════════════════════════
// R-01 开关两态：关闭态严格等于初级符号完成态
// ══════════════════════════════════════════════════════════════════
console.log('\n' + '='.repeat(72));
console.log('R-01 开关两态：关闭态 advanced 恒为 0，且 primary 与开启态一致');
console.log('='.repeat(72));
let offAdvNonZero = 0, primDiff = 0;
for (const deck of ALL) {
  const off = RS.solve(deck, { advancedCalc: false });
  const on = RS.solve(deck, { advancedCalc: true });
  if (off.advanced.size !== 0) offAdvNonZero++;
  if (off.primary.size !== on.primary.size) primDiff++;
}
console.log(`  扫描 ${ALL.length} 组：关闭态 advanced≠0 的组数 = ${offAdvNonZero}`);
console.log(`  关闭态与开启态 primary 计数不一致的组数 = ${primDiff}`);
ck('R-01 关闭态 advanced 恒为 0（无高级 solver）', offAdvNonZero === 0, `异常 ${offAdvNonZero} 组`);
ck('R-01 两态 primary 完全一致（关闭态=初级完成态）', primDiff === 0, `差异 ${primDiff} 组`);

// ══════════════════════════════════════════════════════════════════
// R-12 % 记号三处一致（按钮 / 提示 / 答案）
// ══════════════════════════════════════════════════════════════════
console.log('\n' + '='.repeat(72));
console.log('R-12 % 记号一致性：solver 渲染侧须用 %（按钮侧由静态检查覆盖）');
console.log('='.repeat(72));
const modExpr = B('+', ML(7, 0, 3, 1), N(9));
const rendered = RS.render(modExpr);
const renderedDisp = RS.renderDisplay(modExpr);
console.log(`  render()        = ${rendered}`);
console.log(`  renderDisplay() = ${renderedDisp}`);
ck('R-12 render 使用 % 记号', rendered.includes('%'), rendered);
ck('R-12 renderDisplay 使用 % 记号', renderedDisp.includes('%'), renderedDisp);
ck('R-12 未混用 mod/MOD 等其它记号', !/mod/i.test(rendered) && !/mod/i.test(renderedDisp));
const factExpr = B('+', FL(4), N(0));
console.log(`  阶乘 render     = ${RS.render(factExpr)}`);
ck('R-12 阶乘使用后缀 ! 记号', RS.render(factExpr).includes('!'));

// ══════════════════════════════════════════════════════════════════
// 人工验算（INPUT-07.md §5.4 明定，不可省）
// 逐式列出 + 独立手算 + 标注是否应归并
// ══════════════════════════════════════════════════════════════════
console.log('\n' + '='.repeat(72));
console.log('人工验算 · 2 组（一组含 4!、一组含双 %），逐式手算校对 solver 输出');
console.log('='.repeat(72));

let manBad = 0;
function manual(label, node, handCalcQ, handCalcText) {
  const sv = RS.evalNode(node);
  const okv = eqQ(sv, handCalcQ);
  if (!okv) manBad++;
  console.log(`  ${okv ? 'ok ' : 'XX '} ${label.padEnd(22)} solver=${sv ? sv.n + '/' + sv.d : 'null'}  手算=${handCalcQ.n}/${handCalcQ.d}`);
  console.log(`       手算过程: ${handCalcText}`);
  return { key: kOf(node), val: sv };
}

// ── 验算组 A：牌组 [4,1,1,1]，含 4! ──
console.log('\n  【验算组 A】牌组 [4,1,1,1] —— 含 4!');
const rA = RS.solve([4, 1, 1, 1], { advancedCalc: true });
console.log(`  solver: primary=${rA.primary.size}  advanced=${rA.advanced.size}`);
console.log(`  高级解全量: ${JSON.stringify([...rA.advanced.values()])}`);

sq = 0; const A1 = B('+', B('+', FL(4), N(1)), B('-', N(1), N(1)));   // 4!+1+(1-1)
sq = 0; const A2 = B('*', FL(4), B('*', N(1), B('*', N(1), N(1))));   // 4!×1×1×1
sq = 0; const A3 = B('-', B('+', FL(4), N(1)), N(1));                 // (4!+1)-1  … 只用 3 张，仅作值校对

// 手算：4! = 1×2×3×4 = 24
const h4f = factQ(4);
console.log(`  手算 4! = 1×2×3×4 = ${h4f.n}`);
const mA1 = manual('4!+1+(1-1)', A1, Q(25), '4!=24; 1-1=0; 24+1+0 = 25');
const mA2 = manual('4!×1×1×1', A2, Q(24), '4!=24; 24×1×1×1 = 24 ✅ 可达 24');
const vA1 = RS.evalNode(A1);
console.log(`  重新校验 4!+1+(1-1): solver=${vA1.n}/${vA1.d}  手算 24+1+0=25`);
ck('人算A.1 4!+1+(1-1) = 25（expected 与 tokens 算式严格一致）', eqQ(vA1, Q(25)), `${vA1.n}/${vA1.d}`);
ck('人算A.2 4!×1×1×1 = 24', eqQ(RS.evalNode(A2), Q(24)));
ck('人算A.3 4! 独立复算 = 24（1×2×3×4）', eqQ(h4f, Q(24)), `${h4f.n}/${h4f.d}`);
// 归并标注：A2 的三个 1 相乘，乘链排序归一 ⇒ 不同 slot 的 1 互换应同键
sq = 0; const A2b = B('*', B('*', B('*', N(1), N(1)), N(1)), FL(4));  // 1×1×1×4! 换序
console.log(`  4!×1×1×1 keySol = ${kOf(A2)}`);
console.log(`  1×1×1×4! keySol = ${kOf(A2b)}`);
ck('人算A.4 [应归并] 乘链换序同键（4!×1×1×1 ⟷ 1×1×1×4!）', kOf(A2) === kOf(A2b));

// ── 验算组 B：牌组 [7,3,9,4]，含双 % ──
console.log('\n  【验算组 B】牌组 [7,3,9,4] —— 含双 %');
const rB = RS.solve([3, 4, 7, 9], { advancedCalc: true });
console.log(`  solver: primary=${rB.primary.size}  advanced=${rB.advanced.size}`);

// 手算：7%3 = 7 - 3×2 = 1；9%4 = 9 - 4×2 = 1
console.log('  手算 7%3: 7 = 3×2 + 1 ⇒ 余 1');
console.log('  手算 9%4: 9 = 4×2 + 1 ⇒ 余 1');
const B1 = B('+', ML(7, 0, 3, 1), ML(9, 2, 4, 3));    // (7%3)+(9%4) = 1+1 = 2
const B2 = B('-', ML(7, 0, 3, 1), ML(9, 2, 4, 3));    // (7%3)-(9%4) = 1-1 = 0
const B3 = B('*', ML(7, 0, 3, 1), ML(9, 2, 4, 3));    // (7%3)×(9%4) = 1×1 = 1
manual('(7%3)+(9%4)', B1, Q(2), '7%3=1; 9%4=1; 1+1 = 2');
manual('(7%3)-(9%4)', B2, Q(0), '7%3=1; 9%4=1; 1-1 = 0');
manual('(7%3)×(9%4)', B3, Q(1), '7%3=1; 9%4=1; 1×1 = 1');
ck('人算B.1 (7%3)+(9%4) = 2', eqQ(RS.evalNode(B1), Q(2)));
ck('人算B.2 (7%3)-(9%4) = 0', eqQ(RS.evalNode(B2), Q(0)));
ck('人算B.3 (7%3)×(9%4) = 1', eqQ(RS.evalNode(B3), Q(1)));

// 归并标注表
console.log('\n  ── 归并标注（人工判定 vs solver keySol）──');
const B1r = B('+', ML(9, 2, 4, 3), ML(7, 0, 3, 1));
const B2r = B('-', ML(9, 2, 4, 3), ML(7, 0, 3, 1));
const B3r = B('*', ML(9, 2, 4, 3), ML(7, 0, 3, 1));
const rows = [
  ['(7%3)+(9%4) ⟷ 反序', '应归并', 'D-1 外层 + 可交换', kOf(B1) === kOf(B1r)],
  ['(7%3)×(9%4) ⟷ 反序', '应归并', 'D-1 外层 × 可交换', kOf(B3) === kOf(B3r)],
  ['(7%3)-(9%4) ⟷ 反序', '应归并', 'D-4 两侧均 mod 且同值 0', kOf(B2) === kOf(B2r)],
  ['7%3 ⟷ 3%7',          '禁归并', '% 两侧不可交换，值 1≠3', kOf(m73) !== kOf(m37)],
  ['6÷3! ⟷ 3!÷6',        '禁归并', '值同但结构不同构', k1 !== k2],
];
for (const [f, want, why, ok] of rows) {
  console.log(`  ${ok ? 'ok ' : 'XX '} ${f.padEnd(22)} ${want}  (${why})`);
  ck(`人算B 归并标注 ${f} → ${want}`, ok);
}
ck('人工验算：所有手算值与 solver 一致', manBad === 0, `不一致 ${manBad} 项`);

// ══════════════════════════════════════════════════════════════════
// 结果为 0 的 mod 模式（任务书「37 组」）：值同但 mask 不同 ⇒ 不得归并
// ⚠️ 判据限定为 mod 零值式；初级 a-a 塔缩为 ZERO 是 INPUT-06 既有正确行为，不属本项
// ═══════════════════════════════════════════════════════════════
console.log('\n' + '='.repeat(72));
console.log('结果为 0 的 mod 模式：值同 mask 不同 ⇒ 不得归并');
console.log('='.repeat(72));
const zmods = [[7, 1], [5, 1], [9, 1], [12, 6], [8, 4], [10, 5]];
const zkeys = []; let zAllZero = true;
for (const [za, zb] of zmods) {
  sq = 0; const zt = ML(za, 0, zb, 1);
  const zv = RS.evalNode(zt); const zkk = kOf(zt);
  zkeys.push(zkk);
  if (!eqQ(zv, Q(0))) zAllZero = false;
  console.log(`  ${za}%${zb} = ${zv.n}/${zv.d}   keySol=${zkk}`);
}
ck('零值模式 各 mod 式值均为 0', zAllZero);
ck('零值模式 值同但 mask 不同 ⇒ 键各自独立（不归并）',
   new Set(zkeys).size === zmods.length, `独立键 ${new Set(zkeys).size}/${zmods.length}`);
sq = 0; const zsolo = ML(7, 0, 1, 1);
ck('零值模式 mod 零值节点单独存在时保留 mask（未塔缩为 ZERO）',
   kOf(zsolo) !== 'ZERO', `keySol=${kOf(zsolo)}`);

// ═══════════════════════════════════════════════════════════════
// 既有回归牌组：INPUT-06 三牌组结论须保持
// ══════════════════════════════════════════════════════════════════
console.log('\n' + '='.repeat(72));
console.log('既有回归牌组（INPUT-07.md §8 必含用例）结论保持');
console.log('='.repeat(72));
for (const [label, deck] of [['(3,6,7,J)', [3, 6, 7, 11]], ['(6,6,8,Q)', [6, 6, 8, 12]], ['(王,6,Q,Q)', [0, 6, 12, 12]]]) {
  const off = RS.solve(deck, { advancedCalc: false });
  const on = RS.solve(deck, { advancedCalc: true });
  console.log(`  ${label.padEnd(11)} 关闭态 primary=${off.primary.size}  开启态 primary=${on.primary.size} advanced=${on.advanced.size}`);
  ck(`既有牌组 ${label} 开高级不改变 primary`, off.primary.size === on.primary.size,
     `${off.primary.size} vs ${on.primary.size}`);
}
// (3,6,7,J) task-82 结论：无初级解、有高级解
const r367J = RS.solve([3, 6, 7, 11], { advancedCalc: true });
ck('既有牌组 (3,6,7,J) 仍无初级解（task-82 结论保持）', r367J.primary.size === 0, `primary=${r367J.primary.size}`);
ck('既有牌组 (3,6,7,J) 仍有高级解', r367J.advanced.size > 0, `advanced=${r367J.advanced.size}`);


// ══════════════════════════════════════════════════════════════════
// 🔴 缺陷取证段（本次独立复核发现）
// 现象 + 复现牌组 + 判据（按纪律不写根因、不给行号）
// ══════════════════════════════════════════════════════════════════
console.log('\n' + '='.repeat(72));
console.log('🔴 缺陷取证：含 % 的解落入【初级解分区】，且归约式牌数 4→2');
console.log('='.repeat(72));

// 判据来源 1：INPUT-07.md R-01「关闭态严格等于初级符号完成态」
//   ⇒ 开启态 primary 不得多出关闭态没有的键
// 判据来源 2：INPUT-07.md §1.3「% 占用 2 个数字」+ 保牌性
//   ⇒ 任何解的归约式须仍用满 4 张牌
function leafCards(t, acc = []) {
  if (!t || typeof t !== 'object') return acc;
  if (t.op === 'num') { acc.push(t.card); return acc; }
  if (t.op === 'recip' || t.op === 'fact') { acc.push(t.arg ? t.arg.card : t.card); return acc; }
  if (t.op === 'one' || t.op === 'zero') return acc;
  if (t.a) leafCards(t.a, acc); if (t.b) leafCards(t.b, acc); if (t.arg) leafCards(t.arg, acc);
  return acc;
}

sq = 0; const bug = B('*', B('+', ML(2, 1, 1, 0), N(2)), N(12));
const bugRR = RS.reduceToFixpoint(bug);
const bugV = RS.evalNode(bug);
console.log(`  复现式   : ${RS.render(bug)}`);
console.log(`  原式叶子 : ${JSON.stringify(leafCards(bug))}  (4 张)`);
console.log(`  归约式   : ${RS.render(bugRR.node)}`);
console.log(`  归约叶子 : ${JSON.stringify(leafCards(bugRR.node))}  (${leafCards(bugRR.node).length} 张)`);
console.log(`  归约式键 : ${RS.keySol(bugRR.node)}`);
console.log(`  独立复算 : 2%1=0, 0+2=2, 2×12=24 ⇒ ${bugV.n}/${bugV.d}`);
ck('缺陷取证 该式独立复算 = 24', eq24(Q(bugV.n, bugV.d)));

// ⚠️ 判据修正（task-95 复核）：原「归约式须 4 叶」判据**已撑销**。
//   撑销依据（本人独立复核，非采信 Developer 数字）：
//   关闭态（纯初级、零高级符号）primary 3958 条中有 **514 条（13.0%）**归约键<4 叶，
//   例 [2,2,3,8] 的 (((2-2)+3)×8) → 键 (* n3 n8) 仅 2 叶。
//   ⇒ 该判据会误伤大量纯初级解，判据本身不成立。
//   归约式塔缩（零项/单位因子吸收）是设计行为；**保牌性应验【原式】**。
const bugLeavesRaw = leafCards(bug).length;
const bugLeavesRR = leafCards(bugRR.node).length;
console.log(`\n  【判据 1′】保牌性验【原式】：原式叶子 ${bugLeavesRaw} 张（归约式 ${bugLeavesRR} 张，塔缩属设计行为）`);
ck('判据1′ 保牌性：原式须 4 张牌各用一次', bugLeavesRaw === 4, `原式实测 ${bugLeavesRaw} 张`);

const bugDeck = [1, 2, 2, 12];
const bOff = RS.solve(bugDeck, { advancedCalc: false });
const bOn = RS.solve(bugDeck, { advancedCalc: true });
const extra = [...bOn.primary.keys()].filter((k) => !bOff.primary.has(k));
console.log(`\n  【判据 2】牌组 ${JSON.stringify(bugDeck)}：关闭态 primary=${bOff.primary.size}  开启态 primary=${bOn.primary.size}`);
console.log(`  开启态多出的键 = ${JSON.stringify(extra)}`);
for (const k of extra) console.log(`     键 ${k} 展示文本 = ${bOn.primary.get(k)}   ← 初级分区含 % 字样`);
ck('🔴缺陷2 R-01 开启态 primary 不得多出关闭态没有的键', extra.length === 0, `多出 ${extra.length} 键`);

console.log('\n  【判据 3】全量扫描：primary 分区展示文本含 %/! 的条目数');
let badDecks = 0, badExprs = 0; const badSamples = [];
for (const deck of ALL) {
  const r = RS.solve(deck, { advancedCalc: true });
  let n = 0;
  for (const v of r.primary.values()) if (/[%!]/.test(v)) n++;
  if (n) {
    badDecks++; badExprs += n;
    if (badSamples.length < 6) badSamples.push(`${JSON.stringify(deck)} → ${[...r.primary.values()].filter((v) => /[%!]/.test(v))[0]}`);
  }
}
console.log(`  受影响牌组 = ${badDecks} 组，条目总数 = ${badExprs} 条`);
badSamples.forEach((s) => console.log(`     ${s}`));
ck('🔴缺陷3 primary 分区不得出现含 %/! 的展示文本', badExprs === 0, `实测 ${badExprs} 条 / ${badDecks} 组`);

// ══════════════════════════════════════════════════════════════════
console.log('\n' + '='.repeat(72));
console.log(`[t93] pass=${pass} fail=${fail}  ${fail === 0 ? 'ALL PASS' : 'HAS FAIL'}`);
if (fail) { console.log('失败项：'); failed.forEach((f) => console.log('   - ' + f)); }
console.log('='.repeat(72));
process.exit(fail === 0 ? 0 : 1);
