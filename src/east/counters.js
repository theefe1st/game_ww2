// «Мировой фронт» v0.11, «Восточный фронт»: фишки дивизий в стиле штабной карты (как в Hearts of Iron):
// РККА — квадраты (стрелковые бежевые, танковые и механизированные — терракотовые, гвардия — с крупной «Г»),
// Ось — круги (пехота серо-голубая, танковые — тёмные, союзники — своими цветами); сверху «XX», в центре номер.
// Спрайты кэшируются по виду, номеру и размеру; counterURL — картинка для списков интерфейса.
import { NATC } from './rules.js';

// номер на фишке: первое число в названии, иначе первые буквы имени («СС «Райх»» → «Р»)
export function divLabel(u) {
  const n = u.n || '';
  const d = n.match(/\d+/);
  if (d) return d[0];
  const q = n.match(/«([^»]+)»/);
  const w = (q ? q[1] : n).split(/[\s-]+/).filter(Boolean);
  return (w.length > 1 ? w[0][0] + w[1][0] : (w[0] || '•').slice(0, 2)).toUpperCase();
}
export const isGuard = (u) => !!u.gd || /^Гв|гв\./.test(u.n || '');
export const isSS = (u) => /СС/.test(u.n || '');
const SQ = { SOV: 1 }; // квадраты — Красная армия; остальные — круги
// цвета: фон, кайма, номер, «XX»
const ST = {
  SOV: { inf: ['#ece4c4', '#a2967a', '#34342a', '#b2573e'], sec: ['#d8d6ca', '#8c8a7c', '#34342a', '#7a6a5a'], mot: ['#e6b590', '#9a6040', '#45190a', '#8a3518'], arm: ['#d68662', '#8e4a30', '#43120a', '#702410'] },
  GER: { inf: ['#93a3b1', '#5c6c7a', '#1f2c36', '#3c4c5a'], sec: ['#b8bec2', '#6c7478', '#2a3238', '#4c565c'], mot: ['#6d8296', '#3c4c5c', '#f2f4f6', '#d8dee4'], arm: ['#3e454c', '#1c2024', '#f4f4f4', '#c4cad0'] },
  FIN: { inf: ['#e8eef5', '#7a94b0', '#1f3f66', '#4a6a90'] },
  ROM: { inf: ['#d6c070', '#8a7630', '#33280a', '#6a5418'] },
  HUN: { inf: ['#9cb886', '#5a7a46', '#1c2e10', '#3c5a2a'] },
  ITA: { inf: ['#aab78e', '#66734a', '#232c16', '#4a5634'] },
  SVK: { inf: ['#9db0d2', '#566c98', '#16243e', '#3a5078'] },
  CRO: { inf: ['#b4a4d2', '#6c5c96', '#221a3c', '#4a3c70'] },
  BUL: { inf: ['#bcaa86', '#7a6a48', '#2c2412', '#5a4a2c'] },
};
export function styleOf(nat, t) {
  const N = ST[nat] || ST.GER, k = t === 'arm' ? 'arm' : t === 'mot' ? 'mot' : t === 'sec' ? 'sec' : 'inf';
  if (N[k]) return N[k];
  // союзники Оси: подвижные — темнее
  const b = N.inf;
  if (k === 'arm' || k === 'mot') return [shade(b[0], k === 'arm' ? -0.38 : -0.22), shade(b[1], -0.3), '#f4f2ea', shade(b[0], 0.4)];
  return b;
}
export function shade(hex, k) {
  const n = parseInt(hex.slice(1), 16), f = (v) => Math.round(k < 0 ? v * (1 + k) : v + (255 - v) * k);
  return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
}
// фишка размера s (CSS px) в точке (0, 0) — (s, s)
export function drawDiv(c, nat, t, lab, s, o = {}) {
  const [bg, bd, fg, xx] = styleOf(nat, t), sq = !!SQ[nat], m = s / 2;
  c.save();
  c.lineWidth = Math.max(1, s / 22);
  c.fillStyle = bg; c.strokeStyle = bd;
  c.globalAlpha = o.alpha ?? 0.94;
  c.beginPath();
  if (sq) c.rect(0.5, 0.5, s - 1, s - 1); else c.arc(m, m, m - 0.6, 0, Math.PI * 2);
  c.fill();
  c.globalAlpha = 1;
  if (t === 'sec') c.setLineDash([s / 9, s / 12]);
  c.stroke(); c.setLineDash([]);
  // гвардия / СС — крупная бледная буква под номером
  if (o.wm) {
    c.fillStyle = sq ? 'rgba(130,104,64,0.3)' : 'rgba(20,24,28,0.22)';
    c.font = `700 ${s * (o.wm.length > 1 ? 0.62 : 0.98)}px Georgia, "Noto Serif", serif`;
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(o.wm, m, m + s * 0.06);
  }
  // род войск — мелкий знак: горные ▲, кавалерия — косая черта
  c.fillStyle = xx; c.strokeStyle = xx;
  if (t === 'mtn') { c.beginPath(); c.moveTo(s * 0.12, s * 0.88); c.lineTo(s * 0.24, s * 0.68); c.lineTo(s * 0.36, s * 0.88); c.closePath(); c.globalAlpha = 0.7; c.fill(); c.globalAlpha = 1; }
  if (t === 'cav') { c.globalAlpha = 0.45; c.lineWidth = Math.max(1, s / 16); c.beginPath(); c.moveTo(s * 0.14, s * 0.86); c.lineTo(s * 0.86, s * 0.14); c.stroke(); c.globalAlpha = 1; }
  // «XX» — дивизия
  c.textAlign = 'center'; c.textBaseline = 'middle';
  c.font = `700 ${Math.max(5, s * 0.19)}px Rubik, system-ui, sans-serif`;
  c.fillStyle = xx;
  c.fillText(o.xx ?? 'XX', m, s * (sq ? 0.15 : 0.19));
  // номер
  if (lab) {
    const L = String(lab), fs = s * (L.length >= 3 ? 0.4 : L.length === 2 ? 0.5 : 0.56);
    c.font = `500 ${fs}px Rubik, system-ui, sans-serif`;
    c.fillStyle = fg;
    c.fillText(L, m, s * 0.58);
  }
  c.restore();
}
// кэш спрайтов
const SPR = new Map();
export function divSprite(nat, t, lab, wm, s, dpr) {
  const key = `${nat}|${t}|${lab}|${wm || ''}|${s}|${dpr}`;
  let sp = SPR.get(key);
  if (sp) return sp;
  if (SPR.size > 2600) SPR.clear();
  sp = document.createElement('canvas');
  sp.width = sp.height = Math.ceil(s * dpr) + 1;
  const c = sp.getContext('2d');
  c.scale(dpr, dpr);
  drawDiv(c, nat, t, lab, s, { wm });
  SPR.set(key, sp);
  return sp;
}
export const wmOf = (u) => (u.s === 'SOV' ? (isGuard(u) ? 'Г' : '') : isSS(u) ? 'SS' : '');
// картинка фишки для интерфейса (data URL)
const CURL = new Map();
export function counterURL(nat, t, lab = '', wm = '') {
  const key = `${nat}|${t}|${lab}|${wm}`;
  if (CURL.has(key)) return CURL.get(key);
  const c = document.createElement('canvas'), s = 30, k = 3;
  c.width = c.height = s * k;
  const x = c.getContext('2d'); x.scale(k, k);
  drawDiv(x, nat, t, lab || TYPE_SIGN[t] || '', s, { wm, xx: 'XX' });
  const u = c.toDataURL();
  CURL.set(key, u);
  return u;
}
const TYPE_SIGN = { inf: 'С', mtn: 'Г', cav: 'К', mot: 'М', arm: 'Т', sec: 'О', abn: 'Д' };
export { NATC };
