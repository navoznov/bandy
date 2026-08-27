export const PLAYER = {
  eyeHeight: 1.6,
  radius: 0.3,
  speed: 3,
  sprintSpeed: 4.5,     // против speed: 3
  sprintSeconds: 5,     // полный запас = 5 с бега ≈ 22 м, две трети кольца
  recoverSeconds: 8,    // с нуля до полного
  sprintUnlock: 0.3,    // ниже — бежать нельзя, пока не наберётся
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

/** Настройка игры, а не свойство карты, — поэтому здесь, а не в JSON уровня. */
export const ANTAGONIST = {
  speed: 2.6,          // м/с, всегда — и в патруле, и в погоне
  radius: 0.3,         // как у игрока
  sight: 12,           // м, дальность обнаружения
  fov: 1.047,          // ±60° в радианах
  catchDistance: 1.2,  // м
  searchSeconds: 6,    // сколько ищет, потеряв игрока
} as const;
