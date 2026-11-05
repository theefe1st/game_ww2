// «Мировой фронт» v0.12: большая карта от Атлантики до Урала и от Сахары до Нордкапа на 22 июня 1941 г.
// node tools/build-world.mjs [--preview]  → src/east/data/world.json (+ tools/shots/world_*.png)
// Основа — tools/build-east.mjs. Области Востока берутся из src/east/data/map.json как есть (те же названия, границы
// и соседства: растр их многоугольников), области Запада, Африки и Ближнего Востока строятся заново тем же способом
// (зёрна — города tools/west-sites.mjs и Natural Earth, рост с барьерами рек и рельефа). Данные — как у build-east.mjs.
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import { CITY41, RENAME41 } from './eu41-cities.mjs';
import { ZONES_W } from '../src/east/sites.js';
import { WSITES, WCAP_R, FORCE, RENAME_W, EXTRA_W } from './west-sites.mjs';
import { meshGrid, meshVert } from '../src/east/mesh.js';
import { decPts } from '../src/east/mapdata.js';

const require = createRequire(import.meta.url);
let sharp;
try { sharp = require('sharp'); } catch { sharp = createRequire(path.join(process.env.SHARP_DIR || '/data/node_modules', 'x.js'))('sharp'); }
const HERE = path.dirname(fileURLToPath(import.meta.url)), D = path.join(HERE, 'data'), OUT = path.join(HERE, '..', 'src', 'east', 'data');
const SHOTS = path.join(HERE, 'shots');
const PREVIEW = process.argv.includes('--preview');
const t0 = Date.now(), log = (...a) => console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s]`, ...a);
for (const f of ['ne_10m_admin_0_countries', 'ne_10m_populated_places', 'ne_10m_railroads', 'ne_10m_land', 'ne_10m_lakes', 'ne_10m_rivers_lake_centerlines', 'ne_10m_rivers_europe'])
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
export const PROJ = { lon0: 24, lat0: 50, lat1: 38, lat2: 62, x0: -3000, y0: 2550, w: 5800, h: 4900 };
const RE = 6371, DG = Math.PI / 180;
function lcc(P) {
  const f1 = P.lat1 * DG, f2 = P.lat2 * DG;
  const n = Math.log(Math.cos(f1) / Math.cos(f2)) / Math.log(Math.tan(Math.PI / 4 + f2 / 2) / Math.tan(Math.PI / 4 + f1 / 2));
  const F = (Math.cos(f1) * Math.pow(Math.tan(Math.PI / 4 + f1 / 2), n)) / n, r0 = (RE * F) / Math.pow(Math.tan(Math.PI / 4 + (P.lat0 * DG) / 2), n);
  const fwd = (lon, lat) => { const r = (RE * F) / Math.pow(Math.tan(Math.PI / 4 + (lat * DG) / 2), n), t = n * (lon - P.lon0) * DG; return [r * Math.sin(t) - P.x0, P.y0 - (r0 - r * Math.cos(t))]; };
  const inv = (X, Y) => { const x = X + P.x0, y = r0 - (P.y0 - Y), r = Math.sign(n) * Math.hypot(x, y), t = Math.atan2(x, y); return [P.lon0 + t / n / DG, (2 * Math.atan(Math.pow((RE * F) / r, 1 / n)) - Math.PI / 2) / DG]; };
  return { fwd, inv };
}
const WP = lcc(PROJ);
export const fwd = WP.fwd, inv = WP.inv;
// ——— растр ———
const KP = 2; // км на пиксель
const W = Math.ceil(PROJ.w / KP), H = Math.ceil(PROJ.h / KP), N = W * H;
log(`растр ${W}×${H} (${KP} км/пкс)`);
const LON = new Float32Array(N), LAT = new Float32Array(N);
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const [lo, la] = inv((x + 0.5) * KP, (y + 0.5) * KP); LON[y * W + x] = lo; LAT[y * W + x] = la; }
const BX = [-45, 90, 20, 80]; // долгота, широта: рамка для обрезки многоугольников
const inBox = (lo, la) => lo > BX[0] && lo < BX[1] && la > BX[2] && la < BX[3];
const clampLL = (lo, la) => [Math.max(BX[0], Math.min(BX[1], lo)), Math.max(BX[2], Math.min(BX[3], la))];
function ringsOf(gm) {
  const polys = gm.type === 'Polygon' ? [gm.coordinates] : gm.type === 'MultiPolygon' ? gm.coordinates : [];
  const out = [];
  for (const P of polys) {
    let any = false;
    for (const [lo, la] of P[0]) if (inBox(lo, la)) { any = true; break; }
    if (!any) continue;
    out.push(P.map((ring) => ring.map(([lo, la]) => { const [X, Y] = fwd(...clampLL(lo, la)); return [X / KP, Y / KP]; })));
  }
  return out;
}
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
const RESV = /reservoir|vodokhr|vodoskh|kakhov|kremench|kyyiv|kaniv|kuybysh|volgograd|tsimly|gor.kov|saratov|cheboks|votkin|nizhnekam|rybinsk|dniprodz|dneprodz|kama|kiev|kiyev|dnieper|dnipro|ivankov|uglich|sheksn|kegums|plavinas|dubossar|mingech|vileyka|krasnodar|zeya|tsimlyansk|nasser|assad|tharthar|qadisiyah|keban|atat|razzaza|habbaniyah|alqueva/i;
const lakes = [];
for (const ft of geo('ne_10m_lakes.geojson').features) {
  const p = ft.properties || {}, nm = p.name || p.name_en || '';
  if (RESV.test(nm) || RESV.test(p.name_alt || '') || (p.featurecla || '').includes('Reservoir')) continue;
  for (const rs of ringsOf(ft.geometry)) {
    let a = 0; const r = rs[0];
    for (let i = 0, j = r.length - 1; i < r.length; j = i++) a += (r[j][0] + r[i][0]) * (r[j][1] - r[i][1]);
    if (Math.abs(a / 2) * KP * KP < 150) continue;
    fillPoly(rs, LAND, 2);
    lakes.push({ nm, rs, area: Math.abs(a / 2) * KP * KP });
  }
}
log('озёр', lakes.length);
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
const lerp = (pts, v) => {
  if (v <= pts[0][0]) return pts[0][1];
  for (let k = 1; k < pts.length; k++) if (v <= pts[k][0]) { const [a, x0] = pts[k - 1], [b, x1] = pts[k]; return x0 + ((v - a) * (x1 - x0)) / (b - a); }
  return pts[pts.length - 1][1];
};
// ——— правила «Восточного фронта» (как в build-east.mjs): какая суша — области map.json ———
const LINE_N = [[52.0, 23.6], [52.35, 23.0], [52.75, 22.15], [53.2, 21.95], [54.0, 22.3], [54.5, 22.6]];
const LINE_S = [[49.0, 22.6], [49.2, 22.4], [49.45, 22.15], [49.6, 22.3], [49.78, 22.77], [50.0, 22.8], [50.3, 23.4], [50.5, 24.1]];
const NTRANS = [[22.0, 48.1], [21.9, 47.4], [21.85, 46.95], [22.6, 46.85], [23.4, 46.62], [24.0, 46.58], [24.6, 46.4], [25.1, 46.15], [25.6, 45.8], [26.0, 45.72], [26.45, 45.95], [26.1, 46.5], [25.85, 47.1], [25.3, 47.35], [24.9, 47.75], [24.4, 47.95], [23.5, 48.1], [22.9, 48.1]];
const SOVPL = (lo, la) => (la >= 52.0 && la < 54.6 && lo > lerp(LINE_N, la)) || (la < 50.5 && la > 48.9 && lo > lerp(LINE_S, la));
// Испанское Марокко и Танжер
const SPMOR = [[-6.4, 35.85], [-5.9, 35.95], [-5.3, 35.95], [-4.6, 35.3], [-3.9, 35.25], [-3.0, 35.4], [-2.2, 35.15], [-2.15, 35.0], [-3.2, 34.9], [-4.2, 34.85], [-5.0, 34.9], [-5.9, 34.95], [-6.5, 35.05]];
function owner41(c, lo, la, world) {
  const SIMPLE = {
    DEU: 'GER', AUT: 'GER', CZE: 'GER', LUX: 'GER', NLD: 'GER', BEL: 'GER', DNK: 'GER', NOR: 'GER', LVA: 'SOV', EST: 'SOV', BLR: 'SOV', MDA: 'SOV',
    HUN: 'HUN', BGR: 'BUL', FIN: 'FIN', ITA: 'ITA', ALB: 'ITA', SMR: 'ITA', VAT: 'ITA', MNE: 'ITA', KOS: 'ITA', HRV: 'CRO', BIH: 'CRO', SWE: 'SWE',
    TUR: 'TUR', ESP: 'ESP', AND: 'ESP', PRT: 'POR', CHE: 'SUI', LIE: 'SUI', GBR: 'UK', IMN: 'UK', IRL: 'IRL', CYP: 'UK', CYN: 'UK', MLT: 'UK',
    IRN: 'IRN', GEO: 'SOV', ARM: 'SOV', AZE: 'SOV', KAZ: 'SOV', TKM: 'SOV', UZB: 'SOV', MCO: 'VIC', FRO: world ? 'UK' : 'GER', ALA: 'FIN',
    ...(world
      ? { GGY: 'GER', JEY: 'GER', GIB: 'UK', SYR: 'VIC', LBN: 'VIC', IRQ: 'UK', KWT: 'UK', ISR: 'UK', PSX: 'UK', JOR: 'UK', EGY: 'UK', LBY: 'ITA', TUN: 'VIC', DZA: 'VIC', MAR: 'VIC', SAH: 'VIC', SAU: 'SAU', ISL: 'NEU' }
      : { SYR: 'AFR', IRQ: 'AFR', LBN: 'AFR', ISR: 'AFR', PSX: 'AFR', JOR: 'AFR', EGY: 'AFR', LBY: 'AFR', TUN: 'AFR', DZA: 'AFR', MAR: 'AFR', SAH: 'AFR' }),
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
  if (world && c === 'MAR' && inPoly(lo, la, SPMOR)) return 'ESP';
  return SIMPLE[c] || (world ? 'NEU' : 'AFR');
}
// нации карты: первые 13 — как в map.json (индексы областей Востока те же)
const NATS_E = ['', 'GER', 'SOV', 'FIN', 'ROM', 'HUN', 'SVK', 'BUL', 'CRO', 'ITA', 'SWE', 'TUR', 'IRN', 'NEU'];
export const NATS = NATS_E.concat(['UK', 'VIC', 'USA', 'ESP', 'POR', 'SUI', 'IRL', 'SAU']);
const NI = Object.fromEntries(NATS.map((k, i) => [k, i])), NIE = Object.fromEntries(NATS_E.map((k, i) => [k, i]));
const OFF_E = new Set(['SWE', 'DNK', 'ITA', 'ALB', 'MNE', 'KOS', 'GRC', 'MKD', 'TUR', 'IRN', 'IRQ', 'SYR', 'KAZ', 'TKM', 'UZB', 'NLD', 'BEL', 'LUX', 'CHE', 'LIE', 'FRA', 'SMR', 'VAT', 'CYP', 'CYN', 'LBN', 'ISR', 'JOR', 'PSX', 'EGY', 'LBY', 'TUN', 'DZA', 'GBR', 'IRL', 'ESP', 'PRT', 'AND', 'MCO', 'MLT', 'GEO_ABK']);
// Запад: нейтральная и неактивная суша
const OFF_W = new Set(['SWE', 'TUR', 'KAZ', 'TKM', 'UZB', 'AFG', 'PAK', 'CHE', 'LIE', 'IRL', 'ESP', 'PRT', 'AND', 'GIB', 'SAU', 'ISL', 'GRL', 'YEM', 'OMN', 'ARE', 'QAT', 'BHR', 'SDN', 'TCD', 'NER', 'MLI', 'MRT', 'ESH', 'SAH', 'GEO_ABK']);
// пустыня (южнее линии — неактивна): долгота → широта
const DES = [[-11, 31.2], [-8, 31.4], [-6, 32.2], [-4, 32.5], [-2, 32.9], [0, 33.2], [2, 33.5], [6, 34.0], [7.5, 33.6], [8.5, 33.2], [10, 32.8], [11, 31.4], [13, 31.2], [15, 30.9], [16.5, 30.6], [18.5, 30.0], [19.5, 29.9], [20.5, 30.3], [22, 30.6], [24.5, 30.7], [25.8, 30.6], [27, 30.3], [28.5, 30.0], [29.3, 29.9], [29.9, 28.8], [31.6, 28.8], [32.2, 29.4], [35, 29.4]];
const KAVIR = [[51.6, 34.8], [53.0, 35.2], [54.5, 35.6], [56, 35.2], [57, 34.0], [55, 33.4], [53.5, 33.6], [52.2, 34.0]];
const isDesert = (c, lo, la) => ((c === 'MAR' || c === 'DZA' || c === 'TUN' || c === 'LBY' || c === 'EGY' || c === 'SAH') && la < lerp(DES, lo)) || (c === 'IRN' && inPoly(lo, la, KAVIR));
// ——— владельцы, играбельная суша ———
const EJ = JSON.parse(fs.readFileSync(path.join(OUT, 'map.json'), 'utf8'));
const EPJ = lcc(EJ.proj), RE_ = EJ.regs.length;
// рамка карты Востока: её западный край идёт от Гамбурга к Зальцбургу и Калабрии — западнее него суша по правилам Запада
const inEast = (lo, la) => { const [x, y] = EPJ.fwd(lo, la); return x >= 0 && y >= 0 && x <= EJ.w && y <= EJ.h; };
// EDOM — суша областей Востока (по правилам build-east.mjs), OWN — владелец, PLAY: 1 — области, 2 — нейтральная/неактивная суша
const OWN = new Uint8Array(N), PLAY = new Uint8Array(N), EDOM = new Uint8Array(N), DESF = new Uint8Array(N);
for (let i = 0; i < N; i++) {
  if (LAND[i] !== 1) continue;
  const c = CTY[CTYI[i]] || '';
  if (!c) continue;
  const lo = LON[i], la = LAT[i];
  let oe = owner41(c, lo, la, false);
  if (!NIE[oe]) oe = 'NEU';
  const offE = OFF_E.has(c) || (c === 'NOR' && la < 68.2) || lo < 9.3 || (c === 'AZE' && lo < 46.2 && la < 40.3);
  const playE = offE || oe === 'NEU' || oe === 'SWE' || oe === 'TUR' || oe === 'IRN' || oe === 'ITA' ? 2 : 1;
  if (playE === 1 && inEast(lo, la)) { EDOM[i] = 1; OWN[i] = NI[oe]; PLAY[i] = 1; continue; }
  if (playE === 1 && lo >= 30) { OWN[i] = NI[oe]; PLAY[i] = 2; continue; } // за рамкой Востока на севере и востоке (Ямал, Урал) — неактивна
  let o = owner41(c, lo, la, true);
  if (!NI[o]) o = 'NEU';
  OWN[i] = NI[o];
  const des = isDesert(c, lo, la);
  des && (DESF[i] = 1);
  PLAY[i] = OFF_W.has(c) || des || o === 'NEU' || o === 'SWE' || o === 'TUR' || o === 'ESP' || o === 'POR' || o === 'SUI' || o === 'IRL' || o === 'SAU' || (c === 'AZE' && lo < 46.2 && la < 40.3) ? 2 : 1;
}
// дыры между полигонами стран — по ближайшему соседу
for (let pass = 0; pass < 6; pass++) {
  let left = 0;
  for (let i = 0; i < N; i++) {
    if (LAND[i] !== 1 || OWN[i]) continue;
    const x = i % W;
    let got = 0;
    for (const j of [i - 1, i + 1, i - W, i + W]) if (j >= 0 && j < N && Math.abs((j % W) - x) <= 1 && OWN[j] && j !== i) { OWN[i] = OWN[j]; PLAY[i] = PLAY[j]; EDOM[i] = EDOM[j]; CTYI[i] || (CTYI[i] = CTYI[j]); got = 1; break; }
    got || left++;
  }
  if (!left) break;
}
const cntBy = (arr, n) => { const c = new Array(n).fill(0); for (let i = 0; i < N; i++) c[arr[i]]++; return c; };
{ const c = cntBy(OWN, NATS.length); log('владельцы (тыс. км²):', NATS.map((k, i) => k && c[i] && `${k}:${Math.round((c[i] * KP * KP) / 1000)}`).filter(Boolean).join(' ')); }

// ——— области Востока: многоугольники map.json в растр большой карты ———
const e2w = (x, y) => fwd(...EPJ.inv(x, y));
const EARC = EJ.arcs.map(([, , , s]) => { const p = decPts(s), o = []; for (let k = 0; k < p.length; k += 2) { const [X, Y] = e2w(p[k], p[k + 1]); o.push([X / KP, Y / KP]); } return o; });
const EL = new Int32Array(N).fill(-1);
EJ.regs.forEach((g, r) => {
  const rings = g.rg.map((ring) => { const pts = []; for (const k of ring) { const a = k < 0 ? EARC[~k].slice().reverse() : EARC[k]; for (const p of a) pts.push(p); } return pts; });
  fillPoly(rings, EL, r);
});
const LAB = new Int32Array(N).fill(-1);
{
  let cov = 0, miss = 0;
  for (let i = 0; i < N; i++) {
    if (!EDOM[i] || PLAY[i] !== 1) continue;
    if (EL[i] >= 0) { LAB[i] = EL[i]; OWN[i] = EJ.regs[EL[i]].o; cov++; } else miss++;
  }
  // непокрытая суша Востока — соседним областям Востока
  for (let pass = 0; pass < 8 && miss; pass++) {
    let fixed = 0;
    for (let i = 0; i < N; i++) {
      if (!EDOM[i] || PLAY[i] !== 1 || LAB[i] >= 0) continue;
      const x = i % W;
      for (const j of [i - 1, i + 1, i - W, i + W]) if (j >= 0 && j < N && Math.abs((j % W) - x) <= 1 && LAB[j] >= 0 && LAB[j] < RE_) { LAB[i] = LAB[j]; OWN[i] = OWN[j]; fixed++; break; }
    }
    miss -= fixed;
    if (!fixed) break;
  }
  for (let i = 0; i < N; i++) if (EDOM[i] && PLAY[i] === 1 && LAB[i] < 0) PLAY[i] = 2;
  // пиксели многоугольников Востока вне его суши (край у меридиана 9,3°, Швейцария…) — по правилам Запада
  log('области Востока:', RE_, 'покрыто пкс', cov, 'не покрыто (стало неактивным)', miss);
}

// мелкие острова Запада (меньше ISL_MIN км², кроме Мальты) — неактивны: Корфу, Кос, Пантеллерия, Мэн…
{
  const ISL_MIN = 2000, keep = FORCE.map((n) => WSITES.find((w) => w[0] === n)).filter(Boolean).map(([, lo, la]) => { const [X, Y] = fwd(lo, la); return [X / KP, Y / KP]; });
  const { list } = components((i) => PLAY[i] === 1, () => 0);
  let off = 0;
  for (const L of list) {
    if (L.px.length * KP * KP >= ISL_MIN || L.px.some((p) => EDOM[p])) continue;
    if (L.px.some((p) => keep.some(([x, y]) => Math.abs((p % W) - x) <= 4 && Math.abs(((p / W) | 0) - y) <= 4))) continue;
    for (const p of L.px) PLAY[p] = 2;
    off++;
  }
  log('мелких островов Запада снято', off);
}

// ——— рельеф: Terrarium z6 (Web Mercator) ———
const DEMZ = 6, DEMD = path.join(D, 'dem');
fs.mkdirSync(DEMD, { recursive: true });
const TX0 = 26, TX1 = 45, TY0 = 11, TY1 = 28, TS = 256;
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
// ——— растительность: Natural Earth II ———
const NE2F = path.join(D, 'ne2', 'NE2_LR_LC.tif');
if (!fs.existsSync(NE2F)) {
  fs.mkdirSync(path.join(D, 'ne2'), { recursive: true });
  execSync(`curl -s -o ${path.join(D, 'ne2.zip')} https://naciscdn.org/naturalearth/10m/raster/NE2_LR_LC.zip && unzip -o -q ${path.join(D, 'ne2.zip')} -d ${path.join(D, 'ne2')}`);
}
const NX0 = (-40 + 180) * 45, NY0 = (90 - 78) * 45, NW = 125 * 45, NH = 56 * 45;
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
const OPEN = new Float32Array(N);
for (let i = 0; i < N; i++) {
  if (LAND[i] !== 1) continue;
  const [r] = ne2At(LON[i], LAT[i]);
  OPEN[i] = Math.max(0, Math.min(1, (r - 172) / 45));
}
// болота (долгота, широта)
const MARSH = [
  [[23.5, 52.4], [25.5, 52.6], [27.5, 52.55], [29.5, 52.25], [30.4, 51.95], [30.2, 51.3], [28.5, 51.35], [26.5, 51.4], [24.8, 51.55], [23.8, 51.9]],
  [[30.5, 58.0], [31.4, 57.3], [32.9, 57.4], [33.5, 58.6], [33.0, 59.4], [31.9, 59.85], [31.0, 59.6], [30.9, 58.7]],
  [[22.2, 53.3], [23.0, 53.2], [23.4, 53.6], [22.8, 53.8], [22.2, 53.6]],
  [[28.6, 45.0], [29.75, 44.85], [29.75, 45.5], [28.9, 45.45]],
  [[37.3, 45.0], [38.5, 45.0], [38.4, 46.0], [37.8, 45.9], [37.3, 45.5]],
  [[39.2, 55.0], [41.0, 55.0], [41.2, 55.7], [39.6, 55.9], [39.0, 55.5]],
  [[27.2, 56.6], [28.3, 56.3], [29.0, 57.0], [28.0, 57.4]],
  [[46.4, 30.8], [47.6, 30.9], [47.8, 31.9], [46.9, 32.1], [46.3, 31.5]], // месопотамские болота
  [[4.35, 43.4], [4.85, 43.35], [4.9, 43.7], [4.4, 43.7]], // Камарг
];
const MAR = new Uint8Array(N);
for (const P of MARSH) { const rs = [P.map(([lo, la]) => { const [X, Y] = fwd(lo, la); return [X / KP, Y / KP]; })]; fillPoly(rs, MAR, 1); }
for (let i = 0; i < N; i++) LAND[i] !== 1 && (MAR[i] = 0);
// ——— реки: растр (1 — малая, 2 — большая) и ломаные ———
const MAJOR = new Set(Function('return ' + grab('const MAJOR = new Set(['))());
const MINOR = new Set(Function('return ' + grab('const MINOR = new Set(['))());
for (const n of ['Volga', 'Don', 'Dnieper', 'Dnepr', 'Dnipro', 'Daugava', 'Zapadnaya Dvina', 'Western Dvina', 'Neman', 'Nemunas', 'Dniester', 'Dnister', 'Vistula', 'Wisła', 'Oder', 'Odra', 'Danube', 'Elbe', 'Severnaya Dvina', 'Northern Dvina', 'Kama', 'Ural', 'Kura',
  'Rhin', 'Waal', 'Nederrijn', 'Shatt al Arab', 'Firat', 'Al Furat', 'Dicle', 'Rosetta Branch', 'Damietta Branch']) MAJOR.add(n);
for (const n of ['Lovat', 'Lovat’', 'Mius', 'Manych', 'Vorskla', 'Psel', 'Sula', 'Ingulets', 'Inhulets', 'Sal', 'Chir', 'Aksay', 'Ros', 'Teteriv', 'Horyn', 'Styr', 'Sluch', 'Ptsich', 'Drut', 'Ugra', 'Zhizdra', 'Moskva', 'Klyazma', 'Vazuza', 'Sukhona', 'Vychegda', 'Onega', 'Kem', 'Kovda', 'Tuloma', 'Kola', 'Sheksna', 'Vetluga', 'Vyatka', 'Belaya', 'Ufa', 'Chusovaya', 'Samara', 'Medveditsa', 'Ilovlya', 'Bityug', 'Voronezh', 'Tsna', 'Moksha', 'Mologa', 'Tvertsa', 'Western Bug', 'Bug', 'Pripyat', 'Prypiat', 'Pripyat’', 'Desna', 'Seym', 'Oskil', 'Oskol', 'Aidar', 'Siverskyi Donets', 'Severskiy Donets', 'Donets', 'Kuban', 'Terek', 'Sulak', 'Kuma', 'Rioni', 'Aras', 'Mures', 'Mureș', 'Olt', 'Siret', 'Prut', 'Tisza', 'Tisa', 'Drava', 'Sava', 'Morava', 'Vah', 'Váh', 'Hron', 'Warta', 'Noteć', 'Narew', 'San', 'Pilica', 'Bzura', 'Neisse', 'Nysa Łużycka', 'Spree', 'Havel', 'Oka', 'Sura', 'Velikaya', 'Narva', 'Luga', 'Volkhov', 'Svir', 'Neva', 'Msta', 'Vuoksi', 'Kymijoki', 'Kemijoki', 'Oulujoki', 'Berezina', 'Byarezina', 'Sozh', 'Southern Bug', 'Pivdennyi Buh', 'Inhul', 'Dnieper-Bug',
  'IJssel', 'Lek', 'Arno', 'Volturno', 'Garigliano', 'Liri', 'Rapido', 'Sangro', 'Adige', 'Piave', 'Tanaro', 'Ticino', 'Adda', 'Oglio', 'Reno', 'Saône', 'Durance', 'Dordogne', 'Lot', 'Vienne', 'Cher', 'Allier', 'Orne', 'Vire', 'Oise', 'Sambre', 'Sarre', 'Saar', 'Ruhr', 'Lippe', 'Neckar', 'Jordan', 'Litani', 'Orontes', 'Aliakmon', 'Struma', 'Axios', 'Drin', 'Neretva', 'Isonzo', 'Soča', 'Glomma', 'Trent', 'Great Ouse', 'Tay', 'Tweed', 'Karun', 'Diyala', 'Suez Canal', 'Charente', 'Vilaine', 'Mayenne', 'Sarthe', 'Eure', 'Aube', 'Somme']) MINOR.add(n);
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

// ——— зёрна областей Запада ———
function cellKm(lo, la, nat, c) {
  if (c === 'GBR' || c === 'IMN') return la > 56.6 ? 130 : la > 54.8 ? 100 : 82;
  if (c === 'FRA') return lo > 8.4 && la < 43.1 ? 80 : nat === 'VIC' ? 105 : 85;
  if (c === 'BEL' || c === 'NLD' || c === 'LUX') return 72;
  if (c === 'DEU') return 84;
  if (c === 'DNK') return 80;
  if (c === 'NOR') return la > 64 ? 190 : 150;
  if (c === 'ITA' || c === 'SMR' || c === 'VAT') return la < 38.4 && lo > 12 ? 75 : la > 38.7 && la < 41.3 && lo < 10 ? 105 : la > 45.8 ? 92 : 80;
  if (c === 'SVN' || c === 'MNE' || c === 'KOS' || c === 'MKD' || c === 'ALB' || c === 'SRB') return 90;
  if (c === 'GRC') return 95;
  if (c === 'TUN') return 74;
  if (c === 'DZA') return lo < 4 ? 130 : 115;
  if (c === 'MAR') return 125;
  if (c === 'LBY') return lo > 19.5 ? 95 : lo > 14.8 ? 140 : 115;
  if (c === 'EGY') return lo > 32.3 ? 140 : lo < 29.6 ? 95 : la < 30.2 ? 120 : 92;
  if (c === 'ISR' || c === 'PSX' || c === 'LBN') return 78;
  if (c === 'JOR') return lo > 36.4 ? 190 : 120;
  if (c === 'SYR') return lo < 37.4 ? 95 : 170;
  if (c === 'IRQ') return lo < 42 ? 230 : 155;
  if (c === 'KWT') return 130;
  if (c === 'CYP' || c === 'CYN') return 90;
  if (c === 'IRN') return la > 36 && lo < 54.5 ? 150 : 220;
  return 120;
}
const CAP_R = WCAP_R;
const cand = [];
const RU = new Map();
// города Запада: WSITES и западные города CITY41 (там, где суша — не области Востока)
for (const [n, lo, la, sz, fl] of CITY41) RU.set(n, { n, lo, la, sz, fl: fl || '' });
for (const [n, lo, la, ind, fl] of WSITES) {
  const c = RU.get(n) || { n, lo, la, sz: 1, fl: '' };
  c.lo = lo; c.la = la; c.ind = ind; c.sf = fl;
  const v = +((/v(\d+)/.exec(fl) || [])[1] || 0);
  c.sz = Math.max(c.sz, ind >= 3 || v >= 5 ? 3 : ind >= 1 || v >= 2 ? 2 : c.sz);
  c.west = 1;
  RU.set(n, c);
}
const ENAMES = new Set(EJ.regs.map((g) => g.n)), ECITY = new Set(EJ.cities.map((c) => c[0]));
const places = [];
for (const ft of geo('ne_10m_populated_places.geojson').features) {
  const p = ft.properties, [lo, la] = ft.geometry.coordinates;
  if (lo < -14 || lo > 66 || la < 26 || la > 72) continue;
  let n = p.NAME_RU;
  if (n in RENAME41) n = RENAME41[n];
  if (n in RENAME_W) n = RENAME_W[n];
  if (!n || ENAMES.has(n) || ECITY.has(n)) continue;
  places.push({ n, lo, la, pop: p.POP_MAX || 0 });
}
for (const [n, lo, la] of EXTRA_W) if (!ENAMES.has(n) && !ECITY.has(n) && !places.some((p) => p.n === n)) places.push({ n, lo, la, pop: 2e5 });
const pix = (lo, la) => { const [X, Y] = fwd(lo, la); const x = Math.floor(X / KP), y = Math.floor(Y / KP); return x >= 0 && y >= 0 && x < W && y < H ? y * W + x : -1; };
const isW = (i) => PLAY[i] === 1 && !EDOM[i] && LAB[i] < 0;
function landPix(lo, la, r = 4, ok = (i) => PLAY[i] === 1) {
  const i0 = pix(lo, la);
  if (i0 < 0) return -1;
  if (ok(i0)) return i0;
  const x0 = i0 % W, y0 = (i0 / W) | 0;
  let best = -1, bd = 1e9;
  for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    const x = x0 + dx, y = y0 + dy;
    if (x < 0 || y < 0 || x >= W || y >= H || !ok(y * W + x)) continue;
    const d = dx * dx + dy * dy;
    d < bd && ((bd = d), (best = y * W + x));
  }
  return best;
}
// страна у каждого места (для названий «… (окр.)» — только своей страны)
const ctyAt = (lo, la) => { const i = landPix(lo, la, 4, (k) => LAND[k] === 1); return i >= 0 ? CTY[CTYI[i]] || '' : ''; };
for (const p of places) p.c = ctyAt(p.lo, p.la);
for (const c of RU.values()) c.c = ctyAt(c.lo, c.la);
for (const c of RU.values()) {
  if (ECITY.has(c.n) || ENAMES.has(c.n)) continue;
  const i = landPix(c.lo, c.la, 4, isW);
  if (i < 0) continue;
  cand.push({ n: c.n, i, pr: 100 + c.sz * 20 + (c.ind || 0) * 5 + (/[xf]/.test(c.fl + ' ' + (c.sf || '')) ? 6 : 0) + (FORCE.includes(c.n) ? 500 : 0), city: c, cap: CAP_R[c.n] || 0, force: FORCE.includes(c.n) });
}
for (const p of places) {
  const i = landPix(p.lo, p.la, 2, isW);
  if (i < 0 || RU.has(p.n)) continue;
  cand.push({ n: p.n, i, pr: 10 + Math.log10(1 + p.pop) * 5 });
}
cand.sort((a, b) => b.pr - a.pr);
const KEY = (i) => OWN[i] * 1024 + CTYI[i]; // область не пересекает границ стран и владельцев
const SPX = (i) => cellKm(LON[i], LAT[i], NATS[OWN[i]], CTY[CTYI[i]]) / KP;
let seeds = EJ.regs.map((g, r) => ({ n: g.n, east: 1, r, sp: 1e9 }));
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
  if (!isW(c.i)) continue;
  const sp = c.cap ? Math.max(c.cap * 1.6, 60) / KP : SPX(c.i);
  if (c.force || seedOk(c.i, sp, c.pr >= 160 ? 0.62 : 0.8)) addSeed(c);
}
let rs = 12345;
const rnd = () => ((rs = (Math.imul(rs, 1103515245) + 12345) >>> 0), rs / 4294967296);
for (let k = 0; k < 1200000; k++) {
  const i = Math.floor(rnd() * N);
  if (!isW(i)) continue;
  if (seedOk(i, SPX(i), 0.86)) addSeed({ n: '', i, pr: 0 });
}
log('зёрен Запада', seeds.length - RE_, 'из них городов', seeds.filter((s) => s.city).length);
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
  const { comp, list } = components(isW, KEY);
  const has = new Uint8Array(list.length);
  for (const s of seeds) if (!s.east) has[comp[s.i]] = 1;
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
// ——— рост областей Запада (Дейкстра по растру); области Востока уже размечены ———
const COST = new Float32Array(N).fill(Infinity);
for (let i = 0; i < N; i++) if (LAB[i] >= 0) COST[i] = 0;
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
seeds.forEach((s, k) => { if (s.east) return; LAB[s.i] = k; COST[s.i] = 0; hpush(0, s.i); });
// области Востока у края его рамки (Германия, Австрия, Норвегия) прирастают на Запад до EGROW км — без прямой линии рамки
const EGROW = 55;
for (let i = 0; i < N; i++) {
  if (LAB[i] < 0 || LAB[i] >= RE_) continue;
  const x = i % W;
  for (const j of [i - 1, i + 1, i - W, i + W]) if (j >= 0 && j < N && Math.abs((j % W) - x) <= 1 && isW(j) && KEY(j) === KEY(i)) { hpush(0, i); break; }
}
const NB8 = [[-1, 0, KP], [1, 0, KP], [0, -1, KP], [0, 1, KP], [-1, -1, SQ2], [1, -1, SQ2], [-1, 1, SQ2], [1, 1, SQ2]];
while (hn) {
  const [c, i] = hpop();
  if (c > COST[i]) continue;
  const east = LAB[i] < RE_, s = seeds[LAB[i]], x = i % W, y = (i / W) | 0, key = east ? KEY(i) : KEY(s.i);
  for (const [dx, dy, st] of NB8) {
    const nx = x + dx, ny = y + dy;
    if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
    const j = ny * W + nx;
    if (PLAY[j] !== 1 || EDOM[j] || KEY(j) !== key) continue;
    if (s.cap && (nx - s.x) ** 2 + (ny - s.y) ** 2 > (capAt(s, nx, ny) / KP) ** 2) continue;
    const nc = c + st + (RIV[j] === 2 && !RIV[i] ? 55 : RIV[j] === 1 && !RIV[i] ? 18 : RIV[j] ? 6 : 0) + Math.abs(ELEV[j] - ELEV[i]) / 28;
    if (east && nc > EGROW) continue;
    if (nc < COST[j]) { COST[j] = nc; LAB[j] = LAB[i]; hpush(nc, j); }
  }
}
// незанятая суша — соседям (сначала того же владельца)
for (let pass = 0; pass < 200; pass++) {
  let left = 0;
  for (let i = 0; i < N; i++) {
    if (PLAY[i] !== 1 || LAB[i] >= 0) continue;
    const x = i % W;
    let got = -1;
    for (const j of [i - 1, i + 1, i - W, i + W]) if (j >= 0 && j < N && Math.abs((j % W) - x) <= 1 && LAB[j] >= 0 && PLAY[j] === 1) { if (OWN[j] === OWN[i]) { got = LAB[j]; break; } got < 0 && (got = LAB[j]); }
    got >= 0 ? (LAB[i] = got) : left++;
  }
  if (!left) break;
}
function fixPieces() {
  let moved = 0;
  const { list } = components((i) => PLAY[i] === 1 && LAB[i] >= 0, (i) => LAB[i]);
  const best = new Map();
  list.forEach((L, c) => { const b = best.get(L.key); (b === undefined || list[b].px.length < L.px.length) && best.set(L.key, c); });
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
// мелкие области Запада — соседу Запада того же владельца с самой длинной общей границей
{
  const area = new Map();
  for (let i = 0; i < N; i++) LAB[i] >= 0 && PLAY[i] === 1 && area.set(LAB[i], (area.get(LAB[i]) || 0) + 1);
  let merged = 0;
  for (const [k, a] of [...area].sort((p, q) => p[1] - q[1])) {
    const s = seeds[k];
    if (s.east || s.cap || s.force || a * KP * KP >= 0.2 * (s.sp * KP) ** 2) continue;
    const cnt = new Map();
    for (let i = 0; i < N; i++) {
      if (LAB[i] !== k) continue;
      const x = i % W;
      for (const j of [i - 1, i + 1, i - W, i + W]) if (j >= 0 && j < N && Math.abs((j % W) - x) <= 1 && LAB[j] >= 0 && LAB[j] !== k && !seeds[LAB[j]].east && OWN[seeds[LAB[j]].i] === OWN[s.i]) cnt.set(LAB[j], (cnt.get(LAB[j]) || 0) + (KEY(seeds[LAB[j]].i) === KEY(s.i) ? 3 : 1));
    }
    let to = -1, bn = 0;
    for (const [q, v] of cnt) v > bn && ((bn = v), (to = q));
    if (to < 0) {
      // нет соседа Запада — соседу Востока того же владельца (обрезки у рамки Востока: Истрия, север Норвегии)
      for (let i = 0; i < N; i++) {
        if (LAB[i] !== k) continue;
        const x = i % W;
        for (const j of [i - 1, i + 1, i - W, i + W]) if (j >= 0 && j < N && Math.abs((j % W) - x) <= 1 && LAB[j] >= 0 && LAB[j] < RE_ && EJ.regs[LAB[j]].o === OWN[s.i]) cnt.set(LAB[j], (cnt.get(LAB[j]) || 0) + 1);
      }
      for (const [q, v] of cnt) v > bn && ((bn = v), (to = q));
    }
    if (to < 0) continue;
    for (let i = 0; i < N; i++) LAB[i] === k && (LAB[i] = to);
    area.set(to, (area.get(to) || 0) + a); area.delete(k); merged++;
  }
  log('слито мелких областей', merged);
}
for (let k = 0; k < 3 && fixPieces(); k++);
// перенумерация: области Востока — первыми, с прежними номерами
const used = [...new Set(Array.from(LAB).filter((v) => v >= 0))].sort((a, b) => a - b), remap = new Map(used.map((v, k) => [v, k]));
for (let r = 0; r < RE_; r++) if (remap.get(r) !== r) throw new Error('пропала область Востока ' + EJ.regs[r].n);
for (let i = 0; i < N; i++) LAB[i] >= 0 && (LAB[i] = remap.get(LAB[i]));
seeds = used.map((v) => seeds[v]);
const R = seeds.length;
log('областей', R, '(Восток', RE_, '· Запад', R - RE_, ')');
for (let i = 0; i < N; i++) if (PLAY[i] === 1 && LAB[i] < 0) PLAY[i] = 2;
// пиксель-«зерно» для областей Востока (центр из map.json)
for (let r = 0; r < RE_; r++) {
  const g = EJ.regs[r], [X, Y] = e2w(g.x, g.y);
  let i = pix(...inv(X, Y));
  if (i < 0 || LAB[i] !== r) { i = -1; for (let k = 0; k < N; k++) if (LAB[k] === r) { i = k; break; } }
  seeds[r].i = i; seeds[r].x = i % W; seeds[r].y = (i / W) | 0; seeds[r].wx = X; seeds[r].wy = Y;
}

// ——— неактивная суша — «псевдообласти»: нейтралы (Швеция, Турция, Испания…), пустыня, мелкие острова ———
const NEUT_N = { SWE: 'Швеция', NOR: 'Норвегия', TUR: 'Турция', IRN: 'Иран', KAZ: 'Казахстан', TKM: 'Туркмения', UZB: 'Узбекистан', AFG: 'Афганистан', AZE: 'Азербайджан', ESP: 'Испания', PRT: 'Португалия', CHE: 'Швейцария', IRL: 'Ирландия', ISL: 'Исландия', SAU: 'Саудовская Аравия', AND: 'Андорра', GRL: 'Гренландия', ITA: 'Италия' };
const pseudo = [];
{
  const pk = (i) => CTYI[i] * 4 + (DESF[i] ? 1 : 0) + (OWN[i] === NI.ESP && CTY[CTYI[i]] === 'MAR' ? 2 : 0);
  const { list } = components((i) => PLAY[i] === 2 && LAND[i] === 1, pk);
  for (const L of list) {
    if (L.px.length * KP * KP < 300) continue;
    const id = R + pseudo.length, c = CTY[L.key >> 2], des = L.key & 1, spm = L.key & 2;
    for (const p of L.px) LAB[p] = id;
    let sx = 0, sy = 0;
    for (const p of L.px) (sx += p % W), (sy += (p / W) | 0);
    const n = spm ? 'Испанское Марокко' : des ? (c === 'IRN' ? 'Деште-Кевир' : c === 'EGY' ? 'Ливийская пустыня' : 'Сахара') : NEUT_N[c] || '';
    pseudo.push({ c, n, area: L.px.length * KP * KP, x: (sx / L.px.length) * KP, y: (sy / L.px.length) * KP });
  }
  log('нейтральных и неактивных участков', pseudo.length);
}
// ——— метки для контуров: суша + 4 пкс в воду ———
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
const VIS_V = new Uint8Array(CW * H), VIS_H = new Uint8Array(W * (H + 1));
function cornerEdges(x, y) {
  const tl = LV(x - 1, y - 1), tr = LV(x, y - 1), bl = LV(x - 1, y), br = LV(x, y), e = [];
  tl !== tr && e.push(0); tr !== br && e.push(1); bl !== br && e.push(2); tl !== bl && e.push(3);
  return e;
}
const isJ = (x, y) => cornerEdges(x, y).length !== 2;
const edgeVis = (x, y, d) => (d === 0 ? VIS_V[(y - 1) * CW + x] : d === 2 ? VIS_V[y * CW + x] : d === 1 ? VIS_H[y * W + x] : VIS_H[y * W + x - 1]);
function markEdge(x, y, d) { d === 0 ? (VIS_V[(y - 1) * CW + x] = 1) : d === 2 ? (VIS_V[y * CW + x] = 1) : d === 1 ? (VIS_H[y * W + x] = 1) : (VIS_H[y * W + x - 1] = 1); }
const DXY = [[0, -1], [1, 0], [0, 1], [-1, 0]];
function edgePair(x, y, d) {
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
for (let y = 0; y <= H; y++)
  for (let x = 0; x <= W; x++) for (const d of cornerEdges(x, y)) if (!edgeVis(x, y, d)) trace(x, y, d);
log('дуг', arcs.length);
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
  if (closed) { const h = A.pts.length >> 1; A.s = [...dp(A.pts.slice(0, h + 1), 0.75), ...dp(A.pts.slice(h), 0.75).slice(1)]; } else A.s = dp(A.pts, 0.75);
  A.closed = closed;
}
for (const A of arcs) A.t = A.a >= 0 && A.a < R && A.b < R ? 0 : A.a < 0 ? (A.b < R ? 1 : 3) : A.a >= R ? 3 : 2;
const regArcs = Array.from({ length: R + pseudo.length }, () => []);
arcs.forEach((A, k) => { A.a >= 0 && regArcs[A.a].push(k); A.b >= 0 && A.b !== A.a && regArcs[A.b].push(k); });
const ck = (p) => p[0] * 100000 + p[1];
function ringsFor(r) {
  const ks = regArcs[r], byEnd = new Map(), usedA = new Set(), rings = [];
  for (const k of ks) {
    const A = arcs[k];
    if (A.closed) { rings.push([k]); usedA.add(k); continue; }
    for (const e of [ck(A.pts[0]), ck(A.pts[A.pts.length - 1])]) { byEnd.has(e) || byEnd.set(e, []); byEnd.get(e).push(k); }
  }
  for (const k0 of ks) {
    if (usedA.has(k0)) continue;
    const ring = [];
    let k = k0, rev = false;
    for (let guard = 0; guard < 5000; guard++) {
      usedA.add(k); ring.push(rev ? ~k : k);
      const A = arcs[k], end = rev ? A.pts[0] : A.pts[A.pts.length - 1];
      const nx = (byEnd.get(ck(end)) || []).find((q) => !usedA.has(q));
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
const RG = Array.from({ length: R }, (_, r) => ({ id: r, px: 0, mnt: 0, hil: 0, mar: 0, for: 0, ele: 0, des: 0, cty: new Map() }));
for (let i = 0; i < N; i++) {
  const r = LAB[i];
  if (r < 0 || r >= R) continue;
  const g = RG[r], e = ELEV[i], rel = RELF[i];
  g.px++; g.ele += e;
  g.cty.set(CTYI[i], (g.cty.get(CTYI[i]) || 0) + 1);
  if (e > 1300 || rel > 750) g.mnt++;
  else if (e > 420 || rel > 230) g.hil++;
  if (MAR[i]) g.mar++;
  else if (OPEN[i] < 0.38 && LAT[i] < 68.5) g.for++;
}
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
// соседства Востока — как в map.json (те же длины, реки и дороги), новые — по растру
const adjOut = EJ.adj.map((e) => e.slice());
for (const e of ADJ.values()) {
  if (e.n < 3 || (e.a < RE_ && e.b < RE_)) continue;
  adjOut.push([e.a, e.b, Math.round(e.n * KP), e.r2 / Math.max(1, e.n) >= 0.35 ? 2 : (e.r1 + e.r2) / Math.max(1, e.n) >= 0.35 ? 1 : 0, e.rail ? 1 : 0, '']);
}
// переправы Запада: Мессинский пролив, Малый и Большой Бельт, пролив Бонифачо, Эврип
const regAt = (lo, la) => { const i = landPix(lo, la, 8); return i >= 0 ? LAB[i] : -1; };
const hasAdj = new Set(adjOut.map(([a, b]) => akey(a, b)));
for (const [p, q, t] of [[[15.56, 38.24], [15.66, 38.2], 'sea'], [[9.72, 55.52], [9.86, 55.47], 'sea'], [[10.8, 55.3], [11.12, 55.36], 'sea'], [[9.17, 41.4], [9.22, 41.22], 'sea'], [[23.62, 38.48], [23.56, 38.44], 'sea']]) {
  const a = regAt(...p), b = regAt(...q);
  if (a >= 0 && b >= 0 && a !== b && a < R && b < R && !hasAdj.has(akey(a, b))) { adjOut.push([Math.min(a, b), Math.max(a, b), 0, 0, 0, t]); hasAdj.add(akey(a, b)); log('переправа', EJ.regs[a]?.n || seeds[a].n || a, '—', EJ.regs[b]?.n || seeds[b].n || b); }
}
log('соседств', adjOut.length, '(Восток', EJ.adj.length, ')');
// города: Восток — из map.json, Запад — WSITES и CITY41
const cityList = EJ.cities.map(([n, x, y, s, r]) => { const [X, Y] = e2w(x, y); return { n, x: X, y: Y, s, r, ind: 0, f: '', east: 1 }; });
for (const c of RU.values()) {
  if (ECITY.has(c.n) || ENAMES.has(c.n)) continue;
  const i = landPix(c.lo, c.la, 4, (k) => PLAY[k] === 1 && LAB[k] >= RE_);
  if (i < 0 || LAB[i] < RE_ || LAB[i] >= R) continue;
  const [X, Y] = fwd(c.lo, c.la);
  cityList.push({ n: c.n, x: X, y: Y, s: c.sz, r: LAB[i], ind: c.ind || 0, f: (c.sf || '') + ' ' + (c.fl || ''), lo: c.lo, la: c.la });
}
function zoneW(lo, la, c) {
  if (c === 'GBR' || c === 'IMN' || c === 'FRO') return 11;
  if (c === 'NOR') return 6;
  if (c === 'FRA' && lo > 8.4 && la < 43.1) return 7; // Корсика
  if (['FRA', 'BEL', 'NLD', 'LUX', 'DEU', 'DNK', 'GGY', 'JEY', 'MCO', 'CHE', 'LIE', 'AUT', 'CZE'].includes(c)) return 5;
  if (c === 'ITA' || c === 'SMR' || c === 'VAT') return 7;
  if (['ALB', 'GRC', 'MNE', 'KOS', 'MKD', 'SRB', 'SVN', 'HRV', 'BIH', 'BGR'].includes(c)) return 8;
  if (['EGY', 'LBY', 'TUN', 'DZA', 'MAR', 'MLT', 'SAH'].includes(c)) return 9;
  if (c === 'IRN') return la >= 35.8 ? 4 : 10;
  return 10;
}
const usedN = new Set(EJ.regs.map((g) => g.n));
const majC = (g) => { let bk = 0, bn = -1; for (const [k, v] of g.cty) v > bn && ((bn = v), (bk = k)); return CTY[bk] || ''; };
const regs = RG.map((g, r) => {
  const s = seeds[r], k = majC(g);
  if (r < RE_) {
    const e = EJ.regs[r];
    return { east: 1, n: e.n, o: e.o, x: Math.round(s.wx), y: Math.round(s.wy), area: e.a, t: e.t, z: e.z, ind: e.ind, vp: e.vp, f: e.f, ele: e.e, city: e.c, k };
  }
  const i = bestI[r], area = g.px * KP * KP;
  const nat = NATS[OWN[s.i]];
  const t = g.mnt / g.px > 0.3 ? 4 : g.mar / g.px > 0.28 ? 2 : (g.hil + g.mnt) / g.px > 0.38 ? 3 : g.for / g.px > 0.5 ? 1 : 0;
  const cs = cityList.filter((c) => c.r === r).sort((p, q) => q.s - p.s || q.ind - p.ind);
  let n = s.n && !usedN.has(s.n) ? s.n : '';
  if (!n && cs.length) n = cs.find((c) => !usedN.has(c.n))?.n || '';
  if (!n) {
    let bd = 1e18;
    for (const p of places) { if (usedN.has(p.n)) continue; const pi = landPix(p.lo, p.la, 1); if (pi >= 0 && LAB[pi] === r) { const d = -p.pop; d < bd && ((bd = d), (n = p.n)); } }
  }
  if (!n) {
    // ближайшее место своей страны в пределах 250 км (иначе — любой), «… (окр.)»; без повторов
    const cx = (i % W + 0.5) * KP, cy = (((i / W) | 0) + 0.5) * KP, near = [];
    for (const p of [...RU.values(), ...places]) {
      if (ENAMES.has(p.n) || ECITY.has(p.n)) continue;
      const [X, Y] = fwd(p.lo, p.la), d = (X - cx) ** 2 + (Y - cy) ** 2;
      d < 250 * 250 && near.push([d + (p.c === k ? 0 : 1e7), p.n]);
    }
    near.sort((a, b) => a[0] - b[0]);
    for (const [, pn] of near) if (!usedN.has(pn + ' (окр.)')) { n = pn + ' (окр.)'; break; }
    n || log('нет названия для области', r, k, Math.round(cx), Math.round(cy));
  }
  n && usedN.add(n);
  const cx = (i % W + 0.5) * KP, cy = (((i / W) | 0) + 0.5) * KP;
  const [lo, la] = inv(cx, cy);
  const fl = cs.map((c) => c.f).join(' ');
  const vp = cs.reduce((m, c) => Math.max(m, +((/v(\d+)/.exec(c.f) || [])[1] || 0)), 0);
  return {
    n: n || `Область ${r + 1}`, o: NATS.indexOf(nat), x: Math.round(cx), y: Math.round(cy), area: Math.round(area), t: TER[t],
    z: zoneW(lo, la, k), ind: cs.reduce((m, c) => m + c.ind, 0), vp, f: [/\bo\b/.test(fl) && 'o', /\bp\b/.test(fl) && 'p', /\bL\b/.test(fl) && 'L', /\bc\b/.test(fl) && 'c', /\bf\b/.test(fl) && 'f'].filter(Boolean).join(''),
    ele: Math.round(g.ele / g.px), city: cs.length ? cs[0].s : 0, k,
  };
});
{
  const seen = new Map();
  for (const g of regs) seen.set(g.n, (seen.get(g.n) || 0) + 1);
  const dup = regs.filter((g) => seen.get(g.n) > 1);
  dup.length && log('повторы названий:', [...new Set(dup.map((g) => g.n))].join(', '));
}
const ZN_ = ZONES_W.map((z) => z.n);
log('местность Запада:', TER.map((t) => `${t}:${regs.filter((g) => !g.east && g.t === t).length}`).join(' '), '· театры:', ZN_.map((z, k) => `${z}:${regs.filter((g) => g.z === k).length}`).join(' '));
log('по владельцам:', NATS.map((k, i) => k && regs.filter((g) => g.o === i).length && `${k}:${regs.filter((g) => g.o === i).length}`).filter(Boolean).join(' '));

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
        const r = ring.map(([lo, la]) => fwd(...clampLL(lo, la)));
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
const rivOut = [];
for (const rv of rivers) {
  const p = dp(rv.pts.map(([x, y]) => [x * KP, y * KP]), 0.9);
  if (p.length >= 2 && inFrame(p)) rivOut.push({ n: rv.nm, w: rv.w, p });
}
// ——— сетка рельефа: высота и цвет вершин ———
const MSTEP = +(process.env.MSTEP || 20);
const G = meshGrid(PROJ.w, PROJ.h, MSTEP);
const NV = G.nx * G.ny, VE = new Int16Array(NV), VC = new Uint8Array(NV * 3), VF = new Uint8Array(NV);
const mixc = (a, b, t) => a.map((v, k) => v + (b[k] - v) * t);
const C = {
  taiga: [62, 102, 66], mixed: [76, 116, 62], broad: [88, 128, 66], field: [150, 168, 96], meadow: [128, 150, 88], steppe: [204, 190, 120], dry: [214, 190, 140],
  tundra: [150, 156, 128], rock: [138, 126, 110], snow: [240, 242, 238], marsh: [104, 128, 92], desert: [226, 204, 156], maquis: [112, 128, 76],
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
    const west = Math.max(0, Math.min(1, (22 - lo) / 6)); // Запад: поля и луга вместо степи
    const forest = la > 60 ? C.taiga : la > 54 ? mixc(C.taiga, C.mixed, (60 - la) / 6) : la > 44 ? mixc(C.mixed, C.broad, Math.min(1, (54 - la) / 4)) : mixc(C.broad, C.maquis, Math.min(1, (44 - la) / 4));
    const opE = la > 55 ? C.meadow : la > 51 ? mixc(C.meadow, C.field, (55 - la) / 4) : mixc(C.field, C.steppe, Math.min(1, (51 - la) / 3));
    const opW = la > 52 ? mixc(C.meadow, C.field, Math.min(1, (58 - la) / 6)) : C.field;
    const opn = mixc(opE, opW, la > 44 ? west : 0);
    let col = mixc(forest, mixc(opn, C.dry, dryness), open);
    if (la < 37.5 && dryness > 0.5 && open > 0.8) col = mixc(col, C.desert, Math.min(1, (dryness - 0.5) * 2) * Math.min(1, (37.5 - la) / 3));
    if (tund > 0.2 && la > 64) col = mixc(col, C.tundra, Math.min(1, tund * 1.4));
    if (pi >= 0 && MAR[pi]) { col = mixc(col, C.marsh, 0.65); flags |= 4; }
    if (pi >= 0 && land === 1 && open < 0.38 && !MAR[pi]) flags |= 8;
    if (e > 900) col = mixc(col, C.rock, Math.min(1, (e - 900) / 1200));
    if (e > 2600 || (e > 1500 && la > 66)) col = mixc(col, C.snow, Math.min(1, (e - (la > 66 ? 1500 : 2600)) / 500));
    if (pi >= 0 && PLAY[pi] === 2) flags |= 16;
    VC[v * 3] = col[0]; VC[v * 3 + 1] = col[1]; VC[v * 3 + 2] = col[2];
    VF[v] = flags;
  }
log('сетка рельефа', G.nx, '×', G.ny, 'вершин', NV);
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
// ——— кодирование ———
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
function encPts(pts, unit = 0.5) {
  let s = '', px = 0, py = 0;
  const put = (v) => { let z = v < 0 ? -2 * v - 1 : 2 * v; do { const c = z & 31; z >>>= 5; s += B64[c | (z ? 32 : 0)]; } while (z); };
  for (const [x, y] of pts) { const qx = Math.round(x / unit), qy = Math.round(y / unit); put(qx - px); put(qy - py); px = qx; py = qy; }
  return s;
}
const b64 = (u8) => Buffer.from(u8.buffer, u8.byteOffset, u8.byteLength).toString('base64');
const MAP = {
  v: 1, world: 1, e: RE_, proj: PROJ, w: PROJ.w, h: PROJ.h, nats: NATS, zones: ZN_,
  // ox, oy — центр в км карты Востока (map.json): пороги движка по координатам (эвакуация, Бессарабия) — как на Востоке
  regs: regs.map((g, r) => { const [ox, oy] = r < RE_ ? [EJ.regs[r].x, EJ.regs[r].y] : EPJ.fwd(...inv(g.x, g.y)).map(Math.round); return { n: g.n, o: g.o, x: g.x, y: g.y, ox, oy, a: g.area, t: g.t, z: g.z, ind: g.ind, vp: g.vp, f: g.f, e: g.ele, c: g.city, k: g.k, rg: RINGS[r] }; }),
  neut: pseudo.map((p, k) => ({ c: p.c, n: p.n, x: Math.round(p.x), y: Math.round(p.y), rg: RINGS[R + k] })),
  arcs: arcs.map((A) => [A.a, A.b, A.t, encPts(A.s.map(([x, y]) => [x * KP, y * KP]))]),
  adj: adjOut,
  cities: cityList.map((c) => [c.n, Math.round(c.x), Math.round(c.y), c.s, c.r]),
  rivers: rivOut.map((r) => [r.n, r.w, encPts(r.p)]),
  land: landR.map((r) => encPts(r)), lakes: lakeR.map((r) => encPts(r)),
};
const MESH = { step: G.step, nx: G.nx, ny: G.ny, pal: PAL, e: b64(VE), c: b64(VP), f: b64(VF) };
fs.mkdirSync(OUT, { recursive: true });
const js = JSON.stringify(MAP), jm = JSON.stringify(MESH);
fs.writeFileSync(path.join(OUT, 'world.json'), js);
fs.writeFileSync(path.join(OUT, 'world-mesh.json'), jm);
log('world.json', Math.round(js.length / 1024), 'КБ:', Object.entries(MAP).map(([k, v]) => `${k} ${Math.round(JSON.stringify(v).length / 1024)}`).join(', '), '· world-mesh.json', Math.round(jm.length / 1024), 'КБ');

// ——— предпросмотр ———
async function previewLabels(file) {
  const img = Buffer.alloc(N * 3);
  const col = (k) => { let h = (k * 2654435761) >>> 0; return [90 + (h & 127), 90 + ((h >> 8) & 127), 90 + ((h >> 16) & 127)]; };
  for (let i = 0; i < N; i++) {
    let c;
    if (LAND[i] !== 1) c = LAND[i] === 2 ? [120, 160, 200] : [70, 110, 160];
    else if (PLAY[i] !== 1) c = DESF[i] ? [200, 180, 140] : [150, 150, 140];
    else c = LAB[i] >= 0 ? col(LAB[i]) : [255, 0, 255];
    const x = i % W;
    if (LAB[i] >= 0 && LAB[i] < R && ((x + 1 < W && LAB[i + 1] !== LAB[i]) || (i + W < N && LAB[i + W] !== LAB[i]))) c = OWN[i] !== OWN[i + 1] || OWN[i] !== OWN[i + W] ? [0, 0, 0] : [40, 40, 40];
    if (RIV[i]) c = RIV[i] === 2 ? [20, 60, 200] : [60, 110, 230];
    img[i * 3] = c[0]; img[i * 3 + 1] = c[1]; img[i * 3 + 2] = c[2];
  }
  for (const s of seeds) if (s.i >= 0) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const k = (s.y + dy) * W + s.x + dx; if (k >= 0 && k < N) img[k * 3] = 255, img[k * 3 + 1] = s.city ? 255 : 0, img[k * 3 + 2] = 0; }
  fs.mkdirSync(SHOTS, { recursive: true });
  await sharp(img, { raw: { width: W, height: H, channels: 3 } }).png().toFile(path.join(SHOTS, file));
  log('предпросмотр', file);
}
if (PREVIEW) {
  await previewLabels('world_labels.png');
  const S = 0.3, sx = (v) => (v * S).toFixed(1);
  const arcPts = arcs.map((A) => A.s.map(([x, y]) => [x * KP, y * KP]));
  const ringPath = (rg) => rg.map((ring) => ring.map((k, q) => { const p = k < 0 ? arcPts[~k].slice().reverse() : arcPts[k]; return (q ? 'L' : 'M') + p.map(([x, y]) => `${sx(x)},${sx(y)}`).join('L'); }).join('') + 'Z').join('');
  const OC = { GER: '#8a96a3', SOV: '#c46a5e', FIN: '#e8eef2', ROM: '#d4b54a', HUN: '#7fa36a', SVK: '#7c93c4', BUL: '#9a8f6a', CRO: '#8a7fb0', ITA: '#6d8a62', UK: '#c9a27a', VIC: '#9fb3c8', IRN: '#c8b890' };
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${sx(PROJ.w)}" height="${sx(PROJ.h)}"><rect width="100%" height="100%" fill="#6f93b3"/>`;
  svg += `<path d="${landR.map((r) => 'M' + r.map(([x, y]) => `${sx(x)},${sx(y)}`).join('L') + 'Z').join('')}" fill="#d9d2b8" fill-rule="evenodd"/>`;
  regs.forEach((g, r) => (svg += `<path d="${ringPath(RINGS[r])}" fill="${OC[NATS[g.o]] || '#999'}" fill-opacity="0.6" stroke="#333" stroke-width="0.3" fill-rule="evenodd"/>`));
  svg += `<path d="${lakeR.map((r) => 'M' + r.map(([x, y]) => `${sx(x)},${sx(y)}`).join('L') + 'Z').join('')}" fill="#6f93b3"/>`;
  for (const r of rivOut) svg += `<path d="M${r.p.map(([x, y]) => `${sx(x)},${sx(y)}`).join('L')}" fill="none" stroke="#3a6fb0" stroke-width="${r.w === 2 ? 0.9 : 0.45}"/>`;
  for (const g of regs) svg += `<text x="${sx(g.x)}" y="${sx(g.y)}" font-size="3.6" text-anchor="middle" font-family="sans-serif" fill="#111">${g.n.replace(/&/g, '')}</text>`;
  svg += '</svg>';
  fs.writeFileSync(path.join(SHOTS, 'world_vec.svg'), svg);
  await sharp(Buffer.from(svg), { density: 72 * 2 }).png().toFile(path.join(SHOTS, 'world_vec.png'));
  log('предпросмотр world_vec.png');
}
