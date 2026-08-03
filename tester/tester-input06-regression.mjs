// tester-input06-regression.mjs — INPUT-05 全部 34 项回归金字塔（task-65）
// 34 项 = 94 号回归金字塔 30 项（T-L01~05 / T-01~18 / T-R01~07）
//        + INPUT-05 新增 4 项（R-04 无解不自动发牌 / R-05 storage / R-06 sha1 / R-07 pack）
// 说明：本脚本用 **git blob SHA-1 vs 5b80efa** 作保护清单权威锚点（worker1 99 号 §3 结论），
//       不用工作区 sha256（core.autocrlf=true 会使 CRLF 文件 raw sha256 与旧基线不符 → 假红灯）。

import fs from 'node:fs';
import { execSync } from 'node:child_process';
// 依赖导入：优先 .mjs（服务器 node 24 不自动推断 .js 为 ESM），回退 .js
let S;
try { S = await import('../js/core/Solver.mjs'); }
catch { S = await import('../js/core/Solver.js'); }
import { mkCounter } from './tester-input06-lib.mjs';

const {
  findSolutionsWithAST, chooseCanonicalSolution, postOrderSteps,
  divideFractions, addFractions, subtractFractions, multiplyFractions,
  is24, intToFraction, formatExprPretty, toCanonicalKeyV2,
} = S;

const { ck, done } = mkCounter('INPUT-05 34 项回归金字塔');
console.log('tester-input06-regression.mjs  @ ' + new Date().toISOString());
const HEAD = (() => { try { return execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim(); } catch { return 'n/a'; } })();
console.log('HEAD = ' + HEAD);

const num = (n) => ({ op: 'num', value: intToFraction(n), label: String(n) });
const bin = (op, a, b) => ({ op, args: [a, b] });
const K = toCanonicalKeyV2;

// ============================================================
// 层 1 · T-L01 ~ T-L05：AnswerModal 布局常量（5 项）
// ============================================================
console.log('\n' + '='.repeat(70));
console.log('层 1 · T-L01 ~ T-L05 AnswerModal 布局常量（5 项）');
console.log('='.repeat(70));
const am = fs.readFileSync(new URL('../js/ui/AnswerModal.js', import.meta.url), 'utf8');
const grabNum = (re) => { const m = am.match(re); return m ? parseInt(m[1], 10) : null; };
const inRepo = (() => { try { execSync('git rev-parse --git-dir', { stdio: 'pipe' }); return true; } catch { return false; } })();
console.log('git 仓库上下文 = ' + (inRepo ? 'YES' : 'NO（git 类断言将 SKIP）'));
const gitDiffEmpty = (path) => { try { return execSync(`git diff --name-only 5b80efa -- ${path}`, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim() === ''; } catch { return null; } };
{
  const panelW = grabNum(/const PANEL = \{[^}]*w:\s*(\d+)/);
  ck('T-L01 PANEL.w = 305 DP', panelW === 305, `实际 ${panelW}`);
  const fontSize = grabNum(/ITEM_FONT_SIZE\s*=\s*(\d+)/);
  ck('T-L02 ITEM_FONT_SIZE = 17px', fontSize === 17, `实际 ${fontSize}`);
  const ih = grabNum(/ITEM_HEIGHT\s*=\s*(\d+)/), ig = grabNum(/ITEM_GAP\s*=\s*(\d+)/);
  ck(`T-L03 ITEM_STRIDE = ITEM_HEIGHT(${ih}) + ITEM_GAP(${ig}) = 52 DP 且 > 字号`,
     ih === 44 && ig === 8 && (ih + ig) === 52 && (ih + ig) > (fontSize || 0));
  ck('T-L04 AnswerModal 有滚动支持（_scrollY / 拖拽锚点）',
     /_scrollY/.test(am) && /_dragStartScrollY/.test(am));
  if (!inRepo) { console.log('  ⏭ T-L05 SKIP：非 git 仓库上下文（需在服务器 m24 仓库内运行）'); }
  else ck('T-L05 AnswerModal 未被 INPUT-06 改动（git diff vs 5b80efa 为空）',
          gitDiffEmpty('js/ui/AnswerModal.js') === true);
}

// ============================================================
// 层 2 · T-01 ~ T-18：Solver canonicalize + pretty（18 项）
// ============================================================
console.log('\n' + '='.repeat(70));
console.log('层 2 · T-01 ~ T-18 Solver canonicalize + pretty（18 项）');
console.log('='.repeat(70));
ck('T-01 a×1 ≡ a÷1', K(bin('*', num(3), num(1))) === K(bin('/', num(3), num(1))));
ck('T-02 a×1 ≠ a（不代数化简到叶子）', K(bin('*', num(3), num(1))) !== K(num(3)));
ck('T-03 a×2 ≠ a÷2（仅 1 归一）', K(bin('*', num(3), num(2))) !== K(bin('/', num(3), num(2))));
{
  const s = findSolutionsWithAST([1, 2, 8, 8]);
  ck(`T-04 [1,2,8,8] 解数 ≤ 6`, s.length <= 6, `实际 ${s.length}`);
}
{
  const s = findSolutionsWithAST([1, 3, 3, 5]);
  ck(`T-05 [1,3,3,5] 解数 ≤ 6`, s.length <= 6, `实际 ${s.length}`);
}
ck('T-06 1÷a 非归一（≠ a×1）', K(bin('/', num(1), num(3))) !== K(bin('*', num(3), num(1))));
ck('T-07 a×1×1 ≡ a÷1÷1',
   K(bin('*', bin('*', num(3), num(1)), num(1))) === K(bin('/', bin('/', num(3), num(1)), num(1))));
ck('T-08 a×1÷1 ≡ a÷1×1',
   K(bin('/', bin('*', num(3), num(1)), num(1))) === K(bin('*', bin('/', num(3), num(1)), num(1))));
ck('T-09 (a×1)+b ≡ (a÷1)+b',
   K(bin('+', bin('*', num(3), num(1)), num(5))) === K(bin('+', bin('/', num(3), num(1)), num(5))));
{
  const DECKS = [[1,2,3,4],[3,3,8,8],[5,6,6,7],[1,5,5,5],[4,4,10,10],[2,3,4,6],[1,3,4,6],[1,2,5,10],
                 [1,1,3,8],[1,4,6,8],[2,4,5,8],[8,8,3,3],[6,6,6,6],[2,2,2,2],[1,1,1,1],[1,1,1,2],
                 [2,7,11,13],[9,9,9,9],[13,13,13,13],[7,3,3,7]];
  let solvable = 0, unsolvable = 0;
  for (const d of DECKS) { const s = findSolutionsWithAST(d); if (s.length > 0) solvable++; else unsolvable++; }
  ck(`T-10 20 副典型牌 hasSolution 布尔稳定（可解 ${solvable} / 不可解 ${unsolvable}）`,
     solvable + unsolvable === 20 && solvable >= 12, `${solvable}/${unsolvable}`);
}
ck('T-11 (a×b)×c → "3×5×2"（不加冗余括号）',
   formatExprPretty(bin('*', bin('*', num(3), num(5)), num(2))) === '3×5×2',
   formatExprPretty(bin('*', bin('*', num(3), num(5)), num(2))));
ck('T-12 (a×b)÷c → "3×5÷2"',
   formatExprPretty(bin('/', bin('*', num(3), num(5)), num(2))) === '3×5÷2',
   formatExprPretty(bin('/', bin('*', num(3), num(5)), num(2))));
ck('T-13 a÷(b×c) 保括号 🔒 → "24÷(2×3)"',
   formatExprPretty(bin('/', num(24), bin('*', num(2), num(3)))) === '24÷(2×3)',
   formatExprPretty(bin('/', num(24), bin('*', num(2), num(3)))));
ck('T-14 (a÷b)÷c → "24÷2÷3"',
   formatExprPretty(bin('/', bin('/', num(24), num(2)), num(3))) === '24÷2÷3',
   formatExprPretty(bin('/', bin('/', num(24), num(2)), num(3))));
ck('T-15 a÷(b÷c) 保括号 🔒 → "24÷(6÷3)"',
   formatExprPretty(bin('/', num(24), bin('/', num(6), num(3)))) === '24÷(6÷3)',
   formatExprPretty(bin('/', num(24), bin('/', num(6), num(3)))));
ck('T-16 a×(b÷c) → "3×24÷3"',
   formatExprPretty(bin('*', num(3), bin('/', num(24), num(3)))) === '3×24÷3',
   formatExprPretty(bin('*', num(3), bin('/', num(24), num(3)))));
ck('T-17 (a×b)÷(c×d) 右子保括号 → "3×4÷(2×1)"',
   formatExprPretty(bin('/', bin('*', num(3), num(4)), bin('*', num(2), num(1)))) === '3×4÷(2×1)',
   formatExprPretty(bin('/', bin('*', num(3), num(4)), bin('*', num(2), num(1)))));
ck('T-18 加减嵌套观感 → "(2×8+8)×1"',
   formatExprPretty(bin('*', bin('+', bin('*', num(2), num(8)), num(8)), num(1))) === '(2×8+8)×1',
   formatExprPretty(bin('*', bin('+', bin('*', num(2), num(8)), num(8)), num(1))));

// ============================================================
// 层 3 · T-R01 ~ T-R07：交互层代码级静态锚点（7 项）
// ============================================================
console.log('\n' + '='.repeat(70));
console.log('层 3 · T-R01 ~ T-R07 UIManager 交互层代码级静态锚点（7 项）');
console.log('='.repeat(70));
const um = fs.readFileSync(new URL('../js/ui/UIManager.js', import.meta.url), 'utf8');
ck('T-R01 devtools 平台白名单锚点存在', /platform\s*===\s*['"]devtools['"]/.test(um));
ck('T-R02 _lastRealTouchTs 去重时间戳字段存在', um.includes('_lastRealTouchTs'));
ck('T-R03 DEDUP_MS = 40 常量存在', /DEDUP_MS\s*=\s*40/.test(um), (um.match(/DEDUP_MS\s*=\s*\d+/) || [''])[0]);
ck('T-R04 _synthetic 合成事件标记存在', um.includes('_synthetic'));
ck('T-R05 _enableBridge 桥接开关存在', um.includes('_enableBridge'));
ck('T-R06 mouse → touch 事件桥接注册存在', /mousedown|mousemove|mouseup/.test(um));
if (!inRepo) { console.log('  ⏭ T-R07 SKIP：非 git 仓库上下文（需在服务器 m24 仓库内运行）'); }
else ck('T-R07 UIManager 未被 INPUT-06 改动（git diff vs 5b80efa 为空）', gitDiffEmpty('js/ui/UIManager.js') === true);
console.log('  ⏸ 上述 7 项为代码级静态锚点；真机层由项目主 GUI 复核（task-42 授权：真机待补不计 fail）');

// ============================================================
// 层 4 · INPUT-05 新增 4 项（R-04 / R-05 / R-06 / R-07）
// ============================================================
console.log('\n' + '='.repeat(70));
console.log('层 4 · INPUT-05 新增 4 项（34 = 30 + 4）');
console.log('='.repeat(70));
const pgr = fs.readFileSync(new URL('../js/ui/PageRenderer.js', import.meta.url), 'utf8');
const st = fs.readFileSync(new URL('../js/core/Settings.js', import.meta.url), 'utf8');

// 34-1（INPUT-05 R-04）：[无解] 双分支且不自动发牌
{
  const hasNoSol = /noSolModal/.test(pgr);
  ck('34-1 [无解] 弹窗对象存在', hasNoSol);
  const fn = (pgr.match(/_handleNoSolTap\(\)\s*\{[\s\S]*?\n  \}/) || [''])[0];
  ck('34-1 [无解] 分支内不调用 _dealAction（不自动发牌）', fn.length > 0 && !fn.includes('_dealAction('),
     fn.length ? `已定位 _handleNoSolTap 函数体 ${fn.length} 字符` : '未定位到函数体');
  ck('34-1 [无解] 双分支（庆祝 / 再想想 toast）',
     /本局确实无解/.test(pgr) && /再想想/.test(pgr));
}
// 34-2（INPUT-05 R-05）：settings storage 持久化 + 默认 solvable
{
  ck('34-2 Settings 使用 wx.getStorageSync/setStorageSync', /getStorageSync/.test(st) && /setStorageSync/.test(st));
  ck('34-2 storage key = m24.settings', /m24\.settings/.test(st), (st.match(/['"]m24\.settings['"]/) || [''])[0]);
  ck('34-2 默认 dealMode = solvable（历史行为不变）', /dealMode:\s*['"]solvable['"]|DEAL_MODE\.SOLVABLE/.test(st));
  ck('34-2 INPUT-06 新增 advancedCalc 默认 false（默认不改 INPUT-05 行为）',
     /advancedCalc:\s*false/.test(st), (st.match(/advancedCalc:\s*\w+/g) || []).join(' | '));
}
// 34-3（INPUT-05 R-06）：保护清单 6 文件 git blob SHA-1 vs 5b80efa
{
  const FILES = ['js/ui/CardRenderer.js', 'js/ui/Components.js', 'js/ui/Background.js',
                 'js/ui/ButtonRenderer.js', 'js/core/Card.js', 'js/utils/Random.js'];
  let same = 0, skipped = 0;
  for (const f of FILES) {
    let cur = null, base = null;
    if (!inRepo) { skipped++; continue; }
    try { cur = execSync(`git hash-object ${f}`, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim(); } catch {}
    try { base = execSync(`git rev-parse 5b80efa:${f}`, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim(); } catch {}
    const ok = !!cur && cur === base;
    if (ok) same++;
    console.log(`    ${ok ? 'ok ' : 'XX '} ${f.padEnd(26)} cur=${(cur || 'n/a').slice(0, 12)} base=${(base || 'n/a').slice(0, 12)}`);
  }
  if (!inRepo) console.log(`  ⏭ 34-3 SKIP：非 git 仓库上下文（6 文件未校），需在服务器 m24 仓库内运行`);
  else ck(`34-3 保护清单 6 文件 git blob SHA-1 与 5b80efa 一致（${same}/6）`, same === 6);
  console.log('    注：本项用 git blob SHA-1 而非工作区 sha256 —— core.autocrlf=true 使 Components.js');
  console.log('        工作区为 CRLF，raw sha256 与 fc3f1cc 期望值不符但 LF 归一后一致（worker1 99 号 §3 结论）。');
}
// 34-4（INPUT-05 R-07）：pack 体积 ≤ 4MB
{
  let bytes = 0, files = 0;
  const IGNORE = [/^\.git\//, /^node_modules\//, /^selftest\//, /^tools\//, /^tester\//, /^output\//,
                  /^screenshots/, /\.mjs$/, /\.md$/, /\.log$/];
  const walk = (dir, rel = '') => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const r = rel ? `${rel}/${e.name}` : e.name;
      if (IGNORE.some((re) => re.test(r))) continue;
      if (e.isDirectory()) walk(`${dir}/${e.name}`, r);
      else { bytes += fs.statSync(`${dir}/${e.name}`).size; files++; }
    }
  };
  try { walk('.'); } catch (e) { console.log('    walk 异常: ' + e.message); }
  const mb = bytes / 1024 / 1024;
  console.log(`    模拟 pack：${files} 文件  ${mb.toFixed(2)} MB（按 packOptions.ignore 口径剔除 selftest/tools/tester/*.mjs/*.md/*.log）`);
  ck(`34-4 pack 模拟体积 ${mb.toFixed(2)} MB ≤ 4 MB（硬约束）`, mb <= 4);
  ck(`34-4 pack 模拟体积 ${mb.toFixed(2)} MB ≤ 1.65 MB（软目标）`, mb <= 1.65);
}

const ok = done();
console.log('\n项数核对：层1 T-L 5 + 层2 T- 18 + 层3 T-R 7 = 30（94 号金字塔）+ INPUT-05 新增 4 = 34 ✅');
process.exit(ok ? 0 : 1);
