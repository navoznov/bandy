export interface NightAudio {
  unlock(): void;
  /** Лязг заслонки. */
  thunk(): void;
  /** Крик скримера, около секунды. */
  scream(): void;
  /** Колокольчик 6 AM. */
  chime(): void;
}

/**
 * Звуки ночи. Файлов нет — как и шаги антагониста, всё синтезируется. Если
 * `AudioContext` не создался, звука просто нет: скример и 6 AM работают и без
 * него (спека §4).
 */
export function createNightAudio(): NightAudio {
  let ctx: AudioContext | null = null;

  function unlock(): void {
    if (ctx) { void ctx.resume(); return; }
    try {
      ctx = new AudioContext();
    } catch {
      ctx = null;
    }
  }

  function noise(c: AudioContext, seconds: number): AudioBufferSourceNode {
    const frames = Math.floor(c.sampleRate * seconds);
    const buffer = c.createBuffer(1, frames, c.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1;
    const source = c.createBufferSource();
    source.buffer = buffer;
    return source;
  }

  function envelope(c: AudioContext, peak: number, attack: number, length: number): GainNode {
    const gain = c.createGain();
    const t = c.currentTime;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(peak, t + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + length);
    gain.connect(c.destination);
    return gain;
  }

  return {
    unlock,
    thunk() {
      if (!ctx) return;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 400;
      const source = noise(ctx, 0.18);
      source.connect(filter).connect(envelope(ctx, 0.5, 0.005, 0.18));
      source.start();
    },
    scream() {
      if (!ctx) return;
      const t = ctx.currentTime;
      const gain = envelope(ctx, 0.9, 0.03, 1.0);
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(180, t);
      osc.frequency.exponentialRampToValueAtTime(900, t + 0.25);
      osc.frequency.exponentialRampToValueAtTime(400, t + 1.0);
      osc.connect(gain);
      osc.start(t);
      osc.stop(t + 1.05);
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 1500;
      filter.Q.value = 0.7;
      const hiss = noise(ctx, 1.0);
      hiss.connect(filter).connect(gain);
      hiss.start(t);
    },
    chime() {
      if (!ctx) return;
      const t = ctx.currentTime;
      [660, 880, 1320].forEach((freq, i) => {
        const osc = ctx!.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = freq;
        const gain = ctx!.createGain();
        const start = t + i * 0.35;
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(0.4, start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.8);
        osc.connect(gain).connect(ctx!.destination);
        osc.start(start);
        osc.stop(start + 0.85);
      });
    },
  };
}
