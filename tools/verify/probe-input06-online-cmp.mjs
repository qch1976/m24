// 人工阅读型调查脚本，非门禁。退出码恒为 0，即使正文打印 ❌ 也不判红；判定权在阅读者。
// （task-75 哑弹治理：本批 probe-* 均无非零退出能力，❌/FAIL 全在 console.log 内。）
// 外部判据：新口径初级解数 vs INPUT-05 线上已验收 solver（完全独立实现）
import * as ON from '../../js/core/Solver.mjs';
import {solveDeck} from './lib-input06-dedup.mjs';
const D=[[1,2,3,4],[2,3,4,6],[1,3,4,6],[1,5,5,5],[3,3,8,8],[1,2,5,10],[1,1,3,8],[1,4,6,8],[2,4,5,8],[5,5,5,5],[1,1,2,9],[3,3,7,7],[4,4,7,7],[3,3,3,5]];
console.log('新口径 primary vs INPUT-05 线上 solver（独立实现，不共享代码）');
console.log('deck          | 线上solver | v5 primary | 一致?');
let ok=0,bad=0,det=[];
for(const d of D){
 let on='ERR'; try{on=ON.findSolutionsWithAST(d).length;}catch(e){on='ERR:'+e.message;}
 const v5=solveDeck(d).primary.size;
 const same=(on===v5); same?ok++:bad++;
 if(!same)det.push({d:d.join(','),on,v5});
 console.log(`[${d.join(',')}]`.padEnd(14)+`|    ${String(on).padStart(4)}    |    ${String(v5).padStart(4)}    | ${same?'✅':'❌'}`);
}
console.log(`\n一致 ${ok}/${D.length}`);
if(det.length){console.log('差异明细:');det.forEach(x=>console.log(`  [${x.d}] 线上=${x.on} v5=${x.v5}`));}
