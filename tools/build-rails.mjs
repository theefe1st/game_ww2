// «Восточный фронт» (v0.11): железные дороги и посёлки для карты — src/east/data/rails.json.
// node tools/build-rails.mjs [--world] (v0.12: большая карта — world-rails.json). Данные: Natural Earth (ne_10m_railroads — магистрали scalerank ≤ 7,
// ne_10m_populated_places — посёлки без подписей, точками). Проекция — как у map.json (src/east/mapdata.js).
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { makeProj } from '../src/east/mapdata.js';

const HERE = path.dirname(fileURLToPath(import.meta.url)), D = path.join(HERE, 'data');
// --world: большая карта (world.json → world-rails.json)
const WORLD = process.argv.includes('--world'), IN = WORLD ? 'world.json' : 'map.json', OUTF = WORLD ? 'world-rails.json' : 'rails.json';
const MAP = JSON.parse(fs.readFileSync(path.join(HERE, '..', 'src', 'east', 'data', IN), 'utf8'));
const P = makeProj(MAP.proj), W = MAP.w, H = MAP.h;
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
function encPts(pts, unit = 0.5) {
  let s = '', px = 0, py = 0;
  const put = (v) => { let z = v < 0 ? -2 * v - 1 : 2 * v; do { const c = z & 31; z >>>= 5; s += B64[c | (z ? 32 : 0)]; } while (z); };
  for (const [x, y] of pts) { const qx = Math.round(x / unit), qy = Math.round(y / unit); put(qx - px); put(qy - py); px = qx; py = qy; }
  return s;
}
// упрощение Дугласа — Пекера
function dp(pts, eps) {
  if (pts.length < 3) return pts;
  const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1;
  const st = [[0, pts.length - 1]];
  while (st.length) {
    const [a, b] = st.pop();
    const [ax, ay] = pts[a], [bx, by] = pts[b], dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy) || 1;
    let md = -1, mi = -1;
    for (let i = a + 1; i < b; i++) { const d = Math.abs((pts[i][0] - ax) * dy - (pts[i][1] - ay) * dx) / L; if (d > md) (md = d), (mi = i); }
    if (md > eps) { keep[mi] = 1; st.push([a, mi], [mi, b]); }
  }
  return pts.filter((_, i) => keep[i]);
}
const inside = ([x, y], m = 30) => x > -m && y > -m && x < W + m && y < H + m;
// суша карты: точки в море не нужны (паромы)
const RR = JSON.parse(fs.readFileSync(path.join(D, 'ne_10m_railroads.geojson'), 'utf8'));
const lines = [];
for (const f of RR.features) {
  const g = f.geometry, p = f.properties;
  if (!g || p.scalerank > 7 || p.featurecla !== 'Railroad') continue;
  const L = g.type === 'LineString' ? [g.coordinates] : g.coordinates;
  for (const l of L) {
    let cur = [];
    for (const [lon, lat] of l) {
      const q = P(lon, lat);
      if (inside(q)) cur.push(q);
      else { if (cur.length > 1) lines.push({ k: p.scalerank <= 5 ? 1 : 0, p: cur }); cur = []; }
    }
    if (cur.length > 1) lines.push({ k: p.scalerank <= 5 ? 1 : 0, p: cur });
  }
}
// склейка концов (одна магистраль из многих кусков) и упрощение
const key = ([x, y]) => `${Math.round(x / 2)}:${Math.round(y / 2)}`;
let merged = lines.map((l) => ({ ...l, p: dp(l.p, 1.2) }));
for (let pass = 0; pass < 3; pass++) {
  const ends = new Map();
  for (const l of merged) for (const e of [key(l.p[0]), key(l.p[l.p.length - 1])]) (ends.get(e) || ends.set(e, []).get(e)).push(l);
  const used = new Set(), out = [];
  for (const l of merged) {
    if (used.has(l)) continue;
    used.add(l);
    let p = l.p.slice();
    for (let side = 0; side < 2; side++) {
      for (;;) {
        const e = key(p[p.length - 1]), c = (ends.get(e) || []).filter((m) => !used.has(m) && m.k === l.k);
        if ((ends.get(e) || []).length !== 2 || !c.length) break;
        const m = c[0]; used.add(m);
        const q = key(m.p[0]) === e ? m.p : m.p.slice().reverse();
        p = p.concat(q.slice(1));
      }
      p.reverse();
    }
    out.push({ k: l.k, p });
  }
  merged = out;
}
merged = merged.map((l) => ({ ...l, p: dp(l.p, 2.2) })).filter((l) => { let s = 0; for (let i = 1; i < l.p.length; i++) s += Math.hypot(l.p[i][0] - l.p[i - 1][0], l.p[i][1] - l.p[i - 1][1]); return s > 12; });
// посёлки: населённые пункты Natural Earth, не ближе 28 км к городам карты и друг к другу
const PP = JSON.parse(fs.readFileSync(path.join(D, 'ne_10m_populated_places.geojson'), 'utf8'));
const have = MAP.cities.map(([, x, y]) => [x, y]), towns = [];
const near = (q, arr, d) => arr.some(([x, y]) => Math.abs(x - q[0]) < d && Math.abs(y - q[1]) < d && Math.hypot(x - q[0], y - q[1]) < d);
const places = PP.features.map((f) => ({ q: P(...f.geometry.coordinates), r: f.properties.SCALERANK ?? f.properties.scalerank ?? 9 })).filter((o) => inside(o.q, -5)).sort((a, b) => a.r - b.r);
for (const o of places) { if (near(o.q, have, 28) || near(o.q, towns, 26)) continue; towns.push(o.q); }
const out = { v: 1, r: merged.map((l) => [l.k, encPts(l.p)]), t: encPts(towns) };
fs.writeFileSync(path.join(HERE, '..', 'src', 'east', 'data', OUTF), JSON.stringify(out));
const npts = merged.reduce((s, l) => s + l.p.length, 0);
console.log(`ж/д: ${merged.length} линий, ${npts} точек (из ${lines.length} кусков); посёлков: ${towns.length}; файл ${(JSON.stringify(out).length / 1024).toFixed(0)} КБ`);
