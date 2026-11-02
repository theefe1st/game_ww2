// печать городов (col,row) и линии фронта карты: node tools/mapinfo.cjs kharkov42
const m = require(`../src/data/map_${process.argv[2]}.json`);
const C = m.cols;
const cr = (h) => `${h % C},${(h / C) | 0}`;
console.log(m.cities.map((c) => `${c.name}@${cr(c.hex)}${c.nat[0]}${c.vp}`).join('  '));
const nb = (i) => { const c = i % C, r = (i / C) | 0, odd = r & 1; const d = odd ? [[1,0],[1,-1],[0,-1],[-1,0],[0,1],[1,1]] : [[1,0],[0,-1],[-1,-1],[-1,0],[-1,1],[0,1]]; return d.map(([a,b]) => [c+a, r+b]).filter(([a,b]) => a>=0&&b>=0&&a<C&&b<m.rows).map(([a,b]) => b*C+a); };
const T = m.terrain;
let rows = [];
for (let r = 0; r < m.rows; r++) {
  let line = (r < 10 ? ' ' : '') + r + (r & 1 ? '  ' : ' ');
  for (let c = 0; c < C; c++) {
    const i = r * C + c, o = m.owner[i], t = +T[i];
    const city = m.cities.find((x) => x.hex === i);
    const front = o && nb(i).some((j) => m.owner[j] && m.owner[j] !== o);
    const ch = t < 2 ? '~' : city ? (o === 1 ? 'G' : 'S') : o === 1 ? (front ? 'x' : '.') : (front ? 'o' : ' ');
    const tt = ['~','~',' ','f','h','m','s','c'][t];
    line += ch + tt + ' ';
  }
  rows.push(line);
}
console.log('    ' + [...Array(C).keys()].map((c) => (c < 10 ? c + '  ' : c + ' ')).join(''));
console.log(rows.join('\n'));
