const fs = require('fs');
const out = process.argv[2];
const dest = process.argv[3];
const raw = fs.readFileSync(out, 'utf8');
let obj;
try {
  obj = JSON.parse(raw);
} catch (e) {
  const a = raw.indexOf('{');
  const b = raw.lastIndexOf('}');
  obj = JSON.parse(raw.slice(a, b + 1));
}
const data = obj && obj.result ? obj.result : obj;
const clean = (s) => String(s)
  .replace(/<!\[CDATA\[/g, '')
  .replace(/\]\]>/g, '')
  .trim();
const cleaned = {};
const report = {};
for (const k of Object.keys(data)) {
  if (data[k] == null) continue;
  const c = clean(data[k]);
  if (c && c.includes('<')) {
    cleaned[k] = c;
    report[k] = { len: c.length, hasEntities: /&lt;|&gt;/.test(c), hasText: /<text\b/.test(c), hasSvgTag: /<svg\b/.test(c) };
  }
}
const header = '// ilustraciones.js — ilustraciones SVG por tipo de plato (generadas).\n'
  + '// Rellena el objeto ILUSTRACIONES definido en placeholders.js.\n';
const body = 'Object.assign(ILUSTRACIONES, ' + JSON.stringify(cleaned, null, 2) + ');\n';
fs.writeFileSync(dest, header + body);
console.log('Keys:', Object.keys(cleaned).length, '->', Object.keys(cleaned).join(', '));
console.log(JSON.stringify(report, null, 2));
