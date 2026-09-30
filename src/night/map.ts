import type { Level, NightDef } from '../core/types';
import { roomBounds } from '../core/validate';

/** Размер карты на мониторе, CSS px. Помещается в горизонтальный телефон над кнопкой монитора. */
export const MAP_WIDTH = 320;
export const MAP_HEIGHT = 230;
/** Сторона квадратика камеры, CSS px. */
export const CAM_BUTTON = 44;

/**
 * Масштаб карты по высоте экрана. Карта прижата к низу (`bottomPx` — её фактический
 * отступ снизу, вместе с safe-area), а сверху нужен резерв под часы и энергию.
 * В делителе карта плюс целый квадратик камеры: он выступает за прямоугольник
 * на полкамеры сверху и снизу. Не больше 1 (на высоком экране не раздуваем) и не меньше 0.
 */
export function mapScale(viewportHeight: number, bottomPx: number, topReserve: number): number {
  const available = viewportHeight - topReserve - bottomPx;
  return Math.max(0, Math.min(1, available / (MAP_HEIGHT + CAM_BUTTON)));
}

export interface MapLayout {
  rooms: Array<{ id: string; office: boolean; x: number; y: number; w: number; h: number }>;
  cameras: Array<{ id: string; x: number; y: number }>;
}

/**
 * Комнаты уровня, вписанные в прямоугольник карты с сохранением пропорций. Ось z
 * уровня идёт вниз по карте — как на рисунке. Квадратик камеры стоит посередине
 * между камерой и точкой, куда она смотрит: камеры висят в углах, и по месту
 * подвеса соседние квадратики слиплись бы.
 */
export function mapLayout(level: Level, def: NightDef, width: number, height: number, pad = 12): MapLayout {
  const bounds = level.rooms.map(roomBounds);
  const x0 = Math.min(...bounds.map((b) => b.x0));
  const x1 = Math.max(...bounds.map((b) => b.x1));
  const z0 = Math.min(...bounds.map((b) => b.z0));
  const z1 = Math.max(...bounds.map((b) => b.z1));
  const scale = Math.min((width - 2 * pad) / (x1 - x0), (height - 2 * pad) / (z1 - z0));
  const ox = (width - (x1 - x0) * scale) / 2;
  const oy = (height - (z1 - z0) * scale) / 2;
  const px = (x: number): number => ox + (x - x0) * scale;
  const py = (z: number): number => oy + (z - z0) * scale;

  return {
    rooms: level.rooms.map((room) => {
      const b = roomBounds(room);
      return {
        id: room.id,
        office: room.id === def.office,
        x: px(b.x0),
        y: py(b.z0),
        w: (b.x1 - b.x0) * scale,
        h: (b.z1 - b.z0) * scale,
      };
    }),
    cameras: def.cameras.map((cam) => ({
      id: cam.id,
      x: px((cam.at[0] + cam.look[0]) / 2),
      y: py((cam.at[1] + cam.look[1]) / 2),
    })),
  };
}
