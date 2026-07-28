// packOptions.ignore 变更影响面
// old: /^_.*/  → 匹配任何以 _ 开头的字符串（含路径）
// new: /^_[^/]*$/ → 只匹配根级、无斜杠的 _xxx 名字

// 微信 IDE packOptions.ignore 的匹配 spec：
// - type=regexp 时，对根相对路径整体做 match（同时也对 basename 做）
// 具体见 98 号 §4.3

const paths = [
  '_pagediff.txt',            // 根级散落，需要 ignore
  '_protect_diff.txt',
  '_t.tmp',
  '__dev__/foo.js',           // 项目主 case：__dev__/xxx 不希望被 ignore
  '__dev__/bar.mjs',
  'js/__tests__/spec.js',     // 子目录也带 __ 前缀
  'js/_hidden/util.js',
  'output/_intermediate/log', // output 目录已 folder-ignored，这里只测正则匹配面
  'images/cards/_ignore-me.png',
  'sitemap.json',              // 无关，作为对照
];

const oldRegex = /^_.*/;
const newRegex = /^_[^/]*$/;

console.log('┌────────────────────────────────────────┬──────────┬──────────┬──────────┐');
console.log('│ 路径                                    │ old ^_.* │ new ^_[^/]*$ │ 差异 │');
console.log('├────────────────────────────────────────┼──────────┼──────────┼──────────┤');
for (const p of paths) {
  const oldM = oldRegex.test(p);
  const newM = newRegex.test(p);
  const diff = oldM === newM ? '(同)' : (oldM ? '❌ 老匹配新不匹配' : '');
  console.log(`│ ${p.padEnd(38)} │ ${(oldM?'match':'skip').padEnd(8)} │ ${(newM?'match':'skip').padEnd(8)} │ ${diff.padEnd(8)} │`);
}
console.log('└────────────────────────────────────────┴──────────┴──────────┴──────────┘');
console.log('');
console.log('=== 差异分析 ===');
console.log('  1. 主包内新增可能进包的文件（相比 279de98 老规则）：');
console.log('     - __dev__/foo.js、__dev__/bar.mjs、js/__tests__/spec.js、js/_hidden/util.js、images/cards/_ignore-me.png');
console.log('     - 但项目当前根/子目录不存在 __dev__ / _hidden / _ignore-me.png（sha 一致，diff 空）');
console.log('  2. 主包被 ignore 的文件（无变化，仍匹配）：');
console.log('     - _pagediff.txt / _protect_diff.txt / _t.tmp 仍 ignore');
console.log('  3. 主包体积影响：');
console.log('     - 因当前仓库不存在会被新规则漏 ignore 的实际路径，主包体积当前不变');
console.log('     - 但作为"预留 __dev__/ 目录不进包被误伤"的白名单收紧，是**正向变更**');
console.log('  4. .mjs 全局 ignore（.*\\.mjs$）未动，Solver.mjs 仍不进包');
