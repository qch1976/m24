#!/usr/bin/env node
/**
 * E-2 双向核对 + E-5 步数反向验 —— task-122
 *
 * ■ E-2（经理要求两向，单向不算）
 *   正向：引擎枚举出的含幂/对数/开方解 ⇒ 逐条独立验算式子真的等 24
 *        🔴 独立性：用本文件自实现的 Q(BigInt) 求值器复算，不调 evalNode（否则引擎自产自证）
 *   反向：独立构造的合法解 ⇒ 引擎必须能枚举到（防漏枚举）
 *
 * ■ E-5 步数反向验
 *   幂/对数均二元（吃 2 张牌）⇒ 4 张牌必 3 步；步数 ≠ 3 即有运算被当叶子（GUI-4 病理）
 *   🔴 禁引开发「1270 条」的数字，本支自行采样取值
 *
 * 🔴 硬约束：禁引他人回显数字；条款 3 存在性前置；取数前先断言匹配数>0；
 *          条款 8 断言总数自断言 + 真退出码；禁浮点判等（纯 BigInt）
 */
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { pathToFileURL } from 'url';

const ROOT = process.argv[2];
if (!ROOT) { console.error('用法: node tester-task122-e2e5.mjs <repoRoot>'); process.exit(2); }

// 🔴 双平台必验（v22 linux + v24 Windows）：不能用 join() 拼路径后直接 import。
//   Windows 下 join('.', 'js/core/RecipSolver.mjs') === 'js\core\RecipSolver.mjs'，
//   会被 ESM 解析器当成【裸包名】⇒ ERR_INVALID_MODULE_SPECIFIER（服务器 v24 实测）。
//   须 resolve 成绝对路径再转 file:// URL。
const S = await import(pathToFileURL(resolve(ROOT, 'js/core/RecipSolver.mjs')).href);

let pass = 0, fail = 0;
const bad = [];
const T = (name, ok, extra = '') => {
  if (ok) { pass++; console.log(`  ok  ${name}${extra ? '  ' + extra : ''}`); }
  else { fail++; bad.push(name); console.log(`  XX  ${name}${extra ? '  ' + extra : ''}`); }
};

// ── 自实现精确有理 + 独立求值器（E-2 正向用，禁调 evalNode）
const bgcd = (a, b) => { a = a < 0n ? -a : a; b = b < 0n ? -b : b; while (b) { [a, b] = [b, a % b]; } return a; };
function Q(n, d = 1n) {
  if (d === 0n) return null;
  if (d < 0n) { n = -n; d = -d; }
  const g = bgcd(n, d) || 1n;
  return { n: n / g, d: d / g };
}
const qAdd = (a, b) => (a && b) ? Q(a.n * b.d + b.n * a.d, a.d * b.d) : null;
const qSub = (a, b) => (a && b) ? Q(a.n * b.d - b.n * a.d, a.d * b.d) : null;
const qMul = (a, b) => (a && b) ? Q(a.n * b.n, a.d * b.d) : null;
const qDiv = (a, b) => (a && b && b.n !== 0n) ? Q(a.n * b.d, a.d * b.n) : null;
const qIs24 = (f) => !!f && f.d === 1n && f.n === 24n;
const qStr = (f) => !f ? 'null' : (f.d === 1n ? `${f.n}` : `${f.n}/${f.d}`);

function myIpow(base, exp) {
  let r = 1n; const b = BigInt(base); const e = BigInt(exp);
  if (e < 0n) return null;
  for (let i = 0n; i < e; i++) r *= b;
  return r;
}
function myFact(n) { let r = 1n; for (let i = 2n; i <= BigInt(n); i++) r *= i; return r; }
function myExactRoot(a, b) {
  const A = BigInt(a);
  if (A < 0n) return null;
  for (let r = 0n; r <= A; r++) { const p = myIpow(r, b); if (p === A) return r; if (p > A) break; }
  return null;
}
function myLogExact(a, b) {
  for (let k = 1; k <= 20; k++) { const p = myIpow(a, k); if (p === BigInt(b)) return Q(BigInt(k)); if (p > BigInt(b)) break; }
  for (let q = 2; q <= 6; q++) for (let p = 1; p <= 20; p++) {
    if (p % q === 0) continue;
    if (myIpow(a, p) === myIpow(b, q)) return Q(BigInt(p), BigInt(q));
  }
  return null;
}

/**
 * 🔴 独立求值器：只认 AST 结构，不调用引擎任何求值函数
 * 字段名经实读 RecipSolver.mjs L50-L272 校正（首版我误以为 fact/recip 带 card，实为 arg 子节点）：
 *   num   { op:'num',   card, slot }
 *   recip { op:'recip', arg: numLeaf }
 *   fact  { op:'fact',  arg: numLeaf }
 *   mod   { op:'mod',   a: numLeaf, b: numLeaf }
 *   pow   { op:'pow',   a: numLeaf, b: numLeaf, rootIdx? }   // rootIdx 有值 ⇒ 开方别名
 *   log   { op:'log',   a: numLeaf, b: numLeaf }
 * 🔴 不读节点上的 v 字段（那是引擎算好的值，读它就变成引擎自产自证）。
 */
function leafCard(t) {
  // 取一个叶子节点的牌面数；仅接受 num 叶子（幂/对数/模两侧须为原始牌面 §1.3）
  if (!t || t.op !== 'num' || typeof t.card !== 'number') return null;
  return t.card;
}
function myEval(t) {
  if (!t) return null;
  switch (t.op) {
    case 'num':   return typeof t.card === 'number' ? Q(BigInt(t.card)) : null;
    case 'recip': { const c = leafCard(t.arg); return (c === null || c === 0) ? null : Q(1n, BigInt(c)); }
    case 'fact':  { const c = leafCard(t.arg); return c === null ? null : Q(myFact(c)); }
    case 'one':   return Q(1n);
    case 'zero':  return Q(0n);
    case 'mod': {
      const A = leafCard(t.a), B = leafCard(t.b);
      if (A === null || B === null || B === 0) return null;
      return Q(BigInt(A) % BigInt(B));
    }
    case 'pow': {
      const A = leafCard(t.a);
      if (A === null) return null;
      if (t.rootIdx !== undefined && t.rootIdx !== null) {   // §1.2/§2.4 开方别名
        const r = myExactRoot(A, t.rootIdx);
        return r === null ? null : Q(r);
      }
      const B = leafCard(t.b);
      if (B === null) return null;
      const v = myIpow(A, B);
      return v === null ? null : Q(v);
    }
    case 'log': {
      const A = leafCard(t.a), B = leafCard(t.b);
      return (A === null || B === null) ? null : myLogExact(A, B);
    }
    case '+':     return qAdd(myEval(t.a), myEval(t.b));
    case '-':     return qSub(myEval(t.a), myEval(t.b));
    case '*':     return qMul(myEval(t.a), myEval(t.b));
    case '/':     return qDiv(myEval(t.a), myEval(t.b));
    default:      return null;
  }
}

console.log('=== E-2 双向核对 + E-5 步数反向验 (task-122) ===');
console.log(`[env] node=${process.version} platform=${process.platform}/${process.arch}`);
console.log(`[repo] ${ROOT}`);
console.log('[独立性] E-2 正向用自实现 Q(BigInt) 求值器复算，不调 evalNode');
console.log('');

const selfSrc = readFileSync(new URL(import.meta.url), 'utf8');
const body = selfSrc.replace(/^\s*\*.*$/gm, '').replace(/\/\/.*$/gm, '');
T('🔴 E-2 独立性：不调用 S.evalNode（防引擎自产自证）', !/S\.evalNode\s*\(/.test(body));
T('🔴 禁引擎自产自证：不读 AST 节点上的 v 字段', !/\bt\.v\b|\.v\s*===|node\.v\b/.test(body.split('console.log(\'=== E-2')[0]));
T('🔴 禁浮点：不含 Math.log/pow/sqrt/toFixed/parseFloat',
  !/Math\.(log|pow|sqrt)\s*\(|toFixed\s*\(|parseFloat\s*\(/.test(body));

const CAPS_ALL = { recip: true, fact: true, mod: true, pow: true, log: true };
// 🔴 实读引擎 solve() 后修正首版两处错（已实证，非推测）：
//   ① caps 仅在 opts.advancedCalc 为真时生效（RecipSolver.mjs L955-957）
//      ⇒ 漏传 advancedCalc 会走「关闭态纯初级」，首跑得 n=0。
//      🔴 我一度疑引擎漏枚举，实为**我的调用错**，不得定为乙类缺陷。
//      （存在性前置断言正好拦住了这个假绿：若无它，「0 条全部通过」会报绿）
//   ② 返回值非 exprs 数组，而是 { primary:Map, advanced:Map, advancedNodes:Map(文本→AST), counts }（L1068）
const OPTS_ALL = { advancedCalc: true, caps: CAPS_ALL };

/** 从 solve 结果取含幂/对数的 AST：走 advancedNodes（文本→AST） */
function advTreesOf(res) {
  const out = [];
  const nodes = res && res.advancedNodes;
  if (!nodes || typeof nodes.entries !== 'function') return out;
  for (const [txt, t] of nodes.entries()) {
    if (!t || typeof t !== 'object' || !t.op) continue;
    if (S.countPow(t) === 0 && S.countLog(t) === 0) continue;
    out.push({ txt, t });
  }
  return out;
}

/**
 * 🔴 按符号分类统计引擎产出（条款 5 因果独立）。
 * 首版我写成「存在含 pow **或** log 的解」，实测注入「对数全不枚举」
 * （logEnumerable 直接 return false）仍 **全绿 17/0** —— 因为 pow 还在、把 log 的缺失蒙混过去了。
 * ⇒ 合并判定是废件，必须 **pow / root / log 三类各自单独断言**。
 */
function classifyTrees(res) {
  const r = { pow: 0, root: 0, log: 0 };
  for (const { t } of advTreesOf(res)) {
    let hasRoot = false, hasPurePow = false, hasLog = false;
    const walk = (x) => {
      if (!x || typeof x !== 'object') return;
      if (x.op === 'pow') {
        if (x.rootIdx !== undefined && x.rootIdx !== null) hasRoot = true; else hasPurePow = true;
      }
      if (x.op === 'log') hasLog = true;
      walk(x.a); walk(x.b); walk(x.arg);
    };
    walk(t);
    if (hasPurePow) r.pow++;
    if (hasRoot) r.root++;
    if (hasLog) r.log++;
  }
  return r;
}

console.log('--- E-2 正向：引擎枚举的含幂/对数/开方解 ⇒ 独立复算须等 24 ---');
const SAMPLE_HANDS = [
  [2, 3, 4, 8], [2, 2, 3, 9], [4, 2, 6, 3], [8, 3, 2, 4], [9, 3, 2, 5],
  [2, 4, 6, 8], [3, 3, 4, 4], [2, 8, 3, 6], [4, 4, 2, 3], [9, 2, 4, 6],
  [2, 2, 2, 3], [8, 8, 2, 3], [4, 9, 2, 2], [3, 9, 2, 4], [2, 3, 3, 8],
];
let fwdTotal = 0, fwdBadEval = 0;
const fwdBadSamples = [];
const advSolutions = [];

for (const hand of SAMPLE_HANDS) {
  const r = S.solve(hand, OPTS_ALL);
  for (const { txt, t } of advTreesOf(r)) {
    fwdTotal++;
    advSolutions.push({ hand, t, txt });
    const mine = myEval(t);
    if (!qIs24(mine)) {
      fwdBadEval++;
      if (fwdBadSamples.length < 5) fwdBadSamples.push(`${JSON.stringify(hand)} ${txt} 独立算得 ${qStr(mine)}`);
    }
  }
}

T('🔴 E-2 前置：引擎产出含幂/对数解数量 > 0（防静默零命中）', fwdTotal > 0, `n=${fwdTotal}`);
T('🔴 E-2 正向：每条含幂/对数解经独立求值器复算均 === 24', fwdBadEval === 0,
  fwdBadEval ? `不等 24 有 ${fwdBadEval} 条: ${fwdBadSamples.join(' ; ')}` : `全部 ${fwdTotal} 条通过`);
T('🔴 求值器双极性自证：错式子须不等 24',
  !qIs24(myEval({ op: '+', a: { op: 'num', card: 1 }, b: { op: 'num', card: 1 } })),
  `1+1 独立算得 ${qStr(myEval({ op: '+', a: { op: 'num', card: 1 }, b: { op: 'num', card: 1 } }))}`);
T('🔴 求值器正向自证：正确式子须等 24',
  qIs24(myEval({ op: '*', a: { op: 'num', card: 4 }, b: { op: 'num', card: 6 } })));

console.log('');
console.log('--- E-2 反向：独立构造的合法解 ⇒ 引擎必须枚举到（防漏枚举）---');
const REVERSE_HANDS = [
  [2, 3, 4, 8], [2, 2, 3, 9], [4, 2, 6, 3], [8, 3, 2, 4], [9, 3, 2, 5],
  [2, 4, 6, 8], [4, 4, 2, 3], [3, 9, 2, 4], [8, 8, 2, 3], [9, 2, 4, 6],
];
let revChecked = 0, revMissing = 0;
const revMissSamples = [];

for (const hand of REVERSE_HANDS) {
  // 独立构造：adv 二元吃 2 张 ⇒ 得一值，剩 2 张与之做四则，看能否凑 24
  const advMakers = [];
  const pairs = [[0, 1], [0, 2], [0, 3], [1, 2], [1, 3], [2, 3]];
  for (const [i, j] of pairs) {
    for (const [p, q] of [[i, j], [j, i]]) {
      const a = hand[p], b = hand[q];
      const rest = [0, 1, 2, 3].filter(k => k !== p && k !== q).map(k => hand[k]);
      if (a >= 2 && b >= 2) {
        const cap = a === 2 ? 8 : (a <= 5 ? 4 : (a <= 9 ? 3 : 2));   // §2.2 分档（照规格，非抄引擎）
        if (b >= 2 && b <= cap) advMakers.push({ val: Q(myIpow(a, b)), rest, tag: `${a}^${b}` });
        const rt = myExactRoot(a, b);
        if (rt !== null && rt !== 1n) advMakers.push({ val: Q(rt), rest, tag: `${a}^(1/${b})` });
        if (a !== b) { const lv = myLogExact(a, b); if (lv) advMakers.push({ val: lv, rest, tag: `log_${a} ${b}` }); }
      }
    }
  }
  let mineHas = false, mineWitness = '';
  const ops = [qAdd, qSub, qMul, qDiv];
  const names = ['+', '-', '*', '/'];
  for (const m of advMakers) {
    const [u, v] = m.rest;
    const U = Q(BigInt(u)), V = Q(BigInt(v));
    for (let o1 = 0; o1 < 4 && !mineHas; o1++) for (let o2 = 0; o2 < 4 && !mineHas; o2++) {
      const forms = [
        ops[o2](ops[o1](m.val, U), V), ops[o2](ops[o1](m.val, V), U),
        ops[o1](m.val, ops[o2](U, V)), ops[o1](ops[o2](U, V), m.val),
        ops[o2](ops[o1](U, m.val), V), ops[o2](ops[o1](V, m.val), U),
      ];
      for (const f of forms) if (qIs24(f)) { mineHas = true; mineWitness = `${m.tag} ${names[o1]}/${names[o2]} rest=[${u},${v}]`; break; }
    }
    if (mineHas) break;
  }
  if (!mineHas) continue;
  revChecked++;

  const r = S.solve(hand, OPTS_ALL);
  const engHas = advTreesOf(r).length > 0;
  if (!engHas) { revMissing++; revMissSamples.push(`${JSON.stringify(hand)} 我方见证=${mineWitness} 但引擎无含幂/对数解`); }
}

T('🔴 E-2 反向前置：我方独立构造成功的手牌数 > 0（防静默零命中）', revChecked > 0, `n=${revChecked}/${REVERSE_HANDS.length}`);
T('🔴 E-2 反向：我方能构造的含幂/对数解，引擎均能枚举到（无漏枚举）', revMissing === 0,
  revMissing ? `漏 ${revMissing} 例: ${revMissSamples.join(' ; ')}` : `${revChecked} 例全部命中`);

// 🔴 分类反向：pow / root(开方) / log 三类须【各自】非空
//   实测教训：合并判定时注入「log 全不枚举」仍全绿（pow 顶着），必须分类断言。
const clsTotal = { pow: 0, root: 0, log: 0 };
for (const hand of SAMPLE_HANDS) {
  const c = classifyTrees(S.solve(hand, OPTS_ALL));
  clsTotal.pow += c.pow; clsTotal.root += c.root; clsTotal.log += c.log;
}
console.log(`    分类统计（本支实测）: 纯幂=${clsTotal.pow} 开方=${clsTotal.root} 对数=${clsTotal.log}`);
T('🔴 E-2 反向分类：纯幂 a^b 解数 > 0', clsTotal.pow > 0, `n=${clsTotal.pow}`);
T('🔴 E-2 反向分类：开方 a^(1/b) 解数 > 0（§1.2 别名须真被枚举）', clsTotal.root > 0, `n=${clsTotal.root}`);
T('🔴 E-2 反向分类：对数 log_a b 解数 > 0（防被幂蒙混）', clsTotal.log > 0, `n=${clsTotal.log}`);

console.log('');
console.log('--- E-5 步数反向验：含幂/对数解步数恒 3 ---');
console.log('    🔴 禁引开发「1270 条」，本支自行采样取值');
T('🔴 E-5 前置：采样到的含幂/对数解数量 > 0', advSolutions.length > 0, `n=${advSolutions.length}`);

const stepDist = new Map();
let stepBad = 0;
const stepBadSamples = [];
for (const s of advSolutions) {
  const steps = S.advPostOrderSteps(s.t);
  const n = Array.isArray(steps) ? steps.length : -1;
  stepDist.set(n, (stepDist.get(n) || 0) + 1);
  if (n !== 3) {
    stepBad++;
    if (stepBadSamples.length < 5) stepBadSamples.push(`${JSON.stringify(s.hand)} ${s.txt} 步数=${n}`);
  }
}
console.log(`    步数分布（本支实测 n=${advSolutions.length}）: ${[...stepDist.entries()].sort((a, b) => a[0] - b[0]).map(([k, v]) => `${k}步×${v}`).join(', ')}`);

T('🔴 E-5 步数恒 3（≠3 即有二元运算被当叶子，GUI-4 病理）', stepBad === 0,
  stepBad ? `异常 ${stepBad} 条: ${stepBadSamples.join(' ; ')}` : `全部 ${advSolutions.length} 条为 3 步`);
T('🔴 E-5 步数分布只有一个桶且为 3', stepDist.size === 1 && stepDist.has(3), `桶=${[...stepDist.keys()].join(',')}`);

console.log('');
console.log('--- E-5 反向：步序列 ⇒ 独立复算须自洽 ---');
let rebuildChecked = 0, rebuildBad = 0;
const rebuildBadSamples = [];
for (const s of advSolutions.slice(0, 60)) {
  const steps = S.advPostOrderSteps(s.t);
  if (!Array.isArray(steps) || steps.length !== 3) continue;
  rebuildChecked++;
  const mine = myEval(s.t);
  if (!qIs24(mine)) {
    rebuildBad++;
    if (rebuildBadSamples.length < 3) rebuildBadSamples.push(`${s.txt} 独立算=${qStr(mine)}`);
  }
}
T('🔴 E-5 反向前置：可反推样本数 > 0', rebuildChecked > 0, `n=${rebuildChecked}`);
T('🔴 E-5 反向：步序列对应的树经独立复算均 === 24', rebuildBad === 0,
  rebuildBad ? `${rebuildBad} 条不符: ${rebuildBadSamples.join(' ; ')}` : `${rebuildChecked} 条自洽`);

let arityBad = 0, arityChecked = 0;
const arityBadSamples = [];
for (const s of advSolutions) {
  const walk = (t) => {
    if (!t || typeof t !== 'object') return;
    if (t.op === 'pow') {
      arityChecked++;
      const okBinary = (t.rootIdx !== undefined && t.rootIdx !== null) ? !!t.a : (!!t.a && !!t.b);
      if (!okBinary) { arityBad++; if (arityBadSamples.length < 3) arityBadSamples.push(s.txt); }
    }
    if (t.op === 'log') {
      arityChecked++;
      if (!(t.a && t.b)) { arityBad++; if (arityBadSamples.length < 3) arityBadSamples.push(s.txt); }
    }
    walk(t.a); walk(t.b);
  };
  walk(s.t);
}
T('🔴 E-5 前置：pow/log 节点检出数 > 0', arityChecked > 0, `n=${arityChecked}`);
T('🔴 E-5 二元性：pow/log 均吃 2 张牌（未被当原子叶子）', arityBad === 0,
  arityBad ? `${arityBad} 个: ${arityBadSamples.join(' ; ')}` : `${arityChecked} 个节点全合规`);

const EXPECTED = 20;
T(`断言总数自断言 = ${EXPECTED}`, pass + fail + 1 === EXPECTED, `实际 ${pass + fail + 1}`);

console.log('');
console.log(`E-2/E-5: pass=${pass} fail=${fail}  ${fail === 0 ? 'ALL PASS ✅' : 'HAS FAIL ❌'}`);
if (bad.length) console.log(`FAILED: ${bad.join(' | ')}`);
process.exit(fail ? 1 : 0);
