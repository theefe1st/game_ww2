// «Мировой фронт» v0.11: выписывает нужные значки из react-icons (game-icons.net — CC BY 3.0, Material — Apache 2.0)
// в src/east/icons.js (только контуры path). Запуск: node tools/icons-east.mjs
import fs from 'node:fs';
const RI = process.env.RI || '/vercel/sandbox/node_modules/react-icons';
const WANT = {
  tank: 'GiBattleTank', factory: 'GiFactory', fort: 'GiDefensiveWall', airfield: 'GiAirplaneDeparture', air: 'GiJetFighter',
  prod: 'GiGears', men: 'MdGroups', def: 'GiShield', atk: 'GiCrossedSwords', ret: 'GiReturnArrow', target: 'GiArcheryTarget',
  sun: 'GiSun', rain: 'GiRaining', mud: 'MdWaves', snow: 'GiSnowflake1', frost: 'GiThermometerCold', book: 'GiOpenBook',
  music: 'GiMusicalNotes', sound: 'GiSoundOn', soundoff: 'GiSoundOff', menu: 'GiHamburgerMenu', cav: 'GiHorseHead',
  mtn: 'GiMountaintop', trophy: 'GiLaurelsTrophy', flag: 'GiFlagObjective', encircle: 'GiEncirclement', helmet: 'GiBrodieHelmet',
  boom: 'GiExplosionRays', gun: 'GiCannon', bomber: 'GiBomber', port: 'GiAnchor', oil: 'GiOilDrum', ship: 'GiCargoShip',
  truck: 'GiTruck', skull: 'GiSkullCrossedBones', medal: 'GiStarMedal', hourglass: 'GiHourglass', calendar: 'GiCalendar',
  star: 'GiRoundStar', check: 'GiCheckMark', cancel: 'GiCancel', next: 'GiNextButton', play: 'GiPlayButton', save: 'GiSave',
  exit: 'GiExitDoor', info: 'GiInfo', help: 'GiHelp', settings: 'MdSettings', build: 'GiClawHammer', train: 'MdTrain',
  city: 'MdLocationCity', archive: 'MdInventory2', back: 'MdArrowBack', close: 'MdClose', zin: 'MdZoomIn', zout: 'MdZoomOut',
  locate: 'MdMyLocation', move: 'MdOpenWith', list: 'MdFormatListBulleted', bolt: 'MdBolt', up: 'MdKeyboardArrowUp',
  down: 'MdKeyboardArrowDown', left: 'MdChevronLeft', right: 'MdChevronRight', plus: 'MdAdd', minus: 'MdRemove', auto: 'MdAutorenew',
  rifle: 'GiRifle', wheat: 'GiWheat', radar: 'GiRadarSweep', binoc: 'GiBinoculars', sickle: 'GiHammerSickle',
  wire: 'GiBarbedWire', para: 'GiParachute', bell: 'GiRingingBell', compass: 'GiCompass', hammer: 'GiHammerNails', dice: 'GiPerspectiveDiceSixFacesRandom',
  // v0.11: фронты, экономика, наука, решения, погода, операции
  swap: 'MdSwapHoriz', hand: 'GiHand', brush: 'GiPaintBrush', mil: 'GiGearHammer', camp: 'GiBarracksTent', depot: 'GiCargoCrate', equip: 'GiHeavyBullets',
  sci: 'GiFizzingFlask', dec: 'GiScrollUnfurled', pol: 'GiPublicSpeaker', storm: 'GiLightningStorm', wind: 'GiWindSlap', fog: 'GiFog', hrain: 'GiHeavyRain',
  snowing: 'GiSnowing', landing: 'GiShipBow', sabres: 'GiCrossedSabres', news: 'GiNewspaper', radio: 'GiRadioTower', rail: 'GiRailRoad', bridge: 'GiStoneBridge',
  warship: 'GiIronHulledWarship', mg: 'GiMachineGun', ammo: 'GiBullets', plan: 'GiTreasureMap', org: 'GiOrganigram', idea: 'GiTeamIdea', upgrade: 'GiUpgrade',
  arrows: 'GiStrikingArrows', art: 'GiCannonShot', oilpump: 'GiOilPump', steel: 'GiMetalBar', boot: 'GiSteeltoeBoots', world: 'GiWorld', prog: 'GiProgression', ranks: 'GiStarsStack',
  civ: 'GiAnvil', crane: 'GiCrane', shell: 'GiArtilleryShell',
  aa: 'GiAntiAircraftGun', spade: 'GiSpade',
};
const src = {};
const grab = (name) => {
  const set = name.slice(0, 2).toLowerCase();
  src[set] ??= fs.readFileSync(`${RI}/${set}/index.js`, 'utf8');
  const s = src[set], i = s.indexOf(`${name} = function`);
  if (i < 0) throw new Error('нет значка ' + name);
  const j = s.indexOf('GenIcon(', i) + 8, k = s.indexOf(')(props)', j);
  return JSON.parse(s.slice(j, k));
};
const out = {};
for (const [k, n] of Object.entries(WANT)) {
  const t = grab(n), vb = t.attr.viewBox, ds = [];
  const walk = (c) => { for (const x of c.child || []) { if (x.tag === 'path' && x.attr.d && x.attr.fill !== 'none' && !/^M0 0h24v24H0z$/.test(x.attr.d)) ds.push(x.attr.d); walk(x); } };
  walk(t);
  out[k] = [vb === '0 0 512 512' ? 512 : vb === '0 0 24 24' ? 24 : vb, ...ds];
}
const body = Object.entries(out).map(([k, v]) => `  ${k}: ${JSON.stringify(v)},`).join('\n');
fs.writeFileSync('src/east/icons.js', `// «Мировой фронт» v0.11: значки интерфейса (создано tools/icons-east.mjs).
// Источники: game-icons.net (Lorc, Delapouite и др.) — CC BY 3.0; Material Design Icons (Google) — Apache 2.0.
// [размер поля, контуры…]
export const IC = {
${body}
};
// SVG-строка значка
export function icon(k, cls = '', title = '') {
  const v = IC[k];
  if (!v) return '';
  const s = v[0];
  return \`<svg class="ic \${cls}" viewBox="0 0 \${s} \${s}" aria-hidden="\${title ? 'false' : 'true'}">\${title ? \`<title>\${title}</title>\` : ''}\${v.slice(1).map((d) => \`<path d="\${d}"/>\`).join('')}</svg>\`;
}
// Path2D значка для холста (в единицах поля)
const P2 = {};
export function iconPath(k) {
  if (P2[k]) return P2[k];
  const v = IC[k], P = new Path2D();
  for (const d of v.slice(1)) P.addPath(new Path2D(d));
  return (P2[k] = P);
}
export const iconSize = (k) => IC[k][0];
`);
console.log('значков', Object.keys(out).length, 'размер', fs.statSync('src/east/icons.js').size);
