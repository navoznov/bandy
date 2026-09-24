export interface FpsMeter {
  /** Раз в кадр: dt кадра и draw call'ы основной сцены. */
  update(dt: number, calls: number): void;
}

/**
 * Отладочный счётчик (`?fps`). Разметки в index.html для него нет намеренно:
 * без флага его не существует вовсе. Цифры усредняются за полсекунды —
 * покадровое число мелькает и не читается.
 */
export function createFpsMeter(): FpsMeter {
  const el = document.createElement('div');
  el.style.cssText =
    'position:fixed;top:8px;left:8px;z-index:1000;padding:4px 8px;' +
    'font:12px/1.3 monospace;color:#0f0;background:rgba(0,0,0,.6);pointer-events:none;';
  document.body.append(el);

  let elapsed = 0;
  let frames = 0;
  return {
    update(dt, calls) {
      elapsed += dt;
      frames += 1;
      if (elapsed < 0.5) return;
      el.textContent = `${Math.round(frames / elapsed)} fps · ${calls} calls`;
      elapsed = 0;
      frames = 0;
    },
  };
}
