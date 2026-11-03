// «Барбаросса 1941» (v0.8): интерфейс главы «Граница» — хаб кампании (сторона, сложность, главы), брифинг,
// верхняя панель (генерал, дата и погода, цели, приказы), правая колонка (авиация, способности генерала,
// снабжение, разведка, советник), карточка дивизии с прогнозом боя (удар в два касания), «Конец дня»,
// анимация ходов соседей и противника, сводки, решения, итоги главы. Альбомная раскладка — основная.
// День = фаза Германии, затем фаза СССР; в фазу игрока сначала ходят соседи (ИИ), затем игрок.
// Хост (game.js) даёт: sfx {click, select, move, boom, bigBoom, capture, turn, plane, error, win, lose}, exit().
import J from '../data/map_border41.json';
import './barb.css';
import * as R from './rules.js';
import { aiPhase, advise, recon } from './ai.js';
import { dayDate, WEATHER, GENS, PLAYER, CHAPTER, CHAPTERS, GOALS, ABIL, FORMS, DAYS, HIST } from './data.js';
import { BarbMap } from './map.js';
import { counter, spr, toCanvas } from './art.js';
import { hexXY } from './hex.js';
import { portraitURLP } from '../staff/portraits.js';

// для автотестов (tools/e2e-barb.cjs): правила и ИИ главы
if (typeof window !== 'undefined') Object.assign(window, { __bbR: R, __bbAI: aiPhase });

const KEY = 'wf_bb_v1', KEY_META = 'wf_bb_meta', KEY_OPT = 'wf_bb_opt', KEY_PROG = 'wf_bb_prog';
const SPD = [{ n: 'Обычно', hex: 85, fx: 1 }, { n: 'Быстро', hex: 38, fx: 0.5 }, { n: 'Мгновенно', hex: 0, fx: 0 }];
const WDN = { вс: 'воскресенье', пн: 'понедельник', вт: 'вторник', ср: 'среда', чт: 'четверг', пт: 'пятница', сб: 'суббота' };
const RES = { rout: 'Разгром!', win: 'Отход', hold: 'Держатся', fail: 'Отбито' };
const ABIC = { blitz: 'bolt', stuka: 'bomb', boldin: 'tank', exit: 'exit' };
const ABSH = { blitz: 'Блицкриг', stuka: 'Штуки', boldin: 'Болдин', exit: 'Прорыв' };
const BUFN = { blitz: 'Блицкриг', boldin: 'Контрудар Болдина', exit: 'Выход из окружения', dir3: 'Отход', ring: 'Приказ группы', wd25: 'Приказ на отход' };
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const f0 = (v) => Math.round(v).toLocaleString('ru-RU');
const f1 = (v) => (Math.round(v * 10) / 10).toLocaleString('ru-RU');
const f2 = (v) => (Math.round(v * 100) / 100).toLocaleString('ru-RU');
const pc = (v) => Math.round(v * 100);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const raf = () => new Promise((r) => requestAnimationFrame(() => r()));
const cap1 = (s) => (s ? s[0].toUpperCase() + s.slice(1) : '');
const plural = (n, a, b, c) => {
  const k = Math.abs(n) % 100, j = k % 10;
  return k > 10 && k < 20 ? c : j === 1 ? a : j >= 2 && j <= 4 ? b : c;
};
const divN = (n) => `${n} ${plural(n, 'дивизия', 'дивизии', 'дивизий')}`;

// ——— пиксельные значки 11×11 ———
const ICON = {
  plane: ['.....#.....', '....###....', '....###....', '....###....', '###########', '.#########.', '....###....', '....###....', '....###....', '...#####...', '...........'],
  bolt: ['.....####..', '....####...', '...####....', '..####.....', '.########..', '....####...', '...####....', '..###......', '.##........', '#..........', '...........'],
  bomb: ['..#..#..#..', '...#.#.#...', '....###....', '...#####...', '..#######..', '..#######..', '..#######..', '..#######..', '...#####...', '....###....', '.....#.....'],
  tank: ['.............', '.............', '....#####....', '...#######...', '...##########', '.###########.', '#############', '#.#.#.#.#.#.#', '.###########.', '.............', '.............'],
  exit: ['..####......', '.#....#.....', '#.......#...', '#.......##..', '#...#######.', '#...########', '#...#######.', '#.......##..', '#.......#...', '.#....#.....', '..####......'],
  crate: ['###########', '#.........#', '#.#.....#.#', '#..#...#..#', '#...#.#...#', '#....#....#', '#...#.#...#', '#..#...#..#', '#.#.....#.#', '#.........#', '###########'],
  eye: ['...........', '...........', '...#####...', '.##.....##.', '#....#....#', '#...###...#', '#....#....#', '.##.....##.', '...#####...', '...........', '...........'],
  bulb: ['...#####...', '..#.....#..', '.#...#...#.', '.#..#....#.', '.#.......#.', '..#.....#..', '...#...#...', '...#####...', '...#####...', '....###....', '...........'],
  undo: ['....#......', '...##......', '..#######..', '.#########.', '..##.....##', '...#......#', '..........#', '..........#', '.........##', '....######.', '...........'],
  next: ['...........', '.#....#....', '.##...##...', '..##...##..', '...##...##.', '....##...##', '...##...##.', '..##...##..', '.##...##...', '.#....#....', '...........'],
  star: ['.....#.....', '.....#.....', '....###....', '###########', '.#########.', '..#######..', '..#######..', '.####.####.', '.###...###.', '.#.......#.', '...........'],
};
const icURL = new Map();
function ic(k, col = '#f1e7c8') {
  const key = k + col;
  let u = icURL.get(key);
  if (!u) (u = toCanvas(spr(ICON[k], { '#': col })).toDataURL()), icURL.set(key, u);
  return u;
}
const icon = (k, col, cls = '') => `<img class="bb-ic ${cls}" src="${ic(k, col)}" alt="">`;
const stars = (n, cls = '') => `<span class="bb-stars ${cls}">${[0, 1, 2].map((i) => `<img src="${ic('star', i < n ? '#ffd34a' : '#4d4536')}" alt="">`).join('')}</span>`;
const por = (g, k = 3) => portraitURLP(g, GENS[g].por, GENS[g].nat, k);
const cURL = new WeakMap();
function cImg(S, u) {
  const c = counter(u, u.org / R.orgMax(u), !R.supplied(S, u), R.lvl(u.xp));
  let s = cURL.get(c);
  if (!s) (s = c.toDataURL()), cURL.set(c, s);
  return s;
}

function loadOpt() {
  try {
    const o = JSON.parse(localStorage.getItem(KEY_OPT) || '{}');
    return { side: o.side === 'SOV' ? 'SOV' : 'GER', diff: o.diff >= 0 && o.diff <= 2 ? o.diff : 1, spd: o.spd >= 0 && o.spd < SPD.length ? o.spd : 0, seen: o.seen || 0 };
  } catch {
    return { side: 'GER', diff: 1, spd: 0, seen: 0 };
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
function readProg() {
  try {
    return JSON.parse(localStorage.getItem(KEY_PROG) || '{}') || {};
  } catch {
    return {};
  }
}
const metaTxt = (m) => `${m.side === 'GER' ? 'Гудериан' : 'Голубев'} · ${m.over ? 'итоги главы' : dayDate(m.day).s} · ${R.DIFF[m.diff].toLowerCase()}`;

const TPL = `
<canvas class="bb-cv" data-r="cv"></canvas>
<div class="bb-top" data-r="top">
  <button class="btn icon bb-bmenu" data-a="menu" aria-label="Меню"><i class="bb-burger"></i></button>
  <button class="panel bb-chip bb-gen" data-a="goals" data-r="gen"></button>
  <button class="panel bb-chip bb-goals" data-a="goals" data-r="goals"></button>
  <button class="panel bb-chip bb-cp" data-a="cphelp" data-r="cp"></button>
</div>
<div class="bb-rail" data-r="rail"></div>
<div class="bb-bot" data-r="bot">
  <button class="btn icon bb-undo" data-a="undo" data-r="undo" aria-label="Отменить ход">${icon('undo')}</button>
  <button class="btn icon bb-next" data-a="next" aria-label="Следующая дивизия">${icon('next')}</button>
  <button class="btn gold bb-end" data-a="end" data-r="end"><span>Конец дня</span><small>ход противника</small></button>
</div>
<div class="bb-adv panel hidden" data-r="adv"></div>
<div class="bb-card panel hidden" data-r="card"></div>
<div class="bb-busy panel hidden" data-r="busy"></div>
<div class="bb-toasts" data-r="toasts"></div>
<div class="bb-banner hidden" data-r="banner"></div>
<div class="bb-modal hidden" data-r="modal"></div>
<div class="bb-hub hidden" data-r="hub"></div>`;

export class BarbUI {
  constructor(root, host = {}) {
    this.root = root;
    this.h = host;
    this.opt = loadOpt();
    root.innerHTML = TPL;
    this.$ = {};
    for (const e of root.querySelectorAll('[data-r]')) this.$[e.dataset.r] = e;
    root.addEventListener('click', (e) => this.onClick(e));
    this.S = null;
    this.sess = 0;
    this.inGame = 0;
    this.sel = null;
    this.info = null;
    this.tgt = -1;
    this.atk = null;
    this.mode = '';
    this.undoS = [];
    this.ovr = { sup: 0, rec: 0, adv: 0 };
    this.onResize = () => this.layout();
    window.addEventListener('resize', this.onResize);
  }
  static menuLabel() {
    const m = readMeta();
    return m ? metaTxt(m) : 'Глава 1 «Граница» · 22–30 июня 1941';
  }
  sfx(k) {
    try {
      this.h.sfx?.[k]?.();
    } catch {}
  }
  // ——— жизненный цикл ———
  open() {
    if (!this.map) {
      this.preview = R.newGame(J, { side: this.opt.side, seed: 7 });
      this.map = new BarbMap(this.$.cv, this.preview.M, { onTap: (h) => this.onTap(h), onLong: (h) => this.onLong(h) });
      this.map.setState(this.preview, this.opt.side);
    }
    this.map.pause(false);
    this.layout();
    this.showHub();
  }
  close() {
    if (this.S && this.inGame && (this.S.step === 'player' || this.S.over) && !this.busy && !this.lock) this.saveGame();
    this.sess++;
    this.busy = 0;
    this.lock = 0;
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
    if (this.busy) return (this.skip = 1), this.busyOn(), true;
    if (this.mode) return this.setMode(''), true;
    if (this.sel || this.info) return this.clearSel(), true;
    this.gameMenu();
    return true;
  }
  layout() {
    const W = this.root.clientWidth, H = this.root.clientHeight;
    this.root.classList.toggle('bb-land', W > H);
    this.root.classList.toggle('bb-narrow', W < 620);
    this.root.classList.toggle('bb-short', H < 470);
    this._gen = null;
    if (this.S && this.inGame) this.hud();
    requestAnimationFrame(() => this.inset());
  }
  inset() {
    if (!this.map) return;
    if (!this.inGame) return this.map.setInset(0, 0, 0, 0);
    const st = this.root.style, sv = (k, v) => st.getPropertyValue(k) !== v && st.setProperty(k, v);
    const R0 = this.root.getBoundingClientRect(), top = this.$.top.getBoundingClientRect();
    sv('--toph', `${Math.round(top.bottom - R0.top)}px`);
    const rail = this.$.rail.getBoundingClientRect(), land = this.root.classList.contains('bb-land'), card = this.$.card;
    sv('--railb', `${Math.round(rail.bottom - R0.top)}px`);
    let t = Math.round(top.bottom - R0.top), r = 0, b = 0;
    let l = 0;
    if (land) {
      r = Math.max(0, Math.round(R0.right - rail.left));
      sv('--cardh', '0px');
      if (!card.classList.contains('hidden')) l = Math.max(0, Math.round(card.getBoundingClientRect().right - R0.left));
      sv('--cardw', `${l}px`);
      sv('--railw', `${r}px`);
    } else {
      sv('--cardh', `${card.classList.contains('hidden') ? 0 : Math.round(card.getBoundingClientRect().height + 6)}px`);
      sv('--cardw', '0px');
      sv('--railw', '0px');
      t = Math.round(rail.bottom - R0.top);
      b = Math.max(0, Math.round(R0.bottom - this.$.bot.getBoundingClientRect().top));
    }
    this.map.setInset(l, t, r, b);
  }
  // ——— хаб ———
  showHub() {
    this.inGame = 0;
    this.sess++;
    this.S = null;
    this.busy = 0;
    this.lock = 0;
    this.sel = null;
    this.info = null;
    this.mode = '';
    this.root.classList.add('bb-hubmode');
    this.busyOff();
    this.$.card.classList.add('hidden');
    this.$.adv.classList.add('hidden');
    this.$.toasts.innerHTML = '';
    const m = readMeta(), o = this.opt, P = readProg().border || {};
    const side = (s) => {
      const k = PLAYER[s].gen, g = GENS[k];
      return `<button class="bb-side panel ${o.side === s ? 'on' : ''}" data-a="o-side" data-v="${s}"><img class="bb-por" src="${por(k)}" alt="">
<span class="bb-sw"><b class="bb-nat">${s === 'GER' ? 'Германия' : 'СССР'}</b><span class="bb-sn">${esc(g.n)}</span><small>${esc(cap1(g.rank))}, ${esc(g.post)}</small>
<small class="bb-dim">${s === 'GER' ? 'Сомкнуть клещи у Минска, окружить армии Западного фронта.' : 'Вывести 10-ю армию из Белостокского выступа.'}</small>${stars(P[s] || 0)}</span></button>`;
    };
    this.$.hub.innerHTML = `<div class="bb-hubw">
<div class="bb-hh"><div class="bb-ht">Барбаросса 1941</div><div class="bb-hs">Кампания · группа армий «Центр» против Западного фронта</div></div>
<div class="bb-hcols"><div><h4>Сторона</h4><div class="bb-sides">${side('GER')}${side('SOV')}</div></div>
<div>${m ? `<button class="btn gold bb-wide bb-hcont" data-a="cont">Продолжить<small>${esc(metaTxt(m))}</small></button>` : ''}
<h4>Сложность</h4><div class="bb-seg panel">${R.DIFF.map((n, i) => `<button data-a="o-diff" data-v="${i}" class="${o.diff === i ? 'on' : ''}">${n}</button>`).join('')}</div>
<h4>Главы кампании</h4><div class="bb-chs">${CHAPTERS.map((c, i) => `<div class="bb-ch ${c.open ? 'open' : 'lock'}"><b>${i + 1}. ${esc(c.n)}</b><small>${esc(c.d)}</small>${c.open ? stars(Math.max(P.GER || 0, P.SOV || 0)) : '<span class="bb-soon">скоро</span>'}</div>`).join('')}</div>
<button class="btn ${m ? '' : 'gold'} bb-wide" data-a="new">${m ? 'Начать главу заново' : 'Начать главу «Граница»'}<small>${o.side === 'GER' ? 'Гудериан, 2-я танковая группа' : 'Голубев, 10-я армия'} · ${R.DIFF[o.diff].toLowerCase()}</small></button>
<div class="bb-row2"><button class="btn" data-a="help">Как играть</button><button class="btn" data-a="exit">В меню</button></div></div></div>
</div>`;
    this.$.hub.classList.remove('hidden');
    this.$.hub.scrollTop = 0;
    this.map.setState(this.preview, o.side);
    this.map.setOverlay({ fog: false, goals: [this.preview.M.cityHex('Минск')] });
    this.inset();
  }
  saveOpt() {
    try {
      localStorage.setItem(KEY_OPT, JSON.stringify(this.opt));
    } catch {}
  }
  startNew() {
    const o = this.opt;
    const S = R.newGame(J, { side: o.side, diff: o.diff, seed: (Date.now() % 1e9) >>> 0 });
    this.enter(S);
    this.briefing(() => this.flow());
  }
  cont() {
    let S;
    try {
      S = R.load(J, localStorage.getItem(KEY));
    } catch (e) {
      this.toast('Сохранение повреждено', String(e.message || e));
      return;
    }
    this.enter(S);
    if (S.over) this.results();
    else this.flow();
  }
  enter(S) {
    this.S = S;
    this.inGame = 1;
    this.sess++;
    this.busy = 0;
    this.lock = 0;
    this.undoS = [];
    this.mode = '';
    this.ovr = { sup: 0, rec: 0, adv: 0 };
    this.$.hub.classList.add('hidden');
    this.root.classList.remove('bb-hubmode');
    this.$.toasts.innerHTML = '';
    this.clearSel(true);
    this.map.setState(S, S.side);
    this.layout();
    this.overlay();
    const h0 = S.M.cityHex(S.side === 'GER' ? 'Брест' : 'Белосток');
    requestAnimationFrame(() => (this.inset(), this.map.center(h0, false)));
  }
  saveGame() {
    const S = this.S;
    if (!S) return;
    try {
      localStorage.setItem(KEY, R.save(S));
      localStorage.setItem(KEY_META, JSON.stringify({ v: 1, side: S.side, diff: S.diff, day: S.day, over: S.over ? 1 : 0, stars: S.over?.stars || 0 }));
    } catch {
      this.toast('Не удалось сохранить', 'Мало места в памяти браузера.');
    }
  }
  // ——— ход дня ———
  live(my) {
    return my === this.sess && this.inGame;
  }
  async flow() {
    const S = this.S, my = this.sess;
    this.hud();
    while (S && !S.over && this.live(my)) {
      if (S.step === 'new') {
        if (S.ph === 'GER') await this.dayBanner();
        if (!this.live(my)) return;
        R.beginPhase(S, S.ph);
        this.events(R.takeEvents(S));
        this.hud();
        this.overlay();
      }
      if (S.step === 'ally') {
        if (S.ph === S.side) {
          const D = R.pendingDecision(S);
          if (D) await this.decision(D);
          if (!this.live(my)) return;
          const ids = S.units.filter((u) => u.side === S.ph && R.alive(u) && !u.cmd).map((u) => u.id);
          await this.runAI(S.ph, ids, 'ally');
          if (!this.live(my)) return;
          this.headlines(R.takeEvents(S), true);
          S.step = 'player';
        } else {
          const ids = S.units.filter((u) => u.side === S.ph && R.alive(u)).map((u) => u.id);
          await this.runAI(S.ph, ids, 'enemy');
          if (!this.live(my)) return;
          S.step = 'end';
        }
      }
      if (S.step === 'player') return this.playerTurn();
      if (S.step === 'end') {
        R.endPhase(S, S.ph);
        this.headlines(R.takeEvents(S));
        this.hud();
        this.overlay();
      }
      if (S.step === 'done') {
        if (S.ph === 'GER') (S.ph = 'SOV'), (S.step = 'new');
        else R.endDay(S);
        this.hud();
      }
    }
    if (S && S.over && this.live(my)) {
      this.saveGame();
      this.hud();
      this.overlay();
      await sleep(600);
      if (this.live(my)) this.results();
    }
  }
  async runAI(side, ids, kind) {
    const S = this.S, my = this.sess;
    this.busy = 1;
    this.skip = this.opt.spd >= 2 ? 1 : 0;
    this.kind = kind;
    this.busyOn();
    this.hud();
    this.overlay();
    let t0 = performance.now();
    for (const e of aiPhase(S, side, ids)) {
      if (!this.live(my)) return;
      if (!this.skip) await this.animEv(e, side);
      else if (performance.now() - t0 > 30) {
        this.map.req();
        await raf();
        t0 = performance.now();
      }
    }
    if (!this.live(my)) return;
    this.busy = 0;
    this.busyOff();
    this.map.req();
  }
  async look(h, imp) {
    if (this.map.onScreen(h, 0.04)) return true;
    if (!imp || this.skip) return false;
    await this.map.center(h, true, 240);
    return true;
  }
  async animEv(e, side) {
    const S = this.S, M = S.M, V = R.vis(S, S.side), sp = SPD[this.opt.spd], mine = side === S.side;
    if (e.k === 'air') {
      if (!V[e.h] || !(await this.look(e.h, e.killed))) return;
      this.sfx('plane');
      await this.map.fx('plane', e.h, { side, dur: Math.max(1, 640 * sp.fx) });
      this.map.fx('boom', e.h, { dur: 460 });
      this.map.fx('text', e.h, { txt: e.killed ? 'Уничтожена!' : e.step ? '−1 шаг' : 'Удар с воздуха', col: '#bfe4ff' });
      await sleep(160 * sp.fx);
      return;
    }
    if (e.k === 'move') {
      const u = S.U.get(e.id);
      if (!u || !e.path || e.path.length < 2) return;
      if (u.side !== S.side && !e.path.some((h) => V[h])) return;
      if (!e.path.some((h) => this.map.onScreen(h, 0))) return;
      await this.map.animateMove(u, e.path, Math.max(1, sp.hex * (mine ? 0.8 : 1)));
      return;
    }
    if (e.k === 'atk') {
      const a = S.U.get(e.a), d = S.U.get(e.d);
      if (!V[e.dh] && !V[e.from]) return;
      if (!(await this.look(e.dh, e.killed || (d && d.cmd)))) return;
      const now = performance.now();
      if (now - (this.lastBoom || 0) > 140) this.sfx(e.killed ? 'bigBoom' : 'boom'), (this.lastBoom = now);
      const adv = e.adv != null && a && R.alive(a);
      if (adv) {
        const [x, y] = hexXY(M.g, e.from);
        this.map.anim.set(a.id, { x, y });
      }
      const ret = d && R.alive(d) && e.retreat && e.retreat.length > 1;
      if (ret) {
        const [x, y] = hexXY(M.g, e.dh);
        this.map.anim.set(d.id, { x, y });
      }
      await this.map.fx('boom', e.dh, { dur: Math.max(1, 480 * sp.fx) });
      this.map.fx('text', e.dh, { txt: e.killed ? (e.sur ? 'Сдалась!' : 'Разгромлена!') : RES[e.res], col: (e.side === S.side) === (e.res === 'rout' || e.res === 'win' || e.killed) ? '#ffe9a0' : '#ffb0a0' });
      if (ret) await this.map.animateMove(d, e.retreat, Math.max(1, sp.hex * 1.3));
      if (adv) await this.map.animateMove(a, [e.from, e.dh], Math.max(1, sp.hex * 1.6));
      else await sleep(180 * sp.fx);
      this.map.anim.delete(e.a);
      this.map.anim.delete(e.d);
    }
  }
  async dayBanner() {
    const S = this.S, d = dayDate(S.day), wx = WEATHER[S.day] || WEATHER[0], b = this.$.banner;
    b.innerHTML = `<small>День ${S.day + 1} из ${DAYS}</small><b>${d.s} 1941</b><small>${WDN[d.wd] || d.wd} · ${esc(wx.n)}, +${wx.t}°</small>`;
    b.classList.remove('hidden', 'show');
    void b.offsetWidth;
    b.classList.add('show');
    this.sfx('turn');
    await sleep(this.opt.spd >= 2 ? 450 : 1150);
    b.classList.add('hidden');
  }
  playerTurn() {
    const S = this.S;
    this.busy = 0;
    this.skip = 0;
    this.busyOff();
    this.undoS = [];
    this.saveGame();
    this.hud();
    this.overlay();
    const d = dayDate(S.day);
    if (!this.opt.seen) {
      this.opt.seen = 1;
      this.saveOpt();
      this.toast(`Ваш ход · ${d.s}`, 'Нажмите свою дивизию (яркая плашка): светлые гексы — куда дойдёт, красные рамки — кого может атаковать.');
    } else this.toast(`Ваш ход · ${d.s}`, `Приказов: ${S.cp} · авиаударов: ${S.air}${this.readyAbil().length ? ' · есть готовая способность' : ''}`);
  }
  readyAbil() {
    return Object.keys(this.S.abil).filter((k) => R.abilReady(this.S, k));
  }
  canAct(u) {
    const S = this.S;
    if (!u.cmd || u.side !== S.side || !R.alive(u)) return false;
    return u.mp > 0 || (R.canAttack(S, u) && R.enemyAdj(S, u.c, u.side, R.vis(S, S.side)));
  }
  endTurn(force) {
    const S = this.S;
    if (!this.inGame || this.busy || this.lock || !S || S.step !== 'player') return;
    if (!force) {
      const n = S.units.filter((u) => u.cmd && u.side === S.side && R.alive(u) && !u.mv && !u.at && u.mp > 0).length;
      if (n) return this.confirm('Конец дня', `${divN(n)} ещё не ${n === 1 ? 'получила' : 'получили'} приказа. Завершить ход?`, 'Завершить', () => this.endTurn(true));
    }
    this.sfx('click');
    this.clearSel(true);
    this.setMode('', true);
    this.ovr.rec = 0;
    this.ovr.adv = 0;
    this.renderAdv();
    this.undoS = [];
    S.step = 'end';
    this.flow();
  }
  // ——— сводки ———
  events(evs) {
    const S = this.S;
    for (const e of evs) {
      if (e.k === 'cap') {
        this.toast(`${e.side === S.side ? 'Взят' : 'Потерян'}: ${e.city}`, e.side === S.side ? 'Город под нашим контролем.' : 'Город занят противником.', e.h, e.side === S.side ? 'ok' : 'bad');
        if (e.side === S.side) this.sfx('capture');
      } else if (e.k === 'kill' || e.k === 'sur') {
        const u = S.U.get(e.id);
        if (u) this.toast(`${e.k === 'sur' ? 'Сдалась' : 'Разгромлена'} ${u.name}`, u.side === S.side ? 'Тяжёлая потеря.' : 'Противник лишился дивизии.', e.h, u.side === S.side ? 'bad' : 'ok');
      } else if (e.k === 'arr' && e.side === S.side) {
        const u = S.U.get(e.id);
        if (u) this.toast(`Прибыла ${u.name}`, u.cmd ? 'Поступает в ваше распоряжение.' : 'Подкрепление соседям.', e.h);
      } else if (e.k === 'pocket') this.pocketToast(e);
    }
  }
  pocketToast(e) {
    const S = this.S, nm = R.pocketName({ name: e.name });
    if (e.side === S.side) this.toast('Окружение!', `${nm}: в кольце ${divN(e.n)} — пробивайтесь или ждите деблокады.`, e.h, 'bad');
    else this.toast('Котёл!', `${nm}: в кольце ${divN(e.n)} противника.`, e.h, 'ok');
  }
  headlines(evs, quiet) {
    const S = this.S, L = [];
    for (const e of evs) {
      if (e.k === 'combat') continue;
      if (e.k === 'cap') {
        const c = S.M.cities[S.M.cityAt[e.h]], goal = GOALS[S.side].some((g) => g.city === e.city);
        if (!c || (c.vp < 2 && !goal && HIST[e.city] == null)) continue;
      }
      if (e.k === 'arr' && e.side !== S.side) continue;
      if ((e.k === 'kill' || e.k === 'sur') && (e.w || 0) < 3) continue;
      L.push(e);
    }
    L.sort((a, b) => (b.w || 0) - (a.w || 0));
    this.events(L.slice(0, quiet ? 2 : 4));
  }
  toast(title, txt = '', h = -1, cls = '') {
    const T = this.$.toasts;
    if (T.lastElementChild && T.lastElementChild.dataset.t === title + txt) return;
    const el = document.createElement('div');
    el.className = `bb-toast panel ${cls}`;
    el.dataset.t = title + txt;
    el.innerHTML = `<b>${esc(title)}</b>${txt ? `<small>${esc(txt)}</small>` : ''}`;
    T.appendChild(el);
    while (T.children.length > 2) T.firstElementChild.remove();
    setTimeout(() => el.classList.add('out'), 3000);
    setTimeout(() => el.remove(), 3500);
  }
  busyOn() {
    const b = this.$.busy, S = this.S;
    if (!S) return;
    const txt = this.kind === 'ally' ? 'Ходят соседи — войска группы и армий рядом' : `Ход противника · ${S.ph === 'GER' ? 'группа армий «Центр»' : 'Западный фронт'}`;
    b.innerHTML = `<i class="bb-spin"></i><span>${esc(txt)}</span>${this.skip ? '' : '<button class="btn bb-skip" data-a="skip">Быстрее »</button>'}`;
    b.classList.remove('hidden');
    this.root.classList.add('bb-busym');
  }
  busyOff() {
    this.$.busy.classList.add('hidden');
    this.root.classList.remove('bb-busym');
  }
  // ——— верхняя панель, колонка, кнопки ———
  hud() {
    const S = this.S;
    if (!S || !this.inGame) return;
    const d = dayDate(S.day), wx = WEATHER[S.day] || WEATHER[0], gk = PLAYER[S.side].gen;
    const ph = S.over ? 'итоги главы' : this.busy ? (S.ph === S.side ? 'ходят соседи' : 'ход противника') : S.step === 'player' ? 'ваш ход' : '…';
    const pcls = S.step === 'player' && !this.busy ? 'bb-gold' : 'bb-dim';
    const g = `<img class="bb-pm" src="${por(gk, 2)}" alt=""><span><b>${d.s}, ${d.wd}</b><small>День ${S.day + 1}/${DAYS}<span class="bb-wx"> · ${esc(wx.n)}, +${wx.t}°</span> · <i class="${pcls}">${ph}</i></small></span>`;
    if (this._gen !== g || !this.$.gen.firstChild) {
      this._gen = g;
      this.$.gen.innerHTML = g;
      // погода — только если строка помещается целиком
      const sm = this.$.gen.querySelector('small');
      if (sm && sm.scrollWidth > sm.clientWidth + 1) this.$.gen.querySelector('.bb-wx')?.remove();
    }
    const G = R.goalList(S);
    const gl = `${icon('star', '#ffd34a')}${G.map((x) => `<span class="bb-g ${x.main ? 'main' : ''} ${x.fail ? 'fail' : x.done || (x.ok && x.main) ? 'ok' : ''}">${esc(x.sh)}${x.main || x.k === 'save' ? ` <b>${esc(x.prog)}</b>` : ''}</span>`).join('')}`;
    if (this.$.goals.innerHTML !== gl) this.$.goals.innerHTML = gl;
    const cpMax = R.NAT[S.side].cp + 1, pl = S.step === 'player' && !this.busy;
    const cp = `<span>Приказы</span><span class="bb-pips">${Array.from({ length: Math.max(cpMax, S.cp) }, (_, i) => `<i class="${i < S.cp ? 'on' : ''}"></i>`).join('')}</span>`;
    if (this.$.cp.innerHTML !== cp) this.$.cp.innerHTML = cp;
    const rb = (a, v, ik, label, on, dim, badge) => `<button class="btn bb-rb ${on ? 'on' : ''} ${dim ? 'dim' : ''}" data-a="${a}" data-v="${v}">${icon(ik)}<span>${label}</span>${badge ? `<i class="badge">${badge}</i>` : ''}</button>`;
    const rail = rb('air', '', 'plane', 'Авиация', this.mode === 'air', !pl || S.air <= 0, S.air > 0 ? S.air : '')
      + Object.keys(S.abil).map((k) => rb('abil', k, ABIC[k], ABSH[k], false, !pl || !R.abilReady(S, k), pl && R.abilReady(S, k) ? '!' : '')).join('')
      + rb('sup', '', 'crate', 'Снабжение', this.ovr.sup, false, '')
      + rb('rec', '', 'eye', 'Разведка', this.ovr.rec, !pl, '')
      + rb('adv', '', 'bulb', 'Советник', this.ovr.adv, !pl, '');
    if (this.$.rail.innerHTML !== rail) this.$.rail.innerHTML = rail;
    this.$.undo.disabled = !pl || !this.undoS.length;
    const left = pl ? S.units.filter((u) => this.canAct(u)).length : 0;
    this.$.end.disabled = !pl;
    this.$.end.classList.toggle('bb-pulse', pl && left === 0);
    const sub = S.over ? 'итоги' : !pl ? (this.busy ? 'идёт ход…' : '…') : S.side === 'GER' ? 'ход СССР' : 'следующий день';
    const eh = `<span>${S.over ? 'Итоги' : 'Конец дня'}</span><small>${sub}</small>`;
    if (this.$.end.innerHTML !== eh) this.$.end.innerHTML = eh;
    this.$.end.disabled = !pl && !S.over;
  }
  goalHexes() {
    const S = this.S;
    return GOALS[S.side].filter((g) => g.city).map((g) => S.M.cityHex(g.city)).filter((h) => h >= 0);
  }
  overlay() {
    const S = this.S;
    if (!S || !this.map || !this.inGame) return;
    const V = R.vis(S, S.side), o = { fog: true, turn: S.step === 'player' && !this.busy, sel: -1, tgt: -1, flash: this.flash ?? -1 };
    const u = this.sel ? S.U.get(this.sel) : null;
    if (u && R.alive(u)) {
      o.sel = u.c;
      if (this.tgt < 0) (o.reach = this.dests), (o.atk = this.targets);
      else {
        o.tgt = this.tgt;
        if (this.atk && this.atk.path.length > 1) o.path = this.atk.path;
      }
    } else if (this.info && this.info.u) {
      const x = S.U.get(this.info.u);
      if (x && R.alive(x)) o.sel = x.c;
    } else if (this.info && this.info.h >= 0) o.sel = this.info.h;
    if (this.mode === 'air') o.air = this.airT;
    o.goals = this.goalHexes();
    const pk = R.pockets(S, S.side).filter((p) => p.units.length >= 2);
    for (const p of R.pockets(S, R.other(S.side))) if (p.units.length >= 2 && p.units.some((id) => V[S.U.get(id).c])) pk.push(p);
    o.pockets = pk;
    if (this.ovr.sup) o.supply = true;
    if (this.ovr.rec && this.recC) o.recon = this.recC;
    if (this.ovr.adv && this.advC) o.adv = this.advC.map((s) => ({ from: S.U.get(s.id)?.c ?? s.to, to: s.to, k: s.k === 'atk' ? 'atk' : 'move' })).filter((r) => r.from !== r.to);
    this.map.setOverlay(o);
  }
  // ——— выбор и действия ———
  visUnit(h) {
    const S = this.S, u = R.unitAt(S, h);
    if (!u) return null;
    if (u.side !== S.side && !R.vis(S, S.side)[h]) return null;
    return u;
  }
  clearSel(quiet) {
    this.sel = null;
    this.info = null;
    this.tgt = -1;
    this.atk = null;
    this.R = null;
    this.dests = null;
    this.targets = null;
    this.flash = -1;
    if (!quiet) this.sfx('click');
    this.renderCard();
    this.overlay();
  }
  select(u, quiet) {
    const S = this.S;
    this.sel = u.id;
    this.info = null;
    this.tgt = -1;
    this.atk = null;
    this.flash = -1;
    this.R = R.reach(S, u, R.vis(S, S.side));
    this.dests = new Set(R.dests(S, u, this.R));
    this.targets = this.atkTargets(u);
    if (!quiet) this.sfx('select');
    this.renderCard();
    this.overlay();
    if (!this.map.onScreen(u.c, 0.06)) this.map.center(u.c);
  }
  slowOK(u, path) {
    return !R.footSlow(u) || (u.st || 0) + path.length - 1 <= 1;
  }
  atkOpt(u, th) {
    const S = this.S, M = S.M;
    if (!R.canAttack(S, u)) return null;
    const d = R.unitAt(S, th);
    if (!d || d.side === u.side) return null;
    let best = null;
    const take = (from, path) => {
      const fc = R.forecast(S, u, d, from), sc = fc.pWin + fc.pRout * 0.3 - (path.length - 1) * 0.02;
      if (!best || sc > best.sc) best = { from, path, fc, sc };
    };
    if (M.nbr[u.c].includes(th)) take(u.c, [u.c]);
    if (this.R && this.sel === u.id)
      for (const j of M.nbr[th]) {
        if (j === u.c || !this.dests.has(j)) continue;
        const path = R.pathTo(this.R, j);
        if (this.slowOK(u, path)) take(j, path);
      }
    return best;
  }
  atkTargets(u) {
    const S = this.S, V = R.vis(S, S.side), out = new Set();
    if (!R.canAttack(S, u)) return out;
    for (const e of S.units) {
      if (!R.alive(e) || e.side === u.side || !V[e.c] || S.M.dist(u.c, e.c) > u.mp + 1) continue;
      if (S.M.nbr[u.c].includes(e.c)) {
        out.add(e.c);
        continue;
      }
      for (const j of S.M.nbr[e.c])
        if (this.dests.has(j) && this.slowOK(u, R.pathTo(this.R, j))) {
          out.add(e.c);
          break;
        }
    }
    return out;
  }
  bestAttacker(th) {
    const S = this.S, d = R.unitAt(S, th);
    let best = null, bp = -1;
    for (const j of S.M.nbr[th]) {
      const u = R.unitAt(S, j);
      if (!u || !u.cmd || u.side !== S.side || !R.canAttack(S, u)) continue;
      const p = R.forecast(S, u, d, u.c).pWin;
      if (p > bp) (bp = p), (best = u);
    }
    return best;
  }
  onTap(h) {
    if (!this.inGame || !this.S || this.lock) return;
    const S = this.S;
    if (h < 0) return this.clearSel(true);
    if (this.busy || S.step !== 'player') {
      const u = this.visUnit(h);
      this.sel = null;
      this.info = u ? { u: u.id } : null;
      this.renderCard();
      this.overlay();
      return;
    }
    if (this.mode === 'air') return this.airAt(h);
    const u = this.visUnit(h), me = this.sel ? S.U.get(this.sel) : null;
    if (u && u.side === S.side) {
      if (u.cmd) {
        if (me === u && this.tgt < 0) return this.clearSel();
        return this.select(u);
      }
      this.clearSel(true);
      this.info = { u: u.id };
      this.sfx('select');
      return this.renderCard(), this.overlay();
    }
    if (u) {
      if (me && this.targets?.has(h)) {
        if (this.tgt === h) return this.attack();
        return this.target(me, h);
      }
      const b = this.bestAttacker(h);
      if (b) {
        this.select(b, true);
        return this.target(b, h);
      }
      this.clearSel(true);
      this.info = { u: u.id, why: me ? 'none' : '' };
      this.sfx('select');
      return this.renderCard(), this.overlay();
    }
    if (me && this.dests?.has(h)) return this.moveTo(me, h);
    if (S.M.cityAt[h] >= 0) {
      this.clearSel(true);
      this.info = { h };
      return this.renderCard(), this.overlay();
    }
    this.clearSel(true);
  }
  onLong(h) {
    if (!this.inGame || !this.S || this.lock) return;
    const u = this.visUnit(h);
    this.sel = null;
    this.tgt = -1;
    this.info = u ? { u: u.id } : { h };
    this.sfx('select');
    this.renderCard();
    this.overlay();
  }
  target(u, h) {
    this.tgt = h;
    this.atk = this.atkOpt(u, h);
    if (!this.atk) return this.select(u, true);
    this.sfx('select');
    this.renderCard();
    this.overlay();
  }
  pushUndo(u) {
    this.undoS.push({ s: R.snap(this.S), id: u ? u.id : null });
    if (this.undoS.length > 30) this.undoS.shift();
  }
  async moveTo(u, h) {
    const S = this.S, path = R.pathTo(this.R, h);
    if (path.length < 2) return;
    this.pushUndo(u);
    this.lock = 1;
    const m = R.doMove(S, u, path);
    this.sfx('move');
    this.dests = null;
    this.targets = null;
    this.overlay();
    await this.map.animateMove(u, m.path, Math.max(1, SPD[this.opt.spd].hex));
    this.lock = 0;
    if (!this.inGame) return;
    if (m.stop) this.toast('Встреча с противником', 'Разведка не видела этих войск — марш остановлен.', u.c, 'bad');
    this.events(R.takeEvents(S));
    this.afterAct(u);
  }
  async attack() {
    const S = this.S, u = S.U.get(this.sel), A = this.atk, th = this.tgt;
    if (!u || !A || this.lock || this.busy) return;
    this.lock = 1;
    if (A.from !== u.c) {
      const m = R.doMove(S, u, A.path);
      this.sfx('move');
      this.dests = null;
      this.overlay();
      await this.map.animateMove(u, m.path, Math.max(1, SPD[this.opt.spd].hex));
      if (!this.inGame) return;
      if (!S.M.nbr[u.c].includes(th) || !R.unitAt(S, th) || !R.canAttack(S, u)) {
        this.lock = 0;
        this.undoS = [];
        this.toast('Удар сорван', 'На пути оказался противник — дивизия остановилась.', u.c, 'bad');
        this.events(R.takeEvents(S));
        return this.afterAct(u);
      }
    }
    const r = R.doAttack(S, u, th, u.c);
    this.undoS = [];
    this.tgt = -1;
    this.atk = null;
    this.dests = null;
    this.targets = null;
    this.overlay();
    if (r) await this.animEv({ k: 'atk', ...r }, S.side);
    this.lock = 0;
    if (!this.inGame) return;
    this.events(R.takeEvents(S));
    this.afterAct(u);
  }
  afterAct(u) {
    const S = this.S;
    this.tgt = -1;
    this.atk = null;
    if (this.ovr.adv) this.advC = advise(S, 3);
    if (u && R.alive(u) && this.canAct(u)) this.select(u, true);
    else this.clearSel(true);
    this.renderAdv();
    this.hud();
    this.saveGame();
    if (S.step === 'player' && !S.units.some((x) => this.canAct(x))) this.toast('Все приказы отданы', 'Дивизии сделали всё, что могли. Нажмите «Конец дня».');
  }
  undo() {
    const S = this.S;
    if (this.busy || this.lock || !this.undoS.length) return;
    const x = this.undoS.pop();
    R.restore(S, x.s);
    this.sfx('click');
    const u = x.id ? S.U.get(x.id) : null;
    if (u && R.alive(u)) this.select(u, true);
    else this.clearSel(true);
    if (this.ovr.adv) (this.advC = advise(S, 3)), this.renderAdv();
    this.hud();
    this.overlay();
    this.saveGame();
  }
  nextUnit() {
    const S = this.S;
    if (!S || S.step !== 'player' || this.busy) return;
    const L = S.units.filter((u) => this.canAct(u));
    if (!L.length) return this.toast('Все приказы отданы', 'Нажмите «Конец дня».');
    const i = L.findIndex((u) => u.id === this.sel), u = L[(i + 1) % L.length];
    this.select(u);
    this.map.center(u.c);
  }
  doOrder(k) {
    const S = this.S, u = S.U.get(this.sel);
    if (!u || S.step !== 'player' || this.busy || this.lock) return;
    if (k === 'prep' && R.canPrep(S, u)) this.pushUndo(u), R.doPrep(S, u), this.toast('Артподготовка', `${u.sh}: следующий удар +25%.`, u.c);
    else if (k === 'march' && R.canMarch(S, u)) this.pushUndo(u), R.doMarch(S, u), this.toast('Марш-бросок', `${u.sh}: ход ${u.mp}, организация −10%.`, u.c);
    else if (k === 'refit' && R.canRefit(S, u)) {
      this.pushUndo(u);
      const n = R.doRefit(S, u);
      this.toast('Пополнение', `${u.sh}: сила +${n}. Дивизия сегодня стоит на месте.`, u.c, 'ok');
    } else return this.sfx('error');
    this.sfx('capture');
    this.select(u, true);
    this.hud();
    this.saveGame();
  }
  // ——— авиация и способности ———
  setMode(m, quiet) {
    const S = this.S;
    if (m === 'air') {
      if (S.step !== 'player' || this.busy) return;
      if (S.air <= 0) return this.toast('Авиация', 'На сегодня вылетов не осталось.');
      this.airT = R.airTargets(S, S.side);
      if (!this.airT.size) return this.toast('Авиация', 'Разведка не видит целей — подойдите ближе к противнику.');
      this.clearSel(true);
      this.toast('Авиаудар', `Выберите цель (синие рамки). Вылетов: ${S.air}.${S.side === 'GER' && S.flags.stuka === S.day ? ' «Штуки» бьют точнее и сносят окопы.' : ''}`);
    }
    this.mode = m;
    this.root.classList.toggle('bb-airmode', m === 'air');
    if (!quiet) this.sfx('click');
    this.hud();
    this.overlay();
  }
  async airAt(h) {
    const S = this.S;
    if (!this.airT?.has(h) || S.air <= 0) return this.setMode('');
    this.lock = 1;
    const r = R.doAir(S, S.side, h, S.side === 'GER' && S.flags.stuka === S.day);
    S.air--;
    this.undoS = [];
    this.hud();
    if (r) await this.animEv({ k: 'air', ...r }, S.side);
    this.lock = 0;
    if (!this.inGame) return;
    this.events(R.takeEvents(S));
    this.airT = R.airTargets(S, S.side);
    if (S.air <= 0 || !this.airT.size) this.setMode('', true);
    this.hud();
    this.overlay();
    this.saveGame();
  }
  abilDlg(k) {
    const S = this.S, A = ABIL[k], a = S.abil[k], ok = R.abilReady(S, k), pl = S.step === 'player' && !this.busy;
    let why = '';
    if (!ok) why = a.used ? 'Уже использована в этой главе.' : A.until != null && S.day >= A.until ? `Была доступна только до ${dayDate(A.until - 1).s}.` : k === 'boldin' && S.dec.dir3 === 'wd' ? 'Контрудар отменён: вы выбрали отход.' : `Будет готова ${dayDate(a.rdy).s}.`;
    else if (!pl) why = 'Применить можно в свой ход.';
    if (ok && k === 'exit' && !S.units.some((u) => u.cmd && R.alive(u) && u.side === S.side && !R.supplied(S, u))) why = 'Сейчас все ваши дивизии на снабжении — способность ничего не даст.';
    this.modal(`<div class="bb-abh"><img class="bb-abi" src="${ic(ABIC[k], '#ffd34a')}" alt=""><div><h3>${esc(A.n)}</h3><small class="bb-dim">${A.cd >= 9 ? 'Один раз за главу' : `Перезарядка — ${A.cd} дня`}${A.until != null ? ` · до ${dayDate(A.until - 1).s}` : ''}</small></div></div>
<p>${esc(A.d)}</p>${why ? `<p class="bb-warn">${esc(why)}</p>` : ''}
<div class="bb-row2"><button class="btn" data-a="mclose">Закрыть</button>${ok && pl ? '<button class="btn gold" data-a="mok">Применить</button>' : ''}</div>`);
    this.onOk = () => this.useAbil(k);
  }
  useAbil(k) {
    const S = this.S;
    if (!R.abilReady(S, k) || S.step !== 'player') return;
    R.useAbil(S, k);
    this.undoS = [];
    this.sfx(k === 'stuka' ? 'plane' : 'capture');
    this.toast(ABIL[k].n, k === 'stuka' ? `Авиаударов сегодня: ${S.air}.` : 'Приказ передан в войска.');
    this.events(R.takeEvents(S));
    const u = this.sel ? S.U.get(this.sel) : null;
    if (u && R.alive(u)) this.select(u, true);
    this.hud();
    this.overlay();
    this.renderCard();
    this.saveGame();
  }
  toggle(k) {
    const S = this.S;
    if (k !== 'sup' && (S.step !== 'player' || this.busy)) return;
    this.ovr[k] = this.ovr[k] ? 0 : 1;
    this.sfx('click');
    if (k === 'rec' && this.ovr.rec) {
      this.recC = recon(S, S.side, 6);
      this.toast('Разведка', this.recC.length ? 'Вероятные действия противника: красные стрелки — удары, пунктир — марши.' : 'Разведка не заметила подготовки противника.');
    }
    if (k === 'adv') {
      this.advC = this.ovr.adv ? advise(S, 3) : null;
      this.renderAdv();
    }
    if (k === 'sup' && this.ovr.sup) {
      const n = S.units.filter((u) => u.side === S.side && R.alive(u) && !R.supplied(S, u)).length;
      this.toast('Снабжение', n ? `Без снабжения: ${divN(n)} (красная штриховка). Котлы обведены пунктиром.` : 'Все ваши войска на снабжении.');
    }
    this.hud();
    this.overlay();
  }
  renderAdv() {
    const el = this.$.adv, S = this.S;
    if (!S || !this.ovr.adv || !this.advC) return el.classList.add('hidden');
    const L = this.advC.map((s, i) => {
      const u = S.U.get(s.id), d = s.k === 'atk' ? R.unitAt(S, s.to) : null;
      if (!u) return '';
      const t = s.k === 'atk' ? `удар по ${d ? d.sh : 'противнику'} · ${pc(s.p)}%` : s.k === 'refit' ? 'пополнить' : `марш${s.goal ? ` к ${s.goal}` : ''}`;
      return `<button class="bb-ai" data-a="advgo" data-v="${i}"><img src="${cImg(S, u)}" alt=""><span><b>${esc(u.sh)}</b><small>${esc(t)}</small></span></button>`;
    }).join('');
    el.innerHTML = `<div class="bb-advh">${icon('bulb', '#ffd34a')}<b>Советник штаба</b></div>${L || '<small class="bb-dim">Предложений нет — действуйте по обстановке.</small>'}`;
    el.classList.remove('hidden');
  }
  advGo(i) {
    const S = this.S, s = this.advC?.[i];
    if (!s || S.step !== 'player' || this.busy) return;
    const u = S.U.get(s.id);
    if (!u || !R.alive(u)) return;
    this.select(u);
    if (s.k === 'atk' && this.targets.has(s.to)) this.target(u, s.to);
    else if (s.k === 'move') (this.flash = s.to), this.overlay();
    this.map.center(u.c);
  }
  // ——— карточка ———
  renderCard() {
    const S = this.S, c = this.$.card;
    let html = '';
    if (S && this.inGame) {
      const u = this.sel ? S.U.get(this.sel) : null;
      if (u && R.alive(u)) html = this.tgt >= 0 && this.atk ? this.miniHTML(u) + this.fcHTML(u) : this.unitHTML(u) + this.actsHTML(u);
      else if (this.info && this.info.u) {
        const x = S.U.get(this.info.u);
        if (x && R.alive(x)) html = this.unitHTML(x) + (x.side !== S.side && this.info.why === 'none' ? '<p class="bb-hint">Выбранная дивизия не дотягивается до этой цели.</p>' : x.side !== S.side ? '<p class="bb-hint">Чтобы ударить, выберите свою дивизию рядом.</p>' : '');
      } else if (this.info && this.info.h >= 0) html = this.hexHTML(this.info.h);
    }
    if (!html) {
      if (!c.classList.contains('hidden')) c.classList.add('hidden'), this.inset();
      return;
    }
    c.innerHTML = `<button class="bb-cx" data-a="cclose" aria-label="Закрыть">×</button>${html}`;
    c.classList.remove('hidden');
    this.inset();
  }
  unitHTML(u) {
    const S = this.S, F = FORMS[u.fm], T = FORMS[u.top], own = u.side === S.side;
    const sub = [F && u.fm !== u.top ? F.n : null, T ? T.n : null].filter(Boolean).join(' · ');
    const om = R.orgMax(u), org = Math.round((100 * u.org) / om), sup = R.supplied(S, u), k = u.str / u.str0;
    const bar = (v, cls) => `<span class="bb-bar ${cls}"><i style="width:${Math.max(0, Math.min(100, Math.round(v * 100)))}%"></i></span>`;
    const tags = [];
    if (own && u.t !== 'gar') tags.push(`Ход <b>${u.mp}/${R.maxMP(S, u)}</b>`);
    if (own && u.t !== 'gar') tags.push(`Атака <b>${Math.max(0, R.maxAtk(S, u) - u.at)}/${R.maxAtk(S, u)}</b>`);
    if (u.ent) tags.push(`Окопы <b>${u.ent}</b>`);
    if (R.lvl(u.xp)) tags.push(cap1(R.VET[R.lvl(u.xp)]));
    tags.push(sup ? '<span class="bb-okc">Снабжение</span>' : `<span class="bb-bad">Нет снабжения${u.oos ? ` · ${u.oos}-й день` : ''}</span>`);
    if (u.prep) tags.push('<span class="bb-gold">Артподготовка</span>');
    if (u.fmch) tags.push('<span class="bb-gold">Марш-бросок</span>');
    if (own) for (const b of R.activeBuffs(S, u)) if (BUFN[b.src]) tags.push(`<span class="bb-gold">${BUFN[b.src]}</span>`);
    if (own && u.cmd && R.footSlow(u) && (u.st || 0) > 1 && u.at < R.maxAtk(S, u)) tags.push('<span class="bb-dim">после марша не атакует</span>');
    const men = `≈${f0(Math.round((u.men * k) / 100) * 100)} чел.${u.tk ? ` · ${f0(u.tk * k)} танков` : ''}${u.gun ? ` · ${f0(u.gun * k)} орудий` : ''}`;
    const who = own ? (u.cmd ? '' : `<p class="bb-hint">Соседи: ведёт штаб ${esc(T ? T.n : '')}${T && T.cmd ? ` (${esc(T.cmd)})` : ''}.</p>`) : `<p class="bb-hint bb-bad">Противник · ${esc(R.TYPES[u.t].n)}</p>`;
    return `<div class="bb-uh"><img class="bb-uc" src="${cImg(S, u)}" alt=""><div><b>${esc(u.t === 'gar' ? 'Брестская крепость (гарнизон)' : u.name)}</b><small>${esc(sub)}${u.cdr ? ` · ${esc(u.cdr)}` : ''}</small></div></div>
<div class="bb-sts"><div class="bb-st"><span>Сила</span>${bar(u.str / 10, 'str')}<b>${u.str}/10</b></div><div class="bb-st"><span>Организация</span>${bar(u.org / om, org > 60 ? 'ok' : org > 30 ? 'mid' : 'low')}<b>${org}%</b></div></div>
<div class="bb-tags">${tags.map((t) => `<span class="bb-tag">${t}</span>`).join('')}</div>${u.cmd && own && this.sel === u.id ? '' : `<div class="bb-men">${men}</div>`}${who}`;
  }
  miniHTML(u) {
    const S = this.S, org = Math.round((100 * u.org) / R.orgMax(u));
    return `<div class="bb-uh bb-mini"><img class="bb-uc" src="${cImg(S, u)}" alt=""><div><b>${esc(u.name)}</b><small>Сила ${u.str}/10 · организация ${org}%${R.supplied(S, u) ? '' : ' · <span class="bb-bad">нет снабжения</span>'}${u.prep ? ' · <span class="bb-gold">артподготовка</span>' : ''}</small></div></div>`;
  }
  actsHTML(u) {
    const S = this.S, pl = S.step === 'player' && !this.busy && !this.lock;
    if (!u.cmd || u.side !== S.side) return '';
    const b = (a, n, ok, d) => `<button class="btn bb-act" data-a="ord" data-v="${a}" ${pl && ok ? '' : 'disabled'}><span>${n}</span><small>${d}</small></button>`;
    let hint = '';
    if (pl && !this.canAct(u)) hint = 'На сегодня дивизия сделала всё.';
    else if (pl && S.day === 0 && this.targets && this.targets.size) hint = 'Красные рамки — цели удара: нажмите цель для прогноза.';
    else if (pl && S.day === 0 && this.dests && this.dests.size) hint = 'Нажмите светлый гекс, чтобы выдвинуться.';
    return `${hint ? `<p class="bb-hint">${hint}</p>` : ''}<div class="bb-acts">${b('prep', 'Артподготовка', R.canPrep(S, u), '+25% к удару')}${b('march', 'Марш-бросок', R.canMarch(S, u), '+ход, −10% орг.')}${b('refit', 'Пополнить', R.canRefit(S, u), '+1–2 силы')}</div>`;
  }
  fcHTML(u) {
    const S = this.S, A = this.atk, d = R.unitAt(S, this.tgt);
    if (!A || !d) return '';
    const f = A.fc;
    const segs = [['rout', f.pRout, 'Разгром'], ['win', Math.max(0, f.pWin - f.pRout), 'Отход'], ['hold', Math.max(0, f.pHold), 'Держатся'], ['fail', f.pFail, 'Отбиты']];
    const bar = segs.map(([k, v]) => (v > 0.004 ? `<i class="bb-f-${k}" style="flex:${v.toFixed(3)}"></i>` : '')).join('');
    const leg = segs.map(([k, v, n]) => `<span class="bb-fk bb-k-${k}"><i></i>${n} <b>${pc(v)}%</b></span>`).join('');
    const mods = (L, def) => L.map(([n, k]) => `<span class="${(k >= 1) !== def ? 'up' : 'dn'}">${esc(n)} ×${f2(k)}</span>`).join('');
    const mv = A.from !== u.c ? `<p class="bb-hint">Сначала марш на ${A.path.length - 1} ${plural(A.path.length - 1, 'гекс', 'гекса', 'гексов')}, затем удар.</p>` : '';
    return `<div class="bb-fc"><div class="bb-fh">Удар по: <b>${esc(d.t === 'gar' ? 'Брестская крепость' : d.name)}</b> · сила ${d.str}, окопы ${d.ent}</div>${mv}
<div class="bb-fbar">${bar}</div><div class="bb-fleg">${leg}</div>
<div class="bb-fv">Атака <b>${f1(f.A)}</b> против обороны <b>${f1(f.D)}</b> — перевес <b>×${f2(f.r)}</b></div>
${f.ma.length || f.md.length ? `<div class="bb-mods">${mods(f.ma, false)}${mods(f.md, true)}</div>` : ''}
<div class="bb-fv bb-dim">Потери (ожид.): наши ≈${f1(f.al)}, их ≈${f1(f.dl)} шага силы</div>
<div class="bb-row2 bb-fbtn"><button class="btn" data-a="tcancel">Отмена</button><button class="btn gold" data-a="attack">Атаковать</button></div></div>`;
  }
  hexHTML(h) {
    const S = this.S, M = S.M, ci = M.cityAt[h], t = R.TERR[M.terrain[h]];
    const own = S.owner[h] === R.OWN.GER ? 'Германия' : S.owner[h] === R.OWN.SOV ? 'СССР' : '—';
    if (ci < 0) return `<div class="bb-uh"><div><b>${esc(cap1(t.n))}</b><small>Контроль: ${own}</small></div></div><p class="bb-hint">Оборона ×${f1(t.def)}${M.roads.some((r) => r.includes(h)) ? ' · дорога' : ''}</p>`;
    const c = M.cities[ci], gs = [...GOALS.GER, ...GOALS.SOV].filter((g) => g.city === c.name && GOALS[S.side].includes(g));
    const hist = HIST[c.name] != null ? `Исторически взят немцами ${dayDate(HIST[c.name]).s}.` : '';
    return `<div class="bb-uh"><div><b>${esc(c.name)}</b><small>${c.vp >= 3 ? 'Крупный город' : c.vp >= 2 ? 'Город' : 'Городок'} · контроль: ${own}</small></div></div>
${gs.map((g) => `<p class="bb-hint bb-gold">Цель: ${esc(g.t.replace('{n}', ''))}</p>`).join('')}${hist ? `<p class="bb-hint">${hist}</p>` : ''}${c.name === 'Брест' ? '<p class="bb-hint">Брестская крепость: оборона гарнизона ×1,5.</p>' : c.name === 'Минск' ? '<p class="bb-hint">Минский укрепрайон: до трёх уровней окопов.</p>' : ''}`;
  }
  // ——— окна ———
  modal(html, o = {}) {
    const m = this.$.modal;
    this.modalLock = !!o.lock;
    m.innerHTML = `<div class="bb-dlg panel ${o.cls || ''}">${o.lock ? '' : '<button class="bb-cx" data-a="mclose" aria-label="Закрыть">×</button>'}${html}</div>`;
    m.classList.remove('hidden');
    m.firstElementChild.scrollTop = 0;
  }
  closeModal(quiet) {
    const m = this.$.modal;
    if (m.classList.contains('hidden')) return;
    m.classList.add('hidden');
    m.innerHTML = '';
    this.modalLock = 0;
    const f = this.onCloseM;
    this.onCloseM = null;
    if (!quiet && f) f();
  }
  confirm(title, txt, ok, fn) {
    this.modal(`<h3>${esc(title)}</h3><p>${esc(txt)}</p><div class="bb-row2"><button class="btn" data-a="mclose">Отмена</button><button class="btn gold" data-a="mok">${esc(ok)}</button></div>`, { cls: 'bb-small' });
    this.onOk = fn;
  }
  briefing(fn) {
    const S = this.S, gk = PLAYER[S.side].gen, g = GENS[gk], G = R.goalList(S);
    this.modal(`<div class="bb-brh"><img class="bb-por" src="${por(gk)}" alt=""><div><small class="bb-gold">Глава 1 · ${esc(CHAPTER.dates)}</small><h3>${esc(CHAPTER.full)}</h3><b>${esc(g.n)}</b><small>${esc(cap1(g.rank))}, ${esc(g.post)}</small></div></div>
<p>${esc(CHAPTER.brief[S.side])}</p>
<h4>Задачи</h4><ul class="bb-gl">${G.map((x) => `<li class="${x.main ? 'main' : ''}">${x.main ? '<b>Главная.</b> ' : ''}${esc(x.t)}</li>`).join('')}</ul>
<p class="bb-tip"><b>Совет.</b> ${esc(CHAPTER.tip[S.side])}</p>
<p class="bb-dim bb-sm">Ход: нажмите свою дивизию (яркая плашка) — светлые гексы покажут, куда она дойдёт, красные рамки — кого может атаковать. Удар — в два касания: прогноз, затем «Атаковать». Справа — авиация, способности генерала, снабжение, разведка и советник.</p>
<div class="bb-stick"><button class="btn gold bb-wide" data-a="mok">К бою</button></div>`, { lock: 1, cls: 'bb-brief' });
    this.onOk = fn;
  }
  decision(D) {
    return new Promise((res) => {
      const S = this.S, gk = PLAYER[S.side].gen;
      this.sfx('turn');
      this.modal(`<div class="bb-brh"><img class="bb-por" src="${por(gk)}" alt=""><div><small class="bb-gold">${esc(D.when)}</small><h3>${esc(D.title)}</h3><small>Решение командующего</small></div></div>
<p>${esc(D.text)}</p><div class="bb-opts">${D.opts.map((o) => `<button class="btn bb-opt" data-a="dec" data-v="${o.k}"><b>${esc(o.n)}</b><small>${esc(o.d)}</small></button>`).join('')}</div>`, { lock: 1, cls: 'bb-dec' });
      this.onDec = (k) => {
        R.decide(this.S, D.id, k);
        this.closeModal(true);
        this.undoS = [];
        this.sfx('click');
        this.hud();
        res();
      };
    });
  }
  goalsDlg() {
    const S = this.S;
    if (!S) return;
    const G = R.goalList(S), ck = R.clock(S), d = dayDate(S.day);
    const st = (x) => (x.fail ? '<span class="bb-bad">не выполнена</span>' : x.done || (x.ok && x.k !== 'hold') ? '<span class="bb-okc">выполняется</span>' : '<span class="bb-dim">в процессе</span>');
    this.modal(`<h3>Задачи главы</h3><small class="bb-dim">${esc(CHAPTER.full)} · сегодня ${d.s} · день ${S.day + 1} из ${DAYS}</small>
<ul class="bb-gl">${G.map((x) => `<li class="${x.main ? 'main' : ''}">${x.main ? '<b>Главная.</b> ' : ''}${esc(x.t)}<br><small>Сейчас: <b>${esc(x.prog)}</b> · ${st(x)}</small></li>`).join('')}</ul>
<p class="bb-sm">Звёзды: главная задача — 1, каждая дополнительная — ещё по одной.</p>
<h4>Часы Барбароссы</h4><p class="bb-sm">${clockTxt(ck)} Считается по датам взятия Слонима, Барановичей, Слуцка, Бобруйска, Минска, Вильнюса, Белостока и Бреста — в сравнении с 1941 годом.</p>
<h4>Доверие командования</h4><p class="bb-sm">${S.trust}/10${S.trust >= 8 ? ' — лишний приказ каждый день.' : S.trust <= 2 ? ' — на один приказ меньше.' : '.'}</p>
<div class="bb-row2"><button class="btn" data-a="journal">Журнал</button><button class="btn gold" data-a="mclose">К карте</button></div>`);
  }
  journal() {
    const S = this.S;
    if (!S) return;
    const L = S.log.slice(-70).reverse();
    let cur = -1, html = '';
    for (const e of L) {
      if (e.d !== cur) (cur = e.d), (html += `<h4>${dayDate(e.d).s}</h4>`);
      html += `<p class="bb-jl bb-j-${e.k}">${esc(e.txt)}</p>`;
    }
    this.modal(`<h3>Журнал боевых действий</h3><div class="bb-jw">${html || '<p class="bb-dim">Пока пусто.</p>'}</div>`, { cls: 'bb-tall' });
  }
  gameMenu() {
    const o = this.opt;
    this.modal(`<h3>Меню</h3>
<button class="btn gold bb-wide" data-a="mclose">Продолжить</button>
<div class="bb-row2"><button class="btn" data-a="goals">Задачи</button><button class="btn" data-a="journal">Журнал</button></div>
<h4>Скорость ходов ИИ</h4><div class="bb-seg panel">${SPD.map((s, i) => `<button data-a="o-spd" data-v="${i}" class="${o.spd === i ? 'on' : ''}">${s.n}</button>`).join('')}</div>
<button class="btn bb-wide" data-a="help">Как играть</button>
<div class="bb-row2"><button class="btn" data-a="hub">К выбору главы</button><button class="btn" data-a="exit">В главное меню</button></div>
<p class="bb-dim bb-sm">Игра сохраняется автоматически в начале и во время вашего хода.</p>`, { cls: 'bb-small' });
  }
  help() {
    this.modal(`<h3>Как играть</h3><div class="bb-jw bb-sm">
<h4>День</h4><p>Каждый день сначала ходят немцы, затем советские войска. В свою фазу первыми действуют соседи (их ведёт ИИ), затем — вы. Глава длится 9 дней, 22–30 июня 1941 года.</p>
<h4>Дивизии</h4><p>Яркие плашки — ваши дивизии, тусклые с вырезом в углу — соседи. Полоска — сила (цвет — организация), золотые точки — опыт, красная метка — нет снабжения.</p>
<h4>Движение</h4><p>Нажмите дивизию: светлые гексы — куда она дойдёт. Дороги стоят 1 очко хода и ведут через реки по мостам; лес и болота задерживают технику; рядом с противником (зона контроля) марш останавливается. «Отменить» откатывает передвижения до первого боя.</p>
<h4>Бой</h4><p>Красные рамки — кого можно атаковать (с подходом). Первое касание — прогноз: шансы разгрома, отхода, упорного боя и неудачи с поправками. Второе касание или «Атаковать» — удар. Пехота атакует, только если прошла не больше одного гекса; танки, мотопехота и конница — после марша. Победитель занимает гекс.</p>
<h4>Снабжение и котлы</h4><p>Снабжение идёт от своего края карты по своей территории. Отрезанные дивизии теряют организацию и силу, а при разгроме сдаются в плен. Котлы обведены пунктиром.</p>
<h4>Приказы и авиация</h4><p>Очки приказов (вверху): артподготовка (+25% к удару), марш-бросок (+ход), пополнение (+1–2 силы). Авиаудары снижают организацию и силу целей, сносят окопы.</p>
<h4>Генерал</h4><p>У каждого командующего две способности (справа): у Гудериана — «Блицкриг» и «Штуки», у Голубева — «Контрудар Болдина» и «Выход из окружения». В ключевые дни придётся принять решение — как в 1941-м.</p>
<h4>Итоги</h4><p>Главная задача даёт победу и звезду, дополнительные — ещё две. «Часы Барбароссы» показывают, опережают ли немцы исторический график.</p></div>
<button class="btn gold bb-wide" data-a="mclose">Понятно</button>`, { cls: 'bb-tall' });
  }
  results() {
    const S = this.S, o = S.over, G = R.goalList(S), gk = PLAYER[S.side].gen, st = S.stats;
    try {
      const P = readProg();
      P.border = P.border || {};
      P.border[S.side] = Math.max(P.border[S.side] || 0, o.stars);
      localStorage.setItem(KEY_PROG, JSON.stringify(P));
    } catch {}
    this.sfx(o.win ? 'win' : 'lose');
    const row = (n, k, f = f0) => `<tr><td>${n}</td><td>${f(st.GER[k])}</td><td>${f(st.SOV[k])}</td></tr>`;
    this.modal(`<div class="bb-resh ${o.win ? 'win' : 'lose'}"><img class="bb-por" src="${por(gk)}" alt=""><div><small class="bb-gold">${esc(CHAPTER.full)} · ${esc(CHAPTER.dates)}</small><h3>${o.win ? 'Задача выполнена' : 'Задача не выполнена'}</h3>${stars(o.stars, 'big')}</div></div>
<ul class="bb-gl">${G.map((x, i) => `<li class="${o.goals[i]?.ok ? 'ok' : 'fail'} ${x.main ? 'main' : ''}">${esc(x.t)} — <b>${esc(o.goals[i]?.prog ?? x.prog)}</b></li>`).join('')}</ul>
<h4>Часы Барбароссы</h4><p class="bb-sm">${clockTxt(o.clock)}</p>
<h4>Потери</h4><table class="bb-tbl"><tr><th></th><th>Германия</th><th>СССР</th></tr>${row('Дивизий уничтожено и сдалось', 'div')}${row('Люди (убитые, раненые, пленные)', 'men')}${row('Из них пленные', 'pris')}${row('Танки', 'tk')}</table>
<h4>Как было в 1941 году</h4><p class="bb-sm">${esc(CHAPTER.hist[S.side])}</p>
<p class="bb-next">${esc(CHAPTER.next)} — <b>скоро</b></p>
<div class="bb-row3"><button class="btn gold" data-a="again">Сыграть ещё</button><button class="btn" data-a="swap">За ${S.side === 'GER' ? 'СССР' : 'Германию'}</button><button class="btn" data-a="exit">В меню</button></div>
<button class="btn bb-wide bb-ghost" data-a="mclose">Посмотреть карту</button>`, { cls: 'bb-res bb-tall' });
  }
  // ——— клики ———
  onClick(e) {
    const t = e.target.closest('[data-a]');
    if (!t || t.disabled || !this.root.contains(t)) return;
    const a = t.dataset.a, v = t.dataset.v;
    const S = this.S;
    switch (a) {
      case 'o-side':
        this.opt.side = v === 'SOV' ? 'SOV' : 'GER';
        this.saveOpt();
        this.sfx('select');
        return this.showHub();
      case 'o-diff':
        this.opt.diff = +v;
        this.saveOpt();
        this.sfx('click');
        return this.showHub();
      case 'o-spd':
        this.opt.spd = +v;
        this.saveOpt();
        this.sfx('click');
        return this.gameMenu();
      case 'new':
        this.sfx('click');
        if (readMeta()) return this.confirm('Начать заново?', 'Текущая партия главы будет потеряна.', 'Начать', () => this.startNew());
        return this.startNew();
      case 'cont':
        this.sfx('click');
        return this.cont();
      case 'help':
        this.sfx('click');
        return this.help();
      case 'exit':
        this.sfx('click');
        this.closeModal(true);
        return this.h.exit?.();
      case 'hub':
        this.sfx('click');
        this.closeModal(true);
        if (S && (S.step === 'player' || S.over) && !this.busy && !this.lock) this.saveGame();
        return this.showHub();
      case 'mclose':
        this.sfx('click');
        return this.closeModal();
      case 'mok': {
        const f = this.onOk;
        this.onOk = null;
        this.sfx('click');
        this.closeModal(true);
        return f && f();
      }
      case 'dec':
        return this.onDec && this.onDec(v);
      case 'again':
        this.closeModal(true);
        return this.startNew();
      case 'swap':
        this.opt.side = S && S.side === 'GER' ? 'SOV' : 'GER';
        this.saveOpt();
        this.closeModal(true);
        return this.startNew();
      case 'menu':
        this.sfx('click');
        return this.gameMenu();
      case 'goals':
        this.sfx('click');
        return this.goalsDlg();
      case 'journal':
        this.sfx('click');
        return this.journal();
      case 'cphelp':
        this.sfx('click');
        return S && this.toast(`Приказы: ${S.cp}`, 'Артподготовка, марш-бросок и пополнение — в карточке дивизии. Каждое стоит 1 приказ.');
      case 'air':
        return this.mode === 'air' ? this.setMode('') : this.setMode('air');
      case 'abil':
        this.sfx('click');
        return this.abilDlg(v);
      case 'sup':
      case 'rec':
      case 'adv':
        return this.toggle(a);
      case 'advgo':
        return this.advGo(+v);
      case 'undo':
        return this.undo();
      case 'next':
        return this.nextUnit();
      case 'end':
        if (S && S.over) return this.results();
        return this.endTurn();
      case 'skip':
        this.skip = 1;
        return this.busyOn();
      case 'ord':
        return this.doOrder(v);
      case 'attack':
        return this.attack();
      case 'tcancel': {
        this.sfx('click');
        const u = S && this.sel ? S.U.get(this.sel) : null;
        return u ? this.select(u, true) : this.clearSel(true);
      }
      case 'cclose':
        return this.clearSel();
      case 'goto':
        if (S && +v >= 0) (this.flash = +v), this.map.center(+v), this.overlay(), setTimeout(() => ((this.flash = -1), this.overlay()), 1800);
        return;
    }
  }
}
function clockTxt(ck) {
  if (ck >= 0.05) return `Немцы опережают исторический график на ${f1(ck)} дн.`;
  if (ck <= -0.05) return `Немцы отстают от исторического графика на ${f1(-ck)} дн.`;
  return 'Немцы идут точно по историческому графику.';
}
