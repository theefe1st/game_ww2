// «Мировой фронт» v0.11: флоты — Балтийский, Черноморский, Северный (СССР) и силы Оси на тех же морях (без постройки кораблей).
// Сила флота — очки (линкоры, крейсера, эсминцы, подлодки — грубо), по истории растёт или падает (FLEETS.pts: «Тирпиц» в Норвегии
// с 1942 г. — до того на севере лишь эсминцы и подлодки, «Шарнхорст» потоплен в декабре 1943 г.…). Флот стоит в главной базе — первой своей из списка; потеря базы — уход
// в следующую (−20 % кораблей), без баз флот погиб. Небо над базой за противником — потери от авиации, своё — ремонт.
// Балтийский флот заперт минами в Финском заливе, пока Таллин у противника (на море ×0,35; пушки бьют по-прежнему).
// Господство на море — доля сил на море: сила морских десантов (ops.js: seaK), северные конвои ленд-лиза (engine.js: income).
// Поддержка флота в приморских боях (engine.js: odds): до ±15 % в 400 км от базы.
import { lerpT, yearF, hostile, WK } from './rules.js';
import { sideOf, cityR, airRatio, note, foesOf, sidesOf } from './engine.js';
import { seas, seaName } from './ops.js';

export const FLEETS = [
  { id: 'balS', side: 'SOV', sea: ['Балтийское море'], n: 'Балтийский флот', base: ['Таллин', 'Ленинград'], pts: [[1941, 60]] },
  { id: 'balG', side: 'GER', sea: ['Балтийское море'], n: 'Флот Оси на Балтике', base: ['Данциг', 'Кёнигсберг', 'Штеттин', 'Хельсинки'], pts: [[1941, 30]] },
  { id: 'blkS', side: 'SOV', sea: ['Чёрное море', 'Азовское море'], n: 'Черноморский флот', base: ['Севастополь', 'Новороссийск', 'Туапсе', 'Батуми'], pts: [[1941, 50]] },
  { id: 'blkG', side: 'GER', sea: ['Чёрное море', 'Азовское море'], n: 'Флот Оси на Чёрном море', base: ['Констанца', 'Варна'], pts: [[1941.4, 10], [1942.4, 20]] },
  { id: 'barS', side: 'SOV', sea: ['Баренцево море'], n: 'Северный флот', base: ['Мурманск', 'Архангельск'], pts: [[1941.4, 18], [1943, 24], [1944.5, 30]] },
  { id: 'barG', side: 'GER', sea: ['Баренцево море'], n: 'Кригсмарине в Норвегии', base: ['Петсамо', 'Вадсё', 'Нарвик'], pts: [[1941.4, 8], [1941.95, 10], [1942.08, 40], [1943.97, 40], [1943.98, 28], [1944.86, 28], [1944.87, 14]] },
];
export const SEAS = ['Балтийское море', 'Чёрное море', 'Баренцево море'];
const FB = Object.fromEntries(FLEETS.map((f) => [f.id, f]));
export const fleetOf = (id) => FB[id];
const BASE_LOSS = 0.2, RANGE = 400, MINES = 0.35;
// состояние: S.fl[id] = { p — сила, b — база (название) или null, c — предел по истории в прошлую неделю }
export function initFleets(S) {
  const y = yearF(Math.max(0, S.turn));
  S.fl = {};
  for (const f of FLEETS) { const c = lerpT(f.pts, y); S.fl[f.id] = { p: c, b: baseOf(S, f), c }; }
  return S.fl;
}
const baseOf = (S, f) => f.base.find((n) => { const r = cityR(S, n); return r >= 0 && sideOf(S, r) === f.side; }) || null;
export const mined = (S, f) => f.id === 'balS' && !S.peace && sideOf(S, cityR(S, 'Таллин')) === 'GER';
// сила на море (для господства): у запертого минами флота — ×0,35
const effOf = (S, f) => { const st = S.fl?.[f.id]; return st && st.b ? st.p * (mined(S, f) ? MINES : 1) : 0; };
// доля сил стороны на море (0…1) или null — флотов там нет
export function seaDom(S, sea, side) {
  let a = 0, b = 0, any = false;
  for (const f of FLEETS) {
    if (!f.sea.includes(sea)) continue;
    any = true;
    if (hostile(f.side, side)) b += effOf(S, f); else a += effOf(S, f); // союзники (Британия и США) — вместе
  }
  if (!any) return null;
  return a + b > 0 ? a / (a + b) : 0.5;
}
// ход: предел по истории, смена базы, потери от авиации и ремонт
export function fleetWeek(S) {
  if (!S.fl) initFleets(S);
  const y = yearF(S.turn);
  for (const f of FLEETS) {
    const st = S.fl[f.id], c = lerpT(f.pts, y);
    if (c > st.c && st.b) st.p += c - st.c; // пополнение по истории (переход кораблей, ленд-лиз)
    st.c = c;
    if (st.p > c) st.p = c;
    const b = baseOf(S, f);
    if (!S.peace && st.b && b !== st.b && st.p > 0) {
      const r = cityR(S, st.b);
      if (b) { st.p *= 1 - BASE_LOSS; note(S, { side: f.side, txt: `${f.n}: потеряна база ${st.b}, новая база — ${b}; потеряна пятая часть кораблей`, ic: 'warship', r }); }
      else { st.p = 0; note(S, { side: f.side, txt: `${f.n}: баз не осталось — флот погиб`, ic: 'warship', r }); }
    }
    st.b = st.p > 0 ? b : null;
    if (S.peace || !st.b) continue;
    const ar = airRatio(S, f.side, S.M.reg[cityR(S, st.b)].z);
    if (ar < 0.4) st.p = Math.max(0, st.p - st.p * 0.012 * WK * ((0.4 - ar) / 0.4)); // удары авиации по базе и конвоям (за ход — доля недели)
    else if (ar >= 0.45 && st.p < c) st.p = Math.min(c, st.p + 0.5 * WK); // ремонт
  }
  NAV.delete(S);
}
// поддержка флота у берега: { сторона: сила } — сила флотов, чья база в 400 км и на том же море, что и область
const NAV = new WeakMap();
export function navSup(S, r) {
  if (!S.fl) return null;
  let N = NAV.get(S);
  if (!N || N.t !== S.turn) {
    const M = S.M, sea = seas(M), R = M.reg.length, v = Object.fromEntries(sidesOf(S).map((sd) => [sd, new Float32Array(R)]));
    for (const f of FLEETS) {
      const st = S.fl[f.id];
      if (!st?.b || st.p <= 0) continue;
      const B = M.reg[cityR(S, st.b)], ids = new Set();
      for (const [k, n] of Object.entries(sea.name)) if (f.sea.includes(n)) ids.add(+k);
      for (let q = 0; q < R; q++) {
        const sr = sea.sr[q];
        if (!sr || !sr.some((x) => ids.has(x)) || Math.hypot(M.reg[q].x - B.x, M.reg[q].y - B.y) > RANGE) continue;
        if (v[f.side]) v[f.side][q] += st.p;
      }
    }
    N = { t: S.turn, v };
    NAV.set(S, N);
  }
  let any = false;
  for (const sd in N.v) if (N.v[sd][r]) { any = true; break; }
  return any ? Object.fromEntries(Object.entries(N.v).map(([sd, a]) => [sd, a[r]])) : null;
}
// множитель силы атакующего от флотов у берега (до ±15 %)
export function navK(S, side, r) {
  const v = navSup(S, r);
  if (!v) return 1;
  const a = v[side] || 0;
  let d = 0;
  for (const f of foesOf(S, side)) d += v[f] || 0;
  return 1 + (0.15 * (a - d)) / (a + d + 20);
}
// северные конвои ленд-лиза: господство в Баренцевом море
export const convoyK = (S) => { const d = seaDom(S, 'Баренцево море', 'SOV'); return d === null ? 1 : 0.85 + 0.3 * d; };
// место флота на карте: открытая вода ближе всего к базе — по возможности в 3 клетках растра (24 км) от берега,
// чтобы плашка не ложилась на подпись города (в узких заливах — ближе к берегу); база без выхода к своему морю
// на карте (Нарвик) — ближайшая вода этого моря
export function fleetSpot(M, f, baseR) {
  const key = f.id + ':' + baseR;
  M.fleetXY ??= new Map();
  if (M.fleetXY.has(key)) return M.fleetXY.get(key);
  const sea = seas(M), { id, nx, ny, ST } = sea, B = M.reg[baseR], c = M.cities.find((x) => x.r === baseR && f.base.includes(x.n)) || B;
  const ids = new Set(Object.entries(sea.name).filter(([, n]) => f.sea.includes(n)).map(([k]) => +k));
  const ci = Math.floor(c.x / ST), cj = Math.floor(c.y / ST);
  const find = (o, W) => {
    let best = null, bd = 1e9;
    for (let dj = -W; dj <= W; dj++) for (let di = -W; di <= W; di++) {
      const i = ci + di, j = cj + dj;
      if (i < o || j < o || i >= nx - o || j >= ny - o || !ids.has(id[j * nx + i])) continue;
      let open = true;
      for (let b = -o; b <= o && open; b++) for (let a = -o; a <= o; a++) if (id[(j + b) * nx + i + a] < 0) { open = false; break; }
      if (!open) continue;
      const d = di * di + dj * dj;
      if (d < bd) (bd = d), (best = [(i + 0.5) * ST, (j + 0.5) * ST, Math.sqrt(d) * ST]);
    }
    return best;
  };
  let p = find(3, 12);
  if (!p) p = find(2, 30) || find(2, 70);
  const out = p ? [p[0], p[1]] : null;
  M.fleetXY.set(key, out);
  return out;
}
export { seaName };
