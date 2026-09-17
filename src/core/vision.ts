import type { Aabb } from './colliders';
import type { Point } from './pathing';

/**
 * Пересекает ли отрезок прямоугольник. Метод срезов: по каждой оси считается
 * отрезок параметра t, на котором луч находится внутри полосы прямоугольника;
 * пересечение есть, если оба отрезка перекрываются внутри [0, 1].
 */
function hits(a: Point, b: Point, box: Aabb): boolean {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  let tMin = 0;
  let tMax = 1;

  for (const [origin, delta, lo, hi] of [
    [a.x, dx, box.x0, box.x1],
    [a.z, dz, box.z0, box.z1],
  ] as const) {
    if (Math.abs(delta) < 1e-12) {
      // Луч параллелен полосе: либо он внутри неё всегда, либо снаружи всегда.
      if (origin < lo || origin > hi) return false;
      continue;
    }
    const t1 = (lo - origin) / delta;
    const t2 = (hi - origin) / delta;
    tMin = Math.max(tMin, Math.min(t1, t2));
    tMax = Math.min(tMax, Math.max(t1, t2));
    if (tMin > tMax) return false;
  }
  return true;
}

export function segmentBlocked(a: Point, b: Point, boxes: readonly Aabb[]): boolean {
  for (const box of boxes) if (hits(a, b, box)) return true;
  return false;
}

/**
 * `facing` — радианы по соглашению yaw игрока: взгляд направлен в (-sin, -cos).
 * Конус обязателен: за спиной он игрока не видит, и это единственное, что делает
 * подкрадывание осмысленным.
 */
export function canSee(
  from: Point, facing: number, to: Point,
  boxes: readonly Aabb[], range: number, fov: number,
): boolean {
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  const distance = Math.hypot(dx, dz);
  if (distance > range) return false;
  if (distance < 1e-6) return true;

  const forwardX = -Math.sin(facing);
  const forwardZ = -Math.cos(facing);
  const cosAngle = (forwardX * dx + forwardZ * dz) / distance;
  if (cosAngle < Math.cos(fov)) return false;

  return !segmentBlocked(from, to, boxes);
}
