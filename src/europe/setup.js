// «Европа 1939–1945» (v0.6.1): стартовое состояние — державы, экономика, дивизии на 1 сентября 1939.
// В провинции — одна дивизия. Сила дивизии 1–10, организация — до предела державы.
import { NATIONS } from './regions.js';
import { G, spawn, addWar } from './rules.js';

// Экономика держав: склад ПП / нефть / люди, техника, коэффициенты, авиаполки, предел организации
const NI = {
  GER: { pp: 40, oil: 60, mp: 30, tech: { inf: 1, arm: 1, air: 1, ind: 0 }, eco: 0.36, mpk: 0.2, imp: { pp: 2, oil: 3 }, reinf: 0.5, res: `arm`, air: 7, om: 100 },
  ITA: { pp: 15, oil: 20, mp: 15, tech: { air: 1 }, eco: 0.34, mpk: 0.2, imp: { oil: 2 }, air: 3, om: 80 },
  POL: { pp: 6, oil: 5, mp: 12, eco: 0.35, mpk: 0.2, air: 1, om: 80 },
  FRA: { pp: 25, oil: 25, mp: 20, tech: { inf: 1 }, eco: 0.42, mpk: 0.2, imp: { pp: 2, oil: 4 }, air: 3, om: 90 },
  UK: { pp: 30, oil: 40, mp: 15, tech: { air: 1 }, eco: 0.42, mpk: 0.2, imp: { pp: 4, oil: 6, mp: 3 }, res: `air`, arrive: [`london`, `portsmouth`, `birmingham`], air: 5, om: 100 },
  SOV: { pp: 40, oil: 50, mp: 40, tech: { arm: 1 }, eco: 0.28, mpk: 0.2, res: `ind`, air: 5, om: 75 },
  FIN: { pp: 8, oil: 6, mp: 10, eco: 0.35, tech: { inf: 1 }, air: 1, om: 100 },
  USA: { pp: 0, oil: 20, mp: 10, tech: { inf: 1, arm: 1, air: 1, ind: 1 }, eco: 1, mpk: 1, imp: {}, arrive: [`bristol`, `manchester`, `glasgow`, `belfast`, `portsmouth`, `cardiff`, `norwich`], ports: 1, om: 100 },
  ROM: { air: 1, om: 75 }, HUN: { om: 75 }, BUL: { om: 75 }, SVK: { om: 70 },
};
const DEF = { pp: 5, oil: 5, mp: 8, eco: 0.35, mpk: 0.2, reinf: 0.5, air: 0, om: 80 };

// ОШС: [держава, тип, провинция, сила, название?, организация?]
const OOB = [
  // Германия: группы армий «Север» (Померания, Пруссия) и «Юг» (Силезия, Моравия), группа армий «Ц» на Западе
  [`GER`, `arm`, `breslau`, 10], [`GER`, `arm`, `brno`, 9], [`GER`, `arm`, `stettin`, 9], [`GER`, `arm`, `dresden`, 8],
  [`GER`, `mot`, `leipzig`, 9, `2-я моторизованная дивизия`],
  [`GER`, `inf`, `konigsberg`, 10], [`GER`, `inf`, `danzig`, 7], [`GER`, `inf`, `berlin`, 9], [`GER`, `inf`, `prague`, 9], [`GER`, `inf`, `vienna`, 9],
  [`GER`, `inf`, `saar`, 9, null, 70], [`GER`, `inf`, `koln`, 9, null, 70], [`GER`, `inf`, `stuttgart`, 8, null, 70], [`GER`, `inf`, `ruhr`, 8, null, 70],
  [`GER`, `inf`, `hamburg`, 7, null, 70], [`GER`, `art`, `frankfurt`, 8],
  // Польша
  [`POL`, `inf`, `pomorze`, 9, `Армия «Поморье»`], [`POL`, `inf`, `poznan`, 10, `Армия «Познань»`], [`POL`, `inf`, `lodz`, 10, `Армия «Лодзь»`],
  [`POL`, `inf`, `krakow`, 10, `Армия «Краков»`], [`POL`, `cav`, `kielce`, 8, `Армия «Пруссы»`], [`POL`, `inf`, `warsaw`, 10, `Армия «Модлин»`],
  [`POL`, `inf`, `bialystok`, 7, `ОГ «Нарев»`], [`POL`, `inf`, `lwow`, 7, `Армия «Карпаты»`], [`POL`, `inf`, `lublin`, 6, `Армия «Люблин»`], [`POL`, `cav`, `wilno`, 5, `Виленская кав. бригада`],
  // Франция и колонии
  [`FRA`, `inf`, `metz`, 10], [`FRA`, `inf`, `strasbourg`, 10], [`FRA`, `inf`, `reims`, 10], [`FRA`, `inf`, `dijon`, 8], [`FRA`, `arm`, `paris`, 8, `1-я бронетанковая дивизия`],
  [`FRA`, `mot`, `orleans`, 8, `1-я лёгкая механизированная дивизия`], [`FRA`, `inf`, `normandy`, 7], [`FRA`, `inf`, `grenoble`, 9], [`FRA`, `inf`, `marseille`, 7],
  [`FRA`, `inf`, `tunis`, 7], [`FRA`, `inf`, `gabes`, 6], [`FRA`, `inf`, `algiers`, 6], [`FRA`, `inf`, `casablanca`, 6], [`FRA`, `inf`, `damascus`, 7, `Армия Леванта`],
  // Британская империя
  [`UK`, `inf`, `lille`, 9], [`UK`, `inf`, `london`, 9], [`UK`, `inf`, `portsmouth`, 8], [`UK`, `inf`, `glasgow`, 7], [`UK`, `arm`, `birmingham`, 7],
  [`UK`, `arm`, `alexandria`, 8, `7-я бронетанковая дивизия`], [`UK`, `inf`, `matruh`, 8, `4-я индийская дивизия`], [`UK`, `inf`, `cairo`, 7, `2-я новозеландская дивизия`],
  [`UK`, `inf`, `palestine`, 6, `1-я кавалерийская дивизия`], [`UK`, `inf`, `malta`, 4, `Гарнизон Мальты`], [`UK`, `inf`, `gibraltar`, 4, `Гарнизон Гибралтара`], [`UK`, `inf`, `baghdad`, 5, `Иракские части`],
  // Италия
  [`ITA`, `inf`, `turin`, 10], [`ITA`, `inf`, `milan`, 9], [`ITA`, `inf`, `venice`, 9], [`ITA`, `inf`, `trieste`, 7], [`ITA`, `inf`, `rome`, 9], [`ITA`, `inf`, `naples`, 7],
  [`ITA`, `inf`, `sicily`, 8], [`ITA`, `inf`, `sardinia`, 6], [`ITA`, `inf`, `albania`, 8, `Войска Албании`, 60], [`ITA`, `inf`, `tripoli`, 9, `5-я армия`],
  [`ITA`, `inf`, `benghazi`, 8], [`ITA`, `inf`, `tobruk`, 9, `10-я армия`], [`ITA`, `arm`, `bologna`, 7, `Танковая дивизия «Ариете»`],
  // СССР
  [`SOV`, `inf`, `minsk`, 10], [`SOV`, `inf`, `vitebsk`, 9], [`SOV`, `arm`, `bobruisk`, 8], [`SOV`, `inf`, `gomel`, 8], [`SOV`, `inf`, `zhitomir`, 9], [`SOV`, `arm`, `proskurov`, 8],
  [`SOV`, `inf`, `vinnitsa`, 9], [`SOV`, `inf`, `kiev`, 10], [`SOV`, `inf`, `odessa`, 8], [`SOV`, `inf`, `crimea`, 7], [`SOV`, `inf`, `leningrad`, 10], [`SOV`, `inf`, `pskov`, 8],
  [`SOV`, `inf`, `petrozavodsk`, 9], [`SOV`, `inf`, `murmansk`, 7], [`SOV`, `inf`, `belomorsk`, 6], [`SOV`, `inf`, `smolensk`, 9], [`SOV`, `inf`, `velikiye_luki`, 7],
  [`SOV`, `inf`, `moscow`, 10], [`SOV`, `inf`, `kharkov`, 8], [`SOV`, `inf`, `rostov`, 7], [`SOV`, `inf`, `stalingrad`, 6], [`SOV`, `inf`, `tbilisi`, 8], [`SOV`, `inf`, `baku`, 6],
  [`SOV`, `inf`, `mogilev`, 7], [`SOV`, `cav`, `chernigov`, 8], [`SOV`, `cav`, `kursk`, 7], [`SOV`, `art`, `novgorod`, 7],
  // малые страны
  [`FIN`, `inf`, `viipuri`, 10, `Армия Карельского перешейка`], [`FIN`, `inf`, `kuopio`, 7, `IV корпус`], [`FIN`, `inf`, `oulu`, 6, `Северная группа`], [`FIN`, `inf`, `helsinki`, 7],
  [`EST`, `inf`, `tallinn`, 5], [`LAT`, `inf`, `riga`, 6], [`LIT`, `inf`, `kaunas`, 5],
  [`ROM`, `inf`, `iasi`, 8], [`ROM`, `inf`, `kishinev`, 8], [`ROM`, `inf`, `chernovtsy`, 6], [`ROM`, `inf`, `cluj`, 8], [`ROM`, `inf`, `bucharest`, 8], [`ROM`, `inf`, `constanta`, 5],
  [`HUN`, `inf`, `budapest`, 9], [`HUN`, `inf`, `debrecen`, 7], [`SVK`, `inf`, `presov`, 7, `Полевая армия «Бернолак»`], [`SVK`, `inf`, `bratislava`, 6],
  [`YUG`, `inf`, `belgrade`, 9], [`YUG`, `inf`, `zagreb`, 8], [`YUG`, `inf`, `ljubljana`, 7], [`YUG`, `inf`, `sarajevo`, 7], [`YUG`, `inf`, `skopje`, 8],
  [`GRE`, `inf`, `ioannina`, 9, `Армия Эпира`], [`GRE`, `inf`, `salonika`, 9, `Армия Восточной Македонии`], [`GRE`, `inf`, `athens`, 7], [`GRE`, `inf`, `crete`, 5],
  [`BUL`, `inf`, `sofia`, 9], [`BUL`, `inf`, `plovdiv`, 7], [`BUL`, `inf`, `varna`, 5],
  [`TUR`, `inf`, `istanbul`, 10], [`TUR`, `inf`, `ankara`, 7], [`TUR`, `inf`, `erzurum`, 9], [`TUR`, `inf`, `izmir`, 6], [`TUR`, `inf`, `adana`, 6],
  [`ESP`, `inf`, `madrid`, 10], [`ESP`, `inf`, `barcelona`, 7], [`ESP`, `inf`, `seville`, 7], [`ESP`, `inf`, `bilbao`, 6], [`ESP`, `inf`, `tetouan`, 6],
  [`POR`, `inf`, `lisbon`, 6], [`SUI`, `inf`, `bern`, 10], [`SWE`, `inf`, `stockholm`, 9], [`SWE`, `inf`, `goteborg`, 6], [`SWE`, `inf`, `kiruna`, 5],
  [`NOR`, `inf`, `oslo`, 6], [`NOR`, `inf`, `bergen`, 4], [`NOR`, `inf`, `trondheim`, 4], [`NOR`, `inf`, `narvik`, 5], [`DEN`, `inf`, `denmark`, 4],
  [`BEL`, `inf`, `brussels`, 9], [`BEL`, `inf`, `liege`, 9], [`NED`, `inf`, `amsterdam`, 8], [`IRL`, `inf`, `dublin`, 5],
  [`IRN`, `inf`, `tehran`, 6], [`IRN`, `inf`, `tabriz`, 5], [`IRN`, `inf`, `khuzestan`, 4],
];
// опыт на старте: вермахт обстрелян в Испании и Чехословакии, финны — лучшие лыжники
const XP0 = { GER: 3, FIN: 3 };

export function newState(o = {}) {
  const S = {
    v: 2, rs: (o.seed ?? 1939) >>> 0, t: 0, player: o.player || null, diff: o.diff ?? 1,
    ctrl: [null], core: [null], fort: [0], fortN: [null], held: [0], icAdd: [0],
    units: [], nid: 0, nat: {}, wars: [], coop: [], noWar: [], log: [], bat: [], caps: [], done: {}, news: [], _ver: 1, histOn: o.hist ?? true,
  };
  for (const R of G.R) S.ctrl[R.i] = R.own, (S.core[R.i] = R.own), (S.fort[R.i] = R.fort), (S.fortN[R.i] = R.fort ? R.own : null), (S.held[R.i] = -99), (S.icAdd[R.i] = 0);
  for (const n of Object.keys(NATIONS)) {
    const b = { ...DEF, ...(NI[n] || {}) };
    S.nat[n] = {
      side: NATIONS[n].side, dead: false, pp: b.pp, oil: b.oil, mp: b.mp,
      tech: { inf: 0, arm: 0, air: 0, ind: 0, ...(b.tech || {}) }, res: b.res || null, rp: 0, reinf: b.reinf ?? 0.5,
      eco: b.eco, imp: { ...(b.imp || {}) }, mpk: b.mpk, qmul: b.qmul || 1, orgMax: b.om || 100, rail: 0, navl: 0, nav2: [], sealion: false, winter: false,
      surp: -9, arrive: b.arrive || [], ports: b.ports || 0, cnt: {}, lost: 0, kills: 0, built: 0, inc: null, airMax: b.air || 0, air: 0,
    };
  }
  // 1939: Италия — невоюющий союзник, США — вне войны
  S.nat.ITA.side = null;
  S.nat.USA.side = null;
  for (const [n, t, k, s, nm, org] of OOB) {
    const R = G.byKey[k];
    if (!R) throw new Error(`OOB: нет провинции ${k}`);
    if (S.units.some((u) => u.r === R.i)) throw new Error(`OOB: в провинции ${k} уже есть дивизия`);
    const om = S.nat[n].orgMax;
    spawn(S, n, t, R.i, s, { nm: nm || undefined, o: Math.round(((org ?? (n === `GER` ? 100 : 90)) / 100) * om), x: XP0[n] || 0, e: n === `GER` || n === `POL` ? 0 : 1 });
  }
  // 1 сентября: Германия и Словакия против Польши, 3 сентября — Англия и Франция против Германии
  for (const [a, b] of [[`GER`, `POL`], [`SVK`, `POL`], [`UK`, `GER`], [`FRA`, `GER`], [`UK`, `SVK`], [`FRA`, `SVK`]]) addWar(S, a, b);
  S.noWar.push(`BUL|SOV`);
  return S;
}
