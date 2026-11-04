// «Мировой фронт» v0.10, «Восточный фронт 1941–1945»: правила — время (1 ход = 1 неделя), стороны и нации,
// рода войск, местность, погода, качество войск по годам, сложность. Чистые функции без состояния.
export const D0 = Date.UTC(1941, 5, 22); // воскресенье 22 июня 1941 г.
export const DAY = 86400000;
export const LAST_TURN = 236; // конец 1945 г.
export const dateOf = (turn) => new Date(D0 + turn * 7 * DAY);
export const turnOf = (iso) => Math.round((Date.parse(iso + 'T00:00:00Z') - D0) / (7 * DAY));
export const dayOfIso = (iso) => Math.round((Date.parse(iso + 'T00:00:00Z') - D0) / DAY);
export const yearF = (turn) => 1941 + (172 + turn * 7) / 365.25;
const MON = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
const MONF = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
export const fmtTurn = (t, full = false) => { const d = dateOf(t); return `${d.getUTCDate()} ${(full ? MONF : MON)[d.getUTCMonth()]} ${d.getUTCFullYear()}`; };
export const fmtShort = (t) => { const d = dateOf(t); return `${d.getUTCDate()} ${MON[d.getUTCMonth()]}`; };

export const SIDES = ['GER', 'SOV'];
export const other = (s) => (s === 'GER' ? 'SOV' : 'GER');
export const SIDE_N = { GER: 'Германия', SOV: 'СССР' };
export const SIDE_A = { GER: 'Ось', SOV: 'СССР' };
export const NAT_N = { GER: 'Германия', SOV: 'СССР', FIN: 'Финляндия', ROM: 'Румыния', HUN: 'Венгрия', SVK: 'Словакия', BUL: 'Болгария', CRO: 'Хорватия', ITA: 'Италия' };
export const SIDE0 = { GER: 'GER', FIN: 'GER', ROM: 'GER', HUN: 'GER', SVK: 'GER', CRO: 'GER', ITA: 'GER', BUL: 'GER', SOV: 'SOV' };
// цвета наций: фишка (фон, кайма, знак) и заливка области (RGBA)
export const NATC = {
  GER: { bg: '#59656f', bd: '#2b3238', fg: '#f3f1ea', tint: [74, 86, 104, 52] },
  FIN: { bg: '#e9eef3', bd: '#5a7590', fg: '#23466b', tint: [236, 244, 252, 76] },
  ROM: { bg: '#c7a43a', bd: '#6c5614', fg: '#fffbe8', tint: [214, 176, 40, 56] },
  HUN: { bg: '#5f8a4c', bd: '#2f4a24', fg: '#fffbe8', tint: [96, 150, 70, 56] },
  SVK: { bg: '#4e6fa8', bd: '#22385e', fg: '#fffbe8', tint: [70, 100, 170, 56] },
  CRO: { bg: '#7a6aa8', bd: '#3c3260', fg: '#fffbe8', tint: [120, 100, 170, 56] },
  ITA: { bg: '#6d8a62', bd: '#34462c', fg: '#fffbe8', tint: [110, 140, 96, 50] },
  BUL: { bg: '#8c7a54', bd: '#4a3e22', fg: '#fffbe8', tint: [140, 120, 80, 50] },
  SOV: { bg: '#b23a2c', bd: '#5c1610', fg: '#fff4e4', tint: [176, 64, 44, 34] },
};
// рода войск: сила атаки/обороны, ходы (очки движения за неделю), стоимость (⚙ производство, 👥 люди)
export const TYPES = {
  inf: { n: 'Пехота', sh: 'пех.', att: 4, def: 5, mp: 2.6, pp: 7, mp$: 10, mech: 0 },
  mtn: { n: 'Горные', sh: 'гор.', att: 4, def: 5.5, mp: 2.6, pp: 8, mp$: 10, mech: 0 },
  cav: { n: 'Кавалерия', sh: 'кав.', att: 3.2, def: 3.2, mp: 3.6, pp: 4, mp$: 7, mech: 0 },
  mot: { n: 'Моторизованные', sh: 'мот.', att: 6.5, def: 5, mp: 4.6, pp: 13, mp$: 8, mech: 1 },
  arm: { n: 'Танковые', sh: 'танк.', att: 10, def: 6, mp: 4.6, pp: 22, mp$: 7, mech: 1 },
  sec: { n: 'Охранные', sh: 'охр.', att: 1.2, def: 2.6, mp: 1.8, pp: 3, mp$: 5, mech: 0 },
};
export const TYPE_ORDER = ['arm', 'mot', 'inf', 'mtn', 'cav', 'sec'];
export const isMech = (u) => TYPES[u.t].mech === 1;
// местность: оборона, стоимость входа, штраф подвижных войск в атаке
export const TER = {
  pla: { n: 'Равнина', def: 1, mv: 1, mech: 1 },
  for: { n: 'Лес', def: 1.3, mv: 1.35, mech: 0.75 },
  mar: { n: 'Болота', def: 1.45, mv: 1.8, mech: 0.6 },
  hil: { n: 'Холмы', def: 1.3, mv: 1.25, mech: 0.85 },
  mnt: { n: 'Горы', def: 1.85, mv: 2, mech: 0.55 },
};
// погода по полосам (север — Финское и Северное направления, центр, юг — Южное и Кавказское)
export const WX = {
  dry: { n: 'Сухо', ic: 'sun', mv: 1, atk: 1, air: 1, sup: 1 },
  rain: { n: 'Дожди', ic: 'rain', mv: 1.3, atk: 0.88, air: 0.6, sup: 0.9 },
  mud: { n: 'Распутица', ic: 'mud', mv: 2.1, atk: 0.62, air: 0.35, sup: 0.7 },
  snow: { n: 'Снег', ic: 'snow', mv: 1.35, atk: 0.85, air: 0.6, sup: 0.85 },
  frost: { n: 'Морозы', ic: 'frost', mv: 1.3, atk: 0.8, air: 0.5, sup: 0.8, frozen: 1 },
};
const CAL = [
  [[0, 'frost'], [62, 'snow'], [97, 'mud'], [132, 'dry'], [258, 'rain'], [274, 'mud'], [300, 'snow'], [322, 'frost']], // север
  [[0, 'frost'], [66, 'snow'], [84, 'mud'], [118, 'dry'], [268, 'rain'], [284, 'mud'], [312, 'snow'], [335, 'frost']], // центр
  [[0, 'frost'], [46, 'snow'], [66, 'mud'], [104, 'dry'], [284, 'rain'], [298, 'mud'], [330, 'snow'], [352, 'frost']], // юг
];
export const BAND = [0, 0, 1, 2, 2]; // направление → полоса погоды
export function weatherOf(turn, zone, shift = 0, seed = 0) {
  const t = dateOf(turn), y = t.getUTCFullYear(), doy = Math.floor((t - Date.UTC(y, 0, 1)) / DAY) + 3;
  const cal = CAL[BAND[zone]];
  let w = cal[0][1];
  for (const [d0, k] of cal) if (doy >= d0 + (d0 > 0 ? shift : 0)) w = k;
  if (w === 'dry' && (turn * 7 + zone * 13 + seed) % 17 === 0) w = 'rain';
  return w;
}
// первая военная зима: вермахт без зимнего обмундирования
export const winter41 = (turn) => turn >= turnOf('1941-11-23') && turn <= turnOf('1942-03-08');
// качество войск по годам (на дивизию): опыт, связь, командование, техника
const QT = {
  GER: [[1941.45, 1.25], [1941.9, 1.22], [1942.4, 1.2], [1942.9, 1.14], [1943.5, 1.08], [1944.0, 1.02], [1944.5, 0.95], [1945.0, 0.9], [1945.5, 0.86]],
  SOV: [[1941.45, 0.68], [1941.75, 0.7], [1942.0, 0.74], [1942.5, 0.76], [1942.9, 0.82], [1943.5, 0.9], [1944.0, 0.96], [1944.5, 1.0], [1945.5, 1.04]],
  FIN: [[1941.4, 1.12], [1945.5, 1.06]],
  ROM: [[1941.4, 0.62], [1943, 0.6], [1944.6, 0.58]],
  HUN: [[1941.4, 0.64], [1945.5, 0.62]],
  ITA: [[1941.4, 0.6], [1945.5, 0.6]],
  SVK: [[1941.4, 0.58], [1945.5, 0.56]],
  CRO: [[1941.4, 0.55], [1945.5, 0.55]],
  BUL: [[1941.4, 0.6], [1945.5, 0.6]],
};
export function lerpT(T, x) {
  if (x <= T[0][0]) return T[0][1];
  for (let i = 1; i < T.length; i++) if (x <= T[i][0]) return T[i - 1][1] + ((T[i][1] - T[i - 1][1]) * (x - T[i - 1][0])) / (T[i][0] - T[i - 1][0]);
  return T[T.length - 1][1];
}
export const quality = (nat, turn) => lerpT(QT[nat] || QT.GER, yearF(turn));
// танки: у РККА 1941 г. — устаревшие Т-26 и БТ; с 1942 г. — Т-34
const TQ = { GER: [[1941.4, 1], [1943.4, 1.08], [1945.5, 1.1]], SOV: [[1941.4, 0.7], [1942.3, 0.92], [1943.5, 1], [1945.5, 1.06]] };
export const tankQ = (side, turn) => lerpT(TQ[side] || TQ.GER, yearF(turn));
export const DIFF = [
  { k: 0, n: 'Лёгкая', pl: 1.18, ai: 0.9, eco: 1.2, cap: 1.12 },
  { k: 1, n: 'Нормальная', pl: 1.06, ai: 0.98, eco: 1.05, cap: 1.03 },
  { k: 2, n: 'Тяжёлая', pl: 0.97, ai: 1.06, eco: 0.95, cap: 0.97 },
];
export const MODES = { hist: { n: 'Исторический', d: 'события и планы сторон по истории' }, free: { n: 'Свободный', d: 'своя стратегия, история может пойти иначе' } };
export const POSTURE = { def: { n: 'Оборона', ic: 'def' }, atk: { n: 'Наступление', ic: 'atk' }, ret: { n: 'Отход', ic: 'ret' } };
// случайные числа (xorshift), состояние — в S.rs
export function rnd(S) {
  let x = S.rs | 0 || 0x9e3779b9;
  x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
  S.rs = x;
  return (x >>> 0) / 4294967296;
}
export const plural = (n, a, b, c) => { const m = Math.abs(n) % 100, k = m % 10; return m > 10 && m < 20 ? c : k === 1 ? a : k >= 2 && k <= 4 ? b : c; };
export const divW = (n) => plural(n, 'дивизия', 'дивизии', 'дивизий');
