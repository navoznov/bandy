import { ANTAGONIST, ROOM } from '../config';
import { doorOnVerticalWall, roomBounds } from './validate';
import type { DoorDef, Level, RoomDef } from './types';

export interface Point { x: number; z: number }

/**
 * Насколько путевая точка отходит от линии стены. Стена строится внутрь комнаты
 * на всю толщину, поэтому свободное место начинается на `wallThickness`, а телу
 * радиуса `radius` нужен ещё и свой зазор. Сумма — минимальный отступ, при
 * котором тело нигде не задевает стену.
 */
export const INSET = ROOM.wallThickness + ANTAGONIST.radius;

export function roomCenter(room: RoomDef): Point {
  const b = roomBounds(room);
  return { x: (b.x0 + b.x1) / 2, z: (b.z0 + b.z1) / 2 };
}

export function roomAt(level: Level, p: Point): string | null {
  for (const room of level.rooms) {
    const b = roomBounds(room);
    if (p.x >= b.x0 && p.x <= b.x1 && p.z >= b.z0 && p.z <= b.z1) return room.id;
  }
  return null;
}

/**
 * Две точки прохода двери: первая внутри комнаты `from`, вторая — по ту сторону.
 * Центр двери путевой точкой НЕ является: он лежит на линии стены, и отрезок из
 * него в глубину комнаты ведёт тело сквозь стену тем дольше, чем положе угол.
 */
export function doorWaypoints(level: Level, door: DoorDef, from: string): [Point, Point] {
  const room = level.rooms.find((r) => r.id === from);
  if (!room) throw new Error(`Комнаты "${from}" нет в уровне.`);
  const [dx, dz] = door.at;
  const b = roomBounds(room);

  if (doorOnVerticalWall(door, room)) {
    // Стена на границе по X: точки разнесены по X. Внутрь комнаты — в сторону её центра.
    const inward = Math.abs(dx - b.x0) < 1e-9 ? +1 : -1;
    return [{ x: dx + inward * INSET, z: dz }, { x: dx - inward * INSET, z: dz }];
  }
  const inward = Math.abs(dz - b.z0) < 1e-9 ? +1 : -1;
  return [{ x: dx, z: dz + inward * INSET }, { x: dx, z: dz - inward * INSET }];
}

/** Кратчайшая цепочка комнат. `passable` решает, считается ли дверь ребром. */
export function roomPath(
  level: Pick<Level, 'doors'>, from: string, to: string, passable: (door: DoorDef) => boolean,
): string[] | null {
  if (from === to) return [from];
  const previous = new Map<string, string>();
  const seen = new Set<string>([from]);
  const queue: string[] = [from];

  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const door of level.doors) {
      if (!door.between.includes(current) || !passable(door)) continue;
      const next = door.between[0] === current ? door.between[1] : door.between[0];
      if (seen.has(next)) continue;
      seen.add(next);
      previous.set(next, current);
      if (next === to) {
        const chain = [to];
        let step = to;
        while (step !== from) { step = previous.get(step)!; chain.unshift(step); }
        return chain;
      }
      queue.push(next);
    }
  }
  return null;
}

/**
 * Длина пути между двумя точками в метрах, считая по центрам комнат. Нужна
 * виньетке: расстояние по прямой врёт, антагонист бывает в трёх метрах за стеной
 * и в двадцати метрах ходьбы.
 */
export function pathDistance(
  level: Level, from: Point, to: Point, passable: (door: DoorDef) => boolean,
): number | null {
  const fromRoom = roomAt(level, from);
  const toRoom = roomAt(level, to);
  if (fromRoom === null || toRoom === null) return null;
  const chain = roomPath(level, fromRoom, toRoom, passable);
  if (chain === null) return null;

  let total = 0;
  let cursor = from;
  for (let i = 1; i < chain.length; i++) {
    const room = level.rooms.find((r) => r.id === chain[i]!)!;
    const next = roomCenter(room);
    total += Math.hypot(next.x - cursor.x, next.z - cursor.z);
    cursor = next;
  }
  return total + Math.hypot(to.x - cursor.x, to.z - cursor.z);
}
