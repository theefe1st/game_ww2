const { chromium } = require('playwright');
(async () => {
  const W = +(process.env.W || 844), H = +(process.env.H || 390);
  const browser = await chromium.launch({ executablePath: '/usr/local/bin/chromium', args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  const errs = [];
  page.on('console', m => { if (['error', 'warning'].includes(m.type())) errs.push(m.type() + ': ' + m.text()); });
  page.on('pageerror', e => errs.push('pageerror: ' + e.message));
  await page.goto(process.env.URL || 'file:///data/game/dist-single/index.html#arch'); await page.waitForTimeout(1200);
  const clickText = async t => page.evaluate(t => { const b = [...document.querySelectorAll('button,.btn,[role=button],div,li')].find(e => e.offsetParent && e.innerText && e.innerText.trim().startsWith(t) && e.children.length < 6); if (b) { b.click(); return true; } return false; }, t);
  await page.click('#m-car'); await page.waitForTimeout(500);
  await page.getByText(process.env.CARD || 'Отдельные операции').first().click(); await page.waitForTimeout(800);
  await page.getByText(process.env.OP || 'Смоленск 1941', { exact: true }).first().click(); await page.waitForTimeout(800);
  await page.click('#n-go');
  const seen = new Set(); const t0 = Date.now(); let lastTurn = '', shots = 0;
  while (Date.now() - t0 < (+process.env.MAXMS || 170000)) {
    await page.waitForTimeout(500);
    const st = await page.evaluate(() => {
      const vis = e => e && e.offsetParent !== null;
      const modal = document.querySelector('#modal');
      const mb = vis(modal) ? [...modal.querySelectorAll('button')].filter(vis).map(b => ({ id: b.id, t: b.innerText.replace(/\s+/g, ' ').trim() })) : [];
      const title = vis(modal) ? (modal.querySelector('h1,h2,h3,.title,.mt')?.innerText || modal.innerText.slice(0, 60)).replace(/\s+/g, ' ') : '';
      const top = document.body.innerText.match(/Ход \d+\/\d+/)?.[0] || '';
      return { mb, title, top, end: vis(document.querySelector('#endbtn')), fast: vis(document.querySelector('#b-fast')), body: document.body.innerText.slice(0, 200).replace(/\s+/g, ' ') };
    });
    if (st.top && st.top !== lastTurn) { console.log(((Date.now() - t0) / 1000).toFixed(1) + 's', st.top); lastTurn = st.top; }
    const key = st.title.slice(0, 40) + ' [' + st.mb.map(b => b.id + ':' + b.t).join(', ') + ']';
    if (st.mb.length && !seen.has(key)) { seen.add(key); console.log('  modal:', key); }
    if (/Итоги|итоги операции/i.test(st.title) || /Итоги операции/.test(st.body)) { await page.screenshot({ path: '/data/game/tools/shots/res_' + (process.env.TAG || 'op') + '.png' }); console.log('RESULT TEXT:\n' + (await page.evaluate(() => document.querySelector('#modal').innerText)).replace(/\n{2,}/g, '\n')); console.log('RESULTS reached at', ((Date.now() - t0) / 1000).toFixed(1) + 's'); break; }
    if (st.mb.length) {
      const pref = ['tg-ok', 'o-ok'];
      let b = st.mb.find(b => pref.includes(b.id)) || st.mb.find(b => /^(Принято|Продолжить|Понятно|Закрыть|OK|Да|Завершить|Конец хода|Дальше|Дальше ›)/.test(b.t)) || st.mb[st.mb.length - 1];
      await page.evaluate(([id, t]) => { const m = document.querySelector('#modal'); const bb = [...m.querySelectorAll('button')].find(x => (id && x.id === id) || x.innerText.replace(/\s+/g, ' ').trim() === t); bb && bb.click(); }, [b.id, b.t]);
      continue;
    }
    if (st.end) { await page.evaluate(() => document.querySelector('#endbtn').click()); continue; }
    if (st.fast) { await page.evaluate(() => document.querySelector('#b-fast').click()); }
  }
  if (!seen.size) console.log('no modals seen');
  console.log('ERRORS:', errs.length ? errs.slice(0, 15).join('\n') : 'none');
  await browser.close(); process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
