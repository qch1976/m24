// P0 verify loader：小游戏源码用无扩展名 import（微信构建器惯例），
// 且文件名为 .js 而仓内无 package.json "type":"module"。
// Node 默认把 .js 当 CJS → 直接 import 会 SyntaxError。
// 此 hook 仅（a）补扩展名（b）强制按 ESM 解析，**不改写任何模块内容**。
//
// 为何必須显式声明 format：本地 Node 22 依靠语法推断能蒙对，
//   但服务器 Node 24 下推断不生效 → 报 "Cannot use import statement outside a module"。
//   不能依赖推断，否则脚本“本地绿、服务器红”—— 正是本轮要防的环境差。
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve as pathResolve, extname, sep } from 'node:path';

const PROJECT_JS = pathResolve(process.cwd(), 'js');

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('./') || specifier.startsWith('../')) {
    const parentPath = context.parentURL ? fileURLToPath(context.parentURL) : process.cwd();
    const base = pathResolve(dirname(parentPath), specifier);
    if (!extname(base)) {
      for (const cand of [base + '.js', base + sep + 'index.js']) {
        if (existsSync(cand)) {
          return { url: pathToFileURL(cand).href, format: 'module', shortCircuit: true };
        }
      }
    }
  }
  return nextResolve(specifier, context);
}

// 仅对项目 js/ 下的 .js 强制 ESM，不注入、不改字节，不影响 node_modules。
export async function load(url, context, nextLoad) {
  if (url.startsWith('file:')) {
    const p = fileURLToPath(url);
    if (p.endsWith('.js') && p.startsWith(PROJECT_JS)) {
      return { format: 'module', source: readFileSync(p, 'utf8'), shortCircuit: true };
    }
  }
  return nextLoad(url, context);
}
