const fs = require('fs');
const files = ['js/cards.js', 'js/entities.js', 'js/story.js', 'js/main.js'];
const re = /(['"`])((?:\\.|(?!\1).)*?)\1/g;
const seen = new Set();
const out = [];
for (const f of files) {
  const src = fs.readFileSync(f, 'utf8');
  let m;
  while ((m = re.exec(src))) {
    const s = m[2];
    if (/[一-鿿]/.test(s)) {
      if (!seen.has(s)) { seen.add(s); out.push(s); }
    }
  }
}
out.sort();
fs.writeFileSync('cjk_strings.txt', out.join('\n'));
console.log('Total unique CJK strings:', out.length);
