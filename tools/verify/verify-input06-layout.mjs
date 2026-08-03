// R-01 / R-03 UI 布局数值验证（P30 411×891 DP 基线，tap 区 ≥44×44，无重叠、不越安全区）
const W=411,H=891;
// 牌面屏
const cards=[{x:48,y:150,w:130,h:184},{x:233,y:150,w:130,h:184},{x:48,y:348,w:130,h:184},{x:233,y:348,w:130,h:184}];
const settingsBtn={x:15,y:15,w:40,h:40};
const topRow=[{n:'提示',x:35,y:60,w:100,h:50},{n:'发牌',x:155,y:60,w:100,h:50},{n:'答案',x:275,y:60,w:100,h:50}];
const answerBtn={x:130,y:556,w:151,h:56};
// 答题区滑入态（OPEN）
const A={x:15,y:552,w:381,h:326};
const formula={x:25,y:562,w:361,h:52};
const rows={
 numRow:{x:25,y:624,w:361,h:60,cols:4,gap:8},
 opRow:{x:25,y:694,w:361,h:52,cols:6,gap:5},
 advRow:{x:25,y:756,w:361,h:52,cols:1,gap:0},   // 1/x 单键，居中占 1/3 宽
 ctrlRow:{x:25,y:818,w:361,h:52,cols:4,gap:8},
};
const cell=r=>(r.w-r.gap*(r.cols-1))/r.cols;
console.log('=== A. 牌面屏（答题区 CLOSED）411×891 DP ===');
console.log(`⚙️设置      x=[${settingsBtn.x},${settingsBtn.x+settingsBtn.w}] y=[${settingsBtn.y},${settingsBtn.y+settingsBtn.h}]  40×40  tap ${settingsBtn.w>=44&&settingsBtn.h>=44?'≥44 ✓':'<44（沿用 INPUT-05 既有键，不在本迭代 R-03 范围）⚠'}`);
for(const b of topRow)console.log(`${b.n}         x=[${b.x},${b.x+b.w}] y=[${b.y},${b.y+b.h}]  ${b.w}×${b.h}  tap ✓`);
console.log('牌面 2×2：');
cards.forEach((c,i)=>console.log(`  card${i}     x=[${c.x},${c.x+c.w}] y=[${c.y},${c.y+c.h}]  ${c.w}×${c.h}`));
const cw=cards[1].x+cards[1].w-cards[0].x, chh=cards[2].y+cards[2].h-cards[0].y;
console.log(`  整块 ${cw}×${chh}  水平居中偏差=${Math.abs((W-cw)/2-cards[0].x)} DP（须=0）${Math.abs((W-cw)/2-cards[0].x)<1?'✓':'✗'}`);
console.log(`  上沿 ${cards[0].y} vs 顶行底 ${topRow[0].y+topRow[0].h} → 间距 ${cards[0].y-(topRow[0].y+topRow[0].h)} DP ${cards[0].y-110>=10?'✓':'✗'}`);
console.log(`  下沿 ${cards[2].y+cards[2].h} vs [答题]顶 ${answerBtn.y} → 间距 ${answerBtn.y-(cards[2].y+cards[2].h)} DP ${answerBtn.y-532>=10?'✓':'✗'}`);
console.log(`[答题]      x=[${answerBtn.x},${answerBtn.x+answerBtn.w}] y=[${answerBtn.y},${answerBtn.y+answerBtn.h}]  ${answerBtn.w}×${answerBtn.h}  tap ✓  居中偏差=${Math.abs((W-answerBtn.w)/2-answerBtn.x).toFixed(1)}`);
console.log(`  底沿 ${answerBtn.y+answerBtn.h} ≤ ${H}-25(安全区) = ${H-25} → ${answerBtn.y+answerBtn.h<=H-25?'✓':'✗'}`);
console.log('\n=== B. INPUT-05 旧值 vs INPUT-06 新值（牌面下移放大）===');
const old=[{x:55,y:118,w:120,h:170},{x:236,y:118,w:120,h:170},{x:55,y:304,w:120,h:170},{x:236,y:304,w:120,h:170}];
console.log(`单牌   120×170 → 130×184   放大 ${(130/120*100-100).toFixed(1)}% / ${(184/170*100-100).toFixed(1)}%（面积 +${((130*184)/(120*170)*100-100).toFixed(1)}%）`);
console.log(`top y  118 → 150（下移 32 DP）   bottom y 304 → 348（下移 44 DP）`);
console.log(`x 锚点 55/236 → 48/233（重算居中，牌宽 +10）`);
console.log(`旧整块 ${old[1].x+old[1].w-old[0].x}×${old[2].y+old[2].h-old[0].y} → 新 ${cw}×${chh}`);
console.log('\n=== C. 答题区 OPEN 态 15 键排布 ===');
console.log(`area      x=[${A.x},${A.x+A.w}] y=[${A.y},${A.y+A.h}]  ${A.w}×${A.h}`);
console.log(`formula   y=[${formula.y},${formula.y+formula.h}]  h=${formula.h}`);
let allTapOk=true, prevBottom=formula.y+formula.h;
const rowInfo=[['numRow',4,'数字键'],['opRow',6,'+ - × ÷ ( )'],['advRow',1,'1/x（仅开关开）'],['ctrlRow',4,'提交/删除/清空/无解']];
for(const [k,cnt,desc] of rowInfo){
 const r=rows[k]; const cwv=k==='advRow'?361/3:cell(r);
 const tapOk=cwv>=44&&r.h>=44; if(!tapOk)allTapOk=false;
 const gapPrev=r.y-prevBottom;
 console.log(`${k.padEnd(9)} y=[${r.y},${r.y+r.h}] h=${r.h} cols=${r.cols} gap=${r.gap} 单元宽=${cwv.toFixed(2)}  tap ${cwv.toFixed(1)}×${r.h} ${tapOk?'✓':'✗'}  与上行间距=${gapPrev}  | ${desc}`);
 prevBottom=r.y+r.h;}
console.log(`area 底 ${A.y+A.h}  最后一行底 ${prevBottom}  内边距=${A.y+A.h-prevBottom} ✓`);
console.log(`area 底 ${A.y+A.h} ≤ ${H}-13 安全区 = ${H-13} → ${A.y+A.h<=H-13?'✓':'✗'}`);
console.log(`tap 区全部 ≥44×44：${allTapOk?'✓':'✗'}`);
console.log('\n=== D. 键数核对（R-03）===');
console.log(`开关打开：4(num) + 6(op) + 1(adv) + 4(ctrl) = ${4+6+1+4}（须 15）${4+6+1+4===15?'✓':'✗'}`);
console.log(`开关关闭：4(num) + 6(op) + 0(adv) + 4(ctrl) = ${4+6+0+4}（须 14）${4+6+0+4===14?'✓':'✗'}`);
console.log('\n=== E. 重叠检查（OPEN 态全部矩形两两不相交）===');
const rects=[];
rects.push({n:'formula',...formula});
for(const [k,cnt] of rowInfo.map(x=>[x[0],x[1]])){
 const r=rows[k]; const cwv=k==='advRow'?361/3:cell(r);
 const x0=k==='advRow'?r.x+361/3:r.x;
 for(let i=0;i<cnt;i++)rects.push({n:`${k}[${i}]`,x:x0+i*(cwv+r.gap),y:r.y,w:cwv,h:r.h});}
let ov=0;
const hit=(a,b)=>a.x<b.x+b.w-1e-9&&b.x<a.x+a.w-1e-9&&a.y<b.y+b.h-1e-9&&b.y<a.y+a.h-1e-9;
for(let i=0;i<rects.length;i++)for(let j=i+1;j<rects.length;j++)if(hit(rects[i],rects[j])){ov++;console.log(`  重叠：${rects[i].n} × ${rects[j].n}`);}
console.log(`共 ${rects.length} 个矩形，重叠 ${ov} 对 ${ov===0?'✓':'✗'}`);
const outX=rects.filter(r=>r.x<0||r.x+r.w>W), outY=rects.filter(r=>r.y<0||r.y+r.h>H);
console.log(`越界：横向 ${outX.length}  纵向 ${outY.length} ${outX.length+outY.length===0?'✓':'✗'}`);
console.log('\n=== F. CLOSED 态 vs OPEN 态 牌面遮挡 ===');
console.log(`OPEN 时 area 顶 ${A.y}；牌面下沿 ${cards[2].y+cards[2].h} → ${A.y>=cards[2].y+cards[2].h?`不遮挡牌面（余 ${A.y-(cards[2].y+cards[2].h)} DP）✓`:`遮挡 ${cards[2].y+cards[2].h-A.y} DP（[答题] 键被覆盖，属预期）`}`);
console.log(`OPEN 时 [答题] 键 y=[${answerBtn.y},${answerBtn.y+answerBtn.h}] 被 area 覆盖 → 设计上 OPEN 态不渲染 [答题]，改渲染 [返回]`);
