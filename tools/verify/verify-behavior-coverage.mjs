#!/usr/bin/env node
// tools/verify/verify-behavior-coverage.mjs — B 层【覆盖率】元门禁（task-71 返工新增）
//
// ═══════════════════════════════════════════════════════════════════════════
// 【为什么需要这一支 —— 根因不是「漏了 size()」】
//   manager 复核时把 Deck.mjs 的 `size()` 改成 `return 999`，B 层 32 项断言**全绿**。
//   直接原因是 size/reset 没被断言；但**根因是我挑断言靠「想到哪个写哪个」**，
//   没有对着 API 表面逐个过 —— 这种漏是必然的，不是偶然的。
//   补完 size/reset 只修掉症状；这支脚本修的是**方法**：
//   机械枚举三对 .mjs 的公开 API，逐个检查 B 层脚本是否真的提到了它。
//   ⇒ 以后任何人给这三个模块**新增方法**而忘了加行为断言，这里立刻判红。
//
// 【这把尺子自身的已知弱点，写明白，不假装它很强】
//   判据是「B 层脚本源码里出现该标识符」，这是**代理量而非直接量**（团队规则 18）：
//   理论上写一句 `// size` 注释就能骗过它。为此已做两点缓解：
//     1. 比对前**剥掉注释**（行注释 + 块注释），注释里提名字不算覆盖
//        —— 这正是 TOOLS.md 第 2 例栽过的坑：grep 计数被自己写的注释刷绿。
//     2. 它只是**第二道网**：真正的判定权在 verify-mjs-behavior.mjs 的行为断言。
//   本脚本的定位是「防遗忘」，不是「防作弊」。
//
// 【为何白名单为空】
//   目前三对模块的公开方法都应有行为断言，无豁免项。若将来确有不可测成员
//   （如纯 UI 副作用），在 EXEMPT 里登记并写明理由，而不是删掉这支脚本。
// ═══════════════════════════════════════════════════════════════════════════

import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(import.meta.dirname, '../..');
const GATE = path.join(ROOT, 'tools/verify/verify-mjs-behavior.mjs');

// B 层负责的三对「语义重写子集」（与 verify-mjs-behavior.mjs 保持一致）
const TARGETS = [
  'js/core/Card.mjs',
  'js/core/DealGenerator.mjs',
  'js/core/Deck.mjs',
];

// 豁免项：{ '模块路径': ['成员名'] }，每条都必须写理由。当前为空。
const EXEMPT = {};

// JS 关键字：`if (`、`for (` 等会被「2 空格缩进 + 标识符 + (」的正则误当成方法名。
// 这是我第一版真踩到的误报（枚举出 `for`/`if` 两个假成员）。
const KEYWORDS = new Set([
  'if', 'for', 'while', 'switch', 'catch', 'return', 'function',
  'constructor', 'do', 'else', 'try', 'finally', 'typeof', 'new',
]);

/** 剥掉注释，避免「注释里提到名字」被误判为已覆盖。 */
function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((l) => !l.trim().startsWith('//'))
    .join('\n');
}

/** 枚举一个模块的公开 API：class 方法 + 顶层 export。 */
function publicApi(src) {
  const names = new Set();
  for (const m of src.matchAll(/^\s{2}([a-zA-Z_]\w*)\s*\(/gm)) {
    if (!KEYWORDS.has(m[1])) names.add(m[1]);
  }
  for (const m of src.matchAll(/^\s{2}get\s+([a-zA-Z_]\w*)/gm)) names.add(m[1]);
  for (const m of src.matchAll(/^export\s+(?:function\s+(\w+)|const\s+(\w+)|class\s+(\w+))/gm)) {
    names.add(m[1] || m[2] || m[3]);
  }
  return [...names].sort();
}

let pass = 0;
let fail = 0;
const bad = [];
const ck = (name, cond, detail = '') => {
  if (cond) { pass++; console.log(`  ok  ${name}${detail ? '  ' + detail : ''}`); }
  else { fail++; bad.push(name); console.log(`  XX  ${name}${detail ? '  ' + detail : ''}`); }
};

console.log('='.repeat(70));
console.log('[behavior-coverage] B 层行为断言的 API 覆盖率元门禁');
console.log('='.repeat(70));

const gateSrc = stripComments(fs.readFileSync(GATE, 'utf-8'));

for (const rel of TARGETS) {
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) { ck(`${rel} 存在`, false, '文件缺失'); continue; }
  const api = publicApi(fs.readFileSync(abs, 'utf-8'));
  const exempt = EXEMPT[rel] ?? [];
  const missing = api.filter(
    (n) => !exempt.includes(n) && !new RegExp(`\\b${n}\\b`).test(gateSrc),
  );
  console.log(`\n${rel}  公开成员 ${api.length} 个: ${api.join(', ')}`);
  ck(
    `${rel} 全部公开成员均被 B 层行为断言覆盖`,
    missing.length === 0,
    missing.length ? `🔴 未覆盖: ${missing.join(', ')}` : `${api.length}/${api.length}`,
  );
}

console.log('\n' + '='.repeat(70));
console.log(`[behavior-coverage] pass=${pass} fail=${fail}`);
if (fail > 0) {
  console.log(`🔴 FAILED: ${bad.join(' | ')}`);
  console.log('⇒ 有公开成员没有行为断言。请到 tools/verify/verify-mjs-behavior.mjs 补断言，');
  console.log('  而不是把成员加进本脚本的 EXEMPT —— 那等于把门禁调松（团队规则 21）。');
  console.log('='.repeat(70));
  process.exit(1);
}
console.log('✅ 三对模块公开 API 全部纳入行为断言');
console.log('='.repeat(70));
process.exit(0);
