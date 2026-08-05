#!/usr/bin/env node
/**
 * tools/verify/verify-frozen6.mjs — 冻结区 6 文件字节零变化门禁（task-74 新增）
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 【为什么需要这支脚本 —— 2026-08-05 task-74 查出的假绿】
 *   此前团队长期用：
 *       git diff --stat 5b80efa -- js/render/CardRenderer.js js/core/Random.js ...
 *   空输出 ⇒ 判「零变化」。但这 6 个路径里 **5 个是错的**：
 *       js/render/CardRenderer.js   ❌ 真实为 js/ui/CardRenderer.js
 *       js/render/Components.js     ❌ 真实为 js/ui/Components.js
 *       js/render/Background.js     ❌ 真实为 js/ui/Background.js
 *       js/render/ButtonRenderer.js ❌ 真实为 js/ui/ButtonRenderer.js
 *       js/core/Random.js           ❌ 真实为 js/utils/Random.js
 *       js/core/Card.js             ✅ 仅这个对
 *   而 `git diff -- <不存在的路径>` **返回空且不报错** ⇒
 *   「空输出」被当成「零变化」，真有人改动 CardRenderer 也照样全绿。
 *
 *   ⇒ 教训：**"无输出" ≠ "无差异"，也可能是 "无对象"。**
 *      与规则 20（取退出码要说清取谁的码）同族：间接量必须交代口径。
 *
 * 【本脚本的口径】
 *   1. 先断言 6 个路径在 5b80efa 中**确实存在**（存在性先于一致性 —— 规则 17
 *      在路径维度的延伸：尺子得先证明自己量到了东西）
 *   2. 再逐个比 `git hash-object <工作区文件>` vs `git rev-parse 5b80efa:<path>`
 *      —— blob SHA-1 逐字节口径，不受 CRLF/mtime 影响
 *   3. 任一不匹配或路径缺失 ⇒ fail，exit 1
 *
 * 【运行】不需要 ESM hooks（不 import 产品代码）：
 *     node tools/verify/verify-frozen6.mjs
 * 取退出码：不经管道；必经管道时用 ${PIPESTATUS[0]}（团队规则 20）。
 * ═══════════════════════════════════════════════════════════════════════════
 */
import { execFileSync } from 'node:child_process';

const BASE = '5b80efa';
// 路径 + 基线 blob SHA-1 双写：路径打错会被 §1 存在性断言抓到，
// SHA-1 写死则连「基线被人动过」也能发现（双保险，互为交叉校验）。
const FROZEN = [
  ['js/core/Card.js',        '471ea23e7389637d69e03e317518764c608e6f75'],
  ['js/ui/Background.js',    '5bf7cd1c9593cee575ff9d084c2edb3a036458f4'],
  ['js/ui/ButtonRenderer.js','d7606fd0b005265229caf7bf9b0d51aba5440424'],
  ['js/ui/CardRenderer.js',  'd9703d0b19ee1a0d331560a6dd20c64680ec6eac'],
  ['js/ui/Components.js',    'a103f9188e171a885f589a73c17e9aa43b9f235c'],
  ['js/utils/Random.js',     'b04dc9f8b6c532e424cbce8a8e9fce3f008601c8'],
];

const git = (args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
let pass = 0, fail = 0;
const ck = (name, cond, detail = '') => {
  if (cond) { pass++; console.log(`  ok  ${name}${detail ? '   ' + detail : ''}`); }
  else { fail++; console.log(`  XX  ${name}   ${detail}`); }
};

console.log('='.repeat(74));
console.log('[frozen6] 冻结区 6 文件字节零变化门禁');
console.log(`  node=${process.version}  base=${BASE}`);
console.log('='.repeat(74));

// ── ① 存在性先于一致性（本门禁存在的全部理由）──
console.log('\n── ① 路径存在性（防「无对象」被当成「无差异」）──');
for (const [p] of FROZEN) {
  let exists = true, sha = '';
  try { sha = git(['rev-parse', `${BASE}:${p}`]); } catch { exists = false; }
  ck(`${p} 在 ${BASE} 中存在`, exists, exists ? sha.slice(0, 12) : '🔴 路径不存在！校验会静默放行');
}

// ── ② 基线 SHA-1 未被篡改 ──
console.log('\n── ② 基线 blob SHA-1 与本文件写死值一致（防基线漂移）──');
for (const [p, want] of FROZEN) {
  let got = '';
  try { got = git(['rev-parse', `${BASE}:${p}`]); } catch { got = '(missing)'; }
  ck(`${p} 基线 SHA-1`, got === want, got === want ? got.slice(0, 12) : `got=${got} want=${want}`);
}

// ── ③ 工作区当前内容 vs 基线，逐字节 ──
console.log('\n── ③ 工作区当前 blob SHA-1 vs 基线（逐字节口径）──');
for (const [p, want] of FROZEN) {
  let now = '';
  try { now = git(['hash-object', p]); } catch (e) { now = '(unreadable: ' + p + ')'; }
  ck(`${p} 字节零变化`, now === want, now === want ? now.slice(0, 12) : `now=${now} base=${want}`);
}

console.log('\n' + '='.repeat(74));
console.log(`[frozen6] pass=${pass} fail=${fail}`);
if (fail) {
  console.log('🔴 冻结区被改动或路径失配 —— 唯一合法处置是撤销对这 6 个文件的改动，');
  console.log('   不得改本门禁的期望值来「修绿」。要改基线须经项目主裁定。');
}
console.log('='.repeat(74));
process.exit(fail ? 1 : 0);
