/* 把 index.html 里最后一段内联 <script> 抽出来做 node --check 语法检查 */
const fs=require('fs'),path=require('path');
const h=fs.readFileSync(path.resolve(__dirname,'..','index.html'),'utf8');
const i=h.lastIndexOf('<script>');
const s=h.slice(i+8,h.lastIndexOf('</script>'));
fs.writeFileSync(path.resolve(__dirname,'_syn_out.js'),s);
console.log('js lines',s.split('\n').length);
