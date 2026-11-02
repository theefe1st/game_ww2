// Быстрая симуляция операций в странице (без анимаций).
// OPS=smolensk41,moscow41 POL=ai,pass SEEDS=3 CAREER=1 DIFF=1 CITIES="Смоленск,Ельня" node tools/sim.cjs
const { chromium } = require('/vercel/sandbox/node_modules/playwright');
(async () => {
  const url = process.env.URL || 'file:///data/game/dist-single/index.html';
  const ops = (process.env.OPS || 'smolensk41').split(',');
  const pols = (process.env.POL || 'ai,pass').split(',');
  const seeds = +(process.env.SEEDS || 3);
  const b = await chromium.launch({ executablePath: '/usr/local/bin/chromium', args: ['--no-sandbox'] });
  const p = await b.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(String(e)));
  await p.goto(url);
  await p.waitForFunction(() => !!window.__sim, null, { timeout: 20000 });
  if (process.env.PRE) await p.evaluate(process.env.PRE);
  for (const id of ops) for (const pol of pols) {
    const rows = [];
    for (let s = 0; s < seeds; s++) {
      const t0 = Date.now();
      const r = await p.evaluate(([id, pol, seed, career, diff, cities, prev]) => {
        try { return window.__sim(id, { policy: pol, seed, career, diff, cities: cities ? cities.split(',') : null, prevStars: prev }); }
        catch (e) { return { err: String(e && e.stack || e) }; }
      }, [id, pol, 1000 + s * 7919, process.env.CAREER !== '0', +(process.env.DIFF || 1), process.env.CITIES || '', +(process.env.PREV || 2)]);
      r.ms = Date.now() - t0;
      rows.push(r);
      if (r.err) { console.log(id, pol, 'ERR', r.err); continue; }
      console.log(`${id} ${pol} s${s}: ★${r.cstars ?? r.stars} win=${r.win} t=${r.turn} ${r.done ?? ''}/${r.total ?? ''} rep=${JSON.stringify(r.rep || {})} k=${r.kills} l=${r.lost} alive=${r.alive} "${r.title}" [${(r.dirs || []).join(' ')}] ${r.ms}ms`);
      if (process.env.TRACE) for (const t of r.trace) console.log('   ', t);
    }
    const ok = rows.filter((r) => !r.err);
    const avg = ok.reduce((a, r) => a + (r.cstars ?? r.stars ?? 0), 0) / Math.max(1, ok.length);
    console.log(`== ${id} ${pol}: avg ★ ${avg.toFixed(2)} over ${ok.length}`);
  }
  if (errs.length) console.log('PAGE ERRORS:', errs.slice(0, 5).join('\n'));
  await b.close();
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
