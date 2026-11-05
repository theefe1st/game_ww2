// «Мировой фронт» v0.11 (отзыв 04.11, шаг 6.8): панель «Флот» — по морям: господство, свои и чужие флоты (сила, база,
// состояние: заперт минами, под ударами авиации, ремонт), что даёт господство (десанты, поддержка у берега, конвои).
// Открывается касанием корабля на карте или из панели «Армия».
import { FLEETS, SEAS, seaDom, mined, convoyK, fleetOf } from './fleet.js';
import * as E from './engine.js';
import { lerpT, yearF, other } from './rules.js';
import { esc, ic, num } from './kit.js';

const pc = (x) => `${Math.round(x * 100)} %`;
const kx = (x) => `×${(Math.round(x * 100) / 100).toFixed(2).replace('.', ',')}`;
export const SIDE_FC = { SOV: '#c4482e', GER: '#6f8090', UK: '#a3865a', USA: '#69784a' };

// состояние флота: { st, c — предел по истории, dead, tags[] }
export function fleetState(S, f) {
  const st = S.fl?.[f.id] || { p: 0, b: null, c: 0 }, c = lerpT(f.pts, yearF(Math.max(0, S.turn)));
  const dead = !st.b || st.p <= 0, tags = [];
  if (!dead && !S.peace) {
    if (mined(S, f)) tags.push(['warn', 'wire', 'заперт минами в Финском заливе — пока Таллин у противника']);
    const r = E.cityR(S, st.b), ar = r >= 0 ? E.airRatio(S, f.side, S.M.reg[r].z) : 0.5;
    if (ar < 0.4) tags.push(['warn', 'bomber', 'под ударами авиации — небо над базой за противником']);
    else if (ar >= 0.45 && st.p < c - 0.5) tags.push(['good', 'hammer', 'ремонт в базе']);
  }
  return { st, c, dead, tags };
}
export const FleetUI = {
  pFleet(sea) {
    const S = this.S, P = this.P, en = other(P);
    const card = (f) => {
      const { st, c, dead, tags } = fleetState(S, f), w = c > 0 ? Math.min(100, (st.p / c) * 100) : 0;
      const spare = f.base.filter((n) => n !== st.b && E.sideOf(S, E.cityR(S, n)) === f.side);
      const sub = dead ? 'баз не осталось — флот погиб' : `база: ${esc(st.b)}${spare.length ? ` · запасные: ${esc(spare.join(', '))}` : ' · запасных баз нет'}`;
      return `<div class="e-fl ${f.side === P ? '' : 'en'} ${dead ? 'dead' : ''}">${ic('warship')}<div class="e-lm"><b>${esc(f.n)}</b><small>${sub}</small>
<div class="e-flb"><i style="width:${w}%;background:${SIDE_FC[f.side]}"></i></div>${tags.length ? `<div class="e-tags">${tags.map(([k, i, t]) => `<span class="e-tag ${k}">${ic(i)}${esc(t)}</span>`).join('')}</div>` : ''}</div>
<b class="e-fln" title="сила флота">${num(st.p)}<small>из ${num(c)}</small></b></div>`;
    };
    const secs = SEAS.map((n) => {
      const d = seaDom(S, n, P) ?? 0.5, L = FLEETS.filter((f) => f.sea.includes(n)).sort((a, b) => (a.side === P ? 0 : 1) - (b.side === P ? 0 : 1));
      const eff = [`морские десанты ${kx(0.6 + 0.8 * d)}`, 'бои у берега (до 400 км от базы) — до ±15 % к атаке'];
      if (n === 'Баренцево море') eff.push(P === 'SOV' ? `ленд-лиз северными конвоями ${kx(convoyK(S))}` : `ленд-лиз противника северными конвоями ${kx(convoyK(S))}`);
      const who = d >= 0.6 ? 'у нас' : d <= 0.4 ? 'у противника' : 'спорное';
      return `<div class="e-sea ${sea === n ? 'on' : ''}" data-sea="${esc(n)}"><h4>${ic('ship')}${esc(n)} <small>господство: ${who} · ${pc(d)}</small></h4>
<div class="e-dom"><i style="width:${d * 100}%;background:${SIDE_FC[P]}"></i><i style="width:${(1 - d) * 100}%;background:${SIDE_FC[en]}"></i></div>
<div class="e-fls">${L.map(card).join('')}</div>
<div class="e-note">${ic('info')}<span>${eff.join(' · ')}</span></div></div>`;
    }).join('');
    return `${this.head(ic('warship'), 'Флот', 'господство на море — по силе флотов')}<div class="e-pbody">
${S.peace ? `<div class="e-note">${ic('dove')}Мирное время: флоты в базах, потерь нет.</div>` : ''}
${secs}
<div class="e-note">${ic('info')}<span>Корабли не строятся: сила флотов меняется по истории (переходы кораблей, ленд-лиз, «Тирпиц» в Норвегии с 1942 г.). Флот стоит в главной базе; потеря базы — уход в запасную (−20 % кораблей), без баз флот погибает. Небо над базой за противником — потери от авиации, своё — ремонт.</span></div>
</div>`;
  },
};
export const FLEET_ACT = {
  fleet(b) {
    this.snd.play('click');
    const sea = b?.dataset?.sea || null;
    this.openPanel('fleet', sea);
    if (sea) setTimeout(() => this.$(`.e-sea[data-sea="${sea}"]`)?.scrollIntoView({ block: 'start' }), 30);
  },
};
export const fleetSea = (id) => fleetOf(id)?.sea[0] || null;
