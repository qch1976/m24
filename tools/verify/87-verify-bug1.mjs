// Bug1 验证脚本 v2：直接把 js/core/Solver.js 复制成 .mjs 加载
import fs from 'fs';
import path from 'path';
import url from 'url';

const projectRoot = path.resolve(process.cwd());
const srcPath = path.join(projectRoot, 'js', 'core', 'Solver.js');
const dstPath = path.join(projectRoot, 'Solver_probe.mjs');

// 复制 Solver.js 到 .mjs（内容一致，仅扩展名）
fs.copyFileSync(srcPath, dstPath);

const solverMod = await import(url.pathToFileURL(dstPath).href);
const { findSolutionsWithAST, toCanonicalKey, canonicalize } = solverMod;

const numbers = [5, 6, 6, 7];
console.log('=== findSolutionsWithAST([5,6,6,7]) ===');
const sols = findSolutionsWithAST(numbers);
console.log('Total solutions:', sols.length);
console.log('');
console.log('First 20 (expr | canonical key):');
sols.slice(0, 20).forEach((s, i) => {
  console.log(`${(i + 1).toString().padStart(2)}. expr = ${s.expr}`);
  console.log(`    key = ${s.key}`);
});

console.log('');
console.log('=== 检查前 8 行 canonicalize 是否重复 ===');
const seen = new Map();
sols.slice(0, 8).forEach((s, i) => {
  const prev = seen.get(s.key);
  if (prev !== undefined) {
    console.log(`row ${i + 1}: DUPLICATE of row ${prev + 1}`);
  } else {
    seen.set(s.key, i);
  }
});
console.log('unique keys in top 8:', seen.size);

console.log('');
console.log('=== 手工分析：项目主主张同解组 ===');
console.log('Group A (1,2,5,7): expected canonically equivalent to (5+6-7)×6');
[0,1,4,6].forEach(i => {
  if (sols[i]) console.log(`  row ${i+1}: ${sols[i].expr}`);
});
console.log('Group B (3,4,8): expected canonically equivalent to 6×6-(7+5)');
[2,3,7].forEach(i => {
  if (sols[i]) console.log(`  row ${i+1}: ${sols[i].expr}`);
});

// 清理
fs.unlinkSync(dstPath);
