import { fileURLToPath } from 'url';
// task-127 B 验证：抽【真实】_applyAdvancedCalc + 真实 DEALING→DONE 转换块，逐字挂宿主
import fs from 'fs';
const SRC=process.argv[2]||fileURLToPath(new URL('../js/ui/PageRenderer.js',import.meta.url));
const src=fs.readFileSync(SRC,'utf8').replace(/\r\n/g,'\n');
const mApply=src.match(/  _applyAdvancedCalc\(on, caps\) \{[\s\S]*?\n  \}\n/);
if(!mApply){console.log('❌ 未抽到 _applyAdvancedCalc');process.exit(2);}
// 抽真实转换块（含可能存在的 pending 消费），逐字，不改写
const mTrans=src.match(/    if \(this\.dealState === DEAL_STATE\.DEALING\) \{\n      const totalMs[\s\S]*?\n    \}\n/);
if(!mTrans){console.log('❌ 未抽到转换块');process.exit(2);}
console.log('抽取: apply='+mApply[0].length+'B  transition='+mTrans[0].length+'B  含pending消费='+/_recipRecomputePending/.test(mTrans[0]));
const DEAL_STATE={IDLE:'idle',DEALING:'dealing',DONE:'done'};
const CARD_FLIP_MS=400, CARD_DELAY_MS=150;
const Host=new Function('DEAL_STATE','CARD_FLIP_MS','CARD_DELAY_MS',`
 return class H {
  constructor(){ this.dealState=DEAL_STATE.IDLE; this.dealtCards=[]; this.dealStartAt=0;
    this._recipRecomputePending=false; this._advancedCalc=true;
    this._caps={recip:true,fact:true,mod:true,pow:true,log:true};
    this.answerArea=null; this._settings=null; this.calls=[]; }
  _computeRecipAsync(v){ this.calls.push(v); }
  tick(now){ ${mTrans[0]} }
${mApply[0]}
 };`)(DEAL_STATE,CARD_FLIP_MS,CARD_DELAY_MS);
const CARDS=[{value:1},{value:3},{value:5},{value:10}];
let pass=0,fail=0;
const C=(n,c,d)=>{ if(c){pass++;console.log('  ✓ '+n);} else {fail++;console.log('  ✗ '+n+'  — '+JSON.stringify(d));} };
const NARROW={recip:false,fact:false,mod:true,pow:true,log:true};

// B-6 对照：DONE 期改设置必重算（证明探针能检出重算，非恒假）
let h=new Host(); h.dealState=DEAL_STATE.DONE; h.dealtCards=CARDS;
h._applyAdvancedCalc(true,NARROW);
C('B-6 对照 DONE 改设置 ⇒ 立即重算', h.calls.length===1, {calls:h.calls});

// B-7 DEALING 期改设置：当帧不得重算（不打断动画）
h=new Host(); h.dealState=DEAL_STATE.DEALING; h.dealtCards=CARDS; h.dealStartAt=1000;
h._applyAdvancedCalc(true,NARROW);
C('B-7 DEALING 期当帧不重算（不打断动画）', h.calls.length===0, {calls:h.calls});

// B-8 🔴 核心：转 DONE 后必须补算
h.tick(1000+850);   // 动画结束
C('B-8🔴 转 DONE 后补算（Tester 报的漏洞）', h.dealState===DEAL_STATE.DONE && h.calls.length===1,
  {state:h.dealState,calls:h.calls});
C('B-8b 补算牌值正确', JSON.stringify(h.calls[0])==='[1,3,5,10]', {v:h.calls[0]});

// B-9 pending 只消费一次（后续帧不得反复重算）
h.tick(1000+900); h.tick(1000+950);
C('B-9 pending 仅消费一次', h.calls.length===1, {calls:h.calls});

// B-10 DEALING 期口径未变 ⇒ 转 DONE 不得补算（防白白重算）
h=new Host(); h.dealState=DEAL_STATE.DEALING; h.dealtCards=CARDS; h.dealStartAt=2000;
h._applyAdvancedCalc(true,{recip:true,fact:true,mod:true,pow:true,log:true});
h.tick(2000+850);
C('B-10 DEALING 期口径未变 ⇒ 转 DONE 不补算', h.calls.length===0, {calls:h.calls});

// B-11 动画未结束不得提前补算
h=new Host(); h.dealState=DEAL_STATE.DEALING; h.dealtCards=CARDS; h.dealStartAt=3000;
h._applyAdvancedCalc(true,NARROW); h.tick(3000+400);
C('B-11 动画未结束 ⇒ 不提前补算且仍 DEALING', h.calls.length===0 && h.dealState===DEAL_STATE.DEALING,
  {state:h.dealState,calls:h.calls});
h.tick(3000+850);
C('B-11b 结束后才补算', h.calls.length===1, {calls:h.calls});
console.log(`\nB PROBE: pass=${pass} fail=${fail}`);
process.exit(fail?1:0);
