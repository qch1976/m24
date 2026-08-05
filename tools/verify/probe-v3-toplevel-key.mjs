// 人工阅读型调查脚本，非门禁。退出码恒为 0，即使正文打印 ❌ 也不判红；判定权在阅读者。
// （task-75 哑弹治理：实测 24 支 probe-v3-* 均无非零退出能力，❌/FAIL 全在 console.log 内。）
// 定位 Developer「二元组键高级解恒为 0、finalCap=50 也是 0」与 Architect「16 条」的 10 倍分歧
// 假设：分歧不在【中间层】去重键，而在【顶层收集键】
//   写法X（Architect）：顶层 mask=FULL 的 24 解按【结构键 ckey】收集 → 每条不同结构的解都留
//   写法Y（Developer 疑似）：顶层也套用同一套 (mask,value) 去重 + keepN 上限
//                            → (FULL,24) 这一个键只留 keepN 条，且初级代表式先占位 → 高级解恒 0
//                            此时放大 finalCap 无效，因为 keepN 已在更早一层截断
// 若假设成立 → 这是第三处独立缺陷位置，v3 必须显式规定「顶层收集键 = 结构键，不复用中间层去重键」
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
const vkey = (f) => `${f.n}/${f.d}`;
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
function unaryVars(v, t) { // 口径A
  const o = [{ v, t }];
  if (hasUnary(t)) return o;
  if (v.n < 0) o.push({ v: F(-v.n, v.d), t: { k: 'abs', a: t } });
  if (v.n !== 0 && !(Math.abs(v.n) === 1 && v.d === 1)) o.push({ v: F(v.d, v.n), t: { k: 'rec', a: t } });
  return o;
}

// keyMode: 'pair' | 'triple'      —— 中间层去重键
// topMode: 'struct' | 'reuse'     —— 顶层收集键：结构键 / 复用中间层去重键+keepN
function solve(nums, keepN, finalCap, keyMode, topMode) {
  const FULL = 15, dp = new Map();
  const mkKey = (v, t) => keyMode === 'pair' ? vkey(v) : `${vkey(v)}|${hasUnary(t) ? 'A' : 'P'}`;
  const put = (mp, v, t) => {
    const k = mkKey(v, t), arr = mp.get(k);
    if (!arr) mp.set(k, [{ v, t }]);
    else if (arr.length < keepN) arr.push({ v, t });
  };
  for (let i = 0; i < 4; i++) {
    const mp = new Map();
    for (const c of unaryVars(F(nums[i]), { k: 'num', val: nums[i] })) put(mp, c.v, c.t);
    dp.set(1 << i, mp);
  }
  const byStruct = new Map();   // 写法X
  const byReuse = new Map();    // 写法Y：键 → 数组（受 keepN 限制）
  const masks = [];
  for (let m = 1; m <= FULL; m++) if (![1, 2, 4, 8].includes(m)) masks.push(m);
  masks.sort((a, b) => (a.toString(2).split('1').length - b.toString(2).split('1').length) || a - b);
  for (const mask of masks) {
    const isTop = mask === FULL, mp = dp.get(mask) || new Map();
    for (let sub = (mask - 1) & mask; sub > 0; sub = (sub - 1) & mask) {
      const other = mask ^ sub;
      if (sub > other) continue;
      const A = dp.get(sub), B = dp.get(other);
      if (!A || !B) continue;
      for (const arrA of A.values()) for (const arrB of B.values())
        for (const ea of arrA) for (const eb of arrB)
          for (const [op, fn] of BIN)
            for (const [x, y, tx, ty] of [[ea.v, eb.v, ea.t, eb.t], [eb.v, ea.v, eb.t, ea.t]]) {
              const v = fn(x, y);
              if (!v) continue;
              const t = { k: 'bin', op, a: tx, b: ty };
              for (const c of unaryVars(v, t)) {
                if (isTop) {
                  if (!is24(c.v)) continue;
                  if (byStruct.size < finalCap) byStruct.set(ckey(c.t), c.t);
                  const k = mkKey(c.v, c.t), arr = byReuse.get(k);
                  if (!arr) byReuse.set(k, [c.t]);
                  else if (arr.length < keepN) arr.push(c.t);
                } else put(mp, c.v, c.t);
              }
            }
    }
    if (!isTop) dp.set(mask, mp);
  }
  const outX = [...byStruct.values()];
  const outY = [...byReuse.values()].flat().slice(0, finalCap);
  return topMode === 'struct' ? outX : outY;
}

console.log('=== 定位 Developer「二元组高级解=0 / 误判40%」与 Architect「16条 / 1.0%」的 10 倍分歧 ===');
console.log(`环境: Node ${process.version}, ${os.cpus().length} 核, load ${os.loadavg()[0].toFixed(2)}, ${new Date().toISOString()}\n`);
console.log('假设：分歧不在【中间层去重键】，而在【顶层收集键】是否复用同一套去重+keepN\n');
console.log('写法X = 顶层按结构键 ckey 收集（Architect）');
console.log('写法Y = 顶层复用 (mask,value) 去重键 + keepN 上限（Developer 疑似）\n');

const DECKS = [[1, 4, 6, 8], [1, 2, 3, 4], [1, 3, 4, 8], [1, 3, 4, 6]];
console.log('Developer 报告值：[1,4,6,8] 二元组 49总/0高级 ｜ [1,2,3,4] 50/0 ｜ [1,3,4,8] 50/0（finalCap=50）\n');
console.log('deck\t\t中间层键\t顶层写法\t总解\t高级解\t与 Dev 报告一致？');
for (const deck of DECKS) {
  for (const keyMode of ['pair', 'triple']) {
    for (const topMode of ['struct', 'reuse']) {
      const s = solve(deck, 1, 50, keyMode, topMode);
      const adv = s.filter(hasUnary).length;
      const match = (keyMode === 'pair' && adv === 0) ? ' ★ 复现 Dev 的 0 高级解' : '';
      console.log(`[${deck}]\t${keyMode === 'pair' ? '二元组' : '三元组'}\t\t${topMode === 'struct' ? '结构键 ' : '复用键 '}\t${s.length}\t${adv}${adv === 0 ? ' ⚠️' : ''}\t${match}`);
    }
  }
  console.log('');
}

console.log('--- 非空性误判率对比（300 组，无截断全量作 ground truth）---');
function gtHasAdv(nums) {
  let found = false;
  (function dfs(items) {
    if (found) return;
    if (items.length === 1) {
      for (const c of unaryVars(items[0].v, items[0].t)) if (is24(c.v) && hasUnary(c.t)) { found = true; return; }
      return;
    }
    const n = items.length;
    for (let i = 0; i < n && !found; i++) for (let j = 0; j < n && !found; j++) {
      if (i === j) continue;
      const rest = items.filter((_, k) => k !== i && k !== j);
      for (const a of unaryVars(items[i].v, items[i].t))
        for (const b of unaryVars(items[j].v, items[j].t))
          for (const [op, fn] of BIN) {
            const v = fn(a.v, b.v);
            if (!v) continue;
            dfs([{ v, t: { k: 'bin', op, a: a.t, b: b.t } }, ...rest]);
          }
    }
  })(nums.map((x) => ({ v: F(x), t: { k: 'num', val: x } })));
  return found;
}
let s1 = 20260801;
const rnd = () => { s1 = (s1 * 1103515245 + 12345) & 0x7fffffff; return s1 / 0x7fffffff; };
const decks300 = Array.from({ length: 300 }, () => Array.from({ length: 4 }, () => 1 + Math.floor(rnd() * 13)));
const gt = decks300.map(gtHasAdv);
console.log('中间层键\t顶层写法\t误判/300\t错误率');
for (const keyMode of ['pair', 'triple']) {
  for (const topMode of ['struct', 'reuse']) {
    let w = 0;
    decks300.forEach((d, i) => { if (solve(d, 1, 50, keyMode, topMode).some(hasUnary) !== gt[i]) w++; });
    console.log(`${keyMode === 'pair' ? '二元组' : '三元组'}\t\t${topMode === 'struct' ? '结构键' : '复用键'}\t\t${w}\t\t${(w / 300 * 100).toFixed(1)}%`);
  }
}
console.log(`\nground truth 有高级解 = ${gt.filter(Boolean).length}/300`);
console.log('\n=== 结论 ===');
console.log('若「二元组+复用键」误判率显著高于「二元组+结构键」→ 顶层收集键是【第三处独立缺陷位置】');
console.log('v3 必须显式规定：顶层 24 解收集使用【结构键】，禁止复用中间层 (mask,value) 去重键与 keepN 上限');
