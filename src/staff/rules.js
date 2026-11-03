// «Сталинград 1942–1943» (v0.7): правила — время, погода, параметры соединений, бой, движение, снабжение.
// Чистый модуль (без DOM): используется движком, ИИ, интерфейсом и headless-симуляцией.
import { clamp } from './geo.js';

// ——— время: t — часы от 19.11.1942 00:00 ———
export const T_START = 6; // утро 19 ноября: планирование, в 07:30 — артподготовка
export const T_END = 75 * 24 + 18; // 2 февраля 1943, 18:00
const MON = [['ноября', 30, 11], ['декабря', 31, 12], ['января', 31, 1], ['февраля', 28, 2]];
export function dateOf(t) {
  let d = Math.floor(t / 24) + 19, m = 0, y = 1942;
  while (d > MON[m][1]) (d -= MON[m][1]), m++;
  if (m >= 2) y = 1943;
  return { d, m: MON[m][2], mn: MON[m][0], y, h: ((t % 24) + 24) % 24 };
}
export const dayIdx = (t) => Math.floor(t / 24);
export function dateLabel(t, withH = true) {
  const D = dateOf(t);
  return `${D.d} ${D.mn} ${D.y}${withH ? `, ${String(D.h).padStart(2, '0')}:00` : ``}`;
}
export function shortDate(t) {
  const D = dateOf(t);
  return `${D.d}.${String(D.m).padStart(2, '0')}`;
}
export const tOf = (d, m, h = 0) => {
  // день и месяц (11, 12, 1, 2) → часы
  let k = 0;
  for (const [, n, mm] of MON) {
    if (mm === m) return (k + d - 19) * 24 + h;
    k += n;
  }
  return 0;
};
export const isDay = (t) => {
  const h = ((t % 24) + 24) % 24;
  return h >= 7 && h < 16;
};
export const isDawn = (t) => {
  const h = ((t % 24) + 24) % 24;
  return h >= 6 && h < 9;
};

// ——— погода по дням (по сводкам и воспоминаниям: туман 19–20.11, морозы декабря и января) ———
// c — ясно, o — облачно, s — снег, b — метель, f — туман
const WX = 'ffooccsosboo' + 'sfoccosoffoosocfocccosbboccsosb' + 'ccosbcccoccosboccossoccbooscco' + 'o' + 'so';
const TEMP = [-1, -2, -3, -4, -6, -8, -5, -2, -3, -8, -10, -7,
  -5, -3, -6, -12, -15, -10, -8, -5, -2, 0, -3, -5, -8, -10, -14, -12, -12, -16, -18, -20, -18, -15, -20, -22, -25, -27, -25, -18, -15, -12, -20,
  -22, -24, -18, -15, -20, -25, -28, -30, -25, -22, -24, -20, -18, -20, -25, -30, -32, -28, -20, -18, -22, -28, -30, -25, -22, -20, -18, -25, -27, -22, -20,
  -18, -15];
export const WXN = { c: 'ясно', o: 'облачно', s: 'снег', b: 'метель', f: 'туман' };
export function weather(t) {
  const d = clamp(dayIdx(t), 0, TEMP.length - 1), k = WX[d] || 'o';
  const fly = { c: 1, o: 0.7, s: 0.4, f: 0.08, b: 0 }[k];
  const mv = { c: 1, o: 1, s: 0.85, f: 0.95, b: 0.6 }[k];
  const atk = { c: 1, o: 1, s: 0.95, f: 1, b: 0.85 }[k];
  return { k, n: WXN[k], temp: TEMP[d], fly, mv, atk };
}
// реки: ледостав (Дон — пехота с 1.12, техника с 12.12; Волга — 17.12)
export const ICE = { donFoot: tOf(1, 12), donAll: tOf(12, 12), volga: tOf(17, 12, 12) };

// ——— стороны и нации ———
export const SIDES = ['SOV', 'AX'];
export const NAT = {
  SOV: { side: 'SOV', n: 'СССР', a: 'советская', q: 0, mor: 72, win: 95, atq: 0.8, tq: 1.0, col: '#c62828' },
  GER: { side: 'AX', n: 'Германия', a: 'германская', q: 0.08, mor: 78, win: 45, atq: 1.2, tq: 1.1, col: '#2a2b2e' },
  ROM: { side: 'AX', n: 'Румыния', a: 'румынская', q: -0.06, mor: 55, win: 30, atq: 0.45, tq: 0.45, col: '#1f4aa8' },
  ITA: { side: 'AX', n: 'Италия', a: 'итальянская', q: -0.08, mor: 52, win: 25, atq: 0.4, tq: 0.3, col: '#2e8b3e' },
};
export const sideOf = (nat) => NAT[nat].side;
export const enemy = (s) => (s === 'SOV' ? 'AX' : 'SOV');

// ——— типы соединений ———
// mob: foot | cav | mot | arm; sz — место в клетке (3 на клетку, в городе 4); ech — значок величины
export const TYPES = {
  inf: { n: 'стрелковая дивизия', nAx: 'пехотная дивизия', mob: 'foot', sz: 1, ech: 'XX', sym: 'inf' },
  gds: { n: 'гвардейская стрелковая дивизия', mob: 'foot', sz: 1, ech: 'XX', sym: 'inf' },
  bde: { n: 'стрелковая бригада', mob: 'foot', sz: 0.5, ech: 'X', sym: 'inf' },
  tbde: { n: 'танковая бригада', mob: 'arm', sz: 0.5, ech: 'X', sym: 'arm' },
  tk: { n: 'танковый корпус', mob: 'arm', sz: 1, ech: 'XXX', sym: 'arm' },
  mk: { n: 'механизированный корпус', mob: 'arm', sz: 1, ech: 'XXX', sym: 'arm' },
  cc: { n: 'кавалерийский корпус', mob: 'cav', sz: 1, ech: 'XXX', sym: 'cav' },
  cav: { n: 'кавалерийская дивизия', mob: 'cav', sz: 1, ech: 'XX', sym: 'cav' },
  pz: { n: 'танковая дивизия', mob: 'arm', sz: 1, ech: 'XX', sym: 'arm' },
  mot: { n: 'моторизованная дивизия', mob: 'mot', sz: 1, ech: 'XX', sym: 'mot' },
  lw: { n: 'авиаполевая дивизия', mob: 'foot', sz: 1, ech: 'XX', sym: 'inf' },
  kg: { n: 'боевая группа', mob: 'mot', sz: 0.5, ech: 'III', sym: 'mot' },
};
export const MOBILE = (u) => TYPES[u.type].mob !== 'foot';
export const MECH = (u) => TYPES[u.type].mob === 'arm' || TYPES[u.type].mob === 'mot';
// штат: люди, «активные штыки», орудия и миномёты, ПТО, танки, автомашины
export const TPL = {
  SOV: { inf: [9400, 4300, 150, 40, 0, 130], gds: [10400, 4800, 165, 44, 0, 150], bde: [4200, 2300, 54, 16, 0, 60], tbde: [1100, 350, 8, 4, 53, 70],
    tk: [7800, 1800, 64, 24, 168, 650], mk: [13500, 4600, 120, 40, 200, 1100], cc: [15500, 5400, 96, 30, 20, 90], cav: [4700, 1900, 32, 10, 0, 30] },
  GER: { inf: [15000, 6800, 140, 60, 0, 600], pz: [14500, 3600, 105, 50, 160, 2300], mot: [14000, 5000, 112, 60, 50, 1900], lw: [10000, 5200, 70, 30, 0, 300],
    kg: [3000, 1500, 22, 16, 8, 160] },
  ROM: { inf: [13000, 6600, 92, 24, 0, 160], cav: [7200, 2900, 42, 12, 0, 60], pz: [10500, 2600, 64, 24, 130, 900] },
  ITA: { inf: [11000, 5200, 80, 22, 0, 250] },
};

// ——— боеспособность и категории (по германской «Kampfwert»: I — пригодна к любому наступлению … V — небоеспособна) ———
export const CAT = ['', 'I', 'II', 'III', 'IV', 'V'];
export const CAT_TXT = ['', 'пригодна для любых наступательных задач', 'пригодна для ограниченного наступления', 'полностью пригодна для обороны', 'ограниченно пригодна для обороны', 'небоеспособна'];
export const CAT_COL = ['', '#3fae49', '#9cc83b', '#e3c23a', '#e98a2f', '#d6453a'];
export function quality(u) {
  return 0.55 + 0.6 * (u.tr / 100) + 0.25 * (u.xp / 100) + (u.gds ? 0.08 : 0) + NAT[u.nat].q;
}
export function coldK(u, temp) {
  if (temp > -8) return 1;
  return 1 - (1 - (u.win || 0) / 100) * Math.min(0.28, (-8 - temp) / 60);
}
export function fitness(u, temp = -5) {
  const mor = 0.5 + 0.5 * (u.mor / 100);
  const fat = 1 - 0.45 * Math.pow(u.fat / 100, 1.3);
  const ctl = 0.65 + 0.35 * (u.ctl / 100);
  const food = u.food < 25 ? 0.7 + 0.012 * u.food : 1;
  return mor * fat * ctl * food * coldK(u, temp);
}
// очки боя по составу
export const P_INF = (u) => (u.bay / 1000) * 2.2;
export const P_ART = (u) => (u.guns / 10) * 0.45;
export const P_ARM = (u) => (u.tanks / 10) * 1.4 * NAT[u.nat].tq;
export const P_AT = (u) => (u.at / 10) * 0.6 * NAT[u.nat].atq;
export function ammoK(u) {
  return 0.35 + 0.65 * (u.amm / 100);
}
export function fuelK(u) {
  return MECH(u) ? 0.3 + 0.7 * (u.fuel / 100) : 1;
}
// «боеспособность» 0–100: укомплектованность штыками и оружием, дух, усталость, снабжение
export function combatValue(u, temp = -5) {
  const T = u.auth;
  const pr = clamp(u.bay / Math.max(1, T.bay), 0, 1.1), gr = clamp(u.guns / Math.max(1, T.guns), 0, 1.1);
  const tr = T.tanks ? clamp(u.tanks / T.tanks, 0, 1.1) : 1;
  const str = MOBILE(u) && T.tanks ? 0.35 * Math.pow(pr, 0.7) + 0.25 * gr + 0.4 * Math.pow(tr, 0.8) : 0.62 * Math.pow(pr, 0.7) + 0.38 * gr;
  const sup = Math.min(1, 0.55 + 0.45 * Math.min(u.amm, MECH(u) ? u.fuel : 100) / 100);
  const v = 100 * str * fitness(u, temp) * sup * (0.75 + 0.25 * quality(u));
  return clamp(Math.round(v), 0, 100);
}
export function catOf(v) {
  return v >= 62 ? 1 : v >= 46 ? 2 : v >= 30 ? 3 : v >= 14 ? 4 : 5;
}

// ——— бой ———
export const TERR = { 1: { n: 'степь', def: 1, arm: 1, mv: 10 }, 2: { n: 'посёлок', def: 1.3, arm: 0.75, mv: 11 }, 3: { n: 'город', def: 2.2, arm: 0.4, mv: 18 }, 4: { n: 'пойма', def: 1.25, arm: 0.6, mv: 16 } };
export function entK(e) {
  return 1 + 0.12 * e;
}
// сила атакующего (без учёта ПТО цели): пехота + артиллерия (с подготовкой) + танки
export function atkPower(u, o) {
  const k = quality(u) * fitness(u, o.temp) * ammoK(u);
  const art = P_ART(u) * (o.prepK || 1) * (o.hugDef ? 0.7 : 1);
  const arm = P_ARM(u) * fuelK(u) * (o.armK ?? 1);
  return { inf: (P_INF(u) + art) * k * (o.mod || 1), arm: arm * quality(u) * fitness(u, o.temp) * (o.mod || 1) };
}
export function defPower(u, o) {
  const k = quality(u) * fitness(u, o.temp) * ammoK(u);
  const base = (P_INF(u) + P_ART(u) * (o.hugAtk ? 0.7 : 1) + P_ARM(u) * 0.7 * fuelK(u) + P_AT(u) * 0.5) * k;
  return base * (o.mod || 1);
}
export function antiTank(u) {
  return P_AT(u) * ammoK(u) + P_ARM(u) * 0.5 * fuelK(u);
}
// исход штурма по соотношению сил (с шумом): 0 — отбит, 1 — держится, 2 — отходит, 3 — бежит
export function outcome(R) {
  return R < 1 ? 0 : R < 1.5 ? 1 : R < 3 ? 2 : 3;
}
export const OUT_TXT = ['атака отбита', 'тяжёлый бой, оборона держится', 'противник отходит', 'противник бежит'];
export function lossFrac(R, night) {
  const I = night ? 0.7 : 1;
  return { a: 0.035 * I * Math.pow(clamp(1 / R, 0.3, 3), 0.7), d: 0.03 * I * Math.pow(clamp(R, 0.3, 4), 0.8) };
}

// ——— движение ———
export const SPEED = { foot: [2.5, 1.0], cav: [4.6, 2.0], mot: [7.5, 3.2], arm: [6, 2.6] }; // км/ч днём и ночью
export const FAT_GAIN = { foot: 1.5, cav: 1.1, mot: 0.8, arm: 0.9 };
export function speedOf(u, t, wx, tr) {
  const m = TYPES[u.type].mob, [d, n] = SPEED[m];
  let v = isDay(t) ? d : n;
  if (!isDay(t) && tr.night) v = d * 0.85;
  v *= wx.mv;
  if (MECH(u) && dayIdx(t) > 43) v *= 0.88; // глубокий снег января
  if (MECH(u) && wx.temp < -20) v *= 0.9;
  if (MECH(u) && u.fuel < 10) v *= 0.25;
  v *= 1 - 0.6 * Math.pow(u.fat / 100, 2);
  if (tr.fast) v *= 1.15;
  if (tr.cav && m === 'cav') v *= 1.2;
  if (tr.cautious) v *= 0.9;
  if (u.dis > 0) v *= 0.5;
  return v;
}
// стоимость перехода в соседнюю клетку (км); Infinity — нельзя
export function stepCost(S, u, a, b) {
  const D = S.D, t = S.t, tb = +D.terr[b];
  if (!tb) return Infinity;
  let c = TERR[tb].mv;
  const e = S.edge.get(a < b ? a * 4096 + b : b * 4096 + a);
  if (e) {
    const m = TYPES[u.type].mob;
    if (e.t === 1) c += 4;
    else if (e.t === 2) {
      if (e.br) c += 2;
      else if (t >= ICE.donAll || (t >= ICE.donFoot && (m === 'foot' || m === 'cav'))) c += 6;
      else if (m === 'foot' || m === 'cav') c += 16; // подручные средства
      else return Infinity;
    } else if (e.t === 3) {
      if (sideOf(u.nat) !== 'SOV') return Infinity;
      if (t >= ICE.volga) c += 6;
      else if (e.fe) c += 22;
      else return Infinity;
    }
  }
  return c;
}
// снабжение по дальности от источника (в «шагах» с учётом железных дорог)
export function supLevel(d) {
  return d < 0 ? 0 : d <= 10 ? 1 : d <= 14 ? 0.75 : d <= 18 ? 0.5 : d <= 23 ? 0.3 : 0.15;
}
export const SUP_TXT = (s) => (s >= 1 ? 'полное' : s >= 0.75 ? 'хорошее' : s >= 0.5 ? 'ограниченное' : s >= 0.3 ? 'скудное' : s > 0 ? 'на пределе' : 'нет — окружение');

// ——— форматирование ———
export const fmtN = (n) => (n >= 10000 ? `${Math.round(n / 1000)} тыс.` : n >= 1000 ? `${(n / 1000).toFixed(1).replace('.', ',')} тыс.` : `${Math.round(n)}`);
export const plural = (n, a, b, c) => {
  const k = Math.abs(n) % 100, j = k % 10;
  return k > 10 && k < 20 ? c : j === 1 ? a : j >= 2 && j <= 4 ? b : c;
};
