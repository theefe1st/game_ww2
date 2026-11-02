// «Европа 1939–1945» (v0.6.1): правила — дивизии на карте провинций, как в тактических операциях «Мирового фронта».
// В провинции — не больше одной дивизии. Чистая логика без DOM (игра и симулятор).
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
    // провинции в 2 переходах по суше — дальность артиллерии
    const d2 = new Set();
    for (const b of r.nb) {
      d2.add(b);
      for (const c of G.R[b - 1].nb) c !== r.i && d2.add(c);
    }
    r.d2 = d2;
    r.zone = r.t === `de` || r.lat < 33 ? `d` : r.lat >= 60 ? `n` : r.lat < 43.5 ? `s` : r.lon >= 24 && r.lat >= 45 ? `e` : r.lon < 2 ? `w` : `c`;
  }
}
export const reg = (i) => G.R[i - 1];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// ——— случайные числа (сохраняются в состоянии) ———
export function rnd(S) {
  let t = (S.rs = (S.rs + 0x6d2b79f5) >>> 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
// дробные потери — целые с вероятностным округлением
const rround = (S, v) => Math.floor(v) + (rnd(S) < v - Math.floor(v) ? 1 : 0);

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

// ——— дивизии ———
// atk/def — как в тактических операциях; mv — переходов за ход; cost — формирование; re — пополнение за 1 ед. силы
export const UT = {
  inf: { n: `Пехотная дивизия`, sh: `пехота`, atk: 6, def: 7, mv: 1, oil: 0, cost: { pp: 22, mp: 8, oil: 0 }, re: { pp: 2, mp: 0.9, oil: 0 }, d: `Основа фронта: прочно держит оборону, ходит на 1 провинцию.` },
  cav: { n: `Кавалерийская дивизия`, sh: `кавалерия`, atk: 5, def: 5, mv: 2, oil: 0, cost: { pp: 15, mp: 6, oil: 0 }, re: { pp: 1.4, mp: 0.7, oil: 0 }, d: `Быстрая и дешёвая, не боится лесов и болот, но слаба против танков.` },
  mot: { n: `Моторизованная дивизия`, sh: `мотопехота`, atk: 7, def: 6, mv: 2, oil: 0.3, cost: { pp: 32, mp: 6, oil: 3 }, re: { pp: 3, mp: 0.6, oil: 0.3 }, d: `Быстрая пехота: 2 провинции за ход, после победы может идти дальше.` },
  arm: { n: `Танковая дивизия`, sh: `танки`, atk: 10, def: 7, mv: 2, oil: 0.6, cost: { pp: 46, mp: 5, oil: 5 }, re: { pp: 4.4, mp: 0.5, oil: 0.5 }, d: `Ударная сила: прорывает фронт и окружает врага. Слабее в лесах, горах, болотах и городах.` },
  art: { n: `Артиллерийская дивизия`, sh: `артиллерия`, atk: 8, def: 4, mv: 1, oil: 0.05, cost: { pp: 26, mp: 5, oil: 0 }, re: { pp: 2.4, mp: 0.5, oil: 0 }, d: `Обстрел на 2 провинции без ответного огня. Слаба в обороне и не занимает землю.` },
};
export const TYPES = [`inf`, `art`, `cav`, `mot`, `arm`];
export const AIR = { n: `Авиаполк`, cost: { pp: 34, mp: 2, oil: 3 }, max: 14, d: `+1 авиаудар за ход. Удар: −15…25 организации, шанс −1 к силе.` };
export const MAXS = 10;
export const MECH = (u) => u.t === `arm` || u.t === `mot`;
export const BLITZ = (u) => u.t === `arm` || u.t === `mot` || u.t === `cav`;
export const xpL = (x) => (x >= 12 ? 3 : x >= 7 ? 2 : +(x >= 3));
// качество войск по годам 1939…1945 (выучка, доктрина, командование)
const QUAL = {
  GER: [1.25, 1.24, 1.2, 1.14, 1.08, 1.02, 0.96], SOV: [0.8, 0.8, 0.8, 0.9, 1.0, 1.08, 1.12], UK: [0.96, 0.96, 1.0, 1.05, 1.08, 1.1, 1.1],
  USA: [1, 1, 1, 0.98, 1.05, 1.1, 1.12], FRA: [0.95, 0.9, 0.88, 0.88, 0.92, 0.95, 0.95], POL: [0.8], ITA: [0.75, 0.74, 0.74, 0.76, 0.76, 0.76, 0.76],
  FIN: [1.15, 1.15, 1.1, 1.08, 1.05, 1.0, 1.0], ROM: [0.7, 0.7, 0.72, 0.72, 0.72, 0.76, 0.76], HUN: [0.72, 0.72, 0.72, 0.72, 0.74, 0.76, 0.76],
  BUL: [0.72], SVK: [0.68], YUG: [0.66], GRE: [0.9], NOR: [0.78], BEL: [0.8], NED: [0.7], DEN: [0.55], TUR: [0.72], ESP: [0.72],
  POR: [0.62], SWE: [0.84], SUI: [0.95], IRN: [0.55], VIC: [0.78], LIT: [0.62], LAT: [0.62], EST: [0.64], IRL: [0.62], _: [0.72],
};
export function quality(S, n) {
  const q = QUAL[n] || QUAL._, y = tDate(S.t).y - 1939;
  let v = q[Math.min(q.length - 1, Math.max(0, y))];
  const d = S.diff ?? 1;
  if (n === S.player) v *= [1.12, 1, 0.92][d];
  else if (S.player && atWar(S, n, S.player)) v *= [0.92, 1, 1.06][d];
  return v * (S.nat[n]?.qmul || 1);
}
export const orgMax = (S, n) => S.nat[n]?.orgMax || 100;

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
  S._ver++;
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
// своя или союзная провинция (можно стоять и проходить)
export const friendly = (S, i, n) => !!S.ctrl[i] && ally(S, S.ctrl[i], n);
export const hostile = (S, i, n) => !!S.ctrl[i] && atWar(S, S.ctrl[i], n);

// ——— индекс дивизий по провинциям ———
export const touch = (S) => (S._uv = (S._uv || 0) + 1);
// журнал действий для анимации на карте (S._fx заводит интерфейс; в сохранение не попадает)
const fx = (S, e) => S._fx && S._fx.push(e);
export function ix(S) {
  if (S._ix && S._ixv === S._uv) return S._ix;
  const a = new Array(G.R.length + 1).fill(null);
  for (const u of S.units) a[u.r] = u;
  S._ix = a, (S._ixv = S._uv);
  return a;
}
export const unitAt = (S, i) => ix(S)[i] || null;
export const unitsOf = (S, n) => S.units.filter((u) => u.n === n);
// провинции, соседние с дивизиями противника державы n (зона контроля)
export function zocOf(S, n) {
  const key = `${S._uv}|${S._ver}|${n}`;
  S._zc = S._zc || {};
  if (S._zc[n]?.key === key) return S._zc[n].z;
  const z = new Uint8Array(G.R.length + 1);
  for (const u of S.units) if (atWar(S, u.n, n)) for (const j of reg(u.r).nb) z[j] = 1;
  S._zc[n] = { key, z };
  return z;
}
const ORD = (k) => `${k}-я`;
const NAMES = {
  GER: { inf: [`пехотная дивизия`, 1], cav: [`кавалерийская дивизия`, 1], mot: [`моторизованная дивизия`, 2], arm: [`танковая дивизия`, 1], art: [`артиллерийская дивизия`, 1] },
  SOV: { inf: [`стрелковая дивизия`, 1], cav: [`кавалерийская дивизия`, 1], mot: [`моторизованная дивизия`, 1], arm: [`танковая дивизия`, 1], art: [`артиллерийская дивизия`, 1] },
  UK: { inf: [`пехотная дивизия`, 1], cav: [`кавалерийская дивизия`, 1], mot: [`моторизованная дивизия`, 1], arm: [`бронетанковая дивизия`, 1], art: [`артиллерийская группа`, 1] },
  _: { inf: [`пехотная дивизия`, 1], cav: [`кавалерийская дивизия`, 1], mot: [`моторизованная дивизия`, 1], arm: [`танковая дивизия`, 1], art: [`артиллерийская дивизия`, 1] },
};
export function unitName(n, t, k) {
  const [s] = (NAMES[n] || NAMES._)[t];
  return `${ORD(k)} ${s}`;
}
export function spawn(S, n, t, r, s, o = {}) {
  const nat = S.nat[n];
  nat.cnt = nat.cnt || {};
  nat.cnt[t] = (nat.cnt[t] || 0) + 1;
  const om = orgMax(S, n);
  const u = {
    id: ++S.nid, n, t, r, s: clamp(Math.round(s ?? MAXS), 1, MAXS), o: Math.round(clamp(o.o ?? om, 0, om)), x: o.x ?? 0, e: o.e ?? 0,
    mv: 0, at: 0, fr: o.fr ? 1 : 0, ah: 0, oos: 0, mvd: 0, nm: o.nm || unitName(n, t, (nat.cnt0?.[t] || 0) + nat.cnt[t]),
  };
  S.units.push(u);
  touch(S);
  return u;
}
export function kill(S, u) {
  const k = S.units.indexOf(u);
  k >= 0 && S.units.splice(k, 1);
  touch(S);
}

// ——— местность, погода, укрепления ———
export const TERR = { pl: 1, fo: 1.25, hi: 1.3, mo: 1.6, ma: 1.2, de: 1 };
export const TERR_N = { pl: `равнина`, fo: `леса`, hi: `холмы`, mo: `горы`, ma: `болота`, de: `пустыня` };
const ARM_T = { pl: 1, fo: 0.75, hi: 0.85, mo: 0.6, ma: 0.6, de: 1.05 };
export const cityDef = (R) => (R.cap || R.vp >= 6 ? 1.35 : R.city ? 1.25 : 1);
const COLD_OK = new Set([`SOV`, `FIN`]);
// Погода в провинции: {k, atk, mv, air, n, def}
export function weather(S, R, n) {
  const { m, h, y } = tDate(S.t), z = R.zone;
  const W = (k, atk, mv, air, nm, def = 1) => ({ k, atk, mv, air, n: nm, def });
  if (z === `e` || z === `n`) {
    if (m === 11 || m === 0 || m === 1) {
      const cold = COLD_OK.has(n);
      const first = !cold && ((y === 1941 && m === 11) || (y === 1942 && m <= 1)) && !S.nat[n]?.winter;
      return W(`snow`, cold ? 0.95 : first ? 0.6 : 0.78, cold ? 0 : 1, 0.5, first ? `сильные морозы` : `зима`, cold ? 1 : first ? 0.85 : 0.94);
    }
    if ((m === 9 && h === 1) || (m === 10 && h === 0) || (m === 2 && h === 1) || (m === 3 && h === 0)) return W(`mud`, 0.75, 1, 0.5, `распутица`);
  }
  if ((z === `c` || z === `w`) && (m === 11 || m === 0 || m === 1)) return W(`cold`, 0.9, 0, 0.75, `зима`);
  if (z === `s` && (m === 11 || m === 0 || m === 1)) return W(`rain`, 0.92, 0, 0.75, `дожди`);
  if (z === `d` && m >= 5 && m <= 7) return W(`heat`, 0.9, 0, 1, `зной`);
  return W(`fair`, 1, 0, 1, `ясно`);
}
export function fortLvl(S, i, n) {
  const f = S.fort[i] || 0;
  return f && S.fortN[i] && ally(S, S.fortN[i], n) ? f : 0;
}
// ——— снабжение ———
// Морские зоны, где держава может снабжать и перебрасывать войска
const NAV = { UK: [`atl`, `nor`, `arc`, `med`, `gul`], USA: [`atl`, `nor`, `arc`, `med`, `gul`], FRA: [`atl`, `nor`, `med`], GER: [`bal`, `nor`], ITA: [`med`], SOV: [`bal`, `blk`, `arc`, `cas`], TUR: [`blk`, `med`], ROM: [`blk`], VIC: [`med`] };
export const navZones = (S, n) => [...(NAV[n] || []), ...(S.nat[n]?.nav2 || [])];
export const MARITIME = new Set([`UK`, `USA`]);
const AFR = new Set([`tripoli`, `sirte`, `benghazi`, `tobruk`, `tunis`, `gabes`, `constantine`, `algiers`, `oran`, `casablanca`, `fes`, `tetouan`]);
// Для блока державы n: «расстояние» (в полуходах) до узла снабжения; -1 — нет снабжения
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
  const prim = [], sec = [];
  for (const R of G.R) {
    const i = R.i, c = S.ctrl[i];
    if (!friend(i)) continue;
    const coreMine = S.core[i] === c;
    const held = S.t - (S.held[i] ?? -99);
    if ((R.cap && coreMine) || (R.hub && coreMine) || (R.hub && MARITIME.has(c))) prim.push([i, 0]);
    else if (R.sea.length && navZones(S, c).some((z) => R.sea.includes(z))) {
      let off = MARITIME.has(c) ? 0 : coreMine ? 2 : held >= 4 ? 3 : 5;
      if (AFR.has(R.k) && !MARITIME.has(c) && c !== `VIC` && c !== `FRA`) off = S.ctrl[G.byKey.malta.i] && ally(S, S.ctrl[G.byKey.malta.i], c) ? 3 : 5;
      prim.push([i, off]);
    } else if (R.ic >= 3 && (coreMine || held >= 6)) sec.push([i, coreMine ? 0 : 3]);
  }
  const conn = new Uint8Array(NR + 1);
  {
    const q = prim.map((p) => p[0]);
    for (const i of q) conn[i] = 1;
    for (let k = 0; k < q.length; k++) for (const j of G.R[q[k] - 1].nb) !conn[j] && friend(j) && ((conn[j] = 1), q.push(j));
  }
  const src = [...prim, ...sec.filter(([i]) => conn[i])];
  const pq = [];
  for (const [i, o] of src) if (d[i] < 0 || o < d[i]) ((d[i] = o), pq.push([o, i]));
  for (const [i] of sec) if (!conn[i] && d[i] < 0) d[i] = 6;
  const axisSide = side(S, n) === `axis`;
  while (pq.length) {
    let bi = 0;
    for (let k = 1; k < pq.length; k++) pq[k][0] < pq[bi][0] && (bi = k);
    const [dv, i] = pq[bi];
    pq.splice(bi, 1);
    if (dv > d[i] && d[i] >= 0) continue;
    for (const j of G.R[i - 1].nb) {
      if (!friend(j)) continue;
      const fresh = S.core[j] !== S.ctrl[j] && S.t - (S.held[j] ?? -99) < 2;
      const w = fresh ? 4 : axisSide && S.core[j] === `SOV` ? 3 : n === `SOV` && S.core[j] !== `SOV` ? 3 : 2, nd = dv + w;
      if (d[j] < 0 || nd < d[j]) ((d[j] = nd), pq.push([nd, j]));
    }
  }
  S._sup[b] = { key, d };
  return d;
}
export const inSup = (S, n, i) => supply(S, n)[i] >= 0;

// ——— бой ———
const techM = (S, n, t) => {
  const T = S.nat[n]?.tech || {};
  return t === `arm` || t === `mot` ? 1 + 0.09 * (T.arm || 0) : 1 + 0.07 * (T.inf || 0);
};
const orgF = (S, u) => 0.4 + 0.6 * clamp(u.o / orgMax(S, u.n), 0, 1);
const pct = (k) => `${k >= 1 ? `+` : `−`}${Math.round(Math.abs(k - 1) * 100)}%`;
// Расчёт боя (без случайности): a — атакующая дивизия, d — обороняющаяся. o: {src, amph, art}
export function combat(S, a, d, o = {}) {
  const T = reg(d.r), src = o.src ?? a.r, mods = [], W = weather(S, T, a.n), nat = S.nat[a.n];
  const M = (l, k, good) => k !== 1 && mods.push({ l, v: pct(k), good });
  let A = UT[a.t].atk * quality(S, a.n) * techM(S, a.n, a.t) * (a.s / 10) * orgF(S, a) * (1 + 0.05 * xpL(a.x));
  if (MECH(a)) {
    let k = ARM_T[T.t] * (T.city || T.cap ? 0.8 : 1);
    a.t === `mot` && (k = (1 + k) / 2);
    k < 1 && M(`${a.t === `arm` ? `Танки` : `Мотопехота`}: ${T.city || T.cap ? `город` : TERR_N[T.t]}`, k, false);
    A *= k;
  }
  a.t === `cav` && d.t === `arm` && ((A *= 0.8), M(`Кавалерия против танков`, 0.8, false));
  if (W.atk < 1) (A *= W.atk), M(`Погода: ${W.n}`, W.atk, false);
  if (MECH(a) && (W.k === `mud` || W.k === `snow`)) (A *= 0.85), M(`Техника вязнет`, 0.85, false);
  let fl = 0;
  for (const j of T.nb) {
    const v = unitAt(S, j);
    v && v !== a && ally(S, v.n, a.n) && atWar(S, v.n, d.n) && fl++;
  }
  fl = Math.min(3, fl);
  fl && ((A *= 1 + 0.1 * fl), mods.push({ l: `Поддержка с флангов ×${fl}`, v: `+${fl * 10}%`, good: true }));
  !inSup(S, a.n, a.r) && ((A *= 0.6), M(`Атакующий без снабжения`, 0.6, false));
  o.amph && ((A *= 0.5), M(`Высадка с моря`, 0.5, false));
  nat.surp > S.t - 1 && ((A *= 1.25), M(`Внезапность`, 1.25, true));
  a.xa && ((A *= 1 + a.xa), M(o.xaN || `Боевой приказ`, 1 + a.xa, true));
  let D = UT[d.t].def * quality(S, d.n) * techM(S, d.n, d.t) * (d.s / 10) * orgF(S, d) * (1 + 0.05 * xpL(d.x));
  const tk = TERR[T.t] * cityDef(T);
  tk > 1 && ((D *= tk), mods.push({ l: `Местность: ${TERR_N[T.t]}${T.cap || T.city ? `, город` : ``}`, v: `+${Math.round((tk - 1) * 100)}% защ.`, good: false }));
  T.riv.has(src) && !o.art && ((D *= 1.3), mods.push({ l: `Атака через реку`, v: `+30% защ.`, good: false }));
  d.e && ((D *= 1 + 0.1 * d.e), mods.push({ l: `Окопы ур. ${d.e}`, v: `+${d.e * 10}% защ.`, good: false }));
  const f = fortLvl(S, T.i, d.n);
  f && ((D *= 1 + 0.25 * f), mods.push({ l: `Укрепления ур. ${f}`, v: `+${f * 25}% защ.`, good: false }));
  const Wd = weather(S, T, d.n);
  Wd.def < 1 && ((D *= Wd.def), mods.push({ l: `Обороняющиеся мёрзнут`, v: `−${Math.round((1 - Wd.def) * 100)}% защ.`, good: true }));
  !inSup(S, d.n, d.r) && ((D *= 0.7), mods.push({ l: `Противник без снабжения`, v: `−30% защ.`, good: true }));
  const R = clamp(A / Math.max(0.05, D), 0.2, 5);
  let dStr = Math.pow(R, 0.7), dOrg = 32 * Math.pow(R, 0.8), aStr = Math.pow(R, -0.7), aOrg = 22 * Math.pow(R, -0.8);
  if (o.art) (dStr *= 0.6), (dOrg *= 0.75), (aStr = 0), (aOrg = 0);
  const canRet = !o.art && !!retreatTo(S, d, a.r, true);
  const out = d.s - dStr <= 0.4 ? `destroyed` : !o.art && d.o - dOrg <= 0 ? (canRet ? `retreat` : `destroyed`) : `hold`;
  return { A, D, R, mods, dStr, dOrg, aStr, aOrg, out, canRet };
}
// Куда отступает разбитая дивизия: соседняя своя пустая провинция, подальше от врага
export function retreatTo(S, u, from, peek = false) {
  let best = 0, bs = -1e9;
  const sup = supply(S, u.n), z = zocOf(S, u.n);
  for (const j of reg(u.r).nb) {
    if (j === from || !friendly(S, j, u.n) || unitAt(S, j)) continue;
    let s = (sup[j] >= 0 ? 10 : 0) - (z[j] ? 3 : 0) + (reg(from)?.nb.includes(j) ? -2 : 0);
    s += peek ? 0 : rnd(S) * 0.5;
    s > bs && ((bs = s), (best = j));
  }
  return best;
}
export function capture(S, Ti, n) {
  const prev = S.ctrl[Ti];
  if (prev === n) return;
  S.ctrl[Ti] = n;
  S.held[Ti] = S.t;
  S.fort[Ti] && S.fortN[Ti] && !ally(S, S.fortN[Ti], n) && (S.fort[Ti] = Math.max(0, S.fort[Ti] - 1));
  S._ver++;
  S.caps.push({ t: S.t, r: Ti, from: prev, to: n });
}
const lose = (S, n, v) => S.nat[n] && (S.nat[n].lost = (S.nat[n].lost || 0) + v);
// Атака (или обстрел артиллерией) дивизии в провинции Ti. o: {amph, mod: {r, a, d}, noAdv}
export function attack(S, a, Ti, o = {}) {
  const d = unitAt(S, Ti);
  if (!d || !S.units.includes(a)) return null;
  const art = a.t === `art` && !o.amph;
  o.amph && !o.free && (S.nat[a.n].navl = Math.max(0, (S.nat[a.n].navl || 0) - 1));
  const src = a.r, c = combat(S, a, d, { src, amph: o.amph, art }), m = o.mod || {};
  const rf = () => 0.75 + 0.5 * rnd(S), of = () => 0.8 + 0.4 * rnd(S);
  const k = Math.pow(m.r || 1, 0.75);
  const ds = Math.min(d.s, rround(S, c.dStr * rf() * k * (m.d || 1))), dO = Math.round(c.dOrg * of() * k * (m.d || 1));
  const as = Math.min(a.s, rround(S, c.aStr * rf() / k * (m.a || 1))), aO = Math.round(c.aOrg * of() / k * (m.a || 1));
  const ao0 = a.o, do0 = d.o;
  a.s -= as, (a.o = Math.max(0, a.o - aO)), (d.s -= ds), (d.o = Math.max(0, d.o - dO));
  a.at = 1, (a.e = 0), (a.mvd = 1), (a.x += 1), (d.x += 1);
  lose(S, a.n, as), lose(S, d.n, ds);
  // в донесении — фактические потери организации (не больше, чем было)
  const rep = { t: S.t, a: a.n, d: d.n, T: Ti, src, au: a.id, du: d.id, at: a.t, dt: d.t, an: a.nm, dn: d.nm, aS: as, aO: Math.round(ao0 - a.o), dS: ds, dO: Math.round(do0 - d.o), R: c.R, out: `hold`, win: false, art, amph: !!o.amph };
  if (d.s <= 0) (rep.out = `destroyed`), (a.x += 2), kill(S, d), S.nat[a.n] && (S.nat[a.n].kills = (S.nat[a.n].kills || 0) + 1);
  else if (d.o <= 0 && !art) {
    const j = retreatTo(S, d, src);
    if (!j) (rep.out = `surrender`), (a.x += 2), lose(S, d.n, d.s), kill(S, d), S.nat[a.n] && (S.nat[a.n].kills = (S.nat[a.n].kills || 0) + 1);
    else {
      rep.out = `retreat`, (rep.to = j);
      d.r = j, (d.e = 0), (d.mv = 0), (d.s -= 1), lose(S, d.n, 1), touch(S);
      d.s <= 0 && ((rep.out = `destroyed`), kill(S, d));
    }
  }
  if (a.s <= 0) (rep.aDead = 1), kill(S, a);
  const gone = rep.out !== `hold`;
  rep.win = gone;
  if (gone && !rep.aDead && !art && !o.noAdv) {
    a.r = Ti, (rep.adv = 1);
    capture(S, Ti, a.n);
    a.mv = BLITZ(a) && !o.amph ? Math.max(0, a.mv - 1) : 0;
    zocOf(S, a.n)[Ti] && (a.mv = 0);
    touch(S);
  } else if (!rep.aDead) a.mv = 0;
  S.bat.push(rep);
  fx(S, { k: `atk`, rep });
  touch(S);
  return rep;
}
// ——— авиация: пул вылетов державы ———
export function airRange(S, n) {
  const key = `${S._ver}|${S.t}|${n}`;
  S._ar = S._ar || {};
  if (S._ar[n]?.key === key) return S._ar[n].a;
  const a = new Uint8Array(G.R.length + 1), sup = supply(S, n);
  for (const R of G.R) if (S.ctrl[R.i] && ally(S, S.ctrl[R.i], n) && sup[R.i] >= 0) for (const [j, k] of R.near) k <= 3 && (a[j] = 1);
  S._ar[n] = { key, a };
  return a;
}
export function canAir(S, n, Ti) {
  const d = unitAt(S, Ti), nat = S.nat[n];
  return !!d && nat && (nat.air || 0) > 0 && atWar(S, n, d.n) && (d.ah || 0) < 2 && !!airRange(S, n)[Ti];
}
export function airEst(S, n, Ti) {
  const d = unitAt(S, Ti), T = reg(Ti), W = weather(S, T, n), t = S.nat[n].tech || {};
  const mine = S.nat[n].airMax || 0, en = S.nat[d.n]?.airMax || 0, ki = clamp(0.45 + 0.55 * (mine + 1) / (mine + en + 1), 0.45, 1);
  const p = (T.t === `fo` || T.t === `mo` || T.city || T.cap ? 0.35 : 0.6) * W.air * ki * (1 + 0.08 * (t.air || 0));
  const org = 20 * W.air * ki * (1 + 0.1 * (t.air || 0));
  return { p: clamp(p, 0.05, 0.9), org, W, ki };
}
export function airStrike(S, n, Ti) {
  if (!canAir(S, n, Ti)) return null;
  const d = unitAt(S, Ti), e = airEst(S, n, Ti);
  S.nat[n].air--;
  d.ah = (d.ah || 0) + 1;
  const dS = rnd(S) < e.p ? 1 : 0, dO = Math.round(e.org * (0.75 + 0.5 * rnd(S)));
  const o0 = d.o;
  d.s -= dS, (d.o = Math.max(0, d.o - dO)), lose(S, d.n, dS);
  const rep = { t: S.t, a: n, d: d.n, T: Ti, air: 1, dS, dO: Math.round(o0 - d.o), du: d.id, dn: d.nm, out: `hold` };
  d.s <= 0 && ((rep.out = `destroyed`), kill(S, d));
  S.bat.push(rep);
  fx(S, { k: `air`, rep });
  touch(S);
  return rep;
}
// ——— перемещения ———
export function mvOf(S, u) {
  const W = weather(S, reg(u.r), u.n);
  let m = UT[u.t].mv;
  (MECH(u) || u.t === `cav`) && W.mv && (m = Math.max(1, m - W.mv));
  MECH(u) && S.nat[u.n].oil <= 0 && (m = 1);
  return m;
}
const stepCost = (u, b) => ((MECH(u) || u.t === `art`) && (reg(b).t === `mo` || reg(b).t === `ma`) ? 2 : 1);
// Куда может пойти дивизия: Map провинция → {k: move|capture, cost, path}
export function moves(S, u) {
  const out = new Map();
  if (u.fr || u.mv <= 0) return out;
  const n = u.n, z = zocOf(S, n), best = new Map([[u.r, { c: 0, p: null }]]), q = [u.r];
  for (let qi = 0; qi < q.length; qi++) {
    const a = q[qi], ca = best.get(a).c;
    for (const b of reg(a).nb) {
      const sc = stepCost(u, b), nc = ca + sc;
      if (nc > u.mv && !(ca === 0 && sc > u.mv)) continue;
      const cost = Math.min(nc, u.mv);
      if (best.has(b) && best.get(b).c <= cost) continue;
      const v = unitAt(S, b);
      if (friendly(S, b, n)) {
        if (v && !ally(S, v.n, n)) continue;
        best.set(b, { c: cost, p: a });
        if (!v) out.set(b, { r: b, k: `move`, cost });
        // дальше — только если не в зоне контроля противника
        !z[b] && cost < u.mv && q.push(b);
      } else if (hostile(S, b, n) && !v) {
        best.set(b, { c: cost, p: a });
        out.set(b, { r: b, k: `capture`, cost });
      }
    }
  }
  // путь для анимации
  for (const m of out.values()) {
    const p = [m.r];
    let c = best.get(m.r)?.p;
    while (c) p.unshift(c), (c = best.get(c)?.p);
    m.path = p;
  }
  return out;
}
// Цели атаки: соседние враги; артиллерия — до 2 провинций; десант — через морскую связь
export function attackTargets(S, u) {
  const out = new Map();
  if (u.fr || u.at || u.o < orgMax(S, u.n) * 0.1 || u.s < 1) return out;
  const n = u.n, R = reg(u.r);
  const list = u.t === `art` ? R.d2 : R.nb;
  for (const j of list) {
    const v = unitAt(S, j);
    v && atWar(S, v.n, n) && out.set(j, { r: j, k: u.t === `art` ? `bomb` : `attack` });
  }
  if (u.t !== `art` && u.mv >= mvOf(S, u) && (S.nat[n].navl || 0) > 0) {
    const zs = navZones(S, n);
    for (const [b, zn] of R.sea2) {
      if (out.has(b) || (!zs.includes(zn) && !(zn === `nor` && S.nat[n].sealion))) continue;
      const v = unitAt(S, b);
      v && atWar(S, v.n, n) && out.set(b, { r: b, k: `amph` });
    }
  }
  return out;
}
// Высадка в пустую вражескую провинцию через морскую связь
export function amphTargets(S, u) {
  const out = [];
  if (u.fr || u.at || u.t === `art` || u.mv < mvOf(S, u) || (S.nat[u.n].navl || 0) <= 0) return out;
  const zs = navZones(S, u.n);
  for (const [b, zn] of reg(u.r).sea2) {
    if (!zs.includes(zn) && !(zn === `nor` && S.nat[u.n].sealion)) continue;
    !unitAt(S, b) && hostile(S, b, u.n) && out.push(b);
  }
  return out;
}
export function moveTo(S, u, j, m) {
  const k = m?.k || `move`;
  fx(S, { k: k === `amphcap` ? `sea` : `mv`, id: u.id, n: u.n, from: u.r, to: j, path: m?.path });
  u.r = j;
  u.mv = Math.max(0, u.mv - (m?.cost ?? 1));
  u.e = 0, (u.mvd = 1);
  if (k === `capture` || k === `amphcap`) {
    capture(S, j, u.n);
    !BLITZ(u) && (u.mv = 0);
    k === `amphcap` && ((u.mv = 0), (u.at = 1), S.nat[u.n].navl--);
  }
  zocOf(S, u.n)[j] && (u.mv = 0);
  touch(S);
}
// Переброска по железной дороге: по своим снабжаемым провинциям в любую свободную
export const RAIL = { GER: 4, SOV: 5, UK: 2, USA: 2, FRA: 3, ITA: 2, POL: 1, _: 1 };
export function railTargets(S, u) {
  const n = u.n, nat = S.nat[n], sup = supply(S, n), z = zocOf(S, n);
  if (u.fr || u.mv < mvOf(S, u) || u.at || (nat.rail || 0) <= 0 || sup[u.r] < 0 || z[u.r]) return [];
  const seen = new Set([u.r]), q = [u.r], out = [];
  for (let k = 0; k < q.length; k++)
    for (const b of reg(q[k]).nb) {
      if (seen.has(b)) continue;
      seen.add(b);
      if (!friendly(S, b, n) || sup[b] < 0 || coopBlock(S, b, n)) continue;
      q.push(b);
      !reg(u.r).nb.includes(b) && !unitAt(S, b) && out.push(b);
    }
  return out;
}
const coopBlock = (S, b, n) => S.ctrl[b] !== n && !ally(S, S.ctrl[b], n);
export function railMove(S, u, j) {
  fx(S, { k: `rail`, id: u.id, n: u.n, from: u.r, to: j });
  S.nat[u.n].rail--;
  u.r = j, (u.mv = 0), (u.o = Math.max(0, u.o - 10)), (u.e = 0), (u.at = 1), (u.mvd = 1);
  touch(S);
}
// Морская переброска между своими портами
export const NAVCAP = { UK: 3, USA: 3, GER: 1, ITA: 2, SOV: 1, FRA: 1, _: 0 };
export function seaTargets(S, u) {
  const n = u.n, nat = S.nat[n], R = reg(u.r), zs = navZones(S, n);
  if (u.fr || u.mv < mvOf(S, u) || u.at || (nat.navl || 0) <= 0 || !R.sea.some((z) => zs.includes(z))) return [];
  const mz = MARITIME.has(n) ? zs : R.sea.filter((z) => zs.includes(z));
  const out = [];
  for (const T of G.R) {
    if (T.i === u.r || !T.sea.some((z) => mz.includes(z))) continue;
    friendly(S, T.i, n) && !unitAt(S, T.i) && out.push(T.i);
  }
  return out;
}
export function seaMove(S, u, j) {
  fx(S, { k: `sea`, id: u.id, n: u.n, from: u.r, to: j });
  S.nat[u.n].navl--;
  u.r = j, (u.mv = 0), (u.o = Math.max(0, u.o - 15)), (u.e = 0), (u.at = 1), (u.mvd = 1);
  touch(S);
}
// ——— экономика ———
export const TECH = {
  inf: { n: `Пехота`, d: `атака и оборона пехоты, кавалерии и артиллерии +7 % за уровень` },
  arm: { n: `Бронетехника`, d: `танки и мотопехота +9 % за уровень` },
  air: { n: `Авиация`, d: `авиаудары сильнее на 10 % за уровень` },
  ind: { n: `Промышленность`, d: `производство +6 %, синтетическое топливо` },
};
export const techCost = (lv) => 25 + lv * 20;
export const techYear = (lv) => 1938 + lv;
// Доход державы за ход
export function income(S, n) {
  const nat = S.nat[n], o = { pp: 0, oil: 0, mp: 0 };
  if (!alive(S, n)) return o;
  const sup = supply(S, n);
  for (const R of G.R) {
    if (S.ctrl[R.i] !== n) continue;
    // оккупированное: 40%, советская земля — 25% (выжженная земля, партизаны)
    const k = S.core[R.i] === n ? 1 : S.core[R.i] === `SOV` ? 0.25 : 0.4, ks = sup[R.i] >= 0 ? 1 : 0.3;
    o.pp += (R.ic + (S.icAdd[R.i] || 0) + R.st * 0.3) * k * ks;
    o.oil += R.oil * k * ks;
    o.mp += R.mp * (S.core[R.i] === n ? 1 : 0.15);
  }
  const t = nat.tech || {};
  o.pp *= (nat.eco || 1) * (1 + 0.06 * (t.ind || 0));
  o.pp += nat.imp?.pp || 0;
  o.oil += (nat.imp?.oil || 0) + (n === `GER` ? t.ind || 0 : 0);
  o.mp = o.mp * (nat.mpk || 1) + (nat.imp?.mp || 0);
  return o;
}
// Расход топлива: техника и авиация
export function upkeep(S, n) {
  let oil = (S.nat[n].airMax || 0) * 0.4;
  for (const u of S.units) u.n === n && (oil += UT[u.t].oil * u.s / 10);
  return oil;
}
const canPay = (nat, c, k = 1) => nat.pp >= c.pp * k && nat.mp >= c.mp * k && (!c.oil || nat.oil >= c.oil * k);
const pay = (nat, c, k = 1) => ((nat.pp -= c.pp * k), (nat.mp -= c.mp * k), (nat.oil -= (c.oil || 0) * k));
// стоимость дивизии растёт с числом сформированных за кампанию (как в операциях)
export const buildCost = (S, n, t) => {
  const c = UT[t].cost, k = 1 + 0.004 * (S.nat[n].built || 0);
  return { pp: Math.round(c.pp * k), mp: c.mp, oil: c.oil };
};
// Где можно формировать: своя исконная провинция без войск, со снабжением; танки и мотопехота — только в промышленных
// Где можно формировать: своя исконная провинция без войск, со снабжением; танки и мотопехота — только в промышленных.
// США и Британия (nat.arrive) — ещё и в портах прибытия на союзной земле; США (nat.ports) — в любом союзном порту
// своих морских зон, удерживаемом не меньше 2 ходов (Северная Африка, Италия, Франция).
export function buildSite(S, n, i, t) {
  const R = reg(i), nat = S.nat[n];
  if (!R || unitAt(S, i) || !inSup(S, n, i)) return false;
  if (S.ctrl[i] === n && S.core[i] === n) return !(t && MECH({ t }) && R.ic + (S.icAdd[i] || 0) < 2 && !R.cap);
  if (!friendly(S, i, n)) return false;
  if (nat.arrive?.includes(R.k)) return true;
  return !!nat.ports && R.sea.length > 0 && navZones(S, n).some((z) => R.sea.includes(z)) && S.t - (S.held[i] ?? -99) >= 2;
}
export function canBuild(S, n, t, i) {
  return buildSite(S, n, i, t) && canPay(S.nat[n], buildCost(S, n, t));
}
export function build(S, n, t, i, o = {}) {
  if (!canBuild(S, n, t, i)) return null;
  const nat = S.nat[n];
  pay(nat, buildCost(S, n, t));
  nat.built = (nat.built || 0) + 1;
  const u = spawn(S, n, t, i, MECH({ t }) ? 8 : 10, { o: orgMax(S, n) * 0.4, fr: 1 });
  fx(S, { k: `new`, id: u.id, n, to: i });
  o.log !== false && S.log.push({ t: S.t, n, k: `new`, txt: `${NATIONS[n].n}: сформирована ${u.nm} (${reg(i).n})` });
  return u;
}
export const canBuyAir = (S, n) => (S.nat[n].airMax || 0) < AIR.max && canPay(S.nat[n], AIR.cost);
export function buyAir(S, n) {
  if (!canBuyAir(S, n)) return false;
  const nat = S.nat[n];
  pay(nat, AIR.cost);
  nat.airMax = (nat.airMax || 0) + 1;
  nat.air = (nat.air || 0) + 0;
  return true;
}
// Пополнение дивизии (+3 силы) — занимает весь ход дивизии
export const reCost = (u, k) => ({ pp: UT[u.t].re.pp * k, mp: UT[u.t].re.mp * k, oil: UT[u.t].re.oil * k });
export function canReinforce(S, u) {
  if (u.fr || u.at || u.mvd || u.mv < mvOf(S, u) || u.s >= MAXS || !inSup(S, u.n, u.r)) return 0;
  const k = Math.min(3, MAXS - u.s);
  return canPay(S.nat[u.n], reCost(u, k)) ? k : 0;
}
export function reinforce(S, u) {
  const k = canReinforce(S, u);
  if (!k) return 0;
  pay(S.nat[u.n], reCost(u, k));
  u.s += k, (u.mv = 0), (u.at = 1), (u.x = Math.max(0, u.x - k)), (u.o = Math.max(0, u.o - 5));
  touch(S);
  return k;
}
// Конец хода державы: доход, автоматическое пополнение отдыхавших дивизий, наука
export function economy(S, n) {
  const nat = S.nat[n];
  if (!alive(S, n)) return;
  const inc = income(S, n);
  nat.inc = inc;
  nat.pp += inc.pp, (nat.oil += inc.oil - upkeep(S, n)), (nat.mp += inc.mp);
  nat.oil = Math.max(-5, nat.oil);
  const rp = Math.max(0, inc.pp) * 0.12;
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
  // отдыхавшие дивизии со снабжением пополняются на 1 (ИИ — в пределах доли бюджета)
  let budget = n === S.player ? (nat.autoRe === false ? 0 : 1e9) : Math.max(0, nat.pp) * (nat.reinf ?? 0.6);
  const sup = supply(S, n);
  const list = S.units.filter((u) => u.n === n && u.s < MAXS && !u.at && !u.mvd && sup[u.r] >= 0).sort((a, b) => a.s - b.s);
  for (const u of list) {
    const c = reCost(u, 1);
    if (!canPay(nat, c) || c.pp > budget) continue;
    pay(nat, c), (budget -= c.pp);
    u.s += 1, (u.x = Math.max(0, u.x - 0.5));
  }
}
// ——— начало хода державы: ходы, организация, снабжение, окопы ———
export function refresh(S, n) {
  const nat = S.nat[n];
  nat.rail = RAIL[n] ?? RAIL._;
  nat.navl = NAVCAP[n] ?? NAVCAP._;
  nat.air = nat.airMax || 0;
  const sup = supply(S, n), om = orgMax(S, n);
  for (const u of S.units) {
    if (u.n !== n) continue;
    const fought = u.at, rested = !u.mvd && !u.at;
    u.fr = 0, (u.at = 0), (u.ah = 0);
    u.mv = mvOf(S, u);
    if (sup[u.r] < 0) {
      u.oos = (u.oos || 0) + 1;
      u.o = Math.max(0, u.o - 25);
      u.oos > 1 && (u.s -= 1);
    } else {
      u.oos = 0;
      u.o = Math.min(om, u.o + (fought ? 15 : 30));
      rested && (u.e = Math.min(2, (u.e || 0) + 1));
    }
    u.mvd = 0;
    u.xa = 0;
  }
  for (const u of [...S.units]) u.n === n && u.s <= 0 && kill(S, u);
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
export const totalStr = (S, n) => S.units.reduce((s, u) => s + (u.n === n ? u.s : 0), 0);
