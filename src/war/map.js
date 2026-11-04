// «Фронт 1941–1945» (v0.9): карта кампании — пиксельный рельеф Европы, заливка владельцев и линия фронта
// (один составной холст, пересобирается при смене состояния), железные дороги, города и подписи, фишки дивизий
// (крупный масштаб) или жетоны штабов с портретами командующих (мелкий масштаб), подсветки хода и удара,
// стрелки целей армий, отметки боёв. Камера: перетаскивание, щипок, колесо; тап и долгое нажатие по гексу.
import { hexXY, hexAtXY, nbDir } from '../barb/hex.js';
import { warTerrain, ownerLayer, warCounter, CW, CH, EDGE, NATC } from './art.js';
import { rgb } from '../barb/art.js';
import { alive, sideOfH, isMech, unitsAt } from './rules.js';
import { portraitCanvasP } from '../staff/portraits.js';
import { POR_NAT } from './gens41.js';

const FONT = (px, w = 600) => `${w} ${px}px Rubik, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
const FRONT = rgb('#1b120d'), FRONT2 = rgb('#f3dfb0');
const COR = [...Array(6)].map((_, i) => [Math.cos(((60 * i - 30) * Math.PI) / 180), Math.sin(((60 * i - 30) * Math.PI) / 180)]);
export const LOD_HEX = 26; // гекс ≥ 26 CSS px — дивизии, меньше — армии

// рёбра ж/д для рисования: без «треугольников» (три соседних гекса, попарно связанные) — убираем ребро
// с наименьшей суммой степеней, чтобы магистраль шла прямо, а ответвление стало коротким отростком
function railDraw(M) {
  const N = M.N, nb = M.nb, rd = Uint8Array.from(M.rail);
  const on = (a, k) => (rd[a] >> k) & 1;
  const deg = (a) => { let n = 0; for (let k = 0; k < 6; k++) n += on(a, k); return n; };
  const cut = (a, k) => { const b = nb[a * 6 + k]; rd[a] &= ~(1 << k); if (b >= 0) rd[b] &= ~(1 << (k + 3) % 6); };
  for (let pass = 0; pass < 3; pass++) {
    let n = 0;
    for (let h = 0; h < N; h++) {
      if (!rd[h]) continue;
      for (let k = 0; k < 6; k++) {
        const k1 = (k + 1) % 6, j = nb[h * 6 + k], c = nb[h * 6 + k1];
        // h→j (k), h→c (k+1), c→j (k−1)
        if (j < 0 || c < 0 || !on(h, k) || !on(h, k1) || !on(c, (k + 5) % 6)) continue;
        const dh = deg(h), dj = deg(j), dc = deg(c);
        const e = [[dh + dj, h, k], [dh + dc, h, k1], [dc + dj, c, (k + 5) % 6]].sort((a, b) => a[0] - b[0])[0];
        cut(e[1], e[2]);
        n++;
      }
    }
    if (!n) break;
  }
  return rd;
}

export class WarMap {
  constructor(cv, M, opt = {}) {
    this.cv = cv;
    this.cx = cv.getContext('2d');
    this.M = M;
    this.opt = opt;
    this.S = null;
    this.side = 'SOV';
    this.ov = {};
    this.inset = [0, 0, 0, 0];
    this.s = 0;
    this.ox = 0;
    this.oy = 0;
    this.paused = 0;
    this.lodMode = 'auto'; // auto | army | div
    this.rd = railDraw(M);
    const T = warTerrain(M);
    this.T = T;
    this.comp = document.createElement('canvas');
    this.comp.width = T.W;
    this.comp.height = T.H;
    this.compX = this.comp.getContext('2d');
    this.compD = this.compX.createImageData(T.W, T.H);
    this.tint = { data: new Uint8ClampedArray(T.W * T.H * 4) };
    this.key = '';
    this.por = new Map();
    this.bindInput();
    this.loop = () => {
      this.raf = 0;
      if (this.paused) return;
      this.frame();
    };
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(cv);
    this.resize();
  }
  setState(S, side) {
    this.S = S;
    this.side = side;
    this.key = '';
    this.req();
  }
  setOverlay(o) {
    this.ov = o || {};
    this.req();
  }
  pause(p) {
    this.paused = p ? 1 : 0;
    if (!p) this.req();
  }
  setInset(l, t, r, b) {
    const d = this.dpr;
    this.inset = [l * d, t * d, r * d, b * d];
    this.clamp();
    this.req();
  }
  req() {
    if (!this.raf && !this.paused) this.raf = requestAnimationFrame(this.loop);
  }
  // ——— камера ———
  resize() {
    const d = (this.dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1)));
    const w = Math.max(1, Math.round(this.cv.clientWidth * d)), h = Math.max(1, Math.round(this.cv.clientHeight * d));
    if (this.cv.width !== w || this.cv.height !== h) (this.cv.width = w), (this.cv.height = h);
    if (!this.s) {
      this.s = this.defScale();
      this.center(this.M.cityHex('Минск'), false);
    }
    this.s = Math.max(this.minScale(), Math.min(this.maxScale(), this.s));
    this.clamp();
    this.req();
  }
  hexCSS(s = this.s) {
    return (this.M.g.W * s) / this.dpr;
  }
  defScale() {
    // начальный масштаб — армии (гекс ≈ 19 CSS px)
    return (19 * this.dpr) / this.M.g.W;
  }
  minScale() {
    const v = this.view(), w = v.r - v.l, h = v.b - v.t;
    return Math.max(0.2, Math.min(w / this.T.W, h / this.T.H) * 0.98);
  }
  maxScale() {
    return (64 * this.dpr) / this.M.g.W;
  }
  view() {
    const [l, t, r, b] = this.inset;
    return { l, t, r: this.cv.width - r, b: this.cv.height - b };
  }
  clamp() {
    const s = this.s, W = this.T.W, H = this.T.H, v = this.view(), vw = (v.r - v.l) / s, vh = (v.b - v.t) / s;
    const m = 30;
    const minX = -v.l / s - m, maxX = W + m - v.r / s, minY = -v.t / s - m, maxY = H + m - v.b / s;
    this.ox = vw >= W + 2 * m ? (W - (v.r + v.l) / s) / 2 : Math.max(minX, Math.min(maxX, this.ox));
    this.oy = vh >= H + 2 * m ? (H - (v.b + v.t) / s) / 2 : Math.max(minY, Math.min(maxY, this.oy));
  }
  lod() {
    if (this.lodMode !== 'auto') return this.lodMode;
    return this.hexCSS() >= LOD_HEX ? 'div' : 'army';
  }
  setLod(m) {
    this.lodMode = m;
    this.req();
    this.opt.onZoom?.();
  }
  hexXYs(h) {
    const [x, y] = hexXY(this.M.g, h);
    return [(x - this.ox) * this.s, (y - this.oy) * this.s];
  }
  mapXYs(x, y) {
    return [(x - this.ox) * this.s, (y - this.oy) * this.s];
  }
  onScreen(h, pad = 0.1) {
    const [x, y] = this.hexXYs(h), v = this.view(), px = (v.r - v.l) * pad, py = (v.b - v.t) * pad;
    return x > v.l + px && x < v.r - px && y > v.t + py && y < v.b - py;
  }
  center(h, animate = true, ms = 300, s1 = 0) {
    if (h < 0) return Promise.resolve();
    const [x, y] = hexXY(this.M.g, h), v = this.view();
    if (s1) this.s = Math.max(this.minScale(), Math.min(this.maxScale(), s1));
    const tx = x - (v.l + v.r) / 2 / this.s, ty = y - (v.t + v.b) / 2 / this.s;
    if (this.pan) {
      const p = this.pan;
      this.pan = null;
      p.res();
    }
    if (!animate) {
      this.ox = tx;
      this.oy = ty;
      this.clamp();
      this.req();
      this.opt.onZoom?.();
      return Promise.resolve();
    }
    const x0 = this.ox, y0 = this.oy, t0 = performance.now();
    return new Promise((res) => {
      this.pan = { t0, ms, x0, y0, tx, ty, res };
      this.req();
    });
  }
  zoomAt(k, sx, sy) {
    const s0 = this.s, s1 = Math.max(this.minScale(), Math.min(this.maxScale(), s0 * k));
    if (Math.abs(s1 - s0) < 1e-6) return;
    const lod0 = this.lod();
    const mx = sx / s0 + this.ox, my = sy / s0 + this.oy;
    this.s = s1;
    this.ox = mx - sx / s1;
    this.oy = my - sy / s1;
    this.clamp();
    this.req();
    if (this.lod() !== lod0 || true) this.opt.onZoom?.();
  }
  zoom(k) {
    const v = this.view();
    this.zoomAt(k, (v.l + v.r) / 2, (v.t + v.b) / 2);
  }
  zoomTo(css) {
    const v = this.view(), k = (css * this.dpr) / this.M.g.W / this.s;
    this.zoomAt(k, (v.l + v.r) / 2, (v.t + v.b) / 2);
  }
  hexAtScreen(cx, cy) {
    const R = this.cv.getBoundingClientRect(), x = (cx - R.left) * this.dpr, y = (cy - R.top) * this.dpr;
    return hexAtXY(this.M.g, x / this.s + this.ox, y / this.s + this.oy);
  }
  // жетон штаба под точкой (крупнее гекса)
  hqAtScreen(cx, cy) {
    if (this.lod() !== 'army' || !this._hq) return null;
    const R = this.cv.getBoundingClientRect(), x = (cx - R.left) * this.dpr, y = (cy - R.top) * this.dpr;
    let best = null, bd = 1e9;
    for (const t of this._hq) {
      const dx = x - t.x, dy = y - t.y;
      if (Math.abs(dx) <= t.w / 2 + 4 * this.dpr && dy >= -t.h / 2 - 4 * this.dpr && dy <= t.h / 2 + 12 * this.dpr) {
        const dd = dx * dx + dy * dy;
        if (dd < bd) (bd = dd), (best = t.A);
      }
    }
    return best;
  }
  // ——— ввод ———
  bindInput() {
    const cv = this.cv, P = new Map();
    let down = null, pinch = null, longT = 0;
    const clearLong = () => (longT && clearTimeout(longT), (longT = 0));
    cv.addEventListener('pointerdown', (e) => {
      cv.setPointerCapture?.(e.pointerId);
      P.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (P.size === 1) {
        down = { x: e.clientX, y: e.clientY, ox: this.ox, oy: this.oy, moved: 0, t: performance.now() };
        clearLong();
        longT = setTimeout(() => {
          if (down && !down.moved) {
            down.long = 1;
            const h = this.hexAtScreen(down.x, down.y);
            if (h >= 0) this.opt.onLong?.(h);
          }
        }, 480);
      } else if (P.size === 2) {
        clearLong();
        const [a, b] = [...P.values()];
        pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), s: this.s };
        if (down) down.moved = 1;
      }
    });
    cv.addEventListener('pointermove', (e) => {
      if (!P.has(e.pointerId)) return;
      P.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (P.size === 2 && pinch) {
        const [a, b] = [...P.values()], d = Math.hypot(a.x - b.x, a.y - b.y), k = d / Math.max(1, pinch.d);
        const R = cv.getBoundingClientRect();
        this.zoomAt((pinch.s * k) / this.s, ((a.x + b.x) / 2 - R.left) * this.dpr, ((a.y + b.y) / 2 - R.top) * this.dpr);
        return;
      }
      if (!down) return;
      const dx = e.clientX - down.x, dy = e.clientY - down.y;
      if (!down.moved && Math.hypot(dx, dy) > 7) (down.moved = 1), clearLong();
      if (down.moved) {
        this.ox = down.ox - (dx * this.dpr) / this.s;
        this.oy = down.oy - (dy * this.dpr) / this.s;
        this.clamp();
        this.req();
      }
    });
    const up = (e) => {
      if (!P.has(e.pointerId)) return;
      P.delete(e.pointerId);
      clearLong();
      if (P.size < 2) pinch = null;
      if (P.size === 0 && down) {
        if (!down.moved && !down.long) {
          const A = this.hqAtScreen(down.x, down.y);
          if (A) this.opt.onHQ?.(A);
          else this.opt.onTap?.(this.hexAtScreen(down.x, down.y));
        }
        down = null;
      } else if (P.size === 1 && down) {
        const [a] = [...P.values()];
        down = { x: a.x, y: a.y, ox: this.ox, oy: this.oy, moved: 1 };
      }
    };
    cv.addEventListener('pointerup', up);
    cv.addEventListener('pointercancel', up);
    cv.addEventListener('touchend', (e) => e.cancelable && e.preventDefault(), { passive: false });
    cv.addEventListener('wheel', (e) => {
      e.preventDefault();
      const R = cv.getBoundingClientRect();
      this.zoomAt(e.deltaY < 0 ? 1.18 : 1 / 1.18, (e.clientX - R.left) * this.dpr, (e.clientY - R.top) * this.dpr);
    }, { passive: false });
    cv.addEventListener('contextmenu', (e) => e.preventDefault());
  }
  // ——— составной слой: рельеф + владельцы + линия фронта ———
  rebuild() {
    const S = this.S, T = this.T, W = T.W, H = T.H, base = T.base.data, D = this.compD.data, hx = T.hx, M = this.M;
    ownerLayer(M, hx, S, this.side, this.tint);
    const tn = this.tint.data;
    const own = S ? S.own : M.own0, nside = S ? S.nside : null;
    const sideAt = (h) => (nside ? nside[own[h]] : null);
    for (let p = 0; p < W * H; p++) {
      const j = p * 4, h = hx[p];
      let r = base[j], g = base[j + 1], b = base[j + 2];
      const a = tn[j + 3] / 255;
      if (a) (r += (tn[j] - r) * a), (g += (tn[j + 1] - g) * a), (b += (tn[j + 2] - b) * a);
      if (h >= 0 && M.terr[h] >= 2) {
        const x = p % W, sd = sideAt(h), o = own[h];
        // граница: линия фронта (разные стороны) — тёмная двойная, граница стран — тонкая
        let fr = 0, bd = 0;
        const chk = (q) => {
          const k = hx[q];
          if (k < 0 || k === h || M.terr[k] < 2) return;
          const s2 = sideAt(k);
          if (sd && s2 && s2 !== sd) fr = 1;
          else if (own[k] !== o) bd = 1;
        };
        if (x < W - 1) chk(p + 1);
        if (x > 0) chk(p - 1);
        if (p + W < W * H) chk(p + W);
        if (p - W >= 0) chk(p - W);
        if (fr) (r = FRONT[0]), (g = FRONT[1]), (b = FRONT[2]);
        else if (bd) (r *= 0.62), (g *= 0.62), (b *= 0.62);
      }
      D[j] = r;
      D[j + 1] = g;
      D[j + 2] = b;
      D[j + 3] = 255;
    }
    // светлая кайма линии фронта со стороны игрока
    if (S)
      for (let p = W; p < W * H - W; p++) {
        const j = p * 4;
        if (D[j] !== FRONT[0] || D[j + 1] !== FRONT[1] || D[j + 2] !== FRONT[2]) continue;
        for (const q of [p + 1, p - 1, p + W, p - W]) {
          const k = hx[q], i = q * 4;
          if (k < 0 || M.terr[k] < 2 || sideAt(k) !== this.side) continue;
          if (D[i] === FRONT[0] && D[i + 1] === FRONT[1]) continue;
          D[i] = (D[i] + FRONT2[0] * 2) / 3;
          D[i + 1] = (D[i + 1] + FRONT2[1] * 2) / 3;
          D[i + 2] = (D[i + 2] + FRONT2[2] * 2) / 3;
        }
      }
    this.compX.putImageData(this.compD, 0, 0);
  }
  // ——— кадр ———
  frame() {
    const now = performance.now();
    let more = false;
    if (this.pan) {
      const p = this.pan, t = Math.min(1, (now - p.t0) / p.ms), e = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
      this.ox = p.x0 + (p.tx - p.x0) * e;
      this.oy = p.y0 + (p.ty - p.y0) * e;
      this.clamp();
      if (t >= 1) (this.pan = null), p.res(), this.opt.onZoom?.();
      else more = true;
    }
    const S = this.S, x = this.cx, s = this.s, W = this.cv.width, H = this.cv.height;
    x.setTransform(1, 0, 0, 1, 0, 0);
    x.fillStyle = '#2a5079';
    x.fillRect(0, 0, W, H);
    const key = S ? `${S.ver}|${S.day}|${S.phase}|${this.side}` : 'none';
    if (key !== this.key) (this.key = key), this.rebuild();
    x.imageSmoothingEnabled = s < 1.6;
    x.imageSmoothingQuality = 'high';
    x.drawImage(this.comp, -this.ox * s, -this.oy * s, this.T.W * s, this.T.H * s);
    if (this.hexCSS() >= 34) this.grid();
    if (this.hexCSS() >= 14) this.rails();
    this.drawOverlays(now);
    this.cities();
    if (S) {
      if (this.lod() === 'div') this.units();
      else this.armies();
    }
    this.arrows();
    this.labels();
    if (this.ov.flash >= 0 || this.ov.battles?.length) more = true;
    if (more) this.req();
  }
  visRange(pad = 1) {
    const v = this.view(), g = this.M.g, s = this.s;
    const x0 = this.ox + v.l / s, x1 = this.ox + v.r / s, y0 = this.oy + v.t / s, y1 = this.oy + v.b / s;
    const c0 = Math.max(0, Math.floor(x0 / g.W) - pad), c1 = Math.min(g.cols - 1, Math.ceil(x1 / g.W) + pad);
    const r0 = Math.max(0, Math.floor(y0 / g.rowH) - pad), r1 = Math.min(g.rows - 1, Math.ceil(y1 / g.rowH) + pad);
    return { c0, c1, r0, r1 };
  }
  *visHexes(pad = 1) {
    const { c0, c1, r0, r1 } = this.visRange(pad), cols = this.M.g.cols;
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) yield r * cols + c;
  }
  hexPath(h, k = 1) {
    const [cx, cy] = this.hexXYs(h), R = this.M.g.R * this.s * k, x = this.cx;
    x.beginPath();
    for (let i = 0; i < 6; i++) {
      const px = cx + R * COR[i][0], py = cy + R * COR[i][1];
      i ? x.lineTo(px, py) : x.moveTo(px, py);
    }
    x.closePath();
  }
  corner(h, i, k = 1) {
    const [cx, cy] = this.hexXYs(h), R = this.M.g.R * this.s * k;
    return [cx + R * COR[i][0], cy + R * COR[i][1]];
  }
  grid() {
    const x = this.cx, M = this.M;
    x.beginPath();
    for (const h of this.visHexes(0)) {
      if (M.terr[h] < 2) continue;
      for (let d = 0; d < 3; d++) {
        const [a, b] = EDGE[d], p = this.corner(h, a), q = this.corner(h, b);
        x.moveTo(p[0], p[1]);
        x.lineTo(q[0], q[1]);
      }
    }
    x.strokeStyle = 'rgba(20,16,10,0.16)';
    x.lineWidth = Math.max(1, this.dpr * 0.6);
    x.stroke();
  }
  rails() {
    const x = this.cx, M = this.M, S = this.S, d = this.dpr, big = this.hexCSS() >= 30;
    const ok = new Path2D(), bad = new Path2D();
    for (const h of this.visHexes(1)) {
      const r = this.rd[h];
      if (!r) continue;
      const [ax, ay] = this.hexXYs(h);
      for (let k = 0; k < 3; k++) {
        if (!((r >> k) & 1)) continue;
        const j = M.nb[h * 6 + k];
        if (j < 0) continue;
        const [bx, by] = this.hexXYs(j);
        const good = !S || (S.rok[h] && S.rok[j] && sideOfH(S, h) === this.side && sideOfH(S, j) === this.side);
        const P = good ? ok : bad;
        P.moveTo(ax, ay);
        P.lineTo(bx, by);
      }
    }
    x.lineCap = 'round';
    x.lineJoin = 'round';
    const sm = this.hexCSS() < LOD_HEX; // мелкий масштаб — тоньше и светлее, чтобы не забивать карту
    x.strokeStyle = sm ? 'rgba(40,30,24,0.22)' : 'rgba(40,30,24,0.32)';
    x.lineWidth = (big ? 2.2 : sm ? 1 : 1.4) * d;
    x.setLineDash([3 * d, 3 * d]);
    x.stroke(bad);
    x.setLineDash([]);
    x.strokeStyle = sm ? 'rgba(30,22,18,0.5)' : 'rgba(30,22,18,0.78)';
    x.lineWidth = (big ? 2.6 : sm ? 1.1 : 1.6) * d;
    x.stroke(ok);
    if (big) {
      x.strokeStyle = 'rgba(235,225,200,0.55)';
      x.lineWidth = 0.9 * d;
      x.setLineDash([2 * d, 4 * d]);
      x.stroke(ok);
      x.setLineDash([]);
    }
  }
  // контур области гексов
  outline(set, col, w, dash) {
    const x = this.cx, g = this.M.g;
    x.beginPath();
    for (const h of set) {
      for (let d = 0; d < 6; d++) {
        const j = nbDir(g, h, d);
        if (j >= 0 && set.has(j)) continue;
        const [a, b] = EDGE[d], p = this.corner(h, a, 0.97), q = this.corner(h, b, 0.97);
        x.moveTo(p[0], p[1]);
        x.lineTo(q[0], q[1]);
      }
    }
    x.strokeStyle = col;
    x.lineWidth = w;
    x.setLineDash(dash || []);
    x.stroke();
    x.setLineDash([]);
  }
  drawOverlays(now) {
    const o = this.ov, x = this.cx, d = this.dpr;
    if (o.area) for (const a of o.area) this.outline(a.set, a.col, (a.w || 2) * d, a.dash ? a.dash.map((v) => v * d) : null);
    if (o.reach) {
      x.fillStyle = 'rgba(255,250,232,0.30)';
      for (const h of o.reach) {
        this.hexPath(h, 0.95);
        x.fill();
      }
      this.outline(new Set([...o.reach, ...(o.sel >= 0 ? [o.sel] : [])]), 'rgba(255,248,215,0.85)', 1.6 * d);
    }
    if (o.rail) {
      x.fillStyle = 'rgba(80,165,255,0.42)';
      for (const h of o.rail) {
        this.hexPath(h, 0.9);
        x.fill();
      }
      this.outline(new Set(o.rail), 'rgba(170,220,255,0.95)', 1.5 * d);
    }
    if (o.atk) {
      for (const h of o.atk) {
        this.hexPath(h, 0.92);
        x.fillStyle = 'rgba(230,50,35,0.30)';
        x.fill();
        x.strokeStyle = 'rgba(255,80,60,0.95)';
        x.lineWidth = 2.5 * d;
        x.stroke();
      }
    }
    if (o.path && o.path.length > 1) {
      x.beginPath();
      o.path.forEach((h, i) => {
        const [px, py] = this.hexXYs(h);
        i ? x.lineTo(px, py) : x.moveTo(px, py);
      });
      x.strokeStyle = 'rgba(255,236,170,0.95)';
      x.lineWidth = 3 * d;
      x.setLineDash([2 * d, 5 * d]);
      x.lineCap = 'round';
      x.stroke();
      x.setLineDash([]);
    }
    if (o.tgt >= 0) {
      this.hexPath(o.tgt, 0.94);
      x.fillStyle = 'rgba(255,70,50,0.25)';
      x.fill();
      x.strokeStyle = '#ffd34a';
      x.lineWidth = 3.5 * d;
      x.stroke();
    }
    if (o.sel >= 0) {
      this.hexPath(o.sel, 0.94);
      x.strokeStyle = '#ffd34a';
      x.lineWidth = 3 * d;
      x.stroke();
    }
    if (o.battles && this.hexCSS() >= 12) {
      const t = (now / 600) % 1;
      for (const b of o.battles) {
        const [cx, cy] = this.hexXYs(b.h), r = Math.max(4 * d, this.M.g.R * this.s * 0.45);
        x.strokeStyle = b.win ? `rgba(255,210,80,${0.9 - t * 0.6})` : `rgba(255,90,60,${0.9 - t * 0.6})`;
        x.lineWidth = 2 * d;
        x.beginPath();
        x.arc(cx, cy, r * (0.7 + t * 0.6), 0, Math.PI * 2);
        x.stroke();
      }
    }
    if (o.flash >= 0) {
      const t = (now / 300) % 2, a = 0.45 + 0.4 * Math.abs(1 - t);
      this.hexPath(o.flash, 0.92);
      x.strokeStyle = `rgba(255,220,90,${a})`;
      x.lineWidth = 4 * d;
      x.stroke();
    }
  }
  cities() {
    const x = this.cx, M = this.M, d = this.dpr, hc = this.hexCSS(), S = this.S;
    for (const c of M.cities) {
      if (c.sz < 2 && hc < 22) continue;
      if (c.sz < 3 && c.vp < 3 && hc < 9) continue;
      const [cx, cy] = this.hexXYs(c.h);
      if (cx < -40 || cy < -40 || cx > this.cv.width + 40 || cy > this.cv.height + 40) continue;
      const r = (c.sz === 3 ? 3.6 : c.sz === 2 ? 2.8 : 2) * d * Math.min(1.5, Math.max(0.8, hc / 24));
      const sd = S ? sideOfH(S, c.h) : null;
      x.fillStyle = sd === 'SOV' ? '#f6e3d6' : sd === 'GER' ? '#e9edf2' : '#ece6d4';
      x.strokeStyle = '#1b130d';
      x.lineWidth = Math.max(1, d * 1.1);
      if (c.cap) {
        this.star(cx, cy, r * 1.6, '#ffd34a');
      } else {
        x.beginPath();
        x.rect(cx - r, cy - r, r * 2, r * 2);
        x.fill();
        x.stroke();
      }
      if (c.fort && hc >= 14) {
        x.strokeStyle = '#ffd34a';
        x.lineWidth = d * 1.2;
        x.strokeRect(cx - r - 2 * d, cy - r - 2 * d, r * 2 + 4 * d, r * 2 + 4 * d);
      }
    }
  }
  star(cx, cy, r, col) {
    const x = this.cx;
    x.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.45 : r;
      x.lineTo(cx + rr * Math.cos(a), cy + rr * Math.sin(a));
    }
    x.closePath();
    x.fillStyle = col;
    x.strokeStyle = '#2a1e06';
    x.lineWidth = Math.max(1.2, this.dpr);
    x.fill();
    x.stroke();
  }
  labels() {
    const x = this.cx, M = this.M, d = this.dpr, hc = this.hexCSS(), boxes = [];
    const list = M.cities.filter((c) => c.sz === 3 || (c.sz === 2 && hc >= 13) || (c.vp >= 3 && hc >= 10) || hc >= 34).sort((a, b) => b.sz - a.sz || b.vp - a.vp);
    const fs = Math.round((hc >= 30 ? 12.5 : hc >= 18 ? 11.5 : 10.5) * d);
    x.textBaseline = 'top';
    x.lineJoin = 'round';
    for (const c of list) {
      const [cx, cy] = this.hexXYs(c.h);
      if (cx < -80 || cy < -40 || cx > this.cv.width + 80 || cy > this.cv.height + 40) continue;
      const f = c.sz === 3 ? fs + d : fs;
      x.font = FONT(f, c.sz === 3 ? 700 : 600);
      const w = x.measureText(c.n).width, bx = cx - w / 2, by = cy + 4.5 * d + (this.lod() === 'div' ? this.M.g.R * this.s * 0.35 : 0);
      const box = [bx - 2 * d, by - d, bx + w + 2 * d, by + f + d];
      if (boxes.some((b) => !(box[2] < b[0] || box[0] > b[2] || box[3] < b[1] || box[1] > b[3]))) continue;
      boxes.push(box);
      x.strokeStyle = 'rgba(20,14,10,0.85)';
      x.lineWidth = 3 * d;
      x.strokeText(c.n, bx, by);
      x.fillStyle = c.sz === 3 ? '#fff4d6' : '#f0e8d4';
      x.fillText(c.n, bx, by);
    }
    x.textBaseline = 'alphabetic';
  }
  // ——— дивизии ———
  units() {
    const S = this.S, x = this.cx, d = this.dpr, M = this.M, o = this.ov;
    const hexDev = M.g.W * this.s, z = Math.max(1, Math.round((hexDev * 0.74) / CW)) , w = CW * z, h = CH * z;
    x.imageSmoothingEnabled = false;
    const sel = o.selU, selA = o.selA, enc = S.supC?.[this.side];
    for (const hx of this.visHexes(1)) {
      const us = unitsAt(S, hx);
      if (!us.length) continue;
      const [cx, cy] = this.hexXYs(hx);
      const n = us.length, top = us.find((u) => u.id === sel) || us[0];
      // стопка: тени нижних фишек
      for (let i = Math.min(n, 3) - 1; i >= 1; i--) {
        const ox = cx - w / 2 + i * 2.5 * z, oy = cy - h / 2 - i * 2.5 * z;
        x.fillStyle = '#121416';
        x.fillRect(ox, oy, w, h);
        x.fillStyle = (NATC[us[i].nat] || NATC.GER).plate[1];
        x.fillRect(ox + z, oy + z, w - 2 * z, h - 2 * z);
      }
      const mine = top.side === this.side;
      const c = warCounter(top, {
        cmd: mine, k: top.org / 100, cut: top.oos > 2, enc: mine && top.oos > 0 && enc && !enc[top.h], lv: top.xp >= 70 ? 3 : top.xp >= 45 ? 2 : top.xp >= 25 ? 1 : 0,
        done: mine && o.done && o.done(top),
      });
      const X = Math.round(cx - w / 2), Y = Math.round(cy - h / 2);
      x.drawImage(c, X, Y, w, h);
      if (n > 1) {
        const t = String(n);
        x.font = FONT(Math.round(9.5 * d), 700);
        const bw = x.measureText(t).width + 5 * d;
        x.fillStyle = '#ffd34a';
        x.fillRect(X + w - bw + 2 * d, Y - 5 * d, bw, 11 * d);
        x.fillStyle = '#1b130d';
        x.fillText(t, X + w - bw + 4.5 * d, Y + 4 * d);
      }
      if (selA && us.some((u) => u.hq === selA)) {
        x.strokeStyle = '#ffd34a';
        x.lineWidth = 1.5 * d;
        x.strokeRect(X - 2 * d, Y - 2 * d, w + 4 * d, h + 4 * d);
      }
      if (sel != null && us.some((u) => u.id === sel)) {
        x.strokeStyle = '#ffffff';
        x.lineWidth = 2.5 * d;
        x.strokeRect(X - 3 * d, Y - 3 * d, w + 6 * d, h + 6 * d);
      }
    }
  }
  // ——— армии: точки дивизий и жетоны штабов ———
  armies() {
    const S = this.S, x = this.cx, d = this.dpr, M = this.M, o = this.ov, hc = this.hexCSS();
    const r = Math.max(1.6 * d, Math.min(4 * d, M.g.W * this.s * 0.2));
    for (const hx of this.visHexes(1)) {
      const us = unitsAt(S, hx);
      if (!us.length) continue;
      const [cx, cy] = this.hexXYs(hx), u = us[0];
      const P = (NATC[u.nat] || NATC.GER).plate;
      x.fillStyle = '#121416';
      const rr = r * (us.length >= 3 ? 1.35 : us.length === 2 ? 1.15 : 1);
      x.fillRect(cx - rr - d * 0.7, cy - rr - d * 0.7, rr * 2 + d * 1.4, rr * 2 + d * 1.4);
      x.fillStyle = u.side === 'SOV' ? (isMech(u) ? '#ff9a3a' : '#d04a34') : isMech(u) ? '#5b8de0' : P[1] === '#5b6068' ? '#3c4148' : P[1];
      x.fillRect(cx - rr, cy - rr, rr * 2, rr * 2);
      if (o.selA && us.some((q) => q.hq === o.selA)) {
        x.strokeStyle = '#ffd34a';
        x.lineWidth = 1.5 * d;
        x.strokeRect(cx - rr - 2 * d, cy - rr - 2 * d, rr * 2 + 4 * d, rr * 2 + 4 * d);
      }
    }
    // жетоны штабов армий
    this._hq = [];
    const tk = o.tokens || [];
    const z = hc >= 16 ? 2 : 1, pw = 20 * z * (d / 2 + 0.5), ph = 24 * z * (d / 2 + 0.5);
    for (const t of tk) {
      const [cx, cy] = this.hexXYs(t.h);
      if (cx < -60 || cy < -60 || cx > this.cv.width + 60 || cy > this.cv.height + 60) continue;
      this._hq.push({ A: t.A, x: cx, y: cy, w: pw, h: ph, lab: t.lab, ic: t.ic });
    }
    // наложение: сдвиг жетонов, стоящих слишком близко
    const L = this._hq;
    for (let it = 0; it < 3; it++)
      for (let i = 0; i < L.length; i++)
        for (let j = i + 1; j < L.length; j++) {
          const a = L[i], b = L[j], dx = b.x - a.x, dy = b.y - a.y, mx = pw * 1.04 - Math.abs(dx), my = ph * 1.3 - Math.abs(dy);
          if (mx > 0 && my > 0) {
            if (mx < my) {
              const s = (dx >= 0 ? 1 : -1) * mx * 0.5;
              a.x -= s;
              b.x += s;
            } else {
              const s = (dy >= 0 ? 1 : -1) * my * 0.5;
              a.y -= s;
              b.y += s;
            }
          }
        }
    x.imageSmoothingEnabled = false;
    for (const t of L) {
      const A = t.A, mine = A.side === this.side, G = S.G[A.gen];
      const X = Math.round(t.x - pw / 2), Y = Math.round(t.y - ph / 2);
      const fr = A.side === 'SOV' ? '#7a1d14' : '#2b2f35';
      x.fillStyle = '#0e0c0a';
      x.fillRect(X - 2 * d, Y - 2 * d, pw + 4 * d, ph + 4 * d);
      x.fillStyle = o.selA === A.k ? '#ffd34a' : fr;
      x.fillRect(X - d, Y - d, pw + 2 * d, ph + 2 * d);
      if (G) {
        const pk = 'w:' + A.gen;
        let pc = this.por.get(pk);
        if (!pc) (pc = portraitCanvasP(pk, G.por, POR_NAT[G.nat] || 'GER')), this.por.set(pk, pc);
        x.drawImage(pc, X, Y, pw, ph);
      } else {
        x.fillStyle = '#5b544b';
        x.fillRect(X, Y, pw, ph);
      }
      // номер армии
      const lab = t.lab || '';
      x.font = FONT(Math.round(9.5 * d), 700);
      const lw = x.measureText(lab).width + 6 * d;
      x.fillStyle = mine ? (A.side === 'SOV' ? '#b8392a' : '#4a525c') : 'rgba(20,16,12,0.85)';
      x.fillRect(Math.round(t.x - lw / 2), Y + ph + d, lw, 12 * d);
      x.fillStyle = '#fff4d6';
      x.fillText(lab, Math.round(t.x - lw / 2 + 3 * d), Y + ph + 10 * d);
      if (t.ic) {
        x.font = FONT(Math.round(10 * d), 700);
        x.fillStyle = '#ffd34a';
        x.strokeStyle = '#120d08';
        x.lineWidth = 2.5 * d;
        x.strokeText(t.ic, X + pw - 4 * d, Y + 9 * d);
        x.fillText(t.ic, X + pw - 4 * d, Y + 9 * d);
      }
    }
  }
  arrows() {
    const A = this.ov.arrows;
    if (!A || !A.length) return;
    const x = this.cx, d = this.dpr;
    for (const a of A) {
      const [x0, y0] = this.hexXYs(a.from), [x1, y1] = this.hexXYs(a.to);
      const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy);
      if (L < 8 * d) continue;
      const ux = dx / L, uy = dy / L, mx = (x0 + x1) / 2 - uy * L * 0.12, my = (y0 + y1) / 2 + ux * L * 0.12;
      x.lineCap = 'round';
      x.strokeStyle = 'rgba(15,10,6,0.6)';
      x.lineWidth = 7 * d;
      x.beginPath();
      x.moveTo(x0, y0);
      x.quadraticCurveTo(mx, my, x1 - ux * 6 * d, y1 - uy * 6 * d);
      x.stroke();
      x.strokeStyle = a.col || '#ffd34a';
      x.lineWidth = 4 * d;
      x.stroke();
      const tx = x1 - mx, ty = y1 - my, tl = Math.hypot(tx, ty) || 1, ax = tx / tl, ay = ty / tl, s = 9 * d;
      x.beginPath();
      x.moveTo(x1 + ax * 2 * d, y1 + ay * 2 * d);
      x.lineTo(x1 - ax * s - ay * s * 0.7, y1 - ay * s + ax * s * 0.7);
      x.lineTo(x1 - ax * s + ay * s * 0.7, y1 - ay * s - ax * s * 0.7);
      x.closePath();
      x.fillStyle = a.col || '#ffd34a';
      x.strokeStyle = 'rgba(15,10,6,0.8)';
      x.lineWidth = 1.5 * d;
      x.fill();
      x.stroke();
    }
  }
}
