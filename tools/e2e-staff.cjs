// E2E (v0.7.1): «Сталинград 1942–1943» — штабная карта «Операция «Уран»».
// Хаб → старт → уровни «Армии»/«Дивизии» → карточка дивизии → атака с прогнозом → карточка армии → директива
// → ходы (анимация, решения, события) → журнал/очки/настройки/справка → «Назад» → выход и «Продолжить».
// W/H — размер экрана, SIDE — SOV/AX, TURNS — сколько ходов сыграть, TAG — префикс скриншотов, SPD — скорость (0–3).
const { chromium } = require('/vercel/sandbox/node_modules/playwright');
(async () => {
  const W = +(process.env.W || 390), H = +(process.env.H || 844), SIDE = process.env.SIDE || 'SOV', TAG = process.env.TAG || 'p';
  const TURNS = +(process.env.TURNS || 4), SHOTS = process.env.SHOTS !== '0', SPD = +(process.env.SPD ?? 3), LEN = +(process.env.LEN || 24);
  const browser = await chromium.launch({ executablePath: '/usr/local/bin/chromium', args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await ctx.addInitScript(() => { if (!localStorage.getItem('__e2e')) { localStorage.clear(); localStorage.setItem('__e2e', '1'); } });
  const page = await ctx.newPage();
  const errs = [], fails = [];
  const ok = (c, m) => { if (!c) { fails.push(m); console.log('FAIL', m); } };
  page.on('console', (m) => ['error', 'warning'].includes(m.type()) && errs.push(m.type() + ': ' + m.text()));
  page.on('pageerror', (e) => errs.push('pageerror: ' + e.message + '\n' + e.stack));
  const shot = async (n) => { if (!SHOTS) return; await page.waitForTimeout(320); await page.screenshot({ path: `tools/shots/st_${TAG}_${n}.png` }); };
  const click = async (sel, wait = 280) => { await page.evaluate((s) => { const b = document.querySelector(s); if (!b) throw new Error('no ' + s); b.click(); }, sel); await page.waitForTimeout(wait); };
  const has = (sel) => page.evaluate((s) => { const e = document.querySelector(s); return !!e && !e.disabled && e.getClientRects().length > 0; }, sel);
  const txt = async (sel, n = 220) => (await page.evaluate((s) => document.querySelector(s)?.innerText || '', sel)).replace(/\s+/g, ' ').slice(0, n);
  const modalOpen = () => page.evaluate(() => !document.querySelector('#st .st-modal').classList.contains('hidden'));
  const sheetOpen = () => page.evaluate(() => !document.querySelector('#st .st-sheet').classList.contains('hidden'));
  const overflow = () => page.evaluate(() => {
    const out = [], vw = innerWidth;
    for (const e of document.querySelectorAll('#st .st-top *, #st .st-sheet *, #st .st-dlg *, #st .st-status, #st .st-legend, #st .st-hint *, #st .st-sug *, #st .st-bturn')) {
      if (!e.getClientRects().length) continue;
      const r = e.getBoundingClientRect();
      if (r.width < 2) continue;
      if (r.right > vw + 1 || r.left < -1) out.push(`${e.className || e.tagName}: x ${Math.round(r.left)}..${Math.round(r.right)}`);
      const cs = getComputedStyle(e);
      if (e.scrollWidth > e.clientWidth && (cs.overflow === 'hidden' || cs.textOverflow === 'ellipsis') && cs.overflowY !== 'auto') out.push(`clip ${e.className || e.tagName}: "${e.innerText.slice(0, 40)}"`);
    }
    // v0.7.1: крупная кнопка «Ход» не должна наезжать на легенду, статус, подсказки и панель
    const B = document.querySelector('#st .st-bturn');
    if (B && B.getClientRects().length) {
      const b = B.getBoundingClientRect();
      for (const q of ['.st-legend', '.st-status', '.st-sheet', '.st-sug', '.st-hint']) for (const o of document.querySelectorAll('#st ' + q)) {
        if (!o.getClientRects().length || getComputedStyle(o).display === 'none') continue;
        const r = o.getBoundingClientRect();
        if (r.width > 2 && r.left < b.right - 1 && r.right > b.left + 1 && r.top < b.bottom - 1 && r.bottom > b.top + 1) out.push(`turn button overlaps ${q} (кнопка x ${Math.round(b.left)}..${Math.round(b.right)} y ${Math.round(b.top)}..${Math.round(b.bottom)}, ${q} x ${Math.round(r.left)}..${Math.round(r.right)} y ${Math.round(r.top)}..${Math.round(r.bottom)})`);
      }
    }
    return [...new Set(out)].slice(0, 14);
  });
  // экранная точка: хит-бокс фишки/штаба или центр клетки
  const hitPt = (kind, pred) => page.evaluate(([kind, pred]) => {
    const st = __app.st, m = st.map, S = st.S, cr = m.cv.getBoundingClientRect(), { l, t, r, b } = m.inset;
    const f = new Function('u', 'S', 'return ' + pred);
    const L = m.hit.filter((h) => h[4] === kind && (kind !== 'u' || f(S.uById.get(h[5]), S)) && (kind === 'u' || f(h[5], S)));
    // центр не перекрыт другой фишкой/штабом, нарисованной выше (поиск попадания идёт с конца списка)
    const free = (h) => { const x = (h[0] + h[2]) / 2, y = (h[1] + h[3]) / 2; for (let q = m.hit.indexOf(h) + 1; q < m.hit.length; q++) { const o = m.hit[q], g = o[6] || 0; if (x >= o[0] - g && x <= o[2] + g && y >= o[1] - g && y <= o[3] + g) return false; } return true; };
    const inView = L.filter((h) => (h[0] + h[2]) / 2 > l + 20 && (h[0] + h[2]) / 2 < m.W - r - 20 && (h[1] + h[3]) / 2 > t + 20 && (h[1] + h[3]) / 2 < m.H - b - 20 && free(h) && document.elementFromPoint(cr.left + (h[0] + h[2]) / 2, cr.top + (h[1] + h[3]) / 2) === m.cv);
    const h = inView[0];
    return h ? { x: cr.left + (h[0] + h[2]) / 2, y: cr.top + (h[1] + h[3]) / 2, id: h[5] } : null;
  }, [kind, pred]);
  const cellPt = (c) => page.evaluate((c) => { const m = __app.st.map, cr = m.cv.getBoundingClientRect(), [x, y] = m.toScr(m.G.cx[c], m.G.cy[c]); return { x: cr.left + x, y: cr.top + y }; }, c);
  const tap = async (p, wait = 340) => { await page.touchscreen.tap(p.x, p.y); await page.waitForTimeout(wait); };
  const st = (fn) => page.evaluate(fn);
  // модальные окна: события — «Продолжить», решения — первый вариант
  let shotDec = 0, shotEv = 0;
  const drainModals = async (log) => {
    for (let i = 0; i < 12; i++) {
      if (!(await modalOpen())) return;
      const t = await txt('#st .st-dlg', 140);
      if (await has('#st .st-dlg [data-a=dec]')) {
        log && console.log('  решение:', t);
        if (!shotDec) { shotDec = 1; await shot('20_decision'); console.log('overflow decision:', JSON.stringify(await overflow())); }
        await click('#st .st-dlg [data-a=dec]', 300);
      } else if (await has('#st .st-dlg [data-a=ev-ok]')) {
        log && console.log('  событие:', t);
        if (!shotEv && /Кольцо/.test(t)) { shotEv = 1; await shot('21_event_ring'); }
        await click('#st .st-dlg [data-a=ev-ok]', 300);
      } else if (await has('#st .st-dlg [data-a=r-new]')) {
        log && console.log('  итоги:', await txt('#st .st-dlg', 600));
        await shot('22_results');
        console.log('overflow results:', JSON.stringify(await overflow()));
        return 'end';
      }
      else { await click('#st .st-dlg [data-a=mclose]', 250); }
    }
  };

  await page.goto('file:///data/game_ww2/dist-single/index.html');
  await page.waitForTimeout(1200);
  console.log('font Rubik:', await page.evaluate(async () => { await document.fonts.ready; return document.fonts.check('700 14px Rubik'); }));
  ok(await has('#m-st'), 'menu button #m-st');
  console.log('menu label:', await txt('#m-st'));
  await click('#m-st', 900);
  await shot('00_hub');
  console.log('overflow hub:', JSON.stringify(await overflow()));
  if (SIDE === 'AX') await click('#st [data-a=o-side][data-v=AX]');
  await click(`#st [data-a=o-len][data-v="${LEN}"]`);
  await click('#st [data-a=new]', 900);
  await drainModals(true);
  ok(await st(() => !!__app.st.S && __app.st.inGame === 1), 'game started');
  await shot('01_map_army');
  console.log('overflow map:', JSON.stringify(await overflow()));
  const info = await st(() => { const s = __app.st, S = s.S; return { side: S.side, t: S.t, units: S.units.length, hit: s.map.hit.length, lod: s.map.lod, z: +s.map.z.toFixed(2), date: document.querySelector('#st .st-date').innerText.replace(/\s+/g, ' ') }; });
  console.log('start', JSON.stringify(info));
  // штаб армии: касание по портрету
  let p = await hitPt('f', `S.forms[u] && S.forms[u].side === S.side`);
  ok(!!p, 'own HQ token on screen');
  if (p) {
    await tap(p);
    ok(await sheetOpen(), 'form card opened by tap');
    await shot('02_form');
    console.log('form card:', await txt('#st .st-sheet', 300));
    console.log('overflow form:', JSON.stringify(await overflow()));
  }
  // директива «Наступать» с двумя целями
  if (await has('#st .st-sheet [data-a=f-atk]')) {
    await click('#st .st-sheet [data-a=f-atk]');
    ok(await has('#st .st-hint'), 'target hint visible');
    // две вражеские клетки в видимой части карты, ближайшие к штабу армии
    // мало вражеских клеток на экране (альбомная раскладка, сторона Оси) — отдалить карту и искать снова
    const pickTg = () => st(() => {
      const s = __app.st, S = s.S, m = s.map, F = S.forms[s.selF], sid = S.side === 'SOV' ? 1 : 2, { l, t, r, b } = m.inset, L = [], cr = m.cv.getBoundingClientRect();
      for (let c = 0; c < S.G.n; c++) {
        if (!S.own[c] || S.own[c] === sid) continue;
        const [x, y] = m.toScr(S.G.cx[c], S.G.cy[c]);
        if (x < l + 30 || x > m.W - r - 30 || y < t + 80 || y > m.H - b - 30) continue;
        if (m.hitAt(x, y)) continue;
        // клетка не под подсказкой, тостом или кнопкой
        if (document.elementFromPoint(cr.left + x, cr.top + y) !== m.cv) continue;
        L.push([Math.hypot(S.G.cx[c] - S.G.cx[F.hq], S.G.cy[c] - S.G.cy[F.hq]), c]);
      }
      L.sort((a, b) => a[0] - b[0]);
      const R = L.filter((e, i) => i % 3 === 0).slice(0, 2);
      return (R.length === 2 ? R : L.slice(0, 2)).map((e) => e[1]);
    });
    let tg = await pickTg();
    for (let i = 0; i < 3 && tg.length < 2; i++) {
      await st(() => __app.st.map.zoomBy(0.7));
      await page.waitForTimeout(150);
      tg = await pickTg();
    }
    ok(tg.length === 2, 'two visible targets for directive');
    for (const c of tg) await tap(await cellPt(c), 250);
    await shot('03_dir_targets');
    ok(!(await modalOpen()), 'no modal while picking targets');
    ok((await st(() => __app.st.tgt?.picks.length)) === tg.length, 'targets picked');
    await click('#st .st-hint [data-a=tg-done]', 300);
    console.log('directive:', await st(() => { const s = __app.st, F = s.S.forms[s.selF]; return JSON.stringify(F.pdir || F.dir); }));
    ok(await st(() => { const s = __app.st, F = s.S.forms[s.selF]; return !!F.pdir && F.pdir.by === 'pl'; }), 'player directive pending');
  }
  // уровень «Дивизии»
  await click('#st [data-a=lod][data-v=div]', 700);
  await shot('04_map_div');
  ok(await st(() => __app.st.map.lod === 'div'), 'lod div');
  // своя дивизия у линии фронта
  p = await hitPt('u', `u && u.side === S.side && S.eadj[S.side][u.c] > 0`);
  if (!p) p = await hitPt('u', `u && u.side === S.side`);
  ok(!!p, 'own unit on screen');
  if (p) {
    await tap(p);
    ok(await sheetOpen(), 'unit card opened by tap');
    await shot('05_unit');
    console.log('unit card:', await txt('#st .st-sheet', 300));
    console.log('overflow unit:', JSON.stringify(await overflow()));
    // атака: красные клетки → прогноз
    await click('#st .st-sheet [data-a=u-atk]');
    const hl = await st(() => [...(__app.st.map.hl?.keys() || [])]);
    console.log('attack targets:', hl.length, await txt('#st .st-hint', 80));
    // цель атаки — красная клетка, видимая на экране (не под панелью или тостом)
    const tc = await page.evaluate((L) => { const m = __app.st.map, cr = m.cv.getBoundingClientRect(); for (const c of L) { const [x, y] = m.toScr(m.G.cx[c], m.G.cy[c]); if (document.elementFromPoint(cr.left + x, cr.top + y) === m.cv) return c; } return -1; }, hl);
    if (tc >= 0) {
      await tap(await cellPt(tc), 400);
      ok(await modalOpen(), 'attack dialog opened');
      await click('#st .st-dlg [data-a=atk-p][data-v="6"]', 250);
      await shot('06_attack');
      console.log('attack dlg:', await txt('#st .st-dlg', 400));
      console.log('overflow attack:', JSON.stringify(await overflow()));
      await click('#st .st-dlg [data-a=atk-go]', 300);
      ok(!(await modalOpen()), 'attack dialog closed');
      console.log('order:', await st(() => { const s = __app.st, u = s.S.uById.get(s.selU); return JSON.stringify(u.pend || u.ord); }));
    } else await click('#st .st-hint [data-a=tg-x]');
  }
  // скорость
  await click('#st [data-a=menu]');
  await click('#st .st-dlg [data-a=settings]');
  await click(`#st .st-dlg [data-a=s-spd][data-v="${SPD}"]`);
  await shot('07_settings');
  await click('#st .st-dlg [data-a=mclose]');
  // ходы
  let ended = false;
  for (let i = 0; i < TURNS && !ended; i++) {
    const t0 = Date.now(), tt = await st(() => __app.st.S.t);
    await click('#st [data-a=turn]', 120);
    if (i === 0 && SPD < 3) { await page.waitForTimeout(700); await shot('08_running'); }
    for (let k = 0; k < 400; k++) { if (!(await st(() => __app.st.running))) break; await page.waitForTimeout(100); }
    const r = await drainModals(true);
    if (r === 'end') ended = true;
    // если ход прервался событием — докрутить
    for (let j = 0; j < 6 && !ended; j++) {
      const more = await st(() => { const s = __app.st; return !s.S.over && s.meta.tEnd > s.S.t; });
      if (!more) break;
      await click('#st [data-a=turn]', 120);
      for (let k = 0; k < 400; k++) { if (!(await st(() => __app.st.running))) break; await page.waitForTimeout(100); }
      if ((await drainModals(true)) === 'end') ended = true;
    }
    const s = await st(() => { const s = __app.st, S = s.S; return { turn: s.meta.turn, t: S.t, date: document.querySelector('#st .st-date b').innerText, status: document.querySelector('#st .st-status').innerText.replace(/\s+/g, ' '), sugs: s.sugs.length, pk: !!(S.pk && S.pk.on), over: !!S.over }; });
    console.log(`turn ${i + 1}: ${((Date.now() - t0) / 1000).toFixed(1)} s, +${s.t - tt} h`, JSON.stringify(s));
  }
  await shot('09_after_turns');
  console.log('overflow after:', JSON.stringify(await overflow()));
  // рекомендации Ставки
  if (await has('#st .st-sug [data-a=sug-show]')) {
    await shot('10_sug');
    await click('#st .st-sug [data-a=sug-show]', 400);
    ok(await sheetOpen(), 'sug → form card');
    await shot('11_sug_form');
    if (await has('#st .st-sheet [data-a=f-plan]')) await click('#st .st-sheet [data-a=f-plan]');
  }
  // окна
  for (const [a, n] of [['journal', '12_journal'], ['score', '13_score'], ['cats', '14_cats']]) {
    await click(`#st [data-a=${a}]`, 300);
    ok(await modalOpen(), `${a} dialog`);
    await shot(n);
    console.log(`overflow ${a}:`, JSON.stringify(await overflow()));
    await click('#st .st-dlg [data-a=mclose]');
  }
  await click('#st [data-a=menu]');
  await click('#st .st-dlg [data-a=help]', 300);
  await shot('15_help');
  await click('#st .st-dlg [data-a=mclose]');
  // «Назад»: закрывает карточку, затем открывает меню
  p = await hitPt('u', `u && u.side === S.side`);
  if (p) await tap(p);
  // своей части на экране может не быть (например, после ликвидации котла) — тогда шаг с карточкой пропускаем
  if (await st(() => !document.querySelector('#st .st-sheet').classList.contains('hidden'))) {
    const b1 = await st(() => (__app.onBack(), !document.querySelector('#st .st-sheet').classList.contains('hidden')));
    ok(!b1, 'back closes sheet');
  } else console.log('back: no own unit on screen, sheet step skipped');
  await st(() => __app.onBack());
  await page.waitForTimeout(200);
  ok(await modalOpen(), 'back opens game menu');
  await st(() => __app.onBack());
  await page.waitForTimeout(200);
  ok(!(await modalOpen()), 'back closes game menu');
  // выход в главное меню и «Продолжить»
  const tSave = await st(() => __app.st.S.t);
  await click('#st [data-a=menu]');
  await click('#st .st-dlg [data-a=exit]', 600);
  ok(await has('#m-st'), 'back in main menu');
  console.log('menu label after:', await txt('#m-st'));
  await click('#m-st', 800);
  ok(await has('#st [data-a=cont]'), 'continue button');
  await shot('16_hub_cont');
  await click('#st [data-a=cont]', 800);
  await drainModals(false);
  const tLoad = await st(() => __app.st.S.t);
  ok(tLoad === tSave, `continue restores time (${tSave} → ${tLoad})`);
  await shot('17_continued');
  console.log('errors:', errs.length ? errs.join('\n') : 'none');
  console.log(fails.length ? `FAILS: ${fails.length}` : 'ALL OK');
  await browser.close();
  process.exit(fails.length || errs.length ? 1 : 0);
})().catch((e) => { console.log('FATAL', e); process.exit(2); });
