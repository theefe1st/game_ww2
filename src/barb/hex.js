// «Барбаросса 1941» (v0.8): гексовая сетка «odd-r» (как у тактических карт v0.1–v0.6) и декодер карты
// формата tools/build-hexmap.cjs. Без DOM — используется и в браузере, и в tools/sim-barb.mjs.
export const SQ3 = Math.sqrt(3);

export function makeGrid(cols, rows, R) {
  const W = SQ3 * R, rowH = 1.5 * R;
  return { cols, rows, R, W, rowH, n: cols * rows, pxW: Math.ceil(cols * W + W / 2), pxH: Math.ceil((rows - 1) * rowH + 2 * R) };
}
// центр гекса в пикселях карты
export function hexXY(g, i) {
  const c = i % g.cols, r = (i / g.cols) | 0;
  return [g.W / 2 + c * g.W + (r & 1 ? g.W / 2 : 0), g.R + r * g.rowH];
}
// направления 0–5: восток, северо-восток, северо-запад, запад, юго-запад, юго-восток
const DE = [[1, 0], [0, -1], [-1, -1], [-1, 0], [-1, 1], [0, 1]];
const DO = [[1, 0], [1, -1], [0, -1], [-1, 0], [0, 1], [1, 1]];
export function nbDir(g, i, d) {
  const c = i % g.cols, r = (i / g.cols) | 0, o = (r & 1 ? DO : DE)[d], x = c + o[0], y = r + o[1];
  return x < 0 || y < 0 || x >= g.cols || y >= g.rows ? -1 : y * g.cols + x;
}
export function nbrs(g, i) {
  const out = [];
  for (let d = 0; d < 6; d++) {
    const j = nbDir(g, i, d);
    if (j >= 0) out.push(j);
  }
  return out;
}
function cube(g, i) {
  const c = i % g.cols, r = (i / g.cols) | 0, x = c - (r - (r & 1)) / 2;
  return [x, -x - r, r];
}
function uncube(g, x, z) {
  const c = x + (z - (z & 1)) / 2;
  return c < 0 || z < 0 || c >= g.cols || z >= g.rows ? -1 : z * g.cols + c;
}
// прямая цепочка гексов от a до b (линейная интерполяция в кубических координатах)
export function hexLine(g, a, b) {
  const p = cube(g, a), q = cube(g, b), n = hexDist(g, a, b), out = [];
  for (let k = 0; k <= n; k++) {
    const t = n ? k / n : 0, e = 1e-6;
    let x = p[0] + (q[0] - p[0]) * t + e, y = p[1] + (q[1] - p[1]) * t + e, z = p[2] + (q[2] - p[2]) * t - 2 * e;
    let rx = Math.round(x), ry = Math.round(y), rz = Math.round(z);
    const dx = Math.abs(rx - x), dy = Math.abs(ry - y), dz = Math.abs(rz - z);
    if (dx > dy && dx > dz) rx = -ry - rz;
    else if (dy > dz) ry = -rx - rz;
    else rz = -rx - ry;
    const h = uncube(g, rx, rz);
    if (h >= 0 && out[out.length - 1] !== h) out.push(h);
  }
  return out;
}
export function hexDist(g, a, b) {
  const p = cube(g, a), q = cube(g, b);
  return Math.max(Math.abs(p[0] - q[0]), Math.abs(p[1] - q[1]), Math.abs(p[2] - q[2]));
}
// гекс под точкой карты (или −1)
export function hexAtXY(g, x, y) {
  const px = x - g.W / 2, py = y - g.R;
  const q = ((SQ3 / 3) * px - py / 3) / g.R, r = ((2 / 3) * py) / g.R;
  let cx = Math.round(q), cz = Math.round(r), cy = Math.round(-q - r);
  const dx = Math.abs(cx - q), dz = Math.abs(cz - r), dy = Math.abs(cy - (-q - r));
  if (dx > dy && dx > dz) cx = -cy - cz;
  else if (dy > dz) cy = -cx - cz;
  else cz = -cx - cy;
  const row = cz, col = cx + (cz - (cz & 1)) / 2;
  return col < 0 || row < 0 || col >= g.cols || row >= g.rows ? -1 : row * g.cols + col;
}
// равновеликая азимутальная проекция Ламберта (как в build-hexmap)
const RE = 6371, DEG = Math.PI / 180;
export function llToXY(P, lon, lat) {
  const l = (lon - P.lon0) * DEG, f = lat * DEG, f0 = P.lat0 * DEG;
  const k = Math.sqrt(2 / (1 + Math.sin(f0) * Math.sin(f) + Math.cos(f0) * Math.cos(f) * Math.cos(l)));
  const x = RE * k * Math.cos(f) * Math.sin(l), y = RE * k * (Math.cos(f0) * Math.sin(f) - Math.sin(f0) * Math.cos(f) * Math.cos(l));
  return [(x - P.xmin) * P.pxPerKm, (P.ymax - y) * P.pxPerKm];
}
// декодер: местность (коды 0 море, 1 озеро, 2 равнина, 3 лес, 4 холмы, 5 горы, 6 болота, 7 город), владельцы,
// города, рёбра рек, попиксельные классы (0 вода, 1 суша, 2 озеро/широкая река) для пиксельного рельефа
export function decodeMap(J) {
  const g = makeGrid(J.cols, J.rows, J.R), N = g.n;
  const terrain = new Uint8Array(N), owner0 = new Uint8Array(N);
  for (let i = 0; i < N; i++) (terrain[i] = J.terrain.charCodeAt(i) - 48), (owner0[i] = J.owner[i]);
  const cityAt = new Int16Array(N).fill(-1);
  J.cities.forEach((c, k) => (cityAt[c.hex] = k));
  const riv = new Set();
  for (const [a, b] of J.riverEdges) riv.add(a * N + b), riv.add(b * N + a);
  const nbr = [];
  for (let i = 0; i < N; i++) nbr.push(nbrs(g, i));
  const cls = new Uint8Array(g.pxW * g.pxH);
  let p = 0;
  for (const t of J.cls.split('.')) {
    if (!t) continue;
    const v = t.charCodeAt(0) - 48, n = parseInt(t.slice(1), 36);
    cls.fill(v, p, p + n);
    p += n;
  }
  const M = { g, N, proj: J.proj, nations: J.nations, terrain, owner0, cities: J.cities, cityAt, riv, nbr, rivers: J.rivers, cls };
  M.river = (a, b) => riv.has(a * N + b);
  M.land = (i) => terrain[i] >= 2;
  M.cityHex = (name) => J.cities.find((c) => c.name === name)?.hex ?? -1;
  M.hexLL = (lon, lat) => {
    const [x, y] = llToXY(J.proj, lon, lat);
    return hexAtXY(g, Math.max(g.W / 2, Math.min(g.pxW - g.W, x)), Math.max(g.R, Math.min(g.pxH - g.R, y)));
  };
  M.xy = (i) => hexXY(g, i);
  M.dist = (a, b) => hexDist(g, a, b);
  // дороги: список ломаных (город или [долгота, широта]) → рёбра гексов; по дороге ход стоит 1, реки — по мостам
  const road = new Set();
  M.roads = [];
  M.road = (a, b) => road.has(a * N + b);
  M.addRoads = (list) => {
    if (M.roads.length) return;
    const pt = (p) => (typeof p === 'string' ? M.cityHex(p) : M.hexLL(p[0], p[1]));
    for (const line of list) {
      const hs = [];
      for (let k = 0; k + 1 < line.length; k++) {
        const a = pt(line[k]), b = pt(line[k + 1]);
        if (a < 0 || b < 0) continue;
        for (const h of hexLine(g, a, b)) if (hs[hs.length - 1] !== h) hs.push(h);
      }
      for (let k = 0; k + 1 < hs.length; k++) road.add(hs[k] * N + hs[k + 1]), road.add(hs[k + 1] * N + hs[k]);
      M.roads.push(hs);
    }
  };
  return M;
}
