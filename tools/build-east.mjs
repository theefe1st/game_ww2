// «Восточный фронт» (v0.10): карта областей от Эльбы до Урала на 22 июня 1941 г.
// node tools/build-east.mjs [--preview]  → src/east/data/map.json (+ tools/shots/east_*.png)
// Данные: Natural Earth (tools/get-ne-data.sh + ne_10m_admin_0_countries, ne_10m_populated_places, ne_10m_railroads),
// рельеф — тайлы AWS Terrarium z6 (скачиваются в tools/data/dem), растительность — Natural Earth II (NE2_LR_LC.tif,
// tools/data/ne2). Нужен sharp (npm i sharp, либо SHARP_DIR=… с node_modules, где он установлен).
// Алгоритм: растр 2 км/пкс → владельцы 1941 г. → зёрна областей (города + заполнение) → рост областей с барьерами
// (реки, хребты, границы) → дуги общих границ (топология) → упрощение и сглаживание → атрибуты областей.
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import { CITY41, RENAME41 } from './eu41-cities.mjs';
import { SITES, ZONES_N, zoneOf, EXTRA_TOWNS } from '../src/east/sites.js';
import { meshGrid, meshVert } from '../src/east/mesh.js';

const require = createRequire(import.meta.url);
let sharp;
try { sharp = require('sharp'); } catch { sharp = createRequire(path.join(process.env.SHARP_DIR || '/vercel/sandbox/node_modules', 'x.js'))('sharp'); }
const HERE = path.dirname(fileURLToPath(import.meta.url)), D = path.join(HERE, 'data'), OUT = path.join(HERE, '..', 'src', 'east', 'data');
const SHOTS = path.join(HERE, 'shots');
const PREVIEW = process.argv.includes('--preview');
const t0 = Date.now(), log = (...a) => console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s]`, ...a);
for (const f of ['ne_10m_admin_0_countries', 'ne_10m_populated_places', 'ne_10m_railroads'])
  fs.existsSync(path.join(D, f + '.geojson')) ||
    execSync(`curl -s -o ${path.join(D, f + '.geojson')} https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/${f}.geojson`);
const geo = (f) => JSON.parse(fs.readFileSync(path.join(D, f), 'utf8'));
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
const POLY = Function('return ' + grab('const POLY = {', '{'))();

// ——— проекция: коническая равноугольная Ламберта; карта в км, y вниз ———
export const PROJ = { lon0: 36, lat0: 52, lat1: 45, lat2: 62, x0: -1720, y0: 2050, w: 3360, h: 3360 };
const RE = 6371, DG = Math.PI / 180;
const LN = (() => {
  const f1 = PROJ.lat1 * DG, f2 = PROJ.lat2 * DG;
  const n = Math.log(Math.cos(f1) / Math.cos(f2)) / Math.log(Math.tan(Math.PI / 4 + f2 / 2) / Math.tan(Math.PI / 4 + f1 / 2));
  const F = (Math.cos(f1) * Math.pow(Math.tan(Math.PI / 4 + f1 / 2), n)) / n;
  return { n, F, r0: (RE * F) / Math.pow(Math.tan(Math.PI / 4 + (PROJ.lat0 * DG) / 2), n) };
})();
export function fwd(lon, lat) {
  const r = (RE * LN.F) / Math.pow(Math.tan(Math.PI / 4 + (lat * DG) / 2), LN.n), t = LN.n * (lon - PROJ.lon0) * DG;
  return [r * Math.sin(t) - PROJ.x0, PROJ.y0 - (LN.r0 - r * Math.cos(t))];
}
export function inv(X, Y) {
  const x = X + PROJ.x0, y = LN.r0 - (PROJ.y0 - Y);
  const r = Math.sign(LN.n) * Math.hypot(x, y), t = Math.atan2(x, y);
  return [PROJ.lon0 + t / LN.n / DG, (2 * Math.atan(Math.pow((RE * LN.F) / r, 1 / LN.n)) - Math.PI / 2) / DG];
}
// ——— растр ———
const KP = 2; // км на пиксель
const W = Math.ceil(PROJ.w / KP), H = Math.ceil(PROJ.h / KP), N = W * H;
log(`растр ${W}×${H} (${KP} км/пкс)`);
const LON = new Float32Array(N), LAT = new Float32Array(N);
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const [lo, la] = inv((x + 0.5) * KP, (y + 0.5) * KP); LON[y * W + x] = lo; LAT[y * W + x] = la; }
const inBox = (lo, la) => lo > -2 && lo < 80 && la > 30 && la < 78;
// полигоны → кольца в пикселях
function ringsOf(gm) {
  const polys = gm.type === 'Polygon' ? [gm.coordinates] : gm.type === 'MultiPolygon' ? gm.coordinates : [];
  const out = [];
  for (const P of polys) {
    let any = false;
    for (const [lo, la] of P[0]) if (inBox(lo, la)) { any = true; break; }
    if (!any) continue;
    out.push(P.map((ring) => ring.map(([lo, la]) => { const [X, Y] = fwd(Math.max(-2, Math.min(80, lo)), Math.max(30, Math.min(78, la))); return [X / KP, Y / KP]; })));
  }
  return out;
}
// заливка многоугольника (с дырами) по чёт-нечёт, центры пикселей
function fillPoly(rings, buf, v) {
  let y0 = Infinity, y1 = -Infinity;
  for (const r of rings) for (const p of r) (y0 = Math.min(y0, p[1])), (y1 = Math.max(y1, p[1]));
  y0 = Math.max(0, Math.floor(y0)); y1 = Math.min(H - 1, Math.ceil(y1));
  const xs = [];
  for (let y = y0; y <= y1; y++) {
    const cy = y + 0.5;
    xs.length = 0;
    for (const r of rings)
      for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
        const [xa, ya] = r[i], [xb, yb] = r[j];
        if (ya > cy !== yb > cy) xs.push(xa + ((cy - ya) * (xb - xa)) / (yb - ya));
      }
    if (xs.length < 2) continue;
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const a = Math.max(0, Math.ceil(xs[k] - 0.5)), b = Math.min(W - 1, Math.floor(xs[k + 1] - 0.5));
      for (let x = a; x <= b; x++) buf[y * W + x] = v;
    }
  }
}
// ——— суша, озёра 1941 г. (без водохранилищ, построенных позже), страны ———
const LAND = new Uint8Array(N);
for (const ft of geo('ne_10m_land.geojson').features) for (const rs of ringsOf(ft.geometry)) fillPoly(rs, LAND, 1);
const RESV = /reservoir|vodokhr|vodoskh|kakhov|kremench|kyyiv|kaniv|kuybysh|volgograd|tsimly|gor.kov|saratov|cheboks|votkin|nizhnekam|rybinsk|dniprodz|dneprodz|kama|kiev|kiyev|dnieper|dnipro|ivankov|uglich|sheksn|kegums|plavinas|dubossar|mingech|vileyka|krasnodar|zeya|tsimlyansk/i;
const lakes = [];
for (const ft of geo('ne_10m_lakes.geojson').features) {
  const p = ft.properties || {}, nm = p.name || p.name_en || '';
  if (RESV.test(nm) || RESV.test(p.name_alt || '') || (p.featurecla || '').includes('Reservoir')) continue;
  for (const rs of ringsOf(ft.geometry)) {
    let a = 0; const r = rs[0];
    for (let i = 0, j = r.length - 1; i < r.length; j = i++) a += (r[j][0] + r[i][0]) * (r[j][1] - r[i][1]);
    if (Math.abs(a / 2) * KP * KP < 150) continue; // мелкие озёра — не на карте
    fillPoly(rs, LAND, 2);
    lakes.push({ nm, rs, area: Math.abs(a / 2) * KP * KP });
  }
}
log('озёр', lakes.length, lakes.sort((a, b) => b.area - a.area).slice(0, 12).map((l) => l.nm + ' ' + Math.round(l.area)).join(', '));
const CTY = [''], CTYI = new Uint16Array(N);
for (const ft of geo('ne_10m_admin_0_countries.geojson').features) {
  const a3 = ft.properties.ADM0_A3 || ft.properties.ISO_A3;
  const rs = ringsOf(ft.geometry);
  if (!rs.length) continue;
  const id = CTY.push(a3) - 1;
  for (const r of rs) fillPoly(r, CTYI, id);
}
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

// ——— владельцы, играбельная суша ———
export const NATS = ['', 'GER', 'SOV', 'FIN', 'ROM', 'HUN', 'SVK', 'BUL', 'CRO', 'ITA', 'SWE', 'TUR', 'IRN', 'NEU'];
const NI = Object.fromEntries(NATS.map((k, i) => [k, i]));
const OFF = new Set(['SWE', 'DNK', 'ITA', 'ALB', 'MNE', 'KOS', 'GRC', 'MKD', 'TUR', 'IRN', 'IRQ', 'SYR', 'KAZ', 'TKM', 'UZB', 'NLD', 'BEL', 'LUX', 'CHE', 'LIE', 'FRA', 'SMR', 'VAT', 'CYP', 'CYN', 'LBN', 'ISR', 'JOR', 'PSX', 'EGY', 'LBY', 'TUN', 'DZA', 'GBR', 'IRL', 'ESP', 'PRT', 'AND', 'MCO', 'MLT', 'GEO_ABK']);
const OWN = new Uint8Array(N), PLAY = new Uint8Array(N); // PLAY: 1 — области, 2 — нейтральная/неактивная суша
for (let i = 0; i < N; i++) {
  if (LAND[i] !== 1) continue;
  const c = CTY[CTYI[i]] || '';
  if (!c) continue;
  let o = owner41(c, LON[i], LAT[i]);
  if (!NI[o]) o = 'NEU';
  OWN[i] = NI[o];
  const off = OFF.has(c) || (c === 'NOR' && LAT[i] < 68.2) || LON[i] < 9.3 || (c === 'AZE' && LON[i] < 46.2 && LAT[i] < 40.3);
  PLAY[i] = off || o === 'NEU' || o === 'SWE' || o === 'TUR' || o === 'IRN' || o === 'ITA' ? 2 : 1;
}
// дыры между полигонами стран — по ближайшему соседу
for (let pass = 0; pass < 6; pass++) {
  let left = 0;
  for (let i = 0; i < N; i++) {
    if (LAND[i] !== 1 || OWN[i]) continue;
    const x = i % W, y = (i / W) | 0;
    let got = 0;
    for (const j of [i - 1, i + 1, i - W, i + W]) if (j >= 0 && j < N && Math.abs((j % W) - x) <= 1 && OWN[j] && j !== i) { OWN[i] = OWN[j]; PLAY[i] = PLAY[j]; got = 1; break; }
    got || left++;
  }
  if (!left) break;
}
const cntBy = (arr, n) => { const c = new Array(n).fill(0); for (let i = 0; i < N; i++) c[arr[i]]++; return c; };
log('владельцы (тыс. км²):', NATS.map((k, i) => k && `${k}:${Math.round((cntBy(OWN, NATS.length)[i] * KP * KP) / 1000)}`).filter(Boolean).join(' '));

// ——— рельеф: Terrarium z6 (Web Mercator) ———
const DEMZ = 6, DEMD = path.join(D, 'dem');
fs.mkdirSync(DEMD, { recursive: true });
const TX0 = 33, TX1 = 43, TY0 = 15, TY1 = 25, TS = 256;
const DW = (TX1 - TX0 + 1) * TS, DH = (TY1 - TY0 + 1) * TS, DEM = new Float32Array(DW * DH);
for (let tx = TX0; tx <= TX1; tx++)
  for (let ty = TY0; ty <= TY1; ty++) {
    const f = path.join(DEMD, `${DEMZ}_${tx}_${ty}.png`);
    if (!fs.existsSync(f) || !fs.statSync(f).size) execSync(`curl -s -o ${f} https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${DEMZ}/${tx}/${ty}.png`);
    const { data, info } = await sharp(f).raw().toBuffer({ resolveWithObject: true });
    const ch = info.channels;
    for (let y = 0; y < TS; y++)
      for (let x = 0; x < TS; x++) {
        const k = (y * TS + x) * ch;
        DEM[((ty - TY0) * TS + y) * DW + (tx - TX0) * TS + x] = data[k] * 256 + data[k + 1] + data[k + 2] / 256 - 32768;
      }
  }
function elevAt(lon, lat) {
  const n2 = 2 ** DEMZ, fx = ((lon + 180) / 360) * n2 * TS - TX0 * TS;
  const fy = ((1 - Math.log(Math.tan(Math.PI / 4 + (lat * DG) / 2)) / Math.PI) / 2) * n2 * TS - TY0 * TS;
  const x = Math.max(0, Math.min(DW - 1.001, fx - 0.5)), y = Math.max(0, Math.min(DH - 1.001, fy - 0.5));
  const x0 = x | 0, y0 = y | 0, ax = x - x0, ay = y - y0, k = y0 * DW + x0;
  return DEM[k] * (1 - ax) * (1 - ay) + DEM[k + 1] * ax * (1 - ay) + DEM[k + DW] * (1 - ax) * ay + DEM[k + DW + 1] * ax * ay;
}
const ELEV = new Float32Array(N);
for (let i = 0; i < N; i++) ELEV[i] = elevAt(LON[i], LAT[i]);
log('рельеф готов');
// ——— растительность: Natural Earth II (цвета земли без отмывки) ———
const NE2F = path.join(D, 'ne2', 'NE2_LR_LC.tif');
if (!fs.existsSync(NE2F)) {
  fs.mkdirSync(path.join(D, 'ne2'), { recursive: true });
  execSync(`curl -s -o ${path.join(D, 'ne2.zip')} https://naciscdn.org/naturalearth/10m/raster/NE2_LR_LC.zip && unzip -o -q ${path.join(D, 'ne2.zip')} -d ${path.join(D, 'ne2')}`);
}
const NX0 = (5 + 180) * 45, NY0 = (90 - 73) * 45, NW = 2745, NH = 1620;
const NE2 = await sharp(NE2F, { limitInputPixels: false }).extract({ left: NX0, top: NY0, width: NW, height: NH }).raw().toBuffer();
function ne2At(lon, lat) {
  const x = Math.max(0, Math.min(NW - 1.001, (lon + 180) * 45 - NX0 - 0.5)), y = Math.max(0, Math.min(NH - 1.001, (90 - lat) * 45 - NY0 - 0.5));
  const x0 = x | 0, y0 = y | 0, ax = x - x0, ay = y - y0, out = [0, 0, 0];
  for (const [dx, dy, w] of [[0, 0, (1 - ax) * (1 - ay)], [1, 0, ax * (1 - ay)], [0, 1, (1 - ax) * ay], [1, 1, ax * ay]]) {
    const k = ((y0 + dy) * NW + x0 + dx) * 3;
    out[0] += NE2[k] * w; out[1] += NE2[k + 1] * w; out[2] += NE2[k + 2] * w;
  }
  return out;
}
// открытость (0 — лес, 1 — степь/поле), сухость, тундра
const OPEN = new Float32Array(N);
for (let i = 0; i < N; i++) {
  if (LAND[i] !== 1) continue;
  const [r] = ne2At(LON[i], LAT[i]);
  OPEN[i] = Math.max(0, Math.min(1, (r - 172) / 45));
}
// болота (долгота, широта)
const MARSH = [
  [[23.5, 52.4], [25.5, 52.6], [27.5, 52.55], [29.5, 52.25], [30.4, 51.95], [30.2, 51.3], [28.5, 51.35], [26.5, 51.4], [24.8, 51.55], [23.8, 51.9]], // Полесье
  [[30.5, 58.0], [31.4, 57.3], [32.9, 57.4], [33.5, 58.6], [33.0, 59.4], [31.9, 59.85], [31.0, 59.6], [30.9, 58.7]], // Волхов, Ильмень, Демянск
  [[22.2, 53.3], [23.0, 53.2], [23.4, 53.6], [22.8, 53.8], [22.2, 53.6]], // Бебжа
  [[28.6, 45.0], [29.75, 44.85], [29.75, 45.5], [28.9, 45.45]], // дельта Дуная
  [[37.3, 45.0], [38.5, 45.0], [38.4, 46.0], [37.8, 45.9], [37.3, 45.5]], // плавни Кубани
  [[39.2, 55.0], [41.0, 55.0], [41.2, 55.7], [39.6, 55.9], [39.0, 55.5]], // Мещера
  [[27.2, 56.6], [28.3, 56.3], [29.0, 57.0], [28.0, 57.4]], // Себеж, Великая
];
const MAR = new Uint8Array(N);
for (const P of MARSH) { const rs = [P.map(([lo, la]) => { const [X, Y] = fwd(lo, la); return [X / KP, Y / KP]; })]; fillPoly(rs, MAR, 1); }
for (let i = 0; i < N; i++) LAND[i] !== 1 && (MAR[i] = 0);
// ——— реки: растр (1 — малая, 2 — большая) и ломаные ———
const MAJOR = new Set(Function('return ' + grab('const MAJOR = new Set(['))());
const MINOR = new Set(Function('return ' + grab('const MINOR = new Set(['))());
for (const n of ['Volga', 'Don', 'Dnieper', 'Dnepr', 'Dnipro', 'Daugava', 'Zapadnaya Dvina', 'Western Dvina', 'Neman', 'Nemunas', 'Dniester', 'Dnister', 'Vistula', 'Wisła', 'Oder', 'Odra', 'Danube', 'Elbe', 'Severnaya Dvina', 'Northern Dvina', 'Kama', 'Ural', 'Kura']) MAJOR.add(n);
for (const n of ['Lovat', 'Lovat’', 'Mius', 'Manych', 'Vorskla', 'Psel', 'Sula', 'Ingulets', 'Inhulets', 'Sal', 'Chir', 'Aksay', 'Ros', 'Teteriv', 'Horyn', 'Styr', 'Sluch', 'Ptsich', 'Drut', 'Ugra', 'Zhizdra', 'Moskva', 'Klyazma', 'Vazuza', 'Sukhona', 'Vychegda', 'Onega', 'Kem', 'Kovda', 'Tuloma', 'Kola', 'Sheksna', 'Vetluga', 'Vyatka', 'Belaya', 'Ufa', 'Chusovaya', 'Samara', 'Medveditsa', 'Ilovlya', 'Bityug', 'Voronezh', 'Tsna', 'Moksha', 'Mologa', 'Tvertsa', 'Western Bug', 'Bug', 'Pripyat', 'Prypiat', 'Pripyat’', 'Desna', 'Seym', 'Oskil', 'Oskol', 'Aidar', 'Siverskyi Donets', 'Severskiy Donets', 'Donets', 'Kuban', 'Terek', 'Sulak', 'Kuma', 'Rioni', 'Aras', 'Mures', 'Mureș', 'Olt', 'Siret', 'Prut', 'Tisza', 'Tisa', 'Drava', 'Sava', 'Morava', 'Vah', 'Váh', 'Hron', 'Warta', 'Noteć', 'Narew', 'San', 'Pilica', 'Bzura', 'Neisse', 'Nysa Łużycka', 'Spree', 'Havel', 'Oka', 'Sura', 'Velikaya', 'Narva', 'Luga', 'Volkhov', 'Svir', 'Neva', 'Msta', 'Vuoksi', 'Kymijoki', 'Kemijoki', 'Oulujoki', 'Berezina', 'Byarezina', 'Sozh', 'Southern Bug', 'Pivdennyi Buh', 'Inhul', 'Dnieper-Bug']) MINOR.add(n);
const RIV = new Uint8Array(N), rivers = [];
function rasterLine(a, b, v, buf) {
  const n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) * 2) + 1;
  for (let k = 0; k <= n; k++) {
    const x = Math.floor(a[0] + ((b[0] - a[0]) * k) / n), y = Math.floor(a[1] + ((b[1] - a[1]) * k) / n);
    if (x >= 0 && y >= 0 && x < W && y < H) buf[y * W + x] = Math.max(buf[y * W + x], v);
    if (x + 1 >= 0 && y >= 0 && x + 1 < W && y < H) buf[y * W + x + 1] = Math.max(buf[y * W + x + 1], v);
  }
}
for (const fn of ['ne_10m_rivers_lake_centerlines.geojson', 'ne_10m_rivers_europe.geojson']) {
  for (const ft of geo(fn).features) {
    const p = ft.properties || {}, gm = ft.geometry;
    if (!gm) continue;
    const nm = p.name || p.name_en || '', w = MAJOR.has(nm) ? 2 : MINOR.has(nm) ? 1 : (p.scalerank ?? 9) <= 3 && fn.includes('centerlines') ? 1 : 0;
    if (!w) continue;
    const ls = gm.type === 'LineString' ? [gm.coordinates] : gm.type === 'MultiLineString' ? gm.coordinates : [];
    for (const l of ls) {
      const pts = [];
      for (const [lo, la] of l) {
        if (!inBox(lo, la)) continue;
        const [X, Y] = fwd(lo, la);
        if (X < -50 || Y < -50 || X > PROJ.w + 50 || Y > PROJ.h + 50) continue;
        pts.push([X / KP, Y / KP]);
      }
      if (pts.length < 2) continue;
      for (let k = 0; k + 1 < pts.length; k++) rasterLine(pts[k], pts[k + 1], w, RIV);
      rivers.push({ nm, w, pts });
    }
  }
}
for (let i = 0; i < N; i++) if (LAND[i] !== 1) RIV[i] = 0;
log('рек (ломаных):', rivers.length);

// ——— зёрна областей ———
const dist2 = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2;
function cellKm(lo, la, nat) {
  if (nat === 'FIN' || (nat === 'SOV' && la > 60.6 && lo < 42)) return la > 66 ? 165 : 140;
  if (nat === 'GER' && la > 63) return 180;
  if (nat === 'SOV' && la > 61 && lo > 44) return 330;
  if (nat === 'SOV' && (lo > 52 || (lo > 46 && la > 57) || la > 60.6)) return lo > 55 ? 250 : 200;
  if (nat === 'SOV' && lo > 47.5 && la > 47.5) return 165;
  if (la < 44.6 && lo < 29) return 150;
  if (nat === 'SOV' && la < 43.4) return 135;
  if (la >= 58 && la <= 60.6 && lo >= 27 && lo <= 36) return 92;
  if (lo >= 33 && lo <= 40.5 && la >= 53.5 && la <= 57) return 96;
  return 110;
}
// крупные города — небольшие отдельные области (радиус, км)
const CAP_R = { Москва: 46, Ленинград: 40, Сталинград: 38, Киев: 44, Севастополь: 32, Одесса: 38, Берлин: 44, Харьков: 46, Ростов: 0 };
const cand = [];
const RU = new Map();
for (const [n, lo, la, sz, fl] of CITY41) RU.set(n, { n, lo, la, sz, fl: fl || '' });
for (const [n, lo, la, ind, fl] of SITES) {
  const c = RU.get(n) || { n, lo, la, sz: 1, fl: '' };
  c.ind = ind; c.sf = fl; c.sz = Math.max(c.sz, ind >= 3 || /v[5-9]|v10/.test(fl) ? 3 : ind >= 1 || /v[2-4]/.test(fl) ? 2 : c.sz);
  RU.set(n, c);
}
const places = [];
for (const ft of geo('ne_10m_populated_places.geojson').features) {
  const p = ft.properties, [lo, la] = ft.geometry.coordinates;
  if (lo < 8 || lo > 64 || la < 38 || la > 72) continue;
  let n = p.NAME_RU || p.NAME;
  if (n in RENAME41) n = RENAME41[n];
  if (!n) continue;
  places.push({ n, lo, la, pop: p.POP_MAX || 0 });
}
for (const [n, lo, la] of EXTRA_TOWNS) places.push({ n, lo, la, pop: 1, extra: 1 });
const pix = (lo, la) => { const [X, Y] = fwd(lo, la); const x = Math.floor(X / KP), y = Math.floor(Y / KP); return x >= 0 && y >= 0 && x < W && y < H ? y * W + x : -1; };
// ближайший играбельный пиксель (город на берегу)
function landPix(lo, la, r = 4) {
  const i0 = pix(lo, la);
  if (i0 < 0) return -1;
  if (PLAY[i0] === 1) return i0;
  const x0 = i0 % W, y0 = (i0 / W) | 0;
  let best = -1, bd = 1e9;
  for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    const x = x0 + dx, y = y0 + dy;
    if (x < 0 || y < 0 || x >= W || y >= H || PLAY[y * W + x] !== 1) continue;
    const d = dx * dx + dy * dy;
    d < bd && ((bd = d), (best = y * W + x));
  }
  return best;
}
for (const c of RU.values()) {
  const i = landPix(c.lo, c.la);
  if (i < 0) continue;
  cand.push({ n: c.n, i, pr: 100 + c.sz * 20 + (c.ind || 0) * 5 + (/[xf]/.test(c.fl) ? 6 : 0), city: c, cap: CAP_R[c.n] || 0 });
}
for (const p of places) {
  const i = landPix(p.lo, p.la, 2);
  if (i < 0 || RU.has(p.n) || p.extra) continue;
  cand.push({ n: p.n, i, pr: 10 + Math.log10(1 + p.pop) * 5 });
}
cand.sort((a, b) => b.pr - a.pr);
const SPX = (i) => cellKm(LON[i], LAT[i], NATS[OWN[i]]) / KP; // шаг областей в пикселях
let seeds = [];
const SG = 25, sgrid = new Map(), skey = (x, y) => Math.floor(x / SG) * 10000 + Math.floor(y / SG);
function addSeed(s) {
  const x = s.i % W, y = (s.i / W) | 0;
  s.x = x; s.y = y; s.sp = s.cap ? Math.max(s.cap * 1.6, 60) / KP : SPX(s.i);
  seeds.push(s);
  const k = skey(x, y); sgrid.has(k) || sgrid.set(k, []); sgrid.get(k).push(s);
}
function seedOk(i, sp, k = 0.8) {
  const x = i % W, y = (i / W) | 0;
  for (let gx = Math.floor(x / SG) - 6; gx <= Math.floor(x / SG) + 6; gx++)
    for (let gy = Math.floor(y / SG) - 6; gy <= Math.floor(y / SG) + 6; gy++)
      for (const s of sgrid.get(gx * 10000 + gy) || []) {
        const need = k * (sp + s.sp) * 0.5;
        if ((s.x - x) ** 2 + (s.y - y) ** 2 < need * need) return false;
      }
  return true;
}
for (const c of cand) {
  if (PLAY[c.i] !== 1) continue;
  const sp = c.cap ? Math.max(c.cap * 1.6, 60) / KP : SPX(c.i);
  if (seedOk(c.i, sp, c.pr >= 160 ? 0.62 : 0.8)) addSeed(c);
}
// заполнение пустот: случайные точки (детерминированно)
let rs = 12345;
const rnd = () => ((rs = (Math.imul(rs, 1103515245) + 12345) >>> 0), rs / 4294967296);
for (let k = 0; k < 400000; k++) {
  const i = Math.floor(rnd() * N);
  if (PLAY[i] !== 1) continue;
  if (seedOk(i, SPX(i), 0.86)) addSeed({ n: '', i, pr: 0 });
}
log('зёрен', seeds.length, 'из них городов', seeds.filter((s) => s.city).length);

// ——— компоненты суши без зёрен ———
function components(mask, sameKey) {
  const comp = new Int32Array(N).fill(-1), list = [];
  const q = new Int32Array(N);
  for (let i = 0; i < N; i++) {
    if (!mask(i) || comp[i] >= 0) continue;
    const id = list.length, key = sameKey(i);
    let h = 0, t = 0; q[t++] = i; comp[i] = id;
    const px = [];
    while (h < t) {
      const p = q[h++]; px.push(p);
      const x = p % W;
      for (const j of [p - 1, p + 1, p - W, p + W, p - W - 1, p - W + 1, p + W - 1, p + W + 1]) {
        if (j < 0 || j >= N || Math.abs((j % W) - x) > 1 || comp[j] >= 0 || !mask(j) || sameKey(j) !== key) continue;
        comp[j] = id; q[t++] = j;
      }
    }
    list.push({ key, px });
  }
  return { comp, list };
}
{
  const { comp, list } = components((i) => PLAY[i] === 1, (i) => OWN[i]);
  const has = new Uint8Array(list.length);
  for (const s of seeds) has[comp[s.i]] = 1;
  let add = 0;
  for (let c = 0; c < list.length; c++) {
    if (has[c]) continue;
    const L = list[c];
    if (L.px.length * KP * KP < 2200) continue;
    let sx = 0, sy = 0;
    for (const p of L.px) (sx += p % W), (sy += (p / W) | 0);
    sx /= L.px.length; sy /= L.px.length;
    let best = L.px[0], bd = 1e18;
    for (const p of L.px) { const d = (p % W - sx) ** 2 + (((p / W) | 0) - sy) ** 2; d < bd && ((bd = d), (best = p)); }
    addSeed({ n: '', i: best, pr: 0 }); add++;
  }
  log('зёрен для островов и анклавов', add);
}
// ——— рост областей (Дейкстра по растру) ———
const LAB = new Int32Array(N).fill(-1), COST = new Float32Array(N).fill(Infinity);
let hc = new Float32Array(1 << 20), hi = new Int32Array(1 << 20), hn = 0;
function hpush(c, i) {
  if (hn >= hc.length) { const c2 = new Float32Array(hc.length * 2), i2 = new Int32Array(hc.length * 2); c2.set(hc); i2.set(hi); hc = c2; hi = i2; }
  let k = hn++;
  while (k > 0) { const p = (k - 1) >> 1; if (hc[p] <= c) break; hc[k] = hc[p]; hi[k] = hi[p]; k = p; }
  hc[k] = c; hi[k] = i;
}
function hpop() {
  const c = hc[0], i = hi[0], lc = hc[--hn], li = hi[hn];
  let k = 0;
  for (;;) {
    let m = 2 * k + 1;
    if (m >= hn) break;
    if (m + 1 < hn && hc[m + 1] < hc[m]) m++;
    if (hc[m] >= lc) break;
    hc[k] = hc[m]; hi[k] = hi[m]; k = m;
  }
  hc[k] = lc; hi[k] = li;
  return [c, i];
}
const SQ2 = Math.SQRT2 * KP;
const capAt = (s, x, y) => { const a = Math.atan2(y - s.y, x - s.x), ph = (s.i % 97) / 15; return s.cap * (1 + 0.22 * Math.sin(3 * a + ph) + 0.12 * Math.sin(5 * a + 2 * ph) + 0.06 * Math.sin(8 * a - ph)); };
seeds.forEach((s, k) => { LAB[s.i] = k; COST[s.i] = 0; hpush(0, s.i); });
const NB8 = [[-1, 0, KP], [1, 0, KP], [0, -1, KP], [0, 1, KP], [-1, -1, SQ2], [1, -1, SQ2], [-1, 1, SQ2], [1, 1, SQ2]];
while (hn) {
  const [c, i] = hpop();
  if (c > COST[i]) continue;
  const s = seeds[LAB[i]], x = i % W, y = (i / W) | 0, own = OWN[s.i];
  for (const [dx, dy, st] of NB8) {
    const nx = x + dx, ny = y + dy;
    if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
    const j = ny * W + nx;
    if (PLAY[j] !== 1 || OWN[j] !== own) continue;
    if (s.cap && (nx - s.x) ** 2 + (ny - s.y) ** 2 > (capAt(s, nx, ny) / KP) ** 2) continue;
    const nc = c + st + (RIV[j] === 2 && !RIV[i] ? 55 : RIV[j] === 1 && !RIV[i] ? 18 : RIV[j] ? 6 : 0) + Math.abs(ELEV[j] - ELEV[i]) / 28;
    if (nc < COST[j]) { COST[j] = nc; LAB[j] = LAB[i]; hpush(nc, j); }
  }
}
// незанятая суша — соседям
for (let pass = 0; pass < 200; pass++) {
  let left = 0;
  for (let i = 0; i < N; i++) {
    if (PLAY[i] !== 1 || LAB[i] >= 0) continue;
    const x = i % W;
    for (const j of [i - 1, i + 1, i - W, i + W]) if (j >= 0 && j < N && Math.abs((j % W) - x) <= 1 && LAB[j] >= 0 && PLAY[j] === 1) { LAB[i] = LAB[j]; break; }
    LAB[i] < 0 && left++;
  }
  if (!left) break;
}
// связность: у каждой области остаётся крупнейший кусок
function fixPieces() {
  let moved = 0;
  const { comp, list } = components((i) => PLAY[i] === 1 && LAB[i] >= 0, (i) => LAB[i]);
  const best = new Map();
  list.forEach((L, c) => { const b = best.get(L.key); (!b || list[b].px.length < L.px.length) && best.set(L.key, c); });
  list.forEach((L, c) => {
    if (best.get(L.key) === c) return;
    const cnt = new Map();
    for (const p of L.px) {
      const x = p % W;
      for (const j of [p - 1, p + 1, p - W, p + W]) if (j >= 0 && j < N && Math.abs((j % W) - x) <= 1 && LAB[j] >= 0 && LAB[j] !== L.key) cnt.set(LAB[j], (cnt.get(LAB[j]) || 0) + 1);
    }
    let to = -1, bn = 0;
    for (const [k, v] of cnt) v > bn && ((bn = v), (to = k));
    if (to >= 0) { for (const p of L.px) LAB[p] = to; moved++; }
  });
  return moved;
}
for (let k = 0; k < 4 && fixPieces(); k++);
// мелкие области — соседу того же владельца с самой длинной общей границей
{
  const area = new Map();
  for (let i = 0; i < N; i++) LAB[i] >= 0 && PLAY[i] === 1 && area.set(LAB[i], (area.get(LAB[i]) || 0) + 1);
  let merged = 0;
  for (const [k, a] of [...area].sort((p, q) => p[1] - q[1])) {
    const s = seeds[k];
    if (s.cap || a * KP * KP >= 0.2 * (s.sp * KP) ** 2) continue;
    const cnt = new Map();
    for (let i = 0; i < N; i++) {
      if (LAB[i] !== k) continue;
      const x = i % W;
      for (const j of [i - 1, i + 1, i - W, i + W]) if (j >= 0 && j < N && Math.abs((j % W) - x) <= 1 && LAB[j] >= 0 && LAB[j] !== k && OWN[seeds[LAB[j]].i] === OWN[s.i]) cnt.set(LAB[j], (cnt.get(LAB[j]) || 0) + 1);
    }
    let to = -1, bn = 0;
    for (const [q, v] of cnt) v > bn && ((bn = v), (to = q));
    if (to < 0) continue;
    for (let i = 0; i < N; i++) LAB[i] === k && (LAB[i] = to);
    area.set(to, (area.get(to) || 0) + a); area.delete(k); merged++;
  }
  log('слито мелких областей', merged);
}
for (let k = 0; k < 3 && fixPieces(); k++);
// перенумерация
const used = [...new Set(Array.from(LAB).filter((v) => v >= 0))].sort((a, b) => a - b), remap = new Map(used.map((v, k) => [v, k]));
for (let i = 0; i < N; i++) LAB[i] >= 0 && (LAB[i] = remap.get(LAB[i]));
seeds = used.map((v) => seeds[v]);
const R = seeds.length;
log('областей', R);
for (let i = 0; i < N; i++) if (PLAY[i] === 1 && LAB[i] < 0) PLAY[i] = 2; // мелкие острова без областей

// ——— неактивная суша (нейтральные страны, Средняя Азия…) — «псевдообласти» по странам ———
const NEUT_N = { SWE: 'Швеция', NOR: 'Норвегия', TUR: 'Турция', IRN: 'Иран', KAZ: 'Казахстан', TKM: 'Туркмения', UZB: 'Узбекистан', ITA: 'Италия', ALB: 'Албания', GRC: 'Греция', MKD: 'Македония', MNE: 'Черногория', KOS: 'Косово', DNK: 'Дания', AZE: 'Азербайджан', IRQ: 'Ирак', SYR: 'Сирия' };
const pseudo = [];
{
  const { list } = components((i) => PLAY[i] === 2 && LAND[i] === 1, (i) => CTYI[i]);
  for (const L of list) {
    if (L.px.length * KP * KP < 300) continue;
    const id = R + pseudo.length, c = CTY[L.key];
    for (const p of L.px) LAB[p] = id;
    let sx = 0, sy = 0;
    for (const p of L.px) (sx += p % W), (sy += (p / W) | 0);
    pseudo.push({ c, n: NEUT_N[c] || '', area: L.px.length * KP * KP, x: (sx / L.px.length) * KP, y: (sy / L.px.length) * KP });
  }
  log('нейтральных участков', pseudo.length);
}
// ——— метки для контуров: суша + 4 пкс в воду (берег рисуется по векторам Natural Earth) ———
const VL = new Int32Array(LAB);
{
  let front = [];
  for (let i = 0; i < N; i++) if (VL[i] >= 0) front.push(i);
  for (let step = 0; step < 4; step++) {
    const nf = [];
    for (const p of front) {
      const x = p % W;
      for (const j of [p - 1, p + 1, p - W, p + W]) {
        if (j < 0 || j >= N || Math.abs((j % W) - x) > 1 || VL[j] >= 0 || LAND[j] === 1) continue;
        VL[j] = VL[p]; nf.push(j);
      }
    }
    front = nf;
  }
}
// «шахматные» углы 2×2 убираем — границы становятся многообразием
for (let pass = 0; pass < 20; pass++) {
  let fixed = 0;
  for (let y = 1; y < H; y++)
    for (let x = 1; x < W; x++) {
      const tl = VL[(y - 1) * W + x - 1], tr = VL[(y - 1) * W + x], bl = VL[y * W + x - 1], br = VL[y * W + x];
      if (tl === br && tr === bl && tl !== tr) { const k = br >= 0 ? y * W + x : (y - 1) * W + x; VL[k] = VL[k] === tl ? tr : tl; fixed++; }
    }
  if (!fixed) break;
}
// ——— дуги общих границ ———
const LV = (x, y) => (x < 0 || y < 0 || x >= W || y >= H ? -1 : VL[y * W + x]);
const CW = W + 1;
const VIS_V = new Uint8Array(CW * H), VIS_H = new Uint8Array(W * (H + 1)); // ребро вниз от угла (x,y) / вправо от угла (x,y)
function cornerEdges(x, y) { // [dir, nx, ny] — 0 вверх, 1 вправо, 2 вниз, 3 влево
  const tl = LV(x - 1, y - 1), tr = LV(x, y - 1), bl = LV(x - 1, y), br = LV(x, y), e = [];
  tl !== tr && e.push(0); tr !== br && e.push(1); bl !== br && e.push(2); tl !== bl && e.push(3);
  return e;
}
const isJ = (x, y) => cornerEdges(x, y).length !== 2;
const edgeVis = (x, y, d) => (d === 0 ? VIS_V[(y - 1) * CW + x] : d === 2 ? VIS_V[y * CW + x] : d === 1 ? VIS_H[y * W + x] : VIS_H[y * W + x - 1]);
function markEdge(x, y, d) { d === 0 ? (VIS_V[(y - 1) * CW + x] = 1) : d === 2 ? (VIS_V[y * CW + x] = 1) : d === 1 ? (VIS_H[y * W + x] = 1) : (VIS_H[y * W + x - 1] = 1); }
const DXY = [[0, -1], [1, 0], [0, 1], [-1, 0]];
function edgePair(x, y, d) { // метки по сторонам ребра
  if (d === 0) return [LV(x - 1, y - 1), LV(x, y - 1)];
  if (d === 2) return [LV(x - 1, y), LV(x, y)];
  if (d === 1) return [LV(x, y - 1), LV(x, y)];
  return [LV(x - 1, y - 1), LV(x - 1, y)];
}
const arcs = [];
function trace(x, y, d) {
  const pts = [[x, y]], [a, b] = edgePair(x, y, d);
  let cx = x, cy = y, cd = d;
  for (;;) {
    markEdge(cx, cy, cd);
    cx += DXY[cd][0]; cy += DXY[cd][1];
    pts.push([cx, cy]);
    const e = cornerEdges(cx, cy);
    if (e.length !== 2 || (cx === x && cy === y)) break;
    const back = (cd + 2) % 4, nd = e[0] === back ? e[1] : e[0];
    if (edgeVis(cx, cy, nd)) break;
    cd = nd;
  }
  arcs.push({ a: Math.min(a, b), b: Math.max(a, b), pts });
}
for (let y = 0; y <= H; y++)
  for (let x = 0; x <= W; x++) {
    if (!isJ(x, y)) continue;
    for (const d of cornerEdges(x, y)) if (!edgeVis(x, y, d)) trace(x, y, d);
  }
for (let y = 0; y <= H; y++) // замкнутые контуры без узлов (острова)
  for (let x = 0; x <= W; x++) for (const d of cornerEdges(x, y)) if (!edgeVis(x, y, d)) trace(x, y, d);
log('дуг', arcs.length);
// упрощение (Дуглас — Пекер)
function dp(pts, eps) {
  if (pts.length < 3) return pts;
  const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1;
  const st = [[0, pts.length - 1]];
  while (st.length) {
    const [i0, i1] = st.pop();
    const [ax, ay] = pts[i0], [bx, by] = pts[i1], L = Math.hypot(bx - ax, by - ay) || 1e-9;
    let md = -1, mi = -1;
    for (let i = i0 + 1; i < i1; i++) {
      const d = L < 1e-6 ? Math.hypot(pts[i][0] - ax, pts[i][1] - ay) : Math.abs((bx - ax) * (ay - pts[i][1]) - (ax - pts[i][0]) * (by - ay)) / L;
      d > md && ((md = d), (mi = i));
    }
    if (md > eps) { keep[mi] = 1; st.push([i0, mi], [mi, i1]); }
  }
  return pts.filter((_, i) => keep[i]);
}
for (const A of arcs) {
  const closed = A.pts.length > 3 && A.pts[0][0] === A.pts[A.pts.length - 1][0] && A.pts[0][1] === A.pts[A.pts.length - 1][1];
  if (closed) { // замкнутая дуга: делим на две половины, чтобы ДП не схлопнул
    const h = A.pts.length >> 1;
    A.s = [...dp(A.pts.slice(0, h + 1), 0.75), ...dp(A.pts.slice(h), 0.75).slice(1)];
  } else A.s = dp(A.pts, 0.75);
  A.closed = closed;
}
// тип дуги: 0 — между областями, 1 — берег, 2 — граница с нейтральной сушей, 3 — между нейтральными
for (const A of arcs) A.t = A.a >= 0 && A.a < R && A.b < R ? 0 : A.a < 0 ? (A.b < R ? 1 : 3) : A.a >= R ? 3 : 2;
// кольца областей из дуг
const regArcs = Array.from({ length: R + pseudo.length }, () => []);
arcs.forEach((A, k) => { A.a >= 0 && regArcs[A.a].push(k); A.b >= 0 && A.b !== A.a && regArcs[A.b].push(k); });
const ck = (p) => p[0] * 100000 + p[1];
function ringsFor(r) {
  const ks = regArcs[r], byEnd = new Map(), used = new Set(), rings = [];
  for (const k of ks) {
    const A = arcs[k];
    if (A.closed) { rings.push([k]); used.add(k); continue; }
    for (const e of [ck(A.pts[0]), ck(A.pts[A.pts.length - 1])]) { byEnd.has(e) || byEnd.set(e, []); byEnd.get(e).push(k); }
  }
  for (const k0 of ks) {
    if (used.has(k0)) continue;
    const ring = [];
    let k = k0, rev = false;
    for (let guard = 0; guard < 5000; guard++) {
      used.add(k); ring.push(rev ? ~k : k);
      const A = arcs[k], end = rev ? A.pts[0] : A.pts[A.pts.length - 1];
      const nx = (byEnd.get(ck(end)) || []).find((q) => !used.has(q));
      if (nx === undefined) break;
      rev = ck(arcs[nx].pts[0]) !== ck(end);
      k = nx;
    }
    rings.push(ring);
  }
  return rings;
}
const RINGS = Array.from({ length: R + pseudo.length }, (_, r) => ringsFor(r));

// ——— атрибуты областей ———
// местность по пикселям: горы, холмы (перепад высот в окне 7×7), болота, лес
const RELF = new Float32Array(N);
{
  const mx = new Float32Array(N), mn = new Float32Array(N), t1 = new Float32Array(N), t2 = new Float32Array(N), r = 3;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let a = -1e9, b = 1e9;
    for (let k = Math.max(0, x - r); k <= Math.min(W - 1, x + r); k++) { const v = ELEV[y * W + k]; v > a && (a = v); v < b && (b = v); }
    t1[y * W + x] = a; t2[y * W + x] = b;
  }
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let a = -1e9, b = 1e9;
    for (let k = Math.max(0, y - r); k <= Math.min(H - 1, y + r); k++) { const i = k * W + x; t1[i] > a && (a = t1[i]); t2[i] < b && (b = t2[i]); }
    mx[y * W + x] = a; mn[y * W + x] = b;
  }
  for (let i = 0; i < N; i++) RELF[i] = mx[i] - Math.max(0, mn[i]);
}
const TER = ['pla', 'for', 'mar', 'hil', 'mnt'];
const RG = Array.from({ length: R }, (_, r) => ({ id: r, px: 0, sx: 0, sy: 0, mnt: 0, hil: 0, mar: 0, for: 0, ele: 0 }));
for (let i = 0; i < N; i++) {
  const r = LAB[i];
  if (r < 0 || r >= R) continue;
  const g = RG[r], e = ELEV[i], rel = RELF[i];
  g.px++; g.sx += i % W; g.sy += (i / W) | 0; g.ele += e;
  if (e > 1300 || rel > 750) g.mnt++;
  else if (e > 420 || rel > 230) g.hil++;
  if (MAR[i]) g.mar++;
  else if (OPEN[i] < 0.38 && LAT[i] < 68.5) g.for++;
}
// центр для подписи и фишек: самая «глубокая» точка области (шахматное расстояние до границы)
const DT = new Float32Array(N);
for (let i = 0; i < N; i++) DT[i] = LAB[i] >= 0 && LAB[i] < R ? 1e9 : 0;
{
  const v = (i, j, ok) => (ok && LAB[j] === LAB[i] ? DT[j] : 0);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x; if (!DT[i]) continue;
    DT[i] = Math.min(DT[i], v(i, i - W, y > 0) + 1, v(i, i - 1, x > 0) + 1, v(i, i - W - 1, y > 0 && x > 0) + 1.414, v(i, i - W + 1, y > 0 && x < W - 1) + 1.414);
  }
  for (let y = H - 1; y >= 0; y--) for (let x = W - 1; x >= 0; x--) {
    const i = y * W + x; if (!DT[i]) continue;
    DT[i] = Math.min(DT[i], v(i, i + W, y < H - 1) + 1, v(i, i + 1, x < W - 1) + 1, v(i, i + W + 1, y < H - 1 && x < W - 1) + 1.414, v(i, i + W - 1, y < H - 1 && x > 0) + 1.414);
  }
}
const best = new Float32Array(R).fill(-1), bestI = new Int32Array(R).fill(-1);
for (let i = 0; i < N; i++) { const r = LAB[i]; if (r >= 0 && r < R && DT[i] > best[r]) { best[r] = DT[i]; bestI[r] = i; } }
// соседство (по суше), реки на границе, железные дороги через границу
const RIVD = new Uint8Array(RIV);
for (let i = 0; i < N; i++) if (RIV[i]) { const x = i % W; for (const j of [i - 1, i + 1, i - W, i + W]) if (j >= 0 && j < N && Math.abs((j % W) - x) <= 1) RIVD[j] = Math.max(RIVD[j], RIV[i]); }
const RAIL = new Uint8Array(N);
for (const ft of geo('ne_10m_railroads.geojson').features) {
  const gm = ft.geometry; if (!gm) continue;
  const ls = gm.type === 'LineString' ? [gm.coordinates] : gm.type === 'MultiLineString' ? gm.coordinates : [];
  for (const l of ls) {
    let prev = null;
    for (const [lo, la] of l) {
      if (!inBox(lo, la)) { prev = null; continue; }
      const [X, Y] = fwd(lo, la), p = [X / KP, Y / KP];
      prev && rasterLine(prev, p, 1, RAIL);
      prev = p;
    }
  }
}
const ADJ = new Map(), akey = (a, b) => (a < b ? a * 4096 + b : b * 4096 + a);
function addEdge(i, j) {
  const a = LAB[i], b = LAB[j];
  if (a < 0 || b < 0 || a === b || a >= R || b >= R) return;
  const k = akey(a, b);
  let e = ADJ.get(k);
  e || ADJ.set(k, (e = { a: Math.min(a, b), b: Math.max(a, b), n: 0, r1: 0, r2: 0, rail: 0 }));
  e.n++;
  const rv = Math.max(RIVD[i], RIVD[j]);
  rv === 2 ? e.r2++ : rv === 1 && e.r1++;
  RAIL[i] && RAIL[j] && e.rail++;
}
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = y * W + x; x + 1 < W && addEdge(i, i + 1); y + 1 < H && addEdge(i, i + W); }
const adj = [...ADJ.values()].filter((e) => e.n >= 3);
// особые переправы: Керченский пролив, «Дорога жизни» по Ладоге
const regAt = (lo, la) => { const i = landPix(lo, la, 6); return i >= 0 ? LAB[i] : -1; };
for (const [p, q, t] of [[[36.45, 45.33], [36.72, 45.22], 'sea'], [[30.75, 59.95], [32.3, 60.05], 'ice']]) {
  const a = regAt(...p), b = regAt(...q);
  if (a >= 0 && b >= 0 && a !== b && a < R && b < R) adj.push({ a: Math.min(a, b), b: Math.max(a, b), n: 0, r1: 0, r2: 0, rail: 0, sp: t });
}
log('соседств', adj.length);
// города в областях
const cityList = [];
for (const c of RU.values()) {
  const i = landPix(c.lo, c.la);
  if (i < 0 || LAB[i] < 0 || LAB[i] >= R) continue;
  const [X, Y] = fwd(c.lo, c.la);
  cityList.push({ n: c.n, x: X, y: Y, s: c.sz, r: LAB[i], ind: c.ind || 0, f: (c.sf || '') + ' ' + (c.fl || ''), lo: c.lo, la: c.la });
}
const usedN = new Set(seeds.map((s) => s.n).filter(Boolean));
const regs = RG.map((g, r) => {
  const s = seeds[r], i = bestI[r], area = g.px * KP * KP;
  const nat = NATS[OWN[s.i]];
  const t = g.mnt / g.px > 0.3 ? 4 : g.mar / g.px > 0.28 ? 2 : (g.hil + g.mnt) / g.px > 0.38 ? 3 : g.for / g.px > 0.5 ? 1 : 0;
  const cs = cityList.filter((c) => c.r === r).sort((p, q) => q.s - p.s || q.ind - p.ind);
  let n = s.n;
  if (!n && cs.length) n = cs[0].n;
  if (!n) { // крупнейший населённый пункт внутри
    let bd = 1e18;
    for (const p of places) { const pi = landPix(p.lo, p.la, 1); if (pi >= 0 && LAB[pi] === r) { const d = -p.pop; d < bd && ((bd = d), (n = p.n)); } }
  }
  if (!n) { // ближайший пункт в пределах 110 км
    const cx = (bestI[r] % W + 0.5) * KP, cy = (((bestI[r] / W) | 0) + 0.5) * KP;
    let bd = 110 * 110;
    for (const p of [...places, ...cityList.map((c) => ({ n: c.n, lo: c.lo, la: c.la }))]) {
      const [X, Y] = fwd(p.lo, p.la), d = (X - cx) ** 2 + (Y - cy) ** 2;
      d < bd && !usedN.has(p.n) && ((bd = d), (n = p.n));
    }
  }
  n && usedN.add(n);
  const cx = (i % W + 0.5) * KP, cy = (((i / W) | 0) + 0.5) * KP;
  const [lo, la] = inv(cx, cy);
  const fl = cs.map((c) => c.f).join(' ');
  const vp = cs.reduce((m, c) => Math.max(m, +((/v(\d+)/.exec(c.f) || [])[1] || 0)), 0);
  return {
    id: r, n: n || `Область ${r + 1}`, nat, x: Math.round(cx), y: Math.round(cy), area: Math.round(area), t: TER[t],
    z: zoneOf(lo, la, nat), ind: cs.reduce((m, c) => m + c.ind, 0), vp, oil: /\bo\b/.test(fl) ? 1 : 0, port: /\bp\b/.test(fl) ? 1 : 0,
    ll: /\bL\b/.test(fl) ? 1 : 0, cap: /\bc\b/.test(fl) ? 1 : 0, fort: /\bf\b/.test(fl) ? 1 : 0, evac: /\be\b/.test(fl) ? 1 : 0,
    ele: Math.round(g.ele / g.px), city: cs.length ? cs[0].s : 0, cities: cs.map((c) => cityList.indexOf(c)),
  };
});
// одинаковые названия — уточняем
{
  const seen = new Map();
  for (const g of regs) seen.set(g.n, (seen.get(g.n) || 0) + 1);
  for (const g of regs) if (seen.get(g.n) > 1 && !g.city) g.n = g.n + ' (окр.)';
}
log('местность:', TER.map((t, k) => `${t}:${regs.filter((g) => g.t === t).length}`).join(' '), '· направления:', ZONES_N.map((z, k) => `${z}:${regs.filter((g) => g.z === k).length}`).join(' '));
log('по владельцам:', NATS.map((k) => k && regs.filter((g) => g.nat === k).length && `${k}:${regs.filter((g) => g.nat === k).length}`).filter(Boolean).join(' '));

// ——— берега и озёра (векторы Natural Earth, км карты) ———
const inFrame = (r) => r.some(([x, y]) => x > -30 && y > -30 && x < PROJ.w + 30 && y < PROJ.h + 30);
const ringArea = (r) => { let a = 0; for (let i = 0, j = r.length - 1; i < r.length; j = i++) a += (r[j][0] + r[i][0]) * (r[j][1] - r[i][1]); return Math.abs(a / 2); };
function vecRings(file, minA, eps, filt = () => true) {
  const out = [];
  for (const ft of geo(file).features) {
    if (!filt(ft.properties || {})) continue;
    const gm = ft.geometry, polys = gm.type === 'Polygon' ? [gm.coordinates] : gm.type === 'MultiPolygon' ? gm.coordinates : [];
    for (const P of polys)
      for (const ring of P) {
        if (!ring.some(([lo, la]) => inBox(lo, la))) continue;
        const r = ring.map(([lo, la]) => fwd(Math.max(-2, Math.min(80, lo)), Math.max(30, Math.min(78, la))));
        if (!inFrame(r) || ringArea(r) < minA) continue;
        const s = dp(r, eps);
        s.length >= 4 && out.push(s);
      }
  }
  return out;
}
const landR = vecRings('ne_10m_land.geojson', 25, 0.8);
const lakeR = vecRings('ne_10m_lakes.geojson', 150, 0.8, (p) => !(RESV.test(p.name || '') || RESV.test(p.name_alt || '') || (p.featurecla || '').includes('Reservoir')));
log('берег: колец', landR.length, 'точек', landR.reduce((s, r) => s + r.length, 0), '· озёра', lakeR.length, lakeR.reduce((s, r) => s + r.length, 0));
// реки для рисования: упрощение, только видимые (в пределах кадра)
const rivOut = [];
for (const rv of rivers) {
  const p = dp(rv.pts.map(([x, y]) => [x * KP, y * KP]), 0.9);
  if (p.length >= 2 && inFrame(p)) rivOut.push({ n: rv.nm, w: rv.w, p });
}
// ——— сетка рельефа: высота и цвет вершин ———
const G = meshGrid(PROJ.w, PROJ.h, 15);
const NV = G.nx * G.ny, VE = new Int16Array(NV), VC = new Uint8Array(NV * 3), VF = new Uint8Array(NV);
// цвета: лес / открытая земля / степь / полупустыня / тундра / скалы / снег — стилизованная палитра
const mixc = (a, b, t) => a.map((v, k) => v + (b[k] - v) * t);
const C = {
  taiga: [62, 102, 66], mixed: [76, 116, 62], broad: [88, 128, 66], field: [150, 168, 96], meadow: [128, 150, 88], steppe: [204, 190, 120], dry: [214, 190, 140],
  tundra: [150, 156, 128], rock: [138, 126, 110], snow: [240, 242, 238], marsh: [104, 128, 92],
};
for (let j = 0; j < G.ny; j++)
  for (let i = 0; i < G.nx; i++) {
    const v = i + j * G.nx, [X, Y] = meshVert(G, i, j);
    const [lo, la] = inv(X, Y);
    const e = elevAt(lo, la);
    const px = Math.floor(X / KP), py = Math.floor(Y / KP), pi = px >= 0 && py >= 0 && px < W && py < H ? py * W + px : -1;
    const land = pi >= 0 ? LAND[pi] : 0;
    VE[v] = Math.max(-8000, Math.min(8000, Math.round(land === 1 ? Math.max(e, 0) : land === 2 ? 0 : Math.min(e, -1))));
    let flags = land === 1 ? 1 : land === 2 ? 2 : 0;
    const [r, g, b] = ne2At(lo, la);
    const open = Math.max(0, Math.min(1, (r - 172) / 45)), dryness = Math.max(0, Math.min(1, (r - g + 6) / 14)), tund = Math.max(0, Math.min(1, (b - 182) / 22));
    const forest = la > 60 ? C.taiga : la > 54 ? mixc(C.taiga, C.mixed, (60 - la) / 6) : mixc(C.mixed, C.broad, Math.min(1, (54 - la) / 4));
    const opn = la > 55 ? C.meadow : la > 51 ? mixc(C.meadow, C.field, (55 - la) / 4) : mixc(C.field, C.steppe, Math.min(1, (51 - la) / 3));
    let col = mixc(forest, mixc(opn, C.dry, dryness), open);
    if (tund > 0.2 && la > 64) col = mixc(col, C.tundra, Math.min(1, tund * 1.4));
    if (pi >= 0 && MAR[pi]) { col = mixc(col, C.marsh, 0.65); flags |= 4; }
    if (pi >= 0 && land === 1 && open < 0.38 && !MAR[pi]) flags |= 8; // лес — деревья на подложке
    if (e > 900) col = mixc(col, C.rock, Math.min(1, (e - 900) / 1200));
    if (e > 2600 || (e > 1500 && la > 66)) col = mixc(col, C.snow, Math.min(1, (e - (la > 66 ? 1500 : 2600)) / 500));
    if (pi >= 0 && PLAY[pi] === 2) flags |= 16; // неактивная суша
    VC[v * 3] = col[0]; VC[v * 3 + 1] = col[1]; VC[v * 3 + 2] = col[2];
    VF[v] = flags;
  }
log('сетка рельефа', G.nx, '×', G.ny, 'вершин', NV);

// палитра (k-средних, 64 цвета) — «низкополигональные» плоские тона
const PAL = [];
const VP = new Uint8Array(NV);
{
  const K = 64, cen = [];
  for (let k = 0; k < K; k++) { const v = Math.floor(((k + 0.5) / K) * NV); cen.push([VC[v * 3], VC[v * 3 + 1], VC[v * 3 + 2]]); }
  for (let it = 0; it < 12; it++) {
    const acc = cen.map(() => [0, 0, 0, 0]);
    for (let v = 0; v < NV; v++) {
      let bk = 0, bd = 1e9;
      for (let k = 0; k < K; k++) { const d = (VC[v * 3] - cen[k][0]) ** 2 + (VC[v * 3 + 1] - cen[k][1]) ** 2 + (VC[v * 3 + 2] - cen[k][2]) ** 2; d < bd && ((bd = d), (bk = k)); }
      VP[v] = bk; const a = acc[bk]; a[0] += VC[v * 3]; a[1] += VC[v * 3 + 1]; a[2] += VC[v * 3 + 2]; a[3]++;
    }
    for (let k = 0; k < K; k++) if (acc[k][3]) cen[k] = [acc[k][0] / acc[k][3], acc[k][1] / acc[k][3], acc[k][2] / acc[k][3]];
  }
  for (const c of cen) PAL.push(c.map(Math.round));
}
// ——— кодирование: зигзаг-дельты в единицах 0,5 км, base64-символы по 5 бит ———
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
function encPts(pts, unit = 0.5) {
  let s = '', px = 0, py = 0;
  const put = (v) => { let z = v < 0 ? -2 * v - 1 : 2 * v; do { const c = z & 31; z >>>= 5; s += B64[c | (z ? 32 : 0)]; } while (z); };
  for (const [x, y] of pts) { const qx = Math.round(x / unit), qy = Math.round(y / unit); put(qx - px); put(qy - py); px = qx; py = qy; }
  return s;
}
const b64 = (u8) => Buffer.from(u8.buffer, u8.byteOffset, u8.byteLength).toString('base64');
const MAP = {
  v: 1, proj: PROJ, w: PROJ.w, h: PROJ.h, nats: NATS, zones: ZONES_N,
  regs: regs.map((g, r) => ({ n: g.n, o: NATS.indexOf(g.nat), x: g.x, y: g.y, a: g.area, t: g.t, z: g.z, ind: g.ind, vp: g.vp, f: [g.oil && 'o', g.port && 'p', g.ll && 'L', g.cap && 'c', g.fort && 'f', g.evac && 'e'].filter(Boolean).join(''), e: g.ele, c: g.city, rg: RINGS[r] })),
  neut: pseudo.map((p, k) => ({ c: p.c, n: p.n, x: Math.round(p.x), y: Math.round(p.y), rg: RINGS[R + k] })),
  arcs: arcs.map((A) => [A.a, A.b, A.t, encPts(A.s.map(([x, y]) => [x * KP, y * KP]))]),
  adj: adj.map((e) => [e.a, e.b, Math.round(e.n * KP), e.r2 / Math.max(1, e.n) >= 0.35 ? 2 : (e.r1 + e.r2) / Math.max(1, e.n) >= 0.35 ? 1 : 0, e.rail ? 1 : 0, e.sp || '']),
  cities: cityList.map((c) => [c.n, Math.round(c.x), Math.round(c.y), c.s, c.r]),
  rivers: rivOut.map((r) => [r.n, r.w, encPts(r.p)]),
  land: landR.map((r) => encPts(r)), lakes: lakeR.map((r) => encPts(r)),
  mesh: { step: G.step, nx: G.nx, ny: G.ny, pal: PAL, e: b64(VE), c: b64(VP), f: b64(VF) },
};
fs.mkdirSync(OUT, { recursive: true });
const js = JSON.stringify(MAP);
fs.writeFileSync(path.join(OUT, 'map.json'), js);
log('map.json', Math.round(js.length / 1024), 'КБ:', Object.entries(MAP).map(([k, v]) => `${k} ${Math.round(JSON.stringify(v).length / 1024)}`).join(', '));

// ——— предпросмотр разметки (--preview) ———
async function previewLabels(file) {
  const img = Buffer.alloc(N * 3);
  const col = (k) => { let h = (k * 2654435761) >>> 0; return [90 + (h & 127), 90 + ((h >> 8) & 127), 90 + ((h >> 16) & 127)]; };
  for (let i = 0; i < N; i++) {
    let c;
    if (LAND[i] !== 1) c = LAND[i] === 2 ? [120, 160, 200] : [70, 110, 160];
    else if (PLAY[i] !== 1) c = [150, 150, 140];
    else c = LAB[i] >= 0 ? col(LAB[i]) : [255, 0, 255];
    const x = i % W;
    if (LAB[i] >= 0 && ((x + 1 < W && LAB[i + 1] !== LAB[i]) || (i + W < N && LAB[i + W] !== LAB[i]))) c = OWN[i] !== OWN[i + 1] || OWN[i] !== OWN[i + W] ? [0, 0, 0] : [40, 40, 40];
    if (RIV[i]) c = RIV[i] === 2 ? [20, 60, 200] : [60, 110, 230];
    img[i * 3] = c[0]; img[i * 3 + 1] = c[1]; img[i * 3 + 2] = c[2];
  }
  for (const s of seeds) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const k = (s.y + dy) * W + s.x + dx; if (k >= 0 && k < N) img[k * 3] = 255, img[k * 3 + 1] = s.city ? 255 : 0, img[k * 3 + 2] = 0; }
  fs.mkdirSync(SHOTS, { recursive: true });
  await sharp(img, { raw: { width: W, height: H, channels: 3 } }).png().toFile(path.join(SHOTS, file));
  log('предпросмотр', file);
}
// ——— предпросмотр (SVG → PNG) ———
if (PREVIEW) {
  await previewLabels('east_labels.png');
  const S = 0.4, sx = (v) => (v * S).toFixed(1);
  const arcPts = arcs.map((A) => A.s.map(([x, y]) => [x * KP, y * KP]));
  const ringPath = (rg) => rg.map((ring) => ring.map((k, q) => { const p = k < 0 ? arcPts[~k].slice().reverse() : arcPts[k]; return (q ? 'L' : 'M') + p.map(([x, y]) => `${sx(x)},${sx(y)}`).join('L'); }).join('') + 'Z').join('');
  const OC = { GER: '#8a96a3', SOV: '#c46a5e', FIN: '#e8eef2', ROM: '#d4b54a', HUN: '#7fa36a', SVK: '#7c93c4', BUL: '#9a8f6a', CRO: '#8a7fb0' };
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${sx(PROJ.w)}" height="${sx(PROJ.h)}"><rect width="100%" height="100%" fill="#6f93b3"/>`;
  svg += `<path d="${landR.map((r) => 'M' + r.map(([x, y]) => `${sx(x)},${sx(y)}`).join('L') + 'Z').join('')}" fill="#d9d2b8" fill-rule="evenodd"/>`;
  regs.forEach((g, r) => (svg += `<path d="${ringPath(RINGS[r])}" fill="${OC[g.nat] || '#999'}" fill-opacity="0.55" stroke="#333" stroke-width="0.4" fill-rule="evenodd"/>`));
  svg += `<path d="${lakeR.map((r) => 'M' + r.map(([x, y]) => `${sx(x)},${sx(y)}`).join('L') + 'Z').join('')}" fill="#6f93b3"/>`;
  for (const r of rivOut) svg += `<path d="M${r.p.map(([x, y]) => `${sx(x)},${sx(y)}`).join('L')}" fill="none" stroke="#3a6fb0" stroke-width="${r.w === 2 ? 1.2 : 0.6}"/>`;
  for (const g of regs) svg += `<text x="${sx(g.x)}" y="${sx(g.y)}" font-size="5" text-anchor="middle" font-family="sans-serif" fill="#111">${g.n.replace(/&/g, '')}</text>`;
  svg += '</svg>';
  fs.writeFileSync(path.join(SHOTS, 'east_vec.svg'), svg);
  await sharp(Buffer.from(svg), { density: 72 }).png().toFile(path.join(SHOTS, 'east_vec.png'));
  log('предпросмотр east_vec.png');
}
