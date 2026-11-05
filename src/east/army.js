// «Мировой фронт» v0.11 (отзыв 04.11): призыв игрока — выбор дивизий (род × число) → обучение (недели; в учебном лагере
// быстрее и опытнее) → «Резерв Ставки» (у Оси — «Резерв ОКХ») → отправка на фронт (1–2 недели по железной дороге).
// Можно сразу указать фронт или «авто» (туда, где натиск сильнее). Дивизии в обучении и в резерве — вне карты
// (u.r = −1): u.trn — ходов до конца обучения (v0.11.1: ход — 5 дней), u.res — в резерве; в пути на фронт — как переброска (u.arr, u.zf, u.tr).
// ИИ и «Генштаб сам формирует» набирают по-старому (recruit → сразу в тыл фронта).
import * as E from './engine.js';
import { TYPES, divW, wT } from './rules.js';
import { eqNeed } from './eco.js';
import { frontSum } from './fronts.js';

export const TRW = { inf: 2, mtn: 3, cav: 2, sec: 1, mot: 3, arm: 4, abn: 4 }; // недель обучения (в лагере — на 1 меньше)
export const resName = (side) => (side === 'SOV' ? 'Резерв Ставки' : 'Резерв ОКХ');
export const resIn = (side) => (side === 'SOV' ? 'в резерве Ставки' : 'в резерве ОКХ');
export const resTo = (side) => (side === 'SOV' ? 'в резерв Ставки' : 'в резерв ОКХ');
export const trainW = (t, camp) => Math.max(1, (TRW[t] ?? 2) - (camp ? 1 : 0)); // недель
export const trainT = (t, camp) => wT(trainW(t, camp)); // ходов
export const sendW = (f) => (f === 0 || f === 4 ? 2 : 1); // недель в пути
export const sendT = (f) => wT(sendW(f)); // ходов в пути
export const inTrain = (S, side) => S.units.filter((u) => !u.dead && u.s === side && u.trn > 0);
export const inRes = (S, side) => S.units.filter((u) => !u.dead && u.s === side && u.res);
// сколько дивизий рода t можно заказать сейчас (снаряжение, люди, предел армии)
export function canOrder(S, side, t) {
  const c = E.newCost(side, t), need = eqNeed(t, c.pp), q = S.eq[side];
  let n = Math.max(0, E.armyCap(S, side) - E.armySize(S, side));
  n = Math.min(n, Math.floor((S.men[side] + 1e-6) / Math.max(0.01, c.men)));
  for (const k in need) if (need[k] > 0) n = Math.min(n, Math.floor((q[k] + 1e-6) / need[k]));
  return Math.max(0, n);
}
// заказ: n дивизий рода t; camp — учебный лагерь (−1 — без лагеря); dst — после обучения: −1 резерв, −2 авто, 0…4 фронт
export function order(S, side, t, n, camp = -1, dst = -1) {
  const out = [], ord = (S.ordId = (S.ordId || 0) + 1), w = trainT(t, camp >= 0);
  for (let i = 0; i < n; i++) {
    const u = E.recruit(S, side, t, 2, { at: camp });
    if (!u) break;
    delete u.arr;
    u.trn = w; u.trn0 = w; u.ord = ord; u.dst = dst; u.at = camp;
    if (camp >= 0) u.camp = 1;
    out.push(u);
  }
  if (out.length) S.stats[side].made += out.length;
  return out;
}
// заказы в обучении: [{ord, t, n, left, tot, camp, dst, us}]
export function orders(S, side) {
  const m = new Map();
  for (const u of inTrain(S, side)) {
    let o = m.get(u.ord);
    if (!o) m.set(u.ord, (o = { ord: u.ord, t: u.t, n: 0, left: u.trn, tot: u.trn0 || u.trn, camp: u.camp ? u.at : -1, dst: u.dst ?? -1, us: [] }));
    o.n++; o.us.push(u);
  }
  return [...m.values()];
}
// отмена заказа: снаряжение и люди возвращаются
export function cancelOrder(S, side, ord) {
  let n = 0;
  for (const u of inTrain(S, side)) {
    if (u.ord !== ord) continue;
    const c = E.newCost(side, u.t), need = eqNeed(u.t, c.pp);
    for (const k in need) S.eq[side][k] += need[k];
    S.men[side] += c.men;
    u.dead = 1; delete u.trn;
    n++;
  }
  if (n) S.stats[side].made = Math.max(0, S.stats[side].made - n);
  return n;
}
// фронт, где нужнее: наибольший натиск противника (k = атака противника / наша оборона)
export function needFront(S, side) {
  let best = -1, bw = -1;
  for (let z = 0; z < E.ZN; z++) {
    const o = frontSum(S, side, z);
    if (!o.contact) continue;
    if (o.k > bw) (bw = o.k), (best = z);
  }
  return best >= 0 ? best : 2;
}
// отправка из резерва (или сразу после обучения) на фронт f
export function send(S, u, f) {
  if (u.dead || u.r >= 0 || u.trn > 0) return false;
  if (u.nat === 'FIN' && f !== 0) return false;
  delete u.res; delete u.camp;
  u.arr = S.turn + sendT(f); u.z = f; u.zf = f; u.at = -1; u.tr = 1;
  return true;
}
// ход обучения (endWeek, после смены хода): готовые — в резерв или сразу на фронт
export function trainWeek(S) {
  const done = new Map();
  for (const u of S.units) {
    if (u.dead || !(u.trn > 0)) continue;
    if (--u.trn > 0) continue;
    delete u.trn; delete u.trn0;
    // выучка: обучение (в лагере — лучше)
    u.xp = Math.max(u.xp, u.camp ? 18 : 10);
    u.rdy = Math.max(u.rdy, u.camp ? 85 : 75);
    const f = u.dst === -2 ? needFront(S, u.s) : u.dst ?? -1;
    delete u.dst; delete u.ord;
    if (!(f >= 0 && send(S, u, f))) { u.res = 1; delete u.camp; }
    const k = `${u.s}|${u.res ? -1 : f}`;
    if (!done.has(k)) done.set(k, []);
    done.get(k).push(u);
  }
  for (const [k, us] of done) {
    const [side, f] = k.split('|'), z = +f;
    if (side !== S.side) continue;
    const n = us.length, ty = [...new Set(us.map((u) => TYPES[u.t].sh))].join(', ');
    const one = n % 10 === 1 && n % 100 !== 11;
    E.note(S, { ic: 'helmet', side, txt: `${one ? 'Обучена' : 'Обучены'} ${n} ${divW(n)} (${ty}) — ${z >= 0 ? `${one ? 'отправлена' : 'отправлены'}: ${S.fr[side][z].n}` : resIn(side)}` });
  }
}
