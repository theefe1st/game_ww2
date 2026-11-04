// «Фронт 1941–1945» (v0.9): ход игры без DOM. Сутки = фаза Оси, затем фаза СССР.
// newGame → (игрок ходит) → endTurn → … ; simDay — для симуляции «ИИ против ИИ» (tools/sim-war.mjs).
// Состояние S сериализуется (save/load) без карты M и справочников.
import { HQ0, ECH2, TPL, parseUnit } from './oob41.js';
import { FRONTS, AXIS_LATER, ANCH } from './plan.js';
import { ALLG, genSide } from './gens41.js';
import { REGIONS } from '../europe/regions.js';
import {
  dayOf, fmtDate, yearF, rnd, SIDES, other, NSIDE0, sideOfH, natIdx, weather, winter41, alive, isMech, reindex, unitsAt, stackN,
  STACK, stackCap, placeAt, zoc, dailyMP, reach, pathTo, doMove, capture, railOK, repairRail, supplyMap, pockets, pocketName, gen, doAttack,
  forecast, attackers, canAttack, destroy, enemyAt, passable, genOf,
} from './rules.js';
import { runAI, frontDistance, railMove, posture } from './ai.js';
import { ecoInit, ecoDay, mkUnit, rearSpot, assignArmy, hqHex, fortStock, strength } from './eco.js';
import { EVENTS, dueEvents, evByK } from './events.js';

export const VER = 1;
// запасы крепостей (суток в кольце)
const FORT0 = { Брест: 25, Киев: 10, Ленинград: 120, Москва: 40, Одесса: 75, Севастополь: 90, Кёнигсберг: 60, Познань: 30, Бреслау: 80, Кюстрин: 30 };
export const SAVE_KEY = 'wf_war_v1';
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
// мораль: цена городов, котлов, разгромленных армий; потери (человек на 1 очко)
export const cityMor = (c) => (c.vp >= 4 ? c.vp * 0.15 * (c.cap ? 1.3 : 1) : c.vp >= 2 ? 0.1 : 0.02);
const MOR = { pk: { SOV: 0.1, GER: 0.3 }, pkWin: { SOV: 0.05, GER: 0.2 }, army: { SOV: 1, GER: 2 }, loss: (sd, y) => (sd === 'GER' ? 200000 : y < 1943 ? 300000 : 450000) };
// изменение морали с учётом причины (S.mst — счёт за войну и за неделю для «Сводки»)
export const MOR_WHY = { loss: 'потери', drift: 'настроения', city: 'города', pocket: 'котлы', army: 'армии', event: 'решения' };
export function addMor(S, side, dv, why) {
  const m0 = S.morale[side];
  S.morale[side] = clamp(m0 + dv, 0, 130);
  const d = S.morale[side] - m0;
  if (!d) return;
  const T = (S.mst ||= { GER: {}, SOV: {}, wk: { GER: {}, SOV: {} } });
  T[side][why] = (T[side][why] || 0) + d;
  T.wk[side][why] = (T.wk[side][why] || 0) + d;
}
// особые города: падение — удар по морали (и подъём у противника)
const MOR_CITY = { Москва: [15, 6], Ленинград: [8, 4], Сталинград: [6, 4], Берлин: [30, 0], Киев: [2, 1] };

// ——— сообщения ———
export function note(S, o) {
  S.log.push({ d: S.day, ...o });
  if (S.log.length > 500) S.log.splice(0, S.log.length - 500);
}

// ——— новая игра ———
export function newGame(M, { side = 'SOV', diff = 1, seed } = {}) {
  seed = (seed ?? Date.now() % 2147483647) >>> 0 || 1;
  const N = M.N;
  const S = {
    v: VER, seed, rs: seed, side, diff, day: 0, phase: 'GER', ver: 1, uid: 0, M, G: ALLG,
    own: Uint8Array.from(M.own0), nside: M.nations.map((n) => NSIDE0[n] || null),
    rok: new Uint8Array(N), src: { GER: new Uint8Array(N), SOV: new Uint8Array(N) }, ports: { GER: [], SOV: [] }, partial: { GER: [], SOV: [] },
    fst: {}, units: [], hqs: {}, morale: { GER: 105, SOV: 75 }, air: { GER: 0.7, SOV: 0.3 },
    ev: { done: {}, fx: {}, tfx: [], pending: [] }, xops: [], noop: [],
    loss: { GER: 0, SOV: 0 }, pow: { GER: 0, SOV: 0 }, dayLoss: { GER: 0, SOV: 0 },
    wxShift: [], wx: [], today: null, log: [], pk: { GER: [], SOV: [] }, over: null, railCap: { GER: 0, SOV: 0 }, supL: {}, net: {}, frontDist: {},
    stat: { fall: {}, lib: {}, take: {} }, stop: null, undo: [],
  };
  for (let i = 0; i < 5; i++) S.wxShift.push(Math.round((rnd(S) - 0.5) * 12));
  for (let h = 0; h < N; h++) if (M.rail[h]) {
    S.rok[h] = 1;
    const n0 = M.nations[M.own0[h]];
    if (NSIDE0[n0] === 'GER') S.src.GER[h] = 1;
    else if (n0 === 'SOV' && M.reg[h]) {
      const R = REGIONS[M.reg[h] - 1];
      if (R.lon >= 40.5 || R.lat < 43.6) S.src.SOV[h] = 1;
    }
  }
  for (const c of M.cities) if (c.fort) S.fst[c.k] = FORT0[c.n] ?? 60;
  reindex(S);
  buildOOB(S);
  reindex(S);
  S.wx = [0, 1, 2].map((z) => weather(S, z));
  S.today = newToday();
  seaSupply(S);
  ecoInit(S);
  S.frontDist = { GER: frontDistance(S, 'GER'), SOV: frontDistance(S, 'SOV') };
  for (const sd of SIDES) {
    const sp = supplyMap(S, sd);
    S.supL[sd] = sp.L;
    (S.supC ||= {})[sd] = sp.conn;
    S.net[sd] = sp.net;
  }
  railCaps(S);
  dayEvents(S);
  beginPhase(S, 'GER');
  if (side !== 'GER') {
    if (side === 'SOV') {
      runAI(S, 'GER');
      endPhase(S, 'GER');
      beginPhase(S, 'SOV');
    }
  }
  return S;
}
const newToday = () => ({ cities: [], dead: [], battles: [], fights: 0, atkN: { GER: 0, SOV: 0 } });

// ——— состав на 22 июня ———
const ORG0 = { GER: [90, 35], FIN: [85, 30], ROM: [65, 10], HUN: [70, 10], SVK: [65, 5], ITA: [70, 10], SOV: [60, 5] };
function unitFrom(S, code, H0, o = {}) {
  const p = parseUnit(code, H0.nat);
  const nat = p.nat, side = nat === 'SOV' ? 'SOV' : 'GER';
  const T = TPL[nat]?.[p.t] || TPL[side === 'SOV' ? 'SOV' : 'GER'][p.t] || TPL.GER.inf;
  let [men, gun, tnk] = T;
  if (p.tanks != null) tnk = p.tanks;
  const k = side === 'SOV' ? 0.72 + rnd(S) * 0.2 : 0.93 + rnd(S) * 0.07;
  const [org, xp] = ORG0[nat] || ORG0.GER;
  const u = mkUnit(S, {
    side, nat, hq: H0.k, t: p.t, n: p.n, num: p.num, men: Math.round(men * k), gun: Math.round(gun * k), tnk: Math.round(tnk * (side === 'SOV' ? 1 : 0.95)),
    menM: men, gunM: gun, tnkM: Math.max(tnk, T[2]), org: p.sov181 ? 35 : side === 'SOV' && p.t === 'arm' ? 45 : org, xp, ...o,
  });
  if (side === 'SOV' && p.t === 'arm') u.tnkM = tnk; // мехкорпуса 1941 г. не пополняются до штата
  if (p.t === 'gar') u.gar = 1;
  return u;
}
function borderDist(S) {
  const M = S.M, N = M.N, D = new Int16Array(N).fill(99);
  let q = [];
  for (let h = 0; h < N; h++) {
    if (M.terr[h] < 2) continue;
    const s = sideOfH(S, h);
    if (!s) continue;
    for (let d = 0; d < 6; d++) {
      const j = M.nb[h * 6 + d];
      if (j >= 0 && M.terr[j] >= 2 && sideOfH(S, j) && sideOfH(S, j) !== s) {
        D[h] = 1;
        q.push(h);
        break;
      }
    }
  }
  while (q.length) {
    const nq = [];
    for (const h of q)
      for (let d = 0; d < 6; d++) {
        const j = M.nb[h * 6 + d];
        if (j < 0 || D[j] !== 99 || M.terr[j] < 2 || sideOfH(S, j) !== sideOfH(S, h)) continue;
        D[j] = D[h] + 1;
        nq.push(j);
      }
    q = nq;
  }
  return D;
}
function mkHQ(S, H0) {
  const H = {
    k: H0.k, side: H0.side, nat: H0.nat, lv: H0.lv, up: H0.up || '', ech: H0.ech, n: H0.n, lab: H0.lab || null, num: H0.num ?? '', sub: H0.sub ?? '', gen: H0.gen,
    gt: H0.gt || [], rn: H0.rn || [], off: H0.off || [], mech: H0.mech || 0, arr: H0.arr || 0, order: 'auto', tgt: -1, als: [], dead: 0, anc: ANCH[H0.k] || null, born: 0,
  };
  S.hqs[H.k] = H;
  return H;
}
function buildOOB(S) {
  const bd = borderDist(S);
  for (const H0 of HQ0) {
    mkHQ(S, H0);
    if (!H0.u) continue;
    const us = H0.u.split(/\s+/).filter(Boolean).map((c) => unitFrom(S, c, H0));
    if (H0.arr) {
      const pt = H0.ax ? [(H0.ax[0][0] + H0.ax[1][0]) / 2, (H0.ax[0][1] + H0.ax[1][1]) / 2] : null;
      for (const u of us) (u.arr = H0.arr), (u.ax = pt), S.units.push(u);
      continue;
    }
    placeArmy(S, H0, us, bd);
  }
  for (const [k, codes, d, pt] of ECH2) {
    const H0 = HQ0.find((h) => h.k === k);
    for (const c of codes.split(' ')) {
      const u = unitFrom(S, c, H0);
      u.arr = d;
      u.ax = pt;
      S.units.push(u);
    }
  }
}
function placeArmy(S, H0, us, bd) {
  const M = S.M, side = H0.side;
  const [a, b] = H0.ax.map(([lon, lat]) => M.llXY(lon, lat));
  const [d0, d1] = H0.dp || [1, 3];
  us.sort((x, y) => isMech(x) - isMech(y));
  const n = us.length, nF = d0 <= 1 ? Math.max(1, Math.round(n * 0.6)) : n, nB = n - nF;
  us.forEach((u, i) => {
    const back = i >= nF, j = back ? i - nF : i;
    const want = back ? d0 + 1 + (j % Math.max(1, d1 - d0)) : d0 <= 1 ? d0 : d0 + Math.floor((j / Math.max(1, nF)) * (d1 - d0 + 1));
    const t = back ? (j + 0.5) / Math.max(1, nB) : (j + 0.5) / nF;
    const x = a[0] + (b[0] - a[0]) * t, y = a[1] + (b[1] - a[1]) * t;
    const h = bestSpot(S, side, x, y, want, bd);
    S.units.push(u);
    if (h >= 0) placeAt(S, u, h);
  });
}
function bestSpot(S, side, x, y, want, bd, lim = 2) {
  const M = S.M, H = M.J.R * 1.732;
  let h0 = M.hexAt(x, y);
  if (h0 < 0) h0 = M.hexAt(clamp(x, 1, M.J.cols * H - 1), clamp(y, 1, M.J.rows * M.J.R * 1.5 - 1));
  let best = -1, bs = 1e9;
  for (let r = 9; r <= 18 && best < 0; r += 9)
    for (const h of M.ring(h0, r)) {
      if (M.terr[h] < 2 || sideOfH(S, h) !== side || stackN(S, h) >= lim) continue;
      const [hx, hy] = M.xy(h);
      const s = Math.hypot(hx - x, hy - y) / H + Math.abs((bd ? bd[h] : 1) - want) * 1.6 + stackN(S, h) * 0.8;
      if (s < bs) (bs = s), (best = h);
    }
  return best;
}

// ——— снабжение морем, Ладога ———
const SEA = (S, c) => {
  if (c.n === 'Мурманск') return 'arc';
  if (c.n === 'Мемель') return 'bal';
  const r = S.M.reg[c.h];
  if (!r) return '';
  const sea = REGIONS[r - 1].sea;
  return sea.includes('bal') ? 'bal' : sea.includes('blk') ? 'blk' : sea.includes('arc') ? 'arc' : sea.includes('cas') ? 'cas' : '';
};
function seaSupply(S) {
  const M = S.M, P = { GER: [], SOV: [] }, Q = { GER: [], SOV: [] };
  for (const c of M.cities) {
    if (!c.port && c.n !== 'Мурманск') continue;
    const s = sideOfH(S, c.h);
    if (!s) continue;
    const sea = SEA(S, c);
    if (s === 'GER') {
      if (sea === 'bal') P.GER.push(c.h);
      else if (sea === 'blk' || sea === 'arc') Q.GER.push([c.h, 2, 1]);
    } else {
      if (sea === 'arc' && (c.n === 'Мурманск' || c.n === 'Архангельск')) P.SOV.push(c.h);
      else if (sea === 'blk') Q.SOV.push([c.h, 2, 2]);
      else if (sea === 'bal') Q.SOV.push([c.h, 1, 1]);
    }
  }
  const L = M.cityHex('Ленинград');
  if (sideOfH(S, L) === 'SOV' && !(S.net?.SOV?.[L] >= 0)) {
    const m = new Date(Date.UTC(1941, 5, 22) + S.day * 86400000).getUTCMonth();
    const winter = m === 11 || m <= 3;
    Q.SOV.push([L, 2, S.ev.fx.ladoga === 2 && winter ? 2 : 1]);
  }
  S.ports = P;
  S.partial = Q;
}
function railCaps(S) {
  const y = yearF(S.day);
  S.railCap = { GER: y < 1943 ? 5 : 4, SOV: y < 1942 ? 6 : y < 1943 ? 7 : y < 1944 ? 8 : 10 };
}

// ——— фазы ———
export function beginPhase(S, side) {
  S.phase = side;
  if (side === 'GER') seaSupply(S);
  const M = S.M, sup = supplyMap(S, side);
  if (side === 'GER') airBridge(S, sup);
  S.supL[side] = sup.L;
  (S.supC ||= {})[side] = sup.conn;
  S.net[side] = sup.net;
  for (const c of M.cities) {
    if (!c.fort || sideOfH(S, c.h) !== side) continue;
    if (sup.L[c.h] === 0) S.fst[c.k] = Math.max(0, (S.fst[c.k] ?? 0) - 1);
    else if (sup.L[c.h] === 2) S.fst[c.k] = Math.min(75, (S.fst[c.k] ?? 0) + 0.5);
  }
  const fr = winter41(S);
  for (const u of S.units) {
    if (u.side !== side || !alive(u)) continue;
    const L = sup.L[u.h] < 2 && fortStock(S, u) ? 2 : sup.L[u.h];
    if (L === 2) u.oos = 0;
    else if (L === 1) u.oos = u.oos > 1 ? u.oos - 1 : 1;
    else if (sup.conn[u.h]) u.oos = Math.min(u.oos + 1, 5); // оторвались от станций, но не окружены: подвоз гужом
    else u.oos++;
    const d = dailyMP(S, u);
    u.mp = Math.min(u.mp + d, d * 2);
    u.mv = 0;
    u.at = 0;
    u.pm = 0;
    u.ral = 0;
    if (u.oos >= 4) {
      attr(S, u, u.oos >= 10 ? 0.012 : 0.005);
      u.org = Math.max(0, u.org - (u.oos >= 10 ? 4 : 2));
      if (u.tnk) u.tnk -= Math.ceil(u.tnk * 0.02);
    }
    if (!alive(u)) continue;
    if (fr && u.nat === 'GER' && S.wx[M.zone[u.h]] === 'frost') (attr(S, u, 0.002), (u.org = Math.max(0, u.org - 1)));
    if (alive(u) && u.oos >= 14 && u.org < 20 && zoc(S, u.h, side) && rnd(S) < 0.08) destroy(S, u, other(side), 'сдалась в котле');
  }
}
function attr(S, u, f) {
  const m = Math.round(u.men * f);
  u.men -= m;
  S.loss[u.side] += m;
  S.dayLoss[u.side] += m;
  if (u.men < 600) destroy(S, u, null, 'погибла в окружении');
}
// воздушный мост: снабжение небольших котлов по воздуху
function airBridge(S, sup) {
  const a = S.air.GER, cap0 = (S.ev.fx.airlift ?? 6) * (a >= 0.4 ? 1 : a / 0.4);
  if (cap0 < 1) return;
  const ps = pockets(S, 'GER', sup).sort((x, y) => x.units - y.units);
  let cap = cap0 * (['snow', 'frost', 'mud'].includes(S.wx[1]) ? 0.6 : 1);
  for (const p of ps) {
    if (cap <= 0) break;
    const f = Math.min(1, cap / p.units);
    if (f >= 1 || rnd(S) < f) for (const h of p.hexes) sup.L[h] = 1;
    cap -= p.units;
    S.alift = (S.alift || 0) + 1;
  }
}
const ORGMAX = { SOV: [[1941.4, 72], [1942.0, 80], [1943.0, 90], [1944.0, 100]] };
function orgMax(S, u) {
  if (u.side === 'SOV') {
    const y = yearF(S.day), T = ORGMAX.SOV;
    let v = T[0][1];
    for (const [a, b] of T) if (y >= a) v = b;
    return Math.min(100, v + (u.gds ? 10 : 0));
  }
  // вермахт к зиме 1941/42 г. «выгорел»: потолок организованности ниже до весны
  const y = yearF(S.day), burn = u.nat === 'GER' && y >= 1941.8 && y < 1942.3 ? 80 : 100;
  return u.nat === 'GER' || u.nat === 'FIN' ? burn : 82;
}
export function endPhase(S, side) {
  const M = S.M, en = other(side), fd = S.frontDist?.[side];
  for (const u of S.units) {
    if (u.side !== side || !alive(u)) continue;
    if (!u.mv && !u.at) u.ent = Math.min(3, u.ent + (M.cityAt[u.h] >= 0 ? 0.5 : 0.34));
    if (!u.at) {
      const g = genOf(S, u), hard = g && g.tr.includes('hard') ? 1.3 : 1;
      const base = (u.oos <= 1 ? 5 : u.oos <= 4 ? 2 : 0) * (u.mv ? 1 : 1.4);
      const k = zoc(S, u.h, side) ? 0.75 : fd && fd[u.h] >= 4 ? 1.6 : 1.1;
      u.org = Math.min(orgMax(S, u), u.org + base * hard * k);
    }
  }
  S.today.atkN[side] = S.today.battles.filter((b) => b.sideA === side).length;
  sweep(S, side);
  const sup = supplyMap(S, en);
  S.supL[en] = sup.L;
  S.net[en] = sup.net;
  trackPockets(S, en, sup);
  cities(S);
  checkOver(S);
}
// тылы: пустые гексы противника за своей линией
function sweep(S, side) {
  const M = S.M, en = other(side);
  for (let pass = 0; pass < 2; pass++) {
    const cap = [];
    for (let h = 0; h < M.N; h++) {
      if (M.terr[h] < 2 || sideOfH(S, h) !== en || S.at.get(h)?.length) continue;
      let mine = 0, theirs = 0, myU = 0, enU = 0;
      for (let d = 0; d < 6; d++) {
        const j = M.nb[h * 6 + d];
        if (j < 0 || M.terr[j] < 2) continue;
        const s = sideOfH(S, j);
        if (s === side) mine++;
        else if (s === en) theirs++;
        const a = S.at.get(j);
        if (a?.length) a[0].side === side ? myU++ : enU++;
      }
      if (!enU && (mine >= 4 || (myU >= 2 && mine >= 3) || (!theirs && mine >= 1))) cap.push(h);
    }
    if (!cap.length) break;
    for (const h of cap) capture(S, h, side, side === 'SOV' ? 'SOV' : 'GER');
  }
  // «острова» земли противника без его войск, со всех сторон окружённые нашей землёй
  const seen = new Uint8Array(M.N);
  for (let h0 = 0; h0 < M.N; h0++) {
    if (seen[h0] || M.terr[h0] < 2 || sideOfH(S, h0) !== en) continue;
    const comp = [h0];
    seen[h0] = 1;
    let ok = true, mineB = 0;
    for (let i = 0; i < comp.length && comp.length <= 14; i++) {
      const h = comp[i];
      if (S.at.get(h)?.length) ok = false;
      for (let d = 0; d < 6; d++) {
        const j = M.nb[h * 6 + d];
        if (j < 0 || M.terr[j] < 2) continue;
        const s = sideOfH(S, j);
        if (s === en) {
          if (!seen[j]) (seen[j] = 1), comp.push(j);
        } else if (s === side) mineB++;
        else ok = false;
      }
    }
    if (ok && comp.length <= 14 && mineB > 0 && !comp.some((h) => { const c = M.cityAt[h] >= 0 ? M.cities[M.cityAt[h]] : null; return c && (c.sz >= 2 || c.fort || c.vp >= 3); }))
      for (const h of comp) capture(S, h, side, side === 'SOV' ? 'SOV' : 'GER');
  }
}
function trackPockets(S, side, sup) {
  const ps = pockets(S, side, sup).filter((p) => p.units >= 2), old = S.pk[side] || [], out = [];
  for (const p of ps) {
    const ids = [];
    let men = 0;
    for (const h of p.hexes) for (const u of unitsAt(S, h)) if (u.side === side) ids.push(u.id), (men += u.men);
    const o = old.find((q) => q.ids.some((id) => ids.includes(id)));
    const rec = { n: o ? o.n : pocketName(S, p), h: p.city ? p.city.h : p.h, units: p.units, ids, d0: o ? o.d0 : S.day, men, big: o ? o.big : p.units >= 3 };
    if (!o && p.units >= 3) {
      note(S, { k: 'pocket', side, t: `${rec.n}: окружены ${p.units} ${divW(p.units)} (${Math.round(men / 1000)} тыс.)`, h: rec.h, big: 1 });
      if (side === S.side) S.stop = 'pocket';
    } else if (o && !o.big && p.units >= 3) rec.big = true;
    out.push(rec);
  }
  for (const q of old) {
    if (out.some((r) => r.ids.some((id) => q.ids.includes(id)))) continue;
    const dead = q.ids.filter((id) => S.units.find((u) => u.id === id)?.dead).length;
    if (q.big && dead >= 2) {
      note(S, { k: 'pocket', side, t: `${q.n} ликвидирован: погибли или сдались ${dead} ${divW(dead)}`, h: q.h, big: 1 });
      addMor(S, side, -MOR.pk[side] * dead, 'pocket');
      addMor(S, other(side), MOR.pkWin[side] * dead, 'pocket');
    } else if (q.big) note(S, { k: 'pocket', side, t: `${q.n}: кольцо прорвано`, h: q.h });
  }
  S.pk[side] = out;
}
export const divW = (n) => (n % 10 === 1 && n % 100 !== 11 ? 'дивизия' : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? 'дивизии' : 'дивизий');
// взятые за день города: мораль, сообщения, статистика
function cities(S) {
  const M = S.M;
  for (const e of S.today.cities) {
    const c = M.cities[e.k], to = e.side, from = e.from;
    if (sideOfH(S, c.h) !== to) continue;
    const dv = cityMor(c), sp = MOR_CITY[c.n];
    addMor(S, to, dv * 0.6 + (sp ? sp[1] : 0), 'city');
    if (from) addMor(S, from, -dv - (sp ? sp[0] : 0), 'city');
    const own0 = M.nations[M.own0[c.h]];
    if (to === 'GER' && S.stat.fall[c.n] == null) S.stat.fall[c.n] = S.day;
    if (to === 'SOV' && S.stat.fall[c.n] != null && S.stat.lib[c.n] == null) S.stat.lib[c.n] = S.day;
    if (to === 'SOV' && own0 !== 'SOV' && S.stat.take[c.n] == null) S.stat.take[c.n] = S.day;
    if (c.sz >= 2 || c.vp >= 2) {
      const lib = to === 'SOV' && own0 === 'SOV';
      note(S, { k: 'city', side: to, c: c.k, h: c.h, t: lib ? `${c.n} освобождён` : to === 'SOV' ? `${c.n} взят Красной армией` : `${c.n} занят противником`, big: c.sz === 3 || c.vp >= 4 ? 1 : 0, lost: from });
      if (from === S.side && (c.sz === 3 || c.vp >= 4)) S.stop = 'city';
    }
  }
  S.today.cities = [];
}
function checkOver(S) {
  if (S.over) return;
  const b = S.M.cityHex('Берлин');
  const sov = (why) => (S.over = { win: 'SOV', why, d: S.day, stars: S.day <= dayOf('1945-05-02') ? 3 : S.day <= dayOf('1945-05-20') ? 2 : 1 });
  if (sideOfH(S, b) === 'SOV') sov('Красная армия взяла Берлин');
  else if (S.morale.SOV <= 0) S.over = { win: 'GER', why: 'Советский Союз запросил мира', d: S.day, stars: 3 };
  else if (S.day >= dayOf('1945-05-31')) S.over = { win: 'GER', why: 'Берлин устоял до 31 мая 1945 г.', d: S.day, stars: 1 };
  if (S.over) note(S, { k: 'over', side: S.over.win, t: S.over.why, big: 1 });
}

// ——— конец суток ———
export function endDay(S) {
  const y = yearF(S.day);
  ecoDay(S, (o) => note(S, o));
  repairRail(S, 'GER', y < 1942 ? 4.5 : y < 1943 ? 5 : 4);
  repairRail(S, 'SOV', y < 1943 ? 5 : y < 1944 ? 7 : 9);
  S.frontDist = { GER: frontDistance(S, 'GER'), SOV: frontDistance(S, 'SOV') };
  for (const sd of SIDES) addMor(S, sd, -S.dayLoss[sd] / MOR.loss(sd, y), 'loss'), addMor(S, sd, drift(S, sd), 'drift');
  hqTick(S);
  arrivals(S);
  militia(S);
  armyDeaths(S);
  if (S.day % 7 === 6 || S.regroupSoon) regroup(S), (S.regroupSoon = 0);
  dedupeGens(S);
  S.day++;
  if (S.day % 7 === 0 && S.mst) S.mst.wk = { GER: {}, SOV: {} };
  S.today = newToday();
  S.dayLoss = { GER: 0, SOV: 0 };
  S.wx = [0, 1, 2].map((z) => weather(S, z));
  S.ev.tfx = S.ev.tfx.filter(([d, k]) => (S.day >= d ? (delete S.ev.fx[k], false) : true));
  railCaps(S);
  special(S);
  dayEvents(S);
  checkOver(S);
}
function drift(S, side) {
  const y = yearF(S.day);
  const m = S.morale[side];
  // «Отечественная война»: чем тяжелее положение, тем упорнее сопротивление
  if (side === 'SOV') return (y < 1943 ? 0.05 : 0.03) + Math.max(0, 45 - m) * 0.005;
  return (y < 1942.9 ? 0 : y < 1944 ? -0.012 : -0.02) + Math.max(0, 25 - m) * 0.002;
}
// особые эффекты решений по датам
function special(S) {
  const fx = S.ev.fx, M = S.M;
  if (fx.kursk && S.day === dayOf('1943-07-01')) {
    const k = M.cityHex('Курск');
    for (const u of S.units) if (u.side === 'SOV' && alive(u) && M.dist(u.h, k) <= 7) u.ent = 3;
    fx.SOVdef = 1.12;
    S.ev.tfx.push([S.day + 20, 'SOVdef']);
  }
  if (fx.mask && S.day === dayOf('1944-06-01')) {
    const ags = Object.values(S.hqs).filter((A) => A.side === 'GER' && A.lv === 2 && !A.dead && ['ags', 'aga'].includes(A.up));
    let n = 0;
    for (const u of S.units) {
      if (n >= 3 || u.side !== 'GER' || !alive(u) || !isMech(u) || S.hqs[u.hq]?.up !== 'agc' || !ags.length) continue;
      u.hq = ags[n % ags.length].k;
      n++;
    }
  }
  if (fx.warsaw === S.day - 24) {
    const w = M.cityHex('Варшава');
    for (const u of S.units) if (u.side === 'GER' && alive(u) && M.dist(u.h, w) <= 1) u.org = Math.min(u.org, 40);
  }
}

// ——— штабы: командующие, переименования, новые фронты и армии ———
export function setGen(S, H, g) {
  if (!S.G[g]) return;
  H.gen = g;
}
function dedupeGens(S) {
  const by = new Map();
  for (const H of Object.values(S.hqs)) {
    if (H.dead || H.arr) continue;
    const o = by.get(H.gen);
    if (!o) {
      by.set(H.gen, H);
      continue;
    }
    // генерал командует старшим штабом; младший получает замену
    const lo = o.lv <= H.lv ? H : o;
    if (lo === o) by.set(H.gen, H);
    lo.gen = spareGen(S, lo);
  }
}
function spareGen(S, H) {
  const used = new Set(Object.values(S.hqs).filter((x) => !x.dead).map((x) => x.gen));
  const fut = new Set();
  for (const x of Object.values(S.hqs)) if (!x.dead) for (const [d, g] of x.gt || []) if (dayOf(d) > S.day) fut.add(g);
  const ok = (k) => !used.has(k) && !fut.has(k) && genSide(k) === H.side && (H.side === 'SOV' || ['GER'].includes(S.G[k].nat) || S.G[k].nat === H.nat);
  for (const k in S.G) if (S.G[k].x && ok(k)) return k;
  for (const k in S.G) if (ok(k)) return k;
  return H.gen;
}
function anchorHex(S, G) {
  if (G.anc) {
    let c = G.anc[0][1];
    for (const [d, n] of G.anc) if (dayOf(d) <= S.day) c = n;
    const h = S.M.cityHex(c);
    if (h >= 0) return h;
  }
  const ms = Object.values(S.hqs).filter((A) => A.up === G.k && !A.dead && A.lv >= 2);
  const hs = ms.map((A) => hqHex(S, A)).filter((h) => h >= 0);
  return hs.length ? hs[0] : -1;
}
function hqTick(S) {
  const d = S.day + 1;
  for (const H of Object.values(S.hqs)) {
    for (const [a, g] of H.gt) if (dayOf(a) === d && S.G[g]) {
      H.gen = g;
      if (H.lv <= 1 && !H.dead) note(S, { k: 'hq', side: H.side, t: `${H.n}: командующий — ${S.G[g].n}` });
    }
    for (const r of H.rn) if (dayOf(r[0]) === d) {
      const old = H.n;
      H.n = r[1];
      if (r[2]) H.lab = r[2];
      if (H.lv <= 1) r[3] && H.als.push(r[3]);
      else {
        if (r[3] != null) H.num = r[3];
        if (r[4] != null) H.sub = r[4];
      }
      if (!H.dead) note(S, { k: 'hq', side: H.side, t: `${old} переименован: ${H.n}`, big: H.lv <= 1 ? 1 : 0 });
    }
    for (const [a, z] of H.off || []) {
      if (dayOf(a) === d) (H.dead = d), (H.offNow = 1), (S.regroupSoon = 1);
      if (dayOf(z) === d) {
        H.dead = 0;
        H.offNow = 0;
        S.regroupSoon = 1;
        note(S, { k: 'hq', side: H.side, t: `Вновь образован ${H.n}`, big: 1 });
      }
    }
  }
  for (const f of FRONTS) {
    const [k, side, a, z, n, lab, anc, gens, rn] = f;
    if (dayOf(a) === d && !S.hqs[k]) {
      const H = mkHQ(S, { k, side, nat: side, lv: 1, up: side === 'SOV' ? 'stavka' : 'okh', ech: 'XXXXX', n, lab, gen: gens[0][1], gt: gens.slice(1), rn: rn || [] });
      H.anc = anc;
      H.born = d;
      S.regroupSoon = 1;
      note(S, { k: 'hq', side, t: `Образован ${n} (командующий — ${S.G[H.gen]?.n || ''})`, big: 1 });
    }
    if (dayOf(z) === d && S.hqs[k] && !S.hqs[k].dead) {
      S.hqs[k].dead = d;
      S.regroupSoon = 1;
      note(S, { k: 'hq', side, t: `${S.hqs[k].n} расформирован` });
    }
  }
  for (const a of AXIS_LATER) if (dayOf(a[2]) === d && !S.hqs[a[0]]) axisArmy(S, a);
}
function axisArmy(S, [k, grp, , n, num, sub, gen, nat, city, codes, rn, gt]) {
  const H = mkHQ(S, { k, side: 'GER', nat, lv: 2, up: S.hqs[grp] && !S.hqs[grp].dead ? grp : 'okh', ech: 'XXXX', n, num, sub, gen, rn: rn || [], gt: gt || [] });
  H.born = S.day + 1;
  H.fresh = 1;
  const pt = S.M.cityHex(city);
  for (const c of (codes || '').split(' ').filter(Boolean)) {
    const u = unitFrom(S, c, { k, nat });
    u.org = 85;
    u.arr = S.day + 1;
    u.axh = pt;
    S.units.push(u);
  }
  S.regroupSoon = 1;
  note(S, { k: 'army', side: 'GER', t: `На фронт прибывает ${n}`, h: pt, big: 1 });
}
// ополчение и гарнизоны больших городов: когда противник в 2 гексах — новые части в городе
// [сторона, число частей, людей, орудий, название]
const MIL = {
  Ленинград: ['SOV', 10, 8000, 70, 'дивизия народного ополчения'], Москва: ['SOV', 10, 8000, 70, 'дивизия народного ополчения'],
  Киев: ['SOV', 3, 7000, 50, 'дивизия народного ополчения'], Одесса: ['SOV', 3, 6000, 40, 'бригада морской пехоты'], Севастополь: ['SOV', 3, 6000, 50, 'бригада морской пехоты'],
  Сталинград: ['SOV', 4, 7000, 60, 'дивизия НКВД'], Тула: ['SOV', 3, 6000, 50, 'рабочий полк'], Харьков: ['SOV', 2, 6000, 40, 'дивизия народного ополчения'],
  'Ростов-на-Дону': ['SOV', 2, 6000, 40, 'дивизия народного ополчения'], Мурманск: ['SOV', 2, 5000, 40, 'бригада морской пехоты'], Новороссийск: ['SOV', 1, 5000, 40, 'бригада морской пехоты'],
  Воронеж: ['SOV', 1, 6000, 40, 'дивизия НКВД'], Грозный: ['SOV', 1, 6000, 40, 'дивизия НКВД'], Баку: ['SOV', 2, 7000, 50, 'дивизия НКВД'],
  Кёнигсберг: ['GER', 3, 9000, 80, 'фольксштурм'], Бреслау: ['GER', 3, 9000, 80, 'фольксштурм'], Познань: ['GER', 2, 8000, 70, 'фольксштурм'],
  Будапешт: ['GER', 2, 9000, 80, 'фольксштурм'], Вена: ['GER', 2, 8000, 70, 'фольксштурм'], Берлин: ['GER', 8, 9000, 90, 'фольксштурм'], Кюстрин: ['GER', 1, 7000, 60, 'фольксштурм'],
};
function militia(S) {
  const M = S.M;
  S.mil = S.mil || {};
  for (const n in MIL) {
    const [side, max, men, gun, nm] = MIL[n], c = M.city(n);
    if (!c || sideOfH(S, c.h) !== side || (S.mil[n] || 0) >= max) continue;
    if (side === 'GER' && S.day < dayOf('1944-07-01')) continue;
    const here = unitsAt(S, c.h).filter((u) => u.side === side).length;
    if (here >= 3) continue;
    let near = false;
    for (const h of M.ring(c.h, 2)) if (enemyAt(S, h, side)) { near = true; break; }
    if (!near) continue;
    const k = (S.mil[n] = (S.mil[n] || 0) + 1);
    const u = mkUnit(S, { side, nat: side, t: 'gar', n: `${k}-я ${nm} (${n})`.replace('-я рабочий полк', '-й рабочий полк').replace('-я фольксштурм', '-й батальон фольксштурма'), men, gun, tnk: 0, org: 55, xp: 0 });
    u.gar = 1;
    const A = Object.values(S.hqs).filter((H) => H.side === side && H.lv === 2 && !H.dead && !H.arr).sort((a, b) => M.dist(hqHex(S, a), c.h) - M.dist(hqHex(S, b), c.h))[0];
    u.hq = A ? A.k : '';
    S.units.push(u);
    placeAt(S, u, c.h);
    note(S, { k: 'form', side, t: `${n}: ${u.n} заняла оборону`, h: c.h });
  }
}
// прибытие эшелонов
function arrivals(S) {
  const M = S.M, d = S.day + 1;
  for (const H of Object.values(S.hqs)) if (H.arr && H.arr <= d) H.arr = 0;
  for (const u of S.units) {
    if (!u.arr || u.arr > d || u.dead || u.h >= 0) continue;
    const pt = u.axh ?? (u.ax ? M.hexLL(u.ax[0], u.ax[1]) : -1);
    let base = pt;
    const A = S.hqs[u.hq];
    if (!A || A.dead) {
      const B = assignArmy(S, u);
      if (B) u.hq = B.k;
    }
    if (base < 0 || sideOfH(S, base) !== u.side) base = A && !A.dead ? hqHex(S, A) : base;
    const h = rearSpot(S, u.side, base, 2, 8);
    if (h < 0) continue;
    u.arr = 0;
    placeAt(S, u, h);
    u.ral = 1;
  }
}
// армия без дивизий — расформирована (или разгромлена)
function armyDeaths(S) {
  const cnt = new Map();
  for (const u of S.units) if (!u.dead && (u.h >= 0 || u.arr)) cnt.set(u.hq, (cnt.get(u.hq) || 0) + 1);
  for (const H of Object.values(S.hqs)) {
    if (H.lv < 2 || H.dead || H.arr || H.fresh) continue;
    if (cnt.get(H.k)) {
      H.empty = 0;
      continue;
    }
    H.empty = (H.empty || 0) + 1;
    if (H.empty >= 3) {
      H.dead = S.day;
      note(S, { k: 'army', side: H.side, t: `${H.n} разгромлена`, big: 1 });
      addMor(S, H.side, -MOR.army[H.side], 'army');
      for (const x of Object.values(S.hqs)) if (x.up === H.k && !x.dead) x.up = H.up;
    }
  }
}
// приписка армий к ближайшим фронтам и группам армий
export function regroup(S) {
  for (const side of SIDES) {
    const gs = Object.values(S.hqs).filter((G) => G.side === side && G.lv === 1 && !G.dead).map((G) => [G, anchorHex(S, G)]).filter((x) => x[1] >= 0);
    for (const A of Object.values(S.hqs)) {
      if (A.side !== side || A.lv < 2 || A.dead || A.arr) continue;
      const up = S.hqs[A.up];
      if (A.lv === 3 && up && up.lv === 2 && !up.dead) continue;
      if (A.nat === 'FIN' || A.k === 'norw') {
        if (S.hqs.fin && !S.hqs.fin.dead) A.up = 'fin';
        continue;
      }
      const c = hqHex(S, A);
      if (c < 0) continue;
      let best = null, bd = 1e9, cur = 1e9;
      for (const [G, gh] of gs) {
        if (G.k === 'fin') continue;
        const dd = S.M.dist(c, gh);
        if (dd < bd) (bd = dd), (best = G);
        if (G.k === A.up) cur = dd;
      }
      if (!best) continue;
      if (!up || up.dead || up.lv === 0) {
        if (up && up.lv === 0 && (S.frontDist[side]?.[c] ?? 0) > 8) continue;
        A.up = best.k;
      } else if (best.k !== A.up && bd < cur * 0.7 - 1) A.up = best.k;
    }
  }
}

// ——— решения ———
function dayEvents(S) {
  for (const e of dueEvents(S)) {
    if (e.side === S.side) {
      S.ev.pending.push(e.k);
      S.stop = 'decision';
    } else applyEvent(S, e.k, e.ai);
  }
}
export function applyEvent(S, k, i) {
  const e = evByK(k);
  if (!e || S.ev.done[k] != null) return;
  S.ev.done[k] = i;
  S.ev.pending = S.ev.pending.filter((x) => x !== k);
  e.o[i].f(evX(S));
  note(S, { k: 'ev', side: e.side, t: `${e.n}: ${e.o[i].n}`, big: 1, ev: k });
}
const SSN = ['СС «Гогенштауфен»', 'СС «Гитлерюгенд»', 'СС «Фрундсберг»', 'СС «Нордланд»'];
function evX(S) {
  const X = {
    S,
    xop: (side, a, b, n, who, k, obj) => S.xops.push({ side, a: dayOf(a), b: dayOf(b), n, who: who.split(' '), k, obj: obj ? obj.split('|') : [], x: 1 }),
    noop: (n) => S.noop.push(n),
    fx: (k, v, days) => {
      S.ev.fx[k] = v;
      if (days) S.ev.tfx.push([S.day + days, k]);
    },
    morale: (side, d) => addMor(S, side, d, 'event'),
    ural: (ic, days, n) => (S.eco.SOV.evq.push([S.day + days, ic, n]), S.eco.SOV.evq.sort((a, b) => a[0] - b[0])),
    spawnN: (side, n, city, kind, o, arrIn) => {
      for (let i = 0; i < n; i++) {
        S.dno = (S.dno || 0) + 1;
        X.spawn(side, { t: 'inf', n: `${S.dno}-я дно`, num: String(S.dno), ...o }, city, arrIn + i);
      }
    },
    spawnL: (side, nums, city, o, arrIn, spread) => {
      nums.forEach((num, i) => {
        const E = S.eco[side];
        let n, nn = num;
        if (side === 'SOV') {
          if (o.tk) (nn = E.num.arm++), (n = `${nn}-й тк`);
          else {
            if (!nn) nn = E.num.inf++;
            n = `${nn}-я сд`;
          }
        } else (n = SSN[(S.ssn = (S.ssn || 0) + 1) % SSN.length]), (nn = 'СС');
        X.spawn(side, { t: 'inf', ...o, n, num: String(nn) }, city, arrIn + i * spread);
      });
    },
    spawn: (side, o, city, arrIn) => {
      const u = mkUnit(S, { side, nat: side, men: 9000, gun: 80, tnk: 0, ...o });
      u.arr = S.day + 1 + (arrIn || 0);
      u.axh = S.M.cityHex(city);
      const A = assignArmy(S, u);
      u.hq = A ? A.k : '';
      S.units.push(u);
      return u;
    },
    garrisons: (side, list) => {
      for (const c of list) {
        const h = S.M.cityHex(c);
        if (h < 0 || sideOfH(S, h) !== side) continue;
        const u = mkUnit(S, { side, nat: 'GER', t: 'gar', n: `Фольксштурм «${c}»`, num: 'ФШ', men: 6000, gun: 30, tnk: 0, org: 60, xp: 0 });
        u.gar = 1;
        const A = assignArmy(S, u);
        u.hq = A ? A.k : '';
        S.units.push(u);
        const spot = stackN(S, h) < stackCap(S, h) ? h : S.M.ring(h, 1).find((j) => S.M.terr[j] >= 2 && sideOfH(S, j) === side && stackN(S, j) < stackCap(S, j));
        if (spot != null && spot >= 0) placeAt(S, u, spot);
        else u.dead = S.day;
      }
    },
    flip: (nat, to, keep) => {
      const ni = natIdx(S, nat), M = S.M, si = natIdx(S, 'SOV');
      if (ni < 0) return;
      S.nside[ni] = to;
      if (nat === 'FIN') for (let h = 0; h < M.N; h++) if (S.own[h] === ni && M.nations[M.own0[h]] === 'SOV') S.own[h] = si;
      for (const u of S.units) {
        if (u.nat !== nat || u.dead) continue;
        if (keep && to) {
          u.side = to;
          u.org = Math.min(u.org, 50);
          const A = assignArmy(S, u);
          u.hq = A ? A.k : '';
        } else X.kill(u, nat === 'FIN' ? 'вышла из войны' : 'распущена');
      }
      for (const H of Object.values(S.hqs)) if (H.nat === nat && H.side === 'GER' && !H.dead) H.dead = S.day;
      // войска, оказавшиеся на нейтральной земле, — на ближайший свой гекс
      for (const u of S.units) {
        if (!alive(u) || sideOfH(S, u.h) === u.side || passable(S, u.h)) continue;
        const j = M.nearLand(u.h, (k) => sideOfH(S, k) === u.side && stackN(S, k) < stackCap(S, k));
        if (j >= 0) placeAt(S, u, j);
        else X.kill(u, 'интернирована');
      }
      S.ver++;
      reindex(S);
      S.regroupSoon = 1;
    },
    kill: (u, why) => {
      u.dead = S.day;
      u.why = why;
      if (u.h >= 0) placeAt(S, u, -1);
    },
    drop: (f, why) => {
      for (const u of S.units) if (!u.dead && f(u)) X.kill(u, why);
    },
    dropMech: (side, n) => {
      const us = S.units.filter((u) => u.side === side && alive(u) && isMech(u) && u.nat === 'GER' && !u.oos).sort((a, b) => b.tnk - a.tnk);
      for (const u of us.slice(0, n)) X.kill(u, 'переброшена на Запад');
    },
    note: (t) => note(S, { k: 'ev', t }),
  };
  return X;
}

// ——— ход ———
// игрок завершил свою фазу: ИИ доигрывает армии «Авто» игрока, затем фазы до следующего хода игрока
export function endTurn(S) {
  if (S.over) return;
  S.stop = null;
  S.undo = [];
  let side = S.phase;
  for (const k of [...S.ev.pending]) applyEvent(S, k, evByK(k).ai);
  runAI(S, side, { skip: (u) => u.pm, skipArmy: (A) => A.order === 'man' });
  endPhase(S, side);
  for (let guard = 0; guard < 4 && !S.over; guard++) {
    if (side === 'SOV') endDay(S);
    if (S.over) return;
    side = other(side);
    beginPhase(S, side);
    if (side === S.side) return;
    runAI(S, side);
    endPhase(S, side);
  }
}
// сутки «ИИ против ИИ»
export function simDay(S) {
  beginPhase(S, 'GER');
  runAI(S, 'GER');
  endPhase(S, 'GER');
  beginPhase(S, 'SOV');
  runAI(S, 'SOV');
  endPhase(S, 'SOV');
  endDay(S);
}

// ——— действия игрока ———
export function moveTo(S, u, h) {
  const R = reach(S, u);
  if (!R.has(h) || h === u.h || stackN(S, h) >= stackCap(S, h)) return false;
  const path = pathTo(R, h), M = S.M;
  S.undo.push({ id: u.id, h: u.h, mp: u.mp, mv: u.mv, ent: u.ent, fu: u.fuelUse || 0, own: path.map((x) => [x, S.own[x], S.rok[x]]), cities: S.today.cities.length });
  doMove(S, u, path);
  u.pm = 1;
  return true;
}
export function undoMove(S) {
  const r = S.undo.pop();
  if (!r) return false;
  const u = S.units.find((x) => x.id === r.id);
  for (const [x, o, k] of r.own) (S.own[x] = o), (S.rok[x] = k);
  S.today.cities.length = r.cities;
  placeAt(S, u, r.h);
  Object.assign(u, { mp: r.mp, mv: r.mv, ent: r.ent, fuelUse: r.fu, pm: 0 });
  S.ver++;
  return true;
}
export function attack(S, att, tgt) {
  const r = doAttack(S, att, tgt);
  for (const a of att) a.pm = 1;
  S.undo = [];
  return r;
}
// переброска по ж/д: со станции сети на станцию сети, не в зоне контроля противника
export function railTargets(S, u) {
  const side = u.side, net = S.net[side], out = [];
  if (!net || u.mv || u.at || u.ral || !railOK(S, u.h, side) || net[u.h] < 0 || zoc(S, u.h, side) || (S.railCap[side] || 0) <= 0) return out;
  for (let h = 0; h < S.M.N; h++) if (h !== u.h && net[h] >= 0 && railOK(S, h, side) && !zoc(S, h, side) && stackN(S, h) < stackCap(S, h)) out.push(h);
  return out;
}
export function railTo(S, u, h) {
  if (!railTargets(S, u).includes(h)) return false;
  railMove(S, u, h);
  S.railCap[u.side]--;
  u.pm = 1;
  S.undo = [];
  return true;
}
export function freeGarrison(S, u) {
  if (!u.gar) return false;
  u.gar = 0;
  return true;
}
export function setOrder(S, A, order, tgt = -1) {
  A.order = order;
  A.tgt = tgt;
}

// ——— сохранение ———
const TA = ['own', 'rok'];
const b64 = (a) => {
  let s = '';
  for (let i = 0; i < a.length; i += 8192) s += String.fromCharCode.apply(null, a.subarray(i, i + 8192));
  return typeof btoa === 'function' ? btoa(s) : Buffer.from(s, 'binary').toString('base64');
};
const unb64 = (s) => {
  const t = typeof atob === 'function' ? atob(s) : Buffer.from(s, 'base64').toString('binary');
  const a = new Uint8Array(t.length);
  for (let i = 0; i < t.length; i++) a[i] = t.charCodeAt(i);
  return a;
};
export function serialize(S) {
  const o = {};
  for (const k in S) {
    if (['M', 'G', 'at', '_fc', 'supL', 'supC', 'net', 'frontDist', 'undo', 'src', 'alift'].includes(k)) continue;
    o[k] = TA.includes(k) ? b64(S[k]) : S[k];
  }
  o.src = { GER: b64(S.src.GER), SOV: b64(S.src.SOV) };
  return JSON.stringify(o);
}
export function deserialize(M, str) {
  const o = JSON.parse(str);
  if (o.v !== VER) return null;
  const S = { ...o, M, G: ALLG, undo: [], supL: {}, net: {} };
  for (const k of TA) S[k] = unb64(o[k]);
  S.src = { GER: unb64(o.src.GER), SOV: unb64(o.src.SOV) };
  reindex(S);
  S.frontDist = { GER: frontDistance(S, 'GER'), SOV: frontDistance(S, 'SOV') };
  for (const sd of SIDES) {
    const sp = supplyMap(S, sd);
    S.supL[sd] = sp.L;
    (S.supC ||= {})[sd] = sp.conn;
    S.net[sd] = sp.net;
  }
  return S;
}
export { forecast, attackers, canAttack, reach, pathTo, posture, strength };
