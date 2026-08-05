// task-80 selftest：负负得正等价 + ±0 等价 去重（含误删防护）
import * as RS from '../js/core/RecipSolver.mjs';
const N=(c)=>RS.numLeaf(c,0), R=(c)=>RS.recipLeaf(c,0), B=(op,a,b)=>({op,a,b});
const K=(a)=>RS.keySol(RS.reduceToFixpoint(a).node);
let pass=0, fail=0;
const T=(n,c,got)=>{ if(c){pass++;console.log('  PASS',n);} else {fail++;console.log('  FAIL',n,'=> got:',JSON.stringify(got));} };

console.log('[1] 反例1 负负得正：(6-8)/(1/12-1/6) <=> (8-6)/(1/6-1/12)');
const a1=B('/',B('-',N(6),N(8)),B('-',R(12),R(6)));
const b1=B('/',B('-',N(8),N(6)),B('-',R(6),R(12)));
T('1.1 两式都=24', RS.is24F(RS.evalNode(a1))&&RS.is24F(RS.evalNode(b1)), null);
T('1.2 两式 keySol 相同', K(a1)===K(b1), [K(a1),K(b1)]);
const r1=RS.solve([6,6,8,12]);
T('1.3 (6,6,8,Q) advanced 不含重复对', r1.advanced.size===3, r1.advanced.size);

console.log('[2] (3,6,7,J) 现场：2 条应收敛为 1');
const r2=RS.solve([3,6,7,11]);
T('2.1 advanced === 1', r2.advanced.size===1, r2.advanced.size);
T('2.2 primary 仍为 0（未误升级）', r2.primary.size===0, r2.primary.size);

console.log('[3] 反例2 ±0 等价');
const p0=B('+',B('+',N(12),N(12)),N(0));
const m0=B('-',B('+',N(12),N(12)),N(0));
const f0=B('+',N(0),B('+',N(12),N(12)));
T('3.1 +0 与 -0 同键', K(p0)===K(m0), [K(p0),K(m0)]);
T('3.2 0 位置无关', K(p0)===K(f0), [K(p0),K(f0)]);
// 边界：求值为 0 的整个子树也是加法恒等元
const z1=B('+',B('+',N(12),N(12)),B('*',N(0),N(2)));
const z2=B('-',B('+',N(12),N(12)),B('*',N(0),N(2)));
T('3.3 边界 ±(0*b) 也归并', K(z1)===K(z2), [K(z1),K(z2)]);

console.log('[4] ⚠️ 误删防护（最高优先级）');
const mul0=B('*',N(12),N(0)), add0=B('+',N(12),N(0));
T('4.1 12*0 与 12+0 不同键', K(mul0)!==K(add0), [K(mul0),K(add0)]);
T('4.2 12*0 键里保留 0', K(mul0).includes('n0'), K(mul0));
T('4.3 0-12 未被误删为 n12', K(B('-',N(0),N(12)))!=='n12', K(B('-',N(0),N(12))));
T('4.4 12/0 被拒（除零）', RS.evalNode(B('/',N(12),N(0)))===null, null);
// 只翻一侧不得归一（会真的变号）
// ⚠️ 旧版 4.5 用 (8-6)/(r12-r6) 做探针是无效的：分母也是差节点 ⇒ nb 也非 null，
//   「na!==null」与「na&&nb」在该用例上行为相同，变异不会被判红。
//   真正能区分的是【分母不是差节点】的形状：(8-6)/2 vs (6-8)/2，两者值为 ±1。
const d1=B('/',B('-',N(8),N(6)),N(2));   // = 1
const d2=B('/',B('-',N(6),N(8)),N(2));   // = -1
T('4.5 值不同的两式必不同键（只翻分子不得归一）', K(d1)!==K(d2), [K(d1),K(d2)]);
T('4.5b 键不得含字面 null（negKeySol 返回值未被误拼接）',
  !K(d1).includes('null') && !K(d2).includes('null'), [K(d1),K(d2)]);
// 真正不同的解不得被合并
const r3=RS.solve([2,3,4,12]);
T('4.6 (2,3,4,Q) 解数未塌缩', r3.primary.size+r3.advanced.size>=10, r3.primary.size+r3.advanced.size);
// 可解性不变（抽样）
let solvable=0;
for(const dk of [[1,2,3,4],[3,3,8,8],[1,5,5,5],[6,6,8,12],[0,6,12,12],[3,6,7,11]]){
  const r=RS.solve(dk); if(r.primary.size+r.advanced.size>0) solvable++;
}
T('4.7 6 组已知可解牌组仍全部有解', solvable===6, solvable);

console.log(`\npass=${pass} fail=${fail}`);
process.exit(fail>0?1:0);
