// 反向判据：数学上【不等值】或【玩家视角明确不同】的解，键必须不同（防过度合并）
import * as L from './lib-input06-dedup.mjs';
const {add,sub,mul,div,numLeaf:n,recipLeaf:r,reduceFix,keySol,render}=L;
const B=(op,a,b)=>({op,a,b});
function ev(t){if(t.op==='num'||t.op==='one'||t.op==='zero')return t.v;if(t.op==='recip')return t.v;
 const a=ev(t.a),b=ev(t.b);return t.op==='+'?add(a,b):t.op==='-'?sub(a,b):t.op==='*'?mul(a,b):div(a,b);}
const P=[
 ['不同结构同值24',  B('*',n(4),n(6)),                B('+',n(20),n(4))],
 ['减法左右非交换',  B('-',n(8),n(3)),                B('-',n(3),n(8))],
 ['除法左右非交换',  B('/',n(8),n(4)),                B('/',n(4),n(8))],
 ['真不同倒数解',    B('/',n(2),B('-',r(3),r(4))),     B('/',n(4),B('-',r(2),r(3)))],
 ['同数不同牌',      B('*',n(3),n(8)),                B('*',n(4),n(6))],
 ['减数顺序非恒等',  B('-',B('-',n(9),n(2)),n(1)),     B('-',n(9),B('-',n(2),n(1)))],
 ['除数vs乘数',      B('/',n(24),B('*',n(2),n(3))),    B('*',B('/',n(24),n(2)),n(3))],
];
let pass=0,fail=0;
console.log('组名             | 求值相异 | 键相异 | 判定');
for(const [gl,t1,t2] of P){
 const v1=ev(t1),v2=ev(t2);
 const vdiff=!(v1&&v2&&v1.n===v2.n&&v1.d===v2.d);
 const k1=keySol(reduceFix(t1).node),k2=keySol(reduceFix(t2).node);
 const kdiff=k1!==k2;
 // 判定：键必须不同（无论求值是否相同，结构不同的解不该被合并）
 const ok=kdiff; ok?pass++:fail++;
 console.log(`${gl.padEnd(16)} |    ${vdiff?'✅':'—'}     |   ${kdiff?'✅':'❌'}   | ${ok?'✅ 未误合并':'❌ 被错误合并: '+k1}`);
}
console.log(`\n反向检验：${pass} 通过 / ${fail} 失败`);
process.exit(fail?1:0);
