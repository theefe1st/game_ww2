// Карта фронта: проекция, заливка полигонов, владельцы по этапам и попиксельная отрисовка подложки.
// Чистые функции — используются и в игре, и в tools/preview-front.mjs.
import { FRONT_STAGES, FRONT_DELTAS, FRONT_RELIEF } from './stages.js';

const DEG = Math.PI / 180, EARTH = 6371;
export function makeProj(P) {
  const a = P.lat0 * DEG, sa = Math.sin(a), ca = Math.cos(a);
  return (lon, lat) => {
    const r = (lon - P.lon0) * DEG, i = lat * DEG, si = Math.sin(i), ci = Math.cos(i), cr = Math.cos(r);
    const k = Math.sqrt(2 / (1 + sa * si + ca * ci * cr));
    return [(EARTH * k * ci * Math.sin(r) - P.xmin) / P.kmPx, (P.ymax - EARTH * k * (ca * si - sa * ci * cr)) / P.kmPx];
  };
}
export function decodeCls(rle, n) {
  const out = new Uint8Array(n);
  let i = 0;
  for (const t of rle.split(`.`)) {
    const v = +t[0], len = parseInt(t.slice(1), 36);
    out.fill(v, i, i + len);
    i += len;
  }
  return out;
}
// Заливка многоугольника (правило ненулевой обмотки) по центрам пикселей.
export function scanFill(w, h, pts, cb) {
  const n = pts.length;
  if (n < 3) return;
  let y0 = Infinity, y1 = -Infinity;
  for (const p of pts) (p[1] < y0 && (y0 = p[1]), p[1] > y1 && (y1 = p[1]));
  const ya = Math.max(0, Math.floor(y0)), yb = Math.min(h - 1, Math.ceil(y1));
  const xs = [];
  for (let y = ya; y <= yb; y++) {
    const cy = y + 0.5;
    xs.length = 0;
    for (let i = 0; i < n; i++) {
      const p = pts[i], q = pts[(i + 1) % n];
      if ((p[1] <= cy && q[1] > cy) || (q[1] <= cy && p[1] > cy)) {
        const x = p[0] + ((cy - p[1]) / (q[1] - p[1])) * (q[0] - p[0]);
        xs.push([x, q[1] > p[1] ? 1 : -1]);
      }
    }
    if (!xs.length) continue;
    xs.sort((u, v) => u[0] - v[0]);
    let wn = 0;
    for (let k = 0; k < xs.length - 1; k++) {
      wn += xs[k][1];
      if (!wn) continue;
      const xa = Math.max(0, Math.ceil(xs[k][0] - 0.5)), xb = Math.min(w - 1, Math.floor(xs[k + 1][0] - 0.5));
      for (let x = xa; x <= xb; x++) cb(y * w + x);
    }
  }
}
export function frontBase(B) {
  const n = B.w * B.h, cls = decodeCls(B.cls, n), pr = makeProj(B.proj);
  const isLand = (c) => c === 1 || c === 3 || c === 4;
  const cache = new Map();
  const px = (poly) => {
    let r = cache.get(poly);
    return r || (cache.set(poly, (r = poly.map(([lo, la]) => pr(lo, la)))), r);
  };
  return { ...B, n, cls, pr, isLand, px };
}
// Владельцы: 0 вода, 1 СССР, 2 Ось, 3 нейтралы
// Неровный край для полигонов сдвига (детерминированный шум)
function roughen(p, seed) {
  const out = [];
  for (let k = 0; k < p.length; k++) {
    const [x0, y0] = p[k], [x1, y1] = p[(k + 1) % p.length];
    const len = Math.hypot(x1 - x0, y1 - y0), m = Math.max(1, Math.round(len / 0.22));
    const nx = -(y1 - y0) / (len || 1), ny = (x1 - x0) / (len || 1);
    for (let j = 0; j < m; j++) {
      const t = j / m, x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t;
      const a = j === 0 ? 0 : (vnoise(x * 3.1, y * 3.1, seed) - 0.5) * 0.34;
      out.push([x + nx * a, y + ny * a]);
    }
  }
  return out;
}
export function frontOwners(F, si, deltaOp, kind) {
  const { w, h, n, cls, isLand } = F, own = new Uint8Array(n), keep = new Uint8Array(n);
  for (let i = 0; i < n; i++) own[i] = isLand(cls[i]) ? 1 : 0;
  const S = FRONT_STAGES[Math.max(0, Math.min(FRONT_STAGES.length - 1, si))];
  const fill = (polys, v, k, rough) => {
    (polys || []).forEach((p, pi) =>
      scanFill(w, h, F.px(rough ? roughen(p, 3 + pi) : p), (i) => own[i] && ((own[i] = v), k && (keep[i] = 1))),
    );
  };
  fill(S.axis, 2), fill(S.sov, 1, 1), fill(S.pocket, 2, 1);
  const d = deltaOp && FRONT_DELTAS[deltaOp];
  d && kind && fill(d[kind], kind === `ahead` ? 1 : 2, 0, 1);
  // убрать «пылинки» — мелкие оторванные клочки (кроме котлов и плацдармов этапа)
  const seen = new Uint8Array(n);
  for (let i0 = 0; i0 < n; i0++) {
    const o = own[i0];
    if (seen[i0] || (o !== 1 && o !== 2)) continue;
    const comp = [i0], nb = [0, 0, 0];
    seen[i0] = 1;
    let prot = keep[i0];
    for (let q = 0; q < comp.length; q++) {
      const i = comp[q], x = i % w;
      for (const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, i - w, i + w]) {
        if (j < 0 || j >= n) continue;
        if (own[j] === o) !seen[j] && ((seen[j] = 1), comp.push(j), keep[j] && (prot = 1));
        else own[j] && nb[own[j] - 1]++;
      }
      if (comp.length > 24) break;
    }
    if (comp.length <= 24 && !prot) {
      const t = nb[0] + nb[1] + nb[2];
      if (t) {
        const v = nb[0] >= nb[1] ? 1 : 2;
        if (v !== o) for (const i of comp) own[i] = v;
      }
    }
  }
  fill(S.neu, 3);
  return own;
}
const hex = (s) => [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16)];
const PAL = {
  deep: hex(`#28567f`), mid: hex(`#2f6290`), shelf: hex(`#3a6f9e`), coastw: hex(`#5f97c6`), wave: hex(`#4378a8`),
  lake: hex(`#3b78ab`), river: hex(`#3e7fc1`), river2: hex(`#4f8fc8`), sand: hex(`#cdc38d`),
  taiga: hex(`#5f8b47`), taiga2: hex(`#577f40`), plain: hex(`#93b05c`), plain2: hex(`#88a653`), steppe: hex(`#b3b46a`), steppe2: hex(`#a6a85f`),
  hill: hex(`#a8a462`), hill2: hex(`#8e8676`), marsh: hex(`#7a9a6c`), marsh2: hex(`#6f8f62`),
  axis: hex(`#6b7078`), hatch: hex(`#3a3d42`), neu: hex(`#c9bf96`), front: hex(`#e8402c`), front2: hex(`#7a1410`), neub: hex(`#7c7458`),
};
export { PAL as FRONT_PAL };
function noise(x, y, s) {
  let t = Math.sin(x * 12.9898 + y * 78.233 + s * 37.719) * 43758.5453;
  return t - Math.floor(t);
}
function vnoise(x, y, s) {
  const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi;
  const a = noise(xi, yi, s), b = noise(xi + 1, yi, s), c = noise(xi, yi + 1, s), d = noise(xi + 1, yi + 1, s);
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
// Цвет подложки без владельцев (RGB на пиксель)
export function frontBaseRGB(F) {
  const { w, h, n, cls } = F, rgb = new Uint8Array(n * 3);
  const rel = new Uint8Array(n);
  for (const r of FRONT_RELIEF) scanFill(w, h, F.px(r.p), (i) => (rel[i] = r.k === `h` ? 1 : 2));
  // расстояние до суши для глубины моря
  const dist = new Uint8Array(n).fill(255), q = [];
  for (let i = 0; i < n; i++) cls[i] !== 0 && ((dist[i] = 0), q.push(i));
  for (let d = 1; d <= 12 && q.length; d++) {
    const nq = [];
    for (const i of q) {
      const x = i % w;
      for (const j of [i - 1, i + 1, i - w, i + w]) {
        if (j < 0 || j >= n || (j === i - 1 && x === 0) || (j === i + 1 && x === w - 1)) continue;
        dist[j] > d && ((dist[j] = d), nq.push(j));
      }
    }
    q.length = 0, q.push(...nq);
  }
  const lat = (y) => 61.5 - (y / h) * 19.5; // грубо: широта по строке
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = y * w + x, c = cls[i];
      let col;
      if (c === 0) {
        const d = dist[i];
        col = d <= 1 ? PAL.coastw : d <= 3 ? PAL.shelf : d <= 7 ? PAL.mid : PAL.deep;
        d > 3 && y % 5 === 0 && (x + ((y / 5) | 0) * 7) % 13 < 3 && vnoise(x / 16, y, 2) > 0.45 && (col = PAL.wave);
      } else if (c === 2) col = y % 4 === 0 && (x + y) % 9 < 2 ? PAL.coastw : PAL.lake;
      else if (c === 3) col = PAL.river;
      else if (c === 4) col = PAL.river2;
      else {
        const nz = vnoise(x / 7, y / 7, 3), fine = noise(x, y, 1);
        const zone = lat(y) + (vnoise(x / 30, y / 30, 5) - 0.5) * 3;
        if (rel[i] === 1) col = fine < 0.3 + nz * 0.4 ? PAL.hill2 : PAL.hill;
        else if (rel[i] === 2) col = fine < 0.5 ? PAL.marsh : PAL.marsh2;
        else if (zone > 55.5) col = fine < 0.45 + (nz - 0.5) * 0.6 ? PAL.taiga : PAL.taiga2;
        else if (zone > 50.5) col = fine < 0.04 ? PAL.taiga : fine < 0.5 + (nz - 0.5) * 0.7 ? PAL.plain : PAL.plain2;
        else col = fine < 0.5 + (nz - 0.5) * 0.7 ? PAL.steppe : PAL.steppe2;
        const coast =
          (x > 0 && cls[i - 1] === 0) || (x < w - 1 && cls[i + 1] === 0) || (y > 0 && cls[i - w] === 0) || (y < h - 1 && cls[i + w] === 0);
        coast && (col = PAL.sand);
      }
      rgb[i * 3] = col[0], rgb[i * 3 + 1] = col[1], rgb[i * 3 + 2] = col[2];
    }
  return rgb;
}
// Итоговый кадр: подложка + владельцы + линия фронта
export function frontComposite(F, rgb, own, out) {
  const { w, h, n, cls } = F;
  for (let i = 0; i < n; i++) {
    let r = rgb[i * 3], g = rgb[i * 3 + 1], b = rgb[i * 3 + 2];
    const o = own[i];
    if (o >= 2) {
      const x = i % w, y = (i / w) | 0;
      let ext = 0, sov = 0;
      if (o === 2) {
        const t = PAL.axis;
        (r = (r * 0.45 + t[0] * 0.55) | 0), (g = (g * 0.45 + t[1] * 0.55) | 0), (b = (b * 0.45 + t[2] * 0.55) | 0);
        (x + y) % 5 === 0 && ((r = (r * 0.62) | 0), (g = (g * 0.62) | 0), (b = (b * 0.66) | 0));
      } else {
        const t = PAL.neu;
        (r = (r * 0.4 + t[0] * 0.6) | 0), (g = (g * 0.4 + t[1] * 0.6) | 0), (b = (b * 0.4 + t[2] * 0.6) | 0);
      }
      for (const j of [i - 1, i + 1, i - w, i + w]) {
        if (j < 0 || j >= n || (j === i - 1 && x === 0) || (j === i + 1 && x === w - 1)) continue;
        own[j] === 1 ? sov++ : own[j] && own[j] !== o && ext++;
      }
      if (o === 2 && sov) [r, g, b] = PAL.front2;
      else if (o === 3 && (sov || ext)) [r, g, b] = PAL.neub;
    } else if (o === 1) {
      const x = i % w;
      for (const j of [i - 1, i + 1, i - w, i + w]) {
        if (j < 0 || j >= n || (j === i - 1 && x === 0) || (j === i + 1 && x === w - 1)) continue;
        if (own[j] === 2) {
          [r, g, b] = PAL.front;
          break;
        }
      }
    }
    (out[i * 4] = r), (out[i * 4 + 1] = g), (out[i * 4 + 2] = b), (out[i * 4 + 3] = 255);
  }
  return out;
}
