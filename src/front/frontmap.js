// «Карта фронта»: пиксельная карта Восточного фронта на холсте — панорама и зум (мышь, колесо, пальцы),
// города, маркеры операций карьеры со звёздами, стрелки ударов и анимация сдвига линии фронта.
import B from '../data/front_base.json';
import { frontBase, frontOwners, frontBaseRGB, frontComposite } from './render.js';
import { FRONT_STAGES, FRONT_CITIES, FRONT_OPS } from './stages.js';

let F0 = null, RGB0 = null;
export function frontData() {
  if (!F0) ((F0 = frontBase(B)), (RGB0 = frontBaseRGB(F0)));
  return { F: F0, rgb: RGB0 };
}
// Владельцы пикселей для этапа si с поправкой по итогу операции op (kind: ahead|behind|null)
export const frontState = (si, op, kind) => frontOwners(frontData().F, si, op || null, kind || null);
export const FRONT_N = FRONT_STAGES.length;

const STAR = [`...#...`, `..###..`, `#######`, `.#####.`, `..###..`, `.##.##.`, `.#...#.`];
const SEA = `#22476a`;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ease = (p) => (p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2);

export class FrontMap {
  constructor(cv, o = {}) {
    const { F, rgb } = frontData();
    this.cv = cv;
    this.ctx = cv.getContext(`2d`);
    this.F = F;
    this.rgb = rgb;
    this.o = o;
    this.off = document.createElement(`canvas`);
    this.off.width = F.w;
    this.off.height = F.h;
    this.octx = this.off.getContext(`2d`);
    this.img = this.octx.createImageData(F.w, F.h);
    this.cx = F.w / 2;
    this.cy = F.h / 2;
    this.z = 2;
    this.inset = { l: 0, t: 0, r: 0, b: 0 };
    this.marks = [];
    this.arrows = [];
    this.arrowT = 0;
    this.anim = null;
    this.cam = null;
    this.ptr = new Map();
    this.moved = 0;
    this.dirty = 1;
    this.last = 0;
    this.cities = FRONT_CITIES.map(([n, lo, la, r]) => {
      const [x, y] = F.pr(lo, la);
      return { n, x, y, r };
    });
    this.bind();
    this.resize();
    const loop = (t) => {
      if (this.dead) return;
      this.frame(t);
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
    document.fonts?.load?.(`500 12px Rubik`).then(() => ((this.fontOk = 1), (this.dirty = 1))).catch(() => {});
  }
  destroy() {
    this.dead = 1;
    cancelAnimationFrame(this.raf);
    const c = this.cv, h = this.h;
    c.removeEventListener(`pointerdown`, h.down);
    c.removeEventListener(`pointermove`, h.move);
    c.removeEventListener(`pointerup`, h.up);
    c.removeEventListener(`pointercancel`, h.up);
    c.removeEventListener(`wheel`, h.wheel);
    c.removeEventListener(`touchend`, h.touchend);
    window.removeEventListener(`resize`, h.resize);
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
    this.h = {
      down: (e) => {
        try {
          c.setPointerCapture(e.pointerId);
        } catch {}
        const [x, y] = pt(e);
        this.ptr.set(e.pointerId, { x, y });
        this.cam = null;
        this.moved = this.ptr.size > 1 ? 99 : 0;
        this.pz = this.ptr.size === 2 ? pinch() : null;
      },
      move: (e) => {
        const p = this.ptr.get(e.pointerId);
        if (!p) return;
        const [x, y] = pt(e), dx = x - p.x, dy = y - p.y;
        ((p.x = x), (p.y = y));
        if (this.ptr.size === 1) {
          this.moved += Math.abs(dx) + Math.abs(dy);
          this.moved > 6 && ((this.cx -= dx / this.z), (this.cy -= dy / this.z), this.clamp());
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
      up: (e) => {
        const p = this.ptr.get(e.pointerId);
        this.ptr.delete(e.pointerId);
        p && e.type === `pointerup` && this.ptr.size === 0 && this.moved <= 6 && this.tap(p.x, p.y);
        this.pz = this.ptr.size === 2 ? pinch() : null;
      },
      wheel: (e) => {
        e.preventDefault();
        this.cam = null;
        const [x, y] = pt(e);
        this.zoomAt(x, y, Math.exp(-clamp(e.deltaY, -120, 120) * 0.0022));
      },
      resize: () => this.resize(),
      // без «призрачного» click по кнопкам, появившимся под пальцем после касания карты
      touchend: (e) => e.cancelable && e.preventDefault(),
    };
    c.addEventListener(`touchend`, this.h.touchend, { passive: false });
    c.addEventListener(`pointerdown`, this.h.down);
    c.addEventListener(`pointermove`, this.h.move);
    c.addEventListener(`pointerup`, this.h.up);
    c.addEventListener(`pointercancel`, this.h.up);
    c.addEventListener(`wheel`, this.h.wheel, { passive: false });
    window.addEventListener(`resize`, this.h.resize);
  }
  tap(x, y) {
    let best = null, bd = 26;
    for (const m of this.marks) {
      const [sx, sy] = this.toScr(m.x, m.y), d = Math.hypot(sx - x, sy - y);
      d < bd && ((bd = d), (best = m));
    }
    best && this.o.onMark?.(best);
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
    this.inset = { l, t, r, b };
    this.clamp();
    this.dirty = 1;
  }
  free() {
    const { l, t, r, b } = this.inset;
    const fw = Math.max(60, this.W - l - r), fh = Math.max(60, this.H - t - b);
    return { fw, fh, vx: l + fw / 2, vy: t + fh / 2 };
  }
  minZ() {
    const { fw, fh } = this.free();
    return Math.min(fw / this.F.w, fh / this.F.h);
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
    this.z = clamp(this.z * f, this.minZ(), 9);
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
    const { F } = this, { fw, fh } = this.free();
    this.z = clamp(this.z, this.minZ(), 9);
    const hw = fw / 2 / this.z, hh = fh / 2 / this.z;
    this.cx = F.w <= 2 * hw ? F.w / 2 : clamp(this.cx, hw, F.w - hw);
    this.cy = F.h <= 2 * hh ? F.h / 2 : clamp(this.cy, hh, F.h - hh);
    this.dirty = 1;
  }
  // Вписать прямоугольник карты [x0,y0,x1,y1]; ms > 0 — плавный перелёт
  fit(bb, maxZ = 4, ms = 0) {
    const { fw, fh } = this.free();
    const z = clamp(Math.min(fw / Math.max(8, bb[2] - bb[0]), fh / Math.max(8, bb[3] - bb[1])), this.minZ(), maxZ);
    const to = { cx: (bb[0] + bb[2]) / 2, cy: (bb[1] + bb[3]) / 2, z };
    if (!ms) return (Object.assign(this, to), this.clamp());
    this.cam = { from: { cx: this.cx, cy: this.cy, z: this.z }, to, t0: performance.now(), ms };
  }
  bbAround(pts, pad = 14, minW = 120, minH = 90) {
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const [x, y] of pts) ((x0 = Math.min(x0, x)), (y0 = Math.min(y0, y)), (x1 = Math.max(x1, x)), (y1 = Math.max(y1, y)));
    if (x0 > x1) return [0, 0, this.F.w, this.F.h];
    ((x0 -= pad), (x1 += pad), (y0 -= pad), (y1 += pad));
    const ex = Math.max(0, minW - (x1 - x0)) / 2, ey = Math.max(0, minH - (y1 - y0)) / 2;
    return [x0 - ex, y0 - ey, x1 + ex, y1 + ey];
  }
  // ——— содержимое ———
  pr(lon, lat) {
    return this.F.pr(lon, lat);
  }
  setOwners(own) {
    this.anim = null;
    this.own = own;
    this.compose(own);
  }
  compose(own) {
    frontComposite(this.F, this.rgb, own, this.img.data);
    this.octx.putImageData(this.img, 0, 0);
    this.dirty = 1;
  }
  // m: [{id, x, y, num, stars, st: done|next|choice|sel|skip, label}]
  setMarks(m) {
    this.marks = m;
    this.dirty = 1;
  }
  setArrows(ids) {
    this.arrows = [];
    for (const id of ids || []) for (const a of FRONT_OPS[id]?.arrows || []) this.arrows.push({ side: a.side, p: a.p.map(([lo, la]) => this.F.pr(lo, la)) });
    this.arrowT = performance.now();
    this.dirty = 1;
  }
  // Пиксели, сменившие владельца
  changed(a, b) {
    const r = [];
    for (let i = 0; i < a.length; i++) a[i] !== b[i] && r.push(i);
    return r;
  }
  // Волна сдвига фронта: территория «перетекает» от стороны, которая её получает
  transition(from, to, { delay = 350, done } = {}) {
    const { F } = this, { w, n } = F, ch = this.changed(from, to);
    if (!ch.length) return (this.setOwners(to), done?.(), 0);
    const isCh = new Uint8Array(n), dist = new Int32Array(n).fill(-1), q = [];
    for (const i of ch) isCh[i] = 1;
    const nb = (i, f) => {
      const x = i % w;
      x > 0 && f(i - 1);
      x < w - 1 && f(i + 1);
      i >= w && f(i - w);
      i + w < n && f(i + w);
    };
    for (const i of ch) {
      let s = 0;
      nb(i, (j) => !isCh[j] && from[j] === to[i] && (s = 1));
      s && ((dist[i] = 0), q.push(i));
    }
    for (let k = 0; k < q.length; k++) {
      const i = q[k];
      nb(i, (j) => isCh[j] && dist[j] < 0 && to[j] === to[i] && ((dist[j] = dist[i] + 1), q.push(j)));
    }
    const maxD = q.length ? dist[q[q.length - 1]] : 0;
    for (const i of ch) dist[i] < 0 && (dist[i] = Math.round(maxD * 0.6));
    const order = ch.sort((a, b) => dist[a] - dist[b]);
    this.own = from;
    this.compose(from);
    this.anim = {
      from, to, order, dist, maxD, k: 0, kf: 0,
      cur: from.slice(), ft: new Float64Array(order.length),
      t0: performance.now() + delay, ms: clamp(maxD * 16, 1100, 2600), done,
    };
    return this.anim.ms + delay;
  }
  skipAnim() {
    const a = this.anim;
    a && (this.setOwners(a.to), a.done?.());
  }
  changedBox(from, to) {
    const { w } = this.F, ch = this.changed(from, to);
    return ch.map((i) => [i % w, (i / w) | 0]);
  }
  stepAnim(t) {
    const a = this.anim;
    if (t < a.t0) return;
    const p = clamp((t - a.t0) / a.ms, 0, 1), thr = ease(p) * (a.maxD + 0.999);
    while (a.k < a.order.length && a.dist[a.order[a.k]] <= thr) {
      const i = a.order[a.k];
      a.cur[i] = a.to[i];
      a.ft[a.k++] = t;
    }
    while (a.kf < a.k && t - a.ft[a.kf] > 300) a.kf++;
    frontComposite(this.F, this.rgb, a.cur, this.img.data);
    // вспышка на только что сменивших владельца пикселях
    const d = this.img.data;
    for (let k = a.kf; k < a.k; k++) {
      const i = a.order[k], f = (1 - (t - a.ft[k]) / 300) * 0.72, o = i * 4;
      const [r, g, b] = a.to[i] === 1 ? [255, 214, 92] : a.to[i] === 2 ? [178, 34, 26] : [240, 232, 200];
      d[o] += (r - d[o]) * f;
      d[o + 1] += (g - d[o + 1]) * f;
      d[o + 2] += (b - d[o + 2]) * f;
    }
    this.octx.putImageData(this.img, 0, 0);
    this.dirty = 1;
    if (p >= 1 && a.kf >= a.k) {
      this.anim = null;
      this.own = a.to;
      this.compose(a.to);
      a.done?.();
    }
  }
  // ——— кадр ———
  frame(t) {
    if (this.cam) {
      const c = this.cam, p = ease(clamp((t - c.t0) / c.ms, 0, 1));
      this.z = c.from.z + (c.to.z - c.from.z) * p;
      this.cx = c.from.cx + (c.to.cx - c.from.cx) * p;
      this.cy = c.from.cy + (c.to.cy - c.from.cy) * p;
      this.clamp();
      p >= 1 && (this.cam = null);
    }
    this.anim && this.stepAnim(t);
    const pulse = this.marks.some((m) => m.st === `next` || m.st === `choice` || m.st === `sel`);
    const grow = t - this.arrowT < 900 && this.arrows.length;
    if (!this.dirty && !grow && !(pulse && t - this.last > 40)) return;
    this.dirty = 0;
    this.last = t;
    this.draw(t);
  }
  draw(t) {
    const { ctx, F, z } = this;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.fillStyle = SEA;
    ctx.fillRect(0, 0, this.W, this.H);
    ctx.imageSmoothingEnabled = false;
    const [ox, oy] = this.toScr(0, 0);
    ctx.drawImage(this.off, ox, oy, F.w * z, F.h * z);
    this.drawArrows(t);
    // подписи городов — в кэш-слой, пока камера стоит
    const key = `${this.W}|${this.H}|${this.dpr}|${z.toFixed(4)}|${this.cx.toFixed(3)}|${this.cy.toFixed(3)}|${this.marks.length}|${this.fontOk ? 1 : 0}`;
    if (key !== this.labKey) {
      this.labKey = key;
      const L = this.lab || (this.lab = document.createElement(`canvas`));
      (L.width !== this.cv.width || L.height !== this.cv.height) && ((L.width = this.cv.width), (L.height = this.cv.height));
      const lc = L.getContext(`2d`);
      lc.setTransform(1, 0, 0, 1, 0, 0);
      lc.clearRect(0, 0, L.width, L.height);
      lc.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      this.drawCities(lc);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(this.lab, 0, 0);
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.drawMarks(t);
  }
  drawArrows(t) {
    const { ctx } = this, k = clamp((t - this.arrowT) / 900, 0, 1), lw = clamp(this.z * 1.25, 3, 9);
    for (const a of this.arrows) {
      const pts = a.p.map(([x, y]) => this.toScr(x, y));
      let L = 0;
      for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
      let left = L * ease(k);
      const path = [pts[0]];
      for (let i = 1; i < pts.length && left > 0; i++) {
        const [x0, y0] = pts[i - 1], [x1, y1] = pts[i], s = Math.hypot(x1 - x0, y1 - y0);
        if (s <= left) (path.push(pts[i]), (left -= s));
        else (path.push([x0 + ((x1 - x0) * left) / s, y0 + ((y1 - y0) * left) / s]), (left = 0));
      }
      if (path.length < 2) continue;
      const [fc, sc] = a.side === `sov` ? [`#e3342a`, `#3d0a06`] : [`#3d6fd6`, `#0b1838`];
      const [ex, ey] = path[path.length - 1], [px, py] = path[path.length - 2];
      const ang = Math.atan2(ey - py, ex - px), hl = lw * 2.3, hw = lw * 1.7;
      const bx = ex - Math.cos(ang) * hl * 0.8, by = ey - Math.sin(ang) * hl * 0.8;
      const body = () => {
        ctx.beginPath();
        ctx.moveTo(path[0][0], path[0][1]);
        for (let i = 1; i < path.length - 1; i++) ctx.lineTo(path[i][0], path[i][1]);
        ctx.lineTo(bx, by);
      };
      const head = () => {
        ctx.beginPath();
        ctx.moveTo(ex + Math.cos(ang) * hl * 0.2, ey + Math.sin(ang) * hl * 0.2);
        ctx.lineTo(bx + Math.cos(ang + Math.PI / 2) * hw - Math.cos(ang) * hl * 0.3, by + Math.sin(ang + Math.PI / 2) * hw - Math.sin(ang) * hl * 0.3);
        ctx.lineTo(bx + Math.cos(ang - Math.PI / 2) * hw - Math.cos(ang) * hl * 0.3, by + Math.sin(ang - Math.PI / 2) * hw - Math.sin(ang) * hl * 0.3);
        ctx.closePath();
      };
      ctx.lineJoin = `round`;
      ctx.lineCap = `round`;
      ctx.strokeStyle = sc;
      ctx.lineWidth = lw + 3;
      body();
      ctx.stroke();
      ctx.fillStyle = sc;
      head();
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.strokeStyle = fc;
      ctx.lineWidth = lw;
      body();
      ctx.stroke();
      ctx.fillStyle = fc;
      head();
      ctx.fill();
    }
  }
  drawCities(ctx) {
    const { z } = this, minR = z >= 2.7 ? 1 : z >= 1.6 ? 2 : 3;
    const boxes = [];
    ctx.font = `600 13px Rubik, sans-serif`;
    for (const m of this.marks) {
      const [x, y] = this.toScr(m.x, m.y), hot = m.st === `next` || m.st === `choice` || m.st === `sel`;
      boxes.push([x - 14, y - 14, x + 14, y + 22]);
      if (m.label && (hot || z >= 2.2)) {
        const tw = ctx.measureText(m.label).width;
        boxes.push([x - tw / 2 - 6, y - 32, x + tw / 2 + 6, y - 12]);
      }
    }
    const nm = boxes.length;
    const hit = (b, r) => boxes.some((c, i) => (r < 3 || i >= nm) && b[0] < c[2] && b[2] > c[0] && b[1] < c[3] && b[3] > c[1]);
    ctx.textBaseline = `middle`;
    ctx.lineJoin = `round`;
    const list = this.cities.filter((c) => c.r >= minR).sort((a, b) => b.r - a.r);
    for (const c of list) {
      const [x, y] = this.toScr(c.x, c.y);
      if (x < -60 || y < -20 || x > this.W + 60 || y > this.H + 20) continue;
      const fs = c.r >= 3 ? 13 : 11;
      ctx.font = `500 ${fs}px Rubik, sans-serif`;
      const tw = ctx.measureText(c.n).width, d = c.r >= 3 ? 5 : 4;
      const b = [x - d / 2 - 1, y - fs / 2 - 1, x + d / 2 + 4 + tw + 2, y + fs / 2 + 1];
      if (hit(b, c.r)) continue;
      boxes.push(b);
      ctx.fillStyle = `#111`;
      ctx.fillRect(Math.round(x - d / 2) - 1, Math.round(y - d / 2) - 1, d + 2, d + 2);
      ctx.fillStyle = c.r >= 3 ? `#ffe7a0` : `#f2f2ee`;
      ctx.fillRect(Math.round(x - d / 2), Math.round(y - d / 2), d, d);
      ctx.strokeStyle = `rgba(10,12,14,.92)`;
      ctx.lineWidth = 3;
      ctx.strokeText(c.n, x + d / 2 + 3, y + 0.5);
      ctx.fillStyle = c.r >= 3 ? `#ffe7a0` : `#f4f4f0`;
      ctx.fillText(c.n, x + d / 2 + 3, y + 0.5);
    }
  }
  star(x, y, s, on) {
    const { ctx } = this;
    ctx.fillStyle = `#120f08`;
    ctx.fillRect(x - s, y - s, 9 * s, 9 * s);
    ctx.fillStyle = on ? `#ffd34d` : `#5a5f66`;
    for (let r = 0; r < 7; r++) for (let c = 0; c < 7; c++) STAR[r][c] === `#` && ctx.fillRect(x + c * s, y + r * s, s, s);
  }
  drawMarks(t) {
    const { ctx } = this;
    for (const m of this.marks) {
      const [x0, y0] = this.toScr(m.x, m.y), x = Math.round(x0), y = Math.round(y0);
      const hot = m.st === `next` || m.st === `choice` || m.st === `sel`;
      if (hot) {
        const ph = ((t / 1400) % 1 + (m.ph || 0)) % 1;
        ctx.strokeStyle = `rgba(255,211,77,${(1 - ph) * 0.9})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(x, y, 12 + ph * 16, 0, Math.PI * 2);
        ctx.stroke();
        if (m.st === `sel`) {
          ctx.strokeStyle = `#ffd34d`;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(x, y, 15, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
      const sz = 18, gold = hot || m.st === `done`;
      ctx.fillStyle = `#0b0d0f`;
      ctx.fillRect(x - sz / 2 - 2, y - sz / 2 - 2, sz + 4, sz + 4);
      ctx.fillStyle = m.st === `next` || m.st === `sel` ? `#d9b44a` : m.st === `choice` ? `#b8963a` : m.st === `skip` ? `#3a3f46` : `#2a3038`;
      ctx.fillRect(x - sz / 2, y - sz / 2, sz, sz);
      ctx.fillStyle = gold ? `#f3e3b0` : `#7b838c`;
      ctx.fillRect(x - sz / 2, y - sz / 2, sz, 2);
      ctx.font = `600 13px Rubik, sans-serif`;
      ctx.textAlign = `center`;
      ctx.textBaseline = `middle`;
      ctx.fillStyle = m.st === `next` || m.st === `sel` || m.st === `choice` ? `#1d1606` : `#f3e3b0`;
      ctx.fillText(String(m.num), x, y + 1);
      ctx.textAlign = `left`;
      if (m.st === `done` || m.st === `skip`) for (let i = 0; i < 3; i++) this.star(x - 13 + i * 9, y + sz / 2 + 4, 1, i < (m.stars || 0));
      if (m.label && (hot || this.z >= 2.2)) {
        ctx.font = `600 13px Rubik, sans-serif`;
        const tw = ctx.measureText(m.label).width, lx = Math.round(x - tw / 2 - 5), ly = y - sz / 2 - 22;
        ctx.fillStyle = hot ? `rgba(29,22,6,.92)` : `rgba(11,13,15,.82)`;
        ctx.fillRect(lx, ly, tw + 10, 16);
        ctx.fillStyle = hot ? `#ffd34d` : `#e8e2cc`;
        ctx.fillText(m.label, lx + 5, ly + 8.5);
      }
    }
  }
}
