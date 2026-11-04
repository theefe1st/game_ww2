import './style.css';
import __MAP_pl39 from "./data/map_pl39.json";
import __MAP_smolensk41 from "./data/map_smolensk41.json";
import __MAP_moscow41 from "./data/map_moscow41.json";
import __MAP_stalingrad42 from "./data/map_stalingrad42.json";
import __MAP_kursk43 from "./data/map_kursk43.json";
import __MAP_bagration44 from "./data/map_bagration44.json";
import __MAP_berlin45 from "./data/map_berlin45.json";
import __MAP_kharkov42 from "./data/map_kharkov42.json";
import __MAP_rzhev42 from "./data/map_rzhev42.json";
import { kharkov42 as __mkKH } from "./ops/kharkov42.js";
import { rzhev42 as __mkRZ } from "./ops/rzhev42.js";
import { FrontMap, frontState } from "./front/frontmap.js";
import { EuropeUI } from "./europe/ui.js";
import { StaffUI } from "./staff/ui.js";
import { BarbUI } from "./barb/ui.js";
import { WarUI } from "./war/ui.js";
import { FRONT_STAGES, FRONT_OPS, FRONT_TEXT, FRONT_RESULT } from "./front/stages.js";
var e = Object.defineProperty,
  t = (e, t, n) => () => {
    if (n) throw n[0];
    try {
      return (e && (t = e((e = 0))), t);
    } catch (e) {
      throw ((n = [e]), e);
    }
  },
  n = (t, n) => {
    let r = {};
    for (var i in t) e(r, i, { get: t[i], enumerable: !0 });
    return (n || e(r, Symbol.toStringTag, { value: `Module` }), r);
  };
(function () {
  let e = document.createElement(`link`).relList;
  if (e && e.supports && e.supports(`modulepreload`)) return;
  for (let e of document.querySelectorAll(`link[rel="modulepreload"]`)) n(e);
  new MutationObserver((e) => {
    for (let t of e)
      if (t.type === `childList`)
        for (let e of t.addedNodes)
          e.tagName === `LINK` && e.rel === `modulepreload` && n(e);
  }).observe(document, { childList: !0, subtree: !0 });
  function t(e) {
    let t = {};
    return (
      e.integrity && (t.integrity = e.integrity),
      e.referrerPolicy && (t.referrerPolicy = e.referrerPolicy),
      (t.credentials =
        e.crossOrigin === `use-credentials`
          ? `include`
          : e.crossOrigin === `anonymous`
            ? `omit`
            : `same-origin`),
      t
    );
  }
  function n(e) {
    if (e.ep) return;
    e.ep = !0;
    let n = t(e);
    fetch(e.href, n);
  }
})();
var r = __MAP_pl39,
  i = Math.sqrt(3);
function a(e, t, n) {
  let r = i * n,
    a = 1.5 * n;
  return {
    cols: e,
    rows: t,
    R: n,
    W: r,
    rowH: a,
    pxW: Math.ceil(e * r + r / 2),
    pxH: Math.ceil((t - 1) * a + 2 * n),
  };
}
function o(e, t) {
  let n = t % e.cols,
    r = (t / e.cols) | 0;
  return [e.W / 2 + n * e.W + (r & 1 ? e.W / 2 : 0), e.R + r * e.rowH];
}
var s = [
    [1, 0],
    [0, -1],
    [-1, -1],
    [-1, 0],
    [-1, 1],
    [0, 1],
  ],
  c = [
    [1, 0],
    [1, -1],
    [0, -1],
    [-1, 0],
    [0, 1],
    [1, 1],
  ];
function l(e, t, n) {
  let r = t % e.cols,
    i = (t / e.cols) | 0,
    a = (i & 1 ? c : s)[n],
    o = r + a[0],
    l = i + a[1];
  return o < 0 || l < 0 || o >= e.cols || l >= e.rows ? -1 : l * e.cols + o;
}
function u(e, t) {
  let n = [];
  for (let r = 0; r < 6; r++) {
    let i = l(e, t, r);
    i >= 0 && n.push(i);
  }
  return n;
}
function d(e, t) {
  let n = t % e.cols,
    r = (t / e.cols) | 0,
    i = n - (r - (r & 1)) / 2,
    a = r;
  return [i, -i - a, a];
}
function f(e, t, n) {
  let r = d(e, t),
    i = d(e, n);
  return Math.max(
    Math.abs(r[0] - i[0]),
    Math.abs(r[1] - i[1]),
    Math.abs(r[2] - i[2]),
  );
}
function p(e, t, n) {
  let r = t - e.W / 2,
    a = n - e.R,
    o = ((i / 3) * r - a / 3) / e.R,
    s = ((2 / 3) * a) / e.R,
    c = Math.round(o),
    l = Math.round(s),
    u = Math.round(-o - s),
    d = Math.abs(c - o),
    f = Math.abs(l - s),
    p = Math.abs(u - (-o - s));
  d > p && d > f ? (c = -u - l) : p > f ? (u = -c - l) : (l = -c - u);
  let m = l,
    h = c + (l - (l & 1)) / 2;
  return h < 0 || m < 0 || h >= e.cols || m >= e.rows ? -1 : m * e.cols + h;
}
var m = 6371,
  h = Math.PI / 180;
function g(e, t, n) {
  let r = (t - e.lon0) * h,
    i = n * h,
    a = e.lat0 * h,
    o = Math.sqrt(
      2 /
        (1 +
          Math.sin(a) * Math.sin(i) +
          Math.cos(a) * Math.cos(i) * Math.cos(r)),
    );
  return [
    m * o * Math.cos(i) * Math.sin(r),
    m *
      o *
      (Math.cos(a) * Math.sin(i) - Math.sin(a) * Math.cos(i) * Math.cos(r)),
  ];
}
function _(e, t, n) {
  let [r, i] = g(e, t, n);
  return [(r - e.xmin) * e.pxPerKm, (e.ymax - i) * e.pxPerKm];
}
function v(e) {
  let t = a(e.cols, e.rows, e.R),
    n = e.cols * e.rows,
    r = new Uint8Array(n),
    i = new Uint8Array(n);
  for (let t = 0; t < n; t++)
    ((r[t] = e.terrain.charCodeAt(t) - 48), (i[t] = e.owner[t]));
  let o = new Int16Array(n).fill(-1);
  e.cities.forEach((e, t) => (o[e.hex] = t));
  let s = new Set();
  for (let [t, r] of e.riverEdges) (s.add(t * n + r), s.add(r * n + t));
  let c = [];
  for (let e = 0; e < n; e++) c.push(u(t, e));
  let l = new Uint8Array(t.pxW * t.pxH),
    d = 0;
  for (let t of e.cls.split(`.`)) {
    if (!t) continue;
    let e = t.charCodeAt(0) - 48,
      n = parseInt(t.slice(1), 36);
    (l.fill(e, d, d + n), (d += n));
  }
  return {
    g: t,
    proj: e.proj,
    N: n,
    nations: e.nations,
    terrain: r,
    initOwner: i,
    cities: e.cities,
    cityAt: o,
    riverSet: s,
    nbr: c,
    rivers: e.rivers,
    cls: l,
  };
}
var y = (e, t) => e.terrain[t] >= 2,
  b = (e, t, n) => e.riverSet.has(t * e.N + n);
function x(e, t, n) {
  let [r, i] = _(e.proj, t, n);
  return p(e.g, r, i);
}
var ee = {
    inf: {
      name: `Пехота`,
      short: `Пех.`,
      atk: 6,
      def: 7,
      mp: 3,
      cost: 50,
      blitz: !1,
      desc: `Основа фронта. Хорошо держит оборону, медленная.`,
    },
    cav: {
      name: `Кавалерия`,
      short: `Кав.`,
      atk: 5,
      def: 5,
      mp: 4,
      cost: 40,
      blitz: !0,
      desc: `Быстрая, проходит леса и болота. Слабая против танков.`,
    },
    mot: {
      name: `Моторизованная`,
      short: `Мот.`,
      atk: 7,
      def: 6,
      mp: 5,
      cost: 75,
      blitz: !0,
      desc: `Быстрая пехота. Может продолжить движение после успешной атаки.`,
    },
    arm: {
      name: `Танки`,
      short: `Танк.`,
      atk: 10,
      def: 7,
      mp: 5,
      cost: 110,
      blitz: !0,
      desc: `Ударная сила. Прорывает фронт и окружает врага, но слабее в лесах, горах, болотах и городах.`,
    },
  },
  S = (e, t, n, r) => ({ inf: e, cav: t, mot: n, arm: r }),
  C = [
    { name: `Море`, def: 1, cost: S(99, 99, 99, 99), sup: 99, armAtk: 1 },
    { name: `Озеро`, def: 1, cost: S(99, 99, 99, 99), sup: 99, armAtk: 1 },
    { name: `Равнина`, def: 1, cost: S(1, 1, 1, 1), sup: 1, armAtk: 1 },
    { name: `Лес`, def: 1.25, cost: S(2, 1, 2, 2), sup: 1.5, armAtk: 0.75 },
    { name: `Холмы`, def: 1.3, cost: S(2, 2, 2, 2), sup: 1.5, armAtk: 0.85 },
    { name: `Горы`, def: 1.6, cost: S(3, 3, 4, 4), sup: 2, armAtk: 0.6 },
    { name: `Болота`, def: 1.2, cost: S(3, 2, 4, 4), sup: 2.5, armAtk: 0.6 },
    { name: `Город`, def: 1.5, cost: S(1, 1, 1, 1), sup: 1, armAtk: 0.7 },
  ],
  te = 1.3,
  ne = 0.5,
  w = {
    clear: {
      name: `Ясно`,
      icon: `sun`,
      desc: `Лётная погода, дороги сухие.`,
      sky: `Лётная погода, дороги сухие.`,
      mp: {},
      air: 1,
      mech: 1,
      cold: 1,
    },
    rain: {
      name: `Дожди`,
      icon: `rain`,
      desc: `Низкая облачность и раскисшие дороги: авиации вдвое меньше, танки и мотопехота −1 к ходу.`,
      sky: `Низкая облачность, дороги раскисли.`,
      mp: { mot: -1, arm: -1 },
      air: 0.5,
      mech: 1,
      cold: 1,
    },
    mud: {
      name: `Распутица`,
      icon: `mud`,
      desc: `Грязь по колено: все −1 к ходу, танки и мотопехота −2, их атака −15%, авиация почти не летает.`,
      sky: `Грязь по колено, грунтовки непроезжи.`,
      mp: { inf: -1, cav: -1, mot: -2, arm: -2 },
      air: 0.3,
      mech: 0.85,
      cold: 1,
    },
    snow: {
      name: `Снегопад`,
      icon: `snow`,
      desc: `Снег и метели: танки и мотопехота −1 к ходу, авиации меньше.`,
      sky: `Снег и метели.`,
      mp: { mot: -1, arm: -1 },
      air: 0.6,
      mech: 1,
      cold: 1,
    },
    frost: {
      name: `Сильный мороз`,
      icon: `frost`,
      desc: `Мороз за −30: техника глохнет (танки и мотопехота −1 к ходу). Непривычные к русской зиме войска атакуют на 20% слабее и вдвое медленнее восстанавливают организацию.`,
      sky: `Мороз за −30, техника глохнет.`,
      mp: { mot: -1, arm: -1 },
      air: 0.5,
      mech: 1,
      cold: 0.8,
    },
  };
function re(e) {
  let t = w[e],
    n = [],
    r = (e) => `−${Math.abs(e)}`;
  return (
    t.mp.inf && n.push(`пехота и кавалерия ${r(t.mp.inf)} к ходу`),
    t.mp.arm && n.push(`танки и мотопехота ${r(t.mp.arm)} к ходу`),
    t.mech < 1 &&
      n.push(`атака танков и мотопехоты −${Math.round((1 - t.mech) * 100)}%`),
    t.air < 1 &&
      n.push(
        t.air <= 0.3
          ? `авиация почти не летает`
          : t.air <= 0.5
            ? `авиаударов вдвое меньше`
            : `авиаударов меньше`,
      ),
    t.cold < 1 &&
      n.push(
        `войска, непривычные к русской зиме (немцы), атакуют на ${Math.round((1 - t.cold) * 100)}% слабее и вдвое медленнее восстанавливают организацию`,
      ),
    n
  );
}
var ie = (e, t) => Math.max(0, Math.round(e * w[t].air - 0.01)),
  ae = (e) => (e >= 12 ? 3 : e >= 7 ? 2 : +(e >= 3));
function oe(e) {
  let t = parseInt(e.slice(1), 16);
  return [(t >> 16) & 255, (t >> 8) & 255, t & 255];
}
function se(e, t, n) {
  let r = oe(e),
    i = oe(t);
  return (
    `#` +
    r
      .map((e, t) => Math.round(e + (i[t] - e) * n))
      .map((e) => e.toString(16).padStart(2, `0`))
      .join(``)
  );
}
var ce = (e, t) => (t < 0 ? se(e, `#000000`, -t) : se(e, `#ffffff`, t));
function T(e, t) {
  let n = e.length,
    r = Math.max(...e.map((e) => e.length)),
    i = new Uint8ClampedArray(r * n * 4);
  return (
    e.forEach((e, n) => {
      for (let a = 0; a < e.length; a++) {
        let o = t[e[a]];
        if (!o) continue;
        let [s, c, l] = oe(o),
          u = (n * r + a) * 4;
        ((i[u] = s), (i[u + 1] = c), (i[u + 2] = l), (i[u + 3] = 255));
      }
    }),
    { w: r, h: n, data: i }
  );
}
function le(e, t) {
  return { w: e, h: t, data: new Uint8ClampedArray(e * t * 4) };
}
function ue(e, t, n, r) {
  for (let i = 0; i < t.h; i++)
    for (let a = 0; a < t.w; a++) {
      let o = (i * t.w + a) * 4;
      if (!t.data[o + 3]) continue;
      let s = n + a,
        c = r + i;
      if (s < 0 || c < 0 || s >= e.w || c >= e.h) continue;
      let l = (c * e.w + s) * 4;
      ((e.data[l] = t.data[o]),
        (e.data[l + 1] = t.data[o + 1]),
        (e.data[l + 2] = t.data[o + 2]),
        (e.data[l + 3] = t.data[o + 3]));
    }
}
function E(e, t, n, r, i, a) {
  let [o, s, c] = oe(a);
  for (let a = n; a < n + i; a++)
    for (let n = t; n < t + r; n++) {
      if (n < 0 || a < 0 || n >= e.w || a >= e.h) continue;
      let t = (a * e.w + n) * 4;
      ((e.data[t] = o),
        (e.data[t + 1] = s),
        (e.data[t + 2] = c),
        (e.data[t + 3] = 255));
    }
}
var de = [
  `111101101101111`,
  `010110010010111`,
  `111001111100111`,
  `111001111001111`,
  `101101111001001`,
  `111100111001111`,
  `111100111101111`,
  `111001010010010`,
  `111101111101111`,
  `111101111001111`,
];
function fe(e, t, n, r, i, a) {
  let o = String(r),
    s = (t, n, r) => {
      for (let i = 0; i < o.length; i++) {
        let a = de[+o[i]];
        for (let o = 0; o < 15; o++)
          a[o] === `1` && E(e, t + i * 4 + (o % 3), n + ((o / 3) | 0), 1, 1, r);
      }
    };
  if (a)
    for (let [e, r] of [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
      [-1, -1],
      [1, 1],
      [-1, 1],
      [1, -1],
    ])
      s(t + e, n + r, a);
  s(t, n, i);
}
var pe = {
    inf: [
      `......kkk.......`,
      `.....khhhk......`,
      `.....kssk.......`,
      `....kbbbbkkkkkkk`,
      `...kbbbbbbwwwwk.`,
      `...kbbkbbkkkkk..`,
      `....kbbbbk......`,
      `....kbkkbk......`,
      `...kbk..kbk.....`,
      `...kk....kk.....`,
    ],
    arm: [
      `................`,
      `.....kkkkk......`,
      `....kbbbbbkkkkkk`,
      `....kbbbbbkgggk.`,
      `.kkkkkkkkkkkkk..`,
      `kbbbbbbbbbbbbbk.`,
      `kddddddddddddddk`,
      `kdgkgkgkgkgkgdk.`,
      `.kdddddddddddk..`,
      `..kkkkkkkkkkkk..`,
    ],
    cav: [
      `......kkk.......`,
      `.....khhhk......`,
      `.....kssk....kk.`,
      `....kbbbbk..kHHk`,
      `..kkkbbbbkkkHHk.`,
      `.kHHHHHHHHHHHHk.`,
      `kHHHHHHHHHHHHk..`,
      `.kHk.kHk.kHkHk..`,
      `.kHk.kHk..kHk...`,
      `.kk...kk...kk...`,
    ],
    mot: [
      `................`,
      `.kkkkkkkkk......`,
      `.kcccccccckkkk..`,
      `.kcccccccckwwbk.`,
      `.kcccccccckbbbbk`,
      `.kkkkkkkkkkbbbbk`,
      `kddddddddddddddk`,
      `kdkgkddddddkgkdk`,
      `..kgk......kgk..`,
      `...k........k...`,
    ],
  },
  me = {
    GER: {
      body: `#6c7366`,
      dark: `#4a4f47`,
      helmet: `#59604f`,
      canvas: `#7f8473`,
    },
    POL: {
      body: `#7c7650`,
      dark: `#5a5537`,
      helmet: `#686440`,
      canvas: `#8d8760`,
    },
    SOV: {
      body: `#7a7243`,
      dark: `#575130`,
      helmet: `#4f6a3a`,
      canvas: `#8a8257`,
    },
    SVK: {
      body: `#6f735c`,
      dark: `#4f5240`,
      helmet: `#5c604b`,
      canvas: `#80846c`,
    },
  };
function he(e, t) {
  let n = me[t] || me.GER,
    r = {
      k: `#16181a`,
      b: n.body,
      d: n.dark,
      h: n.helmet,
      s: `#e0b48a`,
      w: `#6b4a2b`,
      g: `#9aa0a6`,
      H: `#7a5330`,
      c: n.canvas,
    };
  return T(pe[e], r);
}
var ge = [
    [`.d.`, `dmd`, `mlm`, `.t.`],
    [`..d..`, `.dmd.`, `dmmld`, `.mlm.`, `..t..`],
  ],
  _e = [`..ll..`, `.lmmd.`, `lmmmdd`],
  ve = [`...w...`, `..wwd..`, `.lwmdd.`, `.lmmdd.`, `lmmmmdd`],
  ye = [`..w..`, `.lmd.`, `lmmdd`],
  be = [`r.r`, `r.r`, `.r.`],
  xe = [
    `....t.....`,
    `...tTt....`,
    `.RR.Tw.RR.`,
    `RRRRwwRRRR`,
    `wwwwwwwwww`,
    `wdwwdwwdww`,
    `wwwwwwwwww`,
  ],
  Se = [`.RR..`, `RRRR.`, `wwww.`, `wdww.`],
  Ce = [`k.k.k.k`, `kkkkkkk`, `kgggggk`];
function D(e, t, n = 0) {
  let r = (e * 374761393 + t * 668265263 + n * 1442695041) | 0;
  return (
    (r = Math.imul(r ^ (r >>> 13), 1274126177)),
    ((r ^ (r >>> 16)) >>> 0) / 4294967296
  );
}
function we(e, t, n) {
  let r = Math.floor(e),
    i = Math.floor(t),
    a = e - r,
    o = t - i,
    s = a * a * (3 - 2 * a),
    c = o * o * (3 - 2 * o),
    l = D(r, i, n),
    u = D(r + 1, i, n),
    d = D(r, i + 1, n),
    f = D(r + 1, i + 1, n);
  return l + (u - l) * s + (d - l) * c + (l - u - d + f) * s * c;
}
var O = {
    plains: [`#93b05c`, `#88a653`, `#9cb764`],
    forest: [`#5f8b47`, `#577f40`],
    hills: [`#a8a462`, `#9c9858`],
    mount: [`#8e8676`, `#857d6e`],
    marsh: [`#7a9a6c`, `#6f8f62`],
    urban: [`#9aa77a`, `#909d70`],
  },
  Te = [
    { d: `#2c5229`, m: `#3b6d34`, l: `#5a8f43`, t: `#4a3a28` },
    { d: `#33582a`, m: `#47783a`, l: `#6b9c4c`, t: `#4a3a28` },
    { d: `#5a5a24`, m: `#8a7a30`, l: `#b39a3c`, t: `#4a3a28` },
  ],
  Ee = { l: `#c8c37f`, m: `#a8a462`, d: `#7f7944` },
  De = { w: `#f4f4f0`, l: `#b5ac9b`, m: `#8e8676`, d: `#5b5349` },
  Oe = { r: `#3f5f35` },
  ke = { t: `#5b544b`, T: `#8a8278`, R: `#b5523b`, w: `#ddd4c4`, d: `#6b6359` },
  Ae = { k: `#2a2a2a`, g: `#8a8a84` };
function je(e, t) {
  let { g: n } = e,
    r = n.pxW,
    i = n.pxH,
    a = e.N,
    s = le(r, i),
    c = new Int16Array(r * i);
  for (let t = 0; t < i; t++)
    for (let n = 0; n < r; n++) c[t * r + n] = Me(e, n + 0.5, t + 0.5);
  let l = new Int16Array(r * i).fill(-1);
  for (let t = 0; t < r * i; t++) {
    let i = c[t];
    if (e.cls[t] !== 1 || i < 0) continue;
    if (e.terrain[i] >= 2) {
      l[t] = i;
      continue;
    }
    let a = (t % r) + 0.5,
      s = ((t / r) | 0) + 0.5,
      u = -1,
      d = 1e9;
    for (let t of e.nbr[i]) {
      if (e.terrain[t] < 2) continue;
      let [r, i] = o(n, t),
        c = (r - a) ** 2 + (i - s) ** 2;
      c < d && ((d = c), (u = t));
    }
    ((l[t] = u), u < 0 && (e.cls[t] = 0));
  }
  let u = new Uint8Array(r * i).fill(255),
    d = [];
  for (let t = 0; t < r * i; t++) e.cls[t] === 1 && ((u[t] = 0), d.push(t));
  for (let e = 1; e <= 10 && d.length; e++) {
    let t = [];
    for (let n of d) {
      let a = n % r;
      for (let o of [n - 1, n + 1, n - r, n + r])
        o < 0 ||
          o >= r * i ||
          (o === n - 1 && a === 0) ||
          (o === n + 1 && a === r - 1) ||
          (u[o] > e && ((u[o] = e), t.push(o)));
    }
    d = t;
  }
  let f = (e, t) => {
    let [n, r, i] = oe(t);
    ((s.data[e * 4] = n),
      (s.data[e * 4 + 1] = r),
      (s.data[e * 4 + 2] = i),
      (s.data[e * 4 + 3] = 255));
  };
  for (let t = 0; t < i; t++)
    for (let n = 0; n < r; n++) {
      let a = t * r + n,
        o = e.cls[a];
      if (o === 0) {
        let e = u[a],
          r =
            e <= 1
              ? `#5f97c6`
              : e <= 3
                ? `#3a6f9e`
                : e <= 6
                  ? `#2f6290`
                  : `#28567f`;
        (e > 3 &&
          t % 5 == 0 &&
          (n + ((t / 5) | 0) * 7) % 13 < 3 &&
          D(n >> 4, t, 2) > 0.45 &&
          (r = `#4378a8`),
          f(a, r));
      } else if (o === 2)
        f(a, t % 4 == 0 && (n + t) % 9 < 2 ? `#5d98c8` : `#3b78ab`);
      else {
        let o = l[a],
          s = e.terrain[o],
          c = we(n / 9, t / 9, 3),
          u = D(n, t, 1),
          d;
        switch (s) {
          case 3:
            d = u < 0.5 + (c - 0.5) * 0.6 ? O.forest[0] : O.forest[1];
            break;
          case 4:
            d = u < 0.5 + (c - 0.5) * 0.6 ? O.hills[0] : O.hills[1];
            break;
          case 5:
            d = u < 0.5 + (c - 0.5) * 0.6 ? O.mount[0] : O.mount[1];
            break;
          case 6:
            d = u < 0.5 + (c - 0.5) * 0.6 ? O.marsh[0] : O.marsh[1];
            break;
          case 7:
            d = u < 0.5 ? O.urban[0] : O.urban[1];
            break;
          default:
            d =
              u < 0.04
                ? O.plains[2]
                : u < 0.5 + (c - 0.5) * 0.7
                  ? O.plains[0]
                  : O.plains[1];
        }
        (((n > 0 && e.cls[a - 1] === 0) ||
          (n < r - 1 && e.cls[a + 1] === 0) ||
          (t > 0 && e.cls[a - r] === 0) ||
          (t < i - 1 && e.cls[a + r] === 0)) &&
          (d = `#cdc38d`),
          f(a, d));
      }
    }
  let p = (t, n, a, o) => {
      for (let c = 0; c < t.h; c++)
        for (let u = 0; u < t.w; u++) {
          let d = (c * t.w + u) * 4;
          if (!t.data[d + 3]) continue;
          let f = n + u,
            p = a + c;
          if (f < 0 || p < 0 || f >= r || p >= i) continue;
          let m = p * r + f;
          l[m] === o &&
            e.cls[m] === 1 &&
            ((s.data[m * 4] = t.data[d]),
            (s.data[m * 4 + 1] = t.data[d + 1]),
            (s.data[m * 4 + 2] = t.data[d + 2]));
        }
    },
    m = Te.map((e) => ge.map((t) => T(t, e))),
    h = T(_e, Ee),
    g = T(ve, De),
    _ = T(ye, De),
    v = T(be, Oe),
    y = T([`.www.`, `wwwww`, `.www.`], { w: `#5a8f96` });
  for (let t = 0; t < a; t++) {
    let r = e.terrain[t];
    if (r < 2) continue;
    let [i, a] = o(n, t),
      s = Math.round(i),
      c = Math.round(a);
    if (r === 3)
      for (let e = -14; e <= 12; e += 5)
        for (let n = -13; n <= 11; n += 5) {
          let r = Math.floor(D(t, n * 31 + e, 4) * 3) - 1,
            i = Math.floor(D(t, e * 17 + n, 5) * 3) - 1;
          if (D(t, n + e * 7, 6) < 0.18) continue;
          let a =
            m[D(t, n * 3 + e, 7) < 0.15 ? 2 : D(t, n, 8) < 0.5 ? 0 : 1][
              D(t, e, 9) < 0.5 ? 0 : 1
            ];
          p(a, s + n + r + ((e / 5) & 1 ? 2 : 0), c + e + i, t);
        }
    else if (r === 4)
      [
        [-9, -5],
        [2, -9],
        [-3, 3],
        [6, 1],
        [-10, 6],
        [3, 9],
      ].forEach(([e, n], r) => {
        D(t, r, 10) < 0.8 &&
          p(h, s + e - 3 + Math.floor(D(t, r, 11) * 3), c + n, t);
      });
    else if (r === 5)
      (p(g, s - 3, c - 4, t),
        p(_, s - 11, c - 1, t),
        p(_, s + 5, c, t),
        D(t, 1, 12) < 0.7 && p(_, s - 5, c + 6, t),
        D(t, 2, 12) < 0.7 && p(_, s + 1, c - 11, t));
    else if (r === 6)
      for (let e = 0; e < 7; e++) {
        let n = Math.floor(D(t, e, 13) * 22) - 11,
          r = Math.floor(D(t, e, 14) * 24) - 12;
        p(e % 2 ? y : v, s + n, c + r, t);
      }
  }
  let b = le(r, i),
    x = (e, t, n) => {
      if (e < 0 || t < 0 || e >= r || t >= i) return;
      let a = (t * r + e) * 4;
      ((b.data[a] = n[0]),
        (b.data[a + 1] = n[1]),
        (b.data[a + 2] = n[2]),
        (b.data[a + 3] = 255));
    },
    ee = oe(`#3e7fc1`),
    S = oe(`#2f6aa8`);
  for (let t of e.rivers)
    for (let n = 0; n + 3 < t.p.length; n += 2) {
      let i = t.p[n],
        a = t.p[n + 1],
        o = t.p[n + 2],
        s = t.p[n + 3],
        c = Math.max(1, Math.ceil(Math.hypot(o - i, s - a) * 1.5));
      for (let n = 0; n <= c; n++) {
        let l = Math.floor(i + ((o - i) * n) / c),
          u = Math.floor(a + ((s - a) * n) / c);
        e.cls[u * r + l] === 1 &&
          (x(l, u, ee), t.w >= 2 && (x(l + 1, u, S), x(l, u + 1, S)));
      }
    }
  let C = T(xe, ke),
    te = T(Se, ke),
    ne = T(Ce, Ae);
  for (let t of e.cities) {
    let [e, r] = o(n, t.hex),
      i = t.vp >= 3 ? C : te;
    ue(b, i, Math.round(e - i.w / 2), Math.round(r - i.h / 2) + 1);
  }
  for (let e of Object.keys(t)) {
    let [t, r] = o(n, +e);
    ue(b, ne, Math.round(t - 3), Math.round(r + 10));
  }
  let w = new Uint8Array(r * i);
  for (let e = 0; e < i; e++)
    for (let t = 0; t < r; t++) {
      let n = e * r + t,
        a = l[n];
      a < 0 ||
        (((t + 1 < r && l[n + 1] !== a && l[n + 1] >= 0) ||
          (e + 1 < i && l[n + r] !== a && l[n + r] >= 0) ||
          (t > 0 && l[n - 1] !== a && l[n - 1] >= 0) ||
          (e > 0 && l[n - r] !== a && l[n - r] >= 0)) &&
          (w[n] = 1));
    }
  return { base: s, decor: b, dispHex: l, edge: w };
}
function Me(e, t, n) {
  return p(e.g, t, n);
}
function Ne(e) {
  "@babel/helpers - typeof";
  return (
    (Ne =
      typeof Symbol == `function` && typeof Symbol.iterator == `symbol`
        ? function (e) {
            return typeof e;
          }
        : function (e) {
            return e &&
              typeof Symbol == `function` &&
              e.constructor === Symbol &&
              e !== Symbol.prototype
              ? `symbol`
              : typeof e;
          }),
    Ne(e)
  );
}
function Pe(e, t) {
  if (Ne(e) != `object` || !e) return e;
  var n = e[Symbol.toPrimitive];
  if (n !== void 0) {
    var r = n.call(e, t || `default`);
    if (Ne(r) != `object`) return r;
    throw TypeError(`@@toPrimitive must return a primitive value.`);
  }
  return (t === `string` ? String : Number)(e);
}
function Fe(e) {
  var t = Pe(e, `string`);
  return Ne(t) == `symbol` ? t : t + ``;
}
function k(e, t, n) {
  return (
    (t = Fe(t)) in e
      ? Object.defineProperty(e, t, {
          value: n,
          enumerable: !0,
          configurable: !0,
          writable: !0,
        })
      : (e[t] = n),
    e
  );
}
function Ie(e) {
  let t = document.createElement(`canvas`);
  ((t.width = e.w), (t.height = e.h));
  let n = t.getContext(`2d`),
    r = n.createImageData(e.w, e.h);
  return (r.data.set(e.data), n.putImageData(r, 0, 0), t);
}
var Le = class {
    constructor(e, t) {
      (k(this, `canvas`, void 0),
        k(this, `ctx`, void 0),
        k(this, `m`, void 0),
        k(this, `G`, void 0),
        k(this, `L`, void 0),
        k(this, `comp`, void 0),
        k(this, `compCtx`, void 0),
        k(this, `compImg`, void 0),
        k(this, `over`, void 0),
        k(this, `overCtx`, void 0),
        k(this, `overImg`, void 0),
        k(this, `decor`, void 0),
        k(this, `dpr`, 1),
        k(this, `zoom`, 2),
        k(this, `ox`, 0),
        k(this, `oy`, 0),
        k(this, `dirty`, !0),
        k(this, `ownDirty`, !0),
        k(this, `overlay`, {}),
        k(this, `fx`, []),
        k(this, `animPos`, new Map()),
        k(this, `hidden`, new Set()),
        k(this, `dispPos`, new Map()),
        k(this, `ghosts`, new Map()),
        k(this, `dispOwner`, null),
        k(this, `Lkey`, ``),
        k(this, `onTap`, () => {}),
        k(this, `onLong`, () => {}),
        k(this, `showLabels`, !0),
        k(this, `zone`, null),
        k(this, `isCmd`, null),
        k(this, `counterCache`, new Map()),
        k(this, `pointers`, new Map()),
        k(this, `pinch`, null),
        k(this, `moved`, !1),
        k(this, `camAnim`, null),
        k(this, `longTimer`, 0),
        k(this, `supplyCache`, {}),
        k(this, `bagCache`, []),
        (this.canvas = e),
        (this.ctx = e.getContext(`2d`)),
        (this.m = t),
        this.resize(),
        window.addEventListener(`resize`, () => this.resize()),
        this.bindInput());
      let n = () => {
        (this.frame(), requestAnimationFrame(n));
      };
      requestAnimationFrame(n);
    }
    setGame(e) {
      this.G = e;
      let t = e.s.scen + JSON.stringify(e.s.forts);
      (this.L && t === this.Lkey) ||
        ((this.L = je(this.m, e.s.forts)), (this.Lkey = t));
      let { pxW: n, pxH: r } = this.m.g;
      ((this.comp = document.createElement(`canvas`)),
        (this.comp.width = n),
        (this.comp.height = r),
        (this.compCtx = this.comp.getContext(`2d`)),
        (this.compImg = this.compCtx.createImageData(n, r)),
        (this.over = document.createElement(`canvas`)),
        (this.over.width = n),
        (this.over.height = r),
        (this.overCtx = this.over.getContext(`2d`)),
        (this.overImg = this.overCtx.createImageData(n, r)),
        (this.decor = Ie(this.L.decor)),
        (this.ownDirty = !0),
        this.setOverlay({}),
        this.counterCache.clear());
    }
    resize() {
      this.dpr = Math.min(3, window.devicePixelRatio || 1);
      let e = window.innerWidth,
        t = window.innerHeight;
      ((this.canvas.width = Math.round(e * this.dpr)),
        (this.canvas.height = Math.round(t * this.dpr)),
        (this.canvas.style.width = e + `px`),
        (this.canvas.style.height = t + `px`),
        this.clampCam(),
        (this.dirty = !0));
    }
    get scale() {
      return Math.max(1, Math.round(this.zoom * this.dpr));
    }
    minZoom() {
      return Math.max(
        0.6,
        Math.min(
          this.canvas.width / this.m.g.pxW,
          this.canvas.height / this.m.g.pxH,
        ) / this.dpr,
      );
    }
    clampCam() {
      if (!this.m) return;
      this.zoom = Math.max(this.minZoom(), Math.min(6, this.zoom));
      let e = this.scale,
        t = this.m.g.pxW * e,
        n = this.m.g.pxH * e,
        r = this.canvas.width,
        i = this.canvas.height,
        a = r * 0.35,
        o = i * 0.35;
      ((this.ox =
        t + a < r ? (r - t) / 2 : Math.min(a, Math.max(r - t - a, this.ox))),
        (this.oy =
          n + o < i ? (i - n) / 2 : Math.min(o, Math.max(i - n - o, this.oy))));
    }
    screenToBase(e, t) {
      let n = this.scale;
      return [(e * this.dpr - this.ox) / n, (t * this.dpr - this.oy) / n];
    }
    hexAt(e, t) {
      let [n, r] = this.screenToBase(e, t);
      return p(this.m.g, n, r);
    }
    centerOn(e, t = !0, n) {
      n && (this.zoom = n);
      let [r, i] = o(this.m.g, e),
        a = this.scale,
        s = this.canvas.width / 2 - r * a,
        c = this.canvas.height / 2 - i * a;
      t
        ? (this.camAnim = {
            x0: this.ox,
            y0: this.oy,
            x1: s,
            y1: c,
            t0: performance.now(),
            dur: 280,
          })
        : ((this.ox = s), (this.oy = c), this.clampCam(), (this.dirty = !0));
    }
    isVisible(e, t = 60) {
      let [n, r] = o(this.m.g, e),
        i = this.scale,
        a = this.ox + n * i,
        s = this.oy + r * i,
        c = t * this.dpr;
      return (
        a > c &&
        s > c * 1.4 &&
        a < this.canvas.width - c &&
        s < this.canvas.height - c * 1.6
      );
    }
    ensureVisible(e) {
      this.isVisible(e) || this.centerOn(e);
    }
    bindInput() {
      let e = this.canvas;
      // v0.6.1: без «призрачного» click по кнопкам панели, появившимся под пальцем после касания карты
      e.addEventListener(`touchend`, (t) => t.cancelable && t.preventDefault(), { passive: !1 });
      (e.addEventListener(`pointerdown`, (t) => {
        if (
          (e.setPointerCapture(t.pointerId),
          this.pointers.set(t.pointerId, {
            x: t.clientX,
            y: t.clientY,
            x0: t.clientX,
            y0: t.clientY,
            t0: performance.now(),
          }),
          this.pointers.size === 1 &&
            ((this.moved = !1),
            clearTimeout(this.longTimer),
            (this.longTimer = window.setTimeout(() => {
              if (!this.moved && this.pointers.size === 1) {
                this.moved = !0;
                let e = this.hexAt(t.clientX, t.clientY);
                e >= 0 && this.onLong(e);
              }
            }, 550))),
          this.pointers.size === 2)
        ) {
          let [e, t] = [...this.pointers.values()];
          ((this.pinch = {
            d: Math.hypot(e.x - t.x, e.y - t.y),
            z: this.zoom,
            cx: (e.x + t.x) / 2,
            cy: (e.y + t.y) / 2,
          }),
            (this.moved = !0));
        }
      }),
        e.addEventListener(`pointermove`, (e) => {
          let t = this.pointers.get(e.pointerId);
          if (!t) return;
          let n = e.clientX - t.x,
            r = e.clientY - t.y;
          if (((t.x = e.clientX), (t.y = e.clientY), this.pointers.size === 1))
            (Math.hypot(t.x - t.x0, t.y - t.y0) > 8 && (this.moved = !0),
              this.moved &&
                ((this.ox += n * this.dpr),
                (this.oy += r * this.dpr),
                (this.camAnim = null),
                this.clampCam(),
                (this.dirty = !0)));
          else if (this.pointers.size === 2 && this.pinch) {
            let [e, t] = [...this.pointers.values()],
              n = Math.hypot(e.x - t.x, e.y - t.y),
              r = (e.x + t.x) / 2,
              i = (e.y + t.y) / 2;
            (this.zoomAt(this.pinch.z * (n / this.pinch.d), r, i),
              (this.ox += (r - this.pinch.cx) * this.dpr),
              (this.oy += (i - this.pinch.cy) * this.dpr),
              (this.pinch.cx = r),
              (this.pinch.cy = i),
              this.clampCam());
          }
        }),
        e.addEventListener(`pointerup`, (e) => {
          let t = this.pointers.get(e.pointerId);
          if (
            (this.pointers.delete(e.pointerId),
            clearTimeout(this.longTimer),
            this.pointers.size < 2 && (this.pinch = null),
            t &&
              !this.moved &&
              this.pointers.size === 0 &&
              performance.now() - t.t0 < 600)
          ) {
            let t = this.hexAt(e.clientX, e.clientY);
            this.onTap(t, e.clientX, e.clientY);
          }
          this.pointers.size === 0 && (this.moved = !1);
        }),
        e.addEventListener(`pointercancel`, (e) => {
          (this.pointers.delete(e.pointerId),
            (this.pinch = null),
            clearTimeout(this.longTimer));
        }),
        e.addEventListener(
          `wheel`,
          (e) => {
            (e.preventDefault(),
              this.zoomAt(
                this.zoom * (e.deltaY < 0 ? 1.25 : 0.8),
                e.clientX,
                e.clientY,
              ));
          },
          { passive: !1 },
        ),
        e.addEventListener(`contextmenu`, (e) => e.preventDefault()));
    }
    zoomAt(e, t, n) {
      let [r, i] = this.screenToBase(t, n);
      this.zoom = Math.max(this.minZoom(), Math.min(6, e));
      let a = this.scale;
      ((this.ox = t * this.dpr - r * a),
        (this.oy = n * this.dpr - i * a),
        this.clampCam(),
        (this.dirty = !0));
    }
    natCols() {
      let e = this.m.nations.length,
        t = [],
        n = [],
        r = [],
        i = this.G;
      for (let a = 0; a < e; a++) {
        let e = this.m.nations[a],
          o = i.nd[e];
        (t.push(oe(o ? o.color : `#888888`)),
          n.push(oe(o ? o.dark : `#333333`)));
        let s = i.s.player;
        r.push(
          !!e &&
            e !== s &&
            !i.s.wars.some((t) => t.split(`-`).includes(e)) &&
            !i.s.allies.some((t) => t.includes(e) && t.includes(s)),
        );
      }
      return { fill: t, dark: n, neutral: r };
    }
    refreshOwnership() {
      let { pxW: e, pxH: t } = this.m.g,
        n = this.compImg.data,
        r = this.L.base.data,
        i = this.m.cls,
        a = this.L.dispHex,
        o = this.L.edge,
        s = this.dispOwner || this.G.s.owner,
        { fill: c, dark: l, neutral: u } = this.natCols(),
        d = 0.34;
      for (let f = 0; f < t; f++)
        for (let p = 0; p < e; p++) {
          let m = f * e + p,
            h = m * 4,
            g = a[m];
          if (i[m] !== 1 || g < 0) {
            ((n[h] = r[h]),
              (n[h + 1] = r[h + 1]),
              (n[h + 2] = r[h + 2]),
              (n[h + 3] = 255));
            continue;
          }
          let _ = s[g],
            v = c[_],
            y = r[h] + (v[0] - r[h]) * d,
            b = r[h + 1] + (v[1] - r[h + 1]) * d,
            x = r[h + 2] + (v[2] - r[h + 2]) * d;
          if (u[_]) {
            let e = (y + b + x) / 3;
            ((y = y * 0.6 + e * 0.4),
              (b = b * 0.6 + e * 0.4),
              (x = x * 0.6 + e * 0.4),
              (p + f) % 5 == 0 && ((y *= 0.86), (b *= 0.86), (x *= 0.86)));
          }
          if (o[m]) {
            let n = !1,
              r = [
                p + 1 < e ? m + 1 : -1,
                p > 0 ? m - 1 : -1,
                m + e < e * t ? m + e : -1,
                m - e >= 0 ? m - e : -1,
              ];
            for (let e of r)
              e >= 0 && a[e] >= 0 && a[e] !== g && s[a[e]] !== _ && (n = !0);
            if (n) {
              let e = l[_];
              ((y = e[0]), (b = e[1]), (x = e[2]));
            } else ((y *= 0.9), (b *= 0.9), (x *= 0.9));
          }
          ((n[h] = y), (n[h + 1] = b), (n[h + 2] = x), (n[h + 3] = 255));
        }
      (this.compCtx.putImageData(this.compImg, 0, 0),
        this.compCtx.drawImage(this.decor, 0, 0),
        (this.ownDirty = !1),
        (this.dirty = !0));
    }
    setOverlay(e) {
      this.overlay = e;
      let { pxW: t, pxH: n } = this.m.g,
        r = this.overImg.data;
      r.fill(0);
      let i = this.L.dispHex,
        a = this.L.edge,
        o = this.zone && this.zone.size ? this.zone : null;
      if (
        e.reach ||
        e.attack ||
        e.moveAttack ||
        e.recruit ||
        e.supply ||
        e.sel !== void 0 ||
        e.air ||
        o
      )
        for (let s = 0; s < n; s++)
          for (let n = 0; n < t; n++) {
            let c = s * t + n,
              l = i[c];
            if (l < 0) continue;
            let u = null,
              d = a[c];
            if (
              (e.attack?.has(l)
                ? (u = d
                    ? [255, 60, 50, 255]
                    : (n + s) % 2
                      ? [255, 40, 40, 110]
                      : [255, 40, 40, 60])
                : e.air?.has(l)
                  ? (u = d
                      ? [255, 210, 60, 255]
                      : (n + s) % 2
                        ? [255, 210, 60, 100]
                        : null)
                  : e.moveAttack?.has(l)
                    ? (u = d
                        ? [255, 150, 40, 230]
                        : (n + s) % 2
                          ? [255, 150, 40, 70]
                          : null)
                    : e.recruit?.has(l)
                      ? (u = d
                          ? [90, 200, 255, 255]
                          : (n + s) % 2
                            ? [90, 200, 255, 90]
                            : null)
                      : e.reach?.has(l) &&
                        (u = d
                          ? [255, 255, 255, 210]
                          : (n + s) % 2
                            ? [255, 255, 255, 120]
                            : [255, 255, 255, 55]),
              e.supply && !u)
            ) {
              let t = e.supply[l];
              t === 2
                ? (u = (n + 2 * s) % 6 < 2 ? [150, 0, 0, 150] : [70, 0, 0, 60])
                : t === 3
                  ? (u = d
                      ? [140, 255, 150, 255]
                      : (n + s) % 3 == 0
                        ? [120, 240, 140, 90]
                        : null)
                  : t === 1 &&
                    (u =
                      (n % 4 == 0 && s % 4 == 0) ||
                      ((n + 2) % 4 == 0 && (s + 2) % 4 == 0)
                        ? [120, 235, 130, 120]
                        : null);
            }
            if (o && !u && o.has(l)) {
              let e = (e) => e < 0 || e >= i.length || i[e] < 0 || !o.has(i[e]);
              (e(c - 1) || e(c + 1) || e(c - t) || e(c + t)) && (n + s) % 4 < 3
                ? (u = [255, 214, 90, 255])
                : (n + s) % 8 == 0 && s % 2 == 0 && (u = [255, 214, 90, 70]);
            }
            if ((e.sel === l && d && (u = [255, 230, 80, 255]), u)) {
              let e = c * 4;
              ((r[e] = u[0]),
                (r[e + 1] = u[1]),
                (r[e + 2] = u[2]),
                (r[e + 3] = u[3]));
            }
          }
      (this.overCtx.putImageData(this.overImg, 0, 0), (this.dirty = !0));
    }
    counter(e, t, n, r = !1) {
      let i = this.G.nd[e.nat].orgMax,
        a = Math.round((e.org / i) * 10),
        o = `${e.nat}|${e.type}|${e.str}|${a}|${+!!t}|${+!!n}|${e.entrench}|${ae(e.xp)}|${+!!e.fresh}|${+!!r}|${+!!e.guard}`,
        s = this.counterCache.get(o);
      if (s) return s;
      let c = this.G.nd[e.nat],
        l = le(24, 20);
      (E(l, 0, 0, 24, 20, `#121416`),
        E(l, 1, 1, 22, 12, c.light),
        E(l, 1, 1, 22, 1, ce(c.light, 0.35)),
        E(l, 1, 13, 22, 6, `#24272b`),
        ue(l, he(e.type, e.nat), 4, 2),
        fe(l, 2, 14, e.str, e.str <= 3 ? `#ff7a6a` : `#ffffff`));
      let u = Math.max(0, Math.min(1, e.org / i));
      E(l, 11, 15, 11, 2, `#4a4d52`);
      let d = u > 0.6 ? `#62d36b` : u > 0.3 ? `#e8c64a` : `#e5574b`;
      u > 0 && E(l, 11, 15, Math.max(1, Math.round(11 * u)), 2, d);
      let f = ae(e.xp);
      for (let e = 0; e < f; e++) E(l, 2 + e * 2, 2, 1, 1, `#ffd84a`);
      if (r) {
        for (let e = 0; e < l.data.length; e += 4) {
          let t = 0.3 * l.data[e] + 0.59 * l.data[e + 1] + 0.11 * l.data[e + 2];
          ((l.data[e] = (l.data[e] * 0.45 + t * 0.55) * 0.86),
            (l.data[e + 1] = (l.data[e + 1] * 0.45 + t * 0.55) * 0.86),
            (l.data[e + 2] = (l.data[e + 2] * 0.45 + t * 0.55) * 0.86));
        }
        (E(l, 1, 1, 3, 1, `#121416`),
          E(l, 1, 2, 2, 1, `#121416`),
          E(l, 1, 3, 1, 1, `#121416`));
      }
      if (
        (e.guard &&
          (E(l, 17, 9, 6, 4, `#121416`),
          E(l, 18, 10, 4, 1, `#f08a1c`),
          E(l, 18, 11, 4, 1, `#1a1a1a`),
          E(l, 18, 12, 4, 1, `#f08a1c`)),
        n &&
          (E(l, 17, 0, 7, 10, `#121416`),
          E(l, 18, 1, 5, 8, `#e5322b`),
          E(l, 20, 2, 1, 4, `#ffffff`),
          E(l, 20, 7, 1, 1, `#ffffff`)),
        t || e.fresh)
      )
        for (let e = 0; e < l.data.length; e += 4)
          ((l.data[e] *= 0.55),
            (l.data[e + 1] *= 0.55),
            (l.data[e + 2] *= 0.55));
      return (
        (s = Ie(l)),
        this.counterCache.set(o, s),
        this.counterCache.size > 600 && this.counterCache.clear(),
        s
      );
    }
    bags(e) {
      let t = Math.max(1, Math.min(2, e));
      if (this.bagCache[t]) return this.bagCache[t];
      let n = le(30, 13),
        r = `#2a2216`,
        i = (e, t, i) => {
          (E(n, e, t, 1, 2, r),
            E(n, e + i - 1, t, 1, 2, r),
            E(n, e + 1, t, i - 2, 1, `#e8d29c`),
            E(n, e + 1, t + 1, i - 2, 1, `#c8ae78`),
            E(n, e + 1, t + 2, i - 2, 1, r));
        };
      for (let e = 0; e + 5 <= 30; e += 5) i(e, 10, 5);
      if (t > 1) for (let e = 1; e + 3 <= 11; e += 3) (i(0, e, 3), i(27, e, 3));
      return (this.bagCache[t] = Ie(n));
    }
    frame() {
      let e = performance.now();
      if (this.camAnim) {
        let t = Math.min(1, (e - this.camAnim.t0) / this.camAnim.dur),
          n = 1 - (1 - t) * (1 - t);
        ((this.ox = this.camAnim.x0 + (this.camAnim.x1 - this.camAnim.x0) * n),
          (this.oy = this.camAnim.y0 + (this.camAnim.y1 - this.camAnim.y0) * n),
          t >= 1 && (this.camAnim = null),
          this.clampCam(),
          (this.dirty = !0));
      }
      if (
        !this.G ||
        (this.ownDirty && this.refreshOwnership(),
        (this.fx = this.fx.filter((t) => e - t.t0 < t.dur)),
        !this.dirty &&
          !this.fx.length &&
          !this.animPos.size &&
          this.overlay.sel === void 0 &&
          !this.overlay.attack &&
          !this.overlay.air)
      )
        return;
      this.dirty = !1;
      let t = this.ctx,
        n = this.scale;
      (t.setTransform(1, 0, 0, 1, 0, 0),
        (t.imageSmoothingEnabled = !1),
        (t.fillStyle = `#1b3a5c`),
        t.fillRect(0, 0, this.canvas.width, this.canvas.height));
      let r = Math.round(this.ox),
        i = Math.round(this.oy);
      (t.setTransform(n, 0, 0, n, r, i), t.drawImage(this.comp, 0, 0));
      let a = 0.65 + 0.35 * Math.sin(e / 180);
      ((t.globalAlpha =
        this.overlay.attack || this.overlay.sel !== void 0
          ? 0.75 + 0.25 * a
          : 1),
        t.drawImage(this.over, 0, 0),
        (t.globalAlpha = 1));
      let s = this.G,
        c = s.sc.order.filter((e) => s.s.nations[e]?.active)[s.s.phase],
        l = this.supplyCache,
        u = this.ghosts.size
          ? [...s.s.units, ...this.ghosts.values()]
          : s.s.units;
      for (let e of u) {
        if (this.hidden.has(e.id)) continue;
        let n = this.dispPos.get(e.id),
          r = this.animPos.get(e.id) || o(this.m.g, n === void 0 ? e.hex : n),
          i = e.nat === s.s.player && !!this.isCmd && !this.isCmd(e),
          u =
            e.nat === s.s.player &&
            !i &&
            c === e.nat &&
            (e.attacked || e.fresh) &&
            e.mp <= 0,
          d = l[e.nat] ? l[e.nat][e.hex] === 0 && !e.depot : !1,
          f = this.counter(e, u, d, i),
          p = Math.round(r[0] - 12),
          m = Math.round(r[1] - 10);
        if (
          (t.drawImage(f, p, m),
          e.entrench > 0 &&
            !this.animPos.has(e.id) &&
            n === void 0 &&
            t.drawImage(this.bags(e.entrench), p - 3, m + 10),
          this.overlay.sel === e.hex && !this.animPos.has(e.id))
        ) {
          t.fillStyle = `rgba(255,230,80,${0.6 + 0.4 * a})`;
          let e = Math.round(r[0] - 13),
            n = Math.round(r[1] - 11);
          (t.fillRect(e, n, 26, 1),
            t.fillRect(e, n + 21, 26, 1),
            t.fillRect(e, n, 1, 22),
            t.fillRect(e + 25, n, 1, 22));
        }
      }
      for (let n of this.fx) {
        let r = (e - n.t0) / n.dur;
        if (n.k === `boom`) this.drawBoom(t, n.x, n.y, r, n.big);
        else if (n.k === `plane`) this.drawPlane(t, n, r);
        else if (n.k === `ring`) {
          ((t.fillStyle = n.color), (t.globalAlpha = 1 - r));
          let e = Math.round(4 + 14 * r);
          for (let r = 0; r < 24; r++) {
            let i = (r / 24) * Math.PI * 2;
            t.fillRect(
              Math.round(n.x + Math.cos(i) * e),
              Math.round(n.y + Math.sin(i) * e * 0.8),
              1,
              1,
            );
          }
          t.globalAlpha = 1;
        }
      }
      (t.setTransform(1, 0, 0, 1, 0, 0),
        this.showLabels && this.drawLabels(t, n, r, i));
      for (let a of this.fx)
        if (a.k === `text`) {
          let o = (e - a.t0) / a.dur,
            s = r + a.x * n,
            c = i + (a.y - 14 - o * 10) * n;
          ((t.globalAlpha = o > 0.7 ? (1 - o) / 0.3 : 1),
            (t.font = `600 ${Math.round(16 * this.dpr)}px Rubik, sans-serif`),
            (t.textAlign = `center`),
            (t.lineWidth = 4 * this.dpr),
            (t.strokeStyle = `#111`),
            t.strokeText(a.text, s, c),
            (t.fillStyle = a.color),
            t.fillText(a.text, s, c),
            (t.globalAlpha = 1));
        }
    }
    drawLabels(e, t, n, r) {
      let i = t / this.dpr,
        a = Math.round(Math.max(11, Math.min(15, 4.4 * i)) * this.dpr);
      ((e.textAlign = `center`), (e.textBaseline = `bottom`));
      for (let s of this.m.cities) {
        if ((s.vp < 3 && i < 1.7) || (s.vp < 2 && i < 2.4)) continue;
        let [c, l] = o(this.m.g, s.hex),
          u = n + c * t,
          d = r + (l - 10) * t - 1;
        if (
          u < -80 ||
          d < -20 ||
          u > this.canvas.width + 80 ||
          d > this.canvas.height + 20
        )
          continue;
        ((e.font = `${s.vp >= 3 ? 600 : 500} ${s.vp >= 3 ? a + Math.round(2 * this.dpr) : a}px Rubik, sans-serif`),
          (e.lineWidth = 3 * this.dpr),
          (e.strokeStyle = `rgba(15,18,22,0.9)`),
          e.strokeText(s.name, u, d));
        let f = this.m.nations[(this.dispOwner || this.G.s.owner)[s.hex]];
        ((e.fillStyle = s.cap
          ? `#ffe27a`
          : f === this.G.s.player
            ? `#ffffff`
            : `#e8e8e8`),
          e.fillText(s.name, u, d));
      }
      e.textBaseline = `alphabetic`;
    }
    drawBoom(e, t, n, r, i) {
      let a = (i ? 11 : 7) * Math.sin(Math.min(1, r * 1.4) * Math.PI * 0.5),
        o =
          r < 0.3
            ? [`#fff6c0`, `#ffd34d`, `#ff8a2a`]
            : r < 0.6
              ? [`#ffd34d`, `#ff7a2a`, `#c8452a`]
              : [`#8a8580`, `#6e6a66`, `#4d4a47`];
      for (let i = -a; i <= a; i++)
        for (let s = -a; s <= a; s++) {
          let c = Math.hypot(s, i * 1.15);
          if (c > a) continue;
          let l =
            Math.abs(
              Math.sin(
                (s * 12.9898 + i * 78.233 + Math.floor(r * 6)) * 43758.5453,
              ),
            ) % 1;
          (r > 0.55 && l < (r - 0.55) * 2.2) ||
            ((e.fillStyle = o[c < a * 0.4 ? 0 : c < a * 0.75 ? 1 : 2]),
            e.fillRect(Math.round(t + s), Math.round(n + i - r * 4), 1, 1));
        }
    }
    drawPlane(e, t, n) {
      let r = t.x0 + (t.x1 - t.x0) * n,
        i = t.y0 + (t.y1 - t.y0) * n,
        a = t.x1 > t.x0 ? 1 : -1;
      ((e.fillStyle = `rgba(0,0,0,0.25)`),
        e.fillRect(Math.round(r - 3), Math.round(i + 9), 7, 2),
        [
          `....k....`,
          `...kgk...`,
          `kkkkgkkkk`,
          `.kggggk..`,
          `...kgk...`,
          `..kkkkk..`,
        ].forEach((t, n) => {
          for (let o = 0; o < t.length; o++) {
            let s = t[a > 0 ? o : t.length - 1 - o];
            s !== `.` &&
              ((e.fillStyle = s === `k` ? `#1b1d20` : `#9aa3ad`),
              e.fillRect(Math.round(r - 4 + o), Math.round(i - 3 + n), 1, 1));
          }
        }));
    }
    boom(e, t = !1) {
      let [n, r] = o(this.m.g, e);
      this.fx.push({
        k: `boom`,
        x: n,
        y: r,
        t0: performance.now(),
        dur: t ? 700 : 520,
        big: t,
      });
    }
    text(e, t, n = `#ff5a4a`, r = 0) {
      let [i, a] = o(this.m.g, e);
      this.fx.push({
        k: `text`,
        x: i,
        y: a,
        t0: performance.now() + r,
        dur: 1100,
        text: t,
        color: n,
      });
    }
    ring(e, t) {
      let [n, r] = o(this.m.g, e);
      this.fx.push({
        k: `ring`,
        x: n,
        y: r,
        t0: performance.now(),
        dur: 600,
        color: t,
      });
    }
    plane(e, t = 650) {
      let [n, r] = o(this.m.g, e);
      this.fx.push({
        k: `plane`,
        x0: n - 70,
        y0: r - 40,
        x1: n + 10,
        y1: r + 4,
        t0: performance.now(),
        dur: t,
      });
    }
    animateMove(e, t, n) {
      return new Promise((r) => {
        if (t.length < 2 || n <= 0) {
          r();
          return;
        }
        let i = t.map((e) => o(this.m.g, e)),
          a = performance.now(),
          s = n * (i.length - 1),
          c = () => {
            let t = Math.min(1, (performance.now() - a) / s),
              n = t * (i.length - 1),
              o = Math.min(i.length - 2, Math.floor(n)),
              l = n - o;
            (this.animPos.set(e, [
              i[o][0] + (i[o + 1][0] - i[o][0]) * l,
              i[o][1] + (i[o + 1][1] - i[o][1]) * l,
            ]),
              (this.dirty = !0),
              t < 1 ? requestAnimationFrame(c) : (this.animPos.delete(e), r()));
          };
        c();
      });
    }
  },
  Re = [
    `января`,
    `февраля`,
    `марта`,
    `апреля`,
    `мая`,
    `июня`,
    `июля`,
    `августа`,
    `сентября`,
    `октября`,
    `ноября`,
    `декабря`,
  ];
function ze(e) {
  let t = new Date(Date.UTC(1939, 8, 1 + (e - 1) * 3));
  return `${t.getUTCDate()} ${Re[t.getUTCMonth()]} ${t.getUTCFullYear()}`;
}
var A = (e, t, n, r, i, a = 10, o = 1) => ({
    nat: e,
    type: t,
    name: n,
    lon: r,
    lat: i,
    str: a,
    org: o,
  }),
  Be = [
    {
      id: `GER`,
      name: `Германия`,
      adj: `германский`,
      color: `#7a7f86`,
      dark: `#3a3d42`,
      light: `#a9aeb5`,
      flag: [
        `KKKKKKKKKKKK`,
        `KKKKKKKKKKKK`,
        `KKKKKKKKKKKK`,
        `WWWWWWWWWWWW`,
        `WWWWWWWWWWWW`,
        `RRRRRRRRRRRR`,
        `RRRRRRRRRRRR`,
        `RRRRRRRRRRRR`,
      ],
      flagPal: { K: `#1d1d1d`, W: `#f2f2f2`, R: `#d22b2b` },
      orgMax: 100,
      atk: 1.05,
      def: 1.05,
      income: 30,
      air: () => 3,
      mpBonus: { arm: 1, mot: 1 },
      posture: `off`,
      recruitName: {
        inf: `{n}-я пехотная дивизия`,
        cav: `{n}-я кав. бригада`,
        mot: `{n}-я моторизованная дивизия`,
        arm: `{n}-я танковая дивизия`,
      },
    },
    {
      id: `POL`,
      name: `Польша`,
      adj: `польский`,
      color: `#c9505e`,
      dark: `#6e1f2a`,
      light: `#f08a96`,
      flag: [
        `WWWWWWWWWWWW`,
        `WWWWWWWWWWWW`,
        `WWWWWWWWWWWW`,
        `WWWWWWWWWWWW`,
        `RRRRRRRRRRRR`,
        `RRRRRRRRRRRR`,
        `RRRRRRRRRRRR`,
        `RRRRRRRRRRRR`,
      ],
      flagPal: { W: `#f4f4f4`, R: `#d4213d` },
      orgMax: 90,
      atk: 0.95,
      def: 1.05,
      income: 14,
      air: (e) => +(e <= 4),
      posture: `def`,
      recruitName: {
        inf: `{n}-я резервная дивизия`,
        cav: `{n}-я кав. бригада`,
        mot: `{n}-я мот. бригада`,
        arm: `{n}-й танковый батальон`,
      },
    },
    {
      id: `SOV`,
      name: `СССР`,
      adj: `советский`,
      color: `#9a3328`,
      dark: `#4a120c`,
      light: `#d0675a`,
      flag: [
        `RYRRRRRRRRRR`,
        `YRYRRRRRRRRR`,
        `RYYRRRRRRRRR`,
        `YRRYRRRRRRRR`,
        `RRRRRRRRRRRR`,
        `RRRRRRRRRRRR`,
        `RRRRRRRRRRRR`,
        `RRRRRRRRRRRR`,
      ],
      flagPal: { R: `#cc1f1f`, Y: `#f2d23c` },
      orgMax: 70,
      atk: 0.95,
      def: 0.95,
      income: 20,
      air: () => 2,
      posture: `off`,
      recruitName: {
        inf: `{n}-я стрелковая дивизия`,
        cav: `{n}-я кав. дивизия`,
        mot: `{n}-я мотострелковая дивизия`,
        arm: `{n}-я танковая бригада`,
      },
    },
    {
      id: `SVK`,
      name: `Словакия`,
      adj: `словацкий`,
      color: `#5677a6`,
      dark: `#24375a`,
      light: `#8eaad3`,
      flag: [
        `WWWWWWWWWWWW`,
        `WWWWWWWWWWWW`,
        `WWWWWWWWWWWW`,
        `BBBBBBBBBBBB`,
        `BBBBBBBBBBBB`,
        `RRRRRRRRRRRR`,
        `RRRRRRRRRRRR`,
        `RRRRRRRRRRRR`,
      ],
      flagPal: { W: `#f4f4f4`, B: `#1f4fa0`, R: `#d42a2a` },
      orgMax: 70,
      atk: 0.85,
      def: 0.9,
      income: 4,
      air: () => 0,
      posture: `off`,
      recruitName: {
        inf: `{n}-я словацкая дивизия`,
        cav: `{n}-й кав. полк`,
        mot: `{n}-я подвижная группа`,
        arm: `{n}-й танковый батальон`,
      },
    },
    {
      id: `LIT`,
      name: `Литва`,
      adj: `литовский`,
      color: `#8aa95a`,
      dark: `#3e5222`,
      light: `#bad48e`,
      flag: [
        `YYYYYYYYYYYY`,
        `YYYYYYYYYYYY`,
        `YYYYYYYYYYYY`,
        `GGGGGGGGGGGG`,
        `GGGGGGGGGGGG`,
        `RRRRRRRRRRRR`,
        `RRRRRRRRRRRR`,
        `RRRRRRRRRRRR`,
      ],
      flagPal: { Y: `#f0c419`, G: `#2a7a3c`, R: `#c0272d` },
      orgMax: 60,
      atk: 0.8,
      def: 0.9,
      income: 0,
      air: () => 0,
      posture: `none`,
      recruitName: { inf: ``, cav: ``, mot: ``, arm: `` },
    },
    {
      id: `LAT`,
      name: `Латвия`,
      adj: `латвийский`,
      color: `#a07090`,
      dark: `#4e2c44`,
      light: `#cda0bf`,
      flag: [
        `MMMMMMMMMMMM`,
        `MMMMMMMMMMMM`,
        `MMMMMMMMMMMM`,
        `WWWWWWWWWWWW`,
        `WWWWWWWWWWWW`,
        `MMMMMMMMMMMM`,
        `MMMMMMMMMMMM`,
        `MMMMMMMMMMMM`,
      ],
      flagPal: { M: `#8a2232`, W: `#f4f4f4` },
      orgMax: 60,
      atk: 0.8,
      def: 0.9,
      income: 0,
      air: () => 0,
      posture: `none`,
      recruitName: { inf: ``, cav: ``, mot: ``, arm: `` },
    },
    {
      id: `HUN`,
      name: `Венгрия`,
      adj: `венгерский`,
      color: `#c79a5e`,
      dark: `#5e4421`,
      light: `#e8c590`,
      flag: [
        `RRRRRRRRRRRR`,
        `RRRRRRRRRRRR`,
        `RRRRRRRRRRRR`,
        `WWWWWWWWWWWW`,
        `WWWWWWWWWWWW`,
        `GGGGGGGGGGGG`,
        `GGGGGGGGGGGG`,
        `GGGGGGGGGGGG`,
      ],
      flagPal: { R: `#c8312f`, W: `#f4f4f4`, G: `#3d7a3a` },
      orgMax: 60,
      atk: 0.8,
      def: 0.9,
      income: 0,
      air: () => 0,
      posture: `none`,
      recruitName: { inf: ``, cav: ``, mot: ``, arm: `` },
    },
    {
      id: `ROM`,
      name: `Румыния`,
      adj: `румынский`,
      color: `#d2bb55`,
      dark: `#6a5a1c`,
      light: `#eedc8c`,
      flag: [
        `BBBBYYYYRRRR`,
        `BBBBYYYYRRRR`,
        `BBBBYYYYRRRR`,
        `BBBBYYYYRRRR`,
        `BBBBYYYYRRRR`,
        `BBBBYYYYRRRR`,
        `BBBBYYYYRRRR`,
        `BBBBYYYYRRRR`,
      ],
      flagPal: { B: `#1f3f9a`, Y: `#f2cf2a`, R: `#cf2a2a` },
      orgMax: 60,
      atk: 0.8,
      def: 0.9,
      income: 0,
      air: () => 0,
      posture: `none`,
      recruitName: { inf: ``, cav: ``, mot: ``, arm: `` },
    },
    {
      id: `SWE`,
      name: `Швеция`,
      adj: `шведский`,
      color: `#5f8fc7`,
      dark: `#24426b`,
      light: `#9cc0ea`,
      flag: [
        `BBBYBBBBBBBB`,
        `BBBYBBBBBBBB`,
        `BBBYBBBBBBBB`,
        `YYYYYYYYYYYY`,
        `BBBYBBBBBBBB`,
        `BBBYBBBBBBBB`,
        `BBBYBBBBBBBB`,
        `BBBYBBBBBBBB`,
      ],
      flagPal: { B: `#2b5fa8`, Y: `#f2cf2a` },
      orgMax: 60,
      atk: 0.8,
      def: 0.9,
      income: 0,
      air: () => 0,
      posture: `none`,
      recruitName: { inf: ``, cav: ``, mot: ``, arm: `` },
    },
    {
      id: `DEN`,
      name: `Дания`,
      adj: `датский`,
      color: `#b86a6a`,
      dark: `#5a2a2a`,
      light: `#e0a0a0`,
      flag: [
        `RRRWRRRRRRRR`,
        `RRRWRRRRRRRR`,
        `RRRWRRRRRRRR`,
        `WWWWWWWWWWWW`,
        `RRRWRRRRRRRR`,
        `RRRWRRRRRRRR`,
        `RRRWRRRRRRRR`,
        `RRRWRRRRRRRR`,
      ],
      flagPal: { R: `#c8102e`, W: `#f4f4f4` },
      orgMax: 60,
      atk: 0.8,
      def: 0.9,
      income: 0,
      air: () => 0,
      posture: `none`,
      recruitName: { inf: ``, cav: ``, mot: ``, arm: `` },
    },
    {
      id: `EST`,
      name: `Эстония`,
      adj: `эстонский`,
      color: `#6aa0c0`,
      dark: `#2a4a5e`,
      light: `#a0c8e0`,
      flag: [
        `BBBBBBBBBBBB`,
        `BBBBBBBBBBBB`,
        `BBBBBBBBBBBB`,
        `KKKKKKKKKKKK`,
        `KKKKKKKKKKKK`,
        `WWWWWWWWWWWW`,
        `WWWWWWWWWWWW`,
        `WWWWWWWWWWWW`,
      ],
      flagPal: { B: `#2f7fd0`, K: `#111111`, W: `#f4f4f4` },
      orgMax: 60,
      atk: 0.8,
      def: 0.9,
      income: 0,
      air: () => 0,
      posture: `none`,
      recruitName: { inf: ``, cav: ``, mot: ``, arm: `` },
    },
    {
      id: `YUG`,
      name: `Югославия`,
      adj: `югославский`,
      color: `#8f90c8`,
      dark: `#3a3a66`,
      light: `#c0c0ea`,
      flag: [
        `BBBBBBBBBBBB`,
        `BBBBBBBBBBBB`,
        `BBBBBBBBBBBB`,
        `WWWWWWWWWWWW`,
        `WWWWWWWWWWWW`,
        `RRRRRRRRRRRR`,
        `RRRRRRRRRRRR`,
        `RRRRRRRRRRRR`,
      ],
      flagPal: { B: `#1f3f9a`, W: `#f4f4f4`, R: `#cf2a2a` },
      orgMax: 60,
      atk: 0.8,
      def: 0.9,
      income: 0,
      air: () => 0,
      posture: `none`,
      recruitName: { inf: ``, cav: ``, mot: ``, arm: `` },
    },
  ],
  Ve = [
    A(`GER`, `arm`, `XIX танковый корпус (Гудериан)`, 17.3, 53.62),
    A(`GER`, `inf`, `II армейский корпус`, 17.35, 53.98),
    A(`GER`, `inf`, `III армейский корпус`, 16.85, 53.3),
    A(`GER`, `inf`, `Бригада «Эберхардт»`, 18.62, 54.3, 5),
    A(`GER`, `inf`, `XXI армейский корпус`, 19.1, 53.72),
    A(`GER`, `inf`, `I армейский корпус`, 20.4, 53.45),
    A(`GER`, `arm`, `Танковая дивизия «Кемпф»`, 20.85, 53.45, 7),
    A(`GER`, `inf`, `Корпус «Водриг»`, 21.5, 53.62),
    A(`GER`, `inf`, `Бригада «Лётцен»`, 22.3, 53.95, 6),
    A(`GER`, `inf`, `X армейский корпус`, 17.55, 51.3),
    A(`GER`, `inf`, `XIII армейский корпус`, 17.45, 51.55),
    A(`GER`, `arm`, `XVI танковый корпус (Гёпнер)`, 18.35, 50.95),
    A(`GER`, `inf`, `XI армейский корпус`, 18.2, 51.15),
    A(`GER`, `inf`, `IV армейский корпус`, 18.45, 50.7),
    A(`GER`, `mot`, `XIV моторизованный корпус`, 18, 50.65),
    A(`GER`, `mot`, `XV моторизованный корпус`, 18.1, 50.45),
    A(`GER`, `inf`, `VIII армейский корпус`, 18.7, 50.2),
    A(`GER`, `inf`, `XVII армейский корпус`, 18.55, 49.75),
    A(`GER`, `arm`, `XXII танковый корпус (Клейст)`, 19.25, 49.3),
    A(`GER`, `inf`, `XVIII горный корпус`, 20.3, 49.25),
    A(`GER`, `inf`, `Резерв ОКХ`, 14.2, 52.45, 8),
    A(`SVK`, `inf`, `Полевая армия «Бернолак»`, 20.9, 49.2, 7, 0.9),
    A(`SVK`, `mot`, `Подвижная группа «Калинчак»`, 21.6, 49.15, 5, 0.9),
    A(`POL`, `inf`, `ОГ «Черск»`, 17.7, 53.85, 7, 0.9),
    A(`POL`, `inf`, `9-я пехотная дивизия`, 18.05, 53.55, 8),
    A(`POL`, `inf`, `15-я пехотная дивизия`, 18.05, 53.15, 9),
    A(`POL`, `inf`, `16-я пехотная дивизия`, 18.8, 53.42, 9),
    A(`POL`, `inf`, `Береговая оборона`, 18.5, 54.5, 5),
    A(`POL`, `inf`, `20-я пехотная дивизия`, 20.38, 53.1, 9),
    A(`POL`, `inf`, `8-я пехотная дивизия`, 20.75, 52.8, 8, 0.85),
    A(`POL`, `cav`, `Мазовецкая кав. бригада`, 20.95, 53.05, 7),
    A(`POL`, `cav`, `Новогрудская кав. бригада`, 19.85, 53.25, 7),
    A(`POL`, `inf`, `18-я пехотная дивизия`, 22.05, 53.2, 8),
    A(`POL`, `cav`, `Подляская кав. бригада`, 22.4, 53.5, 6),
    A(`POL`, `cav`, `Сувалкская кав. бригада`, 22.95, 53.95, 6),
    A(`POL`, `inf`, `14-я и 25-я пехотные дивизии`, 17, 52.4, 9),
    A(`POL`, `inf`, `17-я и 26-я пехотные дивизии`, 17.6, 52.75, 9),
    A(`POL`, `cav`, `Великопольская кав. бригада`, 16.9, 51.95, 7),
    A(`POL`, `inf`, `10-я пехотная дивизия`, 18.6, 51.5, 8),
    A(`POL`, `inf`, `28-я пехотная дивизия`, 18.7, 51.25, 8),
    A(`POL`, `cav`, `Волынская кав. бригада`, 18.95, 50.95, 7),
    A(`POL`, `cav`, `Кресовая кав. бригада`, 18.2, 51.55, 6),
    A(`POL`, `inf`, `7-я пехотная дивизия`, 19.1, 50.8, 8),
    A(`POL`, `inf`, `ОГ «Силезия»`, 19.05, 50.3, 9),
    A(`POL`, `inf`, `21-я горная дивизия`, 19.15, 49.65, 7),
    A(`POL`, `cav`, `Краковская кав. бригада`, 19.5, 50.55, 6),
    A(`POL`, `mot`, `10-я мот. кав. бригада («Чёрная»)`, 20.05, 49.7, 6),
    A(`POL`, `inf`, `Армия «Карпаты»`, 21.8, 49.55, 6, 0.8),
    A(`POL`, `inf`, `Армия «Пруссы»: 13-я и 19-я ПД`, 19.7, 51.4, 9, 0.8),
    A(`POL`, `inf`, `Армия «Пруссы»: 3-я и 12-я ПД`, 20.8, 51.05, 9, 0.8),
    A(`POL`, `inf`, `Гарнизон Варшавы`, 21, 52.23, 9),
    A(`POL`, `mot`, `Варшавская бронемот. бригада`, 21.3, 52.05, 6, 0.8),
    A(`POL`, `inf`, `Резерв: Брест`, 23.7, 52.1, 5, 0.6),
    A(`POL`, `inf`, `Резерв: Львов`, 24.05, 49.85, 5, 0.6),
    A(`POL`, `inf`, `Резерв: Вильно`, 25.25, 54.65, 5, 0.6),
  ],
  He = [
    A(`SOV`, `inf`, `3-я армия`, 27.95, 55.1, 9),
    A(`SOV`, `inf`, `11-я армия`, 27.5, 54.25, 9),
    A(`SOV`, `cav`, `Конно-механизированная группа`, 27.3, 53.75, 9),
    A(`SOV`, `inf`, `10-я армия`, 27.3, 53.2, 9),
    A(`SOV`, `inf`, `4-я армия`, 27.7, 52.3, 9),
    A(`SOV`, `inf`, `5-я армия`, 27.4, 50.85, 9),
    A(`SOV`, `inf`, `6-я армия`, 26.8, 50.25, 9),
    A(`SOV`, `arm`, `25-й танковый корпус`, 26.5, 49.7, 9),
    A(`SOV`, `inf`, `12-я армия`, 26.45, 49.25, 9),
    A(`SOV`, `cav`, `2-й кавалерийский корпус`, 26.5, 48.85, 9),
  ];
function Ue(e, t) {
  return e.cities.findIndex((e) => e.name === t);
}
function We(e, t, n) {
  return t.nations[e.owner[n]];
}
function Ge(e, t) {
  let n = 0;
  for (let r of t.cities)
    r.nat === `POL` && We(e, t, r.hex) === `POL` && (n += r.vp);
  return n;
}
function Ke(e) {
  let t = 0;
  for (let n of e.cities) n.nat === `POL` && (t += n.vp);
  return t;
}
var qe = (e, t, n, r) => {
  let i = Ue(t, n);
  return i >= 0 && We(e, t, t.cities[i].hex) === r;
};
function Je(e, t) {
  return !qe(e, t, `Варшава`, `POL`) && Ge(e, t) <= 0.35 * Ke(t);
}
var Ye = {
  id: `pl39`,
  name: `Сентябрь 1939`,
  subtitle: `Польская кампания`,
  maxTurn: 12,
  date: ze,
  nations: Be,
  order: [`GER`, `SVK`, `POL`, `SOV`],
  active: [`GER`, `SVK`, `POL`],
  wars: [
    [`GER`, `POL`],
    [`SVK`, `POL`],
  ],
  alliances: [[`GER`, `SVK`]],
  units: Ve,
  forts: [
    { lon: 20.38, lat: 53.11, lvl: 1 },
    { lon: 20.72, lat: 52.43, lvl: 2 },
    { lon: 21.01, lat: 52.23, lvl: 2 },
    { lon: 18.53, lat: 54.52, lvl: 1 },
    { lon: 19.02, lat: 50.26, lvl: 1 },
    { lon: 19.12, lat: 49.61, lvl: 1 },
    { lon: 24.03, lat: 49.84, lvl: 1 },
  ],
  sides: [
    {
      id: `GER`,
      title: `Германия`,
      brief: `Сокрушить Польшу до вмешательства союзников. Окружайте армии танковыми клиньями и возьмите Варшаву.`,
      difficultyHint: `Наступление`,
    },
    {
      id: `POL`,
      title: `Польша`,
      brief: `Отразить удар с трёх сторон, сохранить армию и удержать Варшаву до 4 октября.`,
      difficultyHint: `Оборона, сложно`,
    },
  ],
  events: [
    {
      id: `start`,
      turn: 1,
      icon: `war`,
      views: {
        GER: {
          title: `1 сентября 1939 года`,
          text: `4:45. Линкор «Шлезвиг-Гольштейн» открыл огонь по Вестерплатте. Группы армий «Север» и «Юг» переходят границу. Цель — Варшава. Чем быстрее Польша капитулирует, тем больше звёзд.`,
          options: [{ label: `Вперёд!`, desc: `Начать кампанию`, effects: [] }],
        },
        POL: {
          title: `1 сентября 1939 года`,
          text: `Германия напала без объявления войны. Мобилизация не завершена, армия растянута вдоль огромной границы. Сохраните войска и удержите Варшаву — Британия и Франция обещали помощь.`,
          options: [
            { label: `К оружию!`, desc: `Начать кампанию`, effects: [] },
          ],
        },
      },
    },
    {
      id: `allies`,
      turn: 2,
      icon: `politics`,
      views: {
        GER: {
          title: `Британия и Франция объявили войну`,
          text: `3 сентября союзники Польши вступили в войну. На Западе остались слабые заслоны. Генштаб просит решения.`,
          options: [
            {
              label: `Все резервы — на Восток`,
              desc: `+2 пехотных корпуса прибудут в Бреслау и Шнайдемюль`,
              ai: 2,
              effects: [
                {
                  k: `spawn`,
                  units: [
                    A(`GER`, `inf`, `VII армейский корпус`, 17.04, 51.11, 9),
                    A(`GER`, `inf`, `Корпус «Брандт»`, 16.74, 53.15, 8),
                  ],
                },
              ],
            },
            {
              label: `Перебросить авиацию`,
              desc: `+1 авиаудар каждый ход до конца кампании`,
              ai: 1,
              effects: [{ k: `airBonus`, n: `GER`, v: 1 }],
            },
          ],
        },
        POL: {
          title: `Союзники вступили в войну`,
          text: `Британия и Франция объявили войну Германии! Страна ликует — но наступления на Западе пока нет.`,
          options: [
            {
              label: `Поднять боевой дух`,
              desc: `+20 организации всем польским войскам`,
              ai: 2,
              effects: [{ k: `org`, n: `POL`, v: 20 }],
            },
            {
              label: `Ускорить мобилизацию`,
              desc: `+60 ⚙ промышленности`,
              ai: 1,
              effects: [{ k: `pp`, n: `POL`, v: 60 }],
            },
          ],
        },
      },
    },
    {
      id: `bzura`,
      turn: 4,
      icon: `battle`,
      cond: (e, t) => qe(e, t, `Варшава`, `POL`),
      views: {
        GER: {
          title: `Тылы отстают`,
          text: `Танковые дивизии ушли далеко вперёд, пехота и снабжение не поспевают.`,
          options: [
            {
              label: `Не останавливаться`,
              desc: `+1 движение танкам и мотопехоте на 2 хода`,
              ai: 2,
              effects: [
                {
                  k: `mod`,
                  n: `GER`,
                  key: `mp`,
                  v: 1,
                  turns: 2,
                  types: [`arm`, `mot`],
                },
              ],
            },
            {
              label: `Подтянуть тылы`,
              desc: `+25 организации всем войскам`,
              ai: 1,
              effects: [{ k: `org`, n: `GER`, v: 25 }],
            },
          ],
        },
        POL: {
          title: `Контрудар на Бзуре`,
          text: `Генерал Кутшеба предлагает ударить во фланг немецким армиям, рвущимся к Варшаве.`,
          options: [
            {
              label: `Контрудар!`,
              desc: `+25% к атаке польских войск на 2 хода`,
              ai: 2,
              effects: [{ k: `mod`, n: `POL`, key: `atk`, v: 0.25, turns: 2 }],
            },
            {
              label: `Отходить к Висле`,
              desc: `+1 движение всем войскам на 2 хода`,
              ai: 1,
              effects: [{ k: `mod`, n: `POL`, key: `mp`, v: 1, turns: 2 }],
            },
          ],
        },
      },
    },
    {
      id: `soviet`,
      turn: 6,
      icon: `war`,
      cond: (e, t) => !Je(e, t),
      immediate: [
        { k: `activate`, n: `SOV` },
        { k: `war`, a: `SOV`, b: `POL` },
        { k: `spawn`, units: He },
      ],
      views: {
        GER: {
          title: `17 сентября: Красная армия перешла границу`,
          text: `Советский Союз вступил в войну с Польшей с востока. С советскими войсками нельзя воевать и нельзя входить на их территорию — торопитесь занять ключевые города.`,
          options: [{ label: `Понятно`, desc: ``, effects: [] }],
        },
        POL: {
          title: `17 сентября: удар в спину`,
          text: `Красная армия перешла восточную границу. Резервы на востоке оказались между двух огней.`,
          options: [
            {
              label: `Сражаться до конца`,
              desc: `+15% к обороне польских войск на 3 хода`,
              ai: 1,
              effects: [{ k: `mod`, n: `POL`, key: `def`, v: 0.15, turns: 3 }],
            },
            {
              label: `Помощь из Румынии`,
              desc: `+80 ⚙ на пополнения`,
              ai: 1,
              effects: [{ k: `pp`, n: `POL`, v: 80 }],
            },
          ],
        },
      },
    },
    {
      id: `warsaw_siege`,
      turn: 8,
      icon: `battle`,
      cond: (e, t) => qe(e, t, `Варшава`, `POL`),
      views: {
        GER: {
          title: `Осада Варшавы`,
          text: `Столица Польши всё ещё держится. Командование требует ускорить штурм.`,
          options: [
            {
              label: `Массированная бомбардировка`,
              desc: `+1 авиаудар каждый ход до конца кампании`,
              ai: 1,
              effects: [{ k: `airBonus`, n: `GER`, v: 1 }],
            },
            {
              label: `Подвезти тяжёлую артиллерию`,
              desc: `+20% к атаке на 2 хода`,
              ai: 2,
              effects: [{ k: `mod`, n: `GER`, key: `atk`, v: 0.2, turns: 2 }],
            },
          ],
        },
        POL: {
          title: `Варшава сражается`,
          text: `Президент города Стефан Стажинский по радио призывает жителей строить баррикады.`,
          options: [
            {
              label: `Баррикады`,
              desc: `+20% к обороне на 2 хода`,
              ai: 2,
              effects: [{ k: `mod`, n: `POL`, key: `def`, v: 0.2, turns: 2 }],
            },
            {
              label: `Добровольцы`,
              desc: `+1 пополнение всем дивизиям`,
              ai: 1,
              effects: [{ k: `str`, n: `POL`, v: 1 }],
            },
          ],
        },
      },
    },
  ],
  check(e, t, n) {
    let r = e.turn;
    if (Je(e, t)) {
      let t = r <= 8 ? 3 : r <= 10 ? 2 : 1;
      return e.player === `GER`
        ? {
            winner: `GER`,
            win: !0,
            stars: t,
            title: `Польша капитулировала`,
            text: `Кампания завершена на ходу ${r} (${ze(r)}). ${t === 3 ? `Быстрее, чем в реальной истории!` : `Задача выполнена.`}`,
          }
        : {
            winner: `GER`,
            win: !1,
            stars: 0,
            title: `Польша пала`,
            text: `Варшава взята, армия разбита (${ze(r)}). Попробуйте сохранить войска, отходя за реки, и держать столицу.`,
          };
    }
    if (n === `turnEnd` && r >= this.maxTurn) {
      let n = qe(e, t, `Варшава`, `POL`);
      if (e.player === `GER`)
        return n
          ? {
              winner: `POL`,
              win: !1,
              stars: 0,
              title: `Блицкриг провалился`,
              text: `Варшава устояла. Союзники получили время, чтобы ударить на Западе.`,
            }
          : {
              winner: `GER`,
              win: !0,
              stars: 1,
              title: `Варшава взята`,
              text: `Столица пала, но польские войска ещё сражаются. Победа, но без блеска.`,
            };
      if (n) {
        let n = +!!qe(e, t, `Львов`, `POL`),
          r = +(
            (e.nations.GER?.lostUnits || 0) + (e.nations.SVK?.lostUnits || 0) >=
            6
          );
        return {
          winner: `POL`,
          win: !0,
          stars: 1 + n + r,
          title: `Польша выстояла!`,
          text: `Варшава держится до октября — история пошла иначе. Союзники успели развернуть наступление.`,
        };
      }
      return {
        winner: `GER`,
        win: !1,
        stars: 0,
        title: `Варшава пала`,
        text: `Армия ещё сражается, но столица потеряна.`,
      };
    }
    return null;
  },
  objectives(e, t) {
    let n = Ge(e, t),
      r = Ke(t),
      i = Math.round(100 * (1 - n / r));
    if (e.player === `GER`)
      return [
        { text: `Взять Варшаву`, done: !qe(e, t, `Варшава`, `POL`) },
        {
          text: `Захватить ≥65% городов Польши`,
          done: i >= 65,
          progress: `${i}%`,
        },
        {
          text: `★★★ — капитуляция до хода 8, ★★ — до 10, ★ — до 12`,
          done: null,
        },
      ];
    let a = (e.nations.GER?.lostUnits || 0) + (e.nations.SVK?.lostUnits || 0);
    return [
      {
        text: `Удержать Варшаву до конца хода 12`,
        done: qe(e, t, `Варшава`, `POL`) ? null : !1,
      },
      { text: `★ Удержать Львов`, done: qe(e, t, `Львов`, `POL`) ? null : !1 },
      {
        text: `★ Уничтожить 6 вражеских соединений`,
        done: a >= 6,
        progress: `${a}/6`,
      },
    ];
  },
  aiTargetFilter(e, t, n, r) {
    if (n !== `SOV`) return !0;
    let i = t.cities[Ue(t, `Люблин`)].x - 10;
    return o(t.g, r)[0] > i;
  },
};
function Xe(e) {
  let t = (e.rng = (e.rng + 1831565813) | 0);
  return (
    (t = Math.imul(t ^ (t >>> 15), t | 1)),
    (t ^= t + Math.imul(t ^ (t >>> 7), t | 61)),
    ((t ^ (t >>> 14)) >>> 0) / 4294967296
  );
}
var Ze = (e, t) => {
    let n = Math.floor(t);
    return n + +(Xe(e) < t - n);
  },
  Qe = (e, t) => (e < t ? e + `-` + t : t + `-` + e),
  j = (e, t, n) => t !== n && e.s.wars.includes(Qe(t, n));
function M(e, t, n) {
  return t === n || e.s.allies.some((e) => e.includes(t) && e.includes(n));
}
var N = (e, t) => e.m.nations[e.s.owner[t]] || ``,
  $e = (e, t) => e.m.nations.indexOf(t);
function et(e, t, n) {
  if (!y(e.m, n)) return !1;
  let r = N(e, n);
  return !!r && (M(e, t, r) || j(e, t, r));
}
var tt = (e, t) => e.s.units.find((e) => e.id === t);
function nt(e) {
  let t = new Int32Array(e.m.N).fill(-1);
  return (e.s.units.forEach((e, n) => (t[e.hex] = n)), t);
}
var rt = (e, t) => e.s.units.find((e) => e.hex === t),
  it = (e, t) => e.nd[t].orgMax;
function at(e, t, n, r) {
  let i = 0;
  for (let a of e.s.nations[t]?.mods || [])
    a.key === n &&
      a.until >= e.s.turn &&
      (!a.types || !r || a.types.includes(r)) &&
      (i += a.v);
  return i;
}
function ot(e, t) {
  return t === e.s.player || M(e, t, e.s.player)
    ? 1
    : ([0.88, 1, 1.12][e.s.difficulty] ?? 1);
}
function P(e, t) {
  if (t.nat !== e.s.player) return !1;
  let n = e.s.career;
  return !n || n.cmd.includes(t.army || ``);
}
function st(e, t) {
  return P(e, t)
    ? !0
    : !!e.s.career &&
        t.nat === e.s.player &&
        !!e.sc.career?.front?.includes(t.army || ``);
}
var ct = (e) => e.sc.weather?.(e.s.turn) ?? `clear`;
function lt(e, t) {
  let n = w[ct(e)].mp[t.type] || 0;
  return Math.max(
    1,
    ee[t.type].mp +
      (e.nd[t.nat].mpBonus?.[t.type] || 0) +
      at(e, t.nat, `mp`, t.type) +
      n,
  );
}
var ut = (e) => dt(e)[e.s.phase];
function dt(e) {
  return e.sc.order.filter((t) => e.s.nations[t]?.active);
}
function ft(e, t) {
  let n = new Uint8Array(e.m.N);
  for (let r of e.s.units)
    if (j(e, t, r.nat)) for (let t of e.m.nbr[r.hex]) n[t]++;
  return n;
}
function pt(e, t, n = t.mp) {
  let r = new Map(),
    i = nt(e),
    a = ft(e, t.nat);
  if ((r.set(t.hex, { c: 0, p: -1, stop: !1 }), n <= 0)) return r;
  let o = [t.hex];
  for (; o.length;) {
    let s = 0;
    for (let e = 1; e < o.length; e++) r.get(o[e]).c < r.get(o[s]).c && (s = e);
    let c = o.splice(s, 1)[0],
      l = r.get(c);
    if (!(l.stop && c !== t.hex))
      for (let s of e.m.nbr[c]) {
        if (!et(e, t.nat, s)) continue;
        let u = i[s];
        if (u >= 0 && !M(e, e.s.units[u].nat, t.nat)) continue;
        let d = l.c + C[e.m.terrain[s]].cost[t.type] + +!!b(e.m, c, s);
        if (d > n) continue;
        let f = r.get(s);
        (f && f.c <= d) ||
          (r.set(s, { c: d, p: c, stop: a[s] > 0 }), o.push(s));
      }
  }
  return r;
}
function mt(e, t) {
  let n = [],
    r = t;
  for (; r >= 0;) (n.unshift(r), (r = e.get(r).p));
  return n;
}
function ht(e, t, n) {
  let r = rt(e, n);
  return !r || r.id === t.id;
}
var gt = new WeakMap();
function _t(e) {
  let t = 2166136261 ^ e.s.wars.length ^ (e.s.allies.length << 8);
  for (let n of e.s.units)
    ((t = Math.imul(t ^ n.id, 16777619)), (t = Math.imul(t ^ n.hex, 16777619)));
  let n = e.s.owner;
  for (let e = 0; e < n.length; e++) t = Math.imul(t ^ n[e], 16777619);
  return t;
}
function F(e, t) {
  let n = gt.get(e.s);
  n || ((n = new Map()), gt.set(e.s, n));
  let r = _t(e),
    i = n.get(t);
  if (i && i.sig === r) return i.map;
  let a = vt(e, t);
  return (e.sc.supplyHook?.(e, t, a), n.set(t, { sig: r, map: a }), a);
}
function vt(e, t) {
  let { m: n } = e,
    r = n.N,
    i = new Uint8Array(r),
    a = new Uint8Array(r),
    o = new Uint8Array(r);
  for (let n = 0; n < r; n++) {
    let r = N(e, n);
    r && M(e, t, r) && (i[n] = 1);
  }
  for (let r of e.s.units)
    if (M(e, t, r.nat)) a[r.hex] = 1;
    else if (j(e, t, r.nat)) for (let e of n.nbr[r.hex]) o[e] = 1;
  let s = (e) => !i[e] || (o[e] && !a[e]),
    c = n.cities.map((e) => i[e.hex] === 1),
    l = n.cities.map(
      (n, r) =>
        c[r] &&
        ((n.cap && N(e, n.hex) === n.nat && M(e, t, n.nat)) ||
          n.port ||
          (!!n.src && M(e, t, n.src))),
    );
  l.some(Boolean) || (l = n.cities.map((e, t) => c[t] && e.hub));
  let u = new Uint8Array(r),
    d = [];
  for (
    n.cities.forEach((e, t) => {
      l[t] && ((u[e.hex] = 1), d.push(e.hex));
    });
    d.length;
  ) {
    let e = d.pop();
    for (let t of n.nbr[e]) !u[t] && i[t] && ((u[t] = 1), d.push(t));
  }
  let f = new Float32Array(r).fill(-1),
    p = [],
    m = new Uint8Array(r);
  for (
    n.cities.forEach((e, t) => {
      c[t] && (m[e.hex] = 1);
    }),
      n.cities.forEach((t, n) => {
        if (!c[n] || !(t.hub || l[n])) return;
        let r = l[n] || u[t.hex] ? 7 : (e.sc.islandR ?? 3);
        r > f[t.hex] && ((f[t.hex] = r), p.push(t.hex));
      });
    p.length;
  ) {
    let e = p.pop(),
      t = f[e];
    if (!s(e) || m[e])
      for (let r of n.nbr[e]) {
        if (s(r) && !a[r] && (!i[r] || o[r])) continue;
        let c = t - C[n.terrain[r]].sup - (b(n, e, r) ? ne : 0);
        c < 0 || c <= f[r] || ((f[r] = c), p.push(r));
      }
  }
  let h = new Uint8Array(r);
  for (let e = 0; e < r; e++) h[e] = +(f[e] >= 0);
  return h;
}
function yt(e, t, n) {
  let r = 0;
  for (let i of e.s.units)
    i.id !== t.id &&
      M(e, i.nat, t.nat) &&
      e.m.nbr[n.hex].includes(i.hex) &&
      r++;
  return Math.min(3, r);
}
function bt(e, t, n, r, i, a) {
  let o = [],
    s = e.nd[t.nat],
    c = e.nd[n.nat],
    l = e.m.terrain[n.hex],
    u =
      ee[t.type].atk *
      s.atk *
      (1 + at(e, t.nat, `atk`, t.type)) *
      (t.str / 10) *
      (0.4 + (0.6 * t.org) / s.orgMax);
  if (
    ((u *= 1 + 0.05 * ae(t.xp)),
    (u *= ot(e, t.nat)),
    t.type === `arm` &&
      C[l].armAtk < 1 &&
      ((u *= C[l].armAtk),
      o.push({
        l: `Танки: ${C[l].name.toLowerCase()}`,
        v: `−${Math.round((1 - C[l].armAtk) * 100)}%`,
        good: !1,
      })),
    t.type === `mot` && C[l].armAtk < 1)
  ) {
    let e = (1 + C[l].armAtk) / 2;
    u *= e;
  }
  t.type === `cav` &&
    n.type === `arm` &&
    ((u *= 0.8), o.push({ l: `Кавалерия против танков`, v: `−20%`, good: !1 }));
  let d = w[ct(e)];
  ((t.type === `arm` || t.type === `mot`) &&
    d.mech < 1 &&
    ((u *= d.mech),
    o.push({
      l: `${d.name}: техника вязнет`,
      v: `−${Math.round((1 - d.mech) * 100)}%`,
      good: !1,
    })),
    d.cold < 1 &&
      !s.winter &&
      ((u *= d.cold),
      o.push({
        l: `${d.name}: войска не готовы к зиме`,
        v: `−${Math.round((1 - d.cold) * 100)}%`,
        good: !1,
      })),
    t.guard && ((u *= 1.1), o.push({ l: `Гвардия`, v: `+10%`, good: !0 })));
  let f = yt(e, t, n);
  (f &&
    ((u *= 1 + 0.1 * f),
    o.push({ l: `Фланговая поддержка ×${f}`, v: `+${f * 10}%`, good: !0 })),
    i ||
      ((u *= 0.6),
      o.push({ l: `Атакующий без снабжения`, v: `−40%`, good: !1 })));
  let p = at(e, t.nat, `atk`, t.type);
  p && o.push({ l: `Боевой приказ`, v: `+${Math.round(p * 100)}%`, good: !0 });
  let m = e.s.career,
    h = m ? (m.rep.auth - 50) / 500 : 0,
    g = (e) => `${e > 0 ? `+` : `−`}${Math.round(Math.abs(e) * 100)}%`;
  if (
    m &&
    P(e, t) &&
    (Math.abs(h) >= 0.02 &&
      ((u *= 1 + h),
      o.push({ l: `Авторитет командующего`, v: g(h), good: h > 0 })),
    m.atkUntil >= e.s.turn)
  ) {
    let e = m.atkV ?? 0.2;
    ((u *= 1 + e),
      o.push({
        l: m.atkLbl || `Контрудар по приказу Ставки`,
        v: g(e),
        good: !0,
      }));
  }
  let _ =
    ee[n.type].def *
    c.def *
    (1 + at(e, n.nat, `def`, n.type)) *
    (n.str / 10) *
    (0.4 + (0.6 * n.org) / c.orgMax);
  ((_ *= 1 + 0.05 * ae(n.xp)),
    (_ *= ot(e, n.nat)),
    C[l].def !== 1 &&
      ((_ *= C[l].def),
      o.push({
        l: `Местность: ${C[l].name.toLowerCase()}`,
        v: `+${Math.round((C[l].def - 1) * 100)}% защ.`,
        good: !1,
      })),
    b(e.m, r, n.hex) &&
      ((_ *= te),
      o.push({
        l: `Атака через реку`,
        v: `+${Math.round((te - 1) * 100)}% защ.`,
        good: !1,
      })),
    n.guard &&
      ((_ *= 1.1),
      o.push({ l: `Гвардейская часть`, v: `+10% защ.`, good: !1 })),
    n.entrench &&
      ((_ *= 1 + 0.1 * n.entrench),
      o.push({
        l: `Окопы ур. ${n.entrench}`,
        v: `+${n.entrench * 10}% защ.`,
        good: !1,
      })));
  let v = e.s.forts[n.hex] || 0;
  (v &&
    ((_ *= 1 + 0.25 * v),
    o.push({ l: `Укрепления ур. ${v}`, v: `+${v * 25}% защ.`, good: !1 })),
    a ||
      ((_ *= 0.7),
      o.push({
        l: `Противник окружён (без снабжения)`,
        v: `−30% защ.`,
        good: !0,
      })),
    m &&
      P(e, n) &&
      Math.abs(h) >= 0.02 &&
      ((_ *= 1 + h),
      o.push({
        l: `Стойкость (авторитет командующего)`,
        v: g(h) + ` защ.`,
        good: h < 0,
      })));
  let y = Math.max(0.2, Math.min(5, u / Math.max(0.05, _))),
    x = 1 * y ** 0.7,
    S = 32 * y ** 0.8,
    ne = 1 * y ** -0.7,
    re = 22 * y ** -0.8,
    ie = xt(e, n, t.hex) >= 0,
    oe = `hold`;
  return (
    n.str - x <= 0.4
      ? (oe = `destroyed`)
      : n.org - S <= 0 && (oe = ie ? `retreat` : `destroyed`),
    {
      A: u,
      D: _,
      R: y,
      mods: o,
      aStr: ne,
      aOrg: re,
      dStr: x,
      dOrg: S,
      outcome: oe,
      canRetreat: ie,
    }
  );
}
function xt(e, t, n) {
  let r = ft(e, t.nat),
    i = nt(e),
    a = -1,
    o = -1e9;
  for (let s of e.m.nbr[t.hex]) {
    if (!et(e, t.nat, s) || i[s] >= 0) continue;
    let c = N(e, s),
      l = M(e, t.nat, c);
    if (!l && r[s]) continue;
    let u =
      (l ? 5 : 0) -
      r[s] * 2 +
      f(e.m.g, s, n) * 1.5 +
      (e.m.cityAt[s] >= 0 ? 0.5 : 0);
    (e.m.terrain[s] >= 3 && e.m.terrain[s] <= 5 && (u += 0.3),
      u > o && ((o = u), (a = s)));
  }
  return a;
}
function St(e, t, n, r, i, a = !1) {
  let o = e.s.career;
  (o &&
    (P(e, t)
      ? (o.stats.lost++, o.lostNames.push(t.name))
      : a && o.stats.kills++),
    (e.s.units = e.s.units.filter((e) => e.id !== t.id)),
    e.s.nations[t.nat].lostUnits++,
    r && e.s.nations[r].killedUnits++,
    i.push({
      t: `destroyed`,
      id: t.id,
      hex: t.hex,
      nat: t.nat,
      name: t.name,
      reason: n,
      u: { ...t },
    }),
    e.s.log.push(
      `${e.sc.date(e.s.turn)}: ${t.name} (${e.nd[t.nat].name}) — ${n}`,
    ));
}
function Ct(e, t, n, r, i = !1) {
  let a = N(e, n);
  if (a === t || M(e, t, a) || !j(e, t, a)) return;
  e.s.owner[n] = $e(e, t);
  let o = e.m.cityAt[n],
    s = o >= 0 ? e.m.cities[o].name : void 0,
    c = e.s.career;
  (c &&
    s &&
    (t === e.s.player ? (c.capBy[s] = i ? `cmd` : `nb`) : delete c.capBy[s]),
    r.push({ t: `capture`, hex: n, nat: t, city: s }),
    s &&
      e.s.log.push(
        `${e.sc.date(e.s.turn)}: ${e.nd[t].name} заняла город ${s}`,
      ));
}
function wt(e, t) {
  return t.nat === ut(e) && !t.fresh && !e.s.result;
}
function Tt(e, t, n) {
  let r = [];
  if (!wt(e, t) || n === t.hex) return r;
  let i = pt(e, t),
    a = i.get(n);
  if (!a || !ht(e, t, n)) return r;
  let o = mt(i, n);
  ((t.mp = a.stop ? 0 : Math.max(0, t.mp - a.c)),
    (t.moved = !0),
    (t.entrench = 0),
    r.push({ t: `move`, id: t.id, path: o }),
    (t.hex = n));
  let s = st(e, t);
  for (let n of o.slice(1)) Ct(e, t.nat, n, r, s);
  return (Yt(e, `action`, r), r);
}
function Et(e, t, n) {
  let r = new Map();
  if (!wt(e, t) || t.attacked || t.org < it(e, t.nat) * 0.1) return r;
  let i = e.s.units.filter((n) => j(e, t.nat, n.nat));
  for (let n of i) e.m.nbr[t.hex].includes(n.hex) && r.set(n.hex, t.hex);
  if (t.mp > 0) {
    n = n || pt(e, t);
    for (let a of i) {
      if (r.has(a.hex)) continue;
      let i = -1,
        o = 1e9;
      for (let r of e.m.nbr[a.hex]) {
        let s = n.get(r);
        if (!s || !ht(e, t, r)) continue;
        let c = s.c + (b(e.m, r, a.hex) ? 2 : 0) - C[e.m.terrain[r]].def;
        c < o && ((o = c), (i = r));
      }
      i >= 0 && r.set(a.hex, i);
    }
  }
  return r;
}
function Dt(e, t, n, r) {
  let i = rt(e, n);
  if (!i) return null;
  let a = t.hex;
  t.hex = r;
  let o = bt(
    e,
    t,
    i,
    r,
    F(e, t.nat)[r] === 1 || !!t.depot,
    F(e, i.nat)[i.hex] === 1 || !!i.depot,
  );
  return ((t.hex = a), o);
}
function Ot(e, t, n, r = t.hex, i = !1) {
  let a = [],
    o = rt(e, n);
  if (
    !o ||
    !wt(e, t) ||
    t.attacked ||
    !j(e, t.nat, o.nat) ||
    (r !== t.hex && (a.push(...Tt(e, t, r)), t.hex !== r)) ||
    !e.m.nbr[t.hex].includes(o.hex)
  )
    return a;
  let s = F(e, t.nat)[t.hex] === 1 || !!t.depot,
    c = F(e, o.nat)[o.hex] === 1 || !!o.depot,
    l = bt(e, t, o, t.hex, s, c),
    u = () => 0.75 + 0.5 * Xe(e.s),
    d = Math.min(o.str, Ze(e.s, l.dStr * u())),
    f = Math.round(l.dOrg * (0.8 + 0.4 * Xe(e.s))),
    p = Math.min(t.str, Ze(e.s, l.aStr * u())),
    m = Math.round(l.aOrg * (0.8 + 0.4 * Xe(e.s)));
  ((t.str -= p),
    (t.org = Math.max(0, t.org - m)),
    (o.str -= d),
    (o.org = Math.max(0, o.org - f)),
    (t.attacked = !0),
    (t.moved = !0),
    (t.entrench = 0),
    (t.xp += 1),
    (o.xp += 1));
  let h = o.hex,
    g = {
      t: `combat`,
      att: t.id,
      def: o.id,
      from: t.hex,
      to: h,
      aStr: p,
      aOrg: m,
      dStr: d,
      dOrg: f,
      outcome: `hold`,
    };
  a.push(g);
  let _ = !1,
    v = P(e, t),
    y = P(e, o);
  if (o.str <= 0)
    ((g.outcome = `destroyed`),
      (_ = !0),
      (t.xp += 2),
      St(e, o, `уничтожена в бою`, t.nat, a, v));
  else if (o.org <= 0) {
    let n = xt(e, o, t.hex);
    n < 0
      ? ((g.outcome = `destroyed`),
        (_ = !0),
        (t.xp += 2),
        St(e, o, `окружена и сдалась в плен`, t.nat, a, v))
      : ((g.outcome = `retreat`),
        (g.retreatTo = n),
        (_ = !0),
        (o.hex = n),
        (o.entrench = 0),
        --o.str,
        Ct(e, o.nat, n, a, st(e, o)),
        o.str <= 0 && St(e, o, `рассеяна при отступлении`, t.nat, a, v));
  }
  if (
    (e.s.career && v && g.outcome !== `hold` && e.s.career.stats.wins++,
    t.str <= 0)
  )
    return (St(e, t, `погибла в атаке`, o.nat, a, y), Yt(e, `action`, a), a);
  if (_ && !i && et(e, t.nat, h)) {
    let n = [t.hex, h];
    ((t.hex = h),
      (g.advance = !0),
      a.push({ t: `move`, id: t.id, path: n }),
      Ct(e, t.nat, h, a, st(e, t)),
      ee[t.type].blitz
        ? ((t.mp = Math.max(0, t.mp - 1)), ft(e, t.nat)[t.hex] && (t.mp = 0))
        : (t.mp = 0));
  } else t.mp = 0;
  return (Yt(e, `action`, a), a);
}
function kt(e, t, n = !1) {
  return n && e.s.career ? e.s.career.air : e.s.nations[t].air;
}
function At(e, t, n, r = !1) {
  let i = [],
    a = rt(e, n),
    o = e.s.nations[t],
    s = r ? e.s.career : void 0;
  if (
    !a ||
    kt(e, t, r) <= 0 ||
    !j(e, t, a.nat) ||
    a.airHits >= 2 ||
    ut(e) !== t ||
    e.s.result
  )
    return i;
  (s ? s.air-- : o.air--, a.airHits++);
  let c = e.m.terrain[a.hex],
    l = c === 3 || c === 5 || c === 7 ? 0.35 : 0.6,
    u = +(Xe(e.s) < l),
    d = Math.round(15 + 10 * Xe(e.s));
  return (
    (a.str -= u),
    (a.org = Math.max(0, a.org - d)),
    i.push({ t: `air`, nat: t, hex: n, id: a.id, dStr: u, dOrg: d }),
    a.str <= 0 && St(e, a, `уничтожена авиацией`, t, i, !!s),
    i
  );
}
function jt(e, t, n) {
  let r = e.m.cityAt[n];
  if (r < 0) return !1;
  let i = e.m.cities[r];
  return i.nat !== t ||
    N(e, n) !== t ||
    !(i.hub || i.vp >= 2) ||
    rt(e, n) ||
    ft(e, t)[n]
    ? !1
    : F(e, t)[n] === 1;
}
function Mt(e, t, n) {
  return Math.round(ee[n].cost * (1 + 0.1 * (e.s.nations[t].recruited || 0)));
}
function Nt(e, t, n, r) {
  let i = e.s.nations[t],
    a = Mt(e, t, n);
  if (ut(e) !== t || i.pp < a || !jt(e, t, r)) return [];
  ((i.pp -= a), (i.recruited = (i.recruited || 0) + 1));
  let o =
      (e.nd[t].recruitBase ?? 30) + i.recruited * 3 + Math.floor(Xe(e.s) * 3),
    s = Lt(
      e,
      {
        nat: t,
        type: n,
        name: e.nd[t].recruitName[n].replace(`{n}`, String(o)),
        lon: 0,
        lat: 0,
        str: n === `arm` || n === `mot` ? 6 : 7,
        org: 0.5,
      },
      r,
    );
  return ((s.fresh = !0), (s.mp = 0), [{ t: `recruit`, id: s.id }]);
}
function Pt(e, t) {
  return e.s.career && P(e, t) ? e.s.career.sup : e.s.nations[t.nat].pp;
}
function Ft(e, t) {
  return (
    wt(e, t) &&
    !t.moved &&
    !t.attacked &&
    !t.reinforced &&
    t.str < 10 &&
    Pt(e, t) >= 8 &&
    F(e, t.nat)[t.hex] === 1
  );
}
function It(e, t) {
  if (!Ft(e, t)) return [];
  let n = e.s.nations[t.nat],
    r = Math.min(2, 10 - t.str, Math.floor(Pt(e, t) / 8));
  return (
    e.s.career && P(e, t) ? (e.s.career.sup -= r * 8) : (n.pp -= r * 8),
    (t.str += r),
    (t.reinforced = !0),
    (t.mp = 0),
    (t.attacked = !0),
    (t.xp = Math.max(0, t.xp - r)),
    [{ t: `reinforce`, id: t.id, add: r }]
  );
}
function Lt(e, t, n) {
  let r = {
    id: e.s.nextId++,
    nat: t.nat,
    type: t.type,
    name: t.name,
    hex: n,
    str: t.str ?? 10,
    org: Math.round(it(e, t.nat) * (t.org ?? 1)),
    xp: t.xp ?? 0,
    mp: 0,
    attacked: !1,
    moved: !1,
    entrench: 0,
    oos: 0,
    fresh: !1,
    airHits: 0,
    reinforced: !1,
  };
  return (
    t.army && (r.army = t.army),
    t.guard && (r.guard = !0),
    (r.mp = lt(e, r)),
    e.s.units.push(r),
    r
  );
}
function Rt(e, t) {
  let n = t.at
      ? t.at[0] >= 0 &&
        t.at[0] < e.m.g.cols &&
        t.at[1] >= 0 &&
        t.at[1] < e.m.g.rows
        ? t.at[1] * e.m.g.cols + t.at[0]
        : -1
      : x(e.m, t.lon, t.lat),
    r = (n) =>
      n >= 0 &&
      y(e.m, n) &&
      !rt(e, n) &&
      (N(e, n) === t.nat || M(e, N(e, n), t.nat));
  if (!r(n)) {
    let t = n,
      i = -1,
      a = 1e9;
    for (let n = 0; n < e.m.N; n++) {
      if (!r(n)) continue;
      let o = t >= 0 ? f(e.m.g, t, n) : 0;
      o < a && ((a = o), (i = n));
    }
    if (i < 0 || a > 4) return null;
    n = i;
  }
  return Lt(e, t, n);
}
function zt(e, t, n, r) {
  let i = (n) =>
      n >= 0 &&
      y(e.m, n) &&
      !rt(e, n) &&
      (N(e, n) === t.nat || M(e, N(e, n), t.nat)),
    a = i(n) ? n : -1,
    o = 1e9;
  if (a < 0)
    for (let t = 0; t < e.m.N; t++) {
      if (!i(t)) continue;
      let r = f(e.m.g, n, t);
      r < o && ((o = r), (a = t));
    }
  if (a < 0 || (a !== n && o > 3)) return null;
  let s = Lt(e, t, a);
  return (r.push({ t: `spawn`, id: s.id }), s);
}
function Bt(e) {
  let t = [];
  return (Yt(e, `action`, t), t);
}
function Vt(e, t, n, r, i = Date.now() % 1e9) {
  let a = {};
  for (let e of t.nations) a[e.id] = e;
  let o = {
    v: 1,
    scen: t.id,
    seed: i,
    rng: i | 0,
    turn: 1,
    phase: 0,
    player: n,
    difficulty: r,
    owner: Array.from(e.initOwner),
    units: [],
    nextId: 1,
    nations: {},
    wars: t.wars.map(([e, t]) => Qe(e, t)),
    allies: t.alliances.map((e) => [...e]),
    fired: [],
    pending: [],
    forts: {},
    result: null,
    log: [],
  };
  for (let e of t.nations)
    o.nations[e.id] = {
      id: e.id,
      pp: 0,
      air: 0,
      airBonus: 0,
      active: t.active.includes(e.id),
      mods: [],
      lostUnits: 0,
      killedUnits: 0,
      recruited: 0,
    };
  let s = { s: o, m: e, sc: t, nd: a };
  for (let n of t.forts) {
    let t = n.at ? n.at[1] * e.g.cols + n.at[0] : x(e, n.lon, n.lat);
    t >= 0 && (o.forts[t] = n.lvl);
  }
  for (let e of t.units) Rt(s, e);
  return (t.init?.(o, e), Wt(s, []), qt(s, []), s);
}
function Ht(e, t, n) {
  if (e.career) {
    let t = e.career;
    (t.capBy || (t.capBy = {}), t.post || (t.post = {}), t.f || (t.f = {}));
  }
  let r = {};
  for (let e of n.nations) r[e.id] = e;
  return { s: e, m: t, sc: n, nd: r };
}
function Ut(e, t, n) {
  let r = e.s;
  switch (t.k) {
    case `pp`:
      r.nations[t.n].pp += t.v;
      break;
    case `org`:
      for (let n of r.units)
        n.nat === t.n &&
          (n.org = Math.max(0, Math.min(it(e, n.nat), n.org + t.v)));
      break;
    case `str`:
      for (let e of r.units)
        e.nat === t.n && (e.str = Math.min(10, e.str + t.v));
      break;
    case `mod`:
      if (
        (r.nations[t.n].mods.push({
          key: t.key,
          v: t.v,
          until: r.turn + t.turns - 1,
          types: t.types,
        }),
        t.key === `mp`)
      )
        for (let e of r.units)
          e.nat === t.n &&
            (!t.types || t.types.includes(e.type)) &&
            (e.mp += t.v);
      break;
    case `spawn`:
      for (let r of t.units) {
        let t = Rt(e, r);
        t &&
          (n.push({ t: `spawn`, id: t.id }),
          t.nat !== ut(e) && (t.mp = lt(e, t)));
      }
      break;
    case `war`:
      r.wars.includes(Qe(t.a, t.b)) || r.wars.push(Qe(t.a, t.b));
      break;
    case `activate`:
      r.nations[t.n].active = !0;
      break;
    case `airBonus`:
      r.nations[t.n].airBonus += t.v;
      break;
    case `posture`:
      r.nations[t.n].post = t.v;
      break;
    case `armyPost`:
      r.career && (r.career.post[t.army] = t.v);
      break;
    case `join`:
      r.career && !r.career.cmd.includes(t.army) && r.career.cmd.push(t.army);
      break;
    case `guard`: {
      let n = r.units.find((e) => e.name === t.name);
      n &&
        ((n.name = t.to),
        (n.guard = !0),
        (n.xp = Math.max(n.xp + 3, 7)),
        (n.org = Math.min(it(e, n.nat), n.org + 10)));
      break;
    }
  }
}
function Wt(e, t) {
  for (let n of e.sc.events)
    if (
      !(n.turn !== e.s.turn || e.s.fired.includes(n.id)) &&
      (!n.cond || n.cond(e.s, e.m))
    ) {
      e.s.fired.push(n.id);
      for (let r of n.immediate || []) Ut(e, r, t);
      for (let r of Object.keys(n.views))
        if (e.s.nations[r]?.active || r === e.s.player) {
          if (r === e.s.player && !e.s.career)
            (e.s.pending.push({ id: n.id, nat: r }),
              t.push({ t: `event`, id: n.id, nat: r }));
          else {
            let i = n.views[r],
              a = 0;
            i.options.forEach((e, t) => {
              (e.ai || 0) > (i.options[a].ai || 0) && (a = t);
            });
            let o = i.options[a];
            for (let n of o?.effects || []) Ut(e, n, t);
            if (e.s.career && r === e.s.player) {
              let t =
                i.options.length > 1 && o
                  ? ` Решение Ставки: «${o.label}»${o.desc ? ` (${o.desc})` : ``}.`
                  : ``;
              e.s.career.news.push({
                kind: `news`,
                title: i.title,
                text: i.text + t,
              });
            }
          }
        }
    }
}
function Gt(e, t, n) {
  let r = [],
    i = e.s.pending.findIndex((n) => n.id === t && n.nat === e.s.player);
  if (i < 0) return r;
  e.s.pending.splice(i, 1);
  let a = e.sc.events.find((e) => e.id === t)?.views[e.s.player]?.options[n];
  for (let t of a?.effects || []) Ut(e, t, r);
  return r;
}
function Kt(e, t) {
  let n = 0;
  for (let r of e.m.cities) N(e, r.hex) === t && (n += r.vp);
  let r = e.nd[t].income + Math.round(n * 0.4);
  return Math.round(
    r *
      (t === e.s.player || M(e, t, e.s.player)
        ? 1
        : [0.85, 1, 1.25][e.s.difficulty]),
  );
}
function qt(e, t) {
  let n = ut(e);
  if (!n) return;
  let r = e.s.nations[n],
    i = F(e, n),
    a = it(e, n),
    o = e.s.career,
    s = w[ct(e)],
    c = s.cold < 1 && !e.nd[n].winter;
  for (let r of [...e.s.units]) {
    if (r.nat !== n) continue;
    let s = !i[r.hex] && !!o && P(e, r) && o.sup >= 2;
    if (
      (s ? ((o.sup -= 2), (r.depot = !0)) : r.depot && delete r.depot,
      i[r.hex] || s)
    ) {
      r.oos = 0;
      let t = o && P(e, r) ? Math.round((o.rep.auth - 50) / 10) : 0,
        n = s ? 8 : r.moved || r.attacked ? 12 : 22;
      r.org = Math.min(a, Math.max(0, r.org + (c ? Math.round(n / 2) : n) + t));
    } else if (
      (r.oos++,
      (r.org = Math.max(0, r.org - 12)),
      r.oos >= 3 && (--r.str, r.str <= 0))
    ) {
      St(e, r, `погибла в окружении без снабжения`, null, t);
      continue;
    }
    ((r.entrench =
      !r.moved && !r.attacked && e.s.turn > 1
        ? Math.min(2, r.entrench + 1)
        : r.entrench),
      (r.mp = lt(e, r)),
      (r.attacked = !1),
      (r.moved = !1),
      (r.fresh = !1),
      (r.airHits = 0),
      (r.reinforced = !1));
  }
  for (let t of e.s.units) t.nat !== n && (t.airHits = 0);
  ((r.pp += Kt(e, n)),
    (r.air = Math.max(
      0,
      Math.round((e.nd[n].air(e.s.turn) + r.airBonus) * s.air),
    )),
    (r.mods = r.mods.filter((t) => t.until >= e.s.turn)),
    t.push({ t: `phase`, nat: n }));
}
function Jt(e, t) {
  let { m: n } = e,
    r = new Uint8Array(n.N),
    i = new Map();
  for (let t of e.s.units) i.set(t.hex, t.nat);
  for (let a = 0; a < n.N; a++) {
    if (r[a] || !y(n, a)) continue;
    let o = N(e, a),
      s = [],
      c = [a];
    for (r[a] = 1; c.length;) {
      let t = c.pop();
      s.push(t);
      for (let i of n.nbr[t])
        !r[i] && y(n, i) && N(e, i) === o && ((r[i] = 1), c.push(i));
    }
    if (
      !o ||
      s.length > 25 ||
      !e.s.wars.some((e) => e.split(`-`).includes(o)) ||
      s.some((t) => {
        let n = i.get(t);
        return n !== void 0 && M(e, n, o);
      }) ||
      s.some((e) => {
        let t = n.cityAt[e];
        return t >= 0 && n.cities[t].hub;
      })
    )
      continue;
    let l = new Map(),
      u = !1,
      d = new Set(s);
    for (let t of s)
      for (let r of n.nbr[t]) {
        if (d.has(r) || !y(n, r)) continue;
        let t = N(e, r);
        j(e, o, t) ? l.set(t, (l.get(t) || 0) + 1) : M(e, o, t) && (u = !0);
      }
    if (u || !l.size) continue;
    let f = ``,
      p = -1;
    for (let [e, t] of l) t > p && ((p = t), (f = e));
    let m = !1;
    if (e.s.career && f === e.s.player) {
      for (let t of e.s.units)
        if (st(e, t) && n.nbr[t.hex].some((e) => d.has(e))) {
          m = !0;
          break;
        }
    }
    for (let n of s) Ct(e, f, n, t, m);
  }
}
function Yt(e, t, n) {
  if (e.s.result) return;
  let r = e.sc.check(e.s, e.m, t);
  r && ((e.s.result = r), n.push({ t: `result` }));
}
function Xt(e) {
  let t = [];
  if (e.s.result || (Jt(e, t), Yt(e, `action`, t), e.s.result)) return t;
  let n = dt(e);
  if ((n[e.s.phase], e.s.phase++, e.s.phase >= n.length)) {
    if ((e.sc.onTurnEnd?.(e), Yt(e, `turnEnd`, t), e.s.result)) return t;
    (e.s.turn++,
      (e.s.phase = 0),
      t.push({ t: `turn`, turn: e.s.turn }),
      Wt(e, t));
  } else {
    let t = dt(e);
    e.s.phase =
      t.indexOf(n[e.s.phase]) >= 0
        ? t.indexOf(n[e.s.phase])
        : Math.min(e.s.phase, t.length - 1);
  }
  return (qt(e, t), t);
}
function Zt(e, t) {
  let n = e.m.cityAt[t];
  return n >= 0 ? e.m.cities[n].vp : 0;
}
function Qt(e, t) {
  return e.s.units.filter((n) => j(e, t, n.nat));
}
function $t(e, t) {
  return e.s.units.filter((e) => e.nat === t);
}
var en = [`trust`, `auth`, `fame`],
  tn = { trust: `Доверие Ставки`, auth: `Авторитет в войсках`, fame: `Слава` },
  nn = { trust: `Доверие`, auth: `Авторитет`, fame: `Слава` },
  rn = (e, t, n) => Math.max(t, Math.min(n, e)),
  an = (e) => 4 + Math.floor(e.rep.trust / 10),
  on = (e) => e.sc.career,
  I = (e, t) => on(e).directives.find((e) => e.id === t),
  sn = (e, t) => on(e).requests.find((e) => e.id === t);
function cn(e) {
  return {
    cmd: [e.army, ...(e.also || [])],
    rep: { ...e.start },
    sup: e.sup0,
    income: 0,
    air: 0,
    airNext: 0,
    dirs: [],
    req: null,
    reqUsed: {},
    news: [],
    tel: [],
    queue: [],
    hist: [],
    stats: { wins: 0, kills: 0, lost: 0 },
    snap: { wins: 0, kills: 0, lost: 0 },
    lostNames: [],
    atkUntil: 0,
    nbTurn: 0,
    tsTurn: 0,
    dismissed: !1,
    capBy: {},
    post: {},
    f: {},
  };
}
var ln = (e) => e.s.career?.gen?.name || on(e).general,
  un = (e) => e.s.career?.gen?.short || on(e).short,
  dn = (e) => e.s.career?.gen?.rank || on(e).rank,
  fn = (e, t) =>
    t
      .replace(/\{name\}/g, ln(e))
      .replace(/\{short\}/g, un(e))
      .replace(/\{rank\}/g, dn(e));
function pn(e, t, n) {
  let r = e.s.career,
    i = {};
  for (let e of en) {
    let n = t[e];
    if (!n) continue;
    let a = rn(r.rep[e] + n, 0, 100);
    a !== r.rep[e] && ((i[e] = a - r.rep[e]), (r.rep[e] = a));
  }
  return (
    Object.keys(i).length && r.hist.push({ turn: e.s.turn, text: n, d: i }),
    r.rep.trust <= 0 && (r.dismissed = !0),
    i
  );
}
var mn = (e) =>
    e
      ? en
          .filter((t) => e[t])
          .map((t) => `${nn[t]} ${e[t] > 0 ? `+` : `−`}${Math.abs(e[t])}`)
          .join(`, `)
      : ``,
  hn = (e) => e.s.units.filter((t) => P(e, t)),
  gn = (e, t) => on(e).armies[t.army || ``];
function _n(e, t) {
  return e.m.cities.find((e) => e.name === t)?.hex ?? -1;
}
function L(e, t) {
  let n = _n(e, t);
  return n >= 0 && N(e, n) === e.s.player;
}
function vn(e, t, n) {
  let r = [],
    i = t.map((t) => _n(e, t)).filter((e) => e >= 0);
  for (let t = 0; t < e.m.N; t++)
    e.m.terrain[t] >= 2 && i.some((r) => f(e.m.g, r, t) <= n) && r.push(t);
  return r;
}
var yn = (e, t) => {
    let n = new Set(t);
    return e.s.units.filter((t) => n.has(t.hex) && j(e, e.s.player, t.nat))
      .length;
  },
  bn = (e, t) =>
    t.kind === `take` &&
    !!t.own &&
    L(e, t.city) &&
    e.s.career.capBy[t.city] === `nb`;
function xn(e, t) {
  let n = I(e, t.id),
    r = e.s.career;
  if (n.kind === `hold`) {
    let t = L(e, n.city);
    return { text: t ? `${n.city} удерживается` : `${n.city} потерян`, ok: t };
  }
  if (n.kind === `reach`) {
    let t = new Set(n.zone(e)),
      r = hn(e).filter((e) => t.has(e.hex)).length;
    return { text: `в районе ${r} из ${n.need}`, ok: r >= n.need };
  }
  if (n.kind === `take`) {
    if (bn(e, n)) return { text: `${n.city} взяли соседи`, ok: !1 };
    let t = L(e, n.city);
    return { text: t ? `${n.city} взят` : `${n.city} у противника`, ok: t };
  }
  if (n.kind === `keep`) {
    let t = yn(e, n.zone(e));
    return {
      text: t
        ? `в районе противник: ${t} — выбейте его до конца хода`
        : `противника в районе нет`,
      ok: t === 0,
    };
  }
  if (n.kind === `kills`) {
    let e = r.stats.kills - (t.kb ?? 0);
    return {
      text: `разгромлено ${Math.min(e, n.need)} из ${n.need}`,
      ok: e >= n.need,
    };
  }
  let i = r.stats.wins - t.base;
  return {
    text: `победы ${Math.min(i, n.need)} из ${n.need}`,
    ok: i >= n.need,
  };
}
var Sn = (e) => e.kind === `hold` || e.kind === `keep`;
function R(e) {
  return e.s.career ? e.s.career.dirs.filter((e) => e.status === `active`) : [];
}
function Cn(e) {
  let t = new Set();
  for (let n of R(e)) {
    let r = I(e, n.id);
    if (r.zone) for (let n of r.zone(e)) t.add(n);
    else if (r.city) {
      let n = _n(e, r.city);
      n >= 0 && t.add(n);
    }
  }
  return t;
}
function wn(e, t, n, r) {
  let i = I(e, t.id);
  t.status = n ? `done` : `failed`;
  let a = pn(
      e,
      n ? i.reward : i.penalty,
      `${n ? `Выполнен` : `Провален`} приказ «${i.title}»`,
    ),
    o = !n && bn(e, i);
  if (
    (r.push({
      kind: n ? `done` : `fail`,
      title: `${n ? `Приказ выполнен` : `Приказ провален`}: ${i.title}`,
      text: n
        ? `${on(e).hq} благодарит войска.`
        : o
          ? `${i.city} освободили соседние армии — слава досталась не вам. ${on(e).hq} недовольна медлительностью.`
          : `${on(e).hq} недовольна: ${i.goal.toLowerCase()} — не выполнено.`,
      d: a,
    }),
    n &&
      i.bonusCity &&
      i.bonus &&
      L(e, i.bonusCity) &&
      (!i.bonusOwn || e.s.career.capBy[i.bonusCity] === `cmd`))
  ) {
    t.bonus = !0;
    let n = pn(e, i.bonus, i.bonusText || `Бонус`);
    r.push({
      kind: `gain`,
      title: i.bonusText || `Бонус`,
      text: `Газеты пишут о вашей армии.`,
      d: n,
    });
  }
}
function Tn(e, t, n, r) {
  let i = e.s.career,
    a = I(e, t);
  if (i.dirs.some((e) => e.id === t)) return;
  let o = {
    id: t,
    issued: e.s.turn,
    deadline: Math.min(e.sc.maxTurn, e.s.turn + a.turns - 1),
    status: `active`,
    base: i.stats.wins,
    kb: i.stats.kills,
  };
  i.dirs.push(o);
  let s = a.onIssue?.(e, r) || ``;
  n.push({
    kind: `order`,
    dir: t,
    title: `Приказ: ${a.title}`,
    text: fn(e, `${a.text}${s ? ` ` + s : ``}`),
  });
}
var En = (e, t) => !!e.s.career?.dirs.some((e) => e.id === t);
function Dn(e, t) {
  let n = e.s.career;
  return Math.round(
    rn(
      t.base(e) +
        (n.rep.trust - 50) * 0.6 +
        n.rep.fame * 0.15 +
        ([8, 0, -8][e.s.difficulty] ?? 0) +
        (n.perk?.chance || 0),
      5,
      95,
    ),
  );
}
function On(e, t) {
  let n = e.s.career;
  return t.max && (n.reqUsed[t.id] || 0) >= t.max ? !1 : !t.avail || t.avail(e);
}
function kn(e, t) {
  let n = e.s.career,
    r = sn(e, t);
  return !r || n.req || !On(e, r)
    ? !1
    : ((n.req = { id: t, chance: Dn(e, r), turn: e.s.turn }), !0);
}
function An(e) {
  e.s.career && (e.s.career.req = null);
}
function jn(e, t) {
  e.s.career;
  let n = sn(e, t);
  if (!n || !n.instant || !On(e, n)) return null;
  let r = [],
    i = [];
  return (Mn(e, n, Dn(e, n), r, i), { tel: r, ev: i });
}
function Mn(e, t, n, r, i) {
  let a = e.s.career,
    o = on(e);
  if (Xe(e.s) * 100 < n && On(e, t)) {
    a.reqUsed[t.id] = (a.reqUsed[t.id] || 0) + 1;
    let n = t.apply(e, i, r),
      o = t.cost
        ? pn(e, { trust: -t.cost }, `Запрос «${t.title}» одобрен`)
        : {};
    r.unshift({
      kind: `ok`,
      title: `Одобрено: ${t.title}`,
      text: fn(e, n),
      d: o,
    });
  } else
    (t.instant && (a.reqUsed[t.id] = (a.reqUsed[t.id] || 0) + 1),
      r.unshift({
        kind: `no`,
        title: `Отказано: ${t.title}`,
        text: `${o.hq}: ${Nn[Math.floor(Xe(e.s) * Nn.length)]}`,
      }));
}
var Nn = [
  `«Резервов нет. Обходитесь своими силами».`,
  `«Просьба отклонена. Выполняйте приказ».`,
  `«Сейчас не до вас: положение на других участках тяжелее».`,
  `«Отказано. Ставка ценит вашу инициативу, но не может помочь».`,
];
function Pn(e, t) {
  let n = e.s.career,
    r = n.stats.kills - n.snap.kills,
    i = n.stats.wins - n.snap.wins,
    a = n.stats.lost - n.snap.lost,
    o = n.lostNames.splice(0);
  if (((n.snap = { ...n.stats }), r > 0 || i > 0)) {
    let a = (e) => Math.min(e, 4) * 3 + Math.max(0, e - 4),
      o = (e) => Math.floor(e / 2),
      s = pn(
        e,
        {
          fame:
            a(n.stats.kills) -
            a(n.stats.kills - r) +
            o(n.stats.wins) -
            o(n.stats.wins - i),
          auth: r * 2 + +(i > 0),
        },
        r ? `Уничтожено вражеских соединений: ${r}` : `Успешные атаки: ${i}`,
      );
    Object.keys(s).length &&
      t.push({
        kind: `gain`,
        title: r
          ? `Разгромлено вражеских соединений: ${r}`
          : `Успешные атаки: ${i}`,
        text: `Слухи о победах ваших войск расходятся по стране.`,
        d: s,
      });
  }
  if (a > 0) {
    let n = pn(
      e,
      { auth: -6 * a, fame: -2 * a, trust: -1 * a },
      `Потеряно соединений: ${a}`,
    );
    t.push({
      kind: `loss`,
      title: `Потеряно соединений: ${a}`,
      text: o.length ? o.join(`, `) + `.` : `Тяжёлые потери.`,
      d: n,
    });
  }
}
function Fn(e) {
  let t = e.s.career;
  if (!t) return [];
  let n = [];
  Pn(e, n);
  for (let t of R(e)) {
    let r = I(e, t.id);
    r.kind === `hold`
      ? L(e, r.city) || wn(e, t, !1, n)
      : r.kind !== `keep` &&
        (xn(e, t).ok
          ? wn(e, t, !0, n)
          : (e.s.turn >= t.deadline || bn(e, r)) && wn(e, t, !1, n));
  }
  return (t.queue.push(...n), n);
}
function In(e) {
  let t = e.s.career;
  if (!t) return;
  let n = [];
  for (let t of R(e))
    Sn(I(e, t.id)) &&
      (xn(e, t).ok
        ? e.s.turn >= t.deadline && wn(e, t, !0, n)
        : wn(e, t, !1, n));
  t.queue.push(...n);
}
function Ln(e) {
  let t = e.s.career,
    n = on(e),
    r = [];
  if (t.tsTurn === e.s.turn) return r;
  t.tsTurn = e.s.turn;
  let i = [...t.news];
  ((t.news = []), Pn(e, i));
  let a = hn(e).filter((e) => e.depot).length;
  a &&
    i.push({
      kind: `info`,
      title: `Окружённые дивизии на запасах армии: ${a}`,
      text: `Израсходовано запасов: ${a * 2}. Пока запасы есть, окружённые дивизии сражаются в полную силу. Когда они кончатся, войска начнут слабеть — пробивайтесь к своим!`,
    });
  let o = hn(e).filter((e) => e.oos >= 2).length;
  if (o) {
    let t = pn(e, { auth: -2 * o }, `Войска без снабжения`);
    Object.keys(t).length &&
      i.push({
        kind: `loss`,
        title: `Войска голодают`,
        text: `Соединений без снабжения второй ход и дольше: ${o}.`,
        d: t,
      });
  }
  if (
    ((t.income = an(t)),
    (t.sup += t.income),
    (t.air = t.airNext + Rn(e)),
    (t.airNext = 0),
    zn(e, i),
    t.req)
  ) {
    let n = sn(e, t.req.id);
    (n && Mn(e, n, t.req.chance, i, r), (t.req = null));
  }
  for (let t of R(e)) {
    let n = I(e, t.id);
    n.kind === `hold` && !L(e, n.city)
      ? wn(e, t, !1, i)
      : n.kind === `take` &&
        (bn(e, n) ? wn(e, t, !1, i) : xn(e, t).ok && wn(e, t, !0, i));
  }
  for (let a of n.directives) {
    if (
      a.at === void 0 ||
      a.at > e.s.turn ||
      e.s.turn > (a.last ?? e.sc.maxTurn) ||
      En(e, a.id) ||
      (a.cond && !a.cond(e))
    )
      continue;
    let n = (n) => {
      ((t.skip = (t.skip || 0) + 1),
        t.dirs.push({
          id: a.id,
          issued: e.s.turn,
          deadline: e.s.turn,
          status: `cancelled`,
          base: t.stats.wins,
        }),
        i.push({ kind: `info`, title: `Приказ отменён: ${a.title}`, text: n }));
    };
    if (a.kind === `take` && L(e, a.city)) {
      if (t.capBy[a.city] !== `cmd`) {
        n(
          `${a.city} уже освободили соседние армии — ${on(e).hq} отменяет приказ. Для трёх звёзд теперь нужно на один приказ меньше.`,
        );
        continue;
      }
      (Tn(e, a.id, i, r), i.pop(), wn(e, t.dirs[t.dirs.length - 1], !0, i));
      let o = i.find((e) => e.kind === `done` && e.title.endsWith(a.title));
      o &&
        (o.text = `${a.city} уже в наших руках — приказ выполнен досрочно. ${o.text}`);
    } else
      a.kind === `hold` && !L(e, a.city)
        ? n(`${a.city} уже оставлен — приказ удерживать его потерял смысл.`)
        : Tn(e, a.id, i, r);
  }
  return ((t.tel = [...t.queue, ...i]), (t.queue = []), r);
}
var Rn = (e) => {
  let t = e.s.career?.perk;
  return t?.air ? ie(t.air, ct(e)) : 0;
};
function zn(e, t) {
  let n = e.sc.weather;
  if (!n) return;
  let r = e.s.turn,
    i = n(r),
    a = r > 1 ? n(r - 1) : `clear`,
    o = r < e.sc.maxTurn ? n(r + 1) : i;
  if (i === a && o === i) return;
  let s = w[i],
    c = w[o],
    l = e.s.career.perk,
    u = [];
  if (
    (i !== a &&
      (u.push(
        i === `clear`
          ? `Распогодилось: дороги подсохли, авиация снова летает в полную силу.`
          : `${s.sky} Действует на обе стороны: ${re(i).join(`; `)}.`,
      ),
      l?.air &&
        i !== `clear` &&
        u.push(`Авиагруппа армии в этот ход: ✈ ${ie(l.air, i)} из ${l.air}.`)),
    o !== i)
  ) {
    let e = re(o);
    u.push(
      `Прогноз на ход ${r + 1}: ${c.name.toLowerCase()}${o === `clear` ? ` — лётная погода, дороги просохнут` : e.length ? ` (${e.join(`; `)})` : ``}.`,
    );
  }
  t.push({
    kind: `wx`,
    icon: i === a ? c.icon : s.icon,
    title:
      i === a
        ? `Прогноз погоды: ${c.name.toLowerCase()}`
        : `Погода: ${s.name.toLowerCase()}`,
    text: u.join(` `),
  });
}
function Bn(e, t) {
  let n = e.career,
    r = n.dirs.filter((e) => e.status === `done`).length,
    i = n.dirs.filter((e) => e.status === `failed`).length,
    a = e.units.filter(
      (t) => t.nat === e.player && n.cmd.includes(t.army || ``),
    ).length,
    o = 0,
    s = Vn(n, t);
  return (
    !n.dismissed &&
      a > 0 &&
      ((o = 1),
      r >= s.two && (o = 2),
      r >= s.three && n.rep.fame >= s.fame && (o = 3)),
    e.result && (o = Math.min(o, e.result.stars)),
    {
      done: r,
      failed: i,
      total: n.dirs.length,
      stars: o,
      award: Hn(t, n, o),
      promoted: o >= 2 && n.rep.trust >= 50,
      alive: a,
    }
  );
}
function Vn(e, t) {
  let n = t.stars || { two: 3, three: 4, fame: 40 };
  return {
    two: n.two,
    three: Math.max(n.two, n.three - (e?.skip || 0)),
    fame: n.fame,
  };
}
function Hn(e, t, n) {
  if (t.dismissed || n <= 0) return ``;
  let r = e.awards.findIndex((e) => t.rep.fame >= e.fame);
  return r < 0 ? `` : ((r = Math.max(r, 3 - n)), e.awards[r]?.name || ``);
}
function Un(e) {
  let t = hn(e);
  if (!t.length)
    return (
      e.m.cities.find((t) => N(e, t.hex) === e.s.player)?.hex ??
      e.m.cities[0].hex
    );
  let n = t[0].hex,
    r = 1e9;
  for (let i of t) {
    let a = 0;
    for (let n of t) a += f(e.m.g, i.hex, n.hex);
    a < r && ((r = a), (n = i.hex));
  }
  return n;
}
function Wn(e, t) {
  let n = F(e, e.s.player),
    r = -1,
    i = 1e9;
  for (let a of e.m.cities) {
    if (N(e, a.hex) !== e.s.player || !n[a.hex]) continue;
    let o = f(e.m.g, a.hex, t);
    o < i && ((i = o), (r = a.hex));
  }
  return r;
}
var Gn = {
    "ОГ «Черск»": `POM`,
    "9-я пехотная дивизия": `POM`,
    "15-я пехотная дивизия": `POM`,
    "16-я пехотная дивизия": `POM`,
    "Береговая оборона": `CST`,
    "20-я пехотная дивизия": `MOD`,
    "8-я пехотная дивизия": `MOD`,
    "Мазовецкая кав. бригада": `MOD`,
    "Новогрудская кав. бригада": `MOD`,
    "18-я пехотная дивизия": `NAR`,
    "Подляская кав. бригада": `NAR`,
    "Сувалкская кав. бригада": `NAR`,
    "14-я и 25-я пехотные дивизии": `POZ`,
    "17-я и 26-я пехотные дивизии": `POZ`,
    "Великопольская кав. бригада": `POZ`,
    "10-я пехотная дивизия": `LDZ`,
    "28-я пехотная дивизия": `LDZ`,
    "Волынская кав. бригада": `LDZ`,
    "Кресовая кав. бригада": `LDZ`,
    "7-я пехотная дивизия": `KRK`,
    "ОГ «Силезия»": `KRK`,
    "21-я горная дивизия": `KRK`,
    "Краковская кав. бригада": `KRK`,
    "10-я мот. кав. бригада («Чёрная»)": `KRK`,
    "Армия «Карпаты»": `KAR`,
    "Армия «Пруссы»: 13-я и 19-я ПД": `PRU`,
    "Армия «Пруссы»: 3-я и 12-я ПД": `PRU`,
    "Гарнизон Варшавы": `WAW`,
    "Варшавская бронемот. бригада": `WAW`,
  },
  Kn = {
    "14-я и 25-я пехотные дивизии": [
      {
        nat: `POL`,
        type: `inf`,
        name: `14-я пехотная дивизия`,
        lon: 17,
        lat: 52.4,
        str: 8,
        org: 1,
      },
      {
        nat: `POL`,
        type: `inf`,
        name: `25-я пехотная дивизия`,
        lon: 17.6,
        lat: 52,
        str: 8,
        org: 1,
      },
    ],
    "17-я и 26-я пехотные дивизии": [
      {
        nat: `POL`,
        type: `inf`,
        name: `17-я пехотная дивизия`,
        lon: 17.6,
        lat: 52.75,
        str: 8,
        org: 1,
      },
      {
        nat: `POL`,
        type: `inf`,
        name: `26-я пехотная дивизия`,
        lon: 18.2,
        lat: 52.7,
        str: 8,
        org: 1,
      },
    ],
  },
  qn = [
    ...Ye.units.flatMap((e) =>
      e.nat === `POL`
        ? Kn[e.name]
          ? Kn[e.name].map((e) => ({ ...e, army: `POZ` }))
          : [{ ...e, army: Gn[e.name] || `RES` }]
        : [e],
    ),
    {
      nat: `POL`,
      type: `cav`,
      name: `Подольская кав. бригада`,
      lon: 17.6,
      lat: 52.3,
      str: 7,
      org: 1,
      army: `POZ`,
    },
  ],
  Jn = [`33-я резервная ПД`, `41-я резервная ПД`, `44-я резервная ПД`],
  Yn = { 2: 15, 3: 45, 4: 75, 5: 85, 6: 60 },
  Xn = {
    general: `Тадеуш Кутшеба`,
    short: `Кутшеба`,
    rank: `генерал дивизии`,
    army: `POZ`,
    armyName: `Армия «Познань»`,
    hq: `Ставка`,
    role: `Командующий армией «Познань»`,
    armies: {
      POZ: { name: `Армия «Познань»`, general: `ген. Тадеуш Кутшеба` },
      POM: { name: `Армия «Поморье»`, general: `ген. Владислав Бортновский` },
      LDZ: { name: `Армия «Лодзь»`, general: `ген. Юлиуш Руммель` },
      KRK: { name: `Армия «Краков»`, general: `ген. Антоний Шиллинг` },
      MOD: {
        name: `Армия «Модлин»`,
        general: `ген. Эмиль Пшедзимирский-Крукович`,
      },
      NAR: { name: `ОГ «Нарев»`, general: `ген. Чеслав Млот-Фиалковский` },
      PRU: { name: `Армия «Пруссы»`, general: `ген. Стефан Домб-Бернацкий` },
      KAR: { name: `Армия «Карпаты»`, general: `ген. Казимеж Фабрицы` },
      WAW: { name: `Оборона Варшавы`, general: `ген. Валериан Чума` },
      CST: { name: `Береговая оборона`, general: `контр-адм. Юзеф Унруг` },
      RES: { name: `Резерв Ставки`, general: `Главный штаб` },
    },
    start: { trust: 50, auth: 50, fame: 10 },
    sup0: 16,
    intro: {
      title: `Армия «Познань»`,
      text: `1 сентября 1939 года. Вы — генерал дивизии Тадеуш Кутшеба, командующий армией «Познань». Ваши соединения стоят на западном выступе страны, а главные удары немцев идут севернее и южнее. Остальными армиями командуют соседи, ими управляет компьютер. Операция длится 8 ходов, до 22 сентября. Выполняйте приказы Ставки, просите помощи по телеграфу и берегите солдат: от доверия Ставки, авторитета в войсках и славы зависит ваша карьера.`,
    },
    brief: `1 сентября 1939 года. Вы — командующий армией «Познань» на западном выступе Польши. Соседними армиями управляет компьютер. Выполняйте приказы Ставки, просите помощи по телеграфу и берегите солдат — от этого зависит ваша карьера.`,
    standing: `Берегите войска: каждое потерянное соединение — Авторитет −6, Слава −2, Доверие −1. Уничтоженное вражеское — Авторитет +2 и Слава +3 (после четвёртого за операцию — +1). Каждые две успешные атаки — Слава +1.`,
    directives: [
      {
        id: `hold_poz`,
        at: 1,
        turns: 2,
        kind: `hold`,
        city: `Познань`,
        title: `Удержать Познань`,
        goal: `Удержать Познань`,
        text: `Армия «Познань» прикрывает западное направление. Город не должен пасть в первые дни войны.`,
        reward: { trust: 8, fame: 3 },
        penalty: { trust: -8, fame: -3 },
      },
      {
        id: `to_kutno`,
        at: 2,
        turns: 3,
        kind: `reach`,
        need: 3,
        title: `Отход к Кутно`,
        goal: `Собрать 3 соединения в районе Кутно`,
        zone: (e) => vn(e, [`Кутно`], 2),
        text: `Немцы обходят армию с севера и юга. Отходите на восток, к Кутно, на соединение с армией «Поморье». Можно просить у Ставки разрешения на контрудар.`,
        reward: { trust: 10, auth: 4 },
        penalty: { trust: -8, auth: -4 },
      },
      {
        id: `bzura`,
        turns: 3,
        kind: `wins`,
        need: 2,
        title: `Контрудар на Бзуре`,
        goal: `Одержать 2 победы в атаках за 3 хода`,
        text: `Ставка разрешила ваш план! Ударьте во фланг немецкой 8-й армии, которая рвётся к Варшаве: одержите 2 победы (противник отступил или разбит).`,
        reward: { trust: 8, fame: 15, auth: 5 },
        penalty: { trust: -6, fame: -4 },
        bonusCity: `Лодзь`,
        bonus: { fame: 8 },
        bonusText: `Лодзь в польских руках`,
        onIssue: (e) => {
          let t = e.s.career;
          ((t.atkUntil = e.s.turn + 1),
            t.cmd.includes(`POM`) || t.cmd.push(`POM`));
          let n = e.s.units.filter((e) => e.army === `POM`).length;
          return n
            ? `В ваше подчинение переходит армия «Поморье» (соединений: ${n}). Два хода ваши войска атакуют с бонусом +20%.`
            : `Два хода ваши войска атакуют с бонусом +20%.`;
        },
      },
      {
        id: `to_warsaw`,
        at: 6,
        turns: 3,
        kind: `reach`,
        need: 2,
        title: `Прорыв к Варшаве`,
        goal: `Вывести 2 соединения к Варшаве или Модлину`,
        cond: (e) => L(e, `Варшава`) || L(e, `Модлин`),
        zone: (e) => vn(e, [`Варшава`, `Модлин`], 1),
        text: `Враг стягивает к Бзуре танковые дивизии. Пробивайтесь к Варшаве и Модлину через Кампиносскую пущу: столице нужны ваши солдаты.`,
        reward: { trust: 8, auth: 8, fame: 6 },
        penalty: { trust: -6, auth: -6 },
      },
    ],
    requests: [
      {
        id: `bzura`,
        icon: `sword`,
        title: `Разрешение на контрудар`,
        cost: 0,
        desc: `Ударить во фланг немецкой 8-й армии. Если Ставка согласится, армия «Поморье» перейдёт под ваше командование.`,
        base: (e) => Yn[e.s.turn] ?? 0,
        avail: (e) => e.s.turn >= 2 && e.s.turn <= 5 && !En(e, `bzura`),
        why: (e) =>
          En(e, `bzura`)
            ? `Контрудар уже разрешён`
            : e.s.turn < 2
              ? `Станет доступно со 2-го хода`
              : `Момент упущен`,
        apply: (e, t, n) => (
          Tn(e, `bzura`, n, t),
          `Главнокомандующий одобрил ваш план удара на Бзуре.`
        ),
      },
      {
        id: `ammo`,
        icon: `crate`,
        title: `Боеприпасы и пополнение`,
        cost: 6,
        desc: `+15 запасов армии: на них пополняют потрёпанные дивизии.`,
        base: () => 70,
        apply: (e) => (
          (e.s.career.sup += 15),
          `Эшелон с боеприпасами и маршевыми ротами прибыл: +15 запасов.`
        ),
      },
      {
        id: `air`,
        icon: `plane`,
        title: `Авиаподдержка`,
        cost: 5,
        desc: `+2 авиаудара на следующий ход. Польская авиация тает с каждым днём.`,
        base: (e) => (e.s.turn <= 3 ? 60 : e.s.turn <= 5 ? 35 : 15),
        apply: (e) => (
          (e.s.career.air += 2),
          `Бригада бомбардировщиков выделена вашей армии: +2 авиаудара на этот ход.`
        ),
      },
      {
        id: `reinf`,
        icon: `shield`,
        title: `Подкрепление`,
        cost: 12,
        max: 2,
        desc: `Резервная пехотная дивизия (сила 6) прибудет в ближайший к армии свой город. Не более двух за операцию.`,
        base: () => 40,
        apply: (e, t) => {
          let n = e.s.career,
            r = n.reqUsed.reinf - 1,
            i = Wn(e, Un(e)),
            a =
              i >= 0
                ? zt(
                    e,
                    {
                      nat: `POL`,
                      type: `inf`,
                      name: Jn[r] || `Резервная ПД`,
                      lon: 0,
                      lat: 0,
                      str: 6,
                      org: 0.6,
                      army: n.cmd[0],
                    },
                    i,
                    t,
                  )
                : null;
          return a
            ? ((a.fresh = !0),
              (a.mp = 0),
              `${a.name} прибыла в район ${e.m.cities[e.m.cityAt[i]]?.name || `сосредоточения`} и вступит в бой со следующего хода.`)
            : `Ставка выделила дивизию, но ей не удалось пробиться к армии.`;
        },
      },
      {
        id: `retreat`,
        icon: `undo`,
        title: `Разрешение на отход`,
        cost: 6,
        desc: `Ставка снимет текущий приказ удерживать город — без штрафа к репутации.`,
        base: () => 45,
        avail: (e) => R(e).some((t) => I(e, t.id).kind === `hold`),
        why: () => `Нет приказа удерживать город`,
        apply: (e) => {
          let t = R(e).find((t) => I(e, t.id).kind === `hold`);
          return t
            ? ((t.status = `cancelled`),
              `Ставка разрешает отход. Приказ «${I(e, t.id).title}» отменён.`)
            : `Приказ уже не действует.`;
        },
      },
      {
        id: `delay`,
        icon: `next`,
        title: `Отсрочка приказа`,
        cost: 6,
        desc: `+1 ход к сроку текущего приказа.`,
        base: () => 50,
        avail: (e) => R(e).some((t) => I(e, t.id).kind !== `hold`),
        why: () => `Нет приказа со сроком`,
        apply: (e) => {
          let t = R(e)
            .filter((t) => I(e, t.id).kind !== `hold`)
            .sort((e, t) => e.deadline - t.deadline)[0];
          return t
            ? (t.deadline++,
              `Срок приказа «${I(e, t.id).title}» продлён до конца хода ${t.deadline}.`)
            : `Приказ уже не действует.`;
        },
      },
    ],
    history: `В реальности 9 сентября армии «Познань» и «Поморье» по плану Кутшебы ударили во фланг немецкой 8-й армии на Бзуре — это крупнейшее сражение кампании. После первых успехов немцы перебросили танковые дивизии и окружили обе армии; часть войск прорвалась через Кампиносскую пущу в Варшаву и Модлин. Кутшеба стал заместителем командующего обороной Варшавы и 28 сентября подписал капитуляцию города.`,
    awards: [
      { fame: 60, name: `Командорский крест ордена Virtuti Militari` },
      { fame: 40, name: `Рыцарский крест ордена Virtuti Militari` },
      { fame: 25, name: `Крест Храбрых` },
    ],
    promotion: `Произведён в генералы брони`,
  },
  Zn = (e, t, n) => {
    let r = t.cities.find((e) => e.name === n);
    return !!r && t.nations[e.owner[r.hex]] === `POL`;
  };
function Qn(e, t, n) {
  let r = Bn(e, Xn);
  if (n === `dismissed`)
    return {
      winner: null,
      win: !1,
      stars: 0,
      title: `Отстранён от командования`,
      text: `Ставка потеряла доверие к командующему армией «Познань». Армию принял другой генерал.`,
    };
  if (n === `destroyed`)
    return {
      winner: `GER`,
      win: !1,
      stars: 0,
      title: `Армия «Познань» разгромлена`,
      text: `Под вашим командованием не осталось ни одного соединения.`,
    };
  if (n === `fell`)
    return {
      winner: `GER`,
      win: r.stars > 0,
      stars: r.stars,
      title: `Польша пала`,
      text: `Варшава капитулировала раньше срока. Ваша армия сражалась до конца.`,
    };
  let i = Zn(e, t, `Варшава`);
  return {
    winner: null,
    win: r.stars > 0,
    stars: r.stars,
    title: i ? `Варшава держится` : `Варшава пала`,
    text: i
      ? `К 22 сентября столица ещё сражается — и в этом есть заслуга вашей армии.`
      : `К 22 сентября столица в руках врага, но война ещё не окончена.`,
  };
}
var $n = {
    ...Ye,
    id: `bzura39`,
    name: `Бзура 1939`,
    subtitle: `Карьера генерала · армия «Познань»`,
    units: qn,
    events: Ye.events.filter((e) => e.id !== `start` && e.id !== `bzura`),
    sides: [
      {
        id: `POL`,
        title: `Польша`,
        brief: Xn.intro.text,
        difficultyHint: `Карьера`,
      },
    ],
    career: Xn,
    init(e) {
      e.career = cn(Xn);
    },
    onTurnEnd: (e) => In(e),
    maxTurn: 8,
    check(e, t, n) {
      let r = e.career;
      return r
        ? r.dismissed
          ? Qn(e, t, `dismissed`)
          : e.units.some(
                (t) => t.nat === e.player && r.cmd.includes(t.army || ``),
              )
            ? Ye.check.call({ ...Ye, maxTurn: 99 }, e, t, n)
              ? Qn(e, t, `fell`)
              : n === `turnEnd` && e.turn >= 8
                ? Qn(e, t, `end`)
                : null
            : Qn(e, t, `destroyed`)
        : null;
    },
    objectives: () => [],
  },
  er = [
    `января`,
    `февраля`,
    `марта`,
    `апреля`,
    `мая`,
    `июня`,
    `июля`,
    `августа`,
    `сентября`,
    `октября`,
    `ноября`,
    `декабря`,
  ],
  tr = (e, t, n, r) => (i) => {
    let a = new Date(Date.UTC(e, t - 1, n + (i - 1) * r));
    return `${a.getUTCDate()} ${er[a.getUTCMonth()]} ${a.getUTCFullYear()}`;
  },
  nr = (e) => Ye.nations.find((t) => t.id === e),
  rr = (e) => ({
    id: e.id,
    name: e.name,
    adj: e.adj,
    color: e.color,
    dark: e.dark,
    light: e.light,
    flag: e.flag,
    flagPal: e.flagPal,
  }),
  ir = (e, t) => {
    let n = t[1941];
    for (let r of Object.keys(t).map(Number).sort()) e >= r && (n = t[r]);
    return n;
  };
function ar(e, t = {}) {
  return {
    ...rr(nr(`GER`)),
    orgMax: ir(e, { 1941: 95, 1942: 90, 1944: 85, 1945: 75 }),
    atk: ir(e, { 1941: 1.1, 1942: 1.05, 1943: 1.05, 1944: 0.95, 1945: 0.9 }),
    def: ir(e, { 1941: 1.05, 1943: 1.1, 1944: 1 }),
    income: ir(e, { 1941: 14, 1942: 10, 1944: 8, 1945: 6 }),
    air: () => ir(e, { 1941: 2, 1943: 2, 1944: 1, 1945: 1 }),
    mpBonus: e >= 1945 ? {} : { arm: 1, mot: 1 },
    posture: `off`,
    winter: !1,
    recruitBase: ir(e, { 1941: 250, 1943: 320, 1945: 540 }),
    recruitName: {
      inf: `{n}-я пехотная дивизия`,
      cav: `{n}-я кав. бригада`,
      mot: `{n}-я моторизованная дивизия`,
      arm: `{n}-я танковая дивизия`,
    },
    ...t,
  };
}
function or(e, t = {}) {
  return {
    ...rr(nr(`SOV`)),
    name: `СССР`,
    adj: `советский`,
    orgMax: ir(e, { 1941: 75, 1942: 80, 1943: 85, 1944: 90, 1945: 95 }),
    atk: ir(e, { 1941: 0.9, 1942: 0.95, 1943: 1, 1944: 1.1, 1945: 1.15 }),
    def: ir(e, { 1941: 1, 1943: 1.1, 1944: 1.05 }),
    income: ir(e, { 1941: 10, 1942: 12, 1943: 14, 1944: 16 }),
    air: () => ir(e, { 1941: 1, 1942: 2, 1944: 3 }),
    mpBonus: e >= 1943 ? { arm: 1, mot: 1 } : e >= 1942 ? { arm: 1 } : {},
    posture: `def`,
    winter: !0,
    recruitBase: ir(e, { 1941: 250, 1942: 300, 1943: 330, 1944: 350 }),
    recruitName: {
      inf: `{n}-я стрелковая дивизия`,
      cav: `{n}-я кав. дивизия`,
      mot: `{n}-я мотострелковая бригада`,
      arm: `{n}-я танковая бригада`,
    },
    ...t,
  };
}
function sr(e = {}) {
  return {
    ...rr(nr(`ROM`)),
    orgMax: 60,
    atk: 0.78,
    def: 0.85,
    income: 2,
    air: () => 0,
    posture: `def`,
    winter: !1,
    recruitName: {
      inf: `{n}-я румынская пехотная дивизия`,
      cav: `{n}-я румынская кав. дивизия`,
      mot: `{n}-я румынская мотодивизия`,
      arm: `{n}-я румынская танковая дивизия`,
    },
    ...e,
  };
}
var z =
    (e, t) =>
    (n, r, i, a, o = 10, s = {}) => ({
      nat: e,
      type: n,
      name: r,
      lon: 0,
      lat: 0,
      at: [i, a],
      str: o,
      ...(t ? { army: t } : {}),
      ...s,
    }),
  cr = (e, t) => (n) => vn(n, e, t),
  lr = (e, t, n) => (r) => {
    let i = _n(r, e),
      a = [];
    if (i < 0) return a;
    for (let e = 0; e < r.m.N; e++) {
      if (r.m.terrain[e] < 2) continue;
      let o = f(r.m.g, i, e);
      o >= t && o <= n && a.push(e);
    }
    return a;
  },
  ur = (e) => e.s.units.filter((t) => j(e, e.s.player, t.nat)),
  dr = (e, t, n, r, i) => {
    n.org = Math.max(0, n.org - r);
    let a = +(n.str > 1 && Xe(e.s) < i);
    ((n.str -= a),
      t.push({
        t: `air`,
        nat: e.s.player,
        hex: n.hex,
        id: n.id,
        dStr: a,
        dOrg: r,
      }));
  },
  fr = (e, t, n = 1) =>
    e.s.units.some((r) => P(e, r) && f(e.m.g, r.hex, t.hex) <= n);
function pr(e, t, n, r) {
  let i = e.s.career,
    a = Wn(e, Un(e)),
    o = a >= 0 ? a : Un(e),
    s = zt(
      e,
      { nat: e.s.player, lon: 0, lat: 0, army: r || i.cmd[0], ...n },
      o,
      t,
    );
  if (!s) return `${n.name} не смогла пробиться к армии.`;
  ((s.fresh = !0), (s.mp = 0));
  let c = e.m.cityAt[s.hex];
  return `${s.name} прибыла${c >= 0 ? ` в район ${e.m.cities[c].name}` : ``} и вступит в бой со следующего хода.`;
}
var B = {
  ammo: (e = 70, t = 15, n = 6) => ({
    id: `ammo`,
    icon: `crate`,
    title: `Боеприпасы и пополнение`,
    cost: n,
    desc: `+${t} запасов армии: на них пополняют потрёпанные дивизии.`,
    base: () => e,
    apply: (e) => (
      (e.s.career.sup += t),
      `Эшелоны с боеприпасами и маршевыми ротами прибыли: +${t} запасов.`
    ),
  }),
  air: (e, t = 2, n = 5) => ({
    id: `air`,
    icon: `plane`,
    title: `Авиаподдержка`,
    cost: n,
    desc: `+${t} авиаудара вашей армии на следующий ход. В нелётную погоду вылетов меньше.`,
    base: e,
    apply: (e) => {
      let n = w[ct(e)],
        r = Math.max(1, Math.round(t * n.air));
      return (
        (e.s.career.air += r),
        `Воздушная армия фронта выделила вам штурмовики: +${r} авиаудара на этот ход.${r < t ? ` Погода (${n.name.toLowerCase()}) сорвала часть вылетов: могло быть ${t}.` : ``}`
      );
    },
  }),
  reinf: (e, t = {}) => ({
    id: `reinf`,
    icon: `shield`,
    title: t.title || `Подкрепление`,
    cost: t.cost ?? 12,
    max: t.max ?? 2,
    desc:
      t.desc ||
      `Свежая дивизия (сила ${t.str ?? 7}) прибудет в ближайший к армии свой город. Не более ${t.max ?? 2} за операцию.`,
    base: () => t.base ?? 45,
    apply: (n, r) => {
      let i = (n.s.career.reqUsed.reinf || 1) - 1;
      return pr(n, r, {
        type: t.type || `inf`,
        name: e[i] || e[e.length - 1],
        str: t.str ?? 7,
        org: 0.7,
        xp: t.xp,
      });
    },
  }),
  retreat: (e = 45, t = 6) => ({
    id: `retreat`,
    icon: `undo`,
    title: `Разрешение на отход`,
    cost: t,
    desc: `Ставка снимет текущий приказ удерживать рубеж — без штрафа к репутации.`,
    base: () => e,
    avail: (e) => R(e).some((t) => [`hold`, `keep`].includes(I(e, t.id).kind)),
    why: () => `Нет приказа удерживать рубеж`,
    apply: (e) => {
      let t = R(e).find((t) => [`hold`, `keep`].includes(I(e, t.id).kind));
      return t
        ? ((t.status = `cancelled`),
          `Ставка разрешает отход. Приказ «${I(e, t.id).title}» отменён.`)
        : `Приказ уже не действует.`;
    },
  }),
  delay: (e = 50, t = 6) => ({
    id: `delay`,
    icon: `next`,
    title: `Отсрочка приказа`,
    cost: t,
    desc: `+1 ход к сроку ближайшего наступательного приказа.`,
    base: () => e,
    avail: (e) =>
      R(e).some(
        (t) =>
          ![`hold`, `keep`].includes(I(e, t.id).kind) &&
          t.deadline < e.sc.maxTurn,
      ),
    why: () => `Нет приказа, срок которого можно продлить`,
    apply: (e) => {
      let t = R(e)
        .filter(
          (t) =>
            ![`hold`, `keep`].includes(I(e, t.id).kind) &&
            t.deadline < e.sc.maxTurn,
        )
        .sort((e, t) => e.deadline - t.deadline)[0];
      return t
        ? (t.deadline++,
          `Срок приказа «${I(e, t.id).title}» продлён до конца хода ${t.deadline}.`)
        : `Приказ уже не действует.`;
    },
  }),
  arty: (e = {}) => ({
    id: `arty`,
    icon: `sword`,
    title: e.title || `Артиллерия резерва Ставки`,
    cost: e.cost ?? 6,
    max: e.max,
    desc:
      e.desc ||
      `Артиллерийская дивизия прорыва: атаки вашей армии сильнее на ${Math.round((e.v ?? 0.15) * 100)}% в следующем ходу.`,
    base: () => e.base ?? 55,
    apply: (t) => {
      let n = t.s.career;
      return (
        (n.atkUntil = t.s.turn),
        (n.atkV = e.v ?? 0.15),
        (n.atkLbl = e.label || `Артиллерия РГК`),
        `Артиллерия прибыла на ваш участок: атаки сильнее на ${Math.round((e.v ?? 0.15) * 100)}% в этот ход.`
      );
    },
  }),
  katyusha: (e = {}) => ({
    id: `katyusha`,
    icon: `fame`,
    title: e.title || `Залп «катюш»`,
    cost: e.cost ?? 5,
    max: e.max ?? 2,
    desc:
      e.desc ||
      `Гвардейские миномёты накроют врагов, стоящих рядом с вашими войсками: организация −15…25, иногда и сила.`,
    base: () => e.base ?? 50,
    avail: e.avail,
    why: e.why,
    apply: (t, n) => {
      let r = 0;
      for (let e of ur(t))
        fr(t, e) && (dr(t, n, e, 15 + Math.floor(Xe(t.s) * 11), 0.25), r++);
      return r
        ? `${e.who || `Дивизион гвардейских миномётов`} дал залп: накрыто вражеских соединений — ${r}.`
        : `Залп пришёлся по пустым позициям: врага рядом с вашими войсками не оказалось.`;
    },
  }),
  fortify: (e = {}) => ({
    id: `fortify`,
    icon: `shield`,
    title: `Инженерные батальоны`,
    cost: e.cost ?? 5,
    max: e.max ?? 2,
    desc: `Сапёры укрепят позиции, где стоят ваши дивизии: +1 уровень укреплений (до 2) — +25% к обороне.`,
    base: () => e.base ?? 60,
    avail: e.avail,
    why: e.why,
    apply: (e) => {
      let t = 0;
      for (let n of hn(e)) {
        let r = e.s.forts[n.hex] || 0;
        r < 2 && ((e.s.forts[n.hex] = r + 1), t++);
      }
      return `Инженерные батальоны вырыли противотанковые рвы и поставили минные поля: укреплено позиций — ${t}.`;
    },
  }),
  partisans: (e = {}) => ({
    id: `partisans`,
    icon: `tele`,
    title: e.title || `Удар партизан`,
    cost: e.cost ?? 4,
    max: e.max ?? 1,
    desc: `Партизаны взорвут мосты и пути в тылу врага: тыловые вражеские части теряют организацию (−15), часть — силу.`,
    base: () => e.base ?? 55,
    avail: e.avail,
    why: e.why,
    apply: (e, t) => {
      let n = 0;
      for (let r of ur(e))
        e.s.units.some(
          (t) => t.nat === e.s.player && f(e.m.g, t.hex, r.hex) <= 1,
        ) || (dr(e, t, r, 15, 0.3), n++);
      return `Партизаны подорвали эшелоны и мосты: пострадали тыловые части врага — ${n}.`;
    },
  }),
  tanks: (e, t = {}) => ({
    id: `tanks`,
    icon: `sword`,
    title: t.title || `Танковый резерв`,
    cost: t.cost ?? 10,
    max: 1,
    desc:
      t.desc ||
      `${e} (сила ${t.str ?? 7}) из резерва Ставки перейдёт в ваше подчинение.`,
    base: () => t.base ?? 40,
    avail: t.avail,
    why: t.why,
    apply: (n, r) =>
      pr(n, r, {
        type: t.type || `arm`,
        name: e,
        str: t.str ?? 7,
        org: 0.8,
        xp: t.xp,
      }),
  }),
};
function mr(e, t, n, r, i) {
  let a = 0;
  for (let o of ur(e)) fr(e, o, n) && (dr(e, t, o, r, i), a++);
  return a;
}
var hr = (e, t) => e.s.units.filter((e) => e.army === t),
  gr = (e, t, n, r = `SOV`) => {
    let i = t.cities.find((e) => e.name === n);
    return !!i && t.nations[e.owner[i.hex]] === r;
  };
function _r(e) {
  let t = e.career,
    n = (n, r, i, a) => {
      let o = Bn(n, t);
      if (i === `dismissed`)
        return {
          winner: null,
          win: !1,
          stars: 0,
          title: `Отстранён от командования`,
          text: `Ставка потеряла доверие к командующему. ${t.armyName}: командование принял другой генерал.`,
        };
      if (i === `destroyed`)
        return {
          winner: `GER`,
          win: !1,
          stars: 0,
          title: `${t.armyName}: войска разгромлены`,
          text: `Под вашим командованием не осталось ни одного соединения.`,
        };
      let s = a || e.end(n, r),
        c = i === `fail` ? 0 : o.stars;
      return {
        winner: null,
        win: c > 0,
        stars: c,
        title: s.title,
        text: s.text,
      };
    };
  return {
    id: e.id,
    name: e.name,
    subtitle: e.subtitle,
    map: e.map,
    maxTurn: e.maxTurn,
    date: e.date,
    nations: e.nations,
    order: e.order,
    active: e.nations.map((e) => e.id),
    wars: e.wars,
    alliances: e.alliances || [],
    units: e.units,
    forts: (e.forts || []).map((e) => ({
      lon: 0,
      lat: 0,
      lvl: e.lvl,
      at: e.at,
    })),
    events: e.events,
    sides: [
      {
        id: `SOV`,
        title: `СССР`,
        brief: t.intro.text,
        difficultyHint: `Карьера`,
      },
    ],
    career: t,
    weather: e.weather,
    unitPosture: e.unitPosture,
    aiTargetFilter: e.aiTargetFilter,
    aiBias: e.aiBias,
    islandR: 0,
    supplyHook: e.supplyHook,
    init(n, r) {
      ((n.career = cn(t)), e.init?.(n, r));
    },
    onTurnEnd: (t) => {
      (e.turnEnd?.(t), In(t));
    },
    check(t, r, i) {
      let a = t.career;
      if (!a) return null;
      if (a.dismissed) return n(t, r, `dismissed`);
      if (
        !t.units.some((e) => e.nat === t.player && a.cmd.includes(e.army || ``))
      )
        return n(t, r, `destroyed`);
      let o = e.fail?.(t, r);
      return o
        ? n(t, r, `fail`, o)
        : i === `turnEnd` && t.turn >= e.maxTurn
          ? n(t, r, `end`)
          : null;
    },
    objectives: () => [],
  };
}
var vr = z(`SOV`, `A16`),
  yr = z(`SOV`, `A20`),
  br = z(`SOV`, `A19`),
  xr = z(`SOV`, `A22`),
  Sr = z(`SOV`, `A13`),
  Cr = z(`SOV`, `A24`),
  wr = z(`SOV`, `A28`),
  Tr = z(`SOV`, `A30`),
  Er = z(`SOV`, `GRK`),
  V = z(`GER`),
  Dr = [
    vr(`inf`, `46-я стрелковая дивизия`, 11, 11, 10),
    vr(`inf`, `152-я стрелковая дивизия`, 10, 11, 9),
    vr(`inf`, `129-я стрелковая дивизия`, 10, 12, 9),
    vr(`inf`, `127-я стрелковая дивизия`, 11, 12, 8),
    vr(`inf`, `158-я стрелковая дивизия`, 10, 10, 8),
    vr(`arm`, `57-я танковая дивизия`, 12, 12, 7),
    yr(`inf`, `73-я стрелковая дивизия`, 4, 13, 7),
    yr(`inf`, `229-я стрелковая дивизия`, 5, 12, 7),
    yr(`inf`, `233-я стрелковая дивизия`, 6, 11, 7),
    yr(`inf`, `144-я стрелковая дивизия`, 7, 10, 8),
    yr(`arm`, `5-й механизированный корпус`, 6, 13, 6),
    yr(`arm`, `7-й механизированный корпус`, 8, 12, 6),
    yr(`inf`, `153-я стрелковая дивизия`, 5, 14, 8),
    br(`inf`, `162-я стрелковая дивизия`, 7, 8, 7),
    br(`inf`, `134-я стрелковая дивизия`, 7, 7, 7),
    br(`mot`, `220-я моторизованная дивизия`, 9, 8, 6),
    xr(`inf`, `186-я стрелковая дивизия`, 2, 1, 6),
    xr(`inf`, `170-я стрелковая дивизия`, 8, 4, 6),
    Sr(`inf`, `172-я стрелковая дивизия`, 4, 18, 8),
    Sr(`inf`, `110-я стрелковая дивизия`, 5, 17, 7),
    Sr(`arm`, `20-й механизированный корпус`, 6, 16, 5),
    Sr(`inf`, `4-й воздушно-десантный корпус`, 8, 19, 6),
    Cr(`inf`, `100-я стрелковая дивизия`, 15, 13, 9),
    Cr(`inf`, `120-я стрелковая дивизия`, 16, 12, 9),
    Cr(`inf`, `19-я стрелковая дивизия`, 16, 10, 8),
    Cr(`mot`, `106-я моторизованная дивизия`, 17, 13, 8),
    wr(`inf`, `145-я стрелковая дивизия`, 13, 17, 9),
    wr(`inf`, `149-я стрелковая дивизия`, 14, 18, 9),
    wr(`arm`, `104-я танковая дивизия`, 15, 17, 7),
    Tr(`inf`, `242-я стрелковая дивизия`, 11, 4, 8),
    V(`arm`, `7-я танковая дивизия`, 6, 9, 8),
    V(`arm`, `20-я танковая дивизия`, 5, 7, 8),
    V(`arm`, `12-я танковая дивизия`, 5, 10, 8),
    V(`mot`, `20-я моторизованная дивизия`, 6, 8, 8),
    V(`mot`, `14-я моторизованная дивизия`, 4, 7, 8),
    V(`arm`, `19-я танковая дивизия`, 3, 4, 8),
    V(`mot`, `18-я моторизованная дивизия`, 2, 9, 8),
    V(`mot`, `29-я моторизованная дивизия`, 3, 12, 8),
    V(`arm`, `17-я танковая дивизия`, 3, 14, 8),
    V(`arm`, `18-я танковая дивизия`, 4, 15, 8),
    V(`arm`, `10-я танковая дивизия`, 3, 16, 8),
    V(`mot`, `Дивизия СС «Рейх»`, 2, 16, 8),
    V(`arm`, `3-я танковая дивизия`, 2, 19, 8),
    V(`arm`, `4-я танковая дивизия`, 4, 20, 8),
    V(`inf`, `5-я пехотная дивизия`, 3, 9),
    V(`inf`, `35-я пехотная дивизия`, 1, 7),
    V(`inf`, `106-я пехотная дивизия`, 2, 6),
    V(`inf`, `7-я пехотная дивизия`, 2, 13),
    V(`inf`, `15-я пехотная дивизия`, 3, 18),
    V(`inf`, `263-я пехотная дивизия`, 1, 20),
  ],
  Or = (e, t, n, r, i = {}) => ({
    id: e,
    turn: t,
    icon: `news`,
    views: {
      SOV: {
        title: n,
        text: r,
        options: [{ label: `Принято`, desc: ``, effects: [] }],
      },
    },
    ...i,
  }),
  kr = [
    Or(
      `s_start`,
      1,
      `Смоленское сражение`,
      `Танковые группы Гота и Гудериана прорвали фронт на Днепре и Западной Двине и рвутся к Смоленску — воротам на Москву. Ставка приказывает: Смоленск не сдавать.`,
    ),
    {
      id: `s_ger2`,
      turn: 2,
      icon: `war`,
      immediate: [
        {
          k: `spawn`,
          units: [
            V(`inf`, `8-я пехотная дивизия`, 1, 11),
            V(`inf`, `28-я пехотная дивизия`, 2, 14),
            V(`inf`, `78-я пехотная дивизия`, 1, 17),
          ],
        },
      ],
      views: {},
    },
    Or(
      `s_kat`,
      2,
      `Первый залп «катюш»`,
      `14 июля у станции Орша экспериментальная батарея капитана И. А. Флёрова — семь реактивных установок БМ-13 — накрыла немецкие эшелоны одним залпом. Станция горела несколько часов. Новое оружие пока на вес золота, но батарею можно запросить по телеграфу.`,
    ),
    Or(
      `s_roko`,
      3,
      `Группа Рокоссовского`,
      `Под Ярцево из отходящих частей и резервов собрана оперативная группа генерала К. К. Рокоссовского. Она прикрывает Минское шоссе и попытается пробить коридор к вашей армии.`,
      {
        immediate: [
          {
            k: `spawn`,
            units: [
              Er(`inf`, `38-я стрелковая дивизия`, 14, 9, 8),
              Er(`arm`, `101-я танковая дивизия`, 15, 9, 6),
              Er(`inf`, `91-я стрелковая дивизия`, 14, 8, 7),
            ],
          },
        ],
      },
    ),
    {
      id: `s_ger4`,
      turn: 4,
      icon: `war`,
      immediate: [
        {
          k: `spawn`,
          units: [
            V(`inf`, `137-я пехотная дивизия`, 3, 6),
            V(`inf`, `161-я пехотная дивизия`, 1, 11),
            V(`inf`, `268-я пехотная дивизия`, 2, 14),
            V(`mot`, `Полк «Великая Германия»`, 1, 17, 6),
          ],
        },
      ],
      views: {},
    },
    Or(
      `s_res5`,
      5,
      `Фронт резервных армий`,
      `Ставка развернула за вашей спиной Фронт резервных армий. 24-я армия получила свежие дивизии.`,
      {
        immediate: [
          {
            k: `spawn`,
            units: [
              Cr(`inf`, `103-я стрелковая дивизия`, 18, 12, 9),
              Cr(`inf`, `309-я стрелковая дивизия`, 19, 10, 9),
            ],
          },
        ],
      },
    ),
    Or(
      `s_dir34`,
      7,
      `Немцы переходят к обороне`,
      `Разведка докладывает: директивой № 34 группа армий «Центр» переходит к обороне — танковые группы Гудериана и Гота выдохлись в Смоленском сражении. Время для контрударов!`,
      {
        immediate: [
          { k: `posture`, n: `GER`, v: `def` },
          { k: `org`, n: `SOV`, v: 10 },
        ],
      },
    ),
    Or(
      `s_rain`,
      9,
      `Дожди`,
      `Начались проливные дожди. Дороги раскисли, авиация почти не летает.`,
    ),
  ],
  Ar = {
    general: `Михаил Лукин`,
    short: `Лукин`,
    rank: `генерал-лейтенант`,
    army: `A16`,
    armyName: `16-я армия`,
    hq: `Ставка`,
    role: `Командующий 16-й армией`,
    armies: {
      A16: { name: `16-я армия`, general: `ген. М. Ф. Лукин` },
      A20: { name: `20-я армия`, general: `ген. П. А. Курочкин`, post: `def` },
      A19: { name: `19-я армия`, general: `ген. И. С. Конев`, post: `def` },
      A22: { name: `22-я армия`, general: `ген. Ф. А. Ершаков`, post: `def` },
      A13: { name: `13-я армия`, general: `ген. Ф. Н. Ремезов`, post: `def` },
      A24: { name: `24-я армия`, general: `ген. К. И. Ракутин`, post: `def` },
      A28: { name: `28-я армия`, general: `ген. В. Я. Качалов`, post: `def` },
      A30: { name: `30-я армия`, general: `ген. В. А. Хоменко`, post: `def` },
      GRK: {
        name: `Группа Рокоссовского`,
        general: `ген. К. К. Рокоссовский`,
        post: `def`,
      },
    },
    start: { trust: 50, auth: 50, fame: 10 },
    sup0: 20,
    stars: { two: 5, three: 6, fame: 40 },
    intro: {
      title: `16-я армия`,
      text: `13 июля 1941 года. Вы — {rank} {name}, командующий 16-й армией Западного фронта. Танковые клинья врага охватывают Смоленск с севера и юга. Удержите город, контратакуйте и сохраните армию. Соседними армиями управляет компьютер. Операция длится 10 ходов, до 9 августа.`,
    },
    brief: `Июль 1941 года. Танковые группы Гота и Гудериана рвутся к Смоленску. Ваша 16-я армия обороняет город — ворота на Москву.`,
    standing: `Берегите войска: каждое потерянное соединение — Авторитет −6, Слава −2, Доверие −1. Уничтоженное вражеское — Авторитет +2 и Слава +3 (после четвёртого за операцию — +1). Каждые две успешные атаки — Слава +1.`,
    directives: [
      {
        id: `hold_smol`,
        at: 1,
        turns: 2,
        kind: `hold`,
        city: `Смоленск`,
        title: `Смоленск не сдавать`,
        goal: `Удержать Смоленск`,
        text: `Смоленск — ключ к Москве. Город должен держаться, пока подходят резервы.`,
        reward: { trust: 8, fame: 4 },
        penalty: { trust: -6, fame: -2 },
      },
      {
        id: `wins1`,
        at: 2,
        turns: 3,
        kind: `wins`,
        need: 3,
        title: `Контратаки на подступах`,
        goal: `Одержать 3 победы в атаках за 3 хода`,
        text: `Не давайте врагу закрепиться: контратакуйте его передовые части. Победа — противник отступил или разбит.`,
        reward: { trust: 6, auth: 4, fame: 5 },
        penalty: { trust: -5 },
      },
      {
        id: `smol2`,
        at: 4,
        turns: 2,
        kind: `hold`,
        city: `Смоленск`,
        cond: (e) => L(e, `Смоленск`),
        title: `Держать Смоленск`,
        goal: `Удержать Смоленск`,
        text: `Город держится — и вся страна следит за Смоленском. Удержите его ещё два хода.`,
        reward: { trust: 10, fame: 8 },
        penalty: { trust: -6, fame: -3 },
      },
      {
        id: `smol_ret`,
        at: 4,
        last: 8,
        turns: 4,
        kind: `take`,
        own: !0,
        city: `Смоленск`,
        cond: (e) => !L(e, `Смоленск`),
        title: `Вернуть Смоленск`,
        goal: `Отбить Смоленск силами своей армии`,
        text: `Ставка требует выбить врага из Смоленска. Город должны освободить именно ваши войска.`,
        reward: { trust: 10, fame: 10, auth: 4 },
        penalty: { trust: -6 },
      },
      {
        id: `solov`,
        at: 6,
        turns: 3,
        kind: `hold`,
        city: `Соловьёво`,
        cond: (e) => L(e, `Соловьёво`),
        title: `Соловьёвская переправа`,
        goal: `Удержать Соловьёво`,
        text: `Через переправу у Соловьёво идёт всё снабжение армий под Смоленском. Её потеря означает окружение.`,
        reward: { trust: 6, auth: 6 },
        penalty: { trust: -6, auth: -4 },
      },
      {
        id: `solov_ret`,
        at: 6,
        turns: 3,
        kind: `take`,
        city: `Соловьёво`,
        cond: (e) => !L(e, `Соловьёво`),
        title: `Отбить переправу`,
        goal: `Вернуть Соловьёво`,
        text: `Враг перерезал переправу у Соловьёво. Пробейте коридор — вместе с группой Рокоссовского.`,
        reward: { trust: 8, auth: 6, fame: 4 },
        penalty: { trust: -5, auth: -4 },
      },
      {
        id: `wins2`,
        at: 5,
        last: 5,
        turns: 3,
        kind: `wins`,
        need: 3,
        cond: (e) => L(e, `Смоленск`),
        title: `Активная оборона`,
        goal: `Одержать 3 победы в атаках за 3 хода`,
        text: `Враг подтягивает пехоту и готовит штурм Смоленска. Сидеть в окопах — значит ждать, пока он соберётся с силами: бейте его передовые части, не давайте развернуться для удара.`,
        reward: { trust: 6, auth: 4, fame: 6 },
        penalty: { trust: -5, fame: -2 },
      },
      {
        id: `counter`,
        at: 7,
        last: 7,
        turns: 3,
        kind: `kills`,
        need: 2,
        title: `Время контрударов`,
        goal: `Разгромить 2 вражеских соединения за 3 хода`,
        text: `Группа армий «Центр» перешла к обороне. Ставка требует контрударов: окружайте и уничтожайте выдохшиеся немецкие дивизии.`,
        reward: { trust: 6, auth: 6, fame: 8 },
        penalty: { trust: -5, auth: -2 },
      },
      {
        id: `line`,
        at: 8,
        last: 8,
        turns: 3,
        kind: `reach`,
        need: 3,
        cond: (e) => !L(e, `Смоленск`),
        title: `Рубеж у Дорогобужа`,
        goal: `Вывести 3 соединения в район Дорогобужа и Соловьёво`,
        zone: cr([`Дорогобуж`, `Соловьёво`], 1),
        text: `Смоленск в руках врага. Армия должна отойти за Днепр, занять новый рубеж у Дорогобужа и не дать врагу прорваться к Вязьме.`,
        reward: { trust: 8, auth: 6, fame: 4 },
        penalty: { trust: -6, auth: -4 },
      },
      {
        id: `smol_end`,
        at: 8,
        last: 8,
        turns: 3,
        kind: `hold`,
        city: `Смоленск`,
        cond: (e) => L(e, `Смоленск`),
        title: `Смоленск — до конца`,
        goal: `Удержать Смоленск до конца операции`,
        text: `Смоленск в наших руках, и враг выдохся. Отступать не нужно: удержите город до конца операции. А если ударом на запад освободите Красный — Ставка оценит особо.`,
        bonusCity: `Красный`,
        bonusOwn: !0,
        bonus: { fame: 6, trust: 2 },
        bonusText: `Красный освобождён`,
        reward: { trust: 8, fame: 6, auth: 2 },
        penalty: { trust: -6, fame: -2 },
      },
      {
        id: `yelnya`,
        turns: 3,
        kind: `take`,
        own: !0,
        city: `Ельня`,
        title: `Ельнинский контрудар`,
        goal: `Освободить Ельню силами своей армии за 3 хода`,
        text: `Ставка одобрила ваш план: срезать Ельнинский выступ. 24-я армия переходит в ваше подчинение, два хода ваши войска атакуют сильнее. Освободите Ельню — и лучшие дивизии получат звание гвардейских.`,
        reward: { trust: 8, fame: 14, auth: 6 },
        penalty: { trust: -6, fame: -4 },
        onIssue: (e) => {
          let t = e.s.career;
          return (
            (t.atkUntil = e.s.turn + 1),
            (t.atkV = 0.2),
            (t.atkLbl = `Ельнинский контрудар`),
            t.cmd.includes(`A24`) || t.cmd.push(`A24`),
            `В подчинение переходит 24-я армия (соединений: ${hr(e, `A24`).length}).`
          );
        },
      },
    ],
    requests: [
      {
        id: `yelnya`,
        icon: `sword`,
        title: `Ельнинский контрудар`,
        cost: 0,
        desc: `Срезать Ельнинский выступ: 24-я армия перейдёт под ваше командование. Доступно, пока Ельня у врага.`,
        base: (e) => (e.s.turn < 7 ? 35 : 70),
        avail: (e) =>
          e.s.turn >= 3 && e.s.turn <= 9 && !En(e, `yelnya`) && !L(e, `Ельня`),
        why: (e) =>
          En(e, `yelnya`)
            ? `Контрудар уже разрешён`
            : e.s.turn < 3
              ? `Станет доступно с 3-го хода`
              : L(e, `Ельня`)
                ? `Ельня в наших руках`
                : `Момент упущен`,
        apply: (e, t, n) => (
          Tn(e, `yelnya`, n, t),
          `Ставка одобрила план Ельнинской наступательной операции.`
        ),
      },
      {
        id: `roko`,
        icon: `shield`,
        title: `Удар группы Рокоссовского`,
        cost: 4,
        max: 1,
        desc: `Попросить группу Рокоссовского перейти в наступление навстречу вашей армии.`,
        base: () => 55,
        avail: (e) =>
          e.s.turn >= 3 &&
          hr(e, `GRK`).length > 0 &&
          e.s.career.post.GRK !== `off`,
        why: (e) =>
          e.s.turn < 3 ? `Группа ещё формируется` : `Группа уже наступает`,
        apply: (e) => (
          (e.s.career.post.GRK = `off`),
          `Рокоссовский переходит в наступление на Ярцево и Духовщину.`
        ),
      },
      B.ammo(65, 15, 6),
      B.air((e) => (e.s.turn <= 3 ? 25 : 40), 2, 5),
      B.reinf([`250-я стрелковая дивизия`, `251-я стрелковая дивизия`], {
        base: 40,
        str: 7,
      }),
      B.katyusha({
        base: 40,
        max: 2,
        title: `Батарея капитана Флёрова`,
        who: `Батарея капитана Флёрова`,
        desc: `Экспериментальная батарея реактивных установок БМ-13 — будущих «катюш». Накроет врагов рядом с вашими войсками: организация −15…25, иногда и сила.`,
        avail: (e) => e.s.turn >= 2,
        why: () => `Батарея ещё не прибыла на фронт`,
      }),
      B.retreat(40),
      B.delay(50),
    ],
    history: `Смоленское сражение длилось два месяца. 16 июля немцы ворвались в Смоленск, 16-я и 20-я армии почти две недели дрались в окружении севернее города и вышли через Соловьёвскую переправу. Группа армий «Центр» впервые перешла к обороне, а 6 сентября под Ельней Красная армия провела первую успешную наступательную операцию: четыре дивизии стали первыми гвардейскими. Генерал Лукин позже командовал 19-й армией и в октябре 1941 года, тяжело раненный, попал в плен под Вязьмой.`,
    awards: [
      { fame: 60, name: `Орден Ленина` },
      { fame: 35, name: `Орден Красного Знамени` },
      { fame: 20, name: `Орден Красной Звезды` },
    ],
    promotion: `Присвоено звание генерал-лейтенанта`,
  };
function jr(e) {
  let t = e.s.career;
  if (t.f.g1 || !t.dirs.some((e) => e.id === `yelnya` && e.status === `done`))
    return;
  let n = hn(e)
    .filter((e) => e.type === `inf` && !e.guard)
    .sort((e, t) => t.xp - e.xp)[0];
  if (!n) return;
  t.f.g1 = 1;
  let r = n.name;
  ((n.name = `1-я гвардейская стрелковая дивизия`),
    (n.guard = !0),
    (n.xp = Math.max(n.xp, 7)),
    t.news.push({
      kind: `gain`,
      title: `Рождение советской гвардии`,
      text: `За Ельню ${r} преобразована в 1-ю гвардейскую стрелковую дивизию. Гвардия атакует и обороняется на 10% сильнее.`,
    }));
}
var Mr = _r({
    id: `smolensk41`,
    name: `Смоленск 1941`,
    subtitle: `Смоленское сражение · 16-я армия`,
    map: `smolensk41`,
    year: 1941,
    maxTurn: 10,
    date: tr(1941, 7, 13, 3),
    nations: [ar(1941), or(1941)],
    order: [`GER`, `SOV`],
    wars: [[`GER`, `SOV`]],
    units: Dr,
    events: kr,
    career: Ar,
    weather: (e) => (e >= 9 ? `rain` : `clear`),
    turnEnd: jr,
    aiBias: (e, a, d) => {
      let B = [3, 2, 1, 7];
      if (a.nat !== `GER` || e.s.turn > B[3]) return 0;
      let k = f(e.m.g, d.hex, _n(e, `Смоленск`));
      return k <= 1 ? B[0] : k <= 2 ? B[1] : P(e, d) ? B[2] : 0;
    },
    end: (e, t) =>
      gr(e, t, `Смоленск`)
        ? {
            title: `Смоленск удержан`,
            text: `Танковые группы врага остановлены у Смоленска. Блицкриг на Москву сорван.`,
          }
        : {
            title: `Смоленск пал, но враг остановлен`,
            text: `Город в руках врага, но группа армий «Центр» выдохлась и перешла к обороне. Время выиграно.`,
          },
  }),
  Nr = z(`SOV`, `A16`),
  Pr = z(`SOV`, `A30`),
  Fr = z(`SOV`, `A5`),
  Ir = z(`SOV`, `A33`),
  Lr = z(`SOV`, `A43`),
  Rr = z(`SOV`, `A49`),
  zr = z(`SOV`, `UD1`),
  Br = z(`SOV`, `A20`),
  Vr = z(`SOV`, `MZO`),
  H = (e, t, n, r, i = 10) => z(`GER`)(e, t, n, r, i, { org: 0.8 }),
  Hr = [
    Nr(`inf`, `316-я стрелковая дивизия`, 9, 10, 9, { xp: 3 }),
    Nr(`inf`, `18-я стрелковая дивизия`, 9, 11, 8),
    Nr(`inf`, `78-я стрелковая дивизия`, 10, 12, 10, { xp: 2 }),
    Nr(`arm`, `1-я гвардейская танковая бригада`, 10, 11, 7, {
      guard: !0,
      xp: 5,
    }),
    Nr(`cav`, `3-й кавалерийский корпус`, 8, 9, 8),
    Nr(`inf`, `126-я стрелковая дивизия`, 9, 8, 8),
    Vr(`inf`, `2-я Московская стрелковая дивизия`, 15, 12, 9),
    Vr(`inf`, `3-я Московская коммунистическая дивизия`, 14, 11, 8),
    Vr(`inf`, `4-я Московская стрелковая дивизия`, 14, 13, 7),
    Pr(`inf`, `5-я стрелковая дивизия`, 9, 4, 7),
    Pr(`mot`, `107-я мотострелковая дивизия`, 9, 6, 6),
    Pr(`arm`, `21-я танковая бригада`, 10, 5, 5),
    Pr(`inf`, `185-я стрелковая дивизия`, 10, 2, 6),
    Fr(`inf`, `32-я стрелковая дивизия`, 10, 14, 9),
    Fr(`inf`, `50-я стрелковая дивизия`, 10, 15, 7),
    Fr(`inf`, `144-я стрелковая дивизия`, 10, 13, 7),
    Fr(`mot`, `82-я мотострелковая дивизия`, 11, 14, 8),
    Ir(`mot`, `1-я гвардейская мотострелковая дивизия`, 11, 16, 8, {
      guard: !0,
    }),
    Ir(`inf`, `110-я стрелковая дивизия`, 11, 17, 6),
    Lr(`inf`, `53-я стрелковая дивизия`, 12, 18, 7),
    Lr(`inf`, `17-я стрелковая дивизия`, 12, 19, 6),
    Rr(`inf`, `415-я стрелковая дивизия`, 12, 21, 8),
    H(`arm`, `6-я танковая дивизия`, 7, 7, 7),
    H(`arm`, `7-я танковая дивизия`, 8, 8, 7),
    H(`mot`, `14-я моторизованная дивизия`, 8, 6, 8),
    H(`arm`, `1-я танковая дивизия`, 8, 4, 7),
    H(`mot`, `36-я моторизованная дивизия`, 8, 2, 8),
    H(`inf`, `86-я пехотная дивизия`, 8, 1, 9),
    H(`arm`, `2-я танковая дивизия`, 7, 9, 8),
    H(`arm`, `5-я танковая дивизия`, 7, 10, 8),
    H(`arm`, `11-я танковая дивизия`, 8, 11, 7),
    H(`arm`, `10-я танковая дивизия`, 9, 12, 7),
    H(`mot`, `Дивизия СС «Рейх»`, 9, 13, 8),
    H(`inf`, `35-я пехотная дивизия`, 6, 9, 9),
    H(`inf`, `106-я пехотная дивизия`, 6, 7, 9),
    H(`inf`, `78-я пехотная дивизия`, 9, 14, 9),
    H(`inf`, `87-я пехотная дивизия`, 9, 15, 9),
    H(`inf`, `7-я пехотная дивизия`, 10, 17, 9),
    H(`inf`, `197-я пехотная дивизия`, 10, 16, 9),
    H(`inf`, `258-я пехотная дивизия`, 11, 18, 9),
    H(`arm`, `19-я танковая дивизия`, 11, 19, 7),
  ],
  Ur = (e, t, n, r, i = {}) => ({
    id: e,
    turn: t,
    icon: `news`,
    views: {
      SOV: {
        title: n,
        text: r,
        options: [{ label: `Принято`, desc: ``, effects: [] }],
      },
    },
    ...i,
  }),
  Wr = [
    Ur(
      `m_start`,
      1,
      `Последний рывок на Москву`,
      `Немцы начали второе генеральное наступление на Москву: танковые группы обходят столицу с севера через Клин и Солнечногорск. Ставка приказывает: ни шагу назад.`,
    ),
    Ur(
      `m_panf`,
      2,
      `Панфиловцы`,
      `У разъезда Дубосеково бойцы 316-й дивизии генерала Панфилова остановили немецкие танки. Дивизия стала 8-й гвардейской.`,
      {
        immediate: [
          {
            k: `guard`,
            name: `316-я стрелковая дивизия`,
            to: `8-я гвардейская стрелковая дивизия`,
          },
        ],
      },
    ),
    Ur(
      `m_g9`,
      4,
      `Новая гвардия`,
      `За стойкость в боях за Истру 78-я сибирская дивизия Белобородова стала 9-й гвардейской, а кавалерийский корпус Доватора — 2-м гвардейским.`,
      {
        immediate: [
          {
            k: `guard`,
            name: `78-я стрелковая дивизия`,
            to: `9-я гвардейская стрелковая дивизия`,
          },
          {
            k: `guard`,
            name: `3-й кавалерийский корпус`,
            to: `2-й гвардейский кавалерийский корпус`,
          },
        ],
      },
    ),
    Ur(
      `m_ud1`,
      5,
      `1-я ударная армия`,
      `Из резерва Ставки к Дмитрову и Яхроме выдвинулась 1-я ударная армия. Немцам не удастся перейти канал Москва — Волга.`,
      {
        immediate: [
          {
            k: `spawn`,
            units: [
              zr(`inf`, `29-я стрелковая бригада`, 14, 7, 9),
              zr(`inf`, `44-я стрелковая бригада`, 14, 8, 9),
              zr(`inf`, `50-я стрелковая бригада`, 15, 8, 8),
            ],
          },
        ],
      },
    ),
    Ur(
      `m_a20`,
      4,
      `20-я армия`,
      `На рубеже Красная Поляна — Химки развёртывается 20-я армия из резерва Ставки. Немцы в 30 километрах от Кремля.`,
      {
        immediate: [
          {
            k: `spawn`,
            units: [
              Br(`inf`, `331-я стрелковая дивизия`, 14, 10, 10),
              Br(`inf`, `352-я стрелковая дивизия`, 15, 10, 10),
              Br(`arm`, `134-й танковый батальон`, 14, 11, 6),
            ],
          },
        ],
      },
    ),
    Ur(
      `m_counter`,
      7,
      `Контрнаступление под Москвой`,
      `5 декабря войска Калининского и Западного фронтов перешли в контрнаступление. Немцы в лёгких шинелях замерзают в снегах. Вашей армии переданы 354-я стрелковая дивизия и 145-я танковая бригада. Вперёд, на запад!`,
      {
        immediate: [
          { k: `posture`, n: `GER`, v: `def` },
          { k: `armyPost`, army: `A30`, v: `off` },
          { k: `armyPost`, army: `UD1`, v: `off` },
          { k: `armyPost`, army: `A20`, v: `off` },
          { k: `armyPost`, army: `A5`, v: `off` },
          { k: `armyPost`, army: `A33`, v: `off` },
          { k: `org`, n: `SOV`, v: 15 },
          {
            k: `spawn`,
            units: [
              Nr(`inf`, `354-я стрелковая дивизия`, 13, 11, 9),
              Nr(`arm`, `145-я танковая бригада`, 13, 12, 6),
            ],
          },
        ],
      },
    ),
    Ur(
      `m_halt`,
      11,
      `Стоп-приказ Гитлера`,
      `Гитлер запретил отступать: немецкие дивизии должны держаться любой ценой. Окружайте их узлы обороны!`,
      { immediate: [{ k: `posture`, n: `GER`, v: `hold` }] },
    ),
  ],
  Gr = (e) =>
    cr(
      [`Москва`],
      2,
    )(e).filter(
      (t) => t % e.m.g.cols <= 15 && Math.floor(t / e.m.g.cols) <= 12,
    ),
  Kr = [
    `clear`,
    `snow`,
    `snow`,
    `clear`,
    `snow`,
    `frost`,
    `frost`,
    `frost`,
    `snow`,
    `frost`,
    `snow`,
    `snow`,
    `frost`,
  ],
  qr = {
    general: `Константин Рокоссовский`,
    short: `Рокоссовский`,
    rank: `генерал-лейтенант`,
    army: `A16`,
    armyName: `16-я армия`,
    hq: `Ставка`,
    role: `Командующий 16-й армией`,
    armies: {
      A16: { name: `16-я армия`, general: `ген. К. К. Рокоссовский` },
      A30: { name: `30-я армия`, general: `ген. Д. Д. Лелюшенко`, post: `def` },
      A5: { name: `5-я армия`, general: `ген. Л. А. Говоров`, post: `def` },
      A33: { name: `33-я армия`, general: `ген. М. Г. Ефремов`, post: `def` },
      A43: { name: `43-я армия`, general: `ген. К. Д. Голубев`, post: `def` },
      A49: { name: `49-я армия`, general: `ген. И. Г. Захаркин`, post: `def` },
      UD1: {
        name: `1-я ударная армия`,
        general: `ген. В. И. Кузнецов`,
        post: `def`,
      },
      A20: { name: `20-я армия`, general: `ген. А. А. Власов`, post: `def` },
      MZO: {
        name: `Московская зона обороны`,
        general: `ген. П. А. Артемьев`,
        post: `hold`,
      },
    },
    start: { trust: 50, auth: 50, fame: 10 },
    sup0: 18,
    stars: { two: 3, three: 5, fame: 50 },
    intro: {
      title: `16-я армия под Москвой`,
      text: `16 ноября 1941 года. Вы — {rank} {name}, командующий 16-й армией на Волоколамском шоссе. Немцы рвутся к Москве с северо-запада. Выстойте в обороне, а когда ударят морозы и подойдут резервы — переходите в контрнаступление. Операция длится 13 ходов, до 22 декабря.`,
    },
    brief: `Ноябрь 1941 года. Немецкие танковые группы в 70 км от Москвы. Ваша 16-я армия стоит на Волоколамском шоссе — на главном направлении удара.`,
    standing: `Берегите войска: каждое потерянное соединение — Авторитет −6, Слава −2, Доверие −1. Уничтоженное вражеское — Авторитет +2 и Слава +3 (после четвёртого за операцию — +1). Каждые две успешные атаки — Слава +1.`,
    directives: [
      {
        id: `istra`,
        at: 1,
        turns: 4,
        kind: `hold`,
        city: `Истра`,
        title: `Ни шагу назад`,
        goal: `Удержать Истру`,
        text: `Истра прикрывает Волоколамское шоссе — кратчайший путь к Москве. Держать любой ценой.`,
        reward: { trust: 8, fame: 5 },
        penalty: { trust: -6, fame: -2 },
      },
      {
        id: `kills1`,
        at: 2,
        turns: 4,
        kind: `kills`,
        need: 2,
        title: `Измотать танковые дивизии`,
        goal: `Разгромить 2 вражеских соединения`,
        text: `Засады, контратаки, удары во фланг — враг должен истекать кровью на каждом километре.`,
        reward: { trust: 4, auth: 4, fame: 8 },
        penalty: { trust: -4 },
      },
      {
        id: `moscow`,
        at: 5,
        turns: 2,
        kind: `keep`,
        zone: Gr,
        title: `Москву не сдавать`,
        goal: `Не пустить врага на северо-западные подступы к Москве (25 км)`,
        text: `Ни один немецкий солдат не должен прорваться к Москве с северо-запада — через Красную Поляну и Химки. Если враг ворвался в зону — выбейте его до конца хода.`,
        reward: { trust: 10, fame: 6 },
        penalty: { trust: -10, fame: -4 },
      },
      {
        id: `counter`,
        at: 7,
        turns: 2,
        kind: `wins`,
        need: 2,
        title: `Контрнаступление!`,
        goal: `Одержать 2 победы в атаках за 2 хода`,
        text: `Пришёл наш черёд. Бейте замёрзшего врага, не давайте ему закрепиться.`,
        reward: { trust: 6, auth: 4, fame: 8 },
        penalty: { trust: -5 },
        onIssue: (e) => {
          let t = e.s.career;
          return (
            (t.atkUntil = e.s.turn + 1),
            (t.atkV = 0.15),
            (t.atkLbl = `Контрнаступление под Москвой`),
            `Два хода ваши войска атакуют на 15% сильнее.`
          );
        },
      },
      {
        id: `istra2`,
        at: 8,
        turns: 3,
        kind: `take`,
        own: !0,
        city: `Истра`,
        cond: (e) => !L(e, `Истра`),
        title: `Освободить Истру`,
        goal: `Отбить Истру силами своей армии`,
        text: `Город Истра в руках врага. Освободите его — это задача именно вашей армии.`,
        reward: { trust: 8, fame: 8, auth: 4 },
        penalty: { trust: -6 },
      },
      {
        id: `soln`,
        at: 8,
        last: 9,
        turns: 3,
        kind: `take`,
        city: `Солнечногорск`,
        cond: (e) => L(e, `Истра`) && !L(e, `Солнечногорск`),
        title: `Освободить Солнечногорск`,
        goal: `Вернуть Солнечногорск`,
        text: `Вместе с соседями выбейте врага из Солнечногорска на Ленинградском шоссе.`,
        reward: { trust: 8, fame: 6, auth: 4 },
        penalty: { trust: -6 },
      },
      {
        id: `ruza`,
        at: 8,
        last: 9,
        turns: 3,
        kind: `reach`,
        need: 2,
        zone: cr([`Руза`], 1),
        cond: (e) => L(e, `Истра`) && L(e, `Солнечногорск`),
        title: `Выйти к Рузе`,
        goal: `Вывести 2 соединения к Рузе`,
        text: `Северный фланг врага отброшен. Выходите к Рузе, во фланг и тыл 4-й танковой группе.`,
        reward: { trust: 8, fame: 8, auth: 4 },
        penalty: { trust: -6 },
      },
      {
        id: `volok`,
        at: 10,
        turns: 4,
        kind: `take`,
        own: !0,
        city: `Волоколамск`,
        title: `Освободить Волоколамск`,
        goal: `Освободить Волоколамск силами своей армии`,
        text: `Ставка приказывает освободить Волоколамск. Обходите узлы обороны, окружайте отходящего врага.`,
        reward: { trust: 10, fame: 12, auth: 4 },
        penalty: { trust: -5 },
      },
    ],
    requests: [
      B.reinf(
        [
          `82-я сибирская стрелковая дивизия`,
          `93-я сибирская стрелковая дивизия`,
        ],
        {
          title: `Сибирские дивизии`,
          str: 9,
          xp: 3,
          max: 2,
          cost: 10,
          base: 40,
          desc: `Свежая кадровая дивизия с Дальнего Востока (сила 9, обстрелянная) прибудет в ближайший к армии город. Не более двух.`,
        },
      ),
      B.fortify({
        base: 60,
        max: 2,
        avail: (e) => e.s.turn <= 6,
        why: () => `Армия перешла в наступление`,
      }),
      B.katyusha({ base: 50, max: 2 }),
      B.tanks(`27-я танковая бригада`, {
        base: 40,
        str: 6,
        avail: (e) => e.s.turn >= 3,
        why: () => `Станет доступно с 3-го хода`,
      }),
      B.ammo(65, 15, 6),
      B.air((e) => (e.s.turn <= 6 ? 45 : 60), 3, 5),
      {
        ...B.retreat(25),
        title: `Отвод за Истринское водохранилище`,
        desc: `Попросить разрешения отвести войска на выгодный рубеж. Жуков такие просьбы не любит: шанс мал.`,
      },
      B.delay(50),
    ],
    history: `Рокоссовский просил разрешения отвести 16-ю армию за Истринское водохранилище — Жуков отказал, но армия выстояла: к 5 декабря немцы подошли к Москве на 25–30 км и выдохлись. Контрнаступление отбросило их на 100–250 км; Истру освободили 11 декабря, Волоколамск — 20 декабря. Это было первое крупное поражение вермахта во Второй мировой войне.`,
    awards: [
      { fame: 55, name: `Орден Ленина` },
      { fame: 30, name: `Орден Красного Знамени` },
      { fame: 15, name: `Медаль «За оборону Москвы»` },
    ],
    promotion: `Присвоено звание генерал-лейтенанта`,
  },
  Jr = _r({
    id: `moscow41`,
    name: `Москва 1941`,
    subtitle: `Битва за Москву · 16-я армия`,
    map: `moscow41`,
    year: 1941,
    maxTurn: 13,
    date: tr(1941, 11, 16, 3),
    nations: [ar(1941, { atk: 1 }), or(1941, { orgMax: 80 })],
    order: [`GER`, `SOV`],
    wars: [[`GER`, `SOV`]],
    units: Hr,
    events: Wr,
    career: qr,
    init: (e) => {
      for (let t of e.units)
        t.nat === `SOV` &&
          (t.army === `A16` || t.army === `MZO` || t.army === `A5`) &&
          (t.entrench = 1);
    },
    forts: [
      { at: [15, 12], lvl: 2 },
      { at: [14, 11], lvl: 1 },
      { at: [14, 13], lvl: 1 },
      { at: [11, 11], lvl: 1 },
      { at: [9, 10], lvl: 1 },
      { at: [9, 11], lvl: 1 },
      { at: [10, 12], lvl: 1 },
      { at: [14, 10], lvl: 1 },
    ],
    weather: (e) => Kr[Math.min(Kr.length, e) - 1],
    fail: (e, t) =>
      gr(e, t, `Москва`, `GER`)
        ? {
            title: `Москва пала`,
            text: `Немецкие танки ворвались в столицу. Война приняла катастрофический оборот.`,
          }
        : null,
    end: (e, t) =>
      gr(e, t, `Волоколамск`)
        ? {
            title: `Враг отброшен от Москвы`,
            text: `Волоколамск освобождён, немецкие армии откатываются на запад. Миф о непобедимости вермахта развеян.`,
          }
        : {
            title: `Москва выстояла`,
            text: `Немцы остановлены у стен столицы и отброшены. Впереди тяжёлая зима, но Москва спасена.`,
          },
  }),
  Yr = z(`SOV`, `TA5`),
  Xr = z(`SOV`, `A21`),
  Zr = z(`SOV`, `A65`),
  Qr = z(`SOV`, `A24`),
  $r = z(`SOV`, `A66`),
  ei = z(`SOV`, `A62`),
  ti = z(`SOV`, `A64`),
  ni = z(`SOV`, `A57`),
  ri = z(`SOV`, `A51`),
  ii = z(`SOV`, `G1A`),
  ai = z(`SOV`, `G2A`),
  U = z(`ROM`),
  oi = z(`GER`),
  W = z(`GER`, `P6`),
  si = z(`GER`, `H4`),
  ci = [
    Yr(`arm`, `26-й танковый корпус`, 10, 5, 9, { xp: 1 }),
    Yr(`arm`, `1-й танковый корпус`, 9, 5, 8),
    Yr(`cav`, `8-й кавалерийский корпус`, 11, 5, 8),
    Yr(`inf`, `47-я гвардейская стрелковая дивизия`, 10, 6, 9, {
      guard: !0,
      xp: 3,
    }),
    Yr(`inf`, `50-я гвардейская стрелковая дивизия`, 9, 4, 9, {
      guard: !0,
      xp: 3,
    }),
    Yr(`inf`, `119-я стрелковая дивизия`, 11, 6, 8),
    Yr(`inf`, `346-я стрелковая дивизия`, 8, 4, 7),
    Xr(`arm`, `4-й танковый корпус`, 12, 5, 8),
    Xr(`cav`, `3-й гвардейский кавалерийский корпус`, 13, 5, 8, { guard: !0 }),
    Xr(`inf`, `76-я стрелковая дивизия`, 12, 6, 8),
    Xr(`inf`, `293-я стрелковая дивизия`, 13, 6, 8),
    Zr(`inf`, `304-я стрелковая дивизия`, 13, 7, 8),
    Zr(`inf`, `27-я гвардейская стрелковая дивизия`, 14, 7, 8, { guard: !0 }),
    Qr(`inf`, `49-я стрелковая дивизия`, 16, 7, 7),
    Qr(`inf`, `233-я стрелковая дивизия`, 17, 8, 7),
    $r(`inf`, `99-я стрелковая дивизия`, 18, 9, 7),
    ii(`inf`, `4-я гвардейская стрелковая дивизия`, 6, 2, 8, { guard: !0 }),
    ii(`inf`, `203-я стрелковая дивизия`, 6, 3, 8),
    ei(`inf`, `13-я гвардейская стрелковая дивизия`, 19, 10, 6, {
      guard: !0,
      xp: 5,
    }),
    ei(`inf`, `284-я стрелковая дивизия`, 20, 10, 6),
    ti(`inf`, `36-я гвардейская стрелковая дивизия`, 18, 12, 7, { guard: !0 }),
    ni(`arm`, `13-й танковый корпус`, 18, 13, 7),
    ni(`inf`, `169-я стрелковая дивизия`, 18, 14, 7),
    ri(`arm`, `4-й механизированный корпус`, 19, 14, 8),
    ri(`inf`, `126-я стрелковая дивизия`, 18, 15, 7),
    ri(`cav`, `4-й кавалерийский корпус`, 19, 16, 6),
    ri(`inf`, `302-я стрелковая дивизия`, 19, 17, 7),
    U(`inf`, `7-я румынская пехотная дивизия`, 4, 2, 7),
    U(`inf`, `11-я румынская пехотная дивизия`, 5, 3, 7),
    U(`inf`, `9-я румынская пехотная дивизия`, 7, 4, 7),
    U(`inf`, `14-я румынская пехотная дивизия`, 8, 5, 7),
    U(`inf`, `5-я румынская пехотная дивизия`, 9, 6, 7),
    U(`inf`, `6-я румынская пехотная дивизия`, 10, 7, 7),
    U(`inf`, `13-я румынская пехотная дивизия`, 11, 7, 7),
    U(`arm`, `1-я румынская танковая дивизия`, 8, 7, 5),
    U(`inf`, `15-я румынская пехотная дивизия`, 6, 6, 6),
    U(`cav`, `7-я румынская кав. дивизия`, 5, 7, 5),
    oi(`arm`, `22-я танковая дивизия`, 8, 8, 5, { org: 0.8 }),
    oi(`inf`, `376-я пехотная дивизия`, 12, 7, 8),
    oi(`inf`, `44-я пехотная дивизия`, 13, 8, 8),
    oi(`inf`, `384-я пехотная дивизия`, 14, 8, 7),
    U(`inf`, `20-я румынская пехотная дивизия`, 17, 14, 6),
    U(`inf`, `2-я румынская пехотная дивизия`, 17, 15, 6),
    U(`inf`, `18-я румынская пехотная дивизия`, 18, 16, 6),
    U(`inf`, `1-я румынская пехотная дивизия`, 18, 17, 6),
    U(`inf`, `4-я румынская пехотная дивизия`, 19, 18, 6),
    U(`cav`, `5-я румынская кав. дивизия`, 19, 19, 5),
    oi(`mot`, `29-я моторизованная дивизия`, 16, 14, 8),
    W(`inf`, `71-я пехотная дивизия`, 18, 11, 8),
    W(`inf`, `295-я пехотная дивизия`, 17, 11, 7),
    W(`inf`, `100-я егерская дивизия`, 18, 10, 7),
    W(`mot`, `3-я моторизованная дивизия`, 17, 10, 7),
    W(`inf`, `371-я пехотная дивизия`, 17, 12, 7),
    W(`inf`, `297-я пехотная дивизия`, 16, 12, 7),
    W(`arm`, `14-я танковая дивизия`, 16, 11, 5),
    W(`arm`, `16-я танковая дивизия`, 16, 10, 6),
    W(`arm`, `24-я танковая дивизия`, 15, 10, 5),
    W(`inf`, `94-я пехотная дивизия`, 17, 9, 7),
    W(`inf`, `389-я пехотная дивизия`, 16, 9, 7),
    W(`inf`, `113-я пехотная дивизия`, 15, 9, 7),
    W(`inf`, `76-я пехотная дивизия`, 14, 9, 7),
    W(`mot`, `60-я моторизованная дивизия`, 15, 11, 6),
    oi(`inf`, `Тыловая группа «Калач»`, 13, 11, 3),
    oi(`inf`, `Тыловые части 6-й армии`, 15, 12, 3),
    oi(`inf`, `Боевая группа «Адам»`, 11, 12, 4),
    oi(`inf`, `Сводная боевая группа «Чир»`, 12, 14, 4),
  ],
  li = (e, t, n, r, i = {}) => ({
    id: e,
    turn: t,
    icon: `news`,
    views: {
      SOV: {
        title: n,
        text: r,
        options: [{ label: `Принято`, desc: ``, effects: [] }],
      },
    },
    ...i,
  }),
  ui = [
    li(
      `u_start`,
      1,
      `Операция «Уран»`,
      `7:30 утра, 19 ноября. После 80-минутной артподготовки войска Юго-Западного фронта перешли в наступление. Румынские позиции окутаны дымом, их организация подорвана.`,
      { immediate: [{ k: `org`, n: `ROM`, v: -25 }] },
    ),
    li(
      `u_south`,
      2,
      `Удар с юга`,
      `Сталинградский фронт прорвал оборону 4-й румынской армии. Мехкорпуса 51-й и 57-й армий идут на хутор Советский — навстречу вам.`,
    ),
    li(
      `u_hitler`,
      3,
      `Гитлер запрещает прорыв`,
      `Ставка Гитлера приказала 6-й армии держаться в Сталинграде. Геринг обещает снабжать её по воздуху — через аэродромы Питомник и Гумрак.`,
    ),
    li(
      `u_chir`,
      4,
      `Немцы латают фронт на Чире`,
      `Из Франции и с Кавказа спешно перебрасываются резервы. На реке Чир появились новые немецкие дивизии.`,
      {
        immediate: [
          {
            k: `spawn`,
            units: [
              oi(`arm`, `11-я танковая дивизия`, 9, 14, 7, { xp: 3 }),
              oi(`inf`, `336-я пехотная дивизия`, 11, 13, 9),
              oi(`inf`, `7-я авиаполевая дивизия`, 8, 13, 5),
              oi(`inf`, `62-я пехотная дивизия`, 8, 15, 8),
            ],
          },
        ],
      },
    ),
    li(
      `u_manst`,
      6,
      `Группа армий «Дон»`,
      `Командование деблокадой поручено фельдмаршалу Манштейну. Разведка докладывает о сосредоточении танков у Котельниково.`,
    ),
    li(
      `u_wg`,
      8,
      `«Зимняя гроза»`,
      `12 декабря 57-й танковый корпус Гота ударил от Котельниково на Сталинград. До котла — 120 километров. Из резерва Ставки выдвигается 2-я гвардейская армия Малиновского.`,
      {
        immediate: [
          {
            k: `spawn`,
            units: [
              si(`arm`, `6-я танковая дивизия`, 12, 20, 10, { xp: 2 }),
              si(`arm`, `23-я танковая дивизия`, 13, 20, 6),
              si(`inf`, `15-я авиаполевая дивизия`, 11, 20, 5),
              ai(`inf`, `1-й гвардейский стрелковый корпус`, 19, 15, 10, {
                guard: !0,
              }),
              ai(`inf`, `13-й гвардейский стрелковый корпус`, 20, 16, 10, {
                guard: !0,
              }),
              ai(`arm`, `2-й гвардейский механизированный корпус`, 20, 17, 9, {
                guard: !0,
              }),
            ],
          },
        ],
      },
    ),
    li(
      `u_sat`,
      9,
      `«Малый Сатурн»`,
      `16 декабря Юго-Западный фронт ударил по 8-й итальянской армии на Среднем Дону. Танковые корпуса идут на Тацинскую и Морозовск — в тыл Манштейну.`,
      {
        immediate: [
          {
            k: `spawn`,
            units: [
              ii(`arm`, `18-й танковый корпус`, 7, 2, 8),
              ii(`arm`, `25-й танковый корпус`, 6, 3, 8),
            ],
          },
          { k: `armyPost`, army: `G1A`, v: `off` },
        ],
      },
    ),
    {
      id: `u_h4b`,
      turn: 9,
      icon: `war`,
      immediate: [
        { k: `spawn`, units: [si(`arm`, `17-я танковая дивизия`, 11, 19, 6)] },
      ],
      views: {},
    },
    li(
      `u_g2off`,
      10,
      `Гвардия переходит в наступление`,
      `2-я гвардейская армия остановила танки Гота на реке Мышкова и переходит в контрнаступление на Котельниково.`,
      {
        immediate: [
          { k: `armyPost`, army: `G2A`, v: `off` },
          { k: `armyPost`, army: `A51`, v: `off` },
        ],
      },
    ),
    li(
      `u_retreat`,
      11,
      `Манштейн отступает`,
      `Угроза Ростову заставила Манштейна снять танковые дивизии с деблокады. 6-я армия обречена.`,
    ),
  ],
  di = [
    `snow`,
    `clear`,
    `snow`,
    `frost`,
    `clear`,
    `snow`,
    `frost`,
    `frost`,
    `snow`,
    `frost`,
    `frost`,
    `snow`,
  ],
  fi = (e) => e.s.units.filter((e) => e.army === `P6`),
  pi = (e) => gr(e.s, e.m, `Калач`) && gr(e.s, e.m, `Советский`),
  mi = (e) => {
    let t = F(e, `GER`);
    return fi(e).filter((e) => !t[e.hex]);
  };
function hi(e) {
  let t = e.s.career,
    n =
      (gr(e.s, e.m, `Питомник`, `GER`) ? 2 : 0) +
      +!!gr(e.s, e.m, `Гумрак`, `GER`) +
      +!t.f.tats;
  return (
    n && ct(e) === `snow` && n--,
    (t.f.block || 0) >= e.s.turn && (n -= 2),
    Math.max(0, n)
  );
}
function gi(e) {
  let t = e.s.career,
    n = pi(e);
  n &&
    !t.f.ring &&
    ((t.f.ring = e.s.turn),
    t.news.push({
      kind: `news`,
      title: `Кольцо замкнулось`,
      text: `Войска Юго-Западного и Сталинградского фронтов соединились у Калача и Советского. В котле — ${fi(e).length} дивизий 6-й армии. Теперь главное — не дать Манштейну их выручить.`,
    }));
  let r = t.f.ring && !n ? 1 : 0;
  (r &&
    !t.f.open &&
    t.news.push({
      kind: `news`,
      title: `Коридор к котлу!`,
      text: `Немцы отбили Калач или Советский и восстановили связь с окружённой группировкой. Ставка требует любой ценой снова замкнуть кольцо.`,
    }),
    (t.f.open = r));
  let i = n ? hi(e) : 0;
  for (let t of mi(e)
    .sort((e, t) => t.oos - e.oos || e.org - t.org)
    .slice(0, i))
    ((t.oos = Math.max(0, t.oos - 1)),
      (t.org = Math.min(it(e, t.nat), t.org + 6)));
  t.f.air = i;
}
var _i = {
    general: `Прокофий Романенко`,
    short: `Романенко`,
    rank: `генерал-лейтенант`,
    army: `TA5`,
    armyName: `5-я танковая армия`,
    hq: `Ставка`,
    role: `Командующий 5-й танковой армией`,
    armies: {
      TA5: { name: `5-я танковая армия`, general: `ген. П. Л. Романенко` },
      A21: { name: `21-я армия`, general: `ген. И. М. Чистяков`, post: `off` },
      A65: { name: `65-я армия`, general: `ген. П. И. Батов`, post: `def` },
      A24: { name: `24-я армия`, general: `ген. И. В. Галанин`, post: `def` },
      A66: { name: `66-я армия`, general: `ген. А. С. Жадов`, post: `def` },
      A62: { name: `62-я армия`, general: `ген. В. И. Чуйков`, post: `hold` },
      A64: { name: `64-я армия`, general: `ген. М. С. Шумилов`, post: `hold` },
      A57: { name: `57-я армия`, general: `ген. Ф. И. Толбухин`, post: `off` },
      A51: { name: `51-я армия`, general: `ген. Н. И. Труфанов`, post: `off` },
      G1A: {
        name: `1-я гвардейская армия`,
        general: `ген. В. И. Кузнецов`,
        post: `def`,
      },
      G2A: {
        name: `2-я гвардейская армия`,
        general: `ген. Р. Я. Малиновский`,
        post: `def`,
      },
    },
    start: { trust: 50, auth: 50, fame: 15 },
    sup0: 20,
    stars: { two: 3, three: 6, fame: 60 },
    intro: {
      title: `5-я танковая армия`,
      text: `19 ноября 1942 года. Вы — {rank} {name}, командующий 5-й танковой армией. С Серафимовичского плацдарма ваши танковые корпуса должны прорвать фронт румын, выйти к Калачу и вместе со Сталинградским фронтом замкнуть кольцо вокруг 6-й армии Паулюса. Затем — создать внешний фронт на реке Чир. Операция длится 12 ходов, до 22 декабря.`,
    },
    brief: `Ноябрь 1942 года. Немцы увязли в Сталинграде, их фланги держат слабые румынские армии. Ваша 5-я танковая армия наносит главный удар операции «Уран».`,
    standing: `Берегите войска: каждое потерянное соединение — Авторитет −6, Слава −2, Доверие −1. Уничтоженное вражеское — Авторитет +2 и Слава +3 (после четвёртого за операцию — +1). Каждые две успешные атаки — Слава +1.`,
    directives: [
      {
        id: `breach`,
        at: 1,
        turns: 2,
        kind: `wins`,
        need: 2,
        title: `Прорвать фронт румын`,
        goal: `Одержать 2 победы в атаках`,
        text: `Сокрушите оборону 3-й румынской армии и введите танковые корпуса в прорыв.`,
        reward: { trust: 5, auth: 3, fame: 6 },
        penalty: { trust: -4 },
      },
      {
        id: `kalach`,
        at: 1,
        turns: 4,
        kind: `take`,
        own: !0,
        city: `Калач`,
        title: `Мост у Калача`,
        goal: `Захватить Калач силами своей армии`,
        text: `Мост через Дон у Калача — ключ к окружению. Танковым корпусам — стремительно выйти к Калачу и захватить переправу.`,
        reward: { trust: 8, auth: 4, fame: 10 },
        penalty: { trust: -6, fame: -2 },
      },
      {
        id: `ring`,
        at: 3,
        turns: 4,
        kind: `reach`,
        need: 1,
        zone: cr([`Советский`], 1),
        title: `Сомкнуть кольцо`,
        goal: `Вывести соединение к хутору Советский`,
        text: `Навстречу вам идут мехкорпуса Сталинградского фронта. Когда Калач и хутор Советский будут в наших руках, кольцо вокруг 6-й армии замкнётся.`,
        reward: { trust: 8, fame: 10 },
        penalty: { trust: -6, fame: -2 },
      },
      {
        id: `chir`,
        at: 5,
        turns: 4,
        kind: `reach`,
        need: 3,
        zone: cr([`Обливская`, `Суровикино`], 1),
        title: `Внешний фронт на Чире`,
        goal: `Вывести 3 соединения к Обливской и Суровикино`,
        text: `Котёл нужно отгородить от немецких резервов. Создайте внешний фронт по реке Чир.`,
        reward: { trust: 6, auth: 3, fame: 5 },
        penalty: { trust: -5 },
      },
      {
        id: `nchir`,
        at: 7,
        turns: 4,
        kind: `take`,
        own: !0,
        city: `Нижне-Чирская`,
        title: `Плацдарм у Нижне-Чирской`,
        goal: `Взять Нижне-Чирскую силами своей армии`,
        text: `От Нижне-Чирской до котла — 40 километров. Немцы держат здесь плацдарм для деблокады. Ликвидируйте его.`,
        reward: { trust: 8, auth: 3, fame: 8 },
        penalty: { trust: -5 },
      },
      {
        id: `kills`,
        at: 8,
        turns: 4,
        kind: `kills`,
        need: 3,
        title: `Перемолоть резервы`,
        goal: `Разгромить 3 вражеских соединения`,
        text: `Манштейн бросает в бой последние резервы. Уничтожайте их по частям, пока они не прорвались к котлу.`,
        reward: { trust: 5, auth: 4, fame: 8 },
        penalty: { trust: -4 },
      },
      {
        id: `tormosin`,
        at: 10,
        turns: 3,
        kind: `take`,
        city: `Тормосин`,
        title: `Удар на Тормосин`,
        goal: `Взять Тормосин`,
        text: `Группировка Холлидта у Тормосина нависает над внешним фронтом. Вместе с соседями возьмите Тормосин.`,
        reward: { trust: 6, fame: 8 },
        penalty: { trust: -4 },
      },
    ],
    requests: [
      {
        id: `blockade`,
        icon: `plane`,
        title: `Воздушная блокада котла`,
        cost: 5,
        max: 2,
        desc: `Истребители 16-й и 8-й воздушных армий перехватят транспортные «юнкерсы»: воздушный мост к котлу два хода работает вполсилы.`,
        base: () => 55,
        avail: (e) => !!e.s.career.f.ring,
        why: () => `Кольцо ещё не замкнуто`,
        apply: (e) => (
          (e.s.career.f.block = e.s.turn + 1),
          `Истребители перехватывают транспортные самолёты: два хода котёл почти не получает грузов.`
        ),
      },
      {
        id: `raid`,
        icon: `sword`,
        title: `Рейд на Тацинскую`,
        cost: 8,
        max: 1,
        desc: `24-й танковый корпус Баданова прорвётся к аэродрому Тацинская — главной базе воздушного моста. Мост ослабнет навсегда, тылы врага понесут потери.`,
        base: () => 45,
        avail: (e) => e.s.turn >= 9,
        why: () => `Станет доступно с началом «Малого Сатурна» (9-й ход)`,
        apply: (e, t) => {
          let n = e.s.career;
          n.f.tats = 1;
          let r = _n(e, `Тацинская`),
            i = 0;
          for (let n of ur(e))
            r >= 0 &&
              f(e.m.g, n.hex, r) <= 3 &&
              ((n.org = Math.max(0, n.org - 25)),
              i++,
              t.push({
                t: `air`,
                nat: e.s.player,
                hex: n.hex,
                id: n.id,
                dStr: 0,
                dOrg: 25,
              }));
          return `Танкисты Баданова ворвались на аэродром Тацинская и уничтожили десятки транспортных самолётов. Воздушный мост к котлу ослаб навсегда${i ? `, потрёпано вражеских частей: ${i}` : ``}.`;
        },
      },
      B.reinf([`333-я стрелковая дивизия`, `258-я стрелковая дивизия`], {
        str: 8,
      }),
      B.tanks(`5-й механизированный корпус`, {
        str: 9,
        base: 40,
        type: `arm`,
        avail: (e) => e.s.turn >= 4,
        why: () => `Станет доступно с 4-го хода`,
      }),
      B.ammo(70, 15, 6),
      B.air((e) => (e.s.turn <= 2 ? 35 : 55), 3, 5),
      B.katyusha({ base: 55 }),
      B.delay(50),
    ],
    history: `Операция «Уран» началась 19 ноября 1942 года. 5-я танковая армия Романенко прорвала фронт 3-й румынской армии; 23 ноября 26-й танковый корпус захватил мост у Калача, и у хутора Советский войска Юго-Западного и Сталинградского фронтов соединились. В кольце оказались 22 дивизии 6-й армии Паулюса. Деблокадный удар Манштейна («Зимняя гроза») остановили на реке Мышкова, а «Малый Сатурн» сорвал его окончательно. 2 февраля 1943 года остатки 6-й армии капитулировали.`,
    awards: [
      { fame: 55, name: `Орден Суворова I степени` },
      { fame: 30, name: `Орден Суворова II степени` },
      { fame: 15, name: `Медаль «За оборону Сталинграда»` },
    ],
    promotion: `Присвоено звание генерал-полковника`,
  },
  vi = _r({
    id: `stalingrad42`,
    name: `Сталинград 1942`,
    subtitle: `Операция «Уран» · 5-я танковая армия`,
    map: `stalingrad42`,
    year: 1942,
    maxTurn: 12,
    date: tr(1942, 11, 19, 3),
    nations: [or(1942), ar(1942, { posture: `def` }), sr()],
    order: [`SOV`, `GER`, `ROM`],
    wars: [
      [`GER`, `SOV`],
      [`ROM`, `SOV`],
    ],
    alliances: [[`GER`, `ROM`]],
    units: ci,
    events: ui,
    career: _i,
    forts: [
      { at: [18, 11], lvl: 2 },
      { at: [17, 11], lvl: 1 },
      { at: [18, 10], lvl: 1 },
      { at: [19, 10], lvl: 1 },
      { at: [18, 12], lvl: 1 },
    ],
    weather: (e) => di[Math.min(di.length, e) - 1],
    unitPosture: (e, t) =>
      t.army === `P6`
        ? `hold`
        : t.army === `H4`
          ? e.s.turn <= 10
            ? `off`
            : `def`
          : void 0,
    aiTargetFilter: (e, t, n, r) =>
      n === `GER`
        ? f(t.g, r, t.cities.find((e) => e.name === `Советский`).hex) <= 6
        : n !== `SOV` ||
          !(
            e.career?.dirs.some(
              (e) => e.id === `kalach` && e.status === `active`,
            ) && r === t.cities.find((e) => e.name === `Калач`).hex
          ),
    turnEnd: gi,
    end: (e, t) => {
      let n = e.units.filter((e) => e.army === `P6`).length,
        r = e.career;
      return r.f.ring
        ? r.f.open
          ? {
              title: `Котёл деблокирован`,
              text: `Манштейн пробил коридор к 6-й армии. Победа под Сталинградом ускользает.`,
            }
          : {
              title: `6-я армия обречена`,
              text: `Кольцо вокруг группировки Паулюса держится, деблокада сорвана. В котле осталось ${n} немецких дивизий — их судьба решена.`,
            }
        : {
            title: `Кольцо не замкнуто`,
            text: `6-я армия сохранила связь с тылом. Сталинградская группировка врага уцелела — Ставке придётся начинать всё сначала.`,
          };
    },
  }),
  yi = z(`SOV`, `A13`),
  bi = z(`SOV`, `TA2`),
  xi = z(`SOV`, `A48`),
  Si = z(`SOV`, `A70`),
  Ci = z(`SOV`, `A65`),
  wi = z(`SOV`, `A60`),
  Ti = z(`SOV`, `BRN`),
  Ei = z(`SOV`, `ZAP`),
  Di = z(`GER`, `G9`),
  G = z(`GER`),
  Oi = [
    yi(`inf`, `81-я стрелковая дивизия`, 12, 14, 9),
    yi(`inf`, `15-я стрелковая дивизия`, 11, 14, 9),
    yi(`inf`, `148-я стрелковая дивизия`, 13, 14, 8),
    yi(`inf`, `307-я стрелковая дивизия`, 12, 15, 9, { xp: 2 }),
    yi(`inf`, `70-я гвардейская стрелковая дивизия`, 11, 15, 9, {
      guard: !0,
      xp: 4,
    }),
    yi(`inf`, `75-я гвардейская стрелковая дивизия`, 12, 16, 8, {
      guard: !0,
      xp: 4,
    }),
    bi(`arm`, `16-й танковый корпус`, 11, 16, 9),
    bi(`arm`, `3-й танковый корпус`, 13, 16, 8),
    bi(`arm`, `19-й танковый корпус`, 10, 17, 8),
    xi(`inf`, `73-я стрелковая дивизия`, 13, 13, 8),
    xi(`inf`, `137-я стрелковая дивизия`, 15, 12, 8),
    xi(`inf`, `16-я стрелковая дивизия`, 14, 13, 8),
    Si(`inf`, `132-я стрелковая дивизия`, 10, 14, 8),
    Si(`inf`, `280-я стрелковая дивизия`, 9, 14, 8),
    Si(`inf`, `102-я стрелковая дивизия`, 8, 14, 8),
    Ci(`inf`, `69-я стрелковая дивизия`, 7, 14, 8),
    Ci(`inf`, `37-я гвардейская стрелковая дивизия`, 6, 14, 8, { guard: !0 }),
    wi(`inf`, `121-я стрелковая дивизия`, 4, 15, 7),
    wi(`inf`, `141-я стрелковая дивизия`, 4, 17, 7),
    Ti(`inf`, `5-я стрелковая дивизия`, 16, 6, 8),
    Ti(`inf`, `380-я стрелковая дивизия`, 16, 8, 8),
    Ti(`inf`, `129-я стрелковая дивизия`, 16, 10, 8),
    Ti(`arm`, `1-й гвардейский танковый корпус`, 17, 9, 8, { guard: !0 }),
    Ei(`inf`, `8-й гвардейский стрелковый корпус`, 10, 1, 10, { guard: !0 }),
    Ei(`inf`, `16-й гвардейский стрелковый корпус`, 11, 1, 10, { guard: !0 }),
    Ei(`arm`, `5-й танковый корпус`, 12, 1, 8),
    Ei(`inf`, `36-й гвардейский стрелковый корпус`, 13, 2, 9, { guard: !0 }),
    Di(`arm`, `20-я танковая дивизия`, 10, 13, 8),
    Di(`arm`, `2-я танковая дивизия`, 11, 13, 9),
    Di(`arm`, `9-я танковая дивизия`, 11, 12, 9),
    Di(`arm`, `18-я танковая дивизия`, 12, 12, 8),
    Di(`arm`, `4-я танковая дивизия`, 10, 12, 8),
    Di(`arm`, `656-й полк «Фердинандов»`, 12, 13, 7, { xp: 3 }),
    Di(`inf`, `86-я пехотная дивизия`, 13, 12, 9),
    Di(`inf`, `292-я пехотная дивизия`, 14, 12, 9),
    Di(`inf`, `7-я пехотная дивизия`, 9, 13, 9),
    Di(`inf`, `258-я пехотная дивизия`, 8, 13, 8),
    Di(`inf`, `78-я штурмовая дивизия`, 14, 11, 9),
    Di(`mot`, `10-я моторизованная дивизия`, 9, 12, 8),
    G(`inf`, `6-я пехотная дивизия`, 7, 13, 8),
    G(`arm`, `12-я танковая дивизия`, 6, 12, 7),
    G(`inf`, `36-я пехотная дивизия`, 5, 13, 8),
    G(`inf`, `262-я пехотная дивизия`, 14, 5, 8),
    G(`inf`, `211-я пехотная дивизия`, 15, 7, 8),
    G(`inf`, `56-я пехотная дивизия`, 15, 9, 8),
    G(`inf`, `34-я пехотная дивизия`, 14, 10, 8),
    G(`inf`, `293-я пехотная дивизия`, 10, 2, 8),
    G(`arm`, `5-я танковая дивизия`, 12, 2, 7),
    G(`inf`, `112-я пехотная дивизия`, 13, 3, 8),
    G(`inf`, `208-я пехотная дивизия`, 9, 2, 8),
    G(`inf`, `Гарнизон Орла`, 11, 8, 8),
    G(`inf`, `Гарнизон Болхова`, 10, 3, 6),
  ],
  ki = (e, t, n, r, i = {}) => ({
    id: e,
    turn: t,
    icon: `news`,
    views: {
      SOV: {
        title: n,
        text: r,
        options: [{ label: `Принято`, desc: ``, effects: [] }],
      },
    },
    ...i,
  }),
  Ai = [
    ki(
      `k_start`,
      1,
      `Операция «Цитадель»`,
      `На рассвете 5 июля 9-я армия Моделя перешла в наступление на северном фасе Курской дуги. Против вашей 13-й армии — сотни танков, среди них новые «Тигры» и «Фердинанды». Наша оборона — восемь полос траншей и минных полей.`,
    ),
    ki(
      `k_prokh`,
      3,
      `Прохоровка`,
      `12 июля под Прохоровкой, на южном фасе дуги, произошло крупнейшее танковое сражение. В тот же день Западный и Брянский фронты начали операцию «Кутузов» — удар по Орловскому выступу.`,
      {
        immediate: [
          { k: `armyPost`, army: `BRN`, v: `off` },
          { k: `armyPost`, army: `ZAP`, v: `off` },
        ],
      },
    ),
    ki(
      `k_stop`,
      4,
      `Модель остановился`,
      `Немцы выдохлись: 9-я армия переходит к обороне и перебрасывает танковые дивизии на север, против Западного фронта. Центральный фронт готовится к контрнаступлению.`,
      {
        immediate: [
          { k: `org`, n: `SOV`, v: 10 },
          {
            k: `spawn`,
            units: [
              G(`mot`, `Дивизия «Великая Германия»`, 12, 5, 9, { xp: 2 }),
              G(`arm`, `8-я танковая дивизия`, 11, 4, 8),
              G(`inf`, `253-я пехотная дивизия`, 14, 8, 8),
            ],
          },
        ],
      },
    ),
    ki(
      `k_res`,
      6,
      `Резервы Ставки`,
      `Центральному фронту передана 3-я гвардейская танковая армия Рыбалко. Она наступает на Орёл с востока.`,
      {
        immediate: [
          {
            k: `spawn`,
            units: [
              z(`SOV`, `GTA3`)(`arm`, `12-й танковый корпус`, 19, 9, 9),
              z(`SOV`, `GTA3`)(`arm`, `15-й танковый корпус`, 19, 10, 9),
              z(`SOV`, `GTA3`)(`mot`, `2-й механизированный корпус`, 20, 10, 8),
            ],
          },
          { k: `armyPost`, army: `GTA3`, v: `off` },
        ],
      },
    ),
    ki(
      `k_hagen`,
      8,
      `Линия «Хаген»`,
      `Гитлер разрешил оставить Орловский выступ: немцы отходят на линию «Хаген» у Брянска, оставляя арьергарды в городах.`,
    ),
    ki(
      `k_rain`,
      7,
      `Дожди`,
      `Начались дожди, грунтовые дороги развезло. Танкам тяжело, авиация летает меньше.`,
    ),
  ],
  ji = [
    `clear`,
    `clear`,
    `clear`,
    `clear`,
    `clear`,
    `rain`,
    `rain`,
    `clear`,
    `clear`,
    `rain`,
    `clear`,
    `clear`,
  ],
  Mi = {
    general: `Николай Пухов`,
    short: `Пухов`,
    rank: `генерал-лейтенант`,
    army: `A13`,
    armyName: `13-я армия`,
    hq: `Ставка`,
    role: `Командующий ударной группировкой Центрального фронта`,
    armies: {
      A13: { name: `13-я армия`, general: `ген. Н. П. Пухов` },
      TA2: { name: `2-я танковая армия`, general: `ген. А. Г. Родин` },
      A48: { name: `48-я армия`, general: `ген. П. Л. Романенко`, post: `def` },
      A70: { name: `70-я армия`, general: `ген. И. В. Галанин`, post: `def` },
      A65: { name: `65-я армия`, general: `ген. П. И. Батов`, post: `def` },
      A60: {
        name: `60-я армия`,
        general: `ген. И. Д. Черняховский`,
        post: `def`,
      },
      BRN: { name: `Брянский фронт`, general: `ген. М. М. Попов`, post: `def` },
      ZAP: {
        name: `Западный фронт`,
        general: `ген. В. Д. Соколовский`,
        post: `def`,
      },
      GTA3: {
        name: `3-я гвардейская танковая армия`,
        general: `ген. П. С. Рыбалко`,
        post: `off`,
      },
    },
    front: [`A48`, `A70`, `A65`, `A60`],
    also: [`TA2`],
    start: { trust: 55, auth: 55, fame: 20 },
    sup0: 22,
    stars: { two: 3, three: 5, fame: 60 },
    intro: {
      title: `Северный фас Курской дуги`,
      text: `5 июля 1943 года. Вы — {rank} {name}. Под вашим командованием 13-я армия, принимающая главный удар 9-й армии Моделя, и 2-я танковая армия в резерве. Соседним армиям фронта — 48-й, 70-й, 65-й и 60-й — вы отдаёте приказы: обороняться, держаться или наступать. Измотайте врага в обороне, затем переходите в контрнаступление на Кромы и Орёл. Операция длится 12 ходов, до 7 августа.`,
    },
    brief: `Июль 1943 года. Немцы готовят последнее большое наступление на Восточном фронте. Вы командуете ударной группировкой Центрального фронта на направлении главного удара.`,
    standing: `Берегите войска: каждое потерянное соединение — Авторитет −6, Слава −2, Доверие −1. Уничтоженное вражеское — Авторитет +2 и Слава +3 (после четвёртого за операцию — +1). Каждые две успешные атаки — Слава +1.`,
    directives: [
      {
        id: `ponyri`,
        at: 1,
        turns: 3,
        kind: `hold`,
        city: `Поныри`,
        title: `Поныри — «Сталинград на Курской дуге»`,
        goal: `Удержать станцию Поныри`,
        text: `Станция Поныри — ключ к обороне на направлении главного удара. Держать любой ценой.`,
        reward: { trust: 8, fame: 8 },
        penalty: { trust: -7, fame: -2 },
      },
      {
        id: `olkh`,
        at: 1,
        turns: 4,
        kind: `keep`,
        zone: cr([`Ольховатка`], 1),
        title: `Ольховатские высоты`,
        goal: `Не пустить врага на высоты у Ольховатки`,
        text: `С высот у Ольховатки просматривается всё до Курска. Если немцы ворвутся на высоты — выбейте их до конца хода.`,
        reward: { trust: 8, auth: 3, fame: 6 },
        penalty: { trust: -6, fame: -2 },
      },
      {
        id: `kills`,
        at: 1,
        turns: 4,
        kind: `kills`,
        need: 3,
        title: `Перемолоть танки Моделя`,
        goal: `Разгромить 3 вражеских соединения`,
        text: `Пусть немецкие танки горят на наших минных полях и противотанковых рубежах. Бейте их контратаками во фланг.`,
        reward: { trust: 4, auth: 4, fame: 8 },
        penalty: { trust: -4 },
      },
      {
        id: `counter`,
        at: 5,
        turns: 2,
        kind: `wins`,
        need: 3,
        title: `Контрнаступление`,
        goal: `Одержать 3 победы в атаках`,
        text: `Враг выдохся. Центральный фронт переходит в контрнаступление на Орёл — бейте, не давайте закрепиться.`,
        reward: { trust: 6, auth: 4, fame: 6 },
        penalty: { trust: -5 },
        onIssue: (e) => {
          let t = e.s.career;
          return (
            (t.atkUntil = e.s.turn + 1),
            (t.atkV = 0.15),
            (t.atkLbl = `Контрнаступление`),
            `Два хода ваши войска атакуют на 15% сильнее.`
          );
        },
      },
      {
        id: `kromy`,
        at: 6,
        turns: 5,
        kind: `take`,
        own: !0,
        city: `Кромы`,
        title: `Удар на Кромы`,
        goal: `Освободить Кромы силами своих армий`,
        text: `Удар на Кромы рассечёт Орловскую группировку и выведет фронт в тыл немцам под Орлом.`,
        reward: { trust: 8, auth: 4, fame: 8 },
        penalty: { trust: -6 },
      },
      {
        id: `orel`,
        at: 7,
        turns: 6,
        kind: `take`,
        city: `Орёл`,
        title: `Освободить Орёл`,
        goal: `Освободить Орёл вместе с соседними фронтами`,
        text: `Ставка требует освободить Орёл. Если город возьмут ваши войска — слава достанется вам.`,
        reward: { trust: 8, fame: 8 },
        penalty: { trust: -5 },
        bonusCity: `Орёл`,
        bonusOwn: !0,
        bonus: { fame: 10, trust: 4 },
        bonusText: `Первый салют: Орёл освобождён вашими войсками`,
      },
    ],
    requests: [
      {
        id: `counterprep`,
        icon: `fame`,
        title: `Артиллерийская контрподготовка`,
        cost: 4,
        max: 1,
        instant: !0,
        desc: `Разведка знает час удара. Сейчас же накрыть артиллерией изготовившиеся к атаке войска врага: организация −20…30, часть теряет силу. Ответ — немедленно.`,
        base: () => 75,
        avail: (e) => e.s.turn === 1,
        why: () => `Возможно только в первый ход`,
        apply: (e, t) =>
          `В 2:20 ночи заговорили тысячи орудий. Удар пришёлся по изготовившимся к атаке войскам: накрыто соединений — ${mr(e, t, 2, 25, 0.35)}. Наступление врага начнётся с опозданием и потерями.`,
      },
      B.fortify({
        base: 65,
        max: 2,
        avail: (e) => e.s.turn <= 4,
        why: () => `Время на инженерные работы прошло`,
      }),
      B.arty({
        base: 55,
        max: 2,
        title: `4-й артиллерийский корпус прорыва`,
        label: `Артиллерия прорыва`,
        v: 0.2,
        desc: `Артиллерийский корпус прорыва: атаки ваших войск сильнее на 20% в следующем ходу.`,
      }),
      B.tanks(`9-й танковый корпус`, {
        str: 9,
        base: 45,
        avail: (e) => e.s.turn >= 3,
        why: () => `Станет доступно с 3-го хода`,
      }),
      B.reinf(
        [
          `4-я гвардейская воздушно-десантная дивизия`,
          `162-я стрелковая дивизия`,
        ],
        { str: 8 },
      ),
      B.ammo(70, 15, 6),
      B.air(() => 55, 2, 5),
      B.katyusha({ base: 55 }),
      B.delay(50),
    ],
    history: `На северном фасе Курской дуги 9-я армия Моделя за неделю продвинулась лишь на 10–12 км: оборона Центрального фронта Рокоссовского у Понырей и Ольховатки устояла. 12 июля Западный и Брянский фронты начали операцию «Кутузов», 15 июля в контрнаступление перешёл Центральный фронт. 5 августа были освобождены Орёл и Белгород — в их честь в Москве прогремел первый артиллерийский салют.`,
    awards: [
      { fame: 60, name: `Орден Суворова I степени` },
      { fame: 35, name: `Орден Кутузова I степени` },
      { fame: 15, name: `Орден Красного Знамени` },
    ],
    promotion: `Присвоено звание генерал-полковника`,
  },
  Ni = _r({
    id: `kursk43`,
    name: `Курск 1943`,
    subtitle: `Курская дуга · 13-я армия`,
    map: `kursk43`,
    year: 1943,
    maxTurn: 12,
    date: tr(1943, 7, 5, 3),
    nations: [ar(1943, { posture: `def` }), or(1943)],
    order: [`GER`, `SOV`],
    wars: [[`GER`, `SOV`]],
    units: Oi,
    events: Ai,
    career: Mi,
    init: (e) => {
      for (let t of e.units)
        t.nat === `SOV` &&
          [`A13`, `A48`, `A70`, `A65`, `A60`].includes(t.army || ``) &&
          (t.entrench = 2);
    },
    forts: [
      { at: [12, 15], lvl: 2 },
      { at: [11, 15], lvl: 2 },
      { at: [12, 14], lvl: 1 },
      { at: [11, 14], lvl: 1 },
      { at: [13, 14], lvl: 1 },
      { at: [13, 13], lvl: 1 },
      { at: [10, 14], lvl: 1 },
      { at: [12, 16], lvl: 1 },
      { at: [11, 8], lvl: 2 },
      { at: [9, 11], lvl: 1 },
      { at: [10, 3], lvl: 1 },
    ],
    weather: (e) => ji[Math.min(ji.length, e) - 1],
    unitPosture: (e, t) =>
      t.army === `G9` ? (e.s.turn <= 3 ? `off` : `def`) : void 0,
    aiTargetFilter: (e, t, n, r) =>
      n !== `GER` || Math.floor(r / t.g.cols) >= 13,
    end: (e, t) =>
      gr(e, t, `Орёл`)
        ? {
            title: `Орёл освобождён`,
            text: `Орловский выступ ликвидирован. В честь освобождения Орла и Белгорода Москва салютует доблестным войскам.`,
          }
        : {
            title: `«Цитадель» провалилась`,
            text: `Немецкое наступление на северном фасе остановлено, но Орёл пока в руках врага.`,
          },
  }),
  Pi = z(`SOV`, `A65`),
  Fi = z(`SOV`, `A28`),
  Ii = z(`SOV`, `KMG`),
  Li = z(`SOV`, `A48`),
  Ri = z(`SOV`, `A3`),
  zi = z(`SOV`, `BEL2`),
  Bi = z(`SOV`, `BEL3`),
  K = z(`GER`),
  Vi = z(`GER`, `FP`),
  Hi = [
    Pi(`inf`, `18-й стрелковый корпус`, 16, 17, 10, { xp: 3 }),
    Pi(`inf`, `105-й стрелковый корпус`, 15, 17, 10, { xp: 3 }),
    Pi(`inf`, `356-я стрелковая дивизия`, 17, 17, 8),
    Pi(`inf`, `44-я гвардейская стрелковая дивизия`, 14, 18, 9, {
      guard: !0,
      xp: 4,
    }),
    Pi(`arm`, `1-й гвардейский танковый корпус`, 16, 18, 10, {
      guard: !0,
      xp: 5,
    }),
    Fi(`inf`, `3-й гвардейский стрелковый корпус`, 13, 18, 10, { guard: !0 }),
    Fi(`inf`, `128-й стрелковый корпус`, 12, 19, 9),
    Fi(`inf`, `20-й стрелковый корпус`, 11, 19, 9),
    Ii(`cav`, `4-й гвардейский кавалерийский корпус`, 10, 19, 9, { guard: !0 }),
    Ii(`arm`, `1-й механизированный корпус`, 10, 20, 9),
    Li(`inf`, `42-й стрелковый корпус`, 17, 16, 9),
    Li(`inf`, `29-й стрелковый корпус`, 17, 15, 9),
    Li(`inf`, `53-й стрелковый корпус`, 18, 14, 8),
    Ri(`inf`, `35-й стрелковый корпус`, 18, 12, 9),
    Ri(`inf`, `41-й стрелковый корпус`, 17, 13, 9),
    Ri(`arm`, `9-й танковый корпус`, 19, 13, 9),
    Ri(`inf`, `80-й стрелковый корпус`, 18, 11, 9),
    zi(`inf`, `69-й стрелковый корпус`, 22, 4, 9),
    zi(`inf`, `70-й стрелковый корпус`, 22, 5, 9),
    zi(`inf`, `121-й стрелковый корпус`, 22, 6, 9),
    zi(`inf`, `38-й стрелковый корпус`, 21, 7, 8),
    Bi(`arm`, `5-я гвардейская танковая армия`, 22, 1, 10, { guard: !0 }),
    Bi(`inf`, `11-я гвардейская армия`, 22, 2, 10, { guard: !0 }),
    Bi(`inf`, `31-я армия`, 22, 3, 9),
    Bi(`arm`, `3-й гвардейский механизированный корпус`, 23, 2, 9, {
      guard: !0,
    }),
    K(`inf`, `35-я пехотная дивизия`, 15, 16, 8),
    K(`inf`, `36-я пехотная дивизия`, 16, 16, 8),
    K(`inf`, `129-я пехотная дивизия`, 14, 17, 8),
    K(`inf`, `102-я пехотная дивизия`, 13, 17, 7),
    K(`inf`, `292-я пехотная дивизия`, 12, 18, 7),
    K(`inf`, `Охранная группа «Припять»`, 10, 18, 4),
    K(`inf`, `6-я пехотная дивизия`, 16, 15, 8),
    K(`inf`, `296-я пехотная дивизия`, 17, 14, 8),
    K(`inf`, `45-я пехотная дивизия`, 16, 13, 8),
    K(`inf`, `383-я пехотная дивизия`, 17, 12, 8),
    K(`inf`, `134-я пехотная дивизия`, 17, 11, 8),
    Vi(`inf`, `Крепость Бобруйск (707-я дивизия)`, 14, 12, 7),
    K(`arm`, `20-я танковая дивизия`, 14, 13, 7),
    Vi(`inf`, `Крепость Могилёв (12-я пехотная дивизия)`, 20, 4, 8),
    K(`inf`, `31-я пехотная дивизия`, 21, 5, 7),
    K(`inf`, `267-я пехотная дивизия`, 21, 6, 7),
    K(`inf`, `57-я пехотная дивизия`, 20, 7, 7),
    K(`mot`, `Дивизия «Фельдхернхалле»`, 19, 8, 8),
    K(`inf`, `110-я пехотная дивизия`, 19, 9, 7),
    K(`inf`, `337-я пехотная дивизия`, 19, 10, 7),
    K(`inf`, `78-я штурмовая дивизия`, 21, 1, 8),
    K(`inf`, `260-я пехотная дивизия`, 21, 2, 7),
    K(`mot`, `25-я моторизованная дивизия`, 21, 3, 7),
    K(`inf`, `Гарнизон Минска`, 4, 4, 4),
    K(`inf`, `Охранная дивизия «Осиповичи»`, 10, 11, 4),
  ],
  Ui = (e, t, n, r, i = {}) => ({
    id: e,
    turn: t,
    icon: `news`,
    views: {
      SOV: {
        title: n,
        text: r,
        options: [{ label: `Принято`, desc: ``, effects: [] }],
      },
    },
    ...i,
  }),
  Wi = [
    Ui(
      `b_start`,
      1,
      `Операция «Багратион»`,
      `Три года назад отсюда враг шёл на Москву. Теперь четыре фронта начали освобождение Белоруссии. Накануне партизаны взорвали тысячи рельсов — немецкие резервы застряли на станциях.`,
      { immediate: [{ k: `org`, n: `GER`, v: -15 }] },
    ),
    Ui(
      `b_res`,
      3,
      `Немцы бросают резервы`,
      `С Украины спешно перебрасываются танковые дивизии. 12-я танковая идёт к Осиповичам, 5-я — к Борисову.`,
      {
        immediate: [
          {
            k: `spawn`,
            units: [
              K(`arm`, `12-я танковая дивизия`, 10, 10, 8),
              K(`arm`, `5-я танковая дивизия`, 9, 1, 9, { xp: 3 }),
              K(`arm`, `505-й батальон «Тигров»`, 8, 2, 6, { xp: 3 }),
            ],
          },
        ],
      },
    ),
    Ui(
      `b_vit`,
      3,
      `Витебский котёл`,
      `3-й Белорусский фронт окружил под Витебском пять немецких дивизий. Танковая армия Ротмистрова рвётся к Борисову.`,
    ),
    Ui(
      `b_mog`,
      4,
      `Форсирован Днепр`,
      `2-й Белорусский фронт форсировал Днепр и обходит Могилёв. Немецкая 4-я армия отходит к Березине.`,
    ),
    Ui(
      `b_gap`,
      6,
      `Брешь в 400 километров`,
      `Группа армий «Центр» разгромлена: в немецком фронте зияет брешь. Немцы собирают всё, что можно, для обороны Минска и Барановичей.`,
      {
        immediate: [
          {
            k: `spawn`,
            units: [
              K(`arm`, `4-я танковая дивизия`, 0, 8, 8),
              K(`inf`, `28-я лёгкая пехотная дивизия`, 1, 0, 7),
            ],
          },
        ],
      },
    ),
  ],
  Gi = [
    `clear`,
    `clear`,
    `clear`,
    `rain`,
    `clear`,
    `clear`,
    `clear`,
    `rain`,
    `clear`,
    `clear`,
  ],
  Ki = (e) => {
    let t = _n(e, `Бобруйск`),
      n = F(e, `GER`);
    return e.s.units.filter(
      (r) => r.nat === `GER` && t >= 0 && f(e.m.g, r.hex, t) <= 3 && !n[r.hex],
    );
  };
function qi(e) {
  let t = e.s.career;
  (!t.f.bob &&
    Ki(e).length >= 2 &&
    ((t.f.bob = e.s.turn),
    t.news.push({
      kind: `news`,
      title: `Бобруйский котёл`,
      text: `Под Бобруйском окружена крупная группировка 9-й немецкой армии. Штурмовики 16-й воздушной армии бомбят скопления войск у переправ через Березину.`,
    })),
    !t.f.minsk &&
      gr(e.s, e.m, `Минск`) &&
      ((t.f.minsk = e.s.turn),
      t.news.push({
        kind: `news`,
        title: `Минск свободен!`,
        text: `Танкисты ворвались в столицу Белоруссии. Восточнее Минска в кольце — основные силы немецкой 4-й армии.`,
      })));
}
var Ji = {
    general: `Павел Батов`,
    short: `Батов`,
    rank: `генерал-полковник`,
    army: `A65`,
    armyName: `65-я армия`,
    hq: `Ставка`,
    role: `Командующий 65-й армией`,
    armies: {
      A65: { name: `65-я армия`, general: `ген. П. И. Батов` },
      A28: { name: `28-я армия`, general: `ген. А. А. Лучинский`, post: `off` },
      KMG: {
        name: `Конно-механизированная группа`,
        general: `ген. И. А. Плиев`,
        post: `off`,
      },
      A48: { name: `48-я армия`, general: `ген. П. Л. Романенко`, post: `off` },
      A3: { name: `3-я армия`, general: `ген. А. В. Горбатов`, post: `off` },
      BEL2: {
        name: `2-й Белорусский фронт`,
        general: `ген. Г. Ф. Захаров`,
        post: `off`,
      },
      BEL3: {
        name: `3-й Белорусский фронт`,
        general: `ген. И. Д. Черняховский`,
        post: `off`,
      },
    },
    start: { trust: 55, auth: 55, fame: 25 },
    sup0: 22,
    stars: { two: 3, three: 6, fame: 65 },
    intro: {
      title: `65-я армия в «Багратионе»`,
      text: `24 июня 1944 года. Вы — {rank} {name}, командующий 65-й армией 1-го Белорусского фронта. Ваши войска стоят перед болотами южнее Паричей — немцы считают их непроходимыми. Прорвите фронт, окружите Бобруйск вместе с 3-й армией и идите на Минск. Операция длится 10 ходов, до 12 июля.`,
    },
    brief: `Лето 1944 года. Красная армия наносит удар по группе армий «Центр» в Белоруссии. Вы наступаете через болота на Бобруйск.`,
    standing: `Берегите войска: каждое потерянное соединение — Авторитет −6, Слава −2, Доверие −1. Уничтоженное вражеское — Авторитет +2 и Слава +3 (после четвёртого за операцию — +1). Каждые две успешные атаки — Слава +1.`,
    directives: [
      {
        id: `parichi`,
        at: 1,
        turns: 2,
        kind: `wins`,
        need: 3,
        title: `Прорыв через болота`,
        goal: `Одержать 3 победы в атаках`,
        text: `Сапёры проложили гати через болота. Прорвите оборону 9-й армии там, где враг не ждёт удара.`,
        reward: { trust: 5, auth: 3, fame: 5 },
        penalty: { trust: -4 },
      },
      {
        id: `ring_bob`,
        at: 2,
        turns: 3,
        kind: `reach`,
        need: 3,
        zone: lr(`Бобруйск`, 1, 2),
        title: `Бобруйский котёл`,
        goal: `Вывести 3 соединения на подступы к Бобруйску`,
        text: `Танковый корпус — в прорыв, на Бобруйск! Вместе с 3-й армией замкните кольцо вокруг 9-й армии.`,
        reward: { trust: 6, fame: 6 },
        penalty: { trust: -5 },
      },
      {
        id: `bobruisk`,
        at: 3,
        turns: 4,
        kind: `take`,
        own: !0,
        city: `Бобруйск`,
        title: `Освободить Бобруйск`,
        goal: `Освободить Бобруйск силами своей армии`,
        text: `Гитлер объявил Бобруйск «крепостью». Штурмуйте город, пока окружённые не опомнились.`,
        reward: { trust: 8, auth: 4, fame: 8 },
        penalty: { trust: -6 },
      },
      {
        id: `kills`,
        at: 3,
        turns: 4,
        kind: `kills`,
        need: 3,
        title: `Уничтожить окружённых`,
        goal: `Разгромить 3 вражеских соединения`,
        text: `Окружённые немецкие дивизии пытаются прорваться к своим. Не выпустить ни одной!`,
        reward: { trust: 4, auth: 4, fame: 6 },
        penalty: { trust: -4 },
      },
      {
        id: `osip`,
        at: 4,
        turns: 4,
        kind: `take`,
        own: !0,
        city: `Осиповичи`,
        title: `На Осиповичи`,
        goal: `Освободить Осиповичи силами своей армии`,
        text: `Не задерживайтесь у Бобруйска: подвижные войска — на Осиповичи, по дороге на Минск. Отрежьте немцам пути отхода.`,
        reward: { trust: 6, auth: 3, fame: 6 },
        penalty: { trust: -4 },
      },
      {
        id: `minsk`,
        at: 5,
        turns: 6,
        kind: `take`,
        city: `Минск`,
        title: `Освободить Минск`,
        goal: `Освободить Минск вместе с соседями`,
        text: `Столица Белоруссии ждёт освобождения. Если первыми в Минск войдут ваши войска — слава достанется вам.`,
        reward: { trust: 8, fame: 8 },
        penalty: { trust: -5 },
        bonusCity: `Минск`,
        bonusOwn: !0,
        bonus: { fame: 10, trust: 4 },
        bonusText: `Ваши танкисты первыми ворвались в Минск`,
      },
    ],
    requests: [
      {
        id: `twomain`,
        icon: `tele`,
        title: `Два главных удара`,
        cost: 6,
        max: 1,
        instant: !0,
        desc: `Настоять перед Сталиным на своём плане: наносить два главных удара. Если Ставка согласится, 28-я армия и конно-механизированная группа Плиева перейдут под ваше командование. Ответ — немедленно.`,
        base: () => 55,
        avail: (e) => e.s.turn <= 2,
        why: () => `Решение принимается в первые дни операции`,
        apply: (e) => {
          let t = e.s.career;
          for (let e of [`A28`, `KMG`]) t.cmd.includes(e) || t.cmd.push(e);
          return `«Настойчивость командующего — доказательство продуманности плана». Сталин утвердил два главных удара: 28-я армия и группа Плиева переходят под ваше командование.`;
        },
      },
      B.partisans({ base: 65, max: 2, title: `«Рельсовая война»` }),
      B.air(() => 65, 3, 5),
      B.arty({
        base: 55,
        max: 2,
        v: 0.2,
        desc: `Артиллерийская дивизия прорыва: атаки ваших войск сильнее на 20% в следующем ходу.`,
      }),
      B.tanks(`9-й танковый корпус`, {
        str: 9,
        base: 40,
        avail: (e) => e.s.turn >= 3,
        why: () => `Станет доступно с 3-го хода`,
        desc: `Танковый корпус из резерва фронта (сила 9) перейдёт в ваше подчинение.`,
      }),
      B.reinf([`193-я стрелковая дивизия`, `15-я стрелковая дивизия`], {
        str: 8,
      }),
      B.ammo(70, 15, 6),
      B.katyusha({ base: 60 }),
      B.delay(50),
    ],
    history: `Операция «Багратион» началась 23–24 июня 1944 года. 65-я армия Батова прошла через «непроходимые» болота южнее Паричей, 1-й гвардейский танковый корпус вышел к Бобруйску, и 27 июня в кольце оказались около 40 тысяч немцев; 29 июня Бобруйск был освобождён. 3 июля танкисты ворвались в Минск, восточнее которого окружили 100-тысячную группировку. Группа армий «Центр» потеряла 28 дивизий — это было крупнейшее поражение вермахта.`,
    awards: [
      { fame: 65, name: `Орден Суворова I степени` },
      { fame: 40, name: `Орден Ленина` },
      { fame: 20, name: `Орден Кутузова I степени` },
    ],
    promotion: `Присвоено звание генерала армии`,
  },
  Yi = _r({
    id: `bagration44`,
    name: `Белоруссия 1944`,
    subtitle: `Операция «Багратион» · 65-я армия`,
    map: `bagration44`,
    year: 1944,
    maxTurn: 10,
    date: tr(1944, 6, 24, 2),
    nations: [or(1944), ar(1944, { posture: `def` })],
    order: [`SOV`, `GER`],
    wars: [[`GER`, `SOV`]],
    units: Hi,
    events: Wi,
    career: Ji,
    init: (e) => {
      for (let t of e.units) t.nat === `GER` && (t.entrench = 1);
    },
    forts: [
      { at: [15, 16], lvl: 1 },
      { at: [17, 14], lvl: 1 },
      { at: [16, 13], lvl: 1 },
      { at: [14, 12], lvl: 1 },
      { at: [20, 4], lvl: 2 },
    ],
    weather: (e) => Gi[Math.min(Gi.length, e) - 1],
    unitPosture: (e, t) => (t.army === `FP` ? `hold` : void 0),
    turnEnd: qi,
    end: (e, t) =>
      gr(e, t, `Минск`)
        ? {
            title: `Белоруссия освобождается`,
            text: `Минск свободен, группа армий «Центр» разгромлена. Фронт стремительно катится на запад — к границам Польши и Восточной Пруссии.`,
          }
        : gr(e, t, `Бобруйск`)
          ? {
              title: `Бобруйский котёл`,
              text: `Бобруйская группировка врага уничтожена, но до Минска ещё не дошли. Наступление продолжается.`,
            }
          : {
              title: `Наступление захлебнулось`,
              text: `Прорвать оборону 9-й армии не удалось. Ставка недовольна.`,
            },
  }),
  Xi = z(`SOV`, `GA8`),
  Zi = z(`SOV`, `GTA1`),
  Qi = z(`SOV`, `U5`),
  $i = z(`SOV`, `U3`),
  ea = z(`SOV`, `A47`),
  ta = z(`SOV`, `GTA2`),
  na = z(`SOV`, `WP1`),
  ra = z(`SOV`, `A69`),
  ia = z(`SOV`, `A33`),
  aa = z(`SOV`, `UKR1`),
  q = z(`GER`),
  oa = z(`GER`, `FP`),
  sa = z(`GER`, `W12`),
  ca = [
    Xi(`inf`, `4-й гвардейский стрелковый корпус`, 17, 8, 10, {
      guard: !0,
      xp: 5,
    }),
    Xi(`inf`, `28-й гвардейский стрелковый корпус`, 17, 9, 10, {
      guard: !0,
      xp: 5,
    }),
    Xi(`inf`, `29-й гвардейский стрелковый корпус`, 18, 8, 10, {
      guard: !0,
      xp: 5,
    }),
    Zi(`arm`, `8-й гвардейский механизированный корпус`, 18, 9, 10, {
      guard: !0,
      xp: 5,
    }),
    Zi(`arm`, `11-й гвардейский танковый корпус`, 19, 8, 10, {
      guard: !0,
      xp: 5,
    }),
    Zi(`arm`, `11-й танковый корпус`, 19, 9, 9, { xp: 3 }),
    Qi(`inf`, `9-й стрелковый корпус`, 17, 7, 10),
    Qi(`inf`, `26-й гвардейский стрелковый корпус`, 18, 6, 10, { guard: !0 }),
    $i(`inf`, `79-й стрелковый корпус`, 18, 5, 10),
    ea(`inf`, `77-й стрелковый корпус`, 18, 4, 9),
    ta(`arm`, `9-й гвардейский танковый корпус`, 19, 6, 10, { guard: !0 }),
    ta(`arm`, `12-й гвардейский танковый корпус`, 20, 5, 9, { guard: !0 }),
    na(`inf`, `1-я армия Войска Польского`, 17, 3, 9),
    ra(`inf`, `25-й стрелковый корпус`, 18, 10, 9),
    ra(`inf`, `61-й стрелковый корпус`, 18, 11, 9),
    ia(`inf`, `16-й стрелковый корпус`, 19, 12, 9),
    ia(`inf`, `38-й стрелковый корпус`, 18, 13, 9),
    aa(`arm`, `3-я гвардейская танковая армия`, 20, 18, 10, { guard: !0 }),
    aa(`arm`, `4-я гвардейская танковая армия`, 19, 19, 10, { guard: !0 }),
    aa(`inf`, `5-я гвардейская армия`, 19, 20, 10, { guard: !0 }),
    aa(`inf`, `13-я армия`, 20, 17, 9),
    aa(`inf`, `3-я гвардейская армия`, 19, 16, 9, { guard: !0 }),
    q(`inf`, `9-я парашютная дивизия`, 16, 8, 7),
    q(`inf`, `303-я пехотная дивизия «Дёбериц»`, 16, 7, 7),
    q(`inf`, `169-я пехотная дивизия`, 16, 9, 7),
    q(`inf`, `712-я пехотная дивизия`, 17, 10, 6),
    q(`inf`, `606-я пехотная дивизия`, 17, 6, 6),
    oa(`inf`, `Крепость Франкфурт`, 17, 11, 7),
    q(`inf`, `286-я пехотная дивизия`, 17, 12, 6),
    q(`mot`, `Дивизия «Курмарк»`, 18, 12, 7),
    q(`arm`, `Танковая дивизия «Мюнхеберг»`, 15, 8, 7),
    q(`mot`, `25-я танкогренадерская дивизия`, 14, 8, 7),
    q(`mot`, `20-я танкогренадерская дивизия`, 15, 7, 6),
    q(`mot`, `11-я дивизия СС «Нордланд»`, 14, 9, 7),
    q(`mot`, `18-я танкогренадерская дивизия`, 15, 10, 7),
    q(`inf`, `5-я егерская дивизия`, 16, 4, 6),
    q(`inf`, `1-я дивизия морской пехоты`, 16, 5, 5),
    q(`inf`, `Дивизия СС «Нидерланды»`, 15, 2, 5),
    q(`mot`, `Дивизия «Бранденбург»`, 18, 18, 7),
    q(`inf`, `Гарнизон Форста`, 18, 20, 6),
    q(`inf`, `342-я пехотная дивизия`, 18, 17, 6),
    q(`inf`, `275-я пехотная дивизия`, 19, 17, 6),
    q(`arm`, `21-я танковая дивизия`, 18, 19, 7),
    q(`inf`, `Гарнизон Котбуса`, 16, 20, 5),
    oa(`inf`, `Берлинский гарнизон`, 8, 8, 7),
    q(`inf`, `Гитлерюгенд`, 6, 8, 4),
    q(`inf`, `Фольксштурм Кёпеника`, 9, 9, 4),
  ],
  la = (e, t, n, r, i = {}) => ({
    id: e,
    turn: t,
    icon: `news`,
    views: {
      SOV: {
        title: n,
        text: r,
        options: [{ label: `Принято`, desc: ``, effects: [] }],
      },
    },
    ...i,
  }),
  ua = [
    la(
      `br_start`,
      1,
      `На Берлин!`,
      `5 часов утра, 16 апреля. Мощнейшая артподготовка, и 143 прожектора ослепили врага на Зееловских высотах. Последняя битва войны началась.`,
      { immediate: [{ k: `org`, n: `GER`, v: -10 }] },
    ),
    la(
      `br_konev`,
      2,
      `Конев прорвался на Нейсе`,
      `Танковые армии 1-го Украинского фронта прорвали оборону на Нейсе и повернули на Берлин с юга. Кто первым войдёт в Берлин — вы или Конев?`,
    ),
    la(
      `br_shell`,
      3,
      `Огонь по Берлину`,
      `20 апреля дальнобойная артиллерия 79-го стрелкового корпуса впервые открыла огонь по Берлину.`,
    ),
    la(
      `br_wenck`,
      5,
      `Армия Венка`,
      `Гитлер бросил на выручку Берлину 12-ю армию генерала Венка — она наступает с запада, на Потсдам. 9-я армия Буссе окружена юго-восточнее Берлина, у Хальбе.`,
      {
        immediate: [
          {
            k: `spawn`,
            units: [
              sa(`inf`, `Дивизия «Шарнхорст»`, 1, 10, 8),
              sa(`inf`, `Дивизия «Ульрих фон Гуттен»`, 2, 12, 8),
              sa(`inf`, `Дивизия «Теодор Кёрнер»`, 4, 12, 7),
            ],
          },
        ],
      },
    ),
    la(
      `br_weidling`,
      4,
      `Комендант Берлина`,
      `Генерал Вейдлинг назначен комендантом Берлина. Остатки 56-го танкового корпуса, дивизия СС «Шарлемань» и зенитчики с бетонных башен готовят город к уличным боям. Каждый дом превращён в крепость.`,
      {
        immediate: [
          {
            k: `spawn`,
            units: [
              oa(`inf`, `Дивизия СС «Шарлемань»`, 7, 9, 6),
              oa(`inf`, `1-я зенитная дивизия «Берлин»`, 8, 9, 7),
            ],
          },
        ],
      },
    ),
    la(
      `br_elbe`,
      6,
      `Встреча на Эльбе`,
      `25 апреля у Торгау советские и американские войска встретились на Эльбе. Германия рассечена надвое, Берлин окружён.`,
    ),
    la(
      `br_dead`,
      8,
      `Гитлер мёртв`,
      `30 апреля Гитлер покончил с собой в бункере рейхсканцелярии. Над Рейхстагом поднимается Знамя Победы. Сопротивление врага слабеет.`,
      { immediate: [{ k: `org`, n: `GER`, v: -20 }] },
    ),
  ],
  da = [
    `clear`,
    `clear`,
    `rain`,
    `clear`,
    `clear`,
    `clear`,
    `rain`,
    `clear`,
    `clear`,
  ],
  fa = {
    general: `Василий Чуйков`,
    short: `Чуйков`,
    rank: `генерал-полковник`,
    army: `GA8`,
    armyName: `8-я гвардейская армия`,
    hq: `Ставка`,
    role: `Командующий ударной группировкой 1-го Белорусского фронта`,
    armies: {
      GA8: { name: `8-я гвардейская армия`, general: `ген. В. И. Чуйков` },
      GTA1: {
        name: `1-я гвардейская танковая армия`,
        general: `ген. М. Е. Катуков`,
      },
      U5: {
        name: `5-я ударная армия`,
        general: `ген. Н. Э. Берзарин`,
        post: `off`,
      },
      U3: {
        name: `3-я ударная армия`,
        general: `ген. В. И. Кузнецов`,
        post: `off`,
      },
      A47: {
        name: `47-я армия`,
        general: `ген. Ф. И. Перхорович`,
        post: `off`,
      },
      GTA2: {
        name: `2-я гвардейская танковая армия`,
        general: `ген. С. И. Богданов`,
        post: `off`,
      },
      WP1: {
        name: `1-я армия Войска Польского`,
        general: `ген. С. Г. Поплавский`,
        post: `def`,
      },
      A69: { name: `69-я армия`, general: `ген. В. Я. Колпакчи`, post: `def` },
      A33: { name: `33-я армия`, general: `ген. В. Д. Цветаев`, post: `def` },
      UKR1: {
        name: `1-й Украинский фронт`,
        general: `маршал И. С. Конев`,
        post: `off`,
      },
    },
    front: [`U5`, `U3`, `A47`, `GTA2`, `WP1`, `A69`, `A33`],
    also: [`GTA1`],
    start: { trust: 60, auth: 60, fame: 35 },
    sup0: 25,
    stars: { two: 3, three: 5, fame: 70 },
    intro: {
      title: `Последний штурм`,
      text: `16 апреля 1945 года. Вы — {rank} {name}. Под вашим командованием 8-я гвардейская и 1-я гвардейская танковая армии на Кюстринском плацдарме; остальным армиям фронта вы отдаёте приказы. Возьмите Зееловские высоты, окружите и штурмуйте Берлин — раньше, чем туда ворвутся танки Конева. Операция длится 9 ходов, до 2 мая.`,
    },
    brief: `Апрель 1945 года. До Берлина — 70 километров. Впереди Зееловские высоты, за ними — столица Третьего рейха.`,
    standing: `Берегите войска: каждое потерянное соединение — Авторитет −6, Слава −2, Доверие −1. Уничтоженное вражеское — Авторитет +2 и Слава +3 (после четвёртого за операцию — +1). Каждые две успешные атаки — Слава +1.`,
    directives: [
      {
        id: `heights`,
        at: 1,
        turns: 2,
        kind: `wins`,
        need: 3,
        title: `Штурм Зееловских высот`,
        goal: `Одержать 3 победы в атаках`,
        text: `Высоты нужно взять с ходу. Пехота — вперёд за огневым валом, танки — в бой, не дожидаясь прорыва.`,
        reward: { trust: 5, auth: 3, fame: 5 },
        penalty: { trust: -5 },
      },
      {
        id: `seelow`,
        at: 1,
        turns: 3,
        kind: `take`,
        own: !0,
        city: `Зелов`,
        title: `Взять Зелов`,
        goal: `Взять Зелов силами своих армий`,
        text: `Городок Зелов — центр обороны на высотах. Возьмите его, и дорога на Берлин открыта.`,
        reward: { trust: 8, auth: 3, fame: 6 },
        penalty: { trust: -7 },
      },
      {
        id: `outskirts`,
        at: 3,
        turns: 4,
        kind: `reach`,
        need: 3,
        zone: lr(`Берлин`, 1, 2),
        title: `К окраинам Берлина`,
        goal: `Вывести 3 соединения к окраинам Берлина`,
        text: `Не ввязывайтесь в бои за каждый посёлок. Танковые корпуса — к Берлину, обходите узлы сопротивления.`,
        reward: { trust: 6, fame: 6 },
        penalty: { trust: -5 },
      },
      {
        id: `halbe`,
        at: 5,
        turns: 4,
        kind: `kills`,
        need: 3,
        title: `Хальбский котёл`,
        goal: `Разгромить 3 вражеских соединения`,
        text: `9-я армия Буссе окружена юго-восточнее Берлина и рвётся на запад, к Венку. Добейте её.`,
        reward: { trust: 4, auth: 4, fame: 6 },
        penalty: { trust: -4 },
      },
      {
        id: `frankfurt`,
        at: 5,
        turns: 4,
        kind: `take`,
        city: `Франкфурт`,
        title: `Крепость Франкфурт`,
        goal: `Взять Франкфурт-на-Одере силами фронта`,
        text: `Гарнизон Франкфурта держится в тылу фронта. Прикажите 69-й и 33-й армиям наступать и возьмите крепость.`,
        reward: { trust: 5, fame: 4 },
        penalty: { trust: -3 },
      },
      {
        id: `berlin`,
        at: 4,
        turns: 6,
        kind: `take`,
        own: !0,
        city: `Берлин`,
        title: `Штурм Берлина`,
        goal: `Взять Берлин силами своих армий`,
        text: `Ставка приказывает: овладеть Берлином. Если первыми в город ворвутся войска Конева — слава достанется им.`,
        reward: { trust: 10, auth: 4, fame: 10 },
        penalty: { trust: -8 },
        bonusCity: `Берлин`,
        bonusOwn: !0,
        bonus: { fame: 10, trust: 4 },
        bonusText: `Знамя Победы над Рейхстагом`,
      },
    ],
    requests: [
      {
        id: `searchlights`,
        icon: `fame`,
        title: `Прожекторная атака`,
        cost: 4,
        max: 1,
        instant: !0,
        desc: `Сто сорок прожекторов ослепят врага на высотах перед атакой: организация войск рядом с вашими −20, иногда и сила. Ответ — немедленно.`,
        base: () => 70,
        avail: (e) => e.s.turn === 1,
        why: () => `Возможно только в первый ход`,
        apply: (e, t) =>
          `Прожекторы вспыхнули разом. Ослеплённый враг не смог вести прицельный огонь: накрыто соединений — ${mr(e, t, 1, 20, 0.3)}.`,
      },
      B.arty({
        base: 60,
        max: 3,
        v: 0.2,
        title: `Артиллерийский корпус прорыва`,
        desc: `Тысячи орудий на километр фронта: атаки ваших войск сильнее на 20% в следующем ходу.`,
      }),
      B.air(() => 65, 3, 5),
      B.katyusha({ base: 60, max: 3 }),
      B.reinf([`Сводный гвардейский полк`, `416-я стрелковая дивизия`], {
        str: 8,
      }),
      B.ammo(70, 15, 6),
      B.delay(45),
    ],
    history: `Берлинская операция началась 16 апреля 1945 года. Зееловские высоты 8-я гвардейская и 1-я гвардейская танковая армии штурмовали три дня. 25 апреля Берлин был окружён, в тот же день на Эльбе произошла встреча с союзниками. 30 апреля над Рейхстагом подняли Знамя Победы, 2 мая гарнизон Берлина капитулировал. 8 мая был подписан акт о безоговорочной капитуляции Германии. Великая Отечественная война закончилась Победой.`,
    awards: [
      { fame: 70, name: `Орден Суворова I степени` },
      { fame: 40, name: `Орден Кутузова I степени` },
      { fame: 15, name: `Медаль «За взятие Берлина»` },
    ],
    promotion: `Присвоено звание Маршала Советского Союза`,
  },
  pa = [
    Mr,
    Jr,
    vi,
    Ni,
    Yi,
    _r({
      id: `berlin45`,
      name: `Берлин 1945`,
      subtitle: `Берлинская операция · 8-я гвардейская армия`,
      map: `berlin45`,
      year: 1945,
      maxTurn: 9,
      date: tr(1945, 4, 16, 2),
      nations: [or(1945), ar(1945, { posture: `def` })],
      order: [`SOV`, `GER`],
      wars: [[`GER`, `SOV`]],
      units: ca,
      events: ua,
      career: fa,
      init: (e) => {
        for (let t of e.units) t.nat === `GER` && (t.entrench = 2);
      },
      forts: [
        { at: [16, 8], lvl: 2 },
        { at: [16, 7], lvl: 1 },
        { at: [16, 9], lvl: 1 },
        { at: [15, 7], lvl: 1 },
        { at: [17, 11], lvl: 2 },
        { at: [8, 8], lvl: 3 },
        { at: [8, 7], lvl: 1 },
        { at: [6, 8], lvl: 1 },
        { at: [9, 9], lvl: 1 },
      ],
      weather: (e) => da[Math.min(da.length, e) - 1],
      unitPosture: (e, t) =>
        t.army === `FP` ? `hold` : t.army === `W12` ? `off` : void 0,
      aiTargetFilter: (e, t, n, r) =>
        n !== `GER` ||
        r === t.cities.find((e) => e.name === `Потсдам`).hex ||
        r === t.cities.find((e) => e.name === `Берлин`).hex,
      end: (e, t) =>
        gr(e, t, `Берлин`)
          ? {
              title: `Победа!`,
              text: `Над Рейхстагом развевается Знамя Победы. 2 мая гарнизон Берлина капитулировал, 8 мая подписан акт о безоговорочной капитуляции Германии. Великая Отечественная война окончена.`,
            }
          : {
              title: `Бои в Берлине продолжаются`,
              text: `Столица рейха окружена, но ещё не взята. Каждый дом приходится брать штурмом.`,
            },
    }),
  ],
  __OH = { z, Or, _r, B, L, cr, tr, ar, or, sr, f, _n, hr, En, R, I, gr },
  __KH = __mkKH(__OH),
  __RZ = __mkRZ(__OH),
  OPS_ALL = [pa[0], pa[1], __KH, __RZ, pa[2], pa[3], pa[4], pa[5]],
  ma = Object.fromEntries([Ye, $n, ...OPS_ALL].map((e) => [e.id, e])),
  ha = [
    `генерал-майор`,
    `генерал-лейтенант`,
    `генерал-полковник`,
    `генерал армии`,
    `Маршал Советского Союза`,
  ],
  ga = [
    `генерал-майора`,
    `генерал-лейтенанта`,
    `генерал-полковника`,
    `генерала армии`,
    `Маршала Советского Союза`,
  ],
  _a = [1, 1, 2, 2, 3, 3, 4],
  va = `wf_camp_v1`,
  ya = [
    { air: 0, sup: 0, chance: 0, reserve: [] },
    { air: 1, sup: 10, chance: 0, reserve: [] },
    { air: 2, sup: 10, chance: 0, reserve: [`inf`] },
    { air: 2, sup: 15, chance: 5, reserve: [`inf`, `arm`] },
    { air: 3, sup: 20, chance: 10, reserve: [`inf`, `arm`, `inf`] },
  ],
  ba = { inf: `стрелковое соединение`, arm: `танковое соединение` };
function xa(e) {
  let t = ya[Math.max(0, Math.min(ya.length - 1, e))],
    n = [];
  if (
    (t.air &&
      n.push(`своя авиагруппа: ✈ ${t.air} в ход (в нелётную погоду меньше)`),
    t.reserve.length)
  ) {
    let e = (e) => t.reserve.filter((t) => t === e).length,
      r = [`inf`, `arm`]
        .filter((t) => e(t))
        .map((t) =>
          e(t) > 1
            ? `${e(t)} ${t === `inf` ? `стрелковых` : `танковых`} соединения`
            : ba[t],
        );
    n.push(`резерв командующего: ${r.join(` и `)} в начале операции`);
  }
  return (
    t.sup && n.push(`+${t.sup} запасов в начале операции`),
    t.chance && n.push(`шанс запросов по телеграфу +${t.chance}%`),
    n
  );
}
var J_ALL = [
    {
      id: `smolensk41`,
      year: 1941,
      period: `июль 1941`,
      place: `Смоленск`,
      guardNo: 1,
      reserve: {
        inf: [`107-я стрелковая дивизия`, `108-я стрелковая дивизия`],
        arm: [`105-я танковая дивизия`],
      },
      memo: [
        `Под Смоленском мы впервые увидели, что немца можно бить. Армия дралась в полуокружении, но не дрогнула, и Ставка ни разу не упрекнула нас в невыполненном приказе.`,
        `Смоленское сражение стало для меня жестокой школой. Мы держались, контратаковали, теряли людей — и всё же на месяц задержали врага на пути к Москве.`,
        `Лето сорок первого я вспоминаю с горечью. Армия отходила с боями, многие приказы остались невыполненными, но мы вынесли знамёна и сохранили костяк дивизий.`,
      ],
      news: [
        `Армия генерала {gshort} громит врага под Смоленском`,
        `Упорные бои на смоленском направлении`,
        `Тяжёлые оборонительные бои западнее Смоленска`,
      ],
    },
    {
      id: `moscow41`,
      year: 1941,
      period: `ноябрь 1941`,
      place: `Москва`,
      guardNo: 5,
      reserve: {
        inf: [`108-я стрелковая дивизия`, `133-я стрелковая дивизия`],
        arm: [`28-я танковая бригада`],
      },
      memo: [
        `В ноябре сорок первого на Волоколамском шоссе решалась судьба Москвы. Мои дивизии стояли насмерть, а в декабре погнали врага на запад. Тот первый праздник победы я не забуду никогда.`,
        `Под Москвой мы выстояли. Немец дошёл до самых подступов, но столицу мы не отдали, а в декабре перешли в наступление.`,
        `Битва за Москву далась нам страшной ценой. Армия едва держалась, и только подход резервов спас положение.`,
      ],
      news: [
        `Провал немецкого плана окружения Москвы!`,
        `Войска генерала {gshort} отстояли подступы к столице`,
        `Ожесточённые бои на волоколамском направлении`,
      ],
    },
    {
      id: `kharkov42`,
      year: 1942,
      period: `май 1942`,
      place: `Харьков`,
      guardNo: 15,
      reserve: {
        inf: [`226-я стрелковая дивизия`, `300-я стрелковая дивизия`],
        arm: [`10-я танковая бригада`],
      },
      memo: [
        `Под Харьковом мы вовремя разглядели западню. Армия прорвала фронт, а когда Клейст ударил по Барвенковскому выступу, мы не дали захлопнуть мешок и вывели дивизии к Донцу.`,
        `Харьковская операция начиналась как наступление, а закончилась тяжёлым выходом из кольца. Мы потеряли много людей, но вынесли знамёна и сохранили костяк армии.`,
        `Май сорок второго — самая горькая страница моей службы. Армия рвалась к Харькову, а за спиной у нас уже смыкались немецкие клещи. Из выступа вышли немногие.`,
      ],
      news: [
        `Армия генерала {gshort} вырвалась из немецких клещей под Харьковом`,
        `Упорные бои на харьковском направлении`,
        `Тяжёлые бои в районе Барвенково`,
      ],
    },
    {
      id: `rzhev42`,
      year: 1942,
      period: `август 1942`,
      place: `Ржев`,
      guardNo: 20,
      reserve: {
        inf: [`352-я стрелковая дивизия`, `158-я стрелковая дивизия`],
        arm: [`255-я танковая бригада`],
      },
      memo: [
        `Подо Ржевом мы прорвали оборону 9-й немецкой армии и вышли к Вазузе. Ржевская мясорубка перемалывала дивизии, но в те августовские дни враг впервые попятился без приказа.`,
        `Ржевско-Сычёвская операция далась тяжело: дожди, болота, бесконечные контратаки немецких танковых дивизий. Мы продвинулись вперёд и не дали немцам снять отсюда ни одной дивизии под Сталинград.`,
        `Под Ржевом армия завязла в грязи. Мы атаковали снова и снова, теряли людей за каждую деревню, а Сычёвка так и осталась за немцами.`,
      ],
      news: [
        `Войска генерала {gshort} прорвали оборону немцев подо Ржевом`,
        `Упорные бои на ржевском направлении`,
        `Ожесточённые бои западнее Погорелого Городища`,
      ],
    },
    {
      id: `stalingrad42`,
      year: 1942,
      period: `ноябрь 1942`,
      place: `Сталинград`,
      guardNo: 30,
      reserve: {
        inf: [`321-я стрелковая дивизия`, `277-я стрелковая дивизия`],
        arm: [`157-я танковая бригада`],
      },
      memo: [
        `19 ноября сорок второго мои танковые корпуса прорвали румынский фронт, а через несколько дней кольцо вокруг армии Паулюса замкнулось. Это был перелом всей войны.`,
        `Операция «Уран» удалась, хотя не всё шло по плану: враг цеплялся за каждый хутор на Чире. Но кольцо вокруг Сталинграда мы замкнули.`,
        `Под Сталинградом моя армия наступала тяжело и медленно. Котёл замкнули другие, а нам досталась кровавая работа на внешнем фронте.`,
      ],
      news: [
        `Успешное наступление наших войск в районе Сталинграда!`,
        `Танкисты генерала {gshort} громят врага в излучине Дона`,
        `Бои в большой излучине Дона`,
      ],
    },
    {
      id: `kursk43`,
      year: 1943,
      period: `июль 1943`,
      place: `Курск`,
      guardNo: 75,
      reserve: {
        inf: [`74-я стрелковая дивизия`, `140-я стрелковая дивизия`],
        arm: [`129-я танковая бригада`],
      },
      memo: [
        `На Курской дуге мы выдержали удар «тигров» и «фердинандов», а затем перешли в наступление и освободили Орёл. Москва салютовала нашим войскам — первый салют войны.`,
        `На северном фасе дуги мы остановили Моделя. Наступление на Орёл шло тяжело, но враг был отброшен.`,
        `Курская битва стоила моей армии огромных потерь. Мы устояли, но на большее сил не хватило.`,
      ],
      news: [
        `Наши войска овладели городом Орёл!`,
        `Провал летнего наступления немцев`,
        `Упорные бои на орловско-курском направлении`,
      ],
    },
    {
      id: `bagration44`,
      year: 1944,
      period: `июнь 1944`,
      place: `Белоруссия`,
      guardNo: 95,
      reserve: {
        inf: [`46-й стрелковый корпус`, `95-й стрелковый корпус`],
        arm: [`68-я танковая бригада`],
      },
      memo: [
        `Летом сорок четвёртого мы прошли через болота у Паричей там, где враг нас не ждал. Бобруйский котёл, Минск — группа армий «Центр» перестала существовать.`,
        `Белорусская операция стала нашим реваншем за сорок первый. Мы окружили немцев под Бобруйском и погнали их на запад.`,
        `В Белоруссии наше наступление шло трудно: болота, бездорожье, отчаянное сопротивление. И всё же фронт сдвинулся на запад.`,
      ],
      news: [
        `Войска генерала {gshort} освободили Бобруйск!`,
        `Окружение немецких войск под Бобруйском`,
        `Наступление наших войск в Белоруссии`,
      ],
    },
    {
      id: `berlin45`,
      year: 1945,
      period: `апрель 1945`,
      place: `Берлин`,
      guardNo: 110,
      reserve: {
        inf: [`32-й стрелковый корпус`, `125-й стрелковый корпус`],
        arm: [`1-й механизированный корпус`],
      },
      memo: [
        `Зееловские высоты, улицы Берлина, Рейхстаг… 2 мая гарнизон Берлина капитулировал, и над городом поднялось Знамя Победы. Ради этого дня мы прошли весь путь от Смоленска.`,
        `Берлинская операция была последней и самой тяжёлой. Мы взломали оборону на Одере и дошли до столицы рейха.`,
        `Штурм Берлина дался нам большой кровью. Но война кончилась — и это главное.`,
      ],
      news: [
        `Знамя Победы над Берлином!`,
        `Войска генерала {gshort} ворвались в Берлин`,
        `Бои на подступах к Берлину`,
      ],
    },
  ],
  J = [],
  STAGES = [[`smolensk41`], [`moscow41`], [`kharkov42`, `rzhev42`], [`stalingrad42`], [`kursk43`], [`bagration44`], [`berlin45`]],
  BRANCH = 2,
  routeOf = (p) =>
    STAGES.map((e, t) =>
      p && p.route && e.includes(p.route[t]) ? p.route[t] : e.length > 1 ? null : e[0],
    ),
  syncRoute = (p) => {
    let e = routeOf(p);
    ((J.length = 0), (pa.length = 0));
    e.forEach((t, n) => {
      let r = t || STAGES[n][0];
      (J.push(J_ALL.find((e) => e.id === r)), pa.push(ma[r]));
    });
  },
  Sa = (e) => pa[e];
syncRoute(null);
function Ca(e) {
  return /(ский|цкий|ской|цкой)$/.test(e)
    ? e.replace(/(ий|ой)$/, `ого`)
    : /[кгх]ий$/.test(e)
      ? e.replace(/ий$/, `ого`)
      : /ий$/.test(e)
        ? e.replace(/ий$/, `его`)
        : /(ый|ой)$/.test(e)
          ? e.replace(/(ый|ой)$/, `ого`)
          : /ь$/.test(e)
            ? e.replace(/ь$/, `я`)
            : /й$/.test(e)
              ? e.replace(/й$/, `я`)
              : /[кгхжшчщ]а$/.test(e)
                ? e.replace(/а$/, `и`)
                : /а$/.test(e)
                  ? e.replace(/а$/, `ы`)
                  : /я$/.test(e)
                    ? e.replace(/я$/, `и`)
                    : /[оеиуюэы]$/i.test(e)
                      ? e
                      : /[бвгджзклмнпрстфхцчшщ]$/i.test(e)
                        ? e + `а`
                        : e;
}
function wa(e) {
  let t = [],
    n = {};
  for (let r of e) (n[r] || t.push(r), (n[r] = (n[r] || 0) + 1));
  return t.map((e) => (n[e] > 1 ? `${e} ×${n[e]}` : e));
}
var Ta = (e) => J.findIndex((t) => t.id === e);
function Ea(e, t) {
  let n = e.replace(/\s+/g, ` `).trim() || `Иван Соколов`,
    r = n.split(` `);
  let i = {
    v: 2,
    name: n,
    short: r[r.length - 1],
    diff: t,
    route: routeOf(null),
    ops: STAGES.map(() => null),
    fails: STAGES.map(() => 0),
    created: Date.now(),
  };
  return (syncRoute(i), i);
}
function Da(e) {
  try {
    let t = JSON.parse(e.getItem(`wf_camp_v1`) || `null`);
    if (t && t.v === 1 && Array.isArray(t.ops)) {
      for (; t.ops.length < 6;) t.ops.push(null);
      for (t.fails = t.fails || []; t.fails.length < 6;) t.fails.push(0);
      let n = t.ops[2];
      (t.ops.splice(
        2,
        0,
        n
          ? { skip: 1, stars: 0, kills: 0, lost: 0, add: [], dead: [], xp: {}, rep: { ...n.rep }, done: 0, total: 0, promoted: !1 }
          : null,
      ),
        t.fails.splice(2, 0, 0));
      for (let e of t.ops) if (e && e.add) for (let t of e.add) t.op >= 2 && t.op++;
      ((t.v = 2), (t.route = routeOf(null)), (t.migrated = 1), Oa(e, t));
    }
    if (t && t.v === 2 && Array.isArray(t.ops)) {
      for (; t.ops.length < STAGES.length;) t.ops.push(null);
      for (t.fails = t.fails || []; t.fails.length < STAGES.length;) t.fails.push(0);
      return ((t.route = routeOf(t)), syncRoute(t), t);
    }
  } catch {}
  return (syncRoute(null), null);
}
function Oa(e, t) {
  try {
    e.setItem(va, JSON.stringify(t));
  } catch {}
}
function Y(e, t = J.length) {
  let n = {
    rank: 0,
    hero: 0,
    roster: [],
    done: 0,
    stars: 0,
    kills: 0,
    lost: 0,
    awards: [],
    victory: !1,
  };
  for (let r = 0; r < Math.min(t, J.length); r++) {
    let t = e.ops[r];
    if (!t) break;
    if (t.skip) continue;
    (n.done++,
      (n.stars += t.stars),
      (n.kills += t.kills),
      (n.lost += t.lost),
      t.promoted && n.rank < _a[r] && n.rank++);
    for (let e of t.dead) {
      let t = n.roster.findIndex((t) => t.name === e);
      t >= 0 && n.roster.splice(t, 1);
    }
    for (let e of n.roster)
      t.xp[e.name] && (e.xp = Math.max(e.xp, t.xp[e.name]));
    for (let e of t.add)
      n.roster.length < 4 &&
        !n.roster.some((t) => t.name === e.name) &&
        n.roster.push({ ...e });
    (t.award && n.awards.push({ op: r, name: t.award }),
      t.hero &&
        (n.hero++,
        n.awards.push({
          op: r,
          name: `Золотая Звезда Героя Советского Союза`,
        })),
      t.victory &&
        ((n.victory = !0), n.awards.push({ op: r, name: `Орден «Победа»` })));
  }
  return n;
}
var ka = (e) => {
    let t = e.ops.findIndex((e) => !e);
    return t < 0 ? J.length : t;
  },
  Aa = (e) =>
    e >= 3
      ? `Трижды Герой Советского Союза`
      : e === 2
        ? `Дважды Герой Советского Союза`
        : e === 1
          ? `Герой Советского Союза`
          : ``,
  ja = {
    inf: [`inf`],
    cav: [`cav`, `inf`],
    mot: [`mot`, `arm`, `inf`],
    arm: [`arm`, `mot`],
  },
  Ma = {
    inf: [`я`, `стрелковая дивизия`],
    cav: [`я`, `кавалерийская дивизия`],
    mot: [`я`, `мотострелковая дивизия`],
    arm: [`я`, `танковая бригада`],
  },
  Na = null;
function Pa() {
  if (Na) return Na;
  let e = new Set(),
    t = (n, r) => {
      if (!n || typeof n != `object` || r > 8) return;
      if (Array.isArray(n)) {
        for (let e of n) t(e, r + 1);
        return;
      }
      let i = n;
      (typeof i.name == `string` && e.add(i.name),
        typeof i.to == `string` && e.add(i.to));
      for (let e of Object.keys(i)) typeof i[e] == `object` && t(i[e], r + 1);
    };
  for (let e of OPS_ALL) (t(e.units, 0), t(e.events, 0));
  for (let t of J_ALL) for (let n of [...t.reserve.inf, ...t.reserve.arm]) e.add(n);
  return (Na = e);
}
function Fa(e) {
  let t = new Set(),
    n = (e, r) => {
      if (!e || typeof e != `object` || r > 8) return;
      if (Array.isArray(e)) {
        for (let t of e) n(t, r + 1);
        return;
      }
      let i = e;
      i.k === `guard` && typeof i.name == `string` && t.add(i.name);
      for (let e of Object.keys(i)) typeof i[e] == `object` && n(i[e], r + 1);
    };
  return (n(e.sc.events, 0), t);
}
function Ia(e, t, n) {
  let r = /^\d+-(я|й|е)\s+(.+)$/.exec(e);
  if (r && !/гвард/i.test(r[2]) && !/армия|групп/i.test(r[2]))
    return `${n}-${r[1]} ${r[1] === `й` ? `гвардейский` : r[1] === `е` ? `гвардейское` : `гвардейская`} ${r[2]}`;
  let [i, a] = Ma[t];
  return `${n}-${i} гвардейская ${a}`;
}
var La = (e, t, n) => Math.max(t, Math.min(n, e));
function Ra(e, t, n) {
  let r = e.s.career,
    i = e.sc.career,
    a = Y(t, n);
  ((r.gen = { name: t.name, short: t.short, rank: ha[a.rank] }),
    (r.camp = { op: n, placed: [], rank: a.rank }));
  let o = n > 0 ? t.ops[n - 1] : null;
  if (o) {
    let e = i.start;
    ((r.rep.trust = La(
      e.trust +
        La(Math.round((o.rep.trust - 40) * 0.25), -5, 5) +
        (a.rank >> 1),
      5,
      95,
    )),
      (r.rep.auth = La(
        e.auth + La(Math.round((o.rep.auth - 50) * 0.15), -5, 6),
        5,
        95,
      )),
      (r.rep.fame = La(
        e.fame + Math.min(8, Math.round(o.rep.fame * 0.08)),
        0,
        95,
      )));
  }
  let s = Fa(e),
    c = hn(e).filter((e) => !s.has(e.name));
  for (let t of a.roster) {
    let n = e.s.units.find((e) => e.name === t.name);
    if (n) {
      if (P(e, n)) {
        ((n.xp = Math.max(n.xp, t.xp)),
          (n.guard = !0),
          r.camp.placed.push(t.name));
        let e = c.indexOf(n);
        e >= 0 && c.splice(e, 1);
      }
      continue;
    }
    let i = ja[t.type],
      a = c
        .filter((e) => i.includes(e.type))
        .sort(
          (e, t) =>
            (e.army === r.cmd[0] ? 0 : 1) - (t.army === r.cmd[0] ? 0 : 1) ||
            +!!e.guard - !!t.guard ||
            i.indexOf(e.type) - i.indexOf(t.type) ||
            t.str - e.str,
        )[0];
    a &&
      ((a.name = t.name),
      (a.guard = !0),
      (a.xp = Math.max(a.xp, t.xp)),
      r.camp.placed.push(t.name),
      c.splice(c.indexOf(a), 1));
  }
  let l = ya[a.rank];
  ((r.perk = { rank: a.rank, air: l.air, chance: l.chance }), (r.sup += l.sup));
  o && !o.skip && (o.stars === 3 ? ((r.sup += 6), (r.camp.prevFx = 1)) : o.stars === 1 && ((r.sup = Math.max(0, r.sup - 4)), (r.camp.prevFx = -1)));
  let u = J[n],
    d = { inf: [...u.reserve.inf], arm: [...u.reserve.arm] };
  r.camp.res = [];
  for (let t of l.reserve) {
    let n = d[t].shift();
    if (!n || e.s.units.some((e) => e.name === n)) continue;
    let i = za(e, t, n);
    i && r.camp.res.push(i.name);
  }
}
function za(e, t, n) {
  let r = e.s.player,
    i = e.s.career,
    a = F(e, r),
    o = Un(e),
    s = e.s.units.filter((t) => j(e, r, t.nat)).map((e) => e.hex),
    c = -1,
    l = 1e9;
  for (let t = 0; t < e.m.N; t++) {
    if (
      !a[t] ||
      N(e, t) !== r ||
      rt(e, t) ||
      !et(e, r, t) ||
      s.some((n) => f(e.m.g, n, t) < 3)
    )
      continue;
    let n = f(e.m.g, o, t) - (e.m.cityAt[t] >= 0 ? 0.5 : 0);
    n < l && ((l = n), (c = t));
  }
  return c < 0
    ? null
    : zt(
        e,
        {
          nat: r,
          lon: 0,
          lat: 0,
          type: t,
          name: n,
          army: i.cmd[0],
          str: 7,
          org: 1,
        },
        c,
        [],
      );
}
function Ba(e, t, n) {
  let r = e.s.career,
    i = e.sc.career,
    a = J[n],
    o = Bn(e.s, i),
    s = Y(t, n),
    c = r.camp?.placed || [],
    l = new Map(
      e.s.units.filter((t) => t.nat === e.s.player).map((e) => [e.name, e]),
    ),
    u = c.filter((e) => !l.has(e)),
    d = {};
  for (let e of c) {
    let t = l.get(e);
    t && (d[e] = Math.min(15, t.xp));
  }
  let f = Math.max(0, Math.min(2, 4 - (s.roster.length - u.length))),
    p = new Set([...Pa(), ...s.roster.map((e) => e.name)]),
    m = [];
  if (o.stars > 0) {
    let t = hn(e)
        .filter((e) => e.xp >= 7 && !s.roster.some((t) => t.name === e.name))
        .sort((e, t) => t.xp - e.xp || t.str - e.str),
      r = a.guardNo;
    for (let e of t.slice(0, f)) {
      let t = e.name;
      if (!e.guard)
        do t = Ia(e.name, e.type, r++);
        while (p.has(t));
      (p.add(t),
        m.push({
          name: t,
          type: e.type,
          xp: Math.min(15, e.xp),
          from: e.name,
          op: n,
        }));
    }
  }
  let h = o.stars === 3 && r.rep.fame >= 70,
    g = n === J.length - 1 && (o.stars === 3 || (o.stars === 2 && s.rank >= 3)),
    _ =
      o.stars === 3 ||
      (o.stars === 2 &&
        r.rep.trust >= 45 &&
        !(n === J.length - 1 && s.rank >= 3)),
    v = {
      stars: o.stars,
      award: o.award,
      hero: h,
      victory: g,
      promoted: _,
      rep: { ...r.rep },
      done: o.done,
      total: o.total,
      kills: r.stats.kills,
      lost: r.stats.lost,
      wins: r.stats.wins,
      title: e.s.result?.title || ``,
      end: e.sc.date(e.s.turn),
      diff: e.s.difficulty,
      at: Date.now(),
      add: m,
      dead: u,
      xp: d,
    },
    y = t.ops[n],
    b =
      o.stars > 0 &&
      (!y ||
        o.stars > y.stars ||
        (o.stars === y.stars && v.rep.fame > y.rep.fame)),
    x = ka(t) >= J.length;
  b ? (t.ops[n] = v) : o.stars === 0 && (t.fails[n] = (t.fails[n] || 0) + 1);
  let ee = Y(t, n + 1),
    S = t.ops[n],
    C = y?.hero ?? !1,
    te = y?.victory ?? !1,
    ne = a.news[3 - Math.max(1, o.stars)].replace(/\{gshort\}/g, Ca(t.short));
  return {
    rec: v,
    best: b,
    kept: S,
    rankBefore: s.rank,
    rankAfter: S ? ee.rank : s.rank,
    heroNow: b && h && !C,
    victoryNow: b && g && !te,
    newGuards: b ? m : [],
    deadGuards: b ? u : [],
    headline: o.stars > 0 ? ne : ``,
    final: b && !x && ka(t) >= J.length,
  };
}
function Va(e, t) {
  let n = e.ops[t];
  if (!n || n.skip) return null;
  let r = J[t],
    i = Sa(t),
    a = i.career,
    o = Y(e, t),
    s = Y(e, t + 1),
    c = [r.memo[3 - Math.max(1, n.stars)]];
  c.push(
    `${a.armyName} под командованием ${ga[o.rank]} ${Ca(e.short)} выполнила приказов Ставки: ${n.done} из ${n.total}. Разгромлено вражеских соединений: ${n.kills}, потеряно своих: ${n.lost}.`,
  );
  let l = [
    n.award,
    n.hero ? `Золотая Звезда Героя Советского Союза` : ``,
    n.victory ? `орден «Победа»` : ``,
  ].filter(Boolean);
  return (
    l.length && c.push(`Награды: ${l.join(`, `)}.`),
    s.rank > o.rank && c.push(`Присвоено звание ${ga[s.rank]}.`),
    n.add.length &&
      c.push(
        `Гвардейское звание заслужили: ${n.add.map((e) => e.name + (e.name === e.from ? `` : ` (бывшая ${e.from})`)).join(`; `)}.`,
      ),
    n.dead.length && c.push(`Пали в боях: ${n.dead.join(`; `)}.`),
    {
      title: `${i.name}`,
      sub: `${r.period} · ${a.armyName} · ${`★`.repeat(n.stars)}`,
      text: c,
    }
  );
}
function Ha(e) {
  let t = Y(e),
    n = [];
  (n.push(
    `Война окончена. За четыре года ${e.name} прошёл путь от генерал-майора под Смоленском до ${ga[t.rank]}${e.ops[J.length - 1] && !e.ops[J.length - 1].skip ? ` в поверженном Берлине` : ``}.`,
  ),
    t.stars >= 15
      ? n.push(
          `Его имя называли в одном ряду с Жуковым, Рокоссовским и Коневым. 24 июня 1945 года его войска прошли по Красной площади на Параде Победы, бросая к подножию Мавзолея знамёна разбитых немецких дивизий.`,
        )
      : t.stars >= 10
        ? n.push(
            `Ветераны его армии вспоминали командующего с уважением: он умел беречь людей и бить врага. На Параде Победы его солдаты прошли по Красной площади.`,
          )
        : n.push(
            `Не все операции ему удались, и Ставка не раз бывала им недовольна. Но он провёл свою армию через всю войну — до самой Победы.`,
          ));
  let r = Aa(t.hero),
    i = wa(
      t.awards
        .filter((e) => !e.name.startsWith(`Золотая Звезда`))
        .map((e) => e.name),
    );
  return (
    n.push(
      `${r ? r + `. ` : ``}${i.length ? `Награды: ` + i.join(`, `) + `.` : `Наград за войну он так и не получил.`}`,
    ),
    t.roster.length &&
      n.push(
        `Гвардейские соединения его армии — ${t.roster.map((e) => e.name).join(`, `)} — прошли с ним до конца войны.`,
      ),
    n.push(
      `Всего за войну: операций ${t.done}, звёзд ${t.stars} из ${J.length * 3}, разгромлено вражеских соединений ${t.kills}, потеряно своих ${t.lost}.`,
    ),
    n.push(`Через много лет вышли его мемуары — «От Смоленска до Берлина».`),
    { title: `После войны`, sub: `${ha[t.rank]} ${e.name}`, text: n }
  );
}
var Ua = __MAP_smolensk41,
  Wa = __MAP_moscow41,
  Ga = __MAP_stalingrad42,
  Ka = __MAP_kursk43,
  qa = __MAP_bagration44,
  Ja = __MAP_berlin45,
  Ya = () => !0,
  Xa = (e, t) => e.s.nations[t]?.post || e.nd[t]?.posture || `none`;
function Za(e, t) {
  let n = e.sc.unitPosture?.(e, t);
  if (n) return n;
  let r = e.s.career;
  if (r && t.nat === e.s.player && t.army) {
    if (r.post[t.army]) return r.post[t.army];
    let n = e.sc.career?.armies[t.army];
    if (n?.post) return n.post;
  }
  return Xa(e, t.nat);
}
function* Qa(e, t = {}) {
  let n = ut(e);
  if (!n) return;
  let r = t.filter || Ya,
    i = new Map(),
    a = (t) => {
      let n = i.get(t.id);
      return (n || ((n = Za(e, t)), i.set(t.id, n)), n);
    };
  if (
    !$t(e, n)
      .filter(r)
      .some((e) => a(e) !== `none`)
  )
    return;
  let o = (e) => r(e) && a(e) !== `none`;
  (t.spend !== !1 && Xa(e, n) !== `none` && (yield* no(e, n, o)),
    t.air !== !1 && (yield* to(e, n)),
    yield* eo(e, n, !0, (e) => r(e) && (a(e) === `off` || a(e) === `def`), a),
    yield* io(e, n, (e) => r(e) && a(e) === `off`),
    yield* ao(e, n, (e) => r(e) && a(e) === `def`),
    yield* eo(e, n, !1, o, a));
}
function $a(e, t, n, r) {
  let i = Math.min(n.str, r.dStr),
    a = Math.min(1, r.dOrg / Math.max(1, n.org)),
    o = Math.min(t.str, r.aStr),
    s = Math.min(1, r.aOrg / Math.max(1, t.org)),
    c = 8 * i + 6 * a - 7 * o - 3 * s;
  return (
    r.outcome === `destroyed`
      ? (c += 14 + Zt(e, n.hex) * 2)
      : r.outcome === `retreat` && (c += 7 + Zt(e, n.hex) * 1.5),
    n.type === `arm` && (c += 1.5),
    c
  );
}
function* eo(e, t, n, r = Ya, i = (t) => Za(e, t)) {
  for (let a = 0; a < 80; a++) {
    if (e.s.result) return;
    let a = F(e, t),
      o = new Map(),
      s = (t) => {
        let n = o.get(t);
        return (n || ((n = F(e, t)), o.set(t, n)), n);
      },
      c = ft(e, t),
      l = Qt(e, t),
      u = null,
      d = 0;
    for (let o of $t(e, t)) {
      if (
        !r(o) ||
        !wt(e, o) ||
        o.attacked ||
        o.org < it(e, t) * 0.15 ||
        o.str <= 2
      )
        continue;
      let p = i(o) === `off` ? 2.5 : 6,
        m = n && o.mp > 0 ? pt(e, o) : null,
        h = m ? Math.ceil(o.mp) + 1 : 1;
      for (let t of l) {
        if (f(e.m.g, o.hex, t.hex) > h) continue;
        let n = [];
        if ((e.m.nbr[o.hex].includes(t.hex) && n.push(o.hex), m))
          for (let r of e.m.nbr[t.hex])
            r !== o.hex && m.has(r) && ht(e, o, r) && n.push(r);
        for (let r of n) {
          let n = o.hex;
          o.hex = r;
          let i = bt(e, o, t, r, a[r] === 1, s(t.nat)[t.hex] === 1);
          o.hex = n;
          let l = $a(e, o, t, i) + (e.sc.aiBias ? e.sc.aiBias(e, o, t, r) : 0);
          (r !== n &&
            ((l -= 0.25 * m.get(r).c + 0.8 * Math.max(0, c[r] - 1)),
            a[r] || (l -= 3)),
            l - p > d && ((d = l - p), (u = { u: o, e: t, from: r })));
        }
      }
    }
    if (!u) return;
    let p = i(u.u),
      m =
        p === `hold` ||
        (p === `def` &&
          e.m.cityAt[u.from] >= 0 &&
          e.m.cities[e.m.cityAt[u.from]].vp >= 2),
      h = Ot(e, u.u, u.e.hex, u.from, m);
    h.length ? yield h : (u.u.attacked = !0);
  }
}
function* to(e, t) {
  let n = e.s.nations[t],
    r = it(e, t);
  for (let i = 0; i < 12 && n.air > 0 && !e.s.result; i++) {
    let n = null,
      i = 0;
    for (let a of Qt(e, t)) {
      if (a.airHits >= 2) continue;
      let o = 0;
      for (let n of e.s.units)
        M(e, n.nat, t) && e.m.nbr[a.hex].includes(n.hex) && o++;
      if (!o) continue;
      let s =
        o +
        (a.type === `arm` ? 2 : 0) +
        (a.org < r * 0.4 ? 1.5 : 0) +
        Zt(e, a.hex) * 0.3 +
        (10 - a.str) * 0.1;
      s > i && ((i = s), (n = a));
    }
    if (!n) return;
    let a = At(e, t, n.hex);
    if (!a.length) return;
    yield a;
  }
}
function* no(e, t, n = Ya) {
  let r = e.s.nations[t],
    i = F(e, t),
    a = ft(e, t),
    o = $t(e, t)
      .filter((t) => n(t) && t.str <= 6 && i[t.hex] && Ft(e, t))
      .sort((e, t) => e.str - t.str);
  for (let t of o) {
    if (r.pp < 46) break;
    if (a[t.hex] && t.str > 3) continue;
    let n = It(e, t);
    n.length && (yield n);
  }
  let s = Qt(e, t),
    c = Xa(e, t);
  for (let n = 0; n < 3; n++) {
    let i = `inf`;
    c === `off` && t === `GER` && n === 0 && r.pp >= Mt(e, t, `arm`) + 20
      ? (i = `arm`)
      : r.pp < Mt(e, t, `inf`) && r.pp >= Mt(e, t, `cav`) && (i = `cav`);
    let a = Mt(e, t, i);
    if (r.pp < a + (n === 0 ? 0 : 20)) break;
    let o = -1,
      l = -1e9;
    for (let n of e.m.cities) {
      if (!jt(e, t, n.hex)) continue;
      let r = 99;
      for (let t of s) r = Math.min(r, f(e.m.g, n.hex, t.hex));
      let i =
        c === `off`
          ? -r
          : (r <= 6 ? n.vp * 2 - r * 0.3 : n.vp * 0.5) + (n.cap ? 2 : 0);
      i > l && ((l = i), (o = n.hex));
    }
    if (o < 0) break;
    let u = Nt(e, t, i, o);
    if (!u.length) break;
    yield u;
  }
}
function ro(e, t, n) {
  let r = e.m.N,
    i = new Float32Array(r).fill(1e6),
    a = [];
  for (let [e, t] of n) ((i[e] = t), a.push(e));
  for (; a.length;) {
    let n = 0;
    for (let e = 1; e < a.length; e++) i[a[e]] < i[a[n]] && (n = e);
    let r = a.splice(n, 1)[0];
    for (let n of e.m.nbr[r]) {
      if (!y(e.m, n)) continue;
      let o = N(e, n);
      if (!o || !(M(e, t, o) || j(e, t, o))) continue;
      let s = i[r] + C[e.m.terrain[n]].cost.inf + +!!b(e.m, r, n);
      s < i[n] && (i[n] >= 1e6 && a.push(n), (i[n] = s));
    }
  }
  return i;
}
function* io(e, t, n = Ya) {
  let r = (n) => !e.sc.aiTargetFilter || e.sc.aiTargetFilter(e.s, e.m, t, n),
    i = new Map();
  for (let n of e.m.cities)
    j(e, t, N(e, n.hex)) && r(n.hex) && i.set(n.hex, -(4 + n.vp * 1.2));
  let a = new Map();
  for (let n of Qt(e, t)) r(n.hex) && a.set(n.hex, -2);
  for (let n = 0; n < e.m.N; n++)
    y(e.m, n) &&
      j(e, t, N(e, n)) &&
      r(n) &&
      e.m.nbr[n].some((n) => M(e, t, N(e, n))) &&
      !a.has(n) &&
      a.set(n, 0);
  let o = i.size ? ro(e, t, i) : new Float32Array(e.m.N),
    s = a.size ? ro(e, t, a) : new Float32Array(e.m.N),
    c = F(e, t),
    l = it(e, t),
    u = { arm: 0, mot: 1, cav: 2, inf: 3 },
    d = $t(e, t)
      .filter((t) => n(t) && wt(e, t) && t.mp > 0)
      .sort((e, t) => u[e.type] - u[t.type] || o[e.hex] - o[t.hex]),
    f = new Set();
  for (let n of $t(e, t)) d.includes(n) || f.add(n.hex);
  for (let n of d) {
    if (e.s.result) return;
    let i = pt(e, n),
      a = ft(e, t),
      u = n.str <= 4 || n.org < 0.3 * l,
      d = n.type === `arm` || n.type === `mot`,
      p = d ? 0.75 : 0.45,
      m = n.hex,
      h = -1e9;
    for (let [l] of i) {
      if (!ht(e, n, l)) continue;
      let i = -(p * Math.min(o[l], 300) + (1 - p) * Math.min(s[l], 300));
      if (j(e, t, N(e, l))) {
        i += 0.4;
        let t = e.m.cityAt[l];
        t >= 0 && r(l) && (i += 3 + e.m.cities[t].vp);
      }
      i -= u ? 2.5 * a[l] : 0.35 * Math.max(0, a[l] - 1);
      let g = 0;
      for (let t of e.m.nbr[l]) f.has(t) && g++;
      ((i -= 0.5 * g),
        c[l] || (i -= d ? 1 : 2.5),
        l === n.hex && (i += u ? 1.5 : 0.2),
        i > h && ((h = i), (m = l)));
    }
    if ((f.add(m), m !== n.hex)) {
      let t = Tt(e, n, m);
      t.length && (yield t);
    }
  }
}
function* ao(e, t, n = Ya) {
  let { m: r } = e,
    i = r.N,
    a = F(e, t),
    o = Qt(e, t),
    s = new Uint8Array(i),
    c = new Float32Array(i);
  for (let n = 0; n < i; n++)
    if (y(r, n) && M(e, t, N(e, n))) {
      r.nbr[n].some((n) => y(r, n) && j(e, t, N(e, n))) && (s[n] = 1);
      for (let e of o) {
        let t = f(r.g, n, e.hex);
        t < 4 && (c[n] += ((e.str / 10) * (4 - t)) / 4);
      }
    }
  let l = it(e, t),
    u = $t(e, t),
    d = u.filter((t) => n(t) && wt(e, t) && t.mp > 0),
    p = new Set();
  for (let e of u) d.includes(e) || p.add(e.hex);
  let m = r.cities.find((n) => n.cap && n.nat === t && N(e, n.hex) === t);
  if (
    m &&
    !u.some((e) => e.hex === m.hex) &&
    o.some((e) => f(r.g, e.hex, m.hex) <= 6)
  ) {
    let t = null,
      n = 1e9;
    for (let r of d) {
      let i = pt(e, r).get(m.hex);
      i && i.c < n && ht(e, r, m.hex) && ((n = i.c), (t = r));
    }
    if (t) {
      (p.add(m.hex), d.splice(d.indexOf(t), 1));
      let n = Tt(e, t, m.hex);
      n.length && (yield n);
    }
  }
  let h = ft(e, t);
  d.sort((e, t) => h[t.hex] - h[e.hex] || c[t.hex] - c[e.hex]);
  for (let n of d) {
    if (e.s.result) return;
    let i = pt(e, n),
      o = ft(e, t),
      u = n.str <= 3 || n.org < 0.3 * l,
      d = n.hex,
      f = -1e9;
    for (let [l, m] of i) {
      if (!ht(e, n, l) || (p.has(l) && l !== n.hex)) continue;
      let i = 0;
      if (u)
        i =
          -3 * o[l] +
          (a[l] ? 2 : -4) -
          c[l] * 2 +
          +(r.cityAt[l] >= 0) +
          (l === n.hex ? 0.5 : 0);
      else {
        ((i += s[l] ? 4 : 0),
          (i += (C[r.terrain[l]].def - 1) * 6 + (e.s.forts[l] || 0) * 2));
        for (let n of r.nbr[l])
          y(r, n) && j(e, t, N(e, n)) && b(r, l, n) && (i += 1.2);
        ((i -= 1.8 * Math.max(0, o[l] - 1)), a[l] || (i -= 6));
        let u = r.cityAt[l];
        u >= 0 && (i += r.cities[u].vp * (c[l] > 0.3 ? 1.2 : 0.4));
        let d = 0;
        for (let e of r.nbr[l]) p.has(e) && d++;
        ((i += s[l] ? (d === 0 ? 2 : d === 1 ? 1 : -0.5 * d) : -0.5 * d),
          (i += Math.min(3, c[l]) * 1.2),
          j(e, t, N(e, l)) && (i += 0.5),
          l === n.hex && (i += n.entrench * 1 + 0.3),
          (i -= m.c * 0.1));
      }
      i > f && ((f = i), (d = l));
    }
    if ((p.add(d), d !== n.hex)) {
      let t = Tt(e, n, d);
      t.length && (yield t);
    }
  }
}
var oo = null,
  so = localStorage.getItem(`wf_sound`) !== `0`,
  co = {
    get on() {
      return so;
    },
    set on(e) {
      ((so = e), localStorage.setItem(`wf_sound`, e ? `1` : `0`));
    },
  };
function lo() {
  if (!so) return null;
  if (!oo)
    try {
      oo = new (window.AudioContext || window.webkitAudioContext)();
    } catch {
      return null;
    }
  return (oo.state === `suspended` && oo.resume(), oo);
}
function X(e, t, n = `square`, r = 0.06, i = 0, a = 0) {
  let o = lo();
  if (!o) return;
  let s = o.currentTime + a,
    c = o.createOscillator(),
    l = o.createGain();
  ((c.type = n),
    c.frequency.setValueAtTime(e, s),
    i && c.frequency.exponentialRampToValueAtTime(Math.max(30, e + i), s + t),
    l.gain.setValueAtTime(r, s),
    l.gain.exponentialRampToValueAtTime(1e-4, s + t),
    c.connect(l).connect(o.destination),
    c.start(s),
    c.stop(s + t + 0.02));
}
function uo(e, t = 0.18, n = 900, r = 0) {
  let i = lo();
  if (!i) return;
  let a = i.currentTime + r,
    o = Math.floor(i.sampleRate * e),
    s = i.createBuffer(1, o, i.sampleRate),
    c = s.getChannelData(0);
  for (let e = 0; e < o; e++) c[e] = (Math.random() * 2 - 1) * (1 - e / o) ** 2;
  let l = i.createBufferSource();
  l.buffer = s;
  let u = i.createBiquadFilter();
  ((u.type = `lowpass`), (u.frequency.value = n));
  let d = i.createGain();
  ((d.gain.value = t),
    l.connect(u).connect(d).connect(i.destination),
    l.start(a));
}
var Z = {
  click: () => X(660, 0.05, `square`, 0.03),
  select: () => {
    (X(520, 0.05, `square`, 0.035), X(780, 0.06, `square`, 0.03, 0, 0.05));
  },
  move: () => X(300, 0.06, `triangle`, 0.05, -120),
  boom: () => {
    (uo(0.45, 0.22, 700), X(90, 0.3, `sine`, 0.12, -50));
  },
  bigBoom: () => {
    (uo(0.8, 0.28, 500), X(70, 0.5, `sine`, 0.15, -40));
  },
  capture: () => {
    (X(523, 0.08, `square`, 0.035), X(784, 0.12, `square`, 0.035, 0, 0.08));
  },
  turn: () => {
    (X(392, 0.1, `square`, 0.04),
      X(523, 0.1, `square`, 0.04, 0, 0.1),
      X(659, 0.18, `square`, 0.04, 0, 0.2));
  },
  plane: () => X(180, 0.6, `sawtooth`, 0.025, 120),
  error: () => X(150, 0.12, `square`, 0.04),
  win: () => {
    [523, 659, 784, 1046].forEach((e, t) =>
      X(e, 0.18, `square`, 0.045, 0, t * 0.15),
    );
  },
  tele: () => {
    [0.07, 0.07, 0.18, 0.07, 0.18, 0.18].reduce(
      (e, t) => (X(1180, t, `sine`, 0.035, 0, e), e + t + 0.06),
      0,
    );
  },
  lose: () => {
    [392, 330, 262, 196].forEach((e, t) =>
      X(e, 0.25, `triangle`, 0.06, 0, t * 0.2),
    );
  },
};
function fo(e, t = 0) {
  let n = document.createElement(`canvas`);
  ((n.width = e.w), (n.height = e.h));
  let r = n.getContext(`2d`),
    i = r.createImageData(e.w, e.h);
  return (
    i.data.set(e.data),
    r.putImageData(i, 0, 0),
    t && ((n.style.width = e.w * t + `px`), (n.style.height = e.h * t + `px`)),
    n
  );
}
var po = (e) => T(e.flag, e.flagPal),
  mo = (e, t = 2) => fo(po(e), t),
  ho = {
    gear: [
      `...yy...`,
      `.yyyyyy.`,
      `.yy..yy.`,
      `yy....yy`,
      `yy....yy`,
      `.yy..yy.`,
      `.yyyyyy.`,
      `...yy...`,
    ],
    plane: [
      `.....w.....`,
      `....www....`,
      `wwwwwwwwwww`,
      `.wwwwwwwww.`,
      `.....w.....`,
      `.....w.....`,
      `...wwwww...`,
      `....w.w....`,
    ],
    star: [
      `....y....`,
      `....y....`,
      `...yyy...`,
      `yyyyyyyyy`,
      `.yyyyyyy.`,
      `..yyyyy..`,
      `..yyyyy..`,
      `.yyy.yyy.`,
      `.yy...yy.`,
    ],
    menu: [
      `wwwwwwwwww`,
      `wwwwwwwwww`,
      `..........`,
      `wwwwwwwwww`,
      `wwwwwwwwww`,
      `..........`,
      `wwwwwwwwww`,
      `wwwwwwwwww`,
    ],
    undo: [
      `...w......`,
      `..ww......`,
      `.wwwwwww..`,
      `wwwwwwwww.`,
      `.wwwwwwwww`,
      `..ww....ww`,
      `...w....ww`,
      `........ww`,
      `......www.`,
      `.....ww...`,
    ],
    truck: [
      `gggggggg....`,
      `gggggggg.ww.`,
      `gggggggg.wbw`,
      `gggggggg.www`,
      `ggggggggwwww`,
      `llllllllllll`,
      `.ll.....ll..`,
      `.ll.....ll..`,
    ],
    next: [
      `....w....`,
      `..wwwww..`,
      `.w..w..w.`,
      `.w.....w.`,
      `ww.www.ww`,
      `.w.....w.`,
      `.w..w..w.`,
      `..wwwww..`,
      `....w....`,
    ],
    ff: [
      `w....w....`,
      `ww...ww...`,
      `www..www..`,
      `wwww.wwww.`,
      `www..www..`,
      `ww...ww...`,
      `w....w....`,
    ],
    check: [
      `.......g`,
      `......gg`,
      `g....gg.`,
      `gg..gg..`,
      `.gggg...`,
      `..gg....`,
    ],
    cross: [`rr...rr`, `.rr.rr.`, `..rrr..`, `.rr.rr.`, `rr...rr`],
    dot: [`.yy.`, `yyyy`, `yyyy`, `.yy.`],
    sword: [
      `.......ww`,
      `......www`,
      `.....www.`,
      `y...www..`,
      `.y.www...`,
      `..yww....`,
      `..yy.....`,
      `.y..y....`,
      `y........`,
    ],
    shield: [
      `wwwwwww`,
      `wbbbbbw`,
      `wbbbbbw`,
      `wbbbbbw`,
      `.wbbbw.`,
      `..wbw..`,
      `...w...`,
    ],
    crate: [
      `mmmmmmmmm`,
      `mnnnnnnnm`,
      `mnmnnnmnm`,
      `mnnmnmnnm`,
      `mnnnmnnnm`,
      `mnnmnmnnm`,
      `mnmnnnmnm`,
      `mnnnnnnnm`,
      `mmmmmmmmm`,
    ],
    tele: [
      `dddddddddd`,
      `dpdppppdpd`,
      `dppdppdppd`,
      `dpppddpppd`,
      `dppppppppd`,
      `dppppppppd`,
      `dddddddddd`,
    ],
    order: [
      `ddddddddd`,
      `.ppppppp.`,
      `.pooooop.`,
      `.ppppppp.`,
      `.pooooop.`,
      `.ppppppp.`,
      `.poppsrp.`,
      `.ppprrrp.`,
      `ddddddddd`,
    ],
    trust: [
      `....rr...`,
      `....rrr..`,
      `....l....`,
      `...lll...`,
      `.lllllll.`,
      `lllllllll`,
      `.l.l.l.l.`,
      `.l.l.l.l.`,
      `lllllllll`,
    ],
    auth: [
      `...hhh...`,
      `.hhhhhhh.`,
      `.hhhhhhh.`,
      `hhhhhhhhh`,
      `hhhhhhhhh`,
      `jjjjjjjjj`,
      `..j...j..`,
    ],
    fame: [
      `..rrwrr..`,
      `..rrwrr..`,
      `...rwr...`,
      `....y....`,
      `..yyyyy..`,
      `.yyydyyy.`,
      `.yydddyy.`,
      `.yyydyyy.`,
      `..yyyyy..`,
    ],
    clock: [
      `..www..`,
      `.w...w.`,
      `w..w..w`,
      `w..ww.w`,
      `w.....w`,
      `.w...w.`,
      `..www..`,
    ],
    sun: [
      `..y..y..`,
      `...yy...`,
      `y.yyyy.y`,
      `.yyyyyy.`,
      `.yyyyyy.`,
      `y.yyyy.y`,
      `...yy...`,
      `..y..y..`,
    ],
    rain: [
      `..llll...`,
      `.llllll..`,
      `lllllllll`,
      `lllllllll`,
      `.b..b..b.`,
      `b..b..b..`,
      `.b..b..b.`,
    ],
    mud: [
      `..llll...`,
      `.llllll..`,
      `lllllllll`,
      `.b..b..b.`,
      `nnnnnnnnn`,
      `mnmmnmmnm`,
      `mmmmmmmmm`,
    ],
    snow: [
      `....w....`,
      `.w..w..w.`,
      `..w.w.w..`,
      `...www...`,
      `wwwwwwwww`,
      `...www...`,
      `..w.w.w..`,
      `.w..w..w.`,
      `....w....`,
    ],
    frost: [
      `....b....`,
      `.b..b..b.`,
      `..b.b.b..`,
      `...bwb...`,
      `bbbbwbbbb`,
      `...bwb...`,
      `..b.b.b..`,
      `.b..b..b.`,
      `....b....`,
    ],
    guard: [
      `yyyyyyyyy`,
      `qkqkqkqkq`,
      `qkqkqkqkq`,
      `qkqkqkqkq`,
      `.qkqkqkq.`,
      `..qkqkq..`,
      `...qkq...`,
    ],
    hero: [
      `rrrrrrr`,
      `rrrrrrr`,
      `...y...`,
      `..yyy..`,
      `yyyyyyy`,
      `.yyyyy.`,
      `.yy.yy.`,
    ],
    book: [
      `.dddddddd.`,
      `dppppppppd`,
      `dpoooooopd`,
      `dppppppppd`,
      `dpoooooopd`,
      `dppppppppd`,
      `dpooooppd.`,
      `dppppppppd`,
      `.dddddddd.`,
    ],
    lock: [
      `..lll..`,
      `.l...l.`,
      `.l...l.`,
      `yyyyyyy`,
      `yyydyyy`,
      `yyydyyy`,
      `yyyyyyy`,
    ],
  },
  go = {
    w: `#eef0f2`,
    y: `#e3c25a`,
    d: `#8a6d22`,
    k: `#16181a`,
    g: `#7fbf5a`,
    b: `#7fb8e6`,
    r: `#e0574b`,
    l: `#b8bec4`,
    o: `#4a5058`,
    m: `#5e3b1c`,
    n: `#b07a3e`,
    p: `#e9dfc2`,
    s: `#f08a7a`,
    h: `#8d9a52`,
    j: `#4f5a2c`,
    q: `#f08a1c`,
  };
ho.star_off = ho.star.map((e) => e.replace(/y/g, `o`));
ho.fmap = [`kkkkkkkkkk`, `kpphhggbbk`, `kphhrggbbk`, `khhrgggbbk`, `kghrggbbpk`, `kggrgbbppk`, `kgrggbpppk`, `kgrgbbpphk`, `kkkkkkkkkk`];
function _o(e, t = 2) {
  let n = fo(T(ho[e], go), t);
  return ((n.className = `ico`), n);
}
var vo = {};
function Q(e, t = 2) {
  let n = ho[e],
    r = Math.max(...n.map((e) => e.length)),
    i = n.length;
  return `<img class="ii" src="${vo[e] || (vo[e] = fo(T(n, go)).toDataURL())}" style="width:${r * t}px;height:${i * t}px" alt="">`;
}
function yo(e, t) {
  let n = le(32, 24),
    r = (e, t, r, i) => {
      for (let a = r; a < i; a++)
        E(n, 0, a, 32, 1, se(e, t, (a - r) / Math.max(1, i - r - 1)));
    },
    i = (e, t, r, i, a = 0) => {
      for (let o = Math.floor(t - r); o <= t + r; o++)
        for (let s = Math.floor(e - r); s <= e + r; s++)
          s < 0 ||
            o < 0 ||
            s >= 32 ||
            o >= 24 ||
            (s - e) ** 2 + (o - t) ** 2 > r * r ||
            (a && (s * 7 + o * 13) % a == 0) ||
            E(n, s, o, 1, 1, i);
    };
  if (e === `war`) {
    r(`#2a2038`, `#d0703a`, 0, 17);
    for (let [e, t] of [
      [3, 7],
      [21, 10],
      [27, 5],
    ])
      for (let r = 0; r < t; r++)
        E(n, e + ((r >> 1) & 1), 17 - t + r, 2, 1, `#3a3036`);
    (E(n, 0, 17, 32, 7, `#3d3322`), E(n, 0, 17, 32, 1, `#5a4a2e`));
    for (let e = 0; e < 32; e += 3) E(n, e, 19 + (e % 2) * 2, 1, 1, `#2c2418`);
    (ue(n, he(`arm`, t), 7, 8),
      E(n, 24, 10, 3, 1, `#fff3b0`),
      E(n, 25, 9, 1, 3, `#ffd34d`));
  } else if (e === `battle`) {
    (r(`#1d1a1c`, `#5a3a2a`, 0, 18),
      E(n, 0, 18, 32, 6, `#2e2a22`),
      E(n, 0, 18, 32, 1, `#463d2e`),
      i(9, 6, 4, `#4d4a47`, 3),
      i(23, 5, 5, `#5a5653`, 3),
      i(16, 13, 8.5, `#c8452a`),
      i(16, 13, 6.5, `#ff8a2a`),
      i(16, 13, 4.2, `#ffd34d`),
      i(16, 13, 2, `#fff6c0`));
    for (let [e, t] of [
      [4, 9],
      [28, 10],
      [6, 16],
      [26, 15],
      [16, 2],
      [10, 3],
    ])
      E(n, e, t, 1, 1, `#ffb04a`);
    for (let e = 1; e < 32; e += 4) E(n, e, 21, 2, 1, `#1d1a16`);
  } else {
    (r(`#2b3a4a`, `#1c2530`, 0, 24),
      E(n, 10, 4, 14, 18, `#10151b`),
      E(n, 9, 3, 14, 18, `#e9dfc2`),
      E(n, 9, 3, 14, 1, `#f6efd9`));
    for (let e of [6, 8, 10, 12, 14])
      E(n, 11, e, e === 14 ? 6 : 10, 1, `#8a8068`);
    (i(19.5, 17.5, 2.6, `#b8322a`),
      E(n, 18, 16, 1, 1, `#e06a5a`),
      E(n, 25, 6, 1, 12, `#c9a24a`),
      E(n, 25, 18, 1, 2, `#3a3a3a`));
  }
  return fo(n);
}
function bo() {
  let e = le(20, 20);
  for (let t = 0; t < 20; t++)
    E(e, 0, t, 20, 1, se(`#41566e`, `#18212b`, t / 19));
  let t = `#5d6036`,
    n = `#474a28`,
    r = `#e2b58c`,
    i = `#c3926a`;
  (E(e, 2, 16, 16, 4, t),
    E(e, 0, 17, 20, 3, t),
    E(e, 0, 17, 1, 3, n),
    E(e, 19, 17, 1, 3, n),
    E(e, 1, 16, 1, 1, t),
    E(e, 18, 16, 1, 1, t),
    E(e, 5, 14, 4, 3, n),
    E(e, 11, 14, 4, 3, n));
  for (let [t, n] of [
    [5, 15],
    [6, 16],
    [7, 15],
    [8, 16],
    [12, 15],
    [13, 16],
    [14, 15],
    [11, 16],
  ])
    E(e, t, n, 1, 1, `#d8dde2`);
  return (
    E(e, 9, 15, 2, 5, `#3a3d22`),
    E(e, 9, 17, 2, 1, `#b8a060`),
    E(e, 9, 19, 2, 1, `#b8a060`),
    E(e, 2, 16, 3, 1, `#b8a060`),
    E(e, 15, 16, 3, 1, `#b8a060`),
    E(e, 8, 12, 4, 3, i),
    E(e, 6, 6, 8, 7, r),
    E(e, 7, 13, 6, 1, r),
    E(e, 13, 7, 1, 6, i),
    E(e, 5, 8, 1, 3, i),
    E(e, 14, 8, 1, 3, i),
    E(e, 7, 8, 2, 1, `#5a3d26`),
    E(e, 11, 8, 2, 1, `#5a3d26`),
    E(e, 7, 9, 2, 1, `#f4ece0`),
    E(e, 11, 9, 2, 1, `#f4ece0`),
    E(e, 8, 9, 1, 1, `#24180f`),
    E(e, 11, 9, 1, 1, `#24180f`),
    E(e, 10, 10, 1, 2, i),
    E(e, 8, 12, 4, 1, `#a46a52`),
    E(e, 7, 11, 1, 1, i),
    E(e, 12, 11, 1, 1, i),
    E(e, 3, 0, 14, 2, `#7d8048`),
    E(e, 3, 0, 14, 1, `#959860`),
    E(e, 2, 1, 1, 1, `#6a6d3c`),
    E(e, 17, 1, 1, 1, `#6a6d3c`),
    E(e, 4, 2, 12, 3, `#6b6e3c`),
    E(e, 4, 2, 1, 3, `#585b30`),
    E(e, 15, 2, 1, 3, `#585b30`),
    E(e, 5, 5, 10, 1, `#3e4124`),
    E(e, 5, 5, 10, 1, `#4a4d2a`),
    E(e, 9, 2, 2, 2, `#e6e6e6`),
    E(e, 9, 4, 2, 1, `#b0b0b0`),
    E(e, 5, 6, 10, 1, `#1c1c14`),
    E(e, 6, 7, 8, 1, `#c3926a`),
    e
  );
}
function xo(e) {
  let t = le(20, 20),
    n = e.rank ?? 0,
    r = e.year ?? 1941,
    i = e.seed ?? 0;
  for (let e = 0; e < 20; e++)
    E(t, 0, e, 20, 1, se(`#5b4038`, `#1c1614`, e / 19));
  let a = r >= 1943 ? `#706c40` : `#67643a`,
    o = `#4c4a28`,
    s = [
      [`#e2b58c`, `#c3926a`],
      [`#ebc39d`, `#c99d78`],
      [`#d6a47e`, `#b5835d`],
    ][i % 3],
    c = s[0],
    l = s[1];
  if (
    (E(t, 2, 16, 16, 4, a),
    E(t, 0, 17, 20, 3, a),
    E(t, 0, 17, 1, 3, o),
    E(t, 19, 17, 1, 3, o),
    E(t, 1, 16, 1, 1, a),
    E(t, 18, 16, 1, 1, a),
    E(t, 10, 17, 1, 1, `#c9a24a`),
    E(t, 10, 19, 1, 1, `#c9a24a`),
    r < 1943)
  ) {
    (E(t, 5, 14, 4, 3, o),
      E(t, 11, 14, 4, 3, o),
      E(t, 5, 15, 4, 2, `#b8322a`),
      E(t, 11, 15, 4, 2, `#b8322a`),
      E(t, 5, 14, 4, 1, `#c9a24a`),
      E(t, 11, 14, 4, 1, `#c9a24a`));
    let e = Math.min(4, n + 2);
    for (let n = 0; n < Math.min(2, e); n++)
      (E(t, 6 + n * 2, 15, 1, 1, `#ffd84a`),
        E(t, 12 + n * 2, 15, 1, 1, `#ffd84a`));
    for (let n = 2; n < e; n++)
      (E(t, 2 + n * 2, 16, 1, 1, `#ffd84a`),
        E(t, 8 + n * 2, 16, 1, 1, `#ffd84a`));
  } else if (
    (E(t, 6, 14, 8, 2, o),
    E(t, 6, 14, 8, 1, `#b8322a`),
    E(t, 1, 16, 5, 2, `#d4b04a`),
    E(t, 14, 16, 5, 2, `#d4b04a`),
    E(t, 1, 17, 5, 1, `#a8862c`),
    E(t, 14, 17, 5, 1, `#a8862c`),
    n >= 4)
  )
    (E(t, 2, 16, 3, 2, `#fff0a0`),
      E(t, 15, 16, 3, 2, `#fff0a0`),
      E(t, 9, 15, 2, 1, `#fff6c0`));
  else
    for (let e = 0; e <= n; e++)
      (E(t, 1 + e, 16, 1, 1, `#8a8f96`), E(t, 18 - e, 16, 1, 1, `#8a8f96`));
  let u = Math.min(6, e.bars ?? 0),
    d = [`#c8202a`, `#2e7a3a`, `#2a4a8a`, `#e8c34a`, `#8a1c24`, `#f08a1c`];
  for (let e = 0; e < u; e++)
    E(t, 3 + (e % 3) * 2, 18 + Math.floor(e / 3), 2, 1, d[(e + i) % d.length]);
  for (let n = 0; n < Math.min(3, e.hero ?? 0); n++)
    (E(t, 14 + n * 2, 18, 1, 1, `#ffd84a`),
      E(t, 14 + n * 2, 19, 1, 1, `#c9a24a`));
  (E(t, 8, 12, 4, 3, l),
    E(t, 6, 6, 8, 7, c),
    E(t, 7, 13, 6, 1, c),
    E(t, 13, 7, 1, 6, l),
    E(t, 5, 8, 1, 3, l),
    E(t, 14, 8, 1, 3, l),
    E(t, 7, 8, 2, 1, `#5a3d26`),
    E(t, 11, 8, 2, 1, `#5a3d26`),
    E(t, 7, 9, 2, 1, `#f4ece0`),
    E(t, 11, 9, 2, 1, `#f4ece0`),
    E(t, 8, 9, 1, 1, `#24180f`),
    E(t, 11, 9, 1, 1, `#24180f`),
    E(t, 10, 10, 1, 2, l),
    E(t, 8, 12, 4, 1, `#a46a52`),
    E(t, 7, 11, 1, 1, l),
    E(t, 12, 11, 1, 1, l),
    i % 4 == 1 && E(t, 8, 11, 4, 1, `#5a3d26`),
    r >= 1944 && (E(t, 5, 7, 1, 2, `#b9b9b9`), E(t, 14, 7, 1, 2, `#b9b9b9`)));
  let f = `#87844f`;
  return (
    E(t, 2, 1, 16, 2, `#6e6b3e`),
    E(t, 3, 0, 14, 1, f),
    E(t, 2, 1, 16, 1, f),
    E(t, 4, 3, 12, 2, `#b8322a`),
    E(t, 4, 3, 12, 1, `#cf4a3c`),
    E(t, 9, 2, 2, 2, `#ffd84a`),
    E(t, 9, 4, 2, 1, `#c9a24a`),
    E(t, 5, 5, 10, 1, `#1c1c14`),
    E(t, 6, 6, 8, 1, `#26261c`),
    E(t, 6, 7, 8, 1, l),
    t
  );
}
var So = {},
  Co = (e) =>
    e?.sov
      ? `s${e.rank ?? 0}-${(e.year ?? 1941) >= 1944 ? 2 : +((e.year ?? 1941) >= 1943)}-${e.hero ?? 0}-${Math.min(6, e.bars ?? 0)}-${e.seed ?? 0}`
      : `pl`;
function wo(e = 2, t = `ii`, n) {
  let r = Co(n);
  return `<img class="${t}" src="${So[r] || (So[r] = fo(n?.sov ? xo(n) : bo()).toDataURL())}" style="width:${20 * e}px;height:${20 * e}px" alt="">`;
}
var To = [
  [
    /«Победа»/,
    `linear-gradient(90deg,#f08a1c 0 15%,#1a1a1a 15% 29%,#2a4a8a 29% 43%,#8a1c24 43% 57%,#c8202a 57% 71%,#2e7a3a 71% 85%,#b8b8b8 85%)`,
  ],
  [/Героя|Золотая/, `linear-gradient(90deg,#c8202a 0 100%)`],
  [
    /Ленина/,
    `linear-gradient(90deg,#e8c34a 0 12%,#b8202a 12% 88%,#e8c34a 88%)`,
  ],
  [
    /Красного Знамени/,
    `linear-gradient(90deg,#f4f4f4 0 9%,#c8202a 9% 42%,#f4f4f4 42% 58%,#c8202a 58% 91%,#f4f4f4 91%)`,
  ],
  [
    /Красной Звезды/,
    `linear-gradient(90deg,#8a1c24 0 40%,#a8a8a8 40% 60%,#8a1c24 60%)`,
  ],
  [
    /Суворова I /,
    `linear-gradient(90deg,#2e7a3a 0 40%,#f08a1c 40% 60%,#2e7a3a 60%)`,
  ],
  [
    /Суворова II/,
    `linear-gradient(90deg,#f08a1c 0 12%,#2e7a3a 12% 88%,#f08a1c 88%)`,
  ],
  [
    /Кутузова/,
    `linear-gradient(90deg,#2a4a8a 0 40%,#f08a1c 40% 60%,#2a4a8a 60%)`,
  ],
  [
    /Москвы/,
    `linear-gradient(90deg,#c8202a 0 30%,#3a8a3a 30% 70%,#c8202a 70%)`,
  ],
  [
    /Сталинграда/,
    `linear-gradient(90deg,#8a8a3a 0 40%,#c8202a 40% 60%,#8a8a3a 60%)`,
  ],
  [
    /Берлина/,
    `linear-gradient(90deg,#c8202a 0 35%,#1a1a1a 35% 65%,#c8202a 65%)`,
  ],
  [
    /Virtuti/,
    `linear-gradient(90deg,#1c3a8a 0 15%,#1a1a1a 15% 85%,#1c3a8a 85%)`,
  ],
  [
    /Храбрых/,
    `linear-gradient(90deg,#c8202a 0 20%,#f4f4f4 20% 35%,#c8202a 35% 65%,#f4f4f4 65% 80%,#c8202a 80%)`,
  ],
];
function Eo(e) {
  let t =
    To.find(([t]) => t.test(e))?.[1] ||
    `linear-gradient(90deg,#c8202a,#e8c34a)`;
  return `<span class="rib${/Героя|Золотая/.test(e) ? ` hero` : ``}" title="${e.replace(/"/g, `&quot;`)}" style="background:${t}"></span>`;
}
var Do = `wf_save_v1`,
  Oo = (e) =>
    `${e} ${e % 10 == 1 && e % 100 != 11 ? `приказ` : e % 10 >= 2 && e % 10 <= 4 && (e % 100 < 12 || e % 100 > 14) ? `приказа` : `приказов`}`,
  ko = `v0.9 · прототип`,
  Ao = {
    smolensk41: Ua,
    moscow41: Wa,
    stalingrad42: Ga,
    kursk43: Ka,
    bagration44: qa,
    berlin45: Ja,
    kharkov42: __MAP_kharkov42,
    rzhev42: __MAP_rzhev42,
  },
  jo = (e) => {
    let t = 7;
    for (let n of e) t = (t * 31 + n.charCodeAt(0)) >>> 0;
    return t;
  },
  Mo = [
    [`off`, `Наступать`, `атакует при малейшем перевесе и продвигается вперёд`],
    [
      `def`,
      `Обороняться`,
      `держит фронт и контратакует только при явном перевесе`,
    ],
    [`hold`, `Стоять насмерть`, `не сходит с позиций, бьёт только с места`],
  ],
  No = {
    order: `order`,
    ok: `check`,
    no: `cross`,
    done: `star`,
    fail: `cross`,
    news: `tele`,
    loss: `cross`,
    gain: `fame`,
    info: `trust`,
    wx: `sun`,
  },
  Po = [`Лёгкая`, `Нормальная`, `Сложная`],
  Fo = [`inf`, `cav`, `mot`, `arm`],
  Io = (e) => new Promise((t) => setTimeout(t, e)),
  Lo = { "&": `&amp;`, "<": `&lt;`, ">": `&gt;`, '"': `&quot;` },
  $ = (e) => e.replace(/[&<>"]/g, (e) => Lo[e]),
  Ro = (e) => $(e).replace(/⚙/g, Q(`gear`)).replace(/✈/g, Q(`plane`)),
  zo = () => `<h2>Как играть</h2><ul class="help">
<li><b>Ход дивизии.</b> Нажмите на свою дивизию. Белые гексы — куда можно пойти, красные — враги для атаки, оранжевые — атака с ходу (дивизия сначала подойдёт).</li>
<li><b>Прогноз боя.</b> Перед атакой видны ожидаемые потери, соотношение сил и все модификаторы. Перемещения можно отменить, атаки — нет.</li>
<li><b>Сила и организация.</b> Цифра на фишке — сила (0–10), полоска — организация. В бою она падает; при нуле дивизия отступает, а если отступать некуда — сдаётся.</li>
<li><b>Зоны контроля.</b> Вход в гекс рядом с врагом останавливает движение. Танки, мотопехота и кавалерия после победы могут идти дальше — это блицкриг.</li>
<li><b>Снабжение</b> ${Q(`truck`)} Кнопка с грузовиком справа включает слой снабжения: зелёные точки — снабжение есть, красная штриховка — нет, яркие рамки — источники (столица, порты, узловые города). Снабжение идёт от источников по своей территории, вражеские войска перекрывают путь. Дивизия без снабжения помечена красным знаком «!» на фишке: она теряет организацию, а с 3-го хода — и силу. Окружайте врага!</li>
<li><b>Окопы.</b> Дивизия, простоявшая ход на месте (без движения и атаки), окапывается — под фишкой появляются мешки с песком: один ряд — +10% к обороне, два ряда — +20%. Движение или атака окопы сбрасывают. Состояние снабжения и окопов видно в карточке дивизии.</li>
<li><b>Местность.</b> Леса, холмы, горы, болота и города усиливают оборону, атака через реку тяжелее, танки слабее вне равнин.</li>
<li><b>Фланги.</b> Каждая своя дивизия рядом с целью даёт +10% к атаке (до +30%).</li>
<li><b>Промышленность</b> ${Q(`gear`)} — набор дивизий в крупных городах (нажмите на шестерёнку вверху) и пополнение потрёпанных частей (кнопка в карточке дивизии).</li>
<li><b>Авиация</b> ${Q(`plane`)} — удары по любой вражеской дивизии: снижают организацию, иногда и силу.</li>
<li><b>Управление.</b> Перетаскивание — прокрутка, щипок или колесо — масштаб, долгое нажатие на врага — дальность его хода.</li></ul>`,
  Bo = () => `<h2>Карьера генерала</h2><ul class="help">
<li><b>Ваша армия.</b> Вы командуете только своей армией — её фишки яркие. Соседние армии (блёклые фишки с тёмным уголком) ведёт компьютер: их можно осмотреть, но приказывать им нельзя.</li>
<li><b>Приказы Ставки</b> ${Q(`order`)} — задачи со сроком (кнопка вверху справа). Район приказа обведён на карте золотой пунктирной рамкой. Бывают приказы удержать город, взять город (иногда — именно вашими войсками), выйти в район, очистить район от противника до конца хода, разгромить N вражеских соединений. Выполнение повышает репутацию, провал — снижает.</li>
<li><b>Телеграф</b> ${Q(`tele`)} — раз в ход можно попросить помощи: боеприпасы, авиацию, подкрепление, отсрочку. Ответ приходит в начале следующего хода. Срочные запросы (красная кнопка) отвечают сразу. Шанс зависит от Доверия и Славы, одобренный запрос тратит Доверие.</li>
<li><b>Репутация.</b> ${Q(`trust`)} Доверие Ставки — запасы каждый ход и шансы запросов; при нуле вас отстранят. ${Q(`auth`)} Авторитет в войсках — восстановление организации и сила в бою. ${Q(`fame`)} Слава — награды и шансы запросов. Нажмите на портрет или на цифры вверху — откроется штаб с подробностями.</li>
<li><b>Запасы</b> ${Q(`crate`)} идут на пополнение потрёпанных дивизий вашей армии. А если армию окружат, дивизии питаются из запасов (2 за дивизию в ход) и сражаются в полную силу, пока запасы не кончатся. Набора новых дивизий в карьере нет — берегите войска.</li>
<li><b>Погода</b> ${Q(`sun`)}${Q(`rain`)}${Q(`snow`)}${Q(`frost`)} — значок рядом с номером хода, а на карте — дождь или снег. Действует на обе стороны: ${Q(`rain`)} дожди — танки и мотопехота −1 к ходу, авиаударов вдвое меньше; ${Q(`snow`)} снегопад — техника −1 к ходу, авиации меньше; ${Q(`frost`)} сильный мороз — техника −1 к ходу, авиации вдвое меньше, а немцы атакуют на 20% слабее и вдвое медленнее восстанавливают организацию; ${Q(`mud`)} распутица — все −1 к ходу (техника −2), атака техники −15%, авиация почти не летает. О смене погоды предупреждает телеграмма, прогноз на следующие ходы — в окне приказов. Запрошенная авиация в непогоду тоже прилетает не вся.</li>
<li><b>Гвардия</b> ${Q(`guard`)} — оранжево-чёрная ленточка на фишке: +10% к атаке и обороне. В карьере «Красная армия» самые опытные дивизии после операции становятся гвардейскими и переходят с вами дальше. Погибшая гвардейская дивизия выбывает навсегда.</li>
<li><b>Армии фронта.</b> В некоторых операциях вы командуете фронтом: в штабе (нажмите на портрет) можно приказать соседним армиям наступать, обороняться или стоять насмерть.</li>
<li><b>Итог операции</b> — звёзды за выполненные приказы, награда за славу (высшая — только за три звезды) и повышение в звании (за ★★★ или за ★★ при высоком Доверии; Маршал — только за ★★★ в Берлине). Неудачную операцию можно переиграть: в личное дело идёт лучший результат.</li>
<li><b>Права по званию</b> ${Q(`star`)} (кампания «Красная армия»): ${ha
    .slice(1, 4)
    .map((e, t) => `<b>${e}</b> — ${xa(t + 1).join(`, `)}`)
    .join(`; `)}.</li>
<li><b>Отдельные операции</b> — любую из восьми операций можно сыграть сразу, без кампании: с историческим командующим, без прав по званию и без гвардии из личного дела.</li></ul>`,
  Vo = class {
    constructor(e, t, n) {
      (k(this, `view`, void 0),
        k(this, `m`, void 0),
        k(this, `G`, void 0),
        k(this, `ui`, void 0),
        k(this, `$`, {}),
        k(this, `sel`, null),
        k(this, `selReach`, null),
        k(this, `selAtt`, null),
        k(this, `mode`, `none`),
        k(this, `inGame`, !1),
        k(this, `playerTurn`, !1),
        k(this, `busy`, !1),
        k(this, `session`, 0),
        k(this, `undo`, []),
        k(this, `showSupply`, !1),
        k(this, `fast`, localStorage.getItem(`wf_fast`) === `1`),
        k(this, `skipAI`, !1),
        k(this, `endArmed`, 0),
        k(this, `nextIdx`, -1),
        k(this, `bannerT`, 0),
        k(this, `side`, `GER`),
        k(this, `diff`, 1),
        k(this, `scen`, Ye),
        k(this, `maps`, {}),
        k(this, `prof`, Da(localStorage)),
        k(this, `outcome`, null),
        k(this, `menuBack`, null),
        (this.m = n),
        (this.maps.pl39 = n),
        (this.ui = t),
        (this.view = new Le(e, n)),
        (this.view.isCmd = (e) => P(this.G, e)),
        this.buildDOM(),
        (this.view.onTap = (e) => this.onTap(e)),
        (this.view.onLong = (e) => this.onLong(e)),
        (this.G = Vt(n, Ye, `GER`, 1, 1939)),
        this.view.setGame(this.G),
        this.updateSupply(),
        this.menuCamera(),
        this.euRestore(),
        this.showMenu(),
        document.addEventListener(`visibilitychange`, () => {
          document.hidden && this.save();
        }),
        window.addEventListener(`resize`, () => {
          this.inGame || this.menuCamera();
        }));
    }
    buildDOM() {
      this.ui.innerHTML = `
<div id="wxfx" class="hidden"></div>
<div id="top" class="hidden">
  <div class="chip panel" id="c-nat"></div>
  <div class="chip panel turnchip" id="c-turn"></div>
  <div class="chip panel" id="c-pp"></div>
  <div class="grow"></div>
  <button class="btn icon" id="b-obj" aria-label="Задачи"></button>
  <button class="btn icon" id="b-menu" aria-label="Меню"></button>
</div>
<div id="rail" class="hidden">
  <button class="btn icon" id="b-air" aria-label="Авиация"><span class="badge" id="bd-air">0</span></button>
  <button class="btn icon" id="b-sup" aria-label="Снабжение"></button>
  <button class="btn icon hidden" id="b-tel" aria-label="Телеграф"><span class="badge" id="bd-tel">1</span></button>
  <button class="btn icon" id="b-undo" aria-label="Отменить"></button>
  <button class="btn icon" id="b-next" aria-label="Следующая дивизия"><span class="badge" id="bd-next">0</span></button>
</div>
<div id="toasts"></div>
<div id="bottom" class="hidden">
  <div id="card" class="panel"></div>
  <button class="btn gold" id="endbtn">Конец хода</button>
</div>
<div id="aiwait" class="panel hidden"></div>
<div id="banner" class="panel hidden"></div>
<div id="menu" class="hidden"></div>
<div id="front" class="hidden"></div>
<div id="eu" class="hidden"></div>
<div id="st" class="hidden"></div>
<div id="bb" class="hidden"></div>
<div id="war" class="hidden"></div>
<div id="modal" class="hidden"></div>`;
      for (let e of this.ui.querySelectorAll(`[id]`)) this.$[e.id] = e;
      (this.$[`b-obj`].prepend(_o(`star`)),
        this.$[`b-menu`].prepend(_o(`menu`)),
        this.$[`b-air`].prepend(_o(`plane`)),
        this.$[`b-sup`].prepend(_o(`truck`)),
        this.$[`b-tel`].prepend(_o(`tele`)),
        this.$[`b-undo`].prepend(_o(`undo`)),
        this.$[`b-next`].prepend(_o(`next`)));
      let e = (e, t) =>
        this.$[e].addEventListener(`click`, (e) => {
          (e.stopPropagation(), t());
        });
      (e(`b-obj`, () => {
        (Z.click(), this.showObjectives());
      }),
        e(`c-turn`, () => {
          (Z.click(), this.showObjectives());
        }),
        e(`b-menu`, () => {
          (Z.click(), this.showGameMenu());
        }),
        e(`b-air`, () => this.toggleAir()),
        e(`b-sup`, () => this.toggleSupply()),
        e(`b-tel`, () => {
          (Z.click(), this.showTelegraph());
        }),
        e(`c-nat`, () => {
          this.G.s.career && this.inGame && (Z.click(), this.showStatus());
        }),
        e(`b-undo`, () => this.doUndo()),
        e(`b-next`, () => this.nextUnit()),
        e(`endbtn`, () => this.endTurnClick()),
        e(`c-pp`, () => {
          this.G.s.career
            ? this.inGame && (Z.click(), this.showStatus())
            : this.recruitMode();
        }));
    }
    get modalOpen() {
      return !this.$.modal.classList.contains(`hidden`);
    }
    openModal(e, t = {}) {
      let n = this.$.modal;
      return (
        (n.className = t.sheet ? `sheet` : ``),
        (n.dataset.nodismiss = t.dismiss === !1 ? `1` : ``),
        (n.innerHTML = `<div class="dlg panel">${e}</div>`),
        (n.onclick = (e) => {
          e.target === n && t.dismiss !== !1 && (Z.click(), this.closeModal());
        }),
        n.firstElementChild
      );
    }
    closeModal() {
      ((this.$.modal.className = `hidden`), (this.$.modal.innerHTML = ``));
    }
    onBack() {
      if (this.eu && !this.$.eu.classList.contains(`hidden`)) return this.eu.back();
      if (this.war && !this.$.war.classList.contains(`hidden`)) return this.war.back();
      if (this.bb && !this.$.bb.classList.contains(`hidden`)) return this.bb.back();
      if (this.st && !this.$.st.classList.contains(`hidden`)) return this.st.back();
      return this.modalOpen
        ? (this.$.modal.dataset.nodismiss !== `1` &&
            (Z.click(), this.closeModal()),
          !0)
        : this.inGame
          ? this.busy
            ? !0
            : this.mode === `none`
              ? this.sel
                ? (this.deselect(), !0)
                : (this.showGameMenu(), !0)
              : (this.setMode(`none`), !0)
          : this.menuBack
            ? (Z.click(), this.menuBack(), !0)
            : this.$.menu.querySelector(`.setup`)
              ? (Z.click(), this.showMenu(), !0)
              : !1;
    }
    toast(e, t = ``) {
      let n = document.createElement(`div`);
      ((n.className = `toast ` + t), (n.innerHTML = Ro(e)));
      let r = this.$.toasts;
      for (r.appendChild(n); r.children.length > 4;)
        r.firstElementChild.remove();
      setTimeout(() => n.remove(), 2800);
    }
    banner(e, t = ``, n = 1400) {
      let r = this.$.banner;
      ((r.innerHTML = `${$(e)}${t ? `<small>${$(t)}</small>` : ``}`),
        r.classList.remove(`hidden`),
        (r.style.animation = `none`),
        r.offsetWidth,
        (r.style.animation = ``),
        clearTimeout(this.bannerT),
        (this.bannerT = window.setTimeout(() => r.classList.add(`hidden`), n)));
    }
    cityHex(e) {
      return this.m.cities.find((t) => t.name === e)?.hex ?? -1;
    }
    mapCenter() {
      return this.nearestHex(this.m.g.pxW / 2, this.m.g.pxH / 2);
    }
    previewCamera(e) {
      let t = this.view,
        n =
          Math.ceil(
            Math.max(
              t.canvas.width / this.m.g.pxW,
              t.canvas.height / this.m.g.pxH,
            ) * 1.02,
          ) / t.dpr;
      t.centerOn(
        e,
        !1,
        Math.max(
          n,
          1.2,
          Math.min(
            2,
            Math.min(window.innerWidth, window.innerHeight * 1.6) / 380,
          ),
        ),
      );
      let r = t.scale,
        i = this.m.g.pxW * r,
        a = this.m.g.pxH * r;
      (i >= t.canvas.width &&
        (t.ox = Math.min(0, Math.max(t.canvas.width - i, t.ox))),
        a >= t.canvas.height &&
          (t.oy = Math.min(0, Math.max(t.canvas.height - a, t.oy))),
        (t.dirty = !0));
    }
    menuCamera() {
      let e = this.view,
        t =
          Math.ceil(
            Math.max(
              e.canvas.width / this.m.g.pxW,
              e.canvas.height / this.m.g.pxH,
            ) * 1.02,
          ) / e.dpr,
        n = this.cityHex(`Лодзь`);
      e.centerOn(n >= 0 ? n : this.mapCenter(), !1, t);
      let r = e.scale,
        i = this.m.g.pxW * r,
        a = this.m.g.pxH * r;
      (i >= e.canvas.width &&
        (e.ox = Math.min(0, Math.max(e.canvas.width - i, e.ox))),
        a >= e.canvas.height &&
          (e.oy = Math.min(0, Math.max(e.canvas.height - a, e.oy))),
        (e.dirty = !0));
    }
    mapFor(e) {
      var t;
      let n = e.map || `pl39`;
      return (t = this.maps)[n] || (t[n] = v(Ao[n]));
    }
    useMap(e) {
      this.m !== e && ((this.m = e), (this.view.m = e), this.view.clampCam());
    }
    loadSave() {
      try {
        let e = JSON.parse(localStorage.getItem(Do) || `null`);
        if (e && e.v === 1 && e.s && ma[e.s.scen]) return e.s;
      } catch {}
      return null;
    }
    save() {
      if (this.inGame && this.playerTurn && !this.G.s.result)
        try {
          localStorage.setItem(
            Do,
            JSON.stringify({ v: 1, t: Date.now(), s: this.G.s }),
          );
        } catch {}
    }
    showMenu() {
      this.closeFront();
      this.closeEurope();
      this.closeStaff();
      this.closeBarb();
      this.closeWar();
      let euAbort = this.euDeep;
      euAbort && ((this.euDeep = null), this.euRestore());
      ((this.menuBack = null),
        (this.inGame = !1),
        (this.playerTurn = !1),
        (this.busy = !1),
        this.session++);
      for (let e of [`top`, `rail`, `bottom`, `aiwait`, `banner`])
        this.$[e].classList.add(`hidden`);
      ((this.$.wxfx.className = `hidden`),
        (this.$.wxfx.dataset.w = ``),
        (this.$.toasts.innerHTML = ``),
        this.closeModal(),
        (this.view.zone = null),
        this.view.setOverlay({}));
      let e = this.loadSave(),
        t = this.$.menu;
      t.classList.remove(`hidden`);
      let n = e ? ma[e.scen] : null,
        r =
          e && n
            ? `${e.career ? `${e.career.gen?.short || n.career.short} · ${n.name}` : Ye.nations.find((t) => t.id === e.player)?.name} · ход ${e.turn} · ${Po[e.difficulty].toLowerCase()}`
            : ``,
        i = this.prof,
        a = i ? Y(i) : null,
        o =
          i && a
            ? `${ha[a.rank]} ${i.short} · операций ${a.done} из ${J.length}`
            : `Красная армия 1941–1945 · Бзура 1939`;
      if (this.menuArch === undefined) {
        // архив прототипов: помнить выбор игрока; #arch в адресе — сразу открыт (для старых автотестов)
        let t0 = ``;
        try {
          t0 = localStorage.getItem(`wf_menu_arch`) || ``;
        } catch {}
        this.menuArch = /arch/.test(location.hash) || t0 === `1`;
      }
      t.innerHTML = `<div class="logo">МИРОВОЙ<br> ФРОНТ</div>
<div class="tagline">Вторая мировая · пошаговая стратегия</div>
<div class="mbtns">
<button class="btn gold" id="m-war"><span class="newtag">новое</span>Фронт 1941–1945<small>${$(WarUI.menuLabel())}</small></button>
${this.menuArch ? `<div class="march">Архив прототипов v0.1–v0.8</div>
<button class="btn" id="m-bb">Барбаросса 1941<small>${$(BarbUI.menuLabel())}</small></button>
${e ? `<button class="btn" id="m-cont">Продолжить<small>${$(r)}</small></button>` : ``}
<button class="btn" id="m-new">Новая кампания</button>
<button class="btn" id="m-car">Карьера генерала<small>${$(o)}</small></button>
<button class="btn" id="m-st">Сталинград 1942–1943<small>${$(StaffUI.menuLabel())}</small></button>
<button class="btn" id="m-eu">Европа 1939–1945<small>${$(EuropeUI.menuLabel())}</small></button>
<button class="btn" id="m-arch">Скрыть архив</button>` : `<button class="btn" id="m-arch">Архив прототипов<small>кампании, карьера, Сталинград, Европа, Барбаросса</small></button>`}
<div class="mrow"><button class="btn" id="m-help">Как играть</button><button class="btn" id="m-snd">Звук: ${co.on ? `вкл` : `выкл`}</button></div>
</div>
<div class="ver">${ko}</div>`;
      let s = (e) => t.querySelector(`#` + e);
      (s(`m-cont`)?.addEventListener(`click`, () => {
        (Z.click(), this.continueGame());
      }),
        s(`m-new`)?.addEventListener(`click`, () => {
          (Z.click(), this.showSetup());
        }),
        s(`m-car`)?.addEventListener(`click`, () => {
          (Z.click(), this.showCareerHub());
        }),
        s(`m-eu`)?.addEventListener(`click`, () => {
          (Z.click(), this.openEurope());
        }),
        s(`m-st`)?.addEventListener(`click`, () => {
          (Z.click(), this.openStaff());
        }),
        s(`m-bb`)?.addEventListener(`click`, () => {
          (Z.click(), this.openBarb());
        }),
        s(`m-war`).addEventListener(`click`, () => {
          (Z.click(), this.openWar());
        }),
        s(`m-arch`).addEventListener(`click`, () => {
          this.menuArch = !this.menuArch;
          try {
            localStorage.setItem(`wf_menu_arch`, this.menuArch ? `1` : `0`);
          } catch {}
          (Z.click(), this.showMenu());
        }),
        s(`m-help`).addEventListener(`click`, () => {
          (Z.click(), this.showHelp());
        }),
        s(`m-snd`).addEventListener(`click`, () => {
          ((co.on = !co.on), Z.click(), this.showMenu());
        }));
      euAbort && (this.openEurope(), euAbort.cb(null));
    }
    // ——— «Европа 1939–1945»: стратегический режим и тактические битвы из него ———
    openEurope() {
      (this.closeFront(), this.closeStaff(), this.closeBarb(), this.closeWar(), this.closeModal(), this.$.menu.classList.add(`hidden`));
      for (let e of [`top`, `rail`, `bottom`, `aiwait`, `banner`]) this.$[e].classList.add(`hidden`);
      this.eu ||
        (this.eu = new EuropeUI(this.$.eu, {
          icon: (e, t) => Q(e, t),
          sfx: Z,
          diff: this.diff,
          exit: () => this.showMenu(),
          deep: (e, t, n, r) => this.euDeepStart(e, t, n, r),
        }));
      (this.$.eu.classList.remove(`hidden`), this.eu.open());
    }
    closeEurope() {
      this.eu && !this.$.eu.classList.contains(`hidden`) && this.eu.close();
      this.$.eu.classList.add(`hidden`);
    }
    // ——— «Сталинград 1942–1943»: штабной режим «Операция «Уран»» (v0.7) ———
    openStaff() {
      (this.closeFront(), this.closeEurope(), this.closeBarb(), this.closeWar(), this.closeModal(), this.$.menu.classList.add(`hidden`));
      for (let e of [`top`, `rail`, `bottom`, `aiwait`, `banner`]) this.$[e].classList.add(`hidden`);
      this.st || (this.st = new StaffUI(this.$.st, { sfx: Z, exit: () => this.showMenu() }));
      (this.$.st.classList.remove(`hidden`), this.st.open());
    }
    closeStaff() {
      this.st && !this.$.st.classList.contains(`hidden`) && this.st.close();
      this.$.st.classList.add(`hidden`);
    }
    // ——— «Барбаросса 1941» (v0.8): кампания по главам, глава 1 «Граница» ———
    openBarb() {
      (this.closeFront(), this.closeEurope(), this.closeStaff(), this.closeWar(), this.closeModal(), this.$.menu.classList.add(`hidden`));
      for (let e of [`top`, `rail`, `bottom`, `aiwait`, `banner`]) this.$[e].classList.add(`hidden`);
      this.bb || (this.bb = new BarbUI(this.$.bb, { sfx: Z, exit: () => this.showMenu() }));
      (this.$.bb.classList.remove(`hidden`), this.bb.open());
    }
    closeBarb() {
      this.bb && !this.$.bb.classList.contains(`hidden`) && this.bb.close();
      this.$.bb.classList.add(`hidden`);
    }
    // ——— «Фронт 1941–1945» (v0.9): вся война на Восточном фронте, день за ходом ———
    openWar() {
      (this.closeFront(), this.closeEurope(), this.closeStaff(), this.closeBarb(), this.closeModal(), this.$.menu.classList.add(`hidden`));
      for (let e of [`top`, `rail`, `bottom`, `aiwait`, `banner`]) this.$[e].classList.add(`hidden`);
      this.war || (this.war = new WarUI(this.$.war, { sfx: Z, exit: () => this.showMenu() }));
      (this.$.war.classList.remove(`hidden`), this.war.open());
    }
    closeWar() {
      this.war && !this.$.war.classList.contains(`hidden`) && this.war.close();
      this.$.war.classList.add(`hidden`);
    }
    euDeepStart(e, t, n, r) {
      let i = ma[e];
      if (!i) return r(null);
      try {
        let e = localStorage.getItem(Do);
        localStorage.setItem(`wf_eu_bak`, e === null ? `` : e);
      } catch {}
      ((this.euDeep = { cb: r, op: e }), this.$.eu.classList.add(`hidden`), (this.G = null), this.startNew(t, n, i));
    }
    euRestore() {
      try {
        let e = localStorage.getItem(`wf_eu_bak`);
        e !== null && (e ? localStorage.setItem(Do, e) : localStorage.removeItem(Do), localStorage.removeItem(`wf_eu_bak`));
      } catch {}
    }
    euDeepResult() {
      let e = this.G.s.result,
        t = e.win ? e.stars || 1 : 0;
      ((this.playerTurn = !1), (this.busy = !0), this.renderAIWait(null), localStorage.removeItem(Do), e.win ? Z.win() : Z.lose(), this.hud());
      let n = [0, 1, 2].map((t) => Q(e.win && t < e.stars ? `star` : `star_off`, 4)).join(``),
        r = this.openModal(
          `<h2 class="${e.win ? `good` : `warn`}">${e.win ? `Победа!` : `Поражение`}</h2><h3>${$(e.title)}</h3>
<div class="stars">${n}</div><p>${$(e.text || ``)}</p>
<p class="date">Итог битвы решит исход удара на карте «Европа 1939–1945»: ★★★ — разгром обороны, ★★ — перевес, ★ — обычный бой, поражение — атака отбита.</p>
<div class="row"><button class="btn gold" id="e-eu">Вернуться к карте Европы</button></div>`,
          { dismiss: !1 },
        );
      r.querySelector(`#e-eu`).addEventListener(`click`, () => {
        Z.click();
        let n = this.euDeep;
        ((this.euDeep = null), this.euRestore(), this.showMenu(), this.openEurope(), n && n.cb({ win: !!e.win, stars: t }));
      });
    }
    showSetup() {
      let e = this.$.menu,
        t = Ye;
      e.innerHTML = `<div class="setup">
<div class="logo sm">${$(t.name)}</div>
<div class="tagline">${$(t.subtitle)} · ${t.maxTurn} ходов · ${$(t.date(1))} — ${$(t.date(t.maxTurn))}</div>
<div class="sides">${t.sides.map((e) => `<div class="side panel ${e.id === this.side ? `sel` : ``}" data-n="${e.id}"><span data-f="${e.id}"></span><h3>${$(e.title)}</h3><div class="tag">${$(e.difficultyHint)}</div><p>${$(e.brief)}</p></div>`).join(``)}</div>
<div class="seg">${Po.map((e, t) => `<button class="btn ${t === this.diff ? `on` : ``}" data-d="${t}">${e}</button>`).join(``)}</div>
<div class="row"><button class="btn" id="n-back">Назад</button><button class="btn gold" id="n-go">В бой!</button></div></div>`;
      for (let n of t.sides)
        e.querySelector(`[data-f="${n.id}"]`).replaceWith(
          mo(
            t.nations.find((e) => e.id === n.id),
            4,
          ),
        );
      (e.querySelectorAll(`[data-n]`).forEach((e) =>
        e.addEventListener(`click`, () => {
          (Z.click(), (this.side = e.dataset.n), this.showSetup());
        }),
      ),
        e.querySelectorAll(`[data-d]`).forEach((e) =>
          e.addEventListener(`click`, () => {
            (Z.click(), (this.diff = +e.dataset.d), this.showSetup());
          }),
        ),
        e.querySelector(`#n-back`).addEventListener(`click`, () => {
          (Z.click(), this.showMenu());
        }),
        e.querySelector(`#n-go`).addEventListener(`click`, () => {
          (Z.select(), this.startNew(this.side, this.diff, Ye));
        }));
    }
    showCareerSetup() {
      let e = this.$.menu,
        t = $n,
        n = t.career;
      ((e.innerHTML = `<div class="setup car">
<div class="logo sm">${$(t.name)}</div>
<div class="tagline">Карьера генерала · ${t.maxTurn} ходов · ${$(t.date(1))} — ${$(t.date(t.maxTurn))}</div>
<div class="gen panel">${wo(4, `pt`)}<div class="gtxt"><div class="gname">${$(n.general)}</div><div class="grank">${$(n.rank)} · ${$(n.role)}</div><p>${$(n.brief)}</p></div></div>
<div class="pillars">
<div class="pil panel">${Q(`order`, 3)}<div><b>Приказы</b><span>Задачи Ставки со сроком. Выполняйте — растут доверие и слава.</span></div></div>
<div class="pil panel">${Q(`tele`, 3)}<div><b>Телеграф</b><span>Раз в ход — запрос: снаряды, авиация, резервы, контрудар.</span></div></div>
<div class="pil panel">${Q(`fame`, 3)}<div><b>Репутация</b><span>Доверие, авторитет и слава решают судьбу генерала.</span></div></div>
</div>
<div class="seg">${Po.map((e, t) => `<button class="btn ${t === this.diff ? `on` : ``}" data-d="${t}">${e}</button>`).join(``)}</div>
<div class="row"><button class="btn" id="n-back">Назад</button><button class="btn gold" id="n-go">Принять командование</button></div></div>`),
        (this.menuBack = () => this.showCareerHub()),
        e.querySelectorAll(`[data-d]`).forEach((e) =>
          e.addEventListener(`click`, () => {
            (Z.click(), (this.diff = +e.dataset.d), this.showCareerSetup());
          }),
        ),
        e.querySelector(`#n-back`).addEventListener(`click`, () => {
          (Z.click(), this.showCareerHub());
        }),
        e.querySelector(`#n-go`).addEventListener(`click`, () => {
          (Z.select(), this.startNew(`POL`, this.diff, $n));
        }));
    }
    campLook(e) {
      let t = this.prof,
        n = t ? Y(t, e) : null,
        r = J[Math.min(e, J.length - 1)];
      return {
        sov: !0,
        rank: n?.rank ?? 0,
        year: e >= J.length ? 1945 : r.year,
        hero: n?.hero ?? 0,
        bars: n ? n.awards.length - n.hero : 0,
        seed: t ? jo(t.name) % 12 : 0,
      };
    }
    fillP(e, t) {
      let n = this.prof;
      return e
        .replace(/\{name\}/g, n.name)
        .replace(/\{short\}/g, n.short)
        .replace(/\{rank\}/g, ha[Y(n, t).rank]);
    }
    ribbons(e) {
      return e.awards
        .map((e) =>
          /Золотая/.test(e.name)
            ? `<span class="ribstar" title="${$(e.name)}">${Q(`star`, 1)}</span>`
            : Eo(e.name),
        )
        .join(``);
    }
    showCareerHub() {
      this.menuBack = () => this.showMenu();
      let e = this.$.menu,
        t = this.prof,
        n = t ? Y(t) : null,
        r = +(localStorage.getItem(`wf_best_${$n.id}_POL`) || 0),
        i = t ? ka(t) : 0,
        a =
          t && n
            ? `${ha[n.rank]} ${t.name} · операций ${n.done} из ${J.length} · ★ ${n.stars}${i < J.length ? ` · далее: ${Sa(i).name}` : ` · война окончена`}`
            : `Новая карьера`;
      ((e.innerHTML = `<div class="setup car">
<div class="logo sm">Карьера генерала</div>
<div class="tagline">Вы командуете армией — а судьбу генерала решают приказы Ставки</div>
<div class="sides hubs">
<div class="side panel sel" data-h="sov">${wo(3, `pt`, this.campLook(i))}<h3>Красная армия 1941–1945</h3><div class="tag">${t ? `кампания` : `новое`} · ${J.length} операций</div><p>От Смоленска до Берлина: один генерал на всю войну. Звания, ордена, гвардейские дивизии и мемуары.</p><p class="hubinfo">${$(a)}</p></div>
<div class="side panel" data-h="ops"><span class="newtag">новое</span>${wo(3, `pt`, { sov: !0, rank: 2, year: 1943, seed: 5 })}<h3>Отдельные операции</h3><div class="tag">любая из ${J_ALL.length} · без кампании</div><p>Смоленск, Москва, Харьков, Ржев, Сталинград, Курск, «Багратион», Берлин — сразу, с историческим командующим.</p><p class="hubinfo">${this.opsBest() ? `Лучшие итоги: ★ ${this.opsBest()} из ${J_ALL.length * 3}` : `Ещё не сыграны`}</p></div>
<div class="side panel" data-h="pol">${wo(3, `pt`)}<h3>Бзура 1939</h3><div class="tag">отдельная операция</div><p>Армия «Познань» генерала Кутшебы: контрудар во фланг немецкой 8-й армии.</p><p class="hubinfo">${r ? `Лучший итог: ` + `★`.repeat(r) : `Ещё не сыграна`}</p></div>
</div>
<div class="row"><button class="btn" id="n-back">Назад</button></div></div>`),
        e.querySelector(`[data-h="sov"]`).addEventListener(`click`, () => {
          (Z.click(), this.prof ? this.showDossier() : this.showCampNew());
        }),
        e.querySelector(`[data-h="pol"]`).addEventListener(`click`, () => {
          (Z.click(), this.showCareerSetup());
        }),
        e.querySelector(`[data-h="ops"]`).addEventListener(`click`, () => {
          (Z.click(), this.showOpsList());
        }),
        e.querySelector(`#n-back`).addEventListener(`click`, () => {
          (Z.click(), this.showMenu());
        }));
    }
    opBest(e) {
      return +(localStorage.getItem(`wf_best_${e}_SOV`) || 0);
    }
    opsBest() {
      return J_ALL.reduce((e, t) => e + this.opBest(t.id), 0);
    }
    showOpsList() {
      this.menuBack = () => this.showCareerHub();
      let e = this.$.menu;
      ((e.innerHTML = `<div class="setup car">
<div class="logo sm">Отдельные операции</div>
<div class="tagline">Любая операция — сразу, без кампании: исторический командующий, его звание и армия</div>
<div class="ops">${J_ALL.map((e, t) => {
        let n = OPS_ALL[t],
          r = n.career,
          i = this.opBest(e.id),
          a = i
            ? [0, 1, 2].map((e) => Q(e < i ? `star` : `star_off`, 2)).join(``)
            : `<span class="nx">в бой</span>`;
        return `<div class="op panel" data-so="${t}"><span class="on">${t + 1}</span><span class="ot"><b>${$(n.name)}</b><small>${$(e.period)} · ${$(r.armyName)} · ${$(r.rank)} ${$(r.general)} · ${n.maxTurn} ходов</small></span><span class="os">${a}</span></div>`;
      }).join(``)}</div>
<div class="hint2 center">Без прав по званию, гвардии и наград из личного дела. Итог не влияет на кампанию «Красная армия».</div>
<div class="seg">${Po.map((e, t) => `<button class="btn ${t === this.diff ? `on` : ``}" data-d="${t}">${e}</button>`).join(``)}</div>
<div class="row"><button class="btn" id="n-back">Назад</button></div></div>`),
        e.querySelectorAll(`[data-so]`).forEach((e) =>
          e.addEventListener(`click`, () => {
            (Z.click(), this.showOpSetup(+e.dataset.so));
          }),
        ),
        e.querySelectorAll(`[data-d]`).forEach((t) =>
          t.addEventListener(`click`, () => {
            (Z.click(),
              (this.diff = +t.dataset.d),
              e
                .querySelectorAll(`[data-d]`)
                .forEach((e) =>
                  e.classList.toggle(`on`, +e.dataset.d === this.diff),
                ));
          }),
        ),
        e.querySelector(`#n-back`).addEventListener(`click`, () => {
          (Z.click(), this.showCareerHub());
        }));
    }
    showOpSetup(e) {
      this.menuBack = () => this.showOpsList();
      let t = this.$.menu,
        n = OPS_ALL[e],
        r = n.career,
        i = J_ALL[e],
        a = Vn(null, r),
        o = {
          sov: !0,
          rank: Math.max(0, ha.indexOf(r.rank)),
          year: i.year,
          seed: jo(r.general) % 12,
        },
        s = this.opBest(i.id),
        c = r.intro.text
          .replace(/\{name\}/g, r.general)
          .replace(/\{short\}/g, r.short)
          .replace(/\{rank\}/g, r.rank);
      ((t.innerHTML = `<div class="setup car">
<div class="logo sm">${$(n.name)}</div>
<div class="tagline">${$(n.subtitle)} · ${n.maxTurn} ходов · ${$(n.date(1))} — ${$(n.date(n.maxTurn))}</div>
<div class="gen panel">${wo(4, `pt`, o)}<div class="gtxt"><div class="gname">${$(r.general)}</div><div class="grank">${$(r.rank)} · ${$(r.role)}</div><p>${$(c)}</p></div></div>
<div class="hint2 center">★ — армия уцелела · ★★ — выполнено ${Oo(a.two)} · ★★★ — ${Oo(a.three)} и Слава от ${a.fame}${s ? ` · лучший итог: ${`★`.repeat(s)}` : ``}</div>
<div class="seg">${Po.map((e, t) => `<button class="btn ${t === this.diff ? `on` : ``}" data-d="${t}">${e}</button>`).join(``)}</div>
<div class="row"><button class="btn" id="n-back">Назад</button><button class="btn gold" id="n-go">Принять командование</button></div></div>`),
        t.querySelectorAll(`[data-d]`).forEach((e) =>
          e.addEventListener(`click`, () => {
            (Z.click(),
              (this.diff = +e.dataset.d),
              t
                .querySelectorAll(`[data-d]`)
                .forEach((e) =>
                  e.classList.toggle(`on`, +e.dataset.d === this.diff),
                ));
          }),
        ),
        t.querySelector(`#n-back`).addEventListener(`click`, () => {
          (Z.click(), this.showOpsList());
        }),
        t.querySelector(`#n-go`).addEventListener(`click`, () => {
          (Z.select(), this.startNew(`SOV`, this.diff, n));
        }),
        this.previewScen(n, this.diff));
    }
    previewScen(e, t) {
      (this.useMap(this.mapFor(e)), (this.G = Vt(this.m, e, `SOV`, t, 1941)));
      let n = this.view;
      (n.setGame(this.G),
        n.dispPos.clear(),
        n.ghosts.clear(),
        n.hidden.clear(),
        (n.dispOwner = null),
        (n.zone = null),
        this.updateSupply());
      let r = this.G.s.units.filter((e) => P(this.G, e)),
        i = 0,
        a = 0;
      for (let e of r) {
        let [t, n] = o(this.m.g, e.hex);
        ((i += t), (a += n));
      }
      let s = r.length
        ? this.nearestHex(i / r.length, a / r.length)
        : this.mapCenter();
      this.previewCamera(s);
    }
    showCampNew() {
      this.menuBack = () => this.showCareerHub();
      let e = this.$.menu;
      e.innerHTML = `<div class="setup car">
<div class="logo sm">Красная армия</div>
<div class="tagline">1941–1945 · семь операций · от Смоленска до Берлина</div>
<div class="gen panel">${wo(4, `pt`, { sov: !0, rank: 0, year: 1941, seed: jo(`Иван Соколов`) % 12 })}<div class="gtxt"><div class="gname">Новый командарм</div><div class="grank">генерал-майор</div><p>Июль 1941 года. Вас назначили командующим армией Западного фронта. Впереди — Смоленск, Москва, Харьков или Ржев, Сталинград, Курская дуга, Белоруссия и Берлин. Между операциями — карта фронта, а в 1942 году направление выбираете вы. Успехи приносят звания и ордена, лучшие дивизии становятся гвардейскими и идут с вами дальше.</p></div></div>
<label class="fld">Имя и фамилия генерала<input id="g-name" maxlength="28" value="Иван Соколов" autocomplete="off" spellcheck="false"></label>
<div class="pillars">
<div class="pil panel">${Q(`star`, 3)}<div><b>Звания и ордена</b><span>От генерал-майора до Маршала Советского Союза. Три звезды и громкая слава — Золотая Звезда Героя.</span></div></div>
<div class="pil panel">${Q(`guard`, 3)}<div><b>Гвардия</b><span>Самые опытные дивизии получают звание гвардейских и переходят с вами в следующие операции.</span></div></div>
<div class="pil panel">${Q(`book`, 3)}<div><b>Мемуары</b><span>Каждая операция — глава ваших воспоминаний «От Смоленска до Берлина».</span></div></div>
</div>
<div class="seg">${Po.map((e, t) => `<button class="btn ${t === this.diff ? `on` : ``}" data-d="${t}">${e}</button>`).join(``)}</div>
<div class="row"><button class="btn" id="n-back">Назад</button><button class="btn gold" id="n-go">Начать карьеру</button></div></div>`;
      let t = e.querySelector(`#g-name`);
      (e.querySelectorAll(`[data-d]`).forEach((t) =>
        t.addEventListener(`click`, () => {
          (Z.click(),
            (this.diff = +t.dataset.d),
            e
              .querySelectorAll(`[data-d]`)
              .forEach((e) =>
                e.classList.toggle(`on`, +e.dataset.d === this.diff),
              ));
        }),
      ),
        t.addEventListener(`keydown`, (e) => {
          e.key === `Enter` && t.blur();
        }),
        e.querySelector(`#n-back`).addEventListener(`click`, () => {
          (Z.click(), this.showCareerHub());
        }),
        e.querySelector(`#n-go`).addEventListener(`click`, () => {
          (Z.select(),
            (this.prof = Ea(t.value, this.diff)),
            Oa(localStorage, this.prof),
            this.showFrontMap({ intro: 1 }));
        }));
    }
    frontDelta(t, i) {
      if (i < 1 || !t) return [null, null];
      let r = routeOf(t)[i - 1],
        n = t.ops[i - 1];
      return !n || n.skip || !r
        ? [r, null]
        : [r, n.stars === 3 ? `ahead` : n.stars === 1 ? `behind` : null];
    }
    closeFront() {
      (this.fmRO && (this.fmRO.disconnect(), (this.fmRO = null)),
        this.fmap && (this.fmap.destroy(), (this.fmap = null)),
        this.$.front &&
          (this.$.front.classList.add(`hidden`), (this.$.front.innerHTML = ``)));
    }
    showFrontMap(o = {}) {
      let t = this.prof;
      if (!t) {
        (this.closeFront(), this.showCampNew());
        return;
      }
      this.closeModal();
      let L = J.length,
        k = ka(t),
        reach = Math.min(k, L),
        si = Math.max(0, Math.min(o.stage ?? reach, reach)),
        st = FRONT_STAGES[si],
        br = () => routeOf(t),
        open = si === BRANCH && (!t.ops[BRANCH] || !!t.ops[BRANCH].skip),
        after = o.after != null && o.after === k - 1 && si === k,
        [dOp, dKind] = this.frontDelta(t, si),
        prev = si > 0 ? t.ops[si - 1] : null,
        mon = [`1941·июль`, `1941·ноябрь`, `1942·май`, `1942·ноябрь`, `1943·июль`, `1944·июнь`, `1945·апрель`, `1945·май`],
        chips = FRONT_STAGES.map((e, n) => {
          let [a, b] = mon[n].split(`·`);
          return `<button class="fm-chip ${n === si ? `on` : ``} ${n > reach ? `lock` : ``}" data-s="${n}" title="${$(e.title)}"><b>${a}</b><small>${b}</small></button>`;
        }).join(``),
        txt = (FRONT_TEXT[st.id] || []).map((e) => `<p>${$(e)}</p>`).join(``),
        res = ``;
      if (prev && !prev.skip && dOp) {
        let e = FRONT_RESULT[dOp] || {},
          n = dKind ? e[dKind] : `Ваша армия выполнила задачу, и фронт прошёл там же, где и в истории.`,
          r = [0, 1, 2].map((e) => Q(e < prev.stars ? `star` : `star_off`, 2)).join(``),
          i = si < L ? (prev.stars === 3 ? `Снабжение армии в следующей операции: +6.` : prev.stars === 1 ? `Снабжение армии в следующей операции: −4.` : ``) : ``;
        res = `<div class="fm-res ${dKind === `ahead` ? `up` : dKind === `behind` ? `dn` : `eq`}"><div class="fm-rh"><span class="st">${r}</span><b>${$(Sa(si - 1).name)}</b></div><p>${$(n)}</p>${i ? `<small>${i}</small>` : ``}</div>`;
      }
      let cards = open
          ? `<div class="fm-q">Ставка ждёт вашего решения: где наступать летом 1942 года?</div><div class="fm-ch"><button class="fm-card panel" data-r="kharkov42"><b>Харьков</b><small>май 1942 · Юго-Западный фронт</small><span>6-я армия генерала Городнянского наступает из Барвенковского выступа на Харьков. Опасность — удар врага под основание выступа.</span></button><button class="fm-card panel" data-r="rzhev42"><b>Ржев</b><small>август 1942 · Западный фронт</small><span>20-я армия генерала Рейтера прорывает оборону у Погорелого Городища и идёт на Сычёвку — в тыл ржевской группировке.</span></button></div><div class="hint2">Выберите направление на карте или здесь. Выбор можно изменить до начала операции; вторая операция останется в разделе «Отдельные операции».</div>`
          : ``,
        goLbl = reach >= L ? `Эпилог` : `К брифингу`,
        e = this.$.front;
      (this.closeFront(),
        e.classList.remove(`hidden`),
        (e.innerHTML = `<canvas class="fm-cv"></canvas>
<div class="fm-top panel"><b>Карта фронта</b><span>${$(st.title)}</span></div>
<div class="fm-zoom"><button class="btn icon" id="f-zin" aria-label="Приблизить">+</button><button class="btn icon" id="f-zout" aria-label="Отдалить">−</button></div>
<div class="fm-side panel">
<div class="fm-tl">${chips}</div>
<div class="fm-scroll">
${cards}<div class="fm-sib"><div class="pn">ОТ СОВЕТСКОГО ИНФОРМБЮРО</div><div class="pd">${$(st.title)}${si === L ? ` · День Победы` : ``}</div>${txt}</div>
${res}
<div class="fm-leg"><span><i class="lg sov"></i>СССР</span><span><i class="lg ax"></i>Германия и союзники</span><span><i class="lg neu"></i>Нейтральные</span><span><i class="lg fl"></i>Линия фронта</span><span><i class="lg as"></i>Наш удар</span><span><i class="lg ag"></i>Удар врага</span></div>
</div>
<div class="fm-btns"><button class="btn" id="f-dos">Личное дело</button><button class="btn gold" id="f-go">${goLbl}</button></div>
</div>`));
      let c = e.querySelector(`.fm-cv`),
        side = e.querySelector(`.fm-side`),
        zm = e.querySelector(`.fm-zoom`),
        go = e.querySelector(`#f-go`),
        M = (this.fmap = new FrontMap(c, {
          onMark: (e) => {
            e.st === `choice` || e.st === `sel`
              ? pick(e.id)
              : e.st === `done`
                ? (Z.click(), this.toast(`${Sa(e.i).name}: ${`★`.repeat(e.stars) || `без звёзд`}`))
                : e.st === `next` && (Z.click(), this.toast(`Следующая операция: ${Sa(e.i).name}`));
          },
        })),
        lay = () => {
          let t = e.getBoundingClientRect(),
            n = side.getBoundingClientRect(),
            r = t.width > t.height;
          (r ? M.setInset(0, 0, t.right - n.left + 4, 0) : M.setInset(0, 44, 0, t.bottom - n.top + 4),
            (zm.style.bottom = r ? `` : `${Math.round(t.bottom - n.top + 8)}px`));
        },
        marks = () => {
          let e = br(),
            n = [];
          for (let r = 0; r < Math.min(si, L); r++) {
            let i = e[r],
              a = t.ops[r];
            if (!i || !FRONT_OPS[i] || !a) continue;
            let [o, s] = M.pr(...FRONT_OPS[i].at);
            n.push({ id: i, i: r, x: o, y: s, num: r + 1, stars: a.skip ? 0 : a.stars, st: a.skip ? `skip` : `done`, label: J[r].place });
          }
          if (si < L)
            if (open)
              STAGES[BRANCH].forEach((r, i) => {
                let [a, o] = M.pr(...FRONT_OPS[r].at),
                  s = J_ALL.find((e) => e.id === r);
                n.push({ id: r, i: si, x: a, y: o, num: si + 1, st: e[BRANCH] === r ? `sel` : `choice`, label: `${s.place} · ${s.period}`, ph: i * 0.5 });
              });
            else {
              let r = e[si] || STAGES[si][0],
                [i, a] = M.pr(...FRONT_OPS[r].at);
              n.push({ id: r, i: si, x: i, y: a, num: si + 1, st: `next`, label: `${J[si].place} · ${J[si].period}` });
            }
          return n;
        },
        arrows = () => {
          let e = br();
          return si >= L ? [] : open ? (e[BRANCH] ? [e[BRANCH]] : [...STAGES[BRANCH]]) : [e[si] || STAGES[si][0]];
        },
        refresh = () => {
          (M.setMarks(marks()), M.setArrows(arrows()));
          let n = br();
          (e.querySelectorAll(`.fm-card`).forEach((e) => e.classList.toggle(`on`, e.dataset.r === n[BRANCH])),
            (go.disabled = open && !n[BRANCH]),
            go.classList.toggle(`off`, go.disabled));
        },
        pick = (e) => {
          if (!open || !STAGES[BRANCH].includes(e)) return;
          (Z.select(), (t.route = br()), (t.route[BRANCH] = e), syncRoute(t), Oa(localStorage, t), refresh());
          let n = M.marks.filter((e) => e.st === `sel` || e.st === `choice`).map((e) => [e.x, e.y]);
          n.length && M.fit(M.bbAround(n, 16, 130, 100), 3.2, 700);
        },
        focus = () => {
          if (si >= L) return M.bbAround(M.marks.map((e) => [e.x, e.y]), 24, 200, 150);
          let e = M.marks.filter((e) => e.st !== `done` && e.st !== `skip`),
            n = M.marks.filter((e) => e.i === si - 1);
          return M.bbAround([...(e.length ? e : M.marks.slice(-1)), ...n].map((e) => [e.x, e.y]), 18, 150, 110);
        };
      (lay(), (this.fmRO = new ResizeObserver(() => lay())), this.fmRO.observe(e), refresh());
      let n = frontState(si, dOp, dKind);
      if (after && si > 0) {
        let [r, i] = this.frontDelta(t, si - 1),
          a = frontState(si - 1, r, i),
          s = M.changedBox(a, n),
          l = s.length > 4000 ? s.filter((e, t) => t % 7 === 0) : s;
        (M.fit(M.bbAround([...l, ...M.marks.filter((e) => e.i === si - 1).map((e) => [e.x, e.y])], 16, 140, 100), 3.2),
          M.transition(a, n, {
            delay: 600,
            done: () => {
              (si >= L ? Z.win() : Z.turn(), M.fit(focus(), 3.2, 900));
            },
          }));
      } else
        (M.setOwners(n),
          o.intro
            ? (M.fit([0, 0, M.F.w, M.F.h], 9), setTimeout(() => M.fit(focus(), 3, 1400), 500))
            : M.fit(focus(), 3));
      (e.querySelectorAll(`.fm-chip`).forEach((e) =>
        e.addEventListener(`click`, () => {
          let t = +e.dataset.s;
          t > reach
            ? (Z.error(), this.toast(`Этот этап войны ещё впереди`))
            : t !== si && (Z.click(), this.showFrontMap({ stage: t }));
        }),
      ),
        e.querySelectorAll(`.fm-card`).forEach((e) => e.addEventListener(`click`, () => pick(e.dataset.r))),
        e.querySelector(`#f-zin`).addEventListener(`click`, () => (Z.click(), M.zoomBy(1.4))),
        e.querySelector(`#f-zout`).addEventListener(`click`, () => (Z.click(), M.zoomBy(1 / 1.4))),
        e.querySelector(`#f-dos`).addEventListener(`click`, () => {
          (Z.click(), this.closeFront(), this.showDossier());
        }),
        go.addEventListener(`click`, () => {
          if (go.disabled) {
            (Z.error(), this.toast(`Сначала выберите направление: Харьков или Ржев`));
            return;
          }
          let e = br();
          (Z.select(),
            this.closeFront(),
            reach >= L
              ? (this.showDossier(), this.showMemoirs(!0))
              : open
                ? this.showBriefing(BRANCH)
                : reach === BRANCH && !e[BRANCH]
                  ? this.showFrontMap({ stage: BRANCH })
                  : this.showBriefing(reach));
        }),
        (this.menuBack = () => {
          (this.closeFront(), this.showDossier());
        }));
    }
    showDossier() {
      let e = this.prof;
      if (!e) {
        this.showCampNew();
        return;
      }
      this.menuBack = () => this.showCareerHub();
      let t = this.$.menu,
        n = Y(e),
        r = ka(e),
        i = J.length,
        a = J.map((t, n) => {
          let i = Sa(n),
            a = e.ops[n],
            o = n <= r,
            w = n === BRANCH && (!routeOf(e)[n] || !!a?.skip),
            s = w
              ? o
                ? `<span class="nx">${a?.skip ? `новая` : `выбор`}</span>`
                : Q(`lock`, 2)
              : a
              ? [0, 1, 2]
                  .map((e) => Q(e < a.stars ? `star` : `star_off`, 2))
                  .join(``)
              : o
                ? `<span class="nx">в бой</span>`
                : Q(`lock`, 2);
          return w
            ? `<div class="op panel ${o ? `` : `lock`} ${n === r ? `next` : ``}" data-op="${n}"><span class="on">${n + 1}</span><span class="ot"><b>${routeOf(e)[n] ? $(i.name) : `Харьков или Ржев`}</b><small>${a?.skip ? `новая операция версии 0.5 · ` : `май — август 1942 · `}направление выбирается на карте фронта</small></span><span class="os">${s}</span></div>`
            : `<div class="op panel ${o ? `` : `lock`} ${n === r ? `next` : ``}" data-op="${n}"><span class="on">${n + 1}</span><span class="ot"><b>${$(i.name)}</b><small>${$(t.period)} · ${$(i.career.armyName)}${a?.award ? ` · ` + $(a.award) : ``}${a?.hero ? ` · Герой` : ``}</small></span><span class="os">${s}</span></div>`;
        }).join(``),
        o = n.roster.length
          ? `<div class="guards panel"><b>${Q(`guard`)} Гвардия армии</b>${n.roster.map((e) => `<div class="gd"><span>${$(e.name)}</span><small>${ee[e.type].name.toLowerCase()} · опыт ${`★`.repeat(Math.max(1, ae(e.xp)))} · гвардия с операции «${$(Sa(e.op).name)}»</small></div>`).join(``)}<small class="dim">Гвардейцы получают +10% к атаке и обороне и сохраняют опыт. Погибшая дивизия выбывает навсегда.</small></div>`
          : ``;
      ((t.innerHTML = `<div class="setup car">
<div class="gen panel dos">${wo(4, `pt`, this.campLook(r))}<div class="gtxt"><div class="gname">${$(e.name)}</div><div class="grank">${$(ha[n.rank])}${n.hero ? ` · ` + $(Aa(n.hero)) : ``}</div><div class="ribs">${this.ribbons(n) || `<span class="dim">Наград пока нет</span>`}</div><small class="dim">Личное дело · операций ${n.done} из ${i} · звёзд ${n.stars} из ${i * 3} · разгромлено соединений ${n.kills} · потеряно ${n.lost}</small></div></div>
<div class="ops">${a}</div>
<button class="btn fmapbtn" id="d-map">${Q(`fmap`, 2)}<span>Карта фронта</span><small>${$(FRONT_STAGES[Math.min(r, i)].title)}</small></button>
${this.perksHTML(n.rank)}
${o}
<div class="seg">${Po.map((t, n) => `<button class="btn ${n === e.diff ? `on` : ``}" data-d="${n}">${t}</button>`).join(``)}</div>
<div class="row"><button class="btn" id="d-back">Назад</button>${n.done ? `<button class="btn" id="d-mem">Мемуары</button>` : ``}<button class="btn gold" id="d-go">${r < i ? `В бой` : `Эпилог`}</button></div>
<button class="btn sm linkbtn" id="d-reset">Начать новую карьеру</button></div>`),
        t.querySelectorAll(`[data-op]`).forEach((e) =>
          e.addEventListener(`click`, () => {
            let t = +e.dataset.op;
            t > r
              ? (Z.error(), this.toast(`Операция откроется после предыдущей`))
              : (Z.click(), this.showBriefing(t));
          }),
        ),
        t.querySelectorAll(`[data-d]`).forEach((t) =>
          t.addEventListener(`click`, () => {
            (Z.click(),
              (e.diff = +t.dataset.d),
              Oa(localStorage, e),
              this.showDossier());
          }),
        ),
        t.querySelector(`#d-back`).addEventListener(`click`, () => {
          (Z.click(), this.showCareerHub());
        }),
        t.querySelector(`#d-mem`)?.addEventListener(`click`, () => {
          (Z.click(), this.showMemoirs());
        }),
        t.querySelector(`#d-map`).addEventListener(`click`, () => {
          (Z.click(), this.showFrontMap());
        }),
        t.querySelector(`#d-go`).addEventListener(`click`, () => {
          (Z.click(), r < i ? this.showBriefing(r) : this.showMemoirs(!0));
        }),
        t.querySelector(`#d-reset`).addEventListener(`click`, () => {
          Z.click();
          let t = this.openModal(
            `<h2>Новая карьера?</h2><p>Личное дело генерала ${$(e.name)} — звания, ордена, гвардия и мемуары — будет удалено.</p><div class="row"><button class="btn" id="r-no">Отмена</button><button class="btn red" id="r-yes">Удалить</button></div>`,
          );
          (t.querySelector(`#r-no`).addEventListener(`click`, () => {
            (Z.click(), this.closeModal());
          }),
            t.querySelector(`#r-yes`).addEventListener(`click`, () => {
              (Z.click(),
                this.closeModal(),
                localStorage.removeItem(va),
                this.loadSave()?.career?.camp && localStorage.removeItem(Do),
                (this.prof = null),
                this.showCampNew());
            }));
        }));
    }
    perksHTML(e) {
      let t = xa(e),
        n = e + 1 < 4 ? xa(e + 1) : [];
      return `<div class="guards panel perks"><b>${Q(`star`)} Права по званию: ${$(ha[e])}</b><small>${t.length ? Ro(t.join(` · `)) : `Пока никаких. Своя авиагруппа и резерв командующего — со званием генерал-лейтенанта и выше.`}</small>${n.length ? `<small class="dim">Следующее звание — ${$(ha[e + 1])}: ${Ro(n.join(` · `))}</small>` : ``}</div>`;
    }
    showBriefing(e) {
      let t = this.prof;
      if (t && e === BRANCH && !routeOf(t)[BRANCH]) {
        this.showFrontMap({ stage: BRANCH });
        return;
      }
      this.menuBack = () => this.showDossier();
      let pf = e > 0 && t.ops[e - 1] && !t.ops[e - 1].skip ? t.ops[e - 1].stars : 0;
      let n = this.$.menu,
        r = Sa(e),
        i = r.career,
        a = J[e],
        o = Y(t, e),
        s = t.ops[e],
        c = o.roster.length
          ? `<div class="guards panel"><b>${Q(`guard`)} С вами идут гвардейцы</b><small>${o.roster.map((e) => $(e.name)).join(` · `)}</small><small class="dim">Они заменят однотипные дивизии вашей армии и сохранят свой опыт.</small></div>`
          : ``,
        l = s
          ? `<div class="hint2 center">Лучший итог: ${`★`.repeat(s.stars)}${s.award ? ` · ` + $(s.award) : ``}. Повторная попытка засчитывается, только если результат лучше.</div>`
          : ``;
      ((n.innerHTML = `<div class="setup car">
<div class="logo sm">${$(r.name)}</div>
<div class="tagline">${$(r.subtitle)} · ${r.maxTurn} ходов · ${$(r.date(1))} — ${$(r.date(r.maxTurn))}</div>
<div class="gen panel">${wo(4, `pt`, this.campLook(e))}<div class="gtxt"><div class="gname">${$(ha[o.rank])} ${$(t.name)}</div><div class="grank">${$(i.role)} · ${$(a.period)}</div><p>${$(this.fillP(i.intro.text, e))}</p></div></div>
${c}${l}
${pf === 3 ? `<div class="hint2 center fxup">${Q(`truck`)} Успех прошлой операции улучшил положение на фронте: снабжение армии +6.</div>` : pf === 1 ? `<div class="hint2 center fxdn">${Q(`truck`)} Неудача прошлой операции ухудшила положение на фронте: снабжение армии −4.</div>` : ``}
${o.rank > 0 ? `<div class="hint2 center">${Q(`star`)} Права по званию: ${Ro(xa(o.rank).join(` · `))}</div>` : ``}
<div class="hint2 center">Сложность: ${Po[t.diff].toLowerCase()} · ★ — армия уцелела · ★★ — выполнено ${Oo(Vn(null, i).two)} · ★★★ — ${Oo(Vn(null, i).three)} и Слава от ${Vn(null, i).fame}</div>
<div class="row"><button class="btn" id="n-back">Личное дело</button><button class="btn gold" id="n-go">Принять командование</button></div></div>`),
        n.querySelector(`#n-back`).addEventListener(`click`, () => {
          (Z.click(), this.showDossier());
        }),
        n.querySelector(`#n-go`).addEventListener(`click`, () => {
          (Z.select(), this.startCampOp(e));
        }),
        this.previewOp(e));
    }
    previewOp(e) {
      let t = this.prof;
      if (!t) return;
      let n = Sa(e);
      (this.useMap(this.mapFor(n)),
        (this.G = Vt(this.m, n, `SOV`, t.diff, 1941 + e)),
        Ra(this.G, t, e));
      let r = this.view;
      (r.setGame(this.G),
        r.dispPos.clear(),
        r.ghosts.clear(),
        r.hidden.clear(),
        (r.dispOwner = null),
        (r.zone = null),
        this.updateSupply());
      let i = this.G.s.units.filter((e) => P(this.G, e)),
        a = 0,
        s = 0;
      for (let e of i) {
        let [t, n] = o(this.m.g, e.hex);
        ((a += t), (s += n));
      }
      let c = i.length
        ? this.nearestHex(a / i.length, s / i.length)
        : this.mapCenter();
      this.previewCamera(c);
    }
    startCampOp(e) {
      let t = this.prof;
      if ((this.closeFront(), !t)) return;
      let n = Sa(e);
      (this.useMap(this.mapFor(n)),
        (this.diff = t.diff),
        (this.scen = n),
        (this.outcome = null),
        localStorage.removeItem(Do),
        (this.G = Vt(this.m, n, `SOV`, t.diff)),
        Ra(this.G, t, e),
        this.enterGame(!0));
    }
    showMemoirs(e = !1) {
      let t = this.prof;
      if (!t) return;
      let n = J.map((e, n) => Va(t, n)).filter((e) => !!e),
        r = ka(t) >= J.length;
      r && n.push(Ha(t));
      let i = n
          .map(
            (e, t) =>
              `<div class="chap" id="ch-${t}"><h3>${t < J.length && !(r && t === n.length - 1) ? `Глава ${t + 1}. ` : ``}${$(e.title)}</h3><div class="date">${$(e.sub)}</div>${e.text.map((e) => `<p>${$(e)}</p>`).join(``)}</div>`,
          )
          .join(``),
        a = this
          .openModal(`<div class="tghead">${Q(`book`, 3)}<div><h2>«От Смоленска до Берлина»</h2><div class="date">Воспоминания: ${$(ha[Y(t).rank])} ${$(t.name)}</div></div></div>
<div class="memo">${i || `<p>Мемуары пока не написаны: впереди первая операция.</p>`}</div>
<div class="row"><button class="btn gold" id="mm-ok">Закрыть</button></div>`);
      (a.classList.add(`paperdlg`),
        e &&
          r &&
          setTimeout(
            () =>
              a
                .querySelector(`#ch-${n.length - 1}`)
                ?.scrollIntoView({ block: `start` }),
            30,
          ),
        a.querySelector(`#mm-ok`).addEventListener(`click`, () => {
          (Z.click(), this.closeModal());
        }));
    }
    showHelp() {
      let e =
        this.inGame && this.G.s.career
          ? Bo() + zo()
          : zo() + (this.inGame ? `` : Bo());
      this.openModal(
        e +
          `<div class="row"><button class="btn gold" id="h-ok">Понятно</button></div>`,
      )
        .querySelector(`#h-ok`)
        .addEventListener(`click`, () => {
          (Z.click(), this.closeModal());
        });
    }
    showGameMenu() {
      this.inGame &&
        this.openModal(
          `<h2>Меню</h2><div class="opts">
<button class="btn gold" data-a="resume">Продолжить игру</button>
<button class="btn" data-a="sound">Звук: ${co.on ? `вкл` : `выкл`}</button>
<button class="btn" data-a="fast">Быстрые ходы противника: ${this.fast ? `вкл` : `выкл`}</button>
<button class="btn" data-a="labels">Названия городов: ${this.view.showLabels ? `вкл` : `выкл`}</button>
<button class="btn" data-a="help">Как играть</button>
<button class="btn" data-a="restart">Начать заново</button>
<button class="btn" data-a="exit">Сохранить и выйти в меню</button></div>`,
        )
          .querySelectorAll(`[data-a]`)
          .forEach((e) =>
            e.addEventListener(`click`, () => {
              Z.click();
              let t = e.dataset.a;
              t === `resume`
                ? this.closeModal()
                : t === `sound`
                  ? ((co.on = !co.on), this.showGameMenu())
                  : t === `fast`
                    ? (this.setFast(!this.fast), this.showGameMenu())
                    : t === `labels`
                      ? ((this.view.showLabels = !this.view.showLabels),
                        (this.view.dirty = !0),
                        this.showGameMenu())
                      : t === `help`
                        ? this.showHelp()
                        : t === `restart`
                          ? this.confirmRestart()
                          : t === `exit` && (this.save(), this.showMenu());
            }),
          );
    }
    confirmRestart() {
      let e = this.openModal(
        `<h2>Начать заново?</h2><p>Текущая кампания будет потеряна.</p><div class="row"><button class="btn" id="r-no">Отмена</button><button class="btn red" id="r-yes">Начать заново</button></div>`,
      );
      (e.querySelector(`#r-no`).addEventListener(`click`, () => {
        (Z.click(), this.closeModal());
      }),
        e.querySelector(`#r-yes`).addEventListener(`click`, () => {
          (Z.click(),
            this.startNew(this.G.s.player, this.G.s.difficulty, this.G.sc));
        }));
    }
    setFast(e) {
      ((this.fast = e),
        localStorage.setItem(`wf_fast`, e ? `1` : `0`),
        this.renderAIWait());
    }
    startNew(e, t, n = this.scen) {
      let r = this.G?.s.career?.camp;
      r && n === this.G.sc && this.prof
        ? this.startCampOp(r.op)
        : (n.career || (this.side = e),
          (this.diff = t),
          (this.scen = n),
          this.useMap(this.mapFor(n)),
          localStorage.removeItem(Do),
          (this.G = Vt(this.m, n, e, t)),
          this.enterGame(!0));
    }
    continueGame() {
      let e = this.loadSave(),
        t = e ? ma[e.scen] : null;
      !e || !t
        ? this.showMenu()
        : (e.career?.camp &&
            ((e.career.camp.op = Ta(e.scen)),
            e.career.camp.op < 0 && delete e.career.camp),
          this.useMap(this.mapFor(t)),
          (this.outcome = null),
          (this.G = Ht(e, this.m, t)),
          (this.scen = t),
          e.career || (this.side = e.player),
          (this.diff = e.difficulty),
          this.enterGame(!1));
    }
    enterGame(e) {
      this.menuBack = null;
      let t = ++this.session;
      ((this.inGame = !0),
        (this.playerTurn = !1),
        (this.busy = !0),
        (this.sel = null),
        (this.selReach = null),
        (this.selAtt = null),
        (this.mode = `none`),
        (this.undo = []),
        this.closeModal(),
        this.$.menu.classList.add(`hidden`));
      for (let e of [`top`, `rail`, `bottom`])
        this.$[e].classList.remove(`hidden`);
      let n = this.view;
      (n.setGame(this.G),
        n.dispPos.clear(),
        n.ghosts.clear(),
        n.hidden.clear(),
        (n.dispOwner = null),
        (n.zone = this.G.s.career ? Cn(this.G) : null),
        this.updateSupply(),
        this.natChip(),
        this.hud(),
        this.cardHint());
      let r = this.G.s.units.filter((e) => P(this.G, e)),
        i = 0,
        a = 0;
      for (let e of r) {
        let [t, n] = o(this.m.g, e.hex);
        ((i += t), (a += n));
      }
      let s = r.length
          ? this.nearestHex(i / r.length, a / r.length)
          : this.mapCenter(),
        c = Math.max(
          1.3,
          Math.min(
            2.4,
            Math.min(window.innerWidth, window.innerHeight * 1.6) / 330,
          ),
        );
      (n.centerOn(s, !1, c), this.loop(t));
    }
    nearestHex(e, t) {
      let n = 0,
        r = 0xde0b6b3a7640000;
      for (let i = 0; i < this.m.N; i++) {
        if (!y(this.m, i)) continue;
        let [a, s] = o(this.m.g, i),
          c = (a - e) ** 2 + (s - t) ** 2;
        c < r && ((r = c), (n = i));
      }
      return n;
    }
    alive(e) {
      return this.inGame && e === this.session;
    }
    async loop(e = this.session) {
      let t = this.G;
      for (; this.alive(e) && !t.s.result;) {
        if ((await this.processPending(e), !this.alive(e))) return;
        if (ut(t) === t.s.player) {
          if (t.s.career) {
            if ((await this.careerTurnStart(e), !this.alive(e))) return;
            if (t.s.result) break;
          }
          this.beginPlayerPhase();
          return;
        }
        if ((await this.runAI(e), !this.alive(e) || t.s.result)) break;
        let n = t.s.owner.slice(),
          r = Xt(t);
        await this.play(r, n, !0);
      }
      this.alive(e) && t.s.result && this.showResult();
    }
    async processPending(e) {
      let t = this.G;
      for (; t.s.pending.length && this.alive(e);) {
        let n = t.s.pending[0];
        if (n.nat !== t.s.player) {
          t.s.pending.shift();
          continue;
        }
        let r = await this.showEvent(n.id);
        if (!this.alive(e)) return;
        let i = t.s.owner.slice(),
          a = Gt(t, n.id, r);
        (t.s.pending[0] === n && t.s.pending.shift(),
          await this.play(a, i),
          (this.undo = []));
      }
    }
    showEvent(e) {
      let t = this.G,
        n = t.sc.events.find((t) => t.id === e),
        r = n.views[t.s.player];
      return new Promise((e) => {
        Z.turn();
        let i = r.options.length === 1,
          a = this.openModal(
            `<div class="evhead"><span id="ev-art"></span><div><div class="date">${$(t.sc.date(t.s.turn))}</div><h2>${$(r.title)}</h2></div></div>
<p>${Ro(r.text)}</p><div class="opts">${r.options.map((e, t) => `<button class="btn opt ${i ? `gold` : ``}" data-i="${t}">${$(e.label)}${e.desc ? `<small>${Ro(e.desc)}</small>` : ``}</button>`).join(``)}</div>`,
            { dismiss: !1 },
          );
        (a.querySelector(`#ev-art`).replaceWith(yo(n.icon, t.s.player)),
          a.querySelectorAll(`[data-i]`).forEach((t) =>
            t.addEventListener(`click`, () => {
              (Z.click(), this.closeModal(), e(+t.dataset.i));
            }),
          ));
      });
    }
    beginPlayerPhase() {
      let e = this.G;
      ((this.playerTurn = !0),
        (this.busy = !1),
        (this.undo = []),
        (this.endArmed = 0),
        (this.nextIdx = -1),
        this.renderAIWait(null),
        this.$.bottom.classList.remove(`hidden`),
        (this.view.zone = e.s.career ? Cn(e) : null),
        this.updateSupply(),
        this.deselect(),
        this.hud(),
        this.banner(`Ход ${e.s.turn} из ${e.sc.maxTurn}`, e.sc.date(e.s.turn)),
        this.save());
      let t = e.s.career ? `wf_tut_car` : `wf_tut`;
      localStorage.getItem(t) ||
        (localStorage.setItem(t, `1`),
        localStorage.setItem(`wf_tut`, `1`),
        setTimeout(() => {
          this.playerTurn && !this.modalOpen && this.showHelp();
        }, 900));
    }
    async runAI(e, t, n) {
      let r = this.G,
        i = ut(r);
      ((this.playerTurn = !1),
        (this.busy = !0),
        (this.skipAI = !1),
        this.deselect(),
        this.renderAIWait(i, n),
        this.hud());
      let a = Qa(r, t ? { filter: t } : {});
      for (; this.alive(e);) {
        let e = r.s.owner.slice(),
          t = a.next();
        if (
          t.done ||
          (t.value.length && (await this.play(t.value, e, !0)), r.s.result)
        )
          break;
      }
      this.alive(e) && this.renderAIWait(null);
    }
    renderAIWait(e, t) {
      let n = this.$.aiwait;
      if (e === null) {
        (n.classList.add(`hidden`), this.$.bottom.classList.remove(`hidden`));
        return;
      }
      if (e === void 0) {
        if (n.classList.contains(`hidden`)) return;
        ((e = n.dataset.nat), (t = n.dataset.lbl || void 0));
      }
      ((n.dataset.nat = e), (n.dataset.lbl = t || ``));
      let r = this.G.nd[e];
      ((n.innerHTML = `<span data-f></span><span>${$(t || r.name)}: ход<span class="dots"></span></span><button class="btn sm ${this.fast || this.skipAI ? `on` : ``}" id="b-fast"></button>`),
        n.querySelector(`[data-f]`).replaceWith(mo(r, 2)));
      let i = n.querySelector(`#b-fast`);
      (i.append(_o(`ff`)),
        i.addEventListener(`click`, () => {
          (Z.click(),
            this.fast
              ? this.setFast(!1)
              : ((this.skipAI = !this.skipAI), this.renderAIWait()));
        }),
        n.classList.remove(`hidden`),
        this.$.bottom.classList.add(`hidden`));
    }
    async play(e, t, n = !1) {
      if (!e.length) return;
      let r = this.session,
        i = this.view;
      this.G;
      let a = n && (this.fast || this.skipAI),
        o = (e) => (a ? e * 0.3 : e);
      t && (i.dispOwner = t.slice());
      for (let t of e)
        t.t === `move`
          ? i.dispPos.has(t.id) || i.dispPos.set(t.id, t.path[0])
          : t.t === `combat`
            ? (i.dispPos.has(t.att) || i.dispPos.set(t.att, t.from),
              i.dispPos.has(t.def) || i.dispPos.set(t.def, t.to))
            : t.t === `destroyed`
              ? i.ghosts.set(t.id, { ...t.u, str: Math.max(1, t.u.str) })
              : (t.t === `spawn` || t.t === `recruit`) && i.hidden.add(t.id);
      i.dirty = !0;
      try {
        for (let t of e) {
          if (r !== this.session) break;
          await this.playOne(t, n, a, o);
        }
      } finally {
        (i.dispPos.clear(),
          i.ghosts.clear(),
          i.hidden.clear(),
          (i.dispOwner = null),
          (i.ownDirty = !0),
          (i.dirty = !0),
          r === this.session && (this.updateSupply(), this.hud()));
      }
    }
    natOf(e) {
      return tt(this.G, e)?.nat ?? this.view.ghosts.get(e)?.nat;
    }
    involvesPlayer(...e) {
      let t = this.G.s.player;
      return e.some((e) => e && (e === t || M(this.G, e, t)));
    }
    async playOne(e, t, n, r) {
      let i = this.view,
        a = this.G;
      switch (e.t) {
        case `move`:
          ((!t || e.path.some((e) => i.isVisible(e, 0))) &&
            (n || Z.move(), await i.animateMove(e.id, e.path, r(t ? 105 : 80))),
            i.dispPos.set(e.id, e.path[e.path.length - 1]));
          break;
        case `capture`:
          if (
            (i.dispOwner &&
              ((i.dispOwner[e.hex] = $e(a, e.nat)), (i.ownDirty = !0)),
            e.city)
          ) {
            let r = a.m.cities[a.m.cityAt[e.hex]],
              o = this.involvesPlayer(e.nat),
              s = !o && r && (r.nat === a.s.player || M(a, r.nat, a.s.player));
            ((!t || o || s || (r && r.vp >= 2)) &&
              (this.toast(
                `${a.nd[e.nat].name}: занят город ${e.city}`,
                o ? `good` : s ? `bad` : ``,
              ),
              n || Z.capture()),
              !n &&
                i.isVisible(e.hex, 0) &&
                i.ring(e.hex, o ? `#9ff0a6` : `#ffb0a6`));
          }
          break;
        case `combat`: {
          let a = this.natOf(e.att),
            o = this.natOf(e.def);
          t &&
            !n &&
            !i.isVisible(e.to) &&
            this.involvesPlayer(a, o) &&
            (i.centerOn(e.to), await Io(320));
          let s = i.isVisible(e.to, 0) || i.isVisible(e.from, 0);
          (s &&
            (await this.lunge(e.att, e.from, e.to, r(150)),
            i.boom(e.to, e.outcome !== `hold`),
            n || Z.boom(),
            i.text(e.to, e.dStr ? `−${e.dStr}` : `орг −${e.dOrg}`, `#ff6a5a`),
            (e.aStr || e.aOrg) &&
              i.text(
                e.from,
                e.aStr ? `−${e.aStr}` : `орг −${e.aOrg}`,
                `#ffc46a`,
                120,
              ),
            await Io(r(470))),
            e.outcome === `retreat` &&
              e.retreatTo !== void 0 &&
              (s && (await i.animateMove(e.def, [e.to, e.retreatTo], r(150))),
              i.dispPos.set(e.def, e.retreatTo)));
          break;
        }
        case `destroyed`: {
          (i.isVisible(e.hex, 0) &&
            (i.boom(e.hex, !0), n || Z.bigBoom(), await Io(r(420))),
            i.ghosts.delete(e.id),
            i.dispPos.delete(e.id),
            (i.dirty = !0));
          let t = this.involvesPlayer(e.nat);
          this.toast(`${e.name} ${e.reason}`, t ? `bad` : `good`);
          break;
        }
        case `air`:
          (t &&
            !n &&
            !i.isVisible(e.hex) &&
            this.involvesPlayer(this.natOf(e.id)) &&
            (i.centerOn(e.hex), await Io(320)),
            i.isVisible(e.hex, 0) &&
              (i.plane(e.hex, r(650)),
              n || Z.plane(),
              await Io(r(600)),
              i.boom(e.hex),
              n || Z.boom(),
              i.text(
                e.hex,
                e.dStr ? `−${e.dStr}` : `орг −${e.dOrg}`,
                `#ffd34d`,
              ),
              await Io(r(380))));
          break;
        case `recruit`:
        case `spawn`: {
          i.hidden.delete(e.id);
          let t = tt(a, e.id);
          (t && i.isVisible(t.hex, 0) && i.ring(t.hex, `#ffffff`),
            (i.dirty = !0));
          break;
        }
        case `reinforce`: {
          let t = tt(a, e.id);
          t &&
            (i.text(t.hex, `+${e.add}`, `#7ff08a`),
            i.ring(t.hex, `#7ff08a`),
            Z.capture(),
            await Io(250));
          break;
        }
        case `turn`:
          this.hud();
      }
    }
    lunge(e, t, n, r) {
      let i = this.view,
        a = o(this.m.g, t),
        s = o(this.m.g, n);
      return new Promise((t) => {
        let n = performance.now(),
          o = () => {
            let c = Math.min(1, (performance.now() - n) / r),
              l = Math.sin(c * Math.PI) * 0.38;
            (i.animPos.set(e, [
              a[0] + (s[0] - a[0]) * l,
              a[1] + (s[1] - a[1]) * l,
            ]),
              (i.dirty = !0),
              c < 1 ? requestAnimationFrame(o) : (i.animPos.delete(e), t()));
          };
        o();
      });
    }
    updateSupply() {
      let e = this.G,
        t = {};
      for (let n of dt(e)) t[n] = F(e, n);
      ((this.view.supplyCache = t), (this.view.dirty = !0));
    }
    natChip() {
      let e = this.G.nd[this.G.s.player],
        t = this.$[`c-nat`];
      (t.classList.toggle(`genchip`, !!this.G.s.career),
        this.G.s.career
          ? (t.innerHTML = `${wo(1.5, `pt`, this.gLook())}<span class="hide-narrow">${$(un(this.G))}</span>`)
          : ((t.innerHTML = `<span data-f></span><span class="hide-narrow">${$(e.name)}</span>`),
            t.querySelector(`[data-f]`).replaceWith(mo(e, 2))));
    }
    gLook() {
      let e = this.G.s.career?.camp;
      if (e) return { ...this.campLook(e.op), rank: e.rank };
    }
    hud() {
      let e = this.G,
        t = e.s.player,
        n = e.s.nations[t],
        r = e.sc.weather ? w[ct(e)] : null;
      this.$[`c-turn`].innerHTML =
        `<b>${r ? Q(r.icon) + ` ` : ``}Ход ${e.s.turn}/${e.sc.maxTurn}</b><span class="sub">${$(e.sc.date(e.s.turn))}${r ? ` · ` + $(r.name.toLowerCase()) : ``}</span>`;
      let i = e.sc.weather && this.inGame ? ct(e) : `clear`,
        a = this.$.wxfx;
      a.dataset.w !== i &&
        ((a.dataset.w = i),
        (a.className = i === `clear` ? `hidden` : `wx-` + i));
      let o = e.s.career;
      if (o) {
        let e = (e) =>
          `<span class="rv ${e === `trust` && o.rep.trust <= 20 ? `warn` : ``}">${Q(e)}<b>${o.rep[e]}</b></span>`;
        this.$[`c-pp`].innerHTML =
          `<span class="rv">${Q(`crate`)}<b>${o.sup}</b><span class="sub hide-narrow">+${an(o)}</span></span>${e(`trust`)}${e(`auth`)}${e(`fame`)}`;
      } else
        this.$[`c-pp`].innerHTML =
          `${Q(`gear`)}<b>${n.pp}</b><span class="sub">+${Kt(e, t)}</span>`;
      (this.$[`c-pp`].classList.toggle(`repchip`, !!o),
        this.$[`b-obj`].replaceChildren(_o(o ? `order` : `star`)));
      let s = this.playerTurn && !this.busy,
        c = kt(e, t, !!o);
      ((this.$[`bd-air`].textContent = String(c)),
        this.$[`bd-air`].classList.toggle(`hidden`, c <= 0),
        (this.$[`b-air`].disabled = !s || (c <= 0 && !o)),
        this.$[`b-tel`].classList.toggle(`hidden`, !o),
        o &&
          (this.$[`bd-tel`].classList.toggle(`hidden`, !!o.req || !s),
          (this.$[`b-tel`].disabled = !s)),
        this.$[`b-air`].classList.toggle(`on`, this.mode === `air`),
        this.$[`b-sup`].classList.toggle(`on`, this.showSupply),
        (this.$[`b-undo`].disabled = !s || !this.undo.length));
      let l = this.playerTurn ? this.actionable().length : 0;
      ((this.$[`bd-next`].textContent = String(l)),
        this.$[`bd-next`].classList.toggle(`hidden`, l === 0),
        (this.$[`b-next`].disabled = !s));
      let u = this.$.endbtn;
      ((u.disabled = !s), u.classList.toggle(`pulse`, s && l === 0));
    }
    actionable() {
      let e = this.G;
      return e.s.units.filter((t) => {
        if (!P(e, t) || !wt(e, t)) return !1;
        let n = t.mp > 0 ? pt(e, t) : null;
        if (!t.moved && n) {
          for (let r of n.keys()) if (r !== t.hex && ht(e, t, r)) return !0;
        }
        return !t.attacked && Et(e, t, n || void 0).size > 0;
      });
    }
    supLayer() {
      if (!this.showSupply) return null;
      let e = this.G,
        t = e.s.player,
        n = this.view.supplyCache[t] || F(e, t),
        r = new Uint8Array(e.m.N),
        i = (n) => {
          let r = N(e, n);
          return !!r && (r === t || M(e, r, t));
        };
      for (let t = 0; t < e.m.N; t++)
        y(e.m, t) && i(t) && (r[t] = n[t] ? 1 : 2);
      for (let t of e.m.cities)
        (t.cap || t.hub || t.port) && i(t.hex) && n[t.hex] && (r[t.hex] = 3);
      return r;
    }
    counterCanvas(e, t) {
      let n = this.view.supplyCache[e.nat]
          ? this.view.supplyCache[e.nat][e.hex] === 0 && !e.depot
          : !1,
        r = this.view.counter(
          e,
          !1,
          n,
          e.nat === this.G.s.player && !P(this.G, e),
        ),
        i = document.createElement(`canvas`);
      return (
        (i.width = r.width),
        (i.height = r.height),
        i.getContext(`2d`).drawImage(r, 0, 0),
        (i.style.width = r.width * t + `px`),
        (i.style.height = r.height * t + `px`),
        i
      );
    }
    cardHint(e) {
      let t = this.$.card;
      if (e) {
        ((t.innerHTML = `<div style="flex:1"><div class="name">${Ro(e)}</div></div><div class="acts"><button class="btn sm" id="k-cancel">Отмена</button></div>`),
          t.querySelector(`#k-cancel`).addEventListener(`click`, () => {
            (Z.click(), this.setMode(`none`));
          }));
        return;
      }
      let n = this.playerTurn ? this.actionable().length : 0;
      if (this.G.s.result) {
        t.innerHTML = `<div><div class="name">${$(this.G.s.result.title)}</div><div class="hint">Кампания окончена</div></div>`;
        return;
      }
      let r = this.showSupply
          ? `<div class="hint legend"><span class="sw s1"></span>снабжение есть <span class="sw s2"></span>нет снабжения <span class="sw s3"></span>источник</div>`
          : ``,
        i = this.G.s.career
          ? `Ваши дивизии — яркие фишки, блёклые — соседние армии (ими управляет компьютер).`
          : `Нажмите на дивизию, чтобы выбрать её. Долгое нажатие — дальность хода врага.`;
      t.innerHTML = `<div><div class="name">${this.playerTurn ? (n ? `Готовы к действию: ${n}` : `Все войска походили — завершите ход`) : `Ход противника`}</div>${r || `<div class="hint">${i}</div>`}</div>`;
    }
    unitCard(e, t = ``) {
      let n = this.G,
        r = n.nd[e.nat],
        i = ee[e.type],
        a = e.nat === n.s.player,
        o = P(n, e),
        s = n.s.career && a ? gn(n, e) : void 0,
        c = r.orgMax,
        l =
          !this.view.supplyCache[e.nat] ||
          this.view.supplyCache[e.nat][e.hex] === 1,
        u = ae(e.xp),
        d = C[n.m.terrain[e.hex]],
        f = n.s.forts[e.hex] || 0,
        p = [
          i.name,
          a ? `` : r.name,
          s ? s.name : ``,
          u ? `опыт ` + `★`.repeat(u) : ``,
          d.name.toLowerCase(),
        ]
          .filter(Boolean)
          .join(` · `),
        m = [
          l
            ? `<span class="tag ok">снабжение есть</span>`
            : e.depot
              ? `<span class="tag au">окружена — на запасах армии (−2 в ход)</span>`
              : `<span class="tag bad">нет снабжения${e.oos ? `, ${e.oos}-й ход` : ``}</span>`,
        ];
      (e.entrench
        ? m.push(
            `<span class="tag au">окопы ур. ${e.entrench}: +${e.entrench * 10}% к обороне</span>`,
          )
        : o &&
          m.push(`<span class="tag">окопов нет — постойте ход на месте</span>`),
        f &&
          m.push(
            `<span class="tag au">укрепления ур. ${f}: +${f * 25}% к обороне</span>`,
          ),
        e.guard &&
          m.push(
            `<span class="tag gd">${Q(`guard`, 1)} гвардия: +10% к атаке и обороне</span>`,
          ));
      let h = n.sc.weather ? w[ct(n)] : null;
      if (h) {
        let t = [],
          n = h.mp[e.type] || 0;
        (n && t.push(`ход ${n < 0 ? `−` : `+`}${Math.abs(n)}`),
          (e.type === `arm` || e.type === `mot`) &&
            h.mech < 1 &&
            t.push(`атака −${Math.round((1 - h.mech) * 100)}%`),
          h.cold < 1 &&
            !r.winter &&
            t.push(
              `атака −${Math.round((1 - h.cold) * 100)}%, организация вдвое медленнее`,
            ),
          t.length &&
            m.push(
              `<span class="tag wxt">${Q(h.icon, 1)} ${$(h.name.toLowerCase())}: ${$(t.join(`, `))}</span>`,
            ));
      }
      let g = e.org / c,
        _ = g > 0.6 ? `#62d36b` : g > 0.3 ? `#e8c64a` : `#e5574b`,
        v = (e, t, n) =>
          `<span class="bar"><i style="width:${Math.round((100 * Math.max(0, e)) / t)}%;background:${n}"></i></span>`,
        y = `<span>Сила <b>${e.str}</b>/10${v(e.str, 10, `#d8dadc`)}</span><span>Орг. <b>${e.org}</b>/${c}${v(e.org, c, _)}</span>${o ? `<span>Ход <b>${e.mp}</b>/${lt(n, e)}</span>` : ``}<span>Атк <b>${i.atk}</b> · Защ <b>${i.def}</b></span>`,
        b = t;
      b ||
        (a && !o
          ? (b = `Соседняя армия: ${s ? `${$(s.name)} (${$(s.general)})` : `резерв`} · управляет компьютер`)
          : !l && !e.depot
            ? (b = `<span class="warn">Без снабжения теряет организацию, с 3-го хода — силу${n.s.career && o ? ` (запасы армии кончились)` : ``}</span>`)
            : o && e.fresh
              ? (b = `Сформирована — вступит в бой со следующего хода`)
              : o && wt(n, e) && !e.attacked && e.org < c * 0.1
                ? (b = `<span class="warn">Слишком низкая организация для атаки</span>`)
                : o &&
                  this.playerTurn &&
                  wt(n, e) &&
                  e.mp <= 0 &&
                  (e.attacked || e.reinforced) &&
                  (b = `Действия на этот ход исчерпаны`));
      let x = ``;
      if (o && this.playerTurn && Ft(n, e)) {
        let t = Math.min(2, 10 - e.str, Math.floor(Pt(n, e) / 8));
        x = `<div class="acts"><button class="btn sm green" id="k-reinf">Пополнить +${t}<small>${t * 8} ${Q(n.s.career ? `crate` : `gear`)}</small></button></div>`;
      }
      let S = this.$.card;
      ((S.innerHTML = `<span data-c></span><div class="ci"><div class="l1"><span class="name">${$(e.name)}</span><span class="meta">${$(p)}</span></div><div class="stats">${y}</div><div class="meta tags">${m.join(``)}${b ? ` <span>${b}</span>` : ``}</div></div>${x}`),
        S.querySelector(`[data-c]`).replaceWith(this.counterCanvas(e, 2)),
        S.querySelector(`#k-reinf`)?.addEventListener(`click`, (t) => {
          (t.stopPropagation(), this.doReinforce(e));
        }));
    }
    hexCard(e) {
      let t = this.G,
        n = t.m.cityAt[e],
        r = n >= 0 ? t.m.cities[n] : null,
        i = N(t, e),
        a = i ? t.nd[i] : null,
        o = C[t.m.terrain[e]],
        s = [];
      (r?.cap && s.push(`столица`),
        r?.hub && s.push(`узел снабжения`),
        r?.port && s.push(`порт`),
        t.s.forts[e] && s.push(`укрепления ${t.s.forts[e]}`));
      let c =
          o.def > 1
            ? `оборона +${Math.round((o.def - 1) * 100)}%`
            : `без бонуса обороны`,
        l = t.s.player,
        u = ``,
        d = ``;
      r &&
        i === l &&
        this.playerTurn &&
        !t.s.career &&
        (jt(t, l, e)
          ? (u = `<div class="acts"><button class="btn sm gold" id="k-rec">Набрать войска</button></div>`)
          : !(r.hub || r.vp >= 2) && r.nat === l
            ? (d = `Набор войск — только в крупных городах и узлах снабжения`)
            : r.nat !== l &&
              (d = `Набор войск возможен только в своих исконных городах`));
      let f = this.$.card;
      if (
        ((f.innerHTML = `${a ? `<span data-f></span>` : ``}<div class="ci"><div class="l1"><span class="name">${$(r ? r.name : o.name)}${r ? ` <span style="color:var(--gold)">${`★`.repeat(Math.max(1, Math.min(5, r.vp)))}</span>` : ``}</span>
<span class="meta">${$([a ? a.name : `нейтральная территория`, r ? o.name.toLowerCase() : ``, ...s].filter(Boolean).join(` · `))}</span></div>
<div class="meta">${$(c)} · движение пехоты ${o.cost.inf}${r ? ` · очки победы ${r.vp}` : ``}</div>${d ? `<div class="meta">${$(d)}</div>` : ``}</div>${u}`),
        a)
      ) {
        let e = mo(a, 3);
        (e.classList.add(`flag`), f.querySelector(`[data-f]`).replaceWith(e));
      }
      f.querySelector(`#k-rec`)?.addEventListener(`click`, (t) => {
        (t.stopPropagation(), this.showRecruit(e));
      });
    }
    onTap(e) {
      if (!this.inGame || this.modalOpen || this.busy) return;
      let t = this.G;
      if (!this.playerTurn) return;
      if (e < 0) {
        this.deselect();
        return;
      }
      if (this.mode === `air`) {
        this.view.overlay.air?.has(e) ? this.doAir(e) : this.setMode(`none`);
        return;
      }
      if (this.mode === `recruit`) {
        if (this.view.overlay.recruit?.has(e)) {
          this.showRecruit(e);
          return;
        }
        this.setMode(`none`);
      }
      let n = rt(t, e),
        r = this.sel;
      if (r) {
        if (e === r.hex) {
          (Z.click(), this.deselect());
          return;
        }
        if (this.selAtt?.has(e)) {
          (Z.click(), this.showForecast(r, e, this.selAtt.get(e)));
          return;
        }
        if (!n && this.selReach?.has(e) && ht(t, r, e)) {
          this.doMove(r, e);
          return;
        }
      }
      n
        ? this.select(n)
        : (this.deselect(),
          y(t.m, e) &&
            (this.hexCard(e),
            this.view.setOverlay({ sel: e, supply: this.supLayer() }),
            Z.click()));
    }
    onLong(e) {
      if (!this.inGame || this.modalOpen || this.busy || e < 0) return;
      let t = this.G,
        n = rt(t, e);
      if (n && !P(t, n)) {
        (this.setMode(`none`, !1),
          (this.sel = null),
          (this.selReach = null),
          (this.selAtt = null));
        let r = pt(t, n, lt(t, n)),
          i = new Set();
        for (let e of r.keys()) e !== n.hex && i.add(e);
        (this.view.setOverlay({ reach: i, sel: e, supply: this.supLayer() }),
          this.unitCard(n, `Показана дальность хода этой дивизии`),
          Z.select());
      } else
        n
          ? this.select(n)
          : y(t.m, e) &&
            (this.hexCard(e),
            this.view.setOverlay({ sel: e, supply: this.supLayer() }));
    }
    select(e) {
      let t = this.G;
      (this.setMode(`none`, !1), (this.sel = e));
      let n = P(t, e) && this.playerTurn && wt(t, e),
        r,
        i,
        a;
      if (n) {
        if (
          ((this.selReach = e.mp > 0 ? pt(t, e) : null),
          (this.selAtt = Et(t, e, this.selReach || void 0)),
          (r = new Set()),
          this.selReach)
        )
          for (let n of this.selReach.keys())
            n !== e.hex && ht(t, e, n) && r.add(n);
        ((i = new Set()), (a = new Set()));
        for (let [t, n] of this.selAtt) (n === e.hex ? i : a).add(t);
      } else ((this.selReach = null), (this.selAtt = null));
      (this.view.setOverlay({
        reach: r,
        attack: i,
        moveAttack: a,
        sel: e.hex,
        supply: this.supLayer(),
      }),
        this.unitCard(e),
        Z.select());
    }
    deselect() {
      ((this.sel = null),
        (this.selReach = null),
        (this.selAtt = null),
        this.mode === `none` &&
          (this.view.setOverlay({ supply: this.supLayer() }), this.cardHint()));
    }
    setMode(e, t = !0) {
      let n = this.G,
        r = n.s.player;
      if (((this.mode = e), e === `air`)) {
        let e = new Set();
        for (let t of n.s.units)
          j(n, r, t.nat) && t.airHits < 2 && e.add(t.hex);
        ((this.sel = null),
          (this.selReach = null),
          (this.selAtt = null),
          this.view.setOverlay({ air: e, supply: this.supLayer() }),
          this.cardHint(
            `Авиаудар: выберите вражескую дивизию (осталось ✈ ${kt(n, r, !!n.s.career)})`,
          ));
      } else if (e === `recruit`) {
        let e = new Set();
        for (let t of n.m.cities) jt(n, r, t.hex) && e.add(t.hex);
        ((this.sel = null),
          (this.selReach = null),
          (this.selAtt = null),
          this.view.setOverlay({ recruit: e, supply: this.supLayer() }),
          this.cardHint(
            `Набор войск: выберите подсвеченный город (⚙ ${n.s.nations[r].pp})`,
          ));
      } else t && this.deselect();
      this.hud();
    }
    toggleAir() {
      if (!this.playerTurn || this.busy) return;
      if ((Z.click(), this.mode === `air`)) {
        this.setMode(`none`);
        return;
      }
      let e = !!this.G.s.career;
      if (kt(this.G, this.G.s.player, e) <= 0) {
        let t = this.G.s.career?.perk,
          n = w[ct(this.G)];
        this.toast(
          e
            ? t?.air
              ? Rn(this.G)
                ? `Авиаудары армии на этот ход закончились`
                : `Авиагруппа армии не летает: ${n.name.toLowerCase()}. Можно запросить авиаподдержку по телеграфу`
              : `У армии нет своей авиации — запросите авиаподдержку по телеграфу`
            : `Авиаудары на этот ход закончились`,
        );
      } else this.setMode(`air`);
    }
    toggleSupply() {
      (Z.click(),
        (this.showSupply = !this.showSupply),
        this.toast(
          this.showSupply
            ? `Слой снабжения: зелёные точки — есть, красная штриховка — нет, яркие рамки — источники`
            : `Слой снабжения выключен`,
        ));
      let e = { ...this.view.overlay, supply: this.supLayer() };
      (this.view.setOverlay(e),
        !this.sel && this.mode === `none` && this.cardHint(),
        this.hud());
    }
    recruitMode() {
      if (!this.playerTurn || this.busy) return;
      Z.click();
      let e = this.G,
        t = e.s.player;
      e.m.cities.some((n) => jt(e, t, n.hex))
        ? this.setMode(this.mode === `recruit` ? `none` : `recruit`)
        : this.toast(
            `Нет городов для набора: нужен свой крупный город со снабжением, без врага рядом`,
          );
    }
    nextUnit() {
      if (!this.playerTurn || this.busy) return;
      let e = this.actionable();
      if (!e.length) {
        (Z.click(), this.toast(`Все войска уже походили`));
        return;
      }
      this.nextIdx = (this.nextIdx + 1) % e.length;
      let t = e[this.nextIdx];
      (this.select(t), this.view.centerOn(t.hex));
    }
    pushUndo() {
      (this.undo.push(JSON.stringify(this.G.s)),
        this.undo.length > 30 && this.undo.shift());
    }
    doUndo() {
      this.undo.length &&
        !this.busy &&
        this.playerTurn &&
        ((this.G.s = JSON.parse(this.undo.pop())),
        (this.view.ownDirty = !0),
        this.updateSupply(),
        this.setMode(`none`),
        this.deselect(),
        this.hud(),
        this.save(),
        Z.click(),
        this.toast(`Перемещение отменено`));
    }
    async doMove(e, t) {
      let n = this.G;
      this.pushUndo();
      let r = n.s.owner.slice(),
        i = Tt(n, e, t);
      i.length
        ? ((this.busy = !0),
          this.view.setOverlay({ supply: this.supLayer() }),
          await this.play(i, r),
          (this.busy = !1),
          this.afterAction(e))
        : (this.undo.pop(), Z.error());
    }
    async doAttack(e, t, n) {
      let r = this.G;
      this.undo = [];
      let i = r.s.owner.slice(),
        a = Ot(r, e, t, n);
      a.length
        ? ((this.busy = !0),
          this.view.setOverlay({ supply: this.supLayer() }),
          await this.play(a, i),
          (this.busy = !1),
          this.afterAction(e))
        : Z.error();
    }
    async doReinforce(e) {
      if (this.busy) return;
      let t = It(this.G, e);
      t.length
        ? ((this.undo = []),
          (this.busy = !0),
          await this.play(t),
          (this.busy = !1),
          this.afterAction(e))
        : Z.error();
    }
    async doAir(e) {
      let t = this.G,
        n = t.s.player,
        r = t.s.owner.slice(),
        i = At(t, n, e, !!t.s.career);
      i.length
        ? ((this.undo = []),
          (this.busy = !0),
          this.view.setOverlay({ supply: this.supLayer() }),
          await this.play(i, r),
          (this.busy = !1),
          this.save(),
          t.s.result
            ? this.showResult()
            : this.setMode(kt(t, n, !!t.s.career) > 0 ? `air` : `none`))
        : Z.error();
    }
    afterAction(e) {
      let t = this.G;
      if ((this.save(), t.s.result)) {
        this.showResult();
        return;
      }
      let n = e ? tt(t, e.id) : void 0;
      if (n && wt(t, n)) {
        let e = n.mp > 0 ? pt(t, n) : null;
        if (
          (e && [...e.keys()].some((e) => e !== n.hex && ht(t, n, e))) ||
          (!n.attacked && Et(t, n, e || void 0).size)
        ) {
          (this.select(n), this.hud());
          return;
        }
      }
      (this.deselect(),
        n &&
          (this.unitCard(n),
          this.view.setOverlay({ sel: n.hex, supply: this.supLayer() })),
        this.hud());
    }
    showForecast(e, t, n) {
      let r = this.G,
        i = rt(r, t),
        a = i ? Dt(r, e, t, n) : null;
      if (!i || !a) return;
      let o = (e, t) => {
          let n = Math.min(t, Math.floor(e * 0.75)),
            r = Math.min(t, Math.ceil(e * 1.25));
          return n === r ? `${n}` : `${n}–${r}`;
        },
        s = (e) => `${Math.round(e * 0.8)}–${Math.round(e * 1.2)}`,
        c = Math.round((100 * a.A) / (a.A + a.D)),
        l =
          a.outcome === `destroyed`
            ? a.canRetreat
              ? [`Противник будет разгромлен`, `good`]
              : [`Окружённый противник сдастся`, `good`]
            : a.outcome === `retreat`
              ? [`Противник отступит`, `good`]
              : [`Противник удержит позицию`, `warn`],
        u = a.aStr * 1.25 >= e.str,
        d = this.openModal(
          `<h2>Атака</h2>${n === e.hex ? `` : `<div class="date">С ходу: дивизия сначала переместится к цели</div>`}
<div class="fc">
  <div class="side"><span data-c="a"></span><div>${$(e.name)}</div><div class="loss warn">−${o(a.aStr, e.str)} силы<br>−${s(a.aOrg)} орг.</div></div>
  <div class="vs">VS</div>
  <div class="side"><span data-c="d"></span><div>${$(i.name)}</div><div class="loss good">−${o(a.dStr, i.str)} силы<br>−${s(a.dOrg)} орг.</div></div>
</div>
<div class="ratio"><i style="width:${c}%"></i></div>
<div class="ratiolbl"><span>Атака ${a.A.toFixed(1)}</span><span>Защита ${a.D.toFixed(1)}</span></div>
<div class="outcome ${l[1]}">${l[0]}</div>
${u ? `<div class="outcome warn" style="font-size:14px">Риск потерять дивизию!</div>` : ``}
${a.mods.length ? `<div class="mods">${a.mods.map((e) => `<span>${$(e.l)}</span><span class="${e.good ? `g` : `b`}">${$(e.v)}</span>`).join(``)}</div>` : ``}
<div class="row"><button class="btn" id="f-no">Отмена</button><button class="btn red" id="f-yes">Атаковать</button></div>`,
          { sheet: !0 },
        );
      (d.querySelector(`[data-c="a"]`).replaceWith(this.counterCanvas(e, 3)),
        d.querySelector(`[data-c="d"]`).replaceWith(this.counterCanvas(i, 3)),
        d.querySelector(`#f-no`).addEventListener(`click`, () => {
          (Z.click(), this.closeModal());
        }),
        d.querySelector(`#f-yes`).addEventListener(`click`, () => {
          (this.closeModal(), this.doAttack(e, t, n));
        }));
    }
    showRecruit(e) {
      let t = this.G,
        n = t.s.player,
        r = t.s.nations[n],
        i = t.m.cities[t.m.cityAt[e]];
      if (!i || !jt(t, n, e)) return;
      let a = this
        .openModal(`<h2>Набор: ${$(i.name)}</h2><div class="date">Промышленность: ${Q(`gear`)} ${r.pp} · новые части вступают в бой со следующего хода</div>
<div class="recruit">${Fo.map((e) => {
        let i = Mt(t, n, e),
          a = ee[e];
        return `<button class="btn" data-t="${e}" ${r.pp < i ? `disabled` : ``}><span data-s="${e}"></span><b class="px">${a.name}</b><small>Атк ${a.atk} · Защ ${a.def} · Ход ${a.mp}</small><span class="px">${i} ${Q(`gear`)}</span></button>`;
      }).join(``)}</div>
<div class="row"><button class="btn" id="r-no">Отмена</button></div>`);
      for (let e of Fo)
        a.querySelector(`[data-s="${e}"]`).replaceWith(fo(he(e, n), 4));
      (a.querySelector(`#r-no`).addEventListener(`click`, () => {
        (Z.click(), this.closeModal());
      }),
        a.querySelectorAll(`[data-t]`).forEach((r) =>
          r.addEventListener(`click`, async () => {
            let i = r.dataset.t;
            this.closeModal();
            let a = Nt(t, n, i, e);
            if (!a.length) {
              Z.error();
              return;
            }
            ((this.undo = []),
              Z.capture(),
              (this.busy = !0),
              await this.play(a),
              (this.busy = !1));
            let o = a[0].t === `recruit` ? tt(t, a[0].id) : void 0;
            (o && this.toast(`Сформирована: ${o.name}`, `good`),
              this.setMode(`none`),
              this.save());
          }),
        ));
    }
    showObjectives() {
      if (!this.inGame) return;
      if (this.G.s.career) {
        this.showOrders();
        return;
      }
      let e = this.G,
        t = e.s.player,
        n = e.s.nations[t],
        r = e.sc.objectives(e.s, e.m),
        i = (e) => Q(e === !0 ? `check` : e === !1 ? `cross` : `dot`);
      this.openModal(
        `<h2>${$(e.sc.name)}</h2><div class="date">${$(e.sc.subtitle)} · ход ${e.s.turn} из ${e.sc.maxTurn} · ${$(e.sc.date(e.s.turn))} · ${Po[e.s.difficulty].toLowerCase()}</div>
<h3>Задачи: ${$(e.nd[t].name)}</h3>
<ul class="objs">${r.map((e) => `<li><span class="mk">${i(e.done)}</span><span>${Ro(e.text)}${e.progress ? ` <b class="px">(${$(e.progress)})</b>` : ``}</span></li>`).join(``)}</ul>
<h3>Потери</h3><p>Наши соединения потеряны: <b>${n.lostUnits}</b> · уничтожено вражеских: <b>${n.killedUnits}</b></p>
<div class="row"><button class="btn gold" id="o-ok">Продолжить</button></div>`,
      )
        .querySelector(`#o-ok`)
        .addEventListener(`click`, () => {
          (Z.click(), this.closeModal());
        });
    }
    endTurnClick() {
      if (!this.playerTurn || this.busy) return;
      let e = this.actionable().length;
      e > 0 && performance.now() - this.endArmed > 2500
        ? ((this.endArmed = performance.now()),
          Z.click(),
          this.toast(
            `Не все войска походили (${e}). Нажмите ещё раз, чтобы завершить ход`,
          ))
        : this.endTurn();
    }
    async endTurn() {
      let e = this.G;
      (Z.click(),
        this.save(),
        this.setMode(`none`, !1),
        this.deselect(),
        (this.playerTurn = !1),
        (this.busy = !0),
        (this.undo = []),
        this.hud());
      let t = this.session;
      if (e.s.career) {
        let t = Fn(e);
        for (let e of t) {
          let t = mn(e.d);
          this.toast(
            `${e.title}${t ? ` · ` + t : ``}`,
            e.kind === `done` || e.kind === `gain`
              ? `good`
              : e.kind === `fail` || e.kind === `loss`
                ? `bad`
                : ``,
          );
        }
        (t.some((e) => e.kind === `done`) && Z.capture(),
          (this.view.zone = Cn(e)),
          this.view.setOverlay({ supply: this.supLayer() }),
          this.hud());
      }
      let n = e.s.owner.slice(),
        r = Xt(e);
      (await this.play(r, n, !0), this.alive(t) && this.loop(t));
    }
    showResult() {
      if (this.euDeep) return this.euDeepResult();
      let e = this.G,
        t = e.s.result,
        n = e.s.player,
        r = e.s.nations[n];
      if (
        ((this.playerTurn = !1),
        (this.busy = !0),
        this.renderAIWait(null),
        localStorage.removeItem(Do),
        !e.s.career?.camp)
      ) {
        let r = `wf_best_${e.s.scen}_${n}`,
          i = Math.max(+(localStorage.getItem(r) || 0), t.win ? t.stars : 0);
        localStorage.setItem(r, String(i));
      }
      if ((t.win ? Z.win() : Z.lose(), this.hud(), e.s.career)) {
        this.showCareerResult();
        return;
      }
      let i = [0, 1, 2]
          .map((e) => Q(t.win && e < t.stars ? `star` : `star_off`, 4))
          .join(``),
        a = this.openModal(
          `<h2 class="${t.win ? `good` : `warn`}">${t.win ? `Победа!` : `Поражение`}</h2><h3>${$(t.title)}</h3>
<div class="stars">${i}</div><p>${$(t.text)}</p>
<p class="date">${$(e.sc.date(e.s.turn))} · ход ${e.s.turn} · ${Po[e.s.difficulty].toLowerCase()} · потеряно соединений: ${r.lostUnits}, уничтожено вражеских: ${r.killedUnits}</p>
<div class="row"><button class="btn" id="e-menu">В меню</button><button class="btn" id="e-map">Карта</button><button class="btn gold" id="e-again">Ещё раз</button></div>`,
          { dismiss: !1 },
        );
      this.resultButtons(a);
    }
    resultButtons(e) {
      let t = this.G,
        n = t.s.result,
        r = t.s.player,
        i = () => {
          (this.showMenu(),
            t.s.career && J_ALL.some((e) => e.id === t.sc.id) && this.showOpsList());
        };
      (e.querySelector(`#e-menu`).addEventListener(`click`, () => {
        (Z.click(), i());
      }),
        e.querySelector(`#e-map`).addEventListener(`click`, () => {
          (Z.click(),
            this.closeModal(),
            this.cardHint(),
            (this.$.card.innerHTML = `<div style="flex:1"><div class="name">${$(n.title)}</div><div class="hint">${t.s.career ? `Операция окончена` : `Кампания окончена`}</div></div><div class="acts"><button class="btn sm gold" id="k-again">Ещё раз</button><button class="btn sm" id="k-menu">В меню</button></div>`),
            this.$.card
              .querySelector(`#k-again`)
              .addEventListener(`click`, () =>
                this.startNew(r, t.s.difficulty, t.sc),
              ),
            this.$.card
              .querySelector(`#k-menu`)
              .addEventListener(`click`, () => this.showMenu()));
        }),
        e.querySelector(`#e-again`).addEventListener(`click`, () => {
          (Z.click(), this.startNew(r, t.s.difficulty, t.sc));
        }));
    }
    repHTML(e) {
      if (!e) return ``;
      let t = en
        .filter((t) => e[t])
        .map(
          (t) =>
            `<span class="rd ${e[t] > 0 ? `up` : `dn`}">${Q(t)}${e[t] > 0 ? `+` : `−`}${Math.abs(e[t])}</span>`,
        );
      return t.length ? `<span class="rds">${t.join(``)}</span>` : ``;
    }
    async careerTurnStart(e) {
      let t = this.G,
        n = t.s.career,
        r = t.sc.career;
      if (n.nbTurn !== t.s.turn) {
        if (
          (await this.runAI(e, (e) => !P(t, e), `Соседние армии`),
          !this.alive(e) || t.s.result)
        )
          return;
        n.nbTurn = t.s.turn;
      }
      if (n.tsTurn === t.s.turn) return;
      let i = n.tsTurn === 0,
        a = t.s.owner.slice(),
        o = Ln(t);
      if (i) {
        let e = hn(t).length,
          i = n.camp?.placed.length
            ? ` С вами гвардейцы прежних операций: ${n.camp.placed.join(`, `)}.`
            : ``,
          a = t.sc.weather
            ? ` Погода: ${w[ct(t)].name.toLowerCase()} (значок рядом с номером хода, прогноз — в окне приказов).`
            : ``,
          o =
            n.perk && n.perk.rank > 0
              ? ` Права по званию (${dn(t)}): ${xa(n.perk.rank).join(`, `)}.${n.camp?.res?.length ? ` Резерв командующего уже здесь: ${n.camp.res.join(`, `)}.` : ``}`
              : ``;
        n.tel.unshift({
          kind: `info`,
          title: `Вы приняли командование: ${r.armyName}`,
          text: `Под вашим началом соединений: ${e}.${i}${o} Соседние армии ведёт компьютер — их фишки блёклые, с тёмным уголком.${r.front ? ` Армиями фронта можно управлять приказами в штабе (нажмите на портрет).` : ``}${a} ${r.standing}`,
        });
      }
      ((this.view.zone = Cn(t)),
        this.updateSupply(),
        this.view.setOverlay({}),
        this.hud(),
        o.length && (await this.play(o, a)),
        this.alive(e) &&
          (n.tel.length && (await this.showTelegrams(n.tel)),
          this.alive(e) && Bt(t)));
    }
    telHTML(e) {
      let t = this.G,
        n = ``;
      if (e.kind === `order` && e.dir) {
        let r = I(t, e.dir),
          i = t.s.career.dirs.find((t) => t.id === e.dir);
        r &&
          i &&
          (n = `<div class="tgd"><b>Задача:</b> ${$(r.goal)}. <b>Срок:</b> до конца хода ${i.deadline} (${$(t.sc.date(i.deadline))}).</div><div class="tgd">Награда ${this.repHTML(r.reward)} · провал ${this.repHTML(r.penalty)}</div>`);
      }
      return `<div class="tg k-${e.kind}"><div class="tt">${Q(e.icon || No[e.kind])}<b>${$(e.title)}</b></div><p>${Ro(e.text)}</p>${n}${this.repHTML(e.d)}</div>`;
    }
    showTelegrams(e) {
      let t = this.G,
        n = t.sc.career;
      return new Promise((r) => {
        Z.tele();
        let i = this.openModal(
          `<div class="tghead">${Q(`tele`, 3)}<div><h2>Телеграммы</h2><div class="date">${$(t.sc.date(t.s.turn))} · ход ${t.s.turn} · ${$(n.armyName)}</div></div></div>
<div class="tgs">${e.map((e) => this.telHTML(e)).join(``)}</div>
<div class="row"><button class="btn gold" id="tg-ok">Принято</button></div>`,
          { dismiss: !1 },
        );
        (i.classList.add(`paperdlg`),
          i.querySelector(`#tg-ok`).addEventListener(`click`, () => {
            (Z.click(), this.closeModal(), r());
          }));
      });
    }
    zoneCenter(e) {
      let t = 0,
        n = 0;
      for (let r of e) {
        let [e, i] = o(this.m.g, r);
        ((t += e), (n += i));
      }
      return e.length ? this.nearestHex(t / e.length, n / e.length) : -1;
    }
    showOrders() {
      let e = this.G,
        t = e.s.career,
        n = e.sc.career,
        r = R(e),
        i = t.dirs.filter((e) => e.status !== `active`),
        a = Vn(t, n),
        o = (t) => {
          let n = I(e, t.id),
            r = xn(e, t),
            i = t.deadline - e.s.turn + 1,
            a = n.zone || n.city;
          return `<div class="dir"><div class="dt">${Q(`order`)}<b>${$(n.title)}</b><span class="dl ${i <= 1 ? `warn` : ``}">${i <= 1 ? `последний ход!` : `осталось ходов: ${i}`}</span></div>
<div class="dg">${$(n.goal)} · до конца хода ${t.deadline} (${$(e.sc.date(t.deadline))})</div>
<div class="dp"><span class="${r.ok ? `good` : `warn`}">Сейчас: ${$(r.text)}</span>${a ? `<button class="btn sm" data-z="${t.id}">На карте</button>` : ``}</div>
<div class="dr">Награда ${this.repHTML(n.reward)} · провал ${this.repHTML(n.penalty)}${n.bonusText ? ` · бонус «${$(n.bonusText)}» ${this.repHTML(n.bonus)}` : ``}</div></div>`;
        },
        s = {
          done: [`check`, `выполнен`],
          failed: [`cross`, `провален`],
          cancelled: [`dot`, `отменён`],
        },
        c = this
          .openModal(`<h2>Приказы Ставки</h2><div class="date">${$(n.armyName)} · ход ${e.s.turn} из ${e.sc.maxTurn} · ${$(e.sc.date(e.s.turn))} · ${Po[e.s.difficulty].toLowerCase()}</div>
${this.weatherHTML()}
${r.length ? r.map(o).join(``) + `<div class="hint2">Район приказа обведён на карте золотой пунктирной рамкой.</div>` : `<p>Новых приказов нет. Действуйте по обстановке и берегите войска.</p>`}
<h3>Постоянный приказ</h3><p>${$(n.standing)}</p>
<h3>Звёзды за операцию</h3><p class="dim">★ — армия уцелела · ★★ — выполнено ${Oo(a.two)} · ★★★ — ${Oo(a.three)} и Слава от ${a.fame}. Сейчас: выполнено ${t.dirs.filter((e) => e.status === `done`).length}, Слава ${t.rep.fame}.</p>
${i.length ? `<h3>Итоги</h3><ul class="objs">${i.map((t) => `<li><span class="mk">${Q(s[t.status][0])}</span><span>${$(I(e, t.id).title)} — ${s[t.status][1]}${t.bonus ? ` (+ бонус)` : ``}</span></li>`).join(``)}</ul>` : ``}
<div class="row"><button class="btn" id="o-tel">Телеграф</button><button class="btn gold" id="o-ok">Продолжить</button></div>`);
      (c.querySelectorAll(`[data-z]`).forEach((t) =>
        t.addEventListener(`click`, () => {
          (Z.click(), this.closeModal());
          let n = I(e, t.dataset.z),
            r = n.city ? _n(e, n.city) : this.zoneCenter(n.zone(e));
          r >= 0 && (this.view.centerOn(r), this.view.ring(r, `#ffd65a`));
        }),
      ),
        c.querySelector(`#o-tel`).addEventListener(`click`, () => {
          (Z.click(), this.showTelegraph());
        }),
        c.querySelector(`#o-ok`).addEventListener(`click`, () => {
          (Z.click(), this.closeModal());
        }));
    }
    weatherHTML() {
      let e = this.G,
        t = e.sc.weather;
      if (!t) return ``;
      let n = e.s.turn,
        r = t(n),
        i = w[r],
        a = re(r),
        o = e.s.career?.perk,
        s = [];
      for (let r = n + 1; r <= Math.min(e.sc.maxTurn, n + 4); r++) {
        let e = w[t(r)];
        s.push(`<span class="fci">${Q(e.icon)}<b>${r}</b></span>`);
      }
      let c = o?.air ? ` Авиагруппа армии: ✈ ${ie(o.air, r)} из ${o.air}.` : ``;
      return `<div class="wx">${Q(i.icon, 3)}<div><b>Погода: ${$(i.name)}</b><small>${$(i.sky)} ${a.length ? `Для обеих сторон: ` + $(a.join(`; `)) + `.` : `Погода не мешает ни вам, ни противнику.`}${Ro(c)}</small>${s.length ? `<small class="fc">Прогноз по ходам: ${s.join(``)}</small>` : ``}</div></div>`;
    }
    showTelegraph() {
      let e = this.G,
        t = e.s.career,
        n = e.sc.career;
      if (!t || !n || !this.inGame) return;
      let r = this.playerTurn && !this.busy,
        i = t.req ? sn(e, t.req.id) : null,
        a = n.requests
          .map((n) => {
            let i = On(e, n),
              a = t.req?.id === n.id,
              o = n.max
                ? ` · осталось ${n.max - (t.reqUsed[n.id] || 0)} из ${n.max}`
                : ``,
              s =
                i || a
                  ? `Шанс <b>${a ? t.req.chance : Dn(e, n)}%</b> · ${n.cost ? `при одобрении Доверие −${n.cost}` : `без затрат`}${o}${n.instant ? ` · ответ сразу` : ``}`
                  : `<span class="dim">${$(n.why ? n.why(e) : `Сейчас недоступно`)}</span>`,
              c = a
                ? `<button class="btn sm" data-x="1">Отозвать</button>`
                : n.instant
                  ? `<button class="btn sm red" data-n="${n.id}" ${!i || !r ? `disabled` : ``}>Срочно</button>`
                  : `<button class="btn sm gold" data-r="${n.id}" ${!i || t.req || !r ? `disabled` : ``}>Отправить</button>`;
            return `<div class="req ${i || a ? `` : `off`} ${a ? `sent` : ``}">${Q(n.icon, 3)}<div class="rq"><b>${$(n.title)}</b><small>${$(n.desc)}</small><span class="ri">${s}</span></div>${c}</div>`;
          })
          .join(``),
        o = this
          .openModal(`<div class="tghead">${Q(`tele`, 3)}<div><h2>Телеграф</h2><div class="date">Запрос: ${$(n.hq)} · один в ход · ответ — в начале следующего хода</div></div></div>
${i ? `<div class="pend">${Q(`clock`)} Отправлено: «${$(i.title)}». Ответ придёт в начале следующего хода (шанс ${t.req.chance}%).</div>` : ``}
<div class="reqs">${a}</div>
<div class="hint2">Шанс растёт с Доверием Ставки (сейчас ${t.rep.trust}) и Славой (${t.rep.fame}).${n.requests.some((e) => e.instant) ? ` Срочные запросы отвечают сразу и не занимают телеграф.` : ``}</div>
<div class="row"><button class="btn gold" id="t-ok">Закрыть</button></div>`);
      (o.querySelectorAll(`[data-r]`).forEach((t) =>
        t.addEventListener(`click`, () => {
          kn(e, t.dataset.r)
            ? (Z.tele(),
              (this.undo = []),
              this.save(),
              this.hud(),
              this.toast(
                `Телеграмма отправлена — ответ в начале следующего хода`,
              ),
              this.showTelegraph())
            : Z.error();
        }),
      ),
        o.querySelector(`[data-x]`)?.addEventListener(`click`, () => {
          (Z.click(),
            An(e),
            (this.undo = []),
            this.save(),
            this.hud(),
            this.showTelegraph());
        }),
        o.querySelectorAll(`[data-n]`).forEach((t) =>
          t.addEventListener(`click`, async () => {
            if (this.busy) return;
            let n = e.s.owner.slice(),
              r = jn(e, t.dataset.n);
            r
              ? (Z.tele(),
                (this.undo = []),
                this.closeModal(),
                (this.busy = !0),
                await this.showTelegrams(r.tel),
                r.ev.length && (await this.play(r.ev, n)),
                (this.busy = !1),
                (this.view.zone = Cn(e)),
                this.updateSupply(),
                this.view.setOverlay({ supply: this.supLayer() }),
                this.save(),
                this.hud(),
                e.s.result && this.showResult())
              : Z.error();
          }),
        ),
        o.querySelector(`#t-ok`).addEventListener(`click`, () => {
          (Z.click(), this.closeModal());
        }));
    }
    showStatus() {
      let e = this.G,
        t = e.s.career,
        n = e.sc.career;
      if (!t || !n) return;
      let r = t.rep,
        i = (e, t) =>
          `<span class="bar wide"><i style="width:${e}%;background:${t}"></i></span>`,
        a = (e, t = ``) =>
          `${e > 0 ? `+` : e < 0 ? `−` : `±`}${Math.abs(e)}${t}`,
        o = n.awards.find((e) => r.fame >= e.fame),
        s = [...n.awards].reverse().find((e) => r.fame < e.fame),
        c = hn(e),
        l = (e, t, n) =>
          `<div class="rrow">${Q(e, 3)}<div><b>${tn[e]}: ${r[e]}</b>${i(r[e], t)}<small>${n}</small></div></div>`,
        u = (n.front || []).filter((e) => n.armies[e]),
        d = (r) => t.post[r] || n.armies[r]?.post || e.nd[e.s.player].posture,
        f = u.length
          ? `<h3>Армии фронта — ваши приказы</h3><div class="hint2">Ими управляет компьютер, но направление задаёте вы. Приказ выполнят со следующего хода.</div>${u
              .map((t) => {
                let r = n.armies[t],
                  i = e.s.units.filter(
                    (n) => n.army === t && n.nat === e.s.player,
                  ).length,
                  a = d(t);
                return `<div class="frow"><div><b>${$(r.name)}</b><small>${$(r.general)} · соединений: ${i}${i ? ` · ${$(Mo.find((e) => e[0] === a)?.[2] || ``)}` : ` · армия разбита`}</small></div><div class="seg">${Mo.map(([e, n]) => `<button class="btn ${a === e ? `on` : ``}" data-pa="${t}" data-pv="${e}" ${i && this.playerTurn ? `` : `disabled`}>${n}</button>`).join(``)}</div></div>`;
              })
              .join(``)}`
          : ``,
        p = t.camp && this.prof ? Y(this.prof, t.camp.op) : null,
        m = this
          .openModal(`<div class="genhead">${wo(3, `pt`, this.gLook())}<div><h2>${$(ln(e))}</h2><div class="date">${$(dn(e))} · ${$(n.role)}</div>${p && p.awards.length ? `<div class="ribs">${this.ribbons(p)}</div>` : ``}</div></div>
<h3>Репутация</h3><div class="reps">
${l(`trust`, r.trust <= 20 ? `#e5574b` : `#d9b44a`, `Запасы +${an(t)} в ход · шанс запросов ${a(Math.round((r.trust - 50) * 0.6), `%`)}. При нуле — отстранение от командования.`)}
${l(`auth`, `#8d9a52`, `Восстановление организации ${a(Math.round((r.auth - 50) / 10))} в ход · атака и оборона ${a(Math.round((r.auth - 50) / 5), `%`)}. Падает от потерь и голода.`)}
${l(`fame`, `#e3c25a`, `${o ? `Заслужено: ${$(o.name)}. ` : ``}${s ? `Следующая награда — от ${s.fame}. ` : ``}Шанс запросов ${a(Math.round(r.fame * 0.15), `%`)}.`)}
</div>
${t.perk && t.perk.rank > 0 ? `<h3>Права по званию: ${$(dn(e))}</h3><p>${Ro(xa(t.perk.rank).join(` · `))}</p>` : ``}
<h3>Запасы армии: ${t.sup} (+${an(t)} в ход)</h3><p>Нужны для пополнения дивизий вашей армии: 1 единица силы = 8 запасов. Кнопка «Пополнить» — в карточке дивизии, если она в этот ход не ходила и снабжается.</p>
<h3>Армия</h3><p>Соединений: <b>${c.length}</b> · побед в атаках: <b>${t.stats.wins}</b> · разгромлено вражеских: <b>${t.stats.kills}</b> · потеряно своих: <b>${t.stats.lost}</b></p>
${f}
${
  t.hist.length
    ? `<h3>Последние изменения</h3><ul class="hist">${t.hist
        .slice(-6)
        .reverse()
        .map(
          (e) =>
            `<li><span class="date">ход ${e.turn}</span> ${$(e.text)} ${this.repHTML(e.d)}</li>`,
        )
        .join(``)}</ul>`
    : ``
}
<div class="row"><button class="btn gold" id="s-ok">Закрыть</button></div>`);
      (m.querySelectorAll(`[data-pa]`).forEach((e) =>
        e.addEventListener(`click`, () => {
          let r = e.dataset.pa,
            i = e.dataset.pv;
          if (!this.playerTurn) return;
          (Z.click(),
            (t.post[r] = i),
            this.save(),
            this.toast(
              `${n.armies[r].name}: ${Mo.find((e) => e[0] === i)[1].toLowerCase()}`,
            ));
          let a = m.scrollTop;
          (this.showStatus(), (this.$.modal.firstElementChild.scrollTop = a));
        }),
      ),
        m.querySelector(`#s-ok`).addEventListener(`click`, () => {
          (Z.click(), this.closeModal());
        }));
    }
    showCareerResult() {
      let e = this.G,
        t = e.s.result,
        n = e.s.career,
        r = e.sc.career,
        i = Bn(e.s, r),
        a = n.camp;
      a &&
        this.prof &&
        !a.done &&
        ((this.outcome = Ba(e, this.prof, a.op)),
        (a.done = !0),
        Oa(localStorage, this.prof));
      let o = a ? this.outcome : null,
        s = {
          done: [`check`, `выполнен`],
          failed: [`cross`, `провален`],
          cancelled: [`dot`, `отменён`],
          active: [`dot`, `не завершён`],
        },
        c = n.dismissed
          ? `Отстранён от командования`
          : i.alive === 0
            ? `Армия разгромлена`
            : `Итоги операции`,
        l =
          !n.dismissed && i.alive > 0
            ? `<h3>${$(t.title)}</h3>${t.text ? `<p>${$(t.text)}</p>` : ``}`
            : `<p>${$(t.text)}</p>`,
        u = [0, 1, 2]
          .map((e) => Q(e < i.stars ? `star` : `star_off`, 4))
          .join(``),
        d = n.dirs
          .map(
            (t) =>
              `<li><span class="mk">${Q(s[t.status][0])}</span><span>${$(I(e, t.id).title)} — ${s[t.status][1]}${t.bonus ? ` (+ бонус)` : ``}</span></li>`,
          )
          .join(``),
        f = en
          .map(
            (e) => `<span class="rv">${Q(e)}${nn[e]} <b>${n.rep[e]}</b></span>`,
          )
          .join(` `),
        p = Vn(n, r),
        m = ``,
        h = ``,
        g = ``;
      if (o && this.prof) {
        let t = this.prof,
          n = [];
        (i.award && n.push(`${Q(`fame`, 3)}<b>${$(i.award)}</b>`),
          o.heroNow && n.push(`${Q(`hero`, 3)}<b>${$(Aa(Y(t).hero))}</b>`),
          o.victoryNow && n.push(`${Q(`star`, 3)}<b>Орден «Победа»</b>`),
          o.rankAfter > o.rankBefore
            ? n.push(
                `${Q(`star`)}<b>Присвоено звание ${$(ga[o.rankAfter])}</b>`,
              )
            : o.best &&
              o.rec.promoted &&
              o.rankBefore < 4 &&
              n.push(
                `<span class="dim">Ставка отметила ваши успехи, но новое звание пока не присвоено</span>`,
              ),
          (m = n.length
            ? n.join(`<br>`)
            : `<span class="dim">Без наград</span>`),
          o.rankAfter > o.rankBefore &&
            o.rankAfter < 4 &&
            (h += `<div class="guards panel perks"><b>${Q(`star`)} Новое звание даёт</b><small>${Ro(xa(o.rankAfter).join(` · `))}</small><small class="dim">Права действуют со следующей операции.</small></div>`),
          o.newGuards.length &&
            (h += `<div class="guards panel"><b>${Q(`guard`)} Гвардейское знамя вручено</b><small>${o.newGuards.map((e) => $(e.name) + (e.name === e.from ? `` : ` (бывшая ${$(e.from)})`)).join(`; `)}</small><small class="dim">Эти дивизии пойдут с вами в следующие операции.</small></div>`),
          o.deadGuards.length &&
            (h += `<div class="guards panel dead"><b>Пали в боях</b><small>${o.deadGuards.map($).join(`; `)}</small></div>`),
          !o.best &&
            i.stars > 0 &&
            o.kept &&
            (h += `<div class="hint2 center">В личном деле остаётся прежний, лучший итог: ${`★`.repeat(o.kept.stars)}${o.kept.award ? ` · ` + $(o.kept.award) : ``}.</div>`),
          i.stars === 0 &&
            (h += `<div class="hint2 center">Операция не засчитана. Ставка даёт вам ещё одну попытку — её можно начать заново.</div>`),
          o.headline &&
            (g = `<div class="paper"><div class="pn">КРАСНАЯ ЗВЕЗДА</div><div class="pd">${$(e.sc.date(e.s.turn))} · Центральный орган Народного комиссариата обороны</div><div class="ph">${$(o.headline)}</div></div>`));
      } else
        m = `${i.award ? `${Q(`fame`, 3)}<b>${$(i.award)}</b>` : `<span class="dim">Без наград</span>`}${i.promoted && r.promotion && !r.promotion.endsWith(r.rank + `а`) ? `<br>${Q(`star`)}<b>${$(r.promotion)}</b>` : ``}`;
      let _ = this.prof ? ka(this.prof) : 0,
        v = o
          ? i.stars === 0
            ? `Повторить`
            : o.final || _ >= J.length
              ? `Эпилог`
              : `Дальше`
          : `Ещё раз`,
        y = this.openModal(
          `<div class="genhead">${wo(3, `pt`, o ? this.campLook(Math.min(_, J.length)) : void 0)}<div><h2 class="${i.stars ? `good` : `warn`}">${c}</h2><div class="date">${$(ln(e))} · ${$(r.armyName)}</div></div></div>
${g}${l}
<div class="stars">${u}</div>
<div class="award">${m}</div>
${h}
<h3>Приказы: выполнено ${i.done} из ${i.total}</h3><ul class="objs">${d || `<li>Приказов не было</li>`}</ul>
<h3>Репутация</h3><p class="reprow">${f}</p>
<p class="date">${$(e.sc.date(e.s.turn))} · ход ${e.s.turn} · ${Po[e.s.difficulty].toLowerCase()} · побед в атаках: ${n.stats.wins} · разгромлено вражеских: ${n.stats.kills} · потеряно своих: ${n.stats.lost}</p>
<details class="histnote"><summary>Как было на самом деле</summary><p>${$(r.history)}</p></details>
<div class="hint2">★ — армия уцелела · ★★ — выполнено ${Oo(p.two)} · ★★★ — ${Oo(p.three)} и Слава от ${p.fame}. ${o ? `Высшая награда — только за ★★★, вторая — от ★★. Звание — за ★★★ или ★★ при Доверии от 45; маршальская звезда — только за ★★★ в Берлине.` : `Повышение — от ★★ при Доверии от 50.`}</div>
<div class="row"><button class="btn" id="e-menu">${o ? `Личное дело` : `В меню`}</button><button class="btn" id="e-map">Карта</button><button class="btn gold" id="e-again">${v}</button></div>`,
          { dismiss: !1 },
        );
      if (!o) {
        this.resultButtons(y);
        return;
      }
      let b = a.op,
        x = () => {
          (Z.click(),
            i.stars === 0
              ? this.startCampOp(b)
              : (this.showMenu(), this.showDossier(), this.showFrontMap({ after: b })));
        };
      (y.querySelector(`#e-menu`).addEventListener(`click`, () => {
        (Z.click(), this.showMenu(), this.showDossier());
      }),
        y.querySelector(`#e-again`).addEventListener(`click`, x),
        y.querySelector(`#e-map`).addEventListener(`click`, () => {
          (Z.click(),
            this.closeModal(),
            (this.$.card.innerHTML = `<div style="flex:1"><div class="name">${$(t.title)}</div><div class="hint">Операция окончена</div></div><div class="acts"><button class="btn sm gold" id="k-again">${v}</button><button class="btn sm" id="k-menu">Личное дело</button></div>`),
            this.$.card.querySelector(`#k-again`).addEventListener(`click`, x),
            this.$.card
              .querySelector(`#k-menu`)
              .addEventListener(`click`, () => {
                (this.showMenu(), this.showDossier());
              }));
        }));
    }
  },
  Ho,
  Uo,
  Wo,
  Go,
  Ko,
  qo,
  Jo,
  Yo,
  Xo,
  Zo,
  Qo,
  $o,
  es,
  ts,
  ns,
  rs,
  is,
  as,
  os,
  ss = t(() => {
    ((function (e) {
      ((e.Unimplemented = `UNIMPLEMENTED`), (e.Unavailable = `UNAVAILABLE`));
    })(Ho || (Ho = {})),
      (Uo = class extends Error {
        constructor(e, t, n) {
          (super(e), (this.message = e), (this.code = t), (this.data = n));
        }
      }),
      (Wo = (e) =>
        e?.androidBridge
          ? `android`
          : e?.webkit?.messageHandlers?.bridge
            ? `ios`
            : `web`),
      (Go = (e) => {
        let t = e.CapacitorCustomPlatform || null,
          n = e.Capacitor || {},
          r = (n.Plugins = n.Plugins || {}),
          i = () => (t === null ? Wo(e) : t.name),
          a = () => i() !== `web`,
          o = (e) => !!(l.get(e)?.platforms.has(i()) || s(e)),
          s = (e) => n.PluginHeaders?.find((t) => t.name === e),
          c = (t) => e.console.error(t),
          l = new Map();
        return (
          n.convertFileSrc || (n.convertFileSrc = (e) => e),
          (n.getPlatform = i),
          (n.handleError = c),
          (n.isNativePlatform = a),
          (n.isPluginAvailable = o),
          (n.registerPlugin = (e, a = {}) => {
            let o = l.get(e);
            if (o)
              return (
                console.warn(
                  `Capacitor plugin "${e}" already registered. Cannot register plugins twice.`,
                ),
                o.proxy
              );
            let c = i(),
              u = s(e),
              d,
              f = async () => (
                !d && c in a
                  ? (d = d = typeof a[c] == `function` ? await a[c]() : a[c])
                  : t !== null &&
                    !d &&
                    `web` in a &&
                    (d = d =
                      typeof a.web == `function` ? await a.web() : a.web),
                d
              ),
              p = (t, r) => {
                if (u) {
                  let i = u?.methods.find((e) => r === e.name);
                  if (i)
                    return i.rtype === `promise`
                      ? (t) => n.nativePromise(e, r.toString(), t)
                      : (t, i) => n.nativeCallback(e, r.toString(), t, i);
                  if (t) return t[r]?.bind(t);
                } else if (t) return t[r]?.bind(t);
                else
                  throw new Uo(
                    `"${e}" plugin is not implemented on ${c}`,
                    Ho.Unimplemented,
                  );
              },
              m = (t) => {
                let n,
                  r = (...r) => {
                    let i = f().then((i) => {
                      let a = p(i, t);
                      if (a) {
                        let e = a(...r);
                        return ((n = e?.remove), e);
                      }
                      throw new Uo(
                        `"${e}.${t}()" is not implemented on ${c}`,
                        Ho.Unimplemented,
                      );
                    });
                    return (
                      t === `addListener` && (i.remove = async () => n()),
                      i
                    );
                  };
                return (
                  (r.toString = () => `${t.toString()}() { [capacitor code] }`),
                  Object.defineProperty(r, "name", {
                    value: t,
                    writable: !1,
                    configurable: !1,
                  }),
                  r
                );
              },
              h = m(`addListener`),
              g = m(`removeListener`),
              _ = (e, t) => {
                let n = h({ eventName: e }, t),
                  r = async () => {
                    let r = await n;
                    g({ eventName: e, callbackId: r }, t);
                  },
                  i = new Promise((e) => n.then(() => e({ remove: r })));
                return (
                  (i.remove = async () => {
                    (console.warn(
                      `Using addListener() without 'await' is deprecated.`,
                    ),
                      await r());
                  }),
                  i
                );
              },
              v = new Proxy(
                {},
                {
                  get(e, t) {
                    switch (t) {
                      case `$$typeof`:
                        return;
                      case `toJSON`:
                        return () => ({});
                      case `addListener`:
                        return u ? _ : h;
                      case `removeListener`:
                        return g;
                      default:
                        return m(t);
                    }
                  },
                },
              );
            return (
              (r[e] = v),
              l.set(e, {
                name: e,
                proxy: v,
                platforms: new Set([...Object.keys(a), ...(u ? [c] : [])]),
              }),
              v
            );
          }),
          (n.Exception = Uo),
          (n.DEBUG = !!n.DEBUG),
          (n.isLoggingEnabled = !!n.isLoggingEnabled),
          n
        );
      }),
      (Ko = (e) => (e.Capacitor = Go(e))),
      (qo = Ko(
        typeof globalThis < `u`
          ? globalThis
          : typeof self < `u`
            ? self
            : typeof window < `u`
              ? window
              : typeof global < `u`
                ? global
                : {},
      )),
      (Jo = qo.registerPlugin),
      (Yo = class {
        constructor() {
          ((this.listeners = {}),
            (this.retainedEventArguments = {}),
            (this.windowListeners = {}));
        }
        addListener(e, t) {
          let n = !1;
          (this.listeners[e] || ((this.listeners[e] = []), (n = !0)),
            this.listeners[e].push(t));
          let r = this.windowListeners[e];
          return (
            r && !r.registered && this.addWindowListener(r),
            n && this.sendRetainedArgumentsForEvent(e),
            Promise.resolve({ remove: async () => this.removeListener(e, t) })
          );
        }
        async removeAllListeners() {
          this.listeners = {};
          for (let e in this.windowListeners)
            this.removeWindowListener(this.windowListeners[e]);
          this.windowListeners = {};
        }
        notifyListeners(e, t, n) {
          let r = this.listeners[e];
          if (r) r.forEach((e) => e(t));
          else if (n) {
            let n = this.retainedEventArguments[e];
            (n || (n = []), n.push(t), (this.retainedEventArguments[e] = n));
          }
        }
        hasListeners(e) {
          return !!this.listeners[e]?.length;
        }
        registerWindowListener(e, t) {
          this.windowListeners[t] = {
            registered: !1,
            windowEventName: e,
            pluginEventName: t,
            handler: (e) => {
              this.notifyListeners(t, e);
            },
          };
        }
        unimplemented(e = `not implemented`) {
          return new qo.Exception(e, Ho.Unimplemented);
        }
        unavailable(e = `not available`) {
          return new qo.Exception(e, Ho.Unavailable);
        }
        async removeListener(e, t) {
          let n = this.listeners[e];
          if (!n) return;
          let r = n.indexOf(t);
          (r !== -1 && this.listeners[e].splice(r, 1),
            this.listeners[e].length ||
              this.removeWindowListener(this.windowListeners[e]));
        }
        addWindowListener(e) {
          (window.addEventListener(e.windowEventName, e.handler),
            (e.registered = !0));
        }
        removeWindowListener(e) {
          e &&
            (window.removeEventListener(e.windowEventName, e.handler),
            (e.registered = !1));
        }
        sendRetainedArgumentsForEvent(e) {
          let t = this.retainedEventArguments[e];
          t &&
            (delete this.retainedEventArguments[e],
            t.forEach((t) => {
              this.notifyListeners(e, t);
            }));
        }
      }),
      (Xo = (e) =>
        encodeURIComponent(e)
          .replace(/%(2[346B]|5E|60|7C)/g, decodeURIComponent)
          .replace(/[()]/g, escape)),
      (Zo = (e) => e.replace(/(%[\dA-F]{2})+/gi, decodeURIComponent)),
      (Qo = class extends Yo {
        async getCookies() {
          let e = document.cookie,
            t = {};
          return (
            e.split(`;`).forEach((e) => {
              if (e.length <= 0) return;
              let [n, r] = e.replace(/=/, `CAP_COOKIE`).split(`CAP_COOKIE`);
              ((n = Zo(n).trim()), (r = Zo(r).trim()), (t[n] = r));
            }),
            t
          );
        }
        async setCookie(e) {
          try {
            let t = Xo(e.key),
              n = Xo(e.value),
              r = e.expires
                ? `; expires=${e.expires.replace(`expires=`, ``)}`
                : ``,
              i = (e.path || `/`).replace(`path=`, ``),
              a = e.url != null && e.url.length > 0 ? `domain=${e.url}` : ``;
            document.cookie = `${t}=${n || ``}${r}; path=${i}; ${a};`;
          } catch (e) {
            return Promise.reject(e);
          }
        }
        async deleteCookie(e) {
          try {
            document.cookie = `${e.key}=; Max-Age=0`;
          } catch (e) {
            return Promise.reject(e);
          }
        }
        async clearCookies() {
          try {
            let e = document.cookie.split(`;`) || [];
            for (let t of e)
              document.cookie = t
                .replace(/^ +/, ``)
                .replace(/=.*/, `=;expires=${new Date().toUTCString()};path=/`);
          } catch (e) {
            return Promise.reject(e);
          }
        }
        async clearAllCookies() {
          try {
            await this.clearCookies();
          } catch (e) {
            return Promise.reject(e);
          }
        }
      }),
      Jo(`CapacitorCookies`, { web: () => new Qo() }),
      ($o = async (e) =>
        new Promise((t, n) => {
          let r = new FileReader();
          ((r.onload = () => {
            let e = r.result;
            t(e.indexOf(`,`) >= 0 ? e.split(`,`)[1] : e);
          }),
            (r.onerror = (e) => n(e)),
            r.readAsDataURL(e));
        })),
      (es = (e = {}) => {
        let t = Object.keys(e);
        return Object.keys(e)
          .map((e) => e.toLocaleLowerCase())
          .reduce((n, r, i) => ((n[r] = e[t[i]]), n), {});
      }),
      (ts = (e, t = !0) =>
        e
          ? Object.entries(e)
              .reduce((e, n) => {
                let [r, i] = n,
                  a,
                  o;
                return (
                  Array.isArray(i)
                    ? ((o = ``),
                      i.forEach((e) => {
                        ((a = t ? encodeURIComponent(e) : e),
                          (o += `${r}=${a}&`));
                      }),
                      o.slice(0, -1))
                    : ((a = t ? encodeURIComponent(i) : i), (o = `${r}=${a}`)),
                  `${e}&${o}`
                );
              }, ``)
              .substr(1)
          : null),
      (ns = (e, t = {}) => {
        let n = Object.assign(
            { method: e.method || `GET`, headers: e.headers },
            t,
          ),
          r = es(e.headers)[`content-type`] || ``;
        if (typeof e.data == `string`) n.body = e.data;
        else if (r.includes(`application/x-www-form-urlencoded`)) {
          let t = new URLSearchParams();
          for (let [n, r] of Object.entries(e.data || {})) t.set(n, r);
          n.body = t.toString();
        } else if (
          r.includes(`multipart/form-data`) ||
          e.data instanceof FormData
        ) {
          let t = new FormData();
          if (e.data instanceof FormData)
            e.data.forEach((e, n) => {
              t.append(n, e);
            });
          else for (let n of Object.keys(e.data)) t.append(n, e.data[n]);
          n.body = t;
          let r = new Headers(n.headers);
          (r.delete(`content-type`), (n.headers = r));
        } else
          (r.includes(`application/json`) || typeof e.data == `object`) &&
            (n.body = JSON.stringify(e.data));
        return n;
      }),
      (rs = class extends Yo {
        async request(e) {
          let t = ns(e, e.webFetchExtra),
            n = ts(e.params, e.shouldEncodeUrlParams),
            r = n ? `${e.url}?${n}` : e.url,
            i = await fetch(r, t),
            a = i.headers.get(`content-type`) || ``,
            { responseType: o = `text` } = i.ok ? e : {};
          a.includes(`application/json`) && (o = `json`);
          let s, c;
          switch (o) {
            case `arraybuffer`:
            case `blob`:
              ((c = await i.blob()), (s = await $o(c)));
              break;
            case `json`:
              s = await i.json();
              break;
            default:
              s = await i.text();
          }
          let l = {};
          return (
            i.headers.forEach((e, t) => {
              l[t] = e;
            }),
            { data: s, headers: l, status: i.status, url: i.url }
          );
        }
        async get(e) {
          return this.request(
            Object.assign(Object.assign({}, e), { method: `GET` }),
          );
        }
        async post(e) {
          return this.request(
            Object.assign(Object.assign({}, e), { method: `POST` }),
          );
        }
        async put(e) {
          return this.request(
            Object.assign(Object.assign({}, e), { method: `PUT` }),
          );
        }
        async patch(e) {
          return this.request(
            Object.assign(Object.assign({}, e), { method: `PATCH` }),
          );
        }
        async delete(e) {
          return this.request(
            Object.assign(Object.assign({}, e), { method: `DELETE` }),
          );
        }
      }),
      Jo(`CapacitorHttp`, { web: () => new rs() }),
      (function (e) {
        ((e.Dark = `DARK`), (e.Light = `LIGHT`), (e.Default = `DEFAULT`));
      })(is || (is = {})),
      (function (e) {
        ((e.StatusBar = `StatusBar`), (e.NavigationBar = `NavigationBar`));
      })(as || (as = {})),
      (os = class extends Yo {
        async setStyle() {
          this.unavailable(`not available for web`);
        }
        async setAnimation() {
          this.unavailable(`not available for web`);
        }
        async show() {
          this.unavailable(`not available for web`);
        }
        async hide() {
          this.unavailable(`not available for web`);
        }
      }),
      Jo(`SystemBars`, { web: () => new os() }));
  });
// ---- dev: быстрая безграфическая симуляция (tools/sim.cjs) ----
function __simRun(id, o = {}) {
  let sc = ma[id];
  if (!sc) throw Error(`no scen ` + id);
  let map = v(sc.map && Ao[sc.map] ? Ao[sc.map] : r),
    G = Vt(map, sc, o.side || `SOV`, o.diff ?? 1, o.seed ?? 12345),
    prof = null,
    idx = -1;
  if (o.career && sc.career) {
    prof = Ea(`Иван Соколов`, o.diff ?? 1);
    let si = STAGES.findIndex((e) => e.includes(id));
    si >= 0 && ((prof.route[si] = id), syncRoute(prof));
    idx = Ta(id);
    for (let i = 0; i < idx; i++)
      prof.ops[i] = { stars: o.prevStars ?? 2, promoted: !!o.promote, rep: { trust: 55, auth: 55, fame: 40 }, kills: 0, lost: 0, add: [], dead: [], xp: {}, done: 3, total: 5 };
    Ra(G, prof, idx);
  }
  let pol = o.policy || `ai`,
    baseBias = sc.aiBias;
  pol === `smart` &&
    (sc.aiBias = (G2, u, t, hx) => {
      let b = baseBias ? baseBias(G2, u, t, hx) : 0;
      if (G2.s.career && P(G2, u))
        for (let d of R(G2)) {
          let D = I(G2, d.id);
          if (D.kind !== `take` || !D.city) continue;
          let h = map.cities.find((c) => c.name === D.city)?.hex;
          h === t.hex ? (b += 8) : h != null && f(G2.m.g, h, t.hex) <= 1 && (b += 3);
        }
      return b;
    });
  let trace = [],
    g = 0,
    city = (n) => {
      let h = map.cities.find((e) => e.name === n)?.hex;
      return h == null ? `?` : N(G, h);
    };
  for (; !G.s.result && g++ < 600; ) {
    for (; G.s.pending.length; ) {
      let n = G.s.pending[0];
      if (n.nat !== G.s.player) {
        G.s.pending.shift();
        continue;
      }
      (Gt(G, n.id, o.opt ?? 0), G.s.pending[0] === n && G.s.pending.shift());
    }
    if (G.s.result) break;
    if (ut(G) === G.s.player) {
      let c = G.s.career;
      if (c) {
        if (c.nbTurn !== G.s.turn) {
          for (let _ of Qa(G, { filter: (u) => !P(G, u) })) if (G.s.result) break;
          if (((c.nbTurn = G.s.turn), G.s.result)) break;
        }
        c.tsTurn !== G.s.turn && (Ln(G), Bt(G));
        if (G.s.result) break;
        o.onTurn?.(G, { kn, sn, On });
      }
      if (pol !== `pass`) {
        let c2 = G.s.career;
        if (c2 && (pol === `def` || pol === `off` || pol === `smart`)) for (let a of c2.cmd) c2.post[a] = pol === `smart` ? `off` : pol;
        for (let _ of Qa(G, { filter: (u) => P(G, u), spend: !1, air: !1 }))
          if (G.s.result) break;
      }
      if (G.s.result) break;
      (globalThis.__probe && trace.push(G.s.turn + `: ` + globalThis.__probe(G, { N, f, _n, P, F, Za })),
        o.cities && trace.push(G.s.turn + `:` + o.cities.map((n) => n.slice(0, 4) + `=` + city(n)).join(`,`)),
        c && Fn(G),
        Xt(G));
    } else {
      for (let _ of Qa(G)) if (G.s.result) break;
      if (G.s.result) break;
      Xt(G);
    }
  }
  sc.aiBias = baseBias;
  let res = G.s.result || {},
    out = { id, turn: G.s.turn, win: res.win, stars: res.stars, title: res.title, trace };
  if (G.s.career) {
    let b = Bn(G.s, sc.career),
      c = G.s.career;
    ((out.done = b.done), (out.total = b.total), (out.cstars = b.stars), (out.rep = { ...c.rep }),
      (out.dirs = c.dirs.map((d) => d.id + `:` + d.status[0])),
      (out.kills = c.stats.kills), (out.lost = c.stats.lost), (out.alive = b.alive));
  }
  return out;
}
ss();
var cs = `modulepreload`,
  ls = function (e, t) {
    return new URL(e, t).href;
  },
  us = {},
  ds = function (e) {
    return e.pathname.endsWith(`.css`);
  },
  fs = function (e, t, n) {
    if (t in e) return e[t];
    let r = n();
    if (!r) {
      e[t] = void 0;
      return;
    }
    let i = r.then(
      () => {
        e[t] = void 0;
      },
      (n) => {
        throw ((e[t] = void 0), n);
      },
    );
    return ((e[t] = i), i);
  },
  ps = function (e, t, n) {
    let r = Promise.resolve();
    if (t && t.length > 0) {
      let e,
        i = document.querySelector(`meta[property=csp-nonce]`),
        a = i?.nonce || i?.getAttribute(`nonce`);
      function o(e) {
        return Promise.all(
          e.map((e) =>
            Promise.resolve(e).then(
              (e) => ({ status: `fulfilled`, value: e }),
              (e) => ({ status: `rejected`, reason: e }),
            ),
          ),
        );
      }
      function s(e) {
        return import.meta.resolve
          ? new URL(import.meta.resolve(e))
          : new URL(e, import.meta.url);
      }
      r = o(
        t
          .map((t) => {
            t = ls(t, n);
            let r = s(t),
              i = ds(r);
            return fs(us, r.href, () => {
              if (e === void 0) {
                e = { all: new Set(), styles: new Set() };
                let t = document.getElementsByTagName(`link`);
                for (let n = t.length - 1; n >= 0; n--) {
                  let r = t[n];
                  (e.all.add(r.href),
                    r.rel === `stylesheet` && e.styles.add(r.href));
                }
              }
              if ((i ? e.styles : e.all).has(r.href)) return;
              let t = document.createElement(`link`);
              if (
                ((t.rel = i ? `stylesheet` : cs),
                i || (t.as = `script`),
                (t.crossOrigin = ``),
                (t.href = r.href),
                a && t.setAttribute(`nonce`, a),
                document.head.appendChild(t),
                i)
              )
                return new Promise((e, n) => {
                  (t.addEventListener(`load`, e),
                    t.addEventListener(`error`, () =>
                      n(Error(`Unable to preload CSS for ${r}`)),
                    ));
                });
            });
          })
          .filter((e) => e !== void 0),
      );
    }
    function i(e) {
      let t = new Event(`vite:preloadError`, { cancelable: !0 });
      if (((t.payload = e), window.dispatchEvent(t), !t.defaultPrevented))
        throw e;
    }
    return r.then((t) => {
      for (let e of t || []) e.status === `rejected` && i(e.reason);
      return e().catch(i);
    });
  },
  ms = n({ AppWeb: () => hs }),
  hs,
  gs = t(() => {
    hs = class extends Yo {
      constructor() {
        (super(),
          (this.handleVisibilityChange = () => {
            let e = { isActive: document.hidden !== !0 };
            (this.notifyListeners(`appStateChange`, e),
              document.hidden
                ? this.notifyListeners(`pause`, null)
                : this.notifyListeners(`resume`, null));
          }),
          document.addEventListener(
            `visibilitychange`,
            this.handleVisibilityChange,
            !1,
          ));
      }
      exitApp() {
        throw this.unimplemented(`Not implemented on web.`);
      }
      async getInfo() {
        throw this.unimplemented(`Not implemented on web.`);
      }
      async getLaunchUrl() {
        return { url: `` };
      }
      async getState() {
        return { isActive: document.hidden !== !0 };
      }
      async minimizeApp() {
        throw this.unimplemented(`Not implemented on web.`);
      }
      async toggleBackButtonHandler() {
        throw this.unimplemented(`Not implemented on web.`);
      }
      async getAppLanguage() {
        return { value: navigator.language.split(`-`)[0].toLowerCase() };
      }
    };
  });
ss();
var _s = Jo(`App`, {
  web: () =>
    ps(
      () =>
        Promise.resolve()
          .then(() => (gs(), ms))
          .then((e) => new e.AppWeb()),
      void 0,
      import.meta.url,
    ),
});
ss();
var vs = v(r),
  ys = new Vo(
    document.getElementById(`map`),
    document.getElementById(`ui`),
    vs,
  );
((window.__app = ys),
  (window.__sim = __simRun),
  (window.__hexCenter = o),
  (window.__aiCmd = (e) => {
    for (let t of Qa(e, { filter: (t) => P(e, t), spend: !1, air: !1 }));
  }),
  document.fonts?.load(`500 16px Rubik`).finally(() => (ys.view.dirty = !0)),
  qo.isNativePlatform() &&
    (_s.addListener(`backButton`, () => {
      ys.onBack() || _s.exitApp();
    }),
    _s.addListener(`pause`, () => ys.save())));
