// «Барбаросса 1941» (v0.8): прогон главы «Граница» ИИ против ИИ (дивизии игрока ведёт советник).
// node tools/sim-barb.mjs [GER|SOV] [сложность 0–2] [число прогонов] [зерно]
import fs from 'fs';
import * as R from '../src/barb/rules.js';
import { aiPhase, plan } from '../src/barb/ai.js';
import { dayDate } from '../src/barb/data.js';
const J = JSON.parse(fs.readFileSync(new URL('../src/data/map_border41.json', import.meta.url)));
const side = process.argv[2] || 'GER', diff = +(process.argv[3] ?? 1), N = +(process.argv[4] ?? 1), seed0 = +(process.argv[5] ?? 1);
const verbose = N === 1, passive = process.env.PASSIVE === '1', trace = (process.env.TRACE || '').split(',').filter(Boolean);
if (process.env.SUP) R.CFG.supOwn = +process.env.SUP;
const agg = { mk6: 0, enc: 0, dead: 0, win: 0, stars: 0, cut: 0, minsk: [], bobr: [], brest: [], clock: 0, a10: 0, ms: 0 };
for (let run = 0; run < N; run++) {
  const t0 = Date.now();
  const S = R.newGame(J, { side, diff, seed: seed0 + run });
  if (process.env.WD) S.flags.wdDay = +process.env.WD;
  while (!S.over) {
    for (const ph of ['GER', 'SOV']) {
      R.beginPhase(S, ph);
      const ids = S.units.filter((u) => u.side === ph && R.alive(u)).map((u) => u.id);
      const ally = ids.filter((id) => !S.U.get(id).cmd), mine = ids.filter((id) => S.U.get(id).cmd);
      if (ph === S.side) {
        const dec = R.pendingDecision(S);
        if (dec) R.decide(S, dec.id, dec.opts[+(process.env.DEC || 0)]?.k || dec.opts[0].k);
        if (process.env.ABIL === '1') for (const k of Object.keys(S.abil)) if (R.abilReady(S, k)) R.useAbil(S, k);
        for (const e of aiPhase(S, ph, ally)) {}
        if (!passive) for (const e of aiPhase(S, ph, mine, { air: S.air })) {}
      } else for (const e of aiPhase(S, ph, ids)) {}
      R.endPhase(S, ph);
    }
    if (verbose) {
      const caps = Object.entries(S.caps).filter(([c, v]) => v.d === S.day).map(([c, v]) => `${c}(${v.by[0]})`).join(' ');
      const pk = R.pockets(S, 'SOV').filter((p) => p.units.length).map((p) => `${p.name}:${p.units.length}`).join(' ');
      const g = R.goalList(S).map((x) => `${x.sh} ${x.prog}${x.fail ? '✗' : ''}`).join(' | ');
      if (trace.length) console.log('   ', trace.map((id) => { const u = S.U.get(id); const P = R.alive(u) && u.c >= 0 ? plan(S, u) : null; return `${u.sh}@${u.c % 27},${(u.c / 27) | 0} s${u.str} o${Math.round(u.org)}${R.alive(u) ? (R.supplied(S, u) ? '' : '!') : '†'}${P ? ' ' + P.mode + '>' + P.gname : ''}`; }).join(' · '));
      console.log(`${dayDate(S.day).s}: взяты ${caps || '—'} · котлы ${pk || '—'} · отрезано ${R.cutCount(S)} · ${g}`);
    }
    R.takeEvents(S);
    R.endDay(S);
  }
  const o = S.over, cd = (c) => (S.caps[c] && S.caps[c].by === 'GER' ? S.caps[c].d : 9);
  agg.win += o.win;
  agg.stars += o.stars;
  agg.cut += R.cutCount(S);
  { const sup = R.supplyMap(S, 'SOV'); for (const u of S.units) if (u.side === 'SOV' && u.t !== 'gar') { if (u.sur || (R.alive(u) && !sup[u.c])) agg.enc++; else if (u.dead) agg.dead++; } }
  agg.minsk.push(cd('Минск'));
  agg.bobr.push(cd('Бобруйск'));
  agg.brest.push(cd('Брест'));
  agg.clock += o.clock;
  agg.a10 += S.units.filter((u) => u.top === 'a10' && R.alive(u) && R.supplied(S, u)).length;
  agg.ms += Date.now() - t0;
  agg.mk6 += S.units.filter((u) => u.fm === 'mk6' && R.alive(u) && R.supplied(S, u)).length;
  if (verbose) {
    console.log('ИТОГ', JSON.stringify(o));
    console.log('потери', JSON.stringify(S.stats));
    console.log('10-я армия:', S.units.filter((u) => u.top === 'a10').map((u) => `${u.sh}${u.dead ? '†' : u.sur ? '⊗' : R.supplied(S, u) ? '' : '!'}`).join(' '));
    console.log('немцы потеряли дивизий:', S.units.filter((u) => u.side === 'GER' && !R.alive(u) && u.arr <= 8 && (u.dead || u.sur)).map((u) => u.sh).join(' ') || '—');
  }
}
if (!verbose) {
  const avg = (a) => (a.reduce((s, x) => s + x, 0) / a.length).toFixed(1);
  console.log(`${side} d${diff} ×${N}: побед ${agg.win}, звёзд ср. ${(agg.stars / N).toFixed(2)}, отрезано ср. ${(agg.cut / N).toFixed(1)} (окруж. ${(agg.enc / N).toFixed(1)}, убито ${(agg.dead / N).toFixed(1)}), Минск д${avg(agg.minsk)}, Бобруйск д${avg(agg.bobr)}, Брест д${avg(agg.brest)}, часы ${(agg.clock / N).toFixed(1)}, 10А на снабж. ${(agg.a10 / N).toFixed(1)} (6мк ${(agg.mk6 / N).toFixed(1)}), ${(agg.ms / N).toFixed(0)} мс/прогон`);
}
