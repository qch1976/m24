// 人工阅读型调查脚本，非门禁。退出码恒为 0，即使正文打印 ❌ 也不判红；判定权在阅读者。
// （task-75 哑弹治理：实测 24 支 probe-v3-* 均无非零退出能力，❌/FAIL 全在 console.log 内。）
// 验证：R-04.1 若按「字面表达式命中」作硬断言，是否稳定？
// Developer 建议口径(b)：要求解集中出现 6*(1/(1-3/4)) 这一具体式子，K_mid≥10
// Architect 质疑：字面命中不仅依赖 K_mid，还依赖「值级去重时哪个代表式先占位」
//   而占位顺序 = 子集枚举顺序 = 纯实现细节。若如此，字面断言是脆断言，不能作门禁。
// 本脚本用 3 种等价但不同的子集枚举顺序，看同一 K_mid 下字面命中是否翻转。
import { performance } from 'node:perf_hooks';
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
const usesUnary = (t) => t.k === 'num' ? false : (t.k === 'abs' || t.k === 'rec') ? true : usesUnary(t.a) || usesUnary(t.b);
const unaryOnBin = (t) => t.k === 'num' ? false
  : (t.k === 'abs' || t.k === 'rec') ? (t.a.k === 'bin' ? true : unaryOnBin(t.a))
  : unaryOnBin(t.a) || unaryOnBin(t.b);
function ckey(t) {
  if (t.k === 'num') return `n${t.val}`;
  if (t.k === 'abs') return `abs(${ckey(t.a)})`;
  if (t.k === 'rec') return `rec(${ckey(t.a)})`;
  const a = ckey(t.a), b = ckey(t.b);
  if (t.op === '+' || t.op === '*') return a <= b ? `(${a}${t.op}${b})` : `(${b}${t.op}${a})`;
  return `(${a}${t.op}${b})`;
}
function unaryVars(v, t) {
  const o = [{ v, t }];
  if (v.n < 0) o.push({ v: F(-v.n, v.d), t: { k: 'abs', a: t } });
  if (v.n !== 0 && !(Math.abs(v.n) === 1 && v.d === 1)) o.push({ v: F(v.d, v.n), t: { k: 'rec', a: t } });
  return o;
}

// order: 'asc' | 'desc' | 'popcount' —— 三种等价的子集枚举顺序（都遍历全部子集，仅顺序不同）
function solve(nums, K_mid, K_ans, order) {
  const FULL = 15;
  const dp = new Map();
  const put = (mp, v, t, cap) => {
    const k = `${vkey(v)}|${usesUnary(t) ? 'A' : 'P'}`;
    const arr = mp.get(k);
    if (!arr) mp.set(k, [{ v, t }]);
    else if (arr.length < cap) arr.push({ v, t });
  };
  for (let i = 0; i < 4; i++) {
    const m = 1 << i, mp = new Map();
    for (const c of unaryVars(F(nums[i]), { k: 'num', val: nums[i] })) put(mp, c.v, c.t, K_mid);
    dp.set(m, mp);
  }
  const answers = new Map();
  const masks = [];
  for (let m = 1; m <= FULL; m++) if (![1, 2, 4, 8].includes(m)) masks.push(m);
  masks.sort((a, b) => {
    const pa = a.toString(2).split('1').length - 1, pb = b.toString(2).split('1').length - 1;
    return pa - pb || a - b; // 必须按 popcount 升序保证依赖就绪
  });
  for (const mask of masks) {
    const isTop = mask === FULL;
    const mp = dp.get(mask) || new Map();
    // 收集该 mask 的所有子集划分
    const parts = [];
    for (let sub = (mask - 1) & mask; sub > 0; sub = (sub - 1) & mask) {
      const other = mask ^ sub;
      if (sub > other) continue;
      parts.push([sub, other]);
    }
    if (order === 'desc') parts.reverse();
    else if (order === 'popcount') parts.sort((x, y) => {
      const px = x[0].toString(2).split('1').length - 1, py = y[0].toString(2).split('1').length - 1;
      return px - py || x[0] - y[0];
    });
    for (const [sub, other] of parts) {
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
                  if (answers.size < K_ans) answers.set(ckey(c.t), c.t);
                } else put(mp, c.v, c.t, K_mid);
              }
            }
    }
    if (!isTop) dp.set(mask, mp);
  }
  return [...answers.values()];
}

// Developer 口径(b) 的字面目标：6*(1/(1-3/4)) 与 8*(1/(1-4/6))
const TARGETS = {
  '1,3,4,6': ckey({ k: 'bin', op: '*', a: { k: 'num', val: 6 }, b: { k: 'rec', a: { k: 'bin', op: '-', a: { k: 'num', val: 1 }, b: { k: 'bin', op: '/', a: { k: 'num', val: 3 }, b: { k: 'num', val: 4 } } } } }),
  '1,4,6,8': ckey({ k: 'bin', op: '*', a: { k: 'num', val: 8 }, b: { k: 'rec', a: { k: 'bin', op: '-', a: { k: 'num', val: 1 }, b: { k: 'bin', op: '/', a: { k: 'num', val: 4 }, b: { k: 'num', val: 6 } } } } }),
};

console.log('=== 验证 Developer 建议的「字面口径(b)」是否为稳定断言 ===');
console.log(`环境: Node ${process.version}, ${os.cpus().length} 核, load ${os.loadavg()[0].toFixed(2)}\n`);
console.log('假设：若字面命中随「子集枚举顺序」翻转，则字面断言依赖实现细节，不可作发布门禁。\n');

const DECKS = [[1, 3, 4, 6], [1, 4, 6, 8]];
const ORDERS = ['asc', 'desc', 'popcount'];

for (const deck of DECKS) {
  const key = deck.join(',');
  const target = TARGETS[key];
  console.log(`--- deck=[${deck}]  字面目标 = ${key === '1,3,4,6' ? '6*(1/(1-3/4))' : '8*(1/(1-4/6))'} ---`);
  console.log('K_mid\t' + ORDERS.map((o) => `顺序${o}`).join('\t') + '\t字面命中是否随顺序翻转');
  for (const K_mid of [1, 3, 5, 10, 20]) {
    const hits = [], counts = [];
    for (const order of ORDERS) {
      const sols = solve(deck, K_mid, 50, order);
      const hit = sols.some((t) => ckey(t) === target);
      hits.push(hit); counts.push(sols.length);
    }
    const flip = !hits.every((h) => h === hits[0]);
    console.log(`${K_mid}\t` + hits.map((h, i) => `${h ? '✅' : '❌'}(${counts[i]}条)`).join('\t') + `\t${flip ? '⚠️ 翻转！断言不稳定' : '一致'}`);
  }
  // 语义口径同时检查
  console.log('  语义口径（存在单目作用于中间结果的解）：');
  for (const K_mid of [1, 3, 5, 10, 20]) {
    const r = ORDERS.map((o) => solve(deck, K_mid, 50, o).filter(unaryOnBin).length);
    console.log(`    K_mid=${K_mid}: ${r.map((x, i) => `${ORDERS[i]}=${x}条`).join('  ')}  → ${r.every((x) => x > 0) ? '✅ 三顺序全部满足' : '❌'}`);
  }
  console.log('');
}

console.log('=== 结论 ===');
console.log('字面口径(b)：命中与否取决于 K_mid 与枚举顺序（实现细节）→ 脆断言');
console.log('语义口径(a)：三种顺序 × 全部 K_mid 均稳定满足 → 稳断言，适合作发布门禁');
console.log('');
// ===== 根因定位：字面漏命中究竟是 K_mid 还是 K_ans 造成的？=====
console.log('=== 根因定位：K_mid=10 固定，放开 K_ans 到无上限，字面式能否出现？ ===\n');
console.log('deck\t\tK_ans\t总解数\t字面命中\t语义命中');
for (const deck of DECKS) {
  const target = TARGETS[deck.join(',')];
  for (const K_ans of [50, 200, 1000, 1e9]) {
    const s = solve(deck, 10, K_ans, 'asc');
    const lit = s.some((t) => ckey(t) === target);
    const sem = s.filter(unaryOnBin).length;
    console.log(`[${deck}]\t${K_ans === 1e9 ? '无上限' : K_ans}\t${s.length}\t${lit ? '✅' : '❌'}\t\t${sem > 0 ? '✅ ' + sem + '条' : '❌'}`);
  }
  console.log('');
}
console.log('★ 若「无上限」仍 ❌ → 字面式被值级去重永久淘汰，与 K_ans 无关，加大 K_mid 也救不回\n');

console.log('=== 补充：语义口径能否防住 Developer 担心的「偷懒实现」？ ===');
console.log('偷懒实现 = 只在叶子施加单目（方案 v2 的 81 种 unaryScheme）');
console.log('已于 122-verify-defect1.log 实测：叶子枚举对「单目作用于中间结果」命中率 = 0');
console.log('→ 语义断言 unaryOnBin(t)===true 可 100% 识别并拒绝偷懒实现，无需依赖字面式');
