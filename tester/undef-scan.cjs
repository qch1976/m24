// Tester 独立工具：扫描 js/ 下所有 ESM 模块中「被引用但无任何声明」的标识符
// 目的：兜住 dealtOk 这类 grep 与静态 disabled 断言都测不出的未定义变量 bug
// 方法：正则剥注释/字符串 → 收集所有声明来源 → 剔除属性访问与对象键 → 输出可疑集
// 局限：非完整 AST 作用域分析，可能有假阳性；故对每个命中都输出所在行供人工确认
const fs = require('fs');
const path = require('path');

const BUILTIN = new Set(['console','Math','JSON','Object','Array','String','Number','Boolean','Date','Map','Set','WeakMap','WeakSet','Promise','Error','RangeError','TypeError','ReferenceError','SyntaxError','BigInt','Symbol','Reflect','Proxy','Infinity','NaN','undefined','this','arguments','wx','globalThis','window','document','setTimeout','clearTimeout','setInterval','clearInterval','requestAnimationFrame','cancelAnimationFrame','canvas','GameGlobal','Float64Array','Float32Array','Int32Array','Uint8Array','Uint32Array','ArrayBuffer','parseInt','parseFloat','isNaN','isFinite','performance','process','require','module','exports','structuredClone','encodeURIComponent','decodeURIComponent','Intl','RegExp','Function','escape','unescape']);
const KW = new Set(['if','else','for','while','do','return','break','continue','function','class','const','let','var','new','typeof','instanceof','in','of','delete','void','throw','try','catch','finally','switch','case','default','import','export','from','as','async','await','yield','static','get','set','extends','super','constructor','true','false','null','with','debugger']);

function stripped(src) {
  let s = src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');
  // 模板串：保留 ${} 内表达式（那里也可能引用未定义变量），只清掉纯文本部分
  s = s.replace(/`((?:[^`\\]|\\.)*)`/g, (m, body) => {
    const exprs = [...body.matchAll(/\$\{([^}]*)\}/g)].map(x => x[1]).join(';');
    return '`' + (exprs ? '${' + exprs + '}' : '') + '`';
  });
  s = s.replace(/"(?:[^"\\]|\\.)*"/g, '""').replace(/'(?:[^'\\]|\\.)*'/g, "''");
  return s;
}

function declaredIn(s) {
  const d = new Set();
  const add = (x) => { const t = String(x || '').split('=')[0].replace(/[{}\[\]().\s]/g, '').trim(); if (t && /^[A-Za-z_$][\w$]*$/.test(t)) d.add(t); };
  for (const m of s.matchAll(/(?:const|let|var)\s+([A-Za-z_$][\w$]*)/g)) d.add(m[1]);
  for (const m of s.matchAll(/(?:const|let|var)\s*\{([^}]*)\}/g)) m[1].split(',').forEach(x => add(x.split(':').pop()));
  for (const m of s.matchAll(/(?:const|let|var)\s*\[([^\]]*)\]/g)) m[1].split(',').forEach(add);
  for (const m of s.matchAll(/import\s+(?:\*\s+as\s+)?([A-Za-z_$][\w$]*)/g)) d.add(m[1]);
  for (const m of s.matchAll(/import\s*\{([^}]*)\}/g)) m[1].split(',').forEach(x => add(x.split(/\s+as\s+/).pop()));
  for (const m of s.matchAll(/function\s*([A-Za-z_$][\w$]*)?\s*\(([^)]*)\)/g)) { if (m[1]) d.add(m[1]); m[2].split(',').forEach(add); }
  // 类方法 / 简写方法：name(args) {
  for (const m of s.matchAll(/([A-Za-z_$][\w$]*)\s*\(([^)]*)\)\s*\{/g)) { d.add(m[1]); m[2].split(',').forEach(add); }
  for (const m of s.matchAll(/\(([^)]*)\)\s*=>/g)) m[1].split(',').forEach(add);
  for (const m of s.matchAll(/(?:^|[^.\w$])([A-Za-z_$][\w$]*)\s*=>/gm)) d.add(m[1]);
  for (const m of s.matchAll(/catch\s*\(([^)]*)\)/g)) add(m[1]);
  for (const m of s.matchAll(/class\s+([A-Za-z_$][\w$]*)/g)) d.add(m[1]);
  for (const m of s.matchAll(/for\s*\(\s*(?:const|let|var)?\s*([A-Za-z_$][\w$]*)\s+(?:of|in)\b/g)) d.add(m[1]);
  for (const m of s.matchAll(/for\s*\(\s*(?:const|let|var)?\s*\{([^}]*)\}\s+(?:of|in)\b/g)) m[1].split(',').forEach(x => add(x.split(':').pop()));
  for (const m of s.matchAll(/for\s*\(\s*(?:const|let|var)?\s*\[([^\]]*)\]\s+(?:of|in)\b/g)) m[1].split(',').forEach(add);
  return d;
}

const files = [];
(function walk(d) {
  for (const f of fs.readdirSync(d)) {
    const p = path.join(d, f);
    const st = fs.statSync(p);
    if (st.isDirectory()) { if (!/node_modules|\.git|tester|selftest|tools|_esm/.test(p)) walk(p); }
    else if (f.endsWith('.js')) files.push(p);
  }
})('js');

console.log(`undef-scan.cjs @ ${new Date().toISOString()}  node ${process.version}`);
console.log(`扫描 ${files.length} 个 js/ 下 .js 文件（排除 tester/selftest/tools）\n`);

let hits = 0;
for (const p of files) {
  const raw = fs.readFileSync(p, 'utf8');
  const s = stripped(raw);
  const decl = declaredIn(s);
  // 剔除属性访问 (.foo)、对象键 (foo:)、可选链 (?.foo)
  const noProp = s.replace(/\??\.\s*[A-Za-z_$][\w$]*/g, '.').replace(/([A-Za-z_$][\w$]*)\s*:/g, ':');
  const sus = new Map();
  for (const m of noProp.matchAll(/\b([A-Za-z_$][\w$]*)\b/g)) {
    const id = m[1];
    if (KW.has(id) || BUILTIN.has(id) || decl.has(id)) continue;
    if (!sus.has(id)) sus.set(id, 0);
    sus.set(id, sus.get(id) + 1);
  }
  if (sus.size) {
    // 找每个可疑 id 的真实行号（在原文里）
    const lines = raw.split('\n');
    for (const [id, cnt] of sus) {
      const at = [];
      lines.forEach((l, i) => { if (new RegExp(`(?<![.\\w$])${id.replace(/\$/g, '\\$')}(?![\\w$])`).test(l)) at.push(i + 1); });
      hits++;
      console.log(`🔍 ${p}  ->  ${id}  (${cnt}x)  行: ${at.slice(0, 6).join(',')}${at.length > 6 ? '…' : ''}`);
      if (at.length) console.log(`     L${at[0]}: ${(lines[at[0] - 1] || '').trim().slice(0, 110)}`);
    }
  }
}
console.log(`\n---SCAN DONE  files=${files.length}  suspicious=${hits}`);
