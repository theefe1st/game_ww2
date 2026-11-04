// «Мировой фронт» v0.11, «Восточный фронт»: панель «Наука» — слоты исследований, 8 веток по 4 технологии,
// подробности выбранной технологии (эффект, исторический срок, недели), сравнение с историей, «авто».
import * as Tc from './tech.js';
import { yearF } from './rules.js';
import { esc, ic, weeksW } from './kit.js';

const MON = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
export const ym = (y) => `${MON[Math.min(11, Math.floor((y - Math.floor(y)) * 12))]} ${Math.floor(y)}`;
const pc = (x) => `${Math.round(Math.min(1, x) * 100)}%`;
export const SciUI = {
  canAbn() { return Tc.hasU(this.S, this.P, 'abn'); },
  sciFree() { const S = this.S, P = this.P, X = S.tech?.[P]; if (!X) return 0; const n = Tc.slotsOf(S, P); let f = 0; for (let i = 0; i < n; i++) if (!X.cur[i]) f++; return f; },
  pSci() {
    const S = this.S, P = this.P, X = S.tech[P], n = Tc.slotsOf(S, P), y = yearF(S.turn);
    const busy = X.cur.slice(0, n).filter(Boolean).length;
    const slots = [];
    for (let i = 0; i < n; i++) {
      const k = X.cur[i], t = k && Tc.TK[k];
      slots.push(t ? `<div class="e-line e-sl"><span class="e-lic">${ic(Tc.TB[t.b].ic)}</span><div class="e-lm"><b>${esc(Tc.techName(t, P))}</b><small>${esc(Tc.TB[t.b].n)} · ≈ ${weeksW(Tc.weeksLeft(S, P, k))}${t.y > y + 0.05 ? ' · раньше истории' : ''}</small><i class="e-eff"><em style="width:${pc(X.p[k] || 0)}"></em></i></div><button class="e-ib sm" data-a="tstop" data-i="${i}" aria-label="Остановить">${ic('close')}</button></div>`
        : `<div class="e-line e-sl free"><span class="e-lic">${ic('sci')}</span><div class="e-lm"><b>Свободный слот</b><small>${X.auto ? 'Генштаб выберет сам в конце хода' : 'выберите технологию ниже'}</small></div></div>`);
    }
    // против истории
    const good = {}, bad = {};
    for (const [k, v] of Object.entries(X.fx || {})) (v > 0 ? good : bad)[k] = v;
    const vs = Object.keys(good).length || Object.keys(bad).length
      ? `${Object.keys(good).length ? `<span class="e-tag good">${ic('up')}${esc(Tc.fxText(good))}</span>` : ''}${Object.keys(bad).length ? `<span class="e-tag bad">${ic('down')}${esc(Tc.fxText(bad))}</span>` : ''}`
      : `<span class="e-tag">${ic('check')}Как в истории</span>`;
    const sel = this.sciSel && Tc.TK[this.sciSel] ? this.sciSel : null;
    const rows = Tc.TB_ORDER.map((b) => {
      const ts = Tc.TECH.filter((t) => t.b === b);
      const nd = ts.filter((t) => X.done.includes(t.k)).length;
      const tiles = ts.map((t) => {
        const done = X.done.includes(t.k), cur = X.cur.slice(0, n).includes(t.k), can = Tc.canStart(S, P, t.k);
        const st = done ? 'done' : cur ? 'cur' : can ? 'can' : 'lock';
        return `<button class="e-tt ${st}${sel === t.k ? ' sel' : ''}" data-a="tsel" data-k="${t.k}"><b>${esc(Tc.techName(t, P))}</b><small>${done ? `${ic('check')}изучено` : cur ? `${ic('hourglass')}${pc(X.p[t.k] || 0)}` : ym(t.y)}</small>${cur ? `<i class="e-bp"><i style="width:${pc(X.p[t.k] || 0)}"></i></i>` : ''}</button>`;
      }).join('');
      let det = '';
      if (sel && Tc.TK[sel].b === b) {
        const t = Tc.TK[sel], done = X.done.includes(sel), cur = X.cur.slice(0, n).indexOf(sel), can = Tc.canStart(S, P, sel), wk = Tc.weeksLeft(S, P, sel), pen = Tc.penOf(S, sel);
        const free = X.cur.slice(0, n).findIndex((c, j) => j < n && !c) >= 0 || X.cur.length < n;
        const prev = t.i > 0 ? Tc.TECH.find((x) => x.b === t.b && x.i === t.i - 1) : null;
        let act = '';
        if (done) act = `<span class="e-tag good">${ic('check')}Изучено</span>`;
        else if (cur >= 0) act = `<button class="e-btn sm" data-a="tstop" data-i="${cur}">${ic('close')}<span>Остановить<small>прогресс сохранится</small></span></button>`;
        else if (!can) act = `<span class="e-tag">${ic('cancel')}Сначала: ${esc(Tc.techName(prev, P))}</span>`;
        else if (free) act = `<button class="e-btn sm gold" data-a="tgo" data-k="${sel}">${ic('sci')}<span>Изучать<small>≈ ${weeksW(wk)}</small></span></button>`;
        else act = `<div class="e-trep"><small>Все слоты заняты. Заменить:</small>${X.cur.slice(0, n).map((c, i) => `<button class="e-btn sm" data-a="tgo" data-k="${sel}" data-i="${i}">${ic('swap')}<span>${esc(Tc.techName(Tc.TK[c], P))}</span></button>`).join('')}</div>`;
        det = `<div class="e-td"><b>${esc(Tc.techName(t, P))}</b><small>${esc(Tc.techHint(t, P) || '')}</small>
<div class="e-tags"><span class="e-tag gold">${ic('upgrade')}${esc(Tc.fxText(Tc.techFx(t, P)))}</span><span class="e-tag">${ic('calendar')}по истории: ${ym(t.y)}</span>${done ? '' : `<span class="e-tag ${pen > 1.05 ? 'warn' : pen < 0.95 ? 'good' : ''}">${ic('hourglass')}${weeksW(wk)}${pen > 1.05 ? ` (раньше истории: ×${String(Math.round(pen * 10) / 10).replace('.', ',')})` : pen < 0.95 ? ' (догоняем историю)' : ''}</span>`}</div>
<div class="e-acts">${act}</div></div>`;
      }
      return `<div class="e-tbr"><h5>${ic(Tc.TB[b].ic)}${esc(Tc.TB[b].n)}<small>${nd}/${ts.length}</small></h5><div class="e-trow">${tiles}</div>${det}</div>`;
    }).join('');
    return `${this.head(ic('sci'), 'Наука', `исследования: ${busy} из ${n} · изучено ${X.done.length} из ${Tc.TECH.length}`)}<div class="e-pbody">
<div class="e-lines">${slots.join('')}</div>
<div class="e-tags e-vs"><span class="e-vsl">Против истории:</span>${vs}</div>
${rows}
<button class="e-row e-toggle ${X.auto ? 'on' : ''}" data-a="tauto">${ic('auto')}<span>Генштаб сам выбирает исследования<small>в свободные слоты — по порядку истории</small></span><i></i></button>
<div class="e-note">${ic('info')}Сила войск по годам уже учитывает, что изобрели в истории. Изучили раньше — прибавка, отстали — штраф. Раньше исторического срока исследование идёт дольше, позже — быстрее.${n < 3 ? ' Третий слот — с лета 1942 г.' : ''}</div>
</div>`;
  },
};
export const SCI_ACT = {
  sci() { this.snd.play('click'); if (this.panelKind === 'sci' && !this.$('.e-panel').classList.contains('hidden')) return this.closePanel(); return this.openPanel('sci'); },
  tsel(b) {
    this.snd.play('select'); const k = b.dataset.k; this.sciSel = this.sciSel === k ? null : k; this.renderPanel();
    this.$('.e-panel .e-td')?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
  },
  tgo(b) {
    const S = this.S, P = this.P, k = b.dataset.k, i = b.dataset.i !== undefined ? +b.dataset.i : -1;
    if (i >= 0) Tc.stop(S, P, i);
    if (!Tc.start(S, P, k, i)) { this.snd.play('error'); return this.toast(`${ic('cancel')}Нет свободного слота`); }
    this.snd.play('build');
    this.toast(`${ic('sci')}${esc(Tc.techName(Tc.TK[k], P))}: ≈ ${weeksW(Tc.weeksLeft(S, P, k))}`);
    this.refresh();
  },
  tstop(b) { this.snd.play('click'); Tc.stop(this.S, this.P, +b.dataset.i); this.refresh(); },
  tauto() { this.snd.play('select'); const X = this.S.tech[this.P]; X.auto = X.auto ? 0 : 1; this.renderPanel(); this.refresh(); },
};
