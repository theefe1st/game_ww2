// «Мировой фронт» v0.11, «Восточный фронт»: фронты (как в Hearts of Iron, но проще). Игрок — Ставка: пять постоянных
// фронтов по направлениям (Финский, Северный, Центральный, Южный, Кавказский). У фронта — командующий из короткого
// списка главных генералов, приказ (авто, оборона, наступление с целью, отход) или ручное управление, доля авиации,
// сводка (дивизии, штат, снабжение, небо, потери), список дивизий с переброской на другой фронт и просьбы генерала.
import * as E from './engine.js';
import { nearTarget } from './ai.js';
import { boostsNow } from './events.js';
import { FRONT_COL } from './map.js';
import { ALLG, TRAITS } from '../war/gens41.js';
import { other, WX, TYPES, divW } from './rules.js';
import { esc, ic, num, flagHTML, genURL, POST, weeksW } from './kit.js';
import { counterURL, divLabel, wmOf } from './counters.js';
import * as F from './fronts.js';
import * as A from './army.js';

export const frontShort = (n) => String(n || '').replace(/ фронт$/, '');
export const genPool = F.genPool;
const stars = (k) => '★'.repeat(Math.max(1, Math.min(5, k | 0)));
const pc = (x) => `${Math.round(x * 100)} %`;
const k1 = (x) => (x >= 10 ? num(x) : x.toFixed(1).replace('.', ','));
export const FrontsUI = {
  // ——— панель «Фронты» ———
  pDirs() {
    const S = this.S, P = this.P, Q = other(P), FR = S.fr[P], open = this.fOpen ?? -1, ash = F.airShares(S, P), aAuto = !S.airS?.[P];
    this.trSel ??= new Set();
    const sums = [...Array(E.ZN).keys()].map((z) => F.frontSum(S, P, z)), reqs = F.frontReqs(S, P, sums);
    const rows = [...Array(E.ZN).keys()].map((z) => {
      const Fz = FR[z], col = FRONT_COL[Fz.col] || '#888', g = ALLG[S.gen[P][z]], fs = sums[z];
      const au = !!S.pauto[z], post = S.post[P][z], man = !!Fz.man, isOpen = open === z, wx = WX[S.wx[z]];
      const tr = (g?.tr || []).map((t) => `<span class="e-trait" title="${esc(TRAITS[t]?.d || '')}">${esc(TRAITS[t]?.n || t)}</span>`).join('');
      const t = S.tgt[P][z], tn = t >= 0 ? esc(this.M.reg[t].city?.n || this.M.reg[t].n) : 'выбрать';
      const pb = (p) => `<button class="e-pb ${(p === 'auto' ? au : !au && post === p) ? 'on' : ''}" data-a="post" data-z="${z}" data-p="${p}">${ic(POST[p].ic)}<span>${POST[p].n}</span></button>`;
      const bar = Math.max(4, Math.min(96, (fs.adv / (fs.adv + 1)) * 100));
      const req = reqs[z];
      const orders = !fs.regs ? '' : S.peace ? `<div class="e-dnow">${ic('dove')}мирное время: задачи фронтам — с началом войны</div>` : man
        ? `<div class="e-dnow">${ic('hand')}вы ведёте дивизии фронта сами: нажмите на область с войсками → «Марш» или удар</div>`
        : `<div class="e-posts">${pb('auto')}${pb('def')}${pb('atk')}${pb('ret')}</div>
${post === 'atk' ? `<button class="e-tgtc" data-a="tgt" data-z="${z}">${ic('target')}<span>Цель: <b>${tn}</b></span>${ic('right')}</button>` : `<div class="e-dnow">${au ? `сейчас: ${esc(POST[post].n.toLowerCase())}` : esc(POST[post].d)}</div>`}`;
      const chips = fs.regs || fs.n ? `<div class="e-fst">
<span title="дивизии фронта">${ic('helmet')}<b>${fs.n}</b>${fs.transit ? `<em>+${fs.transit} в пути</em>` : ''}</span>
<span title="средний штат">${ic('men')}<b>${Math.round(fs.str)} %</b></span>
<span title="снабжение">${ic('truck')}<b class="${fs.sup < 0.6 ? 'bad' : ''}">${Math.round(fs.sup * 100)} %</b></span>
<span title="господство в воздухе">${ic('air')}<b class="${fs.ar < 0.35 ? 'bad' : fs.ar > 0.6 ? 'good' : ''}">${Math.round(fs.ar * 100)} %</b></span>
${fs.pocket ? `<span class="bad" title="в окружении">${ic('encircle')}<b>${fs.pocket}</b></span>` : ''}
<span class="e-dwx" title="${esc(wx.n)}">${ic(wx.ic)}</span></div>` : '';
      const force = fs.regs ? `<div class="e-force"><span>${flagHTML(P, 'xs')}${fs.n}</span><i><em style="width:${bar}%"></em></i><span>${fs.nE}${flagHTML(Q, 'xs')}</span></div>` : `<div class="e-note">${ic('info')}Направление пока без участка — фронт в резерве: откроется, когда войска выйдут сюда.</div>`;
      const rq = req ? `<div class="e-req">${ic(F.REQ[req.k].ic)}<div><b>${esc(F.REQ[req.k].t)}</b><small>«${esc(req.txt)}»</small>
<div class="e-reqb"><button class="e-btn sm gold" data-a="freq" data-z="${z}" data-k="${req.k}" ${F.REQ[req.k].pol && S.pol[P] < F.REQ[req.k].pol ? 'disabled' : ''}>${ic(F.REQ[req.k].ic)}<span>${esc(F.REQ[req.k].b)}${F.REQ[req.k].pol ? ` · ★${F.REQ[req.k].pol}` : ''}</span></button><button class="e-btn sm" data-a="freqno" data-z="${z}"><span>Отказать</span></button></div></div></div>` : '';
      const bs = boostsNow(S, P).filter((b) => b.z === z || b.z < 0).map((b) => `<span class="e-boost">${ic('bolt')}${b.kind === 'att' ? 'атака' : 'оборона'} +${Math.round((b.k - 1) * 100)}% · ${b.left} нед.</span>`).join('');
      const prio = S.fprio?.[P]?.z === z ? `<span class="e-boost">${ic('ammo')}приоритет снабжения · ${weeksW(S.fprio[P].left)}</span>` : '';
      return `<div class="e-dir e-front ${isOpen ? 'open' : ''}" data-f="${z}" style="--fc:${col}">
<div class="e-dtop"><button class="e-porb" data-a="fgen" data-z="${z}" aria-label="Сменить командующего"><img class="e-por" src="${genURL(S.gen[P][z])}" alt=""><i>${ic('swap')}</i></button><div class="e-dinfo"><b>${esc(Fz.n)}</b><small class="e-fh">${esc(F.FRONT_HIST[P][z])}</small><small>${g ? `${esc(g.n)} <em class="e-stars">${stars(g.sk)}</em>` : 'нет командующего — назначьте'}</small><div class="e-traits">${tr}</div></div>
<button class="e-ib sm" data-a="zfly" data-z="${z}" aria-label="Показать">${ic('locate')}</button></div>
${force}${chips}${rq}${orders}
<div class="e-fbar">${fs.regs ? `<button class="e-fb ${man ? 'on' : ''}" data-a="fman" data-z="${z}">${ic('hand')}<span>Вручную</span></button>` : ''}<button class="e-fb ${isOpen ? 'on' : ''}" data-a="fopen" data-z="${z}">${ic(isOpen ? 'up' : 'list')}<span>${isOpen ? 'Свернуть' : 'Дивизии и потери'}</span></button><span class="e-fair">${ic('air')}<button class="e-ib xs" data-a="fair" data-z="${z}" data-d="-1" aria-label="Меньше авиации" ${ash[z] < 0.01 ? 'disabled' : ''}>${ic('minus')}</button><b>${pc(ash[z])}</b><button class="e-ib xs" data-a="fair" data-z="${z}" data-d="1" aria-label="Больше авиации" ${ash[z] > 0.89 ? 'disabled' : ''}>${ic('plus')}</button></span></div>
${bs}${prio}${isOpen ? this.frontMore(z, fs, ash, aAuto) : ''}</div>`;
    }).join('');
    const air = `<button class="e-row e-toggle ${aAuto ? 'on' : ''}" data-a="fairauto">${ic('air')}<span>Генштаб сам делит авиацию<small>иначе — ваши доли по фронтам (кнопки ✈ − +)</small></span><i></i></button>`;
    return `${this.head(ic('compass'), 'Фронты', 'вы — Ставка: пять направлений, генералы ведут фронты по вашим приказам')}<div class="e-pbody">${rows}${air}</div>`;
  },
  // подробности фронта: авиация, потери, качество, дивизии (с переброской)
  frontMore(z, fs, ash, aAuto) {
    const S = this.S, P = this.P, M = this.M, sel = this.trSel;
    const L = fs.L || {}, LE = fs.LE || {};
    const lrow = (o, w) => `<span>${ic('men')}${k1((w ? o.wm : o.m) || 0)} тыс.</span><span>${ic('tank')}${num((w ? o.wt : o.t) || 0)}</span><span>${ic('art')}${num((w ? o.wg : o.g) || 0)}</span><span>${ic('skull')}${(w ? o.wd : o.d) || 0}</span>`;
    const us = S.units.filter((u) => E.alive(u) && u.s === P && M.reg[u.r].z === z);
    const grp = (u) => (S.sup[P][u.r] <= 0 ? 0 : E.isFront(S, u.r, P) ? 1 : 2);
    us.sort((a, b) => grp(a) - grp(b) || TYPES[b.t].att - TYPES[a.t].att || b.str - a.str);
    const tin = S.units.filter((u) => !u.dead && u.s === P && u.r < 0 && u.arr !== undefined && u.zf === z);
    const GN = ['в окружении', 'на линии фронта', 'в тылу фронта'];
    let last = -1;
    const rows = us.map((u) => {
      const g = grp(u), h = g !== last ? `<h5>${GN[g]}</h5>` : '';
      last = g;
      const on = sel.has(u.id);
      return `${h}<div class="e-dv ${on ? 'on' : ''}"><button class="e-dvb" data-a="fdiv" data-id="${u.id}"><img src="${counterURL(u.nat, u.t, divLabel(u), wmOf(u))}" alt=""><span><b>${esc(u.n)}</b><i class="e-eff q"><em style="width:${Math.round(u.str)}%"></em></i></span><small>${Math.round(u.str)} %</small></button><button class="e-ib sm" data-a="ftsel" data-id="${u.id}" aria-label="Выбрать для переброски">${ic(on ? 'check' : 'swap')}</button></div>`;
    }).join('');
    const tr = tin.length ? `<h5>в пути на фронт</h5>${tin.map((u) => `<div class="e-dv tr"><span class="e-dvb"><img src="${counterURL(u.nat, u.t, divLabel(u), wmOf(u))}" alt=""><span><b>${esc(u.n)}</b><small>${ic('train')}прибудет через ${weeksW(Math.max(1, u.arr - S.turn))}</small></span></span></div>`).join('')}` : '';
    const n = sel.size, fronts = [...Array(E.ZN).keys()].filter((f) => f !== z), nRes = A.inRes(S, P).length;
    const bar = n ? `<div class="e-trbar"><span>${ic('train')}Перебросить ${n} ${divW(n)} на:</span><div class="e-chips">${fronts.map((f) => `<button class="e-chip" data-a="ftgo" data-z="${z}" data-f="${f}"><i class="e-dot" style="background:${FRONT_COL[S.fr[P][f].col]}"></i>${esc(frontShort(S.fr[P][f].n))}</button>`).join('')}<button class="e-chip" data-a="ftclr">${ic('close')}</button></div><small>по железной дороге: соседний фронт — 1 неделя, дальний — 2; на этой неделе ещё ${S.railCap[P] || 0}</small></div>` : '';
    return `<div class="e-fmore">
<h4>${ic('air')}Авиация фронта <small>${aAuto ? 'делит Генштаб' : 'ваши доли'}</small></h4>
<div class="e-li"><span>${pc(ash[z])} ВВС · ≈ ${num(F.planes(S, P, ash[z]))} самолётов</span><small>господство ${Math.round(fs.ar * 100)} %</small></div>
<h4>${ic('skull')}Потери <small>за неделю / всего</small></h4>
<div class="e-loss"><b>Наши</b><div>${lrow(L, 1)}</div><div class="all">${lrow(L, 0)}</div><b>Врага</b><div>${lrow(LE, 1)}</div><div class="all">${lrow(LE, 0)}</div></div>
<div class="e-note">${ic('upgrade')}Выучка войск: ${Math.round(fs.q * 100)} % — растёт по ходу войны, как в истории; дивизии пополняются сами из запасов снаряжения и людей.</div>
<h4>${ic('helmet')}Дивизии фронта <small>${fs.n} ${divW(fs.n)} · нажмите ⇄, чтобы перебросить</small></h4>
${nRes ? `<div class="e-li"><span>${ic('star')}${esc(A.resName(P))}: ${nRes} ${divW(nRes)}</span><button class="e-btn sm" data-a="fres" data-z="${z}">${ic('train')}<span>Сюда ${Math.min(3, nRes)} · ${weeksW(A.sendW(z))}</span></button></div>` : ''}
${bar}<div class="e-dvl">${rows || `<div class="e-note">${ic('info')}Дивизий нет</div>`}${tr}</div></div>`;
  },
  setPost(z, p) {
    const S = this.S, P = this.P;
    if (S.peace && p !== 'auto' && p !== 'def') { this.snd.play('error'); return this.toast(`${ic('dove')}Мирное время: наступать и отходить — с началом войны`); }
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
    if (S.peace) { this.snd.play('error'); return this.toast(`${ic('dove')}Мирное время: цели наступления — с началом войны`); }
    S.pauto[z] = 0; S.post[P][z] = 'atk'; S.tgt[P][z] = r;
    this.toast(`${ic('target')}${esc(frontShort(S.fr[P][z].n))}: цель — ${esc(this.M.reg[r].city?.n || this.M.reg[r].n)}`);
    this.refresh();
  },
  // фронт области — её направление
  frontOfR(r) { return this.M.reg[r].z; },
  pickTarget(z) {
    const S = this.S, P = this.P, M = this.M;
    this.closePanel();
    const cand = new Set();
    for (const g of M.reg) if (E.sideOf(S, g.id) === other(P) && (g.vp > 0 || g.city?.s >= 2) && g.z === z) cand.add(g.id);
    this.pick = { z };
    this.map.setHL({ pick: cand, reach: null, atk: null });
    this.modeBar(`${ic('target')}<span>Цель для фронта «${esc(frontShort(S.fr[P][z].n))}»: нажмите на область противника</span>`);
    this.flyZone(z);
  },
  flyZone(z) {
    const S = this.S, M = this.M, P = this.P, rs = [];
    for (let r = 0; r < M.R; r++) if (E.sideOf(S, r) === P && M.reg[r].z === z && E.isFront(S, r, P)) rs.push(r);
    if (!rs.length) for (let r = 0; r < M.R; r++) if (E.sideOf(S, r) === P && M.reg[r].z === z) rs.push(r);
    if (!rs.length) for (let r = 0; r < M.R; r++) if (M.reg[r].z === z) rs.push(r);
    this.closePanel();
    this.map.fitRegions(rs, 30);
  },
  // ——— командующие ———
  genPicker(z) {
    const S = this.S, P = this.P, FR = S.fr[P], cur = S.gen[P][z];
    const busy = new Map();
    for (let f = 0; f < E.ZN; f++) if (S.gen[P][f]) busy.set(S.gen[P][f], f);
    const L = F.genPool(S, P, z).map((g) => {
      const f = busy.get(g.k), tr = g.tr.map((t) => `<span class="e-trait">${esc(TRAITS[t]?.n || t)}</span>`).join('');
      return `<button class="e-gsel ${g.k === cur ? 'on' : ''}" data-a="gpick" data-z="${z}" data-k="${g.k}"><img src="${genURL(g.k)}" alt=""><span><b>${esc(g.n)}</b><em class="e-stars">${stars(g.sk)}</em><span class="e-traits">${tr}</span>${f !== undefined && f !== z ? `<small style="color:${FRONT_COL[FR[f].col]}">${esc(frontShort(FR[f].n))}</small>` : ''}</span></button>`;
    }).join('');
    const hist = S.mode === 'hist' ? `<button class="e-btn sm ${FR[z].pick ? '' : 'gold'}" data-a="ghist" data-z="${z}">${ic('book')}<span>Как в истории</span></button>` : '';
    this.modal(`<div class="e-gpick"><h2>${esc(FR[z].n)}: командующий</h2><p>Главные полководцы войны. Черты генерала усиливают фронт: наступление, оборона, танки, снабжение, окружения. Занятого генерала поменяют местами.</p><div class="e-glist">${L}</div>
<div class="e-btns">${hist}<button class="e-btn" data-a="close">${ic('close')}<span>Закрыть</span></button></div></div>`);
  },
  pickGen(z, k) {
    const S = this.S, P = this.P, G = S.gen[P], FR = S.fr[P];
    let f = -1;
    for (let q = 0; q < E.ZN; q++) if (q !== z && G[q] === k) f = q;
    if (f >= 0) { G[f] = G[z]; FR[f].pick = 1; }
    G[z] = k; FR[z].pick = 1;
    this.closeModal();
    this.toast(`${ic('star')}${esc(frontShort(FR[z].n))}: командует ${esc(ALLG[k].n)}`);
    this.refresh();
    if (this.panelKind === 'dirs') this.renderPanel();
  },
  // ——— переброска и просьбы ———
  doTransfer(z, f) {
    const S = this.S, P = this.P, ids = [...(this.trSel || [])];
    let ok = 0, why = '';
    for (const id of ids) {
      const u = S.units.find((x) => x.id === id);
      if (!u) continue;
      const w = F.trWhy(S, u, f);
      if (w) { why ||= `${u.n}: ${w}`; continue; }
      if (F.transfer(S, u, f)) ok++;
    }
    this.trSel.clear();
    if (ok) { this.snd.play('build'); this.toast(`${ic('train')}${ok} ${divW(ok)} — на ${esc(frontShort(S.fr[P][f].n))} фронт`); }
    else this.snd.play('error');
    if (why) this.toast(`${ic('cancel')}${esc(why)}`, 'bad');
    this.refresh();
    if (this.panelKind === 'dirs') this.renderPanel();
  },
  doReq(z, k) {
    const S = this.S, P = this.P, nmF = esc(frontShort(S.fr[P][z].n));
    if (k === 'men') {
      // сначала — из резерва Ставки, затем — с фронтов без натиска
      let n = 0;
      for (const u of A.inRes(S, P).slice(0, 3)) if (A.send(S, u, z)) n++;
      if (n) this.toast(`${ic('star')}${nmF}: из резерва — ${n} ${divW(n)} (${weeksW(A.sendW(z))})`);
      else {
        const us = F.spareFor(S, P, z, 3);
        if (!us.length) { this.toast(`${ic('info')}Свободных дивизий нет — обучите новые для фронта`); this.rqDst = z; F.reqNo(S, P, z, 2); return this.openPanel('army'); }
        for (const u of us) if (F.transfer(S, u, z)) n++;
        this.toast(`${ic('train')}${nmF}: перебрасываются ${n} ${divW(n)} (1–2 недели)`);
      }
    } else if (k === 'ammo') {
      if (!F.prioSet(S, P, z)) { this.snd.play('error'); return this.toast(`${ic('cancel')}Не хватает ★`); }
      this.toast(`${ic('ammo')}${nmF}: приоритет снабжения на 4 недели`);
    } else if (k === 'air') {
      F.airShift(S, P, z, 2);
      this.toast(`${ic('air')}${nmF}: +10 % авиации`);
    } else if (k === 'ret' || k === 'atk') {
      this.setPost(z, k);
    }
    F.reqNo(S, P, z, 2);
    this.snd.play('select');
    this.refresh();
    if (this.panelKind === 'dirs') this.renderPanel();
  },
};
export const FRONT_ACT = {
  fgen(b) { this.snd.play('click'); this.genPicker(+b.dataset.z); },
  gpick(b) { this.snd.play('select'); this.pickGen(+b.dataset.z, b.dataset.k); },
  ghist(b) { const z = +b.dataset.z; this.S.fr[this.P][z].pick = 0; this.applyAuto(); this.closeModal(); this.refresh(); if (this.panelKind === 'dirs') this.renderPanel(); },
  fman(b) { this.snd.play('select'); const Fz = this.S.fr[this.P][+b.dataset.z]; Fz.man = Fz.man ? 0 : 1; this.refresh(); this.renderPanel(); },
  fopen(b) { this.snd.play('click'); const z = +b.dataset.z; this.fOpen = this.fOpen === z ? -1 : z; this.trSel?.clear(); this.renderPanel(); },
  fair(b) { this.snd.play('select'); F.airShift(this.S, this.P, +b.dataset.z, +b.dataset.d); this.renderPanel(); },
  fairauto() { this.snd.play('select'); F.airAutoSet(this.S, this.P, !!this.S.airS?.[this.P]); this.renderPanel(); },
  fdiv(b) {
    const u = this.S.units.find((x) => x.id === +b.dataset.id);
    if (!u || u.r < 0) return;
    this.snd.play('click'); this.closePanel();
    this.map.flyTo(this.M.reg[u.r].x, this.M.reg[u.r].y, Math.max(this.map.view.sc, 0.9));
    this.openRegion(u.r);
  },
  ftsel(b) { this.snd.play('select'); const id = +b.dataset.id; this.trSel ??= new Set(); if (this.trSel.has(id)) this.trSel.delete(id); else this.trSel.add(id); this.renderPanel(); },
  ftclr() { this.snd.play('click'); this.trSel?.clear(); this.renderPanel(); },
  ftgo(b) { this.doTransfer(+b.dataset.z, +b.dataset.f); },
  freq(b) { this.doReq(+b.dataset.z, b.dataset.k); },
  fres(b) { const S = this.S, P = this.P, z = +b.dataset.z; let n = 0; for (const u of A.inRes(S, P).slice(0, 3)) if (A.send(S, u, z)) n++; if (n) { this.snd.play('build'); this.toast(`${ic('star')}${esc(frontShort(S.fr[P][z].n))}: из резерва — ${n} ${divW(n)}`); } this.refresh(); },
  freqno(b) { this.snd.play('click'); F.reqNo(this.S, this.P, +b.dataset.z, 3); this.renderPanel(); },
};
