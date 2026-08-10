// task-127 交叉复核 G-1/G-5（Tester 独立取值，禁引用上游回显数字）
// 作者：Tester <tester@m24.local>
//
// 🔴 本脚本重点补强 Manager 自认有缺陷的 V-2 判据（零正例形态）：
//   原判据用牌组 {1,3,5,10}，改设置后 advanced 总数 = 0
//   ⇒ 退化成「清空也能全绿」：若修复错成「改设置就把 advanced 置空」，判据照样 PASS
//   ⇒ 违反 AGENTS.md 判据三级 ③「正例出现过 + 交叉验证」
// 重建口径：双非空牌组 + 5 条合取判据（存在性前置 / 已关消失 / 已开正例 / 反向增解 / R-01）
//
// 用法：node --import ./tester/render-smoke/esm-hooks.mjs tester/tester-task127-g1g5-crosscheck.mjs [repoRoot]
// 🔴 E 项 R-01 基数须用采样域 a∈0..13（含 0）+ 裸 advancedCalc:true 口径：
//   我首取 a∈1..13 得 3646，与开发 3958 差 312 —— 纯采样域口径差，非不一致。对齐后自取 3958。
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';

const ROOT = process.argv[2] || process.cwd();
const P = (r) => path.join(ROOT, r);            // 裸路径：给 fs.* 用
// 🔴 跨平台：import() 需 file:// URL。Windows 下裸 'C:\\...' 被解析为 protocol 'c:'
//   ⇒ ERR_UNSUPPORTED_ESM_URL_SCHEME；Linux 以 '/' 开头故不暴露（task-128 服务器实测）。
const PU = (r) => pathToFileURL(P(r)).href;     // file:// URL：给 import() 用

let PASS = 0, FAIL = 0;
const failed = [];
function check(name, cond, detail) {
  if (cond) { PASS++; console.log(`  ✓ ${name}${detail ? ' — ' + detail : ''}`); }
  else { FAIL++; failed.push(name); console.log(`  ✗ ${name}${detail ? ' — ' + detail : ''}`); }
}

const S = await import(PU('js/core/RecipSolver.mjs'));
const solve = S.solve || (S.default && S.default.solve);
const entriesOf = (o) => (o ? (o instanceof Map ? [...o.entries()] : Object.entries(o)) : []);
const dispOf = (v) => (v && (v.display ?? v.disp ?? v.expr ?? v.text)) ?? String(v);

const ALL_ON = { recip: true, fact: true, mod: true, pow: true, log: true };
const MOD_POW_LOG = { recip: false, fact: false, mod: true, pow: true, log: true };

function probe(cards, caps) {
  let r;
  try { r = solve(cards, { advancedCalc: true, caps }); } catch (e) { return { err: String(e && e.message) }; }
  const adv = entriesOf(r && r.advanced).map(([k, v]) => ({ k: String(k), d: dispOf(v) }));
  const prim = entriesOf(r && r.primary).map(([k]) => String(k));
  return {
    advN: adv.length,
    recipN: adv.filter((x) => x.d.includes('(1/')).length,
    factN: adv.filter((x) => x.d.includes('!')).length,
    openN: adv.filter((x) => /%|\^|log|√/.test(x.d)).length,
    primN: prim.length,
    primKeys: prim.slice().sort().join('|'),
    primPiped: prim.filter((k) => k.includes('|')).length,
  };
}

// ════════ 一、复现 Manager 自认的 V-2 零正例缺陷（证明其确为废件）════════
console.log('\n--- 一、复现 Manager V-2 判据的零正例缺陷 ---');
{
  const g = probe([1, 3, 5, 10], ALL_ON);
  const n = probe([1, 3, 5, 10], MOD_POW_LOG);
  check('W-1 原牌组 {1,3,5,10} 全开态 advanced > 0（修前态有样本）', g.advN > 0, `advanced=${g.advN} 含(1/=${g.recipN} 含!=${g.factN}`);
  check('W-2 🔴 原牌组改设置后 advanced == 0 ⇒ 判据退化为「清空亦全绿」', n.advN === 0, `advanced=${n.advN}`);
  check('W-3 🔴 故原判据无法区分「正确重算」与「错误清空」（零正例，违判据三级③）', n.openN === 0 && n.advN === 0, `已开符号条目=${n.openN}`);
}

// ════════ 二、重建判据：双非空牌组 × 5 条合取（Manager 指定候选，自行复测取值）════════
console.log('\n--- 二、重建 V-2 判据（双非空牌组 + 已开符号正例前置）---');
const DECKS = [[5, 8, 11, 12], [1, 2, 6, 8], [1, 3, 8, 13], [2, 3, 4, 5]];
const table = [];
for (const cards of DECKS) {
  const tag = `{${cards.join(',')}}`;
  const g = probe(cards, ALL_ON);
  const n = probe(cards, MOD_POW_LOG);
  table.push({ tag, g, n });

  // 判据 1：存在性前置 —— 改设置后仍非空（证明不是清空）
  check(`V2-1 ${tag} 改设置后 advanced > 0（存在性前置，排除「清空」假绿）`, n.advN > 0, `全开=${g.advN} → 仅模幂对数=${n.advN}`);
  // 判据 2：已关符号确实消失
  check(`V2-2 ${tag} 改设置后 含(1/ == 0 且 含! == 0（已关符号消失）`, n.recipN === 0 && n.factN === 0, `含(1/=${n.recipN} 含!=${n.factN}`);
  // 判据 3：已开符号正例出现过（判据三级③）
  check(`V2-3 ${tag} 改设置后存在含 %/^/log/√ 的条目（已开符号正例出现过）`, n.openN > 0, `已开符号条目=${n.openN}/${n.advN}`);
  // 判据 4：反方向增解 —— 回调全开后已关符号重新出现（过滤方案做不到）
  check(`V2-4 ${tag} 反向回调全开 ⇒ 含(1/ 或 含! 重新出现（增解方向）`, g.recipN + g.factN > 0, `全开 含(1/=${g.recipN} 含!=${g.factN}`);
  // 判据 5：R-01 primary 两态恒等且无后缀违例
  check(`V2-5 ${tag} primary 两态恒等且无 | 违例（R-01）`, g.primKeys === n.primKeys && g.primPiped === 0 && n.primPiped === 0,
    `primary ${g.primN} vs ${n.primN}，违例 ${g.primPiped}/${n.primPiped}`);
}

// 判据集自身有效性：至少一组牌能同时满足「非空 + 已开正例」，否则整节仍是零正例
{
  const usable = table.filter((t) => t.n.advN > 0 && t.n.openN > 0).length;
  check('V2-0 🔴 判据集自身非空有效（至少 1 组牌满足 非空+已开正例）', usable > 0, `可用牌组 ${usable}/${DECKS.length}`);
}

// ════════ 三、A 项：_applyAdvancedCalc 是否唯一汇聚入口（静态穷举赋值点）════════
console.log('\n--- 三、A 项 caps/advancedCalc 赋值点穷举（判定有无绕过路径）---');
{
  const src = fs.readFileSync(P('js/ui/PageRenderer.js'), 'utf8');
  const lines = src.split('\n');
  const idxApply = lines.findIndex((l) => /_applyAdvancedCalc\(on, caps\)\s*\{/.test(l));
  check('A-0 定位到 _applyAdvancedCalc 定义行', idxApply >= 0, `line ${idxApply + 1}`);

  // 方法体范围：从定义行到下一个同缩进 '  }' 结束
  let end = idxApply + 1;
  for (; end < lines.length; end++) if (/^  \}\s*$/.test(lines[end])) break;

  const assigns = [];
  lines.forEach((l, i) => {
    if (/this\._caps\s*=|this\._advancedCalc\s*=/.test(l)) assigns.push({ line: i + 1, inApply: i > idxApply && i < end, text: l.trim().slice(0, 60) });
  });
  check('A-1 赋值点总数 > 0（防空扫描假绿）', assigns.length > 0, `${assigns.length} 处`);

  const outside = assigns.filter((a) => !a.inApply);
  // 构造器内初始化属正常；判定标准 = 方法体外的赋值是否只出现在 constructor
  const ctorIdx = lines.findIndex((l) => /^\s*constructor\s*\(/.test(l));
  const ctorEnd = (() => { let e = ctorIdx + 1; for (; e < lines.length; e++) if (/^  \}\s*$/.test(lines[e])) break; return e; })();
  const bypass = outside.filter((a) => !(a.line - 1 > ctorIdx && a.line - 1 < ctorEnd));
  check('A-2 无「绕过 _applyAdvancedCalc」的 caps/advancedCalc 赋值点（构造器初始化除外）', bypass.length === 0,
    bypass.length ? bypass.map((b) => `L${b.line} ${b.text}`).join(' ; ') : `方法体内 ${assigns.length - outside.length} 处 / 构造器 ${outside.length - bypass.length} 处 / 绕过 0 处`);
  check('A-3 构造器内确有初始化赋值（存在性前置，证明 A-2 不是因扫不到而全绿）', outside.length - bypass.length > 0, `构造器 ${outside.length - bypass.length} 处`);
}

// ════════ 四、B 项：DEALING 期间改设置 → 转 DONE 是否补算（真漏洞探测）════════
console.log('\n--- 四、B 项 发牌动画中改设置的补算路径（真漏洞探测）---');
{
  const src = fs.readFileSync(P('js/ui/PageRenderer.js'), 'utf8');
  const lines = src.split('\n');

  // B-1：DEALING→DONE 转换点定位
  const doneIdx = lines.findIndex((l) => /this\.dealState\s*=\s*DEAL_STATE\.DONE/.test(l));
  check('B-1 定位 DEALING→DONE 转换点', doneIdx >= 0, `line ${doneIdx + 1}`);

  // B-2：该转换点附近 ±12 行内是否存在补算调用
  const near = lines.slice(Math.max(0, doneIdx - 12), doneIdx + 13).join('\n');
  const hasRecompute = /_computeRecipAsync\s*\(/.test(near);
  check('B-2 🔴 DONE 转换点邻域存在补算调用（无则 DEALING 期改设置被静默丢弃）', hasRecompute,
    hasRecompute ? '存在补算' : `转换点 L${doneIdx + 1} 邻域 ±12 行内无 _computeRecipAsync ⇒ 疑似真漏洞`);

  // B-3：_computeRecipAsync 全部调用点定位（存在性前置，防正则写错致 B-2 假绿/假红）
  const callLines = [];
  lines.forEach((l, i) => { if (/this\._computeRecipAsync\s*\(/.test(l)) callLines.push(i + 1); });
  check('B-3 _computeRecipAsync 调用点 > 0（存在性前置）', callLines.length > 0, `调用点 L${callLines.join(',L')}`);

  // B-4：发牌起点的枚举发生在置 DEALING 之前 ⇒ 无法覆盖「发牌中改设置」
  const dealingIdx = lines.findIndex((l) => /this\.dealState\s*=\s*DEAL_STATE\.DEALING/.test(l));
  const callBeforeDealing = callLines.filter((n) => n < dealingIdx + 1 && n > dealingIdx - 12);
  check('B-4 发牌路径的枚举位于置 DEALING 之前（故不覆盖动画中的设置变更）', callBeforeDealing.length > 0,
    `DEALING 置位 L${dealingIdx + 1}，其前枚举 L${callBeforeDealing.join(',L') || '无'}`);

  // B-5：行为验证 —— 抽真实方法原文驱动，模拟「DEALING 改设置 → 转 DONE」
  const m = src.match(/ {2}_applyAdvancedCalc\(on, caps\) \{[\s\S]*?\n {2}\}\n/);
  check('B-5 抽取到 _applyAdvancedCalc 原文（禁另写实现）', !!m, m ? `${m[0].length} 字节` : 'MISS');
  if (m) {
    const DEAL_STATE = { IDLE: 'idle', DEALING: 'dealing', DONE: 'done' };
    const Host = new Function('DEAL_STATE', `
      return class Host {
        constructor(st, cards) { this.dealState = st; this.dealtCards = cards; this._settings = null;
          this._advancedCalc = true; this._caps = { recip:true, fact:true, mod:true, pow:true, log:true };
          this.answerArea = null; this.calls = []; }
        _computeRecipAsync(v) { this.calls.push(v); }
      ${m[0]}
      };`)(DEAL_STATE);
    const CARDS = [{ value: 5 }, { value: 8 }, { value: 11 }, { value: 12 }];

    // 对照组：DONE 态改设置 ⇒ 必须重算（证明探针能测出重算，非恒假）
    const hDone = new Host(DEAL_STATE.DONE, CARDS);
    hDone._applyAdvancedCalc(true, MOD_POW_LOG);
    check('B-6 对照：DONE 态改设置 ⇒ 触发重算（证明探针可检出重算，非恒假）', hDone.calls.length === 1, `calls=${hDone.calls.length}`);

    // 实验组：DEALING 态改设置 ⇒ 门禁拦下；随后转 DONE ⇒ 有无补算？
    const hDeal = new Host(DEAL_STATE.DEALING, CARDS);
    hDeal._applyAdvancedCalc(true, MOD_POW_LOG);
    const blocked = hDeal.calls.length === 0;
    check('B-7 DEALING 态改设置被门禁拦下（开发设计如此）', blocked, `calls=${hDeal.calls.length}`);
    // 🔴 task-127 复核修正（开发 worker2）：原 B-8 断言 `calls === 0`，即把【缺陷现象】
    //   写成了期望值 ⇒ 修好之后它会判红、不修则恒绿，方向与结论相反（自我实现的预言）。
    //   且原实现手工赋值 dealState 模拟转换，未跑真实转换块 ⇒ 即使产品补了补算也永远看不到。
    //   现改为：抽取【真实】DEALING→DONE 转换块执行，并断言「必须补算」。
    //   Tester 的定性完全正确（漏洞真实存在，我已独立复现）；此处只纠断言方向与取值层。
    const transBlock = src.match(/    if \(this\.dealState === DEAL_STATE\.DEALING\) \{\n      const totalMs[\s\S]*?\n    \}\n/);
    check('B-8a 存在性前置：成功抽取真实 DEALING→DONE 转换块', !!transBlock,
      transBlock ? `${transBlock[0].length}B` : '未抽到 ⇒ 下面的 B-8 结论无效，先修正则');
    if (transBlock) {
      const tick = new Function('DEAL_STATE', 'CARD_DELAY_MS', 'CARD_FLIP_MS',
        `return function (now) { ${transBlock[0]} };`)(DEAL_STATE, 150, 400);
      hDeal.dealStartAt = 1000;
      tick.call(hDeal, 1000 + 3 * 150 + 400);   // 动画结束
      check('B-8 🔴 转 DONE 后必须补算（否则 DEALING 期设置变更被静默丢弃）',
        hDeal.dealState === DEAL_STATE.DONE && hDeal.calls.length === 1,
        `state=${hDeal.dealState} calls=${hDeal.calls.length}`);
      tick.call(hDeal, 1000 + 2000);
      check('B-9 补算标记仅消费一次（后续帧不得反复重算）', hDeal.calls.length === 1,
        `calls=${hDeal.calls.length}`);

      // 🔴 task-127 复核补充（Tester 独立探边，开发未覆盖）：
      //   B-10 误触方向、B-11 DEALING 期多次改设置的幂等。
      //   两条的必要性：B-8/B-9 只能证「该补算时补了」，证不了「不该补时没乱补」；
      //   若产品误写成无条件补算（删掉 pending 守卫），B-8/B-9 照样全绿。
      {
        const hNo = new Host(DEAL_STATE.DEALING, CARDS);
        const tickNo = new Function('DEAL_STATE', 'CARD_DELAY_MS', 'CARD_FLIP_MS',
          `return function (now) { ${transBlock[0]} };`)(DEAL_STATE, 150, 400);
        hNo.dealStartAt = 1000;
        tickNo.call(hNo, 1000 + 3 * 150 + 400);   // 未改过设置，直接转 DONE
        check('B-10 🔴 未改设置的正常发牌 ⇒ 转 DONE 不得补算（防无条件重算伪装成修好）',
          hNo.dealState === DEAL_STATE.DONE && hNo.calls.length === 0,
          `state=${hNo.dealState} calls=${hNo.calls.length}`);

        const hTwice = new Host(DEAL_STATE.DEALING, CARDS);
        hTwice._applyAdvancedCalc(true, MOD_POW_LOG);
        hTwice._applyAdvancedCalc(true, { recip: true, fact: false, mod: true, pow: false, log: true });
        const tick2 = new Function('DEAL_STATE', 'CARD_DELAY_MS', 'CARD_FLIP_MS',
          `return function (now) { ${transBlock[0]} };`)(DEAL_STATE, 150, 400);
        hTwice.dealStartAt = 1000;
        tick2.call(hTwice, 1000 + 3 * 150 + 400);
        check('B-11 DEALING 期改 2 次设置 ⇒ 转 DONE 只补算 1 次（幂等）', hTwice.calls.length === 1,
          `calls=${hTwice.calls.length}`);
      }
    }
  }
}

// ════════ 五、C 项：G-1 文案（活代码计数，剥注释防污染）════════
console.log('\n--- 五、C 项 G-1 文案（剥注释后计数）---');
{
  const files = [];
  (function walk(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.(js|mjs)$/.test(e.name)) files.push(p);
    }
  })(P('js'));
  check('C-0 扫到 js/ 源文件 > 0（存在性前置）', files.length > 0, `${files.length} 个文件`);

  let oldLive = 0, newLive = 0, oldAny = 0;
  const oldHit = [];
  for (const f of files) {
    const txt = fs.readFileSync(f, 'utf8');
    if (txt.includes('本局无倒数解法')) oldAny++;
    const live = txt.split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');
    if (live.includes('本局无倒数解法')) { oldLive++; oldHit.push(path.relative(ROOT, f)); }
    if (live.includes('本局无高级解法')) newLive++;
  }
  check('C-1 活代码中旧文案「本局无倒数解法」== 0 处', oldLive === 0, oldHit.length ? oldHit.join(',') : `含注释共 ${oldAny} 处（沿革注释允许）`);
  check('C-2 活代码中新文案「本局无高级解法」>= 1 处（存在性前置）', newLive >= 1, `${newLive} 处`);
}

// ════════ 五之二、C 项：开发列的「不改」3 处是否成立（行为实证，非只读注释）════════
console.log('\n--- 五之二、C 项 RecipParser 倒数文案是否仅 recip 路径可触发 ---');
{
  const RP_MOD = await import(PU('js/core/RecipParser.js'));
  const parse = RP_MOD.parse;
  const N = (v) => ({ type: 'number', value: v });
  const OP = (v) => ({ type: 'operator', value: v });
  const LPn = { type: 'left_paren' }, RPn = { type: 'right_paren' };
  const RC = { type: 'recip' }, FC = { type: 'fact' }, MD = { type: 'mod' };
  const CV = [1, 2, 3, 4];
  const cases = [
    { tok: [RC, OP('+')], recipExpected: true, why: 'recip 悬空' },
    { tok: [LPn, N(1), OP('+'), N(2), RPn, FC], recipExpected: false, why: 'fact 非叶子' },
    { tok: [FC, N(3)], recipExpected: false, why: 'fact 悬空' },
    { tok: [LPn, N(1), OP('+'), N(2), RPn, MD, N(3)], recipExpected: false, why: 'mod 非叶子' },
  ];
  let errN = 0, leak = [];
  let recipPositive = 0;
  for (const c of cases) {
    const r = parse(c.tok, CV);
    if (!r.ok) errN++;
    const has = /倒数/.test(String((r && (r.message || r.error)) || ''));
    if (has && !c.recipExpected) leak.push(c.why);
    if (has && c.recipExpected) recipPositive++;
  }
  check('C-3 解析报错样本数 > 0（存在性前置，防「都不报错」致 C-4 假绿）', errN > 0, `${errN}/${cases.length} 例报错`);
  check('C-4 「倒数」文案正例出现过（recip 路径确实会报该文案）', recipPositive > 0, `recip 正例 ${recipPositive} 例`);
  check('C-5 非 recip 路径（fact/mod）不泄漏「倒数」文案 ⇒ 开发「不改」判断成立', leak.length === 0,
    leak.length ? `泄漏于: ${leak.join(',')}` : 'fact/mod 三例均报独立文案');
}

// ════════ 六、D 项：冻结区 6 文件（逐个内容 SHA-1 比基线，禁 diff --stat 空输出）════════
console.log('\n--- 六、D 项 冻结区 6/6（逐文件内容哈希）---');
{
  const FROZEN = {
    'js/core/Card.js': '471ea23e7389637d69e03e317518764c608e6f75',
    'js/ui/Background.js': '5bf7cd1c9593cee575ff9d084c2edb3a036458f4',
    'js/ui/ButtonRenderer.js': 'd7606fd0b005265229caf7bf9b0d51aba5440424',
    'js/ui/CardRenderer.js': 'd9703d0b19ee1a0d331560a6dd20c64680ec6eac',
    'js/ui/Components.js': 'a103f9188e171a885f589a73c17e9aa43b9f235c',
    'js/utils/Random.js': 'b04dc9f8b6c532e424cbce8a8e9fce3f008601c8',
  };
  const crypto = await import('crypto');
  let match = 0;
  const bad = [];
  for (const [rel, want] of Object.entries(FROZEN)) {
    const buf = fs.readFileSync(P(rel));
    // git blob 口径：SHA1("blob <len>\0" + content)
    const h = crypto.createHash('sha1').update(Buffer.concat([Buffer.from(`blob ${buf.length}\0`), buf])).digest('hex');
    if (h === want) match++; else bad.push(`${rel} got=${h.slice(0, 12)} want=${want.slice(0, 12)}`);
  }
  check('D-1 冻结区 6/6 与 5b80efa blob 逐字节一致', match === 6, bad.length ? bad.join(' ; ') : '6/6 MATCH（git hash-object 口径）');
  check('D-2 冻结清单条目数 == 6（防清单被裁剪致假绿）', Object.keys(FROZEN).length === 6, `${Object.keys(FROZEN).length} 条`);
}

// ════════ 七、根目录 *.mjs == 0 ════════
console.log('\n--- 七、根目录 *.mjs 约束 ---');
{
  const rootMjs = fs.readdirSync(ROOT, { withFileTypes: true })
    .filter((e) => e.isFile() && /\.mjs$/.test(e.name)).map((e) => e.name);
  check('E-1 根目录 *.mjs == 0', rootMjs.length === 0, rootMjs.length ? rootMjs.join(',') : '0 个');
}

// ════════ 断言总数自断言（全仓 85 支中仅 8 支有，本支必须有）════════
console.log('\n--- 断言总数自断言 ---');
const EXPECTED_ASSERTION_COUNT = 49;   // 🔴 Tester 复核补 B-10（误触方向）+ B-11（DEALING 期多次改设置幂等）⇒ 47→49   // 3(W) + 20(V2-1..5 ×4组) + 1(V2-0) + 4(A) + 10(B) + 3(C) + 3(C之二) + 2(D) + 1(E) = 47
//   🔴 task-127 复核修正：B 项 8→10（B-8 拆为 B-8a 存在性前置 + B-8 真实转换块断言，另加 B-9 幂等）
//   🔴 首版我写 38，实跑得 42 ⇒ 我手算漏了 4 条；补 C-3/C-4/C-5 后为 45。
//   这条自断言的价值正在于此：它抓住的是「测试作者自己的手算错误」，不是产品缺陷。
if (PASS + FAIL !== EXPECTED_ASSERTION_COUNT) {
  console.log(`  ✗ 断言总数 = ${PASS + FAIL}，期望 ${EXPECTED_ASSERTION_COUNT}（有断言静默退场或新增未同步）`);
  FAIL++; failed.push('断言总数自断言');
} else {
  console.log(`  ✓ 断言总数 = ${PASS + FAIL} 与期望 ${EXPECTED_ASSERTION_COUNT} 一致`);
}

console.log(`\nT127 CROSSCHECK TOTAL: pass=${PASS} fail=${FAIL}`);
for (const f of failed) console.log(`  - ${f}`);
console.log(`OVERALL: ${FAIL ? 'FAIL ❌' : 'PASS ✅'}`);

console.log('\n--- 四牌组实测数汇总（供报告引用）---');
for (const t of table) {
  console.log(`  ${t.tag}  全开: adv=${t.g.advN} (1/=${t.g.recipN} !=${t.g.factN} 已开符号=${t.g.openN} prim=${t.g.primN}`);
  console.log(`  ${' '.repeat(t.tag.length)}  仅模幂对数: adv=${t.n.advN} (1/=${t.n.recipN} !=${t.n.factN} 已开符号=${t.n.openN} prim=${t.n.primN}`);
}

process.exit(FAIL ? 1 : 0);
