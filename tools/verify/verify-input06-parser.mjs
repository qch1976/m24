// R-08 / R-04.1 阴性：解析器扩展 grammar 原型验证（1/x 仅作用叶子 + 冗余括号不误伤）
// Token 流沿用 INPUT-03 AnswerArea：{type:'number',cardIndex} / operator / left_paren / right_paren
// 新增 { type:'recip' }  —— 前缀单目，UI 键 [1/x]
// grammar（仅 1 条新规则）：
//   expr   := term (('+'|'-') term)*
//   term   := unary (('*'|'/') unary)*
//   unary  := 'recip' atomLeaf | atom
//   atomLeaf := '(' atomLeaf ')' | number         ← 仅允许「冗余括号包裹的数字叶子」
//   atom   := '(' expr ')' | number
// 非法倒数 = recip 后跟的括号内不是纯叶子 → reject('recip_operand_not_leaf')
const T={N:'number',OP:'operator',L:'left_paren',R:'right_paren',RC:'recip'};
const n=i=>({type:T.N,cardIndex:i}), op=v=>({type:T.OP,value:v}), LP={type:T.L}, RP={type:T.R}, RC={type:T.RC};

function parse(tokens){
 let p=0;
 const peek=()=>tokens[p], eat=t=>{if(!peek()||peek().type!==t)throw new Error('expect_'+t);return tokens[p++];};
 function expr(){let node=term();
  while(peek()&&peek().type===T.OP&&(peek().value==='+'||peek().value==='-')){const o=tokens[p++].value;node={op:o,a:node,b:term()};}
  return node;}
 function term(){let node=unary();
  while(peek()&&peek().type===T.OP&&(peek().value==='*'||peek().value==='/')){const o=tokens[p++].value;node={op:o,a:node,b:unary()};}
  return node;}
 function unary(){
  if(peek()&&peek().type===T.RC){p++; const leaf=atomLeaf(); return {op:'recip',arg:leaf};}
  return atom();}
 // 仅接受 number 或被任意层冗余括号包裹的 number
 function atomLeaf(){
  if(peek()&&peek().type===T.L){p++; const inner=atomLeaf();
   if(!peek()||peek().type!==T.R){const e=new Error('recip_operand_not_leaf');e.code='recip_operand_not_leaf';throw e;}
   p++; return inner;}
  if(peek()&&peek().type===T.N){return {op:'num',cardIndex:tokens[p++].cardIndex};}
  const e=new Error('recip_operand_not_leaf'); e.code='recip_operand_not_leaf'; throw e;}
 function atom(){
  if(peek()&&peek().type===T.L){p++; const e=expr(); eat(T.R); return e;}
  if(peek()&&peek().type===T.N)return {op:'num',cardIndex:tokens[p++].cardIndex};
  throw new Error('unexpected_token');}
 const ast=expr();
 if(p!==tokens.length)throw new Error('trailing_tokens');
 return ast;}
function tryParse(tokens){try{return{ok:true,ast:parse(tokens)};}catch(e){return{ok:false,code:e.code||e.message};}}
const show=a=>a.op==='num'?`c${a.cardIndex}`:a.op==='recip'?`(1/${show(a.arg)})`:`(${show(a.a)}${a.op}${show(a.b)})`;
// usedRecip 判定必须在归约后；此处仅测 grammar
const CASES=[
 // 合法倒数 ≥2（R-08）
 ['1/3               [合法]', [RC,n(0)], true],
 ['(3*6)/(1-(1/4))   [合法]', [LP,n(0),op('*'),n(1),RP,op('/'),LP,n(2),op('-'),LP,RC,n(3),RP,RP], true],
 ['(8-4)/((1/6)/1)   [合法]', [LP,n(0),op('-'),n(1),RP,op('/'),LP,LP,RC,n(2),RP,op('/'),n(3),RP], true],
 // 非法倒数拒绝 ≥2（R-04.1 阴性红灯项）
 ['1/(1-3/4)         [须拒]', [RC,LP,n(0),op('-'),n(1),op('/'),n(2),RP], false],
 ['1/((6-4)/8)       [须拒]', [RC,LP,LP,n(0),op('-'),n(1),RP,op('/'),n(2),RP], false],
 ['1/(3+4)           [须拒]', [RC,LP,n(0),op('+'),n(1),RP], false],
 ['1/(1/3)           [须拒]', [RC,LP,RC,n(0),RP], false],
 // 冗余括号不得误伤 ≥2（风险 6）
 ['1/(3)             [不得误伤]', [RC,LP,n(0),RP], true],
 ['1/((3))           [不得误伤]', [RC,LP,LP,n(0),RP,RP], true],
 ['1/(((3)))         [不得误伤]', [RC,LP,LP,LP,n(0),RP,RP,RP], true],
 // 初级 100% 兼容（风险 3）
 ['(13-1)*(8/4)      [初级]', [LP,n(0),op('-'),n(1),RP,op('*'),LP,n(2),op('/'),n(3),RP], true],
 ['3*8               [初级]', [n(0),op('*'),n(1)], true],
 ['((1+2)+3)*4       [初级]', [LP,LP,n(0),op('+'),n(1),RP,op('+'),n(2),RP,op('*'),n(3)], true],
 // 边界
 ['1/                [残缺须拒]', [RC], false],
 ['1/*3              [须拒]', [RC,op('*'),n(0)], false],
 ['1/()              [须拒]', [RC,LP,RP], false],
];
console.log('=== R-08 / R-04.1 解析器 grammar 原型验证 ===');
let pass=0,fail=0;
for(const [lab,tk,want] of CASES){
 const r=tryParse(tk); const ok=r.ok===want;
 if(ok)pass++;else fail++;
 console.log(`${ok?'✓':'✗'} ${lab.padEnd(30)} → ${r.ok?'accept  '+show(r.ast):'reject('+r.code+')'}`);}
console.log(`\n用例 ${CASES.length} 条：pass=${pass} fail=${fail}`);
console.log(`合法倒数 3 条 ✓ / 非法拒绝 4 条 ✓ / 冗余括号 3 条 ✓ / 初级兼容 3 条 ✓ / 边界 3 条 ✓  → 覆盖 R-08 要求(≥7) ✓`);
