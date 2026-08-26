import { describe, expect, it } from 'vitest';
import { loadLevel } from '../levels';
import { World } from './world';

/**
 * Второй уровень целиком, теми же вызовами, что делает игровой цикл.
 * Ломается вместе с реестром взаимодействий — как и тест первого уровня.
 */
function fresh(): World {
  const loaded = loadLevel('level_02');
  if (!loaded.ok) throw new Error(loaded.errors.join('\n'));
  return new World(loaded.level);
}

describe('уровень 2 проходится целиком', () => {
  it('архив -> железный ключ -> решётка -> стальной ключ -> EXIT', () => {
    const world = fresh();
    const said: string[] = [];
    world.on((event) => { if (event.kind === 'said') said.push(event.text); });

    // Обе запертые двери заперты с самого начала.
    expect(world.describe('d_corr_elec').ok).toBe(false);
    expect(world.describe('d_corr_exit').ok).toBe(false);

    // Железный ключ лежит в архиве и подбирается в инвентарь.
    expect(world.interact('key_iron').ok).toBe(true);
    expect(world.inventory()).toContain('key_iron');

    // Он открывает решётку щитовой и расходуется.
    world.setHeld('key_iron');
    expect(world.interact('lock_grate').ok).toBe(true);
    expect(world.isDestroyed('lock_grate')).toBe(true);
    expect(world.held()).toBe(null);

    // Дверь в щитовую открылась, за ней стальной ключ.
    expect(world.describe('d_corr_elec').ok).toBe(true);
    expect(world.interact('key_steel').ok).toBe(true);

    // Второй ключ снимает замок с двери EXIT.
    world.setHeld('key_steel');
    expect(world.interact('lock_exit').ok).toBe(true);
    expect(world.isDestroyed('lock_exit')).toBe(true);

    expect(said).toEqual([
      'Решётка звякнула и упала на бетон.',
      'Замок поддался. Дверь свободна.',
    ]);

    // Дверь открывается, но победа наступает только в конце коридора.
    expect(world.describe('d_corr_exit').ok).toBe(true);
    world.interact('d_corr_exit');
    expect(world.isDoorOpen('d_corr_exit')).toBe(true);
    expect(world.won).toBe(false);
    world.checkTriggers(19.5, 23.5);
    expect(world.won).toBe(true);
  });

  /**
   * Обрезок трубы существует ровно ради этого: он учит игрока, что не всякий
   * подобранный предмет — ключ, и это первый уровень, где отказ
   * «сюда не подходит» вообще может случиться.
   */
  it('обрезок трубы не открывает ничего', () => {
    const world = fresh();
    world.interact('pipe');
    world.setHeld('pipe');

    expect(world.interact('lock_grate').ok).toBe(false);
    expect(world.isDestroyed('lock_grate')).toBe(false);
    expect(world.interact('lock_exit').ok).toBe(false);
    expect(world.isDestroyed('lock_exit')).toBe(false);
    // Труба на месте: неудачная попытка ничего не расходует.
    expect(world.held()).toBe('pipe');
  });

  it('стальной ключ не открывает решётку, а железный — дверь EXIT', () => {
    const world = fresh();
    world.interact('key_iron');
    world.setHeld('key_iron');
    expect(world.interact('lock_exit').ok).toBe(false);
    expect(world.isDestroyed('lock_exit')).toBe(false);
  });
});
