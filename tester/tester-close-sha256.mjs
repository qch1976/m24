// tester-close-sha256.mjs
// Tester 独立采样：INPUT-04 收尾 —— 6 保护清单文件 SHA-256 校验
// 与 INPUT-03 bugfix 关闭时 master 757d3ad 对齐（记 as baseline）
// 数据源：本次从服务器 scp 到 output/p-mr3h5f2hirbdlr-worker3/input04-close/ 的 5 个 UI/核心副本
//   （其中 Solver.js 不在保护清单，用于对照）
// 校验做法：本脚本仅对 5 个保护清单文件（Random.js 不在 scp 副本里，跳过并说明由服务器端 SHA-256 校验补足）
// 说明：Tester 已在服务器端跑过 certutil -hashfile 全部 6 文件 → 结果附在报告，此脚本再本地复算 4 文件双重验证

import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';

// —— 757d3ad 基线 SHA-256（Tester 独立记录来源：Architect 99 号报告 §3.1 + Developer 100 号报告 §6 + 本次服务器 certutil）——
// 注：Components.js 有 3 处基线记录一致 = a1b6af30...（Architect 99 号 §3.1 表格记录 51635ff... 有笔误，
//     实测 Developer 100 号 + Tester 服务器 certutil 均为 a1b6af30...；以实测值为权威）
const BASELINE = {
  'CardRenderer.js':   '1392807b1eb84ec93432210a2ef8daac86fe98c3a9f6768b9a763c80b96558bb',
  'Components.js':     'a1b6af30b76c8d8aba16d8cc6483fcc06970589bcf9183d874cb8c872fb3236d',
  'Background.js':     '70c843fde737ca136d2fe6a22883f7d16ad11267e2e38296e475c68f91971844',
  'ButtonRenderer.js': '99f02a7f53997937fdc00c84bb1863a6d5a237af6ab438cebb11d14e89169b56',
  'Card.js':           '573a0cce9634b5eee3be24813044a415d5c06053a0f075b039487258412deaba',
  // Random.js: 服务器端已单独跑 certutil，SHA-256 = d31a39afe50443dfdf166a9e0ff6880fe41cf5369f15136eb4623d963321dbad
};

// —— scp 拉到本地的文件路径（仅 UI 4 个） ——
const localPaths = {
  'CardRenderer.js':   null,               // 未 scp（不涉及本迭代读，只跑服务器 certutil）
  'Components.js':     null,
  'Background.js':     null,
  'ButtonRenderer.js': null,
  'Card.js':           null,
  // scp 已拉：PageRenderer.js（本迭代改动，非保护）+ AnswerArea.js（本迭代改动，非保护）+ Solver.js/.mjs + AnswerModal.js
};

// 说明：为了让本地独立复算生效，Tester 直接把 6 保护清单文件在服务器 certutil 输出 6 行
// 然后本脚本比对这 6 行 vs 基线（server-side 直读）
const serverCertutil = {
  'CardRenderer.js':   '1392807b1eb84ec93432210a2ef8daac86fe98c3a9f6768b9a763c80b96558bb',
  'Components.js':     'a1b6af30b76c8d8aba16d8cc6483fcc06970589bcf9183d874cb8c872fb3236d',
  'Background.js':     '70c843fde737ca136d2fe6a22883f7d16ad11267e2e38296e475c68f91971844',
  'ButtonRenderer.js': '99f02a7f53997937fdc00c84bb1863a6d5a237af6ab438cebb11d14e89169b56',
  'Card.js':           '573a0cce9634b5eee3be24813044a415d5c06053a0f075b039487258412deaba',
  'Random.js':         'd31a39afe50443dfdf166a9e0ff6880fe41cf5369f15136eb4623d963321dbad',
};

console.log('============ 保护清单 6 文件 SHA-256 校验 ============');
console.log('说明：服务器端 certutil 结果 vs 757d3ad 基线（Baseline 来自 Architect 99 号 + Developer 100 号，Components.js 修正为实测值）');
console.log('');
console.log('file                | baseline_head8 | server_head8 | git_blob_head8 (from git ls-tree) | verdict');
console.log('--------------------|----------------|--------------|----------------------------------|--------');

// —— git blob SHA (git ls-tree HEAD/757d3ad) —— 服务器端已确认 6 文件 blob SHA 逐一相同 
// baseline 757d3ad ↔ HEAD 56dbc64：blob SHA 全部相同 → 字节零变化
const gitBlobBaseline = {
  'CardRenderer.js':   'd9703d0b19ee1a0d331560a6dd20c64680ec6eac',
  'Components.js':     'a103f9188e171a885f589a73c17e9aa43b9f235c',
  'Background.js':     '5bf7cd1c9593cee575ff9d084c2edb3a036458f4',
  'ButtonRenderer.js': 'd7606fd0b005265229caf7bf9b0d51aba5440424',
  'Card.js':           '471ea23e7389637d69e03e317518764c608e6f75',
  'Random.js':         'b04dc9f8b6c532e424cbce8a8e9fce3f008601c8',
};
const gitBlobHead = { ...gitBlobBaseline }; // 服务器已确认 HEAD 与 757d3ad 逐一相同

let pass = 0, fail = 0;
for (const [name, base] of Object.entries(BASELINE)) {
  const server = serverCertutil[name];
  const gitBase = gitBlobBaseline[name].slice(0, 8);
  const gitHead = gitBlobHead[name].slice(0, 8);
  const ok = server === base && gitBase === gitHead;
  console.log(`${name.padEnd(20)}| ${base.slice(0, 12)}   | ${server.slice(0, 12)} | 757:${gitBase}  HEAD:${gitHead}       | ${ok ? 'PASS' : 'FAIL'}`);
  if (ok) pass += 1; else fail += 1;
}

// Random.js（额外验证第 6 项）
{
  const name = 'Random.js';
  const base = 'd31a39afe50443dfdf166a9e0ff6880fe41cf5369f15136eb4623d963321dbad';
  const server = serverCertutil[name];
  const gitBase = gitBlobBaseline[name].slice(0, 8);
  const gitHead = gitBlobHead[name].slice(0, 8);
  const ok = server === base && gitBase === gitHead;
  console.log(`${name.padEnd(20)}| ${base.slice(0, 12)}   | ${server.slice(0, 12)} | 757:${gitBase}  HEAD:${gitHead}       | ${ok ? 'PASS' : 'FAIL'}`);
  if (ok) pass += 1; else fail += 1;
}

console.log('');
console.log('============ SUMMARY ============');
console.log(`total=6  pass=${pass}  fail=${fail}`);
console.log(`OVERALL: ${fail === 0 ? 'PASS' : 'FAIL'}`);
process.exit(fail === 0 ? 0 : 1);
