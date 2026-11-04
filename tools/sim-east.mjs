// Прогон «Восточного фронта» без интерфейса: обе стороны — ИИ.
// node tools/sim-east.mjs [--turns 236] [--seed 7] [--diff 1] [--side SOV] [--mode hist] [--v] [--q]
import fs from 'node:fs';
import { decodeMap } from '../src/east/mapdata.js';
import { newGame, placeR } from '../src/east/setup.js';
import { runSide } from '../src/east/ai.js';
import { endWeek, sideOf, alive, baseCV } from '../src/east/engine.js';
import { fmtTurn, turnOf } from '../src/east/rules.js';
import { HIST_KEYS } from '../src/east/hist.js';

const A = process.argv.slice(2), arg = (k, d) => { const i = A.indexOf('--' + k); return i < 0 ? d : A[i + 1] === undefined || A[i + 1].startsWith('--') ? true : A[i + 1]; };
const turns = +arg('turns', 236), seed = +arg('seed', 7), diff = +arg('diff', 1), side = arg('side', 'SOV'), mode = arg('mode', 'hist'), V = !!arg('v', false), Q = !!arg('q', false), Z = +arg('z', 0);
const M = decodeMap(JSON.parse(fs.readFileSync(new URL('../src/east/data/map.json', import.meta.url), 'utf8')));
const NOEV = !!arg('noev', false);
const S = newGame(M, { side, mode, diff, seed, noAsk: 1, noEv: NOEV });
// ключевые города: [название, дата взятия Осью, дата освобождения] (история)
const KEY = HIST_KEYS;
const kr = KEY.map(([n, a, b]) => ({ n, r: placeR(S, n), a: a ? turnOf(a) : null, b: b ? turnOf(b) : null, lost: null, back: null, s: null })).filter((k) => k.r >= 0);
for (const k of kr) k.s = sideOf(S, k.r);
const DATES = ['1941-09-21', '1941-12-21', '1942-06-21', '1942-11-15', '1943-06-20', '1944-06-18', '1945-01-07', '1945-04-15'].map(turnOf);
const counts = [];
const T = { GER: 0, SOV: 0 };
const sum = () => {
  const o = { GER: { n: 0, str: 0, arm: 0 }, SOV: { n: 0, str: 0, arm: 0 } };
  for (const u of S.units) if (alive(u)) { const x = o[u.s]; x.n++; x.str += u.str; if (u.t === 'arm' || u.t === 'mot') x.arm++; }
  for (const s of ['GER', 'SOV']) o[s].str = o[s].n ? Math.round(o[s].str / o[s].n) : 0;
  return o;
};
const regs = (s) => M.reg.filter((g) => sideOf(S, g.id) === s).length;
console.log(`seed ${seed} diff ${diff} side ${side} mode ${mode}`);
for (let t = 0; t < turns && !S.over; t++) {
  S.news = []; S.battles = [];
  let t0 = performance.now(); runSide(S, 'GER', { isAI: true }); T.GER += performance.now() - t0;
  const bG = S.battles.length;
  t0 = performance.now(); runSide(S, 'SOV', { isAI: true }); T.SOV += performance.now() - t0;
  const bS = S.battles.length - bG;
  const ch = [];
  for (const k of kr) { const s = sideOf(S, k.r); if (s !== k.s) { ch.push((s === 'SOV' ? '+' : '-') + k.n); k.s = s; if (s === 'GER' && k.lost === null) k.lost = S.turn; if (s === 'SOV' && k.lost !== null) k.back = S.turn; } }
  const turn = S.turn;
  endWeek(S);
  const o = sum();
  if (DATES.includes(turn)) counts.push(`${fmtTurn(turn)}: G${o.GER.n}/${o.GER.str}% S${o.SOV.n}/${o.SOV.str}%`);
  if (Z && turn % Z === 0) {
    const zs = [];
    for (let z = 0; z < 5; z++) {
      const g = S.units.filter((u) => alive(u) && M.reg[u.r].z === z), gG = g.filter((u) => u.s === 'GER'), gS = g.filter((u) => u.s === 'SOV');
      const bz = S.battles.filter((x) => M.reg[x.T].z === z), bg = bz.filter((x) => x.side === 'GER'), bs = bz.filter((x) => x.side === 'SOV');
      zs.push(`z${z} G${gG.length}/${Math.round(gG.reduce((a, u) => a + baseCV(S, u, 'att'), 0))} S${gS.length}/${Math.round(gS.reduce((a, u) => a + baseCV(S, u, 'def'), 0))} b${bg.length}:${bg.filter((x) => x.win).length}/${bs.length}:${bs.filter((x) => x.win).length} ${S.post.GER[z][0]}${S.post.SOV[z][0]}`);
    }
    console.log('     ' + zs.join(' | '));
  }
  if (S.evq.length) { if (!Q) console.log('     события: ' + S.evq.map((e) => e.id).join(', ')); S.evq = []; }
  if (!Q && (V || ch.length || turn % 4 === 0)) {
    const iG = S.inc.GER, iS = S.inc.SOV;
    console.log(`${String(turn).padStart(3)} ${fmtTurn(turn).padEnd(12)} ${S.wx.map((w) => w[0]).join('')} | G ${o.GER.n}(${o.GER.arm}) ${o.GER.str}% pp${S.pp.GER | 0}/${iG.pp | 0} m${S.men.GER | 0}/${iG.men | 0} mor${S.mor.GER | 0} | S ${o.SOV.n}(${o.SOV.arm}) ${o.SOV.str}% pp${S.pp.SOV | 0}/${iS.pp | 0} m${S.men.SOV | 0}/${iS.men | 0} mor${S.mor.SOV | 0} | G${regs('GER')} | b${bG}/${bS} L G${S.stats.GER.lost} S${S.stats.SOV.lost}(${S.stats.SOV.pow}) | ${S.post.GER.map((p) => p[0]).join('')} ${S.post.SOV.map((p) => p[0]).join('')} ${ch.join(' ')}`);
  }
}
console.log('over', S.over, 'turn', S.turn, fmtTurn(S.turn));
console.log('AI ms/turn', (T.GER / S.turn).toFixed(1), (T.SOV / S.turn).toFixed(1), 'stats', JSON.stringify(S.stats));
console.log('counts', counts.join(' | '), '| dir', (S.dir ?? 0).toFixed(1));
const d = (x, h) => (x === null ? (h === null ? '·' : 'нет') : `${x}${h === null ? '' : (x - h >= 0 ? '+' : '') + (x - h)}`);
console.log('timeline (ход взятия Δ к истории / ход освобождения Δ):');
console.log(kr.map((k) => `${k.n} ${d(k.lost, k.a)}/${d(k.back, k.b)}`).join('; '));
