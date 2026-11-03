// v0.7: предпросмотр сетки «Сталинград 1942–1943» (SVG → PNG через Chromium): node tools/preview-uranus.mjs [out.png] [scale]
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { makeGrid, R } from '../src/staff/geo.js';
const D = JSON.parse(fs.readFileSync(new URL('../src/data/uranus42.json', import.meta.url)));
const out = process.argv[2] || 'tools/shots/uranus_grid.png', S = +(process.argv[3] || 2);
const G = makeGrid(D.cols, D.rows);
let own = null, units = [];
try { const P = JSON.parse(fs.readFileSync('/tmp/uranus_state.json', 'utf8')); own = P.own; units = P.units || []; } catch {}
const TC = ['#000', '#e8dcc4', '#d8b890', '#a09890', '#bcd8c0'];
const hex = (i) => { const x = G.cx[i], y = G.cy[i], p = []; for (let k = 0; k < 6; k++) { const a = Math.PI / 6 + (k * Math.PI) / 3; p.push(`${(x + Math.cos(a) * R).toFixed(1)},${(y + Math.sin(a) * R).toFixed(1)}`); } return p.join(' '); };
let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${D.w * S}" height="${D.h * S}" viewBox="0 0 ${D.w} ${D.h}"><rect width="${D.w}" height="${D.h}" fill="#333"/>`;
for (let i = 0; i < G.n; i++) {
  const t = +D.terr[i];
  if (!t) continue;
  let f = TC[t];
  if (own) f = own[i] === '1' ? (t === 3 ? '#e09070' : '#d9a088') : own[i] === '2' ? (t === 3 ? '#7a5a48' : '#8a7060') : '#999';
  svg += `<polygon points="${hex(i)}" fill="${f}" stroke="#0003" stroke-width="0.4"/>`;
  if (D.rail[i] === '1') svg += `<circle cx="${G.cx[i]}" cy="${G.cy[i]}" r="1.6" fill="#555"/>`;
}
for (const r of D.rivers) { const p = r.p; let d = ''; for (let k = 0; k < p.length; k += 2) d += (k ? 'L' : 'M') + p[k] + ',' + p[k + 1]; svg += `<path d="${d}" fill="none" stroke="#3a8fd0" stroke-width="${r.w === 3 ? 2.4 : r.w === 2 ? 1.6 : 0.9}"/>`; }
for (const [a, b, t] of D.edges) { const mx = (G.cx[a] + G.cx[b]) / 2, my = (G.cy[a] + G.cy[b]) / 2; svg += `<circle cx="${mx}" cy="${my}" r="${t === 1 ? 0.9 : 1.4}" fill="${t === 3 ? '#00f' : t === 2 ? '#06c' : '#4ad'}"/>`; }
for (const [a, b, n] of D.bridges) { const mx = (G.cx[a] + G.cx[b]) / 2, my = (G.cy[a] + G.cy[b]) / 2; svg += `<rect x="${mx - 2.5}" y="${my - 2.5}" width="5" height="5" fill="#f0f"/><text x="${mx + 3}" y="${my - 3}" font-size="5" fill="#f0f">${n}</text>`; }
for (const [a, b, n] of D.ferries) { const mx = (G.cx[a] + G.cx[b]) / 2, my = (G.cy[a] + G.cy[b]) / 2; svg += `<rect x="${mx - 2}" y="${my - 2}" width="4" height="4" fill="#0ff"/>`; }
for (const r of D.rails) { let d = ''; for (let k = 0; k < r.length; k += 2) d += (k ? 'L' : 'M') + r[k] + ',' + r[k + 1]; svg += `<path d="${d}" fill="none" stroke="#222" stroke-width="0.8" stroke-dasharray="3 2"/>`; }
for (const t of D.towns) svg += `<circle cx="${t.x}" cy="${t.y}" r="${t.t === 1 ? 2.4 : t.t === 2 ? 1.7 : 1.1}" fill="#000"/><text x="${t.x + 2.5}" y="${t.y + 1.5}" font-size="${t.t === 1 ? 7 : t.t === 2 ? 5.5 : 4}" fill="#000" font-family="sans-serif">${t.n}</text>`;
for (const u of units) { const x = u.x, y = u.y; svg += `<rect x="${x - 4}" y="${y - 2.5}" width="8" height="5" fill="${u.s === 'SOV' ? '#c00' : u.nat === 'ROM' ? '#cc0' : u.nat === 'ITA' ? '#0a0' : '#222'}" stroke="#fff" stroke-width="0.4"/><text x="${x}" y="${y + 1.6}" font-size="3.6" fill="#fff" text-anchor="middle" font-family="sans-serif">${u.l}</text>`; }
svg += '</svg>';
fs.writeFileSync("/tmp/uranus_prev.html", `<html><head><meta charset="utf-8"></head><body style="margin:0">${svg}</body></html>`);
execFileSync('/usr/local/bin/chromium', ['--headless', '--no-sandbox', '--disable-gpu', `--screenshot=${out}`, `--window-size=${D.w * S},${D.h * S}`, 'file:///tmp/uranus_prev.html'], { stdio: 'ignore' });
console.log('→', out);
