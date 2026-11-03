import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const extension=path.join(root,'extension');
const manifest=JSON.parse(fs.readFileSync(path.join(extension,'manifest.json'),'utf8'));
const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
assert.equal(manifest.manifest_version,3);
assert.equal(pkg.version,manifest.version,'package 与扩展版本不一致');
const entries=[manifest.background.service_worker,manifest.action.default_popup,...Object.values(manifest.icons),...manifest.content_scripts.flatMap(s=>s.js),'pdf.html','vendor/pdfjs/pdf.mjs','vendor/pdfjs/pdf.worker.mjs'];
for(const name of entries){
  const resolved=path.resolve(extension,name);
  assert.ok(resolved.startsWith(extension+path.sep)&&fs.statSync(resolved).isFile(),`入口缺失或越界：${name}`);
}
for(const name of fs.readdirSync(extension).filter(n=>n.endsWith('.js'))){
  const result=spawnSync(process.execPath,['--check',path.join(extension,name)],{encoding:'utf8'});
  if(result.status!==0)throw new Error(result.stderr||`${name} 语法检查失败`);
}
console.log(`扩展 ${manifest.version}：源码语法与运行入口检查通过。`);
