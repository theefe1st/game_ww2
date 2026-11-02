const { chromium } = require('playwright');
// usage: STEPS='text1|text2|...' node walk.cjs ; each step clicks the first visible clickable whose text includes stepText (or CSS if starts with css:)
(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/local/bin/chromium', args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width: +(process.env.W||844), height: +(process.env.H||390) }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const errs = [];
  page.on('console', m => { if (['error', 'warning'].includes(m.type())) errs.push(m.type() + ': ' + m.text()); });
  page.on('pageerror', e => errs.push('pageerror: ' + e.message));
  await page.goto(process.env.URL || 'file:///data/game/dist-single/index.html');
  await page.waitForTimeout(1500);
  const steps = (process.env.STEPS || '').split('|').filter(Boolean);
  const list = async () => (await page.$$eval('button, [role=button], .btn, input, select', els => els.filter(e => e.offsetParent !== null && getComputedStyle(e).visibility!=='hidden').map(e => (e.tagName[0] + '#' + (e.id||'') + ' :: ' + (e.innerText||e.value||e.placeholder||'').replace(/\s+/g, ' ').trim()).slice(0, 110)))).join('\n');
  let i = 0;
  for (const st of steps) {
    i++;
    if (st.startsWith('wait:')) { await page.waitForTimeout(+st.slice(5)); continue; }
    if (st.startsWith('type:')) { const [sel, val] = st.slice(5).split('='); await page.fill(sel, val); continue; }
    if (st.startsWith('shot:')) { await page.screenshot({ path: st.slice(5) + '.png' }); console.log('== shot', st.slice(5)); continue; }
    if (st.startsWith('list')) { console.log('-- visible:\n' + await list()); continue; }
    if (st.startsWith('tap:')) { const [x, y] = st.slice(4).split(',').map(Number); await page.mouse.click(x, y); await page.waitForTimeout(500); continue; }
    if (st.startsWith('eval:')) { console.log('eval>', JSON.stringify(await page.evaluate(st.slice(5))).slice(0,1500)); continue; }
    let ok = false;
    if (st.startsWith('text:')) { const l = page.getByText(st.slice(5)).first(); if (await l.count()) { await l.click(); ok = true; } }
    else if (st.startsWith('css:')) { const el = await page.$(st.slice(4)); if (el) { await el.click(); ok = true; } }
    else {
      const loc = page.locator('button:visible, [role=button]:visible, .btn:visible').filter({ hasText: st }).first();
      if (await loc.count()) { await loc.click(); ok = true; }
    }
    console.log(`step ${i} "${st}": ${ok ? 'clicked' : 'NOT FOUND'}`);
    await page.waitForTimeout(800);
  }
  console.log('ERRORS:', errs.length ? errs.join('\n') : 'none');
  await browser.close(); process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
