# v0.5 plan — «Карта фронта» (user asked: go in order 0.5 → 0.6 → 0.7; old chat lost, project restored from v0.4 build)

1. Fixes: Smolensk passive play gives ★★ (4/5 orders without moving); standalone ops show "Присвоено звание…" (Lukin/Rokossovsky already have it) → hide promotion in standalone Soviet ops; menu/ops-list background map leaves dark strip on the left (menuCamera lacks clamp).
2. Career route: 7 stages; stage 2 (1942) is a branch: kharkov42 | rzhev42. J/pa hold the CURRENT ROUTE (synced from profile.route); OPS_ALL (8 ops) for standalone list; profile v2 (migrate v1: insert stage 2; if old ops[2] done → placeholder {skip:1}).
   Rank caps `_a` → [1,1,2,2,3,3,4].
3. Front Map (src/front/*): strategic pixel map (NE 50m land/lakes/rivers, Lambert azimuthal lon0=30 lat0=55, ~6 km/px), ~70 regions = land BFS from city seeds,
   owners per stage T0..T7 (Jul41, Nov41, May42, Nov42, Jul43, Jun44, Apr45, May45), front line between S and Axis, player deltas (ahead on ★★★ / behind on ★),
   op markers with stars, next-op marker, branch choice panel. Shown after each career result ("Дальше" → front map → briefing), from dossier button, final victory map → epilogue.
   Small effect: previous op ★★★ → +6 supplies next op; ★ → −4.
4. New ops (24x22 hex maps built by tools/build-hexmap.cjs from NE 10m): kharkov42 (6-я армия Городнянского, 12–28.05.1942, trap: Kleist strikes south face turn ~5; telegraph «прекратить наступление»),
   rzhev42 (20-я армия Рейтера, 30.07–23.08.1942, Погорелое Городище → Сычёвка, rains).
5. Sim harness in-page via window.__app/__aiCmd; balance new ops + Smolensk; UI tests both orientations.
6. Android: new Capacitor android project (appId com.worldfront.game, landscape, fullscreen), NEW debug keystore (old lost → uninstall v0.4 first), versionCode 5 / 0.5.0.
   Deliver: APK, single HTML, GDD v0.5, source zip (with keystore!) so the project can't be lost again.
