// «Европа 1939–1945»: карта на холсте — рельеф и политическая заливка (2×), границы держав, линии фронта,
// штриховка оккупации, режим снабжения, подсветка регионов, фишки войск и подписи; панорама и зум.
import { G, reg, LAND, ix, atWar, ally, side, supply } from './rules.js';
import { NATIONS } from './regions.js';

const SC = 2;
const NK = Object.keys(NATIONS);
export const NI = Object.fromEntries(NK.map((k, i) => [k, i + 1]));
const hex = (s) => [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16)];
const NC = [[150, 150, 140], ...NK.map((k) => hex(NATIONS[k].col))];
export const natRGB = (n) => NC[NI[n] || 0];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ease = (p) => (p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2);
const SEA = `#22476a`;
const FONT = (s) => `${s}px Tiny5, "Trebuchet MS", monospace`;
const PAL = Object.fromEntries(
  Object.entries({
    deep: `#24507a`, mid: `#2b5c8a`, shelf: `#356a99`, coast: `#4a84b6`, wave: `#3f74a4`, lake: `#3b78ab`, river: `#3e7fc1`, river2: `#4f8fc8`, sand: `#d2c592`,
    t1: `#93b05c`, t2: `#88a653`, m1: `#a39882`, m2: `#8b8069`, m3: `#c4baa3`, h1: `#a8a462`, h2: `#968f6c`, w1: `#7a9a6c`, w2: `#6c8c60`,
    d1: `#dcc88e`, d2: `#d0ba7c`, s1: `#b9b66c`, s2: `#aaa760`, g1: `#5f8b47`, g2: `#557f40`, u1: `#a3ab90`, u2: `#b6bca3`, b1: `#a2b062`, b2: `#94a457`,
  }).map(([k, v]) => [k, hex(v)]),
);
function noise(x, y, s) {
  const t = Math.sin(x * 12.9898 + y * 78.233 + s * 37.719) * 43758.5453;
  return t - Math.floor(t);
}
function vnoise(x, y, s) {
  const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi;
  const a = noise(xi, yi, s), b = noise(xi + 1, yi, s), c = noise(xi, yi + 1, s), d = noise(xi + 1, yi + 1, s);
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
// Подложка 1×: море по глубине, озёра, реки, биомы с шумом, песчаный берег
let BASE = null;
function baseRGB() {
  if (BASE) return BASE;
  const { w, h, cls } = G, n = w * h, rgb = new Uint8Array(n * 3), dist = new Uint8Array(n).fill(255);
  let q = [];
  for (let i = 0; i < n; i++) cls[i] !== 0 && ((dist[i] = 0), q.push(i));
  for (let d = 1; d <= 10 && q.length; d++) {
    const nq = [];
    for (const i of q) {
      const x = i % w;
      for (const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, i - w, i + w]) j >= 0 && j < n && dist[j] > d && ((dist[j] = d), nq.push(j));
    }
    q = nq;
  }
  const two = (a, b, x, y, k = 0.5) => (noise(x, y, 1) < k + (vnoise(x / 7, y / 7, 3) - 0.5) * 0.7 ? a : b);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = y * w + x, c = cls[i];
      let col;
      if (c === 0) {
        const d = dist[i];
        col = d <= 1 ? PAL.coast : d <= 3 ? PAL.shelf : d <= 7 ? PAL.mid : PAL.deep;
        d > 3 && y % 5 === 0 && (x + ((y / 5) | 0) * 7) % 13 < 3 && vnoise(x / 16, y, 2) > 0.45 && (col = PAL.wave);
      } else if (c === 2) col = y % 4 === 0 && (x + y) % 9 < 2 ? PAL.coast : PAL.lake;
      else if (c === 3) col = PAL.river;
      else if (c === 4) col = PAL.river2;
      else {
        if (c === 5) {
          const v = vnoise(x / 3, y / 3, 7) + (noise(x, y, 4) - 0.5) * 0.25;
          col = v > 0.62 ? PAL.m3 : v < 0.4 ? PAL.m2 : PAL.m1;
        } else if (c === 6) col = two(PAL.h1, PAL.h2, x, y, 0.62);
        else if (c === 7) col = (x * 3 + y * 5) % 7 === 0 ? PAL.w2 : two(PAL.w1, PAL.w2, x, y, 0.6);
        else if (c === 8) col = two(PAL.d1, PAL.d2, x, y, 0.55);
        else if (c === 9) col = two(PAL.s1, PAL.s2, x, y);
        else if (c === 10) col = two(PAL.g1, PAL.g2, x, y, 0.45);
        else if (c === 11) col = two(PAL.u1, PAL.u2, x, y);
        else if (c === 12) col = two(PAL.b1, PAL.b2, x, y);
        else col = two(PAL.t1, PAL.t2, x, y);
        const coast = (x > 0 && cls[i - 1] === 0) || (x < w - 1 && cls[i + 1] === 0) || (y > 0 && cls[i - w] === 0) || (y < h - 1 && cls[i + w] === 0);
        coast && c !== 5 && c !== 11 && (col = PAL.sand);
      }
      (rgb[i * 3] = col[0]), (rgb[i * 3 + 1] = col[1]), (rgb[i * 3 + 2] = col[2]);
    }
  return (BASE = rgb);
}
// Цвета подсветки: выбор и цели
export const HL = {
  sel: [`rgba(255,236,170,.16)`, `#ffe9a0`], move: [`rgba(98,211,107,.30)`, `#7ff08a`], capture: [`rgba(255,214,80,.34)`, `#ffd650`],
  attack: [`rgba(240,70,50,.38)`, `#ff6a50`], amph: [`rgba(205,110,255,.34)`, `#d68cff`], air: [`rgba(90,169,230,.30)`, `#8fd0ff`],
  rail: [`rgba(80,220,230,.30)`, `#7ff3ff`], sea: [`rgba(80,150,255,.32)`, `#8fb8ff`], deploy: [`rgba(255,214,80,.30)`, `#ffd650`],
  flash: [`rgba(255,255,255,.0)`, `#ffffff`],
};

export class EuropeMap {
  constructor(cv, o = {}) {
    this.cv = cv;
    this.ctx = cv.getContext(`2d`);
    this.o = o;
    this.w = G.w;
    this.h = G.h;
    this.off = document.createElement(`canvas`);
    this.off.width = this.w * SC;
    this.off.height = this.h * SC;
    this.octx = this.off.getContext(`2d`);
    this.img = this.octx.createImageData(this.w * SC, this.h * SC);
    this.cx = this.w * 0.55;
    this.cy = this.h * 0.45;
    this.z = 1.5;
    this.inset = { l: 0, t: 0, r: 0, b: 0 };
    this.mode = 0;
    this.sel = 0;
    this.hl = new Map();
    this.flashSet = null;
    this.marks = [];
    this.paths = new Map();
    this.ptr = new Map();
    this.moved = 0;
    this.dirty = 1;
    this.ver = 0;
    this.hit = [];
    this.bind();
    this.resize();
    const loop = (t) => {
      if (this.dead) return;
      this.frame(t);
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
    document.fonts?.load?.(FONT(10)).then(() => ((this.fontOk = 1), (this.dirty = 1))).catch(() => {});
  }
  destroy() {
    this.dead = 1;
    cancelAnimationFrame(this.raf);
    const c = this.cv, h = this.hd;
    for (const k of [`pointerdown`, `pointermove`, `pointerup`, `pointercancel`]) c.removeEventListener(k, h[k]);
    c.removeEventListener(`wheel`, h.wheel);
    window.removeEventListener(`resize`, h.resize);
  }
  pause(p) {
    this.paused = p;
    p || (this.resize(), (this.dirty = 1));
  }
  // ——— ввод ———
  bind() {
    const c = this.cv;
    c.style.touchAction = `none`;
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
        (p.x = x), (p.y = y);
        if (this.ptr.size === 1) {
          this.moved += Math.abs(dx) + Math.abs(dy);
          this.moved > 7 && ((this.cx -= dx / this.z), (this.cy -= dy / this.z), this.clamp());
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
        p && e.type === `pointerup` && this.ptr.size === 0 && this.moved <= 7 && this.tap(p.x, p.y);
        this.pz = this.ptr.size === 2 ? pinch() : null;
      },
      wheel: (e) => {
        e.preventDefault();
        this.cam = null;
        const [x, y] = pt(e);
        this.zoomAt(x, y, Math.exp(-clamp(e.deltaY, -120, 120) * 0.0022));
      },
      resize: () => this.resize(),
    };
    this.hd.pointercancel = this.hd.pointerup;
    for (const k of [`pointerdown`, `pointermove`, `pointerup`, `pointercancel`]) c.addEventListener(k, this.hd[k]);
    c.addEventListener(`wheel`, this.hd.wheel, { passive: false });
    window.addEventListener(`resize`, this.hd.resize);
  }
  // регион под точкой экрана: фишка → пиксель → ближайший регион в радиусе (острова, побережье)
  regionAt(sx, sy) {
    for (const b of this.hit) if (sx >= b[0] - 3 && sx <= b[2] + 3 && sy >= b[1] - 3 && sy <= b[3] + 3) return b[4];
    const [mx, my] = this.toMap(sx, sy), x = Math.floor(mx), y = Math.floor(my), { w, h } = this;
    const at = (x, y) => (x >= 0 && y >= 0 && x < w && y < h ? G.reg[y * w + x] : 0);
    if (at(x, y)) return at(x, y);
    const rad = Math.max(2, Math.ceil(10 / this.z));
    let best = 0, bd = 1e9;
    for (let dy = -rad; dy <= rad; dy++)
      for (let dx = -rad; dx <= rad; dx++) {
        const r = at(x + dx, y + dy), d = dx * dx + dy * dy;
        r && d < bd && ((bd = d), (best = r));
      }
    return best;
  }
  tap(x, y) {
    this.o.onTap?.(this.regionAt(x, y), x, y);
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
    this.dirty = 1;
  }
  free() {
    const { l, t, r, b } = this.inset;
    const fw = Math.max(80, this.W - l - r), fh = Math.max(80, this.H - t - b);
    return { fw, fh, vx: l + fw / 2, vy: t + fh / 2 };
  }
  minZ() {
    const { fw, fh } = this.free();
    return Math.min(fw / this.w, fh / this.h) * 0.95;
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
    this.z = clamp(this.z * f, this.minZ(), 10);
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
    this.z = clamp(this.z, this.minZ(), 10);
    const hw = fw / 2 / this.z, hh = fh / 2 / this.z, m = 20 / this.z;
    this.cx = this.w + 2 * m <= 2 * hw ? this.w / 2 : clamp(this.cx, hw - m, this.w - hw + m);
    this.cy = this.h + 2 * m <= 2 * hh ? this.h / 2 : clamp(this.cy, hh - m, this.h - hh + m);
    this.dirty = 1;
  }
  fit(bb, maxZ = 4, ms = 0) {
    const { fw, fh } = this.free();
    const z = clamp(Math.min(fw / Math.max(8, bb[2] - bb[0]), fh / Math.max(8, bb[3] - bb[1])), this.minZ(), maxZ);
    const to = { cx: (bb[0] + bb[2]) / 2, cy: (bb[1] + bb[3]) / 2, z };
    if (!ms) return Object.assign(this, to), this.clamp();
    this.cam = { from: { cx: this.cx, cy: this.cy, z: this.z }, to, t0: performance.now(), ms };
  }
  fitRegions(list, maxZ = 3.2, ms = 0, pad = 10) {
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const i of list) {
      const R = reg(i);
      if (!R) continue;
      const b = R.bb;
      (x0 = Math.min(x0, b[0])), (y0 = Math.min(y0, b[1])), (x1 = Math.max(x1, b[2])), (y1 = Math.max(y1, b[3]));
    }
    x0 < x1 && this.fit([x0 - pad, y0 - pad, x1 + pad, y1 + pad], maxZ, ms);
  }
  // показать регион, если он вне видимой области (или ближе к краю)
  reveal(i, ms = 350) {
    const R = reg(i);
    if (!R) return;
    const [sx, sy] = this.toScr(R.ax, R.ay), { l, t, r, b } = this.inset, m = 40;
    if (sx > l + m && sx < this.W - r - m && sy > t + m && sy < this.H - b - m) return;
    this.cam = { from: { cx: this.cx, cy: this.cy, z: this.z }, to: { cx: R.ax, cy: R.ay, z: Math.max(this.z, 1.6) }, t0: performance.now(), ms };
  }
  // ——— содержимое ———
  setState(S) {
    this.S = S;
    this.compose();
    this.ver++;
    this.dirty = 1;
  }
  // изменилось владение/войска: перерисовать заливку (частично — по рамкам регионов) и фишки
  refresh(changed) {
    const S = this.S;
    if (!S) return;
    if (changed === true || !this.ownSnap) this.compose();
    else {
      const ch = [];
      for (let r = 1; r <= G.R.length; r++) this.ownSnap[r] !== this.key(S, r) && ch.push(r);
      if (ch.length > 40) this.compose();
      else if (ch.length) {
        let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
        for (const r of ch) {
          const b = reg(r).bb;
          (x0 = Math.min(x0, b[0])), (y0 = Math.min(y0, b[1])), (x1 = Math.max(x1, b[2])), (y1 = Math.max(y1, b[3]));
          for (const j of reg(r).nb) {
            const c = reg(j).bb;
            (x0 = Math.min(x0, c[0])), (y0 = Math.min(y0, c[1])), (x1 = Math.max(x1, c[2])), (y1 = Math.max(y1, c[3]));
          }
        }
        this.compose([x0 - 1, y0 - 1, x1 + 2, y1 + 2]);
      }
    }
    this.ver++;
    this.dirty = 1;
  }
  key(S, r) {
    return `${S.ctrl[r]}|${S.core[r]}|${this.mode === 2 ? supply(S, S.player || `GER`)[r] : 0}`;
  }
  setMode(m) {
    this.mode = m;
    this.compose();
    this.dirty = 1;
  }
  compose(bb) {
    const S = this.S;
    if (!S) return;
    const { w, h } = this, { cls, reg: RG } = G, W2 = w * SC, d = this.img.data, B = baseRGB(), NR = G.R.length, P = S.player;
    const own = new Uint8Array(NR + 1), core = new Uint8Array(NR + 1);
    for (let r = 1; r <= NR; r++) (own[r] = NI[S.ctrl[r]] || 0), (core[r] = NI[S.core[r]] || 0);
    this.ownSnap = this.ownSnap || [];
    for (let r = 1; r <= NR; r++) this.ownSnap[r] = this.key(S, r);
    const NN = NK.length + 1, war = new Uint8Array(NN * NN), mine = new Uint8Array(NN), neu = new Uint8Array(NN);
    for (let a = 1; a < NN; a++) {
      const A = NK[a - 1];
      mine[a] = P && ally(S, A, P) ? 1 : 0;
      neu[a] = !side(S, A) && !(P && atWar(S, A, P)) ? 1 : 0;
      for (let b = a + 1; b < NN; b++) atWar(S, A, NK[b - 1]) && (war[a * NN + b] = war[b * NN + a] = 1);
    }
    const mode = this.mode, sup = mode === 2 ? supply(S, P || `GER`) : null;
    const x0 = bb ? clamp(Math.floor(bb[0]), 0, w) : 0, y0 = bb ? clamp(Math.floor(bb[1]), 0, h) : 0;
    const x1 = bb ? clamp(Math.ceil(bb[2]), 0, w) : w, y1 = bb ? clamp(Math.ceil(bb[3]), 0, h) : h;
    const isW = (c) => c === 0 || c === 2;
    // тип края: 0 нет, 1 регион, 2 берег, 3 граница держав, 4 фронт; eo — держава по ту сторону
    const eo = [0, 0, 0, 0], et = [0, 0, 0, 0];
    const edge = (k, r, o, j) => {
      et[k] = 0;
      if (j < 0) return;
      if (isW(cls[j])) return void (et[k] = 2);
      const rn = RG[j];
      if (rn === r) return;
      if (!r || !rn) return void (et[k] = 3);
      const on = own[rn];
      eo[k] = on;
      if (on === o) return void (et[k] = r > rn ? 1 : 0);
      et[k] = war[o * NN + on] ? 4 : 3;
    };
    const tint = [0, 0, 0];
    for (let y = y0; y < y1; y++)
      for (let x = x0; x < x1; x++) {
        const i = y * w + x, c = cls[i], r = RG[i];
        let R = B[i * 3], Gc = B[i * 3 + 1], Bc = B[i * 3 + 2], o = 0, hatch = 0;
        const land = !isW(c);
        if (land) {
          if (!r) {
            const l = (R + Gc + Bc) / 3;
            (R = l * 0.55 + 52), (Gc = l * 0.55 + 54), (Bc = l * 0.55 + 50);
          } else {
            o = own[r];
            const t = NC[o];
            let k;
            if (mode === 2) {
              if (mine[o]) {
                const s = sup[r];
                const col = s < 0 ? [176, 44, 32] : s <= 4 ? [70, 172, 84] : s <= 8 ? [150, 186, 72] : s <= 12 ? [214, 176, 62] : [220, 120, 50];
                (tint[0] = col[0]), (tint[1] = col[1]), (tint[2] = col[2]), (k = 0.62);
                s < 0 && (hatch = 2);
              } else (tint[0] = t[0] * 0.5 + 60), (tint[1] = t[1] * 0.5 + 60), (tint[2] = t[2] * 0.5 + 60), (k = 0.5);
            } else {
              (tint[0] = t[0]), (tint[1] = t[1]), (tint[2] = t[2]);
              k = mode === 1 ? 0.24 : neu[o] ? 0.44 : 0.56;
              neu[o] && mode === 0 && ((tint[0] = t[0] * 0.7 + 70), (tint[1] = t[1] * 0.7 + 70), (tint[2] = t[2] * 0.7 + 66));
              core[r] && core[r] !== o && (hatch = 1);
            }
            (c === 3 || c === 4) && (k *= 0.35);
            (R = R * (1 - k) + tint[0] * k), (Gc = Gc * (1 - k) + tint[1] * k), (Bc = Bc * (1 - k) + tint[2] * k);
          }
          edge(0, r, o, x > 0 ? i - 1 : -1);
          edge(1, r, o, x < w - 1 ? i + 1 : -1);
          edge(2, r, o, y > 0 ? i - w : -1);
          edge(3, r, o, y < h - 1 ? i + w : -1);
        } else (et[0] = et[1] = et[2] = et[3] = 0);
        const hc = hatch === 1 ? NC[core[r]] : null;
        for (let sy = 0; sy < SC; sy++)
          for (let sx = 0; sx < SC; sx++) {
            const X = x * SC + sx, Y = y * SC + sy, p = (Y * W2 + X) * 4;
            let rr = R, gg = Gc, bb2 = Bc;
            if (hatch && (X + Y) % 7 === 0) {
              if (hc) (rr = rr * 0.45 + hc[0] * 0.55), (gg = gg * 0.45 + hc[1] * 0.55), (bb2 = bb2 * 0.45 + hc[2] * 0.55);
              else (rr *= 0.62), (gg *= 0.62), (bb2 *= 0.62);
            }
            const kh = sx ? 1 : 0, kv = sy ? 3 : 2, kk = et[kh] >= et[kv] ? kh : kv, e = et[kk];
            if (e === 1) (rr *= 0.8), (gg *= 0.8), (bb2 *= 0.8);
            else if (e === 2) (rr *= 0.66), (gg *= 0.66), (bb2 *= 0.7);
            else if (e === 3) (rr *= 0.38), (gg *= 0.38), (bb2 *= 0.4);
            else if (e === 4) {
              if (mine[o]) (rr = 255), (gg = 222), (bb2 = 70);
              else if (mine[eo[kk]]) (rr = 26), (gg = 8), (bb2 = 6);
              else (rr = 238), (gg = 104), (bb2 = 44);
            }
            (d[p] = rr), (d[p + 1] = gg), (d[p + 2] = bb2), (d[p + 3] = 255);
          }
      }
    this.octx.putImageData(this.img, 0, 0, x0 * SC, y0 * SC, (x1 - x0) * SC, (y1 - y0) * SC);
    this.dirty = 1;
  }
  // подсветка: map r → вид (move/attack/…); sel — выбранный регион
  setHL(m, sel = this.sel) {
    this.hl = m || new Map();
    this.sel = sel || 0;
    this.dirty = 1;
  }
  flash(list, ms = 2600) {
    this.flashSet = list && list.length ? { list, t0: performance.now(), ms } : null;
    this.dirty = 1;
  }
  // маркеры: [{r, k: boom|lost|won}]
  setMarks(m) {
    this.marks = m || [];
    this.ver++;
    this.dirty = 1;
  }
  invalidate() {
    this.ver++;
    this.dirty = 1;
  }
  path(r) {
    let p = this.paths.get(r);
    if (p) return p;
    const R = reg(r), [x0, y0, x1, y1] = R.bb, { w, h } = this, RG = G.reg;
    const fill = new Path2D(), edge = new Path2D();
    const at = (x, y) => x >= 0 && y >= 0 && x < w && y < h && RG[y * w + x] === r;
    for (let y = y0; y <= y1; y++) {
      let s = -1;
      for (let x = x0; x <= x1 + 1; x++) {
        const v = x <= x1 && at(x, y);
        v && s < 0 && (s = x);
        !v && s >= 0 && (fill.rect(s, y, x - s, 1), (s = -1));
      }
    }
    for (let y = y0; y <= y1 + 1; y++) {
      let s = -1;
      for (let x = x0; x <= x1 + 1; x++) {
        const v = x <= x1 && at(x, y) !== at(x, y - 1);
        v && s < 0 && (s = x);
        !v && s >= 0 && (edge.moveTo(s, y), edge.lineTo(x, y), (s = -1));
      }
    }
    for (let x = x0; x <= x1 + 1; x++) {
      let s = -1;
      for (let y = y0; y <= y1 + 1; y++) {
        const v = y <= y1 && at(x, y) !== at(x - 1, y);
        v && s < 0 && (s = y);
        !v && s >= 0 && (edge.moveTo(x, s), edge.lineTo(x, y), (s = -1));
      }
    }
    p = { fill, edge };
    this.paths.set(r, p);
    return p;
  }
  // ——— кадр ———
  frame(t) {
    if (this.paused) return;
    if (this.cam) {
      const c = this.cam, p = ease(clamp((t - c.t0) / c.ms, 0, 1));
      this.z = c.from.z + (c.to.z - c.from.z) * p;
      this.cx = c.from.cx + (c.to.cx - c.from.cx) * p;
      this.cy = c.from.cy + (c.to.cy - c.from.cy) * p;
      this.clamp();
      p >= 1 && (this.cam = null);
    }
    const fl = this.flashSet && t - this.flashSet.t0 < this.flashSet.ms;
    this.flashSet && !fl && ((this.flashSet = null), (this.dirty = 1));
    const anim = this.hl.size > 0 || fl;
    if (!this.dirty && !(anim && t - this.last > 50)) return;
    this.dirty = 0;
    this.last = t;
    this.draw(t);
  }
  draw(t) {
    const { ctx, z } = this, dpr = this.dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = SEA;
    ctx.fillRect(0, 0, this.W, this.H);
    const [ox, oy] = this.toScr(0, 0);
    ctx.imageSmoothingEnabled = z < 1.9;
    ctx.imageSmoothingQuality = `medium`;
    ctx.drawImage(this.off, ox, oy, this.w * z, this.h * z);
    ctx.imageSmoothingEnabled = false;
    // подсветка регионов (в координатах карты)
    const ph = (Math.sin(t / 260) + 1) / 2;
    const hlDraw = (r, k, lw, a = 1) => {
      const P = this.path(r), [f, s] = HL[k] || HL.sel;
      ctx.setTransform(dpr * z, 0, 0, dpr * z, dpr * ox, dpr * oy);
      ctx.globalAlpha = a;
      ctx.fillStyle = f;
      ctx.fill(P.fill);
      ctx.strokeStyle = s;
      ctx.lineWidth = lw / z;
      ctx.lineJoin = `miter`;
      ctx.stroke(P.edge);
      ctx.globalAlpha = 1;
    };
    for (const [r, k] of this.hl) hlDraw(r, k, 1.6, 0.75 + ph * 0.25);
    if (this.sel) {
      const P = this.path(this.sel);
      ctx.setTransform(dpr * z, 0, 0, dpr * z, dpr * ox, dpr * oy);
      ctx.strokeStyle = `rgba(10,10,8,.85)`;
      ctx.lineWidth = 4.2 / z;
      ctx.stroke(P.edge);
      hlDraw(this.sel, `sel`, 2.2);
    }
    if (this.flashSet) {
      const f = this.flashSet, p = clamp((t - f.t0) / f.ms, 0, 1), a = (1 - p) * (0.55 + 0.45 * Math.sin(t / 120));
      ctx.setTransform(dpr * z, 0, 0, dpr * z, dpr * ox, dpr * oy);
      for (const { r, col } of f.list) {
        const P = this.path(r);
        ctx.globalAlpha = Math.max(0, a);
        ctx.fillStyle = col || `rgba(255,255,255,.35)`;
        ctx.fill(P.fill);
        ctx.strokeStyle = `#fff`;
        ctx.lineWidth = 1.6 / z;
        ctx.stroke(P.edge);
      }
      ctx.globalAlpha = 1;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // подписи и фишки — кэш-слой, пока камера и состояние стоят
    const key = `${this.W}|${this.H}|${dpr}|${z.toFixed(4)}|${this.cx.toFixed(3)}|${this.cy.toFixed(3)}|${this.ver}|${this.S?._uv}|${this.sel}|${this.fontOk ? 1 : 0}`;
    if (key !== this.labKey) {
      this.labKey = key;
      const L = this.lab || (this.lab = document.createElement(`canvas`));
      (L.width !== this.cv.width || L.height !== this.cv.height) && ((L.width = this.cv.width), (L.height = this.cv.height));
      const lc = L.getContext(`2d`);
      lc.setTransform(1, 0, 0, 1, 0, 0);
      lc.clearRect(0, 0, L.width, L.height);
      lc.setTransform(dpr, 0, 0, dpr, 0, 0);
      lc.imageSmoothingEnabled = false;
      this.S && this.drawUnits(lc);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(this.lab, 0, 0);
  }
  // ——— фишки войск, города, подписи ———
  drawUnits(ctx) {
    const S = this.S, z = this.z, P = S.player, I = ix(S), boxes = [];
    this.hit = [];
    const mini = z < 0.95, cw = z >= 2.4 ? 30 : 26, ch = z >= 2.4 ? 18 : 16;
    const vis = (x, y, m = 40) => x > -m && y > -m && x < this.W + m && y < this.H + m;
    const items = [];
    for (const R of G.R) {
      const us = I[R.i];
      if (!us.length) continue;
      const [x, y] = this.toScr(R.ax, R.ay);
      if (!vis(x, y)) continue;
      const land = us.filter(LAND), air = us.filter((u) => !LAND(u));
      items.push({ R, x: Math.round(x), y: Math.round(y), land, air });
    }
    // маркеры боёв
    for (const m of this.marks) {
      const R = reg(m.r);
      if (!R) continue;
      const [x, y] = this.toScr(R.ax, R.ay);
      vis(x, y) && this.boom(ctx, Math.round(x - (mini ? 6 : cw / 2 + 4)), Math.round(y - (mini ? 6 : ch / 2 + 4)), m.k);
    }
    // города и столицы
    const cities = [];
    for (const R of G.R) {
      if (!R.city && !R.cap) continue;
      const [x, y] = this.toScr(R.sx, R.sy);
      vis(x, y) && cities.push({ R, x: Math.round(x), y: Math.round(y) });
    }
    for (const it of items) {
      const { x, y } = it;
      if (mini) boxes.push([x - 5, y - 5, x + 5, y + 5]);
      else boxes.push([x - cw / 2 - 1, y - ch / 2 - 1, x + cw / 2 + 1, y + ch / 2 + 5]);
    }
    for (const c of cities) {
      const d = c.R.cap ? 4 : 2;
      ctx.fillStyle = `#0b0d0f`;
      ctx.fillRect(c.x - d - 1, c.y - d - 1, 2 * d + 2, 2 * d + 2);
      ctx.fillStyle = c.R.cap ? `#ffd34d` : `#f2f0e6`;
      ctx.fillRect(c.x - d, c.y - d, 2 * d, 2 * d);
      c.R.cap && ((ctx.fillStyle = `#8a5a10`), ctx.fillRect(c.x - 1, c.y - 1, 2, 2));
    }
    // подписи: столицы → города → остальные регионы
    const minLab = z >= 1.9 ? 0 : z >= 1.15 ? 1 : z >= 0.7 ? 2 : 3;
    const labs = G.R.filter((R) => (R.cap ? 2 : R.city ? 1 : 0) >= minLab).sort((a, b) => (b.cap ? 2 : b.city ? 1 : 0) - (a.cap ? 2 : a.city ? 1 : 0) || b.vp - a.vp);
    ctx.textBaseline = `middle`;
    ctx.lineJoin = `round`;
    const hitB = (b) => boxes.some((c) => b[0] < c[2] && b[2] > c[0] && b[1] < c[3] && b[3] > c[1]);
    for (const R of labs) {
      const big = R.cap || R.city, fs = R.cap ? 12 : 10;
      const [x0, y0] = big ? this.toScr(R.sx, R.sy) : this.toScr(R.ax, R.ay);
      if (!vis(x0, y0, 80)) continue;
      ctx.font = FONT(fs);
      const tw = ctx.measureText(R.n).width;
      const cand = big ? [[x0 + 6, y0], [x0 - 6 - tw, y0], [x0 - tw / 2, y0 - 10], [x0 - tw / 2, y0 + 10]] : [[x0 - tw / 2, y0 + (I[R.i].length ? ch / 2 + 9 : 0)], [x0 - tw / 2, y0 - ch / 2 - 8]];
      let ok = null;
      for (const [lx, ly] of cand) {
        const b = [lx - 2, ly - fs / 2 - 1, lx + tw + 2, ly + fs / 2 + 1];
        if (!hitB(b)) {
          ok = [lx, ly, b];
          break;
        }
      }
      if (!ok) continue;
      boxes.push(ok[2]);
      ctx.strokeStyle = `rgba(10,12,14,.9)`;
      ctx.lineWidth = 3;
      ctx.strokeText(R.n, ok[0], ok[1] + 0.5);
      ctx.fillStyle = R.cap ? `#ffe7a0` : big ? `#f4f4f0` : `#d9dccf`;
      ctx.fillText(R.n, ok[0], ok[1] + 0.5);
    }
    // фишки
    for (const it of items) this.counter(ctx, it, mini, cw, ch, P);
  }
  counter(ctx, it, mini, cw, ch, P) {
    const { x, y, land, air, R } = it, S = this.S;
    const lead = (land.length ? land : air).reduce((m, u) => ((m[u.n] = (m[u.n] || 0) + u.s), m), {});
    const n = Object.keys(lead).sort((a, b) => lead[b] - lead[a])[0];
    const col = natRGB(n), mine = n === P, pal = P && atWar(S, n, P);
    const ready = mine && [...land, ...air].some((u) => u.mv > 0 && !(u.at && u.t !== `arm` && u.t !== `mot` && u.t !== `air`));
    if (mini) {
      const s = 4;
      ctx.fillStyle = `#0b0d0f`;
      ctx.fillRect(x - s - 1, y - s - 1, 2 * s + 2, 2 * s + 2);
      ctx.fillStyle = `rgb(${col})`;
      ctx.fillRect(x - s, y - s, 2 * s, 2 * s);
      ready && ((ctx.fillStyle = `#ffd34d`), ctx.fillRect(x - s, y - s, 2 * s, 2));
      this.hit.push([x - 7, y - 7, x + 7, y + 7, R.i]);
      return;
    }
    const x0 = x - cw / 2, y0 = y - ch / 2;
    const str = land.reduce((s, u) => s + u.s, 0);
    // тень стопки
    land.length > 1 && ((ctx.fillStyle = `#0b0d0f`), ctx.fillRect(x0 + 2, y0 + 2, cw + 1, ch + 1));
    ctx.fillStyle = `#0b0d0f`;
    ctx.fillRect(x0 - 1, y0 - 1, cw + 2, ch + 2);
    const dk = mine && !ready ? 0.62 : 1;
    ctx.fillStyle = `rgb(${col.map((v) => Math.round(v * 0.78 * dk))})`;
    ctx.fillRect(x0, y0, cw, ch);
    ctx.fillStyle = `rgba(255,255,255,${mine && !ready ? 0.1 : 0.22})`;
    ctx.fillRect(x0, y0, cw, 2);
    // знак рода войск (НАТО)
    const bw = 12, bh = ch - 6, bx = x0 + 3, by = y0 + 3;
    const top = land.length ? land.reduce((m, u) => (u.t === `arm` ? `arm` : m === `arm` ? m : u.t === `mot` ? `mot` : m), `inf`) : `air`;
    ctx.fillStyle = `#ebe5cf`;
    ctx.fillRect(bx, by, bw, bh);
    ctx.strokeStyle = `#1a1a16`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    if (top === `inf` || top === `mot`) ctx.moveTo(bx, by), ctx.lineTo(bx + bw, by + bh), ctx.moveTo(bx + bw, by), ctx.lineTo(bx, by + bh);
    if (top === `arm` || top === `mot`) ctx.rect(bx + 2.5, by + 2.5, bw - 5, bh - 5);
    if (top === `air`) ctx.moveTo(bx + 2, by + bh / 2), ctx.lineTo(bx + bw - 2, by + bh / 2), ctx.moveTo(bx + bw / 2, by + 2), ctx.lineTo(bx + bw / 2, by + bh - 2);
    ctx.stroke();
    // сила
    ctx.font = FONT(10);
    ctx.textAlign = `center`;
    ctx.textBaseline = `middle`;
    const txt = String(Math.round(land.length ? str : air.reduce((s, u) => s + u.s, 0)));
    ctx.fillStyle = pal ? `#ffd0c8` : `#fff`;
    ctx.fillText(txt, x0 + bw + 3 + (cw - bw - 3) / 2, y + 0.5);
    ctx.textAlign = `left`;
    // число соединений
    const k = land.length;
    for (let q = 0; q < Math.min(8, k); q++) {
      ctx.fillStyle = `#0b0d0f`;
      ctx.fillRect(x0 + 1 + q * 4, y0 + ch + 1, 4, 4);
      ctx.fillStyle = mine ? (ready ? `#ffd34d` : `#9a8a5a`) : `rgb(${col})`;
      ctx.fillRect(x0 + 2 + q * 4, y0 + ch + 2, 2, 2);
    }
    // авиация
    if (air.length && land.length) {
      const ax = x0 + cw - 4, ay = y0 - 7;
      ctx.fillStyle = `#0b0d0f`;
      ctx.fillRect(ax - 1, ay - 1, 13, 10);
      ctx.fillStyle = air[0].n === P ? `#3d6fd6` : pal ? `#8a2b22` : `#4a5560`;
      ctx.fillRect(ax, ay, 11, 8);
      ctx.fillStyle = `#fff`;
      ctx.fillRect(ax + 2, ay + 3, 7, 2);
      ctx.fillRect(ax + 5, ay + 1, 1, 6);
    }
    this.hit.push([x0 - 1, y0 - 1, x0 + cw + 1, y0 + ch + 5, R.i]);
  }
  boom(ctx, x, y, k) {
    const c = k === `lost` ? `#ff5a3c` : k === `won` ? `#ffd34d` : `#ffb14a`;
    ctx.fillStyle = `#0b0d0f`;
    ctx.fillRect(x - 1, y + 2, 9, 3), ctx.fillRect(x + 2, y - 1, 3, 9);
    ctx.fillStyle = c;
    ctx.fillRect(x, y + 3, 7, 1), ctx.fillRect(x + 3, y, 1, 7);
    ctx.fillRect(x + 1, y + 1, 1, 1), ctx.fillRect(x + 5, y + 1, 1, 1), ctx.fillRect(x + 1, y + 5, 1, 1), ctx.fillRect(x + 5, y + 5, 1, 1);
  }
}
