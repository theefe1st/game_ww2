// «Европа 1939–1945»: правила стратегического режима — чистая логика без DOM (игра и симулятор).
import { NATIONS } from './regions.js';

export let G = null;
export function useGraph(g) {
  G = g;
  for (const r of G.R) {
    const d = new Map([[r.i, 0]]);
    let q = [r.i];
    for (let k = 1; k <= 3; k++) {
      const nq = [];
      for (const a of q) {
        const A = G.R[a - 1];
        for (const b of A.nb) !d.has(b) && (d.set(b, k), nq.push(b));
        for (const [b] of A.sea2) !d.has(b) && (d.set(b, k), nq.push(b));
      }
      q = nq;
    }
    r.near = d;
    r.zone = r.t === `de` || r.lat < 33 ? `d` : r.lat >= 60 ? `n` : r.lat < 43.5 ? `s` : r.lon >= 24 && r.lat >= 45 ? `e` : r.lon < 2 ? `w` : `c`;
  }
}
export const reg = (i) => G.R[i - 1];

// ——— случайные числа (сохраняются в состоянии) ———
export function rnd(S) {
  let t = (S.rs = (S.rs + 0x6d2b79f5) >>> 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

// ——— даты: ход = полмесяца, ход 0 = 1–15 сентября 1939 ———
export const MONTHS = [`января`, `февраля`, `марта`, `апреля`, `мая`, `июня`, `июля`, `августа`, `сентября`, `октября`, `ноября`, `декабря`];
export const MONTHS_N = [`январь`, `февраль`, `март`, `апрель`, `май`, `июнь`, `июль`, `август`, `сентябрь`, `октябрь`, `ноябрь`, `декабрь`];
export const tDate = (t) => {
  const m = 8 + (t >> 1);
  return { y: 1939 + Math.floor(m / 12), m: m % 12, h: t & 1 };
};
export const turnOf = (y, m, d = 1) => ((y - 1939) * 12 + (m - 1) - 8) * 2 + (d >= 16 ? 1 : 0);
export function dateLabel(t) {
  const { y, m, h } = tDate(t), last = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m] + (m === 1 && y % 4 === 0 ? 1 : 0);
  return h ? `16–${last} ${MONTHS[m]} ${y}` : `1–15 ${MONTHS[m]} ${y}`;
}
export const shortDate = (t) => {
  const { y, m, h } = tDate(t);
  return `${h ? 16 : 1} ${MONTHS[m]} ${y}`;
};
export const T_END = turnOf(1945, 12, 16);

// ——— войска ———
export const UT = {
  inf: { n: `Пехотная армия`, sh: `пехота`, atk: 1.0, def: 1.3, mv: 1, max: 12, oil: 0, s0: 6, time: 2, cost: { pp: 26, mp: 10, st: 2, oil: 0 }, re: { pp: 3, mp: 1.6, st: 0.3, oil: 0 } },
  mot: { n: `Моторизованный корпус`, sh: `мотопехота`, atk: 1.35, def: 1.15, mv: 2, max: 6, oil: 0.08, s0: 4, time: 3, cost: { pp: 34, mp: 6, st: 6, oil: 3 }, re: { pp: 6, mp: 1, st: 1, oil: 0.5 } },
  arm: { n: `Танковая армия`, sh: `танки`, atk: 2.4, def: 1.6, mv: 2, max: 8, oil: 0.15, s0: 4, time: 3, cost: { pp: 50, mp: 6, st: 12, oil: 5 }, re: { pp: 8, mp: 1, st: 2, oil: 0.6 } },
  air: { n: `Воздушный флот`, sh: `авиация`, atk: 0.9, def: 0.6, mv: 4, max: 10, oil: 0.14, s0: 4, time: 3, cost: { pp: 44, mp: 2, st: 8, oil: 4 }, re: { pp: 7, mp: 0.3, st: 1.5, oil: 0.5 } },
};
export const LAND = (u) => u.t !== `air`;
export const MOBILE = (u) => u.t === `arm` || u.t === `mot`;
export const STACK = 8;
// качество войск по годам 1939…1945 (выучка, доктрина, командование)
const QUAL = {
  GER: [1.32, 1.3, 1.22, 1.15, 1.08, 1.0, 0.94], SOV: [0.78, 0.76, 0.76, 0.88, 1.0, 1.1, 1.14], UK: [0.95, 0.95, 1.0, 1.05, 1.1, 1.1, 1.1],
  USA: [1, 1, 1, 0.96, 1.05, 1.1, 1.14], FRA: [0.92, 0.86, 0.85, 0.85, 0.9, 0.95, 0.95], POL: [0.78], ITA: [0.72, 0.7, 0.7, 0.74, 0.74, 0.74, 0.74],
  FIN: [1.15, 1.15, 1.1, 1.08, 1.05, 1.0, 1.0], ROM: [0.66, 0.66, 0.7, 0.7, 0.7, 0.75, 0.75], HUN: [0.7, 0.7, 0.7, 0.7, 0.72, 0.75, 0.75],
  BUL: [0.7], SVK: [0.66], YUG: [0.62], GRE: [0.86], NOR: [0.74], BEL: [0.76], NED: [0.66], DEN: [0.5], TUR: [0.7], ESP: [0.7],
  POR: [0.6], SWE: [0.82], SUI: [0.92], IRN: [0.5], VIC: [0.75], LIT: [0.6], LAT: [0.6], EST: [0.62], IRL: [0.6], _: [0.7],
};
export function quality(S, n) {
  const q = QUAL[n] || QUAL._, y = tDate(S.t).y - 1939;
  let v = q[Math.min(q.length - 1, Math.max(0, y))];
  const d = S.diff ?? 1;
  if (n === S.player) v *= [1.12, 1, 0.92][d];
  else if (S.player && atWar(S, n, S.player)) v *= [0.94, 1, 1.05][d];
  return v * (S.nat[n]?.qmul || 1);
}
// ——— державы, войны, союзы ———
export const pairKey = (a, b) => (a < b ? `${a}|${b}` : `${b}|${a}`);
export const side = (S, n) => S.nat[n]?.side || null;
export const blocOf = (S, n) => side(S, n) || n;
export const alive = (S, n) => !!S.nat[n] && !S.nat[n].dead;
export function ally(S, a, b) {
  if (a === b) return true;
  const sa = side(S, a);
  return !!sa && sa === side(S, b);
}
// «попутчики» (СССР и западные союзники): не воюют друг с другом, но армии и снабжение раздельны
export const coop = (S, a, b) => S.coop.includes(pairKey(a, b));
export const atWar = (S, a, b) => a !== b && S.wars.includes(pairKey(a, b));
export const members = (S, s) => Object.keys(S.nat).filter((n) => alive(S, n) && side(S, n) === s);
export function addWar(S, a, b) {
  const k = pairKey(a, b);
  if (a === b || S.wars.includes(k) || ally(S, a, b) || (S.noWar || []).includes(k) || S.coop.includes(k)) return false;
  S.wars.push(k);
  return true;
}
// Объявление войны: вся группировка a против всей группировки b (нейтралы — только сами)
export function declareWar(S, a, b) {
  const A = side(S, a) ? members(S, side(S, a)) : [a], B = side(S, b) ? members(S, side(S, b)) : [b];
  for (const x of A) for (const y of B) addWar(S, x, y);
  addWar(S, a, b);
  S._ver++;
}
export function makePeace(S, a, b) {
  S.wars = S.wars.filter((k) => k !== pairKey(a, b));
  S._ver++;
}
// Вступление в блок: наследует войны лидера блока
export function joinSide(S, n, s) {
  const lead = { axis: `GER`, allies: `UK`, comintern: `SOV` }[s];
  S.nat[n].side = s;
  S.wars = S.wars.filter((k) => {
    const [a, b] = k.split(`|`), o = a === n ? b : b === n ? a : null;
    return !o || !ally(S, n, o);
  });
  for (const k of [...S.wars]) {
    const [a, b] = k.split(`|`);
    a === lead && addWar(S, n, b), b === lead && addWar(S, n, a);
  }
  S._ver++;
}
export const ctrlOf = (S, i) => S.ctrl[i];
// ——— индекс войск по регионам ———
export function ix(S) {
  if (S._ix && S._ixv === S._uv) return S._ix;
  const a = Array.from({ length: G.R.length + 1 }, () => []);
  for (const u of S.units) a[u.r].push(u);
  S._ix = a, (S._ixv = S._uv);
  return a;
}
export const touch = (S) => (S._uv = (S._uv || 0) + 1);
export const unitsIn = (S, i) => ix(S)[i];
export const landIn = (S, i) => ix(S)[i].filter(LAND);
export const strOf = (us) => us.reduce((s, u) => s + u.s, 0);
export function spawn(S, n, t, r, s, o = {}) {
  const U = UT[t], nat = S.nat[n];
  nat.cnt = nat.cnt || {};
  nat.cnt[t] = (nat.cnt[t] || 0) + 1;
  const u = { id: ++S.nid, n, t, s: Math.min(U.max, s ?? U.s0), o: o.o ?? 70, x: o.x ?? 0, r, mv: 0, ap: 0, at: 0, ent: 0, nm: o.nm || unitName(n, t, nat.cnt[t]) };
  S.units.push(u);
  touch(S);
  return u;
}
export function kill(S, u) {
  const k = S.units.indexOf(u);
  k >= 0 && S.units.splice(k, 1);
  touch(S);
}
const ORD = (k) => `${k}-я`;
export function unitName(n, t, k) {
  const adj = { GER: [`армия`, `танковая группа`, `моторизованный корпус`, `воздушный флот`], SOV: [`армия`, `танковая армия`, `механизированный корпус`, `воздушная армия`], UK: [`армия`, `бронетанковая дивизия`, `корпус`, `авиагруппа КВВС`] }[n];
  const ti = { inf: 0, arm: 1, mot: 2, air: 3 }[t];
  if (adj) return `${ORD(k)} ${adj[ti]}`;
  return `${ORD(k)} ${[`армия`, `танковая дивизия`, `моторизованный корпус`, `авиакорпус`][ti]}`;
}

// ——— местность, погода, укрепления ———
export const TERR = { pl: 1, fo: 1.25, hi: 1.35, mo: 1.7, ma: 1.45, de: 1.05 };
export const TERR_N = { pl: `равнина`, fo: `леса`, hi: `холмы`, mo: `горы`, ma: `болота`, de: `пустыня` };
const ARM_T = { pl: 1, fo: 0.8, hi: 0.85, mo: 0.55, ma: 0.6, de: 1.08 };
const COLD_OK = new Set([`SOV`, `FIN`]);
// Погода в регионе: {k, atk, mv, air, n}
export function weather(S, R, n) {
  const { m, h, y } = tDate(S.t), z = R.zone;
  const W = (k, atk, mv, air, nm) => ({ k, atk, mv, air, n: nm });
  if (z === `e` || z === `n`) {
    if (m === 11 || m === 0 || m === 1) {
      const cold = COLD_OK.has(n);
      const first = !cold && ((y === 1941 && m === 11) || (y === 1942 && m <= 1)) && !(S.nat[n]?.winter);
      return { ...W(`snow`, cold ? 0.92 : first ? 0.5 : 0.7, 2, 0.5, first ? `сильные морозы` : `зима`), def: cold ? 1 : first ? 0.8 : 0.92 };
    }
    if ((m === 9 && h === 1) || (m === 10 && h === 0) || (m === 2 && h === 1) || (m === 3 && h === 0)) return W(`mud`, 0.7, 1, 0.6, `распутица`);
  }
  if ((z === `c` || z === `w`) && (m === 11 || m === 0 || m === 1)) return W(`cold`, 0.88, 2, 0.75, `зима`);
  if (z === `s` && (m === 11 || m === 0 || m === 1)) return W(`rain`, 0.9, 2, 0.8, `дожди`);
  if (z === `d` && m >= 5 && m <= 7) return W(`heat`, 0.88, 2, 1, `зной`);
  return W(`fair`, 1, 2, 1, `ясно`);
}
export function fortMul(S, R, n) {
  const f = S.fort[R.i] || 0;
  return f && S.fortN[R.i] && ally(S, S.fortN[R.i], n) ? 1 + 0.3 * f : 1;
}
// ——— снабжение ———
// Морские зоны, где держава может снабжать и перебрасывать войска
const NAV = { UK: [`atl`, `nor`, `arc`, `med`, `gul`], USA: [`atl`, `nor`, `arc`, `med`, `gul`], FRA: [`atl`, `nor`, `med`], GER: [`bal`, `nor`], ITA: [`med`], SOV: [`bal`, `blk`, `arc`, `cas`], TUR: [`blk`, `med`], ROM: [`blk`], VIC: [`med`] };
export const navZones = (S, n) => [...(NAV[n] || []), ...(S.nat[n]?.nav2 || [])];
const MARITIME = new Set([`UK`, `USA`]);
const AFR = new Set([`tripoli`, `sirte`, `benghazi`, `tobruk`, `tunis`, `gabes`, `constantine`, `algiers`, `oran`, `casablanca`, `fes`, `tetouan`]);
// Возвращает для блока державы n массив «расстояния» (в полуходах) до узла снабжения; -1 — нет снабжения
export function supply(S, n) {
  const b = blocOf(S, n), key = `${b}@${S._ver}`;
  S._sup = S._sup || {};
  if (S._sup[b]?.key === key) return S._sup[b].d;
  const NR = G.R.length, d = new Int16Array(NR + 1).fill(-1);
  const mem = side(S, n) ? members(S, side(S, n)) : [n];
  const friend = (i) => {
    const c = S.ctrl[i];
    return c && (c === n || mem.includes(c));
  };
  // первичные узлы: столицы, отмеченные узлы, порты морских держав; вторичные — промышленные центры
  const prim = [], sec = [];
  for (const R of G.R) {
    const i = R.i, c = S.ctrl[i];
    if (!friend(i)) continue;
    const coreMine = S.core[i] === c;
    const held = S.t - (S.held[i] ?? -99);
    if ((R.cap && coreMine) || (R.hub && coreMine) || (R.hub && MARITIME.has(c))) prim.push([i, 0]);
    else if (R.sea.length && navZones(S, c).some((z) => R.sea.includes(z))) {
      // порт: свой — сразу, захваченный — после восстановления (4 хода), с потерями
      let off = MARITIME.has(c) ? 0 : coreMine ? 2 : held >= 4 ? 3 : 5;
      if (AFR.has(R.k) && !MARITIME.has(c) && c !== `VIC` && c !== `FRA`) off = S.ctrl[G.byKey.malta.i] && ally(S, S.ctrl[G.byKey.malta.i], c) ? 3 : 5;
      prim.push([i, off]);
    } else if (R.ic >= 3 && (coreMine || held >= 6)) sec.push([i, coreMine ? 0 : 3]);
  }
  // связность: вторичные узлы работают, если связаны по суше с первичными
  const conn = new Uint8Array(NR + 1);
  {
    const q = prim.map((p) => p[0]);
    for (const i of q) conn[i] = 1;
    for (let k = 0; k < q.length; k++)
      for (const j of G.R[q[k] - 1].nb) !conn[j] && friend(j) && ((conn[j] = 1), q.push(j));
  }
  const src = [...prim, ...sec.filter(([i]) => conn[i])];
  // Дейкстра с целыми весами: 2 за переход, 3 — по захваченной советской территории (колея, дороги)
  const pq = [];
  for (const [i, o] of src) if (d[i] < 0 || o < d[i]) ((d[i] = o), pq.push([o, i]));
  for (const [i] of sec) if (!conn[i] && d[i] < 0) d[i] = 6; // осаждённый город — сам себя
  pq.sort((x, y) => x[0] - y[0]);
  const axisSide = side(S, n) === `axis`;
  const c0 = (j) => S.ctrl[j];
  while (pq.length) {
    let bi = 0;
    for (let k = 1; k < pq.length; k++) pq[k][0] < pq[bi][0] && (bi = k);
    const [dv, i] = pq[bi];
    pq.splice(bi, 1);
    if (dv > d[i] && d[i] >= 0) continue;
    for (const j of G.R[i - 1].nb) {
      if (!friend(j)) continue;
      // по захваченной земле: свежий захват — 5 (дороги и мосты разрушены), колея СССР — 3
      // свежий захват (2 хода) — 5; Ось на советской земле и СССР за своими границами — 3 (перешивка колеи)
      const fresh = S.core[j] !== c0(j) && S.t - (S.held[j] ?? -99) < 2;
      const w = fresh ? 5 : axisSide && S.core[j] === `SOV` ? 3 : n === `SOV` && S.core[j] !== `SOV` ? 3 : 2, nd = dv + w;
      if (d[j] < 0 || nd < d[j]) ((d[j] = nd), pq.push([nd, j]));
    }
  }
  S._sup[b] = { key, d };
  return d;
}
export function supEff(S, n, i) {
  const v = supply(S, n)[i];
  if (v < 0) return 0;
  const h = v / 2;
  return h <= 2 ? 1 : h <= 4 ? 0.9 : h <= 6 ? 0.8 : h <= 8 ? 0.7 : h <= 10 ? 0.6 : 0.5;
}
// ——— боевая мощь ———
const techM = (S, n, t) => {
  const T = S.nat[n]?.tech || {};
  return t === `inf` ? 1 + 0.07 * (T.inf || 0) : t === `air` ? 1 + 0.1 * (T.air || 0) : 1 + 0.09 * (T.arm || 0);
};
const orgM = (u) => 0.35 + 0.65 * Math.max(0, u.o) / 100;
const xpM = (u) => 1 + 0.25 * u.x / 100;
const fuelM = (S, u) => (MOBILE(u) || u.t === `air`) && S.nat[u.n].oil <= 0 ? 0.7 : 1;
export function atkPow(S, u, T, src, amph) {
  if (!LAND(u)) return 0;
  const U = UT[u.t];
  let p = U.atk * u.s * orgM(u) * xpM(u) * quality(S, u.n) * techM(S, u.n, u.t) * Math.max(0.5, supEff(S, u.n, u.r)) * fuelM(S, u);
  p *= weather(S, T, u.n).atk;
  MOBILE(u) && (p *= ARM_T[T.t] * (T.city ? 0.8 : 1));
  src && T.riv.has(src) && (p *= 0.75);
  amph && (p *= 0.5);
  S.nat[u.n].surp > S.t - 1 && (p *= 1.3);
  return p;
}
export function defPow(S, u, T) {
  if (!LAND(u)) return 0;
  const U = UT[u.t];
  let p = U.def * u.s * orgM(u) * xpM(u) * quality(S, u.n) * techM(S, u.n, u.t) * Math.max(0.4, supEff(S, u.n, u.r)) * fuelM(S, u);
  p *= TERR[T.t] * (T.city ? 1.2 : 1) * fortMul(S, T, u.n) * (1 + 0.1 * Math.min(2, u.ent || 0)) * (weather(S, T, u.n).def || 1);
  return p;
}
export function airPow(S, u, T) {
  return UT.air.atk * u.s * orgM(u) * xpM(u) * quality(S, u.n) * techM(S, u.n, `air`) * weather(S, T, u.n).air * fuelM(S, u) * Math.max(0.5, supEff(S, u.n, u.r));
}
// Авиация в радиусе 2 переходов от цели
export function airNear(S, T, pred) {
  const out = [];
  for (const [i, k] of T.near) if (k <= 2) for (const u of ix(S)[i]) u.t === `air` && u.ap > 0 && u.o > 15 && pred(u) && out.push(u);
  return out.length > 3 ? out.sort((a, b) => b.s * b.o - a.s * a.o).slice(0, 3) : out;
}
// Оценка боя: атакующие — [{u, src, amph}]
export function estimate(S, att, Ti) {
  const T = reg(Ti), defs = landIn(S, Ti), an = att[0]?.u.n;
  let A = 0, D = 0;
  for (const a of att) A += atkPow(S, a.u, T, a.src, a.amph);
  const srcs = new Set(att.map((a) => a.src));
  srcs.size > 1 && (A *= 1 + 0.1 * Math.min(3, srcs.size - 1));
  for (const u of defs) D += defPow(S, u, T);
  const dn = defs[0]?.n || S.ctrl[Ti];
  const airA = an ? airNear(S, T, (u) => u.n === an) : [], airD = dn ? airNear(S, T, (u) => ally(S, u.n, dn) && atWar(S, u.n, an)) : [];
  const pa = airA.reduce((s, u) => s + airPow(S, u, T), 0), pd = airD.reduce((s, u) => s + airPow(S, u, T), 0);
  const sup = (pa + 0.5) / (pa + pd + 1);
  A += pa * 0.38 * (0.4 + sup);
  D += pd * 0.3 * (1.4 - sup);
  return { A, D: Math.max(0.3, D), r: A / Math.max(0.3, D), airA, airD, pa, pd, defs };
}
// Пути отхода для отряда обороняющегося
function retreatTo(S, u, Ti, attN) {
  let best = 0, bs = -1e9;
  for (const j of reg(Ti).nb) {
    const c = S.ctrl[j];
    if (!c || !ally(S, c, u.n)) continue;
    const us = landIn(S, j);
    if (us.some((v) => !ally(S, v.n, u.n))) continue;
    if (us.length >= STACK) continue;
    let s = supply(S, u.n)[j] >= 0 ? 10 : 0;
    s -= reg(j).nb.filter((q) => S.ctrl[q] && atWar(S, S.ctrl[q], u.n)).length * 2;
    s += rnd(S);
    s > bs && ((bs = s), (best = j));
  }
  void attN;
  return best;
}
// Бой. att: [{u, src, amph}]. Возвращает отчёт.
export function battle(S, att, Ti, o = {}) {
  const T = reg(Ti), an = att[0].u.n, dn = S.ctrl[Ti];
  const E = estimate(S, att, Ti), defs = E.defs;
  const roll = 0.82 + rnd(S) * 0.36, mod = o.mod || {};
  let r = E.r * roll * (mod.r || 1);
  const rep = { t: S.t, a: an, d: dn, T: Ti, r, A: E.A, D: E.D, src: [...new Set(att.map((a) => a.src))], au: att.length, du: defs.length, win: false, kill: 0, lostA: 0, lostD: 0, deep: o.deep || 0 };
  // авиация расходует вылеты и несёт потери
  for (const u of E.airA) (u.ap--, (u.s = Math.max(0.5, u.s * (1 - 0.06 * (E.pd / (E.pa + E.pd + 1))))), (u.o -= 6));
  for (const u of E.airD) (u.ap--, (u.s = Math.max(0.5, u.s * (1 - 0.06 * (E.pa / (E.pa + E.pd + 1))))), (u.o -= 6));
  if (!defs.length) r = 99;
  const win = r >= 1.15;
  const fa = Math.min(0.35, Math.max(0.03, 0.15 / Math.pow(Math.max(0.2, r), 0.8))) * (mod.a || 1);
  let fd = Math.min(0.45, Math.max(0.05, 0.06 + 0.085 * Math.min(r, 4))) * (mod.d || 1);
  win && r >= 3 && (fd *= 1.35);
  for (const a of att) {
    const l = a.u.s * fa;
    a.u.s -= l, (rep.lostA += l);
    a.u.o = Math.max(5, a.u.o - (12 + 10 / Math.max(0.4, r)) * (mod.oa || 1));
    a.u.x = Math.min(100, a.u.x + (win ? 4 : 2));
    a.u.at = 1;
    a.u.mv = Math.max(0, a.u.mv - (a.amph ? 9 : 1));
    a.u.ent = 0;
  }
  for (const u of defs) {
    const l = u.s * fd;
    u.s -= l, (rep.lostD += l);
    u.o = Math.max(5, u.o - (16 + 11 * Math.min(r, 3)) * (mod.od || 1));
    u.x = Math.min(100, u.x + 3);
  }
  if (win) {
    rep.win = true;
    for (const u of [...defs]) {
      const j = u.s < 0.6 ? 0 : retreatTo(S, u, Ti, an);
      if (!j) {
        rep.kill += u.s;
        rep.lostD += u.s;
        rep.killed = (rep.killed || 0) + 1;
        S.nat[u.n].lost = (S.nat[u.n].lost || 0) + u.s;
        kill(S, u);
      } else {
        u.s *= 0.9, (rep.lostD += u.s / 9);
        u.o = Math.max(5, u.o - 15);
        u.r = j, (u.ent = 0), (u.mv = 0);
        touch(S);
      }
    }
    // авиация, оставшаяся в регионе, перелетает
    for (const u of unitsIn(S, Ti).filter((v) => v.t === `air` && !ally(S, v.n, an))) {
      const j = [...T.near].filter(([q, k]) => k <= 3 && S.ctrl[q] && ally(S, S.ctrl[q], u.n)).sort((x, y) => x[1] - y[1])[0];
      j ? ((u.r = j[0]), touch(S)) : kill(S, u);
    }
    capture(S, Ti, an);
    for (const a of att) (a.u.r = Ti), (a.u.ent = 0);
    touch(S);
  }
  for (const a of att) a.u.s < 0.5 && kill(S, a.u);
  for (const u of defs) S.units.includes(u) && u.s < 0.5 && (kill(S, u), rep.killed = (rep.killed || 0) + 1);
  S.nat[an].lost = (S.nat[an].lost || 0) + rep.lostA;
  dn && S.nat[dn] && (S.nat[dn].lost = (S.nat[dn].lost || 0) + (win ? 0 : rep.lostD));
  S.bat.push(rep);
  return rep;
}
export function capture(S, Ti, n) {
  const prev = S.ctrl[Ti];
  S.ctrl[Ti] = n;
  S.held[Ti] = S.t;
  S.fort[Ti] && S.fortN[Ti] && !ally(S, S.fortN[Ti], n) && (S.fort[Ti] = Math.max(0, S.fort[Ti] - 1));
  S._ver++;
  S.caps.push({ t: S.t, r: Ti, from: prev, to: n });
}
// ——— перемещения ———
const enemyIn = (S, j, n) => unitsIn(S, j).some((v) => LAND(v) && atWar(S, v.n, n));
export const isEnemyReg = (S, j, n) => !!S.ctrl[j] && atWar(S, S.ctrl[j], n);
export const isFriendReg = (S, j, n) => !!S.ctrl[j] && ally(S, S.ctrl[j], n) && !(S.ctrl[j] !== n && !atWarAny(S, n) && false);
function atWarAny(S, n) {
  return S.wars.some((k) => k.split(`|`).includes(n));
}
export const room = (S, j) => landIn(S, j).length < STACK;
export function mvOf(S, u) {
  if (!LAND(u)) return UT.air.mv;
  const w = weather(S, reg(u.r), u.n).mv;
  let m = Math.min(UT[u.t].mv, w);
  MOBILE(u) && S.nat[u.n].oil <= 0 && (m = 1);
  return m;
}
// Куда может пойти отряд: [{r, k: move|attack|capture|amph|air, cost}]
export function targets(S, u) {
  const out = [], n = u.n, seen = new Map();
  if (u.mv <= 0) return out;
  if (u.t === `air`) {
    const d = new Map([[u.r, 0]]), q = [u.r];
    for (let k = 0; k < q.length; k++) {
      const a = q[k], da = d.get(a);
      if (da >= u.mv) continue;
      for (const b of [...reg(a).nb, ...reg(a).sea2.map((s) => s[0])])
        !d.has(b) && S.ctrl[b] && ally(S, S.ctrl[b], n) && (d.set(b, da + 1), q.push(b), out.push({ r: b, k: `air`, cost: u.mv }));
    }
    return out;
  }
  const step = (a, left, k0) => {
    for (const b of reg(a).nb) {
      const c = S.ctrl[b];
      if (!c) continue;
      if (ally(S, c, n)) {
        if (enemyIn(S, b, n) || !room(S, b)) continue;
        const cost = u.mv - left + 1;
        if (!seen.has(b) || seen.get(b).cost > cost) seen.set(b, { r: b, k: `move`, cost });
        left > 1 && step(b, left - 1, 0);
      } else if (atWar(S, c, n)) {
        const hasE = landIn(S, b).length > 0;
        if (hasE) {
          if (k0 && !(u.at && !MOBILE(u))) !seen.has(b) && seen.set(b, { r: b, k: `attack`, cost: 1 });
        } else if (!seen.has(b) || seen.get(b).k === `move`) seen.set(b, { r: b, k: `capture`, cost: MOBILE(u) ? u.mv - left + 1 : u.mv });
      }
    }
  };
  step(u.r, u.mv, 1);
  // десант через морскую связь
  if (u.mv >= mvOf(S, u) && !u.at) {
    const zs = navZones(S, n);
    for (const [b, z] of reg(u.r).sea2) {
      if (!zs.includes(z) && !(z === `nor` && S.nat[n].sealion)) continue;
      const c = S.ctrl[b];
      if (!c) continue;
      if (atWar(S, c, n) && !seen.has(b)) seen.set(b, { r: b, k: landIn(S, b).length ? `amph` : `capture`, cost: u.mv, sea: 1 });
      else if (ally(S, c, n) && !seen.has(b) && room(S, b) && !enemyIn(S, b, n)) seen.set(b, { r: b, k: `move`, cost: u.mv, sea: 1 });
    }
  }
  seen.delete(u.r);
  return [...seen.values()];
}
export function moveUnit(S, u, j, cost) {
  u.r = j;
  u.mv = Math.max(0, u.mv - cost);
  u.ent = 0;
  touch(S);
}
// Захват пустого вражеского региона
export function occupy(S, u, j, cost) {
  moveUnit(S, u, j, cost);
  capture(S, j, u.n);
}
// Переброска по железной дороге: вся сеть своих снабжаемых регионов
export const RAIL = { GER: 4, SOV: 5, UK: 2, USA: 2, FRA: 3, ITA: 2, POL: 1, _: 1 };
export function railTargets(S, u) {
  const n = u.n, nat = S.nat[n];
  if (!LAND(u) || u.mv < mvOf(S, u) || u.at || (nat.rail || 0) <= 0 || supply(S, n)[u.r] < 0) return [];
  const seen = new Set([u.r]), q = [u.r], out = [];
  for (let k = 0; k < q.length; k++)
    for (const b of reg(q[k]).nb) {
      if (seen.has(b)) continue;
      seen.add(b);
      const c = S.ctrl[b];
      if (!c || !ally(S, c, n) || enemyIn(S, b, n) || supply(S, n)[b] < 0) continue;
      q.push(b);
      reg(u.r).nb.includes(b) || (room(S, b) && out.push(b));
    }
  return out;
}
export function railMove(S, u, j) {
  S.nat[u.n].rail--;
  u.r = j, (u.mv = 0), (u.o = Math.max(5, u.o - 10)), (u.ent = 0);
  u.at = 1;
  touch(S);
}
// Морская переброска между своими портами
export const NAVCAP = { UK: 3, USA: 3, GER: 1, ITA: 2, SOV: 1, FRA: 1, _: 0 };
export function seaTargets(S, u) {
  const n = u.n, nat = S.nat[n], R = reg(u.r), zs = navZones(S, n);
  if (!LAND(u) || u.mv < mvOf(S, u) || u.at || (nat.navl || 0) <= 0 || !R.sea.some((z) => zs.includes(z))) return [];
  const mz = MARITIME.has(n) ? zs : R.sea.filter((z) => zs.includes(z));
  const out = [];
  for (const T of G.R) {
    if (T.i === u.r || !T.sea.some((z) => mz.includes(z))) continue;
    const c = S.ctrl[T.i];
    c && ally(S, c, n) && !enemyIn(S, T.i, n) && room(S, T.i) && out.push(T.i);
  }
  return out;
}
export function seaMove(S, u, j) {
  S.nat[u.n].navl--;
  u.r = j, (u.mv = 0), (u.o = Math.max(5, u.o - 15)), (u.ent = 0), (u.at = 1);
  touch(S);
}
// ——— экономика ———
export const TECH = {
  inf: { n: `Пехота`, d: `атака и оборона пехоты +7 % за уровень` },
  arm: { n: `Бронетехника`, d: `танки и мотопехота +9 % за уровень` },
  air: { n: `Авиация`, d: `сила авиации +10 % за уровень` },
  ind: { n: `Промышленность`, d: `производство +6 %, синтетическое топливо` },
};
export const techCost = (lv) => 25 + lv * 20;
export const techYear = (lv) => 1938 + lv;
// Доход державы за ход
export function income(S, n) {
  const nat = S.nat[n], o = { pp: 0, oil: 0, st: 0, co: 0, mp: 0 };
  if (!alive(S, n)) return o;
  for (const R of G.R) {
    if (S.ctrl[R.i] !== n) continue;
    // оккупированное: 40%, советская земля — 25% (выжженная земля, партизаны)
    const k = S.core[R.i] === n ? 1 : S.core[R.i] === `SOV` ? 0.25 : 0.4, ks = supply(S, n)[R.i] >= 0 ? 1 : 0.3;
    o.pp += (R.ic + (S.icAdd[R.i] || 0)) * k * ks;
    o.oil += R.oil * k * ks;
    o.st += R.st * k * ks;
    o.co += R.co * k * ks;
    o.mp += R.mp * (S.core[R.i] === n ? 1 : 0.15) * 2.2;
  }
  const t = nat.tech || {};
  o.pp *= (nat.eco || 1) * (1 + 0.06 * (t.ind || 0));
  // уголь: промышленность без угля работает хуже
  const need = o.pp * 0.3, coal = o.co + (nat.imp?.co || 0);
  coal < need && (o.pp *= 0.6 + 0.4 * (coal / Math.max(1, need)));
  for (const k of [`pp`, `oil`, `st`, `mp`]) o[k] += nat.imp?.[k] || 0;
  n === `GER` && (o.oil += t.ind || 0);
  o.mp *= nat.mpk || 1;
  return o;
}
// Расход топлива войсками
export function upkeep(S, n) {
  let oil = 0;
  for (const u of S.units) u.n === n && (oil += UT[u.t].oil * u.s);
  return oil;
}
// Конец хода державы: доход, пополнение, производство, наука
export function economy(S, n) {
  const nat = S.nat[n];
  if (!alive(S, n)) return;
  const inc = income(S, n);
  nat.inc = inc;
  nat.pp += inc.pp, (nat.oil += inc.oil - upkeep(S, n)), (nat.st += inc.st), (nat.mp += inc.mp);
  nat.oil = Math.max(-5, nat.oil);
  // наука — фиксированная доля
  const rp = inc.pp * 0.15;
  nat.pp -= rp;
  if (nat.res) {
    nat.rp = (nat.rp || 0) + rp;
    const lv = nat.tech[nat.res] || 0, c = techCost(lv);
    if (lv < 5 && nat.rp >= c && tDate(S.t).y >= techYear(lv + 1)) {
      nat.rp -= c;
      nat.tech[nat.res] = lv + 1;
      S.log.push({ t: S.t, n, k: `tech`, txt: `${NATIONS[n].n}: ${TECH[nat.res].n} — уровень ${lv + 1}` });
      nat.res = n === S.player ? nat.res : null;
    }
  }
  // пополнение: до доли reinf от наличных ПП
  let budget = Math.max(0, nat.pp) * (nat.reinf ?? 0.5);
  const sup = supply(S, n);
  const list = S.units.filter((u) => u.n === n && u.s < UT[u.t].max && sup[u.r] >= 0).sort((a, b) => a.s / UT[a.t].max - b.s / UT[b.t].max);
  for (const u of list) {
    const R = UT[u.t].re, want = Math.min(UT[u.t].max - u.s, u.t === `inf` ? 2.2 : 1.6) * supEff(S, n, u.r);
    let k = want;
    k = Math.min(k, budget / R.pp, nat.mp / Math.max(0.01, R.mp), R.st ? Math.max(0, nat.st) / R.st : 99, R.oil ? Math.max(0, nat.oil) / R.oil : 99);
    if (k <= 0.05) continue;
    u.s += k;
    budget -= k * R.pp, (nat.pp -= k * R.pp), (nat.mp -= k * R.mp), (nat.st -= k * R.st), (nat.oil -= k * R.oil);
    u.x = Math.max(0, u.x - k * 2);
  }
  // производство: очередь по порядку
  for (const q of nat.q) {
    if (nat.pp <= 0) break;
    if (q.left > 0 && q.paid >= q.need) continue;
    const pay = Math.min(nat.pp, q.need - q.paid, q.need / Math.max(1, q.time) + 0.01);
    q.paid += pay, (nat.pp -= pay);
  }
  for (const q of [...nat.q]) {
    q.paid >= q.need - 0.01 && q.left--;
    if (q.left <= 0 && q.paid >= q.need - 0.01) {
      nat.q.splice(nat.q.indexOf(q), 1);
      finishItem(S, n, q);
    }
  }
}
export const ITEMS = {
  inf: { n: `Пехотная армия`, u: `inf` },
  mot: { n: `Моторизованный корпус`, u: `mot` },
  arm: { n: `Танковая армия`, u: `arm` },
  air: { n: `Воздушный флот`, u: `air` },
  fort: { n: `Укрепрайон`, cost: { pp: 30, mp: 0, st: 4, oil: 0 }, time: 2 },
  ic: { n: `Заводы (+1 пром.)`, cost: { pp: 70, mp: 0, st: 6, oil: 0 }, time: 5 },
};
export const itemCost = (k) => ITEMS[k].u ? UT[ITEMS[k].u].cost : ITEMS[k].cost;
export const itemTime = (k) => ITEMS[k].u ? UT[ITEMS[k].u].time : ITEMS[k].time;
export function canBuy(S, n, k) {
  const c = itemCost(k), nat = S.nat[n];
  return (!c.mp || nat.mp >= c.mp) && (!c.st || nat.st >= c.st) && (!c.oil || nat.oil >= c.oil);
}
export function buy(S, n, k, r) {
  const c = itemCost(k), nat = S.nat[n];
  if (!canBuy(S, n, k)) return false;
  nat.mp -= c.mp, (nat.st -= c.st), (nat.oil -= c.oil);
  nat.q.push({ k, need: c.pp, paid: 0, time: itemTime(k), left: itemTime(k), r: r || 0 });
  return true;
}
// Куда ставить новые войска: выбранный регион или столица / ближайший свой узел
export function deployRegion(S, n, want) {
  const ok = (i, any) => i && (S.ctrl[i] === n || (any && S.ctrl[i] && ally(S, S.ctrl[i], n))) && supply(S, n)[i] >= 0 && room(S, i) && !enemyIn(S, i, n);
  if (ok(want)) return want;
  const nat = S.nat[n];
  for (const k of nat.arrive || []) if (ok(G.byKey[k]?.i, true)) return G.byKey[k].i;
  const cap = G.R.find((R) => R.cap && S.core[R.i] === n && S.ctrl[R.i] === n);
  if (cap && ok(cap.i)) return cap.i;
  // ближайший к столице свой регион (а не глубокий тыл)
  if (cap) {
    const d = new Map([[cap.i, 0]]), q = [cap.i];
    for (let k = 0; k < q.length; k++) for (const b of reg(q[k]).nb) !d.has(b) && S.ctrl[b] === n && (d.set(b, d.get(q[k]) + 1), q.push(b));
    const c = [...d.keys()].filter((i) => ok(i)).sort((a, b) => d.get(a) - d.get(b) || reg(b).ic - reg(a).ic)[0];
    if (c) return c;
  }
  const sup = supply(S, n);
  const cand = G.R.filter((R) => ok(R.i)).sort((a, b) => sup[a.i] - sup[b.i] || b.ic - a.ic);
  return cand[0]?.i || 0;
}
function finishItem(S, n, q) {
  if (ITEMS[q.k].u) {
    const r = deployRegion(S, n, q.r);
    if (!r) return S.nat[n].q.unshift({ ...q, left: 1 });
    const u = spawn(S, n, ITEMS[q.k].u, r, undefined, { o: 60 });
    S.log.push({ t: S.t, n, k: `new`, txt: `${NATIONS[n].n}: сформирована ${u.nm} (${reg(r).n})` });
  } else if (q.k === `fort`) {
    const r = q.r || deployRegion(S, n, 0);
    r && S.ctrl[r] === n && ((S.fort[r] = Math.min(3, (S.fort[r] || 0) + 1)), (S.fortN[r] = n));
  } else if (q.k === `ic`) {
    const r = q.r || deployRegion(S, n, 0);
    r && (S.icAdd[r] = (S.icAdd[r] || 0) + 1);
  }
}
// ——— начало хода: ходы, организация, снабжение ———
export function refresh(S, n) {
  const nat = S.nat[n];
  nat.rail = RAIL[n] ?? RAIL._;
  nat.navl = NAVCAP[n] ?? NAVCAP._;
  const sup = supply(S, n);
  for (const u of S.units) {
    if (u.n !== n) continue;
    u.mv = mvOf(S, u);
    u.ap = u.t === `air` ? 2 : 0;
    const fought = u.at;
    u.at = 0;
    const s = sup[u.r];
    if (s < 0) {
      u.o = Math.max(5, u.o - 22);
      u.s = Math.max(0.4, u.s - 0.8 - u.s * 0.08);
      u.oos = (u.oos || 0) + 1;
    } else {
      u.oos = 0;
      u.o = Math.min(nat.orgMax || 100, u.o + (fought ? 12 : 28) * supEff(S, n, u.r));
      LAND(u) && (u.ent = Math.min(2, (u.ent || 0) + (fought ? 0 : 1)));
    }
  }
  for (const u of [...S.units]) u.n === n && u.s < 0.5 && kill(S, u);
}
// ——— победные очки, капитуляция ———
export function vpState(S, n) {
  let core = 0, lost = 0;
  for (const R of G.R) {
    if (S.core[R.i] !== n) continue;
    core += R.vp;
    const c = S.ctrl[R.i];
    c && c !== n && !ally(S, c, n) && (lost += R.vp);
  }
  return { core, lost, k: core ? lost / core : 0 };
}
// столица — исконная (own), а не присоединённая (Таллин для СССР — не столица)
export const capitalOf = (S, n) => G.R.find((R) => R.cap && R.own === n && S.core[R.i] === n) || (n === `VIC` ? G.byKey.vichy || null : null);
export function capitalLost(S, n) {
  const c = capitalOf(S, n);
  return !!c && S.ctrl[c.i] !== n && !ally(S, S.ctrl[c.i], n);
}
export const totalStr = (S, n) => S.units.reduce((s, u) => s + (u.n === n && LAND(u) ? u.s : 0), 0);
