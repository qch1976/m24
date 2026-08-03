import {solveDeck,sortSolutions} from './lib-input06-recip.mjs';
import {writeFileSync} from 'fs';
// R-04：程序自动筛选 ≥1000 次随机发牌，产出含有效倒数解的种子池
const POOL=[];for(let v=1;v<=13;v++)for(let s=0;s<4;s++)POOL.push(v);POOL.push(0,0);
let seed=20260803; const rnd=()=>{seed=(seed*1103515245+12345)&0x7fffffff;return seed/0x7fffffff;};
const N=1000, seen=new Map(); let withAdv=0, withPri=0;
for(let t=0;t<N;t++){
 const p=POOL.slice();for(let i=p.length-1;i>0;i--){const j=Math.floor(rnd()*(i+1));[p[i],p[j]]=[p[j],p[i]];}
 const deck=p.slice(0,4).sort((a,b)=>a-b);
 const k=deck.join(',');
 if(!seen.has(k)){const R=solveDeck(deck);
  seen.set(k,{deck,primary:R.primary.size,advanced:R.advanced.size,cancelled:R.cancelled.size,
   shortestAdvanced:sortSolutions([...R.advanced.values()])[0]||null});}
 const e=seen.get(k); if(e.advanced>0)withAdv++; if(e.primary>0)withPri++;
}
const all=[...seen.values()];
const advDecks=all.filter(x=>x.advanced>0).sort((a,b)=>b.advanced-a.advanced);
const zeroAdvSolvable=all.filter(x=>x.advanced===0&&x.primary>0);
console.log(`采样 ${N} 次 → 去重牌组 ${all.length} 个`);
console.log(`含有效倒数解牌组：${advDecks.length} 个（发牌次数占比 ${(withAdv/N*100).toFixed(1)}%）`);
console.log(`有初级解但倒数解=0：${zeroAdvSolvable.length} 个`);
console.log('\nTop 12 高倒数密度种子：');
advDecks.slice(0,12).forEach(x=>console.log(`  [${x.deck.join(',')}] pri=${x.primary} adv=${x.advanced} cxl=${x.cancelled}  ${x.shortestAdvanced}`));
const out={
 _meta:{generator:'tools/verify/gen-input06-recip-seeds.mjs',samples:N,rngSeed:20260803,
  rng:'LCG(1103515245,12345,2^31-1) + Fisher-Yates on 54-card pool',
  dedupKey:'K_sol = 原式规范键（二元交换律归一 + 全括号）；被剔除计数用 K_cxl = 归约式规范键',
  reduceMaxIter:30, valueRepr:'Fraction(BigInt num/den)', generatedFor:'INPUT-06 R-04 / R-04.1 / R-11'},
 stats:{uniqueDecks:all.length,decksWithAdvanced:advDecks.length,decksZeroAdvanced:zeroAdvSolvable.length,
  dealHitRateAdvanced:+(withAdv/N).toFixed(4)},
 positiveSeeds:advDecks.slice(0,20),
 negativeSeeds:zeroAdvSolvable.slice(0,10).map(x=>({deck:x.deck,primary:x.primary,advanced:0,cancelled:x.cancelled})),
 fixedBenchmarks:[[1,2,3,4],[2,3,4,6],[1,3,4,6],[1,5,5,5],[3,3,8,8],[1,2,5,10],[1,1,3,8],[1,4,6,8],[2,4,5,8]]
  .map(d=>{const R=solveDeck(d);return{deck:d,primary:R.primary.size,advanced:R.advanced.size,cancelled:R.cancelled.size,
   shortestAdvanced:sortSolutions([...R.advanced.values()])[0]||null};}),
};
writeFileSync('input06-recip-seeds.json',JSON.stringify(out,null,2));
console.log('\n落盘 input06-recip-seeds.json');
console.log(`阳性种子 ${out.positiveSeeds.length} 组（≥6 ✓）  阴性种子 ${out.negativeSeeds.length} 组`);
