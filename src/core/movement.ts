import type { Vec2 } from './collision';

/**
 * Переводит намерение игрока в смещение в мире за кадр.
 *
 * `move` задан в экранных осях: x = +1 вправо (D), y = -1 вперёд (W).
 * Камера в мире смотрит в (-sin yaw, -cos yaw) — по той же оси, что и move.y,
 * поэтому знак при move.y НЕ переворачивается. Проверено против three.js.
 *
 * Диагональ нормируется: W+D даёт ровно ту же длину шага, что и один W.
 */
export function moveDelta(
  move: { x: number; y: number },
  yaw: number,
  speed: number,
  dt: number,
): Vec2 {
  const length = Math.hypot(move.x, move.y);
  if (length === 0) return { x: 0, z: 0 };
  // Делим на длину только когда она БОЛЬШЕ единицы: диагональ WASD остаётся
  // нормированной, а неполное отклонение стика даёт пропорционально меньший шаг.
  const step = (speed * dt) / Math.max(length, 1);
  return {
    x: (Math.sin(yaw) * move.y + Math.cos(yaw) * move.x) * step,
    z: (Math.cos(yaw) * move.y - Math.sin(yaw) * move.x) * step,
  };
}
