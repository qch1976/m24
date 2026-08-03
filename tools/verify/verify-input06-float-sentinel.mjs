// R-04.2 哨兵漏解率口径复核：INPUT-06.md 称 [3,3,8,8]/[13,12,11,9]/[1,4,6,8] 漏 60.0%/21.6%/8.3%
import {solveDeck} from './lib-input06-recip.mjs';
console.log('口径 A：仅初级解（无倒数枚举，等价 INPUT-05 基线）');
console.log('口径 B：初级+有效倒数（本迭代全集）');
console.log('deck        | A精确 A浮点 A漏% | B精确 B浮点 B漏% | adv精确 adv浮点 adv漏%');
for(const d of [[3,3,8,8],[13,12,11,9],[1,4,6,8],[1,2,3,4],[2,3,4,6],[1,5,5,5],[1,1,3,8],[2,4,5,8],[1,2,5,10],[1,3,4,6]]){
 const e=solveDeck(d), f=solveDeck(d,{useFloat:true});
 const ap=e.primary.size, af=f.primary.size;
 const bp=e.primary.size+e.advanced.size, bf=f.primary.size+f.advanced.size;
 const dp=e.advanced.size, df=f.advanced.size;
 const pc=(x,y)=>y===0?'  n/a':`${((y-x)/y*100).toFixed(1)}%`;
 console.log(`[${d.join(',')}]`.padEnd(12)+
  `| ${String(ap).padStart(4)} ${String(af).padStart(5)} ${pc(af,ap).padStart(6)} `+
  `| ${String(bp).padStart(4)} ${String(bf).padStart(5)} ${pc(bf,bp).padStart(6)} `+
  `| ${String(dp).padStart(5)} ${String(df).padStart(7)} ${pc(df,dp).padStart(7)}`);}
