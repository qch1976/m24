// tester-v2-tr-interaction.mjs
// T-R01 ~ T-R07 交互回归（Tester 代码级验证 + mock harness）
// 真机需项目主 GUI 复核，Tester 明确标注"真机待补"（不计 fail）

import fs from 'fs';

let PASS = 0, FAIL = 0, MANUAL = 0;
function check(name, cond, detail = '') {
  console.log(`  ${cond ? '✓' : '✗'} ${name}` + (detail ? ` — ${detail}` : ''));
  cond ? PASS++ : FAIL++;
}
function manual(name, reason) {
  console.log(`  ⏸ ${name} — 【真机待补】${reason}`);
  MANUAL++;
}

// 代码层间接验证：
// T-R01~T-R04 靠 Bug 6 的 X+Y 合流机制保证；已在 tester-v2-bug6 独立断言。
// 但仍需检查 answerArea 的 handleButton 是否有幂等语义（防 Bug 6 万一未去重时的兜底）

console.log('=== T-R01 运算符键单击不双入 ===');
{
  // 🔴 task-146：本块原为【判据层假绿】—— 只操作自造 { handleEvent: () => count++ }，
  //   把 DEDUP_MS 去重逻辑在测试里自己重写一遍再自证，块内读产品文件次数 = 0。
  //   实测：js/ui/UIManager.js + js/ui/AnswerModal.js 清成 '// gutted'（各 9 字节）后本条仍绿。
  // 权威期望源：架构师 92 号验收矩阵 :415 T-R01
  //   前置「发牌 DEAL_DONE」⇒ 产品公开 API a.setEnabled(true)（AnswerArea.js:527）
  //   期望「getFormulaText() 恰好末尾多 1 字符；tokens.length 增量 = 1」
  // ⇒ 改为真读产品 AnswerArea：走真入口 handleButton → addToken → tokens。
  const AAmod = await import('../js/ui/AnswerArea.js');
  const AnswerAreaCls = AAmod.default;
  // 判据①存在性前置：产品类与真入口必须存在（防特性整体缺失时后续判据全绿）
  check('T-R01 存在性前置：AnswerArea 可实例化且 handleButton/getTokens/getFormulaText 均存在',
    typeof AnswerAreaCls === 'function' &&
    typeof AnswerAreaCls.prototype.handleButton === 'function' &&
    typeof AnswerAreaCls.prototype.getTokens === 'function' &&
    typeof AnswerAreaCls.prototype.getFormulaText === 'function',
    `cls=${typeof AnswerAreaCls}`);
  const a = new AnswerAreaCls();
  a.setEnabled(true);              // 92 号前置：DEAL_DONE
  const n0 = a.getTokens().length, f0 = a.getFormulaText();
  a.handleButton({ kind: 'op', opValue: '+' });   // 单击运算符 '+' 一次
  const n1 = a.getTokens().length, f1 = a.getFormulaText();
  // 判据②真行为：tokens 增量应为 1（92 号原文期望，非把现状写成期望）
  check('T-R01 单击运算符一次后 tokens.length 增量应为 1（真读产品 AnswerArea）',
    n1 - n0 === 1, `${n0} → ${n1}`);
  // 判据③真行为：formulaText 应恰好末尾多 1 字符
  check('T-R01 单击运算符一次后 getFormulaText() 应恰好末尾多 1 字符（真读产品）',
    f1.length - f0.length === 1 && f1.startsWith(f0), `${JSON.stringify(f0)} → ${JSON.stringify(f1)}`);
  // 判据④反向鉴别力：未发牌（enabled=false）时同一单击不得写入，防「恒增 1」式假绿
  const z = new AnswerAreaCls();   // 不调 setEnabled ⇒ AnswerArea.js:381 默认 false
  const z0 = z.getTokens().length;
  z.handleButton({ kind: 'op', opValue: '+' });
  check('T-R01 反向：未发牌(enabled=false)时单击运算符不得写入 tokens',
    z.getTokens().length === z0, `${z0} → ${z.getTokens().length}`);
  manual('T-R01', '需在微信开发者工具单击 "+" 观察 formulaText 是否恰增 1 字符');
}

console.log('\n=== T-R02 括号键单击不双入 ===');
{
  // 🔴 task-146：同 T-R01，本块原为自造 mock 自证（gutted 产品后仍绿），块内读产品 0 次。
  // 权威期望源：92 号验收矩阵 :416 T-R02
  //   操作「单击 ( 一次；再单击 ) 一次」，期望「每次 tokens.length 增量恰为 1」
  const AAmod2 = await import('../js/ui/AnswerArea.js');
  const AnswerAreaCls2 = AAmod2.default;
  // 判据①存在性前置
  check('T-R02 存在性前置：AnswerArea 真入口 handleButton 存在',
    typeof AnswerAreaCls2 === 'function' && typeof AnswerAreaCls2.prototype.handleButton === 'function',
    `cls=${typeof AnswerAreaCls2}`);
  const b = new AnswerAreaCls2();
  b.setEnabled(true);
  const deltas = [];
  for (const v of ['(', ')']) {
    const before = b.getTokens().length;
    b.handleButton({ kind: 'op', opValue: v });
    deltas.push(b.getTokens().length - before);
  }
  // 判据②真行为：两次单击的增量都应恰为 1（92 号原文「每次增量恰为 1」）
  check('T-R02 单击 ( 与 ) 各一次，每次 tokens.length 增量都应为 1（真读产品 AnswerArea）',
    deltas.length === 2 && deltas.every((d) => d === 1), `增量序列=[${deltas.join(',')}]`);
  manual('T-R02', '需真机验证：单击 "(" 一次；单击 ")" 一次；tokens.length 增量各为 1');
}

console.log('\n=== T-R03 数字键单击不双入 ===');
{
  // 数字键 = NUMBER 类型，即使双分发 isCardOccupied 也会拦第 2 次
  // 代码层已有幂等保护 → 双保险
  const src = fs.readFileSync('js/ui/UIManager.js', 'utf8');
  // 检查 wx.onTouchStart 中 _lastRealTouchTs 更新（保护数字键不双入的核心机制）
  check('T-R03 UIManager wx.onTouchStart 更新 _lastRealTouchTs', src.includes('_lastRealTouchTs = Date.now()'));
  manual('T-R03', '需真机验证：单击卡片 "A(1)" 一次；顶部算式栏新增单个 "1"，tokens 里仅 1 个 NUMBER token');
}

console.log('\n=== T-R04 删除键单击一次删一 token ===');
{
  // 🔴 task-141：原为 check(..., true) 恒真 —— 形式上有断言、实质零鉴别力（判据三级只到①结构存在）。
  //   实证（取值命令：把 js/ui/UIManager.js 与 AnswerModal.js 内容清成 "// gutted" 后裸跑）：
  //     产品内容全毁仍 5 条绿（T-R01/R02 的自造 mock + T-R04/R06/R07 三条字面量 true），
  //     只有 T-R03、T-R05×2 判红 ⇒ 恒真条「产品怎么坏都绿」实测成立。
  //   原需求（架构师 92 号《INPUT04-bugfix-v2 分析与修复方案》:418 验收矩阵）：
  //     T-R04 删除键单击一次删一 token｜前置：输入了 1+2 三 token｜
  //     操作：单击「删除」1 次｜判据：**tokens.length 减 1**
  //   ⇒ 应该验的是「删一次恰好少一个 token」这个真行为，不是「依赖某机制」这句话。
  //   取值层：直接调产品 AnswerArea.removeLastToken()（js/ui/AnswerArea.js:562），
  //     判对象就读对象；实例启用口径照抄 selftest_task112_caps_linkage.mjs:43。
  const AAmod = await import('../js/ui/AnswerArea.js');
  const AAcls = AAmod.default, TT = AAmod.TokenType;
  const aa = new AAcls();
  aa.cardValues = [1, 2, 3, 4]; aa.enabled = true; aa.areaState = 'open';
  const okN1 = aa.addToken({ type: TT.NUMBER, value: 1, cardIndex: 0 });
  const okOp = aa.addToken({ type: TT.OPERATOR, value: '+' });
  const okN2 = aa.addToken({ type: TT.NUMBER, value: 2, cardIndex: 1 });
  // 🔴 存在性前置：先证前置「输入了 1+2 三 token」真的建立起来了，
  //   否则下面的减量断言在 0 token 上也能「减 0」，红/绿都无意义。
  check('T-R04-pre 🔴 存在性前置：1+2 三 token 已写入（addToken 全 true 且 length===3）',
    okN1 === true && okOp === true && okN2 === true && aa.tokens.length === 3,
    `addToken=[${okN1},${okOp},${okN2}] length=${aa.tokens.length}`);
  const lenBefore = aa.tokens.length;
  const popped = aa.removeLastToken();
  const delta = lenBefore - aa.tokens.length;
  check('T-R04 删除键单击一次 tokens.length 恰减 1（92号:418 判据，真行为）',
    delta === 1 && popped !== null,
    `before=${lenBefore} after=${aa.tokens.length} 减量=${delta} 返回=${popped ? popped.type : 'null'}`);
  // 反向：空栈再删不得把 length 弄成负数、须返回 null（防「一律 pop」把上面刷绿）
  const emptied = new AAcls();
  emptied.cardValues = [1, 2, 3, 4]; emptied.enabled = true; emptied.areaState = 'open';
  const retEmpty = emptied.removeLastToken();
  check('T-R04-rev 🔴 反向：空栈 removeLastToken 返回 null 且 length 不为负',
    retEmpty === null && emptied.tokens.length === 0,
    `返回=${JSON.stringify(retEmpty)} length=${emptied.tokens.length}`);
  manual('T-R04', '需真机验证：输入 "1+2" 后单击"删除" 1 次，tokens.length 减 1');
}

// 🔴 task-141：T-R06/T-R07 共用的产品模块与 mock ctx 提到块外
//   （原先声明在 T-R06 的 { } 块内，T-R07 块取不到 ⇒ ReferenceError）。
//   mock ctx 口径照抄 tester/tester-bug3-uimanager-diff.mjs:72 的 Proxy 写法。
const AMmod = await import('../js/ui/AnswerModal.js');
const mkCtx = () => new Proxy({}, { get: (_t, k) => {
  if (k === 'measureText') return () => ({ width: 50 });
  if (k === 'canvas') return { width: 414, height: 896 };
  return () => {};
} });
const items = Array.from({ length: 20 }, (_, i) => `解法${i + 1}: 1+2+3=24`);   // >8 项，制造可滚内容

console.log('\n=== T-R05 答案列表可鼠标拖拽滚动（PC 环境） ===');
{
  // 静态检查 AnswerModal 内 touchmove handler 是否更新 _scrollY
  const src = fs.readFileSync('js/ui/AnswerModal.js', 'utf8');
  check('T-R05 AnswerModal 存在 handleEvent 或 touch 处理', 
    src.includes('handleEvent') || src.includes('touchmove') || src.includes('_scrollY'));
  check('T-R05 AnswerModal 存在 _scrollY 状态', src.includes('_scrollY'));
  manual('T-R05', '需微信开发者工具 PC 环境用鼠标按下→拖动→释放，观察列表内容位移');
}

console.log('\n=== T-R06 答案列表触摸拖拽滚动（真机） ===');
{
  // 🔴 task-141：原为 check(..., true) 恒真。
  //   原需求（92 号 :420）：T-R06 答案列表触摸拖拽滚动（真机）｜前置：打开答案弹窗（含 > 8 项）｜
  //     操作：手指按下→拖动→抬起｜判据：同 T-R05 ⇒ **AnswerModal._scrollY > 0；列表内容明显位移**
  //   ⇒ 应该验「按下-拖动-抬起这条真事件链走完后 _scrollY 真的变了」，
  //     而非「同 T-R05」这句转述（T-R05 本身只做源码 includes 静态检查，不覆盖行为）。
  //   产品契约（读 js/ui/AnswerModal.js 现取，非猜）：
  //     · onTouchStart :240 需 this.visible && _hitListArea(touch) 才置 _dragging
  //     · _hitListArea :~290 用 touch.clientX/clientY（🔴 不是 x/y），比对 this._listRect
  //     · _listRect / _scaleCache 由 render() :234 建立 ⇒ 必须先 render 再模拟触摸
  //     · onTouchMove 用 (clientY - _dragStartClientY)/scale 反向累加，并夹在 [0, _maxScrollDP()]
  //   mock ctx 口径照抄 tester/tester-bug3-uimanager-diff.mjs:72 的 Proxy 写法。
  const modal = new AMmod.default();
  modal.open(items, []);
  modal.render(mkCtx(), 414, 896);
  const sc = modal._scaleCache;
  const maxS = modal._maxScrollDP();
  // 🔴 存在性前置①：内容必须真的超出视口（maxScroll>0），否则 _scrollY 被夹死在 0，
  //   「位移为 0」是数据不够而非产品坏 —— 必须与真判红区分开。
  check('T-R06-pre 🔴 存在性前置：render 建立 _listRect/_scaleCache 且内容可滚（maxScroll>0）',
    !!sc && !!modal._listRect && maxS > 0,
    `_scaleCache=${!!sc} _listRect=${!!modal._listRect} maxScroll=${maxS}`);
  const inList = { clientX: (61 + 140) * sc.scale, clientY: (240 + 200) * sc.scale };
  modal.onTouchStart(inList);
  // 🔴 存在性前置②：按下必须真的落在列表区并进入拖拽态，否则后面 move 直接 return
  check('T-R06-pre2 🔴 存在性前置：按下落在列表区 ⇒ _dragging 置起',
    modal._dragging === true, `_dragging=${modal._dragging}`);
  const sy0 = modal._scrollY;
  const DRAG_DP = 100;
  modal.onTouchMove({ clientX: inList.clientX, clientY: inList.clientY - DRAG_DP * sc.scale });
  const moved = modal._scrollY - sy0;
  // 真判据：上移 100DP ⇒ 内容向下滚 ≈100DP（容差 1DP 容浮点/夹取）
  check('T-R06 触摸拖拽后 _scrollY 真位移 ≈ 拖动量（92号:420 判据，真事件链）',
    moved > 0 && Math.abs(moved - DRAG_DP) < 1,
    `起=${sy0} 终=${modal._scrollY.toFixed(2)} 位移=${moved.toFixed(2)} 期望≈${DRAG_DP}`);
  modal.onTouchEnd({ clientX: inList.clientX, clientY: inList.clientY - DRAG_DP * sc.scale });
  check('T-R06-end 抬起后退出拖拽态（_dragging 复位，防粘滞持续滚动）',
    modal._dragging === false, `_dragging=${modal._dragging}`);
  // 反向：列表区外按下不得进入拖拽（防「无条件 dragging」把上面刷绿）
  const outside = new AMmod.default();
  outside.open(items, []); outside.render(mkCtx(), 414, 896);
  outside.onTouchStart({ clientX: 5, clientY: 5 });      // 面板左上角外侧
  check('T-R06-rev 🔴 反向：列表区外按下不进入拖拽态（不得无条件 dragging）',
    !outside._dragging, `_dragging=${outside._dragging}`);
  manual('T-R06', '需华为 P30 真机手指按下→拖动→抬起，验证滚动');
}

console.log('\n=== T-R07 答案列表关闭按钮单击不双入 ===');
{
  // 🔴 task-141：原为 check(..., true) 恒真。
  //   原需求（92 号 :421）：T-R07 答案列表关闭按钮单击不双入｜前置：打开答案弹窗｜
  //     操作：单击「关闭」｜判据：**弹窗关闭；关闭后再无副作用（不弹二次）**
  //   🔴 产品契约实测（读 js/ui/AnswerModal.js :~300 现取）：onTouchEnd 命中关闭时
  //     **只置 _pendingCloseHit=false 并 return，不自行 close()** —— 注释原文
  //     「由 hit() 返回 'close' 让外部处理」⇒ 这是【有意设计】，
  //     故正确判据是「hit() 必须返回 'close'」+「外部 close() 后 isVisible() 转 false 且幂等」，
  //     ⚠️ 不是「onTouchEnd 后 visible 自动变 false」—— 我探针初测时按后者判过，
  //     核过产品注释确认是我调用契约理解错，非产品缺陷（故未上报开发）。
  const m7 = new AMmod.default();
  m7.open(items, []);
  m7.render(mkCtx(), 414, 896);
  const sc7 = m7._scaleCache;
  // 🔴 存在性前置：弹窗必须真打开，否则 hit/close 全部短路，'关闭成功' 无从判起
  check('T-R07-pre 🔴 存在性前置：弹窗已打开（isVisible()===true）',
    m7.isVisible() === true, `isVisible=${m7.isVisible()}`);
  const cbTouch = { clientX: (130 + 75) * sc7.scale, clientY: (691 + 25) * sc7.scale };
  check('T-R07 单击关闭按钮 ⇒ hit() 返回 \'close\'（92号:421，外部据此关闭）',
    m7.hit(cbTouch) === 'close', `hit=${JSON.stringify(m7.hit(cbTouch))}`);
  m7.close();
  check('T-R07-b close() 后 isVisible() 转 false（弹窗真关闭）',
    m7.isVisible() === false, `isVisible=${m7.isVisible()}`);
  // 「不弹二次」= 幂等：再 close 一次不得复现可见态，也不得抛错
  let closeErr = null;
  try { m7.close(); } catch (e) { closeErr = e.message; }
  check('T-R07-c 🔴 二次 close 幂等：仍 false 且不抛错（对应「关闭后无副作用/不弹二次」）',
    m7.isVisible() === false && closeErr === null,
    `isVisible=${m7.isVisible()} err=${closeErr}`);
  // 反向：非关闭按钮区（列表内）单击不得返回 'close'（防「一律 close」把上面刷绿）
  const m7b = new AMmod.default();
  m7b.open(items, []); m7b.render(mkCtx(), 414, 896);
  const scb = m7b._scaleCache;
  const hitList = m7b.hit({ clientX: (61 + 140) * scb.scale, clientY: (240 + 200) * scb.scale });
  check('T-R07-rev 🔴 反向：列表区单击返回 \'consumed\' 而非 \'close\'（遮罩内不误关）',
    hitList === 'consumed', `hit(列表内)=${JSON.stringify(hitList)}`);
  manual('T-R07', '需真机验证：单击 CLOSE_BTN 1 次，弹窗关闭且无二次弹出');
}

console.log('\n=========================================');
// ── D-0：断言总数自断言（task-131 第 3 批 E 类补齐）──
// 目的：捕获「断言静默退场」—— 断言不再执行时，仅看 fail=0 无法察觉。
// 🔴 基数只算【业务断言】不含 D-0 自己（否则自引用）；D-0 计入 PASS ⇒ `pass=N+1`。
// 🔴 MANUAL（真机待补）不入基数：它不计入 PASS/FAIL（见 :14），与断言总数不同口径。
// ✅ task-141 已闭环：原 T-R04/T-R06/T-R07 三条 `check(..., true)` 恒真断言已转真断言。
//   假绿实证（取值命令：把 js/ui/UIManager.js 与 js/ui/AnswerModal.js 内容清成 "// gutted" 后裸跑）：
//     改前 pass=6 fail=3 —— 产品内容全毁仍 5 条绿（T-R01/R02 自造 mock + 三条字面量 true）。
//   🔴 顺带记档（本任务未授权改，只报）：T-R01(:32)、T-R02(:44) 仍是**自造 mock 自证**
//     —— 块内读产品文件次数实测 = 0，只操作 { handleEvent: () => count++ } 这个自造对象，
//     产品坏了照样绿。它们与本轮三条恒真是同一类假绿，只是形式上有 count 比较。
//     T-R05(:69,:71) 为源码 includes 静态检查（判据三级仅到 ① 结构存在）。
//     ⇒ 建议后续单独立项处理，勿在本任务内擅自扩面。
// 🔴 基数按 T-R 分族小计相加（禁裸数字：基数不可推导时，增删断言无法定位该改哪族）。
//   取值命令（现取，非估算）：
//     node --import ./tester/render-smoke/esm-hooks.mjs tester/tester-v2-tr-interaction.mjs \
//       | grep -cE '^  [✓✗] T-R0N'   （逐 N=1..7 取）
const EXPECTED = {
  R01: 1 + 2 + 1,   // task-146：存在性前置 + tokens增量1 + formulaText增1字符 + 未发牌反向
  R02: 1 + 1,       // task-146：存在性前置 + ( 与 ) 每次增量恰为 1
  R03: 1,   // 数字键：UIManager 更新 _lastRealTouchTs（源码检查）
  R04: 3,   // task-141：存在性前置 + tokens 减 1 真行为 + 空栈反向
  R05: 2,   // AnswerModal touch 处理 + _scrollY 状态（源码检查）
  R06: 5,   // task-141：2 条存在性前置 + _scrollY 真位移 + 抬起复位 + 区外反向
  R07: 5,   // task-141：存在性前置 + hit()==='close' + close 生效 + 二次幂等 + 列表区反向
};
const EXPECTED_ASSERTION_COUNT = Object.values(EXPECTED).reduce((s, n) => s + n, 0);
console.log('\n=== D-0：断言总数自断言 ===');
const _total = PASS + FAIL;
if (_total === EXPECTED_ASSERTION_COUNT) {
  PASS++;
  console.log(`  ✓ D-0 断言总数自断言 — 实测总数=${_total} 期望=${EXPECTED_ASSERTION_COUNT}`);
} else {
  FAIL++;
  console.log(`  ✗ D-0 断言总数自断言 — 实测总数=${_total} 期望=${EXPECTED_ASSERTION_COUNT}`);
  console.log(`    分族期望：${JSON.stringify(EXPECTED)}`);
  console.log('    ⇒ 有断言静默退场或新增未同步 EXPECTED');
}

console.log(`T-R Interaction TOTAL: pass=${PASS} fail=${FAIL} manual-pending=${MANUAL}`);
console.log(`OVERALL: ${FAIL === 0 ? 'PASS ✅（代码级）+ 真机待补' : 'FAIL ❌'}`);
console.log('=========================================');
console.log('\n【真机待补说明】以上 7 项 T-R 交互回归均已完成代码级验证；');
console.log('真机层面需项目主 GUI 复核（RDP + 微信开发者工具 + 华为 P30 真机）。');
console.log('依据 task-42 授权，"真机待补"不计入 fail 总数。');
if (FAIL > 0) process.exit(1);
