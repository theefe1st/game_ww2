// «Мировой фронт» v0.11, «Восточный фронт»: отрисовка карты на WebGL — рельеф с мягкой отмывкой (terrain.js),
// заливка областей по владельцам (текстура цветов), реки, железные дороги, берега, границы и линия фронта (полосы с
// выдавливанием в шейдере — толщина в CSS-пикселях при любом масштабе), сезонный покров (снег, распутица) по
// погодным полосам. Деревья — по желанию (настройка). Подписи и фишки рисует map.js поверх (2D).
import earcut from './earcut.js';
import { buildTerrain } from './terrain.js';
import { triHash } from './mesh.js';

const VS_TRI = `attribute vec2 p; attribute vec4 c; uniform vec2 o; uniform vec2 k; varying vec4 v;
void main(){ gl_Position = vec4((p - o) * k + vec2(-1.0, 1.0), 0.0, 1.0); v = c; }`;
const FS_TRI = `precision mediump float; varying vec4 v; uniform float a;
void main(){ gl_FragColor = vec4(v.rgb, v.a * a); }`;
const VS_REG = `attribute vec2 p; attribute float r; uniform vec2 o; uniform vec2 k; varying float vr;
void main(){ gl_Position = vec4((p - o) * k + vec2(-1.0, 1.0), 0.0, 1.0); vr = r; }`;
const FS_REG = `precision mediump float; varying float vr; uniform sampler2D t; uniform float n; uniform float a;
void main(){ vec4 c = texture2D(t, vec2((vr + 0.5) / n, 0.5)); gl_FragColor = vec4(c.rgb, c.a * a); }`;
const VS_LIN = `attribute vec2 p; attribute vec2 d; attribute float s; uniform vec2 o; uniform vec2 k; uniform float w; uniform float sc;
void main(){ vec2 q = p + d * s * w / sc; gl_Position = vec4((q - o) * k + vec2(-1.0, 1.0), 0.0, 1.0); }`;
const FS_COL = `precision mediump float; uniform vec4 col; void main(){ gl_FragColor = col; }`;
const VS_TREE = `attribute vec2 p; attribute vec2 q; attribute vec4 c; uniform vec2 o; uniform vec2 k; uniform float ts; varying vec4 v;
void main(){ gl_Position = vec4((p + q * ts - o) * k + vec2(-1.0, 1.0), 0.0, 1.0); v = c; }`;
// суша с сезонным покровом: W[z] = (снег, распутица, сырость) для погодной полосы вершины
const VS_LAND = `attribute vec2 p; attribute vec4 c; attribute float z; uniform vec2 o; uniform vec2 k; uniform vec3 W[5]; varying vec4 v;
void main(){ gl_Position = vec4((p - o) * k + vec2(-1.0, 1.0), 0.0, 1.0);
 vec3 w = W[int(z + 0.5)]; vec3 col = c.rgb; float l = dot(col, vec3(0.3333));
 col = mix(col, vec3(0.955, 0.962, 0.972) * clamp(l * 1.32, 0.74, 1.04), w.x);
 col = mix(col, vec3(0.66, 0.57, 0.42) * clamp(l * 1.25, 0.7, 1.08), w.y);
 col *= 1.0 - 0.09 * w.z; v = vec4(col, c.a); }`;
const VS_POS = `attribute vec2 p; uniform vec2 o; uniform vec2 k; void main(){ gl_Position = vec4((p - o) * k + vec2(-1.0, 1.0), 0.0, 1.0); }`;

function compile(gl, type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src); gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error('шейдер: ' + gl.getShaderInfoLog(s));
  return s;
}
function program(gl, vs, fs) {
  const p = gl.createProgram();
  gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, vs)); gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('программа: ' + gl.getProgramInfoLog(p));
  const P = { p, a: {}, u: {} };
  for (let i = 0, n = gl.getProgramParameter(p, gl.ACTIVE_ATTRIBUTES); i < n; i++) { const a = gl.getActiveAttrib(p, i); P.a[a.name] = gl.getAttribLocation(p, a.name); }
  for (let i = 0, n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS); i < n; i++) { const u = gl.getActiveUniform(p, i); P.u[u.name] = gl.getUniformLocation(p, u.name); }
  return P;
}
// полоса для ломаных: на вершину [x, y, nx·m, ny·m, ±k]; ломаные склеены вырожденными треугольниками (TRIANGLE_STRIP)
export function stripOf(polys) {
  let n = 0;
  for (const P of polys) n += (P.p.length / 2 + (P.closed ? 1 : 0)) * 2 + 2;
  const out = new Float32Array(n * 5);
  let o = 0;
  const put = (x, y, dx, dy, s) => { out[o++] = x; out[o++] = y; out[o++] = dx; out[o++] = dy; out[o++] = s; };
  for (const P of polys) {
    const p = P.p, m = p.length / 2, k = P.k || 1, cl = !!P.closed;
    if (m < 2) continue;
    const N = cl ? m + 1 : m;
    const pt = (i) => { i = cl ? ((i % m) + m) % m : Math.max(0, Math.min(m - 1, i)); return [p[i * 2], p[i * 2 + 1]]; };
    const start = o;
    for (let q = 0; q < N; q++) {
      const [x, y] = pt(q), [ax, ay] = cl || q > 0 ? pt(q - 1) : [x, y], [bx, by] = cl || q < m - 1 ? pt(q + 1) : [x, y];
      let t1x = x - ax, t1y = y - ay, t2x = bx - x, t2y = by - y;
      const l1 = Math.hypot(t1x, t1y), l2 = Math.hypot(t2x, t2y);
      if (l1 > 1e-9) (t1x /= l1), (t1y /= l1); else (t1x = t2x / (l2 || 1)), (t1y = t2y / (l2 || 1));
      if (l2 > 1e-9) (t2x /= l2), (t2y /= l2); else (t2x = t1x), (t2y = t1y);
      let tx = t1x + t2x, ty = t1y + t2y;
      const tl = Math.hypot(tx, ty);
      if (tl < 1e-6) (tx = t1x), (ty = t1y); else (tx /= tl), (ty /= tl);
      let nx = -ty, ny = tx;
      const cosv = nx * -t1y + ny * t1x, mit = Math.min(2.2, 1 / Math.max(0.3, Math.abs(cosv)));
      nx *= mit; ny *= mit;
      if (q === 0) put(x, y, nx, ny, k); // вырожденная склейка
      put(x, y, nx, ny, k); put(x, y, nx, ny, -k);
      if (q === N - 1) put(x, y, nx, ny, -k);
    }
    if (o === start) continue;
  }
  return out.subarray(0, o);
}
const ringOf = (M, ring) => {
  const pts = [];
  for (const k of ring) {
    const p = M.arcs[k < 0 ? ~k : k].p, n = p.length / 2;
    for (let q = 0; q < n; q++) { const i = k < 0 ? n - 1 - q : q; if (q === 0 && pts.length) continue; pts.push(p[i * 2], p[i * 2 + 1]); }
  }
  if (pts.length > 4 && pts[0] === pts[pts.length - 2] && pts[1] === pts[pts.length - 1]) pts.length -= 2;
  return pts;
};
const area2 = (p) => { let s = 0; for (let i = 0, n = p.length / 2, j = n - 1; i < n; j = i++) s += p[j * 2] * p[i * 2 + 1] - p[i * 2] * p[j * 2 + 1]; return s / 2; };
function inRing(p, x, y) {
  let c = false;
  for (let i = 0, n = p.length / 2, j = n - 1; i < n; j = i++) {
    const xi = p[i * 2], yi = p[i * 2 + 1], xj = p[j * 2], yj = p[j * 2 + 1];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}
// треугольники многоугольника из колец (внешние и дыры по вложенности)
export function triRings(rings) {
  const R = rings.map((p) => ({ p, a: Math.abs(area2(p)) })).filter((r) => r.p.length >= 6).sort((a, b) => b.a - a.a);
  const polys = [];
  for (const r of R) {
    let host = null, depth = 0;
    for (const q of R) { if (q === r) break; if (inRing(q.p, r.p[0], r.p[1])) (depth++, (host = q)); }
    if (depth % 2 === 1 && host && host.poly) host.poly.holes.push(r.p);
    else { r.poly = { outer: r.p, holes: [] }; polys.push(r.poly); }
  }
  const out = [];
  for (const P of polys) {
    const data = [...P.outer], holes = [];
    for (const h of P.holes) { holes.push(data.length / 2); for (const v of h) data.push(v); }
    const idx = earcut(data, holes.length ? holes : null);
    for (const i of idx) out.push(data[i * 2], data[i * 2 + 1]);
  }
  return out;
}

export class GLMap {
  constructor(canvas, M) {
    const gl = canvas.getContext('webgl', { antialias: true, stencil: true, alpha: false, premultipliedAlpha: false, preserveDrawingBuffer: false, powerPreference: 'high-performance' });
    if (!gl) throw new Error('нет WebGL');
    this.gl = gl; this.M = M; this.cv = canvas;
    this.regN = 512; this.regCol = new Uint8Array(this.regN * 4);
    this.season = new Float32Array(15);
    this.dyn = {}; this.en = [];
    this.lost = false;
    canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); this.lost = true; });
    canvas.addEventListener('webglcontextrestored', () => { this.lost = false; this.init(); this.onRestore?.(); });
    this.T = buildTerrain(M);
    this.init();
  }
  init() {
    const gl = this.gl;
    this.P = { tri: program(gl, VS_TRI, FS_TRI), reg: program(gl, VS_REG, FS_REG), lin: program(gl, VS_LIN, FS_COL), tree: program(gl, VS_TREE, FS_TRI), pos: program(gl, VS_POS, FS_COL), land: program(gl, VS_LAND, FS_TRI) };
    this.buildTerrain(); this.buildTrees(); this.buildLand(); this.buildRegions(); this.buildStaticLines();
    this.tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, this.regN, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, this.regCol);
    for (const k in this.dyn) this.setLines(k, this.dyn[k].polys, this.dyn[k].st);
  }
  buf(data) { const gl = this.gl, b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW); return b; }
  buildTerrain() {
    const { vx, vy, tri, NT, vl, vw, tf } = this.T;
    const pw = new Float32Array(NT * 6), cwv = new Uint8Array(NT * 12);
    let nl = 0;
    for (let t = 0; t < NT; t++) if (tf[t] & 1) nl++;
    const pl = new Float32Array(nl * 6), clv = new Uint8Array(nl * 12), zl = new Float32Array(nl * 3);
    const zv = this.zoneOfVert();
    let o = 0;
    for (let t = 0; t < NT; t++) {
      const land = tf[t] & 1;
      for (let q = 0; q < 3; q++) {
        const v = tri[t * 3 + q];
        pw[t * 6 + q * 2] = vx[v]; pw[t * 6 + q * 2 + 1] = vy[v];
        cwv.set([vw[v * 3], vw[v * 3 + 1], vw[v * 3 + 2], 255], t * 12 + q * 4);
        if (land) { pl[o * 6 + q * 2] = vx[v]; pl[o * 6 + q * 2 + 1] = vy[v]; clv.set([vl[v * 3], vl[v * 3 + 1], vl[v * 3 + 2], 255], o * 12 + q * 4); zl[o * 3 + q] = zv[v]; }
      }
      if (land) o++;
    }
    this.bW = { p: this.buf(pw), c: this.buf(cwv), n: NT * 3 };
    this.bL = { p: this.buf(pl), c: this.buf(clv), z: this.buf(zl), n: nl * 3 };
  }
  // погодная полоса вершины (0–4, по ближайшему центру области) — для сезонного покрова
  zoneOfVert() {
    const M = this.M, { vx, vy } = this.T, n = vx.length, out = new Float32Array(n), CS = 60;
    const gw = Math.ceil(M.w / CS) + 1, gh = Math.ceil(M.h / CS) + 1, cell = Array.from({ length: gw * gh }, () => []);
    for (const g of M.reg) { const i = Math.max(0, Math.min(gw - 1, Math.floor(g.x / CS))), j = Math.max(0, Math.min(gh - 1, Math.floor(g.y / CS))); cell[i + j * gw].push(g); }
    for (let v = 0; v < n; v++) {
      const ci = Math.floor(vx[v] / CS), cj = Math.floor(vy[v] / CS);
      let best = null, bd = 1e18;
      for (let rad = 1; rad <= 6 && !best; rad++)
        for (let j = cj - rad; j <= cj + rad; j++) for (let i = ci - rad; i <= ci + rad; i++) {
          if (i < 0 || j < 0 || i >= gw || j >= gh) continue;
          for (const g of cell[i + j * gw]) { const d = (g.x - vx[v]) ** 2 + (g.y - vy[v]) ** 2; if (d < bd) (bd = d), (best = g); }
        }
      out[v] = best ? best.z : 2;
    }
    return out;
  }
  buildTrees() {
    const { vx, vy, tri, NT, tf, tc } = this.T;
    const P = [], Q = [], C = [];
    const tree = (x, y, s, dark) => {
      const h = 1.35 * s, w = 0.55 * s, b = 0.25 * s, m = 0.12 * s;
      const L = dark ? [62, 98, 64, 235] : [78, 116, 74, 235], R = dark ? [92, 128, 82, 235] : [110, 146, 96, 235];
      for (const [qx, qy, c] of [[0, -h, L], [-w, b, L], [0, m, L], [0, -h, R], [w, b, R], [0, m, R]]) { P.push(x, y); Q.push(qx, qy); C.push(...c); }
    };
    const reed = (x, y) => {
      for (const d of [-0.8, 0, 0.8]) for (const [qx, qy] of [[d - 0.12, 0], [d + 0.12, 0], [d * 1.4, -1.5]]) { P.push(x, y); Q.push(qx, qy); C.push(70, 104, 78, 200); }
    };
    for (let t = 0; t < NT; t++) {
      const f = tf[t];
      if (!(f & 6) || f & 16 || !(f & 1)) continue;
      const h = tc[t], a = tri[t * 3], b = tri[t * 3 + 1], c = tri[t * 3 + 2];
      const n = f & 4 ? 1 : (h & 7) < 2 ? 1 : 2;
      for (let q = 0; q < n; q++) {
        const hq = triHash(h & 0xffff, q * 31 + 7);
        let u = (hq & 1023) / 1023, v = ((hq >>> 10) & 1023) / 1023;
        u + v > 1 && ((u = 1 - u), (v = 1 - v));
        u = 0.12 + u * 0.76; v = 0.12 + v * 0.76;
        const x = vx[a] + (vx[b] - vx[a]) * u + (vx[c] - vx[a]) * v, y = vy[a] + (vy[b] - vy[a]) * u + (vy[c] - vy[a]) * v;
        if (f & 4 && !(f & 2)) reed(x, y);
        else tree(x, y, 0.8 + ((hq >>> 20) & 15) / 40, (hq >>> 24) & 1);
      }
    }
    this.bTree = { p: this.buf(new Float32Array(P)), q: this.buf(new Float32Array(Q)), c: this.buf(new Uint8Array(C)), n: P.length / 2 };
  }
  // трафарет суши: «веер» треугольников из одной точки на каждое кольцо — с INVERT даёт правило «чёт-нечет»
  // без триангуляции (надёжно и для самопересекающихся колец; озёра — дыры)
  buildLand() {
    const M = this.M, tris = [];
    for (const r of [...M.land, ...M.lakes]) {
      const n = r.length / 2;
      if (n < 3) continue;
      const cx = r[0], cy = r[1];
      for (let i = 1; i < n; i++) { const j = (i + 1) % n; tris.push(cx, cy, r[i * 2], r[i * 2 + 1], r[j * 2], r[j * 2 + 1]); }
    }
    this.bLand = { p: this.buf(new Float32Array(tris)), n: tris.length / 2 };
  }
  buildRegions() {
    const M = this.M, P = [], Rr = [];
    const add = (rg, id) => {
      const t = triRings(rg.map((ring) => ringOf(M, ring)));
      for (let i = 0; i < t.length; i += 2) { P.push(t[i], t[i + 1]); Rr.push(id); }
    };
    M.reg.forEach((g, r) => add(g.rg, r));
    M.neut.forEach((g, k) => add(g.rg, M.R + k));
    this.bReg = { p: this.buf(new Float32Array(P)), r: this.buf(new Float32Array(Rr)), n: P.length / 2 };
  }
  buildStaticLines() {
    const M = this.M;
    const coast = M.land.map((p) => ({ p, closed: true })), lakes = M.lakes.map((p) => ({ p, closed: true }));
    this.bCoast = this.lineBuf(stripOf([...coast, ...lakes]));
    this.bRiv = this.lineBuf(stripOf(M.rivers.filter((r) => r.w === 2).map((r) => ({ p: r.p }))));
    this.bRiv1 = this.lineBuf(stripOf(M.rivers.filter((r) => r.w !== 2).map((r) => ({ p: r.p }))));
    this.bBord = this.lineBuf(stripOf(M.arcs.filter((A) => A.t === 0).map((A) => ({ p: A.p }))));
    this.bNeut = this.lineBuf(stripOf(M.arcs.filter((A) => A.t === 2 || A.t === 3).map((A) => ({ p: A.p }))));
    const rl = M.rails || [];
    this.bRail = this.lineBuf(stripOf(rl.filter((l) => l.k === 1).map((l) => ({ p: l.p }))));
    this.bRail0 = this.lineBuf(stripOf(rl.filter((l) => l.k !== 1).map((l) => ({ p: l.p }))));
  }
  lineBuf(data) { return { b: this.buf(data), n: data.length / 5 }; }
  // слой линий, перестраиваемый по ходу игры: polys — [{p, closed, k}], st — [{w, col: [r,g,b,a]}] (снизу вверх)
  setLines(key, polys, st) {
    const old = this.dyn[key];
    old?.buf && this.gl.deleteBuffer(old.buf.b);
    this.dyn[key] = { polys, st, buf: polys.length ? this.lineBuf(stripOf(polys)) : null };
  }
  // цвета областей: cols — Uint8Array(4 × N) (RGBA), индекс области = номер
  setRegionColors(cols) {
    this.regCol.set(cols.subarray(0, Math.min(cols.length, this.regCol.length)));
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, this.regN, 1, gl.RGBA, gl.UNSIGNED_BYTE, this.regCol);
  }
  resize(w, h, dpr) {
    const W = Math.round(w * dpr), H = Math.round(h * dpr);
    if (this.cv.width !== W || this.cv.height !== H) { this.cv.width = W; this.cv.height = H; }
    this.w = w; this.h = h; this.dpr = dpr;
  }
  use(P, view) {
    const gl = this.gl;
    gl.useProgram(P.p);
    gl.uniform2f(P.u.o, view.x0, view.y0);
    gl.uniform2f(P.u.k, (2 * view.sc) / this.w, (-2 * view.sc) / this.h);
    for (const l of this.en) gl.disableVertexAttribArray(l);
    this.en.length = 0;
  }
  attr(P, name, b, size, type, norm = false, stride = 0, off = 0) {
    const gl = this.gl, loc = P.a[name];
    if (loc === undefined || loc < 0) return;
    gl.bindBuffer(gl.ARRAY_BUFFER, b);
    gl.enableVertexAttribArray(loc); this.en.push(loc);
    gl.vertexAttribPointer(loc, size, type, norm, stride, off);
  }
  lines(view, L, w, col) {
    if (!L || !L.n) return;
    const gl = this.gl, P = this.P.lin;
    this.use(P, view);
    gl.uniform1f(P.u.w, w); gl.uniform1f(P.u.sc, view.sc); gl.uniform4f(P.u.col, col[0] / 255, col[1] / 255, col[2] / 255, col[3]);
    this.attr(P, 'p', L.b, 2, gl.FLOAT, false, 20, 0);
    this.attr(P, 'd', L.b, 2, gl.FLOAT, false, 20, 8);
    this.attr(P, 's', L.b, 1, gl.FLOAT, false, 20, 16);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, L.n);
  }
  // сезонный покров по погодным полосам: w — [[снег, распутица, сырость] × 5]
  setSeason(w) { for (let z = 0; z < 5; z++) for (let k = 0; k < 3; k++) this.season[z * 3 + k] = w[z]?.[k] ?? 0; }
  landFaces(view) {
    const gl = this.gl, P = this.P.land, B = this.bL;
    this.use(P, view);
    gl.uniform1f(P.u.a, 1);
    gl.uniform3fv(P.u['W[0]'] ?? P.u.W, this.season);
    this.attr(P, 'p', B.p, 2, gl.FLOAT);
    this.attr(P, 'c', B.c, 4, gl.UNSIGNED_BYTE, true);
    this.attr(P, 'z', B.z, 1, gl.FLOAT);
    gl.drawArrays(gl.TRIANGLES, 0, B.n);
  }
  faces(view, B, a = 1) {
    const gl = this.gl, P = this.P.tri;
    this.use(P, view);
    gl.uniform1f(P.u.a, a);
    this.attr(P, 'p', B.p, 2, gl.FLOAT);
    this.attr(P, 'c', B.c, 4, gl.UNSIGNED_BYTE, true);
    gl.drawArrays(gl.TRIANGLES, 0, B.n);
  }
  // view: {x0, y0 — км левого верхнего угла, sc — CSS px на км}; opt: {tint — прозрачность заливки, trees}
  draw(view, opt = {}) {
    if (this.lost) return;
    const gl = this.gl, sc = view.sc;
    gl.viewport(0, 0, this.cv.width, this.cv.height);
    gl.clearColor(0.64, 0.75, 0.8, 1); gl.clearStencil(0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.STENCIL_BUFFER_BIT);
    gl.disable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.disable(gl.STENCIL_TEST);
    this.faces(view, this.bW);
    // отмель
    this.lines(view, this.bCoast, 3.2 + Math.min(4, sc * 1.6), [222, 238, 238, 0.42]);
    this.lines(view, this.bCoast, 1.4 + Math.min(2, sc * 0.8), [232, 244, 242, 0.5]);
    // трафарет суши (чёт-нечет: озёра — дыры)
    gl.enable(gl.STENCIL_TEST);
    gl.colorMask(false, false, false, false);
    gl.stencilFunc(gl.ALWAYS, 0, 0xff); gl.stencilOp(gl.KEEP, gl.KEEP, gl.INVERT);
    { const P = this.P.pos; this.use(P, view); gl.uniform4f(P.u.col, 0, 0, 0, 0); this.attr(P, 'p', this.bLand.p, 2, gl.FLOAT); gl.drawArrays(gl.TRIANGLES, 0, this.bLand.n); }
    gl.colorMask(true, true, true, true);
    gl.stencilFunc(gl.NOTEQUAL, 0, 0xff); gl.stencilOp(gl.KEEP, gl.KEEP, gl.KEEP);
    this.landFaces(view);
    // деревья (по желанию; зимой — под снегом не видны)
    const ta = opt.trees ? Math.max(0, Math.min(1, (sc - 0.32) / 0.3)) : 0;
    if (ta > 0.02) {
      const P = this.P.tree, B = this.bTree;
      this.use(P, view);
      gl.uniform1f(P.u.a, ta); gl.uniform1f(P.u.ts, 4.6 * Math.pow(sc, -0.62));
      this.attr(P, 'p', B.p, 2, gl.FLOAT); this.attr(P, 'q', B.q, 2, gl.FLOAT); this.attr(P, 'c', B.c, 4, gl.UNSIGNED_BYTE, true);
      gl.drawArrays(gl.TRIANGLES, 0, B.n);
    }
    // заливка областей
    {
      const P = this.P.reg, B = this.bReg;
      this.use(P, view);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.tex);
      gl.uniform1i(P.u.t, 0); gl.uniform1f(P.u.n, this.regN); gl.uniform1f(P.u.a, opt.tint ?? 1);
      this.attr(P, 'p', B.p, 2, gl.FLOAT); this.attr(P, 'r', B.r, 1, gl.FLOAT);
      gl.drawArrays(gl.TRIANGLES, 0, B.n);
    }
    gl.disable(gl.STENCIL_TEST);
    // реки
    const rw = Math.min(2.4, Math.max(0.75, Math.sqrt(sc) * 1.2)), ra = Math.max(0, Math.min(1, (sc - 0.3) / 0.45));
    if (ra > 0.02) {
      this.lines(view, this.bRiv1, rw * 0.55 + 0.9, [236, 244, 240, 0.4 * ra]);
      this.lines(view, this.bRiv1, rw * 0.32, [92, 142, 180, ra]);
    }
    this.lines(view, this.bRiv, rw + 0.9, [236, 244, 240, 0.25 + 0.25 * ra]);
    this.lines(view, this.bRiv, rw * 0.55, [82, 136, 178, 1]);
    // железные дороги: магистрали и прочие (тёмно-оливковые, как на штабной карте)
    const la = Math.max(0, Math.min(1, (sc - 0.22) / 0.35)), lm = 0.45 + 0.55 * Math.max(0, Math.min(1, (sc - 0.12) / 0.3));
    if (la > 0.02) this.lines(view, this.bRail0, 0.55 + Math.min(1.1, sc * 0.42), [112, 114, 78, 0.75 * la]);
    this.lines(view, this.bRail, 0.8 + Math.min(1.6, sc * 0.62), [96, 98, 62, 0.85 * lm]);
    // берег
    this.lines(view, this.bCoast, 0.55, [84, 118, 136, 0.85]);
    // границы областей
    const ba = Math.max(0.12, Math.min(0.34, 0.12 + sc * 0.2));
    this.lines(view, this.bBord, 0.45, [60, 48, 36, ba]);
    this.lines(view, this.bNeut, 0.6, [80, 76, 70, 0.45]);
    for (const k of opt.layers || Object.keys(this.dyn)) {
      const D = this.dyn[k];
      if (!D?.buf) continue;
      for (const s of D.st) this.lines(view, D.buf, typeof s.w === 'function' ? s.w(sc) : s.w, s.col);
    }
  }
}
