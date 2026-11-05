// «Мировой фронт» v0.10–0.11.1, «Восточный фронт 1941–1945»: правила — время (1 ход = 5 дней с v0.11.1, было 7),
// стороны и нации, рода войск, местность, погода, качество войск по годам, сложность. Чистые функции без состояния.
export const D0 = Date.UTC(1941, 5, 22); // воскресенье 22 июня 1941 г.
export const DAY = 86400000;
// v0.11.1 (отзыв 05.11): ход — 5 дней (фронт за ход сдвигается меньше). Недельные величины (производство, люди,
// стройка, обучение, пополнение, отдых) идут долей недели WK за ход; сроки «в неделях» переводит wT.
export const TD = 5; // дней в ходе
export const WK = TD / 7; // доля недели в одном ходе
export const wT = (w) => Math.max(1, Math.round((w * 7) / TD)); // недели → ходы (не меньше 1)
export const tW = (t) => (t * TD) / 7; // ходы → недели
export const dayOfT = (turn) => turn * TD; // день от 22.06.1941
// раз в n недель: ход, в который начинается новая n-недельная пора
export const everyW = (turn, n) => Math.floor((turn * TD) / (7 * n)) !== Math.floor(((turn - 1) * TD) / (7 * n));
// за ход — та же доля «затухания», что за неделю (k — множитель за неделю): k^WK
export const perTurn = (k) => Math.pow(k, WK);
export const dateOf = (turn) => new Date(D0 + turn * TD * DAY);
export const turnOf = (iso) => Math.round((Date.parse(iso + 'T00:00:00Z') - D0) / (TD * DAY));
export const dayOfIso = (iso) => Math.round((Date.parse(iso + 'T00:00:00Z') - D0) / DAY);
export const yearF = (turn) => 1941 + (172 + turn * TD) / 365.25;
export const LAST_TURN = turnOf('1945-12-30'); // конец 1945 г.
// целое число из дробного темпа (например, 3 ж/д участка в неделю → по ходам 2, 2, 3…): остаток копится в S.acc
export function accInt(S, key, x) { S.acc ??= {}; const v = (S.acc[key] || 0) + x; const n = Math.floor(v + 1e-9); S.acc[key] = v - n; return n; }
const MON = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
const MONF = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
export const fmtTurn = (t, full = false) => { const d = dateOf(t); return `${d.getUTCDate()} ${(full ? MONF : MON)[d.getUTCMonth()]} ${d.getUTCFullYear()}`; };
export const fmtShort = (t) => { const d = dateOf(t); return `${d.getUTCDate()} ${MON[d.getUTCMonth()]}`; };

// v0.12: стороны — страны (за каждую можно играть): Германия (вся Ось), СССР, Великобритания (с доминионами,
// «Свободной Францией» и армиями в изгнании), США. В партии — S.sides (engine.js: sidesOf; «Восточный фронт» — SIDES_E).
// Враги — Германия и все прочие; СССР, Британия и США друг другу — союзники (не воюют, но и не ходят по чужой земле).
export const SIDES = ['GER', 'SOV', 'UK', 'USA'];
export const SIDES_E = ['GER', 'SOV'];
export const hostile = (a, b) => !!a && !!b && a !== b && (a === 'GER') !== (b === 'GER');
// главный противник стороны (у Германии — СССР; на Западе и в Африке — см. engine.js foesOf)
export const other = (s) => (s === 'GER' ? 'SOV' : 'GER');
export const SIDE_N = { GER: 'Германия', SOV: 'СССР', UK: 'Великобритания', USA: 'США' };
export const SIDE_A = { GER: 'Ось', SOV: 'СССР', UK: 'Великобритания', USA: 'США' };
export const NAT_N = {
  GER: 'Германия', SOV: 'СССР', FIN: 'Финляндия', ROM: 'Румыния', HUN: 'Венгрия', SVK: 'Словакия', BUL: 'Болгария', CRO: 'Хорватия', ITA: 'Италия',
  // v0.11 (шаг 6.7): страны 1936–1941 гг. (ранние старты) и нейтралы
  POL: 'Польша', LIT: 'Литва', LAT: 'Латвия', EST: 'Эстония', CZE: 'Чехословакия', AUT: 'Австрия', YUG: 'Югославия', NOR: 'Норвегия', GRE: 'Греция',
  SWE: 'Швеция', TUR: 'Турция', IRN: 'Иран',
};
// нации ранних стартов (нет в map.json — добавляются в M.nats при чтении карты, см. mapdata.js)
export const NATS_PW = ['POL', 'LIT', 'LAT', 'EST', 'CZE', 'AUT', 'YUG', 'NOR', 'GRE'];
export const SIDE0 = { GER: 'GER', FIN: 'GER', ROM: 'GER', HUN: 'GER', SVK: 'GER', CRO: 'GER', ITA: 'GER', BUL: 'GER', SOV: 'SOV' };
// цвета наций: фишка (фон, кайма, знак) и заливка области (RGBA)
export const NATC = {
  GER: { bg: '#59656f', bd: '#2b3238', fg: '#f3f1ea', tint: [78, 96, 124, 40] },
  FIN: { bg: '#e9eef3', bd: '#5a7590', fg: '#23466b', tint: [236, 244, 252, 76] },
  ROM: { bg: '#c7a43a', bd: '#6c5614', fg: '#fffbe8', tint: [214, 176, 40, 56] },
  HUN: { bg: '#5f8a4c', bd: '#2f4a24', fg: '#fffbe8', tint: [96, 150, 70, 56] },
  SVK: { bg: '#4e6fa8', bd: '#22385e', fg: '#fffbe8', tint: [70, 100, 170, 56] },
  CRO: { bg: '#7a6aa8', bd: '#3c3260', fg: '#fffbe8', tint: [120, 100, 170, 56] },
  ITA: { bg: '#6d8a62', bd: '#34462c', fg: '#fffbe8', tint: [110, 140, 96, 50] },
  BUL: { bg: '#8c7a54', bd: '#4a3e22', fg: '#fffbe8', tint: [140, 120, 80, 50] },
  SOV: { bg: '#b23a2c', bd: '#5c1610', fg: '#fff4e4', tint: [200, 86, 58, 24] },
  // нейтральные страны 1936–1941 гг.: бледные заливки (neu — без фишек и фронта)
  POL: { bg: '#d8d2c8', bd: '#8a2a34', fg: '#8a2a34', tint: [214, 150, 156, 46], neu: 1 },
  LIT: { bg: '#d8d2c8', bd: '#5e7a3a', fg: '#5e7a3a', tint: [196, 186, 110, 46], neu: 1 },
  LAT: { bg: '#d8d2c8', bd: '#7a2e34', fg: '#7a2e34', tint: [190, 132, 128, 46], neu: 1 },
  EST: { bg: '#d8d2c8', bd: '#2a5a94', fg: '#2a5a94', tint: [130, 160, 200, 46], neu: 1 },
  CZE: { bg: '#d8d2c8', bd: '#22457e', fg: '#22457e', tint: [150, 160, 196, 46], neu: 1 },
  AUT: { bg: '#d8d2c8', bd: '#9a2a30', fg: '#9a2a30', tint: [206, 160, 150, 46], neu: 1 },
  YUG: { bg: '#d8d2c8', bd: '#2a4a8a', fg: '#2a4a8a', tint: [156, 170, 200, 46], neu: 1 },
  NOR: { bg: '#d8d2c8', bd: '#8a2a34', fg: '#8a2a34', tint: [200, 160, 160, 46], neu: 1 },
  GRE: { bg: '#d8d2c8', bd: '#2a5aa0', fg: '#2a5aa0', tint: [140, 176, 214, 46], neu: 1 },
};
// рода войск: сила атаки/обороны, ходы (очки движения за неделю), стоимость (⚙ производство, 👥 люди)
export const TYPES = {
  inf: { n: 'Пехота', sh: 'пех.', att: 4, def: 5, mp: 2.6, pp: 7, mp$: 10, mech: 0 },
  mtn: { n: 'Горные', sh: 'гор.', att: 4, def: 5.5, mp: 2.6, pp: 8, mp$: 10, mech: 0 },
  cav: { n: 'Кавалерия', sh: 'кав.', att: 3.2, def: 3.2, mp: 3.6, pp: 4, mp$: 7, mech: 0 },
  mot: { n: 'Моторизованные', sh: 'мот.', att: 6.5, def: 5, mp: 4.6, pp: 13, mp$: 8, mech: 1 },
  arm: { n: 'Танковые', sh: 'танк.', att: 10, def: 6, mp: 4.6, pp: 22, mp$: 7, mech: 1 },
  sec: { n: 'Охранные', sh: 'охр.', att: 1.2, def: 2.6, mp: 1.8, pp: 3, mp$: 5, mech: 0 },
  abn: { n: 'Воздушно-десантные', sh: 'вдд', att: 4.5, def: 4.5, mp: 2.6, pp: 9, mp$: 8, mech: 0 },
};
export const TYPE_ORDER = ['arm', 'mot', 'inf', 'mtn', 'abn', 'cav', 'sec'];
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
  // v0.12, большая карта
  [[0, 'snow'], [50, 'rain'], [92, 'dry'], [288, 'rain'], [345, 'snow']], // приморская (Франция, Бенилюкс, Британия)
  [[0, 'rain'], [95, 'dry'], [290, 'rain'], [322, 'mud'], [355, 'rain']], // средиземноморская (Италия)
  [[0, 'dry']], // пустыня (Северная Африка, Ближний Восток): дожди — зимой и изредка
  [[0, 'snow'], [55, 'mud'], [86, 'dry'], [290, 'rain'], [335, 'snow']], // балканская
];
// направление → полоса погоды: Финское, Северное — север, Центральное — центр, Южное, Кавказское — юг;
// большая карта: Западное, Британское — приморская, Скандинавское — север, Итальянское — средиземноморская,
// Балканское — балканская, Африканское, Ближневосточное — пустыня
export const BAND = [0, 0, 1, 2, 2, 3, 0, 4, 6, 5, 5, 3];
// детерминированное «случайное» число 0…1 по целому ключу (без состояния)
export function hash01(n) { let x = (n | 0) ^ 0x9e3779b9; x = Math.imul(x ^ (x >>> 16), 0x85ebca6b); x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35); x ^= x >>> 16; return (x >>> 0) / 4294967296; }
export function weatherOf(turn, zone, shift = 0, seed = 0) {
  const t = dateOf(turn), y = t.getUTCFullYear(), doy = Math.floor((t - Date.UTC(y, 0, 1)) / DAY) + 3;
  const cal = CAL[BAND[zone]];
  let w = cal[0][1];
  for (const [d0, k] of cal) if (doy >= d0 + (d0 > 0 ? shift : 0)) w = k;
  // дожди и в сухую пору: у каждой полосы свои (детерминированно по ходу, полосе и зерну партии); осенью и весной — чаще
  if (w === 'dry') { const m = t.getUTCMonth(), p = BAND[zone] === 5 ? (m <= 1 || m === 11 ? 0.16 : 0.02) : m === 5 || m === 6 ? 0.1 : m === 4 || m === 7 ? 0.13 : 0.17; if (hash01(turn * 7 + BAND[zone] * 1013 + seed * 7919) < p) w = 'rain'; }
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
// сроки в ходах (v0.11.1: ход — 5 дней): «3 хода»; для справки — дни
export const turnsW = (n) => `${n} ${plural(n, 'ход', 'хода', 'ходов')}`;
export const daysW = (n) => `${n} ${plural(n, 'день', 'дня', 'дней')}`;
