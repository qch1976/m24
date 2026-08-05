#!/usr/bin/env node
// tools/verify/verify-mjs-behavior.mjs — B 层：语义重写子集的【行为等价】断言（task-71）
//
// ═══════════════════════════════════════════════════════════════════════════
// 【为什么这支脚本存在 —— 别改回文本比对】
//   Card / DealGenerator / Deck 三对 .js/.mjs 是**按同一语义重写**过的子集副本，
//   不是「.js 删掉几行」。实测差异包括：
//     · 语句形态：`if (x) {\n throw ...\n}`  ⇔  `if (x) throw ...`
//     · 局部变量重命名：Deck.js `lastCards`  ⇔  Deck.mjs `last`
//     · 箭头参数括号：`(c) => c.value`       ⇔  `c => c.value`
//     · 报错文案整段重写：中文「连续 N 次未抽到可解组合」⇔ 英文 `N attempts failed`
//   ⇒ 任何**文本**口径（逐行 diff / 压平子串 / 子序列包含）要么必然误报，
//     要么鉴别力低到「几乎放行任何东西」。后者更危险：
//     **能刷绿的门禁比没有门禁更危险，因为它让人相信有防护。**（团队规则 21）
//   ⇒ 故本层不比文本，**比行为**：同时 import .js 与 .mjs，喂相同输入，比实际输出。
//
// 【口径设计要点】
//   1. 覆盖正常值**与异常路径**。掏空实现最常先丢掉异常分支
//      （如 Card 的 `unknown rank` 抛错），只测正常值抓不到。
//   2. 断言比的是**两侧实际返回值/抛错行为**，不是符号名 —— 符号名是行为的代理。
//      实测：把 Card.mjs 的 isRed 逻辑改成 `= false`，导出符号集**完全不变**。
//   3. 不比报错**文案**（两侧本就不同，且文案不是行为契约），只比**是否抛错**。
//
// 【依赖】复用 tester/render-smoke/esm-hooks.mjs（团队既有基建）：
//   产品 .js 用 ESM 语法但 import 不带扩展名、且无 "type":"module"，
//   直接 import 会 ERR_MODULE_NOT_FOUND / SyntaxError。hooks 负责补 .js 后缀
//   并强制按 ESM 解析，**产品代码字节零改动**。
//   ⇒ 故本脚本必须这样跑（裸跑必失败，属预期）：
//        node --import ./tester/render-smoke/esm-hooks.mjs tools/verify/verify-mjs-behavior.mjs
//
// 【⚠️ 冻结区红线】
//   js/core/Card.js 属冻结区 6 文件（相对 5b80efa 字节零变化）。
//   若本门禁判 Card 行为不一致，**唯一合法解是改 Card.mjs，绝对不许动 Card.js**。
//
// 取退出码：不经管道；必须经管道时用 ${PIPESTATUS[0]}。
// ═══════════════════════════════════════════════════════════════════════════

let pass = 0, fail = 0;
const bad = [];

const ck = (name, cond, detail = '') => {
  if (cond) { pass++; console.log(`  ok  ${name}${detail ? '   ' + detail : ''}`); }
  else { fail++; bad.push(name); console.log(`  XX  ${name}   ${detail}`); }
};

/** 比对两侧同一调用的行为：返回值深比，或「两侧都抛错」。 */
const sameBehavior = (label, fnJs, fnMjs) => {
  let rj, rm, ej = null, em = null;
  try { rj = fnJs(); } catch (e) { ej = e; }
  try { rm = fnMjs(); } catch (e) { em = e; }
  if (ej || em) {
    // 只比「是否抛错」，不比文案 —— 两侧文案本就不同，文案不是行为契约
    ck(`${label}（异常路径两侧一致）`, !!ej === !!em,
      `js抛错=${!!ej} mjs抛错=${!!em}${ej ? ' jsMsg=' + String(ej.message).slice(0, 40) : ''}`);
    return;
  }
  const a = JSON.stringify(rj), b = JSON.stringify(rm);
  ck(`${label}`, a === b, a === b ? '' : `js=${String(a).slice(0, 60)} mjs=${String(b).slice(0, 60)}`);
};

console.log('='.repeat(70));
console.log('[mjs-behavior] B 层：语义重写子集的行为等价断言（Card / DealGenerator / Deck）');
console.log(`Node ${process.version}`);
console.log('='.repeat(70));

// ═══════════════════════════════════════════════════════════════════════════
// 【裸跑自我说明】（补 task-74 缺口；模式照搬已入库的 p0-render-path.mjs）
//   本脚本必须挂 ESM hooks 运行。裸跑时报错形式【因平台而异】：
//     Linux   : ERR_MODULE_NOT_FOUND（Cannot find module '.../Components'）
//     Windows : SyntaxError: Unexpected token 'export' / Cannot use import
//               statement outside a module（CJS 回退所致，同一缺陷两种表现）
//   光看这些报错极易误判成「产品代码坏了」，故失败时打印可直接复制的命令行。
//
// ⚠️ 本提示【印不出来】的三种情形（规则 19：探测也有地板）：
//   (a) 若把下方 await import 改回顶层静态 import —— 静态 import 在**链接阶段**
//       失败，早于任何顶层代码执行，catch 根本不会跑到。故必须保持动态 import。
//       ⇒ 本文件 11 处产品 import 全部为 await import，且统一走下方 imp()。
//   (b) Node < 18.18：`--import` 本身是未知 flag（双线 backport，added in
//       v19.0.0 / v18.18.0），Node 在**命令行解析阶段**就退出
//       （`node: bad option: --import`，exit=9），本文件 JS 压根未执行。
//   (c) esm-hooks.mjs 自身缺 module.registerHooks 时，由它自己 exit(2) 并打印，
//       不会走到这里。
//   ⇒ 这三种情形下真正的读者是**事后翻文件排查的人**，故说明写在源码里。
//
// 【为何用 imp() 包装而非单个 try/catch】
//   本文件有 11 处产品 import，散落在 Card / Deck / DealGenerator 三段。
//   单个 try 只能护住第一处；一旦有人在后面新增 import 就漏出裸报错。
//   故统一经 imp()，新增 import 天然继承 guard。
// ═══════════════════════════════════════════════════════════════════════════
const HOOKS_CMD =
  'node --import ./tester/render-smoke/esm-hooks.mjs tools/verify/verify-mjs-behavior.mjs';

function explainHooksMissing(e, spec) {
  // ⚠️ 这里必须把 code 与 message **都**纳入匹配，不能写 `e.message || e.code`。
  //   实测（Linux/Node v22）：缺 hooks 时 `import('js/core/Deck.js')` 抛出的错
  //     e.code    = 'ERR_MODULE_NOT_FOUND'
  //     e.message = "Cannot find module '.../Card' imported from .../Deck.js"
  //   `(message || code)` 短路只取到 message，而 message 里**不含**
  //   'ERR_MODULE_NOT_FOUND' 字样 ⇒ 所有 code 类判据全部失配 ⇒ guard 静默失效，
  //   把裸报错原样抛回，rc=1 且无任何人话提示。我第一版就是这么写的，实测才抓到。
  //   ⇒ 教训同族于「把间接量当直接量」：想判 code 就直接读 code，别经 message 代理。
  const code = String((e && e.code) || '');
  const text = String((e && e.message) || '');
  const msg = (code + ' ' + text).trim() || String(e);
  const isHooksMissing =
    /ERR_MODULE_NOT_FOUND/.test(msg) ||
    /ERR_UNKNOWN_FILE_EXTENSION/.test(msg) ||
    /Cannot find module/.test(msg) ||
    /Cannot use import statement outside a module/.test(msg) ||
    /Unexpected token 'export'/.test(msg) ||
    /Failed to load the ES module/.test(msg);
  if (!isHooksMissing) throw e;   // 真异常原样抛出，绝不吞掉
  const L = '='.repeat(78);
  console.error('\n' + L);
  console.error('[mjs-behavior] 🔴 本门禁必须挂 ESM hooks 运行，不能裸跑');
  console.error(L);
  console.error('  直接跑这一行即可：\n');
  console.error('    ' + HOOKS_CMD + '\n');
  console.error(L);
  console.error('  原因：产品 js/**.js 用 ESM 语法但 import 不带扩展名，');
  console.error('        且仓库无 "type":"module" ⇒ Node 按 CJS 解析即报错。');
  console.error('        hooks 负责补 .js 后缀并强制按 ESM 加载，产品代码字节零改动。');
  console.error('  加载失败的模块：' + spec);
  console.error('  环境：node=' + process.version + '  platform=' + process.platform);
  console.error('  cwd =' + process.cwd());
  console.error('  原始报错：' + (code ? '[' + code + '] ' : '') + text.split('\n')[0]);
  console.error(L + '\n');
  process.exit(2);
}

// 统一入口：所有产品模块 import 都走这里，失败即给人话提示。
// 借鉴测试专家 verify-frozen6.mjs 的「存在性先于一致性」——
// 先证「模块能加载」，再谈「两侧行为是否一致」；
// 否则「加载不了」会被读成「没有差异」，那是最坏的一种假绿。
async function imp(spec) {
  try {
    return await import(spec);
  } catch (e) {
    explainHooksMissing(e, spec);
  }
}

// ── Card ──────────────────────────────────────────────────────────────────
console.log('\n── Card：构造行为 + 查表 + 异常分支 ──');
const CardJs = await imp('../../js/core/Card.js');
const CardMjs = await imp('../../js/core/Card.mjs');

// 导出符号先对齐（必要但不充分 —— 故后面还要比行为）
{
  const a = Object.keys(CardJs).sort().join(',');
  const b = Object.keys(CardMjs).sort().join(',');
  ck('Card 导出符号集一致', a === b, a === b ? a : `js=[${a}] mjs=[${b}]`);
}

// RANK_VALUE 查表：正常值（不依赖排版，直接比值）
for (const r of ['A', '5', '10', 'J', 'Q', 'K', 'big', 'small']) {
  ck(`Card RANK_VALUE['${r}'] 两侧同值`,
    CardJs.RANK_VALUE[r] === CardMjs.RANK_VALUE[r],
    `js=${CardJs.RANK_VALUE[r]} mjs=${CardMjs.RANK_VALUE[r]}`);
}

// 实例属性：这是「掏空函数体」最容易漏的地方（isRed/isJoker/displayRank/value）
const cardCases = [
  ['heart', 'A'], ['spade', 'K'], ['diamond', '7'],
  ['club', '10'], ['joker', 'big'], ['joker', 'small'],
];
for (const [suit, rank] of cardCases) {
  sameBehavior(`new Card('${suit}','${rank}') 四属性`,
    () => { const c = new CardJs.default(suit, rank); return [c.value, c.isRed, c.isJoker, c.displayRank]; },
    () => { const c = new CardMjs.default(suit, rank); return [c.value, c.isRed, c.isJoker, c.displayRank]; });
}

// RANKS / SUITS 常量表：曾漏断言（随 8 项缺口一同补）。
// 直接比序列而非长度 —— 长度相同但内容/顺序不同会影响 buildFullDeck 与 UI 渲染。
sameBehavior('Card RANKS 序列完全一致',
  () => CardJs.RANKS.join('|'),
  () => CardMjs.RANKS.join('|'));
sameBehavior('Card SUITS 序列完全一致',
  () => CardJs.SUITS.join('|'),
  () => CardMjs.SUITS.join('|'));

// RANK_VALUE 全量键集（上面只抽了 8 个 key，漏键/多键抓不到）
sameBehavior('Card RANK_VALUE 全量键值对',
  () => Object.keys(CardJs.RANK_VALUE).sort().map((k) => `${k}=${CardJs.RANK_VALUE[k]}`).join(','),
  () => Object.keys(CardMjs.RANK_VALUE).sort().map((k) => `${k}=${CardMjs.RANK_VALUE[k]}`).join(','));

// 异常路径：unknown rank 两侧都须抛错。掏空实现常先丢异常分支。
sameBehavior("new Card('heart','ZZZ') 未知 rank",
  () => new CardJs.default('heart', 'ZZZ'),
  () => new CardMjs.default('heart', 'ZZZ'));

// buildFullDeck：牌堆规模与内容分布
sameBehavior('buildFullDeck() 张数',
  () => CardJs.buildFullDeck().length,
  () => CardMjs.buildFullDeck().length);
sameBehavior('buildFullDeck() value 多重集（排序后）',
  () => CardJs.buildFullDeck().map((c) => c.value).sort((x, y) => x - y),
  () => CardMjs.buildFullDeck().map((c) => c.value).sort((x, y) => x - y));
sameBehavior('buildFullDeck() 大小王计数',
  () => CardJs.buildFullDeck().filter((c) => c.isJoker).length,
  () => CardMjs.buildFullDeck().filter((c) => c.isJoker).length);
sameBehavior('buildFullDeck() 红牌计数',
  () => CardJs.buildFullDeck().filter((c) => c.isRed).length,
  () => CardMjs.buildFullDeck().filter((c) => c.isRed).length);

// ── Deck ──────────────────────────────────────────────────────────────────
console.log('\n── Deck：发牌规模 + 可解性 + 异常分支 ──');
const DeckJs = await imp('../../js/core/Deck.js');
const DeckMjs = await imp('../../js/core/Deck.mjs');
{
  const a = Object.keys(DeckJs).sort().join(',');
  const b = Object.keys(DeckMjs).sort().join(',');
  ck('Deck 导出符号集一致', a === b, a === b ? a : `js=[${a}] mjs=[${b}]`);
}

// deal(n)：规模契约。牌是随机的，故比**不变量**而非具体牌面。
for (const n of [1, 4, 5]) {
  sameBehavior(`Deck.deal(${n}) 返回张数`,
    () => new DeckJs.default().deal(n).length,
    () => new DeckMjs.default().deal(n).length);
}
sameBehavior('Deck.deal(4) 元素均为 Card 且 value 为数字',
  () => new DeckJs.default().deal(4).every((c) => typeof c.value === 'number'),
  () => new DeckMjs.default().deal(4).every((c) => typeof c.value === 'number'));

// dealSolvable：核心契约 —— 返回的 4 张必须真可解（用各自的 Solver 判）
sameBehavior('Deck.dealSolvable(4) 返回张数',
  () => new DeckJs.default().dealSolvable(4).length,
  () => new DeckMjs.default().dealSolvable(4).length);

// n!==4 时退化为普通发牌（.js 有注释、.mjs 无，但行为须同）
sameBehavior('Deck.dealSolvable(3) 退化为普通发牌',
  () => new DeckJs.default().dealSolvable(3).length,
  () => new DeckMjs.default().dealSolvable(3).length);

// 可解性实证：连续多轮 dealSolvable 的结果都须被 Solver 判为可解
{
  const solvableJs = await imp('../../js/core/Solver.js');
  const solvableMjs = await imp('../../js/core/Solver.mjs');
  let okJs = 0, okMjs = 0;
  for (let i = 0; i < 20; i++) {
    const vj = new DeckJs.default().dealSolvable(4).map((c) => c.value);
    const vm = new DeckMjs.default().dealSolvable(4).map((c) => c.value);
    if (solvableJs.default.isSolvable(vj, 24)) okJs++;
    if (solvableMjs.default.isSolvable(vm, 24)) okMjs++;
  }
  ck('Deck.dealSolvable 20 轮结果均真可解（两侧）', okJs === 20 && okMjs === 20,
    `js=${okJs}/20 mjs=${okMjs}/20`);
}

// size() / reset() / getDealtCards() / shuffle()
// 这四个曾被漏掉（manager 复核发现：把 size() 改成 return 999，32 项全绿）。
// 教训：断言不能靠“想到哪个写哪个”，必须对着 API 表面逐个过。
sameBehavior('Deck 新建后 size()',
  () => new DeckJs.default().size(),
  () => new DeckMjs.default().size());

// 发牌后 size 递减 —— 抓“return 常量”这类掤空（固定值不会随发牌变）
// ⚠️ 实测：deal() 用 `this.cards.slice(0,n)`，**不从牌堆移除**，故 size 恒为 54。
// 断言标签必须说实话 —— 我初版写「递减」，是我假定的语义，与实现不符。
// 这里比的是「size() 在发牌后仍等于两侧同一值」这一不变量，仍能抓住 return 常量。
for (const n of [1, 4, 13]) {
  sameBehavior(`Deck.deal(${n}) 后 size()（实现为无放回 slice，size 不变）`,
    () => { const d = new DeckJs.default(); d.deal(n); return d.size(); },
    () => { const d = new DeckMjs.default(); d.deal(n); return d.size(); });
}

// 连续发牌的 size 轨迹（序列而非单点，常量返回值必被抓）
sameBehavior('Deck 连续 deal(4)×3 的 size 轨迹（应恒定，非递减）',
  () => { const d = new DeckJs.default(); const t = []; for (let i = 0; i < 3; i++) { d.deal(4); t.push(d.size()); } return t.join('>'); },
  () => { const d = new DeckMjs.default(); const t = []; for (let i = 0; i < 3; i++) { d.deal(4); t.push(d.size()); } return t.join('>'); });

sameBehavior('Deck.reset() 后 size() 为满牌 54',
  () => { const d = new DeckJs.default(); d.deal(10); d.reset(); return d.size(); },
  () => { const d = new DeckMjs.default(); d.deal(10); d.reset(); return d.size(); });

sameBehavior('Deck.reset() 清空 dealtCards',
  () => { const d = new DeckJs.default(); d.deal(4); d.reset(); return d.getDealtCards().length; },
  () => { const d = new DeckMjs.default(); d.deal(4); d.reset(); return d.getDealtCards().length; });

// ⚠️ 实测：dealtCards 是**整体替换**（`this.dealtCards = ...`），非累加。
// deal(4) 后再 deal(3) ⇒ 长度为 3 而非 7。标签按实现写，不按我的猜想写。
sameBehavior('Deck.getDealtCards() 为替换语义（deal(4) 后 deal(3) 得 3）',
  () => { const d = new DeckJs.default(); d.deal(4); d.deal(3); return d.getDealtCards().length; },
  () => { const d = new DeckMjs.default(); d.deal(4); d.deal(3); return d.getDealtCards().length; });

// getDealtCards 返回副本（外部修改不得影响内部状态）
sameBehavior('Deck.getDealtCards() 返回副本而非内部引用',
  () => { const d = new DeckJs.default(); d.deal(4); const g = d.getDealtCards(); g.push('X'); return d.getDealtCards().length; },
  () => { const d = new DeckMjs.default(); d.deal(4); const g = d.getDealtCards(); g.push('X'); return d.getDealtCards().length; });

// shuffle()：随机洞，比不变量 —— 链式返回 this、不丢牌、不重复
sameBehavior('Deck.shuffle() 链式返回自身',
  () => { const d = new DeckJs.default(); return d.shuffle() === d; },
  () => { const d = new DeckMjs.default(); return d.shuffle() === d; });

sameBehavior('Deck.shuffle() 后 size 不变',
  () => { const d = new DeckJs.default(); d.shuffle(); return d.size(); },
  () => { const d = new DeckMjs.default(); d.shuffle(); return d.size(); });

sameBehavior('Deck.shuffle() 后牌面集合无重复无丢失',
  () => { const d = new DeckJs.default(); d.shuffle(); const c = d.deal(52); return new Set(c.map((x) => `${x.suit}-${x.rank}`)).size; },
  () => { const d = new DeckMjs.default(); d.shuffle(); const c = d.deal(52); return new Set(c.map((x) => `${x.suit}-${x.rank}`)).size; });

// ── DealGenerator ─────────────────────────────────────────────────────────
console.log('\n── DealGenerator：模式分派 + 规模 ──');
const DgJs = await imp('../../js/core/DealGenerator.js');
const DgMjs = await imp('../../js/core/DealGenerator.mjs');
{
  const a = Object.keys(DgJs).sort().join(',');
  const b = Object.keys(DgMjs).sort().join(',');
  ck('DealGenerator 导出符号集一致', a === b, a === b ? a : `js=[${a}] mjs=[${b}]`);
}
{
  const SetJs = await imp('../../js/core/Settings.js');
  const modes = Object.values(SetJs.DEAL_MODE ?? {});
  ck('DEAL_MODE 取到模式枚举', modes.length > 0, `modes=[${modes.join(',')}]`);
  // generate(mode) 逐模式分派。
  // 注意：原先这里用「找到第一个名字像 generate 的导出」来选函数 —— 那是**间接量**，
  // 一旦导出改名或新增同类函数，测的就不是原来那个了。改为显式点名。
  for (const m of modes) {
    sameBehavior(`DealGenerator.generate('${m}') 返回张数`,
      () => { const r = DgJs.generate(m); return Array.isArray(r) ? r.length : typeof r; },
      () => { const r = DgMjs.generate(m); return Array.isArray(r) ? r.length : typeof r; });
  }

  // generateRandom / generateSolvable：曾漏断言（manager 复核 Deck.size 时暴露的同族缺口）
  sameBehavior('DealGenerator.generateRandom() 返回张数',
    () => DgJs.generateRandom().length,
    () => DgMjs.generateRandom().length);
  sameBehavior('DealGenerator.generateRandom() 元素均为 Card',
    () => DgJs.generateRandom().every((c) => typeof c.value === 'number'),
    () => DgMjs.generateRandom().every((c) => typeof c.value === 'number'));

  sameBehavior('DealGenerator.generateSolvable() 返回张数',
    () => DgJs.generateSolvable().length,
    () => DgMjs.generateSolvable().length);

  // generateSolvable 的核心契约：结果必须真可解（否则等于退化成 random）
  {
    const SolJs = await imp('../../js/core/Solver.js');
    const SolMjs = await imp('../../js/core/Solver.mjs');
    let okJs = 0, okMjs = 0;
    for (let i = 0; i < 20; i++) {
      if (SolJs.default.isSolvable(DgJs.generateSolvable().map((c) => c.value), 24)) okJs++;
      if (SolMjs.default.isSolvable(DgMjs.generateSolvable().map((c) => c.value), 24)) okMjs++;
    }
    ck('DealGenerator.generateSolvable 20 轮均真可解（两侧）',
      okJs === 20 && okMjs === 20, `js=${okJs}/20 mjs=${okMjs}/20`);
  }
}

console.log('\n' + '='.repeat(70));
console.log(`[mjs-behavior] pass=${pass} fail=${fail}`);
if (fail > 0) {
  console.log(`🔴 FAILED: ${bad.join(' | ')}`);
  console.log('⚠️  若红在 Card：Card.js 属冻结区，唯一合法解是改 Card.mjs，不许改 Card.js。');
} else {
  console.log('✅ 三对语义重写子集行为等价');
}
console.log('='.repeat(70));
process.exit(fail === 0 ? 0 : 1);
