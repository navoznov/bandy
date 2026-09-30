import { LOOK, NIGHT } from '../config';

export type NightAction = 'doorLeft' | 'lightLeft' | 'vent' | 'lightRight' | 'doorRight' | 'monitor';

/** Только `event.code` — физическая клавиша: смена раскладки игру не ломает. */
const KEYS: Record<string, NightAction> = {
  KeyQ: 'doorLeft',
  KeyA: 'lightLeft',
  KeyW: 'vent',
  KeyD: 'lightRight',
  KeyE: 'doorRight',
  Space: 'monitor',
};

export function keyAction(code: string): NightAction | null {
  return KEYS[code] ?? null;
}

/**
 * Нажатие, которое считается «кликом» по кнопке: мышью — только левой. Правая
 * кнопка, Ctrl-клик и двупальцевый тап открывают системное меню, а не жмут кнопку.
 */
export function isPrimaryPress(event: { pointerType: string; button: number }): boolean {
  return event.pointerType !== 'mouse' || event.button === 0;
}

/** Cmd/Ctrl/Alt — сочетание браузера (Cmd+D, Cmd+A…): игре оно не принадлежит. */
export function hasModifier(event: { metaKey: boolean; ctrlKey: boolean; altKey: boolean }): boolean {
  return event.metaKey || event.ctrlKey || event.altKey;
}

/** Доля ширины экрана у каждого края, где курсор поворачивает голову. */
const EDGE = 0.15;

/** Скорость поворота по положению курсора: 0 в середине, −1 у левого края, +1 у правого. */
export function edgePan(fraction: number): number {
  if (fraction < EDGE) return -(EDGE - fraction) / EDGE;
  if (fraction > 1 - EDGE) return (fraction - (1 - EDGE)) / EDGE;
  return 0;
}

export function clampYaw(yaw: number, center: number): number {
  return Math.max(center - NIGHT.lookLimit, Math.min(center + NIGHT.lookLimit, yaw));
}

/** Идут ли часы в этом кадре. Портрет на телефоне закрыт «Поверни телефон» — ночь ждёт. */
export function nightTicks(startVisible: boolean, portraitTouch: boolean): boolean {
  return !startVisible && !portraitTouch;
}

export interface NightInput {
  /** Поворот за кадр в радианах, положительный — влево. Копится между кадрами, забирается раз в кадр. */
  takeYaw(dt: number): number;
  onAction(handler: (action: NightAction) => void): void;
}

/**
 * Ввод офиса. Курсор не захватывается — кнопки надо кликать, — поэтому голову
 * поворачивает положение курсора у края экрана, как во FNAF. На телефоне —
 * горизонтальный свайп по канвасу; кнопки лежат выше канваса и свайпу не мешают.
 */
export function createNightInput(canvas: HTMLCanvasElement): NightInput {
  let pan = 0;
  let swipe = 0;
  let handler: (action: NightAction) => void = () => {};
  const lastX = new Map<number, number>();

  canvas.addEventListener('pointermove', (event) => {
    if (event.pointerType === 'mouse') {
      pan = edgePan(event.clientX / window.innerWidth);
      return;
    }
    const prev = lastX.get(event.pointerId);
    if (prev !== undefined) swipe += event.clientX - prev;
    lastX.set(event.pointerId, event.clientX);
  });
  canvas.addEventListener('pointerdown', (event) => {
    if (event.pointerType !== 'mouse') lastX.set(event.pointerId, event.clientX);
  });
  const forget = (event: PointerEvent): void => { lastX.delete(event.pointerId); };
  canvas.addEventListener('pointerup', forget);
  canvas.addEventListener('pointercancel', forget);
  // Курсор ушёл с канваса — на кнопку или за окно. У края его больше нет.
  canvas.addEventListener('pointerleave', (event) => {
    if (event.pointerType === 'mouse') pan = 0;
  });

  window.addEventListener('keydown', (event) => {
    if (hasModifier(event)) return;
    const action = keyAction(event.code);
    if (action === null) return;
    // Пробел иначе прокрутил бы страницу или нажал бы кнопку под фокусом.
    event.preventDefault();
    if (event.repeat) return;
    handler(action);
  });

  return {
    takeYaw(dt) {
      const turn = -pan * NIGHT.panSpeed * dt - swipe * LOOK.sensitivity * LOOK.touchGain;
      swipe = 0;
      return turn;
    },
    onAction(next) {
      handler = next;
    },
  };
}
