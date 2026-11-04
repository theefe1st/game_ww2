// «Фронт 1941–1945» (v0.9): карта Европы на 22 июня 1941 г. в гексах ≈ 40 км (Natural Earth).
// node tools/build-eumap.mjs [--preview]  → src/data/eu41.json (+ tools/shots/eu41_*.png)
// Данные: bash tools/get-ne-data.sh (+ ne_50m_admin_0_countries, ne_10m_populated_places, ne_10m_railroads — скачиваются здесь)
// Рельеф, реки и полигоны границ берутся из tools/build-europe.mjs (v0.6), экономические регионы — из src/europe/regions.js.
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { REGIONS } from '../src/europe/regions.js';
import { makeGrid, hexXY, nbDir, hexAtXY, hexLine, hexDist, SQ3 } from '../src/barb/hex.js';
import { CITY41, RENAME41 } from './eu41-cities.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url)), D = path.join(HERE, 'data');
for (const f of ['ne_50m_admin_0_countries', 'ne_10m_populated_places', 'ne_10m_railroads'])
  fs.existsSync(path.join(D, f + '.geojson')) ||
    execSync(`curl -s -o ${path.join(D, f + '.geojson')} https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/${f}.geojson`);
const geo = (f) => JSON.parse(fs.readFileSync(path.join(D, f), 'utf8'));
// ——— общие данные из build-europe.mjs (v0.6) ———
const SRC = fs.readFileSync(path.join(HERE, 'build-europe.mjs'), 'utf8');
function grab(from, open = '[') {
  const i = SRC.indexOf(from);
  if (i < 0) throw new Error('нет ' + from);
  const s = SRC.indexOf(open, i + from.length - 1), close = open === '[' ? ']' : '}';
  let d = 0;
  for (let j = s; j < SRC.length; j++) {
    const c = SRC[j];
    c === open ? d++ : c === close && d--;
    if (!d) return SRC.slice(s, j + 1);
  }
}
const RELIEF = Function('return ' + grab('const RELIEF = ['))();
const POLY = Function('return ' + grab('const POLY = {', '{'))();
const MAJOR = new Set(Function('return ' + grab('const MAJOR = new Set(['))());
const MINOR = new Set(Function('return ' + grab('const MINOR = new Set(['))());
const biome = Function('lon', 'lat', grab('function biome(lon, lat) {', '{').slice(1, -1));

// ——— проекция (равновеликая Ламберта) и сетка ———
const PROJ = { lon0: 24, lat0: 52 };
const KM = 40; // шаг гексов (между центрами соседей), км
const RE = 6371, DEG = Math.PI / 180, s0 = Math.sin(PROJ.lat0 * DEG), c0 = Math.cos(PROJ.lat0 * DEG);
function fwd(lon, lat) {
  const l = (lon - PROJ.lon0) * DEG, f = lat * DEG, k = Math.sqrt(2 / (1 + s0 * Math.sin(f) + c0 * Math.cos(f) * Math.cos(l)));
  return [RE * k * Math.cos(f) * Math.sin(l), RE * k * (c0 * Math.sin(f) - s0 * Math.cos(f) * Math.cos(l))];
}
function inv(x, y) {
  const rho = Math.hypot(x, y);
  if (rho < 1e-9) return [PROJ.lon0, PROJ.lat0];
  const c = 2 * Math.asin(Math.min(1, rho / (2 * RE))), sc = Math.sin(c), cc = Math.cos(c);
  return [PROJ.lon0 + Math.atan2(x * sc, rho * c0 * cc - y * s0 * sc) / DEG, Math.asin(cc * s0 + (y * sc * c0) / rho) / DEG];
}
const EDGE = [[-10.8, 37], [-10.8, 52], [-8, 57], [-5, 60.5], [51.2, 57.5], [51.2, 41], [48.5, 38.5], [28, 71.4], [42, 68.8], [5, 64], [24, 34.6], [34, 34.9], [12, 36.2]];
let XMIN = 1e9, XMAX = -1e9, YMIN = 1e9, YMAX = -1e9;
for (const [lo, la] of EDGE) {
  const [x, y] = fwd(lo, la);
  (XMIN = Math.min(XMIN, x)), (XMAX = Math.max(XMAX, x)), (YMIN = Math.min(YMIN, y)), (YMAX = Math.max(YMAX, y));
}
const RK = KM / SQ3; // радиус гекса, км
const COLS = Math.ceil((XMAX - XMIN) / KM), ROWS = Math.ceil((YMAX - YMIN - 2 * RK) / (1.5 * RK)) + 1;
const G = makeGrid(COLS, ROWS, RK), N = G.n;
const toG = (lon, lat) => { const [x, y] = fwd(lon, lat); return [x - XMIN, YMAX - y]; }; // км сетки (y вниз)
const fromG = (gx, gy) => inv(gx + XMIN, YMAX - gy);
const hexLL = (lon, lat) => { const [x, y] = toG(lon, lat); return hexAtXY(G, x, y); };
console.log(`сетка ${COLS} × ${ROWS} = ${N} гексов, ${(G.pxW | 0)} × ${(G.pxH | 0)} км`);

// ——— растр 4 км для суши, озёр, стран и рельефа ———
const KP = 4, RW = Math.ceil(G.pxW / KP), RH = Math.ceil(G.pxH / KP), RN = RW * RH;
const BB = [-30, 25, 75, 80];
function ringsOf(gm) {
  const ps = gm.type === 'Polygon' ? [gm.coordinates] : gm.type === 'MultiPolygon' ? gm.coordinates : [];
  const out = [];
  for (const p of ps) {
    let x0 = 999, y0 = 999, x1 = -999, y1 = -999;
    for (const [x, y] of p[0]) (x0 = Math.min(x0, x)), (x1 = Math.max(x1, x)), (y0 = Math.min(y0, y)), (y1 = Math.max(y1, y));
    if (x1 < BB[0] || x0 > BB[2] || y1 < BB[1] || y0 > BB[3]) continue;
    for (const ring of p) out.push(ring.map(([lo, la]) => { const [x, y] = toG(lo, la); return [x / KP, y / KP]; }));
  }
  return out;
}
function fill(rings, cb) {
  const rows = Array.from({ length: RH }, () => []);
  for (const r of rings) {
    const n = r.length;
    for (let i = 0; i < n; i++) {
      let p = r[i], q = r[(i + 1) % n];
      if (p[1] === q[1]) continue;
      if (p[1] > q[1]) [p, q] = [q, p];
      const ya = Math.max(0, Math.ceil(p[1] - 0.5)), yb = Math.min(RH - 1, Math.ceil(q[1] - 0.5) - 1);
      for (let y = ya; y <= yb; y++) rows[y].push(p[0] + ((y + 0.5 - p[1]) * (q[0] - p[0])) / (q[1] - p[1]));
    }
  }
  for (let y = 0; y < RH; y++) {
    const xs = rows[y];
    if (xs.length < 2) continue;
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const xa = Math.max(0, Math.ceil(xs[k] - 0.5)), xb = Math.min(RW - 1, Math.ceil(xs[k + 1] - 0.5) - 1);
      for (let x = xa; x <= xb; x++) cb(y * RW + x);
    }
  }
}
const cls = new Uint8Array(RN); // 0 море, 1 суша, 2 озеро
for (const ft of geo('ne_10m_land.geojson').features) ft.geometry && fill(ringsOf(ft.geometry), (i) => (cls[i] = cls[i] ? 0 : 1));
const lakeOk = (p) => p.featurecla !== 'Reservoir' && !/Reservoir|Vodokhranilishche|vdkhr|Vdkhr/i.test(p.name || '');
for (const ft of geo('ne_10m_lakes.geojson').features)
  ft.geometry && lakeOk(ft.properties || {}) && fill(ringsOf(ft.geometry), (i) => cls[i] === 1 && (cls[i] = 2));
const CTY = [], cty = new Int16Array(RN).fill(-1);
for (const ft of geo('ne_50m_admin_0_countries.geojson').features) {
  if (!ft.geometry) continue;
  const id = CTY.push(ft.properties.ADM0_A3) - 1;
  fill(ringsOf(ft.geometry), (i) => (cty[i] = id));
}
const rel = new Uint8Array(RN), RKc = { m: 5, h: 4, w: 6, g: 2, s: 7 };
for (const [k, p] of RELIEF) fill(ringsOf({ type: 'Polygon', coordinates: [p] }), (i) => (rel[i] = RKc[k]));
// дополнительный рельеф для Восточного фронта: Валдай, Среднерусская возвышенность (холмы), Донецкий кряж, леса
const EXTRA = [
  ['h', [[35.2, 53.6], [37.8, 53.9], [38.6, 52.6], [38.4, 51.2], [37.4, 50.4], [36.0, 50.8], [35.6, 52.2]]],
  ['h', [[37.6, 48.6], [39.6, 48.9], [40.4, 48.3], [38.6, 47.9], [37.6, 48.1]]],
  ['h', [[43.6, 51.4], [45.6, 51.6], [46.0, 50.0], [45.0, 49.0], [44.2, 49.6]]],
  ['h', [[41.6, 45.6], [43.6, 45.4], [43.8, 44.4], [42.2, 44.4], [41.4, 44.9]]],
];
for (const [k, p] of EXTRA) fill(ringsOf({ type: 'Polygon', coordinates: [p] }), (i) => !rel[i] && (rel[i] = RKc[k]));

// ——— гексы: выборка 19 точек ———
const SAMP = [[0, 0]];
for (let k = 0; k < 6; k++) SAMP.push([0.48 * RK * Math.cos((k * 60 + 30) * DEG), 0.48 * RK * Math.sin((k * 60 + 30) * DEG)]);
for (let k = 0; k < 12; k++) SAMP.push([0.84 * RK * Math.cos(k * 30 * DEG), 0.84 * RK * Math.sin(k * 30 * DEG)]);
const rAt = (gx, gy) => { const x = Math.floor(gx / KP), y = Math.floor(gy / KP); return x < 0 || y < 0 || x >= RW || y >= RH ? -1 : y * RW + x; };
function hash(x, y, s) { let t = Math.sin(x * 12.9898 + y * 78.233 + s * 37.719) * 43758.5453; return t - Math.floor(t); }
function vnoise(x, y, s) {
  const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi;
  const a = hash(xi, yi, s), b = hash(xi + 1, yi, s), c = hash(xi, yi + 1, s), d = hash(xi + 1, yi + 1, s);
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
const fbm = (x, y, s) => 0.6 * vnoise(x, y, s) + 0.3 * vnoise(x * 2.1, y * 2.1, s + 7) + 0.1 * vnoise(x * 4.3, y * 4.3, s + 13);
// лесистость по зонам (0–1): Белоруссия, Смоленщина, Брянские леса, север — леса; степь Украины и Дона — почти без леса
function forestK(lon, lat) {
  if (lat > 60.5 || (lon > 27 && lat > 57.8) || (lon > 45 && lat > 56.6)) return 0.78;
  if (lon > 23 && lon < 41 && lat > 52 && lat <= 57.8) return lat > 55.5 && lon > 34 ? 0.5 : 0.6;
  if (lon > 33 && lon < 36 && lat > 52.5 && lat < 54.5) return 0.75;
  if (lon > 41 && lat > 53) return 0.45;
  if (lon > 22 && lat > 50.6 && lat <= 52) return 0.4;
  if (lon > 28 && lat <= 50.6) return lat > 49.6 ? 0.18 : 0.04;
  if (lon > 41 && lat <= 53) return 0.06;
  if (lat > 55 && lon > 10 && lon < 23) return 0.35;
  return 0.28;
}
const terr = new Uint8Array(N), hcty = new Int16Array(N).fill(-1), hlon = new Float32Array(N), hlat = new Float32Array(N);
for (let i = 0; i < N; i++) {
  const [cx, cy] = hexXY(G, i), [lo, la] = fromG(cx, cy);
  (hlon[i] = lo), (hlat[i] = la);
  let land = 0, lake = 0, n = 0;
  const cv = new Map(), rv = new Map();
  for (const [dx, dy] of SAMP) {
    const r = rAt(cx + dx, cy + dy);
    if (r < 0) continue;
    n++;
    const c = cls[r];
    if (c === 1) {
      land++;
      cty[r] >= 0 && cv.set(cty[r], (cv.get(cty[r]) || 0) + 1);
      rel[r] && rv.set(rel[r], (rv.get(rel[r]) || 0) + 1);
    } else if (c === 2) lake++;
  }
  if (!n || land + lake < 0.45 * n) { terr[i] = 0; continue; }
  if (lake >= 0.5 * n) { terr[i] = 1; continue; }
  let bc = -1, bn = 0;
  for (const [k, v] of cv) v > bn && ((bn = v), (bc = k));
  hcty[i] = bc;
  let br = 0, brn = 0;
  for (const [k, v] of rv) v > brn && ((brn = v), (br = k));
  const b = biome(lo, la), nz = fbm(cx / 110, cy / 110, 3), nz2 = fbm(cx / 70, cy / 70, 11);
  let t = 2;
  if (br && brn >= 0.34 * land && br !== 2) t = br;
  else if (b === 11) t = nz2 > 0.55 ? 6 : 8;
  else if (b === 8) t = 7;
  else if (b === 9) t = nz > 0.86 ? 3 : 7;
  else if (b === 10) t = nz2 > 0.72 ? 6 : 3;
  else if (b === 12) t = nz > 0.6 ? 4 : 2;
  else t = nz < forestK(lo, la) ? 3 : nz2 > 0.83 && la > 51 && lo > 20 ? 6 : 2;
  terr[i] = t;
}
// суша без страны → ближайшая страна
{
  let q = [];
  for (let i = 0; i < N; i++) terr[i] >= 2 && hcty[i] >= 0 && q.push(i);
  while (q.length) {
    const nq = [];
    for (const i of q) for (let d = 0; d < 6; d++) { const j = nbDir(G, i, d); j >= 0 && terr[j] >= 2 && hcty[j] < 0 && ((hcty[j] = hcty[i]), nq.push(j)); }
    q = nq;
  }
}

// ——— владельцы на 22.06.1941 ———
const NAT = ['', 'GER', 'SOV', 'FIN', 'ROM', 'HUN', 'ITA', 'SVK', 'BUL', 'CRO', 'VIC', 'SWE', 'TUR', 'ESP', 'POR', 'SUI', 'UK', 'IRL', 'IRN', 'AFR'];
const NI = Object.fromEntries(NAT.map((k, i) => [k, i]));
function inPoly(lon, lat, P) {
  let c = false;
  for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
    const [xi, yi] = P[i], [xj, yj] = P[j];
    yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi && (c = !c);
  }
  return c;
}
const lerp = (pts, v) => { // pts [[v, x]], по возрастанию v
  if (v <= pts[0][0]) return pts[0][1];
  for (let k = 1; k < pts.length; k++) if (v <= pts[k][0]) { const [a, x0] = pts[k - 1], [b, x1] = pts[k]; return x0 + ((v - a) * (x1 - x0)) / (b - a); }
  return pts[pts.length - 1][1];
};
// линия разграничения 1939 г. на территории довоенной Польши: к востоку — СССР
const LINE_N = [[52.0, 23.6], [52.35, 23.0], [52.75, 22.15], [53.2, 21.95], [54.0, 22.3], [54.5, 22.6]];
const LINE_S = [[49.0, 22.6], [49.2, 22.4], [49.45, 22.15], [49.6, 22.3], [49.78, 22.77], [50.0, 22.8], [50.3, 23.4], [50.5, 24.1]];
const NTRANS = [[22.0, 48.1], [21.9, 47.4], [21.85, 46.95], [22.6, 46.85], [23.4, 46.62], [24.0, 46.58], [24.6, 46.4], [25.1, 46.15], [25.6, 45.8], [26.0, 45.72], [26.45, 45.95], [26.1, 46.5], [25.85, 47.1], [25.3, 47.35], [24.9, 47.75], [24.4, 47.95], [23.5, 48.1], [22.9, 48.1]];
const SOVPL = (lo, la) => (la >= 52.0 && la < 54.6 && lo > lerp(LINE_N, la)) || (la < 50.5 && la > 48.9 && lo > lerp(LINE_S, la));
function owner41(c, lo, la) {
  const SIMPLE = {
    DEU: 'GER', AUT: 'GER', CZE: 'GER', LUX: 'GER', NLD: 'GER', BEL: 'GER', DNK: 'GER', NOR: 'GER', LVA: 'SOV', EST: 'SOV', BLR: 'SOV', MDA: 'SOV',
    HUN: 'HUN', BGR: 'BUL', FIN: 'FIN', ITA: 'ITA', ALB: 'ITA', SMR: 'ITA', VAT: 'ITA', MNE: 'ITA', KOS: 'ITA', HRV: 'CRO', BIH: 'CRO', SWE: 'SWE',
    TUR: 'TUR', ESP: 'ESP', AND: 'ESP', PRT: 'POR', CHE: 'SUI', LIE: 'SUI', GBR: 'UK', IMN: 'UK', IRL: 'IRL', CYP: 'UK', CYN: 'UK', MLT: 'UK',
    IRN: 'IRN', GEO: 'SOV', ARM: 'SOV', AZE: 'SOV', KAZ: 'SOV', TKM: 'SOV', UZB: 'SOV', MCO: 'VIC', FRO: 'GER', ALA: 'FIN',
    SYR: 'AFR', IRQ: 'AFR', LBN: 'AFR', ISR: 'AFR', PSX: 'AFR', JOR: 'AFR', EGY: 'AFR', LBY: 'AFR', TUN: 'AFR', DZA: 'AFR', MAR: 'AFR', SAH: 'AFR',
  };
  if (c === 'RUS') return inPoly(lo, la, POLY.KALI) ? 'GER' : inPoly(lo, la, POLY.PETS) ? 'FIN' : 'SOV';
  if (c === 'POL') return inPoly(lo, la, POLY.POL39) && SOVPL(lo, la) ? 'SOV' : 'GER';
  if (c === 'LTU') return inPoly(lo, la, POLY.MEM) ? 'GER' : 'SOV';
  if (c === 'UKR') return inPoly(lo, la, POLY.ZAK) ? 'HUN' : 'SOV';
  if (c === 'ROU') return inPoly(lo, la, NTRANS) ? 'HUN' : 'ROM';
  if (c === 'SVK') return inPoly(lo, la, POLY.SSK) ? 'HUN' : 'SVK';
  if (c === 'SVN') return la > 46.05 ? 'GER' : 'ITA';
  if (c === 'SRB') return la > 45.15 && lo < 20.15 ? 'HUN' : 'GER';
  if (c === 'MKD') return lo > 21.0 ? 'BUL' : 'ITA';
  if (c === 'GRC') return lo > 23.6 && la > 40.6 ? 'BUL' : 'GER';
  if (c === 'FRA') return la >= 46.7 || (la >= 45 && lo < 0.4) || (la >= 43.2 && lo < -0.3) ? 'GER' : 'VIC';
  return SIMPLE[c] || 'AFR';
}
const own = new Uint8Array(N);
for (let i = 0; i < N; i++) if (terr[i] >= 2 && hcty[i] >= 0) own[i] = NI[owner41(CTY[hcty[i]], hlon[i], hlat[i])];

// ——— реки: рёбра гексов, которые пересекает русло; ломаные для рисования ———
const segs = [], bins = new Map(), BIN = KM;
const binKey = (bx, by) => bx * 4096 + by;
const rivLines = new Map();
for (const fn of ['ne_10m_rivers_lake_centerlines.geojson', 'ne_10m_rivers_europe.geojson']) {
  for (const ft of geo(fn).features) {
    const p = ft.properties || {}, gm = ft.geometry;
    if (!gm) continue;
    const nm = p.name || p.name_en || '', w = MAJOR.has(nm) ? 2 : MINOR.has(nm) ? 1 : 0;
    if (!w) continue;
    const ls = gm.type === 'LineString' ? [gm.coordinates] : gm.type === 'MultiLineString' ? gm.coordinates : [];
    for (const l of ls) {
      const pts = [];
      for (const [lo, la] of l) {
        if (lo < -12 || lo > 53 || la < 33 || la > 72) { pts.length > 1 && addLine(nm, w, pts.splice(0)); pts.length = 0; continue; }
        pts.push(toG(lo, la));
      }
      pts.length > 1 && addLine(nm, w, pts);
    }
  }
}
function addLine(nm, w, pts) {
  for (let k = 0; k + 1 < pts.length; k++) {
    const s = { a: pts[k], b: pts[k + 1], w }, id = segs.push(s) - 1;
    const bx0 = Math.floor(Math.min(s.a[0], s.b[0]) / BIN), bx1 = Math.floor(Math.max(s.a[0], s.b[0]) / BIN);
    const by0 = Math.floor(Math.min(s.a[1], s.b[1]) / BIN), by1 = Math.floor(Math.max(s.a[1], s.b[1]) / BIN);
    for (let bx = bx0; bx <= bx1; bx++) for (let by = by0; by <= by1; by++) { const kk = binKey(bx, by); bins.has(kk) || bins.set(kk, []); bins.get(kk).push(id); }
  }
  rivLines.has(nm) || rivLines.set(nm, { w, lines: [] });
  rivLines.get(nm).lines.push(pts.slice());
}
const cross = (p, q, r, s) => {
  const d = (q[0] - p[0]) * (s[1] - r[1]) - (q[1] - p[1]) * (s[0] - r[0]);
  if (Math.abs(d) < 1e-12) return false;
  const t = ((r[0] - p[0]) * (s[1] - r[1]) - (r[1] - p[1]) * (s[0] - r[0])) / d, u = ((r[0] - p[0]) * (q[1] - p[1]) - (r[1] - p[1]) * (q[0] - p[0])) / d;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1;
};
const rivM = new Uint8Array(N), rivW = new Uint8Array(N); // маски направлений: любая река / крупная река
for (let i = 0; i < N; i++) {
  if (terr[i] < 2) continue;
  const a = hexXY(G, i);
  for (let d = 0; d < 6; d++) {
    const j = nbDir(G, i, d);
    if (j < 0 || terr[j] < 2) continue;
    const b = hexXY(G, j), seen = new Set();
    let hit = 0;
    for (let bx = Math.floor(Math.min(a[0], b[0]) / BIN); bx <= Math.floor(Math.max(a[0], b[0]) / BIN) && hit < 2; bx++)
      for (let by = Math.floor(Math.min(a[1], b[1]) / BIN); by <= Math.floor(Math.max(a[1], b[1]) / BIN) && hit < 2; by++)
        for (const id of bins.get(binKey(bx, by)) || []) {
          if (seen.has(id)) continue;
          seen.add(id);
          const s = segs[id];
          if (cross(a, b, s.a, s.b)) hit = Math.max(hit, s.w);
        }
    hit && ((rivM[i] |= 1 << d), hit === 2 && (rivW[i] |= 1 << d));
  }
}
// ломаные рек для рисования: упрощение (Дуглас — Пекер, 3 км), координаты в пикселях карты × 2 (R = 8 px)
const RPX = 8, PXK = RPX / RK; // пикселей на км
function dp(pts, eps) {
  if (pts.length < 3) return pts;
  const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1;
  const st = [[0, pts.length - 1]];
  while (st.length) {
    const [a, b] = st.pop(); let md = 0, mi = -1;
    const [ax, ay] = pts[a], [bx, by] = pts[b], L = Math.hypot(bx - ax, by - ay) || 1e-9;
    for (let k = a + 1; k < b; k++) { const d = Math.abs((bx - ax) * (ay - pts[k][1]) - (ax - pts[k][0]) * (by - ay)) / L; d > md && ((md = d), (mi = k)); }
    md > eps && ((keep[mi] = 1), st.push([a, mi], [mi, b]));
  }
  return pts.filter((_, k) => keep[k]);
}
const rivers = [];
for (const [n, { w, lines }] of rivLines) {
  for (const l of lines) {
    const s = dp(l, 3);
    if (s.length < 2) continue;
    rivers.push({ n, w, p: s.flatMap(([x, y]) => [Math.round(x * PXK * 2), Math.round(y * PXK * 2)]) });
  }
}

// ——— железные дороги (основные линии Natural Earth) ———
const rail = new Uint8Array(N);
for (const ft of geo('ne_10m_railroads.geojson').features) {
  const p = ft.properties || {}, gm = ft.geometry;
  if (!gm || !(p.category === 1 || (p.category === 2 && p.scalerank <= 8))) continue;
  const ls = gm.type === 'LineString' ? [gm.coordinates] : gm.type === 'MultiLineString' ? gm.coordinates : [];
  for (const l of ls) {
    let prev = -1;
    for (const [lo, la] of l) {
      if (lo < -12 || lo > 53 || la < 33 || la > 72) { prev = -1; continue; }
      const h = hexLL(lo, la);
      if (h < 0 || terr[h] < 2) { prev = -1; continue; }
      if (prev >= 0 && h !== prev) {
        const path = hexLine(G, prev, h);
        for (let k = 0; k + 1 < path.length; k++) {
          const a = path[k], b = path[k + 1];
          if (terr[a] < 2 || terr[b] < 2) continue;
          for (let d = 0; d < 6; d++) if (nbDir(G, a, d) === b) { rail[a] |= 1 << d; rail[b] |= 1 << ((d + 3) % 6); }
        }
      }
      prev = h;
    }
  }
}

// ——— города ———
const RU = new Map(Object.entries(RENAME41));
const cand = [];
for (const [n, lo, la, sz, fl] of CITY41) cand.push({ n, lo, la, sz, fl, pri: 10 + sz * 2, forced: 1 });
const have = new Set(CITY41.map((c) => c[0]));
for (const ft of geo('ne_10m_populated_places.geojson').features) {
  const p = ft.properties, [lo, la] = ft.geometry.coordinates;
  let n = (p.NAME_RU || '').trim();
  if (!n || lo < -11 || lo > 52 || la < 34 || la > 71.5) continue;
  if (RU.has(n)) { n = RU.get(n); if (!n) continue; }
  if (have.has(n)) continue;
  const east = lo > 11 && la > 40;
  if (!(p.SCALERANK <= (east ? 7 : 3) || p.ADM0CAP === 1)) continue;
  const pop = p.POP_MAX || 0, sz = pop >= 900000 ? 3 : pop >= 250000 ? 2 : 1;
  cand.push({ n, lo, la, sz, fl: '', pri: sz * 2 + (p.ADM0CAP === 1 ? 3 : 0) - p.SCALERANK * 0.1, forced: 0 });
}
cand.sort((a, b) => b.pri - a.pri);
const CITY_MAX = 416, cityAt = new Int16Array(N).fill(-1), cities = [];
for (const c of cand) {
  let h = hexLL(c.lo, c.la);
  if (h < 0) continue;
  if (terr[h] < 2) { // ближайшая суша
    let best = -1;
    for (let d = 0; d < 6; d++) { const j = nbDir(G, h, d); j >= 0 && terr[j] >= 2 && cityAt[j] < 0 && best < 0 && (best = j); }
    if (best < 0) continue;
    h = best;
  }
  if (cityAt[h] >= 0) continue;
  if (!c.forced) { // дополнительные города (Natural Earth): не ближе 3 гексов (крупные — 2) к уже стоящим, всего ≤ CITY_MAX
    if (cities.length >= CITY_MAX) continue;
    const gap = c.sz >= 2 ? 2 : 3;
    if (cities.some((o) => hexDist(G, o.h, h) < gap)) continue;
  }
  const port = [0, 1, 2, 3, 4, 5].some((d) => { const j = nbDir(G, h, d); return j >= 0 && terr[j] === 0; });
  const cap = /\bc\b/.test(c.fl), fort = /\bf\b/.test(c.fl), hard = /\bh\b/.test(c.fl);
  const vp = { Москва: 20, Ленинград: 12, Сталинград: 8, Киев: 8, Берлин: 20, Харьков: 5, Бухарест: 6, Будапешт: 6, Хельсинки: 6, Кёнигсберг: 5, Вена: 5, Баку: 6 }[c.n] ||
    (c.sz === 3 ? 4 : c.sz === 2 ? 2 : 1) + (cap ? 2 : 0);
  cityAt[h] = cities.length;
  cities.push({ n: c.n, h, sz: c.sz, vp, f: (cap ? 'c' : '') + (port ? 'p' : '') + (fort ? 'f' : '') + (hard ? 'h' : '') + (/\bx\b/.test(c.fl) ? 'x' : '') });
}

// ——— экономические регионы (src/europe/regions.js): рост от «семян» внутри своей современной страны ———
const reg = new Uint16Array(N), offmap = [];
{
  let q = [];
  REGIONS.forEach((r, k) => {
    const h = hexLL(r.lon, r.lat);
    if (h < 0) return offmap.push(r.k);
    let s = h;
    if (terr[s] < 2 || reg[s]) { s = -1; for (let d = 0; d < 6 && s < 0; d++) { const j = nbDir(G, h, d); j >= 0 && terr[j] >= 2 && !reg[j] && (s = j); } }
    if (s < 0) return offmap.push(r.k);
    reg[s] = k + 1; q.push(s);
  });
  for (let pass = 0; pass < 2; pass++) { // 1-й проход — только внутри страны, 2-й — остатки
    let qq = pass ? Array.from({ length: N }, (_, i) => i).filter((i) => reg[i]) : q;
    while (qq.length) {
      const nq = [];
      for (const i of qq)
        for (let d = 0; d < 6; d++) {
          const j = nbDir(G, i, d);
          if (j < 0 || terr[j] < 2 || reg[j] || (!pass && hcty[j] !== hcty[i])) continue;
          (reg[j] = reg[i]), nq.push(j);
        }
      qq = nq;
    }
  }
}
// ——— кодирование ———
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const enc6 = (a) => Array.from(a, (v) => B64[v & 63]).join('');
const rle = (a) => { let out = [], v = a[0], n = 0; for (let i = 0; i <= a.length; i++) { if (i < a.length && a[i] === v) { n++; continue; } out.push(v.toString(36) + '.' + n.toString(36)); v = a[i]; n = 1; } return out.join(' '); };
const J = {
  v: 1, id: 'eu41', proj: { lon0: PROJ.lon0, lat0: PROJ.lat0, xmin: Math.round(XMIN * 1000) / 1000, ymax: Math.round(YMAX * 1000) / 1000, km: KM },
  cols: COLS, rows: ROWS, R: RPX, nations: NAT,
  terrain: Array.from(terr, (t) => String.fromCharCode(48 + t)).join(''),
  owner: Array.from(own, (o) => o.toString(36)).join(''),
  river: enc6(rivM), riverW: enc6(rivW), rail: enc6(rail), region: rle(reg),
  regions: REGIONS.map((r) => r.k), offmap,
  cities: cities.map((c) => [c.n, c.h, c.sz, c.vp, c.f]),
  rivers,
};
const out = path.join(HERE, '..', 'src', 'data', 'eu41.json');
fs.writeFileSync(out, JSON.stringify(J));
const cnt = (f) => { let n = 0; for (let i = 0; i < N; i++) f(i) && n++; return n; };
console.log(`суша ${cnt((i) => terr[i] >= 2)}, озёра ${cnt((i) => terr[i] === 1)}, ж/д гексов ${cnt((i) => rail[i])}, рек-рёбер ${cnt((i) => rivM[i])}, городов ${cities.length}, вне карты регионов ${offmap.length}`);
console.log('местность:', [2, 3, 4, 5, 6, 7, 8].map((t) => `${t}:${cnt((i) => terr[i] === t)}`).join(' '));
console.log('владельцы:', NAT.slice(1).map((k, i) => `${k}:${cnt((h) => own[h] === i + 1)}`).join(' '));
console.log(`файл ${out}: ${(fs.statSync(out).size / 1024).toFixed(0)} КБ`);

// ——— превью (sharp) ———
if (process.argv.includes('--preview')) {
  const sharp = (await import('sharp')).default;
  const S = 1.5, W = Math.ceil((G.pxW * PXK) * S), H = Math.ceil((G.pxH * PXK) * S), px = new Uint8Array(W * H * 3);
  const TC = ['#24425e', '#3d6a8a', '#a9b878', '#4f7a46', '#a8996a', '#8a8580', '#6f8a6e', '#c9bd84', '#9aa3a0', '#999'];
  const OC = { GER: '#5a6068', SOV: '#b03a30', FIN: '#8fb0d0', ROM: '#c8ac40', HUN: '#8e8a48', ITA: '#4d8a55', SVK: '#7f8fae', BUL: '#6f9a73', CRO: '#a07ab0' };
  const hx = (c) => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
  const Gp = makeGrid(COLS, ROWS, RPX * S);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = hexAtXY(Gp, x, y), o = (y * W + x) * 3;
    if (i < 0) continue;
    let c = hx(TC[terr[i]]);
    const on = NAT[own[i]];
    if (terr[i] >= 2 && OC[on]) { const t = hx(OC[on]); c = c.map((v, k) => (v * 0.45 + t[k] * 0.55) | 0); }
    else if (terr[i] >= 2) c = c.map((v) => (v * 0.6 + 200 * 0.4) | 0);
    px[o] = c[0]; px[o + 1] = c[1]; px[o + 2] = c[2];
  }
  const dot = (x, y, col, r = 1) => { for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { const X = Math.round(x + dx), Y = Math.round(y + dy); if (X >= 0 && Y >= 0 && X < W && Y < H) { const o = (Y * W + X) * 3; px[o] = col[0]; px[o + 1] = col[1]; px[o + 2] = col[2]; } } };
  for (const r of rivers) for (let k = 0; k + 3 < r.p.length; k += 2) {
    const x0 = r.p[k] / 2 * S, y0 = r.p[k + 1] / 2 * S, x1 = r.p[k + 2] / 2 * S, y1 = r.p[k + 3] / 2 * S, n = Math.ceil(Math.hypot(x1 - x0, y1 - y0));
    for (let t = 0; t <= n; t++) dot(x0 + ((x1 - x0) * t) / (n || 1), y0 + ((y1 - y0) * t) / (n || 1), [40, 90, 160], r.w > 1 ? 1 : 0);
  }
  for (let i = 0; i < N; i++) for (let d = 0; d < 3; d++) if (rail[i] & (1 << d)) {
    const j = nbDir(G, i, d), [x0, y0] = hexXY(Gp, i), [x1, y1] = hexXY(Gp, j);
    for (let t = 0; t <= 8; t++) dot(x0 + ((x1 - x0) * t) / 8, y0 + ((y1 - y0) * t) / 8, [30, 30, 30], 0);
  }
  for (const c of cities) { const [x, y] = hexXY(Gp, c.h); dot(x, y, c.f.includes('c') ? [255, 230, 0] : [255, 255, 255], c.sz); }
  await sharp(Buffer.from(px), { raw: { width: W, height: H, channels: 3 } }).png().toFile(path.join(HERE, 'shots', 'eu41_preview.png'));
  console.log('превью tools/shots/eu41_preview.png', W, H);
}
