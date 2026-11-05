// «Мировой фронт» v0.11: операции — морской десант (из своего порта на берег того же моря) и воздушный десант
// (дивизии ВДВ с аэродрома). Открываются наукой (ветка «Операции»), сила — от изученного (opK).
// Моря — по растру суши (8 км): связные куски воды; прибрежные области — по береговым дугам карты.
import { TYPES, isMech, other, hostile, yearF, quality, wT, turnsW, WK } from './rules.js';
import { sideOf, garOf, resolveAttack, moveUnit, capture, alive, room, airRatio, note, odds, computeSupply, aaCover, atWar, foesOf, sidesOf } from './engine.js';
import { hasU, unV } from './tech.js';
import { seaDom } from './fleet.js';
import { makeProj } from './mapdata.js';

const ST = 8; // км на клетку растра
const SEA_N = [['Одесса', 'Чёрное море'], ['Таллин', 'Балтийское море'], ['Мурманск', 'Баренцево море'], ['Баку', 'Каспийское море'], ['Сплит', 'Адриатическое море'], ['Лабытнанги', 'Карское море']];
const SEA_CUT = [[[-5.6, 35.7], [-5.6, 36.3]], [[8.6, 57.1], [7.0, 58.05]], [[-3.05, 58.6], [-1.3, 60.0], [-0.8, 60.8], [5.0, 61.95]], [[-5.75, 50.05], [-4.75, 48.45]],
  [[25.0, 70.95], [25.0, 74]], [[18.45, 40.1], [19.45, 40.4]], [[28.9, 41.1], [29.2, 41.1]], [[36.3, 45.27], [36.85, 45.27]]];
const SEA_PT = [[-12, 46, 'Атлантика'], [3, 56, 'Северное море'], [19, 56, 'Балтийское море'], [36, 71.2, 'Баренцево море'], [18, 34, 'Средиземное море'],
  [16.5, 42.5, 'Адриатическое море'], [34, 43.3, 'Чёрное море'], [36.6, 46.2, 'Азовское море'], [51, 42, 'Каспийское море']];
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
  // большая карта: проливы-границы морей (Гибралтар, Скагеррак, север Северного моря, вход в Ла-Манш, Баренцево море,
  // Отранто, Босфор, Керчь) — «суша» растра; моря называются по точке в открытом море
  const P = M.world ? makeProj(M.proj) : null;
  if (P) for (const L of SEA_CUT) for (let k = 0; k + 1 < L.length; k++) {
    const [x0, y0] = P(L[k][0], L[k][1]), [x1, y1] = P(L[k + 1][0], L[k + 1][1]), n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) / (ST / 3));
    for (let t = 0; t <= n; t++) {
      const i = Math.floor((x0 + ((x1 - x0) * t) / n) / ST), j = Math.floor((y0 + ((y1 - y0) * t) / n) / ST);
      for (const [a, b] of [[0, 0], [1, 0], [0, 1]]) if (i + a >= 0 && j + b >= 0 && i + a < nx && j + b < ny) land[(j + b) * nx + i + a] = 1;
    }
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
  if (P) for (const [lon, lat, n] of SEA_PT) { const [x, y] = P(lon, lat), c = Math.floor(y / ST) * nx + Math.floor(x / ST), s = id[c]; if (s >= 0) name[s] ??= n; }
  for (const [c, n] of SEA_N) { const g = M.reg.find((x) => x.city?.n === c || x.n === c); for (const s of (g && sr[g.id]) || []) name[s] ??= n; }
  return (M.sea = { sr, name, size, id, nx, ny, ST });
}
export const seaName = (M, s) => seas(M).name[s] || 'море';
export const isPort = (S, r) => S.M.reg[r].f.includes('p');
const dist = (M, a, b) => Math.hypot(M.reg[a].x - M.reg[b].x, M.reg[a].y - M.reg[b].y);
// господство на море — по силе флотов (fleet.js): ×0,6 без флота … ×1,4 при полном господстве; на Каспии флота Оси нет
export function seaK(S, side, s) {
  const n = seaName(S.M, s);
  if (n === 'Каспийское море') return side === 'GER' ? 0 : 1;
  const d = seaDom(S, n, side);
  return d === null ? 1 : 0.6 + 0.8 * d;
}
export const OPS = {
  sea: { n: 'Морской десант', ic: 'landing', max: 3, range: 650, cd: 4, k: 0.5, fail: 12, tech: 'Морская пехота' },
  abn: { n: 'Воздушный десант', ic: 'para', max: 2, range: 380, cd: 3, k: 0.6, fail: 20, tech: 'Воздушно-десантные войска' },
};
const fullMp = (u) => u.mp >= TYPES[u.t].mp * WK * 0.9 - 1e-6; // очки хода целиком (TYPES — за неделю)
export function opUnits(S, side, kind, r) {
  const ok = (u) => alive(u) && u.s === side && !u.att && fullMp(u) && (kind === 'sea' ? !isMech(u) && u.t !== 'cav' && u.t !== 'sec' && u.rdy >= 50 && u.str >= 40 : u.t === 'abn' && u.rdy >= 60 && u.str >= 50);
  return S.at[r].filter(ok).sort((a, b) => b.str - a.str).slice(0, OPS[kind].max);
}
// почему нельзя начать операцию из области r (или null)
export function opWhy(S, side, kind, r) {
  const O = OPS[kind];
  if (S.peace || !foesOf(S, side).some((f) => atWar(S, side, f))) return 'мирное время: десанты — с началом войны';
  if (!hasU(S, side, kind)) return `нужна наука: «${O.tech}»`;
  if (sideOf(S, r) !== side) return 'не наша область';
  if (kind === 'sea' && !isPort(S, r)) return 'нужен порт';
  if (kind === 'abn' && !S.afd[r]) return 'нужен аэродром';
  if ((S.sup[side]?.[r] ?? 0) <= 0) return 'нет снабжения';
  const cd = S.opCd?.[side]?.[kind] ?? -1;
  if (cd > S.turn) return `готовится: ещё ${turnsW(cd - S.turn)}`;
  if (!opUnits(S, side, kind, r).length) return kind === 'sea' ? 'нет готовой пехоты (полные ходы, готовность от 50 %)' : 'нет готовых дивизий ВДВ';
  if (!opTargets(S, side, kind, r).length) return 'нет целей в досягаемости';
  return null;
}
export function opTargets(S, side, kind, r) {
  const M = S.M, out = [], en = (t) => hostile(side, sideOf(S, t));
  if (kind === 'sea') {
    const sr = seas(M).sr, my = (sr[r] || []).filter((s) => seaK(S, side, s) > 0);
    if (!my.length) return out;
    for (let t = 0; t < M.R; t++) if (t !== r && en(t) && sr[t]?.some((s) => my.includes(s)) && dist(M, r, t) <= OPS.sea.range) out.push(t);
  } else for (let t = 0; t < M.R; t++) if (t !== r && en(t) && dist(M, r, t) <= OPS.abn.range) out.push(t);
  return out;
}
const seaOf = (S, r, t) => { const sr = seas(S.M).sr; return (sr[r] || []).find((s) => sr[t]?.includes(s)); };
// сила операции: ×k (+ наука), на море — господство флота; ВДВ без прикрытия ВВС несут потери ещё в воздухе
export function opK(S, side, kind, r, t) { return (OPS[kind].k + unV(S, side, 'opK')) * (kind === 'sea' ? seaK(S, side, seaOf(S, r, t)) : 1); }
// ВДВ: потери от истребителей (при слабой своей авиации) и от ПВО противника в области и по соседству
const defSide = (S, side, t) => { const d = sideOf(S, t); return d && d !== side ? d : other(side); }; // обороняющаяся сторона области t
export const airLoss = (S, side, t) => { const ar = airRatio(S, side, S.M.reg[t].z); return Math.round(Math.max(0, (0.35 - ar) / 0.35) * 30 + aaCover(S, t, defSide(S, side, t)) * 30); };
// береговая оборона (батареи, тыловые части): в порту сильнее; воздушный десант на пустую область — без боя
export const coastDef = (S, side, kind, t) => (kind === 'sea' ? (isPort(S, t) ? 2.5 : 0.8) * quality(defSide(S, side, t), S.turn) : 0);
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
  if (res.win) (S.bridge ??= {})[t] = S.turn + wT(kind === 'sea' ? 5 : 3);
  ((S.opCd ??= {})[side] ??= {})[kind] = S.turn + wT(O.cd);
  note(S, { ic: O.ic, side, txt: `${O.n}: ${nm} — ${res.win ? (res.free ? 'высадка без боя' : 'плацдарм захвачен') : 'отбит'}`, r: t });
  computeSupply(S, side); for (const sd of sidesOf(S)) if (sd !== side) computeSupply(S, sd);
  return res;
}
