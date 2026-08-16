// task-155 判据：开方屏显自闭合 ⇒ 无需按 [)] ⇒ 【提交】可用
const M = await import('../js/ui/AnswerArea.js');
const { TokenType, checkLegality } = M;
const AnswerArea = M.default;
const CARDS=[8,3,1,13];
let pass=0,fail=0;
const ck=(n,c,d='')=>{if(c){pass++;console.log(`  ✓ ${n}`);}else{fail++;console.log(`  ✗ ${n} ${d}`);}};
function mk(){const a=new AnswerArea();a.cardValues=CARDS.slice();a.enabled=true;a.advancedCalc=true;
  a.setCaps({recip:true,fact:true,mod:true,pow:true,log:true});a.tokens=[];return a;}
function press(a,seq){const used=[];
  for(const k of seq){
    if(typeof k==='number'){let i=CARDS.findIndex((v,idx)=>v===k&&!used.includes(idx));used.push(i);
      a.addToken({type:TokenType.NUMBER,value:k,cardIndex:i});}
    else if(k==='^')a.addToken({type:TokenType.POW});
    else if(k==='(')a.addToken({type:TokenType.LEFT_PAREN});
    else if(k===')')a.addToken({type:TokenType.RIGHT_PAREN});
    else a.addToken({type:TokenType.OPERATOR,value:k});}
  return a;}
const run=s=>{const a=mk();press(a,s);return{txt:a.getFormulaText(),cs:a.canSubmit(),l:checkLegality(a.tokens)};};

// G-0 存在性前置：开方键真能写入（否则下面全部空跑）
const g0=run([8,'^','^',3]);
ck('G-0 存在性前置：连按 ^ 确实产出开方形态屏显', g0.txt==='8^(1/3)', `实得=${g0.txt}`);

// G-1 🔴 正例③：项目主序列，屏显自闭合且【提交】可点
const g1=run([8,'^','^',3,'+',1,'+',13]);
ck('G-1 屏显自闭合 = 8^(1/3)+1+13', g1.txt==='8^(1/3)+1+13', `实得=${g1.txt}`);
ck('G-1 【提交】可点（canSubmit=true）', g1.cs===true, `legal=${g1.l.legal} used=${g1.l.allCardsUsed} reason=${g1.l.reason}`);

// G-2 反向断言：不完整式仍须置灰（防"改成恒可点"也全绿）
const g2=run([8,'^','^',3,'+',1]);
ck('G-2 反例 未用满4牌仍置灰', g2.cs===false, `cs=${g2.cs}`);
const g2b=run([8,'+']);
ck('G-2b 反例 结尾运算符仍置灰', g2b.cs===false, `cs=${g2b.cs}`);
const g2c=run([8,'^','^',3,'+',1,'+',13,')']);
ck('G-2c 反例 多余右括号仍置灰(paren_mismatch)', g2c.cs===false && g2c.l.reason==='paren_mismatch', `reason=${g2c.l.reason}`);

// G-3 对照组：不含 ^ / 单次 ^ 均不受影响
const a1=run([8,'+',3,'+',1,'+',13]);
ck('G-3 普通式 8+3+1+13 可点', a1.cs===true && a1.txt==='8+3+1+13', `${a1.txt} cs=${a1.cs}`);
const b1=run([8,'^',3,'+',1,'+',13]);
ck('G-3 单次^（幂）8^3+1+13 可点且不误补括号', b1.cs===true && b1.txt==='8^3+1+13', `${b1.txt} cs=${b1.cs}`);

// G-4 非24也须可提（INPUT-03:80 禁求值预判）：8^(1/3)+1+13=16
ck('G-4 结果=16(≠24) 仍可提交（禁求值预判）', g1.cs===true);

console.log(`\nTOTAL pass=${pass} fail=${fail}`);
process.exit(fail>0?1:0);
