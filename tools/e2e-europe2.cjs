// E2E-2 (v0.6.1): «Европа» — решение «Барбаросса» за Германию 1941, ж/д переброска и отмена, морская переброска,
// кнопка «назад» Android, конец войны (итоги, звёзды) и возврат в хаб.
const { chromium } = require('/vercel/sandbox/node_modules/playwright');
(async () => {
  const W = +(process.env.W || 390), H = +(process.env.H || 844), TAG = process.env.TAG || 'p';
  const browser = await chromium.launch({ executablePath: '/usr/local/bin/chromium', args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await ctx.addInitScript(() => { if (!localStorage.getItem('__e2e')) { localStorage.clear(); localStorage.setItem('__e2e', '1'); } });
  const page = await ctx.newPage();
  const errs = [], fails = [];
  const ok = (c, m) => { if (!c) { fails.push(m); console.log('FAIL', m); } };
  page.on('console', (m) => ['error', 'warning'].includes(m.type()) && errs.push(m.type() + ': ' + m.text()));
  page.on('pageerror', (e) => errs.push('pageerror: ' + e.message + '\n' + e.stack));
  const shot = async (n) => { await page.waitForTimeout(260); await page.screenshot({ path: `tools/shots/eu2_${TAG}_${n}.png` }); };
  const click = async (sel, w = 300) => { await page.evaluate((s) => { const b = document.querySelector(s); if (!b) throw new Error('no ' + s); b.click(); }, sel); await page.waitForTimeout(w); };
  const dlg = () => page.evaluate(() => { const m = document.querySelector('#eu .eu-dlg'); return m && m.offsetParent !== null ? m.innerText.replace(/\s+/g, ' ').slice(0, 200) : null; });
  await page.goto('file:///data/game/dist-single/index.html#arch');
  await page.waitForTimeout(1200);
  await click('#m-eu', 700);
  await click('[data-a=opt][data-k=nat][data-v=GER]');
  await click('[data-a=opt][data-k=start][data-v="1941"]');
  await click('#eu [data-a=start]', 1600);
  await click('#eu [data-a=mflow]', 500);
  // 1) решение «Барбаросса»
  const ev = await dlg();
  console.log('event:', ev);
  ok(ev && ev.includes('22 июня'), 'no Barbarossa decision');
  await shot('1_barb');
  await click('#eu [data-a=evopt][data-k="0"]', 600);
  const war = await page.evaluate(() => { const S = __app.eu.S; return S.wars ? JSON.stringify(S.wars).includes('GER') : null; });
  const atw = await page.evaluate(() => __app.eu.S.units.some((u) => u.n === 'GER' && [...(__app.eu.select(u.r), __app.eu.tg.values())].includes('attack')));
  console.log('war with SOV: attack targets exist =', atw);
  ok(atw, 'no attack targets after Barbarossa');
  await page.evaluate(() => __app.eu.select(0));
  // 2) ж/д + отмена
  const rail = await page.evaluate(() => {
    const e = __app.eu, S = e.S;
    for (const u of S.units) {
      if (u.n !== S.player) continue;
      e.select(u.r);
      const b = document.querySelector('#eu [data-a=rail]');
      if (b) { b.click(); return { id: u.id, r: u.r, n: e.tg.size, mode: e.mode?.k, first: [...e.tg.keys()].pop() }; }
    }
    return null;
  });
  console.log('rail', JSON.stringify(rail));
  ok(rail && rail.mode === 'rail' && rail.n > 0, 'rail mode failed');
  await page.waitForTimeout(500);
  await shot('2_railmode');
  if (rail) {
    await page.evaluate((j) => __app.eu.tap(j), rail.first);
    await page.waitForTimeout(700);
    const r1 = await page.evaluate((id) => __app.eu.unit(id).r, rail.id);
    ok(r1 === rail.first, `rail move failed ${r1}`);
    await shot('3_railed');
    await click('#eu [data-a=undo]', 400);
    const r2 = await page.evaluate((id) => __app.eu.unit(id).r, rail.id);
    ok(r2 === rail.r, `rail undo failed ${r2}`);
  }
  // 3) морем (если есть порт)
  const sea = await page.evaluate(() => {
    const e = __app.eu, S = e.S;
    for (const u of S.units) {
      if (u.n !== S.player) continue;
      e.select(u.r);
      const b = document.querySelector('#eu [data-a=sea]');
      if (b) { b.click(); return { id: u.id, r: u.r, n: e.tg.size, first: [...e.tg.keys()][0] }; }
    }
    e.select(0);
    return null;
  });
  console.log('sea', JSON.stringify(sea));
  if (sea && sea.n) {
    await page.evaluate((j) => __app.eu.tap(j), sea.first);
    await page.waitForTimeout(800);
    ok((await page.evaluate((id) => __app.eu.unit(id).r, sea.id)) === sea.first, 'sea move failed');
    await shot('4_sea');
    await click('#eu [data-a=undo]', 300);
  }
  // 4) «назад» Android: выбор → снять, пусто → меню, меню → закрыть
  await page.evaluate(() => { const e = __app.eu, u = e.S.units.find((u) => u.n === e.S.player); e.select(u.r); });
  const b1 = await page.evaluate(() => (__app.eu.back(), __app.eu.sel));
  ok(b1 === 0, 'back did not deselect');
  const b2 = await page.evaluate(() => (__app.eu.back(), !document.querySelector('#eu .eu-modal').classList.contains('hidden')));
  ok(b2, 'back did not open menu');
  await shot('5_backmenu');
  const b3 = await page.evaluate(() => (__app.eu.back(), document.querySelector('#eu .eu-modal').classList.contains('hidden')));
  ok(b3, 'back did not close menu');
  // 5) конец войны
  await page.evaluate(() => { const e = __app.eu; e.S.over = { win: true, k: 'total', t: e.S.t }; e.flow(); });
  await page.waitForTimeout(500);
  const over = await dlg();
  console.log('over:', over);
  ok(over && over.includes('Победа'), 'no victory modal');
  await shot('6_over');
  await click('#eu .eu-dlg [data-a=mclose]', 400);
  await shot('7_overcard');
  ok(await page.evaluate(() => !!document.querySelector('#eu .eu-sheet [data-a=hub]')), 'no over card');
  await click('#eu .eu-sheet [data-a=hub]', 700);
  ok(await page.evaluate(() => !document.querySelector('#eu .eu-hub').classList.contains('hidden')), 'hub not shown');
  await shot('8_hub');
  console.log('best stars GER:', await page.evaluate(() => localStorage.getItem('wf_eu_best_GER')));
  console.log('errors:', errs.length ? errs.slice(0, 10).join('\n') : 'none');
  console.log(fails.length ? `FAILS ${fails.length}: ${fails.join('; ')}` : 'ALL OK');
  await browser.close();
  process.exit(fails.length || errs.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
