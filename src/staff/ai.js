// «Сталинград 1942–1943» (v0.7): штабной ИИ — исполняет директивы армий/корпусов (для обеих сторон, в том числе
// для соединений игрока), и командный ИИ стороны-противника (исторический план + реакции).
import { hexDist, clamp } from './geo.js';
import { MOBILE, MECH, TYPES, atkPower, defPower, TERR, entK, weather, isDay } from './rules.js';
import * as E from './engine.js';

const { SID, nbs, adj, room, capOf, findPath, distField, estimate, setOrder, setDirective, traits, cv } = E;

// ——— общий контекст стороны на текущий час ———
function quickAtt(u, temp) {
  const p = atkPower(u, { temp, prepK: 1, armK: 1, mod: 1 });
  return p.inf + p.arm;
}
function quickDef(u, c, S, temp) {
  return defPower(u, { temp, mod: TERR[+S.D.terr[c]].def * entK(Math.max(u.ent, 2)) });
}
function ctxFor(S, side) {
  S._ctx = S._ctx && S._ctx.t === S.t ? S._ctx : { t: S.t };
  if (S._ctx[side]) return S._ctx[side];
  const n = S.G.n, sid = SID[side], temp = (S.wx || weather(S.t)).temp;
  const fr = new Uint8Array(n), thr = new Float32Array(n), epw = new Float32Array(n), lab = new Int16Array(n).fill(-1);
  for (const u of S.units) if (!u.dead && u.side !== side) epw[u.c] += quickAtt(u, temp);
  for (let c = 0; c < n; c++) {
    if (S.own[c] !== sid) continue;
    for (const j of nbs(S, c)) {
      if (S.own[j] && S.own[j] !== sid) fr[c] = 1;
      if (epw[j] > 0) {
        const e = S.edge.get(j < c ? j * 4096 + c : c * 4096 + j);
        thr[c] += epw[j] * (e ? (e.t === 3 ? 0.3 : e.t === 2 ? 0.6 : 0.85) : 1);
        fr[c] = 2;
      }
    }
  }
  // сектора: ближайшее (по шагам) соединение для каждой своей клетки
  const forms = Object.values(S.forms).filter((F) => F.side === side), fi = new Map(forms.map((F, i) => [F.id, i]));
  const q = [];
  for (const u of S.units) if (!u.dead && u.side === side && lab[u.c] < 0) (lab[u.c] = fi.get(u.form) ?? -1), q.push(u.c);
  for (let qi = 0; qi < q.length; qi++) {
    const c = q[qi];
    for (const j of nbs(S, c)) if (lab[j] < 0 && S.own[j] === sid) (lab[j] = lab[c]), q.push(j);
  }
  const C = { side, sid, fr, thr, epw, lab, forms, fi, temp, fld: new Map() };
  S._ctx[side] = C;
  return C;
}
function field(S, C, goals, mob) {
  const k = goals.join(',') + ':' + mob;
  let f = C.fld.get(k);
  if (!f) (f = distField(S, goals, mob, C.side)), C.fld.set(k, f);
  return f;
}
const mobKey = (u) => {
  const m = TYPES[u.type].mob;
  return m === 'foot' || m === 'cav' ? 'foot' : 'arm';
};
function issue(S, u, ord) {
  const o = u.ord;
  if (o && o.k === ord.k && o.tgt === ord.tgt && o.to === ord.to) return;
  if (!o && ord.k === 'hold') {
    u.ord = { k: 'hold' };
    return;
  }
  setOrder(S, u, ord, 'ai');
}
// ближайшая к цели достижимая клетка (по полю расстояний) в пределах maxKm
function reachMin(S, u, fld, maxKm) {
  const n = S.G.n, d = new Float64Array(n).fill(Infinity), h = new E.Heap();
  d[u.c] = 0;
  h.push(u.c, 0);
  let best = u.c, bv = fld[u.c];
  while (h.size) {
    const k = h.topKey(), c = h.pop();
    if (k > d[c]) continue;
    if (fld[c] < bv - 1 && (c === u.c || room(S, c, u.side) >= u.sz - 1e-6)) (bv = fld[c]), (best = c);
    if (k > maxKm) continue;
    if (c !== u.c && S.eadj[u.side][c]) continue; // дальше линии соприкосновения не идём
    for (const j of nbs(S, c)) {
      const L = S.cellU[j];
      if (L.length && L[0].side !== u.side) continue;
      if (S.eadj[u.side][c] && S.eadj[u.side][j] && S.own[j] !== SID[u.side]) continue;
      const w = E.findPath ? stepKm(S, u, c, j) : 10;
      if (!isFinite(w)) continue;
      const nd = k + w;
      if (nd < d[j]) (d[j] = nd), h.push(j, nd);
    }
  }
  return best;
}
import { stepCost } from './rules.js';
const stepKm = (S, u, a, b) => stepCost(S, u, a, b);

// ——— исполнение директив: по соединениям ———
const PERIOD = { GER: 2, SOV: 3, ROM: 3, ITA: 3 };
export function think(S) {
  S.ai = S.ai || {};
  const byF = {};
  for (const u of S.units) if (!u.dead) (byF[u.form] = byF[u.form] || []).push(u);
  let k = 0, pool = null;
  if (S.pk && S.pk.on && (S.t % 2 === 0 || S.ai._pool == null)) {
    pool = planPocket(S, ctxFor(S, 'AX'));
    S.ai._pool = pool ? [...pool] : [];
  } else if (S.pk && S.pk.on) pool = new Set(S.ai._pool || []);
  for (const F of Object.values(S.forms)) {
    k++;
    if (!F.act) continue;
    if (pool && pool.has(F.id)) continue;
    const A = (S.ai[F.id] = S.ai[F.id] || { nx: S.t + (k % 3), stall: 0 });
    if (F.dir && F.dir.at != null && S.t === F.dir.at - 2) F.replan = 1;
    const U = (byF[F.id] || []).filter((u) => !u.ovr && !u.pend);
    const idle = U.some((u) => !u.ord || u.ord.done);
    if (!(F.replan || S.t >= A.nx || (idle && S.t >= A.last + 1))) continue;
    F.replan = 0;
    A.last = S.t;
    A.nx = S.t + (PERIOD[F.nat] || 3);
    if (!U.length) continue;
    planForm(S, F, U, A);
  }
  if (S.t % 3 === 0) for (const side of ['SOV', 'AX']) if (!E.isPlayer(S, side)) command(S, side);
}
function planForm(S, F, U, A) {
  const C = ctxFor(S, F.side), d = F.dir || { k: 'def' };
  // отрезанные мелкие группы (не большой котёл) — прорываются к своим
  const big = S.pk && S.pk.on ? new Set(S.pk.ids) : null;
  const rest = [];
  for (const u of U) {
    if (u.sup === 0 && !(big && big.has(u.id)) && !(S.flags.brk || S.flags.thunder)) {
      breakout(S, u);
      continue;
    }
    rest.push(u);
  }
  if (!rest.length) return;
  if (d.k === 'atk') planAtk(S, F, rest, A, C);
  else if (d.k === 'wd') planWd(S, F, rest, A, C);
  else if (d.k === 'res') planRes(S, F, rest, A, C);
  else planDef(S, F, rest, A, C);
}
function breakout(S, u) {
  if (u.ord && (u.ord.k === 'move' || u.ord.k === 'wd' || u.ord.k === 'atk') && !u.ord.done) return;
  const sid = SID[u.side], F = S.forms[u.form], at2 = F && F.dir && (F.dir.k === 'wd' || F.dir.k === 'def') ? F.dir.at2 : null;
  // отходить к своему рубежу (к главным силам), если путь есть; иначе — к ближайшим снабжаемым своим
  if (at2 != null && S.own[at2] === sid && hexDist(S.G, u.c, at2) > 2) {
    const q = findPath(S, u, (c) => S.own[c] === sid && hexDist(S.G, c, at2) <= 2 && room(S, c, u.side) >= u.sz - 1e-6, { max: 120 });
    if (q) return issue(S, u, { k: 'move', to: q[q.length - 1], force: 1 });
  }
  if (at2 != null && hexDist(S.G, u.c, at2) <= 2) return issue(S, u, { k: 'hold' });
  const p = findPath(S, u, (c) => S.own[c] === sid && isFinite(S.dist[u.side][c]) && room(S, c, u.side) >= u.sz - 1e-6, { max: 120 });
  if (p) issue(S, u, { k: 'move', to: p[p.length - 1], force: 1 });
  else attackOut(S, u);
}
function attackOut(S, u) {
  // пробиваться через слабейшего соседа в сторону своих
  let best = -1, bs = 0;
  for (const j of nbs(S, u.c)) {
    const L = S.cellU[j];
    if (!L.length || L[0].side === u.side) continue;
    const est = estimate(S, [u], j, { prep: 1 });
    if (est.R > bs) (bs = est.R), (best = j);
  }
  if (best >= 0 && bs >= 0.9) issue(S, u, { k: 'atk', tgt: best, prep: 1 });
  else issue(S, u, { k: 'hold' });
}
function needsRest(S, u) {
  const v = cv(S, u);
  return v < 14 || u.fat > 85 || (MECH(u) && u.fuel < 8 && u.sup > 0);
}

// ——— НАСТУПЛЕНИЕ ———
function objDone(S, F, c) {
  const sid = SID[F.side];
  if (S.own[c] !== sid) return false;
  for (const j of nbs(S, c)) {
    const L = S.cellU[j];
    if (L.length && L[0].side !== F.side) return false;
  }
  return true;
}
function pocketTargets(S, U) {
  const P = S.pk, out = [];
  if (!P || !U.length) return out;
  let mx = 0, my = 0;
  for (const u of U) (mx += S.G.cx[u.c]), (my += S.G.cy[u.c]);
  (mx /= U.length), (my /= U.length);
  const seen = new Set();
  for (const id of P.ids) {
    const v = S.uById.get(id);
    if (!v || v.dead || v.sup > 0 || seen.has(v.c)) continue;
    seen.add(v.c);
    out.push([Math.hypot(S.G.cx[v.c] - mx, S.G.cy[v.c] - my), v.c]);
  }
  return out.sort((a, b) => a[0] - b[0]).slice(0, 2).map((x) => x[1]);
}
function planAtk(S, F, U, A, C) {
  const d = F.dir;
  if (d.at != null && S.t < d.at - 2) {
    for (const u of U) if (!u.ord) u.ord = { k: 'hold' };
    return;
  }
  while (d.oi < d.obj.length && objDone(S, F, d.obj[d.oi])) d.oi++;
  // «добить котёл»: цели достигнуты, а окружённые ещё держатся — новые цели по ближайшим остаткам
  if (d.oi >= d.obj.length && d.pk && S.pk && S.pk.on) {
    // до назначенного часа — закрепиться на достигнутом рубеже, не снимая директивы
    if (S.t < d.pk) return planDef(S, F, U, A, C);
    const tg = pocketTargets(S, U);
    if (tg.length) (d.obj = tg), (d.oi = 0);
  }
  if (d.oi >= d.obj.length) {
    const last = d.obj[d.obj.length - 1];
    F.dir = { k: 'def', obj: [], oi: 0, at2: last ?? null, why: 'Цель достигнута — закрепиться.' };
    if (E.isPlayer(S, F.side)) E.msg(S, { k: 'toast', side: F.side, title: `${F.n}: задача выполнена`, c: last });
    return planDef(S, F, U, A, C);
  }
  const O = d.obj[d.oi], start = d.at != null && S.t <= d.at + 2;
  const props = new Map();
  for (const u of U) {
    if (u.ord && u.ord.k === 'atk' && !u.ord.done) {
      const L = S.cellU[u.ord.tgt];
      if (L.length && L[0].side !== u.side) continue;
    }
    if (needsRest(S, u) && !S.eadj[u.side][u.c]) {
      issue(S, u, { k: 'rest' });
      continue;
    }
    if (u.ord && u.ord.k === 'rest' && (u.fat > 40 || (MECH(u) && u.fuel < 35)) && !S.eadj[u.side][u.c]) continue;
    let goal = O;
    const sub = d.sub && d.sub[u.id];
    if (sub) {
      const g = sub.find((c) => !objDone(S, F, c));
      if (g != null) goal = g;
    }
    const fld = field(S, C, [goal], mobKey(u));
    // подвижные части — в прорыв, если есть проход
    if (MOBILE(u) && (!MECH(u) || u.fuel >= 18) && u.c !== goal) {
      const p = findPath(S, u, (c) => c === goal, { max: 220 });
      if (p && p.km < 200 && !S.eadj[u.side][u.c]) {
        issue(S, u, { k: 'move', to: goal });
        continue;
      }
      if (p && p.km < 200 && S.eadj[u.side][u.c]) {
        // в соприкосновении: пройти мимо, если следующий шаг не в «мешке»
        const nx = p[0];
        if (!S.eadj[u.side][nx] || p.length <= 2) {
          issue(S, u, { k: 'move', to: goal });
          continue;
        }
      }
    }
    // соседние клетки с противником
    let best = -1, bs = -1e9;
    for (const j of nbs(S, u.c)) {
      const L = S.cellU[j];
      if (!L.length || L[0].side === u.side) continue;
      const prog = (fld[u.c] - fld[j]) / 10;
      let dp = 0;
      for (const e of L) dp += quickDef(e, j, S, C.temp);
      const odds = quickAtt(u, C.temp) / Math.max(0.5, dp);
      const cut = L.every((e) => e.sup === 0) ? 0.6 : 0;
      const sc = prog * 0.6 + Math.min(2.5, odds) * 1.2 + cut + E.riverK(S, u.c, j) - 1;
      if (sc > bs) (bs = sc), (best = j);
    }
    if (best >= 0 && (fld[best] <= fld[u.c] + 12 || bs > 1.6)) {
      if (!props.has(best)) props.set(best, []);
      props.get(best).push(u);
      continue;
    }
    const dest = reachMin(S, u, fld, MOBILE(u) ? 60 : 30);
    if (dest !== u.c) issue(S, u, { k: 'move', to: dest });
    else if (best >= 0) {
      if (!props.has(best)) props.set(best, []);
      props.get(best).push(u);
    } else issue(S, u, { k: 'hold' });
  }
  resolveProps(S, F, A, props, start, 1.5);
}
function resolveProps(S, F, A, props, start, base) {
  const gtr = E.genOf(F.gen)?.tr || [];
  let thr = base * (gtr.includes('bold') ? 0.9 : 1) * (gtr.includes('cautious') ? 1.15 : 1);
  thr = Math.max(1.05, thr - 0.05 * (A.stall || 0));
  let any = false;
  const list = [...props.entries()].sort((a, b) => b[1].length - a[1].length);
  const used = new Set();
  for (const [X, L0] of list) {
    const L = L0.filter((u) => !used.has(u.id));
    if (!L.length) continue;
    const defs = S.cellU[X];
    const t2 = defs.every((e) => e.sup === 0) ? thr * 0.85 : thr;
    let est = estimate(S, L, X, { prep: start ? 2 : 1 });
    // добрать соседей, которые ещё ничем не заняты
    if (est.R < t2) {
      for (const j of nbs(S, X)) {
        for (const v of S.cellU[j]) {
          if (v.side !== F.side || L.includes(v) || used.has(v.id) || v.ovr || v.pend) continue;
          if (v.ord && v.ord.k === 'atk' && v.ord.tgt !== X) continue;
          if (v.form !== F.id && !(v.ord == null || v.ord.k === 'hold')) continue;
          L.push(v);
        }
      }
      est = estimate(S, L, X, { prep: start ? 2 : 1 });
    }
    if (est.R >= t2) {
      const prep = start ? 2 : 1;
      for (const u of L) {
        used.add(u.id);
        if (u.ord && u.ord.k === 'atk' && u.ord.tgt === X) continue;
        setOrder(S, u, { k: 'atk', tgt: X, prep, at: S.t + prep }, 'ai');
      }
      any = true;
    } else for (const u of L) if (!used.has(u.id) && (!u.ord || u.ord.k !== 'atk')) issue(S, u, { k: 'hold' });
  }
  A.stall = any || !props.size ? 0 : (A.stall || 0) + 1;
}

// ——— ОБОРОНА ———
function sector(S, F, C) {
  const fi = C.fi.get(F.id), out = [];
  const at2 = F.dir && F.dir.at2;
  if (at2 != null) {
    for (let c = 0; c < S.G.n; c++) if (C.fr[c] && hexDist(S.G, c, at2) <= 4) out.push(c);
    return out;
  }
  for (let c = 0; c < S.G.n; c++) if (C.fr[c] && C.lab[c] === fi) out.push(c);
  return out;
}
function planDef(S, F, U, A, C) {
  const sec = sector(S, F, C), at2 = F.dir && F.dir.at2;
  const pocket = U.length && U.every((u) => u.sup === 0);
  // нет соприкосновения — встать у рубежа at2 или отдыхать
  if (!sec.length) {
    if (at2 != null) deployAround(S, F, U, at2, C);
    else for (const u of U) if (!u.ord) issue(S, u, needsRest(S, u) ? { k: 'rest' } : { k: 'hold' });
    return;
  }
  defCore(S, F, U, C, sec);
  counterattack(S, F, U, A, C, sec, pocket);
}
// котёл: оборону по всему периметру распределяет штаб армии (общий пул частей всех корпусов на «обороне»)
function planPocket(S, C) {
  const pks = E.pkSet(S);
  if (!pks) return null;
  const comp = S.comp && S.comp.AX;
  const forms = [], U = [], cid = new Set();
  for (const F of Object.values(S.forms)) {
    if (F.side !== 'AX' || !F.act || !F.dir || F.dir.k !== 'def') continue;
    const L = S.units.filter((u) => !u.dead && u.form === F.id && !u.ovr && !u.pend);
    if (!L.length || !L.every((u) => u.sup === 0 && pks.has(u.id))) continue;
    forms.push(F);
    for (const u of L) U.push(u), comp && comp[u.c] >= 0 && cid.add(comp[u.c]);
  }
  if (forms.length < 2) return null;
  const sec = [];
  for (let c = 0; c < S.G.n; c++) if (C.fr[c] && (comp ? cid.has(comp[c]) : !isFinite(S.dist.AX[c]))) sec.push(c);
  if (!sec.length) return null;
  defCore(S, forms[0], U, C, sec);
  for (const F of forms) {
    const A = (S.ai[F.id] = S.ai[F.id] || { nx: S.t, stall: 0 });
    counterattack(S, F, U.filter((u) => u.form === F.id), A, C, sec, true);
  }
  return new Set(forms.map((F) => F.id));
}
function defCore(S, F, U, C, sec) {
  const need = new Map(), have = new Map(), secSet = new Set(sec), vpOf = (c) => S.townAt.get(c)?.vp || 0;
  for (const c of sec) {
    need.set(c, (C.fr[c] === 2 ? 3 : 1.2) + C.thr[c] * 0.7 + vpOf(c) * 0.4);
    // клетки, которые уже держат части соседних соединений, считаются прикрытыми
    let h = 0;
    for (const v of S.cellU[c]) if (v.side === F.side && v.form !== F.id) h += quickDef(v, c, S, C.temp);
    if (h > 0) have.set(c, h);
  }
  // 1) в каждой клетке сектора остаётся сильнейшая часть; остальные — в распоряжение (прикрыть пустые, усилить угрожаемые)
  const byCell = new Map(), free = [];
  for (const u of U) {
    if (u.ord && u.ord.k === 'atk' && !u.ord.done) continue;
    if (u.ord && (u.ord.k === 'move' || u.ord.k === 'wd') && !u.ord.done && secSet.has(u.ord.to) && u.c !== u.ord.to) {
      have.set(u.ord.to, (have.get(u.ord.to) || 0) + quickDef(u, u.ord.to, S, C.temp));
      continue;
    }
    if (secSet.has(u.c)) (byCell.get(u.c) || byCell.set(u.c, []).get(u.c)).push(u);
    else free.push(u);
  }
  for (const [c, L] of byCell) {
    L.sort((a, b) => quickDef(b, c, S, C.temp) - quickDef(a, c, S, C.temp));
    if (have.get(c) >= need.get(c)) {
      free.push(...L);
      continue;
    }
    have.set(c, (have.get(c) || 0) + quickDef(L[0], c, S, C.temp));
    issue(S, L[0], { k: 'hold' });
    free.push(...L.slice(1));
  }
  // 2) прикрыть пустые клетки сектора (сначала — соседние с противником и города), 3) усилить угрожаемые
  const cover = sec.filter((c) => !(have.get(c) > 0)).sort((a, b) => C.fr[b] - C.fr[a] || vpOf(b) - vpOf(a) || C.thr[b] - C.thr[a]);
  const take = (c, maxD) => {
    let bi = -1, bd = 1e9;
    for (let i = 0; i < free.length; i++) {
      const u = free[i];
      if (u.c !== c && room(S, c, u.side) < u.sz - 1e-6) continue;
      const d = hexDist(S.G, u.c, c) * (MOBILE(u) ? 0.6 : 1);
      if (d < bd && d <= maxD) (bd = d), (bi = i);
    }
    if (bi < 0) return false;
    const u = free.splice(bi, 1)[0];
    have.set(c, (have.get(c) || 0) + quickDef(u, c, S, C.temp));
    issue(S, u, u.c === c ? { k: 'hold' } : { k: 'move', to: c });
    return true;
  };
  for (const c of cover) if (!free.length || !take(c, 7)) if (!free.length) break;
  const order = sec.slice().sort((a, b) => need.get(b) - (have.get(b) || 0) - (need.get(a) - (have.get(a) || 0)));
  let keepRes = U.length > 4 ? 1 : 0;
  for (const c of order) {
    if (!free.length) break;
    if (need.get(c) - (have.get(c) || 0) <= 0) continue;
    if (keepRes && free.length <= keepRes && free.every((u) => MOBILE(u))) break;
    while (free.length && need.get(c) - (have.get(c) || 0) > 0 && take(c, 6));
  }
  // 4) остальные — резерв за самым опасным участком
  if (free.length) {
    const hot = order[0];
    for (const u of free) {
      if (needsRest(S, u) && !S.eadj[u.side][u.c]) {
        issue(S, u, { k: 'rest' });
        continue;
      }
      const c = behind(S, hot, u, C);
      issue(S, u, c === u.c || c < 0 ? { k: 'hold' } : { k: 'move', to: c });
    }
  }
}
function behind(S, c0, u, C) {
  let best = -1, bs = -1e9;
  for (const j of nbs(S, c0))
    for (const k of [j, ...nbs(S, j)]) {
      if (S.own[k] !== C.sid || C.fr[k] || room(S, k, u.side) < u.sz - 1e-6) continue;
      const sc = -hexDist(S.G, k, c0) - 0.2 * hexDist(S.G, k, u.c);
      if (sc > bs) (bs = sc), (best = k);
    }
  return best;
}
function deployAround(S, F, U, at2, C) {
  const cells = [];
  for (let c = 0; c < S.G.n; c++) if (S.own[c] === C.sid && hexDist(S.G, c, at2) <= 2) cells.push(c);
  cells.sort((a, b) => hexDist(S.G, a, at2) - hexDist(S.G, b, at2));
  const load = new Map();
  for (const u of U) {
    if (hexDist(S.G, u.c, at2) <= 2) {
      load.set(u.c, (load.get(u.c) || 0) + u.sz);
      if (!u.ord || u.ord.done) issue(S, u, { k: 'hold' });
      continue;
    }
    const c = cells.find((x) => (load.get(x) || 0) + u.sz <= 2 && room(S, x, u.side) >= u.sz - 1e-6);
    if (c != null) (load.set(c, (load.get(c) || 0) + u.sz), issue(S, u, { k: 'move', to: c }));
  }
}
function counterattack(S, F, U, A, C, sec, pocket) {
  const tried = new Set();
  for (const c of sec) {
    if (C.fr[c] !== 2) continue;
    for (const X of nbs(S, c)) {
      if (tried.has(X)) continue;
      const L = S.cellU[X];
      if (!L.length || L[0].side === F.side) continue;
      tried.add(X);
      // окружённую группировку штурмуют только по директиве (а не «контрударами» обороняющихся армий)
      const pk0 = E.pkSet(S);
      if (pk0 && L.some((e) => pk0.has(e.id))) continue;
      let ownN = 0;
      for (const j of nbs(S, X)) if (S.own[j] === C.sid) ownN++;
      const pks = E.pkSet(S), pen = ownN >= 4, weak = L.every((e) => cv(S, e) < 22 || (e.sup === 0 && !(pks && pks.has(e.id))));
      if (!pen && !weak) continue;
      const att = [];
      for (const j of nbs(S, X))
        for (const v of S.cellU[j]) if (v.side === F.side && !v.ovr && !v.pend && (!v.ord || v.ord.k === 'hold') && v.amm > 40 && cv(S, v) > 25) att.push(v);
      if (!att.length) continue;
      const est = estimate(S, att, X, { prep: 1 });
      if (est.R >= (pocket ? 2.2 : pen ? 1.6 : 2.0)) for (const v of att) setOrder(S, v, { k: 'atk', tgt: X, prep: 1, at: S.t + 1 }, 'ai');
    }
  }
}

// ——— ОТХОД и РЕЗЕРВ ———
function planWd(S, F, U, A, C) {
  const at2 = F.dir.at2;
  if (at2 == null) return planDef(S, F, U, A, C);
  let arrived = 0;
  const rearT = F.dt + 6;
  const cells = [];
  for (let c = 0; c < S.G.n; c++) if (S.own[c] === C.sid && hexDist(S.G, c, at2) <= 2) cells.push(c);
  cells.sort((a, b) => hexDist(S.G, a, at2) - hexDist(S.G, b, at2));
  const load = new Map();
  // арьергард: самая боеспособная часть в соприкосновении держится 6 часов
  let rg = null;
  if (S.t < rearT) for (const u of U) if (S.eadj[u.side][u.c] && (!rg || cv(S, u) > cv(S, rg))) rg = u;
  for (const u of U) {
    if (hexDist(S.G, u.c, at2) <= 2) {
      arrived++;
      if (!u.ord || u.ord.done) issue(S, u, { k: 'hold' });
      continue;
    }
    if (u === rg) {
      issue(S, u, { k: 'hold' });
      continue;
    }
    const c = cells.find((x) => (load.get(x) || 0) + u.sz <= 2) ?? at2;
    load.set(c, (load.get(c) || 0) + u.sz);
    issue(S, u, { k: 'wd', to: c });
  }
  if (arrived === U.length) F.dir = { k: 'def', obj: [], oi: 0, at2, why: F.dir.why };
}
function planRes(S, F, U, A, C) {
  const at2 = F.dir.at2;
  // противник рядом — контрудар
  const props = new Map();
  for (const u of U) {
    for (const j of nbs(S, u.c)) {
      const L = S.cellU[j];
      if (L.length && L[0].side !== F.side) {
        if (!props.has(j)) props.set(j, []);
        props.get(j).push(u);
      }
    }
  }
  if (props.size) {
    resolveProps(S, F, A, props, false, 1.4);
    return;
  }
  if (at2 == null) {
    for (const u of U) if (!u.ord || u.ord.done) issue(S, u, { k: 'rest' });
    return;
  }
  deployAround(S, F, U, at2, C);
}

// ——— командный ИИ стороны (не игрока): реакции поверх исторического плана ———
function command(S, side) {
  if (S.hist) return;
  const C = ctxFor(S, side);
  if (side === 'AX') {
    // угроза аэродромам и переправам — резервы в контрудар
    const keys = S.D.towns.filter((t) => t.air === 1 || t.n === 'Калач' || t.n === 'Нижне-Чирская');
    for (const tw of keys) {
      if (S.own[tw.c] !== 2) continue;
      let thr = 0;
      for (const u of S.units) if (!u.dead && u.side === 'SOV' && hexDist(S.G, u.c, tw.c) <= 3) thr += quickAtt(u, C.temp);
      if (thr < 8) continue;
      const res = Object.values(S.forms).find((F) => F.side === 'AX' && F.act && F.dir.k === 'res');
      if (res) setDirective(S, res.id, { k: 'def', at2: tw.c, why: `Прикрыть ${tw.n}.` }, 'ai');
    }
  }
}
