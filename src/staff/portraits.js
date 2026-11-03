// «Сталинград 1942–1943» (v0.7): процедурные пиксельные портреты генералов 24×28 в стиле чёрно-белого фото.
// Параметры — GENERALS[id].por: f — ширина лица, j — подбородок, n — нос, b — брови, a — возраст (0–1);
// h — причёска (short | bald | comb | curly | gray); c — головной убор (sov — фуражка, pap — папаха, tank — танкошлем,
// kub — кубанка, none — без убора, ger — фуражка вермахта, gerf — полевое кепи, rom — румынская, ita — итальянская);
// s — зерно случайности; long — вытянутое лицо, plump — полное, grin — улыбка, m — усы 0–1, g — очки.
import { GENERALS } from './scenario.js';
import { rng } from './geo.js';

export const PW = 24, PH = 28;
const base = new Map(), urls = new Map();
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

function draw(p, nat) {
  const L = new Float32Array(PW * PH).fill(-1), R = rng(((p.s || 1) * 2654435761) >>> 0);
  const set = (x, y, v) => {
    x = Math.round(x); y = Math.round(y);
    if (x >= 0 && y >= 0 && x < PW && y < PH) L[y * PW + x] = v;
  };
  const get = (x, y) => (x >= 0 && y >= 0 && x < PW && y < PH ? L[y * PW + x] : -1);
  const add = (x, y, d) => {
    const v = get(x, y);
    if (v >= 0) set(x, y, cl(v + d, 0, 255));
  };
  // симметрично относительно оси между столбцами 11 и 12
  const sm = (x, y, v) => (set(x, y, v), set(PW - 1 - x, y, v));
  const am = (x, y, d) => (add(x, y, d), add(PW - 1 - x, y, d));
  const span = (y, hw, v, shade = 0) => {
    const x0 = Math.round(12 - hw);
    for (let x = x0; x <= 11; x++) set(x, y, v), set(PW - 1 - x, y, v - shade);
  };
  const lg = p.long ? 1 : 0, pl = p.plump ? 1 : 0, f = p.f ?? 0.6, j = p.j ?? 0.5, n = p.n ?? 0.5, b = p.b ?? 0.5, a = p.a ?? 0.3;
  const cap = p.c || 'none', hair = p.h || 'short';
  // фон — серый с виньеткой
  for (let y = 0; y < PH; y++)
    for (let x = 0; x < PW; x++) {
      const dx = (x - 11.5) / 12, dy = (y - 11) / 16;
      L[y * PW + x] = 150 - y * 1.4 - 34 * (dx * dx + dy * dy) + (R() - 0.5) * 8;
    }
  const top = 6 - lg, chin = 21 + lg, skin = 198, eY = 13, mY = 18 + lg;
  const hwF = 4.6 + f * 1.4, hwC = 5.1 + f * 1.8 + pl * 0.6, hwJ = 1.4 + j * 2.4 + pl * 0.9;
  const hwAt = (y) => {
    if (y <= top) return hwF - 1.4;
    if (y < 10) return hwF + (y - top) * 0.15;
    if (y <= 16) return hwC;
    const t = (y - 16) / Math.max(1, chin - 16);
    return hwC + (hwJ - hwC) * Math.pow(t, 1.6 - j * 0.9);
  };
  // шея и плечи (мундир)
  const uni = { SOV: 74, GER: 112, ROM: 100, ITA: 104 }[nat] ?? 90;
  for (let y = chin - 1; y < PH; y++) span(y, 2.6 + pl * 0.6, 168, 22);
  for (let y = 22 + lg; y < PH; y++) {
    const hw = Math.min(12, 6 + (y - 22 - lg) * 2.4);
    for (let x = Math.round(12 - hw); x <= 11; x++) {
      const v = uni + (R() - 0.5) * 6 - (x < 3 ? 10 : 0);
      set(x, y, v);
      set(PW - 1 - x, y, v - 8);
    }
  }
  const cy = 22 + lg;
  if (nat === 'SOV') {
    // закрытый воротник с петлицами
    for (let y = cy; y < cy + 3; y++) for (let x = 8; x <= 11; x++) sm(x, y, uni - 18);
    sm(8, cy + 1, 150), sm(9, cy + 1, 150), sm(8, cy + 2, 128), sm(9, cy + 2, 128);
    sm(11, cy, uni - 34), sm(11, cy + 1, uni - 34);
  } else {
    // открытый воротник: рубашка, галстук, петлицы; у немцев — Рыцарский крест под воротом
    for (let y = cy; y < PH; y++) {
      const w = Math.max(0, 2 - (y - cy) * 0.6);
      for (let x = Math.round(11 - w); x <= 11; x++) sm(x, y, 224);
    }
    for (let y = cy; y < PH; y++) set(11, y, 46), set(12, y, 52);
    sm(7, cy + 1, 176), sm(8, cy + 1, 186), sm(7, cy + 2, 160), sm(8, cy + 2, 170);
    sm(3, cy + 2, 172), sm(4, cy + 2, 180), sm(5, cy + 2, 172);
    if (nat === 'GER' && (p.s || 0) % 3 !== 2) set(11, cy - 1, 28), set(12, cy - 1, 28), set(11, cy, 200), set(12, cy, 34);
  }
  // голова
  for (let y = top; y <= chin; y++) span(y, hwAt(y), skin - (y > eY + 4 ? 6 : 0), 20);
  // контур лица и тень на щеке
  for (let y = top; y <= chin; y++) {
    const x0 = Math.round(12 - hwAt(y));
    set(x0, y, 140), set(PW - 1 - x0, y, 118);
    if (y > eY && y < chin) add(PW - x0 - 2, y, -12);
  }
  for (let x = Math.round(12 - hwJ); x <= Math.round(11 + hwJ); x++) add(x, chin, -46);
  if (pl) for (let x = 10; x <= 13; x++) add(x, chin + 1, -30);
  // уши
  for (let y = eY - 1; y <= eY + 2; y++) {
    const x0 = Math.round(12 - hwC) - 1;
    set(x0, y, 170), set(PW - 1 - x0, y, 146);
  }
  // волосы (если не скрыты убором)
  const hv = hair === 'gray' ? 172 : Math.round(52 + 112 * Math.pow(a, 1.6));
  if (hair !== 'bald') {
    const hTop = top - (hair === 'curly' ? 2 : 1);
    for (let y = hTop; y <= top + 1; y++) span(y, hwAt(top) + (y > top ? 0.4 : -0.6), hv + (R() - 0.5) * 10, 10);
    for (let y = top + 2; y <= eY - 2; y++) sm(Math.round(12 - hwAt(y)), y, hv);
    if (hair === 'comb') for (let x = 7; x <= 16; x++) add(x, top, 30);
    if (hair === 'curly') for (let x = 6; x <= 17; x += 2) set(x, hTop, hv + 40), set(x + 1, hTop + 1, hv - 10);
  } else {
    for (let y = top - 1; y <= top; y++) span(y, hwAt(top) - 0.8, skin + 6, 18);
    sm(9, top, 228), sm(10, top - 1, 224);
  }
  // глаза, брови
  const ex = f > 0.68 ? 8 : 9;
  for (const x of [ex, ex + 1]) sm(x, eY, 236);
  sm(ex + 1, eY, 34);
  sm(ex, eY - 1, 132), sm(ex + 1, eY - 1, 120);
  const bv = Math.round(92 - b * 62);
  for (let x = ex - 1; x <= ex + 2; x++) sm(x, eY - 2, bv + (x === ex + 2 ? 26 : 0));
  if (b > 0.6) for (let x = ex - 1; x <= ex + 1; x++) sm(x, eY - 3, bv + 30);
  // очки
  if (p.g) {
    for (let x = ex - 1; x <= ex + 2; x++) sm(x, eY - 1, 40), sm(x, eY + 1, 60);
    sm(ex - 1, eY, 50), sm(ex + 2, eY, 50), sm(11, eY - 1, 60);
  }
  // нос
  const nl = Math.round(2 + n * 2);
  for (let y = eY; y <= eY + nl; y++) set(11, y, 218), set(12, y, 166);
  set(10, eY + nl, 140), set(13, eY + nl, 118), set(11, eY + nl + 1, 150), set(12, eY + nl + 1, 140);
  if (n > 0.62) set(10, eY + nl - 1, 182), set(13, eY + nl - 1, 156);
  // усы
  if (p.m) {
    const mw = Math.round(1 + p.m * 3);
    for (let x = 12 - mw; x <= 11; x++) sm(x, mY - 1, Math.round(hair === 'gray' ? 150 : 70 + a * 40));
  }
  // рот
  if (p.grin) {
    for (let x = 9; x <= 14; x++) set(x, mY, 232);
    set(8, mY - 1, 92), set(15, mY - 1, 92), set(9, mY, 96), set(14, mY, 96);
    for (let x = 10; x <= 13; x++) set(x, mY + 1, 120);
  } else {
    for (let x = 10; x <= 13; x++) set(x, mY, 112 - (x === 10 || x === 13 ? -14 : 0));
    for (let x = 10; x <= 13; x++) add(x, mY + 1, 10);
  }
  // возраст: морщины
  if (a > 0.4) for (let x = 9; x <= 14; x += 2) add(x, eY - 4, -26);
  if (a > 0.5) add(ex - 1, eY + 3, -24), add(PW - ex, eY + 3, -24), add(ex - 1, eY + 4, -24), add(PW - ex, eY + 4, -24);
  if (a > 0.6) am(ex, eY + 1, -22);
  // головные уборы
  const capRow = (y, x0, x1, v, nz = 0) => {
    for (let x = x0; x <= x1; x++) set(x, y, v + (nz ? (R() - 0.5) * nz : 0));
  };
  const star = (x, y, v = 214) => (set(x, y, v), set(x + 1, y, v - 20));
  const cy0 = top - 1;
  if (cap === 'sov') {
    for (let y = cy0 - 4; y <= cy0 - 1; y++) capRow(y, 4 + Math.max(0, cy0 - 4 - y + 1), 19 - Math.max(0, cy0 - 4 - y + 1), 78 + (y === cy0 - 4 ? 16 : 0), 6);
    capRow(cy0, 6, 17, 44), capRow(cy0 + 1, 6, 17, 40);
    capRow(cy0 + 2, 7, 16, 22);
    star(11, cy0);
  } else if (cap === 'pap') {
    for (let y = cy0 - 5; y <= cy0 + 1; y++) capRow(y, 5, 18, 92 - (y - cy0) * 2, 44);
    capRow(cy0 - 5, 6, 17, 120, 30);
    star(11, cy0 - 2, 200);
  } else if (cap === 'tank') {
    for (let y = cy0 - 3; y <= cy0 + 1; y++) capRow(y, 5 + (y === cy0 - 3 ? 2 : 0), 18 - (y === cy0 - 3 ? 2 : 0), 54, 6);
    for (let y = cy0 - 3; y <= cy0; y++) set(8, y, 82), set(11, y, 86), set(12, y, 70), set(15, y, 76);
    for (let y = cy0 + 2; y <= eY; y++) {
      const x0 = Math.round(12 - hwAt(y));
      set(x0, y, 60), set(PW - 1 - x0, y, 50);
    }
    capRow(cy0 + 2, 6, 17, 40);
  } else if (cap === 'kub') {
    capRow(cy0 - 3, 7, 16, 66), capRow(cy0 - 2, 7, 16, 58);
    set(11, cy0 - 3, 150), set(12, cy0 - 2, 150), set(10, cy0 - 2, 130), set(13, cy0 - 3, 130);
    for (let y = cy0 - 1; y <= cy0 + 1; y++) capRow(y, 6, 17, 96, 46);
  } else if (cap === 'ger' || cap === 'rom' || cap === 'ita') {
    const cv = cap === 'ger' ? 124 : cap === 'rom' ? 108 : 112;
    for (let y = cy0 - 5; y <= cy0 - 1; y++) {
      const k = cy0 - 1 - y, w = cap === 'ger' ? Math.min(9.6, 7.4 + k * 0.7) : 7.6 + Math.min(1, k) * 0.6;
      capRow(y, Math.round(12 - w), Math.round(11 + w), cv + (k >= 3 ? 12 : 0), 6);
    }
    capRow(cy0, 6, 17, cap === 'ita' ? 150 : 62), capRow(cy0 + 1, 6, 17, cap === 'ita' ? 140 : 58);
    capRow(cy0 + 2, 6, 17, 20);
    set(10, cy0 + 2, 70), set(11, cy0 + 2, 86);
    set(11, cy0 - 3, 210), set(12, cy0 - 3, 196), set(10, cy0 - 3, 170), set(13, cy0 - 3, 170);
    set(11, cy0, 220), set(12, cy0, 206);
  } else if (cap === 'gerf') {
    for (let y = cy0 - 3; y <= cy0; y++) capRow(y, 6, 17, 112 + (y === cy0 - 3 ? 10 : 0), 8);
    capRow(cy0 + 1, 6, 17, 90), capRow(cy0 + 2, 7, 16, 36);
    set(11, cy0 - 2, 200), set(12, cy0 - 2, 186), set(11, cy0, 214);
  }
  // зерно плёнки
  for (let i = 0; i < L.length; i++) L[i] = cl(L[i] + (R() - 0.5) * 7, 0, 255);
  return L;
}

// базовый холст 24×28 (кешируется)
export function portraitCanvas(id) {
  let c = base.get(id);
  if (c) return c;
  const G = GENERALS[id], p = (G && G.por) || { f: 0.6, j: 0.5, n: 0.5, b: 0.5, a: 0.3, h: 'short', c: 'none', s: 7 };
  const L = draw(p, G ? G.nat : 'SOV');
  c = typeof OffscreenCanvas !== 'undefined' && typeof document === 'undefined' ? new OffscreenCanvas(PW, PH) : document.createElement('canvas');
  c.width = PW;
  c.height = PH;
  const x = c.getContext('2d'), im = x.createImageData(PW, PH);
  for (let i = 0; i < L.length; i++) {
    const v = L[i];
    im.data[i * 4] = v;
    im.data[i * 4 + 1] = v * 0.985;
    im.data[i * 4 + 2] = v * 0.95;
    im.data[i * 4 + 3] = 255;
  }
  x.putImageData(im, 0, 0);
  base.set(id, c);
  return c;
}
// картинка для HTML: увеличение без сглаживания
export function portraitURL(id, k = 3) {
  const key = `${id}|${k}`;
  let u = urls.get(key);
  if (u) return u;
  const s = portraitCanvas(id), c = document.createElement('canvas');
  c.width = PW * k;
  c.height = PH * k;
  const x = c.getContext('2d');
  x.imageSmoothingEnabled = false;
  x.drawImage(s, 0, 0, c.width, c.height);
  u = c.toDataURL();
  urls.set(key, u);
  return u;
}
