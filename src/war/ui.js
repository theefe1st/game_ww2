// «Фронт 1941–1945» (v0.9): интерфейс кампании. Экран выбора стороны (СССР — Ставка ВГК, Германия — ОКХ) и
// сложности; верхняя панель (дата и погода, мораль сторон, экономика, «Решение»), колонка «Приказы», «Экономика»,
// «Сводка», переключатель «Армии/Дивизии» (и по масштабу); карточки армии, дивизии и гекса (слева в альбомной,
// снизу в портретной раскладке); ручные марши и удары с прогнозом боя; «Неделя» (до 7 суток с остановкой на
// важном) и «Ход → дата»; сгруппированные сводки; решения; автосохранение. Хост (game.js) даёт sfx и exit().
import EU from '../data/eu41.json';
import './war.css';
import { decodeEU, TERR_N } from './map41.js';
import * as E from './engine.js';
import * as R from './rules.js';
import { ORDERS, planOp, armyUnits } from './ai.js';
import { LINES, tplNow, formDiv, hqHex, strength, divCount, divCap, llRoutes } from './eco.js';
import { evByK } from './events.js';
import { WarMap, LOD_HEX } from './map.js';
import { warCounter, flagURL } from './art.js';
import { POR_NAT, TRAITS, ALLG } from './gens41.js';
import { portraitURLP } from '../staff/portraits.js';
import { spr, toCanvas } from '../barb/art.js';
import { REGIONS } from '../europe/regions.js';

const KEY = E.SAVE_KEY, KEY_META = 'wf_war_meta', KEY_OPT = 'wf_war_opt';
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const f0 = (v) => Math.round(v).toLocaleString('ru-RU');
const f1 = (v) => (Math.round(v * 10) / 10).toLocaleString('ru-RU');
const tys = (v) => (Math.abs(v) >= 1e6 ? `${f1(v / 1e6)} млн` : `${f0(v / 1000)} тыс.`);
const sgn = (v) => (v > 0 ? '+' : v < 0 ? '−' : '') + f1(Math.abs(v));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const raf = () => new Promise((r) => requestAnimationFrame(() => r()));
const plural = (n, a, b, c) => {
  const k = Math.abs(n) % 100, j = k % 10;
  return k > 10 && k < 20 ? c : j === 1 ? a : j >= 2 && j <= 4 ? b : c;
};
const divN = (n) => `${n} ${plural(n, 'дивизия', 'дивизии', 'дивизий')}`;
const dmy = (d) => R.fmtDate(d).replace(/ \d{4}$/, '');
const SIDE_HQ = { SOV: { n: 'Ставка ВГК', g: 'zhukov', who: 'Г. К. Жуков' }, GER: { n: 'ОКХ', g: 'manstein', who: 'Э. фон Манштейн' } };
const ORD_IC = { def: '■', atk: '▲', ret: '▼', res: '◆', man: 'Р' };
const NATP = { ROM: 'р', HUN: 'в', ITA: 'и', FIN: 'ф', SVK: 'сл' };
const STOPN = { city: 'потерян крупный город', pocket: 'наши войска окружены', decision: 'нужно решение' };

// ——— пиксельные значки 11×11 ———
const ICON = {
  flag: ['#..........', '#########..', '#########..', '#########..', '#########..', '#..........', '#..........', '#..........', '#..........', '#..........', '#..........'],
  gear: ['....###....', '.#.#####.#.', '..#######..', '.###...###.', '###.....###', '###.....###', '###.....###', '.###...###.', '..#######..', '.#.#####.#.', '....###....'],
  doc: ['.########..', '.#......##.', '.#.####.#.#', '.#......###', '.#.#####..#', '.#........#', '.#.#####..#', '.#........#', '.#.####...#', '.#........#', '.##########'],
  army: ['...........', '#####.#####', '#...#.#...#', '#.#.#.#.#.#', '#...#.#...#', '#####.#####', '...........', '#####.#####', '#.#.#.#...#', '#...#.#.#.#', '#####.#####'],
  div: ['###########', '#.........#', '#.#.....#.#', '#..#...#..#', '#...#.#...#', '#....#....#', '#...#.#...#', '#..#...#..#', '#.#.....#.#', '#.........#', '###########'],
  star: ['.....#.....', '.....#.....', '....###....', '###########', '.#########.', '..#######..', '..#######..', '.####.####.', '.###...###.', '.#.......#.', '...........'],
  undo: ['....#......', '...##......', '..#######..', '.#########.', '..##.....##', '...#......#', '..........#', '..........#', '.........##', '....######.', '...........'],
  rail: ['.#.......#.', '###########', '.#.......#.', '.#.......#.', '###########', '.#.......#.', '.#.......#.', '###########', '.#.......#.', '.#.......#.', '###########'],
};
const icURL = new Map();
function ic(k, col = '#f1e7c8') {
  const key = k + col;
  let u = icURL.get(key);
  if (!u) (u = toCanvas(spr(ICON[k], { '#': col })).toDataURL()), icURL.set(key, u);
  return u;
}
const icon = (k, col, cls = '') => `<img class="wr-ic ${cls}" src="${ic(k, col)}" alt="">`;
const stars = (n, cls = '') => `<span class="wr-stars ${cls}">${[0, 1, 2].map((i) => `<img src="${ic('star', i < n ? '#ffd34a' : '#4d4536')}" alt="">`).join('')}</span>`;
const porG = (k, z = 3) => {
  const G = ALLG[k];
  return G ? portraitURLP('w:' + k, G.por, POR_NAT[G.nat] || 'GER', z) : '';
};
const cURL = new Map();
function cImg(S, u, side) {
  const c = warCounter(u, { cmd: u.side === side, k: u.org / 100, cut: u.oos > 2, enc: false, lv: u.xp >= 70 ? 3 : u.xp >= 45 ? 2 : u.xp >= 25 ? 1 : 0, done: false });
  let s = cURL.get(c);
  if (!s) {
    if (cURL.size > 400) cURL.clear();
    (s = c.toDataURL()), cURL.set(c, s);
  }
  return s;
}
export function armyLab(H) {
  if (!H) return '';
  if (H.lv <= 1 && H.lab) return H.lab.filter(Boolean).join(' ');
  const n = H.n || '', num = H.num || '';
  const suf = /танков\S* групп/i.test(n) ? 'ТГр' : /танков/i.test(n) ? 'ТА' : /ударн/i.test(n) ? 'УА' : /гвард/i.test(n) ? 'ГвА' : /корпус/i.test(n) ? 'К' : /оператив|групп/i.test(n) ? 'Гр' : 'А';
  return num ? `${NATP[H.nat] || ''}${num} ${suf}` : n.split(' ').slice(0, 2).join(' ');
}

function loadOpt() {
  try {
    const o = JSON.parse(localStorage.getItem(KEY_OPT) || '{}');
    return { side: o.side === 'GER' ? 'GER' : 'SOV', diff: o.diff >= 0 && o.diff <= 2 ? o.diff : 1, all: o.all ? 1 : 0, seen: o.seen || 0 };
  } catch {
    return { side: 'SOV', diff: 1, all: 0, seen: 0 };
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
const metaTxt = (m) => `${m.side === 'GER' ? 'Германия' : 'СССР'} · ${m.over ? 'война окончена' : R.fmtDate(m.day)} · ${R.DIFF[m.diff].toLowerCase()}`;

const TPL = `
<canvas class="wr-cv" data-r="cv"></canvas>
<div class="wr-top" data-r="top">
  <button class="btn icon wr-bmenu" data-a="menu" aria-label="Меню"><i class="wr-burger"></i></button>
  <button class="panel wr-chip wr-date" data-a="sum" data-r="date"></button>
  <button class="panel wr-chip wr-mor" data-a="sum" data-r="mor"></button>
  <button class="panel wr-chip wr-eco" data-a="eco" data-r="eco"></button>
  <button class="btn gold wr-dec hidden" data-a="dec" data-r="dec">Решение</button>
</div>
<div class="wr-rail" data-r="rail">
  <button class="btn wr-rb" data-a="orders">${icon('flag')}<span>Приказы</span></button>
  <button class="btn wr-rb" data-a="eco">${icon('gear')}<span>Экономика</span></button>
  <button class="btn wr-rb" data-a="sum">${icon('doc')}<span>Сводка</span></button>
  <button class="btn wr-rb" data-a="lod" data-r="lod"></button>
</div>
<div class="wr-bot" data-r="bot">
  <button class="btn wr-week" data-a="week" data-r="week"><span>Неделя</span><small>до 7 суток</small></button>
  <button class="btn gold wr-end" data-a="end" data-r="end"><span>Ход</span><small></small></button>
</div>
<div class="wr-card panel hidden" data-r="card"></div>
<div class="wr-busy panel hidden" data-r="busy"></div>
<div class="wr-toasts" data-r="toasts"></div>
<div class="wr-modal hidden" data-r="modal"></div>
<div class="wr-hub hidden" data-r="hub"></div>`;

export class WarUI {
  constructor(root, host = {}) {
    this.root = root;
    this.h = host;
    this.opt = loadOpt();
    root.innerHTML = TPL;
    this.$ = {};
    for (const e of root.querySelectorAll('[data-r]')) this.$[e.dataset.r] = e;
    root.addEventListener('click', (e) => this.onClick(e));
    root.addEventListener('change', (e) => this.onChange(e));
    this.S = null;
    this.sess = 0;
    this.inGame = 0;
    this.busy = 0;
    this.sel = null; // выбранная дивизия
    this.selA = null; // выбранная армия
    this.info = -1; // гекс в карточке
    this.atk = null; // { tgt }
    this.mode = ''; // '' | 'tgt' | 'rail'
    this.ordA = null;
    this.ordK = '';
    this.seen = 0;
    this.onResize = () => this.layout();
    window.addEventListener('resize', this.onResize);
    if (typeof window !== 'undefined') window.__war = this;
  }
  static menuLabel() {
    const m = readMeta();
    return m ? metaTxt(m) : 'Восточный фронт · 22 июня 1941 — май 1945';
  }
  sfx(k) {
    try {
      this.h.sfx?.[k]?.();
    } catch {}
  }
  // ——— жизненный цикл ———
  open() {
    if (!this.M) {
      this.M = decodeEU(EU);
      this.map = new WarMap(this.$.cv, this.M, {
        onTap: (h) => this.onTap(h),
        onLong: (h) => this.onLong(h),
        onHQ: (A) => this.onHQ(A),
        onZoom: () => this.onZoom(),
      });
    }
    this.map.pause(false);
    this.layout();
    this.showHub();
  }
  close() {
    if (this.S && this.inGame && !this.busy) this.saveGame();
    this.sess++;
    this.busy = 0;
    this.inGame = 0;
    this.S = null;
    this.map?.pause(true);
    this.closeModal(true);
    this.busyOff();
  }
  back() {
    if (!this.$.modal.classList.contains('hidden')) {
      if (this.modalLock) return true;
      this.sfx('click');
      this.closeModal();
      return true;
    }
    if (!this.$.hub.classList.contains('hidden')) {
      this.h.exit?.();
      return true;
    }
    if (this.busy) return (this.stopReq = 1), true;
    if (this.mode) return this.setMode(''), true;
    if (this.sel || this.selA || this.info >= 0) return this.clearSel(), true;
    this.gameMenu();
    return true;
  }
  layout() {
    const W = this.root.clientWidth, H = this.root.clientHeight;
    this.root.classList.toggle('wr-land', W > H);
    this.root.classList.toggle('wr-narrow', W < 620);
    this.root.classList.toggle('wr-short', H < 470);
    if (this.S && this.inGame) this.hud();
    requestAnimationFrame(() => this.inset());
  }
  inset() {
    if (!this.map) return;
    if (!this.inGame) return this.map.setInset(0, 0, 0, 0);
    const st = this.root.style, sv = (k, v) => st.getPropertyValue(k) !== v && st.setProperty(k, v);
    const R0 = this.root.getBoundingClientRect(), top = this.$.top.getBoundingClientRect(), rail = this.$.rail.getBoundingClientRect();
    const land = this.root.classList.contains('wr-land'), card = this.$.card, cv = !card.classList.contains('hidden');
    sv('--toph', `${Math.round(top.bottom - R0.top)}px`);
    sv('--railb', `${Math.round(rail.bottom - R0.top)}px`);
    let l = 0, t = Math.round(top.bottom - R0.top), r = 0, b = 0;
    if (land) {
      r = Math.max(0, Math.round(R0.right - rail.left));
      if (cv) l = Math.max(0, Math.round(card.getBoundingClientRect().right - R0.left));
      sv('--cardh', '0px');
      sv('--cardw', `${l}px`);
      sv('--railw', `${r}px`);
    } else {
      const ch = cv ? Math.round(card.getBoundingClientRect().height + 6) : 0;
      sv('--cardh', `${ch}px`);
      sv('--cardw', '0px');
      sv('--railw', '0px');
      t = Math.round(rail.bottom - R0.top);
      b = Math.max(0, Math.round(R0.bottom - this.$.bot.getBoundingClientRect().top));
    }
    this.map.setInset(l, t, r, b);
  }
  // ——— экран выбора ———
  showHub() {
    this.inGame = 0;
    this.sess++;
    this.S = null;
    this.busy = 0;
    this.clearSel(true);
    this.mode = '';
    this.root.classList.add('wr-hubmode');
    this.busyOff();
    this.$.toasts.innerHTML = '';
    const m = readMeta(), o = this.opt;
    const side = (s) => {
      const q = SIDE_HQ[s], g = this.genP(q.g);
      return `<button class="wr-side panel ${o.side === s ? 'on' : ''}" data-a="o-side" data-v="${s}"><img class="wr-por" src="${g}" alt="">
<span class="wr-sw"><b class="wr-nat"><img class="wr-flag" src="${flagURL(s)}" alt="">${s === 'GER' ? 'Германия' : 'СССР'}</b><span class="wr-sn">${q.n}</span><small>${q.who}</small>
<small class="wr-dim">${s === 'SOV' ? 'Выстоять в 1941-м, отстоять Москву, Ленинград и Сталинград — и взять Берлин до 9 мая 1945 г.' : 'Разгромить Красную армию, взять Москву — или удержать Берлин до 31 мая 1945 г.'}</small></span></button>`;
    };
    this.$.hub.innerHTML = `<div class="wr-hubw">
<div class="wr-hh"><div class="wr-ht">Фронт 1941–1945</div><div class="wr-hs">Восточный фронт целиком · 22 июня 1941 — май 1945 · день за ходом</div></div>
<div class="wr-hcols"><div><h4>Сторона</h4><div class="wr-sides">${side('SOV')}${side('GER')}</div></div>
<div>${m ? `<button class="btn gold wr-wide wr-hcont" data-a="cont">Продолжить<small>${esc(metaTxt(m))}</small></button>` : ''}
<h4>Сложность</h4><div class="wr-seg panel">${R.DIFF.map((n, i) => `<button data-a="o-diff" data-v="${i}" class="${o.diff === i ? 'on' : ''}">${n}</button>`).join('')}</div>
<p class="wr-sm wr-dim">${['Ваши войска бьют на 15 % сильнее, заводы дают на 12 % больше.', 'Исторический баланс сил.', 'Противник на 8 % сильнее в бою и на 5 % — в производстве.'][o.diff]}</p>
<button class="btn ${m ? '' : 'gold'} wr-wide" data-a="new">Новая война<small>${o.side === 'GER' ? 'Германия, ОКХ' : 'СССР, Ставка ВГК'} · ${R.DIFF[o.diff].toLowerCase()}</small></button>
<div class="wr-row2"><button class="btn" data-a="help">Как играть</button><button class="btn" data-a="exit">В меню</button></div></div></div>
</div>`;
    this.$.hub.classList.remove('hidden');
    this.$.hub.scrollTop = 0;
    this.map.setState(null, o.side);
    this.map.setOverlay({});
    this.inset();
    requestAnimationFrame(() => this.map.center(this.M.cityHex('Киев'), false, 0, this.map.minScale() * 1.25));
  }
  genP(k, z = 3) {
    const x = ALLG[k];
    return x ? portraitURLP('w:' + k, x.por, POR_NAT[x.nat] || 'GER', z) : '';
  }
  saveOpt() {
    try {
      localStorage.setItem(KEY_OPT, JSON.stringify(this.opt));
    } catch {}
  }
  async startNew() {
    const o = this.opt, my = ++this.sess;
    this.busyOn('Развёртывание войск на 22 июня 1941 г.…');
    await raf();
    await sleep(30);
    if (my !== this.sess) return;
    const S = E.newGame(this.M, { side: o.side, diff: o.diff, seed: (Date.now() % 1e9) >>> 0 });
    this.busyOff();
    this.enter(S);
    this.briefing();
  }
  cont() {
    let S = null;
    try {
      S = E.deserialize(this.M, localStorage.getItem(KEY));
    } catch (e) {
      S = null;
    }
    if (!S) return this.toast('Сохранение не подходит', 'Начните новую войну.', 'bad');
    this.enter(S);
    if (S.over) this.results();
    else this.afterTurn(true);
  }
  enter(S) {
    this.S = S;
    this.inGame = 1;
    this.sess++;
    this.busy = 0;
    this.mode = '';
    this.seen = S.lq || 0;
    this.$.hub.classList.add('hidden');
    this.root.classList.remove('wr-hubmode');
    this.$.toasts.innerHTML = '';
    this.clearSel(true);
    this.map.setState(S, S.side);
    this.layout();
    this.refresh();
    const h0 = this.M.cityHex(S.day < 30 ? 'Минск' : 'Москва');
    requestAnimationFrame(() => (this.inset(), this.map.center(this.focusHex() ?? h0, false, 0, this.map.defScale())));
  }
  focusHex() {
    // середина своей линии фронта
    const S = this.S, fd = S.frontDist?.[S.side];
    if (!fd) return null;
    let x = 0, y = 0, n = 0;
    for (let h = 0; h < this.M.N; h += 3) if (fd[h] === 0 && R.sideOfH(S, h) === S.side) {
      const [a, b] = this.M.xy(h);
      x += a;
      y += b;
      n++;
    }
    if (!n) return null;
    const h = this.M.hexAt(x / n, y / n);
    return h >= 0 ? h : null;
  }
  saveGame() {
    const S = this.S;
    if (!S) return;
    try {
      localStorage.setItem(KEY, E.serialize(S));
      localStorage.setItem(KEY_META, JSON.stringify({ v: 1, side: S.side, diff: S.diff, day: S.day, over: S.over ? 1 : 0 }));
    } catch {
      this.toast('Не удалось сохранить', 'Мало места в памяти браузера.', 'bad');
    }
  }
  live(my) {
    return my === this.sess && this.inGame;
  }
  // ——— ход ———
  async run(days) {
    const S = this.S;
    if (!S || this.busy || S.over) return;
    if (S.ev.pending.length) return this.decision();
    const my = this.sess;
    this.busy = 1;
    this.stopReq = 0;
    this.clearSel(true);
    this.root.classList.add('wr-busym');
    let n = 0, why = '';
    for (let i = 0; i < days; i++) {
      this.busyOn(days > 1 ? `Сутки ${i + 1} из ${days} · ${R.fmtDate(S.day)}` : `Ход: ${R.fmtDate(S.day)}…`, days > 1);
      await raf();
      await sleep(days > 1 ? 20 : 10);
      if (!this.live(my)) return;
      try {
        E.endTurn(S);
      } catch (e) {
        console.error(e);
        this.toast('Ошибка хода', String(e.message || e), 'bad');
        break;
      }
      n++;
      this.map.req();
      this.hud();
      if (S.over) break;
      if (S.stop) {
        why = S.stop;
        break;
      }
      if (this.stopReq) break;
    }
    if (!this.live(my)) return;
    this.busy = 0;
    this.root.classList.remove('wr-busym');
    this.busyOff();
    this.sfx('turn');
    if (days > 1 && why && why !== 'decision' && n < days) this.toast(`Неделя прервана: ${STOPN[why] || why}`, `прошло ${n} ${plural(n, 'сутки', 'суток', 'суток')}`, 'bad');
    this.afterTurn();
  }
  afterTurn(quiet) {
    const S = this.S;
    if (!S) return;
    this.saveGame();
    if (!quiet) this.digest();
    else this.seen = S.lq || 0;
    this.refresh();
    if (S.over) return this.results();
    if (S.ev.pending.length) this.decision();
  }
  // сводка за прошедшие сутки: сгруппированные сообщения
  digest() {
    const S = this.S, me = S.side, L = S.log.filter((e) => (e.i || 0) > this.seen);
    this.seen = S.lq || 0;
    const won = [], lib = [], lost = [], pk = [], form = [], arm = [], ev = [], evac = [], gds = [];
    for (const e of L) {
      if (e.k === 'city') {
        const c = this.M.cities[e.c];
        if (!c) continue;
        if (e.side === me) (/освобожд/.test(e.t) ? lib : won).push([c.n, e.h, e.big]);
        else if (e.lost === me) lost.push([c.n, e.h, e.big]);
      } else if (e.k === 'pocket' && e.big) pk.push(e);
      else if (e.k === 'form' && e.side === me) form.push(e);
      else if (e.k === 'army') arm.push(e);
      else if (e.k === 'ev' && e.side && e.side !== me) ev.push(e);
      else if (e.k === 'eco' && e.side === me) evac.push(e);
      else if (e.k === 'gds' && e.side === me) gds.push(e);
    }
    const nm = (a) => a.slice(0, 6).map((x) => x[0]).join(', ') + (a.length > 6 ? ` и ещё ${a.length - 6}` : '');
    if (lost.length) this.toast(`${me === 'SOV' ? 'Оставлены' : 'Потеряны'}: ${nm(lost)}`, '', 'bad', lost.find((x) => x[2])?.[1] ?? lost[0][1]);
    if (won.length) this.toast(`${me === 'SOV' ? 'Взяты' : 'Заняты'}: ${nm(won)}`, '', 'ok', won.find((x) => x[2])?.[1] ?? won[0][1]);
    if (lib.length) this.toast(`Освобождены: ${nm(lib)}`, '', 'ok', lib[0][1]);
    for (const e of pk.slice(0, 2)) this.toast(e.t, e.side === me ? 'наши войска' : 'противник', e.side === me ? 'bad' : 'ok', e.h);
    if (pk.length > 2) this.toast(`Ещё ${pk.length - 2} сообщений о котлах`, 'см. «Сводку»', '');
    for (const e of arm.slice(0, 2)) this.toast(e.t, '', e.side === me ? (/разгромлена/.test(e.t) ? 'bad' : 'ok') : /разгромлена/.test(e.t) ? 'ok' : '');
    if (form.length) this.toast(`Сформировано: ${divN(form.length)}`, form.length <= 3 ? form.map((e) => e.t.replace(/^Сформирована: /, '')).join('; ') : 'резервы Ставки', 'ok', form[0].h);
    for (const e of ev.slice(0, 2)) this.toast(`Противник: ${e.t}`, '', '');
    if (evac.length) this.toast(evac.length === 1 ? evac[0].t : `Эвакуация и промышленность: ${evac.length} сообщ.`, '', '');
    if (gds.length) this.toast(`Гвардия: ${gds.map((e) => e.t.replace(/^Гвардия: /, '')).slice(0, 3).join(', ')}`, '', 'ok', gds[0].h);
  }
  // ——— верхняя панель и кнопки ———
  refresh() {
    this.hud();
    this.overlay();
    this.card();
  }
  hud() {
    const S = this.S;
    if (!S) return;
    const me = S.side, en = R.other(me), W = R.WX[S.wx[1]] || R.WX.dry, Ec = S.eco[me];
    this.$.date.innerHTML = `<span class="wr-wx">${W.ic}</span><span class="wr-dt"><b>${R.fmtDate(S.day)}</b><small>${W.n} · ${S.day + 1}-е сутки войны</small></span>`;
    const bar = (v, c) => `<i class="wr-mb"><i style="width:${Math.max(0, Math.min(100, (v / 130) * 100))}%;background:${c}"></i></i>`;
    const mc = (s) => (s === 'SOV' ? '#d04a34' : '#9aa3ad');
    this.$.mor.innerHTML = `<span class="wr-mr"><small>Мораль</small><span><img class="wr-flag" src="${flagURL(me)}" alt="">${f0(S.morale[me])}${bar(S.morale[me], mc(me))}</span><span><img class="wr-flag" src="${flagURL(en)}" alt="">${f0(S.morale[en])}${bar(S.morale[en], mc(en))}</span></span>`;
    const fuelLow = Ec.fuel < 1500, supLow = Ec.sup < 0;
    this.$.eco.innerHTML = `<span class="wr-ec"><small>ПО ${f0(Ec.ip)} · резерв ${tys(Ec.men)}</small><small>танков ${f0(Ec.tnk)} · <span class="${fuelLow ? 'wr-bad' : ''}">горючее ${f0(Ec.fuel)}</span>${supLow ? ' · <span class="wr-bad">склады пусты</span>' : ''}</small></span>`;
    const pend = S.ev.pending.length;
    this.$.dec.classList.toggle('hidden', !pend);
    this.$.dec.classList.toggle('wr-pulse', !!pend);
    this.$.dec.textContent = pend > 1 ? `Решения: ${pend}` : 'Решение';
    const nx = dmy(S.day + 1);
    this.$.end.innerHTML = `<span>Ход</span><small>→ ${nx}</small>`;
    this.$.end.disabled = !!S.over;
    this.$.week.disabled = !!S.over;
    const lod = this.map.lod();
    this.$.lod.innerHTML = `${icon(lod === 'army' ? 'army' : 'div')}<span>${lod === 'army' ? 'Армии' : 'Дивизии'}</span>`;
  }
  onZoom() {
    const lod = this.map.lod();
    if (lod !== this._lod) {
      this._lod = lod;
      if (this.S && this.inGame) {
        this.hud();
        this.overlay();
      }
    }
  }
  // ——— слой карты ———
  overlay() {
    const S = this.S;
    if (!S) return this.map.setOverlay({});
    const me = S.side, o = { tokens: [], arrows: [], sel: -1, tgt: -1, flash: this.flash ?? -1 };
    for (const A of Object.values(S.hqs)) {
      if (A.lv < 2 || A.dead || A.arr) continue;
      const h = hqHex(S, A);
      if (h < 0) continue;
      const mine = A.side === me, ord = A.order && A.order !== 'auto' ? ORD_IC[A.order] : '';
      o.tokens.push({ A, h, lab: armyLab(A), ic: mine ? ord : '' });
      if (mine && (A === this.selA || (A.order === 'atk' && A.tgt >= 0))) {
        const p = this.postureOf(A);
        if (p && (p.k === 'atk' || p.k === 'ret') && p.obj >= 0) o.arrows.push({ from: h, to: p.obj, col: p.k === 'ret' ? '#9ad0ff' : A === this.selA ? '#ffd34a' : '#e8b04a' });
      }
    }
    if (this.selA) o.selA = this.selA.k;
    const u = this.sel;
    if (u && R.alive(u)) {
      o.selU = u.id;
      o.sel = u.h;
      if (u.side === me && this.mode !== 'rail') {
        const Rm = E.reach(S, u), reach = [];
        for (const [h] of Rm) if (h !== u.h && R.canEnd(S, u, h)) reach.push(h);
        o.reach = reach;
        if (R.canAttack(S, u)) {
          const at = [];
          for (let d = 0; d < 6; d++) {
            const j = this.M.nb[u.h * 6 + d];
            if (j >= 0 && R.enemyAt(S, j, me)) at.push(j);
          }
          o.atk = at;
        }
        this._reach = new Set(reach);
        this._atk = new Set(o.atk || []);
      } else {
        this._reach = new Set();
        this._atk = new Set();
      }
      if (this.mode === 'rail') {
        o.rail = this._rail || [];
      }
    } else {
      this._reach = new Set();
      this._atk = new Set();
    }
    if (this.atk) o.tgt = this.atk.tgt;
    if (this.info >= 0 && !u) o.sel = this.info;
    if (this.mode === 'tgt' && this.ordA) o.selA = this.ordA.k;
    o.done = (q) => q.side === me && (q.pm || q.at || q.mv);
    this.map.setOverlay(o);
  }
  postureOf(A) {
    try {
      return E.posture(this.S, A);
    } catch {
      return null;
    }
  }
  // ——— сообщения ———
  toast(t, s = '', cls = '', h = -1) {
    const box = this.$.toasts;
    while (box.children.length >= 5) box.firstElementChild.remove();
    const d = document.createElement('div');
    d.className = `wr-toast panel ${cls}`;
    d.innerHTML = `<b>${esc(t)}</b>${s ? `<small>${esc(s)}</small>` : ''}`;
    if (h >= 0) {
      d.classList.add('wr-tap');
      d.addEventListener('click', () => (this.map.center(h, true, 350, Math.max(this.map.s, this.map.defScale())), (this.flash = h), this.overlay(), setTimeout(() => ((this.flash = -1), this.overlay()), 1800)));
    }
    box.appendChild(d);
    setTimeout(() => d.classList.add('out'), 5200);
    setTimeout(() => d.remove(), 5700);
  }
  busyOn(t, stop) {
    const b = this.$.busy;
    b.innerHTML = `<i class="wr-spin"></i><span>${esc(t)}</span>${stop ? '<button class="btn wr-skip" data-a="stop">Стоп</button>' : ''}`;
    b.classList.remove('hidden');
  }
  busyOff() {
    this.$.busy.classList.add('hidden');
  }
  // ——— ввод на карте ———
  onTap(h) {
    const S = this.S;
    if (!S || !this.inGame || this.busy || h < 0) return;
    const me = S.side, u = this.sel;
    if (this.mode === 'tgt' && this.ordA) {
      const A = this.ordA, k = this.ordK;
      E.setOrder(S, A, k, h);
      this.sfx('select');
      const c = this.M.cityAt[h] >= 0 ? this.M.cities[this.M.cityAt[h]].n : this.nearCity(h);
      this.toast(`${A.n}: ${k === 'atk' ? 'наступать' : 'отходить'} — ${c}`, ORDERS[k].d, 'ok');
      this.mode = '';
      this.ordA = null;
      this.selA = A;
      this.sel = null;
      this.refresh();
      return;
    }
    if (this.mode === 'rail' && u) {
      if ((this._rail || []).includes(h)) {
        if (E.railTo(S, u, h)) {
          this.sfx('move');
          this.toast(`${u.n} — по железной дороге`, `прибудет сегодня; осталось эшелонов: ${S.railCap[me] || 0}`, 'ok');
        }
      }
      this.mode = '';
      this.refresh();
      return;
    }
    if (u && u.side === me && this._reach?.has(h)) {
      if (E.moveTo(S, u, h)) {
        this.sfx('move');
        this.atk = null;
        this.refresh();
      }
      return;
    }
    if (u && u.side === me && this._atk?.has(h)) {
      if (this.atk && this.atk.tgt === h) return this.doAtk();
      this.atk = { tgt: h };
      this.sfx('select');
      this.refresh();
      return;
    }
    const us = R.unitsAt(S, h), lod = this.map.lod();
    this.atk = null;
    if (us.length) {
      const own = us.filter((x) => x.side === me);
      if (own.length && lod === 'army') {
        const A = S.hqs[own[0].hq];
        if (A) return this.pickArmy(A);
      }
      if (own.length) {
        let i = 0;
        if (u && u.h === h) i = (own.indexOf(u) + 1) % own.length;
        this.sel = own[i];
        this.selA = null;
        this.info = -1;
        this.sfx('select');
        this.refresh();
        return;
      }
      if (lod === 'army') {
        const A = S.hqs[us[0].hq];
        if (A) return this.pickArmy(A);
      }
      this.sel = us[0];
      this.selA = null;
      this.info = -1;
      this.sfx('click');
      this.refresh();
      return;
    }
    if (this.sel || this.selA) return this.clearSel();
    this.info = h;
    this.refresh();
  }
  onLong(h) {
    if (!this.S || this.busy) return;
    this.sel = null;
    this.selA = null;
    this.atk = null;
    this.info = h;
    this.sfx('click');
    this.refresh();
  }
  onHQ(A) {
    if (!this.S || this.busy) return;
    if (this.mode === 'tgt') return this.onTap(hqHex(this.S, A));
    this.pickArmy(A);
  }
  pickArmy(A) {
    this.selA = A;
    this.sel = null;
    this.info = -1;
    this.atk = null;
    this.sfx('select');
    this.refresh();
  }
  clearSel(quiet) {
    this.sel = null;
    this.selA = null;
    this.info = -1;
    this.atk = null;
    this.mode = '';
    this.ordA = null;
    if (!quiet && this.S) this.refresh();
    else this.$.card.classList.add('hidden');
  }
  setMode(m) {
    this.mode = m;
    if (!m) this.ordA = null;
    this.refresh();
  }
  nearCity(h) {
    let best = null, bd = 1e9;
    for (const c of this.M.cities) {
      if (c.sz < 2) continue;
      const d = this.M.dist(c.h, h);
      if (d < bd) (bd = d), (best = c);
    }
    return best ? (bd <= 1 ? best.n : `район ${best.n}`) : 'выбранный рубеж';
  }
  // ——— удар ———
  attList() {
    const S = this.S, t = this.atk?.tgt, u = this.sel;
    if (t == null || !u) return [];
    if (this.opt.all) return R.attackers(S, t, S.side);
    return R.canAttack(S, u) ? [u] : [];
  }
  doAtk() {
    const S = this.S, t = this.atk?.tgt, att = this.attList();
    if (t == null || !att.length) return;
    const nm = R.unitsAt(S, t).map((x) => x.n);
    const r = E.attack(S, att, t);
    this.atk = null;
    if (!r) return this.refresh();
    this.sfx(r.rout ? 'bigBoom' : 'boom');
    const res = r.killed?.length ? 'Противник разгромлен' : r.rout ? 'Разгром! Противник бежит' : r.push ? 'Противник отброшен' : 'Атака отбита';
    this.toast(res, `${nm.slice(0, 2).join(', ')} · потери: наши ${tys(r.lossA)}, противника ${tys(r.lossD)}`, r.push ? 'ok' : 'bad');
    this.flash = t;
    setTimeout(() => ((this.flash = -1), this.S && this.overlay()), 1500);
    if (this.sel && !R.alive(this.sel)) this.sel = null;
    this.refresh();
  }
  // ——— карточки ———
  card() {
    const S = this.S, c = this.$.card;
    let html = '';
    if (S && this.sel && R.alive(this.sel)) html = this.cardDiv(this.sel);
    else if (S && this.selA && !this.selA.dead) html = this.cardArmy(this.selA);
    else if (S && this.info >= 0) html = this.cardHex(this.info);
    if (!html) {
      if (!c.classList.contains('hidden')) {
        c.classList.add('hidden');
        requestAnimationFrame(() => this.inset());
      }
      return;
    }
    const keep = !c.classList.contains('hidden') ? c.scrollTop : 0;
    c.innerHTML = `<button class="wr-cx" data-a="close" aria-label="Закрыть">×</button>${html}`;
    c.classList.remove('hidden');
    c.scrollTop = keep;
    requestAnimationFrame(() => this.inset());
  }
  bar(lab, v, max, txt) {
    const k = Math.max(0, Math.min(1, v / Math.max(1, max)));
    return `<div class="wr-st"><span>${lab}</span><i class="wr-bar ${k > 0.6 ? 'ok' : k > 0.3 ? 'mid' : 'low'}"><i style="width:${Math.round(k * 100)}%"></i></i><span>${txt}</span></div>`;
  }
  cardDiv(u) {
    const S = this.S, me = S.side, mine = u.side === me, A = S.hqs[u.hq], T = R.TYPES[u.t] || R.TYPES.inf;
    const nat = R.NAT_N[u.nat] || '';
    const head = `<div class="wr-uh"><img class="wr-uc" src="${cImg(S, u, me)}" alt=""><div><b>${esc(u.n)}</b><small>${esc(A ? A.n : '')}${u.nat !== u.side || u.side !== me ? ` · ${nat}` : ''}</small></div></div>`;
    if (!mine) {
      const est = Math.round(u.men / 1000);
      return `${head}<div class="wr-tags"><span class="wr-tag">${T.n}</span><span class="wr-tag">≈ ${est} тыс. чел.</span>${u.tnk > 0 ? `<span class="wr-tag">танков ≈ ${Math.round(u.tnk / 10) * 10 || u.tnk}</span>` : ''}${u.oos > 2 ? '<span class="wr-tag wr-bad">без снабжения</span>' : ''}</div>
<p class="wr-hint">Сила противника — по данным разведки. Выберите свою дивизию рядом, чтобы ударить.</p>`;
    }
    const sup = u.oos <= 0 ? '<span class="wr-tag wr-okc">снабжение</span>' : u.oos > 2 ? `<span class="wr-tag wr-bad">без снабжения ${u.oos} сут.</span>` : '<span class="wr-tag wr-warn">перебои снабжения</span>';
    const tags = [`<span class="wr-tag">${T.n}</span>`, `<span class="wr-tag">орудий ${f0(u.gun)}</span>`];
    if (u.tnkM > 0) tags.push(`<span class="wr-tag">танков ${f0(u.tnk)}/${f0(u.tnkM)}</span>`);
    tags.push(sup);
    if (u.ent > 0.4) tags.push(`<span class="wr-tag">окопы ${'▮'.repeat(Math.min(4, Math.round(u.ent)))}</span>`);
    if (u.gar) tags.push('<span class="wr-tag wr-warn">гарнизон</span>');
    if (u.gds) tags.push('<span class="wr-tag wr-gold">гвардия</span>');
    const acted = u.pm || u.at || u.mv;
    let hint = '';
    if (this.mode === 'rail') hint = 'Голубые гексы — станции, куда можно перебросить дивизию сегодня. Коснитесь станции.';
    else if (u.gar) hint = 'Гарнизон держит город и не уходит. Снимите гарнизон, чтобы маршировать.';
    else if (u.mp > 0 && !u.at) hint = 'Белые гексы — марш, красные — удар. Второе касание красного гекса — атаковать.';
    else hint = 'Дивизия уже действовала сегодня.';
    const rt = !u.gar && !u.at && !u.ral && !u.mv ? E.railTargets(S, u) : [];
    this._rail = rt;
    const acts = [];
    if (S.undo.length) acts.push(`<button class="btn wr-act" data-a="u-undo">${icon('undo')}<span>Отменить</span></button>`);
    if (rt.length) acts.push(`<button class="btn wr-act ${this.mode === 'rail' ? 'on' : ''}" data-a="u-rail">${icon('rail')}<span>По ж/д</span><small>эшелонов ${S.railCap[me] || 0}</small></button>`);
    if (u.gar) acts.push('<button class="btn wr-act" data-a="u-gar"><span>Снять гарнизон</span></button>');
    if (A) acts.push(`<button class="btn wr-act" data-a="u-army"><span>Армия</span><small>${esc(armyLab(A))}</small></button>`);
    let fc = '';
    if (this.atk) fc = this.forecastHTML();
    return `${head}<div class="wr-sts">${this.bar('Люди', u.men, u.menM, tys(u.men))}${this.bar('Орг.', u.org, 100, f0(u.org))}${this.bar('Опыт', u.xp, 100, f0(u.xp))}</div>
<div class="wr-tags">${tags.join('')}${acted ? '<span class="wr-tag wr-dim">походила</span>' : ''}</div>
<p class="wr-hint">${hint}</p>${acts.length ? `<div class="wr-acts">${acts.join('')}</div>` : ''}${fc}`;
  }
  forecastHTML() {
    const S = this.S, t = this.atk.tgt, me = S.side, att = this.attList(), ds = R.unitsAt(S, t);
    if (!ds.length) return '';
    const nAll = R.attackers(S, t, me).length;
    const F = att.length ? E.forecast(S, att, t) : null;
    const ch = F ? Math.round(F.chance * 100) : 0;
    const ci = this.M.cityAt[t] >= 0 ? this.M.cities[this.M.cityAt[t]] : null;
    return `<div class="wr-fc"><div class="wr-fh"><b>Удар: ${esc(ds.map((x) => x.n).slice(0, 2).join(', '))}${ds.length > 2 ? ` и ещё ${ds.length - 2}` : ''}</b><small>${TERR_N[this.M.terr[t]] || ''}${ci ? ` · ${esc(ci.n)}` : ''}</small></div>
${F ? `<div class="wr-fbar"><i style="width:${ch}%"></i></div>
<div class="wr-fv">Соотношение <b>${f1(F.R)} : 1</b> · шанс отбросить <b>${ch} %</b></div>
<div class="wr-fv">Ожидаемые потери: наши ≈ ${tys(F.lossA)}, противника ≈ ${tys(F.lossD)}</div>` : '<div class="wr-fv wr-bad">Эта дивизия не может атаковать сегодня.</div>'}
<button class="btn wr-tog ${this.opt.all ? 'on' : ''}" data-a="atk-all"><i class="wr-chk"></i>Вместе с соседями <small>(${divN(nAll)})</small></button>
<div class="wr-fbtn"><button class="btn gold wr-wide" data-a="atk-go" ${att.length ? '' : 'disabled'}>Атаковать<small>${divN(att.length)}</small></button></div></div>`;
  }
  cardArmy(A) {
    const S = this.S, me = S.side, mine = A.side === me, G = S.G[A.gen], us = armyUnits(S, A), up = S.hqs[A.up];
    const men = us.reduce((s, u) => s + u.men, 0), tnk = us.reduce((s, u) => s + u.tnk, 0), mech = us.filter((u) => R.isMech(u)).length;
    const tr = G ? G.tr.map((t) => TRAITS[t]?.n).filter(Boolean).join(', ') : '';
    const head = `<div class="wr-uh">${G ? `<img class="wr-pm" src="${porG(A.gen, 2)}" alt="">` : ''}<div><b>${esc(A.n)}</b><small>${G ? esc(G.n) : ''}${tr ? ` · ${esc(tr)}` : ''}</small>${up && up.lv >= 1 ? `<small class="wr-dim">${esc(up.n)}</small>` : ''}</div></div>`;
    const stat = `<div class="wr-tags"><span class="wr-tag">${divN(us.length)}</span>${mech ? `<span class="wr-tag">подвижных ${mech}</span>` : ''}<span class="wr-tag">${mine ? tys(men) : `≈ ${tys(Math.round(men / 20000) * 20000)}`}</span>${tnk ? `<span class="wr-tag">танков ${mine ? f0(tnk) : '≈ ' + f0(Math.round(tnk / 50) * 50)}</span>` : ''}</div>`;
    if (!mine) return `${head}${stat}<p class="wr-hint">Армия противника. Приблизьте карту, чтобы увидеть дивизии.</p>`;
    const p = this.postureOf(A), ord = A.order || 'auto';
    let task = ORDERS[ord].n;
    if (ord === 'auto') task += p?.op ? ` — ${p.op.n}` : ' — оборона участка';
    const tg = p && (p.k === 'atk' || p.k === 'ret') && p.obj >= 0 ? (this.M.cityAt[p.obj] >= 0 ? this.M.cities[this.M.cityAt[p.obj]].n : this.nearCity(p.obj)) : '';
    const seg = Object.entries(ORDERS).map(([k, o]) => `<button data-a="ord" data-v="${k}" class="${ord === k ? 'on' : ''}">${o.n}</button>`).join('');
    const hint = this.mode === 'tgt' && this.ordA === A ? `<p class="wr-hint wr-gold">Коснитесь карты: ${this.ordK === 'atk' ? 'цель наступления' : 'рубеж отхода'}. <button class="btn wr-mini" data-a="cancel">Отмена</button></p>` : `<p class="wr-hint">${esc(ORDERS[ord].d)}${ord === 'man' ? '. Дивизии этой армии ходят только по вашим приказам.' : ''}</p>`;
    return `${head}${stat}<div class="wr-task">Задача: <b>${esc(task)}</b>${tg ? ` · цель: <b>${esc(tg)}</b>` : ''}</div>
<div class="wr-seg wr-ords panel">${seg}</div>${hint}
<div class="wr-acts"><button class="btn wr-act" data-a="a-zoom"><span>К дивизиям</span><small>приблизить</small></button><button class="btn wr-act" data-a="orders"><span>Все приказы</span></button></div>`;
  }
  cardHex(h) {
    const S = this.S, M = this.M, me = S.side, t = M.terr[h];
    if (t < 2) return `<div class="wr-uh"><div><b>${TERR_N[t] || 'Море'}</b><small>${t === 1 ? 'озеро' : 'море'}</small></div></div>`;
    const ci = M.cityAt[h] >= 0 ? M.cities[M.cityAt[h]] : null, own = M.nations[S.own[h]], sd = R.sideOfH(S, h);
    const rg = M.reg[h] ? REGIONS[M.reg[h] - 1] : null, W = R.WX[S.wx[M.zone[h]]];
    const L = S.supL?.[me]?.[h];
    const us = R.unitsAt(S, h);
    const tags = [`<span class="wr-tag">${TERR_N[t]}</span>`, `<span class="wr-tag">${W.ic} ${W.n}</span>`];
    if (sd === me) tags.push(L === 2 ? '<span class="wr-tag wr-okc">снабжение</span>' : L === 1 ? '<span class="wr-tag wr-warn">частичное снабжение</span>' : '<span class="wr-tag wr-bad">нет снабжения</span>');
    if (M.rail[h]) tags.push(`<span class="wr-tag">${S.rok[h] ? 'ж/д' : 'ж/д разрушена'}</span>`);
    if (ci?.fort) tags.push(`<span class="wr-tag wr-gold">укрепления ${S.fst[ci.k] > 0 ? f0(S.fst[ci.k]) : 'разрушены'}</span>`);
    const list = us.length ? `<div class="wr-ul">${us.map((u) => `<button class="wr-ui" data-a="u-pick" data-v="${u.id}"><img src="${cImg(S, u, me)}" alt=""><span>${esc(u.side === me ? u.n : `${R.NAT_N[u.nat] || ''}: ${R.TYPES[u.t]?.n || ''}`)}</span></button>`).join('')}</div>` : '';
    return `<div class="wr-uh"><img class="wr-flag2" src="${flagURL(own in R.NAT_N ? own : sd || 'GER')}" alt=""><div><b>${esc(ci ? ci.n : rg ? rg.n : TERR_N[t])}</b><small>${esc(R.NAT_N[own] || own || '')}${ci ? ` · ${ci.cap ? 'столица' : ci.sz >= 3 ? 'крупный город' : ci.sz >= 2 ? 'город' : 'городок'}` : ''}${rg && ci ? ` · ${esc(rg.n)}` : ''}</small></div></div>
<div class="wr-tags">${tags.join('')}</div>${rg ? `<p class="wr-hint">Регион «${esc(rg.n)}»: промышленность ${rg.ic}, нефть ${rg.oil}, людские ресурсы ${rg.mp}.</p>` : ''}${list}`;
  }
  // ——— кнопки ———
  onClick(e) {
    const b = e.target.closest('[data-a]');
    if (!b || !this.root.contains(b) || b.disabled) return;
    const a = b.dataset.a, v = b.dataset.v, S = this.S;
    const busyOK = ['stop', 'menu', 'close-m', 'help'];
    if (this.busy && !busyOK.includes(a)) return;
    switch (a) {
      case 'o-side':
        this.sfx('click');
        this.opt.side = v === 'GER' ? 'GER' : 'SOV';
        this.saveOpt();
        return this.showHub();
      case 'o-diff':
        this.sfx('click');
        this.opt.diff = +v;
        this.saveOpt();
        return this.showHub();
      case 'new':
        this.sfx('click');
        if (readMeta() && !readMeta().over) return this.confirm('Начать новую войну?', 'Текущая партия будет перезаписана.', () => this.startNew());
        return this.startNew();
      case 'cont':
        this.sfx('click');
        return this.cont();
      case 'exit':
        this.sfx('click');
        return this.h.exit?.();
      case 'help':
        this.sfx('click');
        return this.help();
      case 'menu':
        this.sfx('click');
        return this.gameMenu();
      case 'stop':
        this.stopReq = 1;
        b.disabled = true;
        return;
      case 'end':
        this.sfx('click');
        return this.run(1);
      case 'week':
        this.sfx('click');
        return this.run(7);
      case 'dec':
        this.sfx('click');
        return this.decision();
      case 'orders':
        this.sfx('click');
        return this.orders();
      case 'eco':
        this.sfx('click');
        return this.economy();
      case 'sum':
        this.sfx('click');
        return this.summary();
      case 'lod': {
        this.sfx('click');
        const lod = this.map.lod();
        this.map.zoomTo(lod === 'army' ? LOD_HEX + 10 : 19);
        return this.onZoom();
      }
      case 'close':
        this.sfx('click');
        return this.clearSel();
      case 'cancel':
        this.sfx('click');
        return this.setMode('');
      case 'u-undo':
        this.sfx('click');
        if (E.undoMove(S)) this.atk = null;
        return this.refresh();
      case 'u-rail':
        this.sfx('click');
        this.mode = this.mode === 'rail' ? '' : 'rail';
        this.atk = null;
        return this.refresh();
      case 'u-gar':
        this.sfx('click');
        if (this.sel) E.freeGarrison(S, this.sel);
        return this.refresh();
      case 'u-army':
        if (this.sel) return this.pickArmy(S.hqs[this.sel.hq]);
        return;
      case 'u-pick': {
        const u = S.units.find((x) => x.id === +v);
        if (u) {
          this.sel = u;
          this.info = -1;
          this.sfx('select');
          this.refresh();
        }
        return;
      }
      case 'atk-all':
        this.sfx('click');
        this.opt.all = this.opt.all ? 0 : 1;
        this.saveOpt();
        return this.refresh();
      case 'atk-go':
        return this.doAtk();
      case 'ord': {
        const A = this.selA;
        if (!A) return;
        this.sfx('click');
        if (v === 'atk' || v === 'ret') {
          this.mode = 'tgt';
          this.ordA = A;
          this.ordK = v;
          return this.refresh();
        }
        E.setOrder(S, A, v, -1);
        this.mode = '';
        return this.refresh();
      }
      case 'a-zoom':
        if (this.selA) {
          this.sfx('click');
          this.map.center(hqHex(S, this.selA), true, 350, Math.max(this.map.s, ((LOD_HEX + 10) * this.map.dpr) / this.M.g.W));
        }
        return;
      case 'm-ord-all':
        this.sfx('click');
        for (const A of Object.values(S.hqs)) if (A.side === S.side && A.lv >= 2) E.setOrder(S, A, 'auto', -1);
        this.toast('Все армии — Авто', 'армии действуют по плану Ставки', 'ok');
        this.refresh();
        return this.orders();
      case 'm-army': {
        const A = S.hqs[v];
        this.closeModal();
        if (A) {
          this.pickArmy(A);
          this.map.center(hqHex(S, A), true, 350);
        }
        return;
      }
      case 'm-share': {
        const [k, d] = v.split(':');
        this.sfx('click');
        this.share(k, +d * 0.05);
        return this.economy();
      }
      case 'm-auto':
        this.sfx('click');
        S.eco[S.side].auto = S.eco[S.side].auto ? 0 : 1;
        return this.economy();
      case 'm-form': {
        this.sfx('click');
        const u = formDiv(S, S.side, v, (o) => E.note(S, o));
        if (u) this.toast(`Сформирована: ${u.n}`, S.hqs[u.hq]?.n || '', 'ok', u.h);
        else this.toast('Не хватает людей или техники', 'или достигнут предел соединений', 'bad');
        this.seen = S.lq || 0;
        this.refresh();
        return this.economy();
      }
      case 'm-ev': {
        const [k, i] = v.split(':');
        this.sfx('select');
        E.applyEvent(S, k, +i);
        this.seen = S.lq || 0;
        this.closeModal(true);
        this.refresh();
        this.saveGame();
        if (S.ev.pending.length) return this.decision();
        return;
      }
      case 'm-log': {
        const h = +v;
        this.closeModal();
        if (h >= 0) {
          this.map.center(h, true, 350, Math.max(this.map.s, this.map.defScale()));
          this.flash = h;
          this.overlay();
          setTimeout(() => ((this.flash = -1), this.S && this.overlay()), 1800);
        }
        return;
      }
      case 'm-save-exit':
        this.sfx('click');
        this.closeModal(true);
        this.saveGame();
        return this.h.exit?.();
      case 'm-hub':
        this.sfx('click');
        this.closeModal(true);
        this.saveGame();
        return this.showHub();
      case 'close-m':
        this.sfx('click');
        return this.closeModal();
      case 'm-yes':
        this.sfx('click');
        this.closeModal(true);
        return this._yes?.();
      case 'm-new2':
        this.sfx('click');
        this.closeModal(true);
        return this.startNew();
      default:
    }
  }
  onChange(e) {
    const t = e.target;
    if (t.dataset.ord && this.S) {
      const A = this.S.hqs[t.dataset.ord], k = t.value;
      if (!A) return;
      this.sfx('click');
      if (k === 'atk' || k === 'ret') {
        this.closeModal();
        this.pickArmy(A);
        this.mode = 'tgt';
        this.ordA = A;
        this.ordK = k;
        this.map.center(hqHex(this.S, A), true, 300);
        this.refresh();
        this.toast('Укажите цель на карте', A.n, '');
        return;
      }
      E.setOrder(this.S, A, k, -1);
      this.refresh();
    }
  }
  share(k, d) {
    const E0 = this.S.eco[this.S.side], sh = E0.share;
    sh[k] = Math.max(0.02, Math.min(0.7, (sh[k] || 0) + d));
    const tot = Object.values(sh).reduce((a, b) => a + b, 0);
    for (const x in sh) sh[x] /= tot;
  }
  // ——— окна ———
  modal(html, cls = '', lock = false) {
    const m = this.$.modal;
    m.innerHTML = `<div class="wr-dlg panel ${cls}">${lock ? '' : '<button class="wr-cx" data-a="close-m" aria-label="Закрыть">×</button>'}${html}</div>`;
    m.classList.remove('hidden');
    this.modalLock = lock;
    m.firstElementChild.scrollTop = 0;
  }
  closeModal(force) {
    if (this.modalLock && !force) return;
    this.modalLock = false;
    this.$.modal.classList.add('hidden');
    this.$.modal.innerHTML = '';
    const f = this._afterClose;
    this._afterClose = null;
    if (f) setTimeout(f, 0);
  }
  confirm(t, s, yes) {
    this._yes = yes;
    this.modal(`<h3>${esc(t)}</h3><p>${esc(s)}</p><div class="wr-row2"><button class="btn" data-a="close-m">Отмена</button><button class="btn gold" data-a="m-yes">Да</button></div>`, 'wr-small');
  }
  gameMenu() {
    if (!this.S) return;
    const S = this.S;
    this.modal(`<h3>Фронт 1941–1945</h3><p class="wr-dim">${S.side === 'SOV' ? 'СССР, Ставка ВГК' : 'Германия, ОКХ'} · ${R.fmtDate(S.day)} · ${R.DIFF[S.diff].toLowerCase()}</p>
<button class="btn gold wr-wide" data-a="close-m">Продолжить</button>
<button class="btn wr-wide" data-a="help">Как играть</button>
<button class="btn wr-wide" data-a="m-hub">Выбор стороны и сложности</button>
<button class="btn wr-wide" data-a="m-save-exit">Сохранить и выйти в меню</button>`, 'wr-small');
  }
  help() {
    this.modal(`<h3>Как играть</h3>
<p class="wr-sm"><b>Ход — одни сутки.</b> Сначала действует Ось, затем СССР. «Ход → дата» — завершить сутки, «Неделя» — до 7 суток подряд; неделя прерывается, если пал крупный город, ваши войска окружены или нужно решение.</p>
<p class="wr-sm"><b>Армии.</b> На мелком масштабе видны штабы армий с портретами командующих. Коснитесь штаба — приказ армии: <b>Авто</b> (по историческому плану), <b>Оборона</b>, <b>Наступать</b> (цель — касание карты), <b>Отход</b>, <b>Резерв</b>, <b>Вручную</b>. В «Приказах» — все армии сразу и «Все армии — Авто».</p>
<p class="wr-sm"><b>Дивизии.</b> Приблизьте карту (или «Армии/Дивизии»). Выберите свою дивизию: белые гексы — марш, красные — удар; прогноз боя показывает соотношение сил, шанс и потери, можно ударить «Вместе с соседями». «По ж/д» — переброска по железной дороге, «Отменить» — вернуть марш. Дивизии, которыми вы походили, ИИ в этот день не трогает.</p>
<p class="wr-sm"><b>Снабжение.</b> Войска далеко от станций слабеют; без связи с тылом — окружение (красная рамка), дивизии сдаются через несколько суток. Железные дороги противника нужно перешивать и чинить — фронт не может бежать быстрее подвоза.</p>
<p class="wr-sm"><b>Экономика.</b> Промышленность — от занятых регионов. Распределите выпуск по 5 линиям; новые дивизии формируются по штатам (вручную или автоматически); раненые возвращаются в строй; ленд-лиз идёт через Мурманск и Иран; горючее нужно танкам; авиация даёт господство в воздухе.</p>
<p class="wr-sm"><b>Победа.</b> Мораль сторон 0–130 падает от потерь, котлов и сданных городов. СССР побеждает, взяв Берлин: до 2 мая 1945 г. — ★★★, до 20 мая — ★★, позже — ★. Германия побеждает, если удержит Берлин до 31 мая 1945 г. или мораль СССР упадёт до нуля.</p>
<button class="btn gold wr-wide" data-a="close-m">Понятно</button>`, 'wr-tall');
  }
  briefing() {
    const S = this.S, me = S.side;
    const t = me === 'SOV'
      ? 'На рассвете 22 июня 1941 г. Германия и её союзники напали на СССР. Приграничные армии под ударом, авиация потеряла на аэродромах сотни самолётов. Ставке предстоит остановить вермахт, сохранить заводы и армии — и через четыре года взять Берлин.'
      : 'Операция «Барбаросса» началась. Три группы армий — «Север», «Центр» и «Юг» — наступают на Ленинград, Москву и Киев. Нужно окружить и уничтожить Красную армию до зимы: за Днепром и Двиной её резервы неисчерпаемы.';
    this.modal(`<div class="wr-brh"><img class="wr-por" src="${this.genP(SIDE_HQ[me].g)}" alt=""><div><small class="wr-gold">${me === 'SOV' ? 'Ставка ВГК' : 'ОКХ'} · 22 июня 1941</small><h3>${me === 'SOV' ? 'Великая Отечественная' : 'Восточный поход'}</h3><small>${SIDE_HQ[me].who}</small></div></div>
<p class="wr-sm">${t}</p>
<div class="wr-tip">${me === 'SOV' ? 'Цель: взять Берлин до 2 мая 1945 г. (★★★). Москва, Ленинград и Сталинград должны выстоять.' : 'Цель: удержать Берлин до 31 мая 1945 г. или сломить мораль СССР. Москва — главный приз 1941 г.'}</div>
<p class="wr-sm wr-dim">Армии в режиме «Авто» действуют по историческому плану. Вмешивайтесь там, где решается исход: приказы армиям, удары дивизиями, резервы и экономика.</p>
<button class="btn gold wr-wide" data-a="close-m">К карте</button>`, 'wr-small');
    const done = () => this.S === S && S.ev.pending.length && this.decision();
    this._afterClose = done;
  }
  orders() {
    const S = this.S, me = S.side;
    if (!S) return;
    const armies = Object.values(S.hqs).filter((A) => A.side === me && A.lv >= 2 && !A.dead && !A.arr);
    const groups = new Map();
    for (const A of armies) {
      let up = S.hqs[A.up];
      while (up && up.lv >= 2) up = S.hqs[up.up];
      const k = up ? up.k : '';
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(A);
    }
    const row = (A) => {
      const us = armyUnits(S, A), G = S.G[A.gen], p = this.postureOf(A), ord = A.order || 'auto';
      const task = ord === 'auto' ? p?.op?.n || 'оборона участка' : ORDERS[ord].d;
      const opts = Object.entries(ORDERS).map(([k, o]) => `<option value="${k}" ${ord === k ? 'selected' : ''}>${o.n}${k === 'atk' || k === 'ret' ? '…' : ''}</option>`).join('');
      return `<div class="wr-or"><button class="wr-orb" data-a="m-army" data-v="${A.k}">${G ? `<img src="${porG(A.gen, 1)}" alt="">` : ''}<span><b>${esc(A.n)}</b><small>${G ? esc(G.sh || G.n) : ''} · ${divN(us.length)}</small><small class="wr-dim">${esc(task)}</small></span></button>
<select class="wr-sel" data-ord="${A.k}" aria-label="Приказ">${opts}</select></div>`;
    };
    let html = '';
    for (const [k, list] of groups) {
      const G = S.hqs[k];
      list.sort((a, b) => armyUnits(S, b).length - armyUnits(S, a).length);
      html += `<h4>${esc(G ? G.n : 'Резерв')}</h4>${list.map(row).join('')}`;
    }
    this.modal(`<h3>Приказы армиям</h3><p class="wr-sm wr-dim">${divN(armies.reduce((s, A) => s + armyUnits(S, A).length, 0))} в ${armies.length} ${plural(armies.length, 'армии', 'армиях', 'армиях')}. «Наступать» и «Отход» — затем укажите цель на карте.</p>
<button class="btn gold wr-wide" data-a="m-ord-all">Все армии — Авто<small>исторический план ${me === 'SOV' ? 'Ставки' : 'ОКХ'}</small></button>${html}`, 'wr-tall');
  }
  economy() {
    const S = this.S, me = S.side, Ec = S.eco[me];
    if (!S) return;
    const out = Ec.out || {}, unit = { men: 'чел.', gun: 'орудий', tnk: 'танков', air: 'самолётов', sup: 'ед.' };
    const lines = LINES.map((L) => {
      const sh = Ec.share[L.k] || 0, v = out[L.k] || 0;
      return `<div class="wr-ln"><span class="wr-lnn"><b>${L.n}</b><small>${esc(L.d)}</small></span><span class="wr-lnv">${L.k === 'men' ? f0(v) : f1(v)} ${unit[L.k]}/сут.</span>
<span class="wr-lns"><button class="btn wr-mini" data-a="m-share" data-v="${L.k}:-1">−</button><b>${Math.round(sh * 100)} %</b><button class="btn wr-mini" data-a="m-share" data-v="${L.k}:1">+</button></span></div>`;
    }).join('');
    const wnd = (Ec.wnd || []).reduce((s, w) => s + w[1], 0);
    const ll = me === 'SOV' ? llRoutes(S) : null;
    const dc = divCount(S, me), cap = divCap(S, me);
    const tpl = tplNow(S, me).map((T) => {
      const [m, g, t] = T.z(R.yearF(S.day)), ok = Ec.men >= m && Ec.gun >= g && Ec.tnk >= t && dc < cap;
      return `<div class="wr-tp"><span><b>${esc(T.n)}</b><small>${tys(m)} · орудий ${g}${t ? ` · танков ${t}` : ''}</small></span><button class="btn wr-mini2 ${ok ? 'gold' : ''}" data-a="m-form" data-v="${T.k}" ${ok ? '' : 'disabled'}>Сформировать</button></div>`;
    }).join('');
    const ev = me === 'SOV' ? `<div class="wr-kv"><span>Эвакуация на восток</span><b>${(Ec.evq || []).length ? `в пути ${(Ec.evq || []).length} ${plural((Ec.evq || []).length, 'эшелон заводов', 'эшелона заводов', 'эшелонов заводов')}` : 'нет в пути'}${Ec.ural ? ` · на Урале +${f1(Ec.ural)} ПО` : ''}</b></div>` : '';
    this.modal(`<h3>Экономика · ${R.SIDE_N[me]}</h3>
<div class="wr-kv"><span>Промышленность (ПО)</span><b>${f0(Ec.ip)}${Ec.occ ? ` <small class="wr-dim">в т. ч. занятые земли ${f0(Ec.occ)}</small>` : ''}</b></div>${ev}
<h4>Производство · доли выпуска</h4>${lines}
<h4>Запасы</h4>
<div class="wr-kv"><span>Резерв пополнений</span><b>${tys(Ec.men)} <small class="wr-dim">призыв +${f0(Ec.mpIn || 0)}/сут.</small></b></div>
<div class="wr-kv"><span>Раненые вернутся в строй</span><b>${tys(wnd)}</b></div>
<div class="wr-kv"><span>Орудия · танки на складах</span><b>${f0(Ec.gun)} · ${f0(Ec.tnk)}</b></div>
<div class="wr-kv"><span>Самолёты · господство в воздухе</span><b>${f0(Ec.air)} · ${Math.round((S.air?.[me] || 0) * 100)} %</b></div>
<div class="wr-kv"><span>Фронтовые склады</span><b class="${Ec.sup < 0 ? 'wr-bad' : ''}">${f0(Ec.sup)}${Ec.sup < 0 ? ' — атаки слабее' : ''}</b></div>
<div class="wr-kv"><span>Горючее</span><b class="${Ec.fuel < 1500 ? 'wr-bad' : ''}">${f0(Ec.fuel)}</b></div>
${ll ? `<div class="wr-kv"><span>Ленд-лиз (получено)</span><b>танков ${f0(Ec.ll.tnk)} · самолётов ${f0(Ec.ll.air)} · орудий ${f0(Ec.ll.gun)}</b></div>
<div class="wr-kv"><span>Маршруты</span><b>Арктика ${ll.arc ? '✓' : '✗'} · Иран ${ll.per ? '✓' : '✗'} · Дальний Восток ✓</b></div>` : ''}
<h4>Новые дивизии · ${dc} из ${cap}</h4>
<button class="btn wr-tog ${Ec.auto ? 'on' : ''}" data-a="m-auto"><i class="wr-chk"></i>Формировать автоматически <small>${me === 'SOV' ? 'по мобилизационному плану' : 'из излишков'}</small></button>
${tpl}`, 'wr-tall');
  }
  summary() {
    const S = this.S, me = S.side, en = R.other(me);
    if (!S) return;
    const row = (lab, f) => `<tr><td>${lab}</td><td>${f(me)}</td><td>${f(en)}</td></tr>`;
    const dv = (s) => S.units.filter((u) => u.side === s && R.alive(u) && !u.arr && u.t !== 'gar').length;
    const wk = S.mst?.wk?.[me] || {};
    const mw = Object.entries(wk).filter(([, v]) => Math.abs(v) >= 0.05).map(([k, v]) => `${E.MOR_WHY[k] || k} ${sgn(v)}`).join(' · ') || 'без изменений';
    const pks = [...(S.pk[me] || []).map((p) => [p, 'bad']), ...(S.pk[en] || []).map((p) => [p, 'ok'])].filter(([p]) => p.units >= 2);
    const ops = new Map();
    for (const A of Object.values(S.hqs)) if (A.side === me && A.lv >= 2 && !A.dead && !A.arr) {
      const o = planOp(S, A);
      if (o && !ops.has(o.n)) ops.set(o.n, o);
    }
    const goal = me === 'SOV'
      ? 'Взять Берлин: до 2 мая 1945 г. — ★★★, до 20 мая — ★★, позже — ★. Если мораль СССР упадёт до нуля — поражение.'
      : 'Удержать Берлин до 31 мая 1945 г. (★) или сломить СССР — мораль до нуля (★★★).';
    const log = S.log.slice(-60).reverse().filter((e) => e.k !== 'gds' || e.side === me).slice(0, 45);
    const lj = log.map((e) => `<button class="wr-jl wr-j-${e.k} ${e.big ? 'big' : ''}" data-a="m-log" data-v="${e.h ?? -1}"><small>${R.fmtDM(e.d)}</small> ${esc(this.logTxt(e))}</button>`).join('');
    this.modal(`<h3>Сводка · ${R.fmtDate(S.day)}</h3>
<div class="wr-tip">${goal}</div>
<table class="wr-tbl"><tr><th></th><th>${R.SIDE_N[me]}</th><th>${R.SIDE_N[en]}</th></tr>
${row('Мораль', (s) => f0(S.morale[s]))}${row('Дивизий на фронте', dv)}${row('Личный состав', (s) => tys(strength(S, s)))}${row('Потери за войну', (s) => tys(S.loss[s]))}${row('Промышленность', (s) => f0(S.eco[s].ip))}${row('Авиация', (s) => `${Math.round((S.air?.[s] || 0) * 100)} %`)}</table>
<p class="wr-sm">Мораль за неделю: ${esc(mw)}</p>
${pks.length ? `<h4>Котлы</h4>${pks.map(([p, c]) => `<button class="wr-jl ${c === 'bad' ? 'wr-j-pocket' : 'wr-j-cap'}" data-a="m-log" data-v="${p.h}">${esc(p.n)}: ${divN(p.units)} (${tys(p.men)}) — ${c === 'bad' ? 'наши' : 'противник'}</button>`).join('')}` : ''}
${ops.size ? `<h4>Операции</h4>${[...ops.values()].slice(0, 8).map((o) => `<div class="wr-jl">${esc(o.n)} <small class="wr-dim">до ${R.fmtDM(o.b)}</small></div>`).join('')}` : ''}
<h4>Журнал</h4>${lj || '<p class="wr-dim">Пока без событий.</p>'}`, 'wr-tall');
  }
  logTxt(e) {
    const me = this.S.side;
    if (e.k === 'city') {
      const c = this.M.cities[e.c];
      if (c) return e.side === me ? (/освобожд/.test(e.t) ? `${c.n} освобождён` : `${c.n} взят`) : `${c.n} оставлен`;
    }
    return e.t;
  }
  decision() {
    const S = this.S;
    if (!S || !S.ev.pending.length) return;
    const k = S.ev.pending[0], ev = evByK(k);
    if (!ev) {
      S.ev.pending.shift();
      return this.decision();
    }
    const opts = ev.o.map((o, i) => `<button class="btn wr-opt ${i === 0 ? '' : ''}" data-a="m-ev" data-v="${k}:${i}"><b>${esc(o.n)}</b><small>${esc(o.d)}</small></button>`).join('');
    this.modal(`<small class="wr-gold">Решение · ${R.fmtDate(S.day)}${S.ev.pending.length > 1 ? ` · ещё ${S.ev.pending.length - 1}` : ''}</small><h3>${esc(ev.n)}</h3>
<p class="wr-sm">${esc(ev.t)}</p><div class="wr-opts">${opts}</div><p class="wr-sm wr-dim">Можно закрыть и решить позже — до конца хода.</p>`);
  }
  results() {
    const S = this.S, o = S.over;
    if (!o) return;
    const win = o.win === S.side;
    this.sfx(win ? 'win' : 'lose');
    const fall = Object.entries(S.stat.fall).length, lib = Object.entries(S.stat.lib).length;
    this.modal(`<div class="wr-resh ${win ? 'win' : 'lose'}"><div><small class="wr-gold">${R.fmtDate(o.d)}</small><h3>${win ? 'Победа' : 'Поражение'}</h3><small>${esc(o.why)}</small>${stars(win ? o.stars : 0, 'big')}</div></div>
<table class="wr-tbl"><tr><th></th><th>СССР</th><th>Германия</th></tr>
<tr><td>Потери</td><td>${tys(S.loss.SOV)}</td><td>${tys(S.loss.GER)}</td></tr>
<tr><td>Мораль</td><td>${f0(S.morale.SOV)}</td><td>${f0(S.morale.GER)}</td></tr></table>
<p class="wr-sm">Городов пало: ${fall}, освобождено: ${lib}. Война длилась ${f0(o.d + 1)} ${plural(o.d + 1, 'сутки', 'суток', 'суток')}.</p>
<div class="wr-row2"><button class="btn gold" data-a="m-new2">Новая война</button><button class="btn" data-a="m-hub">К выбору стороны</button></div>`, 'wr-small');
  }
}
