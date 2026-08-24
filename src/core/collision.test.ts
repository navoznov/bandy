import { describe, it, expect } from 'vitest';
import { resolveMove } from './collision';
import type { Aabb } from './colliders';

/** Вертикальная стена: полоса по x от 5.0 до 5.2, тянется по z от 0 до 10. */
const wallEast: Aabb = { x0: 5, x1: 5.2, z0: 0, z1: 10 };
/** Горизонтальная стена: полоса по z от 8.0 до 8.2, тянется по x от 0 до 10. */
const wallSouth: Aabb = { x0: 0, x1: 10, z0: 8, z1: 8.2 };

const R = 0.3;

describe('resolveMove', () => {
  it('не мешает движению в пустоте', () => {
    const result = resolveMove({ x: 1, z: 1 }, { x: 0.5, z: 0.25 }, R, []);
    expect(result).toEqual({ x: 1.5, z: 1.25 });
  });

  it('останавливает у стены на расстоянии радиуса', () => {
    const result = resolveMove({ x: 4, z: 3 }, { x: 2, z: 0 }, R, [wallEast]);
    expect(result.x).toBeCloseTo(4.7, 6);
    expect(result.z).toBeCloseTo(3, 6);
  });

  it('останавливает при подходе с другой стороны', () => {
    const result = resolveMove({ x: 6, z: 3 }, { x: -2, z: 0 }, R, [wallEast]);
    expect(result.x).toBeCloseTo(5.5, 6);
  });

  it('даёт скользить вдоль стены при движении по диагонали', () => {
    const result = resolveMove({ x: 4.6, z: 3 }, { x: 1, z: 1 }, R, [wallEast]);
    expect(result.x).toBeCloseTo(4.7, 6);
    expect(result.z).toBeCloseTo(4, 6);
  });

  it('останавливает по обеим осям в углу', () => {
    const result = resolveMove({ x: 4.6, z: 7.6 }, { x: 1, z: 1 }, R, [wallEast, wallSouth]);
    expect(result.x).toBeCloseTo(4.7, 6);
    expect(result.z).toBeCloseTo(7.7, 6);
  });

  it('не двигает при нулевой дельте', () => {
    const result = resolveMove({ x: 4.7, z: 3 }, { x: 0, z: 0 }, R, [wallEast]);
    expect(result).toEqual({ x: 4.7, z: 3 });
  });

  it('не запирает игрока, который уже оказался внутри стены', () => {
    // Штатный сценарий: игрок стоит в проёме и закрывает дверь — коллайдер створки
    // возвращается уже вокруг него. Выйти он обязан в любую сторону.
    const out = resolveMove({ x: 5.1, z: 3 }, { x: -1, z: 0 }, R, [wallEast]);
    expect(out.x).toBeCloseTo(4.1, 6);
    const through = resolveMove({ x: 5.1, z: 3 }, { x: 1, z: 0 }, R, [wallEast]);
    expect(through.x).toBeCloseTo(6.1, 6);
  });

  it('пропускает игрока в дверной проём между кусками стены', () => {
    const left: Aabb = { x0: 5, x1: 5.2, z0: 0, z1: 2.5 };
    const right: Aabb = { x0: 5, x1: 5.2, z0: 3.5, z1: 10 };
    const result = resolveMove({ x: 4.5, z: 3 }, { x: 1, z: 0 }, R, [left, right]);
    expect(result.x).toBeCloseTo(5.5, 6);
  });
});
