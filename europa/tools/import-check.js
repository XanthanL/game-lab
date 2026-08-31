// 跨模块 import 完整性检查：静态解析每个文件的 import 语句，
// 动态加载目标模块，逐个核对导出名确实存在。
// 无 DOM 环境下也能跑，因为被检查的模块顶层都不碰 document。
// node tools/import-check.js

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const dir = path.join(here, '..', 'js');
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.js'));

const cache = new Map();
async function exportsOf(file) {
  if (cache.has(file)) return cache.get(file);
  const mod = await import(pathToFileURL(path.join(dir, file)).href);
  const set = new Set(Object.keys(mod));
  cache.set(file, set);
  return set;
}

let bad = 0, checked = 0;
for (const f of files) {
  const src = fs.readFileSync(path.join(dir, f), 'utf8');
  const re = /import\s*\{([^}]+)\}\s*from\s*['"]\.\/([^'"]+)['"]/g;
  for (const m of src.matchAll(re)) {
    const target = m[2];
    const names = m[1].split(',').map((s) => s.trim().split(/\s+as\s+/)[0].trim()).filter(Boolean);
    let ex;
    try { ex = await exportsOf(target); }
    catch (e) { console.log(`✗ ${f} → ${target} 加载失败：${e.message}`); bad++; continue; }
    for (const n of names) {
      checked++;
      if (!ex.has(n)) { console.log(`✗ ${f} 导入了 ${target} 中不存在的 ${n}()`); bad++; }
    }
  }
}
console.log(`检查 ${files.length} 个模块 / ${checked} 处导入 → ${bad === 0 ? '全部命中' : bad + ' 处缺失'}`);
process.exit(bad === 0 ? 0 : 1);
