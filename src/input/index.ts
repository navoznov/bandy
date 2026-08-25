import type { InputSource } from './types';
import { createDesktopInput } from './desktop';
import { createTouchInput } from './touch';

export type { InputSource, InputState } from './types';

/**
 * Схема выбирается по факту первого события, а не по user agent — он врёт.
 * На ноутбуке с тачскрином работают обе и переключаются на лету.
 */
export function createInput(canvas: HTMLCanvasElement): InputSource {
  const desktop = createDesktopInput(canvas);
  let touch: InputSource | null = null;

  window.addEventListener('pointerdown', (event) => {
    if (event.pointerType === 'touch' && touch === null) {
      touch = createTouchInput(canvas);
      const rotate = document.querySelector<HTMLElement>('#rotate');
      if (rotate) rotate.hidden = false;
    }
  }, { capture: true });

  return {
    get state() { return (touch ?? desktop).state; },
    isLocked: () => (touch ?? desktop).isLocked(),
    consume: () => (touch ?? desktop).consume(),
  };
}
