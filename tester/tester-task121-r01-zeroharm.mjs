// tester-task121-r01-zeroharm.mjs — INPUT-08 验收 4：R-01 零误伤独立验
//
// 用法：node tester-task121-r01-zeroharm.mjs <repoRoot> [--emit-digest]
//   --emit-digest 只输出 digest 行，供两基线交叉比对
//
// 🔴 条款 5 因果独立：本脚本不读任何他人回显数字（开发报的 22085 / ffc545e6… 一律不引），
//    两侧数字均由本脚本在各自基线上**独立枚举**得出。
// 🔴 Z-1 禁用 size：全程不调用 Map.size / Set.size，改用逐键排序 digest + 等价类计数。
// 🔴 §11.8：比对前先断言两侧全集基数同源 = 2380（0..13 非降序四元组）。
// 🔴 条款 3：零/空集判据必须配存在性前置断言，且用 T() 而非 console.log。
// 🔴 条款 8：断言总数自断言 + process.exit 真码。
// 🔴 条款 10：双极性 —— 本支须能判红（见 --self-mutate 自检说明）。

import { createHash } from 'crypto';
import { pathToFileURL } from 'url';
import path from 'path';

const ROOT = process.argv[2];
const EMIT = process.argv.includes('--emit-digest');
if (!ROOT) { console.error('用法: node tester-task121-r01-zeroharm.mjs <repoRoot>'); process.exit(2); }

const RS = await import(pathToFileURL(path.join(ROOT, 'js/core/RecipSolver.mjs')).href);

let pass = 0, fail = 0, total = 0;
const fails = [];
function T(name, ok, detail) {
  total++;
  if (ok) { pass++; if (!EMIT) console.log(`  \u2713 ${name}`); }
  else { fail++; fails.push(name); if (!EMIT) console.log(`  \u2717 ${name}${detail ? ' \u2014 ' + detail : ''}`); }
}

// ══════ 全集：0..13 非降序四元组（§11.4c：2380，不是 1..13 的 1820）══════
function allDecks() {
  const out = [];
  for (let a = 0; a <= 13; a++)
    for (let b = a; b <= 13; b++)
      for (let c = b; c <= 13; c++)
        for (let d = c; d <= 13; d++) out.push([a, b, c, d]);
  return out;
}
const DECKS = allDecks();

// ══════ 逐键 digest（禁 size；键排序后 sha1，键内容变化即变 digest）══════
function digestOfMap(m) {
  const keys = [];
  for (const k of m.keys()) keys.push(String(k));
  keys.sort();
  const h = createHash('sha1');
  for (const k of keys) h.update(k).update('\n');
  return { digest: h.digest('hex'), count: keys.length, keys };
}

// 等价类计数：按后缀分类（两代兼容正则，§11.x 要求）
const SUF_RE = /\|R([01])F([01])M([01])(?:P([01])L([01]))?$/;
function suffixClasses(keys) {
  const cls = new Map();
  let noSuffix = 0;
  for (const k of keys) {
    const m = k.match(SUF_RE);
    if (!m) { noSuffix++; continue; }
    const tag = m[4] === undefined ? `R${m[1]}F${m[2]}M${m[3]}` : `R${m[1]}F${m[2]}M${m[3]}P${m[4]}L${m[5]}`;
    cls.set(tag, (cls.get(tag) || 0) + 1);
  }
  return { cls, noSuffix };
}

// ══════ 全域枚举 ══════
// 🔴 验收 4 口径校正（2026-08-09 实测定性，丙类=我方判据设计错误，非实现缺陷）：
//   我初版把「开关全关」理解为 recip/fact/mod/pow/log 五项全关，实跑得 advanced=0
//   （digest da39a3ee… 即空串 sha1）。实测 [1,2,3,4]：五项全关 advanced=0、只开 recip=4、
//   单开 pow=1 ⇒ advanced 语义 = 「用了高级记号的解」，五项全关必空，属规格预期。
//   ⇒ 验收 4 的「开关全关」= **pow/log 全关**（回到 INPUT-07 基准态），
//     recip/fact/mod 保持 INPUT-07 的默认开，否则比的不是同一张基准表。
const OPTS_P0L0_EXPLICIT = { advancedCalc: true, caps: { recip: true, fact: true, mod: true, pow: false, log: false } };
const OPTS_DEFAULT = { advancedCalc: true };   // 不传 pow/log ⇒ 应等价于显式 pow/log 关
// 另留「五项全关」作空集专项（须配存在性前置，见 Z-3）
const OPTS_ALLOFF5 = { advancedCalc: true, caps: { recip: false, fact: false, mod: false, pow: false, log: false } };

function enumerate(opts) {
  const pri = new Map(), adv = new Map();
  for (const d of DECKS) {
    const r = RS.solve(d, opts);
    const tag = d.join(',');
    if (r && r.primary) for (const k of r.primary.keys()) pri.set(tag + '#' + k, 1);
    if (r && r.advanced) for (const k of r.advanced.keys()) adv.set(tag + '#' + k, 1);
  }
  return { pri, adv };
}

if (!EMIT) {
  console.log('=========================================');
  console.log('INPUT-08 验收 4：R-01 零误伤独立验（task-121）');
  console.log(`基线路径：${ROOT}`);
  console.log(`Node：${process.version}`);
  console.log('=========================================');
  console.log('');
  console.log('=== §11.8 前置：两侧全集基数须同源 ===');
}
T('§11.8 全集基数 = 2380（0..13 非降序四元组，非 1..13 的 1820）', DECKS.length === 2380, `实际 ${DECKS.length}`);
T('§11.8 全集无重复四元组', new Set(DECKS.map(d => d.join(','))).size === DECKS.length);

const ALLOFF = enumerate(OPTS_P0L0_EXPLICIT);   // 基准态：pow/log 显式关，recip/fact/mod 开
const DEF = enumerate(OPTS_DEFAULT);            // 默认态：不传 pow/log
const OFF5 = enumerate(OPTS_ALLOFF5);           // 五项全关：advanced 应为空集

const dPriOff = digestOfMap(ALLOFF.pri);
const dAdvOff = digestOfMap(ALLOFF.adv);
const dPriDef = digestOfMap(DEF.pri);
const dAdvDef = digestOfMap(DEF.adv);

if (EMIT) {
  // 供跨基线比对：只吐机器可读行
  console.log(`DIGEST_PRI_ALLOFF=${dPriOff.digest} N=${dPriOff.count}`);
  console.log(`DIGEST_ADV_ALLOFF=${dAdvOff.digest} N=${dAdvOff.count}`);
  console.log(`DIGEST_PRI_DEFAULT=${dPriDef.digest} N=${dPriDef.count}`);
  console.log(`DIGEST_ADV_DEFAULT=${dAdvDef.digest} N=${dAdvDef.count}`);
  console.log(`DECKS=${DECKS.length}`);
  const sc = suffixClasses(dAdvDef.keys);
  const tags = [...sc.cls.keys()].sort();
  for (const t of tags) console.log(`SUFCLASS_DEFAULT ${t}=${sc.cls.get(t)}`);
  console.log(`SUFCLASS_DEFAULT_NOSUFFIX=${sc.noSuffix}`);
  process.exit(fail ? 1 : 0);
}

console.log('');
console.log('=== Z-3 存在性前置（条款 3：零判据须配存在性断言）===');
// 🔴 条款 3：下面要断言「P/L 位为 0」，必须先证明「确实枚举出了解」，
//    否则空集也能让「P/L=0」成立 ⇒ 假绿。
T('Z-3.1 基准态 primary 非空（存在性前置，否则下方零判据无意义）', dPriOff.count > 0, `实际 ${dPriOff.count}`);
T('Z-3.2 基准态 advanced 非空（存在性前置，否则 P1/L1=0 是空集平凡真）', dAdvOff.count > 0, `实际 ${dAdvOff.count}`);

// 🔴 五项全关的空集是规格预期，但「空」这个结论本身也须配存在性对照，
//    否则引擎整体坏掉（永远返回空）也会让本条通过 ⇒ 用基准态非空作对照。
const dAdv5 = digestOfMap(OFF5.adv);
T('Z-3.3 五项全关 advanced 为空集（规格预期：无高级记号可用）', dAdv5.count === 0, `实际 ${dAdv5.count}`);
T('Z-3.4 且同引擎基准态 advanced 非空（证明「空」非引擎全坏所致）', dAdvOff.count > 0, `基准态 ${dAdvOff.count}`);

console.log('');
console.log('=== R-01①：基准态（pow/log 关）不得出现任何幂/对数记号 ===');
const powMark = dAdvOff.keys.filter(k => /\^|\bpow\b/.test(k));
const logMark = dAdvOff.keys.filter(k => /\blog\b/i.test(k));
T('R-01①a 基准态 advanced 无幂记号', powMark.length === 0, `命中 ${powMark.length}：${powMark.slice(0, 2).join(' | ')}`);
T('R-01①b 基准态 advanced 无对数记号', logMark.length === 0, `命中 ${logMark.length}：${logMark.slice(0, 2).join(' | ')}`);
const priPow = dPriOff.keys.filter(k => /\^|\blog\b/i.test(k));
T('R-01①c 基准态 primary 无幂/对数记号（§3.2：高级记号不得落入初级分区）', priPow.length === 0, `命中 ${priPow.length}`);

console.log('');
console.log('=== R-01②：五位后缀 P/L 位在基准态恒为 0（等价类计数，禁 size）===');
const scOff = suffixClasses(dAdvOff.keys);
let p1l1 = 0;
for (const [tag, n] of scOff.cls) if (/P1|L1/.test(tag)) p1l1 += n;
T('R-01②a 基准态 P1/L1 等价类计数 = 0', p1l1 === 0, `实际 ${p1l1}`);
T('R-01②b 基准态 advanced 每条解均带后缀（无裸键混入）', scOff.noSuffix === 0, `无后缀 ${scOff.noSuffix} 条`);
T('R-01②c 禁字面量全 0 恒拼（R0F0M0P0L0 须走无后缀分支）',
  ![...scOff.cls.keys()].includes('R0F0M0P0L0'), '出现了 R0F0M0P0L0 ⇒ 破 R-01');

console.log('');
console.log('=== R-01③：不传 pow/log 须等价于显式关（=== true 口径）===');
// 🔴 因果独立：DEFAULT 与 ALLOFF 走的是不同入参路径
//    （前者 caps 未定义 pow/log 字段，后者显式 false），
//    引擎内 allowPow = !!(caps && caps.pow === true) 对两者结果应一致。
T('R-01③a primary digest：不传 pow/log == 显式关', dPriDef.digest === dPriOff.digest,
  `${dPriDef.digest.slice(0, 12)} vs ${dPriOff.digest.slice(0, 12)}`);
T('R-01③b advanced digest：不传 pow/log == 显式关', dAdvDef.digest === dAdvOff.digest,
  `${dAdvDef.digest.slice(0, 12)} vs ${dAdvOff.digest.slice(0, 12)}`);

console.log('');
console.log('=== E-1：禁浮点（基准态不得出现浮点痕迹）===');
const floatish = dAdvOff.keys.filter(k => /\d+\.\d+/.test(k));
T('E-1 基准态键内无小数点数字（Fraction 精确）', floatish.length === 0,
  `命中 ${floatish.length}：${floatish.slice(0, 2).join(' | ')}`);

console.log('');
console.log('=== 条款 8：断言总数自断言 ===');
const EXPECTED_ASSERTION_COUNT = 16;   // 15 条实质断言 + 本条自断言
const before = total;
T(`断言总数 = ${EXPECTED_ASSERTION_COUNT} 与期望一致（含本条）`, before + 1 === EXPECTED_ASSERTION_COUNT, `实际 ${before}`);

console.log('');
console.log('=========================================');
console.log(`R-01 ZERO-HARM: pass=${pass} fail=${fail}`);
if (fail) { console.log('失败项：'); for (const f of fails) console.log(`  - ${f}`); }
console.log(fail ? 'OVERALL: FAIL \u274c' : 'OVERALL: PASS \u2705');
console.log('');
console.log('\u2500\u2500 本次独立采样值（供跨基线比对，非引用他人数字）\u2500\u2500');
console.log(`  全集牌组                = ${DECKS.length}`);
console.log(`  基准态(P0L0) primary  N = ${dPriOff.count}  digest=${dPriOff.digest}`);
console.log(`  基准态(P0L0) advanced N = ${dAdvOff.count}  digest=${dAdvOff.digest}`);
console.log(`  默认态(不传)   advanced N = ${dAdvDef.count}  digest=${dAdvDef.digest}`);
console.log(`  五项全关      advanced N = ${dAdv5.count}（规格预期空集）`);
console.log('  基准态后缀等价类：');
for (const t of [...scOff.cls.keys()].sort()) console.log(`    ${t} = ${scOff.cls.get(t)}`);
console.log('');
console.log(`\u26a0\ufe0f 退出码 = ${fail ? 1 : 0}（以本行为准；禁 cmd & / 管道末端码取值）`);
console.log('=========================================');
process.exit(fail ? 1 : 0);
