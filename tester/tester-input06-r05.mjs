// tester-input06-r05.mjs — R-05 性能独立采样 + R-05.1 静态核查（task-65）
// R-05：随机 50 组牌 P95 solve ≤ 2s（Tester 独立采样，禁拷 Developer benchmark 数字）
// R-05.1：Tester 只做静态核查（动效时长常量 + disable/enable 状态机代码路径）
//         交互层（点击时序/手感/置灰恢复时机）由项目主真机复核，Tester 覆盖度 0%

import { solve, buildDisplay, DISPLAY_LIMIT } from '../js/core/RecipSolver.mjs';
import { mkCounter } from './tester-input06-lib.mjs';
import fs from 'node:fs';

const { ck, done } = mkCounter('R-05 / R-05.1');
console.log('tester-input06-r05.mjs  @ ' + new Date().toISOString());
console.log('node ' + process.version + '  platform=' + process.platform + '/' + process.arch);

// ============================================================
// R-05 · 性能采样（Tester 独立，xorshift32 固定种子可复现）
// ============================================================
console.log('\n' + '='.repeat(70));
console.log('R-05 · 随机 50 组牌 solve+buildDisplay 耗时采样（Tester 独立）');
console.log('='.repeat(70));

let _s = 655360803 >>> 0;
function rnd() { _s ^= _s << 13; _s >>>= 0; _s ^= _s >>> 17; _s ^= _s << 5; _s >>>= 0; return _s / 4294967296; }
const DECK = [];
for (let k = 0; k < 4; k++) for (let v = 1; v <= 13; v++) DECK.push(v);
DECK.push(0, 0);
function dealRandom() {
  const pool = DECK.slice(); const out = [];
  for (let i = 0; i < 4; i++) out.push(pool.splice(Math.floor(rnd() * pool.length), 1)[0]);
  return out;
}

// 预热（排除 JIT 冷启动干扰，但预热样本不计入统计）
for (let i = 0; i < 5; i++) solve(dealRandom());

const N = 50;
const rows = [];
for (let i = 0; i < N; i++) {
  const cards = dealRandom();
  const t0 = process.hrtime.bigint();
  const res = solve(cards);
  const d = buildDisplay(res, DISPLAY_LIMIT);
  const t1 = process.hrtime.bigint();
  const ms = Number(t1 - t0) / 1e6;
  rows.push({ cards, ms, p: res.primary.size, a: res.advanced.size, c: res.counts.cancelled });
}
const times = rows.map((r) => r.ms).sort((x, y) => x - y);
const pick = (q) => times[Math.min(times.length - 1, Math.ceil(q * times.length) - 1)];
const P50 = pick(0.5), P95 = pick(0.95), MAX = times[times.length - 1];
const AVG = times.reduce((a, b) => a + b, 0) / times.length;

console.log('\n  逐组明细（按耗时降序 top-15）：');
console.log('   #  cards                 ms      primary  advanced  cancelled');
[...rows].sort((a, b) => b.ms - a.ms).slice(0, 15).forEach((r, i) => {
  console.log(`  ${String(i + 1).padStart(2)}  ${JSON.stringify(r.cards).padEnd(18)} ${r.ms.toFixed(2).padStart(8)}  ${String(r.p).padStart(7)}  ${String(r.a).padStart(8)}  ${String(r.c).padStart(9)}`);
});
console.log(`\n  N=${N}  AVG=${AVG.toFixed(2)}ms  P50=${P50.toFixed(2)}ms  P95=${P95.toFixed(2)}ms  MAX=${MAX.toFixed(2)}ms`);
ck(`R-05 P95 = ${P95.toFixed(2)}ms ≤ 2000ms`, P95 <= 2000);
ck(`R-05 MAX = ${MAX.toFixed(2)}ms ≤ 2000ms（更严）`, MAX <= 2000);

// 真机降速容忍度推算（Node → 微信小游戏 JSC 的经验倍率）
console.log('\n  真机降速容忍度推算（基于 Tester 本次 MAX，非拷 Developer 数字）：');
for (const k of [10, 15, 22, 30]) {
  const proj = MAX * k;
  console.log(`    ${String(k).padStart(2)}x 降速 → ${proj.toFixed(0)}ms  ${proj <= 2000 ? 'PASS ✅' : 'FAIL ❌'}`);
}
const tol = Math.floor(2000 / MAX);
console.log(`    可容忍最大降速倍率 = ${tol}x`);
ck(`R-05 可容忍降速倍率 ≥ 15x（真机余量）`, tol >= 15, `${tol}x`);

// 最坏情形定向压测：全 1..13 高解密度组合（非随机，专挑重牌）
console.log('\n  最坏情形定向压测（挑 primary+advanced 解数最多的组合）：');
const WORST = [[1, 1, 1, 1], [1, 1, 2, 2], [1, 2, 3, 4], [1, 1, 3, 8], [2, 2, 2, 2], [1, 2, 2, 4],
                [1, 1, 1, 8], [2, 3, 4, 6], [1, 1, 4, 6], [1, 2, 4, 8], [1, 1, 2, 12], [1, 1, 6, 6]];
let wMax = 0; const wRows = [];
for (const cards of WORST) {
  const t0 = process.hrtime.bigint();
  const res = solve(cards);
  buildDisplay(res, DISPLAY_LIMIT);
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  wMax = Math.max(wMax, ms);
  wRows.push({ cards, ms, p: res.primary.size, a: res.advanced.size });
}
wRows.sort((a, b) => b.ms - a.ms).forEach((r) => {
  console.log(`    ${JSON.stringify(r.cards).padEnd(16)} ${r.ms.toFixed(2).padStart(8)}ms  primary=${String(r.p).padStart(3)} advanced=${String(r.a).padStart(3)}`);
});
console.log(`  定向压测 MAX = ${wMax.toFixed(2)}ms，可容忍降速 = ${Math.floor(2000 / wMax)}x`);
ck(`R-05 定向压测 MAX = ${wMax.toFixed(2)}ms ≤ 2000ms`, wMax <= 2000);
ck(`R-05 定向压测可容忍降速 ≥ 15x`, Math.floor(2000 / wMax) >= 15, `${Math.floor(2000 / wMax)}x`);

// ============================================================
// R-05.1 · Tester 静态核查（仅静态；交互层由项目主真机）
// ============================================================
console.log('\n' + '='.repeat(70));
console.log('R-05.1 · 静态核查：动效时长常量 + disable/enable 状态机代码路径');
console.log('='.repeat(70));
const aa = fs.readFileSync(new URL('../js/ui/AnswerArea.js', import.meta.url), 'utf8');
const pr = fs.readFileSync(new URL('../js/ui/PageRenderer.js', import.meta.url), 'utf8');

// ① 动效时长常量在 200~250ms 区间
const mSlide = aa.match(/export\s+const\s+SLIDE_MS\s*=\s*(\d+)/);
ck('R-05.1① AnswerArea 导出 SLIDE_MS 常量', !!mSlide, mSlide ? `SLIDE_MS=${mSlide[1]}` : '未找到');
if (mSlide) {
  const v = parseInt(mSlide[1], 10);
  ck(`R-05.1① SLIDE_MS=${v} 落在 200~250ms 区间`, v >= 200 && v <= 250);
  ck(`R-05.1① SLIDE_MS=${v} < 300ms 卡顿线`, v < 300);
}
// ② easeOut 收尾且无弹跳（不含 overshoot 类系数）
ck('R-05.1② 使用 _easeOutCubic 收尾减速', /_easeOutCubic\s*\(/.test(aa));
ck('R-05.1② easeOutCubic 实现为 1-(1-p)^3 形态（无弹跳 overshoot）',
   /1\s*-\s*Math\.pow\(1\s*-\s*p,\s*3\)/.test(aa) ||
   /const q = 1 - p;\s*return 1 - q \* q \* q;/.test(aa),
   (aa.match(/_easeOutCubic\(p\)\s*\{[^}]*\}/) || [''])[0].replace(/\s+/g, ' ').slice(0, 120));
ck('R-05.1② easeOutCubic 不含 overshoot 系数（1.70158 / back / elastic）',
   !/1\.70158|elastic|overshoot/i.test(aa));
// 滑入进度 clamp 到 [0,1]
ck('R-05.1② 滑入进度 clamp 到 [0,1]', /Math\.max\(0,\s*Math\.min\(1,\s*dt\s*\/\s*SLIDE_MS\)\)/.test(aa));

// ③ 枚举异步化：不在主线程同步阻塞
ck('R-05.1③ _computeRecipAsync 存在', /_computeRecipAsync\s*\(/.test(pr));
ck('R-05.1③ 枚举通过 setTimeout 让出一帧（不阻塞滑入）', /setTimeout\(run,\s*0\)/.test(pr));
ck('R-05.1③ 枚举包 try/catch/finally（异常不吞掉 computing 标志）',
   /try\s*\{[\s\S]*?RecipSolver\.solve[\s\S]*?finally\s*\{[\s\S]*?_recipComputing\s*=\s*false/.test(pr));
ck('R-05.1③ _dealAction 中调用 _computeRecipAsync（发牌即起算）', /_dealAction\(\)[\s\S]*?_computeRecipAsync\(/.test(pr));

// ④ disable/enable 状态机：答题输入与 [提交]/[无解] 全程可用
ck('R-05.1④ AnswerArea 有 setEnabled 开关', /setEnabled\s*\(\s*enabled\s*\)/.test(aa));
ck('R-05.1④ 数字键 disabled 只取决于 !this.enabled || occupied（不受枚举态影响）',
   /const disabled = !this\.enabled \|\| occupied;/.test(aa));
ck('R-05.1④ 运算符键 disabled 只取决于 !this.enabled', /const disabled = !this\.enabled;/.test(aa));
ck('R-05.1④ [提交] disabled = !canSubmit()（与枚举态无关）', /disabled = !this\.canSubmit\(\);/.test(aa));
ck('R-05.1④ [无解] disabled = !this.enabled（与枚举态无关）', /disabled = !this\.enabled;\s*\n\s*bg = disabled \? BTN_BG_NOSOL_DISABLED/.test(aa));
ck('R-05.1④ AnswerArea 源码不引用 _recipComputing（输入区不被枚举锁死）', !aa.includes('_recipComputing'));

// ⑤ [提示]/[答案] 置灰 —— 关键缺陷检查
const hasFlag = /this\._recipComputing\s*=\s*true/.test(pr) && /this\._recipComputing\s*=\s*false/.test(pr);
ck('R-05.1⑤ _recipComputing 标志有 true/false 两态赋值', hasFlag);
const auxLine = (pr.match(/const auxEnabled = [^;]+;/) || [''])[0];
console.log(`\n  auxEnabled 实际代码： ${auxLine}`);
const auxGated = /_recipComputing/.test(auxLine);
ck('R-05.1⑤【缺陷检查】auxEnabled 计算式中包含 !this._recipComputing（枚举中置灰 [提示]/[答案]）',
   auxGated, auxGated ? '' : '❌ 未包含：_recipComputing 被赋值但从未参与按钮 disabled 判定');
const occurrences = (pr.match(/_recipComputing/g) || []).length;
console.log(`  _recipComputing 在 PageRenderer.js 中出现 ${occurrences} 次（声明 1 + true 1 + false 1 = 3 表示"只写不读"）`);
ck('R-05.1⑤ _recipComputing 被读取（出现次数 > 3 说明有消费方）', occurrences > 3, `实际 ${occurrences} 次，全部为写入`);

// ⑥ 「计算中…」文案 —— 【已撤销，非缺陷】
//
// 【裁定依据】项目主 2026-08-04 10:49 裁定：黄2「计算中…」文案**不做**。
//   Manager 同步要求：r05 台账相关断言降级或移除，勿残留失败断言（失败断言长期挂红
//   会被后人误判为未修缺陷，与我 TESTER-TODO 规则第 8 条「禁止留只在单一状态下正确
//   的断言」同源 —— 一个永远为红且永远不会被修的断言，等价于假红）。
//
// 【原断言】`pr.includes('计算中') || aa.includes('计算中')` → 全仓无命中，恒为 fail。
// 【处置】降级为**信息项**，不计入 pass/fail。保留探测与输出，便于日后若改判可直接恢复。
// 【关联】原计划用 tesseract OCR 断言该文案，Manager 已同步撤销 `ctx.__texts()` 替代评估。
const hasText = pr.includes('计算中') || aa.includes('计算中');
console.log(`  · [信息项·非断言] 「计算中…」文案：${hasText ? '存在' : '不存在'}（项目主裁定不做，不计 fail）`);

// ⑦ 15/14 键布局随开关切换（layoutFor 统一入口）
// 🔴 task-123（开发实证后修正）原断言正则为 `/export function layoutFor\(advancedCalc\)/`，
//   把**参数列表文本**一并锁死 ⇒ 将来若为 caps 联动加可选第二参 `(advancedCalc, caps)`，
//   本条会判红，而它想验的只是「存在统一布局入口」这一结构事实，与参数个数无关。
//   开发 task-123 §一 因此被本条阻塞（注入 caps ⇒ 26/1），属**测试侧过紧**，非产品缺陷。
//   收口：只锚函数名与首参名，允许其后追加参数；仍禁止改名或去掉 advancedCalc 首参。
ck('R-05.1⑦ layoutFor(advancedCalc[, ...]) 统一布局入口存在（允许追加可选参）',
   /export\s+function\s+layoutFor\s*\(\s*advancedCalc\s*[,)]/.test(aa));
ck('R-05.1⑦ setAdvancedCalc 幂等短路（next === this.advancedCalc 直接 return）',
   /if \(next === this\.advancedCalc\) return;/.test(aa));

// ============================================================
// 明确声明：交互层未测
// ============================================================
console.log('\n' + '='.repeat(70));
console.log('【Tester 覆盖度声明 / R-05.1 交互层】');
console.log('='.repeat(70));
console.log('  以下项 Tester 本次【未测】，须由项目主 GUI/真机复核：');
console.log('   · 点击时序（枚举中连点 [提示]/[答案] 的实际响应）');
console.log('   · 滑入动效实际手感（220ms 是否观感自然、有无掉帧）');
console.log('   · 置灰→恢复的时机（枚举完成瞬间按钮是否即时恢复）');
console.log('   · 15/14 键切换后的真机点击热区准确性');
console.log('  原因：m24 为微信小游戏，miniprogram-automator 仅支持小程序，无可用自动化 SDK。');
console.log('  Tester 交互层覆盖度 = 0%（与 TOOLS.md 能力矩阵一致）。');

const ok = done();
process.exit(ok ? 0 : 1);
