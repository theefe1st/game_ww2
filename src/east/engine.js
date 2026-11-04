// «Мировой фронт» v0.10, «Восточный фронт 1941–1945»: движок. Ход — неделя: сначала фаза Оси, затем СССР.
// Области (map.json) вместо гексов: в области — до cap дивизий стороны. Бой — по области: атакующие из соседних
// областей против обороняющихся; итог — потери, отход или разгром (если отходить некуда — плен), захват области.
// Снабжение — от тыловых источников по своим областям (железные дороги Ось перешивает за собой), без снабжения —
// потери и сдача «котлов». Хозяйство: ⚙ производство (заводы областей + тыл + ленд-лиз), 👥 люди; пополнение,
// новые дивизии, постройки (завод, укрепления, аэродром), эвакуация заводов СССР.
import { TYPES, TER, WX, SIDE0, NAT_N, DIFF, LAST_TURN, quality, tankQ, weatherOf, winter41, rnd, other, yearF, lerpT, turnOf, fmtTurn, divW, isMech } from './rules.js';
import { ALLG } from '../war/gens41.js';
import { HIST_KEYS } from './hist.js';
import { runEvents } from './events.js';
import { produce, construct, evacWeek, hasEq, payEq, EQS, polOf } from './eco.js';
import { tx, techWeek } from './tech.js';
export { BUILD, BUILD_ORDER, canBuild, build, whyNot, canEvac, evacuate, slots, used, eqTot, hasEq, EQS, LINES, LINE, shiftLine, etaOf, cpPlanned, cpNow, bCost, unbuild } from './eco.js';

export const SAVE_KEY = 'wf_east_v1';
export const VER = 1;
export const ZN = 5;
// фронты (группы армий): до FN на сторону; S.fz[r] — фронт области для её владельца. У ИИ фронт = погодная полоса
// (M.reg[r].z, планы истории); у игрока после перекраски участков — S.fzo (новые области — по соседям)
export const FN = 8;
export const fzOf = (S, r) => (S.fz ? S.fz[r] : S.M.reg[r].z);
const fOn = (S, side, f) => f >= 0 && f < FN && !!S.fr?.[side]?.[f]?.on;
export function assignFronts(S) {
  const M = S.M, R = M.R, P = S.side;
  if (!S.fz || S.fz.length !== R) S.fz = Int8Array.from(M.reg, (g) => g.z);
  if (!S.fcust) { for (let r = 0; r < R; r++) S.fz[r] = M.reg[r].z; return; }
  S.fzo ??= Int8Array.from(M.reg, (g) => g.z);
  for (let pass = 0; pass < 6; pass++) {
    let ch = 0;
    for (let r = 0; r < R; r++) if (sideOf(S, r) === P && !fOn(S, P, S.fzo[r]) && newFront(S, r)) ch++;
    if (!ch) break;
  }
  const first = S.fr[P].findIndex((F) => F?.on);
  for (let r = 0; r < R; r++) {
    if (sideOf(S, r) !== P) { S.fz[r] = M.reg[r].z; continue; }
    if (!fOn(S, P, S.fzo[r])) S.fzo[r] = fOn(S, P, M.reg[r].z) ? M.reg[r].z : first;
    S.fz[r] = S.fzo[r];
  }
}
// фронт новой области игрока — как у большинства своих соседей (фронт «растёт» вместе с наступлением)
function newFront(S, r) {
  const M = S.M, P = S.side, c = new Array(FN).fill(0);
  for (const e of M.reg[r].nb) if (sideOf(S, e.r) === P && fOn(S, P, S.fzo[e.r])) c[S.fzo[e.r]] += e.sp === 'sea' ? 0.3 : 1;
  let b = -1, bv = 0;
  c.forEach((v, f) => { if (v > bv) (bv = v), (b = f); });
  if (b < 0) return false;
  S.fzo[r] = b; S.fz[r] = b;
  return true;
}
// фронт каждой области с точки зрения стороны: свои — S.fz, чужие — ближайший свой фронт (у ИИ — полоса)
export function frontMap(S, side) {
  const M = S.M, R = M.R, m = new Int8Array(R);
  if (side !== S.side || !S.fcust) { for (let r = 0; r < R; r++) m[r] = M.reg[r].z; return m; }
  m.fill(-1);
  const q = [];
  for (let r = 0; r < R; r++) if (sideOf(S, r) === side) (m[r] = S.fz[r]), q.push(r);
  for (let h = 0; h < q.length; h++) { const r = q[h]; for (const e of M.reg[r].nb) if (m[e.r] < 0) (m[e.r] = m[r]), q.push(e.r); }
  for (let r = 0; r < R; r++) if (m[r] < 0) m[r] = M.reg[r].z;
  return m;
}
// погодная полоса фронта: та, где больше его областей у линии соприкосновения
export function frontZone(S, side, f) {
  if (side !== S.side || !S.fcust) return Math.min(ZN - 1, f);
  const M = S.M, c = new Array(ZN).fill(0);
  for (let r = 0; r < M.R; r++) if (sideOf(S, r) === side && S.fz[r] === f) c[M.reg[r].z] += isFront(S, r, side) ? 3 : 1;
  let b = 2, bv = -1;
  c.forEach((v, z) => { if (v > bv) (bv = v), (b = z); });
  return b;
}
// ——— справочные ———
export const natOf = (S, r) => S.M.nats[S.own[r]] || '';
export const sideOf = (S, r) => { const n = S.M.nats[S.own[r]]; return S.out?.[n] ? null : SIDE0[n] || null; };
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
const diffMod = (S, side) => (side === S.side ? DIFF[S.diff].pl : DIFF[S.diff].ai) * (S.band?.[side] ?? 1);
const morMod = (S, side) => 0.9 + (0.2 * S.mor[side]) / 100;
const supF = (S, u) => { const s = S.sup[u.s][u.r]; return s <= 0 ? 0.45 : 0.5 + 0.5 * Math.min(1, s); };
// наука (относительно истории): все войска, пехота или танковые и моторизованные
export const techK = (S, u, kind) => 1 + (kind === 'att' ? tx(S, u.s, 'att') + (isMech(u) ? tx(S, u.s, 'tank') : tx(S, u.s, 'infAtt')) : tx(S, u.s, 'def') + (isMech(u) ? tx(S, u.s, 'tank') : tx(S, u.s, 'infDef')));
export function baseCV(S, u, kind) {
  const T = TYPES[u.t];
  return (kind === 'att' ? T.att : T.def) * qualOf(S, u) * techK(S, u, kind) * (u.str / 100) * (0.42 + (0.58 * u.rdy) / 100) * (1 + u.xp / 260) * diffMod(S, u.s) * morMod(S, u.s) * supF(S, u);
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
  if (u._opK) v *= u._opK; // десант (ops.js)
  v *= w.atk;
  if (u.s === 'GER' && u.nat === 'GER' && winter41(S.turn) && S.wx[g.z] !== 'dry') v *= S.flags.winterGear ? 0.85 : 0.62;
  v *= genMod(S, u.s, fzOf(S, from), 'att', u, ter) * boostK(S, u.s, g.z, 'att');
  return v;
}
// временные усиления событий (S.boost): z < 0 — на всех направлениях
export function boostK(S, side, z, kind) {
  const B = S.boost;
  if (!B || !B.length) return 1;
  let k = 1;
  for (const b of B) if (b.side === side && b.kind === kind && b.until > S.turn && (b.z < 0 || b.z === z)) k *= b.k;
  return k;
}
// артиллерия прорыва: атакующий «снимает» часть уровней укреплений (СССР — с 1943 г.)
export const ART = { SOV: [[1942.8, 0], [1943.5, 0.5], [1944.5, 1.0], [1945.2, 1.3]], GER: [[1941.4, 0.4], [1942.9, 0.4], [1943.5, 0.2]] };
const fortEff = (S, r, aside) => Math.max(0, S.fort[r] - (aside ? Math.max(0, lerpT(ART[aside], yearF(S.turn)) + tx(S, aside, 'fortPen')) : 0));
export function defCV(S, u, aside = null) {
  const g = S.M.reg[u.r], ter = g.t;
  let v = baseCV(S, u, 'def') * TER[ter].def;
  if (u.t === 'mtn' && (ter === 'mnt' || ter === 'hil')) v *= 1.25;
  if (ter === 'mar' && frozen(S, u.r)) v /= 1.25;
  v *= 1 + 0.22 * fortEff(S, u.r, aside);
  if (g.vp >= 5) v *= 1.2; else if (g.vp >= 2) v *= 1.08;
  if (g.f.includes('f')) v *= 1.3;
  v *= 1 + 0.1 * u.ent;
  if (u.s === 'GER' && u.nat === 'GER' && winter41(S.turn) && S.wx[g.z] !== 'dry') v *= S.flags.winterGear ? 0.92 : 0.8;
  v *= genMod(S, u.s, fzOf(S, u.r), 'def', u, ter) * boostK(S, u.s, g.z, 'def');
  return v;
}
// гарнизон города или укреплений (ополчение, НКВД, тыловые части): в такую область нельзя просто войти — только атакой
export function garOf(S, r, aside = null) {
  const g = S.M.reg[r], f = g.f.includes('f');
  if (g.vp < 1 && !S.fac[r] && !S.fort[r] && !f) return 0;
  const side = sideOf(S, r);
  if (!side) return 0;
  const s = S.sup[side]?.[r] ?? 1;
  return (1.4 * Math.max(0.6, g.vp) + 1.5 * fortEff(S, r, aside) + (f ? 3 : 0)) * (0.7 + 0.3 * quality(side, S.turn)) * (0.6 + 0.4 * Math.min(1, s)) * diffMod(S, side);
}
// ширина фронта области: в полную силу сражаются FW лучших дивизий, остальные — во втором эшелоне (40 %)
export const FW = 6;
export function sumFW(vals) {
  vals.sort((a, b) => b - a);
  let s = 0;
  for (let i = 0; i < vals.length; i++) s += vals[i] * (i < FW ? 1 : 0.4);
  return s;
}
export const regionDef = (S, r) => sumFW(S.at[r].map((u) => defCV(S, u))) + garOf(S, r);
export const regionAtt = (S, r) => S.at[r].reduce((s, u) => s + baseCV(S, u, 'att'), 0);
// ——— авиация по направлениям ———
export function airAlloc(S, side) {
  // авиация — по погодным полосам (воздушным районам); вес — участки фронта, втрое — при наступлении их фронта
  const w = new Array(ZN).fill(0.2);
  for (let r = 0; r < S.M.R; r++) if (sideOf(S, r) === side && isFront(S, r, side)) w[S.M.reg[r].z] += S.post[side][fzOf(S, r)] === 'atk' ? 1.6 : 1;
  for (let z = 0; z < ZN; z++) if (S.airF[side] === z) w[z] *= 2.6;
  const tot = w.reduce((a, b) => a + b, 0) || 1, afd = new Array(ZN).fill(0);
  for (let r = 0; r < S.M.R; r++) if (S.afd[r] && sideOf(S, r) === side) afd[S.M.reg[r].z]++;
  return w.map((x, z) => ((S.air[side] * x) / tot) * (1 + 0.1 * Math.min(4, afd[z])));
}
export function airRatio(S, side, z) {
  const a = S.airA?.[side]?.[z] ?? 0, b = S.airA?.[other(side)]?.[z] ?? 0;
  return a / (a + b + 1);
}
// ——— снабжение ———
export function isSource(S, r, side) {
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
  }
  const sup = S.sup[side] || (S.sup[side] = new Float32Array(R));
  // склады: область склада и соседние — на шаг ближе к железной дороге
  let depB = null;
  if (S.dep) for (let r = 0; r < R; r++) {
    if (!S.dep[r] || sideOf(S, r) !== side || d[r] >= 90) continue;
    depB ??= new Uint8Array(R);
    depB[r] = 1;
    for (const e of M.reg[r].nb) if (sideOf(S, e.r) === side) depB[e.r] = 1;
  }
  for (let r = 0; r < R; r++) {
    if (sideOf(S, r) !== side) { sup[r] = 0; continue; }
    const g = genOf(S, side, fzOf(S, r)), k = d[r] - (hasTr(g, 'log') ? 1 : 0) - (depB?.[r] || 0);
    sup[r] = k >= 90 ? 0 : k <= 1 ? 1 : k <= 2 ? 0.85 : k <= 3 ? 0.66 : k <= 4 ? 0.5 : 0.36;
  }
  const ts = tx(S, side, 'sup');
  if (ts) for (let r = 0; r < R; r++) if (sup[r] > 0) sup[r] = Math.min(1, sup[r] * (1 + ts));
  // растянутые коммуникации: чем дальше от своей довоенной территории, тем хуже снабжение (подвоз, партизаны)
  const dp = new Int16Array(R).fill(99), qd = [];
  for (let r = 0; r < R; r++) if (sideOf(S, r) === side && SIDE0[M.nats[S.own0[r]]] === side) (dp[r] = 0), qd.push(r);
  for (let h = 0; h < qd.length; h++) { const r = qd[h]; for (const e of M.reg[r].nb) if (sideOf(S, e.r) === side && dp[e.r] > dp[r] + 1) (dp[e.r] = dp[r] + 1), qd.push(e.r); }
  for (let r = 0; r < R; r++) if (sup[r] > 0 && dp[r] > 4 && dp[r] < 99) sup[r] *= Math.max(0.55, 1 - 0.04 * (dp[r] - 4));
  // порты и крепости в окружении — частичное снабжение (морем, складами)
  for (let r = 0; r < R; r++) {
    if (sup[r] > 0 || sideOf(S, r) !== side) continue;
    const g = M.reg[r];
    if (g.f.includes('p') || g.f.includes('f') || S.dep?.[r]) {
      sup[r] = 0.5;
      for (const e of g.nb) if (sideOf(S, e.r) === side && sup[e.r] <= 0) sup[e.r] = 0.3;
    }
  }
  // плацдармы десантов: первые недели снабжаются морем или по воздуху
  if (S.bridge) for (const k in S.bridge) { const r = +k; if (S.bridge[k] <= S.turn) delete S.bridge[k]; else if (sideOf(S, r) === side && sup[r] <= 0) sup[r] = 0.45; }
  // воздушный мост Люфтваффе (до 1943 г.): небольшие котлы получают немного снабжения
  if (side === 'GER' && yearF(S.turn) < 1943.4) {
    const pk = [];
    for (let r = 0; r < R; r++) if (sideOf(S, r) === side && sup[r] <= 0 && S.at[r]?.some((u) => u.s === side)) pk.push(r);
    const n = pk.reduce((a, r) => a + S.at[r].filter((u) => u.s === side).length, 0);
    if (n > 0 && n <= 12) for (const r of pk) sup[r] = 0.25;
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
// занять пустую область противника — дольше, чем пройти по своей
export const capC = (u) => (isMech(u) ? 0.7 : 1);
// глубина продвижения за фазу: 0 — своя с начала фазы, 1, 2 — занятые в эту фазу
export const depthOf = (S, r) => S.capPh?.get(r) ?? 0;
export const maxDepth = (u) => (isMech(u) ? 2 : u.t === 'cav' ? 2 : 1);
export const mpOf = (S, u) => { const s = S.sup[u.s][u.r]; return TYPES[u.t].mp * (s >= 0.66 ? 1 : s >= 0.5 ? 0.8 : s > 0 ? 0.65 : 0.5); };
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
      if (sb !== u.s && (S.at[b].length || garOf(S, b) > 0)) continue; // в занятую противником или с гарнизоном — только атакой
      if (e.sp === 'sea' && !frozen(S, b) && sb !== u.s) continue;
      if (sb !== u.s && depthOf(S, r) + 1 > maxDepth(u)) continue; // за неделю — не глубже 1 области (подвижные — 2)
      if (sb !== u.s && !natOK(S, u, b)) continue;
      // нельзя проскочить мимо противника: из области у фронта во вражескую пустую — только подвижным
      const nc = c + stepCost(S, u, r, b) + (sb !== u.s ? capC(u) : 0);
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
  if (sideOf(S, r) !== u.s) { S.capPh?.set(r, depthOf(S, from) + 1); capture(S, r, u.s, u.nat); u.rdy = Math.max(0, u.rdy - 6); }
}
// перемещение по пути reach (с захватом пустых областей противника)
export function moveTo(S, u, b, R = reach(S, u)) {
  if (!R.best.has(b) || b === u.r) return false;
  if (room(S, b, u.s) <= 0 && sideOf(S, b) === u.s) return false;
  const path = pathTo(R, b);
  for (let i = 1; i < path.length; i++) {
    const c = stepCost(S, u, path[i - 1], path[i]) + (sideOf(S, path[i]) !== u.s ? capC(u) : 0);
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
  if (S.fz) { if (S.fcust && side === S.side) { S.fzo[r] = -1; if (!newFront(S, r)) S.fz[r] = S.fzo[r] = g.z; } else S.fz[r] = g.z; }
  if (g.vp > 0) {
    addMor(S, prev, -g.vp * 0.5); addMor(S, side, g.vp * 0.25);
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
// Финляндия воюет только на своём (Финском) направлении: Ленинград не штурмует
export const natOK = (S, u, T) => u.nat !== 'FIN' || S.M.reg[T].z === 0;
export function canAttack(S, u) { return alive(u) && !u.att && u.rdy >= 22 && u.t !== 'sec' && u.mp > 0.2; }
export function attackersFor(S, T, side) {
  const out = [];
  for (const e of S.M.reg[T].nb) {
    if (sideOf(S, e.r) !== side) continue;
    if (e.sp === 'sea' && !frozen(S, T)) continue;
    for (const u of S.at[e.r]) if (u.s === side && canAttack(S, u) && natOK(S, u, T)) out.push(u);
  }
  return out;
}
export function odds(S, T, us, extraD = 0) {
  const side = us[0]?.s;
  if (!side) return { A: 0, D: 0, R: 0 };
  let A = 0, D = 0;
  const byR = new Map();
  for (const u of us) { const l = byR.get(u.r) || []; l.push(attCV(S, u, T, u.r)); byR.set(u.r, l); }
  for (const l of byR.values()) A += sumFW(l);
  D = sumFW(S.at[T].filter((v) => v.s !== side).map((v) => defCV(S, v, side))) + garOf(S, T, side) + extraD;
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
  const W = (S.stats[u.s].why ??= {}); W[why] = (W[why] || 0) + 1;
  addMor(S, u.s, pow ? -0.07 : -0.04);
  addMor(S, other(u.s), 0.02);
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
  const o = odds(S, T, us, opt.gar || 0);
  const R = o.R * (0.82 + rnd(S) * 0.36);
  const res = { T, side, R, n: us.length, d: defs.length, win: false, lostA: 0, lostD: 0, pow: 0 };
  const wl = wxOf(S, T).atk < 0.7 ? 0.8 : 1;
  // потери зависят и от выучки: опытные войска теряют меньше и при неудаче
  const qA = quality(side, S.turn), qD = quality(dside, S.turn), qr = Math.sqrt(qD / qA);
  const fD = Math.max(0.03, Math.min(0.4, 0.062 * Math.pow(R, 0.8))) * wl / qr, fA = Math.max(0.025, Math.min(0.3, 0.1 * Math.pow(R, -0.45))) * wl * qr;
  const gD = genOf(S, dside, fzOf(S, T));
  const str0 = new Map([...us, ...defs].map((u) => [u, u.str]));
  for (const u of us) {
    u.att = 1; u.mv = 1; u.ent = 0;
    u.rdy = Math.max(0, u.rdy - (22 + 10 / Math.max(0.5, R)));
    u.xp = Math.min(100, u.xp + 2);
    if (hurt(S, u, fA * 100 * (0.7 + 0.3 * u.str / 100), 'погибла в атаке')) res.lostA++;
  }
  for (const v of defs) {
    v.rdy = Math.max(0, v.rdy - (8 + 7 * Math.min(3, R)));
    v.xp = Math.min(100, v.xp + 1);
    if (hurt(S, v, fD * 100 * (0.7 + 0.3 * v.str / 100), 'разгромлена')) res.lostD++;
  }
  S.stats[side].battles++;
  const left = S.at[T].filter((v) => v.s === dside);
  const avgRdy = left.length ? left.reduce((s, v) => s + v.rdy, 0) / left.length : 0;
  let pRet = Math.max(0, Math.min(1, (R - 1.25) / 0.9)) + (avgRdy < 30 ? 0.3 : 0) - (opt.hold ? 0.25 : 0);
  if (!left.length) pRet = 1;
  if (R < 0.95) pRet = 0;
  if (rnd(S) < pRet) {
    const to = retreatTo(S, T, dside), rout = R >= 2.6;
    // отходить некуда: держатся до последнего (большие потери), при разгроме слабейшие сдаются
    const stand = (v) => {
      if (R >= 3.2 && v.str < 45) { destroy(S, v, 'попала в плен', true); res.pow++; res.lostD++; return; }
      v.rdy = Math.max(0, v.rdy - 25);
      if (hurt(S, v, 8, 'погибла в окружении')) res.lostD++;
    };
    for (const v of [...left]) {
      if (to < 0) { stand(v); continue; }
      const extra = (rout ? 9 : 5) * (hasTr(gD, 'ret') ? 0.5 : 1);
      if (hurt(S, v, extra, 'разгромлена при отходе')) { res.lostD++; continue; }
      v.rdy = Math.max(0, v.rdy - (rout ? 30 : 18));
      const to2 = room(S, to, dside) > 0 ? to : retreatTo(S, to, dside);
      if (to2 < 0 || room(S, to2, dside) <= 0) { stand(v); continue; }
      S.at[T].splice(S.at[T].indexOf(v), 1); v.r = to2; S.at[to2].push(v); v.ent = 0; v.mp = 0;
    }
  }
  if (!S.at[T].some((v) => v.s === dside) && !(opt.need && R < opt.need)) {
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
    if (sideOf(S, T) !== side) { S.capPh?.set(T, 1 + Math.min(...us.map((u) => depthOf(S, u._from ?? u.r)))); capture(S, T, side, ord[0]?.nat || side); }
  }
  let dA = 0, dD = 0;
  for (const [u, s0] of str0) { const d = s0 - (alive(u) ? u.str : 0); if (u.s === side) dA += d; else dD += d; }
  S.battles.push({ T, side, R: +R.toFixed(2), win: res.win, from: [...new Set(us.map((u) => u._from ?? u.r))].slice(0, 4), lost: res.lostD, lostA: res.lostA, pow: res.pow, n: us.length, d: defs.length, dA: Math.round(dA), dD: Math.round(dD) });
  return res;
}
// ——— фазы ———
export function beginPhase(S, side) {
  S.phase = side;
  S.capPh = new Map();
  assignFronts(S);
  S.railCap[side] = side === 'GER' ? 12 : 20;
  computeSupply(S, side); computeSupply(S, other(side));
  S.airA = { GER: airAlloc(S, 'GER'), SOV: airAlloc(S, 'SOV') };
  const shock = side === 'SOV' && S.turn === 0 ? 0.5 : 1; // первая неделя войны: управление нарушено
  if (shock < 1) S.railCap[side] = 6;
  for (const u of S.units) if (alive(u) && u.s === side) { u.mp = mpOf(S, u) * shock; u.att = 0; u.mv = 0; }
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
      // первую неделю — на запасах; дальше — потери и падение боеспособности
      u.rdy = Math.min(u.rdy, Math.max(5, 68 - 12 * u.oos));
      if (u.oos >= 2 && hurt(S, u, 3 + 3 * Math.min(4, u.oos - 1), 'погибла в окружении')) continue;
      pocketR.set(u.r, Math.max(pocketR.get(u.r) || 0, u.oos));
    } else {
      u.oos = 0;
      if (!u.mv) u.ent = Math.min(3, u.ent + 1);
      const quiet = !isFront(S, u.r, side);
      const g = genOf(S, side, fzOf(S, u.r));
      u.rdy = Math.min(100, u.rdy + (quiet ? 30 : 17) * (hasTr(g, 'hard') ? 1.25 : 1) * (0.6 + 0.4 * s));
    }
  }
  // сдача котлов
  let fmB = null;
  for (const [r, oos] of pocketR) {
    if (oos < 2) continue;
    fmB ??= frontMap(S, other(side));
    const g = genOf(S, other(side), fmB[r]);
    const q = quality(side === 'SOV' ? 'SOV' : 'GER', S.turn);
    // без осаждающих котёл не сдаётся (только тает): нужно держать вокруг него войска
    const seen = new Set();
    let bes = 0, dv = 0.5;
    for (const e of M.reg[r].nb) for (const v of S.at[e.r]) if (v.s !== side && !seen.has(v)) { seen.add(v); bes += baseCV(S, v, 'att'); }
    for (const u of S.at[r]) if (u.s === side) dv += baseCV(S, u, 'def');
    const k = Math.max(0, Math.min(1, (bes / dv - 0.6) / 1.4));
    const p = (0.24 * (oos - 1) * Math.max(0.25, 1.55 - q) + (hasTr(g, 'enc') ? 0.1 : 0)) * k - (S.M.reg[r].f.includes('f') || S.M.reg[r].f.includes('p') ? 0.3 : 0);
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
  // стройка (очки гражданских фабрик) и эвакуация заводов
  construct(S, 'GER'); construct(S, 'SOV');
  evacWeek(S);
  techWeek(S);
  // настроения: понемногу возвращаются к «настрою эпохи»
  for (const sd of ['GER', 'SOV']) addMor(S, sd, (lerpT(MOR0[sd], yearF(S.turn)) - S.mor[sd]) * 0.05);
  S.turn++;
  for (let z = 0; z < ZN; z++) S.wx[z] = weatherOf(S.turn, z, S.wxShift[(S.turn / 52) | 0] || 0, S.seed);
  S.air.GER = airBase(S, 'GER') * (S.airK?.GER ?? 1); S.air.SOV = airBase(S, 'SOV') * (S.airK?.SOV ?? 1);
  arrivals(S);
  director(S);
  runEvents(S);
  S.hooks?.week?.(S);
  checkEnd(S);
}
// ——— «ход истории» (режим «Исторический»): если война идёт заметно быстрее или медленнее, чем в 1941–1945 гг.,
// отстающая сторона получает резервы (Ставки ВГК или с Запада). Сложность: лёгкая — помощь только игроку,
// тяжёлая — только ИИ, нормальная — обоим.
export const cityR = (S, n) => { const M = S.M; M.cityR ??= new Map(M.cities.map((c) => [c.n, c.r])); return M.cityR.get(n) ?? regByName(S, n); };
export function histDiff(S) {
  let d = 0;
  const z = new Array(ZN).fill(0);
  for (const [n, a, b] of HIST_KEYS) {
    const r = cityR(S, n);
    if (r < 0) continue;
    const act = sideOf(S, r) === 'GER' ? 1 : 0, his = a && turnOf(a) <= S.turn && (!b || S.turn < turnOf(b)) ? 1 : 0;
    d += act - his;
    z[S.M.reg[r].z] += act - his;
  }
  return { d, z };
}
function director(S) {
  if (S.over) return;
  const h = histDiff(S), free = S.mode !== 'hist';
  S.dir = (S.dir ?? 0) * 0.7 + h.d * 0.3;
  // кто отстаёт от истории; помогать ли ему (сложность: лёгкая — только игроку, тяжёлая — только ИИ);
  // в «Свободном» режиме — слабее и только при большом отрыве (своя стратегия может переиграть историю)
  const x = Math.max(-1, Math.min(1, (free ? S.dir - Math.sign(S.dir) * Math.min(Math.abs(S.dir), 3) : S.dir) / 10)), lag = x > 0 ? 'SOV' : 'GER';
  const allow = (side) => S.diff === 1 || (S.diff === 0 ? side === S.side : side !== S.side);
  const k = (allow(lag) ? Math.abs(x) : 0) * (free ? (Math.abs(S.dir) >= 8 ? 0.9 : 0.7) : 1);
  // «ход истории»: отстающая сторона сражается немного лучше, ведущая — хуже (до ±15 %)
  S.band = { GER: 1 + (x > 0 ? -0.15 : 0.15) * k, SOV: 1 + (x > 0 ? 0.15 : -0.15) * k };
  if (S.turn % 3 || !k) return;
  const pick = (sg) => { let best = 2, bv = -1e9; h.z.forEach((v, q) => { if (v * sg > bv) (bv = v * sg), (best = q); }); return best; };
  const n0 = S.units.filter((u) => alive(u) || (!u.dead && u.arr !== undefined));
  if (lag === 'SOV' && S.dir >= (free ? 5 : 2) && n0.filter((u) => u.s === 'SOV').length < lerpT(ARMY_CAP.SOV, yearF(S.turn))) {
    const n = Math.min(free ? 3 : 5, Math.round(S.dir - (free ? 3 : 0))), z = pick(1);
    for (let i = 0; i < n; i++) recruit(S, 'SOV', i % 4 === 3 && yearF(S.turn) > 1942.2 ? 'arm' : 'inf', z, { free: 1, wait: 1, str: 85, rdy: 70 });
    note(S, { ic: 'star', side: 'SOV', txt: `Резервы Ставки: ${n} ${divW(n)}` });
  } else if (lag === 'GER' && S.dir <= (free ? -5 : -3) && n0.filter((u) => u.s === 'GER').length < lerpT(ARMY_CAP.GER, yearF(S.turn))) {
    const n = Math.min(free && S.dir > -8 ? 2 : 3, Math.round((-S.dir - (free ? 3 : 0)) / 2)), z = pick(-1);
    S.men.GER += 6 * n;
    for (let i = 0; i < n; i++) recruit(S, 'GER', i % 3 === 2 ? 'arm' : 'inf', z, { free: 1, wait: 1, str: 90, rdy: 80 });
    note(S, { ic: 'star', side: 'GER', txt: `Резервы с Запада: ${n} ${divW(n)}` });
  }
}
// предел численности для резервов «хода истории» (дивизий с союзниками)
export const ARMY_CAP = { SOV: [[1941.4, 330], [1942.0, 390], [1942.5, 430], [1943.5, 470], [1945.5, 470]], GER: [[1941.4, 210], [1942.5, 260], [1943.5, 250], [1944.5, 220], [1945.5, 190]] };
// ——— хозяйство ———
// «настрой эпохи»: к нему понемногу возвращается боевой дух сторон
export const MOR0 = { SOV: [[1941.4, 55], [1942.5, 60], [1943.5, 72], [1945, 82]], GER: [[1941.4, 80], [1942.9, 70], [1943.5, 56], [1944.5, 42], [1945.3, 28]] };
// доля запасов на пополнение дивизий (остальное — на новые дивизии и постройки)
export const REP = { SOV: [[1941.4, 0.5], [1942.4, 0.55], [1943.5, 0.65]], GER: [[1941.4, 0.8], [1945.5, 0.8]] };
// до какой численности (% штата) доводят дивизии пополнения: штат не достигался почти никогда
export const STRMAX = { SOV: [[1941.4, 75], [1942.3, 80], [1943.3, 85], [1944.5, 85], [1945.3, 80]], GER: [[1941.4, 100], [1942.0, 95], [1943.0, 88], [1944.0, 80], [1945.0, 72]] };
export const ECO = {
  ppK: { GER: 0.8, SOV: 1.6 },
  base: { GER: [[1941.4, 10], [1942.0, 12], [1943.0, 18], [1944.0, 24], [1944.8, 18], [1945.3, 10]], SOV: [[1941.4, 30], [1941.9, 26], [1942.2, 22], [1943.0, 36], [1944.0, 44], [1945.5, 46]] },
  mult: { GER: [[1941.4, 1], [1942.0, 1.08], [1943.0, 1.3], [1944.0, 1.45], [1945.0, 1.1]], SOV: [[1941.4, 1], [1942.0, 1.15], [1943.0, 1.3], [1944.0, 1.4], [1945.5, 1.45]] },
  men: { GER: [[1941.4, 11], [1941.95, 16], [1942.2, 24], [1943.0, 26], [1944.0, 24], [1944.8, 18], [1945.2, 12]], SOV: [[1941.4, 165], [1941.9, 140], [1942.3, 105], [1943.0, 85], [1944.0, 70], [1945.0, 56]] },
  ll: [[1941.75, 0], [1941.85, 5], [1942.5, 9], [1943.5, 15], [1944.5, 18], [1945.5, 14]],
  W: 1, cpK: 0.8, cpB: { GER: [[1941.4, 10], [1943.0, 12], [1944.5, 9]], SOV: [[1941.4, 8], [1943.0, 12], [1945.5, 14]] },
  air: { GER: [[1941.4, 100], [1942.0, 70], [1942.5, 85], [1943.0, 70], [1943.6, 60], [1944.4, 42], [1945.0, 32]], SOV: [[1941.4, 46], [1941.9, 40], [1942.5, 62], [1943.0, 90], [1943.6, 120], [1944.4, 150], [1945.0, 170]] },
};
const airBase = (S, side) => lerpT(ECO.air[side], yearF(S.turn)) * (S.flags[side + 'air'] || 1) * (1 + tx(S, side, 'air'));
export function income(S, side) {
  const M = S.M, y = yearF(S.turn);
  let fac = 0, civ = 0;
  for (let r = 0; r < M.R; r++) {
    if (sideOf(S, r) !== side || !(S.fac[r] || S.civ?.[r]) || S.sup[side][r] <= 0) continue;
    const own0 = SIDE0[M.nats[S.own0[r]]], k = (own0 === side ? 1 : 0.25) * (S.capT[r] > S.turn - 3 ? 0.3 : 1);
    fac += S.fac[r] * k; civ += (S.civ?.[r] || 0) * k;
  }
  const ec = side === S.side ? DIFF[S.diff].eco : 1;
  let pp = (fac * ECO.ppK[side] + lerpT(ECO.base[side], y)) * lerpT(ECO.mult[side], y) * ec * (S.flags[side + 'pp'] || 1) * (1 + tx(S, side, 'pp'));
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
    men *= 0.55 + 0.45 * (have / tot);
  }
  // военное производство (вместе с самолётами: «норма» — 20 % на авиацию) и стройка
  const cp = (civ * ECO.cpK + lerpT(ECO.cpB[side], y)) * ec * (S.flags[side + 'cp'] || 1) * (1 + tx(S, side, 'cp'));
  return { pp: pp * ECO.W, men, fac, ll: ll * ECO.W, civ, cp };
}
// предел численности армии (дивизий, с союзниками): растёт с мобилизацией; у игрока — с поправкой на сложность
export const ARMY = { SOV: [[1941.4, 320], [1942.0, 380], [1942.5, 420], [1943.5, 460], [1945.5, 460]], GER: [[1941.4, 200], [1942.5, 250], [1943.5, 240], [1944.5, 210], [1945.5, 180]] };
export const armyCap = (S, side) => Math.round(lerpT(ARMY[side], yearF(S.turn)) * (side === S.side ? DIFF[S.diff].cap ?? 1 : 1));
// дивизии на карте и новые в пути (исторические подкрепления не в счёт)
export const armySize = (S, side) => S.units.filter((u) => u.s === side && !u.dead && (u.r >= 0 || (u.arr !== undefined && !u.hist))).length;
// стоимость пополнения 1 % численности и новой дивизии
export const costOf = (u) => ({ pp: TYPES[u.t].pp / 100, men: (TYPES[u.t].mp$ * (u.s === 'SOV' ? 1 : 1.5)) / 100 });
export const newCost = (side, t) => ({ pp: TYPES[t].pp * (side === 'SOV' ? 0.9 : 1.1), men: TYPES[t].mp$ * (side === 'SOV' ? 1 : 1.5) });
function economy(S, side) {
  const inc = income(S, side);
  S.inc[side] = inc;
  inc.out = produce(S, side, inc.pp);
  S.men[side] += inc.men;
  S.pol[side] = Math.min(999, (S.pol[side] || 0) + polOf(S, side));
  // пополнение: сначала дивизии у фронта
  const top = lerpT(STRMAX[side], yearF(S.turn));
  const us = S.units.filter((u) => alive(u) && u.s === side && u.str < top && S.sup[side][u.r] >= 0.3);
  us.sort((a, b) => (isFront(S, b.r, side) ? 1 : 0) - (isFront(S, a.r, side) ? 1 : 0) || a.str - b.str);
  // бюджет пополнения: доля запасов каждого вида снаряжения и людей
  const rp = S.repF?.[side] ?? lerpT(REP[side], yearF(S.turn)), q = S.eq[side], B = { inf: q.inf * rp, art: q.art * rp, arm: q.arm * rp }, U = { inf: 0, art: 0, arm: 0 }, budgetMen = S.men[side] * rp;
  let usedPP = 0, usedMen = 0, dry = 0;
  const recK = 1 + tx(S, side, 'rec');
  for (const u of us) {
    const s = S.sup[side][u.r], want = Math.min(top - u.str, (isFront(S, u.r, side) ? 8 : 16) * s * (u.oos ? 0 : 1) * recK), c = costOf(u), m = EQS[u.t] || EQS.inf;
    if (want <= 0) continue;
    let k = Math.min(want, (budgetMen - usedMen) / c.men);
    for (const e in m) k = Math.min(k, (B[e] - U[e]) / (c.pp * m[e]));
    if (k <= 0.5) { if (++dry > 12 || budgetMen - usedMen < c.men) break; continue; }
    u.str += k; usedPP += k * c.pp; usedMen += k * c.men;
    for (const e in m) U[e] += k * c.pp * m[e];
  }
  for (const e in U) q[e] = Math.max(0, q[e] - U[e]);
  S.men[side] -= usedMen;
  S.spent[side] = { rep: usedPP };
  S.hooks?.recruit?.(S, side);
}
// новая дивизия (через 2 недели в тыловой области направления z)
let NUMS = null;
// номера новых дивизий союзников Оси — продолжают свои ряды
const NUM0 = { ROM: { inf: 21, mtn: 4, cav: 8, arm: 1, mot: 0, sec: 0 }, HUN: { inf: 27, mtn: 2, cav: 1, arm: 1, mot: 0, sec: 101 }, ITA: { inf: 156, mtn: 4, cav: 3, arm: 133, mot: 9, sec: 0 }, FIN: { inf: 18, mtn: 0, cav: 0, arm: 1, mot: 0, sec: 0 }, SVK: { inf: 2, mtn: 0, cav: 0, arm: 0, mot: 1, sec: 0 } };
const NAT_SF = { ROM: 'рум.', HUN: 'венг.', ITA: 'итал.', FIN: 'фин.', SVK: 'слов.' };
export function nameFor(S, side, nat, t) {
  NUMS ??= {};
  const k = `${nat}:${t}`;
  const B = side === 'SOV' ? { inf: 300, mtn: 70, cav: 60, mot: 200, arm: 100, sec: 0, abn: 0 } : NUM0[nat] || { inf: 330, mtn: 8, cav: 3, mot: 30, arm: 25, sec: 400, abn: 0 };
  S.num[k] = (S.num[k] || B[t] || 0) + 1;
  const n = S.num[k], sf = NAT_SF[nat] ? ` (${NAT_SF[nat]})` : '';
  if (side === 'SOV') return t === 'inf' ? `${n}-я сд` : t === 'mtn' ? `${n}-я гсд` : t === 'cav' ? `${n}-я кд` : t === 'mot' ? `${n}-й мк` : t === 'arm' ? `${n % 100 + 1}-й тк` : t === 'abn' ? `${n}-я вдд` : `${n}-я сбр`;
  return (t === 'inf' ? `${n}-я пд` : t === 'mtn' ? `${n}-я гд` : t === 'cav' ? `${n}-я кд` : t === 'mot' ? `${n}-я мд` : t === 'arm' ? `${n}-я тд` : t === 'abn' ? `${n}-я парашютная д` : `${n}-я охр. д`) + sf;
}
export function recruit(S, side, t, z, opt = {}) {
  const c = newCost(side, t);
  if (!opt.free && (!hasEq(S, side, t, c.pp) || S.men[side] < c.men || armySize(S, side) >= armyCap(S, side))) return null;
  if (!opt.free) { payEq(S, side, t, c.pp); S.men[side] -= c.men; }
  const nat = opt.nat || side;
  const y = yearF(S.turn), s0 = Math.round(lerpT(STRMAX[side], y) * (side === 'SOV' ? 0.95 : 1));
  const u = mkUnit(S, { s: side, nat, t, n: opt.n || nameFor(S, side, nat, t), str: opt.str ?? s0, rdy: opt.rdy ?? (side === 'SOV' && y < 1942.3 ? 55 : 70), xp: opt.xp ?? 0, gd: opt.gd });
  u.r = -1; u.arr = S.turn + (opt.wait ?? 2); u.z = z; u.at = opt.at ?? -1;
  if (opt.f !== undefined && opt.f >= 0) u.zf = opt.f;
  if (opt.camp) u.camp = 1;
  return u;
}
export function mkUnit(S, o) {
  const u = { id: S.nextId++, s: o.s, nat: o.nat || o.s, t: o.t, n: o.n, r: o.r ?? -1, str: o.str ?? 100, rdy: o.rdy ?? 90, xp: o.xp ?? 10, oos: 0, mp: 0, att: 0, mv: 0, ent: o.ent ?? 0, gd: o.gd ? 1 : 0 };
  S.units.push(u);
  return u;
}
// место появления: своя область со снабжением, не у фронта, ближе к фронту направления
export function rearSpot(S, side, z, at = -1, f = -1) {
  const M = S.M;
  if (at >= 0 && sideOf(S, at) === side && room(S, at, side) > 0 && S.sup[side][at] > 0) return at;
  const d = S.frontD?.[side];
  let best = -1, bs = -1e9;
  for (let r = 0; r < M.R; r++) {
    if (sideOf(S, r) !== side || room(S, r, side) <= 0 || S.sup[side][r] < 0.6 || isFront(S, r, side)) continue;
    const g = M.reg[r];
    let s = (f >= 0 ? (fzOf(S, r) === f ? 60 : 0) : g.z === z ? 60 : 0) - (d ? Math.abs((d[r] ?? 9) - 2.5) * 12 : 0) + (S.rail[r] ? 5 : 0) + g.vp;
    if (at >= 0) s -= Math.hypot(g.x - M.reg[at].x, g.y - M.reg[at].y) / 30;
    if (s > bs) (bs = s), (best = r);
  }
  return best;
}
// учебный лагерь: дивизия появляется в лагере или в ближайшей своей области с местом
function campSpot(S, side, at) {
  const M = S.M, seen = new Set([at]), q = [at];
  for (let h = 0; h < q.length && h < 60; h++) {
    const r = q[h];
    if (sideOf(S, r) === side && room(S, r, side) > 0 && S.sup[side][r] > 0) return r;
    for (const e of M.reg[r].nb) if (!seen.has(e.r) && sideOf(S, e.r) === side) { seen.add(e.r); q.push(e.r); }
  }
  return -1;
}
function arrivals(S) {
  computeSupply(S, 'GER'); computeSupply(S, 'SOV');
  frontDist(S, 'GER'); frontDist(S, 'SOV');
  for (const u of S.units) {
    if (u.dead || u.r >= 0 || u.arr === undefined || u.arr > S.turn) continue;
    let r = u.camp && u.at >= 0 && sideOf(S, u.at) === u.s ? campSpot(S, u.s, u.at) : -1;
    if (r < 0) r = rearSpot(S, u.s, u.z ?? 2, u.at ?? -1, u.s === S.side ? u.zf ?? -1 : -1);
    delete u.camp;
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
  let k = Math.max(1, (side === 'GER' ? (y < 1942 ? 3 : 4) : y < 1943 ? 4 : y < 1944 ? 5 : 6) + Math.round(tx(S, side, 'rail')));
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
// ——— исход войны ———
export function checkEnd(S) {
  if (S.over) return;
  const own = (n) => sideOf(S, regByName(S, n));
  if (own('Берлин') === 'SOV') return end(S, 'SOV', 'Красная армия взяла Берлин');
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
const TA = ['own', 'own0', 'fac', 'fort', 'afd', 'rail', 'capT', 'bd0', 'fz', 'fzo', 'civ', 'camp', 'dep'];
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
  for (const k of ['fz', 'fzo', 'civ', 'camp', 'dep']) if (S[k]) S[k] = Int8Array.from(S[k]);
  S.sup = {}; S.battles = []; S.news = [];
  reindex(S);
  computeSupply(S, 'GER'); computeSupply(S, 'SOV');
  S.airA = { GER: airAlloc(S, 'GER'), SOV: airAlloc(S, 'SOV') };
  return S;
}
export { fmtTurn, turnOf };
