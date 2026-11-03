// «Барбаросса 1941» (v0.8): ИИ сторон и соседей игрока, советник штаба и «Разведка доносит».
// Жадный план по дивизиям: оси наступления немцев по дням (как в истории), у советской стороны — позиции
// по дням: держать границу, контрудар на Гродно (Директива № 3), отход на Слоним — Новогрудок — Минск,
// резервы занимают рубежи; окружённые прорываются к своим. Без DOM.
import * as R from './rules.js';

const { alive, unitAt, TYPES, TERR, OWN } = R;

// ——— оси и рубежи: [с какого дня, цель] (цель — город или [долгота, широта]) ———
const BEREZA = [24.98, 52.53];
const AX = {
  g17pz: [[0, 'Пружаны'], [1, 'Слоним'], [3, 'Барановичи'], [5, 'Минск']],
  g18pz: [[0, 'Пружаны'], [1, 'Слоним'], [3, 'Барановичи'], [4, 'Столбцы'], [5, 'Минск']],
  g29m: [[0, 'Пружаны'], [2, 'Зельва'], [5, 'Слоним']],
  g167: [[0, 'Пружаны'], [2, 'Зельва']],
  g3pz: [[0, 'Кобрин'], [1, BEREZA], [3, 'Слуцк'], [5, 'Бобруйск']],
  g4pz: [[0, 'Кобрин'], [1, BEREZA], [3, 'Слуцк'], [5, 'Бобруйск']],
  g10m: [[0, 'Кобрин'], [2, 'Барановичи'], [4, 'Слуцк']],
  g1kd: [[0, 'Пинск'], [4, 'Лунинец']],
  g31: [[0, 'Брест'], [3, 'Кобрин'], [5, 'Пружаны']],
  g34: [[0, 'Кобрин'], [2, 'Пружаны'], [4, 'Слоним']],
  g45: [[0, 'Брест']],
  g10pz: [[2, 'Слоним'], [3, 'Барановичи'], [5, 'Минск']],
  gssr: [[2, 'Слоним'], [3, 'Барановичи'], [5, 'Столбцы']],
};
const FM_AX = {
  pz3m: [[0, 'Алитус'], [1, 'Вильнюс'], [3, 'Молодечно'], [4, 'Минск'], [7, 'Борисов']],
  pz3i: [[0, 'Алитус'], [2, 'Вильнюс'], [5, 'Ошмяны']],
  a9n: [[0, 'Гродно'], [3, 'Лида'], [6, 'Новогрудок']],
  a9c: [[0, 'Августов'], [2, 'Белосток'], [5, 'Волковыск']],
  a9w: [[0, 'Ломжа'], [3, 'Белосток'], [6, 'Волковыск']],
  a4n: [[0, 'Бельск'], [3, 'Белосток'], [5, 'Волковыск'], [7, 'Зельва']],
  a4c: [[0, 'Бельск'], [3, 'Волковыск'], [6, 'Слоним']],
  a4s: [[0, 'Кобрин'], [2, 'Пружаны'], [5, 'Слоним']],
};
const GRP = { g8: 'a9n', g28: 'a9n', g161: 'a9n', g87: 'a9c', g102: 'a9c', g129: 'a9c', g162: 'a9w', g256: 'a9w', g7: 'a4n', g23: 'a4n', g258: 'a4n', g268: 'a4n', g137: 'a4c', g263: 'a4c', g292: 'a4c', g131: 'a4s', g134: 'a4s', g252: 'a4s' };
// советские резервы: рубежи обороны
const RES = {
  s100: [[0, 'Минск']], s161: [[0, [27.25, 53.9]]], s121: [[0, 'Бобруйск']], s143: [[0, 'Осиповичи'], [5, 'Бобруйск']], s55: [[0, 'Слуцк']],
  s27td: [[0, 'Новогрудок']], s36td: [[0, 'Барановичи']], s209md: [[0, 'Лида']], s26td: [[0, 'Борисов'], [3, 'Минск']], s38td: [[0, 'Барановичи']],
  s210md: [[0, 'Минск']], s50: [[0, 'Молодечно']], s17: [[0, 'Лида']], s24: [[0, 'Молодечно']], s37: [[0, 'Лида']], s64: [[0, 'Минск']], s108: [[0, [27.9, 53.75]]],
};
function axisGoal(S, list) {
  let g = null;
  for (const [d, t] of list) if (S.day >= d) g = t;
  if (!g) g = list[0][1];
  const h = typeof g === 'string' ? S.M.cityHex(g) : S.M.hexLL(g[0], g[1]);
  return { h, name: typeof g === 'string' ? g : '' };
}
// режимы: atk — наступать, hold — держать, wd — отход, def — занять рубеж, brk — прорыв из котла
const W = {
  atk: { wp: 1, wt: 0.1, wdng: 0.12, wcoh: 0.15, wcap: 0.25, wstay: 0, went: 0, wsup: 0.6, pmin: 0.5, bias: 0.4 },
  atkM: { wp: 1.05, wt: 0, wdng: 0.28, wcoh: 0, wcap: 0.35, wstay: 0, went: 0, wsup: 0.8, pmin: 0.55, bias: -0.3 },
  hold: { wp: 0, wt: 0.6, wdng: 0.35, wcoh: 0.25, wcap: 0, wstay: 1.1, went: 0.35, wsup: 1.2, pmin: 0.62, bias: 0 },
  wd: { wp: 1.25, wt: 0.3, wdng: 0.75, wcoh: 0.2, wcap: 0.05, wstay: 0, went: 0.1, wsup: 1.6, pmin: 0.78, bias: -0.5 },
  def: { wp: 1, wt: 0.5, wdng: 0.2, wcoh: 0.3, wcap: 0.1, wstay: 0.5, went: 0.35, wsup: 1.2, pmin: 0.6, bias: 0 },
  ctr: { wp: 1, wt: 0.1, wdng: 0, wcoh: 0.2, wcap: 0.3, wstay: 0, went: 0, wsup: 0.6, pmin: 0.38, bias: 0.8 },
  brk: { wp: 1.5, wt: 0, wdng: 0.3, wcoh: 0.1, wcap: 0.2, wstay: 0, went: 0, wsup: 0, pmin: 0.33, bias: 0.6 },
};
// ближайший гекс со снабжением (для прорыва из котла)
function nearestSupplied(S, u) {
  const sup = R.supplyMap(S, u.side), M = S.M;
  let best = -1, bd = 1e9;
  for (let h = 0; h < M.N; h++) if (sup[h]) {
    const d = M.dist(u.c, h);
    if (d < bd) (bd = d), (best = h);
  }
  return best;
}
// ближайшая окружённая дивизия противника (для пехоты, добивающей котёл)
function nearestPocketed(S, u, maxD) {
  const sup = R.supplyMap(S, R.other(u.side));
  let best = null, bd = maxD + 1;
  for (const e of S.units) {
    if (!alive(e) || e.side === u.side || sup[e.c] || e.t === 'gar') continue;
    const d = S.M.dist(u.c, e.c);
    if (d < bd) (bd = d), (best = e);
  }
  return best;
}
export function plan(S, u) {
  const d = S.day;
  if (u.t === 'gar') return { mode: 'hold', goal: u.c, W: W.hold, gname: '' };
  if (!R.supplied(S, u) && u.oos >= 1) {
    const h = nearestSupplied(S, u);
    return { mode: 'brk', goal: h, W: W.brk, gname: 'к своим' };
  }
  const mech = !!TYPES[u.t].mech;
  if (u.side === 'GER') {
    let list = AX[u.id] || FM_AX[GRP[u.id]] || (u.top === 'pz3' ? (mech ? FM_AX.pz3m : FM_AX.pz3i) : null) || [[0, 'Минск']];
    // пехота добивает котлы поблизости
    if (!mech && u.id !== 'g45') {
      const e = nearestPocketed(S, u, 5);
      if (e) return { mode: 'atk', goal: e.c, W: { ...W.atk, pmin: 0.4, bias: 0.9 }, gname: 'котёл' };
    }
    const g = axisGoal(S, list);
    return { mode: 'atk', goal: g.h, W: mech ? W.atkM : W.atk, gname: g.name };
  }
  // советская сторона
  const wdDay = S.flags.wdDay ?? (S.side === 'SOV' ? (S.flags.wdEarly ? 2 : 3) : [4, 3, 2][S.diff] ?? 3);
  if (u.top === 'res') {
    const g = axisGoal(S, RES[u.id] || [[0, 'Минск']]);
    const at = S.M.dist(u.c, g.h) <= 1;
    return { mode: 'def', goal: g.h, W: at ? { ...W.def, wp: 0.2 } : W.def, gname: g.name };
  }
  if (u.top === 'a11') {
    if (d === 0 && u.fm === 'mk3') return { mode: 'ctr', goal: S.M.cityHex('Алитус'), W: W.ctr, gname: 'Алитус' };
    const g = axisGoal(S, [[0, 'Алитус'], [1, 'Вильнюс'], [3, [26.8, 54.95]]]);
    return { mode: d === 0 ? 'hold' : 'wd', goal: g.h, W: d === 0 ? W.hold : W.wd, gname: g.name };
  }
  if (u.top === 'a4s') {
    if (d === 0) return { mode: 'hold', goal: u.c, W: W.hold, gname: '' };
    const g = axisGoal(S, [[1, BEREZA], [3, 'Барановичи'], [5, 'Слуцк']]);
    return { mode: 'wd', goal: g.h, W: W.wd, gname: g.name };
  }
  // 10-я и 3-я армии
  if (S.flags.counter && d >= 1 && d <= 2 && (u.fm === 'mk6' || u.fm === 'mk11' || u.fm === 'kk6')) {
    const g = S.M.cityHex('Гродно');
    return { mode: 'ctr', goal: g, W: W.ctr, gname: 'Гродно' };
  }
  if (d < wdDay) return { mode: 'hold', goal: u.c, W: W.hold, gname: '' };
  const k = d - wdDay;
  const list = u.top === 'a3' ? [[0, 'Лида'], [1, 'Новогрудок'], [3, 'Столбцы']] : [[0, 'Волковыск'], [1, 'Слоним'], [2, 'Новогрудок'], [4, 'Столбцы']];
  let g = null;
  for (const [dd, t] of list) if (k >= dd) g = t;
  // если город на пути уже у немцев — к следующему рубежу
  let h = S.M.cityHex(g);
  if (S.owner[h] !== OWN.SOV) {
    const nx = list.find(([dd, t]) => dd > k && S.owner[S.M.cityHex(t)] === OWN.SOV);
    if (nx) (g = nx[1]), (h = S.M.cityHex(g));
  }
  return { mode: 'wd', goal: h, W: W.wd, gname: g };
}

// ——— поле расстояний до цели (в очках хода, с учётом местности, рек и дорог); кэш на карту ———
const FIELDS = new WeakMap();
const TT = (t) => (TYPES[t].mech ? 'arm' : 'inf');
export function fieldTo(S, goal, t) {
  const M = S.M;
  let C = FIELDS.get(M);
  if (!C) FIELDS.set(M, (C = new Map()));
  const key = goal * 2 + (TT(t) === 'arm' ? 1 : 0);
  let F = C.get(key);
  if (F) return F;
  F = new Float32Array(M.N).fill(1e4);
  if (goal < 0) return F;
  const mt = TT(t), cost = (a, b) => (M.terrain[b] < 2 ? 99 : M.road(a, b) ? 1 : TERR[M.terrain[b]].c[mt] + (M.river(a, b) ? 1 : 0));
  F[goal] = 0;
  const open = [goal], done = new Uint8Array(M.N);
  while (open.length) {
    let bi = 0;
    for (let k = 1; k < open.length; k++) if (F[open[k]] < F[open[bi]]) bi = k;
    const h = open.splice(bi, 1)[0];
    if (done[h]) continue;
    done[h] = 1;
    for (const j of M.nbr[h]) {
      if (!M.land(j)) continue;
      const v = F[h] + cost(j, h);
      if (v < F[j]) (F[j] = v), open.push(j);
    }
  }
  C.set(key, F);
  return F;
}
// продвижение к цели при переходе a → b (в очках хода; на дороге 1 = один гекс)
const prog = (S, u, P, a, b) => {
  if (P.goal < 0) return 0;
  const F = fieldTo(S, P.goal, u.t);
  return F[a] - F[b];
};

// ——— оценка позиции и атаки ———
function posScore(S, u, h, P, sup) {
  const M = S.M, side = u.side, w = P.W;
  let s = 0;
  if (P.goal >= 0) s += prog(S, u, P, u.c, h) * w.wp * (TYPES[u.t].mech ? 0.6 : 0.8);
  s += (TERR[M.terrain[h]].def - 1) * w.wt * 2;
  let en = 0, fr = 0;
  for (const j of M.nbr[h]) {
    const x = unitAt(S, j);
    if (!x || x === u) continue;
    if (x.side === side) fr++;
    else en++;
  }
  s -= en * w.wdng;
  s += Math.min(fr, 3) * w.wcoh;
  if (S.owner[h] !== OWN[side]) {
    s += w.wcap;
    const ci = M.cityAt[h];
    if (ci >= 0) s += M.cities[ci].vp * 0.6;
  }
  if (h === u.c) s += w.wstay + u.ent * w.went;
  if (w.wsup && S.owner[h] === OWN[side] && !sup[h]) s -= w.wsup;
  return s;
}
function atkScore(S, u, e, fc, P) {
  const M = S.M, ci = M.cityAt[e.c];
  const v = 2 + e.str * 0.25 + (e.oos > 0 ? 1.5 : 0) + (ci >= 0 ? M.cities[ci].vp * 0.5 : 0) + (TYPES[e.t].mech ? 0.5 : 0) + (e.t === 'gar' ? 1.5 : 0);
  return fc.pWin * v + fc.pRout * 1.5 - (1 - fc.pWin) * (1 + u.str * 0.12) - fc.al * 0.4 + P.W.bias;
}
// лучшее действие дивизии: {k: 'atk'|'move'|'stay', path, tgt, fc, score, P}; known — маска видимости (для игрока)
export function bestAction(S, u, opt = {}) {
  if (!alive(u)) return null;
  const P = opt.P || plan(S, u), sup = R.supplyMap(S, u.side), known = opt.known || null;
  const RR = R.reach(S, u, known, opt.mp);
  const stay = posScore(S, u, u.c, P, sup);
  let best = { k: 'stay', path: [u.c], score: stay, P };
  for (const [h] of RR) {
    if (h === u.c || S.at[h] >= 0) continue;
    const s = posScore(S, u, h, P, sup) - 0.01 * R.pathTo(RR, h).length;
    if (s > best.score + 0.05) best = { k: 'move', path: R.pathTo(RR, h), score: s, P };
  }
  if (R.canAttack(S, u) && (opt.noAtk !== true)) {
    const seen = new Set();
    for (const [h] of RR) {
      if (h !== u.c && S.at[h] >= 0) continue;
      for (const j of S.M.nbr[h]) {
        const e = unitAt(S, j);
        if (!e || e.side === u.side || seen.has(e.id) || (known && !known[j])) continue;
        seen.add(e.id);
        // крепость штурмует пехота; танки в казематы не лезут
        if (e.t === 'gar' && TYPES[u.t].mech) continue;
        // танковый клин не отвлекается на цели в стороне от оси: только то, что лежит на пути к цели
        if (P.W === W.atkM && P.goal >= 0 && prog(S, u, P, u.c, e.c) <= 0 && S.M.dist(u.c, P.goal) > 1) continue;
        // лучший гекс для удара по e
        let bf = null;
        for (const f of S.M.nbr[e.c]) {
          if (!RR.has(f) || (f !== u.c && S.at[f] >= 0)) continue;
          if (R.footSlow(u) && (u.st || 0) + R.pathTo(RR, f).length - 1 > 1) continue;
          const fc = R.forecast(S, u, e, f);
          // удар по направлению к цели ценнее: после успеха дивизия входит в гекс противника
          const k = (TYPES[u.t].mech ? 0.6 : 0.8) * P.W.wp, pg = prog(S, u, P, u.c, e.c) * k;
          const sc = atkScore(S, u, e, fc, P) + (f === u.c ? 0.15 : 0) + pg * (0.35 + 0.65 * fc.pWin) + (posScore(S, u, f, P, sup) - prog(S, u, P, u.c, f) * k) * 0.25;
          if (!bf || sc > bf.sc) bf = { f, fc, sc };
        }
        if (!bf) continue;
        let pmin = e.oos > 1 ? Math.min(P.W.pmin, 0.42) : P.W.pmin;
        // измотанная дивизия атакует только наверняка
        if (u.org < R.orgMax(u) * 0.3) pmin = Math.max(pmin, 0.8);
        // осада крепости: штурм, если хотя бы удержим натиск (гарнизон тает)
        // (гарнизон теряет организацию даже от неудачных штурмов — осада идёт днями)
        const siege = e.t === 'gar' && u.side === 'GER' && !TYPES[u.t].mech && u.org >= R.orgMax(u) * 0.5 && u.str >= 5 && bf.fc.r >= 0.5;
        if (bf.fc.pWin < pmin && !siege) continue;
        if (siege) bf.sc += 3;
        if (bf.sc > best.score) best = { k: 'atk', path: bf.f === u.c ? [u.c] : R.pathTo(RR, bf.f), tgt: e.c, tid: e.id, fc: bf.fc, score: bf.sc, P };
      }
    }
  }
  return best;
}

// ——— авиация ИИ ———
function airPlan(S, side, n) {
  if (n <= 0) return [];
  const cand = [];
  for (const e of S.units) {
    if (!alive(e) || e.side === side || e.t === 'gar' || e.hit === S.day) continue;
    const adj = R.enemyAdjCount(S, e.c, e.side);
    if (!adj) continue;
    const t = S.M.terrain[e.c];
    const s = adj + (TYPES[e.t].mech ? 1.2 : 0) + (t === 2 ? 0.5 : 0) + (e.cmd ? 0.2 : 0) + e.str * 0.05;
    cand.push([s, e.c]);
  }
  cand.sort((a, b) => b[0] - a[0]);
  return cand.slice(0, n).map((c) => c[1]);
}

// ——— фаза ИИ: генератор событий для анимации ———
export function* aiPhase(S, side, pool, opt = {}) {
  if (side !== S.side) R.aiDecisions(S, side);
  const nAir = opt.air ?? (side === S.side ? S.airAlly : S.airAI);
  for (const h of airPlan(S, side, nAir)) {
    const r = R.doAir(S, side, h);
    if (r) yield { k: 'air', ...r };
  }
  const units = pool.map((id) => S.U.get(id)).filter((u) => u && alive(u) && u.side === side);
  // порядок: сначала дивизии в соприкосновении (пехота — открыть бреши), затем танки, затем остальные
  const key = (u) => (R.enemyAdj(S, u.c, side) ? (TYPES[u.t].mech ? 1 : 0) : TYPES[u.t].mech ? 2 : 3) * 100 - u.str;
  units.sort((a, b) => key(a) - key(b));
  // авто-артподготовка ИИ: немцы — 2 в день, советские — 1
  let preps = side === 'GER' ? 2 : 1;
  for (const u of units) {
    for (let it = 0; it < 4; it++) {
      if (!alive(u)) break;
      const a = bestAction(S, u);
      if (!a || a.k === 'stay') break;
      if (a.k === 'move') {
        const c0 = u.c, m = R.doMove(S, u, a.path);
        yield { k: 'move', ...m };
        if (u.c === c0 || u.mp <= 0) break;
        continue;
      }
      if (a.path.length > 1) {
        const m = R.doMove(S, u, a.path);
        yield { k: 'move', ...m };
        if (!S.M.nbr[u.c].includes(a.tgt) || !unitAt(S, a.tgt)) break;
      }
      if (preps > 0 && a.fc.pWin < 0.8 && a.fc.pWin > 0.3) (u.prep = 1), preps--;
      const r = R.doAttack(S, u, a.tgt, u.c);
      if (!r) break;
      yield { k: 'atk', ...r };
    }
  }
}
export function runPhaseSync(S, side, pool, opt) {
  const out = [];
  for (const e of aiPhase(S, side, pool, opt)) out.push(e);
  return out;
}

// ——— советник штаба: 1–3 предложения для дивизий игрока ———
export function advise(S, max = 3) {
  const known = R.vis(S, S.side), out = [];
  for (const u of S.units) {
    if (!u.cmd || !alive(u) || u.side !== S.side) continue;
    if (u.mp <= 0 && !R.canAttack(S, u)) continue;
    const a = bestAction(S, u, { known });
    if (!a) continue;
    if (a.k === 'atk' && a.fc.pWin >= 0.55) out.push({ k: 'atk', id: u.id, to: a.tgt, from: a.path[a.path.length - 1], path: a.path, p: a.fc.pWin, score: a.score + 1, P: a.P });
    else if (a.k === 'move') {
      const g = a.P.goal, prog = g >= 0 ? S.M.dist(u.c, g) - S.M.dist(a.path[a.path.length - 1], g) : 0;
      if (prog >= 2 || (a.P.mode === 'brk' && prog >= 1)) out.push({ k: 'move', id: u.id, to: a.path[a.path.length - 1], path: a.path, score: a.score, goal: a.P.gname, P: a.P });
    }
    if (R.canRefit(S, u) && u.str <= 5 && !R.enemyAdj(S, u.c, u.side)) out.push({ k: 'refit', id: u.id, to: u.c, score: 1.5 + (10 - u.str) * 0.2 });
  }
  out.sort((a, b) => b.score - a.score);
  const used = new Set(), res = [];
  for (const s of out) {
    if (used.has(s.id)) continue;
    used.add(s.id);
    res.push(s);
    if (res.length >= max) break;
  }
  return res;
}

// ——— разведка: вероятные действия противника в его следующую фазу ———
export function recon(S, side = S.side, max = 5) {
  const V = R.vis(S, side), out = [];
  for (const e of S.units) {
    if (!alive(e) || e.side === side || !V[e.c] || e.t === 'gar') continue;
    const mp0 = e.mp, at0 = e.at;
    e.mp = R.maxMP(S, e);
    e.at = 0;
    let a = null;
    try {
      a = bestAction(S, e);
    } finally {
      e.mp = mp0;
      e.at = at0;
    }
    if (!a || a.k === 'stay') continue;
    const to = a.k === 'atk' ? a.tgt : a.path[a.path.length - 1];
    const dd = S.M.dist(e.c, to);
    if (a.k === 'move' && dd < 2) continue;
    out.push({ id: e.id, from: e.c, to, k: a.k, p: a.fc?.pWin, score: a.score + (a.k === 'atk' ? 1 : 0) + (TYPES[e.t].mech ? 0.8 : 0), goal: a.P.gname, mech: !!TYPES[e.t].mech });
  }
  out.sort((a, b) => b.score - a.score);
  return out.slice(0, max);
}
