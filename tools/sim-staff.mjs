// Headless-симуляция «Сталинград 1942–1943»: ИИ против ИИ, сводка по дням и исторические вехи.
// node tools/sim-staff.mjs [seed] [hist=1] [days]
import fs from 'node:fs';
import * as E from '../src/staff/engine.js';
import { think } from '../src/staff/ai.js';
const D = JSON.parse(fs.readFileSync(new URL('../src/data/uranus42.json', import.meta.url)));
const seed = +(process.argv[2] || 1), hist = (process.argv[3] ?? '1') === '1', days = +(process.argv[4] || 76);
const S = E.newGame(D, { side: null, seed, hist });
const t0 = Date.now();
const keyT = { Калач: 0, Советский: 0, Тацинская: 0, Морозовск: 0, Котельниково: 0, Питомник: 0, Гумрак: 0, 'Нижне-Чирская': 0, Суровикино: 0, Обливская: 0 };
const tw = new Map(D.towns.map((t) => [t.n, t]));
const marks = [];
let lastDay = -1;
while (!S.over && S.t < E.T_START + days * 24) {
  think(S);
  E.tick(S);
  S.fx.length = 0;
  for (const m of S.q) if (m.k === 'ev' || m.k === 'dec') marks.push(`${E.dateLabel(m.t)} ${m.title}`);
  S.q.length = 0;
  for (const n of Object.keys(keyT)) {
    const t = tw.get(n);
    if (t && !keyT[n] && S.own[t.c] === 1) (keyT[n] = S.t), marks.push(`${E.dateLabel(S.t)} СССР: ${n}`);
  }
  const d = Math.floor(S.t / 24);
  if (d !== lastDay && S.t % 24 === 18) {
    lastDay = d;
    const L = S.units.filter((u) => !u.dead);
    const ax = L.filter((u) => u.side === 'AX'), sv = L.filter((u) => u.side === 'SOV');
    const sc = E.score(S);
    const pk = S.pk && S.pk.on ? `котёл ${S.pk.cut} ч., ${Math.round(S.pk.men / 1000)} тыс., ${S.pk.cells} кл.` : S.flags.pocket ? 'котёл ликвидирован' : 'котла нет';
    const air = S.air && S.air.t === S.t ? ` возд.мост ${S.air.del}/${S.air.need} т` : '';
    const food = S.pk && S.pk.on ? ` пищ.${Math.round(avg(S.pk.ids.map((i) => S.uById.get(i)).filter((u) => u && !u.dead && u.sup === 0), 'food'))} бп.${Math.round(avg(S.pk.ids.map((i) => S.uById.get(i)).filter((u) => u && !u.dead && u.sup === 0), 'amm'))}` : '';
    console.log(`${E.shortDate(S.t)} ОП ${sc.vp.toFixed(1)} | СССР ${sv.length} ч. ${Math.round(sum(sv, 'men') / 1000)} тыс., танков ${Math.round(sum(sv, 'tanks'))} | Ось ${ax.length} ч. ${Math.round(sum(ax, 'men') / 1000)} тыс., танков ${Math.round(sum(ax, 'tanks'))} | ${pk}${air}${food} | бои ${S.log.filter((l) => l.k === 'bt' && l.t > S.t - 24).length}`);
  }
}
function sum(L, k) {
  return L.reduce((s, u) => s + u[k], 0);
}
function avg(L, k) {
  return L.length ? sum(L, k) / L.length : 0;
}
console.log('—— вехи ——');
for (const m of marks) console.log(m);
const sc = E.score(S);
console.log(`итог: ${E.dateLabel(S.t)} ОП ${sc.vp} (города ${sc.towns.map((t) => t[0]).join(', ')}; город ${sc.city}/${sc.cityN}; части ${sc.units}); пленных ${Math.round(S.st.pris.SOV / 1000)} тыс.; уничтожено частей Оси ${S.st.dest.filter((d) => d.s === 'AX').length}, СССР ${S.st.dest.filter((d) => d.s === 'SOV').length}; авиамост всего ${S.airTot} т за ${S.airDays || 0} сут.; ${Date.now() - t0} мс`);
if (process.env.DUMP) fs.writeFileSync(process.env.DUMP, E.save(S));
