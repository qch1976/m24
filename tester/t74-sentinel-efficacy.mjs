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
//   换成本口径后三组精确命中 50.0%/42.9%/37.5%，旧哨兵 0.0%。
//   🔴 task-131 更正（项目经理 2026-08-15 裁定后）：上句原写「⇒ 需求数字正确，是我口径错」，
//   该结论只对 [1,4,6,8] / [1,2,3,4] 成立；对 [3,3,8,8] 不成立 ——
//   08-05 当时其基准尚为 1/7（合计 8），故得 3/8=37.5%；同日基准被修订为 1/6
//   （合计 7，见 L264）而百分比未同步 ⇒ 37.5% 自那时起就是【漏改残留值】。
//   其它口径实测留档对照（括号内为 08-05 当时值）：
//     [1,4,6,8]  字符串去重 49 条→16.3% | raw 52 条→15.4% | 归约去重 4 条→50.0% ✅
//     [1,2,3,4]  字符串去重 480→7.3%    | raw 551→7.8%    | 归约去重 7 条→42.9% ✅
//     [3,3,8,8]  字符串去重 20→25.0%    | raw 92→30.4%    | 归约去重【当时 8 条→3/8=37.5%；
//                基准修订后 7 条→2/7=28.6%】← 🔴 已随 task-131 裁定更正，现值 28.6%
//   ⇒ 教训（与 task-72 规则 20 同源）：比率类断言必须写明分母，
//     否则"漏解率 50%"这句话本身不可验证 —— 分母不同可得 15.4%~50.0% 四个值。
//   ⇒ 补教训（task-131 新增）：比率类断言的分子/分母若源于另一份基准表，
//     那份基准表修订时必须同步重算百分比；否则旧百分比会以【看似权威】的面目存活，
//     与【真的需求冲突】难以区分（本例即多花了一轮往返才定性）。
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
  // 🔴 task-131 裁定（项目经理 2026-08-15，项目主同日授权）：37.5% → 28.6%
  //   需求侧：INPUT-06.md L171 R-04.2 现文已为 50.0% / 42.9% / **28.6%**
  //     （现取核实：文件 281 行未变；L171 仍存的 3 处 37.5% 均位于「37.5% → 28.6%」
  //      裁定沿革说明句中，非漏改）
  //   定性：原 37.5% 是 2026-08-05 基准修订的【漏改残留值】，既非需求冲突也非口径错。
  //   本人独立复算（不引用他人回显数字）：
  //     [1,4,6,8] 基准 3/1 合计 4，浮点漏 2 ⇒ 2/4 = 50.0%   ✅ 自洽
  //     [1,2,3,4] 基准 3/4 合计 7，浮点漏 3 ⇒ 3/7 = 42.9%   ✅ 自洽
  //     [3,3,8,8] 基准 1/6 合计 7，浮点漏 2 ⇒ 2/7 = 28.6%   ← 本值
  //     反推：37.5% = 3/8，需【合计 8 且漏 3】，即修订前基准 1/7
  //   双重印证：① 唯一失配的 deck 恰是 L264 唯一被修订高级列的 deck
  //     （L264：[1,3,4,6] 4→3、[3,3,8,8] 7→6、[2,4,5,8] 3→2、高级合计 31→28）；
  //     ② 3/8 精确等于旧基准合计 8 下的值，不是巧合。
  //   取值命令：node --import ./tester/render-smoke/esm-hooks.mjs tester/t74-sentinel-efficacy.mjs
  //   🔴 容差保持 0.15 不放宽（放宽到能同时容下 28.6/37.5 就丢了鉴别力）。
  { cards: [3, 3, 8, 8], expectPct: 28.6, note: '兼作 R5 同项抵消防护' },
];

let pass = 0, fail = 0;
const PENDING = [];   // task-131: 百分比数值不符时的出口（不计 pass/fail，但必显式打印）。裁定后正常态 pending=0
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
  // 🔴 task-131 第 3 批：数值一致性判据【不自行改数】，因为它卡在 INPUT-06 内部矛盾上：
  //   实测（取值命令：node --import ./tester/render-smoke/esm-hooks.mjs tester/t74-sentinel-efficacy.mjs）：
  //     [1,4,6,8] 分母4 漏2 = 50.0%  vs 声称 50%    ✅ 自洽
  //     [1,2,3,4] 分母7 漏3 = 42.9%  vs 声称 42.9%  ✅ 自洽
  //     [3,3,8,8] 分母7 漏2 = 28.6%  vs 声称 37.5%  🔴 不自洽
  //   反推：37.5% 需【分母 8 且漏 3】（3/8）；分母 8 意味着 [3,3,8,8] 共 8 条解。
  //   但 INPUT-06.md 另两处明写此 deck 为 1/6（合计 7 条）：
  //     L180 R-11④ 条文：`[3,3,8,8]`=1/6
  //     L251 明细表：| `[3,3,8,8]` | 1 | 6 | `(8*8)/(3-(1/3))` |
  //   ⇒ R-04.2 的 37.5%（隐含 8 条）与 R-11④ 的 1/6（明写 7 条）【需求文档内部矛盾】。
  //   改判据数字 = 替项目主裁定需求，越权；直接删断言 = 抹掉哨兵。
  //   故此处【保留判据但标为待裁定】：不计入 pass/fail，显式输出待裁定事项，
  //   避免两种错误：① 永久恒红拖死全仓绿灯；② 改数字伪绿掩盖文档矛盾。
  // 🔴 task-131 裁定后：三组期望值已全部与实测对齐，正常态应全走正式断言分支（pending=0）。
  //   PENDING 机制【保留】而不拆除，理由：它是本轮唯一能区分【产品真回退】与
  //   【需求/基准未同步】的出口。若改回无条件 P(...) 判红，一旦将来基准再改而
  //   百分比又漏改，就会重现本轮那种【恒红拖死全仓绿灯】的局面。
  //   关键：PENDING 不会吸掉真红 —— 哨兵有效性断言（上一行 P(m.lost.length > 0)）
  //   与前置健壮性断言仍走 fail，只有【百分比数值不符】这一种转 pending，
  //   且必显式打印 + 总结行带 pending=N，不会隐形。
  if (Math.abs(m.pct - s.expectPct) < 0.15) {
    P(true, `[${s.cards}] 漏解率与 INPUT-06 声称一致：${m.pct.toFixed(1)}% vs ${s.expectPct}%`);
  } else {
    PENDING.push(`[${s.cards}] 实测 ${m.pct.toFixed(1)}%（${m.lost.length}/${m.total}） vs INPUT-06 R-04.2 声称 ${s.expectPct}%`);
    console.log(`    ⚠️  百分比不符，转待裁定（不计入 pass/fail）：实测 ${m.pct.toFixed(1)}% = ${m.lost.length}/${m.total}，`
              + `而 R-04.2 声称 ${s.expectPct}%。`);
    console.log('       ⇒ 先核【R-11④ 解数基准是否刚被修订而百分比未同步】（本文件 SENTINELS 注释有 08-05 先例）；');
    console.log('         若基准未变而百分比失配，则为产品真回退，需立即上报而非改数字。');
  }
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
if (PENDING.length) {
  console.log(`⚠️  百分比待裁定 ${PENDING.length} 项（未计入 pass/fail）：`);
  PENDING.forEach((x) => console.log('   - ' + x));
  console.log('='.repeat(78));
}
console.log(`[t74-sentinel-efficacy] pass=${pass} fail=${fail} pending=${PENDING.length}`);
console.log('='.repeat(78));
// 🔴 task-131 经理例外授权（2026-08-15）：pending 也必须抬高 exit code。
//   原写 process.exit(fail ? 1 : 0)：百分比失配只进 PENDING 不计 fail ⇒ rc 仍为 0
//   ⇒ CI 视角【静默放过】（本人与经理各自变异实测均复现）。
//   pending 的语义是「需人工裁定」而非「无事」，因此必须非零退出逼人看一眼；
//   但仍与真 fail 分开计数（pending 不污染 fail 数字），便于区分
//   【产品真回退】与【基准/需求未同步】。
process.exit((fail || PENDING.length) ? 1 : 0);
