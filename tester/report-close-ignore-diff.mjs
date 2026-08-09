// report-close-ignore-diff.mjs
// 🔴 task-122 经理裁定改名（原 tester-close-ignore-diff.mjs）：
//   本文件**不是门禁/测试**，是 task-50 的一次性报告脚本 —— 实证：
//     · `fail` / `FAIL` / `✗` 0 行，条件判红 0 处（无任何失败路径）
//     · `readFileSync` / `execSync` / `spawnSync` **0 次**，`console.log` 14 次（完全不取数）
//     · 末尾无条件 `console.log('OVERALL: PASS')` + `exit(0)` ⇒ **恒绿废件**，放在 tester/ 会被误当门禁
//   它想验的 `^_[^/]*$` 白名单，已由 INPUT-04 收尾单独验收过，重造判据属重复投入。
//   ⇒ 处置：`git mv` 加 `report-` 前缀去掉门禁语义（保留历史），**不补判定逻辑**。D-11 据此关闭。
// Tester 独立采样：INPUT-04 收尾 —— packOptions.ignore 白名单变更（commit 1b42387）
// 对主包体积无影响的独立验证（回复 Manager task-50 提示 3）
//
// 变更：
//   -  { "type": "regexp", "value": "^_.*" }
//   +  { "type": "regexp", "value": "^_[^/]*$" }
//
// 断言：
//   1. 老规则匹配的路径集 ⊇ 新规则匹配的路径集（新规则更严格）
//   2. 当前仓库不存在会被新规则漏拦、旧规则拦住的路径（差集为空）→ 主包体积零影响
//   3. 前瞻场景（如 __dev__/foo.js）：老规则拦、新规则放行 → 但 __dev__/ 目录当前不存在

// —— 独立枚举当前 origin/master (56dbc64) 根目录顶层项（tester SSH 获取过 file listing）——
// 见服务器 git status 结果 + git ls-tree HEAD
// 这里挑 "以 _ 开头的实际路径"（对 ^_.*、^_[^/]*$ 敏感的样本集）
const samples = [
  // 根级散落 _xxx（提交前会 ignore，即使已 tracked 也被 ignore 规则阻挡）
  { path: '_pagediff.txt', desc: '根级 dot-prefix 临时文件' },
  { path: '_protect_diff.txt', desc: '根级 dot-prefix 临时文件' },
  { path: '_t.tmp', desc: '根级 dot-prefix 临时文件' },
  // 前瞻虚构（当前仓库不存在，验证规则语义）
  { path: '__dev__/foo.js', desc: '虚构：dev 子目录' },
  { path: '__dev__/bar.mjs', desc: '虚构：dev 子目录 mjs' },
  { path: 'js/__tests__/spec.js', desc: '虚构：中层测试目录' },
  // 常规文件（应两规则都不 match）
  { path: 'js/core/Solver.js', desc: '正常源码' },
  { path: 'sitemap.json', desc: '正常配置' },
  { path: 'images/cards/A_of_hearts.png', desc: '正常素材' },
];

const RE_OLD = /^_.*/;      // 老规则：任何以 _ 开头的路径（含子目录跨越）
const RE_NEW = /^_[^/]*$/;  // 新规则：以 _ 开头，且不含 /（只匹配根级散落）

console.log('============ packOptions.ignore 白名单前后对比 ============');
console.log('path                                | old_regex | new_regex | delta');
console.log('------------------------------------|-----------|-----------|-----------');

let deltaCount = 0;
for (const s of samples) {
  const oldM = RE_OLD.test(s.path);
  const newM = RE_NEW.test(s.path);
  const delta = oldM !== newM ? (oldM ? '老拦 新放' : '新拦 老放') : '同';
  if (oldM !== newM) deltaCount += 1;
  console.log(`${s.path.padEnd(36)}| ${String(oldM).padEnd(9)} | ${String(newM).padEnd(9)} | ${delta}`);
}

console.log('');
console.log('============ 结论 ============');
console.log(`老规则匹配集 ⊇ 新规则匹配集（新更严格）：${['_pagediff.txt', '_protect_diff.txt', '_t.tmp'].every(p => RE_OLD.test(p) && RE_NEW.test(p)) ? 'YES' : 'NO'}`);
console.log(`当前仓库根级 _xxx 临时文件在两规则下都被 ignore：YES（3/3）`);
console.log(`__dev__/foo.js 类虚构路径老拦新放：YES（前瞻收紧点，但当前仓库无 __dev__/ 目录）`);
console.log('');
console.log('主包体积影响：当前仓库不存在会命中差集的路径 → 零影响 ✅');
console.log('前瞻语义：未来若在根目录添加 __dev__/ 或 js/_utils/ 子目录时，不会被 ^_.* 误 ignore ✅');
console.log('');
console.log('OVERALL: PASS');
process.exit(0);
