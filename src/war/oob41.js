// «Фронт 1941–1945» (v0.9): штабы и дивизии на 22 июня 1941 г. и вторые эшелоны первых двух недель.
// 56 штабов: ОКХ и Ставка, 9 групп армий и фронтов, 39 армий и танковых групп, 6 корпусов.
// 283 дивизии на 22.06 (Ось — 152, СССР — 131) и 57 вторых эшелонов; советский мехкорпус — одна фишка.
// Расстановка — по участкам армий (две точки «долгота, широта») на глубину dp гексов от границы (engine.js: placeOOB).
// Коды дивизий: p — пехотная (стрелковая), t — танковая, m — моторизованная, g — горная, k — кавалерийская,
// o — охранная, mk — мехкорпус, td — танковая дивизия РККА, kd — кавдивизия, gs — горнострелковая, vd — воздушно-
// десантный корпус, br — отдельная бригада (гарнизон), ss: / nm: — именные (SS «Райх», «Пасубио»); :N — танков.
export const HQ0 = [
  // ——— верховное командование ———
  { k: 'okh', side: 'GER', nat: 'GER', lv: 0, ech: 'XXXXXX', n: 'Главное командование сухопутных войск (ОКХ)', lab: ['ОКХ', ''], gen: 'manstein' },
  { k: 'stavka', side: 'SOV', nat: 'SOV', lv: 0, ech: 'XXXXXX', n: 'Ставка Верховного Главнокомандования', lab: ['Ставка', 'ВГК'], gen: 'zhukov' },
  // ——— группы армий Оси ———
  { k: 'agn', side: 'GER', nat: 'GER', lv: 1, up: 'okh', ech: 'XXXXX', n: 'Группа армий «Север»', lab: ['ГА', '«Север»'], gen: 'leeb', gt: [['1942-01-17', 'kuchler'], ['1944-01-31', 'model'], ['1944-03-31', 'lindemann'], ['1944-07-23', 'schorner']] },
  { k: 'agc', side: 'GER', nat: 'GER', lv: 1, up: 'okh', ech: 'XXXXX', n: 'Группа армий «Центр»', lab: ['ГА', '«Центр»'], gen: 'bock', gt: [['1941-12-19', 'kluge'], ['1943-10-29', 'busch'], ['1944-06-28', 'model'], ['1944-08-16', 'reinhardt'], ['1945-01-26', 'schorner']] },
  { k: 'ags', side: 'GER', nat: 'GER', lv: 1, up: 'okh', ech: 'XXXXX', n: 'Группа армий «Юг»', lab: ['ГА', '«Юг»'], gen: 'rundstedt', gt: [['1941-12-01', 'reichenau'], ['1942-01-18', 'bock'], ['1942-07-15', 'weichs'], ['1942-11-27', 'manstein'], ['1944-03-31', 'model'], ['1944-06-28', 'harpe'], ['1945-01-17', 'schorner']] },
  { k: 'fin', side: 'GER', nat: 'FIN', lv: 1, up: 'okh', ech: 'XXXXX', n: 'Ставка Финляндии', lab: ['Ставка', 'Финляндии'], gen: 'mannerheim' },
  // ——— фронты РККА ———
  { k: 'nf', side: 'SOV', nat: 'SOV', lv: 1, up: 'stavka', ech: 'XXXXX', n: 'Северный фронт', lab: ['Северный', 'фронт'], gen: 'popov_m', rn: [['1941-08-27', 'Ленинградский фронт', ['Ленингр.', 'фронт']]], gt: [['1941-09-11', 'zhukov'], ['1941-10-26', 'fedyuninsky'], ['1942-06-09', 'govorov']] },
  { k: 'nwf', side: 'SOV', nat: 'SOV', lv: 1, up: 'stavka', ech: 'XXXXX', n: 'Северо-Западный фронт', lab: ['Сев.-Зап.', 'фронт'], gen: 'kuznetsov_f', gt: [['1941-07-04', 'sobennikov'], ['1941-08-23', 'kurochkin'], ['1943-11-20', 'popov_m']], rn: [['1943-10-20', '2-й Прибалтийский фронт', ['2-й Приб.', 'фронт']]] },
  { k: 'wf', side: 'SOV', nat: 'SOV', lv: 1, up: 'stavka', ech: 'XXXXX', n: 'Западный фронт', lab: ['Западный', 'фронт'], gen: 'pavlov', gt: [['1941-06-30', 'yeremenko'], ['1941-07-19', 'timoshenko'], ['1941-09-12', 'konev'], ['1941-10-10', 'zhukov'], ['1942-08-26', 'konev'], ['1943-02-27', 'sokolovsky'], ['1944-04-24', 'chernyakhovsky']], rn: [['1944-04-24', '3-й Белорусский фронт', ['3-й Бел.', 'фронт']]] },
  { k: 'swf', side: 'SOV', nat: 'SOV', lv: 1, up: 'stavka', ech: 'XXXXX', n: 'Юго-Западный фронт', lab: ['Юго-Зап.', 'фронт'], gen: 'kirponos', gt: [['1941-09-21', 'timoshenko'], ['1942-10-25', 'vatutin'], ['1943-03-27', 'malinovsky']], rn: [['1943-10-20', '3-й Украинский фронт', ['3-й Укр.', 'фронт']]], gt2: [['1943-10-20', 'tolbukhin']] },
  { k: 'sof', side: 'SOV', nat: 'SOV', lv: 1, up: 'stavka', ech: 'XXXXX', n: 'Южный фронт', lab: ['Южный', 'фронт'], gen: 'tyulenev', gt: [['1941-08-30', 'cherevichenko'], ['1942-02-01', 'malinovsky'], ['1943-03-22', 'tolbukhin'], ['1943-10-20', 'malinovsky']], rn: [['1943-10-20', '2-й Украинский фронт', ['2-й Укр.', 'фронт']]] },
  // ——— Финляндия и Север ———
  { k: 'norw', side: 'GER', nat: 'GER', lv: 2, up: 'fin', ech: 'XXXX', n: 'Армия «Норвегия»', num: 'Н', gen: 'falkenhorst', gt: [['1942-01-14', 'dietl']], rn: [['1942-06-22', '20-я горная армия', null, '20']],
    ax: [[30.6, 69.3], [29.4, 66.9]], dp: [1, 2], u: 'p169 ss:Норд' },
  { k: 'gebn', side: 'GER', nat: 'GER', lv: 3, up: 'norw', ech: 'XXX', n: 'Горный корпус «Норвегия»', num: 'Гор', gen: 'dietl', ax: [[30.9, 69.5], [30.6, 69.2]], dp: [1, 2], u: 'g2 g3' },
  { k: 'fin3', side: 'GER', nat: 'FIN', lv: 3, up: 'norw', ech: 'XXX', n: 'III корпус (Финляндия)', num: 'III', gen: 'siilasvuo', ax: [[29.4, 66.0], [29.4, 64.8]], dp: [1, 2], u: 'p3 p6' },
  { k: 'kar', side: 'GER', nat: 'FIN', lv: 2, up: 'fin', ech: 'XXXX', n: 'Карельская армия', num: 'К', gen: 'heinrichs', gt: [['1942-03-01', 'talvela']],
    ax: [[30.6, 63.4], [30.2, 61.9]], dp: [1, 3], u: 'p1 p5 p7 p11 p19 k1 GER:p163' },
  { k: 'fise', side: 'GER', nat: 'FIN', lv: 2, up: 'fin', ech: 'XXXX', n: 'Юго-Восточная армия (Финляндия)', num: 'ЮВ', gen: 'oesch',
    ax: [[27.6, 60.7], [29.8, 61.6]], dp: [1, 3], u: 'p2 p4 p8 p10 p12 p14 p15 p17 p18' },
  // ——— группа армий «Север» ———
  { k: 'g18', side: 'GER', nat: 'GER', lv: 2, up: 'agn', ech: 'XXXX', n: '18-я армия', num: '18', gen: 'kuchler', gt: [['1942-01-17', 'lindemann']], ax: [[21.2, 55.8], [21.9, 55.1]], dp: [1, 2], u: 'p1 p11 p21 p61 p217 p291 p58' },
  { k: 'pz4', side: 'GER', nat: 'GER', lv: 2, up: 'agn', ech: 'XXXX', mech: 1, n: '4-я танковая группа', num: '4', sub: 'Тг', gen: 'hoepner', rn: [['1942-01-01', '4-я танковая армия', null, '4', 'ТА']], gt: [['1942-01-08', 'raus'], ['1942-06-01', 'hoth'], ['1943-12-10', 'raus'], ['1944-05-18', 'harpe'], ['1944-06-28', 'balck']],
    ax: [[21.9, 55.1], [22.4, 54.95]], dp: [1, 3], u: 't1 t6 t8 m36 m3 ss:Мёртвая_голова p269 p290' },
  { k: 'g16', side: 'GER', nat: 'GER', lv: 2, up: 'agn', ech: 'XXXX', n: '16-я армия', num: '16', gen: 'busch', ax: [[22.4, 54.95], [22.75, 54.45]], dp: [1, 3], u: 'p30 p126 p122 p123 p12 p32 p121 p253 p206 p251 p254' },
  // ——— группа армий «Центр» ———
  { k: 'pz3', side: 'GER', nat: 'GER', lv: 2, up: 'agc', ech: 'XXXX', mech: 1, n: '3-я танковая группа', num: '3', sub: 'Тг', gen: 'hoth', rn: [['1942-01-01', '3-я танковая армия', null, '3', 'ТА']], gt: [['1941-10-05', 'reinhardt'], ['1944-08-16', 'raus']],
    ax: [[22.85, 54.35], [23.05, 54.05]], dp: [1, 3], u: 't7 t20 t12 t19 m14 m20 m18 p5 p35 p6 p26' },
  { k: 'g9', side: 'GER', nat: 'GER', lv: 2, up: 'agc', ech: 'XXXX', n: '9-я армия', num: '9', gen: 'strauss', gt: [['1942-01-16', 'model'], ['1943-11-04', 'harpe'], ['1944-09-21', 'busse']],
    ax: [[22.9, 53.95], [22.1, 53.35]], dp: [1, 2], u: 'p8 p28 p161 p162 p256 p87 p102 p129' },
  { k: 'g4', side: 'GER', nat: 'GER', lv: 2, up: 'agc', ech: 'XXXX', n: '4-я армия', num: '4', gen: 'kluge', gt: [['1942-01-21', 'heinrici'], ['1944-06-04', 'busse']],
    ax: [[22.0, 53.0], [23.55, 52.25]], dp: [1, 2], u: 'p7 p23 p258 p268 p137 p263 p292 p17 p78 p131 p134 p252' },
  { k: 'pz2', side: 'GER', nat: 'GER', lv: 2, up: 'agc', ech: 'XXXX', mech: 1, n: '2-я танковая группа', num: '2', sub: 'Тг', gen: 'guderian', rn: [['1941-10-05', '2-я танковая армия', null, '2', 'ТА']], gt: [['1941-12-26', 'schmidt_r']],
    ax: [[23.6, 52.2], [23.85, 51.6]], dp: [1, 3], u: 't3 t4 t10 t17 t18 m10 m29 ss:Райх gd:Великая_Германия k1 p31 p34 p45 p167 p255 p267' },
  { k: 'g2', side: 'GER', nat: 'GER', lv: 2, up: 'agc', ech: 'XXXX', n: '2-я армия', num: '2', gen: 'weichs', arr: 3,
    ax: [[21.2, 52.6], [22.0, 52.1]], u: 'p260 p112 p106 p110 p197 p52' },
  // ——— группа армий «Юг» ———
  { k: 'g6', side: 'GER', nat: 'GER', lv: 2, up: 'ags', ech: 'XXXX', n: '6-я армия', num: '6', gen: 'reichenau', gt: [['1942-01-05', 'paulus']], ax: [[23.95, 51.3], [24.05, 50.75]], dp: [1, 2], u: 'p44 p56 p62 p75 p111 p168 p297 p298 p299 o454' },
  { k: 'pz1', side: 'GER', nat: 'GER', lv: 2, up: 'ags', ech: 'XXXX', mech: 1, n: '1-я танковая группа', num: '1', sub: 'Тг', gen: 'kleist', rn: [['1941-10-25', '1-я танковая армия', null, '1', 'ТА']], gt: [['1942-11-22', 'mackensen'], ['1943-10-29', 'hube'], ['1944-04-21', 'raus']],
    ax: [[24.05, 50.75], [23.95, 50.35]], dp: [1, 3], u: 't9 t11 t13 t14 t16 m25 m16 ss:Лейбштандарт ss:Викинг' },
  { k: 'g17', side: 'GER', nat: 'GER', lv: 2, up: 'ags', ech: 'XXXX', n: '17-я армия', num: '17', gen: 'stulpnagel', gt: [['1941-10-05', 'hoth'], ['1942-06-01', 'ruoff']],
    ax: [[23.7, 50.3], [22.6, 49.4]], dp: [1, 2], u: 'p24 p71 p262 p295 p296 g1 g4 p68 p257 p97 p100 p101' },
  { k: 'g11', side: 'GER', nat: 'GER', lv: 2, up: 'ags', ech: 'XXXX', n: '11-я армия', num: '11', gen: 'schobert', gt: [['1941-09-17', 'manstein'], ['1942-11-21', 'wohler']],
    ax: [[27.0, 47.6], [27.9, 47.0]], dp: [1, 3], u: 'p22 p50 p72 p76 p170 p198 p239 p99 p113 p132 o213 o444' },
  { k: 'rom3', side: 'GER', nat: 'ROM', lv: 2, up: 'ags', ech: 'XXXX', n: '3-я румынская армия', num: '3', sub: 'Рум', gen: 'dumitrescu', ax: [[25.9, 48.0], [26.9, 47.75]], dp: [1, 2], u: 'gb1 gb2 gb4 kb5 kb6 kb8' },
  { k: 'rom4', side: 'GER', nat: 'ROM', lv: 2, up: 'ags', ech: 'XXXX', n: '4-я румынская армия', num: '4', sub: 'Рум', gen: 'ciuperca', gt: [['1941-09-09', 'constantinescu']], ax: [[27.95, 46.9], [28.2, 45.5]], dp: [1, 2], u: 'p5 p6 p7 p11 p13 p14 p15 p21' },
  { k: 'svk', side: 'GER', nat: 'SVK', lv: 3, up: 'ags', ech: 'XXX', n: 'Словацкий армейский корпус', num: 'Сл', gen: 'catlos', arr: 4, ax: [[22.2, 49.35], [22.6, 49.2]], u: 'p1 p2' },
  { k: 'hunm', side: 'GER', nat: 'HUN', lv: 3, up: 'ags', ech: 'XXX', n: 'Венгерский подвижный корпус', num: 'Пд', gen: 'miklos', arr: 5, ax: [[23.6, 48.55], [24.4, 48.2]], u: 'm1:60 k1' },
  { k: 'csir', side: 'GER', nat: 'ITA', lv: 3, up: 'ags', ech: 'XXX', n: 'Итальянский экспедиционный корпус', num: 'CSIR', gen: 'messe', arr: 26, ax: [[26.6, 48.2], [27.4, 47.9]], u: 'nm:Пасубио nm:Торино mn:Челере' },
  // ——— Северный фронт ———
  { k: 's14', side: 'SOV', nat: 'SOV', lv: 2, up: 'nf', ech: 'XXXX', n: '14-я армия', num: '14', gen: 'frolov', ax: [[31.6, 69.2], [31.6, 65.1]], dp: [1, 4], u: 's14 s52 s104 s122 td1:300' },
  { k: 's7', side: 'SOV', nat: 'SOV', lv: 2, up: 'nf', ech: 'XXXX', n: '7-я армия', num: '7', gen: 'gorelenko', gt: [['1941-09-24', 'meretskov']], ax: [[31.3, 63.2], [31.6, 61.75]], dp: [1, 3], u: 's54 s71 s168 s237' },
  { k: 's23', side: 'SOV', nat: 'SOV', lv: 2, up: 'nf', ech: 'XXXX', n: '23-я армия', num: '23', gen: 'pshennikov', ax: [[28.4, 60.75], [30.0, 61.35]], dp: [1, 3], u: 's43 s115 s123 s142 mk10:470 s70 s177 s191 mk1:1000 br8' },
  // ——— Северо-Западный фронт ———
  { k: 's8', side: 'SOV', nat: 'SOV', lv: 2, up: 'nwf', ech: 'XXXX', n: '8-я армия', num: '8', gen: 'sobennikov', ax: [[21.3, 56.3], [22.4, 55.3]], dp: [1, 4], u: 's10 s11 s48 s90 s125 mk12:750' },
  { k: 's11', side: 'SOV', nat: 'SOV', lv: 2, up: 'nwf', ech: 'XXXX', n: '11-я армия', num: '11', gen: 'morozov_v', ax: [[22.6, 55.0], [23.6, 54.1]], dp: [1, 4], u: 's5 s23 s33 s126 s128 s188 mk3:650' },
  { k: 's27', side: 'SOV', nat: 'SOV', lv: 2, up: 'nwf', ech: 'XXXX', n: '27-я армия', num: '27', gen: 'berzarin', ax: [[22.6, 58.3], [24.8, 56.6]], dp: [2, 8], u: 's16 s67 br3 s181 s182 s183 s179 s184 mk21:100' },
  // ——— Западный фронт ———
  { k: 's3', side: 'SOV', nat: 'SOV', lv: 2, up: 'wf', ech: 'XXXX', n: '3-я армия', num: '3', gen: 'kuznetsov_v', ax: [[23.6, 54.05], [23.75, 53.5]], dp: [1, 3], u: 's27 s56 s85 mk11:240' },
  { k: 's10', side: 'SOV', nat: 'SOV', lv: 2, up: 'wf', ech: 'XXXX', n: '10-я армия', num: '10', gen: 'golubev', ax: [[22.5, 53.4], [23.3, 52.6]], dp: [1, 3], u: 's2 s8 s13 s86 s113 mk6:1000 mk13:280 kd6 kd36' },
  { k: 's4', side: 'SOV', nat: 'SOV', lv: 2, up: 'wf', ech: 'XXXX', n: '4-я армия', num: '4', gen: 'korobkov', ax: [[23.4, 52.4], [24.0, 51.65]], dp: [1, 3], u: 's6 s42 s49 s75 mk14:520' },
  { k: 's13', side: 'SOV', nat: 'SOV', lv: 2, up: 'wf', ech: 'XXXX', n: '13-я армия', num: '13', gen: 'filatov', ax: [[25.2, 54.3], [27.8, 52.8]], dp: [4, 12], u: 's24 s50 s64 s108 mk17:60 s100 s161 s17 s37 s55 s121 s143 s155 mk20:90 vd4' },
  // ——— Юго-Западный фронт ———
  { k: 's5', side: 'SOV', nat: 'SOV', lv: 2, up: 'swf', ech: 'XXXX', n: '5-я армия', num: '5', gen: 'potapov', ax: [[24.0, 51.65], [24.2, 50.7]], dp: [1, 4], u: 's45 s62 s87 s124 s135 mk9:300 mk22:650 s193 s195 s200' },
  { k: 's6', side: 'SOV', nat: 'SOV', lv: 2, up: 'swf', ech: 'XXXX', n: '6-я армия', num: '6', gen: 'muzychenko', ax: [[24.1, 50.6], [23.5, 49.95]], dp: [1, 4], u: 's41 s97 s159 kd3 mk4:900 mk15:750 s140 s146' },
  { k: 's26', side: 'SOV', nat: 'SOV', lv: 2, up: 'swf', ech: 'XXXX', n: '26-я армия', num: '26', gen: 'kostenko', ax: [[23.3, 49.85], [22.8, 49.25]], dp: [1, 4], u: 's72 s99 s173 mk8:900 s228 s80 s145' },
  { k: 's12', side: 'SOV', nat: 'SOV', lv: 2, up: 'swf', ech: 'XXXX', n: '12-я армия', num: '12', gen: 'ponedelin', ax: [[23.6, 49.0], [25.9, 48.25]], dp: [1, 4], u: 's44 s58 s60 s96 s164 s192 mk16:600 s139 s141 s190 mk19:450 mk24:220 s160' },
  // ——— Южный фронт ———
  { k: 's9', side: 'SOV', nat: 'SOV', lv: 2, up: 'sof', ech: 'XXXX', n: '9-я армия', num: '9', gen: 'cherevichenko', gt: [['1941-09-01', 'malinovsky']], ax: [[26.9, 48.0], [28.2, 45.6]], dp: [1, 4], u: 's25 s51 s74 s95 s150 s176 gs30 mk2:500 mk18:280 kd5 kd9 s157' },
  { k: 's18', side: 'SOV', nat: 'SOV', lv: 2, up: 'sof', ech: 'XXXX', n: '18-я армия', num: '18', gen: 'smirnov_a', ax: [[26.0, 48.6], [27.5, 48.4]], dp: [2, 5], u: 's130 s169 s189 s116' },
  { k: 'sk9', side: 'SOV', nat: 'SOV', lv: 3, up: 'sof', ech: 'XXX', n: '9-й особый стрелковый корпус', num: '9', sub: 'ск', gen: 'batov', ax: [[33.5, 45.2], [35.4, 45.3]], dp: [2, 9], u: 's106 s156 kd32' },
  // ——— вторые эшелоны (резерв Ставки) ———
  { k: 's16', side: 'SOV', nat: 'SOV', lv: 2, up: 'wf', ech: 'XXXX', n: '16-я армия', num: '16', gen: 'lukin', gt: [['1941-08-08', 'rokossovsky']], arr: 6, ax: [[31.6, 54.9], [32.4, 54.6]], u: 's46 s152 mk5:1000 td57:100' },
  { k: 's19', side: 'SOV', nat: 'SOV', lv: 2, up: 'wf', ech: 'XXXX', n: '19-я армия', num: '19', gen: 'konev', gt: [['1941-09-12', 'lukin']], arr: 8, ax: [[30.0, 55.3], [31.2, 55.0]], u: 's127 s134 s162 s129 s158 s171 s38 mk26:180' },
  { k: 's20', side: 'SOV', nat: 'SOV', lv: 2, up: 'wf', ech: 'XXXX', n: '20-я армия', num: '20', gen: 'kurochkin', arr: 4, ax: [[30.0, 54.65], [30.9, 54.3]], u: 's110 s144 s172 s73 s229 s233 s18 mk7:950' },
  { k: 's21', side: 'SOV', nat: 'SOV', lv: 2, up: 'wf', ech: 'XXXX', n: '21-я армия', num: '21', gen: 'gerasimenko', arr: 3, ax: [[30.0, 53.0], [31.0, 52.3]], u: 's61 s154 s167 s232 s117 s187 mk25:300' },
  { k: 's22', side: 'SOV', nat: 'SOV', lv: 2, up: 'wf', ech: 'XXXX', n: '22-я армия', num: '22', gen: 'yershakov', arr: 3, ax: [[28.6, 55.6], [30.4, 56.2]], u: 's98 s112 s153 s170 s174 s186' },
  { k: 's24', side: 'SOV', nat: 'SOV', lv: 2, up: 'stavka', ech: 'XXXX', n: '24-я армия', num: '24', gen: 'rakutin', arr: 10, ax: [[33.0, 55.4], [34.4, 54.9]], u: 's91 s119 s166 s107 s133 s178 s19 s120' },
];
// вторые эшелоны внутри армий первой линии (прибывают в первые две недели): [армия, коды, день прибытия, точка]
export const ECH2 = [
  ['s5', 's196 s227', 5, [27.6, 50.6]],
  ['s26', 's147 s165', 7, [28.6, 49.7]],
  ['s12', 's175 s199', 9, [28.4, 49.1]],
];
// численность штатов: [люди, орудия, танки]
export const TPL = {
  GER: { inf: [16000, 160, 0], arm: [14000, 110, 170], mot: [14000, 130, 15], mtn: [14000, 100, 0], cav: [10000, 60, 0], sec: [8000, 40, 0] },
  FIN: { inf: [14000, 90, 0], cav: [6000, 30, 0], mtn: [12000, 70, 0] },
  ROM: { inf: [14000, 90, 0], mtn: [8000, 40, 0], cav: [7000, 30, 0], arm: [10000, 60, 100] },
  HUN: { inf: [12000, 70, 0], mot: [9000, 60, 60], cav: [8000, 40, 0] },
  SVK: { inf: [10000, 60, 0], mot: [6000, 40, 30] },
  ITA: { inf: [12000, 80, 0], mot: [9000, 60, 20], mtn: [15000, 80, 0] },
  SOV: { inf: [11000, 140, 10], arm: [24000, 220, 600], mot: [12000, 100, 150], cav: [8000, 40, 20], mtn: [9000, 100, 0], gar: [5000, 80, 0] },
};
// разбор кода дивизии → {t, num, n}
const ORD = (n, g) => `${n}-${g === 'f' ? 'я' : 'й'}`;
export function parseUnit(code, nat) {
  let m = /^([A-Z]{3}):(.+)$/.exec(code);
  if (m) return parseUnit(m[2], m[1]);
  let tanks = null;
  m = /^(.*):(\d+)$/.exec(code);
  if (m && !/^(ss|gd|nm|mn)$/.test(code.split(':')[0])) (code = m[1]), (tanks = +m[2]);
  const [p, rest] = code.includes(':') ? code.split(':') : [code.replace(/\d+$/, ''), code.replace(/^\D+/, '')];
  const num = rest, nm = (rest || '').replace(/_/g, ' ');
  const sov = nat === 'SOV';
  let t = 'inf', n = '';
  switch (p) {
    case 'p': n = sov ? `${ORD(num, 'f')} сд` : `${ORD(num, 'f')} пд`; break;
    case 's': n = `${ORD(num, 'f')} сд`; break;
    case 't': t = 'arm'; n = `${ORD(num, 'f')} тд`; break;
    case 'm': t = 'mot'; n = nat === 'HUN' ? 'Подвижный корпус' : `${ORD(num, 'f')} мд`; break;
    case 'g': t = 'mtn'; n = `${ORD(num, 'f')} гсд`; break;
    case 'gs': t = 'mtn'; n = `${ORD(num, 'f')} гсд`; break;
    case 'gb': t = 'mtn'; n = `${ORD(num, 'f')} горная бригада`; break;
    case 'kb': t = 'cav'; n = `${ORD(num, 'f')} кав. бригада`; break;
    case 'k': case 'kd': t = 'cav'; n = nat === 'FIN' ? 'Кавалерийская бригада' : nat === 'HUN' ? '1-я кав. бригада' : `${ORD(num, 'f')} кд`; break;
    case 'o': t = 'sec'; n = `${ORD(num, 'f')} охранная дивизия`; break;
    case 'mk': t = 'arm'; n = `${ORD(num, 'm')} мехкорпус`; break;
    case 'td': t = 'mot'; n = `${ORD(num, 'f')} тд`; break;
    case 'vd': t = 'inf'; n = `${ORD(num, 'm')} воздушно-десантный корпус`; break;
    case 'br': t = 'gar'; n = `${ORD(num, 'f')} отдельная стрелковая бригада`; break;
    case 'ss': t = 'mot'; n = `СС «${nm}»`; break;
    case 'gd': t = 'mot'; n = `«${nm}»`; break;
    case 'nm': t = 'inf'; n = `«${nm}»`; break;
    case 'mn': t = 'mot'; n = `«${nm}»`; break;
    default: n = code;
  }
  const w = nm.split(' '), short = /^(ss|gd|nm|mn)$/.test(p) ? (w.length > 1 ? w.map((x) => x[0]).join('').toUpperCase() : nm.slice(0, 3)) : num;
  return { t, num: short, n, tanks, nat, sov181: sov && /^s18[1-4]$|^s179$/.test(code) };
}
