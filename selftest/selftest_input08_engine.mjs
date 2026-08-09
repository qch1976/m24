// selftest/selftest_input08_engine.mjs — INPUT-08 引擎层：键/后缀/步数/R-01
import * as RS from '../js/core/RecipSolver.mjs';

let pass = 0, fail = 0;
const T = (name, cond, got) => {
  if (cond) { pass++; console.log(`  ok  ${name}`); }
  else { fail++; console.log(`  FAIL ${name} => got: ${JSON.stringify(got)}`); }
};
const ALL = { recip: true, fact: true, mod: true, pow: true, log: true };

console.log('════ INPUT-08 引擎层自测 ════');

// ───────── §3.3 五位后缀 ─────────
console.log('【1】§3.3 五位后缀 R→F→M→P→L');
const decks = [];
for (let a = 0; a <= 13; a++) for (let b = a; b <= 13; b++) for (let c = b; c <= 13; c++) for (let d = c; d <= 13; d++) decks.push([a, b, c, d]);
T('A-0 牌组基数 2380（§2.1 值域 0-13）', decks.length === 2380, decks.length);

let fiveDigitHit = 0, threeDigitHit = 0, powHit = 0, logHit = 0, pipeInPrimary = 0;
const powSamples = [], logSamples = [];
for (const deck of decks) {
  const r = RS.solve(deck, { advancedCalc: true, caps: ALL });
  for (const k of r.advanced.keys()) {
    if (/\|R[01]F[01]M[01]P[01]L[01]$/.test(k)) fiveDigitHit++;
    else if (/\|R[01]F[01]M[01]$/.test(k)) threeDigitHit++;
    const m = k.match(/\|R[01]F[01]M[01]P([01])L([01])$/);
    if (m) {
      if (m[1] === '1') { powHit++; if (powSamples.length < 3) powSamples.push([deck.join(','), k, r.advanced.get(k)]); }
      if (m[2] === '1') { logHit++; if (logSamples.length < 3) logSamples.push([deck.join(','), k, r.advanced.get(k)]); }
    }
  }
  for (const k of r.primary.keys()) if (k.includes('|')) pipeInPrimary++;
}
T('A-1🔴 全部高级键均为五位后缀（无三位残留）', threeDigitHit === 0, { threeDigitHit, fiveDigitHit });
T('A-2🔴 存在性前置：P 位有命中（否则后续断言是空的）', powHit > 0, powHit);
T('A-3🔴 存在性前置：L 位有命中', logHit > 0, logHit);
console.log(`  P 位命中 ${powHit} 键、L 位命中 ${logHit} 键`);
console.log('  幂样本:'); for (const s of powSamples) console.log(`     [${s[0]}] ${s[2]}   键=${s[1]}`);
console.log('  对数样本:'); for (const s of logSamples) console.log(`     [${s[0]}] ${s[2]}   键=${s[1]}`);

// ───────── §3.3 全 0 走无后缀短路 ─────────
console.log('【2】§3.3 全 false ⇒ 无后缀短路（禁恒拼 R0F0M0P0L0）');
let zeroSuffixHit = 0, offPipeHit = 0;
for (const deck of decks) {
  const off = RS.solve(deck, { advancedCalc: true, caps: { recip: false, fact: false, mod: false } });
  for (const k of [...off.primary.keys(), ...off.advanced.keys()]) {
    if (k.endsWith('|R0F0M0P0L0')) zeroSuffixHit++;
    if (k.includes('|')) offPipeHit++;
  }
}
T('B-1🔴 全量键中不存在 |R0F0M0P0L0 字面量', zeroSuffixHit === 0, zeroSuffixHit);
T('B-2🔴 关闭态键集合中不存在含 | 的键（守 R-01）', offPipeHit === 0, offPipeHit);

// ───────── §3.2 R-01 扩展 ─────────
console.log('【3】§3.2 R-01：含幂/对数的解不得落入初级分区');
T('C-1🔴 primary 中无带后缀键', pipeInPrimary === 0, pipeInPrimary);
let primaryAdvSymbol = 0;
const violate = [];
for (const deck of decks) {
  const r = RS.solve(deck, { advancedCalc: true, caps: ALL });
  for (const [k, disp] of r.primary) {
    const s = String(disp);
    if (s.includes('^') || s.includes('log') || s.includes('√') || s.includes('!') || s.includes('%') || /\(1\//.test(s)) {
      primaryAdvSymbol++; if (violate.length < 3) violate.push([deck.join(','), k, s]);
    }
  }
}
T('C-2🔴 primary 展示不含 ^ / log / √ / ! / % / (1/', primaryAdvSymbol === 0, violate);

// ───────── §3.5 步数恒 3 ─────────
console.log('【4】§3.5 含幂/对数的高级解步数恒 3（GUI-4 同型）');
let stepChecked = 0, stepBad = 0;
const stepSamples = [], badSamples = [];
for (const deck of decks) {
  const r = RS.solve(deck, { advancedCalc: true, caps: ALL });
  if (!r.advancedNodes) continue;
  for (const [disp, node] of r.advancedNodes) {
    if (!(String(disp).includes('^') || String(disp).includes('log') || String(disp).includes('√'))) continue;
    const steps = RS.advPostOrderSteps(node);
    stepChecked++;
    if (steps.length !== 3) { stepBad++; if (badSamples.length < 3) badSamples.push([deck.join(','), disp, steps.length]); }
    else if (stepSamples.length < 2) stepSamples.push([deck.join(','), disp, steps]);
  }
}
T('D-1🔴 存在性前置：确有含幂/对数解被检查（否则 D-2 是空断言）', stepChecked > 0, stepChecked);
T('D-2🔴 含幂/对数的高级解步数恒为 3', stepBad === 0, badSamples);
console.log(`  检查 ${stepChecked} 条含幂/对数解，步数≠3 的 ${stepBad} 条`);
for (const [d, disp, steps] of stepSamples) {
  console.log(`     [${d}] ${disp}`);
  for (const s of steps) console.log(`        step${s.step}: ${s.lhs} ${s.op} ${s.rhs} = ${s.result}`);
}

// ───────── §3.5 op 名不得泄露枚举名 ─────────
console.log('【5】§3.5 op 名须映射屏显符号，不得泄露 pow/log 枚举名');
let leakPow = 0;
for (const deck of decks.slice(0, 400)) {
  const r = RS.solve(deck, { advancedCalc: true, caps: ALL });
  if (!r.advancedNodes) continue;
  for (const [, node] of r.advancedNodes) {
    for (const s of RS.advPostOrderSteps(node)) if (s.op === 'pow') leakPow++;
  }
}
T('E-1🔴 步骤 op 中不出现内部名 pow（应为 ^）', leakPow === 0, leakPow);

// ───────── 键保序（不可交换） ─────────
console.log('【6】§1.1 幂/对数不可交换 ⇒ 键须保序');
const kPow23 = RS.keySol({ op: 'pow', a: { op: 'num', card: 2 }, b: { op: 'num', card: 3 } });
const kPow32 = RS.keySol({ op: 'pow', a: { op: 'num', card: 3 }, b: { op: 'num', card: 2 } });
T('F-1🔴 2^3 与 3^2 键不同（2^3=8≠9=3^2）', kPow23 !== kPow32, [kPow23, kPow32]);
const kLog24 = RS.keySol({ op: 'log', a: { op: 'num', card: 2 }, b: { op: 'num', card: 4 } });
const kLog42 = RS.keySol({ op: 'log', a: { op: 'num', card: 4 }, b: { op: 'num', card: 2 } });
T('F-2🔴 log_2 4 与 log_4 2 键不同', kLog24 !== kLog42, [kLog24, kLog42]);
// 🔴 开方 vs 普通幂：4^2=16 与 4^(1/2)=2，键必须可区分
const kP42 = RS.keySol({ op: 'pow', a: { op: 'num', card: 4 }, b: { op: 'num', card: 2 } });
const kR42 = RS.keySol({ op: 'pow', a: { op: 'num', card: 4 }, b: { op: 'num', card: 2 }, rootIdx: 2 });
T('F-3🔴 4^2 与 4^(1/2) 键不同（值 16 vs 2，同键会错误归并）', kP42 !== kR42, [kP42, kR42]);

// ───────── §1.2 开方不建 1/b 子树 ─────────
console.log('【7】§1.2 开方用 rootIdx 专用字段，不建 1/b 子树（避免别名擦除）');
const rl = RS.rootLeaf(4, 0, 2, 1);
T('G-1🔴 rootLeaf 的 b 是 num 叶子而非 recip/除法子树',
  rl.b.op === 'num' && rl.rootIdx === 2, rl);
// 🔴 不用 JSON.stringify（v 字段含 BigInt 会抛 TypeError）——改结构递归扫描，
//   直接量「树里有没有 recip / 除法节点」，比字串匹配更直接。
const hasOp = (node, ops) => {
  if (!node || typeof node !== 'object') return false;
  if (ops.includes(node.op)) return true;
  return hasOp(node.a, ops) || hasOp(node.b, ops) || hasOp(node.arg, ops);
};
T('G-2🔴 rootLeaf 子树不含 recip 或 "/" 节点（不建 1/b 子树）',
  hasOp(rl, ['recip', '/']) === false, { aOp: rl.a.op, bOp: rl.b.op, rootIdx: rl.rootIdx });
// 🔴 关键：开方键不得与倒数叶子同键（这正是架构师 ① 报的别名擦除）
const kRecip2 = RS.keySol({ op: 'recip', arg: { op: 'num', card: 2 } });
T('G-3🔴 开方键 ≠ 倒数叶子键 r2（别名擦除防线，L707 同病理）',
  kR42 !== kRecip2, [kR42, kRecip2]);
T('G-4 rootLeaf 求值精确 4^(1/2)=2', rl.v !== null && rl.v.n === 2n && rl.v.d === 1n, rl.v);

// ───────── 向后兼容 ─────────
console.log('【8】向后兼容：pow/log 默认关（=== true 才开）');
const d = [2, 3, 4, 5];
const noCaps = RS.solve(d, { advancedCalc: true });
const explicitOff = RS.solve(d, { advancedCalc: true, caps: { recip: true, fact: true, mod: true } });
let noCapsPL = 0;
for (const k of noCaps.advanced.keys()) { const m = k.match(/P([01])L([01])$/); if (m && (m[1] === '1' || m[2] === '1')) noCapsPL++; }
T('H-1🔴 不传 caps ⇒ pow/log 不开（P/L 位恒 0）', noCapsPL === 0, noCapsPL);
T('H-2 不传 caps 与三项全开逐键一致（向后兼容）',
  [...noCaps.advanced.keys()].sort().join('\n') === [...explicitOff.advanced.keys()].sort().join('\n'), null);

// 断言总数自核：A3(A-0/1/2/3=4) + B2 + C2 + D2 + E1 + F3 + G4 + H2 = 20
const EXPECTED = 20;
console.log(`\npass=${pass} fail=${fail}`);
if (pass + fail !== EXPECTED) {
  console.log(`🔴 条款8 断言总数不符：期望 ${EXPECTED}，实际 ${pass + fail}`);
  process.exit(2);
}
console.log(`条款8 断言总数核对：${pass + fail} == 期望 ${EXPECTED} ✅`);
process.exit(fail === 0 ? 0 : 1);
