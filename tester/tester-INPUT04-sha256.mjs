// tester-INPUT04-sha256.mjs — 保护清单 SHA-256 校验
import { execSync } from 'child_process';
import crypto from 'crypto';

const BASE = '757d3ad';
const HEAD = '08904b4';
const FILES = [
  'js/ui/CardRenderer.js',
  'js/ui/Components.js',
  'js/ui/Background.js',
  'js/ui/ButtonRenderer.js',
  'js/core/Card.js',
  'js/utils/Random.js',
];

function sha256Of(rev, path) {
  const buf = execSync(`git show ${rev}:${path}`, { maxBuffer: 100 * 1024 * 1024 });
  return crypto.createHash('sha256').update(buf).digest('hex');
}

let allYes = true;
console.log(`=== 保护清单 SHA-256 校验 (base=${BASE}, head=${HEAD}) ===`);
for (const f of FILES) {
  const a = sha256Of(BASE, f);
  const b = sha256Of(HEAD, f);
  const match = a === b ? 'YES' : 'NO';
  if (match === 'NO') allYes = false;
  console.log(`${f}`);
  console.log(`  base=${a}`);
  console.log(`  head=${b}`);
  console.log(`  match=${match}`);
}
console.log('=== git diff 行数 ===');
const diff = execSync(`git diff ${BASE} ${HEAD} -- ${FILES.join(' ')}`, { maxBuffer: 100 * 1024 * 1024 }).toString();
console.log(`diff-lines=${diff.split('\n').length - 1}`);
console.log(`OVERALL: ${allYes ? 'PASS' : 'FAIL'}`);
// 🔴 task-121 修正：原有 OVERALL: FAIL 判定但**无退出码** ⇒ CI 只看 rc 会吞红。
//   实测修前：注入 allYes=false 得 OVERALL: FAIL 而 REAL_STATUS 仍 0。条款 8 要求 rc 反映断言。
process.exit(allYes ? 0 : 1);
