#!/usr/bin/env node
/**
 * 退出码「行为型」审计器 —— task-122 / 经理 22:53 指令
 *
 * 🔴 立项动机：纯文本 grep 会整类漏判，我已连错 4 次：
 *   ① `grep -c 'process.exit(0)'` 把 exit(0)/exit(1) 正常条件分支算成硬编码 ⇒ 误报 7 支
 *   ② 正则 `[a-z]+ \?` 匹配不到 `allOk ?` / `failCount === 0 ? 0 : 1` ⇒ 误判十几支
 *   ③ patch 未命中却因 `node --check` 打印「语法 OK」差点当已修（node --check 只验语法！）
 *   ④ 行首正则 `^process\.exit\(0\)` 漏掉「if(fail>0) exit(1) 早退在前」的正确写法 ⇒ 误报 6 支
 *   ⑤ 且「裸跑 rc=1」可能是 ERR_MODULE_NOT_FOUND **崩溃**，不是判红（tester-test-INPUT02 实例）
 *
 * 🔴 故本审计器按【行为】判定，不看文本：
 *   A. 基线跑（带 esm-hooks，避免崩溃假象）⇒ 记 rc_base + 是否真正跑完
 *   B. 注入「强制失败」⇒ 记 rc_inj
 *   C. 判定：rc_inj === 0 ⇒ 🔴 吞红（本审计器的目标缺陷）
 *
 * 双极性自证（条款 10）：审计器本身必须能抓到已知缺陷、且对已修支给 PASS。
 */
import { readFileSync, writeFileSync, mkdtempSync, mkdirSync, rmSync, cpSync, existsSync, readdirSync } from 'fs';
import { spawnSync } from 'child_process';
import { tmpdir } from 'os';
import { join, basename } from 'path';

const ROOT = process.argv[2];
if (!ROOT) { console.error('用法: node tools/rc-behavior-audit.mjs <repoRoot>'); process.exit(2); }

const HOOKS = './tester/render-smoke/esm-hooks.mjs';
let pass = 0, fail = 0;
const bad = [];
const T = (name, ok, extra = '') => {
  if (ok) { pass++; console.log(`  ok  ${name}${extra ? '  ' + extra : ''}`); }
  else { fail++; bad.push(name); console.log(`  XX  ${name}${extra ? '  ' + extra : ''}`); }
};

/** 收集候选：三目录全部 .mjs/.cjs */
function collect() {
  const out = [];
  for (const d of ['tester', 'selftest', 'tools']) {
    const p = join(ROOT, d);
    if (!existsSync(p)) continue;
    for (const f of readdirSync(p)) {
      if (!/\.(mjs|cjs)$/.test(f)) continue;
      if (f === 'rc-behavior-audit.mjs') continue;           // 不自审
      out.push({ dir: d, file: f, rel: `${d}/${f}` });
    }
  }
  return out;
}

/** 跑一支，返回 { rc, stdout, crashed } */
function run(cwd, rel, withHooks) {
  const args = [];
  if (withHooks && existsSync(join(cwd, 'tester/render-smoke/esm-hooks.mjs'))) args.push('--import', HOOKS);
  args.push(rel);
  const s = spawnSync(process.execPath, args, { cwd, encoding: 'utf8', maxBuffer: 1e9, timeout: 180000 });
  const o = (s.stdout || '') + (s.stderr || '');
  // 崩溃识别：Node 错误 banner / 模块未找到 / 未捕获异常
  const crashed = /ERR_MODULE_NOT_FOUND|Cannot find module|^\s*throw |SyntaxError|ReferenceError|TypeError: .*\n\s+at /m.test(o)
                  && !/pass=\d+|OVERALL:|=== 测试完成 ===/.test(o);
  return { rc: s.status, out: o, crashed };
}

/**
 * 注入强制失败：🔴 必须注入【退出码判定链实际使用的那个变量】。
 *
 * 🔴 首版教训（已实测）：我按固定顺序试 fail→failCount→bad，命中了脚本里另一个
 *   局部变量 `let bad = 0`（与退出判定无关），导致 tester-input07-independent /
 *   tester-task103-dimension-probe 被误判为「吞红」—— 它们实有
 *   `process.exit(fail === 0 ? 0 : 1)`。⇒ 必须先从 exit 语句反推判定变量名。
 */
function injectFail(dst, rel) {
  const p = join(dst, rel);
  let s = readFileSync(p, 'utf8');
  const orig = s;

  // ① 从退出语句反推判定变量（最可靠）
  const exitVars = [];
  const reExit = /process\.exit(?:Code\s*=|\()\s*\(?\s*([A-Za-z_$][\w$]*)\s*(?:\?|===|!==|==|>|<)/g;
  for (const m of s.matchAll(reExit)) exitVars.push(m[1]);

  // 🔴 二次修正：同名变量可能有【多处】定义，须取【最后一处】（最接近 exit 的那个）。
  //   实测 tester-input06-regression.mjs 有两个 `const ok`：
  //     L168 `const ok = !!cur && cur === base;`（循环内局部，与退出无关）
  //     L197 `const ok = done();`               ← 退出真正用的
  //   首版正则 replace 只换第一处 ⇒ 注入打在无关局部变量上 ⇒ 误判该支「吞红」。
  for (const v of [...new Set(exitVars)]) {
    const pats = [
      { re: new RegExp('(?:let|var|const)\\s+' + v + '\\s*=\\s*0\\s*;', 'g'), mk: () => 'let ' + v + ' = 1;  /* rc-audit 注入 */' },
      { re: new RegExp('(?:let|var|const)\\s+' + v + '\\s*=\\s*true\\s*;', 'g'), mk: () => 'let ' + v + ' = false;  /* rc-audit 注入 */' },
      { re: new RegExp('(?:let|var|const)\\s+' + v + '\\s*=\\s*[^;]+;', 'g'), mk: () => 'const ' + v + ' = false;  /* rc-audit 注入 */' },
    ];
    let done = false;
    for (const { re, mk } of pats) {
      const ms = [...s.matchAll(re)];
      if (!ms.length) continue;
      const last = ms[ms.length - 1];                       // ★ 取最后一处定义
      s = s.slice(0, last.index) + mk() + s.slice(last.index + last[0].length);
      done = true; break;
    }
    if (done) break;
  }

  // ② 完全无 exit 语句（Node 默认 rc=0）：拿常见计数器兜底，目的是验证它确实不会非零
  if (s === orig) {
    for (const v of ['fail', 'failCount', 'allYes', 'allOk']) {
      let re = new RegExp('(let|var)\\s+' + v + '\\s*=\\s*0\\s*;');
      if (re.test(s)) { s = s.replace(re, 'let ' + v + ' = 1;  /* rc-audit 注入 */'); break; }
      re = new RegExp('(let|var)\\s+' + v + '\\s*=\\s*true\\s*;');
      if (re.test(s)) { s = s.replace(re, 'let ' + v + ' = false;  /* rc-audit 注入 */'); break; }
    }
  }

  if (s === orig) return false;
  writeFileSync(p, s);
  return true;
}

console.log('=== 退出码行为型审计 (task-122) ===');
console.log(`[env] node=${process.version} root=${ROOT}`);

const cands = collect();
// 🔴 新常规：过滤取数前先断言匹配数 > 0，防静默零命中
T('前置：候选脚本数 > 0', cands.length > 0, `候选=${cands.length}`);
T('前置：三目录均有覆盖', ['tester', 'selftest', 'tools'].every(d => cands.some(c => c.dir === d)),
  `tester=${cands.filter(c=>c.dir==='tester').length} selftest=${cands.filter(c=>c.dir==='selftest').length} tools=${cands.filter(c=>c.dir==='tools').length}`);

const swallow = [];   // 吞红支
const noInject = [];  // 注入未命中，无法判定
const crashOnly = []; // 基线即崩溃

for (const c of cands) {
  const tmp = mkdtempSync(join(tmpdir(), 'rcaudit-'));
  try {
    for (const d of ['js', 'tester', 'selftest', 'tools']) {
      if (existsSync(join(ROOT, d))) cpSync(join(ROOT, d), join(tmp, d), { recursive: true });
    }
    const base = run(tmp, c.rel, true);
    if (base.crashed) { crashOnly.push({ ...c, why: 'baseline crash' }); continue; }

    if (!injectFail(tmp, c.rel)) { noInject.push(c); continue; }
    const inj = run(tmp, c.rel, true);
    if (inj.crashed) { noInject.push({ ...c, why: 'inject caused crash' }); continue; }

    if (inj.rc === 0) swallow.push({ ...c, rcBase: base.rc, rcInj: inj.rc });
  } finally { rmSync(tmp, { recursive: true, force: true }); }
}

console.log('');
console.log('--- 判定 ---');
console.log(`  注入命中并判定: ${cands.length - noInject.length - crashOnly.length} 支`);
console.log(`  注入未命中(无标准 fail 变量，无法自动判定): ${noInject.length} 支`);
console.log(`  基线即崩溃(需 hooks/参数，另议): ${crashOnly.length} 支`);
if (noInject.length) console.log('    ' + noInject.map(x => basename(x.file)).join(' '));
if (crashOnly.length) console.log('    ' + crashOnly.map(x => basename(x.file)).join(' '));

console.log('');
if (swallow.length) {
  console.log('🔴 吞红支（注入失败后 rc 仍为 0）:');
  for (const s of swallow) console.log(`    ${s.rel}  rc_base=${s.rcBase} rc_inj=${s.rcInj}`);
} else {
  console.log('✅ 所有可判定支：注入失败后 rc 均非 0');
}

// ═══════════════════════════════════════════════════════════
// 🔴 审计器自身双极性自证（缺它则「0 吞红」分不清"真干净"与"探测器坏了"）
//   造两个已知样本：一支必吞红（无 exit）、一支必正常（动态 exit），
//   看审计器能否分别判出。任一判错 ⇒ 审计器废件，其"零吞红"结论不可采信。
// ═══════════════════════════════════════════════════════════
{
  const selfTmp = mkdtempSync(join(tmpdir(), 'rcself-'));
  const tdir = join(selfTmp, 'tester');
  mkdirSync(tdir, { recursive: true });

  // 样本 A：有失败判定但**无退出码** ⇒ 必被判吞红
  const A = 'zz-selfcheck-swallow.mjs';
  writeFileSync(join(tdir, A),
    "let fail = 0;\nfail += 0;\nconsole.log('OVERALL: ' + (fail ? 'FAIL' : 'PASS'));\n");
  // 样本 B：动态退出码 ⇒ 必被判正常
  const B = 'zz-selfcheck-ok.mjs';
  writeFileSync(join(tdir, B),
    "let fail = 0;\nfail += 0;\nconsole.log('OVERALL: ' + (fail ? 'FAIL' : 'PASS'));\nprocess.exit(fail ? 1 : 0);\n");

  const probe = (f) => {
    const okInj = injectFail(selfTmp, 'tester/' + f);
    if (!okInj) return { injected: false, rc: null };
    const r = spawnSync(process.execPath, ['tester/' + f], { cwd: selfTmp, encoding: 'utf8', maxBuffer: 1e9, timeout: 60000 });
    return { injected: true, rc: r.status };
  };
  const ra = probe(A), rb = probe(B);

  T('🔴 自证：注入器对两个样本均命中', ra.injected && rb.injected, `A=${ra.injected} B=${rb.injected}`);
  T('🔴 自证：能抓到"必吞红"样本（无 exit ⇒ rc 仍 0）', ra.rc === 0, `样本A rc=${ra.rc}`);
  T('🔴 自证：不误报"正常"样本（动态 exit ⇒ rc 非 0）', rb.rc !== 0, `样本B rc=${rb.rc}`);

  rmSync(selfTmp, { recursive: true, force: true });
}

// 🔴 核心断言：零吞红。条款 3 —— 零集判据配存在性前置（上面已断言候选>0 且注入有命中）
T('可判定支数 > 0（防静默零命中）', (cands.length - noInject.length - crashOnly.length) > 0);
T('🔴 零吞红：注入失败后 rc 必非 0', swallow.length === 0,
  swallow.length ? `吞红 ${swallow.length} 支: ${swallow.map(s => basename(s.file)).join(',')}` : '');

// 条款 8：断言总数自断言
const EXPECTED = 8;
T(`断言总数自断言 = ${EXPECTED}`, pass + fail + 1 === EXPECTED, `实际 ${pass + fail + 1}`);

console.log('');
console.log(`RC-AUDIT: pass=${pass} fail=${fail}  ${fail === 0 ? 'ALL PASS ✅' : 'HAS FAIL ❌'}`);
if (bad.length) console.log(`FAILED: ${bad.join(' | ')}`);
process.exit(fail ? 1 : 0);
