// selftest_input05_regression.mjs — R-08
// 34 项回归金字塔 + INPUT-04 Solver
// 直接 spawn 现有 tester-v2-regression.mjs + tester-INPUT04-solver.mjs
//
// 🔴 task-131 第 3 批 C 类整改（2026-08-14，Tester）：本支原有 3 处缺陷
//   [C-1] :15/:16 用反斜杠 'tester\\xxx.mjs' 作路径 ⇒ Linux 下必 MODULE_NOT_FOUND，
//         子进程根本没跑到测试体。改 path.join，双平台通用。
//   [C-2] :24 `s1Ok = (s1===0)||(s1===1)` 对 node 退出码【几乎恒真】：
//         实测 正常=0 / 判红=1 / 未捕获throw=1 / 模块缺失=1 ⇒ 三种情形全落 {0,1}，
//         只有 exit(2+)/信号 才判红 ⇒ 崩溃被当成"容忍的既存失败"，rc=0 混进绿里（吞红）。
//   [C-3] :25 `s2Ok` 同型恒真（经理只点了 s1，s2 同病），一并治。
//   治法：不看退出码，改为【解析子进程 stdout 的 pass/fail 总结行】——
//         拿不到总结行即视为"没跑起来"⇒ 显式判红（环境不满足必须判红，禁静默跳过）。
//         既存失败仍可容忍，但须"容忍已知条数"而非"容忍任意退出码"。
import { spawnSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { stage, done } from './_diag.mjs';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function run(relPath) {
  const script = path.join(REPO, relPath);          // [C-1] 跨平台路径
  console.log(`\n--- Running ${relPath} ---`);
  const r = spawnSync(process.execPath, [script], { encoding: 'utf-8', cwd: REPO });
  const out = (r.stdout || '') + (r.stderr || '');
  if (r.stdout) console.log(r.stdout);
  if (r.stderr) console.log('STDERR:', r.stderr);
  return { status: r.status, out };
}

// [C-2]/[C-3] 判据取值层与被判事实同层：判"测试是否真跑并给出结果"，就去读它的总结行。
// 宽容匹配全仓 7 种写法（pass = N, fail = N / PASS=N FAIL=N / pass: N, fail: N ...），取最后一次。
function parsePassFail(out) {
  const re = /\b(?:pass|PASS)\s*[=:]\s*(\d+)\s*[,;]?\s*(?:fail|FAIL)\s*[=:]\s*(\d+)/g;
  let m, last = null;
  while ((m = re.exec(out)) !== null) last = { pass: Number(m[1]), fail: Number(m[2]) };
  return last;
}
// 🔴 自证中发现的缺口：初版 CRASH_RE 只列了具体错类（MODULE_NOT_FOUND / RangeError …），
// 注入 `throw new Error('MUTANT-CRASH')` 时存在性前置竟判绿 ⇒ 判据没覆盖通用 throw。
// 改为：具体错类 ∨ 通用未捕获异常特征（stack 的 "    at " 行 / "Node.js v" 尾巴）。
const CRASH_RE = /ERR_MODULE_NOT_FOUND|Cannot find module|MODULE_NOT_FOUND|RangeError|SyntaxError|ReferenceError|TypeError|^\s*at \S+ \(|\bNode\.js v\d/m;

let PASS = 0, FAIL = 0;
function check(name, ok, detail) {
  if (ok) { PASS++; console.log(`  ✓ ${name}${detail ? ' — ' + detail : ''}`); }
  else { FAIL++; console.log(`  ✗ ${name}${detail ? ' — ' + detail : ''}`); }
}

const r1 = run(path.join('tester', 'tester-v2-regression.mjs'));
const r2 = run(path.join('tester', 'tester-INPUT04-solver.mjs'));

stage('两支子测试已跑完，开始判定');

// ── 存在性前置：先证"子进程真跑起来了"，再谈通过与否（零/空集判据必配存在性断言）──
for (const [tag, r] of [['v2-regression', r1], ['INPUT04-solver', r2]]) {
  const crashed = CRASH_RE.test(r.out);
  check(`R-08 存在性前置：${tag} 未崩溃`, !crashed,
    crashed ? `🔴 检出崩溃特征（原实现会把它当"容忍的既存失败"）status=${r.status}` : `status=${r.status}`);
}

const pf1 = parsePassFail(r1.out);
const pf2 = parsePassFail(r2.out);

// ── 主判据：必须拿到总结行；拿不到 = 没跑起来 = 判红（禁静默跳过造成零覆盖伪绿）──
check('R-08a v2-regression 产出 pass/fail 总结行', !!pf1,
  pf1 ? `pass=${pf1.pass} fail=${pf1.fail}` : '🔴 未取到总结行 ⇒ 视为未跑起来');
check('R-08b INPUT04-solver 产出 pass/fail 总结行', !!pf2,
  pf2 ? `pass=${pf2.pass} fail=${pf2.fail}` : '🔴 未取到总结行 ⇒ 视为未跑起来');

// ── 既存失败容忍：容忍"已知条数上限"，不容忍任意退出码 ──
// v2-regression：R5b 按平台生效 ⇒ Linux 31/0、Windows 32/0，两端 fail 均应为 0
const TOL_REGRESSION_FAIL = 0;
// INPUT04-solver：既存 35 红（A-postOrder 21 括号风格 + F-set-eq 14 解数不一致），
// 已在 task-131 第 3 批 Step 1 定性、经理批为"只定性不改"，故本支暂容忍其上限。
const TOL_SOLVER_FAIL = 35;

if (pf1) check(`R-08c v2-regression fail 未超既存上限(${TOL_REGRESSION_FAIL})`,
  pf1.fail <= TOL_REGRESSION_FAIL, `fail=${pf1.fail}`);
if (pf2) check(`R-08d INPUT04-solver fail 未超既存上限(${TOL_SOLVER_FAIL})`,
  pf2.fail <= TOL_SOLVER_FAIL, `fail=${pf2.fail}`);

// ── D-0 断言总数自断言（基数按实测可推导写，非写死浮动值；D-0 自身不计入，防自指）──
// 固定 2 条存在性前置 + 2 条总结行断言 + 各支拿到总结行时才加的 1 条容忍上限断言
const EXPECTED_ASSERTION_COUNT = 2 + 2 + (pf1 ? 1 : 0) + (pf2 ? 1 : 0);
const _total = PASS + FAIL;
if (_total === EXPECTED_ASSERTION_COUNT) {
  PASS++; console.log(`  ✓ D-0 断言总数自断言 — 实测总数=${_total} 期望=${EXPECTED_ASSERTION_COUNT}`);
} else {
  FAIL++; console.log(`  ✗ D-0 断言总数自断言 — 实测总数=${_total} 期望=${EXPECTED_ASSERTION_COUNT}（有断言静默退场）`);
}

console.log(`\n[selftest_input05_regression] R-08: pass=${PASS} fail=${FAIL}`);
done(PASS, FAIL);
console.log(FAIL === 0 ? 'PASS' : 'FAIL');
process.exit(FAIL === 0 ? 0 : 1);
