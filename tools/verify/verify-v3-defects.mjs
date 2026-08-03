// v3 验证脚本：缺陷1（漏解）+ 缺陷2（解数爆炸）+ 2s 预算 JS 实测
// 独立 Fraction 实现，构造期打标记（不用正则猜），规范化去重（AST canonical key）

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

// ---- AST canonical key（+ * 子节点排序；abs/recip 为单目节点）----
function key(t) {
  if (t.k === 'num') return `n${t.val}`;
  if (t.k === 'abs') return `abs(${key(t.a)})`;
  if (t.k === 'rec') return `rec(${key(t.a)})`;
  const ka = key(t.a), kb = key(t.b);
  if (t.op === '+' || t.op === '*') {
    return ka <= kb ? `(${ka}${t.op}${kb})` : `(${kb}${t.op}${ka})`;
  }
  return `(${ka}${t.op}${kb})`;
}
function show(t) {
  if (t.k === 'num') return String(t.val);
  if (t.k === 'abs') return `|${show(t.a)}|`;
  if (t.k === 'rec') return `(1/${show(t.a)})`;
  return `(${show(t.a)}${t.op}${show(t.b)})`;
}

// ===== 方案 A：方案 v2 的叶子 unaryScheme（3^4 = 81）=====
function solveLeafOnly(nums) {
  const found = new Map(); // key -> {expr, midUnary}
  for (let s = 0; s < 81; s++) {
    const modes = [Math.floor(s / 27) % 3, Math.floor(s / 9) % 3, Math.floor(s / 3) % 3, s % 3];
    const items = [];
    let bad = false;
    for (let i = 0; i < 4; i++) {
      const base = { v: F(nums[i]), t: { k: 'num', val: nums[i] } };
      if (modes[i] === 0) { items.push(base); continue; }
      if (modes[i] === 1) { // abs（叶子非负，恒等，但方案 v2 照样枚举）
        items.push({ v: F(Math.abs(base.v.n), base.v.d), t: { k: 'abs', a: base.t } });
      } else { // recip
        if (base.v.n === 0) { bad = true; break; }
        items.push({ v: F(base.v.d, base.v.n), t: { k: 'rec', a: base.t } });
      }
    }
    if (bad) continue;
    dfsBinOnly(items, found);
  }
  return found;
}
function dfsBinOnly(items, found) {
  if (items.length === 1) {
    if (is24(items[0].v)) found.set(key(items[0].t), show(items[0].t));
    return;
  }
  const n = items.length;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    if (i === j) continue;
    const rest = items.filter((_, k2) => k2 !== i && k2 !== j);
    for (const [op, fn] of BIN) {
      const v = fn(items[i].v, items[j].v);
      if (!v) continue;
      dfsBinOnly([{ v, t: { k: 'bin', op, a: items[i].t, b: items[j].t } }, ...rest], found);
    }
  }
}

// ===== 方案 B：中间节点单目 DFS（v3）=====
// unary 变体：对任意节点尝试 abs / recip；剪枝 = abs 仅对负值、recip 跳过 0 与 ±1
function variants(it, maxD) {
  const outs = [it];
  let frontier = [it];
  for (let d = 0; d < maxD; d++) {
    const nx = [];
    for (const x of frontier) {
      if (x.v.n < 0) nx.push({ v: F(-x.v.n, x.v.d), t: { k: 'abs', a: x.t } });
      if (x.v.n !== 0 && !(Math.abs(x.v.n) === 1 && x.v.d === 1)) {
        nx.push({ v: F(x.v.d, x.v.n), t: { k: 'rec', a: x.t } });
      }
    }
    outs.push(...nx);
    frontier = nx;
  }
  return outs;
}
function solveNodeUnary(nums, maxD = 1) {
  const found = new Map();
  dfsNode(nums.map((x) => ({ v: F(x), t: { k: 'num', val: x } })), found, maxD);
  return found;
}
function dfsNode(items, found, maxD) {
  if (items.length === 1) {
    for (const c of variants(items[0], maxD)) {
      if (is24(c.v)) found.set(key(c.t), show(c.t));
    }
    return;
  }
  const n = items.length;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    if (i === j) continue;
    const rest = items.filter((_, k2) => k2 !== i && k2 !== j);
    const As = variants(items[i], maxD), Bs = variants(items[j], maxD);
    for (const a of As) for (const b of Bs) for (const [op, fn] of BIN) {
      const v = fn(a.v, b.v);
      if (!v) continue;
      dfsNode([{ v, t: { k: 'bin', op, a: a.t, b: b.t } }, ...rest], found, maxD);
    }
  }
}

// ===== 结构判定：是否存在"单目作用于非叶子节点"的解（构造期判定，不用正则）=====
function hasUnaryOnNonLeaf(t) {
  if (t.k === 'num') return false;
  if (t.k === 'abs' || t.k === 'rec') {
    if (t.a.k === 'bin') return true;            // 单目直接作用于二元中间结果
    return hasUnaryOnNonLeaf(t.a);
  }
  return hasUnaryOnNonLeaf(t.a) || hasUnaryOnNonLeaf(t.b);
}
// 用 key 反推不方便，改为在求解时同时保存 tree
function solveKeepTree(nums, mode, maxD = 1) {
  const found = new Map();
  if (mode === 'leaf') {
    for (let s = 0; s < 81; s++) {
      const modes = [Math.floor(s / 27) % 3, Math.floor(s / 9) % 3, Math.floor(s / 3) % 3, s % 3];
      const items = []; let bad = false;
      for (let i = 0; i < 4; i++) {
        const base = { v: F(nums[i]), t: { k: 'num', val: nums[i] } };
        if (modes[i] === 0) { items.push(base); continue; }
        if (modes[i] === 1) items.push({ v: F(Math.abs(base.v.n), base.v.d), t: { k: 'abs', a: base.t } });
        else { if (base.v.n === 0) { bad = true; break; } items.push({ v: F(base.v.d, base.v.n), t: { k: 'rec', a: base.t } }); }
      }
      if (bad) continue;
      dfsT(items, found, 0, 'leaf');
    }
  } else {
    dfsT(nums.map((x) => ({ v: F(x), t: { k: 'num', val: x } })), found, maxD, 'node');
  }
  return found;
}
function dfsT(items, found, maxD, mode) {
  if (items.length === 1) {
    const cands = mode === 'node' ? variants(items[0], maxD) : [items[0]];
    for (const c of cands) if (is24(c.v)) found.set(key(c.t), c.t);
    return;
  }
  const n = items.length;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    if (i === j) continue;
    const rest = items.filter((_, k2) => k2 !== i && k2 !== j);
    const As = mode === 'node' ? variants(items[i], maxD) : [items[i]];
    const Bs = mode === 'node' ? variants(items[j], maxD) : [items[j]];
    for (const a of As) for (const b of Bs) for (const [op, fn] of BIN) {
      const v = fn(a.v, b.v);
      if (!v) continue;
      dfsT([{ v, t: { k: 'bin', op, a: a.t, b: b.t } }, ...rest], found, maxD, mode);
    }
  }
}

// ===== 执行 =====
const DECKS = [[1, 3, 4, 6], [1, 4, 6, 8], [3, 8, 8, 3], [1, 2, 3, 4], [1, 3, 4, 8]];

console.log('=== 缺陷1：叶子 unaryScheme 是否漏「单目作用于中间结果」的解 ===\n');
for (const deck of DECKS.slice(0, 3)) {
  const t0 = Date.now(); const leaf = solveKeepTree(deck, 'leaf'); const t1 = Date.now();
  const node = solveKeepTree(deck, 'node', 1); const t2 = Date.now();
  const leafMid = [...leaf.values()].filter(hasUnaryOnNonLeaf);
  const nodeMid = [...node.values()].filter(hasUnaryOnNonLeaf);
  console.log(`牌组 [${deck}]`);
  console.log(`  叶子枚举(81):     去重解数=${leaf.size}\t单目作用于中间结果的解=${leafMid.length}\t${t1 - t0}ms`);
  console.log(`  中间节点DFS(d=1): 去重解数=${node.size}\t单目作用于中间结果的解=${nodeMid.length}\t${t2 - t1}ms`);
  if (nodeMid.length) console.log(`  样例: ${nodeMid.slice(0, 2).map(show).join('   |   ')}`);
  // leaf 是否为 node 子集
  const missing = [...node.keys()].filter((k) => !leaf.has(k)).length;
  console.log(`  node 有而 leaf 没有的解数 = ${missing}\n`);
}

console.log('=== 缺陷2 + R-05：解数量与 JS 实测耗时（中间节点 DFS, d=1）===\n');
for (const deck of DECKS) {
  const t0 = process.hrtime.bigint();
  const r = solveNodeUnary(deck, 1);
  const t1 = process.hrtime.bigint();
  console.log(`[${deck}]  去重解数=${String(r.size).padStart(6)}  JS耗时=${Number(t1 - t0) / 1e6}ms`);
}
