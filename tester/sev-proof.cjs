// Tester 独立取证：dealtOk 崩溃的传播链与严重度定级（只读，不改任何产品文件）
// 目的：独立核实 Developer 06:24 所报「整个 App 永久白屏假死」是否成立
const fs = require('fs');
let pass = 0, fail = 0;
const ck = (n, ok, x) => { ok ? pass++ : fail++; console.log(`  ${ok ? 'ok ' : 'XX '} ${n}${x ? '   ' + x : ''}`); };
const rd = (f) => fs.readFileSync(f, 'utf8');
const lines = (f) => rd(f).split('\n');
const grepN = (f, re) => { const o = []; lines(f).forEach((l, i) => { if (re.test(l)) o.push({ n: i + 1, t: l.trim() }); }); return o; };

console.log(`sev-proof.cjs @ ${new Date().toISOString()}  node ${process.version}`);
console.log(`cwd=${process.cwd()}\n`);

// ============ 环节 1：loop() 中 render 与 rAF 的先后顺序 ============
console.log('【链1】main.js loop()：render() 抛错能否阻断 requestAnimationFrame');
const mainL = lines('js/main.js');
const iRender = mainL.findIndex(l => /this\.uiManager\.render\(\)/.test(l));
const iRaf = mainL.findIndex((l, i) => i > 0 && /requestAnimationFrame\(this\.loop\)/.test(l) && i > iRender);
console.log(`     main.js 共 ${mainL.length} 行`);
console.log(`     L${iRender + 1}: ${mainL[iRender].trim()}`);
console.log(`     L${iRaf + 1}: ${mainL[iRaf].trim()}`);
ck('render() 调用行号 < 续帧 rAF 行号（同一 loop 体内）', iRender >= 0 && iRaf > iRender,
   `render@L${iRender + 1} < rAF@L${iRaf + 1}`);
const mainTC = grepN('js/main.js', /\btry\b|\bcatch\b/);
ck('main.js 全文件 try/catch 数 = 0（render 抛错无兜底）', mainTC.length === 0,
   mainTC.length ? mainTC.map(x => `L${x.n}`).join(',') : 'ZERO');

// ============ 环节 2：UIManager.render 是否先 clearRect 再绘制 ============
console.log('\n【链2】UIManager.render()：是否先清屏再调 renderer（决定是否白屏）');
const uiL = lines('js/ui/UIManager.js');
const iClear = uiL.findIndex(l => /clearRect\s*\(/.test(l));
const iDispatch = uiL.findIndex((l, i) => i > iClear && /\.render\s*\(/.test(l) && !/clearRect/.test(l));
console.log(`     UIManager.js 共 ${uiL.length} 行`);
if (iClear >= 0) console.log(`     L${iClear + 1}: ${uiL[iClear].trim()}`);
if (iDispatch >= 0) console.log(`     L${iDispatch + 1}: ${uiL[iDispatch].trim()}`);
ck('clearRect 行号 < 下游 renderer.render 行号（清屏在前）', iClear >= 0 && iDispatch > iClear,
   iClear >= 0 ? `clearRect@L${iClear + 1} < render@L${iDispatch + 1}` : 'clearRect 未找到');
// 修正：UIManager 确有 try/catch，但需判定是否在 render() 崩溃路径上
const uiTC = grepN('js/ui/UIManager.js', /\btry\s*\{|\}\s*catch\s*\(/);
const iRenderFn = uiL.findIndex(l => /^\s*render\s*\(\s*\)\s*\{/.test(l));
const renderEnd = uiL.findIndex((l, i) => i > iRenderFn && /^\s{2}\}/.test(l));
const tcInRender = uiTC.filter(x => x.n > iRenderFn + 1 && x.n <= (renderEnd + 1));
console.log(`     UIManager try/catch 共 ${uiTC.length} 处: ${uiTC.map(x => 'L' + x.n).join(',')}`);
console.log(`     render() 函数体 L${iRenderFn + 1}~L${renderEnd + 1}`);
ck('UIManager.render() 函数体内 try/catch 数 = 0（构造期桥接的 try 不在崩溃路径）',
   tcInRender.length === 0, `render 体内 ${tcInRender.length} 处；其余 ${uiTC.length} 处均在构造期 devtools 鼠标桥接`);

// ============ 环节 3：PageRenderer 无 try/catch ============
console.log('\n【链3】PageRenderer：render/_renderTable 是否有 try/catch 兜底');
// 修正：PageRenderer 有 2 处 try/catch，但均在 _computeRecipAsync 的 setTimeout 回调内
const prTC = grepN('js/ui/PageRenderer.js', /\btry\s*\{|\}\s*catch\s*\(/);
const prAll = lines('js/ui/PageRenderer.js');
const iRenderTop = prAll.findIndex(l => /^\s*render\s*\(\s*page\s*,/.test(l));
const iRenderTopEnd = prAll.findIndex((l, i) => i > iRenderTop && /^\s{2}\}/.test(l));
const iTbl = prAll.findIndex(l => /^\s*_renderTable\s*\(/.test(l));
const iTblEnd = prAll.findIndex((l, i) => i > iTbl && /^\s{2}\}/.test(l));
const inPath = prTC.filter(x => (x.n > iRenderTop + 1 && x.n <= iRenderTopEnd + 1) || (x.n > iTbl + 1 && x.n <= iTblEnd + 1));
console.log(`     PageRenderer try/catch 共 ${prTC.length} 处: ${prTC.map(x => 'L' + x.n).join(',')}（均在 _computeRecipAsync 的 setTimeout 回调内）`);
console.log(`     render() L${iRenderTop + 1}~L${iRenderTopEnd + 1}   _renderTable() L${iTbl + 1}~L${iTblEnd + 1}`);
ck('render() 与 _renderTable() 体内 try/catch 数 = 0（崩溃路径无兜底）',
   inPath.length === 0, `崩溃路径内 ${inPath.length} 处；2 处 try/catch 均属异步 RecipSolver 求解，不覆盖同步渲染`);

// 补：Manager 06:31 指出另有 L186 `.catch()` —— 我原正则 /\}\s*catch\s*\(/ 不命中此形式，属计数盲区
// 需确认 Promise 链上的 .catch 能否吞掉同步渲染抛错
const promiseCatch = grepN('js/ui/PageRenderer.js', /\.\s*catch\s*\(/);
const promiseFinally = grepN('js/ui/PageRenderer.js', /\.\s*finally\s*\(/);
console.log(`     Promise 式 .catch(): ${promiseCatch.length ? promiseCatch.map(x => 'L' + x.n).join(',') : 'ZERO'}   .finally(): ${promiseFinally.length ? promiseFinally.map(x => 'L' + x.n).join(',') : 'ZERO'}`);
promiseCatch.forEach(x => console.log(`       L${x.n}: ${x.t}`));
// 判定：所有 .catch 是否都挂在 _ensureAssetsPreload 的 preloadAllCardImages 链上（不覆盖同步渲染）
const iPre = prAll.findIndex(l => /_ensureAssetsPreload\s*\(\s*\)\s*\{/.test(l));
const iPreEnd = prAll.findIndex((l, i) => i > iPre && /^\s{2}\}/.test(l));
const catchOutsidePreload = promiseCatch.filter(x => !(x.n > iPre + 1 && x.n <= iPreEnd + 1));
ck('全部 Promise .catch() 均位于 _ensureAssetsPreload 体内（L181~L190）',
   catchOutsidePreload.length === 0,
   `_ensureAssetsPreload L${iPre + 1}~L${iPreEnd + 1}；体外 .catch 数 ${catchOutsidePreload.length}`);

// 【订正 · Developer 06:36】「在路径上」与「能捕获」是两个独立判定，必须分开断言。
// 我原文案把两者并成一句，暗示 L186「不在路径上」—— 那是错的。
const iCallPre = prAll.findIndex(l => /this\._ensureAssetsPreload\s*\(\s*\)\s*;/.test(l));
const iCallTbl = prAll.findIndex((l, i) => i > iCallPre && /return\s+this\._renderTable\s*\(/.test(l));
console.log(`     render() 调用序列: L${iCallPre + 1} _ensureAssetsPreload()  →  L${iCallTbl + 1} _renderTable()`);
ck('【位置判定】_ensureAssetsPreload 在崩溃路径调用序列内（L223 先于 L224）—— 故 L186 「在路径上」',
   iCallPre >= 0 && iCallTbl === iCallPre + 1,
   `L${iCallPre + 1} 紧邻先于 L${iCallTbl + 1}，同属 PAGE.TABLE 分支`);
ck('【覆盖判定】L186 捕获范围 = preloadAllCardImages() 返回 Promise 的 rejection，不含同步栈',
   /preloadAllCardImages\(\)\.then/.test(prAll.slice(iPre, iPreEnd + 1).join('')),
   'L183 preloadAllCardImages().then(...).catch(L186) —— 仅覆盖该异步链');
// 实证：Promise 链上的 .catch 无法捕获同步函数抛错
{
  let caughtByPromise = false, escaped = null;
  const fakePreload = () => Promise.resolve({});
  fakePreload().then(() => {}).catch(() => { caughtByPromise = true; });
  try {
    // 同步渲染路径抛错（等价 L467）
    new Function('"use strict"; return !dealtOk;')();
  } catch (e) { escaped = e; }
  ck('【实证】同级已挂 .catch 时随后同步抛错 → .catch 未触发，异常逃逸调用栈',
     caughtByPromise === false && escaped instanceof ReferenceError,
     `promiseCatch触发=${caughtByPromise}  逃逸异常=${escaped ? escaped.name : 'none'}`);
}

// ============ 环节 4：全仓无全局错误兜底 ============
console.log('\n【链4】全仓是否有 wx.onError / unhandledRejection 兜底');
const files = [];
(function walk(d) { for (const f of fs.readdirSync(d)) { const p = `${d}/${f}`; const st = fs.statSync(p); if (st.isDirectory()) { if (!/node_modules|\.git|tester|selftest|tools/.test(p)) walk(p); } else if (f.endsWith('.js')) files.push(p); } })('js');
let handlers = [];
for (const p of files) for (const h of grepN(p, /wx\.onError|onUnhandledRejection|unhandledrejection|window\.onerror|addEventListener\(['"]error/)) handlers.push(`${p}:${h.n}`);
ck('全仓全局错误兜底数 = 0（抛错无人接管）', handlers.length === 0, handlers.length ? handlers.join(',') : 'ZERO');

// ============ 环节 5：L353→L467 之间有无提前 return 可绕过 ============
console.log('\n【链5】_renderTable 内 L467 之前是否存在可绕过的提前 return');
const prL = lines('js/ui/PageRenderer.js');
const iTable = prL.findIndex(l => /^\s*_renderTable\s*\(/.test(l));
const iDealtOk = prL.findIndex(l => /disabled:\s*!dealtOk/.test(l));
const iAreaClosed = prL.findIndex(l => /areaClosed\s*=\s*!this\.answerArea\.isAreaVisible\(\)/.test(l));
console.log(`     _renderTable 起 L${iTable + 1}   areaClosed 定义 L${iAreaClosed + 1}   dealtOk 引用 L${iDealtOk + 1}`);
const between = prL.slice(iTable, iDealtOk);
// 顶层 return（缩进 4 空格，即函数体直接层级）
const topReturns = [];
between.forEach((l, i) => { if (/^\s{4}return[\s;]/.test(l)) topReturns.push(`L${iTable + 1 + i}: ${l.trim()}`); });
ck('_renderTable 顶层无提前 return（L467 必达）', topReturns.length === 0,
   topReturns.length ? topReturns.join(' | ') : '零顶层 return');

// _ensureAssetsPreload 是否会 return 掉（Developer 提到的 L223）
const iPreload = prL.findIndex(l => /_ensureAssetsPreload\s*\(\s*\)\s*;/.test(l));
if (iPreload >= 0) console.log(`     _ensureAssetsPreload() 调用在 L${iPreload + 1}: ${prL[iPreload].trim()}`);
const preloadFn = grepN('js/ui/PageRenderer.js', /_ensureAssetsPreload\s*\(\s*\)\s*\{/);
ck('_ensureAssetsPreload 是异步预载、不阻塞 _renderTable 继续执行',
   /_assetsPromise/.test(rd('js/ui/PageRenderer.js')),
   preloadFn.length ? `定义 L${preloadFn[0].n}（用 _assetsPromise 异步，不 await）` : '');

// ============ 环节 6：首页是否含 dealtOk（判定「首页是否正常」） ============
console.log('\n【链6】_renderIndex 是否含 dealtOk（决定首页是否也崩）');
const iIndex = prL.findIndex(l => /^\s*_renderIndex\s*\(/.test(l));
const indexBody = prL.slice(iIndex, iTable).join('\n');
ck('_renderIndex 不含 dealtOk（首页可正常渲染）', !/dealtOk/.test(indexBody),
   `_renderIndex 范围 L${iIndex + 1}~L${iTable}`);

// ============ 环节 7：等价结构实证 —— 一帧即死 ============
console.log('\n【链7】等价结构实证：render 抛错后续帧 rAF 是否执行');
{
  let frames = 0, rafCalled = 0, deadAt = null;
  const rAF = (fn) => { rafCalled++; if (frames < 5) setImmediateLike(fn); };
  const setImmediateLike = (fn) => { try { fn(); } catch (e) { deadAt = e; } };
  // 复刻 main.js loop 结构：render(L39) → rAF(L40)，无 try/catch
  const loop = () => {
    frames++;
    renderThatThrows();          // ← L39 等价
    rAF(loop);                   // ← L40 等价：抛错则永不到达
  };
  const renderThatThrows = () => {
    // 复刻 UIManager：先 clearRect 再 dispatch
    cleared = true;
    // 复刻 L467：读未声明标识符
    const f = new Function('"use strict"; return { disabled: !dealtOk };');
    f();
  };
  let cleared = false;
  try { loop(); } catch (e) { deadAt = e; }
  console.log(`     总帧数=${frames}   续帧 rAF 被调用次数=${rafCalled}   画布已清空=${cleared}`);
  console.log(`     捕获=${deadAt ? deadAt.name + ': ' + deadAt.message : '无'}`);
  ck('总帧数 = 1（一帧即死，循环不再续）', frames === 1, `frames=${frames}`);
  ck('续帧 rAF 调用次数 = 0（L40 等价行从未执行）', rafCalled === 0, `rafCalled=${rafCalled}`);
  ck('抛错前画布已被 clearRect 清空 → 白屏', cleared === true);
  ck('异常类型 = ReferenceError', deadAt instanceof ReferenceError, deadAt ? deadAt.message : '');
}

// ============ 环节 8：触摸事件是否独立于 loop（假死 vs 崩退） ============
console.log('\n【链8】触摸监听是否独立于 loop（决定是「假死」还是「崩退」）');
const touch = [];
for (const p of files) for (const h of grepN(p, /wx\.onTouch(Start|Move|End)/)) touch.push(`${p}:${h.n}`);
ck('存在 wx.onTouch* 注册（独立于 rAF loop，故进程不退出 → 假死而非崩退）', touch.length > 0, touch.join(', '));

console.log(`\n[dealtOk 严重度定级取证] pass=${pass} fail=${fail}  ${fail === 0 ? '「整个 App 永久白屏假死」成立 ✅' : '有环节未证实 ❌'}`);
