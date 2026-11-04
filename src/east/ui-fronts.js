// «Мировой фронт» v0.11, «Восточный фронт»: фронты (как планы сражений в Hearts of Iron). Игрок — Ставка: у каждого
// фронта свой цвет, участок (области), командующий и приказ (авто, оборона, наступление с целью, отход) или ручное
// управление. Участки перекрашиваются касанием областей; фронты можно создавать (до 8) и расформировывать.
import * as E from './engine.js';
import { zoneForce, frontsOn, nearTarget, autoTarget } from './ai.js';
import { boostsNow } from './events.js';
import { FRONT_COL } from './map.js';
import { FRONT_N, GEN_UNTIL } from './hist.js';
import { ALLG, TRAITS } from '../war/gens41.js';
import { other, WX, turnOf } from './rules.js';
import { esc, ic, flagHTML, genURL, POST } from './kit.js';

const hexRGB = (h) => { const n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
export const frontShort = (n) => String(n || '').replace(/ фронт$/, '');
const stars = (k) => '★'.repeat(Math.max(1, Math.min(5, k | 0)));
// генералы стороны, доступные на дату (без погибших и снятых)
export function genPool(S, P) {
  const t = S.turn;
  return Object.values(ALLG).filter((g) => (P === 'SOV' ? g.nat === 'SOV' : g.nat !== 'SOV') && turnOf(g.from) <= t && !(GEN_UNTIL[g.k] && turnOf(GEN_UNTIL[g.k]) <= t))
    .sort((a, b) => b.sk - a.sk || a.sh.localeCompare(b.sh, 'ru'));
}
export const FrontsUI = {
  // ——— панель «Фронты» ———
  pDirs() {
    const S = this.S, P = this.P, Q = other(P), M = this.M, FR = S.fr[P], fm = E.frontMap(S, P), on = frontsOn(S, P);
    const cnt = {}, reg = {};
    for (const f of on) (cnt[f] = { [P]: 0, [Q]: 0 }), (reg[f] = 0);
    for (const u of S.units) if (E.alive(u) && cnt[fm[u.r]]) cnt[fm[u.r]][u.s]++;
    for (let r = 0; r < M.R; r++) if (E.sideOf(S, r) === P && reg[S.fz[r]] !== undefined) reg[S.fz[r]]++;
    const rows = on.map((z) => {
      const F = FR[z], col = FRONT_COL[F.col] || '#888', g = ALLG[S.gen[P][z]], f = zoneForce(S, P, z, fm), k = f.a / Math.max(1, f.d);
      const au = !!S.pauto[z], post = S.post[P][z], man = !!F.man, wz = E.frontZone(S, P, z);
      const tr = (g?.tr || []).map((t) => `<span class="e-trait" title="${esc(TRAITS[t]?.d || '')}">${esc(TRAITS[t]?.n || t)}</span>`).join('');
      const t = S.tgt[P][z], tn = t >= 0 ? esc(M.reg[t].city?.n || M.reg[t].n) : 'выбрать';
      const bs = boostsNow(S, P).filter((b) => b.z === wz || b.z < 0).map((b) => `<span class="e-boost">${ic('bolt')}${b.kind === 'att' ? 'атака' : 'оборона'} +${Math.round((b.k - 1) * 100)}% · ${b.left} нед.</span>`).join('');
      const pb = (p) => `<button class="e-pb ${(p === 'auto' ? au : !au && post === p) ? 'on' : ''}" data-a="post" data-z="${z}" data-p="${p}">${ic(POST[p].ic)}<span>${POST[p].n}</span></button>`;
      const bar = Math.max(4, Math.min(96, (k / (k + 1)) * 100));
      const orders = man
        ? `<div class="e-dnow">${ic('hand')}вы ведёте дивизии фронта сами: нажмите на область с войсками → «Марш» или удар</div>`
        : `<div class="e-posts">${pb('auto')}${pb('def')}${pb('atk')}${pb('ret')}</div>
${post === 'atk' ? `<button class="e-tgtc" data-a="tgt" data-z="${z}">${ic('target')}<span>Цель: <b>${tn}</b></span>${ic('right')}</button>` : `<div class="e-dnow">${au ? `сейчас: ${esc(POST[post].n.toLowerCase())}` : esc(POST[post].d)}</div>`}`;
      return `<div class="e-dir e-front" data-f="${z}" style="--fc:${col}">
<div class="e-dtop"><button class="e-porb" data-a="fgen" data-z="${z}" aria-label="Сменить командующего"><img class="e-por" src="${genURL(S.gen[P][z])}" alt=""><i>${ic('swap')}</i></button><div class="e-dinfo"><b>${esc(F.n)}</b><small>${g ? `${esc(g.n)} <em class="e-stars">${stars(g.sk)}</em>` : 'нет командующего — назначьте'}</small><div class="e-traits">${tr}</div></div>
<button class="e-ib sm" data-a="zfly" data-z="${z}" aria-label="Показать">${ic('locate')}</button></div>
${reg[z] ? `<div class="e-force"><span>${flagHTML(P, 'xs')}${cnt[z][P]}</span><i><em style="width:${bar}%"></em></i><span>${cnt[z][Q]}${flagHTML(Q, 'xs')}</span><span class="e-dwx" title="${esc(WX[S.wx[wz]].n)}">${ic(WX[S.wx[wz]].ic)}</span></div>` : `<div class="e-note">${ic('info')}У фронта нет участка: нажмите «Участок» и выберите области</div>`}
${orders}
<div class="e-fbar"><button class="e-fb ${man ? "on" : ""}" data-a="fman" data-z="${z}">${ic('hand')}<span>Вручную</span></button><button class="e-fb" data-a="fpaint" data-z="${z}">${ic('brush')}<span>Участок</span></button>${on.length > 1 ? `<button class="e-fb" data-a="fdel" data-z="${z}">${ic('close')}<span>Расформировать</span></button>` : ''}</div>
${bs}</div>`;
    }).join('');
    const add = on.length < E.FN ? `<button class="e-btn e-fnew" data-a="fnew">${ic('plus')}<span>Новый фронт</span></button>` : '';
    return `${this.head(ic('compass'), 'Фронты', 'вы — Ставка: генералы ведут фронты по вашим приказам')}<div class="e-pbody">${rows}${add}</div>`;
  },
  setPost(z, p) {
    const S = this.S, P = this.P;
    if (p === 'auto') { S.pauto[z] = 1; this.applyAuto(); }
    else {
      S.pauto[z] = 0; S.post[P][z] = p;
      if (p === 'atk' && (S.tgt[P][z] < 0 || E.sideOf(S, S.tgt[P][z]) === P)) {
        const t = nearTarget(S, P, z);
        S.tgt[P][z] = t;
        if (t < 0) this.toast(`${ic('target')}Выберите цель на карте`);
      }
    }
    this.refresh();
  },
  setTarget(z, r) {
    const S = this.S, P = this.P;
    S.pauto[z] = 0; S.post[P][z] = 'atk'; S.tgt[P][z] = r;
    this.toast(`${ic('target')}${esc(frontShort(S.fr[P][z].n))}: цель — ${esc(this.M.reg[r].city?.n || this.M.reg[r].n)}`);
    this.refresh();
  },
  // фронт области (своей — её фронт, чужой — ближайший свой)
  frontOfR(r) { return E.frontMap(this.S, this.P)[r]; },
  pickTarget(z) {
    const S = this.S, P = this.P, M = this.M, fm = E.frontMap(S, P);
    this.closePanel();
    const cand = new Set();
    for (const g of M.reg) if (E.sideOf(S, g.id) === other(P) && (g.vp > 0 || g.city?.s >= 2) && fm[g.id] === z) cand.add(g.id);
    this.pick = { z };
    this.map.setHL({ pick: cand, reach: null, atk: null });
    this.modeBar(`${ic('target')}<span>Цель для фронта «${esc(frontShort(S.fr[P][z].n))}»: нажмите на область противника</span>`);
    this.flyZone(z);
  },
  flyZone(z) {
    const S = this.S, M = this.M, P = this.P, rs = [];
    for (let r = 0; r < M.R; r++) if (E.sideOf(S, r) === P && S.fz[r] === z && E.isFront(S, r, P)) rs.push(r);
    if (!rs.length) for (let r = 0; r < M.R; r++) if (E.sideOf(S, r) === P && S.fz[r] === z) rs.push(r);
    if (!rs.length) for (let r = 0; r < M.R; r++) if (M.reg[r].z === Math.min(E.ZN - 1, z)) rs.push(r);
    this.closePanel();
    this.map.fitRegions(rs, 30);
  },
  // ——— командующие ———
  genPicker(z) {
    const S = this.S, P = this.P, FR = S.fr[P], cur = S.gen[P][z];
    const busy = new Map();
    frontsOn(S, P).forEach((f) => { if (S.gen[P][f]) busy.set(S.gen[P][f], f); });
    const L = genPool(S, P).map((g) => {
      const f = busy.get(g.k), tr = g.tr.map((t) => `<span class="e-trait">${esc(TRAITS[t]?.n || t)}</span>`).join('');
      return `<button class="e-gsel ${g.k === cur ? 'on' : ''}" data-a="gpick" data-z="${z}" data-k="${g.k}"><img src="${genURL(g.k)}" alt=""><span><b>${esc(g.n)}</b><em class="e-stars">${stars(g.sk)}</em><span class="e-traits">${tr}</span>${f !== undefined && f !== z ? `<small style="color:${FRONT_COL[FR[f].col]}">${esc(frontShort(FR[f].n))}</small>` : ''}</span></button>`;
    }).join('');
    const hist = S.mode === 'hist' && z < E.ZN ? `<button class="e-btn sm ${FR[z].pick ? '' : 'gold'}" data-a="ghist" data-z="${z}">${ic('book')}<span>Как в истории</span></button>` : '';
    this.modal(`<div class="e-gpick"><h2>${esc(FR[z].n)}: командующий</h2><p>Черты генерала усиливают фронт: наступление, оборона, танки, снабжение, окружения. Занятого генерала поменяют местами.</p><div class="e-glist">${L}</div>
<div class="e-btns">${hist}<button class="e-btn" data-a="close">${ic('close')}<span>Закрыть</span></button></div></div>`);
  },
  pickGen(z, k) {
    const S = this.S, P = this.P, G = S.gen[P], FR = S.fr[P];
    const f = frontsOn(S, P).find((q) => q !== z && G[q] === k);
    if (f !== undefined) { G[f] = G[z]; FR[f].pick = 1; }
    G[z] = k; FR[z].pick = 1;
    this.closeModal();
    this.toast(`${ic('star')}${esc(frontShort(FR[z].n))}: командует ${esc(ALLG[k].n)}`);
    this.refresh();
    if (this.panelKind === 'dirs') this.renderPanel();
  },
  // ——— участки ———
  custom() {
    const S = this.S;
    if (!S.fcust) { S.fcust = 1; S.fzo = Int8Array.from(S.fz); }
  },
  paintHL() {
    const S = this.S, P = this.P, M = this.M, m = new Map(), FR = S.fr[P];
    for (let r = 0; r < M.R; r++) if (E.sideOf(S, r) === P) m.set(r, hexRGB(FRONT_COL[FR[S.fz[r]]?.col] || '#888888'));
    return m;
  },
  startPaint(z) {
    const S = this.S, P = this.P;
    this.closePanel();
    this.custom();
    this.pick = { paint: z };
    this.map.setHL({ paint: this.paintHL(), pick: null, reach: null, atk: null });
    this.modeBar(`${ic('brush')}<span>Участок «${esc(frontShort(S.fr[P][z].n))}»: нажимайте свои области — они перейдут к фронту</span><button class="e-btn sm gold" data-a="pdone">${ic('check')}<span>Готово</span></button>`);
    if (!S.fz.some((f, r) => f === z && E.sideOf(S, r) === P)) this.toast(`${ic('brush')}Нажмите на области будущего участка`);
    else this.flyZone(z);
    this.tipSeen('fronts');
  },
  paintTap(r) {
    const S = this.S, P = this.P, z = this.pick.paint;
    if (r < 0 || E.sideOf(S, r) !== P) { this.snd.play('error'); return this.toast(`${ic('brush')}Только свои области`); }
    if (S.fz[r] === z) return;
    this.snd.play('select');
    S.fzo[r] = z;
    E.assignFronts(S);
    this.map.setHL({ paint: this.paintHL() });
    this.map.refresh();
  },
  endPaint() {
    this.cancelMode(true);
    this.map.setHL({ paint: null });
    this.refresh();
    this.openPanel('dirs');
  },
  newFront() {
    const S = this.S, P = this.P, FR = S.fr[P];
    const f = FR.findIndex((F) => !F.on);
    if (f < 0) return;
    const used = new Set(FR.filter((F) => F.on).map((F) => F.n)), cols = new Set(FR.filter((F) => F.on).map((F) => F.col));
    const n = FRONT_N[P].find((x, i) => i >= E.ZN && !used.has(x)) || `${f + 1}-й фронт`;
    let col = 0; while (cols.has(col) && col < FRONT_COL.length - 1) col++;
    const busy = new Set(frontsOn(S, P).map((q) => S.gen[P][q]));
    const g = genPool(S, P).find((x) => !busy.has(x.k));
    FR[f] = { n, col, on: 1, man: 0, pick: 1 };
    S.gen[P][f] = g?.k || null; S.post[P][f] = 'def'; S.tgt[P][f] = -1; S.pauto[f] = 1;
    this.custom();
    this.snd.play('select');
    this.toast(`${ic('plus')}${esc(n)}${g ? ` — ${esc(g.n)}` : ''}`);
    this.startPaint(f);
  },
  delFront(z) {
    const S = this.S, P = this.P, FR = S.fr[P];
    if (frontsOn(S, P).length < 2) return;
    if (this.confirmDel !== z) { this.confirmDel = z; this.snd.play('error'); return this.toast(`${ic('info')}Нажмите ещё раз: участок «${esc(frontShort(FR[z].n))}» отойдёт соседям`, 'bad'); }
    this.confirmDel = -1;
    this.custom();
    FR[z].on = 0; S.post[P][z] = 'def'; S.tgt[P][z] = -1;
    for (let r = 0; r < this.M.R; r++) if (S.fzo[r] === z) S.fzo[r] = -1;
    E.assignFronts(S);
    this.snd.play('click');
    this.refresh();
    this.renderPanel();
  },
};
export const FRONT_ACT = {
  fgen(b) { this.snd.play('click'); this.genPicker(+b.dataset.z); },
  gpick(b) { this.snd.play('select'); this.pickGen(+b.dataset.z, b.dataset.k); },
  ghist(b) { const z = +b.dataset.z; this.S.fr[this.P][z].pick = 0; this.applyAuto(); this.closeModal(); this.refresh(); if (this.panelKind === 'dirs') this.renderPanel(); },
  fman(b) { this.snd.play('select'); const F = this.S.fr[this.P][+b.dataset.z]; F.man = F.man ? 0 : 1; this.refresh(); this.renderPanel(); },
  fpaint(b) { this.snd.play('click'); this.startPaint(+b.dataset.z); },
  pdone() { this.snd.play('click'); this.endPaint(); },
  fnew() { this.newFront(); },
  fdel(b) { this.delFront(+b.dataset.z); },
};
