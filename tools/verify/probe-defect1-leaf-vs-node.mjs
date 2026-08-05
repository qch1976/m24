// 人工阅读型调查脚本，非门禁。退出码恒为 0，即使正文打印 ❌ 也不判红；判定权在阅读者。
// （task-75 哑弹治理：本批 probe-* 均无非零退出能力，❌/FAIL 全在 console.log 内。）
// 验证 Manager 缺陷1：叶子 unaryScheme(3^4=81) 是否真的漏解
// 对照：中间节点单目 DFS 是否能找到 6*(1/(1-3/4))
// 纯 Fraction 精确运算，独立实现（不依赖项目 Solver，避免自证）

function F(n, d = 1) {
  if (d === 0) return null;
  if (d < 0) { n = -n; d = -d; }
  const g = gcd(Math.abs(n), d) || 1;
  return { n: n / g, d: d / g };
}
function gcd(a, b) { while (b) { [a, b] = [b, a % b]; } return a; }
const add = (a, b) => F(a.n * b.d + b.n * a.d, a.d * b.d);
const sub = (a, b) => F(a.n * b.d - b.n * a.d, a.d * b.d);
const mul = (a, b) => F(a.n * b.n, a.d * b.d);
const div = (a, b) => (b.n === 0 ? null : F(a.n * b.d, a.d * b.n));
const is24 = (f) => f && f.d !== 0 && f.n === 24 * f.d;

const BIN = [
  ['+', add], ['-', sub], ['*', mul], ['/', div],
];

// ---------- 方案 A：方案 v2 的叶子 unaryScheme 3^4=81 ----------
function unaryLeaf(frac, mode) {
  if (mode === 0) return { v: frac, e: null };
  if (mode === 1) { // abs
    const v = F(frac.n < 0 ? -frac.n : frac.n, frac.d);
    return { v, e: 'abs' };
  }
  if (mode === 2) { // recip
    if (frac.n === 0) return null;
    return { v: F(frac.d, frac.n), e: 'recip' };
  }
  return null;
}

function dfsLeafOnly(items, out) {
  if (items.length === 1) {
    if (is24(items[0].v)) out.push(items[0].e);
    return;
  }
  const n = items.length;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      const rest = items.filter((_, k) => k !== i && k !== j);
      for (const [sym, fn] of BIN) {
        const v = fn(items[i].v, items[j].v);
        if (!v) continue;
        dfsLeafOnly([{ v, e: `(${items[i].e}${sym}${items[j].e})` }, ...rest], out);
      }
    }
  }
}

function solveLeafScheme(nums) {
  const found = new Set();
  for (let s = 0; s < 81; s++) {
    const modes = [Math.floor(s / 27) % 3, Math.floor(s / 9) % 3, Math.floor(s / 3) % 3, s % 3];
    const items = [];
    let bad = false;
    for (let i = 0; i < 4; i++) {
      const r = unaryLeaf(F(nums[i]), modes[i]);
      if (r === null) { bad = true; break; }
      const label = r.e === 'abs' ? `|${nums[i]}|` : r.e === 'recip' ? `(1/${nums[i]})` : `${nums[i]}`;
      items.push({ v: r.v, e: label });
    }
    if (bad) continue;
    const out = [];
    dfsLeafOnly(items, out);
    for (const e of out) found.add(e);
  }
  return found;
}

// ---------- 方案 B：中间节点单目 DFS（v3 拟采用） ----------
// 关键：单目可作用于任意中间结果；必须限制嵌套深度以保证终止
function expand(item, maxUnaryDepth) {
  // 返回 item 本身 + 套 1~maxUnaryDepth 层单目后的所有变体
  const outs = [item];
  let frontier = [item];
  for (let d = 0; d < maxUnaryDepth; d++) {
    const next = [];
    for (const it of frontier) {
      // abs
      if (it.v.n < 0) { // 剪枝：abs 只对负值有意义
        next.push({ v: F(-it.v.n, it.v.d), e: `|${it.e}|`, u: (it.u || 0) + 1 });
      }
      // recip
      if (it.v.n !== 0 && !(Math.abs(it.v.n) === 1 && it.v.d === 1)) { // 剪枝：1/0 无效；1/1=1、1/-1=-1 恒等无意义
        next.push({ v: F(it.v.d, it.v.n), e: `(1/${it.e})`, u: (it.u || 0) + 1 });
      }
    }
    outs.push(...next);
    frontier = next;
  }
  return outs;
}

function dfsNode(items, out, maxUnaryDepth) {
  if (items.length === 1) {
    for (const cand of expand(items[0], maxUnaryDepth)) {
      if (is24(cand.v)) out.push(cand.e);
    }
    return;
  }
  const n = items.length;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      const rest = items.filter((_, k) => k !== i && k !== j);
      const As = expand(items[i], maxUnaryDepth);
      const Bs = expand(items[j], maxUnaryDepth);
      for (const a of As) {
        for (const b of Bs) {
          for (const [sym, fn] of BIN) {
            const v = fn(a.v, b.v);
            if (!v) continue;
            dfsNode([{ v, e: `(${a.e}${sym}${b.e})`, u: 0 }, ...rest], out, maxUnaryDepth);
          }
        }
      }
    }
  }
}

function solveNodeUnary(nums, maxUnaryDepth = 1) {
  const out = [];
  dfsNode(nums.map((x) => ({ v: F(x), e: String(x), u: 0 })), out, maxUnaryDepth);
  return new Set(out);
}

// ---------- 执行验证 ----------
const CASES = [
  { deck: [1, 3, 4, 6], target: '6*(1/(1-3/4))' },
  { deck: [1, 4, 6, 8], target: '8*(1/(1-4/6))' },
  { deck: [3, 8, 8, 3], target: '8*(1/(3-8/3))' },
];

console.log('=== 缺陷1 验证：叶子 unaryScheme vs 中间节点单目 ===\n');
for (const { deck, target } of CASES) {
  const leaf = solveLeafScheme(deck);
  const node = solveNodeUnary(deck, 1);
  // 判定：是否存在含 "(1/(" 的解（即单目作用于中间结果）
  const leafHasMid = [...leaf].some((e) => /\(1\/\([^)]*[-+*/]/.test(e) || /\|\([^)]*[-+*/]/.test(e));
  const nodeHasMid = [...node].some((e) => /\(1\/\([^)]*[-+*/]/.test(e) || /\|\([^)]*[-+*/]/.test(e));
  console.log(`牌组 [${deck}]  目标解形态: ${target}`);
  console.log(`  叶子枚举(81):   解数=${leaf.size}\t含"单目作用于中间结果"的解: ${leafHasMid ? '有' : '无 ❌'}`);
  console.log(`  中间节点DFS(d=1): 解数=${node.size}\t含"单目作用于中间结果"的解: ${nodeHasMid ? '有 ✅' : '无'}`);
  if (nodeHasMid) {
    const sample = [...node].filter((e) => /\(1\/\([^)]*[-+*/]/.test(e)).slice(0, 2);
    console.log(`  中间节点DFS 样例: ${sample.join('  |  ')}`);
  }
  console.log('');
}
