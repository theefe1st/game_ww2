// Сборка карты «Европа 1939–1945» (Natural Earth): суша/моря/озёра/реки, биомы, границы 1939 года, регионы.
// node tools/build-europe.mjs [--preview]  → src/data/europe.json (+ tools/shots/europe-*.png)
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import { REGIONS, SEA_LINKS, NATIONS } from '../src/europe/regions.js';
const require = createRequire(import.meta.url);
const HERE = path.dirname(fileURLToPath(import.meta.url)), D = path.join(HERE, 'data');
const PROJ = { lon0: 22, lat0: 50, xmin: -2780, ymax: 2420, kmPx: 6.5 };
const W = 858, H = 726, N = W * H, EARTH = 6371, DEG = Math.PI / 180;
const sa = Math.sin(PROJ.lat0 * DEG), ca = Math.cos(PROJ.lat0 * DEG);
function P(lon, lat) {
  const r = (lon - PROJ.lon0) * DEG, i = lat * DEG, si = Math.sin(i), ci = Math.cos(i), cr = Math.cos(r);
  const k = Math.sqrt(2 / (1 + sa * si + ca * ci * cr));
  return [(EARTH * k * ci * Math.sin(r) - PROJ.xmin) / PROJ.kmPx, (PROJ.ymax - EARTH * k * (ca * si - sa * ci * cr)) / PROJ.kmPx];
}
function inv(px, py) {
  const x = px * PROJ.kmPx + PROJ.xmin, y = PROJ.ymax - py * PROJ.kmPx, rho = Math.hypot(x, y);
  if (rho < 1e-9) return [PROJ.lon0, PROJ.lat0];
  const c = 2 * Math.asin(Math.min(1, rho / (2 * EARTH))), sc = Math.sin(c), cc = Math.cos(c);
  const lat = Math.asin(cc * sa + (y * sc * ca) / rho) / DEG;
  const lon = PROJ.lon0 + Math.atan2(x * sc, rho * ca * cc - y * sa * sc) / DEG;
  return [lon, lat];
}
const geo = (f) => JSON.parse(fs.readFileSync(path.join(D, f), 'utf8'));
const BB = [-32, 22, 75, 80];
function ringsOf(gm) {
  const ps = gm.type === 'Polygon' ? [gm.coordinates] : gm.type === 'MultiPolygon' ? gm.coordinates : [];
  const out = [];
  for (const p of ps) {
    let x0 = 999, y0 = 999, x1 = -999, y1 = -999;
    for (const [x, y] of p[0]) ((x0 = Math.min(x0, x)), (x1 = Math.max(x1, x)), (y0 = Math.min(y0, y)), (y1 = Math.max(y1, y)));
    if (x1 < BB[0] || x0 > BB[2] || y1 < BB[1] || y0 > BB[3]) continue;
    for (const ring of p) out.push(ring.map(([lo, la]) => P(lo, la)));
  }
  return out;
}
// Заливка по центрам пикселей, правило чёт-нечет по всем кольцам сразу (дыры учитываются)
function fill(rings, cb) {
  const rows = Array.from({ length: H }, () => []);
  for (const r of rings) {
    const n = r.length;
    for (let i = 0; i < n; i++) {
      let p = r[i], q = r[(i + 1) % n];
      if (p[1] === q[1]) continue;
      if (p[1] > q[1]) [p, q] = [q, p];
      const ya = Math.max(0, Math.ceil(p[1] - 0.5)), yb = Math.min(H - 1, Math.ceil(q[1] - 0.5) - 1);
      for (let y = ya; y <= yb; y++) {
        const cy = y + 0.5;
        rows[y].push(p[0] + ((cy - p[1]) * (q[0] - p[0])) / (q[1] - p[1]));
      }
    }
  }
  for (let y = 0; y < H; y++) {
    const xs = rows[y];
    if (xs.length < 2) continue;
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const xa = Math.max(0, Math.ceil(xs[k] - 0.5)), xb = Math.min(W - 1, Math.ceil(xs[k + 1] - 0.5) - 1);
      for (let x = xa; x <= xb; x++) cb(y * W + x);
    }
  }
}
const polyMask = (ll) => {
  const m = new Uint8Array(N);
  fill([ll.map(([lo, la]) => P(lo, la))], (i) => (m[i] = 1));
  return m;
};
// ——— 1. суша, озёра ———
const LAND = 1, LAKE = 2, RIV = 3, RIV2 = 4;
const cls = new Uint8Array(N);
for (const ft of geo('ne_10m_land.geojson').features) ft.geometry && fill(ringsOf(ft.geometry), (i) => (cls[i] = cls[i] ? 0 : LAND));
// (чёт-нечет внутри одного объекта; разные объекты суши не перекрываются)
const lakeOk = (p) => p.featurecla !== 'Reservoir' && !/Reservoir|Vodokhranilishche|vdkhr|Vdkhr/i.test(p.name || '');
for (const ft of geo('ne_10m_lakes.geojson').features) {
  if (!ft.geometry || !lakeOk(ft.properties || {})) continue;
  const rs = ringsOf(ft.geometry);
  let px = 0;
  fill(rs, () => px++);
  px >= 3 && fill(rs, (i) => cls[i] === LAND && (cls[i] = LAKE));
}
// ——— 2. страны → владельцы 1939 года ———
const CTY = [], cty = new Int16Array(N).fill(-1);
for (const ft of geo('ne_50m_admin_0_countries.geojson').features) {
  if (!ft.geometry) continue;
  const id = CTY.push(ft.properties.ADM0_A3) - 1;
  fill(ringsOf(ft.geometry), (i) => (cty[i] = id));
}
{ // суша без страны (расхождение 10m/50m) → ближайшая страна
  let q = [];
  for (let i = 0; i < N; i++) cls[i] && cty[i] >= 0 && q.push(i);
  while (q.length) {
    const nq = [];
    for (const i of q) {
      const x = i % W;
      for (const j of [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, i - W, i + W])
        j >= 0 && j < N && cls[j] && cty[j] < 0 && ((cty[j] = cty[i]), nq.push(j));
    }
    q = nq;
  }
}
const POLY = {
  POL39: [[17.9,54.84],[18.4,54.83],[18.85,54.65],[18.6,54.47],[18.42,54.36],[18.48,54.2],[18.7,54.08],[18.85,54.0],[18.85,53.75],[18.78,53.55],[19.1,53.42],[19.6,53.38],[20.15,53.3],[20.7,53.22],[21.3,53.38],[21.9,53.45],[22.3,53.65],[22.62,53.95],[22.75,54.3],[23.35,54.25],[23.9,54.15],[24.35,54.3],[24.6,54.55],[24.8,54.85],[25.2,55.15],[25.8,55.4],[26.6,55.7],[27.4,55.8],[28.15,55.6],[27.85,55.15],[27.55,54.65],[27.15,54.25],[26.95,53.75],[27.15,53.3],[27.5,52.8],[27.7,52.25],[27.6,51.75],[27.4,51.3],[27.25,50.85],[27.0,50.55],[26.6,50.2],[26.35,49.9],[26.1,49.55],[26.2,49.05],[26.35,48.6],[25.9,48.62],[25.4,48.5],[25.15,48.3],[24.85,48.05],[24.5,47.95],[24.2,48.3],[23.6,48.75],[22.95,49.0],[22.6,49.1],[22.0,49.25],[21.3,49.42],[20.6,49.38],[20.0,49.25],[19.5,49.4],[19.0,49.45],[18.75,49.55],[18.5,49.75],[18.3,49.95],[18.6,50.05],[18.85,50.2],[18.85,50.45],[18.55,50.75],[18.35,51.0],[17.9,51.25],[17.55,51.45],[17.15,51.55],[16.6,51.72],[16.15,51.95],[15.95,52.25],[16.0,52.6],[16.25,52.9],[16.75,53.05],[17.2,53.35],[17.4,53.75],[17.6,54.1],[17.8,54.45]],
  BESS: [[26.4,48.55],[27.0,48.55],[27.8,48.48],[28.35,48.2],[28.95,47.8],[29.15,47.35],[29.5,46.95],[29.75,46.7],[30.0,46.45],[30.6,46.05],[30.0,45.4],[29.7,45.15],[28.8,45.25],[28.2,45.45],[27.8,45.6],[27.3,46.5],[26.6,47.4],[26.0,48.2]],
  BUK: [[24.9,47.75],[25.2,48.1],[25.4,48.45],[25.9,48.65],[26.3,48.6],[26.7,48.4],[26.6,48.15],[26.3,47.95],[25.7,47.8]],
  ZAK: [[22.1,48.35],[22.15,48.95],[22.6,49.1],[23.2,48.95],[23.7,48.7],[24.2,48.4],[24.6,48.0],[24.3,47.9],[23.5,47.95],[22.9,47.95],[22.6,48.1]],
  SSK: [[17.3,47.95],[17.6,48.1],[18.05,48.12],[18.45,48.28],[18.95,48.25],[19.45,48.28],[19.95,48.42],[20.45,48.72],[20.95,48.78],[21.35,48.82],[21.85,48.78],[22.2,48.7],[22.6,48.5],[22.5,48.0],[18.0,47.6],[17.2,47.7]],
  MEM: [[20.9,55.25],[21.6,55.15],[22.1,55.05],[22.2,55.3],[21.7,55.95],[21.0,56.1],[20.9,55.7]],
  JUL: [[13.55,46.55],[13.85,46.45],[14.1,46.15],[14.3,45.9],[14.4,45.65],[14.5,45.35],[14.6,45.2],[14.5,44.9],[14.2,44.6],[13.9,44.75],[13.5,45.1],[13.4,45.6],[13.5,46.0]],
  ESPMOR: [[-6.4,35.9],[-5.3,36.0],[-4.0,35.4],[-2.9,35.3],[-2.2,35.15],[-2.3,34.9],[-3.5,34.85],[-4.6,34.9],[-5.6,34.85],[-6.3,34.95]],
  FINK: [[27.5,60.1],[29.95,60.12],[30.35,60.4],[31.1,60.62],[32.45,61.05],[32.95,61.65],[32.85,62.3],[31.6,62.95],[29.0,62.9],[27.5,61.0]],
  SALLA: [[28.6,66.5],[30.1,66.5],[30.1,67.25],[28.6,67.25]],
  PETS: [[28.4,68.9],[29.4,68.85],[31.0,69.15],[31.95,69.65],[31.9,69.95],[29.0,69.95],[28.4,69.4]],
  KALI: [[19.0,54.2],[22.95,54.2],[22.95,55.4],[19.0,55.4]],
};
const M = Object.fromEntries(Object.entries(POLY).map(([k, v]) => [k, polyMask(v)]));
const SIMPLE = {
  DEU: 'GER', AUT: 'GER', LVA: 'LAT', EST: 'EST', ROU: 'ROM', HUN: 'HUN', BIH: 'YUG', SRB: 'YUG', MNE: 'YUG', MKD: 'YUG', KOS: 'YUG',
  ALB: 'ITA', GRC: 'GRE', BGR: 'BUL', TUR: 'TUR', CYP: 'UK', CYN: 'UK', MLT: 'UK', GBR: 'UK', IRL: 'IRL', FRA: 'FRA', MCO: 'FRA',
  AND: 'ESP', BEL: 'BEL', LUX: 'BEL', NLD: 'NED', DNK: 'DEN', NOR: 'NOR', SWE: 'SWE', FIN: 'FIN', ESP: 'ESP', PRT: 'POR', ITA: 'ITA',
  SMR: 'ITA', VAT: 'ITA', CHE: 'SUI', LIE: 'SUI', EGY: 'UK', LBY: 'ITA', TUN: 'FRA', DZA: 'FRA', SAH: 'ESP', ISR: 'UK', PSX: 'UK',
  JOR: 'UK', LBN: 'FRA', SYR: 'FRA', IRQ: 'UK', KWT: 'UK', IRN: 'IRN', GEO: 'SOV', ARM: 'SOV', AZE: 'SOV',
};
const NAT = Object.keys(NATIONS), NI = Object.fromEntries(NAT.map((k, i) => [k, i + 1]));
const own = new Uint8Array(N);
for (let i = 0; i < N; i++) {
  if (!cls[i] || cls[i] === LAKE || cty[i] < 0) continue;
  const c = CTY[cty[i]];
  let o = SIMPLE[c] || '';
  if (c === 'POL') o = M.POL39[i] ? 'POL' : 'GER';
  else if (c === 'CZE') o = M.POL39[i] ? 'POL' : 'GER';
  else if (c === 'LTU') o = M.MEM[i] ? 'GER' : M.POL39[i] ? 'POL' : 'LIT';
  else if (c === 'BLR') o = M.POL39[i] ? 'POL' : 'SOV';
  else if (c === 'UKR') o = M.POL39[i] ? 'POL' : M.BUK[i] || M.BESS[i] ? 'ROM' : M.ZAK[i] ? 'HUN' : 'SOV';
  else if (c === 'MDA') o = M.BESS[i] ? 'ROM' : 'SOV';
  else if (c === 'RUS') o = M.KALI[i] ? 'GER' : M.FINK[i] || M.SALLA[i] || M.PETS[i] ? 'FIN' : 'SOV';
  else if (c === 'SVK') o = M.SSK[i] ? 'HUN' : 'SVK';
  else if (c === 'SVN' || c === 'HRV') o = M.JUL[i] ? 'ITA' : 'YUG';
  else if (c === 'MAR') o = M.ESPMOR[i] ? 'ESP' : 'FRA';
  own[i] = o ? NI[o] : 0;
}
// ——— 3. реки ———
const MAJOR = new Set(['Volga', 'Don', 'Dnipro', 'Dnepr', 'Dnieper', 'Danube', 'Donau', 'Duna', 'Dunav', 'Dunărea', 'Vistula', 'Wisła', 'Oder', 'Odra', 'Daugava', 'Neman', 'Nemunas', 'Dniester', 'Elbe', 'Rhine', 'Rhein', 'Rijn', 'Po', 'Bratul Chillia', 'Bratul Sulina', 'Bratul Sfintu Gheorghe', 'Borcea', 'Nile', 'Euphrates', 'Tigris']);
const MINOR = new Set(['Desna', 'Donets', 'Severskiy Donets', 'Kuban', 'Narva', 'Oka', 'Pripyat', 'Prut', 'Velikaya', 'Neva', 'Svir', 'Svir’', 'Volkhov', 'Bug', 'Southern Bug', 'Zakhidnyy Buh', 'Seym', 'Byarezina', 'Berezina', 'Sozh', 'Terek', 'Khopr', 'Tisa', 'Tisza', 'Sava', 'Drau', 'Drava', 'Warta', 'Narew', 'San', 'Luga', 'Siret', 'Msta', 'Medveditsa', 'Sura', 'Vuoksi', 'Meuse', 'Maas', 'Seine', 'Loire', 'Rhône', 'Rhone', 'Ebro', 'Tagus', 'Tajo', 'Tejo', 'Main', 'Moselle', 'Mosel', 'Weser', 'Kama', 'Belaya', 'Ural', 'Garonne', 'Dvina', 'Northern Dvina', 'Severnaya Dvina', 'Kura', 'Tiber', 'Tevere', 'Morava', 'Vardar', 'Maritsa', 'Douro', 'Duero', 'Guadalquivir', 'Somme', 'Marne', 'Aisne', 'Scheldt', 'Escaut', 'Ems', 'Thames', 'Severn', 'Inn', 'Mures', 'Mureș', 'Olt', 'Volga River']);
function line(a, b, v) {
  let [x0, y0] = a.map(Math.floor), [x1, y1] = b.map(Math.floor);
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (let n = 0; n < 6000; n++) {
    if (x0 >= 0 && y0 >= 0 && x0 < W && y0 < H) {
      const i = y0 * W + x0;
      if (cls[i] === LAND || (cls[i] === RIV2 && v === RIV)) cls[i] = v;
    }
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    e2 >= dy && ((err += dy), (x0 += sx));
    e2 <= dx && ((err += dx), (y0 += sy));
  }
}
const used = new Map();
for (const fn of ['ne_10m_rivers_lake_centerlines.geojson', 'ne_10m_rivers_europe.geojson']) {
  for (const ft of geo(fn).features) {
    const p = ft.properties || {}, gm = ft.geometry;
    if (!gm) continue;
    const nm = p.name || p.name_en || '', v = MAJOR.has(nm) ? RIV : MINOR.has(nm) ? RIV2 : 0;
    if (!v) continue;
    const ls = gm.type === 'LineString' ? [gm.coordinates] : gm.type === 'MultiLineString' ? gm.coordinates : [];
    for (const l of ls) {
      let prev = null;
      for (const [lo, la] of l) {
        if (lo < BB[0] || lo > BB[2] || la < BB[1] || la > BB[3]) { prev = null; continue; }
        const q = P(lo, la);
        prev && line(prev, q, v);
        prev = q;
      }
    }
    used.set(nm, (used.get(nm) || 0) + 1);
  }
}
// ——— 4. принудительные крошечные владения (Гибралтар, Мальта) ———
const FORCED = { gibraltar: 2, malta: 2 };
const forcedPx = {};
for (const [k, s] of Object.entries(FORCED)) {
  const r = REGIONS.find((q) => q.k === k), [fx, fy] = P(r.lon, r.lat), list = [];
  for (let dy = 0; dy < s; dy++)
    for (let dx = 0; dx < s; dx++) {
      const x = Math.floor(fx) + dx - (s >> 1), y = Math.floor(fy) + dy - (s >> 1);
      const i = y * W + x;
      ((cls[i] = LAND), (own[i] = NI.UK), list.push(i));
    }
  forcedPx[k] = list;
}
// ——— 6. биомы (для подложки) ———
// классы: 0 море, 1 умеренный, 2 озеро, 3 река, 4 малая река, 5 горы, 6 холмы, 7 болото, 8 пустыня, 9 степь, 10 тайга, 11 тундра, 12 субтропики
const RELIEF = [
  ['m', [[5.7,44.1],[7.5,43.95],[7.9,44.35],[7.4,45.0],[7.6,45.6],[8.6,45.85],[9.6,45.95],[10.6,45.65],[11.8,45.95],[12.6,46.15],[13.6,46.15],[14.6,46.25],[15.6,46.55],[16.0,47.35],[15.2,47.75],[13.6,47.75],[12.2,47.65],[10.6,47.5],[9.6,47.45],[8.4,46.95],[7.4,46.75],[6.6,46.35],[6.6,45.8],[6.2,45.35],[5.75,45.0],[5.6,44.5]]],
  ['m', [[-1.8,43.1],[0.0,42.9],[1.5,42.75],[3.1,42.45],[2.8,42.2],[1.0,42.25],[-0.6,42.6],[-1.8,42.8]]],
  ['m', [[17.2,48.6],[18.4,49.3],[19.6,49.6],[21.0,49.5],[22.4,49.3],[23.6,48.9],[24.6,48.3],[25.6,47.8],[26.2,46.8],[26.4,45.9],[25.8,45.55],[24.6,45.45],[23.2,45.35],[22.4,45.1],[22.0,44.8],[21.5,45.0],[22.0,45.6],[22.9,45.75],[24.0,45.85],[25.2,45.8],[25.8,46.2],[25.6,47.2],[24.9,47.6],[23.9,48.05],[22.6,48.6],[21.3,48.9],[20.0,48.9],[18.8,48.5],[17.6,48.35]]],
  ['h', [[21.9,46.3],[22.7,46.0],[23.5,46.3],[23.4,46.9],[22.6,47.0],[22.1,46.8]]],
  ['m', [[14.0,45.9],[15.0,45.3],[16.0,44.6],[17.2,43.9],[18.4,43.2],[19.4,42.6],[20.2,42.2],[20.4,41.6],[19.9,41.0],[20.5,40.4],[21.4,39.6],[21.8,38.8],[22.3,38.4],[21.6,38.6],[20.9,39.4],[20.2,40.2],[19.6,40.6],[19.5,41.8],[18.8,42.3],[17.6,43.0],[16.3,43.6],[15.3,44.3],[14.4,45.0],[13.9,45.5]]],
  ['h', [[17.0,44.6],[18.6,44.3],[20.0,43.6],[21.0,43.0],[22.4,42.4],[22.0,41.6],[20.8,41.8],[19.8,42.6],[18.4,43.4]]],
  ['m', [[22.4,43.7],[23.6,43.1],[25.2,42.9],[26.8,42.8],[27.6,42.6],[26.0,42.4],[24.6,42.55],[25.8,41.9],[25.4,41.35],[24.0,41.4],[22.8,41.4],[22.2,42.1],[22.3,42.9]]],
  ['m', [[8.0,44.3],[9.5,44.6],[10.6,44.3],[11.6,44.0],[12.6,43.5],[13.4,42.9],[14.2,42.2],[15.3,41.4],[16.0,40.6],[16.4,39.8],[16.3,38.7],[15.7,38.0],[15.7,38.8],[15.6,39.8],[15.2,40.5],[14.5,41.2],[13.6,41.8],[12.9,42.5],[12.2,43.2],[11.2,43.8],[10.2,44.1],[8.9,44.3]]],
  ['m', [[6.0,58.6],[7.5,58.8],[8.8,59.6],[9.6,60.8],[11.6,62.0],[12.8,63.2],[13.8,64.6],[15.6,66.0],[17.2,67.4],[18.8,68.4],[20.6,69.0],[22.0,69.6],[19.0,69.9],[16.6,69.2],[14.8,68.0],[13.4,66.6],[12.4,65.2],[10.6,63.8],[8.8,63.0],[6.4,62.2],[5.4,61.2],[5.4,59.8]]],
  ['m', [[37.6,44.9],[39.4,44.1],[41.0,43.7],[42.8,43.4],[44.6,43.0],[46.4,42.4],[48.4,41.9],[49.2,41.4],[48.0,41.2],[46.4,41.6],[44.8,42.3],[43.0,42.6],[41.4,43.0],[39.8,43.3],[38.2,44.3]]],
  ['m', [[41.4,41.6],[43.6,41.2],[45.4,40.8],[46.6,39.6],[46.0,38.8],[44.0,39.0],[42.2,40.0],[41.2,40.8]]],
  ['m', [[58.0,51.0],[59.6,51.5],[60.2,53.5],[60.0,55.0],[60.0,56.5],[59.8,58.5],[60.2,60.5],[60.6,62.5],[60.2,62.8],[58.8,60.8],[58.8,58.5],[58.6,56.4],[58.4,55.0],[57.6,53.4],[57.2,51.8]]],
  ['m', [[-9.6,30.6],[-7.4,31.2],[-5.4,32.2],[-4.0,33.2],[-2.2,34.3],[0.6,34.8],[3.0,35.4],[5.2,35.6],[7.4,35.6],[8.6,35.4],[9.8,35.6],[10.0,35.0],[8.0,34.6],[6.0,34.6],[3.6,34.0],[1.0,33.6],[-1.6,32.8],[-4.0,31.8],[-6.0,30.8],[-8.4,30.2]]],
  ['m', [[-5.8,35.0],[-4.0,35.2],[-3.2,35.0],[-4.5,34.7],[-5.6,34.8]]],
  ['h', [[3.4,36.3],[5.0,36.6],[6.6,36.8],[8.4,36.7],[8.6,36.3],[6.6,36.1],[4.6,36.0],[3.4,36.0]]],
  ['m', [[29.0,36.9],[31.0,37.2],[33.0,37.0],[35.0,37.4],[36.8,37.8],[38.6,38.2],[40.8,38.4],[42.6,38.0],[44.4,37.6],[44.0,37.0],[42.0,37.3],[39.0,37.5],[36.6,36.9],[34.8,36.6],[32.6,36.2],[30.6,36.3],[29.2,36.4]]],
  ['m', [[31.2,41.0],[33.4,41.6],[35.6,41.4],[37.6,40.9],[39.8,40.8],[41.6,41.2],[42.8,41.0],[42.6,40.2],[40.4,40.0],[38.4,40.1],[36.0,40.5],[33.8,40.7],[31.6,40.5]]],
  ['m', [[39.0,38.5],[41.0,40.0],[43.6,40.6],[44.6,39.6],[44.2,38.6],[42.0,38.4]]],
  ['m', [[44.6,36.8],[46.0,36.0],[47.6,34.6],[49.0,33.0],[50.6,31.6],[52.0,30.6],[53.0,30.8],[51.6,32.2],[50.2,33.6],[48.6,35.0],[47.2,36.4],[45.8,37.2]]],
  ['m', [[48.8,36.8],[50.4,36.4],[52.0,36.0],[54.0,36.4],[56.0,37.2],[55.0,37.6],[53.0,36.9],[51.0,36.9],[49.4,37.4]]],
  ['m', [[-6.2,56.0],[-5.0,56.2],[-3.8,56.6],[-2.4,57.0],[-2.6,57.6],[-3.6,58.2],[-5.0,58.6],[-5.8,57.8],[-6.0,57.0]]],
  ['h', [[-4.6,51.8],[-3.2,51.8],[-3.0,52.6],[-3.4,53.2],[-4.4,53.0],[-4.6,52.4]]],
  ['h', [[-3.6,55.0],[-2.2,55.2],[-2.0,54.4],[-2.4,53.6],[-1.8,53.2],[-2.2,53.0],[-3.0,54.2],[-3.6,54.6]]],
  ['h', [[2.0,44.4],[3.4,44.2],[4.4,44.7],[4.6,45.6],[3.8,46.0],[2.6,45.9],[1.8,45.3]]],
  ['m', [[-8.0,43.3],[-6.0,43.2],[-4.0,43.2],[-2.4,43.1],[-2.8,42.8],[-4.6,42.9],[-6.6,42.7],[-7.6,42.5]]],
  ['m', [[-7.0,40.3],[-5.0,40.6],[-3.6,41.0],[-3.2,40.8],[-4.6,40.2],[-6.6,40.0]]],
  ['m', [[-5.6,36.6],[-4.0,36.9],[-2.6,37.0],[-1.6,37.6],[-2.0,38.0],[-3.6,37.6],[-5.0,37.1]]],
  ['h', [[-3.0,42.0],[-1.6,41.6],[-0.6,40.8],[-0.4,40.2],[-1.2,40.0],[-2.2,40.6],[-3.0,41.4]]],
  ['h', [[12.2,50.3],[13.4,50.6],[14.6,50.9],[15.6,50.8],[16.6,50.4],[17.4,50.2],[17.0,49.9],[15.6,50.3],[14.4,50.5],[13.2,50.3]]],
  ['h', [[12.4,49.8],[13.4,49.2],[14.2,48.7],[13.8,48.5],[12.8,49.0],[12.1,49.6]]],
  ['h', [[6.8,47.8],[7.4,48.0],[7.4,48.8],[7.0,48.6],[6.7,48.1]]],
  ['h', [[7.8,47.7],[8.6,47.8],[8.6,48.7],[8.2,48.8],[7.9,48.3]]],
  ['h', [[5.6,46.4],[6.4,46.6],[7.2,47.3],[6.8,47.5],[6.0,47.0],[5.6,46.7]]],
  ['h', [[4.6,49.8],[5.6,49.6],[6.4,49.9],[7.2,50.3],[6.8,50.6],[5.8,50.4],[4.9,50.2]]],
  ['h', [[9.6,51.6],[10.8,51.9],[10.8,51.6],[10.0,51.4]]],
  ['m', [[33.6,44.45],[34.6,44.6],[35.4,44.9],[35.2,45.0],[34.4,44.85],[33.7,44.65]]],
  ['m', [[35.6,33.2],[36.4,33.5],[36.6,34.4],[36.2,34.6],[35.8,34.2]]],
  ['h', [[21.8,37.0],[22.6,36.8],[22.9,37.4],[22.6,38.0],[21.9,37.8]]],
  ['m', [[8.6,41.6],[9.4,41.9],[9.4,42.7],[8.8,42.4]]],
  ['h', [[9.0,39.6],[9.7,39.8],[9.8,40.6],[9.2,40.5]]],
  ['h', [[13.4,37.8],[15.2,37.9],[15.2,38.1],[13.6,38.05]]],
  ['m', [[23.6,35.2],[25.8,35.1],[25.8,35.3],[23.6,35.5]]],
  ['h', [[32.0,56.6],[33.6,57.2],[34.0,58.0],[32.6,58.0],[31.8,57.2]]],
  ['h', [[-8.6,41.8],[-7.0,41.9],[-6.8,40.6],[-8.0,40.6]]],
  ['w', [[23.8,52.4],[25.5,52.6],[27.5,52.6],[29.5,52.2],[30.4,51.8],[29.0,51.4],[27.0,51.4],[25.0,51.6],[23.9,51.8]]],
  ['w', [[30.6,58.6],[31.8,59.2],[32.8,59.4],[32.6,58.8],[31.6,58.2],[30.8,58.2]]],
  ['w', [[28.7,45.4],[29.7,45.4],[29.6,44.9],[28.8,44.9]]],
  ['w', [[46.4,31.0],[47.6,31.4],[47.8,30.8],[46.8,30.6]]],
  ['g', [[29.6,31.3],[30.6,31.6],[32.2,31.3],[31.4,30.4],[31.3,29.0],[30.8,29.0],[30.9,30.0],[30.0,30.8]]],
  ['s', [[47.8,31.0],[48.6,32.4],[49.6,32.0],[50.0,30.6],[49.0,30.2],[48.2,30.4]]],
  ['s', [[42.0,36.6],[43.6,36.4],[44.6,34.2],[46.0,32.8],[47.6,31.0],[47.0,30.6],[45.0,31.6],[43.6,33.2],[42.4,34.4],[41.0,34.6],[40.6,35.6]]],
];
const relief = new Uint8Array(N);
const RK = { m: 5, h: 6, w: 7, g: 1, s: 9 };
for (const [k, p] of RELIEF) fill([p.map(([lo, la]) => P(lo, la))], (i) => (relief[i] = RK[k]));
function biome(lon, lat) {
  if (lat > 68.6 || (lat > 66.8 && lon > 38)) return 11;
  const desert =
    (lat < 32.2 && lon < 36.5 && lon > 10.5) || (lat < 32.6 && lon >= 11 && lon < 25) || (lat < 31.8 && lon < -1) || (lat < 34.0 && lon >= -1 && lon < 8) || (lat < 33.6 && lon >= 8 && lon < 10.5) ||
    (lon >= 36.6 && lat < 34.6 && lon < 50) || (lon > 50 && lat < 35.4) || (lon > 46.5 && lat < 48.3 && lat > 41.5 && lon < 56) || (lon > 52 && lat < 44.5);
  if (desert) return 8;
  if (lat > 60.5 || (lon > 27 && lat > 57.8) || (lon > 45 && lat > 56.8)) return 10;
  const steppe =
    (lon > 28 && lat < 50.6 && lat > 43.6) || (lon > 44 && lat < 52.5 && lat > 46) || (lon > 50 && lat < 54.5 && lat >= 48.3) ||
    (lon > 19.3 && lon < 22.2 && lat > 46.2 && lat < 47.9) || (lon > 31 && lon < 41 && lat > 37.8 && lat < 40.4) ||
    (lon > -5.5 && lon < -1.5 && lat > 38.8 && lat < 42);
  if (steppe) return 9;
  if (lat < 43.8 || (lat < 44.2 && lon > 3 && lon < 7.6)) return 12;
  return 1;
}
const bio = new Uint8Array(N), wild = new Uint8Array(N);
for (let i = 0; i < N; i++) {
  if (cls[i] === 0 || cls[i] === LAKE) continue;
  const [lo, la] = inv((i % W) + 0.5, ((i / W) | 0) + 0.5);
  let b = biome(lo, la);
  (lo > 44 && la > 62.2) || (lo > 52 && la > 60.2) ? (wild[i] = 1) : 0;
  const r = relief[i];
  if (r === 5 || r === 6 || r === 7) b = r;
  else if (r === 1 && b === 8) b = 1;
  else if (r === 9 && b === 8) b = 9;
  bio[i] = b;
}
// расстояние до моря и до рек (пустыню занимают только у побережья и вдоль рек)
const bfsDist = (src, lim) => {
  const d = new Uint8Array(N).fill(255);
  let q = [];
  for (let i = 0; i < N; i++) src(i) && ((d[i] = 0), q.push(i));
  for (let k = 1; k <= lim && q.length; k++) {
    const nq = [];
    for (const i of q) {
      const x = i % W;
      for (const j of [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, i - W, i + W]) j >= 0 && j < N && d[j] > k && ((d[j] = k), nq.push(j));
    }
    q = nq;
  }
  return d;
};
const dSea = bfsDist((i) => cls[i] === 0, 40), dRiv = bfsDist((i) => cls[i] === RIV, 4);
const claim = (i) => !wild[i] && (bio[i] !== 8 || dSea[i] <= 20 || dRiv[i] <= 3);

// ——— 5. регионы: рост от семян (Дейкстра), реки дорогие ———
function hash(x, y, s) {
  let t = Math.sin(x * 12.9898 + y * 78.233 + s * 37.719) * 43758.5453;
  return t - Math.floor(t);
}
function vnoise(x, y, s) {
  const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi;
  const a = hash(xi, yi, s), b = hash(xi + 1, yi, s), c = hash(xi, yi + 1, s), d = hash(xi + 1, yi + 1, s);
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
const isLand = (c) => c === LAND || c === RIV || c === RIV2;
const reg = new Uint16Array(N), dist = new Float64Array(N).fill(Infinity);
const seeds = [], warn = [];
for (const r of REGIONS) {
  const [fx, fy] = P(r.lon, r.lat);
  let best = -1, bd = 1e9;
  const x0 = Math.floor(fx), y0 = Math.floor(fy);
  if (forcedPx[r.k]) best = forcedPx[r.k][0];
  else
    for (let dy = -14; dy <= 14; dy++)
      for (let dx = -14; dx <= 14; dx++) {
        const x = x0 + dx, y = y0 + dy;
        if (x < 0 || y < 0 || x >= W || y >= H) continue;
        const i = y * W + x;
        if (!isLand(cls[i]) || own[i] !== NI[r.own] || reg[i]) continue;
        const d = dx * dx + dy * dy;
        d < bd && ((bd = d), (best = i));
      }
  if (best < 0) { warn.push(`seed ${r.k}: нет суши владельца ${r.own} рядом`); seeds.push(null); continue; }
  bd > 4 && bd < 1e9 && warn.push(`seed ${r.k}: сдвинут на ${Math.sqrt(bd).toFixed(1)} px`);
  seeds.push({ i: best, x: best % W, y: (best / W) | 0, fx, fy });
}
// двоичная куча
const hp = [], hk = [];
const push = (k, i) => {
  let n = hp.length;
  hp.push(i), hk.push(k);
  while (n > 0) {
    const p = (n - 1) >> 1;
    if (hk[p] <= hk[n]) break;
    [hp[p], hp[n]] = [hp[n], hp[p]], [hk[p], hk[n]] = [hk[n], hk[p]];
    n = p;
  }
};
const pop = () => {
  const top = hp[0], tk = hk[0], li = hp.pop(), lk = hk.pop();
  if (hp.length) {
    hp[0] = li, hk[0] = lk;
    let n = 0;
    for (;;) {
      const a = 2 * n + 1, b = a + 1;
      let m = n;
      a < hp.length && hk[a] < hk[m] && (m = a);
      b < hp.length && hk[b] < hk[m] && (m = b);
      if (m === n) break;
      [hp[m], hp[n]] = [hp[n], hp[m]], [hk[m], hk[n]] = [hk[n], hk[m]];
      n = m;
    }
  }
  return [top, tk];
};
REGIONS.forEach((r, k) => {
  const s = seeds[k];
  if (!s) return;
  if (forcedPx[r.k]) for (const i of forcedPx[r.k]) ((reg[i] = r.i), (dist[i] = 0));
  dist[s.i] = 0, reg[s.i] = r.i, push(0, s.i);
});
const cost = (i) => {
  const x = i % W, y = (i / W) | 0;
  return 1 + 0.9 * vnoise(x / 9, y / 9, 7) + (cls[i] === RIV ? 16 : cls[i] === RIV2 ? 7 : 0);
};
while (hp.length) {
  const [i, d] = pop();
  if (d > dist[i]) continue;
  const r = REGIONS[reg[i] - 1], s = seeds[r.i - 1], x = i % W;
  for (const j of [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, i - W, i + W]) {
    if (j < 0 || j >= N || !isLand(cls[j]) || own[j] !== own[i]) continue;
    if (forcedPx.gibraltar.includes(j) || forcedPx.malta.includes(j)) continue;
    const jx = j % W, jy = (j / W) | 0;
    const dk = Math.hypot(jx - s.fx, jy - s.fy) * PROJ.kmPx;
    if (dk > r.maxR || !claim(j) || (bio[j] === 11 && dk > 600)) continue;
    const nd = d + cost(j);
    if (nd < dist[j]) ((dist[j] = nd), (reg[j] = r.i), push(nd, j));
  }
}
// острова без семян → ближайшее семя того же владельца (до 420 км); остальное — «пустошь» (0)
{
  const seen = new Uint8Array(N);
  for (let i0 = 0; i0 < N; i0++) {
    if (seen[i0] || reg[i0] || !isLand(cls[i0]) || !own[i0]) continue;
    const comp = [i0];
    seen[i0] = 1;
    let touch = 0, sx = 0, sy = 0;
    for (let q = 0; q < comp.length; q++) {
      const i = comp[q], x = i % W;
      sx += x, sy += (i / W) | 0;
      for (const j of [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, i - W, i + W]) {
        if (j < 0 || j >= N || !isLand(cls[j])) continue;
        if (own[j] === own[i0] && reg[j]) touch = 1;
        else if (own[j] === own[i0] && !seen[j]) ((seen[j] = 1), comp.push(j));
      }
    }
    if (touch) continue;
    const cx = sx / comp.length, cy = sy / comp.length;
    let best = 0, bd = 420 / PROJ.kmPx;
    REGIONS.forEach((r, k) => {
      const s = seeds[k];
      if (!s || NI[r.own] !== own[i0]) return;
      const d = Math.hypot(s.x - cx, s.y - cy);
      d < bd && ((bd = d), (best = r.i));
    });
    if (best) for (const i of comp) reg[i] = best;
  }
}
for (let i = 0; i < N; i++) cls[i] === LAND && (cls[i] = bio[i]);
// ——— 7. сведения о регионах ———
const NR = REGIONS.length, info = REGIONS.map(() => ({ px: 0, sx: 0, sy: 0, x0: W, y0: H, x1: 0, y1: 0, riv: 0 }));
for (let i = 0; i < N; i++) {
  const r = reg[i];
  if (!r) continue;
  const o = info[r - 1], x = i % W, y = (i / W) | 0;
  o.px++, (o.sx += x), (o.sy += y);
  x < o.x0 && (o.x0 = x), y < o.y0 && (o.y0 = y), x > o.x1 && (o.x1 = x), y > o.y1 && (o.y1 = y);
}
// якорь фишки: самая «глубокая» точка региона с поправкой к городу-семени
const dt = new Int16Array(N).fill(-1);
{
  let q = [];
  for (let i = 0; i < N; i++) {
    if (!reg[i]) continue;
    const x = i % W;
    let edge = 0;
    for (const j of [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, i - W, i + W]) (j < 0 || j >= N || reg[j] !== reg[i]) && (edge = 1);
    edge && ((dt[i] = 0), q.push(i));
  }
  for (let d = 1; q.length; d++) {
    const nq = [];
    for (const i of q) {
      const x = i % W;
      for (const j of [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, i - W, i + W])
        j >= 0 && j < N && reg[j] === reg[i] && dt[j] < 0 && ((dt[j] = d), nq.push(j));
    }
    q = nq;
  }
}
const anchor = REGIONS.map(() => [0, 0, -1e9]);
for (let i = 0; i < N; i++) {
  const r = reg[i];
  if (!r) continue;
  const s = seeds[r - 1], x = i % W, y = (i / W) | 0;
  const sc = Math.min(dt[i], 7) - 0.22 * Math.hypot(x - s.fx, y - s.fy);
  sc > anchor[r - 1][2] && (anchor[r - 1] = [x, y, sc]);
}
// смежность
const pair = new Map();
for (let i = 0; i < N; i++) {
  const a = reg[i];
  if (!a) continue;
  const x = i % W;
  for (const j of [x < W - 1 ? i + 1 : -1, i + W]) {
    if (j < 0 || j >= N) continue;
    const b = reg[j];
    if (!b || b === a) continue;
    const key = a < b ? a * 1000 + b : b * 1000 + a, e = pair.get(key) || [0, 0];
    e[0]++, (cls[i] === RIV || cls[i] === RIV2 || cls[j] === RIV || cls[j] === RIV2) && e[1]++;
    pair.set(key, e);
  }
}
const adj = [];
for (const [key, [n, rv]] of pair) {
  const a = Math.floor(key / 1000), b = key % 1000;
  adj.push([a, b, rv / n >= 0.35 ? 1 : 0, n]);
}
const KI = Object.fromEntries(REGIONS.map((r) => [r.k, r.i]));
const sea = SEA_LINKS.map(([a, b, z]) => [KI[a], KI[b], z]);
// ——— 8. упаковка ———
let cr = '';
{
  let cur = cls[0], len = 0;
  for (let i = 0; i <= N; i++) {
    if (i < N && cls[i] === cur) { len++; continue; }
    cr += String.fromCharCode(65 + cur) + len.toString(36);
    if (i < N) ((cur = cls[i]), (len = 1));
  }
}
const isL = (c) => c !== 0 && c !== LAKE;
let rr = [];
{
  let cur = -1, len = 0;
  for (let i = 0; i < N; i++) {
    if (!isL(cls[i])) continue;
    if (reg[i] === cur) { len++; continue; }
    cur >= 0 && rr.push(cur.toString(36) + '.' + len.toString(36));
    ((cur = reg[i]), (len = 1));
  }
  rr.push(cur.toString(36) + '.' + len.toString(36));
}
const out = {
  w: W, h: H, proj: PROJ, cls: cr, reg: rr.join(','),
  R: REGIONS.map((r, k) => {
    const o = info[k], s = seeds[k], a = anchor[k];
    return [o.px, a[0], a[1], s ? Math.round(s.fx * 10) / 10 : 0, s ? Math.round(s.fy * 10) / 10 : 0, o.x0, o.y0, o.x1, o.y1];
  }),
  adj: adj.map(([a, b, rv]) => [a, b, rv]), sea,
};
const OUT = path.join(HERE, '..', 'src', 'data', 'europe.json');
fs.writeFileSync(OUT, JSON.stringify(out));
// ——— отчёт ———
const cnt = new Array(13).fill(0);
for (const c of cls) cnt[c]++;
console.log('europe.json', (fs.statSync(OUT).size / 1024).toFixed(1) + ' KB', 'cls', (cr.length / 1024).toFixed(0) + 'K', 'reg', (out.reg.length / 1024).toFixed(0) + 'K');
console.log('классы', cnt.join(','));
for (const w of warn) console.log('!', w);
const sz = info.map((o, k) => [REGIONS[k].k, o.px]).sort((a, b) => a[1] - b[1]);
console.log('мелкие', sz.slice(0, 14).map((s) => s.join(':')).join(' '));
console.log('крупные', sz.slice(-14).map((s) => s.join(':')).join(' '));
const deg = new Array(NR + 1).fill(0);
for (const [a, b] of adj) deg[a]++, deg[b]++;
for (const [a, b] of sea) deg[a]++, deg[b]++;
console.log('без соседей', REGIONS.filter((r) => !deg[r.i]).map((r) => r.k).join(' ') || '—');
console.log('смежностей', adj.length, 'через реку', adj.filter((a) => a[2]).length, 'слабых (≤2)', adj.filter((a) => a[3] <= 2).map(([a, b, , n]) => REGIONS[a - 1].k + '-' + REGIONS[b - 1].k + ':' + n).join(' '));
console.log('реки', [...used.keys()].sort().join(', '));
let waste = 0;
for (let i = 0; i < N; i++) isL(cls[i]) && !reg[i] && own[i] && waste++;
console.log('пустошь (у владельца, без региона)', waste, 'px');
// ——— предпросмотр ———
if (process.argv.includes('--preview')) {
  let sharp;
  for (const p of ['sharp', '/data/node_modules/sharp', '/vercel/sandbox/node_modules/sharp']) {
    try { sharp = require(p); break; } catch {}
  }
  const hex = (s) => [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16)];
  const S = 2, rgb = Buffer.alloc(W * S * H * S * 3);
  const NC = NAT.map((k) => hex(NATIONS[k].col));
  for (let i = 0; i < N; i++) {
    const x = i % W, y = (i / W) | 0, c = cls[i], r = reg[i];
    let col = c === 0 ? [40, 80, 120] : c === LAKE ? [60, 110, 160] : [150, 150, 130];
    if (r) {
      const o = NC[NI[REGIONS[r - 1].own] - 1], h = ((r * 37) % 11) / 11 - 0.5;
      col = o.map((v) => Math.max(0, Math.min(255, v + h * 50)));
      const e = [x > 0 ? i - 1 : i, x < W - 1 ? i + 1 : i, i - W >= 0 ? i - W : i, i + W < N ? i + W : i].some((j) => reg[j] !== r && reg[j]);
      e && (col = REGIONS[reg[[i - 1, i + 1, i - W, i + W].find((j) => j >= 0 && j < N && reg[j] && reg[j] !== r)] - 1]?.own !== REGIONS[r - 1].own ? [20, 20, 20] : col.map((v) => v * 0.55));
    } else if (c && c !== LAKE) col = c === 8 ? [205, 190, 140] : c === 11 ? [170, 175, 160] : [140, 145, 120];
    if (c === RIV || c === RIV2) col = [50, 100, 190];
    for (let dy = 0; dy < S; dy++) for (let dx = 0; dx < S; dx++) col.forEach((v, k) => (rgb[((y * S + dy) * W * S + x * S + dx) * 3 + k] = v));
  }
  REGIONS.forEach((r, k) => {
    const a = anchor[k];
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) [255, 255, 255].forEach((v, c) => (rgb[(((a[1] * S + S / 2 + dy) * W * S) + a[0] * S + S / 2 + dx) * 3 + c] = v));
  });
  const labels = REGIONS.map((r, k) => `<text x="${anchor[k][0] * S + 4}" y="${anchor[k][1] * S - 3}" font-size="9" font-family="DejaVu Sans" fill="#000" stroke="#fff" stroke-width="2" paint-order="stroke">${r.n}</text>`).join('');
  const svg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W * S}" height="${H * S}">${labels}</svg>`);
  fs.mkdirSync(path.join(HERE, 'shots'), { recursive: true });
  await sharp(rgb, { raw: { width: W * S, height: H * S, channels: 3 } }).composite([{ input: svg }]).png().toFile(path.join(HERE, 'shots', 'europe-regions.png'));
  console.log('tools/shots/europe-regions.png');
}
