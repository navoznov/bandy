import { PLAYER } from '../config';

/** Запас 0..1. `draining` истинно, только когда игрок И правда бежит. */
export function stepStamina(value: number, draining: boolean, dt: number): number {
  const rate = draining ? -1 / PLAYER.sprintSeconds : 1 / PLAYER.recoverSeconds;
  return Math.max(0, Math.min(1, value + rate * dt));
}

/**
 * Гистерезис. Без него на нуле игрок бежит один кадр, идёт один кадр, снова
 * бежит — дёрганый ход и мигающая полоска.
 */
export function canSprint(value: number, wasSprinting: boolean): boolean {
  return wasSprinting ? value > 0 : value >= PLAYER.sprintUnlock;
}
