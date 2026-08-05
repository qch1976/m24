// task-81 selftest：答题区背景 alpha=0.5 纯色蒙层（INPUT-06 §1.7）
import { readFileSync } from 'fs';
const src = readFileSync(new URL('../js/ui/AnswerArea.js', import.meta.url), 'utf8');
// 剥注释后再断言（避免注释文字污染判据 —— 团队规则 11）
const code = src.split('\n').filter(l => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');
let pass=0, fail=0;
const T=(n,c,got)=>{ if(c){pass++;console.log('  PASS',n);} else {fail++;console.log('  FAIL',n,'=> got:',JSON.stringify(got));} };

const m = code.match(/const BG_COLOR = '([^']+)'/);
T('1 BG_COLOR 已定义', !!m, m);
const val = m ? m[1] : '';
T('2 alpha = 0.50', /rgba\(\s*0\s*,\s*0\s*,\s*0\s*,\s*0?\.50?\s*\)/.test(val), val);
const alpha = val.match(/,\s*([0-9.]+)\s*\)$/);
T('3 alpha 数值恰为 0.5', alpha && parseFloat(alpha[1])===0.5, alpha && alpha[1]);
T('4 不再是旧值 0.30', !/0\.30?\s*\)/.test(val) || parseFloat(alpha[1])!==0.3, val);
// 裁定：不得引入毛玻璃/模糊实现
T('5 无 ctx.filter（不做毛玻璃）', !/ctx\.filter/.test(code), (code.match(/ctx\.filter.*/)||[])[0]);
T('6 无 blur(', !/blur\s*\(/.test(code), (code.match(/blur\s*\(.*/)||[])[0]);
T('7 无离屏 canvas 降采样', !/createOffscreenCanvas|createCanvas/.test(code), null);
// 蒙层仍是一次 roundRect+fill（性能不退化）
T('8 背景仍走 roundRect 单次填充', /ctx\.fillStyle = BG_COLOR;/.test(code) && /roundRect\(ctx, area\.x/.test(code), null);
// 冻结区文件不得被本任务引用改动
T('9 未 import Background', !/from '\.\/Background'/.test(code), null);

console.log(`\npass=${pass} fail=${fail}`);
process.exit(fail>0?1:0);
