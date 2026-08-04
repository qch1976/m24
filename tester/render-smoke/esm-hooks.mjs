// tester/render-smoke/esm-hooks.mjs
// 让 Node 直接 import 产品源码（js/**/*.js），**字节零改动、零副本**。
//
// 为什么需要它：产品代码用 ESM 语法但文件名是 .js，且 import 不带扩展名
//   （如 `import { drawButton } from './Components'`），package.json 无 "type":"module"。
//   Node 默认把 .js 当 CJS → 直接 import 会 SyntaxError。
//
// 【为什么这比"复制 ESM 副本"更好】
//   INPUT-06 我做 AnswerArea.mjs 副本时改了 1 行 import，虽记了 SHA-1，但副本天生会漂移。
//   registerHooks 直接读原文件，**被测对象就是产品文件本身**，无副本、无 diff、无漂移。
//   这也让"stub 只覆盖纯绘图"这条硬约束天然成立：逻辑层根本没有替身。

import { registerHooks } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const PROJECT_JS = path.resolve(process.cwd(), 'js');

registerHooks({
  resolve(spec, ctx, next) {
    // 相对导入且无扩展名 → 补 .js
    if (/^\.{1,2}\//.test(spec) && !path.extname(spec)) {
      const parentPath = ctx.parentURL ? fileURLToPath(ctx.parentURL) : process.cwd();
      const abs = path.resolve(path.dirname(parentPath), spec + '.js');
      return { url: pathToFileURL(abs).href, format: 'module', shortCircuit: true };
    }
    return next(spec, ctx);
  },
  load(url, ctx, next) {
    if (url.startsWith('file:')) {
      const p = fileURLToPath(url);
      // 仅对项目 js/ 下的 .js 强制按 ESM 解析，不影响 node_modules
      if (p.endsWith('.js') && p.startsWith(PROJECT_JS)) {
        return { format: 'module', source: readFileSync(p, 'utf8'), shortCircuit: true };
      }
    }
    return next(url, ctx);
  },
});
