import { emptyState, type InputSource, type InputState } from './types';

/**
 * Все хоткеи читаются через event.code — это физическая клавиша.
 * event.key сломался бы при переключении раскладки.
 */
export function createDesktopInput(canvas: HTMLCanvasElement): InputSource {
  const state: InputState = emptyState();
  const pressed = new Set<string>();
  let locked = false;

  canvas.addEventListener('click', () => {
    if (locked) return;
    // На iPhone Safari Pointer Lock не существует вовсе, и метод там undefined.
    // Десктопный источник остаётся живым после переключения на тач, а тап
    // синтезирует click — без этой проверки каждое касание экрана бросало бы
    // TypeError. Синхронный бросок, catch ниже его не поймал бы.
    if (typeof canvas.requestPointerLock !== 'function') return;
    // Chrome примерно 1.25 с после Escape не отдаёт захват и реджектит промис.
    // Без catch это всплывает необработанным отказом.
    canvas.requestPointerLock().catch(() => {});
  });

  document.addEventListener('pointerlockchange', () => {
    locked = document.pointerLockElement === canvas;
    if (!locked) pressed.clear();
  });

  document.addEventListener('mousemove', (event) => {
    if (!locked) return;
    state.look.dx += event.movementX;
    state.look.dy += event.movementY;
  });

  window.addEventListener('keydown', (event) => {
    if (event.repeat) return;
    pressed.add(event.code);
    if (event.code === 'KeyE') state.interact = true;
    if (event.code === 'KeyI' || event.code === 'Tab') {
      state.toggleInventory = true;
      event.preventDefault(); // Tab иначе уведёт фокус со страницы
    }
  });

  window.addEventListener('keyup', (event) => pressed.delete(event.code));
  window.addEventListener('blur', () => pressed.clear());

  function axis(negative: string, positive: string): number {
    return (pressed.has(positive) ? 1 : 0) - (pressed.has(negative) ? 1 : 0);
  }

  return {
    state,
    isLocked: () => locked,
    consume() {
      state.move.x = axis('KeyA', 'KeyD');
      state.move.y = axis('KeyW', 'KeyS');
      state.look.dx = 0;
      state.look.dy = 0;
      state.interact = false;
      state.toggleInventory = false;
    },
  };
}
