// «Мировой фронт» v0.11 (отзыв 04.11, шаг 6.6): решения за ★ политическую власть — приказы, мобилизация, ленд-лиз,
// гвардия, партизаны, стройбригады, союзники, «Восточный вал» и др. Панель «Решения» — по кнопке ★ сверху (ui-dec.js).
// S.dec[side] = { t: {id: ход последнего раза}, n: {id: сколько раз}, seen: {id: 1} — объявлено, vw: {id: ход} — видел };
// временные эффекты — S.dfx = [{ side, id, until, k: {pp, men, ll, air, pock, evac}, z }] (decK — множитель).
// События истории, ставшие решениями (поле ev: Приказ № 227, тотальная война, фольксштурм, зимнее обмундирование),
// у игрока сами не случаются — он принимает их в панели; «Ставка решает сама» (S.auto.dec) — в даты истории (hist).
// ИИ: эти события — как раньше, а решения с полем ai — в даты истории, если хватает ★.
import { turnOf, yearF, NAT_N, divW } from './rules.js';
import * as E from './engine.js';
import { addBoost, evById, nearReich, fortLine } from './events.js';

const T = turnOf;
const MONF = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
export const isoTxt = (iso) => { const [y, m, d] = iso.split('-').map(Number); return `${d} ${MONF[m - 1]} ${y}`; };
export const decSt = (S, side) => ((S.dec ??= {})[side] ??= { t: {}, n: {}, seen: {}, vw: {} });
// множитель временных эффектов решений стороны (k: pp, men, ll, air, pock, evac)
export function decK(S, side, k) {
  let m = 1;
  for (const x of S.dfx || []) if (x.side === side && x.until > S.turn && x.k && x.k[k] !== undefined) m *= x.k[k];
  return m;
}
export const decOn = (S, side, id) => (S.dfx || []).some((x) => x.side === side && x.id === id && x.until > S.turn);
const tmp = (S, side, id, w, k = null, z) => { (S.dfx ||= []).push({ side, id, until: S.turn + w, k, ...(z !== undefined ? { z } : {}) }); };
// советская земля (1941 г.) под врагом
const occN = (S) => { let n = 0; for (let r = 0; r < S.M.R; r++) if (S.M.nats[S.own0[r]] === 'SOV' && E.sideOf(S, r) === 'GER') n++; return n; };
const llRoutes = (S) => ['Мурманск', 'Архангельск', 'Астрахань', 'Баку'].filter((n) => E.sideOf(S, E.regByName(S, n)) === 'SOV').length;
// союзники Оси, ещё воюющие (их войска — в резерв ОКХ)
const alliesIn = (S) => ['ROM', 'HUN', 'ITA'].filter((n) => !(n === 'ROM' && S.ev?.rom >= 0) && !(n === 'ITA' && S.ev?.italy >= 0));
const SIB = 'Сибирские дивизии';
const sibLeft = (S) => S.units.filter((u) => !u.dead && u.hist && u.grp === SIB && u.r < 0 && u.arr > S.turn + 2);
// новые дивизии — сразу в резерв Ставки / ОКХ (оттуда игрок отправляет их на фронт)
function toRes(S, side, nat, t, n, o = {}) {
  const us = [];
  for (let i = 0; i < n; i++) {
    const u = E.mkUnit(S, { s: side, nat, t, n: o.name ? o.name(S, t) : E.nameFor(S, side, nat, t), str: o.str ?? 95, rdy: o.rdy ?? 80, xp: o.xp ?? 15 });
    u.r = -1; u.z = 2; u.res = 1;
    us.push(u);
  }
  return us;
}
const resTxt = (side) => (side === 'SOV' ? 'в резерв Ставки' : 'в резерв ОКХ');
// гвардия: лучшие по опыту дивизии
const GDN = { inf: 'я гв. сд', mtn: 'я гв. гсд', cav: 'я гв. кд', mot: 'й гв. мк', arm: 'й гв. тк', abn: 'я гв. вдд' };
const guardCand = (S) => S.units.filter((u) => E.alive(u) && u.s === 'SOV' && !u.gd && GDN[u.t] && u.xp >= 12).sort((a, b) => b.xp - a.xp || b.str - a.str);
const ssT = (S) => (yearF(S.turn) >= 1942.9 ? 'arm' : 'mot');
const ssMen = (S) => 2 * E.newCost('GER', ssT(S)).men;
const menNow = (S, side) => (S.inc?.[side]?.men ?? E.income(S, side).men);
const mobN = (S) => Math.round(menNow(S, 'SOV') * 5);
const offFx = (side) => (S, s, z) => { addBoost(S, side, z, 1.15, 4, 'att'); E.addMor(S, side, 1); tmp(S, side, side === 'SOV' ? 'offS' : 'offG', 4, null, z); return S.fr[side][z].n; };
// мирное время (шаг 6.7): манёвры — опыт наименее опытным дивизиям фронта; «Линия Молотова» — у новой границы
const DRILL = { n: 12, xp: 8, max: 35 };
const drillCand = (S, side, z = -1) => S.units.filter((u) => E.alive(u) && u.s === side && u.xp < DRILL.max && (z < 0 || E.fzOf(S, u.r) === z)).sort((a, b) => a.xp - b.xp || a.id - b.id);
const drillFx = (S, side, z) => {
  const us = drillCand(S, side, z).slice(0, DRILL.n);
  for (const u of us) u.xp = Math.min(DRILL.max, u.xp + DRILL.xp);
  return `${S.fr[side][z].n}: ${us.length} ${divW(us.length)}`;
};
const drillDec = (side) => ({ id: side === 'SOV' ? 'drillS' : 'drillG', side, ic: 'binoc', n: 'Манёвры', cost: 20, cd: 13, to: '1941-06-21', peace: 1, pw: 1, pick: 'front',
  d: `Большие учения войск выбранного фронта: опыт +${DRILL.xp} у ${DRILL.n} наименее опытных дивизий (не выше ${DRILL.max}).`,
  cond: (S) => (drillCand(S, side).length ? true : 'все дивизии уже обучены'), fx: drillFx });
const molotR = (S) => {
  const L = [];
  for (let r = 0; r < S.M.R; r++) if (E.sideOf(S, r) === 'SOV' && S.fort[r] < 3 && S.M.reg[r].nb.some((e) => E.sideOf(S, e.r) === 'GER')) L.push(r);
  return L.sort((a, b) => S.fort[a] - S.fort[b] || S.M.reg[b].vp - S.M.reg[a].vp || a - b).slice(0, 8);
};

// id, сторона, значок, название, текст (строка или функция), цена ★, с даты (from) / до (to), условие (true или причина),
// cd — недель до повтора (нет — один раз), pick: 'front' — выбор фронта, fx — действие (может вернуть подпись),
// ev — заменённое событие истории (у ИИ остаётся событием; у игрока с «Ставка решает сама» — решение в дату hist),
// ai — ИИ принимает в дату hist (rep — и потом повторяет, оставляя ★15). У ИИ — только гвардия, партизаны и «Стоять
// насмерть»: стройбригады и «Восточный вал» у ИИ затягивали войну (сим: Берлин позже на 4–6 недель, иногда — не взят)
export const DEC = [
  // ——— СССР ———
  { id: 'o270', side: 'SOV', ic: 'stamp', n: 'Приказ № 270', cost: 30, from: '1941-08-16', hist: '1941-08-16',
    d: 'Сдача в плен приравнена к измене: окружённые дивизии сдаются вдвое реже полгода. Боевой дух −2.',
    fx: (S) => { tmp(S, 'SOV', 'o270', 26, { pock: 0.5 }); E.addMor(S, 'SOV', -2); } },
  { id: 'o227', side: 'SOV', ic: 'star', n: 'Приказ № 227', cost: 40, from: '1942-06-01', ev: 'o227', hist: '1942-07-28',
    d: '«Ни шагу назад!» Оборона на всех фронтах +8 % на 8 недель, боевой дух +6.',
    fx: (S) => { evById('o227').fx(S); tmp(S, 'SOV', 'o227', 8); } },
  { id: 'lls', side: 'SOV', ic: 'ship', n: 'Запрос ленд-лиза', cost: 25, cd: 16, hist: '1941-11-01', rep: 1,
    d: 'Просим союзников ускорить поставки: ленд-лиз ×1,5 и авиация +5 % на 12 недель.',
    cond: (S) => (!(S.ev?.ll >= 0) ? 'после соглашения о ленд-лизе (октябрь 1941)' : !llRoutes(S) ? 'нет портов и путей для поставок' : true),
    fx: (S) => { tmp(S, 'SOV', 'lls', 12, { ll: 1.5, air: 1.05 }); } },
  { id: 'mob', side: 'SOV', ic: 'mob', n: 'Мобилизация', cost: 20, cd: 26, peace: 1,
    d: (S) => `Призыв новых возрастов: сразу +${mobN(S)} людей. Боевой дух −1.`,
    fx: (S) => { const n = mobN(S); S.men.SOV += n; E.addMor(S, 'SOV', -1); return `+${n} людей`; } },
  { id: 'guard', side: 'SOV', ic: 'guard', n: 'Гвардейские звания', cost: 20, cd: 12, from: '1941-09-18', hist: '1941-09-18', rep: 1, ai: 1,
    d: '6 самых опытных дивизий становятся гвардейскими: сила +12 %, опыт +10.',
    cond: (S) => (guardCand(S).length ? true : 'нет опытных дивизий (нужен опыт боёв)'),
    fx: (S) => {
      const us = guardCand(S).slice(0, 6);
      for (const u of us) {
        const k = `SOV:gd:${u.t}`;
        S.num[k] = (S.num[k] || 0) + 1;
        u.gd = 1; u.xp = Math.min(100, u.xp + 10); u.n = `${S.num[k]}-${GDN[u.t]}`;
      }
      E.addMor(S, 'SOV', 1);
      return `${us.length} ${divW(us.length)}`;
    } },
  { id: 'sib', side: 'SOV', ic: 'snowing', n: 'Сибирские дивизии', cost: 30, from: '1941-09-14',
    d: 'Япония не нападёт — дивизии с Дальнего Востока едут к Москве: прибудут через 2 недели, и ещё 2 сверх истории.',
    cond: (S) => (sibLeft(S).length ? true : 'сибирские дивизии уже прибыли'),
    fx: (S) => {
      const us = sibLeft(S);
      for (const u of us) u.arr = S.turn + 2;
      const r = E.cityR(S, 'Москва');
      for (let i = 0; i < 2; i++) {
        const u = E.mkUnit(S, { s: 'SOV', nat: 'SOV', t: 'inf', n: E.nameFor(S, 'SOV', 'SOV', 'inf'), str: 100, rdy: 80, xp: 30 });
        u.r = -1; u.arr = S.turn + 2; u.at = r; u.z = r >= 0 ? S.M.reg[r].z : 2; u.grp = SIB; u.hist = 1;
      }
      return `${us.length + 2} ${divW(us.length + 2)}`;
    } },
  { id: 'part', side: 'SOV', ic: 'tnt', n: 'Партизанское движение', cost: 25, cd: 16, from: '1942-05-30', hist: '1942-05-30', rep: 1, ai: 1,
    d: 'Удары в тылу врага на нашей земле: его снабжение −10 %, войска приходят в себя почти вдвое медленнее, ж/д чинятся медленнее. 12 недель.',
    cond: (S) => (occN(S) >= 12 ? true : 'нужно: враг на нашей земле (12 областей и больше)'),
    fx: (S) => { tmp(S, 'SOV', 'part', 12); } },
  { id: 'allf', side: 'SOV', ic: 'facarm', n: 'Всё для фронта!', cost: 35, cd: 26, from: '1941-06-29',
    d: 'Тыл работает на победу: военное производство +12 % на 12 недель.',
    fx: (S) => { tmp(S, 'SOV', 'allf', 12, { pp: 1.12 }); } },
  { id: 'evq', side: 'SOV', ic: 'train', n: 'Ускоренная эвакуация', cost: 20, from: '1941-06-29', to: '1942-12-31',
    d: 'Заводы в пути заработают через 3 недели, новые эвакуации — 5 недель вместо 8 (полгода).',
    fx: (S) => { for (const e of S.evac || []) e.left = Math.min(e.left, 3); tmp(S, 'SOV', 'evq', 26, { evac: 5 / 8 }); } },
  { id: 'offS', side: 'SOV', ic: 'arrows', n: 'Наступательная операция', cost: 30, cd: 8, pick: 'front',
    d: 'Ставка даёт фронту резервы и снаряды: атака выбранного фронта +15 % на 4 недели.', fx: offFx('SOV') },
  { id: 'sap', side: 'SOV', ic: 'spade', n: 'Сапёрные армии', cost: 40, from: '1941-10-01', hist: '1941-10-15',
    d: 'Новые сапёрные армии строят рубежи: +2 строительные бригады навсегда.',
    fx: (S) => { S.flags.SOVbrig = (S.flags.SOVbrig || 0) + 2; } },
  // мирное время (ранние старты): только до 22 июня 1941 г.
  { id: 'ready', side: 'SOV', ic: 'siren', n: 'Боевая готовность', cost: 30, from: '1941-05-15', to: '1941-06-21', peace: 1, pw: 1,
    d: 'Директива приграничным округам: войска — на рубежах и в боевой готовности. Внезапного удара не будет: в первую неделю войны управление не нарушено, дивизии у границы готовы к бою.',
    fx: (S) => { S.flags.SOVready = 1; } },
  { id: 'molot', side: 'SOV', ic: 'wall', n: 'Линия Молотова', cost: 35, from: '1940-07-01', to: '1941-06-21', peace: 1, pw: 1,
    d: 'Укрепрайоны на новой западной границе: укрепления +1 в 8 приграничных областях.',
    cond: (S) => (molotR(S).length ? true : 'нет общей границы с Германией'),
    fx: (S) => { const L = molotR(S); for (const r of L) S.fort[r]++; return `${L.length} обл.`; } },
  drillDec('SOV'),
  // ——— Ось ———
  { id: 'halt', side: 'GER', ic: 'fist', n: 'Стоять насмерть', cost: 30, cd: 26, from: '1941-12-01', hist: '1941-12-16', ai: 1,
    d: 'Приказ не отступать: оборона на всех фронтах +10 % на 6 недель, боевой дух +2.',
    fx: (S) => { addBoost(S, 'GER', -1, 1.1, 6, 'def'); E.addMor(S, 'GER', 2); tmp(S, 'GER', 'halt', 6); } },
  { id: 'wgear', side: 'GER', ic: 'snow', n: 'Зимнее обмундирование', cost: 30, from: '1941-11-01', to: '1942-02-28', ev: 'wgear', hist: '1942-01-15',
    d: 'Сбор тёплых вещей по всей Германии: мороз страшен войскам меньше.',
    fx: (S) => { evById('wgear').fx(S); } },
  { id: 'total', side: 'GER', ic: 'hammer', n: 'Тотальная война', cost: 50, from: '1942-11-01', ev: 'total', hist: '1943-02-18',
    d: 'Хозяйство — на военные рельсы: люди +20 % и производство +10 % навсегда, боевой дух +4.',
    fx: (S) => { evById('total').fx(S); } },
  { id: 'volk', side: 'GER', ic: 'helmet', n: 'Фольксштурм', cost: 25, from: '1944-03-01', ev: 'volk', hist: '1944-03-01',
    d: 'Старики и подростки — в строй: 7 слабых дивизий у Берлина, Кёнигсберга и Бреслау.',
    cond: (S) => (S.turn >= T('1944-10-18') || nearReich(S, 3) ? true : 'когда враг подойдёт к границам Рейха'),
    fx: (S) => { evById('volk').fx(S); } },
  { id: 'ally', side: 'GER', ic: 'ally', n: 'Армии союзников', cost: 35, cd: 26, from: '1941-07-15',
    d: (S) => { const a = alliesIn(S), nat = a.length ? a[(decSt(S, 'GER').n.ally || 0) % a.length] : null; return `Требуем войск у союзников: 3 дивизии${nat ? ` (${NAT_N[nat]})` : ''} — ${resTxt('GER')}.`; },
    cond: (S) => (alliesIn(S).length ? true : 'союзники вышли из войны'),
    fx: (S) => { const a = alliesIn(S), nat = a[((decSt(S, 'GER').n.ally || 1) - 1) % a.length]; toRes(S, 'GER', nat, 'inf', 3, { str: 90, rdy: 70, xp: 10 }); return NAT_N[nat]; } },
  { id: 'west', side: 'GER', ic: 'train', n: 'Дивизии с Запада', cost: 35, cd: 20, from: '1941-08-01',
    d: `С оккупированного Запада снимают 4 пехотные дивизии — ${resTxt('GER')}.`,
    cond: (S) => (S.turn < T('1944-06-06') ? true : 'после высадки союзников во Франции — нельзя'),
    fx: (S) => { toRes(S, 'GER', 'GER', 'inf', 4, { str: 95, rdy: 80, xp: 20 }); } },
  { id: 'todt', side: 'GER', ic: 'crane', n: 'Организация Тодт', cost: 40, from: '1938-05-28', hist: '1942-03-01', peace: 1,
    d: 'Строители Рейха — на Восток: +2 строительные бригады навсегда.',
    fx: (S) => { S.flags.GERbrig = (S.flags.GERbrig || 0) + 2; } },
  { id: 'ostwall', side: 'GER', ic: 'wall', n: 'Восточный вал', cost: 40, from: '1943-08-11', hist: '1943-08-11',
    d: 'Рубеж по Днепру и Нарве: укрепления +1 на 3 участках каждого фронта, где натиск сильнее.',
    fx: (S) => { for (let z = 0; z < E.ZN; z++) fortLine(S, 'GER', z, 3); } },
  { id: 'ss', side: 'GER', ic: 'elite', n: 'Войска СС', cost: 40, cd: 26, from: '1942-01-01',
    d: (S) => `2 опытные ${ssT(S) === 'arm' ? 'танковые' : 'моторизованные'} дивизии — ${resTxt('GER')}. Нужно людей: ${Math.round(ssMen(S))}.`,
    cond: (S) => (S.men.GER >= ssMen(S) ? true : `не хватает людей: нужно ${Math.round(ssMen(S))}`),
    fx: (S) => {
      const t = ssT(S);
      S.men.GER -= ssMen(S);
      toRes(S, 'GER', 'GER', t, 2, { str: 100, rdy: 85, xp: 40, name: (S2, ty) => { const k = `GER:ss:${ty}`; S2.num[k] = (S2.num[k] || 0) + 1; return `${S2.num[k]}-я ${ty === 'arm' ? 'тд' : 'мд'} СС`; } });
    } },
  { id: 'offG', side: 'GER', ic: 'arrows', n: 'Главный удар', cost: 30, cd: 8, pick: 'front',
    d: 'Шверпункт: резервы и авиация — одному фронту. Атака выбранного фронта +15 % на 4 недели.', fx: offFx('GER') },
  { id: 'four', side: 'GER', ic: 'prog', n: 'Четырёхлетний план', cost: 30, from: '1936-09-09', to: '1939-09-01', peace: 1, pw: 1,
    d: 'Геринг перестраивает хозяйство под перевооружение: военное производство +15 % на 2 года.',
    fx: (S) => { tmp(S, 'GER', 'four', 104, { pp: 1.15 }); } },
  drillDec('GER'),
];
export const DECM = new Map(DEC.map((D) => [D.id, D]));
// решения мирного времени (pw) — только до войны (после — если приняты)
export const decOf = (side, S) => DEC.filter((D) => D.side === side && (!D.pw || !S || S.peace || decSt(S, side).t[D.id] !== undefined));
export const decText = (S, D) => (typeof D.d === 'function' ? D.d(S) : D.d);
export const taken = (S, side, D) => decSt(S, side).t[D.id] !== undefined || (!!D.ev && S.ev?.[D.ev] >= 0);
// состояние решения: k = ok | pol (не хватает ★) | lock (рано / условие) | cd (перерыв) | done (принято) | gone (время вышло)
export function decStat(S, side, D) {
  const st = decSt(S, side), last = st.t[D.id];
  if (!D.cd && taken(S, side, D)) return { k: 'done', at: last ?? S.ev?.[D.ev] };
  if (D.to && S.turn > T(D.to)) return { k: 'gone', why: 'время прошло' };
  if (D.from && S.turn < T(D.from)) return { k: 'lock', why: `с ${isoTxt(D.from)}` };
  if (S.peace && !D.peace) return { k: 'lock', why: 'с началом войны' };
  if (D.cd && last !== undefined && S.turn < last + D.cd) return { k: 'cd', left: last + D.cd - S.turn };
  const c = D.cond ? D.cond(S, side) : true;
  if (c !== true) return { k: 'lock', why: c || 'пока недоступно' };
  if ((S.pol?.[side] || 0) + 1e-6 < D.cost) return { k: 'pol', why: `нужно ★${D.cost}` };
  return { k: 'ok' };
}
// принять решение (arg — фронт для pick: 'front'); auto — «по истории» (ИИ или «Ставка решает сама»)
export function takeDec(S, side, id, arg = -1, auto = false) {
  const D = DECM.get(id);
  if (!D || D.side !== side || decStat(S, side, D).k !== 'ok') return null;
  if (D.pick === 'front' && !(arg >= 0 && arg < E.ZN)) return null;
  const st = decSt(S, side);
  S.pol[side] -= D.cost;
  st.t[id] = S.turn; st.n[id] = (st.n[id] || 0) + 1; st.seen[id] = 1;
  const sub = D.fx(S, side, arg) || '';
  if (D.ev) {
    (S.ev ||= {})[D.ev] = S.turn;
    if (auto && side === S.side) (S.evq ||= []).push({ id: D.ev, t: S.turn, ask: 0 }); // карточка — как у события
  }
  E.note(S, { ic: D.ic, side, txt: `${side === S.side ? 'Решение' : side === 'SOV' ? 'СССР' : 'Ось'}: ${D.n}${sub ? ` (${sub})` : ''}`, dec: id });
  return { sub };
}
// новые доступные решения игрока (точка на ★): можно принять, а игрок не видел их с тех пор, как они стали доступны
export function decNew(S, side) {
  const st = decSt(S, side);
  return decOf(side, S).filter((D) => {
    if (decStat(S, side, D).k !== 'ok') return false;
    const v = st.vw[D.id], since = st.t[D.id] !== undefined ? st.t[D.id] + (D.cd || 0) : -1;
    return v === undefined || v < since;
  });
}
export function decViewed(S, side) { const st = decSt(S, side); for (const D of decOf(side, S)) if (decStat(S, side, D).k === 'ok') st.vw[D.id] = S.turn; }
// новая игра / старое сохранение: доступное с начала — не объявлять
export function ensureDec(S) {
  if (S.dec) return;
  for (const side of ['GER', 'SOV']) { const st = decSt(S, side); for (const D of decOf(side, S)) if (decStat(S, side, D).k !== 'lock') st.seen[D.id] = 1; }
  S.auto ??= {};
  S.auto.dec ??= true;
}
// неделя (endWeek, после событий): эффекты, решения ИИ и «Ставки» игрока, объявления о новых решениях
// (партизаны действуют в engine.js: снабжение, готовность, ремонт ж/д)
export function decWeek(S) {
  if (S.dfx) S.dfx = S.dfx.filter((x) => x.until > S.turn);
  for (const side of ['GER', 'SOV']) {
    const pl = side === S.side && !S.noAsk;
    // ИИ — решения с полем ai; игрок с «Ставка решает сама» — бывшие события истории (ev); оба — в дату hist
    if (!pl || S.auto?.dec) for (const D of decOf(side, S)) {
      if (!D.hist || S.turn < T(D.hist) || (pl ? !D.ev : !D.ai)) continue;
      const was = taken(S, side, D);
      if (was && !D.rep) continue;
      if ((S.pol[side] || 0) < D.cost + (was ? 15 : 0) || decStat(S, side, D).k !== 'ok') continue;
      takeDec(S, side, D.id, -1, true);
    }
    if (pl) {
      const st = decSt(S, side);
      for (const D of decOf(side, S)) if (!st.seen[D.id] && decStat(S, side, D).k !== 'lock') { st.seen[D.id] = 1; E.note(S, { ic: 'dec', side, txt: `Новое решение: ${D.n}`, dec: D.id }); }
    }
  }
}
