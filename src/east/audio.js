// «Мировой фронт» v0.11: звук без файлов — музыка и эффекты синтезируются WebAudio.
// Музыка: «menu» — торжественный хорал ре минор, «war» — спокойная тема с литаврами; громкость музыки и эффектов
// хранится в localStorage. Контекст создаётся по первому касанию (требование браузеров).
// Фон погоды (ambient): дождь, морось, ветер, метель — зацикленный шум через фильтры, плавная смена; громкость — как у эффектов.
const KEY = 'wf_east_snd';
const NOTE = (n) => 440 * Math.pow(2, (n - 69) / 12);
// аккорды (MIDI) и мелодия по долям
const TRACKS = {
  menu: { bpm: 62, chords: [[50, 57, 62, 65], [46, 53, 58, 62], [43, 50, 55, 58], [45, 52, 57, 61], [50, 57, 62, 65], [41, 48, 53, 57], [43, 50, 55, 58], [45, 52, 57, 61]],
    mel: [74, 72, 70, 69, 70, 69, 67, 65, 67, 69, 70, 72, 69, null, 69, null, 74, 76, 77, 76, 74, 72, 70, 69, 70, 67, 69, 70, 69, null, null, null], drum: [1, 0, 0, 0] },
  war: { bpm: 72, chords: [[45, 52, 57, 60], [41, 48, 53, 57], [38, 45, 50, 53], [40, 47, 52, 56], [45, 52, 57, 60], [43, 50, 55, 59], [41, 48, 53, 57], [40, 47, 52, 56]],
    mel: [69, null, 72, null, 71, 69, 67, null, 65, null, 69, null, 68, null, null, null, 69, null, 72, 74, 76, null, 74, 72, 71, null, 69, 71, 68, null, null, null], drum: [1, 0, 0.5, 0] },
};
export class Sound {
  constructor() {
    let c = null;
    try { c = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch {}
    this.cfg = { music: 0.45, sfx: 0.8, ...(c || {}) };
    this.ctx = null; this.track = null; this.want = null; this.timer = 0; this.amb = null; this.ambCur = null;
  }
  save() { try { localStorage.setItem(KEY, JSON.stringify(this.cfg)); } catch {} }
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      const c = this.ctx;
      this.mGain = c.createGain(); this.mGain.gain.value = this.cfg.music * 0.32; this.mGain.connect(c.destination);
      this.sGain = c.createGain(); this.sGain.gain.value = this.cfg.sfx * 0.6; this.sGain.connect(c.destination);
      // мягкий «зал» для музыки
      this.rev = c.createConvolver(); this.rev.buffer = this.impulse(2.2); const rg = c.createGain(); rg.gain.value = 0.35; this.rev.connect(rg); rg.connect(this.mGain);
      this.noiseBuf = this.noise(1.5);
    }
    if (this.ctx.state === 'suspended' && !this.hid) this.ctx.resume();
    if (this.want && !this.track) this.music(this.want);
    if (this.amb && !this.ambCur) this.ambient(this.amb);
  }
  // приложение свёрнуто — тишина (и музыка, и фон)
  suspend(on) {
    this.hid = !!on;
    if (!this.ctx) return;
    if (on) this.ctx.suspend?.(); else this.ctx.resume?.();
  }
  setMusic(v) { this.cfg.music = v; this.save(); if (this.mGain) this.mGain.gain.value = v * 0.32; if (v > 0 && this.want && !this.track) this.music(this.want); if (v === 0) this.stopMusic(true); }
  setSfx(v) { this.cfg.sfx = v; this.save(); if (this.sGain) this.sGain.gain.value = v * 0.6; this.ambient(this.amb); }
  impulse(sec) {
    const c = this.ctx, n = Math.floor(c.sampleRate * sec), b = c.createBuffer(2, n, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = b.getChannelData(ch); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 2.6); }
    return b;
  }
  noise(sec) {
    const c = this.ctx, n = Math.floor(c.sampleRate * sec), b = c.createBuffer(1, n, c.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    return b;
  }
  // ——— музыка ———
  music(name) {
    this.want = name;
    if (!this.ctx || this.cfg.music <= 0) return;
    if (this.track?.name === name) return;
    this.stopMusic();
    const T = TRACKS[name];
    if (!T) return;
    const beat = 60 / T.bpm;
    this.track = { name, T, beat, next: this.ctx.currentTime + 0.3, step: 0, bus: this.ctx.createGain() };
    const b = this.track.bus; b.gain.value = 0; b.connect(this.mGain); b.connect(this.rev);
    b.gain.setTargetAtTime(1, this.ctx.currentTime, 1.2);
    clearInterval(this.timer);
    this.timer = setInterval(() => this.sched(), 120);
    this.sched();
  }
  stopMusic(hard = false) {
    clearInterval(this.timer);
    const t = this.track;
    if (t && this.ctx) { t.bus.gain.setTargetAtTime(0, this.ctx.currentTime, hard ? 0.05 : 0.6); setTimeout(() => t.bus.disconnect(), 2500); }
    this.track = null;
  }
  sched() {
    const tr = this.track, c = this.ctx;
    if (!tr || !c) return;
    const { T, beat } = tr;
    while (tr.next < c.currentTime + 0.8) {
      const s = tr.step, t = tr.next, bar = Math.floor(s / 4) % T.chords.length;
      if (s % 4 === 0) for (const n of T.chords[bar]) this.pad(tr.bus, NOTE(n), t, beat * 4);
      const m = T.mel[s % T.mel.length];
      if (m) this.lead(tr.bus, NOTE(m), t, beat * 0.95);
      const d = T.drum[s % 4];
      if (d) this.timp(tr.bus, NOTE(T.chords[bar][0] - 12), t, d);
      tr.next += beat; tr.step++;
    }
  }
  pad(out, f, t, dur) {
    const c = this.ctx, g = c.createGain(), lp = c.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 900; lp.Q.value = 0.4;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.06, t + dur * 0.3); g.gain.linearRampToValueAtTime(0.045, t + dur * 0.8); g.gain.linearRampToValueAtTime(0, t + dur * 1.05);
    for (const det of [-6, 6]) { const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = det; o.connect(lp); o.start(t); o.stop(t + dur * 1.1); }
    lp.connect(g); g.connect(out);
  }
  lead(out, f, t, dur) {
    const c = this.ctx, o = c.createOscillator(), g = c.createGain(), v = c.createOscillator(), vg = c.createGain();
    o.type = 'triangle'; o.frequency.value = f;
    v.frequency.value = 5; vg.gain.value = f * 0.006; v.connect(vg); vg.connect(o.frequency);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.11, t + 0.06); g.gain.exponentialRampToValueAtTime(0.05, t + dur * 0.7); g.gain.linearRampToValueAtTime(0, t + dur);
    o.connect(g); g.connect(out); o.start(t); v.start(t); o.stop(t + dur + 0.05); v.stop(t + dur + 0.05);
  }
  timp(out, f, t, k) {
    const c = this.ctx, o = c.createOscillator(), g = c.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(f * 1.5, t); o.frequency.exponentialRampToValueAtTime(f, t + 0.12);
    g.gain.setValueAtTime(0.22 * k, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.9);
    o.connect(g); g.connect(out); o.start(t); o.stop(t + 1);
  }
  // ——— фон погоды: kind = 'rain' | 'drizzle' | 'wind' | 'blizzard' | null ———
  ambient(kind) {
    this.amb = kind || null;
    const c = this.ctx;
    if (!c) return;
    const want = this.cfg.sfx > 0 ? this.amb : null;
    if ((this.ambCur?.kind || null) === want) return;
    const old = this.ambCur;
    if (old) {
      old.g.gain.cancelScheduledValues(c.currentTime); old.g.gain.setTargetAtTime(0, c.currentTime, 0.7);
      setTimeout(() => { for (const n of old.nodes) { try { n.stop?.(); } catch {} try { n.disconnect(); } catch {} } }, 4000);
    }
    this.ambCur = want ? this.makeAmb(want) : null;
  }
  makeAmb(kind) {
    const c = this.ctx, t = c.currentTime, g = c.createGain(), nodes = [g];
    this.ambBuf ??= this.noise(5.3);
    g.gain.value = 0; g.connect(this.sGain);
    const src = () => { const s = c.createBufferSource(); s.buffer = this.ambBuf; s.loop = true; s.start(t, Math.random() * 5); nodes.push(s); return s; };
    const flt = (type, f, q) => { const x = c.createBiquadFilter(); x.type = type; x.frequency.value = f; x.Q.value = q; nodes.push(x); return x; };
    const gain = (v) => { const x = c.createGain(); x.gain.value = v; nodes.push(x); return x; };
    const lfo = (f, depth, param) => { const o = c.createOscillator(), og = gain(depth); o.frequency.value = f; o.connect(og); og.connect(param); o.start(t); nodes.push(o); };
    let vol;
    if (kind === 'rain' || kind === 'drizzle') {
      const heavy = kind === 'rain';
      // шорох капель (верх) + гул ливня (низ), «волны» силы дождя
      const a = src(), hp = flt('highpass', heavy ? 1100 : 1700, 0.4), lp = flt('lowpass', heavy ? 7500 : 6000, 0.3), ga = gain(1);
      a.connect(hp); hp.connect(lp); lp.connect(ga); ga.connect(g);
      lfo(0.07, 0.25, ga.gain);
      const b = src(), bp = flt('bandpass', 380, 0.7), gb = gain(heavy ? 0.55 : 0.18);
      b.connect(bp); bp.connect(gb); gb.connect(g);
      vol = heavy ? 0.2 : 0.11;
    } else {
      const strong = kind === 'blizzard';
      // ветер: узкий шум с «гуляющей» частотой и порывами
      const a = src(), bp = flt('bandpass', strong ? 560 : 360, strong ? 1.8 : 1.2), lp = flt('lowpass', strong ? 1900 : 1000, 0.2), ga = gain(0.75);
      a.connect(bp); bp.connect(lp); lp.connect(ga); ga.connect(g);
      lfo(0.11, strong ? 280 : 150, bp.frequency); lfo(0.047, strong ? 0.45 : 0.35, ga.gain);
      if (strong) { // посвист позёмки
        const b = src(), bp2 = flt('bandpass', 1500, 6), gb = gain(0.35);
        b.connect(bp2); bp2.connect(gb); gb.connect(g); lfo(0.19, 380, bp2.frequency); lfo(0.08, 0.3, gb.gain);
      }
      vol = strong ? 0.26 : 0.15;
    }
    g.gain.setTargetAtTime(vol, t, 1.1);
    return { kind, g, nodes };
  }
  // ——— эффекты ———
  tone(f0, f1, dur, type = 'sine', vol = 0.3, t = 0) {
    const c = this.ctx; if (!c) return;
    const s = c.currentTime + t, o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, s); if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, s + dur);
    g.gain.setValueAtTime(vol, s); g.gain.exponentialRampToValueAtTime(0.001, s + dur);
    o.connect(g); g.connect(this.sGain); o.start(s); o.stop(s + dur + 0.02);
  }
  burst(dur, f, q = 0.8, vol = 0.5, t = 0, type = 'lowpass') {
    const c = this.ctx; if (!c) return;
    const s = c.currentTime + t, n = c.createBufferSource(), fl = c.createBiquadFilter(), g = c.createGain();
    n.buffer = this.noiseBuf; fl.type = type; fl.frequency.value = f; fl.Q.value = q;
    g.gain.setValueAtTime(vol, s); g.gain.exponentialRampToValueAtTime(0.001, s + dur);
    n.connect(fl); fl.connect(g); g.connect(this.sGain); n.start(s, Math.random()); n.stop(s + dur + 0.02);
  }
  play(k) {
    if (!this.ctx || this.cfg.sfx <= 0) return;
    switch (k) {
      case 'click': this.tone(1100, 720, 0.05, 'triangle', 0.18); break;
      case 'select': this.tone(660, 660, 0.06, 'triangle', 0.16); this.tone(990, 990, 0.08, 'triangle', 0.14, 0.05); break;
      case 'move': this.burst(0.28, 900, 1.2, 0.25, 0, 'bandpass'); this.tone(220, 180, 0.2, 'sine', 0.12); break;
      case 'attack': for (let i = 0; i < 3; i++) { this.burst(0.5, 380, 0.7, 0.6, i * 0.13); this.tone(90, 40, 0.45, 'sine', 0.5, i * 0.13); } break;
      case 'win': [0, 4, 7, 12].forEach((n, i) => this.tone(NOTE(67 + n), NOTE(67 + n), 0.32, 'triangle', 0.22, i * 0.09)); break;
      case 'lose': [0, -3, -7].forEach((n, i) => this.tone(NOTE(64 + n), NOTE(63 + n), 0.38, 'triangle', 0.2, i * 0.13)); break;
      case 'turn': for (const [m, v] of [[1, 0.22], [2.76, 0.08], [5.4, 0.04]]) this.tone(392 * m, 392 * m, 1.6, 'sine', v); break;
      case 'event': for (let i = 0; i < 8; i++) this.burst(0.06, 2200, 0.6, 0.18, i * 0.045, 'highpass'); [0, 3, 7].forEach((n) => this.tone(NOTE(62 + n), NOTE(62 + n), 0.8, 'triangle', 0.1, 0.38)); break;
      case 'build': this.burst(0.06, 1800, 2, 0.35); this.burst(0.06, 1500, 2, 0.3, 0.16); break;
      case 'error': this.tone(160, 140, 0.16, 'square', 0.1); break;
      case 'victory': [0, 4, 7, 12, 16, 19, 24].forEach((n, i) => this.tone(NOTE(60 + n), NOTE(60 + n), 0.6, 'triangle', 0.18, i * 0.12)); break;
      case 'defeat': [0, -2, -5, -9, -12].forEach((n, i) => this.tone(NOTE(60 + n), NOTE(60 + n), 0.7, 'sine', 0.2, i * 0.22)); break;
      // далёкая канонада: глухие разрывы вразнобой
      case 'arty': { let d = 0; for (let i = 0; i < 6; i++) { const k = 0.55 + Math.random() * 0.45; this.burst(1.1, 150 + Math.random() * 110, 0.6, 0.42 * k, d); this.tone(58 + Math.random() * 14, 28, 0.9, 'sine', 0.34 * k, d); d += 0.16 + Math.random() * 0.34; } break; }
      case 'plane': this.drone(2.6); break;
      case 'sea': this.waves(); break;
    }
  }
  // гул моторов самолётов: два мотора с биениями, пролёт с эффектом Доплера
  drone(dur) {
    const c = this.ctx, s = c.currentTime, g = c.createGain(), lp = c.createBiquadFilter(), am = c.createGain(), pr = c.createOscillator(), pg = c.createGain();
    lp.type = 'lowpass'; lp.frequency.setValueAtTime(380, s); lp.frequency.linearRampToValueAtTime(900, s + dur * 0.45); lp.frequency.linearRampToValueAtTime(300, s + dur);
    g.gain.setValueAtTime(0.001, s); g.gain.exponentialRampToValueAtTime(0.2, s + dur * 0.45); g.gain.exponentialRampToValueAtTime(0.001, s + dur);
    am.gain.value = 0.75; pr.frequency.value = 23; pg.gain.value = 0.25; pr.connect(pg); pg.connect(am.gain); // «тарахтение» винтов
    for (const f of [92, 95.5]) {
      const o = c.createOscillator(); o.type = 'sawtooth';
      o.frequency.setValueAtTime(f * 1.06, s); o.frequency.linearRampToValueAtTime(f * 0.92, s + dur);
      o.connect(lp); o.start(s); o.stop(s + dur + 0.05);
    }
    lp.connect(am); am.connect(g); g.connect(this.sGain); pr.start(s); pr.stop(s + dur + 0.05);
  }
  // море: две волны и гудок корабля
  waves() {
    const c = this.ctx, s = c.currentTime;
    for (let i = 0; i < 2; i++) {
      const t = s + i * 1.1, n = c.createBufferSource(), fl = c.createBiquadFilter(), g = c.createGain();
      n.buffer = this.noiseBuf; fl.type = 'lowpass'; fl.frequency.setValueAtTime(300, t); fl.frequency.linearRampToValueAtTime(1300, t + 0.7); fl.frequency.linearRampToValueAtTime(260, t + 1.5);
      g.gain.setValueAtTime(0.001, t); g.gain.exponentialRampToValueAtTime(0.34, t + 0.6); g.gain.exponentialRampToValueAtTime(0.001, t + 1.5);
      n.connect(fl); fl.connect(g); g.connect(this.sGain); n.start(t, Math.random() * 0.3); n.stop(t + 1.55);
    }
    const o = c.createOscillator(), o2 = c.createOscillator(), lp = c.createBiquadFilter(), g = c.createGain(), t = s + 0.35;
    o.type = 'sawtooth'; o.frequency.value = 104; o2.type = 'sawtooth'; o2.frequency.value = 131; lp.type = 'lowpass'; lp.frequency.value = 520;
    g.gain.setValueAtTime(0.001, t); g.gain.exponentialRampToValueAtTime(0.09, t + 0.12); g.gain.setValueAtTime(0.09, t + 0.95); g.gain.exponentialRampToValueAtTime(0.001, t + 1.3);
    o.connect(lp); o2.connect(lp); lp.connect(g); g.connect(this.sGain); o.start(t); o2.start(t); o.stop(t + 1.35); o2.stop(t + 1.35);
  }
}
