// «Сталинград 1942–1943» (v0.7): геометрия скрытой сетки — шестиугольники ≈10 км (pointy-top, odd-r).
// Координаты — пиксели карты map_stalingrad42 (1.732 пикс/км). Чистый модуль без DOM.
export const R = 10; // радиус шестиугольника, пикс. карты (между центрами — √3·R ≈ 17.3 пикс ≈ 10 км)
export const HW = Math.sqrt(3) * R; // шаг по горизонтали
export const HH = 1.5 * R; // шаг по вертикали
export const KM = 1.7320508; // пикс. карты на км
export const CELL_KM = HW / KM; // ≈10 км

// направления odd-r: В, СВ, СЗ, З, ЮЗ, ЮВ
const ODD = [[1, 0], [1, -1], [0, -1], [-1, 0], [0, 1], [1, 1]];
const EVEN = [[1, 0], [0, -1], [-1, -1], [-1, 0], [-1, 1], [0, 1]];

export function makeGrid(cols, rows) {
  const n = cols * rows, cx = new Float32Array(n), cy = new Float32Array(n), nb = new Int16Array(n * 6).fill(-1);
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      const i = r * cols + c;
      cx[i] = HW * (c + 0.5 * (r & 1));
      cy[i] = HH * r;
      const D = r & 1 ? ODD : EVEN;
      for (let k = 0; k < 6; k++) {
        const c2 = c + D[k][0], r2 = r + D[k][1];
        if (c2 >= 0 && c2 < cols && r2 >= 0 && r2 < rows) nb[i * 6 + k] = r2 * cols + c2;
      }
    }
  return { cols, rows, n, cx, cy, nb };
}

// пиксель → индекс клетки (или -1)
export function cellAt(G, x, y) {
  const q = ((Math.sqrt(3) / 3) * x - y / 3) / R, r = ((2 / 3) * y) / R;
  let X = q, Z = r, Y = -X - Z;
  let rx = Math.round(X), ry = Math.round(Y), rz = Math.round(Z);
  const dx = Math.abs(rx - X), dy = Math.abs(ry - Y), dz = Math.abs(rz - Z);
  if (dx > dy && dx > dz) rx = -ry - rz;
  else if (dy > dz) ry = -rx - rz;
  else rz = -rx - ry;
  const row = rz, col = rx + (rz - (rz & 1)) / 2;
  if (col < 0 || col >= G.cols || row < 0 || row >= G.rows) return -1;
  return row * G.cols + col;
}

function cube(G, i) {
  const row = (i / G.cols) | 0, col = i % G.cols, x = col - (row - (row & 1)) / 2;
  return [x, -x - row, row];
}
export function hexDist(G, a, b) {
  const A = cube(G, a), B = cube(G, b);
  return Math.max(Math.abs(A[0] - B[0]), Math.abs(A[1] - B[1]), Math.abs(A[2] - B[2]));
}
export const nbOf = (G, i) => {
  const o = [];
  for (let k = 0; k < 6; k++) {
    const j = G.nb[i * 6 + k];
    j >= 0 && o.push(j);
  }
  return o;
};
export const ekey = (a, b) => (a < b ? a * 4096 + b : b * 4096 + a);

// ——— полилинии ———
export function chaikin(p, n, closed) {
  for (let k = 0; k < n; k++) {
    const q = [], L = p.length;
    if (!closed) q.push(p[0]);
    for (let i = 0; i < (closed ? L : L - 1); i++) {
      const a = p[i], b = p[(i + 1) % L];
      q.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25], [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]);
    }
    if (!closed) q.push(p[L - 1]);
    p = q;
  }
  return p;
}
export function segX(ax, ay, bx, by, cx, cy, dx, dy) {
  const d = (bx - ax) * (dy - cy) - (by - ay) * (dx - cx);
  if (Math.abs(d) < 1e-9) return false;
  const u = ((cx - ax) * (dy - cy) - (cy - ay) * (dx - cx)) / d, v = ((cx - ax) * (by - ay) - (cy - ay) * (bx - ax)) / d;
  return u >= 0 && u <= 1 && v >= 0 && v <= 1;
}
export function distSeg(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy;
  let u = L ? ((px - ax) * dx + (py - ay) * dy) / L : 0;
  u = u < 0 ? 0 : u > 1 ? 1 : u;
  const x = ax + dx * u - px, y = ay + dy * u - py;
  return Math.sqrt(x * x + y * y);
}
export function distPoly(px, py, P) {
  let d = 1e9;
  for (let i = 1; i < P.length; i++) d = Math.min(d, distSeg(px, py, P[i - 1][0], P[i - 1][1], P[i][0], P[i][1]));
  return d;
}
export function inPoly(x, y, P) {
  let r = false;
  for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
    const [xi, yi] = P[i], [xj, yj] = P[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) r = !r;
  }
  return r;
}
// мелкий детерминированный ГСЧ (mulberry32) — состояние хранится в сохранении
export function rng(seed) {
  let a = seed >>> 0;
  const f = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  f.state = () => a;
  f.set = (s) => (a = s >>> 0);
  return f;
}
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);