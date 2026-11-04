// «Барбаросса 1941» (v0.8): правила главы — движение, бой с прогнозом, снабжение, котлы, приказы (очки
// командования), способности генералов, решения, цели и «Часы Барбароссы», сохранение. Без DOM.
// День = фаза Германии, затем фаза СССР. В свою фазу сначала ходят соседи игрока (ИИ), затем игрок.
import { decodeMap } from './hex.js';
import { OOB, DAYS, FORMS, GOALS, DECISIONS, ABIL, HIST, CLOCK, FORT, UR, PLAYER, WEATHER, ROADS, shortName, topForm } from './data.js';

export const OWN = { GER: 1, SOV: 2 };
export const CFG = { supOwn: 2 }; // 1 — только свои гексы; 2 — плюс тонкий «след» противника без его войск рядом
export const other = (s) => (s === 'GER' ? 'SOV' : 'GER');
export const NAT = {
  GER: { n: 'Германия', color: '#7a7f86', dark: '#3a3d42', light: '#a9aeb5', orgMax: 100, vis: 3, cp: 4, air: 3 },
  SOV: { n: 'СССР', color: '#9a3328', dark: '#4a120c', light: '#d0675a', orgMax: 70, vis: 2, cp: 3, air: 1 },
};
export const TYPES = {
  inf: { n: 'пехота', atk: 6, def: 7, mp: 2 },
  cav: { n: 'кавалерия', atk: 5, def: 5.5, mp: 3 },
  mot: { n: 'мотопехота', atk: 7, def: 6.5, mp: 4, mech: 1 },
  arm: { n: 'танки', atk: 10, def: 7, mp: 4, mech: 1 },
  gar: { n: 'гарнизон', atk: 2, def: 6, mp: 0 },
};
const C = (inf, cav, mot, arm) => ({ inf, cav, mot, arm, gar: inf });
export const TERR = [
  { n: 'море', def: 1, c: C(99, 99, 99, 99), aa: 1 },
  { n: 'озеро', def: 1, c: C(99, 99, 99, 99), aa: 1 },
  { n: 'равнина', def: 1, c: C(1, 1, 1, 1), aa: 1 },
  { n: 'лес', def: 1.4, c: C(1, 1, 2, 2), aa: 0.7 },
  { n: 'холмы', def: 1.3, c: C(1, 1, 2, 2), aa: 0.85 },
  { n: 'горы', def: 1.6, c: C(2, 2, 3, 3), aa: 0.6 },
  { n: 'болота', def: 1.4, c: C(2, 2, 3, 3), aa: 0.55 },
  { n: 'город', def: 1.6, c: C(1, 1, 1, 1), aa: 0.7 },
];
export const DIFF = ['Лёгкая', 'Нормальная', 'Тяжёлая'];
const DIFF_PL = [1.2, 1, 0.9], DIFF_AI = [0.9, 1, 1.1];
export const lvl = (xp) => (xp >= 12 ? 3 : xp >= 7 ? 2 : xp >= 3 ? 1 : 0);
export const VET = ['', 'обстрелянные', 'опытные', 'ветераны'];
export const orgMax = (u) => NAT[u.side].orgMax;
export const alive = (u) => !u.dead && !u.sur && u.c >= 0;

// ——— случайные числа (детерминированно от зерна; состояние в S.rs) ———
export function rnd(S) {
  let t = (S.rs = (S.rs + 0x6d2b79f5) >>> 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

// ——— создание партии ———
function attach(S, M) {
  M.addRoads(ROADS);
  Object.defineProperty(S, 'M', { value: M, enumerable: false, writable: true });
  Object.defineProperty(S, 'at', { value: new Int16Array(M.N), enumerable: false, writable: true });
  Object.defineProperty(S, 'U', { value: new Map(), enumerable: false, writable: true });
  Object.defineProperty(S, 'cache', { value: {}, enumerable: false, writable: true });
  reindex(S);
}
export function reindex(S) {
  S.at.fill(-1);
  S.U.clear();
  S.units.forEach((u, k) => {
    S.U.set(u.id, u);
    if (alive(u)) S.at[u.c] = k;
  });
  S.ver = (S.ver || 0) + 1;
  S.cache = {};
}
const touch = (S) => ((S.ver = (S.ver || 0) + 1), (S.cache = {}));
export const unitAt = (S, h) => (h >= 0 && S.at[h] >= 0 ? S.units[S.at[h]] : null);

function findFree(S, h0, side) {
  const M = S.M, seen = new Uint8Array(M.N);
  let q = [h0];
  seen[h0] = 1;
  while (q.length) {
    const nq = [];
    for (const h of q) {
      if (M.land(h) && S.owner[h] === OWN[side] && S.at[h] < 0) return h;
      for (const j of M.nbr[h]) if (!seen[j]) (seen[j] = 1), nq.push(j);
    }
    q = nq;
  }
  return -1;
}
function placeUnit(S, u, lon, lat) {
  const h0 = S.M.hexLL(lon, lat), h = findFree(S, h0 < 0 ? 0 : h0, u.side);
  if (h < 0) return false;
  u.c = h;
  S.at[h] = S.units.indexOf(u);
  touch(S);
  return true;
}
export function newGame(J, opt = {}) {
  const M = decodeMap(J), side = opt.side === 'SOV' ? 'SOV' : 'GER', seed = (opt.seed ?? Date.now()) >>> 0;
  const S = {
    v: 1, side, diff: opt.diff ?? 1, seed, rs: seed, day: 0, ph: 'GER', step: 'new', owner: Uint8Array.from(M.owner0), units: [],
    cp: 0, air: 0, airAI: 0, abil: {}, trust: 5, flags: {}, dec: {}, caps: {}, buf: [],
    stats: { GER: { lost: 0, men: 0, tk: 0, div: 0, pris: 0 }, SOV: { lost: 0, men: 0, tk: 0, div: 0, pris: 0 } },
    log: [], ev: [], over: null, pk: {}, goals: {},
  };
  for (const c of M.cities) if (c.name === 'Брест') S.owner[c.hex] = OWN.SOV; // крепость — советская
  attach(S, M);
  const pf = PLAYER[side].fm;
  for (const o of OOB) {
    const u = {
      id: o.id, side: o.side, t: o.t, num: o.num, name: o.name, fm: o.fm, top: topForm(o.fm), cmd: 0, c: -1,
      str: o.str, str0: o.str, q: o.q, men: o.men, tk: o.tk, gun: o.gun, cdr: o.cdr, arr: o.arr,
      org: 0, xp: 0, ent: 0, mp: 0, mv: 0, at: 0, prep: 0, fmch: 0, oos: 0, dead: 0, sur: 0, hit: -1, fought: -1, kills: 0, lon: o.lon, lat: o.lat,
    };
    u.sh = shortName(u);
    u.cmd = u.side === side && u.top === pf ? 1 : 0;
    const om = NAT[u.side].orgMax;
    u.org = u.side === 'GER' ? (o.arr ? 90 : om) : u.top === 'res' ? 58 : 45;
    if (u.t === 'gar') (u.org = om), (u.ent = 2);
    S.units.push(u);
  }
  for (const u of S.units) if (!u.arr) placeUnit(S, u, u.lon, u.lat);
  // стартовые окопы: советские войска у границы — в лагерях (0), резервы — 1, немцы — 0
  for (const u of S.units) if (u.side === 'SOV' && u.top === 'res' && u.t === 'inf') u.ent = 1;
  S.abil = side === 'GER' ? { blitz: { rdy: 0 }, stuka: { rdy: 0 } } : { boldin: { rdy: 1 }, exit: { rdy: 0 } };
  reindex(S);
  log(S, 'Начало войны. 22 июня 1941 года, 3:15 — артиллерийская подготовка по всей границе.', -1);
  return S;
}

// ——— журнал и события ———
export function log(S, txt, h = -1, k = 'info') {
  S.log.push({ d: S.day, ph: S.ph, txt, h, k });
  if (S.log.length > 400) S.log.splice(0, S.log.length - 400);
}
function ev(S, e) {
  e.d = S.day;
  e.ph = S.ph;
  S.ev.push(e);
}
export function takeEvents(S) {
  const e = S.ev;
  S.ev = [];
  return e;
}

// ——— бафы от решений и способностей ———
function buffs(S, u, key) {
  let v = key === 'mp' ? 0 : 1;
  for (const b of S.buf) {
    if (S.day < b.d0 || S.day > b.d1 || b.side !== u.side) continue;
    if (b.cmd && !u.cmd) continue;
    if (b.ally && u.cmd) continue;
    if (b.top && u.top !== b.top) continue;
    if (b.fm && u.fm !== b.fm) continue;
    if (b.mech && !TYPES[u.t].mech) continue;
    if (b.foot && TYPES[u.t].mech) continue;
    if (b.oos && !(u.oos > 0 || !supplied(S, u))) continue;
    if (key === 'mp' && b.mp) v += b.mp;
    if (key === 'atk' && b.atk) v *= b.atk;
  }
  return v;
}
export function activeBuffs(S, u) {
  return S.buf.filter((b) => S.day >= b.d0 && S.day <= b.d1 && b.side === u.side && (!b.cmd || u.cmd) && (!b.ally || !u.cmd) && (!b.top || u.top === b.top) && (!b.fm || u.fm === b.fm) && (!b.mech || TYPES[u.t].mech) && (!b.foot || !TYPES[u.t].mech));
}

// ——— движение ———
export function maxMP(S, u) {
  let m = TYPES[u.t].mp;
  if (!m) return 0;
  // немецкие танковые и моторизованные дивизии подвижнее советских мехкорпусов (поломки, нехватка горючего)
  if (u.side === 'GER' && TYPES[u.t].mech) m += 1;
  m += buffs(S, u, 'mp');
  if (u.fmch) m += TYPES[u.t].mech ? 1 : 2;
  if (u.oos > 0 && TYPES[u.t].mech) m = Math.ceil(m / 2);
  if (u.org < orgMax(u) * 0.1) m -= 1;
  return Math.max(1, m);
}
export function stepCost(S, u, a, b) {
  const t = S.M.terrain[b];
  if (t < 2) return 99;
  if (S.M.road(a, b)) return 1;
  return TERR[t].c[u.t] + (S.M.river(a, b) ? 1 : 0);
}
// противник рядом с гексом (истинный — для исполнения, known — маска видимости для подсказок игроку)
export function enemyAdj(S, h, side, known = null) {
  for (const j of S.M.nbr[h]) {
    const e = unitAt(S, j);
    if (e && e.side !== side && (!known || known[j])) return true;
  }
  return false;
}
export function enemyAdjCount(S, h, side) {
  let n = 0;
  for (const j of S.M.nbr[h]) {
    const e = unitAt(S, j);
    if (e && e.side !== side) n++;
  }
  return n;
}
// достижимые гексы: Map(hex → {left, prev}); known — маска видимых гексов (для игрока), иначе — полная информация
export function reach(S, u, known = null, mp = null) {
  const M = S.M, R = new Map(), budget = mp ?? u.mp, side = u.side;
  const noZoc = buffsFlag(S, u, 'nozoc');
  R.set(u.c, { left: budget, prev: -1 });
  if (budget <= 0) return R;
  const open = [u.c];
  while (open.length) {
    let bi = 0;
    for (let k = 1; k < open.length; k++) if (R.get(open[k]).left > R.get(open[bi]).left) bi = k;
    const h = open.splice(bi, 1)[0], cur = R.get(h);
    if (cur.left <= 0) continue;
    for (const j of M.nbr[h]) {
      if (!M.land(j)) continue;
      const e = unitAt(S, j);
      if (e && e.side !== side && (!known || known[j])) continue;
      const c = stepCost(S, u, h, j);
      // последний шаг можно сделать и при нехватке очков, если очков хотя бы половина (дивизия «дотягивается» до соседнего гекса)
      if (c > cur.left && !(cur.left === budget && c <= budget + 1 && c >= 2)) continue;
      let left = Math.max(0, cur.left - c);
      if (!noZoc && enemyAdj(S, j, side, known)) left = 0;
      const old = R.get(j);
      if (!old || old.left < left) {
        R.set(j, { left, prev: h });
        if (left > 0) open.push(j);
      }
    }
  }
  return R;
}
function buffsFlag(S, u, f) {
  return S.buf.some((b) => b[f] && S.day >= b.d0 && S.day <= b.d1 && b.side === u.side && (!b.cmd || u.cmd) && (!b.oos || u.oos > 0 || !supplied(S, u)));
}
export function pathTo(R, h) {
  const p = [];
  for (let c = h; c >= 0; c = R.get(c)?.prev ?? -1) p.unshift(c);
  return p;
}
// куда можно встать (свободные гексы из достижимых)
export function dests(S, u, R) {
  const out = [];
  for (const [h] of R) if (h !== u.c && S.at[h] < 0) out.push(h);
  return out;
}
function setOwner(S, h, side) {
  const o = OWN[side];
  if (S.owner[h] === o) return null;
  S.owner[h] = o;
  const ci = S.M.cityAt[h];
  if (ci >= 0) {
    const c = S.M.cities[ci];
    const first = !S.caps[c.name];
    S.caps[c.name] = { by: side, d: S.day, first: first ? 1 : S.caps[c.name].first };
    if (first || S.caps[c.name].by !== side) {}
    ev(S, { k: 'cap', side, h, city: c.name, vp: c.vp, w: 2 + c.vp });
    log(S, `${side === 'GER' ? 'Немцы взяли' : 'Красная армия отбила'} ${c.name}.`, h, 'cap');
    return c;
  }
  return null;
}
// занятие гекса и контроль соседних пустых гексов, не прикрытых противником
function claim(S, u, h) {
  setOwner(S, h, u.side);
  for (const j of S.M.nbr[h]) {
    if (!S.M.land(j) || S.owner[j] === OWN[u.side] || S.at[j] >= 0) continue;
    if (enemyAdj(S, j, u.side)) continue;
    setOwner(S, j, u.side);
  }
}
export function doMove(S, u, path) {
  const out = { id: u.id, path: [u.c], stop: null, from: u.c }, k = S.units.indexOf(u), nz = buffsFlag(S, u, 'nozoc');
  S.at[u.c] = -1;
  for (let i = 1; i < path.length; i++) {
    const h = path[i], e = unitAt(S, h);
    if (e && e.side !== u.side) {
      out.stop = 'blocked';
      break;
    }
    u.mp = Math.max(0, u.mp - stepCost(S, u, u.c, h));
    u.c = h;
    u.st = (u.st || 0) + 1;
    out.path.push(h);
    claim(S, u, h);
    if (!nz && enemyAdj(S, h, u.side)) {
      u.mp = 0;
      if (i < path.length - 1) out.stop = 'contact';
      break;
    }
  }
  // нельзя остановиться на гексе своей дивизии — откат к последнему свободному
  while (out.path.length > 1 && S.at[u.c] >= 0) {
    out.path.pop();
    u.c = out.path[out.path.length - 1];
  }
  S.at[u.c] = k;
  if (out.path.length > 1) (u.mv = 1), (u.ent = 0);
  if (out.stop) u.mp = 0;
  touch(S);
  return out;
}

// ——— бой ———
export function vis(S, side) {
  const k = 'vis' + side;
  if (S.cache[k]) return S.cache[k];
  const M = S.M, V = new Uint8Array(M.N), r = NAT[side].vis;
  for (const u of S.units) {
    if (!alive(u) || u.side !== side) continue;
    let q = [u.c];
    V[u.c] = 1;
    const seen = new Set(q);
    for (let d = 0; d < r; d++) {
      const nq = [];
      for (const h of q) for (const j of M.nbr[h]) if (!seen.has(j)) seen.add(j), (V[j] = 1), nq.push(j);
      q = nq;
    }
  }
  return (S.cache[k] = V);
}
const orgF = (u) => 0.5 + 0.5 * Math.max(0, Math.min(1, u.org / orgMax(u)));
const xpF = (u) => 1 + 0.06 * lvl(u.xp);
// сила: численность действует не линейно (остатки дивизии ещё держат фронт), качество сильнее влияет на атаку
export function power(u, k) {
  const qF = k === 'def' ? 0.5 + 0.5 * u.q : u.q;
  return TYPES[u.t][k] * (0.35 + 0.065 * u.str) * qF * orgF(u) * xpF(u);
}
function isPlayerSide(S, side) {
  return side === S.side;
}
export function fortK(S, d) {
  const ci = S.M.cityAt[d.c];
  if (ci < 0 || d.t !== 'gar') return 1;
  const k = FORT[S.M.cities[ci].name] || 1;
  return S.flags.karl ? 1 + (k - 1) * 0.4 : k;
}
// оценка боя: атакующий a (из гекса from) против дивизии d
export function combatVals(S, a, d, from = a.c) {
  const M = S.M, t = M.terrain[d.c], ma = [], md = [];
  let A = power(a, 'atk'), D = power(d, 'def');
  if (TYPES[a.t].mech && TERR[t].aa < 1) (A *= TERR[t].aa), ma.push(['Техника: ' + TERR[t].n, TERR[t].aa]);
  if (M.river(from, d.c)) (A *= 0.7), ma.push(['Через реку', 0.7]);
  if (S.day === 0 && a.side === 'GER' && d.t !== 'gar') (A *= 1.4), ma.push(['Внезапность', 1.4]);
  if (a.prep) (A *= 1.25), ma.push(['Артподготовка', 1.25]);
  if (d.hit === S.day) (A *= 1.15), ma.push(['После авиаудара', 1.15]);
  let n = 0;
  for (const j of M.nbr[d.c]) {
    const f = unitAt(S, j);
    if (f && f !== a && f.side === a.side && f.t !== 'gar' && f.org >= orgMax(f) * 0.2) n++;
  }
  n = Math.min(3, n);
  if (n) (A *= 1 + 0.1 * n), ma.push([`Поддержка соседей (${n})`, 1 + 0.1 * n]);
  if (a.oos > 0 && !supplied(S, a)) (A *= 0.75), ma.push(['Нет снабжения', 0.75]);
  const b = buffs(S, a, 'atk');
  if (b !== 1) (A *= b), ma.push(['Приказ', b]);
  const dk = isPlayerSide(S, a.side) ? DIFF_PL[S.diff] : DIFF_AI[S.diff];
  if (dk !== 1) (A *= dk), ma.push(['Сложность', dk]);
  if (TERR[t].def !== 1) (D *= TERR[t].def), md.push(['Оборона: ' + TERR[t].n, TERR[t].def]);
  if (d.ent) (D *= 1 + 0.2 * d.ent), md.push([`Окопы (${d.ent})`, 1 + 0.2 * d.ent]);
  const fk = fortK(S, d);
  if (fk !== 1) (D *= fk), md.push(['Крепость', fk]);
  if (d.oos > 1 && !supplied(S, d)) (D *= 0.8), md.push(['Нет снабжения', 0.8]);
  return { A, D, r: A / Math.max(0.05, D), ma, md, n };
}
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
export function forecast(S, a, d, from = a.c) {
  const v = combatVals(S, a, d, from), r = v.r;
  const pWin = clamp01((1.25 - 1 / r) / 0.5), pRout = clamp01((1.25 - 2.2 / r) / 0.5), pFail = clamp01((0.7 / r - 0.75) / 0.5);
  const pHold = 1 - pWin - pFail;
  const al = pFail * (r < 0.45 / 1.0 ? 2 : 1.3) + pHold * 1 + (pWin - pRout) * 0.5 + pRout * 0.2;
  const dl = pRout * 2.3 + (pWin - pRout) * 1.3 + pHold * 0.5;
  return { ...v, pWin, pRout, pFail, pHold, al, dl };
}
function lose(S, u, n) {
  n = Math.min(n, u.str);
  if (n <= 0) return 0;
  u.str -= n;
  const st = S.stats[u.side], k = n / u.str0;
  st.lost += n;
  st.men += Math.round(u.men * k);
  st.tk += Math.round(u.tk * k);
  return n;
}
function kill(S, u, sur, by) {
  const st = S.stats[u.side];
  if (sur) {
    const men = Math.round((u.men * u.str) / u.str0);
    st.pris += men;
    st.men += men;
    st.tk += Math.round((u.tk * u.str) / u.str0);
    u.sur = 1;
  } else u.dead = 1;
  st.div++;
  u.str = 0;
  S.at[u.c] = -1;
  if (by) by.kills++;
  ev(S, { k: sur ? 'sur' : 'kill', side: u.side, h: u.c, id: u.id, w: 3 + (u.cmd ? 3 : 0) + (TYPES[u.t].mech ? 1 : 0) });
  log(S, `${cap(u.sh)}: ${sur ? 'окружена и сдалась' : 'разгромлена'}.`, u.c, 'kill');
  touch(S);
}
const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);
// отход дивизии на n гексов; возвращает путь или null (отходить некуда)
function retreat(S, d, fromHex, n) {
  const M = S.M, sup = supplyMap(S, d.side), path = [d.c];
  let penalty = 0;
  for (let k = 0; k < n; k++) {
    let best = -1, bs = -1e9, bz = 0;
    for (const j of M.nbr[d.c]) {
      if (!M.land(j) || S.at[j] >= 0 || path.includes(j)) continue;
      const z = enemyAdj(S, j, d.side);
      let s = M.dist(j, fromHex) * 2 + (S.owner[j] === OWN[d.side] ? 3 : 0) + (sup[j] ? 2 : 0) + (z ? -5 : 0) + TERR[M.terrain[j]].def;
      if (s > bs) (bs = s), (best = j), (bz = z);
    }
    if (best < 0) return k ? { path, penalty } : null;
    S.at[d.c] = -1;
    d.c = best;
    S.at[best] = S.units.indexOf(d);
    path.push(best);
    setOwner(S, best, d.side);
    if (bz) {
      penalty++;
      break;
    }
  }
  return { path, penalty };
}
export function doAttack(S, a, dHex, from = a.c) {
  const d = unitAt(S, dHex);
  if (!d || d.side === a.side) return null;
  const v = combatVals(S, a, d, from), om = orgMax(d);
  const rr = v.r * (0.75 + 0.5 * rnd(S));
  let res = rr >= 2.2 ? 'rout' : rr >= 1 ? 'win' : rr >= 0.7 ? 'hold' : 'fail';
  if (res === 'hold' && d.org < om * 0.2) res = 'win';
  let dl = 0, al = 0, n = 0;
  // потери в шагах (сила 1–10): лобовые бои выматывают, но губят дивизии в основном котлы
  if (res === 'rout') (dl = rr >= 2.6 ? 2 : 1), (al = rnd(S) < 0.2 ? 1 : 0), (n = 2);
  else if (res === 'win') (dl = rnd(S) < 0.3 + (rr - 1) * 0.4 ? 1 : 0), (al = rnd(S) < 0.4 ? 1 : 0), (n = 1);
  else if (res === 'hold') (dl = rnd(S) < 0.25 ? 1 : 0), (al = 1);
  else al = rr < 0.45 ? 2 : 1;
  if (d.t === 'gar' && n) (n = 0), (dl = res === 'rout' ? dl + 1 : rnd(S) < 0.5 ? 1 : 0); // гарнизон не отступает
  const out = { a: a.id, d: d.id, dh: dHex, from, res, r: v.r, rr, al: 0, dl: 0, retreat: null, killed: 0, sur: 0, adv: null, side: a.side };
  d.org = Math.max(0, d.org - om * (0.12 + 0.1 * Math.min(rr, 2.5)) * (d.t === 'gar' ? 0.5 : 1));
  a.org = Math.max(0, a.org - orgMax(a) * (0.08 + 0.06 / Math.max(rr, 0.5)));
  out.al = lose(S, a, al);
  a.prep = 0;
  a.at++;
  a.fought = S.day;
  d.fought = S.day;
  d.ent = n ? 0 : Math.max(0, d.ent - (res === 'hold' ? 0 : 1));
  a.xp += res === 'fail' ? 0.5 : 1.2;
  d.xp += res === 'fail' || res === 'hold' ? 1 : 0.4;
  if (a.str <= 0) kill(S, a, 0, d);
  out.dl = lose(S, d, dl);
  if (d.str <= 0) {
    const cut = !supplied(S, d);
    kill(S, d, cut, a);
    out.killed = 1;
    out.sur = cut ? 1 : 0;
  } else if (n) {
    const rt = retreat(S, d, from, n);
    if (!rt) {
      // отходить некуда: окружённые сдаются, остальные теряют ещё шаг и держатся
      if (!supplied(S, d) || d.org < om * 0.15) {
        kill(S, d, 1, a);
        out.killed = 1;
        out.sur = 1;
      } else {
        out.dl += lose(S, d, 1);
        if (d.str <= 0) kill(S, d, !supplied(S, d), a), (out.killed = 1);
      }
    } else {
      out.retreat = rt.path;
      if (rt.penalty) out.dl += lose(S, d, rt.penalty);
      if (d.str <= 0) kill(S, d, !supplied(S, d), a), (out.killed = 1);
    }
  }
  // продвижение атакующего в освободившийся гекс
  if (!a.dead && S.at[dHex] < 0 && a.t !== 'gar') {
    const k = S.units.indexOf(a);
    if (a.c !== from) {}
    S.at[a.c] = -1;
    a.c = dHex;
    S.at[dHex] = k;
    a.mv = 1;
    a.ent = 0;
    claim(S, a, dHex);
    out.adv = dHex;
    a.mp = TYPES[a.t].mech || a.t === 'cav' ? Math.max(0, a.mp - 1) : 0;
    if (enemyAdj(S, dHex, a.side)) a.mp = 0;
  } else if (!a.dead) a.mp = TYPES[a.t].mech && res !== 'fail' ? Math.max(0, Math.min(a.mp, 1)) : 0;
  if (!a.dead && a.mp > 0 && enemyAdj(S, a.c, a.side) && !TYPES[a.t].mech) a.mp = 0;
  touch(S);
  const w = (d.cmd || a.cmd ? 2 : 0) + (out.killed ? 3 : res === 'rout' ? 2 : 1);
  ev(S, { k: 'combat', side: a.side, h: dHex, res, a: a.id, d: d.id, killed: out.killed, w });
  return out;
}
export function maxAtk(S, u) {
  return TYPES[u.t].mech && buffsFlag(S, u, 'blitz') ? 2 : 1;
}
// пехота атакует, только если прошла за фазу не больше одного гекса (танки, мотопехота и конница — после марша)
export const footSlow = (u) => !TYPES[u.t].mech && u.t !== 'cav';
export function canAttack(S, u) {
  return alive(u) && u.t !== 'gar' && u.at < maxAtk(S, u) && u.str > 0 && !(footSlow(u) && (u.st || 0) > 1);
}

// ——— авиация ———
export function doAir(S, side, h, stuka = false) {
  const d = unitAt(S, h);
  if (!d || d.side === side) return null;
  const t = S.M.terrain[h], open = t === 2 ? 1.2 : t === 7 ? 0.9 : 0.8;
  const p = (side === 'GER' ? 0.5 : 0.32) * open * (stuka ? 1.6 : 1) * (WEATHER[S.day]?.air ?? 1);
  const om = orgMax(d), gar = d.t === 'gar';
  d.org = Math.max(0, d.org - om * (gar ? 0.05 : 0.12 + 0.1 * rnd(S)));
  const out = { h, d: d.id, step: 0, side };
  if (!gar && rnd(S) < p) out.step = lose(S, d, 1);
  if (gar) {}
  else if (stuka) d.ent = 0;
  else d.ent = Math.max(0, d.ent - (rnd(S) < 0.5 ? 1 : 0));
  d.hit = S.day;
  if (d.str <= 0) kill(S, d, !supplied(S, d), null), (out.killed = 1);
  touch(S);
  return out;
}
export const airToday = (S, side) => Math.max(0, Math.round((side === 'GER' ? (S.day === 0 ? 4 : 3) : 1) * (WEATHER[S.day]?.air ?? 1)));

// ——— снабжение и котлы ———
function isSource(S, side, h) {
  const g = S.M.g, c = h % g.cols, r = (h / g.cols) | 0;
  if (side === 'GER') return c === 0 || (r === 0 && c <= 5) || (r === g.rows - 1 && c <= 6);
  return c === g.cols - 1 || (r === 0 && c >= 9) || (r === g.rows - 1 && c >= 10);
}
export function supplyMap(S, side) {
  const k = 'sup' + side;
  if (S.cache[k]) return S.cache[k];
  const M = S.M, sup = new Uint8Array(M.N), q = [];
  // гекс пропускает снабжение, если не занят противником и не в его зоне контроля; гекс в зоне контроля —
  // только если рядом (или на нём) стоит своя дивизия. Тонкий «след» танкового клина снабжение не режет:
  // котёл — это сомкнутое кольцо дивизий и их зон контроля
  const own = (h) => {
    const x = unitAt(S, h);
    if (x && x.side === side) return true;
    for (const j of M.nbr[h]) {
      const y = unitAt(S, j);
      if (y && y.side === side) return true;
    }
    return false;
  };
  const o = OWN[side];
  const passable = (h) => {
    if (!M.land(h)) return false;
    if (CFG.supOwn && S.owner[h] !== o) {
      if (CFG.supOwn === 1) return false;
      // чужой гекс без войск противника рядом проходим, если он — тонкий «след» (не меньше 2 своих соседей)
      if (enemyAdj(S, h, side)) return false;
      let n = 0;
      for (const j of M.nbr[h]) if (S.owner[j] === o) n++;
      if (n < 2) return false;
    }
    const u = unitAt(S, h);
    if (u && u.side !== side) return false;
    if (u && u.side === side) return true;
    return !enemyAdj(S, h, side) || own(h);
  };
  for (let h = 0; h < M.N; h++) if (isSource(S, side, h) && passable(h)) (sup[h] = 1), q.push(h);
  while (q.length) {
    const h = q.pop();
    for (const j of M.nbr[h]) if (!sup[j] && passable(j)) (sup[j] = 1), q.push(j);
  }
  return (S.cache[k] = sup);
}
export const supplied = (S, u) => !!supplyMap(S, u.side)[u.c];
// котлы стороны: связные области своих гексов без снабжения, где стоят свои дивизии
export function pockets(S, side) {
  const k = 'pk' + side;
  if (S.cache[k]) return S.cache[k];
  const M = S.M, o = OWN[side], sup = supplyMap(S, side), seen = new Uint8Array(M.N), out = [];
  for (const u of S.units) {
    if (!alive(u) || u.side !== side || sup[u.c] || seen[u.c]) continue;
    const hexes = [], units = [], q = [u.c];
    seen[u.c] = 1;
    while (q.length) {
      const h = q.pop();
      hexes.push(h);
      const x = unitAt(S, h);
      if (x && x.side === side) units.push(x.id);
      for (const j of M.nbr[h]) if (!seen[j] && M.land(j) && S.owner[j] === o && !sup[j]) (seen[j] = 1), q.push(j);
    }
    // центр и название — по ближайшему городу
    let sx = 0, sy = 0;
    for (const h of hexes) {
      const [x, y] = M.xy(h);
      sx += x;
      sy += y;
    }
    sx /= hexes.length;
    sy /= hexes.length;
    let best = null, bd = 1e9;
    for (const c of M.cities) {
      const [x, y] = M.xy(c.hex), dd = (x - sx) ** 2 + (y - sy) ** 2 - c.vp * 260;
      if (dd < bd) (bd = dd), (best = c);
    }
    out.push({ side, hexes, units, name: best ? best.name : '', ch: best ? best.hex : u.c });
  }
  out.sort((a, b) => b.units.length - a.units.length);
  return (S.cache[k] = out);
}
const POCKET_GEN = { Белосток: 'Белостока', Гродно: 'Гродно', Волковыск: 'Волковыска', Слоним: 'Слонима', Новогрудок: 'Новогрудка', Лида: 'Лиды', Минск: 'Минска', Барановичи: 'Барановичей', Брест: 'Бреста', Мосты: 'Мостов', Зельва: 'Зельвы', Бельск: 'Бельска', Пружаны: 'Пружан', Кобрин: 'Кобрина', Ломжа: 'Ломжи', Августов: 'Августова', Столбцы: 'Столбцов', Дзержинск: 'Дзержинска', Слуцк: 'Слуцка', Вильнюс: 'Вильнюса', Молодечно: 'Молодечно', Ошмяны: 'Ошмян', Пинск: 'Пинска', Бобруйск: 'Бобруйска', Борисов: 'Борисова', Алитус: 'Алитуса', Каунас: 'Каунаса', Лунинец: 'Лунинца', Осиповичи: 'Осиповичей', Березино: 'Березино', Глуск: 'Глуска', Сувалки: 'Сувалок', Остроленка: 'Остроленки', 'Бяла-Подляска': 'Бялы-Подляски' };
export const pocketName = (p) => `Котёл у ${POCKET_GEN[p.name] || p.name}`;
// отрезанные советские дивизии (для цели «Котёл»): уничтожены/сдались + сейчас без снабжения
export function cutCount(S) {
  let n = 0;
  const sup = supplyMap(S, 'SOV');
  for (const u of S.units) if (u.side === 'SOV' && u.t !== 'gar' && (u.dead || u.sur || (alive(u) && !sup[u.c]))) n++;
  return n;
}
// подчистка территории: области без своих дивизий и без связи с краем своей стороны переходят противнику
function sweep(S) {
  const M = S.M;
  for (const side of ['GER', 'SOV']) {
    const o = OWN[side], seen = new Uint8Array(M.N);
    for (let h0 = 0; h0 < M.N; h0++) {
      if (seen[h0] || S.owner[h0] !== o || !M.land(h0)) continue;
      const comp = [], q = [h0];
      seen[h0] = 1;
      let live = false;
      while (q.length) {
        const h = q.pop();
        comp.push(h);
        const u = unitAt(S, h);
        if ((u && u.side === side) || isSource(S, side, h)) live = true;
        for (const j of M.nbr[h]) if (!seen[j] && S.owner[j] === o && M.land(j)) (seen[j] = 1), q.push(j);
      }
      if (!live) for (const h of comp) setOwner(S, h, other(side));
    }
  }
  touch(S);
}

// ——— фазы и дни ———
export const isPlayerPhase = (S) => S.ph === S.side;
export function beginPhase(S, side) {
  S.ph = side;
  S.step = 'ally';
  // подкрепления
  for (const u of S.units) {
    if (u.side !== side || !u.arr || u.c >= 0 || u.dead || u.sur || u.arr > S.day) continue;
    if (placeUnit(S, u, u.lon, u.lat)) {
      reindex(S);
      ev(S, { k: 'arr', side, h: u.c, id: u.id, w: u.cmd ? 3 : 1 });
      log(S, `Прибыла ${u.name}.`, u.c, 'arr');
    }
  }
  const sup = supplyMap(S, side), om = NAT[side].orgMax;
  for (const u of S.units) {
    if (!alive(u) || u.side !== side) continue;
    const rested = u.fought < S.day - 1 && !u.mv && !enemyAdj(S, u.c, side);
    if (!sup[u.c]) {
      u.oos++;
      const grace = u.t === 'gar' ? 5 : 1;
      if (u.oos > grace) u.org = Math.max(0, u.org - om * 0.1);
      if (u.oos > grace + 1 && rnd(S) < (side === 'SOV' ? 0.5 : 0.35)) {
        lose(S, u, 1);
        if (u.str <= 0) kill(S, u, 1, null);
      }
    } else {
      u.oos = 0;
      u.org = Math.min(om, u.org + om * (rested ? 0.3 : 0.18));
      if (rested && u.str < u.str0 && rnd(S) < 0.6) u.str++;
    }
    u.mv = 0;
    u.st = 0;
    u.at = 0;
    u.prep = 0;
    u.fmch = 0;
    u.from = u.c;
  }
  for (const u of S.units) if (alive(u) && u.side === side) u.mp = maxMP(S, u);
  if (side === S.side) {
    S.cp = NAT[side].cp + (side === 'SOV' && S.day === 0 ? -1 : 0) + (S.trust >= 8 ? 1 : S.trust <= 2 ? -1 : 0) - (S.flags.cpPen === S.day ? 1 : 0);
    S.cp = Math.max(1, S.cp);
    S.air = airToday(S, side);
  } else S.airAI = airToday(S, side);
  S.airAlly = side === S.side ? (side === 'GER' ? 2 : 0) : 0;
  touch(S);
}
export function endPhase(S, side) {
  const M = S.M;
  for (const u of S.units) {
    if (!alive(u) || u.side !== side) continue;
    if (!u.mv) {
      const ci = M.cityAt[u.c], ur = side === 'SOV' && ci >= 0 && UR.includes(M.cities[ci].name);
      const capE = ur ? 3 : 2;
      u.ent = Math.min(capE, u.ent + 1);
    }
  }
  sweep(S);
  // новые котлы
  const before = S.pk[other(side)] || [];
  const now = pockets(S, other(side));
  for (const p of now) {
    if (p.units.length < 2) continue;
    const old = before.find((b) => b.units.some((id) => p.units.includes(id)));
    if (!old || p.units.length >= old.n + 3) {
      ev(S, { k: 'pocket', side: other(side), h: p.ch, n: p.units.length, name: p.name, w: 5 + p.units.length });
      log(S, `${pocketName(p)}: окружено дивизий — ${p.units.length}.`, p.ch, 'pocket');
    }
  }
  S.pk[other(side)] = now.map((p) => ({ units: p.units.slice(), n: p.units.length, name: p.name }));
  S.pk[side] = pockets(S, side).map((p) => ({ units: p.units.slice(), n: p.units.length, name: p.name }));
  S.step = 'done';
  touch(S);
}
export function endDay(S) {
  evalGoals(S, false);
  if (S.day >= DAYS - 1 || armyGone(S)) return finish(S);
  S.day++;
  S.ph = 'GER';
  S.step = 'new';
}
function armyGone(S) {
  return S.side === 'SOV' && !S.units.some((u) => u.cmd && alive(u));
}

// ——— приказы (очки командования) ———
export const CP_COST = { prep: 1, march: 1, refit: 1, air: 1 };
export function canPrep(S, u) {
  return u.cmd && alive(u) && S.cp >= 1 && !u.prep && canAttack(S, u) && enemyAdj(S, u.c, u.side, vis(S, u.side));
}
export function canMarch(S, u) {
  return u.cmd && alive(u) && S.cp >= 1 && !u.fmch && !u.mv && !u.at && u.t !== 'gar' && !enemyAdj(S, u.c, u.side);
}
export function canRefit(S, u) {
  return u.cmd && alive(u) && S.cp >= 1 && u.str < 10 && supplied(S, u) && !u.at;
}
export function doPrep(S, u) {
  S.cp--;
  u.prep = 1;
  touch(S);
}
export function doMarch(S, u) {
  S.cp--;
  u.fmch = 1;
  u.org = Math.max(0, u.org - orgMax(u) * 0.1);
  const before = u.mp;
  u.mp = maxMP(S, u);
  u.mp = Math.max(before, u.mp);
  touch(S);
}
export function doRefit(S, u) {
  S.cp--;
  const n = enemyAdj(S, u.c, u.side) ? 1 : 2;
  u.str = Math.min(10, u.str + n);
  u.org = Math.max(0, u.org - orgMax(u) * 0.05);
  u.mp = 0;
  u.mv = 1;
  touch(S);
  return n;
}
export function airTargets(S, side) {
  const V = vis(S, side), out = new Set();
  for (const u of S.units) if (alive(u) && u.side !== side && V[u.c]) out.add(u.c);
  return out;
}

// ——— способности генералов ———
export function abilReady(S, k) {
  const a = S.abil[k], A = ABIL[k];
  if (!a || !A) return false;
  if (A.until != null && S.day >= A.until) return false;
  if (k === 'boldin' && S.dec.dir3 === 'wd') return false;
  return S.day >= a.rdy && !a.used;
}
export function useAbil(S, k) {
  const A = ABIL[k], a = S.abil[k];
  a.rdy = S.day + A.cd;
  S.flags['ab_' + k] = S.day;
  const d = S.day;
  if (k === 'blitz') S.buf.push({ side: S.side, cmd: 1, mech: 1, d0: d, d1: d, mp: 1, blitz: 1, src: k });
  if (k === 'stuka') (S.air += 3), (S.flags.stuka = d);
  if (k === 'boldin') S.buf.push({ side: S.side, fm: 'mk6', d0: d, d1: d, mp: 1, atk: 1.4, src: k }), (a.used = 1);
  if (k === 'exit') S.buf.push({ side: S.side, cmd: 1, oos: 1, d0: d, d1: d, mp: 2, nozoc: 1, src: k });
  // пересчитать ходы
  for (const u of S.units) if (alive(u) && u.side === S.side && u.cmd) {
    const m = maxMP(S, u), base = u.mv || u.at ? u.mp : m;
    if (!u.mv && !u.at) u.mp = m;
    else if (k === 'blitz' && TYPES[u.t].mech) u.mp = base + 1;
    else if (k === 'exit' && (u.oos > 0 || !supplied(S, u))) (u.mp = base + 2), (u.org = Math.max(0, u.org - orgMax(u) * 0.1));
  }
  if (k === 'exit') for (const u of S.units) if (alive(u) && u.cmd && (u.oos > 0 || !supplied(S, u)) && !u.mv) u.org = Math.max(0, u.org - orgMax(u) * 0.1);
  log(S, `Способность «${A.n}».`, -1, 'abil');
  touch(S);
}

// ——— решения ———
export function pendingDecision(S, side = S.side) {
  return DECISIONS.find((x) => x.side === side && x.day === S.day && !S.dec[x.id]) || null;
}
export function decide(S, id, k) {
  const D = DECISIONS.find((x) => x.id === id);
  if (!D || S.dec[id]) return;
  S.dec[id] = k;
  const d = S.day, pl = D.side === S.side;
  const tr = (v) => pl && (S.trust = Math.max(0, Math.min(10, S.trust + v)));
  if (id === 'dir3') {
    if (k === 'atk') tr(2), (S.flags.counter = 1);
    else tr(-2), S.buf.push({ side: 'SOV', cmd: 1, foot: 1, d0: 1, d1: 1, mp: 1, src: id }), (S.flags.wdEarly = 1);
  }
  if (id === 'kref' && k === 'karl') (S.flags.karl = 1), pl && (S.flags.cpPen = d), pl && S.ph === S.side && (S.cp = Math.max(0, S.cp - 1));
  if (id === 'ring') {
    if (k === 'close') tr(1), S.buf.push({ side: 'GER', top: 'a4', foot: 1, d0: d + 1, d1: d + 2, mp: 1, src: id });
    else tr(-1), pl && S.abil.blitz && (S.abil.blitz.rdy = d), S.buf.push({ side: 'GER', cmd: 1, mech: 1, d0: d + 1, d1: d + 1, mp: 1, src: id });
  }
  if (id === 'wd25') {
    if (k === 'night') {
      S.buf.push({ side: 'SOV', cmd: 1, foot: 1, d0: d + 1, d1: d + 2, mp: 1, src: id });
      for (const u of S.units) if (alive(u) && u.cmd && u.side === 'SOV') u.org = Math.max(0, u.org - 7);
    } else S.buf.push({ side: 'SOV', cmd: 1, mech: 1, d0: d + 1, d1: d + 1, atk: 1.4, src: id });
  }
  const o = D.opts.find((x) => x.k === k);
  log(S, `Решение «${D.title}»: ${o ? o.n : k}.`, -1, 'dec');
  touch(S);
}
// решения стороны ИИ — как в истории
export function aiDecisions(S, side) {
  const H = { dir3: 'atk', kref: 'karl', ring: 'close', wd25: 'road' };
  for (const D of DECISIONS) if (D.side === side && D.day === S.day && !S.dec[D.id]) decide(S, D.id, H[D.id]);
}

// ——— цели и итоги ———
export function goalList(S, side = S.side) {
  const M = S.M, out = [];
  for (const g of GOALS[side]) {
    const need = Array.isArray(g.need) ? g.need[S.diff] ?? g.need[1] : g.need;
    const o = { ...g, need, t: g.t.replace('{n}', need), val: 0, done: 0, fail: 0, prog: '' };
    if (g.k === 'pocket') {
      o.val = cutCount(S);
      o.prog = `${o.val}/${need}`;
      o.ok = o.val >= need;
    } else if (g.k === 'take') {
      const c = S.caps[g.city], h = M.cityHex(g.city);
      const own = S.owner[h] === OWN[side];
      if (c && c.by === side && c.first !== undefined && c.d <= g.by && own) o.done = 1;
      else if (own && S.day <= g.by) o.done = 1;
      if (!o.done && S.day > g.by) o.fail = 1;
      if (S.goals[g.id] === 1) (o.done = 1), (o.fail = 0);
      if (S.goals[g.id] === -1) (o.fail = 1), (o.done = 0);
      o.prog = o.done ? 'взят' : o.fail ? 'не успели' : `до ${28 + (g.by - 6)} июня`;
      o.ok = o.done;
    } else if (g.k === 'hold') {
      const h = M.cityHex(g.city), lost = S.owner[h] !== OWN[side];
      if (S.goals[g.id] === -1 || (lost && S.day <= g.by)) o.fail = 1;
      else if (S.goals[g.id] === 1) o.done = 1;
      o.prog = o.fail ? 'потерян' : o.done ? 'удержан' : `до ${28 + (g.by - 6)} июня`;
      o.ok = !o.fail;
    } else if (g.k === 'save') {
      const sup = supplyMap(S, side);
      const L = S.units.filter((u) => u.side === side && alive(u) && (g.fm ? u.top === g.fm : u.fm === g.grp));
      o.val = L.filter((u) => sup[u.c]).length;
      o.prog = `${o.val} (≥${need})`;
      o.ok = o.val >= need;
    }
    out.push(o);
  }
  return out;
}
// фиксировать сроковые цели в конце дня
function evalGoals(S) {
  for (const side of ['GER', 'SOV']) {
    for (const g of GOALS[side]) {
      if (S.goals[g.id]) continue;
      const h = S.M.cityHex(g.city);
      if (g.k === 'take') {
        if (S.owner[h] === OWN[side]) S.goals[g.id] = 1;
        else if (S.day >= g.by) S.goals[g.id] = -1;
      } else if (g.k === 'hold') {
        if (S.owner[h] !== OWN[side]) S.goals[g.id] = -1;
        else if (S.day >= g.by) S.goals[g.id] = 1;
      }
    }
  }
}
// «Часы Барбароссы»: среднее опережение (+) / отставание (−) немцев от исторического графика, дни
export function clock(S) {
  let s = 0, n = 0;
  for (const c of CLOCK) {
    const h = HIST[c];
    if (h == null) continue;
    const cp = S.caps[c];
    const took = cp && cp.by === 'GER' ? cp.d : null;
    if (took != null) (s += h - took), n++;
    else if (S.day > h || S.over) (s += h - Math.max(S.day + 1, h + 1)), n++;
  }
  return n ? s / n : 0;
}
export function finish(S) {
  evalGoals(S);
  const G = goalList(S, S.side);
  const main = G.find((g) => g.main);
  const win = main.ok && !main.fail;
  let stars = win ? 1 : 0;
  if (win) for (const g of G) if (!g.main && g.ok && !g.fail) stars++;
  const ck = clock(S);
  S.over = { win: win ? 1 : 0, stars, clock: Math.round(ck * 10) / 10, goals: G.map((g) => ({ id: g.id, ok: g.ok && !g.fail ? 1 : 0, prog: g.prog })) };
  S.step = 'over';
  log(S, win ? 'Глава завершена: задача выполнена.' : 'Глава завершена: задача не выполнена.', -1, 'end');
  return S.over;
}

// ——— снимок для «Отменить» и сохранение ———
export function snap(S) {
  return JSON.stringify({ u: S.units, o: Array.from(S.owner), cp: S.cp, air: S.air, caps: S.caps, st: S.stats, fl: S.flags, nl: S.log.length, ne: S.ev.length, rs: S.rs });
}
export function restore(S, s) {
  const o = JSON.parse(s);
  S.units = o.u;
  S.owner = Uint8Array.from(o.o);
  S.cp = o.cp;
  S.air = o.air;
  S.caps = o.caps;
  S.stats = o.st;
  S.flags = o.fl;
  S.log.length = Math.min(S.log.length, o.nl);
  S.ev.length = Math.min(S.ev.length, o.ne);
  S.rs = o.rs;
  reindex(S);
}
export function save(S) {
  const o = {};
  for (const k of Object.keys(S)) o[k] = S[k];
  o.owner = Array.from(S.owner).join('');
  o.ev = [];
  return JSON.stringify(o);
}
export function load(J, str) {
  const o = JSON.parse(str);
  if (!o || o.v !== 1) throw new Error('несовместимое сохранение');
  const M = decodeMap(J);
  o.owner = Uint8Array.from(o.owner.split('').map(Number));
  attach(o, M);
  return o;
}
export { DAYS, FORMS, GOALS, ABIL, DECISIONS, PLAYER };
