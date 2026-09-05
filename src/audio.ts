export class AudioBus {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private music: GainNode | null = null;
  private step = 0;
  private lastBeat = 0;
  muted = false;

  resume(): void {
    if (!this.ctx) {
      const ctx = new AudioContext();
      const master = ctx.createGain();
      master.gain.value = 0.22;
      master.connect(ctx.destination);
      const music = ctx.createGain();
      music.gain.value = 0.32;
      music.connect(master);
      this.ctx = ctx;
      this.master = master;
      this.music = music;
    }
    void this.ctx.resume();
  }

  private beep(
    freq: number,
    dur: number,
    type: OscillatorType,
    vol = 0.2,
    slide = 0,
  ): void {
    if (!this.ctx || !this.master || this.muted) return;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    if (slide) {
      o.frequency.linearRampToValueAtTime(
        freq + slide,
        this.ctx.currentTime + dur,
      );
    }
    g.gain.value = vol;
    g.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + dur);
    o.connect(g);
    g.connect(this.master);
    o.start();
    o.stop(this.ctx.currentTime + dur);
  }

  jump(): void {
    this.beep(240, 0.12, "square", 0.1, 180);
  }

  slide(): void {
    this.beep(90, 0.18, "sawtooth", 0.08, -40);
  }

  hit(): void {
    this.beep(160 + Math.random() * 40, 0.06, "square", 0.09);
  }

  crit(): void {
    this.beep(420, 0.1, "square", 0.14, 80);
    this.beep(210, 0.14, "triangle", 0.1);
  }

  pickup(): void {
    this.beep(660, 0.07, "triangle", 0.08, 120);
  }

  gold(): void {
    this.beep(880, 0.08, "square", 0.07, 40);
  }

  level(): void {
    this.beep(330, 0.12, "square", 0.14);
    this.beep(495, 0.16, "square", 0.12);
    this.beep(660, 0.2, "triangle", 0.1);
  }

  hurt(): void {
    this.beep(110, 0.16, "sawtooth", 0.12, -70);
  }

  dead(): void {
    this.beep(90, 0.5, "sawtooth", 0.16, -50);
  }

  win(): void {
    this.beep(392, 0.16, "square", 0.12);
    this.beep(523, 0.2, "square", 0.12);
    this.beep(784, 0.28, "triangle", 0.12);
  }

  shop(): void {
    this.beep(300, 0.1, "triangle", 0.1);
    this.beep(450, 0.12, "triangle", 0.1);
  }

  tickMusic(now: number, intensity: number): void {
    if (!this.ctx || !this.music || this.muted) return;
    const bpm = 96 + intensity * 36;
    const interval = 60 / bpm;
    if (now - this.lastBeat < interval) return;
    this.lastBeat = now;
    const notes = [196, 247, 220, 294, 196, 330, 247, 370];
    const f = notes[this.step % notes.length];
    this.step++;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = this.step % 4 === 0 ? "square" : "triangle";
    o.frequency.value = f * (this.step % 8 === 7 ? 2 : 1);
    g.gain.value = 0.07;
    g.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + 0.18);
    o.connect(g);
    g.connect(this.music);
    o.start();
    o.stop(this.ctx.currentTime + 0.2);
    if (this.step % 2 === 0) {
      const kick = this.ctx.createOscillator();
      const kg = this.ctx.createGain();
      kick.type = "sine";
      kick.frequency.value = 70;
      kick.frequency.exponentialRampToValueAtTime(
        40,
        this.ctx.currentTime + 0.12,
      );
      kg.gain.value = 0.14;
      kg.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + 0.14);
      kick.connect(kg);
      kg.connect(this.music);
      kick.start();
      kick.stop(this.ctx.currentTime + 0.14);
    }
  }
}
