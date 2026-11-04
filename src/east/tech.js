// «Мировой фронт» v0.11: наука «как в HoI4, только проще».
// 8 веток по 4 технологии (по порядку), 2 слота исследований (3 — с середины 1942 г.). Срок — недели, раньше
// исторического года — дольше (штраф опережения), позже — быстрее. Сила войск и хозяйство v0.10 уже учитывают
// исторический ход исследований, поэтому эффекты считаются ОТНОСИТЕЛЬНО истории: опережение — преимущество,
// отставание — штраф (fx = изученное − «по истории»). ИИ изучает не раньше истории — баланс кампании прежний.
// Открытия (морской и воздушный десант) — по факту изучения.
import { yearF } from './rules.js';
import { note } from './engine.js';

export const TB = {
  inf: { n: 'Пехота', ic: 'rifle' },
  art: { n: 'Артиллерия', ic: 'art' },
  arm: { n: 'Танки', ic: 'tank' },
  air: { n: 'Авиация', ic: 'air' },
  ind: { n: 'Промышленность', ic: 'factory' },
  log: { n: 'Логистика', ic: 'truck' },
  doc: { n: 'Доктрины', ic: 'plan' },
  op: { n: 'Операции', ic: 'para' },
};
export const TB_ORDER = ['inf', 'art', 'arm', 'air', 'ind', 'log', 'doc', 'op'];
// n — название ([СССР, Германия] или общее), y — исторический год, fx — эффект ([СССР, Германия] или общий), h — пояснение
const T0 = [
  ['inf', 1941.9, ['ППШ-41', 'Единый пулемёт MG 42'], { infAtt: 0.05 }, ['пистолет-пулемёт — в каждый взвод', 'скорострельный пулемёт пехоты']],
  ['inf', 1942.6, ['ПТР и гранаты', 'Кумулятивные снаряды'], { infDef: 0.06 }, ['пехота сама держит танки', 'пехотные пушки пробивают броню']],
  ['inf', 1943.4, ['Штурмовые группы', 'Панцерфауст'], [{ infAtt: 0.06 }, { infDef: 0.06 }], ['штурм опорных пунктов', 'ручной противотанковый гранатомёт']],
  ['inf', 1944.2, ['ППС-43 и СГ-43', 'Штурмгевер StG 44'], { infAtt: 0.04, infDef: 0.04 }, ['новое стрелковое оружие', 'первая штурмовая винтовка']],
  ['art', 1941.8, ['«Катюша» БМ-13', 'Небельверфер'], { att: 0.04 }, ['реактивные миномёты', 'реактивные миномёты']],
  ['art', 1942.5, ['Пушка ЗИС-3', 'Пушка Pak 40'], { def: 0.04 }, ['дивизионная и противотанковая', 'противотанковая 75 мм']],
  ['art', 1943.2, ['Артиллерия прорыва', 'Тяжёлые мортиры'], { fortPen: 0.4 }, ['корпуса прорыва РВГК', 'осадная артиллерия']],
  ['art', 1944.0, ['СУ-152 и ИСУ', 'САУ «Хуммель»'], { att: 0.04, fortPen: 0.3 }, ['самоходная тяжёлая артиллерия', 'самоходная гаубица']],
  ['arm', 1942.1, ['Т-34 в массе', 'Длинноствольный Pz IV'], { tank: 0.06 }, ['Т-34 — основной танк', '75-мм пушка против Т-34']],
  ['arm', 1942.9, ['КВ-1С и Т-70', 'Тяжёлый танк «Тигр»'], { tank: 0.05 }, ['танки сопровождения', 'тяжёлые танковые батальоны']],
  ['arm', 1943.7, ['Т-34-85', '«Пантера»'], { tank: 0.06 }, ['85-мм пушка', 'новый средний танк']],
  ['arm', 1944.4, ['ИС-2', '«Королевский тигр»'], { tank: 0.04 }, ['тяжёлый танк прорыва', 'самый тяжёлый танк']],
  ['air', 1941.9, ['Штурмовик Ил-2', 'Ju 87 D «Штука»'], { air: 0.06 }, ['«летающий танк»', 'пикирующий бомбардировщик']],
  ['air', 1942.7, ['Ла-5 и Як-9', 'Истребитель Fw 190'], { air: 0.08 }, ['новые истребители', 'новый истребитель']],
  ['air', 1943.4, ['Радионаведение', 'Ночные истребители'], { air: 0.06 }, ['управление с земли по радио', 'радары и ночная ПВО']],
  ['air', 1944.4, ['Ла-7 и Як-3', 'Реактивный Me 262'], { air: 0.06 }, ['лучшие истребители войны', 'первый реактивный истребитель']],
  ['ind', 1941.9, ['Поточные линии', 'Стандартизация'], { pp: 0.04 }, ['сборка на конвейере', 'меньше моделей — больше выпуск']],
  ['ind', 1942.6, 'Станочный парк', { pp: 0.05 }, 'новые станки и оснастка'],
  ['ind', 1943.3, 'Рационализация', { pp: 0.04, cp: 0.1 }, 'меньше трудозатрат на изделие'],
  ['ind', 1944.1, ['Заменители металлов', 'Синтетическое топливо'], { pp: 0.04 }, ['экономия дефицитного сырья', 'бензин из угля']],
  ['log', 1941.9, 'Полевые склады', { sup: 0.05 }, 'запасы ближе к фронту'],
  ['log', 1942.5, 'Железнодорожные войска', { rail: 1 }, '+1 область ж/д в неделю'],
  ['log', 1943.2, 'Автотранспорт', { sup: 0.06 }, 'грузовики подвозят снабжение'],
  ['log', 1944.0, 'Полевые ремонтные службы', { rec: 0.2 }, 'дивизии быстрее пополняются'],
  ['doc', 1942.0, ['Ударные армии', 'Опорные пункты «ёж»'], [{ att: 0.03 }, { def: 0.04 }], ['массирование сил на прорыве', 'круговая оборона сёл']],
  ['doc', 1942.8, ['Боевой устав 1942 г.', 'Боевые группы'], [{ def: 0.03, infAtt: 0.02 }, { att: 0.03 }], ['опыт первого года войны', 'сводные кампфгруппы']],
  ['doc', 1943.5, ['Глубокая операция', 'Эластичная оборона'], [{ tank: 0.05 }, { def: 0.04 }], ['танковые армии в прорыв', 'отход и контрудар']],
  ['doc', 1944.3, ['Операции фронтов', '«Пожарные команды»'], [{ att: 0.04 }, { tank: 0.04, def: 0.02 }], ['удары нескольких фронтов', 'танковый резерв на опасные участки']],
  ['op', 1941.8, 'Морская пехота', { sea: 1 }, 'морской десант из порта'],
  ['op', 1942.0, 'Воздушно-десантные войска', { abn: 1 }, 'дивизии ВДВ и воздушный десант'],
  ['op', 1943.0, 'Взаимодействие флота и авиации', { opK: 0.2 }, 'десанты сильнее'],
  ['op', 1944.0, 'Десантные средства', { opK: 0.2 }, 'десанты сильнее'],
];
const SI = { SOV: 0, GER: 1 };
const pick = (v, side) => (Array.isArray(v) ? v[SI[side]] : v);
export const TECH = [];
export const TK = {};
{
  const nb = {};
  for (const [b, y, n, fx, h] of T0) {
    const i = (nb[b] = (nb[b] ?? -1) + 1), k = b + (i + 1);
    const t = { k, b, i, y, n, fx, h, w: Math.round(6 + (y - 1941.5) * 2.6) };
    TECH.push(t); TK[k] = t;
  }
}
export const techName = (t, side) => pick(t.n, side);
export const techFx = (t, side) => pick(t.fx, side);
export const techHint = (t, side) => pick(t.h, side);
export const UNLOCK = { sea: 1, abn: 1, opK: 1 }; // открытия и сила десантов — по факту изученного (не относительно истории)
const LAG = 0.15; // «по истории» эффект появляется через ~8 недель после исторического года
const LOOK = 0.35; // ИИ начинает изучать не раньше чем за ~4 месяца до исторического года
export const FXN = {
  att: 'атака войск', def: 'оборона войск', infAtt: 'атака пехоты', infDef: 'оборона пехоты', tank: 'танковые и моторизованные',
  fortPen: 'прорыв укреплений', air: 'авиация', pp: 'военное производство', cp: 'стройка', sup: 'снабжение', rail: 'восстановление ж/д',
  rec: 'пополнение дивизий', opK: 'сила десантов', sea: 'морской десант', abn: 'воздушный десант',
};
export function fxText(fx, sgn = true) {
  const out = [];
  for (const [k, v] of Object.entries(fx)) {
    if (!v) continue;
    if (UNLOCK[k]) out.push(FXN[k]);
    else if (k === 'fortPen') out.push(`${FXN[k]} ${v > 0 && sgn ? '+' : ''}${String(Math.round(v * 10) / 10).replace('.', ',')} ур.`);
    else if (k === 'rail') out.push(`${FXN[k]} ${v > 0 && sgn ? '+' : ''}${Math.round(v)} обл./нед`);
    else out.push(`${FXN[k]} ${v > 0 && sgn ? '+' : ''}${Math.round(v * 100)} %`);
  }
  return out.join(', ');
}
export const slotsOf = (S, side) => (yearF(S.turn) >= 1942.5 ? 3 : 2) + (S.flags?.[side + 'sci'] || 0);
export const T = (S, side) => S.tech[side];
export const isDone = (S, side, k) => S.tech[side].done.includes(k);
export const inCur = (S, side, k) => S.tech[side].cur.includes(k);
const prevOf = (t) => (t.i > 0 ? TECH.find((x) => x.b === t.b && x.i === t.i - 1) : null);
export const canStart = (S, side, k) => { const t = TK[k], p = prevOf(t); return !!t && !isDone(S, side, k) && !inCur(S, side, k) && (!p || isDone(S, side, p.k)); };
// множитель срока: опережение истории — дольше (×(1+1,5·лет)), отставание — быстрее (до ×0,5)
export function penOf(S, k) { const dy = TK[k].y - yearF(S.turn); return dy > 0 ? 1 + 1.5 * dy : Math.max(0.5, 1 + 0.5 * dy); }
export const weeksLeft = (S, side, k) => Math.max(1, Math.ceil(TK[k].w * penOf(S, k) * (1 - (S.tech[side].p[k] || 0)) - 1e-6));
export function start(S, side, k, slot = -1) {
  const X = S.tech[side];
  if (!canStart(S, side, k)) return false;
  const n = slotsOf(S, side);
  while (X.cur.length < n) X.cur.push(null);
  const i = slot >= 0 && slot < n ? slot : X.cur.findIndex((c, j) => j < n && !c);
  if (i < 0) return false;
  X.cur[i] = k;
  X.p[k] ??= 0;
  return true;
}
export function stop(S, side, i) { const X = S.tech[side]; if (X.cur[i]) X.cur[i] = null; }
// что изучать дальше: самые ранние по истории (ИИ — не раньше чем за LOOK до года)
export function nextPick(S, side, ai) {
  const y = yearF(S.turn);
  let best = null;
  for (const t of TECH) {
    if (!canStart(S, side, t.k) || (ai && t.y > y + LOOK)) continue;
    if (!best || t.y < best.y - 1e-9 || (Math.abs(t.y - best.y) < 1e-9 && (S.tech[side].p[t.k] || 0) > (S.tech[side].p[best.k] || 0))) best = t;
  }
  return best?.k || null;
}
// «по истории»: что изучено к году y
export function schedFx(side, y) {
  const o = {};
  for (const t of TECH) if (t.y <= y - LAG) for (const [k, v] of Object.entries(techFx(t, side))) if (!UNLOCK[k]) o[k] = (o[k] || 0) + v;
  return o;
}
export function recompute(S, side) {
  const X = S.tech[side], o = {}, un = {};
  for (const k of X.done) for (const [e, v] of Object.entries(techFx(TK[k], side))) { if (UNLOCK[e]) un[e] = (un[e] || 0) + v; else o[e] = (o[e] || 0) + v; }
  const s = schedFx(side, yearF(S.turn));
  for (const e in s) o[e] = (o[e] || 0) - s[e];
  for (const e in o) if (Math.abs(o[e]) < 1e-9) delete o[e];
  // ИИ — строго «по истории» (его сила откалибрована кривыми v0.10), игрок — относительно истории
  X.fx = side === S.side ? o : {}; X.un = un;
  return o;
}
export const tx = (S, side, k) => S.tech?.[side]?.fx?.[k] || 0;
export const hasU = (S, side, k) => !!S.tech?.[side]?.un?.[k];
export const unV = (S, side, k) => S.tech?.[side]?.un?.[k] || 0;
// неделя науки: прогресс в слотах, готовые — в изученные, свободные слоты — авто (ИИ — всегда)
export function techWeek(S) {
  for (const side of ['GER', 'SOV']) {
    const X = S.tech[side], n = slotsOf(S, side), ai = side !== S.side;
    while (X.cur.length < n) X.cur.push(null);
    const auto = ai || X.auto;
    if (auto) for (let i = 0; i < n; i++) if (!X.cur[i]) { const k = nextPick(S, side, ai); if (k) start(S, side, k, i); }
    for (let i = 0; i < X.cur.length; i++) {
      const k = X.cur[i];
      if (!k) continue;
      if (i >= n) { X.cur[i] = null; continue; }
      X.p[k] = Math.min(1, (X.p[k] || 0) + 1 / (TK[k].w * penOf(S, k)));
      if (X.p[k] >= 1 - 1e-9) {
        X.done.push(k); X.cur[i] = null; delete X.p[k];
        if (!ai) note(S, { ic: 'sci', side, txt: `Изучено: ${techName(TK[k], side)} — ${fxText(techFx(TK[k], side))}`, sci: k });
        if (auto) { const k2 = nextPick(S, side, ai); if (k2) start(S, side, k2, i); }
      }
    }
    recompute(S, side);
  }
}
// новые игры и старые сохранения: изучено «по истории» на текущую дату
export function ensureTech(S) {
  S.tech ??= {};
  for (const side of ['GER', 'SOV']) {
    if (!S.tech[side]?.done) {
      const y = yearF(S.turn);
      S.tech[side] = { done: TECH.filter((t) => t.y <= y - LAG).map((t) => t.k), cur: [], p: {}, auto: 1 };
    }
    const X = S.tech[side];
    X.cur ??= []; X.p ??= {}; X.auto ??= 1;
    recompute(S, side);
  }
}
