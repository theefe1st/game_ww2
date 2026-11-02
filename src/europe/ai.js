// «Европа 1939–1945» (v0.6.1): ИИ держав — «режиссёр» по датам и дивизии на карте провинций:
// авиаудары и артиллерия, последовательные удары по одной цели, захват пустых провинций,
// удержание фронта (в провинции одна дивизия), переброски, производство и наука.
import {
  G, reg, rnd, tDate, UT, AIR, MAXS, MECH, alive, ally, atWar, side, friendly, hostile, unitAt, supply, combat, attack, airStrike, canAir,
  moves, moveTo, attackTargets, amphTargets, railTargets, railMove, seaTargets, seaMove, orgMax, quality, buildSite, build, buildCost, canBuyAir, buyAir,
  canReinforce, reinforce, income, upkeep, techYear, MARITIME, navZones, touch,
} from './rules.js';


// ——— театры ———
export const AREA = {
  AFR: `tripoli sirte benghazi tobruk sollum matruh alamein alexandria cairo suez tunis gabes constantine algiers oran casablanca fes tetouan`,
  BALK: `belgrade zagreb ljubljana sarajevo split skopje athens salonika ioannina crete albania sofia plovdiv varna`,
  ITALY: `sicily calabria bari naples rome florence bologna genoa venice milan turin trieste sardinia corsica`,
  WEST: `lille normandy brittany nantes bordeaux toulouse marseille lyon dijon reims metz strasbourg orleans clermont grenoble paris brussels liege amsterdam koln saar ruhr frankfurt stuttgart hamburg hannover munich nuremberg leipzig berlin bern`,
  SOUTH: `kiev zhitomir vinnitsa proskurov odessa nikolaev dnepropetrovsk zaporozhye kharkov stalino voroshilovgrad poltava sumy kursk voronezh millerovo rostov stalingrad elista astrakhan krasnodar maikop stavropol grozny tbilisi baku crimea orel`,
  MOSCOW: `moscow kalinin rzhev vyazma tula bryansk orel kursk smolensk velikiye_luki tikhvin novgorod ryazan yaroslavl leningrad`,
  // полоса «Барбароссы»: от Балтики до Чёрного моря, не дальше Ленинграда, Москвы и Ростова
  EAST41: `riga tallinn kaunas wilno minsk bialystok brest lwow stanislawow rowne vitebsk mogilev bobruisk gomel smolensk pskov novgorod velikiye_luki tikhvin kalinin rzhev vyazma moscow tula bryansk orel kursk kharkov sumy poltava chernigov kiev zhitomir vinnitsa proskurov chernovtsy kishinev odessa nikolaev dnepropetrovsk zaporozhye stalino voroshilovgrad crimea rostov`,
};
const AR = (s) => s.split(` `);
// [держава, с хода, по ход, против ('*' — все враги), режим, параметры]
// режим: A — наступление, H — оборона (контрудары только за свои земли), S — расстановка (stage — сосредоточение, gar — гарнизоны)
export const DIR = [
  [`GER`, 0, 5, [`POL`], `A`, { obj: AR(`warsaw lodz krakow lwow`), need: 1.25 }],
  [`SVK`, 0, 5, [`POL`], `A`, {}],
  [`SOV`, 1, 5, [`POL`], `A`, { obj: AR(`lwow brest bialystok wilno rowne`), need: 1.2 }],
  [`GER`, 4, 15, null, `S`, { stage: { koln: 4, ruhr: 3, saar: 3, stuttgart: 2, frankfurt: 1 } }],
  [`FRA`, 0, 16, null, `S`, { stage: { lille: 2, reims: 3, metz: 3, strasbourg: 2, paris: 2, grenoble: 1, dijon: 1 } }],
  [`UK`, 1, 16, null, `S`, { stage: { lille: 3 } }],
  [`SOV`, 5, 12, [`FIN`], `A`, { obj: AR(`viipuri helsinki`), need: 1.1 }],
  [`GER`, 14, 19, [`NOR`, `DEN`], `A`, { obj: AR(`oslo narvik trondheim bergen`) }],
  [`GER`, 16, 26, [`FRA`, `UK`, `BEL`, `NED`], `A`, { obj: AR(`brussels amsterdam lille reims paris orleans dijon lyon bordeaux`), need: 1.2 }],
  [`ITA`, 18, 20, [`FRA`], `A`, { area: AR(`grenoble marseille`) }],
  [`GER`, 20, 200, null, `S`, { gar: { lille: 1, normandy: 1, oslo: 1, narvik: 1, paris: 1 } }],
  [`UK`, 18, 60, null, `S`, { gar: { london: 2, portsmouth: 1, gibraltar: 1, malta: 1 } }],
  [`ITA`, 18, 200, null, `S`, { gar: { sicily: 1, rome: 1 } }],
  [`ITA`, 24, 26, [`UK`], `A`, { area: AR(`sollum matruh`) }],
  [`ITA`, 27, 31, [`GRE`], `A`, { obj: AR(`ioannina athens`) }],
  [`GRE`, 28, 37, [`ITA`], `A`, { area: AR(`albania`) }],
  [`UK`, 30, 34, [`ITA`], `A`, { area: AR(`sollum matruh tobruk benghazi`), obj: AR(`tobruk benghazi`), need: 1.25 }],
  [`GER`, 30, 42, null, `S`, { stage: { konigsberg: 5, warsaw: 5, lublin: 6, krakow: 3, iasi: 3, presov: 1 } }],
  [`SOV`, 2, 42, null, `S`, { stage: { bialystok: 3, brest: 3, lwow: 3, rowne: 2, kaunas: 2, kishinev: 2, chernovtsy: 1, minsk: 2, kiev: 2, viipuri: 2, leningrad: 2, riga: 1, tallinn: 1, odessa: 1, murmansk: 1, petrozavodsk: 2, belomorsk: 1 } }],
  [`GER`, 34, 38, null, `S`, { stage: { graz: 3, sofia: 3, timisoara: 2, plovdiv: 1 } }],
  [`GER`, 37, 42, [`UK`], `A`, { area: AR(AREA.AFR), obj: AR(`benghazi tobruk sollum`) }],
  [`ITA`, 37, 42, [`UK`], `A`, { area: AR(AREA.AFR), obj: AR(`benghazi tobruk sollum`) }],
  [`GER`, 38, 42, [`YUG`, `GRE`, `UK`], `A`, { area: AR(AREA.BALK), obj: AR(`belgrade zagreb skopje salonika athens`), need: 1.2 }],
  [`ITA`, 38, 42, [`YUG`, `GRE`], `A`, { area: AR(AREA.BALK) }],
  [`HUN`, 38, 41, [`YUG`], `A`, {}],
  [`BUL`, 38, 41, [`YUG`, `GRE`], `A`, {}],
  [`UK`, 42, 45, [`VIC`], `A`, { area: AR(`damascus aleppo`) }],
  [`UK`, 47, 56, [`IRN`], `A`, { need: 1.2 }],
  [`SOV`, 47, 56, [`IRN`], `A`, { need: 1.2 }],
  [`GER`, 43, 49, [`SOV`], `A`, { area: AR(AREA.EAST41), obj: AR(`minsk smolensk kiev moscow kharkov rostov crimea dnepropetrovsk`), need: 1.12 }],
  [`GER`, 50, 54, [`SOV`], `A`, { area: AR(AREA.EAST41), obj: AR(`moscow kharkov rostov crimea tula kalinin`), need: 1.35 }],
  [`SOV`, 43, 65, null, `S`, { gar: { moscow: 3, leningrad: 3, kiev: 2, kharkov: 1, stalingrad: 1, rostov: 1, crimea: 1, murmansk: 1 } }],
  [`SOV`, 66, 200, null, `S`, { gar: { moscow: 3, leningrad: 3, stalingrad: 3, grozny: 2, baku: 2, astrakhan: 1, tbilisi: 1, voronezh: 1, murmansk: 1 } }],
  [`ROM`, 43, 53, [`SOV`], `A`, { area: AR(`kishinev chernovtsy odessa nikolaev crimea vinnitsa proskurov zaporozhye stalino`), obj: AR(`kishinev chernovtsy odessa nikolaev crimea`) }],
  [`HUN`, 43, 53, [`SOV`], `A`, { area: AR(`stanislawow chernovtsy proskurov vinnitsa zhitomir`) }],
  [`SVK`, 43, 53, [`SOV`], `A`, { area: AR(`lwow stanislawow proskurov rowne`) }],
  [`ITA`, 43, 53, [`SOV`], `A`, { area: AR(`vinnitsa nikolaev dnepropetrovsk zaporozhye stalino voroshilovgrad`) }],
  [`FIN`, 43, 44, [`SOV`], `H`, {}],
  [`FIN`, 45, 52, [`SOV`], `A`, { area: AR(`viipuri petrozavodsk kuopio`), obj: AR(`viipuri petrozavodsk`) }],
  [`UK`, 53, 56, [`ITA`, `GER`], `A`, { area: AR(`sollum matruh alamein tobruk benghazi`), obj: AR(`tobruk benghazi`) }],
  [`SOV`, 54, 60, `*`, `A`, { area: AR(AREA.MOSCOW + ` rostov stalino voroshilovgrad`), obj: AR(`kalinin rzhev vyazma tula orel tikhvin rostov kursk bryansk`), need: 1.35 }],
  [`GER`, 57, 60, [`UK`], `A`, { area: AR(AREA.AFR), obj: AR(`benghazi tobruk`) }],
  [`ITA`, 57, 60, [`UK`], `A`, { area: AR(AREA.AFR) }],
  [`SOV`, 62, 63, `*`, `A`, { area: AR(`kharkov sumy poltava voroshilovgrad stalino crimea`), obj: AR(`kharkov`) }],
  [`GER`, 61, 65, [`SOV`], `A`, { area: AR(`crimea kharkov sumy poltava zaporozhye stalino voroshilovgrad kursk`), obj: AR(`crimea kharkov`) }],
  [`GER`, 63, 70, [`UK`], `A`, { area: AR(AREA.AFR), obj: AR(`tobruk sollum matruh alamein alexandria`) }],
  [`ITA`, 63, 70, [`UK`], `A`, { area: AR(AREA.AFR) }],
  [`GER`, 66, 79, [`SOV`], `A`, { area: AR(AREA.SOUTH), obj: AR(`voronezh rostov stalingrad maikop krasnodar grozny`), need: 1.25 }],
  [`ROM`, 66, 79, [`SOV`], `A`, { area: AR(`crimea krasnodar stalingrad elista rostov millerovo`) }],
  [`HUN`, 66, 79, [`SOV`], `A`, { area: AR(`voronezh kursk millerovo voroshilovgrad`) }],
  [`ITA`, 66, 79, [`SOV`], `A`, { area: AR(`millerovo voroshilovgrad rostov`) }],
  [`UK`, 75, 200, [`ITA`, `GER`, `VIC`], `A`, { area: AR(AREA.AFR), obj: AR(`tobruk benghazi tripoli gabes tunis`), need: 1.3 }],
  [`USA`, 76, 200, [`ITA`, `GER`, `VIC`], `A`, { area: AR(AREA.AFR), obj: AR(`tunis gabes`), need: 1.3 }],
  [`SOV`, 77, 86, `*`, `A`, { obj: AR(`stalingrad millerovo rostov voronezh kursk kharkov krasnodar maikop stavropol elista`), need: 1.3 }],
  [`GER`, 84, 85, [`SOV`], `A`, { area: AR(`kharkov sumy poltava stalino voroshilovgrad`), obj: AR(`kharkov`) }],
  [`GER`, 92, 93, [`SOV`], `A`, { area: AR(`kursk`), obj: AR(`kursk`) }],
  [`UK`, 92, 200, [`ITA`, `GER`], `A`, { area: AR(AREA.ITALY + ` ` + AREA.AFR), obj: AR(`sicily calabria naples rome florence bologna`), need: 1.3 }],
  [`USA`, 92, 200, [`ITA`, `GER`], `A`, { area: AR(AREA.ITALY + ` ` + AREA.AFR), obj: AR(`sicily naples rome florence bologna`), need: 1.3 }],
  [`SOV`, 93, 200, `*`, `A`, { obj: AR(`orel kharkov bryansk smolensk kiev dnepropetrovsk zaporozhye crimea vitebsk minsk bobruisk brest lwow kishinev iasi bucharest riga warsaw krakow budapest konigsberg poznan breslau vienna berlin`), need: 1.45 }],
  [`GER`, 100, 200, null, `S`, { gar: { lille: 2, normandy: 2, brittany: 1, paris: 1, amsterdam: 1, bordeaux: 1, marseille: 1, oslo: 1 } }],
  [`GER`, 110, 200, null, `S`, { gar: { berlin: 2, vienna: 1, breslau: 1, konigsberg: 1, prague: 1, ruhr: 1 } }],
  [`UK`, 114, 200, [`GER`], `A`, { obj: AR(`normandy paris lille brussels amsterdam liege koln ruhr hamburg hannover berlin`), need: 1.3 }],
  [`USA`, 114, 200, [`GER`], `A`, { obj: AR(`normandy paris reims metz saar frankfurt koln ruhr leipzig berlin`), need: 1.3 }],
  [`GER`, 127, 128, [`UK`, `USA`], `A`, { area: AR(`liege brussels amsterdam lille reims metz`), obj: AR(`brussels liege`) }],
  [`ROM`, 119, 200, [`GER`, `HUN`], `A`, {}],
  [`BUL`, 120, 200, [`GER`], `A`, {}],
];

const idOf = (k) => G.byKey[k]?.i || 0;
// ——— «режиссёр»: в войне ИИ против ИИ (без участия игрока) темп наступлений
// подстраивается под историю. Таблица: регион → ходы, когда он был в руках Оси.
const HF = `riga:44-122 tallinn:47-121 kaunas:43-118 wilno:43-116 minsk:43-116 bialystok:43-117 brest:43-117 lwow:43-117 rowne:43-106 vitebsk:44-115 mogilev:45-115 bobruisk:43-115 gomel:47-101 smolensk:45-97 pskov:44-117 novgorod:47-105 velikiye_luki:47-81 tikhvin:52-54 kalinin:50-55 rzhev:50-84 vyazma:50-84 bryansk:50-97 orel:50-94 kursk:52-82 voronezh:68-81 kharkov:51-83,84-95 sumy:50-96 poltava:49-97 chernigov:48-97 kiev:49-100 zhitomir:44-103 vinnitsa:45-109 proskurov:44-109 chernovtsy:44-109 kishinev:45-119 odessa:51-110 nikolaev:47-109 dnepropetrovsk:47-99 zaporozhye:50-98 stalino:51-96 voroshilovgrad:69-82 crimea:52-112 rostov:69-82 millerovo:68-81 elista:71-79 krasnodar:71-82 maikop:70-81 stavropol:70-81 viipuri:47-115 petrozavodsk:50-115 iasi:0-119 bucharest:0-119 warsaw:0-129 krakow:0-129 lodz:0-129 poznan:0-131 danzig:0-133 konigsberg:0-134 budapest:0-130 vienna:0-134 breslau:0-136 berlin:0-136 prague:0-136 moscow: leningrad: tula: stalingrad: grozny: baku: astrakhan: tbilisi: murmansk: ` +
  `helsinki:0-200 tampere:0-200 kuopio:0-200 oulu:0-200 rovaniemi:0-200 ploiesti:0-119 constanta:0-119 brasov:0-120 cluj:0-123 craiova:0-120 timisoara:0-122 debrecen:0-124 sofia:0-120 varna:0-120 plovdiv:0-120 belgrade:0-123 zagreb:0-136 pecs:0-128 bratislava:0-134 presov:0-127 uzhgorod:0-125 lublin:0-117 kielce:0-129 pomorze:0-133 stettin:0-135 dresden:0-136 brno:0-134 graz:0-136 ` +
  `tobruk:0-33,62-76 benghazi:0-35,38-55,57-77 tripoli:0-80 sollum:38-54,62-76 matruh:62-76 alamein: alexandria: cairo: tunis:76-89 gabes:76-89 sicily:0-95 naples:0-98 rome:0-114 florence:0-119 bologna:0-135 ` +
  `paris:18-119 normandy:18-114 brittany:18-119 lille:18-120 brussels:17-120 amsterdam:16-136 liege:17-121 reims:18-119 metz:18-125 strasbourg:18-125 marseille:76-119 lyon:76-119 koln:0-131 ruhr:0-133 frankfurt:0-133 hamburg:0-136 hannover:0-134 munich:0-136 leipzig:0-135`;
let HFI = null;
const hfi = () => (HFI = HFI || new Map(HF.split(` `).map((e) => {
  const [k, iv] = e.split(`:`);
  return [idOf(k), iv ? iv.split(`,`).map((p) => p.split(`-`).map(Number)) : []];
}).filter(([i]) => i)));
let ELBE0 = null;
const ELBE = { has: (i) => (ELBE0 = ELBE0 || new Set(`berlin dresden prague vienna breslau stettin brno graz bratislava budapest`.split(` `).map(idOf))).has(i) };
const axisC = (S, c) => !!c && (c === `GER` || ally(S, c, `GER`));
// сколько регионов Ось держит сверх истории (>0) или СССР освободил раньше (<0) — Восточный фронт
export function eastLead(S) {
  if (S._lead?.t === S.t) return S._lead.v;
  let v = 0;
  for (const [i, iv] of hfi()) {
    if (reg(i).lon < 19 || reg(i).lat < 40) continue;
    const h = iv.some(([a, b]) => S.t >= a && S.t < b) ? 1 : 0;
    v += ((axisC(S, S.ctrl[i]) ? 1 : 0) - h) * (reg(i).vp >= 6 ? 2 : 1);
  }
  S._lead = { t: S.t, v };
  return v;
}
// надбавка к требуемому перевесу при атаке «раньше истории»; только ИИ против ИИ
function gate(S, n, T) {
  const c = S.ctrl[T];
  if (!S.histOn || n === S.player || c === S.player || (S.player && ally(S, c, S.player) && ally(S, n, S.player))) return 0;
  let iv = hfi().get(T);
  // глубина СССР и Британии, не упомянутая в таблице, — Ось туда не доходила
  if (!iv) {
    if (!(axisC(S, n) && [`SOV`, `UK`].includes(S.core[T]) && !axisC(S, c))) return 0;
    iv = [];
  }
  const t = S.t, cur = iv.find(([a, b]) => t >= a && t < b);
  let early = 0;
  // отставание от истории — небольшая скидка (догоняем ход войны)
  const late = (d) => -Math.min(axisC(S, n) ? 0.2 : 0.25, (axisC(S, n) ? 0.06 : 0.04) * Math.max(0, d - 1));
  if (axisC(S, n) && !axisC(S, c)) {
    if (cur) return late(t - cur[0]);
    const nx = iv.filter(([a]) => a > t).sort((x, y) => x[0] - y[0])[0];
    // после последнего периода — небольшая надбавка; там, куда Ось не доходила, — запрет
    if (!nx) return iv.length ? 0.15 : 9;
    early = nx[0] - t;
  } else if (!axisC(S, n) && axisC(S, c)) {
    // западные союзники не идут за Эльбу
    if (n !== `SOV` && ELBE.has(T)) return 9;
    if (!cur) {
      const pb = iv.filter(([, b]) => b <= t).sort((x, y) => y[1] - x[1])[0];
      return pb ? late(t - pb[1]) : 0;
    }
    early = cur[1] - t;
    // столицы — не раньше чем за месяц до истории; западные союзники — не раньше чем за полтора
    if ((reg(T).cap && early > 2) || (n !== `SOV` && early > 3)) return 9;
  } else return 0;
  // больше чем на 3,5 месяца раньше истории — не атаковать вовсе
  if (!axisC(S, n)) return early > 4 ? 9 : 0.1 * Math.max(0, early - 1);
  return early > 7 ? 9 : 0.06 * Math.max(0, early - 2);
}
// «ход истории» в бою ИИ против ИИ: отстающая от истории сторона дерётся увереннее
function momentum(S, n, T) {
  const g = gate(S, n, T);
  return g < 0 ? 1 - g : g > 0 && g < 9 ? 1 - Math.min(0.12, g * 0.25) : 1;
}
const AXIS_E = new Set([`GER`, `ROM`, `HUN`, `FIN`, `ITA`, `SVK`]);
function director(S, n, out) {
  if (!S.histOn || S.player === `GER` || S.player === `SOV` || !atWar(S, `GER`, `SOV`) || S.t < 44) return;
  const L = eastLead(S);
  const P0 = out.post.SOV;
  if (AXIS_E.has(n)) {
    if (L >= 10) delete out.post.SOV;
    else if (L <= -6 && S.t < 80 && P0 && P0.p === `A`) P0.need = Math.max(1.05, P0.need - 0.1);
  } else if (n === `SOV`)
    for (const e of Object.keys(S.nat)) {
      if (side(S, e) !== `axis` || !atWar(S, `SOV`, e)) continue;
      const P = out.post[e];
      if (P && P.p === `A`) {
        if (L <= -10 || (L <= -6 && S.t < 80) || (L <= -7 && S.t >= 110)) delete out.post[e];
        else if (L >= 4 && S.t >= 80) P.need = Math.max(1.15, P.need - Math.min(0.3, 0.03 * (L - 2)));
      } else if (L >= 6) out.post[e] = { p: `A`, need: 1.4, obj: null, area: null };
    }
}
// Директивы державы на текущий ход
function dirFor(S, n) {
  const t = S.t, out = { post: {}, stage: {}, gar: {} };
  for (const [m, a, b, vs, p, o] of DIR) {
    if (m !== n || t < a || t > b) continue;
    if (p === `S`) {
      Object.assign(out.stage, o.stage || {}), Object.assign(out.gar, o.gar || {});
      continue;
    }
    for (const e of vs === `*` ? Object.keys(S.nat) : vs) out.post[e] = { p, need: o.need || 1.35, obj: o.obj || null, area: o.area ? new Set(o.area.map(idOf)) : null };
  }
  director(S, n, out);
  return out;
}
// Расстояния от целей (по всей карте, с морскими связями)
function distFrom(ids) {
  const d = new Int16Array(G.R.length + 1).fill(99), q = [];
  for (const i of ids) i && ((d[i] = 0), q.push(i));
  for (let k = 0; k < q.length; k++) {
    const a = q[k], R = G.R[a - 1];
    for (const b of R.nb) d[b] > d[a] + 1 && ((d[b] = d[a] + 1), q.push(b));
    for (const [b] of R.sea2) d[b] > d[a] + 2 && ((d[b] = d[a] + 2), q.push(b));
  }
  return d;
}
// ——— оценки ———
const orgK = (S, u) => 0.4 + 0.6 * Math.max(0, Math.min(1, u.o / orgMax(S, u.n)));
const power = (S, u, k) => UT[u.t][k] * (u.s / 10) * quality(S, u.n) * orgK(S, u);
const regVal = (R) => 1 + R.vp * 0.5 + R.ic * 0.2 + (R.cap ? 3 : 0);
// угроза своим провинциям: сила атаки соседних дивизий противника (артиллерия — на 2 перехода)
function threat(S, n) {
  const t = new Float64Array(G.R.length + 1);
  for (const u of S.units) {
    if (!atWar(S, u.n, n)) continue;
    const p = power(S, u, `atk`), R = reg(u.r);
    for (const j of u.t === `art` ? R.d2 : R.nb) friendly(S, j, n) && (t[j] += u.t === `art` ? p * 0.5 : p);
  }
  return t;
}
function ctx(S, n, D) {
  for (const P of Object.values(D.post)) {
    if (P.p !== `A` || !P.obj) continue;
    P.objD = distFrom(P.obj.map(idOf).filter((i) => i && !friendly(S, i, n)));
  }
  return { D, thr: threat(S, n), sup: supply(S, n) };
}
// Установка против хозяина провинции T: наступление по директиве или контрудар за свои земли
function postFor(S, n, C, T) {
  const c = S.ctrl[T], P = C.D.post[c];
  if (P && P.p === `A` && (!P.area || P.area.has(T))) return P;
  const core = S.core[T];
  if (core && (core === n || ally(S, core, n))) return { p: `H`, need: 1.6, objD: null };
  return null;
}
function targetValue(S, n, C, T, P) {
  const R = reg(T);
  let v = regVal(R);
  if (P.objD) {
    const d = P.objD[T];
    v += d === 0 ? 6 : d <= 4 ? 4 / d : 0;
  }
  S.core[T] === n && (v += 3);
  // окружение: у защитника нет пути отхода
  const d = unitAt(S, T);
  if (d) {
    let esc = 0;
    for (const j of R.nb) friendly(S, j, d.n) && !unitAt(S, j) && esc++;
    !esc && (v += 4);
    v += (MAXS - d.s) * 0.3;
  }
  return v;
}
// ——— авиация ———
function airOn(S, n, T, k = 2) {
  let hit = 0;
  for (let q = 0; q < k && canAir(S, n, T); q++) airStrike(S, n, T) && hit++;
  return hit;
}
// ——— план удара по провинции T: кто и в каком порядке бьёт (без случайности) ———
function plan(S, n, C, T, P, mom) {
  const d = unitAt(S, T);
  if (!d || !atWar(S, d.n, n)) return null;
  const g = gate(S, n, T);
  if (g >= 9) return null;
  const needR = Math.max(0.7, P.need - 0.35 + g);
  const cand = [];
  for (const j of reg(T).d2) {
    const u = unitAt(S, j);
    if (!u || u.n !== n || u.fr || u.at || C.used?.has(u.id)) continue;
    const tg = attackTargets(S, u).get(T);
    if (!tg) continue;
    // гарнизоны и последний защитник столицы не уходят вперёд
    const R0 = reg(u.r), hold = !!C.D.gar[R0.k] || (R0.cap && C.thr[u.r] > 0);
    cand.push({ u, k: tg.k, hold, c: combat(S, u, d, { src: u.r, art: tg.k === `bomb` }) });
  }
  if (!cand.length) return null;
  cand.sort((a, b) => (b.k === `bomb`) - (a.k === `bomb`) || b.c.R - a.c.R);
  // последовательные удары с ожидаемыми потерями
  const s0 = d.s, o0 = d.o, list = [];
  let aLoss = 0, rSum = 0, ok = false;
  try {
    for (const x of cand) {
      const c = combat(S, x.u, d, { src: x.u.r, art: x.k === `bomb` });
      const R = c.R * mom;
      if (R < needR * (x.k === `bomb` ? 0.6 : 1) && list.length === 0 && x.k !== `bomb`) break;
      if (R < needR * 0.8 && x.k !== `bomb`) continue;
      list.push(x);
      rSum += R;
      aLoss += c.aStr;
      d.s -= c.dStr, (d.o -= c.dOrg);
      if (d.s <= 0.4 || (d.o <= 0 && x.k !== `bomb`)) {
        ok = true;
        break;
      }
      d.o = Math.max(0, d.o);
    }
  } finally {
    d.s = s0, (d.o = o0);
  }
  if (!list.length) return null;
  const gain = d.s * (ok ? 1 : 0) + (ok && !combat(S, list[list.length - 1].u, d, {}).canRet ? 3 : 0);
  // без шанса выбить — только выгодный размен (артиллерия бьёт без ответа)
  if (!ok) {
    const best = list.filter((x) => x.k === `bomb` || x.c.R * mom >= needR + 0.45);
    if (!best.length || P.p !== `A`) return null;
    return { T, d, list: best, ok: false, aLoss: 0, gain: 0 };
  }
  if (aLoss > gain + 2.5) return null;
  return { T, d, list, ok, aLoss, gain, rAvg: rSum / list.length };
}
function execPlan(S, n, C, pl) {
  const mom = momentum(S, n, pl.T);
  for (const x of pl.list) {
    if (!S.units.includes(x.u) || !unitAt(S, pl.T)) break;
    if (!attackTargets(S, x.u).has(pl.T)) continue;
    const rep = attack(S, x.u, pl.T, { amph: x.k === `amph`, noAdv: x.hold, mod: mom !== 1 ? { r: mom } : null });
    C.used.add(x.u.id);
    if (!rep) break;
    if (rep.adv || rep.out === `destroyed` || rep.out === `surrender` || rep.out === `retreat`) break;
  }
}
function attacks(S, n, C) {
  C.used = C.used || new Set();
  for (let round = 0; round < 3; round++) {
    const cand = [], seen = new Set();
    for (const u of S.units) {
      if (u.n !== n || u.fr || u.at) continue;
      for (const T of attackTargets(S, u).keys()) {
        if (seen.has(T)) continue;
        seen.add(T);
        let P = postFor(S, n, C, T);
        // прорыв из окружения
        if (!P && C.sup[u.r] < 0) P = { p: `A`, need: 1.15, objD: null };
        if (!P) continue;
        cand.push({ T, P, v: targetValue(S, n, C, T, P) });
      }
    }
    if (!cand.length) return;
    cand.sort((a, b) => b.v - a.v);
    let any = 0;
    for (const c of cand) {
      if (!unitAt(S, c.T) || !hostile(S, c.T, n) && !atWar(S, unitAt(S, c.T).n, n)) continue;
      const mom = momentum(S, n, c.T);
      let pl = plan(S, n, C, c.T, c.P, mom);
      // авиация — по целям, где не хватает немного
      if ((!pl || !pl.ok) && (S.nat[n].air || 0) > 0 && canAir(S, n, c.T) && gate(S, n, c.T) < 9) {
        airOn(S, n, c.T, 2);
        pl = plan(S, n, C, c.T, c.P, mom);
      } else if (pl && pl.ok && (S.nat[n].air || 0) > 1 && canAir(S, n, c.T) && c.v >= 4) {
        airOn(S, n, c.T, 1);
        pl = plan(S, n, C, c.T, c.P, mom) || pl;
      }
      if (!pl || !unitAt(S, c.T)) continue;
      execPlan(S, n, C, pl);
      any++;
    }
    C.thr = threat(S, n);
    C.sup = supply(S, n);
    if (!any) return;
  }
}
// остаток авиации — по самым опасным дивизиям противника у фронта
function airRest(S, n, C) {
  const nat = S.nat[n];
  if ((nat.air || 0) <= 0) return;
  const cand = [];
  for (const u of S.units) {
    if (!atWar(S, u.n, n) || !canAir(S, n, u.r)) continue;
    let adj = 0;
    for (const j of reg(u.r).nb) friendly(S, j, n) && unitAt(S, j) && adj++;
    adj && cand.push({ r: u.r, v: power(S, u, `atk`) * (1 + adj * 0.2) });
  }
  cand.sort((a, b) => b.v - a.v);
  for (const c of cand) {
    if ((nat.air || 0) <= 0) break;
    airOn(S, n, c.r, 1);
  }
}
// ——— захват пустых провинций ———
function captures(S, n, C) {
  const us = S.units.filter((u) => u.n === n && !u.fr && u.mv > 0).sort((a, b) => UT[b.t].mv - UT[a.t].mv);
  for (const u of us) {
    for (let step = 0; step < 3 && u.mv > 0 && S.units.includes(u); step++) {
      let best = null, bv = 0;
      for (const m of moves(S, u).values()) {
        if (m.k !== `capture`) continue;
        const P = postFor(S, n, C, m.r);
        if (!P || gate(S, n, m.r) >= 0.15) continue;
        const R = reg(m.r);
        // без «прорывов в пустоту»: рядом с сильным врагом — только при опоре на свои провинции
        let eAdj = 0, fN = 0;
        for (const j of R.nb) {
          const v = unitAt(S, j);
          v && atWar(S, v.n, n) && (eAdj += power(S, v, `atk`));
          friendly(S, j, n) && fN++;
        }
        if (eAdj > power(S, u, `def`) * 2.2 && fN < 2) continue;
        let v = targetValue(S, n, C, m.r, P) - m.cost * 0.2;
        // не оставлять пустой угрожаемую провинцию
        const R0 = reg(u.r);
        if (C.D.gar[R0.k] || (R0.cap && C.thr[u.r] > 0)) continue;
        C.thr[u.r] > 0 && P.p !== `A` && (v *= 0.4);
        C.thr[u.r] > power(S, u, `def`) && (v *= 0.6);
        v > bv && ((bv = v), (best = m));
      }
      // высадка в пустую вражескую провинцию через море
      if (!best && u.mv >= UT[u.t].mv && (S.nat[n].navl || 0) > 0) {
        for (const r of amphTargets(S, u)) {
          const P = postFor(S, n, C, r);
          if (!P || P.p !== `A` || gate(S, n, r) >= 0.15) continue;
          const R = reg(r);
          let eAdj = 0;
          for (const j of R.nb) {
            const v = unitAt(S, j);
            v && atWar(S, v.n, n) && (eAdj += power(S, v, `atk`));
          }
          if (eAdj > power(S, u, `def`) * 1.2) continue;
          const v = targetValue(S, n, C, r, P) - 1;
          v > bv && ((bv = v), (best = { r, k: `amphcap`, cost: u.mv }));
        }
      }
      if (!best) break;
      moveTo(S, u, best.r, best);
    }
  }
}
// ——— удержание фронта и переброски ———
// какие свободные провинции нужно занять и насколько это важно
const MINOR_AREA = new Set([`ITA`, `ROM`, `HUN`, `BUL`, `FIN`, `SVK`, `VIC`]);
function needs(S, n, C) {
  const NR = G.R.length, nd = new Float64Array(NR + 1), sup = C.sup, D = C.D;
  const enemyMar = Object.keys(S.nat).some((e) => MARITIME.has(e) && alive(S, e) && atWar(S, e, n));
  let area = null;
  if (MINOR_AREA.has(n)) {
    area = new Set();
    for (const R of G.R) if (S.ctrl[R.i] === n || S.core[R.i] === n) for (const j of [R.i, ...R.nb]) area.add(j);
    for (const P of Object.values(D.post)) if (P.p === `A` && P.area) for (const i of P.area) area.add(i);
  }
  for (const R of G.R) {
    const i = R.i;
    if (!friendly(S, i, n) || (area && !area.has(i))) continue;
    let v = 0;
    const t = C.thr[i];
    if (t > 0) v = 2 + Math.min(4, t * 0.25) + regVal(R) * 0.25;
    else if (R.nb.some((j) => hostile(S, j, n))) v = 1.2 + regVal(R) * 0.15;
    const g = D.gar[R.k], st = D.stage[R.k];
    g && (v = Math.max(v, 3 + g));
    st && (v = Math.max(v, 2 + st * 0.4));
    if (enemyMar && R.sea.length && (R.cap || R.vp >= 4) && S.ctrl[i] === n) v = Math.max(v, 0.9 + R.vp * 0.1);
    R.cap && S.ctrl[i] === n && R.near && [...R.near].some(([j, k]) => k <= 2 && hostile(S, j, n)) && (v = Math.max(v, 4));
    sup[i] < 0 && (v *= 0.3);
    nd[i] = v;
  }
  // сосредоточение: соседи провинций сосредоточения тоже нужны
  for (const [k, w] of Object.entries(D.stage)) {
    const i = idOf(k);
    if (!i) continue;
    for (const j of reg(i).nb) friendly(S, j, n) && (!area || area.has(j)) && (nd[j] = Math.max(nd[j], 1.4 + w * 0.15));
  }
  return nd;
}
// расстояния по своей и союзной территории (дивизии можно проходить)
function landDist(S, n, to) {
  const d = new Int16Array(G.R.length + 1).fill(99), q = [to];
  d[to] = 0;
  for (let k = 0; k < q.length; k++) {
    const a = q[k];
    for (const b of reg(a).nb) {
      if (d[b] <= d[a] + 1 || !friendly(S, b, n)) continue;
      const v = unitAt(S, b);
      if (v && !ally(S, v.n, n)) continue;
      d[b] = d[a] + 1;
      q.push(b);
    }
  }
  return d;
}
function redeploy(S, n, C) {
  C.used = C.used || new Set();
  C.thr = threat(S, n);
  C.sup = supply(S, n);
  const nd = needs(S, n, C), nat = S.nat[n];
  const free = () => S.units.filter((u) => u.n === n && !u.fr && !u.at && u.mv > 0 && !C.used.has(u.id));
  // окружённые — к своим
  for (const u of free()) {
    if (C.sup[u.r] >= 0) continue;
    let best = null, bv = -1;
    for (const m of moves(S, u).values()) if (m.k === `move` && C.sup[m.r] >= 0 && nd[m.r] > bv) (bv = nd[m.r]), (best = m);
    best && (moveTo(S, u, best.r, best), C.used.add(u.id));
  }
  const slots = [];
  for (let i = 1; i <= G.R.length; i++) nd[i] > 0.5 && !unitAt(S, i) && slots.push(i);
  slots.sort((a, b) => nd[b] - nd[a]);
  for (const b of slots.slice(0, 40)) {
    if (unitAt(S, b)) continue;
    const dist = landDist(S, n, b);
    let best = null, bs = -1e9;
    for (const u of free()) {
      const cur = nd[u.r];
      if (cur + 0.6 >= nd[b]) continue;
      const d = dist[u.r];
      if (d >= 99) continue;
      const mvMax = UT[u.t].mv;
      const s = -Math.ceil(d / mvMax) * 2 - cur + (d <= mvMax ? 3 : 0) + (MECH(u) && C.thr[b] > 4 ? -0.5 : 0);
      s > bs && ((bs = s), (best = u));
    }
    if (best) {
      const u = best, d = dist[u.r];
      const ms = moves(S, u);
      if (ms.has(b) && ms.get(b).k === `move`) {
        moveTo(S, u, b, ms.get(b));
        C.used.add(u.id);
        continue;
      }
      // далеко — по железной дороге
      if (d >= 3 && (nat.rail || 0) > 0) {
        const rt = railTargets(S, u);
        let rb = 0, rd = d;
        for (const j of rt) dist[j] < rd && ((rd = dist[j]), (rb = j));
        if (rb && rd <= Math.max(1, d - 3)) {
          railMove(S, u, rb);
          C.used.add(u.id);
          continue;
        }
      }
      // шаг навстречу
      let mb = null, md = d;
      for (const m of ms.values()) m.k === `move` && dist[m.r] < md && ((md = dist[m.r]), (mb = m));
      if (mb) {
        moveTo(S, u, mb.r, mb);
        C.used.add(u.id);
      }
      continue;
    }
    // по суше не добраться — морем
    if ((nat.navl || 0) > 0 && reg(b).sea.some((z) => navZones(S, n).includes(z))) {
      let su = null, sv = 1e9;
      for (const u of free()) {
        if (nd[u.r] + 1 >= nd[b] || !reg(u.r).sea.length) continue;
        const v = nd[u.r] + (MECH(u) ? 0 : 0.2);
        v < sv && seaTargets(S, u).includes(b) && ((sv = v), (su = u));
      }
      su && (seaMove(S, su, b), C.used.add(su.id));
    }
  }
}
// ——— пополнение: слабые дивизии вне боя ———
function aiReinforce(S, n, C) {
  const nat = S.nat[n];
  let budget = Math.max(0, nat.pp) * 0.5;
  const us = S.units.filter((u) => u.n === n && u.s <= 6 && !C.used?.has(u.id)).sort((a, b) => a.s - b.s);
  for (const u of us) {
    if (!canReinforce(S, u)) continue;
    const c = UT[u.t].re.pp * Math.min(3, MAXS - u.s);
    if (c > budget) break;
    budget -= c;
    reinforce(S, u);
  }
}
// ——— производство и наука ———
// желаемые доли типов дивизий (по числу)
const MIX = {
  GER: { inf: 0.56, arm: 0.2, mot: 0.12, art: 0.12 }, SOV: { inf: 0.6, arm: 0.15, cav: 0.1, art: 0.12, mot: 0.03 }, UK: { inf: 0.48, arm: 0.3, mot: 0.1, art: 0.12 },
  USA: { inf: 0.45, arm: 0.33, mot: 0.1, art: 0.12 }, ITA: { inf: 0.78, arm: 0.1, art: 0.12 }, FRA: { inf: 0.72, arm: 0.12, mot: 0.06, art: 0.1 }, _: { inf: 0.88, art: 0.12 },
};
const AIR_T = { GER: 12, UK: 12, USA: 10, SOV: 12, ITA: 5, FRA: 5, FIN: 2, ROM: 2, HUN: 2, _: 0 };
const RES = { GER: [`arm`, `ind`, `air`, `inf`], SOV: [`ind`, `arm`, `inf`, `air`], UK: [`air`, `arm`, `ind`, `inf`], USA: [`ind`, `air`, `arm`, `inf`], ITA: [`inf`, `air`, `arm`, `ind`], _: [`inf`, `ind`, `air`, `arm`] };
function aiResearch(S, n) {
  const nat = S.nat[n];
  if (nat.res) return;
  const y = tDate(S.t).y;
  let best = null, bv = 99;
  (RES[n] || RES._).forEach((k, ix) => {
    const lv = nat.tech[k] || 0, v = lv + ix * 0.4;
    lv < 5 && techYear(lv + 1) <= y + 1 && v < bv && ((bv = v), (best = k));
  });
  best && (nat.res = best);
}
// где формировать: своя провинция в 1–3 переходах от фронта (или у сосредоточения)
function pickSite(S, n, t, C, war) {
  const fr = new Int16Array(G.R.length + 1).fill(99), q = [];
  for (const R of G.R) if (friendly(S, R.i, n) && R.nb.some((j) => hostile(S, j, n))) (fr[R.i] = 0), q.push(R.i);
  for (const k of Object.keys(C?.D.stage || {})) {
    const i = idOf(k);
    i && fr[i] > 0 && ((fr[i] = 0), q.push(i));
  }
  for (let k = 0; k < q.length; k++) for (const b of reg(q[k]).nb) fr[b] > fr[q[k]] + 1 && friendly(S, b, n) && ((fr[b] = fr[q[k]] + 1), q.push(b));
  let best = 0, bv = -1e9;
  for (const R of G.R) {
    if (!buildSite(S, n, R.i, t)) continue;
    const d = fr[R.i];
    let v = war ? (d === 0 ? 1 : d <= 2 ? 4 - d * 0.3 : d <= 4 ? 2.5 - d * 0.2 : 1 - Math.min(1, d * 0.02)) : 1 + R.vp * 0.1;
    v += R.vp * 0.05 + rnd(S) * 0.2;
    v > bv && ((bv = v), (best = R.i));
  }
  return best;
}
function aiBuild(S, n, war, C) {
  const nat = S.nat[n];
  const mine = S.units.filter((u) => u.n === n);
  const provs = G.R.filter((R) => S.ctrl[R.i] === n).length;
  const staging = C && Object.keys(C.D.stage).length;
  if (!war && !staging && mine.length >= Math.max(2, Math.ceil(provs * 0.6))) return;
  const inc = nat.inc || income(S, n);
  const reserve = war ? 6 + inc.pp * 0.2 : 20;
  const y = tDate(S.t).y, mix = { ...(MIX[n] || MIX._) };
  y >= 1943 && mix.arm && ((mix.arm += 0.05), (mix.inf -= 0.05));
  const oilOK = nat.oil > 25 || (inc.oil || 0) - upkeep(S, n) > 1.5;
  const have = {};
  let tot = 0;
  for (const u of mine) (have[u.t] = (have[u.t] || 0) + 1), tot++;
  for (let g = 0; g < 5; g++) {
    let k = null, bv = -9;
    for (const [t, w] of Object.entries(mix)) {
      const c = buildCost(S, n, t);
      if (c.oil && !oilOK) continue;
      if (nat.pp - c.pp < reserve || nat.mp - c.mp < 3 || (c.oil && nat.oil < c.oil + 10)) continue;
      const v = w - (have[t] || 0) / Math.max(1, tot);
      v > bv && ((bv = v), (k = t));
    }
    if (!k) break;
    let site = pickSite(S, n, k, C, war);
    if (!site && MECH({ t: k })) (k = `inf`), (site = pickSite(S, n, k, C, war));
    if (!site || nat.pp - buildCost(S, n, k).pp < reserve) break;
    build(S, n, k, site, { log: false });
    have[k] = (have[k] || 0) + 1, tot++;
  }
  // авиаполки
  const at = AIR_T[n] ?? AIR_T._;
  war && (nat.airMax || 0) < at && canBuyAir(S, n) && nat.pp - AIR.cost.pp > reserve + 10 && buyAir(S, n);
}
// ——— ход державы под управлением ИИ ———
export function aiTurn(S, n) {
  if (!alive(S, n)) return;
  const D = dirFor(S, n);
  const war = Object.keys(S.nat).some((e) => alive(S, e) && atWar(S, n, e));
  aiResearch(S, n);
  const active = war || Object.keys(D.stage).length || Object.keys(D.gar).length;
  const C = active ? ctx(S, n, D) : null;
  if (war) {
    attacks(S, n, C);
    captures(S, n, C);
    airRest(S, n, C);
    aiReinforce(S, n, C);
  }
  active && redeploy(S, n, C);
  aiBuild(S, n, war, C);
  touch(S);
}
export const _dbg = { ctx, dirFor, postFor, plan, gate, needs };
