// «Мировой фронт» v0.11, «Восточный фронт»: операции в интерфейсе — кнопки «Морской десант» и «Воздушный десант»
// в карточке своей области, выбор цели на карте (красные области), подтверждение с шансами и сам десант.
import * as O from './ops.js';
import * as E from './engine.js';
import { hasU } from './tech.js';
import { other, divW } from './rules.js';
import { esc, ic, flagHTML, weeksW } from './kit.js';

const nm = (M, r) => M.reg[r].city?.n || M.reg[r].n;
export const OpsUI = {
  opBtns(r) {
    const S = this.S, P = this.P, out = [];
    for (const kind of ['sea', 'abn']) {
      const K = O.OPS[kind];
      if (!hasU(S, P, kind)) continue;
      if (kind === 'sea' && !O.isPort(S, r)) continue;
      if (kind === 'abn' && (!S.afd[r] || !S.at[r].some((u) => u.s === P && u.t === 'abn'))) continue;
      const why = O.opWhy(S, P, kind, r), n = why ? 0 : O.opUnits(S, P, kind, r).length;
      out.push(`<button class="e-btn sm" data-a="op" data-k="${kind}" data-r="${r}" ${why ? 'disabled' : ''}>${ic(K.ic)}<span>${esc(K.n)}<small>${esc(why || `${n} ${divW(n)} · целей: ${O.opTargets(S, P, kind, r).length}`)}</small></span></button>`);
    }
    return out.join('');
  },
  startOp(kind, r) {
    const S = this.S, P = this.P, M = this.M, K = O.OPS[kind];
    const why = O.opWhy(S, P, kind, r);
    if (why) { this.snd.play('error'); return this.toast(`${ic('cancel')}${esc(why)}`); }
    const us = O.opUnits(S, P, kind, r), tg = new Set(O.opTargets(S, P, kind, r));
    this.opSel = { kind, r, us, tg };
    this.closePanel();
    this.map.setHL({ sel: r, reach: null, atk: tg, pick: null });
    // показать источник и все цели
    let x0 = M.reg[r].x, x1 = x0, y0 = M.reg[r].y, y1 = y0;
    for (const t of tg) { const g = M.reg[t]; x0 = Math.min(x0, g.x); x1 = Math.max(x1, g.x); y0 = Math.min(y0, g.y); y1 = Math.max(y1, g.y); }
    const mp = this.map, sc = Math.max(0.22, Math.min(mp.view.sc, Math.min(mp.w / (x1 - x0 + 260), mp.h / (y1 - y0 + 320))));
    mp.flyTo((x0 + x1) / 2, (y0 + y1) / 2, sc);
    this.modeBar(`${ic(K.ic)}<span>${esc(K.n)}: ${us.length} ${divW(us.length)} — выберите цель (красные)</span>`);
  },
  tapOp(t) {
    const { kind, r, tg } = this.opSel;
    if (t < 0 || t === r) return this.cancelMode(true);
    if (!tg.has(t)) { this.snd.play('error'); return this.toast(`${ic('target')}Цель — красные области`); }
    this.snd.play('select');
    this.opConfirm(kind, r, t);
  },
  opConfirm(kind, r, t) {
    const S = this.S, P = this.P, M = this.M, K = O.OPS[kind], us = this.opSel?.us?.filter(E.alive) || O.opUnits(S, P, kind, r);
    const o = O.opOdds(S, P, kind, r, t, us), al = kind === 'abn' ? O.airLoss(S, P, t) : 0;
    const R = o.R, lab = o.free ? ['Без боя', 'good'] : R >= 1.6 ? ['Высокие шансы', 'good'] : R >= 1.2 ? ['Хорошие шансы', 'good'] : R >= 0.95 ? ['Равные силы', 'warn'] : ['Низкие шансы', 'bad'];
    const w = o.free ? 95 : Math.max(5, Math.min(95, (R / (R + 1)) * 100)), en = S.at[t].filter((v) => v.s !== P).length;
    this.opPend = { kind, r, t, us };
    this.modal(`<h2>${ic(K.ic)} ${esc(K.n)}</h2>
<p class="e-opr">${esc(nm(M, r))} ${ic('right')} <b>${esc(nm(M, t))}</b></p>
<div class="e-units sm">${us.map((u) => `<span class="e-tag">${esc(u.n)} · ${Math.round(u.str)}%</span>`).join('')}</div>
<div class="e-odds ${lab[1]}"><div class="e-oh">${ic('atk')}<b>${lab[0]}</b><small>${o.free ? 'область никто не защищает' : `×${R.toFixed(1)}`}</small></div>
<div class="e-force"><span>${flagHTML(P, 'xs')}${us.length}</span><i><em style="width:${w}%"></em></i><span>${en}${E.garOf(S, t, P) > 0 || O.coastDef(S, P, kind, t) ? '+' + ic('fort') : ''}${flagHTML(E.natOf(S, t), 'xs')}</span></div></div>
${al ? `<p class="e-note warn">${ic('air')}Слабое прикрытие с воздуха: потери до ${al} % ещё в полёте</p>` : ''}
<p class="e-note">${ic('info')}${kind === 'sea' ? 'Высадка с моря слабее обычной атаки, порт защищают береговые батареи.' : 'Десант с воздуха слабее обычной атаки, но может ударить глубоко в тыл.'} Плацдарм снабжается ${kind === 'sea' ? 'морем' : 'по воздуху'} ${weeksW(kind === 'sea' ? 5 : 3)}; следующая операция — через ${weeksW(K.cd)}.</p>
<div class="e-btns"><button class="e-btn" data-a="close">${ic('cancel')}<span>Отмена</span></button><button class="e-btn ${o.free || R >= 1.2 ? 'gold' : 'warn'}" data-a="opgo">${ic(K.ic)}<span>${kind === 'sea' ? 'Высадка' : 'Выброска'}</span></button></div>`, { cls: 'op' });
  },
  execOp() {
    const S = this.S, P = this.P, M = this.M, p = this.opPend;
    this.closeModal();
    this.opPend = null;
    this.cancelMode(true);
    if (!p) return;
    const n0 = S.battles.length;
    const res = O.runOp(S, P, p.kind, p.r, p.t, p.us);
    if (!res) { this.snd.play('error'); return this.toast(`${ic('cancel')}Войска не готовы`); }
    for (const u of p.us) u.man = 1;
    this.snd.play('attack');
    this.map.showBattles(S.battles.slice(n0), 5000);
    const t = esc(nm(M, p.t)), K = O.OPS[p.kind];
    setTimeout(() => {
      if (res.win) { this.snd.play('win'); this.toast(`${ic(K.ic)}${t}: ${res.free ? 'высадка без боя' : 'плацдарм захвачен!'}${res.air ? ` Потери в полёте: ${res.air} %.` : ''}`, 'good'); }
      else { this.snd.play('lose'); this.toast(`${ic('def')}${t}: десант отбит${res.lost ? `, погибло ${res.lost} ${divW(res.lost)}` : ''}`, 'bad'); }
    }, 450);
    this.refresh();
    if (res.win) { this.map.setHL({ sel: p.t }); this.openPanel('reg', p.t); }
  },
};
export const OPS_ACT = {
  op(b) { this.snd.play('click'); return this.startOp(b.dataset.k, +b.dataset.r); },
  opgo() { return this.execOp(); },
};
