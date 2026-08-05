/**
 * task-74 新哨兵 [1,4,6,8] 有效性自证
 *
 * 经理原话：「旧哨兵栽的就是这一步没做 —— 门禁得先证明自己抓得住错，
 *             才有资格说全绿有意义。」
 *
 * ★ 本脚本【独立枚举 + 独立双 evaluator】，不调用 solve()，不问 solver 对错，
 *   符合 R-04 / R-04.1「禁止 solver 自证」。只复用最底层的 Fraction 原语
 *   （addF/subF/mulF/divF/F）与 leafVariants —— 这些是「被测对象的地基」，
 *   若连它们都不可信，任何测试都无从谈起；且下方反证A/B 会顺带验证它们。
 *
 * 自证逻辑：
 *   1. 独立 dfs 枚举全部表达式树（复刻 RecipSolver 的配对规则）
 *   2. 用【精确 Fraction】判定哪些 =24  → 基准真值集合
 *   3. 用【独立浮点 evaluator + 严格 ===24】重算同一批树 → 已知错误实现
 *   4. 漏解率 = 精确认可但浮点漏掉 / 精确认可总数
 *   5. 漏解率 > 0 ⇒ 哨兵抓得住浮点错误 ⇒ 有效
 *      漏解率 = 0 ⇒ 形同虚设（旧哨兵 [13,12,11,9] 正是如此）
 *
 * ⚠️ 规则 17（尺子自证）：本脚本自己也是尺子，先跑两条反证：
 *    反证A：把「错误实现」换成精确实现 → 漏解率必须 0%
 *            （证明漏解确由浮点造成，而非我的枚举/比对逻辑有 bug）
 *    反证B：把「错误实现」换成恒返回 0 → 漏解率必须 100%
 *            （证明本脚本真在比对，而不是无论如何都吐同一个数）
 *    两条反证任一不成立 ⇒ 本脚本结论一律不予采信。
 */
// 具名 import：addF/subF/mulF/divF 只有具名导出，不在 default 里
import { leafVariants, addF, subF, mulF, divF, render, F,
         reduceToFixpoint, keySol, countRecip } from '../js/core/RecipSolver.mjs';

const OPS = ['+', '-', '*', '/'];

// ── 独立枚举：复刻 dfs24 的配对与剪枝（不调用 solve）──────────
function enumerateAll(cards) {
  const trees = [];
  function dfs(items) {
    if (items.length === 1) { trees.push(items[0].t); return; }
    const n = items.length;
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (i === j) continue;
        const rest = [];
        for (let k = 0; k < n; k++) if (k !== i && k !== j) rest.push(items[k]);
        const A = items[i], B = items[j];
        for (const op of OPS) {
          if ((op === '+' || op === '*') && i > j) continue; // 交换律剪枝
          let v;
          switch (op) {
            case '+': v = addF(A.v, B.v); break;
            case '-': v = subF(A.v, B.v); break;
            case '*': v = mulF(A.v, B.v); break;
            default:  v = divF(A.v, B.v); break;             // divF 除零返回 null
          }
          if (v === null) continue;
          dfs([{ t: { op, a: A.t, b: B.t }, v }, ...rest]);
        }
      }
    }
  }
  for (const lv of leafVariants(cards)) dfs(lv.map(t => ({ t, v: t.v })));
  return trees;
}

// ── evaluator #1：精确 Fraction（基准真值）────────────────────
function evalExact(t) {
  switch (t.op) {
    case 'num':   return t.v;
    case 'one':   return F(1n, 1n);
    case 'zero':  return F(0n, 1n);
    case 'recip': { const v = evalExact(t.arg); return (!v || v.n === 0n) ? null : F(v.d, v.n); }
    case '+': case '-': case '*': case '/': {
      const a = evalExact(t.a), b = evalExact(t.b);
      if (!a || !b) return null;
      if (t.op === '+') return addF(a, b);
      if (t.op === '-') return subF(a, b);
      if (t.op === '*') return mulF(a, b);
      return divF(a, b);
    }
    default: throw new Error('unknown op: ' + t.op);
  }
}
const isExact24 = (t) => { const f = evalExact(t); return !!f && f.n === 24n * f.d; };

// ── evaluator #2：独立浮点 + 严格 ===24（已知错误实现）────────
function evalFloat(t) {
  switch (t.op) {
    case 'num':   return Number(t.v.n) / Number(t.v.d);
    case 'one':   return 1;
    case 'zero':  return 0;
    case 'recip': { const v = evalFloat(t.arg); return v === 0 ? NaN : 1 / v; }
    case '+': return evalFloat(t.a) + evalFloat(t.b);
    case '-': return evalFloat(t.a) - evalFloat(t.b);
    case '*': return evalFloat(t.a) * evalFloat(t.b);
    case '/': { const d = evalFloat(t.b); return d === 0 ? NaN : evalFloat(t.a) / d; }
    default: throw new Error('unknown op: ' + t.op);
  }
}

// ── 核心度量 ─────────────────────────────────────────────────
// ★ 分母口径（2026-08-05 实测确定，见 output/t74-logs/denominator-probe.log）：
//   INPUT-06 的 50.0%/42.9%/37.5% 用的是【归约到不动点 + keySol 去重后
//   初级解与高级解的合计条数】，即 R-11④ 解数基准那一列的口径。
//   我最初误用「表达式字符串去重」(49/480/20 条) 得 16.3%/7.3%/25.0%，三组全不符；
//   换成本口径后三组精确命中 50.0%/42.9%/37.5%，旧哨兵 0.0% ⇒ 需求数字正确，是我口径错。
//   其它口径实测留档对照：
//     [1,4,6,8]  字符串去重 49 条→16.3% | raw 52 条→15.4% | 归约去重 4 条→50.0% ✅
//     [1,2,3,4]  字符串去重 480→7.3%    | raw 551→7.8%    | 归约去重 7 条→42.9% ✅
//     [3,3,8,8]  字符串去重 20→25.0%    | raw 92→30.4%    | 归约去重 8 条→37.5% ✅
//   ⇒ 教训（与 task-72 规则 20 同源）：比率类断言必须写明分母，
//     否则"漏解率 50%"这句话本身不可验证 —— 分母不同可得 15.4%~50.0% 四个值。
function measure(cards, candidate) {
  const trees = enumerateAll(cards);
  const prim = new Map(), adv = new Map();
  for (const t of trees) {
    if (!isExact24(t)) continue;
    const rr = reduceToFixpoint(t);
    const k = keySol(rr.node);
    if (countRecip(rr.node) > 0) { if (!adv.has(k)) adv.set(k, t); }
    else                         { if (!prim.has(k)) prim.set(k, t); }
  }
  const lost = [];
  for (const m of [prim, adv]) for (const [, t] of m) {
    let v; try { v = candidate(t); } catch { v = NaN; }
    if (v !== 24) lost.push(render(t));
  }
  const total = prim.size + adv.size;
  return { total, kept: total - lost.length, lost,
           pct: total ? lost.length / total * 100 : 0,
           primary: prim.size, advanced: adv.size };
}

const SENTINELS = [
  { cards: [1, 4, 6, 8], expectPct: 50.0, note: '漏解率最高' },
  { cards: [1, 2, 3, 4], expectPct: 42.9, note: '兼作 R4 分母排序防护' },
  { cards: [3, 3, 8, 8], expectPct: 37.5, note: '兼作 R5 同项抵消防护' },
];

let pass = 0, fail = 0;
const P = (c, m) => { c ? (pass++, console.log('  ✅ ' + m)) : (fail++, console.log('  🔴 FAIL ' + m)); };

console.log('='.repeat(78));
console.log('[t74-sentinel-efficacy] 新哨兵有效性自证');
console.log('  node=' + process.version + '  platform=' + process.platform);
console.log('='.repeat(78));

console.log('\n──── 规则17 反证A：换精确 evaluator，漏解率须 0%（证漏解源自浮点，非我逻辑 bug）────');
for (const s of SENTINELS) {
  const m = measure(s.cards, t => (isExact24(t) ? 24 : NaN));
  P(m.total > 0 && m.lost.length === 0,
    `[${s.cards}] 精确 evaluator：解总数=${m.total} 漏解=${m.lost.length} (${m.pct.toFixed(1)}%)，须 0%`);
}

console.log('\n──── 规则17 反证B：换恒错 evaluator(恒0)，漏解率须 100%（证本脚本真在比对）────');
for (const s of SENTINELS) {
  const m = measure(s.cards, () => 0);
  P(m.total > 0 && m.lost.length === m.total,
    `[${s.cards}] 恒错 evaluator：解总数=${m.total} 漏解=${m.lost.length} (${m.pct.toFixed(1)}%)，须 100%`);
}

console.log('\n──── 正题：浮点严格判等的实际漏解率 ────');
for (const s of SENTINELS) {
  const m = measure(s.cards, evalFloat);
  console.log(`\n  [${s.cards}] ${s.note}`);
  console.log(`    归约去重后：初级=${m.primary} 高级=${m.advanced} 合计=${m.total}（分母口径见文件头注释）`);
  console.log(`    浮点保住=${m.kept}  浮点漏掉=${m.lost.length}`);
  console.log(`    实测漏解率=${m.pct.toFixed(1)}%   INPUT-06 声称=${s.expectPct}%`);
  P(m.lost.length > 0, `[${s.cards}] 有效性：浮点漏解 ${m.lost.length} 条 > 0 ⇒ 哨兵抓得住浮点错误`);
  P(Math.abs(m.pct - s.expectPct) < 0.15,
    `[${s.cards}] 漏解率与 INPUT-06 声称一致：${m.pct.toFixed(1)}% vs ${s.expectPct}%`);
  if (m.lost.length) {
    console.log('    浮点会漏掉的解（前 5 条 = 旧哨兵放过的真问题）：');
    m.lost.slice(0, 5).forEach(x => console.log('      · ' + x));
  }
}

console.log('\n──── 对照：旧哨兵 [13,12,11,9]（经理称漏解率 0%，形同虚设）────');
{
  const m = measure([13, 12, 11, 9], evalFloat);
  console.log(`  [13,12,11,9] 初级=${m.primary} 高级=${m.advanced} 合计=${m.total} 浮点漏掉=${m.lost.length} 漏解率=${m.pct.toFixed(1)}%`);
  P(m.lost.length === 0, `旧哨兵漏解率确为 0% ⇒ 印证「形同虚设」，换哨兵有必要`);
  if (m.lost.length) console.log('    ⚠️ 非 0 ⇒ 经理该结论需修正，漏掉：' + m.lost.slice(0, 3).join(' / '));
}

console.log('\n' + '='.repeat(78));
console.log(`[t74-sentinel-efficacy] pass=${pass} fail=${fail}`);
console.log('='.repeat(78));
process.exit(fail ? 1 : 0);
