// E2E (v0.8): «Барбаросса 1941», глава «Граница». Меню → хаб → брифинг → ход соседей → выбор дивизии →
// прогноз и удар → марш и «Отменить» → авиация → способность → советник/разведка/снабжение → «Конец дня» →
// ход противника → решения → прохождение до итогов (свои дивизии ведёт ИИ) → итоги → «Назад» → «Продолжить».
// W/H — экран, SIDE — GER/SOV, TAG — префикс скриншотов, DAYS — сколько дней играть (по умолчанию все 9).
const { chromium } = require('/vercel/sandbox/node_modules/playwright');
(async () => {
  const W = +(process.env.W || 844), H = +(process.env.H || 390), SIDE = process.env.SIDE || 'GER', TAG = process.env.TAG || 'l';
  const DAYS = +(process.env.DAYS || 9), SHOTS = process.env.SHOTS !== '0';
  const browser = await chromium.launch({ executablePath: '/usr/local/bin/chromium', args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await ctx.addInitScript(() => { if (!localStorage.getItem('__e2e')) { localStorage.clear(); localStorage.setItem('__e2e', '1'); } });
  const page = await ctx.newPage();
  const errs = [], fails = [];
  const ok = (c, m) => { if (!c) { fails.push(m); console.log('FAIL', m); } };
  page.on('console', (m) => ['error', 'warning'].includes(m.type()) && errs.push(m.type() + ': ' + m.text()));
  page.on('pageerror', (e) => errs.push('pageerror: ' + e.message + '\n' + e.stack));
  const shot = async (n, wait = 300) => { if (!SHOTS) return; await page.waitForTimeout(wait); await page.screenshot({ path: `tools/shots/bb_${TAG}_${n}.png` }); };
  const click = async (sel, wait = 260) => { await page.evaluate((s) => { const b = document.querySelector(s); if (!b) throw new Error('no ' + s); b.click(); }, sel); await page.waitForTimeout(wait); };
  const has = (sel) => page.evaluate((s) => { const e = document.querySelector(s); return !!e && !e.disabled && e.getClientRects().length > 0; }, sel);
  const txt = async (sel, n = 200) => (await page.evaluate((s) => document.querySelector(s)?.innerText || '', sel)).replace(/\s+/g, ' ').slice(0, n);
  const ev = (fn, a) => page.evaluate(fn, a);
  const overflow = () => ev(() => {
    const out = [], vw = innerWidth, vh = innerHeight;
    for (const e of document.querySelectorAll('#bb .bb-top *, #bb .bb-rail *, #bb .bb-bot *, #bb .bb-card *, #bb .bb-dlg *, #bb .bb-adv *, #bb .bb-busy *, #bb .bb-toast *')) {
      if (!e.getClientRects().length) continue;
      const r = e.getBoundingClientRect();
      if (r.width < 2) continue;
      const inScroll = e.closest('.bb-dlg, .bb-card');
      if (r.right > vw + 1 || r.left < -1 || (!inScroll && (r.bottom > vh + 1 || r.top < -1))) out.push(`${e.className || e.tagName}: ${Math.round(r.left)}..${Math.round(r.right)} × ${Math.round(r.top)}..${Math.round(r.bottom)}`);
      const cs = getComputedStyle(e);
      if (e.scrollWidth > e.clientWidth + 1 && (cs.overflow === 'hidden' || cs.textOverflow === 'ellipsis') && cs.overflowY !== 'auto') out.push(`clip ${e.className || e.tagName}: "${e.innerText.slice(0, 40)}"`);
    }
    // взаимные наложения панелей
    const R = (q) => { const e = document.querySelector('#bb ' + q); if (!e || !e.getClientRects().length || getComputedStyle(e).display === 'none' || e.classList.contains('hidden')) return null; return e.getBoundingClientRect(); };
    const pairs = [['.bb-rail', '.bb-bot'], ['.bb-rail', '.bb-card'], ['.bb-bot', '.bb-card'], ['.bb-top', '.bb-rail'], ['.bb-adv', '.bb-card'], ['.bb-adv', '.bb-rail']];
    for (const [a, b] of pairs) { const p = R(a), q = R(b); if (p && q && p.left < q.right - 1 && p.right > q.left + 1 && p.top < q.bottom - 1 && p.bottom > q.top + 1) out.push(`overlap ${a} × ${b}`); }
    return [...new Set(out)].slice(0, 12);
  });
  const checkOv = async (where) => { const o = await overflow(); ok(!o.length, `layout ${where}: ${o.join('; ')}`); };
  // экранная точка гекса
  const hexPt = (h) => ev((h) => { const m = __app.bb.map, cr = m.cv.getBoundingClientRect(), [x, y] = m.hexXYs(h); return { x: cr.left + x / m.dpr, y: cr.top + y / m.dpr }; }, h);
  const tapHex = async (h, wait = 380) => { await ev((h) => __app.bb.map.center(h, false), h); await page.waitForTimeout(60); const p = await hexPt(h); await page.touchscreen.tap(p.x, p.y); await page.waitForTimeout(wait); };
  const state = () => ev(() => { const b = __app.bb, S = b.S, m = document.querySelector('#bb .bb-modal'); return { step: S && S.step, ph: S && S.ph, day: S && S.day, busy: !!b.busy, lock: !!b.lock, over: !!(S && S.over), modal: !m.classList.contains('hidden'), dec: !!m.querySelector('[data-a="dec"]') }; });
  let decShots = 0, busyShot = 0;
  const waitPlayer = async (ms = 120000, midShot) => {
    const t0 = Date.now();
    while (Date.now() - t0 < ms) {
      const s = await state();
      if (s.dec) { if (decShots < 2) await shot(`dec${++decShots}`, 200), await checkOv('decision'); await click('#bb .bb-modal [data-a="dec"]', 300); continue; }
      if (s.over) return 'over';
      if (s.step === 'player' && !s.busy && !s.modal) return 'player';
      if (midShot && s.busy && !busyShot && Date.now() - t0 > 1500) { busyShot = 1; await shot(midShot, 0); }
      await page.waitForTimeout(120);
    }
    return 'timeout';
  };

  await page.goto('file:///data/game_ww2/dist-single/index.html');
  await page.waitForTimeout(900);
  // v0.9: «Барбаросса 1941» перенесена в архив прототипов, наверху меню — «Фронт 1941–1945»
  ok(await has('#m-war'), 'menu: кнопка «Фронт 1941–1945»');
  ok((await txt('#menu .ver')).includes('0.9'), 'menu: версия 0.9');
  await shot('menu');
  if (!(await has('#m-bb'))) await click('#m-arch');
  ok(await has('#m-bb') && await has('#m-st') && await has('#m-eu') && await has('#m-new'), 'menu: архив раскрывается');
  await shot('menu_arch');
  await click('#m-bb', 700);
  ok(await has('#bb .bb-hub [data-a="new"]'), 'hub открыт');
  await click(`#bb [data-a="o-side"][data-v="${SIDE}"]`, 300);
  await shot('hub');
  await checkOv('hub');
  await click('#bb [data-a="new"]', 600);
  ok(await has('#bb .bb-modal [data-a="mok"]'), 'брифинг');
  ok((await txt('#bb .bb-dlg')).includes('Граница'), 'брифинг: глава');
  await shot('brief');
  await checkOv('brief');
  await ev(() => (__app.bb.opt.spd = 1));
  await click('#bb .bb-modal [data-a="mok"]', 300);
  const r1 = await waitPlayer(120000, 'busy');
  ok(r1 === 'player', 'первый ход игрока: ' + r1);
  await page.waitForTimeout(500);
  await shot('turn1');
  await checkOv('turn1');
  const info = await ev(() => { const b = __app.bb, S = b.S; return { side: S.side, day: S.day, cp: S.cp, air: S.air, gen: document.querySelector('#bb .bb-gen').innerText.replace(/\s+/g, ' '), goals: document.querySelector('#bb .bb-goals').innerText.replace(/\s+/g, ' ') }; });
  console.log('turn1', JSON.stringify(info));
  ok(info.side === SIDE, 'сторона');
  // выбрать свою дивизию с целью удара
  const pick = await ev(() => {
    const b = __app.bb, S = b.S, L = S.units.filter((u) => b.canAct(u));
    let best = null;
    for (const u of L) { b.select(u, true); const n = b.targets.size, d = b.dests.size; if (!best || n > best.n || (n === best.n && d > best.d)) best = { id: u.id, c: u.c, n, d }; }
    b.clearSel(true);
    return best;
  });
  ok(!!pick, 'есть дивизия с ходом');
  await tapHex(pick.c);
  ok(await ev(() => __app.bb.sel), 'дивизия выбрана тапом');
  ok(await has('#bb .bb-card'), 'карточка дивизии');
  await shot('select');
  await checkOv('select');
  // удар
  const tg = await ev(() => { const b = __app.bb; return b.targets ? [...b.targets] : []; });
  if (tg.length) {
    const th = tg[0];
    await tapHex(th);
    ok(await ev(() => __app.bb.tgt >= 0 && !!__app.bb.atk), 'прогноз боя');
    ok((await txt('#bb .bb-card')).includes('Атака'), 'прогноз: цифры');
    await shot('forecast');
    await checkOv('forecast');
    ok(await ev(() => { const b = document.querySelector('#bb .bb-card [data-a="attack"]'), c = document.querySelector('#bb .bb-card'); if (!b) return false; const r = b.getBoundingClientRect(), q = c.getBoundingClientRect(); return r.bottom <= Math.min(innerHeight, q.bottom) + 1 && r.top >= q.top - 1; }), 'прогноз: кнопка «Атаковать» видна без прокрутки');
    await click('#bb .bb-card [data-a="attack"]', 200);
    await shot('attack', 450);
    for (let i = 0; i < 40 && (await ev(() => __app.bb.lock)); i++) await page.waitForTimeout(100);
    await page.waitForTimeout(300);
    ok(await ev(() => __app.bb.S.units.some((u) => u.cmd && u.at > 0)), 'удар выполнен');
  } else console.log('no targets for first unit');
  // марш другой дивизии и «Отменить»
  const mv = await ev(() => {
    const b = __app.bb, S = b.S;
    for (const u of S.units) { if (!b.canAct(u) || u.mv || u.at) continue; b.select(u, true); const d = [...b.dests].sort((x, y) => S.M.dist(u.c, y) - S.M.dist(u.c, x)); b.clearSel(true); if (d.length) return { id: u.id, c: u.c, to: d[0] }; }
    return null;
  });
  if (mv) {
    await tapHex(mv.c, 450);
    // ближайшая к краю хода цель, видимая на экране (не под панелями)
    mv.to = await ev(() => {
      const b = __app.bb, m = b.map, cr = m.cv.getBoundingClientRect(), S = b.S, u = S.U.get(b.sel);
      const L = [...(b.dests || [])].sort((x, y) => S.M.dist(u.c, y) - S.M.dist(u.c, x));
      for (const h of L) { const [x, y] = m.hexXYs(h), px = cr.left + x / m.dpr, py = cr.top + y / m.dpr; if (document.elementFromPoint(px, py) === m.cv && m.hexAtScreen(px, py) === h) return h; }
      return -1;
    });
    ok(mv.to >= 0, 'есть видимый гекс для марша');
    const p = await hexPt(mv.to);
    await page.touchscreen.tap(p.x, p.y);
    await page.waitForTimeout(150);
    await shot('move', 150);
    for (let i = 0; i < 40 && (await ev(() => __app.bb.lock)); i++) await page.waitForTimeout(100);
    const moved = await ev((id) => __app.bb.S.U.get(id).c, mv.id);
    ok(moved !== mv.c, 'марш выполнен');
    ok(await has('#bb [data-a="undo"]'), '«Отменить» доступна');
    await click('#bb [data-a="undo"]', 300);
    ok((await ev((id) => __app.bb.S.U.get(id).c, mv.id)) === mv.c, '«Отменить» вернула дивизию');
  }
  // авиация
  if (await ev(() => __app.bb.S.air > 0)) {
    await click('#bb [data-a="air"]', 300);
    const at = await ev(() => (__app.bb.airT ? [...__app.bb.airT] : []));
    ok(at.length > 0, 'цели авиации');
    if (at.length) {
      await shot('air_mode');
      const a0 = await ev(() => __app.bb.S.air);
      await tapHex(at[0], 200);
      await shot('air_hit', 350);
      for (let i = 0; i < 40 && (await ev(() => __app.bb.lock)); i++) await page.waitForTimeout(100);
      ok((await ev(() => __app.bb.S.air)) === a0 - 1, 'авиаудар потратил вылет');
      if (await ev(() => __app.bb.mode === 'air')) await click('#bb [data-a="air"]', 200);
    }
  }
  // способность
  const ab = await ev(() => Object.keys(__app.bb.S.abil).find((k) => __app.bb.readyAbil().includes(k)));
  if (ab) {
    await click(`#bb [data-a="abil"][data-v="${ab}"]`, 300);
    await shot('abil');
    await checkOv('abil');
    if (await has('#bb .bb-modal [data-a="mok"]')) await click('#bb .bb-modal [data-a="mok"]', 300);
    ok(!(await ev((k) => __app.bb.readyAbil().includes(k), ab)), 'способность применена: ' + ab);
  }
  // советник, разведка, снабжение
  await click('#bb [data-a="adv"]', 400);
  ok(await has('#bb .bb-adv'), 'советник');
  await click('#bb [data-a="rec"]', 500);
  await shot('adv_rec', 300);
  await checkOv('adv_rec');
  if (await has('#bb .bb-adv [data-a="advgo"]')) { await click('#bb .bb-adv [data-a="advgo"]', 400); ok(await ev(() => !!__app.bb.sel), 'советник: выбор дивизии'); }
  await click('#bb [data-a="adv"]', 200);
  await click('#bb [data-a="rec"]', 200);
  await click('#bb [data-a="sup"]', 300);
  await shot('supply');
  await click('#bb [data-a="sup"]', 200);
  // окна: задачи, журнал, меню, справка
  await click('#bb [data-a="goals"]', 300);
  await shot('goals');
  await checkOv('goals');
  await click('#bb .bb-modal [data-a="journal"]', 300);
  ok(await has('#bb .bb-jw'), 'журнал');
  await click('#bb .bb-modal [data-a="mclose"]', 200);
  await click('#bb [data-a="menu"]', 300);
  ok(await has('#bb .bb-modal [data-a="o-spd"]'), 'меню игры');
  await click('#bb .bb-modal [data-a="help"]', 300);
  await checkOv('help');
  await click('#bb .bb-modal [data-a="mclose"]', 200);
  // «Назад»: снять выбор / меню
  await tapHex(pick.c, 250);
  await ev(() => __app.onBack());
  await page.waitForTimeout(150);
  ok(!(await ev(() => __app.bb.sel)), '«Назад» снимает выбор');
  // конец дня
  await ev(() => (__app.bb.opt.spd = 1));
  busyShot = 0;
  await click('#bb [data-a="end"]', 300);
  if (await has('#bb .bb-modal [data-a="mok"]')) await shot('endconfirm', 100), await click('#bb .bb-modal [data-a="mok"]', 200);
  await page.waitForTimeout(500);
  await shot('banner', 0);
  const r2 = await waitPlayer(180000, 'enemy');
  ok(r2 === 'player', 'второй ход игрока: ' + r2);
  await shot('turn2', 600);
  await checkOv('turn2');
  // дальше: свои дивизии ведёт ИИ, мгновенная скорость
  await ev(() => (__app.bb.opt.spd = 2));
  let res = r2, d = 1;
  while (res === 'player' && d < DAYS) {
    await ev(async () => {
      const b = __app.bb, S = b.S;
      const ids = S.units.filter((u) => u.cmd && u.side === S.side && __bbR.alive(u)).map((u) => u.id);
      for (const _ of __bbAI(S, S.side, ids, { air: S.air })) {}
      S.air = 0;
      b.hud(); b.overlay();
      b.endTurn(true);
    });
    res = await waitPlayer(180000);
    d++;
    if (d === 5) await shot('day5', 300);
  }
  ok(res === 'over' || d >= DAYS, 'глава дошла до конца: ' + res);
  if (res === 'over') {
    for (let i = 0; i < 30 && !(await has('#bb .bb-res')); i++) await page.waitForTimeout(200);
    ok(await has('#bb .bb-res'), 'итоги');
    await shot('result', 300);
    await checkOv('result');
    console.log('ИТОГ', JSON.stringify(await ev(() => __app.bb.S.over)), await txt('#bb .bb-res h3', 80));
    await click('#bb .bb-modal [data-a="mclose"]', 300);
    await shot('final_map', 300);
  }
  // выход в меню и «Продолжить»
  await ev(() => __app.onBack());
  await page.waitForTimeout(250);
  if (await has('#bb .bb-modal [data-a="exit"]')) await click('#bb .bb-modal [data-a="exit"]', 500);
  if (!(await has('#m-bb')) && (await has('#m-arch'))) await click('#m-arch');
  ok(await has('#m-bb'), 'возврат в главное меню');
  ok((await txt('#m-bb')).length > 16, 'меню: подпись сохранения');
  await click('#m-bb', 600);
  ok(await has('#bb [data-a="cont"]'), 'хаб: «Продолжить»');
  await click('#bb [data-a="cont"]', 900);
  ok(await ev(() => !!__app.bb.S && __app.bb.inGame === 1), 'загрузка сохранения');
  await shot('continue', 500);
  await page.waitForTimeout(300);
  console.log('errors:', errs.length ? errs.slice(0, 6).join('\n') : 'none');
  console.log(fails.length ? `FAILS ${fails.length}` : 'ALL OK');
  await browser.close();
  process.exit(fails.length || errs.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
