// selftest/_diag.mjs — 失败路径诊断兜底（task-73）
//
// ═══════════════════════════════════════════════════════════════════════════
// 【问题】selftest 脚本的 `pass=/fail=` 汇总行都写在文件末尾。脚本中途 throw
//   （import 失败、断言里数组越界、BigInt 序列化炸掉等）时，末尾那行永远执行不到
//   ⇒ 只剩一段 stack，看不出「跑到第几项、哪项炸的」。
//   ⇒ 诊断信息只服务成功路径，而最需要诊断的恰恰是失败路径。
//   （同源问题：Tester 的 esm-hooks banner 曾放在断言之后，拦停时反而没有环境信息。）
//
// 【手段选择：process.on('exit')，不用 try/finally】
//   · try/finally 要包裹整个脚本主体 ⇒ 13 个脚本全体改缩进，diff 巨大且易出错
//   · process.on('exit') 只需文件头 import 一行 + 用 track() 包一下既有的 ck()，
//     对既有代码近乎零侵入
//   · 且**任何**退出路径都会触发（正常结束 / throw / process.exit），
//     覆盖面比 try/finally 更全
//   · 已知边界：exit 回调内不能做异步操作（Node 规定），故只做同步 console.error
//
// 【为何写 stderr】与正常输出分流，便于 `2>` 单独捕获；stdout 被重定向时仍可见。
//
// 【⚠️ 已知边界：本模块盖不住的情形（实测确认，不是推测）】
//   若脚本自身的 **import 解析失败**（如 ERR_MODULE_NOT_FOUND：引用不存在的
//   模块），Node 在**执行任何语句之前**就报错，本模块根本没被加载，
//   `process.on('exit')` 自然也不会注册 ⇒ **无任何 [diag] 输出**。
//   这类情形靠 Node 自带的 `ERR_MODULE_NOT_FOUND` + 文件名已足够定位，
//   不尝试覆盖（要覆盖得改成 loader/包装进程，成本远大于收益）。
//   本模块真正解决的是：**模块已加载、脚本跑到一半才炸**的情形。
//
// 【用法（推荐：track 自动记进度，无需手插 stage）】
//   import { track, done } from './_diag.mjs';
//   const ck = track((name, cond, detail) => { ... 原实现 ... });
//   ...
//   console.log(`[x] pass=${pass} fail=${fail}`);
//   done(pass, fail);            // ← 声明「我正常跑到汇总行了」
//   process.exit(fail === 0 ? 0 : 1);
//
//   可选：stage('组1 正向判据') 手工标注阶段名，诊断里会显示阶段轨迹。
//
// 未调用 done() 就退出 ⇒ 判定为异常中断 ⇒ 打印最后一项、已过项数、阶段轨迹。
// ═══════════════════════════════════════════════════════════════════════════

const stages = [];
let finished = false;
let counts = null;
let lastItem = null;
let itemCount = 0;

/** 标记进入某阶段（可选）。 */
export function stage(name) {
  stages.push(name);
}

/** 声明脚本已正常跑到汇总行。必须调用，否则退出时会打印诊断。 */
export function done(pass, fail) {
  finished = true;
  counts = { pass, fail };
}

/** 手工更新计数（若不用 track 包装 ck 时使用）。 */
export function progress(pass, fail) {
  counts = { pass, fail };
}

/**
 * 包装既有的 ck/check 函数，自动记录「最后执行到哪一项」与已执行项数。
 * 这样无需在 13 个脚本里手插 stage()，也能答出「哪项炸的」。
 */
export function track(ckFn) {
  return function wrapped(name, ...rest) {
    lastItem = name;
    itemCount++;
    return ckFn.call(this, name, ...rest);
  };
}

process.on('exit', (code) => {
  if (finished) return; // 正常路径：脚本自己的汇总行已打印过
  const bar = '='.repeat(70);
  console.error('');
  console.error(bar);
  console.error('[diag] 🔴 脚本未跑到汇总行就退出了（中途 throw 或提前 exit）');
  console.error(`[diag] 退出码: ${code}`);
  console.error(`[diag] 已执行断言项: ${itemCount} 项`);
  if (lastItem !== null) {
    console.error(`[diag] 最后执行到: 「${lastItem}」`);
    console.error('[diag] ⇒ 故障在该项之内，或在它与下一项之间');
  } else if (stages.length) {
    // 循环型脚本无逐项断言函数，靠 stage() 定位，不能推断为 import 失败
    console.error('[diag] 本脚本无逐项断言函数（循环/基准型），请依阶段轨迹定位');
  } else {
    // 注意：仅当脚本**确实有**逐项断言时，「0 项」才能推出 import 阶段出错。
    // 否则只能说「未采集到进度信息」—— 不得把「没数据」说成「证据」。
    console.error('[diag] 未采集到逐项进度（本脚本可能无断言函数，或故障在 import/顶层初始化）');
    console.error('[diag] ⇒ 请直接看上方 stack 的行号');
  }
  if (counts) console.error(`[diag] 中断时计数: pass=${counts.pass} fail=${counts.fail}`);
  if (stages.length) {
    console.error(`[diag] 阶段轨迹(${stages.length}): ${stages.join(' → ')}`);
  }
  console.error('[diag] 注：本段由 selftest/_diag.mjs 输出，不是产品代码有缺陷的证据；');
  console.error('[diag]     请结合上方 stack 定位。');
  console.error(bar);
});
