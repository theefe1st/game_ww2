// «Фронт 1941–1945»: отладочный снимок состояния кампании в PNG (без браузера, через sharp).
// node tools/war-snap.mjs <дата|сутки> [зерно] [выход.png] [x0,y0,x1,y1 — обрезка в пикселях карты]
import fs from 'fs';
import sharp from 'sharp';
import { decodeEU } from '../src/war/map41.js';
import { newGame, simDay } from '../src/war/engine.js';
import { fmtDate, alive, dayOf, sideOfH, isMech } from '../src/war/rules.js';

const J = JSON.parse(fs.readFileSync(new URL('../src/data/eu41.json', import.meta.url)));
const M = decodeEU(J);
const arg = process.argv[2] || '0', seed = +(process.argv[3] ?? 1), out = process.argv[4] || '/tmp/war.png';
const days = /^\d+$/.test(arg) ? +arg : dayOf(arg);
const S = newGame(M, { side: null, seed });
while (S.day < days && !S.over) simDay(S);
export function snap(S, out, crop) {
  const K = +(process.env.K || 1), W = M.g.pxW, H = M.g.pxH;
  let x0 = 0, y0 = 0, x1 = W, y1 = H;
  if (crop) [x0, y0, x1, y1] = crop;
  const w = Math.round((x1 - x0) * K), h = Math.round((y1 - y0) * K);
  const buf = Buffer.alloc(w * h * 3);
  const TC = [[40, 70, 110], [70, 110, 160], [200, 200, 170], [150, 175, 130], [190, 175, 140], [160, 150, 140], [150, 170, 160], [215, 205, 150], [200, 205, 200]];
  const OC = { GER: [120, 140, 175], SOV: [215, 120, 110], N: [205, 200, 185] };
  for (let py = 0; py < h; py++) for (let px = 0; px < w; px++) {
    const X = x0 + px / K, Y = y0 + py / K, i = M.hexAt(X, Y);
    let c = [20, 20, 20];
    if (i >= 0) {
      const t = M.terr[i];
      c = TC[t];
      if (t >= 2) {
        const sd = sideOfH(S, i), o = OC[sd || 'N'];
        c = [(c[0] + o[0] * 2) / 3, (c[1] + o[1] * 2) / 3, (c[2] + o[2] * 2) / 3];
        if (S.supL?.[sd] && S.supL[sd][i] === 0) c = [c[0] * 0.75, c[1] * 0.75, c[2] * 0.75];
      }
    }
    const o = (py * w + px) * 3;
    buf[o] = c[0]; buf[o + 1] = c[1]; buf[o + 2] = c[2];
  }
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">`;
  const P = (i) => { const [x, y] = M.xy(i); return [(x - x0) * K, (y - y0) * K]; };
  for (const u of S.units) {
    if (!alive(u)) continue;
    const [x, y] = P(u.h);
    const col = u.side === 'GER' ? (u.nat === 'GER' ? (isMech(u) ? '#1040ff' : '#000') : '#2a6a2a') : isMech(u) ? '#ff8000' : '#900';
    const r = isMech(u) ? 3.2 : 2.4;
    svg += `<rect x="${x - r}" y="${y - r}" width="${2 * r}" height="${2 * r}" fill="${col}" stroke="${u.oos > 2 ? '#ff0' : 'none'}" stroke-width="1"/>`;
  }
  for (const c of M.cities) {
    if (c.sz < 2 && c.vp < 3) continue;
    const [x, y] = P(c.h);
    svg += `<circle cx="${x}" cy="${y}" r="2" fill="#fff" stroke="#000" stroke-width="0.6"/><text x="${x + 3}" y="${y - 2}" font-size="8" font-family="Arial" fill="#000">${c.n}</text>`;
  }
  svg += `<text x="6" y="16" font-size="14" font-family="Arial" font-weight="bold" fill="#000">${fmtDate(S.day)} · GER ${S.units.filter((u) => u.side === 'GER' && alive(u)).length} · SOV ${S.units.filter((u) => u.side === 'SOV' && alive(u)).length}</text></svg>`;
  return sharp(buf, { raw: { width: w, height: h, channels: 3 } }).composite([{ input: Buffer.from(svg), top: 0, left: 0 }]).png().toFile(out);
}
const crop = process.argv[5] ? process.argv[5].split(',').map(Number) : null;
await snap(S, out, crop);
console.log('ok', out, fmtDate(S.day), S.over ? JSON.stringify(S.over) : '');
