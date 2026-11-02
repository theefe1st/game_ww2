// «Европа 1939–1945»: стартовое состояние — державы, экономика, ОШС на 1 сентября 1939.
import { NATIONS, REGIONS } from './regions.js';
import { G, spawn, addWar } from './rules.js';

// Экономика и состояние держав: склад ПП/нефть/сталь/люди, техника, коэффициенты
const NI = {
  GER: { pp: 40, oil: 70, st: 40, mp: 30, tech: { inf: 1, arm: 1, air: 1, ind: 0 }, eco: 0.27, mpk: 0.08, imp: { st: 5, oil: 3 }, reinf: 0.45, res: `arm` },
  ITA: { pp: 15, oil: 25, st: 8, mp: 20, tech: { inf: 0, arm: 0, air: 1, ind: 0 }, eco: 0.24, mpk: 0.07, imp: { oil: 2, co: 4, st: 2 } },
  POL: { pp: 8, oil: 5, st: 5, mp: 15, eco: 0.25, mpk: 0.08 },
  FRA: { pp: 30, oil: 30, st: 15, mp: 25, tech: { inf: 1, arm: 0, air: 0, ind: 0 }, eco: 0.28, mpk: 0.08, imp: { oil: 4, st: 2 } },
  UK: { pp: 30, oil: 40, st: 20, mp: 20, tech: { inf: 0, arm: 0, air: 1, ind: 0 }, eco: 0.3, mpk: 0.07, imp: { pp: 4, oil: 6, st: 3, mp: 3 }, res: `air`, arrive: [`london`, `portsmouth`, `birmingham`] },
  SOV: { pp: 40, oil: 50, st: 20, mp: 50, tech: { inf: 0, arm: 1, air: 0, ind: 0 }, eco: 0.24, mpk: 0.1, res: `ind`, qmul: 0.85, imp: { co: 8 } },
  FIN: { pp: 10, oil: 8, st: 4, mp: 14, eco: 0.3, tech: { inf: 1 } },
  USA: { pp: 0, oil: 20, st: 10, mp: 10, tech: { inf: 1, arm: 1, air: 1, ind: 1 }, eco: 1, mpk: 1, imp: {}, arrive: [`bristol`, `manchester`, `glasgow`, `belfast`, `portsmouth`] },
};
const DEF = { pp: 5, oil: 5, st: 3, mp: 8, eco: 0.22, mpk: 0.08, reinf: 0.5 };

// ОШС: [держава, тип, регион, сила, название]
const OOB = [
  // Германия: группы армий «Север» и «Юг» против Польши, группа армий «Ц» на Западе
  [`GER`, `inf`, `konigsberg`, 7, `3-я армия`], [`GER`, `mot`, `konigsberg`, 3, `ТД «Кемпф»`],
  [`GER`, `inf`, `stettin`, 7, `4-я армия`], [`GER`, `arm`, `stettin`, 4, `XIX мк (Гудериан)`],
  [`GER`, `inf`, `breslau`, 6, `8-я армия`], [`GER`, `inf`, `breslau`, 8, `10-я армия`], [`GER`, `arm`, `breslau`, 5, `XVI мк (Гёпнер)`], [`GER`, `mot`, `breslau`, 4, `XIV мк (Витерсгейм)`],
  [`GER`, `inf`, `brno`, 7, `14-я армия`], [`GER`, `arm`, `brno`, 3, `XXII мк (Клейст)`],
  [`GER`, `air`, `stettin`, 6, `1-й воздушный флот`], [`GER`, `air`, `breslau`, 6, `4-й воздушный флот`],
  [`GER`, `inf`, `saar`, 7, `1-я армия`, 55], [`GER`, `inf`, `koln`, 5, `5-я армия`, 55], [`GER`, `inf`, `stuttgart`, 5, `7-я армия`, 55],
  [`GER`, `inf`, `hamburg`, 3, `Резервная армия`, 50], [`GER`, `inf`, `berlin`, 3, `Армия резерва ОКХ`, 50], [`GER`, `air`, `ruhr`, 4, `2-й воздушный флот`],
  // Польша
  [`POL`, `inf`, `pomorze`, 4, `Армия «Поморье»`], [`POL`, `inf`, `poznan`, 5, `Армия «Познань»`], [`POL`, `inf`, `lodz`, 5, `Армия «Лодзь»`],
  [`POL`, `inf`, `krakow`, 6, `Армия «Краков»`], [`POL`, `inf`, `warsaw`, 4, `Армия «Модлин»`], [`POL`, `inf`, `warsaw`, 5, `Армия «Пруссы»`],
  [`POL`, `inf`, `bialystok`, 2, `ОГ «Нарев»`], [`POL`, `inf`, `lwow`, 3, `Армия «Карпаты»`], [`POL`, `mot`, `kielce`, 2, `10-я кав. бригада`], [`POL`, `air`, `warsaw`, 2, `Польская авиация`],
  // Франция
  [`FRA`, `inf`, `metz`, 7, `3-я армия`], [`FRA`, `inf`, `strasbourg`, 6, `5-я армия`], [`FRA`, `inf`, `lille`, 7, `1-я армия`], [`FRA`, `mot`, `lille`, 3, `Кавалерийский корпус`],
  [`FRA`, `inf`, `reims`, 5, `9-я армия`], [`FRA`, `inf`, `reims`, 5, `2-я армия`], [`FRA`, `inf`, `dijon`, 4, `8-я армия`],
  [`FRA`, `inf`, `paris`, 5, `7-я армия`], [`FRA`, `arm`, `paris`, 4, `Бронетанковые дивизии`], [`FRA`, `inf`, `grenoble`, 4, `Альпийская армия`],
  [`FRA`, `inf`, `tunis`, 3, `Армия Туниса`], [`FRA`, `inf`, `algiers`, 2, `19-й корпус`], [`FRA`, `inf`, `casablanca`, 2, `Войска Марокко`], [`FRA`, `inf`, `damascus`, 3, `Армия Леванта`],
  [`FRA`, `air`, `paris`, 5, `ВВС Франции`], [`FRA`, `air`, `reims`, 3, `Северная авиагруппа`],
  // Британская империя
  [`UK`, `inf`, `london`, 3, `I корпус БЭС`], [`UK`, `inf`, `portsmouth`, 2, `II корпус БЭС`], [`UK`, `inf`, `newcastle`, 2, `Северное командование`], [`UK`, `inf`, `glasgow`, 1, `Шотландское командование`],
  [`UK`, `arm`, `london`, 2, `1-я бронетанковая дивизия`], [`UK`, `air`, `london`, 6, `Истребительное командование`], [`UK`, `air`, `birmingham`, 3, `Бомбардировочное командование`],
  [`UK`, `inf`, `cairo`, 2, `Западная пустынная группа`], [`UK`, `arm`, `alexandria`, 2, `7-я бронетанковая дивизия`], [`UK`, `inf`, `matruh`, 2, `4-я индийская дивизия`],
  [`UK`, `inf`, `palestine`, 2, `Войска Палестины`], [`UK`, `inf`, `malta`, 1, `Гарнизон Мальты`], [`UK`, `inf`, `gibraltar`, 1, `Гарнизон Гибралтара`], [`UK`, `inf`, `baghdad`, 1, `Иракские части`],
  [`UK`, `air`, `alexandria`, 3, `КВВС на Ближнем Востоке`],
  // Италия
  [`ITA`, `inf`, `turin`, 5, `1-я армия`], [`ITA`, `inf`, `milan`, 4, `4-я армия`], [`ITA`, `inf`, `venice`, 4, `2-я армия`], [`ITA`, `inf`, `trieste`, 3, `11-й корпус`],
  [`ITA`, `inf`, `rome`, 3, `Армия По`], [`ITA`, `inf`, `naples`, 2, `Резерв`], [`ITA`, `inf`, `sicily`, 3, `6-я армия`], [`ITA`, `inf`, `sardinia`, 1, `Гарнизон Сардинии`],
  [`ITA`, `inf`, `albania`, 4, `Войска Албании`, 60], [`ITA`, `inf`, `tripoli`, 5, `5-я армия`], [`ITA`, `inf`, `tobruk`, 4, `10-я армия`], [`ITA`, `inf`, `benghazi`, 3, `Резерв Ливии`],
  [`ITA`, `arm`, `milan`, 2, `ТД «Ариете»`], [`ITA`, `air`, `rome`, 5, `Королевские ВВС Италии`], [`ITA`, `air`, `sicily`, 3, `2-я авиадивизия`],
  // СССР
  [`SOV`, `inf`, `minsk`, 7, `4-я армия`], [`SOV`, `inf`, `vitebsk`, 5, `3-я армия`], [`SOV`, `inf`, `bobruisk`, 5, `10-я армия`], [`SOV`, `arm`, `bobruisk`, 3, `15-й танковый корпус`],
  [`SOV`, `inf`, `zhitomir`, 5, `5-я армия`], [`SOV`, `inf`, `proskurov`, 6, `6-я армия`], [`SOV`, `inf`, `vinnitsa`, 4, `12-я армия`], [`SOV`, `arm`, `kiev`, 4, `25-й танковый корпус`],
  [`SOV`, `inf`, `leningrad`, 7, `7-я армия`], [`SOV`, `inf`, `petrozavodsk`, 4, `8-я армия`], [`SOV`, `inf`, `murmansk`, 3, `14-я армия`], [`SOV`, `inf`, `belomorsk`, 2, `9-я армия`],
  [`SOV`, `inf`, `moscow`, 5, `Московский ВО`], [`SOV`, `inf`, `kharkov`, 3, `Харьковский ВО`], [`SOV`, `inf`, `odessa`, 3, `Одесский ВО`], [`SOV`, `inf`, `crimea`, 2, `9-й особый корпус`],
  [`SOV`, `inf`, `tbilisi`, 3, `Закавказский ВО`], [`SOV`, `inf`, `kiev`, 3, `Киевский ВО`],
  [`SOV`, `air`, `minsk`, 6, `ВВС Белорусского ВО`], [`SOV`, `air`, `kiev`, 5, `ВВС Киевского ВО`], [`SOV`, `air`, `leningrad`, 4, `ВВС Ленинградского ВО`],
  // малые страны
  [`FIN`, `inf`, `viipuri`, 5, `Армия Карельского перешейка`], [`FIN`, `inf`, `kuopio`, 2, `IV корпус`], [`FIN`, `inf`, `oulu`, 1, `Северная группа`], [`FIN`, `inf`, `helsinki`, 2, `Резерв`], [`FIN`, `air`, `helsinki`, 1, `ВВС Финляндии`],
  [`EST`, `inf`, `tallinn`, 2], [`LAT`, `inf`, `riga`, 2], [`LIT`, `inf`, `kaunas`, 2],
  [`ROM`, `inf`, `iasi`, 3], [`ROM`, `inf`, `kishinev`, 3], [`ROM`, `inf`, `cluj`, 3], [`ROM`, `inf`, `bucharest`, 3], [`ROM`, `inf`, `constanta`, 1], [`ROM`, `air`, `bucharest`, 1],
  [`HUN`, `inf`, `budapest`, 4], [`HUN`, `inf`, `debrecen`, 2], [`SVK`, `inf`, `bratislava`, 2, `Полевая армия «Бернолак»`],
  [`YUG`, `inf`, `belgrade`, 4], [`YUG`, `inf`, `zagreb`, 3], [`YUG`, `inf`, `ljubljana`, 2], [`YUG`, `inf`, `sarajevo`, 2], [`YUG`, `inf`, `skopje`, 3],
  [`GRE`, `inf`, `ioannina`, 3, `Армия Эпира`], [`GRE`, `inf`, `salonika`, 3, `Армия Восточной Македонии`], [`GRE`, `inf`, `athens`, 2], [`GRE`, `inf`, `crete`, 1],
  [`BUL`, `inf`, `sofia`, 3], [`BUL`, `inf`, `plovdiv`, 2], [`BUL`, `inf`, `varna`, 1],
  [`TUR`, `inf`, `istanbul`, 4], [`TUR`, `inf`, `ankara`, 2], [`TUR`, `inf`, `erzurum`, 3], [`TUR`, `inf`, `izmir`, 2], [`TUR`, `inf`, `adana`, 2],
  [`ESP`, `inf`, `madrid`, 4], [`ESP`, `inf`, `barcelona`, 2], [`ESP`, `inf`, `seville`, 2], [`ESP`, `inf`, `bilbao`, 2], [`ESP`, `inf`, `tetouan`, 2],
  [`POR`, `inf`, `lisbon`, 2], [`SUI`, `inf`, `bern`, 4], [`SWE`, `inf`, `stockholm`, 3], [`SWE`, `inf`, `goteborg`, 1], [`SWE`, `inf`, `kiruna`, 1],
  [`NOR`, `inf`, `oslo`, 2], [`NOR`, `inf`, `bergen`, 1], [`NOR`, `inf`, `trondheim`, 1], [`NOR`, `inf`, `narvik`, 1], [`DEN`, `inf`, `denmark`, 1],
  [`BEL`, `inf`, `brussels`, 4], [`BEL`, `inf`, `liege`, 4], [`NED`, `inf`, `amsterdam`, 4], [`IRL`, `inf`, `dublin`, 1],
  [`IRN`, `inf`, `tehran`, 2], [`IRN`, `inf`, `tabriz`, 1], [`IRN`, `inf`, `khuzestan`, 1],
];

export function newState(o = {}) {
  const NR = REGIONS.length;
  const S = {
    v: 1, rs: (o.seed ?? 1939) >>> 0, t: 0, player: o.player || null, diff: o.diff ?? 1,
    ctrl: [null], core: [null], fort: [0], fortN: [null], held: [0], icAdd: [0],
    units: [], nid: 0, nat: {}, wars: [], coop: [], noWar: [], log: [], bat: [], caps: [], done: {}, news: [], _ver: 1, histOn: o.hist ?? true,
  };
  for (const R of G.R) S.ctrl[R.i] = R.own, (S.core[R.i] = R.own), (S.fort[R.i] = R.fort), (S.fortN[R.i] = R.fort ? R.own : null), (S.held[R.i] = -99), (S.icAdd[R.i] = 0);
  void NR;
  for (const n of Object.keys(NATIONS)) {
    const b = { ...DEF, ...(NI[n] || {}) };
    S.nat[n] = {
      side: NATIONS[n].side, dead: false, pp: b.pp, oil: b.oil, st: b.st, mp: b.mp,
      tech: { inf: 0, arm: 0, air: 0, ind: 0, ...(b.tech || {}) }, res: b.res || null, rp: 0, q: [], reinf: b.reinf ?? 0.45,
      eco: b.eco, imp: { ...(b.imp || {}) }, mpk: b.mpk, qmul: b.qmul || 1, orgMax: 100, rail: 0, navl: 0, nav2: [], sealion: false, winter: false,
      surp: -9, arrive: b.arrive || [], cnt: {}, lost: 0, inc: null,
    };
  }
  // 1939: Италия — невоюющий союзник, США — вне войны
  S.nat.ITA.side = null;
  S.nat.USA.side = null;
  for (const [n, t, k, s, nm, org] of OOB) {
    const R = G.byKey[k];
    if (!R) throw new Error(`OOB: нет региона ${k}`);
    spawn(S, n, t, R.i, s, { nm, o: org ?? (n === `GER` ? 80 : 70), x: n === `GER` ? 20 : n === `FIN` ? 15 : 0 });
  }
  // 1 сентября: Германия и Словакия против Польши, 3 сентября — Англия и Франция против Германии
  for (const [a, b] of [[`GER`, `POL`], [`SVK`, `POL`], [`UK`, `GER`], [`FRA`, `GER`], [`UK`, `SVK`], [`FRA`, `SVK`]]) addWar(S, a, b);
  S.noWar.push(`BUL|SOV`);
  return S;
}
