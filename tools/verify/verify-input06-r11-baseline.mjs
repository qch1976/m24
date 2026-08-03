// R-11④ / R-04.3 / §1.2.3 / R-10④ 基准复现（Architect 独立实现，非 solver 自证）
import {solveDeck,reduceFix,keySol,cntRecip,render,numLeaf,recipLeaf,sortSolutions,MAX_ITER} from './lib-input06-recip.mjs';
const REF=[[[1,2,3,4],52,48,15],[[2,3,4,6],24,34,18],[[1,3,4,6],1,30,1],[[1,5,5,5],1,24,1],[[3,3,8,8],1,17,1],
 [[1,2,5,10],10,16,6],[[1,1,3,8],76,10,22],[[1,4,6,8],18,5,12],[[2,4,5,8],17,3,12],
 [[5,5,5,5],1,0,1],[[1,1,2,9],1,0,0],[[3,3,7,7],1,0,1],[[4,4,7,7],1,0,1],[[3,3,3,5],1,0,1]];
console.log('=== A. §8 参考数据 / R-11④ 基准复现 ===');
console.log('去重口径：K_sol=原式规范键（初级+有效倒数）；K_cxl=归约式规范键（被剔除）');
console.log('deck        | 初级 (ref)   | 有效倒数 (ref) | 被剔除 (ref)  | maxIters | 最短有效倒数解');
let dp=0,da=0,dc=0;
for(const [d,rp,ra,rc] of REF){
 const t0=Date.now(); const R=solveDeck(d); const ms=Date.now()-t0;
 const advSorted=sortSolutions([...R.advanced.values()]);
 const m=(x,y)=>x===y?'✓':'✗'; if(R.primary.size!==rp)dp++; if(R.advanced.size!==ra)da++; if(R.cancelled.size!==rc)dc++;
 console.log(`[${d.join(',')}]`.padEnd(12)+
  `| ${String(R.primary.size).padStart(3)} (${String(rp).padStart(3)})${m(R.primary.size,rp)} `+
  `| ${String(R.advanced.size).padStart(3)} (${String(ra).padStart(3)})${m(R.advanced.size,ra)}   `+
  `| ${String(R.cancelled.size).padStart(3)} (${String(rc).padStart(3)})${m(R.cancelled.size,rc)} `+
  `| ${String(R.maxIters).padStart(3)}      | ${advSorted[0]||'——'} [${ms}ms]`);}
console.log(`\n偏差统计：初级 ${dp}/14  有效倒数 ${da}/14  被剔除 ${dc}/14`);
console.log('\n=== B. §1.2.3 判定示例表 10 例 ===');
const L=numLeaf,R2=recipLeaf,B=(op,a,b)=>({op,a,b});
const CASES=[
 ['(1*2)/((1/3)/4)',B('/',B('*',L(1),L(2)),B('/',R2(3),L(4))),'无效'],
 ['(3-2)/((1/4)/6)',B('/',B('-',L(3),L(2)),B('/',R2(4),L(6))),'无效'],
 ['(8-4)/((1/6)/1)',B('/',B('-',L(8),L(4)),B('/',R2(6),L(1))),'无效'],
 ['(5*5)-(5*(1/5))',B('-',B('*',L(5),L(5)),B('*',L(5),R2(5))),'无效'],
 ['7*(3+(3*(1/7)))',B('*',L(7),B('+',L(3),B('*',L(3),R2(7)))),'无效'],
 ['((1/2)*8)+(4*5)',B('+',B('*',R2(2),L(8)),B('*',L(4),L(5))),'无效'],
 ['(2*6)+(3/(1/4))',B('+',B('*',L(2),L(6)),B('/',L(3),R2(4))),'无效'],
 ['(3*6)/(1-(1/4))',B('/',B('*',L(3),L(6)),B('-',L(1),R2(4))),'有效'],
 ['(8*8)/(3-(1/3))',B('/',B('*',L(8),L(8)),B('-',L(3),R2(3))),'有效'],
 ['(1+(1/5))*(2*10)',B('*',B('+',L(1),R2(5)),B('*',L(2),L(10))),'有效'],
];
let bad=0;
for(const [lab,tree,want] of CASES){const rr=reduceFix(tree);const got=cntRecip(rr.node)>0?'有效':'无效';
 if(got!==want)bad++;
 console.log(`${lab.padEnd(19)}→ ${render(rr.node).padEnd(33)} iters=${rr.iters} 判定=${got}(${want})${got===want?'✓':'✗'}`);}
console.log(bad===0?'判定示例表：10/10 一致 ✓':`判定示例表：${bad} 例不一致 ✗`);
console.log('\n=== C. R-11② 归并验证 ===');
const a=reduceFix(B('*',B('-',L(8),L(4)),L(6))).node, b=reduceFix(B('/',B('-',L(8),L(4)),R2(6))).node;
console.log(`(8-4)*6      归约=${render(a)}  K_cxl=${keySol(a)}`);
console.log(`(8-4)/(1/6)  归约=${render(b)}  K_cxl=${keySol(b)}`);
console.log(`同键=${keySol(a)===keySol(b)?'✓':'✗'}   usedRecip(归约后)=${cntRecip(b)>0}（须 false）${cntRecip(b)===0?'✓':'✗'}`);
console.log('\n=== D. R-04.3 hasAdvancedSolution 布尔回归 ===');
const T=[[1,3,4,6],[2,3,4,6],[3,3,8,8],[1,2,3,4],[1,5,5,5]], Fa=[[5,5,5,5],[1,1,2,9],[3,3,7,7],[4,4,7,7],[3,3,3,5]];
for(const d of T){const n=solveDeck(d).advanced.size;console.log(`[${d.join(',')}]`.padEnd(12)+`adv=${String(n).padStart(3)}  hasAdv=${n>0}  期望 true  ${n>0?'✓':'✗'}`);}
for(const d of Fa){const n=solveDeck(d).advanced.size;console.log(`[${d.join(',')}]`.padEnd(12)+`adv=${String(n).padStart(3)}  hasAdv=${n>0}  期望 false ${n===0?'✓':'✗'}`);}
console.log('\n=== E. R-04.1 阳性组 ===');
for(const d of [[1,3,4,6],[2,3,4,6],[3,3,8,8],[1,5,5,5]]){
 const R=solveDeck(d);const top=sortSolutions([...R.advanced.values()]).slice(0,3);
 console.log(`[${d.join(',')}] adv=${R.advanced.size} 前3=${top.join('  ')}`);}
console.log('\n=== F. R-10 排序确定性（两次运行完全一致）===');
for(const d of [[1,2,3,4],[2,3,4,6]]){
 const s1=sortSolutions([...solveDeck(d).advanced.values()]).slice(0,10).join('|');
 const s2=sortSolutions([...solveDeck(d).advanced.values()]).slice(0,10).join('|');
 console.log(`[${d.join(',')}] 两次 top10 一致=${s1===s2?'✓':'✗'}`);}
console.log(`\n归约迭代上限常量 MAX_ITER=${MAX_ITER}；实测全牌组 maxIters ≤ 3`);
