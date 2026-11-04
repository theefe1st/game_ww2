// «Мировой фронт» v0.11, «Восточный фронт»: хозяйство в интерфейсе. «Экономика» — заводы и фабрики, производственные
// линии (доли ±5 %, эффективность, «авто»), очередь стройки (порядок, отмена), советы по укреплениям, эвакуация;
// «Армия» — состав, запасы снаряжения, новые дивизии (куда: авто, тыл фронта или учебный лагерь);
// карточка области — постройки и кнопки стройки.
import * as E from './engine.js';
import { frontsOn, zoneForce } from './ai.js';
import { counterURL } from './counters.js';
import { frontShort } from './ui-fronts.js';
import { FRONT_COL } from './map.js';
import { TYPES, SIDE0, divW } from './rules.js';
import { esc, ic, num, weeksW } from './kit.js';

const nm = (M, r) => M.reg[r].city?.n || M.reg[r].n;
const pc = (x) => `${Math.round(x * 100)}%`;
const EQN = { inf: 'стрелкового оружия', art: 'артиллерии', arm: 'танков' };
export const EcoUI = {
  incOf() { const S = this.S, P = this.P; return S.inc[P]?.pp !== undefined ? S.inc[P] : E.income(S, P); },
  // ——— Экономика ———
  pEco() {
    const S = this.S, P = this.P, M = this.M, inc = this.incOf(), L = S.line[P], q = S.eq[P];
    const my = S.q.filter((b) => b.s === P), planned = E.cpPlanned(S, P);
    let facT = 0, civT = 0;
    for (let r = 0; r < M.R; r++) if (E.sideOf(S, r) === P) { facT += S.fac[r]; civT += S.civ[r]; }
    const lines = E.LINES.map((c) => {
      const o = inc.out?.[c] ?? inc.pp * L.sh[c] * L.e[c], st = c === 'air' ? `ВВС ${num(S.air[P])}` : `запас ${num(q[c])}`;
      return `<div class="e-line"><span class="e-lic">${ic(E.LINE[c].ic)}</span><div class="e-lm"><b>${esc(E.LINE[c].n)}</b><small>+${num(o)} в нед. · ${st} · эфф. ${pc(L.e[c])}</small><i class="e-eff"><em style="width:${Math.round(Math.min(1, L.e[c]) * 100)}%"></em></i></div>
<button class="e-ib sm" data-a="lsh" data-c="${c}" data-d="-1" aria-label="Меньше" ${L.sh[c] < 0.01 ? 'disabled' : ''}>${ic('minus')}</button><b class="e-lsh">${pc(L.sh[c])}</b><button class="e-ib sm" data-a="lsh" data-c="${c}" data-d="1" aria-label="Больше" ${L.sh[c] > 0.84 ? 'disabled' : ''}>${ic('plus')}</button></div>`;
    }).join('');
    const qi = my.map((b, i) => {
      const B = E.BUILD[b.k], eta = E.etaOf(S, P, b);
      return `<div class="e-qi">${ic(B.ic)}<div class="e-lm"><b>${esc(B.n)}${b.k === 'fort' ? ` ${S.fort[b.r] + 1}` : ''}</b><small><button class="e-lnk" data-a="region" data-r="${b.r}">${esc(nm(M, b.r))}</button> · ${eta >= 99 ? 'ждёт очереди' : `≈ ${weeksW(eta)}`}</small><i class="e-eff q"><em style="width:${Math.round((1 - b.left / b.tot) * 100)}%"></em></i></div>${i ? `<button class="e-ib sm" data-a="qup" data-i="${i}" aria-label="Раньше">${ic('up')}</button>` : '<span class="e-ib sm ph"></span>'}<button class="e-ib sm" data-a="qdel" data-i="${i}" aria-label="Отменить">${ic('close')}</button></div>`;
    }).join('');
    // советы: укрепить угрожаемые участки фронта
    const fd = E.frontDist(S, P), thr = new Float32Array(M.R);
    for (let r = 0; r < M.R; r++) if (fd[r] === 0) for (const e of M.reg[r].nb) for (const u of S.at[e.r]) if (u.s !== P) thr[r] += u.str / 100;
    const sug = [...Array(M.R).keys()].filter((r) => fd[r] === 0 && thr[r] > 0 && E.canBuild(S, P, r, 'fort')).sort((a, b) => thr[b] * (1 + M.reg[b].vp * 0.2) - thr[a] * (1 + M.reg[a].vp * 0.2)).slice(0, 4);
    const B = E.BUILD;
    return `${this.head(ic('mil'), 'Экономика', `${ic('prod')} ${num(inc.pp)} в неделю · ${ic('crane')} ${num(E.cpNow(S, P))} стройки`)}<div class="e-pbody">
<div class="e-eco"><span>${ic('factory')}<b>${num(facT)}</b><small>военных заводов${facT - inc.fac > 0.5 ? `, в работе ${num(inc.fac)}` : ''}</small></span><span>${ic('civ')}<b>${num(civT)}</b><small>гражданских фабрик</small></span><span>${ic('men')}<b>+${num(inc.men || 0)}</b><small>призыв в неделю</small></span></div>
${inc.ll ? `<div class="e-note">${ic('ship')}Ленд-лиз: +${num(inc.ll)} в неделю к военному производству</div>` : ''}
<h4>${ic('prod')}Производство <small>доли военного производства</small></h4>
<div class="e-lines">${lines}</div>
<button class="e-row e-toggle ${L.auto ? 'on' : ''}" data-a="lauto">${ic('auto')}<span>Генштаб сам делит производство<small>по составу армии и запасам</small></span><i></i></button>
<div class="e-note">${ic('info')}Больше доля — ниже эффективность линии (переналадка); затем она растёт на 8 % в неделю. Самолёты пополняют ВВС: норма — 20 %.</div>
<h4>${ic('crane')}Стройка <small>${num(planned)} из ${num(E.cpNow(S, P))} в неделю</small></h4>
${qi ? `<div class="e-lines">${qi}</div>` : `<div class="e-note">${ic('info')}Очередь пуста. Нажмите на свою область на карте — там кнопки построек.</div>`}
${sug.length ? `<h4>${ic('fort')}Укрепить фронт</h4>${sug.map((r) => `<div class="e-li"><button class="e-lnk" data-a="region" data-r="${r}">${ic('city')}${esc(nm(M, r))}</button><span class="e-fl">${'▮'.repeat(S.fort[r])}${'▯'.repeat(3 - S.fort[r])}</span><button class="e-btn sm" data-a="bld" data-r="${r}" data-k="fort">${ic('fort')}<span>${B.fort.cp}</span></button></div>`).join('')}` : ''}
${P === 'SOV' && S.evac.length ? `<h4>${ic('train')}Эвакуация</h4>${S.evac.map((e) => `<div class="e-li">${ic('factory')}<span>${esc(M.reg[e.r].n)} → ${esc(M.reg[e.to].n)}</span><small>${weeksW(e.left)}</small></div>`).join('')}` : ''}
<button class="e-row e-toggle ${S.auto.build ? 'on' : ''}" data-a="auto" data-k="build">${ic('auto')}<span>Строить укрепления самим<small>на свободную стройку</small></span><i></i></button>
${P === 'SOV' ? `<button class="e-row e-toggle ${S.flags.evacAuto ? 'on' : ''}" data-a="auto" data-k="evac">${ic('train')}<span>Эвакуировать заводы у фронта</span><i></i></button>` : ''}
<h4>${ic('build')}Постройки <small>в карточке своей области</small></h4>
<div class="e-blds">${E.BUILD_ORDER.map((k) => { const b = B[k], c = E.bCost(S, P, k); return `<div class="e-bld">${ic(b.ic)}<b>${esc(b.n)}</b><small>${ic('crane')}${c} · от ${weeksW(Math.ceil(c / b.cap))}</small><small>${esc(b.d)}</small></div>`; }).join('')}</div>
<div class="e-note">${ic('info')}Каждый новый завод и фабрика — на 12 % дороже прежнего.</div>
</div>`;
  },
  // ——— Армия ———
  pArmy() {
    const S = this.S, P = this.P, M = this.M, q = S.eq[P];
    const by = {}; let n = 0, str = 0, pocket = 0;
    for (const u of S.units) if (E.alive(u) && u.s === P) { by[u.t] = (by[u.t] || 0) + 1; n++; str += u.str; if (S.sup[P][u.r] <= 0) pocket++; }
    const coming = S.units.filter((u) => !u.dead && u.s === P && u.r < 0 && u.arr !== undefined);
    const types = ['arm', 'mot', 'inf', 'mtn', 'cav', 'sec', 'abn'].filter((t) => by[t]);
    const canT = (P === 'SOV' ? ['inf', 'mtn', 'cav', 'mot', 'arm', 'abn'] : ['inf', 'mtn', 'mot', 'arm', 'abn']).filter((t) => TYPES[t] && (t !== 'abn' || this.canAbn?.()));
    const capN = E.armyCap(S, P), size = E.armySize(S, P), full = size >= capN, loc = this.recLoc();
    const recB = canT.map((t) => {
      const c = E.newCost(P, t), m = E.EQS[t] || E.EQS.inf, miss = Object.keys(m).filter((k) => q[k] + 1e-6 < c.pp * m[k]);
      const ok = !full && !miss.length && S.men[P] >= c.men;
      return `<button class="e-rec" data-a="rec" data-t="${t}" ${ok ? '' : 'disabled'}><img src="${counterURL(P, t)}" alt=""><b>${esc(TYPES[t].n)}</b><small>${ic('equip')}${num(c.pp)} ${ic('men')}${num(c.men)}</small>${miss.length ? `<small class="e-miss">нет ${esc(EQN[miss[0]])}</small>` : ''}</button>`;
    }).join('');
    const locs = [['auto', 'Авто', '']];
    for (const f of frontsOn(S, P)) locs.push(['f' + f, frontShort(S.fr[P][f].n), FRONT_COL[S.fr[P][f].col]]);
    for (const r of this.camps()) locs.push(['c' + r, nm(M, r), 'camp']);
    const when = loc.camp >= 0 ? `в лагере «${esc(nm(M, loc.camp))}» через 1 неделю, опытнее` : 'прибудет через 2 недели';
    return `${this.head(ic('helmet'), 'Армия', `${n} ${divW(n)} · в среднем ${n ? Math.round(str / n) : 0}% штата`)}<div class="e-pbody">
<div class="e-types">${types.map((t) => `<div class="e-type"><img src="${counterURL(P, t)}" alt=""><b>${by[t]}</b><small>${esc(TYPES[t].sh)}</small></div>`).join('')}</div>
${pocket ? `<div class="e-warn">${ic('encircle')}В окружении: ${pocket} ${divW(pocket)}</div>` : ''}
${coming.length ? `<div class="e-note">${ic('train')}В пути: ${coming.length} ${divW(coming.length)}</div>` : ''}
<h4>${ic('equip')}Снаряжение и люди <small><button class="e-lnk" data-a="eco">${ic('prod')}производство</button></small></h4>
<div class="e-eco e4"><span>${ic('rifle')}<b>${num(q.inf)}</b><small>стрелковое</small></span><span>${ic('art')}<b>${num(q.art)}</b><small>артиллерия</small></span><span>${ic('tank')}<b>${num(q.arm)}</b><small>танки</small></span><span>${ic('men')}<b>${num(S.men[P])}</b><small>люди</small></span></div>
<h4>${ic('plus')}Новая дивизия <small>${size}/${capN} · ${when}</small></h4>
${full ? `<div class="e-note">${ic('info')}Армия у предела: ${capN} ${divW(capN)}. Предел растёт с мобилизацией, запасы идут на пополнение.</div>` : ''}
<div class="e-zsel">${locs.map(([k, t, col]) => `<button class="e-zc ${loc.k === k ? 'on' : ''}" data-a="recl" data-k="${k}">${col === 'camp' ? ic('camp') : col ? `<i class="e-dot" style="background:${col}"></i>` : ''}${esc(t)}</button>`).join('')}</div>
<div class="e-recs">${recB}</div>
<button class="e-row e-toggle ${S.auto.recruit ? 'on' : ''}" data-a="auto" data-k="recruit">${ic('auto')}<span>Генштаб сам формирует дивизии</span><i></i></button>
</div>`;
  },
  // учебные лагеря стороны со снабжением
  camps() { const S = this.S, P = this.P, out = []; for (let r = 0; r < this.M.R; r++) if (S.camp[r] && E.sideOf(S, r) === P && S.sup[P][r] > 0) out.push(r); return out; },
  recLoc() {
    const k = this.recL || 'auto', S = this.S, P = this.P;
    if (k[0] === 'c') { const r = +k.slice(1); if (S.camp[r] && E.sideOf(S, r) === P && S.sup[P][r] > 0) return { k, camp: r, f: -1 }; }
    if (k[0] === 'f') { const f = +k.slice(1); if (S.fr[P][f]?.on) return { k, camp: -1, f }; }
    return { k: 'auto', camp: -1, f: -1 };
  },
  doRecruit(t) {
    const S = this.S, P = this.P, M = this.M, loc = this.recLoc();
    let f = loc.f, opt = {};
    if (loc.camp >= 0) { f = S.fz[loc.camp]; opt = { at: loc.camp, camp: 1, wait: 1, xp: 10, rdy: 75 }; }
    if (f < 0) { // где нужнее: наибольший перевес противника на фронте
      const fm = E.frontMap(S, P);
      let bw = -1;
      for (const q of frontsOn(S, P)) { const o = zoneForce(S, P, q, fm), w = o.d / Math.max(1, o.a); if (o.d > 0 && w > bw) (bw = w), (f = q); }
      if (f < 0) f = frontsOn(S, P)[0] ?? 2;
    }
    const z = E.frontZone(S, P, f);
    const u = E.recruit(S, P, t, z, { ...opt, f });
    if (!u) { this.snd.play('error'); return this.toast(`${ic('cancel')}${E.armySize(S, P) >= E.armyCap(S, P) ? 'Армия у предела численности' : 'Не хватает снаряжения или людей'}`); }
    S.stats[P].made++;
    this.snd.play('build');
    this.toast(`${ic('plus')}${esc(u.n)}: ${loc.camp >= 0 ? `учебный лагерь «${esc(nm(M, loc.camp))}»` : `в тыл: ${esc(frontShort(S.fr[P][f]?.n))}`}`);
    this.refresh();
  },
  // ——— постройки в карточке области ———
  bGrid(r) {
    const S = this.S, P = this.P, M = this.M, B = E.BUILD;
    const lv = { fac: S.fac[r], civ: S.civ[r], fort: S.fort[r], afd: S.afd[r], camp: S.camp[r], dep: S.dep[r] };
    const home = E.sideOf(S, r) === P;
    if (!home) {
      const has = E.BUILD_ORDER.filter((k) => lv[k]);
      return has.length ? `<div class="e-bl">${has.map((k) => `<span title="${esc(B[k].n)}">${ic(B[k].ic)}${k === 'fac' || k === 'civ' || k === 'fort' ? `<b>${lv[k]}</b>` : ''}</span>`).join('')}</div>` : '';
    }
    const tiles = E.BUILD_ORDER.map((k) => {
      const b = S.q.find((x) => x.r === r && x.k === k), why = E.whyNot(S, P, r, k);
      const lvl = k === 'fort' ? `${lv[k]}/3` : k === 'fac' || k === 'civ' ? `${lv[k]}` : lv[k] ? ic('check') : '';
      const st = b ? `<em>${ic('hourglass')}≈ ${E.etaOf(S, P, b)} нед.</em><i class="e-bp"><i style="width:${Math.round((1 - b.left / b.tot) * 100)}%"></i></i>` : why ? `<em class="no">${esc(why)}</em>` : `<em>${ic('crane')}${E.bCost(S, P, k)}</em>`;
      return `<button class="e-bt ${lv[k] ? 'has' : ''}" data-a="bld" data-r="${r}" data-k="${k}" ${b || why ? 'disabled' : ''}>${ic(B[k].ic)}<b>${lvl}</b><small>${esc(B[k].n)}</small>${st}</button>`;
    }).join('');
    const sl = E.slots(S, r), us = E.used(S, r), land = SIDE0[M.nats[S.own0[r]]] === P;
    return `<div class="e-bgrid">${tiles}</div><div class="e-bsub">${ic('factory')}${land ? `Места под заводы и фабрики: ${us} из ${sl}` : 'Занятая земля: заводы здесь не строят'}</div>`;
  },
  doBuild(r, k) {
    const S = this.S, P = this.P;
    if (!E.build(S, P, r, k)) { this.snd.play('error'); return this.toast(`${ic('cancel')}${esc(E.whyNot(S, P, r, k) || 'Нельзя построить')}`); }
    this.snd.play('build');
    const b = S.q[S.q.length - 1];
    this.toast(`${ic(E.BUILD[k].ic)}${esc(E.BUILD[k].n)}: ${esc(nm(this.M, r))}, ≈ ${weeksW(E.etaOf(S, P, b))}`);
    this.tipSeen('build');
    this.refresh();
  },
  doEvac(r) {
    if (!E.evacuate(this.S, r)) { this.snd.play('error'); return; }
    this.snd.play('build');
    this.toast(`${ic('train')}Заводы уезжают на восток`);
    this.refresh();
  },
};
export const ECO_ACT = {
  eco() { this.snd.play('click'); if (this.panelKind === 'eco' && !this.$('.e-panel').classList.contains('hidden')) return this.closePanel(); return this.openPanel('eco'); },
  lsh(b) { this.snd.play('select'); E.shiftLine(this.S, this.P, b.dataset.c, +b.dataset.d); this.renderPanel(); },
  lauto() { this.snd.play('select'); const L = this.S.line[this.P]; L.auto = L.auto ? 0 : 1; if (L.auto) delete L.airT; this.renderPanel(); },
  qup(b) {
    const S = this.S, P = this.P, i = +b.dataset.i, my = S.q.filter((x) => x.s === P);
    if (i <= 0 || !my[i]) return;
    const a = S.q.indexOf(my[i - 1]), c = S.q.indexOf(my[i]);
    [S.q[a], S.q[c]] = [S.q[c], S.q[a]];
    this.snd.play('select'); this.renderPanel();
  },
  qdel(b) {
    const S = this.S, P = this.P, my = S.q.filter((x) => x.s === P), x = my[+b.dataset.i];
    if (!x) return;
    E.unbuild(S, x);
    this.snd.play('click'); this.toast(`${ic('cancel')}Стройка отменена: ${esc(E.BUILD[x.k].n.toLowerCase())}`); this.refresh();
  },
  recl(b) { this.snd.play('select'); this.recL = b.dataset.k; this.renderPanel(); },
};
