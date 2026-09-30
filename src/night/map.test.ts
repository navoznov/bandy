import { describe, expect, it } from 'vitest';
import { loadLevel } from '../levels';
import { CAM_BUTTON, MAP_HEIGHT, MAP_WIDTH, mapLayout, mapScale } from './map';

function level04() {
  const loaded = loadLevel('level_04');
  if (!loaded.ok) throw new Error(loaded.errors.join('\n'));
  return { level: loaded.level, def: loaded.level.night! };
}

describe('mapLayout', () => {
  it('все комнаты внутри карты', () => {
    const { level, def } = level04();
    const { rooms } = mapLayout(level, def, MAP_WIDTH, MAP_HEIGHT);
    expect(rooms).toHaveLength(level.rooms.length);
    for (const r of rooms) {
      expect(r.x, r.id).toBeGreaterThanOrEqual(0);
      expect(r.y, r.id).toBeGreaterThanOrEqual(0);
      expect(r.x + r.w, r.id).toBeLessThanOrEqual(MAP_WIDTH + 1e-9);
      expect(r.y + r.h, r.id).toBeLessThanOrEqual(MAP_HEIGHT + 1e-9);
    }
  });

  it('офис помечен', () => {
    const { level, def } = level04();
    const { rooms } = mapLayout(level, def, MAP_WIDTH, MAP_HEIGHT);
    expect(rooms.filter((r) => r.office).map((r) => r.id)).toEqual(['office']);
  });

  // Квадратики — цель для пальца: слипшиеся на телефоне не нажать по отдельности.
  it('квадратики камер не налезают друг на друга', () => {
    const { level, def } = level04();
    const { cameras } = mapLayout(level, def, MAP_WIDTH, MAP_HEIGHT);
    for (let i = 0; i < cameras.length; i++) {
      for (let j = i + 1; j < cameras.length; j++) {
        const a = cameras[i]!;
        const b = cameras[j]!;
        const apart = Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
        expect(apart, `${a.id} и ${b.id}`).toBeGreaterThanOrEqual(CAM_BUTTON);
      }
    }
  });
});

describe('mapScale', () => {
  it('высокий экран: масштаб 1, не больше', () => {
    expect(mapScale(900, 92, 64)).toBe(1);
    expect(mapScale(100000, 0, 0)).toBe(1);
  });

  it('телефон в ландшафте 272 px, отступ снизу 16: карта с квадратиками влезает', () => {
    const s = mapScale(272, 16, 64);
    expect(s).toBeGreaterThan(0.65);
    expect(s).toBeLessThan(0.8);
    // Верх карты вместе с выступающей половиной квадратика не выше резерва.
    const top = 272 - 16 - s * (MAP_HEIGHT + CAM_BUTTON / 2);
    expect(top).toBeGreaterThanOrEqual(64 - 1e-9);
  });

  it('не уходит в минус, если места нет вовсе', () => {
    expect(mapScale(50, 16, 64)).toBe(0);
  });
});
