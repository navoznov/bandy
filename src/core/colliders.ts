import { DOOR, ROOM } from '../config';
import { roomBounds } from './validate';
import type { DoorDef, Level } from './types';

export interface Aabb {
  x0: number;
  x1: number;
  z0: number;
  z1: number;
  /** Задан только у коллайдеров дверных створок. */
  doorId?: string;
}

type Segment = { from: number; to: number };

/** Вычитает из отрезка проёмы, оставляя куски стены. */
function subtract(segment: Segment, holes: Segment[]): Segment[] {
  let parts: Segment[] = [segment];
  for (const hole of holes) {
    const next: Segment[] = [];
    for (const part of parts) {
      if (hole.to <= part.from || hole.from >= part.to) { next.push(part); continue; }
      if (hole.from > part.from) next.push({ from: part.from, to: hole.from });
      if (hole.to < part.to) next.push({ from: hole.to, to: part.to });
    }
    parts = next;
  }
  return parts.filter((p) => p.to - p.from > 1e-6);
}

/** Половина толщины: используется только для створки двери, стоящей по центру границы. */
const half = ROOM.wallThickness / 2;

export function buildColliders(level: Level): Aabb[] {
  const boxes: Aabb[] = [];
  const doorHalf = DOOR.width / 2;

  for (const room of level.rooms) {
    const b = roomBounds(room);

    // Проёмы, приходящиеся на каждую из четырёх стен комнаты.
    const holesOnWest: Segment[] = [];
    const holesOnEast: Segment[] = [];
    const holesOnNorth: Segment[] = [];
    const holesOnSouth: Segment[] = [];

    for (const door of level.doors) {
      if (!door.between.includes(room.id)) continue;
      const [dx, dz] = door.at;
      if (Math.abs(dx - b.x0) < 1e-9) holesOnWest.push({ from: dz - doorHalf, to: dz + doorHalf });
      else if (Math.abs(dx - b.x1) < 1e-9) holesOnEast.push({ from: dz - doorHalf, to: dz + doorHalf });
      else if (Math.abs(dz - b.z0) < 1e-9) holesOnNorth.push({ from: dx - doorHalf, to: dx + doorHalf });
      else if (Math.abs(dz - b.z1) < 1e-9) holesOnSouth.push({ from: dx - doorHalf, to: dx + doorHalf });
    }

    // Стены строятся ВНУТРЬ комнаты, а не по центру границы. Иначе стены двух
    // соседних комнат оказались бы в одной плоскости, и рендер получил бы
    // z-fighting там, где комнаты разной длины делят стену.
    const t = ROOM.wallThickness;
    for (const seg of subtract({ from: b.z0, to: b.z1 }, holesOnWest)) {
      boxes.push({ x0: b.x0, x1: b.x0 + t, z0: seg.from, z1: seg.to });
    }
    for (const seg of subtract({ from: b.z0, to: b.z1 }, holesOnEast)) {
      boxes.push({ x0: b.x1 - t, x1: b.x1, z0: seg.from, z1: seg.to });
    }
    for (const seg of subtract({ from: b.x0, to: b.x1 }, holesOnNorth)) {
      boxes.push({ x0: seg.from, x1: seg.to, z0: b.z0, z1: b.z0 + t });
    }
    for (const seg of subtract({ from: b.x0, to: b.x1 }, holesOnSouth)) {
      boxes.push({ x0: seg.from, x1: seg.to, z0: b.z1 - t, z1: b.z1 });
    }
  }

  for (const door of level.doors) {
    boxes.push(doorCollider(door, level));
  }

  return boxes;
}

function doorCollider(door: DoorDef, level: Level): Aabb {
  const [dx, dz] = door.at;
  const doorHalf = DOOR.width / 2;
  const room = level.rooms.find((r) => r.id === door.between[0])!;
  const b = roomBounds(room);
  const onVerticalWall = Math.abs(dx - b.x0) < 1e-9 || Math.abs(dx - b.x1) < 1e-9;

  return onVerticalWall
    ? { x0: dx - half, x1: dx + half, z0: dz - doorHalf, z1: dz + doorHalf, doorId: door.id }
    : { x0: dx - doorHalf, x1: dx + doorHalf, z0: dz - half, z1: dz + half, doorId: door.id };
}

export function activeColliders(all: Aabb[], openDoors: ReadonlySet<string>): Aabb[] {
  return all.filter((b) => b.doorId === undefined || !openDoors.has(b.doorId));
}
