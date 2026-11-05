// «Мировой фронт» v0.11 (отзыв 04.11): фронты по направлениям — у каждой стороны пять постоянных фронтов
// (Финский, Северный, Центральный, Южный, Кавказский = полосы карты M.reg[r].z). Здесь: главные генералы,
// сводка фронта (дивизии, штат, снабжение, силы, небо, потери), доли авиации по фронтам, переброска дивизий
// между фронтами (по железной дороге, 1–2 недели в пути) и просьбы командующих («нужны подкрепления» и т. п.).
import * as E from './engine.js';
import { other, quality, turnOf, wT } from './rules.js';
import { ALLG } from '../war/gens41.js';
import { GEN_UNTIL } from './hist.js';
import { eqTot } from './eco.js';

export const FRONT_DIR = ['Финский фронт', 'Северный фронт', 'Центральный фронт', 'Южный фронт', 'Кавказский фронт'];
// подпись: как назывались фронты (группы армий) на этом направлении
export const FRONT_HIST = {
  SOV: ['Северный, Карельский', 'Северо-Западный, Ленинградский', 'Западный, Белорусские', 'Юго-Западный, Украинские', 'Южный, Закавказский'],
  GER: ['Финская армия, армия «Норвегия»', 'Группа армий «Север»', 'Группа армий «Центр»', 'Группа армий «Юг»', 'Группа армий «А»'],
};
// главные генералы: короткий список для назначения (по истории фронты получают своих командующих сами)
export const KEYG = {
  SOV: ['zhukov', 'vasilevsky', 'rokossovsky', 'konev', 'vatutin', 'malinovsky', 'tolbukhin', 'govorov', 'meretskov', 'yeremenko', 'chernyakhovsky', 'bagramyan', 'petrov_i', 'timoshenko', 'voroshilov', 'budyonny'],
  GER: ['manstein', 'guderian', 'model', 'bock', 'rundstedt', 'leeb', 'kluge', 'kleist', 'kuchler', 'weichs', 'schorner', 'heinrici', 'mannerheim', 'dietl'],
};
export const genAvail = (S, k) => { const g = ALLG[k]; return !!g && turnOf(g.from) <= Math.max(0, S.turn) && !(GEN_UNTIL[k] && turnOf(GEN_UNTIL[k]) <= S.turn); };
// кого можно назначить на фронт z: главные и уже командующие (финны — только на Финский фронт)
export function genPool(S, P, z = -1) {
  const ks = new Set(KEYG[P]);
  for (let f = 0; f < E.ZN; f++) if (S.gen[P][f]) ks.add(S.gen[P][f]);
  return [...ks].filter((k) => genAvail(S, k) && (z < 0 || z === 0 || ALLG[k].nat !== 'FIN')).map((k) => ALLG[k])
    .sort((a, b) => b.sk - a.sk || a.sh.localeCompare(b.sh, 'ru'));
}
// ——— сводка фронта ———
export function frontSum(S, side, z) {
  const M = S.M, o = { n: 0, str: 0, sup: 0, line: 0, pocket: 0, nE: 0, regs: 0, contact: 0, by: {}, transit: 0, a: 0, d: 0, ea: 0, ed: 0 };
  for (const u of S.units) {
    if (u.dead) continue;
    if (u.r < 0) { if (u.s === side && u.arr !== undefined && u.zf === z) o.transit++; continue; }
    if (M.reg[u.r].z !== z) continue;
    if (u.s === side) {
      const s = S.sup[side][u.r];
      o.n++; o.str += u.str; o.sup += Math.max(0, Math.min(1, s)); o.by[u.t] = (o.by[u.t] || 0) + 1;
      if (s <= 0) o.pocket++;
      if (E.isFront(S, u.r, side)) o.line++;
      o.a += E.baseCV(S, u, 'att'); o.d += E.baseCV(S, u, 'def');
    } else { o.nE++; o.ea += E.baseCV(S, u, 'att'); o.ed += E.baseCV(S, u, 'def'); }
  }
  for (let r = 0; r < M.R; r++) if (M.reg[r].z === z && E.sideOf(S, r) === side) { o.regs++; if (E.isFront(S, r, side)) o.contact++; }
  if (o.n) { o.str /= o.n; o.sup /= o.n; }
  o.k = o.ea / Math.max(1, o.d); // натиск врага: его атака против нашей обороны
  o.adv = o.a / Math.max(1, o.ed); // наш перевес в наступлении
  o.ar = E.airRatio(S, side, z);
  o.q = quality(side, S.turn);
  o.L = S.fst?.[side]?.[z] || null; o.LE = S.fst?.[other(side)]?.[z] || null;
  return o;
}
// ——— авиация по фронтам ———
export function airShares(S, side) {
  const w = (side === S.side && S.airS?.[side]) || E.airAuto(S, side), t = w.reduce((a, b) => a + Math.max(0, b), 0) || 1;
  return w.slice(0, E.ZN).map((x) => Math.max(0, x) / t);
}
const airRe = (S) => { S.airA = E.bySide(S, (sd) => E.airAlloc(S, sd)); };
// доля фронта ±5 % (остальные — пропорционально), авто выключается
export function airShift(S, side, z, dir) {
  const cur = airShares(S, side), v = Math.max(0, Math.min(0.9, cur[z] + 0.05 * dir)), rest = 1 - cur[z];
  (S.airS ??= {})[side] = cur.map((x, i) => (i === z ? v : rest > 1e-6 ? (x / rest) * (1 - v) : (1 - v) / (E.ZN - 1)));
  airRe(S);
}
export function airAutoSet(S, side, on) { (S.airS ??= {})[side] = on ? null : airShares(S, side); airRe(S); }
export const planes = (S, side, sh) => Math.round((S.air[side] * sh * 30) / 10) * 10; // ≈ боеспособных самолётов
// ——— переброска дивизий между фронтами ———
export const trWeeks = (S, u, f) => (Math.abs(S.M.reg[u.r].z - f) >= 2 ? 2 : 1); // недель в пути
export const trTurns = (S, u, f) => wT(trWeeks(S, u, f)); // ходов в пути
export function trWhy(S, u, f) {
  if (!E.alive(u)) return 'дивизии нет';
  if (S.M.reg[u.r].z === f) return 'уже на этом фронте';
  if (S.sup[u.s][u.r] <= 0) return 'в окружении';
  if (u.att || u.mv) return 'уже действовала в этот ход';
  if (u.nat === 'FIN' && f !== 0) return 'финны воюют только у себя';
  if ((S.railCap[u.s] || 0) <= 0) return 'дороги заняты: в этот ход — всё';
  return '';
}
export function transfer(S, u, f) {
  if (trWhy(S, u, f)) return false;
  const w = trTurns(S, u, f), l = S.at[u.r];
  l.splice(l.indexOf(u), 1);
  u.r = -1; u.arr = S.turn + w; u.z = f; u.zf = f; u.at = -1; u.tr = 1; u.ent = 0;
  u.rdy = Math.max(0, u.rdy - 10);
  S.railCap[u.s]--;
  return true;
}
// кого отдать фронту z: с фронтов без натиска, сначала из тыла, полные
export function spareFor(S, side, z, n = 3) {
  const fs = [];
  for (let f = 0; f < E.ZN; f++) fs[f] = frontSum(S, side, f);
  const kz = fs[z].k, c = [];
  for (const u of S.units) {
    if (!E.alive(u) || u.s !== side || u.t === 'sec') continue;
    const f = S.M.reg[u.r].z, F = fs[f];
    // отдают фронты, где натиск заметно слабее (или нет соприкосновения)
    if (f === z || (F.contact && F.k > 0.8 * kz) || trWhy(S, u, z)) continue;
    c.push([u, (E.isFront(S, u.r, side) ? 0 : 50) + u.str * 0.5 - F.k * 40 + (u.t === 'arm' || u.t === 'mot' ? 8 : 0)]);
  }
  return c.sort((a, b) => b[1] - a[1]).slice(0, n).map((x) => x[0]);
}
// ——— просьбы командующих ———
export const REQ = {
  men: { ic: 'helmet', t: 'Нужны подкрепления', b: 'Перебросить дивизии' },
  ammo: { ic: 'ammo', t: 'Нужны боеприпасы', b: 'Приоритет снабжения', pol: 10 },
  air: { ic: 'air', t: 'Нужна авиация', b: '+10 % авиации' },
  ret: { ic: 'ret', t: 'Разрешите отход', b: 'Разрешить отход' },
  atk: { ic: 'atk', t: 'Разрешите наступать', b: 'Разрешить' },
};
const x1 = (v) => v.toFixed(1).replace('.', ',');
// просьбы всех фронтов стороны (по сводкам fs[z]): подкрепления — где натиск заметно выше, чем на других фронтах;
// авиация — где небо хуже всего; боеприпасы — при плохом подвозе или пустых складах; отход и наступление — при своих приказах
export function frontReqs(S, side, fs = [...Array(E.ZN).keys()].map((z) => frontSum(S, side, z))) {
  if (S.peace) return new Array(E.ZN).fill(null); // мирное время: просьб нет
  const hi = side === 'SOV' ? 'Товарищ Верховный' : 'Мой фюрер', en = side === 'SOV' ? 'немецкая' : 'советская';
  const live = fs.map((o, z) => z).filter((z) => fs[z].contact && fs[z].n && fs[z].nE >= 2), out = new Array(E.ZN).fill(null);
  const mean = (z) => { const o = live.filter((q) => q !== z); return o.length ? o.reduce((a, q) => a + fs[q].k, 0) / o.length : 1; };
  const airW = live.slice().sort((a, b) => fs[a].ar - fs[b].ar)[0], ash = airShares(S, side);
  for (const z of live) {
    if ((S.reqNo?.[side]?.[z] ?? -99) > S.turn) continue;
    const o = fs[z], own = !S.pauto?.[z] || side !== S.side, post = S.post[side][z];
    if (own && o.k > 3 && o.str < 50 && post !== 'ret') out[z] = { k: 'ret', txt: `${hi}, фронт не удержать: противник сильнее в ${x1(o.k)} раза, дивизии обескровлены. Прошу разрешить отход.` };
    else if (o.k >= 1.5 && (o.L?.h || 0) >= 4 && (o.k >= 1.2 * mean(z) || o.k > 3.5)) out[z] = { k: 'men', txt: `${hi}, натиск противника здесь сильнее, чем на других фронтах (${x1(o.k)} : 1). Нужны подкрепления — хотя бы три дивизии.` };
    else if (S.fprio?.[side]?.z !== z && (o.sup < 0.6 || (eqTot(S, side) < 12 && o.str < 70))) out[z] = { k: 'ammo', txt: `${hi}, снабжение на пределе: снарядов и патронов — на несколько дней боёв. Прошу дать фронту приоритет.` };
    else if (z === airW && o.ar < 0.33 && ash[z] < 0.5) out[z] = { k: 'air', txt: `${hi}, в небе господствует ${en} авиация (наша доля — ${Math.round(o.ar * 100)} %). Прошу прикрыть фронт.` };
    else if (own && o.adv > 1.7 && o.nE >= 3 && post !== 'atk' && o.str > 65) out[z] = { k: 'atk', txt: `${hi}, перевес на нашей стороне (${x1(o.adv)} : 1). Разрешите перейти в наступление.` };
  }
  return out;
}
export const reqNo = (S, side, z, w = 3) => { ((S.reqNo ??= { GER: [], SOV: [] })[side] ??= [])[z] = S.turn + wT(w); }; // w — недель
// приоритет снабжения: пополнение и подвоз фронта — первыми (4 недели, ★; left — ходов)
export function prioSet(S, side, z) {
  const c = REQ.ammo.pol;
  if ((S.pol[side] || 0) < c) return false;
  S.pol[side] -= c;
  (S.fprio ??= {})[side] = { z, left: wT(4) };
  return true;
}
