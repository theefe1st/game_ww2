// «Мировой фронт» v0.11, «Восточный фронт»: карта. Подложка — WebGL (gl.js: рельеф с отмывкой, сезонный покров,
// области, реки, железные дороги, красная линия фронта), поверх — 2D-слой: цветные линии фронтов игрока (как планы
// сражений в Hearts of Iron), штабы с портретами генералов, стрелки наступлений, посёлки и города, подписи цветом
// владельца, фишки дивизий (counters.js) вдоль линии фронта — плотным строем, в тылу — кучками; при мелком масштабе —
// сводные фишки по областям. Слой вспышек: бои, погода (дождь, снег). Жесты: перетаскивание, щипок, колесо мыши,
// касание (onTap), долгое касание (onLong). Без WebGL — 2D-запас (terrain.js).
import { GLMap } from './gl.js';
import { Terrain } from './terrain.js';
import { regionAt, ringPts, regionPath } from './mapdata.js';
import { sideOf, natOf, alive, cityR } from './engine.js';
import { FLEETS, fleetSpot, mined } from './fleet.js';
import { NATC, NAT_N } from './rules.js';
import { iconPath, iconSize } from './icons.js';
import { divSprite, divLabel, wmOf, drawDiv, styleOf } from './counters.js';

const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const SIDE_COL = { GER: [72, 84, 100], SOV: [178, 58, 44] };
const TYPE_RANK = { arm: 0, mot: 1, mtn: 2, abn: 2, inf: 3, cav: 4, sec: 5 };
const now = () => performance.now();
// цвета фронтов (групп армий) — как линии планов в Hearts of Iron
export const FRONT_COL = ['#9b5de5', '#2f80ed', '#27ae60', '#f2994a', '#17b8c8', '#e0479e', '#d4b106', '#a0673a'];
export const AGG_SC = 0.4; // мельче — сводные фишки по областям
export const divSize = (sc) => Math.round(clamp(9 + 10 * sc, 14, 34));
function rrect(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
// значок (icons.js) на холсте
function drawIcon(c, k, x, y, size, fill, stroke = null) {
  const P = iconPath(k), s = size / iconSize(k);
  c.save(); c.translate(x - size / 2, y - size / 2); c.scale(s, s);
  if (stroke) { c.lineWidth = 48; c.strokeStyle = stroke; c.lineJoin = 'round'; c.stroke(P); }
  c.fillStyle = fill; c.fill(P);
  c.restore();
}
// старый вид фишки для списков (совместимость): фишка рода войск без номера
function drawCounter(c, nat, t, w, h) { const s = Math.min(w, h); c.save(); c.translate((w - s) / 2, (h - s) / 2); drawDiv(c, nat, t, '', s); c.restore(); }

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
    this.opt = { trees: false, labels: true, wx: true };
    this.dirty = true; this.colorsDirty = true; this.linesDirty = true;
    this.cols = new Uint8Array(512 * 4);
    this.rp = M.reg.map((g) => g.rg.map((ring) => ringPts(M, ring)));
    this.bindInput();
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(root);
    this.resize();
    // кадры: 60 в секунду, пока что-то меняется; в покое — проверка 5 раз в секунду (бережём батарею)
    this.idleT = now();
    const loop = () => {
      this.raf = 0;
      if (this.anim || this.dirty || this.marks.length || this.fxOn) this.idleT = now();
      this.frame();
      if (this.dead) return;
      if (now() - this.idleT < 1500) this.raf = requestAnimationFrame(loop);
      else this.tmo = setTimeout(() => { this.tmo = 0; this.raf = requestAnimationFrame(loop); }, 200);
    };
    this.kick = () => { this.idleT = now(); if (this.tmo) { clearTimeout(this.tmo); this.tmo = 0; this.raf = requestAnimationFrame(loop); } };
    this.raf = requestAnimationFrame(loop);
  }
  resetStat() { this.fst = { n: 0, upd: 0, gl: 0, ov: 0, max: 0 }; }
  destroy() { this.dead = true; cancelAnimationFrame(this.raf); clearTimeout(this.tmo); this.ro.disconnect(); }
  setState(S, side) { this.S = S; this.side = side; this.refresh(); }
  refresh() { this.ver = (this.ver || 0) + 1; this.colorsDirty = this.linesDirty = this.dirty = true; this.kick?.(); }
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
  centerOn(x, y, sc = this.view.sc) { const v = this.view; v.sc = sc; v.x0 = x - this.w / 2 / sc; v.y0 = y - this.h / 2 / sc; this.clampView(); this.dirty = true; this.kick?.(); }
  flyTo(x, y, sc = this.view.sc, ms = 450) {
    const a = { ...this.view }, b = { sc: clamp(sc, this.minSc, 3.2) };
    b.x0 = x - this.w / 2 / b.sc; b.y0 = y - this.h / 2 / b.sc;
    this.anim = { a, b, t0: now(), ms }; this.kick?.();
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
      this.kick();
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
      if (P.size) this.kick();
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
        if (down && !down.moved && !down.long && e.type === 'pointerup') {
          const [x, y] = pos(e), hit = (h) => x >= h.x && x <= h.x + h.w && y >= h.y && y <= h.y + h.h, hq = this.hqHit?.find(hit), fl = !hq && this.fleetHit?.find(hit);
          if (hq && this.onHQ) this.onHQ(hq.f); else if (fl && this.onFleet) this.onFleet(fl.id); else this.onTap?.(this.regionAtPx(x, y), x, y);
        }
        pan = null; pinch = null; down = null;
      }
    };
    el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
    el.addEventListener('wheel', (e) => {
      e.preventDefault(); this.kick();
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
    if (this.G) this.G.draw(this.view, { trees: this.opt.trees, tint: clamp(1.25 - this.view.sc * 0.45, 0.4, 1) });
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
      if (!sd && C && !C.neu && !S.peace) col = [150, 146, 136, 46]; // вышли из войны (мирное время — свои цвета стран)
      if (sd && S.sup[sd] && S.sup[sd][r] <= 0 && S.at[r].length) col = [60, 40, 30, 80];
      if (hl.reach?.has(r)) col = [96, 186, 92, 112];
      if (hl.atk?.has(r)) col = [236, 92, 40, 128];
      if (hl.pick?.has(r)) col = [250, 196, 60, 84];
      if (hl.paint?.has(r)) { const h = hl.paint.get(r); col = [h[0], h[1], h[2], 92]; }
      c[r * 4] = col[0]; c[r * 4 + 1] = col[1]; c[r * 4 + 2] = col[2]; c[r * 4 + 3] = col[3];
    }
    for (let k = 0; k < M.neut.length; k++) c.set([150, 146, 136, 40], (M.R + k) * 4);
    this.G?.setRegionColors(c);
    // сезонный покров по погоде полос
    if (this.G && S.wx) this.G.setSeason(S.wx.map((w) => (w === 'frost' ? [0.92, 0, 0] : w === 'snow' ? [0.78, 0, 0.1] : w === 'mud' ? [0, 0.42, 0.6] : w === 'rain' ? [0, 0.08, 0.9] : [0, 0, 0])));
  }
  // линия фронта, выделенная область
  updateLines() {
    this.linesDirty = false;
    const S = this.S, M = this.M;
    const front = [], nat = [], pb = [];
    for (const A of M.arcs) {
      if (A.t !== 0 || A.a < 0 || A.b < 0 || A.a >= M.R || A.b >= M.R) continue;
      const sa = sideOf(S, A.a), sb = sideOf(S, A.b);
      if (sa && sb && sa !== sb) (S.peace ? pb : front).push({ p: A.p }); // мирное время: граница, а не фронт
      else if (natOf(S, A.a) !== natOf(S, A.b)) nat.push({ p: A.p });
    }
    this.front = front; this.pbord = pb;
    this.natLab = S.peace ? natLabels(S) : null;
    if (!this.G) return;
    this.G.setLines('nat', nat, S.peace ? [{ w: 1.6, col: [70, 54, 42, 0.6] }] : [{ w: 1.1, col: [70, 60, 50, 0.45] }]);
    this.G.setLines('front', front, [{ w: (sc) => 4.4 + Math.min(2.6, sc * 1.3), col: [255, 120, 80, 0.24] }, { w: (sc) => 2.2 + Math.min(1.7, sc * 0.85), col: [238, 40, 16, 1] }]);
    this.G.setLines('pbord', pb, [{ w: (sc) => 3 + Math.min(2, sc), col: [250, 236, 210, 0.45] }, { w: (sc) => 1.5 + Math.min(1, sc * 0.5), col: [140, 34, 24, 0.9] }]);
    const sel = this.hl.sel >= 0 ? this.rp[this.hl.sel].map((p) => ({ p, closed: true })) : [];
    this.G.setLines('sel', sel, [{ w: 5.5, col: [255, 236, 150, 0.55] }, { w: 2.4, col: [196, 128, 10, 1] }]);
  }
  setHL(o) { Object.assign(this.hl, o); this.colorsDirty = this.linesDirty = this.dirty = true; this.kick?.(); }
  // вспышки боёв: [{T, from, side, win}] → маркеры на life мс
  showBattles(list, life = 6500) {
    const t0 = now();
    for (const b of list) this.marks.push({ ...b, t0, life });
    this.dirty = true; this.kick?.();
  }
  clearBattles() { this.marks = []; this.dirty = true; }
  // ——— дуги границ областей (для линии фронта и строя фишек) ———
  // M.regArcs[r] — дуги области; знак нормали дуги: левая нормаль × ls смотрит в область A.a
  indexArcs() {
    const M = this.M;
    if (M.regArcs) return;
    M.regArcs = Array.from({ length: M.R }, () => []);
    M.arcs.forEach((A, k) => { if (A.t !== 0) return; if (A.a >= 0 && A.a < M.R) M.regArcs[A.a].push(k); if (A.b >= 0 && A.b < M.R) M.regArcs[A.b].push(k); });
  }
  arcSign(k) {
    const A = this.M.arcs[k];
    if (A.ls) return A.ls;
    const p = A.p, n = p.length / 2, i = Math.max(0, Math.min(n - 2, (n / 2) | 0));
    const dx = p[i * 2 + 2] - p[i * 2], dy = p[i * 2 + 3] - p[i * 2 + 1], L = Math.hypot(dx, dy) || 1, mx = (p[i * 2] + p[i * 2 + 2]) / 2, my = (p[i * 2 + 1] + p[i * 2 + 3]) / 2;
    let ls = 0;
    for (const d of [2.5, 1, 5]) {
      const r = regionAt(this.M, mx - (dy / L) * d, my + (dx / L) * d);
      if (r === A.a) { ls = 1; break; }
      if (r === A.b) { ls = -1; break; }
    }
    if (!ls) { const g = this.M.reg[A.a] || this.M.reg[A.b]; const s = (g.x - mx) * (-dy / L) + (g.y - my) * (dx / L); ls = (s >= 0) === (g === this.M.reg[A.a]) ? 1 : -1; }
    return (A.ls = ls);
  }
  // участки границы области r со стороной противника: отрезки с нормалью внутрь области
  contact(r, sd) {
    const key = r * 2 + (sd === 'GER' ? 1 : 0);
    if (this.cC?.ver === this.ver) { const v = this.cC.m.get(key); if (v !== undefined) return v; } else this.cC = { ver: this.ver, m: new Map() };
    const v = this.contact0(r, sd);
    this.cC.m.set(key, v);
    return v;
  }
  contact0(r, sd) {
    const S = this.S, M = this.M, segs = [];
    let L = 0;
    for (const k of M.regArcs[r]) {
      const A = M.arcs[k], o = A.a === r ? A.b : A.a;
      if (o < 0 || o >= M.R) continue;
      const so = sideOf(S, o);
      if (!so || so === sd) continue;
      const sg = this.arcSign(k) * (A.a === r ? 1 : -1), p = A.p;
      for (let i = 0; i + 3 < p.length; i += 2) {
        const ax = p[i], ay = p[i + 1], bx = p[i + 2], by = p[i + 3], l = Math.hypot(bx - ax, by - ay);
        if (l < 1e-6) continue;
        segs.push({ ax, ay, bx, by, l, nx: (-(by - ay) / l) * sg, ny: ((bx - ax) / l) * sg, f: o, k });
        L += l;
      }
    }
    return segs.length ? { segs, L } : null;
  }
  // точка пути на расстоянии t и нормаль внутрь (сглаженная по хорде ±w)
  pathAt(P, t, w) {
    const pos = (q) => {
      q = clamp(q, 0, P.L);
      for (const s of P.segs) { if (q <= s.l) return [s.ax + (s.bx - s.ax) * (q / s.l), s.ay + (s.by - s.ay) * (q / s.l), s]; q -= s.l; }
      const s = P.segs[P.segs.length - 1]; return [s.bx, s.by, s];
    };
    const [x, y, s] = pos(t), [x0, y0] = pos(t - w), [x1, y1] = pos(t + w);
    let nx = -(y1 - y0), ny = x1 - x0;
    const l = Math.hypot(nx, ny);
    if (l < 1e-6) return [x, y, s.nx, s.ny];
    nx /= l; ny /= l;
    if (nx * s.nx + ny * s.ny < 0) { nx = -nx; ny = -ny; }
    return [x, y, nx, ny];
  }
  // строй фишек: вдоль линии фронта (ряды вглубь), в тылу — кучкой; кэш до смены положения или размера
  layout() {
    const S = this.S, M = this.M, sc = this.view.sc, sz = divSize(sc), agg = sc < AGG_SC;
    const key = `${this.ver}|${sz}|${agg ? 1 : 0}|${Math.round(sc * 40)}`;
    if (this.lay && this.lay.key === key) return this.lay;
    this.indexArcs();
    const items = [];
    this.contacts = new Map();
    for (let r = 0; r < M.R; r++) {
      const us = S.at[r];
      if (!us.length) continue;
      const sd = us[0].s, g = M.reg[r], P = this.contact(r, sd);
      if (P) this.contacts.set(r, P);
      if (agg) {
        let x = g.x, y = g.y;
        if (P) { const [px, py, nx, ny] = this.pathAt(P, P.L / 2, P.L / 3); const d = (sz * 0.75) / sc; x = px + nx * d; y = py + ny * d; }
        const top = [...us].sort((a, b) => TYPE_RANK[a.t] - TYPE_RANK[b.t] || b.str - a.str)[0];
        const mech = us.filter((u) => u.t === 'arm' || u.t === 'mot').length;
        items.push({ r, agg: 1, n: us.length, u: top, t: mech * 2 >= us.length ? (top.t === 'arm' || top.t === 'mot' ? top.t : 'arm') : 'inf', x, y, row: 0 });
        continue;
      }
      const list = [...us].sort((a, b) => (a.t === 'arm' || a.t === 'mot' ? 1 : 0) - (b.t === 'arm' || b.t === 'mot' ? 1 : 0) || b.str - a.str);
      const n = list.length;
      if (P && P.L * sc > sz * 0.5) {
        const cap = Math.max(1, Math.floor((P.L * sc) / (sz * 0.9))), rows = Math.ceil(n / cap), w = Math.max(sz / sc, 6);
        let i = 0;
        for (let k = 0; k < rows; k++) {
          const m = Math.min(cap, n - k * cap), d = (sz * 0.5 + 7 + k * sz * 0.94) / sc;
          for (let j = 0; j < m; j++, i++) {
            const [px, py, nx, ny] = this.pathAt(P, ((j + 0.5) / m) * P.L, w);
            items.push({ r, u: list[i], x: px + nx * d, y: py + ny * d, row: k + 1 });
          }
        }
      } else {
        const cols = Math.ceil(Math.sqrt(n * 1.5)), st = (sz * 0.98) / sc, rowsN = Math.ceil(n / cols);
        const cy = g.y + (g.city && Math.hypot(g.city.x - g.x, g.city.y - g.y) * sc < 16 ? (sz * 0.9) / sc : 0);
        list.forEach((u, i) => { const cx = i % cols, ry = (i / cols) | 0; items.push({ r, u, x: g.x + (cx - (cols - 1) / 2) * st, y: cy + (ry - (rowsN - 1) / 2) * st, row: 0 }); });
      }
    }
    // сначала тыл, затем ряды от дальнего к ближнему к линии
    items.sort((a, b) => (a.row === 0 ? -1 : 0) - (b.row === 0 ? -1 : 0) || b.row - a.row);
    return (this.lay = { key, items, sz, agg });
  }
  // ——— 2D-слой ———
  drawOverlay() {
    const c = this.ctx, S = this.S, M = this.M, v = this.view, dpr = this.dpr, sc = v.sc;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, this.w, this.h);
    if (!this.G) this.draw2D(c);
    const vis = (x, y, m = 40) => { const X = (x - v.x0) * sc, Y = (y - v.y0) * sc; return X > -m && Y > -m && X < this.w + m && Y < this.h + m ? [X, Y] : null; };
    const L = this.layout();
    // линии фронтов игрока (со своей стороны линии), штабы, стрелки наступлений
    this.drawFronts(c, vis);
    // посёлки
    if (sc >= 0.5 && M.towns) {
      c.fillStyle = 'rgba(112,64,36,0.85)';
      const rr = sc >= 1.2 ? 2.3 : 1.7, T = M.towns;
      for (let i = 0; i < T.length; i += 2) { const p = vis(T[i], T[i + 1], 6); if (!p) continue; c.beginPath(); c.arc(p[0], p[1], rr, 0, 7); c.fill(); }
    }
    // города: чёрные точки, столицы — крупнее
    const cityLvl = sc < 0.36 ? 3 : sc < 0.7 ? 2 : 1;
    const labels = [];
    for (const ct of M.cities) {
      if (ct.s < cityLvl) continue;
      const p = vis(ct.x, ct.y);
      if (!p) continue;
      const r = ct.s === 3 ? 4.2 : ct.s === 2 ? 3.2 : 2.5;
      c.fillStyle = '#121210';
      c.beginPath(); c.arc(p[0], p[1], r, 0, 7); c.fill();
      if (ct.s === 3) { c.strokeStyle = 'rgba(255,250,236,0.9)'; c.lineWidth = 1.2; c.beginPath(); c.arc(p[0], p[1], r + 1.4, 0, 7); c.stroke(); }
      labels.push([ct, p, r]);
    }
    // подписи городов: цвет владельца (СССР — красный, Ось — сланцевый), без наложений друг на друга
    if (this.opt.labels) {
      const boxes = [];
      labels.sort((a, b) => b[0].s - a[0].s);
      const zk = clamp(0.86 + sc * 0.22, 0.9, 1.35);
      for (const [ct, p, r] of labels) {
        const fs = (ct.s === 3 ? 15 : ct.s === 2 ? 12.5 : 11) * zk;
        c.font = `700 ${fs}px Georgia, "Noto Serif", "PT Serif", serif`;
        const tw = c.measureText(ct.n).width;
        const bx = [p[0] + r + 3, p[1] - fs * 0.62, p[0] + r + 3 + tw, p[1] + fs * 0.5];
        if (boxes.some((b) => bx[0] < b[2] && bx[2] > b[0] && bx[1] < b[3] && bx[3] > b[1])) continue;
        boxes.push(bx);
        const sd = ct.r >= 0 ? sideOf(S, ct.r) : null;
        c.textAlign = 'left'; c.textBaseline = 'middle';
        c.lineWidth = 3.2; c.lineJoin = 'round'; c.strokeStyle = 'rgba(250,246,230,0.88)'; c.strokeText(ct.n, bx[0], p[1]);
        c.fillStyle = sd === 'SOV' ? '#d9462a' : sd === 'GER' ? '#3a4852' : '#5c5c52';
        c.fillText(ct.n, bx[0], p[1]);
      }
    }
    // мирное время: названия стран (кроме Германии и СССР)
    if (this.natLab && sc < 1.6) {
      c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineJoin = 'round';
      for (const L of this.natLab) {
        const p = vis(L.x, L.y, 200);
        if (!p) continue;
        const fs = clamp(L.k * sc, 10, 30);
        c.font = `italic 700 ${fs}px Georgia, "Noto Serif", "PT Serif", serif`;
        const t = L.n.toUpperCase().split('').join('\u2009');
        c.lineWidth = 3; c.strokeStyle = 'rgba(250,246,230,0.6)'; c.strokeText(t, p[0], p[1]);
        c.fillStyle = 'rgba(84,62,44,0.78)'; c.fillText(t, p[0], p[1]);
      }
    }
    // постройки (крупный масштаб)
    if (sc >= 0.85) this.drawBuildings(c, vis);
    // фишки
    this.stackHit = [];
    const sz = L.sz, half = sz / 2, sel = this.hl.sel, szB = Math.ceil(sz / 5) * 5; // спрайты — ступенями по 5 px
    for (const it of L.items) {
      const p = vis(it.x, it.y, sz);
      if (!p) continue;
      const u = it.u, x = p[0] - half, y = p[1] - half, sd = u.s;
      if (it.agg) {
        // сводная фишка: «стопка» со счётом дивизий
        const sp = divSprite(u.nat, it.t, String(it.n), '', szB, dpr);
        if (it.n > 1) { c.globalAlpha = 0.55; c.drawImage(sp, x + 3, y - 3, sz, sz); c.drawImage(sp, x + 1.5, y - 1.5, sz, sz); c.globalAlpha = 1; }
        c.drawImage(sp, x, y, sz, sz);
      } else {
        c.drawImage(divSprite(u.nat, u.t, divLabel(u), wmOf(u), szB, dpr), x, y, sz, sz);
        if (sz >= 19) { // численность
          const bw = sz * 0.62, bx = p[0] - bw / 2, by = y + sz - Math.max(2.4, sz * 0.11) - 1.2;
          c.fillStyle = 'rgba(30,24,16,0.45)'; c.fillRect(bx, by, bw, Math.max(1.6, sz * 0.07));
          c.fillStyle = u.str >= 70 ? '#5aa53c' : u.str >= 40 ? '#d9a91f' : '#d0482a'; c.fillRect(bx, by, bw * clamp(u.str / 100, 0.05, 1), Math.max(1.6, sz * 0.07));
        }
      }
      const oos = S.sup[sd] && S.sup[sd][it.r] <= 0;
      if (oos || it.r === sel) {
        c.lineWidth = it.r === sel ? 2 : 1.6; c.strokeStyle = it.r === sel ? '#f0b418' : '#e0301e';
        if (oos && it.r !== sel) c.setLineDash([3, 2]);
        if (sd === 'SOV') c.strokeRect(x - 0.5, y - 0.5, sz + 1, sz + 1); else { c.beginPath(); c.arc(p[0], p[1], half + 0.6, 0, 7); c.stroke(); }
        c.setLineDash([]);
      }
      this.stackHit.push({ r: it.r, u: it.agg ? null : u, x: p[0], y: p[1], w: sz, h: sz });
    }
    this.drawFleets(c, vis);
    this.drawHQs(c, vis);
    // флажки целей
    for (const f of this.flags) {
      const g = M.reg[f.r]; if (!g) continue;
      const p = vis(g.x, g.y); if (!p) continue;
      drawIcon(c, 'target', p[0], p[1] - 2, 24, f.col || '#d8301e', '#fff');
      if (f.label) {
        c.font = '700 10px Rubik, system-ui, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'top';
        c.lineWidth = 3; c.strokeStyle = 'rgba(255,250,238,0.95)'; c.strokeText(f.label, p[0], p[1] + 12); c.fillStyle = f.col || '#8a1a10'; c.fillText(f.label, p[0], p[1] + 12);
      }
    }
    // выделение без WebGL
    if (!this.G && this.hl.sel >= 0) {
      c.save(); c.setTransform(dpr * sc, 0, 0, dpr * sc, -v.x0 * sc * dpr, -v.y0 * sc * dpr);
      c.lineWidth = 2.4 / sc; c.strokeStyle = '#c4800a'; c.stroke(this.regP[this.hl.sel]); c.restore();
    }
  }
  // фронты игрока: цветная линия вдоль своей стороны линии фронта с «зубцами» к противнику, штаб, стрелка удара
  drawFronts(c, vis) {
    const S = this.S, M = this.M, P = this.side, FR = S.fr?.[P], v = this.view, sc = v.sc;
    this.hqHit = []; this.hqQ = [];
    if (!FR || !S.fz) return;
    this.indexArcs();
    const off = 3.3, segBy = new Map();
    for (let r = 0; r < M.R; r++) {
      if (sideOf(S, r) !== P) continue;
      const C = this.contacts?.get(r) || this.contact(r, P);
      if (!C) continue;
      const f = S.fz[r];
      (segBy.get(f) || segBy.set(f, []).get(f)).push(C);
    }
    c.lineCap = 'round'; c.lineJoin = 'round';
    const cen = [];
    for (const [f, list] of segBy) {
      const col = FRONT_COL[FR[f]?.col ?? f] || '#888';
      let sx = 0, sy = 0, sl = 0;
      c.strokeStyle = col; c.fillStyle = col; c.lineWidth = 3.6; c.globalAlpha = 0.95;
      for (const C of list) {
        c.beginPath();
        let last = -1;
        for (const s of C.segs) {
          const ax = (s.ax - v.x0) * sc + s.nx * off, ay = (s.ay - v.y0) * sc + s.ny * off, bx = (s.bx - v.x0) * sc + s.nx * off, by = (s.by - v.y0) * sc + s.ny * off;
          if (last !== s.k) c.moveTo(ax, ay);
          c.lineTo(bx, by); last = s.k;
          sx += (s.ax + s.bx) / 2 * s.l; sy += (s.ay + s.by) / 2 * s.l; sl += s.l;
        }
        c.stroke();
        // зубцы к противнику через ~26 px
        let acc = 0;
        for (const s of C.segs) {
          const lp = s.l * sc;
          acc += lp;
          if (acc < 26) continue;
          acc = 0;
          const mx = ((s.ax + s.bx) / 2 - v.x0) * sc + s.nx * off, my = ((s.ay + s.by) / 2 - v.y0) * sc + s.ny * off, tx = (s.bx - s.ax) / s.l, ty = (s.by - s.ay) / s.l;
          c.beginPath(); c.moveTo(mx - s.nx * 5.5, my - s.ny * 5.5); c.lineTo(mx + tx * 3.2, my + ty * 3.2); c.lineTo(mx - tx * 3.2, my - ty * 3.2); c.closePath(); c.fill();
        }
      }
      c.globalAlpha = 1;
      if (sl > 0) cen.push({ f, x: sx / sl, y: sy / sl, col, L: sl });
    }
    // штабы фронтов и стрелки наступлений
    const fd = S.frontD?.[P];
    for (const q of cen) {
      const F = FR[q.f];
      if (!F) continue;
      // штаб — в области второй линии ближе к середине участка
      let best = -1, bd = 1e18;
      for (let r = 0; r < M.R; r++) {
        if (sideOf(S, r) !== P || S.fz[r] !== q.f) continue;
        const k = fd ? fd[r] : 1, g = M.reg[r], d = (g.x - q.x) ** 2 + (g.y - q.y) ** 2 + (k === 2 ? 0 : k === 3 ? 2500 : k === 1 ? 6000 : k === 0 ? 30000 : 40000);
        if (d < bd) (bd = d), (best = r);
      }
      const g = best >= 0 ? M.reg[best] : { x: q.x, y: q.y };
      const tgt = S.post?.[P]?.[q.f] === 'atk' && !F.man ? S.tgt?.[P]?.[q.f] : -1;
      this.hqQ.push({ g, q, F, tgt });
    }
  }
  // флоты (fleet.js): плашка цвета стороны с силуэтом корабля и силой — в море у главной базы; название при крупном масштабе
  drawFleets(c, vis) {
    const S = this.S, M = this.M, sc = this.view.sc;
    this.fleetHit = [];
    if (!S?.fl || sc < 0.2) return;
    const k = clamp(0.75 + sc * 0.35, 0.85, 1.3), H = Math.round(19 * k), isz = H - 2;
    for (const f of FLEETS) {
      const st = S.fl[f.id];
      if (!st?.b || st.p <= 0) continue;
      const br = cityR(S, st.b), xy = br >= 0 ? fleetSpot(M, f, br) : null;
      if (!xy) continue;
      const p = vis(xy[0], xy[1], 80);
      if (!p) continue;
      const col = f.side === 'SOV' ? '#a83a28' : '#4a5866', x = p[0], y = p[1], t = String(Math.round(st.p)), mn = mined(S, f);
      c.font = `700 ${Math.round(11.5 * k)}px Rubik, system-ui, sans-serif`;
      const W = isz + c.measureText(t).width + 11 * k, x0 = x - W / 2, y0 = y - H / 2;
      c.fillStyle = 'rgba(16,22,30,0.32)'; rrect(c, x0 + 1, y0 + 1.6, W, H, H / 2); c.fill();
      c.fillStyle = col; rrect(c, x0, y0, W, H, H / 2); c.fill();
      c.lineWidth = 1.6; c.strokeStyle = mn ? '#f0b418' : 'rgba(255,250,238,0.95)';
      if (mn) c.setLineDash([3.5, 2.5]);
      rrect(c, x0, y0, W, H, H / 2); c.stroke(); c.setLineDash([]);
      drawIcon(c, 'warship', x0 + 3 * k + isz / 2, y - 0.5, isz, '#fff');
      c.fillStyle = '#fff'; c.textAlign = 'left'; c.textBaseline = 'middle'; c.fillText(t, x0 + isz + 4.5 * k, y + 0.5);
      let h = H;
      if (sc >= 0.55) {
        // название — над плашкой (к открытому морю, не на подписи города-базы)
        c.font = '700 10px Rubik, system-ui, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'bottom';
        const n = mn ? `${f.n} (заперт)` : f.n;
        c.lineWidth = 3; c.lineJoin = 'round'; c.strokeStyle = 'rgba(255,250,238,0.95)'; c.strokeText(n, x, y0 - 2);
        c.fillStyle = col; c.fillText(n, x, y0 - 2);
        h = H + 14;
      }
      this.fleetHit.push({ id: f.id, x: x0 - 4, y: y0 - 4 - (h - H), w: W + 8, h: h + 8 });
    }
  }
  // поверх фишек: стрелки наступлений и штабы фронтов
  drawHQs(c, vis) {
    const M = this.M, sc = this.view.sc;
    for (const { g, q, F, tgt } of this.hqQ || []) {
      if (tgt >= 0 && M.reg[tgt]) {
        const T = M.reg[tgt], a = this.toScr(g.x, g.y), b = this.toScr(T.x, T.y);
        this.bigArrow(c, a[0], a[1], b[0], b[1], q.col);
      }
    }
    for (const { g, q, F } of this.hqQ || []) {
      const p = vis(g.x, g.y, 80);
      if (p && sc >= 0.3) this.drawHQ(c, p[0], p[1], F, q.col, q.f);
    }
  }
  // штаб фронта: портрет генерала в рамке цвета фронта и название
  drawHQ(c, x, y, F, col, f) {
    const img = this.genImg?.(this.S.gen?.[this.side]?.[f]), w = 24, h = 29, name = String(F.n || '').replace(/ фронт$/, '');
    c.font = '700 10px Rubik, system-ui, sans-serif';
    const tw = c.measureText(name).width, W = w + 8 + tw + 8;
    const x0 = x - W / 2, y0 = y - h / 2 - 2;
    c.fillStyle = 'rgba(28,26,22,0.35)'; rrect(c, x0 + 1.5, y0 + 2, W, h + 4, 5); c.fill();
    c.fillStyle = 'rgba(252,248,236,0.96)'; rrect(c, x0, y0, W, h + 4, 5); c.fill();
    c.lineWidth = 2; c.strokeStyle = col; rrect(c, x0, y0, W, h + 4, 5); c.stroke();
    c.fillStyle = col; c.fillRect(x0 + 2, y0 + 2, w, h);
    if (img && img.complete && img.naturalWidth) c.drawImage(img, x0 + 2, y0 + 2, w, h);
    c.fillStyle = '#2a241c'; c.textAlign = 'left'; c.textBaseline = 'middle';
    c.fillText(name, x0 + w + 7, y0 + (h + 4) / 2 - 4);
    c.font = '600 8.5px Rubik, system-ui, sans-serif'; c.fillStyle = '#6a5a44';
    const S = this.S, P = this.side, po = S.post?.[P]?.[f], man = S.fr?.[P]?.[f]?.man;
    c.fillText(man ? 'вручную' : po === 'atk' ? 'наступление' : po === 'ret' ? 'отход' : 'оборона', x0 + w + 7, y0 + (h + 4) / 2 + 7);
    this.hqHit.push({ f, x: x0, y: y0, w: W, h: h + 4 });
  }
  // стрелка наступления (широкая, полупрозрачная, с белой каймой)
  bigArrow(c, x0, y0, x1, y1, col) {
    const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy);
    if (L < 20) return;
    const ux = dx / L, uy = dy / L, nx = -uy, ny = ux, w = 7, hw = 15, hl = 22;
    const bx = x1 - ux * hl, by = y1 - uy * hl, bend = Math.min(60, L * 0.15);
    const mx = (x0 + bx) / 2 + nx * bend, my = (y0 + by) / 2 + ny * bend;
    const pts = [];
    for (let i = 0; i <= 16; i++) { const t = i / 16, a = (1 - t) * (1 - t), b = 2 * (1 - t) * t, d = t * t; pts.push([a * x0 + b * mx + d * bx, a * y0 + b * my + d * by]); }
    const L1 = [], R1 = [];
    for (let i = 0; i < pts.length; i++) {
      const p0 = pts[Math.max(0, i - 1)], p1 = pts[Math.min(pts.length - 1, i + 1)], tx = p1[0] - p0[0], ty = p1[1] - p0[1], tl = Math.hypot(tx, ty) || 1, ww = w * (0.55 + 0.45 * (i / 16));
      L1.push([pts[i][0] - (ty / tl) * ww, pts[i][1] + (tx / tl) * ww]); R1.push([pts[i][0] + (ty / tl) * ww, pts[i][1] - (tx / tl) * ww]);
    }
    const pe = pts[pts.length - 1], pp = pts[pts.length - 2], ex = pe[0] - pp[0], ey = pe[1] - pp[1], el = Math.hypot(ex, ey) || 1, ax = ex / el, ay = ey / el;
    c.beginPath();
    c.moveTo(L1[0][0], L1[0][1]);
    for (const q of L1) c.lineTo(q[0], q[1]);
    c.lineTo(pe[0] - ay * hw, pe[1] + ax * hw); c.lineTo(pe[0] + ax * hl, pe[1] + ay * hl); c.lineTo(pe[0] + ay * hw, pe[1] - ax * hw);
    for (let i = R1.length - 1; i >= 0; i--) c.lineTo(R1[i][0], R1[i][1]);
    c.closePath();
    c.globalAlpha = 0.72; c.fillStyle = col; c.fill(); c.globalAlpha = 1;
    c.lineWidth = 1.6; c.strokeStyle = 'rgba(255,255,255,0.9)'; c.stroke();
  }
  // постройки области: значки у центра
  drawBuildings(c, vis) {
    const S = this.S, M = this.M, sc = this.view.sc;
    for (let r = 0; r < M.R; r++) {
      const g = M.reg[r], items = this.bldItems ? this.bldItems(S, r) : [];
      if (!items.length) continue;
      const p = vis(g.x, g.y);
      if (!p) continue;
      let x = p[0] - (items.length - 1) * 7.5, y = p[1] + (g.city ? 14 : 0) + (sc >= 1.4 ? 4 : 0);
      for (const [k, n] of items) {
        c.fillStyle = 'rgba(255,250,238,0.9)'; c.strokeStyle = 'rgba(70,56,40,0.6)'; c.lineWidth = 1;
        c.beginPath(); c.arc(x, y, 6.6, 0, 7); c.fill(); c.stroke();
        drawIcon(c, k, x, y, 9.5, '#4a3a2a');
        if (n > 1) { c.font = '700 8px Rubik, system-ui, sans-serif'; c.fillStyle = '#4a3a2a'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(String(n), x + 6, y + 6); }
        x += 15;
      }
    }
  }
  // слой вспышек: стрелки ударов (вырастают от исходной области), вспышки выстрелов, дым, значки боёв; погода — частицы
  drawFx() {
    const c = this.fctx, M = this.M, v = this.view, dpr = this.dpr, sc = v.sc, t = now();
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, this.w, this.h);
    const wxOn = this.wxActive();
    this.fxOn = this.marks.length > 0 || wxOn;
    if (!this.fxOn) return;
    if (wxOn) this.drawWx(c, t);
    if (!this.marks.length) return;
    const vis = (x, y, m = 40) => { const X = (x - v.x0) * sc, Y = (y - v.y0) * sc; return X > -m && Y > -m && X < this.w + m && Y < this.h + m ? [X, Y] : null; };
    for (const m of this.marks) {
      const a = clamp(1 - (t - m.t0 - m.life * 0.6) / (m.life * 0.4), 0, 1), g = M.reg[m.T];
      const to = this.toScr(g.x, g.y), col = SIDE_COL[m.side], e = clamp((t - m.t0) / 650, 0, 1), ee = 1 - (1 - e) * (1 - e);
      for (const f of m.from || []) {
        const fg = M.reg[f]; if (!fg) continue;
        const fr = this.toScr(fg.x, fg.y);
        this.arrow(c, fr[0], fr[1], fr[0] + (to[0] - fr[0]) * ee, fr[1] + (to[1] - fr[1]) * ee, `rgba(${col[0]},${col[1]},${col[2]},${0.85 * a})`, m.win ? 3.2 : 2.2, !m.win || !!m.op);
      }
    }
    for (const m of this.marks) {
      const g = M.reg[m.T], p = vis(g.x, g.y);
      if (!p) continue;
      const dt = t - m.t0, age = dt / m.life, a = clamp(1 - (age - 0.6) / 0.4, 0, 1), pulse = 1 + 0.15 * Math.sin(dt / 120);
      const sd = (m.T * 7919) % 97;
      // дым: серые клубы поднимаются и тают
      for (let k = 0; k < 3; k++) {
        const q = ((dt / 1700 + k / 3 + sd / 97) % 1), x = p[0] + ((sd * (k + 3)) % 17) - 8, y = p[1] + 4 - q * 22;
        c.fillStyle = `rgba(92,88,80,${(1 - q) * 0.32 * a})`;
        c.beginPath(); c.arc(x, y, 5 + q * 9, 0, Math.PI * 2); c.fill();
      }
      // вспышки выстрелов: в первые секунды чаще
      if (dt < m.life * 0.75) for (let k = 0; k < 4; k++) {
        const per = 420 + k * 130, q = ((dt + k * 211 + sd * 13) % per) / per;
        if (q > 0.45) continue;
        const r = q / 0.45, x = p[0] + ((sd * (k + 1) * 5) % 27) - 13, y = p[1] + ((sd * (k + 2) * 3) % 19) - 9;
        c.fillStyle = `rgba(255,226,150,${(1 - r) * 0.85 * a})`;
        c.beginPath(); c.arc(x, y, 1.5 + r * 2.5, 0, Math.PI * 2); c.fill();
        c.strokeStyle = `rgba(240,140,40,${(1 - r) * 0.6 * a})`; c.lineWidth = 1.4;
        c.beginPath(); c.arc(x, y, 3 + r * 9, 0, Math.PI * 2); c.stroke();
      }
      c.globalAlpha = a * (dt < 650 ? clamp((dt - 300) / 350, 0, 1) : 1);
      drawIcon(c, m.op === 'abn' ? 'para' : m.op === 'sea' ? 'landing' : 'boom', p[0] + 9, p[1] - 12, (m.op ? 24 : 20) * pulse, m.win ? '#f0a020' : '#c8c0b0', '#5a1a08');
      c.globalAlpha = 1;
    }
  }
  // ——— погода: частицы (дождь — косые штрихи, снег — хлопья, мороз — редкий снег с позёмкой, распутица — морось) ———
  zoneAt(x, y) {
    const M = this.M, s = 32, G = (this.zg ??= { nx: Math.ceil(M.w / s), ny: Math.ceil(M.h / s), z: null });
    G.z ??= new Int8Array(G.nx * G.ny).fill(-2);
    const i = Math.floor(x / s), j = Math.floor(y / s);
    if (i < 0 || j < 0 || i >= G.nx || j >= G.ny) return -1;
    const k = j * G.nx + i;
    if (G.z[k] === -2) { const r = regionAt(M, (i + 0.5) * s, (j + 0.5) * s); G.z[k] = r >= 0 ? M.reg[r].z : -1; }
    return G.z[k];
  }
  wxAt(px, py) { const v = this.view, z = this.zoneAt(v.x0 + px / v.sc, v.y0 + py / v.sc); return z >= 0 ? this.S.wx[z] : 'dry'; }
  // есть ли непогода на экране (проверка сеткой 5×4, кэш на кадр вида)
  wxActive() {
    if (!this.opt.wx || !this.S?.wx || !this.S.wx.some((w) => w !== 'dry')) return false;
    const v = this.view, key = `${v.x0.toFixed(0)},${v.y0.toFixed(0)},${v.sc.toFixed(3)},${this.S.turn},${this.w}`;
    if (this.wxKey === key) return this.wxOn;
    this.wxKey = key; this.wxOn = false;
    for (let j = 0; j < 4 && !this.wxOn; j++) for (let i = 0; i < 5; i++) if (this.wxAt(((i + 0.5) * this.w) / 5, ((j + 0.5) * this.h) / 4) !== 'dry') { this.wxOn = true; break; }
    return this.wxOn;
  }
  drawWx(c, t) {
    const W = this.w, H = this.h, n = Math.round(clamp((W * H) / 1500, 90, 520));
    const P = (this.wxp ??= []);
    while (P.length < n) P.push({ x: Math.random() * W, y: Math.random() * H, k: Math.random(), ph: Math.random() * 6.28 });
    P.length = n;
    const dt = Math.min(0.08, (t - (this.wxT || t)) / 1000); this.wxT = t;
    const rain = new Path2D(), snow = new Path2D();
    let nr = 0, ns = 0;
    for (const p of P) {
      const w = this.wxAt(p.x, p.y);
      if (w === 'rain' || w === 'mud') {
        if (w === 'mud' && p.k > 0.45) { p.y += 300 * dt; } else {
          const vy = 560 + p.k * 220, vx = -110;
          p.x += vx * dt; p.y += vy * dt;
          rain.moveTo(p.x, p.y); rain.lineTo(p.x - vx * 0.026, p.y - vy * 0.026); nr++;
        }
      } else if (w === 'snow' || w === 'frost') {
        const fr = w === 'frost';
        if (fr && p.k > 0.6) { p.y += 30 * dt; } else {
          p.x += (Math.sin(t / 900 + p.ph) * 18 - (fr ? 46 : 8)) * dt; p.y += (fr ? 26 : 38 + p.k * 30) * dt;
          const r = 1.2 + p.k * 1.6;
          snow.moveTo(p.x + r, p.y); snow.arc(p.x, p.y, r, 0, Math.PI * 2); ns++;
        }
      } else p.y += 200 * dt;
      if (p.y > H + 12 || p.x < -12 || p.x > W + 12) { p.y = -8 - Math.random() * 20; p.x = Math.random() * (W + 60); }
    }
    // тёмно-синие штрихи и хлопья с тенью — видны и на светлой карте, и на снегу
    if (nr) { c.strokeStyle = 'rgba(52,78,118,0.42)'; c.lineWidth = 1.2; c.lineCap = 'round'; c.stroke(rain); }
    if (ns) { c.strokeStyle = 'rgba(64,76,98,0.38)'; c.lineWidth = 0.8; c.stroke(snow); c.fillStyle = 'rgba(255,255,255,0.92)'; c.fill(snow); }
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
    c.lineWidth = 1.6 / v.sc; c.strokeStyle = '#8c2218';
    for (const f of this.pbord || []) { const p = f.p; c.beginPath(); c.moveTo(p[0], p[1]); for (let i = 2; i < p.length; i += 2) c.lineTo(p[i], p[i + 1]); c.stroke(); }
    c.restore();
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
}
export { drawIcon, drawCounter };
// подписи стран мирного времени: центр по площади областей (x, y), размер шрифта — от площади страны (k × масштаб)
function natLabels(S) {
  const M = S.M, acc = new Map();
  for (let r = 0; r < M.R; r++) {
    const n = natOf(S, r);
    if (!n || n === 'GER' || n === 'SOV' || !NAT_N[n]) continue;
    const g = M.reg[r], o = acc.get(n) || { x: 0, y: 0, a: 0 };
    o.x += g.x * g.a; o.y += g.y * g.a; o.a += g.a;
    acc.set(n, o);
  }
  const out = [];
  for (const [n, o] of acc) out.push({ n: NAT_N[n], x: o.x / o.a, y: o.y / o.a, k: Math.sqrt(o.a) / 14 });
  return out;
}
