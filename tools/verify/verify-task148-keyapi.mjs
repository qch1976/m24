import * as RS from '../../js/core/RecipSolver.mjs';
let pass=0, fail=0; const T=(n,c)=>{ if(c){pass++;console.log('✓ '+n);} else {fail++;console.log('✗ '+n);} };
const ALL={recip:true,fact:true,mod:true,pow:true,log:true};
const findAst=(cards,frag)=>{ const r=RS.solve(cards,{advancedCalc:true,caps:ALL});
  for(const[disp,node]of r.advancedNodes){ if(RS.keyWithFlags(node).includes(frag)) return {r,node}; } return {r,node:null}; };

console.log('=== 门禁5：两例须 has()===true（禁 startsWith）===');
for(const[cards,want]of [[[3,3,8,8],'(/ (* n8 n8) (- n3 r3))|R1F0M0P0L0'],[[1,3,4,6],'(/ (* n3 n6) (- n1 r4))|R1F0M0P0L0']]){
  const {r,node}=findAst(cards,want);
  T(`[${cards}] 找到 AST`, !!node);
  if(node){ const k=RS.keyWithFlags(node);
    T(`[${cards}] keyWithFlags 完全等于期望值  得=${k}`, k===want);
    T(`[${cards}] res.advanced.has(keyWithFlags(ast))===true`, r.advanced.has(k)===true);
  }
}
console.log('=== 门禁6：关闭态必产【无后缀】键（R-01 命门）===');
const off=RS.solve([1,2,3,4],{advancedCalc:false});
let offAll=true,offN=0;
for(const[,node]of (off.advancedNodes||new Map())){ if(RS.keyWithFlags(node).includes('|')) offAll=false; offN++; }
const offPri=[...off.primary.keys()];
T(`关闭态 primary 键全无 "|"（${offPri.length} 键）`, offPri.every(k=>!k.includes('|')));
T('关闭态无恒拼 |R0F0M0P0L0 字面量', !offPri.some(k=>k.includes('R0F0M0P0L0')));
console.log('=== 全仓一致性：keyWithFlags 须命中 res.advanced 全部键 ===');
let tot=0,hit=0;
for(const cards of [[3,3,8,8],[1,3,4,6],[1,2,3,4],[0,0,2,12],[1,5,5,5],[5,8,11,12]]){
  const r=RS.solve(cards,{advancedCalc:true,caps:ALL});
  for(const[disp,node]of r.advancedNodes){ tot++; if(r.advanced.has(RS.keyWithFlags(node))) hit++; }
}
T(`6 组共 ${tot} 条 advanced 解，keyWithFlags 命中 ${hit}/${tot}`, tot>0 && hit===tot);
// 🔴 task-148 复核修正（经理 2026-08-16 10:01 指出）：原版【有断言但 rc 恒 0】
//   ⇒ 判红了却告诉 CI「成功」（实测：FAIL=2 依然 rc=0）。同 task-142 ① 类缺陷。
//   修法：① 尾部置 process.exitCode；② 补 EXPECTED_ASSERTION_COUNT 分族自断言，
//   防断言静默退场（early-return / 抛异常少跑断言也必需非 0）。
// 🔴 分族算式写在**代码层**（非裸数字配注释）：某族增减时算式强迫改对应项，
//   裸数字只会被改成 10 而不知多出的那条归哪族（注释不参与求值，漂移时不报错）。
const EXP_GATE5 = 6;   // 门禁⑥：2 例 ×（找到 AST + 键完全相等 + has()===true）
const EXP_GATE6 = 2;   // 门禁⑦：关闭态无 "|" + 无恒拼 R0F0M0P0L0
const EXP_XCHECK = 1;  // 全量一致性：keyWithFlags 全命中
const EXPECTED_ASSERTION_COUNT = EXP_GATE5 + EXP_GATE6 + EXP_XCHECK;
console.log(`\n断言总数校对 pass+fail=${pass + fail}`);
const totalOk = (pass + fail) === EXPECTED_ASSERTION_COUNT;
if (!totalOk) {
  console.log(`✗ 条款8 断言总数不符：得 ${pass + fail} ≠ 期望 ${EXPECTED_ASSERTION_COUNT}`
    + `（=${EXP_GATE5}+${EXP_GATE6}+${EXP_XCHECK}）⇒ 可能有断言静默退场`);
} else {
  console.log(`✓ 条款8 断言总数校对：${pass + fail} == 期望 ${EXPECTED_ASSERTION_COUNT}`);
}
// 🔴 判红时禁显示 `FAIL=0` —— 人读日志会当成零失败（本项目已因此错过一轮，task-143）。
//   总数不符且 fail=0 时，必携 COUNT_MISMATCH 标记。
const verdict = (fail === 0 && totalOk)
  ? 'RESULT: ALL PASS'
  : `RESULT: FAIL=${fail}${totalOk ? '' : ' COUNT_MISMATCH'}`;
console.log(verdict);
// 🔴 rc 通道：0=全绿；1=有断言失败；2=断言总数不符（与 run-gate.sh 自述的码义同口径）
process.exitCode = !totalOk ? 2 : (fail === 0 ? 0 : 1);
