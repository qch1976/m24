import {solveDeck,leafVariants,dfs,sortSolutions,numLeaf,recipLeaf,F,is24} from './lib-input06-recip.mjs';
// ---- A. R-04.2 浮点漏解率 ----
console.log('=== A. R-04.2 浮点严格判等漏解率（回归哨兵）===');
console.log('deck        | Fraction 总解 | Float 严格 ===24 | 漏解 | 漏解率');
for(const d of [[3,3,8,8],[13,12,11,9],[1,4,6,8],[1,2,3,4],[2,3,4,6],[1,5,5,5]]){
 const exact=solveDeck(d);
 const fl=solveDeck(d,{useFloat:true});
 const te=exact.primary.size+exact.advanced.size, tf=fl.primary.size+fl.advanced.size;
 const lost=te-tf;
 console.log(`[${d.join(',')}]`.padEnd(12)+`| ${String(te).padStart(4)}          | ${String(tf).padStart(4)}             | ${String(lost).padStart(3)}  | ${(lost/te*100).toFixed(1)}%`);}
// ---- B. R-05 性能 ----
console.log('\n=== B. R-05 性能 benchmark（Node 侧，Architect 可行性论证用）===');
let seed=20260803; const rnd=()=>{seed=(seed*1103515245+12345)&0x7fffffff;return seed/0x7fffffff;};
const POOL=[]; for(let v=1;v<=13;v++)for(let s=0;s<4;s++)POOL.push(v); POOL.push(0,0);
function sample(n){const out=[];for(let t=0;t<n;t++){const p=POOL.slice();
 for(let i=p.length-1;i>0;i--){const j=Math.floor(rnd()*(i+1));[p[i],p[j]]=[p[j],p[i]];}out.push(p.slice(0,4).sort((a,b)=>a-b));}return out;}
const decks=sample(50);
const times=[]; let worstDeck=null,worstMs=-1, sumRaw=0;
for(const d of decks){const t0=process.hrtime.bigint(); const R=solveDeck(d); const ms=Number(process.hrtime.bigint()-t0)/1e6;
 times.push(ms); sumRaw+=R.rawHits; if(ms>worstMs){worstMs=ms;worstDeck=d;}}
times.sort((a,b)=>a-b);
const pct=q=>times[Math.min(times.length-1,Math.floor(q*times.length))];
console.log(`随机 50 组：min=${times[0].toFixed(1)}ms  P50=${pct(.5).toFixed(1)}ms  P95=${pct(.95).toFixed(1)}ms  max=${worstMs.toFixed(1)}ms  worst=[${worstDeck}]`);
console.log(`平均原始命中(未去重)=${(sumRaw/50).toFixed(0)} 条/组`);
// 最坏牌组穷举扫描
console.log('\n最坏用例定向扫描（全 1~13 四元组中挑高倒数密度组）：');
for(const d of [[1,2,3,4],[1,1,2,2],[2,2,3,3],[1,2,2,4],[2,3,4,6],[1,1,3,8],[3,3,8,8],[1,2,5,10],[2,2,2,2],[12,12,13,13]]){
 const t0=process.hrtime.bigint(); const R=solveDeck(d); const ms=Number(process.hrtime.bigint()-t0)/1e6;
 console.log(`  [${d.join(',')}]`.padEnd(16)+`${ms.toFixed(1)}ms  pri=${R.primary.size} adv=${R.advanced.size} cxl=${R.cancelled.size} raw=${R.rawHits}`);}
// 全 1820 组（54选4 的点数组合空间 = C(13+1,..)) 用 0~13 多重组合枚举
console.log('\n全点数组合空间扫描（0..13 可重复四元组，共 C(17,4)=2380 组）：');
const all=[]; for(let a=0;a<=13;a++)for(let b=a;b<=13;b++)for(let c=b;c<=13;c++)for(let e=c;e<=13;e++)all.push([a,b,c,e]);
const T=[]; let mx=-1,mxd=null; const t0=Date.now();
for(const d of all){const s=process.hrtime.bigint();solveDeck(d);const ms=Number(process.hrtime.bigint()-s)/1e6;T.push(ms);if(ms>mx){mx=ms;mxd=d;}}
T.sort((a,b)=>a-b);
const p=q=>T[Math.min(T.length-1,Math.floor(q*T.length))];
console.log(`共 ${all.length} 组，总耗时 ${(Date.now()-t0)/1000}s`);
console.log(`P50=${p(.5).toFixed(1)}ms  P95=${p(.95).toFixed(1)}ms  P99=${p(.99).toFixed(1)}ms  MAX=${mx.toFixed(1)}ms  worst=[${mxd}]`);
