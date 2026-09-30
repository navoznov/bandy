import { describe, expect, it } from 'vitest';
import { NIGHT } from '../config';
import { clampYaw, edgePan, keyAction, nightTicks } from './input';

describe('keyAction', () => {
  it('физические клавиши', () => {
    expect(keyAction('KeyQ')).toBe('doorLeft');
    expect(keyAction('KeyA')).toBe('lightLeft');
    expect(keyAction('KeyW')).toBe('vent');
    expect(keyAction('KeyD')).toBe('lightRight');
    expect(keyAction('KeyE')).toBe('doorRight');
    expect(keyAction('Space')).toBe('monitor');
  });
  it('чужие клавиши ничего не делают', () => {
    expect(keyAction('KeyS')).toBeNull();
    expect(keyAction('Escape')).toBeNull();
  });
});

describe('edgePan', () => {
  it('в середине экрана голова не крутится', () => {
    expect(edgePan(0.5)).toBe(0);
    expect(edgePan(0.2)).toBe(0);
    expect(edgePan(0.8)).toBe(0);
  });
  it('у левого края — влево, у правого — вправо, сильнее к краю', () => {
    expect(edgePan(0)).toBe(-1);
    expect(edgePan(1)).toBeCloseTo(1);
    expect(edgePan(0.075)).toBeCloseTo(-0.5);
    expect(edgePan(0.925)).toBeCloseTo(0.5);
  });
});

describe('clampYaw', () => {
  it('не дальше ±70° от центра', () => {
    expect(clampYaw(5, 0)).toBeCloseTo(NIGHT.lookLimit);
    expect(clampYaw(-5, 0)).toBeCloseTo(-NIGHT.lookLimit);
    expect(clampYaw(0.3, 0)).toBeCloseTo(0.3);
  });
});

// Телефон повернули в портрет — часы стоят.
describe('nightTicks', () => {
  it('часы идут только после старта и не в портрете на телефоне', () => {
    expect(nightTicks(false, false)).toBe(true);
    expect(nightTicks(true, false)).toBe(false);
    expect(nightTicks(false, true)).toBe(false);
  });
});
