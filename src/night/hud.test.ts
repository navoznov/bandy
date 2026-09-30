import { describe, expect, it } from 'vitest';
import { clockLabel } from './hud';

describe('clockLabel', () => {
  it('полночь — 12 AM, дальше по часам', () => {
    expect(clockLabel(0)).toBe('12 AM');
    expect(clockLabel(1)).toBe('1 AM');
    expect(clockLabel(6)).toBe('6 AM');
  });
});
