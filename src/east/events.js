// «Восточный фронт 1941–1945» (v0.10): события войны — короткие карточки (картинка, заголовок, 1–2 строки),
// у некоторых — выбор из двух вариантов. Событие случается один раз: S.ev[id] = ход (−1 — не случилось).
// S.evq — очередь карточек для интерфейса, S.boost — временные усиления сторон на направлениях (см. boostK в engine.js).
// Режим «Исторический» — все события по датам; «Свободный» — только не зависящие от планов сторон (и по условиям).
import { turnOf } from './rules.js';
import { sideOf, cityR, addMor, note, alive, mkUnit, rearSpot, room, reindex } from './engine.js';

const T = turnOf;
const own = (S, n) => sideOf(S, cityR(S, n));
const natIdx = (S, n) => S.M.nats.indexOf(n);
// враг стороны side в пределах d шагов от области r
function near(S, r, side, d = 1) {
  if (r < 0) return false;
  const seen = new Set([r]);
  let ring = [r];
  for (let k = 0; k <= d; k++) {
    for (const x of ring) if (S.at[x].some((u) => u.s !== side)) return true;
    if (k === d) break;
    const nx = [];
    for (const x of ring) for (const e of S.M.reg[x].nb) if (!seen.has(e.r)) { seen.add(e.r); nx.push(e.r); }
    ring = nx;
  }
  return false;
}
export function addBoost(S, side, zs, k, weeks, kind = 'att') {
  S.boost ||= [];
  for (const z of [].concat(zs)) S.boost.push({ side, z, k, until: S.turn + weeks, kind });
}
// новые дивизии у города (ополчение, фольксштурм)
function spawn(S, side, city, k, o) {
  const at = cityR(S, city);
  if (at < 0 || sideOf(S, at) !== side) return 0;
  let n = 0;
  for (let i = 0; i < k; i++) {
    let r = room(S, at, side) > 0 ? at : -1;
    if (r < 0) for (const e of S.M.reg[at].nb) if (sideOf(S, e.r) === side && room(S, e.r, side) > 0) { r = e.r; break; }
    if (r < 0) r = rearSpot(S, side, S.M.reg[at].z, at);
    if (r < 0) break;
    S.num[o.key] = (S.num[o.key] || 0) + 1;
    const u = mkUnit(S, { s: side, nat: side, t: 'inf', n: o.name(S.num[o.key]), str: o.str, rdy: o.rdy, xp: 0 });
    u.r = r; S.at[r].push(u); n++;
  }
  return n;
}
function fortUp(S, city, lv = 1) { const r = cityR(S, city); if (r >= 0) S.fort[r] = Math.min(3, S.fort[r] + lv); }
// союзник выходит из войны: его дивизии уходят, будущие подкрепления отменяются
function dropNat(S, nat) {
  let n = 0;
  for (const u of S.units) {
    if (u.dead || u.nat !== nat) continue;
    if (u.r >= 0) { const a = S.at[u.r]; a.splice(a.indexOf(u), 1); n++; }
    u.dead = 1; u.r = -1; delete u.arr;
  }
  return n;
}
// дивизии стороны side, оказавшиеся на чужой (нейтральной) земле, — в ближайшую свою область
function evict(S, side) {
  for (const u of S.units) {
    if (!alive(u) || u.s !== side || sideOf(S, u.r) === side) continue;
    const a = S.at[u.r];
    a.splice(a.indexOf(u), 1);
    let r = -1;
    for (const e of S.M.reg[u.r].nb) if (sideOf(S, e.r) === side && room(S, e.r, side) > 0) { r = e.r; break; }
    if (r < 0) r = rearSpot(S, side, S.M.reg[u.r].z, u.r);
    if (r < 0) { u.dead = 1; u.r = -1; continue; }
    u.r = r; S.at[r].push(u); u.mp = 0;
  }
}
// земли выбывшего союзника: где стоят немцы — Германии, остальное — СССР (или нейтральны)
function handOver(S, nats, to) {
  const G = natIdx(S, 'GER'), SV = natIdx(S, 'SOV');
  for (let r = 0; r < S.M.R; r++) {
    if (!nats.includes(S.M.nats[S.own[r]])) continue;
    if (S.at[r].some((u) => alive(u) && u.s === 'GER' && !nats.includes(u.nat))) S.own[r] = G;
    else if (to === 'SOV') { S.own[r] = SV; S.capT[r] = S.turn; }
  }
}
const zOf = (S, city) => { const r = cityR(S, city); return r >= 0 ? S.M.reg[r].z : 2; };
const gerN = (S) => S.units.filter((u) => alive(u) && u.s === 'GER').length;

// id, сторона (кому событие на пользу), иконка, дата (или {hist, free}), режим, условие, до какой даты ждать,
// заголовок, текст (строка или функция), действие или варианты выбора (первый — исторический, его берёт ИИ)
export const EVENTS = [
  { id: 'start', side: 'GER', ic: 'flag', at: '1941-06-22', t: '22 июня 1941 года',
    d: (S) => (S.side === 'SOV' ? 'Германия напала на СССР. Удержите фронт, сберегите армии — и дойдите до Берлина.' : 'Началась операция «Барбаросса». Разбейте Красную армию и возьмите Москву.') },
  { id: 'evac', side: 'SOV', ic: 'factory', at: '1941-06-29', t: 'Эвакуация', d: 'Заводы из прифронтовых областей уезжают на Урал и заработают там через 2 месяца.', fx: (S) => { S.flags.evacAuto = 1; } },
  { id: 'opolch', side: 'SOV', ic: 'rifle', at: '1941-07-06', t: 'Народное ополчение', d: 'Москва и Ленинград собрали дивизии ополчения.',
    fx: (S) => {
      const o = { key: 'SOV:dno', str: 60, rdy: 45, name: (n) => `${n}-я дно` };
      spawn(S, 'SOV', 'Москва', 4, o); spawn(S, 'SOV', 'Ленинград', 4, o);
    } },
  { id: 'kiev', side: 'GER', ic: 'compass', at: '1941-08-21', until: '1941-09-21', cond: (S) => own(S, 'Киев') === 'SOV' && own(S, 'Москва') === 'SOV', t: 'Киев или Москва?',
    d: 'Танки группы «Центр» можно повернуть на юг — окружить Киев — или бросить на Москву.',
    opts: [
      { t: 'На Киев', ic: 'encircle', d: 'Южное: +15 % к атаке на 5 недель', fx: (S) => addBoost(S, 'GER', 3, 1.15, 5) },
      { t: 'На Москву', ic: 'target', d: 'Центральное: +12 % к атаке на 5 недель', fx: (S) => addBoost(S, 'GER', 2, 1.12, 5) },
    ] },
  { id: 'll', side: 'SOV', ic: 'ship', at: '1941-10-01', t: 'Ленд-лиз', d: 'Союзники шлют танки, самолёты и грузовики — через Мурманск, Архангельск и Иран.' },
  { id: 'typhoon', side: 'GER', ic: 'atk', at: '1941-10-02', mode: 'hist', until: '1941-11-15', cond: (S) => own(S, 'Москва') === 'SOV', t: 'Операция «Тайфун»', d: 'Решающее наступление на Москву: +12 % к атаке на Центральном направлении на 4 недели.',
    fx: (S) => addBoost(S, 'GER', 2, 1.12, 4) },
  { id: 'mos', side: 'SOV', ic: 'fort', at: '1941-07-01', until: '1942-12-31', cond: (S) => own(S, 'Москва') === 'SOV' && near(S, cityR(S, 'Москва'), 'SOV', 2), t: 'Москва на осадном положении',
    d: 'Город превращён в крепость: укрепления +1, оборона направления +10 % на 6 недель.', fx: (S) => { fortUp(S, 'Москва'); addMor(S, 'SOV', 6); addBoost(S, 'SOV', zOf(S, 'Москва'), 1.1, 6, 'def'); } },
  { id: 'len', side: 'SOV', ic: 'fort', at: '1941-07-01', until: '1943-12-31', cond: (S) => own(S, 'Ленинград') === 'SOV' && near(S, cityR(S, 'Ленинград'), 'SOV', 1), t: 'Ленинград в осаде',
    d: 'Город готовится к долгой обороне: укрепления +1.', fx: (S) => { fortUp(S, 'Ленинград'); addMor(S, 'SOV', 3); } },
  { id: 'winter', side: 'SOV', ic: 'frost', at: '1941-11-23', t: 'Генерал Мороз', d: 'Немецкая армия не готова к зиме: её атаки и оборона слабеют до весны.' },
  { id: 'counter41', side: 'SOV', ic: 'atk', at: '1941-12-05', mode: 'hist', until: '1942-01-15', cond: (S) => own(S, 'Москва') === 'SOV', t: 'Контрнаступление под Москвой',
    d: 'Сибирские дивизии переходят в наступление: +20 % к атаке на Центральном направлении.', fx: (S) => { addBoost(S, 'SOV', 2, 1.2, 5); addMor(S, 'SOV', 5); } },
  { id: 'wgear', side: 'GER', ic: 'snow', at: '1942-01-15', t: 'Зимнее обмундирование', d: 'Войска получили тёплую одежду: мороз страшен им меньше.', fx: (S) => { S.flags.winterGear = 1; } },
  { id: 'khar42', side: 'SOV', ic: 'compass', at: '1942-05-12', until: '1942-06-10', cond: (S) => own(S, 'Харьков') === 'GER', t: 'Харьков: ударить первыми?',
    d: 'Ставка предлагает наступать на юге, пока враг не готов.',
    opts: [
      { t: 'Наступать', ic: 'atk', d: 'Южное: +15 % к атаке на 3 недели', fx: (S) => addBoost(S, 'SOV', 3, 1.15, 3) },
      { t: 'Укрепиться', ic: 'fort', d: 'укрепления +1 на 6 участках фронта Южного направления', fx: (S) => fortLine(S, 'SOV', 3, 6) },
    ] },
  { id: 'blau', side: 'GER', ic: 'oil', at: '1942-06-28', mode: 'hist', t: 'План «Блау»', d: 'Наступление на Сталинград и нефть Кавказа: +12 % к атаке на юге на 6 недель.', fx: (S) => addBoost(S, 'GER', [3, 4], 1.12, 6) },
  { id: 'o227', side: 'SOV', ic: 'star', at: '1942-07-28', t: 'Приказ № 227', d: '«Ни шагу назад!» Оборона Красной армии +8 % на 8 недель.', fx: (S) => { addMor(S, 'SOV', 6); addBoost(S, 'SOV', -1, 1.08, 8, 'def'); } },
  { id: 'stal', side: 'SOV', ic: 'fort', at: '1942-06-01', until: '1943-06-01', cond: (S) => own(S, 'Сталинград') === 'SOV' && near(S, cityR(S, 'Сталинград'), 'SOV', 1), t: 'Сталинград',
    d: 'Бои идут за каждый дом: укрепления города +1.', fx: (S) => { fortUp(S, 'Сталинград'); addMor(S, 'SOV', 3); } },
  { id: 'uranus', side: 'SOV', ic: 'encircle', at: '1942-11-19', mode: 'hist', t: 'Операция «Уран»', d: 'Удар по флангам врага на юге: +25 % к атаке на 4 недели.', fx: (S) => addBoost(S, 'SOV', 3, 1.25, 4) },
  { id: 'total', side: 'GER', ic: 'hammer', at: '1943-02-18', t: 'Тотальная война', d: 'Германия переводит хозяйство на военные рельсы: больше людей и производства.',
    fx: (S) => { S.flags.GERmen = 1.2; S.flags.GERpp = 1.1; addMor(S, 'GER', 4); } },
  { id: 'citadel', side: 'GER', ic: 'tank', at: '1943-07-05', mode: 'hist', until: '1943-08-01', cond: (S) => own(S, 'Курск') === 'SOV' && gerN(S) >= 120, t: 'Курская дуга',
    d: 'Удар «Цитадели» по глубокой обороне: у Курска укрепления +1, атака Оси +12 % на 2 недели.', fx: (S) => { addBoost(S, 'GER', [2, 3], 1.12, 2); fortNear(S, 'SOV', 'Курск', 2); } },
  { id: 'kutuzov', side: 'SOV', ic: 'atk', at: '1943-07-19', mode: 'hist', t: 'Летнее наступление', d: 'Красная армия наступает от Орла до Азовского моря: +12 % к атаке на 4 недели.', fx: (S) => addBoost(S, 'SOV', [2, 3], 1.12, 4) },
  { id: 'italy', side: 'SOV', ic: 'flag', at: '1943-09-08', cond: (S) => S.mode === 'hist' || own(S, 'Сталинград') === 'SOV', t: 'Италия вышла из войны', d: 'Итальянские дивизии покидают Восточный фронт.',
    fx: (S) => { dropNat(S, 'ITA'); addMor(S, 'GER', -3); } },
  { id: 'bagr', side: 'SOV', ic: 'bolt', at: '1944-06-22', mode: 'hist', t: 'Операция «Багратион»', d: 'Удар в Белоруссии, партизаны взрывают рельсы: +25 % к атаке на Центральном направлении.',
    fx: (S) => { addBoost(S, 'SOV', 2, 1.25, 4); for (const u of S.units) if (alive(u) && u.s === 'GER' && S.M.reg[u.r].z === 2) u.rdy = Math.max(20, u.rdy - 20); } },
  { id: 'rom', side: 'SOV', ic: 'flag', at: { hist: '1944-08-23', free: '1944-04-01' }, cond: (S) => (nearNat(S, ['ROM'], 2) || !S.own.includes(natIdx(S, 'ROM'))) && (S.mode === 'hist' || own(S, 'Кишинёв') === 'SOV'),
    t: 'Румыния перешла на сторону союзников', d: 'Румынские и болгарские войска уходят с фронта, их земли — под контролем Красной армии.',
    fx: (S) => { dropNat(S, 'ROM'); dropNat(S, 'BUL'); handOver(S, ['ROM', 'BUL'], 'SOV'); reindex(S); addMor(S, 'GER', -5); addMor(S, 'SOV', 3); } },
  { id: 'fin', side: 'SOV', ic: 'flag', at: { hist: '1944-09-04', free: '1944-01-01' },
    cond: (S) => own(S, 'Ленинград') === 'SOV' && (own(S, 'Выборг') === 'SOV' || (S.mode === 'hist' && S.turn >= T('1944-10-15'))),
    t: 'Финляндия вышла из войны', d: 'Финские войска уходят, немецкие отступают в Норвегию. Карелия снова советская.',
    fx: (S) => {
      const F = natIdx(S, 'FIN'), SV = natIdx(S, 'SOV');
      for (let r = 0; r < S.M.R; r++) if (S.own[r] === F && S.M.nats[S.own0[r]] === 'SOV') { S.own[r] = SV; S.capT[r] = S.turn; }
      (S.out ||= {}).FIN = 1;
      dropNat(S, 'FIN');
      for (const u of S.units) if (alive(u) && u.s === 'GER' && S.M.nats[S.own[u.r]] === 'FIN') { const a = S.at[u.r]; a.splice(a.indexOf(u), 1); u.dead = 1; u.r = -1; }
      evict(S, 'SOV'); reindex(S); addMor(S, 'GER', -3);
    } },
  { id: 'volk', side: 'GER', ic: 'helmet', at: '1944-03-01', cond: (S) => S.turn >= T('1944-10-18') || nearReich(S, 3), t: 'Фольксштурм', d: 'В строй ставят стариков и подростков: новые слабые дивизии у Берлина и Кёнигсберга.',
    fx: (S) => {
      const o = { key: 'GER:vs', str: 50, rdy: 45, name: (n) => `${n}-й фольксштурм` };
      spawn(S, 'GER', 'Берлин', 3, o); spawn(S, 'GER', 'Кёнигсберг', 2, o); spawn(S, 'GER', 'Бреслау', 2, o);
    } },
  { id: 'berlinOp', side: 'SOV', ic: 'target', at: '1945-01-12', mode: 'hist', cond: (S) => near(S, cityR(S, 'Берлин'), 'GER', 5), t: 'На Берлин!', d: 'Последнее наступление войны: +15 % к атаке на 6 недель.',
    fx: (S) => addBoost(S, 'SOV', zOf(S, 'Берлин'), 1.15, 6) },
];
const EVM = new Map(EVENTS.map((e) => [e.id, e]));
export const evById = (id) => EVM.get(id);
// войска СССР в пределах d шагов от земель наций nats
// Красная армия у границ Рейха (довоенная территория Германии)
function nearReich(S, d) {
  const G = natIdx(S, 'GER');
  for (let r = 0; r < S.M.R; r++) if (S.own0[r] === G && sideOf(S, r) === 'GER' && near(S, r, 'GER', d)) return true;
  return false;
}
function nearNat(S, nats, d) {
  const idx = nats.map((n) => natIdx(S, n));
  for (let r = 0; r < S.M.R; r++) if (idx.includes(S.own[r]) && near(S, r, 'GER', d)) return true;
  return false;
}
// укрепления +1 на n участках фронта направления z (там, где враг сильнее)
function fortLine(S, side, z, n) {
  const c = [];
  for (let r = 0; r < S.M.R; r++) {
    if (sideOf(S, r) !== side || S.M.reg[r].z !== z || S.fort[r] >= 3) continue;
    let th = 0;
    for (const e of S.M.reg[r].nb) th += S.at[e.r].filter((u) => u.s !== side).length;
    if (th > 0) c.push([r, th + S.M.reg[r].vp]);
  }
  c.sort((a, b) => b[1] - a[1]);
  for (const [r] of c.slice(0, n)) S.fort[r]++;
}
function fortNear(S, side, city, d) {
  const r0 = cityR(S, city);
  if (r0 < 0) return;
  const seen = new Set([r0]);
  let ring = [r0];
  for (let k = 0; k <= d; k++) {
    for (const r of ring) if (sideOf(S, r) === side && S.fort[r] < 3) S.fort[r]++;
    const nx = [];
    for (const x of ring) for (const e of S.M.reg[x].nb) if (!seen.has(e.r)) { seen.add(e.r); nx.push(e.r); }
    ring = nx;
  }
}
const iso = (E, S) => (typeof E.at === 'object' ? E.at[S.mode] : E.at);
// проверка событий в начале недели (после хода истории); случившиеся — в очередь карточек
export function runEvents(S) {
  S.ev ||= {}; S.evq ||= [];
  if (S.noEv) return;
  if (S.boost) S.boost = S.boost.filter((b) => b.until > S.turn);
  for (const E of EVENTS) {
    if (S.ev[E.id] !== undefined || (E.mode && E.mode !== S.mode)) continue;
    const a = iso(E, S);
    if (!a || S.turn < T(a)) continue;
    if (E.until && S.turn > T(E.until)) { S.ev[E.id] = -1; continue; }
    if (E.cond && !E.cond(S)) continue;
    S.ev[E.id] = S.turn;
    const ask = !!E.opts && E.side === S.side && !S.noAsk;
    if (E.opts && !ask) { S.evc ||= {}; S.evc[E.id] = 0; E.opts[0].fx?.(S); } else if (!E.opts) E.fx?.(S);
    S.evq.push({ id: E.id, t: S.turn, ask: ask ? 1 : 0 });
    note(S, { ic: E.ic, side: E.side, txt: E.t, ev: E.id });
  }
}
// выбор игрока в событии с вариантами
export function chooseEvent(S, id, i) {
  const E = EVM.get(id);
  if (!E?.opts || !(S.ev[id] >= 0) || S.evc?.[id] !== undefined) return false;
  const o = E.opts[i] || E.opts[0];
  S.evc ||= {}; S.evc[id] = i;
  o.fx?.(S);
  for (const q of S.evq || []) if (q.id === id) q.ask = 0;
  return true;
}
// события с выбором, ждущие решения игрока
export function pendingChoices(S) {
  return EVENTS.filter((E) => E.opts && E.side === S.side && S.ev?.[E.id] >= 0 && S.evc?.[E.id] === undefined).map((E) => E.id);
}
// карточка для интерфейса: { id, ic, t, d, side, good (на пользу игроку), opts }
export function evCard(S, id) {
  const E = EVM.get(id);
  if (!E) return null;
  return { id, ic: E.ic, t: E.t, d: typeof E.d === 'function' ? E.d(S) : E.d, side: E.side, good: E.side === S.side, opts: E.opts?.map((o) => ({ t: o.t, ic: o.ic, d: o.d })) || null, turn: S.ev[id] };
}
// действующие усиления (для карточек направлений): [{ side, z, k, kind, left }]
export function boostsNow(S, side = null) {
  return (S.boost || []).filter((b) => b.until > S.turn && (!side || b.side === side)).map((b) => ({ ...b, left: b.until - S.turn }));
}
