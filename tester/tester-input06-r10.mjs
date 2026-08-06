// tester-input06-r10.mjs — R-10 解集展示合理性独立采样（task-65）
// ① 每分区 ≤10 条 ② 「…等共 N 条」N = 归约去重后真实总数
// ③ 排序确定性可复现（同牌组两次运行展示完全一致）④ [1,2,3,4] 压力用例

import { solve, buildDisplay, sortSolutions, compareSolutions, countAdvSymbols, DISPLAY_LIMIT } from '../js/core/RecipSolver.mjs';
import { mkCounter, parseExpr, evalQ, is24, qs, verdictIndependent, msKey, usedCards } from './tester-input06-lib.mjs';

const { ck, done } = mkCounter('R-10');
console.log('tester-input06-r10.mjs  @ ' + new Date().toISOString());
console.log('DISPLAY_LIMIT = ' + DISPLAY_LIMIT);

const CASES = [[1, 2, 3, 4], [2, 3, 4, 6], [1, 3, 4, 6], [1, 1, 3, 8], [3, 3, 8, 8], [5, 5, 5, 5], [1, 4, 6, 8]];

// ============================================================
// ① 每分区 ≤10 条  +  ② N = 真实总数
// ============================================================
console.log('\n' + '='.repeat(70));
console.log('① 每分区 ≤10 条  ② counts = 去重后真实总数');
console.log('='.repeat(70));
for (const cards of CASES) {
  const res = solve(cards);
  const d = buildDisplay(res, DISPLAY_LIMIT);
  ck(`R-10① ${JSON.stringify(cards).padEnd(14)} primary 展示 ${d.primary.length} ≤ 10`, d.primary.length <= 10);
  ck(`R-10① ${JSON.stringify(cards).padEnd(14)} advanced 展示 ${d.advanced.length} ≤ 10`, d.advanced.length <= 10);
  ck(`R-10② ${JSON.stringify(cards).padEnd(14)} counts.primary=${d.counts.primary} = Map.size ${res.primary.size}`, d.counts.primary === res.primary.size);
  ck(`R-10② ${JSON.stringify(cards).padEnd(14)} counts.advanced=${d.counts.advanced} = Map.size ${res.advanced.size}`, d.counts.advanced === res.advanced.size);
  // 展示条数 = min(总数, 10)
  ck(`R-10① ${JSON.stringify(cards).padEnd(14)} primary 展示 = min(总数,10)`, d.primary.length === Math.min(res.primary.size, 10));
  ck(`R-10① ${JSON.stringify(cards).padEnd(14)} advanced 展示 = min(总数,10)`, d.advanced.length === Math.min(res.advanced.size, 10));
}

// ============================================================
// ③ 排序确定性：同牌组两次运行展示完全一致 + 排序规则逐级验证
// ============================================================
console.log('\n' + '='.repeat(70));
console.log('③ 排序确定性可复现');
console.log('='.repeat(70));
for (const cards of CASES) {
  const a = buildDisplay(solve(cards), DISPLAY_LIMIT);
  const b = buildDisplay(solve(cards), DISPLAY_LIMIT);
  ck(`R-10③ ${JSON.stringify(cards).padEnd(14)} 两次运行 primary 完全一致`, JSON.stringify(a.primary) === JSON.stringify(b.primary));
  ck(`R-10③ ${JSON.stringify(cards).padEnd(14)} 两次运行 advanced 完全一致`, JSON.stringify(a.advanced) === JSON.stringify(b.advanced));
  ck(`R-10③ ${JSON.stringify(cards).padEnd(14)} advancedTop 两次一致`, a.advancedTop === b.advancedTop, `${a.advancedTop}`);
  // 排序规则：① 长度升序 ② 高级符号数升序 ③ 字典序升序
  const chk = (arr, tag) => {
    for (let i = 1; i < arr.length; i++) {
      const p = arr[i - 1], q = arr[i];
      if (p.length !== q.length) { if (p.length > q.length) return `${tag} 长度倒序 @${i}: ${p} > ${q}`; continue; }
      const cp = countAdvSymbols(p), cq = countAdvSymbols(q);
      if (cp !== cq) { if (cp > cq) return `${tag} 高级符号数倒序 @${i}`; continue; }
      if (p > q) return `${tag} 字典序倒序 @${i}: ${p} > ${q}`;
    }
    return null;
  };
  const e1 = chk(a.primary, 'primary'), e2 = chk(a.advanced, 'advanced');
  ck(`R-10③ ${JSON.stringify(cards).padEnd(14)} primary 三级排序正确`, e1 === null, e1 || '');
  ck(`R-10③ ${JSON.stringify(cards).padEnd(14)} advanced 三级排序正确`, e2 === null, e2 || '');
}
// sortSolutions 不依赖输入顺序（Set/Map 遍历序无关）
{
  const res = solve([1, 2, 3, 4]);
  const arr = [...res.advanced.values()];
  const shuffled = arr.slice().reverse();
  ck('R-10③ sortSolutions 对逆序输入结果相同（不依赖遍历序）',
     JSON.stringify(sortSolutions(arr)) === JSON.stringify(sortSolutions(shuffled)));
  const arr2 = arr.slice();
  // 手动打乱（确定性 shuffle）
  let s = 42;
  for (let i = arr2.length - 1; i > 0; i--) { s = (s * 1103515245 + 12345) & 0x7fffffff; const j = s % (i + 1); [arr2[i], arr2[j]] = [arr2[j], arr2[i]]; }
  ck('R-10③ sortSolutions 对打乱输入结果相同',
     JSON.stringify(sortSolutions(arr)) === JSON.stringify(sortSolutions(arr2)));
  // compareSolutions 全序性（反对称）
  let asym = 0;
  for (let i = 0; i < Math.min(arr.length, 20); i++) for (let j = 0; j < Math.min(arr.length, 20); j++) {
    const c1 = compareSolutions(arr[i], arr[j]), c2 = compareSolutions(arr[j], arr[i]);
    if (Math.sign(c1) !== -Math.sign(c2)) asym++;
  }
  ck('R-10③ compareSolutions 反对称性（20×20 抽样）', asym === 0, `违规 ${asym}`);
}

// ============================================================
// ④ [1,2,3,4] 压力用例
// ============================================================
console.log('\n' + '='.repeat(70));
console.log('④ [1,2,3,4] 压力用例（基准 primary 3 / advanced 4，量纲：归约式键唯一数）');
console.log('='.repeat(70));
{
  const t0 = Date.now();
  const res = solve([1, 2, 3, 4]);
  const t1 = Date.now();
  const d = buildDisplay(res, DISPLAY_LIMIT);
  const t2 = Date.now();
  console.log(`  solve 耗时 ${t1 - t0}ms  buildDisplay 耗时 ${t2 - t1}ms`);
  // 🔴 task-103 修正（结论甲：期望值量纲写错，非实现缺陷）
  //   旧值 52/48 的量纲 = 【原式键】去重（INPUT-05 旧引擎 Solver.toCanonicalKeyV2）。
  //   我自建枚举独立得出：原式键去重 = 52（与旧断言分毫不差）⇒ 坐实量纲混用。
  //   INPUT-06 起 solve 改用 RecipSolver.keySol（归约式键）⇒ 正确值 3/4。
  //   依据：INPUT-06.md L268「[1,2,3,4] 初级 52 → 3，此为统一归约式键的预期结果，
  //         本表为唯一有效期望值」+ R-11④ 写定 [1,2,3,4]=3/4；
  //         产品注释 RecipSolver.js:395「禁止复用 Solver.toCanonicalKeyV2（会把
  //         [1,2,3,4] 的 52 条初级解压成 3 条）」同指此事。
  //   量纲标注：下列两值均为【归约式键唯一数】，非命中次数（rawHits=551）。
  ck('R-10④ [1,2,3,4] primary = 3【归约式键唯一数】', res.primary.size === 3, `实际 ${res.primary.size}`);
  ck('R-10④ [1,2,3,4] advanced = 4【归约式键唯一数】', res.advanced.size === 4, `实际 ${res.advanced.size}`);
  // ↓ 原断言要求展示恰为 10 条且触发截断，但真值 3/4 < 10 ⇒ 本牌组不可能截断。
  //   改为【不超限】+【全量展示】+【N 与 size 一致】，仍保留 top-10 上限约束。
  ck('R-10④ 展示不超 top-10 上限（primary）', d.primary.length <= 10 && d.primary.length === res.primary.size, `展示 ${d.primary.length} / 共 ${res.primary.size}`);
  ck('R-10④ 展示不超 top-10 上限（advanced）', d.advanced.length <= 10 && d.advanced.length === res.advanced.size, `展示 ${d.advanced.length} / 共 ${res.advanced.size}`);
  ck('R-10④ 「…等共 N 条」primary N 与真实总数一致', d.counts.primary === res.primary.size, `N=${d.counts.primary} size=${res.primary.size}`);
  ck('R-10④ 「…等共 N 条」advanced N 与真实总数一致', d.counts.advanced === res.advanced.size, `N=${d.counts.advanced} size=${res.advanced.size}`);
  ck('R-10④ solve+buildDisplay 总耗时 < 2000ms（不卡顿）', (t2 - t0) < 2000, `${t2 - t0}ms`);
  console.log('\n  primary top-10：');
  d.primary.forEach((e, i) => console.log(`    ${String(i + 1).padStart(2)}. ${e}`));
  console.log('  advanced top-10：');
  d.advanced.forEach((e, i) => console.log(`    ${String(i + 1).padStart(2)}. ${e}`));
  // 每条展示解独立复算
  let bad = 0;
  for (const e of [...d.primary, ...d.advanced]) {
    const q = evalQ(parseExpr(e));
    if (!is24(q)) { bad++; console.log(`   XX 展示解 ≠24: ${e} = ${qs(q)}`); }
    const uc = usedCards(parseExpr(e));
    if (msKey(uc) !== msKey([1, 2, 3, 4])) { bad++; console.log(`   XX 展示解用牌不符: ${e}`); }
  }
  ck('R-10④ 展示的 20 条解全部独立复算 = 24 且用牌正确', bad === 0, `违规 ${bad}`);
  // advanced 展示的每条须被独立实现判为「有效」
  let badV = 0;
  for (const e of d.advanced) if (verdictIndependent(e).verdict !== '有效') { badV++; console.log(`   XX 展示的 advanced 被独立判无效: ${e}`); }
  ck('R-10④ advanced 展示 10 条全部独立判「有效」', badV === 0, `违规 ${badV}`);
}

// ============================================================
// ⑤ 空分区文案（R-06 关联）：[5,5,5,5] advanced 为空
// ============================================================
console.log('\n' + '='.repeat(70));
console.log('⑤ 空分区（R-06 关联）');
console.log('='.repeat(70));
{
  const res = solve([5, 5, 5, 5]);
  const d = buildDisplay(res, DISPLAY_LIMIT);
  ck('R-10⑤ [5,5,5,5] advanced 展示为空数组', Array.isArray(d.advanced) && d.advanced.length === 0);
  ck('R-10⑤ [5,5,5,5] advancedTop = null（UI 应显示「本局无倒数解法」）', d.advancedTop === null);
  ck('R-10⑤ [5,5,5,5] primaryTop 非空', typeof d.primaryTop === 'string' && d.primaryTop.length > 0, d.primaryTop);
  // 静态核查 UI 文案（PageRenderer）
  const fs = await import('node:fs');
  const src = fs.readFileSync(new URL('../js/ui/PageRenderer.js', import.meta.url), 'utf8');
  ck('R-10⑤ PageRenderer 含「【初级解法】」分区标题', src.includes('【初级解法】'));
  ck('R-10⑤ PageRenderer 含「【高级解法】」分区标题', src.includes('【高级解法】'));
  ck('R-10⑤ PageRenderer 含「…等共 ${N} 条」模板', /…等共 \$\{[^}]+\} 条/.test(src), (src.match(/…等共[^`\n]*/) || [''])[0]);
  ck('R-10⑤ PageRenderer 含空高级分区文案「本局无倒数解法」', src.includes('本局无倒数解法'));
  ck('R-10⑤ PageRenderer 含空初级分区文案「本局无初级解法」', src.includes('本局无初级解法'));
  ck('R-10⑤ PageRenderer 高级分区受 _advancedCalc 门控', /if \(this\._advancedCalc\)/.test(src));
}

const ok = done();
process.exit(ok ? 0 : 1);
