// R-04.2 精确运算哨兵：浮点严格判等 vs Fraction 的漏解率（新口径）
import {solveDeck,leafVariants,dfs,reduceFix,keySol,cntRecip,render,is24,add,sub,mul,div} from './lib-input06-dedup.mjs';
// 浮点版枚举：用 ===24 严格判等（模拟错误实现）
function solveFloat(cards){
 const P=new Map(),A=new Map();
 const OPS=['+','-','*','/'];
 const rec=(items)=>{
  if(items.length===1){ if(items[0].fv===24){ const rr=reduceFix(items[0].t);
    (cntRecip(rr.node)>0?A:P).set(keySol(rr.node),1);} return; }
  for(let i=0;i<items.length;i++)for(let j=0;j<items.length;j++){
   if(i===j)continue;
   const op0=items[i],op1=items[j];
   for(const op of OPS){
    if((op==='+'||op==='*')&&i>j)continue;
    let fv; if(op==='+')fv=op0.fv+op1.fv; else if(op==='-')fv=op0.fv-op1.fv;
    else if(op==='*')fv=op0.fv*op1.fv; else {if(op1.fv===0)continue; fv=op0.fv/op1.fv;}
    const rest=items.filter((_,k)=>k!==i&&k!==j);
    rec([...rest,{t:{op,a:op0.t,b:op1.t},fv}]);
   }}};
 for(const lv of leafVariants(cards)) rec(lv.map(t=>({t,fv:Number(t.v.n)/Number(t.v.d)})));
 return {p:P.size,a:A.size};
}
const S=[[3,3,8,8],[13,12,11,9],[1,4,6,8],[1,5,5,5],[2,3,4,6],[1,2,3,4],[3,3,7,7],[4,4,7,7]];
console.log('R-04.2 哨兵：浮点 ===24 严格判等的漏解率（新口径）');
console.log('deck            | Fraction pri/adv | 浮点 pri/adv | 漏解 | 漏解率');
const rows=[];
for(const d of S){
 const F=solveDeck(d), G=solveFloat(d);
 const ft=F.primary.size+F.advanced.size, gt=G.p+G.a;
 const miss=ft-gt, rate=ft?(miss/ft*100):0;
 rows.push({deck:d.join(','),fp:F.primary.size,fa:F.advanced.size,gp:G.p,ga:G.a,miss,rate:rate.toFixed(1)});
 console.log(`[${d.join(',')}]`.padEnd(16)+`|      ${String(F.primary.size).padStart(3)}/${String(F.advanced.size).padStart(3)}     |   ${String(G.p).padStart(3)}/${String(G.a).padStart(3)}    | ${String(miss).padStart(4)} | ${rate.toFixed(1)}%`);
}
import {writeFileSync} from 'fs';
writeFileSync('./out-bench-sentinel.json',JSON.stringify(rows,null,1));
console.log('\n★ 漏解率最高者最适合作哨兵');
console.log('★ 注：本表用 fv===24 模拟错误实现，仅为对照；lib-v5 生产路径全程 BigInt Fraction');
