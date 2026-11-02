// Сборка подложки «Карты фронта» (Natural Earth 10m): суша/море/озёра/реки → src/data/front_base.json
// node tools/build-frontmap.cjs
const fs = require('fs');
const path = require('path');
let sharp;
try { sharp = require('sharp'); } catch { sharp = require('/vercel/sandbox/node_modules/sharp'); }
const D = path.join(__dirname, 'data');
const PROJ = { lon0: 30, lat0: 52, xmin: -1260, ymax: 1090, kmPx: 6 };
const W = 440, H = 348;
const EARTH = 6371, DEG = Math.PI / 180;
function P(lon, lat) {
  const r = (lon - PROJ.lon0) * DEG, i = lat * DEG, a = PROJ.lat0 * DEG;
  const k = Math.sqrt(2 / (1 + Math.sin(a) * Math.sin(i) + Math.cos(a) * Math.cos(i) * Math.cos(r)));
  const x = EARTH * k * Math.cos(i) * Math.sin(r), y = EARTH * k * (Math.cos(a) * Math.sin(i) - Math.sin(a) * Math.cos(i) * Math.cos(r));
  return [(x - PROJ.xmin) / PROJ.kmPx, (PROJ.ymax - y) / PROJ.kmPx];
}
const BB = [2, 36, 60, 68];
const geo = (f) => JSON.parse(fs.readFileSync(path.join(D, f), 'utf8'));
function polysOf(g, filt) {
  const out = [];
  for (const ft of g.features) {
    if (filt && !filt(ft.properties || {})) continue;
    const gm = ft.geometry; if (!gm) continue;
    const ps = gm.type === 'Polygon' ? [gm.coordinates] : gm.type === 'MultiPolygon' ? gm.coordinates : [];
    for (const p of ps) {
      let x0 = 999, y0 = 999, x1 = -999, y1 = -999;
      for (const [x, y] of p[0]) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      if (x1 >= BB[0] && x0 <= BB[2] && y1 >= BB[1] && y0 <= BB[3]) out.push(p);
    }
  }
  return out;
}
const svgPath = (polys) => polys.map((p) => p.map((ring) => 'M' + ring.map(([lo, la]) => P(lo, la).map((v) => v.toFixed(2)).join(',')).join('L') + 'Z').join('')).join('');
async function raster(body) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect width="100%" height="100%" fill="#000"/>${body}</svg>`;
  const { data } = await sharp(Buffer.from(svg)).greyscale().raw().toBuffer({ resolveWithObject: true });
  return data;
}
const MAJOR = new Set(['Volga', 'Don', 'Dnipro', 'Dnepre', 'Dnepr', 'Danube', 'Donau', 'Vistula', 'Oder', 'Daugava', 'Neman', 'Dniester', 'Elbe', 'Bratul Chillia', 'Bratul Sulina', 'Bratul Sfintu Gheorghe', 'Borcea']);
const MINOR = new Set(['Desna', 'Donets', 'Kuban', 'Narva', 'Oka', 'Pripyat', 'Prut', 'Velikaya', 'Neva', 'Svir', 'Svir’', 'Volkhov', 'Bug', 'Southern Bug', 'Zakhidnyy Buh', 'Seym', 'Byarezina', 'Sozh', 'Terek', 'Khopr', 'Tisa', 'Tisza', 'Sava', 'Drau', 'Drava', 'Warta', 'Narew', 'Luga', 'Siret', 'Msta', 'Medveditsa', 'Sura', 'Vuoksi']);
(async () => {
  const land = polysOf(geo('ne_10m_land.geojson'));
  const lakeOk = (p) => p.featurecla !== 'Reservoir' && !/Reservoir|Vodokhranilishche|vdkhr/i.test(p.name || '') && (p.scalerank ?? 9) <= 9;
  const lakes = polysOf(geo('ne_10m_lakes.geojson'), lakeOk);
  const landR = await raster(`<path d="${svgPath(land)}" fill="#fff" fill-rule="evenodd"/>`);
  const lakeR = await raster(`<path d="${svgPath(lakes)}" fill="#fff" fill-rule="evenodd"/>`);
  const cls = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) cls[i] = landR[i] >= 128 ? (lakeR[i] >= 128 ? 2 : 1) : 0;
  // реки
  const put = (x, y, v) => {
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const i = y * W + x;
    if (cls[i] === 1 || (cls[i] === 4 && v === 3)) cls[i] = v;
  };
  const line = (a, b, v) => {
    let [x0, y0] = a.map(Math.floor), [x1, y1] = b.map(Math.floor);
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (let n = 0; n < 4000; n++) {
      put(x0, y0, v);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  };
  const used = new Map();
  for (const fn of ['ne_10m_rivers_lake_centerlines.geojson', 'ne_10m_rivers_europe.geojson']) {
    for (const ft of geo(fn).features) {
      const p = ft.properties || {}, gm = ft.geometry; if (!gm) continue;
      const nm = p.name || p.name_en || '';
      const v = MAJOR.has(nm) ? 3 : MINOR.has(nm) ? 4 : 0;
      if (!v) continue;
      const ls = gm.type === 'LineString' ? [gm.coordinates] : gm.type === 'MultiLineString' ? gm.coordinates : [];
      for (const l of ls) {
        let prev = null;
        for (const [lo, la] of l) {
          if (lo < BB[0] || lo > BB[2] || la < BB[1] || la > BB[3]) { prev = null; continue; }
          const q = P(lo, la);
          if (prev) line(prev, q, v);
          prev = q;
        }
      }
      used.set(nm, (used.get(nm) || 0) + 1);
    }
  }
  // RLE
  let rle = '', cur = cls[0], len = 0;
  for (let i = 0; i < W * H; i++) {
    if (cls[i] === cur) len++;
    else { rle += cur + len.toString(36) + '.'; cur = cls[i]; len = 1; }
  }
  rle += cur + len.toString(36);
  const out = { w: W, h: H, proj: PROJ, cls: rle };
  fs.writeFileSync(path.join(__dirname, '..', 'src', 'data', 'front_base.json'), JSON.stringify(out));
  const cnt = [0, 0, 0, 0, 0]; for (const c of cls) cnt[c]++;
  console.log('front_base.json', (rle.length / 1024).toFixed(1) + ' KB', 'classes', cnt.join(','), 'rivers', [...used.keys()].join(' '));
})();
