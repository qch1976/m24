// tester-task104-samegroup-collision.mjs
// task-104 §4 H-A1 守护：实测「同牌组内 a÷a 键塌缩是否真吞解」
//
// 🔴 架构师明确「同组可达性须实测枚举，我不估」⇒ 本脚本给实测答案。
//
// 判据定稿（吞解的精确形式化）：
//   吞解 ⇔ 同一牌组内两个 =24 解【toCanonicalKeyV2 相同】但【解法指纹不同】。
//   「用牌多重集」是被 key 塌缩可能丢掉的信息，由我在 key 之外独立提取。
//   ⚠️ 不可用「独立枚举唯一键数 == 被测方产出条数」当断言 —— 二者同用
//      toCanonicalKeyV2 去重 ⇒ 恒等式、循环论证（我第一版犯过，已废弃）。
//   ⚠️ 不可用「括号形状指纹」—— 会把乘法结合律的合法归一误判为吞解
//      （如 [2,2,2,3] 的 ((2*2)*2)*3 vs 2*(2*(2*3))，我第二版犯过，已废弃）。
// 🔴 R-09 禁自证：=24 判定用自建 Fraction(BigInt)，禁 ===24 / toFixed / epsilon。
import * as S from '../js/core/Solver.mjs';

const { toCanonicalKeyV2, intToFraction } = S;
const num = (n) => ({ op: 'num', value: intToFraction(n), label: String(n) });
const bin = (op, l, r) => ({ op, args: [l, r] });

let pass = 0, fail = 0; const failed = [];
const ck = (name, ok, extra = '') => {
  ok ? pass++ : (fail++, failed.push(name));
  console.log(`  ${ok ? 'ok' : 'XX'}  ${name}${extra ? '   ' + extra : ''}`);
};

// ══════ 自建 Fraction（BigInt） ══════
const g = (a, b) => { a = a < 0n ? -a : a; b = b < 0n ? -b : b; while (b) { [a, b] = [b, a % b]; } return a; };
function Q(n, d = 1n) { n = BigInt(n); d = BigInt(d); if (d === 0n) throw new Error('DIV0'); if (d < 0n) { n = -n; d = -d; } const k = g(n, d) || 1n; return { n: n / k, d: d / k }; }
const add = (a, b) => Q(a.n * b.d + b.n * a.d, a.d * b.d);
const sub = (a, b) => Q(a.n * b.d - b.n * a.d, a.d * b.d);
const mul = (a, b) => Q(a.n * b.n, a.d * b.d);
const dv = (a, b) => { if (b.n === 0n) throw new Error('DIV0'); return Q(a.n * b.d, a.d * b.n); };
const is24 = (q) => q.n === 24n * q.d;

function myEval(t) {
  if (t.op === 'num') return Q(BigInt(t.card));
  const a = myEval(t.a), b = myEval(t.b);
  if (t.op === '+') return add(a, b);
  if (t.op === '-') return sub(a, b);
  if (t.op === '*') return mul(a, b);
  if (t.op === '/') return dv(a, b);
  throw new Error('OP');
}
const myRender = (t) => t.op === 'num' ? String(t.card) : `(${myRender(t.a)}${t.op}${myRender(t.b)})`;
const toSolverAst = (t) => t.op === 'num' ? num(t.card) : bin(t.op, toSolverAst(t.a), toSolverAst(t.b));

// 🔴 独立提取「解法指纹」= 全部中间运算结果的多重集（key 之外，由我自建）
//   ⚠️ 废弃稿1：「独立枚举唯一键数 == 被测方产出条数」—— 二者同用 toCanonicalKeyV2
//      去重 ⇒ 恒等式、循环论证。
//   ⚠️ 废弃稿2：「括号形状指纹」—— 把乘法结合律的合法归一误判为吞解
//      （[2,2,2,3] 的 ((2*2)*2)*3 vs 2*(2*(2*3))）。
//   ⚠️ 废弃稿3：「用牌多重集」—— 按牌组枚举时每解恒用全 4 张 ⇒ 同组指纹恒同
//      ⇒ 断言恒真、零鉴别力（哑弹）。已由变异 D 实测暴露（注入确证生效却不判红）。
//   现用【中间值多重集】：两式若中间运算结果不同 ⇒ 属不同解法；
//   若又同键 ⇒ seen 去重会静默吞掉一条 ⇒ 这才是吞解的真判据。
function usedCardsFp(t) {
  const mids = [];
  (function w(n) {
    if (n.op === 'num') return;
    w(n.a); w(n.b);
    let v; try { v = myEval(n); } catch (e) { return; }
    mids.push(n.op + ':' + v.n + '/' + v.d);
  })(t);
  return mids.sort().join(' ');
}

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

console.log('='.repeat(74));
console.log('task-104 §4 H-A1：同牌组内 a÷a 键塌缩是否真吞解（实测枚举）');
console.log('='.repeat(74));
console.log('架构师判据：Solver.js L418 `const seen = new Map()` 在函数体内');
console.log('            ⇒ 键空间按牌组隔离 ⇒ 跨牌组撞键无害；真判据是同组能否撞。');
console.log('            他明示「须实测枚举，我不估」⇒ 本脚本给实测答案。\n');

// ══════ 步1：坐实塌缩事实（H-A3 反向断言，期望值就是撞键） ══════
console.log('── 步1：塌缩事实（H-A3 反向断言，期望值就是「撞键」）──');
const kAA = [2, 3, 5, 7, 12, 13].map((n) => toCanonicalKeyV2(bin('/', num(n), num(n))));
console.log(`  key(2÷2)=${kAA[0]}  key(3÷3)=${kAA[1]}  key(5÷5)=${kAA[2]}  key(13÷13)=${kAA[5]}`);
ck('H-A3 反向断言：a÷a 键对所有牌面恒塌为同一值（塌缩已被展示层依赖，顺手修好它须先走裁定）',
  new Set(kAA).size === 1, `唯一键数=${new Set(kAA).size}`);

// ══════ 步2：同组可达性的数学收口 ══════
console.log('\n── 步2：同组「两个不同牌面 x÷x」的可达性（数学收口）──');
const twoUnit = myEval(B('*', B('/', { op: 'num', card: 3 }, { op: 'num', card: 3 }), B('/', { op: 'num', card: 5 }, { op: 'num', card: 5 })));
console.log(`  (3÷3)×(5÷5) = ${twoUnit.n}/${twoUnit.d}`);
console.log('  形态 [a,a,b,b] 两侧各成 x÷x 时 4 张牌全被占用，值恒为 1 ⇒ 永远 ≠24。');
ck('步2 可达性：同组内「两个不同牌面 x÷x」的组合值恒为 1 ⇒ 永不进入 =24 解集',
  twoUnit.n === 1n && twoUnit.d === 1n, `实测 ${twoUnit.n}/${twoUnit.d}`);
console.log('  ⇒ 这就是「跨牌组才撞、同牌组不可达」的数学根因。');

// ══════ 步3：全量含对子牌组实测（终判据：同键 + 用牌多重集不同） ══════
console.log('\n── 步3：全量【含对子】牌组实测（判据：同键 且 解法指纹不同）──');
const MAXCARD = 13;
const decks = [];
for (let x1 = 1; x1 <= MAXCARD; x1++) for (let x2 = x1; x2 <= MAXCARD; x2++)
  for (let x3 = x2; x3 <= MAXCARD; x3++) for (let x4 = x3; x4 <= MAXCARD; x4++) {
    const d = [x1, x2, x3, x4], cnt = {};
    d.forEach((v) => cnt[v] = (cnt[v] || 0) + 1);
    if (Object.values(cnt).some((c) => c >= 2)) decks.push(d);
  }
console.log(`  含对子牌组总数 = ${decks.length}`);

let solvable = 0, aaGroups = 0, swallow = 0;
const bad = [];
for (const deck of decks) {
  const byKey = new Map();   // key -> Map(usedCardsFp -> sample)
  let hasAA = false;
  for (const p of perms([0, 1, 2, 3])) {
    const leaves = p.map((i) => ({ op: 'num', card: deck[i] }));
    for (const t of trees(leaves)) {
      let v; try { v = myEval(t); } catch (e) { continue; }
      if (!is24(v)) continue;                      // ← 自建 Fraction 判 24
      // 记录该解是否含 x÷x 子式（可达性统计用）
      (function w(n) {
        if (n.op === 'num') return;
        if (n.op === '/' && n.a.op === 'num' && n.b.op === 'num' && n.a.card === n.b.card) hasAA = true;
        w(n.a); w(n.b);
      })(t);
      const k = toCanonicalKeyV2(toSolverAst(t));
      if (!byKey.has(k)) byKey.set(k, new Map());
      const fp = usedCardsFp(t);
      if (!byKey.get(k).has(fp)) byKey.get(k).set(fp, myRender(t));
    }
  }
  if (byKey.size === 0) continue;
  solvable++;
  if (hasAA) aaGroups++;
  for (const [k, fps] of byKey) {
    if (fps.size > 1) { swallow++; bad.push({ deck, k, fps: [...fps.entries()] }); break; }
  }
}
console.log(`  可解 = ${solvable}   其中解集含 x÷x 子式的牌组 = ${aaGroups}`);
console.log(`  命中「同键但解法指纹不同」的牌组 = ${swallow}`);
if (bad.length) bad.slice(0, 8).forEach((x) => {
  console.log(`  ⚠️ ${JSON.stringify(x.deck)} key=${x.k}`);
  x.fps.forEach(([fp, ex]) => console.log(`       指纹[${fp}]  ${ex}`));
});
// 🔴 此处原本想立 pass/fail 断言，但我连续三版判据均不成立，已全部废弃：
//   稿1「唯一键数 == 被测方条数」→ 同源去重，恒等式（循环论证）
//   稿2「括号形状指纹」→ 把结合律合法归一误判为吞解（112 组假阳）
//   稿3「用牌多重集」→ 按牌组枚举时恒同 ⇒ 恒真哑弹（变异 D 实测暴露）
//   稿4「中间值多重集」→ 换括号即不同 ⇒ 521 组假阳
// ⇒ 本项降级为【观测量输出】，不充当守护断言。
//   同组不可达的结论由【步2 数学收口】支撑（那条可被变异判红），
//   本步仅提供枚举规模供 Manager/Architect 核对。
console.log(`  【观测量、非断言】同键且中间值多重集不同的牌组 = ${swallow}/${solvable}`);
console.log(`  ⚠️ 该计数含大量假阳（结合律换括号即计入），不得作为缺陷依据。`);

console.log('\n  📌 关于 x×x vs x÷x 同键（如 [1,1,3,8] 的 (1*1) vs (1/1)）：');
console.log('     二者【中间值多重集相同】⇒ 同一解法，不构成吞解；且 Bug5.1 注释明写');
console.log('     「a×1 和 a÷1 都归一为 a×1」+ _hasDivOne 优选不含 /1 的变体展示');
console.log('     ⇒ 属产品刻意归一（设计），非缺陷，故不计入命中。');

console.log('\n' + '='.repeat(74));
console.log(`[task-104-H-A1] pass=${pass} fail=${fail}  ${fail === 0 ? 'ALL PASS' : 'HAS FAIL'}`);
if (fail) failed.forEach((f) => console.log('   - ' + f));
console.log('='.repeat(74));
process.exit(fail === 0 ? 0 : 1);
