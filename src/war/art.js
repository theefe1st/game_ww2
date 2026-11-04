// «Фронт 1941–1945» (v0.9): графика стратегической карты. Пиксельный рельеф Европы в масштабе 1 пиксель карты =
// 1 пиксель изображения (гексы R = 8, как в src/data/eu41.json), реки по сторонам гексов (как в правилах), слой
// владельцев (заливка стран, штриховка нейтралов и котлов), фишки дивизий 24×20 в стиле «Барбароссы», флаги.
import { hexXY, hexAtXY } from '../barb/hex.js';
import { rgb, img, spr, blit, rect, digits, hash, toCanvas, shade, unitSpr } from '../barb/art.js';

export { toCanvas };
const EDGE = [[0, 1], [5, 0], [4, 5], [3, 4], [2, 3], [1, 2]];
const COR = [...Array(6)].map((_, i) => [Math.cos(((60 * i - 30) * Math.PI) / 180), Math.sin(((60 * i - 30) * Math.PI) / 180)]);
export const corner = (R, i) => [COR[i][0] * R, COR[i][1] * R];
export { EDGE };

function vnoise(x, y, s) {
  const r = Math.floor(x), i = Math.floor(y), a = x - r, o = y - i, sa = a * a * (3 - 2 * a), so = o * o * (3 - 2 * o);
  const l = hash(r, i, s), u = hash(r + 1, i, s), d = hash(r, i + 1, s), f = hash(r + 1, i + 1, s);
  return l + (u - l) * sa + (d - l) * so + (l - u - d + f) * sa * so;
}
// ——— палитра рельефа (0 море, 1 озеро, 2 равнина, 3 лес, 4 холмы, 5 горы, 6 болота, 7 степь, 8 тундра) ———
const PAL = {
  2: ['#9db45f', '#93aa57', '#a6bc68'],
  3: ['#6a9250', '#618848'],
  4: ['#aea66a', '#a39b60'],
  5: ['#958c7b', '#8b8272'],
  6: ['#80a073', '#76966a'],
  7: ['#c9c07e', '#c0b775', '#d2c988'],
  8: ['#a9b5a0', '#a0ac97'],
};
const TREE_P = [
  { d: '#2c5229', m: '#3b6d34', l: '#5a8f43', t: '#4a3a28' },
  { d: '#33582a', m: '#47783a', l: '#6b9c4c', t: '#4a3a28' },
];
const TREES = [['.d.', 'dmd', 'mlm', '.t.'], ['..d..', '.dmd.', 'dmmld', '.mlm.', '..t..']];
const HILL = ['..ll..', '.lmmd.', 'lmmmdd'], HILL_P = { l: '#cdc68a', m: '#aea66a', d: '#837c4a' };
const MNT = ['...w...', '..wwd..', '.lwmdd.', '.lmmdd.', 'lmmmmdd'], MNT2 = ['..w..', '.lmd.', 'lmmdd'], MNT_P = { w: '#f4f4f0', l: '#b9b09f', m: '#958c7b', d: '#5e564b' };
const REED = ['r.r', 'r.r', '.r.'], REED_P = { r: '#46663c' };
const GRASS = ['g.g', '.g.'], GRASS_P = { g: '#a99f5c' };
const TUN = ['t.t'], TUN_P = { t: '#8e9a86' };

// рельеф: base — RGBA W×H, hx — гекс под пикселем
export function warTerrain(M) {
  const g = M.g, W = g.pxW, H = g.pxH, NP = W * H, T = M.terr;
  const hx = new Int16Array(NP);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) hx[y * W + x] = hexAtXY(g, x + 0.5, y + 0.5);
  // глубина моря в гексах от берега
  const dep = new Uint8Array(M.N).fill(9);
  let q = [];
  for (let h = 0; h < M.N; h++) if (T[h] >= 2) (dep[h] = 0), q.push(h);
  for (let k = 1; k <= 4 && q.length; k++) {
    const nq = [];
    for (const h of q)
      for (let d = 0; d < 6; d++) {
        const j = M.nb[h * 6 + d];
        if (j >= 0 && dep[j] > k) (dep[j] = k), nq.push(j);
      }
    q = nq;
  }
  const base = img(W, H), D = base.data;
  const land = (p) => {
    const h = hx[p];
    return h >= 0 && T[h] >= 2;
  };
  const put = (p, c) => {
    D[p * 4] = c[0];
    D[p * 4 + 1] = c[1];
    D[p * 4 + 2] = c[2];
    D[p * 4 + 3] = 255;
  };
  const C = {};
  for (const k in PAL) C[k] = PAL[k].map(rgb);
  const SEA = ['#5d93c2', '#4b82b3', '#3f74a4', '#386a98', '#33618c'].map(rgb), WAVE = rgb('#5888b7'), LAKE = rgb('#5f99c8'), LAKE2 = rgb('#77acd6');
  const SAND = rgb('#d6cc92'), FOAM = rgb('#86b8de'), VOID = rgb('#2a5079');
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const p = y * W + x, h = hx[p];
      if (h < 0) {
        put(p, VOID);
        continue;
      }
      const t = T[h];
      if (t === 0) {
        const e = Math.min(4, dep[h]);
        let c = SEA[e];
        if (e >= 2 && y % 5 === 0 && (x + ((y / 5) | 0) * 7) % 13 < 3 && hash(x >> 4, y, 2) > 0.45) c = WAVE;
        if ((x > 0 && land(p - 1)) || (x < W - 1 && land(p + 1)) || (y > 0 && land(p - W)) || (y < H - 1 && land(p + W))) c = FOAM;
        put(p, c);
        continue;
      }
      if (t === 1) {
        put(p, y % 4 === 0 && (x + y) % 9 < 2 ? LAKE2 : LAKE);
        continue;
      }
      const P = C[t] || C[2], n = vnoise(x / 9, y / 9, 3), u = hash(x, y, 1);
      let c = u < 0.5 + (n - 0.5) * 0.7 ? P[0] : P[1];
      if (P[2] && u < 0.04) c = P[2];
      if ((x > 0 && !land(p - 1) && hx[p - 1] >= 0 && T[hx[p - 1]] === 0) || (x < W - 1 && !land(p + 1) && hx[p + 1] >= 0 && T[hx[p + 1]] === 0) || (y > 0 && !land(p - W) && hx[p - W] >= 0 && T[hx[p - W]] === 0) || (y < H - 1 && !land(p + W) && hx[p + W] >= 0 && T[hx[p + W]] === 0)) c = SAND;
      put(p, c);
    }
  // значки рельефа — только внутри своего гекса
  const stamp = (s, x0, y0, h) => {
    for (let y = 0; y < s.h; y++)
      for (let x = 0; x < s.w; x++) {
        const i = (y * s.w + x) * 4;
        if (!s.data[i + 3]) continue;
        const X = x0 + x, Y = y0 + y;
        if (X < 0 || Y < 0 || X >= W || Y >= H) continue;
        const p = Y * W + X;
        if (hx[p] === h) (D[p * 4] = s.data[i]), (D[p * 4 + 1] = s.data[i + 1]), (D[p * 4 + 2] = s.data[i + 2]);
      }
  };
  const trees = TREE_P.map((p) => TREES.map((t) => spr(t, p))), hill = spr(HILL, HILL_P), mnt = spr(MNT, MNT_P), mnt2 = spr(MNT2, MNT_P);
  const reed = spr(REED, REED_P), pud = spr(['.ww.', 'wwww'], { w: '#6c9a9a' }), grass = spr(GRASS, GRASS_P), tun = spr(TUN, TUN_P);
  for (let h = 0; h < M.N; h++) {
    const t = T[h];
    if (t < 3) continue;
    const [fx, fy] = hexXY(g, h), X = Math.round(fx), Y = Math.round(fy);
    if (t === 3)
      [[-5, -6], [1, -7], [-7, -1], [-1, -2], [4, -1], [-4, 3], [2, 3], [-1, 7]].forEach(([a, b], k) => {
        if (hash(h, k, 6) < 0.2) return;
        stamp(trees[hash(h, k, 7) < 0.5 ? 0 : 1][hash(h, k, 9) < 0.6 ? 0 : 1], X + a - 1, Y + b - 2, h);
      });
    else if (t === 4)
      [[-6, -4], [1, -6], [-3, 2], [2, 3]].forEach(([a, b], k) => {
        if (hash(h, k, 10) < 0.75) stamp(hill, X + a - 2, Y + b, h);
      });
    else if (t === 5) {
      stamp(mnt, X - 3, Y - 5, h);
      stamp(mnt2, X - 7, Y + 1, h);
      stamp(mnt2, X + 2, Y + 2, h);
    } else if (t === 6)
      for (let k = 0; k < 5; k++) stamp(k % 2 ? pud : reed, X + Math.floor(hash(h, k, 13) * 12) - 6, Y + Math.floor(hash(h, k, 14) * 12) - 6, h);
    else if (t === 7) for (let k = 0; k < 3; k++) hash(h, k, 15) < 0.6 && stamp(grass, X + Math.floor(hash(h, k, 16) * 10) - 5, Y + Math.floor(hash(h, k, 17) * 10) - 5, h);
    else if (t === 8) for (let k = 0; k < 3; k++) stamp(tun, X + Math.floor(hash(h, k, 18) * 10) - 5, Y + Math.floor(hash(h, k, 19) * 10) - 5, h);
  }
  // реки — по сторонам гексов (как в правилах боя): крупные — в 2 пикселя
  const RV = rgb('#3b7cc0'), RV2 = rgb('#2f69a6');
  const line = (x0, y0, x1, y1, c, w2) => {
    const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 1.4));
    for (let i = 0; i <= n; i++) {
      const x = Math.floor(x0 + ((x1 - x0) * i) / n), y = Math.floor(y0 + ((y1 - y0) * i) / n);
      if (x < 0 || y < 0 || x >= W || y >= H) continue;
      const p = y * W + x;
      if (!land(p)) continue;
      put(p, c);
      if (w2 && x + 1 < W && land(p + 1)) put(p + 1, RV2);
    }
  };
  for (let h = 0; h < M.N; h++) {
    if (T[h] < 2 || !M.riv[h]) continue;
    const [cx, cy] = hexXY(g, h);
    for (let d = 0; d < 3; d++) {
      // каждая сторона — один раз (направления 0–2; 3–5 рисует сосед)
      if (!M.river(h, d)) continue;
      const [a, b] = EDGE[d], A = corner(g.R, a), B = corner(g.R, b);
      line(cx + A[0], cy + A[1], cx + B[0], cy + B[1], RV, M.bigRiver(h, d));
    }
    for (let d = 3; d < 6; d++) {
      if (!M.river(h, d)) continue;
      const j = M.nb[h * 6 + d];
      if (j >= 0 && T[j] >= 2 && M.river(j, (d + 3) % 6)) continue;
      const [a, b] = EDGE[d], A = corner(g.R, a), B = corner(g.R, b);
      line(cx + A[0], cy + A[1], cx + B[0], cy + B[1], RV, M.bigRiver(h, d));
    }
  }
  return { base, hx, W, H };
}

// ——— владельцы ———
// цвета наций: заливка карты (tint), плашки фишек (cmd — свои, ally — союзники/противник), флаг
export const NATC = {
  GER: { tint: '#56606b', a: 0.34, plate: ['#b9bec4', '#5b6068'], n: 'Германия' },
  FIN: { tint: '#dfe8f2', a: 0.34, plate: ['#e3e8ee', '#4f6f9a'], n: 'Финляндия' },
  ROM: { tint: '#c7a23e', a: 0.34, plate: ['#dcc67c', '#7a6224'], n: 'Румыния' },
  HUN: { tint: '#6f8f4a', a: 0.34, plate: ['#bccb92', '#4f6a33'], n: 'Венгрия' },
  ITA: { tint: '#3f8a52', a: 0.34, plate: ['#a9caa0', '#3f6a3a'], n: 'Италия' },
  SVK: { tint: '#5d7fb5', a: 0.34, plate: ['#bac7dd', '#3e5c8a'], n: 'Словакия' },
  CRO: { tint: '#9a5d7a', a: 0.3, plate: ['#d3b0c0', '#6a3a52'], n: 'Хорватия' },
  BUL: { tint: '#7b8f6a', a: 0.28, plate: ['#c0c8b0', '#4f5f40'], n: 'Болгария' },
  SOV: { tint: '#b8392a', a: 0.32, plate: ['#d6806b', '#7a2a20'], n: 'СССР' },
};
const NEUTRAL = rgb('#76766c');
// слой владельцев: заливка по нациям, нейтралы — серая штриховка, свои гексы без снабжения — тёмная штриховка
export function ownerLayer(M, hx, S, side, out) {
  const W = M.g.pxW, H = M.g.pxH, D = out.data, N = M.nations;
  const cols = N.map((n) => (NATC[n] ? [...rgb(NATC[n].tint), Math.round(NATC[n].a * 255)] : null));
  const sup = S && side ? S.supL?.[side] : null, con = S && side ? S.supC?.[side] : null;
  const own = S ? S.own : M.own0, nside = S ? S.nside : null;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const p = y * W + x, h = hx[p], j = p * 4;
      if (h < 0 || M.terr[h] < 2) {
        D[j + 3] = 0;
        continue;
      }
      const o = own[h], c = cols[o];
      if (!c || (nside && !nside[o])) {
        // нейтралы и страны вне игры
        const st = (x + y) % 6 === 0;
        D[j] = NEUTRAL[0];
        D[j + 1] = NEUTRAL[1];
        D[j + 2] = NEUTRAL[2];
        D[j + 3] = st ? 150 : 95;
        continue;
      }
      D[j] = c[0];
      D[j + 1] = c[1];
      D[j + 2] = c[2];
      D[j + 3] = c[3];
      if (sup && sup[h] === 0 && nside[o] === side && (x - y) % 4 === 0) {
        // без снабжения: в окружении — красноватая, оторваны от станций — тёмная штриховка
        const enc = con && !con[h];
        D[j] = enc ? 120 : 30;
        D[j + 1] = enc ? 20 : 26;
        D[j + 2] = enc ? 16 : 24;
        D[j + 3] = 170;
      }
    }
  return out;
}

// ——— фишки дивизий 24×20 ———
export const CW = 24, CH = 20;
const orgCol = (k) => (k > 0.6 ? '#62d36b' : k > 0.3 ? '#e8c24a' : '#e0574b');
const SPRT = { inf: 'inf', mtn: 'inf', sec: 'inf', gar: 'gar', cav: 'cav', mot: 'mot', arm: 'arm' };
const cCache = new Map();
// u — дивизия; o: { cmd — под командованием игрока, k — доля организации, cut — без снабжения, enc — в окружении, lv — опыт 0–3 }
export function warCounter(u, o) {
  const band = o.k > 0.6 ? 2 : o.k > 0.3 ? 1 : 0, str = Math.max(1, Math.min(8, Math.round((u.men / Math.max(1, u.menM)) * 8)));
  const key = `${u.nat}|${u.t}|${u.num}|${o.cmd ? 1 : 0}|${str}|${band}|${o.cut ? 1 : 0}|${o.enc ? 1 : 0}|${o.lv}|${u.gds ? 1 : 0}|${o.done ? 1 : 0}`;
  let c = cCache.get(key);
  if (c) return c;
  if (cCache.size > 3000) cCache.clear();
  const d = img(CW, CH), P0 = (NATC[u.nat] || NATC.GER).plate, P = o.cmd ? P0 : [shade(P0[0], -0.18), shade(P0[1], -0.12)];
  rect(d, 0, 0, CW, CH, u.gds ? '#e8c24a' : '#121416');
  rect(d, 1, 1, CW - 2, CH - 2, P[0]);
  rect(d, 1, 1, CW - 2, 1, shade(P[0], 0.25));
  rect(d, 1, 12, CW - 2, CH - 13, P[1]);
  blit(d, unitSpr(SPRT[u.t] || 'inf', u.side === 'SOV' ? 'SOV' : 'GER'), 4, 2);
  if (u.t === 'mtn') rect(d, 2, 2, 1, 1, '#f4f4f0'), rect(d, 1, 3, 3, 1, '#f4f4f0');
  if (u.t !== 'gar') digits(d, 2, 13, String(u.num).slice(0, 3), '#f4f1e6');
  rect(d, 14, 14, 8, 3, '#121416');
  rect(d, 14, 14, str, 3, orgCol(o.k));
  for (let i = 0; i < o.lv; i++) rect(d, CW - 4, 2 + i * 3, 2, 2, '#e8c24a');
  if (o.enc) rect(d, 1, 1, CW - 2, 1, '#ff4a3a'), rect(d, 1, 1, 1, CH - 2, '#ff4a3a'), rect(d, CW - 2, 1, 1, CH - 2, '#ff4a3a');
  if (o.cut) rect(d, 1, 3, 2, 5, '#ff4a3a'), rect(d, 1, 9, 2, 2, '#ff4a3a');
  if (o.done) for (let y = 1; y < CH - 1; y++) for (let x = 1; x < CW - 1; x++) if ((x + y) % 2 === 0) {
    const j = (y * CW + x) * 4;
    d.data[j] = d.data[j] * 0.55;
    d.data[j + 1] = d.data[j + 1] * 0.55;
    d.data[j + 2] = d.data[j + 2] * 0.55;
  }
  c = toCanvas(d);
  cCache.set(key, c);
  return c;
}

// ——— флаги 18×12 (для интерфейса) ———
const FLAG = {
  GER: (d) => { rect(d, 0, 0, 18, 12, '#7d848c'); rect(d, 7, 1, 4, 10, '#f3f4f6'); rect(d, 4, 4, 10, 4, '#f3f4f6'); rect(d, 8, 2, 2, 8, '#1d1d1d'); rect(d, 5, 5, 8, 2, '#1d1d1d'); },
  SOV: (d) => { rect(d, 0, 0, 18, 12, '#c3261c'); rect(d, 3, 2, 3, 3, '#f2c94c'); rect(d, 4, 1, 1, 1, '#f2c94c'); rect(d, 2, 3, 1, 1, '#f2c94c'); rect(d, 6, 3, 1, 1, '#f2c94c'); },
  FIN: (d) => { rect(d, 0, 0, 18, 12, '#f3f4f6'); rect(d, 5, 0, 3, 12, '#1c4f9c'); rect(d, 0, 5, 18, 3, '#1c4f9c'); },
  ROM: (d) => { rect(d, 0, 0, 6, 12, '#1d3f9a'); rect(d, 6, 0, 6, 12, '#f2cf3a'); rect(d, 12, 0, 6, 12, '#c8202c'); },
  HUN: (d) => { rect(d, 0, 0, 18, 4, '#c8202c'); rect(d, 0, 4, 18, 4, '#f3f4f6'); rect(d, 0, 8, 18, 4, '#2f7a3a'); },
  ITA: (d) => { rect(d, 0, 0, 6, 12, '#2f8a45'); rect(d, 6, 0, 6, 12, '#f3f4f6'); rect(d, 12, 0, 6, 12, '#c8202c'); rect(d, 8, 4, 2, 4, '#2a4fa0'); },
  SVK: (d) => { rect(d, 0, 0, 18, 4, '#f3f4f6'); rect(d, 0, 4, 18, 4, '#1d4fa8'); rect(d, 0, 8, 18, 4, '#c8202c'); },
};
const fCache = new Map();
export function flagURL(nat) {
  let u = fCache.get(nat);
  if (u) return u;
  const d = img(18, 12);
  (FLAG[nat] || FLAG.GER)(d);
  const c = toCanvas(d), k = document.createElement('canvas');
  k.width = 36;
  k.height = 24;
  const x = k.getContext('2d');
  x.imageSmoothingEnabled = false;
  x.drawImage(c, 0, 0, 36, 24);
  x.strokeStyle = 'rgba(0,0,0,.55)';
  x.lineWidth = 2;
  x.strokeRect(1, 1, 34, 22);
  u = k.toDataURL();
  fCache.set(nat, u);
  return u;
}
