import { fileURLToPath } from 'url';
// 判据2：≥20 帧幂等（经理明确要求，我上轮只驱动了 2 帧 ⇒ 未满足）
import fs from 'fs';
const src=fs.readFileSync(fileURLToPath(new URL('../js/ui/PageRenderer.js',import.meta.url)),'utf8');
const mApply=src.match(/  _applyAdvancedCalc\(on, caps\) \{[\s\S]*?\n  \}\n/);
const mTrans=src.match(/    if \(this\.dealState === DEAL_STATE\.DEALING\) \{\n      const totalMs[\s\S]*?\n    \}\n/);
if(!mApply||!mTrans){console.log('❌ 抽取失败');process.exit(2);}
console.log('存在性前置: apply='+mApply[0].length+'B trans='+mTrans[0].length+'B');
const DEAL_STATE={IDLE:'idle',DEALING:'dealing',DONE:'done'};
const H=new Function('DEAL_STATE','CARD_FLIP_MS','CARD_DELAY_MS',`return class {
 constructor(){this.dealState=DEAL_STATE.IDLE;this.dealtCards=[];this.dealStartAt=0;
  this._recipRecomputePending=false;this._advancedCalc=true;
  this._caps={recip:true,fact:true,mod:true,pow:true,log:true};this.calls=[];}
 _computeRecipAsync(v){this.calls.push(v);}
 tick(now){ ${mTrans[0]} }
${mApply[0]} };`)(DEAL_STATE,400,150);
const CARDS=[{value:5},{value:8},{value:11},{value:12}];
const NARROW={recip:false,fact:false,mod:true,pow:true,log:true};
let pass=0,fail=0;const C=(n,c,d)=>{c?(pass++,console.log('  ✓ '+n)):(fail++,console.log('  ✗ '+n+' — '+JSON.stringify(d)));};
const h=new H();h.dealState=DEAL_STATE.DEALING;h.dealtCards=CARDS;h.dealStartAt=1000;
h._applyAdvancedCalc(true,NARROW);
C('前置 DEALING 期当帧不重算',h.calls.length===0,{calls:h.calls.length});
h.tick(1000+850);
C('转 DONE 补算 calls===1',h.calls.length===1,{calls:h.calls.length});
for(let i=1;i<=40;i++) h.tick(1000+850+i*16);   // 40 帧 ≈ 2 组 20 帧
C('🔴 幂等：转 DONE 后再驱动 40 帧，calls 仍 ===1',h.calls.length===1,{calls:h.calls.length,frames:40});
C('状态稳定为 DONE',h.dealState===DEAL_STATE.DONE,{s:h.dealState});
// 回归三条
let g=new H();g.dealState=DEAL_STATE.DONE;g.dealtCards=CARDS;g._applyAdvancedCalc(true,NARROW);
C('回归 DONE 态改设置仍 calls=1',g.calls.length===1,{c:g.calls.length});
g=new H();g.dealState=DEAL_STATE.DONE;g.dealtCards=CARDS;
g._applyAdvancedCalc(true,{recip:true,fact:true,mod:true,pow:true,log:true});
C('回归 口径未变仍 calls=0',g.calls.length===0,{c:g.calls.length});
g=new H();g.dealState=DEAL_STATE.IDLE;g.dealtCards=[];g._applyAdvancedCalc(true,NARROW);
for(let i=0;i<25;i++) g.tick(9999+i*16);
C('回归 未发牌 25 帧仍 calls=0',g.calls.length===0,{c:g.calls.length});
// 🔴 反向判据（Tester task-127 指出我原 7 条的盲区）：只证「该补时补了」，
//   证不了「不该补时没乱补」⇒ 把 :528 的 pending 守卫删成 if(true) 能骗过全部 7 条。
//   实测：注入无条件补算 ⇒ 原 7 条 7/0 全绿，仅 Tester 的 B-10 抓到。故补 R-1/R-2。
{
  const q=new H(); q.dealtCards=CARDS; q.dealState=DEAL_STATE.DEALING; q.dealStartAt=1000;
  // 未改任何设置，正常发牌走完
  q.tick(1000+850);
  C('🔴 R-1 未改设置 ⇒ 转 DONE 不得补算（防无条件重算伪装成修好）',q.calls.length===0,{calls:q.calls.length});
  for(let i=1;i<=25;i++) q.tick(1000+850+i*16);
  C('🔴 R-2 未改设置再驱 25 帧仍不补算',q.calls.length===0,{calls:q.calls.length});
}
console.log(`\nIDEM: pass=${pass} fail=${fail}`);process.exit(fail?1:0);
