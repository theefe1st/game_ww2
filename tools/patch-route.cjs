// one-off: wire kharkov42/rzhev42 + career route (v0.5)
const fs = require('fs');
const P = '/data/game/src/game.js';
let s = fs.readFileSync(P, 'utf8');
function rep(a, b, all = false) {
  const n = s.split(a).length - 1;
  if (n === 0) throw Error('not found: ' + a.slice(0, 80));
  if (n > 1 && !all) throw Error('ambiguous (' + n + '): ' + a.slice(0, 80));
  s = all ? s.split(a).join(b) : s.replace(a, () => b);
}
// A. imports
rep('import __MAP_berlin45 from "./data/map_berlin45.json";\n',
  'import __MAP_berlin45 from "./data/map_berlin45.json";\nimport __MAP_kharkov42 from "./data/map_kharkov42.json";\nimport __MAP_rzhev42 from "./data/map_rzhev42.json";\nimport { kharkov42 as __mkKH } from "./ops/kharkov42.js";\nimport { rzhev42 as __mkRZ } from "./ops/rzhev42.js";\n');
// B. ops registry
rep('  ma = Object.fromEntries([Ye, $n, ...pa].map((e) => [e.id, e])),',
  '  __OH = { z, Or, _r, B, L, cr, tr, ar, or, sr, f, _n, hr, En, R, I, gr },\n  __KH = __mkKH(__OH),\n  __RZ = __mkRZ(__OH),\n  OPS_ALL = [pa[0], pa[1], __KH, __RZ, pa[2], pa[3], pa[4], pa[5]],\n  ma = Object.fromEntries([Ye, $n, ...OPS_ALL].map((e) => [e.id, e])),');
rep('  _a = [1, 1, 2, 3, 3, 4],', '  _a = [1, 1, 2, 2, 3, 3, 4],');
// C. meta: J -> J_ALL + route
rep('var J = [\n    {\n      id: `smolensk41`,', 'var J_ALL = [\n    {\n      id: `smolensk41`,');
const KH_META = `    {
      id: \`kharkov42\`,
      year: 1942,
      period: \`май 1942\`,
      place: \`Харьков\`,
      guardNo: 15,
      reserve: {
        inf: [\`226-я стрелковая дивизия\`, \`300-я стрелковая дивизия\`],
        arm: [\`10-я танковая бригада\`],
      },
      memo: [
        \`Под Харьковом мы вовремя разглядели западню. Армия прорвала фронт, а когда Клейст ударил по Барвенковскому выступу, мы не дали захлопнуть мешок и вывели дивизии к Донцу.\`,
        \`Харьковская операция начиналась как наступление, а закончилась тяжёлым выходом из кольца. Мы потеряли много людей, но вынесли знамёна и сохранили костяк армии.\`,
        \`Май сорок второго — самая горькая страница моей службы. Армия рвалась к Харькову, а за спиной у нас уже смыкались немецкие клещи. Из выступа вышли немногие.\`,
      ],
      news: [
        \`Армия генерала {gshort} вырвалась из немецких клещей под Харьковом\`,
        \`Упорные бои на харьковском направлении\`,
        \`Тяжёлые бои в районе Барвенково\`,
      ],
    },
    {
      id: \`rzhev42\`,
      year: 1942,
      period: \`август 1942\`,
      place: \`Ржев\`,
      guardNo: 20,
      reserve: {
        inf: [\`352-я стрелковая дивизия\`, \`158-я стрелковая дивизия\`],
        arm: [\`255-я танковая бригада\`],
      },
      memo: [
        \`Подо Ржевом мы прорвали оборону 9-й немецкой армии и вышли к Вазузе. Ржевская мясорубка перемалывала дивизии, но в те августовские дни враг впервые попятился без приказа.\`,
        \`Ржевско-Сычёвская операция далась тяжело: дожди, болота, бесконечные контратаки немецких танковых дивизий. Мы продвинулись вперёд и не дали немцам снять отсюда ни одной дивизии под Сталинград.\`,
        \`Под Ржевом армия завязла в грязи. Мы атаковали снова и снова, теряли людей за каждую деревню, а Сычёвка так и осталась за немцами.\`,
      ],
      news: [
        \`Войска генерала {gshort} прорвали оборону немцев подо Ржевом\`,
        \`Упорные бои на ржевском направлении\`,
        \`Ожесточённые бои западнее Погорелого Городища\`,
      ],
    },
`;
// insert after moscow41 meta entry: find '      id: `stalingrad42`,' inside J_ALL (the meta block) - the first occurrence after 'var J_ALL'
{
  const i0 = s.indexOf('var J_ALL = [');
  const i1 = s.indexOf('    {\n      id: `stalingrad42`,', i0);
  if (i0 < 0 || i1 < 0) throw Error('meta stalingrad not found');
  s = s.slice(0, i1) + KH_META + s.slice(i1);
}
rep('  ],\n  Sa = (e) => pa[e];',
  `  ],
  J = [],
  STAGES = [[\`smolensk41\`], [\`moscow41\`], [\`kharkov42\`, \`rzhev42\`], [\`stalingrad42\`], [\`kursk43\`], [\`bagration44\`], [\`berlin45\`]],
  BRANCH = 2,
  routeOf = (p) =>
    STAGES.map((e, t) =>
      p && p.route && e.includes(p.route[t]) ? p.route[t] : e.length > 1 ? null : e[0],
    ),
  syncRoute = (p) => {
    let e = routeOf(p);
    ((J.length = 0), (pa.length = 0));
    e.forEach((t, n) => {
      let r = t || STAGES[n][0];
      (J.push(J_ALL.find((e) => e.id === r)), pa.push(ma[r]));
    });
  },
  Sa = (e) => pa[e];
syncRoute(null);`);
// D. profile v2
rep(`  return {
    v: 1,
    name: n,
    short: r[r.length - 1],
    diff: t,
    ops: J.map(() => null),
    fails: J.map(() => 0),
    created: Date.now(),
  };
}`, `  let i = {
    v: 2,
    name: n,
    short: r[r.length - 1],
    diff: t,
    route: routeOf(null),
    ops: STAGES.map(() => null),
    fails: STAGES.map(() => 0),
    created: Date.now(),
  };
  return (syncRoute(i), i);
}`);
rep(`    let t = JSON.parse(e.getItem(\`wf_camp_v1\`) || \`null\`);
    if (t && t.v === 1 && Array.isArray(t.ops)) {
      for (; t.ops.length < J.length;) t.ops.push(null);
      return (t.fails || (t.fails = J.map(() => 0)), t);
    }
  } catch {}
  return null;`, `    let t = JSON.parse(e.getItem(\`wf_camp_v1\`) || \`null\`);
    if (t && t.v === 1 && Array.isArray(t.ops)) {
      for (; t.ops.length < 6;) t.ops.push(null);
      for (t.fails = t.fails || []; t.fails.length < 6;) t.fails.push(0);
      let n = t.ops[2];
      (t.ops.splice(
        2,
        0,
        n
          ? { skip: 1, stars: 0, kills: 0, lost: 0, add: [], dead: [], xp: {}, rep: { ...n.rep }, done: 0, total: 0, promoted: !1 }
          : null,
      ),
        t.fails.splice(2, 0, 0));
      for (let e of t.ops) if (e && e.add) for (let t of e.add) t.op >= 2 && t.op++;
      ((t.v = 2), (t.route = routeOf(null)), (t.migrated = 1), Oa(e, t));
    }
    if (t && t.v === 2 && Array.isArray(t.ops)) {
      for (; t.ops.length < STAGES.length;) t.ops.push(null);
      for (t.fails = t.fails || []; t.fails.length < STAGES.length;) t.fails.push(0);
      return ((t.route = routeOf(t)), syncRoute(t), t);
    }
  } catch {}
  return (syncRoute(null), null);`);
// Y: skip placeholder
rep(`    let t = e.ops[r];
    if (!t) break;
    (n.done++,`, `    let t = e.ops[r];
    if (!t) break;
    if (t.skip) continue;
    (n.done++,`);
// Pa: all ops
rep('  for (let e of pa) (t(e.units, 0), t(e.events, 0));\n  for (let t of J) for',
  '  for (let e of OPS_ALL) (t(e.units, 0), t(e.events, 0));\n  for (let t of J_ALL) for');
// Va: skip
rep(`  let n = e.ops[t];
  if (!n) return null;
  let r = J[t],`, `  let n = e.ops[t];
  if (!n || n.skip) return null;
  let r = J[t],`);
// Ha: Berlin index
rep('${e.ops[5] ? ` в поверженном Берлине` : ``}', '${e.ops[J.length - 1] && !e.ops[J.length - 1].skip ? ` в поверженном Берлине` : ``}');
// Ra: small effect of previous op
rep(`  let l = ya[a.rank];
  ((r.perk = { rank: a.rank, air: l.air, chance: l.chance }), (r.sup += l.sup));`,
`  let l = ya[a.rank];
  ((r.perk = { rank: a.rank, air: l.air, chance: l.chance }), (r.sup += l.sup));
  o && !o.skip && (o.stars === 3 ? ((r.sup += 6), (r.camp.prevFx = 1)) : o.stars === 1 && ((r.sup = Math.max(0, r.sup - 4)), (r.camp.prevFx = -1)));`);
// standalone list over all ops
rep('      return J.reduce((e, t) => e + this.opBest(t.id), 0);', '      return J_ALL.reduce((e, t) => e + this.opBest(t.id), 0);');
rep(`<div class="ops">\${J.map((e, t) => {
        let n = Sa(t),
          r = n.career,
          i = this.opBest(e.id),`, `<div class="ops">\${J_ALL.map((e, t) => {
        let n = OPS_ALL[t],
          r = n.career,
          i = this.opBest(e.id),`);
rep(`      let t = this.$.menu,
        n = Sa(e),
        r = n.career,
        i = J[e],
        a = Vn(null, r),`, `      let t = this.$.menu,
        n = OPS_ALL[e],
        r = n.career,
        i = J_ALL[e],
        a = Vn(null, r),`);
rep('            t.s.career && Ta(t.sc.id) >= 0 && this.showOpsList());', '            t.s.career && J_ALL.some((e) => e.id === t.sc.id) && this.showOpsList());');
// hub texts
rep('<div class="tag">любая из ${J.length} · без кампании</div><p>Смоленск, Москва, Сталинград, Курск, «Багратион», Берлин — сразу, с историческим командующим.</p><p class="hubinfo">${this.opsBest() ? `Лучшие итоги: ★ ${this.opsBest()} из ${J.length * 3}` : `Ещё не сыграны`}</p>',
  '<div class="tag">любая из ${J_ALL.length} · без кампании</div><p>Смоленск, Москва, Харьков, Ржев, Сталинград, Курск, «Багратион», Берлин — сразу, с историческим командующим.</p><p class="hubinfo">${this.opsBest() ? `Лучшие итоги: ★ ${this.opsBest()} из ${J_ALL.length * 3}` : `Ещё не сыграны`}</p>');
rep('<div class="tagline">1941–1945 · шесть операций · от Смоленска до Берлина</div>', '<div class="tagline">1941–1945 · семь операций · от Смоленска до Берлина</div>');
rep('Впереди — Смоленск, Москва, Сталинград, Курская дуга, Белоруссия и Берлин.', 'Впереди — Смоленск, Москва, Харьков или Ржев, Сталинград, Курская дуга, Белоруссия и Берлин. Между операциями — карта фронта, а в 1942 году направление выбираете вы.');
rep('любую из шести операций можно сыграть сразу', 'любую из восьми операций можно сыграть сразу');
// continueGame: remap camp index
rep(`        : (this.useMap(this.mapFor(t)),
          (this.outcome = null),
          (this.G = Ht(e, this.m, t)),`, `        : (e.career?.camp &&
            ((e.career.camp.op = Ta(e.scen)),
            e.career.camp.op < 0 && delete e.career.camp),
          this.useMap(this.mapFor(t)),
          (this.outcome = null),
          (this.G = Ht(e, this.m, t)),`);
// Ao registry
fs.writeFileSync(P, s);
console.log('ok');
