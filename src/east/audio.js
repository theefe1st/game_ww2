// «Мировой фронт» v0.10: звук без файлов — музыка и эффекты синтезируются WebAudio.
// Музыка: «menu» — торжественный хорал ре минор, «war» — спокойная тема с литаврами; громкость музыки и эффектов
// хранится в localStorage. Контекст создаётся по первому касанию (требование браузеров).
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
    this.ctx = null; this.track = null; this.want = null; this.timer = 0;
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
    if (this.ctx.state === 'suspended') this.ctx.resume();
    if (this.want && !this.track) this.music(this.want);
  }
  setMusic(v) { this.cfg.music = v; this.save(); if (this.mGain) this.mGain.gain.value = v * 0.32; if (v > 0 && this.want && !this.track) this.music(this.want); if (v === 0) this.stopMusic(true); }
  setSfx(v) { this.cfg.sfx = v; this.save(); if (this.sGain) this.sGain.gain.value = v * 0.6; }
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
    }
  }
}
