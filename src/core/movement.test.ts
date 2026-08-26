import { describe, expect, it } from 'vitest';
import { moveDelta } from './movement';

const W = { x: 0, y: -1 };
const S = { x: 0, y: 1 };
const A = { x: -1, y: 0 };
const D = { x: 1, y: 0 };

describe('moveDelta', () => {
  it('при yaw = 0 W ведёт в -Z', () => {
    const d = moveDelta(W, 0, 3, 0.1);
    expect(d.x).toBeCloseTo(0);
    expect(d.z).toBeCloseTo(-0.3);
  });

  it('при yaw = 0 D ведёт в +X', () => {
    const d = moveDelta(D, 0, 3, 0.1);
    expect(d.x).toBeCloseTo(0.3);
    expect(d.z).toBeCloseTo(0);
  });

  it('поворот на 90 градусов вправо разворачивает W в +X', () => {
    const d = moveDelta(W, -Math.PI / 2, 3, 0.1);
    expect(d.x).toBeCloseTo(0.3);
    expect(d.z).toBeCloseTo(0);
  });

  it('S идёт ровно против W при произвольном yaw', () => {
    const forward = moveDelta(W, 0.7, 3, 0.1);
    const back = moveDelta(S, 0.7, 3, 0.1);
    expect(back.x).toBeCloseTo(-forward.x);
    expect(back.z).toBeCloseTo(-forward.z);
  });

  it('A идёт ровно против D при произвольном yaw', () => {
    const right = moveDelta(D, 0.7, 3, 0.1);
    const left = moveDelta(A, 0.7, 3, 0.1);
    expect(left.x).toBeCloseTo(-right.x);
    expect(left.z).toBeCloseTo(-right.z);
  });

  it('вперёд и вбок перпендикулярны', () => {
    const f = moveDelta(W, 1.1, 3, 0.1);
    const r = moveDelta(D, 1.1, 3, 0.1);
    expect(f.x * r.x + f.z * r.z).toBeCloseTo(0);
  });

  it('диагональ не быстрее прямой ходьбы', () => {
    const straight = moveDelta(W, 0.4, 3, 0.1);
    const diagonal = moveDelta({ x: 1, y: -1 }, 0.4, 3, 0.1);
    expect(Math.hypot(diagonal.x, diagonal.z)).toBeCloseTo(Math.hypot(straight.x, straight.z));
  });

  it('без нажатий смещения нет', () => {
    expect(moveDelta({ x: 0, y: 0 }, 1.2, 3, 0.1)).toEqual({ x: 0, z: 0 });
  });

  it('половинное отклонение стика даёт половину скорости', () => {
    const half = moveDelta({ x: 0, y: -0.5 }, 0, 3, 0.1);
    expect(Math.hypot(half.x, half.z)).toBeCloseTo(0.15);
  });

  it('полное отклонение стика по диагонали не быстрее полной скорости', () => {
    const full = moveDelta({ x: Math.SQRT1_2, y: -Math.SQRT1_2 }, 0.3, 3, 0.1);
    expect(Math.hypot(full.x, full.z)).toBeCloseTo(0.3);
  });
});
