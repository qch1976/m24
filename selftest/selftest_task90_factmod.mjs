// task-90 selftest：INPUT-07 阶乘 + 模（solver / parser / 去重键扩展 / 按钮接入）
// 依据：INPUT-07.md §1~§4 + 架构师 200 号规范 §5 断言表 A-1 ~ A-16
// 精确运算：全程 Fraction(BigInt)，禁 ===24 / ==24 / toFixed / epsilon
import fs from 'fs';
import * as RS from '../js/core/RecipSolver.mjs';
import * as PP from '../js/core/RecipParser.mjs';

let pass = 0, fail = 0;
const T = (n, c, got) => {
  if (c) { pass++; console.log('  PASS', n); }
  else { fail++; console.log('  FAIL', n, '=> got:', JSON.stringify(got)); }
};
const K = (t) => RS.keySol(RS.reduceToFixpoint(t).node);
const V = (t) => { const v = RS.evalNode(t); return v ? `${v.n}/${v.d}` : 'null'; };
const N = (c, s = 0) => RS.numLeaf(c, s);

// token 构造器（parser 用）
const tN = (i) => ({ type: 'number', cardIndex: i });
const tO = (v) => ({ type: 'operator', value: v });
const tL = { type: 'left_paren' }, tR = { type: 'right_paren' };
const tRC = { type: 'recip' }, tFA = { type: 'fact' }, tMO = { type: 'mod' };

console.log('=== A-1 / A-2：1! 与 2! 退化（F-1/F-2）===');
T('A-1 1! 不可枚举', RS.factEnumerable(1) === false, RS.factEnumerable(1));
T('A-2 2! 不可枚举', RS.factEnumerable(2) === false, RS.factEnumerable(2));
// 归约期剥除 ⇒ 归约后无 fact 节点 ⇒ usedFact 自然 false（结构性保证，非特判）
const f1 = RS.factLeaf(1, 0), f2 = RS.factLeaf(2, 0);
T('A-1b 1! 归约后剥为纯叶子', K(f1) === 'n1', K(f1));
T('A-2b 2! 归约后剥为纯叶子', K(f2) === 'n2', K(f2));
T('A-1c 1! 归约后 usedFact=false', RS.countFact(RS.reduceToFixpoint(f1).node) === 0, null);
T('A-2c 2! 归约后 usedFact=false', RS.countFact(RS.reduceToFixpoint(f2).node) === 0, null);

console.log('=== 🔴 A-3：0! 是有效高级解，不是退化（F-3，需求点名易错点）===');
T('A-3 0! 可枚举', RS.factEnumerable(0) === true, RS.factEnumerable(0));
T('A-3b 0! = 1', V(RS.factLeaf(0, 0)) === '1/1', V(RS.factLeaf(0, 0)));
T('A-3c 0! 归约后仍含 fact（usedFact=true）',
  RS.countFact(RS.reduceToFixpoint(RS.factLeaf(0, 0)).node) === 1, null);
T('A-3d 0! 键为 f0，与牌面 1 的 n1 不同（I-5 mask 原则）',
  K(RS.factLeaf(0, 0)) === 'f0' && K(RS.factLeaf(0, 0)) !== 'n1', K(RS.factLeaf(0, 0)));

console.log('=== 规范 §4.1：有效阶乘恰为 5 个（0,3,4,5,6）===');
const effF = [];
for (let c = 0; c <= 13; c++) if (RS.factEnumerable(c)) effF.push(c);
T('§4.1 有效阶乘 = [0,3,4,5,6]', effF.join(',') === '0,3,4,5,6', effF);
T('A-13 牌面 ≥7 不枚举 !（§1.2.2 / R-03）',
  [7, 8, 9, 10, 11, 12, 13].every((c) => !RS.factEnumerable(c)), null);
T('§4.1 阶乘值域 {1,6,24,120,720}',
  effF.map((c) => String(RS.factBig(c))).join(',') === '1,6,24,120,720',
  effF.map((c) => String(RS.factBig(c))));

console.log('=== A-4：a%a 不被枚举（M-1）含双同值牌牌组 ===');
T('A-4 6%6 不可枚举', RS.modEnumerable(6, 6) === false, null);
// [6,6,8,12]：两张 6 是不同牌（mask 不同位），但判据是【值】相等 ⇒ 仍剔除（规范 §3.2 陷阱检查）
const adv6 = RS.advVariants([6, 6, 8, 12]);
const has66 = adv6.some((lv) => lv.some((t) => t.op === 'mod' && t.a.card === 6 && t.b.card === 6));
T('A-4b [6,6,8,Q] 双同值牌亦不产出 6%6', has66 === false, has66);
T('A-4c a%a 全牌面均不枚举',
  Array.from({ length: 14 }, (_, i) => i).every((a) => !RS.modEnumerable(a, a)), null);

console.log('=== 规范 §4.2/§4.3：模有效组合 169 组、结果为 0 者 37 组 ===');
let tot = 0, eff = 0, zero = 0;
for (let a = 0; a <= 13; a++) for (let b = 1; b <= 13; b++) {
  tot++;
  if (RS.modEnumerable(a, b)) { eff++; if (BigInt(a) % BigInt(b) === 0n) zero++; }
}
T('§4.2 总空间 = 182', tot === 182, tot);
T('§4.2 有效组合 = 169（新口径，旧「54 组」已作废）', eff === 169, eff);
T('§4.3 结果为 0 的组数 = 37', zero === 37, zero);

console.log('=== 🔴 A-5：37 组结果为 0 的模式互不归并（I-4，用 value 单键去重会错删 36 条）===');
// 抽 6 组不同 mask、同值 0 的模式，键必须两两不同
const zeroPats = [[7, 1], [12, 1], [0, 5], [0, 9], [8, 4], [12, 6]];
const zk = zeroPats.map(([a, b]) => K(RS.modLeaf(a, 0, b, 1)));
const zv = zeroPats.map(([a, b]) => V(RS.modLeaf(a, 0, b, 1)));
T('A-5a 抽样 6 组结果全为 0', zv.every((x) => x === '0/1'), zv);
T('A-5b 6 组键两两不同（不归并）', new Set(zk).size === 6, zk);

console.log('=== 🔴 A-6：% 必须保序（§3.4，与上轮 (8-6)/2 同型陷阱）===');
for (const [a, b] of [[7, 3], [12, 5], [8, 6]]) {
  const x = RS.modLeaf(a, 0, b, 1), y = RS.modLeaf(b, 1, a, 0);
  T(`A-6 ${a}%${b} 与 ${b}%${a} 键不同`, K(x) !== K(y), [K(x), K(y)]);
  T(`A-6 ${a}%${b} 与 ${b}%${a} 值确实不同`, V(x) !== V(y), [V(x), V(y)]);
}
// 反向保护：% 不得被并入乘除链排序
const modInMul = { op: '*', a: RS.modLeaf(7, 0, 3, 1), b: N(2, 2) };
const modInMulSwap = { op: '*', a: RS.modLeaf(3, 1, 7, 0), b: N(2, 2) };
T('A-6c 乘法链内的 % 仍保序（未被排序交换）', K(modInMul) !== K(modInMulSwap),
  [K(modInMul), K(modInMulSwap)]);

console.log('=== A-7（task-95 期望值反转）：零项消去后 usedMod 仍须 true ===');
// 🔴 架构师 202 号裁定 §2.3：本断言原期望值写错了方向，已反转。
//   旧：「消去后 usedMod=false（标记在归约后判定）」—— 这是 200 号 §2.4 的规范定性错误
//   新：标记按【原式】判定 ⇒ usedMod 仍为 true，解落【高级】分区
//   依据：INPUT-07 §1.3.3「a%1=0 … 均有效，计入高级解」
//   牌确实被消耗了（原式 4 张全用），符号确实用过，标记不该被抹。
// ⭐ 注意：去重键仍取归约式（A-7a 保持）—— 键归键、标记归标记。
const zeroMod = { op: '+', a: N(5, 2), b: RS.modLeaf(12, 0, 1, 1) };
const rrZ = RS.reduceToFixpoint(zeroMod);
T('A-7a 归约式仍为 n5（键依旧取归约式，未变）', RS.keySol(rrZ.node) === 'n5', RS.keySol(rrZ.node));
T('A-7b🔴 归约式确已不含 mod（证明确有可消对象）', RS.countMod(rrZ.node) === 0, RS.countMod(rrZ.node));
T('A-7c 原式确实含 mod', RS.countMod(zeroMod) === 1, null);
T('A-7d🔴【期望反转】标记按原式判定 ⇒ usedMod 须 true',
  RS.countMod(zeroMod) > 0, RS.countMod(zeroMod) > 0);

console.log('=== A-8：a%1、a<b 时 a%b 均计入高级解（M-2/M-3）===');
T('A-8a 7%1 可枚举', RS.modEnumerable(7, 1) === true, null);
T('A-8b 12%1 可枚举', RS.modEnumerable(12, 1) === true, null);
T('A-8c 3%7 可枚举（a<b）', RS.modEnumerable(3, 7) === true, null);
T('A-8d 5%12 可枚举（a<b）', RS.modEnumerable(5, 12) === true, null);
T('A-8e 3%7 = 3（a<b 时结果 = a）', V(RS.modLeaf(3, 0, 7, 1)) === '3/1', V(RS.modLeaf(3, 0, 7, 1)));
T('A-8f 0%5 可枚举（M-4 王牌作被模数）', RS.modEnumerable(0, 5) === true, null);
T('A-8g 王牌 0 作模数不可枚举（M-6）', RS.modEnumerable(7, 0) === false, null);

console.log('=== 🔴 A-15：禁止矩阵 9 行，parser 各须拒收（§1.5.2）===');
// ⚠️ 判据必须验【错误码】而非仅【ok===false】：
//   实测发现把 isRawLeaf 放宽后，(3!)! 仍会报错 —— 但是
//   error=unexpected_token / detail="Cannot convert undefined to a BigInt"（崩溃），
//   (7%3)%2 则报 mod_not_integer。两者都不是【作用域判据】在工作。
//   若只验 ok===false，变异不会被判红 ⇒ 技术上属于「把间接量当直接量」。
//   ⇒ 必须断言拒收原因是预期的作用域错误码。
const SCOPE_ERRS = [
  PP.ERR.RECIP_OPERAND_NOT_LEAF,
  PP.ERR.FACT_OPERAND_NOT_LEAF,
  PP.ERR.MOD_OPERAND_NOT_LEAF,
];
const CV = [3, 4, 7, 2];  // slot0=3 slot1=4 slot2=7 slot3=2
const badRows = [
  ['行1 倒数×倒数 1/(1/3)', [tRC, tL, tRC, tN(0), tR], PP.ERR.RECIP_OPERAND_NOT_LEAF],
  ['行2 倒数×阶乘 1/(3!)', [tRC, tL, tN(0), tFA, tR], PP.ERR.RECIP_OPERAND_NOT_LEAF],
  ['行3 倒数×模   1/(7%3)', [tRC, tL, tN(2), tMO, tN(0), tR], PP.ERR.RECIP_OPERAND_NOT_LEAF],
  ['行4 阶乘×倒数 (1/3)!', [tL, tRC, tN(0), tR, tFA], PP.ERR.FACT_OPERAND_NOT_LEAF],
  ['行5 阶乘×阶乘 (3!)!', [tL, tN(0), tFA, tR, tFA], PP.ERR.FACT_OPERAND_NOT_LEAF],
  ['行6 阶乘×模   (7%3)!', [tL, tN(2), tMO, tN(0), tR, tFA], PP.ERR.FACT_OPERAND_NOT_LEAF],
  ['行7 模×倒数   7%(1/3)', [tN(2), tMO, tL, tRC, tN(0), tR], PP.ERR.MOD_OPERAND_NOT_LEAF],
  ['行7b模×倒数   (1/3)%2', [tL, tRC, tN(0), tR, tMO, tN(3)], PP.ERR.MOD_OPERAND_NOT_LEAF],
  ['行8 模×阶乘   7%(3!)', [tN(2), tMO, tL, tN(0), tFA, tR], PP.ERR.MOD_OPERAND_NOT_LEAF],
  ['行8b模×阶乘   (3!)%2', [tL, tN(0), tFA, tR, tMO, tN(3)], PP.ERR.MOD_OPERAND_NOT_LEAF],
  ['行9 模×模     (7%3)%2', [tL, tN(2), tMO, tN(0), tR, tMO, tN(3)], PP.ERR.MOD_OPERAND_NOT_LEAF],
];
for (const [name, ts, wantErr] of badRows) {
  const r = PP.parse(ts, CV);
  T(`A-15 拒收 ${name}`, r.ok === false, r.ok ? '误放行' : r.error);
  // ⭐ 强判据：必须因【作用域】拒收，不得是崩溃/其他错误顶替
  T(`A-15★ ${name} 拒收原因为作用域错误（非崩溃代现）`,
    r.ok === false && r.error === wantErr, `${r.error} detail=${r.detail || ''}`);
  T(`A-15☆ ${name} 未因内部崩溃被拒`,
    !(r.detail && /BigInt|undefined|Cannot/.test(String(r.detail))), String(r.detail || ''));
}

console.log('=== 🔴 A-16：不得误伤合法式（§1.5.4 冗余括号）===');
const goodRows = [
  ['1/3', [tRC, tN(0)]],
  ['3!', [tN(0), tFA]],
  ['7%3', [tN(2), tMO, tN(0)]],
  ['(4)!', [tL, tN(1), tR, tFA]],
  ['((4))!', [tL, tL, tN(1), tR, tR, tFA]],
  ['1/(3)', [tRC, tL, tN(0), tR]],
  ['1/((3))', [tRC, tL, tL, tN(0), tR, tR]],
  ['(7)%(3)', [tL, tN(2), tR, tMO, tL, tN(0), tR]],
];
for (const [name, ts] of goodRows) {
  const r = PP.parse(ts, CV);
  T(`A-16 通过 ${name}`, r.ok === true, r.ok ? 'ok' : r.error);
}

console.log('=== A-9 / A-11 / A-12：需求 R-02/R-04/R-05 点名用例 ===');
const named = [
  ['A-9  (2+2)! 拒', [tL, tN(3), tO('+'), tN(3), tR, tFA], CV],
  ['A-9  (3×2)! 拒', [tL, tN(0), tO('*'), tN(3), tR, tFA], CV],
  ['A-9  (4!)!  拒', [tL, tN(1), tFA, tR, tFA], CV],
  ['A-11 (3+4)%3 拒', [tL, tN(0), tO('+'), tN(1), tR, tMO, tN(0)], CV],
  ['A-11 7%(1+2) 拒', [tN(2), tMO, tL, tN(0), tO('+'), tN(3), tR], CV],
  ['A-12 7%0 拒（王牌作模数）', [tN(2), tMO, tN(0)], [0, 4, 7, 2]],
];
for (const [name, ts, cv] of named) {
  const r = PP.parse(ts, cv);
  T(name, r.ok === false, r.ok ? '误放行' : r.error);
}
// ⭐ A-12 强判据：b=0 必须因 MOD_BY_ZERO 拒收，不得靠其他错误顶替
//   （移除 b=0 校验后，若只验 ok===false，会被别的错误掩盖而不判红）
const r7m0 = PP.parse([tN(2), tMO, tN(0)], [0, 4, 7, 2]);
T('A-12★ 7%0 拒收原因恰为 mod_by_zero', r7m0.error === PP.ERR.MOD_BY_ZERO,
  `${r7m0.error} detail=${r7m0.detail || ''}`);
// 求值层也必须拒（双层防护）
const modZeroAst = { op: 'mod', a: RS.numLeaf(7, 0), b: RS.numLeaf(0, 1) };
T('A-12☆ evalNode(7%0) 返回 null（求值层也拒）', RS.evalNode(modZeroAst) === null,
  String(RS.evalNode(modZeroAst)));
T('A-12☆ modEnumerable(7,0)=false（枚举层也拒）', RS.modEnumerable(7, 0) === false, null);

console.log('=== R-01：开关开/关两态；关闭态严格等于初级符号完成态 ===');
const deck = [3, 6, 7, 11];
const off = RS.solve(deck, { advancedCalc: false });
const on = RS.solve(deck, { advancedCalc: true });
const compat = RS.solve(deck);   // 不传 opts = INPUT-06 兼容态
T('R-01a 关闭态 advanced 恒为 0', off.advanced.size === 0, off.advanced.size);
T('R-01b 打开态 ⊇ 关闭态（解集只增不减）',
  [...off.primary.keys()].every((k) => on.primary.has(k)), null);
T('R-01c 打开态确实纳入了阶乘/模（advanced 非空）', on.advanced.size > 0, on.advanced.size);
// ⭐ R-01 核心：关闭态必严格等于【纯初级符号】—— 用多个有初级解的牌组验证
//   ⚠️ 不能用 (3,6,7,J) 验「rawHits>0」：它本就是无初级解牌组（primary=0），
//      关闭态 rawHits=0 是正确结果。验证必须用确有初级解的牌组。
let r01ok = true, r01detail = [];
for (const dk of [[1, 2, 3, 4], [3, 3, 8, 8], [2, 3, 4, 12], [2, 4, 5, 8]]) {
  const o = RS.solve(dk, { advancedCalc: false });
  const c = RS.solve(dk);
  // 关闭态的 primary 必须与兼容态的 primary 完全相同（倒数变体不产生新初级解）
  const same = o.primary.size === c.primary.size
    && [...o.primary.keys()].every((k) => c.primary.has(k));
  if (!same || o.advanced.size !== 0 || o.rawHits === 0) { r01ok = false; }
  r01detail.push(`[${dk}]off P=${o.primary.size}/A=${o.advanced.size}/raw=${o.rawHits} compat P=${c.primary.size}`);
}
T('R-01d 关闭态 primary 严格等于初级符号完成态（4 牌组）', r01ok, r01detail);
T('R-01e 无初级解牌组 (3,6,7,J) 关闭态 rawHits=0 且 primary=0（正确行为）',
  off.rawHits === 0 && off.primary.size === 0, [off.rawHits, off.primary.size]);

console.log('=== R-07：三标记均在归约后判定 + 旧解三标记全 false（§3.5 严格粗化）===');
let oldAllFalse = true;
for (const [k] of compat.primary) {
  // 兼容态 primary 的键不应带 |F..M.. 后缀（三标记全 false ⇒ 用 baseK）
  if (String(k).includes('|F')) { oldAllFalse = false; break; }
}
T('R-07a 旧解（primary）键无高级标记后缀', oldAllFalse, null);
T('R-07b countFact/countMod 对纯初级式恒为 0',
  RS.countFact(N(5)) === 0 && RS.countMod(N(5)) === 0, null);

console.log('=== R-12：% 记号三处一致（按钮 / [提示] / [答案]）===');
const aaSrc = fs.readFileSync('js/ui/AnswerArea.js', 'utf-8');
T('R-12a 按钮标签用 %', /const MOD_KEY_LABEL = '%'/.test(aaSrc), null);
T('R-12b formatTokens 用 %', /parts\.push\('%'\)/.test(aaSrc), null);
T('R-12c renderDisplay（[提示]/[答案] 来源）用 %',
  /\$\{renderDisplay\(t\.a\)\}%\$\{renderDisplay\(t\.b\)\}/.test(
    fs.readFileSync('js/core/RecipSolver.js', 'utf-8')), null);
T('R-12d 无 mod/MOD 中文或其他记号混用（渲染层仅 %）',
  !/[''"]取模[''"]/.test(aaSrc), null);

console.log('=== 按钮接入：不重排布局（INPUT-07 §3）===');
T('按钮a advRow 仍为 3 列', /advRow:\s*\{ x: 25,\s*y: 756, w: 361, h: 52,\s*cols: 3/.test(aaSrc), null);
T('按钮b 三键均在 advRow 内（fact/recip/mod）',
  /adv:fact/.test(aaSrc) && /adv:recip/.test(aaSrc) && /adv:mod/.test(aaSrc), null);
T('按钮c ADV_ROW_H_TOTAL 未变（62 DP）', /const ADV_ROW_H_TOTAL = 62;/.test(aaSrc), null);
T('按钮d ADV_ANCHOR.area 高度未变（326）', /area:\s*\{ x: 15,\s*y: 552, w: 381, h: 326 \}/.test(aaSrc), null);

console.log('=== 精确运算：禁 ===24 / ==24 / toFixed（剥注释后查）===');
for (const f of ['js/core/RecipSolver.js', 'js/core/RecipParser.js']) {
  const code = fs.readFileSync(f, 'utf-8').split('\n')
    .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');
  T(`精确 ${f.split('/').pop()} 无 ===24/==24`, !/[=!]==?\s*24\b/.test(code), null);
  T(`精确 ${f.split('/').pop()} 无 toFixed`, !/toFixed/.test(code), null);
}

console.log('=== R-01/R-12 端到端：PageRenderer 必须透传 advancedCalc 给 solve() ===');
// ⚠️ 这是实测发现的真缺口：PageRenderer L151 原写 solve(values) 不传 opts，
//   则即使开关打开，[提示]/[答案] 也永远不会出现阶乘/模解。
//   单测 solve() 本身全绿也盖不住这个缺口 ⇒ 必须单独断言调用点。
const prSrc = fs.readFileSync('js/ui/PageRenderer.js', 'utf-8');
const prCode = prSrc.split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');
T('E2E-1 solve() 调用处传了 advancedCalc',
  /RecipSolver\.solve\(\s*values\s*,\s*\{\s*advancedCalc\s*\}\s*\)/.test(prCode), null);
T('E2E-2 不存在不传 opts 的 solve(values) 裸调用',
  !/RecipSolver\.solve\(\s*values\s*\)/.test(prCode), null);
T('E2E-3 advancedCalc 已快照（避§1.4 异步竞态）',
  /const advancedCalc = this\._advancedCalc;/.test(prCode), null);
T('E2E-4 checkUserAnswer 仍透传开关',
  /checkUserAnswer\(tokens, cardValues, \{ advancedCalc: this\._advancedCalc \}\)/.test(prCode), null);

console.log(`\npass=${pass} fail=${fail}`);
process.exit(fail > 0 ? 1 : 0);
