// scan-rc0.mjs — task-142 盘点器：找「有断言但 rc 恒 0」的支
// 🔴 只读：不写任何被扫描文件；只静态解析 + spawn 子进程收 rc
// 用法: node tools/scan-rc0.mjs [repoRoot]
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.argv[2] || process.cwd();
const HOOKS = './tester/render-smoke/esm-hooks.mjs';

// ── 口径定义（写明并自证，见报告）──
// A. 有断言：出现 fail/FAIL 计数递增，或 assert 调用，或 ✗/❌ 判红输出
// B. rc 联动：存在 process.exit(<含 fail/ok/allOk 等状态变量的表达式>)
//    或 assert 抛错路径（未 catch 的 AssertionError ⇒ node 自动 rc=1）
// C. 恒 0 判定 = 有断言(A) 且 无任何联动出口(B)
//    细分：C1 完全无 process.exit；C2 只有硬写 exit(0)；C3 有联动但存在绕过分支

// 🔴 口径修正4（自查发现，本轮最大一处误判）：首版变量名清单不全 + 守卫只看前 1 行，
//   导致②疑似 8 支【全部误判】。实测它们都是正确联动：
//     tester-bugfix-verify.mjs:760  if (totalPassed === totalCases) { exit(0) } else { exit(1) }
//     tester-divzero-INPUT03.mjs:74 if (passed === total) { exit(0) } else { exit(1) }
//     selftest_input03.mjs:170      if (failed.length > 0) { exit(1) }
//     selftest_input05_solver.mjs:18 if (fail > 0) { exit(1) } ... exit(0)
//   => 变量名补齐 + 守卫窗口由前 1 行扩到前 3 行（if/else 结构常隔 2~3 行）。
const STATE_VARS = /\b(fail|FAIL|fails|failed|failCount|failures|ok|OK|allOk|allYes|overallOK|polarityOk|badVal|badCards|WORST|PENDING|passed|totalPassed|totalCases|total|errCount|errors|bad|mismatch|diffCount)\b/;

// ══════════════════════════════════════════════════════════════════════════
// 🔴 task-147 项②：取值器正例自检闸门（本脚本最重要的部分）
//
// 根因（task-142 实证）：我以 `grep -c … = 0` 断言「无断言」，但那个 0 是
//   **正则坏了**，不是真的不存在 ⇒ 误判 1 支。零命中与不存在必须不可混淆。
// 规程（项目经理 2026-08-16 立为本项目铁律）：
//   凡以「命中 = 0」作为「不存在」结论的，必须先用**已知应命中的正例**证明
//   该正则能命中；正例零命中 ⇒ 取值器失效 ⇒ **绝不输出清单**，直接非 0 退出。
// ══════════════════════════════════════════════════════════════════════════

// 计数类正则单点定义（扫描与自检共用同一条，禁手抄副本 —— 两份必然漂移）
const FAIL_INC_RE = /\b(fail|FAIL|fails|failed|failCount|failCnt|failures|totalFailed|nFail|errCount|errors)\w*\s*(\+\+|\+=)/g;
const PASS_INC_RE = /\b(pass|PASS|passed|passCount|okCount|nPass|totalPassed)\w*\s*(\+\+|\+=)/g;
const EXIT_RE     = /process\s*\.\s*exit\s*\(/g;
const RED_OUT_RE  = /[✗❌]|FAILED|\bFAIL\b/g;

// 正例夹具：每条都必须命中，否则该正则已失效。
// 🔴 `failed++` 是本轮真实漏检样本（tester-test-INPUT02.mjs:41），必须常驻。
const SELFTEST_POSITIVES = [
  // 🔴 task-147 二次修正（自查发现）：首版这里 6 个正例**全是已显式列名**的样本
  //   （fail/failed/failCount… 每个都在分支表里），⇒ 对「派生名兜底 \w* 是否还在」
  //   零鉴别力：实测把 \w* 删掉、甚至把 failed 分支删掉，自检仍报 OK。
  //   这与经理指出的同族毛病一致 —— 用无鉴别力的实验证一个恰好为真的结论。
  //   ⇒ 正例集必须包含**未列名的派生名**，才能真正守住兜底能力。
  { re: FAIL_INC_RE, name: 'FAIL_INC_RE', samples: [
      'fail++;', 'FAIL++;', 'failed++;', 'failCount += 1;', 'failures++;', 'totalFailed++;',
      // ↓ 以下派生名**故意不写进分支表**，只能靠 \w* 兜底命中 ⇒ 删 \w* 即自检失败
      'failedCases++;', 'failCnt2++;', 'failing++;', 'errorsFound += 1;' ] },
  { re: PASS_INC_RE, name: 'PASS_INC_RE', samples: [
      'pass++;', 'passed++;', 'PASS++;', 'passCount += 1;',
      'passedCases++;', 'passTally += 1;' ] },
  { re: EXIT_RE, name: 'EXIT_RE', samples: [
      'process.exit(0);', 'process.exit(fail ? 1 : 0);', 'process . exit (1);' ] },
  { re: RED_OUT_RE, name: 'RED_OUT_RE', samples: [
      "console.log('  ✗ x');", "console.log('❌ y');", "console.log('FAILED: z');" ] },
];

function runSelfTest() {
  const broken = [];
  for (const { re, name, samples } of SELFTEST_POSITIVES) {
    for (const sample of samples) {
      re.lastIndex = 0;                       // g 标志有状态，逐次复位
      if (!re.test(sample)) broken.push(`${name} 漏检正例: ${JSON.stringify(sample)}`);
      re.lastIndex = 0;
    }
  }
  if (broken.length) {
    console.error('🔴 取值器自检失败 —— 正则已失效，拒绝输出清单（零命中 ≠ 不存在）:');
    for (const b of broken) console.error('   · ' + b);
    console.error(`   共 ${broken.length} 条正例漏检。修好正则后再跑，勿采信任何“0 命中”结论。`);
    process.exit(3);                          // 3 = 取值器失效，与判红(1) 区分
  }
  const total = SELFTEST_POSITIVES.reduce((n, g) => n + g.samples.length, 0);
  console.log(`#SELFTEST_OK 取值器正例自检通过：${SELFTEST_POSITIVES.length} 条正则 / ${total} 个正例全部命中`);
}
runSelfTest();   // 🔴 任何扫描动作之前先跑，不通过即退出

function stripComments(src) {
  // 去 // 行注释与 /* */ 块注释（避免注释里的 exit/fail 被当活代码）
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

function analyze(src) {
  const code = stripComments(src);
  const exits = [...code.matchAll(/process\.exit\s*\(([^;]*?)\)\s*;/g)].map(m => m[1].trim());
  // exit 可能跨行（如 process.exit((fail || PENDING.length)\n ? 1 : 0)）⇒ 补一次宽松匹配
  const exitsLoose = [...code.matchAll(/process\.exit\s*\(([\s\S]{0,80}?)\)\s*;/g)].map(m => m[1].trim());
  const allExits = exits.length >= exitsLoose.length ? exits : exitsLoose;
  // 🔴 口径修正2（自查发现）：`process.exitCode = 1` 与 `process.exit(1)` 等效联动，
  //   我首版只认后者 ⇒ 把 selftest_input02.mjs 误判成①恒0。全仓此写法实测 2 支
  //   （tester-input06-r07r03.mjs、selftest_input02.mjs）。
  const exitCodeSet = [...code.matchAll(/process\.exitCode\s*=\s*([^;]+);/g)].map(m => m[1].trim());
  const exitCodeLinked = exitCodeSet.filter(e => /[1-9]/.test(e));
  const hasAssertImport = /from\s+['"]node:assert['"]|require\(['"]assert['"]\)|from\s+['"]assert['"]/.test(code);
  const assertCalls = (code.match(/\bassert\s*(\.\w+)?\s*\(/g) || []).length;
  // 🔴 task-147 项①：原正则 /\b(fail|FAIL|failCount)\s*(\+\+|\+=)/ 对 `failed++` **零命中**
  //   —— \b 后紧接 fail，其后须是 \s 或 + ，而 failed 的下一字符是 e ⇒ 不匹配。
  //   后果实证：tester/tester-test-INPUT02.mjs（:41/:54 failed++）被误判「无断言」归 X，
  //   实为 ① 真恒 0（变异 :103 const pass = false 后输出 12 处 FAIL 而 rc 仍 0）。
  //   ⇒ 用 FAIL_INC_RE 单点定义（供下方正例自检复用同一条正则，禁两处手抄）。
  const failInc = (code.match(FAIL_INC_RE) || []).length;
  // 🔴 口径修正8（阴性对照抓出，修正6 的补丁）：修正6 用「failInc===0」判「绕过计数」，
  //   但全仓存在【正计数模式】—— 只递增 passed/totalPassed，靠 `passed === total` 比较判定，
  //   从不写 fail++。实证 2 支被误判成①：
  //     tester-bugfix-verify.mjs:742-748  totalPassed++/totalCases++ + if (totalPassed === totalCases)
  //     tester-divzero-INPUT03.mjs:70-74  passed = [...].filter(p=>p).length + if (passed === total)
  //   ⇒ 正计数递增也算有效计数，须一并纳入，否则把正确联动误判成假绿。
  const passInc = (code.match(PASS_INC_RE) || []).length;
  const derivedCount = /\b(passed|pass|fail|failed)\s*=\s*[^;]*\.(filter|reduce)\(/.test(code) ? 1 : 0;
  const redOut = (code.match(/[✗❌]/g) || []).length;
  // 🔴 口径修正（本轮自查发现的误判）：`if (FAIL > 0) process.exit(1);` 是**正确联动**，
  //   但状态变量在 if 条件里、不在 exit() 括号内 ⇒ 只看括号会把它误判成②疑似。
  //   实证：tester-v2-tr-interaction.mjs:252 正是此写法，我 task-141 已实测变异 rc=1 真判红。
  //   ⇒ 联动判定改为「exit 表达式 ∪ 同行/前一行的守卫条件」内出现状态变量。
  const lines = code.split('\n');
  const guardedLinked = [];
  lines.forEach((ln, i) => {
    if (!/process\.exit\s*\(/.test(ln)) return;
    // 🔴 口径修正5（阳性对照抓出）：修正4 把窗口开到 3 行后，
    //   上游 `console.log(\`pass=${pass} fail=${fail}\`)` 里的 fail 被误当守卫 ⇒ 漏检 pos2
    //   （只硬写 exit(0) 的真恒 0 支被判成③正常）。
    //   ⇒ 窗口内先剔除 console.* 调用与字符串/模板字面量，只留真控制流。
    const rawCtx = lines.slice(Math.max(0, i - 3), i + 1).join('\n');
    const ctx = rawCtx
      .replace(/console\.\w+\([\s\S]*?\);?/g, '')      // 去日志调用
      .replace(/`[^`]*`/g, '``')                          // 去模板字面量
      .replace(/'[^']*'/g, "''").replace(/"[^"]*"/g, '""'); // 去普通字符串
    // 排除硬写 exit(0) 且无守卫的情形
    const inExit = (ln.match(/process\.exit\s*\(([^)]*)\)/) || [, ''])[1];
    // 🔴 口径修正7（阳性对照第 2 轮抓出）：修正5 去掉日志/字符串后仍漏检 pos2。
    //   真因：窗口内 `c?pass++:fail++`（check 函数定义体，:3 行）含 fail 且含 `?`，
    //   被当成该 exit 的守卫 ⇒ 硬写 exit(0) 被判成③正常。回显实证 linked=["process.exit(0);"]。
    //   ⇒ 守卫必须与该 exit 同属一个控制流：只认「同行守卫」或「窗口内以 if(...) {  / } else {
    //     结尾、且该 exit 在其块内」两种形态；且**硬写 exit(0)/exit(1) 不因窗口内出现
    //     状态变量就算联动**——必须同一 if/else 结构里既有 0 出口又有非 0 出口。
    const sameLineGuard = /\bif\s*\([^)]*\)\s*(\{)?\s*process\.exit|\?[^:]*:/.test(ln);
    const blockGuard = /(\bif\s*\([\s\S]*?\)\s*\{|\}\s*else\s*\{)\s*$/m.test(
      ctx.replace(/process\.exit[\s\S]*$/, ''));
    const guardHasState = STATE_VARS.test(
      (ctx.match(/\bif\s*\(([^)]*)\)/g) || []).join(' ') );
    if (STATE_VARS.test(inExit) ||
        ((sameLineGuard || blockGuard) && guardHasState))
      guardedLinked.push(ln.trim().slice(0, 70));
  });
  const linked = [...new Set([...allExits.filter(e => STATE_VARS.test(e)), ...guardedLinked])];
  const hard0 = allExits.filter(e => /^0$/.test(e));
  const hard1 = allExits.filter(e => /^[12]$/.test(e));
  return {
    exits: allExits, nExit: allExits.length,
    linked, nLinked: linked.length,
    nHard0: hard0.length, nHard1: hard1.length,
    hasAssertImport, assertCalls, failInc, redOut,
    passInc, derivedCount,
    anyCount: failInc + passInc + derivedCount,   // 有效计数 = 负∪正∪派生
    // 🔴 修正9：抽 exit 及守卫引用的状态变量，再查它们是否真被写入过
    exitVars: (() => {
      const names = new Set();
      const src2 = [...linked, ...allExits].join(' ');
      for (const m of src2.matchAll(/\b([A-Za-z_$][\w$]*)\b/g)) {
        const n = m[1];
        if (STATE_VARS.test(n) && !['process','exit','length'].includes(n)) names.add(n);
      }
      return [...names];
    })(),
    hasAssertion: failInc > 0 || assertCalls > 0 || redOut > 0 || passInc > 0,
    get exitVarsNeverSet() {
      if (!this.exitVars.length) return false;
      return this.exitVars.every(v => {
        // 🔴 修正9b：`let pass=0, fail=0;` 这种【声明初始化】不算「被写入」，
        //   否则任何声明过的变量都算有效计数 ⇒ pos3 漏检（实证 neverSet=false 应为 true）。
        //   只认真正的递增/递减/再赋值：v++ / v+= / v-- / v-= / v = <非0表达式>
        const declInit = new RegExp('(let|const|var)\\s+[^;]*\\b' + v + '\\s*=\\s*0\\b');
        const codeNoDecl = code.replace(new RegExp(declInit.source, 'g'), '');
        const inc = new RegExp('\\b' + v + '\\s*(\\+\\+|\\+=|--|-=)').test(codeNoDecl) ||
                    new RegExp('\\b' + v + '\\s*=\\s*(?!0\\s*[;,])[^=]').test(codeNoDecl);
        return !inc;
      });
    },
    nExitCode: exitCodeLinked.length,
    exitCodeSample: exitCodeLinked.slice(0, 2).join(' ; '),
    // 🔴 口径修正3（自查发现）：被 import 的公共库不是可执行支，须排除出分母。
    //   判定：有 export 且无自跑入口（无 process.exit/exitCode 且无总结行输出）。
    //   实测全仓仅 1 支：tester/tester-input06-lib.mjs（被 arb1555/r04/r05/r08/r10 等 import），
    //   它 return { ck, done, st } 供调用方用，rc 由调用方负责 ⇒ 首版误判成①恒0。
    isLib: /^export\s/m.test(code) && allExits.length === 0 && exitCodeLinked.length === 0,
  };
}

const files = [];
for (const dir of ['tester', 'selftest']) {
  const d = path.join(ROOT, dir);
  if (!fs.existsSync(d)) continue;
  for (const f of fs.readdirSync(d).filter(x => x.endsWith('.mjs')).sort())
    files.push(`${dir}/${f}`);
}

function run(rel, args) {
  const r = spawnSync(process.execPath, ['--import', HOOKS, rel, ...args],
    { cwd: ROOT, encoding: 'utf8', timeout: 120000, maxBuffer: 64 * 1024 * 1024 });
  const out = (r.stdout || '') + (r.stderr || '');
  return { rc: r.status === null ? 'SIG' : r.status, out };
}
function parsePF(out) {
  const re = /\b(?:pass|PASS)\s*[=:]\s*(\d+)\s*[,;]?\s*(?:fail|FAIL)\s*[=:]\s*(\d+)/g;
  let m, last = null;
  while ((m = re.exec(out)) !== null) last = [Number(m[1]), Number(m[2])];
  return last;
}

const rows = [];
for (const rel of files) {
  const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  const a = analyze(src);
  // argv 语义不统一（见 232 号盘点器记录）⇒ 双跑取更优
  const rRoot = run(rel, [ROOT]);
  const rBare = run(rel, []);
  const best = (rBare.rc === 0 && rRoot.rc !== 0) ? rBare : rRoot;
  const mode = best === rBare ? 'BARE' : 'ROOT';
  const pf = parsePF(best.out);
  // ── 分级 ──
  let grade, why;
  if (a.isLib) { grade = 'X'; why = '被 import 的公共库（无自跑入口，rc 由调用方负责）'; }
  else if (!a.hasAssertion) { grade = 'X'; why = '无断言（工具/报告脚本）'; }
  // 🔴 口径修正6（阳性对照抓出）：exit(fail?1:0) 形式上联动，但若失败分支从不 fail++，
  //   则 fail 恒 0 ⇒ 实质恒 0（派单三维度之「绕过 fail 计数的失败分支」）。
  //   实证：阳性样本 pos3 判红输出 ✗ 有 1 处、failInc=0，首版被误判③正常。
  //   判定：有判红输出(✗/❌) 但 fail 计数递增次数 = 0，且不靠 assert 抛错。
  // 🔴 口径修正9（阳性 pos3 再漏检后定位到的准确定义）：
  //   「绕过 fail 计数」的本质不是「没有任何计数」，而是
  //   **exit 判据引用的变量，与失败路径实际递增的变量不是同一个**。
  //   实证 pos3：exit(fail?1:0) 用 fail，但失败分支只 console.log 后 return，
  //     成功分支才 pass++ ⇒ passInc=1（有计数）但 fail 永远 0 ⇒ 假绿。
  //   实证 bugfix-verify（须判③）：exit 守卫 if (totalPassed === totalCases)，
  //     而 totalPassed++/totalCases++ 确实在递增 ⇒ 同变量，联动有效。
  //   ⇒ 判定：抽出 exit 及其守卫里引用的状态变量名集合 EV，
  //     若 EV 中【没有任何一个】在代码里被递增/赋值过，则为绕过计数。
  else if (a.nLinked > 0 && a.redOut > 0 && a.exitVarsNeverSet && a.assertCalls === 0) {
    grade = '1'; why = `🔴 exit 判据变量从未被写入（exit 引用 [${a.exitVars.join(',')}]，均无递增/赋值 ⇒ 恒 0 假绿）`;
  }
  else if (a.nLinked > 0) { grade = '3'; why = `联动出口 ${a.nLinked} 处: ${a.linked.slice(0,2).join(' | ')}`; }
  else if (a.nExitCode > 0) { grade = '3'; why = `process.exitCode 联动: ${a.exitCodeSample}`; }
  else if (a.hasAssertImport && a.assertCalls > 0) { grade = '3'; why = `assert 抛错路径 ${a.assertCalls} 处`; }
  else if (a.nExit === 0) { grade = '1'; why = '🔴 有断言且完全无 process.exit'; }
  else if (a.nHard0 > 0 && a.nHard1 === 0) { grade = '1'; why = `🔴 有断言且只有硬写 exit(0) ×${a.nHard0}`; }
  else if (a.nHard1 > 0) { grade = '2'; why = `疑似：有 exit(${a.nHard1>0?'1/2':''}) 但无状态变量联动，需看是否覆盖所有失败分支`; }
  else { grade = '2'; why = '疑似：出口存在但未识别联动'; }
  rows.push({ rel, grade, why, rc: best.rc, mode, rcRoot: rRoot.rc, rcBare: rBare.rc,
    pass: pf?pf[0]:null, fail: pf?pf[1]:null,
    nExit: a.nExit, nLinked: a.nLinked, nHard0: a.nHard0, nHard1: a.nHard1,
    failInc: a.failInc, assertCalls: a.assertCalls, redOut: a.redOut,
    exitsSample: a.exits.slice(0, 3).join(' ; ') });
}

console.log('REL\tGRADE\tRC\tMODE\tPASS\tFAIL\tN_EXIT\tN_LINKED\tN_HARD0\tN_HARD1\tFAIL_INC\tASSERT\tRED_OUT\tWHY\tEXITS');
for (const r of rows) console.log([r.rel, r.grade, r.rc, r.mode, r.pass??'-', r.fail??'-',
  r.nExit, r.nLinked, r.nHard0, r.nHard1, r.failInc, r.assertCalls, r.redOut, r.why, r.exitsSample].join('\t'));

const g = k => rows.filter(r => r.grade === k);
console.log('\n#SUMMARY');
console.log(`#分母 纳入扫描=${rows.length}（tester/*.mjs + selftest/*.mjs）`);
console.log(`#① 确认恒0 = ${g('1').length}`);
console.log(`#② 疑似     = ${g('2').length}`);
console.log(`#③ 正常     = ${g('3').length}`);
console.log(`#X 无断言排除 = ${g('X').length}`);
console.log(`#LIST_1=${g('1').map(r=>r.rel).join(' ')}`);
console.log(`#LIST_2=${g('2').map(r=>r.rel).join(' ')}`);
console.log(`#LIST_X=${g('X').map(r=>r.rel).join(' ')}`);
// 交叉核对：①②中当前实跑 rc≠0 的（说明口径可能误判）
console.log(`#CROSS_1_rcNonZero=${g('1').filter(r=>r.rc!==0).map(r=>`${r.rel}(rc=${r.rc})`).join(' ')}`);
console.log(`#CROSS_2_rcNonZero=${g('2').filter(r=>r.rc!==0).map(r=>`${r.rel}(rc=${r.rc})`).join(' ')}`);
