// «Сталинград 1942–1943» (v0.7.1): спрайты штабной карты — флаги (у Германии чёрно-бело-красный с крестом, без свастики),
// головы бойцов в касках своих армий (пиксель-арт 14×14), фишки дивизий 48×38 (крупный номер, флаг, знак величины, полоса
// категории I–V), жетоны штабов крупнее дивизий (портрет генерала 30×36, номер, XXXX, фамилия). Все спрайты кешируются в пикселях устройства.
import { CAT_COL } from './rules.js';
import { GENERALS } from './scenario.js';
import { portraitCanvas, PW, PH } from './portraits.js';

export const FONT = (s, w = 700) => `${w} ${s}px Rubik, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
const cache = new Map();
export function clearSprites() {
  cache.clear();
}
const mk = (w, h) => {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w));
  c.height = Math.max(1, Math.ceil(h));
  return c;
};

// ——— флаги ———
function star(x, cx, cy, r, col) {
  x.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.42 : r;
    x.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
  }
  x.closePath();
  x.fillStyle = col;
  x.fill();
}
export function drawFlag(x, nat, X, Y, w, h, line = 1) {
  x.save();
  if (nat === 'SOV') {
    x.fillStyle = '#c62828';
    x.fillRect(X, Y, w, h);
    star(x, X + h * 0.42, Y + h * 0.4, h * 0.3, '#f2c94c');
  } else if (nat === 'GER') {
    const t = h / 3;
    x.fillStyle = '#1b1b1b';
    x.fillRect(X, Y, w, t + 0.5);
    x.fillStyle = '#f2f2ee';
    x.fillRect(X, Y + t, w, t + 0.5);
    x.fillStyle = '#c62828';
    x.fillRect(X, Y + 2 * t, w, h - 2 * t);
    // крест (Balkenkreuz) с белой окантовкой
    const cx = X + w / 2, cy = Y + h / 2, a = h * 0.44, b = Math.max(1, h * 0.13);
    x.fillStyle = '#f2f2ee';
    x.fillRect(cx - a - b * 0.7, cy - b * 1.7, 2 * a + b * 1.4, b * 3.4);
    x.fillRect(cx - b * 1.7, cy - a - b * 0.7, b * 3.4, 2 * a + b * 1.4);
    x.fillStyle = '#111';
    x.fillRect(cx - a, cy - b, 2 * a, 2 * b);
    x.fillRect(cx - b, cy - a, 2 * b, 2 * a);
  } else {
    const C = nat === 'ROM' ? ['#1f4aa8', '#f2c230', '#c62828'] : ['#2e8b3e', '#f2f2ee', '#c62828'];
    for (let i = 0; i < 3; i++) {
      x.fillStyle = C[i];
      x.fillRect(X + (w * i) / 3, Y, w / 3 + 0.5, h);
    }
  }
  if (line) {
    x.strokeStyle = 'rgba(0,0,0,.75)';
    x.lineWidth = line;
    x.strokeRect(X + line / 2, Y + line / 2, w - line, h - line);
  }
  x.restore();
}
export function flagURL(nat, w = 30, h = 20) {
  const key = `fu|${nat}|${w}|${h}`;
  let u = cache.get(key);
  if (u) return u;
  const c = mk(w * 2, h * 2);
  drawFlag(c.getContext('2d'), nat, 0, 0, w * 2, h * 2, 2);
  u = c.toDataURL();
  cache.set(key, u);
  return u;
}

// ——— бойцы: пиксель-арт 14×14 ———
const HEAD = {
  SOV: [
    '..............', '.....kkkk.....', '...kkHHHLkk...', '..kHHHHHHHLk..', '..kHHHrrHHHk..', '.kHHHHHHHHHHk.', '.khhhhhhhhhhk.',
    '..ksssssssSk..', '..kseesseeSk..', '..kssssssSSk..', '...kssmmsSk...', '....kssssk....', '..kuuuuuuUUk..', '.kuuuuuuuuUUk.',
  ],
  GER: [
    '..............', '.....kkkk.....', '...kkHHHLkk...', '..kHHHHHHHLk..', '..kHHHHHHHHk..', '.kHHHHHHHHHHk.', '.khhhhhhhhhhk.',
    '.khksssssSkhk.', '.kkkseesseekk.', '...kssssssSk..', '...kssmmsSk...', '....kssssk....', '..kuuuuuuUUk..', '.kuuuuuuuuUUk.',
  ],
  ROM: [
    '..............', '.....kkkk.....', '....kHHHLk....', '...kHHHHHLk...', '...kHHHHHHk...', '.kkhHHHHHHhkk.', 'khhhhhhhhhhhhk',
    '.kkssssssSSkk.', '..kseesseeSk..', '..kssssssSSk..', '...kssmmsSk...', '....kssssk....', '..kuuuuuuUUk..', '.kuuuuuuuuUUk.',
  ],
  ITA: [
    '..............', '..............', '.....kkkk.....', '...kkHHHLkk...', '..kHHHHHHHLk..', '..kHHHHHHHHk..', '.kkhhhhhhhhkk.',
    '..ksssssssSk..', '..kseesseeSk..', '..kssssssSSk..', '...kssmmsSk...', '....kssssk....', '..kuuuuuuUUk..', '.kuuuuuuuuUUk.',
  ],
};
const PAL = {
  SOV: { H: '#5f7a3a', h: '#46592a', L: '#86a057', u: '#7a7243', U: '#5a5430' },
  GER: { H: '#5d6560', h: '#434a46', L: '#808983', u: '#6c7366', U: '#4f5549' },
  ROM: { H: '#7c6f45', h: '#5b5132', L: '#9c8e60', u: '#8a7a4e', U: '#66593a' },
  ITA: { H: '#6f705a', h: '#52533f', L: '#8d8e76', u: '#7d7a5c', U: '#5c5a43' },
};
const COM = { k: '#1c1a18', s: '#e3b58e', S: '#c49066', e: '#2a1e16', m: '#a8664a', r: '#d32f2f' };
// голова бойца в пикселях устройства: px — размер «пикселя» арта
export function drawHead(x, nat, X, Y, px) {
  const A = HEAD[nat] || HEAD.SOV, P = PAL[nat] || PAL.SOV;
  for (let r = 0; r < 14; r++)
    for (let q = 0; q < 14; q++) {
      const ch = A[r][q];
      if (ch === '.') continue;
      x.fillStyle = P[ch] || COM[ch] || '#f0f';
      x.fillRect(X + q * px, Y + r * px, px, px);
    }
}
export function headURL(nat, k = 3) {
  const key = `hu|${nat}|${k}`;
  let u = cache.get(key);
  if (u) return u;
  const c = mk(14 * k, 14 * k);
  drawHead(c.getContext('2d'), nat, 0, 0, k);
  u = c.toDataURL();
  cache.set(key, u);
  return u;
}

// ——— фишка дивизии ———
// базовый размер в CSS-пикселях (v0.7.1: крупнее — 48×38 вместо 40×32); k — масштаб, d — плотность пикселей
export const CW = 48, CH = 38;
const fitText = (x, s, max, size, w = 700) => {
  let f = size;
  x.font = FONT(f, w);
  while (f > 6 && x.measureText(s).width > max) x.font = FONT((f -= 0.5), w);
  return f;
};
function rrect(x, X, Y, w, h, r) {
  x.beginPath();
  x.moveTo(X + r, Y);
  x.arcTo(X + w, Y, X + w, Y + h, r);
  x.arcTo(X + w, Y + h, X, Y + h, r);
  x.arcTo(X, Y + h, X, Y, r);
  x.arcTo(X, Y, X + w, Y, r);
  x.closePath();
}
// o: {nat, num, ech, cat (0 — неизвестна), sym (inf|arm|mot|cav), gds, unk (номер неизвестен), sup0 (без снабжения), dim}
// Раскладка: боец слева, номер — справа вверху (в стопке остаётся виден), флаг, знак величины, полоса категории I–V внизу.
export function counter(o, k, d) {
  const key = `c|${o.nat}|${o.num}|${o.ech}|${o.cat}|${o.sym}|${o.gds ? 1 : 0}|${o.unk ? 1 : 0}|${o.sup0 ? 1 : 0}|${k}|${d}`;
  let c = cache.get(key);
  if (c) return c;
  const s = k * d, W = CW * s, H = CH * s;
  c = mk(W + 2 * s, H + 2 * s);
  const x = c.getContext('2d');
  // тень
  x.fillStyle = 'rgba(0,0,0,.38)';
  rrect(x, 1.8 * s, 1.8 * s, W - 0.4 * s, H - 0.4 * s, 3 * s);
  x.fill();
  // поле
  x.fillStyle = o.unk ? '#d9d6cf' : '#f4f2ec';
  rrect(x, 0.6 * s, 0.6 * s, W - 1.2 * s, H - 1.2 * s, 3 * s);
  x.fill();
  // полоса боеспособности
  x.save();
  x.clip();
  x.fillStyle = o.cat ? CAT_COL[o.cat] : '#8f8c86';
  x.fillRect(0, H - 5.2 * s, W, 5.2 * s);
  x.fillStyle = 'rgba(0,0,0,.35)';
  x.fillRect(0, H - 5.2 * s, W, Math.max(1, 0.7 * s));
  x.restore();
  x.strokeStyle = '#1a1a1a';
  x.lineWidth = 1.3 * s;
  rrect(x, 0.6 * s, 0.6 * s, W - 1.2 * s, H - 1.2 * s, 3 * s);
  x.stroke();
  // боец
  const px = Math.max(1, Math.round(1.36 * s));
  drawHead(x, o.nat, Math.round(2.2 * s), Math.round((H - 5.2 * s) / 2 - 7.4 * px), px);
  // номер
  const num = o.unk ? '?' : String(o.num ?? '');
  x.fillStyle = '#141414';
  x.textAlign = 'right';
  x.textBaseline = 'alphabetic';
  fitText(x, num, 27 * s, 15.5 * s, 800);
  x.fillText(num, W - 3 * s, 13.6 * s);
  // флаг
  drawFlag(x, o.nat, 22.6 * s, 16.4 * s, 22.4 * s, 9 * s, Math.max(1, 1 * s));
  // знак величины
  x.textAlign = 'center';
  x.font = FONT(8.6 * s, 800);
  x.fillStyle = '#161616';
  x.fillText(o.ech || 'XX', 33.8 * s, 31.6 * s);
  // род войск — значок в левом нижнем углу
  if (o.sym && o.sym !== 'inf') {
    const bx = 6.6 * s, by = H - 9.4 * s, r = 5.2 * s;
    x.beginPath();
    x.arc(bx, by, r, 0, Math.PI * 2);
    x.fillStyle = '#f4f2ec';
    x.fill();
    x.lineWidth = 1.1 * s;
    x.strokeStyle = '#1a1a1a';
    x.stroke();
    x.lineWidth = 1.3 * s;
    if (o.sym === 'arm') {
      rrect(x, bx - 3.3 * s, by - 1.8 * s, 6.6 * s, 3.6 * s, 1.8 * s);
      x.stroke();
    } else if (o.sym === 'mot') {
      x.beginPath();
      x.arc(bx, by, 2.3 * s, 0, Math.PI * 2);
      x.stroke();
      x.fillStyle = '#1a1a1a';
      x.fillRect(bx - 0.75 * s, by - 0.75 * s, 1.5 * s, 1.5 * s);
    } else if (o.sym === 'cav') {
      x.beginPath();
      x.moveTo(bx - 2.9 * s, by + 2.9 * s);
      x.lineTo(bx + 2.9 * s, by - 2.9 * s);
      x.stroke();
    }
  }
  // гвардия — звезда
  if (o.gds) {
    star(x, 5.6 * s, 5.6 * s, 4.7 * s, '#1a1a1a');
    star(x, 5.6 * s, 5.6 * s, 3.6 * s, '#e53935');
  }
  // без снабжения — красная метка
  if (o.sup0) {
    x.beginPath();
    x.arc(W - 4 * s, H - 11 * s, 3.1 * s, 0, Math.PI * 2);
    x.fillStyle = '#e53935';
    x.fill();
    x.lineWidth = 1 * s;
    x.strokeStyle = '#fff';
    x.stroke();
  }
  cache.set(key, c);
  return c;
}

// ——— жетон штаба: портрет, номер, флаг, знак величины, фамилия ———
export const surname = (g) => {
  const G = GENERALS[g];
  if (!G) return '';
  const p = G.n.split(' ');
  return p[p.length - 1].toUpperCase();
};
// базовая высота жетона; ширина — по величине (фронт/группа армий шире: две строки названия)
export const TH = 52;
const TW = { XXXXX: 74, XXXX: 64, XXX: 62 };
// o: {side, nat, num, sub, lab: [строка1, строка2] (вместо номера), ech, gen, hi (подсветка)}
export function hqToken(o, k, d) {
  const key = `h|${o.side}|${o.nat}|${o.num}|${o.sub || ''}|${(o.lab || []).join('/')}|${o.ech}|${o.gen}|${k}|${d}`;
  let c = cache.get(key);
  if (c) return c;
  const s = k * d, W = (TW[o.ech] || 64) * s, H = TH * s;
  const sov = o.side === 'SOV', fg = sov ? '#f2c230' : '#141414', bg = sov ? '#141414' : '#f4f2ec', tx = sov ? '#f4f2ec' : '#141414';
  c = mk(W + 2.4 * s, H + 2.4 * s);
  const x = c.getContext('2d');
  x.fillStyle = 'rgba(0,0,0,.42)';
  x.fillRect(2.2 * s, 2.2 * s, W, H);
  x.fillStyle = bg;
  x.fillRect(0, 0, W, H);
  x.strokeStyle = sov ? '#000' : '#141414';
  x.lineWidth = 1.5 * s;
  x.strokeRect(0.75 * s, 0.75 * s, W - 1.5 * s, H - 1.5 * s);
  // портрет: крупный, без сглаживания при увеличении и со сглаживанием при уменьшении
  const pw = 30 * s, ph = (pw * PH) / PW, px0 = 3 * s, py0 = 3 * s;
  const P = portraitCanvas(o.gen);
  x.imageSmoothingEnabled = pw / PW < 1.5;
  if (x.imageSmoothingEnabled) x.imageSmoothingQuality = 'high';
  x.drawImage(P, px0, py0, pw, ph);
  x.imageSmoothingEnabled = true;
  x.strokeStyle = sov ? '#4a4a4a' : '#141414';
  x.lineWidth = 1 * s;
  x.strokeRect(px0, py0, pw, ph);
  const rx = px0 + pw + 2.6 * s, rw = W - rx - 2.6 * s;
  x.textBaseline = 'alphabetic';
  if (o.lab) {
    x.fillStyle = tx;
    x.textAlign = 'center';
    for (let i = 0; i < o.lab.length; i++) {
      fitText(x, o.lab[i], rw, 8.6 * s, 800);
      x.fillText(o.lab[i], rx + rw / 2, (11 + i * 8.8) * s);
    }
  } else {
    x.fillStyle = fg;
    x.textAlign = 'right';
    const t = String(o.num);
    const f = fitText(x, t, rw - (o.sub ? 11 * s : 0), 21 * s, 800);
    x.fillText(t, W - 2.8 * s - (o.sub ? 12 * s : 0), 20.5 * s);
    if (o.sub) {
      x.font = FONT(Math.min(f, 9.4 * s), 800);
      x.fillText(o.sub, W - 2.6 * s, 20.5 * s);
    }
  }
  drawFlag(x, o.nat, rx, 23.6 * s, rw, 8.4 * s, Math.max(1, 1 * s));
  x.fillStyle = fg;
  x.textAlign = 'center';
  fitText(x, o.ech, rw + 3 * s, 9.4 * s, 800);
  x.fillText(o.ech, rx + rw / 2, 41 * s);
  x.fillStyle = tx;
  const sn = surname(o.gen);
  fitText(x, sn, W - 5 * s, 9 * s, 800);
  x.fillText(sn, W / 2, 49.6 * s);
  cache.set(key, c);
  return c;
}
