import { describe, expect, it } from 'vitest';
import { loadLevel, nextLevelId } from './index';

describe('реестр уровней', () => {
  it('без аргумента грузит первый уровень', () => {
    const loaded = loadLevel();
    expect(loaded.ok).toBe(true);
    if (loaded.ok) expect(loaded.level.id).toBe('level_01');
  });

  it('грузит уровень по идентификатору', () => {
    const loaded = loadLevel('level_02');
    expect(loaded.ok).toBe(true);
    if (loaded.ok) expect(loaded.level.id).toBe('level_02');
  });

  /**
   * Неизвестный идентификатор — не ошибка уровня, а чужая ссылка в руках игрока.
   * Правильная реакция — начать игру, а не показать экран ошибки.
   */
  it('неизвестный идентификатор молча даёт первый уровень', () => {
    const loaded = loadLevel('level_99');
    expect(loaded.ok).toBe(true);
    if (loaded.ok) expect(loaded.level.id).toBe('level_01');
  });

  it('знает порядок прохождения и конец игры', () => {
    expect(nextLevelId('level_01')).toBe('level_02');
    expect(nextLevelId('level_02')).toBe('level_03');
    expect(nextLevelId('level_03')).toBe(null);
    expect(nextLevelId('level_99')).toBe(null);
  });
});
