// E2E (v0.9): «Фронт 1941–1945». Меню → экран выбора (сторона, сложность) → «Новая война» → брифинг → карта армий →
// штаб армии: «Оборона», «Наступать» + цель на карте, «Авто» → «К дивизиям» → дивизия: марш и «Отменить», удар с
// прогнозом и «Вместе с соседями», «По ж/д», «Снять гарнизон» → карточка гекса → «Приказы» (выбор приказа, «Все армии —
// Авто»), «Экономика» (доли, автоформирование, «Сформировать»), «Сводка» (журнал) → меню партии, «Как играть» →
// «Армии/Дивизии» → «Ход → дата» → «Неделя» (решения) → «Сохранить и выйти» → «Продолжить» → итоги (принудительно).
// W/H — экран, SIDE — SOV/GER, TAG — префикс скриншотов, DAYS — до каких суток играть «Неделями» (по умолчанию 9).
const { chromium } = require('/vercel/sandbox/node_modules/playwright');
(async () => {
  const W = +(process.env.W || 844), H = +(process.env.H || 390), SIDE = process.env.SIDE || 'SOV';
  const TAG = process.env.TAG || `${SIDE.toLowerCase()}_${W}x${H}`, DAYS = +(process.env.DAYS || 9), SHOTS = process.env.SHOTS !== '0';
  const browser = await chromium.launch({ executablePath: '/usr/local/bin/chromium', args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await ctx.addInitScript(() => { if (!localStorage.getItem('__e2e')) { localStorage.clear(); localStorage.setItem('__e2e', '1'); } });
  const page = await ctx.newPage();
  const errs = [], fails = [];
  const ok = (c, m) => { if (!c) { fails.push(m); console.log('FAIL', m); } };
  page.on('console', (m) => ['error', 'warning'].includes(m.type()) && errs.push(m.type() + ': ' + m.text()));
  page.on('pageerror', (e) => errs.push('pageerror: ' + e.message + '\n' + e.stack));
  const shot = async (n, wait = 300) => { if (!SHOTS) return; await page.waitForTimeout(wait); await page.screenshot({ path: `tools/shots/war_${TAG}_${n}.png` }); };
  const click = async (sel, wait = 260) => { await page.evaluate((s) => { const b = document.querySelector(s); if (!b) throw new Error('no ' + s); b.click(); }, sel); await page.waitForTimeout(wait); };
  const has = (sel) => page.evaluate((s) => { const e = document.querySelector(s); return !!e && !e.disabled && e.getClientRects().length > 0; }, sel);
  const txt = async (sel, n = 300) => (await page.evaluate((s) => document.querySelector(s)?.innerText || '', sel)).replace(/\s+/g, ' ').slice(0, n);
  const ev = (fn, a) => page.evaluate(fn, a);
  const overflow = () => ev(() => {
    const out = [], vw = innerWidth, vh = innerHeight, Q = '#war ';
    const sel = ['.wr-top', '.wr-rail', '.wr-bot', '.wr-card', '.wr-dlg', '.wr-busy', '.wr-toast', '.wr-hubw'].map((q) => `${Q}${q} *`).join(',');
    for (const e of document.querySelectorAll(sel)) {
      if (!e.getClientRects().length) continue;
      const r = e.getBoundingClientRect();
      if (r.width < 2) continue;
      const inScroll = e.closest('.wr-dlg, .wr-card, .wr-hub');
      if (r.right > vw + 1 || r.left < -1 || (!inScroll && (r.bottom > vh + 1 || r.top < -1))) out.push(`${e.className || e.tagName}: ${Math.round(r.left)}..${Math.round(r.right)} × ${Math.round(r.top)}..${Math.round(r.bottom)}`);
      const cs = getComputedStyle(e);
      if (e.scrollWidth > e.clientWidth + 1 && (cs.overflow === 'hidden' || cs.overflowX === 'hidden' || cs.textOverflow === 'ellipsis') && cs.overflowY !== 'auto') out.push(`clip ${e.className || e.tagName}: "${e.innerText.slice(0, 40)}"`);
      // кнопки: текст не вылезает за рамку
      if (e.tagName === 'BUTTON' && e.scrollWidth > e.clientWidth + 2 && cs.overflowX !== 'auto') out.push(`btn ${e.className}: "${e.innerText.slice(0, 30)}" ${e.scrollWidth}>${e.clientWidth}`);
    }
    for (const q of ['.wr-card', '.wr-dlg', '.wr-hub']) {
      const e = document.querySelector(Q + q);
      if (e && e.getClientRects().length && e.scrollWidth > e.clientWidth + 1) out.push(`hscroll ${q} ${e.scrollWidth}>${e.clientWidth}`);
    }
    const R = (q) => { const e = document.querySelector(Q + q); if (!e || !e.getClientRects().length || getComputedStyle(e).display === 'none' || e.classList.contains('hidden')) return null; return e.getBoundingClientRect(); };
    const pairs = [['.wr-rail', '.wr-bot'], ['.wr-rail', '.wr-card'], ['.wr-bot', '.wr-card'], ['.wr-top', '.wr-rail'], ['.wr-top', '.wr-card'], ['.wr-busy', '.wr-rail'], ['.wr-busy', '.wr-card']];
    for (const [a, b] of pairs) { const p = R(a), q = R(b); if (p && q && p.left < q.right - 1 && p.right > q.left + 1 && p.top < q.bottom - 1 && p.bottom > q.top + 1) out.push(`overlap ${a} × ${b}`); }
    return [...new Set(out)].slice(0, 12);
  });
  const checkOv = async (where) => { const o = await overflow(); ok(!o.length, `layout ${where}: ${o.join('; ')}`); };
  // экранная точка гекса / штаба
  const hexPt = (h) => ev((h) => { const m = __war.map, cr = m.cv.getBoundingClientRect(), [x, y] = m.hexXYs(h); return { x: cr.left + x / m.dpr, y: cr.top + y / m.dpr }; }, h);
  const tapHex = async (h, wait = 380) => { await ev((h) => __war.map.center(h, false), h); await page.waitForTimeout(80); const p = await hexPt(h); await page.touchscreen.tap(p.x, p.y); await page.waitForTimeout(wait); };
  const tokPt = (k) => ev((k) => {
    const m = __war.map, cr = m.cv.getBoundingClientRect(), v = m.view(), me = __war.S.side, d = m.dpr;
    const L = (m._hq || []).filter((t) => (k ? t.A.k === k : t.A.side === me));
    const c = L.filter((t) => t.x > v.l + 50 * d && t.x < v.r - 50 * d && t.y > v.t + 50 * d && t.y < v.b - 50 * d);
    const t = c[0] || L[0];
    return t ? { x: cr.left + t.x / d, y: cr.top + t.y / d, k: t.A.k, n: t.A.n } : null;
  }, k);
  const st = () => ev(() => { const w = __war, S = w.S, m = w.$.modal; return { day: S && S.day, busy: !!w.busy, over: !!(S && S.over), modal: !m.classList.contains('hidden'), dec: !!m.querySelector('[data-a="m-ev"]'), pend: S ? S.ev.pending.length : 0 }; });
  let decShots = 0, busyShot = 0;
  const waitIdle = async (ms = 90000, midShot) => {
    const t0 = Date.now();
    while (Date.now() - t0 < ms) {
      const s = await st();
      if (!s.busy) return s;
      if (midShot && !busyShot && Date.now() - t0 > 400) { busyShot = 1; await shot(midShot, 0); await checkOv('busy'); }
      await page.waitForTimeout(100);
    }
    return null;
  };
  const decide = async () => {
    for (let i = 0; i < 8; i++) {
      const s = await st();
      if (!s.dec) return;
      if (decShots < 2) { await shot(`dec${++decShots}`, 250); await checkOv('decision'); }
      const n0 = s.pend;
      await click('#war .wr-modal [data-a="m-ev"]', 300);
      const s1 = await st();
      ok(s1.pend < n0, 'решение принято');
    }
  };

  // ——— меню ———
  await page.goto('file:///data/game_ww2/dist-single/index.html');
  await page.waitForTimeout(900);
  ok(await has('#m-war'), 'menu: кнопка «Фронт 1941–1945»');
  ok((await txt('#m-war')).includes('Фронт 1941–1945'), 'menu: подпись');
  ok(!(await has('#m-bb')), 'menu: «Барбаросса» в архиве (свёрнут)');
  ok((await txt('#menu .ver')).includes('0.9'), 'menu: версия 0.9');
  await shot('menu');
  await click('#m-arch');
  ok(await has('#m-bb'), 'menu: архив с «Барбароссой»');
  await click('#m-arch');
  // ——— экран выбора ———
  await click('#m-war', 900);
  ok(await has('#war .wr-hub [data-a="new"]'), 'хаб открыт');
  ok(!(await has('#war .wr-hub [data-a="cont"]')), 'хаб: без «Продолжить» в новой игре');
  await click(`#war [data-a="o-side"][data-v="${SIDE === 'GER' ? 'SOV' : 'GER'}"]`, 200);
  await click(`#war [data-a="o-side"][data-v="${SIDE}"]`, 200);
  ok(await ev((s) => __war.opt.side === s, SIDE), 'хаб: выбрана сторона');
  await click('#war [data-a="o-diff"][data-v="2"]', 150);
  ok(await ev(() => __war.opt.diff === 2), 'хаб: сложность');
  await click('#war [data-a="o-diff"][data-v="1"]', 200);
  ok((await txt('#war .wr-hub')).includes(SIDE === 'GER' ? 'ОКХ' : 'Ставка ВГК'), 'хаб: штаб стороны');
  await shot('hub', 500);
  await checkOv('hub');
  await click('#war [data-a="help"]', 300);
  ok((await txt('#war .wr-dlg')).includes('Как играть'), 'хаб: «Как играть»');
  await checkOv('help');
  await shot('help');
  await click('#war .wr-modal [data-a="close-m"]', 200);
  // ——— новая война ———
  await click('#war [data-a="new"]', 100);
  await page.waitForFunction(() => window.__war && __war.S && __war.inGame && !__war.$.modal.classList.contains('hidden'), null, { timeout: 30000 });
  await page.waitForTimeout(300);
  const brief = await txt('#war .wr-dlg', 600);
  ok(brief.includes(SIDE === 'GER' ? 'ОКХ' : 'Ставка ВГК') && brief.includes('22 июня'), 'брифинг');
  await shot('brief');
  await checkOv('brief');
  await click('#war .wr-modal [data-a="close-m"]', 400);
  await decide();
  ok(await has('#war .wr-top') && await has('#war [data-a="end"]') && await has('#war [data-a="week"]'), 'карта: панели');
  ok((await txt('#war .wr-date')).includes('22 июня 1941'), 'карта: дата');
  ok((await txt('#war [data-a="end"]')).includes('23 июня'), 'карта: «Ход → 23 июня»');
  ok(await ev(() => __war.map.lod() === 'army'), 'карта: армии на мелком масштабе');
  ok((await txt('#war .wr-rail [data-a="lod"]')).includes('Армии'), 'переключатель: «Армии»');
  await shot('map', 700);
  await checkOv('map');
  // ——— штаб армии ———
  let tk = await tokPt();
  ok(!!tk, 'жетон своей армии на экране');
  if (tk) {
    await page.touchscreen.tap(tk.x, tk.y);
    await page.waitForTimeout(350);
    ok(await ev((k) => __war.selA && __war.selA.k === k, tk.k), 'касание штаба выбирает армию: ' + tk.n);
    ok(await has('#war .wr-card [data-a="ord"][data-v="def"]'), 'карточка армии: приказы');
    await shot('army');
    await checkOv('army card');
    await click('#war .wr-card [data-a="ord"][data-v="def"]', 200);
    ok(await ev((k) => __war.S.hqs[k].order === 'def', tk.k), 'приказ «Оборона»');
    await click('#war .wr-card [data-a="ord"][data-v="atk"]', 250);
    ok(await ev(() => __war.mode === 'tgt'), '«Наступать»: режим цели');
    ok((await txt('#war .wr-card')).includes('Коснитесь карты'), '«Наступать»: подсказка');
    await shot('army_tgt');
    const tg = await ev((k) => {
      const S = __war.S, A = S.hqs[k], M = __war.M, me = S.side;
      const { R } = __warX;
      const h0 = S.units.find((u) => u.hq === k && R.alive(u))?.h ?? -1;
      let best = -1, bd = 1e9;
      for (const u of S.units) if (u.side !== me && R.alive(u) && !u.arr) { const d = M.dist(u.h, h0); if (d < bd) (bd = d), (best = u.h); }
      return best;
    }, tk.k);
    await tapHex(tg, 450);
    ok(await ev((k) => __war.S.hqs[k].order === 'atk' && __war.S.hqs[k].tgt >= 0 && __war.mode === '', tk.k), '«Наступать»: цель задана');
    await shot('army_atk');
    await checkOv('army atk');
    await click('#war .wr-card [data-a="ord"][data-v="auto"]', 200);
    ok(await ev((k) => __war.S.hqs[k].order === 'auto', tk.k), 'приказ «Авто»');
    await click('#war .wr-card [data-a="a-zoom"]', 700);
    ok(await ev(() => __war.map.lod() === 'div'), '«К дивизиям»: масштаб дивизий');
  }
  await ev(() => __war.clearSel());
  if (!(await ev(() => __war.map.lod() === 'div'))) { await click('#war .wr-rail [data-a="lod"]', 400); }
  ok(await ev(() => __war.map.lod() === 'div'), 'масштаб дивизий');
  ok((await txt('#war .wr-rail [data-a="lod"]')).includes('Дивизии'), 'переключатель: «Дивизии»');
  // ——— дивизии ———
  const pick = (kind, skip = []) => ev(([kind, skip]) => {
    const w = __war, S = w.S, me = S.side, M = w.M, { E, R } = __warX;
    const own = S.units.filter((u) => u.side === me && R.alive(u) && !u.arr && !u.gar && u.mp > 0 && !u.at && !u.pm && !u.mv && !skip.includes(u.id));
    for (const u of own) {
      if (kind === 'atk') {
        if (!R.canAttack(S, u)) continue;
        for (let d = 0; d < 6; d++) { const j = M.nb[u.h * 6 + d]; if (j >= 0 && R.enemyAt(S, j, me)) return { id: u.id, h: u.h, t: j, n: u.n }; }
      } else if (kind === 'move') {
        const Rm = E.reach(S, u);
        let bt = -1;
        for (const [h] of Rm) if (h !== u.h && R.canEnd(S, u, h) && !R.unitsAt(S, h).length) { bt = h; if (M.dist(h, u.h) >= 2) break; }
        if (bt >= 0) return { id: u.id, h: u.h, t: bt, n: u.n };
      } else if (kind === 'rail') {
        const rt = E.railTargets(S, u).filter((h) => M.dist(h, u.h) >= 4);
        if (rt.length) return { id: u.id, h: u.h, t: rt[Math.floor(rt.length / 3)], n: u.n };
      }
    }
    return null;
  }, [kind, skip]);
  const U = (id) => ev((id) => { const u = __war.S.units.find((x) => x.id === id); return u && { h: u.h, pm: u.pm, at: u.at, gar: u.gar, ral: u.ral, men: u.men }; }, id);
  // марш и «Отменить»
  const mv = await pick('move');
  ok(!!mv, 'есть дивизия для марша');
  if (mv) {
    await tapHex(mv.h);
    ok(await ev((id) => __war.sel && __war.sel.id === id, mv.id), 'касание выбирает дивизию: ' + mv.n);
    ok(await has('#war .wr-card .wr-sts'), 'карточка дивизии');
    await shot('div');
    await checkOv('div card');
    await tapHex(mv.t, 450);
    ok((await U(mv.id)).h === mv.t, 'марш');
    await shot('move');
    ok(await has('#war .wr-card [data-a="u-undo"]'), '«Отменить» доступно');
    await click('#war .wr-card [data-a="u-undo"]', 300);
    ok((await U(mv.id)).h === mv.h, '«Отменить» вернула дивизию');
  }
  // удар с прогнозом
  const at = await pick('atk');
  ok(!!at, 'есть дивизия для удара');
  if (at) {
    await tapHex(at.h);
    ok(await ev((id) => __war.sel && __war.sel.id === id, at.id), 'выбрана дивизия для удара');
    await tapHex(at.t, 400);
    ok(await ev((t) => __war.atk && __war.atk.tgt === t, at.t), 'цель удара');
    ok(await has('#war .wr-card [data-a="atk-go"]'), 'прогноз: кнопка «Атаковать»');
    const fc = await txt('#war .wr-card .wr-fc');
    ok(/Соотношение/.test(fc) && /шанс/.test(fc) && /потери/.test(fc), 'прогноз: соотношение, шанс, потери');
    await shot('forecast');
    await checkOv('forecast');
    await click('#war .wr-card [data-a="atk-all"]', 250);
    ok(await ev(() => __war.opt.all === 1), '«Вместе с соседями» вкл.');
    const nAtt = await ev(() => __war.attList().length);
    ok(nAtt >= 1, 'соседи в ударе: ' + nAtt);
    await shot('forecast_all');
    await checkOv('forecast all');
    await click('#war .wr-card [data-a="atk-go"]', 500);
    ok((await U(at.id)).pm === 1, 'удар нанесён');
    ok(await has('#war .wr-toast'), 'сообщение об итоге удара');
    await shot('attack');
    await click('#war .wr-card [data-a="close"]').catch(() => {});
    await ev(() => { __war.opt.all = 0; __war.clearSel(); });
  }
  // по железной дороге
  const rl = await pick('rail');
  if (rl) {
    await tapHex(rl.h);
    ok(await has('#war .wr-card [data-a="u-rail"]'), '«По ж/д» доступно');
    await click('#war .wr-card [data-a="u-rail"]', 300);
    ok(await ev(() => __war.mode === 'rail'), 'режим «По ж/д»');
    await ev(() => __war.map.zoomTo(28));
    await shot('rail', 400);
    await checkOv('rail');
    await tapHex(rl.t, 450);
    const r1 = await U(rl.id);
    ok(r1.h === rl.t, 'переброска по ж/д');
    await ev(() => __war.clearSel());
  } else console.log('нет дивизии для ж/д (сутки 1)');
  // гарнизон
  const gid = await ev(() => { const { R } = __warX, S = __war.S; const u = S.units.find((x) => x.side === S.side && R.alive(x) && x.gar && !x.arr); return u ? { id: u.id, h: u.h } : null; });
  if (gid) {
    await tapHex(gid.h);
    await ev((id) => { const u = __war.S.units.find((x) => x.id === id); __war.sel = u; __war.refresh(); }, gid.id);
    await page.waitForTimeout(150);
    ok(await has('#war .wr-card [data-a="u-gar"]'), '«Снять гарнизон» доступно');
    await shot('garrison');
    await click('#war .wr-card [data-a="u-gar"]', 250);
    ok(!(await U(gid.id)).gar, 'гарнизон снят');
    await ev(() => __war.clearSel());
  } else console.log('гарнизонов нет');
  // карточка гекса
  const eh = await ev(() => { const S = __war.S, M = __war.M, { R } = __warX; const h0 = __war.focusHex() ?? M.cityHex('Минск'); let best = -1, bd = 1e9; for (let h = 0; h < M.N; h++) { if (M.terr[h] < 2 || R.unitsAt(S, h).length || R.sideOfH(S, h) !== S.side) continue; const d = M.dist(h, h0) + (M.cityAt[h] >= 0 ? -3 : 0); if (d >= 3 && d < bd) (bd = d), (best = h); } return best; });
  await tapHex(eh, 400);
  ok(await ev((h) => __war.info === h, eh), 'карточка гекса');
  ok((await txt('#war .wr-card')).length > 10, 'карточка гекса: текст');
  await shot('hex');
  await checkOv('hex card');
  await click('#war .wr-card [data-a="close"]', 200);
  ok(!(await has('#war .wr-card')), 'карточка закрыта');
  // ——— окна: приказы, экономика, сводка ———
  await click('#war .wr-rail [data-a="orders"]', 400);
  ok((await txt('#war .wr-dlg')).includes('Приказы армиям'), 'окно «Приказы»');
  await shot('orders');
  await checkOv('orders');
  const k1 = await ev(() => __war.$.modal.querySelector('select[data-ord]')?.dataset.ord);
  if (k1) {
    await page.locator('#war .wr-modal select[data-ord]').first().selectOption('def');
    await page.waitForTimeout(200);
    ok(await ev((k) => __war.S.hqs[k].order === 'def', k1), '«Приказы»: оборона из списка');
  }
  await click('#war .wr-modal [data-a="m-ord-all"]', 300);
  ok(await ev(() => Object.values(__war.S.hqs).filter((A) => A.side === __war.S.side && A.lv >= 2).every((A) => A.order === 'auto')), '«Все армии — Авто»');
  await click('#war .wr-modal [data-a="close-m"]', 200);
  await click('#war .wr-rail [data-a="eco"]', 400);
  ok((await txt('#war .wr-dlg')).includes('Экономика'), 'окно «Экономика»');
  await shot('eco');
  await checkOv('eco');
  const sh0 = await ev(() => __war.S.eco[__war.S.side].share.tnk);
  await click('#war .wr-modal [data-a="m-share"][data-v="tnk:1"]', 200);
  ok((await ev(() => __war.S.eco[__war.S.side].share.tnk)) > sh0, 'доля танков +');
  await click('#war .wr-modal [data-a="m-share"][data-v="tnk:-1"]', 200);
  const au0 = await ev(() => __war.S.eco[__war.S.side].auto);
  await click('#war .wr-modal [data-a="m-auto"]', 200);
  ok((await ev(() => __war.S.eco[__war.S.side].auto)) !== au0, 'автоформирование переключено');
  await click('#war .wr-modal [data-a="m-auto"]', 200);
  if (await has('#war .wr-modal [data-a="m-form"]:not([disabled])')) {
    const n0 = await ev(() => __war.S.units.length);
    await click('#war .wr-modal [data-a="m-form"]:not([disabled])', 300);
    ok((await ev(() => __war.S.units.length)) > n0, '«Сформировать»: новая дивизия');
  } else console.log('формирование недоступно в первые сутки');
  await click('#war .wr-modal [data-a="close-m"]', 200);
  await click('#war .wr-rail [data-a="sum"]', 400);
  ok((await txt('#war .wr-dlg')).includes('Сводка'), 'окно «Сводка»');
  await shot('sum');
  await checkOv('sum');
  await click('#war .wr-modal [data-a="close-m"]', 200);
  // меню партии и «назад»
  await ev(() => __app.onBack());
  await page.waitForTimeout(250);
  ok((await txt('#war .wr-dlg')).includes('Сохранить и выйти'), '«Назад» → меню партии');
  await shot('gmenu');
  await checkOv('game menu');
  await ev(() => __app.onBack());
  await page.waitForTimeout(250);
  ok(!(await has('#war .wr-dlg')), '«Назад» закрывает окно');
  // ——— ход ———
  await click('#war [data-a="end"]', 100);
  let s1 = await waitIdle(60000, 'busy1');
  await decide();
  s1 = await st();
  ok(s1 && s1.day === 1, 'ход: сутки 2 (' + (s1 && s1.day) + ')');
  ok((await txt('#war .wr-date')).includes('23 июня'), 'дата 23 июня');
  await shot('day1', 400);
  await checkOv('day 1');
  // «Неделя» до DAYS
  for (let guard = 0; guard < 40; guard++) {
    const s = await st();
    if (s.over || s.day >= DAYS) break;
    if (s.dec) { await decide(); continue; }
    if (s.modal) { await click('#war .wr-modal [data-a="close-m"]', 150).catch(() => {}); continue; }
    const d0 = s.day;
    await click('#war [data-a="week"]', 100);
    await waitIdle(120000, 'busy_week');
    const s2 = await st();
    ok(s2.day > d0 || s2.dec, `«Неделя»: ${d0} → ${s2.day}`);
  }
  await decide();
  const sF = await st();
  console.log('сутки', sF.day, 'дата', await txt('#war .wr-date', 60));
  await shot('week', 500);
  await checkOv('after week');
  await click('#war .wr-rail [data-a="sum"]', 400);
  await shot('sum2');
  await checkOv('sum 2');
  await click('#war .wr-modal [data-a="close-m"]', 200);
  // по масштабу армий: проверим жетоны и карточку армии ещё раз
  const lod0 = await ev(() => __war.map.lod());
  await click('#war .wr-rail [data-a="lod"]', 400);
  ok(await ev((l) => __war.map.lod() !== l, lod0), '«Армии/Дивизии» переключает масштаб');
  if (lod0 === 'army') await click('#war .wr-rail [data-a="lod"]', 400);
  ok(await ev(() => __war.map.lod() === 'army'), 'масштаб армий');
  await shot('armies2', 400);
  // ——— сохранение и «Продолжить» ———
  const dSave = (await st()).day;
  await click('#war [data-a="menu"]', 250);
  await click('#war .wr-modal [data-a="m-save-exit"]', 600);
  ok(await has('#m-war'), 'выход в главное меню');
  ok((await txt('#m-war')).includes(SIDE === 'GER' ? 'Германия' : 'СССР'), 'меню: подпись сохранения');
  await click('#m-war', 900);
  ok(await has('#war .wr-hub [data-a="cont"]'), 'хаб: «Продолжить»');
  await shot('hub_cont');
  await click('#war .wr-hub [data-a="cont"]', 900);
  ok(await ev((d) => !!__war.S && __war.inGame === 1 && __war.S.day === d, dSave), 'загрузка сохранения');
  await decide();
  await shot('continue', 500);
  // итоги (принудительно)
  await ev(() => { const S = __war.S; S.over = { win: S.side, why: 'Проверка окна итогов', d: S.day, stars: 2 }; __war.results(); });
  await page.waitForTimeout(300);
  ok((await txt('#war .wr-dlg')).includes('Победа'), 'окно итогов');
  await shot('result');
  await checkOv('result');
  await page.waitForTimeout(300);
  console.log('errors:', errs.length ? errs.slice(0, 6).join('\n') : 'none');
  console.log(fails.length ? `FAILS ${fails.length}` : 'ALL OK');
  await browser.close();
  process.exit(fails.length || errs.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
