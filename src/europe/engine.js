// «Европа 1939–1945»: ход игры — начало хода, ИИ, экономика, капитуляции, итог, сохранение.
import { decodeEurope } from './mapdata.js';
import { G, useGraph, alive, refresh, economy, T_END, vpState } from './rules.js';
import { newState } from './setup.js';
import { aiTurn } from './ai.js';
import { runEvents, tick, checkCapitulations } from './events.js';

export const ORDER = [`GER`, `ITA`, `SOV`, `FIN`, `ROM`, `HUN`, `SVK`, `BUL`, `UK`, `USA`, `FRA`, `POL`, `VIC`, `BEL`, `NED`, `NOR`, `DEN`, `YUG`, `GRE`, `LIT`, `LAT`, `EST`, `TUR`, `ESP`, `POR`, `SWE`, `SUI`, `IRL`, `IRN`];
export const PLAYABLE = [`SOV`, `GER`, `UK`];
export const T41 = 43;
export function initMap(E) {
  if (!G) useGraph(decodeEurope(E));
  return G;
}
const trim = (S) => {
  const lo = S.t - 4;
  for (const k of [`bat`, `caps`, `news`, `log`]) S[k] = (S[k] || []).filter((e) => e.t >= lo);
};
export function beginTurn(S) {
  trim(S);
  for (const n of Object.keys(S.nat)) alive(S, n) && refresh(S, n);
  tick(S);
  runEvents(S, `start`);
  checkEnd(S);
}
// конец хода игрока: события-внезапности, ходы ИИ, экономика, капитуляции, следующий ход
export function endTurn(S, next = true) {
  if (S.over) return;
  runEvents(S, `pre`);
  for (const n of ORDER) n !== S.player && alive(S, n) && aiTurn(S, n);
  for (const n of ORDER) alive(S, n) && economy(S, n);
  checkCapitulations(S);
  checkEnd(S);
  if (S.over) return;
  S.t++;
  next && beginTurn(S);
}
export function checkEnd(S) {
  if (S.over) return;
  const P = S.player;
  if (!alive(S, `GER`)) S.over = { win: P !== `GER`, k: `ger`, t: S.t };
  else if (P && !alive(S, P)) S.over = { win: false, k: `dead`, t: S.t };
  else if (P === `GER` && !alive(S, `SOV`) && !alive(S, `UK`)) S.over = { win: true, k: `total`, t: S.t };
  else if (S.t >= T_END) S.over = { win: P === `GER`, k: `time`, t: S.t };
}
export function newGame(o = {}) {
  const S = newState({ seed: o.start === 1941 ? 41 : o.seed ?? Date.now() % 1e9, diff: o.diff ?? 1, hist: o.hist ?? true });
  S.pending = [];
  S.start = o.start || 1939;
  if (o.start === 1941) {
    beginTurn(S);
    while (S.t < T41 && !S.over) endTurn(S, S.t + 1 < T41);
    S.rs = (o.seed ?? Date.now() % 1e9) >>> 0;
  }
  S.player = o.player ?? null;
  S.diff = o.diff ?? 1;
  beginTurn(S);
  return S;
}
// счёт: очки побед под контролем блока игрока и дата падения Берлина
export function score(S) {
  const P = S.player, v = P ? vpState(S, P) : null;
  return { t: S.t, over: S.over || null, vp: v };
}
export function save(S) {
  return JSON.stringify(S, (k, v) => (k[0] === `_` ? undefined : v));
}
export function load(str) {
  const S = JSON.parse(str);
  S._ver = 1;
  S.pending = S.pending || [];
  return S;
}
