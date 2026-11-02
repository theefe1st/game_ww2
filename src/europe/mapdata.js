// Распаковка карты «Европа» (формат tools/build-europe.mjs) и граф регионов. Чистая функция — для игры и симулятора.
import { REGIONS } from './regions.js';

export const LAND_CLS = (c) => c !== 0 && c !== 2;
export function decodeEurope(E) {
  const { w, h } = E, n = w * h, cls = new Uint8Array(n), reg = new Uint16Array(n);
  let i = 0;
  for (const m of E.cls.matchAll(/([A-Z])([0-9a-z]+)/g)) {
    const v = m[1].charCodeAt(0) - 65, len = parseInt(m[2], 36);
    cls.fill(v, i, i + len), (i += len);
  }
  const runs = E.reg.split(`,`).map((t) => t.split(`.`).map((v) => parseInt(v, 36)));
  let ri = 0, left = runs.length ? runs[0][1] : 0;
  for (let j = 0; j < n && ri < runs.length; j++) {
    if (!LAND_CLS(cls[j])) continue;
    reg[j] = runs[ri][0];
    if (--left === 0 && ++ri < runs.length) left = runs[ri][1];
  }
  const R = REGIONS.map((r, k) => {
    const [px, ax, ay, sx, sy, x0, y0, x1, y1] = E.R[k];
    return { ...r, px, ax, ay, sx, sy, bb: [x0, y0, x1, y1], nb: [], riv: new Set(), sea2: [] };
  });
  for (const [a, b, rv] of E.adj) {
    const A = R[a - 1], B = R[b - 1];
    A.nb.push(b), B.nb.push(a);
    rv && (A.riv.add(b), B.riv.add(a));
  }
  for (const [a, b, z] of E.sea) R[a - 1].sea2.push([b, z]), R[b - 1].sea2.push([a, z]);
  return { w, h, n, proj: E.proj, cls, reg, R, byKey: Object.fromEntries(R.map((r) => [r.k, r])) };
}
