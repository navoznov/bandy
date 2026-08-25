import { describe, expect, it } from 'vitest';
import { loadLevel } from '../levels';
import { World } from './world';

/**
 * Единственный тест, который отвечает на вопрос «проходится ли игра».
 * Всё остальное проверяет детали по отдельности; здесь настоящий уровень
 * проходится от старта до победы теми же вызовами, что делает игровой цикл.
 */
function fresh(): World {
  const loaded = loadLevel();
  if (!loaded.ok) throw new Error(loaded.errors.join('\n'));
  return new World(loaded.level);
}

describe('уровень 1 проходится целиком', () => {
  it('ключ -> инвентарь -> рука -> замок -> дверь -> выход', () => {
    const world = fresh();
    const said: string[] = [];
    world.on((event) => { if (event.kind === 'said') said.push(event.text); });

    // Дверь в офис заперта с самого начала, и подсказка об этом честная.
    expect(world.describe('d_corr_office').ok).toBe(false);

    // Ключ лежит в мире и подбирается в инвентарь, а не сразу в руку.
    expect(world.describe('key_brass').ok).toBe(true);
    expect(world.interact('key_brass').ok).toBe(true);
    expect(world.inventory()).toContain('key_brass');
    expect(world.held()).toBe(null);

    // Замок без предмета в руках не поддаётся.
    expect(world.describe('lock_front').ok).toBe(false);

    // Взятый в руку предмет уходит из инвентаря: это два разных статуса.
    world.setHeld('key_brass');
    expect(world.held()).toBe('key_brass');
    expect(world.inventory()).not.toContain('key_brass');

    // Ключ открывает замок и расходуется.
    expect(world.describe('lock_front').ok).toBe(true);
    expect(world.interact('lock_front').ok).toBe(true);
    expect(world.isDestroyed('lock_front')).toBe(true);
    expect(world.held()).toBe(null);
    expect(world.inventory()).not.toContain('key_brass');
    expect(said).toEqual(['Замок щёлкнул и упал на пол.']);

    // Дверь, которая была заперта, теперь открывается.
    expect(world.describe('d_corr_office').ok).toBe(true);
    world.interact('d_corr_office');
    expect(world.isDoorOpen('d_corr_office')).toBe(true);

    // И только дойдя до конца выходного коридора, игрок побеждает.
    world.interact('d_exit');
    expect(world.won).toBe(false);
    world.checkTriggers(15.5, 25);
    expect(world.won).toBe(true);
  });

  it('замок нельзя открыть, не взяв ключ в руку', () => {
    const world = fresh();
    world.interact('key_brass');
    expect(world.inventory()).toContain('key_brass');
    // Ключ в инвентаре, но не в руке — этого мало.
    expect(world.interact('lock_front').ok).toBe(false);
    expect(world.isDestroyed('lock_front')).toBe(false);
  });
});
