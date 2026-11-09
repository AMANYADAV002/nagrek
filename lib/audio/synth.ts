import type { SynthPreset } from "@/lib/config/tracks";

/**
 * Tiny generative ambient engine (Web Audio) used as a licence-free stand-in
 * until real tracks are added to /public/audio.
 * `output` is exposed so Phase 5 can route it into the call (MediaStreamDestination).
 */
const CHORDS = [
  [57, 60, 64, 67], // Am7
  [53, 57, 60, 64], // Fmaj7
  [48, 52, 55, 59], // Cmaj7
  [55, 59, 62, 65], // G7
];

const hz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

export class AmbientSynth {
  private ctx: AudioContext;
  readonly output: GainNode;
  private timers: ReturnType<typeof setInterval>[] = [];
  private nodes: AudioScheduledSourceNode[] = [];
  private step = 0;

  constructor() {
    this.ctx = new AudioContext();
    this.output = this.ctx.createGain();
    this.output.gain.value = 0.5;
    this.output.connect(this.ctx.destination);
  }

  setVolume(v: number) {
    this.output.gain.setTargetAtTime(Math.max(0, Math.min(1, v)), this.ctx.currentTime, 0.05);
  }

  async start(preset: SynthPreset) {
    this.stop();
    if (this.ctx.state === "suspended") await this.ctx.resume();
    this.step = 0;
    if (preset === "piano") this.loop(650, () => this.pianoNote());
    if (preset === "violin") this.loop(3200, () => this.bowedNote());
    if (preset === "soft") this.loop(4200, () => this.pad());
    if (preset === "cafe") {
      this.noiseBed();
      this.loop(1700, () => Math.random() < 0.45 && this.clink());
      this.loop(2600, () => this.pianoNote(0.05));
    }
  }

  stop() {
    this.timers.forEach(clearInterval);
    this.timers = [];
    this.nodes.forEach((n) => {
      try {
        n.stop();
      } catch {
        // already stopped
      }
    });
    this.nodes = [];
  }

  close() {
    this.stop();
    void this.ctx.close();
  }

  private loop(ms: number, fn: () => void) {
    fn();
    this.timers.push(setInterval(fn, ms));
  }

  private chord() {
    return CHORDS[Math.floor(this.step / 8) % CHORDS.length];
  }

  private envNote(freq: number, type: OscillatorType, attack: number, decay: number, peak: number, filterHz?: number) {
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(peak, t + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
    let last: AudioNode = osc;
    if (filterHz) {
      const f = this.ctx.createBiquadFilter();
      f.type = "lowpass";
      f.frequency.value = filterHz;
      osc.connect(f);
      last = f;
    }
    last.connect(gain).connect(this.output);
    osc.start(t);
    osc.stop(t + attack + decay + 0.05);
    this.nodes.push(osc);
    osc.onended = () => (this.nodes = this.nodes.filter((n) => n !== osc));
    return osc;
  }

  private pianoNote(peak = 0.18) {
    const c = this.chord();
    const note = c[this.step % c.length] + (this.step % 8 >= 4 ? 12 : 0);
    this.step++;
    this.envNote(hz(note), "triangle", 0.01, 1.8, peak, 2400);
  }

  private bowedNote() {
    const c = this.chord();
    const note = c[(this.step / 2) % c.length | 0] + 12;
    this.step += 4;
    const osc = this.envNote(hz(note), "sawtooth", 0.9, 3.2, 0.07, 1800);
    const lfo = this.ctx.createOscillator();
    const depth = this.ctx.createGain();
    lfo.frequency.value = 5.5;
    depth.gain.value = 4;
    lfo.connect(depth).connect(osc.frequency);
    lfo.start();
    lfo.stop(this.ctx.currentTime + 4.2);
  }

  private pad() {
    this.chord().forEach((n) => this.envNote(hz(n), "sine", 1.5, 3.4, 0.06));
    this.step += 8;
  }

  private clink() {
    this.envNote(2600 + Math.random() * 1400, "sine", 0.005, 0.35, 0.04);
  }

  private noiseBed() {
    const len = this.ctx.sampleRate * 2;
    const buffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
      data[i] = last * 3.5;
    }
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    const f = this.ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = 900;
    const g = this.ctx.createGain();
    g.gain.value = 0.25;
    src.connect(f).connect(g).connect(this.output);
    src.start();
    this.nodes.push(src);
  }
}
