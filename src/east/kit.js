// «Мировой фронт» v0.11, «Восточный фронт»: общие мелочи интерфейса (экранирование, значки, числа, флаги, портреты)
import { icon } from './icons.js';
import { plural, turnsW, TD } from './rules.js';
export { turnsW };
import { ALLG, POR_NAT } from '../war/gens41.js';
import { portraitURLP, portraitCanvasP } from '../staff/portraits.js';
export const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
export const ic = (k, cls = '') => icon(k, cls);
export const num = (x) => Math.round(x).toLocaleString('ru-RU');
export const weeksW = (n) => `${n} ${plural(n, 'неделя', 'недели', 'недель')}`;
// срок «до …» в ходах (v0.11.1: ход — 5 дней): дни → месяцы → годы
export const untilT = (t) => {
  const d = Math.max(0, t) * TD;
  if (d < 60) return `${d} ${plural(d, 'день', 'дня', 'дней')}`;
  const m = Math.round(d / 30.44);
  if (m < 12) return `${m} мес.`;
  const y = Math.floor(m / 12), mm = m % 12;
  return `${y} ${plural(y, 'год', 'года', 'лет')}${mm ? ` ${mm} мес.` : ''}`;
};
export const untilW = (w) => {
  if (w < 9) return weeksW(Math.max(0, w));
  const m = Math.round((w * 7) / 30.44);
  if (m < 12) return `${m} мес.`;
  const y = Math.floor(m / 12), mm = m % 12;
  return `${y} ${plural(y, 'год', 'года', 'лет')}${mm ? ` ${mm} мес.` : ''}`;
};
export function flagHTML(nat, cls = '') {
  const st = {
    SOV: 'background:#c4261d', GER: 'background:#6d7780', FIN: 'background:linear-gradient(90deg,transparent 30%,#1c4f9c 30% 44%,transparent 44%),linear-gradient(0deg,#fff 40%,#1c4f9c 40% 60%,#fff 60%)',
    ROM: 'background:linear-gradient(90deg,#1c3f94 0 33%,#f5cc1e 33% 67%,#c81e2a 67%)', HUN: 'background:linear-gradient(#c8202a 0 33%,#fff 33% 67%,#3c7a3a 67%)',
    SVK: 'background:linear-gradient(#fff 0 33%,#1c4f9c 33% 67%,#c8202a 67%)', CRO: 'background:linear-gradient(#c8202a 0 33%,#fff 33% 67%,#1c3f94 67%)',
    ITA: 'background:linear-gradient(90deg,#2a8a3a 0 33%,#fff 33% 67%,#c8202a 67%)', BUL: 'background:linear-gradient(#fff 0 33%,#2a8a3a 33% 67%,#c8202a 67%)',
    // страны 1936–1941 гг. (ранние старты)
    POL: 'background:linear-gradient(#fff 0 50%,#d4213d 50%)', LIT: 'background:linear-gradient(#f5c21b 0 33%,#2a7a3a 33% 67%,#c1272d 67%)',
    LAT: 'background:linear-gradient(#9e3039 0 40%,#fff 40% 60%,#9e3039 60%)', EST: 'background:linear-gradient(#3a75c4 0 33%,#141414 33% 67%,#fff 67%)',
    CZE: 'background:conic-gradient(transparent 0 236deg,#11457e 236deg 304deg,transparent 304deg),linear-gradient(#fff 0 50%,#d7141a 50%)',
    AUT: 'background:linear-gradient(#c8202a 0 33%,#fff 33% 67%,#c8202a 67%)', YUG: 'background:linear-gradient(#1c3f94 0 33%,#fff 33% 67%,#c8202a 67%)',
    NOR: 'background:linear-gradient(90deg,transparent 28%,#fff 28% 32%,#1c3f94 32% 40%,#fff 40% 44%,transparent 44%),linear-gradient(transparent 38%,#fff 38% 42%,#1c3f94 42% 58%,#fff 58% 62%,transparent 62%),#c8202a',
    GRE: 'background:repeating-linear-gradient(#2a5fb0 0 11.1%,#fff 11.1% 22.2%)', SWE: 'background:linear-gradient(90deg,transparent 30%,#f5c21b 30% 42%,transparent 42%),linear-gradient(transparent 42%,#f5c21b 42% 58%,transparent 58%),#1c5ba0',
    TUR: 'background:#d01f2a', IRN: 'background:linear-gradient(#2a8a3a 0 33%,#fff 33% 67%,#d01f2a 67%)',
  }[nat] || 'background:#999';
  const inner = nat === 'SOV' ? `<i class="fs">${ic('star')}</i>` : nat === 'GER' ? '<svg class="fx" viewBox="0 0 30 20"><path d="M11.6 2.4h6.8v5h5v5.2h-5v5h-6.8v-5h-5V7.4h5z" fill="#fff"/><path d="M13 3.8h4v5h5v2.4h-5v5h-4v-5H8V8.8h5z" fill="#141414"/></svg>' : nat === 'FIN' ? '' : '';
  return `<span class="e-flag ${cls}" style="${st}">${inner}</span>`;
}
export const genURL = (k) => { const G = ALLG[k]; return G ? portraitURLP('w:' + k, G.por, POR_NAT[G.nat] || 'GER', 3) : ''; };
// портрет на холсте 40 × 48 (для карты: без кодирования в PNG — первый toDataURL бывает долгим)
export const genCanvas = (k) => { const G = ALLG[k]; return G ? portraitCanvasP('w:' + k, G.por, POR_NAT[G.nat] || 'GER') : null; };
export const strCol = (s) => (s >= 70 ? '#6fb44e' : s >= 40 ? '#d9b23a' : '#d0583a');
export const POST = { auto: { n: 'Авто', ic: 'auto', d: 'генерал решает сам' }, def: { n: 'Оборона', ic: 'def', d: 'держать фронт, контратаки' }, atk: { n: 'Наступление', ic: 'atk', d: 'удары к цели' }, ret: { n: 'Отход', ic: 'ret', d: 'отступить, сберечь войска' } };
