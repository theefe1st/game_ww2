// E2E (v0.6.1): «Европа 1939–1945» — дивизии на карте. Хаб → старт → выбор дивизии касанием → марш/отмена →
// атака с прогнозом → формирование дивизии → авиаудар → окна → конец хода (анимация ходов ИИ) → итоги.
// W/H — размер экрана, NAT — держава, Y — год начала, TURNS — сколько ходов сыграть, TAG — префикс скриншотов.
const { chromium } = require('/vercel/sandbox/node_modules/playwright');
(async () => {
  const W = +(process.env.W || 390), H = +(process.env.H || 844), NAT = process.env.NAT || 'GER', Y = process.env.Y || '1939', TAG = process.env.TAG || 'p';
  const TURNS = +(process.env.TURNS || 2), SHOTS = process.env.SHOTS !== '0';
  const browser = await chromium.launch({ executablePath: '/usr/local/bin/chromium', args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await ctx.addInitScript(() => { if (!localStorage.getItem('__e2e')) { localStorage.clear(); localStorage.setItem('__e2e', '1'); } });
  const page = await ctx.newPage();
  const errs = [], fails = [];
  const ok = (c, m) => { if (!c) { fails.push(m); console.log('FAIL', m); } };
  page.on('console', (m) => ['error', 'warning'].includes(m.type()) && errs.push(m.type() + ': ' + m.text()));
  page.on('pageerror', (e) => errs.push('pageerror: ' + e.message + '\n' + e.stack));
  const shot = async (n) => { if (!SHOTS) return; await page.waitForTimeout(260); await page.screenshot({ path: `tools/shots/eu_${TAG}_${n}.png` }); };
  const click = async (sel, wait = 260) => { await page.evaluate((s) => { const b = document.querySelector(s); if (!b) throw new Error('no ' + s); b.click(); }, sel); await page.waitForTimeout(wait); };
  const has = (sel) => page.evaluate((s) => { const e = document.querySelector(s); return !!e && !e.disabled && e.getClientRects().length > 0; }, sel);
  const txt = async (sel, n = 260) => (await page.evaluate((s) => document.querySelector(s)?.innerText || '', sel)).replace(/\s+/g, ' ').slice(0, n);
  const modalOpen = () => page.evaluate(() => !document.querySelector('#eu .eu-modal').classList.contains('hidden'));
  // экранная точка региона: фишка дивизии или пиксель региона, не закрытый фишками
  const ptOf = (j) => page.evaluate((j) => {
    const m = __app.eu.map, cr = m.cv.getBoundingClientRect(), { l, t, r, b } = m.inset;
    const hb = m.hit.find((h) => h[4] === j);
    if (hb) return { x: cr.left + (hb[0] + hb[2]) / 2, y: cr.top + (hb[1] + hb[3]) / 2, tok: 1 };
    let best = null;
    for (let y = t + 6; y < m.H - b - 6; y += 3)
      for (let x = l + 6; x < m.W - r - 6; x += 3) {
        if (m.regionAt(x, y) !== j) continue;
        if (m.hit.some((h) => x >= h[0] - 6 && x <= h[2] + 6 && y >= h[1] - 6 && y <= h[3] + 6)) continue;
        const [mx, my] = m.toMap(x, y);
        if (!best) best = { x, y, n: 0, sx: 0, sy: 0 };
        best.n++; best.sx += x; best.sy += y;
      }
    if (!best) return null;
    // ближайшая к центру масс точка региона
    const cx = best.sx / best.n, cy = best.sy / best.n;
    let q = null, qd = 1e9;
    for (let y = t + 6; y < m.H - b - 6; y += 3)
      for (let x = l + 6; x < m.W - r - 6; x += 3) {
        if (m.regionAt(x, y) !== j || m.hit.some((h) => x >= h[0] - 6 && x <= h[2] + 6 && y >= h[1] - 6 && y <= h[3] + 6)) continue;
        const d = (x - cx) ** 2 + (y - cy) ** 2;
        d < qd && ((qd = d), (q = { x: cr.left + x, y: cr.top + y }));
      }
    return q;
  }, j);
  const tapReg = async (j, what) => {
    await page.waitForTimeout(450);
    const p = await ptOf(j);
    ok(!!p, `no screen point for ${what} (${j})`);
    if (!p) { await page.evaluate((j) => __app.eu.tap(j), j); return false; }
    await page.touchscreen.tap(p.x, p.y);
    await page.waitForTimeout(320);
    return true;
  };
  const overflow = () => page.evaluate(() => {
    const out = [], vw = innerWidth, vh = innerHeight;
    for (const e of document.querySelectorAll('#eu .eu-top *, #eu .eu-rail *, #eu .eu-sheet *, #eu .eu-dlg *')) {
      if (!e.getClientRects().length) continue;
      const r = e.getBoundingClientRect();
      if (r.width < 2) continue;
      if (r.right > vw + 1 || r.left < -1) out.push(`${e.className || e.tagName}: x ${Math.round(r.left)}..${Math.round(r.right)}`);
      if ((e.tagName === 'B' || e.tagName === 'SMALL' || e.tagName === 'SPAN') && e.scrollWidth > e.clientWidth + 2 && getComputedStyle(e).overflow === 'hidden') out.push(`clip ${e.className || e.tagName}: "${e.innerText.slice(0, 30)}"`);
    }
    return [...new Set(out)].slice(0, 12);
  });
  await page.goto('file:///data/game/dist-single/index.html');
  await page.waitForTimeout(1200);
  console.log('font Rubik:', await page.evaluate(async () => { await document.fonts.ready; return document.fonts.check('700 14px Rubik'); }));
  await click('#m-eu', 900);
  await shot('0_hub');
  await click(`[data-a=opt][data-k=nat][data-v=${NAT}]`);
  await click(`[data-a=opt][data-k=start][data-v="${Y}"]`);
  await click('#eu [data-a=start]', 1500);
  await shot('1_intro');
  await click('#eu [data-a=mflow]', 900);
  await shot('2_map');
  console.log('overflow map:', JSON.stringify(await overflow()));
  const info = await page.evaluate(() => { const e = __app.eu, S = e.S; return { t: S.t, units: S.units.filter((u) => u.n === S.player).length, ready: e.readyS.size, z: +e.map.z.toFixed(2), hit: e.map.hit.length }; });
  console.log('start', JSON.stringify(info));
  ok(info.ready > 0, 'no ready units');
  // ——— дивизии: найти атаку и марш ———
  const pick = await page.evaluate(() => {
    const e = __app.eu, S = e.S, P = S.player, out = { atk: null, mv: null };
    for (const u of S.units) {
      if (u.n !== P || !e.readyS.has(u.id)) continue;
      e.sel = u.r; e.updateHL();
      const ks = [...e.tg.entries()];
      const a = ks.find((x) => x[1] === 'attack');
      a && !out.atk && (out.atk = { r: u.r, j: a[0], id: u.id, nm: u.nm });
      const m = ks.find((x) => x[1] === 'move' || x[1] === 'capture');
      m && !out.mv && (!out.atk || out.atk.id !== u.id) && (out.mv = { r: u.r, j: m[0], k: m[1], id: u.id, nm: u.nm });
      if (out.atk && out.mv) break;
    }
    e.sel = 0; e.updateHL(); e.render();
    return out;
  });
  console.log('pick', JSON.stringify(pick));
  if (pick.mv) {
    await page.evaluate((r) => __app.eu.map.reveal(r, 0), pick.mv.r);
    await tapReg(pick.mv.r, 'own unit');
    const s1 = await page.evaluate(() => ({ sel: __app.eu.sel, tg: __app.eu.tg.size }));
    ok(s1.sel === pick.mv.r, `tap did not select unit: sel=${s1.sel} want ${pick.mv.r}`);
    await shot('3_sel');
    console.log('unit card:', await txt('#eu .eu-sheet'));
    console.log('overflow sel:', JSON.stringify(await overflow()));
    await tapReg(pick.mv.j, 'move target');
    await page.waitForTimeout(500);
    const s2 = await page.evaluate((id) => { const u = __app.eu.unit(id); return { r: u?.r, undo: __app.eu.undo.length }; }, pick.mv.id);
    ok(s2.r === pick.mv.j, `move failed: r=${s2.r} want ${pick.mv.j}`);
    await shot('4_moved');
    await click('#eu [data-a=undo]', 400);
    const s3 = await page.evaluate((id) => __app.eu.unit(id)?.r, pick.mv.id);
    ok(s3 === pick.mv.r, `undo failed: r=${s3}`);
  }
  if (pick.atk) {
    await page.evaluate(() => __app.eu.select(0));
    await page.evaluate((r) => __app.eu.map.reveal(r, 0), pick.atk.r);
    await tapReg(pick.atk.r, 'attacker');
    await tapReg(pick.atk.j, 'attack target');
    const pv = await page.evaluate(() => __app.eu.pv && { k: __app.eu.pv.k, win: __app.eu.pv.e?.win });
    ok(!!pv, 'attack preview did not open');
    await shot('5_atk');
    console.log('atk card:', await txt('#eu .eu-sheet', 400));
    console.log('overflow atk:', JSON.stringify(await overflow()));
    if (pv && process.env.DEEP === '1' && (await has('#eu [data-a=deep]'))) {
      // «Лично»: тактическая битва и возврат (выход в меню — бой решает штаб)
      await click('#eu [data-a=deep]', 400);
      await shot('6d_deepask');
      await click('#eu [data-a=deepgo]', 2600);
      const tac = await page.evaluate(() => ({ eu: !document.querySelector('#eu').classList.contains('hidden'), deep: !!__app.euDeep, g: !!__app.G }));
      console.log('deep started', JSON.stringify(tac));
      ok(tac.deep && !tac.eu, 'deep battle did not start');
      await shot('6e_tactical');
      await page.evaluate(() => __app.showMenu());
      await page.waitForTimeout(900);
      const back = await page.evaluate(() => ({ eu: !document.querySelector('#eu').classList.contains('hidden'), pend: __app.eu.S.deepPend, op: __app.eu.S.deep }));
      console.log('deep back', JSON.stringify(back), await txt('#eu .eu-rep'));
      ok(back.eu && !back.pend, 'did not return from deep battle');
      await shot('6f_deepback');
    } else if (pv) {
      await click('#eu [data-a=fire]', 900);
      console.log('report:', await txt('#eu .eu-rep'));
      await shot('6_fired');
    }
  }
  // вражеская дивизия: карточка с атакующими
  const foe = await page.evaluate(() => { const e = __app.eu, S = e.S; for (const [j, k] of e.tg) if (k === 'attack') return j; const u = S.units.find((u) => u.n !== S.player && e.attackers(u.r).length); return u ? u.r : 0; });
  if (foe) {
    await page.evaluate((j) => { __app.eu.select(0); __app.eu.select(j); }, foe);
    await page.waitForTimeout(500);
    await shot('6b_foe');
    console.log('foe card:', await txt('#eu .eu-sheet', 300));
  }
  // ——— формирование дивизии ———
  const site = await page.evaluate(() => {
    const e = __app.eu, S = e.S, P = S.player;
    for (let i = 1; i < S.ctrl.length; i++) {
      if (S.ctrl[i] !== P || S.units.some((u) => u.r === i)) continue;
      e.select(i);
      if (document.querySelector('#eu [data-a=build]:not([disabled])')) return i;
    }
    e.select(0);
    return 0;
  });
  console.log('build site', site);
  ok(site > 0, 'no build site');
  if (site) {
    await page.evaluate((i) => { __app.eu.select(0); __app.eu.map.reveal(i, 0); }, site);
    await tapReg(site, 'build site');
    await shot('7_prov');
    console.log('prov card:', await txt('#eu .eu-sheet', 400));
    console.log('overflow prov:', JSON.stringify(await overflow()));
    const n0 = await page.evaluate(() => __app.eu.S.units.length);
    await click('#eu [data-a=build]:not([disabled])', 500);
    const n1 = await page.evaluate((i) => ({ n: __app.eu.S.units.length, at: __app.eu.S.units.find((u) => u.r === i)?.t }), site);
    ok(n1.n === n0 + 1 && n1.at, `build failed ${JSON.stringify(n1)}`);
    await shot('8_built');
  }
  // ——— авиация ———
  await page.evaluate(() => __app.eu.select(0));
  const air = await page.evaluate(() => __app.eu.S.nat[__app.eu.S.player].air || 0);
  if (air > 0) {
    await click('#eu [data-a=airmode]', 400);
    const tg = await page.evaluate(() => [...__app.eu.tg.keys()]);
    console.log('air targets', tg.length);
    await shot('9_airmode');
    if (tg.length) {
      await page.evaluate((j) => __app.eu.map.reveal(j, 0), tg[0]);
      await tapReg(tg[0], 'air target');
      const pv = await page.evaluate(() => __app.eu.pv?.k);
      ok(pv === 'air', 'air preview did not open');
      await shot('9b_aircard');
      pv && (await click('#eu [data-a=fire]', 700));
      console.log('air report:', await txt('#eu .eu-rep'));
    }
    (await has('#eu [data-a=mcancel]')) && (await click('#eu [data-a=mcancel]'));
  }
  // ——— окна ———
  for (const [a, n] of [['eco', 'a_eco'], ['air', 'b_air'], ['tech', 'c_tech'], ['pow', 'd_pow'], ['log', 'e_log'], ['menu', 'f_menu']]) {
    await click(`#eu [data-a=${a}]`, 350);
    await shot(n);
    const ov = await overflow();
    ov.length && console.log(`overflow ${a}:`, JSON.stringify(ov));
    if (a === 'menu') { await click('#eu .eu-dlg [data-a=help]', 300); await shot('g_help'); }
    await click('#eu [data-a=mclose]', 200);
  }
  await click('#eu [data-a=mapmode]'); await shot('h_terrain');
  await click('#eu [data-a=mapmode]'); await shot('h_supply');
  await click('#eu [data-a=mapmode]');
  // ——— ходы ———
  for (let k = 0; k < TURNS; k++) {
    const t0 = await page.evaluate(() => __app.eu.S.t);
    await click('#eu [data-a=end]', 150);
    if (await page.evaluate(() => !__app.eu.busy && __app.eu.endArm)) await click('#eu [data-a=end]', 100);
    await page.waitForTimeout(700);
    await shot(`t${k}_ai`);
    const T0 = Date.now();
    while ((await page.evaluate(() => __app.eu.busy)) && Date.now() - T0 < 60000) await page.waitForTimeout(200);
    const dt = Date.now() - T0;
    await page.waitForTimeout(300);
    const t1 = await page.evaluate(() => __app.eu.S.t);
    ok(t1 === t0 + 1, `turn did not advance ${t0}→${t1}`);
    console.log(`turn ${t0}→${t1} in ${dt} ms; modal:`, (await modalOpen()) ? await txt('#eu .eu-dlg', 240) : '-');
    await shot(`t${k}_sum`);
    for (let q = 0; q < 8 && (await modalOpen()); q++) {
      if (await has('#eu [data-a=evopt]')) { console.log('event:', await txt('#eu .eu-dlg h2', 80)); await click('#eu [data-a=evopt]', 300); }
      else if (await has('#eu .eu-dlg [data-a=mclose]')) await click('#eu .eu-dlg [data-a=mclose]', 300);
      else if (await has('#eu .eu-dlg [data-a=mflow]')) await click('#eu .eu-dlg [data-a=mflow]', 300);
      else break;
    }
    await shot(`t${k}_map`);
  }
  // сохранение и продолжение
  const sv = await page.evaluate(() => { __app.eu.save(); return !!localStorage.getItem('wf_eu_v2'); });
  ok(sv, 'save missing');
  await page.reload();
  await page.waitForFunction(() => window.__app && document.querySelector('#m-eu'), null, { timeout: 20000 });
  await page.waitForTimeout(800);
  await click('#m-eu', 800);
  await page.waitForFunction(() => document.querySelector('#eu [data-a=start]'), null, { timeout: 8000 }).catch(() => {});
  if (!(await has('#eu [data-a=cont]'))) {
    ok(false, 'no continue button');
    console.log('diag:', await page.evaluate(() => JSON.stringify({ keys: Object.keys(localStorage), meta: localStorage.getItem('wf_eu_v2_meta'), len: localStorage.getItem('wf_eu_v2')?.length, hub: !document.querySelector('#eu .eu-hub')?.classList.contains('hidden'), btns: [...document.querySelectorAll('#eu [data-a]')].map((b) => b.dataset.a).join(' '), menu: !!document.querySelector('#menu:not(.hidden)'), eu: getComputedStyle(document.querySelector('#eu')).display })));
  }
  await click('#eu [data-a=cont]', 800);
  const t2 = await page.evaluate(() => __app.eu.S?.t);
  console.log('continued at t', t2);
  await shot('z_cont');
  console.log('errors:', errs.length ? errs.slice(0, 10).join('\n') : 'none');
  console.log(fails.length ? `FAILS ${fails.length}: ${fails.join('; ')}` : 'ALL OK');
  await browser.close();
  process.exit(fails.length || errs.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
