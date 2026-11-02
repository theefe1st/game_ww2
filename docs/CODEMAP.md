# Code map (v0.6; restored from v0.4 build, names in game.js are minified)

Project restored 2026-11-02 from MirovoyFront-v0.4.html (original TS sources lost with the old chat). Since v0.5 the project lives on GitHub: `theefe1st/game_ww2` (public; the signing key is NOT in git — it is kept in MirovoyFront-v0.5-source.zip). Android binaries (icons, splash, gradle-wrapper.jar) are stored as text in `tools/android-binaries.b64` → `tools/unpack-binaries.sh` / `tools/pack-binaries.sh`.
- `src/game.js` — whole game (prettified bundle, one scope). `src/data/map_*.json` — hex maps. `src/style.css` — CSS with inlined Tiny5 font (minified line; new rules appended at the end).
- `src/ops/kharkov42.js`, `src/ops/rzhev42.js` — v0.5 operations (factory functions taking the helper object `__OH`).
- `src/front/` — v0.5 «Карта фронта»: `stages.js` (data), `render.js` (pixel rasterizer), `frontmap.js` (interactive canvas widget). Base map: `src/data/front_base.json`.
- `src/europe/` — v0.6 «Европа 1939–1945» (strategic mode, plain ES modules, rules/AI without DOM). Map data: `src/data/europe.json`. See the section below.
- Build: `npx vite build` (dist/ → Android), `npx vite build --mode single` (dist-single/index.html, one file).
- Android: `android/` (Capacitor 8). `npx cap sync android && cd android && ./gradlew assembleRelease` with JAVA_HOME = JDK 21, ANDROID_HOME = SDK (platform 36).
  Release signing: `android/keystore.properties` + `android/keystore/worldfront-release.jks` (KEEP, not in git — needed to update the app without uninstall).
  `MainActivity.java` — immersive fullscreen; manifest — sensorLandscape; `capacitor.config.json` → SystemBars hidden.
- Europe tools: `tools/build-europe.mjs` (NE 10m/50m → src/data/europe.json + preview PNG), `tools/simeu.mjs [seed] [turns] [-v]` (headless all-AI war, prints capitulations and key cities),
  `tools/e2e-europe.cjs` (env W H NAT=SOV|GER|UK Y=1939|1941 TAG TURNS: hub → start → select → attack → production/tech/powers → map modes → turns → screenshots tools/shots/eu_*.png),
  `tools/e2e-europe2.cjs` (rail move + undo, «Командовать лично» round trip, events, reload → continue, game over, back).
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

## Europe 1939–1945 (src/europe, v0.6)
- `europe.json` (tools/build-europe.mjs): w 858, h 726, proj LAEA {lon0 22, lat0 50, ≈6.5 km/px}; `cls` pixel classes RLE (`[A-Z]` class + base36 run; 0 sea, 2 lake → water; others land biomes),
  `reg` region id per land pixel (RLE "id.len" in base36, land pixels only), `R[k]` = [px, ax, ay, sx, sy, x0, y0, x1, y1] (area, unit anchor, city/label point, bbox), `adj` [[a, b, river]], `sea` [[a, b, zone]].
- `regions.js`: NATIONS {key: {n, a (genitive), col, …}} (29), NAT_KEYS, SEA_LINKS, REGIONS (236 seeds: key, name, lon, lat, owner 1939, terrain pl|fo|hi|mo|ma|de, ic, oil, st, co, vp, cap/city/port flags, fort, extra), REG by key.
- `mapdata.js`: decodeEurope(E) → {w, h, cls, reg, R[{…seed, px, ax, ay, sx, sy, bb, nb[], riv:Set, sea2[]}], byKey}.
- `rules.js` (pure): graph `G` (set by useGraph), dates (turn = half month; `turnOf(y, m, d)`, `dateLabel`, `shortDate`, T_END = Dec 1945 = 151), unit types `UT` (inf/mot/arm/air), STACK 8,
  diplomacy (pairs of wars, blocs axis/allies/comintern: side, ally, coop, atWar, declareWar, makePeace, joinSide), terrain TERR, weather(S, R, P), supply(S, P) → distance per region (−1 none),
  combat estimate/battle (r ≥ 1.15 wins; retreat or destroy; losses → S.nat[n].lost), targets(S, u) → [{r, k: move|capture|attack|amph|air, cost}], moveUnit/occupy, railTargets/railMove, seaTargets/seaMove,
  TECH/techCost/techYear, income/upkeep/economy, ITEMS/itemCost/itemTime/canBuy/buy/deployRegion, vpState (victory points lost share), capitalLost, totalStr.
- `setup.js`: newState({seed, diff, hist}) — 1939 order of battle, nations' resources, wars of 1 Sep 1939.
- `events.js`: EV (53 dated events: {id, t, until?, if, ask?: nation, ttl, txt, opts[{l, fx}], fx}); runEvents (AI picks opts[0] = historical; for the player → S.pending), resolveEvent(S, id, k),
  checkCapitulations (will to fight: CAP_K/CAP_C; FRA → Vichy, ITA surrender, minors switch side), landing (Torch/Husky/Overlord), playerWar(S, a, b) (GER→SOV before 22.06.1941 triggers Barbarossa).
- `ai.js`: DIR — «director» directives [nation, from t, to t, enemies|'*'|null, mode A (attack, area/obj/need) | H (hold) | S (stage/gar), params]; gate() — historical schedule (no running ahead of history; disabled vs the player);
  aiTurn(S, n): fronts & threats → needs (defence, offence, depth, garrisons, staging) → free units move (rail/sea) → attacks with concentration → production & research.
- `engine.js`: initMap(E) (decode + useGraph), newGame({seed, player, diff, hist, start: 1939|1941}) (1941 = deterministic AI fast-forward to T41 = 43), beginTurn, `*turnSteps(S)` (yields nation before each AI turn — UI time slicing), endTurn, checkEnd (S.over {win, k, t}), save/load (JSON, keys starting with `_` skipped).
- `map.js`: class EuropeMap(canvas, {onTap}) — offscreen 2× ImageData composed from biome base + nation tint (modes 0 political, 1 terrain, 2 supply), occupation hatch, sub-pixel edges (region/coast/border/front);
  partial recompose by changed regions (`refresh()`), highlights `setHL(Map r→kind, sel)`, `flash([{r, col}])`, battle marks `setMarks`, cached label/unit layer (cities, labels with LOD/collision, unit counters → `hit` boxes),
  camera: pan/pinch/wheel, setInset, fit, fitRegions, reveal, zoomBy, toScr/toMap, regionAt, pause.
- `ui.js`: class EuropeUI(root, host {icon, sfx, exit, deep(op, nat, diff, cb)}) — hub (start 1939/1941, nation, difficulty, historical AI; options `wf_eu_opt`), top bar, rail, region sheet, battle modal (attacker picks, odds, «Лично»),
  production/tech/powers/journal/menu/help modals, events (S.pending), async end turn (turnSteps + time slicing), turn summary, game over (stars → `wf_eu_best_<nat>`), undo stack (snapshots, cleared after battle/turn).
  Save `wf_eu_v1` + meta `wf_eu_v1_meta` {v, p, t, d, over, at}. `act()` dispatches `data-a` buttons. Exports NAT_INFO, DEEP (ops for «Командовать лично»), EuropeUI.menuLabel().
- `europe.css`: all `#eu` styles (`.land` / `.port` set by layout(), `.hubmode`).
- App glue (`src/game.js`): `#eu` layer, menu button `#m-eu`, `openEurope()/closeEurope()`, `euDeepStart(op, nat, diff, cb)` (backs up the tactical save `Do` → `wf_eu_bak`, starts the op from `ma[op]`),
  `euDeepResult()` (result modal → back to Europe → cb({win, stars})), `euRestore()` (also on app start, if the app was killed mid-battle), showMenu() aborts a deep battle (cb(null) → normal battle), onBack → eu.back().
