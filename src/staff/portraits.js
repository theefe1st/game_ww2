// «Сталинград 1942–1943» (v0.7.1): процедурные пиксельные портреты генералов 40×48 в цвете.
// Свет сверху слева, контур силуэта, приглушённая палитра. Головные уборы своих армий: советская генеральская
// фуражка (красный околыш, звезда), папаха, кубанка, танковый шлемофон (у части — очки), фуражка вермахта
// (орёл без свастики, кокарда в венке, золотые шнуры), полевое кепи, румынская и итальянская фуражки.
// Мундиры: у РККА 1942 г. — петлицы и ордена (погоны введены в январе 1943-го), у вермахта — петлицы генерала
// «Ларишевским» шитьём, погоны и Рыцарский крест у горла, у румын — крест Михая Храброго, у итальянцев — звёздочки и планки.
// Параметры — GENERALS[id].por: f — ширина лица, j — подбородок, n — нос, b — брови, a — возраст (0–1);
// h — причёска (short | bald | comb | curly | gray); c — убор (sov | pap | tank | kub | none | ger | gerf | rom | ita);
// s — зерно; long — вытянутое лицо; plump — полное; grin — улыбка; m — усы 0–1; g — очки;
// необязательные: hc — цвет волос (blk | dkb | brn | ltb | bln | gry | wht), sk — кожа (fair | ruddy | olive | pale),
// ey — глаза (brn | blu | gry | grn), kc — крест у горла (1/0), med — число орденов 0–3, gog — очки на шлемофоне, gold — золотой зуб.
import { GENERALS } from './scenario.js';
import { rng } from './geo.js';

export const PW = 40, PH = 48;
const base = new Map(), urls = new Map();
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const mixC = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];

// кожа: свет, основа, тень, глубокая тень, линия
const SKIN = {
  fair: ['#efc6a4', '#dfab88', '#bf8466', '#93604a', '#6a4232'],
  ruddy: ['#ecbc9c', '#d99d80', '#b5765e', '#8b5444', '#643a2e'],
  olive: ['#dcb38c', '#c89a72', '#a57755', '#7b573f', '#5a3e2c'],
  pale: ['#f3d6bf', '#e4bda0', '#c4977c', '#986c58', '#6e4a3c'],
};
// волосы: основа, блик, тень
const HAIR = {
  blk: ['#2a2422', '#463d38', '#191514'],
  dkb: ['#3d2b1f', '#5c432f', '#261a12'],
  brn: ['#5a3f2a', '#7d5b3e', '#3c2a1c'],
  ltb: ['#7e5f40', '#a2805a', '#5a432c'],
  bln: ['#a5884f', '#c9ab70', '#7a6236'],
  gry: ['#86827c', '#a9a59e', '#625f5a'],
  wht: ['#bdb9b1', '#dcd8d0', '#8f8b84'],
};
const EYE = { brn: '#5a3a26', blu: '#4b6a84', gry: '#68707a', grn: '#56684a' };
// мундир: основа, свет, тень, глубокая тень
const UNI = {
  SOV: ['#6f6b45', '#8a8659', '#545134', '#3a3824'],
  GER: ['#5f6656', '#7b8371', '#464c40', '#30352c'],
  ROM: ['#7a6c45', '#968860', '#5c5133', '#403822'],
  ITA: ['#6c715a', '#878c73', '#51564a', '#383c32'],
};
// фон: верх, низ (свет из левого верхнего угла)
const BG = { SOV: ['#6d4a3e', '#3d2620'], GER: ['#56626c', '#2e353c'], ROM: ['#4b5876', '#283048'], ITA: ['#56634f', '#2f382c'] };
const GOLD = ['#e3c060', '#c49a3a', '#8a6a26'], SILV = ['#dedcd4', '#a9a79f', '#6e6c66'];

function draw(p, nat) {
  const R = rng(((p.s || 1) * 2654435761) >>> 0), pick = (a) => a[Math.floor(R() * a.length) % a.length];
  const img = new Array(PW * PH), fig = new Uint8Array(PW * PH); // fig: 1 — фигура (для контура)
  const set = (x, y, c, f = 1) => {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || y < 0 || x >= PW || y >= PH) return;
    img[y * PW + x] = typeof c === 'string' ? hex(c) : c;
    if (f) fig[y * PW + x] = 1;
  };
  const get = (x, y) => (x >= 0 && y >= 0 && x < PW && y < PH ? img[y * PW + x] : null);
  const sm = (x, y, c, c2) => (set(x, y, c), set(PW - 1 - x, y, c2 ?? c));
  // симметричный ряд: |x − 19.5| < hw; col(x, t) — цвет по нормированной координате t ∈ (−1, 1)
  const row = (y, hw, col) => {
    for (let x = 0; x < PW; x++) {
      const d = x - 19.5;
      if (Math.abs(d) < hw) set(x, y, col(d / hw, x));
    }
  };
  const lg = p.long ? 1 : 0, pl = p.plump ? 1 : 0, f = p.f ?? 0.6, j = p.j ?? 0.5, n = p.n ?? 0.5, b = p.b ?? 0.5, a = p.a ?? 0.3;
  const cap = p.c || 'none', hair = p.h || 'short';
  const skK = p.sk || (nat === 'ROM' || nat === 'ITA' ? pick(['olive', 'fair', 'olive']) : nat === 'GER' ? pick(['fair', 'pale', 'ruddy']) : pick(['fair', 'ruddy', 'fair', 'pale']));
  const SK = SKIN[skK].map(hex);
  let hcK = p.hc || (hair === 'gray' ? (a > 0.65 ? 'wht' : 'gry') : nat === 'ROM' || nat === 'ITA' ? pick(['blk', 'dkb', 'dkb']) : nat === 'GER' ? pick(['brn', 'ltb', 'dkb', 'bln']) : pick(['dkb', 'brn', 'ltb', 'blk', 'bln', 'brn']));
  const HC = HAIR[hcK].map(hex), HCg = HAIR.gry.map(hex);
  const eyeC = hex(EYE[p.ey || (nat === 'ROM' || nat === 'ITA' ? pick(['brn', 'brn', 'grn']) : pick(['blu', 'gry', 'brn', 'grn', 'blu']))]);
  const U = UNI[nat].map(hex), G = GOLD.map(hex), Sv = SILV.map(hex);
  // ——— фон: вертикальный градиент, блик слева вверху, упорядоченный дизеринг ———
  const B0 = hex(BG[nat][0]), B1 = hex(BG[nat][1]), BAY = [0, 2, 3, 1];
  for (let y = 0; y < PH; y++)
    for (let x = 0; x < PW; x++) {
      const dx = (x - 12) / 30, dy = (y - 10) / 40, t = Math.min(1, Math.max(0, Math.sqrt(dx * dx + dy * dy) * 1.25));
      const q = Math.round(t * 6 + (BAY[(x & 1) + 2 * (y & 1)] - 1.5) / 4) / 6;
      img[y * PW + x] = mixC(B0, B1, Math.min(1, Math.max(0, q)));
    }
  // ——— геометрия лица ———
  const yE = 22, yB = yE - 3, yN = 26 + Math.round(n * 1.6) + lg, yM = 30 + lg * 2, yC = 34 + lg * 2;
  const hwT = 7.2 + f * 2.2, hwC = 7.5 + f * 2.8 + pl * 0.8, hwCh = 2.2 + j * 3.4 + pl * 1.1;
  const ySk = 9 - lg; // макушка
  const hwAt = (y) => {
    if (y < ySk) return 0;
    if (y < 14) {
      const t = (14 - y) / (14 - ySk + 1);
      return hwT * Math.sqrt(Math.max(0, 1 - t * t));
    }
    if (y < 20) return hwT + ((hwC - hwT) * (y - 14)) / 6;
    if (y <= 26 + lg) return hwC;
    const t = (y - 26 - lg) / Math.max(1, yC - 26 - lg);
    return hwC + (hwCh - hwC) * Math.pow(t, 1.5 - j * 0.6);
  };
  // ——— плечи и мундир ———
  const yS = 38 + lg;
  for (let y = yS; y < PH; y++) {
    const hw = Math.min(20.5, 9 + (y - yS) * 3.4);
    row(y, hw, (t, x) => {
      // складки: свет слева, тень справа, глубокая тень у края
      if (t > 0.82) return U[3];
      if (t > 0.45) return U[2];
      if (t < -0.8) return U[2];
      if (t < -0.35 && y < yS + 4) return U[1];
      return U[0];
    });
  }
  // шея
  const hwNk = 4.4 + pl * 0.9;
  for (let y = yC - 2; y <= yS + 2; y++) row(y, hwNk, (t) => (t > 0.35 ? SK[3] : y <= yC + 1 ? SK[3] : SK[2]));
  // ——— голова (кожа) ———
  for (let y = ySk; y <= yC; y++) {
    const hw = hwAt(y);
    row(y, hw, (t) => {
      if (t > 0.86) return SK[3];
      if (t > 0.5) return SK[2];
      if (t < -0.88) return SK[2];
      if (t < -0.32 && t > -0.66 && y > yE + 1 && y < yE + 5) return SK[0]; // скула слева
      if (t < -0.12 && t > -0.55 && y > ySk + 2 && y < yB - 1) return SK[0]; // лоб
      if (t > 0.3 && y > yN && y < yC) return SK[2]; // тень под скулой справа
      if (t < -0.72 && y > yM) return SK[2]; // линия челюсти слева
      return SK[1];
    });
  }
  // подбородок: блик и тень, челюсть
  set(19, yC - 2, SK[0]), set(18, yC - 2, SK[1]);
  for (let x = 17; x <= 22; x++) if (Math.abs(x - 19.5) < hwAt(yC)) set(x, yC, x > 20 ? SK[3] : SK[2]);
  // уши
  for (let y = yE - 1; y <= yE + 3; y++) {
    const x0 = Math.floor(19.5 - hwAt(y));
    set(x0, y, y === yE - 1 || y === yE + 3 ? SK[2] : SK[1]);
    set(x0 + 0, y, SK[2]);
    set(x0 - 1, y, y === yE - 1 || y === yE + 3 ? null : SK[1]);
    set(PW - 1 - x0, y, SK[3]);
    if (y !== yE - 1 && y !== yE + 3) set(PW - x0, y, SK[2]);
  }
  for (let y = yE; y <= yE + 2; y++) set(Math.floor(19.5 - hwAt(y)), y, SK[3]);
  // ——— волосы ———
  const hairPix = (x, y, k = 0) => {
    const c = a > 0.55 && hcK !== 'gry' && hcK !== 'wht' && R() < (a - 0.45) * 1.2 ? HCg : HC;
    set(x, y, k > 0 ? c[1] : k < 0 ? c[2] : c[0]);
  };
  const capped = cap !== 'none';
  if (!capped) {
    if (hair === 'bald') {
      // блестящая макушка, бахрома по бокам
      set(15, ySk + 2, SK[0]), set(16, ySk + 1, SK[0]), set(16, ySk + 2, '#f6dcc4'), set(17, ySk + 1, '#f6dcc4');
      for (let y = 14; y <= yE - 1; y++) {
        const x0 = Math.floor(19.5 - hwAt(y));
        hairPix(x0, y, -1), hairPix(x0 + 1, y, 0), hairPix(PW - 1 - x0, y, -1), hairPix(PW - 2 - x0, y, -1);
      }
    } else {
      const vol = hair === 'curly' ? 2 : 1, hl = hair === 'curly' ? 13 : 12 + lg; // линия волос на лбу
      for (let y = ySk - vol - 1; y <= hl; y++) {
        const hw = (y < ySk ? hwAt(ySk) * 0.9 + (y - ySk + vol + 1) * 0.9 : hwAt(Math.max(y, ySk))) + vol * 0.8;
        for (let x = 0; x < PW; x++) {
          const d = x - 19.5;
          if (Math.abs(d) >= hw) continue;
          if (hair === 'curly' && (y === ySk - vol - 1) && R() < 0.4) continue;
          // пробор и зачёс: блики полосами
          let k = d / hw > 0.4 ? -1 : 0;
          if (hair === 'comb' || hair === 'gray') k = (x + y * 2) % 5 === 0 ? 1 : d / hw > 0.4 ? -1 : 0;
          if (hair === 'short') k = d / hw < -0.2 && y < ySk + 2 ? 1 : k;
          if (hair === 'curly') k = R() < 0.3 ? 1 : R() < 0.3 ? -1 : 0;
          hairPix(x, y, k);
        }
      }
      if (hair === 'comb' || hair === 'gray') for (let y = ySk - 1; y <= hl - 1; y++) set(14, y, HC[2]); // пробор
      // волосы у висков и бакенбарды
      for (let y = hl; y <= yE; y++) {
        const x0 = Math.floor(19.5 - hwAt(y));
        hairPix(x0, y, 0), hairPix(PW - 1 - x0, y, -1);
        if (y < yE - 2) hairPix(x0 + 1, y, 0), hairPix(PW - 2 - x0, y, -1);
      }
      // неровная линия волос
      for (let x = 15; x <= 24; x++) if ((x * 7 + (p.s || 0)) % 3 === 0) hairPix(x, hl + 1, 0);
    }
  } else {
    // из-под убора видны виски
    for (let y = 15; y <= yE - 1; y++) {
      const x0 = Math.floor(19.5 - hwAt(y));
      hairPix(x0, y, 0), hairPix(PW - 1 - x0, y, -1);
      if (y < 18 && hair !== 'bald') hairPix(x0 + 1, y, 0), hairPix(PW - 2 - x0, y, -1);
    }
  }
  // ——— глаза и брови ———
  const L0 = f > 0.68 || (f > 0.5 && R() < 0.4) ? 14 : 15, L1 = L0 + 2; // левый глаз: столбцы L0..L1
  const narrow = R() < 0.3, browK = p.bs || pick(['arch', 'flat', 'flat', 'low', 'arch']);
  const ex = p.ex || (p.grin ? 'grin' : pick(['calm', 'calm', 'smile', 'stern', 'calm']));
  const white = mixC(hex('#e9e2d8'), SK[1], 0.2), whiteS = mixC(white, SK[2], 0.45);
  for (const side of [0, 1]) {
    const X = (x) => (side ? PW - 1 - x : x);
    set(X(L0), yE, narrow ? SK[3] : side ? whiteS : white);
    set(X(L0 + 1), yE, eyeC);
    set(X(L1), yE, side ? white : whiteS);
    if (side === 0) set(X(L0 + 1), yE, mixC(eyeC, hex('#101010'), 0.25));
    // веко и складка
    for (let x = L0 - 1; x <= L1; x++) set(X(x), yE - 1, x === L0 - 1 ? SK[3] : SK[4]);
    set(X(L1 + 1), yE - 1, SK[2]);
    // под глазом
    if (a > 0.45) for (let x = L0; x <= L1; x++) set(X(x), yE + 1, SK[2]);
    else set(X(L1), yE + 1, SK[2]);
    // брови
    const bc = HC[a > 0.6 ? 1 : 2], bx0 = L0 - 1, bx1 = L1 + 1;
    for (let x = bx0; x <= bx1; x++) {
      // форма брови: дугой (внешний край ниже), прямая, нахмуренная (внутренний край ниже)
      const dy = browK === 'arch' ? (x === bx0 ? 1 : 0) : browK === 'low' ? (x === bx1 ? 1 : 0) : x === bx0 && b < 0.5 ? 1 : 0;
      set(X(x), yB + dy + (ex === 'stern' && x === bx1 ? 1 : 0), bc);
    }
    if (b > 0.55) for (let x = bx0 + 1; x <= bx1; x++) set(X(x), yB - 1, x === bx1 ? HC[0] : bc);
    else set(X(bx1), yB - 1, SK[2]);
  }
  // очки — круглая оправа
  if (p.g) {
    const fr = hex('#2a2622'), gl = hex('#c9d4d6');
    for (const side of [0, 1]) {
      const X = (x) => (side ? PW - 1 - x : x);
      for (let x = L0 - 1; x <= L1 + 1; x++) set(X(x), yE - 2, fr), set(X(x), yE + 2, fr);
      for (let y = yE - 1; y <= yE + 1; y++) set(X(L0 - 2), y, fr), set(X(L1 + 2), y, fr);
      set(X(L0 - 1), yE - 1, gl);
    }
    set(19, yE - 1, fr), set(20, yE - 1, fr);
    for (let y = yE - 1; y <= yE; y++) set(L0 - 3, y, fr), set(PW - L0 + 2, y, fr); // дужки
  }
  // ——— нос ———
  for (let y = yE - 1; y <= yN - 1; y++) {
    set(19, y, y > yE ? SK[0] : SK[1]);
    set(20, y, y > yE + 1 ? SK[2] : SK[1]);
  }
  set(21, yN - 1, SK[2]), set(21, yN - 2, SK[2]);
  set(18, yN, SK[3]), set(21, yN, SK[4]), set(19, yN, SK[2]), set(20, yN, SK[3]);
  set(19, yN - 1, SK[0]);
  if (n > 0.6) set(17, yN, SK[2]), set(22, yN, SK[3]), set(18, yN - 1, SK[1]), set(22, yN - 1, SK[2]);
  // ——— усы, рот ———
  if (p.m) {
    const mw = Math.round(1.5 + p.m * 2.5);
    for (let x = 19 - mw; x <= 20 + mw; x++) {
      hairPix(x, yM - 1, x > 20 ? -1 : 0);
      if (p.m > 0.6 && x > 19 - mw && x < 20 + mw) hairPix(x, yM - 2, x < 19 ? 1 : 0);
    }
  } else set(19, yM - 1, SK[2]), set(20, yM - 1, SK[2]);
  const lip = mixC(SK[3], hex('#9a3c32'), 0.35), lipL = mixC(SK[1], hex('#c0605a'), 0.25);
  if (p.grin) {
    const th = hex('#ece6da');
    for (let x = 17; x <= 22; x++) set(x, yM, th), set(x, yM - 1, x === 17 || x === 22 ? SK[4] : lip);
    set(16, yM - 1, SK[4]), set(23, yM - 1, SK[4]), set(16, yM, SK[3]), set(23, yM, SK[3]);
    if (p.gold) set(18, yM, G[0]), set(21, yM, G[1]);
    for (let x = 17; x <= 22; x++) set(x, yM + 1, lip);
    set(15, yM - 2, SK[2]), set(24, yM - 2, SK[3]); // ямочки
  } else {
    const mw = f > 0.7 || pl ? 3 : 2.5; // полуширина рта
    for (let x = 17; x <= 22; x++) if (Math.abs(x - 19.5) < mw + 0.5) set(x, yM, Math.abs(x - 19.5) > mw - 0.5 ? SK[3] : lip);
    if (ex === 'smile') set(16 + (mw < 3 ? 1 : 0), yM - 1, SK[3]), set(23 - (mw < 3 ? 1 : 0), yM - 1, SK[3]), set(17, yM, SK[2]), set(22, yM, SK[2]);
    if (ex === 'stern') set(17, yM + 1, SK[3]), set(22, yM + 1, SK[3]);
    for (let x = 18; x <= 21; x++) set(x, yM + 1, x < 20 ? lipL : SK[1]);
    for (let x = 18; x <= 21; x++) set(x, yM + 2, SK[2]);
  }
  // ——— возраст ———
  if (a > 0.35) set(16, yN + 1, SK[2]), set(23, yN + 1, SK[3]), set(15, yN + 2, SK[2]), set(24, yN + 2, SK[3]);
  if (a > 0.5) {
    set(L0 - 2, yE, SK[2]), set(PW - L0 + 1, yE, SK[3]), set(L0 - 2, yE + 1, SK[2]);
    if (!capped || cap === 'none') for (let x = 16; x <= 23; x++) if (x % 2) set(x, yB - 3, SK[2]);
  }
  if (a > 0.62) for (let x = L0; x <= L1; x++) set(x, yE + 2, SK[2]), set(PW - 1 - x, yE + 2, SK[3]);
  if (pl) for (let x = 16; x <= 23; x++) set(x, yC + 1, SK[3]); // второй подбородок
  // ——— воротник, знаки различия, награды ———
  const cy = yS - 1;
  if (nat === 'SOV') {
    // закрытый ворот кителя и генеральские петлицы: красное сукно, золотой кант, звёзды
    for (let y = cy - 2; y <= cy + 2; y++) row(y, y < cy ? hwNk + 1.2 : 7.5 - (y - cy) * 0.5, (t) => (t > 0.5 ? U[2] : y === cy - 2 ? U[1] : U[0]));
    for (let x = 15; x <= 24; x++) set(x, cy - 2, x > 21 ? U[2] : U[1]);
    set(19, cy - 1, U[3]), set(20, cy - 1, U[3]), set(19, cy, U[2]), set(20, cy, U[3]);
    const red = hex('#b0302a'), redS = hex('#842420');
    for (const side of [0, 1]) {
      const X = (x) => (side ? PW - 1 - x : x);
      for (let y = cy + 1; y <= cy + 3; y++) for (let x = 11; x <= 15; x++) set(X(x + (y - cy - 1)), y, side ? redS : red);
      set(X(11), cy + 1, G[1]), set(X(16), cy + 2, G[1]), set(X(13), cy + 3, G[1]);
      set(X(13), cy + 2, G[0]);
    }
    // ордена на груди (справа от зрителя): Ленина, Красного Знамени, Красной Звезды
    const med = p.med ?? Math.floor(R() * 3) + 1;
    const MED = [['#c9c3b2', '#d4ad48'], ['#b3332c', '#e2c05a'], ['#a32c26', '#ece6da']];
    for (let i = 0; i < med; i++) {
      const x = 26 + i * 3, y = cy + 6 + (i % 2);
      set(x, y, MED[i][0]), set(x + 1, y, MED[i][1]), set(x, y + 1, MED[i][1]), set(x + 1, y + 1, mul(hex(MED[i][0]), 0.75));
    }
  } else {
    // открытый ворот: рубашка, галстук; петлицы генерала, погоны
    const shirt = nat === 'GER' ? hex('#b9b8a8') : hex('#c9c1a8'), tie = nat === 'GER' ? hex('#2a2c28') : hex('#3c3426');
    for (let y = cy; y <= cy + 5; y++) {
      const w = Math.max(0, 3.2 - (y - cy) * 0.6);
      row(y, w, (t) => (t > 0.3 ? mul(shirt, 0.82) : shirt));
    }
    for (let y = cy + 1; y <= cy + 6; y++) set(19, y, tie), set(20, y, mul(tie, 0.8));
    const collar = nat === 'GER' ? hex('#3a4636') : U[2];
    for (let y = cy; y <= cy + 3; y++) {
      const x0 = Math.round(16 - (y - cy) * 1.2);
      for (let x = x0 - 3; x <= x0; x++) sm(x, y, x === x0 ? mul(collar, 0.8) : collar, mul(collar, 0.75));
    }
    if (nat === 'GER') {
      const red = hex('#b8302a');
      for (const side of [0, 1]) {
        const X = (x) => (side ? PW - 1 - x : x);
        for (let y = cy + 1; y <= cy + 3; y++) for (let x = 11; x <= 13; x++) set(X(x + (y - cy - 1) * -1 + 1), y, red);
        set(X(12), cy + 1, G[0]), set(X(11), cy + 2, G[1]), set(X(12), cy + 2, G[0]), set(X(10), cy + 3, G[1]);
        // погоны: плетёные золото-серебро
        for (let x = 4; x <= 8; x++) set(X(x), cy + 2 - Math.round((x - 4) * 0.25), (x & 1) ? G[0] : Sv[1]);
      }
    } else if (nat === 'ROM') {
      for (const side of [0, 1]) {
        const X = (x) => (side ? PW - 1 - x : x);
        for (let x = 4; x <= 8; x++) set(X(x), cy + 2 - Math.round((x - 4) * 0.25), (x & 1) ? G[0] : G[1]);
        set(X(12), cy + 2, hex('#b8302a')), set(X(11), cy + 3, hex('#b8302a')), set(X(12), cy + 3, G[0]);
      }
    } else {
      // итальянские генеральские звёздочки на воротнике и наградные планки
      for (const side of [0, 1]) {
        const X = (x) => (side ? PW - 1 - x : x);
        set(X(12), cy + 2, Sv[0]), set(X(11), cy + 3, Sv[1]);
        for (let x = 4; x <= 8; x++) set(X(x), cy + 2 - Math.round((x - 4) * 0.25), G[1]);
      }
      const RB = ['#2a5aa8', '#e2e0d8', '#b8302a', '#2e8b3e', '#d4ad48', '#7a2a6a'];
      for (let i = 0; i < 6; i++) set(25 + (i % 3) * 2, cy + 6 + Math.floor(i / 3), RB[i]), set(26 + (i % 3) * 2, cy + 6 + Math.floor(i / 3), RB[(i + 2) % 6]);
    }
    // крест у горла: Рыцарский (вермахт) или Михая Храброго (Румыния)
    const kc = p.kc ?? (nat === 'GER' ? 1 : 0);
    if (kc) {
      const K = nat === 'ROM' ? [hex('#2c4c9c'), G[0]] : [hex('#161616'), Sv[0]], y0 = cy + 1;
      set(19, y0 - 1, nat === 'ROM' ? hex('#c8302a') : hex('#c8302a')), set(20, y0 - 1, hex('#e8e6e0'));
      set(19, y0, K[1]), set(20, y0, K[0]);
      set(18, y0 + 1, K[1]), set(19, y0 + 1, K[0]), set(20, y0 + 1, K[0]), set(21, y0 + 1, K[0]);
      set(19, y0 + 2, K[0]), set(20, y0 + 2, mul(K[0], 0.8));
    }
  }
  // ——— головные уборы ———
  const capRow = (y, hw, col) => row(y, hw, col);
  const sh3 = (C, t) => (t > 0.55 ? C[2] : t < -0.45 ? C[1] : C[0]);
  const yV = 15; // нижний край козырька
  if (cap === 'sov' || cap === 'ger' || cap === 'rom' || cap === 'ita' || cap === 'gerf') {
    const CR = {
      sov: ['#706c47', '#8f8a5d', '#53502f'],
      ger: ['#687060', '#868f7c', '#4b5245'],
      gerf: ['#646b5c', '#7e8673', '#474d41'],
      rom: ['#7c6e47', '#9a8c62', '#5c5134'],
      ita: ['#6e7360', '#8b907a', '#51564a'],
    }[cap].map(hex);
    const BAND = { sov: '#ad2e28', ger: '#2f3b31', gerf: '#2f3b31', rom: '#5a4f30', ita: '#555a48' }[cap];
    const saddle = cap === 'ger', soft = cap === 'gerf', cw = R() < 0.35 ? -0.8 : R() < 0.3 ? 0.6 : 0;
    // тулья
    const top = soft ? 6 : saddle ? 2 : 4;
    for (let y = top; y <= 10; y++) {
      let hw = y === top ? 9.5 : y === top + 1 ? 12 : 13.2;
      if (saddle && y < 5) hw = y === 2 ? 6.5 : y === 3 ? 10 : 12.2;
      if (soft) hw = y === top ? 10.5 : 12.6 - (y > 9 ? 0.8 : 0);
      if (y === 10) hw = soft ? 11.4 : 12.2;
      capRow(y, hw + (y > top ? cw : 0), (t) => (y === top ? CR[1] : sh3(CR, t)));
    }
    if (!soft) for (let x = 10; x <= 17; x++) set(x, top + 1, CR[1]);
    // околыш
    const BC = hex(BAND);
    for (let y = 11; y <= 12; y++) capRow(y, 10.6, (t) => (t > 0.6 ? mul(BC, 0.75) : y === 12 ? mul(BC, 0.88) : BC));
    // канты и шнуры
    if (cap !== 'gerf') {
      capRow(10, 11.8, (t) => (cap === 'sov' ? (t > 0.6 ? hex('#7e211c') : hex('#b8352e')) : t > 0.6 ? G[2] : G[1]));
      capRow(13, 10.4, (t) => (t > 0.55 ? G[2] : t < -0.4 ? G[0] : G[1]));
    } else capRow(13, 10.2, () => hex('#3c3a30'));
    // козырёк
    capRow(14, 10.2, (t) => (t < -0.3 ? hex('#4a423a') : hex('#1f1a16')));
    capRow(yV, 9.2, () => hex('#16120f'));
    // знаки на уборе
    if (cap === 'sov') {
      // звезда с золотым кантом на околыше
      set(19, 10, G[0]), set(20, 10, G[1]);
      set(18, 11, G[1]), set(19, 11, hex('#d8382e')), set(20, 11, hex('#c22c24')), set(21, 11, G[1]);
      set(19, 12, G[1]), set(20, 12, G[2]);
    } else if (cap === 'ger' || cap === 'gerf') {
      const em = cap === 'ger' ? Sv : [hex('#a6a596'), hex('#8c8b7e'), hex('#6c6b60')];
      // орёл (без свастики): крылья и голова
      for (let x = 15; x <= 24; x++) set(x, 5 + (soft ? 2 : 0), x < 17 || x > 22 ? em[1] : em[0]);
      for (let x = 17; x <= 22; x++) set(x, 6 + (soft ? 2 : 0), em[1]);
      set(19, 4 + (soft ? 2 : 0), em[0]), set(20, 4 + (soft ? 2 : 0), em[1]);
      // кокарда в дубовом венке
      set(18, 11, em[1]), set(21, 11, em[1]), set(18, 12, em[2]), set(21, 12, em[2]);
      set(19, 11, hex('#e8e6e0')), set(20, 11, hex('#e8e6e0')), set(19, 12, hex('#b8302a')), set(20, 12, hex('#9a2822'));
    } else if (cap === 'rom') {
      // золотое шитьё околыша и козырька, кокарда
      for (let x = 10; x <= 29; x += 2) set(x, 11, G[1]), set(x + 1, 12, G[2]);
      for (let x = 13; x <= 26; x += 3) set(x, 14, G[1]);
      set(19, 7, G[0]), set(20, 7, G[1]), set(18, 8, G[1]), set(19, 8, G[0]), set(20, 8, G[0]), set(21, 8, G[1]);
      set(19, 11, hex('#2c4c9c')), set(20, 11, hex('#f2c230')), set(20, 12, hex('#c62828')), set(19, 12, hex('#f2c230'));
    } else if (cap === 'ita') {
      // «грека» на околыше и орёл
      for (let x = 10; x <= 29; x++) set(x, x % 3 === 0 ? 11 : 12, G[x % 3 === 0 ? 0 : 1]);
      for (let x = 16; x <= 23; x++) set(x, 7, x === 19 || x === 20 ? G[0] : G[1]);
      set(19, 6, G[0]), set(20, 6, G[1]), set(19, 8, G[1]), set(20, 8, G[2]);
    }
    // тень козырька на лбу
    for (let x = 0; x < PW; x++) {
      const c = get(x, yV + 1);
      if (c && fig[(yV + 1) * PW + x] && Math.abs(x - 19.5) < hwAt(yV + 1)) set(x, yV + 1, mixC(c, SK[3], 0.6));
      const c2 = get(x, yV + 2);
      if (c2 && fig[(yV + 2) * PW + x] && Math.abs(x - 19.5) < hwAt(yV + 2) - 1) set(x, yV + 2, mixC(c2, SK[2], 0.4));
    }
  } else if (cap === 'pap') {
    // папаха из серого каракуля со звездой
    const K = [hex('#8b8984'), hex('#aaa8a2'), hex('#666460'), hex('#4c4a47')];
    for (let y = 2; y <= 14; y++) {
      const hw = y <= 3 ? 12.4 : y >= 13 ? 11 : 12.2;
      for (let x = 0; x < PW; x++) {
        const d = x - 19.5, t = d / hw;
        if (Math.abs(d) >= hw) continue;
        if (y === 2 && R() < 0.35) continue;
        const r = R(), curl = (x + y) % 3 === 0 || (x * 3 + y) % 7 === 0;
        let c = curl ? K[1] : r < 0.25 ? K[2] : K[0];
        if (t > 0.55) c = curl ? K[0] : r < 0.4 ? K[3] : K[2];
        if (t < -0.75 && !curl) c = K[2];
        if (y === 14) c = t > 0.4 ? K[3] : K[2];
        set(x, y, c);
      }
    }
    set(19, 8, G[0]), set(20, 8, G[1]);
    set(18, 9, G[1]), set(19, 9, hex('#d8382e')), set(20, 9, hex('#c22c24')), set(21, 9, G[1]);
    set(19, 10, G[1]), set(20, 10, G[2]);
    for (let x = 0; x < PW; x++) if (Math.abs(x - 19.5) < hwAt(15)) set(x, 15, mixC(get(x, 15) || SK[1], SK[3], 0.55));
  } else if (cap === 'kub') {
    // кубанка: тёмный мех, красный верх с галуном, звезда
    const K = [hex('#2f2824'), hex('#463c35'), hex('#1d1916')];
    for (let y = 5; y <= 6; y++) capRow(y, y === 5 ? 9.5 : 11.2, (t) => (Math.abs(t) < 0.1 ? G[0] : t > 0.5 ? hex('#7e211c') : hex('#a83028')));
    for (let y = 7; y <= 14; y++)
      for (let x = 0; x < PW; x++) {
        const d = x - 19.5, hw = 11.6;
        if (Math.abs(d) >= hw) continue;
        const curl = (x * 5 + y * 3) % 7 < 2;
        set(x, y, d / hw > 0.5 ? (curl ? K[0] : K[2]) : curl ? K[1] : K[0]);
      }
    set(19, 10, G[0]), set(20, 10, G[1]);
    set(18, 11, G[1]), set(19, 11, hex('#d8382e')), set(20, 11, hex('#c22c24')), set(21, 11, G[1]);
    set(19, 12, G[1]), set(20, 12, G[2]);
    for (let x = 0; x < PW; x++) if (Math.abs(x - 19.5) < hwAt(15)) set(x, 15, mixC(get(x, 15) || SK[1], SK[3], 0.5));
  } else if (cap === 'tank') {
    // шлемофон: валики, наушники, налобник; у части — очки
    const K = [hex('#332c26'), hex('#4f463d'), hex('#201b17')];
    for (let y = 4; y <= 14; y++) {
      const hw = y === 4 ? 7.5 : y === 5 ? 10 : y < 8 ? 11.2 : 11.6;
      capRow(y, hw, (t, x) => {
        const ridge = (x === 14 || x === 19 || x === 25) && y < 13;
        if (ridge) return t > 0.5 ? K[0] : K[1];
        return t > 0.5 ? K[2] : t < -0.5 ? K[0] : y < 7 && t < 0 ? K[1] : K[0];
      });
    }
    capRow(14, 10.4, (t) => (t > 0.5 ? K[2] : hex('#3b332c')));
    // наушники и клапаны вдоль щёк
    for (let y = 15; y <= yE + 4; y++) {
      const x0 = Math.floor(19.5 - hwAt(y));
      for (let k = -1; k <= 1; k++) set(x0 + k, y, k === 1 ? K[1] : K[0]), set(PW - 1 - x0 - k, y, k === 1 ? K[0] : K[2]);
      if (y >= yE && y <= yE + 2) set(x0 - 2, y, K[0]), set(PW + 1 - x0, y, K[2]);
    }
    if (p.gog) {
      const rim = hex('#6a5a44'), gl = hex('#8fa6ae'), gh = hex('#d6e6ea');
      for (const side of [0, 1]) {
        const X = (x) => (side ? PW - 1 - x : x);
        for (let x = 13; x <= 17; x++) set(X(x), 9, rim), set(X(x), 12, rim);
        for (let y = 10; y <= 11; y++) set(X(12), y, rim), set(X(18), y, rim), set(X(13), y, gl), set(X(14), y, gl), set(X(15), y, gl), set(X(16), y, gl), set(X(17), y, gl);
        set(X(14), 10, gh);
      }
    }
    for (let x = 0; x < PW; x++) if (Math.abs(x - 19.5) < hwAt(15) - 1) set(x, 15, mixC(get(x, 15) || SK[1], SK[3], 0.45));
  }
  // ——— контур силуэта (на фоне вокруг фигуры) ———
  const out = mixC(hex(BG[nat][1]), hex('#0c0a09'), 0.7);
  const ol = [];
  for (let y = 0; y < PH; y++)
    for (let x = 0; x < PW; x++) {
      if (fig[y * PW + x]) continue;
      const nb = (fig[y * PW + x - 1] && x > 0) || (x < PW - 1 && fig[y * PW + x + 1]) || (y > 0 && fig[(y - 1) * PW + x]) || (y < PH - 1 && fig[(y + 1) * PW + x]);
      if (nb) ol.push(y * PW + x);
    }
  for (const i of ol) img[i] = out;
  // ——— в RGBA ———
  const D = new Uint8ClampedArray(PW * PH * 4);
  for (let i = 0; i < PW * PH; i++) {
    const c = img[i] || [0, 0, 0];
    D[i * 4] = c[0];
    D[i * 4 + 1] = c[1];
    D[i * 4 + 2] = c[2];
    D[i * 4 + 3] = 255;
  }
  return D;
}

export function portraitData(id) {
  const G = GENERALS[id], p = (G && G.por) || { f: 0.6, j: 0.5, n: 0.5, b: 0.5, a: 0.3, h: 'short', c: 'none', s: 7 };
  return draw(p, G ? G.nat : 'SOV');
}
// базовый холст 40×48 (кешируется)
export function portraitCanvas(id) {
  let c = base.get(id);
  if (c) return c;
  const D = portraitData(id);
  c = typeof OffscreenCanvas !== 'undefined' && typeof document === 'undefined' ? new OffscreenCanvas(PW, PH) : document.createElement('canvas');
  c.width = PW;
  c.height = PH;
  const x = c.getContext('2d'), im = x.createImageData(PW, PH);
  im.data.set(D);
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
// v0.8: портрет по готовым параметрам (генералы глав «Барбароссы», не входящие в «Сталинград»)
export function portraitURLP(key, por, nat, k = 3) {
  const kk = `p:${key}|${k}`;
  let u = urls.get(kk);
  if (u) return u;
  const s = document.createElement('canvas');
  s.width = PW;
  s.height = PH;
  const sx = s.getContext('2d'), im = sx.createImageData(PW, PH);
  im.data.set(draw(por, nat));
  sx.putImageData(im, 0, 0);
  const c = document.createElement('canvas');
  c.width = PW * k;
  c.height = PH * k;
  const x = c.getContext('2d');
  x.imageSmoothingEnabled = false;
  x.drawImage(s, 0, 0, c.width, c.height);
  u = c.toDataURL();
  urls.set(kk, u);
  return u;
}
