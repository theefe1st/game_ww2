// Скриншоты всех режимов (проверка шрифта и читаемости): меню, тактическая битва, карта фронта.
const { chromium } = require('/vercel/sandbox/node_modules/playwright');
(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/local/bin/chromium', args: ['--no-sandbox'] });
  const errs = [];
  for (const [W, H, tag] of [[390, 844, 'p'], [844, 390, 'l']]) {
    const ctx = await browser.newContext({ viewport: { width: W, height: H }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
    await ctx.addInitScript(() => { if (!localStorage.getItem('__e2e')) { localStorage.clear(); localStorage.setItem('__e2e', '1'); } });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
    page.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
    await page.goto('file:///data/game/dist-single/index.html#arch');
    await page.waitForTimeout(1300);
    await page.screenshot({ path: `tools/shots/mode_${tag}_0_menu.png` });
    await page.click('#m-new'); await page.waitForTimeout(600);
    await page.screenshot({ path: `tools/shots/mode_${tag}_1_new.png` });
    const go = await page.$('#n-go');
    if (go) { await go.click(); await page.waitForTimeout(2600); }
    await page.screenshot({ path: `tools/shots/mode_${tag}_2_battle.png` });
    // закрыть брифинг/подсказки, если есть
    await page.evaluate(() => { const b = [...document.querySelectorAll('#modal button')].find((b) => b.offsetParent); b && b.click(); });
    await page.waitForTimeout(900);
    await page.screenshot({ path: `tools/shots/mode_${tag}_3_battle2.png` });
    await page.goto('file:///data/game/dist-single/index.html#arch');
    await page.waitForTimeout(1200);
    await page.click('#m-car'); await page.waitForTimeout(500);
    await page.evaluate(() => __app.showCampNew()); await page.waitForTimeout(300);
    await page.click('#n-go'); await page.waitForTimeout(2500);
    await page.screenshot({ path: `tools/shots/mode_${tag}_4_front.png` });
    await ctx.close();
  }
  console.log('errors:', errs.length ? errs.join('\n') : 'none');
  await browser.close();
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(2); });
