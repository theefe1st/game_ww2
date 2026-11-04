// «Фронт 1941–1945» (v0.9): декодер карты Европы на 22.06.1941 (src/data/eu41.json, tools/build-eumap.mjs).
// Гексы ≈ 40 км («odd-r», как в src/barb/hex.js). Без DOM — используется и в игре, и в tools/sim-war.mjs.
// Местность: 0 море, 1 озеро, 2 равнина, 3 лес, 4 холмы, 5 горы, 6 болота, 7 степь, 8 тундра.
import { makeGrid, hexXY, nbDir, hexAtXY, hexDist, SQ3 } from '../barb/hex.js';

export const TERR_N = ['море', 'озеро', 'равнина', 'лес', 'холмы', 'горы', 'болота', 'степь', 'тундра'];
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const dec6 = (s) => {
  const a = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) a[i] = B64.indexOf(s[i]);
  return a;
};
const RE = 6371, DEG = Math.PI / 180;

export function decodeEU(J) {
  const g = makeGrid(J.cols, J.rows, J.R), N = g.n;
  const terr = new Uint8Array(N), own0 = new Uint8Array(N);
  for (let i = 0; i < N; i++) (terr[i] = J.terrain.charCodeAt(i) - 48), (own0[i] = parseInt(J.owner[i], 36));
  const riv = dec6(J.river), rivW = dec6(J.riverW), rail = dec6(J.rail);
  const reg = new Uint16Array(N);
  {
    let p = 0;
    for (const t of J.region.split(' ')) {
      const [v, n] = t.split('.').map((x) => parseInt(x, 36));
      reg.fill(v, p, p + n);
      p += n;
    }
  }
  // соседи: nb[i*6+d] (−1 — край карты)
  const nb = new Int32Array(N * 6);
  for (let i = 0; i < N; i++) for (let d = 0; d < 6; d++) nb[i * 6 + d] = nbDir(g, i, d);
  const cities = J.cities.map(([n, h, sz, vp, f], k) => ({
    k, n, h, sz, vp, cap: f.includes('c'), port: f.includes('p'), fort: f.includes('f'), hard: f.includes('h'), x: f.includes('x'),
  }));
  // Киевский укрепрайон (КиУР) — как крепость; запасы крепостей — см. FORT0 в engine.js
  // Москва — Можайская линия и Московская зона обороны
  for (const c of cities) if (c.n === 'Киев' || c.n === 'Ленинград' || c.n === 'Москва' || c.n === 'Тула') c.fort = true;
  const cityAt = new Int16Array(N).fill(-1);
  for (const c of cities) cityAt[c.h] = c.k;
  const byName = new Map(cities.map((c) => [c.n, c]));
  // проекция: равновеликая Ламберта (км), сетка — км → пиксели карты (R пикселей на радиус гекса)
  const P = J.proj, s0 = Math.sin(P.lat0 * DEG), c0 = Math.cos(P.lat0 * DEG), RK = P.km / SQ3, PXK = J.R / RK;
  const fwd = (lon, lat) => {
    const l = (lon - P.lon0) * DEG, f = lat * DEG, k = Math.sqrt(2 / (1 + s0 * Math.sin(f) + c0 * Math.cos(f) * Math.cos(l)));
    return [RE * k * Math.cos(f) * Math.sin(l), RE * k * (c0 * Math.sin(f) - s0 * Math.cos(f) * Math.cos(l))];
  };
  const llXY = (lon, lat) => {
    const [x, y] = fwd(lon, lat);
    return [(x - P.xmin) * PXK, (P.ymax - y) * PXK];
  };
  const M = {
    J, g, N, terr, own0, nations: J.nations, riv, rivW, rail, reg, regions: J.regions, offmap: J.offmap, nb, cities, cityAt, rivers: J.rivers,
    land: (i) => terr[i] >= 2,
    xy: (i) => hexXY(g, i),
    hexAt: (x, y) => hexAtXY(g, x, y),
    dist: (a, b) => hexDist(g, a, b),
    llXY,
    hexLL: (lon, lat) => {
      const [x, y] = llXY(lon, lat);
      return hexAtXY(g, x, y);
    },
    city: (name) => byName.get(name) || null,
    cityHex: (name) => byName.get(name)?.h ?? -1,
    river: (i, d) => (riv[i] >> d) & 1,
    bigRiver: (i, d) => (rivW[i] >> d) & 1,
    railDir: (i, d) => (rail[i] >> d) & 1,
    // направление от a к соседу b (или −1)
    dirTo: (a, b) => {
      for (let d = 0; d < 6; d++) if (nb[a * 6 + d] === b) return d;
      return -1;
    },
    row: (i) => (i / g.cols) | 0,
    col: (i) => i % g.cols,
  };
  // ближайшая суша к гексу (для расстановки)
  M.nearLand = (h, ok = () => true) => {
    if (h >= 0 && terr[h] >= 2 && ok(h)) return h;
    const seen = new Set([h]);
    let q = [h];
    for (let r = 0; r < 6 && q.length; r++) {
      const nq = [];
      for (const i of q)
        for (let d = 0; d < 6; d++) {
          const j = nb[i * 6 + d];
          if (j < 0 || seen.has(j)) continue;
          seen.add(j);
          if (terr[j] >= 2 && ok(j)) return j;
          nq.push(j);
        }
      q = nq;
    }
    return -1;
  };
  // широтная зона гекса для погоды: 0 север (Карелия, Ленинград), 1 центр, 2 юг (Украина, Крым, Кавказ)
  const zone = new Uint8Array(N);
  const yN = llXY(30, 58.6)[1], yS = llXY(30, 50.6)[1];
  for (let i = 0; i < N; i++) {
    const y = hexXY(g, i)[1];
    zone[i] = y < yN ? 0 : y < yS ? 1 : 2;
  }
  M.zone = zone;
  // гексы в радиусе r (включая центр)
  M.ring = (h, r) => {
    const out = [h], seen = new Set(out);
    let q = [h];
    for (let k = 0; k < r; k++) {
      const nq = [];
      for (const i of q)
        for (let d = 0; d < 6; d++) {
          const j = nb[i * 6 + d];
          if (j < 0 || seen.has(j)) continue;
          seen.add(j);
          out.push(j);
          nq.push(j);
        }
      q = nq;
    }
    return out;
  };
  return M;
}
