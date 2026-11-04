// «Фронт 1941–1945» (v0.9): ИИ армий. Приказы штабов: Авто (исторический план, plan.js), Оборона, Наступать (цель —
// гекс), Отход, Резерв, Вручную. Сначала удары (лучшие соотношения сил), затем марши: подвижные войска — в прорыв
// к цели по «полю расстояний», пехота — к фронту и в бреши; в обороне — закрыть участок армии (разбиение фронта
// по ближайшим армиям), второй эшелон; окружённые — на прорыв к своим; дальние резервы — по железной дороге.
import { OPS } from './plan.js';
import {
  alive, isMech, reach, pathTo, doMove, doAttack, odds, unitsAt, stackN, STACK, stackCap, zoc, enemyAt, sideOfH, passable, dayOf,
  enemyNear, canAttack, defVal, atkVal, cvRaw, railOK, railNet, placeAt, other, northK, border41,
} from './rules.js';

const NS0 = (S, h) => ({ GER: 'GER', FIN: 'GER', ROM: 'GER', HUN: 'GER', ITA: 'GER', SVK: 'GER', SOV: 'SOV' })[S.M.nations[S.M.own0[h]]] || null;
const OPS2 = OPS.map(([side, a, b, n, who, k, obj]) => ({ side, a: dayOf(a), b: dayOf(b), n, who: who.split(' '), k, obj: obj ? obj.split('|') : [] }));
export const ORDERS = {
  auto: { n: 'Авто', d: 'по историческому плану Ставки и ОКХ' },
  def: { n: 'Оборона', d: 'держать участок, окапываться, контратаковать при перевесе' },
  atk: { n: 'Наступать', d: 'наступать на выбранную цель' },
  ret: { n: 'Отход', d: 'отходить к выбранному рубежу, не принимая боя' },
  res: { n: 'Резерв', d: 'отвести в тыл на пополнение' },
  man: { n: 'Вручную', d: 'дивизиями управляет игрок' },
};
// текущая операция плана для армии (своя строка важнее строки группы/фронта)
export function planOp(S, A) {
  const d = S.day, up = S.hqs[A.up], als = up ? [up.k, ...(up.als || [])] : [];
  let best = null, bs = 0;
  const ops = S.xops?.length ? OPS2.concat(S.xops) : OPS2;
  for (const o of ops) {
    if (o.side !== A.side || d < o.a || d > o.b || (S.noop?.length && S.noop.includes(o.n))) continue;
    let s = o.who.includes(A.k) || (A.als && A.als.some((x) => o.who.includes(x))) ? 2 : als.some((x) => o.who.includes(x)) ? 1 : 0;
    if (!s) continue;
    if (o.x) s += 0.5;
    if (s > bs || (s === bs && o.a > best.a)) (bs = s), (best = o);
  }
  return best ? { ...best, own: bs >= 2 } : null;
}
export const OPS_ALL = OPS2;
export function armyUnits(S, A) {
  return S.units.filter((u) => u.hq === A.k && alive(u) && !u.arr);
}
export function centroid(S, us) {
  if (!us.length) return -1;
  let x = 0, y = 0;
  for (const u of us) {
    const [a, b] = S.M.xy(u.h);
    x += a;
    y += b;
  }
  x /= us.length;
  y /= us.length;
  let best = us[0].h, bd = 1e18;
  for (const u of us) {
    const [a, b] = S.M.xy(u.h), dd = (a - x) ** 2 + (b - y) ** 2;
    if (dd < bd) (bd = dd), (best = u.h);
  }
  return best;
}
// цель операции для армии: по порядку (своя строка) или ближайшая невзятая (строка группы)
function opTarget(S, A, o, c) {
  const M = S.M, want = o.k === 'ret' ? A.side : other(A.side);
  const list = o.obj.map((n) => M.city(n)).filter(Boolean);
  if (!list.length) return null;
  if (o.k === 'ret') {
    let best = null, bd = 1e9;
    for (const x of list) if (sideOfH(S, x.h) === A.side) { const dd = M.dist(x.h, c); if (dd < bd) (bd = dd), (best = x); }
    return best || list[list.length - 1];
  }
  const open = list.filter((x) => sideOfH(S, x.h) === want);
  if (!open.length) return null;
  if (o.own) return open[0];
  let best = open[0], bd = 1e9;
  for (const x of open) {
    const dd = M.dist(x.h, c);
    if (dd < bd) (bd = dd), (best = x);
  }
  return best;
}
// поза армии на сегодня
export function posture(S, A, us = armyUnits(S, A)) {
  const c = centroid(S, us);
  if (A.order === 'def') return { k: 'def' };
  if (A.order === 'res') return { k: 'res' };
  if (A.order === 'atk' && A.tgt >= 0) return sideOfH(S, A.tgt) === A.side ? { k: 'def' } : { k: 'atk', obj: A.tgt };
  if (A.order === 'ret' && A.tgt >= 0) return { k: 'ret', obj: A.tgt };
  if (A.order === 'ret') return { k: 'ret', obj: rearHex(S, A.side, c) };
  const o = planOp(S, A);
  if (!o) return { k: 'def' };
  if (o.k === 'hold') return { k: 'def', hold: 1, op: o };
  if (o.k === 'def' || (o.k === 'ret' && A.side === 'SOV' && S.ev?.fx?.SOVnoRet >= S.day)) return { k: 'def', op: o };
  const t = opTarget(S, A, o, c);
  if (!t) return { k: 'def', op: o };
  return { k: o.k, obj: t.h, objN: t.n, op: o };
}
// тыловой рубеж: ближайший свой крупный город в 4+ гексах от противника
function rearHex(S, side, c) {
  const M = S.M, fd = S.frontDist?.[side];
  let best = -1, bs = 1e9;
  for (const x of M.cities) {
    if (sideOfH(S, x.h) !== side || x.sz < 2) continue;
    const f = fd ? fd[x.h] : 9;
    if (f < 4) continue;
    const s = M.dist(x.h, c) + Math.abs(f - 5) * 1.5;
    if (s < bs) (bs = s), (best = x.h);
  }
  return best >= 0 ? best : c;
}

// ——— поле расстояний (алгоритм Дейкстры с корзинами), кеш на 2 дня ———
const FC = [0, 0, 2, 3, 3, 5, 4, 2, 3];
export function field(S, side, tgt) {
  S._fc = S._fc || new Map();
  const key = side + ':' + tgt, o = S._fc.get(key);
  if (o && S.day - o.d < 2) return o.F;
  const M = S.M, N = M.N, F = new Uint16Array(N).fill(65535), B = [[tgt]];
  F[tgt] = 0;
  for (let c = 0; c < B.length; c++) {
    const q = B[c];
    if (!q) continue;
    for (let i = 0; i < q.length; i++) {
      const h = q[i];
      if (F[h] !== c) continue;
      for (let d = 0; d < 6; d++) {
        const j = M.nb[h * 6 + d];
        if (j < 0 || !passable(S, j)) continue;
        let w = FC[M.terr[j]] + (M.river(h, d) ? (M.bigRiver(h, d) ? 3 : 1) : 0);
        if (enemyAt(S, j, side)) w += 3;
        const nc = c + w;
        if (nc < F[j]) {
          F[j] = nc;
          (B[nc] || (B[nc] = [])).push(j);
        }
      }
    }
  }
  S._fc.set(key, { d: S.day, F });
  if (S._fc.size > 160) S._fc.delete(S._fc.keys().next().value);
  return F;
}

// ——— участки армий: многоисточниковый поиск в ширину от дивизий по своей земле ———
function sectors(S, side, armies) {
  const M = S.M, N = M.N, lab = new Int16Array(N).fill(-1), dist = new Int16Array(N).fill(-1);
  let q = [];
  armies.forEach((A, i) => {
    for (const u of A._us) if (dist[u.h] < 0) (dist[u.h] = 0), (lab[u.h] = i), q.push(u.h);
  });
  while (q.length) {
    const nq = [];
    for (const h of q)
      for (let d = 0; d < 6; d++) {
        const j = M.nb[h * 6 + d];
        if (j < 0 || dist[j] >= 0 || M.terr[j] < 2 || sideOfH(S, j) !== side) continue;
        dist[j] = dist[h] + 1;
        lab[j] = lab[h];
        nq.push(j);
      }
    q = nq;
  }
  return lab;
}
// линия фронта: свои гексы, соседние с землёй противника
export function frontHexes(S, side) {
  const M = S.M, out = [], en = other(side);
  for (let h = 0; h < M.N; h++) {
    if (M.terr[h] < 2 || sideOfH(S, h) !== side) continue;
    for (let d = 0; d < 6; d++) {
      const j = M.nb[h * 6 + d];
      if (j >= 0 && M.terr[j] >= 2 && sideOfH(S, j) === en) {
        out.push(h);
        break;
      }
    }
  }
  return out;
}
// расстояние до фронта (для резервов, перешивки колеи и тылов)
export function frontDistance(S, side) {
  const M = S.M, N = M.N, D = new Uint16Array(N).fill(999);
  let q = frontHexes(S, side);
  for (const h of q) D[h] = 0;
  while (q.length) {
    const nq = [];
    for (const h of q)
      for (let d = 0; d < 6; d++) {
        const j = M.nb[h * 6 + d];
        if (j < 0 || D[j] !== 999 || M.terr[j] < 2) continue;
        D[j] = D[h] + 1;
        nq.push(j);
      }
    q = nq;
  }
  return D;
}

// угроза гексу: сила соседних войск противника к своей обороне
function threat(S, h, side) {
  let e = 0;
  const M = S.M;
  for (let d = 0; d < 6; d++) {
    const j = M.nb[h * 6 + d];
    if (j >= 0) for (const u of unitsAt(S, j)) if (u.side !== side) e += cvRaw(S, u);
  }
  return e;
}
const TH_ATK = { GER: 1.2, SOV: 1.25 };

// ——— основной ход стороны ———
// opt.skip(u) — пропустить дивизию (игрок уже ею походил); opt.skipArmy(A) — армия «Вручную»
export function runAI(S, side, opt = {}) {
  const M = S.M;
  const skipU = opt.skip || (() => false), skipA = opt.skipArmy || (() => false);
  const armies = Object.values(S.hqs).filter((A) => A.side === side && A.lv >= 2 && !A.dead && !A.arr && !skipA(A));
  for (const A of armies) {
    A._us = armyUnits(S, A).filter((u) => !skipU(u));
    A._p = posture(S, A, A._us);
  }
  const act = armies.filter((A) => A._us.length);
  const lab = sectors(S, side, act);
  const fr = frontHexes(S, side);
  const sup = S.supL?.[side];
  const thMul = S.ev?.fx?.[side + 'agg'] || 1;
  // «поводок снабжения»: не дальше 2 гексов от своей земли со снабжением
  S._lea = leash(S, side, sup);
  // 1) окружённые: на прорыв; 2) удары
  const isAtk = (A) => A._p.k === 'atk';
  const unitArmy = new Map();
  for (const A of act) for (const u of A._us) unitArmy.set(u.id, A);
  let tg = new Set();
  const addT = (h) => {
    for (let d = 0; d < 6; d++) {
      const j = M.nb[h * 6 + d];
      if (j >= 0 && enemyAt(S, j, side)) tg.add(j);
    }
  };
  for (const A of act) for (const u of A._us) if (canAttack(S, u)) addT(u.h);
  for (let pass = 0; pass < 3 && tg.size; pass++) {
    const list = [];
    for (const t of tg) {
      const att = [];
      for (let d = 0; d < 6; d++) {
        const j = M.nb[t * 6 + d];
        if (j < 0) continue;
        for (const u of unitsAt(S, j)) {
          if (u.side !== side || !canAttack(S, u) || skipU(u)) continue;
          const A = unitArmy.get(u.id);
          if (!A || A._p.k === 'res' || A._p.k === 'ret' || A._p.hold) continue;
          att.push(u);
        }
      }
      if (!att.length) continue;
      if (noAssault(S, side, t)) continue;
      const o = odds(S, att, t);
      // ценность цели: ближе к цели армии, город, котёл, слабый противник
      let val = 1;
      const A0 = unitArmy.get(att[0].id);
      if (A0._p.obj >= 0 && A0._p.k === 'atk') {
        const F = field(S, side, A0._p.obj);
        val += Math.max(0, (F[att[0].h] - F[t]) * 0.08);
      }
      if (M.cityAt[t] >= 0) val += 0.2;
      if (unitsAt(S, t).some((d) => d.oos > 2)) val += 0.4;
      const atkMode = att.some((u) => isAtk(unitArmy.get(u.id)));
      const brk = att.some((u) => u.oos > 2 && (!sup || !sup[u.h]));
      const th = (brk ? 0.9 : atkMode ? TH_ATK[side] : 2.3) * thMul;
      if (o.R < th) continue;
      // без наступательной операции: только добивать котлы и (СССР) отбивать свою землю при большом перевесе
      // (вне операции — только своя земля 1941 г.: СССР не наступает за границу без операции Ставки, вермахт — без директивы ОКХ)
      if (!brk && !atkMode && !unitsAt(S, t).some((d) => d.oos > 2) && (o.R < 3 || NS0(S, t) !== side)) continue;
      list.push({ t, att, R: o.R, s: Math.min(o.R, 4) * val });
    }
    list.sort((a, b) => b.s - a.s);
    const nt = new Set();
    for (const it of list) {
      const att = it.att.filter((u) => canAttack(S, u));
      if (!att.length || !enemyAt(S, it.t, side)) continue;
      const o = odds(S, att, it.t);
      if (o.R < Math.min(it.R, TH_ATK[side] * thMul) * 0.9) continue;
      const r = doAttack(S, att, it.t);
      if (r && r.adv) addTo(nt, S, r.adv.h, side);
    }
    tg = nt;
  }
  // 3) марши
  const occ = (h) => stackN(S, h);
  const need = new Map(); // гекс фронта → нужно дивизий
  for (const h of fr) {
    const th = threat(S, h, side), c = M.cityAt[h] >= 0 ? M.cities[M.cityAt[h]] : null;
    need.set(h, th > 0 ? 1 + (th > 28 ? 1 : 0) + (th > 60 ? 1 : 0) + (c && (c.hard || c.sz >= 2) ? 1 : 0) : c && c.sz >= 2 ? 1 : 0.5);
  }
  keyCities(S, side, need);
  pressure(S, side, act, lab, need);
  rebalance(S, side, act);
  salients(S, side, act);
  for (const A of act) {
    const p = A._p, us = A._us.filter((u) => alive(u) && u.mp > 0 && !u.gar);
    if (!us.length) continue;
    if (p.k === 'atk') marchAtk(S, A, us, p, need);
    else if (p.k === 'ret') marchRet(S, A, us, p);
    else if (p.k === 'res') marchRes(S, A, us);
    else marchDef(S, A, us, lab, act.indexOf(A), need);
  }
  // 4) дальние переброски по железной дороге
  railMoves(S, side, act, lab, opt);
  for (const A of act) (A._us = null);
}
// выход из мешков: дивизия, обойдённая с 4+ сторон (но ещё со связью с тылом), отходит к своим.
// Германия — всегда, СССР — с лета 1942 г. (после «Блау» Ставка перестала держать обречённые рубежи)
const nEn = (S, h, side) => {
  let n = 0;
  for (let d = 0; d < 6; d++) {
    const j = S.M.nb[h * 6 + d];
    if (j >= 0 && S.M.terr[j] >= 2 && sideOfH(S, j) === other(side)) n++;
  }
  return n;
};
function salients(S, side, act) {
  if (side === 'SOV' && S.day < dayOf('1942-06-28')) return;
  const C = S.supC?.[side];
  if (!C) return;
  for (const A of act) {
    if (A._p.k === 'atk' || A._p.hold || A.order === 'def') continue;
    for (const u of A._us) {
      if (!alive(u) || u.mp <= 0 || u.mv || u.gar || !C[u.h]) continue;
      const ci = S.M.cityAt[u.h];
      if (ci >= 0 && (S.M.cities[ci].fort || S.M.cities[ci].vp >= 4)) continue;
      const k = nEn(S, u.h, side);
      if (k < 4) continue;
      bestMove(S, u, (h, c) => (C[h] ? 0 : 50) + nEn(S, h, side) * 3 + enemyNear(S, h, side) * 0.5 + Math.max(0, stackN(S, h) - 1) * 0.5 + (c || 0) * 0.05, true);
    }
  }
}
// ключевые города (столицы, «города-герои»): при противнике в 2 гексах — полный гарнизон, подступы — гуще
const KEYC = { SOV: { Москва: 5, Ленинград: 5, Сталинград: 4, Тула: 3, Севастополь: 3, Одесса: 3 }, GER: { Берлин: 5, Кёнигсберг: 3, Бреслау: 3, Будапешт: 3, Вена: 3 } };
function keyCities(S, side, need) {
  const M = S.M;
  for (const n in KEYC[side]) {
    const c = M.city(n);
    if (!c || sideOfH(S, c.h) !== side) continue;
    let near = 9;
    for (let r = 1; r <= 3 && near > 3; r++) for (const h of M.ring(c.h, r)) if (enemyAt(S, h, side)) { near = r; break; }
    if (near > 3) continue;
    if (near <= 2) need.set(c.h, Math.max(need.get(c.h) || 0, Math.min(stackCap(S, c.h), KEYC[side][n])));
    // подступы: гексы фронта в 1–3 гексах от города
    for (const [h, v] of need) if (h !== c.h && M.dist(h, c.h) <= 3) need.set(h, v + 1);
  }
}
// нагрузка участков армий: потребность фронта (fr), сила противника у участка (en), своя сила (ow), напряжение pr = en/ow
function pressure(S, side, act, lab, need) {
  const M = S.M, n = act.length, nd = new Float32Array(n), en = new Float32Array(n), ow = new Float32Array(n), seen = new Set();
  for (const [h, v] of need) {
    const i = lab[h];
    if (i < 0) continue;
    nd[i] += v;
    for (let d = 0; d < 6; d++) {
      const j = M.nb[h * 6 + d];
      if (j >= 0) for (const e of unitsAt(S, j)) if (e.side !== side && !seen.has(e.id)) (seen.add(e.id), (en[i] += cvRaw(S, e)));
    }
  }
  act.forEach((A, i) => {
    for (const u of A._us) ow[i] += cvRaw(S, u);
    A.fr = Math.round(nd[i] * 10) / 10;
    A.en = Math.round(en[i]);
    A.pr = Math.round((en[i] / Math.max(4, ow[i])) * 100) / 100;
  });
}
// перегруппировка между армиями «Авто»: с тихих участков — на угрожаемые (раз в 2 дня, по 1–3 дивизии)
function rebalance(S, side, act) {
  if (S.day % 2) return;
  const fd = S.frontDist?.[side], auto = (A) => !A.order || A.order === 'auto';
  const rec = act.filter((A) => auto(A) && A.pr > (A._p.k === 'atk' ? 0.9 : 1.1)).sort((a, b) => b.pr - a.pr);
  let left = side === 'SOV' ? 3 : 2;
  for (const B of rec) {
    if (left <= 0) break;
    let best = null, bs = 1e9, bA = null;
    for (const A of act) {
      if (A === B || !auto(A) || A._p.k === 'atk' || A.pr > Math.min(0.55, B.pr * 0.4) || A._us.length <= Math.max(3, Math.ceil(A.fr) + 1)) continue;
      for (const u of A._us) {
        if (!alive(u) || u.gar || u.oos > 0 || u.nat !== B.nat || u.mv || u.at) continue;
        const f = fd ? fd[u.h] : 3;
        if (f < 1 && A._us.length <= A.fr * 1.3 + 1) continue;
        const s = S.M.dist(u.h, B._us[0]?.h ?? u.h) * 0.2 - Math.min(f, 6) - u.men / 4000;
        if (s < bs) (bs = s), (best = u), (bA = A);
      }
    }
    if (!best) continue;
    best.hq = B.k;
    bA._us.splice(bA._us.indexOf(best), 1);
    B._us.push(best);
    bA.pr *= 1.1;
    B.pr *= 0.92;
    left--;
  }
}
// директивы ставок: города, которые ИИ не штурмует, пока у защитников есть снабжение
// (Гитлер: Ленинград и Москву — окружить, капитуляцию не принимать (директива 7.10.1941); Киев — взять окружением;
// Тула (2-я танковая армия Гудериана в 1941 г. так и не взяла её штурмом) — обойти; Сталинград — сначала выйти к Волге
// и отрезать город)
const NOASS = { GER: [['Ленинград', '1941-06-22', '1945-12-31'], ['Киев', '1941-06-22', '1941-09-15'], ['Сталинград', '1942-07-01', '1942-09-10'], ['Москва', '1941-10-07', '1942-12-31'], ['Тула', '1941-10-25', '1941-12-15']], SOV: [] };
const NOASS2 = Object.fromEntries(Object.entries(NOASS).map(([k, a]) => [k, a.map(([n, x, y]) => [n, dayOf(x), dayOf(y)])]));
const D_SVIR = dayOf('1941-09-20');
// стоп-линии Оси (ИИ) на севере: и для ударов, и для маршей (в пустые гексы за линией ИИ тоже не входит)
function northStop(S, h) {
  if (!S.M.llXY) return false;
  const k = northK(S.M)[h];
  if (k <= 1) return false;
  const b = border41(S.M)[h];
  return k >= 2 ? b > 2 : b > (S.day < D_SVIR ? 4 : 7);
}
function noAssault(S, side, t) {
  if (side === S.side) return false;
  // Ось (ИИ) на севере: наступления 1941 г. встали на Лице, Вермане, у Кестеньги и Ухты (≈ 2 гекса от границы);
  // Карельская армия финнов — до Петрозаводска и Медвежьегорска (5) лишь с сентября, дальше Свири (7) не идёт
  if (side === 'GER' && northStop(S, t)) return true;
  const ci = S.M.cityAt[t];
  if (ci < 0) return false;
  const c = S.M.cities[ci];
  for (const [n, a, b] of NOASS2[side]) if (n === c.n && S.day >= a && S.day <= b) return unitsAt(S, t).some((d) => d.oos <= 2);
  return false;
}
function leash(S, side, sup) {
  const M = S.M, N = M.N, D = new Uint8Array(N).fill(9);
  if (!sup) return D.fill(0);
  let q = [];
  for (let h = 0; h < N; h++) if (sup[h] > 0 && sideOfH(S, h) === side) (D[h] = 0), q.push(h);
  for (let k = 1; k <= 3 && q.length; k++) {
    const nq = [];
    for (const h of q)
      for (let d = 0; d < 6; d++) {
        const j = M.nb[h * 6 + d];
        if (j >= 0 && D[j] > k && M.terr[j] >= 2) (D[j] = k), nq.push(j);
      }
    q = nq;
  }
  return D;
}
function addTo(set, S, h, side) {
  for (let d = 0; d < 6; d++) {
    const j = S.M.nb[h * 6 + d];
    if (j >= 0 && enemyAt(S, j, side)) set.add(j);
  }
}
// лучший гекс из достижимых по оценке score (меньше — лучше)
// own — не входить на чужую землю (кроме своей земли 1941 г.): оборона, резерв и отход не «расползаются»
// в пустоту за линией фронта (иначе в 1942 г. армии Карельского фронта уходили в глубь Финляндии)
function bestMove(S, u, score, own = false) {
  const R = reach(S, u);
  let best = u.h, bs = score(u.h, 0);
  for (const [h, o] of R) {
    if (h === u.h || stackN(S, h) >= stackCap(S, h)) continue;
    if (own && sideOfH(S, h) !== u.side && NS0(S, h) !== u.side) continue;
    if (u.side === 'GER' && S.side !== 'GER' && northStop(S, h)) continue;
    const s = score(h, o.c);
    if (s < bs - 1e-6) (bs = s), (best = h);
  }
  if (best !== u.h) doMove(S, u, pathTo(R, best));
  return best;
}
function marchAtk(S, A, us, p, need) {
  const F = field(S, A.side, p.obj), side = A.side;
  const g = S.G[A.gen], enc = g && g.tr.includes('enc');
  // подвижные — первыми, в прорыв
  us.sort((a, b) => isMech(b) - isMech(a) || F[a.h] - F[b.h]);
  for (const u of us) {
    if (!alive(u) || u.mp <= 0) continue;
    const mech = isMech(u), f0 = F[u.h];
    if (f0 === 0) continue;
    // без снабжения подвижные дальше не рвутся
    const cautious = u.oos >= (enc ? 3 : 2);
    bestMove(S, u, (h, c) => {
      const en = enemyNear(S, h, side);
      let s = F[h] * 1.0 + c * 0.02;
      if (mech) s += en * (enc ? 0.6 : 1.0) - (en ? 0 : 0.5);
      else {
        s += en ? -1.5 : 0; // пехота держится у противника
        s += Math.max(0, stackN(S, h) - 1) * 1.2;
      }
      if (cautious && F[h] < f0 && enemyNear(S, h, side) > 1) s += 6;
      if (S._lea && S._lea[h] > (enc ? 3 : 2) && F[h] < f0) s += 8;
      if (S.M.cityAt[h] >= 0 && sideOfH(S, h) !== side) s -= 1;
      return s;
    });
  }
}
function marchRet(S, A, us, p) {
  const F = field(S, A.side, p.obj), side = A.side;
  for (const u of us)
    bestMove(S, u, (h) => F[h] * 1 + enemyNear(S, h, side) * 2.5 + (zoc(S, h, side) ? 2 : 0), true);
}
function marchRes(S, A, us) {
  const side = A.side, fd = S.frontDist?.[side];
  for (const u of us) bestMove(S, u, (h) => (fd ? Math.abs(fd[h] - 5) : 0) + enemyNear(S, h, side) * 3, true);
}
const hardAt = (S, h) => { const ci = S.M.cityAt[h]; return ci >= 0 && !!S.M.cities[ci].hard; };
// оборона: закрыть гексы своего участка по нужде, лишних — во второй эшелон
function marchDef(S, A, us, lab, ai, need) {
  const M = S.M, side = A.side, fd = S.frontDist?.[side];
  const mine = [];
  for (const [h, n] of need) if (lab[h] === ai) mine.push(h);
  if (!mine.length) {
    // нет своего участка — к ближайшему участку фронта своей группы
    for (const u of us) bestMove(S, u, (h) => (fd ? fd[h] : 0) * 1 + Math.max(0, stackN(S, h) - 1) * 0.5, true);
    return;
  }
  const have = new Map();
  for (const h of mine) have.set(h, unitsAt(S, h).filter((x) => x.side === side).length);
  // кто уже стоит на фронте — остаётся (кроме лишних)
  const free = [];
  for (const u of us) {
    const n = need.get(u.h);
    // измотанные (порядок < 22) уходят во второй эшелон — но не из городов-крепостей: там стоят до смены
    if (n != null && lab[u.h] === ai && have.get(u.h) <= Math.ceil(n) + 0 && (u.org >= 22 || u.ent >= 2.5 || hardAt(S, u.h))) continue;
    if (n != null && lab[u.h] === ai) have.set(u.h, have.get(u.h) - 1);
    free.push(u);
  }
  // дефицит, самые угрожаемые — первыми
  const gaps = mine.filter((h) => have.get(h) < need.get(h)).sort((a, b) => need.get(b) - have.get(b) - (need.get(a) - have.get(a)));
  for (const h of gaps) {
    while (have.get(h) < need.get(h) && free.length) {
      // ближайшая свободная дивизия
      let bi = -1, bd = 1e9;
      for (let i = 0; i < free.length; i++) {
        const dd = M.dist(free[i].h, h) - (isMech(free[i]) ? 0.5 : 0);
        if (dd < bd) (bd = dd), (bi = i);
      }
      if (bi < 0 || bd > 14) break;
      const u = free.splice(bi, 1)[0];
      const R = reach(S, u);
      if (R.has(h) && stackN(S, h) < stackCap(S, h)) doMove(S, u, pathTo(R, h));
      else {
        // ближе к цели
        let best = u.h, bs = M.dist(u.h, h);
        for (const [x] of R) if (x !== u.h && stackN(S, x) < stackCap(S, x) && M.dist(x, h) < bs && (sideOfH(S, x) === side || NS0(S, x) === side)) (bs = M.dist(x, h)), (best = x);
        if (best !== u.h) doMove(S, u, pathTo(R, best));
      }
      have.set(h, have.get(h) + 1);
    }
  }
  // остальные — второй эшелон за угрожаемыми гексами
  for (const u of free) {
    if (!alive(u) || u.mp <= 0 || u.mv) continue;
    bestMove(S, u, (h) => {
      const f = fd ? fd[h] : 1;
      let s = Math.abs(f - 1) * 1.5 + enemyNear(S, h, side) * 1.5 + Math.max(0, stackN(S, h) - 1) * 0.6;
      // поближе к своему участку
      let md = 9;
      for (const x of mine) { const dd = M.dist(x, h); if (dd < md) md = dd; }
      return s + md * 0.8;
    }, true);
  }
}
// переброски по ж/д: дивизии далеко от своей армии (новые, резервы) — к её участку
function railMoves(S, side, act, lab, opt) {
  const M = S.M;
  let cap = S.railCap?.[side] ?? 0;
  if (cap <= 0) return;
  const net = railNet(S, side), fd = S.frontDist?.[side];
  for (const A of act) {
    if (cap <= 0) break;
    const c = A._p.obj >= 0 && A._p.k === 'atk' ? A._p.obj : centroid(S, A._us.filter((u) => fd && fd[u.h] < 6)) ;
    if (c < 0) continue;
    for (const u of A._us) {
      if (cap <= 0) break;
      if (!alive(u) || u.mv || u.at || !railOK(S, u.h, side) || net[u.h] < 0 || zoc(S, u.h, side)) continue;
      if (M.dist(u.h, c) < 9) continue;
      // станция поближе к армии, не у самого фронта
      let best = -1, bs = 1e9;
      for (const h of M.ring(c, 6)) {
        if (!railOK(S, h, side) || net[h] < 0 || zoc(S, h, side) || stackN(S, h) >= stackCap(S, h)) continue;
        if (fd && fd[h] < 2) continue;
        const s = M.dist(h, c);
        if (s < bs) (bs = s), (best = h);
      }
      if (best < 0 || M.dist(best, u.h) < 6) continue;
      railMove(S, u, best);
      cap--;
    }
  }
  S.railCap[side] = cap;
}
export function railMove(S, u, h) {
  placeAt(S, u, h);
  u.mp = 0;
  u.mv = 1;
  u.ral = 1;
  u.ent = 0;
  u.org = Math.max(0, u.org - 8);
}
