// simulate-pack-size.mjs — 主包体积模拟
// 依据 project.config.json 里的 packOptions.ignore 规则，对项目目录做逐文件计算：
//   - 遵循 folder 规则、regexp 规则、filepath 规则
// 输出 sim-pack-after.log 兼容格式（INCLUDED / EXCLUDED / TOP N）

import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();
const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'project.config.json'), 'utf-8'));
const rules = (cfg.packOptions && cfg.packOptions.ignore) || [];

console.log(`==========================================================`);
console.log(`主包体积模拟 (packOptions.ignore rule count = ${rules.length})`);
console.log(`ROOT = ${ROOT}`);
console.log(`==========================================================`);

const included = [];
const excluded = [];

function matchRule(rule, relPath, isFolder) {
  const type = rule.type;
  const value = rule.value;
  if (type === 'folder') {
    if (relPath === value || relPath.startsWith(value + path.sep) || relPath.startsWith(value + '/')) {
      return true;
    }
  } else if (type === 'regexp') {
    try {
      // 微信小程序 regexp rule 匹配文件名（basename）或整个 relPath 由文档决定
      // 常见规则：'.*\\.mjs$' 匹配任意 .mjs 后缀文件
      const re = new RegExp(value);
      // 只对 file（非 folder）做 regexp
      if (!isFolder && re.test(relPath.replace(/\\/g, '/'))) return true;
      if (!isFolder && re.test(path.basename(relPath))) return true;
    } catch (e) {
      // ignore invalid rule
    }
  } else if (type === 'filepath' || type === 'file') {
    if (relPath.replace(/\\/g, '/') === value.replace(/\\/g, '/')) return true;
  }
  return false;
}

function walk(dir, rel) {
  const items = fs.readdirSync(dir, { withFileTypes: true });
  for (const it of items) {
    const abs = path.join(dir, it.name);
    const relPath = rel ? path.join(rel, it.name) : it.name;
    const relPosix = relPath.replace(/\\/g, '/');

    // check folder-level rule first
    if (it.isDirectory()) {
      let dropByRule = null;
      for (const r of rules) {
        if (r.type === 'folder' && (relPosix === r.value || relPosix.startsWith(r.value + '/'))) {
          dropByRule = r;
          break;
        }
      }
      if (dropByRule) {
        const size = folderSize(abs);
        excluded.push({ path: relPosix, size, reason: `folder:${dropByRule.value}` });
        continue;
      }
      walk(abs, relPath);
    } else {
      let dropByRule = null;
      for (const r of rules) {
        if (matchRule(r, relPosix, false)) { dropByRule = r; break; }
      }
      const size = fs.statSync(abs).size;
      if (dropByRule) {
        excluded.push({ path: relPosix, size, reason: `${dropByRule.type}:${dropByRule.value}` });
      } else {
        included.push({ path: relPosix, size });
      }
    }
  }
}

function folderSize(dir) {
  let total = 0;
  const stack = [dir];
  while (stack.length) {
    const cur = stack.pop();
    for (const it of fs.readdirSync(cur, { withFileTypes: true })) {
      const abs = path.join(cur, it.name);
      if (it.isDirectory()) stack.push(abs);
      else total += fs.statSync(abs).size;
    }
  }
  return total;
}

walk(ROOT, '');

const includedTotal = included.reduce((s, x) => s + x.size, 0);
const excludedTotal = excluded.reduce((s, x) => s + x.size, 0);

console.log(`INCLUDED (进包): ${included.length} files, ${(includedTotal / 1024).toFixed(1)} KB`);
console.log(`EXCLUDED (被排除): ${excluded.length} items, ${(excludedTotal / 1024).toFixed(1)} KB`);
console.log(`总原始: ${((includedTotal + excludedTotal) / 1024).toFixed(1)} KB`);

console.log('\n--- INCLUDED TOP 30 ---');
included.sort((a, b) => b.size - a.size).slice(0, 30).forEach(x => {
  console.log(`  ${(x.size / 1024).toFixed(2).padStart(8)} KB  ${x.path}`);
});

console.log('\n--- EXCLUDED TOP 15 ---');
excluded.sort((a, b) => b.size - a.size).slice(0, 15).forEach(x => {
  console.log(`  ${(x.size / 1024).toFixed(2).padStart(8)} KB  ${x.path}  (${x.reason})`);
});

console.log('\n==========================================================');
const mainMB = includedTotal / 1024 / 1024;
console.log(`主包预计大小: ${(includedTotal / 1024).toFixed(1)} KB  (${mainMB.toFixed(2)} MB)`);
console.log(`4MB 上限余量: ${(4 * 1024 - includedTotal / 1024).toFixed(1)} KB`);
console.log(`目标 3.5MB 余量: ${(3.5 * 1024 - includedTotal / 1024).toFixed(1)} KB`);
console.log(`==========================================================`);

if (mainMB > 4) {
  console.log('FAIL: 主包 > 4 MB');
  process.exit(1);
}
console.log('PASS');
process.exit(0);
