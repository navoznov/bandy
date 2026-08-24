import type { Aabb } from './colliders';

export interface Vec2 {
  x: number;
  z: number;
}

/**
 * Двигает круг радиуса `radius` из `pos` на `delta`, не пуская его в прямоугольники.
 * Оси разрешаются по очереди — благодаря этому игрок скользит вдоль стены,
 * а не залипает при движении по диагонали.
 */
export function resolveMove(
  pos: Vec2,
  delta: Vec2,
  radius: number,
  boxes: readonly Aabb[],
): Vec2 {
  let x = pos.x;
  let z = pos.z;

  if (delta.x !== 0) {
    let nextX = x + delta.x;
    for (const b of boxes) {
      if (z <= b.z0 - radius || z >= b.z1 + radius) continue;
      if (delta.x > 0 && x <= b.x0 - radius && nextX > b.x0 - radius) {
        nextX = Math.min(nextX, b.x0 - radius);
      } else if (delta.x < 0 && x >= b.x1 + radius && nextX < b.x1 + radius) {
        nextX = Math.max(nextX, b.x1 + radius);
      }
    }
    x = nextX;
  }

  if (delta.z !== 0) {
    let nextZ = z + delta.z;
    for (const b of boxes) {
      if (x <= b.x0 - radius || x >= b.x1 + radius) continue;
      if (delta.z > 0 && z <= b.z0 - radius && nextZ > b.z0 - radius) {
        nextZ = Math.min(nextZ, b.z0 - radius);
      } else if (delta.z < 0 && z >= b.z1 + radius && nextZ < b.z1 + radius) {
        nextZ = Math.max(nextZ, b.z1 + radius);
      }
    }
    z = nextZ;
  }

  return { x, z };
}
