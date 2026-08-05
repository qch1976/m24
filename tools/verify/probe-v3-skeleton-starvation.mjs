// 人工阅读型调查脚本，非门禁。退出码恒为 0，即使正文打印 ❌ 也不判红；判定权在阅读者。
// （task-75 哑弹治理：实测 24 支 probe-v3-* 均无非零退出能力，❌/FAIL 全在 console.log 内。）
// 自查我 14:50 推荐的方案D 有一个未验证的缺陷：
// 140 日志里我把骨架去重【全局】施加，然后才三桶分桶。
// 但骨架 = 删掉所有单目后的纯二元树 → 一条 |x| 解与一条纯初级解【可能骨架相同】！
//   例：(6/(1-(3/4)))  [纯初级]  骨架 (n6/(n1-(n3/n4)))
//       (6/|(1-(3/4))|) [含|x|]  骨架 (n6/(n1-(n3/n4)))  ← 相同！
// → 全局去重时纯初级解先占位，|x| 桶被饿死 → 面板 [含|x|] 分类恒空
// → 这与我 13:xx 驳回三元组去重键时揪出的【同一类错误】（代表位抢占）
// 本脚本：1820 组全量，对比【全局去重】vs【每桶独立去重】的桶饿死组数
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
function ckey(t) {
  if (t.k === 'num') return `n${t.val}`;
  if (t.k === 'abs') return `abs(${ckey(t.a)})`;
  if (t.k === 'rec') return `rec(${ckey(t.a)})`;
  const a = ckey(t.a), b = ckey(t.b);
  if (t.op === '+' || t.op === '*') return a <= b ? `(${a}${t.op}${b})` : `(${b}${t.op}${a})`;
  return `(${a}${t.op}${b})`;
}
function skeleton(t) {
  if (t.k === 'num') return { k: 'num', val: t.val };
  if (t.k === 'abs' || t.k === 'rec') return skeleton(t.a);
  return { k: 'bin', op: t.op, a: skeleton(t.a), b: skeleton(t.b) };
}
const skey = (t) => ckey(skeleton(t));
function uLoose(v, t) {
  const o = [{ v, t }];
  if (t.k !== 'abs' && v.n < 0) o.push({ v: F(-v.n, v.d), t: { k: 'abs', a: t } });
  if (t.k !== 'rec' && v.n !== 0 && !(Math.abs(v.n) === 1 && v.d === 1))
    o.push({ v: F(v.d, v.n), t: { k: 'rec', a: t } });
  return o;
}
function allSols(nums) {
  const m = new Map();
  (function dfs(items) {
    if (items.length === 1) { for (const c of uLoose(items[0].v, items[0].t)) if (is24(c.v)) m.set(ckey(c.t), c.t); return; }
    const n = items.length;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      if (i === j) continue;
      const rest = items.filter((_, k) => k !== i && k !== j);
      for (const a of uLoose(items[i].v, items[i].t)) for (const b of uLoose(items[j].v, items[j].t))
        for (const [op, fn] of BIN) { const v = fn(a.v, b.v); if (!v) continue; dfs([{ v, t: { k: 'bin', op, a: a.t, b: b.t } }, ...rest]); }
    }
  })(nums.map((x) => ({ v: F(x), t: { k: 'num', val: x } })));
  return [...m.values()];
}
const bucketOf = (t) => !hasUnary(t) ? 'P' : (hasAbs(t) && !hasRec(t)) ? 'B' : (!hasAbs(t) && hasRec(t)) ? 'R' : 'M';
const loadavg = () => { try { return readFileSync('/proc/loadavg', 'utf8').trim().split(' ').slice(0, 3).join('/'); } catch { return os.loadavg().map(x => x.toFixed(2)).join('/'); } };

console.log('=== 自查方案D：全局骨架去重是否会饿死 |x| / 1/x 桶 ===');
console.log(`环境: Node ${process.version}, ${os.cpus().length} 核, loadavg ${loadavg()}, ${new Date().toISOString()}`);
console.log('假设：一条 |x| 解与一条纯初级解可能骨架相同 → 全局去重时纯初级先占位 → |x| 桶恒空');
console.log('这与我驳回三元组去重键时揪出的【代表位抢占】是同一类错误\n');

console.log('--- 0. 先构造最小反例确认机理 ---');
{
  const a = { k: 'bin', op: '/', a: { k: 'num', val: 6 }, b: { k: 'bin', op: '-', a: { k: 'num', val: 1 }, b: { k: 'bin', op: '/', a: { k: 'num', val: 3 }, b: { k: 'num', val: 4 } } } };
  const b = { k: 'bin', op: '/', a: { k: 'num', val: 6 }, b: { k: 'abs', a: { k: 'bin', op: '-', a: { k: 'num', val: 1 }, b: { k: 'bin', op: '/', a: { k: 'num', val: 3 }, b: { k: 'num', val: 4 } } } } };
  const va = evalT(a), vb = evalT(b);
  console.log(`   纯初级: ${show(a)} = ${va.n / va.d}   骨架=${skey(a)}  桶=${bucketOf(a)}`);
  console.log(`   含|x| : ${show(b)} = ${vb.n / vb.d}   骨架=${skey(b)}  桶=${bucketOf(b)}`);
  console.log(`   → 骨架相同? ${skey(a) === skey(b) ? '🔴 是 —— 机理确认，全局去重会灭掉 |x| 那条' : '否'}`);
}

const DECKS = [];
for (let a = 1; a <= 13; a++) for (let b = a; b <= 13; b++) for (let c = b; c <= 13; c++) for (let d = c; d <= 13; d++) DECKS.push([a, b, c, d]);
console.log(`\n--- 1. 1820 组全量：全局去重 vs 每桶独立去重 ---`);
const t0 = performance.now();
let solvable = 0, starvedAny = 0, starvedB = 0, starvedR = 0, starvedP = 0, badRep = 0;
const cases = [];
let sumGlobal = 0, sumPer = 0;
for (const deck of DECKS) {
  const S = allSols(deck);
  if (!S.length) continue;
  solvable++;
  // 原始桶（真值）
  const raw = { P: 0, R: 0, B: 0, M: 0 };
  for (const t of S) raw[bucketOf(t)]++;
  // 方案D-全局：先全局骨架去重，再分桶（140 日志的写法）
  const g = new Map();
  for (const t of S) { const k = skey(t); if (!g.has(k)) g.set(k, t); }
  const gb = { P: 0, R: 0, B: 0, M: 0 };
  for (const t of g.values()) gb[bucketOf(t)]++;
  // 方案D-每桶：先分桶，再各桶内骨架去重
  const per = { P: new Map(), R: new Map(), B: new Map(), M: new Map() };
  for (const t of S) { const b = bucketOf(t), k = skey(t); if (!per[b].has(k)) per[b].set(k, t); }
  const pb = { P: per.P.size, R: per.R.size, B: per.B.size, M: per.M.size };
  sumGlobal += g.size; sumPer += pb.P + pb.R + pb.B + pb.M;
  // 校验代表解仍 =24
  for (const t of g.values()) { const v = evalT(t); if (!v || !is24(v)) badRep++; }
  // 桶饿死：原始非空 → 全局去重后空
  const sB = raw.B > 0 && gb.B === 0, sR = raw.R > 0 && gb.R === 0, sP = raw.P > 0 && gb.P === 0;
  if (sB) starvedB++; if (sR) starvedR++; if (sP) starvedP++;
  if (sB || sR || sP) {
    starvedAny++;
    if (cases.length < 12) cases.push({ deck, raw: { ...raw }, global: { ...gb }, per: pb, starved: [sP ? 'P' : null, sR ? 'R' : null, sB ? 'B' : null].filter(Boolean) });
  }
}
const sec = (performance.now() - t0) / 1000;
console.log(`可解牌组 ${solvable} 组，耗时 ${sec.toFixed(0)}s，loadavg ${loadavg()}`);
console.log(`代表解求值校验：不等于 24 的代表 = ${badRep} ${badRep === 0 ? '✅ 骨架去重不破坏正确性' : '🔴'}`);
console.log(`\n★ 全局骨架去重导致【桶饿死】的牌组数：${starvedAny} 组 / ${solvable} 组 = ${(starvedAny / solvable * 100).toFixed(1)}%`);
console.log(`   其中 |x| 桶被饿死 : ${starvedB} 组`);
console.log(`   其中 1/x 桶被饿死: ${starvedR} 组`);
console.log(`   其中 纯初级桶饿死: ${starvedP} 组`);
console.log(`\n面板总条数（1820 组累计）：全局去重 ${sumGlobal} 条 / 每桶去重 ${sumPer} 条（每桶多 ${(sumPer - sumGlobal)} 条 = +${((sumPer / sumGlobal - 1) * 100).toFixed(1)}%）`);
console.log(`\n--- 2. 饿死样例（原始有该桶解，全局去重后该桶空）---`);
console.log('deck\t\t原始 P/R/B\t全局去重后 P/R/B\t每桶去重 P/R/B\t被饿死桶');
for (const c of cases) console.log(`[${c.deck}]\t${c.raw.P}/${c.raw.R}/${c.raw.B}\t\t${c.global.P}/${c.global.R}/${c.global.B}\t\t\t${c.per.P}/${c.per.R}/${c.per.B}\t\t${c.starved.join(',')}`);
writeFileSync('/root/.openclaw/.arkclaw-team/projects/p-mr3h5f2hirbdlr/output/p-mr3h5f2hirbdlr-worker1/verify/input06-skeleton-starvation.json',
  JSON.stringify({ generatedAt: new Date().toISOString(), solvableDecks: solvable, starvedAny, starvedAbsBucket: starvedB, starvedRecipBucket: starvedR, starvedPrimaryBucket: starvedP, panelTotalGlobal: sumGlobal, panelTotalPerBucket: sumPer, repEvalFailures: badRep, samples: cases }, null, 2));
console.log(`\n判定: ${starvedAny > 0 ? '🔴 方案D 必须改为【先分桶、再桶内骨架去重】，全局去重版本有缺陷' : '✅ 全局去重无饿死风险'}`);
console.log('\n=== 结论 ===');
