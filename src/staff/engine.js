// «Сталинград 1942–1943» (v0.7): движок — состояние, часовой такт, движение, штурмы, снабжение, котлы, авиамост, очки.
// Чистый модуль без DOM. Данные карты (uranus42.json) передаются снаружи: newGame(D, …) / load(D, …).
import { makeGrid, cellAt, hexDist, ekey, rng, clamp, inPoly } from './geo.js';
import {
  T_START, T_END, weather, isDay, isDawn, dayIdx, dateLabel, shortDate, tOf, ICE, NAT, TYPES, TPL, MOBILE, MECH, sideOf, enemy,
  combatValue, catOf, atkPower, defPower, antiTank, outcome, P_ART, ammoK, OUT_TXT, lossFrac, TERR, entK, speedOf, stepCost, supLevel, FAT_GAIN, fmtN,
} from './rules.js';
import { GENERALS, HIGH, FORMS, OOB, SOV_CITY, AXIS0, REINF, PLAN, EVENTS, TRAITS } from './scenario.js';

export const SAVE_V = 1;
export const SID = { SOV: 1, AX: 2 };
export const SNAME = ['', 'SOV', 'AX'];
const SIDE_N = { SOV: 'СССР', AX: 'Ось' };

// ——— двоичная куча для Дейкстры ———
class Heap {
  constructor() { this.k = []; this.v = []; }
  get size() { return this.v.length; }
  push(v, k) {
    const K = this.k, V = this.v;
    let i = V.length;
    K.push(k); V.push(v);
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (K[p] <= k) break;
      K[i] = K[p]; V[i] = V[p]; i = p;
    }
    K[i] = k; V[i] = v;
  }
  pop() {
    const K = this.k, V = this.v, top = V[0], lk = K.pop(), lv = V.pop(), n = V.length;
    if (n) {
      let i = 0;
      for (;;) {
        let c = 2 * i + 1;
        if (c >= n) break;
        if (c + 1 < n && K[c + 1] < K[c]) c++;
        if (K[c] >= lk) break;
        K[i] = K[c]; V[i] = V[c]; i = c;
      }
      K[i] = lk; V[i] = lv;
    }
    return top;
  }
  topKey() { return this.k[0]; }
}
export { Heap };

// ——— статические структуры (не сохраняются) ———
function prepStatic(S, D) {
  const G = makeGrid(D.cols, D.rows);
  S.D = D; S.G = G;
  S.edge = new Map();
  for (const [a, b, t] of D.edges) S.edge.set(ekey(a, b), { t, br: 0, fe: 0 });
  for (const [a, b, n] of D.bridges) {
    const e = S.edge.get(ekey(a, b));
    if (e) (e.br = 1), (e.n = n);
  }
  for (const [a, b, n] of D.ferries) {
    const e = S.edge.get(ekey(a, b));
    if (e) (e.fe = 1), (e.n = n);
  }
  S.townAt = new Map();
  for (const tw of D.towns) {
    const o = S.townAt.get(tw.c);
    if (!o || (tw.vp || 0) > (o.vp || 0) || ((tw.vp || 0) === (o.vp || 0) && tw.t < o.t)) S.townAt.set(tw.c, tw);
  }
  S.vpTowns = D.towns.filter((tw) => tw.vp && tw.n !== 'Сталинград');
  S.cityCells = D.city.cells.slice();
  S.airPocket = D.towns.filter((tw) => tw.air === 2).map((tw) => tw.c); // Питомник, Гумрак
  S.airBase = D.towns.filter((tw) => tw.air === 1); // Тацинская, Морозовск
  S.cellU = Array.from({ length: G.n }, () => []);
  S.uById = new Map();
  for (const u of S.units) {
    S.uById.set(u.id, u);
    if (!u.dead && u.c >= 0) S.cellU[u.c].push(u);
  }
  S.dist = { SOV: new Float64Array(G.n), AX: new Float64Array(G.n) };
  S.eadj = { SOV: new Uint8Array(G.n), AX: new Uint8Array(G.n) }; // клетки, соседние с войсками противника
  S.vis = new Uint8Array(G.n);
  S.fx = [];
  S._tr = new Map();
  S.rnd = rng(S.seed);
  if (S.rs != null) S.rnd.set(S.rs);
}
export const terrOf = (S, c) => +S.D.terr[c];
export const capOf = (S, c) => (S.D.terr[c] === '3' ? 4 : 3);
export const isRail = (S, c) => S.D.rail[c] === '1';
export const live = (S) => S.units.filter((u) => !u.dead);
export function sideAt(S, c) {
  const L = S.cellU[c];
  return L.length ? L[0].side : null;
}
export function used(S, c) {
  let s = 0;
  for (const u of S.cellU[c]) s += u.sz;
  return s;
}
export function room(S, c, side) {
  const L = S.cellU[c];
  if (L.length && L[0].side !== side) return -1;
  return capOf(S, c) - used(S, c);
}
export const nbs = (S, c) => {
  const o = [], nb = S.G.nb;
  for (let k = 0; k < 6; k++) {
    const j = nb[c * 6 + k];
    if (j >= 0 && S.D.terr[j] !== '0') o.push(j);
  }
  return o;
};
export const adj = (S, a, b) => {
  const nb = S.G.nb;
  for (let k = 0; k < 6; k++) if (nb[a * 6 + k] === b) return true;
  return false;
};
export function enemyNear(S, c, side) {
  let n = 0;
  for (const j of nbs(S, c)) {
    const L = S.cellU[j];
    if (L.length && L[0].side !== side) n += L.length;
  }
  return n;
}
export const H = (d, m, h = 0) => tOf(d, m, h);
export const formOf = (S, u) => S.forms[u.form];
export const genOf = (id) => GENERALS[id] || null;
export function highOf(S, F) {
  if (!F) return null;
  if (F.side === 'AX' && S.flags.hgd && F.par !== 'IA8') return HIGH.HGD;
  return HIGH[F.par] || null;
}

// ——— черты командиров, действующие на часть ———
export function traits(S, u) {
  const key = u.id * 16 + (S.trv || 0);
  let T = S._tr.get(key);
  if (T) return T;
  T = {};
  const F = S.forms[u.form], add = (g) => {
    const G = GENERALS[g];
    if (G) for (const k of G.tr) T[k] = 1;
  };
  if (u.cmd) add(u.cmd);
  if (F) add(F.gen);
  S._tr.set(key, T);
  return T;
}
export function invalidateTraits(S) {
  S.trv = (S.trv || 0) + 1;
  S._tr.clear();
}

// ——— создание частей ———
function mkUnit(S, form, type, nat, num, name, o = {}) {
  const T = (TPL[nat] && TPL[nat][type]) || TPL[nat].inf, ty = TYPES[type];
  const mult = o.sz && o.sz !== ty.sz ? 3 : 1; // «7-й ск (3 бригады)»
  const auth = { men: T[0] * mult, bay: T[1] * mult, guns: T[2] * mult, at: T[3] * mult, tanks: T[4] * mult, trucks: T[5] * mult };
  const p = o.p ?? 0.9, b = o.b ?? p, g = o.g ?? Math.min(1, p + 0.1);
  if (o.tk && o.tk > auth.tanks) auth.tanks = Math.max(auth.tanks, Math.round(o.tk / 0.95));
  const N = NAT[nat];
  const u = {
    id: S.nid++, form, type, nat, side: N.side, num, name, c: -1, pc: -1,
    auth, men: Math.round(auth.men * p), bay: Math.round(auth.bay * b), guns: Math.round(auth.guns * g), at: Math.round(auth.at * g),
    tanks: o.tk ?? Math.round(auth.tanks * p), trucks: Math.round(auth.trucks * p), rep: 0,
    tr: o.tr ?? 50, xp: o.xp ?? 30, mor: o.mor ?? N.mor, win: N.win, gds: o.gds || type === 'gds' ? 1 : 0,
    amm: 100, fuel: 100, food: 100, fat: 15, ctl: 100, ent: o.ent ?? 0, dis: 0, sup: 1,
    cmd: o.cmd || null, note: o.note || null, sz: o.sz ?? ty.sz,
    ord: null, pend: null, path: null, mp: 0, ovr: 0, still: 12, lc: -99, born: S.t, kills: 0,
  };
  if (u.gds) u.mor = Math.min(95, u.mor + 6);
  const gt = GENERALS[o.cmd]?.tr || [];
  if (gt.includes('guard')) u.mor = Math.min(95, u.mor + 10);
  if (gt.includes('onearm')) u.mor = Math.min(95, u.mor + 5);
  u.mor0 = u.mor;
  return u;
}
// ближайшая своя клетка с местом (поиск в ширину)
export function nearestFree(S, c0, side, sz, allowEnemyOwned = false) {
  if (c0 < 0) return -1;
  const sid = SID[side], seen = new Uint8Array(S.G.n), q = [c0];
  seen[c0] = 1;
  for (let qi = 0; qi < q.length; qi++) {
    const c = q[qi];
    if ((S.own[c] === sid || (allowEnemyOwned && !sideAt(S, c))) && room(S, c, side) >= sz - 1e-6) return c;
    for (const j of nbs(S, c)) if (!seen[j]) (seen[j] = 1), q.push(j);
  }
  return -1;
}
function putUnit(S, u, c) {
  u.c = c;
  S.cellU[c].push(u);
  S.uById.set(u.id, u);
}
export function addUnit(S, u, x, y) {
  const c0 = cellAt(S.G, x, y);
  const c = nearestFree(S, c0 >= 0 ? c0 : 0, u.side, u.sz);
  S.units.push(u);
  if (c < 0) {
    u.dead = 1;
    return u;
  }
  putUnit(S, u, c);
  u.pc = c;
  return u;
}

// ——— новая игра ———
export function newGame(D, o = {}) {
  const S = {
    v: SAVE_V, side: o.side || 'SOV', diff: o.diff ?? 1, hist: !!o.hist, fog: o.fog ?? 1, seed: (o.seed ?? Date.now() % 1e9) >>> 0,
    t: T_START, nid: 1, units: [], forms: {}, own: null, evDone: {}, planDone: {}, reDone: {}, log: [], q: [], flags: {}, vpx: 0, vpl: [],
    st: { lossM: { SOV: 0, AX: 0 }, lossT: { SOV: 0, AX: 0 }, pris: { SOV: 0, AX: 0 }, dest: [] }, air: null, airTot: 0, pk: null, ai: {}, over: null, both: !!o.both,
  };
  S.units = [];
  prepStatic(S, D);
  const G = S.G;
  S.own = new Uint8Array(G.n);
  for (let i = 0; i < G.n; i++) if (D.terr[i] !== '0') S.own[i] = inPoly(G.cx[i], G.cy[i], AXIS0) ? 2 : 1;
  for (const [x, y] of SOV_CITY) S.own[cellAt(G, x, y)] = 1;
  for (const f of FORMS)
    S.forms[f.id] = { id: f.id, side: f.side, nat: f.nat, n: f.n, num: f.num, sub: f.sub || '', ech: f.ech, gen: f.gen, par: f.par, hq: cellAt(G, f.hq[0], f.hq[1]), late: f.late ? 1 : 0, act: f.late ? 0 : 1, dir: { k: 'def', obj: [], oi: 0 }, pdir: null, auto: 1, by: 'plan', dt: S.t };
  for (const [form, type, nat, num, name, x, y, op] of OOB) {
    const u = mkUnit(S, form, type, nat, num, name, op || {});
    // Думитреску предупреждал о наступлении: окопы 3-й румынской армии на уровень выше
    const F = S.forms[form];
    if (F && F.par === 'RA3' && (GENERALS.dum.tr || []).includes('warned') && u.nat === 'ROM') u.ent = Math.min(5, u.ent + 1);
    addUnit(S, u, x, y);
  }
  // исходные директивы — по историческому плану на утро 19 ноября
  applyPlan(S, true);
  computeSupply(S);
  updateVis(S);
  S.vp0 = score(S).vp;
  logAdd(S, '*', `Утро 19 ноября 1942 года. Туман над Доном. Фронты готовы к операции «Уран».`, -1, 'ev');
  return S;
}

// ——— сообщения и журнал ———
export function logAdd(S, side, txt, c = -1, k = 'ev') {
  S.log.push({ t: S.t, s: side, x: txt, c, k });
  if (S.log.length > 400) S.log.splice(0, S.log.length - 400);
}
export function msg(S, m) {
  // сообщение игроку (модальное окно или всплывающая строка); side — кому показывать ('*' — всем)
  m.id = m.id || `m${S.t}_${S.q.length}_${Math.floor(S.rnd() * 1e6)}`;
  m.t = S.t;
  S.q.push(m);
  return m;
}
export const isPlayer = (S, side) => S.side === side;

// ——— директивы соединениям и приказы частям ———
const cellOf = (S, p) => (Array.isArray(p) ? cellAt(S.G, p[0], p[1]) : p);
export function mkDir(S, F, d) {
  const at2 = d.at2 == null ? null : Array.isArray(d.at2) ? cellOf(S, Array.isArray(d.at2[0]) ? d.at2[0] : d.at2) : d.at2;
  // obj: 'cor' — клетки коридора, через который деблокировали котёл (иначе запасные цели alt)
  const obj = d.obj === 'cor' ? (S.flags.cor && S.flags.cor.length ? S.flags.cor : d.alt || []) : d.obj || [];
  const o = { k: d.k, obj: obj.map((p) => cellOf(S, p)).filter((c) => c >= 0), oi: 0, at: d.at ?? null, sub: {}, at2, why: d.why || '' };
  if (d.pk) o.pk = d.pk; // «добивать котёл» (с часа d.pk): по достижении целей — новые цели по остаткам окружённых
  if (d.sub)
    for (const [key, pts] of Object.entries(d.sub)) {
      let u = /^\d+$/.test(key) ? S.uById.get(+key) : null;
      if (!u) u = S.units.find((x) => !x.dead && x.name === key && x.form === F.id) || S.units.find((x) => !x.dead && x.name === key);
      if (u) o.sub[u.id] = pts.map((p) => cellOf(S, p)).filter((c) => c >= 0);
    }
  return o;
}
function chainOf(S, F) {
  const o = [];
  if (HIGH[F.par]) o.push(HIGH[F.par]);
  if (F.side === 'AX' && S.flags.hgd && F.par !== 'IA8') o.push(HIGH.HGD);
  return o;
}
export function dirDelay(S, F) {
  let d = F.nat === 'GER' ? 2 : 3;
  const g = GENERALS[F.gen]?.tr || [];
  let hm = 0, hh = 0;
  for (const h of chainOf(S, F)) {
    const tr = GENERALS[h.gen]?.tr || [];
    if (tr.includes('master') || tr.includes('genius')) hm = 1;
    if (tr.includes('hesitant')) hh = 1;
  }
  if (g.includes('staff')) d--;
  if (g.includes('hesitant') || hh) d += 2;
  d -= hm;
  if (isPlayer(S, F.side)) d += S.diff === 2 ? 1 : S.diff === 0 ? -1 : 0;
  else if (S.side) d += S.diff === 0 ? 1 : 0;
  return Math.max(1, d);
}
export function unitDelay(S, u) {
  let d = u.nat === 'GER' ? 1 : 2;
  const tr = traits(S, u);
  if (tr.staff) d--;
  if (u.ctl < 50) d++;
  if (u.sup === 0) d++;
  if (isPlayer(S, u.side) && S.diff === 2) d++;
  return Math.max(1, d);
}
export function setDirective(S, fid, d, by = 'pl', now = false) {
  const F = S.forms[fid];
  if (!F) return -1;
  const dir = d.obj && d.obj.length && Array.isArray(d.obj[0]) ? mkDir(S, F, d) : { k: d.k, obj: (d.obj || []).slice(), oi: 0, at: d.at ?? null, sub: d.sub ? { ...d.sub } : {}, at2: d.at2 ?? null, why: d.why || '' };
  if (d.pk) dir.pk = d.pk;
  if (by === 'pl') F.auto = 0;
  if (now) {
    F.dir = dir; F.by = by; F.dt = S.t; F.pdir = null; F.replan = 1;
    return S.t;
  }
  const at = S.t + dirDelay(S, F);
  F.pdir = { at, dir, by };
  return at;
}
export function setOrder(S, u, ord, by = 'pl') {
  if (u.dead) return -1;
  if (ord.k === 'army') {
    u.ovr = 0; u.ord = null; u.pend = null; u.path = null;
    return S.t;
  }
  if (by === 'pl') u.ovr = 1;
  const at = by === 'pl' ? S.t + unitDelay(S, u) : S.t;
  if (at <= S.t) applyOrder(S, u, ord);
  else u.pend = { at, ord };
  return at;
}
function applyOrder(S, u, ord) {
  u.ord = { ...ord };
  if (u.ord.k === 'atk') {
    u.ord.ph = 0;
    u.ord.prep = u.ord.prep ?? 2;
    u.ord.at = u.ord.at ?? S.t;
  }
  u.path = null;
  u.wait = 0;
}

// ——— исторический план: директивы ИИ и «рекомендации Ставки/ОКХ» игроку ———
export function planReady(S, P) {
  if (P.when === 'pocket' && !S.flags.pocket) return false;
  // кольцо разорвано деблокадой — Ставка снова требует замкнуть окружение (через 12 ч, если оно не восстановилось само)
  if (P.when === 'relieved' && !(S.flags.relieved && S.t >= S.flags.relieved + 12 && !(S.pk && S.pk.on))) return false;
  if (P.until != null && S.t > P.until) return false;
  if (P.t != null && S.t < P.t) return false;
  return true;
}
export function applyPlan(S, init) {
  for (let i = 0; i < PLAN.length; i++) {
    if (S.planDone[i]) continue;
    const P = PLAN[i];
    if (!planReady(S, P)) continue;
    if (P.when2 === 'lvii' && !(S.forms.LVII && S.forms.LVII.act)) continue;
    S.planDone[i] = 1;
    const ids = P.f === '*AX' ? Object.values(S.forms).filter((f) => f.side === 'AX').map((f) => f.id) : [P.f];
    for (const id of ids) {
      const F = S.forms[id];
      if (!F) continue;
      // особые решения игрока/ИИ могут отменять исторические пункты
      if (S.flags.brk && F.par === 'A6' && P.when === 'pocket') continue;
      if (S.flags.thunder && F.par === 'A6') continue;
      if (S.flags.g2s && id === 'g2' && P.t < tOf(24, 12)) continue;
      const dir = mkDir(S, F, { ...P.dir, why: P.why });
      F.plan = { i, dir, why: P.why, t: S.t };
      if (isPlayer(S, F.side) && !init && !F.auto) {
        msg(S, { k: 'sug', side: F.side, fid: id, pi: i, title: F.side === 'SOV' ? 'Директива Ставки' : 'Директива командования', txt: `${F.n}: ${P.why}`, pause: 0 });
        continue;
      }
      if (init) setDirective(S, id, dir, 'plan', true);
      else {
        const at = setDirective(S, id, dir, 'plan');
        if (isPlayer(S, F.side)) logAdd(S, F.side, `${F.side === 'SOV' ? 'Ставка' : 'Командование'}: ${F.n} — ${P.why} (к ${String((at % 24 + 24) % 24).padStart(2, '0')}:00)`, -1, 'dir');
      }
    }
  }
}
// принять рекомендацию (кнопка «Принять» в сообщении)
export function acceptPlan(S, fid) {
  const F = S.forms[fid];
  if (!F || !F.plan) return -1;
  return setDirective(S, fid, F.plan.dir, 'plan');
}

// ——— поиск пути (Дейкстра по км с учётом рек, льда, ЗОК и тесноты) ———
export function findPath(S, u, goal, opt = {}) {
  const n = S.G.n, dist = new Float64Array(n).fill(Infinity), prev = new Int32Array(n).fill(-1), sid = SID[u.side], ea = S.eadj[u.side];
  const h = new Heap(), max = opt.max ?? 1e9;
  dist[u.c] = 0;
  h.push(u.c, 0);
  while (h.size) {
    const k = h.topKey(), c = h.pop();
    if (k > dist[c]) continue;
    if (c !== u.c && goal(c)) {
      const p = [];
      for (let x = c; x !== u.c; x = prev[x]) p.push(x);
      p.reverse();
      p.km = k;
      return p;
    }
    if (k > max) break;
    for (const j of nbs(S, c)) {
      const L = S.cellU[j];
      if (L.length && L[0].side !== u.side) continue;
      if (ea[c] && ea[j] && S.own[j] !== sid) continue; // из зоны контроля противника — только атакой
      if (opt.own && S.own[j] !== sid && !goal(j)) continue;
      let w = stepCost(S, u, c, j);
      if (!isFinite(w)) continue;
      if (S.own[j] !== sid) w *= opt.safe ? 4 : 1.1;
      if (ea[j]) w *= opt.safe ? 2.5 : 1.25;
      if (L.length && capOf(S, j) - used(S, j) < u.sz - 1e-6 && !goal(j)) w += 6;
      const nd = k + w;
      if (nd < dist[j]) (dist[j] = nd), (prev[j] = c), h.push(j, nd);
    }
  }
  return null;
}
// поле расстояний (км) до цели для типа подвижности — для ИИ (обратная Дейкстра; клетки противника — дорого)
export function distField(S, goals, mob, side, opt = {}) {
  const n = S.G.n, d = new Float64Array(n).fill(Infinity), h = new Heap(), probe = { type: mob === 'arm' ? 'tk' : mob === 'mot' ? 'mot' : mob === 'cav' ? 'cav' : 'inf', nat: side === 'SOV' ? 'SOV' : 'GER', side };
  for (const g of goals) if (g >= 0) (d[g] = 0), h.push(g, 0);
  const eu = opt.enemyCost ?? 40;
  while (h.size) {
    const k = h.topKey(), c = h.pop();
    if (k > d[c]) continue;
    for (const j of nbs(S, c)) {
      let w = stepCost(S, probe, j, c);
      if (!isFinite(w)) {
        if (opt.ignoreRiver) w = 30;
        else continue;
      }
      const L = S.cellU[j];
      if (L.length && L[0].side !== side) w += eu;
      const nd = k + w;
      if (nd < d[j]) (d[j] = nd), h.push(j, nd);
    }
  }
  return d;
}

// ——— передвижение ———
function stepInto(S, u, c) {
  const L = S.cellU[u.c], i = L.indexOf(u);
  if (i >= 0) L.splice(i, 1);
  u.pc = u.c;
  u.c = c;
  S.cellU[c].push(u);
  u.ent = 0;
  u.still = 0;
  u.moved = 1;
  const sid = SID[u.side];
  if (S.own[c] === sid) return void S.fx.push({ k: 'mv', u: u.id, a: u.pc, b: c });
  // прорыв из окружения по тылам противника: след не становится своей территорией
  if (u.ord && u.ord.force) {
    (S.trail || (S.trail = new Map())).set(c, S.own[c]);
    S.own[c] = sid;
    return void S.fx.push({ k: 'mv', u: u.id, a: u.pc, b: c });
  }
  capture(S, c, u.side, u);
  // захват «ничейной» полосы при продвижении: пустые соседние клетки противника, которые не прикрыты его частями (кроме города и через Дон/Волгу)
  const es = enemy(u.side);
  for (const j of nbs(S, c)) {
    if (S.own[j] === sid || !S.own[j] || S.cellU[j].length || S.D.terr[j] === '3') continue;
    const e = S.edge.get(ekey(c, j));
    if (e && e.t >= 2) continue;
    let cov = false;
    for (const k of nbs(S, j)) {
      const L = S.cellU[k];
      if (L.length && L[0].side === es) {
        cov = true;
        break;
      }
    }
    if (!cov) capture(S, j, u.side, null);
  }
  S.fx.push({ k: 'mv', u: u.id, a: u.pc, b: c });
}
function capture(S, c, side, u) {
  const was = S.own[c];
  if (S.trail) S.trail.delete(c);
  S.own[c] = SID[side];
  const tw = S.townAt.get(c);
  if (tw && (tw.t <= 2 || tw.vp) && was) {
    const L = side === 'SOV' ? `Наши войска заняли ${tw.n}` : `Противник занял ${tw.n}`;
    const A = side === 'AX' ? `Войска Оси заняли ${tw.n}` : `Русские заняли ${tw.n}`;
    S.log.push({ t: S.t, s: side, x: side === 'SOV' ? `${u ? u.name + ': ' : ''}освобождён ${tw.n}` : `${u ? u.name + ': ' : ''}занят ${tw.n}`, c, k: 'cap', L, A });
    if (tw.vp >= 3 || tw.n === 'Сталинград') msg(S, { k: 'toast', side: '*', title: side === 'SOV' ? `Освобождён ${tw.n}` : `Пал ${tw.n}`, c, cap: side });
  }
  S.fx.push({ k: 'cap', c, s: side });
}
function nightHalt(S, u) {
  // пехота ночью (0–5 ч) отдыхает, если не приказан ночной марш или отход; черта «ночной рывок» — без остановки
  const h = S.t % 24, tr = traits(S, u);
  if (tr.night || tr.balck || u.ord?.force || u.ord?.k === 'wd') return false;
  if (TYPES[u.type].mob === 'foot') return h >= 0 && h < 5;
  return h >= 1 && h < 4;
}
function moveToward(S, u, wx, goal, safe) {
  if (MECH(u) && u.fuel <= 0.5) {
    u.st = 'нет горючего';
    return;
  }
  if (nightHalt(S, u)) return;
  if (!u.path || !u.path.length) {
    // окружённые части перемещаются только внутри котла (выход — атакой или по приказу на прорыв)
    const pks = pkSet(S), own = !!(pks && pks.has(u.id) && u.sup === 0 && !S.flags.brk && !(u.ord && u.ord.force));
    u.path = findPath(S, u, goal, { safe, own });
    if (!u.path) {
      u.st = 'нет пути';
      u.nofail = (u.nofail || 0) + 1;
      if (u.nofail > 3) (u.ord = u.ovr ? { k: 'hold' } : null), (u.nofail = 0);
      return;
    }
    u.nofail = 0;
  }
  const tr = traits(S, u);
  u.mp = Math.min(u.mp + speedOf(u, S.t, wx, tr), 40);
  const ea = S.eadj[u.side];
  while (u.path.length) {
    const nx = u.path[0], L = S.cellU[nx];
    if (L.length && L[0].side !== u.side) {
      u.path = null;
      break;
    }
    if (room(S, nx, u.side) < u.sz - 1e-6) {
      u.wait = (u.wait || 0) + 1;
      if (u.wait > 3) u.path = null;
      break;
    }
    let c = stepCost(S, u, u.c, nx);
    if (!isFinite(c) || (ea[u.c] && ea[nx] && S.own[nx] !== SID[u.side])) {
      u.path = null;
      break;
    }
    if (ea[u.c] && ea[nx]) c *= 1.5;
    if (u.mp < c) break;
    u.mp -= c;
    u.kmh = (u.kmh || 0) + c;
    u.path.shift();
    u.wait = 0;
    stepInto(S, u, nx);
    if (MECH(u)) u.fuel = Math.max(0, u.fuel - c * (TYPES[u.type].mob === 'arm' ? 0.5 : 0.4) * (tr.staff ? 0.9 : 1));
    if (ea[nx] || goal(nx)) {
      u.mp = 0;
      break;
    }
  }
  if (u.path && !u.path.length) u.path = null;
}
function stepOrder(S, u, wx) {
  const o = u.ord;
  if (!o) return;
  if (u.dis > 0 && o.k === 'atk') return; // расстроенная часть не атакует
  switch (o.k) {
    case 'move':
    case 'wd':
    case 'rest': {
      if (o.to == null || o.to === u.c) {
        if (o.k !== 'rest') u.ord = u.ovr ? { k: 'hold' } : { k: 'hold', done: 1 };
        return;
      }
      moveToward(S, u, wx, (c) => c === o.to, o.k !== 'move');
      if (u.c === o.to && o.k !== 'rest') u.ord = { k: 'hold', done: 1 };
      return;
    }
    case 'atk': {
      const X = o.tgt, L = S.cellU[X];
      if (!L.length || L[0].side === u.side) {
        // цель опустела: занять её, если это земля противника
        if (S.own[X] !== SID[u.side] && room(S, X, u.side) >= u.sz - 1e-6 && o.adv !== 0) {
          moveToward(S, u, wx, (c) => c === X, false);
          if (u.c === X) u.ord = { k: 'hold', done: 1 };
        } else u.ord = { k: 'hold', done: 1 };
        return;
      }
      if (adj(S, u.c, X)) {
        o.ph = (o.ph || 0) + 1;
        if (o.ph <= o.prep) u.amm = Math.max(0, u.amm - 4);
        return;
      }
      moveToward(S, u, wx, (c) => adj(S, c, X) && room(S, c, u.side) >= u.sz - 1e-6, false);
      return;
    }
    default:
      return;
  }
}

// ——— бой ———
function gauss(S) {
  const a = Math.max(1e-9, S.rnd()), b = S.rnd();
  return Math.sqrt(-2 * Math.log(a)) * Math.cos(2 * Math.PI * b);
}
export function diffK(S, side) {
  if (!S.side) return 1;
  if (S.diff === 0) return side === S.side ? 1.15 : 1;
  if (S.diff === 2) return side === S.side ? 1 : 1.1;
  return 1;
}
// внезапность: удар по участку, где давно не было боёв
function surpriseK(S, defs) {
  if (!defs.length) return 1;
  for (const d of defs) if (S.t - d.lc < 96) return 1;
  return defs.every((d) => d.nat === 'GER') ? 1.08 : 1.2;
}
const CROWD = [1, 1, 0.9, 0.75, 0.6, 0.45, 0.35];
export const prepK = (ph, tr) => (0.7 + 0.7 * (1 - Math.exp(-Math.min(6, ph) / 3.2))) * (tr && tr.thorough ? 1.2 : 1);
export function riverK(S, a, b, t = S.t) {
  const e = S.edge.get(ekey(a, b));
  if (!e) return 1;
  if (e.t === 1) return 0.85;
  if (e.t === 2) return e.br ? 0.75 : t >= ICE.donAll ? 0.8 : 0.5;
  return t >= ICE.volga ? 0.6 : 0.3;
}
// расчёт штурма клетки X группой A (без случайности): соотношение сил, ПТО, направления
export function pkSet(S) {
  const P = S.pk;
  if (!P || !P.on) return null;
  if (!S._pks || S._pks.src !== P.ids) S._pks = Object.assign(new Set(P.ids), { src: P.ids });
  return S._pks;
}
export function assaultCalc(S, A, X, o = {}) {
  const tX = terrOf(S, X), defs = o.defs || S.cellU[X], wx = o.wx || S.wx || weather(S.t), temp = wx.temp, t = o.t ?? S.t, night = !isDay(t);
  let dAT = 0;
  for (const d of defs) dAT += antiTank(d) * (1 + 0.05 * d.ent);
  const hugDef = tX === 3 && defs.some((d) => traits(S, d).hug), hugAtk = tX === 3 && A.some((a) => traits(S, a).hug);
  let inf = 0, arm = 0;
  const cells = new Set(), parts = [];
  for (const u of A) {
    const tr = traits(S, u), from = o.from?.get(u.id) ?? u.c;
    cells.add(from);
    let mod = wx.atk;
    if (night && !tr.night && !tr.balck) mod *= 0.75;
    if (tr.bold) mod *= 1.1;
    if ((tr.tank || tr.onearm) && MOBILE(u)) mod *= 1.1;
    if (tr.balck && isDawn(t)) mod *= 1.2;
    if (tX === 3 && tr.street) mod *= 1.3;
    if (u.sup === 0 && !tr.raid) mod *= 0.85;
    if (S.flags.brkOn && u.side === 'AX' && tr.rival) mod *= 1.1;
    if (u.dis > 0) mod *= 0.6;
    mod *= riverK(S, from, X, t);
    const ph = o.prep ?? (u.ord && u.ord.k === 'atk' ? u.ord.ph || 0 : 0);
    const p = atkPower(u, { temp, prepK: prepK(ph, tr), armK: TERR[tX].arm, mod, hugDef });
    parts.push(p);
  }
  // больше 3–4 соединений на 10-км участке — отдача падает
  parts.sort((a, b) => b.inf + b.arm - (a.inf + a.arm));
  parts.forEach((p, i) => {
    const w = CROWD[Math.min(i, CROWD.length - 1)];
    inf += p.inf * w;
    arm += p.arm * w;
  });
  const armEff = arm > 0 ? (arm * arm) / (arm + 0.6 * dAT) : 0;
  let att = (inf + armEff) * (1 + 0.1 * Math.min(3, cells.size - 1));
  if (A.length) att *= diffK(S, A[0].side) * surpriseK(S, defs);
  let def = 0;
  const pks = pkSet(S);
  for (const d of defs) {
    const tr = traits(S, d);
    let mod = TERR[tX].def * entK(d.ent) * (tr.stub ? 1.15 : 1) * (tX === 3 && tr.street ? 1.3 : 1);
    if (d.dis > 0) mod *= 0.7;
    // «крепость Сталинград»: круговая оборона в старых советских укреплениях, пока не начался голод
    if (pks && pks.has(d.id) && d.sup === 0) mod *= d.food > 35 ? 1.3 : d.food > 15 ? 1.1 : 0.95;
    else if (d.sup === 0 && !tr.last) mod *= 0.92;
    def += defPower(d, { temp, mod, hugAtk });
  }
  // огневая поддержка соседей (артиллерия из соседних клеток), не больше 35% собственной обороны
  if (defs.length && !o.noSup) {
    const ds = defs[0].side;
    let sup = 0;
    for (const j of nbs(S, X)) for (const v of S.cellU[j]) if (v.side === ds) sup += P_ART(v) * 0.25 * ammoK(v) * (v.sup > 0 ? 1 : 0.7);
    def += Math.min(sup, def * 0.35);
  }
  if (defs.length) def *= diffK(S, defs[0].side);
  def = Math.max(0.05, def);
  return { att, def, arm, armEff, dAT, dirs: cells.size, R: att / def };
}
const Phi = (x) => {
  // нормальная функция распределения
  const t = 1 / (1 + 0.2316419 * Math.abs(x)), d = 0.3989423 * Math.exp((-x * x) / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return x > 0 ? 1 - p : p;
};
// оценка для игрока и ИИ: вероятности исходов и ожидаемые потери (sig — неточность разведки)
export function estimate(S, A, X, o = {}) {
  const C = assaultCalc(S, A, X, o), sig = Math.sqrt(0.22 * 0.22 + (o.sig || 0) ** 2), lr = Math.log(C.R);
  const c1 = Phi((Math.log(1) - lr) / sig), c2 = Phi((Math.log(1.5) - lr) / sig), c3 = Phi((Math.log(3) - lr) / sig);
  const p = [c1, c2 - c1, c3 - c2, 1 - c3];
  const L = lossFrac(C.R, !isDay(o.t ?? S.t));
  let la = 0, ld = 0, ta = 0;
  for (const u of A) la += u.bay * L.a * 1.5;
  for (const d of o.defs || S.cellU[X]) ld += d.bay * L.d * 1.5;
  if (C.arm > 0) {
    const tl = Math.min(0.35, 0.06 * Math.pow(C.dAT / Math.max(0.1, C.arm), 0.6) + 0.02);
    for (const u of A) ta += u.tanks * tl;
  }
  return { ...C, p, lo: C.R * Math.exp(-sig), hi: C.R * Math.exp(sig), la: Math.round(la), ld: Math.round(ld), ta: Math.round(ta) };
}
function lose(S, u, f, gk = 0.25, ak = 0.35) {
  f = clamp(f, 0, 0.8);
  const bl = Math.min(u.bay, u.bay * f * 1.5), ml = Math.min(u.men - 50, bl / 0.75);
  u.bay -= bl;
  u.men = Math.max(u.bay, u.men - Math.max(0, ml));
  u.guns = Math.max(0, u.guns * (1 - f * gk));
  u.at = Math.max(0, u.at * (1 - f * ak));
  u.trucks = Math.max(0, u.trucks * (1 - f * 0.2));
  S.st.lossM[u.side] += Math.max(0, ml);
  return ml;
}
function loseTanks(S, u, f) {
  const l = Math.min(u.tanks, u.tanks * clamp(f, 0, 0.9));
  u.tanks -= l;
  u.rep += l * 0.4;
  S.st.lossT[u.side] += l * 0.6;
  return l;
}
export function unitVP(u) {
  if (u.side === 'AX') return u.type === 'kg' ? 1 : u.nat === 'GER' ? 3 : 1.5;
  return -(u.sz >= 1 ? 2 : 1);
}
function kill(S, u, how) {
  if (u.dead) return;
  u.dead = 1;
  u.dt = S.t;
  u.how = how;
  const L = S.cellU[u.c], i = L.indexOf(u);
  if (i >= 0) L.splice(i, 1);
  if (how === 'pl') S.st.pris[enemy(u.side)] += u.men;
  S.st.lossM[u.side] += u.men;
  const vp = unitVP(u);
  S.vpx += vp;
  S.st.dest.push({ t: S.t, id: u.id, n: u.name, s: u.side, nat: u.nat, how, vp, c: u.c });
  const what = how === 'pl' ? 'капитулировала' : how === 'ds' ? 'перестала существовать как боевая единица' : 'уничтожена';
  logAdd(S, u.side, `${u.name} ${what}${how === 'pl' ? ` (${fmtN(u.men)} пленных)` : ''}`, u.c, 'kill');
  msg(S, { k: 'toast', side: '*', title: `${u.name} ${what}`, c: u.c, kill: u.side, uid: u.id });
  S.fx.push({ k: 'kill', u: u.id, c: u.c, s: u.side });
  const F = S.forms[u.form];
  if (F && F.dir && F.dir.sub && F.dir.sub[u.id]) delete F.dir.sub[u.id];
}
// отход после неудачной обороны: шагов 1 (отход) или 2 (бегство); false — отходить некуда
function retreat(S, u, steps, from) {
  let moved = 0;
  for (let s = 0; s < steps; s++) {
    let best = -1, bs = -1e9;
    for (const j of nbs(S, u.c)) {
      const L = S.cellU[j];
      if (L.length && L[0].side !== u.side) continue;
      if (S.own[j] !== SID[u.side]) continue;
      if (capOf(S, j) + 1 - used(S, j) < u.sz - 1e-6) continue;
      if (!isFinite(stepCost(S, u, u.c, j))) continue;
      let sc = -2.5 * enemyNear(S, j, u.side) - (isFinite(S.dist[u.side][j]) ? 0.08 * S.dist[u.side][j] : 4) - 0.6 * L.length;
      for (const a of from) sc += 0.8 * hexDist(S.G, a, j);
      if (sc > bs) (bs = sc), (best = j);
    }
    if (best < 0) break;
    const Lc = S.cellU[u.c], i = Lc.indexOf(u);
    if (i >= 0) Lc.splice(i, 1);
    u.pc = u.c;
    u.c = best;
    S.cellU[best].push(u);
    u.ent = 0;
    u.still = 0;
    S.fx.push({ k: 'mv', u: u.id, a: u.pc, b: best, r: 1 });
    moved++;
  }
  return moved > 0;
}
function advance(S, X, A) {
  const cand = A.filter((u) => !u.dead && (!u.ord || u.ord.adv !== 0) && isFinite(stepCost(S, u, u.c, X)) && !(MECH(u) && u.fuel < 3));
  cand.sort((a, b) => (MOBILE(b) ? 1 : 0) - (MOBILE(a) ? 1 : 0) || b.bay + b.tanks * 30 - (a.bay + a.tanks * 30));
  let n = 0;
  for (const u of cand) {
    if (n >= 2) break;
    if (room(S, X, u.side) < u.sz - 1e-6) continue;
    stepInto(S, u, X);
    u.mp = 0;
    u.fat = Math.min(100, u.fat + 3);
    n++;
  }
}
function assault(S, X, A, wx) {
  const defs = S.cellU[X].slice();
  if (!defs.length) return;
  const night = !isDay(S.t), C = assaultCalc(S, A, X, { wx });
  const R = C.R * Math.exp(gauss(S) * 0.22);
  let out = outcome(R);
  if (out === 3 && defs.some((d) => traits(S, d).stern) && R < 3.6) out = 2;
  const L = lossFrac(R, night), city = S.D.terr[X] === '3';
  let la = 0, ld = 0, ta = 0, td = 0;
  for (const u of A) {
    const tr = traits(S, u);
    const a = L.a * (tr.cautious || tr.methodic ? 0.85 : 1) * (city ? 1.25 : 1);
    la += lose(S, u, a, 0.25, 0.3);
    if (u.tanks > 0 && C.arm > 0) ta += loseTanks(S, u, Math.min(0.35, 0.06 * Math.pow(C.dAT / Math.max(0.1, C.arm), 0.6) + 0.02) * (out === 0 ? 1.5 : 1) * (night ? 0.8 : 1));
    u.amm = Math.max(0, u.amm - 10);
    u.fat = Math.min(100, u.fat + 9 * (tr.bold ? 1.2 : 1));
    u.lc = S.t;
    u.la = S.t;
    const dm = out === 0 ? -6 : out === 1 ? -2 : 3;
    u.mor = clamp(u.mor + dm * (tr.steady && dm < 0 ? 0.8 : 1), 5, 99);
  }
  const dMul = out === 2 ? 1.3 : out === 3 ? 1.7 : 1;
  for (const d of defs) {
    const tr = traits(S, d);
    ld += lose(S, d, L.d * dMul, out === 3 ? 0.55 : 0.3, out === 3 ? 0.6 : 0.4);
    if (d.tanks > 0) td += loseTanks(S, d, Math.min(0.45, L.d * 1.3 * dMul + (out === 3 ? 0.25 : 0)));
    d.amm = Math.max(0, d.amm - 6);
    d.fat = Math.min(100, d.fat + 6);
    d.lc = S.t;
    const dm = out === 0 ? 2 : out === 1 ? -3 : out === 2 ? -10 : -22;
    d.mor = clamp(d.mor + dm * (tr.steady && dm < 0 ? 0.8 : 1), 3, 99);
    if (out === 3) d.dis = 8;
  }
  const from = [...new Set(A.map((u) => u.c))];
  let surr = 0;
  if (out >= 2)
    for (const d of defs) {
      if (d.dead) continue;
      const ok = retreat(S, d, out === 3 ? 2 : 1, from);
      if (!ok) {
        if (R >= 2.2 && (d.mor < 35 || d.bay < 300)) {
          kill(S, d, 'pl');
          surr++;
        } else {
          ld += lose(S, d, L.d * 0.5, 0.2, 0.2);
          d.st = 'окружена, держится';
        }
      } else {
        d.ord = d.ovr ? { k: 'hold' } : null;
        d.path = null;
        d.pend = null;
      }
    }
  for (const d of defs) if (!d.dead && d.bay < 120 && d.tanks < 8) kill(S, d, 'ds');
  for (const u of A) if (!u.dead && u.bay < 120 && u.tanks < 8) kill(S, u, 'ds');
  if (!S.cellU[X].length && out >= 2) advance(S, X, A);
  for (const u of A)
    if (!u.dead && u.ord && u.ord.k === 'atk' && u.ord.tgt === X) {
      if (u.ord.rep && S.cellU[X].length && u.amm > 25) (u.ord.ph = 0), (u.ord.prep = 1), (u.ord.at = S.t + 1);
      else u.ord = u.ovr ? { k: 'hold' } : null;
    }
  const an = A.map((u) => u.name), dn = defs.map((d) => d.name);
  S.fx.push({ k: 'bt', c: X, from, out, R, s: A[0].side });
  S.log.push({ t: S.t, s: A[0].side, k: 'bt', c: X, x: `${an.join(', ')} → ${dn.join(', ')}: ${OUT_TXT[out]}${surr ? `, ${surr} ${surr === 1 ? 'часть сдалась' : 'части сдались'}` : ''}`, out, R: Math.round(R * 100) / 100, la: Math.round(la), ld: Math.round(ld), ta: Math.round(ta), td: Math.round(td) });
  if (S.log.length > 400) S.log.splice(0, S.log.length - 400);
  S.lastBt = { c: X, t: S.t, out, R };
}
// пауза между атаками одной части (часы): пехоте нужно подтянуть артиллерию и пополнить боеприпасы
export const ATK_CD = { foot: 5, cav: 4, mot: 3, arm: 3 };
function resolveAll(S, wx) {
  const G = new Map();
  for (const u of S.units) {
    if (u.dead || !u.ord || u.ord.k !== 'atk' || u.dis > 0) continue;
    const o = u.ord, X = o.tgt;
    if ((o.ph || 0) < o.prep || S.t < (o.at || 0) || !adj(S, u.c, X)) continue;
    if (u.la != null && S.t - u.la < ATK_CD[TYPES[u.type].mob]) continue; // после атаки — перегруппировка
    const L = S.cellU[X];
    if (!L.length || L[0].side === u.side) continue;
    if (!G.has(X)) G.set(X, []);
    G.get(X).push(u);
  }
  for (const [X, A] of G) assault(S, X, A, wx);
}

// ——— территория: пустые клетки переходят к тому, кто их окружил ———
function ownNear(S, c0, side, r) {
  const G = S.G;
  for (const u of S.units) if (!u.dead && u.side === side && hexDist(G, u.c, c0) <= r) return true;
  return false;
}
// размер «отрезанного» куска своей территории (без снабжения), к которому относится клетка
function orphanSize(S) {
  const n = S.G.n, own = S.own, sz = (S._os && S._os.length === n && S._os) || new Int16Array(n), cid = new Int32Array(n).fill(-1), q = [];
  S._os = sz;
  sz.fill(0);
  for (let c0 = 0; c0 < n; c0++) {
    const o = own[c0];
    if (!o || cid[c0] >= 0 || isFinite(S.dist[SNAME[o]][c0])) continue;
    q.length = 0;
    q.push(c0);
    cid[c0] = c0;
    for (let i = 0; i < q.length; i++) for (const j of nbs(S, q[i])) if (cid[j] < 0 && own[j] === o && !isFinite(S.dist[SNAME[o]][j])) (cid[j] = c0), q.push(j);
    for (const c of q) sz[c] = Math.min(q.length, 32000);
  }
  return sz;
}
function sweep(S) {
  const n = S.G.n, own = S.own, flips = [], osz = orphanSize(S);
  // след прорывающихся частей возвращается прежнему владельцу, как только они ушли дальше
  if (S.trail && S.trail.size)
    for (const [c, prev] of S.trail) {
      if (S.cellU[c].length) continue;
      if (own[c] !== prev && own[c]) {
        let near = false;
        for (const j of nbs(S, c)) if (S.cellU[j].length && SID[S.cellU[j][0].side] === own[c]) near = true;
        if (near) continue;
        own[c] = prev;
        S.fx.push({ k: 'cap', c, s: SNAME[prev] });
      }
      S.trail.delete(c);
    }
  for (let c = 0; c < n; c++) {
    const o = own[c];
    if (!o || S.cellU[c].length || S.D.terr[c] === '3') continue;
    const e = 3 - o, es = SNAME[e];
    let en = 0, tot = 0, eU = 0, oU = 0;
    for (const j of nbs(S, c)) {
      const ed = S.edge.get(ekey(c, j));
      if (ed && ed.t === 3) continue; // через Волгу не считается
      tot++;
      if (own[j] === e) en++;
      const L = S.cellU[j];
      if (L.length) L[0].side === es ? (eU = 1) : (oU = 1);
    }
    if (tot < 2) continue;
    if (!oU && ((eU && en >= 3) || en >= Math.min(5, tot))) flips.push(c);
    // брошенная земля: клетка без снабжения, своих войск ближе двух клеток нет — отходит к противнику (с края внутрь);
    // так отрезанные районы «тают» до занятых войсками клеток, и окружённые не расползаются по пустой степи
    else if (en >= 1 && osz[c] > 0 && (o === 2 || osz[c] <= 20) && !ownNear(S, c, SNAME[o], 2)) flips.push(c);
  }
  for (const c of flips) {
    own[c] = 3 - own[c];
    S.fx.push({ k: 'cap', c, s: SNAME[own[c]] });
    const tw = S.townAt.get(c);
    if (tw && tw.vp) capture(S, c, SNAME[own[c]], null);
  }
}

// ——— снабжение: Дейкстра от краёв карты по своей территории (ж/д дешевле, реки и Волга — дороже) ———
function supEdgeCost(S, e, side) {
  if (e.t === 1) return 0.2;
  if (e.t === 2) return e.br ? 0.3 : S.t >= ICE.donAll ? 0.6 : 3.5;
  if (side !== 'SOV') return Infinity;
  return S.t >= ICE.volga ? 1.2 : e.fe ? 7 : 12;
}
export function computeSupply(S) {
  const n = S.G.n;
  S.eadj.SOV.fill(0);
  S.eadj.AX.fill(0);
  const nb = S.G.nb;
  // ЗОК для снабжения (не через Дон/Чир/Волгу): пустая клетка в ЗОК противника снабжение не пропускает
  const zoc = S.zocS || (S.zocS = { SOV: new Uint8Array(n), AX: new Uint8Array(n) });
  zoc.SOV.fill(0);
  zoc.AX.fill(0);
  for (const u of S.units) {
    if (u.dead) continue;
    const es = enemy(u.side), E = S.eadj[es], Z = zoc[es];
    for (let k = 0; k < 6; k++) {
      const j = nb[u.c * 6 + k];
      if (j < 0) continue;
      E[j] = 1;
      const e = S.edge.get(ekey(u.c, j));
      if (!e || e.t === 1) Z[j] = 1;
    }
  }
  for (const side of ['SOV', 'AX']) supDist(S, side, zoc[side], null);
  // котёл держится, пока окружённые не соединились со своими войсками извне — дыра в кольце
  // посреди пустой степи снабжения не даёт (иначе котёл «растекается» по незанятой земле)
  const B = S.pk && S.pk.on ? sealCells(S) : null;
  if (B) supDist(S, 'AX', zoc.AX, B);
  for (const u of S.units) {
    if (u.dead) continue;
    const dd = S.dist[u.side][u.c];
    u.sd = isFinite(dd) ? Math.round(dd * 10) / 10 : -1;
    u.sup = isFinite(dd) ? supLevel(dd) : 0;
  }
}
function supDist(S, side, za, blk) {
  const sid = SID[side], d = S.dist[side], h = new Heap(), ea = S.eadj[side], nb = S.G.nb;
  d.fill(Infinity);
  for (const [c, k] of S.D.src[side]) if (S.own[c] === sid && !(blk && blk[c]) && k < d[c]) (d[c] = k), h.push(c, k);
  while (h.size) {
    const k = h.topKey(), c = h.pop();
    if (k > d[c]) continue;
    for (let q = 0; q < 6; q++) {
      const j = nb[c * 6 + q];
      if (j < 0 || S.own[j] !== sid || (blk && blk[j])) continue;
      if (za[j] && !(S.cellU[j].length && S.cellU[j][0].side === side)) continue;
      let w = isRail(S, c) && isRail(S, j) ? 0.4 : 1;
      const e = S.edge.get(ekey(c, j));
      if (e) w += supEdgeCost(S, e, side);
      if (ea[j]) w += 0.6;
      const nd = k + w;
      if (nd < d[j]) (d[j] = nd), h.push(j, nd);
    }
  }
}
// клетки котла, закрытые для снабжения: вокруг окружённых частей, которые не соединились со своими.
// Связь — соприкосновение: соседняя клетка или через одну свободную клетку Оси вне ЗОК противника
// (не через советские войска). Опора извне — снабжаемая часть Оси с не слишком длинным путём подвоза
// (а не такая же «висящая» в пустой степи). От опоры связь идёт по цепочке частей котла.
export const LINK_R = 2, ANCHOR_D = 22;
function touch(S, a, b) {
  const k = hexDist(S.G, a, b);
  if (k <= 1) return true;
  if (k > LINK_R) return false;
  for (const j of nbs(S, a))
    if (hexDist(S.G, j, b) === 1 && S.own[j] === 2 && !S.eadj.AX[j] && !S.cellU[j].some((v) => v.side === 'SOV')) return true;
  return false;
}
function touchesOut(S, C) {
  const d = S.dist.AX, OU = S.units.filter((v) => !v.dead && v.side === 'AX' && v.sup > 0 && d[v.c] <= ANCHOR_D);
  return C.units.some((u) => OU.some((v) => touch(S, u.c, v.c)));
}
function sealCells(S) {
  const P = S.pk, G = S.G, d = S.dist.AX, ids = pkSet(S), PU = [], OU = [];
  for (const u of S.units) {
    if (u.dead || u.side !== 'AX') continue;
    if (ids.has(u.id)) PU.push(u);
    else if (d[u.c] <= ANCHOR_D) OU.push(u);
  }
  if (!PU.length) return null;
  const lk = new Set(), q = [], cor = [];
  for (const u of PU)
    for (const v of OU) {
      if (!touch(S, u.c, v.c)) continue;
      if (!lk.has(u)) lk.add(u), q.push(u);
      // «коридор» — свободная клетка между ними или клетка части извне (цель для того, кто замыкает кольцо снова)
      let c = v.c;
      if (hexDist(G, u.c, v.c) === 2) for (const j of nbs(S, u.c)) if (hexDist(G, j, v.c) === 1 && S.own[j] === 2 && !S.eadj.AX[j]) c = j;
      if (cor.length < 4 && !cor.includes(c)) cor.push(c);
    }
  P.cor = cor;
  while (q.length) {
    const a = q.pop();
    for (const b of PU) if (!lk.has(b) && touch(S, a.c, b.c)) lk.add(b), q.push(b);
  }
  P.lk = lk.size;
  if (lk.size === PU.length) return null;
  const blk = S._blk || (S._blk = new Uint8Array(G.n));
  blk.fill(0);
  let any = 0;
  for (const u of PU) {
    if (lk.has(u)) continue;
    const ring = [u.c];
    for (let r = 0, a = [u.c]; r < LINK_R; r++) {
      const nx = [];
      for (const c of a) for (const j of nbs(S, c)) if (!ring.includes(j)) ring.push(j), nx.push(j);
      a = nx;
    }
    for (const c of ring) {
      if (S.own[c] !== 2 || blk[c]) continue;
      if (OU.some((v) => hexDist(G, c, v.c) <= 1)) continue;
      blk[c] = 1;
      any = 1;
    }
  }
  return any ? blk : null;
}
// отрезанные районы стороны: связные группы своих клеток без пути к источникам
export function cutComps(S, side) {
  const sid = SID[side], d = S.dist[side], n = S.G.n, comp = new Int32Array(n).fill(-1), out = [];
  for (const u of S.units) {
    if (u.dead || u.side !== side || u.sup > 0 || comp[u.c] >= 0) continue;
    const C = { id: out.length, cells: [], units: [], men: 0, divs: 0 }, q = [u.c];
    comp[u.c] = C.id;
    for (let qi = 0; qi < q.length; qi++) {
      const c = q[qi];
      C.cells.push(c);
      for (const j of nbs(S, c)) if (comp[j] < 0 && S.own[j] === sid && !isFinite(d[j])) (comp[j] = C.id), q.push(j);
    }
    out.push(C);
  }
  for (const u of S.units) {
    if (u.dead || u.side !== side || u.sup > 0) continue;
    const C = out[comp[u.c]];
    if (!C) continue;
    C.units.push(u);
    C.men += u.men;
    if (u.sz >= 1) C.divs++;
  }
  S.comp = S.comp || {};
  S.comp[side] = comp;
  return out;
}
function pocketCheck(S) {
  const comps = cutComps(S, 'AX');
  S.pkComps = comps;
  S.pkSov = cutComps(S, 'SOV');
  const P = S.pk;
  const ids = P ? new Set(P.ids) : null;
  // крупнейший отрезанный район (для текущего котла — тот, где больше всего его частей)
  let big = null;
  for (const C of comps) {
    if (C.men < 90000 && !(P && P.on && C.units.some((u) => ids.has(u.id)))) continue;
    const k = P && P.on ? C.units.filter((u) => ids.has(u.id)).length * 1e6 + C.men : C.men;
    if (!big || k > big._k) (big = C), (big._k = k);
  }
  if (!P || !P.on) {
    // «котёл» — это окружение главных сил (не меньше 9 дивизий и 90 тыс.); мелкие группы прорываются сами.
    // Пока отрезанные соприкасаются со своими снабжаемыми частями (см. touch), кольцо не замкнуто
    if (big && big.men >= 90000 && big.divs >= 9 && !touchesOut(S, big)) {
      S.pkPend = (S.pkPend || 0) + 1;
      if (S.pkPend >= 6) formPocket(S, big);
    } else S.pkPend = 0;
    return;
  }
  // в котёл записываются только части армий, окружённых вместе (не деблокирующие соединения)
  if (big) for (const u of big.units) if (!ids.has(u.id) && P.fs && P.fs.includes(u.form)) P.ids.push(u.id), ids.add(u.id);
  let cut = 0, free = 0, men = 0, esc = 0;
  P.esc = P.esc || [];
  P.lc = P.lc || {};
  const was = new Set(P.esc);
  for (const id of P.ids) {
    const u = S.uById.get(id);
    if (!u || u.dead) continue;
    if (u.sup === 0) cut++, (men += u.men), (P.lc[id] = S.t);
    else {
      free++;
      if (!was.has(id)) P.esc.push(id), was.add(id);
      // деблокада — это когда на свободу вышли дивизии, которые ещё недавно были в кольце (не те, что ушли давно)
      if (u.sz >= 1 && P.lc[id] != null && S.t - P.lc[id] <= 36) esc++;
    }
  }
  P.cut = cut;
  P.free = free;
  P.men = men;
  P.cells = comps.reduce((s, C) => (C.units.some((u) => ids.has(u.id)) ? s + C.cells.length : s), 0);
  if (cut === 0 && free === 0) return eliminate(S, 0);
  // деблокада/прорыв: заметная часть окружённых дивизий соединилась со своими (связь — по соприкосновению,
  // см. sealCells) и держится полсуток; иначе, если отрезанного района больше нет, остатки погибли или сдались
  if (esc >= Math.max(3, (P.divs0 || 10) * 0.3)) {
    P.relT = (P.relT || 0) + 1;
    if (P.relT === 1 && !(P.wT > S.t - 24)) {
      P.wT = S.t;
      msg(S, { k: 'ev', side: 'SOV', title: 'Разрыв в кольце', txt: 'Окружённые дивизии соединились со своими через брешь в кольце. Закройте коридор: если он продержится 12 часов, кольцо будет прорвано.', pause: 1 });
      msg(S, { k: 'ev', side: 'AX', title: 'Есть связь с 6-й армией', txt: 'Окружённые дивизии соединились со своими через брешь в кольце. Удержите коридор 12 часов — и кольцо будет прорвано.', pause: 1 });
    }
    if (P.relT >= 12) {
      P.on = 0;
      S.pkPend = 0;
      relieve(S);
      return;
    }
  } else {
    P.relT = 0;
    if (!big) {
      // отрезанного района больше нет: если на свободе заметная часть окружённых дивизий — они вырвались (кольцо
      // разорвано), иначе остатки погибли или сдались
      let fd = 0;
      for (const id of P.ids) {
        const u = S.uById.get(id);
        if (u && !u.dead && u.sup > 0 && u.sz >= 1) fd++;
      }
      if (fd >= Math.max(3, (P.divs0 || 10) * 0.3)) {
        P.on = 0;
        S.pkPend = 0;
        relieve(S);
        return;
      }
      return eliminate(S, 0);
    }
  }
  // рассечение: две части котла по 3+ дивизии, не раньше чем через трое суток
  const parts = comps.filter((C) => C.units.filter((u) => ids.has(u.id) && u.sz >= 1).length >= 3);
  if (parts.length >= 2 && S.t - P.t0 > 72) P.spT = (P.spT || 0) + 1;
  else P.spT = 0;
  if (P.spT >= 6 && !S.flags.split) {
    S.flags.split = S.t;
    msg(S, { k: 'ev', side: '*', title: 'Котёл рассечён', txt: 'Окружённая группировка разрезана на части — каждая обороняется отдельно.', pause: 1 });
    logAdd(S, '*', 'Котёл рассечён на части.', -1, 'pk');
  }
}
function formPocket(S, C) {
  const again = !!S.flags.pocket;
  if (!again) S.flags.pocket = S.t;
  const fs = [...new Set(C.units.map((u) => u.form))];
  // район котла при замыкании (центр и радиус в пикселях карты): ИИ окружённых держит оборону в нём, а не в пустой степи
  let mx = 0, my = 0, r0 = 0;
  for (const u of C.units) (mx += S.G.cx[u.c]), (my += S.G.cy[u.c]);
  (mx /= C.units.length), (my /= C.units.length);
  for (const u of C.units) r0 = Math.max(r0, Math.hypot(S.G.cx[u.c] - mx, S.G.cy[u.c] - my));
  S.pk = { on: 1, t0: S.t, ids: C.units.map((u) => u.id), men0: C.men, divs0: C.divs, cut: C.units.length, free: 0, men: C.men, n: (S.pk?.n || 0) + 1, fs, cells: C.cells.length, esc: [], c0: [Math.round(mx), Math.round(my)], r0: Math.round(r0 + 30) };
  if (again) {
    msg(S, { k: 'ev', side: '*', title: 'Кольцо снова замкнулось', txt: `В окружении — ${fmtN(C.men)} человек.`, pause: 1 });
    logAdd(S, '*', `Кольцо снова замкнулось: ${fmtN(C.men)} человек.`, -1, 'pk');
    return;
  }
  const n = C.divs, m = fmtN(C.men);
  const tw = 'В кольце — 6-я армия и часть 4-й танковой: ' + `${n} ${n % 10 === 1 && n % 100 !== 11 ? 'дивизия' : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? 'дивизии' : 'дивизий'}, около ${m} человек.`;
  msg(S, { k: 'ev', side: 'SOV', title: 'Кольцо замкнулось!', txt: `Войска Юго-Западного и Сталинградского фронтов соединились. ${tw}`, pause: 1, big: 1 });
  msg(S, { k: 'ev', side: 'AX', title: '6-я армия окружена', txt: `Русские клещи сомкнулись за Доном. ${tw} Снабжение — только по воздуху.`, pause: 1, big: 1 });
  logAdd(S, '*', `Окружение: ${tw}`, -1, 'pk');
}
function relieve(S) {
  const again = !!S.flags.relieved;
  S.flags.relieved = S.t;
  S.flags.cor = (S.pk?.cor || []).slice(0, 3);
  if (again) {
    // повторный разрыв — без штрафа; Ставка снова требует перерезать коридор
    for (let i = 0; i < PLAN.length; i++) if (PLAN[i].when === 'relieved' && S.planDone[i]) S.planDone[i] = 0;
    msg(S, { k: 'ev', side: '*', title: 'Кольцо снова разорвано', txt: 'Окружённые соединились со своими. Чтобы уничтожить группировку, коридор нужно перерезать снова.', pause: 1 });
    logAdd(S, '*', 'Кольцо снова разорвано.', -1, 'pk');
    return;
  }
  S.vpx -= 15;
  msg(S, { k: 'ev', side: '*', title: 'Коридор к 6-й армии пробит', txt: 'Деблокирующие войска соединились с окружённой группировкой. Кольцо разорвано.', pause: 1, big: 1 });
  logAdd(S, '*', 'Деблокада: кольцо разорвано (−15 очков СССР).', -1, 'pk');
}
function eliminate(S) {
  const P = S.pk;
  P.on = 0;
  P.tEnd = S.t;
  const early = Math.max(0, (T_END - S.t) / 24) * 0.25;
  S.vpx += 15 + early;
  S.flags.elim = S.t;
  msg(S, { k: 'ev', side: '*', title: 'Окружённая группировка ликвидирована', txt: `Остатки 6-й армии сложили оружие. Всего взято в плен ${fmtN(S.st.pris.SOV)} человек.`, pause: 1, big: 1 });
  logAdd(S, '*', `Котёл ликвидирован (+${Math.round(15 + early)} очков).`, -1, 'pk');
  finish(S, 'pocket');
}

// ——— расход, отдых, пополнения, окопы, дух ———
const REPL = { SOV: 1, GER: 0.6, ROM: 0.3, ITA: 0.3 };
function ctlTarget(S, u, cnt) {
  const F = S.forms[u.form];
  let v = 100;
  if (F && F.hq >= 0) {
    const d = hexDist(S.G, u.c, F.hq);
    if (d > 5) v -= (d - 5) * 6;
  }
  const cap = GENERALS[F?.gen]?.cap ?? 6, n = cnt[u.form] || 0;
  if (n > cap) v -= (n - cap) * 4;
  if (u.sup === 0) v -= 12;
  if (u.dis > 0) v -= 30;
  return clamp(v, 25, 100);
}
function attr(S, u, k) {
  if (k <= 0) return;
  const b = u.bay * k;
  u.bay -= b;
  u.men = Math.max(u.bay, u.men - b * 1.8);
  S.st.lossM[u.side] += b * 1.8;
}
function upkeep(S, u, wx, cnt) {
  const tr = traits(S, u), s = u.sup, mech = MECH(u), contact = S.eadj[u.side][u.c];
  if (s > 0) {
    u.amm = Math.min(100, u.amm + 2.5 * s);
    if (mech) u.fuel = Math.min(100, u.fuel + 3 * s);
    u.food = Math.min(100, u.food + 2 * s);
  }
  u.food = Math.max(0, u.food - 0.42 * (s === 0 ? 0.33 : 1));
  if (mech) u.fuel = Math.max(0, u.fuel - 0.02);
  if (u.moved) u.fat = Math.min(100, u.fat + FAT_GAIN[TYPES[u.type].mob] * (u.kmh > 0 ? 1 : 0.5) * (tr.bold ? 1.2 : 1));
  else if (!contact) u.fat = Math.max(0, u.fat - (u.ord?.k === 'rest' ? 4 : 3));
  else u.fat = Math.max(0, u.fat - 1.2);
  if (!u.moved) {
    u.still = (u.still || 0) + 1;
    if (u.ent < 3 && u.still % 6 === 0) u.ent++;
    else if (u.ent >= 3 && u.ent < 5 && u.still % 24 === 0) u.ent++;
  }
  const base = u.mor0 ?? NAT[u.nat].mor;
  if (s > 0.4 && !contact && u.food > 30) u.mor += (base - u.mor) * 0.012;
  if (s === 0 && !tr.last) u.mor -= tr.raid ? 0.015 : 0.025;
  if (u.food < 10) u.mor -= 0.12;
  if (wx.temp < -20 && u.win < 50) u.mor -= 0.03;
  u.mor = clamp(u.mor, 3, 99);
  if (u.food < 10) attr(S, u, ((10 - u.food) / 10) * 0.0009);
  if (wx.temp < -15) attr(S, u, (1 - u.win / 100) * 0.00012 * ((-15 - wx.temp) / 10 + 1));
  const resting = !contact && !u.moved && S.t - u.lc > 12;
  if (resting && s >= 0.75) {
    const k = 0.0006 * s * (u.ord?.k === 'rest' ? 1.5 : 1) * (tr.improv ? 2 : 1) * (REPL[u.nat] || 0.5);
    if (u.bay < u.auth.bay) {
      const add = u.auth.bay * k;
      u.bay += add;
      u.men = Math.min(u.auth.men * 1.05, u.men + add * 1.6);
    }
    if (u.guns < u.auth.guns) u.guns = Math.min(u.auth.guns, u.guns + u.auth.guns * k * 0.6);
    if (u.at < u.auth.at) u.at = Math.min(u.auth.at, u.at + u.auth.at * k * 0.6);
    if (u.rep > 0.5) {
      const r = Math.min(u.rep, Math.max(0.15, u.rep * 0.012));
      u.rep -= r;
      u.tanks += r;
    }
  }
  u.ctl += (ctlTarget(S, u, cnt) - u.ctl) * 0.15;
  if (u.dis > 0) u.dis--;
  if (u.st && S.t % 6 === 0) u.st = '';
}

// ——— воздушный мост (раз в сутки, в 18:00) ———
export function airPotential(S) {
  let base = 60;
  const bases = [];
  for (const b of S.airBase)
    if (S.own[b.c] === 2) {
      base += b.n === 'Тацинская' ? 130 : 90;
      bases.push(b.n);
    }
  return { base, bases };
}
function airlift(S) {
  const P = S.pk;
  if (!P || !P.on) return;
  const units = P.ids.map((id) => S.uById.get(id)).filter((u) => u && !u.dead && u.sup === 0);
  if (!units.length) return;
  const men = units.reduce((s, u) => s + u.men, 0), need = (men * 2.8) / 1000;
  const days = (S.t - S.flags.pocket) / 24, ramp = clamp(0.35 + days * 0.09, 0.35, 1);
  const { base, bases } = airPotential(S);
  let pa = 0.12, fld = 'сброс контейнеров';
  const inP = (c) => S.own[c] === 2 && !isFinite(S.dist.AX[c]);
  const tws = S.D.towns.filter((t) => t.air === 2);
  const pit = tws.find((t) => t.n === 'Питомник'), gum = tws.find((t) => t.n === 'Гумрак');
  let ac = -1;
  if (pit && inP(pit.c)) (pa = 1), (fld = 'Питомник'), (ac = pit.c);
  else if (gum && inP(gum.c)) (pa = 0.5), (fld = 'Гумрак'), (ac = gum.c);
  let flak = 1;
  if (ac >= 0) for (const u of S.units) if (!u.dead && u.side === 'SOV' && hexDist(S.G, u.c, ac) <= 2) flak = 0.75;
  const fly = 0.25 + 0.75 * weather(S.t - 6).fly;
  const del = S.flags.brk ? 0 : Math.round(base * ramp * fly * pa * flak);
  const frac = del / Math.max(1, need);
  for (const u of units) {
    u.food = Math.min(100, u.food + 10 * frac * 1.15);
    u.amm = Math.min(100, u.amm + 9 * frac);
    if (MECH(u)) u.fuel = Math.min(100, u.fuel + 10 * frac);
  }
  S.air = { t: S.t, del, need: Math.round(need), bases, pa, fly: Math.round(fly * 100) / 100, fld, ramp: Math.round(ramp * 100) / 100 };
  S.airTot = (S.airTot || 0) + del;
  S.airDays = (S.airDays || 0) + 1;
  logAdd(S, 'AX', `Воздушный мост: доставлено ${del} т при потребности ${Math.round(need)} т (${fld}).`, ac, 'air');
}

// ——— штабы перемещаются за войсками ———
function moveHQs(S) {
  const by = {};
  for (const u of S.units) if (!u.dead) (by[u.form] = by[u.form] || []).push(u);
  for (const F of Object.values(S.forms)) {
    const U = by[F.id];
    if (!U || !U.length || !F.act) continue;
    let x = 0, y = 0;
    for (const u of U) (x += S.G.cx[u.c]), (y += S.G.cy[u.c]);
    x /= U.length;
    y /= U.length;
    const c0 = cellAt(S.G, x, y), sid = SID[F.side];
    let best = F.hq, bs = -1e9;
    const cand = new Set([F.hq]);
    if (c0 >= 0) {
      cand.add(c0);
      for (const j of nbs(S, c0)) {
        cand.add(j);
        for (const k of nbs(S, j)) cand.add(k);
      }
    }
    for (const c of cand) {
      if (c < 0 || S.own[c] !== sid) continue;
      let sc = -hexDist(S.G, c, c0 >= 0 ? c0 : c) * 1.2 - (S.eadj[F.side][c] ? 6 : 0) - (c === F.hq ? -0.8 : 0) - (isFinite(S.dist[F.side][c]) ? 0 : 1);
      for (const j of nbs(S, c)) if (S.eadj[F.side][j]) sc -= 1.2;
      if (sc > bs) (bs = sc), (best = c);
    }
    F.hq = best;
  }
}

// ——— подкрепления ———
function arrivals(S) {
  REINF.forEach((r, i) => {
    if (S.reDone[i] || S.t < r.t) return;
    S.reDone[i] = 1;
    let at = r.at;
    if (r.form === 'g2' && S.flags.g2s) at = [120, 40];
    const F = S.forms[r.form];
    const c0 = cellAt(S.G, at[0], at[1]);
    if (F && !F.act) (F.act = 1), (F.hq = c0);
    const made = [];
    for (const [type, nat, num, name, o] of r.units) {
      const u = mkUnit(S, r.form, type, nat, num, name, o || {});
      let c = nearestFreeSup(S, c0, u.side, u.sz);
      S.units.push(u);
      if (c < 0) {
        u.dead = 1;
        continue;
      }
      putUnit(S, u, c);
      u.pc = c;
      u.st = 'прибыла';
      u.lc = S.t - 200;
      made.push(u);
    }
    if (r.form === 'g2' && S.flags.g2s && F) setDirective(S, 'g2', { k: 'atk', obj: [[105, 371], [40, 470]], why: '«Большой Сатурн»: через Тацинскую — на Ростов.' }, 'plan', true);
    msg(S, { k: 'arr', side: r.side, title: 'Подкрепления', txt: r.msg, c: made[0]?.c ?? c0, uid: made[0]?.id, pause: 0 });
    logAdd(S, r.side, r.msg, made[0]?.c ?? c0, 'arr');
  });
}
function nearestFreeSup(S, c0, side, sz) {
  const sid = SID[side], seen = new Uint8Array(S.G.n), q = [c0];
  if (c0 < 0) return -1;
  seen[c0] = 1;
  for (let qi = 0; qi < q.length; qi++) {
    const c = q[qi];
    if (S.own[c] === sid && isFinite(S.dist[side][c]) && room(S, c, side) >= sz - 1e-6 && !S.eadj[side][c]) return c;
    for (const j of nbs(S, c)) if (!seen[j]) (seen[j] = 1), q.push(j);
  }
  return nearestFree(S, c0, side, sz);
}

// ——— события по сценарию и решения ———
const EV_NEED = { prep: 'a5t', south: 'a51', saturn: 'g1b', ring: 'a65', storm: 'LVII' };
function evFx(S, fx) {
  if (fx === 'manst') (S.flags.hgd = 1), invalidateTraits(S);
  else if (fx === 'heim') {
    const F = S.forms.XLVIII;
    if (F && F.gen === 'hem') (F.gen = 'kno'), invalidateTraits(S);
  } else if (fx === 'g3') {
    const F = S.forms.g1;
    if (F) (F.n = '3-я гвардейская армия'), (F.num = '3');
  }
}
function scriptEvents(S) {
  for (const E of EVENTS) {
    if (S.evDone[E.id] || S.t < E.t) continue;
    if (E.when === 'pocket' && (!S.pk || !S.pk.on)) {
      if (S.t > E.t + 96) S.evDone[E.id] = 1;
      continue;
    }
    const need = EV_NEED[E.id];
    if (need) {
      const F = S.forms[need];
      if (!F || !F.act || F.dir.k !== 'atk') {
        if (S.t > E.t + 48) S.evDone[E.id] = 1;
        continue;
      }
    }
    S.evDone[E.id] = 1;
    if (E.fx) evFx(S, E.fx);
    msg(S, { k: 'ev', side: E.side, title: E.title, txt: E.txt, pause: E.pause || 0 });
    logAdd(S, '*', `${E.title}. ${E.txt}`, -1, 'ev');
  }
}
export function reliefDist(S) {
  const P = S.pkComps || [], big = P.filter((c) => c.men >= 50000);
  if (!big.length) return 99;
  let best = 99;
  for (const u of S.units) {
    if (u.dead || u.side !== 'AX' || u.sup === 0 || u.form !== 'LVII') continue;
    for (const C of big) for (const c of C.cells) best = Math.min(best, hexDist(S.G, u.c, c));
  }
  return best;
}
export const DECS = [
  {
    id: 'brk', side: 'AX', title: '6-я армия окружена',
    txt: 'Русские клещи сомкнулись у Калача. Паулюс просит у Гитлера свободы действий: прорываться на юго-запад, пока у танков есть горючее, а у пушек — снаряды. Гитлер требует занять круговую оборону: Геринг обещает снабжать «крепость Сталинград» по воздуху.',
    opts: [
      { t: 'Круговая оборона', d: 'Приказ фюрера: держаться и ждать деблокады. Снабжение — воздушным мостом.' },
      { t: 'Прорыв на юго-запад', d: 'Без разрешения: корпуса бросают тяжёлое вооружение и пробиваются к Нижне-Чирской. Воздушного моста не будет.', fx: 'brk' },
    ],
    ready: (S) => S.pk && S.pk.on && S.t >= S.flags.pocket + 4,
    ai: (S) => (S.hist ? 0 : S.rnd() < 0.25 ? 1 : 0),
  },
  {
    id: 'thunder', side: 'AX', title: '«Удар грома»?',
    txt: 'Танки Гота прорвались к реке Мышкова — до котла около 50 км. Манштейн требует от 6-й армии встречного удара «Удар грома», оставив Сталинград. Горючего у танков — километров на 30. Гитлер против.',
    opts: [
      { t: 'Держать «крепость Сталинград»', d: 'Ждать, пока Гот пробьётся сам. Город остаётся за нами.' },
      { t: '«Удар грома»: навстречу Готу', d: 'Все корпуса 6-й армии бьют на юго-запад, к танкам LVII корпуса. Город придётся оставить.', fx: 'thunder' },
    ],
    ready: (S) => S.pk && S.pk.on && !S.flags.brk && S.t >= tOf(17, 12) && reliefDist(S) <= 6,
    ai: (S) => (S.hist ? 0 : reliefDist(S) <= 5 && S.rnd() < 0.7 ? 1 : 0),
  },
  {
    id: 'g2', side: 'SOV', title: 'Куда направить 2-ю гвардейскую армию?',
    txt: 'От Котельникова к котлу идут немецкие танки. Василевский предлагает повернуть 2-ю гвардейскую армию — сильнейший резерв Ставки — на реку Мышкова, против Гота. Тогда «Сатурн» на Ростов придётся урезать до «Малого Сатурна».',
    opts: [
      { t: 'На Мышкову — против Гота', d: 'Как в истории: армия Малиновского выйдет на рубеж Мышковы 15 декабря.' },
      { t: '«Большой Сатурн» — на Ростов', d: 'Армия наступает со Среднего Дона на Тацинскую и дальше к Ростову. Против Гота — только 51-я армия и танковые корпуса.', fx: 'g2s' },
    ],
    ready: (S) => S.t >= tOf(12, 12, 10) && S.forms.LVII && S.forms.LVII.act,
    ai: () => 0,
  },
];
function decFx(S, fx) {
  const A6 = Object.values(S.forms).filter((F) => F.side === 'AX' && (F.par === 'A6' || F.id === 'IV'));
  if (fx === 'brk') {
    S.flags.brk = S.t;
    S.flags.brkOn = 1;
    for (const F of A6) setDirective(S, F.id, { k: 'atk', obj: [[385, 300], [340, 341]], why: 'Прорыв из котла на Нижне-Чирскую.' }, 'plan');
    for (const id of S.pk?.ids || []) {
      const u = S.uById.get(id);
      if (u && !u.dead) (u.mor = Math.max(5, u.mor - 5)), (u.guns *= 0.85);
    }
    logAdd(S, 'AX', 'Паулюс отдал приказ о прорыве без разрешения ставки фюрера.', -1, 'dec');
  } else if (fx === 'thunder') {
    S.flags.thunder = S.t;
    S.flags.brkOn = 1;
    let tgt = cellAt(S.G, 431, 340), bd = 99;
    for (const u of S.units)
      if (!u.dead && u.form === 'LVII' && u.sup > 0) {
        const C = (S.pkComps || []).find((c) => c.men >= 50000);
        if (!C) continue;
        for (const c of C.cells) {
          const d = hexDist(S.G, u.c, c);
          if (d < bd) (bd = d), (tgt = u.c);
        }
      }
    for (const F of A6) setDirective(S, F.id, { k: 'atk', obj: [tgt], why: '«Удар грома»: навстречу LVII танковому корпусу.' }, 'plan');
    logAdd(S, 'AX', '«Удар грома»: 6-я армия бьёт навстречу Готу.', -1, 'dec');
  } else if (fx === 'g2s') {
    S.flags.g2s = 1;
    logAdd(S, 'SOV', 'Ставка: 2-я гвардейская армия направлена на Средний Дон — «Большой Сатурн».', -1, 'dec');
  }
}
function decisions(S) {
  S.decDone = S.decDone || {};
  for (const D of DECS) {
    if (S.decDone[D.id] || !D.ready(S)) continue;
    if (isPlayer(S, D.side)) {
      if (S.decWait) continue;
      S.decWait = D.id;
      S.decDone[D.id] = -1;
      msg(S, { k: 'dec', side: D.side, dec: D.id, title: D.title, txt: D.txt, opts: D.opts.map((o) => ({ t: o.t, d: o.d })), pause: 1 });
    } else {
      const k = D.ai(S);
      S.decDone[D.id] = k + 1;
      if (D.opts[k].fx) decFx(S, D.opts[k].fx);
    }
  }
}
export function decide(S, id, k) {
  const D = DECS.find((d) => d.id === id);
  if (!D) return;
  S.decDone = S.decDone || {};
  S.decDone[id] = k + 1;
  if (S.decWait === id) S.decWait = null;
  if (D.opts[k] && D.opts[k].fx) decFx(S, D.opts[k].fx);
  logAdd(S, D.side, `Решение: ${D.opts[k]?.t || ''}`, -1, 'dec');
}

// ——— разведка: что видит игрок ———
export function updateVis(S) {
  const V = S.vis;
  if (!S.side || !S.fog) {
    V.fill(1);
    for (const u of S.units) if (!u.dead) (u.sn = S.t), (u.snc = u.c), (u.sna = 1);
    return;
  }
  V.fill(0);
  const side = S.side, sid = SID[side], wx = S.wx || weather(S.t), r = isDay(S.t) && wx.k !== 'f' && wx.k !== 'b' ? 2 : 1;
  for (let c = 0; c < S.G.n; c++) if (S.own[c] === sid) V[c] = 1;
  for (const u of S.units) {
    if (u.dead || u.side !== side) continue;
    V[u.c] = 3;
    for (const j of nbs(S, u.c)) {
      V[j] = Math.max(V[j], 3);
      if (r > 1) for (const k of nbs(S, j)) V[k] = Math.max(V[k], 2);
    }
  }
  for (const u of S.units) {
    if (u.dead || u.side === side) continue;
    if (V[u.c] >= 2) (u.sn = S.t), (u.snc = u.c), (u.sna = V[u.c] === 3 ? 1 : 2);
  }
  const h = S.t % 24;
  if ((h === 11 || h === 14) && wx.fly >= 0.4) {
    for (const u of S.units) {
      if (u.dead || u.side === side || (u.sn === S.t && u.sna === 1)) continue;
      let near = 99;
      for (const v of S.units) if (!v.dead && v.side === side) near = Math.min(near, hexDist(S.G, u.c, v.c));
      if (near <= 7 && S.rnd() < 0.45 * wx.fly) (u.sn = S.t), (u.snc = u.c), (u.sna = 3);
    }
  }
}
// видит ли игрок часть сейчас (или «призрак» последнего наблюдения)
export function seenNow(S, u) {
  if (!S.side || !S.fog || u.side === S.side) return true;
  return u.sn === S.t;
}

// ——— очки победы (с точки зрения СССР) ———
export const REF_VP = 115; // «исторический» итог ИИ против ИИ (tools/sim-staff.mjs, сиды 1–6: 111–127, котёл добит 25–28 января)
export function score(S) {
  let vp = 0;
  const towns = [];
  for (const tw of S.vpTowns) if (S.own[tw.c] === 1) (vp += tw.vp), towns.push([tw.n, tw.vp]);
  const cc = S.cityCells.filter((c) => S.own[c] === 1).length, cvp = Math.round((100 * cc) / S.cityCells.length) / 10;
  vp += cvp + S.vpx;
  return { vp: Math.round(vp * 10) / 10, cityVP: cvp, city: cc, cityN: S.cityCells.length, towns, units: Math.round(S.vpx * 10) / 10 };
}
export function starsFor(side, vp, ref = REF_VP) {
  if (side === 'SOV') return vp >= ref * 1.15 ? 3 : vp >= ref * 0.95 ? 2 : vp >= ref * 0.75 ? 1 : 0;
  return vp <= ref * 0.55 ? 3 : vp <= ref * 0.75 ? 2 : vp <= ref * 0.92 ? 1 : 0;
}
function finish(S, why) {
  if (S.over) return;
  const sc = score(S);
  S.over = { t: S.t, why, vp: sc.vp, stars: S.side ? starsFor(S.side, sc.vp) : 0 };
  msg(S, { k: 'end', side: '*', title: 'Операция завершена', pause: 1 });
}

// ——— такт: один час ———
export function tick(S) {
  if (S.over) return;
  S.t++;
  const t = S.t, wx = weather(t);
  S.wx = wx;
  for (const F of Object.values(S.forms))
    if (F.pdir && F.pdir.at <= t) {
      F.dir = F.pdir.dir;
      F.by = F.pdir.by;
      F.dt = t;
      F.pdir = null;
      F.replan = 1;
      if (isPlayer(S, F.side)) logAdd(S, F.side, `${F.n} получила директиву: ${dirText(S, F.dir)}`, -1, 'dir');
    }
  for (const u of S.units) if (!u.dead && u.pend && u.pend.at <= t) applyOrder(S, u, u.pend.ord), (u.pend = null);
  arrivals(S);
  const L = S.units.filter((u) => !u.dead);
  for (let i = L.length - 1; i > 0; i--) {
    const j = Math.floor(S.rnd() * (i + 1));
    [L[i], L[j]] = [L[j], L[i]];
  }
  for (const u of L) (u.kmh = 0), (u.moved = 0);
  for (const u of L) if (!u.dead && u.ord) stepOrder(S, u, wx);
  resolveAll(S, wx);
  sweep(S);
  computeSupply(S);
  pocketCheck(S);
  if (S.over) return;
  const cnt = {};
  for (const u of L) if (!u.dead) cnt[u.form] = (cnt[u.form] || 0) + 1;
  for (const u of L) if (!u.dead) upkeep(S, u, wx, cnt);
  if (t % 24 === 18) airlift(S);
  if (t % 6 === 0) moveHQs(S);
  scriptEvents(S);
  applyPlan(S, false);
  decisions(S);
  updateVis(S);
  if (t % 24 === 0) S.vpl.push([t, score(S).vp]);
  if (S.fx.length > 3000) S.fx.splice(0, S.fx.length - 3000);
  if (S.q.length > 200) S.q.splice(0, S.q.length - 200);
  if (t >= T_END) finish(S, 'time');
}

// ——— тексты для интерфейса ———
export function placeName(S, c) {
  if (c == null || c < 0) return '';
  const tw = S.townAt.get(c);
  if (tw) return tw.n;
  let best = null, bd = 1e9;
  for (const t of S.D.towns) {
    const d = (t.x - S.G.cx[c]) ** 2 + (t.y - S.G.cy[c]) ** 2;
    if (d < bd && t.t <= 2) (bd = d), (best = t);
  }
  return best ? (Math.sqrt(bd) < 14 ? best.n : `район ${best.n}`) : '';
}
export const DIR_N = { atk: 'Наступать', def: 'Оборонять', wd: 'Отходить', res: 'Резерв' };
export function dirText(S, d) {
  if (!d) return '';
  if (d.k === 'atk') return `наступать на ${d.obj.slice(d.oi || 0).map((c) => placeName(S, c)).join(' → ') || 'цель'}`;
  if (d.k === 'def') return d.at2 != null ? `оборонять рубеж у ${placeName(S, d.at2)}` : 'оборонять занимаемый рубеж';
  if (d.k === 'wd') return `отходить к ${placeName(S, d.at2)}`;
  if (d.k === 'res') return `резерв у ${placeName(S, d.at2)}`;
  return '';
}
export const ORD_N = { move: 'Марш', atk: 'Атака', hold: 'Держать', wd: 'Отход', rest: 'Отдых' };
export function statusOf(S, u) {
  if (u.dead) return u.how === 'pl' ? 'капитулировала' : 'уничтожена';
  const o = u.ord;
  if (u.pend) return `ждёт приказ (к ${String(u.pend.at % 24).padStart(2, '0')}:00)`;
  if (u.dis > 0) return 'расстроена после боя';
  if (MECH(u) && u.fuel < 3 && o && o.k !== 'hold') return 'стоит без горючего';
  if (!o) return S.eadj[u.side][u.c] ? 'в обороне, в соприкосновении' : 'в резерве';
  if (o.k === 'atk') {
    const tgt = placeName(S, o.tgt);
    if (!adj(S, u.c, o.tgt)) return `выдвигается для атаки (${tgt})`;
    if ((o.ph || 0) < o.prep) return `готовит атаку: ${o.ph || 0}/${o.prep} ч`;
    return `атакует (${tgt})`;
  }
  if (o.k === 'move') return `марш: ${placeName(S, o.to)}`;
  if (o.k === 'wd') return `отход: ${placeName(S, o.to)}`;
  if (o.k === 'rest') return 'отдых и пополнение';
  if (o.k === 'hold') return S.eadj[u.side][u.c] ? 'держит рубеж' : 'стоит на месте';
  return '';
}
export function cv(S, u) {
  return combatValue(u, (S.wx || weather(S.t)).temp);
}
export { catOf };

// ——— сохранение ———
const KEYS = ['v', 'side', 'diff', 'hist', 'fog', 'seed', 't', 'nid', 'units', 'forms', 'evDone', 'planDone', 'reDone', 'log', 'q', 'flags', 'vpx', 'vpl', 'st', 'air', 'airTot', 'airDays', 'pk', 'ai', 'over', 'both', 'decDone', 'decWait', 'vp0', 'pkPend', 'trv'];
export function save(S) {
  const o = {};
  for (const k of KEYS) o[k] = S[k];
  o.own = Array.from(S.own).join('');
  o.trail = S.trail ? [...S.trail] : [];
  o.rs = S.rnd.state();
  return JSON.stringify(o, (k, v) => (k[0] === '_' || k === 'path' ? undefined : typeof v === 'number' && !Number.isInteger(v) ? Math.round(v * 1000) / 1000 : v));
}
export function load(D, str) {
  const o = typeof str === 'string' ? JSON.parse(str) : str;
  if (!o || o.v !== SAVE_V) throw new Error('несовместимое сохранение');
  const S = o;
  S.own = Uint8Array.from(o.own.split(''), Number);
  S.trail = new Map(o.trail || []);
  prepStatic(S, D);
  S.wx = weather(S.t);
  computeSupply(S);
  S.pkComps = cutComps(S, 'AX');
  S.pkSov = cutComps(S, 'SOV');
  updateVis(S);
  return S;
}
export { T_START, T_END, weather, dateLabel, shortDate, isDay };
