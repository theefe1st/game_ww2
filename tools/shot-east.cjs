// Снимки «Восточного фронта» по шагам (Playwright + Chromium).
// STEPS="имя|js;;имя|js" — js выполняется в странице (можно await; window.__east — интерфейс EastUI), после шага — снимок.
// Перед шагами: меню → новая игра (SIDE SOV|GER, MODE hist|free, START — дата старта, если есть выбор) → ход ИИ → карточки закрыты.
// Шаг с именем «tap…»: js возвращает [x, y] — после шага касание в этой точке (TAPJS — js проверки после касания).
// NEW=0 — остаться в меню. W H DPR — экран, OUT — папка снимков, TAG — префикс, WAIT — пауза перед снимком, мс.
// Пример: STEPS="fronts|__east.openPanel('dirs')" node tools/shot-east.cjs
const { chromium } = require('/vercel/sandbox/node_modules/playwright');
const fs = require('fs');
(async () => {
  const W = +(process.env.W || 844), H = +(process.env.H || 390), SIDE = process.env.SIDE || 'SOV', MODE = process.env.MODE || 'hist';
  const URL = process.env.URL || 'http://127.0.0.1:5173/', OUT = process.env.OUT || '/data/work/shots', TAG = process.env.TAG || 's';
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ executablePath: '/usr/local/bin/chromium', args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, isMobile: true, hasTouch: true, deviceScaleFactor: +(process.env.DPR || 1.5) });
  await ctx.addInitScript(() => { if (!sessionStorage.getItem('__s')) { localStorage.clear(); sessionStorage.setItem('__s', '1'); } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
  page.on('pageerror', (e) => errs.push('pageerror: ' + e.message + ' ' + (e.stack || '').split('\n').slice(1, 3).join(' ')));
  const ev = (fn, a) => page.evaluate(fn, a);
  const click = async (sel, wait = 300) => { await ev((s) => { const b = document.querySelector(s); if (!b) throw new Error('no ' + s); b.click(); }, sel); await page.waitForTimeout(wait); };
  const waitIdle = async (ms = 120000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await ev(() => !window.__east?.isBusy)) return true; await page.waitForTimeout(200); } return false; };
  const drain = async () => {
    for (let i = 0; i < 20; i++) {
      const open = await ev(() => { const m = document.querySelector('.e-modal'); return !!m && !m.classList.contains('hidden'); });
      if (!open) return;
      await ev(() => { const m = document.querySelector('.e-modal'); const b = m.querySelector('[data-a=evc]') || m.querySelector('[data-a=next]') || m.querySelector('[data-a=close]') || m.querySelector('.e-btn.gold') || m.querySelector('button'); if (b) b.click(); });
      await page.waitForTimeout(400);
    }
  };
  await page.goto(URL);
  await page.waitForSelector('.east .e-menu', { timeout: 30000 });
  await page.waitForTimeout(1000);
  if (process.env.NEW !== '0') {
    await click('[data-a=play]'); await click(`[data-v="side:${SIDE}"]`); await click(`[data-v="mode:${MODE}"]`);
    if (process.env.START) await click(`[data-v="start:${process.env.START}"]`);
    await click('[data-a=start]', 200);
    await waitIdle(); await page.waitForTimeout(400); await drain();
    await ev(() => document.querySelector('.e-tip [data-a=tipok]')?.click());
  }
  const steps = (process.env.STEPS || 'map|0').split(';;');
  let n = 0;
  for (const st of steps) {
    const i = st.indexOf('|'), name = st.slice(0, i), js = st.slice(i + 1);
    try {
      const r = await ev(`(async()=>{${js}})()`);
      if (r !== undefined && r !== null) console.log(name, '→', typeof r === 'string' ? r.slice(0, 1500) : JSON.stringify(r).slice(0, 1500));
      // шаг «tap…»: js возвращает [x, y] (CSS px окна) — настоящее касание мышью (pointer-события с захватом)
      if (name.startsWith('tap') && Array.isArray(r)) { await page.mouse.click(r[0], r[1]); await page.waitForTimeout(400); if (process.env.TAPJS) console.log(name, '⇒', await ev(`(async()=>{${process.env.TAPJS}})()`)); }
    } catch (e) { console.log('step', name, 'error:', e.message.slice(0, 300)); }
    await waitIdle(); await page.waitForTimeout(+(process.env.WAIT || 700));
    if (process.env.DRAIN === '1') await drain();
    const p = `${OUT}/${TAG}_${String(++n).padStart(2, '0')}_${name}.png`;
    await page.screenshot({ path: p }); console.log('shot', p);
  }
  if (errs.length) console.log('ERRORS:\n' + errs.slice(0, 10).join('\n'));
  await browser.close(); process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
