// selftest/selftest_task113_hintpace.mjs
// task-113 GUI-4：仅高级解牌组的提示节奏必须与初级解一致（逐步给）
//
// 项目主实机：{5,8,9,10} 按提示键「一下子显示出 2 步」。
//
// 根因（我 task-111 引入）：advPostOrderSteps 的 isAtom 把 recip/fact/mod 三者
//   一并当原子叶子，但三者【元数不同】：
//     recip/fact = {op,arg} 一元（只变形 1 张牌，不占玩家一步）⇒ 当叶子正确
//     mod        = {op,a,b} 二元（吃掉 2 张牌，本身即一次运算）⇒ 当叶子就会被
//       吸收进父节点那一步 ⇒ 同一步做两次运算（(5%8)+9=14），4 张牌只剩 2 步。
//
// 🔴 判据取直接量：
//   - 步数直接数 advPostOrderSteps 返回长度，并用「屏上真实文本」交叉验证
//     （经 mock ctx 读 fillText，不是读源码有没有某个 if）
//   - 「第 3 步永不提示」用连点再提示后的 step 上限验，不是看 UI 有没有画禁用色
import assert from 'assert';
// 用仓库既有 mock ctx，禁依赖临时装的 npm 包（canvas 在服务器/CI 上不存在）
import { createMockCtx } from '../tester/render-smoke/mock-ctx.mjs';

globalThis.wx = {
  getStorageSync: () => '', setStorageSync: () => {},
  getSystemInfoSync: () => ({ windowWidth: 411, windowHeight: 891, pixelRatio: 1, safeArea: { top: 0, bottom: 891 } }),
};
const RS = await import('../js/core/RecipSolver.mjs');
const HM = (await import('../js/ui/HintModal.js')).default;
const GC = (await import('../js/core/GameCore.js')).default;

let pass = 0, fail = 0;
const t = (name, cond, extra) => {
  if (cond) { pass++; console.log(`  PASS ${name}`); }
  else { fail++; console.log(`  FAIL ${name}` + (extra !== undefined ? ` => got: ${JSON.stringify(extra)}` : '')); }
};
// 屏上真实文本（直接量）
const screen = (m) => {
  const c = createMockCtx();
  m.render(c, 411, 891);
  return c.__texts().filter((x) => /步骤|=/.test(x));
};
const advOf = (cards, caps) => {
  const r = RS.solve(cards, { advancedCalc: true, caps });
  const d = RS.buildDisplay(r);
  return { r, d, steps: d.advancedTopNode ? RS.advPostOrderSteps(d.advancedTopNode) : null };
};

// ============ 定界1：初级解节奏 = 基准口径 ============
console.log('=== 定界1：初级解牌组的提示节奏（基准口径）===');
const primPace = (cards) => {
  const gc = new GC();
  gc.currentCardValues = cards.slice();
  gc._computeHintCache();
  const s = [1, 2, 3].map((i) => gc.getHintStep(i));
  const m = new HM();
  m.open([s[0], s[1], s[2]]);
  const first = screen(m);
  m.advanceStep();
  const second = screen(m);
  const before = m.step;
  m.advanceStep();
  return { s, first, second, before, after: m.step };
};
const p1 = primPace([1, 2, 3, 4]);
t('A-1 初级解 getHintStep(1/2/3) 三步齐备', !!(p1.s[0] && p1.s[1] && p1.s[2]), p1.s.map((x) => !!x));
t('A-2 初级：首按提示只显第 1 步（屏上恰 1 条算式）',
  p1.first.filter((x) => /=/.test(x)).length === 1 && /步骤 1\/3/.test(p1.first.join('|')), p1.first);
t('A-3 初级：按再提示后显第 2 步', /步骤 2\/3/.test(p1.second.join('|')), p1.second);
t('A-4 初级：第 3 步永不提示（step 封顶 2）', p1.before === 2 && p1.after === 2, { before: p1.before, after: p1.after });

// ============ 主判据：仅高级解牌组须同节奏 ============
console.log('=== 🔴 GUI-4：{5,8,9,10} 仅高级解，节奏须与初级一致 ===');
const CARDS = [5, 8, 9, 10];
const onlyMod = { capRecip: false, capFact: false, capMod: true };
const A = advOf(CARDS, onlyMod);
t('B-0 前置：{5,8,9,10} 确为「初级解 0 且高级解 >0」',
  A.r.counts.primary === 0 && A.r.counts.advanced > 0, A.r.counts);
t('B-1 前置：该解含 % 记号（否则测不到 mod 成步）', /%/.test(A.d.advancedTop), A.d.advancedTop);
// 🔴 核心：mod 必须单独成步 ⇒ 4 张牌 3 个二元运算 ⇒ 3 步
t('B-2 🔴 步数=3（mod 单独成步，不被吸收进父节点那一步）',
  A.steps && A.steps.length === 3, A.steps && A.steps.length);
t('B-3 🔴 第 1 步是 mod 本身，且只做一次运算（不是 (5%8)+9）',
  !!A.steps && A.steps[0].op === '%' && String(A.steps[0].lhs) === '5' && String(A.steps[0].rhs) === '8',
  A.steps && A.steps[0]);
t('B-4 展示符用 %，不泄露内部枚举名 mod',
  !!A.steps && !A.steps.some((s) => /mod/.test(`${s.lhs}${s.op}${s.rhs}`)),
  A.steps && A.steps.map((s) => s.op));
t('B-5 末步结果为 24', !!A.steps && String(A.steps[A.steps.length - 1].result) === '24',
  A.steps && A.steps[A.steps.length - 1].result);

// 逐步节奏（屏上真实文本）
console.log('=== 🔴 逐步节奏：首按只 1 步 → 再提示才第 2 步 → 第 3 步永不给 ===');
const m2 = new HM();
m2.open([A.steps[0], A.steps[1], A.steps[2] || null]);
const f1 = screen(m2);
t('C-1 首按「提示」屏上恰 1 条算式（不是一次吐 2 步）',
  f1.filter((x) => /=/.test(x)).length === 1, f1);
t('C-2 首按显示的是第 1 步（5 % 8 = 5）', /5 % 8 = 5/.test(f1.join('|')), f1);
t('C-3 首按标题为「提示步骤 1/3」', /步骤 1\/3/.test(f1.join('|')), f1);
m2.advanceStep();
const f2 = screen(m2);
t('C-4 按「再提示」后显示第 2 步', /步骤 2\/3/.test(f2.join('|')) && /= 14/.test(f2.join('|')), f2);
t('C-5 第 2 屏仍只 1 条算式', f2.filter((x) => /=/.test(x)).length === 1, f2);
const b2 = m2.step;
m2.advanceStep();
t('C-6 🔴 第 3 步永不提示（连点再提示 step 仍封顶 2）', b2 === 2 && m2.step === 2, { b2, after: m2.step });
t('C-7 第 3 步内容存在于 _steps 但不展示（数据齐备，仅不给）',
  !!m2._steps[2] && !/= 24/.test(screen(m2).join('|')), { third: !!m2._steps[2] });

// 与初级解逐步对齐（同一口径）
t('D-1 🔴 与初级解节奏逐步对齐：两者首屏都恰 1 条算式',
  f1.filter((x) => /=/.test(x)).length === p1.first.filter((x) => /=/.test(x)).length, null);
t('D-2 🔴 与初级解对齐：两者 step 上限都是 2', m2.step === p1.after, { adv: m2.step, prim: p1.after });

// ============ recip/fact 仍作一元叶子（不得反向改坏）============
console.log('=== recip/fact 是一元变形，不得单独成步（反向保护）===');
const R = advOf([5, 8, 9, 10], { capRecip: true, capFact: false, capMod: false });
t('E-1 含倒数的解仍为 3 步（recip 不占步，因仍有 3 个二元运算）',
  R.steps && R.steps.length === 3, R.steps && R.steps.length);
t('E-2 倒数解无任何一步的 op 是 recip', !!R.steps && !R.steps.some((s) => s.op === 'recip'),
  R.steps && R.steps.map((s) => s.op));
const Fc = advOf([1, 2, 3, 4], { capRecip: false, capFact: true, capMod: false });
t('E-3 含阶乘的解步数=3 且无一步 op 是 fact',
  !!Fc.steps && Fc.steps.length === 3 && !Fc.steps.some((s) => s.op === 'fact'),
  Fc.steps && { n: Fc.steps.length, ops: Fc.steps.map((s) => s.op) });

// ============ 全牌组不变式：任何高级解都不得 <2 步 ============
// <2 步会掉进 PageRenderer 的降级分支（把整条算式塞 lhs）⇒ GUI-1 缺陷复发。
console.log('=== 全牌组扫描：高级解步数恒 =3，无一组 <2（防 GUI-1 复发）===');
const hist = {};
let scanned = 0, under2 = 0;
for (let a = 1; a <= 13; a++) for (let b = a; b <= 13; b++) for (let c = b; c <= 13; c++) for (let d = c; d <= 13; d++) {
  const r = RS.solve([a, b, c, d], { advancedCalc: true });
  const dp = RS.buildDisplay(r);
  if (!dp.advancedTop) continue;
  scanned++;
  const n = RS.advPostOrderSteps(dp.advancedTopNode).length;
  hist[n] = (hist[n] || 0) + 1;
  if (n < 2) under2++;
}
console.log(`    扫描 ${scanned} 组，步数分布 ${JSON.stringify(hist)}`);
t('F-1 有高级解的牌组数 >1000（坐实扫描确实跑了）', scanned > 1000, scanned);
t('F-2 🔴 无任何牌组步数 <2（不会掉进「高级解法：整条」降级分支）', under2 === 0, under2);
t('F-3 🔴 步数分布恒为 {3:N}（4 张牌必有 3 个二元运算）',
  Object.keys(hist).length === 1 && hist[3] === scanned, hist);

// ============ 条款 8 ============
const EXPECTED_ASSERTION_COUNT = 25;
console.log(`\npass=${pass} fail=${fail}`);
if (pass + fail !== EXPECTED_ASSERTION_COUNT) {
  console.log(`\n🔴 FAIL 条款8 断言总数不符：期望 ${EXPECTED_ASSERTION_COUNT}，实际 ${pass + fail}`);
  process.exit(2);
}
console.log(`条款8 断言总数核对：${pass + fail} == 期望 ${EXPECTED_ASSERTION_COUNT} ✅`);
assert.strictEqual(fail, 0, `${fail} 条断言失败`);
console.log('ALL PASS');
