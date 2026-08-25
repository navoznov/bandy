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

export interface InputSource {
  readonly state: InputState;
  /** Сбрасывает накопленные за кадр дельты и фронты нажатий. Вызывается в конце кадра. */
  consume(): void;
  /** Захвачено ли управление. Пока не захвачено, игрок не двигается. */
  isLocked(): boolean;
}

export function emptyState(): InputState {
  return { move: { x: 0, y: 0 }, look: { dx: 0, dy: 0 }, interact: false, toggleInventory: false };
}
