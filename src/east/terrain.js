// «Мировой фронт» v0.11, «Восточный фронт»: подложка — сетка рельефа (mesh.js) с мягкой отмывкой (цвет в вершинах,
// освещение с северо-запада), светлая жёлто-зелёная «штабная» палитра: степь — соломенная, леса — зеленее, горы —
// серо-бежевые, вода по глубине. buildTerrain(M) считает вершины и цвета (общие для WebGL — gl.js — и 2D-запаса).
import { meshGrid, meshVert, meshTris, triHash } from './mesh.js';
import { polyPath } from './mapdata.js';

const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const L = (() => { const v = [-0.7, -0.9, 1.6], n = Math.hypot(...v); return v.map((x) => x / n); })();
// палитра (по образцу карты штабного стиля): степь, луга, лес, горы, снег, болото
const STEPPE = [222, 216, 162], MEADOW = [204, 210, 150], FOREST = [180, 197, 140], ROCK = [196, 186, 158], SNOW = [244, 244, 238], MARSH = [182, 198, 166], ARID = [228, 216, 172];
const mix = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
// цвет суши по растительности (Natural Earth II) и высоте
function landCol(p, e, marsh) {
  const lum = (p[0] + p[1] + p[2]) / 765, gd = (p[1] - (p[0] + p[2]) / 2) / 255;
  const fo = clamp((gd - 0.02) * 7 + (0.42 - lum) * 1.6, 0, 1), ar = clamp((p[0] - p[1]) / 30 + (lum - 0.62) * 2, 0, 1);
  let c = fo > 0.5 ? mix(MEADOW, FOREST, (fo - 0.5) * 2) : mix(STEPPE, MEADOW, fo * 2);
  if (ar > 0) c = mix(c, ARID, ar * 0.8);
  if (marsh) c = mix(c, MARSH, 0.6);
  if (e > 500) c = mix(c, ROCK, clamp((e - 500) / 1500, 0, 0.75));
  if (e > 2300) c = mix(c, SNOW, clamp((e - 2300) / 900, 0, 1));
  return c;
}
export function buildTerrain(M) {
  const m = M.mesh, G = meshGrid(M.w, M.h, m.step);
  const NV = G.nx * G.ny;
  const vx = new Float32Array(NV), vy = new Float32Array(NV), vz = new Float32Array(NV);
  for (let j = 0; j < G.ny; j++)
    for (let i = 0; i < G.nx; i++) {
      const v = i + j * G.nx, [x, y] = meshVert(G, i, j), e = m.e[v], a = Math.abs(e);
      vx[v] = x; vy[v] = y;
      vz[v] = e > 0 ? a * 0.0045 + Math.sqrt(a) * 0.03 : 0;
    }
  // цвет вершин: суша (с отмывкой) и вода (по глубине)
  const vl = new Uint8Array(NV * 3), vw = new Uint8Array(NV * 3);
  const at = (i, j) => vz[clamp(i, 0, G.nx - 1) + clamp(j, 0, G.ny - 1) * G.nx];
  for (let j = 0; j < G.ny; j++)
    for (let i = 0; i < G.nx; i++) {
      const v = i + j * G.nx, e = m.e[v], f = m.f[v];
      const dx = (at(i + 1, j) - at(i - 1, j)) / (2 * G.step), dy = (at(i, j + 1) - at(i, j - 1)) / (2 * G.dy);
      const nl = Math.hypot(dx, dy, 1), dot = (-dx * L[0] - dy * L[1] + L[2]) / nl;
      const vr = 1 + ((triHash(i * 7 + 3, j * 13 + 5) >>> 8) / 16777216 - 0.5) * 0.025;
      const sh = clamp(1 + (dot - L[2]) * 1.9, 0.7, 1.12) * vr;
      let c = landCol(m.pal[m.c[v]], e, f & 4 && !(f & 8));
      if (f & 16) { const gr = (c[0] + c[1] + c[2]) / 3; c = [gr * 0.7 + 218 * 0.3, gr * 0.7 + 214 * 0.3, gr * 0.7 + 200 * 0.3]; }
      vl[v * 3] = clamp(c[0] * sh, 0, 255); vl[v * 3 + 1] = clamp(c[1] * sh, 0, 255); vl[v * 3 + 2] = clamp(c[2] * sh, 0, 255);
      const dep = -Math.min(0, e), tt = clamp(dep / 900, 0, 1), lake = f & 2 && dep < 5;
      vw[v * 3] = lake ? 164 : 178 - 40 * tt; vw[v * 3 + 1] = lake ? 198 : 204 - 38 * tt; vw[v * 3 + 2] = lake ? 210 : 212 - 26 * tt;
    }
  const NT0 = (G.nx - 1) * (G.ny - 1) * 2;
  const tri = new Int32Array(NT0 * 3), cl = new Uint8Array(NT0 * 3), cw = new Uint8Array(NT0 * 3), tf = new Uint8Array(NT0), tc = new Uint32Array(NT0);
  let t = 0;
  for (let j = 0; j < G.ny - 1; j++)
    for (let i = 0; i < G.nx - 1; i++)
      for (const [a, b, c] of meshTris(G, i, j)) {
        tri[t * 3] = a; tri[t * 3 + 1] = b; tri[t * 3 + 2] = c;
        const fa = m.f[a], fb = m.f[b], fc = m.f[c];
        for (let k = 0; k < 3; k++) { cl[t * 3 + k] = (vl[a * 3 + k] + vl[b * 3 + k] + vl[c * 3 + k]) / 3; cw[t * 3 + k] = (vw[a * 3 + k] + vw[b * 3 + k] + vw[c * 3 + k]) / 3; }
        const off = (fa & 16) + (fb & 16) + (fc & 16) >= 32, land = (fa & 1) + (fb & 1) + (fc & 1);
        tf[t] = (land ? 1 : 0) | ((fa & 8) + (fb & 8) + (fc & 8) >= 16 ? 2 : 0) | ((fa & 4) + (fb & 4) + (fc & 4) >= 8 ? 4 : 0) | (off ? 16 : 0) | (land === 3 ? 32 : 0);
        tc[t] = triHash(i * 2 + (t & 1), j);
        t++;
      }
  return { G, vx, vy, vz, tri, NT: t, cl, cw, vl, vw, tf, tc };
}
const css = (a, t) => `rgb(${a[t * 3]},${a[t * 3 + 1]},${a[t * 3 + 2]})`;
// запасная отрисовка без WebGL (2D-холст)
export class Terrain {
  constructor(M, T = buildTerrain(M)) {
    this.M = M; Object.assign(this, T);
    this.landPath = polyPath([...M.land, ...M.lakes]);
    this.coast = polyPath(M.land);
  }
  *trisIn(x0, y0, x1, y1) {
    const G = this.G, i0 = clamp(Math.floor(x0 / G.step), 0, G.nx - 2), i1 = clamp(Math.ceil(x1 / G.step) + 2, 0, G.nx - 2);
    const j0 = clamp(Math.floor(y0 / G.dy), 0, G.ny - 2), j1 = clamp(Math.ceil(y1 / G.dy) + 2, 0, G.ny - 2);
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) { const t = (j * (G.nx - 1) + i) * 2; yield t; yield t + 1; }
  }
  draw(ctx, x0, y0, sc, wpx, hpx) {
    const x1 = x0 + wpx / sc, y1 = y0 + hpx / sc, { vx, vy, tri } = this;
    ctx.save();
    ctx.setTransform(sc, 0, 0, sc, -x0 * sc, -y0 * sc);
    const face = (t, col) => {
      const a = tri[t * 3], b = tri[t * 3 + 1], c = tri[t * 3 + 2];
      ctx.fillStyle = col; ctx.strokeStyle = col;
      ctx.beginPath(); ctx.moveTo(vx[a], vy[a]); ctx.lineTo(vx[b], vy[b]); ctx.lineTo(vx[c], vy[c]); ctx.closePath();
      ctx.fill(); ctx.stroke();
    };
    ctx.lineWidth = 1.2 / sc; ctx.lineJoin = 'round';
    for (const t of this.trisIn(x0, y0, x1, y1)) if (!(this.tf[t] & 32)) face(t, css(this.cw, t));
    ctx.lineWidth = 5.5 / sc; ctx.strokeStyle = 'rgba(214,234,236,0.4)'; ctx.stroke(this.coast);
    ctx.save();
    ctx.clip(this.landPath, 'evenodd');
    ctx.lineWidth = 1.2 / sc;
    for (const t of this.trisIn(x0, y0, x1, y1)) if (this.tf[t] & 1) face(t, css(this.cl, t));
    ctx.restore();
    ctx.lineWidth = 1 / sc; ctx.strokeStyle = 'rgba(70,104,124,0.8)'; ctx.stroke(this.landPath);
    ctx.restore();
  }
}
