const RANGE = 15;
const STEP_INTERVAL = 0.42;   // с, примерно шаг на 2.6 м/с

/**
 * Шаги антагониста. Файлов нет: всплеск шума через полосовой фильтр с быстрым
 * затуханием. `AudioContext` не создаётся до жеста пользователя, поэтому
 * `unlock()` зовут из первого нажатия — оно всё равно обязательно, чтобы начать
 * игру.
 *
 * Если контекст не создался, звука просто нет, и игра остаётся полностью
 * играбельной: предупреждает игрока виньетка, а не шаги.
 */
export function createSteps(): {
  unlock(): void;
  update(distance: number | null, pan: number, dt: number): void;
} {
  let ctx: AudioContext | null = null;
  let noise: AudioBuffer | null = null;
  let sinceStep = 0;

  function unlock(): void {
    if (ctx) { void ctx.resume(); return; }
    try {
      ctx = new AudioContext();
      const frames = Math.floor(ctx.sampleRate * 0.12);
      noise = ctx.createBuffer(1, frames, ctx.sampleRate);
      const data = noise.getChannelData(0);
      for (let i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1;
    } catch {
      ctx = null;   // Звука не будет. Это не ошибка игры.
    }
  }

  function play(volume: number, pan: number): void {
    if (!ctx || !noise) return;
    const source = ctx.createBufferSource();
    source.buffer = noise;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 180;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.12);
    const panner = ctx.createStereoPanner();
    panner.pan.value = Math.max(-1, Math.min(1, pan));
    source.connect(filter).connect(gain).connect(panner).connect(ctx.destination);
    source.start();
  }

  return {
    unlock,
    update(distance, pan, dt) {
      if (distance === null || distance >= RANGE) return;
      sinceStep += dt;
      if (sinceStep < STEP_INTERVAL) return;
      sinceStep = 0;
      play(0.35 * (1 - distance / RANGE), pan);
    },
  };
}
