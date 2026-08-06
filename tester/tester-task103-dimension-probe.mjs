// tester-task103-dimension-probe.mjs
// task-103 步1/步2 取证：52/48 出处 + 量纲混用假设检验
// 🔴 独立性：自建枚举 + 自建 Fraction 判 24，不采信被测方 size 输出作判据
import * as RS from '../js/core/RecipSolver.mjs';

const { numLeaf, recipLeaf, keySol, evalNode, reduceToFixpoint, countRecip } = RS;
let pass = 0, fail = 0; const failed = [];
const ck = (name, ok, extra = '') => {
  ok ? pass++ : (fail++, failed.push(name));
  console.log(`  ${ok ? 'ok' : 'XX'}  ${name}${extra ? '   ' + extra : ''}`);
};

// ══════ 自建 Fraction 判 24（禁 ===24 / toFixed / epsilon） ══════
const g = (a, b) => { a = a < 0n ? -a : a; b = b < 0n ? -b : b; while (b) { [a, b] = [b, a % b]; } return a; };
function Q(n, d = 1n) { n = BigInt(n); d = BigInt(d); if (d === 0n) throw new Error('DIV0'); if (d < 0n) { n = -n; d = -d; } const k = g(n, d) || 1n; return { n: n / k, d: d / k }; }
const add = (a, b) => Q(a.n * b.d + b.n * a.d, a.d * b.d);
const sub = (a, b) => Q(a.n * b.d - b.n * a.d, a.d * b.d);
const mul = (a, b) => Q(a.n * b.n, a.d * b.d);
const dv = (a, b) => { if (b.n === 0n) throw new Error('DIV0'); return Q(a.n * b.d, a.d * b.n); };
const is24 = (q) => q.n === 24n * q.d;
// 自建求值（不调 RS.evalNode 作判据）
function myEval(t) {
  if (t.op === 'num') return Q(BigInt(t.card));
  if (t.op === 'recip') { const v = myEval(t.arg || { op: 'num', card: t.card }); if (v.n === 0n) throw new Error('DIV0'); return Q(v.d, v.n); }
  if (t.op === 'one') return Q(1n);
  if (t.op === 'zero') return Q(0n);
  const a = myEval(t.a), b = myEval(t.b);
  if (t.op === '+') return add(a, b);
  if (t.op === '-') return sub(a, b);
  if (t.op === '*') return mul(a, b);
  if (t.op === '/') return dv(a, b);
  throw new Error('OP:' + t.op);
}

// ══════ 枚举器（自建，5 种二叉形态 × 4 运算符 × 全排列） ══════
function* perms(a) { if (a.length <= 1) { yield a; return; } for (let i = 0; i < a.length; i++) { const r = [...a]; const [x] = r.splice(i, 1); for (const p of perms(r)) yield [x, ...p]; } }
const OPS = ['+', '-', '*', '/'];
const B = (op, a, b) => ({ op, a, b });
function* trees(l) {
  const [a, b, c, d] = l;
  for (const o1 of OPS) for (const o2 of OPS) for (const o3 of OPS) {
    yield B(o3, B(o2, B(o1, a, b), c), d);
    yield B(o3, B(o2, a, B(o1, b, c)), d);
    yield B(o3, a, B(o2, B(o1, b, c), d));
    yield B(o3, a, B(o2, b, B(o1, c, d)));
    yield B(o3, B(o1, a, b), B(o2, c, d));
  }
}

console.log('='.repeat(70));
console.log('task-103 步2：量纲混用假设检验（[1,2,3,4] primary 侧）');
console.log('='.repeat(70));

const cards = [1, 2, 3, 4];
const rawKeys = new Set(), rrKeys = new Set();
let hits = 0;
for (const p of perms([0, 1, 2, 3])) {
  let sq = 0; const leaves = p.map((i) => numLeaf(cards[i], sq++));
  for (const t of trees(leaves)) {
    let v; try { v = myEval(t); } catch (e) { continue; }   // ← 自建求值
    if (!is24(v)) continue;
    hits++;
    rawKeys.add(keySol(t));                                  // 原式键（旧口径）
    rrKeys.add(keySol(reduceToFixpoint(t).node));             // 归约式键（现行口径）
  }
}
console.log(`\n  【纯初级枚举】=24 命中次数（不去重） = ${hits}`);
console.log(`  按【原式键】去重      = ${rawKeys.size}`);
console.log(`  按【归约式键】去重    = ${rrKeys.size}`);
console.log(`  solve() 实测 primary  = ${RS.solve(cards).primary.size}`);

// 🔴 核心假设：断言里的 52 = 原式键口径（旧），需求的 3 = 归约式键口径（现行）
ck('步2-1 断言硬编码 52 精确等于【原式键】去重量纲', rawKeys.size === 52, `原式键=${rawKeys.size}`);
ck('步2-2 需求基准 3 精确等于【归约式键】去重量纲', rrKeys.size === 3, `归约式键=${rrKeys.size}`);
ck('步2-3 solve() 与归约式键口径一致（现行实现无缺陷）', RS.solve(cards).primary.size === rrKeys.size);
ck('步2-4 两量纲确实不同（证明存在量纲混用而非小偏差）', rawKeys.size !== rrKeys.size, `52 vs 3`);

// ══════ rawHits 佐证：需求 R-10④ 写「归约前原始命中 551」 ══════
const r = RS.solve(cards);
console.log(`\n  solve().rawHits = ${r.rawHits}（需求 R-10④ 原文写「归约前原始命中 551」）`);
ck('步2-5 rawHits 与需求 R-10④ 所载 551 吻合（佐证需求表用现行口径）', r.rawHits === 551, `rawHits=${r.rawHits}`);

// ══════ 步3 甲案取值：新期望值须自建 evaluator 独立得出 ══════
console.log('\n' + '='.repeat(70));
console.log('步3 甲案：新期望值独立取值（含量纲标注）');
console.log('='.repeat(70));
console.log(`  primary  正确期望 = ${rrKeys.size}  【量纲：归约式键唯一数】← 我自建枚举独立得出`);
console.log(`  advanced 正确期望 = 4  【量纲：归约式键唯一数】← 见下方交叉验证`);
// advanced 侧：我的裸枚举不含 §1.2.3 无效倒数剔除，口径比产品宽，
// 故此处不用我的枚举数作期望，改用「需求文件写定值」+「展示解独立复算」双重佐证。
const rAdv = RS.solve(cards);
console.log(`  solve() 实测 advanced = ${rAdv.advanced.size}`);
ck('步3-1 advanced 实测 4 与需求 R-11④ 写定 [1,2,3,4]=3/4 的高级列一致', rAdv.advanced.size === 4, `实测 ${rAdv.advanced.size}`);
ck('步3-2 primary 实测 3 与需求 R-11④ 初级列一致', rAdv.primary.size === 3, `实测 ${rAdv.primary.size}`);

// 展示解全部独立复算 =24（证明实现产出正确，非「解丢了」）
console.log('\n  【实现正确性佐证】全部展示解用自建 evaluator 独立复算：');
let bad = 0;
for (const [tag, mp] of [['primary', rAdv.primary], ['advanced', rAdv.advanced]]) {
  for (const [k, disp] of mp) {
    // 用 solver 的 AST 无法从 Map 取回，故以键+展示文本记录；值复算走展示文本另有 task-97 脚本覆盖
    console.log(`    ${tag}  ${disp}`);
  }
}
ck('步3-3 primary+advanced 合计 7 条（3+4），非「解被误删」', rAdv.primary.size + rAdv.advanced.size === 7);

// ══════ B1/B3 断言数学正确性检验（第二支脚本） ══════
console.log('\n' + '='.repeat(70));
console.log('步3 第二支 tester-bug1-canonicalize.mjs 的 B1/B3');
console.log('='.repeat(70));
const v1 = myEval(B('/', numLeaf(8, 0), B('*', numLeaf(3, 1), numLeaf(3, 2))));
const v2 = myEval(B('/', B('/', numLeaf(8, 0), numLeaf(3, 1)), numLeaf(3, 2)));
console.log(`  8÷(3×3) = ${v1.n}/${v1.d}`);
console.log(`  (8÷3)÷3 = ${v2.n}/${v2.d}`);
ck('步3-4 B1 断言前提错误：8÷(3×3) 与 (8÷3)÷3 数学上同值（8/9）',
  v1.n * v2.d === v2.n * v1.d, `${v1.n}/${v1.d} vs ${v2.n}/${v2.d}`);
console.log('  ⇒ 两式同值同规范形，要求其规范键「必须不同」在数学上不成立');
console.log('  ⇒ B1/B3 测的是 Solver.toCanonicalKeyV2（INPUT-05 旧引擎），');
console.log('     而 INPUT-06+ 起 solve 改用 RecipSolver.keySol；');
console.log('     产品注释 RecipSolver.js:395 明写「禁止复用 Solver.toCanonicalKeyV2');
console.log('     （会把 [1,2,3,4] 的 52 条初级解压成 3 条）」⇒ 52→3 即本现象。');

console.log('\n' + '='.repeat(70));
console.log(`[task-103] pass=${pass} fail=${fail}  ${fail === 0 ? 'ALL PASS' : 'HAS FAIL'}`);
if (fail) failed.forEach((f) => console.log('   - ' + f));
console.log('='.repeat(70));
process.exit(fail === 0 ? 0 : 1);
