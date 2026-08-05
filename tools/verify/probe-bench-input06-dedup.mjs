// 人工阅读型调查脚本，非门禁。退出码恒为 0，即使正文打印 ❌ 也不判红；判定权在阅读者。
// （task-75 哑弹治理：本批 probe-* 均无非零退出能力，❌/FAIL 全在 console.log 内。）
import {solveDeck,sortSolutions,MAX_ITER} from './lib-input06-dedup.mjs';
const DECKS=[[1,2,3,4],[2,3,4,6],[1,3,4,6],[1,5,5,5],[3,3,8,8],[1,2,5,10],[1,1,3,8],[1,4,6,8],[2,4,5,8],[5,5,5,5],[1,1,2,9],[3,3,7,7],[4,4,7,7],[3,3,3,5]];
const OLD={'1,2,3,4':[52,48,15],'2,3,4,6':[24,34,18],'1,3,4,6':[1,30,1],'1,5,5,5':[1,24,1],'3,3,8,8':[1,17,1],'1,2,5,10':[10,16,6],'1,1,3,8':[76,10,22],'1,4,6,8':[18,5,12],'2,4,5,8':[17,3,12],'5,5,5,5':[1,0,1],'1,1,2,9':[1,0,0],'3,3,7,7':[1,0,1],'4,4,7,7':[1,0,1],'3,3,3,5':[1,0,1]};
const rows=[]; let t0=Date.now();
for(const d of DECKS){
 const k=d.join(','), s=Date.now(), R=solveDeck(d), ms=Date.now()-s;
 const shortest=R.advanced.size?sortSolutions([...R.advanced.values()])[0]:'——';
 rows.push({k,pri:R.primary.size,adv:R.advanced.size,cxl:R.cancelledRaw,raw:R.rawHits,it:R.maxIters,ov:R.overflow,ms,shortest,
            oPri:OLD[k][0],oAdv:OLD[k][1],oCxl:OLD[k][2]});
}
console.log('=== 新口径基准（裁定四项全A / lib-v5）===');
console.log('deck          | 初级 | 高级 | 可消去(raw) | rawHits | maxIter | ms  | 最短高级解');
for(const r of rows) console.log(`[${r.k}]`.padEnd(14)+`| ${String(r.pri).padStart(4)} | ${String(r.adv).padStart(4)} | ${String(r.cxl).padStart(11)} | ${String(r.raw).padStart(7)} | ${String(r.it).padStart(7)} | ${String(r.ms).padStart(3)} | ${r.shortest}`);
console.log('\n=== 差异对照（旧 §8 → 新口径）===');
console.log('deck          | 初级 旧→新      | 高级 旧→新      | 线上数字变化?');
for(const r of rows){
 const pc=r.oPri!==r.pri, ac=r.oAdv!==r.adv;
 console.log(`[${r.k}]`.padEnd(14)+`| ${String(r.oPri).padStart(3)} → ${String(r.pri).padStart(3)} ${(pc?'变':'  ').padEnd(4)}| ${String(r.oAdv).padStart(3)} → ${String(r.adv).padStart(3)} ${(ac?'变':'  ').padEnd(4)}| ${pc||ac?'★ 会变':'不变'}`);
}
const ov=rows.reduce((a,r)=>a+r.ov,0), mi=Math.max(...rows.map(r=>r.it));
console.log(`\n迭代上限 MAX_ITER=${MAX_ITER}；实测 maxIters=${mi}；overflow 次数=${ov} ${ov===0?'✅ 无溢出':'❌'}`);
console.log(`总耗时 ${Date.now()-t0}ms`);
import {writeFileSync} from 'fs';
writeFileSync('./out-bench-dedup.json',JSON.stringify(rows,null,1));
