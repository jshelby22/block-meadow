// Original, quiet sound effects synthesized locally. No audio downloads or music loop.
export class SoundEffects {
  constructor() { this.enabled = false; this.context = null; }

  async toggle() {
    if (this.enabled) { this.enabled = false; return false; }
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (!Audio) throw new Error('Web Audio is unavailable');
    this.context ??= new Audio();
    await this.context.resume();
    this.enabled = this.context.state === 'running';
    if (this.enabled) this.play('build');
    return this.enabled;
  }

  play(type) {
    if (!this.enabled || this.context?.state !== 'running') return;
    const now = this.context.currentTime;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    const frequency = type === 'break' ? 160 : type === 'undo' ? 390 : 570;
    oscillator.type = type === 'break' ? 'triangle' : 'sine';
    oscillator.frequency.setValueAtTime(frequency, now);
    oscillator.frequency.exponentialRampToValueAtTime(frequency * 0.55, now + 0.12);
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.065, now + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
    oscillator.connect(gain); gain.connect(this.context.destination);
    oscillator.start(now); oscillator.stop(now + 0.18);
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
  }
}
