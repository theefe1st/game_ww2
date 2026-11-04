// «Мировой фронт» v0.11, «Восточный фронт»: общие мелочи интерфейса (экранирование, значки, числа, флаги, портреты)
import { icon } from './icons.js';
import { plural } from './rules.js';
import { ALLG, POR_NAT } from '../war/gens41.js';
import { portraitURLP } from '../staff/portraits.js';
export const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
export const ic = (k, cls = '') => icon(k, cls);
export const num = (x) => Math.round(x).toLocaleString('ru-RU');
export const weeksW = (n) => `${n} ${plural(n, 'неделя', 'недели', 'недель')}`;
export function flagHTML(nat, cls = '') {
  const st = {
    SOV: 'background:#c4261d', GER: 'background:#6d7780', FIN: 'background:linear-gradient(90deg,transparent 30%,#1c4f9c 30% 44%,transparent 44%),linear-gradient(0deg,#fff 40%,#1c4f9c 40% 60%,#fff 60%)',
    ROM: 'background:linear-gradient(90deg,#1c3f94 0 33%,#f5cc1e 33% 67%,#c81e2a 67%)', HUN: 'background:linear-gradient(#c8202a 0 33%,#fff 33% 67%,#3c7a3a 67%)',
    SVK: 'background:linear-gradient(#fff 0 33%,#1c4f9c 33% 67%,#c8202a 67%)', CRO: 'background:linear-gradient(#c8202a 0 33%,#fff 33% 67%,#1c3f94 67%)',
    ITA: 'background:linear-gradient(90deg,#2a8a3a 0 33%,#fff 33% 67%,#c8202a 67%)', BUL: 'background:linear-gradient(#fff 0 33%,#2a8a3a 33% 67%,#c8202a 67%)',
  }[nat] || 'background:#999';
  const inner = nat === 'SOV' ? `<i class="fs">${ic('star')}</i>` : nat === 'GER' ? '<svg class="fx" viewBox="0 0 30 20"><path d="M11.6 2.4h6.8v5h5v5.2h-5v5h-6.8v-5h-5V7.4h5z" fill="#fff"/><path d="M13 3.8h4v5h5v2.4h-5v5h-4v-5H8V8.8h5z" fill="#141414"/></svg>' : nat === 'FIN' ? '' : '';
  return `<span class="e-flag ${cls}" style="${st}">${inner}</span>`;
}
export const genURL = (k) => { const G = ALLG[k]; return G ? portraitURLP('w:' + k, G.por, POR_NAT[G.nat] || 'GER', 3) : ''; };
export const strCol = (s) => (s >= 70 ? '#6fb44e' : s >= 40 ? '#d9b23a' : '#d0583a');
export const POST = { auto: { n: 'Авто', ic: 'auto', d: 'генерал решает сам' }, def: { n: 'Оборона', ic: 'def', d: 'держать фронт, контратаки' }, atk: { n: 'Наступление', ic: 'atk', d: 'удары к цели' }, ret: { n: 'Отход', ic: 'ret', d: 'отступить, сберечь войска' } };
