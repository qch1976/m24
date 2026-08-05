// 人工阅读型调查脚本，非门禁。退出码恒为 0，即使正文打印 ❌ 也不判红；判定权在阅读者。
// （task-75 哑弹治理：实测 24 支 probe-v3-* 均无非零退出能力，❌/FAIL 全在 console.log 内。）
// 验证 Manager 新增的 abs 基准用例，并澄清「必需性」的两种口径
// Manager: [1,4,6,8] → (|4-6|+1)*8 = 24，称 abs「必需，非装饰」（去掉 abs 后 =-8≠24）
// 需澄清：表达式级必需 ≠ 牌局级必需。后者才决定 R-04 强口径能否成立。

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
// 剥掉所有 abs 节点
function stripAbs(t) {
  if (t.k === 'num') return t;
  if (t.k === 'abs') return stripAbs(t.a);
  if (t.k === 'rec') return { k: 'rec', a: stripAbs(t.a) };
  return { k: 'bin', op: t.op, a: stripAbs(t.a), b: stripAbs(t.b) };
}
const N = (v) => ({ k: 'num', val: v });
const B = (op, a, b) => ({ k: 'bin', op, a, b });
const ABS = (a) => ({ k: 'abs', a });
const REC = (a) => ({ k: 'rec', a });

// 纯初级解（不含任何单目）计数
function primaryCount(nums) {
  const found = new Set();
  const ck = (t) => t.k === 'num' ? `n${t.val}` : (() => {
    const a = ck(t.a), b = ck(t.b);
    return (t.op === '+' || t.op === '*') ? (a <= b ? `(${a}${t.op}${b})` : `(${b}${t.op}${a})`) : `(${a}${t.op}${b})`;
  })();
  (function dfs(items) {
    if (items.length === 1) { if (is24(items[0].v)) found.add(ck(items[0].t)); return; }
    const n = items.length;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      if (i === j) continue;
      const rest = items.filter((_, k) => k !== i && k !== j);
      for (const [op, fn] of BIN) {
        const v = fn(items[i].v, items[j].v);
        if (!v) continue;
        dfs([{ v, t: { k: 'bin', op, a: items[i].t, b: items[j].t } }, ...rest]);
      }
    }
  })(nums.map((x) => ({ v: F(x), t: N(x) })));
  return found.size;
}

console.log('=== 验证 Manager 新增的 abs 基准用例 ===\n');

const CASES = [
  { name: 'Manager 主用例', deck: [1, 4, 6, 8], tree: B('*', B('+', ABS(B('-', N(4), N(6))), N(1)), N(8)) },
  { name: 'Manager 备选', deck: [2, 3, 4, 6], tree: B('*', B('+', ABS(B('-', N(2), N(4))), N(6)), N(3)) },
  { name: 'Architect ABS-1', deck: [1, 1, 1, 13], tree: ABS(B('*', B('-', N(1), N(13)), B('+', N(1), N(1)))) },
];

for (const c of CASES) {
  const v = evalT(c.tree);
  const stripped = stripAbs(c.tree);
  const sv = evalT(stripped);
  // 牌位使用核对
  const used = [];
  (function collect(t) {
    if (t.k === 'num') { used.push(t.val); return; }
    if (t.k === 'abs' || t.k === 'rec') return collect(t.a);
    collect(t.a); collect(t.b);
  })(c.tree);
  const deckSorted = [...c.deck].sort((a, b) => a - b).join(',');
  const usedSorted = [...used].sort((a, b) => a - b).join(',');
  console.log(`${c.name}  deck=[${c.deck}]`);
  console.log(`  表达式: ${show(c.tree)}`);
  console.log(`  独立复算 = ${v.n}/${v.d} = ${v.n / v.d}  ${v.n / v.d === 24 ? '✅ =24' : '❌'}`);
  console.log(`  牌位核对: 用了 [${usedSorted}] vs 牌组 [${deckSorted}]  ${usedSorted === deckSorted ? '✅ 各用1次' : '❌ 不符'}`);
  console.log(`  剥掉 abs 后: ${show(stripped)} = ${sv ? sv.n / sv.d : 'invalid'}  → 表达式级 abs 必需: ${sv && sv.n / sv.d === 24 ? '❌ 装饰性' : '✅ 必需'}`);
  console.log(`  该牌组初级解数 = ${primaryCount(c.deck)}  → 牌局级 abs 必需（无初级解）: ${primaryCount(c.deck) === 0 ? '✅' : '❌ 该局本来就有初级解'}`);
  console.log('');
}

console.log('=== 两种「必需性」口径的区别（决定 R-04 强/弱口径）===\n');
console.log('口径1「表达式级必需」：该表达式内剥掉 abs 后 ≠24 → Manager 用的口径');
console.log('口径2「牌局级必需」：该牌组无初级解，玩家必须用 abs 才能解出 → R-04 强口径隐含要求');
console.log('');
console.log('★ 关键：我 12:36 穷举 1820 牌组已证明 —— 口径2 对 |x| 恒不可满足（0 组）。');
console.log('  因此 Manager 补的 abs 用例只能满足口径1，这是 |x| 能达到的最强形式，已足够。');
console.log('  但 R-04「每符号 ≥3 组」若隐含口径2，|x| 分支仍会永远 FAIL → 开放项 C 仍需裁决。');
