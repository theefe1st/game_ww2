// «Мировой фронт» v0.11: операции — морской десант (из своего порта на берег того же моря) и воздушный десант
// (дивизии ВДВ с аэродрома). Открываются наукой (ветка «Операции»), сила — от изученного (opK).
// Моря — по растру суши (8 км): связные куски воды; прибрежные области — по береговым дугам карты.
import { TYPES, isMech, other, yearF, quality } from './rules.js';
import { sideOf, garOf, resolveAttack, moveUnit, capture, alive, room, airRatio, note, odds, computeSupply, aaCover } from './engine.js';
import { hasU, unV } from './tech.js';

const ST = 8; // км на клетку растра
const SEA_N = [['Одесса', 'Чёрное море'], ['Таллин', 'Балтийское море'], ['Мурманск', 'Баренцево море'], ['Баку', 'Каспийское море'], ['Сплит', 'Адриатическое море'], ['Лабытнанги', 'Карское море']];
export function seas(M) {
  if (M.sea) return M.sea;
  const nx = Math.ceil(M.w / ST), ny = Math.ceil(M.h / ST), land = new Uint8Array(nx * ny), rows = Array.from({ length: ny }, () => []);
  for (const P of M.land) {
    const n = P.length / 2;
    for (let i = 0; i < n; i++) {
      const k = (i + 1) % n, x0 = P[i * 2], y0 = P[i * 2 + 1], x1 = P[k * 2], y1 = P[k * 2 + 1];
      if (y0 === y1) continue;
      const j0 = Math.max(0, Math.ceil(Math.min(y0, y1) / ST - 0.5)), j1 = Math.min(ny - 1, Math.ceil(Math.max(y0, y1) / ST - 0.5) - 1);
      for (let j = j0; j <= j1; j++) { const y = (j + 0.5) * ST; rows[j].push(x0 + ((y - y0) * (x1 - x0)) / (y1 - y0)); }
    }
  }
  for (let j = 0; j < ny; j++) {
    const xs = rows[j].sort((a, b) => a - b);
    for (let q = 0; q + 1 < xs.length; q += 2) { const a = Math.max(0, Math.ceil(xs[q] / ST - 0.5)), b = Math.min(nx - 1, Math.floor(xs[q + 1] / ST - 0.5)); for (let i = a; i <= b; i++) land[j * nx + i] ^= 1; }
  }
  // связные куски воды
  const id = new Int16Array(nx * ny).fill(-1), size = [];
  for (let c = 0; c < nx * ny; c++) {
    if (land[c] || id[c] >= 0) continue;
    const s = size.length, q = [c]; id[c] = s; let n = 0;
    while (q.length) {
      const x = q.pop(), i = x % nx, j = (x / nx) | 0; n++;
      if (i > 0 && !land[x - 1] && id[x - 1] < 0) { id[x - 1] = s; q.push(x - 1); }
      if (i < nx - 1 && !land[x + 1] && id[x + 1] < 0) { id[x + 1] = s; q.push(x + 1); }
      if (j > 0 && !land[x - nx] && id[x - nx] < 0) { id[x - nx] = s; q.push(x - nx); }
      if (j < ny - 1 && !land[x + nx] && id[x + nx] < 0) { id[x + nx] = s; q.push(x + nx); }
    }
    size.push(n);
  }
  // прибрежные области: береговые дуги (по другую сторону — ничего), не край карты; море — вода рядом (±2 клетки)
  const R = M.reg.length, sr = Array.from({ length: R }, () => null);
  for (const A of M.arcs) {
    if (A.t !== 1 || A.a !== -1) continue;
    const p = A.p;
    for (let i = 0; i < p.length; i += 6) {
      const x = p[i], y = p[i + 1];
      if (x < 5 || y < 5 || x > M.w - 5 || y > M.h - 5) continue;
      const ci = Math.floor(x / ST), cj = Math.floor(y / ST);
      for (let dj = -2; dj <= 2; dj++) for (let di = -2; di <= 2; di++) {
        const a = ci + di, b = cj + dj;
        if (a < 0 || b < 0 || a >= nx || b >= ny) continue;
        const s = id[b * nx + a];
        if (s >= 0 && size[s] > 20) { const L = (sr[A.b] ??= []); if (!L.includes(s)) L.push(s); }
      }
    }
  }
  const name = {};
  for (const [c, n] of SEA_N) { const g = M.reg.find((x) => x.city?.n === c || x.n === c); for (const s of (g && sr[g.id]) || []) name[s] ??= n; }
  return (M.sea = { sr, name, size });
}
export const seaName = (M, s) => seas(M).name[s] || 'море';
export const isPort = (S, r) => S.M.reg[r].f.includes('p');
const dist = (M, a, b) => Math.hypot(M.reg[a].x - M.reg[b].x, M.reg[a].y - M.reg[b].y);
// господство на море: Черноморский флот у СССР, на Балтике до 1944 г. — у Германии
function seaK(S, side, s) {
  const n = seaName(S.M, s), y = yearF(S.turn);
  if (n === 'Чёрное море' || n === 'Азовское море') return side === 'GER' ? 0.75 : 1;
  if (n === 'Балтийское море') return side === 'SOV' && y < 1944.5 ? 0.75 : 1;
  if (n === 'Каспийское море') return side === 'GER' ? 0 : 1;
  return 1;
}
export const OPS = {
  sea: { n: 'Морской десант', ic: 'landing', max: 3, range: 650, cd: 4, k: 0.5, fail: 12, tech: 'Морская пехота' },
  abn: { n: 'Воздушный десант', ic: 'para', max: 2, range: 380, cd: 3, k: 0.6, fail: 20, tech: 'Воздушно-десантные войска' },
};
const fullMp = (u) => u.mp >= TYPES[u.t].mp * 0.9 - 1e-6;
export function opUnits(S, side, kind, r) {
  const ok = (u) => alive(u) && u.s === side && !u.att && fullMp(u) && (kind === 'sea' ? !isMech(u) && u.t !== 'cav' && u.t !== 'sec' && u.rdy >= 50 && u.str >= 40 : u.t === 'abn' && u.rdy >= 60 && u.str >= 50);
  return S.at[r].filter(ok).sort((a, b) => b.str - a.str).slice(0, OPS[kind].max);
}
// почему нельзя начать операцию из области r (или null)
export function opWhy(S, side, kind, r) {
  const O = OPS[kind];
  if (!hasU(S, side, kind)) return `нужна наука: «${O.tech}»`;
  if (sideOf(S, r) !== side) return 'не наша область';
  if (kind === 'sea' && !isPort(S, r)) return 'нужен порт';
  if (kind === 'abn' && !S.afd[r]) return 'нужен аэродром';
  if ((S.sup[side]?.[r] ?? 0) <= 0) return 'нет снабжения';
  const cd = S.opCd?.[side]?.[kind] ?? -1;
  if (cd > S.turn) return `готовится: ещё ${cd - S.turn} нед.`;
  if (!opUnits(S, side, kind, r).length) return kind === 'sea' ? 'нет готовой пехоты (полные ходы, готовность от 50 %)' : 'нет готовых дивизий ВДВ';
  if (!opTargets(S, side, kind, r).length) return 'нет целей в досягаемости';
  return null;
}
export function opTargets(S, side, kind, r) {
  const M = S.M, out = [], en = other(side);
  if (kind === 'sea') {
    const sr = seas(M).sr, my = (sr[r] || []).filter((s) => seaK(S, side, s) > 0);
    if (!my.length) return out;
    for (let t = 0; t < M.R; t++) if (t !== r && sideOf(S, t) === en && sr[t]?.some((s) => my.includes(s)) && dist(M, r, t) <= OPS.sea.range) out.push(t);
  } else for (let t = 0; t < M.R; t++) if (t !== r && sideOf(S, t) === en && dist(M, r, t) <= OPS.abn.range) out.push(t);
  return out;
}
const seaOf = (S, r, t) => { const sr = seas(S.M).sr; return (sr[r] || []).find((s) => sr[t]?.includes(s)); };
// сила операции: ×k (+ наука), на море — господство флота; ВДВ без прикрытия ВВС несут потери ещё в воздухе
export function opK(S, side, kind, r, t) { return (OPS[kind].k + unV(S, side, 'opK')) * (kind === 'sea' ? seaK(S, side, seaOf(S, r, t)) : 1); }
// ВДВ: потери от истребителей (при слабой своей авиации) и от ПВО противника в области и по соседству
export const airLoss = (S, side, t) => { const ar = airRatio(S, side, S.M.reg[t].z); return Math.round(Math.max(0, (0.35 - ar) / 0.35) * 30 + aaCover(S, t, other(side)) * 30); };
// береговая оборона (батареи, тыловые части): в порту сильнее; воздушный десант на пустую область — без боя
export const coastDef = (S, side, kind, t) => (kind === 'sea' ? (isPort(S, t) ? 2.5 : 0.8) * quality(other(side), S.turn) : 0);
export const opFree = (S, side, kind, t) => !S.at[t].some((v) => v.s !== side) && garOf(S, t, side) <= 0 && !coastDef(S, side, kind, t);
export function opOdds(S, side, kind, r, t, us) {
  if (opFree(S, side, kind, t)) return { free: true, R: 99 };
  const k = opK(S, side, kind, r, t);
  for (const u of us) u._opK = k;
  const o = odds(S, t, us, coastDef(S, side, kind, t));
  for (const u of us) delete u._opK;
  return o;
}
export function runOp(S, side, kind, r, t, us = opUnits(S, side, kind, r)) {
  const M = S.M, O = OPS[kind], nm = M.reg[t].city?.n || M.reg[t].n;
  us = us.filter(alive);
  if (!us.length) return null;
  const res = { kind, r, t, win: false, free: false, lost: 0, air: 0, n: us.length };
  // ВДВ: потери от ПВО и истребителей при слабой авиации
  if (kind === 'abn') { const L = airLoss(S, side, t); if (L) for (const u of us) { u.str = Math.max(8, u.str - L); res.air += L; } }
  if (opFree(S, side, kind, t) && room(S, t, side) >= us.length) {
    for (const u of us) { moveUnit(S, u, t, 99); u.mp = 0; }
    capture(S, t, side, us[0].nat);
    res.win = res.free = true;
    S.battles.push({ T: t, side, R: 9, win: true, from: [r], lost: 0, lostA: 0, pow: 0, n: us.length, d: 0, dA: 0, dD: 0, op: kind });
  } else {
    const k = opK(S, side, kind, r, t);
    for (const u of us) u._opK = k;
    const b = resolveAttack(S, t, us, { gar: coastDef(S, side, kind, t), need: 1 });
    for (const u of us) delete u._opK;
    res.win = b.win; res.lost = b.lostA; res.R = b.R;
    if (S.battles.length) S.battles[S.battles.length - 1].op = kind;
    if (!b.win) for (const u of us) if (alive(u)) { u.str = Math.max(8, u.str - O.fail); }
  }
  for (const u of us) if (alive(u)) { u.att = 1; u.mp = 0; u.rdy = kind === 'abn' ? Math.min(u.rdy, 10) : Math.max(0, u.rdy - 30); }
  // плацдарм: снабжение морем или по воздуху несколько недель
  if (res.win) (S.bridge ??= {})[t] = S.turn + (kind === 'sea' ? 5 : 3);
  ((S.opCd ??= {})[side] ??= {})[kind] = S.turn + O.cd;
  note(S, { ic: O.ic, side, txt: `${O.n}: ${nm} — ${res.win ? (res.free ? 'высадка без боя' : 'плацдарм захвачен') : 'отбит'}`, r: t });
  computeSupply(S, side); computeSupply(S, other(side));
  return res;
}
