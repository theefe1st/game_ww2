// «Мировой фронт» v0.10, «Восточный фронт»: ИИ направлений — исполняет позицию направления (оборона, наступление
// с целью, отход) для обеих сторон: за противника — всегда, за игрока — для его направлений по нажатию «Ход».
// Порядок фазы: позиции (план или оценка сил) → переброска резервов → наступления → оборона и закрытие дыр →
// развитие прорывов подвижными войсками → набор дивизий и постройки.
import {
  ZN, sideOf, isFront, attackersFor, odds, resolveAttack, reach, moveTo, room, railTargets, railMove, beginPhase, endPhase, baseCV, defCV,
  attCV, garOf, isSource, frontDist, recruit, build, canBuild, evacuate, canEvac, regionDef, alive, cap, genOf, hasTr, unitsAt, newCost, BUILD, note, natOf,
  armyCap, armySize, FN, fzOf, frontMap, frontZone, airRatio,
} from './engine.js';
import { other, isMech, yearF, turnOf, TYPES, SIDE0, dateOf, lerpT } from './rules.js';
import { PLAN, GEN_HIST } from './hist.js';
import { MIX, mixNow, eqTot, hasEq, brigFree } from './eco.js';
export { MIX, mixNow };
import { placeR } from './setup.js';
import { PEACE_EXTRA } from './prewar.js';

// ——— позиции и цели направлений ———
export function planOf(S, side, z) {
  let cur = null;
  for (const p of PLAN) if (p[0] === side && p[1] === z && turnOf(p[2]) <= S.turn) cur = p;
  return cur;
}
// текущая цель: первый город списка, ещё не взятый
export function planTarget(S, side, list) {
  for (const n of list.split('|').filter(Boolean)) { const r = placeR(S, n); if (r >= 0 && sideOf(S, r) !== side) return r; }
  return -1;
}
function histGenerals(S, side) {
  GEN_HIST[side].forEach((L, z) => {
    const F = S.fr?.[side]?.[z];
    if (F && (!F.on || F.pick)) return; // генерала выбрал игрок
    let k = L[0];
    for (const x of L.slice(1)) if (turnOf(x[0]) <= S.turn) k = x[1];
    if (S.gen[side].some((g, f) => f !== z && g === k && S.fr?.[side]?.[f]?.on)) return; // уже командует другим фронтом
    S.gen[side][z] = k;
  });
}
export const frontsOn = (S, side) => [...Array(FN).keys()].filter((f) => (S.fr?.[side] ? S.fr[side][f]?.on : f < ZN));
// силы сторон на фронте (атака своих против обороны противника перед ним)
export function zoneForce(S, side, z, fm = frontMap(S, side)) {
  let a = 0, d = 0;
  for (const u of S.units) {
    if (!alive(u) || fm[u.r] !== z) continue;
    if (u.s === side) a += baseCV(S, u, 'att'); else d += baseCV(S, u, 'def');
  }
  return { a, d };
}
export function setPostures(S, side, isAI) {
  if (isAI && S.mode === 'hist') histGenerals(S, side);
  // мирное время (ранние старты, prewar.js): все фронты — в обороне, целей нет
  if (S.peace) { for (const z of frontsOn(S, side)) { S.post[side][z] = 'def'; S.tgt[side][z] = -1; } return; }
  const fm = frontMap(S, side);
  for (const z of frontsOn(S, side)) {
    if (!isAI) { if (S.post[side][z] === 'atk' && S.tgt[side][z] >= 0 && sideOf(S, S.tgt[side][z]) === side) S.tgt[side][z] = -1; continue; }
    if (S.mode === 'hist') {
      const p = planOf(S, side, z);
      S.post[side][z] = p ? p[3] : 'def';
      S.tgt[side][z] = p && p[3] === 'atk' ? planTarget(S, side, p[4]) : -1;
      // цели плана взяты раньше срока — закрепиться (не уходить за Волгу, не рваться к Берлину раньше времени);
      // но в конце войны (план фронта исчерпан, с осени 1944) — дальше, к ближним городам врага: иначе фронты стоят,
      // пока один штурмует Берлин
      if (S.post[side][z] === 'atk' && S.tgt[side][z] < 0) {
        const last = side === 'SOV' && yearF(S.turn) >= 1944.6 && !PLAN.some((q) => q[0] === side && q[1] === z && turnOf(q[2]) > S.turn);
        if (last) S.tgt[side][z] = autoTarget(S, side, z);
        if (S.tgt[side][z] < 0) S.post[side][z] = 'def';
      }
      continue;
    }
    // свободный режим: по соотношению сил и погоде
    const f = zoneForce(S, side, z, fm), k = f.a / (f.d + 1), wx = S.wx[frontZone(S, side, z)];
    const cur = S.post[side][z];
    let p = cur;
    // отход целым направлением ИИ не объявляет (только отдельные дивизии из котлов)
    // зимние наступления Красной армии; вермахт зимой наступает только с большим перевесом
    // летом и осенью 1941 г. инициатива у вермахта (наступает и при равных силах); с 1943 г. — стратегическая
    // оборона: наступает только при явном перевесе (иначе глубокие выступы срезаются зимой целыми группами армий)
    const y = yearF(S.turn), ky = side === 'GER' ? (y < 1941.9 ? 0.7 : y >= 1944 ? 1.8 : y >= 1943 ? 1.4 : 1) : 1;
    const kw = (wx === 'snow' || wx === 'frost' ? (side === 'SOV' ? 0.85 : 1.4) : 1) * ky;
    if (k >= (cur === 'atk' ? 0.95 : 1.2) * kw && wx !== 'mud') p = 'atk';
    else if (cur !== 'def' && k < 0.95 * kw) p = 'def';
    S.post[side][z] = p;
    if (p === 'atk' && (S.tgt[side][z] < 0 || sideOf(S, S.tgt[side][z]) === side)) S.tgt[side][z] = autoTarget(S, side, z);
    if (p === 'atk' && S.tgt[side][z] < 0) S.post[side][z] = 'def';
  }
}
// цель наступления: ценный город противника недалеко от фронта направления
export function autoTarget(S, side, z) {
  const M = S.M, d = distFromFront(S, side), fm = frontMap(S, side);
  let best = -1, bs = -1e9;
  for (const g of M.reg) {
    if (sideOf(S, g.id) !== other(side) || g.vp <= 0) continue;
    const dz = fm[g.id] === z ? 0 : 6, k = d[g.id];
    if (k > 5) continue; // не дальше 5 областей от фронта: иначе прорыв отрывается от снабжения
    const s = g.vp * 3 - k * 4 - dz;
    if (s > bs) (bs = s), (best = g.id);
  }
  return best;
}
// ближняя цель для приказа игрока «Наступление»: город или узел в 1–3 областях от фронта (а не столица за тысячу км)
export function nearTarget(S, side, z) {
  const M = S.M, d = distFromFront(S, side), fm = frontMap(S, side), cu = side === S.side && S.fcust;
  let best = -1, bs = -1e9;
  for (const g of M.reg) {
    if (sideOf(S, g.id) !== other(side) || (g.vp <= 0 && !g.city)) continue;
    const k = d[g.id];
    if (k > 4 || (cu ? fm[g.id] !== z && k > 2 : Math.abs(g.z - z) > 1)) continue;
    const s = g.vp * 2 + (g.city ? 1 : 0) - k * 5 - (fm[g.id] === z ? 0 : 6);
    if (s > bs) (bs = s), (best = g.id);
  }
  return best >= 0 ? best : autoTarget(S, side, z);
}
// расстояние (в областях) от своей линии фронта вглубь противника
function distFromFront(S, side) {
  const M = S.M, d = new Int16Array(M.R).fill(99), q = [];
  for (let r = 0; r < M.R; r++) if (sideOf(S, r) === side && isFront(S, r, side)) (d[r] = 0), q.push(r);
  for (let h = 0; h < q.length; h++) { const r = q[h]; for (const e of M.reg[r].nb) if (sideOf(S, e.r) === other(side) && d[e.r] > d[r] + 1) (d[e.r] = d[r] + 1), q.push(e.r); }
  return d;
}
// расстояние до цели (в областях, по всей карте)
const distCache = new Map();
export function distTo(S, T) {
  if (distCache.has(T)) return distCache.get(T);
  const M = S.M, d = new Int16Array(M.R).fill(999), q = [T];
  d[T] = 0;
  for (let h = 0; h < q.length; h++) { const r = q[h]; for (const e of M.reg[r].nb) if (d[e.r] > d[r] + 1) (d[e.r] = d[r] + 1), q.push(e.r); }
  if (distCache.size > 200) distCache.clear();
  distCache.set(T, d);
  return d;
}
// ——— угрозы ———
function threatMap(S, side) {
  const M = S.M, en = other(side), thr = new Float32Array(M.R);
  for (let e = 0; e < M.R; e++) {
    if (sideOf(S, e) !== en || !S.at[e].length) continue;
    let a = 0;
    for (const u of S.at[e]) if (u.s === en) a += baseCV(S, u, 'att');
    const tg = M.reg[e].nb.filter((n) => sideOf(S, n.r) === side && n.sp !== 'sea');
    for (const n of tg) thr[n.r] += a / Math.sqrt(tg.length);
  }
  return thr;
}
const free = (u) => alive(u) && !u.man && !u.att && u.mp > 0.2;
// ——— фаза стороны ———
export function runSide(S, side, { isAI = true, begun = false } = {}) {
  if (!begun) beginPhase(S, side);
  setPostures(S, side, isAI);
  // фронты «вручную»: генералы не трогают их дивизии (ходит сам игрок)
  if (!isAI && S.fr?.[side]) for (const u of S.units) if (u.s === side && alive(u) && S.fr[side][fzOf(S, u.r)]?.man) u.man = 1;
  const C = { side, en: other(side), thr: threatMap(S, side), fd: frontDist(S, side), isAI, fm: frontMap(S, side) };
  C.fzn = Array.from({ length: FN }, (_, f) => frontZone(S, side, f));
  if (S.peace) return peaceSide(S, C);
  strategic(S, C);
  forward(S, C);
  breakout(S, C);
  const order = frontsOn(S, side).filter((z) => !(S.fr?.[side]?.[z]?.man && !isAI)).sort((a, b) => (S.post[side][b] === 'atk' ? 1 : 0) - (S.post[side][a] === 'atk' ? 1 : 0));
  for (const z of order) if (S.post[side][z] === 'atk') offensive(S, C, z);
  for (const z of order) if (S.post[side][z] === 'ret') withdraw(S, C, z);
  C.thr = threatMap(S, side); C.fd = frontDist(S, side); C.crit = null; C.fm = frontMap(S, side);
  salients(S, C);
  defend(S, C);
  for (const z of order) if (S.post[side][z] === 'atk') exploit(S, C, z);
  C.fd = frontDist(S, side); C.fm = frontMap(S, side);
  fillGaps(S, C);
  endPhase(S, side);
  if (isAI || S.auto.recruit) economyAI(S, side, isAI);
  for (const u of S.units) if (u.s === side) u.man = 0;
}
// мирное время: ИИ стоит в местах развёртывания 1941 г. (prewar.js: warStart), генералы игрока прикрывают границу
function peaceSide(S, C) {
  const { side, isAI } = C;
  if (!isAI) toPlan(S, side);
  endPhase(S, side);
  if (!isAI && (S.auto.recruit || S.auto.build)) economyAI(S, side, false);
  for (const u of S.units) if (u.s === side) u.man = 0;
}
// мирное время: генералы игрока ведут дивизии на места по плану прикрытия 1941 г. (u.hp), когда та земля уже своя;
// призыв игрока и дивизии, сдвинутые вручную, стоят, где их поставили (нейтральные соседи — не фронт, границу не оголять)
function toPlan(S, side) {
  for (const u of S.units) {
    if (u.s !== side || !free(u) || u.hp === undefined || u.r < 0 || u.r === u.hp || sideOf(S, u.hp) !== side) continue;
    const d = distTo(S, u.hp), near = (rs) => { let b = -1, bd = d[u.r]; for (const r of rs) if (d[r] < bd && room(S, r, side) > 0) (bd = d[r]), (b = r); return b; };
    if (d[u.r] >= 999) { // остров без связей (Сааремаа) — морем
      if (room(S, u.hp, side) > 0) { const a = S.at[u.r]; a.splice(a.indexOf(u), 1); u.r = u.hp; S.at[u.hp].push(u); u.mp = 0; u.mv = 1; u.ent = 0; }
      continue;
    }
    if (d[u.r] > 2) { const b = near(railTargets(S, u)); if (b >= 0 && railMove(S, u, b)) continue; }
    const Rr = reach(S, u), b = near(Rr.best.keys());
    if (b >= 0) moveTo(S, u, b, Rr);
  }
}
// окружённые: пробиваться к своим (сначала движением, затем атакой в сторону снабжаемых областей)
function breakout(S, C) {
  const { side } = C, M = S.M, sup = S.sup[side];
  const pocket = S.units.filter((u) => alive(u) && u.s === side && sup[u.r] <= 0 && !u.man);
  if (!pocket.length) return;
  const d = new Int16Array(M.R).fill(999), q = [];
  for (let r = 0; r < M.R; r++) if (sideOf(S, r) === side && sup[r] > 0.3) (d[r] = 0), q.push(r);
  for (let h = 0; h < q.length; h++) { const r = q[h]; for (const e of M.reg[r].nb) if (sideOf(S, e.r) && d[e.r] > d[r] + 1) (d[e.r] = d[r] + 1), q.push(e.r); }
  for (const u of pocket) {
    if (!alive(u) || u.mp <= 0.2) continue;
    const Rr = reach(S, u);
    let best = -1, bd = d[u.r];
    for (const [r] of Rr.best) if (d[r] < bd && room(S, r, side) > 0) (bd = d[r]), (best = r);
    if (best >= 0) moveTo(S, u, best, Rr);
  }
  const tried = new Set();
  for (const u of pocket) {
    if (!alive(u) || u.att || sup[u.r] > 0) continue;
    let T = -1, td = d[u.r];
    for (const e of M.reg[u.r].nb) if (sideOf(S, e.r) === C.en && d[e.r] < td) (td = d[e.r]), (T = e.r);
    if (T < 0 || tried.has(T)) continue;
    tried.add(T);
    // прорыв изнутри и деблокирующий удар снаружи
    const us = attackersFor(S, T, side).filter((v) => !v.man && (sup[v.r] <= 0 || (canAttackNow(v) && keepOK(S, C, v))));
    if (us.some((v) => sup[v.r] <= 0) && odds(S, T, us).R >= 0.8) resolveAttack(S, T, us, {});
  }
}
// резервы в тылу — по железной дороге к участкам с нехваткой сил
function strategic(S, C) {
  const { side } = C, M = S.M;
  const need = deficits(S, C);
  if (!need.length) return;
  const rear = S.units.filter((u) => free(u) && u.s === side && !u.mv && C.fd[u.r] >= 2 && S.sup[side][u.r] >= 0.6);
  rear.sort((a, b) => baseCV(S, b, 'def') - baseCV(S, a, 'def'));
  for (const u of rear) {
    if (S.railCap[side] <= 0) break;
    const top = need.find((n) => n.def < n.want);
    if (!top) break;
    const T = railTargets(S, u);
    if (!T.length) continue;
    // ближайшая к нуждающемуся участку станция (сам участок или соседний тыл)
    let best = -1, bd = 1e9;
    for (const r of T) {
      if (room(S, r, side) <= 0) continue;
      const dd = Math.hypot(M.reg[r].x - M.reg[top.r].x, M.reg[r].y - M.reg[top.r].y) + (r === top.r ? -40 : 0) + (C.fd[r] === 0 && r !== top.r ? 60 : 0);
      if (dd < bd) (bd = dd), (best = r);
    }
    if (best >= 0 && bd < 600 && railMove(S, u, best)) { top.def += defCV(S, u) * 0.8; need.sort((a, b) => b.want - b.def - (a.want - a.def)); }
  }
}
// остальные тыловые дивизии — ближе к фронту (по железной дороге или пешим порядком), прежде всего туда, где наступаем
function forward(S, C) {
  const { side } = C, M = S.M;
  const rear = S.units.filter((u) => free(u) && u.s === side && !u.mv && C.fd[u.r] >= 3 && u.t !== 'sec' && S.sup[side][u.r] > 0);
  for (const u of rear) {
    if (S.railCap[side] > 0) {
      let best = -1, bs = -1e9;
      for (const r of railTargets(S, u)) {
        if (room(S, r, side) <= 2 || C.fd[r] < 1 || C.fd[r] > 2) continue;
        const z = C.fm[r];
        const s = (S.post[side][z] === 'atk' ? 25 : 0) - S.at[r].length * 3 - Math.hypot(M.reg[r].x - M.reg[u.r].x, M.reg[r].y - M.reg[u.r].y) / 120 + (C.fd[r] === 1 ? 4 : 0);
        if (s > bs) (bs = s), (best = r);
      }
      if (best >= 0 && railMove(S, u, best)) continue;
    }
    const Rr = reach(S, u);
    let best = -1, bd = C.fd[u.r];
    for (const [r] of Rr.best) if (sideOf(S, r) === side && C.fd[r] >= 1 && C.fd[r] < bd && room(S, r, side) > 2) (bd = C.fd[r]), (best = r);
    if (best >= 0) moveTo(S, u, best, Rr);
  }
}
// «горлышки» снабжения: сколько своих дивизий останется без снабжения, если область будет потеряна
function critical(S, side, fd) {
  const M = S.M, R = M.R, src = [];
  for (let r = 0; r < R; r++) if (isSource(S, r, side)) src.push(r);
  const cnt = new Int16Array(R);
  for (let r = 0; r < R; r++) cnt[r] = S.at[r].filter((u) => u.s === side).length;
  const base = reachSet(S, side, src, -1);
  const out = new Map();
  for (let r = 0; r < R; r++) {
    if (fd[r] !== 0 || sideOf(S, r) !== side) continue;
    const got = reachSet(S, side, src, r);
    let lost = 0;
    for (let q = 0; q < R; q++) if (base[q] && !got[q] && q !== r) lost += cnt[q];
    if (lost >= 4) out.set(r, lost);
  }
  return out;
}
function reachSet(S, side, src, cut) {
  const M = S.M, seen = new Uint8Array(M.R), q = [];
  for (const r of src) if (r !== cut) (seen[r] = 1), q.push(r);
  for (let h = 0; h < q.length; h++) for (const e of M.reg[q[h]].nb) if (!seen[e.r] && e.r !== cut && sideOf(S, e.r) === side && e.sp !== 'sea') (seen[e.r] = 1), q.push(e.r);
  return seen;
}
function deficits(S, C) {
  const { side } = C, M = S.M, out = [];
  C.crit ??= critical(S, side, C.fd);
  for (let r = 0; r < M.R; r++) {
    if (sideOf(S, r) !== side) continue;
    const vp = M.reg[r].vp;
    // крупные города у фронта держат и во втором эшелоне
    if (C.fd[r] > 0 && C.fd[r] <= 2 && vp >= 3) {
      const near = Math.max(0, ...M.reg[r].nb.map((n) => C.thr[n.r] || 0));
      out.push({ r, z: C.fm[r], def: regionDef(S, r) - garOf(S, r) * 0.6, want: Math.max(vp * 2.2, near * (C.fd[r] === 1 ? 0.5 : 0.3)), vp });
      continue;
    }
    if (C.fd[r] !== 0) continue;
    const z = C.fm[r], p = S.post[side][z];
    const k = p === 'atk' ? 0.95 : p === 'ret' ? 0.4 : 0.85;
    const want = Math.max(C.thr[r] * k / 1.25, 2.2) * (1 + Math.min(vp, 10) * 0.1) * (1 + Math.min(1.5, (C.crit.get(r) || 0) / 12));
    out.push({ r, z, def: regionDef(S, r) - garOf(S, r) * 0.6, want, vp });
  }
  out.sort((a, b) => b.want - b.def - (a.want - a.def));
  return out;
}
// «не штурмовать» (режим «Исторический»): Ленинград — блокада, а не штурм, пока у города есть снабжение
const NO_STORM = [['GER', 'Ленинград', '1944-12-31']];
function noStorm(S, side) {
  const out = new Set();
  if (S.mode !== 'hist') return out;
  for (const [sd, n, until] of NO_STORM) if (sd === side && S.turn <= turnOf(until)) { const r = placeR(S, n); if (r >= 0 && S.sup[other(side)][r] > 0) out.add(r); }
  return out;
}
// ——— наступление ———
function offensive(S, C, z) {
  const { side } = C, M = S.M, T = S.tgt[side][z];
  if (T < 0) return;
  const ns = noStorm(S, side);
  const dT = distTo(S, T);
  const early41 = side === 'GER' && S.turn <= 2;
  const rMin = (side === 'GER' ? 1.3 : 1.25) * (S.wx[C.fzn[z]] === 'mud' ? 1.15 : 1);
  let masses = 0;
  for (let pass = 0; pass < 3; pass++) {
    const cand = [];
    for (let e = 0; e < M.R; e++) {
      if (sideOf(S, e) !== C.en || ns.has(e)) continue;
      const nb = M.reg[e].nb.filter((n) => sideOf(S, n.r) === side && C.fm[n.r] === z);
      if (!nb.length && C.fm[e] !== z) continue;
      const us = attackersFor(S, e, side).filter((u) => !u.man && (C.fm[u.r] === z || isMech(u)));
      if (!us.length) continue;
      const o = odds(S, e, us);
      const prog = Math.min(...nb.map((n) => dT[n.r]), dT[e] + 1) - dT[e];
      // не уходить в сторону от цели (кроме возврата своих земель): иначе удары «куда попало», хоть на Берлин
      if (prog < 0 && e !== T && SIDE0[M.nats[S.own0[e]]] !== side) continue;
      const s = prog * 6 - dT[e] * 0.9 + M.reg[e].vp * 1.5 + Math.min(o.R, 4) * 3 + (S.at[e].length || garOf(S, e) ? 0 : 6) + (e === T ? 8 : 0);
      cand.push({ e, us, o, s });
    }
    if (!cand.length) return;
    cand.sort((a, b) => b.s - a.s);
    let did = 0;
    for (const c of cand.slice(0, 10)) {
      const us = c.us.filter((u) => canAttackNow(u));
      if (!us.length) continue;
      if (!S.at[c.e].length && !garOf(S, c.e)) { // пустая — занять
        const u = us.sort((a, b) => (isMech(b) ? 1 : 0) - (isMech(a) ? 1 : 0))[0];
        if (keepOK(S, C, u)) { const Rr = reach(S, u); if (moveTo(S, u, c.e, Rr)) did++; }
        continue;
      }
      // подобрать атакующих до нужного перевеса, не оголяя участки
      us.sort((a, b) => attCV(S, b, c.e) - attCV(S, a, c.e));
      const pick = [];
      for (const u of us) {
        if (!keepOK(S, C, u, pick)) continue;
        pick.push(u);
        if (odds(S, c.e, pick).R >= rMin * 1.35) break;
      }
      if (!pick.length) continue;
      let o = odds(S, c.e, pick);
      // не хватает перевеса на главном участке — подтянуть второй эшелон; в конце войны цель фронта (Кёнигсберг,
      // Будапешт, Берлин…) штурмуют и при слабом начальном перевесе: стягивают больше дивизий
      const push = c.e === T && side === 'SOV' && yearF(S.turn) >= 1944.5;
      if (o.R < rMin && masses < 3 && o.R >= rMin * (push ? 0.12 : 0.45)) { masses++; if (massFor(S, C, c.e, pick, rMin * 1.2, push ? 24 : 14)) o = odds(S, c.e, pick); }
      if (o.R < (early41 ? 0.95 : rMin)) continue;
      const main = mainOrigin(pick);
      const keep = new Set(pick.filter((u) => u.r !== main && !isMech(u)));
      resolveAttack(S, c.e, pick, { keep });
      did++;
    }
    if (!did) break;
  }
}
// сосредоточение: дивизии второго эшелона (в пределах хода) выходят к области атаки, пока не наберётся перевес
function massFor(S, C, e, pick, rWant, nMax = 14) {
  const { side } = C, M = S.M, g = M.reg[e];
  const adj = g.nb.filter((n) => sideOf(S, n.r) === side && n.sp !== 'sea').map((n) => n.r);
  if (!adj.length) return false;
  const near = new Set(adj);
  const pool = S.units.filter((u) => canAttackNow(u) && u.s === side && !u.mv && u.rdy >= 55 && !near.has(u.r) && !pick.includes(u) && Math.abs(M.reg[u.r].x - g.x) + Math.abs(M.reg[u.r].y - g.y) < 520);
  pool.sort((a, b) => Math.abs(M.reg[a.r].x - g.x) + Math.abs(M.reg[a.r].y - g.y) - (Math.abs(M.reg[b.r].x - g.x) + Math.abs(M.reg[b.r].y - g.y)));
  let n = 0;
  for (const u of pool) {
    if (n >= nMax) break;
    if (!keepOK(S, C, u)) continue;
    n++;
    const Rr = reach(S, u);
    let best = -1, bc = 1e9;
    for (const r of adj) { const c = Rr.best.get(r); if (c !== undefined && room(S, r, side) > 0 && u.mp - c > 0.2 && c < bc) (bc = c), (best = r); }
    if (best < 0) continue;
    moveTo(S, u, best, Rr);
    if (u.r !== best) continue;
    pick.push(u);
    if (odds(S, e, pick).R >= rWant) return true;
  }
  return false;
}
const canAttackNow = (u) => alive(u) && !u.att && u.rdy >= 45 && u.t !== 'sec' && u.mp > 0.2 && !u.man;
function mainOrigin(us) {
  const w = new Map();
  for (const u of us) w.set(u.r, (w.get(u.r) || 0) + u.str);
  return [...w.entries()].sort((a, b) => b[1] - a[1])[0][0];
}
// можно ли забрать дивизию с участка: у фронта остаётся хотя бы одна (кроме уходящих)
function keepOK(S, C, u, pick = []) {
  if (!isFront(S, u.r, C.side)) return true;
  const stay = S.at[u.r].filter((v) => v.s === C.side && v !== u && !pick.includes(v) && !v.att);
  if (stay.length >= 1) return true;
  // последняя дивизия: можно, только если угрозы почти нет
  return C.thr[u.r] < 1.5;
}
// развитие прорыва: подвижные войска идут в пустые области, повторные атаки по слабым
function exploit(S, C, z) {
  const { side } = C, M = S.M, T = S.tgt[side][z];
  if (T < 0) return;
  const ns = noStorm(S, side);
  const dT = distTo(S, T);
  const mech = S.units.filter((u) => alive(u) && u.s === side && (isMech(u) || u.t === 'cav') && !u.man && u.mp >= 1 && u.rdy >= 35 && C.fm[u.r] === z);
  for (const u of mech) {
    for (let step = 0; step < 3 && u.mp >= 1; step++) {
      const Rr = reach(S, u);
      let best = -1, bs = -1e9;
      const sd = S.supD[side];
      for (const [r, c] of Rr.best) {
        if (r === u.r || sideOf(S, r) === side || S.at[r].length) continue;
        // не отрываться от снабжения: прорыв — не дальше 3 областей от железной дороги
        if (Math.min(...M.reg[r].nb.filter((n) => sideOf(S, n.r) === side).map((n) => sd[n.r])) >= 3) continue;
        // окружение: ценнее области, вокруг которых противник
        let enc = 0;
        for (const n of M.reg[r].nb) if (S.at[n.r].length && S.at[n.r][0].s === C.en) enc += S.at[n.r].length;
        const s = (dT[u.r] - dT[r]) * 5 + enc * 1.2 + M.reg[r].vp * 2 - c;
        if (s > bs) (bs = s), (best = r);
      }
      if (best < 0 || bs < 0) break;
      if (!keepOK(S, C, u)) break;
      moveTo(S, u, best, Rr);
    }
    // повторная атака по слабым при большом перевесе
    if (u.mp >= 1 && u.rdy >= 45 && !u.att) {
      let best = -1, br = 0;
      for (const n of M.reg[u.r].nb) {
        if (sideOf(S, n.r) !== C.en || (!S.at[n.r].length && !garOf(S, n.r)) || ns.has(n.r)) continue;
        const R = odds(S, n.r, [u]).R;
        if (R > br) (br = R), (best = n.r);
      }
      if (best >= 0 && br >= 2.2 && keepOK(S, C, u)) resolveAttack(S, best, [u], {});
    }
  }
}
// ——— отход ———
function withdraw(S, C, z) {
  const { side } = C, M = S.M;
  for (let r = 0; r < M.R; r++) {
    if (sideOf(S, r) !== side || C.fm[r] !== z || C.fd[r] !== 0) continue;
    for (const u of S.at[r].filter((v) => v.s === side && free(v))) {
      const Rr = reach(S, u);
      let best = -1, bs = -1e9;
      for (const [b, c] of Rr.best) {
        if (sideOf(S, b) !== side || C.fd[b] < 1 || room(S, b, side) <= 0) continue;
        let riv = 0;
        for (const n of M.reg[b].nb) if (C.fd[n.r] === 0 && n.riv) riv += n.riv;
        const s = -Math.abs(C.fd[b] - 1.5) * 5 + riv * 2 + M.reg[b].vp - c;
        if (s > bs) (bs = s), (best = b);
      }
      if (best >= 0) moveTo(S, u, best, Rr);
    }
  }
}
// ——— оборона: подтянуть силы к угрожаемым участкам, контрудары ———
function defend(S, C) {
  const { side } = C, M = S.M;
  const need = deficits(S, C);
  // тыловые и избыточные дивизии
  const pool = S.units.filter((u) => free(u) && u.s === side && !u.mv);
  const R = new Map();
  const reachOf = (u) => R.get(u) || (R.set(u, reach(S, u)), R.get(u));
  for (const n of need) {
    if (n.def >= n.want) continue;
    if (S.post[side][n.z] === 'ret') continue;
    // кандидаты: тыл в досягаемости или соседний участок с избытком
    const cand = [];
    for (const u of pool) {
      if (!alive(u) || u.mv || u.r === n.r) continue;
      const dist = Math.abs(M.reg[u.r].x - M.reg[n.r].x) + Math.abs(M.reg[u.r].y - M.reg[n.r].y);
      if (dist > 700) continue;
      if (C.fd[u.r] === 0) {
        const m = need.find((q) => q.r === u.r);
        if (!m || m.def - defCV(S, u) < m.want * 1.05) continue;
      }
      cand.push([u, dist]);
    }
    cand.sort((a, b) => a[1] - b[1]);
    for (const [u] of cand) {
      if (n.def >= n.want || room(S, n.r, side) <= 0) break;
      const Rr = reachOf(u);
      if (!Rr.best.has(n.r)) continue;
      const from = need.find((q) => q.r === u.r);
      if (moveTo(S, u, n.r, Rr)) { const d = defCV(S, u); n.def += d; if (from) from.def -= d; }
    }
  }
  // контрудары: хорошие шансы или свой город
  for (let e = 0; e < M.R; e++) {
    if (sideOf(S, e) !== C.en || (!S.at[e].length && !garOf(S, e))) continue;
    const z = C.fm[e];
    if (S.post[side][z] === 'ret') continue;
    const us = attackersFor(S, e, side).filter((u) => !u.man);
    if (!us.length) continue;
    const own0 = SIDE0[M.nats[S.own0[e]]] === side, fresh = S.capT[e] >= S.turn - (own0 ? 8 : 4);
    // контрудар — вернуть недавно потерянное (своё довоенное — до 8 недель), а не наступать без приказа;
    // давно занятые свои земли — только при большом перевесе (в «Историческом» оборона не превращается в наступление)
    if (!fresh && !own0) continue;
    const need = (side === 'SOV' && S.turn < 30 ? 1.45 : 1.7) * (own0 && M.reg[e].vp >= 2 ? 0.85 : 1) * (fresh ? 1 : S.mode === 'hist' ? 1.45 : 1.15);
    us.sort((a, b) => attCV(S, b, e) - attCV(S, a, e));
    const pick = [];
    for (const u of us) { if (keepOK(S, C, u, pick)) pick.push(u); if (pick.length && odds(S, e, pick).R >= need * 1.3) break; }
    if (pick.length && odds(S, e, pick).R >= need) resolveAttack(S, e, pick, { keep: new Set(pick.filter((u) => u.r !== mainOrigin(pick) && !isMech(u))) });
  }
}
// выступы: из области, у которой своих соседей почти не осталось, — отойти, пока не замкнули кольцо
function salients(S, C) {
  const { side } = C, M = S.M;
  for (let r = 0; r < M.R; r++) {
    if (sideOf(S, r) !== side || C.fd[r] !== 0 || S.post[side][C.fm[r]] === 'atk') continue;
    const g = M.reg[r], nb = g.nb.filter((n) => n.sp !== 'sea' && sideOf(S, n.r));
    if (nb.length < 3 || nb.filter((n) => sideOf(S, n.r) === side).length >= 2) continue;
    if (g.vp >= 5 || g.f.includes('f')) continue; // крупные города и крепости держат
    for (const u of S.at[r].filter((v) => v.s === side && free(v))) {
      const Rr = reach(S, u);
      let best = -1, bs = -1e9;
      for (const [b, c] of Rr.best) {
        if (b === r || sideOf(S, b) !== side || room(S, b, side) <= 0) continue;
        const own = M.reg[b].nb.filter((n) => sideOf(S, n.r) === side).length;
        const sc = own * 3 + (S.sup[side][b] > 0.5 ? 5 : 0) - c;
        if (sc > bs) (bs = sc), (best = b);
      }
      if (best >= 0) moveTo(S, u, best, Rr);
    }
  }
}
// пустые участки фронта — хотя бы по одной дивизии
function fillGaps(S, C) {
  const { side } = C, M = S.M;
  for (let r = 0; r < M.R; r++) {
    if (sideOf(S, r) !== side || C.fd[r] !== 0 || S.at[r].some((u) => u.s === side)) continue;
    if (S.post[side][C.fm[r]] === 'ret') continue;
    let best = null, bd = 1e9;
    for (const n of M.reg[r].nb) {
      if (sideOf(S, n.r) !== side) continue;
      const us = S.at[n.r].filter((u) => u.s === side && free(u));
      const stay = S.at[n.r].filter((u) => u.s === side).length;
      if (!us.length || (C.fd[n.r] === 0 && stay < 2)) continue;
      const u = us.sort((a, b) => baseCV(S, a, 'def') - baseCV(S, b, 'def'))[0];
      const d = C.fd[n.r] === 0 ? 1 : 0;
      if (d < bd) (bd = d), (best = u);
    }
    if (best) { const Rr = reach(S, best); moveTo(S, best, r, Rr); }
  }
}
// ——— хозяйство ИИ: набор, постройки, эвакуация ———
export function economyAI(S, side, isAI) {
  const M = S.M;
  // эвакуация заводов у фронта (СССР, 1941–1942)
  if (side === 'SOV' && (isAI || S.auto.recruit) && S.turn < 70 && (isAI || S.flags.evacAuto)) {
    const d = frontDist(S, 'SOV');
    for (let r = 0; r < M.R; r++) if (d[r] <= 1 && canEvac(S, r) && S.turn >= 1) evacuate(S, r);
  }
  // укрепления на угрожаемых участках
  const thr = threatMap(S, side), fdd = frontDist(S, side), fm = frontMap(S, side);
  const fr = [];
  for (let r = 0; r < M.R; r++) {
    if (sideOf(S, r) !== side || S.fort[r] >= (M.reg[r].vp >= 2 ? 3 : 2) || fdd[r] > 1) continue;
    // передний край — по угрозе; второй рубеж — у крупных городов и узлов
    const w = fdd[r] === 0 ? thr[r] : Math.max(0, ...M.reg[r].nb.map((n) => thr[n.r] || 0)) * 0.45;
    fr.push([r, w * (1 + M.reg[r].vp * 0.15) - S.fort[r] * 4]);
  }
  fr.sort((a, b) => b[1] - a[1]);
  // свободные стройбригады — на укрепления
  // (темп ИИ — как в v0.10: при скудных запасах снаряжения стройка идёт медленнее)
  // мирное время: «стройка — авто» — заводы в тылу (укрепления и ПВО — вручную)
  if (S.peace && !isAI && S.auto.build) peaceBuild(S, side, fdd);
  const autoB = (isAI || S.auto.build) && !S.peace;
  let forts = autoB ? Math.max(0, Math.min(3, brigFree(S, side), Math.floor((eqTot(S, side) - 50) / 35))) : 0;
  for (const [r, w] of fr) { if (forts <= 0 || w <= 0) break; if (S.post[side][fm[r]] === 'atk' && fdd[r] === 0 && w < 20) continue; if (build(S, side, r, 'fort')) forts--; }
  // ПВО — у крупных городов у фронта, где небо за противником (не чаще раза в 4 недели)
  if (autoB && S.turn % 4 === 0 && brigFree(S, side) > 0 && eqTot(S, side) > 80) {
    let best = -1, bw = 0;
    for (let r = 0; r < M.R; r++) {
      if (sideOf(S, r) !== side || fdd[r] > 2 || M.reg[r].vp < 2 || S.aa[r] || airRatio(S, side, M.reg[r].z) > 0.38) continue;
      const w = (thr[r] + 1) * (1 + M.reg[r].vp);
      if (w > bw && canBuild(S, side, r, 'aa')) (bw = w), (best = r);
    }
    if (best >= 0) build(S, side, best, 'aa');
  }
  if (!isAI && !S.auto.recruit) return;
  // набор дивизий: запас — на пополнение
  const reserve = { pp: 30, men: side === 'SOV' ? 40 : 30 };
  const mix = mixNow(side, S.turn);
  const queued = S.units.filter((u) => u.s === side && u.r < 0 && !u.dead && u.arr !== undefined && !u.hist).length;
  const army = armySize(S, side);
  let capA = armyCap(S, side);
  // мирное время: сверх плана — понемногу, равномерно до 22 июня (а не всё сразу в первые недели)
  if (S.peace && S.t0 < 0) capA -= Math.floor(PEACE_EXTRA[side] * Math.max(0, Math.min(1, S.turn / S.t0)));
  let k = 0;
  while (k++ < 14 && queued + k < 40 && army + k <= capA) {
    let t = rndPick(S, mix);
    // по запасам: людей много, производства мало — пехота и кавалерия; наоборот — танки
    const st = eqTot(S, side), q = (st - reserve.pp) / Math.max(1, S.men[side] - reserve.men) / (newCost(side, 'inf').pp / newCost(side, 'inf').men);
    if (q < 0.55 && (t === 'arm' || t === 'mot')) t = mix.cav ? 'cav' : 'inf';
    else if (q < 0.4 && t === 'inf' && mix.cav && !S.peace) t = 'cav'; // в мирное время людей хватает — не повод для кавалерии
    else if (q > 1.8 && t === 'inf') t = (mix.arm || 0) > 0.1 ? 'arm' : 'mot';
    let c = newCost(side, t);
    // нет нужного снаряжения (танков) — пехота
    if (!hasEq(S, side, t, c.pp) && t !== 'inf') { t = 'inf'; c = newCost(side, t); }
    if (st - c.pp < reserve.pp || S.men[side] - c.men < reserve.men || !hasEq(S, side, t, c.pp)) break;
    const z = S.peace ? peaceZone(S, side) : needZone(S, side, thr, fm);
    const u = recruit(S, side, t, z);
    if (!u) break;
    S.stats[side].made++;
  }
}
// мирное время: свободные стройбригады — на военные заводы (подальше от границы, у железной дороги, в крупных городах)
function peaceBuild(S, side, fd) {
  const M = S.M;
  let n = brigFree(S, side);
  if (n <= 0) return;
  const cand = [];
  for (let r = 0; r < M.R; r++) if (canBuild(S, side, r, 'fac')) cand.push([r, (S.rail[r] ? 2 : 0) + M.reg[r].vp + Math.min(4, fd[r]) * 0.5 + S.fac[r] * 0.1]);
  cand.sort((a, b) => b[1] - a[1] || a[0] - b[0]);
  for (const [r] of cand) { if (n <= 0) break; if (build(S, side, r, 'fac')) n--; }
}
function rndPick(S, mix) {
  let x = ((((S.turn * 7919 + S.nextId * 104729) % 1000) + 1000) % 1000) / 1000, acc = 0;
  for (const [t, p] of Object.entries(mix)) { acc += p; if (x < acc) return t; }
  return 'inf';
}
// мирное время: новые дивизии — на участок, где войск меньше всего против плана прикрытия 1941 г. (а не все на север)
function peaceZone(S, side) {
  const M = S.M, w = new Array(ZN).fill(0);
  for (const u of S.units) {
    if (u.s !== side || u.dead) continue;
    if (u.h41 && u.hp !== undefined) w[M.reg[u.hp].z]++;
    if (u.r >= 0) w[M.reg[u.r].z]--;
    else if (u.arr !== undefined && !u.hist && !u.pw) w[u.z ?? 2]--;
  }
  let best = 2, bw = -1e9;
  w.forEach((v, z) => { if (v > bw) (bw = v), (best = z); });
  return best;
}
function needZone(S, side, thr, fm) {
  const w = new Array(ZN).fill(0), M = S.M;
  for (let r = 0; r < M.R; r++) if (sideOf(S, r) === side && isFront(S, r, side)) w[M.reg[r].z] += thr[r] - regionDef(S, r) * 0.5 + (S.post[side][fm[r]] === 'atk' ? 3 : 0);
  let best = 2, bw = -1e9;
  w.forEach((v, z) => { if (v > bw) (bw = v), (best = z); });
  return best;
}
