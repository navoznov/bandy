import { describe, expect, it } from 'vitest';
import { canSee, segmentBlocked } from './vision';
import type { Aabb } from './colliders';

const WALL: Aabb[] = [{ x0: 4, x1: 4.2, z0: -10, z1: 10 }];
// Взгляд по соглашению yaw: направление (-sin f, -cos f).
// facing = -Math.PI / 2 смотрит в +X.
const EAST = -Math.PI / 2;

describe('отрезок и прямоугольник', () => {
  it('стена между точками перекрывает луч', () => {
    expect(segmentBlocked({ x: 0, z: 0 }, { x: 8, z: 0 }, WALL)).toBe(true);
  });

  it('стена в стороне не мешает', () => {
    expect(segmentBlocked({ x: 0, z: 0 }, { x: 3, z: 0 }, WALL)).toBe(false);
  });

  it('пустой список коллайдеров не перекрывает ничего', () => {
    expect(segmentBlocked({ x: 0, z: 0 }, { x: 100, z: 100 }, [])).toBe(false);
  });
});

describe('видит ли игрока', () => {
  const from = { x: 0, z: 0 };

  it('видит прямо перед собой', () => {
    expect(canSee(from, EAST, { x: 5, z: 0 }, [], 12, 1.047)).toBe(true);
  });

  it('не видит за спиной — это и есть подкрадывание', () => {
    expect(canSee(from, EAST, { x: -1, z: 0 }, [], 12, 1.047)).toBe(false);
  });

  it('не видит дальше своей дальности', () => {
    expect(canSee(from, EAST, { x: 13, z: 0 }, [], 12, 1.047)).toBe(false);
  });

  it('не видит сквозь стену', () => {
    expect(canSee(from, EAST, { x: 8, z: 0 }, WALL, 12, 1.047)).toBe(false);
  });

  it('за границей конуса не видит, внутри — видит', () => {
    // 45° вбок при конусе ±60° — внутри; 75° — снаружи.
    const inside = { x: Math.cos(Math.PI / 4) * 5, z: -Math.sin(Math.PI / 4) * 5 };
    const outside = { x: Math.cos(Math.PI / 2.4) * 5, z: -Math.sin(Math.PI / 2.4) * 5 };
    expect(canSee(from, EAST, inside, [], 12, 1.047)).toBe(true);
    expect(canSee(from, EAST, outside, [], 12, 1.047)).toBe(false);
  });
});
