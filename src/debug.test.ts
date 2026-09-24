import { describe, expect, it } from 'vitest';
import { applyDebug, parseDebug } from './debug';
import { loadLevel } from './levels';

describe('параметры запуска', () => {
  it('без параметров всё включено как в обычной игре', () => {
    expect(parseDebug('')).toEqual({
      antagonist: true, plainWalls: false, pixelRatio: null, antialias: true, fps: false,
    });
  });

  it('разбирает все флаги разом', () => {
    expect(parseDebug('?antagonist=off&walls=plain&dpr=1&aa=off&fps')).toEqual({
      antagonist: false, plainWalls: true, pixelRatio: 1, antialias: false, fps: true,
    });
  });

  it('dpr, который не положительное число, игнорируется', () => {
    expect(parseDebug('?dpr=abc').pixelRatio).toBeNull();
    expect(parseDebug('?dpr=0').pixelRatio).toBeNull();
    expect(parseDebug('?dpr=-1').pixelRatio).toBeNull();
    expect(parseDebug('?dpr=0.5').pixelRatio).toBe(0.5);
  });

  it('antagonist=off убирает антагониста с уровня', () => {
    const loaded = loadLevel('level_03');
    if (!loaded.ok) throw new Error('level_03 не загрузился');
    expect(loaded.level.antagonist).toBeDefined();
    const level = applyDebug(loaded.level, parseDebug('?antagonist=off'));
    expect(level.antagonist).toBeUndefined();
  });

  it('walls=plain снимает темы со всех комнат', () => {
    const loaded = loadLevel('level_03');
    if (!loaded.ok) throw new Error('level_03 не загрузился');
    expect(loaded.level.rooms.some((r) => r.style !== undefined)).toBe(true);
    const level = applyDebug(loaded.level, parseDebug('?walls=plain'));
    expect(level.rooms.every((r) => r.style === undefined)).toBe(true);
  });

  it('без флагов уровень возвращается как есть', () => {
    const loaded = loadLevel('level_03');
    if (!loaded.ok) throw new Error('level_03 не загрузился');
    expect(applyDebug(loaded.level, parseDebug(''))).toBe(loaded.level);
  });
});
