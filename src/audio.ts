// Every sound is synthesised on the fly: noise bursts through filters for impacts, pitch-dropping
// oscillators for weight, and a compressor on the master bus so rapid combos stay loud but clean.
export class Sound {
  context?: AudioContext;
  muted = false;
  private master?: GainNode;
  private noiseBuffer?: AudioBuffer;
  private drone?: { gain: GainNode; oscillators: OscillatorNode[] };
  unlock() {
    if (this.muted) return;
    try {
      if (!this.context) {
        const ctx = new AudioContext(); this.context = ctx;
        const compressor = ctx.createDynamicsCompressor();
        compressor.threshold.value = -16; compressor.knee.value = 18; compressor.ratio.value = 7; compressor.attack.value = .002; compressor.release.value = .16;
        this.master = ctx.createGain(); this.master.gain.value = .75; this.master.connect(compressor); compressor.connect(ctx.destination);
        const buffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate); const data = buffer.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
        this.noiseBuffer = buffer;
      }
      void this.context.resume().catch(() => {});
    } catch { /* Audio is optional. */ }
  }
  private get ready() { const ctx = this.context; return ctx && this.master && !this.muted && ctx.state === 'running' ? ctx : null; }
  private envelope(ctx: AudioContext, node: AudioNode, volume: number, duration: number, attack: number, delay: number) {
    const gain = ctx.createGain(); const t = ctx.currentTime + delay;
    gain.gain.setValueAtTime(.0001, t); gain.gain.linearRampToValueAtTime(volume, t + attack); gain.gain.exponentialRampToValueAtTime(.0001, t + duration);
    node.connect(gain); gain.connect(this.master!);
    return t;
  }
  tone(from: number, to: number, duration: number, volume: number, type: OscillatorType = 'sine', delay = 0) {
    const ctx = this.ready; if (!ctx) return;
    const osc = ctx.createOscillator(); osc.type = type;
    const t = this.envelope(ctx, osc, volume, duration, .004, delay);
    osc.frequency.setValueAtTime(from, t); osc.frequency.exponentialRampToValueAtTime(Math.max(to, 1), t + duration);
    osc.start(t); osc.stop(t + duration + .05); osc.onended = () => osc.disconnect();
  }
  noise(duration: number, volume: number, filter: BiquadFilterType, from: number, to = from, q = 1, delay = 0) {
    const ctx = this.ready; if (!ctx || !this.noiseBuffer) return;
    const source = ctx.createBufferSource(); source.buffer = this.noiseBuffer; source.loop = true;
    const biquad = ctx.createBiquadFilter(); biquad.type = filter; biquad.Q.value = q; source.connect(biquad);
    const t = this.envelope(ctx, biquad, volume, duration, .003, delay);
    biquad.frequency.setValueAtTime(from, t); biquad.frequency.exponentialRampToValueAtTime(Math.max(to, 20), t + duration);
    source.start(t, Math.random() * .5); source.stop(t + duration + .05); source.onended = () => source.disconnect();
  }
  hit(kind: number, broken: boolean, combo: number) {
    const pitch = 1 + Math.min(combo, 24) * .022;
    this.noise(.07, .55, 'bandpass', 2400 * pitch, 500, 1.1);
    this.tone(280 * pitch, 50, .12, .6);
    this.tone(1400 * pitch, 300, .035, .14, 'square');
    if (!broken) return;
    this.noise(.42, 1, 'lowpass', 2200, 180);
    this.tone(160, 26, .55, 1.1);
    this.tone(95, 38, .32, .5, 'triangle');
    for (let i = 0; i < 7; i++) this.tone(1600 + Math.random() * 3200, 600, .16, .11, 'triangle', .02 + i * .028);
    if (kind === 0) this.noise(.32, .4, 'highpass', 2500, 7000, .7, .04);
    if (kind === 1) { this.tone(760, 220, .28, .22, 'sawtooth', .05); this.noise(.2, .3, 'bandpass', 3500, 1200, 4, .08); }
    if (kind === 2) { this.noise(.28, .5, 'bandpass', 520, 140, 2.5, .02); this.tone(210, 60, .25, .35, 'square', .04); }
  }
  charged() {
    for (const [i, f] of [440, 554, 659, 880].entries()) this.tone(f, f * 1.01, .28, .22, 'triangle', i * .07);
    this.noise(.7, .35, 'highpass', 800, 5000, .5, .1);
    this.tone(55, 110, .8, .35, 'sawtooth', .25);
  }
  charge() {
    this.tone(48, 1200, 1.05, .5, 'sawtooth');
    this.noise(1.05, .55, 'highpass', 150, 7000, .6);
    this.tone(36, 70, 1.05, .45);
  }
  boom() {
    this.tone(75, 16, 1.9, 1.3);
    this.noise(1.5, 1.2, 'lowpass', 3200, 50);
    this.tone(420, 34, .7, .55, 'sawtooth');
    this.noise(.7, .6, 'bandpass', 1400, 250, .8);
    for (let i = 0; i < 10; i++) this.tone(900 + Math.random() * 3000, 300, .3, .12, 'triangle', .1 + i * .05);
  }
  crash() {
    this.noise(.55, .9, 'lowpass', 1800, 120);
    this.tone(120, 28, .5, .9);
    for (let i = 0; i < 5; i++) this.tone(1200 + Math.random() * 2600, 500, .2, .1, 'triangle', .03 + i * .04);
  }
  zap() {
    this.tone(90, 1400, .28, .5, 'sawtooth'); this.noise(.3, .5, 'highpass', 400, 6000, .6);
    this.tone(60, 18, 1.1, 1.1, 'sine', .25); this.noise(.9, 1, 'lowpass', 2600, 60, 1, .25); this.tone(300, 30, .5, .5, 'sawtooth', .25);
    for (let i = 0; i < 8; i++) this.tone(1200 + Math.random() * 2800, 400, .2, .1, 'triangle', .3 + i * .04);
  }
  bonus() { for (const [i, f] of [1319, 1760, 2637].entries()) this.tone(f, f, .35, .16, 'triangle', i * .09); this.noise(.25, .15, 'highpass', 5000, 9000, .5); }
  milestone(level: number) {
    const base = [660, 880, 1175][Math.min(level, 2)];
    for (let i = 0; i < 3; i++) this.tone(base * (1 + i * .5), base * (1 + i * .5) * 1.02, .2, .2, 'square', i * .06);
    this.noise(.3, .3, 'highpass', 2500, 8000, .6);
    if (level >= 2) this.tone(70, 140, .6, .5, 'sawtooth', .1);
  }
  // Low pulsing drone while the combo is hot; ramps in and out so it never clicks.
  fever(on: boolean) {
    const ctx = this.ready;
    if (on && ctx && !this.drone) {
      const gain = ctx.createGain(); gain.gain.setValueAtTime(.0001, ctx.currentTime); gain.gain.exponentialRampToValueAtTime(.09, ctx.currentTime + .4);
      const filter = ctx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 240; filter.Q.value = 7;
      const lfo = ctx.createOscillator(); lfo.frequency.value = 4.2; const depth = ctx.createGain(); depth.gain.value = 140; lfo.connect(depth); depth.connect(filter.frequency); lfo.start();
      const oscillators = [55, 55.7, 110].map(f => { const osc = ctx.createOscillator(); osc.type = 'sawtooth'; osc.frequency.value = f; osc.connect(filter); osc.start(); return osc; });
      oscillators.push(lfo); filter.connect(gain); gain.connect(this.master!); this.drone = { gain, oscillators };
    } else if (!on && this.drone) {
      const { gain, oscillators } = this.drone; this.drone = undefined; const ctx = this.context!;
      gain.gain.cancelScheduledValues(ctx.currentTime); gain.gain.setValueAtTime(Math.max(gain.gain.value, .0001), ctx.currentTime); gain.gain.exponentialRampToValueAtTime(.0001, ctx.currentTime + .5);
      for (const osc of oscillators) osc.stop(ctx.currentTime + .55);
    }
  }
  boss() { this.tone(40, 38, 1.2, .7, 'sawtooth'); this.tone(80, 76, 1.2, .35, 'square'); for (let i = 0; i < 3; i++) this.noise(.12, .6, 'lowpass', 900, 200, 1, i * .28); this.tone(220, 110, .5, .3, 'triangle', .9); }
  celebrate() { for (const [i, f] of [523, 659, 784, 1047].entries()) this.tone(f, f, .45, .18, 'triangle', i * .13); this.noise(.5, .25, 'highpass', 3000, 8000, .5, .5); }
}
