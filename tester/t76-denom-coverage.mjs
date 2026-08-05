// t76-denom-coverage.mjs — R4 分母排序 覆盖度度量（task-76）
// Node: 见运行时打印的 [env] 行（无版本记录视同未做验证）
// 依据：INPUT-COMMON.md + INPUT-06.md R-04.2 / R-11④ · task-76 任务书
//
// ══════════════════════════════════════════════════════════════════════════
// 【度量口径定义】—— 原脚本丢失的真正教训是口径无处可查，故此处写死
// ══════════════════════════════════════════════════════════════════════════
//
// 被度量对象（M）：RecipSolver.rebuildChain 中【分母表 D 的排序归一】这一条规则。
//   源码锚点：`const D = denList.filter(...).sort(...)`
//   作用：使 (1/3)/4 与 (1/4)/3 归并为同一 keySol。若去掉 .sort，两式分裂成 2 条解。
//
// 一个「待覆盖项」= 基准表中的一个牌组（deck）。
//   基准表 = INPUT-06.md R-11④ 解数基准的 14 组牌组（唯一权威期望值来源）。
//   总数 N = 14。
//
// 一个待覆盖项「已覆盖」的判定（严格，二值，无中间态）：
//   对该牌组，比较两次 solve 的 (初级解数, 高级解数) 双列：
//     · baseline  = 原实现（分母表排序生效）
//     · mutant    = 变异体（分母表排序被移除，其余一字不改）
//   若 baseline ≠ mutant（任一列不同）⇒ 该牌组能检出 M 被破坏 ⇒ 【已覆盖】
//   若 baseline == mutant                ⇒ 该牌组对 M 零区分度   ⇒ 【未覆盖】
//
// 覆盖度 = 已覆盖牌组数 / 14。
//
// 为什么用「双列」而不是单列或总数：R-11④ 期望值本身是双列（如 [1,2,3,4]=3/4）。
//   只比总数会漏掉「初级+1、高级-1」的抵消型偏移。
//
// ── 本脚本不做什么（避免口径漂移）──
//   · 不度量「分子表排序」（那是另一条规则，task-69 实测 4/14）
//   · 不把「变异体崩溃/超时」算作已覆盖（那是崩溃，不是解数偏移检出）
//   · 不放宽为「解数总和不同即覆盖」
//
// ══════════════════════════════════════════════════════════════════════════
// 【硬约束遵守说明】
//   · 禁 solver 自证：变异体不是「让 solver 自己说自己对」，而是【破坏 solver
//     再看基准表能否发现】—— 判据是基准表（需求文档数字），不是 solver 自身输出。
//     解数期望值一律取自 INPUT-06.md R-11④，脚本内不自行推导期望值。
//   · 全程 Fraction：本脚本不做任何数值判等，只比较整数计数（Map.size），
//     不引入浮点。被测 RecipSolver 自身的 Fraction 判等由 verify-input06-* 门禁负责。
//   · 产品代码零改动：变异体通过【读源码字符串→内存替换→写临时目录】实现，
//     绝不写回 js/ 下任何文件。运行结束会打印 js/ 的 git 状态供核验。
// ══════════════════════════════════════════════════════════════════════════

import fs from 'fs';
import path from 'path';
import os from 'os';

console.log(`[env] node=${process.version} platform=${process.platform}/${process.arch} pid=${process.pid}`);
console.log(`[env] cwd=${process.cwd()}`);
console.log(`[t76] R4 分母排序覆盖度度量  @ ${new Date().toISOString()}`);

// ── 基准表：INPUT-06.md R-11④ 唯一权威期望值（初级/高级双列）──
const BASELINE_TABLE = [
  { deck: [1, 2, 3, 4], exp: [3, 4] },
  { deck: [2, 3, 4, 6], exp: [10, 10] },
  { deck: [1, 3, 4, 6], exp: [1, 4] },
  { deck: [1, 5, 5, 5], exp: [1, 1] },
  { deck: [3, 3, 8, 8], exp: [1, 7] },
  { deck: [1, 2, 5, 10], exp: [2, 1] },
  { deck: [1, 1, 3, 8], exp: [1, 0] },
  { deck: [1, 4, 6, 8], exp: [3, 1] },
  { deck: [2, 4, 5, 8], exp: [7, 3] },
  { deck: [5, 5, 5, 5], exp: [1, 0] },
  { deck: [1, 1, 2, 9], exp: [1, 0] },
  { deck: [3, 3, 7, 7], exp: [1, 0] },
  { deck: [4, 4, 7, 7], exp: [1, 0] },
  { deck: [3, 3, 3, 5], exp: [1, 0] },
];
const N_TOTAL = BASELINE_TABLE.length;

// ── 定位产品源码（只读）──
const SRC_REL = 'js/core/RecipSolver.mjs';
const SRC_ABS = path.resolve(process.cwd(), SRC_REL);
if (!fs.existsSync(SRC_ABS)) {
  console.log(`[FATAL] 存在性先于一致性：找不到被度量对象源文件 ${SRC_ABS}`);
  process.exit(2);
}
const SRC = fs.readFileSync(SRC_ABS, 'utf8');
console.log(`[src] ${SRC_REL} bytes=${SRC.length}`);

// ── 存在性先于一致性：先证「分母表排序」这段代码真的存在 ──
// 判据串用 ASCII（任务书要求），不用中文注释做锚点
const ANCHOR_DEN = 'const D = denList.filter';
const ANCHOR_NUM = 'const N = numList.filter';
const hasDen = SRC.includes(ANCHOR_DEN);
const hasNum = SRC.includes(ANCHOR_NUM);
console.log(`[exist] anchor "${ANCHOR_DEN}" present=${hasDen}`);
console.log(`[exist] anchor "${ANCHOR_NUM}" present=${hasNum}`);
if (!hasDen) {
  console.log('[FATAL] 被度量对象不存在：分母表 filter/sort 锚点未命中。');
  console.log('        存在性先于一致性 —— 对象不存在时任何覆盖度数字都是假绿。');
  process.exit(2);
}
// 精确抽出分母表那一整条语句（filter 到该语句结尾的分号）
const denStart = SRC.indexOf(ANCHOR_DEN);
const denEnd = SRC.indexOf(';', denStart);
const DEN_STMT = SRC.slice(denStart, denEnd + 1);
console.log('[exist] 分母表语句原文（%d bytes）:', DEN_STMT.length);
console.log('        ' + DEN_STMT.replace(/\s+/g, ' '));
const denHasSort = /\.sort\s*\(/.test(DEN_STMT);
console.log(`[exist] 该语句含 .sort( : ${denHasSort}`);
if (!denHasSort) {
  console.log('[FATAL] 分母表语句中不含 .sort( —— 被度量规则已不在源码中，度量无意义。');
  process.exit(2);
}

// ── 构造变异体：仅移除分母表的 .sort(...)，其余一字不改 ──
// 做法：把 DEN_STMT 中 ".sort(...)" 整段删掉（保留 filter 结果）
function stripSort(stmt) {
  const i = stmt.indexOf('.sort(');
  if (i < 0) return null;
  // 从 '.sort(' 起做括号配平，找到匹配的右括号
  let depth = 0, j = i + '.sort'.length;
  for (; j < stmt.length; j++) {
    if (stmt[j] === '(') depth++;
    else if (stmt[j] === ')') { depth--; if (depth === 0) { j++; break; } }
  }
  if (depth !== 0) return null;
  return stmt.slice(0, i) + stmt.slice(j);
}
const DEN_STMT_MUT = stripSort(DEN_STMT);
if (!DEN_STMT_MUT) { console.log('[FATAL] 括号配平失败，无法构造变异体'); process.exit(2); }
const SRC_MUT = SRC.slice(0, denStart) + DEN_STMT_MUT + SRC.slice(denEnd + 1);

// ── 注入生效自证（任务书 §2：先证注入真生效）──
console.log('\n' + '='.repeat(74));
console.log('【注入生效自证】—— 先证变异真的落地，再看度量结果（避免拿没生效的注入下结论）');
console.log('='.repeat(74));
console.log(`  baseline bytes = ${SRC.length}`);
console.log(`  mutant   bytes = ${SRC_MUT.length}`);
console.log(`  delta          = ${SRC_MUT.length - SRC.length} (应为负，即删掉了 .sort 段)`);
console.log(`  baseline 分母语句: ${DEN_STMT.replace(/\s+/g, ' ')}`);
console.log(`  mutant   分母语句: ${DEN_STMT_MUT.replace(/\s+/g, ' ')}`);
const injOk1 = SRC_MUT.length < SRC.length;
const injOk2 = !/\.sort\s*\(/.test(DEN_STMT_MUT);
const injOk3 = /\.sort\s*\(/.test(SRC_MUT.slice(SRC_MUT.indexOf(ANCHOR_NUM), SRC_MUT.indexOf(ANCHOR_NUM) + 300));
console.log(`  自证1 mutant 字节数更小            : ${injOk1 ? 'OK' : 'FAIL'}`);
console.log(`  自证2 mutant 分母语句已无 .sort(    : ${injOk2 ? 'OK' : 'FAIL'}`);
console.log(`  自证3 mutant 分子语句仍保留 .sort(  : ${injOk3 ? 'OK' : 'FAIL'}  (证明只动了分母，没连带动分子)`);
if (!(injOk1 && injOk2 && injOk3)) {
  console.log('[FATAL] 注入未真正生效，拒绝出覆盖度数字（防「没生效的注入 → 误判 0 覆盖」）');
  process.exit(2);
}

// ── 写临时目录（绝不写回 js/）──
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 't76-denom-'));
const F_BASE = path.join(TMP, 'RecipSolver.baseline.mjs');
const F_MUT = path.join(TMP, 'RecipSolver.mutant.mjs');
fs.writeFileSync(F_BASE, SRC);
fs.writeFileSync(F_MUT, SRC_MUT);
console.log(`\n[tmp] 变异体写入临时目录（产品代码零改动）: ${TMP}`);

const base = await import('file://' + F_BASE);
const mut = await import('file://' + F_MUT);

// ── 度量 ──
function measure(mod, deck) {
  const r = mod.solve(deck);
  return [r.primary.size, r.advanced.size];
}

console.log('\n' + '='.repeat(74));
console.log('【度量】逐牌组比对 baseline vs mutant（双列：初级/高级）');
console.log('='.repeat(74));
console.log('deck            R-11④期望 | baseline | mutant   | 检出M被破坏?');
console.log('-'.repeat(74));

let covered = 0;
const rows = [];
let baseMismatch = 0;
for (const { deck, exp } of BASELINE_TABLE) {
  const b = measure(base, deck);
  const m = measure(mut, deck);
  const detect = !(b[0] === m[0] && b[1] === m[1]);
  if (detect) covered++;
  // 附带核验：baseline 必须与 R-11④ 期望一致（否则度量前提就不成立）
  const expOk = b[0] === exp[0] && b[1] === exp[1];
  if (!expOk) baseMismatch++;
  rows.push({ deck, exp, b, m, detect, expOk });
  console.log(
    `${JSON.stringify(deck).padEnd(15)} ${(exp[0] + '/' + exp[1]).padStart(9)} | ` +
    `${(b[0] + '/' + b[1]).padStart(8)} | ${(m[0] + '/' + m[1]).padStart(8)} | ` +
    `${detect ? 'YES 已覆盖' : 'no  未覆盖'}${expOk ? '' : '   [!] baseline≠期望'}`
  );
}

const pct = (covered / N_TOTAL * 100).toFixed(1);
console.log('-'.repeat(74));
console.log(`\n【当前覆盖度】${covered}/${N_TOTAL} = ${pct}%`);
console.log('已覆盖牌组（能检出分母排序被移除）：');
for (const r of rows) if (r.detect) console.log(`   · ${JSON.stringify(r.deck)}  baseline ${r.b[0]}/${r.b[1]} → mutant ${r.m[0]}/${r.m[1]}`);
console.log('未覆盖牌组（对该规则零区分度）：');
for (const r of rows) if (!r.detect) console.log(`   · ${JSON.stringify(r.deck)}`);

console.log(`\n【度量前提核验】baseline 与 R-11④ 期望不一致的牌组数 = ${baseMismatch}`);
if (baseMismatch > 0) console.log('  [!] 前提不成立时覆盖度数字不可引用 —— 请先修 solver 或修期望值');

// ── 双极性自验：还原判绿 ──
console.log('\n' + '='.repeat(74));
console.log('【双极性自验 · 还原极】把 baseline 源码原样再跑一遍，须与 baseline 全等（0 检出）');
console.log('='.repeat(74));
const F_RESTORE = path.join(TMP, 'RecipSolver.restore.mjs');
fs.writeFileSync(F_RESTORE, SRC);
const restore = await import('file://' + F_RESTORE);
let restoreDiff = 0;
for (const { deck } of BASELINE_TABLE) {
  const b = measure(base, deck), r = measure(restore, deck);
  if (!(b[0] === r[0] && b[1] === r[1])) { restoreDiff++; console.log(`   XX ${JSON.stringify(deck)} ${b} vs ${r}`); }
}
console.log(`  还原极检出数 = ${restoreDiff}（期望 0）  ${restoreDiff === 0 ? 'OK 判绿' : 'FAIL'}`);

// ── 点名能力自验：注入极须点名到具体牌组 ──
console.log('\n【双极性自验 · 注入极】覆盖度须下降且点名到具体牌组');
console.log(`  注入后检出牌组数 = ${covered}，点名清单：${rows.filter(r => r.detect).map(r => JSON.stringify(r.deck)).join(' ')}`);
const polarityOk = restoreDiff === 0 && covered > 0;
console.log(`  双极性判定：${polarityOk ? 'OK（注入判红并点名 / 还原判绿）' : 'FAIL'}`);

// ══════════════════════════════════════════════════════════════════════════
// 【层 2 度量】单元判据层覆盖度
// ══════════════════════════════════════════════════════════════════════════
// 为什么必须分两层（这是本次度量最重要的发现）：
//   task-76 任务书问「补判据后覆盖度 1/14 → y」。实测 y 仍 = 1/14。
//   原因不是没改善，而是【问错了维度】：
//     · 层 1（基准表覆盖度）只依赖 (a) 当前 solver (b) INPUT-06.md R-11④ 14 组表。
//       task-69 补的是**单元级 keySol 断言**，既不改 solver 也不改基准表，
//       ⇒ 层 1 覆盖度在数学上不可能变化，恒为 1/14。
//     · 真正的改善在层 2：分母排序的防护从「仅 [2,3,4,6] 这一个牌组」
//       变为「牌组 + 独立单元断言」双防护。层 2 补判据前 0，补判据后 1。
//   ⇒ 「1/14 → y/14」这个提法本身不成立，不是数字没拿到。
console.log('\n' + '='.repeat(74));
console.log('【层 2 度量】单元判据层：t69-dedup-verify.mjs 是否含分母排序独立断言');
console.log('='.repeat(74));

// 口径：层 2 一个「待覆盖项」= 一条归约规则；「已覆盖」= 门禁脚本中存在
//   针对该规则的独立 keySol 等价断言，且该断言在规则被破坏时会判红。
const GATE_CANDIDATES = [
  'tester/render-smoke/t69-dedup-verify.mjs',   // 实测入库位置（2026-08-05 git ls-files 确认）
  'tools/verify/t69-dedup-verify.mjs',
  'tester/t69-dedup-verify.mjs',
  't69-dedup-verify.mjs',
];
let gatePath = null;
for (const p of GATE_CANDIDATES) {
  const abs = path.resolve(process.cwd(), p);
  if (fs.existsSync(abs)) { gatePath = abs; break; }
}
let layer2 = 0, layer2Note = '';
if (!gatePath) {
  layer2Note = '门禁脚本未在库中找到（候选：' + GATE_CANDIDATES.join(' / ') + '）⇒ 层 2 = 0，据实报';
  console.log('  [!] ' + layer2Note);
} else {
  const G = fs.readFileSync(gatePath, 'utf8');
  console.log(`  门禁脚本: ${path.relative(process.cwd(), gatePath)}  bytes=${G.length}`);
  // ASCII 判据串（任务书要求：判据串用 ASCII 不用中文）
  const A1 = "B('/', R(3), N(4))";
  const A2 = "B('/', R(4), N(3))";
  const h1 = G.includes(A1), h2 = G.includes(A2);
  console.log(`  锚点 "${A1}" present=${h1}`);
  console.log(`  锚点 "${A2}" present=${h2}`);
  if (h1 && h2) {
    layer2 = 1;
    // 存在性先于一致性：再证该断言在 mutant 下真会判红
    const kB = base.keySol(base.reduceToFixpoint(
      { op: '/', a: base.recipLeaf(3, 0), b: base.numLeaf(4, 1) }).node);
    const kB2 = base.keySol(base.reduceToFixpoint(
      { op: '/', a: base.recipLeaf(4, 0), b: base.numLeaf(3, 1) }).node);
    const kM = mut.keySol(mut.reduceToFixpoint(
      { op: '/', a: mut.recipLeaf(3, 0), b: mut.numLeaf(4, 1) }).node);
    const kM2 = mut.keySol(mut.reduceToFixpoint(
      { op: '/', a: mut.recipLeaf(4, 0), b: mut.numLeaf(3, 1) }).node);
    console.log(`  baseline: keySol((1/3)/4)="${kB}"  keySol((1/4)/3)="${kB2}"  equal=${kB === kB2}`);
    console.log(`  mutant  : keySol((1/3)/4)="${kM}"  keySol((1/4)/3)="${kM2}"  equal=${kM === kM2}`);
    const detect2 = (kB === kB2) && (kM !== kM2);
    console.log(`  该单元断言双极性：baseline 判绿 && mutant 判红 = ${detect2 ? 'OK 真能抓错' : 'FAIL 抓不住'}`);
    if (!detect2) { layer2 = 0; layer2Note = '断言存在但 mutant 下不判红 ⇒ 哑弹，不计入覆盖'; console.log('  [!] ' + layer2Note); }
  } else {
    layer2Note = '门禁脚本中未找到分母排序断言锚点 ⇒ 层 2 = 0';
    console.log('  [!] ' + layer2Note);
  }
}
console.log(`\n  层 2 覆盖：${layer2}/1（分母排序规则的独立单元断言）`);

// ── 清理 + 产品代码零改动核验 ──
fs.rmSync(TMP, { recursive: true, force: true });
console.log(`\n[tmp] 已清理 ${TMP}`);
console.log(`[safety] 本脚本从未写入 ${SRC_REL}；请以 git status/diff 为最终凭据`);

console.log('\n' + '='.repeat(74));
console.log(`RESULT L1coverage=${covered}/${N_TOTAL} (${pct}%)  L2coverage=${layer2}/1  polarity=${polarityOk ? 'OK' : 'FAIL'}  baselineMismatch=${baseMismatch}`);
console.log('【补判据前基线是否可重建】可重建，且值恒为 1/14 —— 见层 2 段注释：');
console.log('  层 1 只依赖 solver + R-11④ 表，补单元判据不改这两者 ⇒ 层 1 数学上不可能变化。');
console.log('  真正的前后差异在层 2：0/1 → ' + layer2 + '/1。未编造任何「前值」。');
console.log('='.repeat(74));

// 退出码：度量本身成功即 0；双极性失败或前提不成立 → 1
process.exit(polarityOk && baseMismatch === 0 ? 0 : 1);
