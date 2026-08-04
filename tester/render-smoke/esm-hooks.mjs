// tester/render-smoke/esm-hooks.mjs
// 让 Node 直接 import 产品源码（js/**/*.js），**字节零改动、零副本**。
//
// 为什么需要它：产品代码用 ESM 语法但文件名是 .js，且 import 不带扩展名
//   （如 `import { drawButton } from './Components'`），package.json 无 "type":"module"。
//   Node 默认把 .js 当 CJS → 直接 import 会 SyntaxError。
//
// 【为什么这比"复制 ESM 副本"更好】
//   INPUT-06 我做 AnswerArea.mjs 副本时改了 1 行 import，虽记了 SHA-1，但副本天生会漂移。
//   registerHooks 直接读原文件，**被测对象就是产品文件本身**，无副本、无 diff、无漂移。
//   这也让"stub 只覆盖纯绘图"这条硬约束天然成立：逻辑层根本没有替身。
//
// ===========================================================================
// 【Node 版本硬门槛 · Manager 2026-08-04 12:34 裁定】
//   `module.registerHooks` 是 **Node 22.15+ 新增**的同步 hooks API，Node 18/20 不存在
//   （彼时仅有 `module.register()` + loader worker 异步方案）。
//
//   ⚠️ 曾发生的真实问题（task-69 规则 9 回溯查出）：
//     本文件在 Node 18.20.8 上抛 `SyntaxError: The requested module 'node:module'
//     does not provide an export named 'registerHooks'`，导致依赖它的
//     render-smoke.mjs（P0 22/0）与 red1-tap-guard.mjs（红1 7/0）**完全无法运行**，
//     而当时无人察觉 —— 因为报错信息指向 'node:module'，不指向版本不兼容。
//
//   ⇒ 故本文件在 import 前先做**显式版本断言**，把晦涩的 SyntaxError 换成人话。
//
//   【为何必须用动态 import】静态 `import { registerHooks } from 'node:module'`
//   在 **ESM 链接阶段**就失败，早于任何模块顶层代码执行 ⇒ 写在同文件里的断言
//   一行都跑不到。必须先断言、再 `await import()`。此处踩过一次。
//
//   【不做降级分支的理由 · Manager 裁定】产品代码 `js/` 零 Node 专有 API 依赖
//   （无 require / 无 node: / 无 process.*），Node 版本差异只影响"门禁能否运行"，
//   不影响产品行为。为不影响结论的可移植性问题引入 worker 异步语义，不划算。
// ===========================================================================

// ── 运行环境自证（Manager 2026-08-04 12:34 立为团队规则）─────────────────
//   规则：**无 Node 版本记录的门禁结果，视同未做双版本验证。**
//   ⚠️ 位置刻意放在【最前】：探测失败路径也必须能打印环境，便于取证。
//      （13:04 修正：原先放在断言之后，一旦拦停就没有 [env] 行，取证反而缺证据。）
//   ⚠️ 这里打印的是【工具链 Node 版本】，**不是小游戏运行时**。小游戏跑在 JSCore/V8，
//      与 Node 无关；双版本全绿 ≠ 真机行为已覆盖，真机仍须项目主 GUI 复核。
//      （Manager 12:34 纠正我此前「Node 18 更接近真实运行时」的错误表述）
console.log(`[env] node=${process.version} platform=${process.platform}/${process.arch} pid=${process.pid}`);

// ── 能力探测（13:04 由「版本号比较」改为「直接探测 API」）───────────────────
//
//   【为何不用版本号】Developer 补测了我与 Manager 都漏测的区间，查出真漏洞：
//     官方文档 module.registerHooks(options) —— added in: v23.5.0, v22.15.0
//     ⇒ 这是 **双线 backport**：22.15+ 有、23.5+ 有，但 **23.0–23.4 没有**。
//     原条件 `maj < 22 || (maj === 22 && min < 15)` ⇒ **maj>=23 一律放行**
//     ⇒ 在 23.0/23.1/23.2/23.3/23.4 上绕过断言 → registerHooks 为 undefined
//     → 退回原始报错，我写的人话提示一行都不触发 —— **正是本次修复要消灭的场景**。
//
//   Tester 实测确认（node /tmp/provehole.mjs，直接验判定表达式）：
//     23.0.0 ✅放行 / 23.4.0 ✅放行  ← 🔴 与「API 真实存在」不一致
//
//   【根因归类】版本号只是 API 存在性的**代理指标**，不是直接量。
//     Developer 的提法：「这是被测对象，还是它的代理？」
//     与我那三例自查（把观察说成性质）同源 ⇒ 合并为一句：**别把间接量当直接量。**
//     代理指标一旦与真实量的映射关系变化（此处 = backport 打乱单调性），断言就失效。
//     ⇒ 凡「能直接探测的能力」，一律直接探测；版本号只作参考信息打印，不参与判定。
//
//   ⚠️ 动态 import 不可改回静态：静态 import 在 ESM 链接阶段即失败，
//      早于任何顶层代码执行 ⇒ 下面整段提示一行都跑不到（Tester 首版踩过）。
const m = await import('node:module');

if (typeof m.registerHooks !== 'function') {
  console.error('');
  console.error('='.repeat(78));
  console.error('[esm-hooks] 🔴 当前 Node 缺少 module.registerHooks，脚本无法运行');
  console.error('='.repeat(78));
  console.error(`  当前 Node : v${process.versions.node}`);
  console.error('  需要      : 提供 module.registerHooks 的版本');
  console.error('              即 >= v22.15.0（22.x 线）或 >= v23.5.0（23.x 线）或 >= v24');
  console.error('              ⚠️ 注意 23.0–23.4 **没有**此 API（该 API 为双线 backport，');
  console.error('                 版本号大小并不单调对应 API 存在性）');
  console.error('');
  console.error('  原因：本基建依赖 module.registerHooks（同步 hooks API）。');
  console.error('        更早/缺失版本仅有 module.register()（异步 loader worker），');
  console.error('        二者语义不兼容，不能直接替换。');
  console.error('');
  console.error('  影响：依赖本文件的 render-smoke.mjs / red1-tap-guard.mjs 均无法运行。');
  console.error('        ⇒ 这两个门禁的结论只在具备该 API 的 Node 上成立，请勿据本次');
  console.error('          运行失败推断产品缺陷 —— 产品代码 js/ 与 Node 版本无关');
  console.error('          （js/ 零 Node 专有 API 依赖：无 require / 无 node: / 无 process.*）。');
  console.error('');
  console.error('  处置：换用具备该 API 的 Node 重跑（服务器默认 node 即 v24.x）。');
  console.error('='.repeat(78));
  process.exit(2);
}

// ↓ 能力探测通过后才载入其余依赖
const { registerHooks } = m;
const { readFileSync } = await import('node:fs');
const { fileURLToPath, pathToFileURL } = await import('node:url');
const path = (await import('node:path')).default;

const PROJECT_JS = path.resolve(process.cwd(), 'js');

registerHooks({
  resolve(spec, ctx, next) {
    // 相对导入且无扩展名 → 补 .js
    if (/^\.{1,2}\//.test(spec) && !path.extname(spec)) {
      const parentPath = ctx.parentURL ? fileURLToPath(ctx.parentURL) : process.cwd();
      const abs = path.resolve(path.dirname(parentPath), spec + '.js');
      return { url: pathToFileURL(abs).href, format: 'module', shortCircuit: true };
    }
    return next(spec, ctx);
  },
  load(url, ctx, next) {
    if (url.startsWith('file:')) {
      const p = fileURLToPath(url);
      // 仅对项目 js/ 下的 .js 强制按 ESM 解析，不影响 node_modules
      if (p.endsWith('.js') && p.startsWith(PROJECT_JS)) {
        return { format: 'module', source: readFileSync(p, 'utf8'), shortCircuit: true };
      }
    }
    return next(url, ctx);
  },
});
