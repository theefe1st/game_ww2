// «Мировой фронт» v0.10, «Восточный фронт»: новая игра — владельцы областей на 22.06.1941, дивизии по армиям
// (src/war/oob41.js: участки армий двумя точками), командующие направлениями, постройки и хозяйство.
import { HQ0, ECH2, parseUnit } from '../war/oob41.js';
import { makeProj, regionAt, nearestRegion } from './mapdata.js';
import { reindex, mkUnit, sideOf, room, isFront, computeSupply, airAlloc, frontDist, regByName, ZN, SAVE_KEY } from './engine.js';
import { weatherOf, SIDE0, turnOf, rnd } from './rules.js';
import { GEN_HIST, PLAN, REINF, parseMix } from './hist.js';

// область по названию города или области
export function placeR(S, name) {
  const M = S.M;
  M.cityR ??= new Map(M.cities.map((c) => [c.n, c.r]));
  if (M.cityR.has(name)) return M.cityR.get(name);
  return regByName(S, name);
}
// расстановка дивизий армии вдоль участка
function placeArmy(S, P, A, codes, arrTurn) {
  const M = S.M, side = A.side;
  const [x0, y0] = P(...A.ax[0]), [x1, y1] = P(...A.ax[A.ax.length - 1]);
  const us = [];
  for (const c of codes) {
    if (/^mk\d+/.test(c)) { // мехкорпус 1941 г. — две танковые и моторизованная дивизии
      const num = c.replace(/\D/g, '');
      us.push({ t: 'arm', n: `${num}-й мк (тд)` }, { t: 'arm', n: `${num}-й мк (тд)` }, { t: 'mot', n: `${num}-й мк (мд)` });
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
    const u = mkUnit(S, { s: side, nat, t: o.t, n: o.n, str: side === 'SOV' ? (o.t === 'arm' ? 78 : 82) : 100, rdy: side === 'SOV' ? 70 : 100, xp: side === 'SOV' ? 5 : nat === 'GER' ? 35 : 15 });
    if (arrTurn > 0) { u.arr = arrTurn; u.at = r; u.z = M.reg[r].z; }
    else u._want = r;
  });
}
// размещение с учётом вместимости: лишние — в соседние области глубже в тылу
function settle(S) {
  const M = S.M;
  reindex(S);
  const d = { GER: frontDist(S, 'GER'), SOV: frontDist(S, 'SOV') };
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
export function newGame(M, { side = 'SOV', mode = 'hist', diff = 1, seed = (Math.random() * 1e9) | 0 } = {}) {
  const R = M.R;
  const S = {
    v: 1, side, mode, diff, seed, rs: seed || 1, turn: 0, M,
    own: Int16Array.from(M.reg.map((g) => g.o)), own0: Int16Array.from(M.reg.map((g) => g.o)),
    fac: Int8Array.from(M.reg.map((g) => g.ind)), fort: new Int8Array(R), afd: new Int8Array(R), rail: new Uint8Array(R).fill(1),
    capT: new Int16Array(R).fill(-99), bd0: new Int16Array(R),
    units: [], nextId: 1, num: {}, q: [], evac: [], log: [], news: [], battles: [], flags: {}, ev: {},
    gen: { GER: GEN_HIST.GER.map((g) => g[0]), SOV: GEN_HIST.SOV.map((g) => g[0]) },
    post: { GER: ['def', 'atk', 'atk', 'atk', 'def'], SOV: ['def', 'def', 'def', 'def', 'def'] },
    tgt: { GER: new Array(ZN).fill(-1), SOV: new Array(ZN).fill(-1) },
    airF: { GER: -1, SOV: -1 }, air: { GER: 100, SOV: 46 },
    pp: { GER: 60, SOV: 60 }, men: { GER: 60, SOV: 150 }, inc: { GER: {}, SOV: {} }, spent: { GER: {}, SOV: {} },
    mor: { GER: 75, SOV: 60 }, sup: {}, railCap: { GER: 0, SOV: 0 },
    stats: { GER: { lost: 0, pow: 0, battles: 0, made: 0 }, SOV: { lost: 0, pow: 0, battles: 0, made: 0 } },
    wx: new Array(ZN).fill('dry'), wxShift: [0, 0, 0, 0, 0].map(() => 0), auto: { recruit: true, build: false },
    over: null,
  };
  S.wxShift = [0, 1, 2, 3, 4].map(() => Math.round((rnd(S) - 0.5) * 12));
  for (let z = 0; z < ZN; z++) S.wx[z] = weatherOf(0, z, S.wxShift[0], seed);
  // расстояние от границы 1941 г. по своей территории (тыловые источники снабжения Оси)
  reindex(S);
  for (const sd of ['GER', 'SOV']) { const d = frontDist(S, sd); for (let r = 0; r < R; r++) if (sideOf(S, r) === sd) S.bd0[r] = d[r]; }
  // постройки на 1941 г.
  const F = { Ленинград: 2, Москва: 1, Севастополь: 3, Одесса: 2, Киев: 1, Брест: 1, Кёнигсберг: 2, Берлин: 1, Выборг: 1, Полоцк: 1, Новоград: 1, Коростень: 1 };
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
      const u = mkUnit(S, { s: sd, nat, t: ty, n: '', str: 100, rdy: 80, xp: sd === 'SOV' ? 30 : 20 });
      u.r = -1; u.arr = t; u.at = r; u.z = r >= 0 ? M.reg[r].z : 2; u.grp = n; u.hist = 1;
    }
  }
  reindex(S);
  computeSupply(S, 'GER'); computeSupply(S, 'SOV');
  S.airA = { GER: airAlloc(S, 'GER'), SOV: airAlloc(S, 'SOV') };
  return S;
}
export { SAVE_KEY };
