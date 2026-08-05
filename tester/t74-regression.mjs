/**
 * task-74 全量回归：R-11④ 解数基准全表 + R-04.3 hasAdvanced + 人工验算交叉核对
 * ★ 独立枚举，不调用 solve()（禁 solver 自证）；全程 Fraction；禁 ===24 浮点判等
 */
import { leafVariants, addF, subF, mulF, divF, render, F,
         reduceToFixpoint, keySol, countRecip } from '../js/core/RecipSolver.mjs';
const OPS = ['+','-','*','/'];
function enumAll(cards){const out=[];function dfs(items){if(items.length===1){out.push(items[0].t);return;}
 const n=items.length;for(let i=0;i<n;i++)for(let j=0;j<n;j++){if(i===j)continue;
 const rest=[];for(let k=0;k<n;k++)if(k!==i&&k!==j)rest.push(items[k]);
 const A=items[i],B=items[j];for(const op of OPS){if((op==='+'||op==='*')&&i>j)continue;let v;
 switch(op){case '+':v=addF(A.v,B.v);break;case '-':v=subF(A.v,B.v);break;case '*':v=mulF(A.v,B.v);break;default:v=divF(A.v,B.v);}
 if(v===null)continue;dfs([{t:{op,a:A.t,b:B.t},v},...rest]);}}}
 for(const lv of leafVariants(cards))dfs(lv.map(t=>({t,v:t.v})));return out;}
function evalExact(t){switch(t.op){case 'num':return t.v;case 'one':return F(1n,1n);case 'zero':return F(0n,1n);
 case 'recip':{const v=evalExact(t.arg);return(!v||v.n===0n)?null:F(v.d,v.n);}
 default:{const a=evalExact(t.a),b=evalExact(t.b);if(!a||!b)return null;
 if(t.op==='+')return addF(a,b);if(t.op==='-')return subF(a,b);if(t.op==='*')return mulF(a,b);return divF(a,b);}}}
// ★ Fraction 精确判等：n === 24*d，不用 ===24 也不用 toFixed
const is24=t=>{const f=evalExact(t);return !!f&&f.n===24n*f.d;};

function counts(cards){
  const prim=new Map(), adv=new Map();
  for(const t of enumAll(cards)){ if(!is24(t)) continue;
    const rr=reduceToFixpoint(t), k=keySol(rr.node);
    if(countRecip(rr.node)>0){ if(!adv.has(k)) adv.set(k,t); } else { if(!prim.has(k)) prim.set(k,t); } }
  return { primary:prim.size, advanced:adv.size, primMap:prim, advMap:adv };
}

let pass=0, fail=0;
const P=(c,m)=>{c?(pass++,console.log('  ✅ '+m)):(fail++,console.log('  🔴 FAIL '+m));};
console.log('='.repeat(78));
console.log('[t74-regression] R-11④ 解数基准 + R-04.3   node='+process.version);
console.log('='.repeat(78));

// ── R-11④ 双列基准（INPUT-06 L173 原文）──
const BASE=[
 [[1,2,3,4],3,4],[[2,3,4,6],10,10],[[1,3,4,6],1,4],[[1,5,5,5],1,1],
 [[3,3,8,8],1,7],[[1,2,5,10],2,1],[[1,1,3,8],1,0],[[1,4,6,8],3,1],
 [[2,4,5,8],7,3],[[5,5,5,5],1,0],[[1,1,2,9],1,0],[[3,3,7,7],1,0],
 [[4,4,7,7],1,0],[[3,3,3,5],1,0],
];
console.log('\n──── R-11④ 解数基准（初级/高级 双列同时校验）────');
const rows=[];
for(const [cards,ep,ea] of BASE){
  const c=counts(cards);
  rows.push({cards:cards.join(','),got:`${c.primary}/${c.advanced}`,exp:`${ep}/${ea}`});
  P(c.primary===ep && c.advanced===ea,
    `[${cards}] 初级/高级 = ${c.primary}/${c.advanced}（期望 ${ep}/${ea}）`);
}

// ── R-04.3 hasAdvancedSolution ──
console.log('\n──── R-04.3 hasAdvancedSolution ────');
for(const cards of [[1,3,4,6],[2,3,4,6],[3,3,8,8],[1,2,3,4],[1,5,5,5]]){
  const c=counts(cards);
  P(c.advanced>0, `[${cards}] 须 true：advanced=${c.advanced} > 0`);
}
for(const cards of [[5,5,5,5],[1,1,2,9],[3,3,7,7],[4,4,7,7],[3,3,3,5]]){
  const c=counts(cards);
  P(c.advanced===0, `[${cards}] 须 false：advanced=${c.advanced} == 0`);
}

// ── 人工验算交叉核对（R-04 要求 Tester 独立验算 ≥2 组，分数手算）──
// 手算①：[1,4,6,8] → 8/(1-4/6)
//   4/6 = 2/3；1 - 2/3 = 1/3；8 ÷ (1/3) = 8 × 3 = 24 ✓（浮点：4/6=0.6666...7 ⇒ 24.000000000000004）
// 手算②：[3,3,8,8] → 8/(3-8/3)
//   8/3；3 - 8/3 = 9/3 - 8/3 = 1/3；8 ÷ (1/3) = 24 ✓（浮点同样失配）
// 手算③：[1,2,3,4] → 2/((1/3)-(1/4))
//   1/3 - 1/4 = 4/12 - 3/12 = 1/12；2 ÷ (1/12) = 24 ✓
console.log('\n──── 人工验算交叉核对（手算 3 组，须与代码枚举结果一致）────');
const MANUAL=[
  {cards:[1,4,6,8], expr:'(8/(1-(4/6)))',        hand:'4/6=2/3; 1-2/3=1/3; 8÷(1/3)=24'},
  {cards:[3,3,8,8], expr:'(8/(3-(8/3)))',        hand:'8/3; 3-8/3=1/3; 8÷(1/3)=24'},
  {cards:[1,2,3,4], expr:'(2/((1/3)-(1/4)))',    hand:'1/3-1/4=1/12; 2÷(1/12)=24'},
];
for(const m of MANUAL){
  const all=[...counts(m.cards).primMap.values(), ...counts(m.cards).advMap.values()];
  const hit=enumAll(m.cards).find(t=>render(t)===m.expr);
  const ok = !!hit && is24(hit);
  P(ok, `[${m.cards}] 手算 ${m.hand} ⇒ 代码枚举确认 ${m.expr} 精确=24`);
}

console.log('\n'+'='.repeat(78));
console.log(`[t74-regression] pass=${pass} fail=${fail}`);
console.log('='.repeat(78));
process.exit(fail?1:0);
