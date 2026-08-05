// selftest_input06_parser.mjs — INPUT-06 §1.2.2 非法倒数拒绝 + 冗余括号不误伤
// R-08：parser 扩展验收
import { parse, evalAst, checkUserAnswer, ERR } from '../js/core/RecipParser.mjs';
import { is24F } from '../js/core/RecipSolver.mjs';

import { track, done } from './_diag.mjs';
let pass = 0, fail = 0; const bad = [];
const ck = track((n, c, e) => { if (c) { pass++; console.log('  ok  ' + n + (e ? '  ' + e : '')); } else { fail++; bad.push(n); console.log('  XX  ' + n + (e ? '  ' + e : '')); } });

const N = (i) => ({ type: 'number', cardIndex: i });
const O = (v) => ({ type: 'operator', value: v });
const L = { type: 'left_paren' }, R = { type: 'right_paren' }, C = { type: 'recip' };

console.log('='.repeat(70));
console.log('A. 合法倒数：冗余括号不误伤（1/(3) 1/((3)) 1/(((3))) 均须接受）');
console.log('='.repeat(70));
const cv = [1, 3, 4, 6];
const okCases = [
  ['1/3        裸叶子', [C, N(1)]],
  ['1/(3)      1 层括号', [C, L, N(1), R]],
  ['1/((3))    2 层括号', [C, L, L, N(1), R, R]],
  ['1/(((3)))  3 层括号', [C, L, L, L, N(1), R, R, R]],
  ['1/((((3)))) 4 层括号', [C, L, L, L, L, N(1), R, R, R, R]],
];
for (const [n, t] of okCases) { const r = parse(t, cv); ck(n + ' → 接受', r.ok, r.ok ? '' : 'err=' + r.error); }

console.log('\n' + '='.repeat(70));
console.log('B. 非法倒数拒绝：操作数非叶子（§1.2.2 硬约束）');
console.log('='.repeat(70));
const rejCases = [
  ['1/(1-3/4)     加减在内', [C, L, N(0), O('-'), N(1), O('/'), N(2), R], ERR.RECIP_OPERAND_NOT_LEAF],
  ['1/(3+4)       加法在内', [C, L, N(1), O('+'), N(2), R], ERR.RECIP_OPERAND_NOT_LEAF],
  ['1/(3*4)       乘法在内', [C, L, N(1), O('*'), N(2), R], ERR.RECIP_OPERAND_NOT_LEAF],
  ['1/(3/4)       除法在内', [C, L, N(1), O('/'), N(2), R], ERR.RECIP_OPERAND_NOT_LEAF],
  ['1/((6-4)/8)   嵌套运算', [C, L, L, N(3), O('-'), N(2), R, O('/'), N(2), R], ERR.RECIP_OPERAND_NOT_LEAF],
  ['1/(1/3)       倒数套倒数', [C, L, C, N(1), R], ERR.RECIP_OPERAND_NOT_LEAF],
  ['1/1/3         链式倒数', [C, C, N(1)], ERR.RECIP_OPERAND_NOT_LEAF],
  ['1/()          空括号', [C, L, R], ERR.RECIP_OPERAND_NOT_LEAF],
  ['1/            悬空结尾', [C], ERR.RECIP_DANGLING],
  ['1/*3          后跟运算符', [C, O('*'), N(1)], ERR.RECIP_DANGLING],
  ['1/+3          后跟加号', [C, O('+'), N(1)], ERR.RECIP_DANGLING],
];
for (const [n, t, expErr] of rejCases) {
  const r = parse(t, cv);
  ck(n + ' → 拒绝', !r.ok, r.ok ? 'ERROR: 被错误接受' : `err=${r.error}`);
  if (!r.ok) ck('  ' + n.split(' ')[0] + ' 错误码正确', r.error === expErr, `got=${r.error} want=${expErr}`);
}
ck(`非法用例共 ${rejCases.length} 条 = 7 条无效判定要求已覆盖`, rejCases.length >= 7);

console.log('\n' + '='.repeat(70));
console.log('C. 括号不匹配 vs 倒数错误 区分（错误码不得混淆）');
console.log('='.repeat(70));
ck('(3+4 缺右括号 → paren_mismatch', parse([L, N(1), O('+'), N(2)], cv).error === ERR.PAREN_MISMATCH,
   'got=' + parse([L, N(1), O('+'), N(2)], cv).error);
ck('3+4) 多右括号 → paren_mismatch', parse([N(1), O('+'), N(2), R], cv).error === ERR.PAREN_MISMATCH,
   'got=' + parse([N(1), O('+'), N(2), R], cv).error);
ck('空 token → empty', parse([], cv).error === ERR.EMPTY);

console.log('\n' + '='.repeat(70));
console.log('D. 完整答题判定（4 牌各一次 + 精确 24 + usedRecip）');
console.log('='.repeat(70));
// cv=[1,3,4,6]  (3*6)/(1-(1/4)) = 18/(3/4) = 24 —— 有效倒数解
const cvD = [1, 3, 4, 6];
const solA = [L, N(1), O('*'), N(3), R, O('/'), L, N(0), O('-'), L, C, N(2), R, R];
const rA = checkUserAnswer(solA, cvD, { advancedCalc: true });
ck('(3*6)/(1-(1/4)) pass=true', rA.pass === true, JSON.stringify({ pass: rA.pass, usedRecip: rA.usedRecip, reason: rA.reason }));
ck('  usedRecip=true（有效倒数解）', rA.usedRecip === true);
// 少用一张牌 → card_reused / 未用满
const rB = checkUserAnswer([N(0), O('+'), N(1)], cvD, { advancedCalc: true });
ck('只用 2 张牌 → 拒绝', rB.pass === false && rB.reason === ERR.CARD_REUSED, 'reason=' + rB.reason);
// 重复用同一张牌
const rC = checkUserAnswer([N(0), O('+'), N(0), O('+'), N(1), O('+'), N(2)], cvD, { advancedCalc: true });
ck('重复用牌 → 拒绝', rC.pass === false, 'reason=' + rC.reason);
// 开关关闭时含 recip → 拒绝
const rD = checkUserAnswer(solA, cvD, { advancedCalc: false });
ck('advancedCalc=false 含 1/x → 拒绝', rD.pass === false, 'msg=' + rD.message);
// 开关关闭时纯初级解仍可提交（INPUT-05 回归）
const cvE = [1, 2, 3, 4];  // (1+3)*(2*4)? = 32 ; 用 (1+2+3)*4=24
const solE = [L, N(0), O('+'), N(1), O('+'), N(2), R, O('*'), N(3)];
const rE = checkUserAnswer(solE, cvE, { advancedCalc: false });
ck('advancedCalc=false 初级解 (1+2+3)*4=24 通过', rE.pass === true, JSON.stringify({ pass: rE.pass, reason: rE.reason }));
ck('  初级解 usedRecip=false', rE.usedRecip === false);
// 不等于 24
const rF = checkUserAnswer([N(0), O('+'), N(1), O('+'), N(2), O('+'), N(3)], cvE, { advancedCalc: true });
ck('1+2+3+4=10 → not_24 且给出 actualLabel', rF.pass === false && rF.reason === 'not_24' && rF.actualLabel === '10', 'label=' + rF.actualLabel);
// 分数结果 label
const cvG = [1, 1, 1, 3];
const rG = checkUserAnswer([N(0), O('/'), N(3), O('+'), N(1), O('+'), N(2)], cvG, { advancedCalc: true });
ck('1/3+1+1 → 分数 label 7/3', rG.pass === false && rG.actualLabel === '7/3', 'label=' + rG.actualLabel);
// 除零
const cvH = [0, 1, 2, 3];
const rH = checkUserAnswer([N(1), O('/'), N(0), O('+'), N(2), O('+'), N(3)], cvH, { advancedCalc: true });
ck('除零 → division_by_zero', rH.reason === ERR.DIVISION_BY_ZERO, 'reason=' + rH.reason);
// 1/0 倒数（0 牌不应能取倒数；parser 层接受但 eval 报除零）
const rI = checkUserAnswer([C, N(0), O('+'), N(1), O('+'), N(2), O('+'), N(3)], cvH, { advancedCalc: true });
ck('1/0 (大王) → division_by_zero', rI.reason === ERR.DIVISION_BY_ZERO, 'reason=' + rI.reason);

console.log('\n' + '='.repeat(70));
console.log('E. 1/1 恒等不计为高级符号（R-04.1 / §4.7）');
console.log('='.repeat(70));
const cvJ = [1, 2, 3, 4];
// (1/1 + 2) * 3 * 4 = 36 ≠24；用 (1/1+3)*(2*4)? = 32。取 1/1*(2*3*4)=24
const solJ = [C, N(0), O('*'), N(1), O('*'), N(2), O('*'), N(3)];
const rJ = checkUserAnswer(solJ, cvJ, { advancedCalc: true });
ck('(1/1)*2*3*4=24 pass', rJ.pass === true, 'pass=' + rJ.pass);
ck('  1/1 不计入 usedRecip（恒等）', rJ.usedRecip === false, 'usedRecip=' + rJ.usedRecip);

console.log('\n' + '='.repeat(70));
console.log(`RESULT: pass=${pass} fail=${fail}`);
if (fail > 0) { console.log('FAILED: ' + bad.join(' | ')); process.exit(1); }
console.log('ALL PASS'); console.log('='.repeat(70)); done(pass, fail);
process.exit(0);
