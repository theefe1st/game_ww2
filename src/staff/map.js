// «Сталинград 1942–1943» (v0.7): штабная карта на холсте. Территория двумя цветами со сглаженной белой линией фронта
// (изолиния поля владения по скрытой гекс-сетке), затемнённый котёл, реки (лёд после ледостава), железные дороги,
// город, населённые пункты; фишки дивизий и жетоны штабов; уровни «Дивизии» / «Армии» (меняются и при зуме);
// подсветка целей, маршруты и стрелки приказов, «призраки» разведки, анимация марша, боёв, захватов и гибели частей.
import { R, HW, makeGrid, cellAt, nbOf } from './geo.js';
import { ICE, TYPES, catOf } from './rules.js';
import { HIGH } from './scenario.js';
import { counter, hqToken, CW, CH, FONT, clearSprites } from './sprites.js';
import { cv } from './engine.js';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const ease = (p) => (p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2);
export const Z_DIV = 2.1; // с этого зума — уровень «Дивизии»
export const Z_DIV0 = 3.4; // зум кнопки «Дивизии»
const COL = { sov: '#c48970', ax: '#5a493e', pk: '#45372e', out: '#211c19', front: '#fbfaf7', river: '#8fc3db', riverE: '#5d9bc2', ice: '#d3e4ea', iceE: '#9db7c1' };
// раскладка фишек в клетке (доли размера фишки)
const SLOTS = [
  [[0, 0]],
  [[-0.3, -0.16], [0.3, 0.16]],
  [[-0.34, -0.3], [0.34, -0.3], [0, 0.32]],
  [[-0.34, -0.32], [0.34, -0.32], [-0.34, 0.32], [0.34, 0.32]],
  [[-0.4, -0.34], [0.4, -0.34], [0, 0], [-0.4, 0.34], [0.4, 0.34]],
  [[-0.5, -0.32], [0, -0.32], [0.5, -0.32], [-0.5, 0.32], [0, 0.32], [0.5, 0.32]],
];
const slot = (n, i) => (n <= SLOTS.length ? SLOTS[n - 1][i] : [((i % 3) - 1) * 0.5, (Math.floor(i / 3) - (Math.ceil(n / 3) - 1) / 2) * 0.62]);

export class StaffMap {
  constructor(cv, D, o = {}) {
    this.cv = cv;
    this.ctx = cv.getContext('2d');
    this.D = D;
    this.o = o;
    this.G = makeGrid(D.cols, D.rows);
    this.w = D.w;
    this.h = D.h;
    this.cx = D.w / 2;
    this.cy = D.h / 2;
    this.z = 1.2;
    this.inset = { l: 0, t: 0, r: 0, b: 0 };
    this.ptr = new Map();
    this.an = new Map();
    this.fx = [];
    this.hl = null;
    this.lines = [];
    this.marks = [];
    this.sel = null;
    this.selF = null;
    this.focus = -1;
    this.hit = [];
    this.dirty = 1;
    this.lod = 'army';
    this.side = null;
    this.prepStatic();
    this.bind();
    this.resize();
    this.fitAll(0);
    let last = performance.now();
    const loop = (t) => {
      if (this.dead) return;
      const dt = Math.min(100, t - last);
      last = t;
      if (!this.paused) this.frame(t, dt);
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
    const fl = document.fonts;
    if (fl && fl.load)
      Promise.all([fl.load(FONT(12, 700)), fl.load(FONT(12, 800)), fl.load(FONT(12, 600))])
        .then(() => (clearSprites(), (this.dirty = 1)))
        .catch(() => {});
  }
  destroy() {
    this.dead = 1;
    cancelAnimationFrame(this.raf);
    const c = this.cv, h = this.hd;
    for (const k of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel']) c.removeEventListener(k, h[k]);
    c.removeEventListener('wheel', h.wheel);
    c.removeEventListener('touchend', h.touchend);
    window.removeEventListener('resize', h.resize);
  }
  pause(p) {
    this.paused = p;
    if (!p) this.resize();
  }
  // ——— статические слои: реки, дороги, город; веса поля владения ———
  prepStatic() {
    const D = this.D, G = this.G;
    const poly = (flat) => {
      const P = new Path2D();
      for (let k = 0; k < flat.length; k += 2) k ? P.lineTo(flat[k], flat[k + 1]) : P.moveTo(flat[k], flat[k + 1]);
      return P;
    };
    this.rivers = [0, 1, 2, 3].map(() => new Path2D());
    for (const r of D.rivers) this.rivers[r.w].addPath(poly(r.p));
    this.rails = new Path2D();
    for (const r of D.rails) this.rails.addPath(poly(r));
    this.city = new Path2D();
    const st = D.city.strip;
    st.forEach((p, i) => (i ? this.city.lineTo(p[0], p[1]) : this.city.moveTo(p[0], p[1])));
    this.city.closePath();
    this.towns = D.towns.slice().sort((a, b) => b.t - a.t);
    // поле: выборка с шагом 2 пикс. карты, по 7 клеток с гауссовыми весами
    const s = 2, x0 = -12, y0 = -12, nx = Math.ceil((D.w + 24) / s) + 1, ny = Math.ceil((D.h + 24) / s) + 1, K = 7;
    const idx = new Int16Array(nx * ny * K).fill(-1), wt = new Float32Array(nx * ny * K), s2 = 2 * 7 * 7;
    let mx = 0, my = 0;
    for (let i = 0; i < G.n; i++) (mx = Math.max(mx, G.cx[i])), (my = Math.max(my, G.cy[i]));
    for (let j = 1; j < ny - 1; j++)
      for (let i = 1; i < nx - 1; i++) {
        const x = x0 + i * s, y = y0 + j * s, c = cellAt(G, clamp(x, 0, mx), clamp(y, 0, my));
        if (c < 0) continue;
        const L = [c, ...nbOf(G, c)], p = (j * nx + i) * K;
        let sum = 0;
        for (let q = 0; q < L.length; q++) {
          const dx = G.cx[L[q]] - x, dy = G.cy[L[q]] - y, w = Math.exp(-(dx * dx + dy * dy) / s2);
          idx[p + q] = L[q];
          wt[p + q] = w;
          sum += w;
        }
        for (let q = 0; q < L.length; q++) wt[p + q] /= sum;
      }
    this.fld = { s, x0, y0, nx, ny, K, idx, wt, F: new Float32Array(nx * ny) };
  }
  // изолинии поля (уровень 0.5) → замкнутые сглаженные контуры
  contour(val) {
    const { s, x0, y0, nx, ny, K, idx, wt, F } = this.fld;
    for (let p = 0, n = nx * ny; p < n; p++) {
      let v = 0;
      const b = p * K;
      for (let q = 0; q < K; q++) {
        const c = idx[b + q];
        if (c < 0) break;
        v += wt[b + q] * val[c];
      }
      F[p] = v;
    }
    const T = 0.5, E = nx * ny * 2, n1 = new Int32Array(E).fill(-1), n2 = new Int32Array(E).fill(-1);
    const link = (a, b) => {
      n1[a] < 0 ? (n1[a] = b) : (n2[a] = b);
      n1[b] < 0 ? (n1[b] = a) : (n2[b] = a);
    };
    for (let j = 0; j < ny - 1; j++)
      for (let i = 0; i < nx - 1; i++) {
        const p = j * nx + i, a = F[p], b = F[p + 1], c = F[p + nx + 1], d = F[p + nx];
        const k = (a > T ? 8 : 0) | (b > T ? 4 : 0) | (c > T ? 2 : 0) | (d > T ? 1 : 0);
        if (k === 0 || k === 15) continue;
        const eT = p * 2, eB = (p + nx) * 2, eL = p * 2 + 1, eR = (p + 1) * 2 + 1;
        const mid = (a + b + c + d) / 4 > T;
        switch (k) {
          case 1: case 14: link(eL, eB); break;
          case 2: case 13: link(eB, eR); break;
          case 3: case 12: link(eL, eR); break;
          case 4: case 11: link(eT, eR); break;
          case 6: case 9: link(eT, eB); break;
          case 7: case 8: link(eL, eT); break;
          case 5: mid ? (link(eL, eT), link(eB, eR)) : (link(eT, eR), link(eL, eB)); break;
          case 10: mid ? (link(eT, eR), link(eL, eB)) : (link(eL, eT), link(eB, eR)); break;
        }
      }
    const pt = (e) => {
      const p = e >> 1, i = p % nx, j = (p / nx) | 0;
      if (e & 1) {
        const f1 = F[p], f2 = F[p + nx], u = (T - f1) / (f2 - f1 || 1e-9);
        return [x0 + i * s, y0 + (j + u) * s];
      }
      const f1 = F[p], f2 = F[p + 1], u = (T - f1) / (f2 - f1 || 1e-9);
      return [x0 + (i + u) * s, y0 + j * s];
    };
    const seen = new Uint8Array(E), loops = [];
    for (let e = 0; e < E; e++) {
      if (n1[e] < 0 || seen[e]) continue;
      const L = [];
      let cur = e, prev = -1;
      while (cur >= 0 && !seen[cur]) {
        seen[cur] = 1;
        L.push(pt(cur));
        const nx1 = n1[cur] !== prev ? n1[cur] : n2[cur];
        prev = cur;
        cur = nx1;
      }
      if (L.length > 2) loops.push(L);
    }
    const P = new Path2D();
    for (const L0 of loops) {
      const L = L0.length > 6 ? chaikin1(L0) : L0;
      P.moveTo(L[0][0], L[0][1]);
      for (let q = 1; q < L.length; q++) P.lineTo(L[q][0], L[q][1]);
      P.closePath();
    }
    return P;
  }
  // владение и котёл изменились → пересчитать заливку и линию фронта
  terrain() {
    const S = this.S, n = this.G.n, ax = new Float32Array(n), pk = new Float32Array(n);
    for (let c = 0; c < n; c++) ax[c] = S.own[c] === 2 ? 1 : 0;
    let any = 0;
    for (const C of S.pkComps || [])
      if (C.units && C.units.length)
        for (const c of C.cells) if (S.own[c] === 2) (pk[c] = 1), (any = 1);
    this.axP = this.contour(ax);
    this.pkP = any ? this.contour(pk) : null;
    this.ownK = this.ownKey();
  }
  ownKey() {
    const S = this.S;
    let h = 0;
    for (let c = 0; c < S.own.length; c++) h = (h * 31 + S.own[c] * (c + 7)) | 0;
    for (const C of S.pkComps || []) if (C.units && C.units.length) h = (h * 17 + C.cells.length * 131 + C.units.length) | 0;
    return h;
  }
  setState(S, side) {
    this.S = S;
    this.side = side;
    this.an.clear();
    this.fx = [];
    this.terrain();
    this.dirty = 1;
  }
  // после такта: владение, позиции частей
  update() {
    if (!this.S) return;
    const k = this.ownKey();
    if (k !== this.ownK) {
      const now = performance.now();
      if (!this.tT || now - this.tT > 120) (this.terrain(), (this.tT = now), (this.tPend = 0));
      else this.tPend = 1;
    }
    this.dirty = 1;
  }
  // ——— ввод ———
  bind() {
    const c = this.cv;
    c.style.touchAction = 'none';
    const pt = (e) => {
      const r = c.getBoundingClientRect();
      return [e.clientX - r.left, e.clientY - r.top];
    };
    const pinch = () => {
      const [a, b] = [...this.ptr.values()];
      return { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 };
    };
    this.hd = {
      pointerdown: (e) => {
        try {
          c.setPointerCapture(e.pointerId);
        } catch {}
        const [x, y] = pt(e);
        this.ptr.set(e.pointerId, { x, y });
        this.cam = null;
        this.moved = this.ptr.size > 1 ? 99 : 0;
        this.pz = this.ptr.size === 2 ? pinch() : null;
      },
      pointermove: (e) => {
        const p = this.ptr.get(e.pointerId);
        if (!p) return;
        const [x, y] = pt(e), dx = x - p.x, dy = y - p.y;
        p.x = x;
        p.y = y;
        if (this.ptr.size === 1) {
          this.moved += Math.abs(dx) + Math.abs(dy);
          if (this.moved > 7) (this.cx -= dx / this.z), (this.cy -= dy / this.z), this.clamp();
        } else if (this.ptr.size === 2) {
          const q = pinch();
          if (this.pz) {
            this.zoomAt(q.mx, q.my, q.d / this.pz.d);
            this.cx -= (q.mx - this.pz.mx) / this.z;
            this.cy -= (q.my - this.pz.my) / this.z;
            this.clamp();
          }
          this.pz = q;
        }
      },
      pointerup: (e) => {
        const p = this.ptr.get(e.pointerId);
        this.ptr.delete(e.pointerId);
        if (p && e.type === 'pointerup' && this.ptr.size === 0 && this.moved <= 7) this.tap(p.x, p.y);
        this.pz = this.ptr.size === 2 ? pinch() : null;
      },
      wheel: (e) => {
        e.preventDefault();
        this.cam = null;
        const [x, y] = pt(e);
        this.zoomAt(x, y, Math.exp(-clamp(e.deltaY, -120, 120) * 0.0022));
      },
      resize: () => this.resize(),
      // касание не должно порождать «призрачный» click по панели, открывшейся под пальцем
      touchend: (e) => e.cancelable && e.preventDefault(),
    };
    this.hd.pointercancel = this.hd.pointerup;
    for (const k of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel']) c.addEventListener(k, this.hd[k]);
    c.addEventListener('wheel', this.hd.wheel, { passive: false });
    c.addEventListener('touchend', this.hd.touchend, { passive: false });
    window.addEventListener('resize', this.hd.resize);
  }
  hitAt(sx, sy) {
    for (let q = this.hit.length - 1; q >= 0; q--) {
      const b = this.hit[q], m = b[6] || 0;
      if (sx >= b[0] - m && sx <= b[2] + m && sy >= b[1] - m && sy <= b[3] + m) return { k: b[4], id: b[5] };
    }
    return null;
  }
  cellAtScr(sx, sy) {
    const [mx, my] = this.toMap(sx, sy);
    return cellAt(this.G, mx, my);
  }
  tap(x, y) {
    const h = this.hitAt(x, y), c = this.cellAtScr(x, y);
    this.o.onTap?.(h, c, x, y);
  }
  // ——— камера ———
  resize() {
    const r = this.cv.getBoundingClientRect();
    this.W = Math.max(1, r.width);
    this.H = Math.max(1, r.height);
    this.dpr = Math.min(3, window.devicePixelRatio || 1);
    this.cv.width = Math.round(this.W * this.dpr);
    this.cv.height = Math.round(this.H * this.dpr);
    this.clamp();
    this.dirty = 1;
  }
  setInset(l, t, r, b) {
    const o = this.inset;
    if (o.l === l && o.t === t && o.r === r && o.b === b) return;
    this.inset = { l, t, r, b };
    this.clamp();
  }
  free() {
    const { l, t, r, b } = this.inset;
    const fw = Math.max(80, this.W - l - r), fh = Math.max(80, this.H - t - b);
    return { fw, fh, vx: l + fw / 2, vy: t + fh / 2 };
  }
  minZ() {
    const { fw, fh } = this.free();
    return Math.min(fw / this.w, fh / this.h) * 0.98;
  }
  // масштаб «без пустых полей»: карта закрывает всю свободную область
  coverZ() {
    const { fw, fh } = this.free();
    return Math.max(fw / this.w, fh / this.h);
  }
  toScr(x, y) {
    const { vx, vy } = this.free();
    return [vx + (x - this.cx) * this.z, vy + (y - this.cy) * this.z];
  }
  toMap(sx, sy) {
    const { vx, vy } = this.free();
    return [this.cx + (sx - vx) / this.z, this.cy + (sy - vy) / this.z];
  }
  zoomAt(sx, sy, f) {
    const [mx, my] = this.toMap(sx, sy), { vx, vy } = this.free();
    this.z = clamp(this.z * f, this.minZ(), 7);
    this.cx = mx - (sx - vx) / this.z;
    this.cy = my - (sy - vy) / this.z;
    this.clamp();
  }
  zoomBy(f) {
    const { vx, vy } = this.free();
    this.cam = null;
    this.zoomAt(vx, vy, f);
  }
  clamp() {
    const { fw, fh } = this.free();
    this.z = clamp(this.z, this.minZ(), 7);
    const hw = fw / 2 / this.z, hh = fh / 2 / this.z, m = 24 / this.z;
    this.cx = this.w + 2 * m <= 2 * hw ? this.w / 2 : clamp(this.cx, hw - m, this.w - hw + m);
    this.cy = this.h + 2 * m <= 2 * hh ? this.h / 2 : clamp(this.cy, hh - m, this.h - hh + m);
    this.dirty = 1;
  }
  flyTo(to, ms = 380) {
    const t = { cx: to.cx ?? this.cx, cy: to.cy ?? this.cy, z: clamp(to.z ?? this.z, this.minZ(), 7) };
    if (!ms) return Object.assign(this, t), this.clamp();
    this.cam = { from: { cx: this.cx, cy: this.cy, z: this.z }, to: t, t0: performance.now(), ms };
  }
  fitAll(ms = 380) {
    this.flyTo({ cx: this.w / 2, cy: this.h / 2, z: this.minZ() }, ms);
  }
  // показать клетку (если у края или за пределами видимой области)
  reveal(c, z = null, ms = 380, force = false) {
    if (c == null || c < 0) return;
    const x = this.G.cx[c], y = this.G.cy[c], [sx, sy] = this.toScr(x, y), { l, t, r, b } = this.inset, m = 56;
    if (!force && z == null && sx > l + m && sx < this.W - r - m && sy > t + m && sy < this.H - b - m) return;
    this.flyTo({ cx: x, cy: y, z: z ?? this.z }, ms);
  }
  setLod(l, ms = 420) {
    const { vx, vy } = this.free(), [mx, my] = this.toMap(vx, vy);
    if (l === 'army') this.flyTo({ cx: mx, cy: my, z: Math.min(this.minZ() * 1.25, Z_DIV * 0.8) }, ms);
    else {
      // к выбранной дивизии, иначе — к штабу выбранной армии, иначе — в центр экрана
      const S = this.S, G = this.G;
      let c = this.sel != null ? S?.uById.get(this.sel)?.c ?? -1 : -1;
      const F = c < 0 && this.selF ? S?.forms[this.selF] : null;
      if (F && (!this.side || F.side === this.side)) {
        // своя армия/корпус: штаб и все её дивизии в видимой части экрана
        const L = [F.hq, ...S.units.filter((u) => !u.dead && u.form === F.id).map((u) => u.c)].filter((q) => q >= 0);
        let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
        for (const q of L) (x0 = Math.min(x0, G.cx[q])), (x1 = Math.max(x1, G.cx[q])), (y0 = Math.min(y0, G.cy[q])), (y1 = Math.max(y1, G.cy[q]));
        const { fw, fh } = this.free(), z = clamp(Math.min((fw - 90) / Math.max(1, x1 - x0), (fh - 90) / Math.max(1, y1 - y0)), Z_DIV * 1.05, Z_DIV0);
        return this.flyTo({ cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, z }, ms);
      }
      if (c < 0 && F) c = F.hq;
      this.flyTo(c >= 0 ? { cx: G.cx[c], cy: G.cy[c], z: Z_DIV0 } : { cx: mx, cy: my, z: Z_DIV0 }, ms);
    }
  }
  // ——— эффекты ———
  addFx(e) {
    e.t0 = performance.now();
    this.fx.push(e);
    if (this.fx.length > 60) this.fx.splice(0, this.fx.length - 60);
    this.dirty = 1;
  }
  // ——— кадр ———
  frame(now, dt) {
    if (this.cam) {
      const { from, to, t0, ms } = this.cam, p = clamp((now - t0) / ms, 0, 1), e = ease(p);
      this.z = from.z + (to.z - from.z) * e;
      this.cx = from.cx + (to.cx - from.cx) * e;
      this.cy = from.cy + (to.cy - from.cy) * e;
      this.clamp();
      if (p >= 1) this.cam = null;
    }
    if (this.tPend && now - this.tT > 120) (this.terrain(), (this.tT = now), (this.tPend = 0), (this.dirty = 1));
    const lod = this.z >= Z_DIV ? 'div' : 'army';
    if (lod !== this.lod) (this.lod = lod), this.o.onLod?.(lod), (this.dirty = 1);
    if (this.anim || this.fx.length) this.dirty = 1;
    if (!this.dirty || !this.S) return;
    this.dirty = 0;
    this.draw(now, dt);
  }
  hexPath(x, c) {
    const X = this.G.cx[c], Y = this.G.cy[c];
    for (let k = 0; k < 6; k++) {
      const a = Math.PI / 6 + (k * Math.PI) / 3;
      k ? x.lineTo(X + Math.cos(a) * R, Y + Math.sin(a) * R) : x.moveTo(X + Math.cos(a) * R, Y + Math.sin(a) * R);
    }
    x.closePath();
  }
  draw(now, dt) {
    const x = this.ctx, d = this.dpr, z = this.z, S = this.S, D = this.D, G = this.G;
    const { vx, vy } = this.free(), ox = vx - this.cx * z, oy = vy - this.cy * z;
    x.setTransform(d, 0, 0, d, 0, 0);
    x.fillStyle = COL.out;
    x.fillRect(0, 0, this.W, this.H);
    // —— слой карты (в координатах карты) ——
    x.setTransform(d * z, 0, 0, d * z, d * ox, d * oy);
    x.save();
    x.beginPath();
    x.rect(0, 0, D.w, D.h);
    x.clip();
    x.fillStyle = COL.sov;
    x.fillRect(0, 0, D.w, D.h);
    if (this.axP) (x.fillStyle = COL.ax), x.fill(this.axP, 'evenodd');
    if (this.pkP) (x.fillStyle = COL.pk), x.fill(this.pkP, 'evenodd');
    x.fillStyle = 'rgba(70,64,60,.42)';
    x.fill(this.city);
    // подсветка клеток
    if (this.grid >= 0) {
      x.beginPath();
      for (let c = 0; c < G.n; c++) {
        const dx = G.cx[c] - G.cx[this.grid], dy = G.cy[c] - G.cy[this.grid];
        if (dx * dx + dy * dy < 90 * 90) this.hexPath(x, c);
      }
      x.strokeStyle = 'rgba(255,255,255,.16)';
      x.lineWidth = 1 / z;
      x.stroke();
    }
    if (this.hl)
      for (const [c, col] of this.hl) {
        x.beginPath();
        this.hexPath(x, c);
        x.fillStyle = col + '44';
        x.fill();
        x.strokeStyle = col + 'cc';
        x.lineWidth = 1.6 / z;
        x.stroke();
      }
    // реки
    const t = S.t;
    for (let w = 0; w <= 3; w++) {
      const frozen = w === 3 ? t >= ICE.volga : t >= ICE.donAll;
      const lw = [0.8, 1.1, 2.1, 4.4][w];
      x.lineCap = 'round';
      x.lineJoin = 'round';
      x.strokeStyle = frozen ? COL.iceE : COL.riverE;
      x.lineWidth = lw + 1.4 / z;
      x.stroke(this.rivers[w]);
      x.strokeStyle = frozen ? COL.ice : COL.river;
      x.lineWidth = lw;
      x.stroke(this.rivers[w]);
    }
    // железные дороги
    x.strokeStyle = 'rgba(48,36,30,.55)';
    x.lineWidth = 2.6 / z;
    x.stroke(this.rails);
    x.setLineDash([4 / z, 3.4 / z]);
    x.strokeStyle = 'rgba(244,236,228,.85)';
    x.lineWidth = 1.2 / z;
    x.stroke(this.rails);
    x.setLineDash([]);
    // линия фронта
    if (this.axP) {
      x.strokeStyle = 'rgba(30,18,12,.35)';
      x.lineWidth = 4.6 / z;
      x.stroke(this.axP);
      x.strokeStyle = COL.front;
      x.lineWidth = 2.3 / z;
      x.stroke(this.axP);
    }
    x.restore();
    // —— экранный слой ——
    x.setTransform(d, 0, 0, d, 0, 0);
    this.drawTowns(x);
    this.drawLines(x);
    this.hit = [];
    this.drawUnits(x, now, dt);
    this.drawHQ(x);
    this.drawMarks(x);
    this.drawFx(x, now);
  }
  scr(c) {
    return this.toScr(this.G.cx[c], this.G.cy[c]);
  }
  drawTowns(x) {
    const z = this.z, S = this.S;
    x.textBaseline = 'middle';
    x.textAlign = 'left';
    x.lineJoin = 'round';
    for (const tw of this.towns) {
      if (tw.t === 3 && z < 2.9) continue;
      if (tw.t === 2 && z < 1.45 && !tw.vp) continue;
      const [sx, sy] = this.toScr(tw.x, tw.y);
      if (sx < -80 || sy < -20 || sx > this.W + 20 || sy > this.H + 20) continue;
      const r = tw.t === 1 ? 3.2 : tw.t === 2 ? 2.5 : 1.9, dark = S.own[tw.c] === 2;
      x.beginPath();
      x.arc(sx, sy, r, 0, Math.PI * 2);
      x.fillStyle = dark ? '#ece2d8' : '#1d1a18';
      x.fill();
      const fs = tw.big ? (z > 2.6 ? 19 : 15) : tw.t === 1 ? 13 : tw.t === 2 ? 11.5 : 10.5;
      x.font = FONT(fs, tw.t === 1 ? 700 : 600);
      x.lineWidth = 3;
      x.strokeStyle = dark ? 'rgba(30,20,14,.55)' : 'rgba(250,238,228,.6)';
      x.strokeText(tw.n, sx + r + 3, sy);
      x.fillStyle = dark ? '#efe6dc' : '#33261f';
      x.fillText(tw.n, sx + r + 3, sy);
    }
  }
  // линии приказов: {pts: [клетки], col, dash, arrow}
  drawLines(x) {
    for (const L of this.lines) {
      if (!L.pts || L.pts.length < 2) continue;
      const P = L.pts.map((c) => this.scr(c));
      if (L.from) P[0] = L.from;
      x.lineCap = 'round';
      x.lineJoin = 'round';
      x.beginPath();
      P.forEach((p, i) => (i ? x.lineTo(p[0], p[1]) : x.moveTo(p[0], p[1])));
      x.strokeStyle = 'rgba(0,0,0,.45)';
      x.lineWidth = 5;
      x.setLineDash(L.dash ? [8, 6] : []);
      x.stroke();
      x.strokeStyle = L.col;
      x.lineWidth = 2.6;
      x.stroke();
      x.setLineDash([]);
      if (L.arrow) {
        const [ax, ay] = P[P.length - 1], [bx, by] = P[P.length - 2], a = Math.atan2(ay - by, ax - bx), s = 10;
        x.beginPath();
        x.moveTo(ax, ay);
        x.lineTo(ax - Math.cos(a - 0.45) * s, ay - Math.sin(a - 0.45) * s);
        x.lineTo(ax - Math.cos(a + 0.45) * s, ay - Math.sin(a + 0.45) * s);
        x.closePath();
        x.fillStyle = L.col;
        x.fill();
        x.strokeStyle = 'rgba(0,0,0,.6)';
        x.lineWidth = 1.2;
        x.stroke();
      }
    }
  }
  // какие части видит игрок и где
  visibleUnits() {
    const S = this.S, side = this.side, fog = side && S.fog, out = [];
    for (const u of S.units) {
      if (u.dead) continue;
      if (fog && u.side !== side) {
        if (u.sn == null) continue;
        if (u.sn === S.t) out.push({ u, c: u.c, g: 0, q: u.sna === 3 });
        else if (S.t - u.sn <= 36 && S.vis[u.snc] < 2) out.push({ u, c: u.snc, g: 1, q: u.sna === 3 });
      } else out.push({ u, c: u.c, g: 0, q: 0 });
    }
    return out;
  }
  drawUnits(x, now, dt) {
    const S = this.S, z = this.z, G = this.G, div = this.lod === 'div';
    const k = clamp(z / Z_DIV0, 0.62, 1.15), kq = k <= 0.7 ? 0.7 : k <= 0.85 ? 0.85 : k <= 1 ? 1 : 1.15;
    const L = this.visibleUnits(), by = new Map();
    for (const e of L) {
      let g = by.get(e.c);
      g || by.set(e.c, (g = []));
      g.push(e);
    }
    const f = 1 - Math.exp(-(dt || 16) / 110);
    let moving = 0;
    const items = [];
    for (const [c, g] of by) {
      g.sort((a, b) => b.u.sz - a.u.sz || a.u.id - b.u.id);
      g.forEach((e, i) => {
        const [sx0, sy0] = slot(g.length, i), tx = G.cx[c], ty = G.cy[c];
        let a = this.an.get(e.u.id);
        if (!a) this.an.set(e.u.id, (a = { x: tx, y: ty, ox: sx0, oy: sy0 }));
        a.seen = now;
        const dx = tx - a.x, dy = ty - a.y;
        if (Math.abs(dx) + Math.abs(dy) > 0.05 || Math.abs(sx0 - a.ox) + Math.abs(sy0 - a.oy) > 0.004) {
          // скачок больше 6 клеток (загрузка, отход через всю карту) — без анимации
          if (dx * dx + dy * dy > 110 * 110) (a.x = tx), (a.y = ty);
          else (a.x += dx * f), (a.y += dy * f);
          a.ox += (sx0 - a.ox) * f;
          a.oy += (sy0 - a.oy) * f;
          moving = 1;
        } else (a.x = tx), (a.y = ty), (a.ox = sx0), (a.oy = sy0);
        items.push({ e, a });
      });
    }
    this.anim = moving;
    const selF = this.selF;
    if (!div) {
      // уровень «Армии»: части — квадратики
      const s = clamp(z * 4.2, 4.5, 8);
      for (const { e, a } of items) {
        const [sx, sy] = this.toScr(a.x, a.y), px = sx + a.ox * s * 2.6, py = sy + a.oy * s * 2.6;
        if (px < -10 || py < -10 || px > this.W + 10 || py > this.H + 10) continue;
        const u = e.u, sov = u.side === 'SOV';
        x.globalAlpha = e.g ? 0.5 : 1;
        x.fillStyle = selF && u.form === selF ? '#f2c230' : sov ? '#c62828' : '#f4f2ec';
        x.fillRect(px - s / 2, py - s / 2, s, s);
        x.strokeStyle = sov ? '#fff' : '#141414';
        x.lineWidth = 1.2;
        x.strokeRect(px - s / 2, py - s / 2, s, s);
        if (u.id === this.sel) {
          x.strokeStyle = '#ffd34d';
          x.lineWidth = 2;
          x.strokeRect(px - s / 2 - 2.5, py - s / 2 - 2.5, s + 5, s + 5);
        }
        this.hit.push([px - s / 2, py - s / 2, px + s / 2, py + s / 2, 'u', u.id, 5]);
      }
      x.globalAlpha = 1;
    } else {
      const w = CW * k, h = CH * k;
      items.sort((p, q) => (p.e.u.id === this.sel) - (q.e.u.id === this.sel) || p.a.y + p.a.oy * 10 - (q.a.y + q.a.oy * 10));
      for (const { e, a } of items) {
        const [sx, sy] = this.toScr(a.x, a.y), px = sx + a.ox * w, py = sy + a.oy * h;
        if (px < -w || py < -h || px > this.W + w || py > this.H + h) continue;
        const u = e.u, ty = TYPES[u.type], own = u.side === this.side || !this.side || !S.fog;
        const known = own || (!e.g && u.sna === 1);
        const spr = counter(
          { nat: u.nat, num: u.num, ech: ty.ech, cat: known ? catOf(cv(S, u)) : 0, sym: ty.sym, gds: u.gds, unk: e.q, sup0: own && u.sup === 0 },
          kq,
          this.dpr,
        );
        x.globalAlpha = e.g ? 0.55 : 1;
        x.drawImage(spr, px - w / 2, py - h / 2, spr.width / this.dpr * (k / kq), spr.height / this.dpr * (k / kq));
        x.globalAlpha = 1;
        if (selF && u.form === selF && u.id !== this.sel) {
          x.strokeStyle = 'rgba(242,194,48,.9)';
          x.lineWidth = 1.6;
          x.strokeRect(px - w / 2 - 1, py - h / 2 - 1, w + 2, h + 2);
        }
        if (u.id === this.sel) {
          x.strokeStyle = 'rgba(0,0,0,.6)';
          x.lineWidth = 4.5;
          x.strokeRect(px - w / 2 - 2.5, py - h / 2 - 2.5, w + 5, h + 5);
          x.strokeStyle = '#ffd34d';
          x.lineWidth = 2.4;
          x.strokeRect(px - w / 2 - 2.5, py - h / 2 - 2.5, w + 5, h + 5);
        }
        this.hit.push([px - w / 2, py - h / 2, px + w / 2, py + h / 2, 'u', u.id, 2]);
      }
    }
    // удалить анимации исчезнувших частей
    if (this.an.size > L.length + 40) for (const [id, a] of this.an) if (a.seen !== now) this.an.delete(id);
  }
  // жетоны штабов
  hqList() {
    const S = this.S, side = this.side, fog = side && S.fog, out = [], div = this.lod === 'div';
    const seen = (c) => !fog || S.vis[c] >= 2;
    for (const F of Object.values(S.forms)) {
      if (!F.act) continue;
      const mine = !side || F.side === side;
      if (!mine && !seen(F.hq)) continue;
      // на уровне «Армии» у противника — только армии/фронты; корпуса Оси — мельче
      if (!div && !mine && F.ech === 'XXX') continue;
      out.push({ k: 'f', id: F.id, c: F.hq, o: { side: F.side, nat: F.nat, num: F.num, sub: F.sub, ech: F.ech, gen: F.gen }, sc: F.ech === 'XXX' ? 0.86 : 1 });
    }
    for (const [key, Hh] of Object.entries(HIGH)) {
      if (key === 'HGD' && !S.flags.hgd) continue;
      const mine = !side || Hh.side === side;
      if (!mine && fog) continue;
      const c = cellAt(this.G, Hh.hq[0], Hh.hq[1]);
      if (c < 0) continue;
      const big = Hh.ech === 'XXXXX', lab = big ? labOf(Hh) : null;
      out.push({ k: 'h', id: key, c, o: { side: Hh.side, nat: Hh.nat || (Hh.side === 'SOV' ? 'SOV' : 'GER'), num: lab ? '' : Hh.short.replace(/[^0-9]/g, '') || Hh.short, lab, ech: Hh.ech, gen: Hh.gen }, sc: 1 });
    }
    return out;
  }
  drawHQ(x) {
    const z = this.z, div = this.lod === 'div';
    const kt = div ? clamp((z / Z_DIV0) * 0.86, 0.6, 1) : clamp(z / 1.5, 0.55, 0.95);
    const kq = kt <= 0.66 ? 0.66 : kt <= 0.82 ? 0.82 : 1;
    for (const T of this.hqList()) {
      const [sx, sy] = this.scr(T.c), k = kt * T.sc;
      const spr = hqToken(T.o, kq, this.dpr), w = (spr.width / this.dpr) * (k / kq), h = (spr.height / this.dpr) * (k / kq);
      const px = sx - w / 2, py = sy - h / 2 - (div ? 0 : 0);
      if (px > this.W || py > this.H || px + w < 0 || py + h < 0) continue;
      x.drawImage(spr, px, py, w, h);
      const on = (T.k === 'f' && this.selF === T.id) || (T.k === 'h' && this.selH === T.id);
      if (on) {
        x.strokeStyle = 'rgba(0,0,0,.6)';
        x.lineWidth = 5;
        x.strokeRect(px - 2.5, py - 2.5, w + 3, h + 3);
        x.strokeStyle = '#ffd34d';
        x.lineWidth = 2.6;
        x.strokeRect(px - 2.5, py - 2.5, w + 3, h + 3);
      }
      this.hit.push([px, py, px + w, py + h, T.k, T.id, 0]);
    }
  }
  // метки целей директивы: {c, n, col}
  drawMarks(x) {
    for (const M of this.marks) {
      const [sx, sy] = this.scr(M.c);
      x.beginPath();
      x.arc(sx, sy, 11, 0, Math.PI * 2);
      x.fillStyle = M.col || '#d32f2f';
      x.fill();
      x.lineWidth = 2;
      x.strokeStyle = '#fff';
      x.stroke();
      x.fillStyle = '#fff';
      x.font = FONT(12, 800);
      x.textAlign = 'center';
      x.textBaseline = 'middle';
      x.fillText(String(M.n), sx, sy + 0.5);
    }
  }
  drawFx(x, now) {
    const keep = [];
    for (const e of this.fx) {
      const p = (now - e.t0) / (e.ms || 900);
      if (p >= 1) continue;
      keep.push(e);
      const [sx, sy] = this.scr(e.c);
      if (e.k === 'bt') {
        const col = e.s === 'SOV' ? '#e53935' : '#1d1d1d';
        x.globalAlpha = 1 - Math.max(0, p - 0.6) / 0.4;
        for (const f of e.from || []) {
          const [ax, ay] = this.scr(f), dx = sx - ax, dy = sy - ay, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L;
          const bx = ax + ux * L * 0.2, by = ay + uy * L * 0.2, ex = sx - ux * 9, ey = sy - uy * 9;
          x.beginPath();
          x.moveTo(bx, by);
          x.lineTo(ex, ey);
          x.strokeStyle = 'rgba(255,255,255,.75)';
          x.lineWidth = 6;
          x.stroke();
          x.strokeStyle = col;
          x.lineWidth = 3.4;
          x.stroke();
          const a = Math.atan2(uy, ux);
          x.beginPath();
          x.moveTo(ex + ux * 6, ey + uy * 6);
          x.lineTo(ex - Math.cos(a - 0.5) * 9, ey - Math.sin(a - 0.5) * 9);
          x.lineTo(ex - Math.cos(a + 0.5) * 9, ey - Math.sin(a + 0.5) * 9);
          x.closePath();
          x.fillStyle = col;
          x.fill();
        }
        // вспышка
        const r = 7 + 12 * Math.min(1, p * 2.2);
        x.beginPath();
        for (let i = 0; i < 16; i++) {
          const a = (i * Math.PI) / 8 + e.t0, rr = i % 2 ? r * 0.5 : r;
          x.lineTo(sx + Math.cos(a) * rr, sy + Math.sin(a) * rr);
        }
        x.closePath();
        x.fillStyle = '#ffd24a';
        x.fill();
        x.strokeStyle = '#d2501c';
        x.lineWidth = 2;
        x.stroke();
        if (e.txt && p > 0.15) {
          x.font = FONT(12, 800);
          x.textAlign = 'center';
          x.textBaseline = 'bottom';
          x.lineWidth = 3.5;
          x.strokeStyle = 'rgba(0,0,0,.7)';
          x.strokeText(e.txt, sx, sy - r - 2 - p * 8);
          x.fillStyle = e.good ? '#9cff9c' : '#ffe08a';
          x.fillText(e.txt, sx, sy - r - 2 - p * 8);
        }
        x.globalAlpha = 1;
      } else if (e.k === 'cap') {
        x.globalAlpha = 1 - p;
        x.beginPath();
        x.arc(sx, sy, 8 + 22 * p, 0, Math.PI * 2);
        x.strokeStyle = e.s === 'SOV' ? '#ff5252' : '#f4f2ec';
        x.lineWidth = 3;
        x.stroke();
        x.globalAlpha = 1;
      } else if (e.k === 'kill') {
        x.globalAlpha = 1 - p;
        x.strokeStyle = '#b71c1c';
        x.lineWidth = 4;
        const s = 10 + 4 * p;
        x.beginPath();
        x.moveTo(sx - s, sy - s);
        x.lineTo(sx + s, sy + s);
        x.moveTo(sx + s, sy - s);
        x.lineTo(sx - s, sy + s);
        x.stroke();
        x.globalAlpha = 1;
      } else if (e.k === 'ping') {
        x.globalAlpha = 1 - p;
        x.beginPath();
        x.arc(sx, sy, 6 + 26 * p, 0, Math.PI * 2);
        x.strokeStyle = '#ffd34d';
        x.lineWidth = 3;
        x.stroke();
        x.globalAlpha = 1;
      }
    }
    this.fx = keep;
  }
}
// подпись фронта в две строки: «Донской фронт» → ДОНСКОЙ / ФРОНТ; «Группа армий «Дон»» → ГРУППА / «ДОН»
function labOf(Hh) {
  if (Hh.n.startsWith('Группа армий')) return ['ГРУППА', Hh.n.replace('Группа армий ', '').toUpperCase()];
  const p = Hh.n.split(' ');
  const a = p.slice(0, -1).join(' ').replace('Сталинградский', 'Сталингр.').replace('Юго-Западный', 'Юго-Зап.');
  return [a.toUpperCase(), p[p.length - 1].toUpperCase()];
}
// одна итерация сглаживания Чайкина (замкнутый контур)
function chaikin1(p) {
  const q = [], L = p.length;
  for (let i = 0; i < L; i++) {
    const a = p[i], b = p[(i + 1) % L];
    q.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25], [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]);
  }
  return q;
}
