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
  maxPitch: 1.4835, // 85 градусов в радианах
} as const;

/** Потолок шага времени. Без него вкладка из фона телепортирует игрока сквозь стены. */
export const MAX_DELTA_SECONDS = 0.05;

/** Дальность луча прицела в метрах. */
export const INTERACT_RANGE = 2.5;
