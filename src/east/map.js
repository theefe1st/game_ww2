// «Мировой фронт» v0.10, «Восточный фронт»: карта. Подложка — WebGL (gl.js: рельеф, области, реки, линия фронта),
// поверх — 2D-слой: города и подписи, фишки дивизий (знаки НАТО, цвет нации, полоска численности, число в стопке),
// «оловянные солдатики» при крупном масштабе, вспышки и стрелки боёв, флажки целей направлений, выделение.
// Жесты: перетаскивание, щипок, колесо мыши, касание (onTap), долгое касание (onLong). Без WebGL — 2D-запас (terrain.js).
import { GLMap } from './gl.js';
import { Terrain } from './terrain.js';
import { regionAt, ringPts, regionPath } from './mapdata.js';
import { sideOf, natOf, alive } from './engine.js';
import { NATC, TYPES } from './rules.js';
import { iconPath, iconSize } from './icons.js';

const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const SIDE_COL = { GER: [72, 84, 100], SOV: [178, 58, 44] };
const TYPE_RANK = { arm: 0, mot: 1, mtn: 2, inf: 3, cav: 4, sec: 5 };
const now = () => performance.now();

// ——— фишка и фигурки (рисуются в спрайты по нации и роду войск) ———
function rrect(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
function natoSymbol(c, t, x, y, w, h, col) {
  c.strokeStyle = col; c.fillStyle = col; c.lineWidth = Math.max(1, h * 0.12); c.lineCap = 'round';
  c.strokeRect(x, y, w, h);
  const X = () => { c.beginPath(); c.moveTo(x, y); c.lineTo(x + w, y + h); c.moveTo(x + w, y); c.lineTo(x, y + h); c.stroke(); };
  const oval = (k = 1) => { const ow = w * 0.62 * k, oh = h * 0.5 * k; rrect(c, x + (w - ow) / 2, y + (h - oh) / 2, ow, oh, oh / 2); c.stroke(); };
  if (t === 'inf') X();
  else if (t === 'arm') oval();
  else if (t === 'mot') { X(); oval(0.8); }
  else if (t === 'cav') { c.beginPath(); c.moveTo(x, y + h); c.lineTo(x + w, y); c.stroke(); }
  else if (t === 'mtn') { X(); c.beginPath(); c.moveTo(x + w / 2 - h * 0.28, y + h); c.lineTo(x + w / 2, y + h * 0.58); c.lineTo(x + w / 2 + h * 0.28, y + h); c.closePath(); c.fill(); }
  else { c.setLineDash([2, 2]); X(); c.setLineDash([]); }
}
// фишка: w×h CSS-пикселей; k — масштаб спрайта (dpr)
function drawCounter(c, nat, t, w, h) {
  const C = NATC[nat] || NATC.GER;
  // тень
  c.fillStyle = 'rgba(30,22,14,0.35)'; rrect(c, 1.2, 1.6, w - 1.2, h - 1.2, 2.6); c.fill();
  // корпус «игрушечной» фишки: светлый верх, тёмный низ
  const g = c.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, C.bg); g.addColorStop(1, shade(C.bg, -0.22));
  c.fillStyle = g; rrect(c, 0, 0, w - 1.2, h - 1.2, 2.6); c.fill();
  c.strokeStyle = C.bd; c.lineWidth = 1; rrect(c, 0.5, 0.5, w - 2.2, h - 2.2, 2.2); c.stroke();
  c.strokeStyle = 'rgba(255,255,255,0.35)'; c.beginPath(); c.moveTo(2.5, 1.6); c.lineTo(w - 4, 1.6); c.stroke();
  const sw = w * 0.56, sh = h * 0.46;
  natoSymbol(c, t, (w - 1.2 - sw) / 2, h * 0.16, sw, sh, C.fg);
}
function shade(hex, k) {
  const n = parseInt(hex.slice(1), 16);
  let r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  const f = (v) => Math.round(k < 0 ? v * (1 + k) : v + (255 - v) * k);
  return `rgb(${f(r)},${f(g)},${f(b)})`;
}
// оловянный солдатик / танк / грузовик / всадник: поле 24×24
function drawFigure(c, nat, t) {
  const C = NATC[nat] || NATC.GER, body = C.bg, dark = shade(C.bg, -0.45), lite = shade(C.bg, 0.35);
  c.lineJoin = 'round'; c.lineCap = 'round';
  // подставка
  c.fillStyle = 'rgba(30,22,14,0.35)'; c.beginPath(); c.ellipse(12.6, 21.4, 8.4, 2.6, 0, 0, 7); c.fill();
  c.fillStyle = dark; c.beginPath(); c.ellipse(12, 20.6, 7.6, 2.3, 0, 0, 7); c.fill();
  c.fillStyle = body; c.strokeStyle = dark; c.lineWidth = 1;
  const fs = () => { c.fill(); c.stroke(); };
  if (t === 'arm') {
    c.beginPath(); c.moveTo(3, 13.5); c.lineTo(21, 13.5); c.lineTo(19.5, 17); c.lineTo(4.5, 17); c.closePath(); fs();
    c.fillStyle = dark; rrect(c, 3.2, 16.2, 17.6, 3.6, 1.8); c.fill();
    c.fillStyle = lite; for (let i = 0; i < 5; i++) { c.beginPath(); c.arc(5.4 + i * 3.3, 18, 0.9, 0, 7); c.fill(); }
    c.fillStyle = body; rrect(c, 7.5, 9.2, 8.4, 4.8, 1.6); fs();
    c.fillStyle = dark; c.fillRect(15.6, 10.6, 6.6, 1.5);
    c.fillStyle = lite; c.fillRect(8.6, 10, 4, 1);
  } else if (t === 'mot') {
    c.beginPath(); rrect(c, 3, 10.5, 12, 6.5, 1); fs();
    c.beginPath(); c.moveTo(15, 17); c.lineTo(15, 11.5); c.lineTo(18.5, 11.5); c.lineTo(21, 14); c.lineTo(21, 17); c.closePath(); fs();
    c.fillStyle = lite; c.fillRect(16.2, 12.4, 2.2, 1.8);
    c.fillStyle = dark; for (const x of [6, 11, 18]) { c.beginPath(); c.arc(x, 18, 1.9, 0, 7); c.fill(); }
    c.fillStyle = lite; c.fillRect(4, 11.4, 9, 1);
  } else if (t === 'cav') {
    c.beginPath(); c.ellipse(11, 14, 6.2, 3, 0, 0, 7); fs();
    c.beginPath(); c.moveTo(15.5, 13); c.lineTo(19.5, 8.5); c.lineTo(21.2, 9.6); c.lineTo(18, 14.6); c.closePath(); fs();
    c.strokeStyle = dark; c.lineWidth = 1.5;
    for (const x of [6.6, 8.8, 13.4, 15.4]) { c.beginPath(); c.moveTo(x, 16); c.lineTo(x + (x < 10 ? -0.6 : 0.6), 20); c.stroke(); }
    c.lineWidth = 1; c.fillStyle = body;
    rrect(c, 9.4, 6.6, 3.6, 5.2, 1.2); fs();
    c.beginPath(); c.arc(11.2, 5, 1.9, 0, 7); fs();
  } else {
    // пехота (горные — с ледорубом, охранные — без винтовки)
    c.beginPath(); rrect(c, 9.4, 13.6, 2.4, 6.6, 0.8); fs();
    c.beginPath(); rrect(c, 12.2, 13.6, 2.4, 6.6, 0.8); fs();
    c.beginPath(); rrect(c, 8.6, 7.6, 6.8, 7, 2); fs();
    c.beginPath(); c.arc(12, 5.6, 2.5, 0, 7); fs();
    c.fillStyle = dark;
    if (nat === 'GER' || nat === 'HUN' || nat === 'ROM') { c.beginPath(); c.moveTo(9, 5.4); c.quadraticCurveTo(12, 1.2, 15, 5.4); c.lineTo(15.6, 6.4); c.lineTo(8.4, 6.4); c.closePath(); c.fill(); }
    else { c.beginPath(); c.arc(12, 5, 2.7, Math.PI, 0); c.closePath(); c.fill(); }
    c.fillStyle = lite; c.fillRect(9.8, 8.6, 1.4, 4);
    if (t !== 'sec') { c.strokeStyle = dark; c.lineWidth = 1.2; c.beginPath(); c.moveTo(16.6, 2.6); c.lineTo(15.6, 15.6); c.stroke(); }
    if (t === 'mtn') { c.strokeStyle = dark; c.lineWidth = 1; c.beginPath(); c.moveTo(7.2, 9); c.lineTo(7.6, 17); c.moveTo(6.2, 9.4); c.lineTo(8.6, 9); c.stroke(); }
  }
}
const SPR = new Map();
function sprite(kind, nat, t, dpr) {
  const key = `${kind}:${nat}:${t}:${dpr}`;
  let s = SPR.get(key);
  if (s) return s;
  const [w, h] = kind === 'c' ? [23, 16] : [24, 24];
  s = document.createElement('canvas');
  s.width = Math.ceil(w * dpr); s.height = Math.ceil(h * dpr);
  const c = s.getContext('2d');
  c.scale(dpr, dpr);
  kind === 'c' ? drawCounter(c, nat, t, w, h) : drawFigure(c, nat, t);
  s.cw = w; s.ch = h;
  SPR.set(key, s);
  return s;
}
// значок (icons.js) на холсте
function drawIcon(c, k, x, y, size, fill, stroke = null) {
  const P = iconPath(k), s = size / iconSize(k);
  c.save(); c.translate(x - size / 2, y - size / 2); c.scale(s, s);
  if (stroke) { c.lineWidth = 48; c.strokeStyle = stroke; c.lineJoin = 'round'; c.stroke(P); }
  c.fillStyle = fill; c.fill(P);
  c.restore();
}

export class EastMap {
  constructor(root, M) {
    this.M = M; this.root = root;
    this.resetStat();
    root.classList.add('em');
    this.cv = document.createElement('canvas'); this.cv.className = 'em-gl';
    this.ov = document.createElement('canvas'); this.ov.className = 'em-ov';
    this.fx = document.createElement('canvas'); this.fx.className = 'em-fx'; // вспышки боёв — отдельный слой, без перерисовки карты
    root.append(this.cv, this.ov, this.fx);
    this.ctx = this.ov.getContext('2d'); this.fctx = this.fx.getContext('2d');
    try {
      this.G = new GLMap(this.cv, M);
      this.G.onRestore = () => { this.colorsDirty = this.linesDirty = true; this.redraw(); };
    } catch (e) {
      this.G = null; this.cv.style.display = 'none'; this.T2 = new Terrain(M);
      this.regP = M.reg.map((g) => regionPath(M, g.rg));
    }
    this.view = { x0: 900, y0: 1300, sc: 0.5 };
    this.S = null; this.side = 'SOV';
    this.hl = { sel: -1, reach: null, atk: null, pick: null };
    this.marks = []; this.flags = []; this.arrows = [];
    this.opt = { trees: true, figures: true, labels: true };
    this.dirty = true; this.colorsDirty = true; this.linesDirty = true;
    this.cols = new Uint8Array(512 * 4);
    this.rp = M.reg.map((g) => g.rg.map((ring) => ringPts(M, ring)));
    this.bindInput();
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(root);
    this.resize();
    const loop = () => { this.raf = requestAnimationFrame(loop); this.frame(); };
    this.raf = requestAnimationFrame(loop);
  }
  resetStat() { this.fst = { n: 0, upd: 0, gl: 0, ov: 0, max: 0 }; }
  destroy() { cancelAnimationFrame(this.raf); this.ro.disconnect(); }
  setState(S, side) { this.S = S; this.side = side; this.refresh(); }
  refresh() { this.colorsDirty = this.linesDirty = this.dirty = true; }
  redraw() { this.dirty = true; }
  resize() {
    const r = this.root.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
    this.w = Math.max(1, r.width); this.h = Math.max(1, r.height); this.dpr = dpr;
    this.G?.resize(this.w, this.h, dpr);
    this.ov.width = this.fx.width = Math.round(this.w * dpr); this.ov.height = this.fx.height = Math.round(this.h * dpr);
    this.clampView(); this.dirty = true;
  }
  get minSc() { return Math.max(this.w, this.h) / 3300; }
  clampView() {
    const v = this.view, M = this.M;
    v.sc = clamp(v.sc, this.minSc, 3.2);
    const vw = this.w / v.sc, vh = this.h / v.sc;
    v.x0 = vw >= M.w ? (M.w - vw) / 2 : clamp(v.x0, -vw * 0.25, M.w - vw * 0.75);
    v.y0 = vh >= M.h ? (M.h - vh) / 2 : clamp(v.y0, -vh * 0.25, M.h - vh * 0.75);
  }
  toMap(px, py) { const v = this.view; return [v.x0 + px / v.sc, v.y0 + py / v.sc]; }
  toScr(x, y) { const v = this.view; return [(x - v.x0) * v.sc, (y - v.y0) * v.sc]; }
  centerOn(x, y, sc = this.view.sc) { const v = this.view; v.sc = sc; v.x0 = x - this.w / 2 / sc; v.y0 = y - this.h / 2 / sc; this.clampView(); this.dirty = true; }
  flyTo(x, y, sc = this.view.sc, ms = 450) {
    const a = { ...this.view }, b = { sc: clamp(sc, this.minSc, 3.2) };
    b.x0 = x - this.w / 2 / b.sc; b.y0 = y - this.h / 2 / b.sc;
    this.anim = { a, b, t0: now(), ms };
  }
  fitRegions(rs, pad = 40) {
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const r of rs) { const b = this.M.reg[r].bb; x0 = Math.min(x0, b[0]); y0 = Math.min(y0, b[1]); x1 = Math.max(x1, b[2]); y1 = Math.max(y1, b[3]); }
    if (x0 > x1) return;
    const sc = Math.min((this.w - pad * 2) / (x1 - x0), (this.h - pad * 2) / (y1 - y0));
    this.flyTo((x0 + x1) / 2, (y0 + y1) / 2, Math.min(sc, 1.1));
  }
  // ——— ввод ———
  bindInput() {
    const el = this.ov, P = new Map();
    let pan = null, pinch = null, down = null, longT = 0;
    const pos = (e) => { const r = el.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    el.addEventListener('pointerdown', (e) => {
      el.setPointerCapture?.(e.pointerId);
      P.set(e.pointerId, pos(e));
      this.anim = null;
      if (P.size === 1) {
        const [x, y] = pos(e);
        down = { x, y, t: now(), moved: false };
        pan = { x, y, x0: this.view.x0, y0: this.view.y0 };
        clearTimeout(longT);
        longT = setTimeout(() => { if (down && !down.moved) { down.long = true; this.onLong?.(this.regionAtPx(x, y), x, y); } }, 560);
      } else if (P.size === 2) {
        const [a, b] = [...P.values()];
        pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), sc: this.view.sc, mx: (a[0] + b[0]) / 2, my: (a[1] + b[1]) / 2, m: this.toMap((a[0] + b[0]) / 2, (a[1] + b[1]) / 2) };
        if (down) down.moved = true;
        clearTimeout(longT);
      }
    });
    el.addEventListener('pointermove', (e) => {
      if (!P.has(e.pointerId)) return;
      P.set(e.pointerId, pos(e));
      if (P.size >= 2 && pinch) {
        const [a, b] = [...P.values()];
        const d = Math.hypot(a[0] - b[0], a[1] - b[1]), mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
        const v = this.view;
        v.sc = clamp(pinch.sc * (d / Math.max(10, pinch.d)), this.minSc, 3.2);
        v.x0 = pinch.m[0] - mx / v.sc; v.y0 = pinch.m[1] - my / v.sc;
        this.clampView(); this.dirty = true;
        return;
      }
      if (pan && down) {
        const [x, y] = pos(e);
        if (!down.moved && Math.hypot(x - down.x, y - down.y) > 7) { down.moved = true; clearTimeout(longT); }
        if (down.moved) {
          this.view.x0 = pan.x0 - (x - pan.x) / this.view.sc; this.view.y0 = pan.y0 - (y - pan.y) / this.view.sc;
          this.clampView(); this.dirty = true;
        }
      }
    });
    const up = (e) => {
      if (!P.has(e.pointerId)) return;
      P.delete(e.pointerId);
      clearTimeout(longT);
      if (P.size === 1) { const [p] = [...P.values()]; pan = { x: p[0], y: p[1], x0: this.view.x0, y0: this.view.y0 }; pinch = null; return; }
      if (P.size === 0) {
        if (down && !down.moved && !down.long && e.type === 'pointerup') { const [x, y] = pos(e); this.onTap?.(this.regionAtPx(x, y), x, y); }
        pan = null; pinch = null; down = null;
      }
    };
    el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
    el.addEventListener('wheel', (e) => {
      e.preventDefault();
      const [x, y] = pos(e), m = this.toMap(x, y), v = this.view;
      v.sc = clamp(v.sc * Math.pow(1.0015, -e.deltaY), this.minSc, 3.2);
      v.x0 = m[0] - x / v.sc; v.y0 = m[1] - y / v.sc;
      this.clampView(); this.dirty = true;
    }, { passive: false });
    el.addEventListener('contextmenu', (e) => e.preventDefault());
  }
  zoomBy(k) { const v = this.view, cx = this.w / 2, cy = this.h / 2, m = this.toMap(cx, cy); this.flyTo(m[0], m[1], v.sc * k, 250); }
  regionAtPx(px, py) {
    const [x, y] = this.toMap(px, py);
    let r = regionAt(this.M, x, y);
    // касание по фишке — её область (фишка может выходить за границу)
    const hit = this.stackHit?.find((s) => Math.abs(px - s.x) <= s.w / 2 + 4 && Math.abs(py - s.y) <= s.h / 2 + 4);
    if (hit) r = hit.r;
    return r;
  }
  // ——— кадр ———
  frame() {
    if (this.anim) {
      const A = this.anim, k = clamp((now() - A.t0) / A.ms, 0, 1), e = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
      const v = this.view;
      v.sc = A.a.sc * Math.pow(A.b.sc / A.a.sc, e);
      const cx = A.a.x0 + this.w / 2 / A.a.sc, cy = A.a.y0 + this.h / 2 / A.a.sc, tx = A.b.x0 + this.w / 2 / A.b.sc, ty = A.b.y0 + this.h / 2 / A.b.sc;
      v.x0 = cx + (tx - cx) * e - this.w / 2 / v.sc; v.y0 = cy + (ty - cy) * e - this.h / 2 / v.sc;
      this.clampView();
      if (k >= 1) this.anim = null;
      this.dirty = true;
    }
    if (this.marks.length || this.fxOn) {
      const t = now();
      this.marks = this.marks.filter((m) => t - m.t0 < m.life);
      if (this.dirty || t - (this.fxT || 0) > 40) { this.fxT = t; this.drawFx(); } // ~25 кадров/с
    }
    if (!this.dirty || !this.S) return;
    this.dirty = false;
    const t0 = now();
    if (this.colorsDirty) this.updateColors();
    if (this.linesDirty) this.updateLines();
    const t1 = now();
    if (this.G) this.G.draw(this.view, { trees: this.opt.trees ? undefined : 0 });
    const t2 = now();
    this.drawOverlay();
    if (this.marks.length) this.drawFx();
    const F = this.fst, t3 = now(); // статистика кадров (для автотестов)
    F.n++; F.upd += t1 - t0; F.gl += t2 - t1; F.ov += t3 - t2; F.max = Math.max(F.max, t3 - t0);
  }
  // заливка областей: владелец, выделения (достижимые, цели удара)
  updateColors() {
    this.colorsDirty = false;
    const S = this.S, M = this.M, c = this.cols, hl = this.hl;
    for (let r = 0; r < M.R; r++) {
      const nat = natOf(S, r), C = NATC[nat], sd = sideOf(S, r);
      let col = C ? C.tint : [150, 146, 136, 40];
      if (!sd && C) col = [150, 146, 136, 46];
      if (sd && S.sup[sd] && S.sup[sd][r] <= 0 && S.at[r].length) col = [60, 40, 30, 92];
      if (hl.reach?.has(r)) col = [96, 186, 92, 112];
      if (hl.atk?.has(r)) col = [236, 92, 40, 128];
      if (hl.pick?.has(r)) col = [250, 196, 60, 84];
      c[r * 4] = col[0]; c[r * 4 + 1] = col[1]; c[r * 4 + 2] = col[2]; c[r * 4 + 3] = col[3];
    }
    for (let k = 0; k < M.neut.length; k++) c.set([150, 146, 136, 40], (M.R + k) * 4);
    this.G?.setRegionColors(c);
  }
  // линия фронта, выделенная область
  updateLines() {
    this.linesDirty = false;
    const S = this.S, M = this.M;
    const front = [], nat = [];
    for (const A of M.arcs) {
      if (A.t !== 0 || A.a < 0 || A.b < 0 || A.a >= M.R || A.b >= M.R) continue;
      const sa = sideOf(S, A.a), sb = sideOf(S, A.b);
      if (sa && sb && sa !== sb) front.push({ p: A.p });
      else if (natOf(S, A.a) !== natOf(S, A.b)) nat.push({ p: A.p });
    }
    this.front = front;
    if (!this.G) return;
    this.G.setLines('nat', nat, [{ w: 1.1, col: [50, 44, 40, 0.5] }]);
    this.G.setLines('front', front, [{ w: (sc) => 4.6 + Math.min(2, sc * 1.5), col: [92, 14, 8, 0.45] }, { w: (sc) => 2.3 + Math.min(1.2, sc), col: [222, 36, 24, 1] }]);
    const sel = this.hl.sel >= 0 ? this.rp[this.hl.sel].map((p) => ({ p, closed: true })) : [];
    this.G.setLines('sel', sel, [{ w: 5.5, col: [255, 236, 150, 0.55] }, { w: 2.4, col: [196, 128, 10, 1] }]);
  }
  setHL(o) { Object.assign(this.hl, o); this.colorsDirty = this.linesDirty = this.dirty = true; }
  // вспышки боёв: [{T, from, side, win}] → маркеры на life мс
  showBattles(list, life = 6500) {
    const t0 = now();
    for (const b of list) this.marks.push({ ...b, t0, life });
    this.dirty = true;
  }
  clearBattles() { this.marks = []; this.dirty = true; }
  // ——— 2D-слой ———
  drawOverlay() {
    const c = this.ctx, S = this.S, M = this.M, v = this.view, dpr = this.dpr, sc = v.sc;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, this.w, this.h);
    if (!this.G) this.draw2D(c);
    const vis = (x, y, m = 40) => { const X = (x - v.x0) * sc, Y = (y - v.y0) * sc; return X > -m && Y > -m && X < this.w + m && Y < this.h + m ? [X, Y] : null; };
    // города
    const cityLvl = sc < 0.36 ? 3 : sc < 0.75 ? 2 : 1;
    const boxes = [];
    const labels = [];
    for (const ct of M.cities) {
      if (ct.s < cityLvl) continue;
      const p = vis(ct.x, ct.y);
      if (!p) continue;
      const r = ct.s === 3 ? 3.6 : ct.s === 2 ? 2.8 : 2.1;
      c.fillStyle = '#fffaf0'; c.strokeStyle = '#3a2c20'; c.lineWidth = 1.2;
      c.beginPath();
      if (ct.s === 3) c.rect(p[0] - r, p[1] - r, r * 2, r * 2); else c.arc(p[0], p[1], r, 0, 7);
      c.fill(); c.stroke();
      labels.push([ct, p, r]);
    }
    // дивизии: стопка по области
    this.stackHit = [];
    const fig = this.opt.figures && sc >= 1.05, cw = sc < 0.32 ? 15 : sc < 0.55 ? 19 : 23, ch = cw * 0.7;
    for (let r = 0; r < M.R; r++) {
      const us = S.at[r];
      if (!us.length) continue;
      const g = M.reg[r], p = vis(g.x, g.y, 60);
      if (!p) continue;
      const sd = us[0].s;
      const top = [...us].sort((a, b) => TYPE_RANK[a.t] - TYPE_RANK[b.t] || b.str - a.str);
      const n = us.length, avg = us.reduce((s, u) => s + u.str, 0) / n;
      const x = p[0], y = p[1] + (g.city && Math.hypot(g.city.x - g.x, g.city.y - g.y) * sc < 14 ? 12 : 0);
      if (fig) {
        // фигурки: до 3 разных родов войск
        const kinds = []; for (const u of top) if (!kinds.find((k) => k.t === u.t) && kinds.length < 3) kinds.push(u);
        kinds.forEach((u, i) => {
          const s = sprite('f', u.nat, u.t, dpr * 1.25), w = 24 * Math.min(1.5, sc * 0.95), off = (i - (kinds.length - 1) / 2) * w * 0.62;
          c.drawImage(s, x + off - w / 2, y - ch / 2 - w * 0.86, w, w);
        });
      }
      const depth = Math.min(3, n);
      for (let i = depth - 1; i >= 0; i--) {
        const u = top[Math.min(i, top.length - 1)], s = sprite('c', u.nat, u.t, dpr * (cw / 23));
        c.drawImage(s, x - cw / 2 + i * 2.2, y - ch / 2 - i * 2.2, cw, ch);
      }
      // численность
      const bw = cw * 0.7, bx = x - bw / 2 - 0.6, by = y + ch / 2 - ch * 0.26;
      c.fillStyle = 'rgba(20,14,10,0.6)'; c.fillRect(bx, by, bw, Math.max(2, ch * 0.13));
      c.fillStyle = avg >= 70 ? '#7cc35a' : avg >= 40 ? '#e7c040' : '#e0583a'; c.fillRect(bx, by, bw * clamp(avg / 100, 0.05, 1), Math.max(2, ch * 0.13));
      // число дивизий
      if (n > 1) {
        const bx2 = x + cw / 2 - 1, by2 = y - ch / 2 - 1, rr = cw < 18 ? 5.5 : 7;
        c.fillStyle = sd === this.side ? '#fff6dc' : '#2a2420'; c.strokeStyle = sd === this.side ? '#5a3a10' : '#f2e6c8'; c.lineWidth = 1;
        c.beginPath(); c.arc(bx2, by2, rr, 0, 7); c.fill(); c.stroke();
        c.fillStyle = sd === this.side ? '#3a2410' : '#fff6dc';
        c.font = `700 ${rr * 1.35}px Rubik, system-ui, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
        c.fillText(String(n), bx2, by2 + 0.5);
      }
      // в окружении
      if (S.sup[sd] && S.sup[sd][r] <= 0) drawIcon(c, 'encircle', x - cw / 2 - 5, y - ch / 2 - 3, 13, '#e0402a', '#fff');
      boxes.push([x - cw / 2 - 2, y - ch / 2 - 4, x + cw / 2 + 8, y + ch / 2 + 2]);
      this.stackHit.push({ r, x, y, w: cw, h: ch });
    }
    // постройки (крупный масштаб)
    if (sc >= 0.8) {
      for (let r = 0; r < M.R; r++) {
        const g = M.reg[r], p = vis(g.x, g.y);
        if (!p) continue;
        const items = [];
        if (S.fort[r] > 0) items.push(['fort', S.fort[r]]);
        if (S.fac[r] > 0) items.push(['factory', S.fac[r]]);
        if (S.afd[r] > 0 && sc >= 1.2) items.push(['airfield', 0]);
        let x = p[0] - (items.length - 1) * 8, y = p[1] + 17;
        for (const [k, n] of items) {
          c.fillStyle = 'rgba(255,250,238,0.85)'; c.beginPath(); c.arc(x, y, 6.5, 0, 7); c.fill();
          drawIcon(c, k, x, y, 10, '#4a3a2a');
          if (n > 1) { c.font = '700 8px Rubik, system-ui, sans-serif'; c.fillStyle = '#4a3a2a'; c.textAlign = 'center'; c.fillText(String(n), x + 6, y + 6); }
          x += 16;
        }
      }
    }
    // подписи городов (без наложений)
    if (this.opt.labels) {
      labels.sort((a, b) => b[0].s - a[0].s);
      for (const [ct, p, r] of labels) {
        const fs = ct.s === 3 ? 13 : ct.s === 2 ? 11.5 : 10.5;
        c.font = `${ct.s === 3 ? 700 : 600} ${fs}px Rubik, system-ui, sans-serif`;
        const tw = c.measureText(ct.n).width;
        const bx = [p[0] + r + 3, p[1] - fs * 0.6, p[0] + r + 3 + tw, p[1] + fs * 0.6];
        if (ct.s < 3 && boxes.some((b) => bx[0] < b[2] && bx[2] > b[0] && bx[1] < b[3] && bx[3] > b[1])) continue;
        boxes.push(bx);
        c.textAlign = 'left'; c.textBaseline = 'middle';
        c.lineWidth = 3; c.strokeStyle = 'rgba(250,246,236,0.9)'; c.strokeText(ct.n, bx[0], p[1]);
        c.fillStyle = '#2a2018'; c.fillText(ct.n, bx[0], p[1]);
      }
    }
    // флажки целей направлений
    for (const f of this.flags) {
      const g = M.reg[f.r]; if (!g) continue;
      const p = vis(g.x, g.y); if (!p) continue;
      drawIcon(c, 'target', p[0], p[1] - 2, 26, f.col || '#d8301e', '#fff');
      if (f.label) {
        c.font = '700 10px Rubik, system-ui, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'top';
        c.lineWidth = 3; c.strokeStyle = 'rgba(255,250,238,0.95)'; c.strokeText(f.label, p[0], p[1] + 12); c.fillStyle = '#8a1a10'; c.fillText(f.label, p[0], p[1] + 12);
      }
    }
    // выделение без WebGL
    if (!this.G && this.hl.sel >= 0) {
      c.save(); c.setTransform(dpr * sc, 0, 0, dpr * sc, -v.x0 * sc * dpr, -v.y0 * sc * dpr);
      c.lineWidth = 2.4 / sc; c.strokeStyle = '#c4800a'; c.stroke(this.regP[this.hl.sel]); c.restore();
    }
  }
  // слой вспышек: стрелки ударов прошлой фазы и «взрывы» над областями боёв
  drawFx() {
    const c = this.fctx, M = this.M, v = this.view, dpr = this.dpr, sc = v.sc, t = now();
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, this.w, this.h);
    this.fxOn = this.marks.length > 0;
    if (!this.fxOn) return;
    const vis = (x, y, m = 40) => { const X = (x - v.x0) * sc, Y = (y - v.y0) * sc; return X > -m && Y > -m && X < this.w + m && Y < this.h + m ? [X, Y] : null; };
    for (const m of this.marks) {
      const a = clamp(1 - (t - m.t0 - m.life * 0.6) / (m.life * 0.4), 0, 1), g = M.reg[m.T];
      const to = this.toScr(g.x, g.y), col = SIDE_COL[m.side];
      for (const f of m.from || []) {
        const fg = M.reg[f]; if (!fg) continue;
        const fr = this.toScr(fg.x, fg.y);
        this.arrow(c, fr[0], fr[1], to[0], to[1], `rgba(${col[0]},${col[1]},${col[2]},${0.85 * a})`, m.win ? 3.2 : 2.2, !m.win);
      }
    }
    for (const m of this.marks) {
      const g = M.reg[m.T], p = vis(g.x, g.y);
      if (!p) continue;
      const age = (t - m.t0) / m.life, a = clamp(1 - (age - 0.6) / 0.4, 0, 1), pulse = 1 + 0.15 * Math.sin((t - m.t0) / 120);
      c.globalAlpha = a;
      drawIcon(c, 'boom', p[0] + 9, p[1] - 12, 20 * pulse, m.win ? '#f0a020' : '#c8c0b0', '#5a1a08');
      c.globalAlpha = 1;
    }
  }
  arrow(c, x0, y0, x1, y1, col, w, dash) {
    const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy);
    if (L < 6) return;
    const ux = dx / L, uy = dy / L, ex = x1 - ux * 10, ey = y1 - uy * 10, mx = (x0 + ex) / 2 - uy * L * 0.12, my = (y0 + ey) / 2 + ux * L * 0.12;
    c.strokeStyle = col; c.fillStyle = col; c.lineWidth = w; c.lineCap = 'round';
    if (dash) c.setLineDash([5, 4]);
    c.beginPath(); c.moveTo(x0, y0); c.quadraticCurveTo(mx, my, ex, ey); c.stroke();
    c.setLineDash([]);
    const ax = ex - mx, ay = ey - my, al = Math.hypot(ax, ay) || 1, bx = ax / al, by = ay / al;
    c.beginPath(); c.moveTo(ex + bx * 9, ey + by * 9); c.lineTo(ex - by * 6 - bx * 2, ey + bx * 6 - by * 2); c.lineTo(ex + by * 6 - bx * 2, ey - bx * 6 - by * 2); c.closePath(); c.fill();
  }
  // запасная отрисовка без WebGL
  draw2D(c) {
    const v = this.view, S = this.S, M = this.M, dpr = this.dpr;
    c.save();
    c.fillStyle = '#a3bfcc'; c.fillRect(0, 0, this.w, this.h);
    this.T2.draw(c, v.x0, v.y0, v.sc, this.w, this.h);
    c.setTransform(dpr * v.sc, 0, 0, dpr * v.sc, -v.x0 * v.sc * dpr, -v.y0 * v.sc * dpr);
    for (let r = 0; r < M.R; r++) {
      const k = r * 4, col = this.cols;
      c.fillStyle = `rgba(${col[k]},${col[k + 1]},${col[k + 2]},${col[k + 3] / 255})`;
      c.fill(this.regP[r], 'evenodd');
    }
    c.lineWidth = 0.6 / v.sc; c.strokeStyle = 'rgba(60,48,36,0.25)';
    for (let r = 0; r < M.R; r++) c.stroke(this.regP[r]);
    c.lineWidth = 2.6 / v.sc; c.strokeStyle = '#de2418';
    for (const f of this.front || []) { const p = f.p; c.beginPath(); c.moveTo(p[0], p[1]); for (let i = 2; i < p.length; i += 2) c.lineTo(p[i], p[i + 1]); c.stroke(); }
    c.restore();
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
}
export { drawIcon, drawCounter, drawFigure };
