// E2E-2: «Европа» — тактическая битва (лично), ж/д, отмена, события, итог, продолжение после перезагрузки
const { chromium } = require('/vercel/sandbox/node_modules/playwright');
(async () => {
  const W = +(process.env.W || 390), H = +(process.env.H || 844), TAG = process.env.TAG || 'p';
  const browser = await chromium.launch({ executablePath: '/usr/local/bin/chromium', args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await ctx.addInitScript(() => { if (!sessionStorage.getItem('x')) { localStorage.clear(); sessionStorage.setItem('x', 1); } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('console', (m) => ['error', 'warning'].includes(m.type()) && errs.push(m.type() + ': ' + m.text()));
  page.on('pageerror', (e) => errs.push('pageerror: ' + e.message + '\n' + e.stack));
  const shot = async (n) => { await page.waitForTimeout(250); await page.screenshot({ path: `tools/shots/eu2_${TAG}_${n}.png` }); };
  const click = async (sel) => { await page.evaluate((s) => { const b = document.querySelector(s); if (!b) throw new Error('no ' + s); b.click(); }, sel); await page.waitForTimeout(300); };
  const dlg = () => page.evaluate(() => { const m = document.querySelector('#eu .eu-dlg'); return m && m.offsetParent !== null ? m.innerText.replace(/\s+/g, ' ').slice(0, 260) : null; });
  const endTurn = async () => {
    await click('#eu [data-a=end]');
    const t0 = Date.now();
    while (Date.now() - t0 < 60000) { await page.waitForTimeout(200); if (!(await page.evaluate(() => __app.eu.busy))) break; }
  };
  const closeAll = async (pref) => {
    for (let g = 0; g < 10; g++) {
      const st = await page.evaluate(() => { const m = document.querySelector('#eu .eu-dlg'); return m && m.offsetParent !== null ? [...m.querySelectorAll('button')].map((b) => b.dataset.a).join(',') : null; });
      if (!st) return;
      if (pref && st.includes('evopt')) { await shot(pref + '_ev' + g); console.log(' event:', await dlg()); }
      await page.evaluate(() => { const m = document.querySelector('#eu .eu-dlg'); const b = m.querySelector('[data-a=evopt]') || m.querySelector('[data-a=mflow]') || m.querySelector('[data-a=mclose]') || m.querySelector('button'); b && b.click(); });
      await page.waitForTimeout(300);
    }
  };
  await page.goto('file:///data/game/dist-single/index.html');
  await page.waitForTimeout(1200);
  await click('#m-eu'); await page.waitForTimeout(700);
  await click('[data-a=opt][data-k=nat][data-v=GER]');
  await click('#eu [data-a=start]'); await page.waitForTimeout(1200);
  await click('#eu [data-a=mflow]');
  // 1) ж/д переброска + отмена
  const rail = await page.evaluate(() => {
    const e = __app.eu, S = e.S;
    for (const u of S.units) { if (u.n !== S.player || u.mv <= 0) continue; e.select(u.r); const b = document.querySelector(`#eu [data-a=rail][data-id="${u.id}"]`); if (b) { b.click(); return { id: u.id, r: u.r, n: e.tg.size, first: [...e.tg.keys()][0] }; } }
    return null;
  });
  console.log('rail', JSON.stringify(rail));
  await page.waitForTimeout(500); await shot('1_railmode');
  if (rail) {
    await page.evaluate((j) => __app.eu.tap(j), rail.first); await page.waitForTimeout(400);
    console.log(' moved to', await page.evaluate((id) => __app.eu.unit(id).r, rail.id), 'undo len', await page.evaluate(() => __app.eu.undo.length));
    await shot('2_railed');
    await click('#eu [data-a=undo]');
    console.log(' after undo at', await page.evaluate((id) => __app.eu.unit(id).r, rail.id));
  }
  // 2) удар по региону польской кампании → «Лично»
  const tgt = await page.evaluate(() => {
    const e = __app.eu, S = e.S, keys = 'warsaw lodz krakow poznan pomorze kielce lublin'.split(' ');
    const regs = [...new Set(S.units.filter((u) => u.n === S.player && u.mv > 0).map((u) => u.r))];
    for (const r of regs) { e.select(r); for (const [j, k] of e.tg) if (k === 'attack' && keys.includes(window.__EUG ? '' : '') ) {} }
    for (const r of regs) { e.select(r); for (const [j, k] of e.tg) { if (k !== 'attack') continue; e.tap(j); const d = document.querySelector('#eu [data-a=deep]'); if (d) return { r, j }; e.closeModal(true); e.select(r); } }
    return null;
  });
  console.log('deep target', JSON.stringify(tgt));
  await page.waitForTimeout(300); await shot('3_battle_deep');
  if (tgt) {
    await click('#eu [data-a=deep]'); await shot('4_askdeep'); console.log(' ask:', await dlg());
    await click('#eu [data-a=deepgo]'); await page.waitForTimeout(2500);
    await shot('5_tactical');
    console.log(' tactical: euDeep', await page.evaluate(() => !!__app.euDeep), 'G', await page.evaluate(() => !!__app.G), 'eu hidden', await page.evaluate(() => document.querySelector('#eu').classList.contains('hidden')));
    // имитируем победу ★★★
    await page.evaluate(() => { __app.G.s.result = { win: true, stars: 3, title: 'Тест', text: 'Тестовая победа' }; __app.euDeepResult(); });
    await page.waitForTimeout(500); await shot('6_deepres');
    await page.evaluate(() => document.querySelector('#e-eu').click()); await page.waitForTimeout(1200);
    await shot('7_back');
    console.log(' back: dlg', await dlg(), '| deep state', await page.evaluate(() => JSON.stringify(__app.eu.S.deep)), 'pend', await page.evaluate(() => !!__app.eu.S.deepPend));
    await closeAll();
  }
  // 3) несколько ходов, события
  for (let k = 0; k < 4; k++) { await endTurn(); await closeAll('8_t' + k); }
  console.log('t=', await page.evaluate(() => __app.eu.S.t));
  // 4) перезагрузка → продолжить
  await page.reload(); await page.waitForTimeout(1200);
  console.log('menu label:', await page.evaluate(() => document.querySelector('#m-eu')?.innerText.replace(/\s+/g, ' ')));
  await click('#m-eu'); await page.waitForTimeout(700); await shot('9_hub_cont');
  await click('#eu [data-a=cont]'); await page.waitForTimeout(900);
  console.log('continued t=', await page.evaluate(() => __app.eu.S.t), 'dlg', await dlg());
  await closeAll();
  // 5) итог
  await page.evaluate(() => { const e = __app.eu; e.S.over = { win: true, k: 'total', t: e.S.t }; e.showOver(); });
  await page.waitForTimeout(400); await shot('10_over'); console.log('over:', await dlg());
  await page.evaluate(() => { const b = document.querySelector('#eu .eu-dlg [data-a=mclose]'); b && b.click(); });
  await shot('11_over_map');
  // 6) назад (Android)
  await page.evaluate(() => __app.eu.back()); await page.waitForTimeout(300); await shot('12_back');
  console.log('errors:', errs.length ? errs.join('\n') : 'none');
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
