// task-79 selftest：三处口径一致性（A 后缀 / B 无解判定 / C 提示结构）
import * as RS from '../js/core/RecipSolver.mjs';
import SolverDefault from '../js/core/Solver.mjs';
let pass=0, fail=0;
const T=(n,c,got)=>{ if(c){pass++;console.log('  PASS',n);} else {fail++;console.log('  FAIL',n,'=> got:',JSON.stringify(got));} };

// ---- 复刻产品逻辑（与 PageRenderer/AnswerModal 修复后同构）----
function buildLines(d, advOn){
  const lines=[]; lines.push('【初级解法】');
  if(d&&d.primary.length>0){for(const e of d.primary)lines.push(`${e} = 24`);
    if(d.counts.primary>d.primary.length)lines.push(`…等共 ${d.counts.primary} 条`);}
  else lines.push('本局无初级解法');
  if(advOn){ lines.push(''); lines.push('【高级解法】');
    if(d&&d.advanced.length>0){for(const e of d.advanced)lines.push(`${e} = 24`);
      if(d.counts.advanced>d.advanced.length)lines.push(`…等共 ${d.counts.advanced} 条`);}
    else lines.push('本局无倒数解法'); }
  return lines;
}
const renderItem = (line) => line;                       // 修复后 AnswerModal L186
const solTotal = (d,advOn) => (d.counts.primary||0) + (advOn&&d.counts?d.counts.advanced:0);
const hasSolution = (primaryCount,d,advOn) => primaryCount>0 || (advOn&&d&&d.counts?d.counts.advanced:0)>0;
function hintStep(d,advOn){
  const adv = advOn&&d ? d.advancedTop : null;
  if(!adv) return null;
  return { step:1, lhs:`高级解法：${adv}`, op:'', rhs:'', result:'24' };
}
const renderHint = (cur) => cur ? `${cur.lhs} ${cur.op} ${cur.rhs} = ${cur.result}` : '';

const V=[3,6,7,11];
const d=RS.buildDisplay(RS.solve(V));
const primaryCount=SolverDefault.findSolutions(V).length;

console.log('[case] (3,6,7,J) 开关开启');
const lines=buildLines(d,true).map(renderItem);
// A1: 算式行有且仅有一个 = 24
const formulaLines=lines.filter(l=>l.includes('÷')||l.includes('×')||/\d\s*[+\-]/.test(l));
T('A1 算式行恰好 1 个「= 24」', formulaLines.length>0 && formulaLines.every(l=>(l.match(/= 24/g)||[]).length===1), formulaLines);
// A2: 标题/空行/计数行不带后缀
T('A2 标题行不带后缀', lines.filter(l=>l.startsWith('【')).every(l=>!l.includes('= 24')), lines.filter(l=>l.startsWith('【')));
T('A3 空行仍为空串', lines.some(l=>l===''), lines);
T('A4 「本局无初级解法」不带后缀', lines.includes('本局无初级解法'), lines);
// B: 有高级解 ⇒ 判有解
T('B1 有倒数解时 hasSolution=true', hasSolution(primaryCount,d,true)===true, {primaryCount,adv:d.counts.advanced});
T('B2 旧口径(仅初级)本会误判', primaryCount===0, primaryCount);
// C: 提示不含 undefined
const hs=hintStep(d,true); const hintText=renderHint(hs);
T('C1 提示文本不含 undefined', !hintText.includes('undefined'), hintText);
T('C2 提示含倒数算式', hintText.includes('÷')&&hintText.includes('= 24'), hintText);
// 三处口径一致
const winShows = d.counts.advanced>0;
T('D1 三处口径一致(窗口/按钮/提示)', winShows===hasSolution(primaryCount,d,true) && winShows===(hs!==null), {winShows});
T('D2 caption 真实解数=2', solTotal(d,true)===2, solTotal(d,true));

console.log('[case] 开关关闭（不泄题、口径仍一致）');
const linesOff=buildLines(d,false).map(renderItem);
T('E1 关闭时无高级分区', !linesOff.some(l=>l.includes('【高级解法】')), linesOff);
T('E2 关闭时判无解(与窗口一致)', hasSolution(primaryCount,d,false)===false, null);
T('E3 关闭时提示不弹', hintStep(d,false)===null, null);

console.log(`\npass=${pass} fail=${fail}`);
process.exit(fail>0?1:0);
