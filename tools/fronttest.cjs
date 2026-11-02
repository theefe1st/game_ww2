// UI-тест «Карты фронта»: node tools/fronttest.cjs [W H] → tools/shots/fm_<scen>_<W>x<H>_<n>.png
const { chromium } = require('/vercel/sandbox/node_modules/playwright');
const W = +(process.argv[2] || 844), H = +(process.argv[3] || 390), ONLY = process.env.ONLY;
const rec = (s, extra = {}) => ({ stars: s, kills: 4, lost: 1, add: [], dead: [], xp: {}, rep: { trust: 55, auth: 50, fame: 45 }, done: 2, total: 3, promoted: s >= 2, ...extra });
const prof = (n, stars, route2) => {
  const ops = [null, null, null, null, null, null, null];
  for (let i = 0; i < n; i++) ops[i] = rec(stars[i] ?? 2);
  return { v: 2, name: 'Иван Соколов', short: 'Соколов', diff: 1, route: ['smolensk41', 'moscow41', route2 || null, 'stalingrad42', 'kursk43', 'bagration44', 'berlin45'], ops, fails: [0, 0, 0, 0, 0, 0, 0], created: 1 };
};
const SC = [
  { id: 'intro', p: null, run: `__app.showCampNew(); document.querySelector('#n-go').click();`, shots: [300, 2600] },
  { id: 'after0', p: prof(1, [3]), run: `__app.showMenu(); __app.showDossier(); __app.showFrontMap({after:0});`, shots: [200, 1500, 3800] },
  { id: 'choice', p: prof(2, [2, 3]), run: `__app.showMenu(); __app.showDossier(); __app.showFrontMap({after:1});`, shots: [3800], then: [`document.querySelector('.fm-card[data-r=rzhev42]').click()`, 1200, `document.querySelector('#f-go').click()`, 900] },
  { id: 'dossier2', p: prof(2, [2, 2]), run: `__app.showMenu(); __app.showDossier();`, shots: [400] },
  { id: 'after2kh', p: prof(3, [2, 2, 1], 'kharkov42'), run: `__app.showMenu(); __app.showDossier(); __app.showFrontMap({after:2});`, shots: [1400, 4200] },
  { id: 'final', p: prof(7, [3, 3, 3, 2, 3, 3, 3], 'rzhev42'), run: `__app.showMenu(); __app.showDossier(); __app.showFrontMap({after:6});`, shots: [1600, 4500] },
  { id: 'brief3', p: prof(3, [2, 2, 3], 'rzhev42'), run: `__app.showMenu(); __app.showBriefing(3);`, shots: [600] },
];
(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/local/bin/chromium', args: ['--no-sandbox'] });
  let errs = [];
  for (const sc of SC) {
    if (ONLY && !ONLY.split(',').includes(sc.id)) continue;
    const ctx = await browser.newContext({ viewport: { width: W, height: H }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
    await ctx.addInitScript((p) => { try { localStorage.clear(); p && localStorage.setItem('wf_camp_v1', JSON.stringify(p)); } catch {} }, sc.p);
    const page = await ctx.newPage();
    page.on('console', (m) => ['error', 'warning'].includes(m.type()) && errs.push(sc.id + ' ' + m.type() + ': ' + m.text()));
    page.on('pageerror', (e) => errs.push(sc.id + ' pageerror: ' + e.message));
    await page.goto('file:///data/game/dist-single/index.html');
    await page.waitForTimeout(1200);
    await page.evaluate(sc.run);
    let t = 0, n = 0;
    for (const at of sc.shots) {
      await page.waitForTimeout(at - t); t = at;
      await page.screenshot({ path: `tools/shots/fm_${sc.id}_${W}x${H}_${n++}.png` });
    }
    for (let i = 0; sc.then && i < sc.then.length; i += 2) {
      await page.evaluate(sc.then[i]);
      await page.waitForTimeout(sc.then[i + 1]);
      await page.screenshot({ path: `tools/shots/fm_${sc.id}_${W}x${H}_${n++}.png` });
    }
    console.log('ok', sc.id, n);
    await ctx.close();
  }
  console.log('ERRORS:', errs.length ? errs.join('\n') : 'none');
  await browser.close();
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
