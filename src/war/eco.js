// «Фронт 1941–1945» (v0.9): экономика без DOM. Промышленные очки (ПО) — от регионов src/europe/regions.js по
// фактическому контролю; эвакуация заводов на Урал; 5 линий производства с долями; людские резервы и раненые;
// автопополнение дивизий; формирование новых дивизий по штатам (вручную и авто); ленд-лиз; горючее; авиация.
import { REGIONS } from '../europe/regions.js';
import { yearF, dayOf, sideOfH, alive, isMech, diffK, placeAt, stackN, STACK, railOK, natIdx, fmtDate } from './rules.js';
import { SOV_LATER } from './plan.js';

const lerp = (T, x) => {
  if (x <= T[0][0]) return T[0][1];
  for (let i = 1; i < T.length; i++) if (x <= T[i][0]) return T[i - 1][1] + ((T[i][1] - T[i - 1][1]) * (x - T[i - 1][0])) / (T[i][0] - T[i - 1][0]);
  return T[T.length - 1][1];
};
export const LINES = [
  { k: 'men', n: 'Пехота', d: 'оружие и снаряжение для пополнений и новых дивизий' },
  { k: 'gun', n: 'Артиллерия', d: 'орудия и миномёты' },
  { k: 'tnk', n: 'Танки', d: 'танки и самоходные орудия' },
  { k: 'air', n: 'Авиация', d: 'самолёты — господство в воздухе' },
  { k: 'sup', n: 'Снабжение', d: 'боеприпасы и горючее на фронтовых складах' },
];
export const SHARE0 = { GER: { men: 0.2, gun: 0.22, tnk: 0.26, air: 0.2, sup: 0.12 }, SOV: { men: 0.26, gun: 0.24, tnk: 0.24, air: 0.16, sup: 0.1 } };
// рост производительности (военная экономика); доля Восточного фронта в выпуске Германии
const PROD = { GER: [[1941.4, 1.0], [1942.0, 1.05], [1942.5, 1.2], [1943.5, 1.6], [1944.5, 2.0], [1944.9, 1.6], [1945.3, 1.0]], SOV: [[1941.4, 1.0], [1942.0, 1.0], [1942.5, 1.35], [1943.5, 1.5], [1944.5, 1.6]] };
const EAST = [[1941.4, 0.6], [1942.5, 0.55], [1943.5, 0.47], [1944.5, 0.4], [1945.3, 0.45]];
const EAST_AIR = [[1941.4, 0.7], [1942.5, 0.6], [1943.5, 0.45], [1944.3, 0.33], [1945.3, 0.3]];
// выпуск на 1 ПО в сутки при доле линии 100 %
const RATE = { GER: { men: 520, gun: 2.4, tnk: 0.62, air: 1.4, sup: 10 }, SOV: { men: 820, gun: 11, tnk: 1.6, air: 2.6, sup: 10 } };
// люди на 1 очко людских ресурсов региона в сутки
const MPK = { SOV: [[1941.4, 700], [1942.0, 420], [1943.0, 230], [1944.0, 160], [1945.5, 130]], GER: [[1941.4, 30], [1941.9, 45], [1942.2, 85], [1943.0, 80], [1944.0, 66], [1945.0, 55]] };
const ALLY_MP = { ROM: 40, HUN: 50, FIN: 35, ITA: 10, SVK: 60 };
const AQ = { GER: [[1941.4, 2.2], [1942.5, 1.9], [1943.5, 1.6], [1944.5, 1.4], [1945.3, 1.2]], SOV: [[1941.4, 0.4], [1942.0, 0.6], [1942.8, 0.8], [1943.5, 1.0], [1944.5, 1.1]] };
// ленд-лиз в сутки (танки, самолёты, орудия) по годам; доли маршрутов
const LL = [[1941.75, 0, 0, 0], [1941.8, 1.2, 1.2, 1], [1942.0, 2.5, 3, 2], [1943.0, 3, 5, 2], [1944.0, 3.5, 5, 2], [1945.3, 2, 3, 1]];
// штаты новых дивизий: [ключ, сторона, тип, название, с даты, по дату, [люди, орудия, танки] или функция года]
export const TEMPLATES = [
  { k: 'sd', side: 'SOV', t: 'inf', n: 'Стрелковая дивизия', a: '1941-06-22', z: (y) => (y < 1942 ? [10000, 80, 0] : y < 1943 ? [9500, 120, 0] : y < 1944 ? [8500, 150, 0] : [8000, 170, 0]) },
  { k: 'kd', side: 'SOV', t: 'cav', n: 'Кавалерийская дивизия', a: '1941-07-01', b: '1942-12-31', z: () => [4500, 20, 0] },
  { k: 'tk', side: 'SOV', t: 'arm', n: 'Танковый корпус', a: '1942-04-01', z: (y) => (y < 1943 ? [9000, 60, 170] : y < 1944 ? [11000, 90, 200] : [12000, 100, 220]) },
  { k: 'mk', side: 'SOV', t: 'arm', n: 'Механизированный корпус', a: '1942-09-01', z: (y) => (y < 1944 ? [15000, 110, 190] : [16000, 130, 200]) },
  { k: 'pd', side: 'GER', t: 'inf', n: 'Пехотная дивизия', a: '1941-06-22', z: (y) => (y < 1943 ? [15000, 150, 0] : y < 1944.6 ? [12500, 130, 0] : [10000, 110, 0]) },
  { k: 'td', side: 'GER', t: 'arm', n: 'Танковая дивизия', a: '1941-06-22', z: (y) => (y < 1943 ? [14000, 110, 160] : [14500, 120, 150]) },
  { k: 'od', side: 'GER', t: 'sec', n: 'Охранная дивизия', a: '1941-06-22', b: '1943-12-31', z: () => [8000, 40, 0] },
];
export const tplOf = (k) => TEMPLATES.find((t) => t.k === k);
export const tplNow = (S, side) => TEMPLATES.filter((t) => t.side === side && S.day >= dayOf(t.a) && (!t.b || S.day <= dayOf(t.b)));

// ——— регионы ———
// предрасчёт: списки гексов регионов и «нация 1941 г.» (большинство гексов) — в M (один раз)
export function regionIndex(M) {
  if (M.rx) return M.rx;
  const n = REGIONS.length, hx = Array.from({ length: n }, () => []);
  for (let h = 0; h < M.N; h++) if (M.reg[h]) hx[M.reg[h] - 1].push(h);
  const nat0 = hx.map((a) => {
    const c = {};
    for (const h of a) c[M.own0[h]] = (c[M.own0[h]] || 0) + 1;
    let b = 0, bn = -1;
    for (const k in c) if (c[k] > bn) (bn = c[k]), (b = +k);
    return a.length ? M.nations[b] : '';
  });
  return (M.rx = { hx, nat0 });
}
// контроль регионов сторонами (большинство гексов)
export function regionCtl(S) {
  const { hx } = regionIndex(S.M), ctl = new Array(hx.length).fill(null);
  for (let r = 0; r < hx.length; r++) {
    if (!hx[r].length) continue;
    let g = 0, s = 0;
    for (const h of hx[r]) {
      const x = sideOfH(S, h);
      if (x === 'GER') g++;
      else if (x === 'SOV') s++;
    }
    ctl[r] = g > s && g * 2 >= hx[r].length * 0.5 ? 'GER' : s > g && s * 2 >= hx[r].length * 0.5 ? 'SOV' : null;
  }
  return ctl;
}
const ALLY = ['ROM', 'HUN', 'FIN', 'SVK', 'ITA', 'BUL', 'CRO'];
export function ipOf(S, side, ctl = S.rc) {
  const E = S.eco[side], { nat0 } = regionIndex(S.M), y = yearF(S.day);
  let home = 0, occ = 0;
  for (let r = 0; r < REGIONS.length; r++) {
    if (ctl[r] !== side) continue;
    const R = REGIONS[r], n0 = nat0[r];
    if (side === 'SOV') {
      if (n0 === 'SOV') {
        let f = 1 - (E.evd[r] || 0);
        if (E.lib[r] != null) f = Math.min(f, Math.min(0.85, 0.4 + (S.day - E.lib[r]) / 600));
        home += R.ic * f;
      } else occ += R.ic * 0.3;
    } else if (R.own === 'GER') home += R.ic * (E.bomb || 1);
    else if (ALLY.includes(n0) && S.nside[natIdx(S, n0)] === 'GER') home += R.ic * 0.5;
    else if (n0 === 'SOV') occ += R.ic * 0.15;
    else occ += R.ic * 0.35;
  }
  if (side === 'SOV') home += E.ural;
  const k = lerp(PROD[side], y) * (side === 'GER' ? lerp(EAST, y) * (S.ev?.fx?.GERprod || 1) : S.ev?.fx?.SOVprod || 1) * diffK(S, side, 'pr');
  return { ip: (home + occ) * k, home, occ };
}
function manpower(S, side, ctl) {
  const { nat0 } = regionIndex(S.M), E = S.eco[side], y = yearF(S.day);
  let m = 0;
  const nm = {};
  for (let r = 0; r < REGIONS.length; r++) {
    if (ctl[r] !== side) continue;
    const R = REGIONS[r], n0 = nat0[r];
    if (side === 'SOV') {
      if (n0 === 'SOV') m += R.mp * (E.lib[r] != null ? 0.6 : 1);
    } else if (R.own === 'GER') m += R.mp;
    else if (ALLY_MP[n0] && S.nside[natIdx(S, n0)] === 'GER') nm[n0] = (nm[n0] || 0) + R.mp * ALLY_MP[n0];
  }
  return { men: m * lerp(MPK[side], y) * diffK(S, side, 'pr') * (S.ev?.fx?.[side + 'mp'] || 1), nm };
}

// ——— состояние экономики ———
export function ecoInit(S) {
  const mk = (side) => ({
    side, ip: 0, home: 0, occ: 0, share: { ...SHARE0[side] }, auto: 1,
    men: side === 'SOV' ? 700000 : 60000, mpBank: 0, nm: { ROM: 8000, HUN: 4000, FIN: 6000, ITA: 2000, SVK: 1000 },
    gun: side === 'SOV' ? 8000 : 900, tnk: side === 'SOV' ? 700 : 150, air: side === 'SOV' ? 8000 : 2700, sup: side === 'SOV' ? 3500 : 6000, fuel: side === 'SOV' ? 9000 : 8000,
    wnd: [], ural: 0, evq: [], evd: {}, lib: {}, ll: { tnk: 0, air: 0, gun: 0 }, made: 0, lost: 0, num: side === 'SOV' ? { inf: 238, cav: 50, arm: 1, mk: 1, gds: 1, gdc: 1, gdt: 1 } : { inf: 302, arm: 25, sec: 201 },
    hist: [], out: { men: 0, gun: 0, tnk: 0, air: 0, sup: 0 }, mpIn: 0, llIn: { tnk: 0, air: 0 },
  });
  S.eco = { GER: mk('GER'), SOV: mk('SOV') };
  S.rc = regionCtl(S);
  for (const side of ['GER', 'SOV']) Object.assign(S.eco[side], ipOf(S, side));
  // удар по аэродромам 22 июня
  S.eco.SOV.air -= 1800;
  airShare(S);
}
export function airShare(S) {
  const y = yearF(S.day), g = S.eco.GER.air * lerp(AQ.GER, y), s = S.eco.SOV.air * lerp(AQ.SOV, y);
  S.air = { GER: g / (g + s + 1), SOV: s / (g + s + 1) };
}
// ленд-лиз: маршруты (Арктика — Мурманск/Архангельск, Персия — Баку/Тбилиси, Тихий океан и АЛСИБ)
export function llRoutes(S) {
  const own = (n) => sideOfH(S, S.M.cityHex(n)) === 'SOV';
  const arc = (own('Мурманск') || own('Архангельск')) && !(S.ev?.fx?.pq17 > S.day) ? 1 : 0;
  const per = own('Баку') && own('Тбилиси') && S.day >= dayOf('1942-01-01') ? 1 : 0;
  return { arc, per, k: 0.35 + arc * (S.ev?.fx?.llArc || 0.4) + per * 0.25 };
}

// ——— суточный цикл экономики ———
export function ecoDay(S, note) {
  const y = yearF(S.day), ctl = (S.rc = regionCtl(S));
  for (const side of ['GER', 'SOV']) {
    const E = S.eco[side], R = RATE[side];
    const o = ipOf(S, side, ctl);
    E.ip = o.ip;
    E.home = o.home;
    E.occ = o.occ;
    const sh = E.share, tot = Object.values(sh).reduce((a, b) => a + b, 0) || 1;
    const out = {};
    for (const k in R) out[k] = (E.ip * (sh[k] / tot) * R[k]);
    E.gun += out.gun;
    E.tnk += out.tnk;
    E.air += out.air * (side === 'GER' ? lerp(EAST_AIR, y) : 1);
    E.sup += out.sup;
    // люди: призыв (по регионам) ограничен выпуском снаряжения
    const mp = manpower(S, side, ctl);
    E.mpBank = Math.min(E.mpBank + mp.men, mp.men * 45 + 1);
    // 1941 г.: мобилизация (5,3 млн призваны в первую неделю) — снаряжение из мобзапасов
    const take = Math.min(E.mpBank, out.men * (side === 'SOV' && y < 1942 ? 2 : 1));
    E.men += take;
    E.mpBank -= take;
    E.mpIn = take;
    for (const n in mp.nm) E.nm[n] = (E.nm[n] || 0) + mp.nm[n];
    // раненые возвращаются в строй
    while (E.wnd.length && E.wnd[0][0] <= S.day) E.men += E.wnd.shift()[1];
    E.out = out;
    // авиация: потери в боевой работе
    E.air = Math.max(50, E.air * (1 - (side === 'SOV' && y < 1942 ? 0.012 : side === 'SOV' ? 0.01 : 0.007)) - S.today.fights * 0.15);
    // горючее
    const oil = oilOf(S, side, ctl);
    let use = 0;
    for (const u of S.units) if (u.side === side && alive(u) && isMech(u)) use += 1 + (u.fuelUse || 0) * 1.5, (u.fuelUse = 0);
    E.fuel = Math.min(E.fuel + oil - use, 20000);
    // склады: базовый расход и бои
    E.sup -= S.units.reduce((s, u) => s + (u.side === side && alive(u) ? 0.15 : 0), 0) + (S.today.atkN?.[side] || 0) * 3;
    E.sup = Math.min(E.sup, 30000);
    S.ev.fx[side + 'atk'] = (S.ev.fx[side + 'atkE'] || 1) * (E.sup < 0 ? 0.85 : 1);
  }
  // ленд-лиз
  if (S.day >= dayOf('1941-10-01') && !(S.ev.fx.noLL)) {
    const E = S.eco.SOV, r = llRoutes(S), row = LL.reduce((a, x) => (y >= x[0] ? x : a), LL[0]);
    const t = row[1] * r.k, a = row[2] * r.k, g = row[3] * r.k;
    E.tnk += t;
    E.air += a;
    E.gun += g;
    E.ll.tnk += t;
    E.ll.air += a;
    E.ll.gun += g;
    E.llIn = { tnk: t, air: a };
    E.fuel += 60 * r.k;
  }
  airShare(S);
  // эвакуация и восстановление заводов на Урале
  const ES = S.eco.SOV;
  while (ES.evq.length && ES.evq[0][0] <= S.day) {
    const [, ic, n] = ES.evq.shift();
    ES.ural += ic;
    note && note({ k: 'eco', side: 'SOV', t: `Эвакуированные заводы (${n}) дали продукцию на Урале` });
  }
  if (S.day % 3 === 0) evacCheck(S, note);
  // освобождённые регионы
  const { nat0 } = regionIndex(S.M);
  for (let r = 0; r < REGIONS.length; r++) {
    if (nat0[r] !== 'SOV') continue;
    if (ctl[r] === 'GER' && ES.lib[r] == null) ES.lib[r] = -1; // потерян: будет «освобождён»
    else if (ctl[r] === 'SOV' && ES.lib[r] === -1) ES.lib[r] = S.day;
  }
  // СССР в 1941–1942 гг.: сначала новые дивизии, потом пополнение
  const form = (side) => (S.eco[side].auto || side !== S.side) && autoForm(S, side, note);
  if (y < 1942.5) form('SOV');
  replenish(S, 'GER');
  replenish(S, 'SOV');
  form('GER');
  if (y >= 1942.5) form('SOV');
  if (S.day % 7 === 0) {
    guards(S, note);
    for (const side of ['GER', 'SOV']) {
      const E = S.eco[side];
      E.hist.push([S.day, Math.round(E.ip), Math.round(strength(S, side) / 1000), Math.round(S.loss[side] / 1000), Math.round(E.tnk), Math.round(S.air[side] * 100)]);
      if (E.hist.length > 220) E.hist.shift();
    }
  }
}
function oilOf(S, side, ctl) {
  const y = yearF(S.day);
  let o = 0;
  for (let r = 0; r < REGIONS.length; r++) if (ctl[r] === side) o += REGIONS[r].oil;
  if (side === 'GER') {
    const synth = 140 * (y < 1944.35 ? 1 : y < 1944.8 ? 0.45 : 0.2);
    return (o * 30 + synth) * lerp(EAST, y);
  }
  return o * 30 + 100;
}
// эвакуация: заводы региона уходят на восток, когда фронт подходит на 3 гекса
function evacCheck(S, note) {
  const E = S.eco.SOV, mode = S.ev.fx.evac;
  if (!mode) return;
  const { hx, nat0 } = regionIndex(S.M), fd = S.frontDist?.SOV;
  if (!fd) return;
  for (let r = 0; r < REGIONS.length; r++) {
    const R = REGIONS[r];
    if (nat0[r] !== 'SOV' || R.ic <= 0 || E.evd[r] != null || S.rc[r] !== 'SOV' || R.lon > 44) continue;
    let md = 999;
    for (const h of hx[r]) if (sideOfH(S, h) === 'SOV' && fd[h] < md) md = fd[h];
    if (md > 3) continue;
    const f = mode === 'full' ? 0.8 : 0.4;
    E.evd[r] = f;
    E.evq.push([S.day + 70, R.ic * f * 0.65, R.n]);
    E.evq.sort((a, b) => a[0] - b[0]);
    note && note({ k: 'eco', side: 'SOV', t: `Эвакуация: заводы региона «${R.n}» вывозятся на восток`, big: R.ic >= 3 });
  }
}
export const strength = (S, side) => S.units.reduce((s, u) => s + (u.side === side && alive(u) && !u.arr ? u.men : 0), 0);

// ——— пополнение: в снабжении, вне боя; в тылу — вдвое быстрее ———
function replenish(S, side) {
  const E = S.eco[side], L = S.supL?.[side], fd = S.frontDist?.[side];
  if (!L) return;
  const us = S.units.filter((u) => u.side === side && alive(u) && !u.arr && u.men < u.menM * 0.995).sort((a, b) => a.men / a.menM - b.men / b.menM);
  for (const u of us) {
    if (L[u.h] < 2 && !fortStock(S, u)) continue;
    const quiet = !u.at && !u.df, rear = fd && fd[u.h] >= 4;
    // СССР в 1941 г. формирует новые дивизии вместо пополнения старых; вермахту до весны 1942 г. не хватает маршевых пополнений
    const yy = yearF(S.day), r = (quiet ? (rear ? 0.06 : 0.03) : 0.012) * (side === 'SOV' && yy < 1942 ? 0.6 : side === 'GER' && yy < 1942.3 ? 0.4 : 1);
    const pool = u.nat === side || u.nat === 'GER' || u.nat === 'SOV' ? E : null;
    const need = Math.min(u.menM - u.men, Math.round(u.menM * r));
    let got = 0;
    if (pool) (got = Math.min(need, Math.max(0, E.men))), (E.men -= got);
    else (got = Math.min(need, Math.max(0, E.nm[u.nat] || 0))), (E.nm[u.nat] = (E.nm[u.nat] || 0) - got);
    u.men += got;
    const ng = Math.min(u.gunM - u.gun, Math.ceil(u.gunM * r), Math.max(0, Math.floor(E.gun)));
    u.gun += ng;
    E.gun -= ng;
    if (u.tnkM > 0) {
      const nt = Math.min(u.tnkM - u.tnk, Math.ceil(u.tnkM * r * 1.3), Math.max(0, Math.floor(E.tnk)));
      u.tnk += nt;
      E.tnk -= nt;
    }
  }
}
export function fortStock(S, u) {
  const ci = S.M.cityAt[u.h];
  return ci >= 0 && S.M.cities[ci].fort && S.fst[ci] > 0;
}

// ——— новые дивизии ———
let UID = 0;
export function mkUnit(S, o) {
  const id = o.id ?? (S.uid = (S.uid || 0) + 1);
  return {
    id, side: o.side, nat: o.nat, hq: o.hq || '', t: o.t, n: o.n, num: o.num ?? '', men: o.men, gun: o.gun, tnk: o.tnk, menM: o.menM ?? o.men, gunM: o.gunM ?? o.gun, tnkM: o.tnkM ?? o.tnk,
    org: o.org ?? 70, xp: o.xp ?? 10, ent: o.ent ?? 0, oos: 0, mp: 0, mv: 0, at: 0, ral: 0, h: -1, dead: 0, arr: o.arr ?? 0, gds: o.gds || 0, pm: 0, df: 0, born: S.day,
  };
}
// гекс тыла для новой дивизии: станция в сети в 4–12 гексах от фронта, ближе к точке base
export function rearSpot(S, side, base, minF = 4, maxF = 12) {
  const M = S.M, fd = S.frontDist?.[side], net = S.net?.[side];
  let best = -1, bs = 1e9;
  for (let h = 0; h < M.N; h++) {
    if (M.terr[h] < 2 || sideOfH(S, h) !== side || stackN(S, h) >= STACK) continue;
    const f = fd ? fd[h] : 9;
    if (f < minF) continue;
    let s = (base >= 0 ? M.dist(h, base) : 0) + Math.max(0, f - maxF) * 2;
    if (!(railOK(S, h, side) && net && net[h] >= 0)) s += 6;
    if (s < bs) (bs = s), (best = h);
  }
  return best;
}
export function armyDivs(S, k) {
  let n = 0, m = 0;
  for (const u of S.units) if (u.hq === k && alive(u)) (n++, isMech(u) && m++);
  return [n, m];
}
// к какой армии приписать дивизию: меньше дивизий на свой участок фронта
export function assignArmy(S, u) {
  const side = u.side, mech = isMech(u);
  const cnt = new Map();
  for (const x of S.units) if (x.side === side && alive(x) && x !== u) {
    const c = cnt.get(x.hq) || [0, 0];
    c[0]++;
    if (isMech(x)) c[1]++;
    cnt.set(x.hq, c);
  }
  let best = null, bs = 1e9;
  for (const A of Object.values(S.hqs)) {
    if (A.side !== side || A.lv < 2 || A.dead || A.arr || A.k === 's2b') continue;
    if (side === 'GER' && A.nat !== u.nat && !(A.nat === 'GER' && !aliveNatArmy(S, u.nat))) continue;
    const [n, m] = cnt.get(A.k) || [0, 0];
    if (n === 0 && !A.fresh) continue; // разбитые армии не пополняются (кроме новых)
    let s = n - (A.fr || 0) * 0.8;
    if (A.mech) s += mech ? -4 + m * 0.5 : n - m >= 2 ? 6 : 0;
    else if (mech && m >= 2) s += 2;
    if (A.fresh) s -= 3;
    if (s < bs) (bs = s), (best = A);
  }
  return best;
}
const aliveNatArmy = (S, nat) => Object.values(S.hqs).some((A) => A.nat === nat && A.lv >= 2 && !A.dead && !A.arr);
export function formDiv(S, side, key, note, quiet) {
  const T = tplOf(key), E = S.eco[side];
  if (!T || T.side !== side) return null;
  const [men, gun, tnk] = T.z(yearF(S.day));
  if (E.men < men || E.gun < gun || E.tnk < tnk) return null;
  const N = E.num, nat = side;
  let n, num;
  if (side === 'SOV') {
    if (T.t === 'inf') (num = String(N.inf++)), (n = `${num}-я сд`);
    else if (T.t === 'cav') (num = String(N.cav++)), (n = `${num}-я кд`);
    else if (key === 'tk') (num = String(N.arm++)), (n = `${num}-й тк`);
    else (num = String(N.mk++)), (n = `${num}-й мк`);
  } else if (T.t === 'inf') {
    num = String(N.inf++);
    n = yearF(S.day) >= 1944.6 ? `${num}-я нгд` : `${num}-я пд`;
  } else if (T.t === 'arm') {
    // сначала — воссоздать погибшую танковую дивизию
    const dead = S.units.find((x) => x.side === 'GER' && x.nat === 'GER' && x.t === 'arm' && x.dead && !x.reb);
    if (dead) (dead.reb = 1), (num = dead.num), (n = dead.n);
    else (num = String(N.arm++)), (n = `${num}-я тд`);
  } else (num = String(N.sec++)), (n = `${num}-я охранная дивизия`);
  const u = mkUnit(S, { side, nat, t: T.t, n, num, men, gun, tnk, org: side === 'SOV' ? 45 : 70, xp: side === 'SOV' ? 0 : 15 });
  let A = assignArmy(S, u);
  if (side === 'SOV') A = newArmyIfNeeded(S, A, u, note) || A;
  u.hq = A ? A.k : '';
  const base = A ? hqHex(S, A) : -1;
  const h = rearSpot(S, side, base);
  if (h < 0) return null;
  E.men -= men;
  E.gun -= gun;
  E.tnk -= tnk;
  E.made++;
  S.units.push(u);
  placeAt(S, u, h);
  u.ral = 1;
  if (A) A.fresh = 0;
  if (!quiet && note) note({ k: 'form', side, t: `Сформирована: ${n}${A ? ' — ' + A.n : ''}`, h });
  return u;
}
// центр армии: средняя точка её дивизий (или якорь)
export function hqHex(S, A) {
  let x = 0, y = 0, n = 0;
  for (const u of S.units) if (u.hq === A.k && alive(u) && !u.arr) {
    const [a, b] = S.M.xy(u.h);
    x += a;
    y += b;
    n++;
  }
  if (!n) return A.h ?? -1;
  return hexNear(S, x / n, y / n, A.side);
}
function hexNear(S, x, y, side) {
  const h = S.M.hexAt(x, y);
  if (h >= 0 && S.M.terr[h] >= 2 && sideOfH(S, h) === side) return h;
  const j = h >= 0 ? S.M.nearLand(h, (k) => sideOfH(S, k) === side) : -1;
  return j >= 0 ? j : h;
}
const CAP = (y) => (y < 1942 ? 9 : y < 1943 ? 10 : 11);
function newArmyIfNeeded(S, A, u, note) {
  const y = yearF(S.day);
  if (A && armyDivs(S, A.k)[0] < CAP(y)) return null;
  const q = SOV_LATER.find((x) => !S.hqs[x[0]] && S.day >= dayOf(x[5]));
  if (!q) return null;
  const [k, n, num, sub, gen, , mech, rn, gt] = q;
  let g = gen;
  for (const [d, x] of gt || []) if (dayOf(d) <= S.day) g = x;
  const H = (S.hqs[k] = { k, side: 'SOV', nat: 'SOV', lv: 2, up: 'stavka', ech: 'XXXX', n, num, sub, gen: g, gt: gt || [], rn: rn || [], off: [], mech: mech ? 1 : 0, order: 'auto', tgt: -1, als: [], fresh: 1, born: S.day, dead: 0, arr: 0 });
  // переименования, наступившие раньше формирования
  for (const r of H.rn) if (dayOf(r[0]) <= S.day) (H.n = r[1]), r[3] != null && (H.num = r[3]), r[4] != null && (H.sub = r[4]);
  S.regroupSoon = 1;
  note && note({ k: 'army', side: 'SOV', t: `Сформирована ${n} (командующий — ${S.G[H.gen]?.n || ''})`, big: 1 });
  return H;
}
// автоматическое формирование: СССР — массово, Германия — из излишков (и восстановление танковых дивизий)
function autoForm(S, side, note) {
  const E = S.eco[side], y = yearF(S.day), quiet = side !== S.side;
  let n = 0;
  if (side === 'SOV') {
    const lim = y < 1942 ? 4 : 2;
    while (n < lim) {
      let key = 'sd';
      if (y >= 1942.25 && E.tnk >= 320) key = y >= 1942.7 && E.made % 3 === 0 ? 'mk' : 'tk';
      else if (y < 1942 && E.made % 5 === 4) key = 'kd';
      const [men, gun] = tplOf(key).z(y);
      if (E.men < men + 25000 || E.gun < gun) break;
      if (!formDiv(S, side, key, note, quiet)) break;
      n++;
    }
  } else {
    if (E.tnk >= 260 && E.men >= 45000) formDiv(S, side, 'td', note, quiet);
    else if (E.men >= 70000 && E.gun >= 200) formDiv(S, side, 'pd', note, quiet);
  }
}
// гвардия: опытные советские дивизии получают гвардейское звание
function guards(S, note) {
  if (S.day < dayOf('1941-09-18')) return;
  const E = S.eco.SOV;
  let k = 0;
  const lim = yearF(S.day) < 1942 ? 2 : 4;
  for (const u of S.units) {
    if (k >= lim) break;
    if (u.side !== 'SOV' || !alive(u) || u.gds || u.xp < 55 || u.t === 'gar' || u.arr) continue;
    u.gds = 1;
    if (u.t === 'inf' || u.t === 'mtn') (u.num = String(E.num.gds++)), (u.n = `${u.num}-я гв. сд`);
    else if (u.t === 'cav') (u.num = String(E.num.gdc++)), (u.n = `${u.num}-й гв. кк`);
    else (u.num = String(E.num.gdt++)), (u.n = `${u.num}-й гв. ${/мк|мехкорпус/.test(u.n) ? 'мк' : 'тк'}`);
    u.menM = Math.round(u.menM * 1.08);
    u.org = Math.min(100, u.org + 10);
    k++;
    note && note({ k: 'gds', side: 'SOV', t: `Гвардия: ${u.n}`, h: u.h });
  }
}
