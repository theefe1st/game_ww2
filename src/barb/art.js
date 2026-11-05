// «Барбаросса 1941» (v0.8): пиксельная графика главы — рельеф карты (порт генератора тактических карт v0.1–v0.6
// с дорогами и укреплениями), спрайты дивизий и фишки 24×20. Всё рисуется в 1 пиксель карты = 1 пиксель
// изображения и масштабируется целым множителем без сглаживания.
import { hexXY, hexAtXY } from './hex.js';

// ——— базовые помощники ———
export function rgb(h) {
  const t = parseInt(h.slice(1), 16);
  return [(t >> 16) & 255, (t >> 8) & 255, t & 255];
}
export function mix(a, b, t) {
  const p = rgb(a), q = rgb(b);
  return '#' + p.map((v, k) => Math.round(v + (q[k] - v) * t).toString(16).padStart(2, '0')).join('');
}
export const shade = (c, t) => (t < 0 ? mix(c, '#000000', -t) : mix(c, '#ffffff', t));
export function img(w, h) {
  return { w, h, data: new Uint8ClampedArray(w * h * 4) };
}
// спрайт из строк: символ → цвет палитры, «.» — прозрачно
export function spr(rows, pal) {
  const h = rows.length, w = Math.max(...rows.map((r) => r.length)), data = new Uint8ClampedArray(w * h * 4);
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const c = pal[row[x]];
      if (!c) continue;
      const [r, g, b] = rgb(c), i = (y * w + x) * 4;
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = 255;
    }
  });
  return { w, h, data };
}
export function blit(d, s, x0, y0) {
  for (let y = 0; y < s.h; y++)
    for (let x = 0; x < s.w; x++) {
      const i = (y * s.w + x) * 4;
      if (!s.data[i + 3]) continue;
      const X = x0 + x, Y = y0 + y;
      if (X < 0 || Y < 0 || X >= d.w || Y >= d.h) continue;
      const j = (Y * d.w + X) * 4;
      d.data[j] = s.data[i];
      d.data[j + 1] = s.data[i + 1];
      d.data[j + 2] = s.data[i + 2];
      d.data[j + 3] = s.data[i + 3];
    }
}
export function rect(d, x0, y0, w, h, c) {
  const [r, g, b] = rgb(c);
  for (let y = y0; y < y0 + h; y++)
    for (let x = x0; x < x0 + w; x++) {
      if (x < 0 || y < 0 || x >= d.w || y >= d.h) continue;
      const j = (y * d.w + x) * 4;
      d.data[j] = r;
      d.data[j + 1] = g;
      d.data[j + 2] = b;
      d.data[j + 3] = 255;
    }
}
// цифры 3×5
const DIG = ['111101101101111', '010110010010111', '111001111100111', '111001111001111', '101101111001001', '111100111001111', '111100111101111', '111001010010010', '111101111101111', '111101111001111'];
export function digits(d, x, y, str, col, outline) {
  const s = String(str).replace(/\D/g, '');
  const put = (X, Y, c) => {
    for (let k = 0; k < s.length; k++) {
      const m = DIG[+s[k]];
      for (let p = 0; p < 15; p++) if (m[p] === '1') rect(d, X + k * 4 + (p % 3), Y + ((p / 3) | 0), 1, 1, c);
    }
  };
  if (outline) for (const [a, b] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, 1], [-1, 1], [1, -1]]) put(x + a, y + b, outline);
  put(x, y, col);
  return s.length * 4 - 1;
}
export function hash(a, b, s = 0) {
  let r = (a * 374761393 + b * 668265263 + s * 1442695041) | 0;
  r = Math.imul(r ^ (r >>> 13), 1274126177);
  return ((r ^ (r >>> 16)) >>> 0) / 4294967296;
}
function vnoise(x, y, s) {
  const r = Math.floor(x), i = Math.floor(y), a = x - r, o = y - i, sa = a * a * (3 - 2 * a), so = o * o * (3 - 2 * o);
  const l = hash(r, i, s), u = hash(r + 1, i, s), d = hash(r, i + 1, s), f = hash(r + 1, i + 1, s);
  return l + (u - l) * sa + (d - l) * so + (l - u - d + f) * sa * so;
}
export function toCanvas(im) {
  const c = document.createElement('canvas');
  c.width = im.w;
  c.height = im.h;
  const x = c.getContext('2d'), d = x.createImageData(im.w, im.h);
  d.data.set(im.data);
  x.putImageData(d, 0, 0);
  return c;
}

// ——— рельеф ———
const PAL = {
  plains: ['#93b05c', '#88a653', '#9cb764'], forest: ['#5f8b47', '#577f40'], hills: ['#a8a462', '#9c9858'],
  mount: ['#8e8676', '#857d6e'], marsh: ['#7a9a6c', '#6f8f62'], urban: ['#9aa77a', '#909d70'],
};
const TREE_P = [
  { d: '#2c5229', m: '#3b6d34', l: '#5a8f43', t: '#4a3a28' },
  { d: '#33582a', m: '#47783a', l: '#6b9c4c', t: '#4a3a28' },
  { d: '#5a5a24', m: '#8a7a30', l: '#b39a3c', t: '#4a3a28' },
];
const TREES = [['.d.', 'dmd', 'mlm', '.t.'], ['..d..', '.dmd.', 'dmmld', '.mlm.', '..t..']];
const HILL = ['..ll..', '.lmmd.', 'lmmmdd'], HILL_P = { l: '#c8c37f', m: '#a8a462', d: '#7f7944' };
const MNT = ['...w...', '..wwd..', '.lwmdd.', '.lmmdd.', 'lmmmmdd'], MNT2 = ['..w..', '.lmd.', 'lmmdd'], MNT_P = { w: '#f4f4f0', l: '#b5ac9b', m: '#8e8676', d: '#5b5349' };
const REED = ['r.r', 'r.r', '.r.'], REED_P = { r: '#3f5f35' };
const CITY_P = { t: '#5b544b', T: '#8a8278', R: '#b5523b', w: '#ddd4c4', d: '#6b6359' };
const CITY_B = ['....t.....', '...tTt....', '.RR.Tw.RR.', 'RRRRwwRRRR', 'wwwwwwwwww', 'wdwwdwwdww', 'wwwwwwwwww'];
const CITY_S = ['.RR..', 'RRRR.', 'wwww.', 'wdww.'];
const FORT = ['k.k.k.k', 'kkkkkkk', 'kgggggk'], FORT_P = { k: '#2a2a2a', g: '#8a8a84' };
export function terrain(M, forts = []) {
  const g = M.g, W = g.pxW, H = g.pxH, base = img(W, H), cls = M.cls;
  const hx = new Int16Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) hx[y * W + x] = hexAtXY(g, x + 0.5, y + 0.5);
  // пиксель суши → гекс суши (у берега — ближайший сухопутный сосед)
  const disp = new Int16Array(W * H).fill(-1);
  for (let p = 0; p < W * H; p++) {
    const h = hx[p];
    if (cls[p] !== 1 || h < 0) continue;
    if (M.terrain[h] >= 2) {
      disp[p] = h;
      continue;
    }
    const px = (p % W) + 0.5, py = ((p / W) | 0) + 0.5;
    let b = -1, bd = 1e9;
    for (const j of M.nbr[h]) {
      if (M.terrain[j] < 2) continue;
      const [X, Y] = hexXY(g, j), dd = (X - px) ** 2 + (Y - py) ** 2;
      if (dd < bd) (bd = dd), (b = j);
    }
    disp[p] = b;
    if (b < 0) cls[p] = 0;
  }
  // расстояние до берега (для глубины воды)
  const dist = new Uint8Array(W * H).fill(255);
  let fr = [];
  for (let p = 0; p < W * H; p++) if (cls[p] === 1) (dist[p] = 0), fr.push(p);
  for (let k = 1; k <= 10 && fr.length; k++) {
    const nf = [];
    for (const p of fr) {
      const x = p % W;
      for (const q of [p - 1, p + 1, p - W, p + W]) {
        if (q < 0 || q >= W * H || (q === p - 1 && x === 0) || (q === p + 1 && x === W - 1)) continue;
        if (dist[q] > k) (dist[q] = k), nf.push(q);
      }
    }
    fr = nf;
  }
  const put = (p, c) => {
    const [r, gg, b] = rgb(c);
    base.data[p * 4] = r;
    base.data[p * 4 + 1] = gg;
    base.data[p * 4 + 2] = b;
    base.data[p * 4 + 3] = 255;
  };
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const p = y * W + x, c = cls[p];
      if (c === 0) {
        const e = dist[p];
        let col = e <= 1 ? '#5f97c6' : e <= 3 ? '#3a6f9e' : e <= 6 ? '#2f6290' : '#28567f';
        if (e > 3 && y % 5 === 0 && (x + ((y / 5) | 0) * 7) % 13 < 3 && hash(x >> 4, y, 2) > 0.45) col = '#4378a8';
        put(p, col);
      } else if (c === 2) put(p, y % 4 === 0 && (x + y) % 9 < 2 ? '#5d98c8' : '#3b78ab');
      else {
        const t = M.terrain[disp[p]], n = vnoise(x / 9, y / 9, 3), u = hash(x, y, 1);
        let col;
        if (t === 3) col = u < 0.5 + (n - 0.5) * 0.6 ? PAL.forest[0] : PAL.forest[1];
        else if (t === 4) col = u < 0.5 + (n - 0.5) * 0.6 ? PAL.hills[0] : PAL.hills[1];
        else if (t === 5) col = u < 0.5 + (n - 0.5) * 0.6 ? PAL.mount[0] : PAL.mount[1];
        else if (t === 6) col = u < 0.5 + (n - 0.5) * 0.6 ? PAL.marsh[0] : PAL.marsh[1];
        else if (t === 7) col = u < 0.5 ? PAL.urban[0] : PAL.urban[1];
        else col = u < 0.04 ? PAL.plains[2] : u < 0.5 + (n - 0.5) * 0.7 ? PAL.plains[0] : PAL.plains[1];
        if ((x > 0 && cls[p - 1] === 0) || (x < W - 1 && cls[p + 1] === 0) || (y > 0 && cls[p - W] === 0) || (y < H - 1 && cls[p + W] === 0)) col = '#cdc38d';
        put(p, col);
      }
    }
  // деревья, холмы, горы, камыши — только внутри своего гекса
  const stamp = (s, x0, y0, h) => {
    for (let y = 0; y < s.h; y++)
      for (let x = 0; x < s.w; x++) {
        const i = (y * s.w + x) * 4;
        if (!s.data[i + 3]) continue;
        const X = x0 + x, Y = y0 + y;
        if (X < 0 || Y < 0 || X >= W || Y >= H) continue;
        const p = Y * W + X;
        if (disp[p] === h && cls[p] === 1) (base.data[p * 4] = s.data[i]), (base.data[p * 4 + 1] = s.data[i + 1]), (base.data[p * 4 + 2] = s.data[i + 2]);
      }
  };
  const trees = TREE_P.map((p) => TREES.map((t) => spr(t, p))), hill = spr(HILL, HILL_P), mnt = spr(MNT, MNT_P), mnt2 = spr(MNT2, MNT_P);
  const reed = spr(REED, REED_P), pud = spr(['.www.', 'wwwww', '.www.'], { w: '#5a8f96' });
  for (let h = 0; h < M.N; h++) {
    const t = M.terrain[h];
    if (t < 2) continue;
    const [fx, fy] = hexXY(g, h), X = Math.round(fx), Y = Math.round(fy);
    if (t === 3)
      for (let e = -14; e <= 12; e += 5)
        for (let n = -13; n <= 11; n += 5) {
          const a = Math.floor(hash(h, n * 31 + e, 4) * 3) - 1, b = Math.floor(hash(h, e * 17 + n, 5) * 3) - 1;
          if (hash(h, n + e * 7, 6) < 0.18) continue;
          const tr = trees[hash(h, n * 3 + e, 7) < 0.15 ? 2 : hash(h, n, 8) < 0.5 ? 0 : 1][hash(h, e, 9) < 0.5 ? 0 : 1];
          stamp(tr, X + n + a + ((e / 5) & 1 ? 2 : 0), Y + e + b, h);
        }
    else if (t === 4)
      [[-9, -5], [2, -9], [-3, 3], [6, 1], [-10, 6], [3, 9]].forEach(([a, b], k) => {
        if (hash(h, k, 10) < 0.8) stamp(hill, X + a - 3 + Math.floor(hash(h, k, 11) * 3), Y + b, h);
      });
    else if (t === 5) {
      stamp(mnt, X - 3, Y - 4, h);
      stamp(mnt2, X - 11, Y - 1, h);
      stamp(mnt2, X + 5, Y, h);
    } else if (t === 6)
      for (let k = 0; k < 7; k++) {
        const a = Math.floor(hash(h, k, 13) * 22) - 11, b = Math.floor(hash(h, k, 14) * 24) - 12;
        stamp(k % 2 ? pud : reed, X + a, Y + b, h);
      }
  }
  // реки, дороги, города, укрепления — отдельным слоем поверх
  const decor = img(W, H);
  const dot = (x, y, c) => {
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const j = (y * W + x) * 4;
    decor.data[j] = c[0];
    decor.data[j + 1] = c[1];
    decor.data[j + 2] = c[2];
    decor.data[j + 3] = 255;
  };
  const rv = rgb('#3e7fc1'), rv2 = rgb('#2f6aa8');
  for (const r of M.rivers)
    for (let k = 0; k + 3 < r.p.length; k += 2) {
      const x0 = r.p[k], y0 = r.p[k + 1], x1 = r.p[k + 2], y1 = r.p[k + 3], n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 1.5));
      for (let i = 0; i <= n; i++) {
        const x = Math.floor(x0 + ((x1 - x0) * i) / n), y = Math.floor(y0 + ((y1 - y0) * i) / n);
        if (cls[y * W + x] === 1) {
          dot(x, y, rv);
          if (r.w >= 2) dot(x + 1, y, rv2), dot(x, y + 1, rv2);
        }
      }
    }
  // дороги: светлая колея с тенью; на реке — мост
  const rd = rgb('#d9c88e'), rs = rgb('#8f7d52'), br = rgb('#efe6c8');
  for (const line of M.roads || []) {
    for (let k = 0; k + 1 < line.length; k++) {
      const [x0, y0] = hexXY(g, line[k]), [x1, y1] = hexXY(g, line[k + 1]);
      const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0)));
      const wob = (hash(line[k], line[k + 1], 21) - 0.5) * 3;
      for (let i = 0; i <= n; i++) {
        const t = i / n, bend = Math.sin(t * Math.PI) * wob;
        const x = Math.round(x0 + (x1 - x0) * t + bend * ((y1 - y0) / n)), y = Math.round(y0 + (y1 - y0) * t - bend * ((x1 - x0) / n));
        const p = y * W + x;
        if (p < 0 || p >= W * H || cls[p] !== 1) continue;
        const j = p * 4, onRiver = decor.data[j + 3] && decor.data[j + 2] > 150 && decor.data[j] < 80;
        dot(x, y + 1, rs);
        dot(x, y, onRiver ? br : rd);
      }
    }
  }
  const cb = spr(CITY_B, CITY_P), cs = spr(CITY_S, CITY_P), ft = spr(FORT, FORT_P);
  for (const c of M.cities) {
    const [x, y] = hexXY(g, c.hex), s = c.vp >= 3 ? cb : cs;
    blit(decor, s, Math.round(x - s.w / 2), Math.round(y - s.h / 2) + 1);
  }
  for (const h of forts) {
    const [x, y] = hexXY(g, h);
    blit(decor, ft, Math.round(x - 3), Math.round(y + 10));
  }
  // границы гексов (для сетки)
  const edge = new Uint8Array(W * H);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const p = y * W + x, a = disp[p];
      if (a < 0) continue;
      if ((x + 1 < W && disp[p + 1] !== a && disp[p + 1] >= 0) || (y + 1 < H && disp[p + W] !== a && disp[p + W] >= 0)) edge[p] = 1;
    }
  return { base, decor, disp, edge, W, H };
}

// ——— дивизии: спрайты 16×10 и фишки 24×20 ———
const UNIT = {
  inf: ['......kkk.......', '.....khhhk......', '.....kssk.......', '....kbbbbkkkkkkk', '...kbbbbbbwwwwk.', '...kbbkbbkkkkk..', '....kbbbbk......', '....kbkkbk......', '...kbk..kbk.....', '...kk....kk.....'],
  arm: ['................', '.....kkkkk......', '....kbbbbbkkkkkk', '....kbbbbbkgggk.', '.kkkkkkkkkkkkk..', 'kbbbbbbbbbbbbbk.', 'kddddddddddddddk', 'kdgkgkgkgkgkgdk.', '.kdddddddddddk..', '..kkkkkkkkkkkk..'],
  cav: ['......kkk.......', '.....khhhk......', '.....kssk....kk.', '....kbbbbk..kHHk', '..kkkbbbbkkkHHk.', '.kHHHHHHHHHHHHk.', 'kHHHHHHHHHHHHk..', '.kHk.kHk.kHkHk..', '.kHk.kHk..kHk...', '.kk...kk...kk...'],
  mot: ['................', '.kkkkkkkkk......', '.kcccccccckkkk..', '.kcccccccckwwbk.', '.kcccccccckbbbbk', '.kkkkkkkkkkbbbbk', 'kddddddddddddddk', 'kdkgkddddddkgkdk', '..kgk......kgk..', '...k........k...'],
  gar: ['................', '..kk..kkkk..kk..', '..kSk.kSSk.kSk..', '..kSSkkSSkkSSk..', '..kSSSSSSSSSSk..', '..kSSSkkkkSSSk..', '..kSSSkDDkSSSk..', '..kSSSkDDkSSSk..', '..kkkkkkkkkkkk..', '................'],
};
const UPAL = {
  GER: { body: '#6c7366', dark: '#4a4f47', helmet: '#59604f', canvas: '#7f8473' },
  SOV: { body: '#7a7243', dark: '#575130', helmet: '#4f6a3a', canvas: '#8a8257' },
};
const sprCache = new Map();
export function unitSpr(t, nat) {
  const k = t + nat;
  let s = sprCache.get(k);
  if (s) return s;
  const n = UPAL[nat] || UPAL.GER;
  s = spr(UNIT[t] || UNIT.inf, { k: '#16181a', b: n.body, d: n.dark, h: n.helmet, s: '#e0b48a', w: '#6b4a2b', g: '#9aa0a6', H: '#7a5330', c: n.canvas, S: '#9a9184', D: '#3a3028' });
  sprCache.set(k, s);
  return s;
}
export const CW = 24, CH = 20;
// цвета плашек: свои (под командованием игрока) — ярче, соседи — приглушённее
export const PLATE = {
  GER: { cmd: ['#b9bec4', '#5b6068'], ally: ['#8d9297', '#464a50'] },
  SOV: { cmd: ['#d6806b', '#7a2a20'], ally: ['#a86f60', '#55271f'] },
};
const orgCol = (k) => (k > 0.6 ? '#62d36b' : k > 0.3 ? '#e8c24a' : '#e0574b');
const cCache = new Map();
// фишка: u — дивизия, k — доля организации, cut — без снабжения
export function counter(u, k, cut, lv) {
  const band = k > 0.6 ? 2 : k > 0.3 ? 1 : 0, key = `${u.side}|${u.t}|${u.num}|${u.cmd}|${u.str}|${band}|${cut ? 1 : 0}|${lv}`;
  let c = cCache.get(key);
  if (c) return c;
  const d = img(CW, CH), P = PLATE[u.side][u.cmd ? 'cmd' : 'ally'];
  rect(d, 0, 0, CW, CH, '#121416');
  rect(d, 1, 1, CW - 2, CH - 2, P[0]);
  rect(d, 1, 1, CW - 2, 1, shade(P[0], 0.25));
  rect(d, 1, 12, CW - 2, CH - 13, P[1]);
  if (!u.cmd) rect(d, 1, 1, 3, 1, '#121416'), rect(d, 1, 2, 2, 1, '#121416'), rect(d, 1, 3, 1, 1, '#121416');
  blit(d, unitSpr(u.t, u.side), 4, 2);
  if (u.t !== 'gar') digits(d, 2, 13, u.num, '#f4f1e6');
  // сила: 8 делений по 1,25 шага
  const n = Math.max(1, Math.round((u.str / 10) * 8));
  rect(d, 14, 14, 8, 3, '#121416');
  rect(d, 14, 14, n, 3, orgCol(k));
  rect(d, 14, 17, 8, 1, shade(P[1], -0.3));
  for (let i = 0; i < lv; i++) rect(d, CW - 4, 2 + i * 3, 2, 2, '#e8c24a');
  if (cut) rect(d, 1, 3, 2, 5, '#ff4a3a'), rect(d, 1, 9, 2, 2, '#ff4a3a');
  c = toCanvas(d);
  cCache.set(key, c);
  return c;
}
