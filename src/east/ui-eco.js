// «Мировой фронт» v0.11, «Восточный фронт»: хозяйство в интерфейсе. «Экономика» — заводы, производственные линии
// (доли ±5 % или ±1 завод, эффективность, «авто»), стройбригады и очередь стройки (порядок, отмена), советы по укреплениям, эвакуация;
// «Армия» — состав, запасы снаряжения, призыв (род × число → обучение → резерв Ставки → фронт, army.js);
// карточка области — постройки и кнопки стройки.
import * as E from './engine.js';
import { frontsOn } from './ai.js';
import * as A from './army.js';
import { counterURL } from './counters.js';
import { frontShort } from './ui-fronts.js';
import { FRONT_COL } from './map.js';
import { TYPES, SIDE0, divW, plural } from './rules.js';
import { esc, ic, num, turnsW } from './kit.js';
import { PEACE_EXTRA } from './prewar.js';
import { SEAS, seaDom } from './fleet.js';

const nm = (M, r) => M.reg[r].city?.n || M.reg[r].n;
const pc = (x) => `${Math.round(x * 100)}%`;
const facW = (n) => plural(Math.round(n), 'завод', 'завода', 'заводов');
const EQN = { inf: 'стрелкового оружия', art: 'артиллерии', arm: 'танков' };
export const EcoUI = {
  incOf() { const S = this.S, P = this.P; return S.inc[P]?.pp !== undefined ? S.inc[P] : E.income(S, P); },
  // ——— Экономика ———
  facTot() { const S = this.S, P = this.P; let n = 0; for (let r = 0; r < this.M.R; r++) if (E.sideOf(S, r) === P) n += S.fac[r]; return n; },
  pEco() {
    const S = this.S, P = this.P, M = this.M, inc = this.incOf(), L = S.line[P], q = S.eq[P];
    const my = E.myQ(S, P), N = E.brigN(S, P), busy = Math.min(N, my.length), facT = this.facTot();
    // доли производства: в % или числом заводов (переключатель)
    const fm = L.fm && facT > 0, al = fm ? E.allocFac(L.sh, facT) : null;
    const lines = E.LINES.map((c) => {
      const o = inc.out?.[c] ?? inc.pp * L.sh[c] * L.e[c], st = c === 'air' ? `ВВС ${num(S.air[P])}` : `запас ${num(q[c])}`;
      const lo = fm ? al[c] <= 0 : L.sh[c] < 0.01, hi = fm ? (al[c] + 1) / facT > 0.851 : L.sh[c] > 0.84;
      return `<div class="e-line"><span class="e-lic">${ic(E.LINE[c].ic)}</span><div class="e-lm"><b>${esc(E.LINE[c].n)}</b><small>+${num(o)} за ход · ${st} · эфф. ${pc(L.e[c])}</small><i class="e-eff"><em style="width:${Math.round(Math.min(1, L.e[c]) * 100)}%"></em></i></div>
<button class="e-ib sm" data-a="lsh" data-c="${c}" data-d="-1" aria-label="Меньше" ${lo ? 'disabled' : ''}>${ic('minus')}</button><b class="e-lsh">${fm ? `${al[c]}<small>${fm ? 'зав.' : ''}</small>` : pc(L.sh[c])}</b><button class="e-ib sm" data-a="lsh" data-c="${c}" data-d="1" aria-label="Больше" ${hi ? 'disabled' : ''}>${ic('plus')}</button></div>`;
    }).join('');
    const qi = my.map((b, i) => {
      const B = E.BUILD[b.k], eta = E.etaOf(S, P, b), act = i < N;
      return `<div class="e-qi ${act ? '' : 'wait'}">${ic(B.ic)}<div class="e-lm"><b>${esc(B.n)}${b.k === 'fort' ? ` ${S.fort[b.r] + 1}` : ''}</b><small><button class="e-lnk" data-a="region" data-r="${b.r}">${esc(nm(M, b.r))}</button> · ${act ? 'строится' : 'ждёт бригаду'} · ≈ ${turnsW(eta)}</small><i class="e-eff q"><em style="width:${Math.round((1 - b.left / b.tot) * 100)}%"></em></i></div>${i ? `<button class="e-ib sm" data-a="qup" data-i="${i}" aria-label="Раньше">${ic('up')}</button>` : '<span class="e-ib sm ph"></span>'}<button class="e-ib sm" data-a="qdel" data-i="${i}" aria-label="Отменить">${ic('close')}</button></div>`;
    }).join('');
    // советы: укрепить угрожаемые участки фронта
    const fd = E.frontDist(S, P), thr = new Float32Array(M.R);
    for (let r = 0; r < M.R; r++) if (fd[r] === 0) for (const e of M.reg[r].nb) for (const u of S.at[e.r]) if (u.s !== P) thr[r] += u.str / 100;
    const sug = [...Array(M.R).keys()].filter((r) => fd[r] === 0 && thr[r] > 0 && E.canBuild(S, P, r, 'fort')).sort((a, b) => thr[b] * (1 + M.reg[b].vp * 0.2) - thr[a] * (1 + M.reg[a].vp * 0.2)).slice(0, 4);
    const B = E.BUILD, r0 = E.bRate0(S, P);
    const pips = Array.from({ length: N }, (_, i) => `<i class="${i < busy ? 'on' : ''}">${ic('spade')}</i>`).join('');
    return `${this.head(ic('mil'), 'Экономика', `${ic('prod')} ${num(inc.pp)} за ход · ${ic('spade')} ${busy}/${N}<span class="e-pc"> бригад</span>`)}<div class="e-pbody grid">
<div class="e-sec"><div class="e-eco"><span>${ic('factory')}<b>${num(facT)}</b><small>военных заводов${facT - inc.fac > 0.5 ? `, в работе ${num(inc.fac)}` : ''}</small></span><span>${ic('spade')}<b>${busy}/${N}</b><small>стройбригад заняты</small></span><span>${ic('men')}<b>+${num(inc.men || 0)}</b><small>люди за ход</small></span></div>
${inc.ll ? `<div class="e-note">${ic('ship')}Ленд-лиз: +${num(inc.ll)} за ход<span class="e-pc"> к военному производству</span></div>` : ''}
<div class="e-brig">${pips}</div></div>
<div class="e-sec"><h4>${ic('prod')}Производство <span class="e-seg"><button class="${fm ? '' : 'on'}" data-a="lmode" data-m="0">%</button><button class="${fm ? 'on' : ''}" data-a="lmode" data-m="1" ${facT > 0 ? '' : 'disabled'}>${ic('factory')}заводы</button></span></h4>
<div class="e-lines">${lines}</div>
<button class="e-row e-toggle ${L.auto ? 'on' : ''}" data-a="lauto">${ic('auto')}<span>Генштаб сам делит производство<small class="e-pc">по составу армии и запасам</small></span><i></i></button>
<div class="e-note e-pc">${ic('info')}${fm ? `Все ${num(facT)} ${facW(facT)} поделены между линиями: «+» переводит завод на линию. ` : ''}Больше доля — ниже эффективность линии (переналадка); затем она растёт на 8 % в неделю. Самолёты пополняют ВВС: норма — 20 %.</div></div>
<div class="e-sec"><h4>${ic('build')}Стройка <small>${my.length ? `в очереди ${my.length}` : ''}</small></h4>
${qi ? `<div class="e-lines">${qi}</div>` : `<div class="e-note">${ic('info')}Очередь пуста<span class="e-pc">. Нажмите на свою область на карте — там кнопки построек.</span></div>`}
${sug.length ? `<h4>${ic('fort')}Укрепить фронт</h4>${sug.map((r) => `<div class="e-li"><button class="e-lnk" data-a="region" data-r="${r}">${ic('city')}${esc(nm(M, r))}</button><span class="e-fl">${'▮'.repeat(S.fort[r])}${'▯'.repeat(3 - S.fort[r])}</span><button class="e-btn sm" data-a="bld" data-r="${r}" data-k="fort">${ic('fort')}<span>${turnsW(E.bTime(S, P, r, 'fort'))}</span></button></div>`).join('')}` : ''}
</div>
${P === 'SOV' && S.evac.length ? `<div class="e-sec"><h4>${ic('train')}Эвакуация</h4>${S.evac.map((e) => `<div class="e-li">${ic('factory')}<span>${esc(M.reg[e.r].n)} → ${esc(M.reg[e.to].n)}</span><small>${turnsW(e.left)}</small></div>`).join('')}</div>` : ''}
<div class="e-sec bare"><button class="e-row e-toggle ${S.auto.build ? 'on' : ''}" data-a="auto" data-k="build">${ic('auto')}<span>${S.peace ? 'Строить заводы самим<small class="e-pc">мирное время: свободными бригадами — в тылу</small>' : 'Строить укрепления и ПВО самим<small class="e-pc">свободными бригадами</small>'}</span><i></i></button>
${P === 'SOV' ? `<button class="e-row e-toggle ${S.flags.evacAuto ? 'on' : ''}" data-a="auto" data-k="evac">${ic('train')}<span>Эвакуировать заводы у фронта</span><i></i></button>` : ''}</div>
<div class="e-sec wide"><h4>${ic('build')}Постройки <small>в карточке своей области</small></h4>
<div class="e-blds">${E.BUILD_ORDER.map((k) => { const b = B[k]; return `<div class="e-bld">${ic(b.ic)}<b>${esc(b.n)}</b><small>${ic('hourglass')}${turnsW(E.bTime0(S, P, k))}</small><small class="e-pc">${esc(b.d)}</small></div>`; }).join('')}</div>
<div class="e-note e-pc">${ic('info')}Одна бригада ведёт один проект. У фронта стройка идёт в 1,5 раза дольше, без железной дороги — в 1,25 раза. Каждый новый завод строится на 12 % дольше прежнего.</div></div>
</div>`;
  },
  // ——— Армия: состав, запасы, призыв → обучение → резерв Ставки → фронт ———
  pArmy() {
    const S = this.S, P = this.P, M = this.M, q = S.eq[P];
    const by = {}; let n = 0, str = 0, pocket = 0;
    for (const u of S.units) if (E.alive(u) && u.s === P) { by[u.t] = (by[u.t] || 0) + 1; n++; str += u.str; if (S.sup[P][u.r] <= 0) pocket++; }
    const coming = S.units.filter((u) => !u.dead && u.s === P && u.r < 0 && u.arr !== undefined && !u.pw);
    const late = S.peace ? coming.filter((u) => u.arr > 0).length : 0; // мирное время: второй эшелон 1941 г. (после 22 июня)
    const plan = S.peace ? S.units.filter((u) => !u.dead && u.s === P && u.r < 0 && u.pw).length : 0; // мирное время: план формирования
    const types = ['arm', 'mot', 'inf', 'mtn', 'cav', 'sec', 'abn'].filter((t) => by[t]);
    const canT = (P === 'SOV' ? ['inf', 'mtn', 'cav', 'mot', 'arm', 'abn'] : ['inf', 'mtn', 'mot', 'arm', 'abn']).filter((t) => TYPES[t] && (t !== 'abn' || this.canAbn?.()));
    const capN = E.armyCap(S, P), size = E.armySize(S, P), full = size >= capN;
    const fronts = frontsOn(S, P), fsh = (f) => frontShort(S.fr[P][f].n), fdot = (f) => `<i class="e-dot" style="background:${FRONT_COL[S.fr[P][f].col]}"></i>`;
    // — резерв Ставки —
    const res = A.inRes(S, P), rby = {};
    for (const u of res) (rby[u.t] ??= []).push(u);
    const rs = (this.rsel ??= {}), rT = Object.keys(rby);
    let selN = 0;
    for (const t of rT) { rs[t] = Math.min(rs[t] ?? rby[t].length, rby[t].length); selN += rs[t]; }
    const rsF = fronts.includes(this.rsF) ? this.rsF : A.needFront(S, P);
    const resH = res.length ? `<h4>${ic('star')}${esc(A.resName(P))} <small>${res.length} ${divW(res.length)} · готовы к отправке</small></h4>
<div class="e-rcs">${rT.map((t) => `<div class="e-rc ${rs[t] ? 'on' : ''}"><img src="${counterURL(P, t)}" alt=""><div class="e-lm"><b>${esc(TYPES[t].n)}</b><small>в резерве: ${rby[t].length}</small></div><button class="e-ib sm" data-a="rsn" data-t="${t}" data-d="-1" aria-label="Меньше" ${rs[t] ? '' : 'disabled'}>${ic('minus')}</button><b class="e-lsh">${rs[t]}</b><button class="e-ib sm" data-a="rsn" data-t="${t}" data-d="1" aria-label="Больше" ${rs[t] < rby[t].length ? '' : 'disabled'}>${ic('plus')}</button></div>`).join('')}</div>
<div class="e-zsel">${fronts.map((f) => `<button class="e-zc ${rsF === f ? 'on' : ''}" data-a="rsf" data-z="${f}">${fdot(f)}${esc(fsh(f))}</button>`).join('')}</div>
<button class="e-btn gold e-wide" data-a="rsgo" ${selN ? '' : 'disabled'}>${ic('train')}<span>Отправить ${selN} ${divW(selN)}: ${esc(fsh(rsF))} · ${turnsW(A.sendT(rsF))}</span></button>` : '';
    // — в обучении —
    const ords = A.orders(S, P), dstN = (d) => (d === -2 ? 'авто: где нужнее' : d >= 0 ? `→ ${fsh(d)}` : `→ ${A.resTo(P)}`);
    const trH = ords.length ? `<h4>${ic('hourglass')}Обучение <small>${ords.reduce((a, o) => a + o.n, 0)} ${divW(ords.reduce((a, o) => a + o.n, 0))}</small></h4><div class="e-lines">${ords.map((o) => `<div class="e-qi"><img class="e-qimg" src="${counterURL(P, o.t)}" alt=""><div class="e-lm"><b>${o.n} × ${esc(TYPES[o.t].n)}</b><small>${o.camp >= 0 ? `${ic('camp')}${esc(nm(M, o.camp))} · ` : ''}ещё ${turnsW(o.left)} · ${esc(dstN(o.dst))}</small><i class="e-eff q"><em style="width:${Math.round((1 - o.left / Math.max(1, o.tot)) * 100)}%"></em></i></div><button class="e-ib sm" data-a="rqdel" data-o="${o.ord}" aria-label="Отменить">${ic('close')}</button></div>`).join('')}</div>` : '';
    // — призыв: заказ (род × число), где учить, куда после обучения —
    const rq = (this.rq ??= {}), camps = this.camps(), camp = camps.includes(this.rqC) ? this.rqC : -1, dst = this.rqDst === -2 || fronts.includes(this.rqDst) ? this.rqDst : -1;
    const tot = { n: 0, pp: 0, men: 0 }, need = { inf: 0, art: 0, arm: 0 };
    const add = (o, t, k) => { const c = E.newCost(P, t), m = E.EQS[t] || E.EQS.inf; o.n += k; o.pp += k * c.pp; o.men += k * c.men; for (const x in m) need[x] += k * c.pp * m[x]; };
    for (const t of canT) if (rq[t]) add(tot, t, rq[t]);
    const fits = (t) => { const c = E.newCost(P, t), m = E.EQS[t] || E.EQS.inf; if (size + tot.n + 1 > capN || S.men[P] + 1e-6 < tot.men + c.men) return false; for (const x in m) if (q[x] + 1e-6 < need[x] + c.pp * m[x]) return false; return true; };
    const recB = canT.map((t) => {
      const c = E.newCost(P, t), k = rq[t] || 0, m = E.EQS[t] || E.EQS.inf, miss = Object.keys(m).filter((x) => q[x] + 1e-6 < c.pp * m[x]);
      return `<div class="e-rc ${k ? 'on' : ''}"><img src="${counterURL(P, t)}" alt=""><div class="e-lm"><b>${esc(TYPES[t].n)}</b><small>${ic('equip')}${num(c.pp)} ${ic('men')}${num(c.men)} · ${ic('hourglass')}${turnsW(A.trainT(t, camp >= 0))}${miss.length ? ` · <em class="e-miss">нет ${esc(EQN[miss[0]])}</em>` : ''}</small></div><button class="e-ib sm" data-a="rqn" data-t="${t}" data-d="-1" aria-label="Меньше" ${k ? '' : 'disabled'}>${ic('minus')}</button><b class="e-lsh">${k}</b><button class="e-ib sm" data-a="rqn" data-t="${t}" data-d="1" aria-label="Больше" ${fits(t) ? '' : 'disabled'}>${ic('plus')}</button></div>`;
    }).join('');
    const ok = tot.n > 0 && size + tot.n <= capN && S.men[P] + 1e-6 >= tot.men && ['inf', 'art', 'arm'].every((x) => q[x] + 1e-6 >= need[x]);
    return `${this.head(ic('helmet'), 'Армия', `${n} ${divW(n)} · ${ic('men')}${n ? Math.round(str / n) : 0}%<span class="e-pc"> штата</span>`)}<div class="e-pbody grid">
<div class="e-sec"><h4>${ic('helmet')}Состав <small>${n} ${divW(n)}</small></h4><div class="e-types">${types.map((t) => `<div class="e-type"><img src="${counterURL(P, t)}" alt=""><b>${by[t]}</b><small>${esc(TYPES[t].sh)}</small></div>`).join('')}</div>
${pocket ? `<div class="e-warn">${ic('encircle')}В окружении: ${pocket} ${divW(pocket)}</div>` : ''}
${coming.length - late ? `<div class="e-note">${ic('train')}В пути на фронт: ${coming.length - late} ${divW(coming.length - late)}</div>` : ''}
${late ? `<div class="e-note">${ic('train')}Второй эшелон: ${late} ${divW(late)} — подойдут к фронту после начала войны</div>` : ''}
${plan ? `<div class="e-note">${ic('calendar')}По плану к 22.06.1941 — ещё ${plan} ${divW(plan)}<span class="e-pc">: появятся сами, по датам истории</span></div>` : ''}</div>
<div class="e-sec"><h4>${ic('warship')}Флот <small><button class="e-lnk" data-a="fleet">${ic('ship')}моря и базы</button></small></h4>
<div class="e-zsel">${SEAS.map((n) => { const d = seaDom(S, n, P) ?? 0.5; return `<button class="e-zc" data-a="fleet" data-sea="${esc(n)}">${ic('ship')}${esc(n.replace(/ море$/, ''))}<b class="${d >= 0.6 ? 'good' : d <= 0.4 ? 'bad' : ''}">${Math.round(d * 100)} %</b></button>`; }).join('')}</div>
</div>
<div class="e-sec"><h4>${ic('equip')}Снаряжение и люди <small><button class="e-lnk" data-a="eco">${ic('prod')}производство</button></small></h4>
<div class="e-eco e4"><span>${ic('rifle')}<b>${num(q.inf)}</b><small>стрелковое</small></span><span>${ic('art')}<b>${num(q.art)}</b><small>артиллерия</small></span><span>${ic('tank')}<b>${num(q.arm)}</b><small>танки</small></span><span>${ic('men')}<b>${num(S.men[P])}</b><small>люди</small></span></div></div>
${resH ? `<div class="e-sec">${resH}</div>` : ''}${trH ? `<div class="e-sec">${trH}</div>` : ''}
<div class="e-sec"><h4>${ic('plus')}Призыв <small>армия ${size}/${capN}</small></h4>
${S.peace ? `<div class="e-note">${ic('dove')}Мирное время: сверх плана формирования — не больше ${PEACE_EXTRA[P]} ${divW(PEACE_EXTRA[P])}${full ? ' (предел достигнут)' : ''}.</div>`
    : full ? `<div class="e-note">${ic('info')}Армия у предела: ${capN} ${divW(capN)}. Предел растёт с мобилизацией, запасы идут на пополнение.</div>` : ''}
<div class="e-rcs">${recB}</div>
<div class="e-sub">${ic('camp')}Где обучать</div>
<div class="e-zsel"><button class="e-zc ${camp < 0 ? 'on' : ''}" data-a="rqc" data-r="-1">В тылу</button>${camps.map((r) => `<button class="e-zc ${camp === r ? 'on' : ''}" data-a="rqc" data-r="${r}">${ic('camp')}${esc(nm(M, r))}</button>`).join('')}</div>
<div class="e-sub">${ic('flag')}После обучения</div>
<div class="e-zsel"><button class="e-zc ${dst === -1 ? 'on' : ''}" data-a="rqd" data-z="-1">${ic('star')}В резерв</button><button class="e-zc ${dst === -2 ? 'on' : ''}" data-a="rqd" data-z="-2">${ic('auto')}Авто</button>${fronts.map((f) => `<button class="e-zc ${dst === f ? 'on' : ''}" data-a="rqd" data-z="${f}">${fdot(f)}${esc(fsh(f))}</button>`).join('')}</div>
<button class="e-btn gold e-wide" data-a="rqgo" ${ok ? '' : 'disabled'}>${ic('helmet')}<span>${tot.n ? `Обучить ${tot.n} ${divW(tot.n)} · ${ic('equip')}${num(tot.pp)} ${ic('men')}${num(tot.men)}` : 'Нажмите + у рода войск'}</span></button>
<div class="e-note e-pc">${ic('info')}Обучение — ${camp >= 0 ? 'в лагере на неделю быстрее, дивизии опытнее' : 'в учебном лагере на неделю быстрее и опытнее'}. Обученные дивизии ждут в резерве, пока вы не отправите их на фронт (1–2 недели по железной дороге).</div></div>
<div class="e-sec bare wide"><button class="e-row e-toggle ${S.auto.recruit ? 'on' : ''}" data-a="auto" data-k="recruit">${ic('auto')}<span>Генштаб сам формирует дивизии<small class="e-pc">сразу в тыл фронтов, где нужнее</small></span><i></i></button></div>
</div>`;
  },
  // учебные лагеря стороны со снабжением
  camps() { const S = this.S, P = this.P, out = []; for (let r = 0; r < this.M.R; r++) if (S.camp[r] && E.sideOf(S, r) === P && S.sup[P][r] > 0) out.push(r); return out; },
  doOrder() {
    const S = this.S, P = this.P, rq = this.rq || {}, camps = this.camps(), camp = camps.includes(this.rqC) ? this.rqC : -1;
    const fronts = frontsOn(S, P), dst = this.rqDst === -2 || fronts.includes(this.rqDst) ? this.rqDst : -1;
    let n = 0, w = 0;
    for (const t of Object.keys(rq)) { if (!rq[t]) continue; const us = A.order(S, P, t, rq[t], camp, dst); n += us.length; if (us.length) w = Math.max(w, us[0].trn); }
    if (!n) { this.snd.play('error'); return this.toast(`${ic('cancel')}${E.armySize(S, P) >= E.armyCap(S, P) ? 'Армия у предела численности' : 'Не хватает снаряжения или людей'}`); }
    this.rq = {};
    this.snd.play('build');
    this.toast(`${ic('helmet')}Обучение: ${n} ${divW(n)}, ≈ ${turnsW(w)}`);
    this.refresh();
  },
  doSend() {
    const S = this.S, P = this.P, res = A.inRes(S, P), rs = this.rsel || {}, fronts = frontsOn(S, P), f = fronts.includes(this.rsF) ? this.rsF : A.needFront(S, P);
    let n = 0;
    const left = {};
    for (const u of res) { left[u.t] ??= rs[u.t] ?? Infinity; if (left[u.t] > 0 && A.send(S, u, f)) { left[u.t]--; n++; } }
    if (!n) { this.snd.play('error'); return; }
    this.rsel = {};
    this.snd.play('build');
    this.toast(`${ic('train')}${n} ${divW(n)} — ${esc(frontShort(S.fr[P][f].n))}, ≈ ${turnsW(A.sendT(f))}`);
    this.refresh();
  },
  // ——— постройки в карточке области ———
  bGrid(r) {
    const S = this.S, P = this.P, M = this.M, B = E.BUILD;
    const lv = { fac: S.fac[r], fort: S.fort[r], aa: S.aa[r], afd: S.afd[r], camp: S.camp[r], dep: S.dep[r] };
    const home = E.sideOf(S, r) === P;
    if (!home) {
      const has = E.BUILD_ORDER.filter((k) => lv[k]);
      return has.length ? `<div class="e-bl">${has.map((k) => `<span title="${esc(B[k].n)}">${ic(B[k].ic)}${k === 'fac' || k === 'fort' ? `<b>${lv[k]}</b>` : ''}</span>`).join('')}</div>` : '';
    }
    const tiles = E.BUILD_ORDER.map((k) => {
      const b = S.q.find((x) => x.r === r && x.k === k), why = E.whyNot(S, P, r, k);
      const lvl = k === 'fort' ? `${lv[k]}/3` : k === 'fac' ? `${lv[k]}` : lv[k] ? ic('check') : '';
      const st = b ? `<em>${ic('hourglass')}≈ ${turnsW(E.etaOf(S, P, b))}${E.isActive(S, b) ? '' : ', ждёт'}</em><i class="e-bp"><i style="width:${Math.round((1 - b.left / b.tot) * 100)}%"></i></i>` : why ? `<em class="no">${esc(why)}</em>` : `<em>${ic('spade')}${E.bTime(S, P, r, k)} нед.</em>`;
      return `<button class="e-bt ${lv[k] ? 'has' : ''}" data-a="bld" data-r="${r}" data-k="${k}" ${b || why ? 'disabled' : ''}>${ic(B[k].ic)}<b>${lvl}</b><small>${esc(B[k].n)}</small>${st}</button>`;
    }).join('');
    const sl = E.slots(S, r), us = E.used(S, r), land = SIDE0[M.nats[S.own0[r]]] === P, N = E.brigN(S, P), busy = E.brigBusy(S, P);
    return `<div class="e-bgrid">${tiles}</div><div class="e-bsub">${ic('factory')}${land ? `Места под заводы: ${us} из ${sl}` : 'Занятая земля: заводы здесь не строят'}</div><div class="e-bsub">${ic('spade')}Стройбригады: ${busy} из ${N} заняты${busy >= N ? ' — новый проект подождёт в очереди' : ''}</div>`;
  },
  doBuild(r, k) {
    const S = this.S, P = this.P;
    if (!E.build(S, P, r, k)) { this.snd.play('error'); return this.toast(`${ic('cancel')}${esc(E.whyNot(S, P, r, k) || 'Нельзя построить')}`); }
    this.snd.play('build');
    const b = S.q[S.q.length - 1];
    this.toast(`${ic(E.BUILD[k].ic)}${esc(E.BUILD[k].n)}: ${esc(nm(this.M, r))}, ≈ ${turnsW(E.etaOf(S, P, b))}${E.isActive(S, b) ? '' : ' (ждёт бригаду)'}`);
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
  lsh(b) { this.snd.play('select'); const L = this.S.line[this.P], F = L.fm ? this.facTot() : 0; E.shiftLine(this.S, this.P, b.dataset.c, +b.dataset.d, F); this.renderPanel(); },
  lmode(b) { this.snd.play('select'); this.S.line[this.P].fm = +b.dataset.m; this.renderPanel(); },
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
  rqn(b) { this.snd.play('select'); const rq = (this.rq ??= {}), t = b.dataset.t; rq[t] = Math.max(0, (rq[t] || 0) + +b.dataset.d); this.renderPanel(); },
  rqc(b) { this.snd.play('select'); this.rqC = +b.dataset.r; this.renderPanel(); },
  rqd(b) { this.snd.play('select'); this.rqDst = +b.dataset.z; this.renderPanel(); },
  rqgo() { this.doOrder(); },
  rqdel(b) { const n = A.cancelOrder(this.S, this.P, +b.dataset.o); if (n) { this.snd.play('click'); this.toast(`${ic('cancel')}Обучение отменено: ${n} ${divW(n)}, снаряжение и люди возвращены`); } this.refresh(); },
  rsn(b) { this.snd.play('select'); const rs = (this.rsel ??= {}), t = b.dataset.t, have = A.inRes(this.S, this.P).filter((u) => u.t === t).length; rs[t] = Math.max(0, Math.min(have, (rs[t] ?? have) + +b.dataset.d)); this.renderPanel(); },
  rsf(b) { this.snd.play('select'); this.rsF = +b.dataset.z; this.renderPanel(); },
  rsgo() { this.doSend(); },
};
