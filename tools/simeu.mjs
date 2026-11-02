// Безголовая симуляция «Европы 1939–1945»: все державы под ИИ. node tools/simeu.mjs [seed] [turns] [-v]
import fs from 'fs';
import { initMap, newGame, endTurn, ORDER } from '../src/europe/engine.js';
import { G, shortDate, alive, totalStr } from '../src/europe/rules.js';
import { NATIONS } from '../src/europe/regions.js';
const E = JSON.parse(fs.readFileSync(new URL('../src/data/europe.json', import.meta.url), 'utf8'));
initMap(E);
const seed = +(process.argv[2] || 1), TT = +(process.argv[3] || 152), V = process.argv.includes(`-v`);
const W = `warsaw lwow oslo narvik brussels amsterdam lille reims paris belgrade athens crete albania tobruk sollum matruh alamein alexandria benghazi tripoli tunis minsk riga smolensk kiev leningrad tikhvin vyazma moscow kalinin tula kharkov crimea rostov voronezh stalingrad maikop grozny baku kursk orel dnepropetrovsk sicily naples rome normandy marseille bucharest budapest konigsberg vienna prague berlin viipuri helsinki damascus tehran`.split(` `);
const watch = new Set(W.map((k) => G.byKey[k].i));
const t0 = Date.now();
const S = newGame({ seed, player: null });
const out = [];
let lastCap = 0;
const sum = () => [`GER`, `SOV`, `UK`, `USA`, `ITA`, `FRA`].filter((n) => alive(S, n)).map((n) => `${n} ${S.units.filter((u) => u.n === n).length}u/${totalStr(S, n).toFixed(0)}s pp${(S.nat[n].inc?.pp || 0).toFixed(0)} oil${S.nat[n].oil.toFixed(0)} mp${S.nat[n].mp.toFixed(0)}`).join(` | `);
while (!S.over && S.t < TT) {
  const t = S.t;
  for (const e of S.news) e.t === t && e.ttl && out.push(`${shortDate(t)} [${t}] * ${e.ttl}`);
  endTurn(S);
  for (const c of S.caps) {
    if (c.t !== t) continue;
    if (c.cap) out.push(`${shortDate(t)} [${t}] !!! капитуляция ${c.cap} → ${c.by}`);
    else if (watch.has(c.r)) out.push(`${shortDate(t)} [${t}] ${G.R[c.r - 1].k}: ${c.from} → ${c.to}`);
  }
  if ([19, 43, 50, 54, 66, 77, 92, 114, 128, 136].includes(t) || V) out.push(`   == ${shortDate(t)}: ${sum()}`);
  void lastCap;
}
out.push(`итог: t=${S.t} ${JSON.stringify(S.over)} время ${((Date.now() - t0) / 1000).toFixed(1)} с`);
console.log(out.join(`\n`));
