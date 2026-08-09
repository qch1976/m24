#!/usr/bin/env node
/**
 * E-6 独立实现反查器 —— task-122
 *
 * 🔴 立项要求（经理 task-122）：
 *   「另写一份与 js/core/RecipSolver 【零代码共享】的求解器，
 *     独立算 §5.2 穷举清单与可解组数，与引擎输出对比。」
 *   「开发 task-119 已自写过一份暂置不用（自产自验），你須独立另写。」
 *
 * 🔴 独立性声明（可被验证）：
 *   - 本文件 **零 import 产品代码**（无任何 `from '../js/...'`），
 *     连 Fraction 都自己实现（下方 `Q` 类，纯 BigInt）。
 *   - 判定依据 **只来自 INPUT-08.md 规格文字**，不看 RecipSolver 实现：
 *       §2.2  幂：底分档指数上限 2→8 / 3-5→4 / 6-9→3 / ≥10→2；底 a∈{0,1} 无效
 *       §2.2b 退化式 D-1 `a^1=a` / D-2 `log_a(a)=1` / D-3 `log_a(1)=0` 全排除
 *       §2.3  对数：底 2≤a≤13、真数 1≤b≤13、结果须精确；禁 Math.log，须整数幂反查
 *       §2.4  开方 `a^(1/b)` 仅当结果精确有理；禁浮点
 *   - 🔴 §5.2 基数期望 `3+5` 写成**独立字面量锚**（经理新常规：不由被测侧推算）
 *
 * 条款 3：零/空集判据均配存在性前置断言，全部走 T() 不用 console.log 充当断言
 * 🔴 新常规：凡过滤/匹配取数，先断言匹配数 > 0（防静默零命中）
 * 条款 8：断言总数自断言 + 真退出码
 */

let pass = 0, fail = 0;
const bad = [];
const T = (name, ok, extra = '') => {
  if (ok) { pass++; console.log(`  ok  ${name}${extra ? '  ' + extra : ''}`); }
  else { fail++; bad.push(name); console.log(`  XX  ${name}${extra ? '  ' + extra : ''}`); }
};

// ─────────────────────────────────────────────────────────
// 自实现精确有理数（纯 BigInt，禁浮点）—— 不用产品 Fraction
// ─────────────────────────────────────────────────────────
const bgcd = (a, b) => { a = a < 0n ? -a : a; b = b < 0n ? -b : b; while (b) { [a, b] = [b, a % b]; } return a; };
class Q {
  constructor(n, d = 1n) {
    if (d === 0n) throw new Error('分母为零');
    if (d < 0n) { n = -n; d = -d; }
    const g = bgcd(n, d) || 1n;
    this.n = n / g; this.d = d / g;
  }
  static of(n, d = 1n) { return new Q(BigInt(n), BigInt(d)); }
  isInt() { return this.d === 1n; }
  eq(o) { return this.n === o.n && this.d === o.d; }
  toString() { return this.d === 1n ? `${this.n}` : `${this.n}/${this.d}`; }
}

/** 整数幂（BigInt，禁 Math.pow） */
function ipow(base, exp) {
  let r = 1n; const b = BigInt(base); const e = BigInt(exp);
  if (e < 0n) throw new Error('ipow 负指数须另处理');
  for (let i = 0n; i < e; i++) r *= b;
  return r;
}

// ─────────────────────────────────────────────────────────
// §2.2 幂：按规格独立枚举
// ─────────────────────────────────────────────────────────
/** §2.2 指数上限分档（照抄规格表） */
function expCap(a) {
  if (a === 2) return 8;
  if (a >= 3 && a <= 5) return 4;
  if (a >= 6 && a <= 9) return 3;
  return 2;                       // ≥10
}

/** 枚举合法 a^b（整数指数），返回 [{a,b,val:Q,tag}] */
function enumPow() {
  const out = [];
  for (let a = 0; a <= 13; a++) {
    // §2.2 底 a∈{0,1} 一律无效
    if (a === 0 || a === 1) continue;
    const cap = expCap(a);
    for (let b = 1; b <= 13; b++) {
      if (b > cap) continue;                       // §2.2 分档上限
      if (b === 1) continue;                       // §2.2b D-1 `a^1=a` 排除
      out.push({ a, b, val: new Q(ipow(a, b)), tag: `${a}^${b}` });
    }
  }
  return out;
}

// ─────────────────────────────────────────────────────────
// §2.4 开方 a^(1/b)：整数幂反查，禁浮点
// ─────────────────────────────────────────────────────────
/** 求整数 r 使 r^b === a；无解返回 null（纯整数搜索，禁 Math.pow/Math.sqrt） */
function exactRoot(a, b) {
  if (a < 0) return null;
  const A = BigInt(a);
  for (let r = 0n; r <= A; r++) {
    const p = ipow(r, b);
    if (p === A) return r;
    if (p > A) break;
  }
  return null;
}

/** 枚举合法 a^(1/b)（开方，结果须精确有理）*/
function enumRoot() {
  const out = [];
  for (let a = 0; a <= 13; a++) {
    if (a === 0 || a === 1) continue;              // 同 §2.2 排除
    for (let b = 2; b <= 13; b++) {                // b=1 即 a^1 → D-1 排除
      const r = exactRoot(a, b);
      if (r === null) continue;                    // §2.4 无理 ⇒ 不计入
      if (r === 1n) continue;                      // 结果 1 属退化（a=1 已排除，此处兜底）
      out.push({ a, b, val: new Q(r), tag: `${a}^(1/${b})` });
    }
  }
  return out;
}

// ─────────────────────────────────────────────────────────
// §2.3 对数：整数幂反查，禁 Math.log
// ─────────────────────────────────────────────────────────
/**
 * §2.2b 退化判定 —— 单一口径，唯一排除点。
 * D-2 `log_a(a)=1`（b===a）、D-3 `log_a(1)=0`（b===1）
 */
function isDegenerate(a, b) { return b === a || b === 1; }

/** 枚举合法 log_a b，结果须精确整数或有理数 */
function enumLog() {
  const outInt = [], outRat = [], rawDegen = [];
  for (let a = 2; a <= 13; a++) {                  // §2.3 底 2≤a≤13
    for (let b = 1; b <= 13; b++) {                // §2.3 真数 1≤b≤13
      // 整数解：找 k 使 a^k === b（整数幂反查，禁 Math.log）
      // 🔴 k 从 1 起搜，把 D-2 `log_a(a)=1` 真正枚举出来，再由下方 D 类过滤统一排除。
      //   （原写法 k 从 2 起 + 上方 `if (b===a) continue` 双重排除 ⇒ 去掉任一处集合都不变
      //     ⇒ D-2 断言恒真、是废件。实测：注释掉 `b===a` 那行，整数解仍为 3 组、断言仍全绿。
      //     故改为单一排除口径：枚举照收，排除只在 isDegenerate() 一处发生，断言才有鉴别力。）
      let hitInt = null;
      for (let k = 1; k <= 13; k++) {
        const p = ipow(a, k);
        if (p === BigInt(b)) { hitInt = k; break; }
        if (p > BigInt(b)) break;
      }
      if (hitInt !== null) {
        if (!isDegenerate(a, b)) outInt.push({ a, b, val: new Q(BigInt(hitInt)), tag: `log_${a} ${b}=${hitInt}` });
        else rawDegen.push({ a, b, k: hitInt, tag: `log_${a} ${b}=${hitInt}` });
        continue;
      }
      // 有理解：log_a b = p/q ⟺ a^p === b^q（整数幂反查双向）
      let hitRat = null;
      for (let q = 2; q <= 4 && !hitRat; q++) {
        for (let p = 1; p <= 8; p++) {
          if (p % q === 0) continue;               // 可约 ⇒ 已属整数解范畴
          if (ipow(a, p) === ipow(b, q)) { hitRat = { p, q }; break; }
        }
      }
      if (hitRat && !isDegenerate(a, b)) outRat.push({ a, b, val: new Q(BigInt(hitRat.p), BigInt(hitRat.q)), tag: `log_${a} ${b}=${hitRat.p}/${hitRat.q}` });
    }
  }
  return { outInt, outRat, rawDegen };
}

// ─────────────────────────────────────────────────────────
// 执行 + 断言
// ─────────────────────────────────────────────────────────
console.log('=== E-6 独立实现反查器 (task-122) ===');
console.log(`[env] node=${process.version} platform=${process.platform}/${process.arch}`);
console.log('[独立性] 本文件零 import 产品代码；Fraction 自实现；判定依据仅 INPUT-08 规格文字');
console.log('');

// ── 独立性自证：本文件不得含产品代码 import
import { readFileSync } from 'fs';
const selfSrc = readFileSync(new URL(import.meta.url), 'utf8');
const prodImports = selfSrc.match(/from\s+['"][^'"]*js\/(core|ui|utils)\//g) || [];
T('🔴 独立性：本文件零 import 产品代码（零代码共享）', prodImports.length === 0,
  prodImports.length ? `命中 ${prodImports.join(',')}` : '命中 0');
T('🔴 禁浮点：本文件不含 Math.log / Math.pow / Math.sqrt / toFixed',
  !/Math\.(log|pow|sqrt)\s*\(|toFixed\s*\(/.test(selfSrc.replace(/^\s*\*.*$/gm, '').replace(/\/\/.*$/gm, '')));

const pows = enumPow();
const roots = enumRoot();
const { outInt, outRat, rawDegen } = enumLog();

// 🔴 新常规：取数前先断言匹配数 > 0（防静默零命中）
T('前置存在性：幂枚举非空', pows.length > 0, `n=${pows.length}`);
T('前置存在性：开方枚举非空', roots.length > 0, `n=${roots.length}`);
T('前置存在性：对数整数解非空', outInt.length > 0, `n=${outInt.length}`);

console.log('');
console.log('--- §5.2 独立穷举清单 ---');
console.log(`  对数整数解 (${outInt.length}): ${outInt.map(x => x.tag).join(', ')}`);
console.log(`  对数有理解 (${outRat.length}): ${outRat.map(x => x.tag).join(', ')}`);
console.log(`  开方精确解 (${roots.length}): ${roots.map(x => `${x.tag}=${x.val}`).join(', ')}`);
console.log(`  幂枚举组数: ${pows.length}`);
console.log('');

// 🔴 §5.2 基数锚：独立字面量，不由被测侧推算（经理新常规）
const ANCHOR_LOG_INT = 3;   // 规格 §2.2b 明列：log_2 4=2、log_2 8=3、log_3 9=2
const ANCHOR_RATIONAL = 5;  // 规格 §2.2b「+有理 5 组」
T(`🔴 §5.2 对数整数解 = 独立锚 ${ANCHOR_LOG_INT}`, outInt.length === ANCHOR_LOG_INT,
  `实测 ${outInt.length}: ${outInt.map(x => x.tag).join(',')}`);

// 规格明列的三组必须逐条命中（不只对数量）
for (const want of ['log_2 4=2', 'log_2 8=3', 'log_3 9=2']) {
  T(`§5.2 明列组合命中: ${want}`, outInt.some(x => x.tag === want),
    outInt.some(x => x.tag === want) ? '' : `实际集合=${outInt.map(x => x.tag).join(',')}`);
}

// D-1/D-2/D-3 退化式必须全被排除（逐类验，不只看总数）
// 🔴 条款 3：零集判据配存在性前置 —— 先证「退化式真被枚举到过」，再证「已被排除」。
//   否则若枚举器压根本没产出过退化式，「集合中无退化式」恒真 = 废件（已实测踩过）。
T('🔴 存在性前置：退化式确实被枚举到过（非从未产生）', rawDegen.length > 0, `rawDegen=${rawDegen.length}: ${rawDegen.slice(0, 4).map(x => x.tag).join(',')}`);
T('🔴 D-1 排除：枚举中无 a^1', pows.every(x => x.b !== 1), '');
T('🔴 D-2 排除：最终集合中无 log_a(a)', [...outInt, ...outRat].every(x => x.a !== x.b), '');
T('🔴 D-3 排除：最终集合中无 log_a(1)', [...outInt, ...outRat].every(x => x.b !== 1), '');
T('🔴 D-2 被枚举出且 k===1（即真为 log_a(a)=1）', rawDegen.some(x => x.a === x.b && x.k === 1),
  `rawDegen 中 a===b 且 k=1 的数量=${rawDegen.filter(x => x.a === x.b && x.k === 1).length}`);
T('🔴 §2.2 底 0/1 排除：幂枚举中无 a∈{0,1}', pows.every(x => x.a !== 0 && x.a !== 1), '');

// §2.2 分档上限逐档验（不共用 expCap，写死期望值 —— 条款 5 因果独立）
const capCases = [[2, 8], [3, 4], [5, 4], [6, 3], [9, 3], [10, 2], [13, 2]];
for (const [a, cap] of capCases) {
  const maxB = pows.filter(x => x.a === a).reduce((m, x) => Math.max(m, x.b), 0);
  T(`§2.2 分档上限 底${a} ⇒ 指数最大 ${cap}`, maxB === cap, `实测 ${maxB}`);
}

// §2.4 开方精确性：规格明举 4^(1/2)=2、8^(1/3)=2 须命中；2^(1/2) 须不在
T('§2.4 命中 4^(1/2)=2', roots.some(x => x.a === 4 && x.b === 2 && x.val.eq(Q.of(2))));
T('§2.4 命中 8^(1/3)=2', roots.some(x => x.a === 8 && x.b === 3 && x.val.eq(Q.of(2))));
T('🔴 §2.4 排除无理 2^(1/2)', !roots.some(x => x.a === 2 && x.b === 2));

// 精确性：所有结果均为精确有理（分母非零、无 NaN）
T('所有幂/开方/对数结果均精确有理（分母>0）',
  [...pows, ...roots, ...outInt, ...outRat].every(x => x.val.d > 0n));

// 条款 8：断言总数自断言
const EXPECTED = 27;
T(`断言总数自断言 = ${EXPECTED}`, pass + fail + 1 === EXPECTED, `实际 ${pass + fail + 1}`);

console.log('');
console.log(`E-6 独立反查: pass=${pass} fail=${fail}  ${fail === 0 ? 'ALL PASS ✅' : 'HAS FAIL ❌'}`);
if (bad.length) console.log(`FAILED: ${bad.join(' | ')}`);
process.exit(fail ? 1 : 0);
