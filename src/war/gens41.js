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
export const POR_NAT = { SOV: 'SOV', GER: 'GER', FIN: 'GER', SVK: 'GER', HUN: 'ROM', ROM: 'ROM', ITA: 'ITA' };
export const GENS = {};
for (const [k, n, nat, tr, sk, cap, o, from] of L) {
  const p = por(k, cap, o);
  if (nat !== 'GER') p.kc = o.kc ?? 0;
  GENS[k] = { k, n, sh: n.split(' ').slice(-1)[0], nat, tr: tr.split(' '), sk, por: p, from: from || '1941-06-22' };
}
export const genSide = (k) => (GENS[k]?.nat === 'SOV' ? 'SOV' : 'GER');
