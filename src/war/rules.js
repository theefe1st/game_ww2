// «Фронт 1941–1945» (v0.9): правила без DOM — даты и погода, стороны и нации, движение и зоны контроля,
// бой (люди, орудия, танки, организация, опыт, местность, реки, города, окопы, погода, соседи, авиация),
// снабжение от станций по железным дорогам (немцы перешивают колею), порты, Ладога, крепости, котлы.
export const D0 = Date.UTC(1941, 5, 22);
export const DAY = 86400000;
const MON = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
const MON3 = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
export const dateOf = (d) => new Date(D0 + d * DAY);
export const dayOf = (iso) => Math.round((Date.parse(iso + 'T00:00:00Z') - D0) / DAY);
export const fmtDate = (d, short = false) => {
  const t = dateOf(d);
  return short ? `${t.getUTCDate()} ${MON3[t.getUTCMonth()]}` : `${t.getUTCDate()} ${MON[t.getUTCMonth()]} ${t.getUTCFullYear()}`;
};
export const fmtDM = (d) => `${t2(dateOf(d).getUTCDate())}.${t2(dateOf(d).getUTCMonth() + 1)}`;
const t2 = (n) => String(n).padStart(2, '0');
export const yearF = (d) => 1941 + (172 + d) / 365.25; // дробный год (22.06.1941 ≈ 1941.47)

// ——— случайные числа (сохраняются в состоянии) ———
export function rnd(S) {
  let t = (S.rs = (S.rs + 0x6d2b79f5) >>> 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const gauss = (S) => (rnd(S) + rnd(S) + rnd(S) - 1.5) / 0.5; // ≈ N(0, 1)

// ——— стороны и нации ———
export const SIDES = ['GER', 'SOV'];
export const other = (s) => (s === 'GER' ? 'SOV' : 'GER');
export const SIDE_N = { GER: 'Германия', SOV: 'СССР' };
export const NAT_N = { GER: 'Германия', SOV: 'СССР', FIN: 'Финляндия', ROM: 'Румыния', HUN: 'Венгрия', ITA: 'Италия', SVK: 'Словакия', BUL: 'Болгария', CRO: 'Хорватия' };
export const NAT_A = { GER: 'немецкая', SOV: 'советская', FIN: 'финская', ROM: 'румынская', HUN: 'венгерская', ITA: 'итальянская', SVK: 'словацкая' };
// сторона нации на 22.06.1941 (null — нейтральные и прочие державы: туда войска не входят)
export const NSIDE0 = { GER: 'GER', FIN: 'GER', ROM: 'GER', HUN: 'GER', ITA: 'GER', SVK: 'GER', CRO: 'GER', SOV: 'SOV' };
export const sideOfH = (S, h) => S.nside[S.own[h]] || null;
export const natIdx = (S, nat) => S.M.nations.indexOf(nat);

// ——— типы дивизий ———
export const TYPES = {
  inf: { n: 'пехота', sym: 'inf', mp: 10, mech: 0 },
  mtn: { n: 'горная', sym: 'inf', mp: 10, mech: 0 },
  sec: { n: 'охранная', sym: 'inf', mp: 9, mech: 0 },
  gar: { n: 'гарнизон', sym: 'inf', mp: 8, mech: 0 },
  cav: { n: 'кавалерия', sym: 'cav', mp: 15, mech: 0 },
  mot: { n: 'моторизованная', sym: 'mot', mp: 22, mech: 1 },
  arm: { n: 'танковая', sym: 'arm', mp: 22, mech: 1 },
};
export const isMech = (u) => TYPES[u.t].mech === 1;
export const alive = (u) => !u.dead && u.h >= 0;

// ——— погода: сухо, распутица, снег, морозы; три широтные зоны ———
export const WX = {
  dry: { n: 'Сухо', ic: '☀', mv: 1, mvM: 1, atk: 1, air: 1, sup: 1 },
  rain: { n: 'Дожди', ic: '🌧', mv: 1.25, mvM: 1.35, atk: 0.92, air: 0.6, sup: 0.85 },
  mud: { n: 'Распутица', ic: '≋', mv: 1.9, mvM: 2.2, atk: 0.72, air: 0.35, sup: 0.55 },
  snow: { n: 'Снег', ic: '❄', mv: 1.4, mvM: 1.5, atk: 0.9, air: 0.65, sup: 0.8 },
  frost: { n: 'Морозы', ic: '✱', mv: 1.3, mvM: 1.45, atk: 0.85, air: 0.55, sup: 0.75 },
};
// календарь по зонам: [день года начала, погода] (день года 0 = 1 января); сдвиг года — ±6 дней
const CAL = [
  [[0, 'frost'], [60, 'snow'], [95, 'mud'], [135, 'dry'], [262, 'rain'], [276, 'mud'], [306, 'snow'], [330, 'frost']], // север
  [[0, 'frost'], [62, 'snow'], [80, 'mud'], [122, 'dry'], [272, 'rain'], [280, 'mud'], [312, 'snow'], [338, 'frost']], // центр
  [[0, 'frost'], [45, 'snow'], [66, 'mud'], [106, 'dry'], [284, 'rain'], [292, 'mud'], [328, 'snow'], [352, 'frost']], // юг
];
export function weather(S, zone, d = S.day) {
  const t = dateOf(d), y = t.getUTCFullYear(), doy = Math.floor((t - Date.UTC(y, 0, 1)) / DAY);
  const sh = S.wxShift[(y - 1941) % S.wxShift.length] || 0;
  const cal = CAL[zone];
  let w = cal[0][1];
  for (const [d0, k] of cal) if (doy >= d0 + (d0 > 0 ? sh : 0)) w = k;
  // в сухой сезон — редкие дожди (детерминированно по дню и зоне)
  if (w === 'dry' && ((d * 7 + zone * 13 + S.seed) % 23) === 0) w = 'rain';
  return w;
}
export const wxOf = (S, h) => WX[S.wx[S.M.zone[h]]];
// первая военная зима: немецкая армия без зимнего обмундирования
export const winter41 = (S) => S.day >= dayOf('1941-11-20') && S.day <= dayOf('1942-03-10');

// ——— качество войск по годам (интерполяция) ———
const QT = {
  GER: [[1941.4, 1.2], [1941.75, 1.18], [1942.0, 1.1], [1942.6, 1.15], [1943.0, 1.1], [1943.6, 1.06], [1944.4, 1.0], [1945.0, 0.93], [1945.5, 0.88]],
  SOV: [[1941.4, 0.8], [1941.75, 0.82], [1942.0, 0.86], [1942.6, 0.88], [1943.0, 0.97], [1943.6, 1.03], [1944.4, 1.1], [1945.0, 1.14], [1945.5, 1.16]],
  FIN: [[1941.4, 1.15], [1945.5, 1.1]],
  ROM: [[1941.4, 0.68], [1942.9, 0.66], [1944.6, 0.62]],
  HUN: [[1941.4, 0.7], [1945.5, 0.68]],
  ITA: [[1941.4, 0.66], [1945.5, 0.64]],
  SVK: [[1941.4, 0.65], [1945.5, 0.62]],
};
function lerpT(T, x) {
  if (x <= T[0][0]) return T[0][1];
  for (let i = 1; i < T.length; i++) if (x <= T[i][0]) return T[i - 1][1] + ((T[i][1] - T[i - 1][1]) * (x - T[i - 1][0])) / (T[i][0] - T[i - 1][0]);
  return T[T.length - 1][1];
}
export const quality = (S, nat) => lerpT(QT[nat] || QT.GER, yearF(S.day));
// качество танков (на одну машину): у РККА 1941 г. — устаревшие Т-26/БТ, потом Т-34; у вермахта — «Пантеры» и «Тигры»
const TQ = { GER: [[1941.4, 1.0], [1942.5, 1.05], [1943.5, 1.3], [1945.5, 1.35]], SOV: [[1941.4, 0.42], [1942.0, 0.7], [1942.8, 0.85], [1944.2, 1.0], [1945.5, 1.05]] };
export const tankQ = (S, side) => lerpT(TQ[side] || TQ.GER, yearF(S.day));

// ——— сила дивизии ———
export const cvRaw = (S, u) => u.men / 1000 + u.gun / 40 + (u.tnk * tankQ(S, u.side)) / 15;
export const orgF = (u) => 0.45 + 0.55 * Math.max(0, u.org) / 100;
export const xpF = (u) => 1 + u.xp / 300;
export const supF = (u) => (u.oos <= 0 ? 1 : u.oos <= 2 ? 0.9 : u.oos <= 5 ? 0.72 : 0.5);
export const moraleF = (S, side) => 0.86 + (0.26 * Math.max(0, S.morale[side])) / 130;
export const DIFF = ['Лёгкая', 'Нормальная', 'Тяжёлая'];
const DCB = { pl: [1.15, 1, 0.92], ai: [0.9, 1, 1.08] };
export const diffK = (S, side, k = 'cb') => (k === 'cb' ? DCB : { pl: [1.12, 1, 0.94], ai: [0.94, 1, 1.05] })[side === S.side ? 'pl' : 'ai'][S.diff];
// генерал армии: уровень и черты
export function genOf(S, u) {
  const H = S.hqs[u.hq];
  return H ? S.G[H.gen] : null;
}
const hasTr = (g, t) => g && g.tr.includes(t);
// местность: множитель обороны и штраф танкам
export const TERR_DEF = [1, 1, 1, 1.35, 1.4, 1.9, 1.5, 0.95, 1.2];
const ARMOR_TERR = [1, 1, 1, 0.55, 0.75, 0.4, 0.45, 1.1, 0.7];
// укрепрайоны больших городов: Москва, Ленинград, Сталинград, Тула (hard), Киевский УР
const HARD = { Ленинград: 2.8, Москва: 2.4, Киев: 1.7 };
export const cityDef = (c) => (c ? (c.sz === 3 ? 1.5 : c.sz === 2 ? 1.3 : 1.15) * (c.hard ? HARD[c.n] || 2.1 : HARD[c.n] || 1) : 1);

export function airF(S, side) {
  const a = S.air?.[side] ?? 0.5; // доля превосходства в воздухе 0–1
  return 1 + 0.3 * (a - 0.5);
}
// сила атакующего по гексу h (с учётом реки на ребре a.h → h)
export function atkVal(S, u, h, from = u.h) {
  const M = S.M, g = genOf(S, u), w = wxOf(S, h), t = M.terr[h];
  let v = (u.men / 1000 + u.gun / 40) + ((u.tnk * tankQ(S, u.side)) / 15) * ARMOR_TERR[t] * (w === WX.mud ? 0.6 : 1);
  v *= quality(S, u.nat) * orgF(u) * xpF(u) * supF(u) * moraleF(S, u.side) * airF(S, u.side) * diffK(S, u.side);
  v *= w.atk;
  if (g) {
    v *= 1 + (g.sk - 3) * 0.03;
    if (hasTr(g, 'atk')) v *= 1.08;
    if (hasTr(g, 'tank') && isMech(u)) v *= 1.12;
    if (hasTr(g, 'mtn') && (t === 3 || t === 5 || t === 6)) v *= 1.15;
    if (hasTr(g, 'cav') && u.t === 'cav') v *= 1.2;
  }
  if (u.side === 'GER' && u.nat === 'GER' && winter41(S) && S.wx[M.zone[h]] === 'frost') v *= 0.62;
  else if (u.side === 'GER' && S.wx[M.zone[h]] === 'frost') v *= 0.9;
  if (u.side === 'SOV' && (S.wx[M.zone[h]] === 'frost' || S.wx[M.zone[h]] === 'snow')) v *= 1.06;
  const d = M.dirTo(from, h);
  if (d >= 0 && M.river(from, d)) v *= M.bigRiver(from, d) ? 0.55 : 0.75;
  if (u.ral) v *= 0.5; // только что выгрузилась с поезда
  return v * (S.ev?.fx?.[u.side + 'atk'] || 1);
}
export function defVal(S, u) {
  const M = S.M, h = u.h, g = genOf(S, u), t = M.terr[h], c = M.cityAt[h] >= 0 ? M.cities[M.cityAt[h]] : null;
  let v = cvRaw(S, u) * quality(S, u.nat) * orgF(u) * xpF(u) * supF(u) * moraleF(S, u.side) * Math.sqrt(airF(S, u.side)) * diffK(S, u.side);
  v *= TERR_DEF[t] * (1 + 0.15 * u.ent) * cityDef(c);
  if (c && c.fort && S.fst[c.k] > 0 && sideOfH(S, h) === u.side) v *= 1.6;
  if (g) {
    v *= 1 + (g.sk - 3) * 0.03;
    if (hasTr(g, 'def')) v *= 1.08;
    if (hasTr(g, 'mtn') && (t === 3 || t === 5 || t === 6)) v *= 1.15;
  }
  if (u.side === 'GER' && u.nat === 'GER' && winter41(S) && S.wx[M.zone[h]] === 'frost') v *= c ? 0.9 : 0.78;
  const fx = S.ev?.fx;
  if (fx) {
    if (fx[u.side + 'def']) v *= fx[u.side + 'def'];
    if (u.nat !== u.side && fx[u.nat + 'def']) v *= fx[u.nat + 'def'];
  }
  return v;
}

// ——— юниты на гексах ———
export function reindex(S) {
  const at = (S.at = new Map());
  for (const u of S.units) if (alive(u)) (at.get(u.h) || at.set(u.h, []).get(u.h)).push(u);
}
export const unitsAt = (S, h) => S.at.get(h) || [];
export const stackN = (S, h) => unitsAt(S, h).length;
export const STACK = 3;
const setAt = (S, u, h) => {
  if (u.h >= 0) {
    const a = S.at.get(u.h);
    if (a) {
      const i = a.indexOf(u);
      if (i >= 0) a.splice(i, 1);
      if (!a.length) S.at.delete(u.h);
    }
  }
  u.h = h;
  if (h >= 0) (S.at.get(h) || S.at.set(h, []).get(h)).push(u);
};
export const placeAt = setAt;
export const enemyAt = (S, h, side) => {
  const a = S.at.get(h);
  return !!(a && a.length && a[0].side !== side);
};
// гекс соседствует с войсками противника (зона контроля)
export function zoc(S, h, side) {
  const nb = S.M.nb;
  for (let d = 0; d < 6; d++) {
    const j = nb[h * 6 + d];
    if (j >= 0 && enemyAt(S, j, side)) return true;
  }
  return false;
}
export function enemyNear(S, h, side) {
  let n = 0;
  const nb = S.M.nb;
  for (let d = 0; d < 6; d++) {
    const j = nb[h * 6 + d];
    if (j >= 0 && enemyAt(S, j, side)) n += S.at.get(j).length;
  }
  return n;
}
// проходимость: суша своей стороны или противника (нейтралы и море закрыты)
export const passable = (S, h) => S.M.terr[h] >= 2 && !!S.nside[S.own[h]];

// ——— движение ———
const TC = [99, 99, 10, 14, 14, 22, 18, 9, 14];
export const dailyMP = (S, u) => {
  let m = TYPES[u.t].mp;
  if (isMech(u) && u.side === 'GER' && S.eco?.GER?.fuel < 0) m *= 0.6;
  if (isMech(u) && u.side === 'SOV' && S.eco?.SOV?.fuel < 0) m *= 0.7;
  if (u.oos > 3) m *= 0.7;
  return m;
};
export function stepCost(S, u, a, b) {
  const M = S.M, t = M.terr[b], w = WX[S.wx[M.zone[b]]], mech = isMech(u);
  let c = TC[t];
  if (mech && (t === 3 || t === 6 || t === 5)) c *= 1.25;
  const d = M.dirTo(a, b);
  if (d >= 0 && M.river(a, d)) c += M.bigRiver(a, d) ? 8 : 4;
  // вдоль железной дороги по своей земле — быстрее (дороги идут рядом)
  if (d >= 0 && M.railDir(a, d) && sideOfH(S, a) === u.side && sideOfH(S, b) === u.side) c *= 0.75;
  c *= mech ? w.mvM : w.mv;
  if (sideOfH(S, b) !== u.side) c += 2;
  return c;
}
// достижимые гексы: Map hex → {c: затраты, p: предыдущий}
export function reach(S, u, mp = u.mp) {
  const R = new Map([[u.h, { c: 0, p: -1 }]]);
  if (mp <= 0 || u.gar) return R;
  const M = S.M, side = u.side, mech = isMech(u), q = [[0, u.h]];
  while (q.length) {
    let bi = 0;
    for (let i = 1; i < q.length; i++) if (q[i][0] < q[bi][0]) bi = i;
    const [c0, h] = q[bi];
    q[bi] = q[q.length - 1];
    q.pop();
    if (R.get(h).c < c0) continue;
    // в зоне контроля противника пехота останавливается (кроме стартового гекса)
    if (h !== u.h && !mech && zoc(S, h, side)) continue;
    for (let d = 0; d < 6; d++) {
      const j = M.nb[h * 6 + d];
      if (j < 0 || !passable(S, j) || enemyAt(S, j, side)) continue;
      let c = c0 + stepCost(S, u, h, j);
      if (mech && zoc(S, j, side)) c += 6;
      if (c > mp) continue;
      const o = R.get(j);
      if (!o || o.c > c) R.set(j, { c, p: h }), q.push([c, j]);
    }
  }
  return R;
}
export function pathTo(R, h) {
  const out = [];
  for (let x = h; x >= 0; x = R.get(x)?.p ?? -1) out.unshift(x);
  return out;
}
// куда можно встать (лимит стопки)
export const canEnd = (S, u, h) => h === u.h || stackN(S, h) < STACK;
// захват гекса
export function capture(S, h, side, nat) {
  const prev = S.own[h], ps = S.nside[prev];
  if (ps === side) return false;
  const ni = natIdx(S, side === 'SOV' ? 'SOV' : nat === 'FIN' || nat === 'ROM' ? nat : 'GER');
  // финны и румыны берут «свою» землю, прочие союзники — под немецкую администрацию
  S.own[h] = ni;
  S.ver++;
  if (S.M.rail[h]) S.rok[h] = rnd(S) < (side === 'GER' && S.day < 30 ? 0.2 : 0.06) ? 1 : 0;
  const ci = S.M.cityAt[h];
  if (ci >= 0) S.today.cities.push({ k: ci, side, from: ps });
  return true;
}
export function doMove(S, u, path) {
  if (path.length < 2) return;
  const R = reach(S, u);
  const last = path[path.length - 1], o = R.get(last);
  if (!o) return;
  for (let i = 1; i < path.length; i++) capture(S, path[i], u.side, u.nat);
  u.mp = Math.max(0, u.mp - o.c);
  if (!isMech(u) && zoc(S, last, u.side)) u.mp = 0;
  setAt(S, u, last);
  u.mv = 1;
  u.ent = 0;
  if (isMech(u)) u.fuelUse = (u.fuelUse || 0) + path.length - 1;
}

// ——— железная дорога: перешивка колеи и ремонт, переброски ———
// гекс годен для своей стороны: своя земля, есть путь, исправен (перешит)
export const railOK = (S, h, side) => S.M.rail[h] && S.rok[h] && sideOfH(S, h) === side;
// источники снабжения: глубокий тыл (исходная территория Оси / восток СССР), порты
export function isSource(S, h, side) {
  const M = S.M;
  if (!M.rail[h] || sideOfH(S, h) !== side) return false;
  return side === 'GER' ? S.src.GER[h] === 1 : S.src.SOV[h] === 1;
}
// сеть годных путей, связанная с тылом: Int16Array расстояний по ж/д (−1 — вне сети)
export function railNet(S, side) {
  const M = S.M, N = M.N, D = new Int16Array(N).fill(-1);
  let q = [];
  for (let h = 0; h < N; h++) if (railOK(S, h, side) && isSource(S, h, side)) (D[h] = 0), q.push(h);
  // порты: морской подвоз
  for (const p of S.ports[side] || []) if (railOK(S, p, side) && D[p] < 0) (D[p] = 0), q.push(p);
  while (q.length) {
    const nq = [];
    for (const h of q)
      for (let d = 0; d < 6; d++) {
        if (!((M.rail[h] >> d) & 1)) continue;
        const j = M.nb[h * 6 + d];
        if (j < 0 || D[j] >= 0 || !railOK(S, j, side)) continue;
        D[j] = D[h] + 1;
        nq.push(j);
      }
    q = nq;
  }
  return D;
}
// ремонт и перешивка: k гексов в день — ближайшие к фронту на границе годной сети
export function repairRail(S, side, k) {
  const M = S.M, N = M.N, net = railNet(S, side), cand = [];
  for (let h = 0; h < N; h++) {
    if (!M.rail[h] || S.rok[h] || sideOfH(S, h) !== side) continue;
    let ok = false;
    for (let d = 0; d < 6 && !ok; d++) if ((M.rail[h] >> d) & 1) {
      const j = M.nb[h * 6 + d];
      if (j >= 0 && net[j] >= 0) ok = true;
    }
    if (ok) cand.push(h);
  }
  if (!cand.length) return 0;
  const fd = S.frontDist?.[side];
  cand.sort((a, b) => (fd ? fd[a] - fd[b] : 0));
  let n = 0;
  for (const h of cand.slice(0, k)) (S.rok[h] = 1), n++;
  if (n) S.ver++;
  return n;
}

// ——— снабжение ———
// уровень по гексам: 2 — полное, 1 — частичное, 0 — нет; dist — расстояние подвоза от станции
const SUPC = [99, 99, 1, 1.5, 1.5, 2, 2, 1, 1.5];
export function supplyMap(S, side) {
  const M = S.M, N = M.N, net = railNet(S, side), L = new Uint8Array(N), dist = new Float32Array(N).fill(99);
  const base = side === 'GER' ? (S.day < 140 ? 5 : 4.5) : S.day >= dayOf('1943-03-01') ? 4.5 : 3.5; // грузовики: ленд-лиз «студебеккеры» с 1943 г.
  const q = [];
  for (let h = 0; h < N; h++) if (net[h] >= 0) (dist[h] = 0), q.push(h);
  // Дейкстра по своей земле (простая очередь со вставкой: дешёвые рёбра ≤ 2)
  let head = 0;
  const qq = q.slice();
  while (head < qq.length) {
    const h = qq[head++], c0 = dist[h];
    for (let d = 0; d < 6; d++) {
      const j = M.nb[h * 6 + d];
      if (j < 0 || M.terr[j] < 2 || sideOfH(S, j) !== side) continue;
      const w = WX[S.wx[M.zone[j]]];
      const c = c0 + SUPC[M.terr[j]] / w.sup + (M.river(h, d) ? 0.5 : 0);
      if (c < dist[j] && c <= base + 3.5) (dist[j] = c), qq.push(j);
    }
  }
  for (let h = 0; h < N; h++) L[h] = dist[h] <= base ? 2 : dist[h] <= base + 3 ? 1 : 0;
  // частичные источники: порты Чёрного моря, Ладога для Ленинграда
  for (const [p, r, lv] of S.partial[side] || [])
    for (const h of M.ring ? M.ring(p, r) : []) if (sideOfH(S, h) === side && L[h] < lv) L[h] = lv;
  return { L, dist, net };
}

// ——— бой ———
export function attackers(S, tgt, side, filter = () => true) {
  const out = [], nb = S.M.nb;
  for (let d = 0; d < 6; d++) {
    const j = nb[tgt * 6 + d];
    if (j < 0) continue;
    for (const u of unitsAt(S, j)) if (u.side === side && canAttack(S, u) && filter(u)) out.push(u);
  }
  return out;
}
export const canAttack = (S, u) => alive(u) && !u.at && u.org >= 12 && u.t !== 'gar' && !u.ral && u.mp > 0;
export function odds(S, att, tgt) {
  const ds = unitsAt(S, tgt);
  if (!ds.length) return { A: 0, D: 0, R: 99 };
  let A = 0, D = 0;
  for (const a of att) A += atkVal(S, a, tgt);
  for (const d of ds) D += defVal(S, d);
  // окружённый со всех сторон обороняется хуже
  const sur = encircled(S, tgt, ds[0].side);
  if (sur) D *= 0.8;
  return { A, D: Math.max(0.01, D), R: A / Math.max(0.01, D), sur };
}
const SIG = 0.42, TH_PUSH = Math.log(1.3);
const Phi = (x) => 1 / (1 + Math.exp(-1.702 * x));
// прогноз: соотношение, шанс отбросить, ожидаемые потери
export function forecast(S, att, tgt) {
  const o = odds(S, att, tgt), R = o.R;
  const chance = Phi((Math.log(R) - TH_PUSH) / SIG);
  const ds = unitsAt(S, tgt);
  const dl = lossFrac(R, 0), al = lossFrac(R, 1);
  const dMen = ds.reduce((s, d) => s + d.men, 0), aMen = att.reduce((s, a) => s + a.men, 0);
  return { ...o, chance, lossA: Math.round(aMen * al), lossD: Math.round(dMen * dl * (0.6 + 0.6 * chance)) };
}
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
function lossFrac(R, att) {
  return att ? clamp(0.018 * Math.pow(R, -0.6), 0.004, 0.12) : clamp(0.022 * Math.pow(R, 0.5), 0.008, 0.12);
}
// гекс окружён: нет выхода в свою или пустую не-вражескую землю
export function encircled(S, h, side) {
  const nb = S.M.nb;
  for (let d = 0; d < 6; d++) {
    const j = nb[h * 6 + d];
    if (j >= 0 && passable(S, j) && sideOfH(S, j) === side && !enemyAt(S, j, side)) return false;
  }
  return true;
}
function hurt(S, u, f, kind) {
  f = clamp(f, 0, 1);
  const men = Math.round(u.men * f);
  u.men -= men;
  u.gun -= Math.round(u.gun * f * 0.8);
  u.tnk -= Math.round(u.tnk * Math.min(1, f * (kind === 'att' ? 1.4 : 1.2)));
  S.loss[u.side] += men;
  S.dayLoss[u.side] += men;
  // ранены ~ 60%, из них половина вернётся через месяц
  if (S.eco?.[u.side]) S.eco[u.side].wnd.push([S.day + 30, Math.round(men * 0.3)]);
  return men;
}
export function destroy(S, u, by, why = 'разгромлена') {
  S.loss[u.side] += u.men;
  S.dayLoss[u.side] += u.men;
  if (why === 'сдалась' || why === 'капитулировала') S.pow[u.side] += u.men;
  u.men = 0;
  u.dead = S.day + 1;
  u.why = why;
  setAt(S, u, -1);
  S.today.dead.push({ id: u.id, side: u.side, n: u.n, why, hq: u.hq });
}
// отход: соседний свой гекс без врага, с местом в стопке, подальше от противника
function retreatHex(S, u, from) {
  const M = S.M;
  let best = -1, bs = -1e9;
  for (let d = 0; d < 6; d++) {
    const j = M.nb[u.h * 6 + d];
    if (j < 0 || !passable(S, j) || sideOfH(S, j) !== u.side || enemyAt(S, j, u.side) || stackN(S, j) >= STACK) continue;
    let s = -enemyNear(S, j, u.side) * 3 + (S.supL?.[u.side]?.[j] || 0) * 2 - M.dist(j, from) * -1.5 + rnd(S) * 0.2;
    if (M.cityAt[j] >= 0) s += 0.5;
    if (s > bs) (bs = s), (best = j);
  }
  if (best >= 0) return best;
  // отход с боями на 2 гекса: через свою землю без противника (сосед может быть занят своими)
  for (let d = 0; d < 6; d++) {
    const j = M.nb[u.h * 6 + d];
    if (j < 0 || !passable(S, j) || sideOfH(S, j) !== u.side || enemyAt(S, j, u.side)) continue;
    for (let e = 0; e < 6; e++) {
      const k = M.nb[j * 6 + e];
      if (k < 0 || k === u.h || !passable(S, k) || sideOfH(S, k) !== u.side || enemyAt(S, k, u.side) || stackN(S, k) >= STACK) continue;
      const s = -enemyNear(S, k, u.side) * 3 + (S.supL?.[u.side]?.[k] || 0) * 2 + M.dist(k, from) * 1.5 + rnd(S) * 0.2;
      if (s > bs) (bs = s), (best = k);
    }
  }
  return best;
}
// атака: att — дивизии-участники, tgt — гекс. Возвращает итог для журнала и интерфейса.
export function doAttack(S, att, tgt) {
  att = att.filter((a) => canAttack(S, a));
  const ds = unitsAt(S, tgt).slice();
  if (!att.length || !ds.length) return null;
  const o = odds(S, att, tgt), R = o.R;
  const lr = Math.log(R) + gauss(S) * SIG;
  // большие города-крепости (Москва, Ленинград, Сталинград, Тула): уличные бои — выбить защитников труднее
  const ci = S.M.cityAt[tgt], hardC = ci >= 0 && S.M.cities[ci].hard && !o.sur;
  const push = lr > (hardC ? Math.log(2.2) : TH_PUSH), rout = lr > Math.log(hardC ? 4 : 3), crush = lr > Math.log(10);
  const dl = lossFrac(R, 0) * (push ? 1.15 : 0.85) * (rout ? 1.25 : 1) * (hardC ? 0.8 : 1), al = lossFrac(R, 1) * (push ? 0.85 : 1.15) * (hardC ? 1.6 : 1);
  let lossA = 0, lossD = 0;
  const sideD = ds[0].side;
  // потери атакующих — пропорционально вкладу
  const tot = att.reduce((s, a) => s + atkVal(S, a, tgt), 0) || 1;
  for (const a of att) {
    const share = atkVal(S, a, tgt) / tot;
    lossA += hurt(S, a, al * clamp(share * att.length, 0.5, 1.6), 'att');
    a.org = Math.max(0, a.org - (7 + 6 / Math.max(0.5, R)) * (push ? 0.8 : 1.2));
    a.at = 1;
    a.mp = Math.max(0, a.mp - (isMech(a) ? 8 : 99));
    a.xp = Math.min(100, a.xp + 1.5);
    a.ent = 0;
  }
  const out = { tgt, R, push, rout, retreated: [], killed: [], lossA: 0, lossD: 0, sideA: att[0].side, sideD, adv: null };
  for (const d of ds) {
    lossD += hurt(S, d, dl, 'def');
    d.org = Math.max(0, d.org - (6 + 4 * Math.min(R, 3)) * (push ? 1 : 0.6));
    d.xp = Math.min(100, d.xp + 1);
    if (d.men < 600 || (d.men < d.menM * 0.08 && d.tnk < 10)) {
      destroy(S, d, att[0].side);
      out.killed.push(d);
    }
  }
  if (push) {
    for (const d of unitsAt(S, tgt).slice()) {
      const r = retreatHex(S, d, att[0].h);
      // отступать некуда: крепкая дивизия держится в кольце (тяжёлые потери), слабая — сдаётся
      if (r < 0 && !crush && d.men > d.menM * 0.2 && rnd(S) < (d.org >= 15 ? 0.7 : 0.45)) {
        lossD += hurt(S, d, 0.06, 'def');
        d.org = Math.max(0, d.org - 10);
        continue;
      }
      if (r < 0 || crush) {
        // отступать некуда — плен или разгром
        if (r < 0 || rnd(S) < (d.org < 10 ? 0.25 : 0.08)) {
          lossD += d.men;
          destroy(S, d, att[0].side, r < 0 ? 'сдалась' : 'разбита');
          out.killed.push(d);
          continue;
        }
      }
      const g = genOf(S, d), k = g && g.tr.includes('ret') ? 0.5 : 1;
      if (rout) lossD += hurt(S, d, 0.03 * k, 'def');
      d.org = Math.max(0, d.org - (rout ? 12 : 6) * k);
      d.ent = 0;
      setAt(S, d, r);
      out.retreated.push(d);
    }
  }
  // продвижение: самая подвижная дивизия занимает освободившийся гекс
  if (!unitsAt(S, tgt).length && passable(S, tgt)) {
    const adv = att.filter((a) => alive(a) && a.org > 10).sort((a, b) => (isMech(b) - isMech(a)) || b.org - a.org)[0];
    if (adv) {
      capture(S, tgt, adv.side, adv.nat);
      setAt(S, adv, tgt);
      out.adv = adv;
    } else capture(S, tgt, att[0].side, att[0].nat);
  }
  out.lossA = lossA;
  out.lossD = lossD;
  S.today.fights++;
  S.today.battles.push(out);
  return out;
}

// ——— котлы: связные области своей земли без источника снабжения ———
export function pockets(S, side, supply) {
  const M = S.M, N = M.N, seen = new Uint8Array(N), out = [];
  const L = supply.L;
  for (let h0 = 0; h0 < N; h0++) {
    if (seen[h0] || !unitsAt(S, h0).some((u) => u.side === side) || L[h0] > 0) continue;
    // компонента своей земли без снабжения, содержащая войска
    const comp = [h0];
    seen[h0] = 1;
    let units = 0, big = null, i = 0;
    while (i < comp.length) {
      const h = comp[i++];
      for (const u of unitsAt(S, h)) if (u.side === side) units++;
      const ci = M.cityAt[h];
      if (ci >= 0 && (!big || M.cities[ci].sz > big.sz || (M.cities[ci].sz === big.sz && M.cities[ci].vp > big.vp))) big = M.cities[ci];
      for (let d = 0; d < 6; d++) {
        const j = M.nb[h * 6 + d];
        if (j < 0 || seen[j] || M.terr[j] < 2 || sideOfH(S, j) !== side || L[j] > 0) continue;
        seen[j] = 1;
        comp.push(j);
      }
    }
    if (units) out.push({ side, hexes: comp, units, city: big, h: comp[0] });
  }
  return out;
}
// название котла по крупнейшему городу или ближайшему
export function pocketName(S, p) {
  let c = p.city;
  if (!c) {
    let bd = 1e9;
    for (const x of S.M.cities) {
      const dd = S.M.dist(x.h, p.h);
      if (dd < bd) (bd = dd), (c = x);
    }
  }
  return `Котёл у ${gen(c ? c.n : '?')}`;
}
// родительный падеж названий городов (для «котёл у …», «бои за …» и т. п.)
const GEN_X = { Умань: 'Умани', Корсунь: 'Корсуни', Ярославль: 'Ярославля', 'Великие Луки': 'Великих Лук', Черкассы: 'Черкасс', Сумы: 'Сум', Шахты: 'Шахт', Ливны: 'Ливен', Мга: 'Мги', Москва: 'Москвы', Калуга: 'Калуги', Вязьма: 'Вязьмы', Рига: 'Риги', Лида: 'Лиды', Луга: 'Луги', 'Старая Русса': 'Старой Руссы', 'Белая Церковь': 'Белой Церкви', 'Малая Вишера': 'Малой Вишеры', 'Новая Ладога': 'Новой Ладоги', 'Лодейное Поле': 'Лодейного Поля', 'Кривой Рог': 'Кривого Рога', 'Старый Оскол': 'Старого Оскола', 'Каменец-Подольский': 'Каменец-Подольского', 'Новоград-Волынский': 'Новоград-Волынского', 'Новгород-Северский': 'Новгород-Северского', 'Могилёв-Подольский': 'Могилёва-Подольского', 'Ростов-на-Дону': 'Ростова-на-Дону', 'Калач-на-Дону': 'Калача-на-Дону', 'Франкфурт-на-Одере': 'Франкфурта-на-Одере', 'Бяла-Подляска': 'Бялы-Подляски', Мемель: 'Мемеля', Тильзит: 'Тильзита', Пиллау: 'Пиллау', Гумбиннен: 'Гумбиннена', Летцен: 'Летцена', Модлин: 'Модлина', Хелм: 'Хелма', Замосць: 'Замосця', Кельце: 'Кельце', Бромберг: 'Бромберга', Кюстрин: 'Кюстрина', Глогау: 'Глогау', Оппельн: 'Оппельна', Катовице: 'Катовице', 'Моравска-Острава': 'Моравской Остравы', Брно: 'Брно', Плоешти: 'Плоешти', Яссы: 'Ясс', Бакэу: 'Бакэу', Фокшаны: 'Фокшан', Галац: 'Галаца', Констанца: 'Констанцы', Крайова: 'Крайовы', Тимишоара: 'Тимишоары', Секешфехервар: 'Секешфехервара', Мишкольц: 'Мишкольца', Сегед: 'Сегеда', Кошице: 'Кошице', Ужгород: 'Ужгорода', Клуж: 'Клужа', Салла: 'Саллы', Петсамо: 'Петсамо', Йоэнсуу: 'Йоэнсуу', Оулу: 'Оулу', Рованиеми: 'Рованиеми', Ханко: 'Ханко', Тампере: 'Тампере', Хельсинки: 'Хельсинки', Тарту: 'Тарту', Пярну: 'Пярну', Елгава: 'Елгавы', Лиепая: 'Лиепаи', Даугавпилс: 'Даугавпилса', Резекне: 'Резекне', Шяуляй: 'Шяуляя', Паневежис: 'Паневежиса', Алитус: 'Алитуса', Сувалки: 'Сувалок', Лаппеэнранта: 'Лаппеэнранты', Суоярви: 'Суоярви', Перекоп: 'Перекопа', Джанкой: 'Джанкоя', Феодосия: 'Феодосии', Евпатория: 'Евпатории', Керчь: 'Керчи', Тихвин: 'Тихвина', Шлиссельбург: 'Шлиссельбурга', Кексгольм: 'Кексгольма', Нарва: 'Нарвы', Опочка: 'Опочки', Чудово: 'Чудово', Любань: 'Любани', Кириши: 'Киришей', Боровичи: 'Боровичей', Холм: 'Холма', Демянск: 'Демянска', Валдай: 'Валдая', Бологое: 'Бологого', Торжок: 'Торжка', Старица: 'Старицы', Сычёвка: 'Сычёвки', Ржев: 'Ржева', Гжатск: 'Гжатска', Можайск: 'Можайска', Юхнов: 'Юхнова', Малоярославец: 'Малоярославца', 'Наро-Фоминск': 'Наро-Фоминска', Серпухов: 'Серпухова', Кашира: 'Каширы', Коломна: 'Коломны', Сталиногорск: 'Сталиногорска', Алексин: 'Алексина', Белёв: 'Белёва', Ефремов: 'Ефремова', Елец: 'Ельца', Касторное: 'Касторного', Валуйки: 'Валуек', Россошь: 'Россоши', Острогожск: 'Острогожска', Лиски: 'Лисок', Борисоглебск: 'Борисоглебска', Калач: 'Калача', Богучар: 'Богучара', Кантемировка: 'Кантемировки', Морозовск: 'Морозовска', Тацинская: 'Тацинской', Обливская: 'Обливской', Суровикино: 'Суровикино', Котельниково: 'Котельниково', Зимовники: 'Зимовников', Сальск: 'Сальска', Тихорецк: 'Тихорецка', Армавир: 'Армавира', Туапсе: 'Туапсе', Сочи: 'Сочи', Черкесск: 'Черкесска', Пятигорск: 'Пятигорска', Нальчик: 'Нальчика', Моздок: 'Моздока', Орджоникидзе: 'Орджоникидзе', Махачкала: 'Махачкалы', Кизляр: 'Кизляра', Ворошиловск: 'Ворошиловска', Элиста: 'Элисты', Камышин: 'Камышина', Балашов: 'Балашова', Мичуринск: 'Мичуринска', Липецк: 'Липецка', Сызрань: 'Сызрани', Арзамас: 'Арзамаса', Муром: 'Мурома', Рыбинск: 'Рыбинска', Вологда: 'Вологды', Череповец: 'Череповца', Волхов: 'Волхова', Медвежьегорск: 'Медвежьегорска', Беломорск: 'Беломорска', Кемь: 'Кеми', Лоухи: 'Лоухов', Кандалакша: 'Кандалакши', Сортавала: 'Сортавалы', Выборг: 'Выборга', Красногвардейск: 'Красногвардейска', Кингисепп: 'Кингисеппа', Порхов: 'Порхова', Новгород: 'Новгорода', Батуми: 'Батуми', Сухуми: 'Сухуми', Кутаиси: 'Кутаиси', Кировабад: 'Кировабада', Ленинакан: 'Ленинакана', Котлас: 'Котласа', Киров: 'Кирова', Чебоксары: 'Чебоксар', Кострома: 'Костромы', Чернигов: 'Чернигова', 'Великий Устюг': 'Великого Устюга', Саранск: 'Саранска', Минск: 'Минска', Брест: 'Бреста', Ровно: 'Ровно', Дубно: 'Дубно', Пинск: 'Пинска', Белосток: 'Белостока', Гродно: 'Гродно', Слоним: 'Слонима', Барановичи: 'Барановичей', Волковыск: 'Волковыска', Мозырь: 'Мозыря', Жлобин: 'Жлобина', Бобруйск: 'Бобруйска', Борисов: 'Борисова', Орша: 'Орши', Полоцк: 'Полоцка', Невель: 'Невеля', Велиж: 'Велижа', Ярцево: 'Ярцева', Ельня: 'Ельни', Рославль: 'Рославля', Кричев: 'Кричева', Могилёв: 'Могилёва', Унеча: 'Унечи', Трубчевск: 'Трубчевска', Конотоп: 'Конотопа', Нежин: 'Нежина', Прилуки: 'Прилук', Лохвица: 'Лохвицы', Ромны: 'Ромен', Лубны: 'Лубен', Миргород: 'Миргорода', Кременчуг: 'Кременчуга', Канев: 'Канева', Бердичев: 'Бердичева', Житомир: 'Житомира', Коростень: 'Коростеня', Сарны: 'Сарн', Луцк: 'Луцка', Ковель: 'Ковеля', Броды: 'Брод', Тарнополь: 'Тарнополя', Перемышль: 'Перемышля', Стрый: 'Стрыя', Станислав: 'Станислава', Черновцы: 'Черновцов', Проскуров: 'Проскурова', Винница: 'Винницы', Бельцы: 'Бельц', Тирасполь: 'Тирасполя', Измаил: 'Измаила', Аккерман: 'Аккермана', Первомайск: 'Первомайска', Вознесенск: 'Вознесенска', Херсон: 'Херсона', Каховка: 'Каховки', Никополь: 'Никополя', Кировоград: 'Кировограда', Мелитополь: 'Мелитополя', Осипенко: 'Осипенко', Мариуполь: 'Мариуполя', Таганрог: 'Таганрога', Новочеркасск: 'Новочеркасска', Каменск: 'Каменска', Миллерово: 'Миллерово', Ворошиловград: 'Ворошиловграда', Артёмовск: 'Артёмовска', Славянск: 'Славянска', Изюм: 'Изюма', Барвенково: 'Барвенково', Лозовая: 'Лозовой', Купянск: 'Купянска', Чугуев: 'Чугуева', Красноград: 'Краснограда', Полтава: 'Полтавы', Ахтырка: 'Ахтырки', Белгород: 'Белгорода', Прохоровка: 'Прохоровки', Льгов: 'Льгова', Глухов: 'Глухова', Севск: 'Севска', Поныри: 'Понырей', Мценск: 'Мценска', Болхов: 'Болхова', Брянск: 'Брянска', Жиздра: 'Жиздры', Сухиничи: 'Сухиничей', Козельск: 'Козельска', Осташков: 'Осташкова', Торопец: 'Торопца', Волоколамск: 'Волоколамска', Клин: 'Клина', Дмитров: 'Дмитрова', Загорск: 'Загорска', Пенза: 'Пензы', Тамбов: 'Тамбова', Рязань: 'Рязани', Ульяновск: 'Ульяновска', Владимир: 'Владимира', Петрозаводск: 'Петрозаводска', Кронштадт: 'Кронштадта', Таллин: 'Таллина', Вильнюс: 'Вильнюса', Кишинёв: 'Кишинёва', Тбилиси: 'Тбилиси', Ереван: 'Еревана', Витебск: 'Витебска', Гомель: 'Гомеля', Львов: 'Львова', Николаев: 'Николаева', Запорожье: 'Запорожья', Сталино: 'Сталино', Курск: 'Курска', Орёл: 'Орла', Калинин: 'Калинина', Краснодар: 'Краснодара', Грозный: 'Грозного', Астрахань: 'Астрахани', Саратов: 'Саратова', Казань: 'Казани', Иваново: 'Иваново', Каунас: 'Каунаса', Архангельск: 'Архангельска', Одесса: 'Одессы', Севастополь: 'Севастополя', Воронеж: 'Воронежа', Смоленск: 'Смоленска', Тула: 'Тулы', Новороссийск: 'Новороссийска', Майкоп: 'Майкопа', Симферополь: 'Симферополя', Мурманск: 'Мурманска', Варшава: 'Варшавы', Берлин: 'Берлина', Прага: 'Праги', Вена: 'Вены', Будапешт: 'Будапешта', Бухарест: 'Бухареста', Кёнигсберг: 'Кёнигсберга', Краков: 'Кракова', Лодзь: 'Лодзи', Познань: 'Познани', Данциг: 'Данцига', Штеттин: 'Штеттина', Бреслау: 'Бреслау', Белград: 'Белграда', Таураге: 'Таураге', Инстербург: 'Инстербурга', Алленштейн: 'Алленштейна', Ломжа: 'Ломжи', Остроленка: 'Остроленки', Радом: 'Радома', Люблин: 'Люблина', Ярослав: 'Ярослава', Жешув: 'Жешува', Тарнов: 'Тарнова', Сандомир: 'Сандомира', Ченстохова: 'Ченстоховы', Торн: 'Торна', Гдыня: 'Гдыни', Эльбинг: 'Эльбинга', Штольп: 'Штольпа', Кольберг: 'Кольберга', Дрезден: 'Дрездена', Братислава: 'Братиславы', Дебрецен: 'Дебрецена', Брашов: 'Брашова', София: 'Софии', Варна: 'Варны' };
export function gen(n) {
  if (GEN_X[n]) return GEN_X[n];
  if (/(ий|ый)$/.test(n)) return n.replace(/(ий|ый)$/, 'ого');
  if (/[кгхжшчщ]а$/.test(n)) return n.slice(0, -1) + 'и';
  if (/а$/.test(n)) return n.slice(0, -1) + 'ы';
  if (/я$/.test(n)) return n.slice(0, -1) + 'и';
  if (/ь$/.test(n)) return n.slice(0, -1) + 'и';
  if (/й$/.test(n)) return n.slice(0, -1) + 'я';
  if (/[оеиуыэю]$/.test(n)) return n;
  return n + 'а';
}
