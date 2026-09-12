export class Sound {
  context?: AudioContext;
  muted = false;
  unlock() {
    if (this.muted) return;
    try { this.context ??= new AudioContext(); void this.context.resume().catch(() => {}); } catch { /* Audio is optional. */ }
  }
  tone(frequency: number, duration: number, type: OscillatorType = 'sine', volume = .045, end = frequency) {
    const ctx = this.context;
    if (!ctx || this.muted || ctx.state !== 'running') return;
    const oscillator = ctx.createOscillator(); const gain = ctx.createGain(); const now = ctx.currentTime;
    oscillator.type = type; oscillator.frequency.setValueAtTime(frequency, now); oscillator.frequency.exponentialRampToValueAtTime(Math.max(end, 1), now + duration);
    gain.gain.setValueAtTime(volume, now); gain.gain.exponentialRampToValueAtTime(.0001, now + duration);
    oscillator.connect(gain); gain.connect(ctx.destination); oscillator.start(now); oscillator.stop(now + duration);
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
  }
  hit(kind: number, broken: boolean) { this.tone(180 + kind * 80, broken ? .18 : .07, 'triangle', .05, 45); if (broken) this.tone(850 + Math.random() * 100, .12, 'sine', .025, 300); }
  charge() { this.tone(90, .85, 'sawtooth', .025, 950); }
  boom() { this.tone(100, 1.4, 'sawtooth', .1, 20); this.tone(420, .6, 'triangle', .07, 35); }
  celebrate() { for (const [i, f] of [523, 659, 784, 1047].entries()) setTimeout(() => this.tone(f, .4, 'sine', .06), i * 140); }
}
