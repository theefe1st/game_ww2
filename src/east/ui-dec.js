// «Мировой фронт» v0.11 (отзыв 04.11, шаг 6.6): панель «Решения» по кнопке ★ — действующие решения, доступные
// (цена ★, эффект, выбор фронта для наступления), позже (когда и почему), принятые; «решения из истории — сами».
import * as Dc from './decisions.js';
import { polOf } from './eco.js';
import { frontsOn } from './ai.js';
import { frontShort } from './ui-fronts.js';
import { FRONT_COL } from './map.js';
import { fmtShort } from './rules.js';
import { esc, ic, num, weeksW } from './kit.js';

const f1 = (x) => String(Math.round(x * 10) / 10).replace('.', ',');
export const DecUI = {
  decFront() {
    const S = this.S, P = this.P, fs = frontsOn(S, P);
    if (fs.includes(this.decZ)) return this.decZ;
    return fs.find((f) => S.post[P][f] === 'atk') ?? (fs.includes(2) ? 2 : fs[0]);
  },
  pDec() {
    const S = this.S, P = this.P, pol = S.pol?.[P] || 0, z = this.decFront(), fronts = frontsOn(S, P);
    Dc.decViewed(S, P);
    const L = Dc.decOf(P, S).map((D) => ({ D, s: Dc.decStat(S, P, D) }));
    const act = (S.dfx || []).filter((x) => x.side === P && x.until > S.turn);
    const fdot = (f) => `<i class="e-dot" style="background:${FRONT_COL[S.fr[P][f].col]}"></i>`;
    const card = ({ D, s }) => {
      const tag = s.k === 'pol' ? `<span class="e-tag warn">${ic('pol')}${esc(s.why)}</span>`
        : s.k === 'cd' ? `<span class="e-tag">${ic('hourglass')}снова через ${weeksW(s.left)}</span>`
          : s.k === 'lock' ? `<span class="e-tag">${ic('calendar')}${esc(s.why)}</span>` : '';
      const pick = D.pick === 'front' && s.k === 'ok' ? `<div class="e-zsel">${fronts.map((f) => `<button class="e-zc ${z === f ? 'on' : ''}" data-a="dz" data-z="${f}">${fdot(f)}${esc(frontShort(S.fr[P][f].n))}</button>`).join('')}</div>` : '';
      const btn = s.k === 'ok' || s.k === 'pol' ? `<button class="e-btn sm gold" data-a="dgo" data-id="${D.id}" ${s.k === 'ok' ? '' : 'disabled'}>${ic('pol')}<span>${D.cost}</span></button>` : `<span class="e-dcost">${ic('pol')}${D.cost}</span>`;
      const hist = D.hist ? `<span class="e-tag">${ic('book')}по истории: ${Dc.isoTxt(D.hist)}</span>` : '';
      return `<div class="e-dc k-${s.k}"><div class="e-dct"><span class="e-lic">${ic(D.ic)}</span><div class="e-lm"><b>${esc(D.n)}${D.cd ? `<em>раз в ${weeksW(D.cd)}</em>` : ''}</b><small>${esc(Dc.decText(S, D))}</small></div>${btn}</div>${pick}${tag || hist ? `<div class="e-tags">${tag}${hist}</div>` : ''}</div>`;
    };
    const ok = L.filter((x) => x.s.k === 'ok' || x.s.k === 'pol').sort((a, b) => (a.s.k === 'ok' ? 0 : 1) - (b.s.k === 'ok' ? 0 : 1) || a.D.cost - b.D.cost);
    const later = L.filter((x) => x.s.k === 'cd' || x.s.k === 'lock');
    const done = L.filter((x) => x.s.k === 'done' || x.s.k === 'gone');
    const actH = act.length ? `<h4>${ic('bolt')}Действуют</h4><div class="e-chips">${act.map((x) => { const D = Dc.DECM.get(x.id); return D ? `<span class="e-chip on">${ic(D.ic)}${esc(D.n)}${x.z !== undefined ? ` · ${esc(frontShort(S.fr[P][x.z].n))}` : ''}<small>${weeksW(x.until - S.turn)}</small></span>` : ''; }).join('')}</div>` : '';
    const evN = Dc.decOf(P, S).filter((D) => D.ev).map((D) => D.n).join(', ');
    return `${this.head(ic('pol'), 'Решения', `★ ${num(pol)} · +${f1(polOf(S, P))} в неделю`)}<div class="e-pbody">
${actH}
${ok.length ? `<h4>${ic('dec')}Можно принять</h4><div class="e-dcs">${ok.map(card).join('')}</div>` : ''}
${later.length ? `<h4>${ic('hourglass')}Позже</h4><div class="e-dcs">${later.map(card).join('')}</div>` : ''}
${done.length ? `<h4>${ic('check')}Принятые</h4><div class="e-chips">${done.map(({ D, s }) => `<span class="e-chip ${s.k}">${ic(s.k === 'done' ? 'check' : 'cancel')}${esc(D.n)}${s.k === 'done' && s.at >= 0 ? `<small>${fmtShort(s.at)}</small>` : '<small>время прошло</small>'}</span>`).join('')}</div>` : ''}
<button class="e-row e-toggle ${S.auto?.dec ? 'on' : ''}" data-a="dauto">${ic('auto')}<span>Решения истории — сами<small>${esc(evN)} — в даты истории, если хватит ★</small></span><i></i></button>
<div class="e-note">${ic('info')}★ — политическая власть: копится каждую неделю. Тратится на решения и на просьбы генералов (приоритет снабжения).</div>
</div>`;
  },
};
export const DEC_ACT = {
  dec() {
    this.snd.play('click');
    if (this.panelKind === 'dec' && !this.$('.e-panel').classList.contains('hidden')) return this.closePanel();
    this.tipSeen?.('dec');
    this.openPanel('dec');
    this.refresh();
  },
  dz(b) { this.snd.play('select'); this.decZ = +b.dataset.z; this.renderPanel(); },
  dgo(b) {
    const S = this.S, P = this.P, id = b.dataset.id, D = Dc.DECM.get(id);
    const r = D && Dc.takeDec(S, P, id, D.pick === 'front' ? this.decFront() : -1);
    if (!r) { this.snd.play('error'); return this.toast(`${ic('cancel')}Сейчас нельзя`); }
    this.snd.play('build');
    this.toast(`${ic(D.ic)}${esc(D.n)}${r.sub ? `: ${esc(r.sub)}` : ''}`);
    this.refresh();
  },
  dauto() { this.snd.play('select'); this.S.auto.dec = !this.S.auto.dec; this.renderPanel(); },
};
