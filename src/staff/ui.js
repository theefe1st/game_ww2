// «Сталинград 1942–1943» (v0.7): интерфейс штабного режима «Операция «Уран»».
// Игрок — представитель Ставки (или ОКХ): директивы армиям (у Оси — корпусам), при нужде — приказы отдельным дивизиям.
// Движок считает по часам; кнопка «Ход ▶» прокручивает ход (12/24/48 ч) с анимацией марша и боёв и сама
// останавливается на важных событиях (кольцо, решения, рассечение котла, конец операции).
// Хост (game.js) даёт: sfx {click, select, move, boom, capture, turn, error, win, lose}, exit() — в главное меню.
import D from '../data/uranus42.json';
import './staff.css';
import * as E from './engine.js';
import { think } from './ai.js';
import { GENERALS, HIGH, TRAITS } from './scenario.js';
import { NAT, TYPES, CAT, CAT_TXT, CAT_COL, TERR, SUP_TXT, MECH, ICE, weather, isDay } from './rules.js';
import { hexDist } from './geo.js';
import { StaffMap } from './map.js';
import { portraitURL } from './portraits.js';
import { flagURL, headURL, surname } from './sprites.js';

const KEY = 'wf_st_v1', KEY_META = 'wf_st_meta', KEY_OPT = 'wf_st_opt';
const DIFF = ['Лёгкая', 'Нормальная', 'Тяжёлая'];
const SPD = [{ n: 'Медленно', ms: 150 }, { n: 'Обычно', ms: 70 }, { n: 'Быстро', ms: 26 }, { n: 'Мгновенно', ms: 0 }];
const LENS = [12, 24, 48];
const SIDE_N = { SOV: 'СССР', AX: 'Ось' };
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const f0 = (v) => Math.round(v).toLocaleString('ru-RU');
const f1 = (v) => (Math.round(v * 10) / 10).toLocaleString('ru-RU');
const pct = (v) => `${Math.round(v)}%`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const raf = () => new Promise((r) => requestAnimationFrame(() => r()));
const hh = (t) => `${String(((t % 24) + 24) % 24).padStart(2, '0')}:00`;
const cap1 = (s) => (s ? s[0].toUpperCase() + s.slice(1) : '');
const minus = (v) => (v < 0 ? `−${Math.abs(v)}` : `${v}`);
const plural = (n, a, b, c) => {
  const k = Math.abs(n) % 100, j = k % 10;
  return k > 10 && k < 20 ? c : j === 1 ? a : j >= 2 && j <= 4 ? b : c;
};
const divN = (n) => `${n} ${plural(n, 'дивизия', 'дивизии', 'дивизий')}`;
// полные названия соединений
const ABBR = [
  ['гв. сд', 'гвардейская стрелковая дивизия'], ['гв. кк', 'гвардейский кавалерийский корпус'], ['морская сбр', 'морская стрелковая бригада'],
  ['рум. пд', 'румынская пехотная дивизия'], ['рум. кд', 'румынская кавалерийская дивизия'], ['рум. тд', 'румынская танковая дивизия'],
  ['сд', 'стрелковая дивизия'], ['сбр', 'стрелковая бригада'], ['тбр', 'танковая бригада'], ['тк', 'танковый корпус'], ['мк', 'механизированный корпус'],
  ['кк', 'кавалерийский корпус'], ['ск', 'стрелковый корпус'], ['кд', 'кавалерийская дивизия'], ['пд', 'пехотная дивизия'], ['тд', 'танковая дивизия'],
  ['мд', 'моторизованная дивизия'], ['апд', 'авиаполевая дивизия'], ['лпд', 'лёгкая пехотная дивизия'], ['КГ', 'боевая группа'], ['егерская', 'егерская дивизия'],
];
export function fullName(u) {
  const n = u.name || '';
  for (const [a, b] of ABBR) {
    const re = new RegExp(`(^|\\s)${a.replace(/\./g, '\\.')}(?=$|\\s)`);
    if (re.test(n)) return n.replace(re, `$1${b}`);
  }
  if (u.nat === 'ITA' && n.includes('«')) return n.replace(/\s«/, ' пехотная дивизия «');
  return n;
}
const rankShort = (r) => (r || '').replace(/^генерал-(лейтенант|майор|полковник|фельдмаршал)/, 'ген.-$1').replace('танковых войск', 'танк. войск');
// словесные оценки
const TRW = (v) => (v < 30 ? 'необученная' : v < 45 ? 'слабая' : v < 60 ? 'обученная' : v < 75 ? 'хорошая' : 'отличная');
const XPW = (v) => (v < 20 ? 'новобранцы' : v < 40 ? 'обстрелянные' : v < 60 ? 'опытные' : v < 80 ? 'ветераны' : 'закалённые');
const MORW = (v) => (v >= 75 ? 'высокий' : v >= 60 ? 'твёрдый' : v >= 45 ? 'средний' : v >= 30 ? 'низкий' : 'подорван');
const FATW = (v) => (v < 20 ? 'бодрые' : v < 40 ? 'лёгкая' : v < 60 ? 'заметная' : v < 80 ? 'сильная' : 'на пределе');
const CTLW = (v) => (v >= 80 ? 'связь есть' : v >= 60 ? 'с перебоями' : v >= 40 ? 'слабая' : 'потеряна');
const ENTW = ['в поле', 'наспех', 'окопы', 'подготовленная оборона', 'укреплённый рубеж', 'укреплённый район'];
const CAT_ADV = ['', 'может наступать', 'наступать — на ограниченную глубину', 'атаковать — после пополнения', 'атака — с большим риском', 'нужны отвод и переформирование'];
const OUT_S = ['отбита', 'держится', 'отходит', 'бежит'];
const ORD_BTN = [['move', 'Марш'], ['atk', 'Атака'], ['hold', 'Держать'], ['wd', 'Отвод'], ['rest', 'Отдых']];
const DIR_BTN = [['def', 'Оборона'], ['atk', 'Наступать'], ['wd', 'Отход'], ['res', 'Резерв']];
const colHi = (v) => (v >= 70 ? '#4fbf55' : v >= 50 ? '#e3c23a' : v >= 30 ? '#e98a2f' : '#d6453a');
const colLo = (v) => colHi(100 - v);
const bar = (v, col) => `<div class="st-bar"><i style="width:${Math.max(0, Math.min(100, v))}%;background:${col}"></i></div>`;
const catBadge = (c, q = '') => `<i class="st-cb" style="background:${c ? CAT_COL[c] : '#8f8c86'}">${c ? CAT[c] : '?'}${q}</i>`;
const flagImg = (nat, w = 22, h = 14) => `<img class="st-fl" src="${flagURL(nat, w, h)}" style="width:${w}px;height:${h}px" alt="">`;
const unitCat = (S, u) => E.catOf(E.cv(S, u));
const STAR = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 1.8l3.1 6.6 7.2.9-5.3 5 1.4 7.1L12 17.9l-6.4 3.5 1.4-7.1-5.3-5 7.2-.9z"/></svg>';

function loadOpt() {
  try {
    const o = JSON.parse(localStorage.getItem(KEY_OPT) || '{}');
    return { len: LENS.includes(o.len) ? o.len : 24, spd: o.spd >= 0 && o.spd < SPD.length ? o.spd : 1, side: o.side === 'AX' ? 'AX' : 'SOV', diff: o.diff >= 0 && o.diff <= 2 ? o.diff : 1, hist: !!o.hist, fog: o.fog !== 0 && o.fog !== false };
  } catch {
    return { len: 24, spd: 1, side: 'SOV', diff: 1, hist: false, fog: true };
  }
}
function readMeta() {
  try {
    const m = JSON.parse(localStorage.getItem(KEY_META) || 'null');
    return m && m.v === 1 && localStorage.getItem(KEY) ? m : null;
  } catch {
    return null;
  }
}

const TPL = `
<canvas class="st-cv" data-r="cv"></canvas>
<div class="st-top" data-r="top">
  <button class="btn icon st-bmenu" data-a="menu" aria-label="Меню"><i class="st-burger"></i></button>
  <button class="panel st-chip st-date" data-a="journal"><img class="st-fl" data-r="dflag" alt=""><span><b data-r="dt"></b><small data-r="ds"></small></span></button>
  <div class="panel st-seg st-lod" data-r="lod"><button data-a="lod" data-v="div">Дивизии</button><button data-a="lod" data-v="army">Армии</button></div>
  <button class="btn gold st-bturn" data-a="turn" data-r="turn">Ход <i class="st-ip"></i></button>
</div>
<div class="st-toasts" data-r="toasts"></div>
<div class="st-hint panel hidden" data-r="hint"></div>
<div class="st-sugs" data-r="sugs"></div>
<button class="panel st-chip st-legend" data-a="cats" data-r="legend"><span>Боеспособность</span>${[1, 2, 3, 4, 5].map((c) => catBadge(c)).join('')}</button>
<button class="panel st-chip st-status" data-a="score" data-r="status"></button>
<div class="st-sheet panel hidden" data-r="sheet"></div>
<div class="st-modal hidden" data-r="modal"></div>
<div class="st-hub hidden" data-r="hub"></div>`;

export class StaffUI {
  constructor(root, host = {}) {
    this.root = root;
    this.h = host;
    this.opt = loadOpt();
    root.innerHTML = TPL;
    this.$ = {};
    for (const e of root.querySelectorAll('[data-r]')) this.$[e.dataset.r] = e;
    root.addEventListener('click', (e) => this.onClick(e));
    this.modalQ = [];
    this.sugs = [];
    this.S = null;
    this.meta = null;
    this.selU = null;
    this.selF = null;
    this.selH = null;
    this.tgt = null;
    this.lastBoom = 0;
    this.onResize = () => this.layout();
    window.addEventListener('resize', this.onResize);
  }
  static menuLabel() {
    const m = readMeta();
    if (m) return `${SIDE_N[m.side]} · ход ${m.turn} · ${E.dateLabel(m.t, false)}${m.over ? ' · итоги' : ''}`;
    return 'Операция «Уран» · 19.11.1942 – 2.02.1943';
  }
  sfx(k) {
    try {
      this.h.sfx?.[k]?.();
    } catch {}
  }
  // ——— жизненный цикл ———
  open() {
    this.dead = 0;
    if (!this.map) {
      this.map = new StaffMap(this.$.cv, D, { onTap: (h, c) => this.onTap(h, c), onLod: (l) => this.lodUI(l) });
      this.preview = E.newGame(D, { side: 'SOV', seed: 1 });
      this.map.setState(this.preview, 'SOV');
    }
    this.map.pause(false);
    this.layout();
    this.showHub();
  }
  close() {
    this.stopReq = 1;
    if (this.S && this.inGame) this.saveGame();
    this.map?.pause(true);
    this.closeModal(true);
    this.dead = 1;
  }
  back() {
    if (!this.$.modal.classList.contains('hidden')) {
      if (this.modalLock) return true;
      this.sfx('click');
      this.closeModal();
      return true;
    }
    if (this.tgt) return this.cancelTarget(), true;
    if (!this.$.sheet.classList.contains('hidden')) return this.clearSel(), true;
    if (!this.$.hub.classList.contains('hidden')) {
      this.h.exit?.();
      return true;
    }
    if (this.running) return (this.stopReq = 1), true;
    this.gameMenu();
    return true;
  }
  exit() {
    if (this.S && this.inGame) this.saveGame();
    this.stopReq = 1;
    this.h.exit?.();
  }
  // раскладка: альбомная (панель справа) или книжная (панель снизу)
  layout() {
    const W = this.root.clientWidth, H = this.root.clientHeight;
    this.root.classList.toggle('st-land', W > H && W >= 600);
    this.root.classList.toggle('st-narrow', W < 560);
    if (this.S) this.hud();
    requestAnimationFrame(() => this.inset());
  }
  // высота верхней зоны для тостов; в узком режиме статус стоит вторым рядом и бывает выше переключателя
  setTh() {
    const R = this.root.getBoundingClientRect(), top = this.$.top.getBoundingClientRect();
    const stb = this.root.classList.contains('st-narrow') ? this.$.status.getBoundingClientRect().bottom : 0;
    const v = `${Math.round(Math.max(top.bottom, stb) - R.top)}px`;
    if (this.root.style.getPropertyValue('--th') !== v) this.root.style.setProperty('--th', v);
  }
  inset() {
    if (!this.map) return;
    const R = this.root.getBoundingClientRect(), top = this.$.top.getBoundingClientRect();
    this.setTh();
    let r = 0, b = 0;
    const sh = this.$.sheet;
    if (!sh.classList.contains('hidden')) {
      const s = sh.getBoundingClientRect();
      if (this.root.classList.contains('st-land')) r = Math.round(R.right - s.left);
      else b = Math.round(R.bottom - s.top);
    }
    this.map.setInset(0, this.$.hub.classList.contains('hidden') ? Math.round(top.bottom - R.top) : 0, r, b);
  }
  // ——— хаб: выбор стороны и параметров ———
  showHub() {
    this.inGame = 0;
    this.clearSel(true);
    this.root.classList.add('st-hubmode');
    const m = readMeta(), o = this.opt;
    const seg = (a, list, cur) => `<div class="st-seg panel">${list.map(([v, n]) => `<button data-a="${a}" data-v="${v}" class="${String(v) === String(cur) ? 'on' : ''}">${n}</button>`).join('')}</div>`;
    const sideTxt = o.side === 'SOV'
      ? 'Ставка. Прорвать фронт румынских армий севернее и южнее Сталинграда, сомкнуть кольцо у Калача, отразить деблокаду и уничтожить окружённую группировку до 2 февраля 1943 года.'
      : 'ОКХ. Удержать фронт на Дону и у Сталинграда, а если кольцо сомкнётся — сохранить аэродромы воздушного моста и пробить коридор к 6-й армии.';
    this.$.hub.innerHTML = `<div class="st-hubw panel">
<div class="st-ha"><div class="st-ht">Сталинград 1942–1943</div>
<div class="st-hs">Операция «Уран» · 19 ноября 1942 — 2 февраля 1943</div>
<p class="st-hp">Штабная карта: реальный состав сторон, генералы с чертами, боеспособность дивизий I–V, котёл и воздушный мост. Вы отдаёте директивы армиям, штабы сами распределяют дивизии.</p></div>
${m ? `<button class="btn gold st-wide st-hc" data-a="cont">Продолжить<small>${esc(SIDE_N[m.side])} · ход ${m.turn} · ${esc(E.dateLabel(m.t, false))} · ${DIFF[m.diff].toLowerCase()}${m.over ? ' · операция завершена' : ''}</small></button>` : ''}
<div class="st-ho"><h4>Сторона</h4>${seg('o-side', [['SOV', 'СССР — Ставка'], ['AX', 'Ось — ОКХ']], o.side)}
<p class="st-hp st-dim">${sideTxt}</p>
<h4>Сложность</h4>${seg('o-diff', DIFF.map((n, i) => [i, n]), o.diff)}
<h4>Решения противника</h4>${seg('o-hist', [[0, 'Свои'], [1, 'Как в истории']], o.hist ? 1 : 0)}
<h4>Туман войны</h4>${seg('o-fog', [[1, 'Вкл'], [0, 'Выкл']], o.fog ? 1 : 0)}
<h4>Длина хода</h4>${seg('o-len', LENS.map((l) => [l, `${l} ч`]), o.len)}</div>
<button class="btn ${m ? '' : 'gold'} st-wide st-hn" data-a="new">${m ? 'Новая операция' : 'Начать операцию'}</button>
<div class="st-row2 st-hr"><button class="btn" data-a="help">Как играть</button><button class="btn" data-a="exit">В меню</button></div>
</div>`;
    this.$.hub.classList.remove('hidden');
    this.inset();
  }
  saveOpt() {
    try {
      localStorage.setItem(KEY_OPT, JSON.stringify({ ...this.opt, fog: this.opt.fog ? 1 : 0 }));
    } catch {}
  }
  startNew() {
    const o = this.opt;
    const S = E.newGame(D, { side: o.side, diff: o.diff, hist: o.hist, fog: o.fog ? 1 : 0, seed: (Date.now() % 1e9) >>> 0 });
    this.enter(S, { v: 1, turn: 1, tEnd: 0, side: o.side, diff: o.diff, hist: o.hist, fog: o.fog, sugs: [], mq: [] });
    // стартовые сообщения (артподготовка и т. п.) — сразу
    this.pump();
    this.saveGame();
    this.nextModal();
  }
  cont() {
    const m = readMeta();
    if (!m) return;
    let S;
    try {
      S = E.load(D, localStorage.getItem(KEY));
    } catch (e) {
      this.toast('Сохранение повреждено', String(e.message || e));
      return;
    }
    this.enter(S, m);
    if (S.over) this.modalQ.push({ k: 'end' });
    this.nextModal();
  }
  enter(S, meta) {
    this.S = S;
    this.meta = meta;
    this.inGame = 1;
    this.sugs = meta.sugs || [];
    this.modalQ = meta.mq || [];
    this.$.hub.classList.add('hidden');
    this.root.classList.remove('st-hubmode');
    this.clearSel(true);
    this.map.setState(S, S.side);
    this.$.dflag.src = flagURL(S.side === 'SOV' ? 'SOV' : 'GER', 30, 20);
    this.renderSugs();
    this.hud();
    this.layout();
    this.inset();
    // начало: показать участок прорыва
    const f = S.side === 'AX' ? [430, 250] : [330, 150];
    this.map.flyTo({ cx: f[0], cy: f[1], z: Math.max(this.map.minZ() * 1.25, Math.min(1.9, this.map.coverZ())) }, 0);
  }
  saveGame() {
    const S = this.S;
    if (!S) return;
    const m = this.meta;
    Object.assign(m, { t: S.t, side: S.side, diff: S.diff, over: S.over ? 1 : 0, sugs: this.sugs.slice(-6), mq: this.modalQ.filter((q) => q.k !== 'end').slice(0, 6) });
    try {
      localStorage.setItem(KEY, E.save(S));
      localStorage.setItem(KEY_META, JSON.stringify(m));
    } catch (e) {
      this.toast('Не удалось сохранить', 'Мало места в памяти браузера.');
    }
  }
  // ——— верхняя панель и статус ———
  hud() {
    const S = this.S, m = this.meta;
    if (!S) return;
    const wx = weather(S.t);
    this.$.dt.textContent = `Ход ${m.turn} • ${E.dateLabel(S.t, false)}`;
    this.$.ds.innerHTML = `${hh(S.t)} • ${minus(wx.temp)}°, ${esc(wx.n)}<span class="st-op"> • операция «Уран»</span>`;
    const b = this.$.turn;
    b.innerHTML = this.running ? 'Стоп <i class="st-is"></i>' : S.over ? 'Итоги' : m.tEnd > S.t ? 'Далее <i class="st-ip"></i>' : 'Ход <i class="st-ip"></i>';
    b.classList.toggle('st-runb', !!this.running);
    this.root.classList.toggle('st-run', !!this.running);
    const st = this.statusHTML();
    if (this.$.status.innerHTML !== st) {
      this.$.status.innerHTML = st;
      if (this.root.classList.contains('st-narrow')) this.setTh();
    }
  }
  statusHTML() {
    const S = this.S, sc = E.score(S), P = S.pk;
    if (P && P.on) {
      const ids = new Set(P.ids), L = S.units.filter((u) => !u.dead && ids.has(u.id) && u.sup === 0);
      const n = L.filter((u) => u.sz >= 1).length, men = L.reduce((s, u) => s + u.men, 0), A = S.air;
      // узкий экран: короткая строка (статус стоит рядом с переключателем уровня)
      if (this.root.classList.contains('st-narrow')) return `<b class="st-gold">Котёл</b> ${n} див. • ${f0(men / 1000)} тыс. • ${A ? `мост ${f0(A.del)}/${f0(A.need)} т` : 'мост готовится'}`;
      const air = A ? ` • по воздуху ≈${f0(A.del)} из ${f0(A.need)} т/сут` : ' • воздушный мост готовится';
      return `<b class="st-gold">Котёл</b> ${divN(n)} • ${f0(men / 1000)} тыс.${air}`;
    }
    if (S.flags.elim) return `<b class="st-gold">Котёл ликвидирован</b> • очки ${f1(sc.vp)}`;
    if (S.flags.relieved) return S.side === 'SOV' ? `<b class="st-gold">Кольцо разорвано</b> • очки ${f1(sc.vp)} • замкнуть снова` : `<b class="st-gold">Коридор пробит</b> • очки ${f1(sc.vp)} • удержать коридор`;
    return `<b class="st-gold">Очки</b> ${f1(sc.vp)} • ${S.side === 'SOV' ? 'цель — замкнуть кольцо' : 'цель — удержать фронт'}`;
  }
  lodUI(l) {
    for (const b of this.$.lod.querySelectorAll('button')) b.classList.toggle('on', b.dataset.v === l);
  }
  // ——— тосты, рекомендации ———
  toast(title, txt = '', c = -1, cls = '') {
    const T = this.$.toasts;
    // одинаковые сообщения подряд — одно
    for (const e of T.children) if (e.dataset.k === `${title}|${txt}` && !e.classList.contains('out')) return;
    const el = document.createElement('div');
    el.dataset.k = `${title}|${txt}`;
    el.className = `st-toast panel ${cls}`;
    el.innerHTML = `<b>${esc(title)}</b>${txt ? `<small>${esc(txt)}</small>` : ''}`;
    if (c >= 0) el.addEventListener('click', () => (this.map.reveal(c, Math.max(this.map.z, 2.4), 380, true), this.map.addFx({ k: 'ping', c, ms: 900 })));
    T.append(el);
    while (T.children.length > 3) T.firstElementChild.remove();
    setTimeout(() => el.classList.add('out'), 3400);
    setTimeout(() => el.remove(), 3900);
  }
  addSug(m) {
    this.sugs = this.sugs.filter((s) => s.fid !== m.fid);
    this.sugs.push({ id: m.id, fid: m.fid, title: m.title, txt: m.txt });
    if (this.sugs.length > 6) this.sugs.shift();
    this.renderSugs();
  }
  renderSugs() {
    const L = this.sugs.slice(-2);
    this.$.sugs.innerHTML = L.map((s) => `<div class="st-sug panel"><div><b>${esc(s.title)}</b><small>${esc(s.txt)}</small></div>
<div class="st-sugb"><button class="btn sm gold" data-a="sug-ok" data-v="${esc(s.fid)}">Принять</button><button class="btn sm" data-a="sug-show" data-v="${esc(s.fid)}">Армия</button><button class="btn sm" data-a="sug-x" data-v="${esc(s.fid)}" aria-label="Скрыть"><i class="st-ix"></i></button></div></div>`).join('');
  }
  // ——— сообщения движка ———
  pump() {
    const S = this.S, side = S.side;
    let stop = false;
    for (const m of S.q) {
      if (m.seen) continue;
      m.seen = 1;
      if (m.side !== '*' && m.side !== side) continue;
      if (m.k === 'toast' || m.k === 'arr') {
        const good = m.cap ? m.cap === side : m.kill ? m.kill !== side : m.k === 'arr';
        this.toast(m.title, m.txt || '', m.c ?? -1, good ? 'good' : m.kill || m.cap ? 'bad' : '');
        if (m.cap) this.sfx('capture');
      } else if (m.k === 'sug') this.addSug(m);
      else if (m.k === 'ev') {
        if (m.pause) this.modalQ.push(m), (stop = true);
        else this.toast(m.title, m.txt || '');
      } else if (m.k === 'dec' || m.k === 'end') this.modalQ.push(m), (stop = true);
    }
    return stop;
  }
  fxOf() {
    const S = this.S, side = S.side, fog = S.fog, now = performance.now(), instant = SPD[this.opt.spd].ms === 0;
    for (const f of S.fx) {
      if (instant || f.k === 'mv') continue;
      if (fog && f.s !== side && S.vis[f.c] < 2) continue;
      if (f.k === 'bt') {
        const win = f.out >= 2;
        this.map.addFx({ k: 'bt', c: f.c, from: f.from, s: f.s, txt: OUT_S[f.out], good: (f.s === side) === win, ms: 1150 });
        if (now - this.lastBoom > 380) (this.lastBoom = now), this.sfx('boom');
      } else if (f.k === 'cap') this.map.addFx({ k: 'cap', c: f.c, s: f.s, ms: 700 });
      else if (f.k === 'kill') this.map.addFx({ k: 'kill', c: f.c, ms: 1600 });
    }
    S.fx.length = 0;
  }
  // ——— ход ———
  async turn() {
    const S = this.S;
    if (!S) return;
    if (this.running) return void (this.stopReq = 1);
    if (S.over) return this.results();
    if (this.modalQ.length) return this.nextModal();
    this.cancelTarget();
    const m = this.meta;
    if (!m.tEnd || S.t >= m.tEnd) m.tEnd = Math.min(E.T_END, S.t + this.opt.len);
    this.running = 1;
    this.stopReq = 0;
    this.sfx('turn');
    this.hud();
    let n = 0;
    while (S.t < m.tEnd && !S.over && !this.stopReq && !this.dead) {
      think(S);
      E.tick(S);
      this.fxOf();
      this.map.update();
      const stop = this.pump();
      n++;
      this.hud();
      if (n % 6 === 0) this.refreshCard(true);
      if (stop) break;
      const ms = SPD[this.opt.spd].ms;
      if (ms > 0) await sleep(ms);
      else if (n % 4 === 0) await raf();
    }
    this.running = 0;
    if (S.t >= m.tEnd || S.over) {
      m.turn++;
      m.tEnd = 0;
    }
    if (!this.dead) {
      this.saveGame();
      this.hud();
      this.refreshCard();
      this.nextModal();
    }
  }
  // ——— выбор на карте ———
  onTap(h, c) {
    const S = this.S;
    if (!S || !this.inGame || !this.$.modal.classList.contains('hidden')) return;
    if (this.tgt) return this.pick(c, h);
    if (h) {
      if (h.k === 'u') {
        const u = S.uById.get(h.id);
        if (!u) return;
        if (this.map.lod === 'army' && u.side === S.side) return this.selForm(u.form);
        if (this.selU === u.id) {
          // повторное касание — следующая часть в той же клетке
          const L = this.map.visibleUnits().filter((e) => e.c === (u.side === S.side || !S.fog ? u.c : u.snc));
          if (L.length > 1) {
            const i = L.findIndex((e) => e.u.id === u.id);
            return this.selUnit(L[(i + 1) % L.length].u.id);
          }
        }
        return this.selUnit(u.id);
      }
      if (h.k === 'f') return this.selForm(h.id);
      if (h.k === 'h') return this.selHigh(h.id);
    }
    this.clearSel();
  }
  clearSel(quiet) {
    this.selU = this.selF = this.selH = null;
    this.cancelTarget(true);
    this.$.sheet.classList.add('hidden');
    this.root.classList.remove('st-open');
    if (this.map) {
      this.map.sel = this.map.selF = this.map.selH = null;
      this.map.grid = -1;
      this.map.lines = [];
      this.map.marks = [];
      this.map.hl = null;
      this.map.dirty = 1;
    }
    if (!quiet) this.inset();
  }
  selUnit(id) {
    const u = this.S.uById.get(id);
    if (!u || u.dead) return this.clearSel();
    this.sfx('select');
    this.selU = id;
    this.selF = this.selH = null;
    this.renderCard();
    const own = u.side === this.S.side;
    this.map.reveal(own || !this.S.fog ? u.c : u.snc ?? u.c);
  }
  selForm(fid) {
    if (!this.S.forms[fid]) return;
    this.sfx('select');
    this.selF = fid;
    this.selU = this.selH = null;
    this.renderCard();
  }
  selHigh(key) {
    this.sfx('select');
    this.selH = key;
    this.selU = this.selF = null;
    this.renderCard();
  }
  // линии, метки и подсветка для текущего выбора
  selMap() {
    const S = this.S, M = this.map;
    M.sel = this.selU;
    M.selF = this.selF;
    M.selH = this.selH;
    M.lines = [];
    M.marks = [];
    M.grid = -1;
    if (!this.tgt) M.hl = null;
    if (this.selU != null) {
      const u = S.uById.get(this.selU);
      if (u && !u.dead) {
        const own = u.side === S.side;
        M.grid = own || !S.fog ? u.c : u.snc ?? u.c;
        if (own) {
          const add = (o, dash) => {
            if (!o) return;
            if (o.k === 'atk' && o.tgt != null) {
              const p = adjTo(S, u, o.tgt);
              M.lines.push({ pts: [...p, o.tgt], col: '#ff5a4a', arrow: 1, dash });
            } else if ((o.k === 'move' || o.k === 'wd' || o.k === 'rest') && o.to != null && o.to !== u.c) {
              const p = E.findPath(S, u, (c) => c === o.to);
              M.lines.push({ pts: [u.c, ...(p || [o.to])], col: o.k === 'move' ? '#ffd34d' : '#8fd0ff', arrow: 1, dash });
            }
          };
          add(u.ord, 0);
          if (u.pend) add(u.pend.ord, 1);
        }
      }
    }
    if (this.selF) {
      const F = S.forms[this.selF];
      if (F && (F.side === S.side || !S.fog)) {
        const dm = (d, dash) => {
          if (!d) return;
          if (d.k === 'atk') {
            const obj = d.obj.slice(d.oi || 0);
            obj.forEach((c, i) => M.marks.push({ c, n: i + 1, col: dash ? '#b06060' : '#d32f2f' }));
            if (obj.length) M.lines.push({ pts: [F.hq, ...obj], col: dash ? '#e0a0a0' : '#ff5a4a', arrow: 1, dash: 1 });
          } else if (d.at2 != null) {
            M.marks.push({ c: d.at2, n: d.k === 'def' ? 'О' : d.k === 'wd' ? 'Т' : 'Р', col: d.k === 'def' ? '#3f7fbf' : '#7a6a2a' });
            M.lines.push({ pts: [F.hq, d.at2], col: '#8fd0ff', arrow: 1, dash: 1 });
          }
        };
        dm(F.dir, 0);
        if (F.pdir) dm(F.pdir.dir, 1);
      }
    }
    if (this.tgt && this.tgt.k === 'f-atk') this.tgt.picks.forEach((c, i) => M.marks.push({ c, n: i + 1, col: '#ff9800' }));
    M.dirty = 1;
  }
  // ——— карточки ———
  renderCard() {
    const S = this.S;
    let html = '';
    if (this.selU != null) {
      const u = S.uById.get(this.selU);
      if (!u || u.dead) return this.clearSel();
      html = u.side === S.side || !S.fog ? this.cardUnit(u, u.side === S.side) : this.cardEnemy(u);
    } else if (this.selF) html = this.cardForm(S.forms[this.selF]);
    else if (this.selH) html = this.cardHigh(this.selH);
    else return this.clearSel();
    const sh = this.$.sheet, st = sh.scrollTop;
    sh.innerHTML = html;
    sh.scrollTop = st;
    sh.classList.remove('hidden');
    this.root.classList.add('st-open');
    this.selMap();
    this.inset();
    requestAnimationFrame(() => this.inset());
  }
  refreshCard(lite) {
    if (this.$.sheet.classList.contains('hidden')) return;
    if (lite && this.tgt) return;
    if (this.selU != null) {
      const u = this.S.uById.get(this.selU);
      if (!u || u.dead) return this.clearSel();
    }
    this.renderCard();
  }
  head(icon, title, lines) {
    return `<div class="st-hd">${icon}<div class="st-hdt"><b>${title}</b>${lines.filter(Boolean).map((l) => `<small>${l}</small>`).join('')}</div><button class="btn icon sm st-x" data-a="close" aria-label="Закрыть"><i class="st-ix"></i></button></div>`;
  }
  unitIcon(u) {
    return `<div class="st-uico"><img src="${headURL(u.nat, 3)}" alt="">${flagImg(u.nat, 20, 13)}</div>`;
  }
  cardUnit(u, own) {
    const S = this.S, F = S.forms[u.form], Hh = E.highOf(S, F), v = E.cv(S, u), c = E.catOf(v), A = u.auth, T = TYPES[u.type];
    const cmd = u.cmd && GENERALS[u.cmd] ? `Командир — ${rankShort(GENERALS[u.cmd].rank)} ${GENERALS[u.cmd].n}` : '';
    let h = this.head(this.unitIcon(u), esc(cap1(fullName(u))), [`${esc(F ? F.n : '')}${Hh ? ` • ${esc(Hh.n)}` : ''}`, esc(cmd), u.note ? `<i>${esc(u.note)}</i>` : '']);
    h += `<div class="st-cat">${catBadge(c)}<div><b>${esc(cap1(CAT_TXT[c]))}</b><small>${esc(CAT_ADV[c])}</small></div><span><b>${v}</b><small>из 100</small></span></div>`;
    const men = u.men / Math.max(1, A.men);
    h += `<h4>Состав</h4><div class="st-line"><span>Люди в строю</span>${bar(men * 100, colHi(men * 100))}<span class="st-v">${f0(u.men)} / ${f0(A.men)}</span></div>`;
    const tiles = [[f0(u.bay), 'штыков'], [f0(u.guns), 'орудий и мином.']];
    if (A.tanks) tiles.push([`${f0(u.tanks)}`, `танков из ${f0(A.tanks)}`]);
    else tiles.push([f0(u.at), 'ПТО']);
    tiles.push([pct((100 * u.trucks) / Math.max(1, A.trucks)), 'транспорт']);
    h += `<div class="st-tiles">${tiles.map(([a, b]) => `<div><b>${a}</b><small>${b}</small></div>`).join('')}</div>`;
    h += `<h4>Качество</h4><div class="st-g2">${this.kv('Подготовка', TRW(u.tr), u.tr, colHi(u.tr))}${this.kv('Боевой опыт', XPW(u.xp), u.xp, colHi(u.xp))}</div>`;
    const mech = MECH(u);
    h += `<h4>Состояние</h4><div class="st-g2">${this.kv('Боевой дух', MORW(u.mor), u.mor, colHi(u.mor))}${this.kv('Усталость', FATW(u.fat), u.fat, colLo(u.fat))}
${this.kv('Управление', CTLW(u.ctl), u.ctl, colHi(u.ctl))}${this.kv('Боеприпасы', `${f1(u.amm / 100)} б/к`, u.amm, colHi(u.amm))}
${mech ? this.kv('Горючее', `${f1(u.fuel / 100)} запр.`, u.fuel, colHi(u.fuel)) : this.kv('Продовольствие', pct(u.food), u.food, colHi(u.food))}${this.kv('Снабжение', SUP_TXT(u.sup), u.sup * 100, colHi(u.sup * 100))}</div>`;
    const city = E.terrOf(S, u.c) === 3;
    h += `<div class="st-line st-entl"><span>Окопы</span><div class="st-ent">${[1, 2, 3, 4, 5].map((i) => `<i class="${u.ent >= i ? 'on' : ''}"></i>`).join('')}</div><span class="st-v">${ENTW[Math.min(5, Math.round(u.ent))]}${city ? ', руины' : ''}</span></div>`;
    const terr = TERR[E.terrOf(S, u.c)]?.n || '';
    const note = [`${cap1(E.statusOf(S, u))}`, `${esc(E.placeName(S, u.c))}${terr ? `, ${terr}` : ''}`];
    if (own) note.push(u.ovr ? 'приказ командующего (вручную)' : `по плану армии: ${esc(E.dirText(S, F?.dir))}`);
    if (u.sup === 0) note.push('<span class="st-warn">без снабжения — окружение</span>');
    else if (u.ord?.k === 'rest') note.push('отдых: маршевые роты пополняют дивизию');
    h += `<div class="st-note">${note.join(' • ')}</div>`;
    if (own) {
      const k = u.ovr ? u.pend?.ord.k || u.ord?.k : null;
      h += `<h4>Приказ дивизии</h4>`;
      if (u.ovr) h += `<button class="btn sm st-wide" data-a="u-army">Вернуть под управление армии</button>`;
      else h += `<div class="st-dim st-small">Дивизией управляет штаб армии. Ручной приказ выведет её из плана армии.</div>`;
      h += `<div class="st-btns st-b5">${ORD_BTN.map(([a, n]) => `<button class="btn sm ${k === a ? 'gold' : ''}" data-a="u-${a}">${n}</button>`).join('')}</div>`;
    }
    return h;
  }
  kv(k, w, v, col) {
    return `<div class="st-kv"><div><span>${k}</span><small>${esc(w)}</small></div>${bar(v, col)}</div>`;
  }
  cardEnemy(u) {
    const S = this.S, now = u.sn === S.t, ago = S.t - (u.sn ?? S.t), F = S.forms[u.form], T = TYPES[u.type];
    const exact = now && u.sna === 1, rough = (v) => (exact ? f0(v) : `≈${f0(Math.max(1, Math.round(v / (v > 3000 ? 1000 : 100))) * (v > 3000 ? 1000 : 100))}`);
    const name = u.sna === 3 && !exact ? `${cap1(T.nAx || T.n)} (${NAT[u.nat].a})` : cap1(fullName(u));
    let h = this.head(this.unitIcon(u), esc(name), [esc(NAT[u.nat].n) + (F && exact ? ` • ${esc(F.n)}` : ''), now ? (exact ? 'в соприкосновении — данные точные' : u.sna === 3 ? 'авиаразведка — данные приблизительные' : 'наблюдение — данные приблизительные') : `последние данные — ${ago} ч назад`]);
    const c = unitCat(S, u);
    h += `<div class="st-cat">${catBadge(exact || u.sna === 2 ? c : 0, exact ? '' : '?')}<div><b>${exact ? esc(cap1(CAT_TXT[c])) : 'Боеспособность — оценка'}</b><small>${exact ? '' : 'точнее — в соприкосновении с противником'}</small></div></div>`;
    if (u.sna !== 3 || exact) {
      const tiles = [[rough(u.men), 'людей'], [rough(u.bay), 'штыков']];
      if (u.auth.tanks) tiles.push([rough(u.tanks), 'танков']);
      else tiles.push([rough(u.guns), 'орудий']);
      h += `<h4>Разведка</h4><div class="st-tiles">${tiles.map(([a, b]) => `<div><b>${a}</b><small>${b}</small></div>`).join('')}</div>`;
      if (exact) h += `<div class="st-note">Окопы: ${ENTW[Math.min(5, Math.round(u.ent))]} • дух ${MORW(u.mor)} • ${u.sup === 0 ? 'без снабжения' : 'снабжается'}</div>`;
    }
    h += `<div class="st-dim st-small">Чтобы атаковать: выберите свою дивизию → «Атака» → эта клетка.</div>`;
    return h;
  }
  skills(g) {
    const G = GENERALS[g];
    if (!G) return '';
    const N = ['Наступление', 'Оборона', 'Манёвр', 'Снабжение'];
    return `<div class="st-sk">${N.map((n, i) => `<div><span>${n}</span><span class="st-pips">${[1, 2, 3, 4, 5].map((k) => `<i class="${G.sk[i] >= k ? 'on' : ''}"></i>`).join('')}</span></div>`).join('')}</div>
${G.tr.length ? `<h4>Черты</h4>${G.tr.map((t) => `<div class="st-tr"><b>${esc(TRAITS[t]?.n || t)}</b><small>${esc(TRAITS[t]?.d || '')}</small></div>`).join('')}` : ''}`;
  }
  genHead(g, title, sub) {
    const G = GENERALS[g];
    return this.head(`<img class="st-por" src="${portraitURL(g, 2)}" alt="">`, title, [G ? `${esc(rankShort(G.rank))} ${esc(G.n)}` : '', sub]);
  }
  cardForm(F) {
    const S = this.S, own = F.side === S.side, Hh = E.highOf(S, F), G = GENERALS[F.gen];
    const L = S.units.filter((u) => !u.dead && u.form === F.id), seen = own || !S.fog;
    let h = this.genHead(F.gen, `${esc(F.n)} <span class="st-gold">${F.ech}</span>`, Hh ? `${esc(Hh.n)} • ${esc(cap1(surname(Hh.gen).toLowerCase()))}` : '');
    h += this.skills(F.gen);
    if (seen) {
      const n = L.length, cap = G?.cap || 8, k = Math.min(100, (100 * n) / Math.max(1, cap));
      h += `<div class="st-line"><span>Командование</span>${bar(k, n > cap ? '#e98a2f' : '#4fbf55')}<span class="st-v">${n} из ${cap} соед.</span></div>`;
      h += `<h4>Соединения</h4><div class="st-units">${L.map((u) => `<button class="st-uc" data-a="pick-u" data-v="${u.id}">${flagImg(u.nat, 18, 12)}<span>${esc(tinyU(u))}</span>${catBadge(unitCat(S, u))}</button>`).join('') || '<span class="st-dim">нет</span>'}</div>`;
    }
    if (own) {
      const d = F.dir, pd = F.pdir;
      let note = `Директива: ${esc(E.dirText(S, d))}${F.by === 'plan' ? ' (план Ставки)' : ''}`;
      if (pd) note += ` • новая директива к ${hh(pd.at)}: ${esc(E.dirText(S, pd.dir))}`;
      if (F.id === 'a62' && S.t < E.T_END) note += S.t < ICE.volga ? ' • снабжение через Волгу — только ночью, шуга; ледостав ≈ середина декабря' : ' • Волга встала: подвоз по льду';
      h += `<div class="st-note">${note}</div>`;
      if (F.plan && !F.auto && !(pd && pd.by === 'plan') && F.by !== 'plan')
        h += `<div class="st-sug2"><small>${S.side === 'SOV' ? 'Ставка' : 'Командование'} рекомендует: ${esc(F.plan.why || E.dirText(S, F.plan.dir))}</small><button class="btn sm gold" data-a="f-plan">Принять</button></div>`;
      h += `<h4>Приказ ${F.ech === 'XXX' ? 'корпусу' : 'армии'}</h4>`;
      h += `<button class="btn sm st-wide ${F.auto ? 'on' : ''}" data-a="f-auto"><i class="st-tick ${F.auto ? 'on' : ''}"></i>Выполнять план ${S.side === 'SOV' ? 'Ставки' : 'командования'} автоматически</button>`;
      h += `<div class="st-btns st-b4">${DIR_BTN.map(([a, n]) => `<button class="btn sm ${(pd ? pd.dir.k : d?.k) === a ? 'gold' : ''}" data-a="f-${a}">${n}</button>`).join('')}</div>`;
    }
    return h;
  }
  cardHigh(key) {
    const S = this.S, Hh = HIGH[key], own = Hh.side === S.side;
    let h = this.genHead(Hh.gen, `${esc(Hh.n)} <span class="st-gold">${Hh.ech}</span>`, own ? (S.side === 'SOV' ? 'фронт — директивы армиям отдаёт Ставка (вы)' : 'армия — директивы корпусам отдаёт ОКХ (вы)') : 'противник');
    h += this.skills(Hh.gen);
    const subs = Object.values(S.forms).filter((F) => F.act && (key === 'HGD' ? F.side === 'AX' && F.par !== 'IA8' : F.par === key));
    if (own || !S.fog) h += `<h4>Подчинены</h4><div class="st-units st-u2">${subs.map((F) => `<button class="st-uc" data-a="pick-f" data-v="${esc(F.id)}">${flagImg(F.nat, 18, 12)}<span>${esc(F.n)}</span></button>`).join('')}</div>`;
    return h;
  }
  // ——— приказы ———
  startTarget(k, id) {
    const S = this.S, hl = new Map();
    this.tgt = { k, id, picks: [] };
    let txt = '';
    const btns = [];
    if (k === 'u-move') txt = 'Марш: укажите клетку назначения';
    else if (k === 'u-atk') {
      const u = S.uById.get(id);
      for (const e of this.map.visibleUnits()) if (e.u.side !== S.side && !e.g && hexDist(S.G, u.c, e.c) <= 8) hl.set(e.c, '#ff3b30');
      txt = hl.size ? 'Атака: выберите цель (красные клетки)' : 'Рядом нет разведанного противника';
    } else if (k === 'u-wd' || k === 'u-rest') {
      const u = S.uById.get(id), sid = E.SID[S.side];
      for (let c = 0; c < S.G.n; c++) if (S.own[c] === sid && hexDist(S.G, u.c, c) <= 7 && !S.eadj[S.side][c] && c !== u.c) hl.set(c, '#5aa9e6');
      txt = k === 'u-wd' ? 'Отвод: укажите клетку в тылу (синие)' : 'Пополнение: укажите клетку для отдыха в тылу';
      if (k === 'u-rest' && !S.eadj[S.side][u.c]) btns.push(['tg-here', 'На месте']);
    } else if (k === 'f-atk') {
      txt = 'Наступление: укажите до 3 целей по порядку';
      btns.push(['tg-done', 'Готово']);
    } else if (k === 'f-def') {
      txt = 'Оборона: укажите рубеж или «На месте»';
      btns.push(['tg-here', 'На месте']);
    } else if (k === 'f-wd') txt = 'Отход: укажите рубеж в тылу';
    else if (k === 'f-res') txt = 'Резерв: укажите район сосредоточения';
    btns.push(['tg-x', 'Отмена']);
    this.map.hl = hl.size ? hl : null;
    this.$.hint.innerHTML = `<span>${esc(txt)}</span>${btns.map(([a, n]) => `<button class="btn sm ${a === 'tg-done' || a === 'tg-here' ? 'gold' : ''}" data-a="${a}">${n}</button>`).join('')}`;
    this.$.hint.classList.remove('hidden');
    this.root.classList.add('st-tgt');
    this.selMap();
  }
  cancelTarget(quiet) {
    if (!this.tgt) return;
    this.tgt = null;
    this.$.hint.classList.add('hidden');
    this.root.classList.remove('st-tgt');
    if (this.map) (this.map.hl = null), (this.map.dirty = 1);
    if (!quiet) this.selMap();
  }
  orderToast(name, at) {
    const S = this.S;
    if (at > S.t) this.toast(`${name}: приказ принят`, `дойдёт до войск к ${hh(at)}`);
    else this.toast(`${name}: приказ принят`);
  }
  pick(c, h) {
    const S = this.S, T = this.tgt;
    if (c < 0 && !(h && h.k === 'u')) return;
    if (T.k.startsWith('u-')) {
      const u = S.uById.get(T.id);
      if (!u || u.dead) return this.cancelTarget();
      if (T.k === 'u-atk') {
        let X = c;
        if (h && h.k === 'u') {
          const v = S.uById.get(h.id);
          if (v && v.side !== S.side) X = v.sn === S.t || !S.fog ? v.c : -1;
        }
        if (!this.map.hl || !this.map.hl.has(X)) return this.sfx('error');
        this.cancelTarget(true);
        return this.attackDlg(u, X);
      }
      if (T.k === 'u-move') {
        if (S.cellU[c].length && S.cellU[c][0].side !== S.side) return this.sfx('error'), this.toast('Там противник', 'для удара — приказ «Атака»');
        if (D.terr[c] === '0') return this.sfx('error');
        const p = E.findPath(S, u, (x) => x === c);
        if (!p) return this.sfx('error'), this.toast('Туда не пройти', 'нет пути для этой части');
        this.cancelTarget(true);
        this.sfx('move');
        return this.orderToast(shortU(u), E.setOrder(S, u, { k: 'move', to: c })), this.renderCard();
      }
      if (!this.map.hl || !this.map.hl.has(c)) return this.sfx('error');
      this.cancelTarget(true);
      this.sfx('move');
      this.orderToast(shortU(u), E.setOrder(S, u, { k: T.k === 'u-wd' ? 'wd' : 'rest', to: c }));
      return this.renderCard();
    }
    // директивы
    const F = S.forms[T.id];
    if (T.k === 'f-atk') {
      const i = T.picks.indexOf(c);
      if (i >= 0) T.picks.splice(i, 1);
      else if (T.picks.length < 3) T.picks.push(c);
      this.sfx('click');
      this.selMap();
      return;
    }
    const sid = E.SID[S.side];
    if ((T.k === 'f-wd' || T.k === 'f-res') && S.own[c] !== sid) return this.sfx('error'), this.toast('Нужна своя территория');
    this.cancelTarget(true);
    this.directive(F, { k: T.k.slice(2), obj: [], at2: c });
  }
  directive(F, d) {
    const S = this.S, at = E.setDirective(S, F.id, d, 'pl');
    this.sfx('move');
    this.toast(`${F.n}: директива отдана`, `«${E.dirText(S, d)}» — дойдёт к ${hh(at)}`);
    this.sugs = this.sugs.filter((s) => s.fid !== F.id);
    this.renderSugs();
    this.renderCard();
  }
  // ——— атака: прогноз и подтверждение ———
  attackDlg(u, X) {
    const S = this.S, cand = [u];
    for (const v of S.units)
      if (!v.dead && v !== u && v.side === S.side && v.dis <= 0 && E.adj(S, v.c, X) && !(v.ord && v.ord.k === 'atk' && v.ord.tgt === X)) cand.push(v);
    this.atk = { X, cand, ids: new Set([u.id]), prep: 2 };
    this.modal(this.atkHTML(), { cls: 'st-atk' });
  }
  atkHTML() {
    const S = this.S, A = this.atk, X = A.X, us = A.cand.filter((v) => A.ids.has(v.id));
    const defs = S.cellU[X], seenAll = defs.every((d) => !S.fog || (d.sn === S.t && d.sna === 1));
    const sig = seenAll ? 0 : 0.35;
    const est = us.length ? E.estimate(S, us, X, { prep: A.prep, sig }) : null;
    const tw = E.placeName(S, X), terr = TERR[E.terrOf(S, X)]?.n || '';
    let h = `<h3>Атака: ${esc(tw)}</h3><div class="st-dim st-small">${esc(terr)}${E.terrOf(S, X) === 3 ? ' — уличные бои' : ''}</div>`;
    h += `<h4>Оборона</h4><div class="st-units st-u2">${defs.map((d) => {
      const ex = !S.fog || (d.sn === S.t && d.sna === 1);
      return `<span class="st-uc">${flagImg(d.nat, 18, 12)}<span>${esc(ex || d.sna === 2 ? shortU(d) : 'часть противника')}</span>${catBadge(ex ? unitCat(S, d) : 0)}</span>`;
    }).join('')}</div>`;
    h += `<h4>Атакуют</h4><div class="st-units st-u2">${A.cand.map((v) => {
      const on = A.ids.has(v.id), near = E.adj(S, v.c, X);
      return `<button class="st-uc ${on ? 'on' : ''}" data-a="atk-t" data-v="${v.id}"><i class="st-ck"></i>${flagImg(v.nat, 18, 12)}<span>${esc(shortU(v))}${near ? '' : ' (выдвинется)'}</span>${catBadge(unitCat(S, v))}</button>`;
    }).join('')}</div>`;
    h += `<h4>Артподготовка</h4><div class="st-seg panel">${[[2, '2 ч — быстро'], [6, '6 ч — тщательно']].map(([p, n]) => `<button data-a="atk-p" data-v="${p}" class="${A.prep === p ? 'on' : ''}">${n}</button>`).join('')}</div>`;
    if (est) {
      const P = est.p, cols = ['#d6453a', '#e98a2f', '#9cc83b', '#3fae49'];
      h += `<h4>Прогноз</h4><div class="st-odds">${P.map((p, i) => `<i style="width:${Math.max(0, p * 100)}%;background:${cols[i]}" title="${OUT_S[i]}"></i>`).join('')}</div>
<div class="st-oddl">${P.map((p, i) => `<span><i style="background:${cols[i]}"></i>${OUT_S[i]} ${Math.round(p * 100)}%</span>`).join('')}</div>
<div class="st-note">Соотношение сил ≈ ${f1(est.R)} (${f1(est.lo)}–${f1(est.hi)}) • наши потери ≈ ${f0(est.la)}${est.ta ? `, танков ≈ ${f0(est.ta)}` : ''} • противника ≈ ${f0(est.ld)}${sig ? ' • <span class="st-warn">мало разведданных — оценка неточна</span>' : ''}</div>`;
      const W = [];
      if (us.some((v) => unitCat(S, v) >= 4)) W.push('части IV–V категории — риск разгрома');
      if (us.some((v) => v.amm < 30)) W.push('мало боеприпасов');
      if (us.some((v) => MECH(v) && v.fuel < 15)) W.push('мало горючего');
      if (us.some((v) => E.riverK(S, v.c, X) < 1)) W.push('удар через реку — слабее');
      if (!isDay(S.t + A.prep + 1)) W.push('атака придётся на ночь');
      if (W.length) h += `<div class="st-warn st-small">${W.map(esc).join(' • ')}</div>`;
    }
    h += `<div class="st-btns st-b2"><button class="btn gold" data-a="atk-go" ${us.length ? '' : 'disabled'}>Атаковать</button><button class="btn" data-a="mclose">Отмена</button></div>`;
    return h;
  }
  atkGo() {
    const S = this.S, A = this.atk;
    let at = S.t;
    for (const v of A.cand) if (A.ids.has(v.id)) at = Math.max(at, E.setOrder(S, v, { k: 'atk', tgt: A.X, prep: A.prep }));
    this.closeModal();
    this.sfx('move');
    this.toast(`Атака: ${E.placeName(S, A.X)}`, `${A.ids.size} ${plural(A.ids.size, 'часть', 'части', 'частей')} • приказ дойдёт к ${hh(at)}`);
    this.atk = null;
    this.renderCard();
  }
  // ——— модальные окна ———
  modal(html, o = {}) {
    const M = this.$.modal;
    M.innerHTML = `<div class="st-dlg panel ${o.cls || ''}">${html}</div>`;
    M.classList.remove('hidden');
    this.modalLock = !!o.lock;
    M.onclick = (e) => {
      if (e.target === M && !this.modalLock) this.closeModal();
    };
  }
  closeModal(quiet) {
    const M = this.$.modal;
    if (M.classList.contains('hidden')) return;
    M.classList.add('hidden');
    M.innerHTML = '';
    this.modalLock = false;
    const after = this.afterModal;
    this.afterModal = null;
    if (!quiet && after) after();
  }
  nextModal() {
    if (!this.$.modal.classList.contains('hidden')) return;
    const m = this.modalQ[0];
    if (!m) return;
    const S = this.S;
    if (m.k === 'end') {
      this.modalQ.shift();
      return this.results();
    }
    if (m.k === 'dec') {
      const done = S.decDone && S.decDone[m.dec] > 0;
      if (done) return this.modalQ.shift(), this.nextModal();
      this.sfx('tele');
      this.modal(`<div class="st-mk">Решение</div><h3>${esc(m.title)}</h3><p>${esc(m.txt)}</p><div class="st-opts">${m.opts.map((o, i) => `<button class="btn ${i ? '' : 'gold'}" data-a="dec" data-v="${i}"><b>${esc(o.t)}</b><small>${esc(o.d)}</small></button>`).join('')}</div>`, { lock: 1, cls: 'st-big' });
      return;
    }
    this.sfx(m.big ? 'win' : 'tele');
    this.modal(`<div class="st-mk">${esc(E.dateLabel(m.t ?? S.t))}</div><h3 class="${m.big ? 'st-bigt' : ''}">${esc(m.title)}</h3>${m.txt ? `<p>${esc(m.txt)}</p>` : ''}<div class="st-btns st-b1"><button class="btn gold" data-a="ev-ok">Продолжить</button></div>`, { cls: m.big ? 'st-big' : '' });
    this.afterModal = () => {
      this.modalQ.shift();
      this.saveGame();
      this.nextModal();
    };
  }
  // ——— итоги ———
  results() {
    const S = this.S, sc = E.score(S), O = S.over || { why: 'time', stars: 0, vp: sc.vp }, st = O.stars || 0;
    const win = S.side === 'SOV' ? st >= 2 : st >= 2;
    this.sfx(st >= 2 ? 'win' : st === 0 ? 'lose' : 'turn');
    const why = O.why === 'pocket' ? `Окружённая группировка ликвидирована ${E.dateLabel(S.flags.elim ?? S.t, false)}.` : '2 февраля 1943 года — срок операции истёк.';
    const lines = [
      ['Очки победы (счёт СССР)', `${f1(sc.vp)} — исторический итог ≈ ${E.REF_VP}`],
      ['Города', sc.towns.map((t) => t[0]).join(', ') || '—'],
      ['Сталинград', `${sc.city} из ${sc.cityN} районов у СССР`],
      ['Уничтоженные соединения', f1(sc.units)],
      ['Пленные', `взято СССР ${f0(S.st.pris.SOV)} • Осью ${f0(S.st.pris.AX)}`],
      ['Потери', `СССР ${f0(S.st.lossM.SOV)} чел., ${f0(S.st.lossT.SOV)} танков • Ось ${f0(S.st.lossM.AX)} чел., ${f0(S.st.lossT.AX)} танков`],
    ];
    if (S.flags.brk) lines.push(['Воздушный мост', 'не было — 6-я армия пошла на прорыв']);
    else if (S.airDays) lines.push(['Воздушный мост', `${f0(S.airTot)} т за ${S.airDays} сут — в среднем ${f0(S.airTot / S.airDays)} т/сут`]);
    // 0 звёзд, но главная задача решена (котёл ликвидирован / кольцо разорвано) — не «поражение»
    const done = S.side === 'SOV' ? !!S.flags.elim : !!S.flags.relieved && !S.flags.elim;
    this.modal(`<div class="st-mk">${esc(SIDE_N[S.side])} • ${DIFF[S.diff].toLowerCase()}</div><h3 class="st-bigt">${st >= 3 ? 'Блестящая победа' : st === 2 ? 'Победа' : st === 1 ? 'Частичный успех' : done ? 'Скромный итог' : 'Поражение'}</h3>
<div class="st-stars">${[1, 2, 3].map((i) => `<i class="${st >= i ? 'on' : ''}">${STAR}</i>`).join('')}</div><p>${esc(why)}</p>
<div class="st-tab">${lines.map(([a, b]) => `<div><span>${esc(a)}</span><b>${esc(b)}</b></div>`).join('')}</div>
<div class="st-btns st-b2 st-rb"><button class="btn gold" data-a="r-new">Новая операция</button><button class="btn" data-a="mclose">На карту</button><button class="btn" data-a="exit">В меню</button></div>`, { cls: 'st-big' });
    void win;
  }
  // ——— меню, журнал, очки, настройки, справка ———
  gameMenu() {
    if (!this.S) return;
    this.modal(`<h3>Меню</h3><div class="st-menu">
<button class="btn" data-a="journal">Журнал боевых действий</button>
<button class="btn" data-a="score">Цели и очки</button>
<button class="btn" data-a="settings">Ход и скорость</button>
<button class="btn" data-a="help">Как играть</button>
<button class="btn" data-a="hub">Сохранить и выйти к выбору операции</button>
<button class="btn" data-a="exit">Сохранить и выйти в главное меню</button>
<button class="btn gold" data-a="mclose">Вернуться к игре</button></div>`);
  }
  journal() {
    const S = this.S, side = S.side;
    const L = S.log.filter((e) => e.s === '*' || e.s === side).slice(-150).reverse();
    let day = -1, h = '';
    for (const e of L) {
      const d = Math.floor(e.t / 24);
      if (d !== day) (day = d), (h += `<div class="st-jd">${esc(E.dateLabel(e.t, false))}</div>`);
      h += `<button class="st-je ${e.k === 'bt' ? (e.out >= 2) === (e.s === side) ? 'good' : 'bad' : e.k === 'kill' ? 'bad' : ''}" data-a="j-go" data-v="${e.c ?? -1}"><i>${hh(e.t)}</i><span>${esc(e.x)}</span></button>`;
    }
    this.modal(`<h3>Журнал боевых действий</h3><div class="st-jl">${h || '<span class="st-dim">Пока записей нет.</span>'}</div><div class="st-btns st-b1"><button class="btn gold" data-a="mclose">Закрыть</button></div>`, { cls: 'st-tall' });
  }
  scoreDlg() {
    const S = this.S, sc = E.score(S), side = S.side, R = E.REF_VP;
    const th = side === 'SOV' ? [[1, R * 0.75], [2, R * 0.95], [3, R * 1.15]].map(([s, v]) => `<span class="st-st">${STAR.repeat(s)}</span> от ${f0(v)}`) : [[1, R * 0.92], [2, R * 0.75], [3, R * 0.55]].map(([s, v]) => `<span class="st-st">${STAR.repeat(s)}</span> до ${f0(v)}`);
    const towns = S.vpTowns.map((t) => `<div><span>${esc(t.n)}</span><b class="${S.own[t.c] === 1 ? 'st-red' : ''}">${S.own[t.c] === 1 ? 'СССР' : 'Ось'} • ${t.vp}</b></div>`).join('');
    const left = Math.max(0, Math.ceil((E.T_END - S.t) / 24));
    const P = S.pk, A = S.air;
    let pk = '';
    if (P && P.on) pk = `<div><span>Котёл</span><b>${f0(P.men / 1000)} тыс. чел. • с ${esc(E.dateLabel(S.flags.pocket, false))}</b></div>`;
    if (A) pk += `<div><span>Воздушный мост</span><b>${f0(A.del)} из ${f0(A.need)} т (${esc(A.fld)}${A.bases.length ? `; базы: ${esc(A.bases.join(', '))}` : '; базы потеряны'})</b></div>`;
    this.modal(`<h3>Цели и очки</h3><p class="st-small">${side === 'SOV' ? 'Окружить и уничтожить 6-ю армию, удержать Сталинград, освободить города. Очки СССР растут за города, районы Сталинграда и уничтоженные соединения противника.' : 'Не допустить окружения или удержать котёл до деблокады; сохранить аэродромы Тацинская и Морозовск. Чем меньше очков у СССР — тем лучше для Оси.'}</p>
<div class="st-tab"><div><span>Очки СССР сейчас</span><b>${f1(sc.vp)}</b></div><div><span>Звёзды ${side === 'SOV' ? 'СССР' : 'Оси'}</span><b>${th.join(' • ')}</b></div>
<div><span>Сталинград</span><b>${sc.city} из ${sc.cityN} районов • ${f1(sc.cityVP)}</b></div><div><span>Уничтоженные соединения</span><b>${f1(sc.units)}</b></div>${pk}
<div><span>До конца операции</span><b>${left} ${plural(left, 'день', 'дня', 'дней')}</b></div></div><h4>Города</h4><div class="st-tab">${towns}</div>
<div class="st-btns st-b1"><button class="btn gold" data-a="mclose">Закрыть</button></div>`, { cls: 'st-tall' });
  }
  settings() {
    const o = this.opt;
    const seg = (a, list, cur) => `<div class="st-seg panel">${list.map(([v, n]) => `<button data-a="${a}" data-v="${v}" class="${String(v) === String(cur) ? 'on' : ''}">${n}</button>`).join('')}</div>`;
    this.modal(`<h3>Ход и скорость</h3><h4>Длина хода</h4>${seg('s-len', LENS.map((l) => [l, `${l} ч`]), o.len)}<h4>Скорость показа</h4>${seg('s-spd', SPD.map((s, i) => [i, s.n]), o.spd)}
<p class="st-small st-dim">Движок считает каждый час. Ход сам останавливается на важных событиях: кольцо, решения, рассечение котла, конец операции.</p><div class="st-btns st-b1"><button class="btn gold" data-a="mclose">Готово</button></div>`);
  }
  help() {
    this.modal(`<h3>Как играть</h3><div class="st-help">
<p><b>Роль.</b> Вы — представитель ${this.S?.side === 'AX' ? 'ОКХ: директивы получают корпуса' : 'Ставки: директивы получают армии'}. Штаб сам распределяет дивизии в своей полосе. Пока армия выполняет план Ставки, она действует как в истории; ваша директива отменяет план — новые предложения придут как «Директива Ставки» с кнопкой «Принять».</p>
<p><b>Ход.</b> «Ход» прокручивает сутки (можно 12 или 48 ч). Время идёт по часам: марш, бои, снабжение. Важные события останавливают ход — затем «Далее ▶».</p>
<p><b>Приказы доходят не сразу</b>: армии — через 2–3 ч, дивизии — через 1–2 ч (немецкие штабы быстрее; черты генералов меняют сроки).</p>
<p><b>Карта.</b> «Армии» — штабы с портретами, дивизии точками; «Дивизии» — фишки. Уровень меняется и зумом. На фишке: номер, флаг, знак величины (XX — дивизия, XXX — корпус, X — бригада), цвет полосы — боеспособность I–V. Красная метка — нет снабжения.</p>
<p><b>Атака.</b> Выберите дивизию → «Атака» → красная клетка → прогноз → «Атаковать». Тщательная артподготовка (6 ч) сильнее, но дольше. Удар через реку и ночью слабее. В клетке — до 3 дивизий (бригада — ½).</p>
<p><b>Котёл.</b> Кольцо держится, пока окружённые не соприкоснутся со своими войсками снаружи: вплотную или через свободную клетку, которую не прикрывают советские части. Если такой коридор продержится 12 часов, кольцо прорвано. Окружённые войска тают без снабжения; Оси помогает воздушный мост с аэродромов Тацинская и Морозовск (на Питомник и Гумрак). Лёд: Дон — пехота с 1.12, техника с 12.12; Волга — с 17.12.</p>
<p><b>Очки.</b> Города, районы Сталинграда и уничтоженные соединения. Звёзды считаются от исторического итога (≈${E.REF_VP} очков СССР).</p>
<p><b>Туман войны.</b> Противник виден рядом с вашими войсками и днём по авиаразведке; полупрозрачные фишки — последние данные разведки.</p></div>
<div class="st-btns st-b1"><button class="btn gold" data-a="mclose">Понятно</button></div>`, { cls: 'st-tall' });
  }
  cats() {
    this.modal(`<h3>Боеспособность</h3><p class="st-small">Как в германских донесениях о состоянии войск (Kampfwert): итог штыков и огня, подготовки и опыта, духа, усталости, управления и снабжения.</p>
<div class="st-tab">${[1, 2, 3, 4, 5].map((c) => `<div><span>${catBadge(c)}</span><b>${esc(cap1(CAT_TXT[c]))}</b></div>`).join('')}</div><div class="st-btns st-b1"><button class="btn gold" data-a="mclose">Закрыть</button></div>`);
  }
  // ——— кнопки ———
  onClick(e) {
    const b = e.target.closest('[data-a]');
    if (!b || !this.root.contains(b) || b.disabled) return;
    const a = b.dataset.a, v = b.dataset.v, S = this.S;
    const u = this.selU != null && S ? S.uById.get(this.selU) : null, F = this.selF && S ? S.forms[this.selF] : null;
    if (a !== 'turn') this.sfx('click');
    switch (a) {
      // хаб
      case 'o-side': this.opt.side = v; this.saveOpt(); return this.showHub();
      case 'o-diff': this.opt.diff = +v; this.saveOpt(); return this.showHub();
      case 'o-hist': this.opt.hist = v === '1'; this.saveOpt(); return this.showHub();
      case 'o-fog': this.opt.fog = v === '1'; this.saveOpt(); return this.showHub();
      case 'o-len': this.opt.len = +v; this.saveOpt(); return this.showHub();
      case 'new':
        if (readMeta() && !readMeta().over && !b.dataset.ok) {
          b.dataset.ok = 1;
          b.innerHTML = 'Начать заново?<small>текущая операция будет потеряна — нажмите ещё раз</small>';
          return;
        }
        return this.startNew();
      case 'cont': return this.cont();
      case 'exit': this.closeModal(true); return this.exit();
      case 'hub': this.closeModal(true); this.saveGame(); this.stopReq = 1; return this.showHub();
      case 'help': return this.help();
      // верхняя панель
      case 'menu': return this.gameMenu();
      case 'turn': return this.turn();
      case 'lod': return this.map.setLod(v);
      case 'journal': return this.journal();
      case 'score': return this.scoreDlg();
      case 'settings': return this.settings();
      case 'cats': return this.cats();
      case 's-len': this.opt.len = +v; this.saveOpt(); return this.settings();
      case 's-spd': this.opt.spd = +v; this.saveOpt(); return this.settings();
      case 'mclose': case 'ev-ok': return this.closeModal();
      case 'close': return this.clearSel();
      case 'j-go': {
        const c = +v;
        this.closeModal();
        if (c >= 0) this.map.reveal(c, Math.max(this.map.z, 2.6), 380, true), this.map.addFx({ k: 'ping', c, ms: 1000 });
        return;
      }
      // рекомендации
      case 'sug-ok': {
        const G = S.forms[v];
        const at = E.acceptPlan(S, v);
        this.sugs = this.sugs.filter((s) => s.fid !== v);
        this.renderSugs();
        if (G && at >= 0) this.toast(`${G.n}: директива принята`, `дойдёт к ${hh(at)}`);
        return this.refreshCard();
      }
      case 'sug-x': this.sugs = this.sugs.filter((s) => s.fid !== v); return this.renderSugs();
      case 'sug-show': {
        const G = S.forms[v];
        if (G) this.selForm(v), this.map.reveal(G.hq, null, 380, true);
        return;
      }
      // карточки
      case 'pick-u': {
        const w = S.uById.get(+v);
        if (w) this.selUnit(w.id), this.map.reveal(w.c, Math.max(this.map.z, 2.4), 380, true);
        return;
      }
      case 'pick-f': return this.selForm(v);
      case 'u-move': case 'u-atk': case 'u-wd': return u && this.startTarget(a, u.id);
      case 'u-rest': return u && (S.eadj[S.side][u.c] ? this.startTarget(a, u.id) : (this.orderToast(shortU(u), E.setOrder(S, u, { k: 'rest', to: null })), this.renderCard()));
      case 'u-hold': return u && (this.orderToast(shortU(u), E.setOrder(S, u, { k: 'hold' })), this.renderCard());
      case 'u-army': return u && (E.setOrder(S, u, { k: 'army' }), this.toast(`${shortU(u)}: снова в плане армии`), this.renderCard());
      case 'f-atk': case 'f-def': case 'f-wd': case 'f-res': return F && this.startTarget(a, F.id);
      case 'f-plan': {
        const at = F ? E.acceptPlan(S, F.id) : -1;
        if (at >= 0) this.toast(`${F.n}: директива принята`, `дойдёт к ${hh(at)}`);
        this.sugs = this.sugs.filter((s) => s.fid !== F?.id);
        this.renderSugs();
        return this.renderCard();
      }
      case 'f-auto': if (F) F.auto = F.auto ? 0 : 1; return this.renderCard();
      // выбор цели
      case 'tg-x': return this.cancelTarget();
      case 'tg-here': {
        const T = this.tgt;
        if (!T) return;
        this.cancelTarget(true);
        if (T.k === 'f-def') return this.directive(S.forms[T.id], { k: 'def', obj: [], at2: null });
        const w = S.uById.get(T.id);
        if (w) this.orderToast(shortU(w), E.setOrder(S, w, { k: 'rest', to: null })), this.renderCard();
        return;
      }
      case 'tg-done': {
        const T = this.tgt;
        if (!T || !T.picks.length) return this.sfx('error'), this.toast('Укажите хотя бы одну цель');
        const picks = T.picks.slice();
        this.cancelTarget(true);
        return this.directive(S.forms[T.id], { k: 'atk', obj: picks });
      }
      // атака
      case 'atk-t': {
        const id = +v, A = this.atk;
        if (!A) return;
        A.ids.has(id) ? A.ids.delete(id) : A.ids.add(id);
        return this.modal(this.atkHTML(), { cls: 'st-atk' });
      }
      case 'atk-p': if (this.atk) (this.atk.prep = +v), this.modal(this.atkHTML(), { cls: 'st-atk' }); return;
      case 'atk-go': return this.atkGo();
      // решения и итоги
      case 'dec': {
        const m = this.modalQ[0];
        if (m && m.k === 'dec') {
          E.decide(S, m.dec, +v);
          this.toast('Решение принято', m.opts[+v]?.t || '');
        }
        this.modalQ.shift();
        this.modalLock = false;
        this.closeModal(true);
        this.saveGame();
        return this.nextModal();
      }
      case 'r-new': this.closeModal(true); return this.showHub();
    }
  }
}
// короткое имя части: «13-я гв. сд»
function shortU(u) {
  return u.name;
}
// совсем короткое — для сетки соединений: «13 гв», «26 тк», «124 бр»
const TINY = { bde: 'бр', tbde: 'тбр', tk: 'тк', mk: 'мк', cc: 'кк', cav: 'кд', pz: 'тд', mot: 'мд', lw: 'апд' };
function tinyU(u) {
  const n = u.name || '', m = n.match(/^(\d+)-[яйе]\s+(.*)$/);
  if (!m) return n.replace(/[«»]/g, '');
  let suf = TINY[u.type] || (/егерск/.test(m[2]) ? 'ег' : '');
  if (u.type === 'bde' && /\bск\b|^ск/.test(m[2])) suf = 'ск';
  return [m[1], /гв\./.test(m[2]) ? 'гв' : '', suf].filter(Boolean).join(' ');
}
// клетка, откуда часть пойдёт в атаку: путь до соседней с целью клетки
function adjTo(S, u, X) {
  if (E.adj(S, u.c, X)) return [u.c];
  const p = E.findPath(S, u, (c) => E.adj(S, c, X));
  return p ? [u.c, ...p] : [u.c];
}
