import { describe, expect, it } from 'vitest';
import { Antagonist } from './antagonist';
import { World } from './world';
import { activeColliders, buildColliders } from './colliders';
import { loadLevel } from '../levels';
import { PLAYER } from '../config';
import type { Point } from './pathing';

/**
 * Утверждение о ЗАМЫСЛЕ, а не об ощущении: убегающий по кольцу со спринтом
 * уходит, забежавший в тупик — попадается. Ловит регрессию, которую иначе
 * заметит только палец на телефоне.
 *
 * `stopAtPathEnd`: остановить прогон и засчитать побег, как только точки
 * маршрута кончились, — а не длить сцену дальше, пока мок-игрок стоит
 * истуканом там, где и живой не задержался бы. Кольцевой сценарий проверяет
 * побег ВО ВРЕМЯ бегства; тупиковый — намеренно наоборот: тупик и есть цель,
 * поимка в загнанном углу после остановки — это и есть утверждаемый исход.
 */
function simulate(
  path: Point[], speed: number, stopAtPathEnd = false,
): { caught: boolean; seconds: number } {
  const loaded = loadLevel('level_03');
  if (!loaded.ok) throw new Error(loaded.errors.join('\n'));
  const world = new World(loaded.level);
  const all = buildColliders(loaded.level);
  const ai = new Antagonist(loaded.level, world);

  // Ставим его вплотную к игроку и лицом к нему: моделируем момент, когда он
  // уже увидел, а не весь путь до этого.
  const player = { ...path[0]! };
  ai.x = player.x; ai.z = player.z - 3;
  ai.facing = Math.PI;                      // взгляд в +z, на игрока

  const dt = 1 / 60;
  let leg = 1;
  for (let i = 0; i < 60 * 60; i++) {       // не больше минуты игрового времени
    const target = path[leg];
    if (target) {
      const dx = target.x - player.x;
      const dz = target.z - player.z;
      const distance = Math.hypot(dx, dz);
      if (distance < 0.1) { leg++; }
      else {
        const move = Math.min(speed * dt, distance);
        player.x += (dx / distance) * move;
        player.z += (dz / distance) * move;
      }
    } else if (stopAtPathEnd) {
      return { caught: false, seconds: i * dt };
    }
    ai.step(dt, player, activeColliders(all, world.openDoors()));
    if (ai.caught(player)) return { caught: true, seconds: i * dt };
  }
  return { caught: false, seconds: 60 };
}

describe('погоня в числах', () => {
  it('убегающий по кольцу со спринтом уходит', () => {
    // Юг -> восток -> север -> запад по осевым линиям кольца.
    const ring: Point[] = [
      { x: 8, z: 5 }, { x: 15, z: 5 }, { x: 15, z: 13 }, { x: 7, z: 13 }, { x: 7, z: 5 },
    ];
    expect(simulate(ring, PLAYER.sprintSpeed, true).caught).toBe(false);
  });

  it('забежавший в тупик попадается', () => {
    // Из коридора в спальню и в её дальний угол — выхода оттуда нет.
    const deadEnd: Point[] = [
      { x: 7, z: 9 }, { x: 3, z: 9 }, { x: 1, z: 12 },
    ];
    expect(simulate(deadEnd, PLAYER.sprintSpeed).caught).toBe(true);
  });

  it('идущий шагом по прямой не уходит бесконечно, но и не гибнет сразу', () => {
    const straight: Point[] = [{ x: 8, z: 5 }, { x: 15, z: 5 }];
    const result = simulate(straight, PLAYER.speed);
    expect(result.seconds).toBeGreaterThan(2);
  });
});
