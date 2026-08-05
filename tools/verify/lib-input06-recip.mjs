// 本文件是被其他脚本 import 的【库】，不是门禁脚本；单独运行无输出、无退出码意义。
// 判红能力在调用它的门禁脚本里，勿据本文件退出码做任何结论。
// INPUT-06 Architect 参考实现（供 verify 脚本共用）
// 叶子倒数枚举 + §1.2.3 乘除链归约 + Fraction(BigInt) 精确判等 + 三层去重键
export const bg=(a,b)=>{while(b){const t=a%b;a=b;b=t;}return a;};
export const F=(n,d=1n)=>{n=BigInt(n);d=BigInt(d);if(d===0n)return null;if(d<0n){n=-n;d=-d;}const g=bg(n<0n?-n:n,d)||1n;return{n:n/g,d:d/g};};
export const add=(a,b)=>F(a.n*b.d+b.n*a.d,a.d*b.d), sub=(a,b)=>F(a.n*b.d-b.n*a.d,a.d*b.d);
export const mul=(a,b)=>F(a.n*b.n,a.d*b.d), div=(a,b)=>b.n===0n?null:F(a.n*b.d,a.d*b.n);
export const is24=f=>f&&f.d!==0n&&f.n===24n*f.d;
export const numLeaf=c=>({op:'num',v:F(c),card:c});
export const recipLeaf=c=>({op:'recip',arg:numLeaf(c),v:F(1,c)});
export const cntRecip=t=>t.op==='num'?0:t.op==='recip'?1:cntRecip(t.a)+cntRecip(t.b);
export const render=t=>t.op==='num'?String(t.card):t.op==='recip'?`(1/${t.arg.card})`:`(${render(t.a)}${t.op}${render(t.b)})`;
// ---- §1.2.3 归约 ----
function flat(t,n,d){if(t.op==='*'){flat(t.a,n,d);flat(t.b,n,d);return;}if(t.op==='/'){flat(t.a,n,d);flat(t.b,d,n);return;}n.push(t);}
function rebuild(n,d){const one={op:'num',v:F(1),card:1};let a=n.length?n.reduce((x,y)=>({op:'*',a:x,b:y})):one;for(const q of d)a={op:'/',a,b:q};return a;}
export function reduceOnce(t){
 if(t.op==='num'||t.op==='recip')return{node:t,changed:false};
 if(t.op==='+'||t.op==='-'){const A=reduceOnce(t.a),B=reduceOnce(t.b);return{node:{op:t.op,a:A.node,b:B.node},changed:A.changed||B.changed};}
 const n=[],d=[];flat(t,n,d);let ch=false;const on=[],od=[];
 for(const f of n){if(f.op==='recip'){od.push(f.arg);ch=true;}else on.push(f);}
 for(const f of d){if(f.op==='recip'){on.push(f.arg);ch=true;}else od.push(f);}
 const rc=a=>a.map(f=>{if(f.op==='+'||f.op==='-'){const r=reduceOnce(f);if(r.changed)ch=true;return r.node;}return f;});
 return{node:rebuild(rc(on),rc(od)),changed:ch};}
export const MAX_ITER=30;
export function reduceFix(t){let c=t;for(let i=0;i<MAX_ITER;i++){const r=reduceOnce(c);c=r.node;if(!r.changed)return{node:c,iters:i+1};}return{node:c,iters:MAX_ITER,overflow:true};}
// ---- K_sol：规范形式键（二元交换律归一 + 全括号 => 冗余括号天然消除）----
export function keySol(t){
 if(t.op==='num')return 'n'+t.card;
 if(t.op==='recip')return 'r'+t.arg.card;
 const a=keySol(t.a),b=keySol(t.b);
 if(t.op==='+'||t.op==='*'){const[x,y]=a<=b?[a,b]:[b,a];return`(${t.op} ${x} ${y})`;}
 return`(${t.op} ${a} ${b})`;}
// ---- 枚举 ----
const OPS=['+','-','*','/'];
export function dfs(items,cb,useFloat){
 if(items.length===1){
  if(useFloat){if(items[0].fv===24)cb(items[0].t);}
  else if(is24(items[0].v))cb(items[0].t);
  return;}
 const n=items.length;
 for(let i=0;i<n;i++)for(let j=0;j<n;j++){if(i===j)continue;
  const rest=[];for(let k=0;k<n;k++)if(k!==i&&k!==j)rest.push(items[k]);
  const A=items[i],B=items[j];
  for(const op of OPS){
   if((op==='+'||op==='*')&&i>j)continue;
   let v=null,fv=0;
   if(useFloat){
    if(op==='/'&&B.fv===0)continue;
    fv=op==='+'?A.fv+B.fv:op==='-'?A.fv-B.fv:op==='*'?A.fv*B.fv:A.fv/B.fv;
   }else{
    v=op==='+'?add(A.v,B.v):op==='-'?sub(A.v,B.v):op==='*'?mul(A.v,B.v):div(A.v,B.v);
    if(v===null)continue;
   }
   dfs([{t:{op,a:A.t,b:B.t},v,fv},...rest],cb,useFloat);}}}
export function leafVariants(cards){
 const out=[];const rec=(i,acc)=>{if(i===4){out.push(acc.slice());return;}const c=cards[i];
  acc.push(numLeaf(c));rec(i+1,acc);acc.pop();
  if(c!==0&&c!==1){acc.push(recipLeaf(c));rec(i+1,acc);acc.pop();}};rec(0,[]);return out;}
// ---- 完整 solve ----
export function solveDeck(cards,{useFloat=false}={}){
 const primary=new Map(), advanced=new Map(), cancelled=new Map();
 let rawHits=0, maxIters=0;
 for(const lv of leafVariants(cards)){
  const items=lv.map(t=>({t,v:t.v,fv:Number(t.v.n)/Number(t.v.d)}));
  dfs(items,node=>{
   rawHits++;
   const rr=reduceFix(node); if(rr.iters>maxIters)maxIters=rr.iters;
   const usedRecip=cntRecip(rr.node)>0;
   const hadRecip=cntRecip(node)>0;
   if(usedRecip){const k=keySol(node); if(!advanced.has(k))advanced.set(k,render(node));}
   else if(hadRecip){const k=keySol(rr.node); if(!cancelled.has(k))cancelled.set(k,render(node));}
   else {const k=keySol(node); if(!primary.has(k))primary.set(k,render(node));}
  },useFloat);}
 return {primary,advanced,cancelled,rawHits,maxIters};}
// ---- §1.4 排序 ----
export function sortSolutions(exprs){
 const advCount=e=>(e.match(/\(1\//g)||[]).length;
 return exprs.slice().sort((a,b)=>a.length-b.length||advCount(a)-advCount(b)||(a<b?-1:a>b?1:0));}
