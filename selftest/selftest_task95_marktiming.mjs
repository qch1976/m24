// task-95 selftest：标记判定时机（B1/B2/B4/B5/B6 同型路径）
// 依据：架构师 202 号裁定 §2.2「丙方案」+ §4.5 新增断言 A-26~A-29
//       INPUT-07 §1.2.3 / §1.3.3 / §4 R-01 / R-03
//
// 核心规则：【键归键，标记归标记】
//   去重键 value + 结构 → 归约式
//   usedFact / usedMod  → 原式
//   usedRecip           → 仍归约式（INPUT-06 §1.2.3，见 A-30 取证）
//
// ⚠️ 方法论（团队规则 11）：断言必须盯【solve() 的真实分区归属】，
//    不能只数 countMod(node) —— 那是我改的那一行的复读，属自证。
//    故 A-26~A-28 均以「该键出现在 advanced 且不在 primary」为判据。
import * as RS from '../js/core/RecipSolver.mjs';

let pass = 0, fail = 0;
const T = (n, c, got) => {
  if (c) { pass++; console.log('  PASS', n); }
  else { fail++; console.log('  FAIL', n, '=> got:', JSON.stringify(got)); }
};
const n = (c, s) => RS.numLeaf(c, s);
const f = (c, s) => RS.factLeaf(c, s);
const m = (a, sa, b, sb) => RS.modLeaf(a, sa, b, sb);
const V = (t) => { const v = RS.evalNode(t); return v === null ? 'null' : (v.d === 1n ? `${v.n}` : `${v.n}/${v.d}`); };
const K = (t) => RS.keySol(RS.reduceToFixpoint(t).node);

// 导出存在性（禁条件守卫，先断言再用）
for (const nm of ['solve', 'keySol', 'reduceToFixpoint', 'evalNode', 'countMod', 'countFact', 'countRecip', 'modLeaf', 'factLeaf', 'numLeaf']) {
  T(`前置 RS.${nm} 已导出`, typeof RS[nm] === 'function', typeof RS[nm]);
}

// ============================================================
console.log('\n=== A-26🔴 B1/B2 零项消去仍置标记（%得0 被加减吸收）===');
// B1：((2%1)+2)×12 = (0+2)×12 = 24；2%1=0 被 isZeroTerm 吸收
const b1 = { op: '*', a: { op: '+', a: m(2, 1, 1, 0), b: n(2, 2) }, b: n(12, 3) };
T('A-26a☆ 前提自检：((2%1)+2)×12 确实 = 24', V(b1) === '24', V(b1));
T('A-26b☆ 前提自检：归约式确实已不含 %（证明确被吸收）',
  RS.countMod(RS.reduceToFixpoint(b1).node) === 0 && RS.countMod(b1) === 1,
  [RS.countMod(RS.reduceToFixpoint(b1).node), RS.countMod(b1)]);
T('A-26c☆ 前提自检：归约键确为 2 叶（(* n12 n2)）', K(b1) === '(* n12 n2)', K(b1));

// 🔴 真实判据：走 solve()，看 [1,2,2,12] 的这条解落哪个分区
const r26 = RS.solve([1, 2, 2, 12], { advancedCalc: true });
const r26off = RS.solve([1, 2, 2, 12], { advancedCalc: false });
const bareKey = '(* n12 n2)';
const advKeys26 = [...r26.advanced.keys()];
// 🔴 task-150：原 endsWith('M1') 是【尾锚定】—— INPUT-08 §3.3 扩为 R→F→M→P→L 后
//   M 位不再位于串尾（…M1P0L0），故必然失配。期望值由 §3.3 位序推导得来（非抄 got）：
//   原三位 R0F0M1（R=0 无倒数 / F=0 无阶乘 / M=1 用了 %）⇒ 位序恒定、前三位原样保留
//   该式未用幂、未用对数 ⇒ P=0、L=0  ⇒  R0F0M1P0L0
//   🔴 改为按【位】取 M，不依赖后缀总长 ⇒ 后续再扩位不会二次失配。
T('A-26d🔴 [1,2,2,12] 高级分区存在 (* n12 n2)|R0F0M1P0L0 键（含%标记，§3.3 五位）',
  advKeys26.some((k) => k.startsWith(bareKey) && /\|R0F0M1P0L0$/.test(k)), advKeys26.filter((k) => k.startsWith(bareKey)));
T('A-26e🔴 primary 分区不含任何展示文本带 % 的解',
  [...r26.primary.values()].every((d) => !String(d).includes('%')),
  [...r26.primary.values()].filter((d) => String(d).includes('%')));
T('A-26f🔴 R-01：开启态 primary 键集合 ⊆ 关闭态 primary 键集合',
  [...r26.primary.keys()].every((k) => r26off.primary.has(k)),
  [...r26.primary.keys()].filter((k) => !r26off.primary.has(k)));
T('A-26g🔴 R-01：两态 primary 计数一致',
  r26.primary.size === r26off.primary.size, [r26.primary.size, r26off.primary.size]);

// B2：零项【减】吸收 (2-(2%1))×12
const b2 = { op: '*', a: { op: '-', a: n(2, 2), b: m(2, 1, 1, 0) }, b: n(12, 3) };
T('A-26h☆ B2 前提：(2-(2%1))×12 = 24 且归约式不含 %',
  V(b2) === '24' && RS.countMod(RS.reduceToFixpoint(b2).node) === 0 && RS.countMod(b2) === 1,
  [V(b2), RS.countMod(RS.reduceToFixpoint(b2).node)]);
T('A-26i🔴 B2 标记按原式 ⇒ usedMod 须 true', RS.countMod(b2) > 0, RS.countMod(b2) > 0);

// ============================================================
console.log('\n=== A-27🔴 B4/B5 单位元吸收仍置标记（%得1 被乘除一吸收）===');
// ⚠️ 实测发现：B4/B5 在当前实现下【不触发】—— isIdentFactor 是【形状】判据
//    ((op==='num'&&card===1) || op==='one')，op==='mod' 的 (7%3) 不被命中 ⇒ % 不会被吸收。
//    与 isZeroTerm 的【值】判据不对称。此处仍立断言，作为「未来若改为值判据」的回归防线。
const b4 = { op: '*', a: { op: '*', a: m(7, 0, 3, 1), b: n(12, 2) }, b: n(2, 3) };
T('A-27a☆ 前提：(7%3)×12×2 = 24', V(b4) === '24', V(b4));
T('A-27b☆ 取证：(7%3) 值为 1（单位元候选）', V(m(7, 0, 3, 1)) === '1', V(m(7, 0, 3, 1)));
T('A-27c 当前实现下 % 因子未被吸收（isIdentFactor 为形状判据）',
  RS.countMod(RS.reduceToFixpoint(b4).node) === 1, RS.countMod(RS.reduceToFixpoint(b4).node));
T('A-27d🔴 无论是否被吸收，标记按原式 ⇒ usedMod 须 true', RS.countMod(b4) > 0, RS.countMod(b4) > 0);
const b5 = { op: '/', a: { op: '*', a: n(12, 2), b: n(2, 3) }, b: m(7, 0, 3, 1) };
T('A-27e☆ 前提：12×2÷(7%3) = 24', V(b5) === '24', V(b5));
T('A-27f🔴 B5 标记按原式 ⇒ usedMod 须 true', RS.countMod(b5) > 0, RS.countMod(b5) > 0);

// ============================================================
console.log('\n=== A-28🔴 B6 0! 吸收仍置标记（守 R-03，与需求明文直接相关）===');
// 0! = 1，作乘除链因子是单位元候选。R-03 明文「0! 计入高级解」。
const b6 = { op: '*', a: { op: '*', a: f(0, 0), b: n(12, 1) }, b: n(2, 2) };
T('A-28a☆ 前提：0!×12×2 = 24', V(b6) === '24', V(b6));
T('A-28b☆ 取证：0! 值为 1', V(f(0, 0)) === '1', V(f(0, 0)));
T('A-28c🔴 标记按原式 ⇒ usedFact 须 true（守 R-03）', RS.countFact(b6) > 0, RS.countFact(b6) > 0);
// 🔴 真实判据：0! 必须真的出现在某牌组的 advanced 分区
const r28 = RS.solve([0, 2, 12, 1], { advancedCalc: true });
// task-100 A：键后缀由 |F?M? 改为 |R?F?M?（补 usedRecip 维）⇒ 原 /\|F1/ 失配。
// 改为按定长后缀取 F 位，位序 R→F→M（205 §C-1）。
// 🔴 task-150：原 /\|R[01]F1M[01]$/ 的 `$` 锚在 M 位后 ⇒ 五位键 …M0P0L0 必然失配，
//   got:[] 是【正则失配】，非「无 F1 解」。双层自证：① 该正则对五位 F1 正例失配、对三位命中
//   （尺子问题）；② solve 已传 {advancedCalc:true}，[0,2,12,1] 的 F1 解【真实存在 20 条】。
//   按 §3.3 位序补 P/L 两位（F 位仍按位取，不写死其余位值）。
const hasFactAdv = [...r28.advanced.keys()].some((k) => /\|R[01]F1M[01]P[01]L[01]$/.test(k));
T('A-28d🔴 [0,2,12,1] advanced 中存在 F1 标记的解（0! 计入高级）', hasFactAdv,
  [...r28.advanced.keys()].filter((k) => /\|R[01]F1M[01]P[01]L[01]$/.test(k)).slice(0, 3));
// R-03 反向：1!/2! 不得计入 —— 由枚举期排除保证
T('A-28e R-03 反向：factEnumerable(1)=false（1! 不枚举）', RS.factEnumerable(1) === false, RS.factEnumerable(1));
T('A-28f R-03 反向：factEnumerable(2)=false（2! 不枚举）', RS.factEnumerable(2) === false, RS.factEnumerable(2));
T('A-28g R-03 正向：factEnumerable(0)=true（0! 有效）', RS.factEnumerable(0) === true, RS.factEnumerable(0));
// ⭐ 关键：按原式判定后，1!/2! 靠「枚举期排除」而非「归约后判定」——须实证原式里确实没有退化式
let degFact = 0, totFact = 0;
for (const dk of [[1, 2, 3, 4], [1, 1, 2, 2], [2, 2, 2, 2], [1, 2, 2, 12], [0, 1, 2, 3]]) {
  for (const lv of RS.advVariants(dk)) for (const it of lv) {
    const walk = (x) => {
      if (!x || typeof x !== 'object') return;
      if (x.op === 'fact') { totFact++; if (x.arg && x.arg.op === 'num' && (x.arg.card === 1 || x.arg.card === 2)) degFact++; }
      walk(x.a); walk(x.b); walk(x.arg);
    };
    walk(it);
  }
}
T('A-28h🔴 枚举期排除实证：原式中 1!/2! 退化式出现 0 次（故按原式判定不违反 R-03）',
  degFact === 0 && totFact > 0, [degFact, totFact]);

// 🔴🔴 A-28i/j/k：B6 的【行为级】判据 —— 必须有真实被吸收的 fact 解落入 advanced
// ⚠️ 团队规则 11 再次生效：我最初只写了 A-31a（源码 grep）+ countFact 计数断言，
//    变异5（仅 usedFact 改回归约式）只红了 A-31a 这一条源码断言，
//    看上去像「B6 无行为症状」—— 但那是因为我没写行为级断言，不是真的没症状。
//    全量搜索实测：[0,0,2,12] 存在「原式 fact=1 → 归约 fact=0」的 =24 解，
//    归约键恰为 (* n12 n2)（fact 被单位元/零项吸收）⇒ B6 确有行为级症状。
//    ⇒ 只有源码断言判红的变异，等于没有行为证据，必须补。
const r28b = RS.solve([0, 0, 2, 12], { advancedCalc: true });
const r28bOff = RS.solve([0, 0, 2, 12], { advancedCalc: false });
// 🔴 task-150：原硬编码三位全串 '(* n12 n2)|R0F1M0'。按 §3.3 位序推导：
//   原三位 R0F1M0（R=0 / F=1 用了 0! / M=0 无 %）⇒ 前三位原样保留；未用幂/对数 ⇒ P0L0
//   ⇒ 推导期望 = (* n12 n2)|R0F1M0P0L0
T('A-28i🔴 B6 行为级：[0,0,2,12] 的 (* n12 n2)|R0F1M0P0L0 须在 advanced（fact 被吸收仍置标记）',
  r28b.advanced.has('(* n12 n2)|R0F1M0P0L0'),
  [...r28b.advanced.keys()].filter((k) => k.startsWith('(* n12 n2)')));
T('A-28j🔴 B6 行为级：primary 不得出现展示带 ! 的解',
  [...r28b.primary.values()].every((d) => !String(d).includes('!')),
  [...r28b.primary.values()].filter((d) => String(d).includes('!')));
T('A-28k🔴 B6 R-01：[0,0,2,12] 两态 primary 一致',
  r28b.primary.size === r28bOff.primary.size, [r28b.primary.size, r28bOff.primary.size]);

// ============================================================
console.log('\n=== A-29 R-01 守护：全量两态一致 + primary 零高级记号 ===');
const decks = [];
for (let a = 0; a <= 13; a++) for (let b = a; b <= 13; b++)
  for (let c = b; c <= 13; c++) for (let d = c; d <= 13; d++) decks.push([a, b, c, d]);
let diffCnt = 0, notSubset = 0, advTextInPrimary = 0, offAdvNonZero = 0;
const badSample = [];
for (const dk of decks) {
  const off = RS.solve(dk, { advancedCalc: false });
  const on = RS.solve(dk, { advancedCalc: true });
  if (off.advanced.size !== 0) offAdvNonZero++;
  if (off.primary.size !== on.primary.size) { diffCnt++; if (badSample.length < 4) badSample.push(dk); }
  for (const k of on.primary.keys()) if (!off.primary.has(k)) { notSubset++; break; }
  for (const disp of on.primary.values()) {
    const s = String(disp);
    if (s.includes('%') || s.includes('!') || s.includes('1÷') === false && /1\//.test(s)) {
      if (s.includes('%') || s.includes('!')) advTextInPrimary++;
    }
  }
}
T('A-29a 关闭态 advanced 恒为 0', offAdvNonZero === 0, offAdvNonZero);
T('A-29b🔴 两态 primary 计数完全一致（R-01）', diffCnt === 0, [diffCnt, badSample]);
T('A-29c🔴 开启态 primary ⊆ 关闭态 primary（无多出键）', notSubset === 0, notSubset);
T('A-29d🔴 primary 展示文本零 % / ! 记号（§1.4）', advTextInPrimary === 0, advTextInPrimary);

// ============================================================
console.log('\n=== A-30 usedRecip 必须仍按归约式（我实测拦下的一处，与裁定 §2.2 有出入）===');
// 裁定说「三标记均改按原式」，但倒数性质不同：
// 可消去倒数解（12÷(1/2)、(1×2)/((1/3)/4)）原式含 recip、归约后消失，
// INPUT-06 §1.2.3 要求它们【不算高级解】。实测若 usedRecip 也按原式：
//   selftest_input06_recip 12 红、dedup 14 红、[1,2,3,4] advanced 4→6（破 §8 参考数据）
const canc = { op: '/', a: n(12, 0), b: RS.recipLeaf(2, 1) };   // 12÷(1/2) = 24
T('A-30a☆ 前提：12÷(1/2) = 24', V(canc) === '24', V(canc));
T('A-30b☆ 取证：原式含 recip 但归约式不含（可消去倒数解）',
  RS.countRecip(canc) === 1 && RS.countRecip(RS.reduceToFixpoint(canc).node) === 0,
  [RS.countRecip(canc), RS.countRecip(RS.reduceToFixpoint(canc).node)]);
T('A-30c🔴 [1,2,3,4] 兼容态 advanced 恰为 4（INPUT-06 §8 参考数据，守 §1.2.3）',
  RS.solve([1, 2, 3, 4]).advanced.size === 4, RS.solve([1, 2, 3, 4]).advanced.size);
T('A-30d🔴 [1,2,3,4] 兼容态 primary 恰为 3（INPUT-06 §8）',
  RS.solve([1, 2, 3, 4]).primary.size === 3, RS.solve([1, 2, 3, 4]).primary.size);

// ============================================================
console.log('\n=== A-31 源码口径核验（剥注释后查，防注释污染）===');
import fs from 'fs';
const srcRaw = fs.readFileSync(new URL('../js/core/RecipSolver.mjs', import.meta.url), 'utf8');
const src = srcRaw.split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');
T('A-31a usedFact 取原式 countFact(node)', /const usedFact = countFact\(node\) > 0/.test(src), null);
T('A-31b usedMod 取原式 countMod(node)', /const usedMod = countMod\(node\) > 0/.test(src), null);
// ⚠️ A-31c 已随实现更新：usedRecip 现为【合取判据】
//   原式 countRecip(node) > 0  且  归约键含 r 记号
//   （单用任一侧都会误判，见源码处三案例注释）
T('A-31c usedRecip 为合取判据（原式 recip 且 归约键含 r）',
  /countRecip\(node\) > 0 && \/\(\^\|\[\^a-z\]\)r/.test(src), null);
T('A-31c☆ usedRecip 未退化为单侧判据（不得只数原式或只看键）',
  !/const usedRecip = countRecip\(node\) > 0;\s*$/m.test(src)
  && !/const usedRecip = countRecip\(rr\.node\) > 0;/.test(src), null);
T('A-31d 键仍取归约式 keySol(rr.node)', /const baseK = keySol\(rr\.node\)/.test(src), null);
// ⚠️ 口径修正（团队规则 11：尺子先自验）：
//   我最初写 /[=!]==\s*24/，它命中了【正确】的 BigInt 精确比较 `f.n === 24n * f.d`
//   —— 因为 `24` 后面跟的是 `n`。禁的是浮点比较 `x === 24`，不是 `=== 24n`。
//   故须排除紧跟 n 的情形。
T('A-31e 精确运算：无浮点 ===24 / ==24（排除合法 24n）',
  !/[=!]==\s*24(?!n)|[^=!]==\s*24(?!n)/.test(src), (src.match(/[=!]==\s*24(?!n)/g) || []).slice(0, 3));
T('A-31f 精确运算：无 toFixed', !/toFixed/.test(src), null);

console.log(`\npass=${pass} fail=${fail}`);

// 🔴 task-150 新增：断言总数自断言（分族算式，禁裸数字）——防断言静默退场。
//   48 = 本支修复前已通过的断言数（现取 rc=1 时 pass=48）
//    3 = 本支修复的三条（A-26d 尾锚定 / A-28i 硬编码三位 / A-28d 正则 $ 锚 M 位后）
const EXPECTED_ASSERTION_COUNT = 48 + 3;
const total = pass + fail;
if (total !== EXPECTED_ASSERTION_COUNT) {
  console.log(`FAIL 断言总数自断言：${total} != 期望 ${EXPECTED_ASSERTION_COUNT}（有断言静默退场）`);
  fail++;
} else {
  console.log(`断言总数核对：${total} == 期望 ${EXPECTED_ASSERTION_COUNT} ✅`);
}
console.log(fail === 0 ? 'ALL PASS' : `OVERALL: FAIL (${fail})`);
process.exit(fail === 0 ? 0 : 1);
