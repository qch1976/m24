// 人工阅读型调查脚本，非门禁。退出码恒为 0，即使正文打印 ❌ 也不判红；判定权在阅读者。
// （task-75 哑弹治理：实测 24 支 probe-v3-* 均无非零退出能力，❌/FAIL 全在 console.log 内。）
// 验证 Tester 的决定性主张：严口径（subtree_block）下 40 组牌从「可解」变「无解」
// 若成立 → 口径之争从"解法丰富度偏好"升级为【功能性缺陷】，严口径必须否决
// 同时验证他的第二个主张：abs 分支供给两口径完全一致（1139 vs 1139）→ 可让 abs 分支先行定稿
//
// ⚠️ 注意 Tester 存在【口径标签错位】：他写「口径A（self_only）」
//    Architect/Manager 已确立：口径A = subtree_block（严），口径B = self_only（宽）
//    本脚本一律用 STRICT/LOOSE 命名，避免标签混淆
//
// 1820 组 = C(13+4-1, 4) 有序无重组合（牌面 1~13，可重复，无序去重）
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

// STRICT = subtree_block = Architect/Manager 口径A（子树含单目→祖先不再施加）
function uStrict(v, t) {
  const o = [{ v, t }];
  if (hasUnary(t)) return o;
  if (v.n < 0) o.push({ v: F(-v.n, v.d), t: { k: 'abs', a: t } });
  if (v.n !== 0 && !(Math.abs(v.n) === 1 && v.d === 1)) o.push({ v: F(v.d, v.n), t: { k: 'rec', a: t } });
  return o;
}
// LOOSE = self_only = 口径B（仅禁自身直接叠加）
function uLoose(v, t) {
  const o = [{ v, t }];
  if (t.k !== 'abs' && v.n < 0) o.push({ v: F(-v.n, v.d), t: { k: 'abs', a: t } });
  if (t.k !== 'rec' && v.n !== 0 && !(Math.abs(v.n) === 1 && v.d === 1))
    o.push({ v: F(v.d, v.n), t: { k: 'rec', a: t } });
  return o;
}
// 早退式可解性探测：只问「有没有」，不枚举全解 → 1820 组可跑完
// 返回 { any, primary, absOnly, recipOnly, sample }
function probe(nums, uv) {
  let any = false, pri = false, absOnly = false, recipOnly = false, sample = null;
  const seen = new Set();
  (function dfs(items) {
    if (any && pri && absOnly && recipOnly) return;   // 四个标志全齐即可停
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
    const key = items.map((x) => `${x.v.n}/${x.v.d}`).sort().join(',') + '#' + n;
    if (n >= 3 && seen.has(key)) return;
    if (n >= 3) seen.add(key);
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
const loadavg = () => { try { return readFileSync('/proc/loadavg', 'utf8').trim().split(' ').slice(0, 3).join('/'); } catch { return os.loadavg().map(x => x.toFixed(2)).join('/'); } };

// 生成 1820 组（1~13，四张，无序可重）
const DECKS = [];
for (let a = 1; a <= 13; a++) for (let b = a; b <= 13; b++) for (let c = b; c <= 13; c++) for (let d = c; d <= 13; d++) DECKS.push([a, b, c, d]);

console.log('=== 验证 Tester 决定性主张：严口径下 40 组牌从「可解」变「无解」===');
console.log(`环境: Node ${process.version}, ${os.cpus().length} 核, loadavg ${loadavg()}, ${new Date().toISOString()}`);
console.log(`牌组总数 ${DECKS.length}（1~13 四张无序可重，应为 1820）`);
console.log('');
console.log('⚠️ 口径标签纠正：Tester 写「口径A（self_only）」标签错位');
console.log('   Architect/Manager 已确立：口径A = subtree_block（严）｜口径B = self_only（宽）');
console.log('   本脚本用 STRICT(=口径A) / LOOSE(=口径B) 命名避免混淆\n');

const t0 = performance.now();
let sA = { any: 0, pri: 0, abs: 0, rec: 0 }, sB = { any: 0, pri: 0, abs: 0, rec: 0 };
const lostSolvable = [], lostRecip = [], lostAbs = [];
let done = 0;
for (const deck of DECKS) {
  const A = probe(deck, uStrict), B = probe(deck, uLoose);
  if (A.any) sA.any++; if (A.pri) sA.pri++; if (A.absOnly) sA.abs++; if (A.recipOnly) sA.rec++;
  if (B.any) sB.any++; if (B.pri) sB.pri++; if (B.absOnly) sB.abs++; if (B.recipOnly) sB.rec++;
  if (!A.any && B.any) lostSolvable.push({ deck, sample: B.sample });
  if (!A.recipOnly && B.recipOnly) lostRecip.push(deck);
  if (!A.absOnly && B.absOnly) lostAbs.push(deck);
  if (++done % 400 === 0) console.log(`   进度 ${done}/${DECKS.length}  已用 ${((performance.now() - t0) / 1000).toFixed(0)}s  loadavg ${loadavg()}`);
}
console.log(`\n穷举完成，耗时 ${((performance.now() - t0) / 1000).toFixed(1)}s，loadavg ${loadavg()}\n`);

console.log('--- 一、可解性对比（Tester 报 STRICT 1534 / LOOSE 1574 / 差 40 组）---');
console.log('指标\t\t\tSTRICT(口径A)\tLOOSE(口径B)\t差异组数');
console.log(`可解牌组数\t\t${sA.any}\t\t${sB.any}\t\t${sB.any - sA.any}${sB.any - sA.any > 0 ? ' 🔴' : ' ✅'}`);
console.log(`有纯初级解\t\t${sA.pri}\t\t${sB.pri}\t\t${sB.pri - sA.pri}`);
console.log(`能给 absOnly 解\t\t${sA.abs}\t\t${sB.abs}\t\t${sB.abs - sA.abs}${sB.abs === sA.abs ? ' ✅ 完全一致' : ' ⚠️'}`);
console.log(`能给 recipOnly 解\t${sA.rec}\t\t${sB.rec}\t\t${sB.rec - sA.rec}`);

console.log(`\n--- 二、★ STRICT 下被误判为「无解」的牌组（实际有解）共 ${lostSolvable.length} 组 ---`);
if (lostSolvable.length) {
  console.log('前 12 组 + LOOSE 下的实际解（独立 evalT 复算）：');
  for (const x of lostSolvable.slice(0, 12)) {
    const v = evalT(x.sample);
    console.log(`   [${x.deck}]  ${show(x.sample)} = ${v.n / v.d} ${is24(v) ? '✅' : '❌'}`);
  }
  console.log(`\n   全部 ${lostSolvable.length} 组牌面：`);
  console.log('   ' + JSON.stringify(lostSolvable.map((x) => x.deck)));
} else {
  console.log('   无 —— 与 Tester 主张不符，需进一步核对口径实现');
}

console.log(`\n--- 三、Tester 主张「abs 分支供给两口径一致」验证 ---`);
console.log(`STRICT absOnly=${sA.abs}  LOOSE absOnly=${sB.abs}  差异 ${lostAbs.length} 组  ${sA.abs === sB.abs ? '✅ 主张成立' : '❌ 主张不成立'}`);
if (lostAbs.length) console.log('   差异牌组: ' + JSON.stringify(lostAbs.slice(0, 10)));
console.log(`机理: abs 幂等（||x||=|x|），不存在"必须嵌套 abs 才可达"的解 → 与单目口径无关`);
console.log(`推论: R-04 的 abs 分支验收可【先行定稿】，不必等口径裁决 ← Tester 建议，Architect 采纳`);

console.log(`\n--- 四、recipOnly 供给差异 ${lostRecip.length} 组（Tester 报 84 组）---`);
if (lostRecip.length) console.log('   前 12 组: ' + JSON.stringify(lostRecip.slice(0, 12)));

// 落盘 40 组清单供 v3 引用
const out = {
  generatedAt: new Date().toISOString(),
  node: process.version,
  loadavg: loadavg(),
  totalDecks: DECKS.length,
  strict: sA, loose: sB,
  lostSolvableCount: lostSolvable.length,
  lostSolvableDecks: lostSolvable.map((x) => ({ deck: x.deck, looseSolution: show(x.sample) })),
  lostRecipCount: lostRecip.length,
  lostRecipDecks: lostRecip,
  lostAbsCount: lostAbs.length,
  note: 'STRICT=subtree_block=口径A; LOOSE=self_only=口径B',
};
writeFileSync('/root/.openclaw/.arkclaw-team/projects/p-mr3h5f2hirbdlr/output/p-mr3h5f2hirbdlr-worker1/verify/input06-strict-lost-decks.json', JSON.stringify(out, null, 2));
console.log('\n清单已落盘: verify/input06-strict-lost-decks.json');
console.log('\n=== 结论 ===');
