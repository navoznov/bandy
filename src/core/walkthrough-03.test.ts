import { describe, expect, it } from 'vitest';
import { loadLevel } from '../levels';
import { World } from './world';
import { activeColliders, buildColliders } from './colliders';
import { resolveMove, type Vec2 } from './collision';
import { PLAYER } from '../config';

/**
 * Третий уровень целиком, теми же вызовами, что делает игровой цикл.
 * Ломается вместе с реестром взаимодействий — как и тесты первых двух.
 */
function fresh(): World {
  const loaded = loadLevel('level_03');
  if (!loaded.ok) throw new Error(loaded.errors.join('\n'));
  return new World(loaded.level);
}

describe('уровень 3 проходится целиком', () => {
  it('детская -> медный ключ -> кухня -> труба -> ванная -> серебряный ключ -> EXIT', () => {
    const world = fresh();
    const said: string[] = [];
    world.on((event) => { if (event.kind === 'said') said.push(event.text); });

    // Все три запертые двери заперты с самого начала.
    expect(world.describe('d_hall_kitchen').ok).toBe(false);
    expect(world.describe('d_hall_bath').ok).toBe(false);
    expect(world.describe('d_store_exit').ok).toBe(false);

    // Медный ключ лежит открыто в детской.
    expect(world.interact('key_copper').ok).toBe(true);
    world.setHeld('key_copper');
    expect(world.interact('lock_copper').ok).toBe(true);
    expect(world.isDestroyed('lock_copper')).toBe(true);
    expect(world.held()).toBe(null);

    // За медным замком — кухня, в ней обрезок трубы.
    expect(world.describe('d_hall_kitchen').ok).toBe(true);
    expect(world.interact('pipe').ok).toBe(true);

    // Труба ломает ржавый замок и при этом остаётся у игрока: это инструмент,
    // а не ключ. Правило без `consume` — единственное, что делает разницу.
    world.setHeld('pipe');
    expect(world.interact('lock_rusty').ok).toBe(true);
    expect(world.isDestroyed('lock_rusty')).toBe(true);
    expect(world.held()).toBe('pipe');

    // За ржавым замком — ванная и серебряный ключ.
    expect(world.describe('d_hall_bath').ok).toBe(true);
    expect(world.interact('key_silver').ok).toBe(true);
    world.setHeld('key_silver');
    expect(world.interact('lock_silver').ok).toBe(true);
    expect(world.isDestroyed('lock_silver')).toBe(true);
    expect(world.held()).toBe(null);

    // Труба пережила весь уровень и лежит в рюкзаке.
    expect(world.inventory()).toContain('pipe');

    expect(said).toEqual([
      'Медный замок щёлкнул и упал на ковёр.',
      'Ржавая дужка хрустнула и лопнула.',
      'Серебряный замок открылся. За дверью — коридор к выходу.',
    ]);

    // Дверь открывается, но победа наступает только в конце коридора.
    expect(world.describe('d_store_exit').ok).toBe(true);
    world.interact('d_store_exit');
    expect(world.isDoorOpen('d_store_exit')).toBe(true);
    expect(world.won).toBe(false);
    world.checkTriggers(12.5, 28.5);
    expect(world.won).toBe(true);
  });

  /**
   * Кольцо открыто с первого шага. Если хоть один его отрезок окажется за
   * замком, погоня, ради которой уровень нарисован кольцом, станет невозможна.
   * Здесь это проверяется поведением, а не данными: `describe` отвечает тем же
   * кодом, что и настоящее нажатие.
   */
  it('все четыре двери кольца открываются с пустыми руками', () => {
    const world = fresh();
    for (const id of ['d_ring_sw', 'd_ring_se', 'd_ring_nw', 'd_ring_ne']) {
      const outcome = world.describe(id);
      expect(outcome.ok, `${id} не открывается`).toBe(true);
    }
  });

  /**
   * Железный ключ в спальне не открывает на этом уровне ничего: железного замка
   * тут нет. Ради таких обманок замки и научились называть себя — игрок читает
   * «Медный замок» и «Железный ключ» и делает вывод сам. Проверяется точный
   * текст отказа: он и есть весь интерфейс этой догадки.
   */
  it('железный ключ — обманка, и отказ называет обе стороны', () => {
    const world = fresh();
    expect(world.interact('key_iron').ok).toBe(true);
    world.setHeld('key_iron');

    const outcome = world.describe('lock_copper');
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.refusal).toBe('Медный замок. Железный ключ не подходит.');
    }
  });

  /**
   * Кольцо проверяется не только как граф дверей, но и ногами: игрок радиуса 0.3
   * шагами по 5 см обходит все четыре отрезка коридора и возвращается в точку
   * старта. Граф может быть замкнут, а проход — нет: проём, срезанный на 30 см
   * мимо стыка, оставляет дверь в данных и стену в геометрии. Такое не видно
   * ни в JSON, ни в реестре взаимодействий — только здесь или глазами.
   */
  it('по кольцу можно обойти круг и вернуться в начало', () => {
    const world = fresh();
    for (const id of ['d_ring_sw', 'd_ring_se', 'd_ring_nw', 'd_ring_ne']) {
      world.interact(id);
    }
    const boxes = activeColliders(buildColliders(world.level), world.openDoors());

    // Осевые линии четырёх отрезков: юг z=5, восток x=15, север z=13, запад x=7.
    // Повороты приходятся ровно на дверные проёмы кольца.
    const loop: Vec2[] = [
      { x: 15, z: 5 }, { x: 15, z: 13 }, { x: 7, z: 13 }, { x: 7, z: 5 },
    ];

    let pos: Vec2 = { x: 7, z: 5 };
    for (const target of loop) {
      for (let i = 0; i < 400; i++) {
        const dx = target.x - pos.x;
        const dz = target.z - pos.z;
        const dist = Math.hypot(dx, dz);
        if (dist < 1e-3) break;
        const step = Math.min(0.05, dist);
        pos = resolveMove(pos, { x: (dx / dist) * step, z: (dz / dist) * step },
                          PLAYER.radius, boxes);
      }
      const left = Math.hypot(target.x - pos.x, target.z - pos.z);
      expect(left, `упёрлись, не дойдя до (${target.x}, ${target.z})`).toBeLessThan(0.05);
    }
  });
});
