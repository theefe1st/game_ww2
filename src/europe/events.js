// «Европа 1939–1945»: исторические события, капитуляции, разделы, ленд-лиз, мобилизация.
import { NATIONS } from './regions.js';
import { G, reg, UT, LAND, STACK, alive, ally, atWar, addWar, declareWar, makePeace, joinSide, pairKey, side, members, landIn, unitsIn, spawn, kill, touch, vpState, capitalLost, battle, supply } from './rules.js';

const I = (k) => G.byKey[k]?.i || 0;
const W = (s) => s.split(` `);
export const news = (S, ttl, txt, k = `ev`) => S.news.push({ t: S.t, ttl, txt, k });
// передать регионы (ключи) державе; core — сменить и «исконного» владельца
export function give(S, keys, to, core = false) {
  for (const k of typeof keys === `string` ? W(keys) : keys) {
    const i = I(k);
    if (!i) continue;
    S.ctrl[i] = to, (S.held[i] = S.t);
    core && (S.core[i] = to);
  }
  S._ver++;
  relocate(S);
}
// войска в чужих (не союзных) регионах уходят к своим или гибнут
export function relocate(S, loss = 0.85) {
  for (const u of [...S.units]) {
    const c = S.ctrl[u.r];
    if (c && ally(S, c, u.n)) continue;
    const seen = new Set([u.r]), q = [u.r];
    let to = 0;
    for (let k = 0; k < q.length && !to && k < 400; k++) {
      const R = reg(q[k]);
      for (const b of [...R.nb, ...R.sea2.map((s) => s[0])]) {
        if (seen.has(b)) continue;
        seen.add(b), q.push(b);
        const cb = S.ctrl[b];
        if (cb && ally(S, cb, u.n) && landIn(S, b).length < STACK && !landIn(S, b).some((v) => !ally(S, v.n, u.n))) {
          to = b;
          break;
        }
      }
    }
    if (to) ((u.r = to), (u.s *= loss), (u.o = Math.min(u.o, 40)), (u.ent = 0), touch(S));
    else kill(S, u);
  }
}
// поставить войска в первый подходящий регион из списка
export function place(S, n, keys, t, s, nm, o = 55) {
  for (const k of typeof keys === `string` ? W(keys) : keys) {
    const i = I(k), c = S.ctrl[i];
    if (!i || !c || !ally(S, c, n) || landIn(S, i).length >= STACK || landIn(S, i).some((v) => atWar(S, v.n, n))) continue;
    return spawn(S, n, t, i, s, { nm, o, x: 10 });
  }
  return null;
}
// смена стороны: мир со всеми, вступление в блок с наследованием войн лидера
export function switchSide(S, n, s) {
  S.wars = S.wars.filter((k) => !k.split(`|`).includes(n));
  if (s) joinSide(S, n, s);
  else ((S.nat[n].side = null), S._ver++);
  relocate(S);
}
// ——— капитуляции ———
const PART = {
  POL: { GER: `warsaw lodz krakow poznan pomorze kielce lublin`, SOV: `bialystok brest rowne lwow stanislawow`, LIT: `wilno` },
  YUG: { GER: `belgrade zagreb sarajevo`, ITA: `ljubljana split`, BUL: `skopje`, HUN: `` },
  GRE: { GER: `athens salonika crete`, ITA: `ioannina` },
  IRN: { SOV: `tabriz`, UK: `tehran khuzestan` },
};
const CAP_K = { POL: 0.85, FRA: 0.42, UK: 0.55, SOV: 0.85, GER: 0.85, ITA: 0.55, NOR: 0.85, YUG: 0.45, GRE: 0.6, FIN: 0.6, _: 0.5 };
const CAP_C = { FRA: 0.2, UK: 0.3, SOV: 0.6, GER: 0.3, POL: 0.45, NOR: 0.85, FIN: 0.6, GRE: 0.45, _: 0.25 };
// доля потерянных очков побед — только у воюющих противников
function lostK(S, n) {
  let core = 0, lost = 0;
  for (const R of G.R) {
    if (S.core[R.i] !== n) continue;
    core += R.vp;
    const c = S.ctrl[R.i];
    c && c !== n && atWar(S, c, n) && (lost += R.vp);
  }
  return { core, k: core ? lost / core : 0 };
}
// главный победитель — держава, удерживающая больше всего очков побед побеждённого
function victor(S, n) {
  const m = {};
  for (const R of G.R) {
    if (S.core[R.i] !== n) continue;
    const c = S.ctrl[R.i];
    c && c !== n && atWar(S, c, n) && (m[c] = (m[c] || 0) + R.vp + 0.01);
  }
  let best = null, bv = 0;
  for (const [c, v] of Object.entries(m)) v > bv && ((bv = v), (best = c));
  if (!best) best = Object.keys(S.nat).find((e) => alive(S, e) && atWar(S, e, n)) || null;
  // марионеточные союзники отдают захваченное лидеру блока
  return best;
}
export function checkCapitulations(S) {
  for (const n of Object.keys(S.nat)) {
    if (!alive(S, n)) continue;
    if (!Object.keys(S.nat).some((e) => alive(S, e) && atWar(S, e, n))) continue;
    const st = lostK(S, n);
    if (!st.core) continue;
    const hasLand = G.R.some((R) => S.ctrl[R.i] === n);
    const k = CAP_K[n] ?? CAP_K._, kc = CAP_C[n] ?? CAP_C._;
    if (!hasLand || st.k >= k || (capitalLost(S, n) && st.k >= kc)) {
      if (n === `ITA` && !S.done.itacap) {
        S.done.itacap = S.t + 1;
        itaSurrender(S);
      } else capitulate(S, n);
    }
  }
}
export function capitulate(S, n) {
  const nat = S.nat[n];
  if (!nat || nat.dead) return;
  const by = victor(S, n);
  if (n === `FRA`) return vichy(S, by);
  const foes = new Set(Object.keys(S.nat).filter((e) => alive(S, e) && atWar(S, e, n)));
  nat.dead = true;
  const exile = n === `POL` && alive(S, `FRA`) ? [`FRA`, `paris`, `Польская армия во Франции`] : null;
  for (const u of S.units.filter((u) => u.n === n)) kill(S, u);
  S.wars = S.wars.filter((k) => !k.split(`|`).includes(n));
  const P = PART[n] || {};
  for (const R of G.R) {
    let to = null;
    for (const [m, ks] of Object.entries(P)) if (ks && W(ks).includes(R.k) && alive(S, m) && (foes.has(m) || m === `LIT`)) to = m;
    if (S.ctrl[R.i] === n) S.ctrl[R.i] = to || by || null, (S.held[R.i] = S.t);
    else if (to && S.core[R.i] === n && S.ctrl[R.i] !== to && S.ctrl[R.i] && !atWar(S, S.ctrl[R.i], to)) S.ctrl[R.i] = to, (S.held[R.i] = S.t);
  }
  S._ver++;
  relocate(S);
  exile && place(S, exile[0], exile[1], `inf`, 2, exile[2]);
  news(S, `Капитуляция: ${NATIONS[n].n}`, `${NATIONS[n].n} прекращает сопротивление${by ? ` — территория переходит под контроль ${NATIONS[by].a}` : ``}.`, `cap`);
  S.caps.push({ t: S.t, cap: n, by });
}
// Компьенское перемирие: оккупированная зона, Виши, эвакуация англичан
const OCC = `paris lille normandy brittany nantes bordeaux orleans reims metz strasbourg dijon`;
function vichy(S, by) {
  const occ = new Set(W(OCC));
  S.nat.FRA.dead = true;
  const vic = S.nat.VIC;
  vic.pp = 10, (vic.mp = 10), (vic.st = 5), (vic.oil = 10);
  for (const R of G.R) {
    const c = S.ctrl[R.i];
    if (c !== `FRA`) continue;
    S.ctrl[R.i] = occ.has(R.k) && alive(S, `GER`) ? `GER` : `VIC`;
    S.held[R.i] = S.t;
    S.ctrl[R.i] === `VIC` && (S.core[R.i] = `VIC`);
  }
  for (const u of S.units.filter((u) => u.n === `FRA`)) {
    if (S.ctrl[u.r] === `VIC`) ((u.n = `VIC`), (u.s = Math.max(1, u.s * 0.5)), (u.o = 40));
    else kill(S, u);
  }
  S.wars = S.wars.filter((k) => !k.split(`|`).includes(`FRA`));
  S._ver++;
  // Дюнкерк: британцы эвакуируются с потерей техники
  for (const u of S.units) if (u.n === `UK` && S.ctrl[u.r] && !ally(S, S.ctrl[u.r], `UK`)) ((u.r = 0), (u.s *= 0.6));
  for (const u of S.units) if (u.r === 0) {
    const i = [`london`, `portsmouth`, `birmingham`, `norwich`, `bristol`, `manchester`].map(I).find((j) => landIn(S, j).length < STACK);
    i ? ((u.r = i), (u.o = 30)) : (u.r = I(`london`));
  }
  touch(S);
  relocate(S);
  place(S, `UK`, `london portsmouth bristol`, `inf`, 2, `Свободные французы (де Голль)`);
  news(S, `Компьенское перемирие`, `Франция капитулировала. Север и запад страны оккупированы Германией, на юге — режим Виши, ему подчиняются колонии. Британские войска эвакуированы из Дюнкерка, в Лондоне — «Свободная Франция» де Голля.`, `cap`);
  S.caps.push({ t: S.t, cap: `FRA`, by });
}
// Капитуляция Италии: юг — союзникам, остальное занимает Германия
export function itaSurrender(S) {
  const south = new Set(W(`sicily calabria bari sardinia corsica`));
  const ally0 = alive(S, `UK`) ? `UK` : `USA`;
  S.nat.ITA.dead = true;
  for (const u of S.units.filter((u) => u.n === `ITA`)) kill(S, u);
  S.wars = S.wars.filter((k) => !k.split(`|`).includes(`ITA`));
  for (const R of G.R) {
    if (S.ctrl[R.i] !== `ITA`) continue;
    S.ctrl[R.i] = south.has(R.k) || !alive(S, `GER`) ? ally0 : `GER`;
    S.held[R.i] = S.t;
  }
  S._ver++;
  relocate(S);
  if (alive(S, `GER`)) {
    place(S, `GER`, `naples rome florence`, `inf`, 6, `10-я армия (Фитингоф)`, 70);
    place(S, `GER`, `rome florence bologna`, `inf`, 5, `14-я армия (Макензен)`, 70);
    place(S, `GER`, `naples rome`, `arm`, 3, `XIV танковый корпус`, 70);
  }
  news(S, `Италия капитулировала`, `8 сентября Италия подписала перемирие. Германия разоружила итальянскую армию и заняла север и центр страны; Муссолини возглавил марионеточную Республику Сало.`, `cap`);
  S.caps.push({ t: S.t, cap: `ITA`, by: ally0 });
}
// ——— высадка: морской бой с подготовкой ———
export function landing(S, units, Tk, mod) {
  const T = I(Tk);
  if (!T || !units.length) return null;
  const att = units.filter(Boolean).map((u) => ({ u, src: u.r, amph: true }));
  if (!att.length) return null;
  for (const a of att) (a.u.mv = Math.max(1, a.u.mv)), (a.u.o = Math.max(a.u.o, 70));
  if (!landIn(S, T).length) {
    S.ctrl[T] = att[0].u.n, (S.held[T] = S.t), (S._ver++);
    for (const a of att) (a.u.r = T), (a.u.mv = 0);
    touch(S);
    relocate(S);
    return { win: true };
  }
  const r = battle(S, att, T, { mod });
  for (const a of att) a.u.mv = 0;
  return r;
}
const own = (S, k, n) => S.ctrl[I(k)] === n;
const AFRK = new Set(`tripoli sirte benghazi tobruk sollum matruh alamein tunis gabes`.split(` `));
const ownSide = (S, k, n) => !!S.ctrl[I(k)] && ally(S, S.ctrl[I(k)], n);

// ——— список событий ———
// t — не раньше хода; until — не позже; ph — 'start' (начало хода) или 'pre' (перед ходом ИИ);
// ask — держава игрока, которой предлагается выбор; opts[0] — исторический вариант (ИИ)
export const EV = [
  { id: `sep39`, t: 0, ttl: `1 сентября 1939 года`, txt: `Германия напала на Польшу. 3 сентября Великобритания и Франция объявили войну Германии. Началась Вторая мировая война.` },
  {
    id: `sovpol`, t: 1, until: 3, if: (S) => alive(S, `POL`), ask: `SOV`, ttl: `17 сентября: поход в Польшу`,
    txt: `По секретному протоколу пакта Молотова — Риббентропа Восточная Польша отходит к СССР. Польская армия разбита на западе.`,
    opts: [{ l: `Ввести войска`, fx: (S) => addWar(S, `SOV`, `POL`) }, { l: `Остаться в стороне`, fx: () => {} }],
  },
  { id: `polexile`, t: 2, if: (S) => !alive(S, `POL`), ttl: `Раздел Польши`, txt: `Польское государство уничтожено. Граница проведена по Бугу и Сану, Вильно передан Литве. Остатки польской армии пробиваются во Францию.` },
  {
    id: `winter`, t: 5, until: 8, if: (S) => alive(S, `FIN`) && alive(S, `SOV`) && !ally(S, `FIN`, `SOV`), ask: `SOV`, ttl: `Зимняя война`,
    txt: `Финляндия отклонила требование отодвинуть границу от Ленинграда. 30 ноября Красная армия перешла границу; путь на Хельсинки преграждает линия Маннергейма.`,
    opts: [{ l: `Начать войну`, fx: (S) => addWar(S, `SOV`, `FIN`) }, { l: `Отказаться от требований`, fx: () => {} }],
  },
  {
    id: `mpeace`, t: 12, if: (S) => alive(S, `FIN`) && atWar(S, `SOV`, `FIN`), ttl: `Московский мир`,
    txt: `12 марта 1940 года Финляндия уступила Карельский перешеек с Выборгом. Война стоила обеим сторонам больших потерь.`,
    fx: (S) => {
      makePeace(S, `SOV`, `FIN`);
      S.nat.SOV.qmul = 0.92;
      for (const R of G.R) if (S.core[R.i] === `FIN` && S.ctrl[R.i] === `SOV` && R.k !== `viipuri`) S.ctrl[R.i] = `FIN`;
      give(S, `viipuri`, `SOV`);
    },
  },
  {
    id: `weser`, t: 14, until: 20, if: (S) => alive(S, `GER`) && alive(S, `NOR`) && !atWar(S, `GER`, `NOR`), ask: `GER`, ttl: `Операция «Везерюбунг»`,
    txt: `9 апреля Германия заняла Данию и высадила десанты в портах Норвегии — Осло, Бергене, Тронхейме, Нарвике. Норвегия сопротивляется, на помощь идут англичане.`,
    opts: [{
      l: `Начать операцию`, fx: (S) => {
        addWar(S, `GER`, `DEN`);
        capitulate(S, `DEN`);
        give(S, `denmark`, `GER`);
        joinSide(S, `NOR`, `allies`);
        addWar(S, `GER`, `NOR`);
        for (const u of S.units.filter((u) => u.n === `NOR` && [`oslo`, `bergen`, `narvik`].includes(reg(u.r).k))) u.r = I(`trondheim`), touch(S);
        give(S, `oslo bergen narvik`, `GER`);
        place(S, `GER`, `oslo`, `inf`, 3, `XXI группа (Фалькенхорст)`, 70);
        place(S, `GER`, `bergen`, `inf`, 1, `69-я пехотная дивизия`, 60);
        place(S, `GER`, `narvik`, `inf`, 1, `Горные егеря Дитля`, 60);
      },
    }, { l: `Отказаться`, fx: () => {} }],
  },
  {
    id: `gelb`, t: 16, until: 26, if: (S) => alive(S, `GER`) && alive(S, `FRA`) && (alive(S, `BEL`) || alive(S, `NED`)) && !atWar(S, `GER`, `BEL`), ask: `GER`, ttl: `Операция «Гельб»`,
    txt: `10 мая вермахт вторгся в Нидерланды, Бельгию и Люксембург. Главный удар — танковые корпуса через Арденны на Седан, в обход линии Мажино.`,
    opts: [{
      l: `Начать наступление`, fx: (S) => {
        for (const n of [`BEL`, `NED`]) alive(S, n) && (joinSide(S, n, `allies`), addWar(S, `GER`, n));
        S.nat.GER.surp = S.t + 1;
      },
    }, { l: `Отложить`, fx: (S) => (S.done.gelb = 0) }],
  },
  {
    id: `ita40`, t: 18, if: (S) => alive(S, `ITA`) && alive(S, `GER`) && !side(S, `ITA`), ttl: `Италия вступает в войну`,
    txt: `10 июня Муссолини объявил войну Великобритании и Франции. Италия угрожает Египту и Суэцкому каналу.`,
    fx: (S) => joinSide(S, `ITA`, `axis`),
  },
  {
    id: `baltic`, t: 19, until: 24, if: (S) => alive(S, `SOV`) && [`LIT`, `LAT`, `EST`].some((n) => alive(S, n)) && !atWar(S, `GER`, `SOV`), ask: `SOV`, ttl: `Прибалтика`,
    txt: `Июнь 1940 года: в Литву, Латвию и Эстонию введены дополнительные части Красной армии; в августе республики включены в состав СССР.`,
    opts: [{
      l: `Присоединить`, fx: (S) => {
        for (const n of [`LIT`, `LAT`, `EST`]) {
          if (!alive(S, n)) continue;
          for (const u of S.units.filter((u) => u.n === n)) kill(S, u);
          S.nat[n].dead = true;
          for (const R of G.R) S.ctrl[R.i] === n && ((S.ctrl[R.i] = `SOV`), (S.core[R.i] = `SOV`));
        }
        S._ver++;
        relocate(S);
      },
    }, { l: `Отказаться`, fx: () => {} }],
  },
  {
    id: `bess`, t: 19, until: 24, if: (S) => alive(S, `SOV`) && alive(S, `ROM`) && own(S, `kishinev`, `ROM`) && !ally(S, `ROM`, `SOV`), ask: `SOV`, ttl: `Бессарабия и Северная Буковина`,
    txt: `28 июня 1940 года по ультиматуму СССР Румыния оставила Бессарабию и Северную Буковину.`,
    opts: [{ l: `Предъявить ультиматум`, fx: (S) => give(S, `kishinev chernovtsy`, `SOV`, true) }, { l: `Отказаться`, fx: () => {} }],
  },
  {
    id: `sealion`, t: 22, until: 22, ask: `GER`, if: (S) => S.player === `GER` && alive(S, `UK`) && !alive(S, `FRA`), ttl: `«Морской лев»`,
    txt: `Франция разбита, Англия отвергла мир. Высадка через Ла-Манш возможна только при господстве в воздухе и большом риске для флота.`,
    opts: [{ l: `Не рисковать`, fx: () => {} }, { l: `Готовить высадку`, fx: (S) => (S.nat.GER.sealion = true) }],
  },
  { id: `bob`, t: 22, if: (S) => alive(S, `UK`) && !alive(S, `FRA`), ttl: `Битва за Англию`, txt: `Люфтваффе пытается завоевать господство над Англией. Королевские ВВС выстояли — высадка «Морской лев» отложена.` },
  {
    id: `vienna`, t: 23, if: (S) => alive(S, `HUN`) && alive(S, `ROM`) && own(S, `cluj`, `ROM`), ttl: `Второй Венский арбитраж`,
    txt: `30 августа 1940 года по решению Германии и Италии Северная Трансильвания передана Венгрии.`, fx: (S) => give(S, `cluj`, `HUN`),
  },
  {
    id: `pact3`, t: 26, if: (S) => alive(S, `GER`), ttl: `Тройственный пакт`, txt: `Ноябрь 1940 года: к пакту присоединились Венгрия, Румыния и Словакия. В Румынию вводятся германские войска, её нефть идёт в рейх.`,
    fx: (S) => {
      for (const n of [`HUN`, `ROM`, `SVK`]) alive(S, n) && !ally(S, n, `SOV`) && side(S, n) !== `axis` && joinSide(S, n, `axis`);
    },
  },
  {
    id: `itagre`, t: 27, if: (S) => alive(S, `ITA`) && alive(S, `GRE`) && side(S, `ITA`) === `axis` && !side(S, `GRE`), ttl: `Италия нападает на Грецию`,
    txt: `28 октября 1940 года итальянские войска из Албании вторглись в Грецию. Греки ответили «Охи!» — «Нет!».`,
    fx: (S) => (joinSide(S, `GRE`, `allies`), addWar(S, `ITA`, `GRE`)),
  },
  {
    id: `dak`, t: 34, if: (S) => alive(S, `GER`) && alive(S, `ITA`) && [`tripoli`, `sirte`, `benghazi`].some((k) => ownSide(S, k, `GER`)), ttl: `Африканский корпус`,
    txt: `Февраль 1941 года: в Триполи высаживается немецкий Африканский корпус генерала Роммеля.`,
    fx: (S) => {
      place(S, `GER`, `tripoli sirte benghazi`, `arm`, 3, `Африканский корпус (Роммель)`, 80), place(S, `GER`, `tripoli sirte benghazi`, `mot`, 2, `5-я лёгкая дивизия`, 80);
      S.nat.GER.nav2.includes(`med`) || S.nat.GER.nav2.push(`med`);
    },
  },
  {
    id: `sonnenblume`, t: 38, if: (S) => alive(S, `GER`) && alive(S, `UK`) && [`tripoli`, `sirte`].some((k) => ownSide(S, k, `GER`)) && own(S, `benghazi`, `UK`), ttl: `Роммель в Киренаике`,
    txt: `Апрель 1941 года: лучшие британские части ушли в Грецию. Роммель, не дожидаясь подкреплений, атаковал у Эль-Агейлы и погнал англичан к египетской границе; Тобрук осаждён.`,
    fx: (S) => {
      for (const u of S.units) u.n === `UK` && [`benghazi`, `sirte`, `tobruk`, `sollum`].includes(reg(u.r).k) && ((u.o = Math.min(u.o, 45)), (u.s *= 0.8));
      for (const u of S.units) u.n === `GER` && AFRK.has(reg(u.r).k) && (u.o = 100);
    },
  },
  {
    id: `rommel42`, t: 57, if: (S) => alive(S, `GER`) && [`tripoli`, `sirte`, `benghazi`].some((k) => ownSide(S, k, `GER`)), ttl: `Роммель снова наступает`,
    txt: `Январь 1942 года: 2-й воздушный флот Кессельринга подавил Мальту, конвои дошли до Триполи. Танковая армия «Африка» перешла в наступление.`,
    fx: (S) => {
      const k = [`benghazi`, `sirte`, `tripoli`].filter((x) => ownSide(S, x, `GER`)).join(` `);
      place(S, `GER`, k, `arm`, 4, `15-я танковая дивизия`, 90), place(S, `GER`, k, `mot`, 3, `90-я лёгкая дивизия`, 90);
      alive(S, `ITA`) && (place(S, `ITA`, k, `arm`, 4, `Танковая дивизия «Ариете»`, 85), place(S, `ITA`, k, `inf`, 6, `XXI корпус`, 85));
      for (const u of S.units) [`GER`, `ITA`].includes(u.n) && AFRK.has(reg(u.r).k) && (u.o = Math.max(u.o, 90));
      // британские дивизии ушли на Дальний Восток
      for (const u of S.units) u.n === `UK` && [`benghazi`, `sirte`, `tobruk`, `sollum`].includes(reg(u.r).k) && ((u.o = Math.min(u.o, 55)), (u.s *= 0.85));
    },
  },
  { id: `bul41`, t: 36, if: (S) => alive(S, `BUL`) && alive(S, `GER`) && !side(S, `BUL`), ttl: `Болгария в Тройственном пакте`, txt: `1 марта 1941 года Болгария присоединилась к пакту; через неё германские войска выходят к границе Греции.`, fx: (S) => joinSide(S, `BUL`, `axis`) },
  { id: `lend`, t: 37, if: (S) => alive(S, `UK`), ttl: `Ленд-лиз`, txt: `Март 1941 года: США начинают поставки Великобритании по ленд-лизу.`, fx: (S) => { const m = S.nat.UK.imp; m.pp = (m.pp || 0) + 4, (m.st = (m.st || 0) + 2), (m.oil = (m.oil || 0) + 3); } },
  {
    id: `marita`, t: 38, until: 44, if: (S) => alive(S, `GER`) && alive(S, `YUG`) && !atWar(S, `GER`, `YUG`), ask: `GER`, ttl: `Югославия и Греция`,
    txt: `Переворот в Белграде разорвал союз с Германией. 6 апреля 1941 года вермахт вторгся в Югославию и Грецию с территорий Австрии, Венгрии, Румынии и Болгарии.`,
    opts: [{
      l: `Начать операцию`, fx: (S) => {
        joinSide(S, `YUG`, `allies`);
        for (const n of [`GER`, `ITA`, `HUN`, `BUL`]) alive(S, n) && addWar(S, n, `YUG`);
        alive(S, `GRE`) && (side(S, `GRE`) || joinSide(S, `GRE`, `allies`), addWar(S, `GER`, `GRE`), alive(S, `BUL`) && addWar(S, `BUL`, `GRE`));
        S.nat.GER.surp = S.t;
      },
    }, { l: `Отказаться`, fx: () => {} }],
  },
  {
    id: `crete`, t: 41, until: 46, if: (S) => own(S, `athens`, `GER`) && S.ctrl[I(`crete`)] && atWar(S, S.ctrl[I(`crete`)], `GER`), ttl: `Операция «Меркурий»`,
    txt: `Май 1941 года: германские парашютисты захватили Крит ценой тяжёлых потерь. Британский флот эвакуировал часть гарнизона.`,
    fx: (S) => { for (const u of landIn(S, I(`crete`))) u.s *= 0.5; give(S, `crete`, `GER`); place(S, `GER`, `crete`, `inf`, 1, `7-я авиадесантная дивизия`, 40); },
  },
  // Газала: обход британских позиций и падение Тобрука (май — июнь 1942)
  {
    id: `gazala`, t: 64, until: 68, ttl: `Битва при Газале`,
    txt: `26 мая 1942 года танковая армия «Африка» обошла британские позиции у Газалы с юга. 8-я армия отступает к границе Египта, гарнизон Тобрука в окружении.`,
    if: (S) => S.histOn !== false && ![`UK`, `GER`, `ITA`].includes(S.player) && own(S, `tobruk`, `UK`) && ownSide(S, `benghazi`, `GER`),
    fx: (S) => {
      for (const u of S.units) u.n === `UK` && [`tobruk`, `sollum`].includes(reg(u.r).k) && ((u.o = Math.min(u.o, 20)), (u.s *= 0.8));
      for (const u of S.units) [`GER`, `ITA`].includes(u.n) && AFRK.has(reg(u.r).k) && (u.o = 100);
    },
  },
  // Греческая армия сложила оружие, когда вермахт прорвал линию Метаксаса и вышел в Эпир (апрель 1941)
  {
    id: `grecap`, t: 40, until: 46, ttl: ``, txt: ``,
    if: (S) => alive(S, `GRE`) && S.player !== `GRE` && S.player !== `UK` && [`salonika`, `ioannina`].every((k) => S.ctrl[I(k)] && side(S, S.ctrl[I(k)]) === `axis`),
    fx: (S) => capitulate(S, `GRE`),
  },
  {
    id: `syria`, t: 42, until: 46, if: (S) => alive(S, `UK`) && alive(S, `VIC`) && (own(S, `damascus`, `VIC`) || own(S, `aleppo`, `VIC`)), ask: `UK`, ttl: `Сирия и Ливан`,
    txt: `Июнь 1941 года: чтобы не допустить немцев на Ближний Восток, британские и «Свободные французские» войска вступили в подмандатную Сирию.`,
    opts: [{ l: `Начать операцию «Экспортёр»`, fx: (S) => addWar(S, `UK`, `VIC`) }, { l: `Отказаться`, fx: () => {} }],
  },
  {
    id: `syria2`, t: 43, if: (S) => atWar(S, `UK`, `VIC`) && !own(S, `damascus`, `VIC`) && !own(S, `aleppo`, `VIC`) && own(S, `marseille`, `VIC`), ttl: `Перемирие в Акре`,
    txt: `Войска Виши в Леванте капитулировали; Сирия и Ливан под контролем союзников.`, fx: (S) => makePeace(S, `UK`, `VIC`),
  },
  {
    id: `barb`, t: 43, until: 48, ph: (S) => (S.player === `SOV` ? `pre` : `start`), if: (S) => alive(S, `GER`) && alive(S, `SOV`) && !atWar(S, `GER`, `SOV`), ask: `GER`, ttl: `22 июня 1941 года`,
    txt: `Германия и её союзники без объявления войны напали на Советский Союз. Удар наносят три группы армий — на Ленинград, Москву и Киев. Советская авиация понесла огромные потери на аэродромах.`,
    opts: [{ l: `Начать «Барбароссу»`, fx: (S) => barbarossa(S) }, { l: `Отложить на две недели`, fx: (S) => (S.done.barb = 0, (S.barbDelay = (S.barbDelay || 0) + 1)) }],
  },
  {
    id: `iran`, t: 47, until: 50, if: (S) => alive(S, `IRN`) && alive(S, `UK`) && alive(S, `SOV`) && atWar(S, `GER`, `SOV`), ask: `UK`, ttl: `Иранская операция`,
    txt: `25 августа 1941 года британские и советские войска вошли в Иран, чтобы открыть южный путь ленд-лиза и защитить нефть.`,
    opts: [{ l: `Ввести войска`, fx: (S) => (addWar(S, `UK`, `IRN`), addWar(S, `SOV`, `IRN`)) }, { l: `Отказаться`, fx: () => {} }],
  },
  {
    id: `echelon`, t: 44, if: (S) => alive(S, `SOV`) && atWar(S, `GER`, `SOV`), ttl: `Второй стратегический эшелон`,
    txt: `Из внутренних округов на рубеж Западной Двины и Днепра выдвигаются резервные армии — 16-я, 19-я, 20-я, 21-я, 22-я.`,
    fx: (S) => {
      const near = nearFront(S, `SOV`, 1, 2);
      // рубеж Западной Двины и Днепра, резервный фронт под Вязьмой
      const at = [`vitebsk smolensk`, `smolensk vyazma`, `mogilev smolensk`, `gomel bryansk`, `velikiye_luki rzhev`];
      [`16-я армия`, `19-я армия`, `20-я армия`, `21-я армия`, `22-я армия`].forEach((nm, k) => place(S, `SOV`, [...W(at[k]).filter((x) => own(S, x, `SOV`)), ...near], `inf`, 7, nm, 70));
      place(S, `SOV`, [...W(`smolensk vyazma`).filter((x) => own(S, x, `SOV`)), ...near], `arm`, 4, `7-й механизированный корпус`, 70);
    },
  },
  {
    id: `sib`, t: 52, if: (S) => alive(S, `SOV`) && atWar(S, `GER`, `SOV`), ttl: `Сибирские дивизии`,
    txt: `Узнав, что Япония не нападёт, Ставка перебрасывает к Москве свежие дивизии с Дальнего Востока, обученные воевать зимой.`,
    fx: (S) => {
      const k = `moscow ryazan yaroslavl gorky tula kalinin tambov penza kazan`;
      place(S, `SOV`, k, `inf`, 7, `Сибирская армия`, 85), place(S, `SOV`, k, `inf`, 7, `Дальневосточная армия`, 85), place(S, `SOV`, k, `inf`, 6, `10-я армия (новая)`, 80), place(S, `SOV`, k, `arm`, 3, `Танковые бригады`, 80);
    },
  },
  {
    id: `usa`, t: 54, if: (S) => alive(S, `USA`) && !side(S, `USA`), ttl: `США вступают в войну`,
    txt: `7 декабря Япония атаковала Пёрл-Харбор, 11 декабря Германия и Италия объявили войну США. Промышленность Америки переходит на военные рельсы.`,
    fx: (S) => {
      joinSide(S, `USA`, `allies`);
      const m = S.nat.USA;
      m.imp = { pp: 14, st: 10, oil: 14, mp: 4, co: 10 };
      alive(S, `SOV`) && !S.coop.includes(pairKey(`SOV`, `USA`)) && S.coop.push(pairKey(`SOV`, `USA`));
      S._ver++;
    },
  },
  { id: `usa2`, t: 62, if: (S) => side(S, `USA`) === `allies`, fx: (S) => (S.nat.USA.imp.pp = 22, (S.nat.USA.imp.mp = 6), place(S, `USA`, `belfast glasgow manchester bristol`, `inf`, 6, `V корпус`, 70)) },
  { id: `usa3`, t: 76, if: (S) => side(S, `USA`) === `allies`, fx: (S) => ((S.nat.USA.imp.pp = 30), (S.nat.USA.imp.mp = 8)) },
  { id: `usa4`, t: 92, if: (S) => side(S, `USA`) === `allies`, fx: (S) => ((S.nat.USA.imp.pp = 36), (S.nat.USA.imp.mp = 9)) },
  { id: `speer`, t: 62, if: (S) => alive(S, `GER`), fx: (S) => (S.nat.GER.eco = Math.max(S.nat.GER.eco, 0.35)) },
  { id: `twar`, t: 82, if: (S) => alive(S, `GER`), ttl: `«Тотальная война»`, txt: `После Сталинграда Геббельс провозгласил тотальную войну: промышленность рейха и людские ресурсы мобилизуются полностью.`, fx: (S) => ((S.nat.GER.eco = Math.max(S.nat.GER.eco, 0.42)), (S.nat.GER.mpk = 0.1)) },
  { id: `ger44`, t: 104, if: (S) => alive(S, `GER`), fx: (S) => (S.nat.GER.eco = Math.max(S.nat.GER.eco, 0.48)) },
  { id: `sov42`, t: 58, if: (S) => alive(S, `SOV`), fx: (S) => ((S.nat.SOV.eco = Math.max(S.nat.SOV.eco, 0.4)), (S.nat.SOV.qmul = 1)) },
  { id: `sov44`, t: 104, if: (S) => alive(S, `SOV`), fx: (S) => (S.nat.SOV.eco = Math.max(S.nat.SOV.eco, 0.46)) },
  { id: `sov43`, t: 80, if: (S) => alive(S, `SOV`), fx: (S) => (S.nat.SOV.eco = Math.max(S.nat.SOV.eco, 0.48)) },
  { id: `uk41`, t: 40, if: (S) => alive(S, `UK`), fx: (S) => (S.nat.UK.eco = Math.max(S.nat.UK.eco, 0.34)) },
  {
    id: `monty`, t: 70, if: (S) => alive(S, `UK`) && [`alexandria`, `cairo`, `alamein`].some((k) => own(S, k, `UK`)), ttl: `8-я армия Монтгомери`,
    txt: `В Египет прибывают «Шерманы» и свежие дивизии; командование 8-й армией принимает генерал Монтгомери.`,
    fx: (S) => (place(S, `UK`, `alexandria cairo suez alamein`, `arm`, 4, `X корпус («Шерманы»)`, 80), place(S, `UK`, `alexandria cairo suez alamein`, `inf`, 5, `XXX корпус`, 80)),
  },
  {
    id: `torch`, t: 76, until: 84, if: (S) => alive(S, `VIC`) && side(S, `USA`) === `allies` && [`casablanca`, `oran`, `algiers`].some((k) => own(S, k, `VIC`)), ask: `UK`, ttl: `Операция «Факел»`,
    txt: `8 ноября 1942 года англо-американские войска высадились в Марокко и Алжире. Войска Виши после краткого сопротивления перешли на сторону союзников. Немцы спешно перебрасывают войска в Тунис и оккупируют юг Франции.`,
    opts: [{ l: `Высадиться`, fx: (S) => torch(S) }, { l: `Отложить`, fx: (S) => (S.done.torch = 0) }],
  },
  {
    id: `uranus`, t: 77, if: (S) => alive(S, `SOV`) && atWar(S, `GER`, `SOV`), ttl: `Операция «Уран»`,
    txt: `19 ноября 1942 года Юго-Западный и Сталинградский фронты нанесли удары по флангам немецкой группировки у Сталинграда, где оборону держат румынские армии.`,
    fx: (S) => {
      const k = `saratov voronezh tambov astrakhan stalingrad elista penza kuibyshev`;
      place(S, `SOV`, k, `arm`, 6, `5-я танковая армия`, 90), place(S, `SOV`, k, `arm`, 5, `4-й механизированный корпус`, 90), place(S, `SOV`, k, `inf`, 8, `21-я армия`, 85), place(S, `SOV`, k, `inf`, 8, `51-я армия`, 85);
      // удар по флангам: румынские, итальянские и венгерские армии на Дону
      const don = new Set(W(`millerovo elista voronezh voroshilovgrad rostov stalingrad`).map(I));
      for (const i of [...don]) for (const j of reg(i).nb) don.add(j);
      for (const u of S.units) if ([`ROM`, `ITA`, `HUN`].includes(u.n) && don.has(u.r) && u.t !== `nav`) (u.o = Math.min(u.o, 25)), (u.s *= 0.75);
    },
  },
  {
    id: `husky`, t: 92, until: 100, if: (S) => alive(S, `UK`) && [`tunis`, `gabes`].every((k) => ownSide(S, k, `UK`)) && S.ctrl[I(`sicily`)] && atWar(S, S.ctrl[I(`sicily`)], `UK`), ask: `UK`, ttl: `Операция «Хаски»`,
    txt: `10 июля 1943 года союзники высадились на Сицилии — крупнейшая морская десантная операция того времени.`,
    opts: [{ l: `Высадиться`, fx: (S) => husky(S) }, { l: `Отложить`, fx: (S) => (S.done.husky = 0) }],
  },
  {
    id: `itacap`, t: 94, if: (S) => alive(S, `ITA`) && (ownSide(S, `sicily`, `UK`) || ownSide(S, `calabria`, `UK`) || ownSide(S, `rome`, `UK`)), ttl: ``, txt: ``,
    fx: (S) => itaSurrender(S),
  },
  {
    id: `overlord`, t: 114, until: 122, if: (S) => alive(S, `GER`) && alive(S, `UK`) && own(S, `normandy`, `GER`), ask: `UK`, ttl: `Операция «Оверлорд»`,
    txt: `6 июня 1944 года — день «Д»: союзные армии высаживаются во Франции. Где нанести удар?`,
    opts: [{ l: `Нормандия`, fx: (S) => overlord(S, `normandy`) }, { l: `Па-де-Кале`, fx: (S) => overlord(S, `lille`) }, { l: `Бретань`, fx: (S) => overlord(S, `brittany`) }, { l: `Отложить`, fx: (S) => (S.done.overlord = 0) }],
  },
  {
    id: `bagr`, t: 115, if: (S) => alive(S, `SOV`) && atWar(S, `GER`, `SOV`), ttl: `Операция «Багратион»`,
    txt: `22 июня 1944 года четыре фронта обрушились на группу армий «Центр» в Белоруссии.`,
    fx: (S) => {
      const k = `smolensk vitebsk mogilev gomel bobruisk bryansk chernigov velikiye_luki rzhev vyazma`;
      place(S, `SOV`, k, `arm`, 7, `5-я гвардейская танковая армия`, 95), place(S, `SOV`, k, `inf`, 10, `3-й Белорусский фронт`, 90), place(S, `SOV`, k, `inf`, 10, `1-й Белорусский фронт`, 90);
    },
  },
  {
    id: `dragoon`, t: 118, until: 124, if: (S) => alive(S, `GER`) && side(S, `USA`) === `allies` && own(S, `marseille`, `GER`) && ownSide(S, `corsica`, `USA`), ttl: `Операция «Драгун»`,
    txt: `15 августа 1944 года союзники высадились на юге Франции, между Тулоном и Каннами.`,
    fx: (S) => {
      const us = [place(S, `USA`, `corsica`, `inf`, 7, `7-я армия (Патч)`, 85), place(S, `USA`, `corsica`, `arm`, 4, `Французская 1-я армия`, 85)];
      landing(S, us, `marseille`, { r: 2.2, a: 0.7 });
    },
  },
  {
    id: `rom44`, t: 117, if: (S) => alive(S, `ROM`) && side(S, `ROM`) === `axis` && [`kishinev`, `iasi`, `chernovtsy`, `odessa`].some((k) => ownSide(S, k, `SOV`)), ttl: `Румыния переходит на сторону союзников`,
    txt: `23 августа 1944 года король Михай арестовал Антонеску; Румыния объявила войну Германии. Немецкая группа армий «Южная Украина» окружена.`,
    fx: (S) => {
      for (const u of S.units) u.n === `GER` && S.ctrl[u.r] === `ROM` && (u.s *= 0.5);
      switchSide(S, `ROM`, `comintern`);
      own(S, `cluj`, `HUN`) || give(S, `cluj`, `ROM`);
    },
  },
  { id: `bul44`, t: 119, if: (S) => alive(S, `BUL`) && side(S, `BUL`) === `axis` && [`bucharest`, `constanta`, `craiova`, `ploiesti`].some((k) => ownSide(S, k, `SOV`)), ttl: `Болгария выходит из войны`, txt: `Сентябрь 1944 года: Красная армия вступила в Болгарию, новое правительство объявило войну Германии.`, fx: (S) => switchSide(S, `BUL`, `comintern`) },
  {
    id: `fin44`, t: 121, if: (S) => alive(S, `FIN`) && atWar(S, `FIN`, `SOV`), ttl: `Московское перемирие`,
    txt: `19 сентября 1944 года Финляндия вышла из войны, вернувшись к границам 1940 года.`,
    fx: (S) => {
      switchSide(S, `FIN`, null);
      for (const R of G.R) S.ctrl[R.i] === `FIN` && S.core[R.i] !== `FIN` && (S.ctrl[R.i] = `SOV`);
      give(S, `viipuri`, `SOV`);
    },
  },
  {
    id: `bulge`, t: 127, if: (S) => alive(S, `GER`) && [`koln`, `saar`, `ruhr`].some((k) => own(S, k, `GER`)), ttl: `Арденнское наступление`,
    txt: `16 декабря 1944 года в нелётную погоду немецкие танковые армии нанесли удар в Арденнах, пытаясь прорваться к Антверпену.`,
    fx: (S) => (place(S, `GER`, `koln saar ruhr frankfurt`, `arm`, 5, `6-я танковая армия СС`, 90), place(S, `GER`, `koln saar ruhr frankfurt`, `arm`, 4, `5-я танковая армия`, 90), (S.nat.GER.surp = S.t)),
  },
];
// ——— сценарные операции ———
function barbarossa(S) {
  alive(S, `FIN`) && !side(S, `FIN`) && joinSide(S, `FIN`, `axis`);
  declareWar(S, `GER`, `SOV`);
  for (const n of [`ROM`, `HUN`, `SVK`, `ITA`, `FIN`]) alive(S, n) && side(S, n) === `axis` && addWar(S, n, `SOV`);
  S.nat.GER.surp = S.t + 1;
  for (const u of S.units) {
    if (u.n !== `SOV`) continue;
    const R = reg(u.r);
    if (R.lon > 34) continue;
    u.o = Math.min(u.o, 45);
    u.t === `air` && (u.s *= 0.45);
  }
  S.nat.SOV.mob = 9;
  // Можайская и Лужская линии обороны, Севастополь
  for (const [k, f] of [[`moscow`, 3], [`leningrad`, 3], [`crimea`, 1], [`tula`, 1]]) own(S, k, `SOV`) && ((S.fort[I(k)] = Math.max(S.fort[I(k)] || 0, f)), (S.fortN[I(k)] = `SOV`));
  // люфтваффе перебрасываются на восток
  const east = [`konigsberg`, `warsaw`, `lublin`, `krakow`].map(I).filter((i) => S.ctrl[i] === `GER`);
  let k = 0;
  for (const u of S.units) if (u.n === `GER` && u.t === `air` && east.length && reg(u.r).lon < 15 && reg(u.r).lat > 43 && k < 4) (u.r = east[k % east.length]), k++;
  S.nat.SOV.qmul = 0.9; // хаос первых месяцев; с 1942 г. — 1
  S.nat.SOV.eco = Math.max(S.nat.SOV.eco, 0.3);
  alive(S, `UK`) && !S.coop.includes(pairKey(`SOV`, `UK`)) && S.coop.push(pairKey(`SOV`, `UK`));
  S._ver++;
}
function torch(S) {
  const tk = [`casablanca`, `fes`, `oran`, `algiers`, `constantine`].filter((k) => own(S, k, `VIC`));
  for (const u of S.units) u.n === `VIC` && tk.includes(reg(u.r).k) && ((u.n = `UK`), (u.nm = `Французская армия (Жиро)`), (u.s *= 0.6));
  give(S, tk, `USA`);
  place(S, `USA`, `casablanca fes`, `inf`, 6, `Западная группа (Паттон)`, 80);
  place(S, `USA`, `oran algiers`, `arm`, 4, `II корпус`, 80);
  place(S, `UK`, `algiers constantine oran`, `inf`, 5, `1-я армия`, 80);
  // «Антон» и Тунис
  if (alive(S, `GER`)) {
    give(S, [`tunis`, `gabes`].filter((k) => own(S, k, `VIC`)), `GER`);
    place(S, `GER`, `tunis gabes`, `inf`, 5, `5-я танковая армия (Арним)`, 80);
    place(S, `GER`, `tunis gabes`, `arm`, 3, `10-я танковая дивизия`, 80);
    const left = G.R.filter((R) => S.ctrl[R.i] === `VIC`).map((R) => R.k);
    for (const u of S.units.filter((u) => u.n === `VIC`)) kill(S, u);
    give(S, left.filter((k) => k !== `corsica`), `GER`);
    give(S, left.filter((k) => k === `corsica`), alive(S, `ITA`) ? `ITA` : `GER`);
    S.nat.VIC.dead = true;
    S.wars = S.wars.filter((k) => !k.split(`|`).includes(`VIC`));
    news(S, `Операция «Антон»`, `Германия и Италия оккупировали зону Виши. Французский флот затопил себя в Тулоне.`);
  }
}
function husky(S) {
  const us = [
    place(S, `UK`, `malta tunis`, `inf`, 7, `8-я армия (Монтгомери)`, 85), place(S, `UK`, `tunis malta`, `arm`, 4, `XIII корпус`, 85),
    place(S, `USA`, `tunis gabes`, `inf`, 6, `7-я армия (Паттон)`, 85), place(S, `USA`, `tunis gabes`, `arm`, 3, `2-я бронетанковая дивизия`, 85),
  ].filter(Boolean);
  landing(S, us, `sicily`, { r: 2.0, a: 0.7 });
}
function overlord(S, k) {
  const near = { normandy: `portsmouth bristol cardiff london`, lille: `london portsmouth norwich birmingham`, brittany: `bristol portsmouth cardiff` }[k];
  const us = [
    place(S, `UK`, near, `inf`, 9, `2-я британская армия`, 90), place(S, `UK`, near, `arm`, 4, `XXX корпус`, 90),
    place(S, `USA`, near, `inf`, 9, `1-я армия США`, 90), place(S, `USA`, near, `arm`, 4, `VII корпус`, 90),
  ].filter(Boolean);
  const r = landing(S, us, k, { r: k === `lille` ? 1.6 : 2.3, a: 0.7 });
  if (r && !r.win) S.done.overlord = 0;
  S.over44 = k;
}
// ——— регулярные эффекты хода ———
// регионы державы в 1–3 переходах от фронта, по убыванию ценности (для новых армий)
export function nearFront(S, n, d0 = 1, d1 = 3) {
  const d = new Map(), q = [];
  for (const R of G.R) {
    const c = S.ctrl[R.i];
    if (c !== n) continue;
    if (R.nb.some((j) => S.ctrl[j] && atWar(S, S.ctrl[j], n))) (d.set(R.i, 0), q.push(R.i));
  }
  for (let k = 0; k < q.length; k++) for (const b of reg(q[k]).nb) !d.has(b) && S.ctrl[b] === n && (d.set(b, d.get(q[k]) + 1), q.push(b));
  return [...d].filter(([, v]) => v >= d0 && v <= d1).map(([i]) => reg(i)).sort((a, b) => b.vp + b.ic - (a.vp + a.ic)).map((R) => R.k);
}
export function tick(S) {
  const sov = S.nat.SOV;
  if (alive(S, `SOV`) && sov.mob > 0) {
    sov.mob--;
    const near = nearFront(S, `SOV`, 1, 3);
    for (let k = 0; k < (S.t <= 48 ? 3 : 2); k++) {
      if (sov.mp < 8) break;
      // в самые слабые из ближних к фронту регионов
      near.sort((a, b) => landIn(S, I(a)).length - landIn(S, I(b)).length);
      const u = place(S, `SOV`, near.length ? near : `moscow`, `inf`, 5, null, 55);
      u && (sov.mp -= 8);
    }
    // эвакуация промышленности на Урал
    if (S.t <= 56) for (const k of [`sverdlovsk`, `chelyabinsk`, `molotov`, `kuibyshev`, `kazan`, `ufa`]) own(S, k, `SOV`) && (S.icAdd[I(k)] = (S.icAdd[I(k)] || 0) + 0.25);
  }
  // ленд-лиз СССР
  if (alive(S, `SOV`) && S.t >= 50 && atWar(S, `GER`, `SOV`)) {
    const y = 1 + Math.max(0, (S.t - 50) / 24);
    const north = own(S, `murmansk`, `SOV`) || own(S, `arkhangelsk`, `SOV`);
    const south = S.t >= 60 && ownSide(S, `tehran`, `SOV`) && own(S, `baku`, `SOV`);
    const k = (north ? 1 : 0) + (south ? 1.2 : 0);
    sov.imp = { pp: 2 * k * y, st: 1.5 * k * y, oil: 1.5 * k * y, co: 8 };
  }
  // торговля Германии: шведская руда, румынская нефть, советские поставки до войны
  if (alive(S, `GER`)) {
    const sov = alive(S, `SOV`) && !atWar(S, `GER`, `SOV`) && S.t >= 4;
    const rom = alive(S, `ROM`) && side(S, `ROM`) === `axis` && own(S, `ploiesti`, `ROM`);
    // стратегические бомбардировки союзников с середины 1943 года
    const air = [`UK`, `USA`].some((a) => alive(S, a) && atWar(S, a, `GER`)) ? (S.t >= 84 ? 3 : 0) + (S.t >= 100 ? 3 : 0) + (S.t >= 112 ? 3 : 0) : 0;
    S.nat.GER.imp = { pp: -air, st: (alive(S, `SWE`) && !atWar(S, `GER`, `SWE`) ? 5 : 0) + (sov ? 1 : 0), oil: 3 + (sov ? 2 : 0) + (rom ? 4 : 0) + (S.t >= 60 ? 2 : 0) - (S.t >= 112 ? 3 : 0) };
  }
}
// ——— запуск событий ———
export function runEvents(S, ph) {
  const out = [];
  for (const e of EV) {
    if (S.done[e.id]) continue;
    if (e.t !== undefined && S.t < e.t + (e.id === `barb` ? S.barbDelay || 0 : 0)) continue;
    if (e.until !== undefined && S.t > e.until) {
      S.done[e.id] = -1;
      continue;
    }
    const p = typeof e.ph === `function` ? e.ph(S) : e.ph || `start`;
    if (p !== ph) continue;
    if (e.if && !e.if(S)) continue;
    S.done[e.id] = S.t + 1;
    if (e.opts && e.ask && e.ask === S.player) {
      S.pending.push(e.id);
      continue;
    }
    e.fx && e.fx(S);
    e.opts && e.opts[0].fx(S);
    e.ttl && (news(S, e.ttl, e.txt), out.push(e.id));
  }
  return out;
}
// объявление войны игроком: «Барбаросса» раньше срока — со всеми последствиями события
export function playerWar(S, a, b) {
  if (a === `GER` && b === `SOV` && !S.done.barb) {
    barbarossa(S);
    S.done.barb = S.t + 1;
    news(S, `Германия напала на СССР`, `Вермахт перешёл советскую границу без объявления войны.`, `war`);
    return;
  }
  declareWar(S, a, b);
  news(S, `${NATIONS[a].n} объявляет войну: ${NATIONS[b].n}`, `Дипломатия исчерпана — слово за армиями.`, `war`);
}
export function resolveEvent(S, id, k) {
  const e = EV.find((x) => x.id === id);
  S.pending = S.pending.filter((x) => x !== id);
  if (!e) return;
  e.opts[k]?.fx(S);
  e.ttl && news(S, e.ttl, `${e.txt} Решение: ${e.opts[k]?.l || `—`}.`);
}
export { supply, UT, LAND, members, unitsIn };
