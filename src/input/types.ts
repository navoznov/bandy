export interface InputState {
  /** Желаемое направление в осях игрока, каждая компонента в диапазоне -1..1. */
  move: { x: number; y: number };
  /** Накопленная за кадр дельта поворота. */
  look: { dx: number; dy: number };
  /** Фронт нажатия «взаимодействовать». */
  interact: boolean;
  /** Фронт нажатия «инвентарь». */
  toggleInventory: boolean;
}

/** Какой схемой играют прямо сейчас. Меняется по факту последнего события ввода. */
export type InputScheme = 'desktop' | 'touch';

export interface InputSource {
  readonly state: InputState;
  /**
   * Активная схема. Нужна только тексту подсказок: на десктопе игрок должен
   * прочитать имя клавиши, на телефоне — увидеть кнопку. Игровая логика от неё
   * не зависит и знать про устройство по-прежнему не должна.
   */
  readonly scheme: InputScheme;
  /** Сбрасывает накопленные за кадр дельты и фронты нажатий. Вызывается в конце кадра. */
  consume(): void;
  /** Захвачено ли управление. Пока не захвачено, игрок не двигается. */
  isLocked(): boolean;
  /**
   * Есть ли под прицелом цель. Тач-схема гасит и зажигает этим кнопку «Действие»,
   * десктопная не делает ничего. Зовётся каждый кадр.
   */
  setInteractAvailable(available: boolean): void;
}

export function emptyState(): InputState {
  return { move: { x: 0, y: 0 }, look: { dx: 0, dy: 0 }, interact: false, toggleInventory: false };
}
