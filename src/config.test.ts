import { describe, it, expect } from 'vitest';
import { PLAYER, DOOR, MAX_DELTA_SECONDS } from './config';

describe('config', () => {
  it('задаёт человеческие размеры игрока', () => {
    expect(PLAYER.eyeHeight).toBe(1.6);
    expect(PLAYER.radius).toBe(0.3);
  });

  it('дверной проём выше игрока', () => {
    expect(DOOR.height).toBeGreaterThan(PLAYER.eyeHeight);
  });

  it('клампит шаг времени, чтобы игрок не проскакивал стены после сворачивания вкладки', () => {
    expect(MAX_DELTA_SECONDS).toBeLessThanOrEqual(0.05);
  });
});
