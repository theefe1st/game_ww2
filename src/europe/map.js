// «Европа 1939–1945»: карта на холсте — рельеф и политическая заливка (2×), границы держав, линии фронта,
// штриховка оккупации, режим снабжения, подсветка целей, фишки дивизий (пиксель-арт, как в тактике), подписи;
// анимация марша, вспышки боёв, всплывающие потери, стрелка удара; панорама и зум.
import { G, reg, ix, atWar, ally, side, supply, orgMax, xpL, mvOf } from './rules.js';
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
export const FONT = (s, w = 600) => `${w} ${s}px Rubik, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
const rgbS = (c, k = 1) => `rgb(${c.map((v) => Math.round(clamp(v * k, 0, 255))).join(`,`)})`;
const mix = (a, b, k) => a.map((v, i) => v * (1 - k) + b[i] * k);
// ——— спрайты дивизий: пиксель-арт 16×10, как у фишек «Мирового фронта» ———
export const SPR = {
  inf: [`......kkk.......`, `.....khhhk......`, `.....kssk.......`, `....kbbbbkkkkkkk`, `...kbbbbbbwwwwk.`, `...kbbkbbkkkkk..`, `....kbbbbk......`, `....kbkkbk......`, `...kbk..kbk.....`, `...kk....kk.....`],
  arm: [`................`, `.....kkkkk......`, `....kbbbbbkkkkkk`, `....kbbbbbkgggk.`, `.kkkkkkkkkkkkk..`, `kbbbbbbbbbbbbbk.`, `kddddddddddddddk`, `kdgkgkgkgkgkgdk.`, `.kdddddddddddk..`, `..kkkkkkkkkkkk..`],
  cav: [`......kkk.......`, `.....khhhk......`, `.....kssk....kk.`, `....kbbbbk..kHHk`, `..kkkbbbbkkkHHk.`, `.kHHHHHHHHHHHHk.`, `kHHHHHHHHHHHHk..`, `.kHk.kHk.kHkHk..`, `.kHk.kHk..kHk...`, `.kk...kk...kk...`],
  mot: [`................`, `.kkkkkkkkk......`, `.kcccccccckkkk..`, `.kcccccccckwwbk.`, `.kcccccccckbbbbk`, `.kkkkkkkkkkbbbbk`, `kddddddddddddddk`, `kdkgkddddddkgkdk`, `..kgk......kgk..`, `...k........k...`],
  art: [`................`, `.............kk.`, `...........kkggk`, `.........kkggkk.`, `.......kkggkk...`, `....kkkbggkk....`, `...kbbbbbbk.....`, `..kbbkkkbbbkkk..`, `.kHHk...kHHkddk.`, `..kk.....kk..kk.`],
};
// обмундирование: корпус, тень, каска, брезент
const UNI = {
  GER: [`#6c7366`, `#4a4f47`, `#59604f`, `#7f8473`], SOV: [`#7a7243`, `#575130`, `#4f6a3a`, `#8a8257`], POL: [`#7c7650`, `#5a5537`, `#686440`, `#8d8760`],
  SVK: [`#6f735c`, `#4f5240`, `#5c604b`, `#80846c`], UK: [`#8b7a4e`, `#64573a`, `#6e6a45`, `#9a8a5e`], USA: [`#6b6b3e`, `#4c4c2c`, `#5d6236`, `#7d7b4f`],
  FRA: [`#8a8458`, `#635f3e`, `#5f6f7a`, `#958f66`], VIC: [`#8a8458`, `#635f3e`, `#5f6f7a`, `#958f66`], ITA: [`#7c7c5e`, `#5a5a43`, `#6b6d55`, `#8a8a6c`],
  FIN: [`#7b7e74`, `#585b52`, `#6a6d63`, `#8d9085`], ROM: [`#7d7550`, `#5a5438`, `#6b6646`, `#8c8560`], HUN: [`#7f7652`, `#5c553a`, `#6a6447`, `#8e8660`],
  _: [`#77735a`, `#55523f`, `#666349`, `#88846a`],
};
const SPRC = new Map();
export function sprite(t, n, sd, flip = false) {
  const key = `${t}|${n}|${sd}|${flip ? 1 : 0}`;
  let c = SPRC.get(key);
  if (c) return c;
  const P = SPR[t] || SPR.inf, u = UNI[n] || UNI._;
  const pal = { k: `#16181a`, b: u[0], d: u[1], h: u[2], s: `#e0b48a`, w: `#6b4a2b`, g: `#9aa0a6`, H: `#7a5330`, c: u[3] };
  c = document.createElement(`canvas`);
  c.width = 16 * sd;
  c.height = 10 * sd;
  const x = c.getContext(`2d`);
  for (let r = 0; r < 10; r++)
    for (let q = 0; q < 16; q++) {
      const ch = P[r][q];
      if (ch === `.`) continue;
      x.fillStyle = pal[ch] || `#f0f`;
      x.fillRect((flip ? 15 - q : q) * sd, r * sd, sd, sd);
    }
  SPRC.set(key, c);
  return c;
}
// размеры фишек по уровню детализации: W — ширина, A — поле спрайта, B — полоса силы, f — шрифт, k — масштаб спрайта
const LOD = [null, { W: 28, A: 17, B: 12, f: 11, k: 1.5 }, { W: 38, A: 24, B: 14, f: 12.5, k: 2 }];
export const lodOf = (z) => (z >= 1.75 ? 2 : z >= 1.15 ? 1 : z >= 0.8 ? 0 : -1);
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
  attack: [`rgba(240,70,50,.40)`, `#ff6a50`], bomb: [`rgba(255,140,40,.38)`, `#ffa040`], amph: [`rgba(205,110,255,.34)`, `#d68cff`],
  amphcap: [`rgba(205,110,255,.26)`, `#d68cff`], air: [`rgba(255,150,60,.34)`, `#ffb070`], rail: [`rgba(80,220,230,.30)`, `#7ff3ff`],
  sea: [`rgba(80,150,255,.32)`, `#8fb8ff`], build: [`rgba(255,214,80,.22)`, `#ffd650`], flash: [`rgba(255,255,255,.0)`, `#ffffff`],
};

// раздвинуть перекрывающиеся фишки (не дальше 0,6 размера от центра провинции); выбранная стоит на месте
function declutter(items, gw, gh, sel) {
  const n = items.length;
  for (const it of items) (it.ax = it.x), (it.ay = it.y);
  if (n < 2) return;
  const lim = Math.max(gw, gh) * 0.6;
  for (let k = 0; k < 12; k++) {
    let hit = 0;
    for (let a = 0; a < n; a++) {
      const A = items[a];
      for (let b = a + 1; b < n; b++) {
        const B = items[b], dx = B.x - A.x, dy = B.y - A.y, ox = gw - Math.abs(dx), oy = gh - Math.abs(dy);
        if (ox <= 0 || oy <= 0) continue;
        hit = 1;
        const wa = A.R.i === sel ? 0 : B.R.i === sel ? 1 : 0.5, wb = 1 - wa;
        if (ox / gw < oy / gh) {
          const s = (dx > 0 || (dx === 0 && a % 2) ? 1 : -1) * ox;
          (A.x -= s * wa), (B.x += s * wb);
        } else {
          const s = (dy > 0 || (dy === 0 && a % 2) ? 1 : -1) * oy;
          (A.y -= s * wa), (B.y += s * wb);
        }
      }
    }
    for (const it of items) {
      const dx = it.x - it.ax, dy = it.y - it.ay, d = Math.hypot(dx, dy);
      d > lim && ((it.x = it.ax + (dx / d) * lim), (it.y = it.ay + (dy / d) * lim));
    }
    if (!hit) break;
  }
  for (const it of items) (it.x = Math.round(it.x)), (it.y = Math.round(it.y));
}
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
    this.z = 2.4;
    this.inset = { l: 0, t: 0, r: 0, b: 0 };
    this.mode = 0;
    this.sel = 0;
    this.hl = new Map();
    this.flashSet = null;
    this.marks = [];
    this.paths = new Map();
    this.ptr = new Map();
    this.anims = new Map();
    this.fx = [];
    this.arrow = null;
    this.ready = new Set();
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
    const fl = document.fonts;
    fl?.load ? Promise.all([fl.load(FONT(12, 700)), fl.load(FONT(12, 500))]).then(() => ((this.fontOk = 1), this.invalidate())).catch(() => {}) : (this.fontOk = 1);
  }
  destroy() {
    this.dead = 1;
    cancelAnimationFrame(this.raf);
    const c = this.cv, h = this.hd;
    for (const k of [`pointerdown`, `pointermove`, `pointerup`, `pointercancel`]) c.removeEventListener(k, h[k]);
    c.removeEventListener(`wheel`, h.wheel);
    c.removeEventListener(`touchend`, h.touchend);
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
      // касание карты не должно порождать «призрачный» click: после выбора региона панель
      // перерисовывается под пальцем, и браузер нажал бы кнопку, оказавшуюся в этой точке
      touchend: (e) => e.cancelable && e.preventDefault(),
    };
    this.hd.pointercancel = this.hd.pointerup;
    for (const k of [`pointerdown`, `pointermove`, `pointerup`, `pointercancel`]) c.addEventListener(k, this.hd[k]);
    c.addEventListener(`wheel`, this.hd.wheel, { passive: false });
    c.addEventListener(`touchend`, this.hd.touchend, { passive: false });
    window.addEventListener(`resize`, this.hd.resize);
  }
  // регион под точкой экрана: фишка → пиксель → ближайший регион в радиусе (острова, побережье)
  regionAt(sx, sy) {
    // сверху — последние нарисованные фишки
    for (let q = this.hit.length - 1; q >= 0; q--) {
      const b = this.hit[q];
      if (sx >= b[0] - 3 && sx <= b[2] + 3 && sy >= b[1] - 3 && sy <= b[3] + 3) return b[4];
    }
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
  // плавно перевести камеру в точку {cx, cy, z}
  flyTo(to, ms = 400) {
    const t = { cx: to.cx, cy: to.cy, z: clamp(to.z, this.minZ(), 10) };
    if (!ms) return Object.assign(this, t), this.clamp(), (this.dirty = 1);
    this.cam = { from: { cx: this.cx, cy: this.cy, z: this.z }, to: t, t0: performance.now(), ms };
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
  // ——— готовность, анимация, эффекты ———
  setReady(set) {
    this.ready = set || new Set();
    this.ver++;
    this.dirty = 1;
  }
  // марш дивизии по провинциям path (первая — откуда)
  animMove(id, path, ms, delay = 0) {
    if (!path || path.length < 2) return;
    this.anims.set(id, { path, t0: performance.now() + delay, ms: ms || 170 + 160 * (path.length - 1) });
    this.ver++;
    this.dirty = 1;
  }
  addFx(e) {
    e.t0 = performance.now() + (e.delay || 0);
    e.ms = e.ms || 1100;
    this.fx.push(e);
    this.dirty = 1;
  }
  boomAt(r, delay = 0, big = false) {
    this.addFx({ k: `boom`, r, ms: big ? 800 : 620, delay, big });
  }
  floatText(r, txt, col = `#ff7a6a`, delay = 0, dy = 0) {
    this.addFx({ k: `txt`, r, txt, col, ms: 1400, delay, dy });
  }
  setArrow(a, b, col = `#ff6a50`) {
    this.arrow = a && b ? { a, b, col } : null;
    this.dirty = 1;
  }
  animating() {
    return this.anims.size > 0 || this.fx.length > 0;
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
    const live = this.animating();
    const anim = this.hl.size > 0 || fl || this.arrow || this.sel;
    if (!this.dirty && !live && !(anim && t - this.last > 50)) return;
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
    for (const [r, k] of this.hl) hlDraw(r, k, 1.8, 0.72 + ph * 0.28);
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
    // завершённые марши — обратно в общий слой
    for (const [id, a] of this.anims) t - a.t0 >= a.ms && (this.anims.delete(id), this.ver++);
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
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.S && this.drawLive(ctx, t);
  }
  // направление взгляда фишки: к соседним врагам, иначе — по блоку
  face(u) {
    const S = this.S, R = reg(u.r);
    let dx = 0;
    for (const j of R.nb) {
      const c = S.ctrl[j];
      c && atWar(S, c, u.n) && (dx += reg(j).ax - R.ax);
    }
    if (dx) return dx < 0;
    const P = S.player;
    return P ? atWar(S, u.n, P) : u.n === `SOV`;
  }
  tokSt(u) {
    const S = this.S, P = S.player, own = u.n === P;
    const ready = own && this.ready.has(u.id);
    // «отходила»: дивизия уже действовала в этом ходу (стоящие без целей не затемняются)
    const acted = own && !ready && (u.fr || u.at || u.mvd || u.mv < mvOf(S, u));
    return { own, ally: !own && P && ally(S, u.n, P), enemy: P && atWar(S, u.n, P), ready, acted, sel: u.r === this.sel };
  }
  // ——— фишки дивизий, города, подписи ———
  drawUnits(ctx) {
    const S = this.S, z = this.z, I = ix(S), boxes = [], L = lodOf(z), D = LOD[L];
    this.hit = [];
    const vis = (x, y, m = 40) => x > -m && y > -m && x < this.W + m && y < this.H + m;
    const items = [];
    for (const R of G.R) {
      const u = I[R.i];
      if (!u || this.anims.has(u.id)) continue;
      const [x, y] = this.toScr(R.ax, R.ay);
      vis(x, y) && items.push({ u, R, x: Math.round(x), y: Math.round(y) });
    }
    const th = D ? D.A + D.B : L === 0 ? 13 : 8, tw = D ? D.W : L === 0 ? 20 : 8;
    L >= 0 && declutter(items, tw + 4, th + 4, this.sel);
    // порядок рисования: сверху вниз, выбранная — поверх всех
    items.sort((a, b) => (a.R.i === this.sel) - (b.R.i === this.sel) || a.y - b.y || a.x - b.x);
    this.tpos = new Map(items.map((it) => [it.R.i, [it.x, it.y]]));
    for (const it of items) boxes.push([it.x - tw / 2 - 2, it.y - th / 2 - 2, it.x + tw / 2 + 2, it.y + th / 2 + 2]);
    // сдвинутые фишки — тонкая линия к своей провинции
    for (const it of items) {
      const dx = it.x - it.ax, dy = it.y - it.ay;
      if (dx * dx + dy * dy < 49) continue;
      ctx.strokeStyle = `rgba(8,10,12,.85)`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(it.ax, it.ay);
      ctx.lineTo(it.x, it.y);
      ctx.stroke();
      ctx.strokeStyle = rgbS(natRGB(it.u.n), 1.15);
      ctx.lineWidth = 1.2;
      ctx.stroke();
      ctx.fillStyle = `#0b0d0f`;
      ctx.fillRect(it.ax - 3, it.ay - 3, 6, 6);
      ctx.fillStyle = rgbS(natRGB(it.u.n), 1.15);
      ctx.fillRect(it.ax - 2, it.ay - 2, 4, 4);
    }
    // маркеры боёв прошлого хода
    for (const m of this.marks) {
      const R = reg(m.r);
      if (!R) continue;
      const [x, y] = this.tpos.get(m.r) || this.toScr(R.ax, R.ay);
      vis(x, y) && this.boom(ctx, Math.round(x + tw / 2 - 2), Math.round(y - th / 2 - 8), m.k);
    }
    // города и столицы
    for (const R of G.R) {
      if (!R.city && !R.cap) continue;
      const [x0, y0] = this.toScr(R.sx, R.sy), x = Math.round(x0), y = Math.round(y0);
      if (!vis(x, y)) continue;
      const d = R.cap ? (z >= 1.75 ? 5 : 4) : z >= 1.75 ? 3 : 2;
      ctx.fillStyle = `#0b0d0f`;
      ctx.fillRect(x - d - 1, y - d - 1, 2 * d + 2, 2 * d + 2);
      ctx.fillStyle = R.cap ? `#ffd34d` : `#f2f0e6`;
      ctx.fillRect(x - d, y - d, 2 * d, 2 * d);
      R.cap && ((ctx.fillStyle = `#8a5a10`), ctx.fillRect(x - 1, y - 1, 2, 2));
    }
    // подписи: столицы → города → остальные регионы
    const minLab = z >= 1.75 ? 0 : z >= 1.15 ? 1 : z >= 0.7 ? 2 : 3;
    const labs = G.R.filter((R) => (R.cap ? 2 : R.city ? 1 : 0) >= minLab).sort((a, b) => (b.cap ? 2 : b.city ? 1 : 0) - (a.cap ? 2 : a.city ? 1 : 0) || b.vp - a.vp);
    ctx.textBaseline = `middle`;
    ctx.textAlign = `left`;
    ctx.lineJoin = `round`;
    const hitB = (b) => boxes.some((c) => b[0] < c[2] && b[2] > c[0] && b[1] < c[3] && b[3] > c[1]);
    for (const R of labs) {
      const big = R.cap || R.city, fs = R.cap ? 13 : big ? 12 : 11;
      const [x0, y0] = big ? this.toScr(R.sx, R.sy) : this.toScr(R.ax, R.ay);
      if (!vis(x0, y0, 80)) continue;
      ctx.font = FONT(fs, R.cap ? 700 : big ? 600 : 500);
      const tw2 = ctx.measureText(R.n).width, hasU = !!I[R.i];
      const cand = big
        ? [[x0 + 8, y0], [x0 - 8 - tw2, y0], [x0 - tw2 / 2, y0 - 12], [x0 - tw2 / 2, y0 + 12]]
        : [[x0 - tw2 / 2, y0 + (hasU ? th / 2 + 10 : 0)], [x0 - tw2 / 2, y0 - th / 2 - 9]];
      let ok = null;
      for (const [lx, ly] of cand) {
        const b = [lx - 2, ly - fs / 2 - 1, lx + tw2 + 2, ly + fs / 2 + 1];
        if (!hitB(b)) {
          ok = [lx, ly, b];
          break;
        }
      }
      if (!ok) continue;
      boxes.push(ok[2]);
      ctx.strokeStyle = `rgba(10,12,14,.92)`;
      ctx.lineWidth = 3.2;
      ctx.strokeText(R.n, ok[0], ok[1] + 0.5);
      ctx.fillStyle = R.cap ? `#ffe7a0` : big ? `#f6f6f2` : `#e2e5da`;
      ctx.fillText(R.n, ok[0], ok[1] + 0.5);
    }
    // фишки — сверху
    for (const it of items) {
      const b = this.token(ctx, it.u, it.x, it.y, L, this.tokSt(it.u));
      this.hit.push([...b, it.R.i]);
    }
  }
  // Фишка дивизии в точке (x, y). L: 2 — полная, 1 — компактная, 0 — значок с силой, −1 — точка. Возвращает рамку.
  token(ctx, u, x, y, L, st, alpha = 1) {
    const S = this.S, c = natRGB(u.n), dpr = this.dpr;
    const frame = st.sel ? `#fff3b0` : st.enemy ? `#ff5a44` : st.own ? (st.ready ? `#f5cf55` : `#77715f`) : st.ally ? `#8fc3ff` : `#b3b3a8`;
    const spent = !!st.acted;
    alpha < 1 && (ctx.globalAlpha = alpha);
    if (L < 0) {
      ctx.fillStyle = `#0b0d0f`;
      ctx.fillRect(x - 5, y - 5, 10, 10);
      ctx.fillStyle = frame;
      ctx.fillRect(x - 4, y - 4, 8, 8);
      ctx.fillStyle = rgbS(c, spent ? 0.6 : 1);
      ctx.fillRect(x - 3, y - 3, 6, 6);
      ctx.globalAlpha = 1;
      return [x - 7, y - 7, x + 7, y + 7];
    }
    if (L === 0) {
      const W = 20, H = 13, x0 = x - W / 2, y0 = Math.round(y - H / 2);
      ctx.fillStyle = `#0b0d0f`;
      ctx.fillRect(x0 - 2, y0 - 2, W + 4, H + 4);
      ctx.fillStyle = frame;
      ctx.fillRect(x0 - 1, y0 - 1, W + 2, H + 2);
      ctx.fillStyle = rgbS(c, spent ? 0.5 : 0.78);
      ctx.fillRect(x0, y0, W, H);
      ctx.font = FONT(10.5, 700);
      ctx.textAlign = `center`;
      ctx.textBaseline = `middle`;
      ctx.fillStyle = `#fff`;
      ctx.fillText(String(Math.round(u.s)), x, y0 + H / 2 + 0.5);
      ctx.globalAlpha = 1;
      return [x0 - 4, y0 - 4, x0 + W + 4, y0 + H + 4];
    }
    const D = LOD[L], { W, A, B } = D, x0 = x - W / 2, y0 = Math.round(y - (A + B) / 2);
    if (st.sel) (ctx.fillStyle = `#0b0d0f`), ctx.fillRect(x0 - 4, y0 - 4, W + 8, A + B + 8), (ctx.fillStyle = `#fff3b0`), ctx.fillRect(x0 - 3, y0 - 3, W + 6, A + B + 6);
    ctx.fillStyle = `#0b0d0f`;
    ctx.fillRect(x0 - 2, y0 - 2, W + 4, A + B + 4);
    ctx.fillStyle = frame;
    ctx.fillRect(x0 - 1, y0 - 1, W + 2, A + B + 2);
    // табличка в цвет державы
    ctx.fillStyle = rgbS(mix(c, [238, 232, 214], 0.45));
    ctx.fillRect(x0, y0, W, A);
    ctx.fillStyle = rgbS(c, 0.92);
    ctx.fillRect(x0, y0, W, L === 2 ? 3 : 2);
    ctx.fillStyle = `rgba(0,0,0,.13)`;
    ctx.fillRect(x0, y0 + A - 3, W, 3);
    // спрайт: целые пиксели устройства
    const sd = Math.max(1, Math.round(D.k * dpr)), sw = (16 * sd) / dpr, sh = (10 * sd) / dpr;
    const spr = sprite(u.t, u.n, sd, this.face(u));
    const sx = Math.round((x0 + (W - sw) / 2) * dpr) / dpr, sy = Math.round((y0 + (L === 2 ? 3 : 2) + (A - (L === 2 ? 3 : 2) - sh) / 2) * dpr) / dpr;
    ctx.drawImage(spr, sx, sy, sw, sh);
    // опыт — золотые нашивки
    const xl = xpL(u.x || 0);
    for (let q = 0; q < xl; q++) {
      const px = x0 + 2 + q * (L === 2 ? 5 : 4), py = y0 + (L === 2 ? 5 : 4);
      ctx.fillStyle = `#0b0d0f`;
      ctx.fillRect(px - 1, py - 1, L === 2 ? 5 : 4, L === 2 ? 5 : 4);
      ctx.fillStyle = `#ffd34d`;
      ctx.fillRect(px, py, L === 2 ? 3 : 2, L === 2 ? 3 : 2);
    }
    // окопы — мешки с песком
    if (u.e > 0) {
      const bw = L === 2 ? 5 : 4, bx = x0 + W - (u.e >= 2 ? 3 : 2) * bw - 2, by = y0 + A - 5;
      for (let q = 0; q < (u.e >= 2 ? 3 : 2); q++) (ctx.fillStyle = `#2a2216`), ctx.fillRect(bx + q * bw, by, bw, 4), (ctx.fillStyle = `#cdb57c`), ctx.fillRect(bx + q * bw + 1, by + 1, bw - 2, 2);
      u.e >= 2 && ((ctx.fillStyle = `#2a2216`), ctx.fillRect(bx + bw / 2 + 2, by - 3, bw + 2, 4), (ctx.fillStyle = `#cdb57c`), ctx.fillRect(bx + bw / 2 + 3, by - 2, bw, 2));
    }
    // без снабжения
    if (u.oos > 0 || (S.player && u.n === S.player && supply(S, u.n)[u.r] < 0)) {
      const bx = x0 + W - (L === 2 ? 10 : 8), by = y0 + (L === 2 ? 4 : 3), bs = L === 2 ? 8 : 7;
      ctx.fillStyle = `#0b0d0f`;
      ctx.fillRect(bx - 1, by - 1, bs + 2, bs + 2);
      ctx.fillStyle = `#e0402e`;
      ctx.fillRect(bx, by, bs, bs);
      ctx.fillStyle = `#fff`;
      ctx.fillRect(bx + bs / 2 - 1, by + 1, 2, bs - 4);
      ctx.fillRect(bx + bs / 2 - 1, by + bs - 2, 2, 1);
    }
    spent && ((ctx.fillStyle = `rgba(8,10,12,.40)`), ctx.fillRect(x0, y0, W, A));
    // полоса: сила и организация
    ctx.fillStyle = `#13171b`;
    ctx.fillRect(x0, y0 + A, W, B);
    ctx.font = FONT(D.f, 700);
    ctx.textAlign = `center`;
    ctx.textBaseline = `middle`;
    ctx.fillStyle = st.enemy ? `#ffd9d2` : spent ? `#c9c6bb` : `#ffffff`;
    ctx.fillText(String(Math.round(u.s)), x0 + W / 2, y0 + A + (B - 3) / 2 + 0.5);
    const om = orgMax(S, u.n), k = clamp(u.o / om, 0, 1);
    ctx.fillStyle = `#2c3238`;
    ctx.fillRect(x0, y0 + A + B - 3, W, 3);
    ctx.fillStyle = k > 0.66 ? `#62d36b` : k > 0.33 ? `#e8c547` : `#e0574b`;
    ctx.fillRect(x0, y0 + A + B - 3, Math.max(1, Math.round(W * k)), 3);
    ctx.globalAlpha = 1;
    return [x0 - 3, y0 - 3, x0 + W + 3, y0 + A + B + 3];
  }
  // слой анимаций: марширующие фишки, вспышки, всплывающие числа, стрелка удара
  drawLive(ctx, t) {
    const S = this.S, L = lodOf(this.z), D = LOD[L], th = D ? D.A + D.B : 13;
    const an = (r) => this.toScr(reg(r).ax, reg(r).ay), at = (r) => this.tpos?.get(r) || an(r);
    // выбранная дивизия — прыгающий маркер над фишкой
    const sp = this.sel && L >= 0 && this.tpos?.get(this.sel);
    if (sp) {
      const bob = Math.round(Math.abs(Math.sin(t / 240)) * 5), x = sp[0], y = Math.round(sp[1] - th / 2 - 8 - bob);
      ctx.fillStyle = `#0b0d0f`;
      ctx.beginPath();
      ctx.moveTo(x - 10, y - 9), ctx.lineTo(x + 10, y - 9), ctx.lineTo(x, y + 3), ctx.closePath();
      ctx.fill();
      ctx.fillStyle = `#ffe45c`;
      ctx.beginPath();
      ctx.moveTo(x - 6.5, y - 7), ctx.lineTo(x + 6.5, y - 7), ctx.lineTo(x, y - 0.5), ctx.closePath();
      ctx.fill();
    }
    if (this.arrow) {
      const [ax, ay] = at(this.arrow.a), [bx, by] = at(this.arrow.b), dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy) || 1;
      const ux = dx / len, uy = dy / len, s0 = Math.min(len * 0.3, 18), s1 = Math.min(len * 0.3, 20);
      const x1 = ax + ux * s0, y1 = ay + uy * s0, x2 = bx - ux * s1, y2 = by - uy * s1, hw = 9, hl = 13;
      const pts = (w) => {
        const nx = -uy * w, ny = ux * w, hx = x2 - ux * hl, hy = y2 - uy * hl;
        return [[x1 + nx * 0.5, y1 + ny * 0.5], [hx + nx * 0.5, hy + ny * 0.5], [hx + nx * 1.6, hy + ny * 1.6], [x2, y2], [hx - nx * 1.6, hy - ny * 1.6], [hx - nx * 0.5, hy - ny * 0.5], [x1 - nx * 0.5, y1 - ny * 0.5]];
      };
      const poly = (p) => {
        ctx.beginPath();
        p.forEach(([x, y], q) => (q ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
        ctx.closePath();
      };
      const pul = 0.8 + 0.2 * Math.sin(t / 160);
      poly(pts(hw));
      ctx.lineJoin = `miter`;
      ctx.strokeStyle = `rgba(10,10,10,.9)`;
      ctx.lineWidth = 4;
      ctx.stroke();
      ctx.globalAlpha = pul;
      ctx.fillStyle = this.arrow.col;
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    for (const [id, a] of this.anims) {
      const u = S.units.find((v) => v.id === id);
      if (!u) continue;
      const p = clamp((t - a.t0) / a.ms, 0, 1), e = ease(p), n = a.path.length - 1, f = e * n, k = Math.min(n - 1, Math.floor(f)), q = f - k;
      const [x0, y0] = an(a.path[k]), [x1, y1] = an(a.path[k + 1]);
      const x = Math.round(x0 + (x1 - x0) * q), y = Math.round(y0 + (y1 - y0) * q - Math.sin(q * Math.PI) * 3);
      this.token(ctx, u, x, y, L, this.tokSt(u));
    }
    const keep = [];
    for (const e of this.fx) {
      const p = (t - e.t0) / e.ms;
      if (p >= 1) continue;
      keep.push(e);
      if (p < 0) continue;
      const [x, y] = at(e.r);
      if (e.k === `boom`) {
        const r0 = (e.big ? 26 : 18) * ease(Math.min(1, p * 1.4)), a = 1 - p;
        ctx.globalAlpha = a;
        for (let q = 0; q < 10; q++) {
          const an = (q / 10) * Math.PI * 2 + e.r, rr = r0 * (0.6 + 0.4 * ((q * 7) % 3) / 2), s = q % 2 ? 4 : 5;
          ctx.fillStyle = q % 3 === 0 ? `#fff2a8` : q % 3 === 1 ? `#ffb14a` : `#ff5a3c`;
          ctx.fillRect(Math.round(x + Math.cos(an) * rr - s / 2), Math.round(y + Math.sin(an) * rr - s / 2), s, s);
        }
        p < 0.35 && ((ctx.fillStyle = `#fff6c8`), ctx.fillRect(x - 6, y - 6, 12, 12));
        ctx.globalAlpha = 1;
      } else if (e.k === `txt`) {
        const yy = y - th / 2 - 8 - p * 22 + (e.dy || 0), a = p < 0.75 ? 1 : 1 - (p - 0.75) / 0.25;
        ctx.globalAlpha = Math.max(0, a);
        ctx.font = FONT(15, 800);
        ctx.textAlign = `center`;
        ctx.textBaseline = `middle`;
        ctx.lineJoin = `round`;
        ctx.strokeStyle = `rgba(8,8,8,.95)`;
        ctx.lineWidth = 4;
        ctx.strokeText(e.txt, x, yy);
        ctx.fillStyle = e.col;
        ctx.fillText(e.txt, x, yy);
        ctx.globalAlpha = 1;
      }
    }
    this.fx = keep;
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
