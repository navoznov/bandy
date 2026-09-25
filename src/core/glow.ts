import { pathDistance, type Point } from './pathing';
import type { Level } from './types';

/**
 * Непрозрачность белого оверлея на подходе к выходу: 0 дальше 10 м, 0.9 у
 * триггера победы. Расстояние — по графу комнат, а не по прямой: по прямой
 * свет проходил сквозь стену, и угол соседней комнаты второго уровня,
 * в 3.8 м от триггера за стеной, светлел почти наполовину.
 *
 * Все двери считаются проходимыми. Запертая дверь EXIT свет пропускать не
 * должна, но проверять её незачем: на всех трёх уровнях от неё до триггера
 * больше 10 м, так что засветка всё равно начинается только внутри коридора.
 */
export function exitGlow(level: Level, player: Point): number {
  const trigger = level.triggers.find((t) => t.effect === 'win');
  if (!trigger) return 0;
  const [tx, tz, tw, td] = trigger.rect;
  const distance = pathDistance(level, player, { x: tx + tw / 2, z: tz + td / 2 }, () => true);
  if (distance === null) return 0;
  return Math.max(0, Math.min(1, (10 - distance) / 9)) * 0.9;
}
