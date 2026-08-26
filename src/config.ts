export const PLAYER = {
  eyeHeight: 1.6,
  radius: 0.3,
  speed: 3,
} as const;

export const ROOM = {
  height: 3,
  wallThickness: 0.2,
} as const;

export const DOOR = {
  width: 0.9,
  height: 2.1,
  openSeconds: 0.4,
} as const;

export const LOOK = {
  sensitivity: 0.0022,
  /**
   * Множитель для свайпа обзора. Мышь под захватом отдаёт сырые пиксели
   * устройства, а палец — CSS-пиксели, и их на порядок меньше: полный свайп по
   * правой половине телефона (около 350 px) при одной лишь `sensitivity` давал
   * бы 44°, то есть четыре свайпа на разворот. С множителем — около 110°.
   * Применяется внутри тач-схемы, чтобы игровой цикл по-прежнему не знал,
   * с какого устройства играют.
   */
  touchGain: 2.5,
  maxPitch: 1.4835, // 85 градусов в радианах
} as const;

/** Потолок шага времени. Без него вкладка из фона телепортирует игрока сквозь стены. */
export const MAX_DELTA_SECONDS = 0.05;

/** Дальность луча прицела в метрах. */
export const INTERACT_RANGE = 2.5;
