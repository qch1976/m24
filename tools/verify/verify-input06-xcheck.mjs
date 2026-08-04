// 不依赖实现的交叉检验：人工构造等价类 → 独立 Fraction 求值确认同值 → 断言键唯一
import * as L from './lib-input06-dedup.mjs';
const {F,add,sub,mul,div,numLeaf:n,recipLeaf:r,reduceFix,keySol,render}=L;
const B=(op,a,b)=>({op,a,b});
function ev(t){ // 独立求值，完全不经归约
 if(t.op==='num'||t.op==='one'||t.op==='zero')return t.v;
 if(t.op==='recip')return t.v;
 const a=ev(t.a),b=ev(t.b);
 return t.op==='+'?add(a,b):t.op==='-'?sub(a,b):t.op==='*'?mul(a,b):div(a,b);}
const G=[
 ['乘1恒等',      [B('/',n(2),B('-',r(3),r(4))), B('/',B('*',n(1),n(2)),B('-',r(3),r(4))), B('/',n(2),B('-',B('*',n(1),r(3)),r(4)))]],
 ['结合律',        [B('*',B('*',n(2),n(3)),n(4)), B('*',n(2),B('*',n(3),n(4)))]],
 ['交换律',        [B('*',n(3),n(8)), B('*',n(8),n(3))]],
 ['除法链序',      [B('/',B('/',n(24),n(3)),n(4)), B('/',B('/',n(24),n(4)),n(3))]],
 ['倒数形态',      [B('/',r(5),n(1)), r(5)]],
 ['多层括号',      [B('*',n(3),n(8)), B('*',B('*',n(1),n(3)),n(8))]],
 ['空分子多分母',  [B('/',r(3),n(4)), B('/',r(4),n(3)), B('*',r(3),r(4))]],
 ['★加减链抵消',  [B('/',n(12),B('-',B('+',r(2),n(3)),n(3))), B('/',n(12),r(2)), B('*',n(12),n(2))]],
 ['★加法交换',    [B('+',B('+',n(8),n(8)),n(8)), B('+',n(8),B('+',n(8),n(8)))]],
 ['★减法同项',    [B('-',B('+',n(24),n(5)),n(5)), n(24)]],
 ['★加0恒等',     [B('+',n(24),B('-',n(3),n(3))), n(24)]],
 ['★减法分配律',   [B('-',B('-',n(1),r(2)),r(3)), B('-',n(1),B('+',r(2),r(3)))]],
];
let pass=0,fail=0;
console.log('组名             | 变体 | 求值全等 | v5键数 | 判定');
for(const [gl,ts] of G){
 const vs=ts.map(ev).map(f=>f?`${f.n}/${f.d}`:'null');
 const veq=new Set(vs).size===1;
 const ks=new Set(ts.map(t=>keySol(reduceFix(t).node)));
 const ok=veq&&ks.size===1; ok?pass++:fail++;
 console.log(`${gl.padEnd(16)} |  ${ts.length}   |    ${veq?'✅':'❌'}    |   ${ks.size}    | ${ok?'✅ 键唯一':'❌ '+[...ks].join(' | ')}`);
}
console.log(`\n等价类检验：${pass} 通过 / ${fail} 失败`);
process.exit(fail?1:0);
