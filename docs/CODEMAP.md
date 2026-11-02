# Code map (v0.6.1; restored from v0.4 build, names in game.js are minified)

Project restored 2026-11-02 from MirovoyFront-v0.4.html (original TS sources lost with the old chat). Since v0.5 the project lives on GitHub: `theefe1st/game_ww2` (public; the signing key is NOT in git — it is kept in MirovoyFront-v0.5-source.zip). Android binaries (icons, splash, gradle-wrapper.jar) are stored as text in `tools/android-binaries.b64` → `tools/unpack-binaries.sh` / `tools/pack-binaries.sh`.
- `src/game.js` — whole game (prettified bundle, one scope). `src/data/map_*.json` — hex maps. `src/style.css` — CSS with the inlined Rubik font (variable woff2 300–900, Cyrillic + Latin; `--px: "Rubik", system-ui, …` — used by all modes; canvases use `Rubik, sans-serif` / `FONT(s, w)` in europe/map.js; minified line, new rules appended at the end). Since v0.6.1 the pixel Tiny5 font is gone (hard to read on phones).
- `src/ops/kharkov42.js`, `src/ops/rzhev42.js` — v0.5 operations (factory functions taking the helper object `__OH`).
- `src/front/` — v0.5 «Карта фронта»: `stages.js` (data), `render.js` (pixel rasterizer), `frontmap.js` (interactive canvas widget). Base map: `src/data/front_base.json`.
- `src/europe/` — «Европа 1939–1945» (v0.6; since v0.6.1 — divisions in provinces, phone-first UI; plain ES modules, rules/AI without DOM). Map data: `src/data/europe.json`. See the section below.
- Build: `npx vite build` (dist/ → Android), `npx vite build --mode single` (dist-single/index.html, one file).
- Android: `android/` (Capacitor 8). `npx cap sync android && cd android && ./gradlew assembleRelease` with JAVA_HOME = JDK 21, ANDROID_HOME = SDK (platform 36).
  Release signing: `android/keystore.properties` + `android/keystore/worldfront-release.jks` (KEEP, not in git — needed to update the app without uninstall).
  `MainActivity.java` — immersive fullscreen; manifest — sensorLandscape; `capacitor.config.json` → SystemBars hidden.
- Europe tools: `tools/build-europe.mjs` (NE 10m/50m → src/data/europe.json + preview PNG), `tools/simeu.mjs [seed] [turns] [-v]` (headless all-AI war, prints capitulations and key cities),
  `tools/e2e-europe.cjs` (env W H NAT=SOV|GER|UK Y=1939|1941 TAG TURNS SHOTS DEEP=1: real touch taps on canvas hit boxes — hub → start → select division → march + undo → attack preview → fire or «Лично» round trip →
  foe card → build division → air strike → economy/tech/powers/log/menu/help modals → map modes → turns with events → reload → «Продолжить»; overflow checks; screenshots tools/shots/eu_*.png),
  `tools/e2e-europe2.cjs` (GER 1941 «Барбаросса» decision, rail move + undo, sea move, Android back, game over → over card → hub, stars),
  `tools/shots-modes.cjs` (menu / tactical battle / front map screenshots, portrait + landscape — font check).
- Tests: `tools/autoplay.cjs` (passive play of a standalone op), `tools/walk.cjs` (scripted clicks), `tools/fronttest.cjs [W H]` (front map scenarios → tools/shots/fm_*.png),
  `tools/e2e-career.cjs` (new career → front map → op → result → front map transition), `tools/sim.cjs` (in-page balance sim: env OPS, POL=pass|ai|def|off|smart, SEEDS, CAREER, DIFF).
- Map tools: `tools/build-hexmap.cjs` (NE 10m → hex op map), `tools/build-frontmap.cjs` (NE 10m → front_base.json), `tools/preview-front.mjs [scale] [filter]` (stage previews → tools/shots/front_*.png).
- Debug hooks at the end of game.js: `window.__app` (App instance), `window.__aiCmd(game)` (AI moves for player units), `window.__sim` (headless op simulation).

## Map format (map_*.json)
proj {lon0,lat0,xmin,ymax,pxPerKm} (Lambert azimuthal equal-area, km), cols, rows, R=16 (hex radius px), w,h (px), nations ['', 'GER','SOV'],
terrain: string digit per hex (0 sea,1 lake,2 plain,3 forest,4 hills,5 mountains,6 marsh,7 city), owner: per-hex index into nations,
cities [{name,hex,x,y,vp,hub,port,cap,nat,src?}], rivers [{n,w,p:[x,y,...]}], riverEdges [[hexA,hexB]], cls: pixel class RLE ("<digit><base36 len>." tokens; 1 land, 0 water).
Hex layout: pointy-top odd-r offset, index = row*cols+col. Decoder: function `v(e)` (~line 160).

## Front map (src/front)
- `front_base.json`: w 440, h 348, proj {lon0:30, lat0:52, xmin, ymax, kmPx:6}, cls RLE: 0 sea, 1 land, 2 lake, 3 major river, 4 minor river.
- `stages.js`: FRONT_STAGES[8] {id s41a…s45b, date, title, axis[], sov[], pocket[], neu[]} (polygons [lon,lat]); FRONT_DELTAS[op] {ahead[], behind[]};
  FRONT_CITIES [name, lon, lat, rank 1–3]; FRONT_OPS[op] {at, arrows[{side sov|ger, p}]}; FRONT_TEXT[stage] (2 paragraphs); FRONT_RESULT[op] {ahead, behind}; FRONT_RELIEF.
- `render.js`: frontBase(B) → F {w,h,n,cls,pr(lon,lat)→[x,y],px(poly)}, frontOwners(F, stage, op, kind) → Uint8Array (0 water, 1 SOV, 2 Axis, 3 neutral; speck cleanup ≤24 px),
  frontBaseRGB(F) (terrain colors), frontComposite(F, rgb, own, rgba) (Axis tint+hatch, neutral, front line).
- `frontmap.js`: class FrontMap(canvas, {onMark}) — setOwners, transition(from, to, {delay, done}) (BFS wave from the gaining side + flash), setMarks([{id,i,x,y,num,stars,st:done|next|choice|sel|skip,label}]),
  setArrows([opIds]), fit(bbox, maxZ, ms), setInset(l,t,r,b), zoomBy, destroy. Pointer pan, wheel/pinch zoom, label cache layer.
- Stage ↔ op: op i is played at stage i; after op i the map shows stage i+1 with delta of op i (★★★ ahead, ★ behind, ★★ none). App: `frontDelta(prof, stage)`, `showFrontMap({stage?, after?, intro?})`, `closeFront()`.

## Rules
Terrain table `C` (~line 247), unit types `ee` (inf, cav, mot, arm). Weather table `w`.

## Scenarios
- `_r({...})` builds a career operation scenario: id,name,subtitle,map,year,maxTurn,date:tr(y,m,d,daysPerTurn),nations:[ar(year),or(year)],order,wars,units,events,career,weather(turn),turnEnd,end(g,res),fail.
- Units: `z(nat, army)(type, name, col, row, str, {xp,guard,org})`. Events: `Or(id, turn, title, text, {immediate:[...]})`.
- Career config: general, short, rank, army, armyName, armies{}, start{trust,auth,fame}, sup0, intro, brief, standing, directives[...], requests[...], history, awards[{fame,name}], promotion, stars{two,three,fame}.
- `OPS_ALL` = 8 Soviet op scenarios (standalone list); `ma` = scenarios by id; `J_ALL` = campaign meta for all 8 ops (id,year,period,place,guardNo,reserve,memo[3],news[3]).
- Career route: `STAGES` = 7 stages, stage `BRANCH`=2 is [kharkov42, rzhev42]. `routeOf(profile)` → op id per stage (null = not chosen); `syncRoute(profile)` fills `J` (meta) and `pa` (scenarios) in place for the route (unchosen → placeholder STAGES[i][0]).
- Campaign profile key `wf_camp_v1`, format v2: {v:2,name,short,diff,route[7],ops:[result|null ×7],fails,created}; v1 → v2 migration in `Da` (stage 2 inserted; old done ops[2] → {skip:1} placeholder).
  `Y(profile,t)` = state after t ops (skips ignored); `ka(p)` = next op index; `_a` = rank cap per stage [1,1,2,2,3,3,4]; `ya` = perks per rank; `Ra` applies perks + prev-op effect (★★★ +6 sup, ★ −4).

## UI
App class: showCareerHub, showOpsList, showOpSetup, showCampNew (→ showFrontMap intro), showDossier (rows, «Карта фронта» button, branch row), showBriefing (redirects to the front map while the branch is unchosen; prev-op hint),
startCampOp, showMemoirs, enterGame, runAI, endTurn, showResult, showCareerResult («Дальше» → showFrontMap({after})), showFrontMap, closeFront, careerTurnStart, showOrders, showTelegraph…
DOM layers in #ui: #top, #rail, #bottom, #menu, #front (v0.5), #modal (topmost).

## Europe 1939–1945 (src/europe, v0.6 → v0.6.1 divisions)
- `europe.json` (tools/build-europe.mjs): w 858, h 726, proj LAEA {lon0 22, lat0 50, ≈6.5 km/px}; `cls` pixel classes RLE (`[A-Z]` class + base36 run; 0 sea, 2 lake → water; others land biomes),
  `reg` region id per land pixel (RLE "id.len" in base36, land pixels only), `R[k]` = [px, ax, ay, sx, sy, x0, y0, x1, y1] (area, unit anchor, city/label point, bbox), `adj` [[a, b, river]], `sea` [[a, b, zone]].
- `regions.js`: NATIONS {key: {n, a (genitive), col, …}} (29), NAT_KEYS, SEA_LINKS, REGIONS (236 seeds: key, name, lon, lat, owner 1939, terrain pl|fo|hi|mo|ma|de, ic, oil, st, co, vp, cap/city/port flags, fort, extra), REG by key.
- `mapdata.js`: decodeEurope(E) → {w, h, cls, reg, R[{…seed, px, ax, ay, sx, sy, bb, nb[], riv:Set, sea2[]}], byKey}.
- `rules.js` (pure, v0.6.1 division model): graph `G` (set by useGraph), dates (turn = half month; `turnOf(y, m, d)`, `dateLabel`, `shortDate`, T_END = Dec 1945 = 151).
  **One division per region** (`unitAt(S, r)`); `UT`/`TYPES` = inf, art, cav, mot, arm (atk/def/mv/cost; art — ranged 2 provinces, no counter-fire; cav/mot/arm mv 2, `MECH`, `BLITZ` — mobile units may continue after a breakthrough),
  `MAXS` 10 (strength 1–10), org (`orgMax`), xp (`xpL` stripes), entrenchment; `AIR` = air wings (sorties, not counters). Diplomacy (pairs of wars, blocs axis/allies/comintern: side, ally, coop, atWar, declareWar, makePeace, joinSide),
  ZoC `zocOf`, terrain TERR/TERR_N, cityDef, fortLvl, weather(S, R, P), supply(S, P) → distance per region (−1 none), inSup.
  Orders: `mvOf`, `moves(S, u)` / `attackTargets` / `amphTargets` → targets {r, k: move|capture|attack|fire|amph, cost}, `moveTo`, `RAIL` `railTargets`/`railMove`, `NAVCAP` `seaTargets`/`seaMove`.
  Combat: `combat()` (division vs division; flank support +10 % per adjacent friendly division; terrain, city, river, trenches, forts, weather, supply, tech), `attack(S, u, r)` → report {aO, dO = actual org lost, win, kill, …}
  (defender without org retreats via `retreatTo`, without a way out — surrenders; `capture`), estimate = Monte-Carlo of the same formula; air: `airRange`, `canAir`, `airEst`, `airStrike` (−15…25 org, chance −1 str).
  Economy: PP / oil / manpower, `income`, `upkeep`, `economy`; `buildCost`/`buildSite`/`canBuild`/`build` (own supplied province; arm/mot — industrial only), `canBuyAir`/`buyAir`,
  `reCost`/`canReinforce`/`reinforce` (+ auto-reinforce +1 str for units that stood still, option), TECH/techCost/techYear, vpState, capitalOf/capitalLost, totalStr.
  Visual hook: `S._fx` (optional callback: move/attack/air/kill events → map animations; skipped in save).
- `setup.js`: newState({seed, diff, hist}) — 1939 order of battle as divisions (one per region, extra ones in neighbouring provinces), nations' resources, wars of 1 Sep 1939.
- `events.js`: EV (54 dated events, v0.6.1 adds `sovstrike` — March 1942: if Germany never attacked the USSR, the USSR declares war first; {id, t, until?, if, ask?: nation, ttl, txt, opts[{l, fx}], fx}); runEvents (AI picks opts[0] = historical; for the player → S.pending), resolveEvent(S, id, k),
  checkCapitulations (will to fight: CAP_K/CAP_C; FRA → Vichy, ITA surrender, minors switch side), landing (Torch/Husky/Overlord), playerWar(S, a, b) (GER→SOV before 22.06.1941 triggers Barbarossa).
- `ai.js`: DIR — «director» directives [nation, from t, to t, enemies|'*'|null, mode A (attack, area/obj/need) | H (hold) | S (stage/gar), params]; gate() — historical schedule (no running ahead of history; disabled vs the player);
  aiTurn(S, n): fronts & threats → needs (defence, offence, depth, garrisons, staging) → free units move (rail/sea) → attacks with concentration → production & research.
- `engine.js`: initMap(E) (decode + useGraph), newGame({seed, player, diff, hist, start: 1939|1941}) (1941 = deterministic AI fast-forward to T41 = 43), beginTurn, `*turnSteps(S)` (yields nation before each AI turn — UI time slicing), endTurn, checkEnd (S.over {win, k, t}), save/load (JSON, keys starting with `_` skipped).
- `map.js`: class EuropeMap(canvas, {onTap}) — offscreen 2× ImageData composed from biome base + nation tint (modes 0 political, 1 terrain, 2 supply), occupation hatch, sub-pixel edges (region/coast/border/front);
  partial recompose by changed regions (`refresh()`), highlights `setHL(Map r→kind, sel)`, `flash([{r, col}])`, battle marks `setMarks`, cached label layer (cities, labels with LOD/collision).
  Division tokens (v0.6.1): plate in nation colour + pixel sprite of the type + strength number + org bar; LOD by zoom: full token → compact chip with number → dot; frame gold = ready (`setReady`), dimmed = acted, red = enemy, blue = ally.
  `declutter(items, gw, gh, sel)` — repulsion ≤ 0.6 token size (selected fixed), painter's order top-down (selected last + bobbing marker), `tpos` Map r → [x, y] (leader line to the province when displaced ≥ 7 px);
  hit boxes top-down → `regionAt`. Animations: `animMove`, `boomAt`, `floatText`, `setArrow`, `addFx`, `animating()`. Camera: pan/pinch/wheel, setInset, fit, `flyTo({cx, cy, z}, ms)`, fitRegions, reveal, zoomBy, toScr/toMap, pause. Default zoom ≈ 2.4–2.5 (phone).
  Input: pointer events (tap on pointerup); `touchend` → preventDefault so a tap never turns into a «ghost» click on a panel button rendered under the finger (same in front/frontmap.js and the tactical canvas in game.js).
- `ui.js`: class EuropeUI(root, host {icon, sfx, exit, deep(op, nat, diff, cb)}) — hub (start 1939/1941, nation, difficulty, historical AI; options `wf_eu_opt`), top bar, rail, bottom sheet (portrait) / right panel (landscape).
  Render order: computeReady → updateHL → renderTop/Rail/Sheet. Cards: unitCard (stats rows, «Пополнить»), foeCard (who can attack and odds), provCard («Сформировать дивизию», tag chips), modeCard (rail/sea), airModeCard, overCard.
  Tap own division → targets (green march, yellow capture, red attack, orange fire, violet landing); attack → atkCard (`estimate()` → odds, losses, enemy org after the strike, modifiers, «Лично»); second tap on the target = attack.
  Footer: undo, «Следующая N» (`nextReady`), «Конец хода» (double tap if divisions without orders). Modals: economy, air, tech, powers, log, menu, help; events (S.pending); async end turn (turnSteps + time slicing)
  with `playFx` (AI moves/strikes animated; camera pans to the hottest cluster of attacks on the player if none visible, then flies back to `cam0`; «Быстрее» / option), turn summary (news dedupe `S.nSeen`), game over (stars → `wf_eu_best_<nat>`), undo stack (snapshots, cleared after battle/turn).
  Save `wf_eu_v2` + meta `wf_eu_v2_meta` {v: 2, p, t, d, over, at} (v0.6 saves `wf_eu_v1` are not loaded). `act()` dispatches `data-a` buttons. Exports NAT_INFO, DEEP (ops for «Командовать лично»), EuropeUI.menuLabel().
- `europe.css`: all `#eu` styles (`.land` / `.port` set by layout(), `.hubmode`; compact cards, odds bar, toasts `width: max-content`, small-height media tweaks).
- App glue (`src/game.js`): `#eu` layer, menu button `#m-eu`, `openEurope()/closeEurope()`, `euDeepStart(op, nat, diff, cb)` (backs up the tactical save `Do` → `wf_eu_bak`, starts the op from `ma[op]`),
  `euDeepResult()` (result modal → back to Europe → cb({win, stars})), `euRestore()` (also on app start, if the app was killed mid-battle), showMenu() aborts a deep battle (cb(null) → normal battle), onBack → eu.back().
