// E2E (v0.11): «Восточный фронт 1936–1945». Главное меню → настройки → «Как играть» → новая игра (сторона, режим,
// начало) → сводка/события → карта (подсказки) → «Фронты» (приказ, цель на карте) → область: войска, перемещение,
// удар, стройка в области → «Армия» (обучение дивизий, флот) → «Экономика» → «Наука» → ★ «Решения» → «Журнал» →
// меню партии → «Ход» × N (в мирное время — «Месяц») → сохранение → «Продолжить».
// W/H — экран, SIDE — SOV/GER, MODE — hist/free, START — 0|41|39|36 (начало), TAG — префикс скриншотов,
// TURNS — сколько ходов сыграть, SHOTS=0 — без снимков, FAST=1 — без проверки панелей.
const { chromium } = require('/vercel/sandbox/node_modules/playwright');
(async () => {
  const W = +(process.env.W || 844), H = +(process.env.H || 390), SIDE = process.env.SIDE || 'SOV', MODE = process.env.MODE || 'hist';
  const TAG = process.env.TAG || `${SIDE.toLowerCase()}_${W}x${H}`, TURNS = +(process.env.TURNS || 3), SHOTS = process.env.SHOTS !== '0', START = process.env.START || '0';
  const URL = process.env.URL || 'http://127.0.0.1:5173/';
  const browser = await chromium.launch({ executablePath: '/usr/local/bin/chromium', args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, isMobile: true, hasTouch: true, deviceScaleFactor: +(process.env.DPR || 2) });
  await ctx.addInitScript(() => { if (!localStorage.getItem('__e2e')) { localStorage.clear(); localStorage.setItem('__e2e', '1'); } });
  const page = await ctx.newPage();
  const errs = [], fails = [];
  const ok = (c, m) => { if (!c) { fails.push(m); console.log('FAIL', m); } };
  page.on('console', (m) => ['error', 'warning'].includes(m.type()) && errs.push(m.type() + ': ' + m.text()));
  page.on('pageerror', (e) => errs.push('pageerror: ' + e.message + '\n' + e.stack));
  let sn = 0;
  const shot = async (n, wait = 350) => { if (!SHOTS) return; await page.waitForTimeout(wait); await page.screenshot({ path: `tools/shots/east_${TAG}_${String(++sn).padStart(2, '0')}_${n}.png` }); };
  const click = async (sel, wait = 260) => { await page.evaluate((s) => { const b = document.querySelector(s); if (!b) throw new Error('no ' + s); b.click(); }, sel); await page.waitForTimeout(wait); };
  const has = (sel) => page.evaluate((s) => { const e = document.querySelector(s); return !!e && !e.disabled && e.getClientRects().length > 0; }, sel);
  const txt = async (sel, n = 300) => (await page.evaluate((s) => document.querySelector(s)?.innerText || '', sel)).replace(/\s+/g, ' ').slice(0, n);
  const ev = (fn, a) => page.evaluate(fn, a);
  const overflow = (tag) => ev(() => {
    const out = [], vw = innerWidth, vh = innerHeight;
    for (const e of document.querySelectorAll('.east *')) {
      if (!e.getClientRects().length || e.closest('.e-map')) continue;
      const r = e.getBoundingClientRect();
      if (r.width < 2) continue;
      const inScroll = e.closest('.e-pbody, .e-card, .e-nbox, .e-mbox');
      if (r.right > vw + 1 || r.left < -1 || (!inScroll && (r.bottom > vh + 1 || r.top < -1))) out.push(`${e.className?.baseVal ?? e.className ?? e.tagName}: ${Math.round(r.left)}..${Math.round(r.right)} × ${Math.round(r.top)}..${Math.round(r.bottom)}`);
      const cs = getComputedStyle(e);
      if (e.tagName === 'BUTTON' && e.scrollWidth > e.clientWidth + 2 && cs.overflowX !== 'auto') out.push(`btn ${e.className}: "${e.innerText.slice(0, 30)}" ${e.scrollWidth}>${e.clientWidth}`);
    }
    for (const q of ['.e-card', '.e-panel', '.e-pbody', '.e-nbox']) {
      const e = document.querySelector('.east ' + q);
      if (e && e.getClientRects().length && e.scrollWidth > e.clientWidth + 1) out.push(`hscroll ${q} ${e.scrollWidth}>${e.clientWidth}`);
    }
    return out.slice(0, 12);
  }).then((o) => { if (o.length) console.log(`OVERFLOW[${tag}]`, o.join(' | ')); return o; });
  const waitIdle = async (ms = 60000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await ev(() => !window.__east?.isBusy)) return true; await page.waitForTimeout(150); } return false; };
  // карточки: сводка → события (выбор — первый вариант) → пусто
  const drainCards = async (tagShots = false) => {
    for (let i = 0; i < 12; i++) {
      const k = await ev(() => { const m = document.querySelector('.e-modal'); if (!m || m.classList.contains('hidden')) return ''; const c = m.querySelector('.e-card'); return c?.className || '?'; });
      if (!k) return i;
      if (tagShots) { await shot(k.includes('rep') ? 'report' : k.includes('ev') ? 'event' : 'card', 900); await overflow('card ' + k); }
      if (await has('.e-modal [data-a=evc]')) { console.log('choice:', await txt('.e-modal h2', 60)); if (tagShots || process.env.CHOICESHOT) await shot('choice', 500); await click('.e-modal [data-a=evc]', 300); }
      else if (await has('.e-modal [data-a=rep]')) await click('.e-modal [data-a=rep]', 300);
      else if (await has('.e-modal [data-a=evok]')) await click('.e-modal [data-a=evok]', 300);
      else if (await has('.e-modal [data-a=close]')) await click('.e-modal [data-a=close]', 300);
      else { console.log('card without button', k); return i; }
    }
    return 12;
  };
  const tapReg = async (r) => {
    const p = await ev((r) => { const U = window.__east, g = U.M.reg[r]; const [x, y] = U.map.toScr(g.x, g.y); const rc = U.map.root?.getBoundingClientRect?.() || { left: 0, top: 0 }; return [x + rc.left, y + rc.top]; }, r);
    await page.mouse.click(p[0], p[1]); await page.waitForTimeout(350);
    return p;
  };
  const t0 = Date.now();
  await page.goto(URL);
  await page.waitForSelector('.east .e-menu', { timeout: 30000 });
  await page.waitForTimeout(1200);
  console.log('menu in', Date.now() - t0, 'ms;', await txt('.e-mbtns', 200));
  await shot('menu', 600); await overflow('menu');
  await click('[data-a=settings]'); await shot('settings'); await overflow('settings'); await click('.e-modal [data-a=close]');
  await click('[data-a=help]'); await shot('help'); await overflow('help');
  for (let i = 0; i < 6 && await has('.e-modal .e-help [data-a=helpp].e-btn.gold'); i++) await click('.e-modal .e-help [data-a=helpp].e-btn.gold', 150);
  await shot('help_last'); await click('.e-modal [data-a=close]');
  await click('[data-a=play]'); await click(`[data-v="side:${SIDE}"]`); await click(`[data-v="mode:${MODE}"]`); await click(`[data-v="start:${START}"]`);
  const PEACE = START !== '0';
  await shot('new'); await overflow('new');
  const tS = Date.now();
  await click('[data-a=start]', 100);
  await shot('busy', 200);
  ok(await waitIdle(), 'start: AI phase finished');
  console.log('first turn ready in', Date.now() - tS, 'ms; date:', await txt('.e-date', 80), 'steps', await ev(() => window.__east.perf));
  await drainCards(true);
  await shot('map'); await overflow('map');
  if (await has('.e-tip:not(.hidden)')) { console.log('tip:', await txt('.e-tip', 120)); await click('.e-tip [data-a=tipok]', 400); }
  const FAST = process.env.FAST === '1';
  if (!FAST) {
  // направления
  await click('[data-a=dirs]'); await shot('dirs'); await overflow('dirs');
  ok(await ev(() => document.querySelectorAll('.e-dir').length === 5), '5 directions');
  if (PEACE) {
    // мирное время: приказов наступления нет — только пометка «задачи фронтам — с началом войны»
    const dn = await txt('.e-dir:nth-child(3) .e-dnow', 80);
    console.log('peace orders:', dn);
    ok(/мирное время/.test(dn), 'peace: no offensive orders');
    if (await has('.e-panel [data-a=pclose]')) await click('.e-panel [data-a=pclose]');
  } else {
  await click('.e-dir:nth-child(3) [data-p=atk]', 300);
  console.log('center target:', await txt('.e-dir:nth-child(3) .e-tgtc', 80));
  await click('.e-dir:nth-child(3) [data-a=tgt]', 600);
  await shot('pick'); await overflow('pick');
  await page.waitForTimeout(500);
  const tg = await ev(() => { const U = window.__east, m = U.map; let best = -1, bd = 1e9; for (const r of m.hl.pick || []) { const g = U.M.reg[r], [x, y] = m.toScr(g.x, g.y); if (x < 40 || y < 70 || x > m.w - 60 || y > m.h - 140) continue; const d = Math.hypot(x - m.w / 2, y - m.h / 2); if (d < bd) (bd = d), (best = r); } return best; });
  if (tg >= 0) { await tapReg(tg); console.log('picked', tg, await txt('.e-toasts', 100)); }
  ok(tg >= 0, 'pick candidate on screen');
  if (await ev(() => !!window.__east.pick)) { console.log('pick mode still on'); await click('[data-a=cancel]'); }
  if (await has('.e-panel [data-a=pclose]')) await click('.e-panel [data-a=pclose]');
  }
  // своя область у фронта со стопкой
  const fr = await ev(() => { const U = window.__east, S = U.S, P = U.P; let best = -1, n = 0; for (const g of U.M.reg) { if (window.__E?.sideOf && 0) {} const us = S.at[g.id].filter((u) => u.s === P && u.mp > 0.2 && !u.att); if (us.length > n && U.attackers) { n = us.length; best = g.id; } } return best; });
  const frontReg = await ev(() => { const U = window.__east, S = U.S, P = U.P, M = U.M; let best = -1, bn = 0; for (const g of M.reg) { const us = S.at[g.id].filter((u) => u.s === P && u.mp > 0.2); if (!us.length) continue; const en = g.nb.some((e) => S.at[e.r].some((u) => u.s !== P)); if (en && us.length > bn && g.z === 2) { bn = us.length; best = g.id; } } return best; });
  console.log('front region', frontReg, fr);
  if (frontReg >= 0) {
    await ev((r) => { const U = window.__east, g = U.M.reg[r]; U.map.centerOn(g.x, g.y, 1.2); }, frontReg); await page.waitForTimeout(500);
    await shot('zoom_figures', 600);
    await tapReg(frontReg);
    await shot('region_own'); await overflow('region own');
    if (await has('.e-panel [data-a=move]')) {
      await click('.e-panel [data-a=move]', 500); await shot('move'); await overflow('move');
      // ударить по соседней области противника
      const tgt = await ev(() => { const U = window.__east; for (const r of U.map.hl.atk || []) return r; return -1; });
      if (tgt >= 0) { await tapReg(tgt); await page.waitForTimeout(400); if (await ev(() => !!window.__east.sel)) { console.log('attack: low odds, confirm —', await txt('.e-toasts', 100)); await shot('attack_confirm', 50); await tapReg(tgt); } await page.waitForTimeout(700); console.log('attack:', await txt('.e-toasts', 140)); await shot('attack_res', 100); }
      else await click('[data-a=cancel]');
    }
  }
  // область противника: прогноз
  const enReg = await ev(() => { const U = window.__east, S = U.S; for (const g of U.M.reg) if (U.attackers(g.id).length >= 2) return g.id; return -1; });
  if (enReg >= 0) {
    await ev((r) => { const U = window.__east, g = U.M.reg[r]; U.map.centerOn(g.x, g.y, 0.9); }, enReg); await page.waitForTimeout(400);
    await tapReg(enReg); await shot('region_enemy'); await overflow('region enemy');
    if (await has('.e-panel [data-a=attack]')) { await click('.e-panel [data-a=attack]', 300); if (await has('.e-panel [data-a=attack].warn')) { console.log('attack2: low odds, confirm'); await shot('attack2_confirm', 50); await click('.e-panel [data-a=attack].warn', 700); } console.log('attack2:', await txt('.e-toasts', 140)); await shot('attack2', 100); }
    if (await has('.e-panel [data-a=pclose]')) await click('.e-panel [data-a=pclose]');
  }
  // своя тыловая область с заводами: стройка (укрепления, заводы, ПВО…)
  const rear = await ev(() => { const U = window.__east, S = U.S, P = U.P; let b = -1, bf = -1; for (const g of U.M.reg) { if (U.S.own[g.id] < 0 || window.__east.S.at[g.id].some((u) => u.s !== P)) continue; const sd = U.M.nats[S.own[g.id]]; if (sd !== P) continue; if ((S.fac[g.id] || 0) > bf) { bf = S.fac[g.id] || 0; b = g.id; } } return b; });
  if (rear >= 0) {
    await ev((r) => { const U = window.__east, g = U.M.reg[r]; U.map.centerOn(g.x, g.y, 0.9); }, rear); await page.waitForTimeout(400);
    await tapReg(rear); await shot('region_build'); await overflow('region build');
    const nb = await ev(() => document.querySelectorAll('.e-panel [data-a=bld]').length);
    ok(nb >= 3, 'build buttons in region panel');
    if (await has('.e-panel [data-a=bld]:not([disabled])')) { await click('.e-panel [data-a=bld]:not([disabled])', 300); console.log('build:', await txt('.e-toasts', 140)); }
    if (await has('.e-panel [data-a=pclose]')) await click('.e-panel [data-a=pclose]');
  }
  await click('[data-a=army]'); await shot('army'); await overflow('army');
  if (process.env.DBG) console.log('army panel:', await ev(() => { const p = document.querySelector('.e-panel'); return p.className + ' | ' + p.querySelectorAll('[data-a=fleet]').length + ' | ' + p.innerText.replace(/\s+/g, ' ').slice(0, 300); }));
  for (let i = 0; i < 3 && await has('.e-panel [data-a=rqn][data-d="1"]'); i++) await click('.e-panel [data-a=rqn][data-d="1"]', 150);
  if (await has('.e-panel [data-a=rqgo]')) { await click('.e-panel [data-a=rqgo]', 300); console.log('recruit:', await txt('.e-toasts', 140)); } else console.log('recruit: nothing to train (equipment)');
  if (process.env.DBG) console.log('army panel 2:', await ev(() => { const p = document.querySelector('.e-panel'); return p.className + ' | ' + p.querySelectorAll('[data-a=fleet]').length + ' | ' + [...p.querySelectorAll('[data-a=fleet]')].map((e) => e.getClientRects().length + ':' + e.disabled).join(',') + ' | ' + p.innerText.replace(/\s+/g, ' ').slice(0, 200); }));
  if (await has('.e-panel [data-a=fleet][data-sea]')) {
    await click('.e-panel [data-a=fleet][data-sea]', 400); await shot('fleet'); await overflow('fleet');
    ok(await ev(() => document.querySelectorAll('.e-panel .e-sea').length >= 3), 'fleet panel: 3 seas');
  } else ok(false, 'fleet link in army panel');
  await click('[data-a=eco]'); await shot('eco'); await overflow('eco');
  await click('[data-a=sci]'); await shot('sci'); await overflow('sci');
  await click('[data-a=dec]'); await shot('dec'); await overflow('dec');
  ok(await ev(() => document.querySelectorAll('.e-panel .e-dc').length >= 5), 'decisions listed');
  if (await has('.e-panel [data-a=dgo]:not([disabled])')) { await click('.e-panel [data-a=dgo]:not([disabled])', 300); console.log('decision:', await txt('.e-toasts', 140)); }
  await click('[data-a=log]'); await shot('log'); await overflow('log');
  await click('.e-panel [data-a=pclose]');
  await click('[data-a=gmenu]'); await shot('gmenu'); await overflow('gmenu'); await click('.e-modal [data-a=close]');
  }
  await ev(() => window.__east.homeView(false));
  if (PEACE) {
    ok(await ev(() => !!window.__east.S.peace), 'early start: peace');
    ok(await has('.e-skips:not(.hidden) [data-a=skip][data-n=m]'), 'peace: month button');
    const t1 = await ev(() => window.__east.S.turn);
    await click('.e-skips [data-a=skip][data-n=m]', 100);
    ok(await waitIdle(120000), 'month finished');
    await drainCards();
    const t2 = await ev(() => window.__east.S.turn);
    console.log('month:', t1, '→', t2, await txt('.e-date b', 40));
    ok(t2 - t1 >= 4 || !(await ev(() => window.__east.S.peace)), 'month: 4+ weeks');
  }
  let choices = 0;
  for (let t = 0; t < TURNS; t++) {
    const d0 = await txt('.e-date b', 40);
    const tt = Date.now();
    await click('[data-a=next]', 100);
    ok(await waitIdle(), 'turn finished');
    const n = await drainCards(t === 0);
    const d1 = await txt('.e-date b', 40);
    const pf = await ev(() => { const U = window.__east, F = U.map.fst; const r = { steps: U.perf, frames: F.n, upd: Math.round(F.upd / Math.max(1, F.n)), gl: Math.round(F.gl / Math.max(1, F.n)), ov: Math.round(F.ov / Math.max(1, F.n)), max: Math.round(F.max) }; U.map.resetStat(); return r; });
    if (TURNS <= 12 || t % 10 === 0) console.log(`turn ${t + 1}: ${d0} → ${d1} (${Date.now() - tt} ms, cards ${n}) steps ${pf.steps} ms; frames ${pf.frames} avg upd ${pf.upd} gl ${pf.gl} ov ${pf.ov} max ${pf.max}`);
    ok(d0 !== d1, 'date advanced');
    if (await has('.e-tip:not(.hidden)')) { console.log('tip:', await txt('.e-tip', 100)); await click('.e-tip [data-a=tipok]', 300); }
    if (await ev(() => window.__east.mode !== 'game')) { console.log('game over at', d1, await txt('.e-modal .e-end', 200)); await shot('end', 900); break; }
  }
  if (await ev(() => window.__east.mode === 'over')) { console.log('errors:', errs.length ? errs.slice(0, 10).join('\n') : 'none'); await browser.close(); process.exit(0); }
  await shot('after_turns');
  // удар после нескольких недель (войска готовы): карточка области противника → «Атаковать»
  const stillPeace = await ev(() => !!window.__east.S.peace);
  const enR2 = stillPeace ? -1 : await ev(() => { const U = window.__east; let b = -1, n = 0; for (const g of U.M.reg) { const k = U.attackers(g.id).length; if (k > n) (n = k), (b = g.id); } return b; });
  if (stillPeace) console.log('still peace: attack check skipped'); else ok(enR2 >= 0, 'some attack possible after turns');
  if (enR2 >= 0) {
    await ev((r) => { const U = window.__east, g = U.M.reg[r]; U.map.centerOn(g.x, g.y, 0.9); }, enR2); await page.waitForTimeout(400);
    await tapReg(enR2); await shot('region_enemy2'); await overflow('region enemy2');
    ok(await has('.e-panel [data-a=attack]'), 'attack button');
    if (await has('.e-panel [data-a=attack]')) {
      const before = await ev(() => window.__east.S.battles.length);
      await click('.e-panel [data-a=attack]', 300);
      if (await has('.e-panel [data-a=attack].warn')) { console.log('attack3: low odds, confirm'); await click('.e-panel [data-a=attack].warn', 700); } else await page.waitForTimeout(500);
      console.log('attack3:', await txt('.e-toasts', 160));
      ok(await ev((b) => window.__east.S.battles.length > b, before), 'battle resolved');
      await shot('attack3', 100);
    }
    if (await has('.e-panel [data-a=pclose]')) await click('.e-panel [data-a=pclose]');
  }
  const turnA = await ev(() => window.__east.S.turn);
  await click('[data-a=gmenu]'); await click('.e-modal [data-a=exitgame]', 600);
  await shot('menu_cont'); await overflow('menu cont');
  ok(await has('[data-a=cont]'), 'continue button');
  await click('[data-a=cont]', 600); await waitIdle(); await drainCards();
  ok(await ev((t) => window.__east.S.turn === t, turnA), 'continue: same turn');
  await shot('continued');
  console.log('errors:', errs.length ? errs.slice(0, 10).join('\n') : 'none');
  console.log(fails.length ? `FAILS ${fails.length}: ${fails.join('; ')}` : 'ALL OK');
  await browser.close();
  process.exit(fails.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
