// «Фронт 1941–1945» (v0.9): прогон кампании ИИ против ИИ — проверка баланса по историческим вехам.
// node tools/sim-war.mjs [число прогонов] [зерно] [сторона игрока: GER|SOV|-] [сложность 0–2]
// Вехи: Киев (сер. сентября 1941), Харьков (октябрь 1941), Москва/Ленинград/Сталинград держатся, Берлин — апрель–май 1945.
import fs from 'fs';
import { decodeEU } from '../src/war/map41.js';
import { newGame, simDay, serialize, deserialize } from '../src/war/engine.js';
import { fmtDate, alive, SIDES, dateOf } from '../src/war/rules.js';
const fd = (d) => { const x = dateOf(d); return `${String(x.getUTCDate()).padStart(2, '0')}.${String(x.getUTCMonth() + 1).padStart(2, '0')}.${String(x.getUTCFullYear()).slice(2)}`; };
import { strength } from '../src/war/eco.js';

const J = JSON.parse(fs.readFileSync(new URL('../src/data/eu41.json', import.meta.url)));
const M = decodeEU(J);
const N = +(process.argv[2] ?? 1), seed0 = +(process.argv[3] ?? 1), pside = process.argv[4] && process.argv[4] !== '-' ? process.argv[4] : null, diff = +(process.argv[5] ?? 1);
const verbose = N === 1 || process.env.V === '1';
const KEY = ['Брест', 'Минск', 'Рига', 'Смоленск', 'Киев', 'Одесса', 'Харьков', 'Таллин', 'Новгород', 'Тихвин', 'Калинин', 'Тула', 'Москва', 'Ленинград', 'Ростов-на-Дону', 'Севастополь', 'Воронеж', 'Сталинград', 'Грозный', 'Баку', 'Курск', 'Орёл', 'Варшава', 'Будапешт', 'Кёнигсберг', 'Вена', 'Берлин'];
const agg = { end: {}, fall: {}, lib: {}, ms: 0, days: 0 };
const st = (S, sd) => S.units.filter((u) => u.side === sd && alive(u)).length;
for (let run = 0; run < N; run++) {
  const t0 = Date.now();
  const S = newGame(M, { side: pside, diff, seed: seed0 + run });
  let lastM = -1, tmax = 0;
  const DAYS = +(process.env.DAYS || 1500);
  while (!S.over && S.day < DAYS) {
    const t1 = Date.now();
    simDay(S);
    tmax = Math.max(tmax, Date.now() - t1);
    if (process.env.SAVE === '1' && S.day % 97 === 0) {
      const s = serialize(S), S2 = deserialize(M, s);
      if (!S2) throw new Error('deserialize failed');
    }
    const d = new Date(Date.UTC(1941, 5, 22) + S.day * 864e5), mo = d.getUTCFullYear() * 12 + d.getUTCMonth();
    if (verbose && mo !== lastM && d.getUTCDate() === 1) {
      lastM = mo;
      const E = S.eco || {};
      const pk = SIDES.map((sd) => (S.pk[sd] || []).length).join('/');
      console.log(`${fd(S.day)}: дивизий GER ${st(S, 'GER')} SOV ${st(S, 'SOV')} · сила ${Math.round(strength(S, 'GER'))}/${Math.round(strength(S, 'SOV'))} · мораль ${Math.round(S.morale.GER)}/${Math.round(S.morale.SOV)} · ПМ ${E.GER ? Math.round(E.GER.ip) : '?'}/${E.SOV ? Math.round(E.SOV.ip) : '?'} · авиа ${(S.air.GER * 100) | 0}% · котлы ${pk} · потери ${Math.round(S.loss.GER / 1000)}k/${Math.round(S.loss.SOV / 1000)}k`);
    }
    if (verbose && process.env.MST === '1' && d.getUTCDate() === 1 && S.mst && d.getUTCMonth() % 3 === 0 && lastM === mo) {
      const f = (o) => Object.entries(o).map(([k, v]) => `${k} ${v.toFixed(1)}`).join(', ');
      console.log(`      мораль GER: ${f(S.mst.GER)} | SOV: ${f(S.mst.SOV)}`);
    }
    if (verbose) for (const n of S.log.filter((l) => l.d === S.day - 1 && (l.k === 'ev' || l.k === 'city' || l.k === 'dec') && l.big)) console.log('   ', fd(n.d), n.t);
  }
  const ms = Date.now() - t0;
  agg.ms += ms;
  agg.days += S.day;
  const o = S.over || { win: '—', why: 'лимит' };
  agg.end[o.win + ' ' + (o.why || '')] = (agg.end[o.win + ' ' + (o.why || '')] || 0) + 1;
  for (const c of KEY) {
    const f = S.stat.fall[c], l = S.stat.lib[c];
    if (f != null) (agg.fall[c] = agg.fall[c] || []).push(f);
    if (l != null) (agg.lib[c] = agg.lib[c] || []).push(l);
  }
  if (verbose) {
    console.log(`Итог: ${o.win} — ${o.why || ''} · ${fmtDate(S.day)} · ${ms} мс (макс. сутки ${tmax} мс)`);
    console.log('Пали:', KEY.filter((c) => S.stat.fall[c] != null).map((c) => `${c} ${fd(S.stat.fall[c])}`).join(', '));
    console.log('Освобождены/взяты:', KEY.filter((c) => S.stat.lib[c] != null).map((c) => `${c} ${fd(S.stat.lib[c])}`).join(', '));
  } else console.log(`#${seed0 + run}: ${o.win} ${o.why || ''} ${fd(S.day)} · Киев ${S.stat.fall['Киев'] != null ? fd(S.stat.fall['Киев']) : '—'} · Москва ${S.stat.fall['Москва'] != null ? fd(S.stat.fall['Москва']) : '—'} · Берлин ${S.stat.lib['Берлин'] != null ? fd(S.stat.lib['Берлин']) : '—'} · ${ms} мс`);
}
if (N > 1) {
  const med = (a) => { const b = [...a].sort((x, y) => x - y); return b[b.length >> 1]; };
  console.log('Исходы:', agg.end);
  console.log('Пали (медиана, доля):', KEY.filter((c) => agg.fall[c]).map((c) => `${c} ${fd(med(agg.fall[c]))} ${agg.fall[c].length}/${N}`).join(', '));
  console.log('Взяты СССР:', KEY.filter((c) => agg.lib[c]).map((c) => `${c} ${fd(med(agg.lib[c]))} ${agg.lib[c].length}/${N}`).join(', '));
  console.log(`Среднее время прогона ${Math.round(agg.ms / N)} мс, ${Math.round(agg.ms / agg.days)} мс/сутки`);
}
