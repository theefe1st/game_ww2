// «Европа 1939–1945»: интерфейс стратегического режима — выбор кампании, карта, панель региона, приказы войскам,
// бой с прогнозом, производство, наука, державы и дипломатия, события, сводка хода, итог, автосохранение.
// Хост (game.js) даёт: icon(name, k) → <img>, sfx {click, select, move, boom, capture, turn, error, win, lose},
// exit() — в главное меню, deep(op, nat, diff, cb) — тактическая битва из «Мирового фронта» (cb({win, stars}) | cb(null)).
import EJ from '../data/europe.json';
import './europe.css';
import { initMap, newGame, turnSteps, save, load } from './engine.js';
import {
  G, reg, UT, LAND, MOBILE, STACK, TERR_N, TECH, ITEMS, dateLabel, shortDate, tDate, T_END, weather, supply, estimate, battle, targets, moveUnit, occupy,
  railTargets, railMove, seaTargets, seaMove, techCost, techYear, income, upkeep, itemCost, itemTime, canBuy, buy, deployRegion, vpState, totalStr,
  alive, ally, atWar, side, coop, pairKey, unitsIn, landIn, touch,
} from './rules.js';
import { NATIONS } from './regions.js';
import { EV, resolveEvent, playerWar } from './events.js';
import { EuropeMap, natRGB } from './map.js';

const KEY = `wf_eu_v1`, KEY_OPT = `wf_eu_opt`;
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
    t: `Великобритания`, s: `Одна против рейха в 1940-м: Битва за Британию, пустыня Африки, Средиземное море, «Факел», «Оверлорд».`,
    goal: `Победа — капитуляция Германии. Поражение — капитуляция Великобритании.`, hint: `Сложность: империя на морях, армия собирается годами.`,
  },
};
const VIEW = {
  1939: { SOV: `minsk kiev leningrad warsaw lwow`, GER: `berlin warsaw krakow konigsberg poznan`, UK: `london paris lille brussels` },
  1941: { SOV: `minsk kiev leningrad smolensk lwow`, GER: `minsk warsaw kiev konigsberg lwow`, UK: `tobruk alexandria benghazi matruh cairo` },
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
const KIND_N = { move: `марш`, capture: `занять`, attack: `атака`, amph: `десант`, air: `перебазирование`, rail: `по железной дороге`, sea: `морем` };
const KPRI = { attack: 5, amph: 4, capture: 3, move: 2, air: 1 };
const SIDE_N = { axis: `Ось`, allies: `Союзники`, comintern: `СССР и союзники` };
const SYM = (t, c, w = 20, h = 13) =>
  `<svg class="eu-sym" viewBox="0 0 20 13" width="${w}" height="${h}"><rect x=".5" y=".5" width="19" height="12" fill="${c}" stroke="#0b0d0f"/>` +
  (t === `inf` || t === `mot` ? `<path d="M1 1L19 12M19 1L1 12" stroke="#15130e" stroke-width="1.3"/>` : ``) +
  (t === `arm` || t === `mot` ? `<rect x="4.5" y="3.5" width="11" height="6" rx="3" fill="none" stroke="#15130e" stroke-width="1.3"/>` : ``) +
  (t === `air` ? `<path d="M3 6.5h14M10 2.5v8M7 10.5h6" stroke="#15130e" stroke-width="1.4"/>` : ``) +
  `</svg>`;
const FLAG = (n, s = 14) => `<span class="eu-flag" style="width:${s}px;height:${Math.round(s * 0.72)}px;background:${rgb(natRGB(n))}"></span>`;

export class EuropeUI {
  constructor(root, host = {}) {
    this.root = root;
    this.host = host;
    this.S = null;
    this.sel = 0;
    this.pick = new Set();
    this.mode = null;
    this.undo = [];
    this.busy = false;
    this.opt = { start: 1939, nat: `SOV`, diff: host.diff ?? 1, hist: true, ...this.loadOpt() };
    initMap(EJ);
    root.innerHTML = `<canvas class="eu-cv"></canvas>
<div class="eu-top"></div>
<div class="eu-rail"></div>
<div class="eu-zoom"><button class="btn icon" data-a="zin" aria-label="Приблизить">+</button><button class="btn icon" data-a="zout" aria-label="Отдалить">−</button></div>
<div class="eu-sheet panel"></div>
<div class="eu-rep hidden"></div>
<div class="eu-toasts"></div>
<div class="eu-wait panel hidden"></div>
<div class="eu-hub hidden"></div>
<div class="eu-modal hidden"></div>`;
    this.$ = {};
    for (const k of [`top`, `rail`, `zoom`, `sheet`, `rep`, `toasts`, `wait`, `hub`, `modal`]) this.$[k] = root.querySelector(`.eu-${k}`);
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
      return m && m.v === 1 && localStorage.getItem(KEY) ? m : null;
    } catch {
      return null;
    }
  }
  save() {
    const S = this.S;
    if (!S || !S.player) return;
    try {
      localStorage.setItem(KEY, save(S));
      localStorage.setItem(`${KEY}_meta`, JSON.stringify({ v: 1, p: S.player, t: S.t, d: S.diff, over: !!S.over, at: Date.now() }));
    } catch {}
  }
  saveSoon() {
    clearTimeout(this.svT);
    this.svT = setTimeout(() => this.save(), 500);
  }
  loadGame() {
    try {
      const s = localStorage.getItem(KEY);
      if (!s) return null;
      const S = load(s);
      return S && S.nat && S.player ? S : null;
    } catch {
      return null;
    }
  }
  wipe() {
    try {
      localStorage.removeItem(KEY), localStorage.removeItem(`${KEY}_meta`);
    } catch {}
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
      this.hubBack ? this.hubBack() : this.exit();
      return true;
    }
    if (this.busy) return true;
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
      this.map.setState(bg);
      this.map.fit([90, 40, 800, 640], 2);
    }
    this.root.classList.add(`hubmode`);
    this.$.hub.classList.remove(`hidden`);
    this.closeModal(true);
    this.hubBack = null;
    const cont = m && !m.over
      ? `<button class="btn gold eu-cont" data-a="cont">Продолжить<small>${esc(NAT_INFO[m.p]?.t || m.p)} · ${esc(shortDate(m.t))} · ход ${m.t + 1} · ${esc(DIFF[m.d] || ``).toLowerCase()}</small></button>`
      : ``;
    this.$.hub.innerHTML = `<div class="eu-hubin">
<div class="logo sm">ЕВРОПА <br>1939–1945</div>
<div class="tagline">Стратегическая кампания · вся война в Европе · ход — полмесяца</div>
${cont}
<div class="eu-h3">Начало</div>
<div class="seg eu-seg"><button class="btn ${o.start === 1939 ? `on` : ``}" data-a="opt" data-k="start" data-v="1939">1 сентября 1939</button><button class="btn ${o.start === 1941 ? `on` : ``}" data-a="opt" data-k="start" data-v="1941">22 июня 1941</button></div>
<div class="eu-h3">Держава</div>
<div class="eu-nats">${[`SOV`, `GER`, `UK`].map((n) => `<div class="eu-nat panel ${o.nat === n ? `sel` : ``}" data-a="opt" data-k="nat" data-v="${n}"><div class="eu-nh">${FLAG(n, 22)}<b>${NAT_INFO[n].t}</b></div><p>${esc(NAT_INFO[n].s)}</p><small>${esc(NAT_INFO[n].hint)}</small></div>`).join(``)}</div>
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
    this.sel = 0;
    this.pick.clear();
    this.mode = null;
    this.marks = [];
    this.root.classList.remove(`hubmode`);
    this.$.hub.classList.add(`hidden`);
    this.ensureMap();
    this.map.setState(S);
    this.map.setMarks([]);
    this.map.flash(null);
    this.render();
    const keys = (VIEW[S.start === 1941 && S.t < 56 ? 1941 : 1939][S.player] || `berlin`).split(` `).map((k) => G.byKey[k]?.i).filter(Boolean);
    this.map.fitRegions(keys, 2.6);
    this.save();
    if (S.deepPend) {
      // приложение закрывали во время тактической битвы — удар решается обычным боем
      const p = S.deepPend;
      this.deepDone(null, p);
      return;
    }
    if (fresh) this.intro();
    else this.flow();
  }
  intro() {
    const S = this.S, P = S.player, I = NAT_INFO[P];
    const t41 = S.start === 1941;
    const txt = {
      SOV: t41 ? `Разведка доносит: у границы сосредоточены десятки немецких дивизий. До удара — считанные дни. Укрепите приграничные округа, держите резервы у Смоленска и Киева.` : `1 сентября 1939 года Германия напала на Польшу. Пакт о ненападении развязал вам руки на западе — но вермахт уже у ворот.`,
      GER: t41 ? `Польша, Франция и Балканы разгромлены. На востоке ждут 150 дивизий — и решение о «Барбароссе» за вами.` : `1 сентября 1939 года. Группы армий «Север» и «Юг» перешли польскую границу. Англия и Франция объявят войну через два дня.`,
      UK: t41 ? `Британия держится. В пустыне Роммель рвётся к Египту, на востоке Германия готовит удар по СССР — у вас появится союзник.` : `Германия напала на Польшу. 3 сентября Британия объявляет войну. Экспедиционный корпус отправляется во Францию.`,
    }[P];
    this.modal(`<h2>${esc(dateLabel(S.t))}</h2><div class="eu-sub">${FLAG(P, 18)} ${esc(I.t)} · ${esc(DIFF[S.diff])} · ${S.histOn ? `исторический ИИ` : `свободная война`}</div>
<p>${esc(txt)}</p><p class="eu-goal">${esc(I.goal)}</p>
<div class="eu-tips"><div>${this.ic(`dot`, 2)} Нажмите на регион со своими армиями — на карте подсветятся цели: <b class="c-move">зелёный</b> — марш, <b class="c-cap">жёлтый</b> — занять, <b class="c-att">красный</b> — атака.</div>
<div>${this.ic(`dot`, 2)} Без снабжения армии тают. Погода, реки, горы и укрепления усиливают оборону.</div>
<div>${this.ic(`dot`, 2)} Промышленность строит армии и пополняет потери, наука улучшает войска.</div></div>
<div class="eu-row"><button class="btn gold" data-a="mflow">К карте</button></div>`);
  }
  // ——— раскладка ———
  layout() {
    if (!this.map) return;
    const rr = this.root.getBoundingClientRect(), W = rr.width, H = rr.height, land = W > H * 1.05;
    this.root.classList.toggle(`land`, land);
    this.root.classList.toggle(`port`, !land);
    if (this.root.classList.contains(`hubmode`)) return this.map.setInset(0, 0, 0, 0);
    const top = this.$.top.getBoundingClientRect(), sh = this.$.sheet.getBoundingClientRect();
    const t = Math.max(0, top.bottom - rr.top) + 4;
    if (land) this.map.setInset(0, t, Math.max(0, rr.right - sh.left) + 4, 0);
    else this.map.setInset(0, t, 0, Math.max(0, rr.bottom - sh.top) + 4);
  }
  render() {
    const S = this.S;
    if (!S) return;
    this.uix = new Map(S.units.map((u) => [u.id, u]));
    this.renderTop();
    this.renderRail();
    this.renderSheet();
    this.updateHL();
    this.layout();
  }
  unit(id) {
    return (this.uix && this.uix.get(id)) || this.S.units.find((u) => u.id === id) || null;
  }
  inc() {
    const S = this.S, P = S.player, k = `${S.t}|${S._ver}`;
    if (this.incK !== k) (this.incK = k), (this.incV = income(S, P)), (this.upV = upkeep(S, P));
    return this.incV;
  }
  renderTop() {
    const S = this.S, P = S.player, nat = S.nat[P], inc = this.inc(), cap = G.R.find((R) => R.cap && R.own === P) || G.R[0];
    const wx = weather(S, cap, P);
    const res = [
      [`pp`, `Промышленность (ПП)`, nat.pp, inc.pp],
      [`oil`, `Нефть`, nat.oil, inc.oil - this.upV],
      [`st`, `Сталь`, nat.st, inc.st],
      [`mp`, `Людские резервы`, nat.mp, inc.mp],
    ];
    this.$.top.innerHTML = `<div class="eu-chip panel eu-who">${FLAG(P, 18)}<span><b>${esc(NAT_INFO[P]?.t || NATIONS[P].n)}</b><small>${esc(DIFF[S.diff])}</small></span></div>
<button class="eu-chip panel eu-date" data-a="log">${FLAG(P, 16)}<span><b>${esc(dateLabel(S.t))}</b><small>ход ${S.t + 1} · ${this.ic(WX_ICON[wx.k] || `sun`, 1)} ${esc(wx.n)}</small></span></button>
<button class="eu-res panel" data-a="prod">${res.map(([k, n, v, d]) => `<span class="eu-r" title="${n}"><i class="r-${k}"></i><b class="${v < 0 ? `warn` : ``}">${f0(v)}</b><small class="${d < 0 ? `warn` : ``}">${sgn(d)}</small></span>`).join(``)}</button>
<div class="grow"></div>
<button class="btn icon" data-a="menu" aria-label="Меню">${this.ic(`menu`, 2)}</button>`;
  }
  ready() {
    const S = this.S, P = S.player;
    return S.units.filter((u) => u.n === P && u.mv > 0 && LAND(u) && !(u.at && !MOBILE(u)));
  }
  renderRail() {
    const S = this.S, nat = S.nat[S.player], rd = this.ready().length;
    this.$.rail.innerHTML = `<button class="btn icon" data-a="prod" aria-label="Производство">${this.ic(`crate`, 2)}${nat.q.length ? `<span class="eu-badge">${nat.q.length}</span>` : ``}</button>
<button class="btn icon" data-a="tech" aria-label="Наука">${this.ic(`gear`, 2)}${!nat.res ? `<span class="eu-badge warn">!</span>` : ``}</button>
<button class="btn icon" data-a="pow" aria-label="Державы">${this.ic(`order`, 2)}</button>
<button class="btn icon" data-a="log" aria-label="Журнал">${this.ic(`book`, 2)}</button>
<button class="btn icon ${this.map.mode ? `on` : ``}" data-a="mapmode" aria-label="Режим карты">${this.ic(this.map.mode === 2 ? `truck` : `fmap`, 2)}</button>
<button class="btn icon" data-a="next" aria-label="Следующая армия">${this.ic(`next`, 2)}${rd ? `<span class="eu-badge">${rd}</span>` : ``}</button>
<button class="btn icon" data-a="undo" aria-label="Отменить" ${this.undo.length ? `` : `disabled`}>${this.ic(`undo`, 2)}</button>`;
  }
  // ——— панель региона ———
  unitRow(u, o = {}) {
    const S = this.S, P = S.player, U = UT[u.t], mine = u.n === P, on = this.pick.has(u.id), col = rgb(natRGB(u.n), 1.12);
    const mvMax = Math.max(1, LAND(u) ? U.mv : 1), mv = Math.max(0, Math.min(mvMax, u.mv)), spent = mine && u.mv <= 0;
    const tags = [];
    !mine && tags.push(NATIONS[u.n].n);
    tags.push(U.sh);
    u.oos > 0 && tags.push(`<span class="warn">нет снабжения</span>`);
    u.ent > 0 && LAND(u) && tags.push(`окоп ${u.ent}`);
    u.x >= 30 && tags.push(`опыт ${Math.round(u.x)}`);
    const rail = o.acts && mine && railTargets(S, u).length, sea = o.acts && mine && seaTargets(S, u).length;
    return `<div class="eu-u ${mine ? `mine` : ``} ${on ? `on` : ``} ${spent ? `spent` : ``}" ${mine && o.acts ? `data-a="pick" data-id="${u.id}"` : ``}>
<span class="eu-ck">${mine && o.acts ? (on ? `✓` : ``) : ``}</span>${SYM(u.t, col)}
<span class="eu-un"><b>${esc(u.nm)}</b><small>${tags.join(` · `)}</small></span>
<span class="eu-st"><span class="eu-bar"><i style="width:${Math.min(100, (u.s / U.max) * 100)}%"></i></span><small>${f1(u.s)}/${U.max}</small></span>
<span class="eu-st org"><span class="eu-bar o"><i style="width:${Math.max(0, Math.min(100, u.o))}%"></i></span><small>орг. ${Math.round(u.o)}</small></span>
${mine ? `<span class="eu-mv" title="Ходы">${LAND(u) ? `●`.repeat(mv) + `○`.repeat(mvMax - mv) : u.mv > 0 ? `●` : `○`}</span>` : ``}
${rail || sea ? `<span class="eu-ubs">${rail ? `<button class="btn sm eu-ub" data-a="rail" data-id="${u.id}">Ж/Д</button>` : ``}${sea ? `<button class="btn sm eu-ub" data-a="sea" data-id="${u.id}">Море</button>` : ``}</span>` : ``}
</div>`;
  }
  regionInfo(i) {
    const S = this.S, P = S.player, R = reg(i), c = S.ctrl[i], core = S.core[i], wx = weather(S, R, P);
    const items = [[`Местность`, TERR_N[R.t] + (R.city ? `, город` : ``)], [`Погода`, `${this.ic(WX_ICON[wx.k] || `sun`, 1)} ${esc(wx.n)}`]];
    R.vp && items.push([`Очки победы`, `${R.vp}`]);
    const ic = R.ic + (S.icAdd[i] || 0);
    const rs = [ic ? `пром. ${f1(ic)}` : ``, R.oil ? `нефть ${R.oil}` : ``, R.st ? `сталь ${R.st}` : ``, R.co ? `уголь ${R.co}` : ``].filter(Boolean);
    rs.length && items.push([`Ресурсы`, rs.join(`, `)]);
    S.fort[i] && items.push([`Укрепления`, `уровень ${S.fort[i]}${S.fortN[i] && S.fortN[i] !== c ? ` (${NATIONS[S.fortN[i]].a})` : ``}`]);
    if (c && ally(S, c, P)) {
      const s = supply(S, P)[i];
      items.push([`Снабжение`, s < 0 ? `<span class="warn">нет — войска слабеют</span>` : s <= 4 ? `хорошее` : s <= 8 ? `среднее` : s <= 12 ? `слабое` : `очень слабое`]);
    }
    return `<div class="eu-info">${items.map(([a, b]) => `<span><small>${a}</small><b>${b}</b></span>`).join(``)}</div>`;
  }
  renderSheet() {
    const S = this.S, P = S.player, i = this.sel, el = this.$.sheet;
    const over = !!S.over;
    let head = ``, body = ``, hint = ``;
    if (this.mode) {
      const u = this.mode.u, k = this.mode.k, n = this.tg?.size || 0;
      head = `<div class="eu-sh-h"><span class="eu-ttl">${k === `rail` ? `${this.ic(`truck`, 2)} Переброска по железной дороге` : `Переброска морем`}</span></div>`;
      body = `<div class="eu-ul">${this.unitRow(u)}</div><p class="eu-hint">${n ? `Выберите регион на карте — подсвечено ${n}.` : `Нет доступных регионов.`} ${k === `rail` ? `Осталось эшелонов: ${S.nat[P].rail}.` : `Осталось конвоев: ${S.nat[P].navl}.`} Армия потратит весь ход.</p><div class="eu-acts"><button class="btn sm" data-a="mcancel">Отмена</button></div>`;
    } else if (!i) {
      const rd = this.ready(), wars = Object.keys(S.nat).filter((n) => alive(S, n) && atWar(S, n, P) && S.units.some((u) => u.n === n));
      head = `<div class="eu-sh-h"><span class="eu-ttl">${over ? `Кампания окончена` : `Ход ${S.t + 1}: ${esc(shortDate(S.t))}`}</span></div>`;
      body = over
        ? `<p class="eu-hint">${esc(this.overText().t)}</p><div class="eu-acts"><button class="btn sm gold" data-a="overview">Итоги</button><button class="btn sm" data-a="hub">Новая кампания</button></div>`
        : `<p class="eu-hint">${rd.length ? `Готовы к приказу: ${rd.length} ${plural(rd.length, `армия`, `армии`, `армий`)} — <a data-a="next">к следующей</a>.` : `Все армии получили приказы.`} ${wars.length ? `Война: ${wars.map((n) => NATIONS[n].n).join(`, `)}.` : `Вы пока не воюете.`}</p>`;
      hint = over ? `` : `Нажмите на регион`;
    } else {
      const R = reg(i), c = S.ctrl[i], us = unitsIn(S, i), mine = us.filter((u) => u.n === P), others = us.filter((u) => u.n !== P);
      const enemy = c && atWar(S, c, P);
      const att = enemy && landIn(S, i).length ? this.attackers(i).length : 0;
      head = `<div class="eu-sh-h"><span class="eu-ttl">${R.cap ? this.ic(`star`, 1) : ``}${esc(R.n)}</span><span class="eu-own">${c ? `${FLAG(c)} ${esc(NATIONS[c].n)}` : ``}${S.core[i] && S.core[i] !== c ? ` <small>· земля ${esc(NATIONS[S.core[i]].a)}</small>` : ``}${enemy ? ` <b class="warn">враг</b>` : ``}</span><button class="btn sm eu-x" data-a="desel" aria-label="Закрыть">${this.ic(`cross`, 2)}</button></div>`;
      body = this.regionInfo(i);
      if (mine.length) {
        const ready = mine.filter((u) => u.mv > 0);
        body += `<div class="eu-h3">Ваши войска · ${mine.length}${ready.length ? ` · готовы ${ready.length}` : ``}</div><div class="eu-ul">${mine.map((u) => this.unitRow(u, { acts: !over })).join(``)}</div>`;
        !over && ready.length && (body += `<div class="eu-acts"><button class="btn sm" data-a="pickall">Выбрать всех</button><button class="btn sm" data-a="picknone">Снять выбор</button></div>`);
      }
      others.length && (body += `<div class="eu-h3">${enemy ? `Противник` : `Войска`} · ${others.length}</div><div class="eu-ul">${others.map((u) => this.unitRow(u)).join(``)}</div>`);
      !us.length && (body += `<p class="eu-hint">${enemy ? `Войск нет — регион можно занять маршем.` : `Войск нет.`}</p>`);
      if (!over && enemy && att) body += `<div class="eu-acts"><button class="btn sm gold" data-a="attack" data-r="${i}">${this.ic(`sword`, 1)} Атаковать · ${att} ${plural(att, `армия`, `армии`, `армий`)} рядом</button></div>`;
      const n = this.tg?.size || 0;
      hint = over ? `` : this.pick.size ? (n ? `Выберите цель на карте` : `Нет доступных целей`) : mine.length ? `Отметьте армии` : ``;
    }
    const foot = over
      ? `<div class="eu-foot"><span class="eu-fh">${esc(hint)}</span><button class="btn gold eu-end" data-a="overview">Итоги войны</button></div>`
      : `<div class="eu-foot"><span class="eu-fh">${esc(hint)}</span><button class="btn gold eu-end" data-a="end" ${this.busy ? `disabled` : ``}>${S.pending.length ? `Решение ждёт` : `Конец хода`}</button></div>`;
    el.innerHTML = `${head}<div class="eu-sh-b">${body}</div>${foot}`;
    el.classList.toggle(`empty`, !i && !this.mode);
  }
  // ——— цели и подсветка ———
  attackers(j) {
    const S = this.S, P = S.player, out = [];
    for (const u of S.units) {
      if (u.n !== P || !LAND(u) || u.mv <= 0) continue;
      const t = targets(S, u).find((x) => x.r === j && (x.k === `attack` || x.k === `amph`));
      t && out.push({ u, src: u.r, amph: t.k === `amph` });
    }
    return out;
  }
  computeTargets() {
    const S = this.S, m = new Map();
    if (!S || S.over) return m;
    if (this.mode) {
      const list = this.mode.k === `rail` ? railTargets(S, this.mode.u) : seaTargets(S, this.mode.u);
      for (const j of list) m.set(j, this.mode.k);
      return m;
    }
    for (const id of this.pick) {
      const u = this.unit(id);
      if (!u || u.r !== this.sel) continue;
      for (const t of targets(S, u)) {
        const k0 = m.get(t.r);
        (!k0 || KPRI[t.k] > KPRI[k0]) && m.set(t.r, t.k);
      }
    }
    return m;
  }
  updateHL() {
    this.tg = this.computeTargets();
    this.map?.setHL(this.tg, this.sel);
    // подсказка в подвале зависит от целей
    const fh = this.$.sheet.querySelector(`.eu-fh`);
    if (fh && this.sel && !this.mode && !this.S.over) fh.textContent = this.pick.size ? (this.tg.size ? `Выберите цель на карте` : `Нет доступных целей`) : unitsIn(this.S, this.sel).some((u) => u.n === this.S.player) ? `Отметьте армии` : ``;
  }
  // ——— ввод на карте ———
  tap(r) {
    if (this.busy || !this.S || !this.$.modal.classList.contains(`hidden`)) return;
    const k = this.tg?.get(r);
    if (r && k && !this.S.over) return this.order(r, k);
    if (this.mode) {
      this.mode = null;
      this.sfx(`click`);
      return this.render();
    }
    if (!r || r === this.sel) return this.select(0);
    this.select(r);
  }
  select(r, ids) {
    const S = this.S;
    this.sel = r || 0;
    this.pick.clear();
    if (r) for (const u of unitsIn(S, r)) u.n === S.player && u.mv > 0 && (!ids || ids.includes(u.id)) && this.pick.add(u.id);
    this.sfx(`click`);
    this.render();
  }
  pushUndo() {
    this.undo.push(save(this.S));
    this.undo.length > 12 && this.undo.shift();
  }
  doUndo() {
    const s = this.undo.pop();
    if (!s) return;
    const sel = this.sel;
    this.S = load(s);
    this.S.deep = this.S.deep || {};
    this.mode = null;
    this.map.setState(this.S);
    this.map.setMarks(this.marks);
    this.sfx(`click`);
    this.sel = sel;
    this.select(sel);
    this.saveSoon();
  }
  order(j, k) {
    const S = this.S;
    if (k === `rail` || k === `sea`) {
      const u = this.mode.u;
      this.pushUndo();
      k === `rail` ? railMove(S, u, j) : seaMove(S, u, j);
      this.mode = null;
      this.sfx(`move`);
      return this.after(j, []);
    }
    if (k === `attack` || k === `amph`) return this.openBattle(j);
    const us = [...this.pick].map((id) => this.unit(id)).filter((u) => u && u.r === this.sel && u.mv > 0);
    if (!us.length) return;
    this.pushUndo();
    const moved = [];
    const step = (u) => {
      const t = targets(S, u).find((x) => x.r === j && (x.k === `move` || x.k === `air`));
      if (!t || (LAND(u) && landIn(S, j).length >= STACK)) return;
      moveUnit(S, u, j, t.cost);
      moved.push(u);
    };
    if (k === `capture`) {
      const cap = us.map((u) => ({ u, t: targets(S, u).find((x) => x.r === j && x.k === `capture`) })).filter((x) => x.t).sort((a, b) => (MOBILE(b.u) ? 1 : 0) - (MOBILE(a.u) ? 1 : 0) || a.t.cost - b.t.cost);
      if (!cap.length) return this.undo.pop();
      occupy(S, cap[0].u, j, cap[0].t.cost);
      moved.push(cap[0].u);
      for (const u of us) u !== cap[0].u && step(u);
      this.sfx(`capture`);
      this.map.refresh();
      this.toast(`${reg(j).n} — занят`);
    } else {
      for (const u of us) step(u);
      if (!moved.length) {
        this.undo.pop();
        this.sfx(`error`);
        return this.toast(`Нет места: в регионе не больше ${STACK} армий`);
      }
      this.sfx(`move`);
    }
    this.after(j, moved.filter((u) => u.mv > 0).map((u) => u.id));
  }
  after(j, ids) {
    const S = this.S;
    this.sel = j;
    this.pick = new Set(ids.filter((id) => this.unit(id)?.r === j));
    touch(S);
    this.map.invalidate();
    this.render();
    this.saveSoon();
  }
  nextReady() {
    const S = this.S, rd = this.ready();
    if (!rd.length) return this.toast(`Все армии получили приказы`);
    const regs = [...new Set(rd.map((u) => u.r))];
    // сначала — у линии фронта
    const front = (i) => (reg(i).nb.some((j) => S.ctrl[j] && atWar(S, S.ctrl[j], S.player)) ? 0 : 1);
    regs.sort((a, b) => front(a) - front(b) || reg(a).ax - reg(b).ax);
    const k = regs.indexOf(this.sel);
    const r = regs[(k + 1) % regs.length];
    this.select(r);
    this.map.reveal(r);
  }
  // ——— бой ———
  openBattle(j) {
    const cands = this.attackers(j);
    if (!cands.length) return this.sfx(`error`), this.toast(`Рядом нет армий, способных атаковать`);
    const S = this.S, T = reg(j);
    let on = cands.filter((c) => this.pick.has(c.u.id)).map((c) => c.u.id);
    if (!on.length) on = cands.slice().sort((a, b) => b.u.s * UT[b.u.t].atk * b.u.o - a.u.s * UT[a.u.t].atk * a.u.o).map((c) => c.u.id);
    on = on.slice(0, STACK);
    // нельзя атаковать «с налёту» тем, кто через реку, если есть кто-то ещё — оставляем выбор игроку
    this.bt = { j, cands, on: new Set(on) };
    void S, void T;
    this.renderBattle();
  }
  renderBattle() {
    const { j, cands, on } = this.bt, S = this.S, P = S.player, T = reg(j), c = S.ctrl[j];
    const att = cands.filter((x) => on.has(x.u.id));
    const E = att.length ? estimate(S, att, j) : null, r = E ? E.r : 0;
    const ch = E ? Math.max(0, Math.min(1, (1.18 - 1.15 / Math.max(0.01, r)) / 0.36)) : 0;
    const defs = landIn(S, j), sA = att.reduce((s, x) => s + x.u.s, 0), sD = defs.reduce((s, u) => s + u.s, 0);
    const lA = sA * Math.min(0.35, Math.max(0.03, 0.15 / Math.pow(Math.max(0.2, r), 0.8))), lD = sD * Math.min(0.45, Math.max(0.05, 0.06 + 0.085 * Math.min(r, 4)));
    const wx = weather(S, T, P), deep = this.deepFor(j);
    const verdict = !E ? `` : ch >= 0.95 ? `Решающий перевес` : ch >= 0.6 ? `Перевес на вашей стороне` : ch >= 0.3 ? `Исход неясен` : ch > 0 ? `Шансы невелики` : `Атака обречена`;
    const row = (x) => `<div class="eu-u sm ${on.has(x.u.id) ? `on` : ``}" data-a="btog" data-id="${x.u.id}"><span class="eu-ck">${on.has(x.u.id) ? `✓` : ``}</span>${SYM(x.u.t, rgb(natRGB(x.u.n), 1.12))}<span class="eu-un"><b>${esc(x.u.nm)}</b><small>из: ${esc(reg(x.src).n)}${T.riv.has(x.src) ? ` · <span class="warn">через реку −25 %</span>` : ``}${x.amph ? ` · <span class="warn">десант −50 %</span>` : ``}</small></span><span class="eu-st"><span class="eu-bar"><i style="width:${(x.u.s / UT[x.u.t].max) * 100}%"></i></span><small>${f1(x.u.s)}</small></span><span class="eu-st org"><span class="eu-bar o"><i style="width:${x.u.o}%"></i></span><small>орг. ${Math.round(x.u.o)}</small></span></div>`;
    this.modal(`<h2>${this.ic(`sword`, 2)} Наступление: ${esc(T.n)}</h2>
<div class="eu-sub">${c ? `${FLAG(c)} ${esc(NATIONS[c].n)} · ` : ``}${esc(TERR_N[T.t])}${T.city ? ` · город` : ``} · ${this.ic(WX_ICON[wx.k] || `sun`, 1)} ${esc(wx.n)}${S.fort[j] ? ` · укрепления ур. ${S.fort[j]}` : ``}</div>
<div class="eu-h3">Оборона · ${defs.length}</div><div class="eu-ul">${defs.map((u) => this.unitRow(u)).join(``) || `<p class="eu-hint">Войск нет</p>`}</div>
<div class="eu-h3">Атакуют · ${att.length} из ${cands.length}${cands.length > STACK ? ` (не больше ${STACK})` : ``}</div><div class="eu-ul">${cands.map(row).join(``)}</div>
${E ? `<div class="eu-odds panel"><div class="eu-vs"><span>${f1(E.A)}</span><span class="eu-bar2"><i style="width:${(E.A / (E.A + E.D)) * 100}%"></i></span><span>${f1(E.D)}</span></div>
<div><b class="${ch >= 0.6 ? `good` : ch >= 0.3 ? `` : `warn`}">${verdict}: шанс ≈ ${Math.round(ch * 100)} %</b> · соотношение ${f1(r)} (нужно ≥ 1,15)</div>
<div class="eu-hint">Авиация в радиусе: ваша ${f1(E.pa)}, противника ${f1(E.pd)} · ожидаемые потери: ваши ≈ ${f1(lA)}, противника ≈ ${f1(lD)}</div></div>` : `<p class="eu-hint">Отметьте атакующие армии.</p>`}
${deep ? `<div class="eu-deep panel">${this.ic(`star`, 2)}<span><b>Командовать лично: «${esc(deep.n)}»</b><small>Тактическая битва «Мирового фронта» решит исход удара: ★★★ — разгром обороны, ★★ — серьёзный перевес, ★ — обычный бой, поражение — атака отбита.</small></span></div>` : ``}
<div class="eu-row"><button class="btn" data-a="mclose">Отмена</button>${deep ? `<button class="btn" data-a="deep" ${att.length ? `` : `disabled`}>Лично</button>` : ``}<button class="btn gold" data-a="fight" ${att.length ? `` : `disabled`}>Атаковать</button></div>`, { cls: `wide` });
  }
  btog(id) {
    const on = this.bt.on;
    if (on.has(id)) on.delete(id);
    else if (on.size >= STACK) return this.sfx(`error`), this.toast(`Не больше ${STACK} армий в одном ударе`);
    else on.add(id);
    this.sfx(`click`);
    const sc = this.$.modal.querySelector(`.eu-dlg`)?.scrollTop || 0;
    this.renderBattle();
    const d = this.$.modal.querySelector(`.eu-dlg`);
    d && (d.scrollTop = sc);
  }
  fight(mod, note) {
    const { j, cands, on } = this.bt, S = this.S, T = reg(j);
    const att = cands.filter((x) => on.has(x.u.id) && S.units.includes(x.u));
    if (!att.length) return;
    const dn = S.ctrl[j];
    const rep = battle(S, att, j, mod ? { mod, deep: 1 } : {});
    this.undo = [];
    this.closeModal(true);
    this.sfx(rep.win ? `capture` : `boom`);
    this.marks.push({ r: j, k: rep.win ? `won` : `lost` });
    this.map.setMarks(this.marks);
    this.map.refresh();
    const loss = `Потери: ваши −${f1(rep.lostA)}, ${NATIONS[dn]?.a || `противника`} −${f1(rep.lostD)}${rep.killed ? ` · уничтожено соединений: ${rep.killed}` : ``}`;
    this.report(rep.win ? `Победа: ${T.n} взят` : `Атака на ${T.n} отбита`, (note ? note + ` ` : ``) + loss, rep.win ? `good` : `warn`);
    if (rep.win) this.after(j, att.map((x) => x.u).filter((u) => S.units.includes(u) && u.mv > 0).map((u) => u.id));
    else this.select(this.sel && unitsIn(S, this.sel).some((u) => u.n === S.player) ? this.sel : att[0] && S.units.includes(att[0].u) ? att[0].u.r : 0);
    this.saveSoon();
  }
  // ——— тактическая битва «Мирового фронта» ———
  deepFor(j) {
    const S = this.S;
    if (!this.host.deep || !S) return null;
    const k = reg(j).k, c = S.ctrl[j];
    return DEEP.find((d) => d.nat === S.player && S.t >= d.t0 && S.t <= d.t1 && d.keys.split(` `).includes(k) && !(d.op in (S.deep || {})) && (d.foe ? c === d.foe : c === `GER` || (c && side(S, c) === `axis`))) || null;
  }
  askDeep() {
    const d = this.deepFor(this.bt.j);
    if (!d) return;
    this.deepAsk = d;
    this.modal(`<h2>${this.ic(`star`, 2)} ${esc(d.n)}</h2><p>Вы примете командование в тактической битве «Мирового фронта». Это займёт 20–40 минут. Кампания «Европа» сохранится — после битвы вы вернётесь к этой карте, а итог решит исход удара на ${esc(reg(this.bt.j).n)}.</p>
<p class="eu-hint">★★★ — оборона разгромлена (−30 % сил, дезорганизация) · ★★ — перевес · ★ — обычный бой · поражение — наступление захлебнулось. Выйти из битвы в меню — передать командование штабу (обычный бой).</p>
<div class="eu-row"><button class="btn" data-a="deepno">Назад</button><button class="btn gold" data-a="deepgo">В бой!</button></div>`);
  }
  goDeep() {
    const d = this.deepAsk, S = this.S;
    if (!d || !this.bt) return;
    S.deep = S.deep || {};
    S.deep[d.op] = -1;
    S.deepPend = { j: this.bt.j, ids: [...this.bt.on], op: d.op };
    this.undo = [];
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
    const att = p.ids.map((id) => S.units.find((u) => u.id === id)).filter((u) => u && u.n === S.player && u.mv > 0).map((u) => {
      const t = targets(S, u).find((x) => x.r === p.j && (x.k === `attack` || x.k === `amph`));
      return t ? { u, src: u.r, amph: t.k === `amph` } : null;
    }).filter(Boolean);
    this.render();
    if (!att.length || !landIn(S, p.j).length) return this.toast(`Удар отменён: обстановка изменилась`), this.save();
    this.bt = { j: p.j, cands: att, on: new Set(att.slice(0, STACK).map((x) => x.u.id)) };
    const T = reg(p.j);
    if (!res) return this.fight(null, `Командование передано штабу фронта.`);
    if (!res.win) {
      for (const x of att) (x.u.s *= 0.75), (x.u.o = Math.min(x.u.o, 25)), (x.u.at = 1), (x.u.mv = 0);
      touch(S);
      this.sfx(`boom`);
      this.marks.push({ r: p.j, k: `lost` });
      this.map.setMarks(this.marks);
      this.map.invalidate();
      this.report(`Наступление на ${T.n} захлебнулось`, `Тактическое поражение: атакующие армии понесли тяжёлые потери.`, `warn`);
      this.render();
      return this.save();
    }
    const st = res.stars || 1;
    for (const u of landIn(S, p.j)) st >= 3 ? ((u.s *= 0.7), (u.o *= 0.5)) : st === 2 && (u.o *= 0.7);
    this.fight({ r: st >= 3 ? 1.5 : st === 2 ? 1.25 : 1.1 }, `Тактическая победа ${`★`.repeat(st)}.`);
  }
  // ——— производство ———
  showProd() {
    const S = this.S, P = S.player, nat = S.nat[P], inc = this.inc(), i = this.sel;
    const own = i && S.ctrl[i] === P, dep = deployRegion(S, P, own ? i : 0);
    const cost = (k) => {
      const c = itemCost(k);
      return [[c.pp, `ПП`], [c.mp, `люди`], [c.st, `сталь`], [c.oil, `нефть`]].filter(([v]) => v).map(([v, n]) => `${v} ${n}`).join(` · `);
    };
    const place = (k) => (k === `fort` || k === `ic` ? (own ? reg(i).n : null) : dep ? reg(dep).n : `—`);
    const items = Object.keys(ITEMS).map((k) => {
      const it = ITEMS[k], can = canBuy(S, P, k), pl = place(k), need = (k === `fort` || k === `ic`) && !pl;
      const ok = can && !need && (k !== `fort` || (S.fort[i] || 0) < 3);
      const why = need ? `выберите свой регион на карте` : !can ? `не хватает ресурсов` : k === `fort` && (S.fort[i] || 0) >= 3 ? `максимум` : `место: ${pl}`;
      return `<div class="eu-pi">${it.u ? SYM(it.u, rgb(natRGB(P), 1.12), 26, 17) : `<span class="eu-pic">${this.ic(k === `fort` ? `shield` : `gear`, 2)}</span>`}<span class="eu-un"><b>${esc(it.n)}</b><small>${cost(k)} · ${itemTime(k)} ${plural(itemTime(k), `ход`, `хода`, `ходов`)} · ${esc(why)}</small></span><button class="btn sm ${ok ? `gold` : ``}" data-a="buy" data-k="${k}" ${ok ? `` : `disabled`}>Заказать</button></div>`;
    });
    const turnsLeft = (q) => {
      let paid = q.paid, left = q.left, n = 0;
      while (n < 60) {
        n++;
        if (!(left > 0 && paid >= q.need)) paid += Math.min(q.need - paid, q.need / Math.max(1, q.time) + 0.01);
        if (paid >= q.need - 0.01) left--;
        if (left <= 0 && paid >= q.need - 0.01) break;
      }
      return n;
    };
    const queue = nat.q.map((q, k) => `<div class="eu-pi"><span class="eu-qn">${k + 1}</span><span class="eu-un"><b>${esc(ITEMS[q.k].n)}</b><small>${q.r ? esc(reg(q.r).n) : `место — по готовности`} · ≈ ${turnsLeft(q)} ${plural(turnsLeft(q), `ход`, `хода`, `ходов`)}</small><span class="eu-bar p"><i style="width:${Math.min(100, (q.paid / q.need) * 100)}%"></i></span></span><button class="btn sm" data-a="qdel" data-k="${k}" aria-label="Отменить">${this.ic(`cross`, 2)}</button></div>`).join(``);
    const shares = [0, 0.25, 0.45, 0.65];
    this.modal(`<h2>${this.ic(`crate`, 2)} Производство</h2>
<div class="eu-sub">${FLAG(P)} ${esc(NATIONS[P].n)} · склад: ${f0(nat.pp)} ПП · ${f0(nat.oil)} нефти · ${f0(nat.st)} стали · ${f0(nat.mp)} людей</div>
<div class="eu-hint">Доход за ход: ${sgn(inc.pp)} ПП (15 % — на науку), нефть ${sgn(inc.oil - this.upV)} (армия расходует ${f1(this.upV)}), сталь ${sgn(inc.st)}, люди ${sgn(inc.mp)}.</div>
<div class="eu-h3">Пополнение потерь — доля ПП</div>
<div class="seg eu-seg">${shares.map((v) => `<button class="btn ${v === shares.reduce((b, x) => (Math.abs(x - (nat.reinf ?? 0.45)) < Math.abs(b - (nat.reinf ?? 0.45)) ? x : b)) ? `on` : ``}" data-a="reinf" data-v="${v}">${Math.round(v * 100)} %</button>`).join(``)}</div>
<div class="eu-h3">Заказать</div><div class="eu-pl">${items.join(``)}</div>
<div class="eu-h3">Очередь · ${nat.q.length}</div><div class="eu-pl">${queue || `<p class="eu-hint">Пусто. ПП копятся на складе — заказы оплачиваются по мере поступления.</p>`}</div>
<p class="eu-hint">Люди, сталь и нефть списываются при заказе, ПП — каждый ход. Новые армии появляются у столицы или в выбранном регионе.</p>
<div class="eu-row"><button class="btn gold" data-a="mclose">Готово</button></div>`, { cls: `wide` });
  }
  doBuy(k) {
    const S = this.S, P = S.player, i = this.sel, own = i && S.ctrl[i] === P;
    const r = k === `fort` || k === `ic` ? (own ? i : 0) : own ? deployRegion(S, P, i) : 0;
    if (!buy(S, P, k, r)) return this.sfx(`error`), this.toast(`Не хватает ресурсов`);
    this.sfx(`select`);
    this.incK = null;
    this.render();
    this.showProd();
    this.saveSoon();
  }
  qdel(k) {
    const S = this.S, nat = S.nat[S.player], q = nat.q[k];
    if (!q) return;
    const c = itemCost(q.k);
    nat.q.splice(k, 1);
    (nat.mp += c.mp), (nat.st += c.st), (nat.oil += c.oil), (nat.pp += q.paid * 0.5);
    this.sfx(`click`);
    this.render();
    this.showProd();
    this.saveSoon();
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
<div class="eu-sub">Очки исследований: ${f1(nat.rp || 0)}${cur ? ` из ${c}` : ``} · приток ≈ ${f1(inc.pp * 0.15)} за ход</div>
${cur ? `<span class="eu-bar p wide"><i style="width:${Math.min(100, ((nat.rp || 0) / c) * 100)}%"></i></span>` : `<p class="warn">Направление не выбрано — очки пропадают.</p>`}
<div class="eu-tcs">${cards}</div>
<p class="eu-hint">Уровень открывается не раньше своего года: 1 — 1939, 2 — 1940 … 5 — 1943. Очки копятся и после смены направления.</p>
<div class="eu-row"><button class="btn gold" data-a="mclose">Готово</button></div>`, { cls: `wide` });
  }
  // ——— державы и дипломатия ———
  showPow() {
    const S = this.S, P = S.player;
    const groups = [[`axis`, `Ось`], [`allies`, `Союзники`], [`comintern`, `СССР`], [null, `Нейтралы`], [`dead`, `Капитулировали`]];
    const rel = (n) => (n === P ? `<b class="good">вы</b>` : !alive(S, n) ? `капитуляция` : atWar(S, n, P) ? `<b class="warn">война с вами</b>` : ally(S, n, P) ? `союзник` : coop(S, n, P) ? `попутчик` : side(S, n) ? `не воюет с вами` : `нейтралитет`);
    const canWar = (n) => n !== P && alive(S, n) && !atWar(S, n, P) && !ally(S, n, P) && !coop(S, n, P) && n !== `USA` && !(S.noWar || []).includes(pairKey(n, P)) && G.R.some((R) => S.ctrl[R.i] === n);
    const rows = (g) => Object.keys(NATIONS).filter((n) => (g === `dead` ? !alive(S, n) : alive(S, n) && (side(S, n) || null) === g)).map((n) => {
      const v = vpState(S, n), regs = G.R.filter((R) => S.ctrl[R.i] === n).length, str = totalStr(S, n);
      // ещё не появившиеся (Виши) и заокеанские без войск в Европе — не показываем
      if (alive(S, n) && n !== P && !regs && str < 0.5 && !(n === `USA` && side(S, n))) return ``;
      return `<div class="eu-pw">${FLAG(n, 16)}<span class="eu-un"><b>${esc(NATIONS[n].n)}</b><small>${rel(n)}${alive(S, n) ? ` · регионов ${regs} · войска ${f0(str)}${v.lost ? ` · потеряно ${Math.round(v.k * 100)} % ОП` : ``}` : ``}</small></span>${canWar(n) ? `<button class="btn sm" data-a="war" data-k="${n}">Война</button>` : ``}</div>`;
    }).join(``);
    this.modal(`<h2>${this.ic(`order`, 2)} Державы</h2>
${groups.map(([g, t]) => {
  const h = rows(g);
  return h ? `<div class="eu-h3">${t}</div><div class="eu-pl">${h}</div>` : ``;
}).join(``)}
<p class="eu-hint">Объявление войны нейтралу — его армии и союзники станут вашими противниками. «Попутчики» (СССР и западные союзники) воюют с общим врагом, но не делят снабжение.</p>
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
    const cap = (c) => (c.cap ? `<div class="eu-le warn">${esc(NATIONS[c.cap]?.n || c.cap)} капитулирует</div>` : ``);
    const body = ts.map((t) => {
      const ns = S.news.filter((e) => e.t === t).map((e) => `<div class="eu-le"><b>${esc(e.ttl)}</b><small>${esc(e.txt)}</small></div>`).join(``);
      const cs = S.caps.filter((c) => c.t === t && !c.cap && (ally(S, c.to, P) || (c.from && ally(S, c.from, P)))).map((c) => `${ally(S, c.to, P) ? `<span class="good">+</span>` : `<span class="warn">−</span>`} ${esc(reg(c.r).n)}`);
      const lg = S.log.filter((l) => l.t === t && l.n === P).map((l) => `<div class="eu-le"><small>${esc(l.txt)}</small></div>`).join(``);
      const cp = S.caps.filter((c) => c.t === t && c.cap).map(cap).join(``);
      return ns || cs.length || lg || cp ? `<div class="eu-h3">${esc(dateLabel(t))}</div>${ns}${cp}${cs.length ? `<div class="eu-le"><small>Фронт: ${cs.join(`, `)}</small></div>` : ``}${lg}` : ``;
    }).join(``);
    this.modal(`<h2>${this.ic(`book`, 2)} Журнал</h2>${body || `<p class="eu-hint">Пока пусто.</p>`}<div class="eu-row"><button class="btn gold" data-a="mclose">Закрыть</button></div>`, { cls: `wide` });
  }
  // ——— меню ———
  showMenu() {
    this.modal(`<h2>Европа 1939–1945</h2><div class="eu-sub">${esc(dateLabel(this.S.t))} · ход ${this.S.t + 1}</div>
<div class="eu-mbtns"><button class="btn gold" data-a="mclose">Продолжить</button>
<button class="btn" data-a="help">Как играть</button>
<button class="btn" data-a="hub">Новая кампания</button>
<button class="btn" data-a="exit">Сохранить и выйти в меню</button></div>`);
  }
  showHelp() {
    this.modal(`<h2>Как играть</h2><div class="eu-help">
<p><b>Ход — полмесяца.</b> Вы отдаёте приказы своим армиям, затем ходят все остальные державы. Кампания длится до конца 1945 года.</p>
<p><b>Армии.</b> Пехота — основа обороны (1 переход), моторизованные корпуса и танки — 2 перехода, прорывы и окружения, авиация поддерживает бои в радиусе двух регионов. В регионе — не больше ${STACK} армий.</p>
<p><b>Приказы.</b> Нажмите на регион со своими войсками и отметьте армии — цели подсветятся: зелёный — марш, жёлтый — занять пустой регион, красный — атака, фиолетовый — морской десант. Кнопки «Ж/Д» и «Море» перебрасывают армию далеко по своей территории (число эшелонов и конвоев за ход ограничено).</p>
<p><b>Бой.</b> Сила армии — численность × организованность × опыт × качество войск × техника. Оборону усиливают леса, холмы, горы, болота, города, реки и укрепления; зимой и в распутицу наступать тяжело. Для прорыва нужно соотношение сил не меньше 1,15. Удар с нескольких направлений сильнее.</p>
<p><b>Снабжение</b> идёт от столицы, узлов и портов по своей территории. Без него армии теряют силы — окружайте врага и берегите свои фланги. Режим карты «Снабжение» показывает обстановку.</p>
<p><b>Экономика.</b> Промышленность (ПП), нефть, сталь и люди. ПП оплачивают заказы и пополнение потерь, 15 % идёт на науку. Захваченные регионы дают меньше, советская земля — совсем мало.</p>
<p><b>События.</b> История идёт своим чередом: пакты, вступление в войну Италии и США, ленд-лиз, высадки союзников. Важные решения за вашу державу принимаете вы.</p>
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
    setTimeout(() => d.remove(), 2600);
  }
  report(ttl, txt, cls = ``) {
    const r = this.$.rep;
    r.className = `eu-rep panel ${cls}`;
    r.innerHTML = `<b>${esc(ttl)}</b><small>${esc(txt)}</small>`;
    r.onclick = () => r.classList.add(`hidden`);
    clearTimeout(this.repT);
    this.repT = setTimeout(() => r.classList.add(`hidden`), 4200);
  }
  wait(txt) {
    const w = this.$.wait;
    if (!txt) return w.classList.add(`hidden`);
    w.innerHTML = `<span class="eu-spin"></span><span>${esc(txt)}</span>`;
    w.classList.remove(`hidden`);
  }
  // ——— конец хода ———
  async endTurn() {
    const S = this.S;
    if (this.busy || !S || S.over) return;
    if (S.pending.length) return this.flow();
    this.busy = true;
    this.mode = null;
    this.closeModal(true);
    const t0 = S.t, ctrl0 = S.ctrl.slice();
    this.sfx(`turn`);
    this.renderSheet();
    this.wait(`Ходят другие державы…`);
    await raf();
    await sleep(16);
    try {
      const it = turnSteps(S);
      let t = performance.now();
      for (;;) {
        const st = it.next();
        if (st.done) break;
        if (performance.now() - t > 30) {
          this.wait(`Ход: ${NATIONS[st.value]?.n || st.value}…`);
          await raf();
          t = performance.now();
        }
      }
    } catch (e) {
      console.error(e);
      this.toast(`Ошибка хода: ${e.message}`, `warn`);
    }
    this.busy = false;
    this.wait(null);
    this.undo = [];
    this.afterTurn(t0, ctrl0);
  }
  afterTurn(t0, ctrl0) {
    const S = this.S, P = S.player, mine = (n) => !!n && ally(S, n, P);
    this.map.refresh(true);
    const fl = [];
    for (let r = 1; r <= G.R.length; r++) ctrl0[r] !== S.ctrl[r] && (mine(ctrl0[r]) || mine(S.ctrl[r])) && fl.push({ r, col: mine(S.ctrl[r]) ? `rgba(120,255,140,.32)` : `rgba(255,70,50,.42)` });
    this.map.flash(fl, 3400);
    this.marks = S.bat.filter((b) => b.t === t0 && (mine(b.a) || mine(b.d)) && b.a !== P).map((b) => ({ r: b.T, k: (mine(b.a) ? b.win : !b.win) ? `won` : `lost` }));
    this.map.setMarks(this.marks);
    const sel = this.sel;
    this.pick.clear();
    sel && unitsIn(S, sel).forEach((u) => u.n === P && u.mv > 0 && this.pick.add(u.id));
    this.render();
    this.save();
    if (S.over) return this.showOver();
    this.summary(t0, ctrl0);
  }
  summary(t0, ctrl0) {
    const S = this.S, P = S.player, mine = (n) => !!n && ally(S, n, P);
    const ns = S.news.filter((e) => e.t === t0 || e.t === S.t);
    const lost = [], won = [];
    for (let r = 1; r <= G.R.length; r++) {
      const a = ctrl0[r], b = S.ctrl[r];
      if (a === b) continue;
      mine(a) && !mine(b) ? lost.push(r) : !mine(a) && mine(b) && won.push(r);
    }
    const hit = S.bat.filter((b) => b.t === t0 && mine(b.d) && !mine(b.a)), held = hit.filter((b) => !b.win).length;
    const caps = S.caps.filter((c) => c.t === t0 && c.cap);
    const lg = S.log.filter((l) => l.t === t0 && l.n === P);
    const far = S.caps.filter((c) => c.t === t0 && !c.cap && !mine(c.to) && !mine(c.from) && reg(c.r).vp >= 5);
    if (!ns.length && !lost.length && !won.length && !hit.length && !caps.length && !lg.length && !far.length) {
      this.toast(dateLabel(S.t));
      return this.flow();
    }
    const nm = (rs) => rs.map((r) => esc(reg(r).n)).join(`, `);
    this.modal(`<h2>${esc(dateLabel(S.t))}</h2><div class="eu-sub">Итоги хода ${t0 + 1} · ${esc(shortDate(t0))}</div>
${ns.map((e) => `<div class="eu-news ${e.k === `war` ? `war` : ``}"><b>${esc(e.ttl)}</b><span>${esc(e.txt)}</span></div>`).join(``)}
${caps.map((c) => `<div class="eu-news war"><b>${esc(NATIONS[c.cap]?.n || c.cap)} капитулирует</b></div>`).join(``)}
${hit.length ? `<div class="eu-sl">${this.ic(`shield`, 1)} Атак противника: ${hit.length}, отбито: ${held}</div>` : ``}
${lost.length ? `<div class="eu-sl warn">Потеряны: ${nm(lost)}</div>` : ``}
${won.length ? `<div class="eu-sl good">Заняты союзниками и вами: ${nm(won)}</div>` : ``}
${far.length ? `<div class="eu-sl">${far.map((c) => `${esc(NATIONS[c.to]?.n || c.to)} занимает ${esc(reg(c.r).n)}`).join(` · `)}</div>` : ``}
${lg.map((l) => `<div class="eu-sl">${this.ic(l.k === `tech` ? `gear` : `crate`, 1)} ${esc(l.txt.replace(/^[^:]+: /, ``))}</div>`).join(``)}
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
<div class="eu-info"><span><small>Ход</small><b>${o.t + 1}</b></span><span><small>Регионов у вашего блока</small><b>${regs}</b></span><span><small>Ваши потери</small><b>${f0(S.nat[P].lost || 0)}</b></span>${P === `GER` ? `<span><small>Потери СССР</small><b>${f0(S.nat.SOV.lost || 0)}</b></span><span><small>Потери Британии</small><b>${f0(S.nat.UK.lost || 0)}</b></span>` : `<span><small>Потери Германии</small><b>${f0(S.nat.GER.lost || 0)}</b></span>`}<span><small>Сложность</small><b>${esc(DIFF[S.diff])}</b></span></div>
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
      case `zin`: return this.map.zoomBy(1.4);
      case `zout`: return this.map.zoomBy(1 / 1.4);
    }
    if (!S) return;
    switch (a) {
      case `prod`: return this.sfx(`click`), this.showProd();
      case `tech`: return this.sfx(`click`), this.showTech();
      case `pow`: return this.sfx(`click`), this.showPow();
      case `log`: return this.sfx(`click`), this.showLog();
      case `overview`: return this.sfx(`click`), this.showOver();
      case `mapmode`: {
        const m = (this.map.mode + 1) % 3;
        this.map.setMode(m);
        this.sfx(`click`);
        this.toast([`Политическая карта`, `Рельеф`, `Снабжение: зелёный — хорошее, красный — нет`][m]);
        return this.renderRail();
      }
      case `next`: return this.nextReady();
      case `undo`: return this.doUndo();
      case `end`: return this.endTurn();
      case `desel`: return this.select(0);
      case `pick`: {
        const u = this.unit(+d.id);
        if (!u) return;
        if (u.mv <= 0) return this.sfx(`error`), this.toast(`${u.nm}: ходы израсходованы`);
        this.pick.has(u.id) ? this.pick.delete(u.id) : this.pick.add(u.id);
        this.sfx(`click`);
        return this.render();
      }
      case `pickall`: return unitsIn(S, this.sel).forEach((u) => u.n === S.player && u.mv > 0 && this.pick.add(u.id)), this.sfx(`click`), this.render();
      case `picknone`: return this.pick.clear(), this.sfx(`click`), this.render();
      case `rail`:
      case `sea`: {
        const u = this.unit(+d.id);
        if (!u) return;
        this.mode = { k: a, u };
        this.sfx(`click`);
        this.render();
        this.tg.size && this.map.fitRegions([u.r, ...this.tg.keys()], this.map.z, 450, 6);
        return;
      }
      case `mcancel`: return (this.mode = null), this.sfx(`click`), this.render();
      case `attack`: return this.sfx(`click`), this.openBattle(+d.r);
      case `btog`: return this.btog(+d.id);
      case `fight`: return this.fight();
      case `deep`: return this.sfx(`click`), this.askDeep();
      case `deepno`: return this.sfx(`click`), this.renderBattle();
      case `deepgo`: return this.goDeep();
      case `buy`: return this.doBuy(d.k);
      case `qdel`: return this.qdel(+d.k);
      case `reinf`: return (S.nat[S.player].reinf = +d.v), this.sfx(`click`), this.showProd(), this.saveSoon();
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
