// «Фронт 1941–1945» (v0.9): 104 генерала (СССР — 56, Ось — 48) с чертами и параметрами пиксельных портретов
// (src/staff/portraits.js: portraitURLP(key, por, nat)). Черты (tr): atk — наступление, def — оборона, tank — танкист,
// log — снабженец, enc — мастер окружений, ret — мастер отхода, mtn — горы и лес, cav — конница, hard — стойкость.
// sk — уровень 1–5 (влияет на силу штаба), from — дата, с которой генерал доступен для новых штабов.
export const TRAITS = {
  atk: { n: 'Наступление', d: '+8% к атаке армии' },
  def: { n: 'Оборона', d: '+8% к обороне армии' },
  tank: { n: 'Танкист', d: '+12% к атаке танковых и моторизованных дивизий' },
  log: { n: 'Снабженец', d: '+1 гекс подвоза от станции' },
  enc: { n: 'Окружения', d: 'подвижные войска армии глубже обходят противника' },
  ret: { n: 'Отход', d: 'вдвое меньше потерь при отходе' },
  mtn: { n: 'Горы и леса', d: '+15% в лесу, горах и болотах' },
  cav: { n: 'Конница', d: '+20% кавалерии, рейды по тылам' },
  hard: { n: 'Стойкость', d: '+30% к восстановлению организации' },
};
// портрет по ключу: детерминированные черты лица + переопределения
function hsh(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) (h ^= s.charCodeAt(i)), (h = Math.imul(h, 16777619));
  return h >>> 0;
}
function por(key, cap, o = {}) {
  let x = hsh(key) || 1;
  const r = () => ((x = (Math.imul(x, 1103515245) + 12345) >>> 0), (x >>> 8) / 16777216);
  const p = { f: 0.45 + r() * 0.35, j: 0.4 + r() * 0.3, n: 0.4 + r() * 0.3, b: 0.35 + r() * 0.3, a: 0.25 + r() * 0.45, h: ['short', 'short', 'comb', 'bald', 'gray'][(r() * 5) | 0], c: cap, s: (hsh(key) % 900) + 100, m: r() < 0.25 ? 0.5 + r() * 0.5 : 0 };
  return Object.assign(p, o);
}
// [ключ, имя, нация, черты, уровень, убор, переопределения портрета, доступен с]
const L = [
  // ——— СССР ———
  ['zhukov', 'Г. К. Жуков', 'SOV', 'atk hard', 5, 'sov', { f: 0.78, j: 0.66, plump: 1, h: 'short', med: 3, a: 0.42 }],
  ['timoshenko', 'С. К. Тимошенко', 'SOV', 'def', 3, 'sov', { h: 'bald', f: 0.7, a: 0.5, med: 2 }],
  ['shaposhnikov', 'Б. М. Шапошников', 'SOV', 'log', 4, 'sov', { a: 0.85, h: 'gray', long: 1, med: 1 }],
  ['vasilevsky', 'А. М. Василевский', 'SOV', 'log atk', 5, 'sov', { a: 0.4, f: 0.6, med: 2 }],
  ['budyonny', 'С. М. Будённый', 'SOV', 'cav', 2, 'sov', { m: 1, a: 0.6, f: 0.7, med: 3 }],
  ['voroshilov', 'К. Е. Ворошилов', 'SOV', 'def', 2, 'sov', { a: 0.65, h: 'gray', med: 3 }],
  ['popov_m', 'М. М. Попов', 'SOV', 'def', 3, 'sov', { a: 0.25 }],
  ['kuznetsov_f', 'Ф. И. Кузнецов', 'SOV', 'def', 2, 'sov', { a: 0.6, h: 'bald' }],
  ['pavlov', 'Д. Г. Павлов', 'SOV', 'tank', 1, 'sov', { f: 0.66, j: 0.45, n: 0.52, b: 0.5, a: 0.35, h: 'bald', med: 2 }],
  ['kirponos', 'М. П. Кирпонос', 'SOV', 'def', 3, 'sov', { a: 0.4, med: 1 }],
  ['tyulenev', 'И. В. Тюленев', 'SOV', 'cav', 2, 'sov', { m: 0.6, a: 0.5 }],
  ['frolov', 'В. А. Фролов', 'SOV', 'def mtn', 3, 'sov', {}],
  ['gorelenko', 'Ф. Д. Гореленко', 'SOV', 'def', 2, 'sov', {}],
  ['pshennikov', 'П. С. Пшенников', 'SOV', 'def', 2, 'sov', {}],
  ['sobennikov', 'П. П. Собенников', 'SOV', 'cav', 2, 'sov', {}],
  ['morozov_v', 'В. И. Морозов', 'SOV', 'def', 2, 'sov', {}],
  ['berzarin', 'Н. Э. Берзарин', 'SOV', 'atk', 4, 'sov', { a: 0.2, f: 0.62 }],
  ['kuznetsov_v', 'В. И. Кузнецов', 'SOV', 'def ret', 3, 'sov', { a: 0.4 }],
  ['golubev', 'К. Д. Голубев', 'SOV', 'def', 2, 'sov', {}],
  ['korobkov', 'А. А. Коробков', 'SOV', 'def', 1, 'sov', {}],
  ['filatov', 'П. М. Филатов', 'SOV', 'def', 2, 'sov', {}],
  ['potapov', 'М. И. Потапов', 'SOV', 'def tank', 3, 'sov', { a: 0.2 }],
  ['muzychenko', 'И. Н. Музыченко', 'SOV', 'cav', 2, 'sov', {}],
  ['kostenko', 'Ф. Я. Костенко', 'SOV', 'def', 3, 'sov', {}],
  ['ponedelin', 'П. Г. Понеделин', 'SOV', 'def', 2, 'sov', {}],
  ['cherevichenko', 'Я. Т. Черевиченко', 'SOV', 'cav', 2, 'sov', { m: 0.5 }],
  ['smirnov_a', 'А. К. Смирнов', 'SOV', 'def', 2, 'sov', {}],
  ['lukin', 'М. Ф. Лукин', 'SOV', 'def hard', 4, 'sov', { a: 0.45 }],
  ['konev', 'И. С. Конев', 'SOV', 'atk', 5, 'sov', { h: 'bald', f: 0.7, a: 0.45, med: 2 }],
  ['kurochkin', 'П. А. Курочкин', 'SOV', 'def', 3, 'sov', {}],
  ['gerasimenko', 'В. Ф. Герасименко', 'SOV', 'def', 2, 'sov', {}],
  ['yershakov', 'Ф. А. Ершаков', 'SOV', 'def', 2, 'sov', {}],
  ['rakutin', 'К. И. Ракутин', 'SOV', 'def', 2, 'sov', {}],
  ['rokossovsky', 'К. К. Рокоссовский', 'SOV', 'def atk', 5, 'sov', { long: 1, f: 0.52, j: 0.6, a: 0.35, med: 2 }],
  ['yeremenko', 'А. И. Ерёменко', 'SOV', 'def hard', 4, 'sov', { plump: 1, a: 0.45 }],
  ['vatutin', 'Н. Ф. Ватутин', 'SOV', 'atk enc', 5, 'sov', { f: 0.74, plump: 1, a: 0.3 }],
  ['malinovsky', 'Р. Я. Малиновский', 'SOV', 'atk enc', 5, 'sov', { a: 0.4, b: 0.62 }],
  ['tolbukhin', 'Ф. И. Толбухин', 'SOV', 'atk', 4, 'sov', { plump: 1, f: 0.8, a: 0.48 }],
  ['govorov', 'Л. А. Говоров', 'SOV', 'def', 4, 'sov', { m: 0.8, a: 0.42 }],
  ['meretskov', 'К. А. Мерецков', 'SOV', 'mtn', 3, 'sov', { h: 'bald', a: 0.45 }],
  ['bagramyan', 'И. Х. Баграмян', 'SOV', 'atk', 4, 'sov', { sk: 'olive', hc: 'blk', a: 0.4, m: 0.4 }],
  ['chernyakhovsky', 'И. Д. Черняховский', 'SOV', 'atk tank', 5, 'tank', { a: 0.12, f: 0.58, h: 'comb' }],
  ['petrov_i', 'И. Е. Петров', 'SOV', 'def hard', 4, 'sov', { g: 1, m: 0.5, a: 0.5 }],
  ['chuikov', 'В. И. Чуйков', 'SOV', 'def hard', 5, 'sov', { h: 'curly', gold: 1, a: 0.35, med: 2 }],
  ['katukov', 'М. Е. Катуков', 'SOV', 'tank def', 5, 'tank', { a: 0.35 }],
  ['rotmistrov', 'П. А. Ротмистров', 'SOV', 'tank', 4, 'tank', { m: 0.9, g: 1, a: 0.45, gog: 1 }],
  ['rybalko', 'П. С. Рыбалко', 'SOV', 'tank atk', 5, 'tank', { a: 0.5, plump: 1 }],
  ['lelyushenko', 'Д. Д. Лелюшенко', 'SOV', 'tank', 4, 'tank', { a: 0.35 }],
  ['bogdanov', 'С. И. Богданов', 'SOV', 'tank', 4, 'tank', { a: 0.45 }],
  ['batov', 'П. И. Батов', 'SOV', 'def atk', 4, 'sov', { a: 0.4 }],
  ['belov', 'П. А. Белов', 'SOV', 'cav', 4, 'kub', { a: 0.45, m: 0.5 }],
  ['golikov', 'Ф. И. Голиков', 'SOV', 'def', 2, 'sov', { h: 'bald' }],
  ['sokolovsky', 'В. Д. Соколовский', 'SOV', 'log', 3, 'sov', { a: 0.45 }],
  ['fedyuninsky', 'И. И. Федюнинский', 'SOV', 'def', 4, 'sov', { a: 0.3 }],
  ['moskalenko', 'К. С. Москаленко', 'SOV', 'atk', 4, 'sov', { a: 0.35 }],
  ['shumilov', 'М. С. Шумилов', 'SOV', 'def', 4, 'sov', { h: 'bald', a: 0.45 }],
  // ——— Германия ———
  ['manstein', 'Э. фон Манштейн', 'GER', 'atk enc', 5, 'ger', { long: 1, a: 0.55, h: 'gray', n: 0.66, kc: 1 }],
  ['leeb', 'В. фон Лееб', 'GER', 'def', 3, 'ger', { a: 0.85, h: 'gray' }],
  ['bock', 'Ф. фон Бок', 'GER', 'atk', 4, 'ger', { long: 1, a: 0.65 }],
  ['rundstedt', 'Г. фон Рундштедт', 'GER', 'def', 4, 'ger', { a: 0.9, h: 'gray', long: 1 }],
  ['kuchler', 'Г. фон Кюхлер', 'GER', 'def', 3, 'ger', { a: 0.7, h: 'gray' }],
  ['busch', 'Э. Буш', 'GER', 'def', 2, 'ger', { a: 0.6 }],
  ['hoepner', 'Э. Гёпнер', 'GER', 'tank', 4, 'ger', { a: 0.6, h: 'bald' }],
  ['strauss', 'А. Штраус', 'GER', 'def', 2, 'ger', { a: 0.7 }],
  ['kluge', 'Г. фон Клюге', 'GER', 'def', 4, 'ger', { a: 0.65, h: 'gray' }],
  ['hoth', 'Г. Гот', 'GER', 'tank enc', 5, 'ger', { f: 0.46, j: 0.6, n: 0.6, b: 0.4, a: 0.6, h: 'gray', kc: 1 }],
  ['guderian', 'Г. Гудериан', 'GER', 'tank enc', 5, 'ger', { a: 0.5, m: 0.3, h: 'short' }],
  ['weichs', 'М. фон Вейхс', 'GER', 'def', 3, 'ger', { a: 0.65, g: 1 }],
  ['reichenau', 'В. фон Рейхенау', 'GER', 'atk', 4, 'ger', { a: 0.6, g: 1 }],
  ['stulpnagel', 'К.-Г. фон Штюльпнагель', 'GER', 'def', 3, 'ger', { a: 0.6 }],
  ['schobert', 'О. фон Шоберт', 'GER', 'atk', 3, 'ger', { a: 0.6 }],
  ['kleist', 'Э. фон Клейст', 'GER', 'tank', 4, 'ger', { a: 0.65, long: 1 }],
  ['falkenhorst', 'Н. фон Фалькенхорст', 'GER', 'mtn', 2, 'ger', { a: 0.6 }],
  ['dietl', 'Э. Дитль', 'GER', 'mtn hard', 4, 'gerf', { a: 0.5, long: 1 }],
  ['paulus', 'Ф. Паулюс', 'GER', 'atk', 3, 'ger', { long: 1, a: 0.5 }],
  ['model', 'В. Модель', 'GER', 'def hard', 5, 'ger', { g: 1, a: 0.5, plump: 1, kc: 1 }],
  ['schorner', 'Ф. Шёрнер', 'GER', 'def hard', 4, 'gerf', { a: 0.5 }],
  ['heinrici', 'Г. Хейнрици', 'GER', 'def ret', 5, 'ger', { a: 0.55, m: 0.4 }],
  ['mackensen', 'Э. фон Макензен', 'GER', 'tank', 3, 'ger', { a: 0.5 }],
  ['ruoff', 'Р. Руоф', 'GER', 'def', 3, 'ger', { a: 0.6, h: 'bald' }],
  ['lindemann', 'Г. Линдеман', 'GER', 'def', 3, 'ger', { a: 0.6 }],
  ['reinhardt', 'Г. Рейнгардт', 'GER', 'tank def', 4, 'ger', { a: 0.5, g: 1 }],
  ['schmidt_r', 'Р. Шмидт', 'GER', 'tank', 3, 'ger', { a: 0.5 }],
  ['hollidt', 'К.-А. Холлидт', 'GER', 'def ret', 3, 'ger', { a: 0.55 }],
  ['wohler', 'О. Вёлер', 'GER', 'def', 3, 'ger', { a: 0.5 }],
  ['harpe', 'Й. Харпе', 'GER', 'tank', 3, 'ger', { a: 0.5 }],
  ['hube', 'Х.-В. Хубе', 'GER', 'tank hard', 4, 'ger', { a: 0.5, h: 'bald' }],
  ['raus', 'Э. Раус', 'GER', 'tank def', 4, 'ger', { a: 0.5, g: 1 }],
  ['balck', 'Г. Бальк', 'GER', 'tank atk', 4, 'ger', { a: 0.45 }],
  ['busse', 'Т. Буссе', 'GER', 'def', 3, 'ger', { a: 0.45, g: 1 }],
  ['wenck', 'В. Венк', 'GER', 'atk', 4, 'ger', { a: 0.25 }],
  ['jany', 'Г. Яни', 'HUN', 'def', 2, 'gerf', { a: 0.6, m: 0.6 }],
  ['miklos', 'Б. Миклош', 'HUN', 'tank', 3, 'gerf', { a: 0.5 }],
  ['dumitrescu', 'П. Думитреску', 'ROM', 'def', 3, 'rom', { a: 0.55 }],
  ['ciuperca', 'Н. Чуперкэ', 'ROM', 'def', 2, 'rom', { a: 0.6, m: 0.5 }],
  ['constantinescu', 'К. Константинеску', 'ROM', 'def', 2, 'rom', { a: 0.55 }],
  ['messe', 'Дж. Мессе', 'ITA', 'def mtn', 4, 'ita', { a: 0.5 }],
  ['gariboldi', 'И. Гарибольди', 'ITA', 'def', 2, 'ita', { a: 0.7, m: 0.8 }],
  ['mannerheim', 'К. Г. Маннергейм', 'FIN', 'def mtn', 5, 'gerf', { a: 0.9, long: 1, h: 'gray', m: 0.5 }],
  ['heinrichs', 'Э. Хейнрикс', 'FIN', 'mtn', 4, 'gerf', { a: 0.55 }],
  ['oesch', 'К. Л. Эш', 'FIN', 'def', 3, 'gerf', { a: 0.5 }],
  ['talvela', 'П. Талвела', 'FIN', 'mtn atk', 4, 'gerf', { a: 0.45 }],
  ['siilasvuo', 'Я. Сийласвуо', 'FIN', 'mtn', 4, 'gerf', { a: 0.45 }],
  ['catlos', 'Ф. Чатлош', 'SVK', 'def', 2, 'gerf', { a: 0.5 }],
];
// портреты рисуются в мундирах четырёх армий (SOV, GER, ROM, ITA); Финляндия и Словакия — в сером, Венгрия — в хаки
export const POR_NAT = { SOV: 'SOV', GER: 'GER', FIN: 'GER', SVK: 'GER', HUN: 'ROM', ROM: 'ROM', ITA: 'ITA', UK: 'UK', USA: 'USA', FRA: 'FRA' };
export const GENS = {};
for (const [k, n, nat, tr, sk, cap, o, from] of L) {
  const p = por(k, cap, o);
  if (nat !== 'GER') p.kc = o.kc ?? 0;
  GENS[k] = { k, n, sh: n.split(' ').slice(-1)[0], nat, tr: tr.split(' '), sk, por: p, from: from || '1941-06-22' };
}
// командармы и командующие, не вошедшие в основной список (новые армии РККА, поздние группы армий Оси)
const L2 = [
  ['kachalov', 'В. Я. Качалов', 'SOV', 'def', 2, 'sov', { a: 0.45 }],
  ['maslennikov', 'И. И. Масленников', 'SOV', 'def', 3, 'sov', { a: 0.4 }],
  ['khomenko', 'В. А. Хоменко', 'SOV', 'def', 2, 'sov', { a: 0.4 }],
  ['dolmatov', 'В. Н. Долматов', 'SOV', 'def', 2, 'sov', { a: 0.5 }],
  ['vishnevsky', 'С. В. Вишневский', 'SOV', 'def', 2, 'sov', { a: 0.5 }],
  ['yefremov', 'М. Г. Ефремов', 'SOV', 'atk hard', 3, 'sov', { a: 0.45 }],
  ['kachanov', 'К. М. Качанов', 'SOV', 'def', 1, 'sov', { a: 0.4 }],
  ['ryabyshev', 'Д. И. Рябышев', 'SOV', 'tank', 2, 'sov', { a: 0.45 }],
  ['zakharkin', 'И. Г. Захаркин', 'SOV', 'def', 2, 'sov', { a: 0.5 }],
  ['lopatin', 'А. И. Лопатин', 'SOV', 'def', 2, 'sov', { a: 0.45 }],
  ['boldin', 'И. В. Болдин', 'SOV', 'def hard', 3, 'sov', { a: 0.5 }],
  ['podlas', 'К. П. Подлас', 'SOV', 'def', 2, 'sov', { a: 0.45 }],
  ['klykov', 'Н. К. Клыков', 'SOV', 'atk', 2, 'sov', { a: 0.5 }],
  ['kulik', 'Г. И. Кулик', 'SOV', 'def', 1, 'sov', { a: 0.6, h: 'bald' }],
  ['lazarev', 'И. Г. Лазарев', 'SOV', 'def', 2, 'sov', { a: 0.45 }],
  ['remezov', 'Ф. Н. Ремезов', 'SOV', 'def', 2, 'sov', { a: 0.5 }],
  ['kozlov', 'Д. Т. Козлов', 'SOV', 'def', 1, 'sov', { a: 0.5 }],
  ['galanin', 'И. В. Галанин', 'SOV', 'def', 3, 'sov', { a: 0.45 }],
  ['purkaev', 'М. А. Пуркаев', 'SOV', 'def', 3, 'sov', { a: 0.45, h: 'bald' }],
  ['sokolov_g', 'Г. Г. Соколов', 'SOV', 'def', 1, 'sov', { a: 0.5 }],
  ['khozin', 'М. С. Хозин', 'SOV', 'def', 2, 'sov', { a: 0.45 }],
  ['zakharov', 'Г. Ф. Захаров', 'SOV', 'atk', 3, 'sov', { a: 0.45 }],
  ['romanenko', 'П. Л. Романенко', 'SOV', 'tank', 2, 'sov', { a: 0.45 }],
  ['romanovsky', 'В. З. Романовский', 'SOV', 'def', 2, 'sov', { a: 0.45 }],
  ['badanov', 'В. М. Баданов', 'SOV', 'tank atk', 3, 'sov', { a: 0.5 }],
  ['rodin', 'А. Г. Родин', 'SOV', 'tank', 2, 'sov', { a: 0.45 }],
  ['kravchenko', 'А. Г. Кравченко', 'SOV', 'tank enc', 4, 'sov', { a: 0.35 }],
  ['zhadov', 'А. С. Жадов', 'SOV', 'def hard', 4, 'sov', { a: 0.4 }],
  ['chistyakov', 'И. М. Чистяков', 'SOV', 'def', 4, 'sov', { a: 0.4 }],
  ['galitsky', 'К. Н. Галицкий', 'SOV', 'atk', 4, 'sov', { a: 0.4 }],
  ['kreizer', 'Я. Г. Крейзер', 'SOV', 'def', 3, 'sov', { a: 0.35 }],
  ['kryuchenkin', 'В. Д. Крюченкин', 'SOV', 'cav', 2, 'sov', { a: 0.5 }],
  ['zhmachenko', 'Ф. Ф. Жмаченко', 'SOV', 'def', 3, 'sov', { a: 0.45 }],
  ['managarov', 'И. М. Манагаров', 'SOV', 'atk', 3, 'sov', { a: 0.4 }],
  ['tsvetaev', 'В. Д. Цветаев', 'SOV', 'atk', 3, 'sov', { a: 0.45 }],
  ['glagolev', 'В. В. Глаголев', 'SOV', 'mtn', 3, 'sov', { a: 0.45 }],
  ['gagen', 'Н. А. Гаген', 'SOV', 'def', 3, 'sov', { a: 0.45 }],
  ['gordov', 'В. Н. Гордов', 'SOV', 'def', 2, 'sov', { a: 0.45 }],
  ['berling', 'З. Берлинг', 'SOV', 'def', 2, 'sov', { a: 0.4 }],
  ['friessner', 'Г. Фриснер', 'GER', 'def ret', 4, 'ger', { a: 0.5 }],
  ['rendulic', 'Л. Рендулич', 'GER', 'def mtn', 4, 'ger', { a: 0.45 }],
  ['kempf', 'В. Кемпф', 'GER', 'tank', 3, 'ger', { a: 0.5 }],
  ['salmuth', 'Г. фон Зальмут', 'GER', 'def', 3, 'ger', { a: 0.55 }],
  ['weiss', 'В. Вейс', 'GER', 'def', 3, 'ger', { a: 0.45 }],
  ['tippelskirch', 'К. фон Типпельскирх', 'GER', 'def', 3, 'ger', { a: 0.5 }],
];
// безымянные командиры для армий, сверх списков (детерминированные портреты)
export const EXTRA = {};
for (const [k, n, nat, tr, sk, cap, o, from] of L2) {
  const p = por(k, cap, o);
  if (nat !== 'GER') p.kc = o.kc ?? 0;
  EXTRA[k] = { k, n, sh: n.split(' ').slice(-1)[0], nat, tr: tr.split(' '), sk, por: p, from: from || '1941-06-22', x: 1 };
}
// v0.12 «Запад и Африка»: командующие Великобритании (с доминионами), США, Франции и Оси на Западе, в Африке и Италии
const L3 = [
  ['gort', 'Дж. Горт', 'UK', 'def', 3, 'uk', { a: 0.6, m: 0.7 }, '1939-09-01'],
  ['brooke', 'А. Брук', 'UK', 'def log', 5, 'uk', { a: 0.6, m: 0.6, h: 'bald' }, '1939-09-01'],
  ['wavell', 'А. Уэйвелл', 'UK', 'def log', 4, 'uk', { a: 0.65, m: 0.6, h: 'gray' }, '1939-09-01'],
  ['oconnor', "Р. О'Коннор", 'UK', 'tank enc', 5, 'uk', { a: 0.5, f: 0.5 }, '1940-06-10'],
  ['auchinleck', 'К. Окинлек', 'UK', 'def hard', 4, 'uk', { a: 0.55, j: 0.65 }, '1940-06-10'],
  ['cunningham_a', 'А. Каннингем', 'UK', 'atk', 2, 'uk', { a: 0.55 }, '1941-06-22'],
  ['ritchie', 'Н. Ричи', 'UK', 'def', 2, 'uk', { a: 0.45, m: 0.6 }, '1941-06-22'],
  ['montgomery', 'Б. Монтгомери', 'UK', 'atk def', 5, 'beret', { a: 0.55, f: 0.45, m: 0 }, '1942-08-13'],
  ['alexander', 'Х. Александер', 'UK', 'def atk', 4, 'uk', { a: 0.5, m: 0.5 }, '1942-08-15'],
  ['wilson', 'Г. Мейтленд Вильсон', 'UK', 'def', 3, 'uk', { a: 0.65, plump: 1, h: 'bald', m: 0.7 }, '1940-06-10'],
  ['quinan', 'Э. Куинан', 'UK', 'def', 2, 'uk', { a: 0.6, m: 0.6 }, '1941-06-22'],
  ['paget', 'Б. Пейджет', 'UK', 'def', 3, 'uk', { a: 0.55, m: 0.6 }, '1941-06-22'],
  ['anderson_k', 'К. Андерсон', 'UK', 'def', 2, 'uk', { a: 0.5 }, '1942-08-01'],
  ['leese', 'О. Лиз', 'UK', 'atk', 3, 'uk', { a: 0.5, m: 0.5 }, '1943-01-01'],
  ['dempsey', 'М. Демпси', 'UK', 'atk', 3, 'uk', { a: 0.45 }, '1943-01-01'],
  ['crerar', 'Г. Крерар', 'UK', 'def', 3, 'uk', { a: 0.5, m: 0.5 }, '1943-01-01'],
  ['freyberg', 'Б. Фрейберг', 'UK', 'def hard', 4, 'uk', { a: 0.55, plump: 1 }, '1940-06-10'],
  ['morshead', 'Л. Морсхед', 'UK', 'def hard', 4, 'uk', { a: 0.5, m: 0.5 }, '1941-03-01'],
  ['eisenhower', 'Д. Эйзенхауэр', 'USA', 'def log', 5, 'us', { a: 0.5, h: 'bald', ex: 'smile' }, '1942-06-25'],
  ['patton', 'Дж. Паттон', 'USA', 'tank atk enc', 5, 'us', { a: 0.6, h: 'gray', ex: 'stern' }, '1942-06-25'],
  ['bradley', 'О. Брэдли', 'USA', 'def log', 4, 'us', { a: 0.5, h: 'gray' }, '1943-02-01'],
  ['clark', 'М. Кларк', 'USA', 'atk', 3, 'us', { a: 0.45, long: 1 }, '1942-06-25'],
  ['fredendall', 'Л. Фредендалл', 'USA', 'def', 1, 'us', { a: 0.6 }, '1941-12-11'],
  ['truscott', 'Л. Траскотт', 'USA', 'atk hard', 4, 'us', { a: 0.5 }, '1943-01-01'],
  ['hodges', 'К. Ходжес', 'USA', 'def', 3, 'us', { a: 0.6, m: 0.5 }, '1944-01-01'],
  ['patch', 'А. Патч', 'USA', 'def', 3, 'us', { a: 0.5 }, '1944-01-01'],
  ['devers', 'Дж. Деверс', 'USA', 'def', 3, 'us', { a: 0.55 }, '1944-01-01'],
  ['simpson', 'У. Симпсон', 'USA', 'def', 3, 'us', { a: 0.55, h: 'bald' }, '1944-05-01'],
  ['gamelin', 'М. Гамелен', 'FRA', 'def', 2, 'fra', { a: 0.75, m: 0.7, h: 'gray' }, '1939-09-01'],
  ['weygand', 'М. Вейган', 'FRA', 'def', 3, 'fra', { a: 0.85, m: 0.6, h: 'gray' }, '1939-09-01'],
  ['degaulle', 'Ш. де Голль', 'FRA', 'tank', 3, 'fra', { a: 0.45, long: 1, n: 0.7 }, '1940-06-18'],
  ['juin', 'А. Жюэн', 'FRA', 'mtn atk', 4, 'fra', { a: 0.55 }, '1942-11-08'],
  ['witzleben', 'Э. фон Вицлебен', 'GER', 'def', 3, 'ger', { a: 0.6 }, '1939-09-01'],
  ['rommel', 'Э. Роммель', 'GER', 'tank atk enc', 5, 'ger', { a: 0.5, j: 0.6 }, '1939-09-01'],
  ['kesselring', 'А. Кессельринг', 'GER', 'def hard', 5, 'ger', { a: 0.55, ex: 'smile' }, '1939-09-01'],
  ['arnim', 'Х.-Ю. фон Арним', 'GER', 'def', 3, 'ger', { a: 0.55 }, '1939-09-01'],
  ['list', 'В. Лист', 'GER', 'mtn atk', 4, 'ger', { a: 0.65 }, '1939-09-01'],
  ['lohr', 'А. Лёр', 'GER', 'def', 3, 'ger', { a: 0.6 }, '1939-09-01'],
  ['vietinghoff', 'Г. фон Фитингоф', 'GER', 'def ret', 4, 'ger', { a: 0.55 }, '1939-09-01'],
  ['blaskowitz', 'Й. Бласковиц', 'GER', 'def', 3, 'ger', { a: 0.6 }, '1939-09-01'],
  ['stumme', 'Г. Штумме', 'GER', 'tank', 3, 'ger', { a: 0.55, plump: 1 }, '1939-09-01'],
  ['cruwell', 'Л. Крювель', 'GER', 'tank', 3, 'ger', { a: 0.5 }, '1939-09-01'],
  ['student', 'К. Штудент', 'GER', 'atk', 4, 'ger', { a: 0.5 }, '1939-09-01'],
  ['graziani', 'Р. Грациани', 'ITA', 'def', 2, 'ita', { a: 0.6, h: 'bald' }, '1939-09-01'],
  ['bastico', 'Э. Бастико', 'ITA', 'def', 2, 'ita', { a: 0.6 }, '1939-09-01'],
  ['cavallero', 'У. Кавальеро', 'ITA', 'def', 2, 'ita', { a: 0.6, plump: 1 }, '1939-09-01'],
  ['ambrosio', 'В. Амброзио', 'ITA', 'def', 2, 'ita', { a: 0.6 }, '1939-09-01'],
  ['roatta', 'М. Роатта', 'ITA', 'def mtn', 2, 'ita', { a: 0.55 }, '1939-09-01'],
  ['guzzoni', 'А. Гуццони', 'ITA', 'def', 2, 'ita', { a: 0.7, plump: 1 }, '1939-09-01'],
];
for (const [k, n, nat, tr, sk, cap, o, from] of L3) {
  const p = por(k, cap, o);
  if (nat !== 'GER') p.kc = o.kc ?? 0;
  GENS[k] = { k, n, sh: n.split(' ').slice(-1)[0], nat, tr: tr.split(' '), sk, por: p, from: from || '1941-06-22' };
}
export const ALLG = { ...GENS, ...EXTRA };
// сторона генерала: СССР, Великобритания (и «Свободная Франция»), США; остальные — Ось
const GSIDE = { SOV: 'SOV', UK: 'UK', USA: 'USA', FRA: 'UK' };
export const genSide = (k) => GSIDE[ALLG[k]?.nat] || 'GER';
