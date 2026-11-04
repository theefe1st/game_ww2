// «Мировой фронт» v0.10, «Восточный фронт 1941–1945»: движок. Ход — неделя: сначала фаза Оси, затем СССР.
// Области (map.json) вместо гексов: в области — до cap дивизий стороны. Бой — по области: атакующие из соседних
// областей против обороняющихся; итог — потери, отход или разгром (если отходить некуда — плен), захват области.
// Снабжение — от тыловых источников по своим областям (железные дороги Ось перешивает за собой), без снабжения —
// потери и сдача «котлов». Хозяйство: ⚙ производство (заводы областей + тыл + ленд-лиз), 👥 люди; пополнение,
// новые дивизии, постройки (завод, укрепления, аэродром), эвакуация заводов СССР.
import { TYPES, TER, WX, SIDE0, NAT_N, DIFF, LAST_TURN, quality, tankQ, weatherOf, winter41, rnd, other, yearF, lerpT, turnOf, fmtTurn, divW, isMech } from './rules.js';
import { ALLG } from '../war/gens41.js';

export const SAVE_KEY = 'wf_east_v1';
export const VER = 1;
export const ZN = 5;
// ——— справочные ———
export const natOf = (S, r) => S.M.nats[S.own[r]] || '';
export const sideOf = (S, r) => SIDE0[S.M.nats[S.own[r]]] || null;
export const cap = (S, r) => Math.max(8, Math.min(16, Math.round(Math.sqrt(S.M.reg[r].a) / 9)));
export const alive = (u) => u.r >= 0 && !u.dead;
export function reindex(S) {
  const at = (S.at = Array.from({ length: S.M.R }, () => []));
  for (const u of S.units) if (alive(u)) at[u.r].push(u);
  return at;
}
export const unitsAt = (S, r) => S.at[r];
export const sideUnits = (S, r, side) => S.at[r].filter((u) => u.s === side);
export const enemyAt = (S, r, side) => S.at[r].length > 0 && S.at[r][0].s !== side;
export const hasFlag = (S, r, f) => S.M.reg[r].f.includes(f);
export const regByName = (S, n) => { S.M.byName ??= new Map(S.M.reg.map((g) => [g.n, g.id])); return S.M.byName.get(n) ?? -1; };
// сосед области противника (линия фронта)
export function isFront(S, r, side = sideOf(S, r)) {
  for (const e of S.M.reg[r].nb) { const s2 = sideOf(S, e.r); if (s2 && s2 !== side) return true; }
  return false;
}
export function note(S, o) {
  S.log.push({ t: S.turn, ...o });
  if (S.log.length > 160) S.log.splice(0, S.log.length - 160);
  S.news?.push(o);
}
export function addMor(S, side, dv) { S.mor[side] = Math.max(0, Math.min(100, S.mor[side] + dv)); }
// ——— генералы ———
export const genOf = (S, side, z) => ALLG[S.gen[side][z]] || null;
export const hasTr = (g, t) => !!g && g.tr.includes(t);
function genMod(S, side, z, kind, u, ter) {
  const g = genOf(S, side, z);
  if (!g) return 1;
  let m = 1 + (g.sk - 2.5) * 0.035;
  if (kind === 'att') { if (hasTr(g, 'atk')) m += 0.1; if (hasTr(g, 'tank') && isMech(u)) m += 0.14; }
  else if (hasTr(g, 'def')) m += 0.1;
  if (hasTr(g, 'mtn') && (ter === 'for' || ter === 'mar' || ter === 'mnt' || ter === 'hil')) m += 0.12;
  if (hasTr(g, 'cav') && u.t === 'cav') m += 0.2;
  return m;
}
// ——— сила дивизии ———
export const qualOf = (S, u) => quality(u.nat, S.turn) * (isMech(u) ? tankQ(u.s, S.turn) : 1) * (u.gd ? 1.12 : 1);
const diffMod = (S, side) => (side === S.side ? DIFF[S.diff].pl : DIFF[S.diff].ai);
const morMod = (S, side) => 0.9 + (0.2 * S.mor[side]) / 100;
const supF = (S, u) => { const s = S.sup[u.s][u.r]; return s <= 0 ? 0.5 : 0.72 + 0.28 * Math.min(1, s); };
export function baseCV(S, u, kind) {
  const T = TYPES[u.t];
  return (kind === 'att' ? T.att : T.def) * qualOf(S, u) * (u.str / 100) * (0.42 + (0.58 * u.rdy) / 100) * (1 + u.xp / 260) * diffMod(S, u.s) * morMod(S, u.s) * supF(S, u);
}
export function wxOf(S, r) { return WX[S.wx[S.M.reg[r].z]]; }
const frozen = (S, r) => !!wxOf(S, r).frozen;
export function attCV(S, u, T, from = u.r) {
  const g = S.M.reg[T], ter = g.t, w = wxOf(S, T);
  let v = baseCV(S, u, 'att');
  if (isMech(u)) v *= TER[ter].mech;
  if (u.t === 'mtn' && (ter === 'mnt' || ter === 'hil')) v *= 1.3;
  const e = S.M.edge.get(from * 4096 + T);
  if (e && !frozen(S, T)) v *= e.riv === 2 ? 0.68 : e.riv === 1 ? 0.86 : 1;
  if (e?.sp === 'sea') v *= 0.55;
  v *= w.atk;
  if (u.s === 'GER' && u.nat === 'GER' && winter41(S.turn) && S.wx[g.z] !== 'dry') v *= S.flags.winterGear ? 0.85 : 0.62;
  v *= genMod(S, u.s, S.M.reg[from].z, 'att', u, ter);
  return v;
}
export function defCV(S, u) {
  const g = S.M.reg[u.r], ter = g.t;
  let v = baseCV(S, u, 'def') * TER[ter].def;
  if (u.t === 'mtn' && (ter === 'mnt' || ter === 'hil')) v *= 1.25;
  if (ter === 'mar' && frozen(S, u.r)) v /= 1.25;
  v *= 1 + 0.22 * S.fort[u.r];
  if (g.vp >= 5) v *= 1.2; else if (g.vp >= 2) v *= 1.08;
  if (g.f.includes('f')) v *= 1.3;
  v *= 1 + 0.07 * u.ent;
  if (u.s === 'GER' && u.nat === 'GER' && winter41(S.turn) && S.wx[g.z] !== 'dry') v *= S.flags.winterGear ? 0.92 : 0.8;
  v *= genMod(S, u.s, g.z, 'def', u, ter);
  return v;
}
export const regionDef = (S, r) => S.at[r].reduce((s, u) => s + defCV(S, u), 0);
export const regionAtt = (S, r) => S.at[r].reduce((s, u) => s + baseCV(S, u, 'att'), 0);
// ——— авиация по направлениям ———
export function airAlloc(S, side) {
  const w = new Array(ZN).fill(0.2);
  for (let r = 0; r < S.M.R; r++) if (sideOf(S, r) === side && isFront(S, r, side)) w[S.M.reg[r].z] += 1;
  for (let z = 0; z < ZN; z++) { if (S.post[side][z] === 'atk') w[z] *= 1.6; if (S.airF[side] === z) w[z] *= 2.6; }
  const tot = w.reduce((a, b) => a + b, 0) || 1, afd = new Array(ZN).fill(0);
  for (let r = 0; r < S.M.R; r++) if (S.afd[r] && sideOf(S, r) === side) afd[S.M.reg[r].z]++;
  return w.map((x, z) => ((S.air[side] * x) / tot) * (1 + 0.1 * Math.min(4, afd[z])));
}
export function airRatio(S, side, z) {
  const a = S.airA?.[side]?.[z] ?? 0, b = S.airA?.[other(side)]?.[z] ?? 0;
  return a / (a + b + 1);
}
// ——— снабжение ———
function isSource(S, r, side) {
  const g = S.M.reg[r];
  if (sideOf(S, r) !== side) return false;
  const o0 = SIDE0[S.M.nats[S.own0[r]]];
  if (side === 'SOV') return o0 === 'SOV' && (g.f.includes('e') || g.x >= 2350 || g.y >= 3000 || g.f.includes('L'));
  return o0 === 'GER' && (S.bd0[r] >= 2 || g.f.includes('c'));
}
export function computeSupply(S, side) {
  const M = S.M, R = M.R, d = new Float32Array(R).fill(99), q = [];
  for (let r = 0; r < R; r++) if (isSource(S, r, side)) (d[r] = 0), q.push(r);
  // 0-1 BFS: по своим областям с железной дорогой — 0, иначе — 1
  const dq = [...q];
  let head = 0;
  const front = [];
  while (head < dq.length) {
    const r = dq[head++];
    for (const e of M.reg[r].nb) {
      const b = e.r;
      if (sideOf(S, b) !== side || (e.sp === 'sea' && !frozen(S, b))) continue;
      const c = d[r] + (S.rail[b] ? 0 : 1) + (e.sp === 'ice' ? 1 : 0);
      if (c < d[b]) { d[b] = c; S.rail[b] ? dq.splice(head, 0, b) : dq.push(b); }
    }
    front.length;
  }
  const sup = S.sup[side] || (S.sup[side] = new Float32Array(R));
  for (let r = 0; r < R; r++) {
    if (sideOf(S, r) !== side) { sup[r] = 0; continue; }
    const g = genOf(S, side, M.reg[r].z), k = d[r] - (hasTr(g, 'log') ? 1 : 0);
    sup[r] = k >= 90 ? 0 : k <= 1 ? 1 : k <= 2 ? 0.85 : k <= 3 ? 0.66 : k <= 4 ? 0.5 : 0.36;
  }
  // порты и крепости в окружении — частичное снабжение (морем, складами)
  for (let r = 0; r < R; r++) {
    if (sup[r] > 0 || sideOf(S, r) !== side) continue;
    const g = M.reg[r];
    if (g.f.includes('p') || g.f.includes('f')) {
      sup[r] = 0.5;
      for (const e of g.nb) if (sideOf(S, e.r) === side && sup[e.r] <= 0) sup[e.r] = 0.3;
    }
  }
  S.supD ??= {}; S.supD[side] = d;
  return sup;
}
// ——— движение ———
export function stepCost(S, u, a, b) {
  const g = S.M.reg[b], e = S.M.edge.get(a * 4096 + b), w = wxOf(S, b);
  let c = TER[g.t].mv;
  if (u.t === 'mtn' && (g.t === 'mnt' || g.t === 'hil')) c = 1.1;
  if (g.t === 'mar' && frozen(S, b)) c = 1.1;
  if (e && !frozen(S, b)) c += e.riv === 2 ? 0.5 : e.riv === 1 ? 0.2 : 0;
  if (e?.sp === 'sea') c += 1.5;
  c *= isMech(u) ? w.mv * (w.mv > 1.5 ? 1.15 : 1) : 1 + (w.mv - 1) * 0.75;
  if (e?.rail && sideOf(S, b) === u.s && S.rail[b]) c *= 0.8;
  return c;
}
export const mpOf = (S, u) => TYPES[u.t].mp * (S.sup[u.s][u.r] > 0 ? 1 : 0.6);
// области, куда дивизия может дойти за оставшиеся очки (по своим областям; во вражескую пустую — только последним шагом)
export function reach(S, u, mp = u.mp) {
  const M = S.M, best = new Map([[u.r, 0]]), prev = new Map(), q = [[u.r, 0]];
  while (q.length) {
    q.sort((a, b) => a[1] - b[1]);
    const [r, c] = q.shift();
    if (c > best.get(r)) continue;
    if (r !== u.r && sideOf(S, r) !== u.s) continue; // захват — конец пути
    for (const e of M.reg[r].nb) {
      const b = e.r, sb = sideOf(S, b);
      if (!sb) continue;
      if (sb !== u.s && S.at[b].length) continue; // в занятую противником — только атакой
      if (e.sp === 'sea' && !frozen(S, b) && sb !== u.s) continue;
      // нельзя проскочить мимо противника: из области у фронта во вражескую пустую — только подвижным
      const nc = c + stepCost(S, u, r, b) + (sb !== u.s ? 0.4 : 0);
      if (nc > mp + 1e-6 && !(r === u.r && c === 0 && nc <= mp + 0.9 && u.mp >= TYPES[u.t].mp - 0.01)) continue;
      if (nc < (best.get(b) ?? Infinity)) { best.set(b, nc); prev.set(b, r); q.push([b, nc]); }
    }
  }
  return { best, prev };
}
export function pathTo(R, b) { const p = []; for (let r = b; r !== undefined; r = R.prev.get(r)) p.unshift(r); return p; }
export const room = (S, r, side) => cap(S, r) - S.at[r].filter((u) => u.s === side).length;
export function moveUnit(S, u, r, cost) {
  if (u.r === r) return;
  const from = u.r;
  S.at[from].splice(S.at[from].indexOf(u), 1);
  u.r = r; S.at[r].push(u);
  u.mp = Math.max(0, u.mp - cost);
  u.ent = 0; u.mv = 1;
  if (sideOf(S, r) !== u.s) capture(S, r, u.s, u.nat);
}
// перемещение по пути reach (с захватом пустых областей противника)
export function moveTo(S, u, b, R = reach(S, u)) {
  if (!R.best.has(b) || b === u.r) return false;
  if (room(S, b, u.s) <= 0 && sideOf(S, b) === u.s) return false;
  const path = pathTo(R, b);
  for (let i = 1; i < path.length; i++) {
    const c = stepCost(S, u, path[i - 1], path[i]) + (sideOf(S, path[i]) !== u.s ? 0.4 : 0);
    moveUnit(S, u, path[i], c);
    if (S.at[path[i]].some((v) => v.s !== u.s)) break;
  }
  if (S.at[u.r].length && sideOf(S, u.r) !== u.s) return true;
  return true;
}
// переброска по железной дороге (тыловые дивизии, не у фронта, по своей сети)
export function railTargets(S, u) {
  if (u.mv || isFront(S, u.r, u.s) || !S.rail[u.r] || S.sup[u.s][u.r] < 0.6) return [];
  const out = [], seen = new Set([u.r]), q = [u.r];
  while (q.length) {
    const r = q.shift();
    for (const e of S.M.reg[r].nb) {
      const b = e.r;
      if (seen.has(b) || sideOf(S, b) !== u.s || !S.rail[b]) continue;
      seen.add(b); out.push(b);
      if (!isFront(S, b, u.s)) q.push(b);
    }
  }
  return out;
}
export function railMove(S, u, b) {
  if (S.railCap[u.s] <= 0 || room(S, b, u.s) <= 0) return false;
  S.railCap[u.s]--;
  const from = u.r;
  S.at[from].splice(S.at[from].indexOf(u), 1);
  u.r = b; S.at[b].push(u);
  u.mp = 0; u.mv = 1; u.ent = 0; u.rdy = Math.max(0, u.rdy - 8);
  return true;
}
// ——— захват ———
export function capture(S, r, side, nat) {
  const prev = sideOf(S, r), g = S.M.reg[r];
  if (prev === side) return;
  const natIdx = S.M.nats.indexOf(side === 'SOV' ? 'SOV' : nat && SIDE0[nat] === side ? (nat === 'FIN' || nat === 'ROM' || nat === 'HUN' ? natHome(S, r, nat) : 'GER') : 'GER');
  S.own[r] = natIdx;
  S.rail[r] = 0;
  if (S.fort[r] > 0) S.fort[r]--;
  S.q = S.q.filter((b) => b.r !== r);
  S.capT[r] = S.turn;
  if (g.vp > 0) {
    addMor(S, prev, -g.vp * 0.8); addMor(S, side, g.vp * 0.4);
    if (g.vp >= 2) note(S, { ic: 'city', side, txt: `${g.n}: ${side === 'SOV' ? 'освобождён' : 'захвачен'}`, r });
  }
}
// союзник Оси держит свои земли и соседние (Бессарабия, Карелия), остальное — Германия
function natHome(S, r, nat) {
  const g = S.M.reg[r];
  if (nat === 'FIN' && g.z === 0) return 'FIN';
  if (nat === 'ROM' && S.M.nats[S.own0[r]] !== 'SOV') return 'ROM';
  if (nat === 'ROM' && g.x < 1450 && g.y > 2500) return 'ROM'; // Бессарабия и Транснистрия
  if (nat === 'HUN' && S.M.nats[S.own0[r]] === 'HUN') return 'HUN';
  return 'GER';
}
// ——— бой ———
export function canAttack(S, u) { return alive(u) && !u.att && u.rdy >= 22 && u.t !== 'sec' && u.mp > 0.2; }
export function attackersFor(S, T, side) {
  const out = [];
  for (const e of S.M.reg[T].nb) {
    if (sideOf(S, e.r) !== side) continue;
    if (e.sp === 'sea' && !frozen(S, T)) continue;
    for (const u of S.at[e.r]) if (u.s === side && canAttack(S, u)) out.push(u);
  }
  return out;
}
export function odds(S, T, us) {
  const side = us[0]?.s;
  if (!side) return { A: 0, D: 0, R: 0 };
  let A = 0, D = 0;
  for (const u of us) A += attCV(S, u, T, u.r);
  for (const v of S.at[T]) if (v.s !== side) D += defCV(S, v);
  const z = S.M.reg[T].z, ar = airRatio(S, side, z), wa = wxOf(S, T).air, e = 0.5 + (ar - 0.5) * wa;
  A *= (0.8 + 0.4 * e) / (0.8 + 0.4 * (1 - e));
  return { A, D, R: D > 0 ? A / D : 99 };
}
function hurt(S, u, pts, why) {
  u.str -= pts;
  if (u.str < 8) { destroy(S, u, why); return true; }
  return false;
}
export function destroy(S, u, why = 'разгромлена', pow = false) {
  if (!alive(u)) return;
  const l = S.at[u.r];
  l.splice(l.indexOf(u), 1);
  u.dead = 1; u.r = -1;
  S.stats[u.s].lost++;
  if (pow) S.stats[u.s].pow++;
  addMor(S, u.s, pow ? -0.35 : -0.2);
  addMor(S, other(u.s), 0.08);
}
// куда отходить: соседняя своя область без противника, лучше — со снабжением и местом, дальше от врага
function retreatTo(S, r, side) {
  let best = -1, bs = -1e9;
  for (const e of S.M.reg[r].nb) {
    const b = e.r;
    if (sideOf(S, b) !== side || (e.sp === 'sea' && !frozen(S, b))) continue;
    let s = (S.sup[side][b] > 0 ? 40 : 0) + room(S, b, side) * 2 - (isFront(S, b, side) ? 6 : 0);
    for (const f of S.M.reg[b].nb) if (enemyAt(S, f.r, side)) s -= 4;
    if (s > bs) (bs = s), (best = b);
  }
  return best;
}
export function resolveAttack(S, T, us, opt = {}) {
  const side = us[0].s, dside = other(side), g = S.M.reg[T];
  const defs = S.at[T].filter((v) => v.s === dside);
  const o = odds(S, T, us);
  const R = o.R * (0.82 + rnd(S) * 0.36);
  const res = { T, side, R, n: us.length, d: defs.length, win: false, lostA: 0, lostD: 0, pow: 0 };
  const wl = wxOf(S, T).atk < 0.7 ? 0.8 : 1;
  const fD = Math.max(0.02, Math.min(0.4, 0.075 * Math.pow(R, 0.75))) * wl, fA = Math.max(0.015, Math.min(0.32, 0.068 * Math.pow(R, -0.55))) * wl;
  const gD = genOf(S, dside, g.z);
  for (const u of us) {
    u.att = 1; u.mv = 1; u.ent = 0;
    u.rdy = Math.max(0, u.rdy - (16 + 8 / Math.max(0.5, R)));
    u.xp = Math.min(100, u.xp + 2);
    if (hurt(S, u, fA * 100 * (0.7 + 0.3 * u.str / 100), 'погибла в атаке')) res.lostA++;
  }
  for (const v of defs) {
    v.rdy = Math.max(0, v.rdy - (10 + 9 * Math.min(3, R)));
    v.xp = Math.min(100, v.xp + 1);
    if (hurt(S, v, fD * 100 * (0.7 + 0.3 * v.str / 100), 'разгромлена')) res.lostD++;
  }
  S.stats[side].battles++;
  const left = S.at[T].filter((v) => v.s === dside);
  const avgRdy = left.length ? left.reduce((s, v) => s + v.rdy, 0) / left.length : 0;
  let pRet = Math.max(0, Math.min(1, (R - 1.05) / 0.75)) + (avgRdy < 30 ? 0.3 : 0) - (opt.hold ? 0.25 : 0);
  if (!left.length) pRet = 1;
  if (R < 0.95) pRet = 0;
  if (rnd(S) < pRet) {
    const to = retreatTo(S, T, dside), rout = R >= 2.6;
    for (const v of [...left]) {
      if (to < 0) { destroy(S, v, 'попала в плен', true); res.pow++; res.lostD++; continue; }
      const extra = (rout ? 9 : 5) * (hasTr(gD, 'ret') ? 0.5 : 1);
      if (hurt(S, v, extra, 'разгромлена при отходе')) { res.lostD++; continue; }
      v.rdy = Math.max(0, v.rdy - (rout ? 30 : 18));
      const to2 = room(S, to, dside) > 0 ? to : retreatTo(S, to, dside);
      if (to2 < 0 || room(S, to2, dside) <= 0) { destroy(S, v, 'попала в плен', true); res.pow++; res.lostD++; continue; }
      S.at[T].splice(S.at[T].indexOf(v), 1); v.r = to2; S.at[to2].push(v); v.ent = 0; v.mp = 0;
    }
  }
  if (!S.at[T].some((v) => v.s === dside)) {
    res.win = true;
    // наступают: подвижные и пехота основной области (без оголения соседних участков — решает ИИ через adv)
    const adv = opt.adv || us;
    let k = room(S, T, side);
    const ord = [...adv].filter(alive).sort((a, b) => (isMech(b) ? 1 : 0) - (isMech(a) ? 1 : 0));
    for (const u of ord) {
      if (k <= 0) break;
      if (!alive(u)) continue;
      const c = stepCost(S, u, u.r, T);
      if (!isMech(u) && opt.keep?.has(u)) continue;
      moveUnit(S, u, T, c);
      if (!isMech(u)) u.mp = 0;
      k--;
    }
    if (sideOf(S, T) !== side) capture(S, T, side, ord[0]?.nat || side);
  }
  S.battles.push({ T, side, R: +R.toFixed(2), win: res.win, from: [...new Set(us.map((u) => u._from ?? u.r))].slice(0, 4), lost: res.lostD, pow: res.pow });
  return res;
}
// ——— фазы ———
export function beginPhase(S, side) {
  S.phase = side;
  S.railCap[side] = side === 'GER' ? 10 : 14;
  computeSupply(S, side); computeSupply(S, other(side));
  S.airA = { GER: airAlloc(S, 'GER'), SOV: airAlloc(S, 'SOV') };
  for (const u of S.units) if (alive(u) && u.s === side) { u.mp = mpOf(S, u); u.att = 0; u.mv = 0; }
}
export function endPhase(S, side) {
  const M = S.M;
  computeSupply(S, side);
  // окружённые: потери, падение готовности, сдача
  const pocketR = new Map();
  for (const u of S.units) {
    if (!alive(u) || u.s !== side) continue;
    const s = S.sup[side][u.r];
    if (s <= 0) {
      u.oos++;
      u.rdy = Math.min(u.rdy, Math.max(5, 50 - 9 * u.oos));
      if (hurt(S, u, 4 + 3 * Math.min(4, u.oos), 'погибла в окружении')) continue;
      pocketR.set(u.r, Math.max(pocketR.get(u.r) || 0, u.oos));
    } else {
      u.oos = 0;
      if (!u.mv) u.ent = Math.min(2, u.ent + 1);
      const quiet = !isFront(S, u.r, side);
      const g = genOf(S, side, M.reg[u.r].z);
      u.rdy = Math.min(100, u.rdy + (quiet ? 34 : 22) * (hasTr(g, 'hard') ? 1.25 : 1) * (0.6 + 0.4 * s));
    }
  }
  // сдача котлов
  for (const [r, oos] of pocketR) {
    if (oos < 3) continue;
    const g = genOf(S, other(side), M.reg[r].z);
    const p = 0.16 * (oos - 2) + (hasTr(g, 'enc') ? 0.12 : 0);
    if (rnd(S) < p) {
      const us = S.at[r].filter((u) => u.s === side);
      if (us.length) note(S, { ic: 'encircle', side: other(side), txt: `Котёл у ${M.reg[r].n}: сдались ${us.length} ${divW(us.length)}`, r });
      for (const u of us) destroy(S, u, 'сдалась в окружении', true);
    }
  }
  S.phase = null;
}
// ——— неделя ———
export function endWeek(S) {
  for (const side of ['GER', 'SOV']) { computeSupply(S, side); economy(S, side); }
  railRepair(S, 'GER'); railRepair(S, 'SOV');
  // постройки
  for (const b of S.q) b.left--;
  for (const b of S.q.filter((x) => x.left <= 0)) {
    if (b.k === 'fac') S.fac[b.r]++;
    else if (b.k === 'fort') S.fort[b.r] = Math.min(3, S.fort[b.r] + 1);
    else if (b.k === 'afd') S.afd[b.r] = 1;
  }
  S.q = S.q.filter((x) => x.left > 0);
  // эвакуация заводов
  for (const e of S.evac) e.left--;
  for (const e of S.evac.filter((x) => x.left <= 0)) { S.fac[e.to] += e.n; note(S, { ic: 'factory', side: 'SOV', txt: `Эвакуированные заводы заработали: ${S.M.reg[e.to].n}`, r: e.to }); }
  S.evac = S.evac.filter((x) => x.left > 0);
  // настроения
  if (yearF(S.turn) > 1942.1) addMor(S, 'SOV', 0.25);
  if (yearF(S.turn) > 1943.1) addMor(S, 'GER', -0.15);
  S.turn++;
  for (let z = 0; z < ZN; z++) S.wx[z] = weatherOf(S.turn, z, S.wxShift[(S.turn / 52) | 0] || 0, S.seed);
  S.air.GER = airBase(S, 'GER'); S.air.SOV = airBase(S, 'SOV');
  arrivals(S);
  S.hooks?.week?.(S);
  checkEnd(S);
}
// ——— хозяйство ———
export const ECO = {
  ppK: 2.5,
  base: { GER: [[1941.4, 46], [1942.0, 50], [1943.0, 62], [1944.0, 70], [1944.8, 60], [1945.3, 40]], SOV: [[1941.4, 12], [1942.0, 22], [1943.0, 36], [1944.0, 44], [1945.5, 46]] },
  mult: { GER: [[1941.4, 1], [1942.0, 1.08], [1943.0, 1.3], [1944.0, 1.45], [1945.0, 1.1]], SOV: [[1941.4, 1], [1942.0, 1.25], [1943.0, 1.45], [1944.0, 1.6], [1945.5, 1.65]] },
  men: { GER: [[1941.4, 24], [1942.0, 30], [1943.0, 28], [1944.0, 24], [1945.0, 18]], SOV: [[1941.4, 120], [1942.0, 96], [1943.0, 80], [1944.0, 70], [1945.0, 56]] },
  ll: [[1941.75, 0], [1941.85, 5], [1942.5, 9], [1943.5, 15], [1944.5, 18], [1945.5, 14]],
  air: { GER: [[1941.4, 100], [1942.0, 70], [1942.5, 85], [1943.0, 70], [1943.6, 60], [1944.4, 42], [1945.0, 32]], SOV: [[1941.4, 46], [1941.9, 40], [1942.5, 62], [1943.0, 90], [1943.6, 120], [1944.4, 150], [1945.0, 170]] },
};
const airBase = (S, side) => lerpT(ECO.air[side], yearF(S.turn)) * (S.flags[side + 'air'] || 1);
export function income(S, side) {
  const M = S.M, y = yearF(S.turn);
  let fac = 0;
  for (let r = 0; r < M.R; r++) {
    if (sideOf(S, r) !== side || !S.fac[r] || S.sup[side][r] <= 0) continue;
    const own0 = SIDE0[M.nats[S.own0[r]]];
    fac += S.fac[r] * (own0 === side ? 1 : 0.25) * (S.capT[r] > S.turn - 3 ? 0.3 : 1);
  }
  const ec = side === S.side ? DIFF[S.diff].eco : 1;
  let pp = (fac * ECO.ppK + lerpT(ECO.base[side], y)) * lerpT(ECO.mult[side], y) * ec * (S.flags[side + 'pp'] || 1);
  let ll = 0;
  if (side === 'SOV') {
    const routes = ['Мурманск', 'Архангельск', 'Астрахань', 'Баку'].filter((n) => sideOf(S, regByName(S, n)) === 'SOV').length;
    ll = lerpT(ECO.ll, y) * (0.4 + 0.15 * routes) * (S.flags.ll || 1);
    pp += ll;
  }
  let men = lerpT(ECO.men[side], y) * ec * (S.flags[side + 'men'] || 1);
  if (side === 'SOV') { // люди — по удержанной территории 1941 г. (население)
    let have = 0, tot = 0;
    for (let r = 0; r < M.R; r++) if (S.M.nats[S.own0[r]] === 'SOV') { const w = 1 + M.reg[r].vp; tot += w; if (sideOf(S, r) === 'SOV') have += w; }
    men *= 0.35 + 0.65 * (have / tot);
  }
  return { pp, men, fac, ll };
}
// стоимость пополнения 1 % численности и новой дивизии
export const costOf = (u) => ({ pp: TYPES[u.t].pp / 100, men: (TYPES[u.t].mp$ * (u.s === 'SOV' ? 1 : 1.5)) / 100 });
export const newCost = (side, t) => ({ pp: TYPES[t].pp * (side === 'SOV' ? 0.9 : 1.1), men: TYPES[t].mp$ * (side === 'SOV' ? 1 : 1.5) });
function economy(S, side) {
  const inc = income(S, side);
  S.inc[side] = inc;
  S.pp[side] += inc.pp; S.men[side] += inc.men;
  // пополнение: сначала дивизии у фронта
  const us = S.units.filter((u) => alive(u) && u.s === side && u.str < 100 && S.sup[side][u.r] >= 0.3);
  us.sort((a, b) => (isFront(S, b.r, side) ? 1 : 0) - (isFront(S, a.r, side) ? 1 : 0) || a.str - b.str);
  const budgetPP = S.pp[side] * 0.75, budgetMen = S.men[side] * 0.8;
  let usedPP = 0, usedMen = 0;
  for (const u of us) {
    const s = S.sup[side][u.r], want = Math.min(100 - u.str, 14 * s * (u.oos ? 0 : 1)), c = costOf(u);
    if (want <= 0) continue;
    const k = Math.min(want, (budgetPP - usedPP) / c.pp, (budgetMen - usedMen) / c.men);
    if (k <= 0.5) break;
    u.str += k; usedPP += k * c.pp; usedMen += k * c.men;
  }
  S.pp[side] -= usedPP; S.men[side] -= usedMen;
  S.spent[side] = { rep: usedPP };
  S.hooks?.recruit?.(S, side);
}
// новая дивизия (через 2 недели в тыловой области направления z)
let NUMS = null;
export function nameFor(S, side, nat, t) {
  NUMS ??= {};
  const k = `${nat}:${t}`;
  S.num[k] = (S.num[k] || (side === 'SOV' ? { inf: 300, mtn: 70, cav: 60, mot: 200, arm: 100, sec: 0 } : { inf: 330, mtn: 8, cav: 3, mot: 30, arm: 25, sec: 400 })[t]) + 1;
  const n = S.num[k];
  if (side === 'SOV') return t === 'inf' ? `${n}-я сд` : t === 'mtn' ? `${n}-я гсд` : t === 'cav' ? `${n}-я кд` : t === 'mot' ? `${n}-й мк` : t === 'arm' ? `${n % 100 + 1}-й тк` : `${n}-я сбр`;
  return t === 'inf' ? `${n}-я пд` : t === 'mtn' ? `${n}-я гд` : t === 'cav' ? `${n}-я кд` : t === 'mot' ? `${n}-я мд` : t === 'arm' ? `${n}-я тд` : `${n}-я охр. д`;
}
export function recruit(S, side, t, z, opt = {}) {
  const c = newCost(side, t);
  if (!opt.free && (S.pp[side] < c.pp || S.men[side] < c.men)) return null;
  if (!opt.free) { S.pp[side] -= c.pp; S.men[side] -= c.men; }
  const nat = opt.nat || side;
  const u = mkUnit(S, { s: side, nat, t, n: opt.n || nameFor(S, side, nat, t), str: opt.str ?? 100, rdy: opt.rdy ?? 70, xp: opt.xp ?? 0, gd: opt.gd });
  u.r = -1; u.arr = S.turn + (opt.wait ?? 2); u.z = z; u.at = opt.at ?? -1;
  return u;
}
export function mkUnit(S, o) {
  const u = { id: S.nextId++, s: o.s, nat: o.nat || o.s, t: o.t, n: o.n, r: o.r ?? -1, str: o.str ?? 100, rdy: o.rdy ?? 90, xp: o.xp ?? 10, oos: 0, mp: 0, att: 0, mv: 0, ent: o.ent ?? 0, gd: o.gd ? 1 : 0 };
  S.units.push(u);
  return u;
}
// место появления: своя область со снабжением, не у фронта, ближе к фронту направления
export function rearSpot(S, side, z, at = -1) {
  const M = S.M;
  if (at >= 0 && sideOf(S, at) === side && room(S, at, side) > 0 && S.sup[side][at] > 0) return at;
  const d = S.frontD?.[side];
  let best = -1, bs = -1e9;
  for (let r = 0; r < M.R; r++) {
    if (sideOf(S, r) !== side || room(S, r, side) <= 0 || S.sup[side][r] < 0.6 || isFront(S, r, side)) continue;
    const g = M.reg[r];
    let s = (g.z === z ? 60 : 0) - (d ? Math.abs((d[r] ?? 9) - 2.5) * 12 : 0) + (S.rail[r] ? 5 : 0) + g.vp;
    if (at >= 0) s -= Math.hypot(g.x - M.reg[at].x, g.y - M.reg[at].y) / 30;
    if (s > bs) (bs = s), (best = r);
  }
  return best;
}
function arrivals(S) {
  computeSupply(S, 'GER'); computeSupply(S, 'SOV');
  frontDist(S, 'GER'); frontDist(S, 'SOV');
  for (const u of S.units) {
    if (u.dead || u.r >= 0 || u.arr === undefined || u.arr > S.turn) continue;
    const r = rearSpot(S, u.s, u.z ?? 2, u.at ?? -1);
    if (r < 0) continue;
    u.r = r; S.at[r].push(u); delete u.arr;
    u.mp = 0;
  }
}
// расстояние (в областях) от линии фронта по своей территории
export function frontDist(S, side) {
  const M = S.M, d = new Int16Array(M.R).fill(99), q = [];
  for (let r = 0; r < M.R; r++) if (sideOf(S, r) === side && isFront(S, r, side)) (d[r] = 0), q.push(r);
  for (let h = 0; h < q.length; h++) { const r = q[h]; for (const e of M.reg[r].nb) if (sideOf(S, e.r) === side && d[e.r] > d[r] + 1) (d[e.r] = d[r] + 1), q.push(e.r); }
  S.frontD ??= {};
  return (S.frontD[side] = d);
}
// перешивка и восстановление железных дорог за наступающими
function railRepair(S, side) {
  const M = S.M, y = yearF(S.turn);
  let k = side === 'GER' ? (y < 1942 ? 4 : 5) : y < 1943 ? 4 : 7;
  const d = S.supD?.[side];
  const cand = [];
  for (let r = 0; r < M.R; r++) {
    if (sideOf(S, r) !== side || S.rail[r]) continue;
    if (!M.reg[r].nb.some((e) => sideOf(S, e.r) === side && S.rail[e.r] && S.sup[side][e.r] > 0)) continue;
    const n = S.at[r].filter((u) => u.s === side).length;
    cand.push([r, n * 3 + M.reg[r].vp * 2 + (SIDE0[M.nats[S.own0[r]]] === side ? 6 : 0) - (d ? d[r] : 0) * 0.5]);
  }
  cand.sort((a, b) => b[1] - a[1]);
  for (const [r] of cand) { if (k-- <= 0) break; S.rail[r] = 1; }
}
// ——— постройки ———
export const BUILD = {
  fac: { n: 'Завод', ic: 'factory', pp: 60, wk: 8, d: '+1 к производству' },
  fort: { n: 'Укрепления', ic: 'fort', pp: 14, wk: 3, d: '+22 % к обороне (до 3 уровней)' },
  afd: { n: 'Аэродром', ic: 'airfield', pp: 18, wk: 3, d: '+10 % к авиации направления' },
};
export function canBuild(S, side, r, k) {
  if (sideOf(S, r) !== side || S.q.some((b) => b.r === r && b.k === k)) return false;
  if (k === 'fort' && S.fort[r] >= 3) return false;
  if (k === 'afd' && S.afd[r]) return false;
  if (k === 'fac' && (S.fac[r] >= 8 || SIDE0[S.M.nats[S.own0[r]]] !== side || isFront(S, r, side))) return false;
  return S.pp[side] >= BUILD[k].pp;
}
export function build(S, side, r, k) {
  if (!canBuild(S, side, r, k)) return false;
  S.pp[side] -= BUILD[k].pp;
  S.q.push({ r, k, left: BUILD[k].wk, s: side });
  return true;
}
// эвакуация (СССР): заводы уезжают в тыл и через 8 недель работают там
export function canEvac(S, r) { return sideOf(S, r) === 'SOV' && S.fac[r] > 0 && SIDE0[S.M.nats[S.own0[r]]] === 'SOV' && !S.M.reg[r].f.includes('e') && S.M.reg[r].x < 2300; }
export function evacuate(S, r) {
  if (!canEvac(S, r)) return false;
  const M = S.M, n = Math.max(1, Math.ceil(S.fac[r] * 0.6));
  const tg = M.reg.filter((g) => g.f.includes('e') && sideOf(S, g.id) === 'SOV').sort((a, b) => S.fac[a.id] - S.fac[b.id] || b.x - a.x)[0];
  if (!tg) return false;
  S.fac[r] = 0;
  S.evac.push({ r, to: tg.id, n, left: 8 });
  note(S, { ic: 'train', side: 'SOV', txt: `Заводы ${M.reg[r].n} — эвакуация в ${tg.n}`, r });
  return true;
}
// ——— исход войны ———
export function checkEnd(S) {
  if (S.over) return;
  const own = (n) => sideOf(S, regByName(S, n));
  if (own('Берлин') === 'SOV') return end(S, 'SOV', 'Берлин взят. Победа!');
  const big = ['Ленинград', 'Сталинград', 'Горький', 'Куйбышев', 'Баку'].filter((n) => own(n) === 'GER').length;
  if (own('Москва') === 'GER' && big >= 2) return end(S, 'GER', 'Москва пала, СССР запросил мира');
  if (S.mor.SOV <= 3) return end(S, 'GER', 'Советский Союз сломлен');
  if (S.mor.GER <= 3) return end(S, 'SOV', 'Германия капитулировала');
  if (S.turn >= LAST_TURN) {
    const vpS = S.M.reg.reduce((s, g) => s + (sideOf(S, g.id) === 'SOV' ? g.vp : 0), 0);
    return end(S, vpS >= 100 ? 'SOV' : 'GER', 'Война окончена по времени');
  }
}
function end(S, win, why) { S.over = { win, why, turn: S.turn }; note(S, { ic: 'trophy', side: win, txt: why }); }
// ——— сохранение ———
const TA = ['own', 'own0', 'fac', 'fort', 'afd', 'rail', 'capT', 'bd0'];
export function serialize(S) {
  const o = {};
  for (const k in S) {
    if (['M', 'at', 'sup', 'supD', 'frontD', 'airA', 'hooks', 'news', 'battles', 'plan'].includes(k)) continue;
    o[k] = TA.includes(k) ? Array.from(S[k]) : S[k];
  }
  o.units = S.units.filter((u) => !u.dead);
  return JSON.stringify({ v: VER, S: o });
}
export function deserialize(M, str) {
  const J = JSON.parse(str);
  if (J.v !== VER) throw new Error('несовместимое сохранение');
  const S = J.S;
  S.M = M;
  S.own = Int16Array.from(S.own); S.own0 = Int16Array.from(S.own0); S.fac = Int8Array.from(S.fac); S.fort = Int8Array.from(S.fort);
  S.afd = Int8Array.from(S.afd); S.rail = Uint8Array.from(S.rail); S.capT = Int16Array.from(S.capT); S.bd0 = Int16Array.from(S.bd0);
  S.sup = {}; S.battles = []; S.news = [];
  reindex(S);
  computeSupply(S, 'GER'); computeSupply(S, 'SOV');
  S.airA = { GER: airAlloc(S, 'GER'), SOV: airAlloc(S, 'SOV') };
  return S;
}
export { fmtTurn, turnOf };
