// E2E: новая карьера → карта фронта → брифинг → операция (пассивно) → итоги → «Дальше» → карта фронта со сдвигом
const { chromium } = require('/vercel/sandbox/node_modules/playwright');
(async () => {
  const W = +(process.env.W || 844), H = +(process.env.H || 390);
  const browser = await chromium.launch({ executablePath: '/usr/local/bin/chromium', args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, isMobile: true, hasTouch: true });
  await ctx.addInitScript(() => { if (!sessionStorage.getItem('x')) { localStorage.clear(); sessionStorage.setItem('x', 1); } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('console', (m) => ['error', 'warning'].includes(m.type()) && errs.push(m.type() + ': ' + m.text()));
  page.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  await page.goto('file:///data/game/dist-single/index.html');
  await page.waitForTimeout(1200);
  await page.click('#m-car'); await page.waitForTimeout(500);
  await page.evaluate(() => __app.showCampNew()); await page.waitForTimeout(300);
  await page.click('#n-go'); await page.waitForTimeout(2500);
  await page.screenshot({ path: 'tools/shots/e2e_0_intro.png' });
  console.log('front visible:', await page.evaluate(() => !document.querySelector('#front').classList.contains('hidden')));
  await page.click('#f-go'); await page.waitForTimeout(800);
  console.log('briefing:', await page.evaluate(() => document.querySelector('#menu .logo')?.textContent));
  await page.click('#n-go');
  const t0 = Date.now();
  while (Date.now() - t0 < (+process.env.MAXMS || 240000)) {
    await page.waitForTimeout(400);
    const st = await page.evaluate(() => {
      const vis = (e) => e && e.offsetParent !== null, m = document.querySelector('#modal');
      const mb = vis(m) ? [...m.querySelectorAll('button')].filter(vis).map((b) => ({ id: b.id, t: b.innerText.trim() })) : [];
      return { mb, res: vis(m) && !!m.querySelector('#e-again'), end: vis(document.querySelector('#endbtn')) };
    });
    if (st.res) break;
    if (st.mb.length) {
      const b = st.mb.find((b) => ['tg-ok', 'o-ok'].includes(b.id)) || st.mb.find((b) => /^(Принято|Продолжить|Понятно|Закрыть|OK|Да|Завершить|Дальше)/.test(b.t)) || st.mb[st.mb.length - 1];
      await page.evaluate(([id, t]) => { const bb = [...document.querySelectorAll('#modal button')].find((x) => (id && x.id === id) || x.innerText.trim() === t); bb && bb.click(); }, [b.id, b.t]);
      continue;
    }
    st.end && (await page.evaluate(() => document.querySelector('#endbtn').click()));
  }
  console.log('result after', ((Date.now() - t0) / 1000).toFixed(0) + 's:', await page.evaluate(() => document.querySelector('#modal .stars')?.querySelectorAll('img').length, ''), await page.evaluate(() => document.querySelector('#e-again')?.innerText));
  await page.screenshot({ path: 'tools/shots/e2e_1_result.png' });
  await page.click('#e-again'); await page.waitForTimeout(1500);
  await page.screenshot({ path: 'tools/shots/e2e_2_front_mid.png' });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: 'tools/shots/e2e_3_front_end.png' });
  console.log('front after result:', await page.evaluate(() => [!document.querySelector('#front').classList.contains('hidden'), document.querySelector('.fm-top span')?.textContent, document.querySelector('.fm-res p')?.textContent]));
  const p = await page.evaluate(() => JSON.parse(localStorage.getItem('wf_camp_v1')));
  console.log('profile ops[0]:', JSON.stringify(p.ops[0]).slice(0, 160));
  console.log('ERRORS:', errs.length ? errs.slice(0, 15).join('\n') : 'none');
  await browser.close(); process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
