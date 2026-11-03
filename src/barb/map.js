// «Барбаросса 1941» (v0.8): карта главы — пиксельный рельеф в целом масштабе, заливка владельцев и линия
// фронта, туман войны, фишки дивизий, подсветки (ход, удар, авиация, снабжение, цели), стрелки разведки и
// советника, подписи городов, эффекты (взрывы, самолёты, всплывающий текст), анимация маршей.
// Камера: перетаскивание, щипок, колесо; тап и долгое нажатие по гексу.
import { hexXY, hexAtXY, nbDir } from './hex.js';
import { terrain, counter, CW, CH, rgb, hash } from './art.js';
import { NAT, OWN, alive, orgMax, lvl, supplyMap, vis, canAttack, TYPES } from './rules.js';

const TINT = { 1: rgb('#6e747c'), 2: rgb('#a8392c') };
const TA = { 1: 0.3, 2: 0.3 };
const BORDER = rgb('#20140f');
const FONT = (px, w = 600) => `${w} ${px}px Rubik, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
const EDGE = [[0, 1], [5, 0], [4, 5], [3, 4], [2, 3], [1, 2]];

export class BarbMap {
  constructor(cv, M, opt = {}) {
    this.cv = cv;
    this.cx = cv.getContext('2d');
    this.M = M;
    this.opt = opt;
    this.S = null;
    this.side = 'GER';
    this.ov = {};
    this.fxs = [];
    this.anim = new Map(); // id → {x, y}
    this.hide = new Set();
    this.inset = [0, 0, 0, 0];
    this.s = 0;
    this.ox = 0;
    this.oy = 0;
    this.dirty = 1;
    this.paused = 0;
    const T = terrain(M, [M.cityHex('Брест'), M.cityHex('Минск')]);
    this.T = T;
    this.comp = document.createElement('canvas');
    this.comp.width = T.W;
    this.comp.height = T.H;
    this.compX = this.comp.getContext('2d');
    this.compD = this.compX.createImageData(T.W, T.H);
    this.ownKey = '';
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
  // ——— состояние ———
  setState(S, side) {
    this.S = S;
    this.side = side;
    this.ownKey = '';
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
    this.dirty = 1;
    if (!this.raf && !this.paused) this.raf = requestAnimationFrame(this.loop);
  }
  // ——— камера ———
  resize() {
    const d = (this.dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1)));
    const w = Math.max(1, Math.round(this.cv.clientWidth * d)), h = Math.max(1, Math.round(this.cv.clientHeight * d));
    if (this.cv.width !== w || this.cv.height !== h) (this.cv.width = w), (this.cv.height = h);
    if (!this.s) {
      this.s = this.defScale();
      this.center(this.M.cityHex('Белосток'), false);
    }
    this.s = Math.max(this.minScale(), Math.min(this.maxScale(), this.s));
    this.clamp();
    this.req();
  }
  defScale() {
    // планшет (короткая сторона ≥ 700 px) — крупнее, телефон — как в первых кампаниях
    const k = Math.min(this.cv.clientWidth, this.cv.clientHeight) >= 700 ? 2.1 : 1.6;
    return Math.max(2, Math.round(this.dpr * k));
  }
  minScale() {
    const w = this.cv.width, h = this.cv.height;
    return Math.max(1, Math.floor(Math.min(w / this.T.W, h / this.T.H)));
  }
  maxScale() {
    return Math.max(this.minScale() + 1, Math.round(this.dpr * 3.2));
  }
  view() {
    const [l, t, r, b] = this.inset;
    return { l, t, r: this.cv.width - r, b: this.cv.height - b };
  }
  clamp() {
    const s = this.s, W = this.T.W, H = this.T.H, v = this.view(), vw = (v.r - v.l) / s, vh = (v.b - v.t) / s;
    const m = 24; // поле за краем карты
    const minX = -v.l / s - m, maxX = W + m - v.r / s, minY = -v.t / s - m, maxY = H + m - v.b / s;
    this.ox = vw >= W + 2 * m ? (W - (v.r + v.l) / s) / 2 : Math.max(minX, Math.min(maxX, this.ox));
    this.oy = vh >= H + 2 * m ? (H - (v.b + v.t) / s) / 2 : Math.max(minY, Math.min(maxY, this.oy));
  }
  hexXYs(h) {
    const [x, y] = hexXY(this.M.g, h);
    return [(x - this.ox) * this.s, (y - this.oy) * this.s];
  }
  onScreen(h, pad = 0.12) {
    const [x, y] = this.hexXYs(h), v = this.view(), px = (v.r - v.l) * pad, py = (v.b - v.t) * pad;
    return x > v.l + px && x < v.r - px && y > v.t + py && y < v.b - py;
  }
  center(h, animate = true, ms = 260) {
    if (h < 0) return;
    const [x, y] = hexXY(this.M.g, h), v = this.view();
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
      return Promise.resolve();
    }
    const x0 = this.ox, y0 = this.oy, t0 = performance.now();
    return new Promise((res) => {
      this.pan = { t0, ms, x0, y0, tx, ty, res };
      this.req();
    });
  }
  zoomAt(ds, sx, sy) {
    const s0 = this.s, s1 = Math.max(this.minScale(), Math.min(this.maxScale(), s0 + ds));
    if (s1 === s0) return;
    const mx = sx / s0 + this.ox, my = sy / s0 + this.oy;
    this.s = s1;
    this.ox = mx - sx / s1;
    this.oy = my - sy / s1;
    this.clamp();
    this.req();
  }
  zoom(ds) {
    const v = this.view();
    this.zoomAt(ds, (v.l + v.r) / 2, (v.t + v.b) / 2);
  }
  hexAtScreen(cx, cy) {
    const R = this.cv.getBoundingClientRect(), x = (cx - R.left) * this.dpr, y = (cy - R.top) * this.dpr;
    return hexAtXY(this.M.g, x / this.s + this.ox, y / this.s + this.oy);
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
        const want = Math.round(pinch.s * k);
        if (want !== this.s) {
          const R = cv.getBoundingClientRect();
          this.zoomAt(want - this.s, ((a.x + b.x) / 2 - R.left) * this.dpr, ((a.y + b.y) / 2 - R.top) * this.dpr);
        }
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
          const h = this.hexAtScreen(down.x, down.y);
          this.opt.onTap?.(h);
        }
        down = null;
      } else if (P.size === 1 && down) {
        const [a] = [...P.values()];
        down = { x: a.x, y: a.y, ox: this.ox, oy: this.oy, moved: 1 };
      }
    };
    cv.addEventListener('pointerup', up);
    cv.addEventListener('pointercancel', up);
    // без «призрачного» click: после касания карточка и кнопки могут оказаться под пальцем
    cv.addEventListener('touchend', (e) => e.cancelable && e.preventDefault(), { passive: false });
    cv.addEventListener('wheel', (e) => {
      e.preventDefault();
      const R = cv.getBoundingClientRect();
      this.zoomAt(e.deltaY < 0 ? 1 : -1, (e.clientX - R.left) * this.dpr, (e.clientY - R.top) * this.dpr);
    }, { passive: false });
    cv.addEventListener('contextmenu', (e) => e.preventDefault());
  }
  // ——— слои: заливка владельцев, линия фронта, туман ———
  rebuild() {
    const S = this.S, T = this.T, W = T.W, H = T.H, base = T.base.data, dec = T.decor.data, D = this.compD.data, disp = T.disp;
    const V = this.fogOn() ? vis(S, this.side) : null;
    const own = S.owner;
    for (let p = 0; p < W * H; p++) {
      const j = p * 4, h = disp[p];
      let r = base[j], g = base[j + 1], b = base[j + 2];
      if (h >= 0) {
        const o = own[h], t = TINT[o];
        if (t) {
          const a = TA[o];
          r += (t[0] - r) * a;
          g += (t[1] - g) * a;
          b += (t[2] - b) * a;
        }
        if (T.edge[p]) (r *= 0.9), (g *= 0.9), (b *= 0.9);
      }
      if (dec[j + 3]) (r = dec[j]), (g = dec[j + 1]), (b = dec[j + 2]);
      if (h >= 0) {
        // линия фронта: пиксель у соседа другого владельца
        const x = p % W;
        const nb = (q) => q >= 0 && q < W * H && disp[q] >= 0 && own[disp[q]] !== own[h];
        if (nb(p + 1) && x < W - 1 || nb(p - 1) && x > 0 || nb(p + W) || nb(p - W)) (r = BORDER[0] * 0.6 + r * 0.4), (g = BORDER[1] * 0.6 + g * 0.4), (b = BORDER[2] * 0.6 + b * 0.4);
        if (V && !V[h]) {
          const l = (r + g + b) / 3;
          r = (r * 0.55 + l * 0.45) * 0.66;
          g = (g * 0.55 + l * 0.45) * 0.66;
          b = (b * 0.55 + l * 0.45) * 0.7;
        }
      } else if (V) (r *= 0.8), (g *= 0.8), (b *= 0.85);
      D[j] = r;
      D[j + 1] = g;
      D[j + 2] = b;
      D[j + 3] = 255;
    }
    this.compX.putImageData(this.compD, 0, 0);
  }
  fogOn() {
    return this.S && !this.S.over && this.ov.fog !== false;
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
      if (t >= 1) (this.pan = null), p.res();
      else more = true;
    }
    const S = this.S, x = this.cx, s = this.s, W = this.cv.width, H = this.cv.height;
    x.setTransform(1, 0, 0, 1, 0, 0);
    x.fillStyle = '#28567f';
    x.fillRect(0, 0, W, H);
    if (!S) return;
    const key = `${S.ver}|${this.side}|${this.fogOn() ? 1 : 0}`;
    if (key !== this.ownKey) (this.ownKey = key), this.rebuild();
    x.imageSmoothingEnabled = false;
    x.drawImage(this.comp, -this.ox * s, -this.oy * s, this.T.W * s, this.T.H * s);
    this.drawOverlays();
    this.drawLabels();
    this.drawUnits(now);
    this.drawArrows();
    if (this.drawFx(now)) more = true;
    if (this.anim.size) more = true;
    if (more) this.req();
  }
  hexPath(h, k = 1) {
    const [cx, cy] = this.hexXYs(h), R = this.M.g.R * this.s * k, x = this.cx;
    x.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = ((60 * i - 30) * Math.PI) / 180, px = cx + R * Math.cos(a), py = cy + R * Math.sin(a);
      i ? x.lineTo(px, py) : x.moveTo(px, py);
    }
    x.closePath();
  }
  corner(h, i, k = 1) {
    const [cx, cy] = this.hexXYs(h), R = this.M.g.R * this.s * k, a = ((60 * i - 30) * Math.PI) / 180;
    return [cx + R * Math.cos(a), cy + R * Math.sin(a)];
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
  drawOverlays() {
    const o = this.ov, x = this.cx, d = this.dpr, S = this.S;
    if (o.supply) {
      const sup = supplyMap(S, this.side), bad = new Set();
      for (let h = 0; h < this.M.N; h++) if (this.M.land(h) && S.owner[h] === OWN[this.side] && !sup[h]) bad.add(h);
      for (const h of bad) {
        this.hexPath(h, 0.98);
        x.fillStyle = 'rgba(224,60,40,0.28)';
        x.fill();
      }
      if (bad.size) this.outline(bad, 'rgba(255,90,70,0.95)', 2 * d, [5 * d, 4 * d]);
    }
    if (o.pockets) for (const p of o.pockets) this.outline(new Set(p.hexes), p.side === this.side ? 'rgba(255,120,90,0.9)' : 'rgba(255,214,90,0.95)', 2.5 * d, [6 * d, 4 * d]);
    if (o.reach) {
      for (const h of o.reach) {
        this.hexPath(h, 0.96);
        x.fillStyle = 'rgba(255,248,220,0.22)';
        x.fill();
      }
      this.outline(new Set([...o.reach, ...(o.sel >= 0 ? [o.sel] : [])]), 'rgba(255,244,200,0.75)', 1.5 * d);
    }
    if (o.path && o.path.length > 1) {
      x.beginPath();
      o.path.forEach((h, i) => {
        const [px, py] = this.hexXYs(h);
        i ? x.lineTo(px, py) : x.moveTo(px, py);
      });
      x.strokeStyle = 'rgba(255,236,170,0.9)';
      x.lineWidth = 3 * d;
      x.setLineDash([2 * d, 5 * d]);
      x.lineCap = 'round';
      x.stroke();
      x.setLineDash([]);
    }
    if (o.goals) for (const h of o.goals) this.star(h);
    const ring = (set, col, w, k = 0.9) => {
      if (!set) return;
      for (const h of set) {
        this.hexPath(h, k);
        x.strokeStyle = col;
        x.lineWidth = w;
        x.stroke();
      }
    };
    ring(o.air, 'rgba(120,200,255,0.95)', 3 * d);
    ring(o.atk, 'rgba(255,80,60,0.95)', 3 * d);
    if (o.tgt >= 0) {
      this.hexPath(o.tgt, 0.94);
      x.fillStyle = 'rgba(255,70,50,0.22)';
      x.fill();
      x.strokeStyle = '#ffd34a';
      x.lineWidth = 3.5 * d;
      x.stroke();
    }
    if (o.sel >= 0) {
      this.hexPath(o.sel, 0.94);
      x.strokeStyle = '#ffd34a';
      x.lineWidth = 3.5 * d;
      x.stroke();
    }
    if (o.flash >= 0) {
      const t = (performance.now() / 300) % 2, a = 0.45 + 0.4 * Math.abs(1 - t);
      this.hexPath(o.flash, 0.92);
      x.strokeStyle = `rgba(255,220,90,${a})`;
      x.lineWidth = 4 * d;
      x.stroke();
      this.req();
    }
  }
  star(h) {
    const [cx, cy] = this.hexXYs(h), x = this.cx, r = Math.max(5, 3.2 * this.s), y = cy - this.M.g.R * this.s * 0.62;
    x.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.45 : r;
      x.lineTo(cx + 9 * this.s * 0 + rr * Math.cos(a), y + rr * Math.sin(a));
    }
    x.closePath();
    x.fillStyle = '#ffd34a';
    x.strokeStyle = '#2a1e06';
    x.lineWidth = Math.max(1.5, this.dpr * 1.2);
    x.fill();
    x.stroke();
  }
  drawLabels() {
    const x = this.cx, s = this.s, d = this.dpr, big = s >= 3 * d * 0.9;
    const fs = Math.round(Math.max(10, Math.min(15, 2.4 * s / d + 3)) * d);
    x.font = FONT(fs, 600);
    x.textAlign = 'center';
    x.textBaseline = 'top';
    x.lineJoin = 'round';
    for (const c of this.M.cities) {
      if (c.vp < 2 && !big) continue;
      const [cx, cy] = this.hexXYs(c.hex), y = cy + this.M.g.R * s * 0.6;
      if (cx < -80 * d || cx > this.cv.width + 80 * d || y < -20 * d || y > this.cv.height + 20 * d) continue;
      x.lineWidth = 3.2 * d;
      x.strokeStyle = 'rgba(16,12,10,0.88)';
      x.strokeText(c.name, cx, y);
      x.fillStyle = c.vp >= 3 ? '#fff4cf' : '#f1ecdf';
      x.fillText(c.name, cx, y);
    }
  }
  unitPos(u) {
    const a = this.anim.get(u.id);
    if (a) return [(a.x - this.ox) * this.s, (a.y - this.oy) * this.s];
    return this.hexXYs(u.c);
  }
  drawUnits() {
    const S = this.S, x = this.cx, s = this.s, V = this.fogOn() ? vis(S, this.side) : null, sup = { GER: supplyMap(S, 'GER'), SOV: supplyMap(S, 'SOV') };
    const w = CW * s, h = CH * s, vw = this.cv.width, vh = this.cv.height;
    x.imageSmoothingEnabled = false;
    const list = [];
    for (const u of S.units) {
      if (!alive(u) || u.c < 0 || this.hide.has(u.id)) continue;
      if (u.side !== this.side && V && !V[u.c] && !this.anim.has(u.id)) continue;
      list.push(u);
    }
    // движущаяся — поверх
    list.sort((a, b) => (this.anim.has(a.id) ? 1 : 0) - (this.anim.has(b.id) ? 1 : 0));
    for (const u of list) {
      const [cx, cy] = this.unitPos(u), X = Math.round(cx - w / 2), Y = Math.round(cy - h / 2);
      if (X > vw || Y > vh || X + w < 0 || Y + h < 0) continue;
      const k = u.org / orgMax(u), cut = !sup[u.side][u.c];
      x.drawImage(counter(u, k, cut, lvl(u.xp)), X, Y, w, h);
      if (u.cmd && u.side === this.side && S.ph === this.side && this.ov.turn && u.mp <= 0 && !canAttack(S, u)) {
        x.fillStyle = 'rgba(10,12,14,0.42)';
        x.fillRect(X, Y, w, h);
      }
      if (u.ent > 0 && !this.anim.has(u.id)) {
        // окопы: тёмные зубцы под фишкой
        x.fillStyle = '#2a2018';
        for (let i = 0; i < 3 + u.ent; i++) x.fillRect(X + (2 + i * 4) * s * 0.78, Y + h, 2 * s, Math.max(1, s * 0.9));
      }
      if (u.prep && u.side === this.side) {
        x.fillStyle = '#ffd34a';
        x.fillRect(X + w - 3 * s, Y - 2 * s, 3 * s, 3 * s);
      }
    }
  }
  drawArrows() {
    const o = this.ov, x = this.cx, d = this.dpr;
    const arrow = (a, b, col, w, dash) => {
      const [x0, y0] = this.hexXYs(a), [x1, y1] = this.hexXYs(b), ang = Math.atan2(y1 - y0, x1 - x0), L = Math.hypot(x1 - x0, y1 - y0);
      if (L < 4) return;
      const sh = this.M.g.R * this.s * 0.45, ex = x1 - Math.cos(ang) * sh, ey = y1 - Math.sin(ang) * sh, sx = x0 + Math.cos(ang) * sh * 0.6, sy = y0 + Math.sin(ang) * sh * 0.6;
      x.beginPath();
      x.moveTo(sx, sy);
      x.lineTo(ex, ey);
      x.strokeStyle = 'rgba(10,8,6,0.75)';
      x.lineWidth = w + 3 * d;
      x.setLineDash(dash || []);
      x.lineCap = 'round';
      x.stroke();
      x.strokeStyle = col;
      x.lineWidth = w;
      x.stroke();
      x.setLineDash([]);
      const hs = Math.max(8 * d, w * 2.6);
      x.beginPath();
      x.moveTo(ex + Math.cos(ang) * hs * 0.6, ey + Math.sin(ang) * hs * 0.6);
      x.lineTo(ex + Math.cos(ang + 2.5) * hs, ey + Math.sin(ang + 2.5) * hs);
      x.lineTo(ex + Math.cos(ang - 2.5) * hs, ey + Math.sin(ang - 2.5) * hs);
      x.closePath();
      x.fillStyle = col;
      x.strokeStyle = 'rgba(10,8,6,0.75)';
      x.lineWidth = 1.5 * d;
      x.fill();
      x.stroke();
    };
    if (o.recon) for (const r of o.recon) arrow(r.from, r.to, r.k === 'atk' ? '#ff6a50' : '#ffb39a', (r.mech ? 4 : 3) * d, r.k === 'atk' ? null : [7 * d, 5 * d]);
    if (o.adv) for (const r of o.adv) arrow(r.from, r.to, r.k === 'atk' ? '#ffd34a' : '#fff0b0', 4 * d, r.k === 'atk' ? null : [8 * d, 5 * d]);
  }
  // ——— эффекты ———
  fx(k, h, o = {}) {
    const [x, y] = hexXY(this.M.g, h);
    const f = { k, h, x, y, t0: performance.now(), dur: o.dur || (k === 'plane' ? 900 : k === 'text' ? 1400 : k === 'ring' ? 1100 : 650), ...o };
    if (k === 'plane') {
      const side = o.side || 'GER';
      f.x0 = x + (side === 'GER' ? -90 : 90);
      f.y0 = y - 60;
    }
    this.fxs.push(f);
    this.req();
    return new Promise((res) => (f.res = res));
  }
  drawFx(now) {
    if (!this.fxs.length) return false;
    const x = this.cx, s = this.s, d = this.dpr;
    const keep = [];
    for (const f of this.fxs) {
      const t = (now - f.t0) / f.dur;
      if (t >= 1) {
        f.res?.();
        continue;
      }
      keep.push(f);
      const sx = (f.x - this.ox) * s, sy = (f.y - this.oy) * s;
      if (f.k === 'boom') {
        const n = 9, R = (4 + 14 * t) * s;
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2 + hash(f.h, i, 3) * 0.8, rr = R * (0.5 + 0.5 * hash(f.h, i, 4)), sz = Math.max(2, (4 - 3 * t) * s);
          x.fillStyle = t < 0.3 ? '#fff2b0' : t < 0.6 ? '#ffb040' : '#9a4a2a';
          x.globalAlpha = 1 - t * 0.85;
          x.fillRect(sx + Math.cos(a) * rr - sz / 2, sy + Math.sin(a) * rr - sz / 2, sz, sz);
        }
        x.globalAlpha = Math.max(0, 0.6 - t);
        x.fillStyle = '#ffe080';
        x.fillRect(sx - 3 * s, sy - 3 * s, 6 * s, 6 * s);
        x.globalAlpha = 1;
      } else if (f.k === 'plane') {
        const e = Math.min(1, t * 1.25), px = ((f.x0 + (f.x - f.x0) * e) - this.ox) * s, py = ((f.y0 + (f.y - f.y0) * e) - this.oy) * s;
        const dir = f.x > f.x0 ? 1 : -1;
        x.fillStyle = f.side === 'SOV' ? '#a33a2c' : '#4a5058';
        x.fillRect(px - 6 * s, py - 1 * s, 12 * s, 2 * s);
        x.fillRect(px - 1 * s, py - 5 * s, 2 * s, 10 * s);
        x.fillRect(px - dir * 6 * s, py - 3 * s, 1.5 * s, 6 * s);
        x.fillStyle = '#e8e2d0';
        x.fillRect(px + dir * 5 * s, py - 0.5 * s, 1.5 * s, 1 * s);
      } else if (f.k === 'text') {
        const y = sy - (8 + 14 * t) * s;
        x.globalAlpha = t < 0.75 ? 1 : (1 - t) * 4;
        x.font = FONT(Math.round(15 * d), 800);
        x.textAlign = 'center';
        x.textBaseline = 'middle';
        x.lineWidth = 4 * d;
        x.strokeStyle = '#0c0a08';
        x.strokeText(f.txt, sx, y);
        x.fillStyle = f.col || '#ffe9a0';
        x.fillText(f.txt, sx, y);
        x.globalAlpha = 1;
      } else if (f.k === 'ring') {
        x.beginPath();
        x.arc(sx, sy, (6 + 22 * t) * s, 0, Math.PI * 2);
        x.strokeStyle = f.col || '#ffd34a';
        x.globalAlpha = 1 - t;
        x.lineWidth = 3 * d;
        x.stroke();
        x.globalAlpha = 1;
      }
    }
    this.fxs = keep;
    return keep.length > 0;
  }
  // марш дивизии по пути (гексы), ms — на гекс
  animateMove(u, path, ms = 110) {
    if (!path || path.length < 2) return Promise.resolve();
    const pts = path.map((h) => hexXY(this.M.g, h)), t0 = performance.now(), dur = ms * (path.length - 1);
    const a = { x: pts[0][0], y: pts[0][1] };
    this.anim.set(u.id, a);
    this.req();
    return new Promise((res) => {
      const step = () => {
        const t = Math.min(1, (performance.now() - t0) / dur), f = t * (path.length - 1), i = Math.min(path.length - 2, Math.floor(f)), r = f - i;
        a.x = pts[i][0] + (pts[i + 1][0] - pts[i][0]) * r;
        a.y = pts[i][1] + (pts[i + 1][1] - pts[i][1]) * r;
        this.req();
        if (t >= 1) {
          this.anim.delete(u.id);
          this.req();
          res();
        } else requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
  }
  destroy() {
    this.ro?.disconnect();
    this.paused = 1;
  }
}
export { NAT, TYPES };
