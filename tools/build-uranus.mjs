// v0.7: сетка «Сталинград 1942–1943» — клетки ≈10 км поверх map_stalingrad42.json → src/data/uranus42.json
// node tools/build-uranus.mjs   (рельеф клеток, реки как рёбра, мосты, железные дороги, города, источники снабжения)
import fs from 'node:fs';
import { makeGrid, cellAt, chaikin, segX, distPoly, inPoly, nbOf, HW, HH } from '../src/staff/geo.js';

const M = JSON.parse(fs.readFileSync(new URL('../src/data/map_stalingrad42.json', import.meta.url)));
const W = M.w, H = M.h;
const cols = Math.floor(W / HW) + 1, rows = Math.floor(H / HH) + 1;
const G = makeGrid(cols, rows);
const pts = (flat) => { const p = []; for (let k = 0; k < flat.length; k += 2) p.push([flat[k], flat[k + 1]]); return p; };

// ——— Волга у Сталинграда уточнена вручную (в данных карты она слишком грубая) ———
const VC = [[562.8, 204.8], [556, 214], [549, 223], [542, 232], [537, 241], [534, 248], [531, 255], [527.5, 262], [524, 268], [521, 274], [518.5, 280], [516, 286], [514, 292], [514, 298], [517, 304], [523, 309.5], [531, 312.5], [540, 314.5], [547.2, 315.4]];
const vol = pts(M.rivers.find((r) => r.n === 'Волга' && r.p.length > 100).p);
const i0 = vol.findIndex((q) => q[1] > 204), i1 = vol.findIndex((q) => q[0] > 580 && q[1] > 320);
const VOLGA = [...vol.slice(0, i0), ...VC, ...vol.slice(i1)];
const vx = (y) => { for (let i = 1; i < VC.length; i++) { const a = VC[i - 1], b = VC[i]; if ((y - a[1]) * (y - b[1]) <= 0) return a[0] + ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1] || 1); } return VC[VC.length - 1][0]; };
// город — узкая полоса вдоль западного берега (2–4 км), как на штабных картах
const wcity = (y) => (y < 250 ? 3 : y < 268 ? 5.2 : y < 281 ? 6.2 : y < 292 ? 4.2 : y < 305 ? 5.4 : 4);
const STG = [];
for (let y = 241; y <= 314; y += 1.5) STG.push([vx(y) - 1.4, y]);
for (let y = 314; y >= 241; y -= 1.5) STG.push([vx(y) - 1.7 - wcity(y) - Math.sin(y * 0.7) * 0.6, y]);

// мелкие реки котла (нет в исходных данных) — по схемам 1942 г.
const EXTRA = [
  { n: 'Карповка', w: 1, p: [[482, 293], [468, 287], [454, 281], [441, 284], [426, 288], [411, 288], [399, 284]] },
  { n: 'Россошка', w: 1, p: [[472, 214], [467, 230], [459, 246], [454, 262], [453, 279]] },
  { n: 'Червлёная', w: 1, p: [[480, 332], [471, 314], [463, 297], [456, 284]] },
  { n: 'Царица', w: 0, p: [[500, 286], [508, 284], [517.5, 283]] },
];
const RIV = [];
for (const r of M.rivers) {
  if (r.n === 'Волга') continue;
  RIV.push({ n: r.n, w: r.w, p: chaikin(pts(r.p), 2, false) });
}
RIV.push({ n: 'Волга', w: 3, p: chaikin(VOLGA, 2, false) });
for (const r of EXTRA) RIV.push({ n: r.n, w: r.w, p: chaikin(r.p, 2, false) });
const rtype = (n) => (n === 'Волга' ? 3 : n === 'Дон' || n === 'Северский Донец' ? 2 : n === 'Царица' ? 0 : 1);

// ——— клетки: рельеф ———
// 0 — вне карты, 1 — степь, 2 — посёлок, 3 — город (Сталинград), 4 — пойма Волги и Ахтубы
const terr = new Uint8Array(G.n);
const volS = RIV.find((r) => r.n === 'Волга').p;
const eastOfVolga = (x, y) => { let k = 0; for (let i = 1; i < volS.length; i++) { const [ax, ay] = volS[i - 1], [bx, by] = volS[i]; if ((ay > y) !== (by > y)) { const xx = ax + ((y - ay) * (bx - ax)) / (by - ay); if (xx < x) k++; } } return k % 2 === 1; };
for (let i = 0; i < G.n; i++) {
  const x = G.cx[i], y = G.cy[i];
  if (x < -1 || x > W + 1 || y < -1 || y > H + 1) continue;
  terr[i] = 1;
  if (eastOfVolga(x, y) && y > 236 && distPoly(x, y, volS) < 30) terr[i] = 4;
}
// город: клетки западного берега, задевающие полосу застройки
const CITY = [];
for (let i = 0; i < G.n; i++) {
  if (terr[i] !== 1) continue;
  const x = G.cx[i], y = G.cy[i];
  if (y < 236 || y > 320 || eastOfVolga(x, y)) continue;
  let hit = 0;
  for (let dy = -8; dy <= 8; dy += 2) for (let dx = -8; dx <= 8; dx += 2) if (Math.hypot(dx, dy) <= 8.6 && inPoly(x + dx, y + dy, STG)) hit++;
  if (hit >= 3) (terr[i] = 3), CITY.push(i);
}
// внутренние кварталы (Городище — Тракторный, Мамаев курган — Ельшанка): там стоят дивизии LI корпуса
for (const [x, y] of [[511, 255], [494, 285]]) {
  const i = cellAt(G, x, y);
  if (terr[i] === 1) (terr[i] = 3), CITY.push(i);
}
CITY.sort((a, b) => a - b);
// ——— посёлки и подписи ———
// t: 1 — всегда, 2 — уровень армий, 3 — только уровень дивизий; vp — очки победы; air — аэродром
const TOWNS = [
  ['Сталинград', 520, 274, 1, { vp: 10, big: 1 }], ['Калач', 394, 279, 1, { vp: 3 }], ['Котельниково', 345, 484, 1, { vp: 3 }], ['Морозовск', 177, 344, 1, { vp: 4, air: 1 }],
  ['Тацинская', 105, 371, 1, { vp: 4, air: 1 }], ['Серафимович', 293, 108, 2, {}], ['Клетская', 335, 158, 2, {}], ['Суровикино', 309, 295, 2, { vp: 1 }], ['Нижне-Чирская', 340, 341, 2, { vp: 2 }],
  ['Обливская', 266, 310, 2, { vp: 1 }], ['Чернышковский', 230, 331, 2, {}], ['Тормосин', 239, 383, 2, { vp: 1 }], ['Боковская', 180, 176, 2, {}], ['Перелазовский', 264, 196, 2, {}],
  ['Абганерово', 487, 379, 2, {}], ['Верхне-Кумский', 421, 418, 2, {}], ['Иловля', 494, 161, 2, {}], ['Фролово', 409, 71, 2, {}], ['Ленинск', 606, 274, 2, {}],
  ['Цимлянская', 210, 479, 2, {}], ['Вертячий', 418, 225, 2, {}], ['Советский', 431, 297, 2, { vp: 1 }], ['Питомник', 479, 257, 2, { vp: 2, air: 2 }], ['Гумрак', 501, 265, 2, { vp: 2, air: 2 }],
  ['Камышин', 624, 8, 2, {}], ['Михайловка', 356, 14, 2, {}], ['Средняя Ахтуба', 567, 275, 2, {}], ['Светлый Яр', 553, 320, 2, {}], ['Плодовитое', 535, 401, 2, {}], ['Бекетовка', 507, 302, 2, {}],
  ['Вешенская', 164, 101, 2, {}], ['Казанская', 92, 66, 2, {}], ['Милютинская', 157, 291, 2, {}], ['Скосырская', 132, 349, 2, {}],
  ['Ерзовка', 536, 228, 3, {}], ['Рынок', 532, 246, 3, {}], ['Орловка', 513, 251, 3, {}], ['Городище', 510, 259, 3, {}], ['Большая Россошка', 457, 248, 3, {}], ['Карповка', 453, 280, 3, {}],
  ['Мариновка', 425, 287, 3, {}], ['Цыбенко', 469, 306, 3, {}], ['Елхи', 497, 301, 3, {}], ['Купоросное', 512, 291, 3, {}], ['Красноармейск', 521, 312, 3, {}], ['Кузьмичи', 491, 226, 3, {}],
  ['Котлубань', 482, 214, 3, {}], ['Самофаловка', 471, 197, 3, {}], ['Песковатка', 444, 229, 3, {}], ['Дмитриевка', 437, 267, 3, {}], ['Красная Слобода', 529, 277, 3, {}],
  ['Голубинский', 391, 250, 3, {}], ['Манойлин', 327, 210, 3, {}], ['Верхне-Бузиновка', 352, 200, 3, {}], ['Большая Донщинка', 295, 190, 3, {}], ['Распопинская', 306, 149, 3, {}],
  ['Евстратовский', 290, 166, 3, {}], ['Рычковский', 357, 331, 3, {}], ['Верхне-Чирский', 350, 320, 3, {}], ['Громославка', 428, 364, 3, {}], ['Васильевка', 447, 379, 3, {}],
  ['Аксай', 456, 421, 3, {}], ['Зеты', 445, 330, 3, {}], ['Нариман', 486, 318, 3, {}], ['Тундутово', 512, 330, 3, {}], ['Садовое', 537, 460, 3, {}], ['Жутово', 440, 433, 3, {}],
  ['Сиротинская', 412, 157, 3, {}], ['Качалинская', 455, 229, 3, {}], ['Ново-Максимовский', 338, 392, 3, {}], ['Потёмкинская', 318, 383, 3, {}], ['Гнилоаксайская', 470, 410, 3, {}],
];
const towns = [];
for (const [n, x, y, t, o] of TOWNS) {
  const c = cellAt(G, x, y);
  if (c < 0) continue;
  if (t <= 2 && terr[c] === 1 && n !== 'Сталинград') terr[c] = 2;
  towns.push({ n, x, y, c, t, ...o });
}
// ——— рёбра-реки ———
const edges = [];
for (let i = 0; i < G.n; i++) {
  if (!terr[i]) continue;
  for (const j of nbOf(G, i)) {
    if (j < i || !terr[j]) continue;
    let t = 0;
    for (const r of RIV) {
      const rt = rtype(r.n);
      if (rt <= t) continue;
      const p = r.p;
      for (let k = 1; k < p.length; k++)
        if (segX(G.cx[i], G.cy[i], G.cx[j], G.cy[j], p[k - 1][0], p[k - 1][1], p[k][0], p[k][1])) { t = rt; break; }
    }
    if (t) edges.push([i, j, t]);
  }
}
// мосты и постоянные переправы через Дон (на 19.11.1942)
const BR = [['Калач', 393, 276], ['Акимовский', 397, 256], ['Лучинский', 403, 243], ['Вертячий', 424, 229], ['Песковатка', 441, 226],
  ['Нижне-Чирская', 344, 336], ['Рычковский', 353, 329], ['Цимлянская', 211, 483], ['Серафимович', 292, 106], ['Клетская', 333, 141], ['Сиротинская', 410, 150], ['Трёхостровская', 450, 196], ['Вешенская', 164, 98]];
const nearestEdge = (x, y, type) => {
  let best = null, bd = 1e9;
  for (const [a, b, t] of edges) {
    if (t !== type) continue;
    const mx = (G.cx[a] + G.cx[b]) / 2, my = (G.cy[a] + G.cy[b]) / 2, d = Math.hypot(mx - x, my - y);
    if (d < bd) (bd = d), (best = [a, b]);
  }
  return bd < 14 ? best : null;
};
const bridges = [];
for (const [n, x, y] of BR) {
  const e = nearestEdge(x, y, 2);
  if (e && !bridges.some((b) => b[0] === e[0] && b[1] === e[1])) bridges.push([e[0], e[1], n]);
  else console.log('мост не найден/дубль:', n);
}
// переправы через Волгу (только для СССР — снабжение 62-й армии)
const FERRY = [['Центральная', 523, 276], ['Тумак', 531, 250], ['Скудри', 527, 263], ['Бекетовская', 516, 300]];
const ferries = [];
for (const [n, x, y] of FERRY) {
  const e = nearestEdge(x, y, 3);
  if (e && !ferries.some((b) => b[0] === e[0] && b[1] === e[1])) ferries.push([e[0], e[1], n]);
  else console.log('переправа не найдена/дубль:', n);
}
// ——— железные дороги ———
const RAILS = [
  [[519, 276], [510, 270], [501, 265], [497, 250], [490, 232], [482, 214], [487, 190], [494, 161], [462, 120], [409, 71], [372, 36], [356, 14], [348, -6]],
  [[517, 279], [494, 289], [472, 288], [453, 280], [431, 297], [402, 308], [370, 322], [355, 330], [335, 318], [309, 295], [266, 310], [230, 331], [177, 344], [105, 371], [40, 384], [-21, 390]],
  [[513, 303], [498, 340], [487, 379], [455, 418], [420, 440], [345, 484], [318, 515], [298, 545]],
  [[528, 276], [548, 276], [567, 275], [606, 274], [650, 278], [690, 283]],
  [[494, 161], [530, 120], [575, 66], [624, 8], [640, -8]],
];
const rails = RAILS.map((r) => chaikin(r, 2, false));
const rail = new Uint8Array(G.n);
for (const r of rails)
  for (let k = 1; k < r.length; k++) {
    const [ax, ay] = r[k - 1], [bx, by] = r[k], L = Math.hypot(bx - ax, by - ay);
    for (let u = 0; u <= L; u += 1.5) {
      const c = cellAt(G, ax + ((bx - ax) * u) / L, ay + ((by - ay) * u) / L);
      if (c >= 0 && terr[c]) rail[c] = 1;
    }
  }
// ——— источники снабжения: края карты (тыл), выходы железных дорог — дешевле ———
const edgeCells = (f) => { const o = []; for (let i = 0; i < G.n; i++) if (terr[i] && f(G.cx[i], G.cy[i])) o.push(i); return o; };
const src = { SOV: [], AX: [] };
const onRail = (i) => (rail[i] ? 0 : 3);
for (const i of edgeCells((x, y) => y < 8)) src.SOV.push([i, onRail(i)]);
for (const i of edgeCells((x, y) => x > W - 12)) src.SOV.push([i, onRail(i)]);
for (const i of edgeCells((x, y) => x < 10 && y > 60)) src.AX.push([i, onRail(i)]);
for (const i of edgeCells((x, y) => y > H - 14 && x < 360)) src.AX.push([i, onRail(i)]); // юг-восток (калмыцкая степь) — не база снабжения

const r1 = (v) => Math.round(v * 10) / 10;
const out = {
  v: 1, cols, rows, R: 10, w: W, h: H, proj: M.proj,
  terr: Array.from(terr).join(''), rail: Array.from(rail).join(''),
  edges, bridges, ferries,
  rivers: RIV.map((r) => ({ n: r.n, w: r.w, p: r.p.flat().map(r1) })),
  rails: rails.map((r) => r.flat().map(r1)),
  city: { vc: VC, strip: STG.map((q) => [r1(q[0]), r1(q[1])]), cells: CITY },
  towns, src,
};
fs.writeFileSync(new URL('../src/data/uranus42.json', import.meta.url), JSON.stringify(out));
const cnt = [0, 0, 0, 0, 0];
for (const t of terr) cnt[t]++;
console.log(`клеток ${cols}×${rows} = ${G.n}; рельеф`, cnt.join('/'), `; рёбер-рек ${edges.length} (Дон ${edges.filter((e) => e[2] === 2).length}, Волга ${edges.filter((e) => e[2] === 3).length}); мостов ${bridges.length}; переправ ${ferries.length}; город ${CITY.length} клеток [${CITY.join(',')}]; ж/д клеток ${rail.reduce((a, b) => a + b, 0)}`);
console.log('размер', (JSON.stringify(out).length / 1024).toFixed(1), 'КБ');
