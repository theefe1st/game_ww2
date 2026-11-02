// E2E: стратегия «Европа 1939–1945» — хаб → старт → выбор → атака → производство → конец хода
const { chromium } = require('/vercel/sandbox/node_modules/playwright');
(async () => {
  const W = +(process.env.W || 390), H = +(process.env.H || 844), NAT = process.env.NAT || 'GER', Y = process.env.Y || '1939', TAG = process.env.TAG || 'p';
  const TURNS = +(process.env.TURNS || 2);
  const browser = await chromium.launch({ executablePath: '/usr/local/bin/chromium', args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await ctx.addInitScript(() => { if (!sessionStorage.getItem('x')) { localStorage.clear(); sessionStorage.setItem('x', 1); } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('console', (m) => ['error', 'warning'].includes(m.type()) && errs.push(m.type() + ': ' + m.text()));
  page.on('pageerror', (e) => errs.push('pageerror: ' + e.message + '\n' + e.stack));
  const shot = async (n) => { await page.waitForTimeout(250); await page.screenshot({ path: `tools/shots/eu_${TAG}_${n}.png` }); };
  const click = async (sel) => { await page.evaluate((s) => { const b = document.querySelector(s); if (!b) throw new Error('no ' + s); b.click(); }, sel); await page.waitForTimeout(250); };
  const vis = (sel) => page.evaluate((s) => { const e = document.querySelector(s); return !!e && !e.classList.contains('hidden') && e.offsetParent !== null; }, sel);
  await page.goto('file:///data/game/dist-single/index.html');
  await page.waitForTimeout(1200);
  await click('#m-eu'); await page.waitForTimeout(900);
  await shot('0_hub');
  await click(`[data-a=opt][data-k=nat][data-v=${NAT}]`);
  await click(`[data-a=opt][data-k=start][data-v="${Y}"]`);
  await shot('0b_hub');
  await click('#eu [data-a=start]'); await page.waitForTimeout(1500);
  await shot('1_intro');
  await click('#eu [data-a=mflow]'); await page.waitForTimeout(800);
  await shot('2_map');
  // найти свой регион с целью атаки
  const pick = await page.evaluate(() => {
    const e = __app.eu, S = e.S, regs = [...new Set(S.units.filter((u) => u.n === S.player && u.mv > 0).map((u) => u.r))];
    let best = null;
    for (const r of regs) { e.select(r); const ks = [...e.tg.entries()]; const a = ks.find((x) => x[1] === 'attack'); if (a) { best = { r, j: a[0], n: ks.length }; break; } if (!best && ks.length) best = { r, j: ks[0][0], k: ks[0][1], n: ks.length }; }
    if (best) { e.select(best.r); e.map.reveal(best.r); }
    return best;
  });
  console.log('pick', JSON.stringify(pick));
  await page.waitForTimeout(700);
  await shot('3_sel');
  console.log('sheet:', (await page.evaluate(() => document.querySelector('#eu .eu-sheet')?.innerText || '')).replace(/\s+/g, ' ').slice(0, 300));
  if (pick) {
    await page.evaluate((j) => __app.eu.tap(j), pick.j); await page.waitForTimeout(500);
    await shot('4_order');
    if (await vis('#eu .eu-modal, #eu [class*=modal]:not(.hidden)')) {
      console.log('modal:', (await page.evaluate(() => document.querySelector('#eu .eu-dlg')?.innerText || '')).replace(/\s+/g, ' ').slice(0, 400));
      const hasFight = await page.evaluate(() => !!document.querySelector('#eu [data-a=fight]'));
      if (hasFight) { await click('#eu [data-a=fight]'); await page.waitForTimeout(800); await shot('5_fight'); console.log('after fight:', (await page.evaluate(() => document.querySelector('#eu .eu-dlg')?.innerText || '')).replace(/\s+/g, ' ').slice(0, 300)); }
      await page.evaluate(() => { const b = document.querySelector('#eu [data-a=mclose]'); b && b.click(); });
    }
  }
  await page.evaluate(() => __app.eu.select(0));
  await click('#eu [data-a=prod]'); await shot('6_prod');
  await page.evaluate(() => { const b = document.querySelector('#eu [data-a=buy]'); b && b.click(); }); await shot('6b_prod_buy');
  await click('#eu [data-a=mclose]');
  await click('#eu [data-a=tech]'); await shot('7_tech'); await click('#eu [data-a=mclose]');
  await click('#eu [data-a=pow]'); await shot('8_pow'); await click('#eu [data-a=mclose]');
  await click('#eu [data-a=mapmode]'); await shot('9_terrain');
  await click('#eu [data-a=mapmode]'); await shot('9b_supply');
  await click('#eu [data-a=mapmode]');
  for (let k = 0; k < TURNS; k++) {
    await click('#eu [data-a=end]');
    const t0 = Date.now();
    while (Date.now() - t0 < 60000) { await page.waitForTimeout(300); if (!(await page.evaluate(() => __app.eu.busy))) break; }
    console.log('turn', k, 'took', Date.now() - t0, 'ms; t=', await page.evaluate(() => __app.eu.S.t));
    await page.waitForTimeout(600);
    await shot(`10_turn${k}`);
    // закрыть все модалки (события — первый вариант)
    for (let g = 0; g < 12; g++) {
      const st = await page.evaluate(() => { const m = document.querySelector('#eu .eu-dlg'); const mv = m && m.offsetParent !== null; return mv ? [...m.querySelectorAll('button')].map((b) => b.dataset.a + ':' + b.innerText.trim().slice(0, 30)) : null; });
      if (!st) break;
      console.log(' modal buttons:', st.join(' | '));
      if (g < 3) await shot(`11_turn${k}_m${g}`);
      await page.evaluate(() => { const m = document.querySelector('#eu .eu-dlg'); const b = m.querySelector('[data-a=evopt]') || m.querySelector('[data-a=mflow]') || m.querySelector('[data-a=mclose]') || m.querySelector('button'); b && b.click(); });
      await page.waitForTimeout(400);
    }
  }
  await shot('12_after');
  await click('#eu [data-a=log]'); await shot('13_log'); await click('#eu [data-a=mclose]');
  await click('#eu [data-a=menu]'); await shot('14_menu');
  console.log('errors:', errs.length ? errs.join('\n') : 'none');
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
