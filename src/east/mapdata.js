// «Восточный фронт» (v0.10): разбор src/east/data/map.json (tools/build-east.mjs) — области, дуги границ,
// соседства, реки, берега и сетка рельефа. Координаты — км карты (коническая проекция Ламберта, y вниз).
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const DEC = new Int8Array(128).fill(-1);
for (let i = 0; i < 64; i++) DEC[B64.charCodeAt(i)] = i;
export function decPts(s, unit = 0.5) {
  const out = [];
  let i = 0, x = 0, y = 0, k = 0;
  const get = () => { let z = 0, sh = 0, c; do { c = DEC[s.charCodeAt(i++)]; z |= (c & 31) << sh; sh += 5; } while (c & 32); return z & 1 ? -((z + 1) >>> 1) : z >>> 1; };
  while (i < s.length) { x += get(); y += get(); out.push(x * unit, y * unit); k++; }
  return out;
}
// сглаживание Чайкина (концы закреплены)
export function chaikin(p, it = 2, closed = false) {
  for (let r = 0; r < it; r++) {
    const n = p.length / 2;
    if (n < 3) return p;
    const o = closed ? [] : [p[0], p[1]];
    for (let i = 0; i < (closed ? n : n - 1); i++) {
      const j = (i + 1) % n, ax = p[i * 2], ay = p[i * 2 + 1], bx = p[j * 2], by = p[j * 2 + 1];
      o.push(0.75 * ax + 0.25 * bx, 0.75 * ay + 0.25 * by, 0.25 * ax + 0.75 * bx, 0.25 * ay + 0.75 * by);
    }
    closed || o.push(p[p.length - 2], p[p.length - 1]);
    p = o;
  }
  return p;
}
const b64u8 = (s) => { const bin = atob(s), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u; };
export const TER_N = { pla: 'равнина', for: 'лес', mar: 'болота', hil: 'холмы', mnt: 'горы' };
export function decodeMap(J) {
  const M = { w: J.w, h: J.h, proj: J.proj, nats: J.nats, zones: J.zones };
  M.arcs = J.arcs.map(([a, b, t, s]) => {
    const raw = decPts(s), closed = raw.length > 4 && raw[0] === raw[raw.length - 2] && raw[1] === raw[raw.length - 1];
    let p = chaikin(raw, 2, false);
    return { a, b, t, p: Float32Array.from(p), closed };
  });
  const bboxOf = (rg) => {
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const ring of rg) for (const k of ring) { const p = M.arcs[k < 0 ? ~k : k].p; for (let i = 0; i < p.length; i += 2) { p[i] < x0 && (x0 = p[i]); p[i] > x1 && (x1 = p[i]); p[i + 1] < y0 && (y0 = p[i + 1]); p[i + 1] > y1 && (y1 = p[i + 1]); } }
    return [x0, y0, x1, y1];
  };
  M.reg = J.regs.map((g, id) => ({ id, n: g.n, o: g.o, nat: J.nats[g.o], x: g.x, y: g.y, a: g.a, t: g.t, z: g.z, ind: g.ind, vp: g.vp, f: g.f, e: g.e, c: g.c, rg: g.rg, bb: bboxOf(g.rg), nb: [] }));
  M.R = M.reg.length;
  M.neut = J.neut.map((g) => ({ ...g, bb: bboxOf(g.rg) }));
  M.adj = J.adj.map(([a, b, len, riv, rail, sp]) => ({ a, b, len, riv, rail, sp }));
  for (const e of M.adj) {
    M.reg[e.a].nb.push({ r: e.b, len: e.len, riv: e.riv, rail: e.rail, sp: e.sp });
    M.reg[e.b].nb.push({ r: e.a, len: e.len, riv: e.riv, rail: e.rail, sp: e.sp });
  }
  M.nbOf = (r) => M.reg[r].nb;
  M.edge = new Map();
  for (const e of M.adj) M.edge.set(e.a * 4096 + e.b, e), M.edge.set(e.b * 4096 + e.a, e);
  M.cities = J.cities.map(([n, x, y, s, r]) => ({ n, x, y, s, r }));
  for (const c of M.cities) { const g = M.reg[c.r]; if (g && (!g.city || c.s > g.city.s)) g.city = c; }
  M.rivers = J.rivers.map(([n, w, s]) => ({ n, w, p: Float32Array.from(chaikin(decPts(s), 1)) }));
  M.land = J.land.map((s) => Float32Array.from(decPts(s)));
  M.lakes = J.lakes.map((s) => Float32Array.from(decPts(s)));
  const m = J.mesh;
  M.mesh = { step: m.step, nx: m.nx, ny: m.ny, pal: m.pal, e: new Int16Array(b64u8(m.e).buffer), c: b64u8(m.c), f: b64u8(m.f) };
  return M;
}
// путь области (кольца из дуг) — в координатах карты
export function regionPath(M, rg) {
  const P = new Path2D();
  for (const ring of rg) {
    let first = true;
    for (const k of ring) {
      const p = M.arcs[k < 0 ? ~k : k].p, n = p.length / 2;
      for (let q = 0; q < n; q++) {
        const i = k < 0 ? n - 1 - q : q;
        first ? (P.moveTo(p[i * 2], p[i * 2 + 1]), (first = false)) : P.lineTo(p[i * 2], p[i * 2 + 1]);
      }
    }
    P.closePath();
  }
  return P;
}
export function polyPath(rings) {
  const P = new Path2D();
  for (const p of rings) {
    P.moveTo(p[0], p[1]);
    for (let i = 2; i < p.length; i += 2) P.lineTo(p[i], p[i + 1]);
    P.closePath();
  }
  return P;
}
// проекция (как в tools/build-east.mjs): долгота/широта → км карты
export function makeProj(P) {
  const RE = 6371, DG = Math.PI / 180, f1 = P.lat1 * DG, f2 = P.lat2 * DG;
  const n = Math.log(Math.cos(f1) / Math.cos(f2)) / Math.log(Math.tan(Math.PI / 4 + f2 / 2) / Math.tan(Math.PI / 4 + f1 / 2));
  const F = (Math.cos(f1) * Math.pow(Math.tan(Math.PI / 4 + f1 / 2), n)) / n, r0 = (RE * F) / Math.pow(Math.tan(Math.PI / 4 + (P.lat0 * DG) / 2), n);
  return (lon, lat) => {
    const r = (RE * F) / Math.pow(Math.tan(Math.PI / 4 + (lat * DG) / 2), n), t = n * (lon - P.lon0) * DG;
    return [r * Math.sin(t) - P.x0, P.y0 - (r0 - r * Math.cos(t))];
  };
}
// кольца области точками (для попадания точки и отрисовки)
export function ringPts(M, ring) {
  const pts = [];
  for (const k of ring) {
    const p = M.arcs[k < 0 ? ~k : k].p, n = p.length / 2;
    for (let q = 0; q < n; q++) { const i = k < 0 ? n - 1 - q : q; if (q === 0 && pts.length) continue; pts.push(p[i * 2], p[i * 2 + 1]); }
  }
  return pts;
}
function inPoly(p, x, y) {
  let c = false;
  for (let i = 0, n = p.length / 2, j = n - 1; i < n; j = i++) {
    const xi = p[i * 2], yi = p[i * 2 + 1], xj = p[j * 2], yj = p[j * 2 + 1];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}
// область под точкой (км карты) или −1
export function regionAt(M, x, y) {
  M.rp ??= M.reg.map((g) => g.rg.map((ring) => ringPts(M, ring)));
  for (const g of M.reg) {
    const b = g.bb;
    if (x < b[0] || x > b[2] || y < b[1] || y > b[3]) continue;
    let c = false;
    for (const p of M.rp[g.id]) if (inPoly(p, x, y)) c = !c;
    if (c) return g.id;
  }
  return -1;
}
// ближайшая область по центрам с условием
export function nearestRegion(M, x, y, ok = () => true) {
  let best = -1, bd = Infinity;
  for (const g of M.reg) { if (!ok(g.id)) continue; const d = (g.x - x) ** 2 + (g.y - y) ** 2; if (d < bd) (bd = d), (best = g.id); }
  return best;
}
