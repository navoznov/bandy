import { describe, expect, it } from 'vitest';
import { Antagonist } from './antagonist';
import { World } from './world';
import { loadLevel } from '../levels';
import { ANTAGONIST } from '../config';
import { activeColliders, buildColliders } from './colliders';
import { roomAt } from './pathing';

function fresh(): { world: World; ai: Antagonist } {
  const loaded = loadLevel('level_03');
  if (!loaded.ok) throw new Error(loaded.errors.join('\n'));
  const world = new World(loaded.level);
  return { world, ai: new Antagonist(loaded.level, world) };
}

/** Прогоняет N секунд игрового времени шагами по 16 мс. */
function run(ai: Antagonist, seconds: number, player = { x: -100, z: -100 }): void {
  const steps = Math.round(seconds / 0.016);
  for (let i = 0; i < steps; i++) ai.step(0.016, player, []);
}

describe('патруль', () => {
  it('появляется в точке из данных уровня', () => {
    const { ai } = fresh();
    expect(ai.x).toBeCloseTo(11);
    expect(ai.z).toBeCloseTo(13);
    expect(ai.state).toBe('patrol');
  });

  it('обходит уровень, а не топчется на месте', () => {
    const { world, ai } = fresh();
    const level = world.level;
    const visited = new Set<string>();
    for (let i = 0; i < 60 / 0.016; i++) {
      ai.step(0.016, { x: -100, z: -100 }, []);
      const room = roomAt(level, { x: ai.x, z: ai.z });
      if (room) visited.add(room);
    }
    // Смещение от точки появления мерить нельзя: обход цикличен, и в случайный
    // момент он оказывается ровно там, откуда вышел. За минуту он проходит семь
    // комнат — требуем пять, чтобы порог не зависел от фазы.
    expect(visited.size).toBeGreaterThanOrEqual(5);
    // Кухня заперта медным замком, и он его не открывает. Ни разу за минуту.
    // Это и есть механика убежища, записанная в спеке §2.
    expect(visited.has('kitchen')).toBe(false);
  });

  it('открывает закрытые двери на пути', () => {
    const { world, ai } = fresh();
    expect(world.isDoorOpen('d_ring_ne')).toBe(false);
    run(ai, 60);
    // За минуту он успевает уйти с севера в кабинет через кольцо.
    expect(world.openDoors().size).toBeGreaterThan(0);
  });

  it('запертую дверь не открывает никогда', () => {
    const { world, ai } = fresh();
    run(ai, 300);
    expect(world.isDoorOpen('d_hall_kitchen')).toBe(false);
    expect(world.isDestroyed('lock_copper')).toBe(false);
  });

  it('дверь из keepOpen не закрывает за собой', () => {
    const { world, ai } = fresh();
    run(ai, 300);
    const closedRing = ['d_ring_sw', 'd_ring_se', 'd_ring_nw', 'd_ring_ne']
      .filter((id) => !world.isDoorOpen(id));
    // Все двери кольца, которые он хоть раз прошёл, остались открытыми.
    // За пять минут он проходит кольцо многократно, значит закрытых быть не должно.
    expect(closedRing).toEqual([]);
  });

  it('тело нигде не задевает стены за весь обход', () => {
    const { world, ai } = fresh();
    // Геометрия уровня статична — коллайдеры строятся один раз, а не на каждой
    // из восемнадцати тысяч итераций. Меняется только набор открытых дверей.
    const all = buildColliders(world.level);
    const violations: string[] = [];

    for (let i = 0; i < 300 / 0.016; i++) {
      ai.step(0.016, { x: -100, z: -100 }, []);
      const boxes = activeColliders(all, world.openDoors());
      for (const b of boxes) {
        const insideX = ai.x > b.x0 - ANTAGONIST.radius && ai.x < b.x1 + ANTAGONIST.radius;
        const insideZ = ai.z > b.z0 - ANTAGONIST.radius && ai.z < b.z1 + ANTAGONIST.radius;
        if (insideX && insideZ) {
          violations.push(`${(i * 0.016).toFixed(1)} с: (${ai.x.toFixed(2)}, ${ai.z.toFixed(2)})`);
        }
      }
      // Первого нарушения достаточно: дальше он всё равно уже не там, где должен.
      if (violations.length > 0) break;
    }

    // Одна проверка вместо девятисот тысяч. Сообщение при падении называет
    // секунду и координаты — по ним видно, на какой двери сломалась геометрия.
    expect(violations).toEqual([]);
  });
});
