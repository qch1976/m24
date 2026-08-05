// 人工阅读型调查脚本，非门禁。退出码恒为 0，即使正文打印 ❌ 也不判红；判定权在阅读者。
// （task-75 哑弹治理：实测 24 支 probe-v3-* 均无非零退出能力，❌/FAIL 全在 console.log 内。）
// 验证强命题：|x| 是否能让「原本无解」的牌组变可解？
// 命题 A：{有 abs 解的牌组} ⊆ {有初级解的牌组}
// 命题 B（更强）：abs 永不扩大可解集 —— 理由：|X|=24 ⟺ X=24 或 X=-24；
//   而 24点表达式集合对取负封闭（a-b ↔ b-a 可互换），故 X=-24 时存在等价初级式 =24
// 同时对比 1/x：1/x 是否能扩大可解集？（这决定 R-04 两符号的验收强度差异）

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
  : t.k === 'abs' ? `|${show(t.a)}|`
  : t.k === 'rec' ? `(1/${show(t.a)})`
  : `(${show(t.a)}${t.op}${show(t.b)})`;
function evalT(t) {
  if (t.k === 'num') return F(t.val);
  if (t.k === 'abs') { const v = evalT(t.a); return v && F(Math.abs(v.n), v.d); }
  if (t.k === 'rec') { const v = evalT(t.a); return v && v.n !== 0 ? F(v.d, v.n) : null; }
  const a = evalT(t.a), b = evalT(t.b);
  if (!a || !b) return null;
  return BIN.find(([o]) => o === t.op)[1](a, b);
}

// 通用求解：mode = 'primary' | 'abs' | 'recip' | 'both'
function solvable(nums, mode) {
  let hit = null;
  const vars = (v, t) => {
    const o = [{ v, t }];
    if ((mode === 'abs' || mode === 'both') && v.n < 0) o.push({ v: F(-v.n, v.d), t: { k: 'abs', a: t } });
    if ((mode === 'recip' || mode === 'both') && v.n !== 0 && !(Math.abs(v.n) === 1 && v.d === 1))
      o.push({ v: F(v.d, v.n), t: { k: 'rec', a: t } });
    return o;
  };
  const dfs = (items) => {
    if (hit) return true;
    if (items.length === 1) {
      for (const c of vars(items[0].v, items[0].t)) if (is24(c.v)) { hit = c.t; return true; }
      return false;
    }
    const n = items.length;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      if (i === j) continue;
      const rest = items.filter((_, k) => k !== i && k !== j);
      for (const a of vars(items[i].v, items[i].t)) for (const b of vars(items[j].v, items[j].t))
        for (const [op, fn] of BIN) {
          const v = fn(a.v, b.v);
          if (!v) continue;
          if (dfs([{ v, t: { k: 'bin', op, a: a.t, b: b.t } }, ...rest])) return true;
        }
    }
    return false;
  };
  dfs(nums.map((x) => ({ v: F(x), t: { k: 'num', val: x } })));
  return hit;
}

console.log('=== 命题验证：各符号能否扩大「可解牌组」集合（1~13 全部 C(13+3,4)=1820 组）===\n');
let total = 0, pOnly = 0, absGain = [], recGain = [], bothGain = [];
for (let a = 1; a <= 13; a++) for (let b = a; b <= 13; b++) for (let c = b; c <= 13; c++) for (let d = c; d <= 13; d++) {
  const deck = [a, b, c, d]; total++;
  const p = solvable(deck, 'primary');
  if (p) { pOnly++; continue; }
  // 该牌组无初级解，看单目能否救活
  const ab = solvable(deck, 'abs');
  const rc = solvable(deck, 'recip');
  const bo = solvable(deck, 'both');
  if (ab) absGain.push({ deck, t: ab });
  if (rc) recGain.push({ deck, t: rc });
  if (bo && !ab && !rc) bothGain.push({ deck, t: bo });
}
console.log(`总牌组数            = ${total}`);
console.log(`有初级解            = ${pOnly}`);
console.log(`无初级解            = ${total - pOnly}`);
console.log('');
console.log(`无初级解但 |x| 可救活   = ${absGain.length} 组  ${absGain.length === 0 ? '→ ★ |x| 不扩大可解集（可解性冗余）' : ''}`);
console.log(`无初级解但 1/x 可救活   = ${recGain.length} 组  ${recGain.length > 0 ? '→ ★ 1/x 真正扩大可解集' : ''}`);
console.log(`需 |x|+1/x 联合才救活   = ${bothGain.length} 组`);
console.log('');
if (recGain.length) {
  console.log('--- 1/x 救活的牌组（这些才是 R-04「无初级解但有高级解」的真实种子）Top 15 ---');
  for (const g of recGain.slice(0, 15)) {
    const v = evalT(g.t);
    console.log(`  [${g.deck}] → ${show(g.t)} = ${v.n / v.d} ${v.n / v.d === 24 ? '✅' : '❌'}`);
  }
  console.log(`  ... 共 ${recGain.length} 组`);
}
if (absGain.length) {
  console.log('\n--- |x| 救活的牌组 ---');
  for (const g of absGain.slice(0, 10)) console.log(`  [${g.deck}] → ${show(g.t)}`);
}
if (bothGain.length) {
  console.log('\n--- 需联合才救活 ---');
  for (const g of bothGain.slice(0, 10)) console.log(`  [${g.deck}] → ${show(g.t)}`);
}
