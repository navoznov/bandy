import { describe, expect, it } from 'vitest';
import { canSprint, stepStamina } from './stamina';
import { PLAYER } from '../config';

describe('выносливость', () => {
  it('полный запас тратится ровно за sprintSeconds', () => {
    let value = 1;
    for (let i = 0; i < PLAYER.sprintSeconds / 0.016; i++) value = stepStamina(value, true, 0.016);
    expect(value).toBeCloseTo(0, 2);
  });

  it('с нуля восстанавливается за recoverSeconds', () => {
    let value = 0;
    for (let i = 0; i < PLAYER.recoverSeconds / 0.016; i++) value = stepStamina(value, false, 0.016);
    expect(value).toBeCloseTo(1, 2);
  });

  it('не уходит ниже нуля и не растёт выше единицы', () => {
    expect(stepStamina(0, true, 10)).toBe(0);
    expect(stepStamina(1, false, 10)).toBe(1);
  });

  it('стоя с включённым бегом не тратится: draining ложно', () => {
    expect(stepStamina(0.5, false, 1)).toBeGreaterThan(0.5);
  });

  it('выдохшийся не побежит, пока не наберёт порог', () => {
    // Гистерезис: бежавший продолжает, пока есть хоть что-то; выдохшийся ждёт порога.
    expect(canSprint(0.05, true)).toBe(true);
    expect(canSprint(0, true)).toBe(false);
    expect(canSprint(0.05, false)).toBe(false);
    expect(canSprint(PLAYER.sprintUnlock, false)).toBe(true);
  });
});
