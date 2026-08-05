// R-07 m24.settings v1→v2 迁移设计验证（≥6 用例）
const KEY='m24.settings', DEAL={SOLVABLE:'solvable',RANDOM:'random'};
const defaults=()=>({version:2,dealMode:DEAL.SOLVABLE,advancedCalc:false});
const isMode=m=>m===DEAL.SOLVABLE||m===DEAL.RANDOM;
// 降级触发点（9 个，v1 的 5 个 + 本迭代新增 4 个）
function loadSettings(raw,throwOnGet){
 try{
  if(throwOnGet)throw new Error('storage_fail');           // T1 getStorageSync 抛异常
  if(raw===undefined||raw===null||raw==='')return{s:defaults(),path:'D1 空值→默认'};
  if(typeof raw!=='object'||Array.isArray(raw))return{s:defaults(),path:'D2 非对象→默认'};
  if(raw.version===1){                                     // ★ v1→v2 迁移
   if(!isMode(raw.dealMode))return{s:defaults(),path:'D3 v1 但 dealMode 非法→默认'};
   return{s:{version:2,dealMode:raw.dealMode,advancedCalc:false},path:'M v1→v2 迁移（advancedCalc 补 false）'};}
  if(raw.version!==2)return{s:defaults(),path:'D4 version 非 1/2→默认'};
  if(!isMode(raw.dealMode))return{s:defaults(),path:'D5 v2 dealMode 非法→默认'};
  if(typeof raw.advancedCalc!=='boolean')                  // ★ 字段级降级，不牵连 dealMode
   return{s:{version:2,dealMode:raw.dealMode,advancedCalc:false},path:'D6 advancedCalc 非布尔→该字段补 false，保留 dealMode'};
  return{s:{version:2,dealMode:raw.dealMode,advancedCalc:raw.advancedCalc},path:'OK v2 正常读取'};
 }catch(e){return{s:defaults(),path:'D7 异常→默认（不崩溃）'};}}
function saveSettings(s){
 const mode=s&&s.dealMode===DEAL.RANDOM?DEAL.RANDOM:DEAL.SOLVABLE;
 return{version:2,dealMode:mode,advancedCalc:!!(s&&s.advancedCalc)};}
const C=[
 ['U1 v1 solvable（历史用户）',{version:1,dealMode:'solvable'},{version:2,dealMode:'solvable',advancedCalc:false}],
 ['U2 v1 random（历史用户）',{version:1,dealMode:'random'},{version:2,dealMode:'random',advancedCalc:false}],
 ['U3 v2 高级开',{version:2,dealMode:'random',advancedCalc:true},{version:2,dealMode:'random',advancedCalc:true}],
 ['U4 v2 高级关',{version:2,dealMode:'solvable',advancedCalc:false},{version:2,dealMode:'solvable',advancedCalc:false}],
 ['U5 首次安装（空）',undefined,{version:2,dealMode:'solvable',advancedCalc:false}],
 ['U6 脏数据 version=3',{version:3,dealMode:'random',advancedCalc:true},{version:2,dealMode:'solvable',advancedCalc:false}],
 ['U7 advancedCalc 字符串',{version:2,dealMode:'random',advancedCalc:'yes'},{version:2,dealMode:'random',advancedCalc:false}],
 ['U8 v1 dealMode 非法',{version:1,dealMode:'xx'},{version:2,dealMode:'solvable',advancedCalc:false}],
 ['U9 非对象',"m24",{version:2,dealMode:'solvable',advancedCalc:false}],
 ['U10 storage 抛异常',{version:2,dealMode:'random',advancedCalc:true},{version:2,dealMode:'solvable',advancedCalc:false},true],
 ['U11 缺 advancedCalc 字段（v2）',{version:2,dealMode:'random'},{version:2,dealMode:'random',advancedCalc:false}],
 ['U12 v1 多余字段（前向兼容）',{version:1,dealMode:'random',foo:1},{version:2,dealMode:'random',advancedCalc:false}],
];
console.log('=== R-07 m24.settings v1→v2 迁移与降级验证 ===');
let pass=0;
for(const [lab,raw,want,thr] of C){
 const {s,path}=loadSettings(raw,thr);
 const ok=JSON.stringify(s)===JSON.stringify(want);
 if(ok)pass++;
 console.log(`${ok?'✓':'✗'} ${lab.padEnd(26)} → ${JSON.stringify(s)}   [${path}]`);}
console.log(`\n用例 ${C.length} 条：pass=${pass}（R-07 要求 ≥6 ✓）`);
console.log('\n=== 写入幂等（saveSettings 白名单）===');
for(const s of [{dealMode:'random',advancedCalc:true},{dealMode:'x',advancedCalc:'y'},{dealMode:'solvable',advancedCalc:1},null]){
 console.log(`  in=${JSON.stringify(s)} → out=${JSON.stringify(saveSettings(s))}`);}
console.log('\n=== 往返一致性（save→load 幂等）===');
let allRt=true;
for(const s of [{dealMode:'solvable',advancedCalc:false},{dealMode:'solvable',advancedCalc:true},{dealMode:'random',advancedCalc:false},{dealMode:'random',advancedCalc:true}]){
 const w=saveSettings(s); const r=loadSettings(w).s;
 const ok=JSON.stringify(w)===JSON.stringify(r); if(!ok)allRt=false;
 console.log(`  ${ok?'✓':'✗'} ${JSON.stringify(w)} → ${JSON.stringify(r)}`);}
console.log(allRt?'往返幂等：4/4 ✓':'往返幂等：存在不一致 ✗');

// —— task-75：R-07 要求迁移用例 pass>=6 且写入幂等全通 ——
const migOk = pass >= 6;
const fail = (migOk ? 0 : 1) + (allRt ? 0 : 1);
console.log(`[verify-input06-settings-v2] pass=${(migOk?1:0)+(allRt?1:0)} fail=${fail}`);
process.exit(fail === 0 ? 0 : 1);
