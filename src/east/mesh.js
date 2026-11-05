// «Восточный фронт» (v0.10): треугольная сетка рельефа (низкополигональная подложка).
// Общая для генератора карты (tools/build-east.mjs) и для отрисовки (terrain.js): вершины — треугольная решётка
// с шагом step км и детерминированным сдвигом, высоты и цвета вершин лежат в map.json.
export function meshGrid(w, h, step) {
  const dy = (step * Math.sqrt(3)) / 2;
  return { w, h, step, dy, nx: Math.ceil(w / step) + 3, ny: Math.ceil(h / dy) + 3 };
}
const hash = (i, j) => {
  let h = (Math.imul(i, 374761393) + Math.imul(j, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (h ^ (h >>> 16)) >>> 0;
};
// координаты вершины (i, j) в км карты
export function meshVert(G, i, j) {
  const h = hash(i, j);
  const jx = ((h & 0xffff) / 65535 - 0.5) * 0.55 * G.step, jy = ((h >>> 16) / 65535 - 0.5) * 0.55 * G.dy;
  return [(i - 1 + (j & 1 ? 0.5 : 0)) * G.step + jx, (j - 1) * G.dy + jy];
}
// два треугольника «ячейки» (i, j) между рядами j и j + 1: индексы вершин (i + j * nx)
export function meshTris(G, i, j) {
  const a = i + j * G.nx, b = a + 1, c = i + (j + 1) * G.nx, d = c + 1;
  return j & 1 ? [[a, b, d], [a, d, c]] : [[a, b, c], [b, d, c]];
}
export const triHash = hash;
