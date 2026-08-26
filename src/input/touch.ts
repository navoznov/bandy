import { LOOK } from '../config';
import { emptyState, type InputSource, type InputState } from './types';

const STICK_RADIUS = 60;

/**
 * Показывает экранное управление. Зовётся дважды и намеренно идемпотентна:
 * один раз по возможности экрана (`pointer: coarse`) ещё до первого касания —
 * иначе на первом экране телефона нет ни стика, ни кнопок, ни подсказки про
 * ландшафт, и игрок не понимает, как ходить, — и второй раз при создании
 * тач-источника, на случай устройства, которое `pointer: coarse` не заявило.
 */
export function showTouchUi(): void {
  document.querySelector('#touch')?.removeAttribute('hidden');
  // Кнопка рюкзака и оверлей «поверни телефон» лежат вне #touch.
  document.querySelector('#btn-bag')?.removeAttribute('hidden');
  document.querySelector('#rotate')?.removeAttribute('hidden');
}

/** Прячет экранное управление: играют мышью, стик и кнопки только мешают. */
export function hideTouchUi(): void {
  document.querySelector('#touch')?.setAttribute('hidden', '');
  document.querySelector('#btn-bag')?.setAttribute('hidden', '');
  document.querySelector('#rotate')?.setAttribute('hidden', '');
}

/**
 * Левая половина экрана — плавающий стик, правая — свайп обзора.
 * Каждый палец отслеживается по pointerId: иначе второй палец перехватит
 * события первого и управление начнёт залипать.
 */
export function createTouchInput(canvas: HTMLCanvasElement): InputSource {
  const state: InputState = emptyState();

  const stick = document.querySelector<HTMLElement>('#stick');
  const knob = document.querySelector<HTMLElement>('#stick-knob');
  const useButton = document.querySelector<HTMLButtonElement>('#btn-use');
  const bagButton = document.querySelector<HTMLButtonElement>('#btn-bag');
  if (!stick || !knob || !useButton || !bagButton) {
    throw new Error('Разметка тач-управления не найдена.');
  }
  showTouchUi();

  let stickPointer: number | null = null;
  let stickOrigin = { x: 0, y: 0 };
  let lookPointer: number | null = null;
  let lookLast = { x: 0, y: 0 };

  canvas.addEventListener('pointerdown', (event) => {
    if (event.pointerType !== 'touch') return;
    event.preventDefault();

    if (event.clientX < window.innerWidth / 2) {
      if (stickPointer !== null) return;
      stickPointer = event.pointerId;
      stickOrigin = { x: event.clientX, y: event.clientY };
      stick.style.left = `${event.clientX - STICK_RADIUS}px`;
      stick.style.top = `${event.clientY - STICK_RADIUS}px`;
      stick.classList.add('active');
    } else {
      if (lookPointer !== null) return;
      lookPointer = event.pointerId;
      lookLast = { x: event.clientX, y: event.clientY };
    }
  });

  canvas.addEventListener('pointermove', (event) => {
    if (event.pointerType !== 'touch') return;
    event.preventDefault();

    if (event.pointerId === stickPointer) {
      const dx = event.clientX - stickOrigin.x;
      const dy = event.clientY - stickOrigin.y;
      const distance = Math.hypot(dx, dy) || 1;
      const clamped = Math.min(distance, STICK_RADIUS) / distance;
      knob.style.transform = `translate(${dx * clamped}px, ${dy * clamped}px)`;
      state.move.x = (dx * clamped) / STICK_RADIUS;
      state.move.y = (dy * clamped) / STICK_RADIUS;
    } else if (event.pointerId === lookPointer) {
      state.look.dx += (event.clientX - lookLast.x) * LOOK.touchGain;
      state.look.dy += (event.clientY - lookLast.y) * LOOK.touchGain;
      lookLast = { x: event.clientX, y: event.clientY };
    }
  });

  // Стрелка в const, а не объявление функции: TypeScript сбрасывает сужение типа
  // на поднимаемом объявлении, и `stick`/`knob` снова стали бы возможно-null.
  const release = (event: PointerEvent): void => {
    if (event.pointerId === stickPointer) {
      stickPointer = null;
      state.move.x = 0;
      state.move.y = 0;
      knob.style.transform = '';
      stick.classList.remove('active');
      // Снимаем инлайновую позицию — стик возвращается в угол, к правилам CSS.
      stick.style.left = '';
      stick.style.top = '';
    }
    if (event.pointerId === lookPointer) lookPointer = null;
  };
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);

  useButton.addEventListener('click', () => { state.interact = true; });
  bagButton.addEventListener('click', () => { state.toggleInventory = true; });

  return {
    state,
    scheme: 'touch',
    isLocked: () => true, // на телефоне захватывать нечего, управление активно всегда
    requestLock() {}, // и возвращать, соответственно, тоже нечего
    // Кнопка найдена при создании источника, поэтому в кадре нет ни поиска
    // по документу, ни ленивого кэша под него.
    setInteractAvailable(available) { useButton.disabled = !available; },
    consume() {
      state.look.dx = 0;
      state.look.dy = 0;
      state.interact = false;
      state.toggleInventory = false;
    },
  };
}
