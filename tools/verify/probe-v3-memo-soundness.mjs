// 人工阅读型调查脚本，非门禁。退出码恒为 0，即使正文打印 ❌ 也不判红；判定权在阅读者。
// （task-75 哑弹治理：实测 24 支 probe-v3-* 均无非零退出能力，❌/FAIL 全在 console.log 内。）
// 三件事，按重要性排序：
// (1) 【自查】137 脚本的记忆化键 `items 值 multiset + 长度` 在 STRICT 口径下【不健全】
//     因为 STRICT 的可施单目性依赖 hasUnary(t)（树结构），而键只含值 → 会把
//     「值相同但一方子树已含单目」的状态错误合并，可能【多杀】STRICT 解 → 116 可能虚高
//     必须关掉记忆化重跑，或把 flags 并入键。Tester 报 40，我报 116，差异可能出自这里。
// (2) 拆解 Tester 的「产品两难」：他的两难前提是「口径B FAIL」。
//     但 Developer 实测 self_only 最差 506ms PASS。我自己实测口径B 到底多少？用同一 20 组明文牌。
// (3) 验证 Tester §七 阻塞级发现：(6/(1/(8-4))) 是否真会被字符串型 L1 误判为 recip 解
import { performance } from 'node:perf_hooks';
import { readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';

function gcd(a, b) { while (b) { [a, b] = [b, a % b]; } return a; }
function F(n, d = 1) {
  if (d === 0) return null;
  if (d < 0) { n = -n; d = -d; }
  const g = gcd(Math.abs(n), d) || 1;
  return { n: n / g, d: d / g };
}
const add = (a, b) => F(a.n * b.d + b.n * a.d, a.d * b.d);
const sub = (a, b) => F(a.n * b.d - b.n * a.d, a.d * b.d);
const mul = (a, b) => F(a.n * b.n, a.d * b.d);
const div = (a, b) => (b.n === 0 ? null : F(a.n * b.d, a.d * b.n));
const is24 = (f) => f && f.n === 24 * f.d;
const BIN = [['+', add], ['-', sub], ['*', mul], ['/', div]];
const show = (t) => t.k === 'num' ? String(t.val)
  : t.k === 'abs' ? `|${show(t.a)}|` : t.k === 'rec' ? `(1/${show(t.a)})`
  : `(${show(t.a)}${t.op}${show(t.b)})`;
function evalT(t) {
  if (!t) return null;
  if (t.k === 'num') return F(t.val);
  if (t.k === 'abs') { const v = evalT(t.a); return v && F(Math.abs(v.n), v.d); }
  if (t.k === 'rec') { const v = evalT(t.a); return v && v.n !== 0 ? F(v.d, v.n) : null; }
  const a = evalT(t.a), b = evalT(t.b);
  if (!a || !b) return null;
  return BIN.find(([o]) => o === t.op)[1](a, b);
}
const hasUnary = (t) => t.k === 'num' ? false : (t.k === 'abs' || t.k === 'rec') ? true : hasUnary(t.a) || hasUnary(t.b);
const hasAbs = (t) => t.k === 'num' ? false : t.k === 'abs' ? true : t.k === 'rec' ? hasAbs(t.a) : hasAbs(t.a) || hasAbs(t.b);
const hasRec = (t) => t.k === 'num' ? false : t.k === 'rec' ? true : t.k === 'abs' ? hasRec(t.a) : hasRec(t.a) || hasRec(t.b);
function uStrict(v, t) {
  const o = [{ v, t }];
  if (hasUnary(t)) return o;
  if (v.n < 0) o.push({ v: F(-v.n, v.d), t: { k: 'abs', a: t } });
  if (v.n !== 0 && !(Math.abs(v.n) === 1 && v.d === 1)) o.push({ v: F(v.d, v.n), t: { k: 'rec', a: t } });
  return o;
}
function uLoose(v, t) {
  const o = [{ v, t }];
  if (t.k !== 'abs' && v.n < 0) o.push({ v: F(-v.n, v.d), t: { k: 'abs', a: t } });
  if (t.k !== 'rec' && v.n !== 0 && !(Math.abs(v.n) === 1 && v.d === 1))
    o.push({ v: F(v.d, v.n), t: { k: 'rec', a: t } });
  return o;
}
// memo: 'none' = 无记忆化（健全）| 'valueOnly' = 137 用的键（STRICT 下不健全）| 'valueFlags' = 值+flags（健全）
function probe(nums, uv, memo) {
  let any = false, pri = false, absOnly = false, recipOnly = false, sample = null;
  const seen = new Set();
  (function dfs(items) {
    if (any && pri && absOnly && recipOnly) return;
    if (items.length === 1) {
      for (const c of uv(items[0].v, items[0].t)) {
        if (!is24(c.v)) continue;
        any = true;
        if (!sample) sample = c.t;
        const a = hasAbs(c.t), r = hasRec(c.t);
        if (!a && !r) pri = true;
        else if (a && !r) absOnly = true;
        else if (!a && r) recipOnly = true;
      }
      return;
    }
    const n = items.length;
    if (memo !== 'none' && n >= 3) {
      const key = memo === 'valueOnly'
        ? items.map((x) => `${x.v.n}/${x.v.d}`).sort().join(',') + '#' + n
        : items.map((x) => `${x.v.n}/${x.v.d}:${hasUnary(x.t) ? 1 : 0}`).sort().join(',') + '#' + n;
      if (seen.has(key)) return;
      seen.add(key);
    }
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      if (i === j) continue;
      const rest = items.filter((_, k) => k !== i && k !== j);
      for (const a of uv(items[i].v, items[i].t))
        for (const b of uv(items[j].v, items[j].t))
          for (const [op, fn] of BIN) {
            const v = fn(a.v, b.v);
            if (!v) continue;
            dfs([{ v, t: { k: 'bin', op, a: a.t, b: b.t } }, ...rest]);
            if (any && pri && absOnly && recipOnly) return;
          }
    }
  })(nums.map((x) => ({ v: F(x), t: { k: 'num', val: x } })));
  return { any, pri, absOnly, recipOnly, sample };
}
const pct = (a, p) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.ceil(p / 100 * s.length) - 1)]; };
const loadavg = () => { try { return readFileSync('/proc/loadavg', 'utf8').trim().split(' ').slice(0, 3).join('/'); } catch { return os.loadavg().map(x => x.toFixed(2)).join('/'); } };

console.log('=== (1) 自查：137 日志的 116 组是否被不健全记忆化污染 ===');
console.log(`环境: Node ${process.version}, ${os.cpus().length} 核, loadavg ${loadavg()}, ${new Date().toISOString()}`);
console.log('质疑我自己：137 用的记忆化键只含【值 multiset + 长度】，不含 hasUnary flag。');
console.log('但 STRICT 的"能否施单目"依赖树是否已含单目 → 同值不同 flag 状态被错误合并 → 可能多杀 STRICT 解');
console.log('Tester 报 40 组，我报 116 组，差异可能正出自此处。三种记忆化对比：\n');

// 先用 Tester 举的 8 组铁证做定性判断（快）
const PROOF8 = [[2, 2, 10, 12], [2, 4, 9, 11], [2, 5, 7, 12], [2, 6, 7, 7], [2, 10, 10, 10], [2, 5, 11, 13], [2, 7, 8, 10], [2, 9, 12, 12]];
console.log('--- 1.1 Tester 的 8 组铁证：三种记忆化下 STRICT 是否判无解 ---');
console.log('deck\t\tSTRICT(无记忆化)\tSTRICT(值键=137写法)\tSTRICT(值+flag键)\tLOOSE\t一致?');
let mismatch = 0;
for (const d of PROOF8) {
  const a0 = probe(d, uStrict, 'none').any, a1 = probe(d, uStrict, 'valueOnly').any, a2 = probe(d, uStrict, 'valueFlags').any;
  const b = probe(d, uLoose, 'none').any;
  const ok = a0 === a1 && a0 === a2;
  if (!ok) mismatch++;
  console.log(`[${d}]\t${a0 ? '有解' : '无解'}\t\t\t${a1 ? '有解' : '无解'}\t\t\t${a2 ? '有解' : '无解'}\t\t\t${b ? '有解' : '无解'}\t${ok ? '✅' : '🔴 记忆化影响结果'}`);
}
console.log(`\n8 组中记忆化影响结果的组数: ${mismatch} ${mismatch === 0 ? '✅ 我的 137 记忆化在这些组上未污染' : '🔴 137 的 116 组数字需修正'}`);

console.log('\n--- 1.2 全量 1820 组三键对比（决定 116 vs 40 谁对）---');
const DECKS = [];
for (let a = 1; a <= 13; a++) for (let b = a; b <= 13; b++) for (let c = b; c <= 13; c++) for (let d = c; d <= 13; d++) DECKS.push([a, b, c, d]);
const res = {};
for (const memo of ['valueOnly', 'valueFlags', 'none']) {
  const t0 = performance.now();
  let sA = 0, sB = 0, absA = 0, absB = 0, recA = 0, recB = 0;
  const lost = [];
  for (const deck of DECKS) {
    const A = probe(deck, uStrict, memo), B = probe(deck, uLoose, memo);
    if (A.any) sA++; if (B.any) sB++;
    if (A.absOnly) absA++; if (B.absOnly) absB++;
    if (A.recipOnly) recA++; if (B.recipOnly) recB++;
    if (!A.any && B.any) lost.push({ deck, sample: B.sample });
  }
  res[memo] = { sA, sB, lost, absA, absB, recA, recB, sec: (performance.now() - t0) / 1000 };
  console.log(`记忆化=${memo.padEnd(11)} STRICT可解=${sA}  LOOSE可解=${sB}  误判无解=${lost.length}  absOnly ${absA}/${absB}  recipOnly ${recA}/${recB}  (${res[memo].sec.toFixed(0)}s, load ${loadavg()})`);
}
const R = res.none;
console.log(`\n★ 健全基准（无记忆化）：STRICT 误判无解 = ${R.lost.length} 组`);
console.log(`  137 日志用的 valueOnly 键 = ${res.valueOnly.lost.length} 组 ${res.valueOnly.lost.length === R.lost.length ? '✅ 未污染' : `🔴 偏差 ${res.valueOnly.lost.length - R.lost.length} 组，137 数字需修正`}`);
console.log(`  Tester 报 40 组 ${R.lost.length === 40 ? '✅ 与健全基准一致' : `⚠️ 与健全基准 ${R.lost.length} 不符`}`);
writeFileSync('/root/.openclaw/.arkclaw-team/projects/p-mr3h5f2hirbdlr/output/p-mr3h5f2hirbdlr-worker1/verify/input06-strict-lost-decks-v2.json',
  JSON.stringify({ generatedAt: new Date().toISOString(), memoSound: 'none', strictSolvable: R.sA, looseSolvable: R.sB, lostCount: R.lost.length, lostDecks: R.lost.map((x) => ({ deck: x.deck, looseSolution: show(x.sample) })), absOnlyStrict: R.absA, absOnlyLoose: R.absB, recipOnlyStrict: R.recA, recipOnlyLoose: R.recB, memoComparison: { valueOnly: res.valueOnly.lost.length, valueFlags: res.valueFlags.lost.length, none: R.lost.length } }, null, 2));

console.log('\n\n=== (2) 拆解 Tester 的「产品两难」：口径B 到底 FAIL 吗？===');
console.log('他的两难前提是「口径B FAIL，需 keepN 压回」。但 Developer 实测 self_only 最差 506ms PASS。');
console.log('我用【已公开的 20 组明文牌】跑口径B 全量枚举（无截断），5 轮取最差值：\n');
const DECK20 = [[12, 6, 1, 8], [5, 12, 7, 13], [13, 10, 4, 8], [6, 3, 13, 11], [5, 3, 6, 12], [10, 7, 9, 2], [8, 13, 7, 2], [10, 5, 12, 10], [3, 4, 2, 10], [2, 6, 5, 13], [8, 6, 11, 10], [8, 7, 7, 12], [3, 1, 1, 1], [2, 13, 9, 1], [10, 12, 12, 10], [1, 7, 11, 11], [9, 2, 1, 13], [3, 3, 9, 7], [7, 12, 10, 10], [12, 1, 11, 3]];
// 全量枚举（收集所有解，不早退）—— 这是最坏情况
function fullEnum(nums, uv) {
  const found = new Set();
  (function dfs(items) {
    if (items.length === 1) { for (const c of uv(items[0].v, items[0].t)) if (is24(c.v)) found.add(show(c.t)); return; }
    const n = items.length;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      if (i === j) continue;
      const rest = items.filter((_, k) => k !== i && k !== j);
      for (const a of uv(items[i].v, items[i].t)) for (const b of uv(items[j].v, items[j].t))
        for (const [op, fn] of BIN) { const v = fn(a.v, b.v); if (!v) continue; dfs([{ v, t: { k: 'bin', op, a: a.t, b: b.t } }, ...rest]); }
    }
  })(nums.map((x) => ({ v: F(x), t: { k: 'num', val: x } })));
  return found.size;
}
for (const [label, uv] of [['口径B(self_only) 全量无截断', uLoose], ['口径A(subtree_block) 全量无截断', uStrict]]) {
  const rounds = [];
  console.log(`◆ ${label}`);
  for (let r = 0; r < 5; r++) {
    const la0 = loadavg(); const ts = [];
    for (const d of DECK20) { const t0 = performance.now(); fullEnum(d, uv); ts.push(performance.now() - t0); }
    const p95 = pct(ts, 95), over = ts.filter((x) => x > 2000).length;
    rounds.push({ p95, over });
    console.log(`   轮${r + 1}: P50=${pct(ts, 50).toFixed(1)} P95=${p95.toFixed(1)} max=${Math.max(...ts).toFixed(1)} 超2s=${over}/20  load ${la0}→${loadavg()}`);
  }
  const worst = Math.max(...rounds.map((x) => x.p95)), totOver = rounds.reduce((a, b) => a + b.over, 0);
  console.log(`   → P95 中位=${pct(rounds.map(x => x.p95), 50).toFixed(1)}ms 【最差=${worst.toFixed(1)}ms】 超2s=${totOver}/100  ${worst < 2000 && totOver === 0 ? `✅ PASS（余量 ${(2000 / worst).toFixed(1)}x）` : '❌ FAIL'}\n`);
}

console.log('=== (3) 验证 Tester §七 阻塞级发现：字符串型 L1 会误判普通除法为 recip ===');
const suspect = '(6/(1/(8-4)))';
console.log(`no_unary solver 可产出的式子: ${suspect}`);
console.log(`  含子串 "(1/(" ? ${suspect.includes('(1/(')} → 字符串型 L1 判定为【含 recip 单目】= PASS`);
// AST 真相：6/(1/(8-4)) 中的 1/(8-4) 是普通除法 num(1) / bin(8-4)，非 rec 节点
const astTruth = { k: 'bin', op: '/', a: { k: 'num', val: 6 }, b: { k: 'bin', op: '/', a: { k: 'num', val: 1 }, b: { k: 'bin', op: '-', a: { k: 'num', val: 8 }, b: { k: 'num', val: 4 } } } };
const v = evalT(astTruth);
console.log(`  AST 真相: bin(/) 顶层, 右子树 bin(/) 分子 num(1) —— 无 rec 节点`);
console.log(`  hasRec(AST) = ${hasRec(astTruth)}  hasAbs(AST) = ${hasAbs(astTruth)}  求值 = ${v.n}/${v.d} = ${v.n / v.d}`);
console.log(`  → ${hasRec(astTruth) === false ? '🔴 Tester 主张成立：字符串 L1 误判，AST 判定正确' : '主张不成立'}`);
console.log(`  → v3 必须在 solver 输出契约中带 usedAbs/usedRecip/单目节点位置，L1 禁字符串匹配`);
console.log('\n=== 结论 ===');
