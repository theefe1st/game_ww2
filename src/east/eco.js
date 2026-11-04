// «Мировой фронт» v0.11: хозяйство «как в HoI4, только проще».
// Военные заводы (S.fac) дают ⚙ военное производство; оно делится между линиями (стрелковое оружие, артиллерия,
// танки, самолёты) по долям игрока, у каждой линии — эффективность (после переключения долей падает и неделями
// восстанавливается). Выпуск копится в запасах снаряжения S.eq; из них идут пополнение и новые дивизии
// (каждый род войск — своей смесью снаряжения, EQS). Самолёты — множитель к численности ВВС.
// Стройка — строительными бригадами (отзыв 04.11): очередь построек S.q, срок проекта — в неделях работы бригады.
import { TYPES, SIDE0, yearF, lerpT } from './rules.js';
import { tx } from './tech.js';
import { sideOf, isFront, note } from './engine.js';
import { decK } from './decisions.js';

export const EQK = ['inf', 'art', 'arm'];
export const LINES = ['inf', 'art', 'arm', 'air'];
export const LINE = {
  inf: { n: 'Стрелковое оружие', s: 'стрелк.', ic: 'rifle' },
  art: { n: 'Артиллерия', s: 'арт.', ic: 'art' },
  arm: { n: 'Танки', s: 'танки', ic: 'tank' },
  air: { n: 'Самолёты', s: 'авиа', ic: 'air' },
};
// смесь снаряжения по родам войск (доли стоимости TYPES[t].pp)
export const EQS = {
  inf: { inf: 0.65, art: 0.35 }, mtn: { inf: 0.7, art: 0.3 }, cav: { inf: 0.8, art: 0.2 }, sec: { inf: 0.9, art: 0.1 },
  mot: { inf: 0.35, art: 0.25, arm: 0.4 }, arm: { inf: 0.15, art: 0.15, arm: 0.7 }, abn: { inf: 0.8, art: 0.2 },
};
// состав новых дивизий ИИ по годам
export const MIX = {
  SOV: [[1941.4, { inf: 0.86, cav: 0.1, arm: 0.04 }], [1942.3, { inf: 0.78, cav: 0.06, arm: 0.12, mot: 0.04 }], [1943.2, { inf: 0.72, arm: 0.18, mot: 0.1 }], [1944.0, { inf: 0.7, arm: 0.2, mot: 0.1 }]],
  GER: [[1941.4, { inf: 0.8, arm: 0.12, mot: 0.08 }], [1943.0, { inf: 0.72, arm: 0.18, mot: 0.1 }], [1944.5, { inf: 0.82, arm: 0.12, mot: 0.06 }]],
};
export function mixNow(side, turn) { let m = MIX[side][0][1]; for (const [y, x] of MIX[side]) if (yearF(turn) >= y) m = x; return m; }
export const AIR_SH = 0.2; // «норма» доли самолётов: при ней ВВС как в истории
const E_NEW = 0.35, E_REC = 0.08;
export const effCap = () => 1; // предел эффективности линий (наука даёт +% к производству, см. tech.js)
export const eqTot = (S, side) => { const q = S.eq[side]; return q.inf + q.art + q.arm; };
export const eqNeed = (t, pp) => { const s = EQS[t] || EQS.inf, o = {}; for (const c in s) o[c] = pp * s[c]; return o; };
export function hasEq(S, side, t, pp) { const s = EQS[t] || EQS.inf, q = S.eq[side]; for (const c in s) if (q[c] + 1e-6 < pp * s[c]) return false; return true; }
export function payEq(S, side, t, pp) { const s = EQS[t] || EQS.inf, q = S.eq[side]; for (const c in s) q[c] = Math.max(0, q[c] - pp * s[c]); }
// желаемые доли линий: по составу армии (пополнение) и смеси новых дивизий, с поправкой на запасы
export function lineTarget(S, side, mix) {
  const d = { inf: 0, art: 0, arm: 0 }, m = { inf: 0, art: 0, arm: 0 };
  for (const u of S.units) if (u.s === side && !u.dead && (u.r >= 0 || u.arr !== undefined || u.trn > 0 || u.res)) { const p = TYPES[u.t].pp, s = EQS[u.t] || EQS.inf; for (const c in s) d[c] += p * s[c]; }
  if (mix) for (const [t, w] of Object.entries(mix)) { const s = EQS[t] || EQS.inf; for (const c in s) m[c] += w * TYPES[t].pp * s[c]; }
  const dt = d.inf + d.art + d.arm || 1, mt = m.inf + m.art + m.arm || 1, st = S.eq?.[side] ? eqTot(S, side) : 0;
  const T = {};
  let sum = 0;
  for (const c of EQK) {
    let x = mix ? 0.6 * (d[c] / dt) + 0.4 * (m[c] / mt) : d[c] / dt;
    if (st > 25) { const f = S.eq[side][c] / st; x *= Math.max(0.6, Math.min(1.5, 1 + (x - f) * 1.5)); }
    T[c] = x; sum += x;
  }
  const air = side === S.side && S.line?.[side]?.airT !== undefined ? S.line[side].airT : AIR_SH;
  for (const c of EQK) T[c] = (T[c] / (sum || 1)) * (1 - air);
  T.air = air;
  return T;
}
// новые доли: прирост доли линии — с низкой эффективностью (переналадка)
export function setShares(S, side, sh) {
  const L = S.line[side];
  let sum = 0;
  for (const c of LINES) sum += Math.max(0, sh[c]);
  for (const c of LINES) {
    const n = Math.max(0, sh[c]) / (sum || 1), o = L.sh[c];
    if (n > o + 1e-6) L.e[c] = (L.e[c] * o + E_NEW * (n - o)) / n;
    L.sh[c] = n;
  }
}
// доли линий — целым числом заводов F (метод наибольших остатков: в сумме ровно F)
export function allocFac(sh, F) {
  const o = {}, rem = [];
  let n = 0;
  for (const c of LINES) { const x = Math.max(0, sh[c]) * F; o[c] = Math.floor(x + 1e-9); n += o[c]; rem.push([x - o[c], c]); }
  rem.sort((a, b) => b[0] - a[0]);
  for (let i = 0; n < F && i < rem.length; i++, n++) o[rem[i][1]]++;
  return o;
}
// игрок: доля линии ±5 % или (F > 0 — «числом заводов») ±1 завод; остальные — пропорционально
export function shiftLine(S, side, c, dir, F = 0) {
  const L = S.line[side], v0 = F > 0 ? (allocFac(L.sh, F)[c] + dir) / F : L.sh[c] + 0.05 * dir, v = Math.max(0, Math.min(0.85, v0));
  const rest = 1 - L.sh[c], sh = {};
  for (const k of LINES) sh[k] = k === c ? v : rest > 1e-6 ? (L.sh[k] / rest) * (1 - v) : (1 - v) / 3;
  L.auto = 0;
  setShares(S, side, sh);
  L.airT = L.sh.air;
}
// выпуск за неделю: в запасы снаряжения и в ВВС
export function produce(S, side, W) {
  const L = S.line[side];
  if (L.auto || side !== S.side) {
    const T = lineTarget(S, side, mixNow(side, S.turn)), sh = {};
    for (const c of LINES) sh[c] = L.sh[c] + Math.max(-0.04, Math.min(0.04, T[c] - L.sh[c]));
    setShares(S, side, sh);
  }
  const cap = effCap(S, side), out = {};
  for (const c of LINES) {
    out[c] = W * L.sh[c] * L.e[c];
    if (c !== 'air') S.eq[side][c] += out[c];
    L.e[c] = Math.min(cap, L.e[c] + E_REC);
  }
  const k = Math.max(0.3, Math.min(2, out.air / Math.max(1, W * AIR_SH)));
  S.airK[side] += (k - S.airK[side]) * 0.25;
  return out;
}
// ——— стройка: строительные бригады (отзыв 04.11: без гражданских фабрик) ———
// У стороны — N стройбригад (СССР 6 → 10, Ось 5 → 8 по годам; решения — ещё +2). Бригада ведёт один проект;
// проекты идут по очереди: первые N — в работе, остальные ждут свободную бригаду. Срок — в неделях работы:
// у фронта ×1,5, без железной дороги ×1,25; наука («стройка») и решения — быстрее.
export const BRIG = { SOV: [[1941.4, 6], [1942.5, 8], [1944.0, 10]], GER: [[1941.4, 5], [1942.8, 6], [1943.8, 8]] };
export const brigN = (S, side) => Math.round(lerpT(BRIG[side], yearF(S.turn))) + (S.flags[side + 'brig'] || 0);
// w — недель работы одной бригады (в тылу, у железной дороги)
export const BUILD = {
  fac: { n: 'Военный завод', ic: 'factory', w: 12, d: '+⚙ военное производство' },
  fort: { n: 'Укрепления', ic: 'fort', w: 2, d: '+22 % к обороне (до 3 уровней)' },
  aa: { n: 'ПВО', ic: 'aa', w: 2, d: 'зенитки: перевес авиации противника здесь −40 %, по соседству −20 %' },
  afd: { n: 'Аэродром', ic: 'airfield', w: 3, d: '+10 % к авиации фронта' },
  camp: { n: 'Учебный лагерь', ic: 'camp', w: 4, d: 'новые дивизии — быстрее и опытнее' },
  dep: { n: 'Склад', ic: 'depot', w: 4, d: 'снабжение вокруг лучше, держится в окружении' },
};
export const BUILD_ORDER = ['fac', 'fort', 'aa', 'afd', 'camp', 'dep'];
// каждый новый завод строится на 12 % дольше прежнего: рост не бесконечен
export const bWeeks = (S, side, k) => BUILD[k].w * (k === 'fac' ? 1 + 0.12 * (S.built?.[side]?.fac || 0) : 1);
const bump = (S, side, k, d) => { if (k !== 'fac') return; S.built ??= {}; const o = (S.built[side] ??= { fac: 0 }); o.fac = Math.max(0, (o.fac || 0) + d); };
// темп работ в области: недель работы за неделю
export const bRate0 = (S, side) => (1 + tx(S, side, 'cp')) * (S.flags[side + 'cp'] || 1);
export function bRate(S, side, r) {
  let k = bRate0(S, side);
  if (isFront(S, r, side)) k /= 1.5;
  if (!S.rail[r]) k /= 1.25;
  return k;
}
// срок нового проекта в области (недель)
export const bTime = (S, side, r, k) => Math.max(1, Math.ceil(bWeeks(S, side, k) / bRate(S, side, r) - 1e-6));
export const QMAX = 30;
export const myQ = (S, side) => S.q.filter((b) => b.s === side && !b.lost);
export const brigBusy = (S, side) => Math.min(brigN(S, side), myQ(S, side).length);
export const brigFree = (S, side) => Math.max(0, brigN(S, side) - myQ(S, side).length);
// проект в работе (у него есть бригада) — первые N в очереди стороны
export const isActive = (S, b) => myQ(S, b.s).indexOf(b) < brigN(S, b.s);
// мест под заводы в области: по городам (очкам) области
export const slots = (S, r) => { const g = S.M.reg[r]; return 2 + 2 * Math.min(5, g.vp) + (g.city ? 1 : 0); };
export const used = (S, r) => S.fac[r] + S.q.filter((b) => b.r === r && b.k === 'fac').length;
export function whyNot(S, side, r, k) {
  const M = S.M;
  if (!BUILD[k]) return 'нельзя';
  if (sideOf(S, r) !== side) return 'не наша область';
  if (S.q.some((b) => b.r === r && b.k === k)) return 'уже строится';
  if (k === 'fac') {
    if (SIDE0[M.nats[S.own0[r]]] !== side) return 'только на своей земле';
    if (isFront(S, r, side)) return 'у фронта';
    if (used(S, r) >= slots(S, r)) return 'нет места';
  }
  if (k === 'fort' && S.fort[r] >= 3) return 'наивысший уровень';
  if ((k === 'afd' && S.afd[r]) || (k === 'camp' && S.camp[r]) || (k === 'dep' && S.dep[r]) || (k === 'aa' && S.aa?.[r])) return 'уже есть';
  if (k === 'camp' && isFront(S, r, side)) return 'у фронта';
  if (k === 'dep' && !S.rail[r]) return 'нет железной дороги';
  if (S.q.filter((b) => b.s === side).length >= QMAX) return 'очередь полна';
  return '';
}
export const canBuild = (S, side, r, k) => !whyNot(S, side, r, k);
export function build(S, side, r, k) {
  if (!canBuild(S, side, r, k)) return false;
  const w = bWeeks(S, side, k);
  S.q.push({ r, k, s: side, left: w, tot: w, v: 2 });
  bump(S, side, k, 1);
  return true;
}
export function unbuild(S, b) {
  const i = S.q.indexOf(b);
  if (i < 0) return false;
  S.q.splice(i, 1);
  if (b.left > 0) bump(S, b.s, b.k, -1);
  return true;
}
// проект потерян (область занята противником)
export function qLost(S, r) {
  for (const b of S.q) if (b.r === r) bump(S, b.s, b.k, -1);
  S.q = S.q.filter((b) => b.r !== r);
}
// недель до готовности проекта (с учётом очереди: бригада освобождается — берёт следующий проект)
export function etaOf(S, side, b) {
  const N = brigN(S, side);
  if (N <= 0) return 99;
  const t = new Array(N).fill(0);
  for (const x of myQ(S, side)) {
    let i = 0;
    for (let j = 1; j < N; j++) if (t[j] < t[i]) i = j;
    t[i] += Math.max(1, Math.ceil(x.left / bRate(S, side, x.r) - 1e-6));
    if (x === b) return t[i];
  }
  return 99;
}
export function construct(S, side) {
  let n = brigN(S, side);
  const done = [];
  for (const b of S.q) {
    if (b.s !== side || b.lost) continue;
    if (sideOf(S, b.r) !== side) { b.lost = 1; bump(S, side, b.k, -1); continue; }
    if (n-- <= 0) continue;
    b.left -= bRate(S, side, b.r);
    if (b.left <= 1e-3) done.push(b);
  }
  for (const b of done) {
    const r = b.r;
    if (b.k === 'fac') S.fac[r]++;
    else if (b.k === 'fort') S.fort[r] = Math.min(3, S.fort[r] + 1);
    else S[b.k][r] = 1;
    if (side === S.side && b.k !== 'fort') note(S, { ic: BUILD[b.k].ic, side, txt: `Построено: ${BUILD[b.k].n === 'ПВО' ? 'ПВО' : BUILD[b.k].n.toLowerCase()} — ${S.M.reg[r].city?.n || S.M.reg[r].n}`, r });
  }
  if (done.length || S.q.some((b) => b.lost)) S.q = S.q.filter((b) => !b.lost && !done.includes(b));
}
// ПВО: доля перевеса вражеской авиации, которую снимают зенитки обороняющейся стороны в области r
export function aaCover(S, r, side) {
  if (!S.aa) return 0;
  if (S.aa[r] && sideOf(S, r) === side) return 0.4;
  for (const e of S.M.reg[r].nb) if (S.aa[e.r] && sideOf(S, e.r) === side) return 0.2;
  return 0;
}
// ——— эвакуация (СССР): заводы уезжают в тыл и через 8 недель работают там ———
export function canEvac(S, r) { return sideOf(S, r) === 'SOV' && S.fac[r] > 0 && SIDE0[S.M.nats[S.own0[r]]] === 'SOV' && !S.M.reg[r].f.includes('e') && S.M.reg[r].x < 2300; }
export function evacuate(S, r) {
  if (!canEvac(S, r)) return false;
  const M = S.M, n = Math.max(1, Math.ceil(S.fac[r] * 0.6));
  const tg = M.reg.filter((g) => g.f.includes('e') && sideOf(S, g.id) === 'SOV').sort((a, b) => S.fac[a.id] - S.fac[b.id] || b.x - a.x)[0];
  if (!tg) return false;
  S.fac[r] = 0;
  for (const b of S.q.filter((x) => x.r === r && x.k === 'fac')) unbuild(S, b);
  S.evac.push({ r, to: tg.id, n, left: Math.round(8 * decK(S, 'SOV', 'evac')) });
  note(S, { ic: 'train', side: 'SOV', txt: `Заводы ${M.reg[r].n} — эвакуация в ${tg.n}`, r });
  return true;
}
export function evacWeek(S) {
  for (const e of S.evac) e.left--;
  for (const e of S.evac.filter((x) => x.left <= 0)) { S.fac[e.to] += e.n; note(S, { ic: 'factory', side: 'SOV', txt: `Эвакуированные заводы заработали: ${S.M.reg[e.to].n}`, r: e.to }); }
  S.evac = S.evac.filter((x) => x.left > 0);
}
// ★ политическая власть за неделю (решения — v0.11, шаг 6)
export const polOf = (S, side) => (side === 'SOV' ? 2 : 1.8) * (S.flags[side + 'pol'] || 1);
// поля хозяйства v0.11 (новая игра и старые сохранения)
const CAMP0 = { SOV: ['Москва', 'Горький', 'Куйбышев', 'Свердловск'], GER: ['Берлин', 'Варшава', 'Кёнигсберг'] };
export function ensureEco(S, byName) {
  const M = S.M, R = M.R;
  if (!S.camp) {
    S.camp = new Int8Array(R);
    for (const sd in CAMP0) for (const n of CAMP0[sd]) { const r = byName(n); if (r >= 0 && sideOf(S, r) === sd) S.camp[r] = 1; }
  }
  S.dep ??= new Int8Array(R);
  S.airK ??= { GER: 1, SOV: 1 };
  S.pol ??= { GER: 25, SOV: 25 };
  if (!S.line) {
    S.line = {};
    for (const sd of ['GER', 'SOV']) { const T = lineTarget(S, sd, mixNow(sd, S.turn)); S.line[sd] = { sh: T, e: { inf: 1, art: 1, arm: 1, air: 1 }, auto: 1 }; }
  }
  if (!S.eq) {
    S.eq = {};
    for (const sd of ['GER', 'SOV']) { const p = S.pp?.[sd] ?? 60, T = S.line[sd].sh, g = 1 - T.air; S.eq[sd] = { inf: (p * T.inf) / g, art: (p * T.art) / g, arm: (p * T.arm) / g }; }
  }
  delete S.pp;
  // стройка — бригадами (отзыв 04.11): гражданских фабрик больше нет, проекты — в неделях работы
  S.aa ??= new Int8Array(R);
  delete S.civ;
  S.q = S.q.filter((b) => BUILD[b.k]);
  for (const b of S.q) {
    b.s ??= sideOf(S, b.r);
    if (b.v !== 2) { const f = b.tot ? Math.max(0, Math.min(1, b.left / b.tot)) : 1, w = BUILD[b.k].w; b.tot = w; b.left = Math.max(0.5, f * w); b.v = 2; }
  }
  for (const sd in S.built || {}) delete S.built[sd].civ;
}
