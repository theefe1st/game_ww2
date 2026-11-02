// Превью этапов «Карты фронта»: node tools/preview-front.mjs [scale] → tools/shots/front_<stage>.png
import fs from 'fs';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
let sharp;
try { sharp = require('sharp'); } catch { sharp = require('/vercel/sandbox/node_modules/sharp'); }
const { frontBase, frontOwners, frontBaseRGB, frontComposite } = await import('../src/front/render.js');
const { FRONT_STAGES, FRONT_CITIES, FRONT_OPS, FRONT_DELTAS } = await import('../src/front/stages.js');
const B = JSON.parse(fs.readFileSync(new URL('../src/data/front_base.json', import.meta.url)));
const F = frontBase(B), rgb = frontBaseRGB(F);
const S = +(process.argv[2] || 3);
const only = process.argv[3];
const OPS = Object.keys(FRONT_OPS);
const jobs = [];
FRONT_STAGES.forEach((st, si) => jobs.push({ name: st.id, si, d: null, k: null, op: OPS[si] }));
for (const op of Object.keys(FRONT_DELTAS)) {
  const si = op === 'rzhev42' ? 3 : OPS.indexOf(op) + (OPS.indexOf(op) >= 3 ? 0 : 1);
  for (const k of ['ahead', 'behind']) jobs.push({ name: `${op}_${k}`, si, d: op, k });
}
for (const j of jobs) {
  if (only && !j.name.includes(only)) continue;
  const own = frontOwners(F, j.si, j.d, j.k);
  const img = frontComposite(F, rgb, own, new Uint8ClampedArray(F.n * 4));
  const big = await sharp(Buffer.from(img.buffer), { raw: { width: F.w, height: F.h, channels: 4 } })
    .resize(F.w * S, F.h * S, { kernel: 'nearest' }).png().toBuffer();
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${F.w * S}" height="${F.h * S}" font-family="DejaVu Sans" font-size="${4 * S}">`;
  for (const [nm, lo, la, r] of FRONT_CITIES) {
    const [x, y] = F.pr(lo, la);
    svg += `<rect x="${x * S - S}" y="${y * S - S}" width="${2 * S}" height="${2 * S}" fill="#222" stroke="#fff" stroke-width="1"/>`;
    svg += `<text x="${x * S + 2 * S}" y="${y * S + S}" fill="#fff" stroke="#000" stroke-width="2" paint-order="stroke" font-size="${(r >= 2 ? 4.5 : 3.6) * S}">${nm}</text>`;
  }
  const o = FRONT_OPS[j.op];
  if (o) {
    for (const a of o.arrows) svg += `<polyline fill="none" stroke="${a.side === 'sov' ? '#ff3b2b' : '#334'}" stroke-width="${S}" points="${a.p.map(([lo, la]) => F.pr(lo, la).map((v) => (v * S).toFixed(1)).join(',')).join(' ')}"/>`;
    const [x, y] = F.pr(...o.at);
    svg += `<circle cx="${x * S}" cy="${y * S}" r="${4 * S}" fill="none" stroke="#ffd34d" stroke-width="${S}"/>`;
  }
  svg += `<text x="${4 * S}" y="${10 * S}" fill="#fff" stroke="#000" stroke-width="3" paint-order="stroke" font-size="${7 * S}">${j.name} · ${FRONT_STAGES[j.si].title}</text></svg>`;
  await sharp(big).composite([{ input: Buffer.from(svg) }]).png().toFile(new URL(`./shots/front_${j.name}.png`, import.meta.url).pathname);
  console.log('ok', j.name);
}
