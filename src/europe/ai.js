// «Европа 1939–1945»: ИИ держав — «режиссёр» по датам, атаки с концентрацией сил, резервы, авиация, производство.
import { G, reg, rnd, tDate, UT, LAND, MOBILE, STACK, alive, ally, atWar, side, landIn, unitsIn, quality, defPow, atkPow, estimate, battle, targets, moveUnit, occupy, railTargets, railMove, seaTargets, seaMove, supply, canBuy, buy, itemCost, techYear, income, upkeep, ITEMS } from './rules.js';

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
  [`SOV`, 2, 42, null, `S`, { stage: { bialystok: 4, brest: 3, lwow: 4, rowne: 2, kaunas: 3, kishinev: 3, chernovtsy: 2, minsk: 3, kiev: 3, viipuri: 2, leningrad: 3, riga: 1, tallinn: 1, odessa: 2, murmansk: 2, petrozavodsk: 2 } }],
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
  [`FIN`, 43, 52, [`SOV`], `A`, { area: AR(`viipuri petrozavodsk belomorsk kuopio`), obj: AR(`viipuri petrozavodsk`) }],
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
const qOrg = (u) => 0.35 + 0.0065 * Math.max(0, u.o);
const canAtk = (u) => LAND(u) && u.mv > 0 && !(u.at && !MOBILE(u)) && u.s >= 0.8;
// куда ставить новые войска ИИ: свой снабжаемый регион в 2–3 переходах от фронта
function aiDeploy(S, n) {
  const d = new Map(), q = [];
  for (const R of G.R) if (S.ctrl[R.i] === n && R.nb.some((j) => S.ctrl[j] && atWar(S, S.ctrl[j], n))) (d.set(R.i, 0), q.push(R.i));
  for (let k = 0; k < q.length; k++) for (const b of reg(q[k]).nb) !d.has(b) && S.ctrl[b] === n && (d.set(b, d.get(q[k]) + 1), q.push(b));
  const sup = supply(S, n);
  const c = [...d].filter(([i, v]) => v >= 2 && v <= 3 && sup[i] >= 0 && landIn(S, i).length < STACK - 2).sort((a, b) => reg(b[0]).vp - reg(a[0]).vp);
  return c[0]?.[0] || 0;
}

// ——— контекст хода ———
function ctx(S, n, D) {
  const NR = G.R.length, fr = new Uint8Array(NR + 1), en = new Uint8Array(NR + 1);
  for (const R of G.R) {
    const c = S.ctrl[R.i];
    if (!c) continue;
    if (ally(S, c, n)) fr[R.i] = 1;
    else if (atWar(S, c, n)) en[R.i] = 1;
  }
  const eAtk = new Float64Array(NR + 1);
  for (const R of G.R) {
    if (!en[R.i]) continue;
    let a = 0;
    for (const u of landIn(S, R.i)) atWar(S, u.n, n) && (a += UT[u.t].atk * u.s * quality(S, u.n) * qOrg(u));
    eAtk[R.i] = a;
  }
  const thr = new Float64Array(NR + 1), have = new Float64Array(NR + 1), front = [];
  for (const R of G.R) {
    if (!fr[R.i]) continue;
    let t = 0, adj = 0;
    for (const j of R.nb) en[j] && ((adj = 1), (t += eAtk[j] * (R.riv.has(j) ? 0.75 : 1)));
    thr[R.i] = t;
    adj && front.push(R.i);
    for (const u of landIn(S, R.i)) ally(S, u.n, n) && (have[R.i] += defPow(S, u, R));
  }
  // цели наступления: расстояния до объектов для каждой установки
  const objD = {};
  for (const [e, P] of Object.entries(D.post)) {
    if (P.p !== `A` || !P.obj) continue;
    const key = P.obj.join(` `);
    objD[key] = objD[key] || distFrom(P.obj.map(idOf).filter((i) => i && !(S.ctrl[i] && ally(S, S.ctrl[i], n))));
    P.objD = objD[key];
    void e;
  }
  return { fr, en, eAtk, thr, have, front, D, sup: supply(S, n) };
}
const regVal = (R) => 1 + R.vp * 0.5 + R.ic * 0.2 + (R.cap ? 3 : 0);
function wantOf(S, n, C, i) {
  const R = reg(i), t = C.thr[i];
  if (t <= 0) return 0;
  return t * (R.cap ? 1.25 : R.vp >= 5 ? 1.05 : 0.9);
}
// Установка против хозяина региона T
function postFor(S, n, C, T) {
  const c = S.ctrl[T], P = C.D.post[c];
  if (P && P.p === `A` && (!P.area || P.area.has(T))) return P;
  // контрудар за свои / союзные исконные земли
  const core = S.core[T];
  if (core && (core === n || ally(S, core, n))) return { p: `H`, need: 1.6, objD: null };
  return null;
}

// ——— атаки ———
// совместные удары союзников вне Восточного фронта: немцы с итальянцами, англичане с американцами
const COAL = { GER: [`ITA`], ITA: [`GER`], UK: [`USA`], USA: [`UK`] };
const COALZ = new Set([...AR(AREA.AFR), ...AR(AREA.ITALY), ...AR(AREA.WEST)]);
const coal = (S, n, T) => (COALZ.has(reg(T).k) ? (COAL[n] || []).filter((m) => m !== S.player && alive(S, m) && atWar(S, m, S.ctrl[T])) : []);
function pickAttack(S, n, C, T, P) {
  const R = reg(T), defs = landIn(S, T), g = gate(S, n, T);
  if (!defs.length || g >= 9) return null;
  const pool = [], cm = coal(S, n, T), mine = (u) => u.n === n || cm.includes(u.n);
  for (const i of R.nb) {
    if (!C.fr[i]) continue;
    const us = unitsIn(S, i).filter((u) => mine(u) && canAtk(u) && (u.o >= 34 || C.sup[i] < 0));
    if (!us.length) continue;
    const oos = C.sup[i] < 0;
    // сколько обороны оставить в исходном регионе
    let other = 0;
    for (const j of reg(i).nb) j !== T && C.en[j] && (other += C.eAtk[j]);
    const keep = oos ? 0 : other * 0.7;
    let left = C.have[i];
    const all = landIn(S, i).filter(mine);
    us.sort((a, b) => atkPow(S, b, R, i) - atkPow(S, a, R, i));
    let kept = all.length - us.length;
    const gk = C.D.gar[reg(i).k] || 0;
    for (const u of us) {
      const dp = defPow(S, u, reg(i));
      if (kept < gk || (other > 0 && (left - dp < keep || (kept === 0 && us.length + kept - pool.filter((p) => p.src === i).length <= 1)))) {
        kept++;
        continue;
      }
      left -= dp;
      pool.push({ u, src: i, p: atkPow(S, u, R, i) });
    }
  }
  if (!pool.length) return null;
  pool.sort((a, b) => b.p - a.p);
  let D = 0;
  for (const u of defs) D += defPow(S, u, R);
  const need = Math.max(1.05, P.need + g + (R.cap && R.own === S.ctrl[T] ? 0.2 : 0)), goal = Math.max(need * 1.25, 1.9);
  const att = [];
  let A = 0;
  for (const a of pool) {
    if (att.length >= STACK) break;
    att.push(a), (A += a.p);
    if (A >= D * goal) break;
  }
  const E = estimate(S, att, T);
  if (E.r < need) return null;
  return { att: att.map(({ u, src }) => ({ u, src })), r: E.r };
}
function attackValue(S, n, C, T, P) {
  const R = reg(T);
  let v = regVal(R);
  if (P.objD) {
    const d = P.objD[T];
    v += d === 0 ? 6 : d <= 4 ? 4 / d : 0;
  }
  S.core[T] === n && (v += 3);
  // окружение: у защитника нет пути отхода
  const dn = S.ctrl[T];
  let esc = 0;
  for (const j of R.nb) {
    const c = S.ctrl[j];
    c && ally(S, c, dn) && !C.fr[j] && esc++;
  }
  !esc && (v += 4);
  return v;
}
function attacks(S, n, C) {
  for (let round = 0; round < 3; round++) {
    const cand = [];
    const seen = new Set();
    for (const i of C.front)
      for (const T of reg(i).nb) {
        if (!C.en[T] || seen.has(T)) continue;
        seen.add(T);
        const P = postFor(S, n, C, T);
        if (!P) {
          // прорыв из окружения
          if (C.sup[i] < 0) cand.push({ T, P: { p: `H`, need: 1.0 }, v: 5 });
          continue;
        }
        if (!landIn(S, T).length) continue;
        cand.push({ T, P, v: attackValue(S, n, C, T, P) });
      }
    if (!cand.length) return;
    cand.sort((a, b) => b.v - a.v);
    let any = 0;
    for (const c of cand) {
      if (!C.en[c.T] || !landIn(S, c.T).length) continue;
      const pk = pickAttack(S, n, C, c.T, c.P);
      if (!pk) continue;
      const rep = battle(S, pk.att, c.T, { mod: { r: momentum(S, n, c.T) } });
      any++;
      refreshAround(S, n, C, c.T);
      if (rep.win) for (const a of pk.att) refreshAround(S, n, C, a.src);
    }
    if (!any) return;
  }
}
// пересчёт угроз и обороны вокруг региона после боя
function refreshAround(S, n, C, T) {
  const ids = new Set([T, ...reg(T).nb]);
  for (const i of ids) {
    const c = S.ctrl[i];
    C.fr[i] = c && ally(S, c, n) ? 1 : 0;
    C.en[i] = c && atWar(S, c, n) ? 1 : 0;
    let a = 0;
    if (C.en[i]) for (const u of landIn(S, i)) atWar(S, u.n, n) && (a += UT[u.t].atk * u.s * quality(S, u.n) * qOrg(u));
    C.eAtk[i] = a;
  }
  const ids2 = new Set();
  for (const i of ids) for (const j of [i, ...reg(i).nb]) ids2.add(j);
  for (const i of ids2) {
    if (!C.fr[i]) ((C.thr[i] = 0), (C.have[i] = 0));
    else {
      let t = 0, h = 0;
      const R = reg(i);
      for (const j of R.nb) C.en[j] && (t += C.eAtk[j] * (R.riv.has(j) ? 0.75 : 1));
      for (const u of landIn(S, i)) ally(S, u.n, n) && (h += defPow(S, u, R));
      (C.thr[i] = t), (C.have[i] = h);
      if (t > 0 && !C.front.includes(i)) C.front.push(i);
    }
  }
  C.front = C.front.filter((i) => C.fr[i] && reg(i).nb.some((j) => C.en[j]));
  C.sup = supply(S, n);
}
// ——— захват пустых регионов ———
function captures(S, n, C) {
  const us = S.units.filter((u) => u.n === n && LAND(u) && u.mv > 0).sort((a, b) => MOBILE(b) - MOBILE(a));
  for (const u of us) {
    for (let step = 0; step < 3 && u.mv > 0; step++) {
      const opts = targets(S, u).filter((o) => o.k === `capture` && !o.sea);
      let best = null, bv = 0;
      for (const o of opts) {
        const P = postFor(S, n, C, o.r);
        if (!P || gate(S, n, o.r) >= 0.15) continue;
        // без «прорывов в пустоту»: рядом с войсками врага — только при опоре на два своих региона
        const R = reg(o.r);
        let eAdj = 0, fN = 0;
        for (const j of R.nb) j !== o.r && (C.en[j] && (eAdj += C.eAtk[j]), C.fr[j] && fN++);
        if (eAdj > 0 && fN < 2 && eAdj > defPow(S, u, R) * 1.6) continue;
        let v = attackValue(S, n, C, o.r, P);
        // не оставлять пустым угрожаемый регион
        const left = landIn(S, u.r).filter((v2) => v2.n === n).length - 1;
        if (left < (C.D.gar[reg(u.r).k] || 0)) continue;
        if (left <= 0 && C.thr[u.r] > 0 && C.D.post[S.ctrl[o.r]]?.p !== `A`) continue;
        left <= 0 && C.thr[u.r] > 2 && (v *= 0.5);
        v > bv && ((bv = v), (best = o));
      }
      if (!best) break;
      const from = u.r;
      occupy(S, u, best.r, best.cost);
      refreshAround(S, n, C, best.r), refreshAround(S, n, C, from);
    }
  }
}
// ——— авиация ———
function airMoves(S, n, C) {
  for (const u of S.units) {
    if (u.n !== n || u.t !== `air` || u.mv <= 0) continue;
    const opts = [u.r, ...targets(S, u).map((o) => o.r)];
    let best = u.r, bv = -1;
    for (const i of opts) {
      const R = reg(i);
      let v = 0;
      for (const [j, k] of R.near) {
        if (k > 2) continue;
        if (C.en[j]) {
          const P = postFor(S, n, C, j);
          v += P && P.p === `A` ? attackValue(S, n, C, j, P) * (landIn(S, j).length ? 1 : 0.3) : 0.3;
        } else if (C.fr[j] && C.thr[j] > 0) v += Math.min(4, C.thr[j] / 6);
      }
      C.thr[i] > 0 && (v *= 0.75);
      C.sup[i] < 0 && (v *= 0.2);
      i === u.r && (v *= 1.05);
      v > bv && ((bv = v), (best = i));
    }
    if (bv < 1.5) {
      // без дела — к фронту, где идёт наступление
      const af = airFront(S, n, C);
      if (af && af.has(u.r) ? af.get(u.r) > 0 : af) {
        let bd = af.has(u.r) ? af.get(u.r) : 99;
        for (const o of targets(S, u)) af.has(o.r) && af.get(o.r) < bd && C.sup[o.r] >= 0 && ((bd = af.get(o.r)), (best = o.r));
      }
    }
    best !== u.r && moveUnit(S, u, best, u.mv);
  }
}
function airFront(S, n, C) {
  if (C._af !== undefined) return C._af;
  const seeds = C.front.filter((i) => reg(i).nb.some((T) => C.en[T] && postFor(S, n, C, T)?.p === `A`));
  if (!seeds.length) return (C._af = null);
  const d = new Map(), q = [];
  for (const i of seeds) (d.set(i, 0), q.push(i));
  for (let k = 0; k < q.length; k++) for (const b of reg(q[k]).nb) !d.has(b) && C.fr[b] && (d.set(b, d.get(q[k]) + 1), q.push(b));
  return (C._af = d);
}
// ——— резервы: дефициты обороны, гарнизоны, сосредоточение ———
function bfsFrom(S, n, C, T, maxD = 40) {
  const d = new Map([[T, 0]]), q = [T];
  for (let k = 0; k < q.length; k++) {
    const a = q[k], da = d.get(a);
    if (da >= maxD) continue;
    for (const b of reg(a).nb) if (!d.has(b) && C.fr[b]) (d.set(b, da + 1), q.push(b));
  }
  return d;
}
// экспедиционные силы союзников Германии на Восточном фронте
// (и британский экспедиционный корпус во Франции 1939–1940 гг.)
// (и британские экспедиционные силы во Франции 1939–1940 гг. и в Греции 1941 г.)
const EXP = { ITA: [[66, 2], [82, 5], [999, 0]], HUN: [[66, 2], [82, 4], [999, 2]], SVK: [[999, 1]], BUL: [[999, 0]], UK: [[20, 3], [44, 2], [999, 999]] };
const FRZ = new Set([`FRA`, `BEL`, `NED`]), GRZ = new Set([`GRE`, `YUG`]);
function expCap(S, n) {
  const e = EXP[n];
  if (!e) return null;
  const cap = e.find(([t]) => S.t < t)[1];
  if (cap >= 999) return null;
  const Z = S.t < 20 ? FRZ : GRZ;
  const east = n === `UK` ? (i) => Z.has(S.core[i]) : (i) => S.core[i] !== n && (S.core[i] === `SOV` || reg(i).nb.some((j) => S.ctrl[j] === `SOV`));
  let k = 0;
  for (const u of S.units) u.n === n && LAND(u) && east(u.r) && k++;
  return { full: k >= cap, east };
}
// немецкие войска в Африке не уходят с театра, пока он не потерян (до 1943 г.)
const AFRS = new Set(AR(AREA.AFR));
const pinned = (S, u, T) => u.n === `GER` && S.t < 90 && AFRS.has(reg(u.r).k) && !AFRS.has(reg(T).k);
function redeploy(S, n, C) {
  const my = (i) => landIn(S, i).filter((u) => u.n === n);
  const XC = expCap(S, n);
  const cnt = (i) => my(i).length;
  const friends = (i) => landIn(S, i).filter((u) => ally(S, u.n, n)).length;
  // желаемая оборона фронта, с потолком — чтобы не собирать всё в одну «кучу»
  let avg = 0;
  for (const i of C.front) avg += wantOf(S, n, C, i);
  avg /= Math.max(1, C.front.length);
  const capW = Math.max(avg * 1.6, 8);
  const want = new Map(C.front.map((i) => [i, Math.min(wantOf(S, n, C, i), capW)]));
  const need = [];
  for (const i of C.front) {
    const R = reg(i), w = want.get(i), h = C.have[i];
    if (S.ctrl[i] === n && !friends(i)) need.push({ i, k: `cover`, n: 1, pr: 200 + regVal(R) });
    else if (h < w) need.push({ i, k: `def`, amt: w - h, pr: Math.min(150, (w - h) * regVal(R)) });
  }
  // сосредоточение для наступления у целей
  for (const i of C.front) {
    let off = 0;
    for (const T of reg(i).nb) {
      if (!C.en[T]) continue;
      const P = postFor(S, n, C, T);
      if (!P || P.p !== `A`) continue;
      let dsum = 0;
      for (const u of landIn(S, T)) dsum += defPow(S, u, reg(T));
      off = Math.max(off, dsum * 1.4 * (P.objD && P.objD[T] <= 2 ? 1.3 : 1));
    }
    const h = C.have[i];
    // цели, которые по истории уже должны быть взяты, — в первую очередь
    let due = 0;
    for (const T of reg(i).nb) C.en[T] && gate(S, n, T) < 0 && (due = 1);
    off > h && need.push({ i, k: `off`, amt: Math.min(off - h, capW * 1.5), pr: Math.min(60, (off - h) * 0.6) + due * 45 });
  }
  // эшелонирование: крупные города в одном переходе за фронтом не оставлять пустыми
  for (const i of C.front)
    for (const j of reg(i).nb) {
      const R = reg(j);
      if (!C.fr[j] || C.thr[j] > 0 || R.vp < 2 || S.ctrl[j] !== n || cnt(j) > 0 || need.some((x) => x.i === j)) continue;
      need.push({ i: j, k: `depth`, n: 1, pr: 6 + R.vp });
    }
  for (const [k, c] of Object.entries(C.D.gar)) {
    const i = idOf(k);
    // гарнизон столицы — сразу после прикрытия пустого фронта
    i && C.fr[i] && cnt(i) < c && need.push({ i, k: `gar`, n: c - cnt(i), pr: reg(i).cap ? 190 : 90 });
  }
  for (const [k, c] of Object.entries(C.D.stage)) {
    const i = idOf(k);
    i && C.fr[i] && cnt(i) < c && need.push({ i, k: `stage`, n: c - cnt(i), pr: 8 + c });
  }
  if (!need.length) return;
  need.sort((a, b) => b.pr - a.pr);
  const gar = new Map(Object.entries(C.D.gar).map(([k, c]) => [idOf(k), c]));
  const stage = new Map(Object.entries(C.D.stage).map(([k, c]) => [idOf(k), c]));
  // свободные войска: сверх нужного для обороны своего региона
  const free = new Set();
  const regs = new Map();
  for (const u of S.units) if (u.n === n && LAND(u) && u.mv > 0 && !u.at) (regs.get(u.r) || regs.set(u.r, []).get(u.r)).push(u);
  for (const [i, us] of regs) {
    const R = reg(i), all = my(i);
    const keepPow = want.get(i) || 0, keepN = Math.max(gar.get(i) || 0, stage.get(i) || 0, C.thr[i] > 0 && S.ctrl[i] === n ? 1 : 0);
    let pow = 0, num = 0;
    for (const u of all) us.includes(u) || ((pow += defPow(S, u, R)), num++);
    for (const u of landIn(S, i)) u.n !== n && ally(S, u.n, n) && ((pow += defPow(S, u, R)), num++);
    us.sort((a, b) => (a.t === `inf` ? 0 : 1) - (b.t === `inf` ? 0 : 1) || defPow(S, b, R) - defPow(S, a, R));
    for (const u of us) {
      if (pow < keepPow || num < keepN) (pow += defPow(S, u, R)), num++;
      else free.add(u);
    }
  }
  const NAT = S.nat[n];
  for (const nd of need) {
    if (!free.size) break;
    const d = bfsFrom(S, n, C, nd.i);
    const list = [...free].map((u) => ({ u, d: d.has(u.r) ? d.get(u.r) : 99 })).sort((a, b) => a.d - b.d || (nd.k === `off` ? MOBILE(b.u) - MOBILE(a.u) : MOBILE(a.u) - MOBILE(b.u)));
    let amt = nd.amt || 0, num = nd.n || 0;
    for (const { u, d: du } of list) {
      if ((nd.amt !== undefined && amt <= 0) || (nd.n !== undefined && num <= 0)) break;
      // нет пути по суше — только морем (если есть тоннаж и порт)
      if (du === 0 || (du > 24 && !(du === 99 && NAT.navl > 0 && reg(u.r).sea.length))) continue;
      if (XC && XC.full && XC.east(nd.i) && !XC.east(u.r)) continue;
      if (pinned(S, u, nd.i)) continue;
      if (go(S, u, nd.i, d, NAT)) {
        free.delete(u);
        amt -= defPow(S, u, reg(nd.i)), num--;
      }
    }
  }
  // остальные свободные — ближе к фронту
  if (C.front.length) {
    const d = new Map(), q = [];
    for (const i of C.front) (!XC || !XC.full || !XC.east(i)) && (d.set(i, 0), q.push(i));
    for (let k = 0; k < q.length; k++) for (const b of reg(q[k]).nb) !d.has(b) && C.fr[b] && (d.set(b, d.get(q[k]) + 1), q.push(b));
    for (const u of free) {
      if (XC && XC.full && !XC.east(u.r) && [...reg(u.r).nb].some((b) => XC.east(b))) continue;
      const du = d.get(u.r);
      if (u.mv <= 0) continue;
      // отрезаны от фронта морем (Британия, Африка) — перевозка в порт ближе к фронту
      if (du === undefined || du >= 6) {
        if (NAT.navl > 0 && reg(u.r).sea.length && free.has(u)) {
          let best = 0, bd = du === undefined ? 99 : du - 3;
          for (const j of seaTargets(S, u)) d.has(j) && d.get(j) < bd && !pinned(S, u, j) && ((bd = d.get(j)), (best = j));
          if (best) {
            seaMove(S, u, best);
            continue;
          }
        }
        if (du === undefined) continue;
      }
      if (du <= 1) continue;
      if (du >= 4 && NAT.rail > 0) {
        let best = 0, bd = du - 2;
        for (const j of railTargets(S, u)) d.has(j) && d.get(j) >= 1 && d.get(j) < bd && ((bd = d.get(j)), (best = j));
        if (best) {
          railMove(S, u, best);
          continue;
        }
      }
      const nx = reg(u.r).nb.filter((b) => d.has(b) && d.get(b) < du && passable(S, n, b)).sort((a, b) => d.get(a) - d.get(b))[0];
      nx && moveUnit(S, u, nx, 1);
    }
  }
}
const passable = (S, n, b) => {
  const us = landIn(S, b);
  return us.length < STACK && !us.some((v) => atWar(S, v.n, n));
};
// перемещение отряда к цели: шагом, по железной дороге или морем
function go(S, u, T, d, NAT) {
  const du = d.has(u.r) ? d.get(u.r) : 99;
  if (du <= u.mv) {
    // шагаем по убыванию расстояния
    let cur = u.r, steps = 0;
    while (cur !== T && steps < u.mv) {
      const nx = reg(cur).nb.find((b) => d.get(b) === d.get(cur) - 1 && passable(S, u.n, b));
      if (!nx) break;
      cur = nx, steps++;
    }
    if (cur === u.r) return false;
    moveUnit(S, u, cur, steps);
    return true;
  }
  if (NAT.rail > 0 && du < 99) {
    const rt = railTargets(S, u);
    let best = 0, bd = du - u.mv - 1;
    for (const j of rt) d.has(j) && d.get(j) < bd && ((bd = d.get(j)), (best = j));
    if (best) return railMove(S, u, best), true;
  }
  if (du === 99 || du > 6) {
    if (NAT.navl > 0) {
      const st = seaTargets(S, u);
      let best = 0, bd = du;
      for (const j of st) d.has(j) && d.get(j) < bd && ((bd = d.get(j)), (best = j));
      if (best) return seaMove(S, u, best), true;
    }
  }
  if (du < 99) {
    let cur = u.r, steps = 0;
    while (steps < u.mv) {
      const nx = reg(cur).nb.find((b) => d.has(b) && d.get(b) < d.get(cur) && passable(S, u.n, b));
      if (!nx) break;
      cur = nx, steps++;
    }
    if (cur !== u.r) return moveUnit(S, u, cur, steps), true;
  }
  return false;
}

// ——— производство и наука ———
// желаемые доли типов войск (по числу соединений)
const MIX = {
  GER: { inf: 0.62, arm: 0.17, mot: 0.09, air: 0.12 }, SOV: { inf: 0.7, arm: 0.15, mot: 0.03, air: 0.12 }, UK: { inf: 0.5, arm: 0.26, air: 0.24 },
  USA: { inf: 0.46, arm: 0.3, air: 0.24 }, ITA: { inf: 0.8, arm: 0.09, air: 0.11 }, FRA: { inf: 0.76, arm: 0.12, air: 0.12 }, _: { inf: 0.92, air: 0.08 },
};
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
function aiBuild(S, n, war) {
  const nat = S.nat[n];
  const inc = nat.inc || income(S, n);
  let pend = nat.q.reduce((s, q) => s + q.need - q.paid, 0);
  const mine = S.units.filter((u) => u.n === n);
  if (!war && mine.length >= Math.max(3, G.R.filter((R) => S.ctrl[R.i] === n).length * (n === `SOV` ? 1.2 : 0.6))) return;
  const cap = inc.pp * (war ? 2.6 : 1.6) + 10;
  const y = tDate(S.t).y, mix = { ...(MIX[n] || MIX._) };
  y >= 1943 && mix.arm && ((mix.arm += 0.04), (mix.inf -= 0.04));
  const oilOK = nat.oil > 25 || (inc.oil || 0) - upkeep(S, n) > 1.5;
  const have = {};
  let tot = 0;
  for (const u of mine) (have[u.t] = (have[u.t] || 0) + 1), tot++;
  for (const q of nat.q) ITEMS[q.k].u && ((have[q.k] = (have[q.k] || 0) + 1), tot++);
  for (let g = 0; g < 4 && pend < cap; g++) {
    let k = null, bv = -9;
    for (const [t, w] of Object.entries(mix)) {
      const c = itemCost(t);
      if (c.oil && !oilOK) continue;
      if (nat.mp - c.mp < 6 || !canBuy(S, n, t)) continue;
      const v = w - (have[t] || 0) / Math.max(1, tot);
      v > bv && ((bv = v), (k = t));
    }
    if (!k) break;
    // оборонительные рубежи: Германия с конца 1943 г., СССР в 1941–1942 гг.
    if (war && g === 0 && ((n === `GER` && S.t >= 96) || (n === `SOV` && S.t >= 44 && S.t < 80)) && rnd(S) < 0.5) {
      const fr = aiFortSite(S, n);
      if (fr && canBuy(S, n, `fort`)) {
        buy(S, n, `fort`, fr);
        pend += itemCost(`fort`).pp;
        continue;
      }
    }
    buy(S, n, k, war ? aiDeploy(S, n) : 0);
    have[k] = (have[k] || 0) + 1, tot++;
    pend += itemCost(k).pp;
  }
}

// где строить укрепрайон: свой регион у фронта (или во втором эшелоне) с крупным городом, где укреплений ещё мало
function aiFortSite(S, n) {
  let best = 0, bv = 0;
  for (const R of G.R) {
    if (S.ctrl[R.i] !== n || (S.fort[R.i] || 0) >= 2 || S.nat[n].q.some((q) => q.k === `fort` && q.r === R.i)) continue;
    const adj = R.nb.some((j) => S.ctrl[j] && atWar(S, S.ctrl[j], n)), adj2 = !adj && R.nb.some((j) => reg(j).nb.some((q) => S.ctrl[q] && atWar(S, S.ctrl[q], n)));
    if (!adj && !adj2) continue;
    const v = (R.vp + R.ic * 0.5 + (R.cap ? 4 : 0)) * (adj2 ? 1.2 : 1) * (R.t === `mo` || R.t === `fo` ? 1.2 : 1);
    v > bv && ((bv = v), (best = R.i));
  }
  return bv >= 2.5 ? best : 0;
}
// ——— ход державы под управлением ИИ ———
export function aiTurn(S, n) {
  if (!alive(S, n)) return;
  const D = dirFor(S, n);
  const war = Object.keys(S.nat).some((e) => alive(S, e) && atWar(S, n, e));
  aiResearch(S, n);
  aiBuild(S, n, war);
  if (!war && !Object.keys(D.stage).length && !Object.keys(D.gar).length) return;
  const C = ctx(S, n, D);
  airMoves(S, n, C);
  attacks(S, n, C);
  captures(S, n, C);
  redeploy(S, n, C);
  void rnd;
}
export const _dbg = { ctx, dirFor, postFor, pickAttack, attackValue, gate };
