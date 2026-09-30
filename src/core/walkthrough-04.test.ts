import { describe, expect, it } from 'vitest';
import { loadLevel } from '../levels';
import { Night } from './night';
import { SHUTTER_SIDES } from './types';

/** Детерминированный генератор: одно и то же зерно — одна и та же ночь. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const DT = 0.05;

/**
 * Ночь целиком теми же вызовами, что делает цикл. «Аккуратный» игрок знает,
 * кто стоит у какой двери, и держит закрытой ровно ту заслонку, у которой
 * кто-то ждёт, — это верхняя граница игры. Если он не доживает до 6 AM,
 * ночь при текущих числах `NIGHT` непроходима в принципе.
 */
function play(seed: number, careful: boolean): Night {
  const loaded = loadLevel('level_04');
  if (!loaded.ok) throw new Error(loaded.errors.join('\n'));
  const def = loaded.level.night!;
  const night = new Night(def, mulberry32(seed));
  for (let i = 0; i < 8000 && (night.status === 'running' || night.status === 'blackout'); i++) {
    if (careful) {
      for (const side of SHUTTER_SIDES) {
        const threat = def.monsters.some((m) => m.door === side && night.atDoor(m.id));
        if (threat !== night.isClosed(side)) night.toggleShutter(side);
      }
    }
    night.step(DT);
  }
  return night;
}

const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

describe('ночь уровня 4', () => {
  it.each(SEEDS)('бездельника ловят (зерно %i)', (seed) => {
    expect(play(seed, false).status).toBe('caught');
  });

  it.each(SEEDS)('аккуратный доживает до 6 AM с энергией (зерно %i)', (seed) => {
    const night = play(seed, true);
    expect(night.status).toBe('won');
    expect(night.power).toBeGreaterThan(0);
  });
});
