// Сборка гексовой карты операции из Natural Earth (tools/data) по описанию tools/maps/<id>.cjs
// node tools/build-hexmap.cjs kharkov42  → src/data/map_kharkov42.json (+ tools/shots/map_<id>.png превью)
const fs = require('fs');
const path = require('path');
let sharp;
try { sharp = require('sharp'); } catch { sharp = require('/vercel/sandbox/node_modules/sharp'); }
const id = process.argv[2];
const cfg = require(`./maps/${id}.cjs`);
const D = path.join(__dirname, 'data');
const R = 16, W = Math.sqrt(3) * R, RH = 1.5 * R;
const { cols, rows } = cfg;
const pxW = Math.ceil(cols * W + W / 2), pxH = Math.ceil((rows - 1) * RH + 2 * R);
const pxPerKm = W / cfg.km;
const EARTH = 6371, DEG = Math.PI / 180;
function lam(lon, lat) {
  const r = (lon - cfg.lon0) * DEG, i = lat * DEG, a = cfg.lat0 * DEG;
  const k = Math.sqrt(2 / (1 + Math.sin(a) * Math.sin(i) + Math.cos(a) * Math.cos(i) * Math.cos(r)));
  return [EARTH * k * Math.cos(i) * Math.sin(r), EARTH * k * (Math.cos(a) * Math.sin(i) - Math.sin(a) * Math.cos(i) * Math.cos(r))];
}
const proj = { lon0: cfg.lon0, lat0: cfg.lat0, xmin: -pxW / 2 / pxPerKm, ymax: pxH / 2 / pxPerKm, pxPerKm };
const P = (lon, lat) => { const [x, y] = lam(lon, lat); return [(x - proj.xmin) * pxPerKm, (proj.ymax - y) * pxPerKm]; };
const N = cols * rows;
const center = (i) => { const c = i % cols, r = (i / cols) | 0; return [W / 2 + c * W + (r & 1 ? W / 2 : 0), R + r * RH]; };
function hexAt(x, y) {
  const px = x - W / 2, py = y - R;
  const q = ((Math.sqrt(3) / 3) * px - py / 3) / R, rr = ((2 / 3) * py) / R;
  let cx = Math.round(q), cz = Math.round(rr), cy = Math.round(-q - rr);
  const dx = Math.abs(cx - q), dz = Math.abs(cz - rr), dy = Math.abs(cy - (-q - rr));
  if (dx > dy && dx > dz) cx = -cy - cz; else if (dy > dz) cy = -cx - cz; else cz = -cx - cy;
  const row = cz, col = cx + (cz - (cz & 1)) / 2;
  return col < 0 || row < 0 || col >= cols || row >= rows ? -1 : row * cols + col;
}
function nbrs(i) {
  const c = i % cols, r = (i / cols) | 0, odd = r & 1;
  const d = odd ? [[1, 0], [1, -1], [0, -1], [-1, 0], [0, 1], [1, 1]] : [[1, 0], [0, -1], [-1, -1], [-1, 0], [-1, 1], [0, 1]];
  const out = [];
  for (const [dc, dr] of d) { const cc = c + dc, rr = r + dr; if (cc >= 0 && rr >= 0 && cc < cols && rr < rows) out.push(rr * cols + cc); }
  return out;
}
// --- лон/лат bbox карты (с запасом)
const corners = [];
for (let x = 0; x <= pxW; x += pxW / 8) for (const y of [0, pxH]) corners.push([x, y]);
const inv = (x, y) => { // грубая обратная проекция бисекцией не нужна — перебор сетки
  return null;
};
let bb = [999, 999, -999, -999];
for (let lon = cfg.lon0 - 8; lon <= cfg.lon0 + 8; lon += 0.05) for (let lat = cfg.lat0 - 6; lat <= cfg.lat0 + 6; lat += 0.05) {
  const [x, y] = P(lon, lat);
  if (x >= -40 && y >= -40 && x <= pxW + 40 && y <= pxH + 40) { bb[0] = Math.min(bb[0], lon); bb[1] = Math.min(bb[1], lat); bb[2] = Math.max(bb[2], lon); bb[3] = Math.max(bb[3], lat); }
}
const inBB = (c) => c[0] >= bb[0] && c[0] <= bb[2] && c[1] >= bb[1] && c[1] <= bb[3];
const geo = (f) => JSON.parse(fs.readFileSync(path.join(D, f), 'utf8'));
// --- растр классов: 1 суша, 0 море, 2 озеро
function polysOf(g, filt) {
  const out = [];
  for (const ft of g.features) {
    if (filt && !filt(ft.properties || {})) continue;
    const gm = ft.geometry; if (!gm) continue;
    const ps = gm.type === 'Polygon' ? [gm.coordinates] : gm.type === 'MultiPolygon' ? gm.coordinates : [];
    for (const p of ps) {
      let x0 = 999, y0 = 999, x1 = -999, y1 = -999;
      for (const [x, y] of p[0]) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      if (x1 >= bb[0] && x0 <= bb[2] && y1 >= bb[1] && y0 <= bb[3]) out.push(p);
    }
  }
  return out;
}
const svgPath = (polys) => polys.map((p) => p.map((ring) => 'M' + ring.map(([lo, la]) => P(lo, la).map((v) => v.toFixed(1)).join(',')).join('L') + 'Z').join('')).join('');
async function raster(svgBody) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${pxW}" height="${pxH}" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="#000"/>${svgBody}</svg>`;
  const { data } = await sharp(Buffer.from(svg)).greyscale().raw().toBuffer({ resolveWithObject: true });
  return data;
}
(async () => {
  const land = polysOf(geo('ne_10m_land.geojson'));
  const lakeOk = (pr) => (cfg.lakes || []).some((n) => (pr.name || '').includes(n) || (pr.name_en || '').includes(n));
  const lakes = polysOf(geo('ne_10m_lakes.geojson'), lakeOk).concat(polysOf(geo('ne_10m_lakes_europe.geojson'), lakeOk));
  const landR = await raster(`<path d="${svgPath(land)}" fill="#fff" fill-rule="evenodd"/>`);
  const lakeR = lakes.length ? await raster(`<path d="${svgPath(lakes)}" fill="#fff" fill-rule="evenodd"/>`) : null;
  const cls = new Uint8Array(pxW * pxH);
  for (let i = 0; i < cls.length; i++) cls[i] = landR[i] > 127 ? (lakeR && lakeR[i] > 127 ? 2 : 1) : 0;
  // --- гексы: доля воды
  const water = new Float32Array(N), cnt = new Float32Array(N), lakeF = new Float32Array(N);
  for (let y = 0; y < pxH; y++) for (let x = 0; x < pxW; x++) {
    const h = hexAt(x + 0.5, y + 0.5); if (h < 0) continue;
    cnt[h]++; const c = cls[y * pxW + x]; if (c !== 1) water[h]++; if (c === 2) lakeF[h]++;
  }
  // --- шум
  const hash = (a, b, s) => { let h = (a * 374761393 + b * 668265263 + s * 2147483647) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
  const smooth = (x, y, s, sc) => { // value noise
    const fx = x / sc, fy = y / sc, x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0;
    const u = tx * tx * (3 - 2 * tx), v = ty * ty * (3 - 2 * ty);
    const a = hash(x0, y0, s), b = hash(x0 + 1, y0, s), c = hash(x0, y0 + 1, s), d = hash(x0 + 1, y0 + 1, s);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
  const inPoly = (pt, poly) => { let ins = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, yi] = poly[i], [xj, yj] = poly[j]; if ((yi > pt[1]) !== (yj > pt[1]) && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi) ins = !ins; } return ins; };
  const projPoly = (pl) => pl.map(([lo, la]) => P(lo, la));
  const zones = (cfg.zones || []).map((z) => ({ ...z, pp: projPoly(z.poly) }));
  // --- реки
  const rivSrc = [];
  for (const f of cfg.riverFiles || ['ne_10m_rivers_europe.geojson', 'ne_10m_rivers_lake_centerlines.geojson']) {
    for (const ft of geo(f).features) {
      const pr = ft.properties || {}, gm = ft.geometry; if (!gm) continue;
      const lines = gm.type === 'LineString' ? [gm.coordinates] : gm.type === 'MultiLineString' ? gm.coordinates : [];
      const nm = pr.name || pr.name_en || '';
      const spec = (cfg.rivers || []).find((r) => r.ne.some((n) => n === nm));
      const sr = pr.scalerank ?? 99;
      if (!spec && !(cfg.unnamedMaxSr && !nm && sr <= cfg.unnamedMaxSr)) continue;
      if (spec && spec.files && !spec.files.includes(f)) continue;
      for (const l of lines) if (l.some(inBB)) rivSrc.push({ n: spec ? spec.name : '', w: spec ? spec.w : 1, pts: l, f });
    }
  }
  const extra = (cfg.extraRivers || []).map((r) => ({ n: r.name, w: r.w || 1, pts: r.pts }));
  const rivers = [], riverEdges = new Set(), rivHex = new Uint8Array(N);
  for (const r of [...rivSrc, ...extra]) {
    const pp = r.pts.map(([lo, la]) => P(lo, la));
    // обрезка по карте с запасом
    const keep = pp.filter(([x, y]) => x > -30 && y > -30 && x < pxW + 30 && y < pxH + 30);
    if (keep.length < 2) continue;
    const simp = [keep[0]];
    for (const q of keep.slice(1)) { const l = simp[simp.length - 1]; if (Math.hypot(q[0] - l[0], q[1] - l[1]) >= 2.2) simp.push(q); }
    if (simp.length < 2) continue;
    rivers.push({ n: r.n, w: r.w, p: simp.flatMap(([x, y]) => [+x.toFixed(1), +y.toFixed(1)]) });
    let prev = -1;
    for (let k = 0; k + 1 < simp.length; k++) {
      const [x0, y0] = simp[k], [x1, y1] = simp[k + 1], n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 1.5));
      for (let t = 0; t <= n; t++) {
        const h = hexAt(x0 + ((x1 - x0) * t) / n, y0 + ((y1 - y0) * t) / n);
        if (h >= 0) rivHex[h] = Math.max(rivHex[h], r.w);
        if (h >= 0 && prev >= 0 && h !== prev && nbrs(prev).includes(h)) riverEdges.add(Math.min(h, prev) * N + Math.max(h, prev));
        if (h >= 0) prev = h;
      }
    }
  }
  // --- рельеф
  const terrain = new Uint8Array(N);
  const B = cfg.base || { forest: 0.2, hills: 0.05, marsh: 0.03 };
  const NF = new Float32Array(N), NH = new Float32Array(N), NM = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const [x, y] = center(i);
    NF[i] = smooth(x, y, 11, 70) * 0.65 + hash(i, 1, 3) * 0.35;
    NH[i] = smooth(x, y, 23, 90) * 0.6 + hash(i, 2, 5) * 0.4;
    NM[i] = smooth(x, y, 37, 60) * 0.5 + hash(i, 3, 7) * 0.5;
  }
  const unif = (A) => { const idx = [...A.keys()].sort((a, b) => A[a] - A[b]); const U = new Float32Array(N); idx.forEach((k, r) => (U[k] = (r + 0.5) / N)); return U; };
  const UF = unif(NF), UH = unif(NH), UM = unif(NM);
  for (let i = 0; i < N; i++) {
    const wf = water[i] / Math.max(1, cnt[i]);
    if (wf > 0.55) { terrain[i] = lakeF[i] > water[i] * 0.5 ? 1 : 0; continue; }
    const [x, y] = center(i);
    let pf = B.forest, ph = B.hills, pm = B.marsh;
    for (const z of zones) if (inPoly([x, y], z.pp)) { if (z.forest != null) pf = z.forest; if (z.hills != null) ph = z.hills; if (z.marsh != null) pm = z.marsh; }
    if (rivHex[i] && cfg.riverForest) pf = Math.min(0.9, pf + cfg.riverForest);
    if (rivHex[i] && cfg.riverMarsh) pm = Math.min(0.9, pm + cfg.riverMarsh);
    terrain[i] = UM[i] > 1 - pm ? 6 : UH[i] > 1 - ph ? 4 : UF[i] > 1 - pf ? 3 : 2;
  }
  for (const o of cfg.terrainOverrides || []) { const h = hexAt(...P(o.lon, o.lat)); if (h >= 0) terrain[h] = o.t; }
  // --- города
  const cities = [];
  const used = new Map();
  for (const c of cfg.cities) {
    const [x, y] = P(c.lon, c.lat);
    let h = c.hex != null ? c.hex : hexAt(x, y);
    if (h < 0) { console.warn('city off map', c.name); continue; }
    if (used.has(h)) { console.warn('city hex clash', c.name, 'with', used.get(h)); continue; }
    used.set(h, c.name);
    if (terrain[h] < 2) terrain[h] = 2;
    if (c.vp >= 3) terrain[h] = 7;
    cities.push({ name: c.name, hex: h, x: +x.toFixed(1), y: +y.toFixed(1), vp: c.vp, hub: !!c.hub, port: !!c.port, cap: !!c.cap, nat: '' });
  }
  // --- принадлежность
  const nations = cfg.nations || ['', 'GER', 'SOV'];
  const owner = new Array(N).fill(0);
  const fronts = (cfg.owners || []).map((o) => ({ idx: nations.indexOf(o.nat), pp: projPoly(o.poly) }));
  const def = nations.indexOf(cfg.defaultOwner || 'SOV');
  for (let i = 0; i < N; i++) {
    if (terrain[i] < 2) { owner[i] = 0; continue; }
    const c = center(i);
    let o = def;
    for (const f of fronts) if (inPoly(c, f.pp)) o = f.idx;
    owner[i] = o;
  }
  for (const o of cfg.ownerOverrides || []) { const h = hexAt(...P(o.lon, o.lat)); if (h >= 0) owner[h] = nations.indexOf(o.nat); }
  for (const c of cities) c.nat = nations[owner[c.hex]] || '';
  // --- RLE cls
  let rle = '', cur = cls[0], run = 0;
  for (let i = 0; i < cls.length; i++) { if (cls[i] === cur) run++; else { rle += cur + run.toString(36) + '.'; cur = cls[i]; run = 1; } }
  rle += cur + run.toString(36) + '.';
  const out = { proj, cols, rows, R, w: pxW, h: pxH, nations, terrain: Array.from(terrain).join(''), owner, cities, rivers, riverEdges: [...riverEdges].map((k) => [Math.floor(k / N), k % N]), cls: rle };
  fs.writeFileSync(path.join(__dirname, '..', 'src', 'data', `map_${id}.json`), JSON.stringify(out));
  const tc = {}; for (const t of terrain) tc[t] = (tc[t] || 0) + 1;
  console.log(id, `${pxW}x${pxH}`, 'terrain', JSON.stringify(tc), 'rivers', rivers.length, 'edges', riverEdges.size, 'cities', cities.length);
  // --- превью
  const col = ['#28567f', '#3b78ab', '#c9c28f', '#5f7f3f', '#a08a5a', '#8a7a6a', '#6f8f7f', '#aaaaaa'];
  let svg = '';
  for (let i = 0; i < N; i++) {
    const [x, y] = center(i);
    const pts = [0, 1, 2, 3, 4, 5].map((k) => { const a = (Math.PI / 180) * (60 * k - 30); return (x + R * Math.cos(a)).toFixed(1) + ',' + (y + R * Math.sin(a)).toFixed(1); }).join(' ');
    svg += `<polygon points="${pts}" fill="${col[terrain[i]]}" stroke="${owner[i] === 1 ? '#333' : owner[i] === 2 ? '#c33' : '#777'}" stroke-width="${owner[i] === 1 ? 2 : 1}"/>`;
    if (owner[i] === 1) svg += `<circle cx="${x}" cy="${y}" r="2" fill="#222"/>`;
  }
  for (const r of rivers) svg += `<polyline points="${r.p.join(' ')}" fill="none" stroke="#1d5fae" stroke-width="${r.w}"/>`;
  for (const c of cities) { const [x, y] = center(c.hex); svg += `<rect x="${x - 3}" y="${y - 3}" width="6" height="6" fill="${c.nat === 'GER' ? '#000' : '#c00'}"/><text x="${x + 5}" y="${y - 4}" font-size="9" font-family="Arial" fill="#000">${c.name} ${c.vp}</text>`; }
  for (let i = 0; i < N; i++) if (i % cols === 0 || ((i / cols) | 0) === 0) { const [x, y] = center(i); svg += `<text x="${x - 6}" y="${y + 3}" font-size="7" fill="#fff">${i % cols},${(i / cols) | 0}</text>`; }
  const full = `<svg xmlns="http://www.w3.org/2000/svg" width="${pxW}" height="${pxH}"><rect width="100%" height="100%" fill="#fff"/>${svg}</svg>`;
  fs.mkdirSync(path.join(__dirname, 'shots'), { recursive: true });
  await sharp(Buffer.from(full)).png().toFile(path.join(__dirname, 'shots', `map_${id}.png`));
})();
