import { describe, expect, it } from 'vitest';
import { Antagonist } from './antagonist';
import { World } from './world';
import { activeColliders, bodyHits, buildColliders } from './colliders';
import { loadLevel } from '../levels';
import { ANTAGONIST, PLAYER } from '../config';
import type { Point } from './pathing';

const RING_DOORS = ['d_ring_sw', 'd_ring_se', 'd_ring_nw', 'd_ring_ne'];

interface Options {
  /** Откуда стартует антагонист. Всегда в одной комнате с игроком и лицом к нему. */
  aiAt: Point;
  /** Бежит ли игрок. Запас выносливости кончается, дальше он идёт шагом. */
  sprint?: boolean;
  /**
   * Двери, открытые до начала сцены. Мок-игрок ходит без коллизий и прошёл бы
   * закрытую дверь насквозь, а антагонист заплатил бы за неё `DOOR.openSeconds`.
   * В настоящей игре закрытая дверь — коллайдер для обоих, и попасть за неё,
   * не открыв, игрок не может. Открываем заранее, иначе сцена дарит игроку фору,
   * которой у него нет.
   */
  preOpen?: string[];
  /**
   * Досчитать побег, как только точки маршрута кончились, — а не длить сцену,
   * пока мок-игрок стоит истуканом там, где живой не задержался бы.
   */
  stopAtPathEnd?: boolean;
}

/**
 * Утверждение о ЗАМЫСЛЕ, а не об ощущении: убегающий по кольцу уходит,
 * забежавший в тупик — попадается. Ловит регрессию, которую иначе заметит
 * только палец на телефоне.
 *
 * `violations` — кадры, в которых тело антагониста оказалось внутри стены.
 * Патрульный обход это уже проверяет (`antagonist.test.ts`), но там план
 * строится только из центра комнаты. В погоне план перестраивается на ходу,
 * из произвольной точки и на произвольную цель, — и это совсем другой риск.
 */
function simulate(
  path: Point[], options: Options,
): { caught: boolean; seconds: number; violations: string[] } {
  const loaded = loadLevel('level_03');
  if (!loaded.ok) throw new Error(loaded.errors.join('\n'));
  const world = new World(loaded.level);
  for (const door of options.preOpen ?? []) {
    world.applyEffects([{ kind: 'toggleDoor', door }]);
  }
  const all = buildColliders(loaded.level);
  const ai = new Antagonist(loaded.level, world);

  // Момент, когда он УЖЕ увидел: одна комната, прямая видимость, взгляд на него.
  const player = { ...path[0]! };
  ai.x = options.aiAt.x;
  ai.z = options.aiAt.z;
  ai.facing = Math.atan2(-(player.x - ai.x), -(player.z - ai.z));

  const violations: string[] = [];
  const dt = 1 / 60;
  let leg = 1;
  for (let i = 0; i < 60 * 60; i++) {       // не больше минуты игрового времени
    const seconds = i * dt;
    // Спринт не бесконечен: запаса хватает на 22 м из 31 м кольца, дальше шагом.
    const speed = options.sprint && seconds < PLAYER.sprintSeconds
      ? PLAYER.sprintSpeed : PLAYER.speed;

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
    } else if (options.stopAtPathEnd) {
      return { caught: false, seconds, violations };
    }

    const boxes = activeColliders(all, world.openDoors());
    ai.step(dt, player, boxes);

    const hit = bodyHits(ai, ANTAGONIST.radius, boxes);
    if (hit) {
      violations.push(
        `${seconds.toFixed(2)} с: (${ai.x.toFixed(2)}, ${ai.z.toFixed(2)}) `
        + `в стене [${hit.x0}, ${hit.x1}] × [${hit.z0}, ${hit.z1}]`);
    }
    if (ai.caught(player)) return { caught: true, seconds, violations };
  }
  return { caught: false, seconds: 60, violations };
}

describe('погоня в числах', () => {
  it('убегающий по кольцу уходит, даже когда выносливость кончилась', () => {
    // Три четверти круга: юг -> восток -> север -> запад. Полный круг проверять
    // нельзя — он приводит игрока обратно в ту комнату, где антагонист потерял
    // его и остался искать, и «поимка» была бы не заслугой погони, а следствием
    // того, что скрипт привёл жертву обратно. Живой игрок так не бегает.
    const ring: Point[] = [
      { x: 11, z: 5 }, { x: 15, z: 5 }, { x: 15, z: 13 }, { x: 7, z: 13 }, { x: 7, z: 7 },
    ];
    // 26 м: запаса спринта хватает на 22, последние метры игрок идёт шагом.
    const result = simulate(ring, {
      aiAt: { x: 8, z: 5 }, sprint: true, preOpen: RING_DOORS, stopAtPathEnd: true,
    });
    expect(result.violations).toEqual([]);
    expect(result.caught).toBe(false);
  });

  it('забежавший в тупик попадается', () => {
    // Из коридора в спальню и в её дальний угол — выхода оттуда нет.
    const deadEnd: Point[] = [
      { x: 7, z: 9 }, { x: 3, z: 9 }, { x: 1, z: 12 },
    ];
    const result = simulate(deadEnd, {
      aiAt: { x: 7, z: 6.5 }, sprint: true, preOpen: ['d_hall_bedroom'],
    });
    expect(result.violations).toEqual([]);
    expect(result.caught).toBe(true);
  });

  it('идущий шагом по прямой не уходит бесконечно, но и не гибнет сразу', () => {
    // Оба утверждения из названия — иначе «не гибнет сразу» проходит и тогда,
    // когда он не догоняет вообще никогда, а это ровно та регрессия, ради
    // которой тест написан.
    const straight: Point[] = [{ x: 9, z: 5 }, { x: 15, z: 5 }];
    const result = simulate(straight, { aiAt: { x: 6.5, z: 5 } });
    expect(result.violations).toEqual([]);
    expect(result.caught).toBe(true);
    expect(result.seconds).toBeGreaterThan(2);
  });
});
