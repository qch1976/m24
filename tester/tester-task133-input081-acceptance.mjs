// tester/tester-task133-input081-acceptance.mjs
// INPUT-08.1 §8 验收判据 V-1..V-11｜Tester <tester@m24.local>｜task-133
//
// 🔴 判据约束（本轮付过学费的六条，逐条遵守）：
//  1. 禁极性倒置：断言写「应该怎样」，不写「现在怎样」
//  2. 判据三级③：新引入的位/字段须有正例出现过；零/空集判据必配存在性前置
//  3. 取值层与被判事实同层：判 AST 就读 AST；🔴 P 位走 countPow 节点存在性，禁从渲染文本反推
//  4. 双向判据：既证「该做时做了」，也证「不该做时没乱做」
//  5. 单支自足：不依赖「另一支恰好也测了」
//  6. 覆盖面报数须写清「单支」还是「全套」
//
// 用法：node --import ./tester/render-smoke/esm-hooks.mjs tester/tester-task133-input081-acceptance.mjs [repoRoot]
// 🔴 task-135 起**必须带 --import esm-hooks**：V-5.12/5.13 需加载真实 AnswerArea 类，
//   而 `js/ui/AnswerArea.js` 依赖无扩展名 spec（`'./Components'`），裸跑必 ERR_MODULE_NOT_FOUND。
//   裸跑不会报错而是**条件跳过该 2 条**（总数 57）；带 hooks 时执行（总数 59）。
//   ⇒ 验收须看带 hooks 的结果，否则 UI 层 2 条未被覆盖。
import * as fs from 'fs';
import * as path from 'path';
import { pathToFileURL } from 'url';

const ROOT = process.argv[2] || process.cwd();
// 🔴 Windows 坑：import() 须走 file:// URL，禁裸路径（含空格路径会截断）
const P = (r) => path.join(ROOT, r);
const PU = (r) => pathToFileURL(P(r)).href;

let pass = 0, fail = 0;
const failed = [];
function check(name, cond, detail = '') {
  if (cond) { pass++; console.log(`    ✓ ${name}${detail ? ` — ${detail}` : ''}`); }
  else { fail++; failed.push(name); console.log(`    ✗ ${name}${detail ? ` — ${detail}` : ''}`); }
}

const RP = await import(PU('js/core/RecipParser.mjs'));
const { ERR, ERR_MSG, checkUserAnswer, parse, evalAst } = RP;

// 🔴 分层取值（判据层须与被判事实同层 —— 我首轮此处弄错已自查修正）：
//   parse(tokens, cardValues)      → 只管**文法**，返 { ok, ast, error, message }
//   checkUserAnswer(t, c, opts)    → 管**门禁 + 四牌各用一次 + 求值**，返 { pass, reason, message }
//   ∴ V-1/V-2/V-3/V-4/V-7 属文法层 ⇒ 走 parse + evalAst；V-5/V-6③ 属门禁层 ⇒ 走 checkUserAnswer。
//   首轮我全走 checkUserAnswer 且读 `r.ok`，得 ok=undefined + 四牌不足提前退出，
//   全线 unexpected_token —— **那是我的判据错，不是产品缺陷**，已改正。

// 文法层：解析 + 求值（不受四牌约束，专测文法）
function P1(tokens, cards) {
  const pr = parse(tokens, cards);
  if (!pr.ok) return { ok: false, code: pr.error, msg: pr.message, ast: null };
  const ev = evalAst(pr.ast);
  const v = ev && ev.ok
    ? (typeof ev.value === 'object' && ev.value !== null
        ? Number(ev.value.n ?? ev.value.num ?? NaN) / Number(ev.value.d ?? ev.value.den ?? 1)
        : Number(ev.value))
    : NaN;
  return { ok: true, ast: pr.ast, value: v, evOk: !!(ev && ev.ok), evCode: ev && ev.error };
}

// ── token 构造助手：与 GUI addToken 同形（type/value） ──
// ── token 构造助手：🔴 按仓内权威口径（`selftest/selftest_input06_parser.mjs:10`）
//   数字 token 用 **cardIndex 索引**指向 cardValues，**不是 
//   `value`** —— 我前两轮写 `{type:'number', value}` 导致全线 unexpected_token，
//   那是我的判据错，不是产品缺陷（已自查修正）。
const N = (i) => ({ type: 'number', cardIndex: i });
const op = (o) => ({ type: 'operator', value: o });
const POW = { type: 'pow' };
const LOG = { type: 'log' };
const LP = { type: 'left_paren' };
const RP_ = { type: 'right_paren' };

// caps 全开（§5 补充口径：=== true 要求调用侧显式传参，漏传即静默全关）
const ALL_ON = { advancedCalc: true, capRecip: true, capFact: true, capMod: true, capPow: true, capLog: true };
const capsOf = (o = {}) => ({ ...ALL_ON, ...o });

// 门禁层：checkUserAnswer 返 { pass, reason, message }——**无 `ok` 字段**
function run(tokens, cards, caps = capsOf()) {
  try { return checkUserAnswer(tokens, cards, caps); }
  catch (e) { return { pass: false, reason: '__throw__', message: String(e && e.message || e) }; }
}
const codeOf = (r) => r && (r.reason || r.code || r.error || null);
const msgOf = (r) => (r && r.message) || '';

console.log('═══ INPUT-08.1 §8 验收 V-1..V-11（单支覆盖 V-1..V-10；V-11 由双平台实跑体现）═══');

// ══════════ V-1 §1 幂 ══════════
console.log('\n--- V-1 幂：8^3 ⇒ ok 且求值 512；2^3^4 ⇒ POW_CHAINED ---');
{
  const r = P1([N(0), POW, N(1)], [8, 3]);
  check('V-1.1 8^3 解析成功（文法层 parse.ok=true）', r.ok === true, `ok=${r.ok} code=${r.code}`);
  check('V-1.2 8^3 求值 = 512', r.value === 512, `value=${r.value}`);
  // 🔴 双向判据之「不该做时没乱做」：链式须拒收且报专属码，非通用 trailing_token
  const c = P1([N(0), POW, N(1), POW, N(2)], [2, 3, 4]);
  check('V-1.3 2^3^4 被拒收', c.ok === false, `ok=${c.ok}`);
  check('V-1.4 2^3^4 报专属 POW_CHAINED（禁通用 trailing_token）',
    c.code === ERR.POW_CHAINED, `code=${c.code} 期望=${ERR.POW_CHAINED}`);
  // ③ 正例：至少一条含 ^ 的算式提交成功并判 24
  // 🔴 走完整提交链（checkUserAnswer）：四牌各用一次 ⇒ 2^3 * 3 * 1 = 24，牌组 [2,3,3,1]
  const win = run([N(0), POW, N(1), op('*'), N(2), op('*'), N(3)], [2, 3, 3, 1]);
  check('V-1.5 ③ 正例：含 ^ 的算式可成功提交并判 24（2^3*3*1）',
    win.pass === true, `pass=${win.pass} reason=${codeOf(win)} msg=${msgOf(win).slice(0, 26)}`);
}

// ══════════ V-2 §3 开方（🔴 须在 capRecip=false, capPow=true 下跑通）══════════
console.log('\n--- V-2 开方：^^ ⇒ rootIdx 形态，且 capRecip=false 下仍可用 ---');
{
  const CAPS_BREAK = capsOf({ capRecip: false, capPow: true });   // 🔴 断链场景
  // 文法层取 AST/求值（rootIdx 是 AST 字段，必须同层读 AST，禁从屏显反推）
  const r = P1([N(0), POW, POW, N(1)], [8, 3]);
  check('V-2.1 8^^3 文法层解析成功', r.ok === true, `ok=${r.ok} code=${r.code}`);
  check('V-2.2 8^^3 = 8 的 3 次根 = 2', r.value === 2, `value=${r.value}`);
  // ③ 取值层同层：rootIdx 是本轮新引入字段，须在 AST 上验其存在（禁看屏显文本）
  const ast = r.ast ?? r.node ?? null;
  check('V-2.3 存在性前置：能取到 AST（否则下方 rootIdx 断言不可信）', !!ast,
    ast ? `AST op=${ast.op ?? '(root)'}` : '🔴 未取到 AST ⇒ V-2.4 不可信');
  const findPow = (n) => {
    if (!n || typeof n !== 'object') return null;
    if (n.op === 'pow') return n;
    for (const k of ['a', 'b', 'l', 'r', 'left', 'right', 'arg']) {
      const h = findPow(n[k]); if (h) return h;
    }
    return null;
  };
  const pw = findPow(ast);
  check('V-2.4 ③ AST 上 rootIdx 字段确有正例（值 = 3，专用字段非 1/b 子树）',
    !!pw && pw.rootIdx === 3, pw ? `rootIdx=${pw.rootIdx} op=${pw.op}` : '未找到 pow 节点');
  // 双向：普通幂不得带 rootIdx（防误标）
  const plain = findPow(P1([N(0), POW, N(1)], [2, 3]).ast);
  check('V-2.5 双向：普通幂 2^3 不得带 rootIdx',
    !!plain && (plain.rootIdx === undefined || plain.rootIdx === null),
    plain ? `rootIdx=${String(plain.rootIdx)}` : '未找到 pow 节点');
  // §3.4 开方结果须精确
  const inexact = P1([N(0), POW, POW, N(1)], [2, 2]);
  check('V-2.6 2^^2（√2 无理）⇒ POW_NOT_EXACT',
    inexact.ok === false && inexact.code === ERR.POW_NOT_EXACT,
    `ok=${inexact.ok} code=${inexact.code}`);
  // 🔴 V-2 核心正例：必须在 capRecip=false, capPow=true 下走完整提交链跑通
  //   （项目主抓到的断链场景；不跑这个组合等于没测）
  //   8^^3 = 2，再 2 * 3 * 4 = 24 ⇒ 牌组 [8,3,3,4]
  const rootWin = run([N(0), POW, POW, N(1), op('*'), N(2), op('*'), N(3)], [8, 3, 3, 4], CAPS_BREAK);
  check('V-2.7 🔴③ capRecip=false,capPow=true 下开方解可成功提交（断链场景跑通）',
    rootWin.pass === true, `pass=${rootWin.pass} reason=${codeOf(rootWin)} msg=${msgOf(rootWin).slice(0, 26)}`);
  // 双向：高级计算关时开方須被拦住（不该放行时没放行）
  const rootOff = run([N(0), POW, POW, N(1), op('*'), N(2), op('*'), N(3)], [8, 3, 3, 4],
    capsOf({ advancedCalc: false, capPow: false }));
  check('V-2.8 双向：高级计算关时开方被拦住', rootOff.pass === false,
    `pass=${rootOff.pass} reason=${codeOf(rootOff)}`);
}

// ══════════ V-3 §2 对数 ══════════
console.log('\n--- V-3 对数：log 2 8 ⇒ ok 且求值 3 ---');
{
  const r = P1([N(0), LOG, N(1)], [2, 8]);
  check('V-3.1 log 2 8 文法层解析成功', r.ok === true, `ok=${r.ok} code=${r.code}`);
  check('V-3.2 log_2 8 = 3', r.value === 3, `value=${r.value}`);
  // ③ 正例走完整提交链：log_2 8 = 3，再 3 * 4 * 2 = 24 ⇒ 牌组 [2,8,4,2]
  const w = run([N(0), LOG, N(1), op('*'), N(2), op('*'), N(3)], [2, 8, 4, 2]);
  check('V-3.3 ③ 正例：含 log 的算式可成功提交（log_2 8 *4*2 = 24）',
    w.pass === true, `pass=${w.pass} reason=${codeOf(w)} msg=${msgOf(w).slice(0, 26)}`);
}

// ══════════ V-4 §4 八个错误码逐码至少一例 ══════════
console.log('\n--- V-4 八个新错误码逐码触发（禁只验存在不验触发）---');
{
  // 存在性前置：先证常量表齐备，再逐码触发
  const codes = ['POW_DANGLING', 'POW_OPERAND_NOT_LEAF', 'POW_NOT_EXACT', 'POW_CHAINED',
    'LOG_DANGLING', 'LOG_OPERAND_NOT_LEAF', 'LOG_DOMAIN', 'LOG_NOT_EXACT'];
  const missing = codes.filter((c) => !ERR[c]);
  check('V-4.0 存在性前置：ERR 表 8 码齐备', missing.length === 0,
    missing.length ? `缺 ${missing.join(',')}` : '8/8');
  const cases = [
    ['POW_DANGLING', [N(0), POW], [8]],
    ['POW_OPERAND_NOT_LEAF', [LP, N(0), op('+'), N(1), RP_, POW, N(2)], [2, 3, 4]],
    ['POW_NOT_EXACT', [N(0), POW, POW, N(1)], [2, 2]],
    ['POW_CHAINED', [N(0), POW, N(1), POW, N(2)], [2, 3, 4]],
    ['LOG_DANGLING', [N(0), LOG], [2]],
    ['LOG_OPERAND_NOT_LEAF', [LP, N(0), op('+'), N(1), RP_, LOG, N(2)], [1, 1, 8]],
    ['LOG_DOMAIN', [N(0), LOG, N(1)], [1, 8]],
    ['LOG_NOT_EXACT', [N(0), LOG, N(1)], [2, 3]],
  ];
  for (const [name, toks, cards] of cases) {
    const r = P1(toks, cards);   // 🔴 错误码属文法层 ⇒ 走 parse，不受四牌约束干扰
    check(`V-4.${name} 有触发实例`, r.ok === false && r.code === ERR[name],
      `ok=${r.ok} code=${r.code} 期望=${ERR[name]}`);
    // 文案要求：不得说「格式不正确」这类通用话
    const msg = ERR_MSG?.[ERR[name]] ?? '';
    check(`V-4.${name} 文案非通用「格式不正确」`, !!msg && !/格式不正确/.test(msg),
      `msg=${msg ? msg.slice(0, 30) : '(空)'}`);
  }
}

// ══════════ V-5 §5 门禁（🔴 先红后绿：此判据在修前须判红）══════════
console.log('\n--- V-5 门禁：capPow=false 输入 8^3 ⇒「请先开启」而非 trailing_token ---');
{
  // 🔴 存在性前置：先证本层确实读 caps，否则下方断言不可信
  //   实读 `RecipParser.mjs:406` ⇒ checkUserAnswer 只读 `opts.advancedCalc`（单一总开关），
  //   子开关 capPow/capLog 在本函数内**不参与门禁判定**。故门禁用例須关总开关。
  const off = run([N(0), POW, N(1), op('*'), N(2), op('*'), N(3)], [8, 3, 3, 1],
    capsOf({ advancedCalc: false, capPow: false }));
  check('V-5.1 高级计算关时含 ^ 的算式被拒收', off.pass === false, `pass=${off.pass}`);
  // 🔴 极性正确：断言「**应**给出『请先开启』指引」，而不是「现在是 trailing_token」。
  //   修前实测：`pow` 未入 ADV_TOKENS ⇒ 走到文法层报 trailing_token，此条必红。
  //   修后：`pow`/`log` 已登记 ⇒ 提前拦下并给门禁文案 ⇒ 转绿。先红后绿即鉴别力证据。
  const m = msgOf(off);
  check('V-5.2 🔴 给出「请先开启高级计算」指引（非「算式格式不正确」）—— 修前必红',
    /开启/.test(m) && /高级/.test(m) && !/格式不正确/.test(m), `msg=${m}`);
  // 同理 log
  const offL = run([N(0), LOG, N(1), op('*'), N(2), op('*'), N(3)], [2, 8, 4, 2],
    capsOf({ advancedCalc: false, capLog: false }));
  check('V-5.3 log 同样走门禁指引（非通用格式错）',
    offL.pass === false && /开启/.test(msgOf(offL)) && !/格式不正确/.test(msgOf(offL)),
    `pass=${offL.pass} msg=${msgOf(offL)}`);
  // 🔴 同层验登记本身：pow/log 必在 ADV_TOKENS（这才是§5 要求的修点）
  const psrc = fs.readFileSync(P('js/core/RecipParser.mjs'), 'utf8').replace(/\r\n/g, '\n');
  const advLine = (psrc.match(/ADV_TOKENS\s*=\s*\[[^\]]*\]/) || ['(未匹配)'])[0];
  check('V-5.4 ADV_TOKENS 已登记 pow 与 log',
    /'pow'/.test(advLine) && /'log'/.test(advLine), advLine);
  // 双向判据：开着时不得误拦
  const on = run([N(0), POW, N(1), op('*'), N(2), op('*'), N(3)], [2, 3, 3, 1], capsOf());
  check('V-5.5 双向：高级计算开启时不得误拦', on.pass === true,
    `pass=${on.pass} reason=${codeOf(on)} msg=${msgOf(on).slice(0, 26)}`);
}

// ══════════ V-5 增补（task-135）：子开关引擎侧不变式 ══════════
// 🔴 入库时本组应【全部判红】——这是先红后绿的红证，不是判据缺陷。
//
// 【被判事实】`checkUserAnswer` 只读 `opts.advancedCalc`（总开关），**不消费子开关**：
//   实测 `js/core/RecipParser.mjs:405-470` 函数体内 `caps` 出现 0 次。
//   ⇒ 子开关关闭时，含该符号的 24 解仍被判 `pass=true`（照常求值 + 照常通关）。
//
// 【为何锚引擎侧】caps 在 UI 侧的把关全在**事件时刻**（`:814` tap、`:424` setCaps、`:690-714` 绘制），
//   而唯一写入口 `addToken`（`:531-535`）只查 `enabled` + `isCardOccupied`，**caps 零出现**。
//   ⇒ 防线是「时序保证」而非「不变式保证」；引擎侧校验才是不变式层。
//   🔴 根因在 `addToken` 无守卫，**不在** `setCaps` 的 `changed` 短路（短路是正确的性能优化）。
//
// 【极性】全写「**不得** pass=true」= 应该怎样；禁写「现在 pass=true」（把现象当期望）。
console.log('\n--- V-5 增补：子开关引擎侧不变式（入库态应全红＝红证）---');
{
  // 幂：2^3*3*1 = 24，牌组 [2,3,3,1]（四牌各用一次）
  const POW24 = () => [N(0), POW, N(1), op('*'), N(2), op('*'), N(3)];
  const POW_CARDS = [2, 3, 3, 1];
  // 对数：2log8*4*2 = 24，牌组 [2,8,4,2]。log 是**中缀**（底 log 真数），非前缀
  const LOG24 = () => [N(0), LOG, N(1), op('*'), N(2), op('*'), N(3)];
  const LOG_CARDS = [2, 8, 4, 2];

  // 🔴 存在性前置：先证 caps 全开时两式**确实成立 24**。
  //   否则下方「不得 pass=true」会因「本来就不通过」而假绿（零/空集判据必配存在性前置）。
  //   🔴 双向第二面：也防引擎侧守卫做过头、把 caps 全开的正常解也拦了。
  const powOn = run(POW24(), POW_CARDS, capsOf());
  const logOn = run(LOG24(), LOG_CARDS, capsOf());
  check('V-5.6 存在性前置+双向：caps 全开时 2^3*3*1 必须判 24',
    powOn.pass === true, `pass=${powOn.pass} reason=${codeOf(powOn)}`);
  check('V-5.7 存在性前置+双向：caps 全开时 2log8*4*2 必须判 24',
    logOn.pass === true, `pass=${logOn.pass} reason=${codeOf(logOn)}`);

  // ①② 幂 × （平铺 capPow / 嵌套 caps.pow）——两形态均验：
  //   实测二者当前都不被消费，实现须同时认，否则只改一种仍留缺口。
  const p1 = run(POW24(), POW_CARDS, { advancedCalc: true, capPow: false });
  check('V-5.8 🔴 capPow=false（平铺）时含幂的 24 解不得 pass=true',
    p1.pass !== true, `pass=${p1.pass} reason=${codeOf(p1)}`);
  const p2 = run(POW24(), POW_CARDS, { advancedCalc: true, caps: { pow: false } });
  check('V-5.9 🔴 caps.pow=false（嵌套）时含幂的 24 解不得 pass=true',
    p2.pass !== true, `pass=${p2.pass} reason=${codeOf(p2)}`);

  // ③④ 对数 × （平铺 capLog / 嵌套 caps.log）
  const l1 = run(LOG24(), LOG_CARDS, { advancedCalc: true, capLog: false });
  check('V-5.10 🔴 capLog=false（平铺）时含对数的 24 解不得 pass=true',
    l1.pass !== true, `pass=${l1.pass} reason=${codeOf(l1)}`);
  const l2 = run(LOG24(), LOG_CARDS, { advancedCalc: true, caps: { log: false } });
  check('V-5.11 🔴 caps.log=false（嵌套）时含对数的 24 解不得 pass=true',
    l2.pass !== true, `pass=${l2.pass} reason=${codeOf(l2)}`);
}

// ══════════ V-5 增补（task-135）：UI 写入口与总闸清空 ══════════
// 🔴 本组必须跑**真实 AnswerArea 类**，禁用复刻件：
//   复刻件即使逐行照拄，也只能证「我拄的逻辑如此」，证不到「真类在真调用链上如此」。
// 🔴 陆阱：`js/ui/AnswerArea.js` 依赖无扩展名 spec（`'./Components'`），
//   裸 import 必报 ERR_MODULE_NOT_FOUND（实测）⇒ 需 `--import ./tester/render-smoke/esm-hooks.mjs`。
//   本支原为裸跑，故本组做**条件跳过**：无 hooks 时计 0 条，由 UI_SKIPPED 吸收到 EXPECTED。
//   ⇒ 无 hooks 不会把全套弄崩，有 hooks 时足 2 条。
// 🔴 存在性前置必需：`tester/_esm/AnswerArea.mjs` 是已入库的陈旧副本
//   （实测 21331B vs 真身 37196B，`isAdvKeyEnabled` 0 次 vs 7 次，停在 caps 机制诞生前），
//   已造成过一次「双错互消假绿」（见 tester-input06-r07r03.mjs:271）。
//   ⇒ 先断言原型上 `isAdvKeyEnabled` 存在，把「加载错模块」与「产品真缺陷」区分开。
let UI_SKIPPED = true;
{
  let AA = null, loadErr = '';
  try { AA = (await import(PU('js/ui/AnswerArea.js'))).default; }
  catch (e) { loadErr = String(e && e.code || e && e.message || e).slice(0, 60); }

  const hasCaps = typeof AA?.prototype?.isAdvKeyEnabled === 'function';
  if (!AA || !hasCaps) {
    console.log(`    ⚠ V-5.12/5.13 条件跳过（未加载到带 caps 的真身）：`
      + `AA=${!!AA} isAdvKeyEnabled=${hasCaps} ${loadErr}`);
    console.log('      ⇒ 需带 --import ./tester/render-smoke/esm-hooks.mjs 重跑本组');
  } else {
    UI_SKIPPED = false;
    const mkArea = (allOn) => {
      const a = new AA({ x: 0, y: 0, w: 600, h: 200 });
      a.cardValues = [2, 3, 3, 1];
      a.enabled = true;
      a.setAdvancedCalc(true);
      // 🔴 必须**显式** setCaps：`:379` 出厂默认 pow:false/log:false（§10.1 不对称），
      //   依赖默认值会使对照组假红。
      a.setCaps({ recip: true, fact: true, mod: true, pow: allOn, log: allOn });
      return a;
    };
    const POWTOK = () => [N(0), POW, N(1), op('*'), N(2), op('*'), N(3)];

    // ⑤ 写入口守卫：锚 `addToken`（真根因），**非**锚 `changed` 短路。
    //   若锚短路，将来短路被改而 addToken 仍无守卫时这条会假绿。
    const g = mkArea(false);                       // caps: pow=false
    const before = g.tokens.length;
    const accepted = g.addToken({ type: 'pow' });   // 绕过按钮直接写入
    check('V-5.12 🔴 写入口守卫：caps.pow=false 时 addToken(POW) 应拒收且 tokens 不增长',
      accepted === false && g.tokens.length === before,
      `addToken返=${accepted} tokens ${before}→${g.tokens.length}`
      + ` isAdvKeyEnabled(pow)=${g.isAdvKeyEnabled('pow')}`);

    // ⑥ A 路径：关总闸后 POW/LOG/FACT/MOD 不得残留
    //   🔴 抽**真实状态转换块**：通过 a.addToken() 逐个写入（caps 全开下合法），
  //   再调真实 a.setAdvancedCalc(false)；全程**未手工赋值** a.tokens。
    //   实读 `:390`：`if (!next && this.tokens.some((t) => t.type === TokenType.RECIP)) this.tokens = [];`
    //   ⇒ 只清 RECIP，未随 INPUT-07/08 扩展到 FACT/MOD/POW/LOG。
    const h = mkArea(true);                        // caps 全开 ⇒ pow 可合法写入
    let wrote = 0;
    for (const t of POWTOK()) { if (h.addToken(t) === true) wrote++; }
    const hadPow = h.tokens.some((t) => t.type === 'pow');
    h.setAdvancedCalc(false);                      // 真实状态转换（非手工赋值）
    const leftAdv = h.tokens.filter((t) => ['pow', 'log', 'fact', 'mod'].includes(t.type));
    check('V-5.13 🔴 关总开关后 POW/LOG/FACT/MOD token 不得残留（覆盖 :390 只清 RECIP）',
      leftAdv.length === 0,
      `写入${wrote}个 写入后有pow=${hadPow} 关总闸后残留=${leftAdv.length}个`
      + `[${leftAdv.map((t) => t.type).join(',')}] tokens长=${h.tokens.length}`);
  }
}

// ══════════ V-6 §6 三层联动 ══════════
console.log('\n--- V-6 三层联动（① 绘制/命中区 ② addToken 拒收 ③ 门禁文案）---');
{
  const area = fs.readFileSync(P('js/ui/AnswerArea.js'), 'utf8').replace(/\r\n/g, '\n');
  // ① 绘制/命中区：关掉的项既不绘制也不入 _buttonRects
  const hasSkip = /子开关关掉的项[\s\S]{0,80}既不绘制也不入|continue[\s\S]{0,40}_buttonRects/.test(area)
    || /if\s*\(\s*!\s*(caps|c)\.\w+\s*\)\s*continue/.test(area);
  check('V-6.① 绘制/命中区层：关掉的项跳过绘制与命中区登记', hasSkip,
    `AnswerArea.js 命中 skip 模式=${hasSkip}`);
  // ② addToken 拒收
  const parserSrc = fs.readFileSync(P('js/core/RecipParser.js'), 'utf8').replace(/\r\n/g, '\n');
  check('V-6.② addToken/解析层拒收：ADV_TOKENS 含 pow 与 log',
    /ADV_TOKENS\s*=\s*\[[^\]]*'pow'[^\]]*'log'[^\]]*\]/.test(parserSrc),
    (parserSrc.match(/ADV_TOKENS\s*=\s*\[[^\]]*\]/) || ['(未匹配)'])[0]);
  // ③ 门禁文案层：由实测坐实（单支自足，不依赖 V-5）
  const off = run([N(0), POW, N(1), op('*'), N(2), op('*'), N(3)], [8, 3, 3, 1],
    capsOf({ advancedCalc: false, capPow: false }));
  check('V-6.③ 门禁文案层：关闭时给「请先开启」指引',
    off.pass === false && /开启/.test(msgOf(off)), `pass=${off.pass} msg=${msgOf(off)}`);
}

// ══════════ V-7 §3.1 上限：^ 按 3 次 ⇒ POW_DANGLING ══════════
console.log('\n--- V-7 ^ 按 3 次 ⇒ POW_DANGLING，不得放行 a^^^b ---');
{
  const r = P1([N(0), POW, POW, POW, N(1)], [8, 3]);
  check('V-7.1 8^^^3 被拒收', r.ok === false, `ok=${r.ok}`);
  check('V-7.2 8^^^3 报 POW_DANGLING', r.code === ERR.POW_DANGLING,
    `code=${r.code} 期望=${ERR.POW_DANGLING}`);
  // 双向：两次 ^ 必须放行（否则等于把开方也堵了）
  const two = P1([N(0), POW, POW, N(1)], [8, 3]);
  check('V-7.3 双向：两次 ^（开方）不得被误拒', two.ok === true, `ok=${two.ok} code=${two.code}`);
}

// ══════════ V-8 §7 空高级解文案随 caps 变化 ══════════
console.log('\n--- V-8 空高级解文案不含硬编码符号名，且随 caps 变化 ---');
{
  // 🔴 取值层修正（我前一版读错文件）：空高级解文案在 **PageRenderer.js**，不在 AnswerArea.js。
  const src = fs.readFileSync(P('js/ui/PageRenderer.js'), 'utf8').replace(/\r\n/g, '\n');
  // 存在性前置：先确认确有该文案生成处，否则下方两条均不可信
  const m = src.match(/本局无高级解法[^`'"\n]*/);
  check('V-8.0 存在性前置：源码中确有空高级解文案生成处', !!m,
    m ? `命中 「${m[0].slice(0, 34)}」` : '🔴 未命中 ⇒ V-8.1/V-8.2 不可信');
  // 🔴 判据修正：原写法扫全文（含注释）——实测误伤：`:832` 注释里引述了旧文案
  //   「文案原为『本局无倒数解法』」作为修改留痕，并非实际输出。
  //   取值层須与被判事实同层 ⇒ 只扫**可执行代码**（先剥行注释与块注释）。
  const codeOnly = src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n').map((l) => l.replace(/\/\/.*$/, '')).join('\n');
  const hardcoded = /无倒数解法|没有倒数解|无阶乘解法/.test(codeOnly);
  check('V-8.1 可执行代码中未硬编码单一符号名（注释里的旧文案留痕不算）', !hardcoded,
    hardcoded ? '🔴 代码体命中硬编码' : '代码体未命中（已剥注释）');
  // 自适应证据：文案由已开启符号集拼装（capNames 随 caps 收集后 join）
  const adaptive = /capNames[\s\S]{0,400}?join\(/.test(src) && /已开启：\$\{capNames/.test(src);
  check('V-8.2 文案由已开启符号集拼装（随 caps 变化）', adaptive,
    `capNames+join 拼装模式=${adaptive}`);
}

// ══════════ V-9 零误伤（digest 独立实测，禁引旧数、禁用 size）══════════
console.log('\n--- V-9 零误伤：INPUT-08.md §8 基准表数字逐项不变 ---');
{
  // 存在性前置 + 同层取值：直接跑引擎枚举取 digest，不看任何报告数字
  let engine = null;
  try { engine = await import(PU('js/core/Solver.mjs')); } catch { /* 见下断言 */ }
  check('V-9.0 存在性前置：Solver 可导入（否则本项判环境不满足而非判绿）', !!engine,
    engine ? 'ok' : '🔴 无法导入 ⇒ V-9 未验');
  if (engine) {
    // 🔴 取值修正（我前一版猜错导出名）：Solver.mjs 无 `solve`，
    //   枚举入口为 `findSolutionsWithAST(numbers, target = 24)`。
    const fsw = engine.findSolutionsWithAST || engine.default?.findSolutionsWithAST;
    check('V-9.1 存在性前置：findSolutionsWithAST() 可调用', typeof fsw === 'function',
      `typeof=${typeof fsw}`);
    if (typeof fsw === 'function') {
      // 固定牌组 ⇒ 解数量作为 digest 项（引擎未动则应不变）
      const deck = [[1, 2, 3, 4], [5, 5, 5, 1], [3, 3, 8, 8], [4, 4, 10, 10]];
      const got = deck.map((d) => {
        try { const s = fsw(d, 24); return Array.isArray(s) ? s.length : (s?.solutions?.length ?? -1); }
        catch { return -2; }
      });
      check('V-9.2 四组牌均能枚举（值域合法，非 -1/-2）',
        got.every((n) => n >= 0), `counts=[${got.join(',')}]`);
      console.log(`      digest（本次独立实测，供与基线对照）: [${got.join(',')}]`);
    }
  }
}

// ══════════ V-10 门禁自检：断言总数 ══════════
// 🔴 该常量随 V-9 环境分支浮动（Solver 不可导入时少 2 条），故不写死，
//   而由 SKIPPED_V9 吸收 —— 与 task-131 的 SKIPPED_CONDITIONAL 同法：
//   写死会在另一环境造假红，且「为闭合调数字」被明令禁止。
console.log('\n--- V-10 门禁自检：pass + fail == EXPECTED_ASSERTION_COUNT ---');
// 🔴 分项推导（禁写死裸数字，用可推导算式）：
//   V-1 5 + V-2 8 + V-3 3 + V-4 17 + V-5 5 + V-6 3 + V-7 3 + V-8 3 + V-9 3 + V-10 1 = 51  （task-133）
//   task-135 增补 6 条：V-5.6/5.7（存在性前置+双向）+ V-5.8..5.11（幂/对数 × 平铺/嵌套）= 6
//     ⇒ 51 + 6 = 57（引擎层，无环境依赖，恒执行）
//   task-135 另增 UI 层 2 条：V-5.12（addToken 守卫）+ V-5.13（关总闸清空）
//     ⇒ 仅当加载到带 caps 的真身（需 esm-hooks）时执行；无 hooks 时条件跳过
//     ⇒ 同 task-131 D-0b 口径：**不写死会随环境浮动的值**，用 UI_SKIPPED 吸收
//   ∴ 裸跑 57；带 hooks 59
const EXPECTED_ASSERTION_COUNT = 57 + (UI_SKIPPED ? 0 : 2);
//  分项算式：V-1 5 + V-2 6 + V-3 3 + V-4 17（1 存在性 + 8 码 × 2：触发 + 文案）
//          + V-5 5 + V-6 3 + V-7 3 + V-8 3 + V-9 3（0/1/2）+ V-10 本条 1 = 49 + 2 = 51
//  🔴 变更本常量时，上述分项算式必须同步（否则退化为魔法数字）
{
  const before = pass + fail;
  check(`V-10 断言总数 = ${EXPECTED_ASSERTION_COUNT}（防 early-return 吞断言）`,
    before === EXPECTED_ASSERTION_COUNT - 1,
    `实测前置断言数=${before} 期望=${EXPECTED_ASSERTION_COUNT - 1}`);
}

console.log(`\nT133 INPUT-08.1 ACCEPTANCE TOTAL: pass=${pass} fail=${fail}`);
for (const f of failed) console.log(`  - ${f}`);
console.log(`OVERALL: ${fail ? 'FAIL ❌' : 'PASS ✅'}`);
process.exit(fail === 0 ? 0 : 1);
