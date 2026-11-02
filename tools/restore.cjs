// One-time restore: split the v0.4 single-file build into a project (maps -> JSON, code -> src/game.js, css -> src/style.css)
const acorn = require('acorn'), fs = require('fs'), path = require('path');
const html = fs.readFileSync('/data/mf/game.html', 'utf8');
const js = html.match(/<script type="module" crossorigin>([\s\S]*?)<\/script>/)[1];
const css = html.match(/<style rel="stylesheet" crossorigin>([\s\S]*?)<\/style>/)[1];
fs.writeFileSync('/data/game/src/style.css', css);
const ast = acorn.parse(js, { ecmaVersion: 'latest', sourceType: 'module' });
const reg = {}; // var name -> map id (from Ao registry)
const aoM = js.match(/Ao=\{(smolensk41:[^}]*)\}/); aoM[1].split(',').forEach(kv => { const [k, v] = kv.split(':'); reg[v] = k; });
reg['r'] = 'pl39';
const cuts = []; const imports = [];
for (const i of [2, 184]) {
  for (const d of ast.body[i].declarations) {
    if (d.init && d.init.type === 'ObjectExpression' && d.init.properties.some(p => (p.key.name || p.key.value) === 'proj')) {
      const id = reg[d.id.name]; if (!id) throw new Error('no id for ' + d.id.name);
      const obj = Function('return (' + js.slice(d.init.start, d.init.end) + ')')();
      fs.writeFileSync(`/data/game/src/data/map_${id}.json`, JSON.stringify(obj));
      cuts.push([d.init.start, d.init.end, `__MAP_${id}`]); imports.push(`import __MAP_${id} from './data/map_${id}.json';`);
    }
  }
}
let out = js; cuts.sort((a, b) => b[0] - a[0]).forEach(([s, e, r]) => { out = out.slice(0, s) + r + out.slice(e); });
fs.writeFileSync('/data/game/src/game.raw.js', imports.join('\n') + '\n' + out);
console.log('maps:', imports.length, Object.values(reg).join(','), 'code chars', out.length, 'css', css.length);
