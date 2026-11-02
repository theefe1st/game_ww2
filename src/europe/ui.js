// «Европа 1939–1945» (v0.6.1): интерфейс стратегического режима — дивизии на карте, как в «Мировом фронте».
// Нажмите на свою дивизию — подсветятся цели: зелёный — марш, жёлтый — занять, красный — атака, оранжевый — обстрел,
// фиолетовый — десант. Атака — с прогнозом и подтверждением. Своя пустая провинция — формирование дивизий.
// Хост (game.js) даёт: icon(name, k) → <img>, sfx {click, select, move, boom, capture, turn, error, win, lose, tele},
// exit() — в главное меню, deep(op, nat, diff, cb) — тактическая битва из «Мирового фронта» (cb({win, stars}) | cb(null)).
import EJ from '../data/europe.json';
import './europe.css';
import { initMap, newGame, turnSteps, save, load } from './engine.js';
import {
  G, reg, UT, TYPES, AIR, MAXS, MECH, TERR_N, TECH, xpL, orgMax, dateLabel, shortDate, tDate, weather, supply, combat, attack, moves,
  attackTargets, amphTargets, moveTo, railTargets, railMove, seaTargets, seaMove, canAir, airEst, airStrike, techCost, techYear, income,
  upkeep, buildCost, buildSite, canBuild, build, canBuyAir, buyAir, reCost, canReinforce, reinforce, mvOf, fortLvl, vpState, totalStr,
  alive, ally, atWar, side, coop, pairKey, unitAt,
} from './rules.js';
import { NATIONS } from './regions.js';
import { EV, resolveEvent, playerWar } from './events.js';
import { EuropeMap, natRGB, sprite } from './map.js';

const KEY = `wf_eu_v2`, KEY_OPT = `wf_eu_opt`;
const DIFF = [`Лёгкая`, `Нормальная`, `Сложная`];
const esc = (s) => String(s ?? ``).replace(/[&<>"]/g, (c) => ({ '&': `&amp;`, '<': `&lt;`, '>': `&gt;`, '"': `&quot;` })[c]);
const f0 = (v) => Math.round(v).toLocaleString(`ru-RU`);
const f1 = (v) => (Math.round(v * 10) / 10).toLocaleString(`ru-RU`);
const sgn = (v) => (v >= 0 ? `+` : `−`) + f0(Math.abs(v));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const raf = () => new Promise((r) => requestAnimationFrame(() => r()));
const rgb = (c, k = 1, a = 1) => `rgba(${c.map((v) => Math.round(Math.min(255, v * k))).join(`,`)},${a})`;
const plural = (n, a, b, c) => {
  const m = Math.abs(n) % 100, k = m % 10;
  return m > 10 && m < 20 ? c : k === 1 ? a : k >= 2 && k <= 4 ? b : c;
};
const divs = (n) => `${n} ${plural(n, `дивизия`, `дивизии`, `дивизий`)}`;
export const NAT_INFO = {
  SOV: {
    t: `СССР`, s: `Пакт с Германией, Польша, Зимняя война — и 22 июня. Выстоять в 1941-м, перемолоть вермахт и взять Берлин.`,
    goal: `Победа — капитуляция Германии. Поражение — капитуляция СССР.`, hint: `Сложность: тяжёлый 1941 год, затем — растущая мощь.`,
  },
  GER: {
    t: `Германия`, s: `Польша, Франция, Балканы, «Барбаросса». Сокрушить врагов прежде, чем промышленность союзников раздавит рейх.`,
    goal: `Победа — устоять до конца 1945 года или разгромить СССР и Великобританию. Поражение — капитуляция Германии.`, hint: `Сложность: сильная армия, но время работает против вас.`,
  },
  UK: {
    t: `Великобритания`, s: `Одна против рейха в 1940-м: пустыня Африки, Средиземное море, «Факел», «Оверлорд».`,
    goal: `Победа — капитуляция Германии. Поражение — капитуляция Великобритании.`, hint: `Сложность: империя на морях, армия собирается годами.`,
  },
};
const VIEW = {
  1939: { SOV: `minsk kiev wilno lwow bialystok`, GER: `warsaw poznan pomorze lodz krakow`, UK: `lille paris brussels reims metz` },
  1941: { SOV: `minsk lwow bialystok kiev wilno`, GER: `warsaw lwow bialystok minsk krakow`, UK: `tobruk alexandria benghazi matruh sollum` },
};
// тактические битвы «Мирового фронта», доступные из стратегической карты
export const DEEP = [
  { op: `pl39`, nat: `GER`, n: `Сентябрь 1939 · Польская кампания`, keys: `warsaw lodz krakow poznan pomorze kielce lublin`, t0: 0, t1: 4, foe: `POL` },
  { op: `smolensk41`, nat: `SOV`, n: `Смоленское сражение · 1941`, keys: `smolensk vyazma vitebsk mogilev gomel bryansk`, t0: 44, t1: 52 },
  { op: `moscow41`, nat: `SOV`, n: `Битва за Москву · 1941`, keys: `moscow kalinin rzhev vyazma tula bryansk orel`, t0: 50, t1: 59 },
  { op: `kharkov42`, nat: `SOV`, n: `Харьковское сражение · 1942`, keys: `kharkov poltava sumy dnepropetrovsk stalino`, t0: 60, t1: 68 },
  { op: `rzhev42`, nat: `SOV`, n: `Ржевская битва · 1942`, keys: `rzhev vyazma kalinin smolensk velikiye_luki`, t0: 64, t1: 76 },
  { op: `stalingrad42`, nat: `SOV`, n: `Сталинградская битва · 1942`, keys: `stalingrad millerovo elista rostov voronezh voroshilovgrad astrakhan`, t0: 72, t1: 84 },
  { op: `kursk43`, nat: `SOV`, n: `Курская битва · 1943`, keys: `orel kursk kharkov bryansk sumy voronezh poltava`, t0: 88, t1: 100 },
  { op: `bagration44`, nat: `SOV`, n: `Операция «Багратион» · 1944`, keys: `minsk vitebsk mogilev bobruisk gomel`, t0: 110, t1: 124 },
  { op: `berlin45`, nat: `SOV`, n: `Берлинская операция · 1945`, keys: `berlin stettin dresden leipzig breslau`, t0: 124, t1: 152 },
];
const WX_ICON = { fair: `sun`, heat: `sun`, rain: `rain`, mud: `mud`, snow: `snow`, cold: `frost` };
const SIDE_N = { axis: `Ось`, allies: `Союзники`, comintern: `СССР и союзники` };
const TYPE_N = { inf: `Пехота`, art: `Артиллерия`, cav: `Кавалерия`, mot: `Мотопехота`, arm: `Танки` };
const OUT_N = { destroyed: `уничтожена`, surrender: `сдалась`, retreat: `отступила`, hold: `удержалась` };
const FLAG = (n, s = 14) => `<span class="eu-flag" style="width:${s}px;height:${Math.round(s * 0.72)}px;background:${rgb(natRGB(n))}"></span>`;
const SPRU = new Map();
// пиксельный спрайт дивизии для HTML (×3)
const SPI = (t, n, cls = ``) => {
  const k = `${t}|${n}`;
  let s = SPRU.get(k);
  if (!s) {
    try {
      s = sprite(t, n, 3).toDataURL();
    } catch {
      s = ``;
    }
    SPRU.set(k, s);
  }
  return `<img class="eu-spr ${cls}" src="${s}" alt="" width="48" height="30">`;
};
const cost = (c) => [`${f0(c.pp)} ПП`, c.mp ? `${f0(c.mp)} чел.` : ``, c.oil ? `${f0(c.oil)} нефти` : ``].filter(Boolean).join(` · `);
const bar = (k, cls = ``) => `<span class="eu-bar ${cls}"><i style="width:${Math.round(Math.max(0, Math.min(1, k)) * 100)}%"></i></span>`;

export class EuropeUI {
  constructor(root, host = {}) {
    this.root = root;
    this.host = host;
    this.S = null;
    this.sel = 0;
    this.mode = null;
    this.pv = null;
    this.undo = [];
    this.skip = new Set();
    this.readyS = new Set();
    this.tg = new Map();
    this.busy = false;
    this.opt = { start: 1939, nat: `SOV`, diff: host.diff ?? 1, hist: true, anim: true, ...this.loadOpt() };
    initMap(EJ);
    root.innerHTML = `<canvas class="eu-cv"></canvas>
<div class="eu-top"></div>
<div class="eu-rail"></div>
<div class="eu-sheet"></div>
<div class="eu-rep hidden"></div>
<div class="eu-toasts"></div>
<div class="eu-wait panel hidden"></div>
<div class="eu-hub hidden"></div>
<div class="eu-modal hidden"></div>`;
    this.$ = {};
    for (const k of [`top`, `rail`, `sheet`, `rep`, `toasts`, `wait`, `hub`, `modal`]) this.$[k] = root.querySelector(`.eu-${k}`);
    this.cv = root.querySelector(`.eu-cv`);
    root.addEventListener(`click`, (e) => {
      const b = e.target.closest(`[data-a]`);
      if (!b || !root.contains(b) || b.disabled) return;
      e.stopPropagation();
      this.act(b.dataset.a, b, e);
    });
    this.onResize = () => this.layout();
    window.addEventListener(`resize`, this.onResize);
    this.onVis = () => document.hidden && this.save();
    document.addEventListener(`visibilitychange`, this.onVis);
  }
  ic(n, k = 2) {
    return this.host.icon ? this.host.icon(n, k) : ``;
  }
  sfx(k) {
    try {
      this.host.sfx?.[k]?.();
    } catch {}
  }
  loadOpt() {
    try {
      return JSON.parse(localStorage.getItem(KEY_OPT) || `{}`) || {};
    } catch {
      return {};
    }
  }
  saveOpt() {
    try {
      localStorage.setItem(KEY_OPT, JSON.stringify(this.opt));
    } catch {}
  }
  // ——— сохранение ———
  static hasSave() {
    try {
      const m = JSON.parse(localStorage.getItem(`${KEY}_meta`) || `null`);
      return m && m.v === 2 && localStorage.getItem(KEY) ? m : null;
    } catch {
      return null;
    }
  }
  save() {
    const S = this.S;
    if (!S || !S.player) return;
    try {
      localStorage.setItem(KEY, save(S));
      localStorage.setItem(`${KEY}_meta`, JSON.stringify({ v: 2, p: S.player, t: S.t, d: S.diff, over: !!S.over, at: Date.now() }));
    } catch {}
  }
  saveSoon() {
    clearTimeout(this.svT);
    this.svT = setTimeout(() => this.save(), 400);
  }
  loadGame() {
    try {
      const s = localStorage.getItem(KEY);
      if (!s) return null;
      const S = load(s);
      return S && S.nat && S.player && S.v === 2 ? S : null;
    } catch {
      return null;
    }
  }
  // ——— открытие и закрытие ———
  open() {
    this.root.classList.remove(`hidden`);
    if (this.S && this.map && !this.S.over) {
      this.map.pause(false);
      this.render();
      return;
    }
    this.showHub();
  }
  close() {
    this.save();
    this.map?.pause(true);
    this.root.classList.add(`hidden`);
  }
  exit() {
    this.close();
    this.host.exit?.();
  }
  ensureMap() {
    if (this.map) return this.map;
    this.map = new EuropeMap(this.cv, { onTap: (r) => this.tap(r) });
    return this.map;
  }
  // Android «назад»
  back() {
    if (this.root.classList.contains(`hidden`)) return false;
    if (!this.$.modal.classList.contains(`hidden`)) {
      this.$.modal.dataset.lock !== `1` && (this.sfx(`click`), this.closeModal());
      return true;
    }
    if (!this.$.hub.classList.contains(`hidden`)) {
      this.sfx(`click`);
      this.exit();
      return true;
    }
    if (this.busy) return true;
    if (this.pv) return this.closePv(), this.render(), true;
    if (this.mode) return (this.mode = null), this.render(), true;
    if (this.sel) return this.select(0), true;
    this.showMenu();
    return true;
  }
  // ——— выбор кампании ———
  showHub() {
    const m = EuropeUI.hasSave(), o = this.opt;
    this.ensureMap();
    if (!this.S || this.S.over || this.S.player == null) {
      const bg = newGame({ seed: 1, player: null, start: 1939 });
      bg.player = o.nat;
      this.S = null;
      this.map.setReady(new Set());
      this.map.setState(bg);
      this.map.fit([90, 40, 800, 640], 2);
    }
    this.root.classList.add(`hubmode`);
    this.$.hub.classList.remove(`hidden`);
    this.closeModal(true);
    const cont = m && !m.over
      ? `<button class="btn gold eu-cont" data-a="cont">Продолжить<small>${esc(NAT_INFO[m.p]?.t || m.p)} · ${esc(shortDate(m.t))} · ход ${m.t + 1} · ${esc(DIFF[m.d] || ``).toLowerCase()}</small></button>`
      : ``;
    this.$.hub.innerHTML = `<div class="eu-hubin">
<div class="logo sm">ЕВРОПА<br>1939–1945</div>
<div class="tagline">Вся война в Европе · дивизии на карте · ход — полмесяца</div>
${cont}
<div class="eu-h3">Начало</div>
<div class="seg eu-seg"><button class="btn ${o.start === 1939 ? `on` : ``}" data-a="opt" data-k="start" data-v="1939">1 сентября 1939</button><button class="btn ${o.start === 1941 ? `on` : ``}" data-a="opt" data-k="start" data-v="1941">22 июня 1941</button></div>
<div class="eu-h3">Держава</div>
<div class="eu-nats">${[`SOV`, `GER`, `UK`].map((n) => `<div class="eu-nat panel ${o.nat === n ? `sel` : ``}" data-a="opt" data-k="nat" data-v="${n}"><div class="eu-nh">${SPI(n === `GER` ? `arm` : `inf`, n)}<b>${NAT_INFO[n].t}</b></div><p>${esc(NAT_INFO[n].s)}</p><small>${esc(NAT_INFO[n].hint)}</small></div>`).join(``)}</div>
<div class="eu-h3">Сложность</div>
<div class="seg eu-seg">${DIFF.map((d, i) => `<button class="btn ${o.diff === i ? `on` : ``}" data-a="opt" data-k="diff" data-v="${i}">${d}</button>`).join(``)}</div>
<div class="eu-tog panel ${o.hist ? `on` : ``}" data-a="opt" data-k="hist" data-v="${o.hist ? 0 : 1}"><span class="eu-box">${o.hist ? `✓` : ``}</span><span><b>Исторический ход ИИ</b><small>ИИ держится реальных сроков: «Барбаросса», «Тайфун», «Уран», «Багратион», «Оверлорд». Выключите — и война пойдёт своим путём.</small></span></div>
<div class="hint2 center">${esc(NAT_INFO[o.nat].goal)}</div>
<div class="eu-row"><button class="btn" data-a="hubexit">Назад</button><button class="btn ${cont ? `` : `gold`}" data-a="start">${cont ? `Новая кампания` : `Начать кампанию`}</button></div>
</div>`;
    this.layout();
  }
  setOpt(k, v) {
    const o = this.opt;
    k === `start` ? (o.start = +v) : k === `nat` ? (o.nat = v) : k === `diff` ? (o.diff = +v) : k === `hist` && (o.hist = v === `1`);
    this.saveOpt();
    this.sfx(`click`);
    const sc = this.$.hub.scrollTop;
    this.showHub();
    this.$.hub.scrollTop = sc;
  }
  askStart() {
    const m = EuropeUI.hasSave();
    if (m && !m.over)
      return this.modal(`<h2>Новая кампания?</h2><p>Текущая кампания (${esc(NAT_INFO[m.p]?.t || m.p)}, ${esc(shortDate(m.t))}) будет потеряна.</p><div class="eu-row"><button class="btn" data-a="mclose">Отмена</button><button class="btn gold" data-a="start2">Начать заново</button></div>`);
    this.start();
  }
  async start() {
    const o = this.opt;
    this.closeModal(true);
    this.wait(o.start === 1941 ? `Мир движется к 22 июня 1941 года…` : `Европа, август 1939 года…`);
    await raf();
    await sleep(30);
    const S = newGame({ seed: (Date.now() % 1e9) >>> 0, player: o.nat, diff: o.diff, hist: o.hist, start: o.start });
    S.deep = {};
    this.S = S;
    this.wait(null);
    this.sfx(`select`);
    this.enter(true);
  }
  cont() {
    const S = this.loadGame();
    if (!S) return this.toast(`Сохранение не найдено`), this.showHub();
    this.S = S;
    S.deep = S.deep || {};
    this.sfx(`select`);
    this.enter(false);
  }
  enter(fresh) {
    const S = this.S;
    this.undo = [];
    this.skip.clear();
    this.sel = 0;
    this.mode = null;
    this.pv = null;
    this.marks = [];
    this.root.classList.remove(`hubmode`);
    this.$.hub.classList.add(`hidden`);
    this.ensureMap();
    this.map.setState(S);
    this.map.setMarks([]);
    this.map.setArrow(null);
    this.map.flash(null);
    this.render();
    const keys = (VIEW[S.start === 1941 && S.t < 56 ? 1941 : 1939][S.player] || `berlin`).split(` `).map((k) => G.byKey[k]?.i).filter(Boolean);
    this.map.fitRegions(keys, 2.5);
    this.save();
    if (S.deepPend) return this.deepDone(null, S.deepPend);
    if (fresh) this.intro();
    else this.flow();
  }
  intro() {
    const S = this.S, P = S.player, I = NAT_INFO[P];
    const t41 = S.start === 1941;
    const txt = {
      SOV: t41 ? `Разведка доносит: у границы сосредоточены десятки немецких дивизий. До удара — считанные дни. Окопайтесь, держите резервы у Смоленска и Киева.` : `1 сентября 1939 года Германия напала на Польшу. Пакт о ненападении развязал вам руки на западе — но вермахт уже у ворот.`,
      GER: t41 ? `Польша, Франция и Балканы разгромлены. На востоке ждут советские дивизии — и решение о «Барбароссе» за вами.` : `1 сентября 1939 года. Танковые дивизии перешли польскую границу. Англия и Франция объявят войну через два дня.`,
      UK: t41 ? `Британия держится. В пустыне Роммель рвётся к Египту, на востоке Германия готовит удар по СССР — у вас появится союзник.` : `Германия напала на Польшу. 3 сентября Британия объявляет войну. Экспедиционный корпус уже во Франции.`,
    }[P];
    this.modal(`<h2>${esc(dateLabel(S.t))}</h2><div class="eu-sub">${FLAG(P, 18)} ${esc(I.t)} · ${esc(DIFF[S.diff])} · ${S.histOn ? `исторический ИИ` : `свободная война`}</div>
<p>${esc(txt)}</p><p class="eu-goal">${esc(I.goal)}</p>
<div class="eu-tips"><div>${this.ic(`dot`, 2)} Нажмите на свою дивизию — подсветятся цели: <b class="c-move">зелёный</b> — марш, <b class="c-cap">жёлтый</b> — занять, <b class="c-att">красный</b> — атака. Перед атакой покажем шанс и потери.</div>
<div>${this.ic(`dot`, 2)} В провинции — одна дивизия. Фланги усиливают атаку, окопы и местность — оборону. Без снабжения дивизии слабеют.</div>
<div>${this.ic(`dot`, 2)} Нажмите на свою пустую провинцию, чтобы сформировать дивизию. «Следующая» — к дивизии без приказа.</div></div>
<div class="eu-row"><button class="btn gold" data-a="mflow">К карте</button></div>`);
  }
  // ——— раскладка ———
  layout() {
    if (!this.map) return;
    const rr = this.root.getBoundingClientRect(), W = rr.width, H = rr.height, land = W > H * 1.05;
    this.root.classList.toggle(`land`, land);
    this.root.classList.toggle(`port`, !land);
    if (this.root.classList.contains(`hubmode`)) return this.map.setInset(0, 0, 0, 0);
    const top = this.$.top.getBoundingClientRect(), sh = this.$.sheet.getBoundingClientRect(), card = this.$.sheet.querySelector(`.eu-card`);
    const t = Math.max(0, top.bottom - rr.top) + 2;
    if (land) this.map.setInset(0, t, card ? Math.max(0, rr.right - sh.left) + 2 : 0, 0);
    else this.map.setInset(0, t, 0, Math.max(0, rr.bottom - sh.top) + 2);
  }
  render() {
    const S = this.S;
    if (!S) return;
    this.computeReady();
    this.updateHL();
    this.renderTop();
    this.renderRail();
    this.renderSheet();
    this.layout();
  }
  unit(id) {
    return this.S.units.find((u) => u.id === id) || null;
  }
  selU() {
    const u = this.sel ? unitAt(this.S, this.sel) : null;
    return u && u.n === this.S.player ? u : null;
  }
  canAct(u) {
    const S = this.S;
    if (u.fr || u.s < 1) return false;
    if (u.mv > 0 && moves(S, u).size) return true;
    return attackTargets(S, u).size > 0 || amphTargets(S, u).length > 0;
  }
  computeReady() {
    const S = this.S, P = S.player, set = new Set();
    if (!S.over) for (const u of S.units) u.n === P && !this.skip.has(u.id) && this.canAct(u) && set.add(u.id);
    this.readyS = set;
    this.map?.setReady(set);
  }
  inc() {
    const S = this.S, P = S.player, k = `${S.t}|${S._ver}|${S._uv}`;
    if (this.incK !== k) (this.incK = k), (this.incV = income(S, P)), (this.upV = upkeep(S, P));
    return this.incV;
  }
  renderTop() {
    const S = this.S, P = S.player, nat = S.nat[P], inc = this.inc(), cap = G.R.find((R) => R.cap && R.own === P) || G.R[0];
    const wx = weather(S, cap, P), net = inc.oil - this.upV;
    const res = [
      [`pp`, `ПП`, nat.pp, inc.pp],
      [`oil`, `Нефть`, nat.oil, net],
      [`mp`, `Люди`, nat.mp, inc.mp],
    ];
    this.$.top.innerHTML = `<button class="eu-chip panel eu-date" data-a="log">${FLAG(P, 18)}<span><b>${esc(shortDate(S.t))}</b><small>ход ${S.t + 1} · ${this.ic(WX_ICON[wx.k] || `sun`, 1)} ${esc(wx.n)}</small></span></button>
<button class="eu-chip panel eu-air" data-a="air" aria-label="Авиация">${this.ic(`plane`, 2)}<span><b>${nat.air || 0}/${nat.airMax || 0}</b><small>вылеты</small></span></button>
<button class="btn icon eu-menu" data-a="menu" aria-label="Меню">${this.ic(`menu`, 2)}</button>
<button class="eu-res panel" data-a="eco">${res.map(([k, n, v, d]) => `<span class="eu-r"><i class="r-${k}"></i><span><b class="${v < 0 ? `warn` : ``}">${f0(v)}</b><small class="${d < 0 ? `warn` : ``}">${n} ${sgn(d)}</small></span></span>`).join(``)}</button>`;
  }
  renderRail() {
    const S = this.S, nat = S.nat[S.player], air = this.mode?.k === `air`;
    this.$.rail.innerHTML = `<button class="btn icon" data-a="tech" aria-label="Наука">${this.ic(`gear`, 2)}${!nat.res ? `<span class="eu-badge warn">!</span>` : ``}</button>
<button class="btn icon" data-a="pow" aria-label="Державы">${this.ic(`order`, 2)}</button>
<button class="btn icon ${this.map.mode ? `on` : ``}" data-a="mapmode" aria-label="Режим карты">${this.ic(this.map.mode === 2 ? `truck` : `fmap`, 2)}</button>
<button class="btn icon ${air ? `on` : ``}" data-a="airmode" aria-label="Авиаудар">${this.ic(`plane`, 2)}${nat.air ? `<span class="eu-badge">${nat.air}</span>` : ``}</button>
<button class="btn icon eu-zb" data-a="zin" aria-label="Приблизить">+</button><button class="btn icon eu-zb" data-a="zout" aria-label="Отдалить">−</button>`;
  }
  // ——— нижняя панель: карточка и подвал ———
  renderSheet() {
    const S = this.S, el = this.$.sheet;
    let card = ``;
    if (S.over) card = this.overCard();
    else if (this.pv) card = this.pv.k === `air` ? this.airCard() : this.atkCard();
    else if (this.mode?.k === `air`) card = this.airModeCard();
    else if (this.mode) card = this.modeCard();
    else if (this.sel) {
      const u = unitAt(S, this.sel);
      card = u ? (u.n === S.player ? this.unitCard(u) : this.foeCard(u)) : this.provCard(this.sel);
    }
    el.innerHTML = `${card ? `<div class="eu-card panel">${card}</div>` : ``}${this.footHTML()}`;
    el.classList.toggle(`open`, !!card);
  }
  footHTML() {
    const S = this.S, rd = this.readyS.size;
    if (S.over) return `<div class="eu-foot panel"><button class="btn gold eu-end" data-a="overview">Итоги войны</button></div>`;
    return `<div class="eu-foot panel"><button class="btn icon" data-a="undo" aria-label="Отменить" ${this.undo.length && !this.busy ? `` : `disabled`}>${this.ic(`undo`, 2)}</button>
<button class="btn eu-next" data-a="next" ${rd && !this.busy ? `` : `disabled`}>${this.ic(`next`, 2)}<span>Следующая</span>${rd ? `<b class="eu-cnt">${rd}</b>` : ``}</button>
<button class="btn gold eu-end ${this.endArm ? `arm` : ``}" data-a="end" ${this.busy ? `disabled` : ``}>${S.pending.length ? `Решение ждёт` : this.endArm ? `Точно конец?` : `Конец хода`}</button></div>`;
  }
  renderFoot() {
    const f = this.$.sheet.querySelector(`.eu-foot`);
    f && (f.outerHTML = this.footHTML());
  }
  head(u, sub, x = true) {
    return `<div class="eu-ch">${SPI(u.t, u.n)}<span class="eu-cn"><b>${esc(u.nm)}</b><small>${sub}</small></span>${x ? `<button class="btn icon sm eu-x" data-a="desel" aria-label="Закрыть">${this.ic(`cross`, 2)}</button>` : ``}</div>`;
  }
  stats(u, full = true) {
    const S = this.S, om = orgMax(S, u.n), xl = xpL(u.x || 0), sup = supply(S, u.n)[u.r] >= 0;
    const it = [
      [`Сила`, `${f0(u.s)}/${MAXS}`, bar(u.s / MAXS, `s`)],
      [`Организация`, `${f0(u.o)}/${om}`, bar(u.o / om, u.o / om > 0.66 ? `o` : u.o / om > 0.33 ? `y` : `r`)],
    ];
    const tags = [];
    xl && tags.push(`<span class="eu-tag gold">${`★`.repeat(xl)} опыт</span>`);
    u.e > 0 && tags.push(`<span class="eu-tag">окопы ${u.e}</span>`);
    !sup && tags.push(`<span class="eu-tag warn">нет снабжения</span>`);
    if (full && u.n === S.player) {
      const m = mvOf(S, u);
      tags.push(`<span class="eu-tag">${u.fr ? `новая — ходит со следующего хода` : `ходы ${`●`.repeat(Math.max(0, Math.min(m, u.mv)))}${`○`.repeat(Math.max(0, m - Math.max(0, u.mv)))}`}</span>`);
      u.at && !u.fr && tags.push(`<span class="eu-tag">атаковала</span>`);
    }
    return `<div class="eu-stats">${it.map(([a, v, b]) => `<span class="eu-stat"><small>${a}<b>${v}</b></small>${b}</span>`).join(``)}</div>${tags.length ? `<div class="eu-tags">${tags.join(``)}</div>` : ``}`;
  }
  where(i) {
    const S = this.S, R = reg(i), c = S.ctrl[i];
    return `${esc(R.n)} · ${TERR_N[R.t]}${R.cap ? `, столица` : R.city ? `, город` : ``}${c && S.core[i] && S.core[i] !== c ? ` · земля ${esc(NATIONS[S.core[i]].a)}` : ``}`;
  }
  unitCard(u) {
    const S = this.S, nat = S.nat[S.player], U = UT[u.t];
    const k = canReinforce(S, u), rail = railTargets(S, u).length, sea = seaTargets(S, u).length;
    const n = this.tg.size, ready = this.readyS.has(u.id);
    const acts = [];
    u.s < MAXS && acts.push(`<button class="btn sm" data-a="reinf" ${k ? `` : `disabled`}>Пополнить<small>${k ? `+${k}: ${cost(reCost(u, k))}` : u.mv < mvOf(S, u) || u.at || u.mvd ? `только до марша и боя` : `не хватает ресурсов`}</small></button>`);
    rail && acts.push(`<button class="btn sm" data-a="rail">${this.ic(`truck`, 1)} Ж/д<small>эшелонов ${nat.rail}</small></button>`);
    sea && acts.push(`<button class="btn sm" data-a="sea">Морем<small>конвоев ${nat.navl}</small></button>`);
    ready && acts.push(`<button class="btn sm" data-a="skip">Ждать<small>до след. хода</small></button>`);
    const hint = u.fr ? `Дивизия сформирована в этом ходу.` : n ? `<b class="c-move">Зелёный</b> — марш, <b class="c-cap">жёлтый</b> — занять, <b class="c-att">красный</b> — атака${u.t === `art` ? `, <b class="c-bomb">оранжевый</b> — обстрел на 2 провинции` : ``}${[...this.tg.values()].some((k) => k === `amph` || k === `amphcap`) ? `, <b class="c-amph">фиолетовый</b> — десант` : ``}.` : `Приказов больше нет.`;
    return `${this.head(u, `${FLAG(u.n)} ${esc(U.sh)} · ${this.where(u.r)}`)}${this.stats(u)}<p class="eu-hint ${n && !u.fr ? `leg` : ``}">${hint}</p>${acts.length ? `<div class="eu-acts">${acts.join(``)}</div>` : ``}`;
  }
  attackers(j) {
    const S = this.S, P = S.player, out = [];
    for (const u of S.units) {
      if (u.n !== P) continue;
      const t = attackTargets(S, u).get(j);
      t && out.push({ u, k: t.k, e: this.estimate(u, j, t.k) });
    }
    return out.sort((a, b) => b.e.win - a.e.win || b.e.ld - a.e.ld);
  }
  foeCard(u) {
    const S = this.S, P = S.player, war = atWar(S, u.n, P), rel = war ? `<b class="warn">враг</b>` : ally(S, u.n, P) ? `союзник` : coop(S, u.n, P) ? `попутчик` : `нейтрал`;
    let body = `${this.head(u, `${FLAG(u.n)} ${esc(NATIONS[u.n].n)} · ${esc(UT[u.t].sh)} · ${rel}`)}${this.stats(u, false)}`;
    body += `<p class="eu-hint">${this.where(u.r)}${this.defNote(u.r, u.n)}</p>`;
    if (war) {
      const at = this.attackers(u.r).slice(0, 4);
      body += at.length
        ? `<div class="eu-h3">Атаковать</div><div class="eu-al">${at.map((x) => `<button class="btn sm eu-ab" data-a="atkby" data-id="${x.u.id}">${SPI(x.u.t, x.u.n, `sm`)}<span><b>${esc(x.u.nm)}</b><small>${x.k === `bomb` ? `обстрел` : x.k === `amph` ? `десант` : `атака`} · сила ${f0(x.u.s)}</small></span><em class="${x.e.win >= 0.6 ? `good` : x.e.win >= 0.3 ? `` : `warn`}">${x.k === `bomb` ? `−${f1(x.e.ld)}` : `${Math.round(x.e.win * 100)}%`}</em></button>`).join(``)}</div>`
        : `<p class="eu-hint">Рядом нет ваших дивизий, готовых к атаке.</p>`;
    }
    return body;
  }
  defNote(i, n) {
    const S = this.S, R = reg(i), f = fortLvl(S, i, n), out = [];
    f && out.push(`укрепления ${f}`);
    R.riv?.size && out.push(`реки`);
    return out.length ? ` · ${out.join(`, `)}` : ``;
  }
  provCard(i) {
    const S = this.S, P = S.player, R = reg(i), c = S.ctrl[i], wx = weather(S, R, P);
    const enemy = c && atWar(S, c, P);
    const tags = [`${TERR_N[R.t]}${R.cap ? `, столица` : R.city ? `, город` : ``}`, `${this.ic(WX_ICON[wx.k] || `sun`, 1)} ${esc(wx.n)}`];
    R.vp && tags.push(`очки победы ${R.vp}`);
    const ic = R.ic + (S.icAdd[i] || 0);
    ic && tags.push(`пром. ${f1(ic)}`);
    R.oil && tags.push(`нефть ${R.oil}`);
    R.mp && tags.push(`люди ${f1(R.mp)}`);
    S.fort[i] && tags.push(`укрепления ${S.fort[i]}`);
    let sup = ``;
    if (c && ally(S, c, P)) {
      const v = supply(S, P)[i];
      sup = v < 0 ? `<span class="eu-tag warn">нет снабжения</span>` : `<span class="eu-tag">снабжение ${v <= 4 ? `хорошее` : v <= 8 ? `среднее` : `слабое`}</span>`;
    }
    let body = `<div class="eu-ch"><span class="eu-cn"><b>${R.cap ? this.ic(`star`, 1) : ``} ${esc(R.n)}</b><small>${c ? `${FLAG(c)} ${esc(NATIONS[c].n)}` : `нейтральная земля`}${S.core[i] && S.core[i] !== c ? ` · земля ${esc(NATIONS[S.core[i]].a)}` : ``}${enemy ? ` · <b class="warn">враг</b>` : ``}</small></span><button class="btn icon sm eu-x" data-a="desel" aria-label="Закрыть">${this.ic(`cross`, 2)}</button></div>
<div class="eu-tags">${tags.map((x) => `<span class="eu-tag">${x}</span>`).join(``)}${sup}</div>`;
    if (buildSite(S, P, i)) {
      body += `<div class="eu-h3">Сформировать дивизию</div><div class="eu-bld">${TYPES.map((t) => {
        const cc = buildCost(S, P, t), site = buildSite(S, P, i, t), ok = canBuild(S, P, t, i);
        const why = !site ? `нужна промышленность` : ok ? cost(cc) : `${cost(cc)} — не хватает`;
        return `<button class="btn sm eu-bt ${ok ? `` : `no`}" data-a="build" data-t="${t}" ${ok ? `` : `disabled`}>${SPI(t, P, `sm`)}<span><b>${TYPE_N[t]}</b><small>${esc(why)}</small></span></button>`;
      }).join(``)}</div><p class="eu-hint">Дивизия начнёт действовать со следующего хода. Танки и мотопехота — только в промышленных провинциях.</p>`;
    } else if (enemy && !unitAt(S, i)) body += `<p class="eu-hint">Войск нет — провинцию можно занять маршем соседней дивизии.</p>`;
    return body;
  }
  modeCard() {
    const u = this.unit(this.mode.id), S = this.S, nat = S.nat[S.player], k = this.mode.k, n = this.tg.size;
    if (!u) return ``;
    return `${this.head(u, k === `rail` ? `${this.ic(`truck`, 1)} переброска по железной дороге` : `переброска морем`, false)}
<p class="eu-hint">${n ? `Выберите провинцию на карте — подсвечено ${n}.` : `Нет доступных провинций.`} ${k === `rail` ? `Осталось эшелонов: ${nat.rail}.` : `Осталось конвоев: ${nat.navl}.`} Дивизия потратит весь ход.</p>
<div class="eu-acts"><button class="btn sm" data-a="mcancel">Отмена</button></div>`;
  }
  airModeCard() {
    const S = this.S, nat = S.nat[S.player], n = this.tg.size;
    return `<div class="eu-ch"><span class="eu-cn"><b>${this.ic(`plane`, 1)} Авиаудар</b><small>вылетов ${nat.air || 0} из ${nat.airMax || 0}</small></span><button class="btn icon sm eu-x" data-a="mcancel" aria-label="Закрыть">${this.ic(`cross`, 2)}</button></div>
<p class="eu-hint">${!nat.air ? `Вылеты на этот ход израсходованы.` : n ? `Выберите цель — подсвечено <b class="c-bomb">${n}</b>. Удар снижает организацию и может выбить силу.` : `Нет целей в радиусе авиации.`}</p>
<div class="eu-acts"><button class="btn sm" data-a="air">Авиация…</button><button class="btn sm" data-a="mcancel">Готово</button></div>`;
  }
  overCard() {
    const x = this.overText();
    return `<div class="eu-ch"><span class="eu-cn"><b class="${x.win ? `good` : `warn`}">${x.win ? `Победа` : `Поражение`}</b><small>${esc(x.t)}</small></span></div><div class="eu-acts"><button class="btn sm" data-a="hub">Новая кампания</button></div>`;
  }
  // ——— прогноз боя (без расхода случайных чисел кампании) ———
  estimate(u, j, k = `attack`, mod = null) {
    const S = this.S, d = unitAt(S, j);
    if (!d) return null;
    const amph = k === `amph`, art = u.t === `art` && !amph, c = combat(S, u, d, { src: u.r, amph, art }), m = mod || {}, kk = Math.pow(m.r || 1, 0.75);
    let seed = (u.id * 7919 + j * 104729 + S.t * 31 + 17) >>> 0;
    const R = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
    const sr = (v) => Math.floor(v) + (R() < v - Math.floor(v) ? 1 : 0);
    const N = 300;
    let win = 0, kill = 0, la = 0, ld = 0, lo = 0;
    for (let q = 0; q < N; q++) {
      const ds = Math.min(d.s, sr(c.dStr * (0.75 + 0.5 * R()) * kk * (m.d || 1))), dO = Math.round(c.dOrg * (0.8 + 0.4 * R()) * kk * (m.d || 1));
      const as = Math.min(u.s, sr((c.aStr * (0.75 + 0.5 * R())) / kk * (m.a || 1)));
      (la += as), (ld += ds), (lo += Math.min(d.o, dO));
      const dead = d.s - ds <= 0, broke = !art && d.o - dO <= 0;
      (dead || broke) && win++;
      (dead || (broke && !c.canRet)) && kill++;
    }
    return { c, d, win: win / N, kill: kill / N, la: la / N, ld: ld / N, org: Math.max(0, d.o - lo / N), art, amph };
  }
  atkCard() {
    const S = this.S, p = this.pv, u = this.unit(p.id), d = unitAt(S, p.j);
    if (!u || !d) return ``;
    const e = p.e || (p.e = this.estimate(u, p.j, p.k)), T = reg(p.j), w = Math.round(e.win * 100);
    const title = p.k === `bomb` ? `Обстрел` : p.k === `amph` ? `Десант` : `Атака`;
    const side1 = (v, foe) => `<div class="eu-vsu ${foe ? `foe` : ``}">${SPI(v.t, v.n, `sm ${foe ? `flip` : ``}`)}<span><b>${esc(v.nm)}</b><small>${FLAG(v.n, 12)} сила <em>${f0(v.s)}</em> · орг. <em>${f0(v.o)}</em></small></span></div>`;
    const mods = e.c.mods.map((m) => `<span class="eu-mod ${m.good ? `good` : `bad`}">${esc(m.l)} <b>${esc(m.v)}</b></span>`).join(``);
    const deep = this.deepFor(p.j);
    const weak = !e.art && e.win < 0.5 && e.org <= orgMax(S, d.n) * 0.35;
    const res = e.art
      ? `<div class="eu-odds"><span>Без ответного огня · провинцию не займёт</span><span>Потери противника ≈ <b>${f1(e.ld)}</b> силы${e.win > 0.01 ? ` · уничтожить: ${Math.round(e.win * 100)}%` : ``}</span></div>`
      : `<div class="eu-odds"><span class="eu-ow"><span>Шанс прорыва</span>${bar(e.win, w >= 60 ? `o` : w >= 30 ? `y` : `r`)}<b class="${w >= 60 ? `good` : w >= 30 ? `` : `warn`}">${w}%</b></span><span>Потери: ваши ≈ <b>${f1(e.la)}</b> · врага ≈ <b>${f1(e.ld)}</b> · орг. врага ${f0(d.o)} → <b>${f0(e.org)}</b>${e.kill > 0.05 ? ` · разгром ${Math.round(e.kill * 100)}%` : ``}</span>${weak ? `<span class="c-cap">Оборона ослабнет — добейте второй дивизией.</span>` : ``}</div>`;
    return `<div class="eu-ch"><span class="eu-cn"><b>${this.ic(`sword`, 1)} ${title}: ${esc(T.n)}</b><small>${TERR_N[T.t]}${T.cap || T.city ? `, город` : ``} · перевес ×${f1(e.c.R)}</small></span><button class="btn icon sm eu-x" data-a="pvno" aria-label="Закрыть">${this.ic(`cross`, 2)}</button></div>
<div class="eu-vs">${side1(u)}<span class="eu-vsx">→</span>${side1(d, true)}</div>${res}${mods ? `<div class="eu-mods">${mods}</div>` : ``}
<div class="eu-acts eu-pva"><button class="btn sm" data-a="pvno">Отмена</button>${deep ? `<button class="btn sm eu-deepb" data-a="deep">${this.ic(`star`, 1)} Лично</button>` : ``}<button class="btn gold" data-a="fire">${title === `Атака` ? `Атаковать` : title === `Десант` ? `Высадка` : `Огонь`}</button></div>`;
  }
  airCard() {
    const S = this.S, P = S.player, p = this.pv, d = unitAt(S, p.j);
    if (!d) return ``;
    const e = airEst(S, P, p.j), T = reg(p.j);
    return `<div class="eu-ch"><span class="eu-cn"><b>${this.ic(`plane`, 1)} Авиаудар: ${esc(T.n)}</b><small>вылетов ${S.nat[P].air} из ${S.nat[P].airMax}${e.W.air < 1 ? ` · ${esc(e.W.n)} мешает` : ``}</small></span><button class="btn icon sm eu-x" data-a="pvno" aria-label="Закрыть">${this.ic(`cross`, 2)}</button></div>
<div class="eu-vs"><div class="eu-vsu foe">${SPI(d.t, d.n, `flip`)}<span><b>${esc(d.nm)}</b><small>${FLAG(d.n)} сила ${f0(d.s)} · орг. ${f0(d.o)}</small></span></div></div>
<div class="eu-odds"><span>Организация противника ≈ <b>−${f0(e.org)}</b></span><span>Шанс выбить 1 силы: <b>${Math.round(e.p * 100)}%</b>${T.t === `fo` || T.t === `mo` || T.city || T.cap ? ` (укрытие: ${T.t === `fo` ? `леса` : T.t === `mo` ? `горы` : `город`})` : ``}</span></div>
<div class="eu-acts eu-pva"><button class="btn sm" data-a="pvno">Отмена</button><button class="btn gold" data-a="fire">Ударить</button></div>`;
  }
  // ——— цели и подсветка ———
  computeTargets() {
    const S = this.S, m = new Map(), P = S.player;
    this.mvI = new Map();
    if (!S || S.over) return m;
    if (this.mode?.k === `air`) {
      if ((S.nat[P].air || 0) > 0) for (const v of S.units) atWar(S, v.n, P) && canAir(S, P, v.r) && m.set(v.r, `air`);
      return m;
    }
    const u = this.mode ? this.unit(this.mode.id) : this.selU();
    if (!u) return m;
    if (this.mode?.k === `rail`) {
      for (const j of railTargets(S, u)) m.set(j, `rail`);
      return m;
    }
    if (this.mode?.k === `sea`) {
      for (const j of seaTargets(S, u)) m.set(j, `sea`);
      return m;
    }
    for (const [j, mv] of moves(S, u)) m.set(j, mv.k), this.mvI.set(j, mv);
    for (const j of amphTargets(S, u)) !m.has(j) && (m.set(j, `amphcap`), this.mvI.set(j, { r: j, k: `amphcap`, cost: u.mv, path: [u.r, j] }));
    for (const [j, t] of attackTargets(S, u)) m.set(j, t.k);
    return m;
  }
  updateHL() {
    this.tg = this.computeTargets();
    this.map?.setHL(this.tg, this.mode?.k === `air` ? 0 : this.sel);
  }
  // ——— ввод на карте ———
  tap(r) {
    const S = this.S;
    if (this.busy || !S || !this.$.modal.classList.contains(`hidden`) || this.root.classList.contains(`hubmode`)) return;
    const k = this.tg.get(r);
    if (this.pv) {
      if (r === this.pv.j) return this.fire();
      this.closePv();
      if (this.mode?.k === `air` && k === `air`) return this.openAir(r);
    }
    if (S.over) return this.select(r === this.sel ? 0 : r);
    if (this.mode?.k === `air`) {
      if (k === `air`) return this.openAir(r);
      this.mode = null;
    }
    const u = this.mode ? this.unit(this.mode.id) : this.selU();
    if (u && k) {
      if (k === `move` || k === `capture` || k === `amphcap`) return this.doMove(u, r);
      if (k === `rail` || k === `sea`) return this.doShip(u, r, k);
      if (k === `attack` || k === `bomb` || k === `amph`) return this.openAtk(u, r, k);
    }
    if (this.mode) {
      this.mode = null;
      this.sfx(`click`);
      return this.render();
    }
    if (!r || r === this.sel) return this.select(0);
    this.select(r);
  }
  select(r) {
    const S = this.S;
    this.sel = r || 0;
    this.pv = null;
    this.map.setArrow(null);
    const u = r ? unitAt(S, r) : null;
    r && this.sfx(u && u.n === S.player ? `select` : `click`);
    this.render();
    if (u && u.n === S.player && this.tg.size) {
      const list = [r, ...this.tg.keys()];
      this.revealAll(list);
    } else r && this.map.reveal(r);
  }
  // показать выбранную дивизию и её цели, не меняя масштаб без нужды
  revealAll(list) {
    const m = this.map, { l, t, r, b } = m.inset, pad = 30;
    const out = list.some((i) => {
      const R = reg(i), [x, y] = m.toScr(R.ax, R.ay);
      return x < l + pad || x > m.W - r - pad || y < t + pad || y > m.H - b - pad;
    });
    out && m.fitRegions(list, Math.max(m.z, 1.8), 380, 14);
  }
  // если ни одна цель не видна — показать ближайшие
  revealAny(list) {
    const m = this.map, { l, t, r, b } = m.inset;
    const seen = list.some((i) => {
      const R = reg(i), [x, y] = m.toScr(R.ax, R.ay);
      return x > l + 10 && x < m.W - r - 10 && y > t + 10 && y < m.H - b - 10;
    });
    if (seen) return;
    const near = list.map((i) => [i, (reg(i).ax - m.cx) ** 2 + (reg(i).ay - m.cy) ** 2]).sort((a, b) => a[1] - b[1]).slice(0, 5).map((x) => x[0]);
    m.fitRegions(near, Math.max(m.z, 1.8), 420, 14);
  }
  pushUndo() {
    this.undo.push({ s: save(this.S), sel: this.sel, skip: [...this.skip] });
    this.undo.length > 12 && this.undo.shift();
  }
  doUndo() {
    const x = this.undo.pop();
    if (!x || this.busy) return;
    const S = load(x.s);
    S.deep = S.deep || {};
    this.S = S;
    this.skip = new Set(x.skip);
    this.mode = null;
    this.pv = null;
    this.map.setState(S);
    this.map.setArrow(null);
    this.sfx(`click`);
    this.sel = x.sel;
    this.render();
    this.saveSoon();
  }
  // после приказа: дивизия ещё может действовать — остаётся выбранной
  afterAct(u) {
    const S = this.S;
    this.mode = null;
    this.pv = null;
    this.map.setArrow(null);
    this.sel = u && S.units.includes(u) && this.canAct(u) ? u.r : 0;
    this.render();
    this.saveSoon();
  }
  doMove(u, j) {
    const S = this.S, mv = this.mvI.get(j) || moves(S, u).get(j);
    if (!mv) return;
    this.pushUndo();
    const from = u.r, cap = mv.k !== `move`;
    moveTo(S, u, j, mv);
    this.map.animMove(u.id, mv.path?.length > 1 ? mv.path : [from, j]);
    cap && this.map.refresh();
    this.sfx(cap ? `capture` : `move`);
    cap && this.map.floatText(j, `+${reg(j).n}`, `#ffe27a`, 260);
    this.afterAct(u);
  }
  doShip(u, j, k) {
    const S = this.S;
    this.pushUndo();
    const from = u.r;
    k === `rail` ? railMove(S, u, j) : seaMove(S, u, j);
    this.map.animMove(u.id, [from, j], k === `rail` ? 520 : 700);
    this.sfx(`move`);
    this.afterAct(u);
  }
  openAtk(u, j, k) {
    this.pv = { k, id: u.id, j };
    this.pv.e = this.estimate(u, j, k);
    this.map.setArrow(u.r, j, k === `bomb` ? `#ffa040` : k === `amph` ? `#d68cff` : `#ff6a50`);
    this.sfx(`click`);
    this.renderSheet();
    this.layout();
    this.revealAll([u.r, j]);
  }
  openAir(j) {
    this.pv = { k: `air`, j };
    this.sel = 0;
    this.sfx(`click`);
    this.map.setHL(this.tg, j);
    this.renderSheet();
    this.layout();
  }
  closePv() {
    this.pv = null;
    this.map.setArrow(null);
  }
  fire(mod = null, note = ``) {
    const S = this.S, p = this.pv;
    if (!p || this.busy) return;
    if (p.k === `air`) return this.doAir(p.j);
    const u = this.unit(p.id), d = unitAt(S, p.j);
    if (!u || !d || !attackTargets(S, u).get(p.j)) return this.closePv(), this.render();
    this.undo = [];
    const from = u.r, j = p.j, T = reg(j);
    const rep = attack(S, u, j, { amph: p.k === `amph`, mod });
    this.closePv();
    if (!rep) return this.render();
    const m = this.map;
    m.boomAt(j, 0, rep.win);
    rep.dS ? m.floatText(j, `−${rep.dS}`, `#ff7a6a`, 80) : rep.dO && m.floatText(j, `орг −${rep.dO}`, `#ffd27a`, 80);
    rep.aS && m.floatText(from, `−${rep.aS}`, `#ffb0a0`, 200);
    rep.out === `retreat` && rep.to && m.animMove(rep.du, [j, rep.to], 320, 120);
    rep.adv && m.animMove(u.id, [from, j], 300, 260);
    rep.adv && m.refresh();
    this.sfx(`boom`);
    rep.win && setTimeout(() => this.sfx(`capture`), 320);
    const ttl = rep.art
      ? rep.out === `destroyed` ? `Обстрел: дивизия противника уничтожена` : `Обстрел: ${T.n}`
      : rep.out === `hold` ? `Атака на ${T.n} отбита` : rep.adv ? `${T.n} взят: противник ${OUT_N[rep.out]}` : `Противник ${OUT_N[rep.out]}`;
    const ls = (s, o) => [s ? `сила −${s}` : ``, o ? `орг. −${o}` : ``].filter(Boolean).join(`, `) || `нет`;
    const loss = `${note ? note + ` ` : ``}Потери: ваши — ${ls(rep.aS, rep.aO)}; противника — ${ls(rep.dS, rep.dO)}${rep.aDead ? `. Ваша дивизия погибла.` : ``}`;
    this.report(ttl, loss, rep.win ? `good` : rep.art ? `` : `warn`);
    this.afterAct(rep.aDead ? null : u);
  }
  doAir(j) {
    const S = this.S, P = S.player;
    if (!canAir(S, P, j)) return this.closePv(), this.render();
    this.undo = [];
    const rep = airStrike(S, P, j);
    this.closePv();
    if (!rep) return this.render();
    this.map.boomAt(j);
    this.map.floatText(j, rep.dS ? `−${rep.dS}` : `орг −${rep.dO}`, rep.dS ? `#ff7a6a` : `#ffd27a`, 60);
    rep.dS && this.map.floatText(j, `орг −${rep.dO}`, `#ffd27a`, 300, 16);
    this.sfx(`boom`);
    this.report(rep.out === `destroyed` ? `Авиаудар: дивизия уничтожена` : `Авиаудар: ${reg(j).n}`, `Противник: ${rep.dS ? `−${rep.dS} силы, ` : ``}−${rep.dO} организации. Осталось вылетов: ${S.nat[P].air}.`, `good`);
    (S.nat[P].air || 0) <= 0 && (this.mode = null);
    this.sel = 0;
    this.render();
    this.saveSoon();
  }
  doBuild(t) {
    const S = this.S, P = S.player, i = this.sel;
    if (!canBuild(S, P, t, i)) return this.sfx(`error`);
    this.pushUndo();
    const u = build(S, P, t, i);
    if (!u) return;
    this.map.boomAt(i);
    this.map.floatText(i, `+${TYPE_N[t]}`, `#9ff0a6`, 60);
    this.sfx(`select`);
    this.render();
    this.saveSoon();
  }
  doReinf() {
    const S = this.S, u = this.selU();
    if (!u) return;
    if (!canReinforce(S, u)) return this.sfx(`error`);
    this.pushUndo();
    const k = reinforce(S, u);
    this.map.floatText(u.r, `+${k}`, `#9ff0a6`);
    this.sfx(`select`);
    this.render();
    this.saveSoon();
  }
  nextReady() {
    const S = this.S, list = S.units.filter((u) => this.readyS.has(u.id));
    if (!list.length) return this.toast(`Все дивизии получили приказы`);
    const cur = unitAt(S, this.sel), k = cur ? list.indexOf(cur) : -1, u = list[(k + 1) % list.length];
    this.mode = null;
    this.closePv();
    this.select(u.r);
    this.map.reveal(u.r, 300);
  }
  // ——— тактическая битва «Мирового фронта» ———
  deepFor(j) {
    const S = this.S;
    if (!this.host.deep || !S) return null;
    const k = reg(j).k, c = S.ctrl[j];
    return DEEP.find((d) => d.nat === S.player && S.t >= d.t0 && S.t <= d.t1 && d.keys.split(` `).includes(k) && !(d.op in (S.deep || {})) && (d.foe ? c === d.foe : c === `GER` || (c && side(S, c) === `axis`))) || null;
  }
  askDeep() {
    const p = this.pv, d = p && this.deepFor(p.j);
    if (!d) return;
    this.deepAsk = d;
    this.modal(`<h2>${this.ic(`star`, 2)} ${esc(d.n)}</h2><p>Вы примете командование в тактической битве «Мирового фронта». Это займёт 20–40 минут. Кампания сохранится — после битвы вы вернётесь к этой карте, а итог решит исход удара на ${esc(reg(p.j).n)}.</p>
<p class="eu-hint">★★★ — оборона разгромлена · ★★ — перевес · ★ — обычный удар · поражение — наступление захлебнулось. Выход из битвы в меню — командование переходит штабу (обычный бой).</p>
<div class="eu-row"><button class="btn" data-a="mclose">Назад</button><button class="btn gold" data-a="deepgo">В бой!</button></div>`);
  }
  goDeep() {
    const d = this.deepAsk, S = this.S, p = this.pv;
    if (!d || !p) return;
    S.deep = S.deep || {};
    S.deep[d.op] = -1;
    S.deepPend = { j: p.j, id: p.id, k: p.k, op: d.op };
    this.undo = [];
    this.closePv();
    this.save();
    this.closeModal(true);
    this.close();
    this.sfx(`select`);
    this.host.deep(d.op, d.nat, S.diff, (res) => this.deepDone(res));
  }
  deepDone(res, p0) {
    const S = this.S, p = p0 || S?.deepPend;
    if (!S || !p) return;
    S.deepPend = null;
    S.deep = S.deep || {};
    S.deep[p.op] = res ? (res.win ? res.stars || 1 : 0) : -2;
    const u = this.unit(p.id), d = unitAt(S, p.j);
    this.render();
    if (!u || !d || !attackTargets(S, u).get(p.j)) return this.toast(`Удар отменён: обстановка изменилась`), this.save();
    this.pv = { k: p.k || `attack`, id: u.id, j: p.j };
    if (!res) return this.fire(null, `Командование передано штабу фронта.`);
    if (!res.win) {
      u.s = Math.max(1, u.s - 2), (u.o = Math.min(u.o, orgMax(S, u.n) * 0.25)), (u.at = 1), (u.mv = 0);
      this.closePv();
      this.sfx(`boom`);
      this.map.boomAt(p.j);
      this.report(`Наступление на ${reg(p.j).n} захлебнулось`, `Тактическое поражение: дивизия понесла тяжёлые потери.`, `warn`);
      this.render();
      return this.save();
    }
    const st = res.stars || 1;
    st >= 3 && (d.o = Math.round(d.o * 0.5));
    this.fire({ r: st >= 3 ? 1.6 : st === 2 ? 1.3 : 1.12 }, `Тактическая победа ${`★`.repeat(st)}.`);
  }
  // ——— экономика и авиация ———
  showEco() {
    const S = this.S, P = S.player, nat = S.nat[P], inc = this.inc(), up = this.upV;
    const rows = TYPES.map((t) => {
      const U = UT[t], c = buildCost(S, P, t);
      return `<div class="eu-pw">${SPI(t, P, `sm`)}<span class="eu-un"><b>${TYPE_N[t]}</b><small>атака ${U.atk} · защита ${U.def} · ходы ${U.mv}${U.oil ? ` · топливо ${f1(U.oil)}/ход` : ``} — ${esc(U.d)}</small></span><span class="eu-cost">${esc(cost(c))}</span></div>`;
    }).join(``);
    this.modal(`<h2>${this.ic(`crate`, 2)} Экономика</h2>
<div class="eu-info"><span><small>Промышленность (ПП)</small><b>${f0(nat.pp)} <em class="good">${sgn(inc.pp * 0.88)}</em></b></span><span><small>Нефть</small><b>${f0(nat.oil)} <em class="${inc.oil - up < 0 ? `warn` : `good`}">${sgn(inc.oil - up)}</em></b></span><span><small>Людские резервы</small><b>${f0(nat.mp)} <em class="good">${sgn(inc.mp)}</em></b></span></div>
<p class="eu-hint">ПП за ход: ${f1(inc.pp)}, из них 12 % — на науку. Нефть: добыча и поставки ${f1(inc.oil)}, расход танков, мотопехоты и авиации ${f1(up)}. Без нефти танки и мотопехота ходят только на 1 провинцию.</p>
<div class="eu-tog panel ${nat.autoRe !== false ? `on` : ``}" data-a="autore"><span class="eu-box">${nat.autoRe !== false ? `✓` : ``}</span><span><b>Автопополнение</b><small>В конце хода дивизии, которые не двигались и не воевали, получают +1 силы (ПП и люди списываются).</small></span></div>
<div class="eu-h3">Дивизии · стоимость формирования</div><div class="eu-pl">${rows}</div>
<p class="eu-hint">Формировать — нажмите на свою пустую провинцию со снабжением. Каждая новая дивизия чуть дороже предыдущей.</p>
<div class="eu-row"><button class="btn gold" data-a="mclose">Закрыть</button></div>`, { cls: `wide` });
  }
  showAir() {
    const S = this.S, P = S.player, nat = S.nat[P], ok = canBuyAir(S, P);
    this.modal(`<h2>${this.ic(`plane`, 2)} Авиация</h2>
<div class="eu-info"><span><small>Авиаполков</small><b>${nat.airMax || 0} из ${AIR.max}</b></span><span><small>Вылетов в этом ходу</small><b>${nat.air || 0}</b></span><span><small>Техника «Авиация»</small><b>уровень ${nat.tech.air || 0}</b></span></div>
<p class="eu-hint">Каждый авиаполк даёт 1 вылет за ход. Удар по дивизии противника в 3 переходах от вашей снабжаемой земли: −15…25 организации и шанс выбить 1 силы. В лесах, горах и городах цель укрыта, зимой и в распутицу авиация слабее. Авиаполки расходуют нефть.</p>
<div class="eu-row"><button class="btn" data-a="buyair" ${ok ? `` : `disabled`}>Новый авиаполк<small>${esc(cost(AIR.cost))}</small></button><button class="btn gold" data-a="airmode2" ${nat.air ? `` : `disabled`}>Авиаудар</button></div>
<div class="eu-row"><button class="btn" data-a="mclose">Закрыть</button></div>`);
  }
  // ——— наука ———
  showTech() {
    const S = this.S, P = S.player, nat = S.nat[P], y = tDate(S.t).y, inc = this.inc();
    const cards = Object.keys(TECH).map((k) => {
      const lv = nat.tech[k] || 0, c = techCost(lv), yr = techYear(lv + 1), on = nat.res === k, max = lv >= 5;
      const st = max ? `изучено полностью` : y < yr ? `уровень ${lv + 1} — с ${yr} года` : `уровень ${lv + 1}: ${c} очков`;
      return `<div class="eu-tc panel ${on ? `sel` : ``}" ${max ? `` : `data-a="res" data-k="${k}"`}><b>${esc(TECH[k].n)}</b><span class="eu-lv">${[0, 1, 2, 3, 4].map((q) => `<i class="${q < lv ? `on` : ``}"></i>`).join(``)}</span><small>${esc(TECH[k].d)}</small><small class="${on ? `good` : ``}">${on ? `исследуется · ` : ``}${st}</small></div>`;
    }).join(``);
    const cur = nat.res, lv = cur ? nat.tech[cur] || 0 : 0, c = cur ? techCost(lv) : 0;
    this.modal(`<h2>${this.ic(`gear`, 2)} Наука</h2>
<div class="eu-sub">Очки исследований: ${f1(nat.rp || 0)}${cur ? ` из ${c}` : ``} · приток ≈ ${f1(Math.max(0, inc.pp) * 0.12)} за ход</div>
${cur ? bar((nat.rp || 0) / c, `p wide`) : `<p class="warn">Направление не выбрано — очки пропадают.</p>`}
<div class="eu-tcs">${cards}</div>
<p class="eu-hint">Уровень открывается не раньше своего года: 1 — 1939, 2 — 1940 … 5 — 1943.</p>
<div class="eu-row"><button class="btn gold" data-a="mclose">Готово</button></div>`, { cls: `wide` });
  }
  // ——— державы и дипломатия ———
  showPow() {
    const S = this.S, P = S.player;
    const groups = [[`axis`, `Ось`], [`allies`, `Союзники`], [`comintern`, `СССР`], [null, `Нейтралы`], [`dead`, `Капитулировали`]];
    const rel = (n) => (n === P ? `<b class="good">вы</b>` : !alive(S, n) ? `капитуляция` : atWar(S, n, P) ? `<b class="warn">война с вами</b>` : ally(S, n, P) ? `союзник` : coop(S, n, P) ? `попутчик` : side(S, n) ? `не воюет с вами` : `нейтралитет`);
    const canWar = (n) => n !== P && alive(S, n) && !atWar(S, n, P) && !ally(S, n, P) && !coop(S, n, P) && n !== `USA` && !(S.noWar || []).includes(pairKey(n, P)) && G.R.some((R) => S.ctrl[R.i] === n);
    const rows = (g) => Object.keys(NATIONS).filter((n) => (g === `dead` ? !alive(S, n) : alive(S, n) && (side(S, n) || null) === g)).map((n) => {
      const v = vpState(S, n), regs = G.R.filter((R) => S.ctrl[R.i] === n).length, cnt = S.units.filter((u) => u.n === n).length;
      if (alive(S, n) && n !== P && !regs && !cnt && !(n === `USA` && side(S, n))) return ``;
      return `<div class="eu-pw">${FLAG(n, 16)}<span class="eu-un"><b>${esc(NATIONS[n].n)}</b><small>${rel(n)}${alive(S, n) ? ` · провинций ${regs} · ${divs(cnt)} · сила ${f0(totalStr(S, n))}${v.lost ? ` · потеряно ${Math.round(v.k * 100)} % ОП` : ``}` : ``}</small></span>${canWar(n) ? `<button class="btn sm" data-a="war" data-k="${n}">Война</button>` : ``}</div>`;
    }).join(``);
    this.modal(`<h2>${this.ic(`order`, 2)} Державы</h2>
${groups.map(([g, t]) => {
  const h = rows(g);
  return h ? `<div class="eu-h3">${t}</div><div class="eu-pl">${h}</div>` : ``;
}).join(``)}
<p class="eu-hint">Объявление войны нейтралу — его дивизии и союзники станут вашими противниками. «Попутчики» воюют с общим врагом, но не делят снабжение.</p>
<div class="eu-row"><button class="btn gold" data-a="mclose">Закрыть</button></div>`, { cls: `wide` });
  }
  askWar(n) {
    const S = this.S, P = S.player, b = side(S, n);
    this.warAsk = n;
    this.modal(`<h2>Объявить войну: ${esc(NATIONS[n].n)}?</h2><p>${b ? `Вместе с ${esc(NATIONS[n].n)} в войну вступит весь блок «${SIDE_N[b] || b}».` : `Нейтральная держава станет вашим противником.`} ${n === `SOV` && P === `GER` && !S.done.barb ? `Это «Барбаросса» раньше срока — СССР начнёт мобилизацию.` : ``}</p><div class="eu-row"><button class="btn" data-a="pow">Назад</button><button class="btn gold" data-a="war2">Объявить войну</button></div>`);
  }
  doWar() {
    const S = this.S, n = this.warAsk;
    if (!n) return;
    playerWar(S, S.player, n);
    this.sfx(`boom`);
    this.closeModal(true);
    this.map.refresh(true);
    this.render();
    this.report(`Война: ${NATIONS[n].n}`, `${NATIONS[S.player].n} объявляет войну.`, `warn`);
    this.saveSoon();
  }
  // ——— журнал ———
  showLog() {
    const S = this.S, P = S.player, ts = [...new Set([...S.news.map((e) => e.t), ...S.caps.map((c) => c.t), ...S.log.map((l) => l.t)])].sort((a, b) => b - a);
    const body = ts.map((t) => {
      const ns = S.news.filter((e) => e.t === t).map((e) => `<div class="eu-le"><b>${esc(e.ttl)}</b><small>${esc(e.txt)}</small></div>`).join(``);
      const cs = S.caps.filter((c) => c.t === t && !c.cap && (ally(S, c.to, P) || (c.from && ally(S, c.from, P)))).map((c) => `${ally(S, c.to, P) ? `<span class="good">+</span>` : `<span class="warn">−</span>`} ${esc(reg(c.r).n)}`);
      const lg = S.log.filter((l) => l.t === t && l.n === P).map((l) => `<div class="eu-le"><small>${esc(l.txt)}</small></div>`).join(``);
      const cp = S.caps.filter((c) => c.t === t && c.cap).map((c) => `<div class="eu-le warn">${esc(NATIONS[c.cap]?.n || c.cap)} капитулирует</div>`).join(``);
      return ns || cs.length || lg || cp ? `<div class="eu-h3">${esc(dateLabel(t))}</div>${ns}${cp}${cs.length ? `<div class="eu-le"><small>Фронт: ${cs.join(`, `)}</small></div>` : ``}${lg}` : ``;
    }).join(``);
    this.modal(`<h2>${this.ic(`book`, 2)} Журнал</h2>${body || `<p class="eu-hint">Пока пусто.</p>`}<div class="eu-row"><button class="btn gold" data-a="mclose">Закрыть</button></div>`, { cls: `wide` });
  }
  // ——— меню ———
  showMenu() {
    const o = this.opt;
    this.modal(`<h2>Европа 1939–1945</h2><div class="eu-sub">${esc(dateLabel(this.S.t))} · ход ${this.S.t + 1}</div>
<div class="eu-mbtns"><button class="btn gold" data-a="mclose">Продолжить</button>
<button class="btn" data-a="log">Журнал</button>
<button class="btn" data-a="eco">Экономика</button>
<button class="btn" data-a="help">Как играть</button>
<div class="eu-tog panel ${o.anim ? `on` : ``}" data-a="animtog"><span class="eu-box">${o.anim ? `✓` : ``}</span><span><b>Показывать ходы противника</b><small>Марши и атаки ИИ на видимой части карты.</small></span></div>
<button class="btn" data-a="hub">Новая кампания</button>
<button class="btn" data-a="exit">Сохранить и выйти в меню</button></div>`);
  }
  showHelp() {
    this.modal(`<h2>Как играть</h2><div class="eu-help">
<p><b>Ход — полмесяца.</b> Вы отдаёте приказы дивизиям, затем ходят остальные державы. Кампания длится до конца 1945 года.</p>
<p><b>Дивизии.</b> В провинции — одна дивизия. Сила 1–10 (число на фишке), организация — полоска под числом. Пехота держит оборону, артиллерия бьёт на 2 провинции без ответного огня, кавалерия, мотопехота и танки ходят на 2 провинции и после прорыва могут идти дальше. Золотые нашивки — опыт, мешки с песком — окопы.</p>
<p><b>Приказы.</b> Нажмите на свою дивизию: <b class="c-move">зелёный</b> — марш, <b class="c-cap">жёлтый</b> — занять пустую вражескую провинцию, <b class="c-att">красный</b> — атака, <b class="c-bomb">оранжевый</b> — обстрел, <b class="c-amph">фиолетовый</b> — десант. Рядом с врагом марш останавливается. Марш можно отменить кнопкой ${this.ic(`undo`, 1)}, бой — нельзя. Повторное нажатие на цель атаки — тоже атака.</p>
<p><b>Бой.</b> Перед атакой видны шанс прорыва и потери. Если организация защитника падает до нуля — он отступает, а без пути отхода сдаётся. Соседние дивизии дают поддержку с флангов. Оборону усиливают леса, холмы, горы, болота, города, реки, окопы и укрепления; зимой и в распутицу наступать тяжело.</p>
<p><b>Снабжение</b> идёт от столицы, узлов и портов по своей земле. Без него дивизии теряют организацию и силу — окружайте врага и берегите фланги. Режим карты «Снабжение» показывает обстановку.</p>
<p><b>Экономика.</b> ПП, нефть и люди. Нажмите на свою пустую провинцию — сформируйте дивизию. «Пополнить» в карточке дивизии восстанавливает силу. Авиаполки дают вылеты: кнопка с самолётом.</p>
<p><b>Ж/д и море.</b> Дивизия вне боя может уехать по железной дороге в любую свою провинцию или переправиться морем между портами — число эшелонов и конвоев за ход ограничено.</p>
<p><b>Лично.</b> В ключевых сражениях (Польша 1939, Смоленск, Москва, Харьков, Ржев, Сталинград, Курск, «Багратион», Берлин) можно взять командование и сыграть тактическую битву — её итог решит исход удара.</p></div>
<div class="eu-row"><button class="btn gold" data-a="mclose">Понятно</button></div>`, { cls: `wide` });
  }
  // ——— окна, тосты, донесения ———
  modal(html, o = {}) {
    const m = this.$.modal;
    m.innerHTML = `<div class="eu-dlg panel ${o.cls || ``}">${html}</div>`;
    m.classList.remove(`hidden`);
    m.dataset.lock = o.lock ? `1` : ``;
    m.onclick = (e) => e.target === m && !o.lock && (this.sfx(`click`), this.closeModal());
  }
  closeModal(silent) {
    const m = this.$.modal, was = !m.classList.contains(`hidden`);
    m.classList.add(`hidden`);
    m.innerHTML = ``;
    const cb = this.afterModal;
    this.afterModal = null;
    was && !silent && cb && cb();
  }
  toast(msg, cls = ``) {
    const d = document.createElement(`div`);
    d.className = `eu-toast ${cls}`;
    d.textContent = msg;
    this.$.toasts.appendChild(d);
    while (this.$.toasts.children.length > 3) this.$.toasts.firstElementChild.remove();
    setTimeout(() => d.remove(), 2800);
  }
  report(ttl, txt, cls = ``) {
    const r = this.$.rep;
    r.className = `eu-rep panel ${cls}`;
    r.innerHTML = `<b>${esc(ttl)}</b><small>${esc(txt)}</small>`;
    r.onclick = () => r.classList.add(`hidden`);
    clearTimeout(this.repT);
    this.repT = setTimeout(() => r.classList.add(`hidden`), 4200);
  }
  wait(txt, turn = false) {
    const w = this.$.wait;
    if (!txt) return w.classList.add(`hidden`);
    w.className = `eu-wait panel ${turn ? `turn` : ``}`;
    w.innerHTML = `<span class="eu-spin"></span><span>${esc(txt)}</span>${turn && !this.fast ? `<button class="btn sm" data-a="fast">Быстрее</button>` : ``}`;
  }
  // ——— конец хода ———
  async endTurn() {
    const S = this.S;
    if (this.busy || !S || S.over) return;
    if (S.pending.length) return this.flow();
    const rd = this.readyS.size;
    if (rd && !this.endArm) {
      this.endArm = 1;
      clearTimeout(this.endT);
      this.endT = setTimeout(() => ((this.endArm = 0), this.renderFoot()), 3500);
      this.toast(`Ещё ${divs(rd)} без приказа — нажмите ещё раз`);
      this.sfx(`click`);
      return this.renderFoot();
    }
    this.endArm = 0;
    clearTimeout(this.endT);
    this.$.toasts.innerHTML = ``;
    this.cam0 = { cx: this.map.cx, cy: this.map.cy, z: this.map.z };
    this.panned = 0;
    this.busy = true;
    this.mode = null;
    this.closePv();
    this.closeModal(true);
    this.sel = 0;
    this.fast = !this.opt.anim;
    const t0 = S.t, ctrl0 = S.ctrl.slice();
    this.sfx(`turn`);
    this.render();
    this.wait(`Ходят другие державы…`, true);
    await raf();
    try {
      S._fx = [];
      const it = turnSteps(S);
      let last = null, tm = performance.now();
      for (;;) {
        const st = it.next();
        const fx = S._fx || [];
        S._fx = [];
        if (fx.length && !this.fast) await this.playFx(fx);
        if (st.done) break;
        last = st.value;
        if (performance.now() - tm > 40) {
          this.wait(`Ход: ${NATIONS[last]?.n || last}…`, true);
          await raf();
          tm = performance.now();
        }
      }
    } catch (e) {
      console.error(e);
      this.toast(`Ошибка хода: ${e.message}`, `warn`);
    }
    delete S._fx;
    // камера — туда, где игрок оставил карту
    this.panned && this.cam0 && this.map.flyTo(this.cam0, 420);
    this.busy = false;
    this.wait(null);
    this.undo = [];
    this.skip.clear();
    this.afterTurn(t0, ctrl0);
  }
  // ходы ИИ на видимой части карты: марши, удары, потери
  async playFx(fx) {
    const S = this.S, P = S.player, m = this.map, { l, t, r, b } = m.inset;
    const vis = (i) => {
      if (!i) return false;
      const R = reg(i), [x, y] = m.toScr(R.ax, R.ay);
      return x > l - 10 && y > t - 10 && x < m.W - r + 10 && y < m.H - b + 10;
    };
    const rel = (e) => {
      const a = e.rep ? e.rep.a : e.n, d = e.rep?.d;
      return a !== P && (atWar(S, a, P) || (!!d && (d === P || ally(S, d, P))));
    };
    const seen = (e) => vis(e.from) || vis(e.to) || vis(e.rep?.T) || vis(e.rep?.src);
    let show = fx.filter((e) => e.k !== `new` && rel(e) && seen(e));
    // удары по вам за краем экрана — камера едет к самому жаркому участку
    const hot = fx.filter((e) => e.k === `atk` && rel(e) && e.rep?.T);
    if (!show.length && hot.length && !this.fast) {
      const pts = hot.map((e) => reg(e.rep.T)), d2 = (a, b) => (a.ax - b.ax) ** 2 + (a.ay - b.ay) ** 2;
      let best = pts[0], bn = 0;
      for (const p of pts) {
        const n = pts.filter((q) => d2(p, q) < 4900).length;
        n > bn && ((bn = n), (best = p));
      }
      const list = hot.filter((e) => d2(reg(e.rep.T), best) < 4900).flatMap((e) => [e.rep.T, e.rep.src].filter(Boolean));
      m.fitRegions(list, Math.max(m.z, 1.8), 420, 30);
      this.panned = 1;
      await sleep(460);
      show = fx.filter((e) => e.k !== `new` && rel(e) && seen(e));
    }
    if (!show.length) return;
    m.refresh();
    let delay = 0, end = 0, boom = 0;
    for (const e of show.slice(0, 28)) {
      if (e.k === `mv` || e.k === `rail` || e.k === `sea`) {
        const path = e.k === `mv` && e.path?.length > 1 ? e.path : [e.from, e.to], ms = e.k === `mv` ? 150 + 140 * (path.length - 1) : 420;
        m.animMove(e.id, path, ms, delay);
        end = Math.max(end, delay + ms);
        delay += 40;
      } else if (e.k === `atk`) {
        const x = e.rep;
        m.boomAt(x.T, delay, x.win);
        x.dS && m.floatText(x.T, `−${x.dS}`, `#ff7a6a`, delay + 80);
        x.aS && m.floatText(x.src, `−${x.aS}`, `#ffb0a0`, delay + 150);
        x.out === `retreat` && x.to && m.animMove(x.du, [x.T, x.to], 280, delay + 120);
        x.adv && m.animMove(x.au, [x.src, x.T], 280, delay + 200);
        end = Math.max(end, delay + 650);
        delay += 120;
        boom++;
      } else if (e.k === `air`) {
        const x = e.rep;
        m.boomAt(x.T, delay);
        m.floatText(x.T, x.dS ? `−${x.dS}` : `орг −${x.dO}`, `#ffd27a`, delay + 60);
        end = Math.max(end, delay + 500);
        delay += 90;
        boom++;
      }
    }
    boom && this.sfx(`boom`);
    const t0 = performance.now();
    while (performance.now() - t0 < Math.min(1800, end + 80) && !this.fast) await sleep(40);
  }
  afterTurn(t0, ctrl0) {
    const S = this.S, P = S.player, mine = (n) => !!n && ally(S, n, P);
    this.map.refresh(true);
    const fl = [];
    for (let r = 1; r <= G.R.length; r++) ctrl0[r] !== S.ctrl[r] && (mine(ctrl0[r]) || mine(S.ctrl[r])) && fl.push({ r, col: mine(S.ctrl[r]) ? `rgba(120,255,140,.32)` : `rgba(255,70,50,.42)` });
    this.map.flash(fl, 3400);
    this.marks = S.bat.filter((x) => x.t === t0 && !x.air && (mine(x.a) || mine(x.d)) && x.a !== P).map((x) => ({ r: x.T, k: (mine(x.a) ? x.win : !x.win) ? `won` : `lost` }));
    this.map.setMarks(this.marks);
    this.render();
    this.save();
    if (S.over) return this.showOver();
    this.summary(t0, ctrl0);
  }
  summary(t0, ctrl0) {
    const S = this.S, P = S.player, mine = (n) => !!n && ally(S, n, P);
    // новости — только ещё не показанные
    if (S.nSeen == null || S.nSeen > S.news.length) (S.nSeen = S.news.findIndex((e) => e.t >= t0)), S.nSeen < 0 && (S.nSeen = S.news.length);
    const ns = S.news.slice(S.nSeen);
    S.nSeen = S.news.length;
    this.saveSoon();
    const lost = [], won = [];
    for (let r = 1; r <= G.R.length; r++) {
      const a = ctrl0[r], b = S.ctrl[r];
      if (a === b) continue;
      mine(a) && !mine(b) ? lost.push(r) : !mine(a) && mine(b) && won.push(r);
    }
    const hit = S.bat.filter((x) => x.t === t0 && !x.air && x.d === P && !mine(x.a)), held = hit.filter((x) => !x.win).length;
    const dead = hit.filter((x) => x.out === `destroyed` || x.out === `surrender`).length;
    const caps = S.caps.filter((c) => c.t === t0 && c.cap);
    const lg = S.log.filter((x) => x.t === t0 && x.n === P);
    const far = S.caps.filter((c) => c.t === t0 && !c.cap && !mine(c.to) && !mine(c.from) && reg(c.r).vp >= 5);
    if (!ns.length && !lost.length && !won.length && !hit.length && !caps.length && !lg.length && !far.length) {
      this.toast(dateLabel(S.t));
      return this.flow();
    }
    const nm = (rs) => rs.slice(0, 14).map((r) => esc(reg(r).n)).join(`, `) + (rs.length > 14 ? ` и ещё ${rs.length - 14}` : ``);
    this.modal(`<h2>${esc(dateLabel(S.t))}</h2><div class="eu-sub">Итоги хода ${t0 + 1} · ${esc(shortDate(t0))}</div>
${ns.map((e) => `<div class="eu-news ${e.k === `war` ? `war` : ``}"><b>${esc(e.ttl)}</b><span>${esc(e.txt)}</span></div>`).join(``)}
${caps.map((c) => `<div class="eu-news war"><b>${esc(NATIONS[c.cap]?.n || c.cap)} капитулирует</b></div>`).join(``)}
${hit.length ? `<div class="eu-sl">${this.ic(`shield`, 1)} Атак на ваши дивизии: ${hit.length}, отбито: ${held}${dead ? `, потеряно дивизий: ${dead}` : ``}</div>` : ``}
${lost.length ? `<div class="eu-sl warn">Потеряны: ${nm(lost)}</div>` : ``}
${won.length ? `<div class="eu-sl good">Заняты вами и союзниками: ${nm(won)}</div>` : ``}
${far.length ? `<div class="eu-sl">${far.map((c) => `${esc(NATIONS[c.to]?.n || c.to)} занимает ${esc(reg(c.r).n)}`).join(` · `)}</div>` : ``}
${lg.map((x) => `<div class="eu-sl">${this.ic(x.k === `tech` ? `gear` : `crate`, 1)} ${esc(x.txt.replace(/^[^:]+: /, ``))}</div>`).join(``)}
<div class="eu-row"><button class="btn gold" data-a="mclose">К карте</button></div>`, { cls: `wide` });
    this.afterModal = () => this.flow();
  }
  // события, ждущие решения игрока
  flow() {
    const S = this.S;
    if (!S) return;
    if (S.over) return this.showOver();
    if (S.pending.length) return this.showEvent(S.pending[0]);
    this.render();
  }
  showEvent(id) {
    const S = this.S, e = EV.find((x) => x.id === id);
    if (!e || !e.opts) {
      S.pending = S.pending.filter((x) => x !== id);
      return this.flow();
    }
    this.sfx(`tele`);
    this.modal(`<div class="eu-evk">${this.ic(`tele`, 1)} Решение за вами · ${esc(shortDate(S.t))}</div><h2>${esc(e.ttl)}</h2><p>${esc(e.txt)}</p>
<div class="eu-opts">${e.opts.map((o, k) => `<button class="btn ${k === 0 ? `gold` : ``}" data-a="evopt" data-id="${id}" data-k="${k}">${esc(o.l)}${k === 0 ? `<small>исторический выбор</small>` : ``}</button>`).join(``)}</div>`, { lock: true });
  }
  evOpt(id, k) {
    const S = this.S, e = EV.find((x) => x.id === id);
    resolveEvent(S, id, k);
    this.sfx(`select`);
    this.closeModal(true);
    this.map.refresh(true);
    e && this.report(e.ttl, `Решение: ${e.opts[k]?.l || ``}`);
    this.save();
    this.flow();
  }
  // ——— итог ———
  overText() {
    const S = this.S, o = S.over, P = S.player;
    if (!o) return { t: `` };
    const d = shortDate(o.t);
    return {
      t: o.k === `ger` ? `Германия капитулировала — ${d}.` : o.k === `dead` ? `${NATIONS[P].n} капитулирует — ${d}.` : o.k === `total` ? `СССР и Великобритания разгромлены — ${d}.` : `Война окончена — ${d}. Германия устояла.`,
      win: o.win,
    };
  }
  stars() {
    const S = this.S, o = S.over;
    if (!o || !o.win) return 0;
    if (S.player === `GER`) return o.k === `total` ? 3 : vpState(S, `GER`).k < 0.1 ? 2 : 1;
    return o.t <= 136 ? 3 : o.t <= 146 ? 2 : 1;
  }
  showOver() {
    const S = this.S, o = S.over, P = S.player, x = this.overText(), st = this.stars();
    if (!o) return;
    this.sel = 0;
    this.render();
    if (!this.overShown) (this.overShown = 1), this.sfx(o.win ? `win` : `lose`);
    try {
      const k = `wf_eu_best_${P}`;
      localStorage.setItem(k, String(Math.max(+(localStorage.getItem(k) || 0), st)));
    } catch {}
    const regs = G.R.filter((R) => S.ctrl[R.i] && ally(S, S.ctrl[R.i], P)).length;
    const stars = [0, 1, 2].map((q) => this.ic(q < st ? `star` : `star_off`, 4)).join(``);
    this.modal(`<h2 class="${o.win ? `good` : `warn`}">${o.win ? `Победа!` : `Поражение`}</h2><div class="eu-stars">${stars}</div>
<p>${esc(x.t)}</p>
<p class="eu-hint">История: Берлин пал 2 мая 1945 года, Германия капитулировала 8 мая. ${P === `GER` ? `Чтобы победить за Германию, нужно устоять до конца 1945 года.` : `★★★ — капитуляция Германии до мая 1945, ★★ — до осени 1945.`}</p>
<div class="eu-info"><span><small>Ход</small><b>${o.t + 1}</b></span><span><small>Провинций у вашего блока</small><b>${regs}</b></span><span><small>Ваши потери (сила)</small><b>${f0(S.nat[P].lost || 0)}</b></span><span><small>Уничтожено дивизий</small><b>${f0(S.nat[P].kills || 0)}</b></span><span><small>Сложность</small><b>${esc(DIFF[S.diff])}</b></span></div>
<div class="eu-row"><button class="btn" data-a="mclose">Карта</button><button class="btn" data-a="exit">В меню</button><button class="btn gold" data-a="hub">Новая кампания</button></div>`, { cls: `wide` });
  }
  // ——— действия ———
  act(a, b) {
    const S = this.S, d = b.dataset;
    switch (a) {
      case `opt`: return this.setOpt(d.k, d.v);
      case `start`: return this.sfx(`click`), this.askStart();
      case `start2`: return this.start();
      case `cont`: return this.cont();
      case `hubexit`: return this.sfx(`click`), this.exit();
      case `hub`: return this.sfx(`click`), this.closeModal(true), this.save(), (this.overShown = 0), this.showHub();
      case `exit`: return this.sfx(`click`), this.closeModal(true), this.exit();
      case `menu`: return this.sfx(`click`), this.showMenu();
      case `help`: return this.sfx(`click`), this.showHelp();
      case `mclose`: return this.sfx(`click`), this.closeModal();
      case `mflow`: return this.sfx(`click`), this.closeModal(true), this.flow();
      case `zin`: return this.map.zoomBy(1.35);
      case `zout`: return this.map.zoomBy(1 / 1.35);
      case `fast`: return (this.fast = true), b.remove();
    }
    if (!S) return;
    switch (a) {
      case `eco`: return this.sfx(`click`), this.showEco();
      case `air`: return this.sfx(`click`), this.showAir();
      case `tech`: return this.sfx(`click`), this.showTech();
      case `pow`: return this.sfx(`click`), this.showPow();
      case `log`: return this.sfx(`click`), this.showLog();
      case `overview`: return this.sfx(`click`), this.showOver();
      case `animtog`: return (this.opt.anim = !this.opt.anim), this.saveOpt(), this.sfx(`click`), this.showMenu();
      case `autore`: return (S.nat[S.player].autoRe = S.nat[S.player].autoRe === false), this.sfx(`click`), this.showEco(), this.saveSoon();
      case `mapmode`: {
        const m = (this.map.mode + 1) % 3;
        this.map.setMode(m);
        this.sfx(`click`);
        this.toast([`Политическая карта`, `Рельеф`, `Снабжение: зелёный — хорошее, красный — нет`][m]);
        return this.renderRail();
      }
      case `airmode`:
      case `airmode2`: {
        this.closeModal(true);
        if (this.mode?.k === `air` && a === `airmode`) return (this.mode = null), this.sfx(`click`), this.render();
        if (!(S.nat[S.player].air > 0)) return this.sfx(`error`), this.toast(S.nat[S.player].airMax ? `Вылеты на этот ход израсходованы` : `Нет авиаполков — купите в окне «Авиация»`);
        this.closePv();
        this.mode = { k: `air` };
        this.sel = 0;
        this.sfx(`click`);
        this.render();
        this.tg.size ? this.revealAny([...this.tg.keys()]) : this.toast(`Нет целей в радиусе авиации`);
        return;
      }
      case `buyair`: return buyAir(S, S.player) ? (this.sfx(`select`), this.render(), this.showAir(), this.saveSoon()) : this.sfx(`error`);
      case `next`: return this.nextReady();
      case `undo`: return this.doUndo();
      case `end`: return this.endTurn();
      case `desel`: return this.mode = null, this.select(0);
      case `skip`: {
        const u = this.selU();
        u && this.skip.add(u.id);
        this.sfx(`click`);
        this.sel = 0;
        this.render();
        return this.readyS.size && this.nextReady();
      }
      case `reinf`: return this.doReinf();
      case `rail`:
      case `sea`: {
        const u = this.selU();
        if (!u) return;
        this.mode = { k: a, id: u.id };
        this.sfx(`click`);
        this.render();
        this.tg.size && this.map.fitRegions([u.r, ...this.tg.keys()], this.map.z, 450, 10);
        return;
      }
      case `mcancel`: return (this.mode = null), this.closePv(), this.sfx(`click`), this.render();
      case `atkby`: {
        const u = this.unit(+d.id), j = this.sel, t = u && attackTargets(S, u).get(j);
        if (!t) return this.sfx(`error`);
        this.sel = u.r;
        this.updateHL();
        return this.openAtk(u, j, t.k);
      }
      case `pvno`: return this.closePv(), this.sfx(`click`), this.render();
      case `fire`: return this.fire();
      case `deep`: return this.sfx(`click`), this.askDeep();
      case `deepgo`: return this.goDeep();
      case `build`: return this.doBuild(d.t);
      case `res`: return (S.nat[S.player].res = d.k), this.sfx(`click`), this.showTech(), this.renderRail(), this.saveSoon();
      case `war`: return this.sfx(`click`), this.askWar(d.k);
      case `war2`: return this.doWar();
      case `evopt`: return this.evOpt(d.id, +d.k);
    }
  }
}
// подпись кнопки в главном меню
EuropeUI.menuLabel = () => {
  const m = EuropeUI.hasSave();
  return m && !m.over ? `${NAT_INFO[m.p]?.t || m.p} · ${shortDate(m.t)}` : `стратегия: вся война в Европе`;
};
