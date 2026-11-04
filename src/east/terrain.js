// «Мировой фронт» v0.10, «Восточный фронт»: низкополигональная подложка — плоские грани по сетке рельефа (mesh.js),
// светлая «бумажная» палитра, освещение с северо-запада, вода по глубине, деревья в лесах, тростник на болотах.
// buildTerrain(M) считает вершины и цвета граней (общие для WebGL — gl.js — и запасной 2D-отрисовки — класс Terrain).
import { meshGrid, meshVert, meshTris, triHash } from './mesh.js';
import { polyPath } from './mapdata.js';

const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const L = (() => { const v = [-0.75, -0.95, 1.25], n = Math.hypot(...v); return v.map((x) => x / n); })();
const PAPER = [238, 231, 210], ROCK = [168, 156, 140], SNOW = [246, 246, 242];
// светлый тон суши: к «бумаге», мягче насыщенность
function pale(p, e) {
  const lum = (p[0] + p[1] + p[2]) / 3, k0 = clamp(0.34 + 0.26 * (1 - lum / 190), 0.3, 0.6);
  let r = p[0] * (1 - k0) + PAPER[0] * k0, g = p[1] * (1 - k0) + PAPER[1] * k0, b = p[2] * (1 - k0) + PAPER[2] * k0;
  const gr = (r + g + b) / 3;
  r = gr + (r - gr) * 0.92; g = gr + (g - gr) * 0.92; b = gr + (b - gr) * 0.92;
  if (e > 700) { const k = clamp((e - 700) / 1500, 0, 0.75); r += (ROCK[0] - r) * k; g += (ROCK[1] - g) * k; b += (ROCK[2] - b) * k; }
  if (e > 2300) { const k = clamp((e - 2300) / 900, 0, 1); r += (SNOW[0] - r) * k; g += (SNOW[1] - g) * k; b += (SNOW[2] - b) * k; }
  return [r, g, b];
}
export function buildTerrain(M) {
  const m = M.mesh, G = meshGrid(M.w, M.h, m.step);
  const NV = G.nx * G.ny;
  const vx = new Float32Array(NV), vy = new Float32Array(NV), vz = new Float32Array(NV), vc = new Float32Array(NV * 3);
  for (let j = 0; j < G.ny; j++)
    for (let i = 0; i < G.nx; i++) {
      const v = i + j * G.nx, [x, y] = meshVert(G, i, j), e = m.e[v];
      vx[v] = x; vy[v] = y;
      const a = Math.abs(e), noise = ((triHash(i * 7 + 3, j * 13 + 5) >>> 8) / 16777216 - 0.5) * (e > 0 ? 1.1 : 0.7);
      vz[v] = Math.sign(e) * (a * 0.0042 + Math.sqrt(a) * 0.028) + noise;
      const c = pale(m.pal[m.c[v]], e);
      vc[v * 3] = c[0]; vc[v * 3 + 1] = c[1]; vc[v * 3 + 2] = c[2];
    }
  const NT0 = (G.nx - 1) * (G.ny - 1) * 2;
  const tri = new Int32Array(NT0 * 3), cl = new Uint8Array(NT0 * 3), cw = new Uint8Array(NT0 * 3), tf = new Uint8Array(NT0), tc = new Uint32Array(NT0);
  let t = 0;
  for (let j = 0; j < G.ny - 1; j++)
    for (let i = 0; i < G.nx - 1; i++)
      for (const [a, b, c] of meshTris(G, i, j)) {
        tri[t * 3] = a; tri[t * 3 + 1] = b; tri[t * 3 + 2] = c;
        const ux = vx[b] - vx[a], uy = vy[b] - vy[a], uz = vz[b] - vz[a], wx = vx[c] - vx[a], wy = vy[c] - vy[a], wz = vz[c] - vz[a];
        let nx = uy * wz - uz * wy, ny = uz * wx - ux * wz, nz = ux * wy - uy * wx;
        nz < 0 && ((nx = -nx), (ny = -ny), (nz = -nz));
        const nl = Math.hypot(nx, ny, nz) || 1, dot = (nx * L[0] + ny * L[1] + nz * L[2]) / nl;
        const h = triHash(i * 2 + (t & 1), j), vr = 1 + ((h >>> 8) / 16777216 - 0.5) * 0.06;
        const sh = clamp(0.93 + (dot - L[2]) * 1.25, 0.66, 1.16) * vr;
        const fa = m.f[a], fb = m.f[b], fc = m.f[c];
        let r = 0, g = 0, bl = 0, k = 0;
        for (const v of [a, b, c]) if (m.f[v] & 1) { r += vc[v * 3]; g += vc[v * 3 + 1]; bl += vc[v * 3 + 2]; k++; }
        if (!k) for (const v of [a, b, c]) { r += vc[v * 3]; g += vc[v * 3 + 1]; bl += vc[v * 3 + 2]; k++; }
        r /= k; g /= k; bl /= k;
        const off = (fa & 16) + (fb & 16) + (fc & 16) >= 32;
        if (off) { const gr = (r + g + bl) / 3; r = gr * 0.75 + 214 * 0.25; g = gr * 0.75 + 210 * 0.25; bl = gr * 0.75 + 198 * 0.25; }
        cl[t * 3] = clamp(r * sh, 0, 255); cl[t * 3 + 1] = clamp(g * sh, 0, 255); cl[t * 3 + 2] = clamp(bl * sh, 0, 255);
        const dep = -Math.min(0, (m.e[a] + m.e[b] + m.e[c]) / 3), lake = (fa | fb | fc) & 2 && dep < 5;
        const tt = clamp(dep / 900, 0, 1), ws = clamp(0.95 + (dot - L[2]) * 0.5, 0.85, 1.08) * (1 + ((h >>> 3) % 100) / 2500);
        const wr = lake ? 156 : 174 - 42 * tt, wg = lake ? 194 : 204 - 42 * tt, wb = lake ? 208 : 214 - 28 * tt;
        cw[t * 3] = clamp(wr * ws, 0, 255); cw[t * 3 + 1] = clamp(wg * ws, 0, 255); cw[t * 3 + 2] = clamp(wb * ws, 0, 255);
        const land = (fa & 1) + (fb & 1) + (fc & 1);
        tf[t] = (land ? 1 : 0) | ((fa & 8) + (fb & 8) + (fc & 8) >= 16 ? 2 : 0) | ((fa & 4) + (fb & 4) + (fc & 4) >= 8 ? 4 : 0) | (off ? 16 : 0) | (land === 3 ? 32 : 0);
        tc[t] = h;
        t++;
      }
  return { G, vx, vy, vz, tri, NT: t, cl, cw, tf, tc };
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
