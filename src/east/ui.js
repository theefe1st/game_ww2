// «Мировой фронт» v0.10, «Восточный фронт 1941–1945»: интерфейс. Главное меню (Играть, Продолжить, Настройки,
// Как играть, Архив), новая игра (сторона, режим, сложность), карта на весь экран; сверху — дата, погода, запасы;
// снизу — «Направления» (генералы, приказ «оборона/наступление/отход/авто», цель), «Армия», «Стройка», «Журнал», «Ход».
// Касание области — карточка: войска, постройки, удар с прогнозом, перемещение. После хода — сводка недели и
// карточки событий. Ход игрока: beginPhase → свои приказы → «Ход» → генералы выполняют остальное (runSide).
// Хост (game.js) даёт exit() — выход в архив прототипов.
import J from './data/map.json';
import JR from './data/rails.json';
import './east.css';
import { decodeMap, decodeRails, TER_N } from './mapdata.js';
import { newGame, ensureState } from './setup.js';
import * as E from './engine.js';
import { runSide, setPostures, autoTarget, nearTarget, zoneForce, frontsOn } from './ai.js';
import { FrontsUI, FRONT_ACT, frontShort } from './ui-fronts.js';
import { EcoUI, ECO_ACT } from './ui-eco.js';
import { FRONT_COL } from './map.js';
import { evCard, chooseEvent, boostsNow, pendingChoices } from './events.js';
import { EastMap } from './map.js';
import { counterURL, divLabel, wmOf } from './counters.js';
import { Sound } from './audio.js';
import { icon } from './icons.js';
import { fmtTurn, turnOf, SIDE_N, SIDE0, NAT_N, TYPES, TER, WX, DIFF, MODES, other, divW, plural } from './rules.js';
import { ZONES } from './sites.js';
import { ALLG, POR_NAT, TRAITS } from '../war/gens41.js';
import { portraitURLP } from '../staff/portraits.js';
import { esc, ic, num, weeksW, flagHTML, genURL, strCol, POST } from './kit.js';

const APP_VER = '0.11.0';
export { flagHTML };
const META = 'wf_east_meta', OPTS = 'wf_east_opts', TIPS = 'wf_east_tips';
const ZN_ = ZONES.map((z) => z.n);
const TIP_TEXT = {
  map: ['compass', 'Карта фронта', 'Красная линия — фронт. Двигайте карту пальцем, увеличивайте двумя пальцами. Нажмите на область — увидите войска.'],
  dirs: ['compass', 'Направления', 'Фронт поделён на 5 направлений. У каждого — генерал. Дайте приказ: оборона, наступление или «авто».'],
  next: ['next', 'Ход = неделя', 'Нажмите «Ход» — генералы выполнят приказы, противник ответит. Война идёт с июня 1941 до мая 1945.'],
  attack: ['atk', 'Удар', 'Нажмите на область противника рядом с вашими войсками — увидите шансы и кнопку «Атаковать».'],
  pocket: ['encircle', 'Котёл!', 'Войска без снабжения слабеют и сдаются. Вырывайтесь к своим или деблокируйте их ударом извне.'],
  build: ['crane', 'Стройка', 'Гражданские фабрики строят: заводы, укрепления, аэродромы, лагеря, склады. Нажмите на свою область.'],
};
// флаги наций (без запрещённой символики: Германия — крест вермахта)

export class EastUI {
  static menuLabel() { return `v${APP_VER} · СССР или Германия · 1 ход — неделя`; }
  constructor(root, host = {}) {
    this.root = root; this.host = host;
    this.snd = new Sound();
    this.opt = { trees: false, wxfx: true, tips: true };
    try { Object.assign(this.opt, JSON.parse(localStorage.getItem(OPTS) || '{}')); } catch {}
    try { this.tipsSeen = JSON.parse(localStorage.getItem(TIPS) || '{}'); } catch { this.tipsSeen = {}; }
    this.S = null; this.P = 'SOV'; this.mode = 'menu'; this.sel = null; this.pick = null;
    root.classList.add('east');
    if (typeof window !== 'undefined') window.__east = this; // для автотестов (tools/e2e-east.cjs)
    root.innerHTML = `<div class="e-map"></div>
<div class="e-hud hidden">
  <div class="e-top">
    <button class="e-ib" data-a="gmenu" aria-label="Меню">${ic('menu')}</button>
    <button class="e-date" data-a="log"><b></b><small></small></button>
    <div class="e-wx"></div>
    <div class="e-res"></div>
  </div>
  <div class="e-zoom"><button class="e-ib sm" data-a="zin" aria-label="Крупнее">${ic('plus')}</button><button class="e-ib sm" data-a="zout" aria-label="Мельче">${ic('minus')}</button><button class="e-ib sm" data-a="home" aria-label="К фронту">${ic('locate')}</button></div>
  <div class="e-bot">
    <button class="e-tab" data-a="dirs">${ic('compass')}<span>Фронты</span></button>
    <button class="e-tab" data-a="army">${ic('helmet')}<span>Армия</span></button>
    <button class="e-tab" data-a="eco">${ic('mil')}<span>Экономика</span></button>
    <button class="e-tab" data-a="log">${ic('book')}<span>Журнал</span></button>
    <button class="e-next" data-a="next">${ic('next')}<span>Ход</span></button>
  </div>
  <div class="e-modebar hidden"></div>
</div>
<div class="e-panel hidden"></div>
<div class="e-screen hidden"></div>
<div class="e-modal hidden"></div>
<div class="e-busy hidden"><i></i><span></span></div>
<div class="e-toasts"></div>
<div class="e-tip hidden"></div>`;
    this.$ = (s) => root.querySelector(s);
    root.addEventListener('click', (e) => {
      this.snd.unlock();
      const b = e.target.closest('[data-a]');
      if (!b || !root.contains(b) || b.disabled) return;
      e.stopPropagation();
      this.act(b.dataset.a, b);
    });
    root.addEventListener('pointerdown', () => this.snd.unlock(), { capture: true });
  }
  // карта создаётся при первом открытии (WebGL, рельеф — ~0,3 с)
  ensureMap() {
    if (this.map) return;
    this.M = decodeRails(decodeMap(J), JR);
    this.map = new EastMap(this.$('.e-map'), this.M);
    this.map.opt.trees = this.opt.trees; this.map.opt.wx = this.opt.wxfx;
    this.map.onTap = (r, x, y) => this.onTap(r, x, y);
    this.map.onLong = (r) => { if (r >= 0) { this.snd.play('select'); this.openRegion(r); } };
    this.map.onHQ = (f) => { this.snd.play('click'); this.openPanel('dirs'); setTimeout(() => this.$(`.e-front[data-f="${f}"]`)?.scrollIntoView({ block: 'center' }), 30); };
    // значки построек на карте (крупный масштаб): свои — все, у противника — укрепления
    this.map.bldItems = (S, r) => {
      const sd = E.sideOf(S, r), o = [];
      if (!sd) return o;
      if (S.fort[r]) o.push(['fort', S.fort[r]]);
      if (sd !== this.P) return o;
      if (S.fac[r]) o.push(['factory', S.fac[r]]);
      if (S.civ[r]) o.push(['civ', S.civ[r]]);
      if (S.camp[r]) o.push(['camp', 1]);
      if (S.dep[r]) o.push(['depot', 1]);
      if (S.q.some((b) => b.r === r && b.s === this.P)) o.push(['crane', 1]);
      return o;
    };
    const GI = new Map();
    this.map.genImg = (k) => { if (!k) return null; let im = GI.get(k); if (!im) { im = new Image(); im.onload = () => this.map.redraw(); im.src = genURL(k); GI.set(k, im); } return im; };
  }
  open() {
    this.ensureMap();
    this.showMenu();
  }
  close() { this.snd.stopMusic(); this.save(); }
  back() {
    if (!this.$('.e-modal').classList.contains('hidden')) { if (this.modalLock) return true; this.closeModal(); return true; }
    if (!this.$('.e-panel').classList.contains('hidden')) { this.closePanel(); return true; }
    if (this.pick || this.sel) { this.cancelMode(); return true; }
    if (this.mode === 'game') { this.gameMenu(); return true; }
    if (this.mode === 'new' || this.mode === 'help') { this.showMenu(); return true; }
    return false;
  }
  saveOpts() { try { localStorage.setItem(OPTS, JSON.stringify(this.opt)); } catch {} }
  // ——— действия кнопок ———
  act(a, b) {
    const S = this.S;
    switch (a) {
      case 'play': this.snd.play('click'); return this.showNew();
      case 'cont': this.snd.play('click'); return this.continueGame();
      case 'settings': this.snd.play('click'); return this.showSettings();
      case 'help': this.snd.play('click'); return this.showHelp();
      case 'arch': this.snd.play('click'); this.close(); return this.host.exit?.();
      case 'menu': this.snd.play('click'); this.closeModal(); return this.showMenu();
      case 'start': this.snd.play('turn'); return this.startNew();
      case 'nsel': { this.snd.play('select'); const [k, v] = b.dataset.v.split(':'); this.newCfg[k] = k === 'diff' ? +v : v; return this.renderNew(); }
      case 'close': this.snd.play('click'); return this.closeModal();
      case 'pclose': this.snd.play('click'); return this.closePanel();
      case 'gmenu': this.snd.play('click'); return this.gameMenu();
      case 'dirs': case 'army': case 'log':
        this.snd.play('click');
        if (this.panelKind === a && !this.$('.e-panel').classList.contains('hidden')) return this.closePanel();
        return this.openPanel(a);
      case 'build': return ECO_ACT.eco.call(this);
      case 'next': return this.endTurn();
      case 'zin': return this.map.zoomBy(1.6);
      case 'zout': return this.map.zoomBy(1 / 1.6);
      case 'home': this.snd.play('click'); return this.homeView(true);
      case 'post': { this.snd.play('select'); const z = +b.dataset.z, p = b.dataset.p; return this.setPost(z, p); }
      case 'tgt': { this.snd.play('click'); return this.pickTarget(+b.dataset.z); }
      case 'zfly': { this.snd.play('click'); return this.flyZone(+b.dataset.z); }
      case 'cancel': this.snd.play('click'); return this.cancelMode();
      case 'move': this.snd.play('select'); return this.startMove(+b.dataset.r);
      case 'attack': return this.doAttack(+b.dataset.r);
      case 'settgt': { this.snd.play('select'); const r = +b.dataset.r; this.setTarget(this.frontOfR(r), r); return this.closePanel(); }
      case 'bld': return this.doBuild(+b.dataset.r, b.dataset.k);
      case 'evac': return this.doEvac(+b.dataset.r);
      case 'rec': return this.doRecruit(b.dataset.t);
      case 'auto': { this.snd.play('select'); const k = b.dataset.k; if (k === 'evac') S.flags.evacAuto = S.flags.evacAuto ? 0 : 1; else S.auto[k] = !S.auto[k]; return this.openPanel(this.panelKind); }
      case 'ev': { const id = b.dataset.id; return this.showEventCard(id, true); }
      case 'evc': return this.pickChoice(b.dataset.id, +b.dataset.i);
      case 'evok': this.snd.play('click'); return this.nextCard();
      case 'rep': this.snd.play('click'); return this.nextCard();
      case 'opt': { this.snd.play('click'); const k = b.dataset.k; this.opt[k] = !this.opt[k]; this.saveOpts(); if (this.map) { this.map.opt.trees = this.opt.trees; this.map.opt.wx = this.opt.wxfx; this.map.redraw(); } if (k === 'tips' && this.opt.tips) { this.tipsSeen = {}; try { localStorage.removeItem(TIPS); } catch {} } return this.showSettings(); }
      case 'tipok': this.snd.play('click'); return this.hideTip();
      case 'region': { const r = +b.dataset.r; this.snd.play('click'); this.map.flyTo(this.M.reg[r].x, this.M.reg[r].y, Math.max(this.map.view.sc, 0.8)); return this.openRegion(r); }
      case 'save': this.save(); this.toast(ic('save') + 'Игра сохранена'); return this.closeModal();
      case 'exitgame': this.snd.play('click'); this.save(); this.closeModal(); return this.showMenu();
      case 'newgame': this.snd.play('click'); this.closeModal(); return this.showNew();
      case 'helpp': { this.snd.play('click'); this.helpPage = +b.dataset.p; return this.showHelp(); }
      default: { const h = ACTX[a]; if (h) return h.call(this, b); }
    }
  }
  // ——— главное меню ———
  meta() { try { return JSON.parse(localStorage.getItem(META) || 'null'); } catch { return null; } }
  showMenu() {
    this.mode = 'menu';
    this.closePanel(); this.closeModal(); this.hideTip();
    this.$('.e-hud').classList.add('hidden');
    this.snd.music('menu');
    // фон: карта лета 1941 г.
    if (!this.bgS) this.bgS = newGame(this.M, { side: 'SOV', mode: 'hist', diff: 1, seed: 1941, noAsk: 1 });
    this.map.setState(this.bgS, 'SOV'); this.map.flags = []; this.map.clearBattles(); this.map.setHL({ sel: -1, reach: null, atk: null, pick: null });
    this.map.centerOn(1500, 1850, Math.max(this.map.minSc, Math.min(this.map.w / 1500, this.map.h / 1100)));
    const m = this.meta();
    const sc = this.$('.e-screen');
    sc.className = 'e-screen e-menu';
    sc.innerHTML = `<div class="e-mbox">
<div class="e-logo"><span>МИРОВОЙ ФРОНТ</span><small>Восточный фронт · 1941–1945</small></div>
<div class="e-mbtns">
${m ? `<button class="e-btn gold big" data-a="cont">${ic('play')}<span>Продолжить<small>${flagHTML(m.side, 'xs')} ${esc(SIDE_N[m.side])} · ${esc(fmtTurn(m.turn))} · ${esc(MODES[m.mode]?.n || '')}</small></span></button>` : ''}
<button class="e-btn ${m ? '' : 'gold'} big" data-a="play">${ic('flag')}<span>${m ? 'Новая игра' : 'Играть'}<small>за СССР или Германию</small></span></button>
<div class="e-mrow">
<button class="e-btn" data-a="settings">${ic('settings')}<span>Настройки</span></button>
<button class="e-btn" data-a="help">${ic('help')}<span>Как играть</span></button>
<button class="e-btn" data-a="arch">${ic('archive')}<span>Архив</span></button>
</div></div>
<div class="e-ver">v${APP_VER}</div></div>`;
  }
  // ——— новая игра ———
  showNew() {
    this.mode = 'new';
    this.newCfg ??= { side: 'SOV', mode: 'hist', diff: 1 };
    this.renderNew();
  }
  renderNew() {
    const c = this.newCfg, sc = this.$('.e-screen');
    sc.className = 'e-screen e-new';
    const opt = (k, v, inner, on) => `<button class="e-opt ${on ? 'on' : ''}" data-a="nsel" data-v="${k}:${v}">${inner}</button>`;
    sc.innerHTML = `<div class="e-nbox">
<div class="e-nhead"><button class="e-ib" data-a="menu" aria-label="Назад">${ic('back')}</button><h2>Новая игра</h2></div>
<div class="e-nrow"><div class="e-nlab">Сторона</div><div class="e-nopts">
${opt('side', 'SOV', `${flagHTML('SOV', 'lg')}<b>СССР</b><small>Ставка ВГК: выстоять в 1941-м и дойти до Берлина</small>`, c.side === 'SOV')}
${opt('side', 'GER', `${flagHTML('GER', 'lg')}<b>Германия</b><small>ОКХ: блицкриг, Москва, нефть Кавказа</small>`, c.side === 'GER')}
</div></div>
<div class="e-nrow"><div class="e-nlab">Режим</div><div class="e-nopts">
${opt('mode', 'hist', `${ic('book')}<b>Исторический</b><small>события и планы как в 1941–1945</small>`, c.mode === 'hist')}
${opt('mode', 'free', `${ic('dice')}<b>Свободный</b><small>своя стратегия, история пойдёт иначе</small>`, c.mode === 'free')}
</div></div>
<div class="e-nrow"><div class="e-nlab">Сложность</div><div class="e-nopts three">
${DIFF.map((d) => opt('diff', d.k, `${ic(['medal', 'star', 'skull'][d.k])}<b>${d.n}</b>`, c.diff === d.k)).join('')}
</div></div>
<button class="e-btn gold big e-go" data-a="start">${ic('play')}<span>В бой!</span></button>
</div>`;
  }
  // ——— настройки ———
  showSettings() {
    const o = this.opt, s = this.snd.cfg;
    const tg = (k, label, ico) => `<button class="e-row e-toggle ${o[k] ? 'on' : ''}" data-a="opt" data-k="${k}">${ic(ico)}<span>${label}</span><i></i></button>`;
    const m = this.modal(`<h2>${ic('settings')} Настройки</h2>
<div class="e-set">
<label class="e-row">${ic('music')}<span>Музыка</span><input type="range" min="0" max="100" value="${Math.round(s.music * 100)}" id="e-mus"></label>
<label class="e-row">${ic('sound')}<span>Звуки</span><input type="range" min="0" max="100" value="${Math.round(s.sfx * 100)}" id="e-sfx"></label>
${tg('trees', 'Деревья на карте', 'wheat')}${tg('wxfx', 'Анимация погоды', 'rain')}${tg('tips', 'Подсказки новичку', 'info')}
</div>
<div class="e-btns"><button class="e-btn gold" data-a="close">${ic('check')}<span>Готово</span></button></div>`, { cls: 'set' });
    m.querySelector('#e-mus').addEventListener('input', (e) => this.snd.setMusic(e.target.value / 100));
    m.querySelector('#e-sfx').addEventListener('input', (e) => this.snd.setSfx(e.target.value / 100));
    m.querySelector('#e-sfx').addEventListener('change', () => this.snd.play('click'));
  }
  // ——— как играть ———
  showHelp() {
    const P = [
      ['calendar', 'Ход — неделя', 'Война идёт с 22 июня 1941 года. Каждый ход — неделя: сначала действует Германия, потом СССР. Погода меняется: летом сухо, осенью и весной распутица, зимой морозы.'],
      ['compass', 'Направления и генералы', 'Фронт поделён на 5 направлений: Финское, Северное, Центральное, Южное и Кавказское. Генералы сами ведут войска — вы даёте приказ: «Оборона», «Наступление» с целью, «Отход» или «Авто».'],
      ['atk', 'Удары и котлы', 'Бой идёт за область. Перевес сил, местность, реки, укрепления и погода решают исход. Войска без снабжения слабеют и сдаются — окружайте врага и не давайте окружить себя.'],
      ['hand', 'Свои приказы', 'Нажмите на свою область — можно переместить войска. Нажмите на область врага рядом — увидите шансы и кнопку «Атаковать». Остальное сделают генералы.'],
      ['factory', 'Хозяйство', '⚙ производство — от заводов, 👥 люди — от населения. Из них пополняются дивизии и формируются новые. Стройте заводы в тылу, укрепления у фронта, аэродромы для авиации.'],
      ['trophy', 'Победа', 'СССР побеждает, взяв Берлин. Германия — взяв Москву и ещё два крупных города, или сломив боевой дух СССР. В конце 1945 г. победителя решат очки городов.'],
    ];
    const k = Math.min(P.length - 1, this.helpPage || 0), p = P[k];
    this.modal(`<div class="e-help"><div class="e-hico">${ic(p[0] === 'hand' ? 'move' : p[0])}</div><h2>${esc(p[1])}</h2><p>${esc(p[2])}</p>
<div class="e-dots">${P.map((_, i) => `<button class="${i === k ? 'on' : ''}" data-a="helpp" data-p="${i}" aria-label="${i + 1}"></button>`).join('')}</div>
<div class="e-btns">${k > 0 ? `<button class="e-btn" data-a="helpp" data-p="${k - 1}">${ic('left')}<span>Назад</span></button>` : ''}${k < P.length - 1 ? `<button class="e-btn gold" data-a="helpp" data-p="${k + 1}">${ic('right')}<span>Дальше</span></button>` : `<button class="e-btn gold" data-a="close">${ic('check')}<span>Понятно</span></button>`}</div></div>`);
  }
  // ——— партия ———
  startNew() {
    const c = this.newCfg;
    this.S = newGame(this.M, { side: c.side, mode: c.mode, diff: c.diff });
    this.P = c.side;
    this.cards = [];
    this.enterGame();
    this.homeView(false);
    if (this.P === 'SOV') this.runPhases([() => runSide(this.S, 'GER', { isAI: true })], 'Германия начинает войну…');
    else this.beginPlayer();
  }
  continueGame() {
    let S = null;
    try { S = E.deserialize(this.M, localStorage.getItem(E.SAVE_KEY)); } catch (e) { S = null; }
    if (!S) { this.toast(ic('cancel') + 'Сохранение не читается'); try { localStorage.removeItem(META); } catch {} return this.showMenu(); }
    ensureState(S);
    this.S = S; this.P = S.side;
    this.cards = [];
    this.enterGame();
    this.homeView(false);
    this.beginPlayer(true);
  }
  enterGame() {
    this.mode = 'game';
    this.$('.e-screen').className = 'e-screen hidden';
    this.$('.e-hud').classList.remove('hidden');
    this.map.setState(this.S, this.P);
    this.map.clearBattles();
    this.snd.music('war');
  }
  save() {
    const S = this.S;
    if (!S || S.over || this.mode !== 'game') return;
    try {
      localStorage.setItem(E.SAVE_KEY, E.serialize(S));
      localStorage.setItem(META, JSON.stringify({ side: this.P, turn: S.turn, mode: S.mode, diff: S.diff }));
    } catch (e) { /* переполнение хранилища — без сохранения */ }
  }
  dropSave() { try { localStorage.removeItem(E.SAVE_KEY); localStorage.removeItem(META); } catch {} }
  // фаза игрока: свежие очки хода, приказы «авто», сохранение
  beginPlayer(resume = false) {
    const S = this.S;
    if (S.over) { this.busy(false); return this.showEnd(); }
    E.beginPhase(S, this.P);
    this.applyAuto();
    this.busy(false);
    this.refresh();
    this.save();
    for (const q of S.evq || []) this.cards.push({ k: 'ev', id: q.id });
    S.evq = [];
    // несделанный выбор (игра закрыта на карточке) — показать снова
    for (const id of pendingChoices(S)) if (!this.cards.some((c) => c.id === id)) this.cards.push({ k: 'ev', id });
    if (resume && !this.cards.length) this.toast(`${ic('calendar')}${esc(fmtTurn(S.turn, true))}`);
    this.nextCard();
  }
  // направления на «авто»: приказ и цель — по обстановке (в «Историческом» режиме — по планам 1941–1945 гг.)
  applyAuto() {
    const S = this.S, P = this.P, post = S.post[P].slice(), tgt = S.tgt[P].slice();
    setPostures(S, P, true);
    for (const z of frontsOn(S, P)) {
      if (!S.pauto[z]) { S.post[P][z] = post[z]; S.tgt[P][z] = tgt[z]; }
      if (S.post[P][z] === 'atk' && (S.tgt[P][z] < 0 || E.sideOf(S, S.tgt[P][z]) === P)) {
        const t = autoTarget(S, P, z);
        if (t >= 0) S.tgt[P][z] = t; else if (S.pauto[z]) S.post[P][z] = 'def';
      }
    }
  }
  // цепочка шагов с паузами (чтобы интерфейс успевал показать «ход противника»)
  runPhases(steps, label) {
    const S = this.S;
    this.busy(true, label);
    const before = this.snapshot();
    S.news = []; S.battles = [];
    let i = 0;
    this.perf = [];
    const go = () => {
      try {
        if (i < steps.length && !S.over) { const t0 = performance.now(); steps[i++](); this.perf.push(Math.round(performance.now() - t0)); setTimeout(go, 30); return; }
      } catch (e) { console.error(e); }
      this.afterTurn(before);
    };
    setTimeout(go, 60);
  }
  endTurn() {
    const S = this.S;
    if (!S || this.isBusy || S.over) return;
    if (this.modalLock) return;
    this.snd.play('turn');
    this.closePanel(); this.cancelMode(true); this.closeModal();
    const P = this.P, steps = [() => { this.applyAuto(); runSide(S, P, { isAI: false, begun: true }); }];
    if (P === 'GER') steps.push(() => runSide(S, 'SOV', { isAI: true }), () => E.endWeek(S));
    else steps.push(() => E.endWeek(S), () => runSide(S, 'GER', { isAI: true }));
    this.runPhases(steps, 'Генералы выполняют приказы…');
  }
  snapshot() {
    const S = this.S, own = Array.from(S.M.reg, (g) => E.sideOf(S, g.id));
    const alive = { GER: 0, SOV: 0 };
    for (const u of S.units) if (E.alive(u)) alive[u.s]++;
    return { own, turn: S.turn, alive, lost: { GER: S.stats.GER.lost, SOV: S.stats.SOV.lost }, pow: { GER: S.stats.GER.pow, SOV: S.stats.SOV.pow } };
  }
  afterTurn(b) {
    const S = this.S, P = this.P, Q = other(P), M = this.M;
    const won = [], lost = [];
    let gain = 0, loss = 0;
    for (const g of M.reg) {
      const s = E.sideOf(S, g.id);
      if (s === b.own[g.id]) continue;
      if (s === P) { gain++; if (g.vp >= 1 || g.city?.s >= 2) won.push(g.id); } else if (b.own[g.id] === P) { loss++; if (g.vp >= 1 || g.city?.s >= 2) lost.push(g.id); }
    }
    const bt = S.battles, my = bt.filter((x) => x.side === P), en = bt.filter((x) => x.side === Q);
    const alive = { GER: 0, SOV: 0 };
    for (const u of S.units) if (E.alive(u)) alive[u.s]++;
    const dl = { [P]: S.stats[P].lost - b.lost[P], [Q]: S.stats[Q].lost - b.lost[Q] };
    const pocket = S.units.filter((u) => E.alive(u) && u.s === P && S.sup[P][u.r] <= 0).length;
    const rep = { turn0: b.turn, won, lost, gain, loss, my: my.length, myWin: my.filter((x) => x.win).length, en: en.length, enWin: en.filter((x) => x.win).length,
      dl, pow: S.stats[Q].pow - b.pow[Q], powL: S.stats[P].pow - b.pow[P], arr: alive[P] - b.alive[P] + dl[P], pocket, news: (S.news || []).slice() };
    this.map.clearBattles();
    this.map.showBattles(bt.filter((x) => x.win || x.side === Q).slice(-60));
    this.cards.push({ k: 'rep', rep });
    if (pocket) this.tipLater('pocket');
    if (S.turn === 2) this.tipLater('build');
    this.beginPlayer();
  }
  // ——— карточки: сводка недели, события, итог ———
  nextCard() {
    const c = this.cards.shift();
    if (!c) { this.closeModal(); this.modalLock = false; this.refresh(); this.maybeTip(); return; }
    if (c.k === 'rep') return this.showReport(c.rep);
    if (c.k === 'ev') return this.showEventCard(c.id);
  }
  showReport(R) {
    const S = this.S, M = this.M, P = this.P, Q = other(P);
    const big = (rs) => rs.slice().sort((a, b) => M.reg[b].vp - M.reg[a].vp);
    const nm = (r) => esc(M.reg[r].city?.n || M.reg[r].n);
    const won = big(R.won), lost = big(R.lost);
    let head = 'Фронт держится', tone = '';
    if (won.length && M.reg[won[0]].vp >= 3) { head = `${SIDE0[M.nats[S.own0[won[0]]]] === P ? 'Освобождён' : 'Взят'} ${nm(won[0])}!`; tone = 'good'; }
    else if (lost.length && M.reg[lost[0]].vp >= 3) { head = `Пал ${nm(lost[0])}`; tone = 'bad'; }
    else if (R.gain > R.loss + 2) { head = 'Наступление идёт'; tone = 'good'; }
    else if (R.loss > R.gain + 2) { head = 'Противник наступает'; tone = 'bad'; }
    const chip = (r, cls) => `<button class="e-chip ${cls}" data-a="region" data-r="${r}">${ic('city')}${nm(r)}</button>`;
    const evs = this.cards.filter((c) => c.k === 'ev').length;
    this.modal(`<div class="e-rep ${tone}">
<div class="e-rdate">${ic('calendar')}${R.turn0 === S.turn ? esc(fmtTurn(S.turn, true)) : `${esc(fmtTurn(R.turn0, true))} — ${esc(fmtTurn(S.turn, true))}`}</div>
<h2>${head}</h2>
${won.length ? `<div class="e-rrow"><span class="e-rl good">${ic('flag')}Наши</span><div class="e-chips">${won.slice(0, 8).map((r) => chip(r, 'good')).join('')}${won.length > 8 ? `<span class="e-more">+${won.length - 8}</span>` : ''}</div></div>` : ''}
${lost.length ? `<div class="e-rrow"><span class="e-rl bad">${ic('flag')}Потеряны</span><div class="e-chips">${lost.slice(0, 8).map((r) => chip(r, 'bad')).join('')}${lost.length > 8 ? `<span class="e-more">+${lost.length - 8}</span>` : ''}</div></div>` : ''}
<div class="e-stats">
<div class="e-stat">${ic('atk')}<b>${R.myWin}/${R.my}</b><small>наших ударов успешны</small></div>
<div class="e-stat">${ic('def')}<b>${R.en - R.enWin}/${R.en}</b><small>атак врага отбито</small></div>
<div class="e-stat good">${ic('skull')}<b>${R.dl[Q]}</b><small>${divW(R.dl[Q])} врага разбито${R.pow ? `, ${R.pow} в плену` : ''}</small></div>
<div class="e-stat bad">${ic('skull')}<b>${R.dl[P]}</b><small>${divW(R.dl[P])} потеряно</small></div>
${R.arr > 0 ? `<div class="e-stat">${ic('plus')}<b>${R.arr}</b><small>новых ${plural(R.arr, 'дивизия', 'дивизии', 'дивизий')}</small></div>` : ''}
${R.pocket ? `<div class="e-stat bad">${ic('encircle')}<b>${R.pocket}</b><small>в окружении!</small></div>` : ''}
</div>
<div class="e-btns"><button class="e-btn gold" data-a="rep">${ic(evs ? 'next' : 'check')}<span>${evs ? 'Дальше' : 'К делу'}</span></button></div></div>`, { lock: false, cls: 'rep' });
    this.snd.play(tone === 'bad' ? 'lose' : tone === 'good' ? 'win' : 'click');
  }
  showEventCard(id, again = false) {
    const S = this.S, c = evCard(S, id);
    if (!c) return this.nextCard();
    const ask = !again && c.opts && c.side === this.P && S.ev[id] >= 0 && S.evc?.[id] === undefined;
    const tone = c.good ? 'good' : 'bad';
    const body = `<div class="e-ev ${tone}"><div class="e-evic">${ic(c.ic)}</div>
<div class="e-rdate">${ic('calendar')}${esc(fmtTurn(c.turn >= 0 ? c.turn : S.turn, true))}</div>
<h2>${esc(c.t)}</h2><p>${esc(c.d)}</p>
${ask ? `<div class="e-evopts">${c.opts.map((o, i) => `<button class="e-btn ${i ? '' : 'gold'}" data-a="evc" data-id="${id}" data-i="${i}">${ic(o.ic)}<span>${esc(o.t)}<small>${esc(o.d)}</small></span></button>`).join('')}</div>`
    : `${c.opts && S.evc?.[id] !== undefined ? `<p class="e-evch">${ic('check')}Решение: ${esc(c.opts[S.evc[id]]?.t || '')}</p>` : ''}<div class="e-btns"><button class="e-btn gold" data-a="${again ? 'close' : 'evok'}">${ic('check')}<span>Понятно</span></button></div>`}</div>`;
    this.modal(body, { lock: !!ask, cls: 'ev' });
    if (!again) this.snd.play('event');
  }
  pickChoice(id, i) {
    const S = this.S;
    chooseEvent(S, id, i);
    this.snd.play('select');
    this.modalLock = false;
    this.toast(`${ic('check')}${esc(evCard(S, id).opts[i].t)}`);
    this.refresh();
    this.nextCard();
  }
  showEnd() {
    const S = this.S, o = S.over, win = o.win === this.P;
    this.dropSave();
    this.snd.stopMusic();
    this.snd.play(win ? 'victory' : 'defeat');
    const st = S.stats;
    this.modal(`<div class="e-end ${win ? 'good' : 'bad'}"><div class="e-evic">${ic(win ? 'trophy' : 'skull')}</div>
<h2>${win ? 'Победа!' : 'Поражение'}</h2><p>${esc(o.why)}</p>
<div class="e-rdate">${ic('calendar')}${esc(fmtTurn(o.turn, true))} · ${o.turn} ${plural(o.turn, 'неделя', 'недели', 'недель')} войны</div>
${this.histCmp(o)}
<div class="e-stats">
<div class="e-stat">${ic('skull')}<b>${st[other(this.P)].lost}</b><small>дивизий врага разбито</small></div>
<div class="e-stat">${ic('encircle')}<b>${st[other(this.P)].pow}</b><small>взято в плен в котлах</small></div>
<div class="e-stat">${ic('skull')}<b>${st[this.P].lost}</b><small>своих дивизий потеряно</small></div>
<div class="e-stat">${ic('atk')}<b>${st[this.P].battles}</b><small>наших ударов</small></div>
</div>
<div class="e-btns"><button class="e-btn" data-a="exitgame">${ic('exit')}<span>В меню</span></button><button class="e-btn gold" data-a="newgame">${ic('play')}<span>Новая игра</span></button></div></div>`, { lock: true, cls: 'end' });
    this.mode = 'over';
  }
  // сравнение с историей: Берлин взят 2 мая 1945 г.
  histCmp(o) {
    if (o.win !== 'SOV') return '';
    const d = o.turn - turnOf('1945-05-02'), n = Math.abs(d), w = `${n} ${plural(n, 'неделю', 'недели', 'недель')}`;
    const sov = this.P === 'SOV', good = sov ? d < -1 : d > 1;
    const txt = n <= 1 ? 'Почти точно как в истории (2 мая 1945)'
      : sov ? (d < 0 ? `На ${w} раньше, чем в истории` : `На ${w} позже, чем в истории`)
        : d > 0 ? `Рейх продержался на ${w} дольше, чем в истории` : `На ${w} раньше, чем в истории`;
    const st = sov ? (d <= -8 ? 3 : d <= 4 ? 2 : 1) : d >= 8 ? 3 : d >= -4 ? 2 : 1;
    return `<div class="e-hcmp ${good ? 'good' : ''}"><span class="e-stars">${[1, 2, 3].map((k) => ic('star', k <= st ? 'on' : 'off')).join('')}</span><span>${esc(txt)}</span></div>`;
  }
  // ——— верхняя панель, флажки целей ———
  refresh() {
    const S = this.S;
    if (!S || this.mode !== 'game') return;
    const P = this.P, inc = S.inc[P]?.pp !== undefined ? S.inc[P] : E.income(S, P);
    this.$('.e-date b').textContent = fmtTurn(S.turn, true);
    this.$('.e-date small').textContent = `неделя ${S.turn + 1} · ${S.mode === 'hist' ? 'история' : 'свободно'}`;
    this.$('.e-wx').innerHTML = S.wx.map((w, z) => `<span title="${esc(ZN_[z])}: ${esc(WX[w].n)}">${ic(WX[w].ic)}<small>${esc(ZONES[z].s)}</small></span>`).join('');
    const L = S.line[P], gq = inc.out ? inc.out.inf + inc.out.art + inc.out.arm : inc.pp * (L.sh.inf * L.e.inf + L.sh.art * L.e.art + L.sh.arm * L.e.arm);
    this.$('.e-res').innerHTML = `<button class="e-chip" data-a="eco" title="Снаряжение: запас и выпуск в неделю">${ic('equip')}<b>${num(E.eqTot(S, P))}</b>${gq ? `<small>+${num(gq)}</small>` : ''}</button>
<button class="e-chip" data-a="army" title="Люди">${ic('men')}<b>${num(S.men[P])}</b>${inc.men ? `<small>+${num(inc.men)}</small>` : ''}</button>
<button class="e-chip" data-a="eco" title="Авиация">${ic('air')}<b>${num(S.air[P])}</b></button>
<span class="e-chip" title="Политическая власть">${ic('pol')}<b>${num(S.pol?.[P] || 0)}</b></span>
<span class="e-mor" title="Боевой дух: ${Math.round(S.mor[P])}">${flagHTML(P, 'xs')}<i><em style="width:${Math.round(S.mor[P])}%"></em></i></span>`;
    this.$('.e-next').disabled = !!this.isBusy;
    this.map.flags = [];
    for (const z of frontsOn(S, P)) if (S.post[P][z] === 'atk' && S.tgt[P][z] >= 0 && !S.fr[P][z].man) this.map.flags.push({ r: S.tgt[P][z], label: frontShort(S.fr[P][z].n), col: FRONT_COL[S.fr[P][z].col] });
    this.map.refresh();
    if (!this.$('.e-panel').classList.contains('hidden')) this.renderPanel();
  }
  homeView(anim = true) {
    const S = this.S, M = this.M, P = this.P, rs = [];
    for (let r = 0; r < M.R; r++) if (E.sideOf(S, r) === P && E.isFront(S, r, P) && M.reg[r].z >= 1 && M.reg[r].z <= 3) rs.push(r);
    if (!rs.length) return;
    let x = 0, y = 0;
    for (const r of rs) { x += M.reg[r].x; y += M.reg[r].y; }
    x /= rs.length; y /= rs.length;
    const sc = Math.max(this.map.minSc, Math.min(0.62, Math.min(this.map.w / 1300, this.map.h / 900)));
    if (anim) this.map.flyTo(x, y, sc); else this.map.centerOn(x, y, sc);
  }
  // ——— панели ———
  openPanel(kind, arg) {
    if (this.tipK) this.hideTip(true, true);
    this.panelKind = kind; this.panelArg = arg;
    const p = this.$('.e-panel');
    p.className = `e-panel k-${kind}`;
    this.renderPanel();
    for (const b of this.root.querySelectorAll('.e-tab')) b.classList.toggle('on', b.dataset.a === kind);
    if (kind === 'dirs') this.tipSeen('dirs');
  }
  closePanel() {
    const p = this.$('.e-panel');
    if (p.classList.contains('hidden')) return;
    p.className = 'e-panel hidden'; p.innerHTML = '';
    for (const b of this.root.querySelectorAll('.e-tab')) b.classList.remove('on');
    if (this.panelKind === 'reg' && !this.sel) this.map.setHL({ sel: -1 });
    this.panelKind = null;
    this.tipSoon();
  }
  renderPanel() {
    const k = this.panelKind, p = this.$('.e-panel');
    const st = this.pkLast === `${k}:${this.panelArg}` ? p.querySelector('.e-pbody')?.scrollTop || 0 : 0;
    this.pkLast = `${k}:${this.panelArg}`;
    const html = k === 'dirs' ? this.pDirs() : k === 'army' ? this.pArmy() : k === 'eco' ? this.pEco() : k === 'log' ? this.pLog() : k === 'reg' ? this.pRegion(this.panelArg) : '';
    p.innerHTML = html;
    const b = p.querySelector('.e-pbody'); if (b) b.scrollTop = st;
  }
  head(icn, title, sub = '') { return `<div class="e-ph">${icn}<div><h3>${title}</h3>${sub ? `<small>${sub}</small>` : ''}</div><button class="e-ib" data-a="pclose" aria-label="Закрыть">${ic('close')}</button></div>`; }
  modeBar(html) {
    if (this.tipK) this.hideTip(true, true);
    const b = this.$('.e-modebar');
    b.innerHTML = `${html}<button class="e-btn sm" data-a="cancel">${ic('cancel')}<span>Отмена</span></button>`;
    b.classList.remove('hidden');
  }
  cancelMode(silent = false) {
    this.pick = null; this.sel = null;
    this.$('.e-modebar').classList.add('hidden');
    this.map?.setHL({ sel: -1, reach: null, atk: null, pick: null, paint: null });
    if (!silent && this.panelKind === 'reg') this.closePanel();
    this.tipSoon();
  }
  // ——— журнал ———
  pLog() {
    const S = this.S, P = this.P;
    const L = S.log.slice().reverse();
    let cur = -1, html = '';
    for (const o of L) {
      if (o.t !== cur) { cur = o.t; html += `<div class="e-lday">${ic('calendar')}${esc(fmtTurn(o.t, true))}</div>`; }
      const good = o.side === P;
      html += o.ev ? `<button class="e-lg ev ${good ? 'good' : 'bad'}" data-a="ev" data-id="${o.ev}">${ic(o.ic || 'info')}<span>${esc(o.txt)}</span>${ic('right')}</button>`
        : `<div class="e-lg ${good ? 'good' : 'bad'}" ${o.r >= 0 ? `data-a="region" data-r="${o.r}"` : ''}>${ic(o.ic || 'info')}<span>${esc(o.txt)}</span></div>`;
    }
    return `${this.head(ic('book'), 'Журнал', 'события и сводки')}<div class="e-pbody">${html || '<div class="e-note">Пока пусто</div>'}</div>`;
  }
  // ——— область: сведения, войска, удар, стройка ———
  openRegion(r) {
    if (r < 0) return;
    this.map.setHL({ sel: r });
    this.openPanel('reg', r);
  }
  attackers(T) {
    const S = this.S, P = this.P;
    if (E.sideOf(S, T) !== other(P)) return [];
    return E.attackersFor(S, T, P).filter((u) => E.canAttack(S, u) && E.natOK(S, u, T));
  }
  pRegion(r) {
    const S = this.S, P = this.P, M = this.M, g = M.reg[r], sd = E.sideOf(S, r), nat = E.natOf(S, r);
    const us = S.at[r].slice().sort((a, b) => ['arm', 'mot', 'inf', 'mtn', 'cav', 'sec'].indexOf(a.t) - ['arm', 'mot', 'inf', 'mtn', 'cav', 'sec'].indexOf(b.t) || b.str - a.str);
    const sup = sd ? S.sup[sd]?.[r] ?? 1 : 1;
    const supT = !sd ? '' : sup <= 0 ? `<span class="e-tag bad">${ic('encircle')}окружение</span>` : sup < 0.5 ? `<span class="e-tag warn">${ic('truck')}слабое снабжение</span>` : `<span class="e-tag">${ic('truck')}снабжение</span>`;
    const name = g.city && g.city.n !== g.n ? `${esc(g.city.n)} <small>${esc(g.n)}</small>` : esc(g.n);
    const info = `<div class="e-tags"><span class="e-tag">${ic(g.t === 'for' ? 'wheat' : g.t === 'mnt' || g.t === 'hil' ? 'mtn' : 'compass')}${esc(TER[g.t].n)}</span><span class="e-tag">${ic(WX[S.wx[g.z]].ic)}${esc(WX[S.wx[g.z]].n)}</span>${sd === this.P ? `<span class="e-tag" style="color:${FRONT_COL[S.fr[sd][S.fz[r]]?.col]}">${ic('flag')}${esc(frontShort(S.fr[sd][S.fz[r]]?.n))}</span>` : `<span class="e-tag">${esc(ZONES[g.z].n)}</span>`}${supT}${g.vp ? `<span class="e-tag gold">${ic('star')}${g.vp}</span>` : ''}</div>`;
    const blds = this.bGrid(r) + (E.garOf(S, r) > 0 && sd ? `<div class="e-bl"><span title="Гарнизон">${ic('rifle')}<small>гарнизон</small></span></div>` : '');
    const ulist = us.length ? `<div class="e-units">${us.map((u) => `<div class="e-u ${u.s === P ? '' : 'en'}"><img src="${counterURL(u.nat, u.t, divLabel(u), wmOf(u))}" alt=""><div><b>${esc(u.n)}</b><small>${esc(TYPES[u.t].n)}${u.nat !== u.s ? ` · ${esc(NAT_N[u.nat])}` : ''}${u.man ? ' · приказ отдан' : ''}</small><i class="e-str"><em style="width:${Math.max(4, u.str)}%;background:${strCol(u.str)}"></em></i>${u.s === P && u.t !== 'sec' && u.rdy < 22 ? `<small class="e-nrdy">${ic('hourglass')}не готова к удару</small>` : ''}</div></div>`).join('')}</div>` : `<div class="e-note">${ic('info')}Войск нет</div>`;
    let act = '';
    if (sd === P) {
      const mv = us.filter((u) => u.s === P && u.mp > 0.2 && !u.att);
      act = mv.length || (P === 'SOV' && E.canEvac(S, r)) ? `<div class="e-acts">${mv.length ? `<button class="e-btn gold" data-a="move" data-r="${r}">${ic('move')}<span>Переместить<small>${mv.length} ${divW(mv.length)}</small></span></button>` : ''}${P === 'SOV' && E.canEvac(S, r) ? `<button class="e-btn sm" data-a="evac" data-r="${r}">${ic('train')}<span>Эвакуация</span></button>` : ''}</div>` : '';
    } else if (sd === other(P)) {
      const at = this.attackers(r);
      if (at.length) {
        const o = E.odds(S, r, at), R = o.R;
        const lab = R >= 1.6 ? ['Высокие шансы', 'good'] : R >= 1.2 ? ['Хорошие шансы', 'good'] : R >= 0.9 ? ['Равные силы', 'warn'] : ['Низкие шансы', 'bad'];
        const w = Math.max(5, Math.min(95, (R / (R + 1)) * 100));
        act = `<div class="e-odds ${lab[1]}"><div class="e-oh">${ic('atk')}<b>${lab[0]}</b><small>×${R.toFixed(1)}</small></div>
<div class="e-force"><span>${flagHTML(P, 'xs')}${at.length}</span><i><em style="width:${w}%"></em></i><span>${S.at[r].length}${E.garOf(S, r) > 0 ? '+' + ic('rifle') : ''}${flagHTML(nat, 'xs')}</span></div>
<div class="e-acts"><button class="e-btn ${R >= 1.2 ? 'gold' : ''}" data-a="attack" data-r="${r}">${ic('atk')}<span>Атаковать<small>${at.length} ${divW(at.length)}</small></span></button><button class="e-btn sm" data-a="settgt" data-r="${r}">${ic('target')}<span>Цель направления</span></button></div></div>`;
      } else act = `<div class="e-acts"><div class="e-note">${ic('info')}Рядом нет наших войск, готовых к удару</div><button class="e-btn sm" data-a="settgt" data-r="${r}">${ic('target')}<span>Цель направления</span></button></div>`;
    }
    return `${this.head(flagHTML(nat || 'NEU'), name, sd ? esc(NAT_N[nat] || '') : 'нейтральная страна')}<div class="e-pbody">${info}${act}${ulist}${sd ? blds : ''}</div>`;
  }
  onTap(r) {
    const S = this.S;
    if (!S || this.mode !== 'game' || this.isBusy) return;
    if (this.pick?.paint !== undefined) return this.paintTap(r);
    if (this.pick) {
      if (r >= 0 && E.sideOf(S, r) === other(this.P)) { this.snd.play('select'); const z = this.pick.z; this.cancelMode(true); this.setTarget(z, r); return this.openPanel('dirs'); }
      this.snd.play('error'); return this.toast(`${ic('target')}Выберите область противника`);
    }
    if (this.sel) return this.tapMove(r);
    if (r < 0) return this.closePanel();
    this.snd.play('click');
    this.openRegion(r);
    this.tipSeen('map');
    if (E.sideOf(S, r) === other(this.P)) this.tipSeen('attack');
  }
  // перемещение стопки: зелёные — куда дойдут, красные — удар
  startMove(r) {
    const S = this.S, P = this.P;
    const us = S.at[r].filter((u) => u.s === P && u.mp > 0.2 && !u.att);
    if (!us.length) return;
    const reach = new Set(), atk = new Set(), R = new Map();
    for (const u of us) { const x = E.reach(S, u); R.set(u, x); for (const b of x.best.keys()) if (b !== r) reach.add(b); }
    const ready = us.filter((u) => E.canAttack(S, u));
    for (const e of this.M.reg[r].nb) if (E.sideOf(S, e.r) === other(P) && (S.at[e.r].length || E.garOf(S, e.r) > 0) && ready.some((u) => E.natOK(S, u, e.r)) && (e.sp !== 'sea' || E.attackersFor(S, e.r, P).length)) atk.add(e.r);
    this.sel = { r, us, R };
    this.closePanel();
    this.map.setHL({ sel: r, reach, atk, pick: null });
    this.modeBar(`${ic('move')}<span>${us.length} ${divW(us.length)}: ${atk.size ? 'зелёное — марш, красное — удар' : ready.length ? 'зелёное — куда дойдут' : 'зелёное — марш (к удару не готовы)'}</span>`);
  }
  tapMove(t) {
    const S = this.S, P = this.P, { r, us, R } = this.sel;
    if (t < 0 || t === r) return this.cancelMode(true);
    if (this.map.hl.atk?.has(t)) {
      const at = us.filter((u) => E.alive(u) && E.canAttack(S, u) && E.natOK(S, u, t));
      if (at.length && E.odds(S, t, at).R < 0.9 && this.confirmAtk !== t) { // низкие шансы — переспросить
        this.confirmAtk = t; clearTimeout(this.confirmT); this.confirmT = setTimeout(() => (this.confirmAtk = -1), 5000);
        this.snd.play('error');
        return this.toast(`${ic('info')}Шансы низкие (×${E.odds(S, t, at).R.toFixed(1)}). Нажмите ещё раз, чтобы атаковать`, 'bad');
      }
      this.confirmAtk = -1;
      this.cancelMode(true);
      if (!at.length) { this.snd.play('error'); return this.toast(`${ic('cancel')}Войска не готовы к удару`); }
      return this.attackWith(t, at);
    }
    if (!this.map.hl.reach?.has(t)) { this.cancelMode(true); return this.onTap(t); }
    let n = 0;
    for (const u of us) {
      if (!E.alive(u) || u.r !== r) continue;
      const x = R.get(u);
      if (!x.best.has(t)) continue;
      if (E.sideOf(S, t) === P && E.room(S, t, P) <= 0) break;
      if (E.moveTo(S, u, t, x)) { u.man = 1; n++; }
      if (E.sideOf(S, t) !== P) break;
    }
    this.cancelMode(true);
    if (!n) { this.snd.play('error'); return this.toast(`${ic('cancel')}Нет места или не дойдут`); }
    this.snd.play('move');
    E.computeSupply(S, P);
    this.toast(`${ic('move')}${n} ${divW(n)} → ${esc(this.M.reg[t].city?.n || this.M.reg[t].n)}`);
    this.refresh();
  }
  doAttack(T) {
    const at = this.attackers(T);
    if (!at.length) return;
    // низкие шансы — переспросить (второе нажатие в течение 5 с)
    if (E.odds(this.S, T, at).R < 0.9 && this.confirmAtk !== T) {
      this.confirmAtk = T; clearTimeout(this.confirmT); this.confirmT = setTimeout(() => (this.confirmAtk = -1), 5000);
      this.snd.play('error');
      const b = this.$(`.e-panel [data-a="attack"][data-r="${T}"]`);
      if (b) { b.classList.add('warn'); b.querySelector('span').innerHTML = 'Точно атаковать?<small>шансы низкие, будут потери</small>'; }
      return;
    }
    this.confirmAtk = -1;
    this.attackWith(T, at);
  }
  attackWith(T, us) {
    const S = this.S, P = this.P, M = this.M;
    const cnt = new Map();
    for (const u of us) cnt.set(u.r, (cnt.get(u.r) || 0) + 1);
    const main = [...cnt.entries()].sort((a, b) => b[1] - a[1])[0][0];
    const keep = new Set(us.filter((u) => u.r !== main && !(TYPES[u.t].mech === 1)));
    const n0 = S.battles.length;
    const res = E.resolveAttack(S, T, us, { keep });
    for (const u of us) u.man = 1;
    this.snd.play('attack');
    const b = S.battles.slice(n0);
    this.map.showBattles(b, 4500);
    E.computeSupply(S, P); E.computeSupply(S, other(P));
    const nm = esc(M.reg[T].city?.n || M.reg[T].n);
    const bt = b[0] || {}, lossT = `${res.lostD ? ` Разбито: ${res.lostD} ${divW(res.lostD)}.` : ''}${res.lostA ? ` Наши потери: ${res.lostA}.` : ''}`;
    setTimeout(() => {
      if (res.win) { this.snd.play('win'); this.toast(`${ic('flag')}${nm}: противник отброшен!${lossT}`, 'good'); }
      else if ((bt.dD || 0) > (bt.dA || 0) * 1.2) { this.snd.play('attack'); this.toast(`${ic('atk')}${nm}: враг понёс потери, но удержался.${lossT}`); }
      else { this.snd.play('lose'); this.toast(`${ic('def')}${nm}: атака отбита.${lossT}`, 'bad'); }
    }, 450);
    this.tipSeen('attack');
    this.refresh();
    if (this.panelKind === 'reg') this.openRegion(T);
  }
  // ——— меню партии ———
  gameMenu() {
    if (this.isBusy) return;
    this.modal(`<h2>${ic('menu')} Меню</h2>
<div class="e-mlist">
<button class="e-btn gold" data-a="close">${ic('play')}<span>Продолжить</span></button>
<button class="e-btn" data-a="save">${ic('save')}<span>Сохранить</span></button>
<button class="e-btn" data-a="settings">${ic('settings')}<span>Настройки</span></button>
<button class="e-btn" data-a="help">${ic('help')}<span>Как играть</span></button>
<button class="e-btn" data-a="exitgame">${ic('exit')}<span>В главное меню</span></button>
</div>
<div class="e-mfoot">${flagHTML(this.P, 'xs')} ${esc(SIDE_N[this.P])} · ${esc(MODES[this.S.mode].n)} · ${esc(DIFF[this.S.diff].n.toLowerCase())}</div>`);
  }
  // ——— окна, уведомления, ожидание ———
  modal(html, o = {}) {
    const m = this.$('.e-modal');
    this.modalLock = !!o.lock;
    m.className = 'e-modal';
    m.innerHTML = `<div class="e-card ${o.cls || ''}">${html}</div>`;
    m.onclick = (e) => { if (e.target === m && !this.modalLock) { this.snd.play('click'); this.closeModal(); } };
    return m.firstElementChild;
  }
  closeModal() {
    const m = this.$('.e-modal');
    if (m.classList.contains('hidden')) return;
    m.className = 'e-modal hidden'; m.innerHTML = ''; this.modalLock = false;
    if (this.mode === 'game' && this.cards?.length) setTimeout(() => this.nextCard(), 50);
  }
  busy(on, label = '') {
    this.isBusy = on;
    const b = this.$('.e-busy');
    b.classList.toggle('hidden', !on);
    b.querySelector('span').textContent = label;
    const nb = this.$('.e-next'); if (nb) nb.disabled = on;
  }
  toast(html, cls = '') {
    const t = document.createElement('div');
    t.className = `e-toast ${cls}`; t.innerHTML = html;
    const box = this.$('.e-toasts');
    box.appendChild(t);
    while (box.children.length > 3) box.firstChild.remove();
    setTimeout(() => t.classList.add('out'), 2600);
    setTimeout(() => t.remove(), 3100);
  }
  // ——— подсказки новичку ———
  tipSeen(k) { if (!this.tipsSeen[k]) { this.tipsSeen[k] = 1; try { localStorage.setItem(TIPS, JSON.stringify(this.tipsSeen)); } catch {} } if (this.tipK === k) this.hideTip(true); }
  tipLater(k) { (this.tipQ ||= []).includes(k) || this.tipQ.push(k); }
  maybeTip() {
    if (!this.opt.tips || this.mode !== 'game' || this.isBusy || !this.$('.e-modal').classList.contains('hidden') || this.tipK) return;
    if (!this.$('.e-panel').classList.contains('hidden') || this.pick || this.sel) return; // только когда игрок ничего не делает
    const order = ['map', 'dirs', 'next', ...(this.S.turn >= 1 ? ['attack'] : []), ...(this.tipQ || [])];
    const k = order.find((x) => !this.tipsSeen[x]);
    if (!k) return;
    const [icn, t, d] = TIP_TEXT[k];
    const el = this.$('.e-tip');
    el.className = `e-tip at-${k}`;
    el.innerHTML = `<div class="e-tic">${ic(icn)}</div><div><b>${esc(t)}</b><p>${esc(d)}</p></div><button class="e-btn sm gold" data-a="tipok">${ic('check')}<span>Понятно</span></button>`;
    this.tipK = k;
  }
  hideTip(auto = false, later = false) {
    const k = this.tipK;
    this.$('.e-tip').className = 'e-tip hidden';
    this.tipK = null;
    if (k && !auto) this.tipSeen(k);
    if (this.tipQ && !later) this.tipQ = this.tipQ.filter((x) => x !== k);
    if (k && !later) this.tipSoon();
  }
  tipSoon() { clearTimeout(this.tipT); this.tipT = setTimeout(() => this.maybeTip(), 700); }
}
Object.assign(EastUI.prototype, FrontsUI, EcoUI);
const ACTX = { ...FRONT_ACT, ...ECO_ACT };
