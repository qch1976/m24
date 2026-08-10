// V-11 双平台自证脚本（不入库，仅实跑）
import { parse, checkUserAnswer, evalAst } from '../../js/core/RecipParser.mjs';
import { countRecip, countPow, countLog } from '../../js/core/RecipSolver.mjs';
import { formatTokens, checkLegality } from '../../js/ui/AnswerArea.js';
let P=0,F=0; const bad=[];
const ck=(n,c,d)=>{ if(c){P++;console.log('  ✓ '+n+(d?' — '+d:''));} else {F++;bad.push(n);console.log('  ✗ '+n+(d?' — '+d:''));} };
const N=i=>({type:'number',cardIndex:i}),OP=v=>({type:'operator',value:v});
const LP={type:'left_paren'},RP={type:'right_paren'},POW={type:'pow'},LOG={type:'log'};
const val=r=>{const e=evalAst(r.ast);return e.ok?(e.value.d===1n?String(e.value.n):e.value.n+'/'+e.value.d):null;};
console.log('[env] node='+process.version+' platform='+process.platform);
console.log('\n--- V-1 幂 ---');
let r=parse([N(2),POW,N(3)],[13,1,8,3]); ck('V-1a 8^3 ok 且 =512', r.ok&&val(r)==='512', 'v='+val(r));
r=parse([N(0),POW,N(1),POW,N(2)],[2,3,4,5]); ck('V-1b 2^3^4 拒收 POW_CHAINED', !r.ok&&r.error==='pow_chained', r.error);
console.log('--- V-2 开方（capRecip=false 断链场景）---');
const rt=checkUserAnswer([N(0),POW,POW,N(1),OP('*'),N(2),OP('*'),N(3)],[9,2,8,1],{advancedCalc:true,caps:{recip:false,fact:false,mod:false,pow:true,log:false}});
ck('V-2a √9*8*1 判24（capRecip=false）', rt.pass===true, 'pass='+rt.pass);
const rp=parse([N(0),POW,POW,N(1)],[9,2,8,1]);
ck('V-2b rootIdx=2 且不建 1/b 子树 ⇒ countRecip=0', rp.ok&&rp.ast.rootIdx===2&&countRecip(rp.ast)===0, 'rootIdx='+(rp.ok?rp.ast.rootIdx:'-')+' countRecip='+(rp.ok?countRecip(rp.ast):'-'));
ck('V-2c P 位走节点存在性 countPow=1', rp.ok&&countPow(rp.ast)===1, 'countPow='+(rp.ok?countPow(rp.ast):'-'));
console.log('--- V-3 对数 ---');
r=parse([N(0),LOG,N(1)],[2,8,5,7]); ck('V-3a log_2 8 = 3', r.ok&&val(r)==='3', 'v='+val(r));
ck('V-3b 屏显 log_2 8', formatTokens([N(0),LOG,N(1)],[2,8,5,7])==='log_2 8', '"'+formatTokens([N(0),LOG,N(1)],[2,8,5,7])+'"');
ck('V-3c countLog 节点口径=1', r.ok&&countLog(r.ast)===1, 'countLog='+(r.ok?countLog(r.ast):'-'));
console.log('--- V-4 八个专属错误码逐码触发 ---');
const codes=[['pow_dangling',[N(2),POW],[13,1,8,3]],['pow_operand_not_leaf',[LP,N(0),OP('-'),N(1),RP,POW,N(3)],[13,1,8,3]],
 ['pow_not_exact',[N(0),POW,POW,N(1)],[2,3,5,7]],['pow_chained',[N(0),POW,N(1),POW,N(2)],[2,3,4,5]],
 ['log_dangling',[N(2),LOG],[13,1,8,3]],['log_operand_not_leaf',[LP,N(0),OP('-'),N(1),RP,LOG,N(3)],[13,1,8,3]],
 ['log_domain',[N(0),LOG,N(1)],[1,8,5,7]],['log_not_exact',[N(0),LOG,N(1)],[2,3,5,7]]];
for(const[c,t,cv]of codes){const x=parse(t,cv);ck('V-4 '+c, !x.ok&&x.error===c, 'got='+x.error);}
console.log('--- V-5 门禁（capPow 关 ⇒ 请先开启）---');
const g=checkUserAnswer([N(2),POW,N(3)],[13,1,8,3],{advancedCalc:false});
ck('V-5 关态提示「请先开启」而非格式不正确', /请先在设置中开启/.test(g.message||''), g.message);
console.log('--- V-7 ^ 三次上限 ---');
ck('V-7a 2次^ 合法（开方）', checkLegality([N(0),POW,POW,N(1)]).legal===true);
ck('V-7b 3次^ 拒 pow_dangling', checkLegality([N(0),POW,POW,POW,N(1)]).reason==='pow_dangling', checkLegality([N(0),POW,POW,POW,N(1)]).reason);
ck('V-7c 开方屏显 9^(1/2', formatTokens([N(0),POW,POW,N(1)],[9,2,8,1])==='9^(1/2', '"'+formatTokens([N(0),POW,POW,N(1)],[9,2,8,1])+'"');
// 🔴 断言总数推导（改数必同步改此注释）：
//   直接 ck 调用 12 处（V-1 ×2、V-2 ×3、V-3 ×3、V-5 ×1、V-7 ×3）
//   + 循环体内 1 处 ck × codes 8 条（V-4 八码逐码）= 12 + 8 = 20
//   ⚠️ 静态用行首锚计数会得 9（漏同行语句与循环体内），须与运行期实测交叉验证。
//   首版误写 19（漏数 V-3c），由本自断言当场抓出 ⇒ V-10 机制有效。
const EXPECTED=20;
console.log('\nT132 TOTAL: pass='+P+' fail='+F);
if(P+F!==EXPECTED){console.log('  ✗ 断言总数='+(P+F)+' 期望'+EXPECTED+'（有断言静默退场）');F++;}
else console.log('  ✓ 断言总数='+(P+F)+' 与期望一致（V-10）');
console.log(F===0?'OVERALL: PASS ✅':'OVERALL: FAIL ❌ '+bad.join(' | '));
process.exit(F===0?0:1);
