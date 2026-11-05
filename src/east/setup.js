// «Мировой фронт» v0.10, «Восточный фронт»: новая игра — владельцы областей на 22.06.1941, дивизии по армиям
// (src/war/oob41.js: участки армий двумя точками), командующие направлениями, постройки и хозяйство.
import { HQ0, ECH2, parseUnit } from '../war/oob41.js';
import { makeProj, regionAt, nearestRegion } from './mapdata.js';
import { reindex, mkUnit, sideOf, room, isFront, computeSupply, airAlloc, frontDist, regByName, ZN, FN, setZones, SAVE_KEY, nameFor, assignFronts, sidesOf, bySide, frontsW } from './engine.js';
import { ensureEco } from './eco.js';
import { ensureTech } from './tech.js';
import { ensureDec } from './decisions.js';
import { weatherOf, SIDE0, turnOf, rnd, yearF, lerpT, TD, SIDES, SIDES_E } from './rules.js';
import { STARTS, setBorders, AIR0, AIR0W } from './prewar.js';
import { genHist, PLAN, REINF, parseMix, frontN } from './hist.js';
import { runEvents } from './events.js';
import { initFleets } from './fleet.js';

// область по названию города или области
export function placeR(S, name) {
  const M = S.M;
  M.cityR ??= new Map(M.cities.map((c) => [c.n, c.r]));
  if (M.cityR.has(name)) return M.cityR.get(name);
  return regByName(S, name);
}
// поправки участков для карты провинций: 169-я пд и «Норд» — у Саллы (на Кандалакшу, «Полярфукс»), а не все четыре
// дивизии у Петсамо; 14-я и 52-я сд — у Мурманска (Лица), 104-я и 122-я — на Кандалакшском направлении, 1-я тд — у Кестеньги;
// 54-я сд — у Ухты (Кемь), 71-я — у Ребол
const AX_E = { norw: [[28.7, 66.83], [29.0, 66.9]], s14: [[32.5, 69.1], [31.8, 66.3]], s7: [[31.2, 65.2], [31.6, 61.75]] };
// расстановка дивизий армии вдоль участка
function placeArmy(S, P, A, codes, arrTurn) {
  const M = S.M, side = A.side, ax = AX_E[A.k] || A.ax;
  const [x0, y0] = P(...ax[0]), [x1, y1] = P(...ax[ax.length - 1]);
  const us = [];
  for (const c of codes) {
    if (/^mk\d+/.test(c)) { // мехкорпус 1941 г. — две танковые и моторизованная дивизии
      const num = c.match(/^mk(\d+)/)[1]; // «mk3:650» — 3-й мехкорпус, 650 танков
      us.push({ t: 'arm', n: `${num}-й мк (1 тд)` }, { t: 'arm', n: `${num}-й мк (2 тд)` }, { t: 'mot', n: `${num}-й мк (мд)` });
      continue;
    }
    const p = parseUnit(c, A.nat);
    us.push({ t: p.t === 'gar' ? 'sec' : p.t, n: p.n, nat: p.nat });
  }
  us.forEach((o, i) => {
    const k = (i + 0.5) / us.length, x = x0 + (x1 - x0) * k, y = y0 + (y1 - y0) * k;
    let r = regionAt(M, x, y);
    if (r < 0 || sideOf(S, r) !== side) r = nearestRegion(M, x, y, (q) => sideOf(S, q) === side);
    const nat = o.nat || A.nat;
    // внезапность: войска западных округов не приведены в готовность (Финское направление — успели: финны и горные
    // егеря наступали с 29 июня – 10 июля; prewar.js: warStart — так же)
    const u = mkUnit(S, { s: side, nat, t: o.t, n: o.n, str: side === 'SOV' ? (o.t === 'arm' ? 78 : 82) : 100, rdy: side === 'SOV' ? (arrTurn > 0 || M.reg[r].z === 0 ? 70 : 45) : 100, xp: side === 'SOV' ? 5 : nat === 'GER' ? 35 : 15 });
    u.h41 = 1; // состав 22.06.1941 г.
    if (arrTurn > 0) { u.arr = arrTurn; u.at = r; u.z = M.reg[r].z; }
    else u._want = r;
  });
}
// размещение с учётом вместимости: лишние — в соседние области глубже в тылу
function settle(S) {
  const M = S.M;
  reindex(S);
  const d = bySide(S, (sd) => frontDist(S, sd));
  for (const u of S.units) {
    if (u._want === undefined) continue;
    let r = u._want;
    delete u._want;
    const seen = new Set([r]), q = [r];
    while (room(S, r, u.s) <= 0 && q.length) {
      const c = q.shift();
      const nb = M.reg[c].nb.map((e) => e.r).filter((b) => !seen.has(b) && sideOf(S, b) === u.s).sort((a, b) => d[u.s][a] - d[u.s][b]);
      for (const b of nb) { seen.add(b); q.push(b); }
      r = q.find((b) => room(S, b, u.s) > 0) ?? r;
    }
    u.r = r; S.at[r].push(u);
  }
}
// ——— ранние старты (шаг 6.7): когда дивизия состава 1941 г. появляется на Востоке ———
// СССР — по номерам (сд 1–100 были и в 1936 г., 101–200 — формирования 1939 г., 200+ и мехкорпуса — 1940–1941 гг.);
// вермахт — переброска на Восток (осень 1940 — июнь 1941 г., танки — последними); союзники — с началом войны
const FS = [[1936.0, 0.42], [1939.0, 0.45], [1939.66, 0.55], [1940.0, 0.7], [1940.5, 0.78], [1941.15, 0.85], [1941.4, 1.0]];
const FG = [[1936.0, 0.08], [1939.6, 0.12], [1940.55, 0.15], [1940.7, 0.3], [1941.0, 0.45], [1941.2, 0.65], [1941.33, 0.85], [1941.42, 1.0]];
function yearAt(F, q) {
  if (q <= F[0][1]) return F[0][0] - 1;
  for (let i = 1; i < F.length; i++) if (q <= F[i][1]) return F[i - 1][0] + ((F[i][0] - F[i - 1][0]) * (q - F[i - 1][1])) / (F[i][1] - F[i - 1][1]);
  return F[F.length - 1][0];
}
const hash01 = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return ((h >>> 0) % 10007) / 10007; };
function qOf(u) {
  const n = parseInt(u.n, 10) || 0, h = hash01(u.n + u.t);
  if (u.s === 'SOV') {
    if (/мк/.test(u.n)) return n <= 9 ? 0.75 + 0.01 * n : Math.min(1, 0.88 + 0.004 * n);
    if (/десант/.test(u.n) || u.t === 'abn') return 0.97;
    if (u.t === 'cav' || u.t === 'mtn' || u.t === 'sec') return 0.1;
    if (!n) return 0.3 + 0.4 * h;
    return n <= 100 ? 0.05 + (0.35 * n) / 100 : n <= 200 ? 0.45 + (0.3 * (n - 100)) / 100 : Math.min(0.97, 0.8 + (0.17 * (n - 200)) / 250);
  }
  if (u.t === 'arm' || u.t === 'mot') return 0.7 + 0.3 * h;
  return 0.85 * (0.5 * h + 0.5 * Math.min(1, n / 300));
}
// очередь формирования: место дивизии среди своих (0…1) по qOf — кривые FS/FG дают долю дивизий на карте к дате
function deployQ(S) {
  for (const sd of ['SOV', 'GER']) {
    const L = S.units.filter((u) => u.hp !== undefined && u.s === sd && u.nat === sd);
    L.sort((a, b) => qOf(a) - qOf(b) || a.id - b.id);
    L.forEach((u, i) => { u.dq = (i + 0.5) / L.length; });
  }
}
// ход появления (≤ 0); союзники Оси — 0 (вступают в войну 22 июня)
export function deployTurn(u) {
  if (u.nat !== 'SOV' && u.nat !== 'GER') return 0;
  const y = yearAt(u.s === 'SOV' ? FS : FG, u.dq ?? qOf(u));
  return Math.min(0, Math.ceil(((y - 1941) * 365.25 - 172) / TD - 1e-9));
}
const FAC_K = [[1936, 0.65], [1939.6, 0.85], [1941.4, 1]]; // доля заводов 1941 г. на дату старта
// старт до войны: границы и события до даты старта, дивизии — по датам формирования
function earlyStart(S, iso, t0) {
  const M = S.M;
  for (const u of S.units) if (u.h41) { if (u.r >= 0) u.hp = u.r; u.std = [u.str, u.rdy, u.xp]; }
  deployQ(S);
  S.turn = t0; S.t0 = t0; S.peace = 1;
  // заводы: к 1936 г. меньше, чем к 1941 г. (третья пятилетка и перевооружение — стройка игрока); у ИИ к войне — как в 1941 г.
  const kf = lerpT(FAC_K, yearF(t0));
  if (kf < 0.999) {
    S.facStd = Int8Array.from(S.fac);
    for (const sd of ['SOV', 'GER']) {
      const rs = [];
      let tot = 0;
      for (let r = 0; r < M.R; r++) if (S.fac[r] > 0 && M.nats[S.own0[r]] === sd) { rs.push(r); tot += S.fac[r]; }
      for (let cut = Math.round(tot * (1 - kf)); cut > 0; cut--) {
        rs.sort((a, b) => S.fac[b] - S.fac[a] || a - b);
        if (S.fac[rs[0]] <= 0) break;
        S.fac[rs[0]]--;
      }
    }
  }
  setBorders(S, iso);
  reindex(S);
  for (const u of S.units) {
    if (u.hp === undefined || u.r < 0) continue;
    const dt = deployTurn(u);
    delete u.dq;
    if (dt > t0) { // ещё не сформирована (не переброшена на Восток)
      const a = S.at[u.r]; a.splice(a.indexOf(u), 1);
      u.r = -1; u.arr = dt; u.at = u.hp; u.z = M.reg[u.hp].z; u.hist = 1; u.pw = 1;
    } else if (sideOf(S, u.r) !== u.s) { // на чужой (тогда) земле — в ближайшую свою область
      const a = S.at[u.r]; a.splice(a.indexOf(u), 1);
      const g = M.reg[u.hp];
      u.r = -1; u._want = nearestRegion(M, g.x, g.y, (q) => sideOf(S, q) === u.s);
    }
  }
  settle(S);
  for (let z = 0; z < ZN; z++) S.wx[z] = weatherOf(t0, z, 0, S.seed);
}
const POST0 = { GER: ['def', 'atk', 'atk', 'atk', 'def'], SOV: ['def', 'def', 'def', 'def', 'def'] };
const MEN0 = { GER: 60, SOV: 150, UK: 40, USA: 60 }, MOR00 = { GER: 75, SOV: 60, UK: 70, USA: 70 };
export function newGame(M, { side = 'SOV', mode = 'hist', diff = 1, seed = (Math.random() * 1e9) | 0, noAsk = 0, noEv = 0, start = '0' } = {}) {
  const R = M.R;
  setZones(M);
  // v0.12: стороны партии — по карте (большая карта Европы и Африки — все четыре страны)
  const SS = M.world ? SIDES : SIDES_E, by = (f) => Object.fromEntries(SS.map((sd) => [sd, f(sd)]));
  const S = {
    v: 1, side, mode, diff, seed, rs: seed || 1, turn: 0, M, sides: SS,
    own: Int16Array.from(M.reg.map((g) => g.o)), own0: Int16Array.from(M.reg.map((g) => g.o)),
    fac: Int8Array.from(M.reg.map((g) => g.ind)), fort: new Int8Array(R), afd: new Int8Array(R), rail: new Uint8Array(R).fill(1),
    capT: new Int16Array(R).fill(-9999), bd0: new Int16Array(R),
    units: [], nextId: 1, num: {}, q: [], evac: [], log: [], news: [], battles: [], flags: {}, ev: {},
    gen: by((sd) => genHist({ M }, sd).map((g) => g[0])),
    post: by((sd) => [...(POST0[sd] || new Array(ZN).fill('def'))]),
    tgt: by(() => new Array(ZN).fill(-1)),
    airF: by(() => -1), air: by((sd) => (M.world ? AIR0W[sd] : 0) || AIR0[sd] || 30),
    pp: by(() => 60), men: by((sd) => MEN0[sd] ?? 60), inc: by(() => ({})), spent: by(() => ({})),
    mor: by((sd) => MOR00[sd] ?? 70), sup: {}, railCap: by(() => 0),
    stats: by(() => ({ lost: 0, pow: 0, battles: 0, made: 0 })),
    wx: new Array(ZN).fill('dry'), wxShift: [0, 0, 0, 0, 0].map(() => 0), auto: { recruit: true, build: true },
    over: null,
  };
  if (S.sides === SIDES_E) delete S.sides; // «Восточный фронт»: как в v0.11 (sidesOf → GER, SOV)
  else S.warT = { USA: turnOf('1941-12-11') }; // большая карта: США вступают в войну после Пёрл-Харбора
  S.wxShift = [0, 1, 2, 3, 4].map(() => Math.round((rnd(S) - 0.5) * 12));
  for (let z = 0; z < ZN; z++) S.wx[z] = weatherOf(0, z, S.wxShift[0], seed);
  // расстояние от границы 1941 г. по своей территории (тыловые источники снабжения Оси)
  reindex(S);
  for (const sd of sidesOf(S)) { const d = frontDist(S, sd); for (let r = 0; r < R; r++) if (sideOf(S, r) === sd) S.bd0[r] = d[r]; }
  // постройки на 1941 г.
  const F = { Ленинград: 2, Москва: 1, Мурманск: 2, Севастополь: 3, Одесса: 2, Киев: 2, Брест: 1, Кёнигсберг: 2, Берлин: 1, Выборг: 1, Полоцк: 1, Новоград: 1, Коростень: 1, Летичев: 1, 'Могилёв-Подольский': 1, Днепропетровск: 1, Запорожье: 1, Мозырь: 1 };
  for (const [n, l] of Object.entries(F)) { const r = placeR(S, n); if (r >= 0) S.fort[r] = l; }
  for (const g of M.reg) if (g.vp >= 3 || g.f.includes('c')) S.afd[g.id] = 1;
  for (const n of ['Варшава', 'Кёнигсберг', 'Краков', 'Люблин', 'Бухарест', 'Хельсинки', 'Львов', 'Минск', 'Рига', 'Каунас']) { const r = placeR(S, n); if (r >= 0) S.afd[r] = 1; }
  // войска
  const P = makeProj(M.proj);
  for (const A of HQ0) {
    if (!A.u || !A.ax) continue;
    const arr = A.arr ? (A.arr >= 8 ? Math.round(A.arr / 7) : 0) : 0;
    placeArmy(S, P, A, A.u.split(' '), arr);
  }
  for (const [k, codes, day, pt] of ECH2) {
    const A = HQ0.find((h) => h.k === k);
    if (A) placeArmy(S, P, { ...A, ax: [pt, pt] }, codes.split(' '), Math.max(1, Math.ceil(day / 7)));
  }
  settle(S);
  // исторические подкрепления (в обоих режимах; в свободном — союзники зависят от успехов, см. ai.js)
  for (const [sd, nat, iso, mix, at, n] of REINF) {
    const t = turnOf(iso), r = placeR(S, at);
    for (const [ty, k] of parseMix(mix)) for (let i = 0; i < k; i++) {
      const u = mkUnit(S, { s: sd, nat, t: ty, n: nameFor(S, sd, nat, ty), str: 100, rdy: 80, xp: sd === 'SOV' ? 30 : 20 });
      u.r = -1; u.arr = t; u.at = r; u.z = r >= 0 ? M.reg[r].z : 2; u.grp = n; u.hist = 1;
    }
  }
  const st = STARTS[start] || STARTS['0'], t0 = turnOf(st.iso);
  if (t0 < 0) earlyStart(S, st.iso, t0);
  ensureState(S);
  if (S.peace) { S.eqStd = JSON.parse(JSON.stringify(S.eq)); S.lineStd = bySide(S, (sd) => ({ ...S.line[sd].sh })); }
  reindex(S);
  initFleets(S);
  for (const sd of sidesOf(S)) computeSupply(S, sd);
  S.airA = bySide(S, (sd) => airAlloc(S, sd));
  if (noAsk) S.noAsk = 1;
  if (noEv) S.noEv = 1;
  runEvents(S);
  return S;
}
// поля новых версий (и для старых сохранений): фронты, хозяйство
export function ensureState(S) {
  setZones(S.M);
  S.fr ??= {};
  for (const sd of sidesOf(S)) {
    const L = (S.fr[sd] ??= []);
    for (let f = 0; f < FN; f++) L[f] ??= { n: frontN(S, sd, f), col: f, on: f < ZN ? 1 : 0, man: 0, pick: 0 };
    while (S.gen[sd].length < FN) S.gen[sd].push(null);
    while (S.post[sd].length < FN) S.post[sd].push('def');
    while (S.tgt[sd].length < FN) S.tgt[sd].push(-1);
  }
  S.pauto ??= new Array(FN).fill(1);
  while (S.pauto.length < FN) S.pauto.push(1);
  // v0.11 (отзыв 04.11): фронты — постоянные, по направлениям; свои участки и лишние фронты старых сохранений — убрать
  for (const sd of sidesOf(S)) S.fr[sd].forEach((F, f) => { if (f < ZN) { F.n = frontN(S, sd, f); F.on = 1; } else F.on = 0; });
  if (S.M.world) frontsW(S);
  delete S.fcust; delete S.fzo;
  for (const u of S.units) if (u.zf >= ZN) u.zf = Math.min(ZN - 1, u.z ?? 2);
  S.airS ??= bySide(S, () => null);
  S.peace ??= 0;
  S.fprio ??= bySide(S, () => null);
  assignFronts(S);
  ensureEco(S, (n) => placeR(S, n));
  ensureTech(S);
  ensureDec(S);
  return S;
}
export { SAVE_KEY };
